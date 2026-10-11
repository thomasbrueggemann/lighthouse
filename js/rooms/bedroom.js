import * as THREE from 'three';
import * as F from '../furniture.js';
import { R_IN, faceIn, polar } from '../config.js';
import { boxGeo, lathe } from '../geom.js';

// Fourth level: the keeper's bedroom, with the casement that has torn loose in the gale (296 degrees). Stairwell opening
// 42..137, low treads 161..231, corridor 128..161. The bed lies radially against the north-east wall with a bedside
// table on each side; the wardrobe, rocking chair and sea chest fill the rest, and a bucket sits under the leak.
export function buildBedroom(X) {
  const { ctx, B, g, env, rnd, S, T, M, col, game, audio, interact, group, toWorld, A, faceTo, atWall } = X;
  const r = env.room(3), y = r.y, W = R_IN - 0.015;
  r.curtains(M.ticking);

  // ---- the bed, its bedside tables and the chest at its foot
  const bedA = 335;
  const bed = r.wall(bedA, 1.25, 2.05, 0.8, () => F.bedstead(B, M), { name: 'bed' });
  r.at(bedA, W, 1.5, () => F.painting(B, M, 0.62, 0.46, M.painting));
  for (const [a, side] of [[318, -1], [352, 1]]) {
    const t = r.wall(a, 0.5, 0.4, 0.62, () => {
      F.table(B, M, 0.5, 0.4, 0.6, M.woodDark); B.cbox(0.38, 0.12, 0.34, M.woodDark, 0, 0.45, 0, 0, 0, 0, 0.6, null, 0.006);
      if (side > 0) { B.push(-0.1, 0.6, 0); F.bookPile(B, M, 3, rnd); B.pop(); B.push(0.12, 0.6, 0.02); B.add(lathe([[0.001, 0], [0.05, 0], [0.065, 0.06], [0.04, 0.16], [0.045, 0.2], [0.001, 0.2]], 12), M.ceramicBlue); B.pop(); }
    }, { name: 'bedside table' });
    if (side < 0) { const p = toWorld(a, t.r, y + 0.6, 0.05, 0, 0.0); F.candle(ctx, B, p.x, p.y, p.z, 2.8); }
  }
  { const [x, , z, ry] = atWall(bedA, 1.5, 0); r.free(x, z, ry, 0.85, 0.5, 0.5, () => F.trunk(B, M, 0.85, true), { name: 'sea chest' }); }
  r.flat(...(() => { const [x, , z] = atWall(318, 2.3, 0); return [x, z, 0]; })(), () => F.rugRound(B, M.ragRug2, 0, 0, 0, 0.85));
  r.flat(...(() => { const [x, , z] = atWall(bedA, 1.15, 0); return [x, z, faceIn(A(bedA))]; })(), () => F.rugAt(B, M.rug, 0, 0, 0, 1.4, 0.8, 0));

  // ---- wardrobe, washstand under the window, chest of drawers with a mirror, bookcase and sea chest in the nook
  r.wall(277, 1.1, 0.6, 2.05, () => F.wardrobe(B, M, 1.1, 2.0), { name: 'wardrobe' });
  r.wall(13, 0.7, 0.45, 0.9, () => F.washstand(B, M), { name: 'washstand' });
  const cd = r.wall(30, 0.95, 0.5, 0.95, () => F.chestOfDrawers(B, M, 0.95, 0.5, 0.95, M.wood), { name: 'chest of drawers' });
  r.at(30, W, 1.45, () => F.mirror(B, M, 0.46, 0.62));
  { const p = toWorld(30, cd.r, y + 0.95, -0.22, 0, 0.0); F.tableLamp(ctx, B, p.x, p.y, p.z, 3.2); B.push(p.x + 0.4, y + 0.95, p.z + 0.1); F.cup(B, M); B.pop(); }
  r.wall(240, 0.85, 0.5, 0.5, () => F.trunk(B, M, 0.85, false), { name: 'blanket chest' });
  r.wall(252, 0.9, 0.34, 1.7, () => F.bookcase(B, M, 0.9, 1.65, rnd, 5), { name: 'bookcase' });
  { const [x, , z] = atWall(266, 2.3, 0); r.free(x, z, faceTo(x, z, bed.x, bed.z), 0.58, 0.9, 1.0, () => F.rockingChair(B, M), { name: 'rocking chair' }); }
  r.at(240, W, 1.5, () => F.painting(B, M, 0.38, 0.48, M.portrait));

  // ---- broken window: banging casement, rain blowing in, a puddle and a bucket
  const bw = T.broken;
  const puddleP = polar(3.2, bw.ac, y + 0.01);
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.6, 24), M.puddle); puddle.rotation.x = -Math.PI / 2; puddle.position.copy(puddleP); puddle.scale.setScalar(0.4); g.add(puddle);
  { const bp = polar(3.4, bw.ac + 0.17, y); r.round(bp.x, bp.z, 0.17, 0.3, () => { B.add(lathe([[0.001, 0], [0.14, 0], [0.17, 0.28], [0.162, 0.28], [0.13, 0.02], [0.001, 0.015]], 14), M.tin); B.add(new THREE.TorusGeometry(0.16, 0.008, 4, 14), M.steel, 0, 0.28, 0, Math.PI / 2); }, { name: 'bucket' }); }
  const boards = new THREE.Group(); boards.position.copy(polar(R_IN + 0.04, bw.ac, (bw.grp.position.y))); boards.rotation.y = faceIn(bw.ac); boards.visible = false; g.add(boards);
  { const bb = new X.Builder(); for (let k = 0; k < 3; k++) bb.box(1.3, 0.2, 0.04, M.wood, 0, -0.35 + k * 0.4, 0, 0, 0, (k - 1) * 0.08, 0.8); bb.build(boards); }
  let ang = 0, angV = 0;
  const bangP = bw.grp.position.clone();
  ctx.onUpdate((dt, t) => {
    if (S.windowBoarded) { bw.casement.rotation.y += (0 - bw.casement.rotation.y) * Math.min(1, dt * 5); return; }
    const wind = 2.5 + ctx.weather.gust * 5 + Math.sin(t * 1.3) * 2;
    angV += (-wind * Math.sin(ang + 0.2) - ang * 2.0) * dt * 3; angV *= 1 - dt * 0.8;
    ang += angV * dt;
    if (ang > 0) { if (angV > 1.5) { audio.ok && audio.burst({ buf: audio.brown, type: 'lowpass', f: 400, a: 0.003, d: 0.2, g: Math.min(0.9, angV * 0.12), dest: bangPan() }); } ang = 0; angV = -angV * 0.3; }
    ang = Math.max(-1.9, ang);
    bw.casement.rotation.y = -ang;
    puddle.scale.setScalar(Math.min(1.4, puddle.scale.x + dt * 0.004));
  });
  let _pan = null; const bangPan = () => (_pan ??= audio.panner(bangP.x, bangP.y, bangP.z, 3, 1.4));
  const bwo = new THREE.Group(); bwo.position.copy(polar(R_IN + 0.3, bw.ac, bw.grp.position.y)); g.add(bwo);
  const hit = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.4), new THREE.MeshBasicMaterial({ visible: false })); hit.rotation.y = faceIn(bw.ac); bwo.add(hit);
  interact(bwo, {
    range: 2.8,
    prompt: () => S.windowBoarded ? null : (game.has('hammer') && game.has('boards')) ? 'Board up the broken window' : 'The casement has torn loose. Rain is pouring in. You need boards, a hammer and nails.',
    hold: 3.2, onHold: (dt, p) => { if (Math.floor(p * 12) !== Math.floor((p - dt / 3.2) * 12)) audio.hammer(); },
    action: () => {
      if (!(game.has('hammer') && game.has('boards'))) { game.toast('Spare <b>boards</b> and a <b>hammer</b> are kept in the store room at the foot of the tower.'); return; }
      S.windowBoarded = true; boards.visible = true; game.take('boards'); audio.hammer(); game.toast('Three boards, a dozen nails. The window is shut against the gale.'); game.refresh();
    },
  });
  ctx.onUpdate(() => { bwo.userData.inter.hold = game.has('hammer') && game.has('boards') ? 3.2 : 0; });

  // ---- the loose floorboard with the pocket watch beneath it
  {
    const p = polar(1.45, A(28), y);
    const o = group(p.x, y, p.z, -A(28));
    const pl = new THREE.Mesh(boxGeo(1.0, 0.03, 0.24, 1), M.planks); pl.position.y = 0.012; pl.rotation.z = 0.012; o.add(pl);
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.2), M.black); hole.rotation.x = -Math.PI / 2; hole.position.y = 0.004; hole.visible = false; o.add(hole);
    let hinted = false, lastCreak = 0;
    ctx.onUpdate((dt, t) => {
      const pp = ctx.player.pos;
      if (Math.abs(pp.y - y) < 0.3 && Math.hypot(pp.x - p.x, pp.z - p.z) < 0.9 && !S.floorboardPried && t - lastCreak > 1.6) {
        lastCreak = t; audio.creak(0.7);
        if (!hinted) { hinted = true; game.toast('The board under your boot gives a hollow creak.', 3); }
      }
    });
    interact(o, { assist: true, range: 2.4, prompt: () => S.floorboardPried ? null : hinted ? 'Lift the creaking floorboard' : null, hold: 1.2, action: () => { S.floorboardPried = true; pl.position.set(0.3, 0.05, 0.25); pl.rotation.set(0, 0.5, 0.1); hole.visible = true; audio.creak(0.8); setTimeout(() => game.findTreasure('watch'), 400); } });
  }
}
