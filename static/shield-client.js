import { generateRandomKeys } from "/static/vendor/paillier-bigint.js";

/* =============================================================================
   ShieldAI workspace client.

   Everything an evaluation touches is real: a fresh 1024-bit Paillier key pair
   is generated in this tab, the four derived indicators are encrypted with it,
   the ciphertexts are POSTed to the real Flask evaluator, and the response is
   decrypted with the same in-memory private key. Nothing here fabricates a
   score or a network round trip — the only thing that is invented is the
   workspace chrome (screens, history table, command palette) around that real
   flow. Local evaluation history lives in this browser's localStorage only.
   ============================================================================= */

const THEME_KEY = "shieldai-theme";
const KEEP_HISTORY_KEY = "shieldai-keep-history";
const HISTORY_KEY = "shieldai-evaluations";
const MAX_HISTORY = 200;

const FIELD_META = [
  {
    name: "annual_income",
    label: "annual income",
    min: 1,
    max: 2_000_000,
    wrap: "fieldIncome",
  },
  {
    name: "existing_debt",
    label: "existing debt",
    min: 0,
    max: 2_000_000,
    wrap: "fieldDebt",
  },
  {
    name: "credit_utilization_pct",
    label: "credit utilization",
    min: 0,
    max: 100,
    wrap: "fieldUtil",
  },
  {
    name: "employment_years",
    label: "employment years",
    min: 0,
    max: 60,
    wrap: "fieldEmp",
  },
  {
    name: "requested_loan_amount",
    label: "requested amount",
    min: 0,
    max: 2_000_000,
    wrap: "fieldReq",
  },
];

const BAND_LABEL = {
  low: "Lower pressure",
  moderate: "Moderate pressure",
  high: "Higher pressure",
};
const BAND_CAPTION = {
  low: "below the 35 point threshold",
  moderate: "between the 35 and 65 point thresholds",
  high: "at or above the 65 point threshold",
};

const $ = (id) => document.getElementById(id);
const root = document.documentElement;

/* ---------------------------------------------------------------------------
   Theme — light / dark / system, persisted, mirrored in the topbar switch and
   the Settings segmented control.
   --------------------------------------------------------------------------- */
function paintThemeUI(choice) {
  document.querySelectorAll("[data-theme-choice]").forEach((btn) => {
    btn.classList.toggle(
      "is-active",
      btn.getAttribute("data-theme-choice") === choice,
    );
  });
}
function applyTheme(choice) {
  if (choice === "light" || choice === "dark")
    root.setAttribute("data-theme", choice);
  else root.removeAttribute("data-theme");
  paintThemeUI(choice);
  try {
    localStorage.setItem(THEME_KEY, choice);
  } catch {
    /* private browsing or storage disabled: theme still applies for this load */
  }
}
(function initTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem(THEME_KEY);
  } catch {
    /* ignore */
  }
  applyTheme(saved === "light" || saved === "dark" ? saved : "system");
})();
document.querySelectorAll("[data-theme-choice]").forEach((btn) => {
  btn.addEventListener("click", () =>
    applyTheme(btn.getAttribute("data-theme-choice")),
  );
});

/* ---------------------------------------------------------------------------
   Toast
   --------------------------------------------------------------------------- */
const toastEl = $("toast");
const toastMsgEl = $("toastMsg");
let toastTimer = null;
function showToast(message) {
  toastMsgEl.textContent = message;
  toastEl.classList.add("is-open");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("is-open"), 2800);
}

/* ---------------------------------------------------------------------------
   Formatting helpers
   --------------------------------------------------------------------------- */
function fmtUSD(n) {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
function relTime(msAgo) {
  const minsAgo = msAgo / 60000;
  if (minsAgo < 1) return "just now";
  if (minsAgo < 60) return `${Math.round(minsAgo)} min ago`;
  const hrs = minsAgo / 60;
  if (hrs < 24)
    return `${Math.round(hrs)} ${Math.round(hrs) === 1 ? "hr ago" : "hrs ago"}`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}
function bandFor(score) {
  const key = score < 35 ? "low" : score < 65 ? "moderate" : "high";
  return { key, label: BAND_LABEL[key] };
}
async function fingerprintOf(decimalModulus) {
  const bytes = new TextEncoder().encode(decimalModulus);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex.match(/.{1,4}/g).join("·");
}

/* ---------------------------------------------------------------------------
   Local evaluation history — every entry here came from a real encrypted
   round trip; nothing is synthesised after the fact.
   --------------------------------------------------------------------------- */
let keepHistory = true;
try {
  keepHistory = localStorage.getItem(KEEP_HISTORY_KEY) !== "0";
} catch {
  /* ignore */
}
let history = [];
try {
  const raw = localStorage.getItem(HISTORY_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) history = parsed;
  }
} catch {
  /* corrupt or inaccessible storage: start fresh rather than break the page */
}
let nextSeq = history.reduce((max, record) => {
  const match = /EVL-0*(\d+)/.exec(record.id || "");
  return match ? Math.max(max, Number(match[1]) + 1) : max;
}, 1);

