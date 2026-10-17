import * as THREE from 'three';
import * as F from '../furniture.js';
import { R_IN, faceIn, polar } from '../config.js';

// Third level: the parlour, where the keeper sits of an evening. Open fire on the west-south-west wall, the sofa
// and two armchairs drawn up round it on a braided rug, a harmonium, a grandfather clock and a wall of books.
// Stairwell opening 266..1, low treads 25..95, corridor 352..25: all bare. The nook (95..128) holds a low bookcase.
export function buildParlour(X) {
  const { ctx, B, g, env, rnd, M, audio, toWorld, A, faceTo } = X;
  const r = env.room(2), y = r.y, W = R_IN - 0.015;
  r.curtains(M.tartan);

  // ---- the fireplace, with a mirror above and the mantel dressed
  const fa = 198, fr = env.wallR(1.7, 0.5);
  r.wall(fa, 1.7, 0.5, 2.7, () => {
    F.fireplace(B, M, M.plasterFloor[2], 1.7, 0.5, 2.7);
    B.push(0.0, 1.82, 0.17); F.mirror(B, M, 0.62, 0.84); B.pop();
    // the mantel shelf's free strip runs in front of the chimney breast (z 0.15..0.33)
    B.push(0.05, 1.18, 0.24); F.shipModel(B, M); B.pop();
    B.cbox(0.2, 0.26, 0.1, M.woodDark, -0.42, 1.31, 0.24, 0, 0, 0, 0.5, null, 0.01);        // a little clock
    B.add(new THREE.CircleGeometry(0.08, 18), M.clockFace, -0.42, 1.33, 0.292);
  }, { name: 'fireplace' });
  for (const sx of [-0.68, 0.68]) { const p = toWorld(fa, fr, y + 1.18, sx, 0, 0.24); F.candle(ctx, B, p.x, p.y, p.z, 2.2); }
  if (X.NIGHT.matches === 'mantel') { const p = toWorld(fa, fr, y + 1.175, 0.42, 0, 0.25); X.pickup('matches', p.x, p.y, p.z, faceIn(A(fa)) + 0.25, 'Take the box of matches from the mantelpiece'); }
  {
    // the fire itself: logs are in the prop; flames and embers glow, a lamp throws firelight, and it crackles
    const fire = F.fireFlames(0.62, 0.6);
    const fp = toWorld(fa, fr, y + 0.14, 0, 0, 0.02);
    fire.group.position.copy(fp); fire.group.rotation.y = faceIn(A(fa)); g.add(fire.group);
    const embers = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.22), M.ember); embers.rotation.x = -Math.PI / 2; embers.position.copy(toWorld(fa, fr, y + 0.12, 0, 0, 0.0)); embers.rotation.z = faceIn(A(fa)); g.add(embers);
    ctx.onUpdate((dt, t) => { fire.mat.uniforms.uTime.value = t; });
    const lp = toWorld(fa, fr, y + 0.55, 0, 0, 0.5);
    X.addLamp(ctx, lp.x, lp.y, lp.z, { color: 0xff8a3a, base: 11, dist: 11, flicker: 0.32 });
    const hp = toWorld(fa, fr, y + 0.3, 0, 0, 0.3);
    audio.addLoop('hearth', hp.x, hp.y, hp.z, 0.05, 0.5, (pan) => {
      audio.burst({ type: 'bandpass', f: 1300 + Math.random() * 3200, q: 2, a: 0.001, d: 0.02 + Math.random() * 0.04, g: 0.1 + Math.random() * 0.2, dest: pan });
      if (Math.random() < 0.1) audio.burst({ buf: audio.brown, type: 'lowpass', f: 320, a: 0.15, d: 0.7, g: 0.25, dest: pan });
    });
  }
  // either side of the fire: a tall bookcase and a curio cabinet
  r.wall(176, 0.8, 0.34, 2.0, () => F.bookcase(B, M, 0.8, 1.95, rnd, 6), { name: 'bookcase by the fire' });
  r.wall(221, 0.8, 0.45, 1.5, () => { F.chestOfDrawers(B, M, 0.8, 0.45, 0.9, M.woodDark); B.push(0, 0.9, 0); F.teapot(B, M, M.ceramicBlue); B.pop(); B.push(0.24, 0.9, 0.0); B.cyl(0.04, 0.035, 0.12, M.glassBottle, 0, 0.06, 0, 8); B.pop(); }, { name: 'sideboard' });
  r.at(221, W, 1.7, () => F.painting(B, M, 0.55, 0.42, M.painting));

  // ---- the harmonium, the window seat and the rocking chair
  r.wall(140, 1.04, 0.54, 1.3, () => F.harmonium(B, M), { name: 'harmonium' });
  { const [x, , z] = X.atWall(140, 2.75, 0); r.round(x, z, 0.2, 0.5, () => F.stool(B, M, 0.5), { name: 'harmonium stool', nocheck: true }); }
  r.at(140, W, 1.95, () => F.painting(B, M, 0.5, 0.65, M.portrait));
  r.wall(160, 1.15, 0.45, 0.5, () => {
    B.cbox(1.1, 0.42, 0.42, M.paintWhite, 0, 0.21, 0, 0, 0, 0, 0.7, null, 0.01);
    F.cushion(B, M, 0x7a3a2a, 0, 0.46, 0, 1.0, 0.4); F.cushion(B, M, 0x2f4a5a, -0.34, 0.55, -0.1, 0.32, 0.26, -0.4); F.cushion(B, M, 0xc8a050, 0.34, 0.54, -0.1, 0.3, 0.26, -0.4);
  }, { name: 'window seat' });
  r.sill(0, () => F.plant(B, M, 0.3));
  { const [x, , z, ry] = X.atWall(237, 3.35, 0); r.free(x, z, ry, 0.58, 0.9, 1.0, () => F.rockingChair(B, M), { name: 'rocking chair' }); }
  r.sill(1, () => F.plant(B, M, 0.28, false), 0.2);

  // ---- the grandfather clock, and a low bookcase in the under-stair nook
  r.wall(255, 0.5, 0.3, 2.1, () => F.grandfatherClock(B, M), { name: 'grandfather clock' });
  r.wall(112, 1.0, 0.34, 1.7, () => F.bookcase(B, M, 1.0, 1.65, rnd, 5), { name: 'nook bookcase' });

  // ---- the sitting group round the hearth: rug, low table, sofa, armchairs, side tables
  const u = { x: Math.cos(A(fa)), z: Math.sin(A(fa)) }, v = { x: -u.z, z: u.x };
  const at = (s, l) => ({ x: u.x * s + v.x * l, z: u.z * s + v.z * l });
  const rug = at(1.8, 0);
  r.flat(rug.x, rug.z, 0, () => F.rugRound(B, M.ragRug, 0, 0, 0, 1.75));
  r.round(rug.x, rug.z, 0.45, 0.45, () => { B.cbox(0.95, 0.04, 0.5, M.woodDark, 0, 0.42, 0, 0, 0, 0, 0.8, null, 0.008); for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.cyl(0.02, 0.026, 0.4, M.woodDark, sx * 0.4, 0.2, sz * 0.2, 8); B.push(0, 0.44, 0); F.teaTray(B, M); B.pop(); }, { name: 'coffee table', ry: -Math.atan2(u.z, u.x) + Math.PI / 2 });
  const sofaP = at(0.55, 0), sofaRy = Math.atan2(u.x, u.z);
  r.free(sofaP.x, sofaP.z, sofaRy, 1.9, 0.9, 0.9, () => F.sofa(B, M, 1.9, 0x5a2a28), { name: 'sofa', nocheck: true });
  for (const l of [1.45, -1.45]) {
    const p = at(1.9, l);
    r.free(p.x, p.z, faceTo(p.x, p.z, rug.x, rug.z), 0.85, 0.8, 1.0, () => F.armchair(B, M, l > 0 ? 0x2a4a3a : 0x6a3a22), { name: 'armchair' });
  }
  for (const l of [1.4, -1.4]) {
    const p = at(0.55, l);
    r.round(p.x, p.z, 0.22, 0.56, () => F.sideTable(B, M), { name: 'side table', nocheck: true });
    if (l > 0) F.tableLamp(ctx, B, p.x, y + 0.56, p.z, 3.6); else { B.push(p.x, y + 0.56, p.z); F.bookPile(B, M, 4, rnd); B.pop(); F.candle(ctx, B, p.x + 0.0, y + 0.56 + 0.06, p.z + 0.1, 1.8); }
  }
  { const p = at(1.5, 2.1); r.round(p.x, p.z, 0.2, 0.3, () => F.footstool(B, M, 0x2f4a5a), { name: 'footstool', nocheck: true }); }
  // a throw over the sofa arm
  B.push(sofaP.x, y, sofaP.z, sofaRy); B.cbox(0.4, 0.05, 0.6, M.tartan, 0.82, 0.62, 0.0, 0, 0, -0.4, 0.5, null, 0.015); B.pop();

  r.at(130, W, 1.9, () => F.painting(B, M, 0.6, 0.45, M.chart));
}
