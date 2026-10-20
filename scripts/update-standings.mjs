import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const SOURCE_URL='https://mls-assist.theintelligenceplatform.com/data/schedule/mls-next-2-academy-division-26-27.json';
const AGE_GROUPS=['U13','U14'];
const isoDay=(date,zone='America/New_York')=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const requireThat=(condition,message)=>{if(!condition)throw Error(message)};
// Read a JSON object without treating semicolons inside strings as terminators.
export function readSnapshot(html,age){const marker='const DATA_'+age+'=',at=html.indexOf(marker);requireThat(at>=0,'Missing snapshot '+age);const start=at+marker.length;let depth=0,string=false,escape=false;for(let i=start;i<html.length;i++){const c=html[i];if(string){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')string=false;}else if(c==='"')string=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0)return {data:JSON.parse(html.slice(start,i+1)),start,end:i+1};}throw Error('Unterminated snapshot '+age)}
export function standings(data){const teams=new Map(data.standings.map(t=>[t.team,{team:t.team,played:0,w:0,d:0,l:0,gf:0,ga:0}]));for(const m of data.matches){if(!m.completed)continue;requireThat(Number.isInteger(m.hs)&&Number.isInteger(m.as_),'Invalid final score '+m.event_id);for(const [name,gf,ga]of [[m.home,m.hs,m.as_],[m.away,m.as_,m.hs]]){const t=teams.get(name);requireThat(t,'Unknown club '+name);t.played++;t.gf+=gf;t.ga+=ga;if(gf>ga)t.w++;else if(gf===ga)t.d++;else t.l++;}}const rows=[...teams.values()];for(const t of rows){t.pts=3*t.w+t.d;t.gd=t.gf-t.ga;t.ppm=t.played?t.pts/t.played:0}rows.sort((a,b)=>b.ppm-a.ppm||b.gd-a.gd||b.gf-a.gf||a.team.localeCompare(b.team));rows.forEach((t,i)=>t.rank=i+1);return rows}
export function isScheduledWindow(schedule,now=new Date()){const offset=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',timeZoneName:'shortOffset'}).formatToParts(now).find(x=>x.type==='timeZoneName').value;return schedule===(offset==='GMT-4'?'30 8 * * 2,3':'30 9 * * 2,3')}

export function updateFromFeed(html,feed,{now=new Date(),sourceUrl=SOURCE_URL}={}){
 requireThat(!Number.isNaN(now.getTime()),'Invalid check time');
 requireThat(Array.isArray(feed.events)&&feed.events.length>0,'Empty or malformed schedule feed');
 const synced=new Date(feed.synced_at);requireThat(!Number.isNaN(synced.getTime()),'Missing feed sync time');
 requireThat(synced<=new Date(now.getTime()+3600000),'Feed sync time is in the future');
 requireThat(now-synced<=72*3600000,'Schedule feed is stale (over 72 hours)');
 const report={checked_at:now.toISOString(),source_url:sourceUrl,source_synced_at:feed.synced_at,ages:{},warnings:[]};
 let output=html;
 for(const age of AGE_GROUPS){
  const {data,start,end}=readSnapshot(output,age),before=structuredClone(data),clubs=new Set(data.standings.map(t=>t.team));requireThat(clubs.size===15,age+' baseline must have 15 clubs');
  const incoming=feed.events.filter(e=>e.division?.name==='Garden State'&&e.home_squad_name===age+' AD'&&e.away_squad_name===age+' AD');
  requireThat(incoming.length>0,'No Garden State '+age+' fixtures');
  const seen=new Set(),foundClubs=new Set(),normalized=[];
  for(const e of incoming){
   requireThat(e.competition?.name==='Academy Division','Wrong competition '+e.id);
   const id=String(e.id??'');requireThat(/^\d+$/.test(id)&&!seen.has(id),'Duplicate or invalid event ID '+id);seen.add(id);
   const home=e.home_organisation?.name,away=e.away_organisation?.name;requireThat(home!==away&&clubs.has(home)&&clubs.has(away),'Unknown or invalid clubs '+id);foundClubs.add(home);foundClubs.add(away);
   requireThat(typeof e.completed==='boolean','Invalid completed flag '+id);const date=new Date(e.start_time);requireThat(!Number.isNaN(date.getTime()),'Invalid match timestamp '+id);requireThat(typeof e.local_timezone==='string'&&e.local_timezone.length>0,'Missing local timezone '+id);const day=isoDay(date,e.local_timezone);requireThat(day>='2026-07-01'&&day<='2027-07-31','Wrong season '+id);
   if(e.completed){requireThat([e.home_score,e.away_score].every(x=>Number.isInteger(x)&&x>=0&&x<=50),'Invalid final score '+id);requireThat(day<=isoDay(now,e.local_timezone),'Future final result '+id);}
   normalized.push({event_id:id,date:day,home,away,completed:e.completed,hs:e.completed?e.home_score:null,as_:e.completed?e.away_score:null});
  }
  requireThat(foundClubs.size===15,age+' source does not cover 15 clubs');
  const oldById=new Map(before.matches.map(m=>[String(m.event_id),m]));requireThat(oldById.size===before.matches.length,age+' duplicate baseline IDs');
  for(const id of oldById.keys())requireThat(seen.has(id),age+' source missing published fixture '+id);
  const newResults=[],corrections=[],fixtureChanges=[],added=[];
  const matches=normalized.map(next=>{const old=oldById.get(next.event_id);if(!old){added.push(next);return {...next,result_source:sourceUrl}}requireThat(old.home===next.home&&old.away===next.away,'Fixture identity changed '+next.event_id);requireThat(!old.completed||next.completed,'Source would remove published final '+next.event_id);if(old.completed&&(old.hs!==next.hs||old.as_!==next.as_))corrections.push({event_id:next.event_id,before:[old.hs,old.as_],after:[next.hs,next.as_]});if(!old.completed&&next.completed)newResults.push(next);if(old.date!==next.date)fixtureChanges.push({event_id:next.event_id,before:old.date,after:next.date});const result={...old,...next};if(next.completed){delete result.status;delete result.status_source;result.result_source=sourceUrl;}return result;}).sort((a,b)=>a.date.localeCompare(b.date)||a.event_id.localeCompare(b.event_id));
  const priorRows=standings(before),changed=newResults.length>0||corrections.length>0||added.some(m=>m.completed);
  if(changed){data.previous_ranks=Object.fromEntries(priorRows.map(t=>[t.team,t.rank]));data.previous_updated=before.results_checked_at?isoDay(new Date(before.results_checked_at)):before.updated;data.rank_baseline_label='Previous published results';}
  data.matches=matches;data.standings=standings(data);data.updated=isoDay(now);data.results_checked_at=now.toISOString();data.results_source_synced_at=feed.synced_at;data.results_source_url=sourceUrl;data.source_note='Results and fixtures refreshed from the MLS NEXT Academy Division schedule feed. Match timestamps are converted using each fixture’s published local timezone. Unreported fixtures are excluded from completed-match calculations.';
  data.meta={...data.meta,completed:matches.filter(m=>m.completed).length,scheduled:matches.filter(m=>!m.completed).length};
  // A result refresh does not invent player goals or extend a scorer audit.
  const corrected=new Set(corrections.map(c=>c.event_id));
  for(const [club,audit]of Object.entries(data.club_scorer_audits||{})){const audited=new Set(audit.match_ids||[]);audit.unreconciled_match_ids=matches.filter(m=>m.completed&&(m.home===club||m.away===club)&&(!audited.has(m.event_id)||corrected.has(m.event_id))).map(m=>m.event_id);}
  const checkedIds=new Set(data.conference_scorer_audit?.events?.map(e=>e.event_id)||[]);
  if(data.conference_scorer_audit?.events){data.conference_scorer_audit.unreconciled_match_ids=matches.filter(m=>m.completed&&(!checkedIds.has(m.event_id)||corrected.has(m.event_id))).map(m=>m.event_id);data.conference_scorer_audit.status=data.conference_scorer_audit.unreconciled_match_ids.length?'Partial player attribution: additional match results require scorer reconciliation':'All recorded completed conference matches reconciled to named events';}
  if(corrected.size){for(const p of data.scorers){if(p.conference_goal_events?.some(e=>corrected.has(e.event_id))){p.conference_goals_verified=false;p.conference_goals_status='score_correction_requires_review';}}}
  data.scorer_note='Golden Boot displays conference player goals only. Result updates do not extend scorer coverage. See saved club audits and the current player-goal attribution coverage.';
  // Validate using the same calculator shipped in the page.
  const uiCode=output.slice(output.indexOf('function calculateStandings'),output.indexOf('function rankMovement'));const context={};vm.createContext(context);vm.runInContext(uiCode,context);requireThat(JSON.stringify(context.calculateStandings(data))===JSON.stringify(data.standings),age+' server/browser standings mismatch');
  report.ages[age]={fixtures:matches.length,completed:matches.filter(m=>m.completed).length,new_results:newResults,score_corrections:corrections,date_changes:fixtureChanges,added_fixtures:added,standings_changed:changed,rank_baseline:data.previous_updated};
  output=output.slice(0,start)+JSON.stringify(data)+output.slice(end);
 }
 for(const match of output.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
 return {html:output,report};
}

async function main(){const args=process.argv.slice(2),option=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1]};const input=option('--html','index.html'),out=option('--out',input),reportPath=option('--report','schedule-output/report.json');const feedPath=option('--feed',null);let feed;if(feedPath)feed=JSON.parse(fs.readFileSync(feedPath,'utf8'));else {const response=await fetch(SOURCE_URL,{signal:AbortSignal.timeout(120000),headers:{'Accept':'application/json'}});requireThat(response.ok,'Feed HTTP '+response.status);feed=await response.json();}const result=updateFromFeed(fs.readFileSync(input,'utf8'),feed,{now:new Date(option('--now',new Date().toISOString()))});fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(reportPath,JSON.stringify(result.report,null,2)+'\n');fs.writeFileSync(path.join(path.dirname(reportPath),'filtered-source.json'),JSON.stringify({synced_at:feed.synced_at,events:feed.events.filter(e=>e.division?.name==='Garden State'&&['U13 AD','U14 AD'].includes(e.home_squad_name)&&e.home_squad_name===e.away_squad_name)},null,2)+'\n');const temporary=out+'.tmp';fs.writeFileSync(temporary,result.html);fs.renameSync(temporary,out);console.log(JSON.stringify(result.report,null,2));}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error('Standings refresh rejected:',error.message);process.exitCode=1});
