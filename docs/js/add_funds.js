const fundsForm = document.getElementById("funds-form");
const amountInput = document.getElementById("amount");
const confirmFunds = document.getElementById("confirm-funds");
const cancelFunds = document.getElementById("cancel-funds");
const balanceText = document.getElementById("current-balance");
let savingFunds = false;

function formatAmount() {
  if (amountInput.value === "") return;
  const amount = Number(amountInput.value);
  if (Number.isFinite(amount)) amountInput.value = amount.toFixed(2);
}

amountInput.addEventListener("change", formatAmount);
amountInput.addEventListener("blur", formatAmount);
amountInput.addEventListener("input", (event) => {
  // Browser spinner controls have no text input type; leave typing uninterrupted.
  if (!event.inputType) formatAmount();
});

cancelFunds.addEventListener("click", () => {
  if (!savingFunds) location.href = "user.html";
});

fundsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (savingFunds) return;
  // Native arrows use $10 steps; typed amounts may include cents.
  amountInput.min = "0.01";
  amountInput.step = "0.01";
  const valid = fundsForm.reportValidity();
  amountInput.min = "0";
  amountInput.step = "10";
  if (!valid) return;
  showError("");
  savingFunds = true;
  confirmFunds.disabled = cancelFunds.disabled = true;
  confirmFunds.textContent = "Adding funds...";
  try {
    const result = await api("/api/me/balance", {
      method: "POST",
      body: { amount: amountInput.value },
    });
    balanceText.textContent = `Current balance: ${money(result.balance)}`;
    fundsForm.hidden = true;
    const status = document.getElementById("funds-status");
    status.textContent = `${money(amountInput.value)} added. Your new balance is ${money(result.balance)}.`;
    status.hidden = false;
    document.getElementById("back-to-profile").hidden = false;
    await setUpHeader();
  } catch (err) {
    showError(err.message);
  } finally {
    savingFunds = false;
    confirmFunds.disabled = cancelFunds.disabled = false;
    confirmFunds.textContent = "Confirm";
  }
});

async function loadBalance() {
  try {
    const user = await api("/api/me");
    balanceText.textContent = `Current balance: ${money(user.balance)}`;
    balanceText.hidden = false;
    fundsForm.hidden = false;
    amountInput.focus();
  } catch (err) {
    showError(err.message);
    document.getElementById("back-to-profile").hidden = false;
  } finally {
    document.getElementById("loading").hidden = true;
  }
}

loadBalance();
