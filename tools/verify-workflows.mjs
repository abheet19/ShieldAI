import { chromium } from 'playwright';
import assert from "node:assert/strict";
import {mkdir,writeFile} from "node:fs/promises";
const out=process.env.VERIFICATION_DIR || 'docs/verification';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
const page=await browser.newPage({viewport:{width:1280,height:1000}});
const checks=[]; const errors=[]; let count=0, envelope;
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(r.url().endsWith('/api/v1/private-evaluations')) {count++;envelope=JSON.parse(r.postData());}});
try {
 await page.goto('http://127.0.0.1:5055',{waitUntil:'networkidle'});
 await page.locator('#evaluate-button').click(); assert.match(await page.locator('#form-error').innerText(),/required/); assert.equal(count,0); checks.push('empty form denied before encryption/network');
 await page.locator('#annual_income').fill('85000'); await page.locator('#evaluate-button').click(); assert.match(await page.locator('#form-error').innerText(),/existing debt is required/); assert.equal(count,0);checks.push('blank zero-minimum field not coerced into zero');
 for(const [key,value] of Object.entries({existing_debt:'12000',credit_utilization_pct:'30',employment_years:'5',requested_loan_amount:'20000'})) await page.locator('#'+key).fill(value);
 await page.locator('#evaluate-button').click(); assert.match(await page.locator('#form-error').innerText(),/Confirm/);assert.equal(count,0);checks.push('consent required');
 await page.locator('#demo-consent').check(); await page.locator('#credit_utilization_pct').fill('101');await page.locator('#evaluate-button').click();assert.match(await page.locator('#form-error').innerText(),/between/);assert.equal(count,0);checks.push('range constraint blocks provider work');
 await page.locator('#credit_utilization_pct').fill('30'); const start=Date.now(); await page.locator('#evaluate-button').click();await page.locator('#result-content:not([hidden])').waitFor({timeout:60000});
 const duration=Date.now()-start;assert.equal(await page.locator('#indicator-value').innerText(),'37.5/100');assert.deepEqual(Object.keys(envelope).sort(),['encrypted_values','public_key']);assert.equal(Object.keys(envelope.encrypted_values).length,4);checks.push('real browser encryption -> real Flask arithmetic -> browser decryption:37.5/100');
 await page.getByText('View the privacy receipt').click();assert.equal(await page.locator('details.receipt').getAttribute('open'),'');await page.screenshot({path:out+'/desktop-result.png',fullPage:true});checks.push('privacy receipt expands/collapses');await page.getByText('View the privacy receipt').click();
 await page.route('**/api/v1/private-evaluations',route=>route.fulfill({status:429,contentType:'application/json',body:JSON.stringify({error:'Evaluation budget reached. Try again later.'})}));
 await page.locator('#evaluate-button').click();await page.locator('#form-error:not([hidden])').waitFor();assert.match(await page.locator('#form-error').innerText(),/budget reached/);assert.equal(await page.locator('#result-content').isVisible(),false);checks.push('429 simulated browser error clears old result and re-enables submit');
 await page.setViewportSize({width:390,height:844});await page.reload({waitUntil:'networkidle'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:out+'/mobile.png',fullPage:true});checks.push('390px mobile layout has no horizontal overflow; reload clears plaintext result');
 assert.deepEqual(errors,[]);
 await writeFile(out+'/browser-results.json',JSON.stringify({at:new Date().toISOString(),environment:'local real Flask evaluator; 429 response simulation explicitly marked',durationMs:duration,checks,errors},null,2));
 console.log(JSON.stringify({checks:checks.length,durationMs:duration,errors}));
} finally {await browser.close();}
