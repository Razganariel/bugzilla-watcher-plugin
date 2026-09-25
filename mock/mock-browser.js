/*
 * Demo mode — fake browser + fake data for screenshots.
 * Loaded FIRST in mock/popup-demo.html and mock/options-demo.html.
 * Never included in the shipped add-on (mock/ is not part of build.js SHARED).
 *
 * URL parameters:
 *   ?state=demo|new|error|offline|empty   display scenario (default demo)
 *   ?lang=fr|en|de|es|it|nl               UI language        (default fr)
 *   ?theme=auto|light|dark                color theme        (default auto)
 *   ?filter=all|new                       popup filter       (default all)
 *
 * Works in three modes:
 *   - real add-on (extension page)  : patches the real `browser` in place
 *   - local HTTP server             : creates a full `browser` stub
 *   - file://                       : NOT supported (fetch blocked) — a
 *                                     banner is shown by load-markup.js
 *
 * All data below is entirely fictitious ("example.com" is reserved by RFC 2606).
 */
(function () {
  "use strict";

  window.__MOCK__ = true;

  const qs = new URLSearchParams(location.search);
  const state = qs.get("state") || "demo";
  const lang = qs.get("lang") || "fr";
  const theme = qs.get("theme") || "auto";
  const filter = qs.get("filter") || "all";
  const isOptions = /options-demo/.test(location.pathname);

  const NOW = "2026-09-20T10:12:00Z";

  function hoursAgo(h, m) {
    const d = new Date(Date.parse(NOW) - h * 3600e3 - (m || 0) * 60e3);
    return d.toISOString().replace(/\.\d{3}Z$/, "Z");
  }

  const settings = {
    enabled: true,
    bugzillaUrl: "https://bugzilla.example.com",
    pollInterval: 5,
    baselineFirstRun: false,
    auth: { mode: "session", apiKey: "" },
    orderBy: "importance",
    orderDirection: "DESC",
    maxTickets: 50,
    lang: lang,
    theme: theme,
    watchMode: state === "new" || state === "empty" ? "new" : "all",
    criteria: {
      product: "Customer Portal",
      component: "Billing",
      status: "NEW,ASSIGNED,REOPENED",
      resolution: "",
      severity: "blocker,critical",
      priority: "P1,P2",
      assigned_to: "s.dupont@example.com",
      creator: "",
      summary: "",
      version: "2026.09",
      target_milestone: "2026.10",
      op_sys: "All",
      platform: "x86_64",
      qa_contact: "qa-team@example.com",
      whiteboard: "",
      keywords: "regression",
      tags: "",
      quicksearch: ""
    },
    advancedCriteria: [
      { field: "delta_ts", op: "changedafter", value: "2026-09-01" },
      { field: "keywords", op: "contains", value: "regression" }
    ],
    rawParams: '{"limit":"100"}',
    notify: { toast: true, sound: true, soundUrl: "" }
  };

  const tickets = [
    {
      id: 4821,
      summary: "Impossible de se connecter au portail client après la mise à jour",
      product: "Customer Portal",
      status: "IN_PROGRESS",
      severity: "bloquante",
      time: hoursAgo(2, 0),
      kind: "new"
    },
    {
      id: 4819,
      summary: "L'endpoint /rest/bug renvoie une erreur 500 sur le champ delta_ts",
      product: "REST API",
      status: "NEW",
      severity: "critique",
      time: hoursAgo(3, 12),
      kind: "new"
    },
    {
      id: 4817,
      summary: "Le bouton Exporter ne fonctionne plus sous Firefox macOS",
      product: "Customer Portal",
      status: "ASSIGNED",
      severity: "majeure",
      time: hoursAgo(5, 30),
      kind: "updated"
    },
    {
      id: 4814,
      summary: "Police incohérente dans les tableaux de bord du design system",
      product: "Design System",
      status: "RESOLVED",
      severity: "mineure",
      time: hoursAgo(26, 0),
      kind: "new"
    },
    {
      id: 4809,
      summary: "Ajouter un mode sombre à la page d'accueil de l'API",
      product: "REST API",
      status: "NEW",
      severity: "évolution",
      time: hoursAgo(49, 0),
      kind: "new"
    },
    {
      id: 4805,
      summary: "Trop de faux positifs lors du filtrage des tickets résolus",
      product: "Search",
      status: "CONFIRMED",
      severity: "normale",
      time: hoursAgo(70, 0),
      kind: "updated"
    },
    {
      id: 4801,
      summary: "Le tri par importance ignore les sous-composants",
      product: "Search",
      status: "NEW",
      severity: "normale",
      time: hoursAgo(95, 0),
      kind: "new"
    },
    {
      id: 4798,
      summary: "Notifications toast manquantes pour les tickets assignés",
      product: "Notifications",
      status: "REOPENED",
      severity: "majeure",
      time: hoursAgo(120, 0),
      kind: "new"
    }
  ];

  const detected = tickets.map((t) => ({
    id: t.id,
    summary: t.summary,
    product: t.product,
    status: t.status,
    severity: t.severity,
    time: t.time,
    kind: t.kind
  }));

  const seenDelta = {};
  tickets.forEach((t) => {
    seenDelta[t.id] = t.time;
  });
  const seen = tickets.map((t) => t.id);

  function detectState() {
    const base = {
      baselineDone: true,
      seen: seen,
      seenDelta: seenDelta,
      lastPollTime: NOW
    };
    switch (state) {
      case "offline":
        return Object.assign({}, base, {
          lastDetection: null,
          lastDetected: [],
          offline: true,
          lastOfflineTime: hoursAgo(1, 31),
          failCount: 0,
          lastError: null,
          lastErrorTime: null
        });
      case "error":
        return Object.assign({}, base, {
          lastDetection: null,
          lastDetected: [],
          offline: false,
          failCount: 4,
          lastError: "Erreur HTTP 500",
          lastErrorTime: hoursAgo(0, 10)
        });
      case "empty":
        return Object.assign({}, base, {
          lastDetection: null,
          lastDetected: [],
          offline: false,
          failCount: 0,
          lastError: null,
          lastErrorTime: null
        });
      default:
        return Object.assign({}, base, {
          lastDetection: detected[0].time,
          lastDetected: detected,
          offline: false,
          failCount: 0,
          lastError: null,
          lastErrorTime: null
        });
    }
  }

  const fakeStorage = {
    settings: settings,
    popupFilter: filter === "new" ? "new" : "all"
  };
  if (theme === "dark" || theme === "light") {
    fakeStorage.systemTheme = theme;
  }

  async function fakeSendMessage(msg) {
    if (msg && msg.action === "getState") {
      return detectState();
    }
    if (msg && msg.action === "test") {
      return {
        ok: true,
        count: detected.length,
        sample: detected.slice(0, 3).map((d) => ({
          id: d.id,
          severity: d.severity,
          summary: d.summary
        }))
      };
    }
    if (msg && (msg.action === "testNotify" || msg.action === "poll")) {
      return { ok: true };
    }
    return {};
  }

  function makeNoopApi() {
    return {
      create: async () => ({}),
      update: async () => ({}),
      query: async () => [],
      sendMessage: async () => ({})
    };
  }

  const fakeLocal = {
    async get(keys) {
      if (keys == null) {
        return Object.assign({}, fakeStorage);
      }
      const list = Array.isArray(keys) ? keys : [keys];
      const out = {};
      for (const k of list) {
        if (fakeStorage[k] !== undefined) {
          out[k] = fakeStorage[k];
        }
      }
      return out;
    },
    async set(obj) {
      Object.assign(fakeStorage, obj);
    },
    async remove(k) {
      delete fakeStorage[k];
    }
  };

  // ---- apply the patch ----------------------------------------------------
  const real = window.browser;

  if (real && real.runtime) {
    // Real extension page: patch in place, keep runtime.getURL / i18n.
    real.storage = real.storage || {};
    real.storage.local = fakeLocal;
    real.runtime.sendMessage = fakeSendMessage;
    real.runtime.openOptionsPage = async () => {};
    ["action", "browserAction"].forEach((k) => {
      real[k] = Object.assign(real[k] || {}, {
        setBadgeText: () => {},
        setBadgeBackgroundColor: () => {}
      });
    });
    real.tabs = makeNoopApi();
    real.windows = { update: async () => ({}) };
    real.alarms = {
      create: () => {},
      clear: async () => true,
      onAlarm: { addListener() {}, removeListener() {} }
    };
    real.notifications = {
      create: async () => {},
      clear: async () => true,
      onClicked: { addListener() {} },
      onClosed: { addListener() {} }
    };
  } else {
    // No native browser (local HTTP server, Chromium, …): full stub.
    window.browser = {
      runtime: {
        getURL: (p) => p,
        sendMessage: fakeSendMessage,
        openOptionsPage: async () => {}
      },
      storage: { local: fakeLocal, onChanged: { addListener() {}, removeListener() {} } },
      i18n: { getUILanguage: () => lang },
      action: { setBadgeText: () => {}, setBadgeBackgroundColor: () => {} },
      browserAction: { setBadgeText: () => {}, setBadgeBackgroundColor: () => {} },
      tabs: makeNoopApi(),
      windows: { update: async () => ({}) },
      alarms: {
        create: () => {},
        clear: async () => true,
        onAlarm: { addListener() {}, removeListener() {} }
      },
      notifications: {
        create: async () => {},
        clear: async () => true,
        onClicked: { addListener() {} },
        onClosed: { addListener() {} }
      }
    };
  }
})();