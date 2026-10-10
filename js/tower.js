import * as THREE from 'three';
import { Noise2D } from './noise.js';
import { GLSL_NOISE } from './noise.js';
import { Builder, GeoBuilder, ringWall, annularSector, boxGeo, cylGeo, lathe, scaleUV } from './geom.js';
import {
  TAU, DEG, FLOORS, STAIRS, WINDOWS, FLOOR_H, R_IN, TOWER_TOP, CELLAR_Y, LANTERN_Y, LENS_Y, R_GLASS, R_GALLERY, GLASS_TOP,
  WALL_SEGS, DOOR_ANGLE, SECRET_NICHE, LANTERN_DOOR_SIDE, DIRTY_PANES, CAVE, rOutAt, polar, faceIn,
} from './config.js';

const NZ = new Noise2D(4242);
const segA = TAU / WALL_SEGS;
const segOf = (deg, n) => Math.round(deg * DEG / segA - n / 2);
export const HATCH = { x0: -0.2, x1: 1.5, z0: -1.3, z1: -0.3 };

export function stairInfo(i) {
  const st = STAIRS[i];
  const a0 = st.start * DEG, span = st.span * DEG, rise = FLOOR_H / st.steps, d = span / st.steps;
  let kh = 0; while ((kh + 1) * rise < FLOOR_H - 0.3 - 2.05) kh++;
  let kb = 0; while ((kb + 1) * rise - 0.2 < 1.8) kb++;
  return { ...st, a0, a1: a0 + span, span, rise, d, holeA0: a0 + kh * d - 3 * DEG, holeA1: a0 + span, kb };
}

function shapePt(r, a) { return new THREE.Vector2(r * Math.cos(a), -r * Math.sin(a)); }

function slabGeo(rOuter, { notch = null, sector = null, rect = null } = {}, thick = 0.3) {
  const shape = new THREE.Shape();
  const n = 96;
  if (notch) {
    const { a0, a1, r0 } = notch;
    for (let k = 0; k <= n; k++) { const a = a1 + (a0 + TAU - a1) * k / n; const p = shapePt(rOuter, a); k ? shape.lineTo(p.x, p.y) : shape.moveTo(p.x, p.y); }
    for (let k = 0; k <= 24; k++) { const a = a0 + (a1 - a0) * k / 24; const p = shapePt(r0, a); shape.lineTo(p.x, p.y); }
    shape.closePath();
  } else {
    for (let k = 0; k <= n; k++) { const p = shapePt(rOuter, k / n * TAU); k ? shape.lineTo(p.x, p.y) : shape.moveTo(p.x, p.y); }
  }
  if (sector) {
    const h = new THREE.Path(); const { a0, a1, r0, r1 } = sector;
    for (let k = 0; k <= 24; k++) { const p = shapePt(r1, a0 + (a1 - a0) * k / 24); k ? h.lineTo(p.x, p.y) : h.moveTo(p.x, p.y); }
    for (let k = 24; k >= 0; k--) { const p = shapePt(r0, a0 + (a1 - a0) * k / 24); h.lineTo(p.x, p.y); }
    h.closePath(); shape.holes.push(h);
  }
  if (rect) {
    const h = new THREE.Path(); const { x0, x1, z0, z1 } = rect;
    h.moveTo(x0, -z0); h.lineTo(x1, -z0); h.lineTo(x1, -z1); h.lineTo(x0, -z1); h.closePath(); shape.holes.push(h);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 8 });
  g.rotateX(-Math.PI / 2);
  scaleUV(g, 0.5, 0.5);
  return g;
}

