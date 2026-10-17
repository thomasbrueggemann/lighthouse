import * as THREE from 'three';
import * as F from '../furniture.js';
import { R_IN, TAU, faceIn, polar } from '../config.js';
import { boxGeo, lathe } from '../geom.js';

// First floor: the kitchen. The stairwell opening (130..225) and the first treads (249..319) are bare wall; the
// corridor between them (216..249) stays clear. The working wall runs 352..130, broken by windows at 24 and 101 degrees:
// pantry, worktable, sink under the window, settle, dresser, window seat and the range, with the table and the
// armchair-by-the-stove in the open middle of the room.
export function buildKitchen(X) {
  const { ctx, B, g, env, rnd, S, T, M, col, game, audio, interact, group, toWorld, A, atWall, faceTo, ORDERS } = X;
  const r = env.room(1), y = r.y, W = R_IN - 0.015;
  const gingham = M.gingham;

  r.curtains(gingham);

  // ---- pantry and the log basket in the under-stair nook
  r.wall(331, 1.0, 0.4, 1.95, () => F.shelving(B, M, 1.0, 0.4, 1.95, rnd, 'pantry', 6), { name: 'pantry' });
  { const [x, , z] = atWall(346, 3.55, 0); r.round(x, z, 0.24, 0.5, () => { F.logBasket(B, M); }, { name: 'log basket' }); }

  // ---- worktable with the bread and a bowl of apples
  r.wall(5, 0.95, 0.55, 0.9, () => {
    F.workTable(B, M, 0.95, 0.55, 0.9, M.wood);
    B.push(-0.2, 0.9, 0.0); F.loaf(B, M); B.pop();
    B.push(0.22, 0.9, 0.05); F.fruitBowl(B, M); B.pop();
  }, { name: 'worktable' });
  r.at(5, W, 1.5, () => { F.wallShelf(B, M, 0.9, 0.2); B.push(-0.25, 0.015, 0.1); F.teapot(B, M); B.pop(); B.push(0.1, 0.015, 0.1); F.cup(B, M); B.pop(); B.push(0.28, 0.015, 0.1); F.cup(B, M, M.ceramicBlue); B.pop(); });

  // ---- sink with the hand pump, under the window
  r.wall(24, 1.05, 0.55, 1.0, () => {
    B.cbox(1.0, 0.82, 0.5, M.paintTeal, 0, 0.41, 0, 0, 0, 0, 0.7, null, 0.01);
    B.cbox(1.05, 0.05, 0.55, M.granite, 0, 0.845, 0, 0, 0, 0, 0.8, null, 0.008);
    B.cbox(0.5, 0.06, 0.36, M.ceramic, 0.18, 0.9, 0.02, 0, 0, 0, 0.5, null, 0.01);
    B.cyl(0.035, 0.04, 0.35, M.ironGreen, -0.3, 1.04, -0.08, 10); B.cyl(0.015, 0.015, 0.18, M.ironGreen, -0.3, 1.2, 0.02, 6, Math.PI / 2);
    B.box(0.03, 0.03, 0.3, M.ironGreen, -0.3, 1.25, -0.2, -0.5);
    for (const sx of [-0.25, 0.25]) B.cbox(0.4, 0.62, 0.012, M.woodDark, sx - 0.0, 0.4, 0.255, 0, 0, 0, 0.5, null, 0.004);
  }, { name: 'sink' });
  r.sill(0, () => F.plant(B, M, 0.32));

  // ---- the settle with a sconce above it
  r.wall(42, 1.3, 0.5, 1.0, () => F.settle(B, M, 1.3, 0x7a3a2a), { name: 'settle' });
  F.sconce(ctx, B, 42, y + 1.7, 3.2);

  // ---- the dresser, with plates and the box of matches
  const dr = r.wall(66, 1.2, 0.52, 2.1, () => {
    B.cbox(1.15, 0.85, 0.48, M.paintTeal, 0, 0.425, 0, 0, 0, 0, 0.7, null, 0.01);
    B.cbox(1.2, 0.04, 0.52, M.wood, 0, 0.87, 0, 0, 0, 0, 0.8, null, 0.008);
    for (const x of [-0.28, 0.28]) { B.cbox(0.5, 0.36, 0.02, M.paintTeal, x, 0.4, 0.245, 0, 0, 0, 0.5, null, 0.004); B.cyl(0.015, 0.015, 0.02, M.brass, x + 0.18 * Math.sign(-x), 0.45, 0.26, 6, Math.PI / 2); }
    B.cbox(1.15, 1.1, 0.03, M.paintTeal, 0, 1.45, -0.22, 0, 0, 0, 0.7, null, 0.005);
    for (const sx of [-1, 1]) B.cbox(0.04, 1.1, 0.26, M.paintTeal, sx * 0.555, 1.45, -0.1, 0, 0, 0, 0.7, null, 0.005);
    B.cbox(1.18, 0.05, 0.3, M.paintTeal, 0, 2.02, -0.09, 0, 0, 0, 0.7, null, 0.006);
    for (const yy of [1.25, 1.62]) {
      B.cbox(1.1, 0.025, 0.24, M.paintTeal, 0, yy, -0.1, 0, 0, 0, 0.7, null, 0.004);
      for (let k = 0; k < 5; k++) B.cyl(0.085, 0.085, 0.015, k % 2 ? M.ceramicBlue : M.ceramic, -0.4 + k * 0.2, yy + 0.108, -0.17, 20, Math.PI / 2 - 0.15);
    }
    for (let k = 0; k < 4; k++) { B.cyl(0.04, 0.035, 0.09, M.ceramic, -0.4 + k * 0.12, 0.93, 0.05, 10); B.add(new THREE.TorusGeometry(0.025, 0.006, 4, 10), M.ceramic, -0.4 + k * 0.12 + 0.045, 0.93, 0.05); }
  }, { name: 'dresser' });
  if (X.NIGHT.matches === 'dresser') { const p = toWorld(66, dr.r, y + 0.89, 0.3, 0, 0.1); X.pickup('matches', p.x, p.y, p.z, faceIn(A(66)) + 0.3, 'Take the box of matches'); }
  F.wallLamp(ctx, B, 79, y + 1.95, 4.5);

  // ---- the wall clock
  {
    const ca = 88;
    r.at(ca, W, 2.0, () => { B.add(new THREE.CylinderGeometry(0.22, 0.22, 0.07, 28).rotateX(Math.PI / 2), M.woodDark, 0, 0, 0.035); B.add(new THREE.CircleGeometry(0.19, 28), M.clockFace, 0, 0, 0.072); });
    const clockP = toWorld(ca, W, y + 2.0, 0, 0, 0.075);
    const hands = new THREE.Group(); hands.position.copy(clockP); hands.rotation.y = faceIn(A(ca)); g.add(hands);
    const hh = new THREE.Mesh(boxGeo(0.012, 0.1, 0.004), M.black); hh.geometry.translate(0, 0.045, 0);
    const mh = new THREE.Mesh(boxGeo(0.008, 0.15, 0.004), M.black); mh.geometry.translate(0, 0.07, 0.003);
    const hp = new THREE.Group(), mp = new THREE.Group(); hp.add(hh); mp.add(mh); hands.add(hp, mp);
    ctx.onUpdate((dt, t) => { const m = (t / 60 + 22 * 60 + 47) % 720; mp.rotation.z = -m / 60 * TAU; hp.rotation.z = -m / 720 * TAU; });
  }

  // ---- window seat under the east-facing window, with cushions, a plant and a candle
  const seat = r.wall(101, 1.15, 0.45, 0.5, () => {
    B.cbox(1.1, 0.42, 0.42, M.paintWhite, 0, 0.21, 0, 0, 0, 0, 0.7, null, 0.01);
    F.cushion(B, M, 0x2f4a5a, 0, 0.46, 0.0, 1.0, 0.4);
    F.cushion(B, M, 0x8a3a2a, -0.36, 0.55, -0.1, 0.34, 0.28, -0.4); F.cushion(B, M, 0xc8a050, 0.32, 0.54, -0.1, 0.3, 0.26, -0.4);
  }, { name: 'window seat' });
  r.sill(1, () => { F.plant(B, M, 0.26, false); }, -0.28);
  { const p = polar(R_IN + 0.2, A(101), y + 1.0); F.candle(ctx, B, p.x, p.y, p.z, 2.4); }

  // ---- the range
  const stoveA = 119;
  const stove = r.wall(stoveA, 1.05, 0.7, 1.05, () => {
    B.cbox(0.95, 0.72, 0.62, M.ironBlack, 0, 0.5, 0, 0, 0, 0, 0.6, null, 0.01); B.cbox(1.05, 0.04, 0.7, M.ironBlack, 0, 0.88, 0, 0, 0, 0, 0.6, null, 0.008);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.cbox(0.06, 0.14, 0.06, M.ironBlack, sx * 0.42, 0.07, sz * 0.25, 0, 0, 0, 0.5, null, 0.006);
    B.cbox(0.38, 0.32, 0.02, M.ironBlack, 0.22, 0.5, 0.32, 0, 0, 0, 0.5, null, 0.005); B.box(0.3, 0.025, 0.04, M.brass, 0.22, 0.7, 0.34);
    B.cyl(0.012, 0.012, 1.0, M.brass, 0, 0.83, 0.37, 8, 0, 0, Math.PI / 2);
    for (const x of [-0.25, 0.15]) B.cyl(0.12, 0.12, 0.012, M.ironBlack, x, 0.905, -0.05, 18);
    B.cyl(0.09, 0.09, 1.7, M.ironBlack, -0.25, 1.75, -0.18, 12); B.cyl(0.09, 0.09, 0.4, M.ironBlack, -0.25, 2.55, -0.36, 12, Math.PI / 2);
    B.cbox(1.3, 0.05, 0.26, M.woodDark, 0.05, 1.5, -0.18, 0, 0, 0, 0.8, null, 0.006);
  }, { name: 'range' });
  if (X.NIGHT.matches === 'range') { const p = toWorld(stoveA, stove.r, y + 1.525, 0.42, 0, -0.16); X.pickup('matches', p.x, p.y, p.z, faceIn(A(stoveA)) - 0.2, 'Take the box of matches'); }
  r.at(stoveA, W, 1.95, () => { F.pegRail(B, M, 1.1, 5); for (const [x, rr] of [[-0.4, 0.13], [-0.15, 0.1], [0.1, 0.12], [0.35, 0.09]]) { B.push(x, 0, 0.0); F.copperPan(B, M, rr); B.pop(); } });
  { const [x, , z] = atWall(stoveA, 2.9, 0); r.round(x, z, 0.2, 0.45, () => F.coalScuttle(B, M), { name: 'scuttle' }); }
  const fbPos = toWorld(stoveA, stove.r, y, -0.22, 0.5, 0.315);
  const fbDoor = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.28), M.ember); fbDoor.position.copy(fbPos); fbDoor.rotation.y = faceIn(A(stoveA)); g.add(fbDoor); fbDoor.visible = false;
  const grill = new THREE.Group(); grill.position.copy(fbPos).add(polar(-0.01, A(stoveA))); grill.rotation.y = faceIn(A(stoveA)); g.add(grill);
  { const gb = new X.Builder(); gb.box(0.38, 0.32, 0.015, M.ironBlack, 0, 0, 0.006); gb.build(grill); }
  const grillBars = new THREE.Group(); grillBars.position.copy(grill.position); grillBars.rotation.copy(grill.rotation); g.add(grillBars); grillBars.visible = false;
  { const gb = new X.Builder(); for (let k = 0; k < 6; k++) gb.box(0.02, 0.28, 0.02, M.ironBlack, -0.15 + k * 0.06, 0, 0.012); gb.box(0.36, 0.02, 0.02, M.ironBlack, 0, 0.14, 0.012); gb.box(0.36, 0.02, 0.02, M.ironBlack, 0, -0.14, 0.012); gb.build(grillBars); }
  const stoveAt = toWorld(stoveA, stove.r, y, -0.22, 0.45, 0.6);
  ctx.stoveLight = X.addLamp(ctx, stoveAt.x, stoveAt.y, stoveAt.z, { color: 0xff7a30, base: 8, dist: 10, flicker: 0.3, on: () => S.stoveLit });
  interact(grill, {
    prompt: () => S.stoveLit ? null : game.has('matches') ? 'Light the stove' : 'The stove is cold. You need matches.',
    hold: 1.4,
    action: () => {
      if (!game.has('matches')) { game.toast(`You\'ll need <b>matches</b>. The keeper kept a box ${X.placeOf('matches')}.`); return; }
      S.stoveLit = true; fbDoor.visible = true; grill.visible = false; grillBars.visible = true; audio.match(); setTimeout(() => audio.whoosh(), 300);
      game.toast('Kindling catches, then the coal. Warmth spreads through the little kitchen.'); game.refresh();
      audio.addLoop('stove', fbPos.x, fbPos.y, fbPos.z, 0.05, 0.5, (pan) => { audio.burst({ type: 'bandpass', f: 1500 + Math.random() * 3000, q: 2, a: 0.001, d: 0.02 + Math.random() * 0.04, g: 0.15 + Math.random() * 0.25, dest: pan }); if (Math.random() < 0.08) audio.burst({ buf: audio.brown, type: 'lowpass', f: 300, a: 0.2, d: 0.8, g: 0.3, dest: pan }); });
    },
    onHold: () => { if (Math.random() < 0.05) audio.match(); },
  });
  grill.userData.inter.hold = 1.4;
  ctx.onUpdate(() => { grill.userData.inter.hold = game.has('matches') ? 1.4 : 0; });
  {
    const p = toWorld(stoveA, stove.r, y + 0.91, 0.15, 0, -0.05);
    const o = group(p.x, p.y, p.z, faceIn(A(stoveA)));
    const b = new X.Builder();
    b.add(lathe([[0.001, 0], [0.1, 0], [0.12, 0.05], [0.11, 0.12], [0.06, 0.17], [0.03, 0.18], [0.001, 0.19]], 16), M.copper);
    b.cyl(0.012, 0.02, 0.16, M.copper, 0.13, 0.1, 0, 8, 0, 0, -0.9);
    b.add(new THREE.TorusGeometry(0.07, 0.008, 6, 14, Math.PI), M.ironBlack, 0, 0.19, 0);
    b.build(o);
    let brewing = false;
    interact(o, {
      prompt: () => S.tea ? null : !S.stoveLit ? 'A copper kettle, stone cold' : brewing ? null : 'Brew a pot of tea',
      action: () => {
        if (!S.stoveLit) { game.toast('Light the stove first.'); return; }
        brewing = true; game.toast('You set the kettle on the hot plate…');
        setTimeout(() => { audio.kettle(); S.tea = true; game.toast('The kettle sings. A mug of strong, sweet tea. <em>Now</em> you can face the night.', 5); }, 7000);
      },
    });
  }

  // ---- the table in the middle of the room, on a braided rug, with the lamp and the standing orders
  const tx = 0.55, tz = 0.1;
  r.flat(tx, tz, 0, () => F.rugRound(B, M.ragRug, 0, 0, 0, 1.45));
  r.round(tx, tz, 0.62, 0.8, () => F.roundTable(B, M, 0.6, 0.76), { name: 'table' });
  for (const a of [20, 140, 260]) {
    const cxp = tx + Math.cos(A(a)) * 0.82, czp = tz + Math.sin(A(a)) * 0.82;
    r.round(cxp, czp, 0.22, 0.5, () => { }, { name: 'chair', nocheck: true });
    r.flat(cxp, czp, faceTo(cxp, czp, tx, tz), () => F.chair(B, M, M.wood, a === 140 ? X.fab(M, 0x7a3a2a) : null));
  }
  F.tableLamp(ctx, B, tx + 0.15, y + 0.76, tz - 0.2, 4.5);
  B.cyl(0.045, 0.04, 0.1, M.ceramicBlue, tx - 0.25, y + 0.81, tz + 0.1, 12);
  r.flat(tx + 0.12, tz + 0.2, 0.2, () => { B.push(0, 0.77, 0); F.teaTray(B, M); B.pop(); });
  {
    const o = group(tx - 0.05, y + 0.765, tz + 0.22, 0.4);
    const n = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.29), M.paper); n.rotation.x = -Math.PI / 2; n.position.y = 0.003; o.add(n);
    interact(o, { prompt: () => 'Read the standing orders', action: () => { ctx.ui.showNote(ORDERS); audio.wipe(); } });
  }

  // ---- the reading corner: armchair facing the range, a footstool, a side table with a book and a cup, and the cat
  const aA = 148, ar = 1.85, ax = Math.cos(A(aA)) * ar, az = Math.sin(A(aA)) * ar;
  const ary = faceTo(ax, az, Math.cos(A(stoveA)) * 3.4, Math.sin(A(stoveA)) * 3.4);
  r.flat(ax, az, 0, () => F.rugRound(B, M.ragRug2, 0.1, 0, 0.0, 1.05));
  r.free(ax, az, ary, 0.85, 0.8, 1.0, () => F.armchair(B, M, 0x6a2a22), { name: 'armchair' });
  { const fx = ax + Math.sin(ary) * 0.85, fz = az + Math.cos(ary) * 0.85; r.free(fx, fz, ary + 0.3, 0.4, 0.32, 0.25, () => F.footstool(B, M, 0x2f4a5a), { name: 'footstool', nocheck: true }); }
  {
    const sx = ax + Math.cos(ary) * 0.8 - Math.sin(ary) * 0.05, sz = az - Math.sin(ary) * 0.8 - Math.cos(ary) * 0.05;
    r.round(sx, sz, 0.22, 0.56, () => { F.sideTable(B, M); B.push(0, 0.56, 0); B.push(-0.04, 0, 0); const h = F.bookPile(B, M, 3, rnd); B.pop(); B.push(0.07, h > 0 ? 0.0 : 0, 0.04); F.cup(B, M); B.pop(); B.pop(); }, { name: 'side table', nocheck: true });
    F.tableLamp(ctx, B, sx, y + 0.56, sz, 3.2);
  }
  {
    const cat = group(ax, y + 0.56, az, ary + 0.4);
    const cb = new X.Builder();
    cb.add(new THREE.SphereGeometry(0.15, 14, 10), M.fur, 0, 0.08, 0, 0, 0, 0, 1.25, 0.65, 0.95);
    cb.add(new THREE.SphereGeometry(0.075, 12, 10), M.fur, 0.15, 0.11, 0.09);
    cb.add(new THREE.ConeGeometry(0.025, 0.05, 4), M.fur, 0.13, 0.18, 0.13, 0, 0, 0.3); cb.add(new THREE.ConeGeometry(0.025, 0.05, 4), M.fur, 0.19, 0.18, 0.1, 0, 0, -0.3);
    cb.add(new THREE.TorusGeometry(0.13, 0.025, 6, 14, Math.PI * 1.2), M.fur, -0.02, 0.04, 0.02, Math.PI / 2, 0, 1.4);
    cb.build(cat);
    ctx.onUpdate((dt, t) => { cat.scale.y = 1 + Math.sin(t * 1.6) * 0.035; });
    let pets = 0;
    interact(cat, { range: 2.0, prompt: () => 'Stroke Barnacle the cat', action: () => { audio.purr(); pets++; game.toast(['Barnacle opens one eye, and purrs like a distant engine.', 'Barnacle stretches a paw toward the stove. Approval.', 'Barnacle has seen worse storms than this. Barnacle is unconcerned.', 'Purring intensifies.'][Math.min(3, pets - 1)], 3.5); } });
  }

  // ---- things on the walls and ceiling
  r.at(200, W, 1.85, () => F.painting(B, M, 0.7, 0.52, M.painting));
  // bundles of herbs drying from the beam over the table
  for (let i = 0; i < 6; i++) {
    const a = A(67.5 + (i % 2 ? 1.5 : -1.5)), rr = 0.9 + i * 0.38, p = polar(rr, a);
    B.cyl(0.003, 0.003, 0.14, M.rope, p.x, y + 2.41, p.z, 3);
    B.add(new THREE.ConeGeometry(0.045, 0.2, 6), X.fab(M, [0x7a8a4a, 0x8a7a5a, 0x6a7a52][i % 3]), p.x, y + 2.26, p.z, Math.PI);
    B.add(new THREE.SphereGeometry(0.02, 6, 5), M.rope, p.x, y + 2.35, p.z);
  }
}
