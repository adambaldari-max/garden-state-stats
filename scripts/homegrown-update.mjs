import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
export const HOMEGROWN_KEY='mls-next-league-26-27';
const BASE='https://mls-assist.theintelligenceplatform.com/data';
const requireThat=(ok,message)=>{if(!ok)throw Error(message)};
const clean=s=>String(s??'').replace(/;/g,',').replace(/\s+/g,' ').trim();
function localTime(value,zone){const d=new Date(value);requireThat(Number.isFinite(d.getTime()),'Invalid kickoff');requireThat(typeof zone==='string'&&zone,'Missing fixture timezone');const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).map(x=>[x.type,x.value]));return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`,hour:Number(p.hour)}}
export function buildHomegrown(schedule,standings,{now=new Date(),previous={}}={}){
 for(const [name,feed]of Object.entries({schedule,standings})){const time=new Date(feed.synced_at);requireThat(Number.isFinite(time.getTime())&&now-time<=72*3600000&&time-now<=3600000,name+' timestamp is missing, stale or in the future')}
 requireThat(Array.isArray(schedule.events)&&schedule.events.length>1000,'Incomplete Homegrown schedule');
 const season=standings.competition_season;requireThat(season?.key===HOMEGROWN_KEY,'Wrong Homegrown season');
 const stage=season.competition_season_stages?.find(s=>s.name==='League');requireThat(stage&&Array.isArray(stage.competition_brackets),'Missing Homegrown League stage');
 const output={};
 for(const age of ['U13','U14']){
  const group=season.age_groups?.find(x=>x.name===age);requireThat(group,'Missing '+age+' age group');
  const brackets=stage.competition_brackets.filter(b=>b.age_group_id===group.id);requireThat(brackets.length===8,age+' must cover all 8 Homegrown conferences');
  const member=new Map(),confs=brackets.map(b=>{requireThat(b.standings.length>=8,age+' incomplete '+b.name);const prior=previous[age]?.conferences?.find(c=>c.name===b.name);const teams=b.standings.map(t=>{requireThat(t.squad_name===age&&t.organisation_id&&t.name,'Invalid club in '+b.name);requireThat(!member.has(t.organisation_id),'Duplicate Homegrown club membership');member.set(t.organisation_id,b.name);return {name:clean(t.name),organisation_id:t.organisation_id,logo:t.logo_url||null}});return {name:clean(b.name),slug:clean(b.name).toLowerCase().replace(/[^a-z0-9]+/g,'-'),teams,matches:[],scorers:prior?.scorers||[],club_scorer_audits:prior?.club_scorer_audits||{},conference_scorer_audit:prior?.conference_scorer_audit||null}});
  const byName=new Map(confs.map(c=>[c.name,c])),seen=new Set();let skipped=0;const anomalies=[];
  const events=schedule.events.filter(e=>e.home_squad_name===age);requireThat(events.length>1000,age+' Homegrown schedule looks incomplete');
  for(const e of events){
   requireThat(e.away_squad_name===age&&e.competition?.id===season.competition_id,'Wrong age or competition '+e.id);
   requireThat(!seen.has(String(e.id))&&/^\d+$/.test(String(e.id)),'Duplicate or invalid fixture '+e.id);seen.add(String(e.id));
   const hc=member.get(e.home_organisation?.id),ac=member.get(e.away_organisation?.id);if(!hc||hc!==ac){skipped++;continue}
   const conf=byName.get(hc),home=clean(e.home_organisation.name),away=clean(e.away_organisation.name);requireThat(home!==away&&conf.teams.some(t=>t.name===home)&&conf.teams.some(t=>t.name===away),'Club identity mismatch '+e.id);
   const lp=localTime(e.start_time,e.local_timezone);requireThat(lp.date>='2026-07-01'&&lp.date<='2027-07-31','Wrong season date '+e.id);
   requireThat(typeof e.completed==='boolean','Invalid completion flag '+e.id);if(e.completed){requireThat([e.home_score,e.away_score].every(x=>Number.isInteger(x)&&x>=0&&x<=50),'Invalid score '+e.id);if(new Date(e.start_time)>now)anomalies.push({event_id:String(e.id),date:lp.date,home,away,reason:'Source reports a final score for a future fixture; excluded pending verification'})}
   requireThat(!e.home_penalty_shootout_score&&!e.away_penalty_shootout_score,'U13/U14 shootout requires scoring review '+e.id);
   const venue=clean(e.event_location?.name);
   conf.matches.push({event_id:String(e.id),date:lp.date,kickoff:lp.hour>=7?lp.date+'T'+lp.time:null,venue:!venue||/^(tbd|tba|to be (determined|announced))$/i.test(venue)?null:venue,home,away,completed:e.completed&&new Date(e.start_time)<=now,hs:e.completed&&new Date(e.start_time)<=now?e.home_score:null,as_:e.completed&&new Date(e.start_time)<=now?e.away_score:null,...(e.completed&&new Date(e.start_time)>now?{status:'review'}:{})});
  }
  requireThat(skipped===0,age+' has unmatched or cross-conference fixtures requiring review');
  for(const conf of confs){
   conf.matches.sort((a,b)=>a.date.localeCompare(b.date)||a.event_id.localeCompare(b.event_id));requireThat(conf.matches.length>=20,age+' missing matches for '+conf.name);
   const old=previous[age]?.conferences?.find(c=>c.name===conf.name);if(old){const next=new Map(conf.matches.map(m=>[m.event_id,m]));for(const m of old.matches){requireThat(next.has(m.event_id),'Source removed published fixture '+m.event_id);requireThat(!m.completed||next.get(m.event_id).completed,'Source removed published final '+m.event_id)}}
   const audit=conf.conference_scorer_audit;if(audit){const scores=audit.audited_scores||{};const pending=conf.matches.filter(m=>m.completed&&scores[m.event_id]!==m.hs+'-'+m.as_);audit.total_completed_matches=conf.matches.filter(m=>m.completed).length;audit.currently_reconciled_matches=audit.total_completed_matches-pending.length;audit.pending_matches=pending.map(m=>({event_id:m.event_id,date:m.date,home:m.home,away:m.away,reason:'New or corrected result needs scorer verification'}))}
  }
  output[age]={season:'2026-27',division:'Homegrown',age,source:'MLS NEXT Homegrown Division official schedule and conference membership',source_url:'https://www.mlssoccer.com/mlsnext/schedule/',synced_at:schedule.synced_at,generated:now.toISOString(),source_anomalies:anomalies,conferences:confs.sort((a,b)=>a.name.localeCompare(b.name))};
 }
 return output;
}
async function load(kind,variable){if(process.env[variable])return JSON.parse(fs.readFileSync(process.env[variable],'utf8'));const r=await fetch(`${BASE}/${kind}/${HOMEGROWN_KEY}.json?_t=${Date.now()}`,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('Homegrown '+kind+' HTTP '+r.status);return r.json()}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const [schedule,standings]=await Promise.all([load('schedule','HOMEGROWN_SCHEDULE_FILE'),load('standings','HOMEGROWN_STANDINGS_FILE')]);const previous={};for(const age of ['U13','U14']){const p='data/homegrown-'+age.toLowerCase()+'.json';if(fs.existsSync(p))previous[age]=JSON.parse(fs.readFileSync(p,'utf8'))}
 const built=buildHomegrown(schedule,standings,{previous});fs.mkdirSync('data',{recursive:true});
 for(const [age,data]of Object.entries(built)){fs.writeFileSync('data/homegrown-'+age.toLowerCase()+'.json',JSON.stringify(data));console.log(age+': '+data.conferences.length+' Homegrown conferences, '+data.conferences.reduce((n,c)=>n+c.teams.length,0)+' teams, '+data.conferences.reduce((n,c)=>n+c.matches.length,0)+' fixtures')}
}
