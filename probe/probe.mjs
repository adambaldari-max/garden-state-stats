// Read-only: open a Garden State result on FootyAccess and record the API call that returns its goal events.
import { chromium } from 'playwright';
import fs from 'node:fs';
const out='probe-output';fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
const log=[];let phase='load';
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36',viewport:{width:1366,height:1000}});
ctx.on('request',r=>{const u=r.url();if(/onrender\.com\/api|footyaccess\.com\/api/.test(u))log.push({phase,req:u,method:r.method()})});
ctx.on('response',async r=>{const u=r.url();if(!/onrender\.com\/api|footyaccess\.com\/api/.test(u)||/matches\?season|overview|tournaments/.test(u))return;let t='';try{t=await r.text()}catch(e){}fs.writeFileSync(`${out}/resp-${phase}-${log.length}.json`,JSON.stringify({u,status:r.status(),body:t.slice(0,300000)}))});
const p=await ctx.newPage();
await p.goto('https://www.footyaccess.com/leagues/mls-next?ageGroups=U13',{waitUntil:'load',timeout:90000});await p.waitForTimeout(5000);
const click=async(loc,label)=>{try{await loc.first().click({timeout:8000});await p.waitForTimeout(3500);log.push({clicked:label})}catch(e){log.push({clickFail:label,err:String(e).slice(0,150)})}};
await click(p.getByRole('tab',{name:/^\s*matches\s*$/i}).or(p.getByText(/^\s*matches\s*$/i)),'MATCHES');
await click(p.getByRole('tab',{name:/^\s*results\s*$/i}).or(p.getByRole('button',{name:/^\s*results\s*$/i})).or(p.getByText(/^\s*results\s*$/i)),'Results');
log.push({tabs:await p.$$eval('[role=tab],button',b=>b.map(x=>x.innerText.trim()).filter(Boolean).slice(0,60))});fs.writeFileSync(out+'/results.txt',(await p.innerText('body')).slice(0,30000));
await click(p.getByRole('button',{name:/oct\s*18/i}).or(p.getByText(/oct\s*18/i)),'Oct 18');
fs.writeFileSync(out+'/oct18.txt',(await p.innerText('body')).slice(0,60000));
phase='card';
const card=p.locator('article, li, [role=button], button, a, div').filter({hasText:'Trenton City Soccer Club'}).filter({hasText:'Real Futbol Academy'});
const n=await card.count();log.push({cards:n});
if(n){const els=await card.all();await els[els.length-1].click({timeout:8000}).catch(e=>log.push({cardErr:String(e).slice(0,150)}));await p.waitForTimeout(7000);log.push({after:p.url()});fs.writeFileSync(out+'/after-card.txt',(await p.innerText('body')).slice(0,40000));await p.screenshot({path:out+'/after-card.png'})}
await browser.close();
fs.writeFileSync(out+'/log.json',JSON.stringify(log,null,1));
