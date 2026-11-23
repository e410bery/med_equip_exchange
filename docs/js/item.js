const itemParams = new URLSearchParams(location.search);
const itemId = itemParams.get("id");
const returnOrderId = itemParams.get("order_id");

if (returnOrderId && /^\d+$/.test(returnOrderId)) {
  const back = document.getElementById("back-order");
  back.href = `/docs/order.html?id=${returnOrderId}`;
  back.hidden = false;
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
      purchase
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