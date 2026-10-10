import * as THREE from 'three';
import { lathe, cylGeo } from './geom.js';
import { STAIRS, FLOOR_H, N_FLOORS, R_IN, DEG, faceIn } from './config.js';
import { addLamp } from './lights.js';

// Furniture and household props. Every prop draws into a Builder at the current transform with its origin on the
// floor at the centre of its footprint and its front facing +z (its back toward -z, i.e. toward the wall).
// Sizes are noted as w (x) x d (z) x h (y). Edges are chamfered (cbox) wherever the eye would read them.

const TAU = Math.PI * 2;
const sph = (r, ws = 12, hs = 8) => new THREE.SphereGeometry(r, ws, hs);

// ---------------------------------------------------------------- fabrics (cached: one material per colour)
const fabrics = new Map();
export function fab(M, hex, doubleSided = false) {
  const key = hex + (doubleSided ? 'd' : '');
  if (!fabrics.has(key)) { const m = M.cloth(hex); if (doubleSided) m.side = THREE.DoubleSide; fabrics.set(key, m); }
  return fabrics.get(key);
}

// ---------------------------------------------------------------- small parts
const leg = (B, mat, x, z, h, r = 0.028) => {
  B.cyl(r * 0.62, r, h, mat, x, h / 2, z, 8);
  B.cyl(r * 1.12, r * 1.12, 0.03, mat, x, h * 0.78, z, 8);
};
export function cushion(B, M, hex, x, y, z, w = 0.4, d = 0.4, tilt = 0, ry = 0) {
  B.add(sph(0.5, 12, 8), fab(M, hex), x, y, z, tilt, ry, 0, w, 0.2, d);
}
export function bookPile(B, M, n = 3, rnd = Math.random) {
  const cols = [0x5a1e18, 0x1e3a2a, 0x23304a, 0x6a4a20, 0x3a2a1a, 0x7a6a50];
  let y = 0;
  for (let i = 0; i < n; i++) {
    const h = 0.03 + rnd() * 0.025, w = 0.2 + rnd() * 0.06, d = 0.15 + rnd() * 0.05;
    B.box(w, h, d, M.books, (rnd() - 0.5) * 0.02, y + h / 2, 0, 0, (rnd() - 0.5) * 0.5, 0, 0.5, new THREE.Color(cols[Math.floor(rnd() * cols.length)]));
    y += h;
  }
  return y;
}
export function teapot(B, M, mat = M.ceramic) {
  B.add(lathe([[0.001, 0], [0.065, 0], [0.085, 0.04], [0.08, 0.09], [0.05, 0.12], [0.03, 0.125], [0.001, 0.127]], 14), mat);
  B.cyl(0.012, 0.022, 0.1, mat, 0.1, 0.1, 0, 6, 0, 0, -0.9);
  B.add(new THREE.TorusGeometry(0.045, 0.008, 6, 12, Math.PI), mat, -0.085, 0.075, 0, 0, 0, -Math.PI / 2);
  B.add(sph(0.014, 6, 5), mat, 0, 0.14, 0);
}
export function cup(B, M, mat = M.ceramic) {
  B.add(lathe([[0.001, 0], [0.05, 0], [0.052, 0.006], [0.001, 0.008]], 12), mat);
  B.add(lathe([[0.001, 0.008], [0.03, 0.008], [0.04, 0.06], [0.036, 0.062], [0.026, 0.014], [0.001, 0.014]], 12), mat);
  B.add(new THREE.TorusGeometry(0.02, 0.005, 5, 10, Math.PI), mat, 0.04, 0.035, 0, 0, 0, -Math.PI / 2);
}
export function teaTray(B, M) {
  B.cbox(0.4, 0.02, 0.28, M.woodDark, 0, 0.01, 0, 0, 0, 0, 0.6, null, 0.005);
  B.push(-0.07, 0.02, 0); teapot(B, M, M.ceramicBlue); B.pop();
  B.push(0.1, 0.02, 0.05); cup(B, M); B.pop();
  B.push(0.1, 0.02, -0.07); cup(B, M); B.pop();
}
export function fruitBowl(B, M) {
  B.add(lathe([[0.001, 0], [0.05, 0], [0.1, 0.06], [0.115, 0.08], [0.105, 0.08], [0.09, 0.06], [0.04, 0.012], [0.001, 0.012]], 16), M.ceramicBlue);
  for (const [x, y, z] of [[-0.03, 0.09, 0.02], [0.04, 0.09, -0.02], [0.0, 0.12, 0.0], [0.05, 0.085, 0.05], [-0.05, 0.085, -0.04]]) B.add(sph(0.036, 8, 6), M.apple, x, y, z, 0, 0, 0, 1, 0.9, 1);
}
export function loaf(B, M) {
  B.cbox(0.34, 0.02, 0.2, M.wood, 0, 0.01, 0, 0, 0, 0, 0.5, null, 0.005);
  B.add(sph(0.5, 10, 7), M.bread, 0, 0.07, 0, 0, 0.2, 0, 0.26, 0.12, 0.14);
  B.box(0.015, 0.012, 0.16, M.steel, 0.17, 0.026, 0.02, 0, 0.5, 0);
}
export function plant(B, M, h = 0.3, flowers = true) {
  B.add(lathe([[0.001, 0], [0.07, 0], [0.09, 0.02], [0.11, 0.17], [0.12, 0.18], [0.1, 0.18], [0.001, 0.15]], 14), M.terracotta);
  B.add(new THREE.CylinderGeometry(0.1, 0.1, 0.01, 12), M.soil, 0, 0.17, 0);
  const r = (i) => Math.sin(i * 12.9898) * 43758.5453 % 1;
  for (let i = 0; i < 11; i++) {
    const a = i * 2.4, rr = 0.03 + Math.abs(r(i)) * 0.09, y = 0.2 + (i % 4) * h * 0.2;
    B.add(sph(0.5, 8, 6), M.foliage, Math.cos(a) * rr, y, Math.sin(a) * rr, 0.3, a, 0.2, 0.17 + (i % 3) * 0.03, 0.045, 0.1);
  }
  if (flowers) for (let i = 0; i < 4; i++) { const a = i * 1.9 + 0.5; B.cyl(0.003, 0.003, h * 0.7, M.foliage, Math.cos(a) * 0.05, 0.2 + h * 0.35, Math.sin(a) * 0.05, 4); B.add(sph(0.02, 6, 5), M.flower, Math.cos(a) * 0.05, 0.2 + h * 0.72, Math.sin(a) * 0.05); }
}

// ---------------------------------------------------------------- tables
export function table(B, M, w, d, h, mat = M.wood) {                                   // w x d x h
  B.cbox(w, 0.04, d, mat, 0, h - 0.02, 0, 0, 0, 0, 0.8, null, 0.008);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) leg(B, mat, sx * (w / 2 - 0.06), sz * (d / 2 - 0.06), h - 0.04);
  B.cbox(w - 0.12, 0.08, 0.02, mat, 0, h - 0.09, d / 2 - 0.06, 0, 0, 0, 0.8, null, 0.005); B.cbox(w - 0.12, 0.08, 0.02, mat, 0, h - 0.09, -d / 2 + 0.06, 0, 0, 0, 0.8, null, 0.005);
  B.cbox(0.02, 0.08, d - 0.12, mat, w / 2 - 0.06, h - 0.09, 0, 0, 0, 0, 0.8, null, 0.005); B.cbox(0.02, 0.08, d - 0.12, mat, -w / 2 + 0.06, h - 0.09, 0, 0, 0, 0, 0.8, null, 0.005);
}
export function workTable(B, M, w = 1.3, d = 0.7, h = 0.9, mat = M.woodDark) {          // heavy kitchen/work table with a low shelf
  B.cbox(w, 0.06, d, mat, 0, h - 0.03, 0, 0, 0, 0, 0.8, null, 0.01);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.cbox(0.07, h - 0.06, 0.07, mat, sx * (w / 2 - 0.07), (h - 0.06) / 2, sz * (d / 2 - 0.07), 0, 0, 0, 0.8, null, 0.008);
  B.cbox(w - 0.14, 0.03, d - 0.14, mat, 0, 0.2, 0, 0, 0, 0, 0.8, null, 0.006);
  B.cbox(w - 0.14, 0.1, 0.03, mat, 0, h - 0.11, d / 2 - 0.07, 0, 0, 0, 0.8, null, 0.006);
}
export function sideTable(B, M, h = 0.55) {                                             // 0.4 x 0.4 round tripod
  B.cyl(0.2, 0.2, 0.03, M.woodDark, 0, h - 0.015, 0, 20);
  B.add(lathe([[0.001, 0], [0.04, 0.0], [0.05, 0.05], [0.025, 0.12], [0.03, h - 0.1], [0.06, h - 0.04], [0.001, h - 0.03]], 12), M.woodDark);
  for (let k = 0; k < 3; k++) { const a = k * TAU / 3; B.cyl(0.012, 0.016, 0.22, M.woodDark, Math.cos(a) * 0.11, 0.06, Math.sin(a) * 0.11, 6, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); }
}
export function roundTable(B, M, r, h) {
  B.cyl(r, r, 0.045, M.wood, 0, h - 0.022, 0, 32);
  B.cyl(r - 0.01, r - 0.01, 0.01, M.woodDark, 0, h - 0.05, 0, 32);
  B.add(lathe([[0.25, 0], [0.22, 0.04], [0.08, 0.12], [0.05, 0.5], [0.08, h - 0.15], [0.12, h - 0.05], [0.001, h - 0.05]], 16), M.wood);
}

