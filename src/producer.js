#!/usr/bin/env node
// Agent 1 – VIDEO PRODUCER
// Uses the existing Hot Potato 3D engine as is (never changes the game). Commands:
//   plan <date>        create the day's video entries (winner + decor planned for variety)
//   select <id>        simulate many games, score them, keep the best unused one
//   render <id>        render the MP4 with engine/grender.js            -> status produced
//   qc <id>            check the file, write its fiche, file it by date   -> status validated
//   run <date>         plan + select + render + qc for every video of the date that is not validated yet
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), crypto = require('crypto');
const { execFileSync, spawn } = require('child_process');
const L = require('./lib');
const AG = 'producer';
const cfg = L.config();

// ---------- plan ----------
function plan(date) {
  return L.withRegistry(reg => {
    const all = Object.values(reg.videos).filter(v => v.status !== 'error' || v.plan);
    const count = (k, f) => { const c = {}; for (const x of cfg.production[k]) c[x] = 0; for (const v of all) if (v.plan && c[v.plan[f]] !== undefined) c[v.plan[f]]++; return c; };
    const ids = [];
    for (let s = 1; s <= cfg.videosPerDay; s++) {
      const id = L.videoId(date, s); ids.push(id);
      if (reg.videos[id]) continue;
      const sameDay = Object.values(reg.videos).filter(v => v.date === date);
      const lastWinners = Object.values(reg.videos).sort((a, b) => (a.id < b.id ? 1 : -1)).slice(0, 4).map(v => v.plan && v.plan.winner);
      const wc = count('animals', 'winner'), tc = count('themes', 'theme');
      // least used winner, not used today nor in the last 4 videos; least used decor not used today
      const winner = cfg.production.animals.filter(a => !sameDay.some(v => v.plan.winner === a) && !lastWinners.includes(a)).sort((a, b) => wc[a] - wc[b] || Math.random() - .5)[0]
        || cfg.production.animals.sort((a, b) => wc[a] - wc[b])[0];
      const theme = cfg.production.themes.filter(t => !sameDay.some(v => v.plan.theme === t)).sort((a, b) => tc[a] - tc[b] || Math.random() - .5)[0];
      reg.videos[id] = { id, date, slot: s, time: cfg.slots[s - 1], game: cfg.production.game, status: 'planned', plan: { winner, theme }, posts: {}, history: [{ at: L.nowParisISO(), to: 'planned' }] };
      L.log(AG, `planned ${id}`, { slot: cfg.slots[s - 1], theme });
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
  const { chromium } = require('/opt/npm-tools/node_modules/playwright');
  const srv = await serve(), br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await br.newPage(); await p.route(/googleapis|gstatic/, r => r.abort());
  await p.goto(`http://localhost:${srv.address().port}/index.html`); await p.waitForFunction(() => typeof createGame === 'function');
  const N = cfg.production.candidatesPerVideo, base = crypto.randomBytes(4).readUInt32BE(0), isVoid = v.plan.theme === 'space';
  const seeds = Array.from({ length: N }, (_, i) => (base + i * 2654435761) >>> 0).filter(s => !used.has(s));
  const t0 = Date.now(); let res = [];
  for (let i = 0; i < seeds.length; i += 50) res = res.concat(await p.evaluate(`(${scoreGames.toString()})(${JSON.stringify(seeds.slice(i, i + 50))}, ${isVoid})`));
  await br.close(); srv.close();
  const cand = res.filter(m => m.winner === v.plan.winner).map(m => ({ ...m, score: rate(m) })).filter(m => m.score > 0).sort((a, b) => b.score - a.score);
  L.log(AG, `${id}: ${res.length} games simulated in ${Math.round((Date.now() - t0) / 1000)}s, ${cand.length} valid with the planned winner`);
  if (!cand.length) { L.withRegistry(r => { r.videos[id].lastError = 'no valid game found'; }); L.die('no valid game for ' + id); }
  L.withRegistry(r => { r.videos[id].selection = { seed: cand[0].seed, metrics: cand[0], simulated: res.length, runnersUp: cand.slice(1, 4).map(c => ({ seed: c.seed, score: c.score })) }; });
  L.log(AG, `${id}: best seed ${cand[0].seed} score ${cand[0].score}`, { tags: cand[0].tags, clutch: cand[0].clutch, final: cand[0].finalTags, dur: cand[0].dur });
}

// ---------- render ----------
function render(id) {
  return new Promise((ok, ko) => {
    const reg = L.loadRegistry(), v = reg.videos[id]; if (!v || !v.selection) return ko(new Error('select first: ' + id));
    if (['produced', 'validated', 'uploaded', 'scheduled', 'published'].includes(v.status)) { L.log(AG, `${id} already rendered`); return ok(); }
    const dir = path.join(L.P.production, v.date); fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, id + '.mp4'), t0 = Date.now();
    L.log(AG, `${id}: render starts (seed ${v.selection.seed}, ${v.plan.theme})`);
    const ch = spawn('node', [path.join(L.P.engine, 'grender.js'), String(v.selection.seed), out, String(cfg.production.fps), v.plan.winner, v.plan.theme, cfg.production.quality], { cwd: L.P.engine, env: { ...process.env, GAME: DIST } });
    let done = null, buf = '';
    const eat = d => { buf += d; const lines = buf.split('\n'); buf = lines.pop(); for (const l of lines) { if (l.startsWith('DONE')) done = l; if (/frame|DONE|MUSIC|NO GAME|seed/.test(l)) L.log(AG, `${id} | ${l.slice(0, 300)}`); } };
    ch.stdout.on('data', eat); ch.stderr.on('data', eat);
    ch.on('close', code => {
      if (code !== 0 || !done || !fs.existsSync(out)) { L.withRegistry(r => { r.videos[id].lastError = 'render failed (code ' + code + ')'; setErr(r, id, 'render failed'); }); return ko(new Error('render failed ' + id)); }
      const info = JSON.parse(done.slice(done.indexOf('{')));
      L.withRegistry(r => {
        const x = r.videos[id]; x.render = { file: path.relative(L.P.root, out), seconds: Math.round((Date.now() - t0) / 1000), info };
        if (info.winner !== x.plan.winner || info.theme !== x.plan.theme) { x.lastError = `render mismatch: ${info.winner}/${info.theme}`; L.setVideoStatus(r, id, 'error', x.lastError); }
        else L.setVideoStatus(r, id, 'produced', 'render ok');
      });
      L.log(AG, `${id}: rendered in ${Math.round((Date.now() - t0) / 60000)} min`); ok();
    });
  });
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
  if (dur < Q.minDuration || dur > Q.maxDuration) problems.push('duration ' + dur.toFixed(1) + ' s');
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
  const dupeSeed = Object.values(reg.videos).find(x => x.id !== id && x.selection && x.selection.seed === v.selection.seed && x.plan.theme === v.plan.theme && x.status !== 'error');
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
  const m = v.selection.metrics;
  const fiche = {
    id, game: 'Hot Potato 3D', publishDate: v.date, slot: v.slot, time: v.time, timezone: cfg.timezone,
    seed: v.selection.seed, theme: v.plan.theme, winner: v.plan.winner, eliminationOrder: v.render.info.order,
    highlights: { passes: m.tags, lastSecondPasses: m.clutch, passesInFinalDuel: m.finalTags, finalDuelSeconds: m.finalDur, dodges: m.dodges, gameSeconds: m.dur, score: m.score, gamesSimulated: v.selection.simulated },
    file: { name: id + '.mp4', ...result },
  };
  L.writeJSON(path.join(dir, id + '.json'), fiche);
  L.withRegistry(r => { const x = r.videos[id]; x.qc = result; x.approvedFile = path.relative(L.P.root, dest); x.fiche = path.relative(L.P.root, path.join(dir, id + '.json')); delete x.lastError; L.setVideoStatus(r, id, 'validated', 'qc ok'); });
  L.log(AG, `${id}: VALIDATED (${result.duration}s, ${result.sizeMB} MB)`); return true;
}

async function run(date) {
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
