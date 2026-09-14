// capture-reel60.mjs — drives the LIVE ShieldAI deployment and records a smooth 60fps demo reel.
//
// It opens the public site on the Overview workspace (KPI stat tiles + the numbered "how ShieldAI
// evaluates privately" explainer), runs a real encrypted evaluation through the New evaluation drawer
// (browser-only keygen → encrypt → homomorphic sum on the server → local decryption), lands on the
// decrypted result, then walks the sidebar nav (Evaluations table + row detail, Settings, back to
// Overview) so every surface of the redesigned glass workspace is on screen.
//
// Playwright records the session as .webm at the viewport resolution; ffmpeg then trims the loading
// lead-in and emits BOTH:
//   • docs/media/shieldai-reel.mp4  — H.264, ~1280px wide, motion-interpolated to a smooth 60fps
//   • docs/media/shieldai-demo.gif  — smaller looping GIF for the README
//
// Run:  node tools/capture-reel60.mjs
//       SHIELDAI_URL=http://127.0.0.1:5000 node tools/capture-reel60.mjs   (against a local build)
//       FFMPEG=/path/to/ffmpeg node tools/capture-reel60.mjs               (if ffmpeg is not on PATH)

import { chromium } from "playwright";
import { mkdirSync, statSync, rmSync, mkdtempSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync, execSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const MEDIA = join(ROOT, "docs", "media");
const BASE = (
  process.env.SHIELDAI_URL ?? "https://shieldai-abheet19.fly.dev"
).replace(/\/$/, "");
const VIEWPORT = { width: 1280, height: 900 };
const DSF = 2;
const MP4 = join(MEDIA, "shieldai-reel.mp4");
const GIF = join(MEDIA, "shieldai-demo.gif");

mkdirSync(MEDIA, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Find an ffmpeg binary. Prefers $FFMPEG, then PATH, then the local winget install path. */
function findFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    return "ffmpeg";
  } catch {
    /* not on PATH */
  }
  const winget =
    "C:/Users/abhee/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.1-full_build/bin/ffmpeg.exe";
  try {
    execSync(`"${winget}" -version`, { stdio: "ignore" });
    return winget;
  } catch {
    throw new Error("ffmpeg not found — set $FFMPEG to its full path.");
  }
}

/** Smoothly scroll the given element to a target scrollTop over ~durationMs so the reel reads calmly. */
async function smoothScroll(page, selector, targetTop, durationMs) {
  await page.evaluate(
    async ([sel, target, dur]) => {
      const el = document.querySelector(sel);
      if (!el) return;
      const start = el.scrollTop;
      const delta = target - start;
      const t0 = performance.now();
      await new Promise((done) => {
        function step(now) {
          const p = Math.min(1, (now - t0) / dur);
          const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; // easeInOutQuad
          el.scrollTop = start + delta * eased;
          if (p < 1) requestAnimationFrame(step);
          else done();
        }
        requestAnimationFrame(step);
      });
    },
    [selector, targetTop, durationMs],
  );
}

