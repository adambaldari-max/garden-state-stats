import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const ROOT='https://footy-access-dev.onrender.com/api/scores/enhanced/kitman_';
const clean=s=>String(s??'').replace(/;/g,',').replace(/\s+/g,' ').trim();
const norm=s=>clean(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function reconcileHomegrown(data,reports,{now=new Date()}={}){
 const output=structuredClone(data),day=now.toISOString().slice(0,10),summary=[];
 for(const conf of output.conferences){
  const finished=conf.matches.filter(m=>m.completed),valid=[],pending=[];
  for(const m of finished){
   const r=reports.get(m.event_id),goals=r?.goals||[];let reason=null;
   if(!r)reason='Match report unavailable';
   else if(r.home!==m.home||r.away!==m.away||r.hs!==m.hs||r.as!==m.as_)reason='Match report does not match the official final score';
   else if(goals.some(e=>!['home','away'].includes(e.side)||(!e.own&&!clean(e.player))))reason='Goal event has no named player or team';
   else if(goals.filter(e=>e.side==='home').length!==m.hs||goals.filter(e=>e.side==='away').length!==m.as_)reason='Named goal events do not add up to the final score';
   else {const ids=goals.map(e=>e.id).filter(Boolean);if(new Set(ids).size!==ids.length)reason='Duplicate goal event IDs'}
   if(reason)pending.push({...m,reason});else valid.push({m,goals});
  }
  const records=new Map(),clubs=Object.fromEntries(conf.teams.map(t=>[t.name,{checked_at:day,last_completed_match:null,completed_matches:0,team_goals:0,player_goals:0,own_goals_received:0,match_ids:[],pending_matches:[]}])) ,scores={};
  for(const {m,goals}of valid){
   scores[m.event_id]=m.hs+'-'+m.as_;
   for(const [name,n]of [[m.home,m.hs],[m.away,m.as_]]){const c=clubs[name];c.completed_matches++;c.team_goals+=n;c.match_ids.push(m.event_id);c.last_completed_match=[c.last_completed_match,m.date].filter(Boolean).sort().at(-1)}
   for(const g of goals){const credited=g.side==='home'?m.home:m.away;if(g.own){clubs[credited].own_goals_received++;continue}clubs[credited].player_goals++;const key=credited+'|'+(g.pid||norm(g.player));
    if(!records.has(key))records.set(key,{player:clean(g.player),audit_club:credited,source_player_id:g.pid||null,goals:0,jersey:g.jersey||'',conference_goals:0,conference_goals_verified:true,conference_goals_status:'match_events_reconciled',conference_goals_as_of:day,conference_goals_source:'Reconciled Homegrown match reports',conference_goal_events:[]});
    const p=records.get(key);p.goals++;p.conference_goals++;p.conference_goal_events.push({event_id:m.event_id,date:m.date,minute:g.minute});
   }
  }
  const old=conf.conference_scorer_audit,previousIds=Object.keys(old?.audited_scores||{}),missingPrior=previousIds.filter(id=>!(id in scores));
  const nextByName=new Map([...records.values()].map(p=>[p.audit_club+'|'+norm(p.player),p]));
  const decreases=(conf.scorers||[]).filter(p=>(nextByName.get(p.audit_club+'|'+norm(p.player))?.conference_goals||0)<(p.conference_goals||0));
  if(old&&(missingPrior.length||decreases.length)){
   const changedAttribution=new Set(decreases.flatMap(p=>(p.conference_goal_events||[]).map(e=>e.event_id)));const kept=old.audited_scores||{},review=finished.filter(m=>kept[m.event_id]!==m.hs+'-'+m.as_||!scores[m.event_id]||changedAttribution.has(m.event_id));
   old.pending_matches=review.map(m=>({event_id:m.event_id,date:m.date,home:m.home,away:m.away,reason:'Report requires review; prior verified totals retained'}));old.total_completed_matches=finished.length;old.currently_reconciled_matches=finished.length-review.length;old.last_attempted_at=now.toISOString();old.status='Published player totals retained pending source review';
   for(const [club,audit]of Object.entries(conf.club_scorer_audits||{}))audit.pending_matches=old.pending_matches.filter(m=>m.home===club||m.away===club).map(m=>({date:m.date,opponent:m.home===club?m.away:m.home,reason:m.reason}));
   summary.push({conference:conf.name,completed:finished.length,reconciled:old.currently_reconciled_matches,pending:review.length,preserved:true});continue;
  }
  for(const [club,a]of Object.entries(clubs))a.pending_matches=pending.filter(m=>m.home===club||m.away===club).map(m=>({date:m.date,opponent:m.home===club?m.away:m.home,reason:m.reason}));
  conf.scorers=[...records.values()].sort((a,b)=>b.conference_goals-a.conference_goals||a.player.localeCompare(b.player));conf.club_scorer_audits=clubs;
  const teamGoals=valid.reduce((n,x)=>n+x.m.hs+x.m.as_,0),own=valid.reduce((n,x)=>n+x.goals.filter(g=>g.own).length,0);
  conf.conference_scorer_audit={checked_at:valid.length?day:null,last_attempted_at:now.toISOString(),completed_matches:valid.length,currently_reconciled_matches:valid.length,total_completed_matches:finished.length,clubs:conf.teams.length,team_goals:teamGoals,player_goals:teamGoals-own,own_goals:own,scoring_players:records.size,audited_scores:scores,pending_matches:pending.map(m=>({event_id:m.event_id,date:m.date,home:m.home,away:m.away,reason:m.reason})),status:pending.length?'Partial attribution from reconciled conference match reports':'All recorded completed conference matches reconciled'};
  summary.push({conference:conf.name,completed:finished.length,reconciled:valid.length,pending:pending.length,scorers:records.size,preserved:false});
 }
 return {data:output,summary};
}
async function report(id){
 for(let attempt=0;attempt<2;attempt++)try{const r=await fetch(ROOT+id,{signal:AbortSignal.timeout(18000)});if(!r.ok){if(r.status===404)return null;throw Error('HTTP '+r.status)}const x=await r.json();if(!x.homeTeam||!x.awayTeam)return null;return {home:x.homeTeam.name,away:x.awayTeam.name,hs:x.homeTeam.score,as:x.awayTeam.score,goals:(x.events||[]).filter(e=>['goal','own_goal'].includes(e.eventType)).map(e=>({id:e.sourceEventId||null,side:e.team,own:e.eventType==='own_goal',player:e.player,pid:e.sourcePlayerId||null,minute:e.minute,jersey:(e.team==='home'?x.homeTeam:x.awayTeam).roster?.find(p=>String(p.playerId)===String(e.sourcePlayerId))?.jerseyNumber||''}))}}catch(e){if(attempt===1)return null;await new Promise(r=>setTimeout(r,1000))}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const inputs=['U13','U14'].map(age=>({age,path:'data/homegrown-'+age.toLowerCase()+'.json'}));for(const x of inputs)x.data=JSON.parse(fs.readFileSync(x.path,'utf8'));
 const ids=[...new Set(inputs.flatMap(x=>x.data.conferences.flatMap(c=>c.matches.filter(m=>m.completed).map(m=>m.event_id))))],reports=new Map();let cursor=0,count=0;
 await Promise.all(Array.from({length:4},async()=>{while(cursor<ids.length){if(count>=32&&[...reports.values()].filter(Boolean).length/reports.size<0.2)break;const id=ids[cursor++];reports.set(id,await report(id));count++;if(count%100===0)console.log('Homegrown scorer reports '+count+'/'+ids.length);await new Promise(r=>setTimeout(r,120))}}));
 fs.mkdirSync('homegrown-output',{recursive:true});fs.writeFileSync('homegrown-output/reports.json',JSON.stringify([...reports]));const summaries={};
 for(const x of inputs){const built=reconcileHomegrown(x.data,reports);fs.writeFileSync(x.path,JSON.stringify(built.data));summaries[x.age]=built.summary;console.log(x.age+': '+built.summary.reduce((n,c)=>n+c.reconciled,0)+' reconciled, '+built.summary.reduce((n,c)=>n+c.pending,0)+' awaiting details')}
 fs.writeFileSync('homegrown-output/coverage.json',JSON.stringify(summaries,null,2));
}
