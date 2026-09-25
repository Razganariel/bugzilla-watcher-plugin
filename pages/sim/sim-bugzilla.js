/*
 * Bugzilla simulé — magasin de tickets (localStorage) + faux API REST + UI du panneau gauche.
 * Toute donnée est fictive. Exposé sous `window.SIM`.
 */
(function () {
  "use strict";

  const SEVERITIES = ["bloquante", "critique", "majeure", "normale", "mineure", "évolution"];
  const PRIORITIES = ["P1", "P2", "P3", "P4"];
  const STATUSES = ["NEW", "ASSIGNED", "REOPENED", "CONFIRMED", "IN_PROGRESS", "RESOLVED"];
  const PRODUCTS = ["Customer Portal", "REST API", "Search", "Design System", "Notifications", "Accounting", "Infrastructure"];

  const LS_KEY = "sim:tickets";
  let tickets = load();
  let nextId = Math.max(0, ...tickets.map((t) => t.id)) + 1;
  let errMode = false;

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      return Array.isArray(raw) ? raw : [];
    } catch (e) {
      return [];
    }
  }

  function save() {
    localStorage.setItem(LS_KEY, JSON.stringify(tickets));
  }

  function iso(d) {
    return new Date(d).toISOString();
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function seed() {
    const base = Date.now();
    const h = (n) => new Date(base - n * 3600e3);
    tickets = [
      { id: 4821, product: "Customer Portal", component: "Login", status: "IN_PROGRESS", severity: "bloquante", priority: "P1", version: "2026.09", summary: "Impossible de se connecter au portail client après la mise à jour", assigned_to: "s.dupont@example.com", creator: "j.martin@example.com", creation_time: iso(h(72)), delta_ts: iso(h(2)) },
      { id: 4819, product: "REST API", component: "Core", status: "NEW", severity: "critique", priority: "P1", version: "2026.09", summary: "L'endpoint /rest/bug renvoie une erreur 500 sur le champ delta_ts", assigned_to: "a.bernard@example.com", creator: "m.lefevre@example.com", creation_time: iso(h(70)), delta_ts: iso(h(3)) },
      { id: 4817, product: "Customer Portal", component: "Export", status: "ASSIGNED", severity: "majeure", priority: "P2", version: "2026.08", summary: "Le bouton Exporter ne fonctionne plus sous Firefox macOS", assigned_to: "a.bernard@example.com", creator: "s.dupont@example.com", creation_time: iso(h(96)), delta_ts: iso(h(5)) },
      { id: 4814, product: "Design System", component: "Tokens", status: "RESOLVED", severity: "mineure", priority: "P3", version: "2026.08", summary: "Police incohérente dans les tableaux de bord du design system", assigned_to: "k.roche@example.com", creator: "c.morel@example.com", creation_time: iso(h(120)), delta_ts: iso(h(26)) },
      { id: 4809, product: "REST API", component: "Docs", status: "NEW", severity: "évolution", priority: "P4", version: "2026.10", summary: "Ajouter un mode sombre à la page d'accueil de l'API", assigned_to: "", creator: "l.petit@example.com", creation_time: iso(h(130)), delta_ts: iso(h(49)) },
      { id: 4805, product: "Search", component: "Filtering", status: "CONFIRMED", severity: "normale", priority: "P2", version: "2026.07", summary: "Trop de faux positifs lors du filtrage des tickets résolus", assigned_to: "m.lefevre@example.com", creator: "t.garnier@example.com", creation_time: iso(h(200)), delta_ts: iso(h(70)) },
      { id: 4801, product: "Search", component: "Sorting", status: "NEW", severity: "normale", priority: "P3", version: "2026.07", summary: "Le tri par importance ignore les sous-composants", assigned_to: "", creator: "h.fournier@example.com", creation_time: iso(h(240)), delta_ts: iso(h(95)) },
      { id: 4798, product: "Notifications", component: "Toasts", status: "REOPENED", severity: "majeure", priority: "P2", version: "2026.06", summary: "Notifications toast manquantes pour les tickets assignés", assigned_to: "k.roche@example.com", creator: "v.gerard@example.com", creation_time: iso(h(300)), delta_ts: iso(h(120)) }
    ];
    nextId = 4822;
    save();
  }

  function list() {
    return tickets.slice().sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
  }

  function get(id) {
    return tickets.find((t) => t.id === id) || null;
  }

  function create(data) {
    const t = {
      id: nextId++,
      creation_time: nowIso(),
      delta_ts: nowIso(),
      assigned_to: data.assigned_to || "",
      creator: data.creator || "demo@example.com",
      priority: data.priority || "P3",
      version: data.version || "2026.09"
    };
    Object.assign(t, {
      summary: String(data.summary || "").trim() || "Sans résumé",
      product: data.product || PRODUCTS[0],
      component: data.component || "General",
      status: data.status || "NEW",
      severity: data.severity || "normale"
    });
    tickets.push(t);
    save();
    return t;
  }

  function update(id, patch) {
    const t = get(id);
    if (!t) return null;
    const EDITS = ["summary", "product", "component", "status", "severity", "priority", "version", "assigned_to"];
    let touched = false;
    for (const k of EDITS) {
      if (patch[k] !== undefined && String(patch[k]) !== String(t[k] || "")) {
        t[k] = patch[k];
        touched = true;
      }
    }
    if (touched) {
      t.delta_ts = nowIso();
      save();
    }
    return t;
  }

  function remove(id) {
    const before = tickets.length;
    tickets = tickets.filter((t) => t.id !== id);
    if (tickets.length !== before) {
      save();
      return true;
    }
    return false;
  }

  function reset() {
    seed();
  }

  // ---- faux REST -----------------------------------------------------------
  function splitList(value) {
    return String(value || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }

  function matchCriteria(bug, params) {
    if (params.get("product") && !splitList(params.get("product")).includes(String(bug.product || "").toLowerCase())) return false;
    if (params.get("component") && !splitList(params.get("component")).includes(String(bug.component || "").toLowerCase())) return false;
    if (params.get("status")) {
      const statuses = splitList(params.get("status"));
      if (!statuses.includes(String(bug.status || "").toLowerCase())) return false;
    }
    if (params.get("severity")) {
      const sevs = splitList(params.get("severity")).map((s) => s.replace(/_/g, " "));
      const raw = String(bug.severity || "").toLowerCase();
      if (!sevs.some((s) => raw.indexOf(s) >= 0)) return false;
    }
    if (params.get("priority")) {
      if (!splitList(params.get("priority")).includes(String(bug.priority || "").toLowerCase())) return false;
    }
    if (params.get("assigned_to") && String(bug.assigned_to || "").indexOf(params.get("assigned_to")) < 0) return false;
    if (params.get("version") && String(bug.version || "") !== params.get("version")) return false;
    if (params.get("summary") && String(bug.summary || "").toLowerCase().indexOf(params.get("summary").toLowerCase()) < 0) return false;
    if (params.get("quicksearch")) {
      const qs = params.get("quicksearch").toLowerCase();
      const hay = String(bug.summary || "") + " " + String(bug.id || "") + " " + String(bug.product || "");
      if (hay.toLowerCase().indexOf(qs) < 0) return false;
    }
    return true;
  }

  function rest(requestUrl) {
    if (errMode) {
      return new Promise((resolve) => {
        setTimeout(() => resolve({ ok: false, error: true, message: "Bugzilla simulé en panne — erreur volontaire", bugError: true }), 250);
      });
    }
    let url;
    try {
      url = new URL(requestUrl);
    } catch (e) {
      return Promise.reject(new Error("URL invalide : " + requestUrl));
    }
    if (!/^\/rest\/bug(?:\?|$)/.test(url.pathname)) {
      return new Promise((resolve) => setTimeout(() => resolve({ bugs: [] }), 150));
    }
    const params = url.searchParams;
    const since = params.get("last_change_time");
    const createdSince = params.get("creation_time");
    const limit = Number(params.get("limit") || 500);

    let result = tickets.filter((b) => matchCriteria(b, params));
    if (since && params.get("watchmode") !== "new") {
      result = result.filter((b) => b.delta_ts > since);
    }
    if (createdSince && !since) {
      result = result.filter((b) => b.creation_time > createdSince);
    }
    const order = String(params.get("order") || "");
    const dirs = order.split(",").map((s) => {
      const parts = s.trim().split(/\s+/);
      return { field: parts[0] || "", dir: parts[1] === "ASC" ? 1 : -1 };
    });
    result.sort((a, b) => {
      for (const d of dirs) {
        const va = String(a[d.field] || "");
        const vb = String(b[d.field] || "");
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        if (cmp) return cmp * d.dir;
      }
      return 0;
    });
    result = result.slice(0, limit);

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          ok: true,
          bugs: result.map((t) => ({
            id: t.id,
            summary: t.summary,
            product: t.product,
            component: t.component,
            status: t.status,
            severity: t.severity,
            priority: t.priority,
            version: t.version,
            assigned_to: t.assigned_to,
            creator: t.creator,
            creation_time: t.creation_time,
            delta_ts: t.delta_ts
          }))
        });
      }, 250 + Math.random() * 350);
    });
  }

  // ---- UI panneau gauche ---------------------------------------------------
  const SEV_COLORS = {
    bloquante: "#d32f2f",
    critique: "#e64a19",
    majeure: "#f57c00",
    normale: "#3f51b5",
    mineure: "#7b7f9e",
    evolution: "#2e7d32"
  };

  let modalTicketId = null;

  function esc(text) {
    const d = document.createElement("div");
    d.textContent = String(text || "");
    return d.innerHTML;
  }

  function badge(sev) {
    const color = SEV_COLORS[sev] || "#607d8b";
    return '<span class="sim-sev" style="background:' + color + '">' + esc(sev) + "</span>";
  }

  function renderList() {
    const tbody = document.getElementById("ticketRows");
    tbody.innerHTML = "";
    for (const t of list()) {
      const tr = document.createElement("tr");
      tr.innerHTML =
        "<td class='sim-id'><a href='#' data-id='" + t.id + "'>" + t.id + "</a></td>" +
        "<td><div class='sim-sum'>" + esc(t.summary) + "</div></td>" +
        "<td>" + badge(t.severity) + "</td>" +
        "<td>" + esc(t.status) + "</td>" +
        "<td>" + esc(t.product) + "</td>" +
        "<td>" + esc(t.component) + "</td>" +
        "<td nowrap>" + esc(t.priority) + "</td>" +
        "<td class='sim-actions'>" +
        "<button type='button' class='sim-btn' data-edit='" + t.id + "'>Éditer</button> " +
        "<button type='button' class='sim-btn sim-btn-danger' data-del='" + t.id + "'>Suppr.</button>" +
        "</td>";
      tr.querySelector(".sim-id a").addEventListener("click", (e) => {
        e.preventDefault();
        openModal(t.id);
      });
      tr.querySelector("[data-edit]").addEventListener("click", () => openModal(t.id));
      tr.querySelector("[data-del]").addEventListener("click", () => {
        remove(t.id);
        renderList();
        newFlash("Ticket #" + t.id + " supprimé du Bugzilla simulé");
      });
      tbody.appendChild(tr);
    }
    document.getElementById("ticketCount").textContent = String(tickets.length);
  }

  function flashEl() {
    return document.getElementById("flash");
  }

  function newFlash(text) {
    const f = flashEl();
    f.textContent = text;
    f.style.opacity = "1";
    clearTimeout(f._t);
    f._t = setTimeout(() => (f.style.opacity = "0"), 2600);
  }

  function openModal(id) {
    modalTicketId = id;
    const t = id ? get(id) : null;
    document.getElementById("mTitle").textContent = t ? "Éditer le ticket #" + t.id : "Nouveau ticket";
    const val = (k) => (t ? t[k] : k === "severity" ? "normale" : k === "status" ? "NEW" : k === "priority" ? "P3" : "");
    fillSelects();
    setSelect("mProduct", val("product"));
    setSelect("mComponent", val("component"));
    setSelect("mSeverity", t ? t.severity : "normale");
    setSelect("mPriority", t ? t.priority : "P3");
    setSelect("mStatus", t ? t.status : "NEW");
    document.getElementById("mSummary").value = t ? t.summary : "";
    document.getElementById("modal").classList.add("open");
  }

  function fillSelects() {
    const p = document.getElementById("mProduct");
    const opts = PRODUCTS.map((x) => "<option>" + esc(x) + "</option>").join("");
    p.innerHTML = opts;
  }

  function setSelect(id, value) {
    const el = document.getElementById(id);
    if (!el || !el.options) return;
    const opt = Array.prototype.find.call(el.options, (o) => o.value === value || o.text === value);
    if (opt) el.value = opt.value;
  }

  function closeModal() {
    document.getElementById("modal").classList.remove("open");
    modalTicketId = null;
  }

  function setup() {
    document.getElementById("btnNew").addEventListener("click", () => openModal(null));
    document.getElementById("btnReset").addEventListener("click", () => {
      reset();
      renderList();
      newFlash("Bugzilla simulé réinitialisé (données d'exemple)");
    });
    document.getElementById("btnCancel").addEventListener("click", closeModal);
    document.getElementById("btnSave").addEventListener("click", () => {
      const data = {
        summary: document.getElementById("mSummary").value,
        product: document.getElementById("mProduct").value,
        component: document.getElementById("mComponent").value,
        severity: document.getElementById("mSeverity").value,
        priority: document.getElementById("mPriority").value,
        status: document.getElementById("mStatus").value
      };
      if (!data.summary.trim()) {
        data.summary = "Ticket sans résumé";
      }
      if (!data.component.trim()) data.component = "General";
      let msg;
      if (modalTicketId) {
        update(modalTicketId, data);
        msg = "Ticket #" + modalTicketId + " modifié — le plugin détectera le changement au prochain cycle";
      } else {
        const t = create(data);
        msg = "Ticket #" + t.id + " créé — le plugin détectera la nouveauté au prochain cycle";
      }
      closeModal();
      renderList();
      newFlash(msg);
    });
    document.getElementById("modal").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closeModal();
      if (e.target.id === "btnCancel") closeModal();
    });
    renderList();
  }

  window.SIM = {
    rest: rest,
    list: list,
    get: get,
    create: create,
    update: update,
    remove: remove,
    reset: reset,
    setErrMode: (v) => (errMode = !!v),
    isErrMode: () => errMode,
    openURL: function (url) {
      const m = String(url || "").match(/show_bug\.cgi\?(?:[^&]*&)*id=(\d+)/);
      if (m) {
        const id = Number(m[1]);
        if (get(id)) {
          openModal(id);
          newFlash("Ouverture du ticket #" + id + " (clic sur la notification)");
          return;
        }
      }
      const buglist = String(url || "").match(/buglist\.cgi/);
      if (buglist) {
        newFlash("Liste des nouveaux tickets (clic sur la notification)");
        return;
      }
      newFlash("Ouverture simulée : " + String(url || "").slice(0, 60));
    }
  };

  if (!tickets.length) {
    seed();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();