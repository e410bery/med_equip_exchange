// Seller Dashboard page. Backend: routes/seller_tools.py and routes/seller.py
//   GET  /api/seller/listings                  POST /api/seller/listings/<id>/restock {amount}
//   GET  /api/seller/orders?status=pending     POST /api/seller/orders/<order_id>/fulfill
//   GET  /api/seller/customers                 GET  /api/seller/reviews

function table(headers, rows, empty) {
  if (rows.length === 0) return el("p", { class: "muted" }, empty);
  return el("table", {},
    el("thead", {}, el("tr", {}, ...headers.map((h) => el("th", {}, h)))),
    el("tbody", {}, ...rows),
  );
}

let busy = false;

async function run(request) {
  if (busy) return;
  busy = true;
  showError("");
  document.querySelectorAll("main button").forEach((b) => (b.disabled = true));
  try {
    await request();
  } catch (err) {
    showError(err.message);
  }
  busy = false;
  await loadAll();
}

function restock(itemId, input) {
  return run(() =>
    api(`/api/seller/listings/${itemId}/restock`, { method: "POST", body: { amount: Number(input.value) } }),
  );
}

function fulfill(orderId) {
  return run(() => api(`/api/seller/orders/${orderId}/fulfill`, { method: "POST" }));
}

function renderListings(listings) {
  const rows = listings.map((item) => {
    const amount = el("input", { class: "cart-qty", type: "number", step: "1", value: "1" });
    return el("tr", {},
      el("td", {}, el("a", { href: `item.html?id=${item.id}` }, item.name), item.is_active ? null : " (removed)"),
      el("td", { class: "num" }, money(item.price)),
      el("td", { class: "num" }, item.quantity),
      el("td", { class: "num" }, item.units_sold),
      el("td", {}, amount, " ", el("button", { class: "secondary", onclick: () => restock(item.id, amount) }, "Restock")),
    );
  });
  document.getElementById("listings").replaceChildren(
    table(["Item", "Price", "Stock", "Sold", "Add stock"], rows, "You have no listings yet."),
  );
}

function renderOrders(lines) {
  const orders = {};
  for (const line of lines) {
    if (!orders[line.order_id]) orders[line.order_id] = [];
    orders[line.order_id].push(line);
  }
  const rows = Object.entries(orders).map(([orderId, items]) =>
    el("tr", {},
      el("td", {}, `#${orderId}`),
      el("td", {}, items[0].placed_at.slice(0, 10)),
      el("td", {}, items[0].buyer_name),
      el("td", {}, items.map((i) => `${i.quantity} × ${i.name}`).join(", ")),
      el("td", {}, el("button", { onclick: () => fulfill(orderId) }, "Fulfill order")),
    ),
  );
  document.getElementById("orders").replaceChildren(
    table(["Order", "Placed", "Buyer", "Items", ""], rows, "Nothing waiting to be fulfilled."),
  );
}

function renderCustomers(customers) {
  const rows = customers.map((c) =>
    el("tr", {},
      el("td", {}, c.full_name, c.organization ? el("div", { class: "muted" }, c.organization) : null),
      el("td", { class: "num" }, c.order_count),
      el("td", { class: "num" }, c.units),
      el("td", { class: "num" }, money(c.total_spent)),
      el("td", {}, c.last_order_at.slice(0, 10)),
    ),
  );
  document.getElementById("customers").replaceChildren(
    table(["Buyer", "Orders", "Units", "Total spent", "Last order"], rows, "No one has bought from you yet."),
  );
}

function renderReviews(data) {
  document.getElementById("rating").textContent = data.seller.review_count > 0
    ? `Seller rating: ${data.seller.avg_rating} / 5 from ${data.seller.review_count} reviews`
    : "No seller reviews yet.";
  const rows = data.reviews.map((r) =>
    el("tr", {},
      el("td", {}, r.kind === "item" ? el("a", { href: `item.html?id=${r.item_id}` }, r.item_name) : "You (seller)"),
      el("td", {}, `${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}`),
      el("td", {}, r.comment),
      el("td", {}, r.reviewer_name),
      el("td", {}, r.updated_at.slice(0, 10)),
    ),
  );
  document.getElementById("reviews").replaceChildren(
    table(["About", "Rating", "Comment", "By", "Date"], rows, "No reviews yet."),
  );
}

async function loadAll() {
  try {
    const [listings, orders, customers, reviews] = await Promise.all([
      api("/api/seller/listings"),
      api("/api/seller/orders?status=pending"),
      api("/api/seller/customers"),
      api("/api/seller/reviews"),
    ]);
    renderListings(listings);
    renderOrders(orders);
    renderCustomers(customers);
    renderReviews(reviews);
  } catch (err) {
    showError(err.message);
  }
}

loadAll();
