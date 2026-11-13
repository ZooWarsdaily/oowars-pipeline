#!/usr/bin/env node
// Agent 1 – VIDEO PRODUCER
// Uses the existing Hot Potato 3D engine as is (never changes the game). Commands:
//   plan <date>        create the day's video entries (winner + decor planned for variety)
//   select <id>        simulate many games, score them, keep the best unused one
//   render <id>        render the MP4 (engine/grender.js for Hot Potato 3D, engine2d/render2d.js for the 2D arena) -> produced
//   qc <id>            check the file, write its fiche, file it by date   -> status validated
//   run <date>         plan + select + render + qc for every video of the date that is not validated yet
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), crypto = require('crypto');
const { execFileSync, spawn } = require('child_process');
const L = require('./lib');
const AG = 'producer';
const cfg = L.config();

// ---------- plan ----------
// the 8 animals of a 3D video: frozen in the plan (older plans: the original 8)
function rosterOf(v) { return (v.plan && v.plan.roster) || ['lion', 'tiger', 'bear', 'wolf', 'gorilla', 'fox', 'bull', 'panda']; }
function drawWinner() {
  const odds = cfg.production.winOdds || {}, a = cfg.production.animals, w = a.map(x => odds[x] || 12.5), tot = w.reduce((p, q) => p + q, 0);
  let r = crypto.randomBytes(4).readUInt32BE(0) / 2 ** 32 * tot;
  for (let i = 0; i < a.length; i++) { r -= w[i]; if (r < 0) return a[i]; }
  return a[a.length - 1];
}
function plan(date) {
  return L.withRegistry(reg => {
    const all = Object.values(reg.videos).filter(v => v.status !== 'error' || v.plan);
    const count = (k, f) => { const c = {}; for (const x of cfg.production[k]) c[x] = 0; for (const v of all) if (v.plan && c[v.plan[f]] !== undefined) c[v.plan[f]]++; return c; };
    const ids = [];
    for (const sl of L.daySlots(date)) {
      const s = sl.slot, id = L.videoId(date, s); ids.push(id);
      if (reg.videos[id]) continue;
      const sameDay = Object.values(reg.videos).filter(v => v.date === date);
      const game = sl.game;
      if (game === 'standings') {
        reg.videos[id] = { id, date, slot: s, time: sl.time, game: 'standings', status: 'planned', plan: { winner: null, theme: 'standings' }, posts: {}, history: [{ at: L.nowParisISO(), to: 'planned' }] };
        L.log(AG, `planned ${id}`, { slot: sl.time, game: 'standings' }); continue;
      }
      if (game === 'arena2d') {
        // rotation: the 2D game used least recently (never used first) goes next
        const rot = cfg.production.arena2d.rotation;
        const lastUse = g => Object.values(reg.videos).filter(x => x.game === 'arena2d' && x.plan.theme === g && x.date < date).map(x => x.date).sort().pop() || '';
        const theme = rot.slice().sort((a, b) => lastUse(a).localeCompare(lastUse(b)) || rot.indexOf(a) - rot.indexOf(b))[0];
        reg.videos[id] = { id, date, slot: s, time: sl.time, game: 'arena2d', status: 'planned', plan: { winner: null, theme }, posts: {}, history: [{ at: L.nowParisISO(), to: 'planned' }] };
        L.log(AG, `planned ${id}`, { slot: sl.time, game: theme }); continue;
      }
      const hp = Object.values(reg.videos).filter(v => v.game !== 'arena2d');
      const lastWinners = hp.sort((a, b) => (a.id < b.id ? 1 : -1)).slice(0, 4).map(v => v.plan && v.plan.winner);
      const wc = count('animals', 'winner'), tc = count('themes', 'theme');
      // least used winner, not used today nor in the last 4 videos; least used decor not used today
      // natural winners (owner's choice, 13/11/2026): the winner is DRAWN AT RANDOM with the game's own odds (about 1/8 each),
      // then the best game won by that animal is kept. Keeping "the best of 600" whoever wins would favour some characters
      // (test of 13/11: gorilla 24 %, panda 1 %), so the draw keeps the standings fair.
      const winner = cfg.production.naturalWinners ? drawWinner() : cfg.production.animals.filter(a => !sameDay.some(v => v.plan.winner === a) && !lastWinners.includes(a)).sort((a, b) => wc[a] - wc[b] || Math.random() - .5)[0]
        || cfg.production.animals.sort((a, b) => wc[a] - wc[b])[0];
      // natural winners (owner's choice, 13/11/2026): the simulation decides who wins, the best game is kept whoever wins
      const theme = cfg.production.themes.filter(t => !sameDay.some(v => v.plan.theme === t)).sort((a, b) => tc[a] - tc[b] || Math.random() - .5)[0];
      reg.videos[id] = { id, date, slot: s, time: sl.time, game: cfg.production.game, status: 'planned', plan: { winner, theme, roster: cfg.production.animals.slice() }, posts: {}, history: [{ at: L.nowParisISO(), to: 'planned' }] };
      L.log(AG, `planned ${id}`, { slot: sl.time, theme, winner: cfg.production.naturalWinners ? 'random draw' : winner });
    }
    return ids;
  });
}

