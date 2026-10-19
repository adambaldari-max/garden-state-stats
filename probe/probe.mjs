// Read-only: find how to page/filter the FootyAccess matches endpoint, then save the Garden State U13/U14 slice.
import fs from 'node:fs';
const out='probe-output';fs.mkdirSync(out,{recursive:true});
const UA={'user-agent':'Mozilla/5.0'};
const GS=new Set(["AB7 Future Academy","Cedar Stars Academy Bergen","Cedar Stars Academy Monmouth","Cedar Stars Academy Newark","Ironbound Soccer Club","Jersey Football Club","PDA Hibernian","PDA SC Vistula","Players Development Academy","Real Futbol Academy","TSF Academy","The Football Academy","Torpedoes SC","Trenton City Soccer Club","Union County Football Club"]);
const B='https://footy-access-dev.onrender.com/api/mls-next/matches?season=2027';
const get=async q=>{const r=await fetch(B+q,{headers:UA});const j=await r.json().catch(()=>null);return j?.data};
const all=new Map();const totals={};
for(const age of ['U13','U14']){const d=await get(`&ageGroup=${age}&limit=20000`);totals[age]=(d?.matches||[]).length;for(const m of d?.matches||[])if(GS.has(m.teams.home.name)&&GS.has(m.teams.away.name))all.set(m.fixture.id,{...m,_age:age})}
const summary=totals;
const teams={};for(const age of ['U13','U14']){const r=await fetch(`https://footy-access-dev.onrender.com/api/mls-next/teams?season=2027&ageGroup=${age}`,{headers:UA});const j=await r.json();for(const t of j.data.teams)if(GS.has(t.name))teams[t.name]=t.logo}
fs.writeFileSync(out+'/gs-matches.json',JSON.stringify({collected:new Date().toISOString(),count:all.size,matches:[...all.values()],logos:teams},null,1));
console.log(JSON.stringify(summary));
