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
  maxTickets: 50,
  lang: "auto",
  theme: "auto",
  watchMode: "new",
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

const RETRY_BASE_MIN = 0.5;
const RETRY_CAP_MIN = 15;

function retryDelay(failCount) {
  return Math.min(RETRY_CAP_MIN, RETRY_BASE_MIN * Math.pow(2, failCount - 1));
}

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

const extAction = browser.action || browser.browserAction || null;

const notificationUrls = new Map();

function saveNotificationUrls() {
  const obj = {};
  for (const [key, value] of notificationUrls) {
    obj[key] = value;
  }
  browser.storage.local.set({ notificationUrls: obj }).catch(() => {});
}

function setNotificationUrl(id, url) {
  notificationUrls.set(id, url);
  saveNotificationUrls();
}

function removeNotificationUrl(id) {
  notificationUrls.delete(id);
  saveNotificationUrls();
}

async function getNotificationUrl(id) {
  if (notificationUrls.has(id)) {
    return notificationUrls.get(id);
  }
  const { notificationUrls: stored } = await browser.storage.local
    .get("notificationUrls")
    .catch(() => ({}));
  return stored ? stored[id] || null : null;
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

function mergeSeen(seen, bugs) {
  return [...new Set([...seen, ...bugs.filter((b) => b && b.id).map((b) => b.id)])].slice(-3000);
}

function mergeDelta(seenDelta, bugs) {
  const out = Object.assign({}, seenDelta);
  for (const b of bugs) {
    if (b && b.id) {
      out[b.id] = b.delta_ts || out[b.id];
    }
  }
  const keys = Object.keys(out);
  if (keys.length > 3000) {
    for (let i = 0; i < keys.length - 3000; i++) {
      delete out[keys[i]];
    }
  }
  return out;
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
    "id,summary,product,component,status,severity,priority,creation_time,delta_ts,assigned_to,creator"
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
  if (since) {
    if (settings.watchMode === "all") {
      params.set("last_change_time", since);
    } else {
      params.set("creation_time", since);
    }
  }
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
    throw new Error(I18N.t("err_no_url"));
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
      String(body.message || I18N.t("err_bugzilla")) +
        (useApiKey
          ? I18N.t("err_check_apikey")
          : I18N.t("err_login_hint"))
    );
  }
  if (!res.ok) {
    throw new Error(I18N.t("err_http", [res.status]));
  }
  return (body && body.bugs) || [];
}

function setBadge(text) {
  if (!extAction) {
    return;
  }
  try {
    extAction.setBadgeText({ text });
    extAction.setBadgeBackgroundColor({ color: "#d32f2f" });
  } catch (e) {}
}

async function handlePollError(e, settings) {
  const state = await getState();
  const failCount = (state.failCount || 0) + 1;
  const delay = retryDelay(failCount);
  await setState(
    Object.assign({}, state, {
      failCount: failCount,
      lastError: String((e && e.message) || e || ""),
      lastErrorTime: isoNow()
    })
  );
  try {
    await browser.alarms.clear("poll");
  } catch (err) {}
  browser.alarms.create("retry", { delayInMinutes: delay });
}

async function handlePollSuccess(settings) {
  const state = await getState();
  try {
    await browser.alarms.clear("retry");
  } catch (err) {}
  if (state.failCount || state.lastError) {
    await setState(
      Object.assign({}, state, { failCount: 0, lastError: null, lastErrorTime: null })
    );
  }
  browser.alarms.create("poll", {
    periodInMinutes: Math.max(1, Number(settings.pollInterval) || 1)
  });
}

async function notifyNewBugs(bugs, settings) {
  const icon = browser.runtime.getURL("icons/icon.svg");
  const toast = settings.notify.toast;
  const cleanUrl = String(settings.bugzillaUrl || "").trim().replace(/\/+$/, "");
  if (toast) {
    if (bugs.length <= 3) {
      for (const bug of bugs) {
        const nid = "bz-" + bug.id;
        setNotificationUrl(nid, cleanUrl + "/show_bug.cgi?id=" + bug.id);
        await browser.notifications.create(nid, {
          type: "basic",
          iconUrl: icon,
          title: I18N.t("notif_title_single", [bug.id, bug.status || "", bug.product || ""]),
          message: String(bug.summary || "").slice(0, 120)
        });
      }
    } else {
      const nid = "bz-summary";
      setNotificationUrl(
        nid,
        cleanUrl + "/buglist.cgi?bug_id=" + bugs.map((b) => b.id).join(",")
      );
      await browser.notifications.create(nid, {
        type: "basic",
        iconUrl: icon,
        title: I18N.t("notif_title_multi", [bugs.length]),
        message: I18N.t("notif_msg_multi", [bugs.length])
      });
    }
  }
  if (settings.notify.sound) {
    playSound(settings);
  }
}

