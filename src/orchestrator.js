#!/usr/bin/env node
// ORCHESTRATOR helpers (the orchestration itself is CLAUDE.md, run by Claude):
//   status [days]              registry overview from yesterday to +days
//   plan-today --buffer <file> what today's run must do, from what Buffer really holds for D+1..D+3 (3-day rule)
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

// Production rule (owner, 12/11/2026), looking at what Buffer really holds:
//   D+1 and D+2 complete -> nothing to produce
//   only D+1 complete     -> produce D+2 and D+3
//   only D+2 complete     -> produce D+1 and D+3
//   neither               -> produce D+1, D+2 and D+3 (start-up case)
// "complete" = every video of the day scheduled on both channels in Buffer (3 videos x 2 = 6 posts).
// A partly scheduled day is "not complete": producing it only fills what is missing (every step is idempotent).
function planToday() {
  const t = L.todayParis(), reg = L.loadRegistry(), f = arg('--buffer');
  if (!f) L.die('--buffer <list_posts.json> required: all posts of both channels due from D+1 00:00 to D+3 23:59');
  const posts = postsFrom(L.readJSON(f)).filter(p => !['error', 'draft'].includes(p.status));
  const chans = Object.values(cfg.buffer.channels).map(c => c.id);
  const complete = d => {
    for (const sl of L.daySlots(d)) {
      const id = L.videoId(d, sl.slot), due = new Date(L.dueAtFor(d, sl.time)).getTime();
      for (const ch of chans) {
        const ok = posts.some(p => (p.channelId || (p.channel && p.channel.id)) === ch && p.dueAt && Math.abs(new Date(p.dueAt).getTime() - due) < 60000 && JSON.stringify(p.assets || '').includes(id + '.mp4'));
        if (!ok) return false;
      }
    }
    return true;
  };
  const d1 = L.addDays(t, 1), d2 = L.addDays(t, 2), d3 = L.addDays(t, 3), c1 = complete(d1), c2 = complete(d2);
  let produce = c1 && c2 ? [] : c1 ? [d2, d3] : c2 ? [d1, d3] : [d1, d2, d3];
  produce = produce.filter(d => !complete(d));
  const state = `D+1 ${d1} ${c1 ? 'complete' : 'NOT complete'} | D+2 ${d2} ${c2 ? 'complete' : 'NOT complete'} | D+3 ${d3} ${complete(d3) ? 'complete' : 'not complete'}`;
  L.log(AG, 'plan: ' + state + ' -> produce ' + (produce.join(', ') || 'nothing'));
  console.log(state);
  for (const d of produce) console.log(`PRODUCE ${d}\nPUBLISH ${d}`);
  if (!produce.length) console.log('NOTHING TO PRODUCE');
  console.log(`MONITOR ${d1}`);
  console.log('SYNC (statuses of past posts) + PRUNE + SAVE');
}
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const HEX24 = /^[a-f\d]{24}$/;
function postsFrom(json) {
  const out = []; const walk = o => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(walk);
    if (typeof o.id === 'string' && HEX24.test(o.id) && (o.status || o.dueAt)) out.push(o); for (const k of Object.keys(o)) if (o[k] && typeof o[k] === 'object') walk(o[k]); };
  walk(json); const seen = new Set(); return out.filter(p => !seen.has(p.id) && seen.add(p.id));
}

function ensureMedia() {
  if (fs.existsSync(path.join(MEDIA, '.git'))) return;
  let remote = false; try { git(['ls-remote', '--exit-code', '--heads', 'origin', cfg.media.branch]); remote = true; } catch (e) {}
  if (remote) { git(['fetch', 'origin', `+${cfg.media.branch}:refs/remotes/origin/${cfg.media.branch}`]); git(['worktree', 'add', MEDIA, 'origin/' + cfg.media.branch, '-B', cfg.media.branch]); }
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
  // Non-destructive: removes the published files from the tip of the media branch with a normal commit (no history rewrite).
  if (!cfg.media.pruneAfterPublished) { console.log('prune disabled (config.media.pruneAfterPublished=false): nothing removed'); return; }
  if (cfg.mode === 'test') { console.log('test mode: nothing removed'); return; }
  ensureMedia();
  const reg = L.loadRegistry();
  const gone = Object.values(reg.videos).filter(v => v.publicUrl && v.status === 'published' && fs.existsSync(path.join(MEDIA, v.date, v.id + '.mp4')));
  if (!gone.length) { console.log('nothing to prune'); return; }
  for (const v of gone) git(['rm', '-q', `${v.date}/${v.id}.mp4`], MEDIA);
  git(['commit', '-m', 'remove published videos: ' + gone.map(v => v.id).join(', ')], MEDIA);
  git(['push', 'origin', cfg.media.branch], MEDIA);
  L.withRegistry(r => { for (const v of gone) r.videos[v.id].mediaPruned = L.nowParisISO(); });
  L.log(AG, `media pruned: ${gone.map(v => v.id).join(', ')}`);
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
  console.log(`last 7 days: ${vids.filter(v => v.qc && v.qc.ok).length}/${cfg.videosPerDay * 7} videos validated, ${posts.filter(p => ['scheduled', 'published'].includes(p.status)).length}/${cfg.videosPerDay * 14} posts scheduled or published, winners ${JSON.stringify(winners)}`);
}

const [cmd, a] = process.argv.slice(2);
try {
  if (cmd === 'status') status(+a); else if (cmd === 'plan-today') planToday(); else if (cmd === 'publish-media') publishMedia(a);
  else if (cmd === 'save') save(a); else if (cmd === 'prune-media') pruneMedia(); else if (cmd === 'week') week(); else console.log('usage: see header of src/orchestrator.js');
} catch (e) { L.log(AG, 'FATAL ' + (e.stderr ? e.stderr.toString() : e.message)); process.exit(1); }