export function buildTower(ctx) {
  const { scene, M, col } = ctx;
  const g = new THREE.Group(); g.name = 'tower'; scene.add(g);
  const T = ctx.tower = { panes: [], windows: [] };
  const B = new Builder();
  const mesh = (geo, mat, occl = true, parent = g) => {
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; parent.add(m);
    if (occl) ctx.occluders.push(m); return m;
  };

  // ------------------------------------------------------------ walls
  for (let i = 0; i < FLOORS.length; i++) {
    const y0 = FLOORS[i].y, y1 = i < 4 ? FLOORS[i + 1].y : TOWER_TOP;
    const openings = WINDOWS[i].map(w => ({ s0: segOf(w.a, w.n), n: w.n, yb: y0 + w.yb, yt: y0 + w.yt, kind: 'window', w }));
    if (i === 0) openings.push({ s0: segOf(DOOR_ANGLE, 4), n: 4, yb: y0, yt: y0 + 2.25, kind: 'door' });
    if (i === SECRET_NICHE.floor) openings.push({ s0: segOf(SECRET_NICHE.a, SECRET_NICHE.n), n: SECRET_NICHE.n, yb: y0 + 0.4, yt: y0 + 2.1, kind: 'niche', depth: 0.7 });
    const w = ringWall({ rIn: R_IN, rOutFn: rOutAt, y0, y1, segs: WALL_SEGS, openings });
    if (w.inner) mesh(w.inner, M.plaster);
    if (w.outer) mesh(w.outer, i === 3 ? M.stoneRed : M.stoneWhite);
    if (w.reveal) mesh(w.reveal, M.plaster);
    // interior collision ring (door gap on ground floor)
    const gaps = i === 0 ? [[segOf(DOOR_ANGLE, 4) * segA, (segOf(DOOR_ANGLE, 4) + 4) * segA]] : [];
    col.addRing(0, 0, R_IN, y0 - 0.2, y1, WALL_SEGS, gaps);
    // dado rail
    B.add(new THREE.TorusGeometry(R_IN - 0.015, 0.025, 4, 96), M.woodDark, 0, y0 + 1.1, 0, Math.PI / 2);
    // windows
    for (const o of openings.filter(o => o.kind === 'window')) buildWindow(ctx, B, o, y0, i);
    // exterior string course
    const yc = y1;
    if (i < 4) B.add(lathe([[rOutAt(yc), -0.18], [rOutAt(yc) + 0.1, -0.12], [rOutAt(yc) + 0.13, 0.02], [rOutAt(yc) + 0.08, 0.12], [rOutAt(yc), 0.16]], 96), M.granite, 0, yc, 0);
  }
  // exterior collision at ground level (with door gap)
  const dA0 = segOf(DOOR_ANGLE, 4) * segA, dA1 = dA0 + 4 * segA;
  col.addRing(0, 0, rOutAt(7) + 0.02, 5, 12, 96, [[dA0, dA1]]);
  for (const a of [dA0, dA1]) col.addSeg(Math.cos(a) * R_IN, Math.sin(a) * R_IN, Math.cos(a) * 5.7, Math.sin(a) * 5.7, 6, 9.4);
  // plinth
  B.add(lathe([[5.95, 6.0], [5.95, 6.98], [5.85, 7.03], [5.55, 7.03]], 96), M.granite, 0, 0, 0);
  // cornice at the top of the tower, under the gallery
  B.add(lathe([[rOutAt(TOWER_TOP), TOWER_TOP - 1.2], [rOutAt(TOWER_TOP) + 0.1, TOWER_TOP - 1.0], [rOutAt(TOWER_TOP) + 0.1, TOWER_TOP - 0.7], [5.5, TOWER_TOP - 0.45], [5.95, TOWER_TOP - 0.32], [5.95, TOWER_TOP - 0.28]], 96), M.granite, 0, 0, 0);

  // ------------------------------------------------------------ door
  {
    const rD = 5.25, pA = polar(rD, dA0, 7), pB = polar(rD, dA1, 7);
    const dir = pB.clone().sub(pA), wD = dir.length();
    const hinge = new THREE.Group(); hinge.position.copy(pA);
    const rotClosed = Math.atan2(-dir.z, dir.x);
    hinge.rotation.y = rotClosed;
    const leaf = new THREE.Group(); hinge.add(leaf);
    const DB = new Builder();
    for (let k = 0; k < 6; k++) DB.box(wD / 6 - 0.008, 2.22, 0.07, M.paintGreen, (k + 0.5) * wD / 6, 1.11, 0, 0, 0, 0, 0.8);
    for (const y of [0.35, 1.9]) DB.box(wD - 0.05, 0.06, 0.02, M.ironBlack, wD / 2, y, 0.045);
    DB.add(new THREE.TorusGeometry(0.07, 0.012, 6, 16), M.ironBlack, wD - 0.18, 1.05, 0.06);
    DB.add(new THREE.TorusGeometry(0.07, 0.012, 6, 16), M.ironBlack, wD - 0.18, 1.05, -0.06);
    DB.build(leaf, { name: 'door' });
    g.add(hinge);
    // pick the outward swing
    const test = (ry) => { hinge.rotation.y = ry; hinge.updateMatrixWorld(true); const c = new THREE.Vector3(wD / 2, 1, 0).applyMatrix4(hinge.matrixWorld); return Math.hypot(c.x, c.z); };
    const rotOpen = test(rotClosed + 1.75) > test(rotClosed - 1.75) ? rotClosed + 1.75 : rotClosed - 1.75;
    hinge.rotation.y = rotClosed;
    const seg = col.addSeg(pA.x, pA.z, pB.x, pB.z, 6.5, 9.5);
    T.door = { hinge, leaf, rotClosed, rotOpen, seg, open: false, t: 0 };
    ctx.onUpdate((dt) => {
      const d = T.door; const target = d.open ? 1 : 0;
      d.t += Math.sign(target - d.t) * Math.min(Math.abs(target - d.t), dt * 1.6);
      const e = d.t * d.t * (3 - 2 * d.t);
      d.hinge.rotation.y = rotClosed + (rotOpen - rotClosed) * e;
    });
    // frame & threshold
    const thr = mesh(annularSector(R_IN - 0.1, 5.75, dA0 - 0.01, dA1 + 0.01, 6.9, 7.02, 4, 1.2).geometry(), M.granite); col.addWalk(thr, 'stone');
    // exterior lamp above the door
    const lp = polar(5.75, DOOR_ANGLE * DEG, 9.55);
    B.push(lp.x, lp.y, lp.z, faceIn(DOOR_ANGLE * DEG) + Math.PI);
    B.box(0.06, 0.06, 0.35, M.ironBlack, 0, 0.12, 0.05);
    B.cyl(0.11, 0.08, 0.06, M.ironBlack, 0, 0.0, 0.25, 8);
    B.cyl(0.13, 0.05, 0.12, M.ironBlack, 0, -0.32, 0.25, 8);
    B.pop();
    const lg = new THREE.Mesh(cylGeo(0.09, 0.1, 0.28, 8), M.lampGlass); lg.position.set(lp.x, lp.y - 0.15, lp.z).add(polar(0.25, DOOR_ANGLE * DEG)); g.add(lg);
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), M.flame); fl.position.copy(lg.position); g.add(fl);
    const L = new THREE.PointLight(0xffa858, 9, 14, 2); L.position.copy(lg.position).add(polar(0.15, DOOR_ANGLE * DEG)); g.add(L);
    ctx.lights.push({ light: L, base: 9, flicker: 0.15 });
  }

  // ------------------------------------------------------------ floors & ceilings
  const slabs = [];
  {
    const f0 = mesh(slabGeo(R_IN + 0.04, { rect: HATCH }), M.planks); f0.position.y = FLOORS[0].y - 0.3;
    col.addWalk(f0, 'wood'); slabs.push(f0);
    for (let i = 1; i < FLOORS.length; i++) {
      const s = stairInfo(i - 1);
      const m = mesh(slabGeo(R_IN + 0.04, { notch: { a0: s.holeA0, a1: s.holeA1, r0: s.r0 - 0.05 } }), M.planks);
      m.position.y = FLOORS[i].y - 0.3; col.addWalk(m, 'wood'); slabs.push(m);
      buildBeams(B, M, FLOORS[i].y - 0.3, s.holeA0, s.holeA1, s.r0 - 0.08, 4.0);
    }
    const s4 = stairInfo(4);
    const lf = mesh(slabGeo(R_GLASS + 0.02, { sector: { a0: s4.holeA0, a1: s4.holeA1, r0: s4.r0 - 0.05, r1: s4.r1 + 0.05 } }, 0.3), M.ironBlack);
    lf.position.y = LANTERN_Y - 0.3; col.addWalk(lf, 'metal');
    buildBeams(B, M, LANTERN_Y - 0.3, s4.holeA0, s4.holeA1, s4.r0 - 0.08, s4.r1 + 0.08);
    // gallery deck
    const deck = mesh(annularSector(R_GLASS, R_GALLERY, 0, TAU, LANTERN_Y - 0.3, LANTERN_Y, 64, 1.5).geometry(), M.granite);
    col.addWalk(deck, 'stone');
    for (let k = 0; k < 32; k++) {
      const a = (k + 0.5) / 32 * TAU, p = polar(5.25, a, LANTERN_Y - 0.75);
      B.box(0.22, 0.5, 1.2, M.granite, p.x, p.y, p.z, 0, faceIn(a), 0, 1);
    }
  }

  // ------------------------------------------------------------ spiral stairs
  for (let i = 0; i < STAIRS.length; i++) buildStair(ctx, B, i, g);

  // ------------------------------------------------------------ lantern room
  buildLantern(ctx, B, g);

  // ------------------------------------------------------------ cellar, tunnel & sea cave
  buildCellar(ctx, B, g, mesh);

  B.build(g, { name: 'tower-static' });
  return g;
}

