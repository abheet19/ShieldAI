import { generateRandomKeys } from "/static/vendor/paillier-bigint.js";

const form = document.querySelector("#private-evaluation-form");
const button = document.querySelector("#evaluate-button");
const error = document.querySelector("#form-error");
const state = document.querySelector("#result-state");
const empty = document.querySelector("#result-empty");
const result = document.querySelector("#result-content");
const value = document.querySelector("#indicator-value");
const gauge = document.querySelector("#indicator-gauge");
const copy = document.querySelector("#indicator-copy");
const phase = document.querySelector("#phase-detail");
const limits = {
  annual_income: [1, 2_000_000],
  existing_debt: [0, 2_000_000],
  credit_utilization_pct: [0, 100],
  employment_years: [0, 60],
  requested_loan_amount: [0, 2_000_000],
};

function setState(kind, text) {
  state.className = `state state-${kind}`;
  state.innerHTML = `<span class="state-text"></span>`;
  state.setAttribute("aria-label", text);
  phase.textContent = text;
}
function showError(message) {
  error.textContent = message;
  error.hidden = false;
  setState("bad", "Error");
}
function readInputs() {
  const values = {};
  for (const [field, [min, max]] of Object.entries(limits)) {
    const number = Number(new FormData(form).get(field));
    if (!Number.isFinite(number) || number < min || number > max) throw new Error(`${field.replaceAll("_", " ")} must be between ${min.toLocaleString()} and ${max.toLocaleString()}.`);
    values[field] = number;
  }
  if (!document.querySelector("#demo-consent").checked) throw new Error("Confirm that you understand this is an educational synthetic indicator.");
  return values;
}
function derivedIndicators(values) {
  return {
    debt_to_income_bps: Math.round((values.existing_debt / values.annual_income) * 10_000),
    loan_to_income_bps: Math.round((values.requested_loan_amount / values.annual_income) * 10_000),
    utilization_bps: Math.round(values.credit_utilization_pct * 100),
    stability_gap_months: Math.max(0, Math.round(120 - values.employment_years * 12)),
  };
}
function explanation(score) {
  if (score < 35) return "Lower synthetic pressure under this transparent demonstration. It is not a prediction or decision.";
  if (score < 65) return "Moderate synthetic pressure under this transparent demonstration. It is not a prediction or decision.";
  return "Higher synthetic pressure under this transparent demonstration. It is not a prediction or decision.";
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  error.hidden = true;
  try {
    const inputs = readInputs();
    button.disabled = true;
    button.textContent = "Generating a browser-only key…";
    setState("info", "Encrypting");
    const { publicKey, privateKey } = await generateRandomKeys(1024, true);
    const encryptedValues = Object.fromEntries(Object.entries(derivedIndicators(inputs)).map(([field, raw]) => [field, publicKey.encrypt(BigInt(raw)).toString()]));
    button.textContent = "Sending ciphertexts to evaluator…";
    const response = await fetch("/api/v1/private-evaluations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_key: { n: publicKey.n.toString() }, encrypted_values: encryptedValues }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "The encrypted evaluator could not complete the request.");
    button.textContent = "Decrypting locally…";
    const rawTotal = privateKey.decrypt(BigInt(payload.encrypted_result.ciphertext));
    const score = Math.min(100, Math.round((Number(rawTotal) / payload.model.normalization_divisor) * 10) / 10);
    value.textContent = `${score}/100`;
    gauge.style.width = `${score}%`;
    copy.textContent = explanation(score);
    empty.hidden = true;
    result.hidden = false;
    setState("ok", "Decrypted locally");
  } catch (caught) {
    showError(caught instanceof Error ? caught.message : "The private evaluation could not run.");
  } finally {
    button.disabled = false;
    button.textContent = "Encrypt locally and evaluate";
  }
});



