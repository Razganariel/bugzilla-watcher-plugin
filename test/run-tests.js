"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const LOCALES = ["fr", "en", "de", "es", "it", "nl"];

let passed = 0;
let failed = 0;
let finished = false;
let buildQueryTests;

function ok(name, cond) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.log("  FAIL " + name);
  }
}

function eq(name, actual, expected) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) {
    passed++;
  } else {
    failed++;
    console.log("  FAIL " + name);
    console.log("       attendu: " + b);
    console.log("       obtenu : " + a);
  }
}

function section(title) {
  console.log("\n== " + title + " ==");
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

// ---------------------------------------------------------------------------
// Stubs (no browser / DOM available under Node)
// ---------------------------------------------------------------------------

function makeElement() {
  return {
    textContent: "",
    innerHTML: "",
    value: "",
    checked: false,
    disabled: false,
    title: "",
    className: "",
    scrollTop: 0,
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
    insertBefore() {},
    removeChild() {},
    remove() {},
    setAttribute() {},
    getAttribute() {
      return null;
    },
    querySelector() {
      return makeElement();
    },
    querySelectorAll() {
      return [];
    },
    click() {}
  };
}

function makeDom() {
  return {
    documentElement: makeElement(),
    body: makeElement(),
    getElementById() {
      return makeElement();
    },
    createElement() {
      return makeElement();
    },
    querySelector() {
      return makeElement();
    },
    querySelectorAll() {
      return [];
    },
    addEventListener() {}
  };
}

function makeEvent() {
  return {
    addListener() {},
    removeListener() {},
    hasListener() {
      return false;
    }
  };
}

function makeBrowser(initial) {
  const data = Object.assign({}, initial || {});
  const alarmsCreated = [];
  const alarmsCleared = [];
  return {
    _data: data,
    _alarmsCreated: alarmsCreated,
    _alarmsCleared: alarmsCleared,
    action: { setBadgeText() {}, setBadgeBackgroundColor() {} },
    browserAction: { setBadgeText() {}, setBadgeBackgroundColor() {} },
    alarms: {
      create(name, info) {
        alarmsCreated.push({ name, info });
      },
      clear(name) {
        alarmsCleared.push(name);
        return Promise.resolve(true);
      },
      onAlarm: makeEvent()
    },
    notifications: {
      create() {
        return Promise.resolve();
      },
      clear() {
        return Promise.resolve(true);
      },
      onClicked: makeEvent(),
      onClosed: makeEvent()
    },
    storage: {
      local: {
        async get(keys) {
          if (keys == null) {
            return Object.assign({}, data);
          }
          const list = Array.isArray(keys) ? keys : [keys];
          const out = {};
          for (const k of list) {
            if (k in data) {
              out[k] = data[k];
            }
          }
          return out;
        },
        async set(obj) {
          Object.assign(data, obj);
        },
        async remove(k) {
          delete data[k];
        }
      },
      onChanged: makeEvent()
    },
    runtime: {
      getURL(p) {
        return p;
      },
      onMessage: makeEvent(),
      onInstalled: makeEvent(),
      onStartup: makeEvent(),
      async sendMessage() {
        return {};
      }
    },
    tabs: {
      async query() {
        return [];
      },
      async sendMessage() {
        return {};
      },
      async create() {},
      async update() {}
    },
    windows: { async update() {} },
    i18n: {
      getUILanguage() {
        return "en-US";
      }
    }
  };
}

function makeFetch(transform) {
  return async function (url) {
    const json = JSON.parse(fs.readFileSync(path.join(ROOT, String(url)), "utf8"));
    return { ok: true, async json() { return transform ? transform(String(url), json) : json; } };
  };
}

function makeContext(browser, opts) {
  opts = opts || {};
  const context = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    navigator: opts.navigator || { language: "en-US" },
    document: makeDom(),
    browser,
    fetch: opts.fetch || makeFetch(),
    matchMedia() {
      return { matches: false, addEventListener() {}, removeEventListener() {} };
    }
  };
  context.globalThis = context;
  context.self = context;
  context.window = context;
  context.Theme = { init: async () => {}, set() {}, apply() {}, resolve: () => "light" };
  vm.createContext(context);
  return context;
}