function buildBeams(B, M, yBottom, ha0, ha1, rHole0, rHole1) {
  const inHole = (a) => { const t = ((a - ha0) % TAU + TAU) % TAU; return t < ((ha1 - ha0) % TAU + TAU) % TAU; };
  for (let k = 0; k < 8; k++) {
    const a = (k + 0.5) / 8 * TAU;
    let r0 = 0.35, r1 = 3.96;
    if (inHole(a)) r1 = rHole0;
    const len = r1 - r0, mid = (r0 + r1) / 2, p = polar(mid, a, yBottom - 0.11);
    B.box(0.16, 0.22, len, M.woodDark, p.x, p.y, p.z, 0, faceIn(a), 0, 1.2);
    if (inHole(a) && rHole1 < 3.9) {
      const l2 = 3.96 - rHole1, m2 = (rHole1 + 3.96) / 2, p2 = polar(m2, a, yBottom - 0.11);
      B.box(0.16, 0.22, l2, M.woodDark, p2.x, p2.y, p2.z, 0, faceIn(a), 0, 1.2);
    }
  }
  B.cyl(0.36, 0.36, 0.26, M.woodDark, 0, yBottom - 0.13, 0, 16);
}

function buildWindow(ctx, B, o, y0, floorIdx) {
  const { M, scene } = ctx;
  const ac = (o.s0 + o.n / 2) * segA;
  const yb = o.yb, yt = o.yt, yc = (yb + yt) / 2, h = yt - yb;
  const rg = rOutAt(yc) - 0.2;
  const w = 2 * rg * Math.sin(o.n * segA / 2) - 0.02;
  const p = polar(rg, ac, yc);
  const grp = new THREE.Group(); grp.position.copy(p); grp.rotation.y = faceIn(ac); ctx.scene.add(grp);
  const FB = new Builder();
  const f = 0.08;
  FB.box(w, f, 0.12, M.paintWhite, 0, -h / 2 + f / 2, 0); FB.box(w, f, 0.12, M.paintWhite, 0, h / 2 - f / 2, 0);
  FB.box(f, h, 0.12, M.paintWhite, -w / 2 + f / 2, 0, 0); FB.box(f, h, 0.12, M.paintWhite, w / 2 - f / 2, 0, 0);
  const broken = o.w && o.w.broken;
  const casement = new THREE.Group();
  if (!broken) {
    FB.box(0.04, h - 2 * f, 0.06, M.paintWhite, 0, 0, 0); FB.box(w - 2 * f, 0.04, 0.06, M.paintWhite, 0, h * 0.12, 0);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(w - 2 * f, h - 2 * f), M.glass); grp.add(gl);
  } else {
    // a casement that has blown loose and bangs in the gale
    casement.position.set(-w / 2 + f, 0, 0.04); grp.add(casement);
    const CB = new Builder();
    const cw = w - 2 * f;
    CB.box(cw, 0.05, 0.05, M.paintWhite, cw / 2, -h / 2 + f + 0.03, 0); CB.box(cw, 0.05, 0.05, M.paintWhite, cw / 2, h / 2 - f - 0.03, 0);
    CB.box(0.05, h - 2 * f, 0.05, M.paintWhite, 0.03, 0, 0); CB.box(0.05, h - 2 * f, 0.05, M.paintWhite, cw - 0.03, 0, 0);
    CB.build(casement);
    const shard = new THREE.Shape(); shard.moveTo(0.05, -h / 2 + f + 0.05); shard.lineTo(cw * 0.6, -h / 2 + f + 0.05); shard.lineTo(0.05, 0.1); shard.closePath();
    const sg = new THREE.Mesh(new THREE.ShapeGeometry(shard), M.glass); casement.add(sg);
    ctx.tower.broken = { grp, casement, w, h, ac, p };
  }
  FB.build(grp, { name: 'window' });
  // inner sill board
  const ps = polar(R_IN + 0.1, ac, yb + 0.025);
  B.box(2 * R_IN * Math.sin(o.n * segA / 2) + 0.12, 0.05, 0.4, M.wood, ps.x, ps.y, ps.z, 0, faceIn(ac), 0, 0.8);
  ctx.tower.windows.push({ ac, yb, yt, floor: floorIdx, grp });
}

