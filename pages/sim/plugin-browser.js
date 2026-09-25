/*
 * `browser` factice "vivant" : le vrai code du plugin (background.js, popup.js,
 * i18n.js, theme.js) tourne tel quel dans la page, branché sur le Bugzilla
 * simulé (SIM) au lieu du réseau. Aucune donnée réelle n'est contactée.
 *
 * Points d'entrée exposés pour main.js :
 *   window.BUZZ.seedSettings(settings, state)   — initialiser le storage
 *   window.BUZZ.getSettings() / setSettings(patch)
 *   window.BUZZ.resetPluginState()              — état vierge (détection initiale)
 *   window.BUZZ.setAlarmScale(secPerMinUnit)    — accélère les cycles
 *   window.BUZZ.onBadge(cb)                     — écoute le badge
 *   window.BUZZ.log(type, text)                 — flux d'activité
 */
(function () {
  "use strict";

  const P = "simbz:";
  const SIM_BASE = "https://bugzilla.sim";
  const ALARM_STATUS_MIN = 1; // périodes d'alarme < 1 min → traitées en secondes
  const logMax = 200;
  const feed = document.getElementById("feed");
  let alarmScaleSec = 5; // 1 "minute" d'alarme = 5 s réelles
  let badgeCb = null;
  let storageData = {};
  let listeners = {};

  function makeEvent() {
    const ls = [];
    return {
      __list: ls,
      addListener(f) {
        ls.push(f);
      },
      removeListener(f) {
        const i = ls.indexOf(f);
        if (i >= 0) ls.splice(i, 1);
      },
      emit(...args) {
        ls.slice().forEach((f) => {
          try {
            f(...args);
          } catch (e) {}
        });
      }
    };
  }

  function log(type, text) {
    const d = new Date();
    const p = d.toLocaleTimeString("fr-FR", { hour12: false });
    if (feed) {
      const row = document.createElement("div");
      row.className = "log-line log-" + type;
      row.innerHTML = "<span class='log-time'>" + p + "</span> <span class='log-text'>" +
        String(text).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c])) + "</span>";
      feed.insertBefore(row, feed.firstChild);
      while (feed.children.length > logMax) feed.removeChild(feed.lastChild);
    }
  }

  // ---- storage local (via localStorage) ------------------------------------
  function readStore() {
    try {
      const raw = localStorage.getItem(P + "all");
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function writeStore() {
    try {
      localStorage.setItem(P + "all", JSON.stringify(storageData));
    } catch (e) {}
  }

  storageData = readStore();

  async function storageGet(keys) {
    if (keys == null) {
      return Object.assign({}, storageData);
    }
    const list = Array.isArray(keys) ? keys : [keys];
    const out = {};
    for (const k of list) {
      if (storageData[k] !== undefined) out[k] = storageData[k];
    }
    return out;
  }

  async function storageSet(obj) {
    for (const k of Object.keys(obj)) {
      const oldValue = storageData[k];
      storageData[k] = obj[k];
      writeStore();
      if (k === "settings") {
        listeners.changed.emit({ settings: { oldValue: oldValue, newValue: obj[k] } }, "local");
      } else if (listeners.changed) {
        listeners.changed.emit({ [k]: { oldValue: oldValue, newValue: obj[k] } }, "local");
      }
    }
  }

  async function storageRemove(keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    for (const k of list) {
      delete storageData[k];
      writeStore();
    }
  }

  // ---- alarms (devenues de vrais minuteries) -------------------------------
  const alarms = {}; // name -> { info, timer }
  const alarmTimerMs = (info) => {
    const minutes = Number(info.periodInMinutes || info.delayInMinutes || ALARM_STATUS_MIN);
    return Math.max(ALARM_STATUS_MIN, minutes) * alarmScaleSec * 1000;
  };

  function alarmCreate(name, info) {
    alarmClear(name);
    const timer = info.periodInMinutes
      ? setInterval(() => listeners.alarm.emit({ name }), alarmTimerMs(info))
      : setTimeout(() => {
          listeners.alarm.emit({ name });
          delete alarms[name];
        }, alarmTimerMs(info));
    alarms[name] = { info, timer };
    log("sys", "alarme « " + name + " » planifiée (" + (info.periodInMinutes ? "période " : "délai ") + String(info.periodInMinutes || info.delayInMinutes) + " min simulées)");
  }

  async function alarmClear(name) {
    const a = alarms[name];
    if (a) {
      if (a.info.periodInMinutes) clearInterval(a.timer);
      else clearTimeout(a.timer);
      delete alarms[name];
    }
    return true;
  }

  function rearmAll() {
    for (const name of Object.keys(alarms)) {
      const info = alarms[name].info;
      alarmClear(name);
      alarmCreate(name, info);
    }
  }

  // ---- notifications → toasts dans la page ---------------------------------
  function toastCreate(id, opts) {
    const wrap = document.getElementById("toasts");
    if (!wrap) return Promise.resolve(id);
    const el = document.createElement("div");
    el.className = "sim-toast";
    el.setAttribute("data-id", String(id));
    const icon = document.createElement("img");
    icon.className = "sim-toast-icon";
    icon.src = (opts.iconUrl || "../icons/icon.svg");
    const body = document.createElement("div");
    const title = document.createElement("div");
    title.className = "sim-toast-title";
    title.textContent = String(opts.title || "Notification");
    const msg = document.createElement("div");
    msg.className = "sim-toast-msg";
    msg.textContent = String(opts.message || "");
    body.appendChild(title);
    body.appendChild(msg);
    el.appendChild(icon);
    el.appendChild(body);
    el.addEventListener("click", () => {
      listeners.notifClick.emit(id);
      toastClear(id);
    });
    wrap.appendChild(el);
    el._clearTimer = setTimeout(() => toastClear(id), 7000);
    log("notif", "notification « " + String(opts.title || "") + " » affichée");
    return Promise.resolve(id);
  }

  function toastClear(id) {
    const wrap = document.getElementById("toasts");
    if (wrap) {
      const el = wrap.querySelector(".sim-toast[data-id='" + id + "']");
      if (el) {
        clearTimeout(el._clearTimer);
        el.classList.add("sim-toast-out");
        setTimeout(() => el.remove(), 240);
      }
    }
    listeners.notifClose.emit(id);
    return Promise.resolve(true);
  }

  // ---- runtime -------------------------------------------------------------
  function runtimeGetURL(path) {
    return "../" + String(path).replace(/^\/+/, "");
  }

  async function runtimeSendMessage(msg) {
    const callbacks = listeners.message && listeners.message.__list;
    if (!callbacks || !callbacks.length) return { ok: true };
    for (const l of callbacks) {
      let answered = false;
      const result = await new Promise((resolve) => {
        const respond = (val) => {
          answered = true;
          resolve(val);
        };
        let ret;
        try {
          ret = l(msg, {}, respond);
        } catch (e) {
          respond({ ok: false, error: String(e) });
          return;
        }
        if (ret && typeof ret.then === "function") {
          ret.then(respond).catch(() => respond({ ok: false, error: "rejet" }));
        } else if (ret === false) {
          respond(undefined);
        }
      });
      if (answered && result !== undefined) return result;
    }
    return { ok: true };
  }

  // ---- proxy fetch ---------------------------------------------------------
  const realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = (input, init) => {
    const url = String(input);
    if (url.indexOf(SIM_BASE) === 0) {
      return Promise.resolve(SIM.rest(url)).then((r) => ({
        ok: !!r.ok,
        status: r.ok ? 200 : 500,
        json: async () => ({
          bugs: r.bugs || [],
          error: r.bugError || false,
          message: r.message || ""
        })
      }));
    }
    if (realFetch) return realFetch(input, init);
    return Promise.reject(new Error("fetch simulé : hôte inconnu " + url));
  };

  // ---- l'API `browser` -----------------------------------------------------
  const badgeState = { text: "", color: "#d32f2f" };

  window.browser = {
    storage: {
      local: {
        get: storageGet,
        set: storageSet,
        remove: storageRemove
      },
      onChanged: (() => {
        const ev = makeEvent();
        listeners.changed = ev;
        return ev;
      })()
    },
    runtime: {
      getURL: runtimeGetURL,
      sendMessage: runtimeSendMessage,
      openOptionsPage: () => {},
      onMessage: (() => {
        const ev = makeEvent();
        listeners.message = ev;
        return ev;
      })(),
      onInstalled: makeEvent(),
      onStartup: makeEvent()
    },
    i18n: { getUILanguage: () => String(document.documentElement.lang || "fr").slice(0, 2) },
    action: {
      setBadgeText: (o) => {
        badgeState.text = String((o && o.text) || "");
        if (badgeCb) badgeCb(badgeState);
      },
      setBadgeBackgroundColor: (o) => {
        badgeState.color = (o && o.color) || "#d32f2f";
        if (badgeCb) badgeCb(badgeState);
      }
    },
    browserAction: null,
    alarms: {
      create: (name, info) => alarmCreate(name, info),
      clear: alarmClear,
      onAlarm: (() => {
        const ev = makeEvent();
        listeners.alarm = ev;
        return ev;
      })()
    },
    notifications: {
      create: toastCreate,
      clear: toastClear,
      onClicked: (() => {
        const ev = makeEvent();
        listeners.notifClick = ev;
        return ev;
      })(),
      onClosed: (() => {
        const ev = makeEvent();
        listeners.notifClose = ev;
        return ev;
      })()
    },
    tabs: {
      query: async () => [],
      create: async (o) => {
        if (window.SIM && o && o.url) SIM.openURL(o.url);
        return {};
      },
      update: async () => ({}),
      sendMessage: async () => ({})
    },
    windows: { update: async () => ({}) },
    scripting: undefined,
    contentScripts: undefined
  };

  // ---- API publique pour main.js -------------------------------------------
  window.BUZZ = {
    seedSettings(settings, state) {
      storageData = {};
      storageData.settings = settings;
      storageData.state = state;
      writeStore();
      log("sys", "plugin initialisé (settings + état simulés)");
    },
    async getSettings() {
      return Object.assign({}, storageData.settings || {});
    },
    async setSettings(patch) {
      const merged = Object.assign({}, storageData.settings || {}, patch);
      await storageSet({ settings: merged });
    },
    async resetPluginState() {
      await storageSet({
        state: {
          baselineDone: false,
          seen: [],
          seenDelta: {},
          lastPollTime: null,
          lastDetection: null,
          lastDetected: [],
          offline: false
        }
      });
      log("sys", "état du plugin remis à zéro → détection initiale au prochain cycle");
    },
    setAlarmScale(sec) {
      alarmScaleSec = Math.max(1, Number(sec) || 5);
      rearmAll();
      log("sys", "cycle de vérification réglé sur " + alarmScaleSec + " s");
    },
    onBadge(cb) {
      badgeCb = cb;
    },
    async armPoll() {
      await alarmClear("poll");
      alarmCreate("poll", { periodInMinutes: Math.max(1, Number((storageData.settings && storageData.settings.pollInterval) || 1)) });
    },
    pollOnce() {
      return runtimeSendMessage({ action: "poll" });
    },
    log: log
  };

  log("sys", "noyau de simulation chargé (bugzilla.sim = " + SIM_BASE + ")");
})();