// Caption writer for Zoo Wars (English). Never names the winner. Distinct texts for TikTok and YouTube,
// and a hook/question pair is never reused while it is in the recent history.
'use strict';
const THEME = {
  volcano: ['on a floating volcano', 'over the lava', 'above a boiling volcano', 'with lava bubbling below'],
  ice: ['on the frozen arena', 'on slippery ice', 'in the ice arena', 'on a frozen lake'],
  jungle: ['deep in the jungle', 'in the jungle arena', 'between the jungle trees', 'on the jungle stage'],
  space: ['in outer space', 'floating in space', 'on a space platform', 'among the stars'],
};
const TT_HOOK = [
  '8 animals. 1 bomb. Only one survives 💣', 'Nobody wants to hold the bomb 😅', 'The fuse is burning… who gets caught? 🔥',
  'Hot potato, but the potato explodes 💥', 'Pass it or blow up 💣', 'This bomb changed hands way too fast 😳',
  'Last one standing wins 🏆', 'Run. Tag. Pass. Boom. 💥', 'Wait for the final duel 👀', 'Who will be the last animal standing? 🐾',
  'That last-second pass though 😱', 'The bomb never stays still for long 💣', 'One bomb, eight animals, zero chill 🔥',
  'Pick your animal before the bomb drops 👇', 'The chase is real 🏃💨', 'Zoo Wars: Hot Potato edition 💣',
  'This final was way too close 😤', 'Don\'t blink at the end 👀', 'Every second counts ⏱️', 'Chaos in the arena 🌀',
];
const TT_QUESTION = [
  'Who did you pick? 👇', 'Did your animal survive? 👇', 'Which animal are you rooting for next time?', 'Call your winner in the comments 👇',
  'Who deserved to win?', 'Comment your animal before the end 👀', 'Who was the sneakiest player?', 'Rate this final from 1 to 10 👇',
  'Which animal should get a rematch?', 'Did you guess the winner?',
];
const YT_TITLE = [
  '8 Animals, 1 Bomb – Who Survives?', 'Animal Hot Potato Battle – Last One Standing Wins', 'Who Gets Caught With the Bomb?',
  'Pass the Bomb or Explode! Animal Battle', 'Hot Potato Survival: Which Animal Wins?', 'The Bomb Keeps Moving… Who Survives?',
  'Last Animal Standing – Hot Potato Battle', 'Insane Final Duel in Animal Hot Potato', 'Zoo Wars: Hot Potato Showdown',
  'Can Your Animal Survive the Bomb?', 'Animal Bomb Chase – Pick Your Fighter', 'One Bomb, Eight Animals, One Winner',
];
const YT_DESC = [
  'Eight animals run around a floating arena {theme}. Whoever holds the bomb must tag someone else before the fuse runs out.',
  'A new Zoo Wars hot potato battle {theme}: tag, dodge and survive until only one animal is left.',
  'The bomb drops, the chase begins {theme}. Seven explosions, one survivor.',
  'Pick your animal at the start and see if it survives the hot potato battle {theme}.',
  'Zoo Wars simulation {theme}: the bomb carrier has to catch someone before it explodes.',
  'Who can dodge the bomb the longest? Animal hot potato battle {theme}.',
];
const YT_END = ['Who did you pick? Tell us in the comments!', 'Comment your animal for the next battle!', 'Did your pick make it to the final duel?', 'New Zoo Wars battle every day.'];

