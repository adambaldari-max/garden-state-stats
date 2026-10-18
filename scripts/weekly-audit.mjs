#!/usr/bin/env node
// Read-only baseline/weekly validator for the standalone HTML website.
// Usage: node scripts/weekly-audit.mjs index.html [previous-index.html]
import fs from 'node:fs';
import crypto from 'node:crypto';

function extract(html, age) {
  const prefix = 'const DATA_' + age + '=';
  const start = html.indexOf(prefix);
  if (start < 0) throw Error('Missing '+prefix);
  const from = start + prefix.length;
  const end = html.indexOf(';', from);
  if (end < 0) throw Error('Missing dataset terminator for '+age);
  return JSON.parse(html.slice(from,end));
}
function identity(m) {
  return m.event_id ? 'id:'+m.event_id : 'fixture:'+m.date+'|'+m.home+'|'+m.away;
}
function audit(age, d) {
  const errors=[], warnings=[];
  const clubs=new Set(d.standings.map(t=>t.team));
  if (clubs.size !== d.standings.length) errors.push('Duplicate club entry');
  const seen=new Set(), events=new Set();
  for (const m of d.matches) {
    const key=identity(m);
    if (seen.has(key)) errors.push('Duplicate match '+key);
    seen.add(key);
    if (m.event_id) {
      if(events.has(String(m.event_id))) errors.push('Duplicate event ID '+m.event_id);
      events.add(String(m.event_id));
    }
    if (!clubs.has(m.home)||!clubs.has(m.away)) errors.push('Unknown club in '+key);
    if (m.home===m.away) errors.push('Self-match '+key);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(m.date)) errors.push('Invalid date '+key);
    if (m.completed && (!Number.isInteger(m.hs)||m.hs<0||!Number.isInteger(m.as_)||m.as_<0)) errors.push('Invalid final score '+key);
    if (!m.completed && (Number.isInteger(m.hs)||Number.isInteger(m.as_))) warnings.push('Uncompleted match has score '+key);
  }
  const playerKeys=new Set();
  for (const p of d.scorers) {
    const key=p.audit_club+'|'+p.player+'|'+(p.jersey??'');
    if(playerKeys.has(key)) errors.push('Duplicate player '+key);
    playerKeys.add(key);
    if(!clubs.has(p.audit_club)) errors.push('Unknown player club '+key);
    if(!Number.isInteger(p.goals)||p.goals<0) errors.push('Invalid FootyAccess total '+key);
  }
  const completed=d.matches.filter(m=>m.completed);
  const goalsFor=completed.reduce((s,m)=>s+m.hs+m.as_,0);
  const totals={played:completed.length,clubs:clubs.size,fixtures:d.matches.length,players:d.scorers.length,goalsFor,goalsAgainst:goalsFor,updated:d.updated};
  return {age,totals,errors,warnings};
}
function compare(before,after) {
  const old=new Map(before.matches.map(m=>[identity(m),m]));
  const now=new Map(after.matches.map(m=>[identity(m),m]));
  const added=[],removed=[],changed=[];
  for(const [id,m] of now){
    if(!old.has(id)) added.push({id,match:m});
    else {
      const b=old.get(id),fields=['date','home','away','hs','as_','completed'];
      const diffs=fields.filter(k=>b[k]!==m[k]).map(k=>({field:k,previous:b[k]??null,current:m[k]??null}));
      if(diffs.length) changed.push({id,diffs});
    }
  }
  for(const [id,m] of old) if(!now.has(id)) removed.push({id,match:m});
  const key=p=>p.audit_club+'|'+p.player+'|'+(p.jersey??'');
  const oldPlayers=new Map(before.scorers.map(p=>[key(p),p]));
  const playerChanges=[];
  for(const p of after.scorers) {
    const b=oldPlayers.get(key(p));
    if(!b) playerChanges.push({player:key(p),change:'new',goals:p.goals});
    else if(b.goals!==p.goals) playerChanges.push({player:key(p),change:'goals',previous:b.goals,current:p.goals});
  }
  for(const [k] of oldPlayers) if(!after.scorers.some(p=>key(p)===k)) playerChanges.push({player:k,change:'removed — verify'});
  return {added,removed,changed,playerChanges};
}
const currentPath=process.argv[2]||'index.html';
const previousPath=process.argv[3];
const html=fs.readFileSync(currentPath,'utf8');
const previous=previousPath?fs.readFileSync(previousPath,'utf8'):null;
const report={file:currentPath,sha256:crypto.createHash('sha256').update(html).digest('hex'),ages:{}};
for(const age of ['U13','U14']){
  const data=extract(html,age);
  const result=audit(age,data);
  if(previous) result.changes=compare(extract(previous,age),data);
  report.ages[age]=result;
}
console.log(JSON.stringify(report,null,2));
if(Object.values(report.ages).some(r=>r.errors.length)) process.exitCode=1;
