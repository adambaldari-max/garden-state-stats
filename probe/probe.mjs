// Read-only: official MLS NEXT Academy Division schedule + standings (conference membership), U13/U14 only.
import fs from 'node:fs';
const out='probe-output';fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
const base='https://mls-assist.theintelligenceplatform.com/data';const key='mls-next-2-academy-division-26-27';
const get=async u=>{const r=await fetch(u+'?_t='+Date.now(),{headers:{'user-agent':'Mozilla/5.0'}});const t=await r.text();return {status:r.status,ct:r.headers.get('content-type'),t}};
const s=await get(`${base}/schedule/${key}.json`);
const res={schedule_status:s.status,ct:s.ct,len:s.t.length};
try{const j=JSON.parse(s.t);res.top=Object.keys(j);res.synced_at=j.synced_at;const ev=j.events||[];res.count=ev.length;const ages={};for(const e of ev)ages[e.home_squad_name]=(ages[e.home_squad_name]||0)+1;res.ages=ages;
 fs.writeFileSync(out+'/ad-schedule-u13u14.json',JSON.stringify(ev.filter(e=>['U13','U14'].includes(e.home_squad_name))))}catch(e){res.err=String(e);res.head=s.t.slice(0,300)}
const st=await get(`${base}/standings/${key}.json`);const sj=JSON.parse(st.t);
const mem={};for(const b of sj.competition_season.competition_brackets){if(!['U13','U14'].includes(b.age_group.name))continue;mem[b.age_group.name+'|'+b.name]={id:b.id,teams:b.standings.map(x=>({n:x.team.name,org:x.team.organisation_id,squad:x.team.squad_id,logo:x.team.logo_url,v:x.tiebreaker_values}))}}
fs.writeFileSync(out+'/ad-conferences.json',JSON.stringify(mem));
fs.writeFileSync(out+'/summary.json',JSON.stringify(res,null,1));console.log(JSON.stringify(res));
