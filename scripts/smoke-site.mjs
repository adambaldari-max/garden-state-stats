import {chromium} from 'playwright';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const root=process.cwd();const server=http.createServer((req,res)=>{const target=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return}const file=target.endsWith(path.sep)?path.join(target,'index.html'):target;try{res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.json')?'application/json':file.endsWith('.js')?'text/javascript':'application/octet-stream');res.end(fs.readFileSync(file))}catch(e){res.writeHead(404).end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const testUrl='http://127.0.0.1:'+server.address().port+'/index.html';
const browser=await chromium.launch({headless:true});
try {const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];const openTab=async t=>{const b=page.locator('[data-tab="'+t+'"]');if(!(await b.isVisible()))await page.locator('.nav-dropdown').filter({has:b}).locator('.nav-dropdown-toggle').click();await b.click()};page.on('pageerror',e=>errors.push(e.message));await page.goto(testUrl,{waitUntil:'domcontentloaded'});for(const age of ['U13','U14']){await page.getByRole('button',{name:age,exact:true}).click();assert((await page.title()).includes(age));await openTab('standings');assert.equal(await page.locator('#standingsRows tr').count(),15);assert(/rank (movement|change) since/i.test(await page.locator('#movementLegend').innerText()));await openTab('scorers');const counts=await page.locator('#scorerRows tr').evaluateAll(rows=>({count:rows.length,nonpositive:rows.filter(r=>!(Number(r.cells[4]?.textContent)>0)).length}));assert(counts.count>0);assert.equal(counts.nonpositive,0);await openTab('results');assert(await page.locator('#resultsList details').count()>0);assert(await page.locator('#resultsList details[open]').count()<await page.locator('#resultsList details').count());await openTab('clubView');await page.locator('#dualClub').selectOption('Jersey Football Club');assert.equal(await page.locator('#dualOutput article').count(),2);await openTab('about');assert.equal(await page.locator('.method-desktop .coverage-table tbody tr').count(),15);}for(const division of ['U13','U14']){
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
await page.locator('#divisionSelect').selectOption('homegrown');await page.waitForFunction(()=>document.title.includes('Homegrown')&&!document.querySelector('#divisionSelect').disabled);
for(const divisionAge of ['U13','U14']){
 await page.getByRole('button',{name:divisionAge,exact:true}).click();
 const source=JSON.parse(fs.readFileSync('data/homegrown-'+divisionAge.toLowerCase()+'.json','utf8'));
 assert.equal(await page.locator('#confSelect option').count(),8);
 for(const confData of source.conferences){
  await page.locator('#confSelect').selectOption(confData.name);await openTab('standings');
  assert((await page.title()).includes('Homegrown'));assert((await page.title()).includes(confData.name));
  assert.equal(await page.locator('#standingsRows tr').count(),confData.teams.length);
  const played=await page.locator('#standingsRows tr td:nth-child(3)').allTextContents();
  assert.equal(played.reduce((n,x)=>n+Number(x),0),confData.matches.filter(m=>m.completed).length*2);
  assert(await page.locator('#scorersTab').isVisible());
  await openTab('scorers');const coverage=confData.conference_scorer_audit;
  assert((await page.locator('#goalCoverage').innerText()).includes(coverage.currently_reconciled_matches+' of '+coverage.total_completed_matches));
  if(coverage.pending_matches.length)assert((await page.locator('#scorers .status-tag').innerText()).startsWith('PARTIAL:'));
  await page.locator('#scorerRows tr button').first().click();assert((await page.locator('#playerProfile').innerText()).includes('Homegrown'));if(coverage.pending_matches.length)assert((await page.locator('#playerProfile').innerText()).includes('Partial conference coverage'));await page.locator('#playerClose').click();
  const goals=await page.locator('#scorerRows tr td:nth-child(5)').allTextContents();assert.equal(goals.reduce((n,x)=>n+Number(x),0),confData.scorers.reduce((n,p)=>n+p.conference_goals,0));
  await openTab('results');assert(await page.locator('#resultsList details').count()>0);
  await openTab('clubView');await page.locator('#dualClub').selectOption(confData.teams[0].name);assert.equal(await page.locator('#dualOutput article').count(),2);
  await openTab('insights');assert(await page.locator('#previewOutput').innerText());
  await openTab('progress');assert.equal(await page.locator('#progressChart svg').count(),1);
  await openTab('recap');assert(await page.locator('#recapContent').innerText());
  await openTab('map');assert(await page.locator('#mapHomeFields').innerText());await openTab('map');assert(await page.locator('#mapHomeFields').innerText());await openTab('about');assert((await page.locator('.method-grid>article:first-child>p').innerText()).includes('Homegrown'));
 }
 await page.locator('#confSelect').selectOption('Northeast');await openTab('standings');
 const c=source.conferences.find(c=>c.name==='Northeast'),club=c.teams[0].name;
 await page.getByRole('button',{name:'Open '+club+' team profile',exact:true}).click();
 assert.equal(await page.locator('#teamForm .form-pill').count(),c.matches.filter(m=>m.completed&&(m.home===club||m.away===club)).length);
 for(const button of ['#clubSeasonGraphic','#clubResultGraphic']){await page.locator(button).click();await page.locator('#graphicModal').waitFor({state:'visible'});assert((await page.locator('#graphicDownload').getAttribute('download')).startsWith('homegrown-'));await page.locator('#graphicModal img').evaluate(img=>img.decode());await page.locator('#graphicClose').click()}
 await page.locator('#teamProfile [data-report-correction]').click();assert((await page.locator('#correctionContext').innerText()).startsWith('Homegrown Division'));await page.locator('#correctionClose').click();
 const deepLink=page.url();assert(deepLink.includes('division=homegrown'));await page.reload({waitUntil:'domcontentloaded'});await page.locator('#teamProfile').waitFor({state:'visible'});assert((await page.locator('#teamTitle').innerText()).includes(club));assert((await page.title()).includes(divisionAge));
}
await page.locator('#divisionSelect').selectOption('academy');await page.waitForFunction(()=>document.title.includes('Academy')&&!document.querySelector('#divisionSelect').disabled);await page.locator('#confSelect').selectOption('Garden State');await openTab('standings');assert.equal(await page.locator('#standingsRows tr').count(),15);assert(!page.url().includes('division=homegrown'));
await page.setViewportSize({width:1280,height:900});await page.locator('#divisionSelect').selectOption('homegrown');await page.waitForFunction(()=>document.title.includes('Homegrown')&&!document.querySelector('#divisionSelect').disabled);await openTab('standings');await page.screenshot({path:'schedule-output/homegrown-desktop.png',fullPage:false});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'schedule-output/homegrown-mobile.png',fullPage:false});
assert.deepEqual(errors,[]);await page.screenshot({path:'schedule-output/mobile-smoke.png',fullPage:false});console.log('Mobile browser smoke checks passed for both ages.');}finally{await browser.close();server.close()}
