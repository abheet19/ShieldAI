/** Records the current single-page browser-key workflow, never the retired wizard. */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const base = process.env.SHIELDAI_BASE_URL || "http://127.0.0.1:5055";
const out = path.resolve("docs/demo/frames");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const page = await browser.newPage({ colorScheme: "dark", viewport: { width: 1280, height: 1000 } });
let n=0;
const frames=[];
async function shot(hold=8) { const file=`f${String(n++).padStart(4,"0")}_h${hold}.png`; await page.screenshot({path:path.join(out,file)}); frames.push(file); }
try {
 await page.goto(base,{waitUntil:"networkidle"}); await shot();
 for (const [id,value] of Object.entries({annual_income:"85000",existing_debt:"12000",credit_utilization_pct:"30",employment_years:"5",requested_loan_amount:"20000"})) {
  await page.locator(`#${id}`).pressSequentially(value,{delay:60}); await shot(4);
 }
 await page.locator("#demo-consent").check(); await shot();
 await page.locator("#evaluate-button").click();
 for(let i=0;i<6;i++){ await page.waitForTimeout(150); await shot(2); }
 await page.locator("#result-content:not([hidden])").waitFor({timeout:60000}); await shot(12);
 await page.getByText("View the privacy receipt").click(); await shot(12);
 await page.screenshot({path:"docs/demo/browser-private-key-flow.png",fullPage:true});
 await writeFile(path.join(out,"manifest.json"),JSON.stringify({base,frames,generatedAt:new Date().toISOString()},null,2));
 console.log(JSON.stringify({frames:frames.length,result:await page.locator("#indicator-value").innerText()}));
} finally { await browser.close(); }
