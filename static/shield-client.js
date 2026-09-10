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
const themeToggle = document.querySelector("#theme-toggle");
const exampleButton = document.querySelector("#example-button");
const THEME_KEY = "shieldai-theme";
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
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const dark = theme === "dark";
  themeToggle.textContent = dark ? "Light theme" : "Dark theme";
  themeToggle.setAttribute("aria-pressed", String(dark));
}
function readInputs() {
  form
    .querySelectorAll(".field")
    .forEach((input) => input.removeAttribute("aria-invalid"));
  const values = {};
  for (const [field, [min, max]] of Object.entries(limits)) {
    const input = document.querySelector(`#${field}`);
    const raw = String(new FormData(form).get(field) ?? "").trim();
    if (!raw) {
      input.setAttribute("aria-invalid", "true");
      input.focus();
      throw new Error(`${field.replaceAll("_", " ")} is required.`);
    }
    const number = Number(raw);
    if (!Number.isFinite(number) || number < min || number > max) {
      input.setAttribute("aria-invalid", "true");
      input.focus();
      throw new Error(
        `${field.replaceAll("_", " ")} must be between ${min.toLocaleString()} and ${max.toLocaleString()}.`,
      );
    }
    values[field] = number;
  }
  if (!document.querySelector("#demo-consent").checked)
    throw new Error(
      "Confirm that you understand this is an educational synthetic indicator.",
    );
  return values;
}
function derivedIndicators(values) {
  return {
    debt_to_income_bps: Math.round(
      (values.existing_debt / values.annual_income) * 10_000,
    ),
    loan_to_income_bps: Math.round(
      (values.requested_loan_amount / values.annual_income) * 10_000,
    ),
    utilization_bps: Math.round(values.credit_utilization_pct * 100),
    stability_gap_months: Math.max(
      0,
      Math.round(120 - values.employment_years * 12),
    ),
  };
}
function explanation(score) {
  if (score < 35)
    return "Lower synthetic pressure under this transparent demonstration. It is not a prediction or decision.";
  if (score < 65)
    return "Moderate synthetic pressure under this transparent demonstration. It is not a prediction or decision.";
  return "Higher synthetic pressure under this transparent demonstration. It is not a prediction or decision.";
}

setTheme(
  localStorage.getItem(THEME_KEY) ||
    (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"),
);
themeToggle.addEventListener("click", () => {
  const theme =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, theme);
  setTheme(theme);
});
exampleButton.addEventListener("click", () => {
  const example = {
    annual_income: 85000,
    existing_debt: 12000,
    credit_utilization_pct: 30,
    employment_years: 5,
    requested_loan_amount: 20000,
  };
  for (const [field, sample] of Object.entries(example)) {
    const input = document.querySelector(`#${field}`);
    input.value = String(sample);
    input.removeAttribute("aria-invalid");
  }
  error.hidden = true;
  document.querySelector("#demo-consent").focus();
});
form.addEventListener("input", (event) => {
  if (event.target.matches(".field"))
    event.target.removeAttribute("aria-invalid");
});
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  error.hidden = true;
  result.hidden = true;
  empty.hidden = false;
  try {
    const inputs = readInputs();
    button.disabled = true;
    button.textContent = "Generating a browser-only key…";
    setState("info", "Encrypting");
    const { publicKey, privateKey } = await generateRandomKeys(1024, true);
    const encryptedValues = Object.fromEntries(
      Object.entries(derivedIndicators(inputs)).map(([field, raw]) => [
        field,
        publicKey.encrypt(BigInt(raw)).toString(),
      ]),
    );
    button.textContent = "Sending ciphertexts to evaluator…";
    const response = await fetch("/api/v1/private-evaluations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        public_key: { n: publicKey.n.toString() },
        encrypted_values: encryptedValues,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        payload.error ||
          "The encrypted evaluator could not complete the request.",
      );
    button.textContent = "Decrypting locally…";
    const ciphertext = payload?.encrypted_result?.ciphertext;
    const divisor = Number(payload?.model?.normalization_divisor);
    if (
      typeof ciphertext !== "string" ||
      !/^\d+$/.test(ciphertext) ||
      !Number.isFinite(divisor) ||
      divisor <= 0
    )
      throw new Error("The encrypted evaluator returned an invalid response.");
    const rawTotal = privateKey.decrypt(BigInt(ciphertext));
    if (rawTotal < 0n || rawTotal > BigInt(Number.MAX_SAFE_INTEGER))
      throw new Error("The decrypted result is outside the supported range.");
    const score = Math.min(
      100,
      Math.round((Number(rawTotal) / divisor) * 10) / 10,
    );
    value.textContent = `${score}/100`;
    gauge.style.width = `${score}%`;
    copy.textContent = explanation(score);
    empty.hidden = true;
    result.hidden = false;
    setState("ok", "Decrypted locally");
  } catch (caught) {
    const message =
      caught instanceof Error && caught.name === "TimeoutError"
        ? "The encrypted evaluator timed out. Try again."
        : caught instanceof Error
          ? caught.message
          : "The private evaluation could not run.";
    showError(message);
  } finally {
    button.disabled = false;
    button.textContent = "Encrypt locally and evaluate";
  }
});
