/*
 * Démarrage du simulateur :
 *  1. initialise le storage simulé (settings + état) du plugin
 *  2. injecte la VRAIE popup (popup.html) dans #pluginStage
 *  3. charge le vrai code (i18n.js, theme.js, background.js, popup.js)
 *  4. câble les contrôles de simulation et le flux d'activité
 */
(function () {
  "use strict";

  const qs = new URLSearchParams(location.search);
  const STORE = window.BUZZ;
  const SIM = window.SIM;

  function nowIso() {
    return new Date().toISOString();
  }

  function hoursAgo(h) {
    return new Date(Date.now() - h * 3600e3).toISOString();
  }

  function seedState() {
    const tickets = SIM.list();
    const seen = tickets.map((t) => t.id);
    const seenDelta = {};
    tickets.forEach((t) => (seenDelta[t.id] = t.delta_ts));
    return {
      baselineDone: true,
      seen: seen,
      seenDelta: seenDelta,
      lastPollTime: nowIso(),
      lastDetection: nowIso(),
      lastDetected: tickets.slice(0, 50).map((t, i) => ({
        id: t.id,
        summary: String(t.summary || "").slice(0, 80),
        product: t.product,
        status: t.status,
        severity: t.severity,
        time: t.delta_ts,
        kind: i < 3 ? "new" : "updated"
      })),
      offline: false,
      failCount: 0,
      lastError: null,
      lastErrorTime: null
    };
  }

  function seedSettings() {
    const lang = qs.get("lang") || "fr";
    const theme = qs.get("theme") || "auto";
    const watchMode = qs.get("mode") || "all";
    return {
      enabled: true,
      bugzillaUrl: "https://bugzilla.sim",
      pollInterval: 1,
      baselineFirstRun: false,
      auth: { mode: "apiKey", apiKey: "demo-key" },
      orderBy: "importance",
      orderDirection: "DESC",
      maxTickets: 50,
      lang: lang,
      theme: theme,
      watchMode: watchMode,
      criteria: {
        product: "",
        component: "",
        status: "",
        resolution: "",
        severity: "",
        priority: "",
        assigned_to: "",
        creator: "",
        summary: "",
        version: "",
        target_milestone: "",
        op_sys: "",
        platform: "",
        qa_contact: "",
        whiteboard: "",
        keywords: "",
        tags: "",
        quicksearch: ""
      },
      advancedCriteria: [],
      rawParams: "{}",
      notify: { toast: true, sound: true, soundUrl: "" }
    };
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("chargement impossible : " + src));
      document.body.appendChild(s);
    });
  }

  function injectPopupMarkup() {
    return fetch("../popup/popup.html")
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then((html) => {
        const m = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        if (!m) throw new Error("corps de popup.html introuvable");
        const stage = document.getElementById("pluginStage");
        stage.innerHTML += "<div class='stage-body'>" + m[1] + "</div>";
      });
  }

  async function boot() {
    const initialSettings = seedSettings();
    const initialState = seedState();

    document.documentElement.lang = initialSettings.lang;
    document.documentElement.dataset.theme =
      initialSettings.theme === "auto" ? "light" : initialSettings.theme;

    STORE.seedSettings(initialSettings, initialState);

    await injectPopupMarkup();

    for (const src of ["../i18n.js", "../theme.js", "../background.js", "../popup/popup.js"]) {
      await loadScript(src);
    }

    wireControls(initialSettings);
  }

  function setSelect(id, value) {
    const el = document.getElementById(id);
    el.value = value;
  }

  function wireControls() {
    STORE.getSettings().then((s) => {
      setSelect("selWatch", s.watchMode || "all");
    });
    setSelect("selLang", document.documentElement.lang);
    setSelect("selTheme", document.documentElement.dataset.theme);

    let lastBadge = { text: "", color: "#d32f2f" };
    const applyBadge = () => {
      const el = document.getElementById("badge");
      el.textContent = lastBadge.text;
      el.hidden = !lastBadge.text;
      el.style.background = lastBadge.color || "#d32f2f";
    };
    const relayout = () => {
      return Promise.resolve(typeof window.refresh === "function" ? window.refresh() : null).then(applyBadge);
    };

    document.getElementById("selWatch").addEventListener("change", (e) => {
      STORE.setSettings({ watchMode: e.target.value }).then(() => {
        relayout();
        STORE.log("poll", "mode de surveillance → " + e.target.value);
      });
    });

    document.getElementById("selCycle").addEventListener("change", (e) => {
      STORE.setAlarmScale(Number(e.target.value) || 5);
      startCadence();
    });

    document.getElementById("chkErr").addEventListener("change", (e) => {
      SIM.setErrMode(!!e.target.checked);
      STORE.log(e.target.checked ? "err" : "poll", e.target.checked ? "panne Bugzilla simulée → ACTIVE" : "panne Bugzilla simulée → résolue");
      STORE.pollOnce();
    });

    document.getElementById("selTheme").addEventListener("change", (e) => {
      const v = e.target.value;
      document.documentElement.dataset.theme = v === "auto" ? "light" : v;
      STORE.setSettings({ theme: v });
      STORE.log("sys", "thème → " + v);
    });

    document.getElementById("selLang").addEventListener("change", (e) => {
      STORE.setSettings({ lang: e.target.value }).then(() => location.reload());
    });

    document.getElementById("btnBaseline").addEventListener("click", () => {
      const threeHoursAgo = hoursAgo(3);
      browser.storage.local
        .set({
          state: {
            baselineDone: true,
            seen: [],
            seenDelta: {},
            lastPollTime: threeHoursAgo,
            lastDetection: null,
            lastDetected: [],
            offline: false,
            failCount: 0,
            lastError: null,
            lastErrorTime: null
          }
        })
        .then(() => {
          STORE.log("det", "état remis à zéro → détection initiale de tous les tickets");
          return STORE.pollOnce();
        })
        .then(relayout);
    });

    // actualisation automatique de la popup après chaque cycle
    STORE.onStateRefresh(relayout);

    // poll périodique piloté par la page (indépendant des alarmes du background)
    const CYCLE_MS = { 5: 5000, 15: 15000, 30: 30000 };
    let cycleTimer = null;
    const startCadence = () => {
      if (cycleTimer) clearInterval(cycleTimer);
      const sec = Number(document.getElementById("selCycle").value) || 5;
      cycleTimer = setInterval(() => {
        STORE.pollOnce().then(relayout).catch(() => {});
      }, CYCLE_MS[sec] || 5000);
    };

    // badge "live" (comme l'icône de la barre d'outils)
    let prevBadgeText = "";
    STORE.onBadge(({ text, color }) => {
      lastBadge = { text: text || "", color: color };
      applyBadge();
      if (lastBadge.text && lastBadge.text !== prevBadgeText) {
        STORE.log("badge", "badge → " + lastBadge.text);
      }
      prevBadgeText = lastBadge.text;
    });

    startCadence();
    STORE.pollOnce().then(relayout);
  }

  boot().catch((e) => {
    const stage = document.getElementById("pluginStage");
    stage.innerHTML =
      "<div style='padding:14px;color:#b71c1c;font:14px sans-serif'>" +
      "Erreur de démarrage : " + String(e && e.message || e) +
      "<br>Ouvrez cette page via un serveur statique (python -m http.server) ou GitHub Pages.</div>";
  });
})();