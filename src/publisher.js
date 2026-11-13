#!/usr/bin/env node
// Agent 2 – SOCIAL MEDIA PUBLISHER
// The Buffer calls themselves are made by Claude with the official Buffer MCP connector; this script prepares
// every request, refuses anything unsafe, and records only what Buffer really returned.
//   captions <id>                         write TikTok + YouTube captions (distinct, never repeated, winner never named)
//   uploaded <id> <publicUrl>             after the MP4 is pushed: checks the public URL serves the exact file -> uploaded
//   payload <id> <tiktok|youtube> --existing <list_posts.json>
//                                         prints the exact create_post arguments, or refuses (duplicate, not validated…)
//   record <id> <channel> <create_post_response.json>   checks Buffer's answer and stores the post id -> scheduled
//   record <id> <channel> --simulate      (test mode only) fake Buffer answer
//   sync <list_posts.json>                update post statuses from Buffer (sent -> published, error -> error)
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { execFileSync } = require('child_process');
const L = require('./lib'), C = require('./captions');
const AG = 'publisher', cfg = L.config();
const CHANNELS = ['tiktok', 'youtube'];
const HEX24 = /^[a-f\d]{24}$/;

function bufDir(date) { const d = path.join(L.P.buffer, date); fs.mkdirSync(d, { recursive: true }); return d; }
function arg(name) { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; }
// Buffer tool results may be wrapped ({result:…}, [{…}], or text with JSON inside): extract the post objects
function postsFrom(json) {
  const out = [];
  const walk = o => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(walk);
    if (typeof o.id === 'string' && HEX24.test(o.id) && (o.status || o.dueAt || o.channelId || o.channel)) out.push(o);
    for (const k of Object.keys(o)) if (o[k] && typeof o[k] === 'object') walk(o[k]); };
  walk(json); const seen = new Set(); return out.filter(p => !seen.has(p.id) && seen.add(p.id));
}
const chanOf = p => p.channelId || (p.channel && (p.channel.id || p.channel)) || null;
const videoUrlsOf = p => JSON.stringify(p.assets || p.media || '').match(/https?:[^"\\]+/g) || [];

function captions(id) {
  return L.withRegistry(reg => {
    const v = reg.videos[id]; if (!v) L.die('unknown ' + id);
    if (v.captions) return v.captions;
    if (!['validated', 'uploaded'].includes(v.status)) L.die(`${id} is ${v.status}: captions only for validated videos`);
    const c = C.make(v, cfg, reg.captionsUsed);
    // standings line (Hot Potato 3D only), added after the winner check: it names the season leader, never this video's winner
    if (v.game === cfg.production.game) {
      const line = require('./standings').captionLine(v);
      if (line) for (const k of ['tiktok', 'youtube']) c[k].text = c[k].text.replace(/\n\n(#[^\n]*)$/, `\n${line}\n\n$1`);
    }
    v.captions = { tiktok: c.tiktok, youtube: c.youtube, at: L.nowParisISO() };
    reg.captionsUsed = (reg.captionsUsed || []).concat(c.signatures).slice(-90); // recent history only
    L.writeJSON(path.join(bufDir(v.date), id + '.captions.json'), v.captions);
    L.log(AG, `${id}: captions written`);
    return v.captions;
  });
}

function uploaded(id, url) {
  const v = L.loadRegistry().videos[id]; if (!v) L.die('unknown ' + id);
  if (v.status !== 'validated' && !(v.status === 'uploaded' && v.publicUrl === url)) L.die(`${id} is ${v.status}, expected validated`);
  if (!url.includes(id + '.mp4')) L.die('the URL must end with the video file name ' + id + '.mp4');
  let check = 'simulated (test mode)';
  if (cfg.mode !== 'test') {
    // download the public file and compare its fingerprint with the validated one
    // 1) try to download the public URL and compare sha256 with the validated file
    const tmp = path.join(require('os').tmpdir(), id + '.check.mp4');
    let viaHttp = false;
    try { execFileSync('curl', ['-sS', '-L', '--fail', '-m', '300', '-o', tmp, url], { stdio: ['ignore', 'pipe', 'pipe'] }); viaHttp = true; } catch (e) { /* the cloud workspace cannot always reach raw.githubusercontent.com */ }
    if (viaHttp) {
      const sha = crypto.createHash('sha256').update(fs.readFileSync(tmp)).digest('hex'); fs.unlinkSync(tmp);
      if (sha !== v.qc.sha256) L.die('public file differs from the validated file (sha256)');
      check = 'http sha256 ok';
    } else {
      // 2) otherwise prove GitHub holds exactly these bytes on the public branch: git blob id of the remote file = blob id of the validated file
      const media = path.join(L.P.root, 'media'), rel = url.split('/' + cfg.media.branch + '/')[1];
      if (!fs.existsSync(path.join(media, '.git')) || !rel) L.die('cannot verify: public URL unreachable from here and no media worktree');
      execFileSync('git', ['fetch', '-q', 'origin', `+${cfg.media.branch}:refs/remotes/origin/${cfg.media.branch}`], { cwd: media });
      let remote; try { remote = execFileSync('git', ['rev-parse', `origin/${cfg.media.branch}:${rel}`], { cwd: media }).toString().trim(); } catch (e) { L.die('file not found on the public branch: ' + rel); }
      const local = execFileSync('git', ['hash-object', path.join(L.P.root, v.approvedFile)]).toString().trim();
      if (remote !== local) L.die('file on GitHub differs from the validated file');
      if (!url.startsWith(`https://raw.githubusercontent.com/${cfg.media.githubOwner}/${cfg.media.repo}/${cfg.media.branch}/`)) L.die('URL does not match the configured public repository');
      check = 'git blob ok (' + local.slice(0, 10) + ')';
    }
  }
  L.withRegistry(r => { const x = r.videos[id]; x.publicUrl = url; x.uploadCheck = check; if (x.status === 'validated') L.setVideoStatus(r, id, 'uploaded', check); });
  L.log(AG, `${id}: uploaded (${check}) ${url}`);
}

function payload(id, ch) {
  if (!CHANNELS.includes(ch)) L.die('channel must be tiktok or youtube');
  const reg = L.loadRegistry(), v = reg.videos[id]; if (!v) L.die('unknown ' + id);
  // --- safety gates ---
  if (!v.qc || !v.qc.ok) L.die(`${id}: no passed quality control -> never published`);
  if (!['uploaded', 'scheduled'].includes(v.status)) L.die(`${id} is ${v.status}: only uploaded videos can be scheduled`);
  if (!v.publicUrl) L.die(`${id}: no public URL`);
  if (!v.captions) L.die(`${id}: run captions first`);
  const post = (v.posts || {})[ch];
  if (post && post.bufferPostId) L.die(`DUPLICATE BLOCKED: ${id} already has ${ch} post ${post.bufferPostId} (${post.status})`);
  const chan = cfg.buffer.channels[ch], dueAt = L.dueAtFor(v.date, v.time);
  if (new Date(dueAt) <= new Date(Date.now() + 15 * 60000)) L.die(`${id}: ${dueAt} is too close or in the past`);
  if (cfg.mode !== 'test') {
    const ex = arg('--existing'); if (!ex) L.die('--existing <list_posts.json> is required: list the channel posts in Buffer first');
    const posts = postsFrom(L.readJSON(ex));
    // a post in error was never published: it does not block a new attempt (the monitor reports it)
    const same = posts.filter(p => p.status !== 'error' && (!chanOf(p) || chanOf(p) === chan.id) && videoUrlsOf(p).some(u => u.includes(id + '.mp4')));
    if (same.length) {
      L.withRegistry(r => { r.videos[id].posts = r.videos[id].posts || {}; r.videos[id].posts[ch] = { ...(r.videos[id].posts[ch] || {}), status: 'needs_review', foundInBuffer: same.map(p => p.id) }; });
      L.die(`DUPLICATE BLOCKED: Buffer already holds ${same.map(p => p.id + '/' + p.status).join(', ')} for ${id} on ${ch}. Run record with that post instead of creating a new one.`);
    }
    // second key: our slot on this channel already taken by a live post (Buffer may replace the asset URL once sent)
    const due0 = new Date(dueAt).getTime();
    const slot = posts.filter(p => p.status !== 'error' && p.status !== 'draft' && chanOf(p) === chan.id && p.dueAt && Math.abs(new Date(p.dueAt).getTime() - due0) < 60000);
    if (slot.length) L.die(`DUPLICATE BLOCKED: ${ch} slot ${dueAt} already holds ${slot.map(p => p.id + '/' + p.status).join(', ')}. Check it, then run record with that post if it is this video.`);
    const queued = posts.filter(p => (!chanOf(p) || chanOf(p) === chan.id) && ['scheduled', 'needs_approval', 'sending'].includes(p.status)).length;
    if (queued >= cfg.buffer.maxQueuedPerChannel) L.die(`${ch}: Buffer queue full (${queued}/${cfg.buffer.maxQueuedPerChannel}, free plan)`);
  }
  const c = v.captions[ch];
  const req = {
    channelId: chan.id, schedulingType: 'automatic', mode: 'customScheduled', dueAt, text: c.text,
    assets: [{ video: { url: v.publicUrl, metadata: ch === 'tiktok' ? { thumbnailOffset: 3000 } : {} } }],
    metadata: ch === 'youtube'
      ? { youtube: { title: c.title, categoryId: chan.categoryId, madeForKids: chan.madeForKids, privacy: chan.privacy, notifySubscribers: true } }
      : {},
  };
  if (cfg.mode === 'draft') { req.saveToDraft = true; delete req.mode; delete req.dueAt; }
  const f = path.join(bufDir(v.date), `${id}.${ch}.payload.json`); L.writeJSON(f, req);
  L.withRegistry(r => { const x = r.videos[id]; x.posts = x.posts || {}; x.posts[ch] = { status: 'prepared', dueAt, payload: path.relative(L.P.root, f), mode: cfg.mode, at: L.nowParisISO() }; });
  L.log(AG, `${id}: ${ch} payload ready (${cfg.mode})`);
  console.log(`MODE=${cfg.mode}${cfg.mode === 'test' ? '  -> DO NOT call Buffer; run: record ' + id + ' ' + ch + ' --simulate' : '  -> call Buffer create_post with exactly this JSON, save the answer to a file, then run record'}`);
  console.log('CREATE_POST_ARGS ' + JSON.stringify(req));
}

function record(id, ch, src) {
  const reg = L.loadRegistry(), v = reg.videos[id]; if (!v) L.die('unknown ' + id);
  const chan = cfg.buffer.channels[ch], expDue = L.dueAtFor(v.date, v.time);
  let resp;
  if (src === '--simulate') {
    if (cfg.mode !== 'test') L.die('--simulate is only allowed in test mode');
    resp = { id: 'f'.repeat(8) + crypto.createHash('md5').update(id + ch).digest('hex').slice(0, 16), status: 'scheduled', dueAt: expDue, channelId: chan.id, assets: [{ video: { url: v.publicUrl } }], simulated: true };
    L.writeJSON(path.join(bufDir(v.date), `${id}.${ch}.response.json`), resp);
  } else {
    const all = postsFrom(L.readJSON(src));
    resp = all.find(p => videoUrlsOf(p).some(u => u.includes(id + '.mp4'))) || all[0];
    fs.copyFileSync(src, path.join(bufDir(v.date), `${id}.${ch}.response.json`));
  }
  // --- verify what Buffer really answered ---
  const problems = [];
  if (!resp || !HEX24.test(resp.id || '')) problems.push('no Buffer post id in the answer');
  if (resp && chanOf(resp) && chanOf(resp) !== chan.id) problems.push('wrong channel ' + chanOf(resp));
  const okStatus = cfg.mode === 'draft' ? ['draft'] : ['scheduled', 'sending', 'sent'];
  if (resp && !okStatus.includes(resp.status)) problems.push('status ' + (resp && resp.status));
  if (resp && cfg.mode !== 'draft' && resp.dueAt && Math.abs(new Date(resp.dueAt) - new Date(expDue)) > 60000) problems.push(`dueAt ${resp.dueAt} differs from ${expDue}`);
  if (resp && resp.error) problems.push('Buffer error: ' + JSON.stringify(resp.error).slice(0, 200));
  L.withRegistry(r => {
    const x = r.videos[id]; x.posts = x.posts || {};
    const p = x.posts[ch] = { ...(x.posts[ch] || {}), bufferPostId: resp && resp.id, bufferStatus: resp && resp.status, dueAt: (resp && resp.dueAt) || expDue, recordedAt: L.nowParisISO(), simulated: !!(resp && resp.simulated) };
    if (problems.length) { p.status = resp && HEX24.test(resp.id || '') ? 'needs_review' : 'error'; p.problems = problems; }
    else p.status = cfg.mode === 'draft' ? 'draft' : 'scheduled';
    const both = CHANNELS.every(c => x.posts[c] && x.posts[c].status === 'scheduled');
    if (both && x.status === 'uploaded') L.setVideoStatus(r, id, 'scheduled', 'tiktok ' + x.posts.tiktok.bufferPostId + ' / youtube ' + x.posts.youtube.bufferPostId);
  });
  if (problems.length) { L.log(AG, `${id}: ${ch} NOT confirmed`, problems); process.exit(2); }
  L.log(AG, `${id}: ${ch} confirmed by Buffer, post ${resp.id} (${resp.status})`);
}

function sync(src) {
  const posts = postsFrom(L.readJSON(src)), byId = new Map(posts.map(p => [p.id, p]));
  L.withRegistry(r => {
    for (const x of Object.values(r.videos)) for (const ch of CHANNELS) {
      const p = x.posts && x.posts[ch]; if (!p || !p.bufferPostId || !byId.has(p.bufferPostId)) continue;
      const b = byId.get(p.bufferPostId); p.bufferStatus = b.status; p.syncedAt = L.nowParisISO();
      if (b.status === 'sent' && p.status !== 'published') { p.status = 'published'; p.sentAt = b.sentAt || null; L.log(AG, `${x.id}: ${ch} published`); }
      if (b.status === 'error') { p.status = 'error'; p.problems = [JSON.stringify(b.error || 'Buffer error').slice(0, 300)]; }
      if (CHANNELS.every(c => x.posts[c] && x.posts[c].status === 'published') && x.status === 'scheduled') L.setVideoStatus(r, x.id, 'published', 'both channels sent');
    }
  });
}

// a post that Buffer reported in error (never published) can be prepared again; its old id is kept in history
function resetPost(id, ch) {
  L.withRegistry(r => {
    const x = r.videos[id], p = x && x.posts && x.posts[ch];
    if (!p || !(['error', 'prepared', 'needs_review'].includes(p.status) || process.argv.includes('--confirmed-missing'))) L.die(`${id} ${ch}: only a post in error, prepared, needs_review, or confirmed missing from Buffer (--confirmed-missing) can be reset (now ${p && p.status})`);
    x.postHistory = (x.postHistory || []).concat({ ch, ...p, resetAt: L.nowParisISO() }); delete x.posts[ch];
    if (['error', 'scheduled'].includes(x.status) && x.qc && x.qc.ok && x.publicUrl) { x.status = 'uploaded'; x.history.push({ at: L.nowParisISO(), to: 'uploaded', note: 'post reset' }); }
  });
  L.log(AG, `${id}: ${ch} post reset`);
}

const [cmd, a1, a2, a3] = process.argv.slice(2);
try {
  if (cmd === 'captions') console.log(JSON.stringify(captions(a1), null, 2));
  else if (cmd === 'uploaded') uploaded(a1, a2);
  else if (cmd === 'payload') payload(a1, a2);
  else if (cmd === 'record') record(a1, a2, a3);
  else if (cmd === 'sync') sync(a1);
  else if (cmd === 'reset-post') resetPost(a1, a2);
  else console.log('usage: see header of src/publisher.js');
} catch (e) { L.log(AG, 'FATAL ' + e.message); process.exit(1); }
