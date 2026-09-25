/*
 * Smoke test autonome de la simulation (pages/), sans navigateur.
 * Vérifie : REST simulé (filtres/since/ordre), storage/events/alarmes
 * du `browser` factice (plugin-browser.js), et le flux sendMessage.
 *
 * Lancement : node test/sim-smoke.js
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
let failures = 0;
let passed = 0;

function ok(name, cond) {
  if (cond) {
    passed++;
    console.log("  ok  " + name);
  } else {
    failures++;
    console.error("  FAIL " + name);
  }
}

function eq(name, actual, expected) {
  const okc = JSON.stringify(actual) === JSON.stringify(expected);
  if (!okc) {
    console.error("       attendu: " + JSON.stringify(expected));
    console.error("       obtenu : " + JSON.stringify(actual));
  }
  return ok(name, okc);
}

function makeLocalStorage() {
  const mem = {};
  return {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => (mem[k] = String(v)),
    removeItem: (k) => delete mem[k]
  };
}

function makeSimCtx() {
  const feed = {
    children: [],
    insertBefore: (c) => feed.children.unshift(c),
    removeChild: (c) => {
      const i = feed.children.indexOf(c);
      if (i >= 0) feed.children.splice(i, 1);
    }
  };
  const ctx = vm.createContext({
    console,
    Date,
    Object,
    Array,
    JSON,
    Math,
    RegExp,
    String,
    Number,
    URLSearchParams,
    URL,
    Promise,
    setTimeout: (cb) => {
      cb();
      return 0;
    },
    clearTimeout: () => {},
    setInterval: (cb, ms) => ({ cb, ms }),
    clearInterval: () => {},
    localStorage: makeLocalStorage(),
    navigator: { onLine: true },
    document: {
      readyState: "loading",
      documentElement: { lang: "fr", dataset: {} },
      addEventListener: () => {},
      getElementById: (id) => (id === "feed" ? feed : null),
      createElement: () => ({ className: "", innerHTML: "", textContent: "", setAttribute: () => {} }),
      querySelectorAll: () => []
    },
    window: null
  });
  ctx.window = ctx;
  return { ctx, feed };
}

function load(ctx, file) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), ctx, { filename: file });
}

async function main() {
  console.log("== simulation pages/ ==");

  // ---- 1) Bugzilla simulé (REST) ------------------------------------------
  console.log("-- sim-bugzilla.js --");
  const sim = makeSimCtx();
  load(sim.ctx, "pages/sim/sim-bugzilla.js");
  const SIM = sim.ctx.SIM;

  SIM.reset();
  eq("seed → 8 tickets", SIM.list().length, 8);
  ok("seed → IDs factices", SIM.list().every((t) => t.id >= 4798 && t.id <= 4821));

  const since = new Date(Date.now() - 3 * 60 * 60e3).toISOString();
  const r1 = await SIM.rest("https://bugzilla.sim/rest/bug?last_change_time=" + encodeURIComponent(since) + "&limit=500&order=priority+DESC");
  ok("rest since 3h → au moins un ticket", r1.ok && r1.bugs.some((b) => b.delta_ts > since));
  ok("rest ordre tri présent", r1.ok && r1.bugs.length > 0);

  const created = SIM.create({ summary: "Ticket de démo créé par le test", product: "Search", severity: "critique" });
  const sinceCreated = new Date(Date.parse(created.creation_time) - 1000).toISOString();
  const r2 = await SIM.rest("https://bugzilla.sim/rest/bug?last_change_time=" + encodeURIComponent(sinceCreated) + "&limit=500");
  ok("nouveau ticket détectable via since", r2.bugs.some((b) => b.id === created.id));

  const r3 = await SIM.rest("https://bugzilla.sim/rest/bug?severity=critique&limit=500");
  ok("filtre sévérité", r3.bugs.every((b) => b.severity === "critique"));

  SIM.setErrMode(true);
  const r4 = await SIM.rest("https://bugzilla.sim/rest/bug");
  ok("mode panne → erreur", r4.ok === false && r4.bugError === true);
  SIM.setErrMode(false);

  // ---- 2) browser factice vivant (plugin-browser.js) ----------------------
  console.log("-- plugin-browser.js --");
  const pb = makeSimCtx();
  load(pb.ctx, "pages/sim/sim-bugzilla.js");
  const pbSIM = pb.ctx.SIM;
  pb.ctx.SIM = pbSIM;
  load(pb.ctx, "pages/sim/plugin-browser.js");
  const BUZZ = pb.ctx.BUZZ;
  const browserLive = pb.ctx.browser;

  const settings = {
    enabled: true,
    bugzillaUrl: "https://bugzilla.sim",
    pollInterval: 1,
    auth: { mode: "apiKey", apiKey: "demo-key" },
    watchMode: "all",
    criteria: {},
    notify: { toast: false, sound: false }
  };
  const state = { baselineDone: true, seen: [], seenDelta: {}, lastDetected: [] };
  BUZZ.seedSettings(settings, state);

  const got = await browserLive.storage.local.get(["settings", "state"]);
  eq("storage get array", got.state.lastDetected, []);
  eq("storage settings.url", got.settings.bugzillaUrl, "https://bugzilla.sim");

  let changedEvent = null;
  browserLive.storage.onChanged.addListener((changes, area) => {
    changedEvent = { changes, area };
  });
  await BUZZ.setSettings({ watchMode: "new" });
  ok("set settings → event onChanged", changedEvent && changedEvent.area === "local" && changedEvent.changes.settings.newValue.watchMode === "new");

  // alarmes accélérées : 1 "minute" d'alarme = 5 s à l'échelle par défaut
  const intervals = [];
  const realSetInterval = pb.ctx.setInterval;
  pb.ctx.setInterval = (cb, ms) => {
    const h = { cb, ms, id: intervals.length };
    intervals.push(h);
    return h.id;
  };
  pb.ctx.clearInterval = (id) => {
    const i = intervals.findIndex((h) => h.id === id);
    if (i >= 0) intervals.splice(i, 1);
  };
  await BUZZ.armPoll();
  eq("alarme poll → intervalle de 5 s", intervals.length && intervals[intervals.length - 1].ms, 5000);
  BUZZ.setAlarmScale(10);
  ok("échelle 10 s → nouvel intervalle de 10 s", intervals.some((h) => h.ms === 10000));
  ok("ancien intervalle re-armé (supprimé)", intervals.length === 1);

  // sendMessage → répond via onMessage (comme background.js)
  let msgHandler = null;
  browserLive.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    msgHandler = msg;
    if (msg && msg.action === "getState") {
      sendResponse({ baselineDone: true, lastDetected: [{ id: 77, summary: "x" }] });
      return true;
    }
    return false;
  });
  const res = await browserLive.runtime.sendMessage({ action: "getState" });
  eq("sendMessage → getState", res.lastDetected[0].id, 77);
  eq("handler reçoit l'action", msgHandler.action, "getState");

  // proxy fetch : bugzilla.sim → SIM.rest, autres URL → réseau réel (rejeté ici)
  const fetched = await pb.ctx.fetch("https://bugzilla.sim/rest/bug?limit=500");
  ok("proxy fetch → REST simulé", fetched.ok === true);
  const body = await fetched.json();
  ok("body.bugs présent", Array.isArray(body.bugs));

  // ---- 3) feed cumulé ------------------------------------------------------
  ok("BUZZ.log ajoute des lignes", pb.feed.children.length > 0);

  // ---- synthèse ------------------------------------------------------------
  console.log("\nRésultat : " + passed + " OK, " + failures + " échec(s)");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});