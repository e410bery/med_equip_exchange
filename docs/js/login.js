document.getElementById("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  showError("");
  try {
    const { token } = await api("/api/login", {
      method: "POST",
      body: { email: form.email.value, password: form.password.value },
    });
    setToken(token);
    // Only follow relative page names, so ?next= can't send users to another site.
    const next = new URLSearchParams(location.search).get("next") || "";
    location.href = /^[\w-]+\.html(\?.*)?$/.test(next) ? next : "cart.html";
  } catch (err) {
    showError(err.message);
  }
});
