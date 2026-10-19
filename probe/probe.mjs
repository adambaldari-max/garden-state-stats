// Read-only: list the API endpoints FootyAccess's own web app calls, then sample the match-related ones.
import fs from 'node:fs';
const out='probe-output';fs.mkdirSync(out,{recursive:true});
const UA={'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130 Safari/537.36'};
const res={endpoints:[],samples:{}};
const html=await (await fetch('https://www.footyaccess.com/leagues/mls-next?ageGroups=U13',{headers:UA})).text();
const chunks=[...new Set([...html.matchAll(/\/_next\/static\/[^"'\s]+\.js/g)].map(m=>m[0]))];
const found=new Set();
for(const c of chunks){try{const js=await (await fetch('https://www.footyaccess.com'+c,{headers:UA})).text();for(const m of js.matchAll(/["'`](\/api\/[a-zA-Z0-9_\-\/${}.:?=&]+)["'`]/g))found.add(m[1]);for(const m of js.matchAll(/api\/mls-next\/[a-zA-Z0-9_\-\/${}]+/g))found.add('/'+m[0])}catch(e){}}
res.chunks=chunks.length;res.endpoints=[...found].sort();
const B='https://footy-access-dev.onrender.com';
const tries=['/api/mls-next/matches?season=2027&ageGroup=U13','/api/mls-next/matches?season=2027&ageGroup=U13&team=Trenton%20City%20Soccer%20Club','/api/mls-next/fixtures?season=2027&ageGroup=U13','/api/mls-next/schedule?season=2027&ageGroup=U13','/api/mls-next/results?season=2027&ageGroup=U13','/api/mls-next/teams?season=2027&ageGroup=U13','/api/mls-next/matches/kitman_5856879','/api/mls-next/match/kitman_5856879','/api/matches/kitman_5856879'];
for(const e of res.endpoints.filter(x=>!x.includes('$')&&x.startsWith('/api/mls-next')))tries.push(e+(e.includes('?')?'&':'?')+'season=2027&ageGroup=U13');
for(const t of [...new Set(tries)]){try{const r=await fetch(B+t,{headers:UA});const txt=await r.text();res.samples[t]={status:r.status,len:txt.length,head:txt.slice(0,1500)};if(r.ok&&txt.length>2000)fs.writeFileSync(out+'/fa'+t.replace(/[^a-z0-9]+/gi,'_').slice(0,90)+'.json',txt.slice(0,3000000))}catch(e){res.samples[t]={error:String(e)}}}
fs.writeFileSync(out+'/fa-endpoints.json',JSON.stringify(res,null,1));console.log(res.endpoints.length);
