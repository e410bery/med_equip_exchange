// Shared item and seller review controls.
function renderReviews(container, data, endpoint, reload, subject) {
  container.replaceChildren(
    el("h2", {}, `${subject} reviews`),
    el(
      "p",
      {},
      data.avg_rating == null
        ? "No ratings yet."
        : `${data.avg_rating}/5 · ${data.review_count} reviews`
    )
  );

  for (const review of data.reviews) {
    container.append(
      el(
        "article",
        {},
        el(
          "p",
          {},
          el("strong", {}, `${review.rating}/5`),
          ` · ${review.reviewer_name}`
        ),
        el("p", { class: "pre-wrap" }, review.comment)
      )
    );
  }

  const viewer = data.viewer;

  if (!viewer) {
    const next = location.pathname + location.search;

    container.append(
      el("p", {}, "Reviews are available to buyers who purchased."),
      el(
        "a",
        {
          href:
            "/docs/login.html?next=" +
            encodeURIComponent(next),
        },
        "Log in with a buyer account"
      )
    );
    return;
  }

  if (!viewer.can_review) {
    container.append(
      el("p", {}, "You must purchase before writing this review.")
    );
    return;
  }

  const existing = data.reviews.find(
    (review) => review.id === viewer.my_review_id
  );

  const rating = el("select", { required: true });

  for (let value = 1; value <= 5; value++) {
    rating.append(el("option", { value }, `${value}/5`));
  }

  rating.value = String(existing ? existing.rating : 5);

  const comment = el("textarea", {
    rows: "4",
    maxlength: "2000",
  });

  comment.value = existing ? existing.comment : "";

  const save = el(
    "button",
    { type: "submit" },
    existing ? "Save changes" : "Submit review"
  );

  const remove = el(
    "button",
    { type: "button", class: "secondary" },
    "Delete my review"
  );

  const message = el("p", { role: "status" });

  const form = el(
    "form",
    { class: "stacked" },
    el("h3", {}, existing ? "Edit your review" : "Write a review"),
    el("label", {}, "Rating", rating),
    el("label", {}, "Comment", comment),
    save,
    existing ? remove : null,
    message
  );

  async function submit(method) {
    save.disabled = true;
    remove.disabled = true;
    message.textContent = "";

    try {
      await api(endpoint, {
        method,
        body:
          method === "PUT"
            ? {
                rating: Number(rating.value),
                comment: comment.value,
              }
            : undefined,
      });

      await reload();
    } catch (err) {
      message.textContent = err.message;
    } finally {
      save.disabled = false;
      remove.disabled = false;
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submit("PUT");
  });

  remove.addEventListener("click", () => {
    submit("DELETE");
  });

  container.append(form);
}