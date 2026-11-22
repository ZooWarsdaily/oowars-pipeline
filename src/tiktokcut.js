// Zoo Wars – TikTok-only cut (test T3, validated by the owner on 22/11/2026).
// The TikTok copy of a game video starts config.buffer.channels.tiktok.trimStartSec seconds later, so it opens
// on the action ("RUN!" in 3D, "GO!" in 2D) instead of the static line-up. Post-production only: the game,
// its render and the validated file are untouched; YouTube keeps the validated file.
// The cut gets its own quality control; a cut that fails it is never published (payload refuses it).
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { execFileSync } = require('child_process');
const L = require('./lib');

const AG = 'tiktokcut';
const cutName = id => id + '-tt.mp4';
// seconds to cut for this video, or 0 when the test does not apply (standings video, key absent)
function trimFor(cfg, v) {
  const s = +(cfg.buffer.channels.tiktok.trimStartSec || 0);
  if (!s || v.game === 'standings') return 0;
  const from = cfg.buffer.channels.tiktok.trimFrom;
  if (from && v.date < from) return 0;
  return s;
}

function check(cfg, f, v) {
  const Q = cfg.qc, problems = []; let pr = {};
  try { pr = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', f]).toString()); } catch (e) { problems.push('ffprobe cannot read the cut'); }
  const vs = (pr.streams || []).find(s => s.codec_type === 'video'), as = (pr.streams || []).find(s => s.codec_type === 'audio');
  const dur = +(pr.format && pr.format.duration || 0), size = fs.existsSync(f) ? fs.statSync(f).size : 0;
  const fps = vs ? eval(vs.avg_frame_rate) : 0;
  if (!vs) problems.push('no video stream'); else {
    if (vs.width !== Q.width || vs.height !== Q.height) problems.push(`resolution ${vs.width}x${vs.height}`);
    if (vs.codec_name !== Q.videoCodec) problems.push('video codec ' + vs.codec_name);
    if (vs.pix_fmt !== 'yuv420p') problems.push('pixel format ' + vs.pix_fmt);
    if (fps < Q.minFps || fps > Q.maxFps) problems.push('fps ' + fps);
  }
  if (!as) problems.push('no audio stream'); else if (as.codec_name !== Q.audioCodec) problems.push('audio codec ' + as.codec_name);
  if (dur < Q.minDuration || dur > Q.maxDuration) problems.push('duration ' + dur.toFixed(1) + ' s');
  const expected = v.qc.duration - trimFor(cfg, v);
  if (Math.abs(dur - expected) > 0.5) problems.push(`duration ${dur.toFixed(2)} s, expected ${expected.toFixed(2)} s`);
  if (size > Q.maxSizeMB * 1048576) problems.push('size ' + (size / 1048576).toFixed(1) + ' MB');
  try { const e = execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-f', 'null', '-'], { stdio: ['ignore', 'pipe', 'pipe'] }).toString(); if (e.trim()) problems.push('decode errors: ' + e.slice(0, 200)); }
  catch (e) { problems.push('decode failed: ' + String(e.stderr || e).slice(0, 200)); }
  const sha = fs.existsSync(f) ? crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') : '';
  return { at: L.nowParisISO(), ok: !problems.length, problems, trimStartSec: trimFor(cfg, v), duration: +dur.toFixed(2), sizeMB: +(size / 1048576).toFixed(2), sha256: sha };
}

// builds approved/<date>/<id>-tt.mp4 from the validated file (idempotent) and records its QC in the registry
function make(id) {
  const cfg = L.config(), v = L.loadRegistry().videos[id]; if (!v) L.die('unknown ' + id);
  const s = trimFor(cfg, v); if (!s) return null;
  if (!v.qc || !v.qc.ok || !v.approvedFile) L.die(`${id}: not validated, no TikTok cut`);
  const src = path.join(L.P.root, v.approvedFile), out = path.join(path.dirname(src), cutName(id));
  if (v.tiktokCut && v.tiktokCut.qc && v.tiktokCut.qc.ok && fs.existsSync(out)) return v.tiktokCut;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(s), '-i', src, '-map', '0:v:0', '-map', '0:a:0',
    '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '10M', '-maxrate', '12M', '-bufsize', '24M', '-pix_fmt', 'yuv420p', '-r', '30',
    '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', out], { stdio: ['ignore', 'pipe', 'pipe'] });
  const qc = check(cfg, out, v);
  const cut = { file: path.relative(L.P.root, out), experiment: cfg.buffer.channels.tiktok.trimExperiment || null, qc };
  L.withRegistry(r => { r.videos[id].tiktokCut = cut; });
  L.log(AG, `${id}: TikTok cut -${s}s ${qc.ok ? 'ok' : 'QC FAILED'}`, qc.problems);
  return cut;
}

module.exports = { make, trimFor, cutName };
if (require.main === module) { const c = make(process.argv[2]); console.log(JSON.stringify(c, null, 1)); }
