const itemParams = new URLSearchParams(location.search);
const itemId = itemParams.get("id");
const returnOrderId = itemParams.get("order_id");

if (returnOrderId && /^\d+$/.test(returnOrderId)) {
  const back = document.getElementById("back-order");
  back.href = `/docs/order.html?id=${returnOrderId}`;
  back.hidden = false;
}

function rentalAvailabilityForm(item) {
  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const start = el("input", { type: "date", name: "start_date", required: true, min: localToday });
  const end = el("input", { type: "date", name: "end_date", required: true, min: localToday });
  const check = el("button", { type: "submit" }, "Check availability");
  const result = el("p", { role: "status", "aria-live": "polite", hidden: true });
  const book = el("button", { type: "button", hidden: true, disabled: true }, "Book rental");
  const form = el("form", { class: "stacked" },
    el("label", {}, "Start date", start),
    el("label", {}, "End date", end),
    el("small", { class: "muted" }, "Both dates count toward the price. Maximum 365 days."),
    check,
    result,
    book,
    el("small", { class: "muted" }, "Booking charges the total to your account balance."),
  );
  let version = 0;
  let quotedDates = null;
  let booking = false;
  form.addEventListener("input", () => {
    version++;
    quotedDates = null;
    book.hidden = true;
    book.disabled = true;
    result.hidden = true;
    end.min = start.value || localToday;
    end.setCustomValidity("");
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (check.disabled || booking) return;
    quotedDates = null;
    book.hidden = true;
    book.disabled = true;
    end.setCustomValidity("");
    if (!form.reportValidity()) return;
    const days = (Date.parse(end.value) - Date.parse(start.value)) / 86400000 + 1;
    if (days < 1 || days > 365) {
      end.setCustomValidity("Choose an end date on or after the start date, within 365 days.");
      form.reportValidity();
      return;
    }
    const requestVersion = ++version;
    result.hidden = true;
    check.disabled = true;
    check.textContent = "Checking...";
    try {
      const dates = new URLSearchParams({ start_date: start.value, end_date: end.value });
      const quote = await api(`/api/items/${item.id}/availability?${dates}`);
      if (requestVersion !== version) return;
      result.className = quote.available ? "" : "negative";
      result.textContent = quote.available
        ? `Available for ${quote.days} day${quote.days === 1 ? "" : "s"} at ${money(quote.daily_rate)}/day. Total: ${money(quote.total_price)}.`
        : "No rental units are available for those dates. Try different dates.";
      result.hidden = false;
      if (quote.available) {
        quotedDates = { start_date: start.value, end_date: end.value };
        book.hidden = false;
        book.disabled = false;
      }
    } catch (err) {
      if (requestVersion !== version) return;
      result.className = "negative";
      result.textContent = err.message;
      result.hidden = false;
    } finally {
      check.disabled = false;
      check.textContent = "Check availability";
    }
  });
  book.addEventListener("click", async () => {
    if (booking || !quotedDates || book.disabled) return;
    booking = true;
    book.disabled = check.disabled = start.disabled = end.disabled = true;
    book.textContent = "Booking...";
    try {
      const rental = await api(`/api/items/${item.id}/rentals`, {
        method: "POST",
        body: quotedDates,
      });
      result.className = "";
      result.textContent = `Rental #${rental.id} confirmed: ${rental.start_date} through ${rental.end_date}. Total paid: ${money(rental.total_price)}.`;
      result.append(" ", el("a", { href: "/docs/rentals.html" }, "View my rentals"));
      quotedDates = null;
      book.hidden = true;
      await setUpHeader();
    } catch (err) {
      result.className = "negative";
      result.textContent = err.message;
      // Require another availability check before retrying a failed booking.
      quotedDates = null;
      book.hidden = true;
    } finally {
      result.hidden = false;
      booking = false;
      check.disabled = start.disabled = end.disabled = false;
      book.textContent = "Book rental";
    }
  });
  return el("section", { class: "rental-availability" },
    el("h2", {}, "Rent this equipment"),
    el("p", {}, `${money(item.rental_rate)} per day`),
    form,
  );
}

