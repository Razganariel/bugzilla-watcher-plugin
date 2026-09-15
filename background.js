const DEFAULT_SETTINGS = {
  enabled: true,
  bugzillaUrl: "",
  pollInterval: 1,
  baselineFirstRun: true,
  auth: {
    mode: "session",
    apiKey: ""
  },
  orderBy: "bug_id",
  orderDirection: "DESC",
  criteria: {
    product: "",
    component: "",
    status: "NEW,ASSIGNED,REOPENED",
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
  notify: {
    toast: true,
    sound: true,
    soundUrl: ""
  }
};

function mergeDeep(base, override) {
  const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
  for (const key of Object.keys(override || {})) {
    const bv = base[key];
    const ov = override[key];
    if (
      bv &&
      ov &&
      typeof bv === "object" &&
      typeof ov === "object" &&
      !Array.isArray(bv)
    ) {
      out[key] = mergeDeep(bv, ov);
    } else {
      out[key] = ov;
    }
  }
  return out;
}

async function getSettings() {
  const { settings } = await browser.storage.local.get("settings");
  return mergeDeep(DEFAULT_SETTINGS, settings || {});
}

async function getState() {
  const data = await browser.storage.local.get("state");
  return (
    data.state || {
      baselineDone: false,
      seen: [],
      lastPollTime: null,
      lastDetection: null,
      lastDetected: []
    }
  );
}

async function setState(state) {
  await browser.storage.local.set({ state });
}

function splitList(str) {
  return String(str || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isoNow() {
  return new Date().toISOString().replace(/\.[0-9]{3}/, "");
}

function makeOriginPattern(raw) {
  try {
    const u = new URL(String(raw || "").trim());
    return u.protocol.slice(0, -1) + "://" + u.hostname;
  } catch (e) {
    return "";
  }
}

async function buildQuery(settings, since) {
  const params = new URLSearchParams();
  params.set(
    "include_fields",
    "id,summary,product,component,status,severity,priority,creation_time,assigned_to,creator"
  );
  for (const key of Object.keys(settings.criteria)) {
    const value = settings.criteria[key];
    if (!value) continue;
    const values = splitList(value);
    for (const v of values) params.append(key, v);
  }
  settings.advancedCriteria.forEach((row, idx) => {
    if (!row || !row.field) return;
    const n = idx + 1;
    params.set("f" + n, row.field);
    params.set("o" + n, row.op || "anyexact");
    if (row.value) params.set("v" + n, row.value);
  });
  const auth = settings.auth || DEFAULT_SETTINGS.auth;
  if (auth.mode === "apiKey" && auth.apiKey) {
    params.set("api_key", auth.apiKey);
  }
  try {
    const raw = JSON.parse(settings.rawParams || "{}");
    for (const key of Object.keys(raw)) {
      const values = Array.isArray(raw[key]) ? raw[key] : [raw[key]];
      for (const v of values) params.append(key, String(v));
    }
  } catch (e) {}
  if (since) params.set("creation_time", since);
  params.set("limit", "500");
  params.set("order", buildOrder(settings));
  return params;
}

const ORDER_MAP = {
  bug_id: "bug_id",
  importance: "priority, bug_severity",
  changeddate: "delta_ts",
  creation_time: "creation_ts"
};

function buildOrder(settings) {
  const direction = settings.orderDirection === "ASC" ? "ASC" : "DESC";
  const base = ORDER_MAP[settings.orderBy] || "bug_id";
  return base
    .split(",")
    .map((field) => field.trim() + " " + direction)
    .join(", ");
}

async function searchBugs(settings, since) {
  const base = String(settings.bugzillaUrl || "").trim().replace(/\/+$/, "");
  if (!base) {
    throw new Error("URL Bugzilla non configurée");
  }
  const origin = makeOriginPattern(base);
  const auth = settings.auth || DEFAULT_SETTINGS.auth;
  const useApiKey = auth.mode === "apiKey" && auth.apiKey;
  const params = await buildQuery(settings, since);
  const query = "/rest/bug?" + params.toString();

  if (!useApiKey && origin) {
    try {
      const tabs = await browser.tabs.query({ url: origin + "/*" });
      for (const tab of tabs.slice(0, 5)) {
        try {
          const res = await browser.tabs.sendMessage(tab.id, {
            action: "search",
            query: query
          });
          if (res && res.ok) {
            return res.bugs || [];
          }
        } catch (e) {}
      }
    } catch (e) {}
  }

  const res = await fetch(base + query, { credentials: "include" });
  const body = await res.json().catch(() => null);
  if (body && body.error) {
    throw new Error(
      String(body.message || "Erreur Bugzilla") +
        (useApiKey
          ? " Vérifiez votre clé API."
          : " Connectez-vous à Bugzilla dans un onglet de ce profil, ou configurez une clé API.")
    );
  }
  if (!res.ok) {
    throw new Error("HTTP " + res.status);
  }
  return (body && body.bugs) || [];
}

function setBadge(text) {
  try {
    browser.browserAction.setBadgeText({ text });
    browser.browserAction.setBadgeBackgroundColor({ color: "#d32f2f" });
  } catch (e) {}
}

async function notifyNewBugs(bugs, settings) {
  const icon = browser.runtime.getURL("icons/icon.svg");
  const toast = settings.notify.toast;
  if (toast) {
    if (bugs.length <= 3) {
      for (const bug of bugs) {
        await browser.notifications.create("bz-" + bug.id, {
          type: "basic",
          iconUrl: icon,
          title: "Bug " + bug.id + " [" + (bug.status || "") + "] " + (bug.product || ""),
          message: String(bug.summary || "").slice(0, 120)
        });
      }
    } else {
      await browser.notifications.create("bz-summary", {
        type: "basic",
        iconUrl: icon,
        title: bugs.length + " nouveaux tickets Bugzilla",
        message: "Détection de " + bugs.length + " tickets correspondant aux critères."
      });
    }
  }
  if (settings.notify.sound) {
    playSound(settings);
  }
}

function playSound(settings) {
  if (settings.notify.soundUrl) {
    try {
      const audio = new Audio(settings.notify.soundUrl);
      audio.play().catch(() => {});
      return;
    } catch (e) {}
  }
  try {
    const Ctx =
      window.AudioContext || window.webkitAudioContext || window.mozAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const notes = [880, 1108.73, 1318.51];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.16;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.55);
    });
    window.setTimeout(() => {
      try {
        ctx.close();
      } catch (e) {}
    }, 2000);
  } catch (e) {}
}

