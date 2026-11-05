// Shopping Cart page. Backend: routes/shop.py
//   GET    /api/cart                  -> lines, totals, balance, can_checkout
//   PATCH  /api/cart/items/<item_id>  {quantity}  (0 removes the line)
//   DELETE /api/cart/items/<item_id>
// After every change the cart is re-fetched, so totals and stock warnings
// always come from the server rather than being recalculated here.

let busy = false;

async function loadCart() {
  try {
    const cart = await api("/api/cart");
    render(cart);
  } catch (err) {
    showError(err.message);
  } finally {
    document.getElementById("loading").hidden = true;
  }
}

// Runs one change (update or remove), then reloads the cart.
async function changeCart(request) {
  if (busy) return;
  busy = true;
  showError("");
  document.querySelectorAll("#cart-lines input, #cart-lines button").forEach((n) => (n.disabled = true));
  try {
    await request();
  } catch (err) {
    showError(err.message);
  }
  busy = false;
  await loadCart();
}

function setQuantity(itemId, quantity) {
  return changeCart(() =>
    api(`/api/cart/items/${itemId}`, { method: "PATCH", body: { quantity } }),
  );
}

function removeLine(itemId) {
  return changeCart(() => api(`/api/cart/items/${itemId}`, { method: "DELETE" }));
}

function render(cart) {
  const linesBox = document.getElementById("cart-lines");
  const summary = document.getElementById("summary");

  if (cart.lines.length === 0) {
    summary.hidden = true;
    linesBox.replaceChildren(
      el("div", { class: "card" },
        el("p", {}, "Your cart is empty."),
        el("a", { class: "button", href: "/products" }, "Browse equipment"),
      ),
    );
    return;
  }

  const rows = cart.lines.map((line) => {
    const qty = el("input", {
      class: "cart-qty",
      type: "number",
      min: "0",
      step: "1",
      value: line.quantity,
      "aria-label": `Quantity of ${line.name}`,
      onchange: (event) => {
        const value = Number(event.target.value);
        if (!Number.isInteger(value) || value < 0) {
          showError("Quantity must be a whole number, 0 or more.");
          event.target.value = line.quantity;
          return;
        }
        setQuantity(line.item_id, value);
      },
    });

    return el("tr", { class: line.problem ? "has-problem" : "" },
      el("td", {},
        el("a", { href: `item.html?id=${line.item_id}` }, line.name),
        line.problem ? el("div", { class: "problem" }, `⚠ ${line.problem}`) : null,
      ),
      el("td", {}, line.seller_name),
      el("td", { class: "num" }, money(line.price)),
      el("td", {}, qty, el("div", { class: "muted" }, `${line.stock} in stock`)),
      el("td", { class: "num" }, money(line.line_total)),
      el("td", {},
        el("button", { class: "link", onclick: () => removeLine(line.item_id) }, "Remove"),
      ),
    );
  });

  linesBox.replaceChildren(
    el("div", { class: "card" },
      el("table", {},
        el("thead", {},
          el("tr", {},
            el("th", {}, "Item"),
            el("th", {}, "Seller"),
            el("th", { class: "num" }, "Price"),
            el("th", {}, "Quantity"),
            el("th", { class: "num" }, "Subtotal"),
            el("th", {}),
          ),
        ),
        el("tbody", {}, ...rows),
      ),
    ),
  );

  document.getElementById("item-count").textContent = cart.item_count;
  document.getElementById("total").textContent = money(cart.total);
  document.getElementById("balance").textContent = money(cart.balance);
  const after = document.getElementById("balance-after");
  after.textContent = money(cart.balance_after_checkout);
  after.classList.toggle("negative", Number(cart.balance_after_checkout) < 0);

  // Explain why checkout is unavailable, if it is.
  const reasons = [];
  if (cart.lines.some((line) => line.problem)) {
    reasons.push("Fix the highlighted items before checking out.");
  }
  if (Number(cart.balance_after_checkout) < 0) {
    reasons.push(`Insufficient balance: you need ${money(-cart.balance_after_checkout)} more.`);
  }
  const blocked = document.getElementById("checkout-blocked");
  blocked.textContent = reasons.join(" ");
  blocked.hidden = cart.can_checkout;
  document.getElementById("checkout").classList.toggle("disabled", !cart.can_checkout);

  summary.hidden = false;
}

if (requireLogin()) loadCart();
