// Sales Analytics page. Backend: routes/seller.py
//   GET /api/seller/analytics?months=12 -> totals, sales_by_month, top_items, turnover

function table(headers, rows, empty) {
  if (rows.length === 0) return el("p", { class: "muted" }, empty);
  return el("table", {},
    el("thead", {}, el("tr", {}, ...headers.map((h) => el("th", {}, h)))),
    el("tbody", {}, ...rows),
  );
}

function renderTotals(totals, months) {
  document.getElementById("totals").textContent =
    `Last ${months} months: ${money(totals.revenue)} from ${totals.orders} orders ` +
    `(${totals.units} units sold), plus ${money(totals.rental_revenue)} in rentals.`;
}

function renderSales(sales) {
  const max = Math.max(...sales.map((m) => Number(m.revenue)), 1);
  const rows = sales.map((m) =>
    el("tr", {},
      el("td", {}, m.month),
      el("td", { class: "bar-cell" },
        el("div", { class: "bar", style: `width: ${(Number(m.revenue) / max) * 100}%` })),
      el("td", { class: "num" }, money(m.revenue)),
      el("td", { class: "num" }, m.units),
      el("td", { class: "num" }, m.orders),
    ),
  );
  document.getElementById("sales").replaceChildren(
    table(["Month", "", "Revenue", "Units", "Orders"], rows, "No sales yet."),
  );
}

function renderTopItems(items) {
  const rows = items.map((i) =>
    el("tr", {},
      el("td", {}, el("a", { href: `item.html?id=${i.id}` }, i.name)),
      el("td", { class: "num" }, i.units),
      el("td", { class: "num" }, money(i.revenue)),
    ),
  );
  document.getElementById("top-items").replaceChildren(
    table(["Item", "Units", "Revenue"], rows, "Nothing sold in this period."),
  );
}

function renderTurnover(items) {
  const rows = items.map((i) =>
    el("tr", {},
      el("td", {}, el("a", { href: `item.html?id=${i.id}` }, i.name)),
      el("td", { class: "num" }, i.units_sold),
      el("td", { class: "num" }, i.current_stock),
      el("td", { class: "num" }, i.turnover_ratio ?? "—"),
    ),
  );
  document.getElementById("turnover").replaceChildren(
    table(["Item", "Sold", "In stock", "Turnover"], rows, "You have no listings yet."),
  );
}

async function loadAnalytics() {
  const months = document.getElementById("months").value;
  showError("");
  try {
    const data = await api(`/api/seller/analytics?months=${months}`);
    renderTotals(data.totals, data.months);
    renderSales(data.sales_by_month);
    renderTopItems(data.top_items);
    renderTurnover(data.turnover);
  } catch (err) {
    showError(err.message);
  }
}

document.getElementById("months").addEventListener("change", loadAnalytics);
loadAnalytics();
