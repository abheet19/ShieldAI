import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: true,
  ...(process.env.SHIELDAI_BROWSER_PATH
    ? { executablePath: process.env.SHIELDAI_BROWSER_PATH }
    : {}),
});
const page = await browser.newPage({
  colorScheme: "dark",
  viewport: { width: 1280, height: 900 },
});
let evaluationRequest;
page.on("request", (request) => {
  if (request.url().endsWith("/api/v1/private-evaluations"))
    evaluationRequest = JSON.parse(request.postData());
});
const baseUrl = process.env.SHIELDAI_BASE_URL || "http://127.0.0.1:5055";
await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
await page.locator("#annual_income").fill("85000");
await page.locator("#existing_debt").fill("12000");
await page.locator("#credit_utilization_pct").fill("30");
await page.locator("#employment_years").fill("5");
await page.locator("#requested_loan_amount").fill("20000");
await page.locator("#demo-consent").check();
await page.locator("#evaluate-button").click();
await page.locator("#result-content:not([hidden])").waitFor({ timeout: 60000 });
const result = await page.locator("#indicator-value").textContent();
const state = await page.locator("#phase-detail").textContent();
if (
  !evaluationRequest ||
  !evaluationRequest.public_key ||
  !evaluationRequest.encrypted_values
)
  throw new Error("No encrypted evaluation payload.");
if (
  Object.keys(evaluationRequest).sort().join(",") !==
  "encrypted_values,public_key"
)
  throw new Error("Payload included unexpected fields.");
if (!/\/100/.test(result || ""))
  throw new Error(`Missing decrypted indicator: ${result}`);
if (!/Decrypted locally/.test(state || ""))
  throw new Error(`Wrong client state: ${state}`);
await page.screenshot({
  path:
    process.env.SHIELDAI_SCREENSHOT_PATH ||
    "docs/demo/browser-private-key-flow.png",
  fullPage: true,
});
await browser.close();
console.log(
  JSON.stringify({
    result,
    state,
    payloadKeys: Object.keys(evaluationRequest),
    encryptedFields: Object.keys(evaluationRequest.encrypted_values),
  }),
);
