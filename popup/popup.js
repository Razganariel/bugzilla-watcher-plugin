const $ = (id) => document.getElementById(id);

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

async function refresh() {
  const state = await browser.runtime.sendMessage({ action: "getState" });
  const { settings } = await browser.storage.local.get("settings");
  $("url").textContent = settings && settings.bugzillaUrl ? settings.bugzillaUrl : I18N.t("stat_notconfigured");

  if (settings) $("enabled").checked = !!settings.enabled;

  const lastDetected = state.lastDetected || [];
  $("detectedCount").textContent = String(lastDetected.length);
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

  const list = $("list");
  list.innerHTML = "";
  lastDetected.forEach((item) => {
    const li = document.createElement("li");
    const url = (settings && settings.bugzillaUrl || "").replace(/\/+$/, "");
    li.innerHTML =
      '<div class="issue-top">' +
      '<span class="issue-id"><a href="' + esc(url + "/show_bug.cgi?id=" + item.id) + '" target="_blank" rel="noopener">#' + esc(item.id) + "</a></span>" +
      '<span class="issue-time">' + esc(fmt(item.time)) + "</span>" +
      "</div>" +
      '<div class="issue-summary">' + esc(item.summary) + "</div>";
    li.addEventListener("click", () => {
      browser.tabs.create({ url: url + "/show_bug.cgi?id=" + item.id });
    });
    list.appendChild(li);
  });
  $("empty").style.display = lastDetected.length ? "none" : "block";
  list.scrollTop = 0;
}

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
  await refresh();
})();