function buildStair(ctx, B, i, g) {
  const { M, col } = ctx;
  const s = stairInfo(i);
  const y0 = FLOORS[i].y;
  const gb = new GeoBuilder();
  for (let k = 0; k < s.steps; k++) {
    const top = y0 + (k + 1) * s.rise;
    const b0 = s.a0 + k * s.d - 0.012, b1 = s.a0 + (k + 1) * s.d + (k === s.steps - 1 ? 3 * DEG : 0.004);
    annularSector(s.r0, s.r1, b0, b1, top - 0.2, top, 3, 0.8, gb);
  }
  const sm = new THREE.Mesh(gb.geometry(), i === 4 ? M.ironBlack : M.wood);
  sm.castShadow = sm.receiveShadow = true; g.add(sm);
  col.addWalk(sm, i === 4 ? 'metal' : 'wood');
  const freeOuter = s.r1 < R_IN - 0.2;
  // banister(s)
  const sides = freeOuter ? [s.r0 + 0.04, s.r1 - 0.04] : [s.r0 + 0.04];
  for (const r of sides) {
    const rail = [];
    for (let k = 0; k <= s.steps; k++) {
      const a = s.a0 + Math.min(k, s.steps) * s.d, top = y0 + Math.max(1, k) * s.rise;
      if (k % 2 === 0 && k < s.steps) { const p = polar(r, a + s.d / 2, top); B.cyl(0.022, 0.022, 0.95, M.ironBlack, p.x, top + 0.475, p.z, 6); }
      rail.push(polar(r, a, top + 0.95));
    }
    B.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rail), s.steps * 4, 0.03, 6), M.woodDark);
  }
  // collision along the free edges
  for (let k = 0; k < s.steps; k++) {
    const ya = y0 + k * s.rise - 0.2, yb = y0 + (k + 1) * s.rise + 1.0;
    const a = s.a0 + k * s.d, b = a + s.d;
    col.addSeg(Math.cos(a) * s.r0, Math.sin(a) * s.r0, Math.cos(b) * s.r0, Math.sin(b) * s.r0, ya, yb);
    if (freeOuter) col.addSeg(Math.cos(a) * s.r1, Math.sin(a) * s.r1, Math.cos(b) * s.r1, Math.sin(b) * s.r1, ya, yb);
  }
  const ab = s.a0 + s.kb * s.d;
  col.addSeg(Math.cos(ab) * s.r0, Math.sin(ab) * s.r0, Math.cos(ab) * s.r1, Math.sin(ab) * s.r1, y0 - 1, y0 + 0.1);
  // railing round the hole on the floor above
  const yU = i < 4 ? FLOORS[i + 1].y : LANTERN_Y;
  const rails = freeOuter ? [s.r0 - 0.04, s.r1 + 0.04] : [s.r0 - 0.04];
  for (const r of rails) {
    const n = 10, pts = [];
    for (let k = 0; k <= n; k++) {
      const a = s.holeA0 + (s.holeA1 - s.holeA0) * k / n; const p = polar(r, a, yU);
      if (k % 2 === 0) B.cyl(0.022, 0.022, 0.95, M.ironBlack, p.x, yU + 0.475, p.z, 6);
      pts.push(polar(r, a, yU + 0.95));
    }
    B.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.03, 6), M.woodDark);
    col.addArc(0, 0, r, s.holeA0, s.holeA1, yU, yU + 1.1, 10);
  }
  const pa = polar(s.r0 - 0.04, s.holeA0, yU), pb = polar(freeOuter ? s.r1 + 0.04 : R_IN, s.holeA0, yU);
  col.addSeg(pa.x, pa.z, pb.x, pb.z, yU, yU + 1.1);
  for (let k = 0; k <= 3; k++) { const p = pa.clone().lerp(pb, k / 3); B.cyl(0.022, 0.022, 0.95, M.ironBlack, p.x, yU + 0.475, p.z, 6); }
  const mid = pa.clone().add(pb).multiplyScalar(0.5);
  B.box(pa.distanceTo(pb), 0.06, 0.06, M.woodDark, mid.x, yU + 0.95, mid.z, 0, Math.atan2(-(pb.z - pa.z), pb.x - pa.x), 0);
}

