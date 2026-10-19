// Read-only: record every data request the official MLS NEXT Academy Division standings page makes.
import { chromium } from 'playwright';
import fs from 'node:fs';
const out='probe-output';fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
const log=[];
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36',viewport:{width:1366,height:900}});
ctx.on('response',async r=>{const u=r.url();const ct=r.headers()['content-type']||'';if(/\.(css|png|jpe?g|svg|gif|woff2?|ico|webp)(\?|$)/i.test(u))return;let len=0,hit=false,body='';try{if(/json|text\/plain|javascript/.test(ct)&&!/\.js(\?|$)/.test(u)){body=await r.text();len=body.length;hit=/Garden State|Trenton City|Ironbound/.test(body)}}catch(e){}log.push({u,s:r.status(),ct,len,hit});if(hit)fs.writeFileSync(`${out}/hit-${log.length}.json`,JSON.stringify({url:u,body:body.slice(0,2500000)}))});
for(const url of ['https://www.mlssoccer.com/mlsnext/standings/academy_division/','https://www.mlssoccer.com/mlsnext/standings/u13/','https://www.mlssoccer.com/mlsnext/standings/u14/']){
 const p=await ctx.newPage();
 try{await p.goto(url,{waitUntil:'load',timeout:90000});await p.waitForTimeout(20000);
  const frames=p.frames().map(f=>f.url());log.push({page:url,frames});
  for(const f of p.frames()){try{const t=await f.locator('body').innerText({timeout:5000});if(/Garden State|Trenton/.test(t))fs.writeFileSync(`${out}/text-${url.split('/').filter(Boolean).pop()}-${f.url().replace(/[^a-z0-9]+/gi,'_').slice(0,60)}.txt`,t.slice(0,200000))}catch(e){}}
  await p.screenshot({path:`${out}/shot-${url.split('/').filter(Boolean).pop()}.png`,fullPage:false});
 }catch(e){log.push({page:url,error:String(e).slice(0,300)})}
 await p.close();
}
await browser.close();
fs.writeFileSync(out+'/log.json',JSON.stringify(log,null,1));
console.log(log.filter(x=>x.hit||x.frames).map(x=>JSON.stringify(x)).join('\n'));
