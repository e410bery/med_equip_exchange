document.getElementById("register-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const submit = form.querySelector('button[type="submit"]');
    showError("");

    form.elements.email.value = form.elements.email.value.trim();
    if (!form.reportValidity()) return;

    submit.disabled = true;
    try {
      await api("/api/register", {
        method: "POST",
        body: {
          full_name: form.elements.full_name.value.trim(),
          email: form.elements.email.value,
          password: form.elements.password.value,
          address: form.elements.address.value.trim(),
          organization: form.elements.organization.value.trim(),
        },
      });
      // Registration also starts a signed-in session.
      location.href = "/docs/user.html";
    } catch (err) {
      showError(err.message);
    } finally {
      submit.disabled = false;
    }
  });
