// Read-only: national U13/U14 Academy Division matches and team list from FootyAccess.
import fs from 'node:fs';
const out='probe-output';fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
const UA={'user-agent':'Mozilla/5.0'};
const res={collected:new Date().toISOString(),ages:{}};
for(const age of ['U13','U14']){
 const r=await fetch(`https://footy-access-dev.onrender.com/api/mls-next/matches?season=2027&ageGroup=${age}&limit=20000`,{headers:UA});const j=await r.json();
 const all=j.data.matches;const comp={};for(const m of all)comp[m.competition]=(comp[m.competition]||0)+1;
 const ad=all.filter(m=>m.competition==='Academy Division').map(m=>({id:m.fixture.id.replace('kitman_',''),t:m.fixture.date,st:m.fixture.status.short,v:m.fixture.venue?.name||null,h:m.teams.home.name,a:m.teams.away.name,hs:m.goals.home,as:m.goals.away}));
 const t=await (await fetch(`https://footy-access-dev.onrender.com/api/mls-next/teams?season=2027&ageGroup=${age}`,{headers:UA})).json();
 res.ages[age]={total:all.length,competitions:comp,matches:ad,teams:t.data.teams.map(x=>({n:x.name,l:x.logo}))};
}
fs.writeFileSync(out+'/national.json',JSON.stringify(res));
console.log(Object.entries(res.ages).map(([a,v])=>a+' '+v.total+' '+JSON.stringify(v.competitions)+' teams '+v.teams.length).join('\n'));
