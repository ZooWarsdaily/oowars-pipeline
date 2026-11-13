// Weekly standings video: node render-standings.js <videoId> <out.mp4> [fps=30]
// The standings are computed from the registry as of the video's own publication time (src/standings.js).
// Music: the owner's Zoo Wars theme (engine/dist/music A + B sections, unchanged), faded out at the end.
'use strict';
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const { spawn, execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const L = require(path.join(ROOT, 'src/lib')), S = require(path.join(ROOT, 'src/standings'));

const DAYS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmt = d => `${DAYS.at(+d.slice(5, 7))} ${+d.slice(8)}`;
const serve = () => new Promise(ok => { const s = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200); fs.createReadStream(f).pipe(r); }); s.listen(0, () => ok(s)); });

(async () => {
  const [id, out, fpsS] = process.argv.slice(2), fps = +(fpsS || 30);
  const reg = L.loadRegistry(), v = reg.videos[id]; if (!v) { console.error('unknown ' + id); process.exit(1); }
  const st = S.standings(S.pubTime(v), reg); if (!st) { console.error('no season yet'); process.exit(1); }
  const weekEnd = L.addDays(st.weekStart, 6);
  const DATA = { season: st.season, weekLabel: `${fmt(st.weekStart)} – ${fmt(weekEnd)}`.toUpperCase(), seasonLabel: `${fmt(st.seasonStart)} – ${fmt(st.seasonEnd)}`.toUpperCase(),
    weekTable: st.weekTable.map(r => ({ animal: r.animal, weekWins: r.weekWins })), table: st.table.map(r => ({ animal: r.animal, wins: r.wins })),
    cta: ['WHO WINS NEXT WEEK?', 'COMMENT YOUR ANIMAL 👇'] };
  const fontDst = path.join(require('os').homedir(), '.fonts'); fs.mkdirSync(fontDst, { recursive: true });
  for (const f of ['LilitaOne-Regular.ttf']) if (!fs.existsSync(path.join(fontDst, f))) { fs.copyFileSync(path.join(ROOT, 'engine2d/fonts', f), path.join(fontDst, f)); try { execFileSync('fc-cache', ['-f']); } catch (e) {} }
  const srv = await serve(), br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await br.newPage({ viewport: { width: 600, height: 1000 } });
  await p.goto(`http://localhost:${srv.address().port}/standings/standings.html`);
  await p.evaluate(async d => { window.DATA = d; await document.fonts.load("60px 'Lilita One'"); await loadImages(d.table.map(r => r.animal)); }, DATA); // eslint-disable-line no-undef
  const dur = await p.evaluate(() => window.DURATION), frames = Math.round(dur * fps), tmp = out + '.video.mp4';
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-preset', 'medium', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < frames; i++) {
    const jpg = await p.evaluate(t => { draw(t); return document.getElementById('cv').toDataURL('image/jpeg', .95); }, i / fps); // eslint-disable-line no-undef
    if (!ff.stdin.write(Buffer.from(jpg.split(',')[1], 'base64'))) await new Promise(z => ff.stdin.once('drain', z));
    if (i % 150 === 149) console.log('frame', i + 1);
  }
  ff.stdin.end(); await new Promise(z => ff.on('close', z)); await br.close(); srv.close();
  const M = path.join(ROOT, 'engine/dist/music');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-i', path.join(M, 'A_main.wav'), '-i', path.join(M, 'B_main.wav'),
    '-filter_complex', `[1:a][2:a]concat=n=2:v=0:a=1,atrim=0:${dur},afade=t=in:d=0.3,afade=t=out:st=${dur - 2}:d=2[a]`, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', out]);
  fs.unlinkSync(tmp);
  const winner = st.leader ? st.leader.animal : null;
  console.log('DONE', out, JSON.stringify({ game: 'standings', theme: 'standings', season: st.season, week: st.weekStart, leader: winner, games: st.games, weekGames: st.weekGames }));
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