function persistHistory() {
  if (!keepHistory) return;
  try {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(history.slice(0, MAX_HISTORY)),
    );
  } catch {
    /* storage full or disabled: history still works for this tab session */
  }
}
function addRecord(record) {
  history.unshift(record);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  persistHistory();
  renderAll();
}
function clearHistory() {
  history = [];
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
  renderAll();
}

/* ---------------------------------------------------------------------------
   Navigation between the three screens
   --------------------------------------------------------------------------- */
const SCREEN_TITLE = {
  overview: "Overview",
  evaluations: "Evaluations",
  settings: "Settings",
};
function showScreen(name) {
  document.querySelectorAll(".screen").forEach((section) => {
    section.hidden = section.getAttribute("data-screen") !== name;
  });
  document.querySelectorAll(".nav-item[data-screen]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.getAttribute("data-screen") === name);
  });
  $("crumbCurrent").textContent = SCREEN_TITLE[name] || name;
  closeMobileSidebar();
  window.scrollTo(0, 0);
}
document.querySelectorAll(".nav-item[data-screen]").forEach((btn) => {
  btn.addEventListener("click", () =>
    showScreen(btn.getAttribute("data-screen")),
  );
});
document.querySelectorAll("[data-goto-screen]").forEach((btn) => {
  btn.addEventListener("click", () =>
    showScreen(btn.getAttribute("data-goto-screen")),
  );
});

/* ---------------------------------------------------------------------------
   Mobile sidebar
   --------------------------------------------------------------------------- */
const sidebarEl = $("sidebar");
const scrimEl = $("scrim");
function closeMobileSidebar() {
  sidebarEl.classList.remove("is-open");
  $("sidebarToggle").setAttribute("aria-expanded", "false");
  if (!anyOverlayOpen()) scrimEl.classList.remove("is-open");
}
$("sidebarToggle").addEventListener("click", () => {
  // The mobile drawer slides in under the app bar; tell CSS how tall it is.
  root.style.setProperty(
    "--topbar-h",
    `${document.querySelector(".topbar").offsetHeight}px`,
  );
  const open = sidebarEl.classList.toggle("is-open");
  $("sidebarToggle").setAttribute("aria-expanded", String(open));
  scrimEl.classList.toggle("is-open", open);
});

/* ---------------------------------------------------------------------------
   Overlay management — drawers + command palette share one scrim and one
   "what is currently open" check so Escape and the scrim click always do the
   right thing.
   --------------------------------------------------------------------------- */
const newEvalDrawer = $("newEvalDrawer");
const detailDrawer = $("detailDrawer");
const cmdkOverlay = $("cmdkOverlay");
let lastFocused = null;

function anyOverlayOpen() {
  return (
    newEvalDrawer.classList.contains("is-open") ||
    detailDrawer.classList.contains("is-open") ||
    cmdkOverlay.classList.contains("is-open")
  );
}
function openOverlay(el) {
  lastFocused = document.activeElement;
  el.classList.add("is-open");
  el.setAttribute("aria-hidden", "false");
  scrimEl.classList.add("is-open");
}
function closeOverlay(el) {
  el.classList.remove("is-open");
  el.setAttribute("aria-hidden", "true");
  if (!anyOverlayOpen() && !sidebarEl.classList.contains("is-open"))
    scrimEl.classList.remove("is-open");
  if (lastFocused && typeof lastFocused.focus === "function")
    lastFocused.focus();
}
function closeAllOverlays() {
  [newEvalDrawer, detailDrawer, cmdkOverlay].forEach((el) => {
    el.classList.remove("is-open");
    el.setAttribute("aria-hidden", "true");
  });
  closeMobileSidebar();
  scrimEl.classList.remove("is-open");
}
scrimEl.addEventListener("click", closeAllOverlays);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && anyOverlayOpen()) {
    closeAllOverlays();
  }
});

/* =============================================================================
   NEW EVALUATION DRAWER — the real encrypted flow.
   ============================================================================= */
const newEvalForm = $("newEvalForm");
const newEvalProgress = $("newEvalProgress");
const newEvalResult = $("newEvalResult");
const newEvalFoot = $("newEvalFoot");
const evaluateButton = $("evaluate-button");
const cancelButton = $("cancelNewEval");
const runAnotherButton = $("runAnotherBtn");
const formErrorEl = $("form-error");
const formErrorMsgEl = $("form-error-msg");
const procDot = $("procDot");
const procPhaseEl = $("procPhase");
const consentCheck = $("demo-consent");

