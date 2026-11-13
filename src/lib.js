// Zoo Wars pipeline – shared library: paths, Paris time, persistent registry, logs.
'use strict';
const fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '..');
const P = {
  root: ROOT,
  config: path.join(ROOT, 'config/config.json'),
  registry: process.env.ZW_REGISTRY || path.join(ROOT, 'data/registry.json'), // ZW_REGISTRY: test copy only
  logs: path.join(ROOT, 'data/logs'),
  production: path.join(ROOT, 'production'),
  approved: path.join(ROOT, 'approved'),
  buffer: path.join(ROOT, 'buffer'),
  archives: path.join(ROOT, 'archives'),
  reports: path.join(ROOT, 'reports'),
  engine: path.join(ROOT, 'engine'),
};
for (const k of ['logs', 'production', 'approved', 'buffer', 'archives', 'reports']) fs.mkdirSync(P[k], { recursive: true });

// Buffer tool results may be saved as [{type:'text', text:'<json>'}, …]: unwrap them
function unwrapToolJSON(o) {
  if (Array.isArray(o) && o.length && o.every(x => x && x.type === 'text' && typeof x.text === 'string')) {
    return o.map(x => { try { return JSON.parse(x.text); } catch (e) { return null; } }).filter(Boolean);
  }
  return o;
}
const readJSON = (f, d) => { try { return unwrapToolJSON(JSON.parse(fs.readFileSync(f, 'utf8'))); } catch (e) { if (d !== undefined) return d; throw e; } };
// atomic write: temp file + rename, so a crash never leaves a half-written registry
const writeJSON = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); const t = f + '.tmp' + process.pid; fs.writeFileSync(t, JSON.stringify(o, null, 2) + '\n'); fs.renameSync(t, f); };
const config = () => readJSON(P.config);

// ---------- time (Europe/Paris) ----------
const TZ = 'Europe/Paris';
function parisParts(d = new Date()) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const o = {}; for (const p of f.formatToParts(d)) o[p.type] = p.value; return o;
}
const todayParis = () => { if (process.env.ZW_TODAY) return process.env.ZW_TODAY; const o = parisParts(); return `${o.year}-${o.month}-${o.day}`; };
const nowParisISO = () => { const o = parisParts(); return `${o.year}-${o.month}-${o.day}T${o.hour}:${o.minute}:${o.second}${offsetFor(`${o.year}-${o.month}-${o.day}`, `${o.hour}:${o.minute}`)}`; };
function addDays(date, n) { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
// UTC offset of Paris at a given local date/time (handles summer/winter time)
function offsetFor(date, hm) {
  const guess = new Date(`${date}T${hm}:00Z`);
  for (const off of [60, 120]) {
    const utc = new Date(guess.getTime() - off * 60000), o = parisParts(utc);
    if (`${o.year}-${o.month}-${o.day}` === date && `${o.hour}:${o.minute}` === hm) return '+' + String(off / 60).padStart(2, '0') + ':00';
  }
  throw new Error('time does not exist in Paris: ' + date + ' ' + hm);
}
const dueAtFor = (date, hm) => `${date}T${hm}:00${offsetFor(date, hm)}`;

// ---------- logs ----------
function log(agent, msg, extra) {
  const line = `${nowParisISO()} [${agent}] ${msg}${extra ? ' ' + JSON.stringify(extra) : ''}`;
  fs.appendFileSync(path.join(P.logs, todayParis() + '.log'), line + '\n'); console.log(line);
}

// ---------- registry ----------
// video status : produced -> validated -> uploaded -> scheduled -> published  (error at any step)
// post status  : prepared -> scheduled -> published   (error)  — one post per (video, channel)
const VIDEO_FLOW = { planned: ['produced', 'error'], produced: ['validated', 'error'], validated: ['uploaded', 'error'], uploaded: ['scheduled', 'error'], scheduled: ['published', 'error'], published: [], error: ['planned', 'produced', 'validated', 'uploaded', 'scheduled'] };
const LOCK = P.registry + '.lock';
function withRegistry(fn) {
  // simple exclusive lock (one writer at a time); a lock older than 30 min is considered stale
  for (let i = 0; ; i++) {
    try { fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' }); break; }
    catch (e) {
      if (fs.existsSync(LOCK) && Date.now() - fs.statSync(LOCK).mtimeMs > 30 * 60000) { fs.unlinkSync(LOCK); continue; }
      if (i > 100) throw new Error('registry locked'); require('child_process').execSync('sleep 0.1');
    }
  }
  try { const r = readJSON(P.registry, { version: 1, videos: {}, captionsUsed: [] }); const out = fn(r); r.updatedAt = nowParisISO(); writeJSON(P.registry, r); return out; }
  finally { try { fs.unlinkSync(LOCK); } catch (e) {} }
}
const loadRegistry = () => readJSON(P.registry, { version: 1, videos: {}, captionsUsed: [] });
function setVideoStatus(reg, id, status, note) {
  const v = reg.videos[id]; if (!v) throw new Error('unknown video ' + id);
  if (v.status !== status && !(VIDEO_FLOW[v.status] || []).includes(status)) throw new Error(`forbidden transition ${id}: ${v.status} -> ${status}`);
  v.history = v.history || []; v.history.push({ at: nowParisISO(), from: v.status, to: status, note: note || '' });
  v.status = status;
}
// every video slot of a date: the daily slots + the weekly ones (e.g. Sunday 18:00 standings)
function daySlots(date) {
  const cfg = config(), wd = new Date(date + 'T12:00:00Z').getUTCDay();
  const out = cfg.slots.map((time, i) => ({ slot: i + 1, time, game: (cfg.slotGames || [])[i] || 'hot-potato-3d' }));
  for (const w of cfg.weeklySlots || []) if (w.weekday === wd && !(w.game === 'standings' && cfg.standings && date < addDays(cfg.standings.season1Start, 6))) out.push({ slot: out.length + 1, time: w.time, game: w.game });
  return out;
}
const videoId = (date, slot) => `ZW-${date.replace(/-/g, '')}-${slot}`;

function die(msg) { console.error('ERROR: ' + msg); process.exit(1); }

module.exports = { daySlots, P, readJSON, writeJSON, config, todayParis, nowParisISO, addDays, dueAtFor, offsetFor, log, withRegistry, loadRegistry, setVideoStatus, videoId, die };
