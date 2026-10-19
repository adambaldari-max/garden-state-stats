// Read-only: goal events for every completed Garden State match (FootyAccess match detail endpoint).
import fs from 'node:fs';
const out='probe-output';fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
const games=JSON.parse(fs.readFileSync('probe/gs-completed.json','utf8'));
const res=[];
for(const g of games){
  let d=null,status=null;
  for(let a=0;a<3&&!d;a++){try{const r=await fetch(`https://footy-access-dev.onrender.com/api/scores/enhanced/kitman_${g.id}`,{headers:{'user-agent':'Mozilla/5.0'}});status=r.status;if(r.ok)d=await r.json()}catch(e){status=String(e)}if(!d)await new Promise(r=>setTimeout(r,1500))}
  res.push({...g,status,fa:d?{home:d.homeTeam?.name,away:d.awayTeam?.name,hs:d.homeTeam?.score,as:d.awayTeam?.score,updatedAt:d.updatedAt||d.lastUpdated||null,events:(d.events||[]).map(e=>({t:e.eventType,side:e.team,pside:e.playerTeam,p:e.player,pid:e.sourcePlayerId,m:e.minute,am:e.addedMinute,parent:e.parentEventId})),homeRoster:(d.homeTeam?.roster||[]).map(x=>({n:x.name,j:x.jerseyNumber,id:x.playerId})),awayRoster:(d.awayTeam?.roster||[]).map(x=>({n:x.name,j:x.jerseyNumber,id:x.playerId}))}:null});
  await new Promise(r=>setTimeout(r,250));
}
fs.writeFileSync(out+'/gs-events.json',JSON.stringify({collected:new Date().toISOString(),games:res}));
console.log('games',res.length,'ok',res.filter(x=>x.fa).length);