// ---------------------------------------------------------------- seating
export function chair(B, M, mat = M.wood, cush = null) {                                // 0.44 x 0.42 x 0.95
  B.cbox(0.44, 0.04, 0.42, mat, 0, 0.46, 0, 0, 0, 0, 0.8, null, 0.008);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) leg(B, mat, sx * 0.19, sz * 0.18, 0.44, 0.02);
  for (const sx of [-1, 1]) B.cyl(0.014, 0.018, 0.52, mat, sx * 0.19, 0.74, -0.19, 6);
  for (const y of [0.64, 0.8, 0.96]) B.cbox(0.38, 0.045, 0.02, mat, 0, y, -0.19, 0, 0, 0, 0.8, null, 0.005);
  if (cush) B.add(sph(0.5, 10, 6), cush, 0, 0.5, 0.0, 0, 0, 0, 0.4, 0.09, 0.38);
}
export function stool(B, M, h = 0.46) {                                                // 0.32 round
  B.cyl(0.16, 0.16, 0.035, M.wood, 0, h - 0.018, 0, 16);
  for (let k = 0; k < 3; k++) { const a = k * TAU / 3 + 0.5; B.cyl(0.014, 0.02, h - 0.03, M.wood, Math.cos(a) * 0.11, (h - 0.03) / 2, Math.sin(a) * 0.11, 6, Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12); }
  B.add(new THREE.TorusGeometry(0.1, 0.01, 4, 14), M.wood, 0, 0.18, 0, Math.PI / 2);
}
export function footstool(B, M, hex = 0x6a2a22) {                                      // 0.38 x 0.3 x 0.22
  B.add(sph(0.5, 12, 8), fab(M, hex), 0, 0.17, 0, 0, 0, 0, 0.38, 0.14, 0.3);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.cyl(0.02, 0.016, 0.1, M.woodDark, sx * 0.14, 0.05, sz * 0.1, 6);
}
export function armchair(B, M, hex) {                                                  // 0.85 x 0.8 x 1.0
  const c = fab(M, hex);
  B.cbox(0.8, 0.28, 0.76, c, 0, 0.26, 0, 0, 0, 0, 0.5, null, 0.04);
  B.cbox(0.8, 0.66, 0.2, c, 0, 0.7, -0.3, -0.14, 0, 0, 0.5, null, 0.05);
  for (const sx of [-1, 1]) B.cbox(0.16, 0.26, 0.74, c, sx * 0.38, 0.5, 0.0, 0, 0, 0, 0.5, null, 0.05);
  B.add(sph(0.5, 12, 8), c, 0, 0.5, 0.06, 0, 0, 0, 0.58, 0.2, 0.58);
  B.add(sph(0.5, 12, 8), c, 0, 0.78, -0.2, -0.3, 0, 0, 0.5, 0.2, 0.2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.cyl(0.03, 0.022, 0.1, M.woodDark, sx * 0.34, 0.05, sz * 0.3, 8);
}
export function rockingChair(B, M) {                                                    // 0.58 x 0.9 x 1.0
  for (const sx of [-1, 1]) {
    const pts = []; for (let t = -0.42; t <= 0.42; t += 0.06) pts.push(new THREE.Vector3(sx * 0.26, 0.04 + 1.3 * (1 - Math.cos(t)), 1.3 * Math.sin(t)));
    B.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, 0.018, 6), M.wood);
    B.cyl(0.016, 0.02, 0.4, M.wood, sx * 0.26, 0.26, 0.2, 6); B.cyl(0.016, 0.02, 0.4, M.wood, sx * 0.26, 0.26, -0.2, 6);
    B.cyl(0.015, 0.02, 0.5, M.wood, sx * 0.24, 0.72, -0.3, 6, -0.12);
  }
  B.cbox(0.52, 0.04, 0.46, M.wood, 0, 0.46, 0, 0, 0, 0, 0.8, null, 0.01);
  for (const y of [0.66, 0.8, 0.94]) B.cbox(0.46, 0.05, 0.02, M.wood, 0, y, -0.32 - (y - 0.66) * 0.12, -0.12, 0, 0, 0.8, null, 0.005);
  cushion(B, M, 0x8a3a2a, 0, 0.5, 0.02, 0.46, 0.4);
}
export function settle(B, M, w = 1.4, hex = 0x2f4a5a) {                                  // w x 0.5 x 1.0 high-backed bench
  B.cbox(w, 0.05, 0.5, M.woodDark, 0, 0.44, 0, 0, 0, 0, 0.8, null, 0.01);
  B.cbox(w, 0.78, 0.04, M.woodDark, 0, 0.7, -0.23, -0.05, 0, 0, 0.8, null, 0.01);
  for (const sx of [-1, 1]) B.cbox(0.05, 0.98, 0.5, M.woodDark, sx * (w / 2 - 0.025), 0.49, 0, 0, 0, 0, 0.8, null, 0.01);
  B.cbox(w - 0.1, 0.38, 0.46, M.woodDark, 0, 0.19, 0, 0, 0, 0, 0.8, null, 0.01);
  cushion(B, M, hex, -w * 0.22, 0.5, 0.02, w * 0.42, 0.44); cushion(B, M, hex, w * 0.22, 0.5, 0.02, w * 0.42, 0.44);
}

