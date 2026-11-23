const sellerParams = new URLSearchParams(location.search);
const sellerId = sellerParams.get("id");
const sellerOrderId = sellerParams.get("order_id");

if (sellerOrderId && /^\d+$/.test(sellerOrderId)) {
  const back = document.getElementById("back-order");
  back.href = `/docs/order.html?id=${sellerOrderId}`;
  back.hidden = false;
}

async function loadSeller() {
  if (!sellerId || !/^[1-9]\d*$/.test(sellerId)) {
    showError("Choose a seller from an item page.");
    return;
  }

  try {
    showError("");

    const seller = await api(`/api/sellers/${sellerId}`);
    document.title = `${seller.full_name} · MedEquip Exchange`;

    document.getElementById("seller-profile").replaceChildren(
      el("h1", {}, seller.full_name),
      el("p", {}, `Seller #${seller.id}`),
      el("p", {}, seller.organization || "No organization listed."),
      el(
        "p",
        {},
        seller.avg_rating == null
          ? "No seller ratings yet."
          : `${seller.avg_rating}/5 · ${seller.review_count} reviews`
      )
    );

    renderReviews(
      document.getElementById("seller-reviews"),
      seller,
      `/api/sellers/${seller.id}/review`,
      loadSeller,
      "Seller"
    );

    const listings = document.getElementById("seller-listings");
    listings.replaceChildren(el("h2", {}, "Active listings"));

    if (!seller.listings.length) {
      listings.append(el("p", {}, "No active listings."));
    }

    for (const item of seller.listings) {
      listings.append(
        el(
          "p",
          {},
          el(
            "a",
            { href: `/docs/item.html?id=${item.id}` },
            item.name
          ),
          ` · ${item.condition} · ${money(item.price)} · ` +
          `${item.quantity} in stock · ${item.location}`
        )
      );
    }
  } catch (err) {
    showError(err.message);
  }
}

loadSeller();