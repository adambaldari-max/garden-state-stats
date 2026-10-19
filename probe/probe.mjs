// Read-only: find how to page/filter the FootyAccess matches endpoint, then save the Garden State U13/U14 slice.
import fs from 'node:fs';
const out='probe-output';fs.mkdirSync(out,{recursive:true});
const UA={'user-agent':'Mozilla/5.0'};
const GS=new Set(["AB7 Future Academy","Cedar Stars Academy Bergen","Cedar Stars Academy Monmouth","Cedar Stars Academy Newark","Ironbound Soccer Club","Jersey Football Club","PDA Hibernian","PDA SC Vistula","Players Development Academy","Real Futbol Academy","TSF Academy","The Football Academy","Torpedoes SC","Trenton City Soccer Club","Union County Football Club"]);
const B='https://footy-access-dev.onrender.com/api/mls-next/matches?season=2027';
const get=async q=>{const r=await fetch(B+q,{headers:UA});const j=await r.json().catch(()=>null);return j?.data};
const summary={};
const variants=['&ageGroup=U13','&ageGroup=U13&page=2','&ageGroup=U13&limit=5000','&ageGroup=U13&pageSize=5000','&ageGroup=U13&competition=Academy%20Division','&ageGroup=U13&team=AB7%20Future%20Academy','&ageGroup=U13&teamName=AB7%20Future%20Academy','&ageGroup=U13&q=AB7','&ageGroup=U13&status=FT','&ageGroup=U13&from=2026-10-01&to=2026-10-31','&ageGroup=U13&date=2026-10-18','&ageGroup=U13&offset=1000','&ageGroup=U13&skip=1000'];
for(const v of variants){const d=await get(v);const ms=d?.matches||[];const dates=ms.map(m=>m.fixture.date).sort();summary[v]={n:ms.length,keys:d?Object.keys(d):null,filters:d?.filters,first:dates[0],last:dates.at(-1),gs:ms.filter(m=>GS.has(m.teams.home.name)&&GS.has(m.teams.away.name)).length,firstId:ms[0]?.fixture?.id}}
fs.writeFileSync(out+'/variants.json',JSON.stringify(summary,null,1));
// Collect: union over club filter and month windows, whichever works.
const all=new Map();
for(const age of ['U13','U14']){for(const club of GS){for(const p of ['team','teamName','q']){const d=await get(`&ageGroup=${age}&${p}=${encodeURIComponent(club)}`);for(const m of d?.matches||[])if(GS.has(m.teams.home.name)&&GS.has(m.teams.away.name))all.set(m.fixture.id,{...m,_age:age})}}
 for(const [from,to] of [['2026-08-01','2026-09-30'],['2026-10-01','2026-10-31'],['2026-11-01','2026-12-31'],['2027-01-01','2027-03-31'],['2027-04-01','2027-07-31']]){const d=await get(`&ageGroup=${age}&from=${from}&to=${to}`);for(const m of d?.matches||[])if(GS.has(m.teams.home.name)&&GS.has(m.teams.away.name))all.set(m.fixture.id,{...m,_age:age})}
 const d=await get(`&ageGroup=${age}`);for(const m of d?.matches||[])if(GS.has(m.teams.home.name)&&GS.has(m.teams.away.name))all.set(m.fixture.id,{...m,_age:age});}
const teams={};for(const age of ['U13','U14']){const r=await fetch(`https://footy-access-dev.onrender.com/api/mls-next/teams?season=2027&ageGroup=${age}`,{headers:UA});const j=await r.json();for(const t of j.data.teams)if(GS.has(t.name))teams[t.name]=t.logo}
fs.writeFileSync(out+'/gs-matches.json',JSON.stringify({collected:new Date().toISOString(),count:all.size,matches:[...all.values()],logos:teams},null,1));
console.log(JSON.stringify(summary));