let registeredContentScript = null;

async function registerContentScript(settings) {
  if (registeredContentScript) {
    try {
      await registeredContentScript.unregister();
    } catch (e) {}
    registeredContentScript = null;
  }
  const origin = makeOriginPattern(settings.bugzillaUrl);
  if (!origin || !browser.contentScripts || !browser.contentScripts.register) {
    return;
  }
  try {
    registeredContentScript = await browser.contentScripts.register({
      matches: [origin + "/*"],
      js: [{ file: "contentScript.js" }],
      runAt: "document_idle",
      allFrames: false
    });
  } catch (e) {
    registeredContentScript = null;
  }
}

async function poll() {
  let settings;
  try {
    settings = await getSettings();
  } catch (e) {
    return;
  }
  if (!settings.enabled) {
    setBadge("");
    return;
  }
  const cleanUrl = String(settings.bugzillaUrl || "").trim();
  if (!cleanUrl) {
    setBadge("");
    return;
  }
  const state = await getState();
  const baselineDone = state.baselineDone;
  const since = baselineDone ? state.lastPollTime : null;
  let bugs;
  try {
    bugs = await searchBugs(
      Object.assign({}, settings, { bugzillaUrl: cleanUrl }),
      since
    );
  } catch (e) {
    setBadge("!");
    return;
  }
  const nowIso = isoNow();
  const seen = new Set(state.seen || []);
  const fresh = bugs.filter((b) => b && !seen.has(b.id));

  if (!baselineDone) {
    await setState(
      Object.assign({}, state, {
        baselineDone: true,
        seen: [...new Set([...seen, ...bugs.map((b) => b.id)])].slice(-3000),
        lastPollTime: nowIso
      })
    );
    setBadge("");
    return;
  }

  if (fresh.length > 0) {
    const now = new Date().toISOString();
    const detections = fresh.map((b) => ({
      id: b.id,
      summary: String(b.summary || "").slice(0, 80),
      product: b.product || "",
      status: b.status || "",
      time: now
    }));
    await setState(
      Object.assign({}, state, {
        seen: [...new Set([...seen, ...fresh.map((b) => b.id)])].slice(-3000),
        lastPollTime: nowIso,
        lastDetection: now,
        lastDetected: [...detections, ...(state.lastDetected || [])].slice(0, 50)
      })
    );
    await notifyNewBugs(fresh, settings);
    setBadge(String(fresh.length));
  } else {
    await setState(Object.assign({}, state, { lastPollTime: nowIso }));
  }
}

async function testSearch() {
  const settings = await getSettings();
  const cleanUrl = String(settings.bugzillaUrl || "").trim();
  if (!cleanUrl) {
    return { ok: false, error: "URL Bugzilla non configurée" };
  }
  try {
    const bugs = await searchBugs(
      Object.assign({}, settings, { bugzillaUrl: cleanUrl }),
      null
    );
    return {
      ok: true,
      count: bugs.length,
      sample: bugs.slice(0, 6).map((b) => ({
        id: b.id,
        summary: String(b.summary || "").slice(0, 80)
      }))
    };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

function schedulePolling(intervalMin) {
  const minutes = Math.max(1, Number(intervalMin) || 1);
  browser.alarms.create("poll", { periodInMinutes: minutes });
}

async function start(settings) {
  await registerContentScript(settings);
  if (settings.enabled) {
    schedulePolling(settings.pollInterval);
    poll();
  } else {
    browser.alarms.clear("poll");
    setBadge("");
  }
}

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "poll") poll();
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.settings) {
    const newSettings = changes.settings.newValue || {};
    const full = mergeDeep(DEFAULT_SETTINGS, newSettings);
    start(full);
  }
});

browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === "getState") {
    getState().then((state) => sendResponse(state));
    return true;
  }
  if (msg && msg.action === "poll") {
    poll()
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg && msg.action === "test") {
    testSearch().then((r) => sendResponse(r));
    return true;
  }
  return false;
});

async function init() {
  const { settings } = await browser.storage.local
    .get("settings")
    .catch(() => ({}));
  const merged = mergeDeep(DEFAULT_SETTINGS, settings || {});
  await browser.storage.local.set({ settings: merged });
  start(merged);
}

browser.runtime.onInstalled.addListener(init);
browser.runtime.onStartup.addListener(init);
init();