// ---------- browser helpers ----------
const DIST = path.join(L.P.engine, 'dist');
const serve = () => new Promise(ok => { const s = http.createServer((q, r) => { const f = path.join(DIST, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200); fs.createReadStream(f).pipe(r); }); s.listen(0, () => ok(s)); });

// Score one game from the outside: the simulation is deterministic, so this is exactly the game that will be rendered.
// dynamism = passes ; twists = passes in the last 1.2 s before an explosion ; eliminations = every round must have a pass ;
// final = passes during the duel and its length.
function scoreGames(seeds, isVoid) {
  /* eslint-disable no-undef */
  const out = [];
  for (const seed of seeds) {
    const G = createGame(seed, { void: isVoid }); let n = 0; const tagT = [], boomT = []; let dodges = 0, duelT = null;
    while (!G.done && n++ < 60 * 150) { G.advance(1 / 60); for (const e of G.ev) { if (e.type === 'tag') tagT.push(G.vt); else if (e.type === 'boom') boomT.push(G.vt); else if (e.type === 'dodge') dodges++; else if (e.type === 'duel') duelT = G.vt; } G.ev.length = 0; }
    if (!G.winner) continue;
    const dur = G.vt, minTags = Math.min(...G.roundTags), finalTags = G.roundTags[G.roundTags.length - 1] || 0;
    let clutch = 0; for (const t of tagT) if (boomT.some(b => b > t && b - t < 1.2)) clutch++;
    const finalDur = duelT !== null && boomT.length ? boomT[boomT.length - 1] - duelT : 0;
    out.push({ seed, winner: G.winner.k, dur: +dur.toFixed(2), tags: G.tags, minTags, roundTags: G.roundTags, clutch, dodges, finalTags, finalDur: +finalDur.toFixed(2), order: G.order.map(i => G.animals[i].k) });
  }
  return out;
}
function rate(m) {
  if (m.dur < 54 || m.dur > 68 || m.minTags < 1) return -1;
  return +(m.tags + m.minTags * 4 + m.clutch * 3 + m.finalTags * 2 + Math.min(m.dodges, 10) * .5 - Math.abs(m.dur - 61) * .5 + (m.finalDur >= 6 && m.finalDur <= 14 ? 3 : 0)).toFixed(2);
}

