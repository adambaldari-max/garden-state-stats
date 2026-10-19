#!/usr/bin/env node
// Browser smoke test for the staged HTML. Requires: npm install --no-save playwright
// Then: npx playwright install chromium
// Run: node scripts/browser-smoke.mjs previews/2026-10-19-index.html
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const input=process.argv[2];
if(!input)throw Error('Usage: node scripts/browser-smoke.mjs previews/2026-10-19-index.html');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:900},acceptDownloads:true});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(pathToFileURL(resolve(input)).href,{waitUntil:'load'});
 for(const age of ['u13','u14']){
  await page.locator('.age-button[data-age="'+age+'"]').click();
  const selected=await page.locator('.age-button[data-age="'+age+'"]').getAttribute('class');
  if(!selected.includes('selected'))throw Error(age+' age switch failed');
  for(const tab of ['standings','scorers','ab7','results','about']){
   await page.locator('.tabs button[data-tab="'+tab+'"]').click();
   if(await page.locator('#'+tab).evaluate(el=>el.classList.contains('hidden')))throw Error(age+' '+tab+' hidden after click');
   const text=(await page.locator('#'+tab).innerText()).trim();
   if(text.length<50)throw Error(age+' '+tab+' empty');
   console.log('PASS '+age+' '+tab+' ('+text.length+' chars)');
  }
  await page.locator('.tabs button[data-tab="standings"]').click();
  const rows=await page.locator('#standingsRows tr').count();
  if(rows!==15)throw Error(age+' standings has '+rows+' rows; expected 15');
  const header=await page.locator('.standings-table thead').innerText();
  if(!header.includes('Δ'))throw Error(age+' movement column missing');
  const movementCells=await page.locator('#standingsRows td.movement-col').count();
  if(movementCells!==15)throw Error(age+' movement cells: '+movementCells+'; expected 15');
  const names=await page.locator('#standingsRows .team-link').allTextContents();
  if(new Set(names).size!==15)throw Error(age+' has duplicate or missing club names');
  console.log('PASS '+age+' standings: 15 distinct clubs and 15 movement cells');
  await page.screenshot({path:'output/smoke-'+age+'.png',fullPage:true});
 }
 if(errors.length)throw Error('Browser JS errors: '+errors.join(' | '));
 console.log('PASS: no uncaught browser errors; screenshots in output/');
}catch(e){console.error('FAIL:',e.message);process.exitCode=1}
finally{await browser.close()}