// ---------------------------------------------------------------- storage
export function chestOfDrawers(B, M, w = 0.95, d = 0.5, h = 0.95, mat = M.wood) {      // w x d x h
  B.cbox(w, h - 0.08, d, mat, 0, 0.08 + (h - 0.08) / 2, 0, 0, 0, 0, 0.8, null, 0.01);
  B.cbox(w + 0.04, 0.035, d + 0.04, mat, 0, h - 0.0175, 0, 0, 0, 0, 0.8, null, 0.008);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.cbox(0.06, 0.08, 0.06, M.woodDark, sx * (w / 2 - 0.05), 0.04, sz * (d / 2 - 0.05), 0, 0, 0, 0.8, null, 0.008);
  const rows = 4, dh = (h - 0.16) / rows;
  for (let i = 0; i < rows; i++) {
    const y = 0.11 + dh * (i + 0.5);
    B.cbox(w - 0.08, dh - 0.02, 0.02, M.woodDark, 0, y, d / 2, 0, 0, 0, 0.8, null, 0.005);
    B.cbox(w - 0.12, dh - 0.06, 0.012, mat, 0, y, d / 2 + 0.012, 0, 0, 0, 0.8, null, 0.004);
    for (const sx of [-1, 1]) B.add(sph(0.016, 8, 6), M.brass, sx * w * 0.2, y, d / 2 + 0.03);
  }
}
export function cupboard(B, M, w = 1.0, d = 0.45, h = 1.9, mat = M.paintTeal) {          // tall two-door cupboard
  B.cbox(w, h - 0.12, d, mat, 0, 0.1 + (h - 0.12) / 2, 0, 0, 0, 0, 0.8, null, 0.012);
  B.cbox(w + 0.06, 0.07, d + 0.05, mat, 0, h - 0.035, 0.01, 0, 0, 0, 0.8, null, 0.012);
  B.cbox(w + 0.02, 0.1, d + 0.02, mat, 0, 0.05, 0, 0, 0, 0, 0.8, null, 0.01);
  for (const sx of [-1, 1]) {
    B.cbox(w / 2 - 0.04, h - 0.3, 0.03, M.woodDark, sx * (w / 4), 0.1 + (h - 0.3) / 2 + 0.06, d / 2, 0, 0, 0, 0.8, null, 0.006);
    B.cbox(w / 2 - 0.12, (h - 0.3) * 0.42, 0.012, mat, sx * (w / 4), 0.1 + (h - 0.3) * 0.74 + 0.06, d / 2 + 0.018, 0, 0, 0, 0.8, null, 0.004);
    B.cbox(w / 2 - 0.12, (h - 0.3) * 0.34, 0.012, mat, sx * (w / 4), 0.1 + (h - 0.3) * 0.26 + 0.06, d / 2 + 0.018, 0, 0, 0, 0.8, null, 0.004);
    B.cyl(0.012, 0.012, 0.1, M.brass, sx * 0.04, 1.0, d / 2 + 0.04, 6);
  }
}
export function trunk(B, M, w = 0.85, hex = null) {                                     // w x 0.5 x 0.5 sea chest
  const mat = hex ? M.paintBlue : M.woodDark;
  B.cbox(w, 0.42, 0.5, mat, 0, 0.21, 0, 0, 0, 0, 0.6, null, 0.012);
  B.add(new THREE.CylinderGeometry(0.25, 0.25, w, 14, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(Math.PI / 2), mat, 0, 0.42, 0);
  for (const sx of [-0.3, 0.3]) B.cbox(0.05, 0.5, 0.52, M.ironBlack, sx, 0.25, 0, 0, 0, 0, 0.6, null, 0.005);
  B.cbox(0.08, 0.1, 0.03, M.brass, 0, 0.36, 0.26);
}
export function wallShelf(B, M, w = 0.9, d = 0.22) {                                    // board on two brackets; origin at the board's front-bottom centre
  B.cbox(w, 0.03, d, M.wood, 0, 0, d / 2, 0, 0, 0, 0.8, null, 0.006);
  for (const sx of [-1, 1]) B.cbox(0.03, 0.16, 0.14, M.ironBlack, sx * (w / 2 - 0.1), -0.09, 0.07, 0, 0, 0, 0.8, null, 0.004);
}
export function pegRail(B, M, w = 1.0, n = 5) {                                          // rail with pegs, origin at the rail centre against the wall
  B.cbox(w, 0.08, 0.025, M.woodDark, 0, 0, 0.0125, 0, 0, 0, 0.8, null, 0.005);
  for (let i = 0; i < n; i++) B.cyl(0.011, 0.011, 0.07, M.brass, -w / 2 + 0.08 + i * (w - 0.16) / (n - 1), -0.0, 0.055, 6, Math.PI / 2);
}
export function coatRack(B, M, hat = true) {                                             // board with coats and a sou'wester
  pegRail(B, M, 0.8, 4);
  B.cbox(0.18, 0.7, 0.04, fab(M, 0x2a3a4a), -0.25, -0.38, 0.09, 0, 0, 0, 0.5, null, 0.02);
  B.cbox(0.2, 0.62, 0.04, M.oilskin, 0.05, -0.34, 0.09, 0, 0, 0, 0.5, null, 0.02);
  if (hat) { B.add(sph(0.12, 10, 6), M.oilskin, 0.28, -0.06, 0.1, 0, 0, 0, 1, 0.7, 1); B.cyl(0.19, 0.19, 0.012, M.oilskin, 0.28, -0.09, 0.1, 14, 0.2); }
}

// ---------------------------------------------------------------- more furniture
export function sofa(B, M, w = 1.9, hex = 0x5a2a28) {                                    // w x 0.9 x 0.9
  const c = fab(M, hex);
  B.cbox(w, 0.28, 0.84, c, 0, 0.27, 0, 0, 0, 0, 0.5, null, 0.04);
  B.cbox(w, 0.62, 0.22, c, 0, 0.66, -0.31, -0.1, 0, 0, 0.5, null, 0.05);
  for (const sx of [-1, 1]) B.cbox(0.2, 0.34, 0.84, c, sx * (w / 2 - 0.1), 0.5, 0, 0, 0, 0, 0.5, null, 0.05);
  const n = Math.round((w - 0.4) / 0.55);
  for (let i = 0; i < n; i++) B.add(sph(0.5, 12, 8), c, -((n - 1) / 2) * 0.55 + i * 0.55, 0.5, 0.06, 0, 0, 0, 0.54, 0.2, 0.62);
  for (const sx of [-0.5, 0.5]) cushion(B, M, 0xc8a050, sx * (w * 0.32), 0.7, -0.14, 0.34, 0.26, -0.5);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.cyl(0.035, 0.025, 0.1, M.woodDark, sx * (w / 2 - 0.08), 0.05, sz * 0.34, 8);
}
export function harmonium(B, M) {                                                       // 1.0 x 0.5 x 1.05
  B.cbox(1.0, 0.7, 0.5, M.woodDark, 0, 0.35, 0, 0, 0, 0, 0.8, null, 0.012);
  B.cbox(1.04, 0.05, 0.54, M.woodDark, 0, 0.72, 0, 0, 0, 0, 0.8, null, 0.008);
  B.cbox(0.9, 0.04, 0.16, fab(M, 0xe8e0c8), 0, 0.77, 0.12, 0, 0, 0, 0.5, null, 0.003);                                    // keys
  for (let k = 0; k < 10; k++) B.box(0.014, 0.02, 0.08, M.black, -0.4 + k * 0.088 + (k % 7 === 2 || k % 7 === 6 ? 0.2 : 0), 0.8, 0.09, 0, 0, 0, 0.5);
  B.cbox(1.0, 0.36, 0.08, M.woodDark, 0, 0.92, -0.2, 0, 0, 0, 0.8, null, 0.01);
  for (let k = 0; k < 7; k++) B.cbox(0.1, 0.24, 0.012, M.wood, -0.38 + k * 0.127, 0.92, -0.155, 0, 0, 0, 0.5, null, 0.003);  // fretwork panels
  for (const sx of [-0.26, 0.26]) B.cbox(0.14, 0.02, 0.1, M.brass, sx, 0.1, 0.2, 0.3);
  B.cbox(0.4, 0.28, 0.01, fab(M, 0xe8dcc0), 0, 1.15, -0.1, -0.2, 0, 0, 0.5);                                           // sheet music
}
export function grandfatherClock(B, M, ctx = null) {                                    // 0.5 x 0.3 x 2.1
  B.cbox(0.46, 0.5, 0.28, M.woodDark, 0, 0.25, 0, 0, 0, 0, 0.8, null, 0.012);
  B.cbox(0.34, 1.0, 0.22, M.woodDark, 0, 1.0, 0, 0, 0, 0, 0.8, null, 0.01);
  B.cbox(0.3, 0.9, 0.012, M.lampGlass, 0, 1.0, 0.116);
  B.cbox(0.44, 0.44, 0.26, M.woodDark, 0, 1.74, 0, 0, 0, 0, 0.8, null, 0.012);
  B.add(new THREE.CircleGeometry(0.17, 28), M.clockFace, 0, 1.74, 0.134);
  B.add(new THREE.TorusGeometry(0.17, 0.01, 6, 28), M.brass, 0, 1.74, 0.136);
  B.add(new THREE.ConeGeometry(0.26, 0.14, 4), M.woodDark, 0, 2.03, 0, 0, Math.PI / 4, 0, 1, 1, 0.65);
  B.cyl(0.008, 0.008, 0.5, M.brass, 0, 1.0, 0.0, 6); B.cyl(0.06, 0.06, 0.012, M.brass, 0, 0.74, 0.0, 14, Math.PI / 2);
}
export function desk(B, M, w = 1.4, d = 0.7, h = 0.78) {                                // writing desk with a leather top and two pedestals
  B.cbox(w, 0.04, d, M.woodDark, 0, h - 0.02, 0, 0, 0, 0, 0.8, null, 0.008);
  B.cbox(w - 0.14, 0.006, d - 0.14, M.leather, 0, h + 0.002, 0, 0, 0, 0, 0.8);
  for (const sx of [-1, 1]) {
    B.cbox(0.4, h - 0.04, d - 0.04, M.woodDark, sx * (w / 2 - 0.22), (h - 0.04) / 2, 0, 0, 0, 0, 0.8, null, 0.008);
    for (let k = 0; k < 3; k++) { B.cbox(0.36, 0.17, 0.01, M.wood, sx * (w / 2 - 0.22), 0.15 + k * 0.2, d / 2 - 0.02, 0, 0, 0, 0.5, null, 0.004); B.cyl(0.012, 0.012, 0.02, M.brass, sx * (w / 2 - 0.22), 0.15 + k * 0.2, d / 2 + 0.01, 6, Math.PI / 2); }
  }
  B.cbox(w - 0.8, 0.1, 0.02, M.woodDark, 0, h - 0.1, -d / 2 + 0.04, 0, 0, 0, 0.8);
}
export function washstand(B, M) {                                                       // 0.7 x 0.45 x 0.9 (marble-topped, basin and jug)
  B.cbox(0.7, 0.03, 0.45, M.granite, 0, 0.84, 0, 0, 0, 0, 0.8, null, 0.006);
  B.cbox(0.66, 0.08, 0.41, M.wood, 0, 0.78, 0, 0, 0, 0, 0.8, null, 0.006);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) leg(B, M.wood, sx * 0.3, sz * 0.18, 0.76, 0.022);
  B.cbox(0.6, 0.02, 0.36, M.wood, 0, 0.25, 0, 0, 0, 0, 0.8);
  B.add(lathe([[0.001, 0], [0.12, 0.0], [0.2, 0.08], [0.21, 0.1], [0.2, 0.1], [0.001, 0.02]], 18), M.ceramic, -0.06, 0.855, 0.0);
  B.add(lathe([[0.001, 0], [0.07, 0], [0.09, 0.08], [0.06, 0.2], [0.07, 0.26], [0.001, 0.26]], 14), M.ceramic, 0.22, 0.855, -0.08);
  B.cbox(0.012, 0.012, 0.5, M.brass, 0.38, 0.6, 0, 0, 0, 0, 0.5);
  B.cbox(0.01, 0.34, 0.2, fab(M, 0xe8e2d2), 0.4, 0.45, 0, 0, 0, 0, 0.5);
}
export function wardrobe(B, M, w = 1.1, h = 2.0) {                                      // w x 0.6 x h
  B.cbox(w, h - 0.14, 0.58, M.woodDark, 0, 0.1 + (h - 0.14) / 2, 0, 0, 0, 0, 0.8, null, 0.012);
  B.cbox(w + 0.08, 0.08, 0.64, M.woodDark, 0, h - 0.04, 0, 0, 0, 0, 0.8, null, 0.012);
  B.cbox(w + 0.02, 0.1, 0.6, M.woodDark, 0, 0.05, 0, 0, 0, 0, 0.8, null, 0.01);
  for (const sx of [-1, 1]) {
    B.cbox(w / 2 - 0.04, h - 0.32, 0.03, M.wood, sx * (w / 4), 0.1 + (h - 0.32) / 2 + 0.06, 0.295, 0, 0, 0, 0.8, null, 0.008);
    B.cbox(w / 2 - 0.16, (h - 0.32) * 0.44, 0.012, M.woodDark, sx * (w / 4), 0.1 + (h - 0.32) * 0.74 + 0.06, 0.318, 0, 0, 0, 0.8, null, 0.004);
    B.cbox(w / 2 - 0.16, (h - 0.32) * 0.36, 0.012, M.woodDark, sx * (w / 4), 0.1 + (h - 0.32) * 0.28 + 0.06, 0.318, 0, 0, 0, 0.8, null, 0.004);
    B.cyl(0.012, 0.012, 0.03, M.brass, sx * 0.07, 1.05, 0.325, 6, Math.PI / 2);
  }
}
export function ironBed(B, M, hex = 0x4a6a8a) {                                         // 0.95 x 2.0 x 1.0; head toward -z
  const frame = M.ironBlack;
  for (const [z, hh] of [[-0.98, 1.0], [0.98, 0.7]]) {
    for (const sx of [-1, 1]) { B.cyl(0.02, 0.02, hh, frame, sx * 0.46, hh / 2, z, 8); B.add(sph(0.03, 8, 6), M.brass, sx * 0.46, hh + 0.02, z); }
    B.cyl(0.012, 0.012, 0.92, frame, 0, hh - 0.05, z, 6, 0, 0, Math.PI / 2); B.cyl(0.012, 0.012, 0.92, frame, 0, 0.4, z, 6, 0, 0, Math.PI / 2);
    for (let k = 0; k < 9; k++) B.cyl(0.006, 0.006, hh - 0.45, frame, -0.38 + k * 0.095, 0.4 + (hh - 0.45) / 2, z, 4);
  }
  for (const sx of [-1, 1]) B.cbox(0.03, 0.06, 1.96, frame, sx * 0.46, 0.34, 0, 0, 0, 0, 0.5);
  B.cbox(0.9, 0.2, 1.92, fab(M, 0xe2dccc), 0, 0.46, 0, 0, 0, 0, 0.6, null, 0.03);
  B.cbox(0.94, 0.1, 1.3, fab(M, hex), 0, 0.6, 0.32, 0, 0, 0, 0.6, null, 0.03);
  B.cbox(0.94, 0.06, 0.28, fab(M, 0xe8e2d2), 0, 0.62, -0.5, 0, 0, 0, 0.6, null, 0.015);
  B.add(sph(0.5, 12, 8), fab(M, 0xf0ece0), 0, 0.64, -0.78, 0, 0, 0, 0.5, 0.16, 0.32);
}
export function bunkBed(B, M) {                                                         // 1.0 x 2.0 x 1.9, two tiers and a ladder
  const w = M.wood;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.cbox(0.07, 1.9, 0.07, w, sx * 0.48, 0.95, sz * 0.98, 0, 0, 0, 0.8, null, 0.008);
  for (const y of [0.4, 1.3]) {
    for (const sx of [-1, 1]) B.cbox(0.05, 0.12, 1.96, w, sx * 0.48, y, 0, 0, 0, 0, 0.8, null, 0.006);
    for (const sz of [-1, 1]) B.cbox(0.96, 0.12, 0.05, w, 0, y, sz * 0.98, 0, 0, 0, 0.8, null, 0.006);
    B.cbox(0.92, 0.12, 1.9, fab(M, 0xe2dccc), 0, y + 0.1, 0, 0, 0, 0, 0.6, null, 0.03);
    B.cbox(0.94, 0.06, 1.1, fab(M, y < 1 ? 0x6a2a22 : 0x2f4a5a), 0, y + 0.19, 0.36, 0, 0, 0, 0.6, null, 0.02);
    B.add(sph(0.5, 10, 8), fab(M, 0xf0ece0), 0, y + 0.2, -0.76, 0, 0, 0, 0.46, 0.14, 0.3);
  }
  for (const sx of [-1, 1]) B.cbox(0.04, 0.5, 0.96, w, sx * 0.48, 1.62, 0, 0, 0, 0, 0.8);     // guard rail
  B.cbox(0.05, 1.6, 0.04, w, 0.2, 0.8, 1.03, -0.1); B.cbox(0.05, 1.6, 0.04, w, -0.2, 0.8, 1.03, -0.1);
  for (let k = 0; k < 5; k++) B.cyl(0.012, 0.012, 0.44, w, 0, 0.3 + k * 0.28, 1.0 + 0.06 - k * 0.0, 6, 0, 0, Math.PI / 2);
}
export function readingTable(B, M, w = 1.7, d = 0.9, h = 0.76) {                        // big library table
  B.cbox(w, 0.06, d, M.woodDark, 0, h - 0.03, 0, 0, 0, 0, 0.8, null, 0.012);
  B.cbox(w - 0.1, 0.006, d - 0.1, M.leather, 0, h + 0.003, 0, 0, 0, 0, 0.8);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) leg(B, M.woodDark, sx * (w / 2 - 0.09), sz * (d / 2 - 0.09), h - 0.06, 0.04);
  B.cbox(w - 0.2, 0.1, 0.03, M.woodDark, 0, h - 0.11, d / 2 - 0.09, 0, 0, 0, 0.8); B.cbox(w - 0.2, 0.1, 0.03, M.woodDark, 0, h - 0.11, -d / 2 + 0.09, 0, 0, 0, 0.8);
}
export function bankersLamp(ctx, B, x, y, z, intensity = 3.5) {                         // green-shaded brass desk lamp (registers a lamp)
  const { M } = ctx;
  B.cyl(0.07, 0.08, 0.02, M.brass, x, y + 0.01, z, 14); B.cyl(0.012, 0.012, 0.32, M.brass, x, y + 0.18, z, 6);
  B.add(new THREE.CylinderGeometry(0.1, 0.06, 0.12, 14, 1, true), M.shadeGreen, x, y + 0.36, z);
  const flame = new THREE.Mesh(sph(0.012, 6, 5), M.flame); flame.position.set(x, y + 0.31, z); ctx.scene.add(flame);
  return addLamp(ctx, x, y + 0.34, z, { color: 0xffc480, base: intensity, dist: 8, flicker: 0.04, flame });
}
export function grindstone(B, M) {                                                      // 0.6 x 0.3 x 0.9
  B.cyl(0.26, 0.26, 0.08, M.graniteDark, 0, 0.6, 0, 24, 0, 0, Math.PI / 2);
  for (const sx of [-1, 1]) B.cbox(0.04, 0.7, 0.08, M.woodDark, sx * 0.1, 0.35, 0, 0, 0, 0.0, 0.8, null, 0.006);
  B.cbox(0.34, 0.04, 0.3, M.woodDark, 0, 0.02, 0, 0, 0, 0, 0.8);
  B.cyl(0.01, 0.01, 0.34, M.steel, 0, 0.6, 0, 6, 0, 0, Math.PI / 2);
  B.cbox(0.03, 0.2, 0.012, M.ironBlack, 0.19, 0.5, 0, 0, 0, 0.5); B.cyl(0.016, 0.016, 0.1, M.woodDark, 0.19, 0.4, 0.05, 6, Math.PI / 2);
}
export function lensStand(B, M) {                                                       // 0.8 x 0.5 x 1.3: a spare lens panel in a wooden cradle
  B.cbox(0.8, 0.08, 0.5, M.woodDark, 0, 0.04, 0, 0, 0, 0, 0.8, null, 0.008);
  for (const sx of [-1, 1]) B.cbox(0.06, 1.2, 0.08, M.woodDark, sx * 0.36, 0.64, 0, 0, 0, 0, 0.8, null, 0.008);
  B.cbox(0.7, 0.08, 0.08, M.brass, 0, 1.22, 0.0, 0, 0, 0, 0.5, null, 0.006);
  B.cbox(0.7, 0.06, 0.08, M.brass, 0, 0.14, 0.0, 0, 0, 0, 0.5, null, 0.006);
  B.add(new THREE.PlaneGeometry(0.66, 1.04), M.lensSpare, 0, 0.68, 0.0);
}
export function globe(B, M) {                                                           // 0.5 x 0.5 x 1.25
  B.add(lathe([[0.2, 0], [0.18, 0.03], [0.04, 0.08], [0.03, 0.75], [0.001, 0.75]], 12), M.woodDark);
  B.add(sph(0.24, 24, 16), M.chart, 0, 0.98, 0, 0.4, 0.5, 0.3);
  B.add(new THREE.TorusGeometry(0.27, 0.01, 6, 32), M.brass, 0, 0.98, 0, 0, 0.2, 0.4);
}
export function telescope(B, M) {                                                       // brass telescope on a tripod, 0.7 x 0.7 x 1.3
  for (let k = 0; k < 3; k++) B.cyl(0.015, 0.015, 1.25, M.woodDark, Math.cos(k * 2.1) * 0.25, 0.6, Math.sin(k * 2.1) * 0.25, 6, Math.sin(k * 2.1) * 0.22, 0, -Math.cos(k * 2.1) * 0.22);
  B.cyl(0.045, 0.03, 0.9, M.brass, 0, 1.25, 0.1, 12, Math.PI / 2 - 0.15);
  B.cyl(0.05, 0.05, 0.06, M.brass, 0, 1.25, 0.1, 12);
}

