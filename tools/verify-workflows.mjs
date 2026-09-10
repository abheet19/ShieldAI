import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

import { chromium } from "playwright";

const outputDirectory = process.env.VERIFICATION_DIR || "docs/verification";
await mkdir(outputDirectory, { recursive: true });

const launchOptions = process.env.SHIELDAI_BROWSER_PATH
  ? { executablePath: process.env.SHIELDAI_BROWSER_PATH }
  : {};
const browser = await chromium.launch(launchOptions);
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const checks = [];
const errors = [];
const expectedErrors = [];
let evaluationCount = 0;
let evaluationEnvelope;
let expectingHttpError = false;

page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() !== "error") return;
  const text = message.text();
  if (expectingHttpError && /(?:429|503)/.test(text)) expectedErrors.push(text);
  else errors.push(text);
});
page.on("request", (request) => {
  if (!request.url().endsWith("/api/v1/private-evaluations")) return;
  evaluationCount += 1;
  evaluationEnvelope = JSON.parse(request.postData());
});

function passed(name) {
  checks.push(name);
}

async function assertNoHorizontalOverflow(label) {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
    `${label} has horizontal overflow`,
  );
  passed(`${label} has no horizontal overflow`);
}

async function fillValidExample() {
  const values = {
    annual_income: "85000",
    existing_debt: "12000",
    credit_utilization_pct: "30",
    employment_years: "5",
    requested_loan_amount: "20000",
  };
  for (const [field, value] of Object.entries(values)) {
    await page.locator(`#${field}`).fill(value);
  }
}

const baseUrl = process.env.SHIELDAI_BASE_URL || "http://127.0.0.1:5055";
const verificationEnvironment = process.env.SHIELDAI_BASE_URL
  ? `deployed HTTPS evaluator at ${new URL(baseUrl).origin}; recovery responses explicitly simulated`
  : "local real Flask evaluator; recovery responses explicitly simulated";

