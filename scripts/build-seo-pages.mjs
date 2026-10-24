// Builds plain HTML pages that search engines can index, from the same data the
// interactive site uses, plus sitemap.xml and robots.txt. Run after the data
// updates: `node scripts/build-seo-pages.mjs`. Everything under garden-state/ and
// conferences/ is generated; do not edit those files by hand.
//
// Settings live in site-config.json:
//   cloudflareAnalyticsToken  Cloudflare Web Analytics token ('' = no beacon)
//   googleSiteVerification    Google Search Console meta-tag code ('' = none)
//   playerNames               'initial' (Liam A.) or 'full' on these static pages
import fs from 'node:fs';
import path from 'node:path';

const cfg = JSON.parse(fs.readFileSync('site-config.json', 'utf8'));
const SITE = cfg.siteUrl.replace(/\/$/, '');
const GENERATED_DIRS = ['garden-state', 'conferences'];
const AGES = ['U13', 'U14'];
const HOME_SLUG = 'garden-state';

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const todayET = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
const fmtDate = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const fmtLong = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const fmtTime = (k) => { if (!k || !k.includes('T')) return ''; const [h, m] = k.split('T')[1].split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
const playerName = (n) => {
  if (cfg.playerNames === 'full') return n;
  const parts = String(n).trim().split(/\s+/);
  return parts.length < 2 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
};

function readEmbedded(html, age) {
  const key = `const DATA_${age}=`;
  const i = html.indexOf(key);
  if (i < 0) throw new Error(`DATA_${age} not found in index.html`);
  const start = i + key.length;
  return JSON.parse(html.slice(start, html.indexOf(';', start)));
}

// Same rules as the interactive site: 3/1/0, ranked by points per match, then GD, GF, name.
function standings(matches, names = []) {
  const t = new Map();
  const get = (n) => { if (!t.has(n)) t.set(n, { team: n, played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 }); return t.get(n); };
  names.forEach(get);
  for (const m of matches) {
    const h = get(m.home), a = get(m.away);
    if (!m.completed || m.hs == null || m.as_ == null) continue;
    h.played++; a.played++; h.gf += m.hs; h.ga += m.as_; a.gf += m.as_; a.ga += m.hs;
    if (m.hs > m.as_) { h.w++; a.l++; } else if (m.hs < m.as_) { a.w++; h.l++; } else { h.d++; a.d++; }
  }
  const rows = [...t.values()];
  for (const r of rows) { r.pts = 3 * r.w + r.d; r.gd = r.gf - r.ga; r.ppm = r.played ? r.pts / r.played : 0; }
  rows.sort((a, b) => b.ppm - a.ppm || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team));
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

const completed = (ms) => ms.filter((m) => m.completed && m.hs != null).sort((a, b) => b.date.localeCompare(a.date) || (b.kickoff || '').localeCompare(a.kickoff || ''));
const upcoming = (ms) => ms.filter((m) => !m.completed && m.date >= todayET).sort((a, b) => a.date.localeCompare(b.date) || (a.kickoff || '').localeCompare(b.kickoff || ''));

function goldenBoot(data) {
  const rows = (data.scorers || []).filter((p) => Number(p.conference_goals) > 0)
    .map((p) => ({ player: p.player, club: p.audit_club, goals: Number(p.conference_goals) }))
    .sort((a, b) => b.goals - a.goals || a.player.localeCompare(b.player));
  let rank = 0, prev = null;
  rows.forEach((r, i) => { if (r.goals !== prev) { rank = i + 1; prev = r.goals; } r.rank = rank; });
  return rows;
}

// ---------- page shell ----------
const pages = [];
const CSS = `:root{--navy:#091629;--ink:#10243e;--gold:#d7a443;--muted:#5f6f84;--line:#e4e9ef;--paper:#f5f7fa}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.55 'DM Sans',Arial,sans-serif;-webkit-font-smoothing:antialiased}a{color:#1d4f8f}.shell{width:min(1100px,calc(100% - 32px));margin:auto}header.top{background:#fff;border-bottom:1px solid var(--line)}header.top .shell{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:68px}.brand{display:flex;align-items:center;gap:10px;color:var(--ink);text-decoration:none}.mark{display:flex;align-items:center;justify-content:center;width:42px;height:42px;background:var(--navy);color:#fff;font:800 24px 'Barlow Condensed',sans-serif}.mark span{color:var(--gold)}.brand b{display:block;letter-spacing:2px;font-size:13px}.brand small{display:block;letter-spacing:3px;font-size:9px;font-weight:800;color:#708096}.cta{background:var(--navy);color:#fff;text-decoration:none;padding:10px 14px;border-radius:4px;font-size:12px;font-weight:800;letter-spacing:.8px;white-space:nowrap}.hero{background:var(--navy);color:#fff;padding:34px 0 30px}.crumbs{font-size:12px;color:#9fb0c4;margin-bottom:10px}.crumbs a{color:#e4bc73;text-decoration:none}.hero h1{font:800 clamp(34px,6vw,58px)/.95 'Barlow Condensed',sans-serif;margin:0 0 10px;text-transform:uppercase}.hero p{color:#c6d2e0;margin:0;max-width:760px}main{padding:26px 0 40px}section.card{background:#fff;border:1px solid var(--line);border-radius:6px;padding:18px 18px 8px;margin-bottom:20px}h2{font:800 26px 'Barlow Condensed',sans-serif;text-transform:uppercase;margin:0 0 12px}h3{font:800 20px 'Barlow Condensed',sans-serif;margin:16px 0 8px}.scroll{overflow-x:auto;margin:0 -4px 10px}table{width:100%;border-collapse:collapse;font-size:14px}th{font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);text-align:left;border-bottom:2px solid var(--line);padding:8px 6px}td{border-bottom:1px solid var(--line);padding:8px 6px;white-space:nowrap}td.num,th.num{text-align:right}td.team{white-space:normal;min-width:150px}tr.hl td{background:#fff7e6;font-weight:700}.games{list-style:none;padding:0;margin:0 0 12px}.games li{display:grid;grid-template-columns:110px 1fr;gap:4px 12px;padding:9px 0;border-bottom:1px solid var(--line)}.games .when{color:var(--muted);font-size:13px}.games .where{grid-column:2;color:var(--muted);font-size:12px}.score{font-weight:800}.chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px;padding:0;list-style:none}.chips a{display:inline-block;border:1px solid #d6dee8;background:#fff;border-radius:999px;padding:6px 12px;text-decoration:none;font-size:13px;color:var(--ink)}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:20px}.grid2>*{min-width:0}.stat{display:flex;gap:18px;flex-wrap:wrap;margin:4px 0 12px}.stat div{min-width:70px}.stat b{display:block;font:800 28px 'Barlow Condensed',sans-serif}.stat span{font-size:11px;letter-spacing:1px;color:var(--muted);text-transform:uppercase}.muted{color:var(--muted);font-size:13px}footer{background:#081326;color:#9aabbf;font-size:12px;padding:24px 0}footer a{color:#e4bc73}footer p{margin:6px 0}@media(max-width:720px){.grid2{grid-template-columns:1fr}.games li{grid-template-columns:1fr}.games .where{grid-column:1}header.top .cta{padding:8px 10px;font-size:11px}.brand small{display:none}}`;

function analyticsTag() {
  return cfg.cloudflareAnalyticsToken
    ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${esc(cfg.cloudflareAnalyticsToken)}"}'></script>`
    : '';
}

function page({ url, title, description, h1, intro, crumbs = [], body, appLink = '/', jsonld = [], priority = '0.6' }) {
  const canonical = SITE + url;
  const crumbLd = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ name: 'Home', url: '/' }, ...crumbs].map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: SITE + c.url })) };
  const ld = [crumbLd, ...jsonld].map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#081326">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${canonical}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Garden State Academy Stats"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE}/og-image.png"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=DM+Sans:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>${CSS}</style>${ld}${analyticsTag()}</head><body>