// ---------------------------------------------------------------- the open fire
// A brick fireplace with a stone hearth and a chimney breast, in the room's wall colour above the mantel.
export function fireplace(B, M, breastMat, w = 1.7, d = 0.5, h = 2.7) {                // w x d x h; the firebox opening is 0.86 wide, 0.78 high
  const brick = M.brick;
  for (const sx of [-1, 1]) B.cbox(0.4, 1.2, d, brick, sx * (w / 2 - 0.2), 0.6, 0, 0, 0, 0, 0.7, null, 0.012);
  B.cbox(w, 0.32, d, brick, 0, 0.94, 0, 0, 0, 0, 0.7, null, 0.012);                      // lintel above the opening
  B.cbox(w - 0.8, 1.2, 0.08, M.black, 0, 0.6, -d / 2 + 0.07, 0, 0, 0, 0.7);            // the dark back of the firebox
  B.cbox(w + 0.2, 0.07, d + 0.1, M.woodDark, 0, 1.14, 0.03, 0, 0, 0, 0.8, null, 0.012); // the mantel shelf
  B.cbox(w - 0.14, h - 1.2, d - 0.1, breastMat, 0, 1.2 + (h - 1.2) / 2 - 0.01, -0.05, 0, 0, 0, 0.8, null, 0.012);
  B.cbox(w + 0.5, 0.05, d + 0.55, M.graniteDark, 0, 0.025, 0.28, 0, 0, 0, 0.8, null, 0.008);  // hearth stone
  for (const sx of [-1, 1]) B.cbox(0.05, 0.2, 0.05, M.ironBlack, sx * 0.36, 0.12, 0.07);        // andirons
  B.cbox(0.7, 0.04, 0.05, M.ironBlack, 0, 0.18, 0.05);
  for (let i = 0; i < 3; i++) B.cyl(0.07, 0.07, 0.6, i % 2 ? M.woodDark : M.wood, (i - 1) * 0.08, 0.28 + (i === 1 ? 0.12 : 0), 0.0, 8, 0, 0, Math.PI / 2 + (i - 1) * 0.15);
}
const FIRE_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }';
const FIRE_FRAG = `uniform float uTime; uniform float uSeed; varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
  void main(){
    vec2 uv = vUv; float t = uTime * 1.4 + uSeed;
    float x = (uv.x - 0.5) * 2.0;
    float sway = (n(vec2(t * 0.7, uv.y * 2.0)) - 0.5) * 0.7 * uv.y;
    float width = (1.0 - uv.y) * (0.75 + 0.35 * n(vec2(t * 1.3 + 3.0, uv.y * 3.0)));
    float body = smoothstep(width, width * 0.25, abs(x - sway));
    float lick = n(vec2(x * 2.6 + uSeed, uv.y * 3.5 - t * 2.6));
    float a = body * smoothstep(1.02, 0.12, uv.y + (lick - 0.45) * 0.5) * smoothstep(0.0, 0.08, uv.y);
    vec3 col = mix(vec3(1.0, 0.30, 0.04), vec3(1.0, 0.82, 0.34), pow(clamp(1.0 - uv.y * 1.2 + lick * 0.25, 0., 1.), 1.6));
    gl_FragColor = vec4(col * a * 2.2, a);
  }`;
