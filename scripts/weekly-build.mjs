#!/usr/bin/env node
// Safe, reviewed updates to embedded U13/U14 JSON. No network or deployment.
// node scripts/weekly-build.mjs index.html reviewed-updates.json output/index.html
import fs from 'node:fs';
import path from 'node:path';
const [input,changesPath,output]=process.argv.slice(2);
if(!input||!changesPath||!output) throw Error('Usage: node scripts/weekly-build.mjs input.html reviewed-updates.json output.html');
if(path.resolve(input)===path.resolve(output)) throw Error('Output must not overwrite input');
const source=fs.readFileSync(input,'utf8');
const changes=JSON.parse(fs.readFileSync(changesPath,'utf8'));
if(changes.approved!==true) throw Error('Changes must be explicitly approved');
if(!/^\d{4}-\d{2}-\d{2}$/.test(changes.snapshot_date)) throw Error('Invalid snapshot_date');
if(!changes.source_note || typeof changes.source_note!=='string') throw Error('Missing source_note');
if(!changes.ages || Object.keys(changes.ages).some(a=>!['U13','U14'].includes(a))) throw Error('Invalid ages');
let result=source;
const report={snapshot_date:changes.snapshot_date,ages:{}};
for(const age of ['U13','U14']){
  const prefix='const DATA_'+age+'=';
  const start=result.indexOf(prefix);
  if(start<0) throw Error('Missing '+age);
  const from=start+prefix.length,end=result.indexOf(';',from);
  const db=JSON.parse(result.slice(from,end));
  const updates=changes.ages[age]||{};
  const reportAge={matches:[],players:[]};
  const clubs=new Set(db.standings.map(t=>t.team));
  const eventMap=new Map(db.matches.filter(m=>m.event_id).map(m=>[String(m.event_id),m]));
  for(const u of updates.matches||[]){
    if(!u.event_id || !eventMap.has(String(u.event_id))) throw Error(age+' unknown event ID '+u.event_id+'; reconcile manually first');
    if(u.verified!==true || !u.source_url) throw Error(age+' match requires verified=true and source_url');
    const old=eventMap.get(String(u.event_id));
    const allowed=['date','home','away','hs','as_','completed'];
    if(Object.keys(u).some(k=>!['event_id','verified','source_url','correction_reason',...allowed].includes(k))) throw Error('Unexpected match field');
    const changed=allowed.filter(k=>Object.hasOwn(u,k)&&u[k]!==old[k]);
    if(!changed.length) continue;
    if(old.completed && (!u.correction_reason || !u.correction_reason.trim())) throw Error(age+' historical result change requires correction_reason: '+u.event_id);
    const next={...old};for(const k of changed)next[k]=u[k];
    if(!clubs.has(next.home)||!clubs.has(next.away)||next.home===next.away) throw Error('Invalid clubs');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(next.date)) throw Error('Invalid match date');
    if(next.completed && (![next.hs,next.as_].every(v=>Number.isInteger(v)&&v>=0))) throw Error('Invalid completed score');
    if(!next.completed){next.hs=null;next.as_=null;}
    reportAge.matches.push({event_id:String(u.event_id),before:{...old},after:{...next},source_url:u.source_url,reason:u.correction_reason||'New verified result or fixture change'});
    Object.assign(old,next);
  }
  for(const u of updates.players||[]){
    if(!u.player||!u.audit_club||!Object.hasOwn(u,'goals')||!u.source_url||u.verified!==true) throw Error(age+' player update requires player, club, goals, source_url and verified');
    if(!Number.isInteger(u.goals)||u.goals<0||!clubs.has(u.audit_club)) throw Error('Invalid player update');
    const matches=db.scorers.filter(p=>p.player===u.player&&p.audit_club===u.audit_club&&(u.jersey===undefined||String(p.jersey??'')===String(u.jersey)));
    if(matches.length!==1) throw Error(age+' player identity not unique or absent: '+u.player+'; reconcile manually');
    const p=matches[0];
    if(p.goals===u.goals)continue;
    if(u.goals<p.goals&&!u.correction_reason) throw Error('Decreasing goals requires correction_reason');
    reportAge.players.push({player:u.player,club:u.audit_club,before:p.goals,after:u.goals,source_url:u.source_url,reason:u.correction_reason||'Verified scoring update'});
    p.goals=u.goals;
  }
  if(reportAge.matches.length||reportAge.players.length){
    db.updated=changes.snapshot_date;
    db.source_note=changes.source_note;
    // Ranks must reflect the newly verified MLS NEXT totals.
    db.scorers.sort((a,b)=>b.goals-a.goals||a.player.localeCompare(b.player));
    db.scorers.forEach((p,i)=>p.rank=i+1);
  }
  report.ages[age]=reportAge;
  result=result.slice(0,from)+JSON.stringify(db)+result.slice(end);
}
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,result);
fs.writeFileSync(output+'.changes.json',JSON.stringify(report,null,2)+'\n');
console.log('Wrote '+output+' and '+output+'.changes.json. Run audit and browser tests before publishing.');
