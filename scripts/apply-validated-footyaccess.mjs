import fs from 'node:fs';
const file='index.html';
let html=fs.readFileSync(file,'utf8');
const report=JSON.parse(fs.readFileSync('footyaccess-output/comparison.json','utf8'));
if(report.warnings.length||!['U13','U14'].every(age=>report.ages[age]?.valid)) {
 console.log('Player data not validated; keeping existing website totals.');
 process.exit(0);
}
const norm=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
for(const age of ['U13','U14']){
 const marker='const DATA_'+age+'=';
 const i=html.indexOf(marker), start=i+marker.length, end=html.indexOf(';',start);
 if(i<0||end<0)throw Error('Missing site data '+age);
 const data=JSON.parse(html.slice(start,end));
 const players=JSON.parse(fs.readFileSync('footyaccess-output/'+age.toLowerCase()+'-garden-state.json','utf8'));
 const keyed=new Map(players.map(p=>[norm(p.player)+'|'+norm(p.audit_club),p]));
 const oldCount=data.scorers.length;
 for(const player of data.scorers){
  const next=keyed.get(norm(player.player)+'|'+norm(player.audit_club));
  if(next){
   if(!Number.isInteger(next.goals)||next.goals<0)throw Error('Invalid goals '+player.player);
   player.goals=next.goals;
  }
 }
 const existing=new Set(data.scorers.map(p=>norm(p.player)+'|'+norm(p.audit_club)));
 for(const p of players){
  const key=norm(p.player)+'|'+norm(p.audit_club);
  if(!existing.has(key)){
   data.scorers.push({player:p.player,audit_club:p.audit_club,goals:p.goals,jersey:''});
   existing.add(key);
  }
 }
 data.scorers.sort((a,b)=>b.goals-a.goals||a.player.localeCompare(b.player));
 let rank=0,previous=null;
 data.scorers.forEach((p,i)=>{if(p.goals!==previous)rank=i+1;p.rank=rank;previous=p.goals;});
 const ab7=data.scorers.filter(p=>norm(p.audit_club)===norm('AB7 Future Academy'));
 let ab7Rank=0,ab7Previous=null;
 data.ab7=ab7.map((p,i)=>{if(p.goals!==ab7Previous)ab7Rank=i+1;ab7Previous=p.goals;return {player:p.player,jersey:p.jersey||'',roster_age:age,goals:p.goals,rank:ab7Rank};});
 data.scorer_note='FootyAccess MLS NEXT-wide player goals; updated '+new Date().toISOString().slice(0,10);
 data.updated=new Date().toISOString().slice(0,10);
 html=html.slice(0,start)+JSON.stringify(data)+html.slice(end);
 console.log(age+' updated '+oldCount+' -> '+data.scorers.length+' roster records');
}
fs.writeFileSync(file,html);
console.log('Validated player totals staged in index.html');
