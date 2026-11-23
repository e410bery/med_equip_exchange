async function loadComparison() {
  const ids = new URLSearchParams(location.search).get("ids") || "";

  try {
    const params = new URLSearchParams({ ids });
    const items = await api(`/api/compare?${params}`);

    const fields = [
      ["Manufacturer", (item) => item.manufacturer],
      ["Model", (item) => item.model],
      ["Category", (item) => item.category],
      ["Description", (item) => item.description],
      ["Specifications", (item) => item.specifications],
      ["Condition", (item) => item.condition],
      ["Location", (item) => item.location],
      ["Price", (item) => money(item.price)],
      ["Available quantity", (item) => item.quantity],
      [
        "Seller",
        (item) => el(
          "a",
          { href: `/docs/seller_profile.html?id=${item.seller_id}` },
          item.seller_name
        ),
      ],
      [
        "Rating",
        (item) =>
          item.avg_rating == null
            ? "No ratings"
            : `${item.avg_rating}/5 (${item.review_count} reviews)`,
      ],
      ["Valid certifications", (item) => item.valid_certifications],
      ["Last maintenance", (item) => item.last_maintenance],
      [
        "Rental rate / day",
        (item) =>
          item.rental_rate == null
            ? "Not available"
            : money(item.rental_rate),
      ],
    ];

    const rows = fields.map(([label, value]) =>
      el(
        "tr",
        {},
        el("th", { scope: "row" }, label),
        ...items.map((item) =>
          el("td", { class: "pre-wrap" }, value(item) ?? "Not recorded")
        )
      )
    );

    document.getElementById("comparison").replaceChildren(
      el(
        "table",
        {},
        el("caption", {}, "Selected equipment attributes"),
        el(
          "thead",
          {},
          el(
            "tr",
            {},
            el("th", { scope: "col" }, "Attribute"),
            ...items.map((item) =>
              el(
                "th",
                { scope: "col" },
                el(
                  "a",
                  { href: `/docs/item.html?id=${item.id}` },
                  item.name
                )
              )
            )
          )
        ),
        el("tbody", {}, ...rows)
      )
    );
  } catch (err) {
    showError(err.message);
  }
}

loadComparison();