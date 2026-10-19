#!/usr/bin/env node
// Reconcile external source exports against embedded website records.
// Usage: node scripts/weekly-reconcile.mjs index.html imports/source-snapshot.json output/reconciliation.json
// Source snapshot is a machine-readable capture of official/FootyAccess data; no guessing.
import fs from 'node:fs';
import path from 'node:path';
const [htmlPath, snapshotPath, outputPath]=process.argv.slice(2);
if(!htmlPath||!snapshotPath||!outputPath) throw Error('Usage: node scripts/weekly-reconcile.mjs index.html source-snapshot.json output/reconciliation.json');
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const html=fs.readFileSync(htmlPath,'utf8');
const snapshot=readJson(snapshotPath);
function embedded(age){
 const prefix='const DATA_'+age+'=',start=html.indexOf(prefix);
 if(start<0) throw Error('Missing '+age);
 const from=start+prefix.length,end=html.indexOf(';',from);
 return JSON.parse(html.slice(from,end));
}
const report={generated_at:new Date().toISOString(),snapshot:snapshot.captured_at||null,ages:{},summary:{new:0,changed:0,conflicts:0,unmatched:0,unchanged:0}};
const proposed={approved:false,snapshot_date:snapshot.captured_at?.slice(0,10)||new Date().toISOString().slice(0,10),source_note:'PROPOSED ONLY — review all source evidence before approval',ages:{}};
for(const age of ['U13','U14']){
 const db=embedded(age),input=snapshot.ages?.[age]||{};
 const known=new Map(db.matches.filter(m=>m.event_id).map(m=>[String(m.event_id),m]));
 const clubs=new Set(db.standings.map(t=>t.team));
 const out={new:[],changed:[],conflicts:[],unmatched:[],unchanged:[],players:[]};
 const approvedMatches=[],approvedPlayers=[],seen=new Set();
 for(const m of input.matches||[]){
  const id=String(m.event_id??'');
  if(!id||seen.has(id)){out.conflicts.push({reason:'Missing or duplicate source event_id',incoming:m});continue}
  seen.add(id);
  if(!m.source_url||!/^https?:\/\//.test(m.source_url)){out.conflicts.push({reason:'Missing valid evidence URL',incoming:m});continue}
  if(!clubs.has(m.home)||!clubs.has(m.away)||m.home===m.away){out.conflicts.push({reason:'Unknown or invalid club identity',incoming:m});continue}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(m.date)){out.conflicts.push({reason:'Invalid date',incoming:m});continue}
  if(typeof m.completed!=='boolean'||(m.completed&&(!Number.isInteger(m.hs)||m.hs<0||!Number.isInteger(m.as_)||m.as_<0))){out.conflicts.push({reason:'Invalid status or final score',incoming:m});continue}
  const old=known.get(id);
  if(!old){out.new.push({incoming:m,reason:'New event ID — builder does not add fixtures automatically'});continue}
  const fields=['date','home','away','completed','hs','as_'];
  const diffs=fields.filter(k=>(m[k]??null)!==(old[k]??null)).map(k=>({field:k,old:old[k]??null,incoming:m[k]??null}));
  if(!diffs.length){out.unchanged.push(id);continue}
  const entry={event_id:id,changes:diffs,source_url:m.source_url,source_name:m.source_name||null};
  if(old.completed && (m.hs!==old.hs||m.as_!==old.as_||!m.completed)){
    out.conflicts.push({...entry,reason:'Historical completed result correction — manual review required'});
    continue;
  }
  if(!m.completed && old.completed){out.conflicts.push({...entry,reason:'Completed match reverted to scheduled'});continue}
  out.changed.push(entry);
  approvedMatches.push({event_id:id,date:m.date,home:m.home,away:m.away,completed:m.completed,hs:m.completed?m.hs:null,as_:m.completed?m.as_:null,verified:false,source_url:m.source_url});
 }
 const existing=new Map();
 for(const p of db.scorers){const key=p.audit_club+'|'+p.player;const a=existing.get(key)||[];a.push(p);existing.set(key,a)}
 for(const p of input.players||[]){
  if(!p.source_url||!p.player||!p.audit_club||!Number.isInteger(p.goals)||p.goals<0){out.conflicts.push({reason:'Incomplete player evidence',incoming:p});continue}
  const matches=existing.get(p.audit_club+'|'+p.player)||[];
  if(matches.length!==1){out.unmatched.push({type:'player',incoming:p,reason:'New or ambiguous player identity'});continue}
  const old=matches[0];
  if(old.goals===p.goals)continue;
  const entry={player:p.player,club:p.audit_club,previous:old.goals,incoming:p.goals,source_url:p.source_url};
  if(p.goals<old.goals){out.conflicts.push({...entry,reason:'Decrease in season total requires verification'});continue}
  out.players.push(entry);
  approvedPlayers.push({player:p.player,audit_club:p.audit_club,goals:p.goals,verified:false,source_url:p.source_url});
 }
 report.ages[age]=out;
 proposed.ages[age]={matches:approvedMatches,players:approvedPlayers};
 for(const k of ['new','changed','conflicts','unmatched','unchanged'])report.summary[k]+=out[k].length;
}
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n');
const proposedPath=outputPath.replace(/\.json$/,'')+'.proposed.json';
fs.writeFileSync(proposedPath,JSON.stringify(proposed,null,2)+'\n');
console.log(JSON.stringify({report:outputPath,proposed:proposedPath,summary:report.summary},null,2));
console.log('No HTML modified. Proposed changes remain unapproved and unverified.');
