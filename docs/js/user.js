let currentUser;
const profileForm = document.getElementById("profile-form");
const editButton = document.getElementById("edit-profile");
const cancelButton = document.getElementById("cancel-profile");
const saveButton = document.getElementById("save-profile");
const profileStatus = document.getElementById("profile-status");

function renderProfile(user) {
    currentUser = user;
    document.getElementById("user-name").textContent = user.full_name;
    const fields = [
      ["Email", user.email],
      ["Organization", user.organization || "Not provided"],
      ["Address", user.address || "Not provided"],
      ["Balance", el("span", { class: "profile-balance" }, money(user.balance),
        el("a", { class: "button button-small", href: "add_funds.html" }, "Add funds"))],
      ["Member since", new Date(user.created_at).toLocaleDateString()],
    ];
    document.getElementById("profile-info").replaceChildren(
      ...fields.map(([label, value]) => el("div", { class: "profile-row" },
        el("dt", {}, el("strong", {}, `${label}:`)), el("dd", {}, value))),
    );
}

function setEditing(editing) {
  profileForm.hidden = !editing;
  document.getElementById("profile-info").hidden = editing;
  editButton.hidden = editing;
  editButton.setAttribute("aria-expanded", String(editing));
  if (editing) {
    for (const field of ["full_name", "email", "organization", "address"]) {
      profileForm.elements.namedItem(field).value = currentUser[field] || "";
    }
    profileForm.elements.namedItem("full_name").focus();
  } else {
    editButton.focus();
  }
}

editButton.addEventListener("click", () => {
  showError("");
  profileStatus.hidden = true;
  setEditing(true);
});
cancelButton.addEventListener("click", () => {
  showError("");
  setEditing(false);
});
profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = {};
  for (const field of ["full_name", "email", "organization", "address"]) {
    body[field] = profileForm.elements.namedItem(field).value.trim();
  }
  if (!body.full_name || !body.address) {
    showError("Name and address cannot be blank.");
    return;
  }
  showError("");
  saveButton.disabled = cancelButton.disabled = true;
  saveButton.textContent = "Saving...";
  try {
    const user = await api("/api/me", { method: "PATCH", body });
    renderProfile(user);
    setEditing(false);
    profileStatus.textContent = "Profile updated.";
    profileStatus.hidden = false;
    await setUpHeader();
  } catch (err) {
    showError(err.message);
  } finally {
    saveButton.disabled = cancelButton.disabled = false;
    saveButton.textContent = "Save changes";
  }
});

async function loadProfile() {
  try {
    const user = await api("/api/me");
    renderProfile(user);
    document.getElementById("profile").hidden = false;
  } catch (err) {
    showError(err.message);
  } finally {
    document.getElementById("loading").hidden = true;
  }
}

const deleteDialog = document.getElementById("delete-dialog");
const deleteForm = document.getElementById("delete-form");
const deletePassword = document.getElementById("delete-password");
const deleteError = document.getElementById("delete-error");
const confirmDelete = document.getElementById("confirm-delete");
const cancelDelete = document.getElementById("cancel-delete");
let deletingAccount = false;

document.getElementById("delete-account").addEventListener("click", () => {
  deleteForm.reset();
  deleteError.hidden = true;
  deleteDialog.showModal();
  deletePassword.focus();
});
cancelDelete.addEventListener("click", () => deleteDialog.close());
deleteDialog.addEventListener("cancel", (event) => {
  if (deletingAccount) event.preventDefault();
});
deleteDialog.addEventListener("close", () => deleteForm.reset());
deleteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (deletingAccount || !deleteForm.reportValidity()) return;
  deletingAccount = true;
  confirmDelete.disabled = cancelDelete.disabled = deletePassword.disabled = true;
  confirmDelete.textContent = "Deleting...";
  deleteError.hidden = true;
  try {
    await api("/api/me", { method: "DELETE", body: { password: deletePassword.value } });
    location.href = "/docs/login.html";
  } catch (err) {
    deleteError.textContent = err.message;
    deleteError.hidden = false;
  } finally {
    deletingAccount = false;
    confirmDelete.disabled = cancelDelete.disabled = deletePassword.disabled = false;
    confirmDelete.textContent = "Delete Account";
  }
});

loadProfile();
