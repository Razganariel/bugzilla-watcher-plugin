const FIELDS = [
  { key: "product", labelKey: "fld_product" },
  { key: "component", labelKey: "fld_component" },
  { key: "status", labelKey: "fld_status" },
  { key: "severity", labelKey: "fld_severity" },
  { key: "priority", labelKey: "fld_priority" },
  { key: "resolution", labelKey: "fld_resolution" },
  { key: "assigned_to", labelKey: "fld_assigned" },
  { key: "creator", labelKey: "fld_creator" },
  { key: "qa_contact", labelKey: "fld_qa" },
  { key: "summary", labelKey: "fld_summary" },
  { key: "version", labelKey: "fld_version" },
  { key: "target_milestone", labelKey: "fld_milestone" },
  { key: "op_sys", labelKey: "fld_opsys" },
  { key: "platform", labelKey: "fld_platform" },
  { key: "whiteboard", labelKey: "fld_whiteboard" },
  { key: "keywords", labelKey: "fld_keywords" },
  { key: "tags", labelKey: "fld_tags" },
  { key: "quicksearch", labelKey: "fld_quicksearch" }
];

const ADV_FIELDS = [
  "product", "component", "bug_status", "resolution", "bug_severity",
  "priority", "op_sys", "rep_platform", "version", "target_milestone",
  "assigned_to", "reporter", "qa_contact", "short_desc", "status_whiteboard",
  "keywords", "tag", "bug_id", "alias", "creation_ts", "delta_ts"
];

const OPERATORS = [
  "anyexact", "notequals", "substring", "notsubstring", "contains", "notcontains",
  "lessthan", "greaterthan", "changedbefore", "changedafter", "anywords",
  "allwords", "regexp", "isempty", "notempty", "changedfield", "changedto"
];

function esc(text) {
  const div = document.createElement("div");
  div.textContent = String(text || "");
  return div.innerHTML;
}

function buildCriteriaGrid() {
  const grid = document.getElementById("criteriaGrid");
  FIELDS.forEach((field) => {
    const lbl = document.createElement("label");
    lbl.textContent = I18N.t(field.labelKey);
    const input = document.createElement("input");
    input.type = "text";
    input.dataset.field = field.key;
    input.placeholder = I18N.t("ph_ignore");
    lbl.appendChild(input);
    grid.appendChild(lbl);
  });
}

function createAdvancedRow(row, index) {
  const div = document.createElement("div");
  div.className = "adv-row";
  div.dataset.index = index;

  const fieldSel = document.createElement("select");
  fieldSel.className = "adv-field";
  ADV_FIELDS.forEach((fv) => {
    const opt = document.createElement("option");
    opt.value = fv;
    opt.textContent = fv;
    fieldSel.appendChild(opt);
  });
  fieldSel.value = row.field || ADV_FIELDS[0];

  const opSel = document.createElement("select");
  opSel.className = "adv-op";
  OPERATORS.forEach((op) => {
    const opt = document.createElement("option");
    opt.value = op;
    opt.textContent = op;
    opSel.appendChild(opt);
  });
  opSel.value = row.op || "anyexact";

  const valueInput = document.createElement("input");
  valueInput.type = "text";
  valueInput.className = "adv-value";
  valueInput.value = row.value || "";
  valueInput.placeholder = I18N.t("ph_value");

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn-secondary";
  removeBtn.textContent = "✕";
  removeBtn.addEventListener("click", () => div.remove());

  div.appendChild(fieldSel);
  div.appendChild(opSel);
  div.appendChild(valueInput);
  div.appendChild(removeBtn);
  document.getElementById("advancedRows").appendChild(div);
}

function readAdvancedRows() {
  const rows = [];
  document.querySelectorAll("#advancedRows .adv-row").forEach((div) => {
    const field = div.querySelector(".adv-field").value;
    const op = div.querySelector(".adv-op").value;
    const value = div.querySelector(".adv-value").value.trim();
    if (field) {
      rows.push({ field, op, value });
    }
  });
  return rows;
}

function showMsg(msg, ok) {
  const el = document.getElementById("msg");
  el.textContent = msg;
  el.className = "msg " + (ok ? "ok" : "err");
}

let currentLang = "auto";