async function select(id) {
  const reg = L.loadRegistry(), v = reg.videos[id]; if (!v) L.die('unknown ' + id);
  if (v.selection && v.status !== 'error') { L.log(AG, `${id} already selected (seed ${v.selection.seed})`); return; }
  const used = new Set(Object.values(reg.videos).filter(x => x.selection && x.id !== id).map(x => x.selection.seed));
  if (v.game === 'arena2d') return select2d(id, v, reg, used);
  if (v.game === 'standings') { L.withRegistry(r => { r.videos[id].selection = { seed: 0, metrics: {}, simulated: 0 }; }); return; }
  const { chromium } = require('/opt/npm-tools/node_modules/playwright');
  const srv = await serve(), br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await br.newPage(); await p.route(/googleapis|gstatic/, r => r.abort());
  await p.goto(`http://localhost:${srv.address().port}/index.html?roster=${rosterOf(v).join(',')}`); await p.waitForFunction(() => typeof createGame === 'function');
  const okRoster = await p.evaluate(r => KINDS.join(',') === r, rosterOf(v).join(','));
  if (!okRoster) { await br.close(); srv.close(); L.die(`${id}: the game refused the roster ${rosterOf(v).join(',')}`); }
  const N = cfg.production.candidatesPerVideo, base = crypto.randomBytes(4).readUInt32BE(0), isVoid = v.plan.theme === 'space';
  const seeds = Array.from({ length: N }, (_, i) => (base + i * 2654435761) >>> 0).filter(s => !used.has(s));
  const t0 = Date.now(); let res = [];
  for (let i = 0; i < seeds.length; i += 50) res = res.concat(await p.evaluate(`(${scoreGames.toString()})(${JSON.stringify(seeds.slice(i, i + 50))}, ${isVoid})`));
  await br.close(); srv.close();
  const cand = res.filter(m => !v.plan.winner || m.winner === v.plan.winner).map(m => ({ ...m, score: rate(m) })).filter(m => m.score > 0).sort((a, b) => b.score - a.score);
  L.log(AG, `${id}: ${res.length} games simulated in ${Math.round((Date.now() - t0) / 1000)}s, ${cand.length} valid${v.plan.winner ? ' with the planned winner' : ' (natural winner)'}`);
  if (!cand.length) { L.withRegistry(r => { r.videos[id].lastError = 'no valid game found'; }); L.die('no valid game for ' + id); }
  L.withRegistry(r => { r.videos[id].selection = { seed: cand[0].seed, metrics: cand[0], simulated: res.length, runnersUp: cand.slice(1, 4).map(c => ({ seed: c.seed, score: c.score })) }; });
  L.log(AG, `${id}: best seed ${cand[0].seed} score ${cand[0].score}`, { tags: cand[0].tags, clutch: cand[0].clutch, final: cand[0].finalTags, dur: cand[0].dur });
}

// 2D arena: games always last about 67 s; preview a few seeds (exact replay) and prefer a winner that has not won this game recently
async function select2d(id, v, reg, used) {
  const N = cfg.production.arena2d.candidates, t0 = Date.now(), res = [];
  const recent = Object.values(reg.videos).filter(x => x.game === 'arena2d' && x.plan.theme === v.plan.theme && x.selection && x.id !== id).sort((a, b) => (a.id < b.id ? 1 : -1)).slice(0, 4).map(x => x.selection.metrics.winner);
  for (let i = 0; i < N; i++) {
    const seed = crypto.randomBytes(4).readUInt32BE(0); if (used.has(seed)) continue;
    try { const o = execFileSync('node', [path.join(L.P.root, 'engine2d/render2d.js'), 'preview', v.plan.theme, String(seed)], { timeout: 180000 }).toString();
      const m = JSON.parse(o.slice(o.indexOf('PREVIEW ') + 8)); if (m.winner && m.seconds > 45 && m.seconds < 90) res.push(m); } catch (e) { L.log(AG, `${id}: preview failed ${e.message.slice(0, 100)}`); }
  }
  const score = m => (recent.includes(m.winner) ? 0 : 10) + (m.finalMargin === null ? 0 : (1 - m.finalMargin) * 5) + (m.out || 0);
  const cand = res.map(m => ({ ...m, score: +score(m).toFixed(2) })).sort((a, b) => b.score - a.score);
  L.log(AG, `${id}: ${res.length} ${v.plan.theme} games previewed in ${Math.round((Date.now() - t0) / 1000)}s`);
  if (!cand.length) { L.withRegistry(r => { r.videos[id].lastError = 'no valid 2D game'; }); L.die('no valid game for ' + id); }
  L.withRegistry(r => { r.videos[id].selection = { seed: cand[0].seed, metrics: cand[0], simulated: res.length, runnersUp: cand.slice(1, 3).map(c => ({ seed: c.seed, score: c.score })) }; });
  L.log(AG, `${id}: best seed ${cand[0].seed} score ${cand[0].score}`);
}

