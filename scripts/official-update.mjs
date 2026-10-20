// Nightly update from the official MLS NEXT Academy Division feed (the data behind
// mlssoccer.com/mlsnext/standings/academy_division/).
//
// 1. Writes data/academy-u13.json and data/academy-u14.json: every U13/U14 conference,
//    its clubs (with crests) and its full schedule (results, kickoff times, fields).
// 2. Refreshes the Garden State matches embedded in index.html (scores, dates, kickoff
//    times, fields). Golden Boot / scorer data is never touched.
//
// Safety: if the feed looks incomplete or malformed, the script exits without writing.
// Local testing: SCHEDULE_FILE / STANDINGS_FILE point at saved copies of the two feeds.
import fs from 'node:fs';

const FEED = 'https://mls-assist.theintelligenceplatform.com/data';
const KEY = 'mls-next-2-academy-division-26-27';
const AGES = ['U13', 'U14'];
const HOME_CONFERENCE = 'Garden State';
const TBA_BEFORE_HOUR = 7; // the feed uses 6:00 AM (and similar) as a "time not set" placeholder

async function load(kind, envVar) {
  if (process.env[envVar]) return JSON.parse(fs.readFileSync(process.env[envVar], 'utf8'));
  const res = await fetch(`${FEED}/${kind}/${KEY}.json?_t=${Date.now()}`, { headers: { 'user-agent': 'Mozilla/5.0 (garden-state-stats nightly update)' } });
  if (!res.ok) throw new Error(`${kind} feed returned HTTP ${res.status}`);
  return res.json();
}

const fail = (msg) => { console.error('ABORT: ' + msg + ' — nothing written.'); process.exit(1); };
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const clean = (s) => (s == null ? null : String(s).replace(/;/g, ',').replace(/\s+/g, ' ').trim()); // ';' would break the embedded-data parser

function localParts(iso, tz) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), time: `${p.hour}:${p.minute}` };
}

const schedule = await load('schedule', 'SCHEDULE_FILE');
const standings = await load('standings', 'STANDINGS_FILE');
if (!Array.isArray(schedule?.events)) fail('schedule feed has no events array');
const brackets = standings?.competition_season?.competition_brackets;
if (!Array.isArray(brackets)) fail('standings feed has no conference brackets');

const syncedAt = schedule.synced_at || null;
const generated = new Date().toISOString();
const built = {};

for (const age of AGES) {
  const confs = brackets.filter((b) => b.age_group?.name === age);
  if (confs.length < 18) fail(`${age}: only ${confs.length} conferences in the standings feed`);
  const memberOf = new Map();
  const conferences = confs.map((b) => {
    const teams = b.standings.map((s) => ({ name: clean(s.team.name), logo: s.team.logo_url || null }));
    for (const t of teams) memberOf.set(t.name, b.name);
    return { name: clean(b.name), slug: slug(b.name), teams, matches: [] };
  }).sort((a, b) => a.name.localeCompare(b.name));
  const byName = new Map(conferences.map((c) => [c.name, c]));

  const events = schedule.events.filter((e) => String(e.home_squad_name || '').startsWith(age + ' AD'));
  if (events.length < 2000) fail(`${age}: only ${events.length} games in the schedule feed`);
  let skipped = 0;
  for (const e of events) {
    const home = clean(e.home_organisation?.name), away = clean(e.away_organisation?.name);
    const conf = memberOf.get(home);
    if (!conf || conf !== memberOf.get(away)) { skipped++; continue; }
    const lp = localParts(e.start_time, e.local_timezone);
    const done = e.completed === true && Number.isInteger(e.home_score) && Number.isInteger(e.away_score);
    byName.get(conf).matches.push({
      event_id: String(e.id), date: lp.date,
      kickoff: lp.hour >= TBA_BEFORE_HOUR ? `${lp.date}T${lp.time}` : null,
      venue: /^(tbd|tba|to be (determined|announced))$/i.test(clean(e.event_location?.name) || '') ? null : clean(e.event_location?.name),
      home, away,
      hs: done ? e.home_score : null, as_: done ? e.away_score : null, completed: done,
    });
  }
  for (const c of conferences) c.matches.sort((a, b) => a.date.localeCompare(b.date) || a.home.localeCompare(b.home));
  const gs = byName.get(HOME_CONFERENCE);
  if (!gs || gs.teams.length !== 15 || gs.matches.length < 150) fail(`${age}: Garden State looks wrong (${gs?.teams.length} clubs, ${gs?.matches.length} games)`);
  built[age] = { conferences, skipped, total: events.length };
}