<header class="top"><div class="shell"><a class="brand" href="/"><span class="mark">GS<span>.</span></span><span><b>GARDEN STATE</b><small>ACADEMY STATS</small></span></a><a class="cta" href="${esc(appLink)}">Open interactive stats →</a></div></header>
<div class="hero"><div class="shell"><nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a>${crumbs.map((c, i) => ` / ${i === crumbs.length - 1 ? esc(c.name) : `<a href="${c.url}">${esc(c.name)}</a>`}`).join('')}</nav><h1>${esc(h1)}</h1><p>${intro}</p></div></div>
<main class="shell">${body}</main>
<footer><div class="shell"><p><a href="/garden-state/u13/">Garden State U13</a> · <a href="/garden-state/u14/">Garden State U14</a> · <a href="/garden-state/u13/golden-boot/">U13 Golden Boot</a> · <a href="/garden-state/u14/golden-boot/">U14 Golden Boot</a> · <a href="/garden-state/clubs/">Garden State clubs</a> · <a href="/conferences/">All conferences</a></p><p>Independent statistics project. Not affiliated with, sponsored by, or endorsed by MLS NEXT or Major League Soccer. Questions or corrections: <a href="mailto:contact@mlsnextacademystats.com">contact@mlsnextacademystats.com</a></p></div></footer>
</body></html>`;
  const file = path.join(url.replace(/^\//, ''), 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  pages.push({ url, priority });
}

// ---------- reusable blocks ----------
function standingsTable(rows, { highlight, linkFor } = {}) {
  return `<div class="scroll"><table><thead><tr><th class="num">#</th><th>Club</th><th class="num">GP</th><th class="num">W</th><th class="num">D</th><th class="num">L</th><th class="num">GF</th><th class="num">GA</th><th class="num">GD</th><th class="num">PTS</th><th class="num">PPM</th></tr></thead><tbody>${rows.map((r) => {
    const name = linkFor ? `<a href="${linkFor(r.team)}">${esc(r.team)}</a>` : esc(r.team);
    return `<tr${r.team === highlight ? ' class="hl"' : ''}><td class="num">${r.rank}</td><td class="team">${name}</td><td class="num">${r.played}</td><td class="num">${r.w}</td><td class="num">${r.d}</td><td class="num">${r.l}</td><td class="num">${r.gf}</td><td class="num">${r.ga}</td><td class="num">${r.gd > 0 ? '+' : ''}${r.gd}</td><td class="num"><b>${r.pts}</b></td><td class="num">${r.ppm.toFixed(2)}</td></tr>`;
  }).join('')}</tbody></table></div><p class="muted">Ranked by points per match (3 for a win, 1 for a draw), then goal difference and goals scored.</p>`;
}

function gameList(ms, empty) {
  if (!ms.length) return `<p class="muted">${empty}</p>`;
  return `<ul class="games">${ms.map((m) => {
    const when = `${fmtDate(m.date)}${m.completed ? '' : fmtTime(m.kickoff) ? ' · ' + fmtTime(m.kickoff) : ''}`;
    const line = m.completed ? `${esc(m.home)} <span class="score">${m.hs}–${m.as_}</span> ${esc(m.away)}` : `${esc(m.home)} vs ${esc(m.away)}`;
    return `<li><span class="when">${when}</span><span>${line}</span>${!m.completed && m.venue ? `<span class="where">${esc(m.venue)}</span>` : ''}</li>`;
  }).join('')}</ul>`;
}

function bootTable(rows, limit) {
  const list = limit ? rows.filter((r) => r.rank <= limit) : rows;
  if (!list.length) return '<p class="muted">No conference goals recorded yet.</p>';
  return `<div class="scroll"><table><thead><tr><th class="num">#</th><th>Player</th><th>Club</th><th class="num">Goals</th></tr></thead><tbody>${list.map((r) => `<tr><td class="num">${r.rank}</td><td>${esc(playerName(r.player))}</td><td class="team"><a href="/garden-state/clubs/${slug(r.club)}/">${esc(r.club)}</a></td><td class="num"><b>${r.goals}</b></td></tr>`).join('')}</tbody></table></div>`;
}