// ---------- render ----------
function render(id) {
  return new Promise((ok, ko) => {
    const reg = L.loadRegistry(), v = reg.videos[id]; if (!v || !v.selection) return ko(new Error('select first: ' + id));
    if (['produced', 'validated', 'uploaded', 'scheduled', 'published'].includes(v.status)) { L.log(AG, `${id} already rendered`); return ok(); }
    const dir = path.join(L.P.production, v.date); fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, id + '.mp4'), t0 = Date.now();
    L.log(AG, `${id}: render starts (seed ${v.selection.seed}, ${v.plan.theme})`);
    const ch = v.game === 'arena2d'
      ? spawn('node', [path.join(L.P.root, 'engine2d/render2d.js'), 'render', v.plan.theme, String(v.selection.seed), out, String(cfg.production.fps)], { cwd: path.join(L.P.root, 'engine2d') })
      : v.game === 'standings'
      ? spawn('node', [path.join(L.P.root, 'standings/render-standings.js'), id, out, String(cfg.production.fps)], { cwd: path.join(L.P.root, 'standings') })
      : spawn('node', [path.join(L.P.engine, 'grender.js'), String(v.selection.seed), out, String(cfg.production.fps), v.plan.winner || v.selection.metrics.winner, v.plan.theme, cfg.production.quality], { cwd: L.P.engine, env: { ...process.env, GAME: DIST, STANDING: standingLine(v), ROSTER: rosterOf(v).join(',') } });
    let done = null, buf = '';
    const eat = d => { buf += d; const lines = buf.split('\n'); buf = lines.pop(); for (const l of lines) { if (l.startsWith('DONE')) done = l; if (/frame|DONE|MUSIC|NO GAME|seed/.test(l)) L.log(AG, `${id} | ${l.slice(0, 300)}`); } };
    ch.stdout.on('data', eat); ch.stderr.on('data', eat);
    ch.on('close', code => {
      if (code !== 0 || !done || !fs.existsSync(out)) { L.withRegistry(r => { r.videos[id].lastError = 'render failed (code ' + code + ')'; setErr(r, id, 'render failed'); }); return ko(new Error('render failed ' + id)); }
      const info = JSON.parse(done.slice(done.indexOf('{')));
      L.withRegistry(r => {
        const x = r.videos[id]; x.render = { file: path.relative(L.P.root, out), seconds: Math.round((Date.now() - t0) / 1000), info };
        const mism = x.game === 'standings' ? false : x.game === 'arena2d' ? info.winner !== x.selection.metrics.winner : (info.winner !== (x.plan.winner || x.selection.metrics.winner) || info.theme !== x.plan.theme);
        if (mism) { x.lastError = `render mismatch: ${info.winner}/${info.theme || info.game}`; L.setVideoStatus(r, id, 'error', x.lastError); }
        else L.setVideoStatus(r, id, 'produced', 'render ok');
      });
      L.log(AG, `${id}: rendered in ${Math.round((Date.now() - t0) / 60000)} min`); ok();
    });
  });
}
// end-screen line for a 3D video: the winner's season rank once this win is counted, e.g. "SEASON 1 · #2 · 5 WINS"
function standingLine(v) {
  try {
    const S = require('./standings'), w = v.plan.winner || v.selection.metrics.winner, st = S.standings(S.pubTime(v));
    if (!st || !w) return '';
    const wins = st.table.find(r => r.animal === w).wins + 1, above = st.table.filter(r => r.animal !== w && r.wins > wins).length, tied = st.table.some(r => r.animal !== w && r.wins === wins);
    return `SEASON ${st.season} · ${tied ? 'TIED ' : ''}#${above + 1} · ${wins} WIN${wins > 1 ? 'S' : ''}`;
  } catch (e) { L.log(AG, 'standing line skipped: ' + e.message); return ''; }
}
function setErr(r, id, why) { try { L.setVideoStatus(r, id, 'error', why); } catch (e) { r.videos[id].status = 'error'; } }

