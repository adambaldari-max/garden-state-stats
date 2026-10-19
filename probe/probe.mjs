// Read-only: locate Academy Division games in the official MLS NEXT feeds.
import fs from 'node:fs';
const out='probe-output';fs.mkdirSync(out,{recursive:true});
const base='https://mls-assist.theintelligenceplatform.com/data';
const get=async u=>{const r=await fetch(u+'?_t='+Date.now(),{headers:{'user-agent':'Mozilla/5.0'}});return {status:r.status,json:r.ok?await r.json().catch(()=>null):null}};
const res={};
const lg=(await get(base+'/schedule/mls-next-league-26-27.json')).json;
res.linked=lg.linked_competition_seasons;res.synced_at=lg.synced_at;
const want=new Set([5855103,5856879,5857122]);
res.found=lg.events.filter(e=>want.has(e.id));
const c={};for(const e of lg.events){const k=e.division?.name+' | '+e.competition?.name+' | '+e.home_squad_name;c[k]=(c[k]||0)+1}res.counts=c;
const cands=['mls-next-academy-division-26-27','mls-next-academy-26-27','mls-next-ad-26-27','mls-next-academy-division-league-26-27','academy-division-26-27','mls-next-league-ad-26-27'];
for(const l of (lg.linked_competition_seasons||[]))if(l?.key)cands.push(l.key);
res.tries={};
for(const k of [...new Set(cands)])for(const kind of ['schedule','standings']){const r=await get(`${base}/${kind}/${k}.json`);res.tries[kind+'/'+k]=r.status;if(r.json&&kind==='schedule'&&r.json.events){const hits=r.json.events.filter(e=>want.has(e.id));res.tries[kind+'/'+k]+=' events='+r.json.events.length+' hits='+hits.length;if(hits.length){fs.writeFileSync(`${out}/feed-${k}.json`,JSON.stringify(r.json))}}if(r.json&&kind==='standings')fs.writeFileSync(`${out}/standings-${k}.json`,JSON.stringify(r.json).slice(0,3000000))}
fs.writeFileSync(out+'/locate.json',JSON.stringify(res,null,1));console.log(JSON.stringify(res.tries));
