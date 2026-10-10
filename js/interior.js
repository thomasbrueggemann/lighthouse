import * as THREE from 'three';
import { mulberry32 } from './noise.js';
import { Builder, boxGeo, cylGeo, lathe } from './geom.js';
import { DEG, TAU, FLOORS, R_IN, CELLAR_Y, LANTERN_Y, LENS_Y, R_GLASS, SHED, CAVE, SECRET_NICHE, faceIn, polar, clamp } from './config.js';
import { terrainHeight, JETTY } from './island.js';
import { HATCH } from './tower.js';
import { ORDERS } from './game.js';

const Y = new THREE.Vector3(0, 1, 0);
const A = (d) => d * DEG;
// world position of a local offset on an object standing against the wall at angle aDeg / radius r (local +z faces the axis)
function toWorld(aDeg, r, y, lx = 0, ly = 0, lz = 0) {
  const a = A(aDeg);
  return new THREE.Vector3(lx, ly, lz).applyAxisAngle(Y, faceIn(a)).add(new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a)));
}
const faceTo = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);

// ------------------------------------------------------------------ prop library (front faces +z)
function table(B, M, w, d, h, mat = M.wood) {
  B.box(w, 0.05, d, mat, 0, h - 0.025, 0, 0, 0, 0, 0.8);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box(0.06, h - 0.05, 0.06, mat, sx * (w / 2 - 0.06), (h - 0.05) / 2, sz * (d / 2 - 0.06));
  B.box(w - 0.12, 0.08, 0.025, mat, 0, h - 0.09, d / 2 - 0.06); B.box(w - 0.12, 0.08, 0.025, mat, 0, h - 0.09, -d / 2 + 0.06);
}
function roundTable(B, M, r, h) {
  B.cyl(r, r, 0.045, M.wood, 0, h - 0.022, 0, 28);
  B.add(lathe([[0.25, 0], [0.22, 0.04], [0.06, 0.12], [0.05, 0.5], [0.08, h - 0.15], [0.12, h - 0.05], [0.001, h - 0.05]], 14), M.wood);
}
function chair(B, M, mat = M.wood) {
  B.box(0.44, 0.04, 0.42, mat, 0, 0.46, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box(0.035, 0.46, 0.035, mat, sx * 0.19, 0.23, sz * 0.18);
  for (const sx of [-1, 1]) B.box(0.035, 0.5, 0.035, mat, sx * 0.19, 0.73, -0.19);
  for (const y of [0.62, 0.78, 0.94]) B.box(0.38, 0.05, 0.02, mat, 0, y, -0.19);
}
function barrel(B, M, h = 0.95, r = 0.32) {
  B.add(lathe([[0.001, 0], [r * 0.85, 0], [r, h * 0.5], [r * 0.85, h], [0.001, h]], 18), M.wood);
  for (const t of [0.12, 0.35, 0.65, 0.88]) { const rr = r * (0.85 + 0.15 * Math.sin(Math.PI * t)) + 0.006; B.add(new THREE.TorusGeometry(rr, 0.012, 4, 22), M.ironBlack, 0, h * t, 0, Math.PI / 2); }
}
function crate(B, M, s = 0.6) {
  B.box(s, s, s, M.woodRed, 0, s / 2, 0, 0, 0, 0, 0.6);
  for (const z of [-1, 1]) { B.box(s + 0.02, 0.06, 0.02, M.woodDark, 0, s * 0.15, z * s / 2); B.box(s + 0.02, 0.06, 0.02, M.woodDark, 0, s * 0.85, z * s / 2); B.box(0.06, s, 0.02, M.woodDark, z * (s / 2 - 0.03), s / 2, s / 2); }
}
function shelf(B, M, w, y, d = 0.25) {
  B.box(w, 0.035, d, M.wood, 0, y, d / 2);
  for (const sx of [-1, 1]) B.box(0.03, 0.18, 0.15, M.ironBlack, sx * (w / 2 - 0.1), y - 0.1, 0.08);
}
function jars(B, M, w, y, rnd, n = 6) {
  const mats = [M.ceramic, M.ceramicBlue, M.glassBottle, M.tin, M.ceramic];
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.1 + (w - 0.2) * (i + 0.5) / n, h = 0.12 + rnd() * 0.14, r = 0.04 + rnd() * 0.035;
    B.cyl(r, r, h, mats[Math.floor(rnd() * mats.length)], x, y + h / 2 + 0.02, 0.12, 10);
  }
}
function books(B, M, w, y, rnd, depth = 0.22) {
  let x = -w / 2 + 0.02;
  const pal = [0x5a1e18, 0x1e3a2a, 0x23304a, 0x6a4a20, 0x3a2a1a, 0x7a6a50, 0x4a1a2a, 0x2a2a2a];
  while (x < w / 2 - 0.05) {
    const t = 0.025 + rnd() * 0.04, h = 0.2 + rnd() * 0.1;
    if (rnd() < 0.06) { x += 0.08; continue; }
    const c = new THREE.Color(pal[Math.floor(rnd() * pal.length)]).multiplyScalar(0.8 + rnd() * 0.4);
    const tilt = rnd() < 0.08 ? 0.25 : 0;
    B.box(t, h, depth - rnd() * 0.04, M.books, x + t / 2, y + h / 2 + 0.01, depth / 2 + 0.01, 0, 0, tilt, 0.5, c);
    x += t + 0.003;
  }
}
function bookcase(B, M, w, h, rnd, n = 5) {
  const d = 0.34;
  B.box(w, h, 0.02, M.woodDark, 0, h / 2, 0.01);
  for (const sx of [-1, 1]) B.box(0.04, h, d, M.woodDark, sx * (w / 2 - 0.02), h / 2, d / 2);
  B.box(w, 0.06, d + 0.03, M.woodDark, 0, h - 0.03, d / 2);
  for (let i = 0; i < n; i++) {
    const y = 0.08 + i * (h - 0.15) / n;
    B.box(w - 0.06, 0.03, d - 0.02, M.woodDark, 0, y, d / 2);
    if (i < n) books(B, M, w - 0.12, y + 0.015, rnd, d - 0.06);
  }
}
function wallLamp(ctx, B, aDeg, y, intensity = 6, opts = {}) {
  const { M } = ctx;
  const r = R_IN - 0.01;
  const a = A(aDeg);
  B.push(r * Math.cos(a), y, r * Math.sin(a), faceIn(a));
  B.box(0.1, 0.16, 0.03, M.brass, 0, 0, 0.015);
  B.box(0.02, 0.02, 0.22, M.brass, 0, -0.03, 0.12);
  B.add(lathe([[0.001, -0.02], [0.06, -0.02], [0.075, 0.03], [0.04, 0.07], [0.02, 0.09], [0.001, 0.09]], 14), M.brass, 0, -0.06, 0.25);
  B.cyl(0.012, 0.012, 0.03, M.brass, 0, 0.04, 0.25, 6);
  B.pop();
  const gp = toWorld(aDeg, r, y, 0, 0.14, 0.25);
  const glass = new THREE.Mesh(lathe([[0.03, -0.1], [0.05, -0.05], [0.045, 0.02], [0.025, 0.1], [0.026, 0.13]], 14), M.lampGlass); glass.position.copy(gp); ctx.scene.add(glass);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), M.flame); flame.scale.y = 2; flame.position.copy(gp).add(new THREE.Vector3(0, -0.06, 0)); ctx.scene.add(flame);
  const L = new THREE.PointLight(opts.color ?? 0xffa458, intensity, opts.dist ?? 11, 2);
  L.position.copy(toWorld(aDeg, r, y, 0, 0.1, 0.6)); ctx.scene.add(L);
  ctx.lights.push({ light: L, base: intensity, flicker: 0.1, flame });
  return L;
}
function tableLamp(ctx, B, x, y, z, intensity = 4) {
  const { M } = ctx;
  B.add(lathe([[0.001, 0], [0.08, 0], [0.085, 0.02], [0.05, 0.05], [0.07, 0.12], [0.06, 0.16], [0.02, 0.18], [0.001, 0.18]], 16), M.brass, x, y, z);
  const glass = new THREE.Mesh(lathe([[0.035, 0], [0.06, 0.06], [0.05, 0.12], [0.028, 0.2], [0.03, 0.26]], 14), M.lampGlass); glass.position.set(x, y + 0.18, z); ctx.scene.add(glass);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 6), M.flame); flame.scale.y = 2.2; flame.position.set(x, y + 0.24, z); ctx.scene.add(flame);
  const L = new THREE.PointLight(0xffa860, intensity, 9, 2); L.position.set(x, y + 0.3, z); ctx.scene.add(L);
  ctx.lights.push({ light: L, base: intensity, flicker: 0.1, flame });
  return L;
}
function candle(ctx, B, x, y, z, intensity = 2.2) {
  const { M } = ctx;
  B.cyl(0.07, 0.08, 0.02, M.brass, x, y + 0.01, z, 12); B.cyl(0.022, 0.022, 0.16, M.candle, x, y + 0.1, z, 10);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), M.flame); flame.scale.y = 2.4; flame.position.set(x, y + 0.205, z); ctx.scene.add(flame);
  const L = new THREE.PointLight(0xffa050, intensity, 7, 2); L.position.set(x, y + 0.3, z); ctx.scene.add(L);
  ctx.lights.push({ light: L, base: intensity, flicker: 0.2, flame });
  return L;
}
function painting(B, M, w, h, mat) {
  B.box(w + 0.1, h + 0.1, 0.04, M.woodDark, 0, 0, 0.02);
  B.add(new THREE.PlaneGeometry(w, h), mat, 0, 0, 0.045);
}
function rugAt(B, mat, x, y, z, w, d, ry = 0) { B.add(new THREE.PlaneGeometry(w, d), mat, x, y + 0.008, z, -Math.PI / 2, ry, 0); }
function armchair(B, M, mat) {
  B.box(0.8, 0.4, 0.75, mat, 0, 0.25, 0, 0, 0, 0, 0.5);
  B.box(0.8, 0.65, 0.18, mat, 0, 0.72, -0.3, -0.12, 0, 0, 0.5);
  for (const sx of [-1, 1]) B.box(0.14, 0.25, 0.75, mat, sx * 0.36, 0.55, 0, 0, 0, 0, 0.5);
  B.box(0.6, 0.12, 0.6, mat, 0, 0.5, 0.04, 0, 0, 0, 0.5);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.cyl(0.03, 0.025, 0.06, M.woodDark, sx * 0.34, 0.03, sz * 0.3, 8);
}