// ---------- quality control ----------
function qc(id) {
  const reg = L.loadRegistry(), v = reg.videos[id]; if (!v) L.die('unknown ' + id);
  if (v.status !== 'produced') { L.log(AG, `${id}: qc skipped (status ${v.status})`); return v.status === 'validated'; }
  const f = path.join(L.P.root, v.render.file), Q = cfg.qc, problems = [];
  let pr = {};
  try { pr = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', f]).toString()); } catch (e) { problems.push('ffprobe cannot read the file'); }
  const vs = (pr.streams || []).find(s => s.codec_type === 'video'), as = (pr.streams || []).find(s => s.codec_type === 'audio');
  const dur = +(pr.format && pr.format.duration || 0), size = fs.existsSync(f) ? fs.statSync(f).size : 0;
  const fps = vs ? eval(vs.avg_frame_rate) : 0; // "30/1"
  if (!vs) problems.push('no video stream'); else {
    if (vs.width !== Q.width || vs.height !== Q.height) problems.push(`resolution ${vs.width}x${vs.height} (expected ${Q.width}x${Q.height})`);
    if (vs.codec_name !== Q.videoCodec) problems.push('video codec ' + vs.codec_name);
    if (vs.pix_fmt !== 'yuv420p') problems.push('pixel format ' + vs.pix_fmt);
    if (fps < Q.minFps || fps > Q.maxFps) problems.push('fps ' + fps);
  }
  if (!as) problems.push('no audio stream'); else if (as.codec_name !== Q.audioCodec) problems.push('audio codec ' + as.codec_name);
  const dmin = v.game === 'standings' ? (Q.standingsMinDuration || 10) : Q.minDuration, dmax = v.game === 'standings' ? (Q.standingsMaxDuration || 60) : Q.maxDuration;
  if (dur < dmin || dur > dmax) problems.push('duration ' + dur.toFixed(1) + ' s');
  if (size > Q.maxSizeMB * 1048576) problems.push('size ' + (size / 1048576).toFixed(1) + ' MB');
  // integrity: decode every frame and every audio sample
  try { const e = execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-f', 'null', '-'], { stdio: ['ignore', 'pipe', 'pipe'] }).toString(); if (e.trim()) problems.push('decode errors: ' + e.slice(0, 200)); }
  catch (e) { problems.push('decode failed: ' + String(e.stderr || e).slice(0, 200)); }
  // blank / frozen check: mean luminance of 5 frames must vary and not be black
  const lum = [];
  for (const t of [3, 15, 30, 45, Math.max(1, dur - 3)]) {
    try { const b = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(t), '-i', f, '-frames:v', '1', '-vf', 'scale=54:96,format=gray', '-f', 'rawvideo', '-']); lum.push(b.reduce((a, x) => a + x, 0) / b.length); } catch (e) { problems.push('frame at ' + t + 's unreadable'); }
  }
  if (lum.length && Math.max(...lum) < 12) problems.push('video is black');
  const sha = fs.existsSync(f) ? crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') : '';
  const dupe = Object.values(reg.videos).find(x => x.id !== id && x.qc && x.qc.sha256 === sha);
  if (dupe) problems.push('identical file already exists: ' + dupe.id);
  const dupeSeed = v.game !== 'standings' && Object.values(reg.videos).find(x => x.id !== id && x.selection && x.selection.seed === v.selection.seed && x.plan.theme === v.plan.theme && x.game === v.game && x.status !== 'error');
  if (dupeSeed) problems.push('same game already used by ' + dupeSeed.id);

  const result = { at: L.nowParisISO(), ok: !problems.length, problems, duration: +dur.toFixed(2), width: vs && vs.width, height: vs && vs.height, fps, videoCodec: vs && vs.codec_name, audioCodec: as && as.codec_name, sizeMB: +(size / 1048576).toFixed(2), sha256: sha, luminance: lum.map(x => +x.toFixed(1)) };
  if (problems.length) {
    L.withRegistry(r => { r.videos[id].qc = result; r.videos[id].lastError = 'qc: ' + problems.join('; '); L.setVideoStatus(r, id, 'error', 'qc failed'); });
    L.log(AG, `${id}: QC FAILED`, problems); return false;
  }
  // file it in approved/<publication date>/ with its descriptive fiche
  const dir = path.join(L.P.approved, v.date); fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, id + '.mp4'); fs.copyFileSync(f, dest);
  if (crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex') !== sha) L.die('copy corrupted ' + id);
  const m = v.selection.metrics, is2d = v.game === 'arena2d';
  const fiche = v.game === 'standings' ? { id, game: 'Weekly standings', publishDate: v.date, time: v.time, timezone: cfg.timezone, standings: v.render.info, file: { name: id + '.mp4', ...result } } : is2d ? {
    id, game: { terr: 'Territory War', color: 'Color War', hot: 'Hot Potato 2D' }[v.plan.theme], publishDate: v.date, slot: v.slot, time: v.time, timezone: cfg.timezone,
    seed: v.selection.seed, winner: m.winner, highlights: { eliminations: m.out, finalMargin: m.finalMargin, videoSeconds: +m.seconds.toFixed(1), score: m.score, gamesPreviewed: v.selection.simulated },
    file: { name: id + '.mp4', ...result },
  } : {
    id, game: 'Hot Potato 3D', publishDate: v.date, slot: v.slot, time: v.time, timezone: cfg.timezone,
    seed: v.selection.seed, theme: v.plan.theme, winner: v.plan.winner || v.selection.metrics.winner, eliminationOrder: v.render.info.order,
    highlights: { passes: m.tags, lastSecondPasses: m.clutch, passesInFinalDuel: m.finalTags, finalDuelSeconds: m.finalDur, dodges: m.dodges, gameSeconds: m.dur, score: m.score, gamesSimulated: v.selection.simulated },
    file: { name: id + '.mp4', ...result },
  };
  L.writeJSON(path.join(dir, id + '.json'), fiche);
  L.withRegistry(r => { const x = r.videos[id]; x.qc = result; x.approvedFile = path.relative(L.P.root, dest); x.fiche = path.relative(L.P.root, path.join(dir, id + '.json')); delete x.lastError; L.setVideoStatus(r, id, 'validated', 'qc ok'); });
  L.log(AG, `${id}: VALIDATED (${result.duration}s, ${result.sizeMB} MB)`); return true;
}

