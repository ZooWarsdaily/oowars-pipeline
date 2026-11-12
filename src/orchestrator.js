#!/usr/bin/env node
// ORCHESTRATOR helpers (the orchestration itself is CLAUDE.md, run by Claude):
//   status [days]              registry overview from yesterday to +days
//   plan-today                 what today's run must do (dates to produce / schedule / check), in order
//   publish-media <id>         copy the validated MP4 to the public "media" branch, push, print the public URL
//   save "<message>"           commit registry, fiches, payloads, reports and logs on main and push
//   week                       weekly summary (14 videos / 28 posts target)
'use strict';
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const L = require('./lib');
const cfg = L.config(), AG = 'orchestrator';
const git = (args, cwd) => execFileSync('git', args, { cwd: cwd || L.P.root, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
const MEDIA = path.join(L.P.root, 'media');

function status(days) {
  const reg = L.loadRegistry(), from = L.addDays(L.todayParis(), -1), to = L.addDays(L.todayParis(), +days || 3);
  const rows = Object.values(reg.videos).filter(v => v.date >= from && v.date <= to).sort((a, b) => a.id < b.id ? -1 : 1);
  console.log(`mode=${cfg.mode}  today=${L.todayParis()}`);
  for (const v of rows) console.log([v.id, v.time, v.status.padEnd(9), v.plan.theme.padEnd(7), 'tiktok:' + ((v.posts || {}).tiktok || {}).status, 'youtube:' + ((v.posts || {}).youtube || {}).status, v.lastError || ''].join('  '));
  if (!rows.length) console.log('(no video in this window)');
}

function planToday() {
  const t = L.todayParis(), reg = L.loadRegistry(), steps = [];
  for (let k = 1; k <= cfg.produceDaysAhead; k++) {
    const d = L.addDays(t, k);
    const ids = Array.from({ length: cfg.videosPerDay }, (_, i) => L.videoId(d, i + 1));
    const st = ids.map(id => (reg.videos[id] || {}).status || 'missing');
    if (st.some(s => ['missing', 'planned', 'produced', 'error'].includes(s))) steps.push(`PRODUCE ${d}  (${ids.map((id, i) => id + '=' + st[i]).join(', ')})`);
    if (st.some(s => ['validated', 'uploaded'].includes(s)) || st.some(s => ['missing', 'planned', 'produced', 'error'].includes(s))) steps.push(`PUBLISH ${d}`);
  }
  steps.push(`MONITOR ${L.addDays(t, 1)}`);
  steps.push('SYNC (statuses of past posts) + SAVE');
  console.log(steps.join('\n'));
}

function ensureMedia() {
  if (fs.existsSync(path.join(MEDIA, '.git'))) return;
  let remote = false; try { git(['ls-remote', '--exit-code', '--heads', 'origin', cfg.media.branch]); remote = true; } catch (e) {}
  if (remote) { git(['fetch', 'origin', cfg.media.branch]); git(['worktree', 'add', MEDIA, 'origin/' + cfg.media.branch, '-B', cfg.media.branch]); }
  else { git(['worktree', 'add', '--orphan', '-b', cfg.media.branch, MEDIA]); fs.writeFileSync(path.join(MEDIA, 'README.md'), 'Public video files of Zoo Wars (used by Buffer).\n'); git(['add', '.'], MEDIA); git(['commit', '-m', 'media branch'], MEDIA); }
}
function publishMedia(id) {
  const reg = L.loadRegistry(), v = reg.videos[id]; if (!v) L.die('unknown ' + id);
  if (!v.qc || !v.qc.ok || !['validated', 'uploaded'].includes(v.status)) L.die(`${id} is ${v.status}: only validated videos go online`);
  const rel = `${v.date}/${id}.mp4`, url = cfg.media.rawUrlTemplate.replace('{owner}', cfg.media.githubOwner).replace('{repo}', cfg.media.repo).replace('{branch}', cfg.media.branch).replace('{path}', rel);
  if (cfg.mode === 'test') { console.log('MEDIA_URL ' + url.replace('{owner}', 'OWNER')); L.log(AG, `${id}: media push skipped (test mode)`); return; }
  if (!cfg.media.githubOwner) L.die('config.media.githubOwner is empty');
  ensureMedia();
  const dest = path.join(MEDIA, rel); fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(L.P.root, v.approvedFile), dest);
  git(['add', rel], MEDIA);
  try { git(['commit', '-m', 'video ' + id], MEDIA); } catch (e) { /* already committed */ }
  git(['push', 'origin', cfg.media.branch], MEDIA);
  L.log(AG, `${id}: pushed to media branch`); console.log('MEDIA_URL ' + url);
}

// Keep the public media branch small: rebuild it with only the videos not yet published on both channels.
// Runs ONLY if the owner allowed it (config.media.pruneAfterPublished = true). The fiche and registry stay on main.
function pruneMedia() {
  if (!cfg.media.pruneAfterPublished) { console.log('prune disabled (config.media.pruneAfterPublished=false): nothing removed'); return; }
  if (cfg.mode === 'test') { console.log('test mode: nothing removed'); return; }
  ensureMedia();
  const reg = L.loadRegistry(), keep = Object.values(reg.videos).filter(v => v.publicUrl && v.status !== 'published');
  const gone = Object.values(reg.videos).filter(v => v.publicUrl && v.status === 'published' && fs.existsSync(path.join(MEDIA, v.date, v.id + '.mp4')));
  if (!gone.length) { console.log('nothing to prune'); return; }
  const tmp = MEDIA + '-new'; try { git(['worktree', 'remove', '--force', tmp]); } catch (e) {}
  try { git(['branch', '-D', 'media-new']); } catch (e) {}
  git(['worktree', 'add', '--orphan', '-b', 'media-new', tmp]);
  fs.writeFileSync(path.join(tmp, 'README.md'), 'Public video files of Zoo Wars (used by Buffer).\n');
  for (const v of keep) { const rel = `${v.date}/${v.id}.mp4`; fs.mkdirSync(path.join(tmp, v.date), { recursive: true }); fs.copyFileSync(path.join(MEDIA, rel), path.join(tmp, rel)); }
  git(['add', '.'], tmp); git(['commit', '-m', 'media: pending videos only'], tmp);
  git(['push', '--force', 'origin', 'media-new:' + cfg.media.branch], tmp);
  L.withRegistry(r => { for (const v of gone) { r.videos[v.id].mediaPruned = L.nowParisISO(); } });
  L.log(AG, `media pruned: ${gone.map(v => v.id).join(', ')} removed, ${keep.length} kept`);
  git(['worktree', 'remove', '--force', MEDIA]); git(['worktree', 'remove', '--force', tmp]); git(['branch', '-D', 'media-new']);
}

function save(msg) {
  git(['add', '-A', 'data', 'reports', 'buffer', 'approved', 'config', 'archives']);
  try { git(['commit', '-m', msg || 'zoo wars run ' + L.nowParisISO()]); } catch (e) { console.log('nothing to commit'); }
  if (cfg.mode !== 'test') git(['push', 'origin', 'HEAD']);
  console.log('saved');
}

function week() {
  const reg = L.loadRegistry(), t = L.todayParis(), days = Array.from({ length: 7 }, (_, i) => L.addDays(t, i - 6));
  const vids = Object.values(reg.videos).filter(v => days.includes(v.date));
  const posts = vids.flatMap(v => Object.values(v.posts || {}));
  const winners = {}; for (const v of vids) winners[v.plan.winner] = (winners[v.plan.winner] || 0) + 1;
  console.log(`last 7 days: ${vids.filter(v => v.qc && v.qc.ok).length}/14 videos validated, ${posts.filter(p => ['scheduled', 'published'].includes(p.status)).length}/28 posts scheduled or published, winners ${JSON.stringify(winners)}`);
}

const [cmd, a] = process.argv.slice(2);
try {
  if (cmd === 'status') status(+a); else if (cmd === 'plan-today') planToday(); else if (cmd === 'publish-media') publishMedia(a);
  else if (cmd === 'save') save(a); else if (cmd === 'prune-media') pruneMedia(); else if (cmd === 'week') week(); else console.log('usage: see header of src/orchestrator.js');
} catch (e) { L.log(AG, 'FATAL ' + (e.stderr ? e.stderr.toString() : e.message)); process.exit(1); }