async function loadItem() {
  if (!itemId || !/^[1-9]\d*$/.test(itemId)) {
    showError("Choose an item from the equipment catalog.");
    return;
  }

  try {
    showError("");

    const item = await api(`/api/items/${itemId}`);
    document.title = `${item.name} · MedEquip Exchange`;

    const quantity = el("input", {
      type: "number",
      min: "1",
      max: String(item.quantity),
      step: "1",
      value: "1",
      required: true,
      disabled: item.quantity <= 0 || !item.is_active,
    });

    const add = el(
      "button",
      {
        type: "submit",
        disabled: item.quantity <= 0 || !item.is_active,
      },
      item.quantity <= 0 || !item.is_active
        ? "Unavailable"
        : "Add to cart"
    );

    const purchase = el(
      "form",
      { class: "stacked" },
      el("label", {}, "Quantity", quantity),
      add
    );

    purchase.addEventListener("submit", async (event) => {
      event.preventDefault();
      showError("");
      add.disabled = true;

      try {
        await api("/api/cart/items", {
          method: "POST",
          body: {
            item_id: item.id,
            quantity: Number(quantity.value),
          },
        });

        const added = document.getElementById("added");
        added.replaceChildren(
          "Added to your cart. ",
          el("a", { href: "/docs/cart.html" }, "View cart")
        );
        added.hidden = false;
      } catch (err) {
        showError(err.message);
      } finally {
        add.disabled = item.quantity <= 0 || !item.is_active;
      }
    });

    const sellerParams = new URLSearchParams({
      id: item.seller.id,
    });

    if (returnOrderId && /^\d+$/.test(returnOrderId)) {
      sellerParams.set("order_id", returnOrderId);
    }

    document.getElementById("item").replaceChildren(
      el("h1", {}, item.name),
      el(
          "p",
          { class: "muted" },
          `Listing #${item.id} · ${item.category} · ` +
          `${item.manufacturer} ${item.model || ""}`
      ),
      el("p", {}, `${item.condition} · ${item.location}`),
      el("p", {}, item.description),
      el("h2", {}, "Specifications"),
      el(
        "p",
        { class: "pre-wrap" },
        item.specifications || "No specifications recorded."
      ),
      el(
        "p",
        {},
        el("strong", {}, money(item.price)),
        ` · ${item.quantity} in stock`
      ),
      el(
        "p",
        {},
        "Sold by ",
        el(
          "a",
          { href: `/docs/seller_profile.html?${sellerParams}` },
          item.seller.full_name
        )
      ),
      el(
        "p",
        {},
        item.avg_rating == null
          ? "No equipment ratings yet."
          : `${item.avg_rating}/5 · ${item.review_count} reviews`
      ),
      purchase,
      item.is_active && item.rental_units > 0
        ? rentalAvailabilityForm(item)
        : el("p", { class: "muted" }, "Item unavailable to be rented")
    );

    const records = document.getElementById("records");
    records.replaceChildren(el("h2", {}, "Maintenance history"));

    if (!item.maintenance.length) {
      records.append(el("p", {}, "No maintenance records."));
    }

    for (const record of item.maintenance) {
      records.append(
        el(
          "p",
          {},
          `${record.performed_on}: ${record.description} · ` +
          `Performed by: ${record.performed_by || "Not recorded"} · ` +
          `Next due: ${record.next_due || "Not recorded"}`,
          record.overdue
            ? el("strong", { class: "negative" }, " · OVERDUE")
            : null
        )
      );
    }

    records.append(el("h2", {}, "Certifications"));

    if (!item.certifications.length) {
      records.append(el("p", {}, "No certifications."));
    }

    for (const cert of item.certifications) {
      records.append(
        el(
          "p",
          {},
          `${cert.name} · ${cert.issuer} · ` +
          `Issued ${cert.issued_on} · Expires ${cert.expires_on} · `,
          el(
            "strong",
            { class: cert.status === "expired" ? "negative" : "" },
            cert.status.replaceAll("_", " ")
          )
        )
      );
    }

    renderReviews(
      document.getElementById("reviews"),
      item,
      `/api/items/${item.id}/review`,
      loadItem,
      "Equipment"
    );

    const related = document.getElementById("related");
    related.replaceChildren(el("h2", {}, "Related listings"));

    if (!item.related.length) {
      related.append(el("p", {}, "No related listings."));
    }

    for (const listing of item.related) {
      related.append(
        el(
          "p",
          {},
          el(
            "a",
            { href: `/docs/item.html?id=${listing.id}` },
            listing.name
          ),
          ` · ${listing.seller_name} · ${money(listing.price)}`
        )
      );
    }
  } catch (err) {
    showError(err.message);
  }
}

loadItem();