const chips = (items) => `<ul class="chips">${items.map(([href, label]) => `<li><a href="${href}">${esc(label)}</a></li>`).join('')}</ul>`;
const recordLine = (r) => (r ? `${r.w}-${r.d}-${r.l}, ${r.pts} pts, ${ordinal(r.rank)}` : 'no games yet');
const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][((n % 100) - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
const teamApp = (age, team, conf) => `/${conf && conf !== HOME_SLUG ? `?conference=${conf}` : ''}#team/${age.toLowerCase()}/${encodeURIComponent(team)}`;

// ---------- load data ----------
const indexHtml = fs.readFileSync('index.html', 'utf8');
const gs = Object.fromEntries(AGES.map((a) => [a, readEmbedded(indexHtml, a)]));
const academy = Object.fromEntries(AGES.map((a) => [a, JSON.parse(fs.readFileSync(`data/academy-${a.toLowerCase()}.json`, 'utf8'))]));
const updated = [gs.U13.updated, gs.U14.updated, academy.U13.synced_at?.slice(0, 10), academy.U14.synced_at?.slice(0, 10)].filter(Boolean).sort().pop();
const asOf = `Updated ${fmtLong(updated)}.`;

for (const d of GENERATED_DIRS) fs.rmSync(d, { recursive: true, force: true });

// ---------- Garden State ----------
const gsTable = Object.fromEntries(AGES.map((a) => [a, standings(gs[a].matches)]));
const gsBoot = Object.fromEntries(AGES.map((a) => [a, goldenBoot(gs[a])]));
const gsClubs = [...new Set(AGES.flatMap((a) => gsTable[a].map((r) => r.team)))].sort();
const gsClubUrl = (t) => `/garden-state/clubs/${slug(t)}/`;

for (const age of AGES) {
  const d = gs[age], table = gsTable[age], last = completed(d.matches), next = upcoming(d.matches);
  const leader = table[0];
  page({
    url: `/garden-state/${age.toLowerCase()}/`, priority: '0.9',
    title: `Garden State Conference ${age} Standings & Results | MLS NEXT Academy`,
    description: `MLS NEXT Academy Division ${age} Garden State Conference standings, results, upcoming games and Golden Boot. ${leader ? `${leader.team} lead with ${leader.pts} points.` : ''} ${asOf}`,
    h1: `Garden State ${age} Standings`,
    intro: `2026–27 MLS NEXT Academy Division, Garden State Conference ${age}: full table, latest results, upcoming fixtures and the conference Golden Boot. ${asOf}`,
    crumbs: [{ name: 'Garden State', url: '/garden-state/clubs/' }, { name: age, url: `/garden-state/${age.toLowerCase()}/` }],
    appLink: '/#standings',
    body: `${chips([[`/garden-state/${age.toLowerCase()}/golden-boot/`, `${age} Golden Boot`], [`/garden-state/${age === 'U13' ? 'u14' : 'u13'}/`, `${age === 'U13' ? 'U14' : 'U13'} standings`], ['/garden-state/clubs/', 'All Garden State clubs'], ['/conferences/', 'Other conferences']])}
<section class="card"><h2>${age} Table</h2>${standingsTable(table, { linkFor: gsClubUrl })}</section>
<div class="grid2"><section class="card"><h2>Latest results</h2>${gameList(last.slice(0, 10), 'No results yet.')}</section>
<section class="card"><h2>Upcoming games</h2>${gameList(next.slice(0, 10), 'No upcoming games scheduled.')}</section></div>
<section class="card"><h2>Golden Boot · Top 10</h2>${bootTable(gsBoot[age], 10)}<p><a href="/garden-state/${age.toLowerCase()}/golden-boot/">Full ${age} Golden Boot →</a></p></section>`,
    jsonld: [{ '@context': 'https://schema.org', '@type': 'SportsOrganization', name: `MLS NEXT Academy Division Garden State Conference ${age}`, sport: 'Soccer', url: SITE + `/garden-state/${age.toLowerCase()}/` }],
  });

  page({
    url: `/garden-state/${age.toLowerCase()}/golden-boot/`, priority: '0.8',
    title: `Garden State ${age} Golden Boot: Top Scorers | MLS NEXT Academy`,
    description: `Top goal scorers in the MLS NEXT Academy Division Garden State Conference ${age}, counting conference games only and rebuilt from match reports. ${asOf}`,
    h1: `Garden State ${age} Golden Boot`,
    intro: `Conference goals only, rebuilt from named goal events in each completed match report. Players appear as first name and last initial. ${asOf}`,
    crumbs: [{ name: 'Garden State', url: '/garden-state/clubs/' }, { name: age, url: `/garden-state/${age.toLowerCase()}/` }, { name: 'Golden Boot', url: `/garden-state/${age.toLowerCase()}/golden-boot/` }],
    appLink: '/#scorers',
    body: `${chips([[`/garden-state/${age.toLowerCase()}/`, `${age} standings`], [`/garden-state/${age === 'U13' ? 'u14' : 'u13'}/golden-boot/`, `${age === 'U13' ? 'U14' : 'U13'} Golden Boot`]])}<section class="card"><h2>${age} Scorers</h2>${bootTable(gsBoot[age])}</section>`,
  });
}

page({
  url: '/garden-state/clubs/', priority: '0.8',
  title: 'Garden State Conference Clubs | MLS NEXT Academy U13 & U14',
  description: `All ${gsClubs.length} clubs in the MLS NEXT Academy Division Garden State Conference, with U13 and U14 records, results and fixtures. ${asOf}`,
  h1: 'Garden State Clubs',
  intro: `Every club in the Garden State Conference, with U13 and U14 records. ${asOf}`,
  crumbs: [{ name: 'Garden State', url: '/garden-state/clubs/' }],
  body: `<section class="card"><h2>Clubs</h2><div class="scroll"><table><thead><tr><th>Club</th><th>U13</th><th>U14</th></tr></thead><tbody>${gsClubs.map((c) => `<tr><td class="team"><a href="${gsClubUrl(c)}">${esc(c)}</a></td>${AGES.map((a) => `<td>${recordLine(gsTable[a].find((r) => r.team === c))}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>${chips([['/garden-state/u13/', 'U13 standings'], ['/garden-state/u14/', 'U14 standings']])}`,
});

for (const club of gsClubs) {
  const ageBlocks = AGES.map((age) => {
    const d = gs[age], row = gsTable[age].find((r) => r.team === club);
    const ms = d.matches.filter((m) => m.home === club || m.away === club);
    const scorers = gsBoot[age].filter((p) => p.club === club).slice(0, 5);
    return `<section class="card"><h2>${age}</h2>${row ? `<div class="stat"><div><b>${ordinal(row.rank)}</b><span>Position</span></div><div><b>${row.w}-${row.d}-${row.l}</b><span>W-D-L</span></div><div><b>${row.pts}</b><span>Points</span></div><div><b>${row.gf}:${row.ga}</b><span>Goals</span></div></div>` : ''}
<div class="grid2"><div><h3>Recent results</h3>${gameList(completed(ms).slice(0, 5), 'No results yet.')}</div><div><h3>Next games</h3>${gameList(upcoming(ms).slice(0, 5), 'No upcoming games scheduled.')}</div></div>
<h3>Top conference scorers</h3>${scorers.length ? `<ul class="games">${scorers.map((p) => `<li><span class="when">${p.goals} goal${p.goals === 1 ? '' : 's'}</span><span>${esc(playerName(p.player))}</span></li>`).join('')}</ul>` : '<p class="muted">No conference goals recorded yet.</p>'}
<p><a href="/garden-state/${age.toLowerCase()}/">Full ${age} table →</a> · <a href="${teamApp(age, club)}">Interactive ${age} team profile →</a></p></section>`;
  }).join('');
  const r13 = gsTable.U13.find((r) => r.team === club), r14 = gsTable.U14.find((r) => r.team === club);
  page({
    url: gsClubUrl(club), priority: '0.7',
    title: `${club} U13 & U14 | MLS NEXT Garden State Standings & Results`,
    description: `${club} in the MLS NEXT Academy Division Garden State Conference. U13: ${recordLine(r13)}. U14: ${recordLine(r14)}. Results, fixtures and top scorers.`,
    h1: club,
    intro: `MLS NEXT Academy Division, Garden State Conference. U13: ${recordLine(r13)}. U14: ${recordLine(r14)}. ${asOf}`,
    crumbs: [{ name: 'Garden State', url: '/garden-state/clubs/' }, { name: club, url: gsClubUrl(club) }],
    appLink: teamApp('U13', club),
    body: ageBlocks + `<section class="card"><h2>Standing in the table</h2><div class="grid2">${AGES.map((a) => `<div><h3>${a}</h3>${standingsTable(gsTable[a], { highlight: club, linkFor: gsClubUrl })}</div>`).join('')}</div></section>`,
    jsonld: [{ '@context': 'https://schema.org', '@type': 'SportsTeam', name: club, sport: 'Soccer', memberOf: { '@type': 'SportsOrganization', name: 'MLS NEXT Academy Division Garden State Conference' } }],
  });
}

// ---------- every conference ----------
const confs = academy.U13.conferences.map((c) => ({ slug: c.slug, name: c.name }));
for (const c of academy.U14.conferences) if (!confs.find((x) => x.slug === c.slug)) confs.push({ slug: c.slug, name: c.name });
confs.sort((a, b) => a.name.localeCompare(b.name));
const confData = (age, s) => academy[age].conferences.find((c) => c.slug === s);
const confClubUrl = (s, t) => (s === HOME_SLUG ? gsClubUrl(t) : `/conferences/${s}/${slug(t)}/`);

page({
  url: '/conferences/', priority: '0.8',
  title: 'MLS NEXT Academy Division Conferences: U13 & U14 Standings',
  description: `Standings and results for all ${confs.length} MLS NEXT Academy Division conferences, U13 and U14. ${asOf}`,
  h1: 'All Conferences',
  intro: `U13 and U14 standings and results for every MLS NEXT Academy Division conference. ${asOf}`,
  crumbs: [{ name: 'Conferences', url: '/conferences/' }],
  body: `<section class="card"><h2>Conferences</h2><div class="scroll"><table><thead><tr><th>Conference</th><th>U13 leader</th><th>U14 leader</th></tr></thead><tbody>${confs.map((c) => `<tr><td class="team"><a href="/conferences/${c.slug}/">${esc(c.name)}</a></td>${AGES.map((a) => { const cd = confData(a, c.slug); const top = cd ? standings(cd.matches, cd.teams.map((t) => t.name))[0] : null; return `<td>${top && top.played ? esc(top.team) : '—'}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div></section>`,
});

for (const c of confs) {
  const tables = {}, clubs = new Set();
  for (const age of AGES) {
    const cd = confData(age, c.slug);
    // Garden State uses the hand-checked embedded data, like the interactive site.
    const ms = c.slug === HOME_SLUG ? gs[age].matches : cd?.matches || [];
    tables[age] = { ms, rows: standings(ms, c.slug === HOME_SLUG ? [] : (cd?.teams || []).map((t) => t.name)) };
    tables[age].rows.forEach((r) => clubs.add(r.team));
  }
  const appLink = c.slug === HOME_SLUG ? '/' : `/?conference=${c.slug}`;
  page({
    url: `/conferences/${c.slug}/`, priority: c.slug === HOME_SLUG ? '0.8' : '0.6',
    title: `${c.name} Conference U13 & U14 Standings | MLS NEXT Academy Division`,
    description: `MLS NEXT Academy Division ${c.name} Conference U13 and U14 standings, latest results and upcoming games. ${asOf}`,
    h1: `${c.name} Conference`,
    intro: `2026–27 MLS NEXT Academy Division ${c.name} Conference, U13 and U14. ${asOf}`,
    crumbs: [{ name: 'Conferences', url: '/conferences/' }, { name: c.name, url: `/conferences/${c.slug}/` }],
    appLink,
    body: (c.slug === HOME_SLUG ? chips([['/garden-state/u13/', 'U13 in depth + Golden Boot'], ['/garden-state/u14/', 'U14 in depth + Golden Boot']]) : '') +
      AGES.map((age) => `<section class="card"><h2>${age} Table</h2>${standingsTable(tables[age].rows, { linkFor: (t) => confClubUrl(c.slug, t) })}<div class="grid2"><div><h3>Latest results</h3>${gameList(completed(tables[age].ms).slice(0, 8), 'No results yet.')}</div><div><h3>Upcoming games</h3>${gameList(upcoming(tables[age].ms).slice(0, 8), 'No upcoming games scheduled.')}</div></div></section>`).join(''),
  });
  if (c.slug === HOME_SLUG) continue;

  for (const club of [...clubs].sort()) {
    const blocks = AGES.map((age) => {
      const { ms, rows } = tables[age];
      const row = rows.find((r) => r.team === club);
      if (!row) return '';
      const mine = ms.filter((m) => m.home === club || m.away === club);
      return `<section class="card"><h2>${age}</h2><div class="stat"><div><b>${ordinal(row.rank)}</b><span>Position</span></div><div><b>${row.w}-${row.d}-${row.l}</b><span>W-D-L</span></div><div><b>${row.pts}</b><span>Points</span></div><div><b>${row.gf}:${row.ga}</b><span>Goals</span></div></div>
<div class="grid2"><div><h3>Recent results</h3>${gameList(completed(mine).slice(0, 5), 'No results yet.')}</div><div><h3>Next games</h3>${gameList(upcoming(mine).slice(0, 5), 'No upcoming games scheduled.')}</div></div>
<h3>${c.name} ${age} table</h3>${standingsTable(rows, { highlight: club, linkFor: (t) => confClubUrl(c.slug, t) })}</section>`;
    }).join('');
    const rec = (age) => recordLine(tables[age].rows.find((r) => r.team === club));
    page({
      url: confClubUrl(c.slug, club), priority: '0.5',
      title: `${club} U13 & U14 | MLS NEXT ${c.name} Conference Standings`,
      description: `${club} in the MLS NEXT Academy Division ${c.name} Conference. U13: ${rec('U13')}. U14: ${rec('U14')}. Results and upcoming games.`,
      h1: club,
      intro: `MLS NEXT Academy Division, ${c.name} Conference. U13: ${rec('U13')}. U14: ${rec('U14')}. ${asOf}`,
      crumbs: [{ name: 'Conferences', url: '/conferences/' }, { name: c.name, url: `/conferences/${c.slug}/` }, { name: club, url: confClubUrl(c.slug, club) }],
      appLink: teamApp('U13', club, c.slug),
      body: blocks,
      jsonld: [{ '@context': 'https://schema.org', '@type': 'SportsTeam', name: club, sport: 'Soccer', memberOf: { '@type': 'SportsOrganization', name: `MLS NEXT Academy Division ${c.name} Conference` } }],
    });
  }
}

// ---------- sitemap, robots, homepage tags ----------
const urls = [{ url: '/', priority: '1.0' }, ...pages];
fs.writeFileSync('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((p) => `  <url><loc>${SITE}${p.url}</loc><lastmod>${updated}</lastmod><priority>${p.priority}</priority></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

// Keep analytics, verification and crawlable links on the homepage in sync with site-config.json.
const headBlock = `<!--seo-head-->${cfg.googleSiteVerification ? `<meta name="google-site-verification" content="${esc(cfg.googleSiteVerification)}">` : ''}<link rel="canonical" href="${SITE}/">${analyticsTag()}<!--/seo-head-->`;
const linkBlock = `<!--seo-links--><nav class="shell seo-links" aria-label="Browse"><a id="seoConfLink" href="/conferences/" hidden></a><a href="/garden-state/u13/">Garden State U13</a> <a href="/garden-state/u14/">Garden State U14</a> <a href="/garden-state/u13/golden-boot/">Garden State U13 Golden Boot</a> <a href="/garden-state/u14/golden-boot/">Garden State U14 Golden Boot</a> <a href="/garden-state/clubs/">Garden State clubs</a> <a href="/conferences/">All conferences</a></nav><style>.seo-links{display:flex;flex-wrap:wrap;gap:6px 18px;padding:14px 0 0;font-size:11px;font-weight:700;letter-spacing:.6px}.seo-links a{color:#9fb0c4;text-decoration:none}.seo-links a:hover{color:#e4bc73}.seo-links a[hidden]{display:none}</style><!--/seo-links-->`;
let home = fs.readFileSync('index.html', 'utf8');
const swap = (s, open, close, block, anchor, where) => {
  const i = s.indexOf(open);
  if (i >= 0) return s.slice(0, i) + block + s.slice(s.indexOf(close, i) + close.length);
  const a = s.indexOf(anchor);
  if (a < 0) throw new Error(`anchor ${anchor} not found in index.html`);
  return where === 'before' ? s.slice(0, a) + block + s.slice(a) : s.slice(0, a + anchor.length) + block + s.slice(a + anchor.length);
};
home = swap(home, '<!--seo-head-->', '<!--/seo-head-->', headBlock, '</title>', 'after');
home = swap(home, '<!--seo-links-->', '<!--/seo-links-->', linkBlock, '<footer class="footer">', 'after');
fs.writeFileSync('index.html', home);

console.log(`Built ${pages.length} pages + sitemap.xml (${urls.length} URLs) + robots.txt, data as of ${updated}.`);
