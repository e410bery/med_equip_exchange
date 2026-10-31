// Placeholder item page: shows the basics and an Add to cart button.
const itemId = new URLSearchParams(location.search).get("id");

async function loadItem() {
  try {
    const item = await api(`/api/items/${encodeURIComponent(itemId)}`);
    document.title = `${item.name} · Med Equip Exchange`;
    const qty = el("input", { type: "number", min: "1", max: item.quantity, value: "1", class: "cart-qty" });
    const addButton = el("button", {
      disabled: item.quantity === 0,
      onclick: async () => {
        if (!requireLogin()) return;
        showError("");
        try {
          await api("/api/cart/items", {
            method: "POST",
            body: { item_id: item.id, quantity: Number(qty.value) },
          });
          const added = document.getElementById("added");
          added.replaceChildren("Added to your cart. ", el("a", { href: "cart.html" }, "View cart"));
          added.hidden = false;
        } catch (err) {
          showError(err.message);
        }
      },
    }, item.quantity === 0 ? "Out of stock" : "Add to cart");

    document.getElementById("item").replaceChildren(
      el("h1", {}, item.name),
      el("p", { class: "muted" }, `${item.manufacturer} ${item.model || ""} · ${item.condition} · ${item.location}`),
      el("p", {}, item.description),
      el("p", {}, el("strong", {}, money(item.price)), ` · ${item.quantity} in stock · sold by ${item.seller.full_name}`),
      el("p", {}, "Quantity ", qty, " ", addButton),
    );
  } catch (err) {
    showError(err.message);
  }
}

loadItem();
