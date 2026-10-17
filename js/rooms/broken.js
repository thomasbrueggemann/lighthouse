import * as THREE from 'three';
import { R_IN, FLOORS, faceIn, polar } from '../config.js';
import { lathe } from '../geom.js';
import { NIGHT } from '../night.js';

// The casement the gale has torn loose tonight (NIGHT.broken picks the room; some nights every window holds): it bangs
// in the wind, rain blows in and a puddle spreads, until it is boarded up with the boards and hammer from the store room.
export function buildBrokenWindow(X) {
  const { ctx, B, g, S, T, M, col, game, audio, interact } = X;
  const bw = T.broken;
  if (!NIGHT.broken || !bw) return;
  const k = FLOORS.findIndex(f => f.id === NIGHT.broken.floor), y = FLOORS[k].y;
  const inBedroom = NIGHT.broken.floor === 'bedroom';

  // in the bedroom there is room under the window for a bucket; elsewhere furniture stands there, so the puddle
  // spreads a little further into the room
  const puddleP = polar(inBedroom ? 3.2 : 2.9, bw.ac, y + 0.02);
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.6, 24), M.puddle); puddle.rotation.x = -Math.PI / 2; puddle.position.copy(puddleP); puddle.scale.setScalar(0.4); g.add(puddle);
  if (inBedroom) {
    const bp = polar(3.4, bw.ac + 0.17, y);
    B.push(bp.x, y, bp.z); B.add(lathe([[0.001, 0], [0.14, 0], [0.17, 0.28], [0.162, 0.28], [0.13, 0.02], [0.001, 0.015]], 14), M.tin); B.add(new THREE.TorusGeometry(0.16, 0.008, 4, 14), M.steel, 0, 0.28, 0, Math.PI / 2); B.pop();
    col.addCircle(bp.x, bp.z, 0.17, y, y + 0.3);
  }
  const boards = new THREE.Group(); boards.position.copy(polar(R_IN + 0.04, bw.ac, (bw.grp.position.y))); boards.rotation.y = faceIn(bw.ac); boards.visible = false; g.add(boards);
  { const bb = new X.Builder(); for (let i = 0; i < 3; i++) bb.box(1.3, 0.2, 0.04, M.wood, 0, -0.35 + i * 0.4, 0, 0, 0, (i - 1) * 0.08, 0.8); bb.build(boards); }
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
}
