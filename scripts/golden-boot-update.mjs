// Rebuilds the Garden State Golden Boot (U13 and U14) from per-match goal events.
//
// For every completed Garden State conference match in index.html it reads the
// FootyAccess match report (/api/scores/enhanced/kitman_<id>). A match only counts
// when its goal events add up exactly to the final score (own goals credited to the
// benefiting team). Player conference goals, per-club audits and the conference
// audit are then rebuilt from those reconciled matches. Matches whose report is
// missing or doesn't add up are listed as "awaiting scorer details" and excluded.
//
// If FootyAccess can't be reached for most matches, the script leaves index.html
// untouched (exit 0) so the rest of the nightly update still publishes.
// Local testing: EVENTS_FILE points at a saved copy of the collected reports.
import fs from 'node:fs';

const API = 'https://footy-access-dev.onrender.com/api/scores/enhanced/kitman_';
const SOURCE_URL = 'https://www.footyaccess.com/leagues/mls-next';
const today = new Date().toISOString().slice(0, 10);
const norm = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
const tokenKey = (s) => norm(s).split(/\s+/).filter(Boolean).sort().join(' ');
const clean = (s) => String(s || '').replace(/;/g, ',').replace(/\s+/g, ' ').trim();

let html = fs.readFileSync('index.html', 'utf8');
const readData = (age) => {
  const marker = `const DATA_${age}=`, start = html.indexOf(marker) + marker.length, end = html.indexOf(';', start);
  if (start < marker.length || end < 0) throw new Error(`${marker} not found`);
  return { data: JSON.parse(html.slice(start, end)), start, end };
};

// ---- collect match reports
const cached = process.env.EVENTS_FILE ? new Map(JSON.parse(fs.readFileSync(process.env.EVENTS_FILE, 'utf8')).games.map((g) => [String(g.id), g.fa])) : null;
async function report(id) {
  if (cached) return cached.get(String(id)) || null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(API + id, { headers: { 'user-agent': 'Mozilla/5.0 (garden-state-stats nightly update)' } });
      if (r.ok) {
        const d = await r.json();
        return {
          home: d.homeTeam?.name, away: d.awayTeam?.name, hs: d.homeTeam?.score, as: d.awayTeam?.score,
          events: (d.events || []).map((e) => ({ t: e.eventType, side: e.team, pside: e.playerTeam, p: e.player, pid: e.sourcePlayerId, m: e.minute, am: e.addedMinute })),
          homeRoster: (d.homeTeam?.roster || []).map((x) => ({ n: x.name, j: x.jerseyNumber, id: x.playerId })),
          awayRoster: (d.awayTeam?.roster || []).map((x) => ({ n: x.name, j: x.jerseyNumber, id: x.playerId })),
        };
      }
    } catch (e) { /* retry */ }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}

