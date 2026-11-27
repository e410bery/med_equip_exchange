// New listing page. Backend: routes/catalog.py and routes/seller.py
//   GET  /api/filters          -> categories, manufacturers, conditions for the dropdowns
//   POST /api/seller/listings  -> {id}; 409 if you already list the same item in that condition

const form = document.getElementById("listing-form");

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

async function loadForm() {
  try {
    const filters = await api("/api/filters");
    fillSelect(form.elements.category_id, filters.categories.map((c) => [c.id, c.name]));
    fillSelect(form.elements.manufacturer_id, filters.manufacturers.map((m) => [m.id, m.name]));
    fillSelect(form.elements.condition, filters.conditions.map((c) => [c, c]));
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
    await api("/api/seller/listings", { method: "POST", body: formBody() });
    location.href = "seller.html";
  } catch (err) {
    showError(err.message);
  } finally {
    submit.disabled = false;
  }
});

loadForm();
