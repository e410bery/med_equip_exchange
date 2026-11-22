// Maintenance & Certification management for sellers. Backend: routes/seller.py
//   GET    /api/seller/listings                         -> the seller's listings (for the picker)
//   GET    /api/seller/alerts                           -> expiring certs + overdue maintenance
//   GET    /api/seller/listings/<id>/records            -> {maintenance, certifications}
//   POST   /api/seller/listings/<id>/maintenance        {performed_on, description, performed_by?, next_due?}
//   POST   /api/seller/listings/<id>/certifications     {name, issuer, issued_on, expires_on}
//   PUT    /api/seller/maintenance/<id>, /api/seller/certifications/<id>   (same fields)
//   DELETE /api/seller/maintenance/<id>, /api/seller/certifications/<id>
// Link here with records.html?item_id=<listing id>.

const FORM_TITLES = {
  maintenance: { add: "Add maintenance record", edit: "Edit maintenance record", button: "Add record" },
  certifications: { add: "Add certification", edit: "Edit certification", button: "Add certification" },
};

let listings = [];
let currentItemId = null;
let busy = false;
// While editing, which record each form is editing: {maintenance: id|null, certifications: id|null}
const editing = { maintenance: null, certifications: null };

// Today as YYYY-MM-DD in the user's time zone (toISOString would use UTC).
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// "2026-11-03" -> "Nov 3, 2026", without the UTC off-by-one that new Date("2026-11-03") gives.
function formatDay(value) {
  if (!value) return "—";
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { dateStyle: "medium" });
}

function showNotice(message) {
  const notice = document.getElementById("notice");
  notice.textContent = message;
  notice.hidden = !message;
}

function table(headers, rows, empty) {
  if (rows.length === 0) return el("p", { class: "muted" }, empty);
  return el("table", {},
    el("thead", {}, el("tr", {}, ...headers.map((h) => el("th", {}, h)))),
    el("tbody", {}, ...rows),
  );
}

function recordsUrl(itemId) {
  return `records.html?item_id=${itemId}`;
}

// ---------- loading ----------

async function init() {
  try {
    const [mine, alerts] = await Promise.all([api("/api/seller/listings"), api("/api/seller/alerts")]);
    listings = mine;
    renderAlerts(alerts);
    if (listings.length === 0) {
      document.getElementById("no-listings").hidden = false;
      return;
    }
    const requested = new URLSearchParams(location.search).get("item_id");
    const chosen = listings.find((item) => String(item.id) === requested);
    if (requested && !chosen) showError("That listing wasn't found among yours, so your first listing is shown.");
    renderPicker();
    document.getElementById("records").hidden = false;
    await selectListing((chosen || listings[0]).id);
  } catch (err) {
    showError(err.message);
  } finally {
    document.getElementById("loading").hidden = true;
  }
}

function renderPicker() {
  const select = document.getElementById("listing-select");
  select.replaceChildren(...listings.map((item) =>
    el("option", { value: item.id }, item.is_active ? item.name : `${item.name} (removed)`),
  ));
  select.onchange = () => selectListing(Number(select.value));
}

async function selectListing(itemId) {
  currentItemId = itemId;
  document.getElementById("listing-select").value = String(itemId);
  history.replaceState(null, "", recordsUrl(itemId));
  const item = listings.find((i) => i.id === itemId);
  document.getElementById("listing-meta").replaceChildren(
    [item.manufacturer, item.model, item.condition, item.location].filter(Boolean).join(" · "),
    " · ",
    el("a", { href: `item.html?id=${item.id}` }, "View listing"),
  );
  resetForm("maintenance");
  resetForm("certifications");
  await loadRecords();
}

async function loadRecords() {
  const records = await api(`/api/seller/listings/${currentItemId}/records`);
  renderMaintenance(records.maintenance);
  renderCertifications(records.certifications);
}

async function refreshAlerts() {
  renderAlerts(await api("/api/seller/alerts"));
}

// ---------- rendering ----------

function renderAlerts(alerts) {
  const items = [
    ...alerts.certifications.map((c) =>
      el("li", {},
        el("span", { class: `badge ${c.status === "expired" ? "bad" : "pending"}` },
          c.status === "expired" ? "Expired" : `Expires in ${c.days_left} day${c.days_left === 1 ? "" : "s"}`),
        " ", el("strong", {}, c.name), ` (${c.issuer}) on `,
        el("a", { href: recordsUrl(c.item_id), onclick: alertLink(c.item_id) }, c.item_name),
      )),
    ...alerts.overdue_maintenance.map((m) =>
      el("li", {},
        el("span", { class: "badge bad" }, `Maintenance ${m.days_overdue} day${m.days_overdue === 1 ? "" : "s"} overdue`),
        " ", el("a", { href: recordsUrl(m.item_id), onclick: alertLink(m.item_id) }, m.item_name),
        el("span", { class: "muted" }, ` (was due ${formatDay(m.next_due)})`),
      )),
  ];
  document.getElementById("alert-list").replaceChildren(...items);
  document.getElementById("alerts").hidden = items.length === 0;
}

// Alert links switch listings in place instead of reloading the page.
function alertLink(itemId) {
  return (event) => {
    if (!listings.some((i) => i.id === itemId)) return;
    event.preventDefault();
    showError("");
    selectListing(itemId).catch((err) => showError(err.message));
  };
}

function actionButtons(kind, record) {
  return el("td", { class: "actions" },
    el("button", { class: "secondary button-small", type: "button", onclick: () => startEdit(kind, record) }, "Edit"),
    " ",
    el("button", { class: "link", type: "button", onclick: () => deleteRecord(kind, record) }, "Delete"),
  );
}

