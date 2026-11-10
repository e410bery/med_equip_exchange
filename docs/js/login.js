document.getElementById("login-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();

    const form = event.target;

    showError("");

    try {
      // Flask sets the session cookie after successful login.
      await api("/api/login", {
        method: "POST",

        body: {
          email: form.email.value,
          password: form.password.value,
        },
      });

      const next = new URLSearchParams(
        location.search
      ).get("next");

      let destination = "/docs/cart.html";

      if (next) {
        const target = new URL(
          next,
          location.origin
        );

        // Only return to known frontend pages on this site.
        const allowedPaths = new Set([
          "/",
          "/products",
          "/docs/index.html",
          "/docs/cart.html",
          "/docs/item.html",
          "/docs/user.html",
          "/docs/orders.html",
          "/docs/add_funds.html",
        ]);

        if (
          target.origin === location.origin &&
          allowedPaths.has(target.pathname)
        ) {
          destination =
            target.pathname + target.search;
        }
      }

      location.href = destination;
    } catch (err) {
      showError(err.message);
    }
  });