// flames for a hearth: a few crossed, camera-independent quads with an animated shader. Returns { group, mat }.
export function fireFlames(width = 0.7, height = 0.55) {
  const mat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uSeed: { value: Math.random() * 10 } }, vertexShader: FIRE_VERT, fragmentShader: FIRE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const group = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(width * (k === 1 ? 0.8 : 0.6), height * (0.85 + 0.15 * k)), mat);
    m.position.set((k - 1) * width * 0.22, height * 0.45, (k - 1) * 0.06); m.rotation.y = (k - 1) * 0.5; m.frustumCulled = false; group.add(m);
  }
  return { group, mat };
}

// ---------------------------------------------------------------- shelving that fills itself by purpose
export function shelving(B, M, w = 1.2, d = 0.4, h = 1.9, rnd = Math.random, kind = 'store', rows = 5) {   // w x d x h, back toward -z
  const mat = M.woodDark;
  for (const sx of [-1, 1]) B.cbox(0.045, h, d, mat, sx * (w / 2 - 0.0225), h / 2, 0, 0, 0, 0, 0.8, null, 0.006);
  B.cbox(w, h, 0.015, mat, 0, h / 2, -d / 2 + 0.0075, 0, 0, 0, 0.8, null, 0.003);
  const pitch = (h - 0.1) / rows;
  for (let i = 0; i < rows; i++) {
    const sy = 0.1 + i * pitch;
    B.cbox(w - 0.09, 0.03, d - 0.02, mat, 0, sy, 0, 0, 0, 0, 0.8, null, 0.005);
    let x = -w / 2 + 0.1;
    while (x < w / 2 - 0.12) {
      const pick = rnd(), top = sy + 0.015, room = pitch - 0.06;
      let used = 0.1;
      if (kind === 'store') {
        if (pick < 0.3) { const hh = Math.min(room, 0.1 + rnd() * 0.1), r = 0.04 + rnd() * 0.02; B.cyl(r, r, hh, rnd() < 0.5 ? M.tin : M.paintGreen, x, top + hh / 2, 0.02, 10); B.cyl(r + 0.004, r + 0.004, 0.012, M.tin, x, top + hh, 0.02, 10); used = r * 2 + 0.03; }
        else if (pick < 0.55) { const hh = Math.min(room, 0.18 + rnd() * 0.08); B.cyl(0.032, 0.036, hh, M.glassBottle, x, top + hh / 2, 0.0, 8); B.cyl(0.012, 0.016, 0.05, M.glassBottle, x, top + hh + 0.025, 0.0, 6); used = 0.09; }
        else if (pick < 0.8) { const hh = Math.min(room, 0.12 + rnd() * 0.1); B.cbox(0.17, hh, 0.16, M.woodRed, x + 0.03, top + hh / 2, 0.02, 0, (rnd() - 0.5) * 0.3, 0, 0.5, null, 0.006); used = 0.22; }
        else { B.push(x + 0.08, top, 0.02); rope(B, M, 3, 0.1); B.pop(); used = 0.26; }
      } else if (kind === 'pantry') {
        if (pick < 0.45) { const hh = Math.min(room, 0.11 + rnd() * 0.1), r = 0.04 + rnd() * 0.02; B.cyl(r, r, hh, rnd() < 0.5 ? M.ceramic : M.glassBottle, x, top + hh / 2, 0.02, 10); B.cyl(r - 0.003, r - 0.003, 0.012, M.cork, x, top + hh, 0.02, 10); used = r * 2 + 0.03; }
        else if (pick < 0.65) { B.push(x + 0.08, top, 0.0); fruitBowl(B, M); B.pop(); used = 0.26; }
        else if (pick < 0.8) { B.add(sph(0.5, 8, 6), fab(M, 0xc8b690), x + 0.06, top + 0.1, 0.0, 0, 0, 0, 0.2, 0.2, 0.17); used = 0.22; }
        else { B.cyl(0.055, 0.05, 0.1, M.ceramicBlue, x, top + 0.05, 0.02, 10); used = 0.14; }
      } else {   // workshop
        if (pick < 0.35) { const hh = Math.min(room, 0.2 + rnd() * 0.06); B.cbox(0.13, hh, 0.09, M.ironRed, x, top + hh / 2, 0.02, 0, 0, 0, 0.5, null, 0.006); B.cyl(0.012, 0.012, 0.04, M.brass, x + 0.03, top + hh + 0.02, 0.02, 6); used = 0.17; }
        else if (pick < 0.65) { const hh = Math.min(room, 0.2); B.add(cylGeo(0.035, 0.05, hh, 10), M.lampGlass, x, top + hh / 2, 0.02); used = 0.12; }
        else if (pick < 0.85) { B.cyl(0.04, 0.05, 0.05, M.brass, x, top + 0.025, 0.02, 10); B.cyl(0.015, 0.015, 0.06, M.brass, x, top + 0.075, 0.02, 6); used = 0.12; }
        else { B.cbox(0.16, 0.05, 0.12, fab(M, 0xd8d0b0), x + 0.02, top + 0.025, 0.02, 0, rnd() * 0.5, 0, 0.5, null, 0.01); used = 0.2; }
      }
      x += used;
    }
  }
  B.cbox(w + 0.04, 0.03, d + 0.03, mat, 0, h + 0.015, 0, 0, 0, 0, 0.8, null, 0.006);
}