function loadInto(context, files, names) {
  for (const file of files) {
    let src = fs.readFileSync(path.join(ROOT, file), "utf8");
    src += "\n;globalThis.__test = Object.assign(globalThis.__test || {}, {\n";
    src += names
      .map((n) => "  " + n + ': (typeof ' + n + ' !== "undefined") ? ' + n + " : undefined")
      .join(",\n");
    src += "\n});\n";
    vm.runInContext(src, context, { filename: file });
  }
  return context.__test;
}

// ---------------------------------------------------------------------------

process.on("unhandledRejection", () => {});

const dicts = {};
for (const l of LOCALES) {
  dicts[l] = readJson(path.join("_locales", l, "messages.json"));
}

// ---- mergeDeep ------------------------------------------------------------
section("mergeDeep");
{
  const bg = loadInto(makeContext(makeBrowser()), ["i18n.js", "background.js"], ["mergeDeep"]);
  const md = bg.mergeDeep(
    { a: 1, n: { x: 1, y: 2 }, arr: [1, 2] },
    { n: { y: 9 }, arr: [3] }
  );
  eq("fusion imbriquée", md.n, { x: 1, y: 9 });
  eq("tableaux remplacés (pas fusionnés)", md.arr, [3]);
  eq("clés de base conservées", md.a, 1);
}

// ---- mergeSeen / mergeDelta ----------------------------------------------
section("mergeSeen / mergeDelta");
{
  const bg = loadInto(makeContext(makeBrowser()), ["i18n.js", "background.js"], [
    "mergeSeen",
    "mergeDelta"
  ]);
  eq("mergeSeen déduplique", bg.mergeSeen([1, 2], [{ id: 2 }, { id: 3 }]), [1, 2, 3]);
  eq("mergeSeen ignore les invalides", bg.mergeSeen([1], [{}, { id: null }, { id: 4 }]), [1, 4]);

  const many = [];
  for (let i = 0; i < 3500; i++) {
    many.push({ id: i });
  }
  const capped = bg.mergeSeen([], many);
  ok(
    "mergeSeen plafonne à 3000 (garde les plus récents)",
    capped.length === 3000 && capped[capped.length - 1] === 3499
  );

  eq("mergeDelta enregistre delta_ts", bg.mergeDelta({}, [{ id: 1, delta_ts: "T1" }]), {
    1: "T1"
  });
  eq("mergeDelta conserve si absent", bg.mergeDelta({ 1: "T1" }, [{ id: 1 }]), { 1: "T1" });
  eq("mergeDelta écrase", bg.mergeDelta({ 1: "T1" }, [{ id: 1, delta_ts: "T2" }]), {
    1: "T2"
  });
}

// ---- retryDelay -----------------------------------------------------------
section("retryDelay (backoff exponentiel)");
{
  const bg = loadInto(makeContext(makeBrowser()), ["i18n.js", "background.js"], ["retryDelay"]);
  eq(
    "séquence 30s→1→2→4→8→15 min (plafonnée)",
    [1, 2, 3, 4, 5, 6, 7].map(bg.retryDelay),
    [0.5, 1, 2, 4, 8, 15, 15]
  );
}

// ---- buildOrder / makeOriginPattern --------------------------------------
section("buildOrder / makeOriginPattern");
{
  const bg = loadInto(makeContext(makeBrowser()), ["i18n.js", "background.js"], [
    "buildOrder",
    "makeOriginPattern"
  ]);
  eq(
    "importance ASC → priority, bug_severity",
    bg.buildOrder({ orderBy: "importance", orderDirection: "ASC" }),
    "priority ASC, bug_severity ASC"
  );
  eq("défaut → bug_id DESC", bg.buildOrder({}), "bug_id DESC");
  eq(
    "origine valide",
    bg.makeOriginPattern("https://bug.example.com/rest"),
    "https://bug.example.com"
  );
  eq("origine invalide → vide", bg.makeOriginPattern("pas une url"), "");
}

