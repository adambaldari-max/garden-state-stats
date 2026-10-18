'use strict';
let db; let age="u13"; let originalU13=null; let originalU14=null;
const el=id=>document.getElementById(id);
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const niceDate=s=>{const [y,m,d]=s.split('-');return new Date(Number(y),Number(m)-1,Number(d)).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}).toUpperCase()};
function setTab(id){document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('hidden',p.id!==id));document.querySelectorAll('.tabs button').forEach(b=>{const active=b.dataset.tab===id;b.classList.toggle('active',active);b.setAttribute('aria-current',active?'page':'false')});history.replaceState(null,'','#'+id)}
document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
function calculateStandings(data){const teams=new Map((data.standings||[]).map(t=>[t.team,{team:t.team,played:0,w:0,d:0,l:0,gf:0,ga:0}]));for(const m of data.matches){if(!m.completed||!Number.isFinite(m.hs)||!Number.isFinite(m.as_))continue;for(const [name,gf,ga] of [[m.home,m.hs,m.as_],[m.away,m.as_,m.hs]]){if(!teams.has(name))teams.set(name,{team:name,played:0,w:0,d:0,l:0,gf:0,ga:0});const t=teams.get(name);t.played++;t.gf+=gf;t.ga+=ga;if(gf>ga)t.w++;else if(gf===ga)t.d++;else t.l++}}const result=[...teams.values()];for(const t of result){t.pts=3*t.w+t.d;t.gd=t.gf-t.ga;t.ppm=t.played?t.pts/t.played:0}result.sort((a,b)=>b.ppm-a.ppm||b.gd-a.gd||b.gf-a.gf||a.team.localeCompare(b.team));result.forEach((t,i)=>t.rank=i+1);return result}
function drawStandings(){el('standingsRows').innerHTML=db.standings.map(x=>`<tr class="${x.team==='AB7 Future Academy'?'highlight':''}"><td>${x.rank}</td><td>${safe(x.team)}</td><td>${x.played}</td><td>${x.w}</td><td>${x.d}</td><td>${x.l}</td><td>${x.gf}</td><td>${x.ga}</td><td>${x.gd>0?'+':''}${x.gd}</td><td>${x.pts}</td><td class="ppm-value">${x.ppm.toFixed(2)}</td></tr>`).join('')}
function drawScorers(){if(age==='u14'){el('scorerRows').innerHTML='<tr><td colspan=4>U14 individual scorer records are not verified yet.</td></tr>';return}const s=el('playerSearch').value.trim().toLowerCase(),club=el('clubFilter').value,top=el('top25').checked;let list=db.scorers.filter(x=>(!club||x.audit_club===club)&&(`${x.player} ${x.audit_club}`.toLowerCase().includes(s)));if(top)list=list.filter(x=>db.scorers.indexOf(x)<25);el('scorerRows').innerHTML=list.map(x=>`<tr><td>${x.rank}</td><td>${safe(x.player)}</td><td>${safe(x.audit_club)}</td><td class="ppm-value">${x.goals}</td></tr>`).join('')||'<tr><td colspan="4">No matching players</td></tr>'}
function drawAb7(){el('ab7Rows').innerHTML=(db.ab7||[]).map(x=>`<tr><td>${x.rank}</td><td>${safe(x.player)}</td><td>#${safe(x.jersey)}</td><td>${safe(x.roster_age)}</td><td class="ppm-value">${x.goals}</td></tr>`).join('') || '<tr><td colspan=5>U14 player scoring records are not yet verified.</td></tr>'}
function drawResults(){const club=el('resultClub').value,upcoming=el('showUpcoming').checked;const list=db.matches.filter(x=>(!club||x.home===club||x.away===club)&&(upcoming||x.completed));el('resultsList').innerHTML=list.map(x=>`<div class="game"><span class="date">${niceDate(x.date)}</span><span class="home">${safe(x.home)}</span><span class="score ${x.completed?'':'pending'}">${x.completed?x.hs+' – '+x.as_:'TBD'}</span><span class="away">${safe(x.away)}</span></div>`).join('')||'<p>No matches found.</p>'}
function renderAge(){
  db=structuredClone(age==='u13'?originalU13:originalU14);
  db.standings=calculateStandings(db);
  document.querySelectorAll('.age-button').forEach(b=>b.classList.toggle('selected',b.dataset.age===age));
  document.querySelectorAll('.age-text').forEach(e=>e.textContent=age.toUpperCase());
  ['heroAge','visualAge','overlineAge'].forEach(id=>{const e=el(id);if(e)e.textContent=age.toUpperCase()});
  el('coverageStatus').textContent=age==='u14'?'U14 · Partial verified results only':'U13 · Audited snapshot';
  el('matchCount').textContent=db.matches.filter(m=>m.completed).length;
  el('clubCount').textContent=db.standings.length;
  el('goalCount').textContent=db.standings.reduce((s,t)=>s+t.gf,0);
  const leader=db.standings[0];el('leaderName').textContent=leader?leader.team:'—';el('leaderPPM').textContent=leader?leader.ppm.toFixed(2)+' points per match':'—';
  for(const id of ['clubFilter','resultClub']){const select=el(id);select.innerHTML='<option value="">All clubs</option>'+db.standings.map(t=>`<option value="${safe(t.team)}">${safe(t.team)}</option>`).join('')}
  el('playerSearch').value='';el('top25').checked=true;
  drawStandings();drawScorers();drawResults();
  if(age==='u14'){
    el('scorerRows').innerHTML='<tr><td colspan="4">U14 Golden Boot unavailable until individual scorer records are verified.</td></tr>';
    el('ab7Rows').innerHTML='<tr><td colspan="5">U14 individual scorers not yet verified.</td></tr>';
    el('spotlightBanner').style.display='none';
    const msg='U14 PARTIAL DATA: These standings include only a verified subset of matches and are NOT the full conference table.';
    el('standingsRows').insertAdjacentHTML('beforebegin', '<tr id="u14Warning"><td colspan="11" style="padding:14px;background:#fff0cf;color:#603b00;font-weight:700">'+msg+'</td></tr>');
  }else{el('spotlightBanner').style.display='';}
  if(age==='u13'){const warning=el('u14Warning');if(warning)warning.remove()}
}
Promise.all([
  fetch('data/stats.json?v=u14-20261018-2',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('U13 data missing');return r.json()}),
  fetch('data/u14.json?v=u14-20261018-2',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('U14 data missing');return r.json()})
]).then(([u13,u14])=>{
 originalU13=u13;originalU14=u14;
 document.querySelectorAll('.age-button').forEach(b=>b.addEventListener('click',()=>{const warn=el('u14Warning');if(warn)warn.remove();age=b.dataset.age;renderAge()}));
 ['playerSearch','clubFilter','top25'].forEach(id=>el(id).addEventListener('input',drawScorers));
 ['resultClub','showUpcoming'].forEach(id=>el(id).addEventListener('input',drawResults));
 renderAge();const tab=location.hash.slice(1);if(['standings','scorers','ab7','results','about'].includes(tab))setTab(tab);
}).catch(err=>{el('standingsRows').innerHTML='<tr><td colspan="11">Data could not load. Check data/stats.json and data/u14.json.</td></tr>';console.error(err)});