function fieldInput(name) {
  return document.querySelector(`#newEvalDrawer [name="${name}"]`);
}
function clearFieldErrors() {
  FIELD_META.forEach((meta) => $(meta.wrap).classList.remove("has-error"));
  $("fieldConsent").classList.remove("has-error");
  formErrorEl.hidden = true;
}
function showFormError(message, wrapId) {
  formErrorMsgEl.textContent = message;
  formErrorEl.hidden = false;
  if (wrapId) {
    const wrap = $(wrapId);
    wrap.classList.add("has-error");
    const input = wrap.querySelector("input");
    if (input) input.focus();
  }
}
function validateAndCollect() {
  clearFieldErrors();
  const values = {};
  for (const meta of FIELD_META) {
    const input = fieldInput(meta.name);
    const raw = input.value.trim();
    if (!raw) {
      showFormError(`${meta.label} is required.`, meta.wrap);
      throw new Error("validation");
    }
    const number = Number(raw);
    if (!Number.isFinite(number) || number < meta.min || number > meta.max) {
      showFormError(
        `${meta.label} must be between ${meta.min.toLocaleString()} and ${meta.max.toLocaleString()}.`,
        meta.wrap,
      );
      throw new Error("validation");
    }
    values[meta.name] = number;
  }
  if (!consentCheck.checked) {
    showFormError(
      "Confirm that you understand this is an educational synthetic indicator.",
      "fieldConsent",
    );
    throw new Error("validation");
  }
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

function setStep(name, state) {
  const row = document.querySelector(`#procSteps [data-step="${name}"]`);
  row.classList.toggle("is-active", state === "active");
  row.classList.toggle("is-done", state === "done");
}
function resetSteps() {
  ["key", "send", "decrypt"].forEach((name) => setStep(name, "pending"));
}
function setPhase(kind, text) {
  procDot.className = `state-dot is-${kind}`;
  procPhaseEl.textContent = text;
}

function resetNewEvalDrawer() {
  clearFieldErrors();
  newEvalForm.hidden = false;
  newEvalProgress.hidden = true;
  newEvalResult.hidden = true;
  newEvalResult.textContent = "";
  resetSteps();
  evaluateButton.hidden = false;
  evaluateButton.disabled = false;
  evaluateButton.innerHTML =
    '<svg><use href="#i-lock"/></svg>Encrypt locally and evaluate';
  runAnotherButton.hidden = true;
  cancelButton.textContent = "Cancel";
  newEvalFoot.hidden = false;
}
function openNewEvalDrawer(prefill) {
  resetNewEvalDrawer();
  FIELD_META.forEach((meta) => {
    fieldInput(meta.name).value =
      prefill && meta.name in prefill ? String(prefill[meta.name]) : "";
  });
  consentCheck.checked = false;
  openOverlay(newEvalDrawer);
  fieldInput("annual_income").focus();
}
document.querySelectorAll("[data-open-new-eval]").forEach((btn) => {
  btn.addEventListener("click", () => openNewEvalDrawer());
});
$("runExampleBtn").addEventListener("click", () => runSyntheticExample());
$("closeNewEval").addEventListener("click", () => closeOverlay(newEvalDrawer));
cancelButton.addEventListener("click", () => closeOverlay(newEvalDrawer));
const SYNTHETIC_EXAMPLE = {
  annual_income: 85000,
  existing_debt: 12000,
  credit_utilization_pct: 30,
  employment_years: 5,
  requested_loan_amount: 20000,
};
$("example-button").addEventListener("click", () => {
  Object.entries(SYNTHETIC_EXAMPLE).forEach(([name, value]) => {
    fieldInput(name).value = String(value);
  });
  clearFieldErrors();
  consentCheck.focus();
});

/* One-click primary first-run flow: open the drawer, fill the synthetic
   example, accept the demo consent, and run the real encrypted evaluation
   straight through to the result + privacy receipt — so a reviewer reaches
   the payoff in a single step. Manual entry stays available via the drawer. */
function runSyntheticExample() {
  openNewEvalDrawer(SYNTHETIC_EXAMPLE);
  consentCheck.checked = true;
  runEvaluation();
}

function renderBreakdown(container, components) {
  container.textContent = "";
  const maxContribution = Math.max(1, ...components.map((c) => c.contribution));
  for (const component of components) {
    const row = document.createElement("div");
    row.className = "breakdown-row";
    const top = document.createElement("div");
    top.className = "breakdown-top";
    const label = document.createElement("b");
    label.textContent = component.label;
    const term = document.createElement("span");
    term.className = "term";
    term.textContent = component.term;
    const val = document.createElement("span");
    val.className = "val";
    val.textContent = `+${component.contribution.toFixed(1)} pts`;
    const left = document.createElement("div");
    left.className = "breakdown-top-left";
    left.append(label, term);
    top.append(left, val);
    const bar = document.createElement("div");
    bar.className = "breakdown-bar";
    const fill = document.createElement("i");
    fill.style.width = `${Math.min(100, (component.contribution / maxContribution) * 100)}%`;
    bar.append(fill);
    row.append(top, bar);
    container.append(row);
  }
}
function componentsFor(values, derived, weights, divisor) {
  return [
    {
      key: "dti",
      label: "Debt-to-income",
      term: `×${weights.debt_to_income_bps} · ${derived.debt_to_income_bps} bps`,
      contribution:
        (weights.debt_to_income_bps * derived.debt_to_income_bps) / divisor,
    },
    {
      key: "lti",
      label: "Loan-to-income",
      term: `×${weights.loan_to_income_bps} · ${derived.loan_to_income_bps} bps`,
      contribution:
        (weights.loan_to_income_bps * derived.loan_to_income_bps) / divisor,
    },
    {
      key: "util",
      label: "Utilization",
      term: `×${weights.utilization_bps} · ${derived.utilization_bps} bps`,
      contribution:
        (weights.utilization_bps * derived.utilization_bps) / divisor,
    },
    {
      key: "gap",
      label: "Stability gap",
      term: `×${weights.stability_gap_months} · ${derived.stability_gap_months} mo`,
      contribution:
        (weights.stability_gap_months * derived.stability_gap_months) / divisor,
    },
  ];
}

function buildResultView(record) {
  const wrap = document.createElement("div");
  wrap.className = "result-view";

  const banner = document.createElement("div");
  banner.className = "result-banner";
  const top = document.createElement("div");
  top.className = "result-banner-top";
  const label = document.createElement("span");
  label.textContent = "Synthetic pressure indicator";
  const score = document.createElement("span");
  score.className = "result-banner-score";
  score.textContent = `${record.score} `;
  const unit = document.createElement("small");
  unit.className = "result-banner-unit";
  unit.textContent = "idx";
  score.append(unit);
  top.append(label, score);
  const copy = document.createElement("p");
  copy.className = "result-copy";
  copy.textContent = explanation(record.score);
  banner.append(top, copy);

  const breakdownPanel = document.createElement("div");
  breakdownPanel.className = "panel";
  const bHead = document.createElement("div");
  bHead.className = "panel-head";
  bHead.innerHTML = "<h3>Contribution breakdown</h3>";
  const bBody = document.createElement("div");
  bBody.className = "panel-body breakdown-panel-body";
  renderBreakdown(bBody, record.components);
  breakdownPanel.append(bHead, bBody);

  const receiptPanel = document.createElement("div");
  receiptPanel.className = "panel";
  const rHead = document.createElement("div");
  rHead.className = "panel-head";
  rHead.innerHTML = "<h3>Privacy receipt</h3>";
  const rBody = document.createElement("div");
  rBody.className = "panel-body";
  const box = document.createElement("div");
  box.className = "receipt-box";
  box.append(
    receiptRow(
      "i-key",
      "Key owner",
      "Browser memory only — generated for this evaluation, never uploaded.",
    ),
    receiptRow(
      "i-send",
      "Transmitted to evaluator",
      "Public modulus, encrypted indicators, encrypted result only.",
    ),
    receiptRow(
      "i-lock",
      "Retained on this device",
      "Raw inputs and the private key — never sent anywhere.",
    ),
    receiptRow(
      "i-clock",
      "Persistence",
      keepHistory
        ? "Local history is on — this record stays in this browser until cleared."
        : "Local history is off — this record will not survive closing the tab.",
    ),
  );
  const notice = document.createElement("div");
  notice.className = "howit-foot";
  notice.textContent = `Evaluator response notice: ${record.privacyNotice}`;
  rBody.append(box, notice);
  receiptPanel.append(rHead, rBody);

  wrap.append(banner, breakdownPanel, receiptPanel);
  return wrap;
}
function receiptRow(icon, title, text) {
  const row = document.createElement("div");
  row.className = "receipt-row";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#${icon}`);
  svg.append(use);
  const textWrap = document.createElement("div");
  const b = document.createElement("b");
  b.textContent = title;
  const span = document.createElement("span");
  span.textContent = text;
  textWrap.append(b, span);
  row.append(svg, textWrap);
  return row;
}

async function runEvaluation() {
  let values;
  try {
    values = validateAndCollect();
  } catch {
    return;
  }
  formErrorEl.hidden = true;
  newEvalForm.hidden = true;
  newEvalProgress.hidden = false;
  resetSteps();
  evaluateButton.disabled = true;
  setPhase("info", "Encrypting");
  setStep("key", "active");

  try {
    const { publicKey, privateKey } = await generateRandomKeys(1024, true);
    setStep("key", "done");
    const derived = derivedIndicators(values);
    const encryptedValues = Object.fromEntries(
      Object.entries(derived).map(([field, raw]) => [
        field,
        publicKey.encrypt(BigInt(raw)).toString(),
      ]),
    );

    setStep("send", "active");
    setPhase("info", "Sending ciphertexts");
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
    setStep("send", "done");

    setStep("decrypt", "active");
    setPhase("info", "Decrypting locally");
    const ciphertext = payload?.encrypted_result?.ciphertext;
    const divisor = Number(payload?.model?.normalization_divisor);
    const weights = payload?.model?.weights;
    if (
      typeof ciphertext !== "string" ||
      !/^\d+$/.test(ciphertext) ||
      !Number.isFinite(divisor) ||
      divisor <= 0 ||
      !weights
    )
      throw new Error("The encrypted evaluator returned an invalid response.");
    const rawTotal = privateKey.decrypt(BigInt(ciphertext));
    if (rawTotal < 0n || rawTotal > BigInt(Number.MAX_SAFE_INTEGER))
      throw new Error("The decrypted result is outside the supported range.");
    const score = Math.min(
      100,
      Math.round((Number(rawTotal) / divisor) * 10) / 10,
    );
    setStep("decrypt", "done");
    setPhase("ok", "Decrypted locally");

    const keyFp = await fingerprintOf(publicKey.n.toString());
    const band = bandFor(score);
    const record = {
      id: `EVL-${String(nextSeq++).padStart(6, "0")}`,
      ts: Date.now(),
      inputs: values,
      score,
      band: band.key,
      bandLabel: band.label,
      components: componentsFor(values, derived, weights, divisor),
      model: { id: payload.model.id, weights, normalization_divisor: divisor },
      keyFp,
      privacyNotice:
        payload.privacy_notice ||
        "the evaluator saw only a public key and encrypted derived indicators.",
    };
    addRecord(record);
    lastKeyFp = keyFp;
    renderKeyStatus();

    newEvalProgress.hidden = true;
    newEvalResult.hidden = false;
    newEvalResult.append(buildResultView(record));
    evaluateButton.hidden = true;
    runAnotherButton.hidden = false;
    cancelButton.textContent = "Close";
    showToast(`Evaluation ${record.id} saved locally.`);
    runAnotherButton.onclick = () => openNewEvalDrawer();
    newEvalResult
      .querySelectorAll(".panel-body")
      .forEach((el) => el.setAttribute("tabindex", "-1"));
  } catch (caught) {
    const message =
      caught instanceof Error && caught.name === "TimeoutError"
        ? "The encrypted evaluator timed out. Try again."
        : caught instanceof Error
          ? caught.message
          : "The private evaluation could not run.";
    setPhase("bad", "Error");
    newEvalProgress.hidden = true;
    newEvalForm.hidden = false;
    showFormError(message);
    evaluateButton.disabled = false;
  }
}
evaluateButton.addEventListener("click", runEvaluation);

/* =============================================================================
   EVALUATION DETAIL DRAWER
   ============================================================================= */
const detailIdEl = $("detailId");
const detailMetaEl = $("detailMeta");
const gaugeArc = $("gaugeArc");
const gaugeScoreEl = $("gaugeScore");
const gaugeBandCaptionEl = $("gaugeBandCaption");
const breakdownListEl = $("breakdownList");
const receiptPersistenceEl = $("receiptPersistence");
const detailPrivacyNoticeEl = $("detailPrivacyNotice");
const GAUGE_ARC_LENGTH = 283;
let openRecordId = null;

function openDetailDrawer(record) {
  openRecordId = record.id;
  detailIdEl.textContent = record.id;
  detailMetaEl.textContent = `Submitted ${relTime(Date.now() - record.ts)} · requested ${fmtUSD(record.inputs.requested_loan_amount)}`;
  const pct = Math.max(0, Math.min(100, record.score)) / 100;
  gaugeArc.style.strokeDashoffset = String(GAUGE_ARC_LENGTH * (1 - pct));
  gaugeScoreEl.textContent = String(record.score);
  gaugeBandCaptionEl.textContent = `${record.bandLabel} — ${BAND_CAPTION[record.band]}`;
  renderBreakdown(breakdownListEl, record.components);
  receiptPersistenceEl.textContent = keepHistory
    ? "Local history is on — this record stays in this browser until cleared."
    : "Local history is off for new evaluations — this saved record remains until you clear history.";
  detailPrivacyNoticeEl.textContent = `Evaluator response notice: ${record.privacyNotice}`;
  openOverlay(detailDrawer);
}
$("closeDetail").addEventListener("click", () => closeOverlay(detailDrawer));
$("closeDetailBtn").addEventListener("click", () => closeOverlay(detailDrawer));
$("rerunEvalBtn").addEventListener("click", () => {
  const record = history.find((r) => r.id === openRecordId);
  closeOverlay(detailDrawer);
  openNewEvalDrawer(record ? record.inputs : undefined);
});

/* =============================================================================
   RENDERING — Overview stats, recent list, sparkline, Evaluations table,
   Settings key status. Called after every history mutation.
   ============================================================================= */
let lastKeyFp = history[0]?.keyFp || null;

function renderKeyStatus() {
  const short = lastKeyFp ? lastKeyFp.split("·").slice(0, 2).join("·") : null;
  $("sideKeyFp").textContent = short ? `fp ${short}` : "no evaluation run yet";
  $("sideKeyDot").classList.toggle("is-live", Boolean(lastKeyFp));
  $("statKeyFp").textContent = short || "Ephemeral";
  $("settingsKeyFp").textContent = lastKeyFp || "no evaluation run yet";
}
function renderStats() {
  $("statCount").textContent = String(history.length);
  $("navEvalCount").textContent = String(history.length);
  if (history[0]) {
    // score is a numeric literal computed above — safe to interpolate; the
    // <small>idx</small> unit matches the design artifact's stat tile.
    $("statLastScore").innerHTML = `${history[0].score}<small>idx</small>`;
    $("statLastBand").textContent = history[0].bandLabel;
  } else {
    $("statLastScore").textContent = "—";
    $("statLastBand").textContent = "Run an evaluation to begin";
  }
}
function renderRecentList() {
  const container = $("recentList");
  container.textContent = "";
  if (!history.length) {
    const note = document.createElement("p");
    note.className = "empty-note";
    note.textContent =
      "No local evaluations yet. Run the synthetic example to see the full encrypted flow end to end.";
    const cta = document.createElement("button");
    cta.type = "button";
    cta.className = "btn btn-primary";
    cta.innerHTML =
      '<svg><use href="#i-shield"/></svg>Run the synthetic example';
    cta.addEventListener("click", () => runSyntheticExample());
    container.append(note, cta);
    return;
  }
  for (const record of history.slice(0, 6)) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "recent-row";
    const idWrap = document.createElement("div");
    const id = document.createElement("div");
    id.className = "recent-id";
    id.textContent = record.id;
    const meta = document.createElement("div");
    meta.className = "recent-meta";
    meta.textContent = `${relTime(Date.now() - record.ts)} · requested ${fmtUSD(record.inputs.requested_loan_amount)}`;
    idWrap.append(id, meta);
    const score = document.createElement("span");
    score.className = "recent-score";
    score.textContent = `${record.score} idx`;
    const band = document.createElement("span");
    band.className = `pill pill-${record.band}`;
    band.textContent = record.bandLabel;
    row.append(idWrap, score, band);
    row.addEventListener("click", () => openDetailDrawer(record));
    container.append(row);
  }
}
const SPARK_BAND_COLOR = {
  low: "var(--ok)",
  moderate: "var(--warn)",
  high: "var(--bad)",
};
const SVG_NS = "http://www.w3.org/2000/svg";
function svgEl(name, attrs, text) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  if (text !== undefined) el.textContent = text;
  return el;
}
function renderSparkline() {
  const wrap = $("sparkWrap");
  wrap.textContent = "";
  const points = history.slice(0, 6).reverse();
  if (points.length < 2) {
    const note = document.createElement("p");
    note.className = "empty-note empty-note--tight";
    note.textContent = "Run two or more evaluations to see a trend.";
    wrap.append(note);
    return;
  }
  // Geometry matches redesigns/shieldai.html: left gutter for the 0/50/100
  // value labels, bottom gutter for the first/last time labels, and
  // preserveAspectRatio="xMidYMid meet" so the stroke never stretches.
  const W = 620;
  const H = 110;
  const padL = 30;
  const padR = 14;
  const top = 12;
  const bottom = 30;
  const innerW = W - padL - padR;
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;
  const yFor = (value) => {
    const clamped = Math.max(0, Math.min(100, value));
    return top + (1 - clamped / 100) * (H - top - bottom);
  };
  const svg = svgEl("svg", {
    viewBox: `0 0 ${W} ${H}`,
    preserveAspectRatio: "xMidYMid meet",
  });

  // gridlines + value labels at 0 / 50 / 100
  [0, 50, 100].forEach((value) => {
    const y = yFor(value);
    svg.append(
      svgEl("line", {
        x1: padL,
        y1: y.toFixed(1),
        x2: W - padR,
        y2: y.toFixed(1),
        stroke: "var(--line)",
        "stroke-width": "1",
      }),
    );
    svg.append(
      svgEl(
        "text",
        {
          x: "4",
          y: (y + 3).toFixed(1),
          "font-family": "IBM Plex Mono, ui-monospace, monospace",
          "font-size": "9",
          fill: "var(--ink-2)",
        },
        String(value),
      ),
    );
  });

  const coords = points.map((record, index) => ({
    x: padL + index * stepX,
    y: yFor(record.score),
    band: record.band,
  }));
  const path = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ");
  svg.append(
    svgEl("path", {
      d: path,
      fill: "none",
      stroke: "var(--accent)",
      "stroke-width": "2",
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
    }),
  );

  // band-coloured dots
  coords.forEach((c) => {
    svg.append(
      svgEl("circle", {
        cx: c.x.toFixed(1),
        cy: c.y.toFixed(1),
        r: "4",
        fill: SPARK_BAND_COLOR[c.band] || "var(--accent)",
        stroke: "var(--bg)",
        "stroke-width": "1.5",
      }),
    );
  });

  // first / last time labels
  svg.append(
    svgEl(
      "text",
      {
        x: padL,
        y: H - 8,
        "font-family": "IBM Plex Mono, ui-monospace, monospace",
        "font-size": "9",
        fill: "var(--ink-2)",
      },
      relTime(Date.now() - points[0].ts),
    ),
  );
  svg.append(
    svgEl(
      "text",
      {
        x: W - padR,
        y: H - 8,
        "font-family": "IBM Plex Mono, ui-monospace, monospace",
        "font-size": "9",
        fill: "var(--ink-2)",
        "text-anchor": "end",
      },
      relTime(Date.now() - points[points.length - 1].ts),
    ),
  );

  wrap.append(svg);
}