// ---- buildQuery -----------------------------------------------------------
section("buildQuery");
{
  const bg = loadInto(makeContext(makeBrowser()), ["i18n.js", "background.js"], [
    "buildQuery",
    "mergeDeep",
    "DEFAULT_SETTINGS"
  ]);

  buildQueryTests = (async () => {
    const all = bg.mergeDeep(bg.DEFAULT_SETTINGS, {      bugzillaUrl: "https://bz.example.com",
      criteria: { status: "NEW,ASSIGNED", product: "Foo" },
      auth: { mode: "apiKey", apiKey: "K" },
      rawParams: '{"include_fields":"id","x":["1","2"]}',
      watchMode: "all"
    });
    const p = await bg.buildQuery(all, "2020-01-01T00:00:00");
    eq("watchMode all → last_change_time", p.get("last_change_time"), "2020-01-01T00:00:00");
    eq("watchMode all → pas de creation_time", p.get("creation_time"), null);
    eq("critère multi-valeurs (status)", p.getAll("status"), ["NEW", "ASSIGNED"]);
    eq("critère simple (product)", p.get("product"), "Foo");
    eq("clé API", p.get("api_key"), "K");
    eq("limit = 500", p.get("limit"), "500");
    eq("rawParams tableau", p.getAll("x"), ["1", "2"]);
    ok("rawParams ajoute include_fields", p.getAll("include_fields").includes("id"));

    const fresh = bg.mergeDeep(bg.DEFAULT_SETTINGS, { watchMode: "new" });
    const p2 = await bg.buildQuery(fresh, "2020-01-01T00:00:00");
    eq("watchMode new → creation_time", p2.get("creation_time"), "2020-01-01T00:00:00");
    eq("watchMode new → pas de last_change_time", p2.get("last_change_time"), null);

    const adv = bg.mergeDeep(bg.DEFAULT_SETTINGS, {
      advancedCriteria: [{ field: "status", op: "equals", value: "NEW" }]
    });
    const p3 = await bg.buildQuery(adv, null);
    eq("advanced f1", p3.get("f1"), "status");
    eq("advanced o1", p3.get("o1"), "equals");
    eq("advanced v1", p3.get("v1"), "NEW");
    eq("pas de paramètre temps si since null", p3.get("creation_time"), null);
    ok("include_fields présent", !!p3.get("include_fields"));
  })();
}

// ---- handlePollError / handlePollSuccess ---------------------------------
section("handlePollError / handlePollSuccess");
async function testPollHandlers() {
  const b = makeBrowser({ settings: { enabled: true }, state: { failCount: 0 } });
  const bg = loadInto(makeContext(b), ["i18n.js", "background.js"], [
    "handlePollError",
    "handlePollSuccess",
    "DEFAULT_SETTINGS"
  ]);
  await bg.handlePollError(new Error("boom"), bg.DEFAULT_SETTINGS);
  ok(
    "erreur → alarme retry 0.5 min",
    b._alarmsCreated.some((a) => a.name === "retry" && a.info.delayInMinutes === 0.5)
  );
  ok("erreur → annule l'alarme poll", b._alarmsCleared.includes("poll"));

  const b2 = makeBrowser({ settings: { enabled: true }, state: { failCount: 3 } });
  const bg2 = loadInto(makeContext(b2), ["i18n.js", "background.js"], [
    "handlePollSuccess",
    "mergeDeep",
    "DEFAULT_SETTINGS"
  ]);
  const settings = bg2.mergeDeep(bg2.DEFAULT_SETTINGS, { pollInterval: 5 });
  await bg2.handlePollSuccess(settings);
  ok("succès → annule retry", b2._alarmsCleared.includes("retry"));
  ok(
    "succès → recrée poll (periodInMinutes=5)",
    b2._alarmsCreated.some((a) => a.name === "poll" && a.info.periodInMinutes === 5)
  );
}

