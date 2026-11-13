// Zoo Wars – candidate animals (3D models only, for approval). Same Mesh API and proportions as figure() in the game:
// torso at y≈.62, head centred at y≈1.38 (scaled by hs), eyes and mouths come from faces(), arms and feet are separate meshes.
// Loaded AFTER the game in the preview page only; the game itself is unchanged.
/* global Mesh, M4, PRIM, gl, TAU, faces */
const CAND = {
  elephant: { n: 'ELEPHANT', nick: 'THE WALL', c: '#a9c4d6', size: 1.22, rig: { hs: 1.14, ax: .74, ay: 1.0, fx: .34, iris: '#4a5a6a', brow: '#4f6272' } },
  penguin: { n: 'PENGUIN', nick: 'THE SLIDER', c: '#7fd0ff', size: .92, rig: { hs: 1.08, ax: .52, ay: .98, fx: .2, iris: '#2a3a5a', brow: '#11161e' } },
  kangaroo: { n: 'KANGAROO', nick: 'THE HOPPER', c: '#f0a868', size: 1.1, rig: { hs: 1.04, ax: .5, ay: 1.02, fx: .26, iris: '#6a3a14', brow: '#5a2e10' } },
  turtle: { n: 'TURTLE', nick: 'THE SHELL', c: '#d9b06a', size: .94, rig: { hs: 1.06, ax: .66, ay: .96, fx: .32, iris: '#2f6a1e', brow: '#2c4a1c' } },
  crocodile: { n: 'CROCODILE', nick: 'THE AMBUSHER', c: '#5fbf5a', size: 1.06, rig: { hs: 1.0, ax: .6, ay: 1.0, fx: .3, iris: '#e8c81a', brow: '#1f4a1a' } },
  frog: { n: 'FROG', nick: 'THE TONGUE', c: '#b8f05a', size: .88, rig: { hs: 1.16, ax: .56, ay: .96, fx: .3, iris: '#d8a010', brow: '#2c6a1c' } },
  rabbit: { n: 'RABBIT', nick: 'THE ZIGZAG', c: '#ffd6e6', size: .9, rig: { hs: 1.1, ax: .5, ay: 1.0, fx: .22, iris: '#c0306a', brow: '#9a8a84' } },
};
function candidateFigure(k) {
  const R = CAND[k].rig, m = new Mesh(), h = new Mesh(), arm = new Mesh(), foot = new Mesh(), PI = Math.PI;
  h.pre = M4.mulN(M4.T(0, 1, 0), M4.S(R.hs), M4.T(0, -1, 0));
  const blush = () => { for (const s of [-1, 1]) h.s('sphere', s * .37, 1.31, .37, .1, .065, .04, '#ff9aa8', .08); };
  const nose = (y, z, rx, ry, c) => h.s('sphere', 0, y, z, rx, ry, rx * .7, c || '#1b1414').s('sphere', -rx * .3, y + ry * .35, z + rx * .5, rx * .25, ry * .25, .012, '#ffffff', .5);
  const chain = (mesh, pts, c) => { for (const [x, y, z, r] of pts) mesh.s('sphere', x, y, z, r, r, r, c); };
  if (k === 'elephant') { const B = '#93abbd', L = '#c4d4df', P = '#f2a9b6', N = '#24407a';
    m.s('sphere', 0, .64, 0, .7, .64, .6, B).s('sphere', 0, .55, .26, .48, .44, .38, L);
    chain(m, [[0, .5, -.6, .09], [0, .42, -.72, .07]], B); m.s('sphere', 0, .36, -.8, .08, .1, .08, '#4f6272');
    h.s('sphere', 0, 1.38, .02, .62, .54, .54, B);
    for (const s of [-1, 1]) { h.s('sphere', s * .72, 1.42, -.06, .42, .46, .1, B, 0, M4.RY(s * .5)).s('sphere', s * .74, 1.42, -.02, .3, .34, .06, P, 0, M4.RY(s * .5));
      h.add(PRIM.cone, M4.mulN(M4.T(s * .2, 1.06, .5), M4.RX(1.9), M4.RZ(s * .3), M4.S(.06, .26, .06)), '#fff8e8'); }
    chain(h, [[0, 1.3, .5, .19], [0, 1.18, .62, .16], [0, 1.04, .7, .14], [0, .92, .74, .12], [0, .84, .78, .11], [0, .8, .86, .1], [0, .82, .94, .095]], B);
    h.s('sphere', 0, .86, 1.0, .09, .06, .05, '#7d93a4');
    h.s('cyl', 0, 1.86, -.02, .44, .14, .42, N).s('cyl', 0, 1.94, -.02, .4, .05, .38, '#ffffff').s('box', 0, 1.8, .38, .3, .04, .18, N, 0, M4.RX(.15)).s('sphere', 0, 1.88, .38, .06, .06, .03, '#f2c21a', .3);
    blush(); arm.s('sphere', 0, -.28, 0, .2, .34, .21, B).s('cyl', 0, -.58, 0, .18, .1, .19, L); foot.s('cyl', 0, -.02, .04, .26, .16, .28, B).s('sphere', 0, .0, .26, .2, .08, .06, L);
  } else if (k === 'penguin') { const B = '#1f2733', W = '#f7f8fa', O = '#ff9a1e', R2 = '#e0303c';
    m.s('sphere', 0, .62, 0, .56, .64, .5, B).s('sphere', 0, .56, .2, .44, .54, .36, W);
    m.s('cyl', 0, .98, .02, .46, .14, .44, R2).s('box', -.24, .74, .44, .14, .4, .06, R2, 0, M4.RZ(.12));
    for (let i = 0; i < 3; i++) m.s('box', -.25 + i * .02, .6 - i * .1, .47, .15, .02, .02, '#ffffff');
    h.s('sphere', 0, 1.38, .02, .56, .5, .5, B);
    for (const s of [-1, 1]) h.s('sphere', s * .2, 1.42, .3, .24, .26, .2, W);
    h.s('sphere', 0, 1.24, .38, .2, .14, .18, W);
    h.add(PRIM.cone, M4.mulN(M4.T(0, 1.3, .52), M4.RX(PI / 2), M4.S(.12, .3, .08)), O);
    h.s('sphere', 0, 1.7, .32, .16, .05, .06, '#ffd23f', .1);
    arm.s('sphere', 0, -.28, 0, .1, .36, .2, B, 0, M4.RZ(.15)); foot.s('sphere', 0, 0, .12, .2, .07, .3, O);
  } else if (k === 'kangaroo') { const B = '#c8834a', L = '#f1d2a8', D = '#8a5226', G = '#e0303c';
    m.s('sphere', 0, .64, 0, .5, .64, .46, B).s('sphere', 0, .52, .2, .36, .44, .32, L).s('sphere', 0, .42, .4, .24, .16, .06, D);
    chain(m, [[0, .38, -.5, .2], [0, .26, -.72, .18], [0, .16, -.94, .16], [0, .09, -1.14, .13], [0, .06, -1.3, .1]], B);
    h.s('sphere', 0, 1.38, .0, .5, .5, .46, B);
    for (const s of [-1, 1]) h.s('cone', s * .24, 1.8, -.06, .14, .62, .09, B, 0, M4.RZ(-s * .12)).s('cone', s * .24, 1.8, .0, .08, .44, .04, '#f2b8b0', 0, M4.RZ(-s * .12));
    h.s('sphere', 0, 1.24, .4, .28, .22, .32, L); nose(1.32, .7, .08, .06); blush();
    arm.s('sphere', 0, -.24, 0, .12, .28, .13, B).s('sphere', 0, -.52, .04, .19, .19, .2, G).s('cyl', 0, -.38, .02, .15, .06, .15, '#ffffff');
    foot.s('sphere', 0, 0, .18, .17, .12, .42, D);
  } else if (k === 'turtle') { const B = '#b5cf7a', S = '#8a5e2e', S2 = '#b07a3e', RIM = '#e2c27a', Y = '#f2e2a4';
    m.s('sphere', 0, .58, -.3, .78, .72, .62, S);
    for (const [x, y, z] of [[0, 1.18, -.38], [-.44, .98, -.5], [.44, .98, -.5], [-.58, .58, -.42], [.58, .58, -.42], [0, .9, -.82], [-.3, .5, -.86], [.3, .5, -.86]]) m.s('sphere', x, y, z, .22, .2, .14, S2);
    m.s('cyl', 0, .5, -.22, .82, .08, .66, RIM);
    m.s('sphere', 0, .56, .1, .5, .56, .42, B).s('sphere', 0, .54, .3, .4, .46, .28, Y);
    for (let i = 0; i < 3; i++) m.s('box', 0, .36 + i * .2, .56, .3, .015, .04, '#c8a85a');
    h.s('sphere', 0, 1.38, .1, .5, .47, .47, B).s('sphere', 0, 1.22, .44, .26, .16, .2, '#cfe39a');
    nose(1.3, .68, .05, .035, '#3f5a1c'); blush();
    h.s('sphere', 0, 1.78, .08, .4, .2, .38, '#2d6fd8').s('cyl', 0, 1.97, .08, .03, .1, .03, '#f2c21a');
    for (const s of [-1, 1]) h.s('sphere', s * .18, 2.04, .08, .2, .03, .06, s < 0 ? '#ff5a3c' : '#ffd23f', 0, M4.RY(.6));
    arm.s('sphere', 0, -.26, 0, .16, .3, .17, B).s('sphere', 0, -.52, 0, .15, .11, .16, '#cfe39a'); foot.s('cyl', 0, -.02, .06, .22, .14, .26, B);
  } else if (k === 'crocodile') { const B = '#3f7a3a', L = '#d8e6a8', D = '#24502a', T = '#ffffff';
    m.s('sphere', 0, .6, 0, .56, .6, .5, B).s('sphere', 0, .54, .22, .38, .46, .32, L);
    for (let i = 0; i < 4; i++) m.add(PRIM.cone, M4.mulN(M4.T(0, 1.0 - i * .02, -.3 - i * .14), M4.S(.07, .16, .07)), D);
    for (const [y, z, r] of [[.4, -.56, .26], [.3, -.82, .22], [.22, -1.06, .18], [.16, -1.28, .14], [.12, -1.46, .1]]) m.s('sphere', 0, y, z, r, r, r, B);
    for (let i = 0; i < 4; i++) m.add(PRIM.cone, M4.mulN(M4.T(0, .56 - i * .09, -.6 - i * .24), M4.S(.06, .14, .06)), D);
    h.s('sphere', 0, 1.42, -.04, .54, .5, .46, B);
    for (const s of [-1, 1]) h.s('sphere', s * .24, 1.74, .18, .17, .14, .16, B);
    h.s('sphere', 0, 1.2, .5, .36, .2, .5, B, 0, M4.RX(.35)).s('sphere', 0, 1.02, .52, .34, .1, .44, L, 0, M4.RX(.35));
    h.s('sphere', 0, 1.0, .9, .26, .14, .14, B);
    for (const s of [-1, 1]) h.s('sphere', s * .09, 1.09, 1.0, .04, .03, .03, '#1b1414');
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) h.add(PRIM.cone, M4.mulN(M4.T(s * (.31 - i * .035), 1.06 - i * .015, .32 + i * .11), M4.RX(PI), M4.S(.035, .09, .035)), T);
    h.s('box', 0, 1.98, .02, .5, .09, .06, '#141414', 0, M4.RX(-.6)).s('sphere', -.14, 1.98, .06, .13, .09, .03, '#ff8a1e', .2, M4.RX(-.6)).s('sphere', .14, 1.98, .06, .13, .09, .03, '#ff8a1e', .2, M4.RX(-.6));
    arm.s('sphere', 0, -.26, 0, .16, .3, .17, B).s('sphere', 0, -.52, 0, .15, .1, .16, D); foot.s('sphere', 0, 0, .12, .22, .12, .34, D);
  } else if (k === 'frog') { const B = '#86e03a', L = '#fff3a0', D = '#4aa82a', P = '#ff7ab0';
    m.s('sphere', 0, .56, 0, .62, .56, .54, B).s('sphere', 0, .5, .24, .46, .44, .34, L);
    for (const [x, y, z] of [[-.4, .8, -.3], [.3, .6, -.42], [-.1, 1.0, -.36], [.44, .9, -.1]]) m.s('sphere', x, y, z, .12, .1, .06, '#ff9a2a');
    h.s('sphere', 0, 1.32, .04, .66, .44, .52, B);
    for (const s of [-1, 1]) h.s('sphere', s * .22, 1.58, .22, .24, .24, .22, B);
    h.s('sphere', 0, 1.16, .38, .4, .12, .22, L);
    h.s('cyl', .08, 1.92, .0, .4, .03, .4, '#3f9a3a').s('sphere', .26, 1.98, .1, .1, .08, .1, P).s('sphere', .26, 2.02, .1, .05, .05, .05, '#ffd23f', .2);
    arm.s('sphere', 0, -.26, 0, .14, .3, .15, B).s('sphere', 0, -.52, .04, .16, .07, .18, D); foot.s('sphere', 0, 0, .16, .26, .08, .36, D);
  } else if (k === 'rabbit') { const B = '#ece6df', L = '#ffffff', P = '#ff9ab6', O = '#ff6a2a';
    m.s('sphere', 0, .62, 0, .5, .6, .46, B).s('sphere', 0, .54, .2, .34, .42, .3, L).s('sphere', 0, .48, -.52, .2, .2, .2, L);
    h.s('sphere', 0, 1.38, .04, .56, .5, .5, B);
    for (const s of [-1, 1]) h.s('sphere', s * .2, 2.1, -.04, .13, .5, .09, B, 0, M4.RZ(-s * .14)).s('sphere', s * .2, 2.1, .02, .07, .38, .05, P, 0, M4.RZ(-s * .14));
    h.s('sphere', 0, 1.24, .42, .26, .18, .2, L); nose(1.33, .62, .07, .05, P);
    for (const s of [-1, 1]) h.s('box', s * .04, 1.08, .58, .07, .1, .03, '#ffffff');
    blush();
    arm.s('sphere', 0, -.26, 0, .13, .3, .14, B).s('sphere', 0, -.5, 0, .13, .11, .14, L);
    foot.s('sphere', 0, .0, .12, .2, .13, .34, O).s('sphere', 0, -.07, .12, .21, .05, .35, '#ffffff').s('box', 0, .05, .2, .14, .02, .1, '#ffffff');
  }
  return { body: m.build(gl), head: h.build(gl), foot: foot.build(gl), arm: arm.build(gl), rig: R, face: faces(R, h.pre) };
}
// preview only: put the candidates in place of 7 animals (the panda stays, to compare sizes)
window.useCandidates = (map) => {
  for (const [slot, k] of Object.entries(map)) {
    FIG[slot] = candidateFigure(k); SPEC[slot] = Object.assign({}, SPEC[slot], { n: CAND[k].n, c: CAND[k].c, nick: CAND[k].nick }); SIZE[slot] = CAND[k].size;
  }
};