function renderMaintenance(records) {
  const now = today();
  // Records come newest first; only the latest one's due date matters (newer work supersedes it).
  const rows = records.map((r, index) => {
    const overdue = index === 0 && r.next_due && r.next_due < now;
    return el("tr", { "data-id": r.id, class: editing.maintenance === r.id ? "editing" : "" },
      el("td", {}, formatDay(r.performed_on)),
      el("td", { class: "pre-wrap" }, r.description),
      el("td", {}, r.performed_by || el("span", { class: "muted" }, "—")),
      el("td", {},
        formatDay(r.next_due),
        overdue ? el("div", {}, el("span", { class: "badge bad" }, "Overdue")) : null,
      ),
      actionButtons("maintenance", r),
    );
  });
  document.getElementById("maintenance-table").replaceChildren(
    table(["Performed", "Description", "By", "Next due", ""], rows, "No maintenance recorded for this listing yet."),
  );
}

const CERT_BADGES = {
  valid: ["ok", "Valid"],
  expiring_soon: ["pending", "Expiring soon"],
  expired: ["bad", "Expired"],
};

function renderCertifications(records) {
  const rows = records.map((c) => {
    const [cls, label] = CERT_BADGES[c.status];
    return el("tr", { "data-id": c.id, class: editing.certifications === c.id ? "editing" : "" },
      el("td", {}, c.name),
      el("td", {}, c.issuer),
      el("td", {}, formatDay(c.issued_on)),
      el("td", {}, formatDay(c.expires_on)),
      el("td", {}, el("span", { class: `badge ${cls}` }, label)),
      actionButtons("certifications", c),
    );
  });
  document.getElementById("certifications-table").replaceChildren(
    table(["Certification", "Issuer", "Issued", "Expires", "Status", ""], rows, "No certifications recorded for this listing yet."),
  );
}

// ---------- add / edit / delete ----------

function form(kind) {
  return document.getElementById(`${kind}-form`);
}

function resetForm(kind) {
  const f = form(kind);
  editing[kind] = null;
  f.reset();
  f.querySelector("h3").textContent = FORM_TITLES[kind].add;
  f.querySelector('button[type="submit"]').textContent = FORM_TITLES[kind].button;
  f.querySelector(".cancel-edit").hidden = true;
  f.classList.remove("is-editing");
  document.querySelectorAll(`#${kind}-table tr.editing`).forEach((tr) => tr.classList.remove("editing"));
}

function startEdit(kind, record) {
  const f = form(kind);
  resetForm(kind);
  editing[kind] = record.id;
  for (const input of f.querySelectorAll("input, textarea")) {
    input.value = record[input.name] ?? "";
  }
  f.querySelector("h3").textContent = FORM_TITLES[kind].edit;
  f.querySelector('button[type="submit"]').textContent = "Save changes";
  f.querySelector(".cancel-edit").hidden = false;
  f.classList.add("is-editing");
  document.querySelector(`#${kind}-table tr[data-id="${record.id}"]`)?.classList.add("editing");
  f.scrollIntoView({ behavior: "smooth", block: "center" });
  f.querySelector("input, textarea").focus({ preventScroll: true });
}

// Runs one change, then reloads the records and alerts. Ignores clicks while busy.
async function run(change, successMessage) {
  if (busy) return false;
  busy = true;
  showError("");
  showNotice("");
  document.querySelectorAll("#records button").forEach((b) => (b.disabled = true));
  let ok = false;
  try {
    await change();
    ok = true;
    showNotice(successMessage);
  } catch (err) {
    showError(err.message);
  }
  try {
    await Promise.all([loadRecords(), refreshAlerts()]);
  } catch (err) {
    showError(err.message);
  }
  document.querySelectorAll("#records button").forEach((b) => (b.disabled = false));
  busy = false;
  return ok;
}

function checkDates(kind, data) {
  const now = today();
  if (kind === "maintenance") {
    if (data.performed_on > now) return "The service date can't be in the future.";
    if (data.next_due && data.next_due <= data.performed_on) return "Next service due must be after the date performed.";
  } else {
    if (data.issued_on > now) return "The issue date can't be in the future.";
    if (data.expires_on <= data.issued_on) return "The expiry date must be after the issue date.";
  }
  return null;
}

async function submitForm(event) {
  event.preventDefault();
  const f = event.target;
  const kind = f.dataset.kind;
  const data = Object.fromEntries(new FormData(f));
  for (const key of Object.keys(data)) data[key] = data[key].trim();

  const problem = checkDates(kind, data);
  if (problem) {
    showError(problem);
    return;
  }

  const id = editing[kind];
  const ok = await run(
    () => id
      ? api(`/api/seller/${kind}/${id}`, { method: "PUT", body: data })
      : api(`/api/seller/listings/${currentItemId}/${kind}`, { method: "POST", body: data }),
    id ? "Changes saved." : (kind === "maintenance" ? "Maintenance record added." : "Certification added."),
  );
  if (ok) resetForm(kind);
}

function deleteRecord(kind, record) {
  const label = kind === "maintenance"
    ? `the maintenance record from ${formatDay(record.performed_on)}`
    : `the certification "${record.name}"`;
  if (!confirm(`Delete ${label}? This can't be undone.`)) return;
  run(async () => {
    await api(`/api/seller/${kind}/${record.id}`, { method: "DELETE" });
    if (editing[kind] === record.id) resetForm(kind);
  }, "Record deleted.");
}

for (const kind of ["maintenance", "certifications"]) {
  const f = form(kind);
  f.addEventListener("submit", submitForm);
  f.querySelector(".cancel-edit").addEventListener("click", () => resetForm(kind));
  // The browser's date picker won't offer future dates for these.
  f.querySelector(kind === "maintenance" ? '[name="performed_on"]' : '[name="issued_on"]').max = today();
}

init();
