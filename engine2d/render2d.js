// Zoo Wars 2D arena (Territory War, Color War…) – video maker. The game page (arena.html) is used AS IS:
// nothing in it is changed. Only the browser around it is controlled: random numbers come from a seed, the clock is
// virtual (one frame = 1/fps s), and the game sounds are recorded into an offline audio track.
// usage:
//   node render2d.js preview <game> <seed>            -> JSON metrics of the game (no video)
//   node render2d.js render  <game> <seed> <out.mp4> [fps=30]
// game = terr | color | hot   (eat exists in the page but is not used)
'use strict';
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const { spawn, execFileSync } = require('child_process');
const DIR = __dirname, PAGE = 'arena.html', MAX_S = 140;

function ensureFonts() { // Lilita One / Nunito (SIL OFL) shipped in ./fonts, installed for the headless browser
  const dst = path.join(os.homedir(), '.fonts'); fs.mkdirSync(dst, { recursive: true }); let added = false;
  for (const f of fs.readdirSync(path.join(DIR, 'fonts')).filter(f => f.endsWith('.ttf'))) if (!fs.existsSync(path.join(dst, f))) { fs.copyFileSync(path.join(DIR, 'fonts', f), path.join(dst, f)); added = true; }
  if (added) try { execFileSync('fc-cache', ['-f']); } catch (e) {}
}
const serve = () => new Promise(ok => { const s = http.createServer((q, r) => { const f = path.join(DIR, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200); fs.createReadStream(f).pipe(r); }); s.listen(0, () => ok(s)); });

// Injected before the page's own scripts
function harness([seed, maxS]) {
  let s = seed >>> 0;
  Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let VT = 0; performance.now = () => VT; const D0 = 1.7e12; Date.now = () => D0 + VT;
  const timers = []; let tid = 1;
  window.setTimeout = (f, ms, ...a) => { const id = tid++; if (typeof f === 'function') timers.push({ id, t: VT + (+ms || 0), f, a, rep: 0 }); return id; };
  window.setInterval = (f, ms, ...a) => { const id = tid++; if (typeof f === 'function') timers.push({ id, t: VT + Math.max(1, +ms || 0), f, a, rep: Math.max(1, +ms || 0) }); return id; };
  window.clearTimeout = window.clearInterval = id => { const i = timers.findIndex(x => x.id === id); if (i >= 0) timers.splice(i, 1); };
  let raf = null; window.requestAnimationFrame = f => { raf = f; return 1; }; window.cancelAnimationFrame = () => { raf = null; };
  const SR = 48000, OFF = new OfflineAudioContext(2, SR * maxS, SR);
  Object.defineProperty(OFF, 'currentTime', { get: () => VT / 1000 });
  Object.defineProperty(OFF, 'state', { get: () => 'running' });
  OFF.resume = () => Promise.resolve(); OFF.suspend = () => Promise.resolve(); OFF.close = () => Promise.resolve();
  window.AudioContext = window.webkitAudioContext = function () { return OFF; };
  window.__H = {
    step(ms) { const target = VT + ms; for (;;) { timers.sort((a, b) => a.t - b.t || a.id - b.id); const x = timers[0]; if (!x || x.t > target) break; VT = x.t; if (x.rep) x.t += x.rep; else timers.shift(); try { x.f(...x.a); } catch (e) {} } VT = target; const f = raf; raf = null; if (f) f(VT); },
    now: () => VT,
    async audio(sec) {
      const buf = await OFF.startRendering(), n = Math.min(buf.length, Math.ceil(sec * SR)), L = buf.getChannelData(0), R = buf.getChannelData(1);
      const out = new DataView(new ArrayBuffer(44 + n * 4)), w = (o, str) => { for (let i = 0; i < str.length; i++) out.setUint8(o + i, str.charCodeAt(i)); };
      w(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true);
      out.setUint32(24, SR, true); out.setUint32(28, SR * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * 4, true);
      for (let i = 0; i < n; i++) { out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
      const b = new Uint8Array(out.buffer); let str = ''; for (let i = 0; i < b.length; i += 0x8000) str += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(str);
    },
  };
}

async function open(game, seed) {
  ensureFonts();
  const srv = await serve(), br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const p = await br.newPage({ viewport: { width: 600, height: 1000 } });
  await p.route(/googleapis|gstatic/, r => r.abort());
  await p.addInitScript(harness, [seed, MAX_S]);
  await p.goto(`http://localhost:${srv.address().port}/${PAGE}`);
  await p.evaluate(() => document.fonts.load('40px "Lilita One"'));
  await p.evaluate(g => { start(g); }, game); // eslint-disable-line no-undef
  return { srv, br, p };
}

// step frame by frame until the winner screen has been shown for `tail` seconds
async function play(p, fps, onFrame) {
  const ms = 1000 / fps; let frames = 0, info = null;
  for (; frames < MAX_S * fps; frames++) {
    const r = await p.evaluate(([ms, cap]) => { __H.step(ms); // eslint-disable-line no-undef
      const st = { res: !!cur.res, endT, t: cur.t, out: (cur.out || []).length }; // eslint-disable-line no-undef
      if (cap) st.jpg = document.getElementById('cv').toDataURL('image/jpeg', .93); return st; }, [ms, !!onFrame]);
    if (onFrame) await onFrame(r.jpg, frames);
    if (r.res && r.endT > 4.6) { info = await p.evaluate(() => { const g = cur.grid, c = {}; if (g) for (const v of g) if (v >= 0) c[v] = (c[v] || 0) + 1; const v = Object.values(c).sort((a, b) => b - a), tot = v.reduce((a, b) => a + b, 0) || 1; return { winner: cur.res && (cur.res.n || null), out: (cur.out || []).length, gameT: cur.t, finalMargin: v.length > 1 ? +((v[0] - v[1]) / tot).toFixed(3) : null }; }); break; } // eslint-disable-line no-undef
  }
  return { frames: frames + 1, seconds: (frames + 1) / fps, ...(info || { winner: null }) };
}

(async () => {
  const [cmd, game, seedS, out, fpsS] = process.argv.slice(2), seed = (+seedS) >>> 0, fps = +(fpsS || 30);
  if (!['terr', 'color', 'hot'].includes(game)) { console.log('game must be terr, color or hot'); process.exit(1); }
  if (cmd === 'preview') {
    const { srv, br, p } = await open(game, seed);
    const r = await play(p, 30, null); await br.close(); srv.close();
    console.log('PREVIEW ' + JSON.stringify({ game, seed, ...r })); return;
  }
  if (cmd !== 'render' || !out) { console.log('usage: render2d.js preview|render <game> <seed> [out.mp4] [fps]'); process.exit(1); }
  const t0 = Date.now(), { srv, br, p } = await open(game, seed), tmp = out + '.video.mp4', wav = out + '.wav';
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19', '-preset', 'medium', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
  const r = await play(p, fps, async (jpg, i) => { if (!ff.stdin.write(Buffer.from(jpg.split(',')[1], 'base64'))) await new Promise(z => ff.stdin.once('drain', z)); if (i % 300 === 299) console.log('frame', i + 1); });
  ff.stdin.end(); await new Promise(z => ff.on('close', z));
  fs.writeFileSync(wav, Buffer.from(await p.evaluate(s => __H.audio(s), r.seconds), 'base64')); // eslint-disable-line no-undef
  await br.close(); srv.close();
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-i', wav, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', out]);
  fs.unlinkSync(tmp); fs.unlinkSync(wav);
  console.log('DONE', out, 'in', Math.round((Date.now() - t0) / 1000), 's', JSON.stringify({ game, seed, ...r }));
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