// ---- 1. Per-age data files for the conference switcher
fs.mkdirSync('data', { recursive: true });
for (const age of AGES) {
  const out = { season: '2026-27', age, source: 'MLS NEXT Academy Division official schedule and standings feed', synced_at: syncedAt, generated, conferences: built[age].conferences };
  fs.writeFileSync(`data/academy-${age.toLowerCase()}.json`, JSON.stringify(out));
  const games = out.conferences.reduce((n, c) => n + c.matches.length, 0), done = out.conferences.reduce((n, c) => n + c.matches.filter((m) => m.completed).length, 0);
  console.log(`${age}: ${out.conferences.length} conferences, ${games} games (${done} completed), ${built[age].skipped} skipped`);
}

// ---- 2. Refresh Garden State data embedded in index.html
let html = fs.readFileSync('index.html', 'utf8');
const log = [];
for (const age of AGES) {
  const marker = `const DATA_${age}=`;
  const start = html.indexOf(marker) + marker.length, end = html.indexOf(';', start);
  if (start < marker.length || end < 0) fail(`index.html: ${marker} not found`);
  const data = JSON.parse(html.slice(start, end));
  const official = new Map(built[age].conferences.find((c) => c.name === HOME_CONFERENCE).matches.map((m) => [m.event_id, m]));
  let changed = 0;
  for (const m of data.matches) {
    const o = official.get(String(m.event_id));
    if (!o) continue;
    const before = JSON.stringify(m);
    if (o.home !== m.home || o.away !== m.away) { log.push(`${age} ${m.event_id}: home/away differs, left unchanged`); continue; }
    m.date = o.date;
    if (o.kickoff) m.kickoff = o.kickoff; else delete m.kickoff;
    if (o.venue) m.venue = o.venue; else delete m.venue;
    if (o.completed) {
      if (m.completed && (m.hs !== o.hs || m.as_ !== o.as_)) log.push(`${age} ${m.date} ${m.home} v ${m.away}: score ${m.hs}-${m.as_} -> ${o.hs}-${o.as_}`);
      if (!m.completed) log.push(`${age} ${m.date} ${m.home} ${o.hs}-${o.as_} ${m.away}: new result`);
      Object.assign(m, { hs: o.hs, as_: o.as_, completed: true });
      delete m.status; delete m.status_source;
      m.result_source = 'MLS NEXT official feed';
    } else if (m.completed) {
      log.push(`${age} ${m.date} ${m.home} v ${m.away}: official feed shows not completed; kept existing result`);
    }
    m.schedule_source = 'MLS NEXT official feed';
    if (JSON.stringify(m) !== before) changed++;
  }
  const known = new Set(data.matches.map((m) => String(m.event_id)));
  for (const o of official.values()) if (!known.has(o.event_id)) { data.matches.push({ ...o, schedule_source: 'MLS NEXT official feed' }); changed++; log.push(`${age} ${o.date} ${o.home} v ${o.away}: new fixture added`); }
  data.matches.sort((a, b) => a.date.localeCompare(b.date) || a.home.localeCompare(b.home));
  if (changed) data.updated = generated.slice(0, 10);
  const json = JSON.stringify(data);
  if (json.includes(';')) fail(`${age}: embedded data would contain ';'`);
  html = html.slice(0, start) + json + html.slice(end);
  console.log(`${age} Garden State: ${changed} match records updated`);
}
fs.writeFileSync('index.html', html);
if (log.length) console.log(log.map((l) => '  ' + l).join('\n'));
