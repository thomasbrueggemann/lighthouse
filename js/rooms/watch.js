import * as THREE from 'three';
import * as F from '../furniture.js';
import { R_IN, TAU, faceIn, polar } from '../config.js';
import { boxGeo, cylGeo } from '../geom.js';

// Ninth level: the watch room, directly under the lantern. The clockwork stands in the middle with the last flight
// winding round it, the paraffin reservoir and pump against the north-west wall, and a keeper's corner (table, chair,
// lamp, kettle) for the long hours. Stairwell opening 2..97; everything else is free.
export function buildWatch(X) {
  const { ctx, B, g, env, rnd, S, T, M, col, game, audio, interact, group, toWorld, A, faceTo, atWall } = X;
  const r = env.room(8), y = r.y, W = R_IN - 0.015;
  const CEIL = 2.7;                                   // clear height under the lantern floor
  r.curtains(X.fab(M, 0xc8c0a0, true));

  // ---- clockwork column and mechanism
  B.cyl(0.32, 0.32, CEIL, M.ironGreen, 0, y + CEIL / 2, 0, 20);
  B.cyl(0.42, 0.42, 0.1, M.ironGreen, 0, y + 0.05, 0, 20);
  col.addCircle(0, 0, 0.62, y, y + 4.5);
  const gears = [];
  const gearGeo = (rr, teeth, th) => {
    const s = new THREE.Shape();
    for (let i = 0; i < teeth * 2; i++) { const a0 = i / (teeth * 2) * TAU, a1 = (i + 1) / (teeth * 2) * TAU, q = i % 2 ? rr : rr + 0.03; s.lineTo(Math.cos(a0) * q, Math.sin(a0) * q); s.lineTo(Math.cos(a1) * q, Math.sin(a1) * q); }
    const hole = new THREE.Path(); hole.absarc(0, 0, rr * 0.25, 0, TAU, true); s.holes.push(hole);
    return new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: false, curveSegments: 4 });
  };
  const mech = group(0, y, 0);
  const mb = new X.Builder();
  mb.box(0.9, 0.9, 0.08, M.ironGreen, 0.0, 1.1, 0.38); mb.box(0.9, 0.9, 0.08, M.ironGreen, 0.0, 1.1, -0.38);
  mb.build(mech);
  for (const [x, yy, rr, n, sp] of [[-0.18, 1.25, 0.24, 24, 1], [0.2, 1.0, 0.16, 16, -1.5], [0.22, 1.42, 0.1, 10, 2.4]]) {
    const gm = new THREE.Mesh(gearGeo(rr, n, 0.04), M.brass); gm.position.set(x, yy, 0.42); mech.add(gm); gears.push([gm, sp]);
    const gm2 = new THREE.Mesh(gearGeo(rr * 0.8, Math.floor(n * 0.8), 0.04), M.brass); gm2.position.set(-x, yy, -0.46); mech.add(gm2); gears.push([gm2, -sp]);
  }
  const gov = new THREE.Group(); gov.position.set(0, 1.85, 0.42); mech.add(gov);
  for (const s of [-1, 1]) { const ball = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), M.brass); ball.position.set(s * 0.12, -0.08, 0); gov.add(ball); const arm = new THREE.Mesh(cylGeo(0.006, 0.006, 0.15, 4), M.steel); arm.position.set(s * 0.06, -0.04, 0); arm.rotation.z = s * 1.0; gov.add(arm); }
  const crank = new THREE.Group(); crank.position.set(0.47, 1.1, 0.0); mech.add(crank);
  { const cb = new X.Builder(); cb.cyl(0.03, 0.03, 0.12, M.steel, 0.06, 0, 0, 8, 0, 0, Math.PI / 2); cb.box(0.03, 0.3, 0.04, M.ironBlack, 0.12, -0.13, 0); cb.cyl(0.025, 0.025, 0.14, M.woodDark, 0.19, -0.26, 0, 8, 0, 0, Math.PI / 2); cb.build(crank); }
  mech.rotation.y = -A(60);
  ctx.onUpdate((dt) => {
    const run = S.clockwork > 0 ? 1 : 0;
    for (const [gm, sp] of gears) gm.rotation.z += sp * dt * 0.6 * run;
    gov.rotation.y += dt * 9 * run;
  });
  interact(crank, {
    prompt: () => S.clockwork > 0.97 ? null : S.clockwork > 0 ? 'Top up the clockwork' : 'Wind the clockwork',
    hold: 4.0, onHold: (dt) => { crank.rotation.x -= dt * 9; S.clockwork = Math.min(1, S.clockwork + dt / 4.0 * 0.6); if (Math.random() < 0.45) audio.ratchet(); },
    action: () => { S.clockwork = 1; S.everWound = true; game.refresh(); game.toast('The weight rises up its tube. Below the lantern, the great lens begins to turn.'); },
  });
  const mechP = new THREE.Vector3(0, y + 1.5, 0);
  audio.ok; ctx.onUpdate(() => { if (audio.ok && !audio.loops.mech) audio.addLoop('mech', mechP.x, mechP.y, mechP.z, 0.5, 0.5, (pan) => audio.burst({ type: 'bandpass', f: 2600, q: 8, a: 0.001, d: 0.04, g: 0.25, dest: pan }), 1.5); audio.setLoop('mech', S.clockwork > 0); });

  // ---- paraffin reservoir and pressure pump
  const tankA = 300;
  const tank = r.wall(tankA, 1.4, 0.6, 1.3, () => {
    B.cbox(1.2, 0.08, 0.5, M.ironGreen, 0, 0.5, 0, 0, 0, 0, 0.6, null, 0.008); for (const sx of [-1, 1]) B.cbox(0.06, 0.5, 0.45, M.ironGreen, sx * 0.5, 0.25, 0, 0, 0, 0, 0.6, null, 0.008);
    B.cyl(0.28, 0.28, 1.1, M.brass, 0, 0.82, 0, 24, 0, 0, Math.PI / 2);
    for (const sx of [-1, 1]) B.cyl(0.29, 0.29, 0.03, M.brass, sx * 0.4, 0.82, 0, 24, 0, 0, Math.PI / 2);
    B.cyl(0.05, 0.05, 0.12, M.brass, -0.3, 1.14, 0, 10);
    B.cyl(0.015, 0.015, 1.95, M.brass, 0.4, 1.75, -0.15, 6);
    B.cyl(0.04, 0.05, 0.6, M.ironBlack, 0.7, 0.3, 0.05, 10);
    B.add(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 24).rotateX(Math.PI / 2), M.brass, 0.15, 1.25, 0.08);
    B.add(new THREE.CircleGeometry(0.1, 24), M.gaugeFace, 0.15, 1.25, 0.101);
    B.box(0.03, 0.18, 0.03, M.brass, 0.15, 1.12, 0.05);
  }, { name: 'reservoir' });
  {
    const gp = toWorld(tankA, tank.r, y + 1.25, 0.15, 0, 0.105);
    const gN = new THREE.Group(); gN.position.copy(gp); gN.rotation.y = faceIn(A(tankA)); g.add(gN);
    const needle = new THREE.Mesh(boxGeo(0.005, 0.085, 0.003), new THREE.MeshBasicMaterial({ color: 0x111111 })); needle.geometry.translate(0, 0.035, 0); gN.add(needle);
    ctx.onUpdate(() => { needle.rotation.z = 2.36 - S.pressure * 3.9; });
  }
  {
    const p = toWorld(tankA, tank.r, y + 0.82, -0.25, 0, 0.3);
    const o = group(p.x, p.y, p.z, faceIn(A(tankA)));
    const hit = new THREE.Mesh(boxGeo(0.6, 0.6, 0.2), new THREE.MeshBasicMaterial({ visible: false })); o.add(hit);
    interact(o, {
      prompt: () => S.fuelFilled ? null : game.has('oilcan') ? 'Pour the paraffin into the reservoir' : 'The paraffin reservoir. The sight glass shows empty.',
      hold: 0, action: () => {
        if (!game.has('oilcan')) { game.toast('You need a <b>can of paraffin</b> from the oil store out on the rock.'); return; }
        o.userData.inter.hold = 0; audio.pour(); S.fuelFilled = true; S.fuel = 1; game.take('oilcan'); game.toast('Glugging, the reservoir fills. Now <b>pump up the pressure</b>.');
      },
    });
  }
  {
    const p = toWorld(tankA, tank.r, y, 0.7, 0.62, 0.05);
    const lever = new THREE.Group(); lever.position.copy(p); lever.rotation.y = faceIn(A(tankA)); g.add(lever);
    const lb = new X.Builder(); lb.cyl(0.018, 0.018, 0.3, M.steel, 0, 0.12, 0, 6); lb.cyl(0.03, 0.03, 0.18, M.woodDark, 0, 0.27, 0, 8, 0, 0, Math.PI / 2); lb.build(lever);
    interact(lever, {
      prompt: () => !S.fuelFilled ? null : S.pressure > 0.98 ? null : 'Pump up the pressure',
      hold: 3.0, onHold: (dt, pr) => { lever.position.y = p.y + Math.abs(Math.sin(pr * 18)) * -0.15; S.pressure = Math.min(1, S.pressure + dt / 3); if (Math.random() < 0.1) audio.pump(); },
      action: () => { S.pressure = 1; lever.position.y = p.y; if (S.leak) { S.leak = false; game.toast('You tighten the gland nut on the pump. The hiss stops and the needle holds.', 5); } game.refresh(); game.toast('The needle stands in the red. Ready to light the lamp above.'); },
    });
  }

  // ---- the cleaning bench (with the rag) and shelves of lamp oil
  const bench = r.wall(140, 1.2, 0.55, 0.95, () => { F.workTable(B, M, 1.2, 0.55, 0.85, M.woodDark); for (let k = 0; k < 4; k++) B.box(0.1, 0.06, 0.1, X.fab(M, 0xe8e0c8), -0.4 + k * 0.12, 0.88, -0.1); B.cbox(0.25, 0.18, 0.18, M.tin, 0.35, 0.94, -0.05, 0, 0, 0, 0.5, null, 0.01); }, { name: 'cleaning bench' });
  if (X.NIGHT.rag === 'bench') { const p = toWorld(140, bench.r, y + 0.85, 0.05, 0, 0.12); X.pickup('rag', p.x, p.y - 0.03, p.z, 0.4, 'Take the cleaning rag'); }
  r.wall(165, 1.1, 0.4, 2.0, () => F.shelving(B, M, 1.1, 0.4, 2.0, rnd, 'workshop', 6), { name: 'oil shelves' });
  F.wallLamp(ctx, B, 152, y + 1.9, 4.5);

  // ---- the keeper's corner: table, chair, lamp, mug and a book, with oilskins on pegs
  const tbl = r.wall(220, 0.9, 0.5, 0.8, () => { F.table(B, M, 0.9, 0.5, 0.75, M.wood); B.cbox(0.3, 0.03, 0.22, M.leather, -0.15, 0.765, 0, 0, 0.2, 0, 0.5, null, 0.006); B.push(0.25, 0.75, 0.0); F.cup(B, M); B.pop(); }, { name: 'keeper table' });
  { const p = toWorld(220, tbl.r, y + 0.75, -0.25, 0, 0.0); F.tableLamp(ctx, B, p.x, p.y, p.z, 4.0); }
  { const [x, , z] = atWall(220, 2.85, 0); r.free(x, z, faceTo(x, z, tbl.x, tbl.z), 0.46, 0.46, 0.95, () => F.chair(B, M, M.woodDark, X.fab(M, 0x7a3a2a)), { name: 'keeper chair', nocheck: true }); }
  r.at(246, W, 1.75, () => F.coatRack(B, M));
  r.wall(270, 0.45, 0.45, 0.5, () => F.stool(B, M, 0.48), { name: 'stool', nocheck: true });
  r.at(200, W, 1.9, () => F.painting(B, M, 0.5, 0.4, M.chart));
  F.hangingLamp(ctx, B, 1.3, y + 2.4, 1.0, 0.45, 5.0);
}
