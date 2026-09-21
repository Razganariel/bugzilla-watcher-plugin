const $ = (id) => document.getElementById(id);

let filter = "all";

function fmt(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch (e) {
    return iso;
  }
}

function esc(text) {
  const div = document.createElement("div");
  div.textContent = String(text || "");
  return div.innerHTML;
}

const SEV_RANK = ["bloquant", "critique", "majeur", "normal", "mineur", "evolution", "autre"];

function severityBucket(sev) {
  const s = String(sev || "").toLowerCase();
  if (s === "blocker") return "bloquant";
  if (s === "critical") return "critique";
  if (s === "major") return "majeur";
  if (s === "normal") return "normal";
  if (s === "minor" || s === "trivial") return "mineur";
  if (s === "enhancement") return "evolution";
  return "autre";
}

async function refresh() {
  const state = await browser.runtime.sendMessage({ action: "getState" });
  const { settings } = await browser.storage.local.get("settings");
  $("url").textContent = settings && settings.bugzillaUrl ? settings.bugzillaUrl : I18N.t("stat_notconfigured");

  if (settings) $("enabled").checked = !!settings.enabled;

  const watchAll = settings && settings.watchMode === "all";
  $("filterRow").style.display = watchAll ? "flex" : "none";
  if (!watchAll) {
    if (filter !== "all") {
      filter = "all";
      browser.storage.local.set({ popupFilter: "all" });
    }
  }

  const lastDetected = state.lastDetected || [];
  $("lastChecked").textContent = fmt(state.lastPollTime);

  const dot = $("statusDot");
  if (state.lastError) {
    $("statusText").textContent =
      I18N.t("msg_err", [state.lastError]) +
      (state.lastErrorTime ? " (" + fmt(state.lastErrorTime) + ")" : "");
    dot.className = "dot err";
  } else {
    $("statusText").textContent = lastDetected.length > 0
      ? I18N.t("stat_detected", [lastDetected[0].id, fmt(state.lastDetection)])
      : (state.lastPollTime ? I18N.t("stat_active") : I18N.t("stat_waiting"));
    dot.className = "dot" + (state.lastPollTime ? " ok" : "");
  }

  browser.browserAction.setBadgeText({ text: "" });

  renderList(lastDetected, settings);
}

function renderList(lastDetected, settings) {
  const url = (settings && settings.bugzillaUrl || "").replace(/\/+$/, "");
  const items = filter === "new"
    ? lastDetected.filter((it) => it && it.kind === "new")
    : lastDetected;

  $("detectedCount").textContent = String(items.length);
  $("filterAll").classList.toggle("active", filter === "all");
  $("filterNew").classList.toggle("active", filter === "new");

  const list = $("list");
  list.innerHTML = "";
  items.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML =
      '<div class="issue-top">' +
      '<span class="issue-id"><a href="' + esc(url + "/show_bug.cgi?id=" + item.id) + '" target="_blank" rel="noopener">#' + esc(item.id) + "</a></span>" +
      '<span class="issue-time">' + esc(fmt(item.time)) + "</span>" +
      "</div>" +
      '<div class="issue-summary">' + esc(item.summary) + "</div>";
    li.addEventListener("click", (e) => {
      e.preventDefault();
      browser.tabs.create({ url: url + "/show_bug.cgi?id=" + item.id });
    });
    list.appendChild(li);
  });
  $("empty").style.display = items.length ? "none" : "block";
  list.scrollTop = 0;

  const counts = {};
  items.forEach((it) => {
    const b = severityBucket(it.severity);
    counts[b] = (counts[b] || 0) + 1;
  });
  const sevRow = $("sevRow");
  sevRow.innerHTML = "";
  SEV_RANK.forEach((b) => {
    const pill = document.createElement("span");
    pill.className = "sev-pill sev-" + b;
    pill.textContent = String(counts[b] || 0);
    pill.title = I18N.t("sev_" + b);
    sevRow.appendChild(pill);
  });
}

function setFilter(next) {
  filter = next;
  browser.storage.local.set({ popupFilter: next });
  refresh();
}

$("filterAll").addEventListener("click", () => setFilter("all"));
$("filterNew").addEventListener("click", () => setFilter("new"));

$("enabled").addEventListener("change", async (e) => {
  const { settings } = await browser.storage.local.get("settings");
  const updated = Object.assign({}, settings, { enabled: e.target.checked });
  await browser.storage.local.set({ settings: updated });
});

$("checkNow").addEventListener("click", async (e) => {
  const btn = e.target;
  btn.disabled = true;
  btn.textContent = I18N.t("btn_checking");
  await browser.runtime.sendMessage({ action: "poll" });
  setTimeout(async () => {
    await refresh();
    btn.disabled = false;
    btn.textContent = I18N.t("btn_check");
  }, 800);
});

$("openOptions").addEventListener("click", (e) => {
  e.preventDefault();
  browser.runtime.openOptionsPage();
});

(async function init() {
  await I18N.init();
  I18N.applyPage();
  const { popupFilter } = await browser.storage.local.get("popupFilter");
  if (popupFilter === "new") filter = "new";
  await refresh();
})();