// ---- mode hors ligne ------------------------------------------------------
async function testOffline() {
  section("mode hors ligne");
  const on = loadInto(makeContext(makeBrowser(), { navigator: { onLine: true } }), ["i18n.js", "background.js"], ["isOnline"]);
  ok("navigator.onLine=true → en ligne", on.isOnline() === true);
  const off = loadInto(makeContext(makeBrowser(), { navigator: { onLine: false } }), ["i18n.js", "background.js"], ["isOnline"]);
  ok("navigator.onLine=false → hors ligne", off.isOnline() === false);

  const b = makeBrowser({
    settings: { enabled: true, pollInterval: 7 },
    state: { failCount: 2, lastError: "HTTP 500", offline: false }
  });
  const bg = loadInto(makeContext(b), ["i18n.js", "background.js"], [
    "handleOffline",
    "getState",
    "mergeDeep",
    "DEFAULT_SETTINGS"
  ]);
  await bg.handleOffline(await bg.getState(), bg.mergeDeep(bg.DEFAULT_SETTINGS, { pollInterval: 7 }));
  const after = b._data.state;
  ok("offline → état marqué hors ligne", after.offline === true);
  ok("offline → failCount remis à zéro", after.failCount === 0);
  ok("offline → lastError effacé", after.lastError === null);
  ok("offline → alarme retry annulée", b._alarmsCleared.indexOf("retry") >= 0);
  ok(
    "offline → poll replanifié (periodInMinutes=7)",
    b._alarmsCreated.some((a) => a.name === "poll" && a.info.periodInMinutes === 7)
  );

  let fetched = false;
  const localeFetch = makeFetch();
  const b2 = makeBrowser({
    settings: { enabled: true, bugzillaUrl: "https://bz.example.com", pollInterval: 1 },
    state: {}
  });
  const bg2 = loadInto(
    makeContext(b2, {
      navigator: { onLine: false },
      fetch: async (url) => {
        if (String(url).indexOf("_locales/") >= 0) return localeFetch(url);
        fetched = true;
        return { ok: true, json: async () => ({ bugs: [] }) };
      }
    }),
    ["i18n.js", "background.js"],
    ["pollNow", "getState"]
  );
  await bg2.pollNow();
  ok("hors ligne → aucune requête réseau", fetched === false);
  ok("hors ligne → état offline persisté", (await bg2.getState()).offline === true);

  const b3 = makeBrowser({
    settings: {
      enabled: true,
      bugzillaUrl: "https://bz.example.com",
      pollInterval: 1,
      watchMode: "new",
      notify: { toast: false, sound: false }
    },
    state: {
      baselineDone: true,
      seen: [],
      seenDelta: {},
      lastPollTime: "2020-01-01T00:00:00",
      offline: true,
      failCount: 0
    }
  });
  const bg3 = loadInto(
    makeContext(b3, {
      navigator: { onLine: true },
      fetch: async (url) => {
        if (String(url).indexOf("_locales/") >= 0) return localeFetch(url);
        return { ok: true, json: async () => ({ bugs: [{ id: 1, summary: "x", delta_ts: "T" }] }) };
      }
    }),
    ["i18n.js", "background.js"],
    ["pollNow", "getState"]
  );
  await bg3.pollNow();
  ok("retour en ligne → offline effacé", (await bg3.getState()).offline === false);
}

// ---- severityBucket / SEV_RANK -------------------------------------------
section("severityBucket / SEV_RANK");
{
  const popup = loadInto(makeContext(makeBrowser()), ["i18n.js", "popup/popup.js"], [
    "SEV_RANK",
    "severityBucket"
  ]);
  eq(
    "SEV_RANK (ordre de gravité)",
    popup.SEV_RANK,
    ["bloquant", "critique", "majeur", "normal", "mineur", "evolution", "autre"]
  );
  const cases = [
    ["bloquant", "bloquant"],
    ["blocker", "bloquant"],
    ["critique", "critique"],
    ["critical", "critique"],
    ["majeur", "majeur"],
    ["major", "majeur"],
    ["normal", "normal"],
    ["mineur", "mineur"],
    ["minor", "mineur"],
    ["trivial", "mineur"],
    ["enhancement", "evolution"],
    ["évolution", "evolution"],
    ["Évolution", "evolution"],
    ["amelioration", "evolution"],
    ["--", "autre"],
    ["", "autre"],
    ["  ", "autre"]
  ];
  for (const [input, expected] of cases) {
    eq('severityBucket("' + input + '")', popup.severityBucket(input), expected);
  }
}

