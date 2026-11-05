// Shared helpers for pages served by the Flask application.
// The backend authenticates requests with its session cookie.

async function api(
  path,
  { method = "GET", body } = {}
) {
  const headers = {};

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let response;

  try {
    response = await fetch(path, {
      method,
      headers,
      credentials: "same-origin",
      body:
        body === undefined
          ? undefined
          : JSON.stringify(body),
    });
  } catch {
    throw new Error(
      "Cannot reach the server. Is Flask running?"
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (
      response.status === 401 &&
      path !== "/api/login" &&
      path !== "/api/me"
    ) {
      goToLogin();
    }

    throw new Error(
      data.error ||
      `Request failed (${response.status})`
    );
  }

  return data;
}


function goToLogin() {
  const next = location.pathname + location.search;

  location.href =
    "/docs/login.html?next=" +
    encodeURIComponent(next);
}


function requireLogin() {
  // The server checks the session cookie.
  // A protected API request redirects to login on HTTP 401.
  return true;
}


function money(value) {
  return Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}


function el(tag, attrs = {}, ...children) {
  const element = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") {
      element.className = value;
    } else if (key.startsWith("on")) {
      element.addEventListener(
        key.slice(2),
        value
      );
    } else if (value === true) {
      element.setAttribute(key, "");
    } else if (
      value !== false &&
      value != null
    ) {
      element.setAttribute(key, value);
    }
  }

  for (const child of children) {
    if (child != null) {
      element.append(child);
    }
  }

  return element;
}


function showError(message) {
  const banner = document.getElementById("error");

  if (!banner) {
    return;
  }

  banner.textContent = message;
  banner.hidden = !message;
}


async function setUpHeader() {
  const slot = document.getElementById("account");

  if (!slot) {
    return;
  }

  // Default header for guests.
  slot.replaceChildren(
    el(
      "a",
      { href: "/docs/login.html" },
      "Log in"
    )
  );

  try {
    const user = await api("/api/me");

    const logout = el(
      "a",
      { href: "#" },
      "Log out"
    );

    logout.addEventListener("click", async (event) => {
      event.preventDefault();

      try {
        await api("/api/logout", {
          method: "POST",
        });

        location.href = "/";
      } catch (err) {
        showError(err.message);
      }
    });

    slot.replaceChildren(
      el(
        "span",
        { class: "muted" },
        `${user.full_name} · ${money(user.balance)}`
      ),

      " ",

      logout
    );
  } catch {
    // Guests receive HTTP 401 from /api/me.
    // Keep the Log in link visible.
  }
}


document.addEventListener(
  "DOMContentLoaded",
  setUpHeader
);