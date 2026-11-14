#!/usr/bin/env node
// Statistics for the channel-analyst agent.
//   snapshot <list_posts_with_metrics.json>   store today's metrics of every sent post (run every evening)
//   dataset [weekEnd=YYYY-MM-DD] [--weeks N]    build the analysis table + summaries for the 7 days ending weekEnd
// Files: data/metrics/snapshots.jsonl (one line per post per capture), data/metrics/dataset-<weekEnd>.csv/.json
'use strict';
const fs = require('fs'), path = require('path');
const L = require('./lib');
const cfg = L.config(), AG = 'analytics';
const DIR = path.join(L.P.root, 'data/metrics'); fs.mkdirSync(DIR, { recursive: true });
const SNAP = path.join(DIR, 'snapshots.jsonl');
const HEX24 = /^[a-f\d]{24}$/;
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
function postsFrom(json) {
  const out = []; const walk = o => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(walk);
    if (typeof o.id === 'string' && HEX24.test(o.id) && (o.status || o.dueAt)) out.push(o); for (const k of Object.keys(o)) if (o[k] && typeof o[k] === 'object' && k !== 'metrics') walk(o[k]); };
  walk(json); const s = new Set(); return out.filter(p => !s.has(p.id) && s.add(p.id));
}
const paris = iso => { const d = new Date(iso); const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }); const o = {}; for (const x of f.formatToParts(d)) o[x.type] = x.value; return { date: `${o.year}-${o.month}-${o.day}`, time: `${o.hour}:${o.minute}`, weekday: o.weekday }; };
const median = a => { const v = a.filter(x => typeof x === 'number').sort((x, y) => x - y); if (!v.length) return null; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };

function snapshot(file) {
  const posts = postsFrom(L.readJSON(file)).filter(p => p.status === 'sent' && Array.isArray(p.metrics));
  const now = new Date(), lines = [];
  for (const p of posts) {
    const m = {}; for (const x of p.metrics) m[x.type] = x.value;
    lines.push(JSON.stringify({ capturedAt: now.toISOString(), postId: p.id, channelId: p.channelId, service: p.channelService, sentAt: p.sentAt || p.dueAt, ageHours: +((now - new Date(p.sentAt || p.dueAt)) / 3600000).toFixed(1), metricsUpdatedAt: p.metricsUpdatedAt || null, text: (p.text || '').slice(0, 300), source: (p.assets && p.assets[0] && p.assets[0].source) || null, m }));
  }
  fs.appendFileSync(SNAP, lines.join('\n') + (lines.length ? '\n' : ''));
  L.log(AG, `snapshot: ${lines.length} posts with metrics stored`);
}

