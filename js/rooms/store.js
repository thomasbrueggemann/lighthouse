import * as THREE from 'three';
import * as F from '../furniture.js';
import { HATCH } from '../tower.js';
import { R_IN, TAU, faceIn, polar } from '../config.js';
import { lathe } from '../geom.js';

// Ground floor: the keeper's store and workshop. Door at 90 degrees, the stairs start at 120. The corridor from the
// door to the first tread (80..113) is left clear; the low treads (113..183) are bare wall; the under-stair nook (183..216)
// holds low storage; everything else is working clutter arranged by purpose.
export function buildStore(X) {
  const { ctx, B, g, env, rnd, S, T, M, col, game, audio, interact, group, toWorld, A, atWall } = X;
  const r = env.room(0), y = r.y, W = R_IN - 0.015;

  // ---- light: a wall lamp by the door, a hanging lamp over the hatch, a storm lantern on the sea chest
  F.wallLamp(ctx, B, 62, y + 2.0, 5.5);
  F.hangingLamp(ctx, B, 0, y + 2.44, 0, 0.42, 4.5);

  // ---- the work bench: vice, a shelf of jars, tools on a pegboard, and the toolbox
  const bench = r.wall(45, 1.6, 0.62, 1.0, () => {
    F.workTable(B, M, 1.6, 0.62, 0.9, M.woodDark);
    B.cbox(0.22, 0.12, 0.14, M.ironBlack, 0.6, 0.96, 0.1, 0, 0, 0, 0.5, null, 0.008); B.cyl(0.015, 0.015, 0.3, M.steel, 0.6, 0.96, 0.28, 6, Math.PI / 2);
    B.cyl(0.05, 0.055, 0.14, M.ironRed, -0.62, 0.97, 0.0, 12);                                            // oil can
    B.cbox(0.2, 0.08, 0.14, M.tin, 0.2, 0.94, 0.08, 0, 0.3, 0, 0.5, null, 0.006);                          // tin of nails
    B.push(-0.1, 0.9, -0.1); F.rope(B, M, 3, 0.1); B.pop();
  }, { name: 'workbench' });
  r.at(45, W, 1.62, () => { F.wallShelf(B, M, 1.4, 0.24); F.jars(B, M, 1.3, 0.015, rnd, 7); });
  r.at(45, W, 1.2, () => {
    B.cbox(1.0, 0.5, 0.02, M.woodDark, -0.1, 0, 0.01, 0, 0, 0, 0.8, null, 0.004);
    B.cbox(0.34, 0.03, 0.012, M.steel, -0.38, 0.05, 0.03); B.cbox(0.05, 0.1, 0.02, M.wood, -0.56, 0.05, 0.035);   // saw
    B.cbox(0.03, 0.2, 0.012, M.steel, -0.2, 0.0, 0.03, 0, 0, 0.15);                                          // spanner
    B.cbox(0.03, 0.16, 0.012, M.steel, -0.1, -0.02, 0.03, 0, 0, -0.1); B.cbox(0.03, 0.16, 0.012, M.steel, 0.0, -0.02, 0.03);
    B.add(new THREE.TorusGeometry(0.07, 0.012, 5, 14), M.rope, 0.2, 0.0, 0.04);
  });
  { const [sx, , sz] = atWall(45, 2.95, 0); r.round(sx, sz, 0.18, 0.5, () => F.stool(B, M), { name: 'bench stool' }); }
  {
    const p = toWorld(45, bench.r, y + 0.9, -0.3, 0, 0.05);
    const o = group(p.x, p.y, p.z, faceIn(A(45)));
    const b = new X.Builder();
    b.box(0.45, 0.16, 0.22, M.ironRed, 0, 0.08, 0); b.box(0.02, 0.1, 0.02, M.ironBlack, -0.15, 0.2, 0); b.box(0.02, 0.1, 0.02, M.ironBlack, 0.15, 0.2, 0); b.box(0.32, 0.02, 0.02, M.ironBlack, 0, 0.25, 0);
    const hm = new X.Builder(); hm.box(0.03, 0.03, 0.28, M.wood, 0.05, 0.18, 0.02, 0, 0.3, 0); hm.box(0.05, 0.05, 0.12, M.steel, 0.05 + Math.sin(0.3) * 0.14, 0.18, 0.02 + Math.cos(0.3) * 0.14, 0, 0.3 + Math.PI / 2, 0);
    b.build(o); const hammerGrp = new THREE.Group(); hm.build(hammerGrp); o.add(hammerGrp);
    interact(o, { prompt: () => game.has('hammer') || S.windowBoarded ? null : 'Take hammer & nails', action: () => { game.give('hammer'); hammerGrp.visible = false; } });
  }

  // ---- barrels of paraffin and water, a row of three along the wall below the window
  for (const a of [322, 337, 352]) { const [x, , z] = atWall(a, 3.45, 0); r.round(x, z, 0.34, 1.0, () => F.barrel(B, M), { name: 'barrel' }); }

  // ---- keeper's locker and the stock shelves
  r.wall(18, 1.0, 0.45, 1.9, () => F.cupboard(B, M, 1.0, 0.45, 1.9, M.paintGreen), { name: 'locker' });
  r.wall(302, 1.2, 0.4, 1.9, () => F.shelving(B, M, 1.2, 0.4, 1.9, rnd, 'store', 5), { name: 'stock shelves' });

  // ---- coats and boots by the door
  r.at(71, W, 1.8, () => F.coatRack(B, M));
  r.at(71, W - 0.35, 0, () => { for (const x of [-0.12, 0.1]) { B.cbox(0.11, 0.38, 0.13, M.black, x, 0.19, 0.0, 0, 0, 0, 0.5, null, 0.01); B.cbox(0.11, 0.07, 0.26, M.black, x, 0.035, 0.07, 0, 0, 0, 0.5, null, 0.01); } });

  // ---- a sea chest under the window with a storm lantern on it
  const chest = r.wall(248, 0.85, 0.5, 0.5, () => F.trunk(B, M, 0.85, true), { name: 'sea chest' });
  F.stormLantern(ctx, B, chest.x, y + 0.52, chest.z, 3.5);

  // ---- the under-stair nook (low storage only): crates, sacks, lobster pots
  r.wall(189, 0.66, 0.66, 1.1, () => { F.crate(B, M, 0.6); B.push(0.02, 0.6, 0, 0, 0.3); F.crate(B, M, 0.42); B.pop(); }, { name: 'crates' });
  r.wall(201, 0.9, 0.5, 0.6, () => { F.sack(B, M, 0x8a7a5a, 0.5); B.push(0.3, 0, 0.06); F.sack(B, M, 0x7a6a4a, 0.44); B.pop(); B.push(-0.3, 0, 0.1); F.sack(B, M, 0x9a8a68, 0.4); B.pop(); }, { name: 'sacks' });
  for (const [a, rr] of [[211, 3.42], [214, 3.15]]) {
    const [x, , z] = atWall(a, rr, 0);
    r.round(x, z, 0.33, 0.5, () => { B.add(lathe([[0.001, 0], [0.32, 0], [0.34, 0.2], [0.3, 0.42], [0.12, 0.5], [0.001, 0.5]], 10), M.rope); }, { name: 'lobster pot' });
  }

  // ---- a ladder and a rack of garden tools
  {
    const [lx, , lz, lry] = atWall(226, R_IN - 0.4, 0);
    r.free(lx, lz, lry, 0.5, 0.4, 2.2, () => F.ladder(B, M, 2.2), { name: 'ladder' });
    r.at(236, W, 1.0, () => {
      B.cbox(0.7, 0.07, 0.03, M.woodDark, 0, 0.55, 0.015, 0, 0, 0, 0.8, null, 0.006);
      for (const [x, len, head] of [[-0.25, 1.4, 'spade'], [0.0, 1.5, 'fork'], [0.25, 1.35, 'rake']]) {
        B.cyl(0.014, 0.014, len, M.wood, x, 0.55 - len / 2 + 0.3, 0.06, 6);
        B.cbox(head === 'fork' ? 0.14 : 0.18, 0.2, 0.012, M.steel, x, 0.55 - len + 0.2, 0.06, 0, 0, 0, 0.5, null, 0.004);
      }
    });
  }

  // ---- the life ring on the wall
  r.at(278, W, 1.9, () => { B.add(new THREE.TorusGeometry(0.3, 0.075, 10, 24), M.ironRed, 0, 0, 0.08); for (let k = 0; k < 4; k++) B.add(new THREE.TorusGeometry(0.3, 0.078, 10, 6, Math.PI / 4), M.paintWhite, 0, 0, 0.08, 0, 0, k * Math.PI / 2 + Math.PI / 8); });

  // ---- crate stack, and the crate hiding the spare drive belt
  r.wall(276, 0.65, 0.65, 0.7, () => { F.crate(B, M, 0.62); B.push(0.04, 0.62, 0.0, 0.3); F.crate(B, M, 0.48); B.pop(); }, { name: 'crate stack' });
  {
    const [x, , z, ry] = atWall(288, 3.4, y);
    const o = group(x, y, z, ry);
    const b = new X.Builder(); F.crate(b, M, 0.58); b.box(0.6, 0.04, 0.6, M.woodRed, 0, 0.6, 0, 0, 0, 0.12); b.build(o);
    col.addBox(x, z, 0.62, 0.62, ry, y, y + 0.7);
    let searched = false;
    interact(o, { prompt: () => searched ? null : 'Search the crate', hold: 1.0, onHold: () => { if (Math.random() < 0.1) audio.wipe(); }, action: () => { searched = true; game.give('belt'); game.toast('Under a nest of straw: a coiled <b>leather drive belt</b>, stamped <em>FOG SIGNAL — SPARE</em>.'); } });
  }
  {
    const [x, , z, ry] = atWall(262, 3.8, y);
    const o = group(x, y, z, ry);
    const b = new X.Builder(); for (let k = 0; k < 3; k++) b.box(0.22, 1.7, 0.03, M.wood, -0.25 + k * 0.24, 0.84, 0.12 + k * 0.02, -0.12, 0, 0, 0.8); b.build(o);
    interact(o, { prompt: () => game.has('boards') || S.windowBoarded ? null : 'Take spare boards', action: () => { game.give('boards'); o.visible = false; } });
  }

  // ---- the rug that hides the trapdoor
  {
    const cx = (HATCH.x0 + HATCH.x1) / 2, cz = (HATCH.z0 + HATCH.z1) / 2;
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.7), M.rug); rug.rotation.x = -Math.PI / 2; rug.position.set(cx, y + 0.012, cz); rug.receiveShadow = true; g.add(rug);
    const rugState = { t: 0 };
    interact(rug, { range: 2.4, prompt: () => S.rugMoved ? null : 'Pull back the rug', action: () => { S.rugMoved = true; audio.wipe(); audio.wipe(); game.toast('Under the rug: a <b>trapdoor</b> with an iron ring.'); } });
    ctx.onUpdate((dt) => {
      rugState.t += ((S.rugMoved ? 1 : 0) - rugState.t) * Math.min(1, dt * 3);
      rug.scale.x = 1 - rugState.t * 0.55; rug.position.x = cx - rugState.t * 1.75; rug.position.y = y + 0.012 + rugState.t * 0.02;
    });
    T.hatch.lid.visible = true;
    interact(T.hatch.pivot, {
      prompt: () => !S.rugMoved ? null : T.hatch.open ? 'Close the trapdoor' : 'Open the trapdoor',
      action: () => { T.hatch.open = !T.hatch.open; audio.door(); T.hatchSegs.forEach(s => (s.on = T.hatch.open)); if (T.hatch.open) col.removeWalk(T.hatch.lid); else col.addWalk(T.hatch.lid, 'wood'); },
    });
  }

  // ---- the tower door
  interact(T.door.hinge, {
    prompt: () => T.door.open ? 'Close the door' : 'Open the door',
    action: () => { T.door.open = !T.door.open; T.door.seg.on = !T.door.open; audio.door(); ctx.refreshShadows(); },
  });
  r.curtains(M.gingham);
}
