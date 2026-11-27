// New / edit listing page. Backend: routes/catalog.py and routes/seller.py
//   GET   /api/filters                -> categories, manufacturers, conditions for the dropdowns
//   GET   /api/items/<id>             -> current values when editing
//   POST  /api/seller/listings        -> {id}; 409 if you already list the same item in that condition
//   PATCH /api/seller/listings/<id>   -> the updated listing
// Open listing.html to create, or listing.html?item_id=<id> to edit.

const form = document.getElementById("listing-form");
const itemId = new URLSearchParams(location.search).get("item_id");

function fillSelect(select, options) {
  select.replaceChildren(...options.map(([value, label]) => el("option", { value }, label)));
}

function formBody() {
  const f = form.elements;
  const data = {
    name: f.name.value.trim(),
    model: f.model.value.trim(),
    category_id: f.category_id.value,
    condition: f.condition.value,
    location: f.location.value.trim(),
    price: f.price.value,
    quantity: f.quantity.value,
    description: f.description.value.trim(),
    specifications: f.specifications.value.trim(),
    rental_rate: f.rental_rate.value,
    rental_units: f.rental_units.value,
  };
  if (f.manufacturer_name.value.trim()) data.manufacturer_name = f.manufacturer_name.value.trim();
  else data.manufacturer_id = f.manufacturer_id.value;
  return data;
}

function fillFromItem(item) {
  const f = form.elements;
  for (const key of ["name", "model", "category_id", "manufacturer_id", "condition", "location",
    "price", "quantity", "description", "specifications", "rental_rate"]) {
    f[key].value = item[key] ?? "";
  }
  f.rental_units.value = item.rental_units || "";
  document.title = "Edit Listing · Med Equip Exchange";
  document.getElementById("page-title").textContent = `Edit ${item.name}`;
  form.querySelector('button[type="submit"]').textContent = "Save changes";
}

async function loadForm() {
  try {
    const filters = await api("/api/filters");
    fillSelect(form.elements.category_id, filters.categories.map((c) => [c.id, c.name]));
    fillSelect(form.elements.manufacturer_id, filters.manufacturers.map((m) => [m.id, m.name]));
    fillSelect(form.elements.condition, filters.conditions.map((c) => [c, c]));
    if (itemId) fillFromItem(await api(`/api/items/${itemId}`));
    form.hidden = false;
  } catch (err) {
    showError(err.message);
  } finally {
    document.getElementById("loading").hidden = true;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  showError("");
  try {
    if (itemId) await api(`/api/seller/listings/${itemId}`, { method: "PATCH", body: formBody() });
    else await api("/api/seller/listings", { method: "POST", body: formBody() });
    location.href = "seller.html";
  } catch (err) {
    showError(err.message);
  } finally {
    submit.disabled = false;
  }
});

loadForm();
