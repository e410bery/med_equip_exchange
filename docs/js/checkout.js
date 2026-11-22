// Checkout page. Backend: routes/shop.py and routes/auth.py
//   GET  /api/cart      -> lines, totals, balance, can_checkout
//   GET  /api/me        -> shipping name/organization/address
//   POST /api/checkout  -> {order_id, total, balance}
// Checkout is all-or-nothing on the server: stock, prices and balance are
// re-checked there, so this page only explains problems; it doesn't enforce them.

async function loadCheckout() {
  try {
    const [cart, me] = await Promise.all([api("/api/cart"), api("/api/me")]);
    if (cart.lines.length === 0) {
      showEmpty();
      return;
    }
    renderAddress(me);
    renderLines(cart);
    renderSummary(cart);
    document.getElementById("checkout-layout").hidden = false;
  } catch (err) {
    showError(err.message);
  } finally {
    document.getElementById("loading").hidden = true;
  }
}

function showEmpty() {
  document.getElementById("checkout-layout").replaceWith(
    el("div", { class: "card" },
      el("p", {}, "Your cart is empty, so there's nothing to check out."),
      el("a", { class: "button", href: "/products" }, "Browse equipment"),
    ),
  );
}

function renderAddress(me) {
  document.getElementById("ship-to").replaceChildren(
    el("strong", {}, me.full_name),
    me.organization ? el("div", {}, me.organization) : null,
    el("div", {}, me.address),
  );
}

function renderLines(cart) {
  const rows = cart.lines.map((line) =>
    el("tr", { class: line.problem ? "has-problem" : "" },
      el("td", {},
        el("a", { href: `item.html?id=${line.item_id}` }, line.name),
        line.problem ? el("div", { class: "problem" }, `⚠ ${line.problem}`) : null,
      ),
      el("td", {}, line.seller_name),
      el("td", { class: "num" }, line.quantity),
      el("td", { class: "num" }, money(line.price)),
      el("td", { class: "num" }, money(line.line_total)),
    ),
  );
  document.getElementById("review-lines").replaceChildren(
    el("table", {},
      el("thead", {},
        el("tr", {},
          el("th", {}, "Item"),
          el("th", {}, "Seller"),
          el("th", { class: "num" }, "Qty"),
          el("th", { class: "num" }, "Price"),
          el("th", { class: "num" }, "Subtotal"),
        ),
      ),
      el("tbody", {}, ...rows),
    ),
  );
}

function renderSummary(cart) {
  document.getElementById("item-count").textContent = cart.item_count;
  document.getElementById("total").textContent = money(cart.total);
  document.getElementById("balance").textContent = money(cart.balance);
  const after = document.getElementById("balance-after");
  after.textContent = money(cart.balance_after_checkout);
  after.classList.toggle("negative", Number(cart.balance_after_checkout) < 0);

  const blocked = document.getElementById("checkout-blocked");
  const reasons = [];
  if (cart.lines.some((line) => line.problem)) {
    reasons.push("Some items need attention.");
  }
  if (Number(cart.balance_after_checkout) < 0) {
    reasons.push(`Insufficient balance: you need ${money(-cart.balance_after_checkout)} more.`);
  }
  const links = [];
  if (cart.lines.some((line) => line.problem)) links.push(el("a", { href: "cart.html" }, "Update your cart"));
  if (Number(cart.balance_after_checkout) < 0) links.push(el("a", { href: "add_funds.html" }, "Add funds"));
  blocked.replaceChildren(reasons.join(" "), ...links.flatMap((link) => [" ", link]));
  blocked.hidden = cart.can_checkout;
  document.getElementById("place-order").disabled = !cart.can_checkout;
}

async function placeOrder() {
  const button = document.getElementById("place-order");
  button.disabled = true;
  button.textContent = "Placing order…";
  showError("");
  try {
    const result = await api("/api/checkout", { method: "POST" });
    // replace() so the Back button doesn't return to a checkout page for an empty cart.
    location.replace(`order.html?id=${result.order_id}&placed=1`);
  } catch (err) {
    // Stock or balance may have changed since the page loaded; show the latest cart.
    showError(err.message);
    button.textContent = "Place order";
    await loadCheckout();
  }
}

document.getElementById("place-order").addEventListener("click", placeOrder);
loadCheckout();
