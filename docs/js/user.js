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
        el("a", { class: "button button-small", href: "add-funds.html" }, "Add funds"))],
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

loadProfile();
