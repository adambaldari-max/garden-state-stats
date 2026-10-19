// Read-only: save the Garden State U13/U14 slice of the official MLS NEXT schedule and standings feeds.
import fs from 'node:fs';
const out='probe-output';fs.mkdirSync(out,{recursive:true});
const GS=new Set(["AB7 Future Academy","Cedar Stars Academy Bergen","Cedar Stars Academy Monmouth","Cedar Stars Academy Newark","Ironbound Soccer Club","Jersey Football Club","PDA Hibernian","PDA SC Vistula","Players Development Academy","Real Futbol Academy","TSF Academy","The Football Academy","Torpedoes SC","Trenton City Soccer Club","Union County Football Club"]);
const base='https://mls-assist.theintelligenceplatform.com/data';
const get=async u=>{const r=await fetch(u+'?_t='+Date.now(),{headers:{'user-agent':'Mozilla/5.0'}});if(!r.ok)throw Error(u+' '+r.status);return r.json()};
const sched=await get(base+'/schedule/mls-next-league-26-27.json');
const ages=new Set(['U13','U14']);
const ev=sched.events.filter(e=>ages.has(e.home_squad_name)&&(GS.has(e.home_organisation?.name)||GS.has(e.away_organisation?.name)));
fs.writeFileSync(out+'/official-gs-events.json',JSON.stringify({top_keys:Object.keys(sched),count_all:sched.events.length,events:ev},null,1));
const st=await get(base+'/standings/mls-next-league-26-27.json');
const br=st.competition_season.competition_brackets.filter(b=>ages.has(b.age_group?.name)&&b.standings.some(s=>GS.has(s.team.name)));
fs.writeFileSync(out+'/official-gs-standings.json',JSON.stringify({tiebreakers:st.competition_season.tiebreakers,brackets:br},null,1));
console.log('events',ev.length,'brackets',br.map(b=>b.name+' '+b.age_group.name));