// ---------------------------------------------------------------- the hearth
export function logBasket(B, M) {                                                       // 0.4 round
  B.cyl(0.2, 0.17, 0.3, M.rope, 0, 0.15, 0, 14);
  for (const y of [0.05, 0.15, 0.25]) B.add(new THREE.TorusGeometry(0.19 - (0.3 - y) * 0.1, 0.01, 4, 16), M.woodDark, 0, y, 0, Math.PI / 2);
  for (let i = 0; i < 6; i++) { const a = i * 1.1; B.cyl(0.04, 0.04, 0.34, i % 2 ? M.wood : M.woodDark, Math.cos(a) * 0.07, 0.32 + (i % 3) * 0.02, Math.sin(a) * 0.07, 7, Math.PI / 2, a + 0.3); }
}
export function coalScuttle(B, M) {                                                     // 0.3 x 0.4 x 0.4
  B.add(lathe([[0.001, 0], [0.13, 0], [0.16, 0.18], [0.14, 0.3], [0.1, 0.34], [0.001, 0.3]], 12), M.ironBlack, 0, 0, 0, 0, 0, 0, 1, 1, 1.25);
  B.add(new THREE.TorusGeometry(0.1, 0.008, 4, 12, Math.PI), M.ironBlack, 0, 0.3, 0.1);
  for (let i = 0; i < 6; i++) B.add(sph(0.03, 6, 5), M.black, (i % 3 - 1) * 0.05, 0.32, (i % 2) * 0.07 - 0.05);
}
export function fireIrons(B, M) {                                                       // 0.18 x 0.1 x 0.7 stand with poker, tongs, brush
  B.cyl(0.09, 0.09, 0.015, M.ironBlack, 0, 0.008, 0, 10);
  B.cyl(0.008, 0.008, 0.62, M.ironBlack, 0, 0.32, 0, 5);
  B.add(new THREE.TorusGeometry(0.03, 0.005, 4, 8), M.ironBlack, 0, 0.64, 0);
  for (const [x, a] of [[-0.03, 0.08], [0.0, -0.03], [0.03, -0.1]]) B.cyl(0.006, 0.006, 0.56, M.ironBlack, x, 0.33, 0, 5, 0, 0, a);
}
export function copperPan(B, M, r = 0.12) {                                              // hangs from a peg, origin at the hook, pan faces +z
  B.add(lathe([[0.001, 0], [r, 0], [r * 1.08, r * 0.55], [r * 1.05, r * 0.6], [r * 0.95, r * 0.55], [r * 0.9, 0.012], [0.001, 0.012]], 16), M.copper, 0, -r * 1.3, 0.06, Math.PI / 2, 0, 0);
  B.cyl(0.008, 0.008, 0.22, M.ironBlack, 0, -r * 1.3 - r - 0.1, 0.06, 5);
}

// ---------------------------------------------------------------- the bed
export function bedstead(B, M) {                                                        // 1.25 x 2.05 x 1.2; head toward -z
  const wood = M.woodDark;
  for (const sx of [-1, 1]) {
    B.cbox(0.06, 0.2, 2.0, wood, sx * 0.6, 0.3, 0, 0, 0, 0, 0.8, null, 0.01);
    B.cyl(0.035, 0.04, 1.2, wood, sx * 0.62, 0.6, -1.0, 8); B.add(sph(0.045, 8, 6), wood, sx * 0.62, 1.22, -1.0);
    B.cyl(0.035, 0.04, 0.7, wood, sx * 0.62, 0.35, 1.0, 8); B.add(sph(0.04, 8, 6), wood, sx * 0.62, 0.72, 1.0);
  }
  B.cbox(1.2, 0.8, 0.05, wood, 0, 0.8, -1.0, 0, 0, 0, 0.8, null, 0.01);
  B.cbox(1.2, 0.34, 0.05, wood, 0, 0.5, 1.0, 0, 0, 0, 0.8, null, 0.01);
  B.cbox(1.12, 0.22, 1.94, fab(M, 0xe2dccc), 0, 0.5, 0, 0, 0, 0, 0.6, null, 0.03);                  // mattress
  B.cbox(1.16, 0.06, 0.7, fab(M, 0xe8e2d2), 0, 0.62, -0.62, 0, 0, 0, 0.6, null, 0.015);            // turned-down sheet
  B.cbox(1.18, 0.1, 1.3, M.quilt, 0, 0.64, 0.3, 0, 0, 0, 0.6, null, 0.03);                         // patchwork quilt
  B.cbox(1.12, 0.07, 0.34, fab(M, 0x9a4a2a), 0, 0.71, 0.88, 0, 0, 0, 0.5, null, 0.025);            // folded wool blanket
  for (const sx of [-1, 1]) B.add(sph(0.5, 12, 8), fab(M, 0xf0ece0), sx * 0.27, 0.69, -0.76, 0, 0, 0, 0.5, 0.16, 0.34);
}