const summary = [];
const updates = {};
for (const age of ['U13', 'U14']) {
  const { data } = readData(age);
  const clubs = data.standings.map((t) => t.team);
  const completed = data.matches.filter((m) => m.completed);
  const reconciled = [], pending = [];
  let reached = 0;
  for (const m of completed) {
    const r = await report(m.event_id);
    if (r) reached++;
    const goals = (r?.events || []).filter((e) => e.t === 'goal' || e.t === 'own_goal');
    const count = (side) => goals.filter((e) => e.side === side).length;
    const ok = r && r.home === m.home && r.away === m.away && r.hs === m.hs && r.as === m.as_ && count('home') === m.hs && count('away') === m.as_;
    if (ok) reconciled.push({ m, r, goals }); else pending.push({ m, reason: !r ? 'no report' : r.hs == null ? 'scorer details not posted yet' : 'events do not match the final score' });
    if (!cached) await new Promise((res) => setTimeout(res, 200));
  }
  if (reached < completed.length * 0.8) { console.log(`${age}: FootyAccess reachable for only ${reached}/${completed.length} matches; Golden Boot left unchanged.`); process.exit(0); }

  // ---- tally
  const index = new Map();
  for (const s of data.scorers) { index.set(norm(s.player) + '|' + s.audit_club, s); index.set('t:' + tokenKey(s.player) + '|' + s.audit_club, s); }
  const tally = new Map(); // scorer record -> events
  const clubAudit = Object.fromEntries(clubs.map((c) => [c, { matches: [], teamGoals: 0, playerGoals: 0, ownGoals: 0, ownEvents: [] }]));
  const allEvents = [];
  let added = 0;
  for (const { m, r, goals } of reconciled) {
    for (const side of ['home', 'away']) { const c = m[side], a = clubAudit[c]; if (!a) continue; a.matches.push(m); a.teamGoals += side === 'home' ? m.hs : m.as_; }
    for (const e of goals) {
      const credited = e.side === 'home' ? m.home : m.away;
      const own = e.t === 'own_goal';
      const playerClub = own ? (e.side === 'home' ? m.away : m.home) : credited;
      const ev = { event_id: String(m.event_id), date: m.date, player: clean(e.p), minute: e.m, player_club: playerClub, credited_club: credited, own_goal: own };
      allEvents.push(ev);
      if (own) { clubAudit[credited].ownGoals++; clubAudit[credited].ownEvents.push(ev); continue; }
      clubAudit[credited].playerGoals++;
      let rec = index.get(norm(e.p) + '|' + credited) || index.get('t:' + tokenKey(e.p) + '|' + credited);
      if (!rec) {
        const roster = e.side === 'home' ? r.homeRoster : r.awayRoster;
        const jersey = roster.find((x) => x.id === e.pid)?.j || '';
        rec = { player: clean(e.p), audit_club: credited, goals: 0, jersey: String(jersey) };
        data.scorers.push(rec); added++;
        index.set(norm(rec.player) + '|' + credited, rec); index.set('t:' + tokenKey(rec.player) + '|' + credited, rec);
      }
      if (!tally.has(rec)) tally.set(rec, []);
      tally.get(rec).push(ev);
    }
  }

  // ---- write player fields (every listed player at a Garden State club gets a reconciled count, 0 included)
  const source = `FootyAccess Academy Division match reports checked ${today}`;
  for (const s of data.scorers) {
    if (!clubAudit[s.audit_club]) continue;
    const evs = tally.get(s) || [];
    Object.assign(s, { conference_goals: evs.length, conference_goals_verified: true, conference_goals_status: 'match_events_reconciled', conference_goals_as_of: today, conference_goals_source: source });
    if (evs.length) s.conference_goal_events = evs; else delete s.conference_goal_events;
  }

  // ---- audits
  const pendingFor = (club) => pending.filter((p) => p.m.home === club || p.m.away === club).map((p) => ({ date: p.m.date, opponent: p.m.home === club ? p.m.away : p.m.home, reason: p.reason }));
  data.club_scorer_audits = Object.fromEntries(clubs.map((c) => {
    const a = clubAudit[c], last = a.matches.map((m) => m.date).sort().at(-1) || null;
    return [c, { checked_at: today, last_completed_match: last, completed_matches: a.matches.length, team_goals: a.teamGoals, player_goals: a.playerGoals, own_goals_received: a.ownGoals, own_goal_events: a.ownEvents, pending_matches: pendingFor(c), match_ids: a.matches.map((m) => String(m.event_id)), source_url: SOURCE_URL, status: 'Reconciled to named goal events in completed conference match reports' }];
  }));
  const teamGoals = reconciled.reduce((n, x) => n + x.m.hs + x.m.as_, 0), ownGoals = allEvents.filter((e) => e.own_goal).length;
  data.conference_scorer_audit = { checked_at: today, completed_matches: reconciled.length, total_completed_matches: completed.length, clubs: clubs.length, team_goals: teamGoals, player_goals: teamGoals - ownGoals, own_goals: ownGoals, scoring_players: tally.size, pending_matches: pending.map((p) => ({ date: p.m.date, home: p.m.home, away: p.m.away, reason: p.reason })), status: 'All reconciled completed conference matches rebuilt from named goal events' };
  delete data.trenton_scorer_audit;
  data.scorer_note = `Garden State conference goals rebuilt from FootyAccess match reports, ${reconciled.length} of ${completed.length} completed matches reconciled (${today})`;
  updates[age] = data;
  summary.push(`${age}: ${reconciled.length}/${completed.length} matches reconciled, ${teamGoals - ownGoals} player goals + ${ownGoals} own goals, ${tally.size} scorers (${added} new), awaiting: ${pending.map((p) => `${p.m.date} ${p.m.home} v ${p.m.away}`).join('; ') || 'none'}`);
}

for (const age of ['U13', 'U14']) {
  const { start, end } = readData(age);
  const json = JSON.stringify(updates[age]);
  if (json.includes(';')) { console.error(`${age}: data would contain ';' — aborting`); process.exit(1); }
  html = html.slice(0, start) + json + html.slice(end);
}
fs.writeFileSync('index.html', html);
console.log(summary.join('\n'));
