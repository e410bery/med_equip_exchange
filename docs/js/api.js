// Shared helpers for every page. Load this before a page's own script.

// Where the Flask API lives. Locally it's `python app.py`; once the backend is
// deployed (e.g. on Render), put its URL in DEPLOYED_API_BASE.
const DEPLOYED_API_BASE = "https://YOUR-APP.onrender.com";
const API_BASE = ["localhost", "127.0.0.1"].includes(location.hostname)
  ? "http://127.0.0.1:5000"
  : DEPLOYED_API_BASE;

const TOKEN_KEY = "medEquipToken";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// Call the API: api("/api/cart"), api("/api/cart/items", {method: "POST", body: {...}}).
// Returns the parsed JSON, or throws an Error whose message is the API's "error" text.
async function api(path, { method = "GET", body } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(API_BASE + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error(`Can't reach the server at ${API_BASE}. Is the backend running?`);
  }

  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && path !== "/api/login") {
    // Not logged in, or the token expired: send the user to log in, then back here.
    clearToken();
    goToLogin();
  }
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

function goToLogin() {
  const next = location.pathname.split("/").pop() + location.search;
  location.href = `login.html?next=${encodeURIComponent(next)}`;
}

// Call at the top of pages that need a logged-in user.
function requireLogin() {
  if (!getToken()) {
    goToLogin();
    return false;
  }
  return true;
}

// "1234.5" -> "$1,234.50"
function money(value) {
  return Number(value).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// Build an element without innerHTML, so text from the database is never
// interpreted as HTML. el("a", {href: "x.html"}, "link text", childElement)
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (value === true) node.setAttribute(key, "");
    else if (value !== false && value != null) node.setAttribute(key, value);
  }
  for (const child of children) {
    if (child != null) node.append(child);
  }
  return node;
}

function showError(message) {
  const banner = document.getElementById("error");
  banner.textContent = message;
  banner.hidden = !message;
}

// Fills in the shared header's login/logout link on every page.
async function setUpHeader() {
  const slot = document.getElementById("account");
  if (!slot) return;
  if (!getToken()) {
    slot.replaceChildren(el("a", { href: "login.html" }, "Log in"));
    return;
  }
  try {
    const me = await api("/api/me");
    slot.replaceChildren(
      el("span", { class: "muted" }, `${me.full_name} · ${money(me.balance)}`),
      " ",
      el("a", {
        href: "#",
        onclick: async (event) => {
          event.preventDefault();
          await api("/api/logout", { method: "POST" }).catch(() => {});
          clearToken();
          location.href = "login.html";
        },
      }, "Log out"),
    );
  } catch {
    // api() already redirects to login on 401; ignore other errors here.
  }
}

document.addEventListener("DOMContentLoaded", setUpHeader);
