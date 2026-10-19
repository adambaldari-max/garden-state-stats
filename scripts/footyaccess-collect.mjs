import { chromium } from 'playwright';
import fs from 'node:fs';
const out='footyaccess-output';fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync('index.html','utf8');
function baseline(age){const k='const DATA_'+age+'=';const i=source.indexOf(k);if(i<0)throw Error('Missing '+k);return JSON.parse(source.slice(i+k.length,source.indexOf(';',i)));}
const norm=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const clubs=baseline('U13').standings.map(x=>x.team);
const aliases=new Map(clubs.map(c=>[norm(c),c]));
const result={generated:new Date().toISOString(),status:'read-only',ages:{},warnings:[]};
const browser=await chromium.launch({headless:true});
try{
for(const age of ['U13','U14']){
const page=await browser.newPage({viewport:{width:1440,height:900}});
const network=[];page.on('response',r=>{if(/api|graphql|stats|leader|player/i.test(r.url()))network.push({status:r.status(),url:r.url().slice(0,450)});});
try{
await page.goto('https://www.footyaccess.com/leagues/mls-next?ageGroups='+age,{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForTimeout(3000);
const stats=page.getByText(/^Stats$/i).first();if(await stats.count())await stats.click().catch(()=>{});
await page.getByText('Player leaders',{exact:true}).first().click().catch(()=>{});
await page.waitForTimeout(2500);
const ageButtons=page.getByRole('button',{name:age,exact:true});if(await ageButtons.count())await ageButtons.last().click().catch(()=>{});
await page.waitForTimeout(1800);
const rows=[];const seen=new Set();let stop='limit';
for(let n=0;n<120;n++){
const table=page.locator('table').first();await table.locator('tbody tr').first().waitFor({timeout:15000});
const batch=await table.locator('tbody tr').evaluateAll(trs=>trs.map(tr=>{const c=[...tr.querySelectorAll('td')];const lines=(c[1]?.innerText||'').split('\n').map(x=>x.trim()).filter(Boolean);return {rank:Number(c[0]?.innerText.trim()),player:lines[0]||'',club:lines.slice(1).join(' '),age:c[2]?.innerText.trim(),goals:Number(c[3]?.innerText.trim())};}));
if(!batch.length)throw Error('Empty table at page '+(n+1));
const signature=JSON.stringify(batch);if(seen.has(signature))throw Error('Pagination repeated at page '+(n+1));seen.add(signature);
rows.push(...batch);
const next=page.getByRole('button',{name:'Next',exact:true}).last();
if(!await next.count()){stop='next-missing';break;}
if(await next.isDisabled()){stop='last-page';break;}
await next.click();await page.waitForTimeout(500);
await page.waitForFunction(previous=>{const first=document.querySelector('table tbody tr');return first&&first.innerText!==previous;},batch[0].rank+'\n'+batch[0].player,{timeout:7000}).catch(()=>{});
}
fs.writeFileSync(out+'/'+age.toLowerCase()+'-all.json',JSON.stringify(rows,null,2));
const matched=rows.map(r=>({...r,audit_club:aliases.get(norm(r.club))})).filter(r=>r.audit_club);
const old=baseline(age).scorers;
const key=r=>norm(r.player)+'|'+norm(r.audit_club);
const oldMap=new Map(old.map(r=>[key(r),r]));const freshMap=new Map(matched.map(r=>[key(r),r]));
const changed=matched.filter(r=>oldMap.has(key(r))&&oldMap.get(key(r)).goals!==r.goals).map(r=>({player:r.player,club:r.audit_club,old:oldMap.get(key(r)).goals,new:r.goals}));
const missing=old.filter(r=>!freshMap.has(key(r))).map(r=>({player:r.player,club:r.audit_club,goals:r.goals}));
const added=matched.filter(r=>!oldMap.has(key(r))).map(r=>({player:r.player,club:r.audit_club,goals:r.goals}));
const clubCount=new Set(matched.map(r=>r.audit_club)).size;
const valid=stop==='last-page'&&clubCount===15&&missing.length===0&&matched.length>=old.length;
result.ages[age]={total:rows.length,matched:matched.length,baseline:old.length,clubs:clubCount,stop,valid,changed,missing,added,network:network.slice(-100)};
if(!valid)result.warnings.push(age+': incomplete/unmatched data; no publication');
fs.writeFileSync(out+'/'+age.toLowerCase()+'-garden-state.json',JSON.stringify(matched,null,2));
console.log(age+': '+rows.length+' total, '+matched.length+' Garden State, '+clubCount+' clubs, '+changed.length+' changed, '+missing.length+' missing, '+added.length+' added, stop='+stop);
}catch(e){result.ages[age]={error:String(e),network:network.slice(-100)};result.warnings.push(age+': '+String(e));console.error(age+': '+String(e));}
await page.close();
}
}finally{await browser.close();fs.writeFileSync(out+'/comparison.json',JSON.stringify(result,null,2));}
console.log(JSON.stringify({status:result.status,warnings:result.warnings},null,2));