function collectSettings() {
  const settings = {
    enabled: true,
    bugzillaUrl: document.getElementById("bugzillaUrl").value.trim(),
    pollInterval: Math.max(1, Number(document.getElementById("pollInterval").value) || 1),
    baselineFirstRun: document.getElementById("baselineFirstRun").checked,
    auth: {
      mode: document.querySelector('input[name="authMode"]:checked').value,
      apiKey: document.getElementById("apiKey").value.trim()
    },
    orderBy: document.getElementById("orderBy").value,
    orderDirection: document.getElementById("orderDirection").value,
    maxTickets: Math.min(50, Math.max(1, Number(document.getElementById("maxTickets").value) || 50)),
    lang: document.getElementById("lang").value || "auto",
    watchMode: document.getElementById("watchMode").value || "new",
    criteria: {},
    advancedCriteria: readAdvancedRows(),
    rawParams: document.getElementById("rawParams").value.trim(),
    notify: {
      toast: document.getElementById("notifyToast").checked,
      sound: document.getElementById("notifySound").checked,
      soundUrl: document.getElementById("soundUrl").value.trim()
    }
  };
  document.querySelectorAll("#criteriaGrid input[data-field]").forEach((input) => {
    settings.criteria[input.dataset.field] = input.value;
  });
  return settings;
}

async function doSave() {
  const settings = collectSettings();
  try {
    JSON.parse(settings.rawParams || "{}");
  } catch (e) {
    showMsg(I18N.t("msg_raw_invalid"), false);
    return;
  }
  const maxTicketsInput = Number(document.getElementById("maxTickets").value);
  if (maxTicketsInput > 50) {
    showMsg(I18N.t("msg_maxtix"), false);
    return;
  }
  if (!settings.bugzillaUrl) {
    showMsg(I18N.t("msg_no_url"), false);
    return;
  }
  if (settings.auth.mode === "apiKey" && !settings.auth.apiKey) {
    showMsg(I18N.t("msg_no_apikey"), false);
    return;
  }

  await browser.storage.local.set({ settings });
  if (settings.lang !== currentLang) {
    location.reload();
    return;
  }
  showMsg(I18N.t("msg_saved"), true);
}

document.getElementById("save").addEventListener("click", doSave);

document.getElementById("test").addEventListener("click", async () => {
  const btn = document.getElementById("test");
  btn.disabled = true;
  btn.textContent = I18N.t("btn_searching");

  const settings = collectSettings();
  if (!settings.bugzillaUrl) {
    showMsg(I18N.t("msg_no_url"), false);
    btn.disabled = false;
    btn.textContent = I18N.t("btn_test");
    return;
  }
  if (settings.auth.mode === "apiKey" && !settings.auth.apiKey) {
    showMsg(I18N.t("msg_no_apikey"), false);
    btn.disabled = false;
    btn.textContent = I18N.t("btn_test");
    return;
  }

  await browser.storage.local.set({ settings });
  const res = await browser.runtime.sendMessage({ action: "test" });
  if (res && res.ok) {
    let lines = I18N.t("msg_test_count", [res.count]);
    if (res.sample && res.sample.length) {
      lines += "\n" + I18N.t("msg_test_samples", [res.sample.map((s) => "#" + s.id + " (" + s.summary + ")").join(", ")]);
    }
    showMsg(lines, true);
  } else {
    showMsg(I18N.t("msg_err", [String((res && res.error) || I18N.t("msg_unknown"))]), false);
  }
  btn.disabled = false;
  btn.textContent = I18N.t("btn_test");
});

document.getElementById("addAdvanced").addEventListener("click", () => {
  createAdvancedRow({ field: ADV_FIELDS[0], op: "anyexact", value: "" },
    document.querySelectorAll("#advancedRows .adv-row").length);
});

function updateAuthUI() {
  const mode = document.querySelector('input[name="authMode"]:checked').value;
  document.getElementById("apiKeyBlock").classList.toggle("hidden", mode !== "apiKey");
  document.getElementById("sessionHint").classList.toggle("hidden", mode === "apiKey");
}

document.querySelectorAll('input[name="authMode"]').forEach((radio) => {
  radio.addEventListener("change", updateAuthUI);
});

const IMPORT_KEYS = new Set([
  "enabled", "bugzillaUrl", "pollInterval", "baselineFirstRun",
  "orderBy", "orderDirection", "maxTickets", "lang", "watchMode",
  "criteria", "advancedCriteria", "rawParams", "auth", "notify"
]);

