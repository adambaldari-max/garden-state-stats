import {chromium} from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try {const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];const openTab=async t=>{const b=page.locator('[data-tab="'+t+'"]');if(!(await b.isVisible()))await page.locator('.nav-dropdown').filter({has:b}).locator('.nav-dropdown-toggle').click();await b.click()};page.on('pageerror',e=>errors.push(e.message));await page.goto('file://'+path.resolve('index.html'),{waitUntil:'domcontentloaded'});for(const age of ['U13','U14']){await page.getByRole('button',{name:age,exact:true}).click();assert((await page.title()).includes(age));await openTab('standings');assert.equal(await page.locator('#standingsRows tr').count(),15);assert(/rank (movement|change) since/i.test(await page.locator('#movementLegend').innerText()));await openTab('scorers');const counts=await page.locator('#scorerRows tr').evaluateAll(rows=>({count:rows.length,nonpositive:rows.filter(r=>!(Number(r.cells[4]?.textContent)>0)).length}));assert(counts.count>0);assert.equal(counts.nonpositive,0);await openTab('results');assert(await page.locator('#resultsList details').count()>0);assert(await page.locator('#resultsList details[open]').count()<await page.locator('#resultsList details').count());await openTab('clubView');await page.locator('#dualClub').selectOption('Jersey Football Club');assert.equal(await page.locator('#dualOutput article').count(),2);await openTab('about');assert.equal(await page.locator('.method-desktop .coverage-table tbody tr').count(),15);}for(const division of ['U13','U14']){
 await page.getByRole('button',{name:division,exact:true}).click();await openTab('standings');
 assert.match(await page.locator('#freshnessSummary').innerText(),/Results checked.*Scorers verified/);
 for(const column of [4,5,6])assert(await page.locator('#standingsRows tr').first().locator('td').nth(column-1).isVisible(),'W/D/L must be visible on a phone');
 await page.getByRole('button',{name:'Open Jersey Football Club team profile',exact:true}).click();
 const clubGames=await page.evaluate(()=>db.matches.filter(m=>m.completed&&(m.home==='Jersey Football Club'||m.away==='Jersey Football Club')).length);
 assert.equal(await page.locator('#teamForm .form-pill').count(),clubGames);
 for(const [selector,kind]of [['#clubSeasonGraphic','season'],['#clubResultGraphic','result']]){
  await page.locator(selector).click();await page.locator('#graphicModal').waitFor({state:'visible'});
  await page.locator('#graphicModal img').evaluate(img=>img.decode());
  const size=await page.locator('#graphicModal img').evaluate(img=>[img.naturalWidth,img.naturalHeight]);assert.deepEqual(size,[1080,1350]);
  const filename=await page.locator('#graphicDownload').getAttribute('download');assert(filename.includes('jersey-football-club-'+kind));
  const png=await page.locator('#graphicModal img').evaluate(async img=>Array.from(new Uint8Array(await(await fetch(img.src)).arrayBuffer())));
  fs.writeFileSync('schedule-output/'+division.toLowerCase()+'-club-'+kind+'.png',Buffer.from(png));
  await page.locator('#graphicClose').click();assert(await page.locator('#teamProfile').isVisible());
 }
 await page.locator('#teamProfile [data-report-correction]').click();await page.locator('#correctionDialog').waitFor({state:'visible'});
 assert.equal(await page.locator('#correctionClub').inputValue(),'Jersey Football Club');
 await page.locator('#correctionMatch').selectOption({index:1});await page.locator('#correctionDetails').fill('Please review this score against the official report.');await page.locator('#correctionSource').fill('https://www.mlssoccer.com/mlsnext/schedule/academy_division/');
 await page.getByRole('button',{name:'Prepare correction email',exact:true}).click();
 assert(await page.locator('#correctionPrepared').isVisible());
 const email=await page.locator('#correctionEmail').getAttribute('href');assert(email.startsWith('mailto:contact@mlsnextacademystats.com?'));assert(decodeURIComponent(email).includes('Age group: '+division));assert(decodeURIComponent(email).includes('Club: Jersey Football Club'));assert(decodeURIComponent(email).includes('Source: https://www.mlssoccer.com/'));
 await page.locator('#correctionClose').click();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,'Phone content must not run offscreen');
}
assert.deepEqual(errors,[]);await page.screenshot({path:'schedule-output/mobile-smoke.png',fullPage:false});console.log('Mobile browser smoke checks passed for both ages.');}finally{await browser.close()}
