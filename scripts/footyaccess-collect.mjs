import { chromium } from 'playwright';
import fs from 'node:fs';
const out='footyaccess-output';fs.mkdirSync(out,{recursive:true});
const html=fs.readFileSync('index.html','utf8');
function baseline(age){const k='const DATA_'+age+'=';const i=html.indexOf(k);if(i<0)throw Error('Baseline not found: '+age);return JSON.parse(html.slice(i+k.length,html.indexOf(';',i)));}
const norm=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const clubs=baseline('U13').standings.map(x=>x.team);
const aliases=new Map(clubs.map(c=>[norm(c),c]));
const report={generated:new Date().toISOString(),mode:'read-only',ages:{},warnings:[]};
const browser=await chromium.launch({headless:true});
try{
const context=await browser.newContext();
const page=await context.newPage();
await page.goto('https://www.footyaccess.com/leagues/mls-next?ageGroups=U13',{waitUntil:'domcontentloaded',timeout:60000});
for(const age of ['U13','U14']){
try{
const players=[];let expected=null;let stoppedOnEmpty=false;let terminalPage=null;const pages=[];
for(let n=0;n<100;n++){
const url='https://footy-access-dev.onrender.com/api/mls-next/stats/dashboard?season=2027&ageGroup='+age+'&metric=goals&page='+n+'&q=';
const response=await context.request.get(url,{timeout:60000});
if(!response.ok())throw Error('HTTP '+response.status()+' on page '+n);
const payload=await response.json();const d=payload.data;
if(!payload.success||!d||!Array.isArray(d.players))throw Error('Unexpected API response on page '+n);
if(d.page!==n)throw Error('API page mismatch: expected '+n+', got '+d.page);
if(expected===null)expected=d.totalPlayers;
if(!Number.isInteger(expected)||expected<0||d.totalPlayers!==expected)throw Error('Invalid or changing totalPlayers on page '+n);
if(!d.players.length){stoppedOnEmpty=true;terminalPage=n;break;}
pages.push({page:n,count:d.players.length,hasMore:d.hasMore,firstId:d.players[0]?.playerId,lastId:d.players.at(-1)?.playerId});
players.push(...d.players);
console.log(age+' page '+n+': '+d.players.length+' records, total '+players.length+'/'+expected);
if(players.length>expected)throw Error('Collected more records than reported total');

}
fs.writeFileSync(out+'/'+age.toLowerCase()+'-all.json',JSON.stringify(players,null,2));
const reportedCountGap=expected-players.length;
const lastPage=pages.at(-1);
const pageSequenceValid=pages.every((p,i)=>p.page===i&&p.count>0&&(i===pages.length-1||p.count===50));
const paginationComplete=pageSequenceValid&&!!lastPage&&lastPage.hasMore===false&&stoppedOnEmpty&&terminalPage===lastPage.page+1&&reportedCountGap===0;
const paginationAudit={reportedCountGap,pageSequenceValid,lastPage,terminalPage,method:'zero-based pages, stable total, terminal page hasMore=false and next page empty'};
if(players.some(p=>p.ageGroup!==age))throw Error('Cross-age players detected');
const unique=new Set(players.map(p=>p.playerId));
if(unique.size!==players.length)throw Error('Duplicate player IDs: '+unique.size+'/'+players.length);
const matched=players.map(p=>({player:p.name,audit_club:aliases.get(norm(p.team)),source_club:p.team,goals:p.stats?.goals,playerId:p.playerId})).filter(p=>p.audit_club);
const old=baseline(age).scorers;
const key=p=>norm(p.player)+'|'+norm(p.audit_club);
const oldMap=new Map(old.map(p=>[key(p),p]));
const freshMap=new Map(matched.map(p=>[key(p),p]));
const changed=matched.filter(p=>oldMap.has(key(p))&&oldMap.get(key(p)).goals!==p.goals).map(p=>({player:p.player,club:p.audit_club,previous:oldMap.get(key(p)).goals,current:p.goals}));
const missing=old.filter(p=>p.goals>0&&!freshMap.has(key(p))).map(p=>({player:p.player,club:p.audit_club,previous:p.goals}));
const added=matched.filter(p=>!oldMap.has(key(p))).map(p=>({player:p.player,club:p.audit_club,current:p.goals}));

const missingLookup=[];
for(const p of missing){
 const searches=[{kind:'full-name',q:p.player},{kind:'surname',q:p.player.trim().split(/\s+/).at(-1)},{kind:'club',q:p.club}];
 const attempts=[];
 for(const item of searches){
  try{
   const url='https://footy-access-dev.onrender.com/api/mls-next/stats/dashboard?season=2027&ageGroup='+age+'&metric=goals&page=0&q='+encodeURIComponent(item.q);
   const lookup=await context.request.get(url,{timeout:30000});
   const payload=await lookup.json();
   attempts.push({kind:item.kind,query:item.q,http:lookup.status(),totalPlayers:payload.data?.totalPlayers,hasMore:payload.data?.hasMore,results:(payload.data?.players||[]).slice(0,50).map(x=>({name:x.name,team:x.team,goals:x.stats?.goals,ageGroup:x.ageGroup}))});
  }catch(e){attempts.push({kind:item.kind,error:String(e)});}
 }
 missingLookup.push({player:p.player,club:p.club,attempts});
}
fs.writeFileSync(out+'/'+age.toLowerCase()+'-missing-lookups.json',JSON.stringify(missingLookup,null,2));

const found=[...new Set(matched.map(p=>p.audit_club))];
// A second independent read detects changes while pagination is being traversed.
const firstUrl='https://footy-access-dev.onrender.com/api/mls-next/stats/dashboard?season=2027&ageGroup='+age+'&metric=goals&page=0&q=';
const checkResponse=await context.request.get(firstUrl,{timeout:60000});
if(!checkResponse.ok())throw Error('Repeat first page HTTP '+checkResponse.status());
const checkPayload=await checkResponse.json();
const initialIds=players.slice(0,pages[0]?.count||0).map(p=>p.playerId+'='+p.stats?.goals);
const repeatedIds=(checkPayload.data?.players||[]).map(p=>p.playerId+'='+p.stats?.goals);
const firstPageStable=JSON.stringify(initialIds)===JSON.stringify(repeatedIds);
if(!firstPageStable)report.warnings.push(age+': first page changed during collection; no publishing');
const valid=firstPageStable&&paginationComplete&&found.length===15&&missing.length===0&&matched.every(p=>Number.isInteger(p.goals)&&p.goals>=0);
report.ages[age]={totalPlayers:expected,collectedPlayers:players.length,paginationComplete,paginationAudit,firstPageStable,stoppedOnEmpty,matchedPlayers:matched.length,baselinePlayers:old.length,clubsFound:found.length,missingClubs:clubs.filter(c=>!found.includes(c)),changed,missing,added,missingLookup,valid};
fs.writeFileSync(out+'/'+age.toLowerCase()+'-garden-state.json',JSON.stringify(matched,null,2));
if(reportedCountGap!==0)console.warn(age+': reported total differs by '+reportedCountGap+'; no publishing');
if(!paginationComplete)report.warnings.push(age+': pagination structure not verified; no publishing');
if(!valid)report.warnings.push(age+' comparison requires review; no publishing');
console.log(age+' complete: '+expected+' total, '+matched.length+' Garden State, '+found.length+' clubs, '+changed.length+' changed, '+missing.length+' missing, '+added.length+' added');
}catch(e){report.ages[age]={error:String(e)};report.warnings.push(age+': '+String(e));console.error(age+': '+String(e));}
}
}finally{await browser.close();fs.writeFileSync(out+'/comparison.json',JSON.stringify(report,null,2));}
console.log('Read-only report saved. Website unchanged.');