async function testNotification() {
  const settings = await getSettings();
  const icon = browser.runtime.getURL("icons/icon.svg");
  if (settings.notify && settings.notify.toast !== false) {
    await browser.notifications.create("bz-test", {
      type: "basic",
      iconUrl: icon,
      title: I18N.t("notif_test_title"),
      message: I18N.t("notif_test_msg")
    });
  }
  if (settings.notify && settings.notify.sound !== false) {
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

let polling = false;

function poll() {
  if (polling) {
    return Promise.resolve();
  }
  polling = true;
  return pollNow().finally(() => {
    polling = false;
  });
}

async function pollNow() {
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
    await handlePollError(e, settings);
    return;
  }
  const nowIso = isoNow();
  const watchAll = settings.watchMode === "all";
  const seen = new Set(state.seen || []);
  const seenDelta = state.seenDelta || {};
  const fresh = bugs.filter((b) => {
    if (!b || !b.id) return false;
    if (!watchAll) return !seen.has(b.id);
    const prev = seenDelta[b.id];
    return !prev || (b.delta_ts && b.delta_ts > prev);
  });

  if (!baselineDone) {
    await setState(
      Object.assign({}, state, {
        baselineDone: true,
        seen: mergeSeen(seen, bugs),
        seenDelta: mergeDelta(seenDelta, bugs),
        lastPollTime: nowIso
      })
    );
    setBadge("");
    await handlePollSuccess(settings);
    return;
  }

  if (fresh.length > 0) {
    const now = new Date().toISOString();
    const detections = fresh.map((b) => ({
      id: b.id,
      summary: String(b.summary || "").slice(0, 80),
      product: b.product || "",
      status: b.status || "",
      severity: b.severity || "",
      time: b.delta_ts || now,
      kind: state.seenDelta && state.seenDelta[b.id] ? "updated" : "new"
    }));
    const maxTickets = Math.min(50, Number(settings.maxTickets) || 50);
    await setState(
      Object.assign({}, state, {
        seen: mergeSeen(seen, bugs),
        seenDelta: mergeDelta(seenDelta, bugs),
        lastPollTime: nowIso,
        lastDetection: now,
        lastDetected: [...detections, ...(state.lastDetected || [])].slice(0, maxTickets)
      })
    );
    await notifyNewBugs(fresh, settings);
    setBadge(String(fresh.length));
  } else {
    await setState(Object.assign({}, state, { lastPollTime: nowIso }));
  }
  await handlePollSuccess(settings);
}

async function testSearch() {
  const settings = await getSettings();
  const cleanUrl = String(settings.bugzillaUrl || "").trim();
  if (!cleanUrl) {
    return { ok: false, error: I18N.t("err_no_url") };
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
        severity: String(b.severity || ""),
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
  try {
    await browser.alarms.clear("retry");
  } catch (e) {}
  if (settings.enabled) {
    schedulePolling(settings.pollInterval);
    poll();
  } else {
    browser.alarms.clear("poll");
    setBadge("");
  }
}

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "poll" || alarm.name === "retry") poll();
});

browser.notifications.onClicked.addListener(async (id) => {
  const url = await getNotificationUrl(id);
  removeNotificationUrl(id);
  browser.notifications.clear(id).catch(() => {});
  if (url) openBugUrl(url);
});

browser.notifications.onClosed.addListener((id) => {
  removeNotificationUrl(id);
});

browser.storage.onChanged.addListener(async (changes, area) => {
  if (area === "local" && changes.settings) {
    const newSettings = changes.settings.newValue || {};
    const full = mergeDeep(DEFAULT_SETTINGS, newSettings);
    await I18N.setLang(full.lang || "auto");
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
  if (msg && msg.action === "testNotify") {
    testNotification()
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  return false;
});

const openingUrls = new Set();

function openBugUrl(url) {
  if (openingUrls.has(url)) {
    return Promise.resolve();
  }
  openingUrls.add(url);
  const m = url.match(/^https?:\/\/[^/]+/);
  const prefix = m ? m[0] : url;
  const done = () => openingUrls.delete(url);
  return browser.tabs
    .query({ url: prefix + "/*" })
    .then((tabs) => {
      if (tabs && tabs.length > 0) {
        return browser.tabs
          .update(tabs[0].id, { active: true, url })
          .then(() => browser.windows.update(tabs[0].windowId, { focused: true }));
      }
      return browser.tabs.create({ url });
    })
    .then(done, done);
}

const systemThemeMq =
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

function publishSystemTheme() {
  if (!systemThemeMq) {
    return;
  }
  browser.storage.local.set({
    systemTheme: systemThemeMq.matches ? "dark" : "light"
  });
}

if (systemThemeMq && systemThemeMq.addEventListener) {
  systemThemeMq.addEventListener("change", publishSystemTheme);
}

async function init() {
  await I18N.init();
  publishSystemTheme();
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