let evalSearchTerm = "";
let evalBandFilter = "all";
function renderEvalTable() {
  const body = $("evalTableBody");
  body.textContent = "";
  const filtered = history.filter((record) => {
    if (evalBandFilter !== "all" && record.band !== evalBandFilter)
      return false;
    if (
      evalSearchTerm &&
      !record.id.toLowerCase().includes(evalSearchTerm.toLowerCase())
    )
      return false;
    return true;
  });
  $("tableCount").textContent =
    `${filtered.length} evaluation${filtered.length === 1 ? "" : "s"}`;
  if (!filtered.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.className = "empty-note";
    cell.textContent = history.length
      ? "No evaluations match this filter."
      : "No local evaluations yet.";
    row.append(cell);
    body.append(row);
    return;
  }
  for (const record of filtered) {
    const row = document.createElement("tr");
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.setAttribute("aria-label", `View evaluation ${record.id}`);
    row.append(
      tableCell(record.id, "id"),
      tableCell(relTime(Date.now() - record.ts), "row-time"),
      tableCell(fmtUSD(record.inputs.requested_loan_amount), "mono"),
      tableCell(`${record.inputs.credit_utilization_pct}%`, "mono"),
      tableCell(`${record.inputs.employment_years} yr`, "mono"),
      tableCell(`${record.score}`, "mono"),
    );
    const resultCell = document.createElement("td");
    const pill = document.createElement("span");
    pill.className = `pill pill-${record.band}`;
    pill.textContent = record.bandLabel;
    resultCell.append(pill);
    row.append(resultCell);
    const open = () => openDetailDrawer(record);
    row.addEventListener("click", open);
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
    body.append(row);
  }
}
function tableCell(text, cls) {
  const td = document.createElement("td");
  if (cls) td.className = cls;
  td.textContent = text;
  return td;
}
$("evalSearch").addEventListener("input", (event) => {
  evalSearchTerm = event.target.value;
  renderEvalTable();
});
document.querySelectorAll("#bandFilters .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    evalBandFilter = chip.getAttribute("data-band");
    document
      .querySelectorAll("#bandFilters .chip")
      .forEach((c) => c.classList.toggle("is-active", c === chip));
    renderEvalTable();
  });
});

