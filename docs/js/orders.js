async function loadOrders() {
  try {
    const orders = await api("/api/orders");
    document.getElementById("empty").hidden = orders.length !== 0;
    document.getElementById("orders").replaceChildren(...orders.map((order) =>
      el("li", { class: "card" },
        el("h2", {}, el("a", { href: `order.html?id=${order.id}` }, `Order #${order.id}`)),
        el("p", { class: "muted" }, "Placed ",
          el("time", { datetime: order.placed_at }, new Date(order.placed_at).toLocaleString())),
        el("p", {}, `${order.item_count} item${Number(order.item_count) === 1 ? "" : "s"} · Total: ${money(order.total)}`),
        el("p", {}, order.is_complete ? "Fulfilled" :
          `Awaiting fulfillment (${order.fulfilled_count} of ${order.line_count} order lines fulfilled)`),
        el("a", { href: `order.html?id=${order.id}` }, "View order details"),
      ),
    ));
  } catch (err) {
    showError(err.message);
  } finally {
    document.getElementById("loading").hidden = true;
  }
}

loadOrders();
