#!/usr/bin/env node
// Agent 3 – DAILY MONITOR
//   check [date] --buffer <list_posts.json>   (date = tomorrow by default)
//   check [date] --simulate-buffer            (test mode: Buffer answer rebuilt from the registry)
// Compares what must happen (registry + config) with what Buffer really holds, writes the daily report and the list of
// actions: SAFE ones (Claude applies them) and ALERTS (sent to the owner, nothing is changed).
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const L = require('./lib');
const AG = 'monitor', cfg = L.config(), CH = ['tiktok', 'youtube'];
const HEX24 = /^[a-f\d]{24}$/;
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
function postsFrom(json) {
  const out = []; const walk = o => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(walk);
    if (typeof o.id === 'string' && (HEX24.test(o.id) || o.simulated) && (o.status || o.dueAt)) out.push(o); for (const k of Object.keys(o)) if (o[k] && typeof o[k] === 'object') walk(o[k]); };
  walk(json); const s = new Set(); return out.filter(p => !s.has(p.id) && s.add(p.id));
}
const chanOf = p => p.channelId || (p.channel && (p.channel.id || p.channel)) || null;
const urls = p => JSON.stringify(p.assets || p.media || '').match(/https?:[^"\\]+/g) || [];
const vidOf = p => { const m = urls(p).join(' ').match(/ZW-\d{8}-\d+/); return m && m[0]; };
const paris = iso => iso ? new Date(iso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) : '?';

function check(date) {
  const reg = L.loadRegistry(), ok = [], issues = [], actions = [];
  let bufferPosts;
  if (process.argv.includes('--simulate-buffer')) {
    if (cfg.mode !== 'test') L.die('--simulate-buffer only in test mode');
    bufferPosts = [];
    for (const v of Object.values(reg.videos)) for (const c of CH) { const f = path.join(L.P.buffer, v.date, `${v.id}.${c}.response.json`); if (fs.existsSync(f)) bufferPosts.push(L.readJSON(f)); }
  } else {
    const f = arg('--buffer'); if (!f) L.die('--buffer <list_posts.json> required (posts of both channels for ' + date + ')');
    bufferPosts = postsFrom(L.readJSON(f));
  }
  const onDay = bufferPosts.filter(p => p.dueAt && new Date(p.dueAt).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' }) === date);

  const slots = L.daySlots(date);
  for (const sl of slots) {
    const s = sl.slot, id = L.videoId(date, s), v = reg.videos[id], time = sl.time;
    if (!v) { issues.push(`${id} (${time}) : vidéo inexistante`); actions.push({ type: 'produce', safe: true, date, why: 'video missing' }); continue; }
    // video availability & validation
    if (!v.qc || !v.qc.ok || !['validated', 'uploaded', 'scheduled', 'published'].includes(v.status)) {
      issues.push(`${id} : non validée (statut ${v.status}${v.lastError ? ', ' + v.lastError : ''})`);
      actions.push(v.status === 'error' || v.status === 'planned' ? { type: 'produce', safe: true, date, why: v.status } : { type: 'alert', msg: `${id} bloquée au statut ${v.status}` });
      continue;
    }
    const file = v.approvedFile && path.join(L.P.root, v.approvedFile);
    if (file && fs.existsSync(file)) {
      const sha = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      if (sha !== v.qc.sha256) { issues.push(`${id} : fichier validé modifié (empreinte différente)`); actions.push({ type: 'alert', msg: `${id} : le fichier ne correspond plus à la version validée` }); continue; }
    }
    if (!v.publicUrl) { issues.push(`${id} : pas encore en ligne`); actions.push({ type: 'upload', safe: true, id }); continue; }
    ok.push(`${id} (${time}, ${v.game === 'hot-potato-3d' ? 'décor ' : ''}${v.plan.theme}) : vidéo validée, ${v.qc.duration} s, ${v.qc.sizeMB} Mo`);

    for (const c of CH) {
      const chanId = cfg.buffer.channels[c].id, p = (v.posts || {})[c] || {};
      const inBuf = onDay.filter(b => (chanOf(b) === chanId || (!chanOf(b) && b.simulated)) && vidOf(b) === id);
      const live = inBuf.filter(b => b.status !== 'error');
      if (live.length > 1) {
        const keep = live.find(b => b.id === p.bufferPostId) || live[0];
        for (const d of live.filter(b => b !== keep)) {
          issues.push(`${id} ${c} : DOUBLON ${d.id}`);
          actions.push(d.status === 'scheduled' ? { type: 'delete_duplicate', safe: true, postId: d.id, keep: keep.id, id, channel: c } : { type: 'alert', msg: `${id} ${c} : doublon ${d.id} au statut ${d.status}` });
        }
      }
      const b = live.find(x => x.id === p.bufferPostId) || live[0];
      if (!b) {
        const err = inBuf.find(x => x.status === 'error');
        if (err) { issues.push(`${id} ${c} : publication en erreur chez Buffer (${JSON.stringify(err.error || '').slice(0, 120)})`); actions.push({ type: 'reschedule', safe: true, id, channel: c, failedPostId: err.id }); }
        else if (p.bufferPostId && p.status === 'published') ok.push(`${id} ${c} : déjà publiée`);
        else { issues.push(`${id} ${c} : publication MANQUANTE`); actions.push(p.bufferPostId ? { type: 'reschedule', safe: true, id, channel: c, confirmedMissing: true, note: `registry says ${p.bufferPostId} but Buffer does not have it: check with get_post first` } : { type: 'schedule', safe: true, id, channel: c }); }
        continue;
      }
      if (b.id !== p.bufferPostId) { issues.push(`${id} ${c} : post ${b.id} présent dans Buffer mais absent du registre`); actions.push({ type: 'record', safe: true, id, channel: c, postId: b.id }); }
      const due = L.dueAtFor(date, time);
      if (Math.abs(new Date(b.dueAt) - new Date(due)) > 60000) { issues.push(`${id} ${c} : mauvaise heure (${paris(b.dueAt)} au lieu de ${paris(due)})`); actions.push({ type: 'alert', msg: `${id} ${c} programmée à ${paris(b.dueAt)} au lieu de ${time} : à corriger à la main ou à confirmer` }); continue; }
      if (!['scheduled', 'sending', 'sent'].includes(b.status)) { issues.push(`${id} ${c} : statut Buffer ${b.status}`); actions.push({ type: 'alert', msg: `${id} ${c} au statut ${b.status} dans Buffer` }); continue; }
      ok.push(`${id} ${c} : programmée ${paris(b.dueAt)} — post ${b.id}${b.simulated ? ' (simulé)' : ''}`);
    }
  }
  // posts of that day that belong to no known video
  for (const b of onDay) if (!vidOf(b) || !reg.videos[vidOf(b)]) issues.push(`post inconnu ${b.id} (${b.status}, ${paris(b.dueAt)}) : non créé par le système, laissé tel quel`);

  const expected = slots.length * CH.length, good = ok.filter(x => /programmée|déjà publiée/.test(x)).length;
  const verdict = good === expected && !issues.length ? 'OK' : actions.some(a => !a.safe) ? 'ALERTE' : 'À CORRIGER';
  const now = L.todayParis(), stamp = L.nowParisISO();
  const md = [`# Rapport Zoo Wars du ${now} — contrôle du ${date}`, '', `Mode : **${cfg.mode}**. Verdict : **${verdict}** (${good}/${expected} publications confirmées).`, '',
    '## Conforme', ...ok.map(x => '- ' + x), '', '## Problèmes', ...(issues.length ? issues.map(x => '- ' + x) : ['- aucun']), '',
    '## Actions', ...(actions.length ? actions.map(a => `- ${a.safe ? 'correction sûre' : 'ALERTE'} : ${a.type} ${a.id || ''} ${a.channel || ''} ${a.msg || a.why || a.postId || ''}`) : ['- aucune']), '',
    `Généré le ${stamp}.`].join('\n');
  const base = path.join(L.P.reports, `${now}_check-${date}`);
  fs.writeFileSync(base + '.md', md + '\n'); L.writeJSON(base + '.json', { date, mode: cfg.mode, verdict, confirmed: good, expected, ok, issues, actions, at: stamp });
  L.log(AG, `check ${date}: ${verdict} (${good}/${expected})`, { issues: issues.length, actions: actions.length });
  console.log(md); console.log('MONITOR_ACTIONS ' + JSON.stringify(actions));
  return verdict;
}

const [cmd, d] = process.argv.slice(2);
if (cmd === 'check') { const date = d && /^\d{4}-\d\d-\d\d$/.test(d) ? d : L.addDays(L.todayParis(), 1); check(date); }
else console.log('usage: monitor.js check [YYYY-MM-DD] --buffer <file> | --simulate-buffer');