// the games' own font (Lilita One, SIL OFL) must be installed before ANY render, or the 3D game falls back to another font
function ensureFonts() {
  const src = path.join(L.P.root, 'engine2d/fonts'), dst = path.join(require('os').homedir(), '.fonts'); fs.mkdirSync(dst, { recursive: true }); let added = false;
  for (const f of fs.readdirSync(src).filter(f => f.endsWith('.ttf'))) if (!fs.existsSync(path.join(dst, f))) { fs.copyFileSync(path.join(src, f), path.join(dst, f)); added = true; }
  if (added) try { execFileSync('fc-cache', ['-f']); } catch (e) {}
}
async function run(date) {
  ensureFonts();
  const ids = plan(date);
  for (const id of ids) {
    let v = L.loadRegistry().videos[id];
    if (['validated', 'uploaded', 'scheduled', 'published'].includes(v.status)) { L.log(AG, `${id} already ${v.status}`); continue; }
    for (let attempt = 1; attempt <= 2; attempt++) { // one automatic retry with a fresh game
      try {
        v = L.loadRegistry().videos[id];
        if (v.status === 'error') L.withRegistry(r => { const x = r.videos[id]; delete x.selection; delete x.render; delete x.qc; L.setVideoStatus(r, id, 'planned', 'retry ' + attempt); });
        await select(id); await render(id); if (qc(id)) break;
      } catch (e) { L.log(AG, `${id}: attempt ${attempt} failed: ${e.message}`); }
    }
  }
  const st = ids.map(i => `${i}=${L.loadRegistry().videos[i].status}`).join(' ');
  L.log(AG, `run ${date} finished: ${st}`);
  console.log('PRODUCER_RESULT ' + st);
}

(async () => {
  const [cmd, arg] = process.argv.slice(2);
  try {
    if (cmd === 'plan') console.log(plan(arg).join(' '));
    else if (cmd === 'select') await select(arg);
    else if (cmd === 'render') await render(arg);
    else if (cmd === 'qc') process.exit(qc(arg) ? 0 : 2);
    else if (cmd === 'run') await run(arg);
    else console.log('usage: producer.js plan|run <YYYY-MM-DD> | select|render|qc <video id>');
  } catch (e) { L.log(AG, 'FATAL ' + e.message); process.exit(1); }
})();
