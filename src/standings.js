#!/usr/bin/env node
// Zoo Wars standings. Since 14/11/2026 (owner's choice) the wins of the three 3D games count the same:
// Hot Potato 3D, Musical Chairs 3D and Infection 3D (config.standings.games). Wins are read from the registry: every such video whose winner is known and
// that is (or will be) published counts at its publication time. Seasons = 4 weeks from config.standings.season1Start.
//   node src/standings.js [before=YYYY-MM-DDTHH:MM]   -> JSON standings of the season, as of that moment (default now)
'use strict';
const L = require('./lib');
const cfg = L.config();
const ANIMALS = cfg.production.animals;
const DAY = 86400000;

const pubTime = v => new Date(L.dueAtFor(v.date, v.time)).getTime();
const winnerOf = v => v.plan.winner || (v.selection && v.selection.metrics && v.selection.metrics.winner) || null;
const GAMES = (cfg.standings && cfg.standings.games) || [cfg.production.game];
const counts = v => GAMES.includes(v.game) && v.status !== 'error' && v.qc && v.qc.ok && winnerOf(v);

function seasonOf(t) {
  const s1 = new Date(L.dueAtFor(cfg.standings.season1Start, '00:00')).getTime(), len = cfg.standings.seasonWeeks * 7 * DAY;
  if (t < s1) return null;
  const n = Math.floor((t - s1) / len), start = s1 + n * len;
  return { n: n + 1, start, end: start + len };
}
const dateOf = t => new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });

// standings as of `before` (ms): videos published strictly before that moment
function standings(before, reg) {
  reg = reg || L.loadRegistry();
  const season = seasonOf(before - 1); if (!season) return null;
  // week = Monday 00:00 to Sunday 23:59 (Paris) containing `before`
  const d = dateOf(before - 1), wd = (new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7, weekStart = new Date(L.dueAtFor(L.addDays(d, -wd), '00:00')).getTime();
  // rows: the current team, plus any animal that played this season (roster changes after the votes)
  const rows = {}, row = a => rows[a] || (rows[a] = { animal: a, wins: 0, weekWins: 0, games: 0, posSum: 0 }); ANIMALS.forEach(row);
  for (const v of Object.values(reg.videos)) {
    if (!counts(v)) continue; const t = pubTime(v); if (t < season.start || t >= before) continue;
    const w = winnerOf(v), order = (v.render && v.render.info && v.render.info.order) || [];
    const team = (v.plan && v.plan.roster) || ['lion', 'tiger', 'bear', 'wolf', 'gorilla', 'fox', 'bull', 'panda'], n = team.length;
    row(w).wins++; if (t >= weekStart) rows[w].weekWins++;
    for (const a of team) { const i = order.indexOf(a); row(a).games++; rows[a].posSum += a === w ? n : i >= 0 ? i + 1 : n / 2; }
  }
  const rank = a => ANIMALS.indexOf(a) < 0 ? 99 : ANIMALS.indexOf(a);
  const table = Object.values(rows).filter(r => ANIMALS.includes(r.animal) || r.wins).map(r => ({ animal: r.animal, wins: r.wins, weekWins: r.weekWins, avgPos: r.games ? +(r.posSum / r.games).toFixed(2) : 0 }))
    .sort((a, b) => b.wins - a.wins || b.avgPos - a.avgPos || rank(a.animal) - rank(b.animal));
  const weekTable = [...table].sort((a, b) => b.weekWins - a.weekWins || b.avgPos - a.avgPos || rank(a.animal) - rank(b.animal));
  return { season: season.n, seasonStart: dateOf(season.start), seasonEnd: dateOf(season.end - 1), weekStart: dateOf(weekStart), asOf: new Date(before).toISOString(),
    games: table.reduce((a, r) => a + r.wins, 0), weekGames: table.reduce((a, r) => a + r.weekWins, 0), table, weekTable, leader: table[0].wins ? table[0] : null };
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
// one caption line, e.g. "🏆 Season 1 leader: Fox (6 wins)" — never about the video it is attached to
function captionLine(v) {
  const s = standings(pubTime(v)); if (!s || !s.leader) return '';
  const tie = s.table.filter(r => r.wins === s.leader.wins).length > 1;
  const tied = s.table.filter(r => r.wins === s.leader.wins);
  return tie ? (tied.length > 3 ? `🏆 Season ${s.season}: ${tied.length} animals tied at the top (${s.leader.wins} wins)` : `🏆 Season ${s.season}: ${tied.map(r => cap(r.animal)).join(' & ')} tied at the top (${s.leader.wins} wins)`) : `🏆 Season ${s.season} leader: ${cap(s.leader.animal)} (${s.leader.wins} win${s.leader.wins > 1 ? 's' : ''})`;
}
module.exports = { standings, captionLine, seasonOf, winnerOf, pubTime, cap, GAMES };

if (require.main === module) {
  const a = process.argv[2], t = a ? new Date(a.length <= 10 ? L.dueAtFor(a, '23:59') : a).getTime() : Date.now();
  console.log(JSON.stringify(standings(t), null, 1));
}