// ---------------------------------------------------------------- decoration
export function curtainPair(B, M, fabric, yTop = 2.45, yBottom = 0.85, wOpening = 1.04) {  // origin at the window centre on the wall face (floor level); drapes toward +z
  const mat = typeof fabric === 'number' ? fab(M, fabric, true) : fabric;
  const h = yTop - yBottom, rod = wOpening + 0.8;
  B.cyl(0.012, 0.012, rod, M.brass, 0, yTop + 0.03, 0.1, 8, 0, 0, Math.PI / 2);
  for (const sx of [-1, 1]) B.add(sph(0.025, 8, 6), M.brass, sx * (rod / 2 + 0.01), yTop + 0.03, 0.1);
  for (const side of [-1, 1]) {
    const w = 0.5, geo = new THREE.PlaneGeometry(w, h, 20, 4), p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      p.setZ(i, 0.1 + Math.sin((x + w / 2) / 0.12 * Math.PI * 2) * 0.03 * (0.7 + 0.3 * (y / h + 0.5)));
      uv.setXY(i, (x + w / 2) / 0.5, (y + h / 2) / 0.5);
    }
    geo.computeVertexNormals();
    B.add(geo, mat, side * (wOpening / 2 + 0.1), yBottom + h / 2, 0);
  }
}
export function mirror(B, M, w = 0.4, h = 0.55) {                                       // oval mirror on the wall, origin at its centre
  B.add(new THREE.TorusGeometry(0.5, 0.04, 6, 24), M.woodDark, 0, 0, 0.02, 0, 0, 0, w, h, 1);
  B.add(new THREE.CircleGeometry(0.5, 24), M.steel, 0, 0, 0.02, 0, 0, 0, w * 0.96, h * 0.96, 1);
}
export function shipModel(B, M) {                                                       // 0.6 x 0.2 x 0.4 on a stand, bow toward +x
  B.cbox(0.18, 0.01, 0.1, M.woodDark, 0, 0.005, 0, 0, 0, 0, 0.4, null, 0.003);
  B.cbox(0.5, 0.06, 0.13, M.paintBlue, 0, 0.06, 0, 0, 0, 0, 0.5, null, 0.01);
  B.add(new THREE.ConeGeometry(0.065, 0.12, 4), M.paintBlue, 0.3, 0.06, 0, 0, Math.PI / 4, -Math.PI / 2, 1, 1, 0.6);
  B.cbox(0.18, 0.025, 0.12, M.paintWhite, -0.1, 0.1, 0, 0, 0, 0, 0.4, null, 0.004);
  for (const [x, hh] of [[-0.12, 0.34], [0.07, 0.4], [0.2, 0.28]]) {
    B.cyl(0.006, 0.008, hh, M.woodDark, x, 0.09 + hh / 2, 0, 5);
    B.box(0.003, hh * 0.55, 0.15, fab(M, 0xe8e0c8, true), x, 0.09 + hh * 0.6, 0, 0, 0, 0, 0.5);
  }
}
export function rope(B, M, n = 6, r = 0.25) {                                            // coil of rope, origin on the floor
  for (let i = 0; i < n; i++) B.add(new THREE.TorusGeometry(r - i * 0.012, 0.025, 6, 20), M.rope, 0, 0.03 + i * 0.05, 0, Math.PI / 2);
}
export function ladder(B, M, h = 2.2) {                                                  // 0.42 wide, leans back 0.3 m; origin at the foot
  const tilt = Math.atan2(0.3, h);
  B.push(0, 0, 0, 0, -tilt);                                                             // the top leans back toward -z, the wall
  for (const sx of [-1, 1]) B.cbox(0.04, h, 0.04, M.wood, sx * 0.21, h / 2, 0, 0, 0, 0, 0.8, null, 0.004);
  for (let y = 0.3; y < h - 0.1; y += 0.3) B.cyl(0.014, 0.014, 0.42, M.wood, 0, y, 0, 6, 0, 0, Math.PI / 2);
  B.pop();
}
export function sack(B, M, hex = 0x8a7a5a, h = 0.45) {                                   // 0.4 x 0.3 x h
  B.add(sph(0.5, 10, 8), fab(M, hex), 0, h * 0.45, 0, 0, 0, 0, 0.4, h * 0.9, 0.32);
  B.add(sph(0.5, 8, 6), fab(M, hex), 0.02, h * 0.92, 0, 0, 0.4, 0.1, 0.16, 0.12, 0.14);
}

// ---------------------------------------------------------------- carried over from the old interior (upgraded)
export function barrel(B, M, h = 0.95, r = 0.32) {
  B.add(lathe([[0.001, 0], [r * 0.85, 0], [r, h * 0.5], [r * 0.85, h], [0.001, h]], 18), M.wood);
  for (const t of [0.12, 0.35, 0.65, 0.88]) { const rr = r * (0.85 + 0.15 * Math.sin(Math.PI * t)) + 0.006; B.add(new THREE.TorusGeometry(rr, 0.012, 4, 22), M.ironBlack, 0, h * t, 0, Math.PI / 2); }
}
export function crate(B, M, s = 0.6) {
  B.cbox(s, s, s, M.woodRed, 0, s / 2, 0, 0, 0, 0, 0.6, null, 0.01);
  for (const z of [-1, 1]) { B.box(s + 0.02, 0.06, 0.02, M.woodDark, 0, s * 0.15, z * s / 2); B.box(s + 0.02, 0.06, 0.02, M.woodDark, 0, s * 0.85, z * s / 2); B.box(0.06, s, 0.02, M.woodDark, z * (s / 2 - 0.03), s / 2, s / 2); }
}
export function jars(B, M, w, y, rnd, n = 6) {
  const mats = [M.ceramic, M.ceramicBlue, M.glassBottle, M.tin, M.ceramic];
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.1 + (w - 0.2) * (i + 0.5) / n, h = 0.12 + rnd() * 0.14, r = 0.04 + rnd() * 0.035;
    B.cyl(r, r, h, mats[Math.floor(rnd() * mats.length)], x, y + h / 2 + 0.02, 0.12, 10);
  }
}
export function books(B, M, w, y, rnd, depth = 0.22) {
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
export function bookcase(B, M, w, h, rnd, n = 5) {
  const d = 0.34;
  B.cbox(w, h, 0.02, M.woodDark, 0, h / 2, 0.01, 0, 0, 0, 0.8, null, 0.004);
  for (const sx of [-1, 1]) B.cbox(0.04, h, d, M.woodDark, sx * (w / 2 - 0.02), h / 2, d / 2, 0, 0, 0, 0.8, null, 0.006);
  B.cbox(w + 0.04, 0.06, d + 0.04, M.woodDark, 0, h - 0.03, d / 2, 0, 0, 0, 0.8, null, 0.008);
  for (let i = 0; i < n; i++) {
    const y = 0.08 + i * (h - 0.15) / n;
    B.cbox(w - 0.06, 0.03, d - 0.02, M.woodDark, 0, y, d / 2, 0, 0, 0, 0.8, null, 0.004);
    books(B, M, w - 0.12, y + 0.015, rnd, d - 0.06);
  }
}
export function painting(B, M, w, h, mat) {
  B.cbox(w + 0.1, h + 0.1, 0.04, M.woodDark, 0, 0, 0.02, 0, 0, 0, 0.8, null, 0.01);
  B.add(new THREE.PlaneGeometry(w, h), mat, 0, 0, 0.045);
}
export function rugAt(B, mat, x, y, z, w, d, ry = 0) { B.add(new THREE.PlaneGeometry(w, d), mat, x, y + 0.008, z, -Math.PI / 2, ry, 0); }
export function rugRound(B, mat, x, y, z, r) { B.add(new THREE.CircleGeometry(r, 40), mat, x, y + 0.009, z, -Math.PI / 2, 0, 0); }

// ---------------------------------------------------------------- lamps: visible fixture + a virtual lamp for the light pool
const Yaxis = new THREE.Vector3(0, 1, 0);
// world position of a local offset on an object standing against the wall at angle aDeg / radius r (local +z faces the axis)
export function toWorld(aDeg, r, y, lx = 0, ly = 0, lz = 0) {
  const a = aDeg * DEG;
  return new THREE.Vector3(lx, ly, lz).applyAxisAngle(Yaxis, faceIn(a)).add(new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a)));
}
const flameMesh = (ctx, x, y, z, r = 0.014, sy = 2) => { const f = new THREE.Mesh(sph(r, 8, 6), ctx.M.flame); f.scale.y = sy; f.position.set(x, y, z); ctx.scene.add(f); return f; };
const glassMesh = (ctx, geo, x, y, z) => { const m = new THREE.Mesh(geo, ctx.M.lampGlass); m.position.set(x, y, z); ctx.scene.add(m); return m; };
export function wallLamp(ctx, B, aDeg, y, intensity = 6, opts = {}) {
  const { M } = ctx, r = R_IN - 0.01, a = aDeg * DEG;
  B.push(r * Math.cos(a), y, r * Math.sin(a), faceIn(a));
  B.box(0.1, 0.16, 0.03, M.brass, 0, 0, 0.015); B.box(0.02, 0.02, 0.22, M.brass, 0, -0.03, 0.12);
  B.add(lathe([[0.001, -0.02], [0.06, -0.02], [0.075, 0.03], [0.04, 0.07], [0.02, 0.09], [0.001, 0.09]], 14), M.brass, 0, -0.06, 0.25);
  B.cyl(0.012, 0.012, 0.03, M.brass, 0, 0.04, 0.25, 6);
  B.pop();
  const gp = toWorld(aDeg, r, y, 0, 0.14, 0.25);
  glassMesh(ctx, lathe([[0.03, -0.1], [0.05, -0.05], [0.045, 0.02], [0.025, 0.1], [0.026, 0.13]], 14), gp.x, gp.y, gp.z);
  const flame = flameMesh(ctx, gp.x, gp.y - 0.06, gp.z);
  const p = toWorld(aDeg, r, y, 0, 0.1, 0.6);
  return addLamp(ctx, p.x, p.y, p.z, { color: opts.color, base: intensity, dist: opts.dist ?? 9, flicker: 0.1, flame });
}
export function sconce(ctx, B, aDeg, y, intensity = 3, opts = {}) {      // candle on a brass arm, with a little mirror behind it
  const { M } = ctx, r = R_IN - 0.01, a = aDeg * DEG;
  B.push(r * Math.cos(a), y, r * Math.sin(a), faceIn(a));
  B.add(new THREE.CircleGeometry(0.09, 16), M.steel, 0, 0.02, 0.012);
  B.cbox(0.2, 0.012, 0.012, M.brass, 0, -0.1, 0.03, 0, 0, 0, 0.5, null, 0.003);
  B.cyl(0.035, 0.03, 0.012, M.brass, 0, -0.095, 0.14, 12);
  B.cyl(0.02, 0.02, 0.16, M.candle, 0, -0.02, 0.14, 10);
  B.pop();
  const p = toWorld(aDeg, r, y, 0, 0.09, 0.14);
  const flame = flameMesh(ctx, p.x, p.y, p.z, 0.011, 2.4);
  const q = toWorld(aDeg, r, y, 0, 0.1, 0.45);
  return addLamp(ctx, q.x, q.y, q.z, { color: opts.color, base: intensity, dist: opts.dist ?? 7, flicker: 0.2, flame });
}
export function tableLamp(ctx, B, x, y, z, intensity = 4, opts = {}) {
  const { M } = ctx;
  B.add(lathe([[0.001, 0], [0.08, 0], [0.085, 0.02], [0.05, 0.05], [0.07, 0.12], [0.06, 0.16], [0.02, 0.18], [0.001, 0.18]], 16), M.brass, x, y, z);
  glassMesh(ctx, lathe([[0.035, 0], [0.06, 0.06], [0.05, 0.12], [0.028, 0.2], [0.03, 0.26]], 14), x, y + 0.18, z);
  const flame = flameMesh(ctx, x, y + 0.24, z, 0.015, 2.2);
  return addLamp(ctx, x, y + 0.3, z, { color: opts.color, base: intensity, dist: opts.dist ?? 9, flicker: 0.1, flame });
}
export function candle(ctx, B, x, y, z, intensity = 2.2, opts = {}) {
  const { M } = ctx;
  B.cyl(0.07, 0.08, 0.02, M.brass, x, y + 0.01, z, 12); B.cyl(0.022, 0.022, 0.16, M.candle, x, y + 0.1, z, 10);
  const flame = flameMesh(ctx, x, y + 0.205, z, 0.012, 2.4);
  return addLamp(ctx, x, y + 0.3, z, { color: opts.color, base: intensity, dist: opts.dist ?? 7, flicker: 0.2, flame });
}
export function hangingLamp(ctx, B, x, yCeil, z, drop = 0.55, intensity = 5, opts = {}) {   // brass lamp on a chain from the beams
  const { M } = ctx, y = yCeil - drop;
  B.cyl(0.005, 0.005, drop - 0.1, M.ironBlack, x, yCeil - (drop - 0.1) / 2, z, 4);
  B.cyl(0.12, 0.05, 0.08, M.brass, x, y + 0.12, z, 12); B.cyl(0.04, 0.05, 0.06, M.brass, x, y - 0.1, z, 10);
  glassMesh(ctx, cylGeo(0.06, 0.08, 0.2, 12), x, y, z);
  const flame = flameMesh(ctx, x, y - 0.04, z, 0.016, 2.2);
  return addLamp(ctx, x, y, z, { color: opts.color, base: intensity, dist: opts.dist ?? 10, flicker: 0.1, flame });
}
export function stormLantern(ctx, B, x, y, z, intensity = 3.5, opts = {}) {                 // hurricane lantern hung from a hook or standing
  const { M } = ctx;
  B.cyl(0.07, 0.075, 0.025, M.ironBlack, x, y + 0.012, z, 10); B.cyl(0.05, 0.07, 0.03, M.ironBlack, x, y + 0.04, z, 10);
  B.cyl(0.075, 0.06, 0.025, M.ironBlack, x, y + 0.24, z, 10); B.cyl(0.03, 0.04, 0.03, M.ironBlack, x, y + 0.27, z, 8);
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4; B.cyl(0.005, 0.005, 0.2, M.ironBlack, x + Math.cos(a) * 0.065, y + 0.14, z + Math.sin(a) * 0.065, 4); }
  B.add(new THREE.TorusGeometry(0.06, 0.005, 4, 14, Math.PI), M.ironBlack, x, y + 0.29, z);
  glassMesh(ctx, cylGeo(0.05, 0.06, 0.2, 12), x, y + 0.14, z);
  const flame = flameMesh(ctx, x, y + 0.1, z, 0.014, 2);
  return addLamp(ctx, x, y + 0.2, z, { color: opts.color, base: intensity, dist: opts.dist ?? 8, flicker: 0.15, flame });
}

