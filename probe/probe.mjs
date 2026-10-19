// Read-only: find how FootyAccess loads per-match goal events (scorer + minute).
import { chromium } from 'playwright';
import fs from 'node:fs';
const out='probe-output';fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
const log=[];
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36',viewport:{width:1366,height:900}});
ctx.on('response',async r=>{const u=r.url();if(!/onrender|footyaccess\.com\/api/.test(u))return;let t='';try{t=await r.text()}catch(e){}log.push({u,s:r.status(),len:t.length,hasGoal:/goal|scorer|event/i.test(t.slice(0,20000))});if(/event|incident|timeline|match/i.test(u)&&t.length<3000000)fs.writeFileSync(`${out}/api-${log.length}.json`,JSON.stringify({u,body:t.slice(0,400000)}))});
const p=await ctx.newPage();
await p.goto('https://www.footyaccess.com/leagues/mls-next?ageGroups=U13',{waitUntil:'load',timeout:90000});await p.waitForTimeout(6000);
try{await p.getByRole('tab',{name:/Matches/i}).first().click({timeout:8000})}catch(e){try{await p.getByText('Matches',{exact:true}).first().click({timeout:8000})}catch(e2){log.push({clickErr:String(e2).slice(0,200)})}}
await p.waitForTimeout(6000);
const links=await p.$$eval('a[href]',as=>[...new Set(as.map(a=>a.href))].filter(h=>/match|fixture|game/i.test(h)).slice(0,40));
log.push({links});
fs.writeFileSync(out+'/matches-tab.txt',(await p.innerText('body')).slice(0,40000));
// open a match page: prefer a Garden State one if visible
let target=links.find(h=>/5856789|5855872/.test(h))||links[0];
if(target){await p.goto(target,{waitUntil:'load',timeout:90000});await p.waitForTimeout(8000);fs.writeFileSync(out+'/match-page.txt',(await p.innerText('body')).slice(0,40000));log.push({opened:target,url:p.url()})}
// try direct match URL patterns
for(const u of ['https://www.footyaccess.com/matches/kitman_5856789','https://www.footyaccess.com/leagues/mls-next/matches/kitman_5856789','https://www.footyaccess.com/match/kitman_5856789']){const q=await ctx.newPage();try{const r=await q.goto(u,{waitUntil:'load',timeout:60000});await q.waitForTimeout(6000);log.push({try:u,status:r?.status(),final:q.url(),text:(await q.innerText('body')).slice(0,600)})}catch(e){log.push({try:u,err:String(e).slice(0,150)})}await q.close()}
await browser.close();
fs.writeFileSync(out+'/log.json',JSON.stringify(log,null,1));