// ------------------------------------------------------------------ build all interiors and their interactions
export function buildInterior(ctx) {
  const { scene, M, col, inter, game, audio } = ctx;
  const S = game.S;
  const rnd = mulberry32(2024);
  const g = new THREE.Group(); g.name = 'interior'; scene.add(g);
  const B = new Builder();
  const T = ctx.tower;
  const interact = (obj, opts) => inter.add(obj, opts);
  const group = (x = 0, y = 0, z = 0, ry = 0) => { const o = new THREE.Group(); o.position.set(x, y, z); o.rotation.y = ry; g.add(o); return o; };
  const atWall = (aDeg, r, y, rot = 0) => { const a = A(aDeg); return [r * Math.cos(a), y, r * Math.sin(a), faceIn(a) + rot]; };
  const pushWall = (aDeg, r, y, rot = 0) => { const [x, yy, z, ry] = atWall(aDeg, r, y, rot); B.push(x, yy, z, ry); };
  const colWall = (aDeg, r, w, d, y0, y1, rot = 0) => { const [x, , z, ry] = atWall(aDeg, r, 0, rot); return col.addBox(x, z, w, d, ry, y0, y1); };

  // ================================================================ STORE ROOM (F0)
  {
    const y = FLOORS[0].y;
    wallLamp(ctx, B, 66, y + 2.15, 5);
    // workbench
    pushWall(45, 3.6, y); table(B, M, 1.6, 0.62, 0.9, M.woodDark);
    B.box(1.5, 0.04, 0.5, M.woodDark, 0, 0.25, 0);
    B.box(0.22, 0.12, 0.14, M.ironBlack, 0.6, 0.96, 0.18); B.cyl(0.015, 0.015, 0.3, M.steel, 0.6, 0.96, 0.32, 6, Math.PI / 2);
    shelf(B, M, 1.4, 1.65, 0.24); jars(B, M, 1.3, 1.67, rnd, 7);
    B.box(0.5, 0.3, 0.02, M.woodDark, -0.35, 1.25, 0.01);
    B.box(0.3, 0.03, 0.03, M.steel, -0.4, 1.3, 0.04, 0, 0, 0.4); B.box(0.04, 0.12, 0.03, M.woodDark, -0.52, 1.24, 0.04, 0, 0, 0.4);
    B.box(0.03, 0.25, 0.02, M.steel, -0.2, 1.22, 0.04);
    B.pop();
    colWall(45, 3.6, 1.6, 0.62, y, y + 1.0);
    // toolbox (hammer & nails)
    {
      const p = toWorld(45, 3.6, y + 0.9, -0.3, 0, 0.05);
      const o = group(p.x, p.y, p.z, faceIn(A(45)));
      const b = new Builder();
      b.box(0.45, 0.16, 0.22, M.ironRed, 0, 0.08, 0); b.box(0.02, 0.1, 0.02, M.ironBlack, -0.15, 0.2, 0); b.box(0.02, 0.1, 0.02, M.ironBlack, 0.15, 0.2, 0); b.box(0.32, 0.02, 0.02, M.ironBlack, 0, 0.25, 0);
      const hm = new Builder(); hm.box(0.03, 0.03, 0.28, M.wood, 0.05, 0.18, 0.02, 0, 0.3, 0); hm.box(0.05, 0.05, 0.12, M.steel, 0.05 + Math.sin(0.3) * 0.14, 0.18, 0.02 + Math.cos(0.3) * 0.14, 0, 0.3 + Math.PI / 2, 0);
      b.build(o); const hammerGrp = new THREE.Group(); hm.build(hammerGrp); o.add(hammerGrp);
      interact(o, { prompt: () => game.has('hammer') || S.windowBoarded ? null : 'Take hammer & nails', action: () => { game.give('hammer'); hammerGrp.visible = false; } });
    }
    // barrels of paraffin & water
    for (const a of [322, 337, 352]) { pushWall(a, 3.45, y); barrel(B, M); B.pop(); const [x, , z] = atWall(a, 3.45, 0); col.addCircle(x, z, 0.34, y, y + 1); }
    // coat hooks with oilskins and boots
    pushWall(108, 3.98, y);
    B.box(0.6, 0.06, 0.03, M.woodDark, 0, 1.75, 0.015);
    for (const x of [-0.2, 0.2]) B.cyl(0.012, 0.012, 0.08, M.ironBlack, x, 1.75, 0.06, 6, Math.PI / 2);
    B.add(lathe([[0.001, 0], [0.24, 0], [0.22, 0.4], [0.18, 0.8], [0.14, 0.95], [0.06, 1.0], [0.001, 1.0]], 12), M.oilskin, -0.2, 0.78, 0.17, 0, 0, 0, 1, 1, 0.55);
    B.add(new THREE.SphereGeometry(0.13, 12, 8, 0, TAU, 0, Math.PI / 2), M.oilskin, 0.2, 1.62, 0.12, 0.2);
    B.cyl(0.2, 0.2, 0.01, M.oilskin, 0.2, 1.62, 0.1, 16, 0.2);
    for (const x of [-0.12, 0.08]) { B.box(0.11, 0.38, 0.13, M.black, x, 0.19, 0.25); B.box(0.11, 0.07, 0.28, M.black, x, 0.035, 0.32); }
    B.pop();
    // crates, spare boards, life ring
    pushWall(276, 3.35, y); crate(B, M, 0.62); B.pop(); colWall(276, 3.35, 0.65, 0.65, y, y + 0.7);
    pushWall(276, 3.35, y + 0.62, 0.3); crate(B, M, 0.48); B.pop();
    pushWall(240, 3.45, y); B.add(new THREE.SphereGeometry(0.32, 10, 8), M.cloth(0x8a7a5a), 0, 0.25, 0, 0, 0, 0, 1, 0.8, 0.9); B.pop();
    pushWall(222, 3.45, y); B.add(new THREE.SphereGeometry(0.3, 10, 8), M.cloth(0x7a6a4a), 0, 0.22, 0, 0, 0, 0, 1, 0.75, 0.9); B.pop();
    for (let i = 0; i < 7; i++) { const [x, , z] = atWall(205, 3.4, 0); B.add(new THREE.TorusGeometry(0.3 - i * 0.015, 0.03, 6, 20), M.rope, x, y + 0.03 + i * 0.055, z, Math.PI / 2); }
    pushWall(278, 3.98, y + 1.9); B.add(new THREE.TorusGeometry(0.3, 0.075, 10, 24), M.ironRed, 0, 0, 0.08); for (let k = 0; k < 4; k++) B.add(new THREE.TorusGeometry(0.3, 0.078, 10, 6, Math.PI / 4), M.paintWhite, 0, 0, 0.08, 0, 0, k * Math.PI / 2 + Math.PI / 8); B.pop();
    {
      const [x, , z, ry] = atWall(288, 3.4, y);
      const o = group(x, y, z, ry);
      const b = new Builder(); crate(b, M, 0.58); b.box(0.6, 0.04, 0.6, M.woodRed, 0, 0.6, 0, 0, 0, 0.12); b.build(o);
      col.addBox(x, z, 0.62, 0.62, ry, y, y + 0.7);
      let searched = false;
      interact(o, { prompt: () => searched ? null : 'Search the crate', hold: 1.0, onHold: () => { if (Math.random() < 0.1) audio.wipe(); }, action: () => { searched = true; game.give('belt'); game.toast('Under a nest of straw: a coiled <b>leather drive belt</b>, stamped <em>FOG SIGNAL — SPARE</em>.'); } });
    }
    {
      const [x, , z, ry] = atWall(262, 3.8, y);
      const o = group(x, y, z, ry);
      const b = new Builder(); for (let k = 0; k < 3; k++) b.box(0.22, 1.7, 0.03, M.wood, -0.25 + k * 0.24, 0.84, 0.12 + k * 0.02, -0.12, 0, 0, 0.8); b.build(o);
      interact(o, { prompt: () => game.has('boards') || S.windowBoarded ? null : 'Take spare boards', action: () => { game.give('boards'); o.visible = false; } });
    }
    // rug hiding the trapdoor
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
    // the tower door
    interact(T.door.hinge, {
      prompt: () => T.door.open ? 'Close the door' : 'Open the door',
      action: () => { T.door.open = !T.door.open; T.door.seg.on = !T.door.open; audio.door(); ctx.renderer.shadowMap.needsUpdate = true; },
    });
  }

  // ================================================================ CELLAR
  {
    const y = CELLAR_Y;
    // hanging storm lantern
    B.cyl(0.006, 0.006, 1.0, M.ironBlack, -2.0, 6.2, 1.5, 4);
    B.cyl(0.08, 0.1, 0.05, M.ironBlack, -2.0, 5.6, 1.5, 10); B.cyl(0.1, 0.08, 0.05, M.ironBlack, -2.0, 5.3, 1.5, 10);
    const cl = new THREE.Mesh(cylGeo(0.07, 0.08, 0.24, 10), M.lampGlass); cl.position.set(-2.0, 5.45, 1.5); g.add(cl);
    const cL = new THREE.PointLight(0xffa050, 4, 10, 2); cL.position.set(-2.0, 5.4, 1.5); g.add(cL);
    ctx.lights.push({ light: cL, base: 4, flicker: 0.15 });
    // cistern
    const [cx, , cz] = atWall(48, 2.75, 0);
    B.add(lathe([[0.001, 0], [0.85, 0], [0.92, 0.8], [0.88, 1.6], [0.001, 1.6]], 24), M.woodDark, cx, y, cz);
    for (const t of [0.15, 0.5, 0.85]) B.add(new THREE.TorusGeometry(0.89 + Math.sin(t * Math.PI) * 0.04, 0.015, 4, 30), M.ironBlack, cx, y + t * 1.6, cz, Math.PI / 2);
    B.cyl(0.05, 0.05, 0.3, M.brass, cx + 0.7, y + 0.35, cz + 0.4, 8, Math.PI / 2, 0.5);
    col.addCircle(cx, cz, 0.95, y, y + 2);
    // wine rack & casks
    pushWall(140, 3.75, y);
    B.box(1.4, 1.6, 0.4, M.woodDark, 0, 0.8, 0.0);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) if (rnd() < 0.7) B.cyl(0.04, 0.04, 0.3, M.glassBottle, -0.55 + j * 0.22, 0.25 + i * 0.38, 0.22, 8, Math.PI / 2);
    B.pop(); colWall(140, 3.75, 1.45, 0.5, y, y + 2);
    for (const a of [168, 185]) { pushWall(a, 3.4, y, Math.PI / 2); B.add(lathe([[0.001, 0], [0.32, 0], [0.38, 0.4], [0.32, 0.8], [0.001, 0.8]], 16), M.wood, 0, 0.38, -0.4, Math.PI / 2); B.pop(); const [x, , z] = atWall(a, 3.4, 0); col.addCircle(x, z, 0.42, y, y + 1); }
    // old nets & broken crates
    pushWall(318, 3.4, y); crate(B, M, 0.5); B.pop(); colWall(318, 3.4, 0.55, 0.55, y, y + 0.6);
    pushWall(330, 3.45, y, 0.6); crate(B, M, 0.42); B.pop();
    for (let i = 0; i < 5; i++) { const [x, , z] = atWall(300 + i * 4, 3.6, 0); B.add(new THREE.SphereGeometry(0.25, 8, 6), M.rope, x, y + 0.1, z, 0, 0, 0, 1.4, 0.4, 1.0); }
    // loose stone with the sovereigns
    {
      const [x, , z, ry] = atWall(212, R_IN - 0.02, y + 1.35);
      const o = group(x, y + 1.35, z, ry);
      const st = new THREE.Mesh(boxGeo(0.42, 0.26, 0.12, 0.6), M.cellarRock); st.position.z = 0.04; o.add(st);
      const cav = new THREE.Mesh(boxGeo(0.4, 0.24, 0.02, 0.6), M.black); cav.position.z = -0.01; cav.visible = false; o.add(cav);
      let pulled = false;
      interact(o, { range: 2.2, prompt: () => pulled ? null : 'One stone stands proud of the others. Pull it free', hold: 1.6, onHold: () => { if (Math.random() < 0.15) audio.stoneScrape(); }, action: () => { pulled = true; st.position.set(0.1, -1.2, 0.5); st.rotation.set(0.6, 0.3, 0.2); cav.visible = true; audio.thud(); setTimeout(() => game.findTreasure('sovereigns'), 500); } });
    }
    // boards nailed across the tunnel
    {
      const [x, , z, ry] = atWall(270, R_IN - 0.03, y);
      const o = group(x, y, z, ry);
      const b = new Builder();
      for (let k = 0; k < 5; k++) b.box(1.75, 0.22, 0.04, M.woodDark, (rnd() - 0.5) * 0.1, 0.3 + k * 0.42, 0.0, 0, 0, (rnd() - 0.5) * 0.12, 0.8);
      b.build(o);
      const seg = colWall(270, R_IN - 0.05, 1.8, 0.1, y - 1, y + 2.4);
      interact(o, {
        prompt: () => S.boardsPried ? null : game.has('crowbar') ? 'Pry the boards off with the crowbar' : 'Boards nailed across an opening. A cold draught whistles through…',
        hold: 2.5, onHold: () => { if (Math.random() < 0.12) audio.creak(0.5); },
        action: () => {
          if (!game.has('crowbar')) { game.toast('They\'re nailed fast. You need something to <b>pry</b> them off with. Perhaps the oil store has a tool.'); return; }
          S.boardsPried = true; o.visible = false; seg.forEach(s => (s.on = false)); audio.thud(); audio.thud();
          game.toast('The boards give way. Behind them, a <b>rough tunnel</b> slopes down into the rock, smelling of the sea.');
        },
      });
      // make the boards non-blocking for a no-crowbar hold (needs instant feedback)
      o.userData.inter.hold = 0; // replaced dynamically below
      ctx.onUpdate(() => { o.userData.inter.hold = game.has('crowbar') ? 2.5 : 0; });
    }
  }

  // ================================================================ SEA CAVE
  {
    const y = CAVE.y;
    // smugglers' chest with the spyglass
    {
      const x = CAVE.x - 2.1, z = CAVE.z - 0.6, ry = 1.2;
      const o = group(x, y, z, ry);
      const b = new Builder();
      b.box(0.9, 0.45, 0.55, M.woodDark, 0, 0.25, 0, 0, 0, 0, 0.6);
      for (const sx of [-0.3, 0.3]) b.box(0.05, 0.47, 0.57, M.ironBlack, sx, 0.25, 0);
      b.box(0.08, 0.1, 0.03, M.brass, 0, 0.38, 0.29);
      b.build(o);
      const lid = new THREE.Group(); lid.position.set(0, 0.48, -0.27); o.add(lid);
      const lb = new Builder(); lb.add(new THREE.CylinderGeometry(0.28, 0.28, 0.9, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(Math.PI / 2), M.woodDark, 0, 0, 0.27, 0, 0, 0); lb.build(lid);
      const glass = new THREE.Group(); glass.position.set(0, 0.35, 0); o.add(glass);
      const gb = new Builder(); gb.cyl(0.035, 0.03, 0.5, M.brass, 0, 0, 0, 12, 0, 0, Math.PI / 2); gb.cyl(0.042, 0.042, 0.06, M.brass, 0.25, 0, 0, 12, 0, 0, Math.PI / 2); gb.build(glass); glass.visible = false;
      col.addBox(x, z, 0.95, 0.6, ry, y - 1, y + 0.6);
      let open = false, taken = false;
      interact(o, {
        prompt: () => !open ? 'Open the old sea chest' : !taken ? 'Take the brass spyglass' : null,
        action: () => {
          if (!open) { open = true; audio.creak(0.7); glass.visible = true; const t0 = ctx.time; const u = ctx.onUpdate(() => { lid.rotation.x = -Math.min(1.9, (ctx.time - t0) * 2.5); }); }
          else { taken = true; glass.visible = false; game.findTreasure('spyglass'); }
        },
      });
    }
    // ledge with the journal, and what's left of its writer
    {
      const x = CAVE.x - 0.9, z = CAVE.z - 3.0;
      B.add(new THREE.IcosahedronGeometry(0.55, 1), M.cellarRock, x, y + 0.25, z, 0, 0, 0, 1.3, 0.7, 0.9);
      col.addCircle(x, z, 0.6, y - 1, y + 0.7);
      const o = group(x, y + 0.62, z, 0.4);
      const b = new Builder(); b.box(0.22, 0.05, 0.3, M.leather, 0, 0.025, 0); b.box(0.2, 0.04, 0.28, M.candle, 0.01, 0.03, 0); b.build(o);
      interact(o, { prompt: () => game.treasures.has('journal') ? null : 'A water-stained journal', action: () => { o.visible = false; game.findTreasure('journal'); } });
      B.add(new THREE.SphereGeometry(0.11, 12, 10), M.candle, x + 0.55, y + 0.1, z + 0.45, 0, 0, 0, 1, 0.9, 1.15);
      B.add(new THREE.SphereGeometry(0.06, 8, 6), M.black, x + 0.5, y + 0.12, z + 0.53);
      B.add(new THREE.SphereGeometry(0.06, 8, 6), M.black, x + 0.6, y + 0.12, z + 0.53);
      for (let i = 0; i < 5; i++) B.cyl(0.018, 0.022, 0.35 + rnd() * 0.2, M.candle, x + 0.2 + rnd() * 0.8, y + 0.03, z + 0.6 + rnd() * 0.5, 6, Math.PI / 2, rnd() * 3);
      B.cyl(0.08, 0.1, 0.25, M.ironBlack, x - 0.4, y + 0.12, z + 0.5, 8);
    }
    for (const [x, z] of [[-2.6, -11.7], [-3.2, -12.6]]) { B.add(lathe([[0.001, 0], [0.28, 0], [0.33, 0.35], [0.28, 0.7], [0.001, 0.7]], 14), M.woodDark, x, y, z); col.addCircle(x, z, 0.35, y - 1, y + 1); }
  }

  // ================================================================ KITCHEN (F1)
  {
    const y = FLOORS[1].y;
    // cast-iron range
    const stoveA = 115;
    pushWall(stoveA, 3.55, y);
    B.box(0.95, 0.72, 0.62, M.ironBlack, 0, 0.5, 0); B.box(1.05, 0.04, 0.7, M.ironBlack, 0, 0.88, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box(0.06, 0.14, 0.06, M.ironBlack, sx * 0.42, 0.07, sz * 0.25);
    B.box(0.38, 0.32, 0.02, M.ironBlack, 0.22, 0.5, 0.32); B.box(0.3, 0.025, 0.04, M.brass, 0.22, 0.7, 0.34);
    B.cyl(0.012, 0.012, 1.0, M.brass, 0, 0.83, 0.37, 8, 0, 0, Math.PI / 2);
    for (const x of [-0.25, 0.15]) B.cyl(0.12, 0.12, 0.012, M.ironBlack, x, 0.905, -0.05, 18);
    B.cyl(0.09, 0.09, 1.8, M.ironBlack, -0.25, 1.8, -0.18, 12); B.cyl(0.09, 0.09, 0.45, M.ironBlack, -0.25, 2.65, -0.36, 12, Math.PI / 2);
    B.box(1.3, 0.05, 0.26, M.woodDark, 0.05, 1.55, -0.18);
    B.pop();
    colWall(stoveA, 3.55, 1.05, 0.7, y, y + 1.0);
    const fbPos = toWorld(stoveA, 3.55, y, -0.22, 0.5, 0.315);
    const fbDoor = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.28), M.ember); fbDoor.position.copy(fbPos); fbDoor.rotation.y = faceIn(A(stoveA)); g.add(fbDoor); fbDoor.visible = false;
    const grill = new THREE.Group(); grill.position.copy(fbPos).add(new THREE.Vector3(0, 0, 0).add(polar(-0.01, A(stoveA)))); grill.rotation.y = faceIn(A(stoveA)); g.add(grill);
    { const gb = new Builder(); gb.box(0.38, 0.32, 0.015, M.ironBlack, 0, 0, 0.006); gb.build(grill); }
    const grillBars = new THREE.Group(); grillBars.position.copy(grill.position); grillBars.rotation.copy(grill.rotation); g.add(grillBars); grillBars.visible = false;
    { const gb = new Builder(); for (let k = 0; k < 6; k++) gb.box(0.02, 0.28, 0.02, M.ironBlack, -0.15 + k * 0.06, 0, 0.012); gb.box(0.36, 0.02, 0.02, M.ironBlack, 0, 0.14, 0.012); gb.box(0.36, 0.02, 0.02, M.ironBlack, 0, -0.14, 0.012); gb.build(grillBars); }
    const stoveL = new THREE.PointLight(0xff7a30, 0, 10, 2);
    stoveL.position.copy(toWorld(stoveA, 3.55, y, -0.22, 0.45, 0.6)); g.add(stoveL);
    ctx.lights.push({ light: stoveL, base: 7, flicker: 0.3, on: () => S.stoveLit });
    ctx.stoveLight = stoveL;
    const stoveGrp = group(); stoveGrp.add(grill);
    interact(grill, {
      prompt: () => S.stoveLit ? null : game.has('matches') ? 'Light the stove' : 'The stove is cold. You need matches.',
      hold: 1.4,
      action: () => {
        if (!game.has('matches')) { game.toast('You\'ll need <b>matches</b>. Try the kitchen dresser.'); return; }
        S.stoveLit = true; fbDoor.visible = true; grill.visible = false; grillBars.visible = true; audio.match(); setTimeout(() => audio.whoosh(), 300);
        game.toast('Kindling catches, then the coal. Warmth spreads through the little kitchen.'); game.refresh();
        audio.addLoop('stove', fbPos.x, fbPos.y, fbPos.z, 0.05, 0.5, (pan) => { audio.burst({ type: 'bandpass', f: 1500 + Math.random() * 3000, q: 2, a: 0.001, d: 0.02 + Math.random() * 0.04, g: 0.15 + Math.random() * 0.25, dest: pan }); if (Math.random() < 0.08) audio.burst({ buf: audio.brown, type: 'lowpass', f: 300, a: 0.2, d: 0.8, g: 0.3, dest: pan }); });
      },
      onHold: () => { if (Math.random() < 0.05) audio.match(); },
    });
    grill.userData.inter.hold = 1.4;
    ctx.onUpdate(() => { grill.userData.inter.hold = game.has('matches') ? 1.4 : 0; });
    // kettle
    {
      const p = toWorld(stoveA, 3.55, y + 0.91, 0.15, 0, -0.05);
      const o = group(p.x, p.y, p.z, faceIn(A(stoveA)));
      const b = new Builder();
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
    // dresser with plates and the matches
    pushWall(85, 3.66, y);
    B.box(1.15, 0.85, 0.48, M.paintTeal, 0, 0.425, 0, 0, 0, 0, 0.7);
    B.box(1.2, 0.04, 0.52, M.wood, 0, 0.87, 0);
    for (const x of [-0.28, 0.28]) { B.box(0.5, 0.36, 0.02, M.paintTeal, x, 0.4, 0.245); B.cyl(0.015, 0.015, 0.02, M.brass, x + 0.18 * Math.sign(-x), 0.45, 0.26, 6, Math.PI / 2); }
    B.box(1.15, 1.1, 0.03, M.paintTeal, 0, 1.45, -0.22);
    for (const sx of [-1, 1]) B.box(0.04, 1.1, 0.26, M.paintTeal, sx * 0.555, 1.45, -0.1);
    B.box(1.18, 0.05, 0.3, M.paintTeal, 0, 2.02, -0.09);
    for (const yy of [1.25, 1.62]) {
      B.box(1.1, 0.025, 0.24, M.paintTeal, 0, yy, -0.1);
      for (let k = 0; k < 5; k++) B.cyl(0.11, 0.11, 0.015, k % 2 ? M.ceramicBlue : M.ceramic, -0.4 + k * 0.2, yy + 0.12, -0.17, 20, Math.PI / 2 - 0.15);
    }
    for (let k = 0; k < 4; k++) { B.cyl(0.04, 0.035, 0.09, M.ceramic, -0.4 + k * 0.12, 0.93, 0.05, 10); B.add(new THREE.TorusGeometry(0.025, 0.006, 4, 10), M.ceramic, -0.4 + k * 0.12 + 0.045, 0.93, 0.05); }
    B.pop();
    colWall(85, 3.66, 1.2, 0.52, y, y + 2.1);
    {
      const p = toWorld(85, 3.66, y + 0.89, 0.3, 0, 0.1);
      const o = group(p.x, p.y, p.z, faceIn(A(85)) + 0.3);
      const b = new Builder(); b.box(0.1, 0.03, 0.06, M.paintGreen, 0, 0.015, 0); b.box(0.102, 0.02, 0.062, M.paper, 0, 0.012, 0); b.build(o);
      interact(o, { prompt: () => game.has('matches') ? null : 'Take the box of matches', action: () => { game.give('matches'); o.visible = false; } });
    }
    // wall clock
    pushWall(140, 3.98, y + 2.2);
    B.add(new THREE.CylinderGeometry(0.22, 0.22, 0.07, 28).rotateX(Math.PI / 2), M.woodDark, 0, 0, 0.035);
    B.add(new THREE.CircleGeometry(0.19, 28), M.clockFace, 0, 0, 0.072);
    B.pop();
    const clockP = toWorld(140, 3.98, y + 2.2, 0, 0, 0.075);
    const hands = new THREE.Group(); hands.position.copy(clockP); hands.rotation.y = faceIn(A(140)); g.add(hands);
    const hh = new THREE.Mesh(boxGeo(0.012, 0.1, 0.004), M.black); hh.geometry.translate(0, 0.045, 0);
    const mh = new THREE.Mesh(boxGeo(0.008, 0.15, 0.004), M.black); mh.geometry.translate(0, 0.07, 0.003);
    const hp = new THREE.Group(), mp = new THREE.Group(); hp.add(hh); mp.add(mh); hands.add(hp, mp);
    ctx.onUpdate((dt, t) => { const m = (t / 60 + 22 * 60 + 47) % 720; mp.rotation.z = -m / 60 * TAU; hp.rotation.z = -m / 720 * TAU; });
    // round table with lamp, mugs and the standing orders
    const tA = 300, tR = 1.05, [tx, , tz] = atWall(tA, tR, 0);
    B.push(tx, y, tz); roundTable(B, M, 0.6, 0.76); B.pop();
    col.addCircle(tx, tz, 0.62, y, y + 0.8);
    for (const a of [40, 220]) { const cxp = tx + Math.cos(A(a)) * 0.75, czp = tz + Math.sin(A(a)) * 0.75; B.push(cxp, y, czp, faceTo(cxp, czp, tx, tz)); chair(B, M); B.pop(); col.addCircle(cxp, czp, 0.22, y, y + 0.5); }
    tableLamp(ctx, B, tx + 0.15, y + 0.76, tz - 0.2, 4.5);
    B.cyl(0.045, 0.04, 0.1, M.ceramicBlue, tx - 0.25, y + 0.81, tz + 0.1, 12);
    rugAt(B, M.rug2, tx, y, tz, 2.4, 1.8, 0.3);
    {
      const o = group(tx - 0.05, y + 0.765, tz + 0.22, 0.4);
      const n = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.29), M.paper); n.rotation.x = -Math.PI / 2; n.position.y = 0.003; o.add(n);
      interact(o, { prompt: () => 'Read the standing orders', action: () => { ctx.ui.showNote(ORDERS); audio.wipe(); } });
    }
    // armchair by the stove, with the cat
    const ax = Math.cos(A(150)) * 2.25, az = Math.sin(A(150)) * 2.25;
    const [sx2, , sz2] = atWall(stoveA, 3.2, 0);
    const ary = faceTo(ax, az, sx2, sz2);
    B.push(ax, y, az, ary); armchair(B, M, M.cloth(0x6a2a22)); B.pop();
    col.addBox(ax, az, 0.85, 0.8, ary, y, y + 1.0);
    {
      const cat = group(ax, y + 0.56, az, ary + 0.4);
      const cb = new Builder();
      cb.add(new THREE.SphereGeometry(0.15, 14, 10), M.fur, 0, 0.08, 0, 0, 0, 0, 1.25, 0.65, 0.95);
      cb.add(new THREE.SphereGeometry(0.075, 12, 10), M.fur, 0.15, 0.11, 0.09);
      cb.add(new THREE.ConeGeometry(0.025, 0.05, 4), M.fur, 0.13, 0.18, 0.13, 0, 0, 0.3); cb.add(new THREE.ConeGeometry(0.025, 0.05, 4), M.fur, 0.19, 0.18, 0.1, 0, 0, -0.3);
      cb.add(new THREE.TorusGeometry(0.13, 0.025, 6, 14, Math.PI * 1.2), M.fur, -0.02, 0.04, 0.02, Math.PI / 2, 0, 1.4);
      cb.build(cat);
      ctx.onUpdate((dt, t) => { cat.scale.y = 1 + Math.sin(t * 1.6) * 0.035; });
      let pets = 0;
      interact(cat, { range: 2.0, prompt: () => 'Stroke Barnacle the cat', action: () => { audio.purr(); pets++; game.toast(['Barnacle opens one eye, and purrs like a distant engine.', 'Barnacle stretches a paw toward the stove. Approval.', 'Barnacle has seen worse storms than this. Barnacle is unconcerned.', 'Purring intensifies.'][Math.min(3, pets - 1)], 3.5); } });
    }
    // sink with pump under the window
    pushWall(270, 3.62, y);
    B.box(1.0, 0.82, 0.5, M.paintTeal, 0, 0.41, 0, 0, 0, 0, 0.7);
    B.box(1.05, 0.05, 0.55, M.granite, 0, 0.845, 0);
    B.box(0.5, 0.06, 0.36, M.ceramic, 0.18, 0.9, 0.02);
    B.cyl(0.035, 0.04, 0.35, M.ironGreen, -0.3, 1.04, -0.08, 10); B.cyl(0.015, 0.015, 0.18, M.ironGreen, -0.3, 1.2, 0.02, 6, Math.PI / 2);
    B.box(0.03, 0.03, 0.3, M.ironGreen, -0.3, 1.25, -0.2, -0.5);
    B.pop(); colWall(270, 3.62, 1.05, 0.55, y, y + 1.0);
    // jar shelf
    pushWall(287, 3.98, y + 1.75); shelf(B, M, 0.8, 0, 0.22); jars(B, M, 0.7, 0.02, rnd, 5); B.pop();
    pushWall(200, 3.98, y + 1.9); painting(B, M, 0.7, 0.52, M.painting); B.pop();
    // herbs from the beams
    for (let i = 0; i < 5; i++) { const p = polar(1.6, A(60 + i * 12), y + 3.6); B.cyl(0.003, 0.003, 0.5, M.rope, p.x, y + 3.95, p.z, 3); B.add(new THREE.ConeGeometry(0.06, 0.22, 6), M.cloth(0x4a5a2a), p.x, y + 3.6, p.z, Math.PI); }
  }

  // ================================================================ BEDROOM (F2)
  {
    const y = FLOORS[2].y;
    const bedA = 300;
    pushWall(bedA, 2.95, y);
    B.box(1.2, 0.35, 2.0, M.woodDark, 0, 0.3, 0);
    B.box(1.12, 0.2, 1.92, M.cloth(0xd8d0bc), 0, 0.55, 0);
    B.box(1.18, 0.12, 1.4, M.quilt, 0, 0.66, 0.3);
    B.box(0.9, 0.12, 0.35, M.cloth(0xe8e2d0), 0, 0.7, -0.75);
    B.box(1.25, 1.1, 0.06, M.woodDark, 0, 0.55, -1.0); B.box(1.25, 0.6, 0.06, M.woodDark, 0, 0.3, 1.0);
    for (const sx of [-1, 1]) { B.cyl(0.04, 0.04, 1.2, M.woodDark, sx * 0.62, 0.6, -1.0, 8); B.cyl(0.04, 0.04, 0.7, M.woodDark, sx * 0.62, 0.35, 1.0, 8); }
    B.pop();
    { const [x, , z, ry] = atWall(bedA, 2.95, 0); col.addBox(x, z, 1.25, 2.05, ry, y, y + 0.8); }
    pushWall(323, 3.55, y); table(B, M, 0.45, 0.4, 0.6, M.woodDark); B.box(0.38, 0.12, 0.34, M.woodDark, 0, 0.45, 0.0); B.pop();
    colWall(323, 3.55, 0.45, 0.4, y, y + 0.7);
    { const p = toWorld(323, 3.55, y + 0.6, 0.05, 0, 0); candle(ctx, B, p.x, p.y, p.z, 2.6); }
    // sea chest at the foot of the bed
    pushWall(bedA, 1.55, y); B.box(0.85, 0.45, 0.5, M.paintBlue, 0, 0.225, 0, 0, 0, 0, 0.6); B.add(new THREE.CylinderGeometry(0.25, 0.25, 0.85, 14, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), M.paintBlue, 0, 0.45, 0); for (const sx of [-0.28, 0.28]) B.box(0.05, 0.5, 0.52, M.ironBlack, sx, 0.25, 0); B.pop();
    colWall(bedA, 1.55, 0.88, 0.52, y, y + 0.7);
    // wardrobe
    pushWall(90, 3.62, y); B.box(1.1, 2.0, 0.6, M.woodDark, 0, 1.0, 0, 0, 0, 0, 0.8); B.box(1.18, 0.08, 0.66, M.woodDark, 0, 2.04, 0); B.box(0.01, 1.8, 0.01, M.black, 0, 1.05, 0.301); for (const x of [-0.06, 0.06]) B.cyl(0.012, 0.012, 0.03, M.brass, x, 1.05, 0.31, 6, Math.PI / 2); B.pop();
    colWall(90, 3.62, 1.12, 0.62, y, y + 2.1);
    // washstand & mirror
    pushWall(340, 3.6, y); table(B, M, 0.7, 0.45, 0.8, M.wood); B.add(lathe([[0.001, 0], [0.12, 0.0], [0.2, 0.08], [0.21, 0.1], [0.001, 0.02]], 18), M.ceramic, 0, 0.8, 0); B.add(lathe([[0.001, 0], [0.07, 0], [0.09, 0.08], [0.06, 0.2], [0.07, 0.26], [0.001, 0.26]], 14), M.ceramic, 0.2, 0.8, -0.08); B.box(0.5, 0.6, 0.03, M.woodDark, 0, 1.4, -0.24); B.add(new THREE.PlaneGeometry(0.42, 0.52), M.steel, 0, 1.4, -0.22); B.pop();
    colWall(340, 3.6, 0.7, 0.45, y, y + 0.9);
    rugAt(B, M.rug, Math.cos(A(332)) * 2.2, y, Math.sin(A(332)) * 2.2, 1.5, 0.9, -A(332) + Math.PI / 2);
    pushWall(104, 3.98, y + 1.75); painting(B, M, 0.38, 0.48, M.portrait); B.pop();
    // broken window: banging casement, rain blowing in, puddle
    const bw = T.broken;
    const puddleP = polar(3.2, bw.ac, y + 0.01);
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.6, 24), M.puddle); puddle.rotation.x = -Math.PI / 2; puddle.position.copy(puddleP); puddle.scale.setScalar(0.4); g.add(puddle);
    const boards = new THREE.Group(); boards.position.copy(polar(R_IN + 0.04, bw.ac, (bw.grp.position.y))); boards.rotation.y = faceIn(bw.ac); boards.visible = false; g.add(boards);
    { const bb = new Builder(); for (let k = 0; k < 3; k++) bb.box(1.3, 0.2, 0.04, M.wood, 0, -0.45 + k * 0.45, 0, 0, 0, (k - 1) * 0.08, 0.8); bb.build(boards); }
    let bangT = 0, ang = 0, angV = 0;
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
    // loose floorboard
    {
      const p = polar(1.45, A(28), y);
      const o = group(p.x, y, p.z, -A(28));
      const pl = new THREE.Mesh(boxGeo(1.0, 0.03, 0.24, 1), M.planks); pl.position.y = 0.012; pl.rotation.z = 0.012; o.add(pl);
      const hole = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.2), M.black); hole.rotation.x = -Math.PI / 2; hole.position.y = 0.004; hole.visible = false; o.add(hole);
      let hinted = false, lastCreak = 0;
      ctx.onUpdate((dt, t) => {
        const pp = ctx.player.pos;
        if (Math.abs(pp.y - y) < 0.3 && Math.hypot(pp.x - p.x, pp.z - p.z) < 0.55 && !S.floorboardPried && t - lastCreak > 1.6) {
          lastCreak = t; audio.creak(0.7);
          if (!hinted) { hinted = true; game.toast('The board under your boot gives a hollow creak.', 3); }
        }
      });
      interact(o, { range: 2.2, prompt: () => S.floorboardPried ? null : hinted ? 'Lift the creaking floorboard' : null, hold: 1.2, action: () => { S.floorboardPried = true; pl.position.set(0.3, 0.05, 0.25); pl.rotation.set(0, 0.5, 0.1); hole.visible = true; audio.creak(0.8); setTimeout(() => game.findTreasure('watch'), 400); } });
    }
  }

  // ================================================================ STUDY (F3)
  {
    const y = FLOORS[3].y;
    // desk
    pushWall(105, 3.42, y);
    table(B, M, 1.4, 0.7, 0.78, M.woodDark);
    B.box(0.4, 0.55, 0.62, M.woodDark, 0.48, 0.45, 0); for (let k = 0; k < 3; k++) { B.box(0.36, 0.15, 0.01, M.woodDark, 0.48, 0.25 + k * 0.18, 0.315); B.cyl(0.012, 0.012, 0.02, M.brass, 0.48, 0.25 + k * 0.18, 0.325, 6, Math.PI / 2); }
    B.cyl(0.035, 0.04, 0.05, M.glassBottle, -0.45, 0.805, -0.1, 10); B.box(0.005, 0.005, 0.2, M.black, -0.4, 0.8, 0.0, 0.3, 0.6, 0);
    for (let k = 0; k < 4; k++) B.box(0.2, 0.003, 0.28, M.paper, -0.5 + rnd() * 0.1, 0.782 + k * 0.003, 0.12, 0, rnd() - 0.5, 0);
    B.pop();
    colWall(105, 3.42, 1.42, 0.72, y, y + 0.85);
    { const p = toWorld(105, 3.42, y + 0.78, 0.48, 0, -0.1); tableLamp(ctx, B, p.x, p.y, p.z, 4.5); }
    { const [x, , z] = atWall(105, 2.75, 0); B.push(x, y, z, faceIn(A(105)) + Math.PI); chair(B, M, M.woodDark); B.pop(); col.addCircle(x, z, 0.22, y, y + 0.5); }
    // journal on the desk
    {
      const p = toWorld(105, 3.42, y + 0.785, 0.0, 0, 0.05);
      const o = group(p.x, p.y, p.z, faceIn(A(105)));
      const b = new Builder(); b.box(0.5, 0.035, 0.33, M.leather, 0, 0.015, 0); b.build(o);
      const pg = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.31), M.logbook); pg.rotation.x = -Math.PI / 2; pg.position.y = 0.034; o.add(pg);
      interact(o, {
        prompt: () => S.logWritten ? 'Read your entry for tonight' : S.shipState === 'passed' ? (S.baroRead ? 'Write tonight\'s entry in the journal' : 'Write the journal (read the barometer first)') : 'The keeper\'s journal',
        hold: 0, action: () => {
          if (S.shipState !== 'passed') { ctx.ui.showNote(`<h2>Skerryhead Light — Journal</h2><p><em>The last entry, in your predecessor's careful hand:</em></p><p>"Oct. 3rd. Wind SW, fresh. All lamps in order. The cat has taken the good chair again. Barometer falling. Relief due on the 10th."</p><p class="sig">You'll write tonight's entry when the watch is done.</p>`); return; }
          if (!S.baroRead) { game.toast('A proper entry needs the barometer reading. It hangs on the study wall.'); return; }
          if (!S.logWritten) { S.logWritten = true; game.refresh(); ctx.onLogWritten(); }
          ctx.ui.showNote(logEntry(game));
        },
      });
    }
    // radio
    pushWall(64, 3.62, y);
    B.box(0.6, 0.85, 0.42, M.woodDark, 0, 0.425, 0); B.box(0.55, 0.5, 0.4, M.wood, 0, 1.12, -0.01);
    B.add(new THREE.PlaneGeometry(0.4, 0.2), M.radioFace, 0, 1.22, 0.195);
    for (const x of [-0.15, 0, 0.15]) B.cyl(0.035, 0.035, 0.03, M.black, x, 1.0, 0.2, 12, Math.PI / 2);
    B.cyl(0.006, 0.006, 0.7, M.brass, 0.18, 1.7, -0.1, 4);
    B.pop(); colWall(64, 3.62, 0.62, 0.45, y, y + 1.4);
    {
      const p = toWorld(64, 3.62, y + 1.1, 0, 0, 0.22);
      const o = group(p.x, p.y, p.z, faceIn(A(64)));
      const hit = new THREE.Mesh(boxGeo(0.56, 0.55, 0.05), new THREE.MeshBasicMaterial({ visible: false })); o.add(hit);
      ctx.onUpdate((dt, t) => { const on = S.radioCalling && !S.radioAnswered; M.radioFace.emissive.setRGB(on ? 0.8 + Math.sin(t * 8) * 0.3 : 0.25, on ? 0.5 : 0.15, 0.05); });
      interact(o, {
        prompt: () => S.radioCalling && !S.radioAnswered ? 'Answer the wireless' : 'Listen to the wireless',
        action: () => {
          if (!(S.radioCalling && !S.radioAnswered)) { audio.radioBurst(2); game.toast('Nothing but static and the moan of the gale in the aerial.'); return; }
          S.radioAnswered = true; S.shipState = 'approach'; game.refresh();
          game.radio([
            ['SS Aurora', 'Skerryhead Light, Skerryhead Light, this is the steamer Aurora. Do you read? Over.', 4.5],
            ['You', 'Aurora, Skerryhead. Reading you. Go ahead.', 3],
            ['SS Aurora', "We've lost our bearings in this muck and our compass is playing up. We're making for the Sound.", 4.5],
            ['SS Aurora', "We'll need your light turning bright and your fog signal sounding to clear the reef. Over.", 4.5],
            ['You', "Understood, Aurora. Keep her well to the south. I'll keep the light.", 3.5],
          ]);
        },
      });
    }
    // bookcases: an ordinary one, and the secret one
    pushWall(125, 3.68, y); bookcase(B, M, 0.95, 2.2, rnd); B.pop(); colWall(125, 3.68, 0.95, 0.4, y, y + 2.3);
    {
      const a = A(SECRET_NICHE.a);
      const base = polar(3.72, a, y);
      const o = group(base.x, y, base.z, faceIn(a));
      const b = new Builder(); bookcase(b, M, 1.1, 2.25, mulberry32(77)); b.build(o);
      const redBook = new THREE.Mesh(boxGeo(0.045, 0.27, 0.24, 0.4), new THREE.MeshStandardMaterial({ color: 0x8a1010, roughness: 0.5 })); redBook.position.set(0.3, 0.08 + 3 * (2.25 - 0.15) / 5 + 0.15, 0.17); o.add(redBook);
      const segs = col.addBox(base.x, base.z, 1.1, 0.4, faceIn(a), y, y + 2.3);
      const slideDir = new THREE.Vector3(1, 0, 0).applyAxisAngle(Y, faceIn(a)).multiplyScalar(-1);
      let t0 = null;
      interact(redBook, {
        range: 2.2, prompt: () => S.secretOpen ? null : 'One red book sits a little proud. Pull it',
        action: () => {
          S.secretOpen = true; redBook.rotation.x = -0.4; audio.click(); setTimeout(() => audio.stoneScrape(), 300);
          t0 = ctx.time; segs.forEach(s => (s.on = false));
          const np = base.clone().addScaledVector(slideDir, 1.15);
          col.addBox(np.x, np.z, 1.1, 0.4, faceIn(a), y, y + 2.3);
          game.toast('With a click and a grinding of stone, the bookcase swings aside, revealing a <b>hidden alcove</b>.', 5);
        },
      });
      ctx.onUpdate(() => { if (t0 === null) return; const k = Math.min(1, (ctx.time - t0) / 2.2); const e = k * k * (3 - 2 * k); o.position.copy(base).addScaledVector(slideDir, 1.15 * e); });
      // alcove contents: a ship in a bottle on a little stand
      const np = polar(R_IN + 0.35, a, y + 1.0);
      B.box(0.9, 0.04, 0.5, M.woodDark, np.x, np.y, np.z, 0, faceIn(a), 0);
      const sh = group(np.x, np.y + 0.02, np.z, faceIn(a) + Math.PI / 2);
      const sb = new Builder();
      sb.add(lathe([[0.001, 0], [0.08, 0], [0.085, 0.02], [0.085, 0.3], [0.05, 0.36], [0.025, 0.4], [0.025, 0.45], [0.001, 0.45]], 16), M.glassBottle, 0, 0.09, 0, 0, 0, Math.PI / 2);
      sb.box(0.25, 0.03, 0.03, M.woodDark, -0.1, 0.03, 0.04); sb.box(0.25, 0.03, 0.03, M.woodDark, -0.1, 0.03, -0.04);
      sb.box(0.22, 0.04, 0.05, M.woodDark, -0.22, 0.08, 0); sb.box(0.004, 0.12, 0.004, M.woodDark, -0.2, 0.15, 0); sb.box(0.004, 0.1, 0.004, M.woodDark, -0.27, 0.14, 0);
      sb.box(0.003, 0.08, 0.05, M.paintWhite, -0.2, 0.15, 0); sb.cyl(0.02, 0.02, 0.03, M.cork, 0.33, 0.09, 0, 8, 0, 0, Math.PI / 2);
      sb.build(sh);
      interact(sh, { range: 2.4, prompt: () => !S.secretOpen || game.treasures.has('bottleShip') ? null : 'Take the ship in the bottle', action: () => { sh.visible = false; game.findTreasure('bottleShip'); } });
    }
    // barometer
    pushWall(160, 3.98, y + 1.6);
    B.add(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 28).rotateX(Math.PI / 2), M.woodDark, 0, 0, 0.025);
    B.add(new THREE.TorusGeometry(0.15, 0.015, 6, 28), M.brass, 0, 0, 0.055);
    B.add(new THREE.CircleGeometry(0.14, 28), M.baroFace, 0, 0, 0.056);
    B.pop();
    {
      const p = toWorld(160, 3.98, y + 1.6, 0, 0, 0.06);
      const o = group(p.x, p.y, p.z, faceIn(A(160)));
      const needle = new THREE.Mesh(boxGeo(0.006, 0.12, 0.004), M.black); needle.geometry.translate(0, 0.05, 0); needle.rotation.z = 1.6; o.add(needle);
      const hit = new THREE.Mesh(new THREE.CircleGeometry(0.17, 12), new THREE.MeshBasicMaterial({ visible: false })); o.add(hit);
      interact(o, { prompt: () => 'Tap the barometer', action: () => { audio.click(); needle.rotation.z = 1.75; setTimeout(() => (needle.rotation.z = 1.85), 150); S.baroRead = true; game.refresh(); game.toast('<b>28.3 inches</b> and still falling. The needle quivers at STORMY.'); } });
      ctx.onUpdate((dt, t) => { if (!S.baroRead) needle.rotation.z = 1.6 + Math.sin(t * 0.3) * 0.01; });
    }
    // chart table
    const [chx, , chz] = atWall(210, 1.25, 0);
    const chr = -A(210);
    B.push(chx, y, chz, chr); table(B, M, 1.2, 0.8, 0.95, M.woodDark); B.pop();
    col.addBox(chx, chz, 1.2, 0.8, chr, y, y + 1);
    {
      const o = group(chx, y + 0.952, chz, chr);
      const c = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.72), M.chart); c.rotation.x = -Math.PI / 2; o.add(c);
      const b = new Builder(); b.box(0.02, 0.02, 0.18, M.brass, 0.2, 0.01, 0.1, 0, 0.4, 0); b.box(0.02, 0.02, 0.18, M.brass, 0.25, 0.01, 0.1, 0, 0.7, 0); b.build(o);
      interact(o, { prompt: () => 'Study the chart', action: () => ctx.ui.showNote(`<h2>Skerry Sound & Approaches</h2><p>Soundings in fathoms. Skerryhead light: <b>two white flashes every twenty seconds</b>, visible eighteen miles. Fog signal: one blast every thirty seconds.</p><p>A dotted red line marks the safe passage south of the reef. In pencil, in the margin, someone has written: <em>"Cave below N. face. Count the stones from the cistern: twelve paces, then down."</em></p>`) });
    }
    // globe, telescope, armchair
    { const [x, , z] = atWall(298, 1.65, 0); B.add(lathe([[0.2, 0], [0.18, 0.03], [0.04, 0.08], [0.03, 0.75], [0.001, 0.75]], 12), M.woodDark, x, y, z); B.add(new THREE.SphereGeometry(0.24, 24, 16), M.chart, x, y + 0.98, z, 0.4, 0.5, 0.3); B.add(new THREE.TorusGeometry(0.27, 0.01, 6, 32), M.brass, x, y + 0.98, z, 0, 0.2, 0.4); col.addCircle(x, z, 0.25, y, y + 1.3); }
    { const [x, , z, ry] = atWall(262.5, 3.15, 0); B.push(x, y, z, ry + Math.PI); for (let k = 0; k < 3; k++) B.cyl(0.015, 0.015, 1.25, M.woodDark, Math.cos(k * 2.1) * 0.25, 0.6, Math.sin(k * 2.1) * 0.25, 6, Math.sin(k * 2.1) * 0.22, 0, -Math.cos(k * 2.1) * 0.22); B.cyl(0.045, 0.03, 0.9, M.brass, 0, 1.25, 0.1, 12, Math.PI / 2 - 0.15); B.pop(); col.addCircle(x, z, 0.3, y, y + 1.4); }
    { const [x, , z] = atWall(282, 2.4, 0); const ry = faceTo(x, z, 0, 0); B.push(x, y, z, ry); armchair(B, M, M.cloth(0x2a3a4a)); B.pop(); col.addBox(x, z, 0.85, 0.8, ry, y, y + 1.0); }
    pushWall(276, 3.98, y + 1.8); painting(B, M, 0.36, 0.45, M.portrait); B.pop();
    rugAt(B, M.rug, Math.cos(A(150)) * 1.2, y, Math.sin(A(150)) * 1.2, 2.2, 1.4, -A(150));
  }

  // ================================================================ WATCH ROOM (F4)
  {
    const y = FLOORS[4].y;
    // clockwork column
    B.cyl(0.32, 0.32, 4.2, M.ironGreen, 0, y + 2.1, 0, 20);
    B.cyl(0.42, 0.42, 0.1, M.ironGreen, 0, y + 0.05, 0, 20);
    col.addCircle(0, 0, 0.62, y, y + 4.5);
    const gears = [];
    const gearGeo = (r, teeth, th) => {
      const s = new THREE.Shape();
      for (let i = 0; i < teeth * 2; i++) { const a0 = i / (teeth * 2) * TAU, a1 = (i + 1) / (teeth * 2) * TAU, rr = i % 2 ? r : r + 0.03; s.lineTo(Math.cos(a0) * rr, Math.sin(a0) * rr); s.lineTo(Math.cos(a1) * rr, Math.sin(a1) * rr); }
      const hole = new THREE.Path(); hole.absarc(0, 0, r * 0.25, 0, TAU, true); s.holes.push(hole);
      return new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: false, curveSegments: 4 });
    };
    const mech = group(0, y, 0);
    const mb = new Builder();
    mb.box(0.9, 0.9, 0.08, M.ironGreen, 0.0, 1.1, 0.38); mb.box(0.9, 0.9, 0.08, M.ironGreen, 0.0, 1.1, -0.38);
    mb.build(mech);
    for (const [x, yy, r, n, sp] of [[-0.18, 1.25, 0.24, 24, 1], [0.2, 1.0, 0.16, 16, -1.5], [0.22, 1.42, 0.1, 10, 2.4]]) {
      const gm = new THREE.Mesh(gearGeo(r, n, 0.04), M.brass); gm.position.set(x, yy, 0.42); mech.add(gm); gears.push([gm, sp]);
      const gm2 = new THREE.Mesh(gearGeo(r * 0.8, Math.floor(n * 0.8), 0.04), M.brass); gm2.position.set(-x, yy, -0.46); mech.add(gm2); gears.push([gm2, -sp]);
    }
    const gov = new THREE.Group(); gov.position.set(0, 1.85, 0.42); mech.add(gov);
    for (const s of [-1, 1]) { const ball = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), M.brass); ball.position.set(s * 0.12, -0.08, 0); gov.add(ball); const arm = new THREE.Mesh(cylGeo(0.006, 0.006, 0.15, 4), M.steel); arm.position.set(s * 0.06, -0.04, 0); arm.rotation.z = s * 1.0; gov.add(arm); }
    const crank = new THREE.Group(); crank.position.set(0.47, 1.1, 0.0); mech.add(crank);
    { const cb = new Builder(); cb.cyl(0.03, 0.03, 0.12, M.steel, 0.06, 0, 0, 8, 0, 0, Math.PI / 2); cb.box(0.03, 0.3, 0.04, M.ironBlack, 0.12, -0.13, 0); cb.cyl(0.025, 0.025, 0.14, M.woodDark, 0.19, -0.26, 0, 8, 0, 0, Math.PI / 2); cb.build(crank); }
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
    // paraffin reservoir & pressure pump
    const tankA = 300;
    pushWall(tankA, 3.45, y);
    B.box(1.2, 0.08, 0.5, M.ironGreen, 0, 0.5, 0); for (const sx of [-1, 1]) B.box(0.06, 0.5, 0.45, M.ironGreen, sx * 0.5, 0.25, 0);
    B.cyl(0.28, 0.28, 1.1, M.brass, 0, 0.82, 0, 24, 0, 0, Math.PI / 2);
    for (const sx of [-1, 1]) B.cyl(0.29, 0.29, 0.03, M.brass, sx * 0.4, 0.82, 0, 24, 0, 0, Math.PI / 2);
    B.cyl(0.05, 0.05, 0.12, M.brass, -0.3, 1.14, 0, 10);
    B.cyl(0.015, 0.015, 3.6, M.brass, 0.4, 2.6, -0.15, 6);
    B.cyl(0.04, 0.05, 0.6, M.ironBlack, 0.7, 0.3, 0.05, 10);
    B.add(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 24).rotateX(Math.PI / 2), M.brass, 0.15, 1.25, 0.08);
    B.add(new THREE.CircleGeometry(0.1, 24), M.gaugeFace, 0.15, 1.25, 0.101);
    B.box(0.03, 0.18, 0.03, M.brass, 0.15, 1.12, 0.05);
    B.pop();
    colWall(tankA, 3.45, 1.4, 0.6, y, y + 1.3);
    const gp = toWorld(tankA, 3.45, y + 1.25, 0.15, 0, 0.105);
    const gN = new THREE.Group(); gN.position.copy(gp); gN.rotation.y = faceIn(A(tankA)); g.add(gN);
    const needle = new THREE.Mesh(boxGeo(0.005, 0.085, 0.003), new THREE.MeshBasicMaterial({ color: 0x111111 })); needle.geometry.translate(0, 0.035, 0); gN.add(needle);
    ctx.onUpdate(() => { needle.rotation.z = 2.36 - S.pressure * 3.9 + (S.fuel > 0 ? 0 : 0); });
    {
      const p = toWorld(tankA, 3.45, y + 0.82, -0.25, 0, 0.3);
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
      const p = toWorld(tankA, 3.45, y, 0.7, 0.62, 0.05);
      const lever = new THREE.Group(); lever.position.copy(p); lever.rotation.y = faceIn(A(tankA)); g.add(lever);
      const lb = new Builder(); lb.cyl(0.018, 0.018, 0.3, M.steel, 0, 0.12, 0, 6); lb.cyl(0.03, 0.03, 0.18, M.woodDark, 0, 0.27, 0, 8, 0, 0, Math.PI / 2); lb.build(lever);
      interact(lever, {
        prompt: () => !S.fuelFilled ? null : S.pressure > 0.98 ? null : 'Pump up the pressure',
        hold: 3.0, onHold: (dt, pr) => { lever.position.y = p.y + Math.abs(Math.sin(pr * 18)) * -0.15; S.pressure = Math.min(1, S.pressure + dt / 3); if (Math.random() < 0.1) audio.pump(); },
        action: () => { S.pressure = 1; lever.position.y = p.y; game.refresh(); game.toast('The needle stands in the red. Ready to light the lamp above.'); },
      });
    }
    // bench with rag
    pushWall(140, 3.55, y); table(B, M, 1.2, 0.55, 0.85, M.woodDark); for (let k = 0; k < 4; k++) B.box(0.1, 0.06, 0.1, M.cloth(0xe8e0c8), -0.4 + k * 0.12, 0.88, -0.1); B.box(0.25, 0.18, 0.18, M.tin, 0.35, 0.94, -0.05); B.pop();
    colWall(140, 3.55, 1.2, 0.55, y, y + 0.9);
    {
      const p = toWorld(140, 3.55, y + 0.85, 0.05, 0, 0.12);
      const o = group(p.x, p.y, p.z, 0.4);
      o.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6).scale(1.3, 0.3, 1), M.cloth(0xd8d0b0)));
      interact(o, { prompt: () => game.has('rag') ? null : 'Take the cleaning rag', action: () => { game.give('rag'); o.visible = false; } });
    }
    pushWall(220, 3.55, y); table(B, M, 0.9, 0.5, 0.75, M.wood); B.box(0.3, 0.03, 0.22, M.leather, 0, 0.765, 0); B.pop();
    colWall(220, 3.55, 0.9, 0.5, y, y + 0.8);
    // hanging lamp
    { const p = polar(1.5, A(20)); B.cyl(0.006, 0.006, 0.8, M.ironBlack, p.x, y + 3.8, p.z, 4); B.cyl(0.12, 0.05, 0.08, M.ironBlack, p.x, y + 3.35, p.z, 10); const gl = new THREE.Mesh(cylGeo(0.06, 0.08, 0.18, 10), M.lampGlass); gl.position.set(p.x, y + 3.22, p.z); g.add(gl); const L = new THREE.PointLight(0xffa860, 5, 9, 2); L.position.set(p.x, y + 3.15, p.z); g.add(L); ctx.lights.push({ light: L, base: 5, flicker: 0.1 }); }
  }

  // ================================================================ LANTERN ROOM & GALLERY
  {
    const lens = T.lens;
    const burnerHit = new THREE.Group(); burnerHit.position.set(0, LENS_Y - 0.3, 0); g.add(burnerHit);
    burnerHit.add(new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 8), new THREE.MeshBasicMaterial({ visible: false })));
    interact(burnerHit, {
      range: 2.8,
      prompt: () => {
        if (S.lampLit) return null;
        if (!S.fuelFilled) return 'The lamp. Its reservoir below is dry.';
        if (S.pressure < 0.98) return 'The lamp. There\'s no pressure in the line.';
        if (!game.has('matches')) return 'The lamp. You need matches.';
        return 'Light the lamp';
      },
      hold: 2.0, onHold: () => { if (Math.random() < 0.05) audio.match(); },
      action: () => {
        if (!S.fuelFilled) { game.toast('Fill the <b>paraffin reservoir</b> in the watch room below first.'); return; }
        if (S.pressure < 0.98) { game.toast('<b>Pump up the pressure</b> at the reservoir in the watch room.'); return; }
        if (!game.has('matches')) { game.toast('You need <b>matches</b>.'); return; }
        S.lampLit = true; S.lampLitAt = game.time; audio.match(); setTimeout(() => audio.whoosh(), 400);
        game.toast('The mantle flares white-hot. <b>Skerryhead Light is lit.</b>', 5); game.refresh();
      },
    });
    ctx.onUpdate(() => { burnerHit.userData.inter.hold = S.fuelFilled && S.pressure >= 0.98 && game.has('matches') && !S.lampLit ? 2.0 : 0; });
    interact(T.lanternDoor.hinge, { prompt: () => T.lanternDoor.open ? 'Close the gallery door' : 'Open the door to the gallery', action: () => { const d = T.lanternDoor; d.open = !d.open; d.seg.on = !d.open; audio.door(); } });
    for (const pane of T.panes) {
      interact(pane.mesh, {
        range: 2.0,
        prompt: () => {
          if (pane.dirt <= 0.02) return null;
          const p = ctx.player.pos; if (Math.hypot(p.x, p.z) < R_GLASS) return 'The salt is crusted on the outside of the glass';
          return game.has('rag') ? 'Scrub the salt off the glass' : 'Salt-crusted glass. You need a rag.';
        },
        hold: 2.5, onHold: (dt) => { if (game.has('rag') && Math.hypot(ctx.player.pos.x, ctx.player.pos.z) > R_GLASS) { pane.dirt = Math.max(0.05, pane.dirt - dt / 2.5); pane.mat.opacity = pane.dirt * 0.95; if (Math.random() < 0.2) audio.wipe(); } },
        action: () => {
          if (!game.has('rag') || Math.hypot(ctx.player.pos.x, ctx.player.pos.z) < R_GLASS) { pane.mat.opacity = pane.dirt * 0.95; if (!game.has('rag')) game.toast('There\'s a <b>cleaning rag</b> on the bench in the watch room.'); return; }
          pane.dirt = 0; pane.mesh.visible = false; S.glassCleaned++; game.refresh();
          if (S.glassCleaned >= 6) game.toast('The last pane gleams. The beam blazes out across the sea.');
        },
      });
      ctx.onUpdate(() => { pane.mesh.userData.inter.hold = game.has('rag') && Math.hypot(ctx.player.pos.x, ctx.player.pos.z) > R_GLASS ? 2.5 : 0; });
    }
    // compass tin on the gallery
    {
      const p = polar(5.45, A(122), LANTERN_Y);
      const o = group(p.x, p.y, p.z, 0.6);
      const b = new Builder(); b.box(0.14, 0.05, 0.1, M.tin, 0, 0.025, 0); b.build(o);
      interact(o, { prompt: () => game.treasures.has('compass') ? null : 'A small tin, wedged against the railing', action: () => { o.visible = false; game.findTreasure('compass'); } });
    }
  }

  // ================================================================ OIL STORE & FOG SIGNAL
  {
    const { x: sx, z: sz, w, d } = SHED;
    const y = 7.05;
    const x0 = sx - w / 2 + 0.42, x1 = sx + w / 2 - 0.42, z0 = sz - d / 2 + 0.42, z1 = sz + d / 2 - 0.42;
    // bulk tank on its cradle
    B.cyl(0.55, 0.55, 2.4, M.ironRed, sx - 0.6, y + 0.85, z0 + 0.65, 20, 0, 0, Math.PI / 2);
    for (const k of [-0.8, 0.8]) B.box(0.12, 0.35, 0.9, M.woodDark, sx - 0.6 + k, y + 0.17, z0 + 0.65);
    B.cyl(0.03, 0.03, 0.25, M.brass, sx - 0.6, y + 0.2, z0 + 1.2, 8);
    col.addBox(sx - 0.6, z0 + 0.65, 2.5, 1.2, 0, y, y + 1.5);
    for (let k = 0; k < 3; k++) { B.box(0.28, 0.38, 0.18, M.ironRed, sx + 0.9 + k * 0.32, y + 0.19, z0 + 0.3, 0, 0.1 * k, 0); B.cyl(0.03, 0.03, 0.05, M.brass, sx + 0.95 + k * 0.32, y + 0.4, z0 + 0.3, 6); }
    {
      const o = group(sx + 1.3, y, z0 + 0.95, 0.3);
      const b = new Builder(); b.box(0.28, 0.38, 0.18, M.ironRed, 0, 0.19, 0); b.box(0.04, 0.04, 0.16, M.ironBlack, 0, 0.42, 0); b.cyl(0.03, 0.03, 0.05, M.brass, 0.08, 0.4, 0, 6); b.build(o);
      interact(o, { prompt: () => game.has('oilcan') ? null : S.fuelFilled && S.fuel > 0.3 ? null : 'Take a can of paraffin', action: () => { game.give('oilcan'); game.toast('Heavy. You won\'t be running anywhere with this.'); } });
    }
    // fog signal compressor
    const ex = sx - 0.9, ez = z1 - 0.8;
    B.box(1.3, 0.25, 0.8, M.ironBlack, ex, y + 0.12, ez);
    B.box(0.7, 0.55, 0.55, M.ironGreen, ex - 0.15, y + 0.52, ez);
    B.cyl(0.14, 0.16, 0.45, M.ironGreen, ex - 0.15, y + 1.0, ez, 12);
    B.cyl(0.35, 0.35, 1.2, M.ironGreen, x0 + 0.45, y + 0.6, ez + 0.1, 16);
    B.cyl(0.04, 0.04, 2.0, M.ironBlack, x0 + 0.45, y + 2.0, ez + 0.1, 8);
    col.addBox(ex, ez, 1.4, 0.9, 0, y, y + 1.3); col.addCircle(x0 + 0.45, ez + 0.1, 0.38, y, y + 1.3);
    const fly = new THREE.Group(); fly.position.set(ex + 0.45, y + 0.55, ez + 0.3); g.add(fly);
    { const fb = new Builder(); fb.cyl(0.3, 0.3, 0.06, M.ironBlack, 0, 0, 0, 24, Math.PI / 2); for (let k = 0; k < 4; k++) fb.box(0.04, 0.55, 0.03, M.ironBlack, 0, 0, 0.0, 0, 0, k * Math.PI / 4); fb.cyl(0.06, 0.06, 0.12, M.steel, 0, 0, 0, 10, Math.PI / 2); fb.build(fly); }
    const pulley = new THREE.Group(); pulley.position.set(ex - 0.15, y + 0.75, ez + 0.3); g.add(pulley);
    { const pb = new Builder(); pb.cyl(0.1, 0.1, 0.06, M.steel, 0, 0, 0, 16, Math.PI / 2); pb.build(pulley); }
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.015, 4, 30), M.leather); belt.scale.set(1, 0.55, 1); belt.position.set(ex + 0.15, y + 0.65, ez + 0.33); belt.rotation.z = 0.35; belt.visible = false; g.add(belt);
    const crankP = new THREE.Group(); crankP.position.set(ex + 0.45, y + 0.55, ez + 0.36); g.add(crankP);
    { const cb = new Builder(); cb.box(0.04, 0.3, 0.03, M.ironBlack, 0, -0.15, 0); cb.cyl(0.025, 0.025, 0.15, M.woodDark, 0, -0.3, 0.07, 8, Math.PI / 2); cb.build(crankP); }
    const hornP = new THREE.Vector3(sx - w / 2 - 1.5, 10.5, sz);
    let blastT = 3;
    ctx.onUpdate((dt) => {
      if (!S.foghornOn) return;
      fly.rotation.z -= dt * 8; pulley.rotation.z -= dt * 20; crankP.rotation.z = fly.rotation.z;
      blastT -= dt; if (blastT <= 0) { blastT = 30; audio.foghorn(hornP.x, hornP.y, hornP.z); }
    });
    const engHit = group(ex, y + 0.6, ez + 0.2);
    engHit.add(new THREE.Mesh(boxGeo(1.3, 0.9, 0.7), new THREE.MeshBasicMaterial({ visible: false })));
    interact(engHit, {
      prompt: () => {
        if (S.foghornOn) return null;
        if (!S.beltFitted) return game.has('belt') ? 'Fit the drive belt to the compressor' : 'The fog signal compressor. Its drive belt has snapped.';
        return 'Crank the engine to start the fog signal';
      },
      hold: 0, onHold: (dt) => { crankP.rotation.z -= dt * 10; if (Math.random() < 0.2) audio.ratchet(); },
      action: () => {
        if (!S.beltFitted) {
          if (!game.has('belt')) { game.toast('The old belt lies in two pieces. There should be a <b>spare</b> in the tower store room.'); return; }
          S.beltFitted = true; belt.visible = true; game.take('belt'); audio.thud(); game.toast('You stretch the new belt over the pulleys. Now crank her over.'); return;
        }
        S.foghornOn = true; game.refresh(); audio.thud(); blastT = 1.5;
        game.toast('The engine coughs, catches and thumps into life. The great horn bellows out over the water.', 5);
        audio.addLoop('engine', ex, y + 0.6, ez, 0.12, 0.14, (pan) => audio.burst({ buf: audio.brown, type: 'lowpass', f: 220, a: 0.005, d: 0.09, g: 0.5, dest: pan }), 2);
      },
    });
    ctx.onUpdate(() => { engHit.userData.inter.hold = S.beltFitted && !S.foghornOn ? 3.0 : 0; });
    // workbench with the crowbar
    B.box(0.6, 0.85, 1.6, M.woodDark, x0 + 0.3, y + 0.42, sz - 0.2);
    B.box(0.04, 1.0, 1.2, M.woodDark, x0 + 0.02, y + 1.6, sz - 0.2);
    col.addBox(x0 + 0.3, sz - 0.2, 0.6, 1.6, 0, y, y + 0.9);
    {
      const o = group(x0 + 0.08, y + 1.55, sz - 0.1, Math.PI / 2);
      const b = new Builder(); b.box(0.035, 0.75, 0.025, M.ironBlack, 0, 0, 0); b.box(0.035, 0.1, 0.025, M.ironBlack, 0.03, 0.4, 0, 0, 0, -0.8); b.build(o);
      interact(o, { prompt: () => game.has('crowbar') ? null : 'Take the crowbar', action: () => { game.give('crowbar'); o.visible = false; } });
    }
    B.box(0.3, 0.2, 0.25, M.tin, x0 + 0.3, y + 0.95, sz - 0.6);
    for (let i = 0; i < 6; i++) B.add(new THREE.TorusGeometry(0.25 - i * 0.012, 0.025, 6, 18), M.rope, x1 - 0.4, y + 0.03 + i * 0.045, z1 - 0.4, Math.PI / 2);
    // hanging lamp
    B.cyl(0.006, 0.006, 0.5, M.ironBlack, sx + 0.3, y + 2.5, sz, 4);
    const gl = new THREE.Mesh(cylGeo(0.06, 0.08, 0.18, 10), M.lampGlass); gl.position.set(sx + 0.3, y + 2.15, sz); g.add(gl);
    const L = new THREE.PointLight(0xffa458, 4.5, 9, 2); L.position.set(sx + 0.3, y + 2.1, sz); g.add(L);
    ctx.lights.push({ light: L, base: 4.5, flicker: 0.12 });
  }

  // ================================================================ OUTSIDE: boat & bottle
  {
    const boat = ctx.boat;
    const tin = new THREE.Mesh(boxGeo(0.16, 0.06, 0.1), M.tin); tin.position.set(0.2, -0.3, -0.6); boat.add(tin);
    interact(tin, { range: 2.6, prompt: () => game.treasures.has('pearls') ? null : 'Something glints under the thwart', action: () => { tin.visible = false; game.findTreasure('pearls'); } });
    ctx.onUpdate((dt, t) => {
      const b = boat.position; const h = ctx.waveH(b.x, b.z);
      const hf = ctx.waveH(b.x, b.z + 1.5), hs = ctx.waveH(b.x + 0.6, b.z);
      boat.position.y += (h + 0.25 - boat.position.y) * Math.min(1, dt * 3);
      boat.rotation.x += ((hf - h) * 0.4 - boat.rotation.x) * Math.min(1, dt * 3);
      boat.rotation.z += (-(hs - h) * 0.6 - boat.rotation.z) * Math.min(1, dt * 3);
    });
    const bx = 3.7, bz = 26.2, by = terrainHeight(bx, bz);
    const o = group(bx, by + 0.06, bz, 0.8);
    const b = new Builder(); b.add(lathe([[0.001, 0], [0.06, 0], [0.065, 0.02], [0.065, 0.2], [0.03, 0.26], [0.016, 0.29], [0.016, 0.33], [0.001, 0.33]], 12), M.glassBottle, 0, 0.06, 0, 0, 0, Math.PI / 2 - 0.2); b.build(o);
    interact(o, { range: 2.2, prompt: () => game.treasures.has('message') ? null : 'A bottle, wedged between the rocks', action: () => { o.visible = false; game.findTreasure('message'); } });
  }

  B.build(g, { name: 'interior-static' });
}

function logEntry(game) {
  const S = game.S, n = game.treasures.size;
  return `<h2>Skerryhead Light — Journal</h2>
<p><em>In your own hand, beneath your predecessor's last entry:</em></p>
<p>"Oct. 10th. Wind NW, whole gale, veering. Barometer 28.3 and falling. Heavy sea breaking over the landing. Relief boat unable to land.</p>
<p>Light exhibited at dusk${S.glassCleaned >= 6 ? ', glass cleaned of salt' : ''}. Fog signal run through the night. Broken casement in the bedroom boarded.</p>
<p>At the height of the gale the SS <b>Aurora</b> called on the wireless, lost and near the reef. Guided her south by the light and the horn. She is safe in open water.${S.tea ? ' Tea taken at 2 a.m.' : ''}</p>
<p>${n >= 8 ? 'I have found all of Elias Marrow\'s secrets now. The Marianne may rest. ' : n > 0 ? `Strange things about this old tower: ${n} relics of the keeper Marrow found so far. ` : ''}All well."</p>
<p class="sig">— Keeper on watch</p>`;
}