// ---- i18n -----------------------------------------------------------------
section("i18n : parité et résolution");
{
  const enKeys = Object.keys(dicts.en).sort();
  for (const l of LOCALES) {
    eq("clés identiques (" + l + ")", Object.keys(dicts[l]).sort(), enKeys);
  }

  (async () => {
    const b = makeBrowser({ settings: { lang: "de" } });
    const fetchStub = makeFetch((url, json) => {
      if (url.indexOf("/de/") >= 0) {
        delete json.sev_normal;
      }
      return json;
    });
    const ctx = makeContext(b, { fetch: fetchStub });
    const i18n = loadInto(ctx, ["i18n.js"], ["I18N"]);
    await i18n.I18N.init();
    eq("langue active = de", i18n.I18N.activeLocale, "de");
    eq("repli sur en si clé manquante", i18n.I18N.t("sev_normal"), dicts.en.sev_normal.message);
    eq("clé inconnue → renvoie la clé", i18n.I18N.t("cle_inexistante"), "cle_inexistante");

    const b2 = makeBrowser({ settings: { lang: "en" } });
    const ctx2 = makeContext(b2);
    const i18n2 = loadInto(ctx2, ["i18n.js"], ["I18N"]);
    await i18n2.I18N.init();
    eq("substitution {0}", i18n2.I18N.t("err_http", [500]), dicts.en.err_http.message.replace("{0}", "500"));
    await buildQueryTests;
    await testOffline();
    await testPollHandlers();
    finish();
  })();
}

// ---- manifestes -----------------------------------------------------------
section("manifestes MV2 / MV3");
{
  const mv3 = readJson("manifest.json");
  const mv2 = readJson("manifest.v2.json");

  eq("MV3 manifest_version", mv3.manifest_version, 3);
  ok("MV3 utilise action (pas browser_action)", !!mv3.action && !mv3.browser_action);
  ok(
    "MV3 host_permissions <all_urls>",
    Array.isArray(mv3.host_permissions) && mv3.host_permissions.indexOf("<all_urls>") >= 0
  );
  ok(
    "MV3 : pas d'hôte dans permissions",
    Array.isArray(mv3.permissions) && mv3.permissions.indexOf("<all_urls>") < 0
  );
  ok(
    "MV3 event page (scripts, pas service_worker)",
    Array.isArray(mv3.background.scripts) && !mv3.background.service_worker
  );
  ok(
    "MV3 strict_min_version >= 109",
    parseInt(mv3.browser_specific_settings.gecko.strict_min_version, 10) >= 109
  );

  eq("MV2 manifest_version", mv2.manifest_version, 2);
  ok("MV2 utilise browser_action", !!mv2.browser_action && !mv2.action);
  ok(
    "MV2 hôte dans permissions",
    Array.isArray(mv2.permissions) && mv2.permissions.indexOf("<all_urls>") >= 0
  );

  eq(
    "même ID gecko",
    mv3.browser_specific_settings.gecko.id,
    mv2.browser_specific_settings.gecko.id
  );
  eq("default_locale = en", mv3.default_locale, "en");

  const msgKeys = (obj) => {
    const found = {};
    const re = /__MSG_([A-Za-z0-9_@]+)__/g;
    let m;
    const text = JSON.stringify(obj);
    while ((m = re.exec(text))) {
      found[m[1]] = true;
    }
    return Object.keys(found);
  };
  for (const k of msgKeys(mv3)) {
    ok("MV3 __MSG_" + k + "__ résolue (en)", k in dicts.en);
  }
  for (const k of msgKeys(mv2)) {
    ok("MV2 __MSG_" + k + "__ résolue (en)", k in dicts.en);
  }
}

// ---------------------------------------------------------------------------

function finish() {
  if (finished) {
    return;
  }
  finished = true;
  console.log("\n----------------------------------------");
  console.log("Résultat : " + passed + " OK, " + failed + " échec(s)");
  process.exitCode = failed === 0 ? 0 : 1;
}

setTimeout(() => {
  if (!finished) {
    failed++;
    finish();
  }
}, 5000);
