/**
 * Records the ShieldAI hero demo: the full Assess -> Encrypt -> Compute -> Reveal
 * wizard, driven with Playwright against a real running instance, captured as
 * PNG frames. `tools/build-demo-gif.py` then assembles the frames into
 * docs/demo/shieldai-demo.gif.
 *
 *   node tools/record-demo.mjs [baseUrl]
 *
 * Default baseUrl is the live deployment. Pass http://localhost:8080 to record
 * against a local `python app.py`.
 */
import { chromium } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.argv[2] || 'https://shieldai-abheet19.fly.dev';
const OUT = path.resolve('docs/demo/frames');
const VIEWPORT = { width: 1000, height: 760 };

// Must match TICK_MS in tools/build-demo-gif.py. No single `shot(page, hold)`
// call should pass a hold above this — that is the ~1.4s freeze cap.
const TICK_MS = 125;
const MAX_HOLD_TICKS = 11; // 11 * 125ms = 1375ms
const cap = (ticks) => Math.min(ticks, MAX_HOLD_TICKS);

// The applicant we type in. Deliberately a middling profile so the reveal
// lands somewhere interesting on the gauge rather than pinned at an end.
const APPLICANT = [
  ['#AnnualIncome', '72000'],
  ['#ExistingDebt', '18000'],
  ['#CreditUtilization', '34'],
  ['#EmploymentYears', '6'],
  ['#RequestedLoanAmount', '25000'],
];

let n = 0;
async function shot(page, hold = 1) {
  // `hold` repeats the same frame so the GIF can dwell on a moment without
  // paying for extra distinct frames.
  const file = path.join(OUT, `f${String(n).padStart(4, '0')}_h${hold}.png`);
  await page.screenshot({ path: file });
  n += 1;
}

/**
 * Continuous capture for a beat that matters (a new page landing, a gauge
 * sweeping): screenshot every ~120ms for the duration instead of one
 * screenshot repeated as a frozen hold. Total time is capped the same way
 * as a plain shot() — nothing gets to hold past MAX_HOLD_TICKS.
 */
async function settle(page, ms, sampleMs = 120) {
  const total = Math.min(ms, MAX_HOLD_TICKS * TICK_MS);
  const steps = Math.max(1, Math.round(total / sampleMs));
  for (let i = 0; i < steps; i++) {
    await page.waitForTimeout(total / steps);
    await shot(page, Math.max(1, Math.round(total / steps / TICK_MS)));
  }
}

async function typeSlowly(page, selector, value, opts = {}) {
  const { chunk = 2, hold = 1 } = opts;
  await page.click(selector);
  for (let i = 0; i < value.length; i += chunk) {
    await page.type(selector, value.slice(i, i + chunk), { delay: 0 });
    await shot(page, hold);
  }
}

const run = async () => {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
  });

  // 1. Assess - land on the form. This first frame is what GitHub shows as
  //    the still before the GIF plays, so hold it (capped, not frozen).
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await shot(page, cap(10));

  // 2. Fill in the details a lender would normally demand in the clear.
  for (const [selector, value] of APPLICANT) {
    await typeSlowly(page, selector, value);
    await shot(page, 2);
  }
  await shot(page, cap(4));

  // 3. Encrypt - client keypair page.
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.click('button[type="submit"]'),
  ]);
  await settle(page, 900); // continuous capture through the page landing

  await page.check('#submitData');
  await shot(page, cap(5));

  // 4. Compute - the lender's model runs on the ciphertext.
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.click('button[type="submit"]'),
  ]);
  await settle(page, 1100); // continuous capture through the page landing

  // 5. Reveal - only the holder of the private key sees a score. This is the
  //    payoff frame, so it gets the fullest (still-capped) beat.
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.click('button[type="submit"]'),
  ]);
  await settle(page, 1400); // filmed continuously through the gauge sweep, not skipped to the end

  // Ease down to bring the ciphertext / plaintext side-by-side fully into
  // frame - the proof that the score was computed on data the lender never
  // saw in the clear. This is the frame the whole demo exists for.
  for (let i = 0; i < 3; i += 1) {
    await page.mouse.wheel(0, 40);
    await page.waitForTimeout(120);
    await shot(page, 1);
  }
  await shot(page, cap(11));

  await browser.close();
  console.log(`captured ${n} frames into ${OUT}`);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