// 2D arena games (Territory War / Color War)
const G2 = {
  terr: {
    name: 'Territory War', tag: '#territorywar',
    hooks: ['Who will own the map? 🎨', '6 animals, 1 map, only 1 survivor 🎨', 'Paint the map or get wiped out 🖌️', 'Last place is out every 12 seconds ⏱️', 'The map keeps shrinking… 😳', 'Every tile counts 🟩', 'Biggest territory wins 🗺️', 'Watch the map change hands 👀'],
    titles: ['Who Will Own the Map? Animal Territory War', 'Territory War: Last Animal Standing', '6 Animals Fight for the Map', 'Animal Territory Battle – Pick Your Fighter', 'Paint the Map! Animal Territory War', 'Which Animal Conquers the Map?'],
    desc: ['Six animals paint the map. Every 12 seconds, the smallest territory is out.', 'A Zoo Wars territory battle: grab tiles, survive the cuts, own the map.', 'Power-ups, freezes and paint bombs: who will control the whole map?'],
  },
  color: {
    name: 'Color War', tag: '#colorwar',
    hooks: ['Which color takes over the board? 🟥🟦🟩', 'Every hit steals a tile 🟥', 'Only one color survives 🎨', 'The board is a battlefield 🟦', 'Six colors, one winner 🏆', 'Bounce, steal, survive 🔵', 'Last place is out every 12 seconds ⏱️', 'Watch the colors fight 👀'],
    titles: ['Color War: Which Color Takes the Board?', 'Six Colors, One Winner – Animal Color War', 'Every Hit Steals a Tile! Color War', 'Animal Color Battle – Pick Your Color', 'Which Animal Paints the Whole Board?', 'Color War: Last Color Standing'],
    desc: ['Six animals bounce across the board and steal tiles from each other. Every 12 seconds, last place is out.', 'A Zoo Wars color battle: every hit steals a tile, only one color survives.', 'Bounce, steal and survive: which color will take over the whole board?'],
  },
  hot: {
    name: 'Hot Potato', tag: '#hotpotato',
    hooks: ["Don't get caught holding the bomb 💣", 'Pass it or BOOM 💣', 'The bomb is looking for a new owner 😅', 'Run! The bomb is coming 🏃💨', 'Six animals, one bomb 💥', 'Who survives the last explosion? 💣', 'Tag, run, explode 💥', 'Nobody wants this bomb 😬'],
    titles: ['Pass the Bomb! Animal Hot Potato', 'Who Survives the Last Explosion?', 'Animal Hot Potato – Run From the Bomb', 'Six Animals, One Bomb', "Don't Get Caught Holding the Bomb!", 'Hot Potato Chase – Pick Your Animal'],
    desc: ['Six animals run from the bomb. The carrier has to tag someone before the fuse runs out.', 'A Zoo Wars hot potato chase: tag, run, and pray the bomb is not in your hands at zero.', 'The bomb keeps changing hands until only one animal is left standing.'],
  },
};
const END2D = ['Who did you pick? Tell us in the comments!', 'Comment your animal for the next battle!', 'Did your pick survive the cuts?', 'New Zoo Wars battle every day.'];
function make2d(video, cfg, used, rnd) {
  const g = G2[video.plan.theme], usedSet = new Set(used || []), recent = new Set((used || []).slice(-20)), base = cfg.captions.hashtags.filter(t => t !== '#hotpotato' && t !== g.tag);
  let h, q, t, d, e;
  for (let i = 0; i < 400; i++) { h = pick(g.hooks, rnd); q = pick(TT_QUESTION, rnd); if (!recent.has('2h|' + h) && !recent.has('ttq|' + q)) break; }
  for (let i = 0; i < 400; i++) { t = pick(g.titles, rnd); d = pick(g.desc, rnd); e = pick(END2D, rnd); if (!recent.has('2t|' + t) && !recent.has('yte|' + e)) break; }
  const rest = base.slice(1).sort(() => rnd() - .5);
  const tiktok = { text: `${h}\n\n${q}\n\n${[base[0], g.tag, ...rest.slice(0, cfg.captions.tiktokHashtagCount - 2)].join(' ')}` };
  const youtube = { title: t.slice(0, 100), text: `${d}\n${e}\n\n${['#shorts', base[0], g.tag, ...rest.slice(0, cfg.captions.youtubeHashtagCount - 2)].join(' ')}` };
  const w = video.selection && video.selection.metrics && video.selection.metrics.winner;
  for (const s of [tiktok.text, youtube.title, youtube.text]) if (w && new RegExp('\\b' + w + '\\b', 'i').test(s)) throw new Error('caption reveals the winner');
  void usedSet; return { tiktok, youtube, signatures: ['2h|' + h, 'ttq|' + q, '2t|' + t, 'yte|' + e] };
}

