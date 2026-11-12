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

function pick(arr, rnd) { return arr[Math.floor(rnd() * arr.length)]; }
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function make(video, cfg, used) {
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
  for (const s of [tiktok.text, youtube.title, youtube.text]) if (video.plan.winner && new RegExp('\\b' + video.plan.winner + '\\b', 'i').test(s)) throw new Error('caption reveals the winner');
  return { tiktok, youtube, signatures: [tt.sig, 'tth|' + tt.h, 'ttq|' + tt.q, yt.sig, 'ytt|' + yt.t, 'yte|' + yt.e] };
}
module.exports = { make };
