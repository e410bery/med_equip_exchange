// Order detail page. Backend: routes/shop.py
//   GET /api/orders/<id> -> order summary + lines (unit_price paid, fulfilled_at per line)
// With ?placed=1 (the redirect after checkout) it also shows a confirmation banner.

const params = new URLSearchParams(location.search);
const orderId = params.get("id");

function formatDate(value) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function statusText(order) {
  if (order.is_complete) return "Fulfilled";
  if (Number(order.fulfilled_count) === 0) return "Awaiting fulfillment";
  return `Partially fulfilled (${order.fulfilled_count} of ${order.line_count} items shipped)`;
}

function renderConfirmation(order) {
  const banner = document.getElementById("confirmation");
  banner.replaceChildren(
    el("strong", {}, "Thank you! Your order has been placed. "),
    `${money(order.total)} was paid from your balance. Sellers have been notified and will fulfill each item. `,
    el("a", { href: "/products" }, "Continue browsing"),
  );
  banner.hidden = false;
}

function renderSummary(order) {
  document.title = `Order #${order.id} · Med Equip Exchange`;
  document.getElementById("order-title").textContent = `Order #${order.id}`;
  const row = (label, value) => [el("dt", {}, label), el("dd", {}, value)];
  document.getElementById("order-summary").replaceChildren(
    ...row("Placed", el("time", { datetime: order.placed_at }, formatDate(order.placed_at))),
    ...row("Items", String(order.item_count)),
    ...row("Total paid", el("strong", {}, money(order.total))),
    ...row("Status", el("span", { class: `badge ${order.is_complete ? "ok" : "pending"}` }, statusText(order))),
  );
}

function renderLines(order) {
  const rows = order.lines.map((line) =>
    el("tr", {},
      el("td", {}, el("a", { href: `item.html?id=${line.item_id}` }, line.name)),
      el("td", {}, line.seller_name),
      el("td", { class: "num" }, line.quantity),
      el("td", { class: "num" }, money(line.unit_price)),
      el("td", { class: "num" }, money(line.line_total)),
      el("td", {},
        line.fulfilled_at
          ? el("span", { class: "badge ok", title: formatDate(line.fulfilled_at) },
              `Shipped ${new Date(line.fulfilled_at).toLocaleDateString()}`)
          : el("span", { class: "badge pending" }, "Pending"),
      ),
    ),
  );
  document.getElementById("order-lines").replaceChildren(
    el("table", {},
      el("thead", {},
        el("tr", {},
          el("th", {}, "Item"),
          el("th", {}, "Seller"),
          el("th", { class: "num" }, "Qty"),
          el("th", { class: "num" }, "Price paid"),
          el("th", { class: "num" }, "Subtotal"),
          el("th", {}, "Status"),
        ),
      ),
      el("tbody", {}, ...rows),
      el("tfoot", {},
        el("tr", {},
          el("td", { colspan: "4", class: "num" }, el("strong", {}, "Total")),
          el("td", { class: "num" }, el("strong", {}, money(order.total))),
          el("td", {}),
        ),
      ),
    ),
  );
}

async function loadOrder() {
  if (!orderId || !/^\d+$/.test(orderId)) {
    showError("No order selected. Choose one from your order history.");
    document.getElementById("loading").hidden = true;
    return;
  }
  try {
    const order = await api(`/api/orders/${orderId}`);
    if (params.get("placed") === "1") renderConfirmation(order);
    renderSummary(order);
    renderLines(order);
    document.getElementById("order").hidden = false;
  } catch (err) {
    showError(err.message);
  } finally {
    document.getElementById("loading").hidden = true;
  }
}

loadOrder();