// the other 3D games (added 14/11/2026): same structure as the 2D captions, plus the decor line
const G3 = {
  'musical-chairs-3d': {
    name: 'Musical Chairs', tag: '#musicalchairs', line: 'Musical chairs',
    hooks: ['When the music stops… RUN 🎵', '8 animals, 7 cushions 🪑', 'One cushion too few 😬', 'Wait for the STOP 🛑', 'Musical chairs, animal edition 🎶', 'Who gets left standing? 👀', 'The last cushion is a war zone 😤', 'Dance… dance… STOP! 🎵', 'Every round, one animal is out 🎶', 'Zoo Wars: musical chairs edition 🪑'],
    titles: ['Animal Musical Chairs – Who Gets Left Standing?', '8 Animals, 7 Cushions – Musical Chairs Battle', 'When the Music Stops… Animal Musical Chairs', 'Musical Chairs: Last Animal Sitting Wins', 'Zoo Wars: Musical Chairs Showdown', 'One Cushion Too Few! Animal Battle', 'Animal Musical Chairs – Pick Your Fighter'],
    desc: ['Eight animals dance around the cushions {theme}. When the music stops, the one left standing is out.', 'A Zoo Wars musical chairs battle {theme}: one cushion too few every round, one winner at the end.', 'Dance, wait for the stop, grab a cushion {theme}. Seven rounds, one animal left sitting.'],
  },
  'infection-3d': {
    name: 'Infection', tag: '#infection', line: 'Infection chase',
    hooks: ['One touch and you turn green 🟢', 'Run from the pack 🏃💨', 'The pack keeps growing 😱', 'Last one clean wins 🏆', "Don't let them touch you 🟢", '1 infected… then 2… then 7 😳', 'Zoo Wars: infection edition 🟢', 'Who stays clean the longest? 👀', 'The final escape is insane 😤', 'Everyone is turning green 🟢'],
    titles: ['Animal Infection – Last One Clean Wins', 'One Touch and You Turn Green!', 'Run From the Pack – Animal Infection Battle', 'Who Stays Clean the Longest?', 'Zoo Wars: Infection Showdown', '7 Against 1 – Animal Infection Chase', 'Animal Infection – Pick Your Survivor'],
    desc: ['One animal is infected {theme}. Every animal it touches turns green and joins the pack. The last clean animal wins.', 'A Zoo Wars infection chase {theme}: the pack grows with every catch until only one animal is left clean.', 'Run, dodge and hide {theme}: who will be the last animal standing against the green pack?'],
  },
};
function make3(video, cfg, used, rnd) {
  const g = G3[video.game], recent = new Set((used || []).slice(-20)), base = cfg.captions.hashtags.filter(t => t !== '#hotpotato' && t !== g.tag), thLine = pick(THEME[video.plan.theme] || [''], rnd);
  let h, q, t, d, e;
  for (let i = 0; i < 400; i++) { h = pick(g.hooks, rnd); q = pick(TT_QUESTION, rnd); if (!recent.has('3h|' + h) && !recent.has('ttq|' + q)) break; }
  for (let i = 0; i < 400; i++) { t = pick(g.titles, rnd); d = pick(g.desc, rnd); e = pick(YT_END, rnd); if (!recent.has('3t|' + t) && !recent.has('yte|' + e)) break; }
  const rest = base.slice(1).sort(() => rnd() - .5);
  const tiktok = { text: `${h}\n${g.line} ${thLine}.\n\n${q}\n\n${[base[0], g.tag, ...rest.slice(0, cfg.captions.tiktokHashtagCount - 2)].join(' ')}` };
  const youtube = { title: t.slice(0, 100), text: `${d.replace('{theme}', thLine)}\n${e}\n\n${['#shorts', base[0], g.tag, ...rest.slice(0, cfg.captions.youtubeHashtagCount - 2)].join(' ')}` };
  const w = video.plan.winner || (video.selection && video.selection.metrics && video.selection.metrics.winner);
  for (const s of [tiktok.text, youtube.title, youtube.text]) if (w && new RegExp('\\b' + w + '\\b', 'i').test(s)) throw new Error('caption reveals the winner');
  return { tiktok, youtube, signatures: ['3h|' + h, 'ttq|' + q, '3t|' + t, 'yte|' + e] };
}