function buildLantern(ctx, B, g) {
  const { M, col } = ctx;
  const T = ctx.tower;
  const NS = 16, sideA = TAU / NS, apo = R_GLASS * Math.cos(sideA / 2), sideW = 2 * R_GLASS * Math.sin(sideA / 2);
  const y0 = LANTERN_Y, yP = y0 + 1.0;
  for (let i = 0; i < NS; i++) {
    const ac = (i + 0.5) * sideA, p = polar(apo, ac), ry = faceIn(ac);
    const isDoor = i === LANTERN_DOOR_SIDE;
    if (!isDoor) {
      B.box(sideW, 1.0, 0.06, M.ironRed, p.x, y0 + 0.5, p.z, 0, ry, 0, 1);
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(sideW - 0.06, GLASS_TOP - yP - 0.04), M.glass);
      gl.position.set(p.x, (yP + GLASS_TOP) / 2, p.z); gl.rotation.y = ry; g.add(gl);
      B.box(sideW, 0.06, 0.08, M.ironRed, p.x, yP + 1.35, p.z, 0, ry, 0);
      if (DIRTY_PANES.includes(i)) {
        const sm = new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 1, alphaMap: ctx.T.salt, transparent: true, opacity: 0.95, depthWrite: false });
        const salt = new THREE.Mesh(new THREE.PlaneGeometry(sideW - 0.08, GLASS_TOP - yP - 0.06), sm);
        const ps = polar(apo + 0.03, ac);
        salt.position.set(ps.x, (yP + GLASS_TOP) / 2, ps.z); salt.rotation.y = ry; g.add(salt);
        T.panes.push({ index: i, mesh: salt, mat: sm, dirt: 1, ac });
      }
    } else {
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(sideW - 0.06, GLASS_TOP - (y0 + 2.05)), M.glass);
      gl.position.set(p.x, (y0 + 2.05 + GLASS_TOP) / 2, p.z); gl.rotation.y = ry; g.add(gl);
      B.box(sideW, 0.08, 0.08, M.ironRed, p.x, y0 + 2.04, p.z, 0, ry, 0);
      // door leaf hinged at the side's start corner
      const pA = polar(R_GLASS, i * sideA, y0), pB = polar(R_GLASS, (i + 1) * sideA, y0);
      const dir = pB.clone().sub(pA), wD = dir.length();
      const hinge = new THREE.Group(); hinge.position.copy(pA); const rc = Math.atan2(-dir.z, dir.x); hinge.rotation.y = rc;
      const DB = new Builder();
      DB.box(wD - 0.04, 1.0, 0.05, M.ironRed, wD / 2, 0.5, 0);
      DB.box(0.05, 1.0, 0.05, M.ironRed, 0.03, 1.5, 0); DB.box(0.05, 1.0, 0.05, M.ironRed, wD - 0.05, 1.5, 0); DB.box(wD - 0.04, 0.05, 0.05, M.ironRed, wD / 2, 1.98, 0);
      DB.add(new THREE.TorusGeometry(0.05, 0.01, 6, 12), M.brass, wD - 0.15, 1.0, 0.04);
      DB.build(hinge);
      const glD = new THREE.Mesh(new THREE.PlaneGeometry(wD - 0.1, 0.95), M.glass); glD.position.set(wD / 2, 1.5, 0); hinge.add(glD);
      g.add(hinge);
      const seg = col.addSeg(pA.x, pA.z, pB.x, pB.z, y0, y0 + 2.2);
      const test = (ry) => { hinge.rotation.y = ry; hinge.updateMatrixWorld(true); const c = new THREE.Vector3(wD / 2, 1, 0).applyMatrix4(hinge.matrixWorld); return Math.hypot(c.x, c.z); };
      const ro = test(rc + 1.6) > test(rc - 1.6) ? rc + 1.6 : rc - 1.6; hinge.rotation.y = rc;
      T.lanternDoor = { hinge, seg, open: false, t: 0, rc, ro, ac };
      ctx.onUpdate((dt) => { const d = T.lanternDoor; d.t += Math.sign((d.open ? 1 : 0) - d.t) * Math.min(Math.abs((d.open ? 1 : 0) - d.t), dt * 1.8); hinge.rotation.y = rc + (ro - rc) * d.t * d.t * (3 - 2 * d.t); });
    }
    // astragal bars at corners
    const pc = polar(R_GLASS, i * sideA);
    B.box(0.07, GLASS_TOP - y0 + 0.1, 0.07, M.ironRed, pc.x, (y0 + GLASS_TOP) / 2, pc.z, 0, faceIn(i * sideA), 0);
    if (!isDoor) col.addSeg(Math.cos(i * sideA) * R_GLASS, Math.sin(i * sideA) * R_GLASS, Math.cos((i + 1) * sideA) * R_GLASS, Math.sin((i + 1) * sideA) * R_GLASS, y0 - 0.1, GLASS_TOP);
  }
  B.add(new THREE.TorusGeometry(R_GLASS, 0.06, 6, 16), M.ironRed, 0, GLASS_TOP, 0, Math.PI / 2, 0, 0);
  // roof
  const roofMat = M.copper.clone(); roofMat.side = THREE.DoubleSide;
  B.add(scaleUV(lathe([[3.45, GLASS_TOP - 0.05], [3.4, GLASS_TOP + 0.15], [3.0, GLASS_TOP + 0.45], [2.0, GLASS_TOP + 1.05], [1.0, GLASS_TOP + 1.55], [0.4, GLASS_TOP + 1.8], [0.001, GLASS_TOP + 1.85]], 32), 6, 1.5), roofMat);
  B.add(new THREE.SphereGeometry(0.38, 16, 12), M.copper, 0, GLASS_TOP + 2.15, 0);
  B.cyl(0.03, 0.04, 1.6, M.ironBlack, 0, GLASS_TOP + 3.0, 0, 6);
  B.box(0.9, 0.03, 0.03, M.ironBlack, 0, GLASS_TOP + 3.2, 0); B.box(0.03, 0.03, 0.9, M.ironBlack, 0, GLASS_TOP + 3.2, 0);
  // gallery railing
  const RG = R_GALLERY - 0.1;
  for (let k = 0; k < 40; k++) { const p = polar(RG, k / 40 * TAU); B.cyl(0.025, 0.03, 1.1, M.ironBlack, p.x, y0 + 0.55, p.z, 6); }
  for (const yy of [0.5, 1.08]) B.add(new THREE.TorusGeometry(RG, yy > 1 ? 0.035 : 0.02, 6, 96), M.ironBlack, 0, y0 + yy, 0, Math.PI / 2);
  col.addRing(0, 0, RG - 0.02, y0 - 0.1, y0 + 1.5, 64);

  // lens pedestal & clockwork-driven optic
  B.add(lathe([[0.75, 0], [0.75, 0.08], [0.45, 0.2], [0.38, 0.75], [0.55, 0.9], [0.6, 0.95], [0.001, 0.95]], 24), M.ironGreen, 0, y0, 0);
  col.addCircle(0, 0, 0.78, y0 - 0.1, y0 + 3);
  const lens = new THREE.Group(); lens.position.set(0, LENS_Y, 0); g.add(lens);
  const LB = new Builder();
  LB.cyl(0.85, 0.85, 0.08, M.brass, 0, -0.85, 0, 24); LB.cyl(0.85, 0.85, 0.08, M.brass, 0, 0.85, 0, 24);
  LB.add(lathe([[0.85, 0.85], [0.7, 1.1], [0.35, 1.25], [0.001, 1.28]], 24), M.brass);
  for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; const p = polar(0.86, a); LB.box(0.04, 1.7, 0.04, M.brass, p.x, 0, p.z, 0, faceIn(a), 0); }
  LB.build(lens);
  const lensPanelMat = new THREE.MeshStandardMaterial({ map: ctx.T.lens, color: 0xc8e0e0, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.5, envMap: M.env, envMapIntensity: 1.5, emissive: 0xffd9a0, emissiveMap: ctx.T.lens, emissiveIntensity: 0, side: THREE.DoubleSide, depthWrite: false });
  const apoL = 0.86 * Math.cos(TAU / 16);
  for (let k = 0; k < 8; k++) {
    const a = (k + 0.5) / 8 * TAU; const p = polar(apoL, a);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(2 * 0.86 * Math.sin(TAU / 16), 1.65), lensPanelMat);
    pl.position.copy(p); pl.rotation.y = faceIn(a); lens.add(pl);
  }
  const mantle = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), M.lensGlow); mantle.visible = false; lens.add(mantle);
  const burner = new THREE.Mesh(cylGeo(0.05, 0.07, 0.6, 10), M.brass); burner.position.y = -0.45; lens.add(burner);
  const lampLight = new THREE.PointLight(0xffe2b0, 0, 18, 2); lens.add(lampLight);

  // beams
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uI: { value: 0 }, uFlash: { value: 0 } },
    vertexShader: `varying vec3 vWP; varying vec3 vN; varying float vT; uniform float uLen;
      void main(){ vT = position.y / 260.0 + 0.5; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying vec3 vWP; varying vec3 vN; varying float vT; uniform float uI;
      void main(){ vec3 V = normalize(cameraPosition - vWP); float e = pow(abs(dot(normalize(vN), V)), 2.0);
        float fall = exp(-vT * 4.0) * (1.0 - smoothstep(0.7, 1.0, vT)); float near = smoothstep(0.0, 0.02, vT);
        float camD = length(cameraPosition - vWP); float a = uI * fall * e * near * 0.22 * smoothstep(1.5, 8.0, camD);
        gl_FragColor = vec4(vec3(1.0, 0.93, 0.78) * a, 1.0); }`,
  });
  const beams = [];
  for (const s of [0, Math.PI]) {
    const bg = new THREE.CylinderGeometry(22, 0.55, 260, 32, 1, true);
    const b = new THREE.Mesh(bg, beamMat); b.rotation.z = -Math.PI / 2; b.position.x = 130;
    const holder = new THREE.Group(); holder.rotation.y = s; holder.rotation.z = -0.012; holder.add(b); lens.add(holder);
    b.frustumCulled = false; b.renderOrder = 5;
    beams.push(b);
  }
  const flareMat = new THREE.SpriteMaterial({ map: ctx.T.glow, color: 0xfff0d0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
  const flare = new THREE.Sprite(flareMat); flare.position.set(0, LENS_Y, 0); flare.scale.set(8, 8, 1); flare.renderOrder = 6; g.add(flare);
  T.lens = { group: lens, mantle, lampLight, beamMat, lensPanelMat, flare, flareMat };
}

function buildCellar(ctx, B, g, mesh) {
  const { M, col } = ctx;
  const T = ctx.tower;
  const tunnelOpen = { s0: segOf(270, 6), n: 6, yb: CELLAR_Y, yt: CELLAR_Y + 2.3, kind: 'door' };
  const w = ringWall({ rIn: R_IN, rOutFn: () => 5.6, y0: CELLAR_Y - 0.2, y1: 7.0, segs: WALL_SEGS, openings: [tunnelOpen], noOuter: true, innerTileW: 3, innerTileH: 3 });
  mesh(w.inner, M.cellarRock); mesh(w.reveal, M.cellarRock);
  const ta0 = tunnelOpen.s0 * segA, ta1 = ta0 + 6 * segA;
  col.addRing(0, 0, R_IN, CELLAR_Y - 1, 7.0, WALL_SEGS, [[ta0, ta1]]);
  const fl = mesh(new THREE.CylinderGeometry(R_IN + 0.05, R_IN + 0.05, 0.3, 48), M.flags);
  scaleUV(fl.geometry, 4, 4);
  fl.position.y = CELLAR_Y - 0.15; col.addWalk(fl, 'stone');
  // straight stair under the hatch
  const SB = new Builder();
  const n = 14, rise = (7 - CELLAR_Y) / n, tr = 0.22;
  const sw = HATCH.z1 - HATCH.z0, zc = (HATCH.z0 + HATCH.z1) / 2;
  for (let k = 0; k < n; k++) {
    const top = 7 - (k + 1) * rise, x = HATCH.x1 - (k + 0.5) * tr;
    SB.box(tr + 0.04, 0.06, sw - 0.06, M.wood, x, top - 0.03, zc);
  }
  const sm = SB.build(g, { name: 'cellar-stair' }); sm.forEach(m => col.addWalk(m, 'wood'));
  const run = n * tr, xm = HATCH.x1 - run / 2, slope = Math.atan2(7 - CELLAR_Y, run);
  for (const z of [HATCH.z0 + 0.03, HATCH.z1 - 0.03]) B.box(Math.hypot(run, 7 - CELLAR_Y) + 0.2, 0.22, 0.05, M.woodDark, xm, (7 + CELLAR_Y) / 2 - 0.1, z, 0, 0, -slope);
  col.addSeg(HATCH.x0 - 1.6, HATCH.z0, HATCH.x1, HATCH.z0, CELLAR_Y, 6.95);
  col.addSeg(HATCH.x0 - 1.6, HATCH.z1, HATCH.x1, HATCH.z1, CELLAR_Y, 6.95);
  // rails around hatch opening when it is open
  T.hatchSegs = [col.addSeg(HATCH.x0, HATCH.z0, HATCH.x0, HATCH.z1, 7.0, 8.2), col.addSeg(HATCH.x0, HATCH.z0, HATCH.x1, HATCH.z0, 7.0, 8.2), col.addSeg(HATCH.x0, HATCH.z1, HATCH.x1, HATCH.z1, 7.0, 8.2)];
  T.hatchSegs.forEach(s => (s.on = false));
  // hatch lid
  const lidPivot = new THREE.Group(); lidPivot.position.set((HATCH.x0 + HATCH.x1) / 2, 7.0, HATCH.z0); g.add(lidPivot);
  const lid = new THREE.Mesh(boxGeo(HATCH.x1 - HATCH.x0, 0.06, HATCH.z1 - HATCH.z0, 1.0), M.planks);
  lid.position.set(0, -0.03, (HATCH.z1 - HATCH.z0) / 2); lid.castShadow = lid.receiveShadow = true; lidPivot.add(lid);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 14), M.ironBlack); ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.005, 0.85); lidPivot.add(ring);
  col.addWalk(lid, 'wood');
  T.hatch = { pivot: lidPivot, lid, open: false, t: 0 };
  ctx.onUpdate((dt) => { const h = T.hatch; h.t += Math.sign((h.open ? 1 : 0) - h.t) * Math.min(Math.abs((h.open ? 1 : 0) - h.t), dt * 1.2); h.pivot.rotation.x = -1.75 * h.t * h.t * (3 - 2 * h.t); });

  // ---- tunnel to the sea cave
  const z0 = -R_IN + 0.3, z1 = CAVE.z + CAVE.r - 0.9, hw = 0.8, H = 2.3;
  const yAt = (z) => CELLAR_Y + (CAVE.y - CELLAR_Y) * Math.min(1, Math.max(0, (z0 - z) / (z0 - z1)));
  const tg = new GeoBuilder(); const NZs = 16, NY = 5;
  const jit = (x, y, z) => NZ.noise(x * 1.7 + z * 0.3, y * 1.9 + z * 1.1) * 0.14;
  for (let k = 0; k < NZs; k++) {
    const za = z0 + (z1 - z0) * k / NZs, zb = z0 + (z1 - z0) * (k + 1) / NZs;
    for (const side of [-1, 1]) for (let j = 0; j < NY; j++) {
      const v = (yy, z) => new THREE.Vector3(side * (hw + jit(side, yy, z)), yAt(z) + yy, z);
      const ya = j / NY * H, yb = (j + 1) / NY * H;
      const q = [v(ya, za), v(ya, zb), v(yb, zb), v(yb, za)];
      tg.quad(q, new THREE.Vector3(-side, 0, 0), q.map(p => [p.z / 1.5, p.y / 1.5]));
    }
    const c = (x, z) => new THREE.Vector3(x, yAt(z) + H + jit(x, 5, z) * 1.5, z);
    const cq = [c(-hw, za), c(hw, za), c(hw, zb), c(-hw, zb)];
    tg.quad(cq, new THREE.Vector3(0, -1, 0), cq.map(p => [p.x / 1.5, p.z / 1.5]));
  }
  mesh(tg.geometry(), M.cellarRock);
  const rampGb = new GeoBuilder();
  for (let k = 0; k < NZs; k++) {
    const za = z0 + (z1 - z0) * k / NZs, zb = z0 + (z1 - z0) * (k + 1) / NZs;
    const q = [new THREE.Vector3(-hw, yAt(za), za), new THREE.Vector3(hw, yAt(za), za), new THREE.Vector3(hw, yAt(zb), zb), new THREE.Vector3(-hw, yAt(zb), zb)];
    rampGb.quad(q, new THREE.Vector3(0, 1, 0), q.map(p => [p.x / 2, p.z / 2]));
  }
  const ramp = mesh(rampGb.geometry(), M.flags); col.addWalk(ramp, 'rock');
  col.addSeg(-hw + 0.05, -R_IN - 0.05, -hw + 0.05, z1 - 0.3, 0, 7); col.addSeg(hw - 0.05, -R_IN - 0.05, hw - 0.05, z1 - 0.3, 0, 7);
  T.tunnel = { z0, z1, yAt };

  // ---- sea cave
  const cg = new THREE.SphereGeometry(1, 64, 32, 0, TAU, 0, Math.PI * 0.62);
  const cp = cg.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < cp.count; i++) {
    v.fromBufferAttribute(cp, i);
    const n = 1 + NZ.fbm(v.x * 2.2 + 3, v.z * 2.2 + v.y * 1.4, 4) * 0.17;
    cp.setXYZ(i, v.x * CAVE.r * n, v.y * CAVE.h * n, v.z * CAVE.r * n);
  }
  let cave = cg.toNonIndexed();
  {
    const p = cave.attributes.position, keep = [], uvs = cave.attributes.uv, kuv = [];
    for (let t = 0; t < p.count; t += 3) {
      let cx = 0, cy = 0, cz = 0;
      for (let k = 0; k < 3; k++) { cx += p.getX(t + k) / 3; cy += p.getY(t + k) / 3; cz += p.getZ(t + k) / 3; }
      if (Math.abs(cx) < hw + 0.15 && cz > CAVE.r * 0.45 && cy < H + 0.4) continue;
      for (let k = 0; k < 3; k++) { keep.push(p.getX(t + k), p.getY(t + k), p.getZ(t + k)); kuv.push(uvs.getX(t + k) * 6, uvs.getY(t + k) * 3); }
    }
    cave = new THREE.BufferGeometry();
    cave.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));
    cave.setAttribute('uv', new THREE.Float32BufferAttribute(kuv, 2));
    cave.computeVertexNormals();
  }
  const caveMat = M.cellarRock.clone(); caveMat.side = THREE.BackSide; caveMat.color.set(0xa8a298);
  const cm = mesh(cave, caveMat); cm.position.set(CAVE.x, CAVE.y - 0.35, CAVE.z);
  // cave floor with a tidal pool
  const POOL = { x: CAVE.x + 1.3, z: CAVE.z - 1.2, r: 1.55 };
  const fs = new THREE.Shape(); fs.absarc(0, 0, CAVE.r + 0.3, 0, TAU, false);
  const hole = new THREE.Path(); hole.absarc(POOL.x - CAVE.x, -(POOL.z - CAVE.z), POOL.r, 0, TAU, true); fs.holes.push(hole);
  const fg = new THREE.ShapeGeometry(fs, 40); fg.rotateX(-Math.PI / 2);
  const fp = fg.attributes.position;
  for (let i = 0; i < fp.count; i++) {
    const x = fp.getX(i), z = fp.getZ(i);
    const dp = Math.hypot(x - (POOL.x - CAVE.x), z - (POOL.z - CAVE.z));
    fp.setY(i, NZ.fbm(x * 0.8, z * 0.8, 3) * 0.12 - (dp < POOL.r + 0.3 ? (POOL.r + 0.3 - dp) * 0.25 : 0));
  }
  fg.computeVertexNormals(); scaleUV(fg, 0.4, 0.4);
  const floor = mesh(fg, M.cellarRock); floor.position.set(CAVE.x, CAVE.y, CAVE.z); col.addWalk(floor, 'rock');
  const pb = mesh(new THREE.CircleGeometry(POOL.r + 0.2, 32).rotateX(-Math.PI / 2), M.cellarRock); pb.position.set(POOL.x, CAVE.y - 0.42, POOL.z); col.addWalk(pb, 'water');
  const poolMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `${GLSL_NOISE} uniform float uTime; varying vec2 vP;
      void main(){ float r = length(vP); float n = fbm(vP*2.5 + vec2(uTime*0.15, -uTime*0.1)); float m = fbm(vP*6.0 - uTime*0.3);
        float spark = smoothstep(0.72, 0.85, m) * (0.6 + 0.4*sin(uTime*3.0 + vP.x*9.0));
        vec3 c = vec3(0.02,0.25,0.3) * (0.5 + n) + vec3(0.3,1.6,1.8) * spark;
        float a = 0.88 * (1.0 - smoothstep(1.4, 1.7, r));
        gl_FragColor = vec4(c, a); }`,
  });
  const pool = new THREE.Mesh(new THREE.CircleGeometry(POOL.r + 0.15, 48), poolMat);
  pool.rotation.x = -Math.PI / 2; pool.position.set(POOL.x, CAVE.y - 0.14, POOL.z); g.add(pool);
  const poolLight = new THREE.PointLight(0x40e0e8, 9, 12, 2); poolLight.position.set(POOL.x, CAVE.y + 0.3, POOL.z); g.add(poolLight);
  ctx.lights.push({ light: poolLight, base: 9, flicker: 0.05, zone: 'cave' });
  ctx.onUpdate((dt, t) => { poolMat.uniforms.uTime.value = t; });
  const gaps = [[80 * DEG, 100 * DEG]];
  col.addRing(CAVE.x, CAVE.z, CAVE.r * 0.8, CAVE.y - 2, CAVE.y + 4, 40, gaps);
  T.cave = { POOL };
}