// what the system knows about each post (registry); posts made before the automation are recognised by their hashtags
function describe(postId, text) {
  const reg = L.loadRegistry();
  for (const v of Object.values(reg.videos)) for (const ch of ['tiktok', 'youtube']) {
    const p = v.posts && v.posts[ch]; if (p && p.bufferPostId === postId) {
      const c = v.captions && v.captions[ch];
      return { videoId: v.id, auto: true, game: v.game === 'arena2d' ? { terr: 'territory', color: 'colorwar', hot: 'hotpotato2d' }[v.plan.theme] : ({ 'musical-chairs-3d': 'musicalchairs3d', 'infection-3d': 'infection3d' }[v.game] || 'hotpotato3d'), decor: v.game === 'arena2d' ? '' : v.plan.theme,
        winner: v.plan.winner || (v.selection && v.selection.metrics.winner), slot: v.time, hook: c ? (c.title || c.text.split('\n')[0]) : '', question: c && !c.title ? (c.text.split('\n\n')[1] || '') : '',
        intensity: v.selection && v.selection.metrics ? (v.selection.metrics.score || null) : null, duration: v.qc ? v.qc.duration : null };
    }
  }
  const t = (text || '').toLowerCase();
  const game = t.includes('#musicalchairs') ? 'musicalchairs3d' : t.includes('#infection') ? 'infection3d' : t.includes('#territorywar') ? 'territory' : t.includes('#colorwar') ? 'colorwar' : t.includes('#bigeatssmall') ? 'bigeatssmall' : t.includes('#hotpotato') ? 'hotpotato2d' : 'unknown';
  return { videoId: '', auto: false, game, decor: '', winner: '', slot: '', hook: (text || '').split(/\n|#/)[0].trim(), question: '', intensity: null, duration: null };
}

function dataset(weekEnd) {
  weekEnd = weekEnd || L.addDays(L.todayParis(), -1);
  const weekStart = L.addDays(weekEnd, -6);
  if (!fs.existsSync(SNAP)) L.die('no snapshots yet');
  const snaps = fs.readFileSync(SNAP, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
  const byPost = {}; for (const s of snaps) (byPost[s.postId] = byPost[s.postId] || []).push(s);
  const rows = [];
  for (const [id, list] of Object.entries(byPost)) {
    list.sort((a, b) => a.ageHours - b.ageHours);
    const last = list[list.length - 1], when = paris(last.sentAt);
    const at = h => { const c = list.filter(s => s.ageHours >= h * .8); return c.length ? c[0] : null; }; // first capture at or after ~h hours
    const s48 = at(48), s7 = at(168), d = describe(id, last.text);
    rows.push({ postId: id, platform: last.service, date: when.date, weekday: when.weekday, time: when.time, inWeek: when.date >= weekStart && when.date <= weekEnd, ...d,
      views: last.m.views ?? null, likes: last.m.reactions ?? null, comments: last.m.comments ?? null, shares: last.m.shares ?? null, reach: last.m.reach ?? null,
      avgWatchSec: last.m.averageTimeWatched ?? null, watchMin: last.m.totalTimeWatched ?? null, ageHours: last.ageHours,
      views48h: s48 ? s48.m.views ?? null : null, views7d: s7 ? s7.m.views ?? null : null, likes48h: s48 ? s48.m.reactions ?? null : null });
  }
  rows.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const week = rows.filter(r => r.inWeek), prevStart = L.addDays(weekStart, -7), prev = rows.filter(r => r.date >= prevStart && r.date < weekStart);
  const key = r => r.views48h ?? r.views; // comparable metric: views at ~48 h when known
  const group = (rs, f) => { const g = {}; for (const r of rs) { const k = f(r) || '(none)'; (g[k] = g[k] || []).push(r); }
    return Object.fromEntries(Object.entries(g).map(([k, v]) => [k, { n: v.length, medianViews: median(v.map(key)), medianLikes: median(v.map(r => r.likes)), medianAvgWatchSec: median(v.map(r => r.avgWatchSec)), totalViews: v.reduce((a, r) => a + (r.views || 0), 0) }])); };
  const summary = { weekStart, weekEnd, posts: week.length, prevPosts: prev.length,
    totals: { views: week.reduce((a, r) => a + (r.views || 0), 0), prevViews: prev.reduce((a, r) => a + (r.views || 0), 0), likes: week.reduce((a, r) => a + (r.likes || 0), 0), comments: week.reduce((a, r) => a + (r.comments || 0), 0) },
    byPlatform: group(week, r => r.platform), byGame: group(week, r => r.game), byGamePlatform: group(week, r => r.game + ' / ' + r.platform), bySlot: group(week, r => r.time), byWeekday: group(week, r => r.weekday),
    byDecor: group(week.filter(r => r.game === 'hotpotato3d'), r => r.decor), byHook: group(week, r => r.hook), byQuestion: group(week.filter(r => r.question), r => r.question),
    top: [...week].sort((a, b) => (key(b) || 0) - (key(a) || 0)).slice(0, 5), flop: [...week].sort((a, b) => (key(a) || 0) - (key(b) || 0)).slice(0, 5),
    dataWarnings: [] };
  const tt = week.filter(r => r.platform === 'tiktok'); if (tt.length && tt.every(r => !r.views)) summary.dataWarnings.push('All TikTok posts show 0 views in Buffer: check TikTok Studio (metrics not synced, or videos not distributed).');
  if (week.some(r => r.views48h === null)) summary.dataWarnings.push(`${week.filter(r => r.views48h === null).length} posts have no 48 h capture yet: latest value used.`);
  const cols = ['postId', 'platform', 'date', 'weekday', 'time', 'videoId', 'auto', 'game', 'decor', 'winner', 'hook', 'question', 'intensity', 'duration', 'views', 'views48h', 'views7d', 'likes', 'comments', 'shares', 'reach', 'avgWatchSec', 'watchMin', 'ageHours'];
  const csv = [cols.join(',')].concat(rows.map(r => cols.map(c => { const v = r[c]; return v === null || v === undefined ? '' : /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v; }).join(','))).join('\n');
  fs.writeFileSync(path.join(DIR, `dataset-${weekEnd}.csv`), csv + '\n'); L.writeJSON(path.join(DIR, `summary-${weekEnd}.json`), summary);
  L.log(AG, `dataset ${weekStart}..${weekEnd}: ${week.length} posts this week, ${rows.length} in history`);
  console.log(JSON.stringify(summary, null, 1));
}

const [cmd, a] = process.argv.slice(2);
try { if (cmd === 'snapshot') snapshot(a); else if (cmd === 'dataset') dataset(a && /^\d{4}-/.test(a) ? a : null); else console.log('usage: analytics.js snapshot <file> | dataset [weekEnd]'); }
catch (e) { L.log(AG, 'FATAL ' + e.message); process.exit(1); }
