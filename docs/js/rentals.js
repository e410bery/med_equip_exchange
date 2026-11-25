async function loadRentals() {
  try {
    const rentals = await api("/api/rentals");
    document.getElementById("empty").hidden = rentals.length !== 0;
    const statuses = { upcoming: "Upcoming", active: "Active", past: "Past" };
    document.getElementById("rentals").replaceChildren(...rentals.map((rental) =>
      el("li", { class: "card" },
        el("h2", {}, el("a", { href: `item.html?id=${rental.item_id}` }, rental.name)),
        el("p", {},
          el("span", { class: `badge ${rental.status === "active" ? "ok" : "pending"}` }, statuses[rental.status] || rental.status),
          ` · Rental #${rental.id}`),
        el("p", {}, "Seller: ", el("a", { href: `seller_profile.html?id=${rental.seller_id}` }, rental.seller_name)),
        el("p", {}, "Dates: ",
          el("time", { datetime: rental.start_date }, rental.start_date),
          " through ", el("time", { datetime: rental.end_date }, rental.end_date)),
        el("p", {}, `Daily rate: ${money(rental.daily_rate)} · Total paid: ${money(rental.total_price)}`),
      ),
    ));
  } catch (err) {
    showError(err.message);
  } finally {
    document.getElementById("loading").hidden = true;
  }
}

loadRentals();
