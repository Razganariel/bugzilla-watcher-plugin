const FIELDS = [
  { key: "product", label: "Produit" },
  { key: "component", label: "Composant" },
  { key: "status", label: "Statut" },
  { key: "severity", label: "Sévérité" },
  { key: "priority", label: "Priorité" },
  { key: "resolution", label: "Résolution" },
  { key: "assigned_to", label: "Assigné à" },
  { key: "creator", label: "Créé par" },
  { key: "qa_contact", label: "QA Contact" },
  { key: "summary", label: "Résumé (sous-chaîne)" },
  { key: "version", label: "Version" },
  { key: "target_milestone", label: "Milestone cible" },
  { key: "op_sys", label: "Système d'exploitation" },
  { key: "platform", label: "Plateforme" },
  { key: "whiteboard", label: "Whiteboard (sous-chaîne)" },
  { key: "keywords", label: "Mots-clés" },
  { key: "tags", label: "Tags" },
  { key: "quicksearch", label: "Recherche rapide (quicksearch)" }
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
    lbl.textContent = field.label;
    const input = document.createElement("input");
    input.type = "text";
    input.dataset.field = field.key;
    input.placeholder = "laisser vide = ignorer";
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
  valueInput.placeholder = "valeur";

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
    showMsg("Paramètres bruts invalides : JSON incorrect.", false);
    return;
  }
  const maxTicketsInput = Number(document.getElementById("maxTickets").value);
  if (maxTicketsInput > 50) {
    showMsg("Le nombre max de tickets affichés ne peut pas dépasser 50.", false);
    return;
  }
  if (!settings.bugzillaUrl) {
    showMsg("Veuillez saisir l'URL de l'instance Bugzilla.", false);
    return;
  }
  if (settings.auth.mode === "apiKey" && !settings.auth.apiKey) {
    showMsg("Veuillez saisir votre clé API, ou choisir la session d'un onglet ouvert.", false);
    return;
  }

  await browser.storage.local.set({ settings });
  showMsg("Paramètres enregistrés. Le monitoring est actif.", true);
}

document.getElementById("save").addEventListener("click", doSave);

document.getElementById("test").addEventListener("click", async () => {
  const btn = document.getElementById("test");
  btn.disabled = true;
  btn.textContent = "Recherche en cours…";

  const settings = collectSettings();
  if (!settings.bugzillaUrl) {
    showMsg("Veuillez saisir l'URL de l'instance Bugzilla.", false);
    btn.disabled = false;
    btn.textContent = "Tester la recherche";
    return;
  }
  if (settings.auth.mode === "apiKey" && !settings.auth.apiKey) {
    showMsg("Veuillez saisir votre clé API, ou choisir la session d'un onglet ouvert.", false);
    btn.disabled = false;
    btn.textContent = "Tester la recherche";
    return;
  }

  await browser.storage.local.set({ settings });
  const res = await browser.runtime.sendMessage({ action: "test" });
  if (res && res.ok) {
    let lines = "La recherche renvoie " + res.count + " ticket(s).";
    if (res.sample && res.sample.length) {
      lines += "\nExemples : " + res.sample.map((s) => "#" + s.id + " (" + s.summary + ")").join(", ");
    }
    showMsg(lines, true);
  } else {
    showMsg("Erreur : " + ((res && res.error) || "inconnue"), false);
  }
  btn.disabled = false;
  btn.textContent = "Tester la recherche";
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

async function load() {
  const { settings } = await browser.storage.local.get("settings");
  const s = settings || {};
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

  const criteria = s.criteria || {};
  document.querySelectorAll("#criteriaGrid input[data-field]").forEach((input) => {
    input.value = criteria[input.dataset.field] || "";
  });

  const adv = s.advancedCriteria || [];
  if (!adv.length) {
    createAdvancedRow({ field: ADV_FIELDS[0], op: "anyexact", value: "" }, 0);
  } else {
    adv.forEach((row, i) => createAdvancedRow(row, i));
  }
}

buildCriteriaGrid();
load();