// ---------------------------------------------------------------- where the stairs are
// Angles in degrees on the plan (x = cos a, z = sin a). For each floor: the stretch of wall that is stairs (the low
// part of the flight), the stairwell opening where the previous flight arrives, and the corridor between the two,
// which must stay clear. Under the higher part of a flight there is walkable space (the "nook") with limited headroom.
const norm = (a) => ((a % 360) + 360) % 360;
const span = (from, to) => norm(to - from);
const inArc = (a, from, to) => span(from, a) <= span(from, to);
const flightInfo = (i) => {
  const s = STAIRS[i], rise = FLOOR_H / s.steps, d = s.span / s.steps;
  let kb = 0; while ((kb + 1) * rise - 0.2 < 1.8) kb++;                       // first steps with less than 1.8 m underneath
  let kh = 0; while ((kh + 1) * rise < FLOOR_H - 0.3 - 2.05) kh++;            // steps still under the floor above
  return { a0: s.start, a1: s.start + s.span, d, rise, kb, kh, r0: s.r0, r1: s.r1 };
};
export function stairZones(floor) {
  const z = { blocked: [], corridor: null, nook: null, arrive: null, start: null, inner: null, hole: null };
  const f = flightInfo(floor), wallFlight = floor < N_FLOORS - 1;
  z.start = norm(f.a0);
  if (wallFlight) {
    z.blocked.push([norm(f.a0 - 7), norm(f.a0 + f.kb * f.d + 3)]);            // low treads and the approach to them
    z.nook = { from: norm(f.a0 + f.kb * f.d + 3), to: norm(f.a1), a0: f.a0, d: f.d, rise: f.rise, r0: f.r0 };
  } else z.inner = { from: norm(f.a0), to: norm(f.a1), r0: f.r0, r1: f.r1 };   // the last flight winds round the clockwork
  if (floor > 0) {
    const p = flightInfo(floor - 1);
    z.hole = [norm(p.a0 + p.kh * p.d - 3 - 5), norm(p.a1 + 9)];                 // the opening, with a landing beyond it
    z.blocked.push(z.hole);
    z.arrive = norm(p.a1);
  } else z.arrive = 90;                                                          // the door
  if (wallFlight) z.corridor = [norm(z.arrive), norm(z.start - 7)];
  return z;
}
// headroom under the flight of `floor` at angle a, radius r (null = no stair overhead)
export function headroomAt(floor, a, r) {
  const z = stairZones(floor).nook; if (!z || r < z.r0 - 0.05) return null;
  if (!inArc(norm(a), z.from, z.to)) return null;
  const k = Math.floor(span(z.a0, norm(a)) / z.d);
  return (k + 1) * z.rise - 0.2 - 0.05;
}
// angular half-width of a w-wide piece seen from the axis at radius r
export const halfAngle = (w, r) => Math.asin(Math.min(1, (w / 2) / r)) / DEG;
export { inArc, norm, span };

// check a footprint (array of [x, z] sample points) of height h on `floor` against the stairs; returns a list of problems
export function checkFootprint(floor, pts, h) {
  const z = stairZones(floor), out = [];
  for (const [x, zz] of pts) {
    const r = Math.hypot(x, zz), a = norm(Math.atan2(zz, x) / DEG);
    if (r < 2.6) continue;                                                  // the middle of the room is always clear of stairs
    if (r > R_IN + 0.05) continue;
    for (const [from, to] of z.blocked) if (inArc(a, from, to)) { out.push(`on the stairs or stairwell (${a.toFixed(0)}\u00b0, r ${r.toFixed(1)})`); break; }
    if (z.corridor && inArc(a, z.corridor[0], z.corridor[1])) out.push('in the corridor between stairwell and next flight');
    if (z.nook && r > z.nook.r0 - 0.05) { const hr = headroomAt(floor, a, r); if (hr !== null && h > hr) out.push(`too tall (${h.toFixed(2)} m) under the stairs (headroom ${hr.toFixed(2)} m at ${a.toFixed(0)}\u00b0)`); }
    if (z.inner && r > z.inner.r0 - 0.35 && r < z.inner.r1 + 0.35 && inArc(a, z.inner.from, z.inner.to)) out.push('on the inner flight');
  }
  return [...new Set(out)];
}