function normalizeImported(data) {
  const out = {};
  let any = false;
  IMPORT_KEYS.forEach((k) => {
    if (data[k] !== undefined) {
      out[k] = data[k];
      any = true;
    }
  });
  if (!any) return null;

  out.auth =
    out.auth && typeof out.auth === "object" && !Array.isArray(out.auth)
      ? { mode: out.auth.mode === "apiKey" ? "apiKey" : "session", apiKey: String(out.auth.apiKey || "") }
      : { mode: "session", apiKey: "" };
  out.notify =
    out.notify && typeof out.notify === "object" && !Array.isArray(out.notify)
      ? { toast: out.notify.toast !== false, sound: out.notify.sound !== false, soundUrl: String(out.notify.soundUrl || "") }
      : { toast: true, sound: true, soundUrl: "" };
  if (!out.criteria || typeof out.criteria !== "object" || Array.isArray(out.criteria)) {
    out.criteria = {};
  }
  if (!Array.isArray(out.advancedCriteria)) {
    out.advancedCriteria = [];
  } else {
    out.advancedCriteria = out.advancedCriteria.filter(
      (r) => r && typeof r === "object" && r.field
    );
  }
  return out;
}

function fillForm(s) {
  s = s || {};
  document.getElementById("bugzillaUrl").value = s.bugzillaUrl || "";
  document.getElementById("pollInterval").value = s.pollInterval || 1;
  document.getElementById("baselineFirstRun").checked =
    s.baselineFirstRun !== false;
  document.getElementById("notifyToast").checked = !s.notify || s.notify.toast !== false;
  document.getElementById("notifySound").checked = !s.notify || s.notify.sound !== false;
  document.getElementById("soundUrl").value = (s.notify && s.notify.soundUrl) || "";
  document.getElementById("rawParams").value = s.rawParams || "{}";

  const auth = s.auth || {};
  const mode = auth.mode === "apiKey" ? "apiKey" : "session";
  const radio = document.querySelector('input[name="authMode"][value="' + mode + '"]');
  if (radio) radio.checked = true;
  document.getElementById("apiKey").value = auth.apiKey || "";
  updateAuthUI();

  document.getElementById("orderBy").value = s.orderBy || "bug_id";
  document.getElementById("orderDirection").value = s.orderDirection || "DESC";
  document.getElementById("maxTickets").value = Math.min(50, Math.max(1, Number(s.maxTickets) || 50));
  document.getElementById("lang").value = s.lang || "auto";
  document.getElementById("watchMode").value = s.watchMode || "new";

  const criteria = s.criteria || {};
  document.querySelectorAll("#criteriaGrid input[data-field]").forEach((input) => {
    input.value = criteria[input.dataset.field] || "";
  });

  const wrap = document.getElementById("advancedRows");
  wrap.innerHTML = "";
  const adv = s.advancedCriteria || [];
  if (!adv.length) {
    createAdvancedRow({ field: ADV_FIELDS[0], op: "anyexact", value: "" }, 0);
  } else {
    adv.forEach((row, i) => createAdvancedRow(row, i));
  }
}

async function load() {
  const { settings } = await browser.storage.local.get("settings");
  fillForm(settings || {});
  currentLang = (settings && settings.lang) || "auto";
}

function exportSettings() {
  const settings = collectSettings();
  const blob = new Blob([JSON.stringify(settings, null, 2)], {
    type: "application/json;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bugzilla-monitor-settings.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function applyImported(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    showMsg(I18N.t("imp_err_json"), false);
    return;
  }
  const norm = normalizeImported(data);
  if (!norm) {
    showMsg(I18N.t("imp_err_keys"), false);
    return;
  }
  fillForm(norm);
  currentLang = norm.lang || "auto";
  doSave();
  document.getElementById("save").scrollIntoView({ block: "nearest" });
}

document.getElementById("exportBtn").addEventListener("click", exportSettings);

const importInput = document.createElement("input");
importInput.type = "file";
importInput.accept = ".json,application/json";
importInput.style.display = "none";
document.body.appendChild(importInput);
importInput.addEventListener("change", () => {
  const file = importInput.files && importInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      applyImported(JSON.parse(reader.result));
    } catch (e) {
      showMsg(I18N.t("imp_err_json"), false);
    }
  };
  reader.onerror = () => showMsg(I18N.t("imp_err_json"), false);
  reader.readAsText(file);
});
document.getElementById("importBtn").addEventListener("click", () => {
  importInput.value = "";
  importInput.click();
});

(async function () {
  await I18N.init();
  I18N.applyPage();
  buildCriteriaGrid();
  await load();
})();