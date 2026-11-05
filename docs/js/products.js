// Requests use the same Flask origin as the page.
const form = document.querySelector("#filters");
const results = document.querySelector("#results");
const error = document.querySelector("#error");
const summary = document.querySelector("#summary");
const dialog = document.querySelector("#detail");

let page = 1;
let pages = 0;
let requestNumber = 0;
let detailNumber = 0;


function currency(value) {
  return Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}


function node(tag, text, className) {
  const element = document.createElement(tag);

  // Database values are displayed as text, not interpreted as HTML.
  if (text !== undefined) {
    element.textContent = text;
  }

  if (className) {
    element.className = className;
  }

  return element;
}


async function api(path) {
  const response = await fetch(path, {
    credentials: "same-origin",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || `Request failed (${response.status})`
    );
  }

  return data;
}


function parameters() {
  const params = new URLSearchParams(
    new FormData(form)
  );

  // Empty fields should not become active filters.
  for (const [key, value] of [...params]) {
    if (!value) {
      params.delete(key);
    }
  }

  params.set("page", page);

  return params;
}


function pagination() {
  document.querySelector("#previous").disabled =
    page <= 1;

  document.querySelector("#next").disabled =
    page >= pages;

  document.querySelector("#page").textContent =
    pages ? `Page ${page} of ${pages}` : "No pages";
}


async function load() {
  const current = ++requestNumber;

  error.hidden = true;
  results.replaceChildren();

  summary.textContent = "Loading equipment…";

  document.querySelector("#previous").disabled = true;
  document.querySelector("#next").disabled = true;

  const params = parameters();

  // Save filters in the URL so refreshing preserves the search.
  history.replaceState(
    null,
    "",
    `/products?${params}`
  );

  try {
    const data = await api(
      `/api/products?${params}`
    );

    // Ignore an older request that finished after a newer one.
    if (current !== requestNumber) {
      return;
    }

    pages = data.total_pages;

    summary.textContent =
      `${data.total} matching listing` +
      (data.total === 1 ? "" : "s");

    if (!data.items.length) {
      results.append(
        node(
          "p",
          "No equipment on this page. " +
          "Try fewer filters or the previous page."
        )
      );
    }

    for (const item of data.items) {
      const card = node(
        "article",
        undefined,
        "product"
      );

      const details = node(
        "button",
        "View equipment details"
      );

      details.type = "button";

      details.addEventListener("click", () => {
        showDetail(item.id);
      });

      const stockText =
        item.quantity > 0
          ? `${item.quantity} available`
          : "Out of stock";

      const ratingText =
        item.avg_rating == null
          ? "No reviews yet"
          : `${item.avg_rating}/5 · ` +
            `${item.review_count} reviews`;

      card.append(
        node("span", item.category, "badge"),

        node("h2", item.name),

        node(
          "p",
          `${item.manufacturer} · ` +
          `${item.model || "Model not recorded"}`,
          "muted"
        ),

        node(
          "p",
          currency(item.price),
          "price"
        ),

        node(
          "p",
          `Seller: ${item.seller_name}`
        ),

        node(
          "p",
          `Condition: ${item.condition}`
        ),

        node(
          "p",
          `Location: ${item.location}`
        ),

        node("p", stockText),

        node(
          "p",
          ratingText,
          "muted"
        ),

        details
      );

      results.append(card);
    }

    pagination();
  } catch (err) {
    if (current !== requestNumber) {
      return;
    }

    error.textContent = err.message;
    error.hidden = false;

    summary.textContent =
      "Equipment could not be loaded.";
  }
}


