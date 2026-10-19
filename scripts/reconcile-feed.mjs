#!/usr/bin/env node
// Read-only comparison of a Kitman/MLS NEXT Academy Division feed against site HTML.
// node scripts/reconcile-feed.mjs index.html mls-next-2-academy-division-26-27.json output/reconciliation.json
import fs from 'node:fs';
import path from 'node:path';
const [htmlPath,feedPath,reportPath]=process.argv.slice(2);
if(!htmlPath||!feedPath||!reportPath) throw Error('Usage: node scripts/reconcile-feed.mjs index.html feed.json output/reconciliation.json');
const parse=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const html=fs.readFileSync(htmlPath,'utf8');
const feed=parse(feedPath);
if(!Array.isArray(feed.events)) throw Error('Feed must contain events array');
const report={synced_at:feed.synced_at??null,division:'Garden State',ages:{},warnings:[],ready_for_publication:false};
const isoDate=(event)=>{
  if(!event.start_time) return null;
  const d=new Date(event.start_time);
  if(Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA',{timeZone:event.local_timezone||'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
};
for(const age of ['U13','U14']){
  const marker='const DATA_'+age+'=';
  const at=html.indexOf(marker);
  if(at<0) throw Error('Missing '+marker);
  const start=at+marker.length,end=html.indexOf(';',start);
  const site=JSON.parse(html.slice(start,end));
  const incoming=feed.events.filter(e=>e.division?.name==='Garden State'&&e.home_squad_name===age+' AD'&&e.away_squad_name===age+' AD');
  const siteMap=new Map(),feedMap=new Map();
  const problems=[],newResults=[],scoreCorrections=[],dateChanges=[],statusChanges=[],teamChanges=[],missingFromFeed=[],missingFromSite=[],unchanged=[];
  for(const m of site.matches){
    const id=String(m.event_id??'');
    if(!id||siteMap.has(id)) problems.push({kind:'duplicate_or_missing_site_id',event_id:id});
    else siteMap.set(id,m);
  }
  for(const e of incoming){
    const id=String(e.id??'');
    if(!id||feedMap.has(id)) problems.push({kind:'duplicate_or_missing_feed_id',event_id:id});
    else feedMap.set(id,e);
  }
  for(const [id,m] of siteMap){
    const e=feedMap.get(id);
    if(!e){missingFromFeed.push({event_id:id,site:m});continue;}
    const home=e.home_organisation?.name??null,away=e.away_organisation?.name??null;
    const date=isoDate(e);
    const entry={event_id:id,home:m.home,away:m.away,site_date:m.date,feed_date:date,site_completed:!!m.completed,feed_completed:!!e.completed,site_score:m.completed?[m.hs,m.as_]:null,feed_score:e.completed?[e.home_score,e.away_score]:null};
    let changed=false;
    if(home!==m.home||away!==m.away){teamChanges.push({...entry,feed_home:home,feed_away:away});changed=true;}
    if(date!==m.date){dateChanges.push(entry);changed=true;}
    if(!!e.completed&&!m.completed){
      if(!Number.isInteger(e.home_score)||!Number.isInteger(e.away_score))problems.push({kind:'completed_without_integer_score',event_id:id});
      else newResults.push(entry);
      changed=true;
    }else if(!!e.completed&&!!m.completed&&(e.home_score!==m.hs||e.away_score!==m.as_)){
      scoreCorrections.push(entry);changed=true;
    }else if(!!e.completed!==!!m.completed){statusChanges.push(entry);changed=true;}
    if(!changed)unchanged.push(id);
  }
  for(const [id,e] of feedMap)if(!siteMap.has(id))missingFromSite.push({event_id:id,date:isoDate(e),home:e.home_organisation?.name,away:e.away_organisation?.name,completed:!!e.completed,score:e.completed?[e.home_score,e.away_score]:null});
  report.ages[age]={counts:{site_fixtures:site.matches.length,feed_fixtures:incoming.length,site_completed:site.matches.filter(m=>m.completed).length,feed_completed:incoming.filter(e=>e.completed).length,unchanged:unchanged.length,new_results:newResults.length,score_corrections:scoreCorrections.length,date_changes:dateChanges.length,status_changes:statusChanges.length,team_changes:teamChanges.length,missing_from_feed:missingFromFeed.length,missing_from_site:missingFromSite.length,problems:problems.length},new_results:newResults,score_corrections:scoreCorrections,date_changes:dateChanges,status_changes:statusChanges,team_changes:teamChanges,missing_from_feed:missingFromFeed,missing_from_site:missingFromSite,problems};
}
fs.mkdirSync(path.dirname(reportPath),{recursive:true});
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({synced_at:report.synced_at,ages:Object.fromEntries(Object.entries(report.ages).map(([age,r])=>[age,r.counts]))},null,2));
console.log('Review report: '+reportPath+' (read-only; nothing published)');