async function main() {
  const ffmpeg = findFfmpeg();
  console.log(`ShieldAI 60fps reel capture → ${BASE}  (ffmpeg: ${ffmpeg})`);

  const tmp = mkdtempSync(join(tmpdir(), "shieldai-reel-"));
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DSF,
    colorScheme: "dark",
    recordVideo: { dir: tmp, size: VIEWPORT },
  });
  const t0 = Date.now(); // recording begins ~here
  const page = await context.newPage();

  // The live Fly app scale-to-zero cold-starts; give the first paint a generous budget.
  await page.goto(`${BASE}/`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.locator("#screen-overview.is-active").waitFor({ timeout: 60000 });
  await page
    .locator(".stat-row .stat-tile")
    .first()
    .waitFor({ state: "visible", timeout: 30000 });
  await sleep(1600); // hold on the KPI stat tiles

  const tStart = Date.now(); // the interesting motion starts here — the lead-in before it is trimmed

  // 1) Overview — reveal the numbered "How ShieldAI evaluates privately" explainer + formula.
  await smoothScroll(page, ".main", 360, 1100);
  await sleep(1500);
  await smoothScroll(page, ".main", 0, 900);
  await sleep(500);

  // 2) New evaluation — open the drawer and run a REAL encrypted evaluation end to end.
  await page.locator("[data-open-new-eval]:visible").first().click();
  await page.locator("#newEvalDrawer.is-open").waitFor({ timeout: 15000 });
  await sleep(500);

  for (const [id, value] of Object.entries({
    annual_income: "85000",
    existing_debt: "12000",
    credit_utilization_pct: "30",
    employment_years: "5",
    requested_loan_amount: "20000",
  })) {
    await page.locator(`#${id}`).pressSequentially(value, { delay: 55 });
    await sleep(150);
  }
  await page.locator("#demo-consent").check();
  await sleep(500);
  await page.locator("#evaluate-button").click();

  // Watch the encrypt → send → decrypt stepper, then land on the decrypted result banner.
  await page
    .locator("#newEvalResult:not([hidden])")
    .waitFor({ timeout: 60000 });
  await page
    .locator(".result-banner-score")
    .waitFor({ state: "visible", timeout: 15000 });
  await sleep(2200); // hold on the decrypted synthetic score + contribution breakdown

  // 3) The nav — close the drawer and walk the sidebar screens.
  await page.locator("#closeNewEval").click();
  await sleep(700); // Overview now shows the stored evaluation in the KPI tiles + recent list

  await page.locator('.nav-item[data-screen="evaluations"]').click();
  await page
    .locator("#screen-evaluations:not([hidden])")
    .waitFor({ timeout: 10000 });
  await sleep(1200);

  // Open the evaluation detail drawer (gauge + contribution breakdown + privacy receipt).
  const firstRow = page.locator('#evalTableBody tr[role="button"]').first();
  await firstRow.click().catch(() => {});
  await page
    .locator("#detailDrawer.is-open")
    .waitFor({ timeout: 8000 })
    .catch(() => {});
  await sleep(2000);
  await page
    .locator("#closeDetail")
    .click()
    .catch(() => {});
  await sleep(500);

  await page.locator('.nav-item[data-screen="settings"]').click();
  await page
    .locator("#screen-settings:not([hidden])")
    .waitFor({ timeout: 10000 });
  await sleep(1400);

  await page.locator('.nav-item[data-screen="overview"]').click();
  await page.locator("#screen-overview.is-active").waitFor({ timeout: 10000 });
  await sleep(1300); // end on the populated Overview

  const tEnd = Date.now();
  const video = page.video();
  await context.close(); // flushes the .webm
  await browser.close();
  const webm = await video.path();

  const trimStart = Math.max(0, (tStart - t0) / 1000 - 0.3);
  const duration = (tEnd - tStart) / 1000 + 0.5;
  console.log(
    `  webm ${webm} — trim from ${trimStart.toFixed(2)}s for ${duration.toFixed(2)}s`,
  );

  // ---- MP4: motion-interpolated to a genuinely smooth 60fps, ~1280px wide H.264 ----
  const mp4Filter =
    "minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1," +
    "scale=1280:-2:flags=lanczos";
  const mp4Args = [
    "-y",
    "-ss",
    trimStart.toFixed(2),
    "-t",
    duration.toFixed(2),
    "-i",
    webm,
    "-vf",
    mp4Filter,
    "-r",
    "60",
    "-c:v",
    "libx264",
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
    "-crf",
    "20",
    "-preset",
    "medium",
    "-movflags",
    "+faststart",
    "-an",
    MP4,
  ];
  console.log("  encoding 60fps mp4 (minterpolate=mci)…");
  const rMp4 = spawnSync(ffmpeg, mp4Args, { stdio: "inherit" });
  if (rMp4.status !== 0) throw new Error(`ffmpeg (mp4) exited ${rMp4.status}`);

  // ---- GIF: smaller looping loop for the README, generated from the smooth mp4 ----
  const gifFilter =
    "fps=12,scale=680:-1:flags=lanczos,split[s0][s1];" +
    "[s0]palettegen=max_colors=192:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5";
  const gifArgs = [
    "-y",
    "-i",
    MP4,
    "-filter_complex",
    gifFilter,
    "-loop",
    "0",
    GIF,
  ];
  console.log("  encoding looping gif…");
  const rGif = spawnSync(ffmpeg, gifArgs, { stdio: "inherit" });
  if (rGif.status !== 0) throw new Error(`ffmpeg (gif) exited ${rGif.status}`);

  rmSync(tmp, { recursive: true, force: true });
  const mp4Mb = (statSync(MP4).size / 1024 / 1024).toFixed(2);
  const gifMb = (statSync(GIF).size / 1024 / 1024).toFixed(2);
  console.log(`  wrote ${MP4} (${mp4Mb} MB)`);
  console.log(`  wrote ${GIF} (${gifMb} MB)`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