async function showDetail(id) {
  const current = ++detailNumber;

  const content = document.querySelector(
    "#detail-content"
  );

  const heading = node(
    "h2",
    "Loading details…"
  );

  heading.id = "detail-title";

  content.replaceChildren(heading);

  if (!dialog.open) {
    dialog.showModal();
  }

  try {
    const item = await api(`/api/items/${id}`);

    if (
      current !== detailNumber ||
      !dialog.open
    ) {
      return;
    }

    heading.textContent = item.name;

    content.replaceChildren(
      heading,

      node(
        "p",
        `Listing #${item.id} · ` +
        `${item.category} · ` +
        `${item.manufacturer} ${item.model || ""}`
      ),

      node(
        "p",
        `${currency(item.price)} · ` +
        `${item.quantity} in stock · ` +
        `${item.condition} · ${item.location}`
      ),

      node(
        "p",
        `Seller: ${item.seller.full_name} ` +
        `(#${item.seller.id})`
      ),

      node("p", item.description),

      node("h3", "Specifications"),

      node(
        "pre",
        item.specifications ||
        "No specifications recorded."
      )
    );

    // Purchasing controls.
    const purchaseForm = node("form");
    purchaseForm.className = "stacked";

    const quantityLabel = node(
      "label",
      "Quantity"
    );

    const quantity = node("input");
    quantity.type = "number";
    quantity.min = "1";
    quantity.max = String(item.quantity);
    quantity.step = "1";
    quantity.value = "1";
    quantity.required = true;

    quantityLabel.append(quantity);

    const addButton = node(
      "button",
      item.quantity > 0
        ? "Add to cart"
        : "Out of stock"
    );

    addButton.type = "submit";

    quantity.disabled = item.quantity <= 0;
    addButton.disabled = item.quantity <= 0;

    const message = node("p");
    message.setAttribute("role", "status");
    message.setAttribute("aria-live", "polite");

    purchaseForm.append(
      quantityLabel,
      addButton,
      message
    );

    purchaseForm.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        if (!purchaseForm.reportValidity()) {
          return;
        }

        const amount = Number(quantity.value);

        if (
          !Number.isInteger(amount) ||
          amount < 1 ||
          amount > item.quantity
        ) {
          message.textContent =
            "Enter a valid quantity within available stock.";
          return;
        }

        addButton.disabled = true;
        message.textContent = "Adding to cart…";

        try {
          const response = await fetch(
            "/api/cart/items",
            {
              method: "POST",

              credentials: "same-origin",

              headers: {
                "Content-Type": "application/json",
              },

              body: JSON.stringify({
                item_id: item.id,
                quantity: amount,
              }),
            }
          );

          if (response.status === 401) {
            // Log in, then return to this products search.
            const next =
              location.pathname + location.search;

            location.href =
              "/docs/login.html?next=" +
              encodeURIComponent(next);

            return;
          }

          const data = await response.json();

          if (!response.ok) {
            throw new Error(
              data.error || "Could not add this item."
            );
          }

          const cartLink = node(
            "a",
            "View cart"
          );

          cartLink.href = "/docs/cart.html";

          message.replaceChildren(
            "Added to your cart. ",
            cartLink
          );
        } catch (err) {
          message.textContent = err.message;
        } finally {
          addButton.disabled = item.quantity <= 0;
        }
      }
    );

    content.append(
      node("h3", "Purchase"),
      purchaseForm
    );

    // Maintenance records.
    content.append(
      node("h3", "Maintenance history")
    );

    if (!item.maintenance.length) {
      content.append(
        node("p", "No maintenance records on file.")
      );
    }

    for (const record of item.maintenance) {
      content.append(
        node(
          "p",
          `${record.performed_on}: ` +
          `${record.description} · ` +
          `Performed by: ${
            record.performed_by || "Not recorded"
          } · ` +
          `Next due: ${
            record.next_due || "Not recorded"
          }` +
          (record.overdue ? " · OVERDUE" : "")
        )
      );
    }

    // Certification records.
    content.append(
      node("h3", "Certifications")
    );

    if (!item.certifications.length) {
      content.append(
        node("p", "No certifications on file.")
      );
    }

    for (const cert of item.certifications) {
      content.append(
        node(
          "p",
          `${cert.name} · ${cert.issuer} · ` +
          `Issued ${cert.issued_on} · ` +
          `Expires ${cert.expires_on} · ` +
          cert.status.replaceAll("_", " "),

          cert.status === "expired"
            ? "expired"
            : ""
        )
      );
    }

    // Equipment reviews.
    content.append(
      node("h3", "Equipment reviews")
    );

    if (!item.reviews.length) {
      content.append(
        node("p", "No reviews yet.")
      );
    }

    for (const review of item.reviews) {
      content.append(
        node(
          "p",
          `${review.rating}/5 · ` +
          `${review.reviewer_name}: ` +
          review.comment
        )
      );
    }
  } catch (err) {
    if (
      current === detailNumber &&
      dialog.open
    ) {
      heading.textContent = "Details unavailable";

      content.replaceChildren(
        heading,
        node("p", err.message)
      );
    }
  }
}


document.querySelector("#close-detail")
  .addEventListener("click", () => {
    dialog.close();
  });


form.addEventListener("submit", (event) => {
  event.preventDefault();

  page = 1;

  load();
});


form.addEventListener("reset", () => {
  // Wait until the browser has reset the form values.
  setTimeout(() => {
    page = 1;

    load();
  }, 0);
});


for (const key of ["sort", "per_page"]) {
  form.elements[key].addEventListener(
    "change",
    () => {
      if (!form.reportValidity()) {
        return;
      }

      page = 1;

      load();
    }
  );
}


document.querySelector("#previous")
  .addEventListener("click", () => {
    page--;

    load();
  });


document.querySelector("#next")
  .addEventListener("click", () => {
    page++;

    load();
  });


async function start() {
  try {
    const filters = await api(
      "/api/filters"
    );

    const filterKeys = {
      category_id: "categories",
      manufacturer_id: "manufacturers",
      condition: "conditions",
      location: "locations",
    };

    for (const key of Object.keys(filterKeys)) {
      const values = filters[
        filterKeys[key]
      ];

      for (const value of values) {
        const isObject =
          typeof value === "object";

        const option = node(
          "option",
          isObject ? value.name : value
        );

        option.value =
          isObject ? value.id : value;

        form.elements[key].append(option);
      }
    }

    // Restore a search when the page is refreshed.
    const saved = new URLSearchParams(
      location.search
    );

    for (const [key, value] of saved) {
      const field = form.elements[key];

      if (!field) {
        continue;
      }

      if (field.type === "checkbox") {
        field.checked = value === "1";
      } else {
        field.value = value;
      }
    }

    page = Math.max(
      1,
      Number.parseInt(
        saved.get("page"),
        10
      ) || 1
    );

    await load();
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
  }
}


start();