try {
  const response = await page.goto(baseUrl, { waitUntil: "networkidle" });
  assert.equal(response.status(), 200);
  assert.match(await page.title(), /ShieldAI/);
  assert.equal(await page.locator("h1").count(), 1);
  assert.equal(await page.locator("main").count(), 1);
  assert.equal(await page.locator("footer").count(), 1);
  await page.getByRole("link", { name: "ShieldAI home" }).waitFor();
  await page.getByRole("button", { name: /theme/i }).waitFor();
  await page.getByRole("button", { name: "Use synthetic example" }).waitFor();
  await page
    .getByRole("button", { name: "Encrypt locally and evaluate" })
    .waitFor();
  passed(
    "landmarks, heading hierarchy, and every primary CTA have accessible names",
  );

  const version = await page.request.get(`${baseUrl}/version`);
  assert.equal(version.status(), 200);
  assert.match(
    (await version.json()).source_commit,
    /^(?:unknown|[0-9a-f]{40})$/,
  );
  passed("release identity endpoint is healthy and schema-bound");

  await page.locator("#evaluate-button").click();
  assert.match(await page.locator("#form-error").innerText(), /required/);
  assert.equal(evaluationCount, 0);
  assert.equal(
    await page.locator("#annual_income").getAttribute("aria-invalid"),
    "true",
  );
  passed(
    "empty form is denied, focused, and marked invalid before encryption or network work",
  );

  await page.locator("#annual_income").fill("85000");
  await page.locator("#evaluate-button").click();
  assert.match(
    await page.locator("#form-error").innerText(),
    /existing debt is required/,
  );
  assert.equal(evaluationCount, 0);
  passed("blank zero-minimum field is not coerced into zero");

  await page.locator("#example-button").click();
  assert.equal(
    await page.locator("#requested_loan_amount").inputValue(),
    "20000",
  );
  assert.equal(await page.locator("#demo-consent").isChecked(), false);
  assert.equal(
    await page.evaluate(() => document.activeElement?.id),
    "demo-consent",
  );
  passed(
    "synthetic example fills fields, preserves consent, and moves focus to consent",
  );

  await page.locator("#evaluate-button").click();
  assert.match(await page.locator("#form-error").innerText(), /Confirm/);
  assert.equal(evaluationCount, 0);
  passed("explicit educational-demo consent is required");

  await page.locator("#demo-consent").check();
  await page.locator("#credit_utilization_pct").fill("101");
  await page.locator("#evaluate-button").click();
  assert.match(await page.locator("#form-error").innerText(), /between/);
  assert.equal(evaluationCount, 0);
  passed("range validation blocks cryptographic and provider work");

  await page.locator("#credit_utilization_pct").fill("30");
  const started = Date.now();
  await page.locator("#evaluate-button").click();
  await Promise.race([
    page.locator("#result-content:not([hidden])").waitFor({ timeout: 60_000 }),
    page.locator("#form-error:not([hidden])").waitFor({ timeout: 60_000 }),
  ]);
  if (await page.locator("#form-error").isVisible()) {
    throw new Error(await page.locator("#form-error").innerText());
  }
  const evaluationDurationMs = Date.now() - started;
  assert.equal(await page.locator("#indicator-value").innerText(), "37.5/100");
  assert.deepEqual(Object.keys(evaluationEnvelope).sort(), [
    "encrypted_values",
    "public_key",
  ]);
  assert.equal(Object.keys(evaluationEnvelope.encrypted_values).length, 4);
  assert.equal(JSON.stringify(evaluationEnvelope).includes("85000"), false);
  passed(
    "real browser encryption, Flask ciphertext arithmetic, and local decryption produce 37.5/100",
  );

  const receiptSummary = page.getByText("View the privacy receipt");
  await receiptSummary.focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("details.receipt").getAttribute("open"), "");
  await page.screenshot({
    path: `${outputDirectory}/desktop-result.png`,
    fullPage: true,
  });
  await page.keyboard.press("Enter");
  assert.equal(
    await page.locator("details.receipt").getAttribute("open"),
    null,
  );
  passed("privacy receipt opens and closes from the keyboard");

  const themeButton = page.locator("#theme-toggle");
  const originalTheme = await page.locator("html").getAttribute("data-theme");
  await themeButton.focus();
  await page.keyboard.press("Enter");
  const alternateTheme = await page.locator("html").getAttribute("data-theme");
  assert.notEqual(alternateTheme, originalTheme);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(
    await page.locator("html").getAttribute("data-theme"),
    alternateTheme,
  );
  await page.screenshot({
    path: `${outputDirectory}/desktop-alt-theme.png`,
    fullPage: true,
  });
  passed("theme CTA is keyboard-operable and persists across reload");

  await fillValidExample();
  await page.locator("#demo-consent").check();
  await page.route("**/api/v1/private-evaluations", (route) =>
    route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Evaluation budget reached. Try again later.",
      }),
    }),
  );
  expectingHttpError = true;
  await page.locator("#evaluate-button").click();
  await page.locator("#form-error:not([hidden])").waitFor();
  assert.match(await page.locator("#form-error").innerText(), /budget reached/);
  assert.equal(await page.locator("#result-content").isVisible(), false);
  assert.equal(await page.locator("#evaluate-button").isEnabled(), true);
  expectingHttpError = false;
  await page.unroute("**/api/v1/private-evaluations");
  assert.equal(expectedErrors.length, 1);
  passed("429 recovery clears stale results and restores the submit CTA");

  await page.route("**/api/v1/private-evaluations", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.locator("#evaluate-button").click();
  await page.locator("#form-error:not([hidden])").waitFor();
  assert.match(
    await page.locator("#form-error").innerText(),
    /invalid response/,
  );
  assert.equal(await page.locator("#evaluate-button").isEnabled(), true);
  await page.unroute("**/api/v1/private-evaluations");
  passed("malformed-success recovery is bounded and retryable");

  const frameTimes = await page.evaluate(async () => {
    window.scrollTo(0, 0);
    const samples = [];
    let previous = performance.now();
    for (let frame = 0; frame < 60; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const now = performance.now();
      samples.push(now - previous);
      previous = now;
      window.scrollBy(0, 8);
    }
    return samples;
  });
  const sortedFrames = [...frameTimes].sort((a, b) => a - b);
  const scrollP95Ms = sortedFrames[Math.floor(sortedFrames.length * 0.95)];
  const scrollLongFrames = frameTimes.filter(
    (duration) => duration > 50,
  ).length;
  passed("bounded 60-frame scroll-jank sample recorded");

  await page.setViewportSize({ width: 320, height: 720 });
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.locator("#result-content").isVisible(), false);
  await assertNoHorizontalOverflow("320px mobile layout");
  const mobileTargets = await page
    .locator("button, a.brand, label.consent")
    .evaluateAll((elements) =>
      elements.map((element) => ({
        name: element.textContent.trim(),
        width: element.getBoundingClientRect().width,
        height: element.getBoundingClientRect().height,
      })),
    );
  assert.equal(
    mobileTargets.every(({ width, height }) => width >= 24 && height >= 24),
    true,
  );
  await page.screenshot({
    path: `${outputDirectory}/mobile.png`,
    fullPage: true,
  });
  passed("mobile interactive targets meet the 24 CSS-pixel minimum");

  await page.getByRole("link", { name: "ShieldAI home" }).click();
  assert.equal(new URL(page.url()).pathname, "/");
  assert.equal(await page.locator("#result-content").isVisible(), false);
  passed("brand-home CTA returns to a clean, non-persistent form");

  const navigation = await page.evaluate(() => {
    const entry = performance.getEntriesByType("navigation")[0];
    return entry
      ? {
          domContentLoadedMs: Math.round(entry.domContentLoadedEventEnd),
          loadMs: Math.round(entry.loadEventEnd),
          transferBytes: entry.transferSize,
        }
      : null;
  });

  assert.deepEqual(errors, []);
  const report = {
    at: new Date().toISOString(),
    environment: verificationEnvironment,
    checks,
    errors,
    metrics: {
      evaluationDurationMs,
      navigation,
      scrollP95Ms: Math.round(scrollP95Ms * 100) / 100,
      scrollLongFrames,
    },
  };
  await writeFile(
    `${outputDirectory}/browser-results.json`,
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(
    JSON.stringify({ checks: checks.length, errors, metrics: report.metrics }),
  );
} finally {
  await browser.close();
}