function renderAll() {
  renderStats();
  renderRecentList();
  renderSparkline();
  renderEvalTable();
  renderKeyStatus();
}
renderAll();

/* ---------------------------------------------------------------------------
   Settings — history toggle + clear
   --------------------------------------------------------------------------- */
const historyToggle = $("historyToggle");
function paintHistoryToggle() {
  historyToggle.classList.toggle("is-on", keepHistory);
  historyToggle.setAttribute("aria-checked", String(keepHistory));
}
paintHistoryToggle();
historyToggle.addEventListener("click", () => {
  keepHistory = !keepHistory;
  try {
    localStorage.setItem(KEEP_HISTORY_KEY, keepHistory ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (keepHistory) persistHistory();
  paintHistoryToggle();
  showToast(
    keepHistory
      ? "History will now persist across reloads."
      : "History will clear when this tab closes.",
  );
});
$("clearHistoryBtn").addEventListener("click", () => {
  if (
    history.length &&
    !window.confirm(
      "Permanently clear every locally stored evaluation? This cannot be undone.",
    )
  )
    return;
  clearHistory();
  showToast("Local history cleared.");
});

/* =============================================================================
   COMMAND PALETTE
   ============================================================================= */
const cmdkInput = $("cmdkInput");
const cmdkList = $("cmdkList");
const isMac = /Mac|iPhone|iPad/.test(
  navigator.platform || navigator.userAgent || "",
);
$("cmdkKbdHint").textContent = isMac ? "⌘K" : "Ctrl K";

function commandItems() {
  return [
    {
      group: "Navigate",
      icon: "i-grid",
      label: "Go to Overview",
      run: () => showScreen("overview"),
    },
    {
      group: "Navigate",
      icon: "i-list",
      label: "Go to Evaluations",
      run: () => showScreen("evaluations"),
    },
    {
      group: "Navigate",
      icon: "i-gear",
      label: "Go to Settings",
      run: () => showScreen("settings"),
    },
    {
      group: "Actions",
      icon: "i-plus",
      label: "New evaluation",
      run: () => openNewEvalDrawer(),
    },
    {
      group: "Actions",
      icon: "i-sun",
      label: "Light theme",
      run: () => applyTheme("light"),
    },
    {
      group: "Actions",
      icon: "i-moon",
      label: "Dark theme",
      run: () => applyTheme("dark"),
    },
    {
      group: "Actions",
      icon: "i-monitor",
      label: "Match system theme",
      run: () => applyTheme("system"),
    },
    {
      group: "Ecosystem",
      icon: "i-github",
      label: "Open github.com/abheet19",
      run: () =>
        window.open(
          "https://github.com/abheet19",
          "_blank",
          "noopener,noreferrer",
        ),
    },
  ];
}
let cmdkHighlight = 0;
let cmdkVisible = [];
function renderCmdk(filterText) {
  const term = filterText.trim().toLowerCase();
  cmdkVisible = commandItems().filter(
    (item) => !term || item.label.toLowerCase().includes(term),
  );
  cmdkList.textContent = "";
  if (!cmdkVisible.length) {
    const empty = document.createElement("div");
    empty.className = "cmdk-empty";
    empty.textContent = "No matching commands.";
    cmdkList.append(empty);
    return;
  }
  let currentGroup = null;
  cmdkVisible.forEach((item, index) => {
    if (item.group !== currentGroup) {
      currentGroup = item.group;
      const groupLabel = document.createElement("div");
      groupLabel.className = "cmdk-group-label";
      groupLabel.textContent = currentGroup;
      cmdkList.append(groupLabel);
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = `cmdk-item${index === cmdkHighlight ? " is-highlighted" : ""}`;
    button.innerHTML = `<svg><use href="#${item.icon}"/></svg><span></span>`;
    button.querySelector("span").textContent = item.label;
    button.addEventListener("click", () => runCommand(item));
    cmdkList.append(button);
  });
}
function runCommand(item) {
  closeOverlay(cmdkOverlay);
  item.run();
}
function openCmdk() {
  cmdkHighlight = 0;
  cmdkInput.value = "";
  renderCmdk("");
  openOverlay(cmdkOverlay);
  cmdkInput.focus();
}
$("cmdkTrigger").addEventListener("click", openCmdk);
$("cmdkTriggerTop").addEventListener("click", openCmdk);
// The palette overlay sits above the shared scrim, so a click outside the
// panel lands here rather than on the scrim — close on that click too.
cmdkOverlay.addEventListener("click", (event) => {
  if (event.target === cmdkOverlay) closeOverlay(cmdkOverlay);
});
cmdkInput.addEventListener("input", () => {
  cmdkHighlight = 0;
  renderCmdk(cmdkInput.value);
});
cmdkInput.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    cmdkHighlight = Math.min(cmdkVisible.length - 1, cmdkHighlight + 1);
    renderCmdk(cmdkInput.value);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    cmdkHighlight = Math.max(0, cmdkHighlight - 1);
    renderCmdk(cmdkInput.value);
  } else if (event.key === "Enter") {
    event.preventDefault();
    if (cmdkVisible[cmdkHighlight]) runCommand(cmdkVisible[cmdkHighlight]);
  }
});
document.addEventListener("keydown", (event) => {
  const meta = isMac ? event.metaKey : event.ctrlKey;
  if (meta && event.key.toLowerCase() === "k") {
    event.preventDefault();
    if (cmdkOverlay.classList.contains("is-open")) closeOverlay(cmdkOverlay);
    else openCmdk();
  }
});
