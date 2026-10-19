// Read-only discovery: records which JSON the public MLS NEXT and FootyAccess pages load.
import { chromium } from 'playwright';
import fs from 'node:fs';
const out='probe-output';fs.mkdirSync(out,{recursive:true});
const log=[];const keep=[];
const NEEDLES=['Garden State','Trenton City','Ironbound','AB7 Future','5855103'];
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'});
context.on('response',async r=>{try{const ct=r.headers()['content-type']||'';const u=r.url();if(!/json|javascript\+json|text\/plain/.test(ct)&&!/api|graphql|feed|schedule|match/i.test(u))return;if(/\.(js|css|png|jpg|svg|woff2?)(\?|$)/.test(u))return;const body=await r.text();log.push({url:u,status:r.status(),ct,len:body.length,hits:NEEDLES.filter(n=>body.includes(n))});if(NEEDLES.some(n=>body.includes(n))||/footy-access|modular11|mlssoccer.*(schedule|match)/i.test(u))keep.push({url:u,body:body.slice(0,400000)})}catch(e){}});
async function visit(url,clicks=[]){const p=await context.newPage();try{await p.goto(url,{waitUntil:'networkidle',timeout:90000});for(const t of clicks){try{await p.getByText(t,{exact:true}).first().click({timeout:8000});await p.waitForLoadState('networkidle',{timeout:30000})}catch(e){log.push({url,click:t,error:String(e).slice(0,200)})}}fs.writeFileSync(out+'/'+url.replace(/[^a-z0-9]+/gi,'_').slice(0,80)+'.txt',(await p.innerText('body')).slice(0,60000))}catch(e){log.push({url,error:String(e).slice(0,300)})}await p.close()}
await visit('https://www.mlssoccer.com/mlsnext/schedule/academy_division/');
await visit('https://www.mlssoccer.com/mlsnext/schedule/u13/');
await visit('https://www.mlssoccer.com/mlsnext/standings/u13/');
await visit('https://www.mlssoccer.com/mlsnext/quality-of-play/');
await visit('https://www.footyaccess.com/leagues/mls-next?ageGroups=U13',['Matches','Teams','Stats']);
// FootyAccess dashboard API, every page for U13 and U14 (same endpoint the site automation already uses)
for(const age of ['U13','U14'])for(const metric of ['goals','cleanSheets']){const all=[];for(let n=1;n<=40;n++){const r=await context.request.get(`https://footy-access-dev.onrender.com/api/mls-next/stats/dashboard?season=2027&ageGroup=${age}&metric=${metric}&page=${n}&q=`,{timeout:60000});const j=await r.json().catch(()=>null);all.push(j);const d=j?.data;const len=(d?.players?.length||0)+(d?.teams?.length||0);if(!len||d?.hasMore===false)break;}fs.writeFileSync(`${out}/dashboard-${age}-${metric}.json`,JSON.stringify(all))}
await browser.close();
fs.writeFileSync(out+'/network-log.json',JSON.stringify(log,null,1));
keep.forEach((k,i)=>fs.writeFileSync(`${out}/body-${String(i).padStart(3,'0')}.json`,JSON.stringify(k)));
console.log('responses',log.length,'kept',keep.length);