function pick(arr, rnd) { return arr[Math.floor(rnd() * arr.length)]; }
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function makeStandings(video, cfg) {
  const i = (video.render && video.render.info) || {}, lead = i.leader ? i.leader.charAt(0).toUpperCase() + i.leader.slice(1) : null;
  const top = lead ? `${lead} leads Season ${i.season}! 👑` : `Season ${i.season} standings 🏆`;
  const tags = ['#zoowars', '#animalbattle', '#leaderboard', '#whowouldwin', '#simulation'];
  return {
    tiktok: { text: `${top}\nThis week's wins and the full season ranking.\n\nWho wins next week? Comment your animal 👇\n\n${tags.join(' ')}` },
    youtube: { title: `Zoo Wars Season ${i.season} Standings${lead ? ' – ' + lead + ' on Top!' : ''}`.slice(0, 100), text: `Weekly Zoo Wars standings: every win of the week (Hot Potato, Musical Chairs, Infection) and the season ranking.\nWho wins next week? Comment your animal!\n\n#shorts #zoowars #animalbattle #leaderboard` },
    signatures: [],
  };
}
function make(video, cfg, used) {
  if (video.game === 'standings') return makeStandings(video, cfg);
  if (video.game === 'arena2d') return make2d(video, cfg, used, rng(video.selection ? video.selection.seed : Date.now()));
  if (G3[video.game]) return make3(video, cfg, used, rng(video.selection ? video.selection.seed : Date.now()));
  const usedSet = new Set(used || []), recent = new Set((used || []).slice(-20)), rnd = rng(video.selection ? video.selection.seed : Date.now());
  const theme = video.plan.theme, tags = cfg.captions.hashtags;
  let tt, yt;
  for (let i = 0; i < 400; i++) {
    const h = pick(TT_HOOK, rnd), q = pick(TT_QUESTION, rnd), sig = 'tt|' + h + '|' + q;
    if (!usedSet.has(sig) && !usedSet.has('tth|' + h) && !recent.has('ttq|' + q)) { tt = { h, q, sig }; break; }
  }
  if (!tt) { const h = pick(TT_HOOK, rnd), q = pick(TT_QUESTION, rnd); tt = { h, q, sig: 'tt|' + h + '|' + q }; }
  for (let i = 0; i < 400; i++) {
    const t = pick(YT_TITLE, rnd), d = pick(YT_DESC, rnd), e = pick(YT_END, rnd), sig = 'yt|' + t + '|' + d;
    if (!usedSet.has(sig) && !usedSet.has('ytt|' + t) && !recent.has('yte|' + e)) { yt = { t, d, e, sig }; break; }
  }
  if (!yt) { const t = pick(YT_TITLE, rnd), d = pick(YT_DESC, rnd), e = pick(YT_END, rnd); yt = { t, d, e, sig: 'yt|' + t + '|' + d }; }
  const thLine = pick(THEME[theme] || [''], rnd);
  // hashtags: #zoowars always first, the rest rotated
  const rest = tags.slice(1).sort(() => rnd() - .5);
  const ttTags = [tags[0], ...rest.slice(0, cfg.captions.tiktokHashtagCount - 1)].join(' ');
  const ytTags = ['#shorts', tags[0], ...rest.slice(0, cfg.captions.youtubeHashtagCount - 1)].join(' ');
  const tiktok = { text: `${tt.h}\nHot potato battle ${thLine}.\n\n${tt.q}\n\n${ttTags}` };
  const youtube = { title: yt.t.slice(0, 100), text: `${yt.d.replace('{theme}', thLine)}\n${yt.e}\n\n${ytTags}` };
  // safety: never reveal the winner
  const w3 = video.plan.winner || (video.selection && video.selection.metrics && video.selection.metrics.winner);
  for (const s of [tiktok.text, youtube.title, youtube.text]) if (w3 && new RegExp('\\b' + w3 + '\\b', 'i').test(s)) throw new Error('caption reveals the winner');
  return { tiktok, youtube, signatures: [tt.sig, 'tth|' + tt.h, 'ttq|' + tt.q, yt.sig, 'ytt|' + yt.t, 'yte|' + yt.e] };
}
module.exports = { make };
