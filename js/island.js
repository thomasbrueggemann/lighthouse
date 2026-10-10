import * as THREE from 'three';
import { Noise2D, mulberry32 } from './noise.js';
import { Builder, boxGeo, cylGeo, lathe, GeoBuilder } from './geom.js';
import { SHED, CAVE, R_OUT_BASE, TAU, DEG, clamp, lerp, smoothstep, angDiff } from './config.js';

const NZ = new Noise2D(1337);
const STACKS = [[-41, 6, 6.5, 8], [-31, -28, 5, 5.5], [29, -36, 6.5, 9], [44, 15, 4.5, 4.5], [17, 43, 4, 3.5], [-22, 38, 3.5, 2.5]];
export const JETTY = { x0: -1.05, x1: 1.05, z0: 26.0, z1: 38.0, y: 2.35 };
export const STEPS = { z0: 13.5, z1: 22.5, y0: 7.0, y1: 2.0, n: 20, hw: 1.15 };
export const SHELF_Y = 2.0;

function coastR(a) {
  const n = 4.5 * NZ.noise(Math.cos(a) * 1.3 + 10, Math.sin(a) * 1.3 + 10) + 2.2 * NZ.noise(Math.cos(a) * 3.1 + 3, Math.sin(a) * 3.1 - 7);
  const south = Math.exp(-Math.pow(angDiff(a, Math.PI / 2) / 0.45, 2));
  return lerp(25.5 + n, 27, south);
}

export function terrainHeight(x, z) {
  const r = Math.hypot(x, z), a = Math.atan2(z, x);
  const south = Math.exp(-Math.pow(angDiff(a, Math.PI / 2) / 0.45, 2));
  const coast = coastR(a);
  const cliffW = lerp(8.5, 13, south);
  const plateauR = coast - cliffW;
  const und = NZ.fbm(x * 0.08, z * 0.08, 4) * 0.5;
  const outcrop = Math.max(0, NZ.fbm(x * 0.12 + 5, z * 0.12 - 3, 4) - 0.12) * 4.5;
  const top = 7 + (und + outcrop) * smoothstep(9.5, 15, r);
  let h;
  const d = r - plateauR;
  if (d <= 0) h = top;
  else {
    const t = d / cliffW;
    const g = smoothstep(0, 1.75, t);
    h = top - (top + 8) * g;
    const rug = (NZ.ridged(x * 0.16, z * 0.16, 4) - 0.55) * 4.0 * Math.sin(Math.PI * clamp(t * 0.9, 0, 1));
    h += rug;
    const ledge = Math.floor(h / 1.7) * 1.7;
    h = lerp(h, ledge + (h - ledge) * 0.3, 0.35 * (1 - south));
    h += NZ.fbm(x * 0.5, z * 0.5, 3) * 0.6;
  }
  // sea stacks
  for (const [sx, sz, sr, sh] of STACKS) {
    const dd = Math.hypot(x - sx, z - sz) / sr;
    if (dd < 1.7) {
      const n = (NZ.ridged(x * 0.35 + sx, z * 0.35 + sz, 4) - 0.5) * 3.0 + NZ.fbm(x * 0.9, z * 0.9, 3) * 0.8;
      const e = dd + NZ.noise(x * 0.45 + sx, z * 0.45) * 0.22 + NZ.noise(x * 1.3, z * 1.3) * 0.06;
      const hs = lerp(sh + n, -7, smoothstep(0.72, 1.12, e) * 0.55 + smoothstep(1.0, 1.7, e) * 0.45);
      h = Math.max(h, hs);
    }
  }
  // flatten around the tower (and tuck the ground under its floor)
  h = lerp(7, h, smoothstep(9.0, 12.0, r));
  if (r < 5.5) h = 6.8;
  // flatten under the oil store
  const wsd = Math.max(Math.abs(x - SHED.x) - SHED.w / 2 - 1.0, Math.abs(z - SHED.z) - SHED.d / 2 - 1.0);
  h = lerp(7, h, smoothstep(0, 2.2, wsd));
  // solid rock over the sea cave
  const dc = Math.hypot(x - CAVE.x, z - CAVE.z);
  h = Math.max(h, lerp(7, h, smoothstep(6, 9.5, dc)));
  // landing shelf
  const sw = 1 - smoothstep(0, 2.2, Math.max(Math.abs(x) - 4.5, Math.abs(z - 25) - 3.2));
  h = lerp(h, SHELF_Y + NZ.noise(x * 0.7, z * 0.7) * 0.12 - 0.05, sw);
  // stair cut
  if (z > STEPS.z0 - 0.6 && z < STEPS.z1 + 0.5) {
    const ramp = lerp(STEPS.y0, STEPS.y1, clamp((z - STEPS.z0) / (STEPS.z1 - STEPS.z0), 0, 1)) - 0.3 * (1 - smoothstep(STEPS.z1 - 1.2, STEPS.z1 + 0.4, z));
    const ax = Math.abs(x);
    if (ax < 1.4) h = Math.min(h, ramp);
    else if (ax < 3.0) h = Math.min(h, lerp(ramp, h, smoothstep(1.4, 3.0, ax)) + 0.0);
  }
  return h;
}

export const terrain = {
  height: terrainHeight,
  valid: (x, z) => Math.hypot(x, z) > R_OUT_BASE + 0.05,
};

export function makeIslandTexture() {
  const S = 256, size = 160, min = -80;
  const data = new Uint16Array(S * S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const x = min + (i + 0.5) / S * size, z = min + (j + 0.5) / S * size;
    data[j * S + i] = THREE.DataUtils.toHalfFloat(terrainHeight(x, z));
  }
  const t = new THREE.DataTexture(data, S, S, THREE.RedFormat, THREE.HalfFloatType);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return { tex: t, rect: new THREE.Vector3(min, min, size) };
}

export function shorePoints() {
  const pts = [];
  for (let a = 0; a < 360; a += 2.5) {
    const ar = a * DEG, c = Math.cos(ar), s = Math.sin(ar);
    for (let r = 10; r < 70; r += 0.4) {
      if (terrainHeight(c * r, s * r) < 0.2) { pts.push({ x: c * (r - 0.4), z: s * (r - 0.4), nx: c, nz: s }); break; }
    }
  }
  for (const [sx, sz, sr] of STACKS) {
    for (let a = 0; a < 360; a += 30) {
      const ar = a * DEG, c = Math.cos(ar), s = Math.sin(ar);
      pts.push({ x: sx + c * sr * 1.05, z: sz + s * sr * 1.05, nx: c, nz: s });
    }
  }
  for (let x = -4; x <= 4; x += 2) pts.push({ x, z: 28.4, nx: 0, nz: 1 });
  for (const p of pts) p.exposure = Math.max(0.2, -(p.nx * 0.97 + p.nz * 0.24)) ;
  return pts;
}

function rockGeo(rnd, detail = 2) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position, v = new THREE.Vector3();
  const sx = 0.7 + rnd() * 0.6, sy = 0.5 + rnd() * 0.5, sz = 0.7 + rnd() * 0.6, o = rnd() * 100;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = 1 + NZ.fbm(v.x * 1.3 + o, v.z * 1.3 + v.y * 0.7, 3) * 0.35;
    p.setXYZ(i, v.x * n * sx, v.y * n * sy, v.z * n * sz);
  }
  g.computeVertexNormals();
  return g;
}

export function buildIsland(ctx) {
  const { scene, M, col } = ctx;
  const group = new THREE.Group(); group.name = 'island'; scene.add(group);

  // ---- terrain
  const SIZE = 150, SEG = 300;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const nor = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), ny = nor.getY(i);
    let r = 0.78, g = 0.76, b = 0.74;
    const turf = smoothstep(0.82, 0.93, ny) * smoothstep(5.0, 6.5, y) * smoothstep(-0.15, 0.25, NZ.fbm(x * 0.15 + 3, z * 0.15, 3));
    const worn = 1 - smoothstep(6.5, 9.5, Math.hypot(x, z));
    const tf = turf * (1 - worn * 0.7);
    r = lerp(r, 0.34, tf); g = lerp(g, 0.40, tf); b = lerp(b, 0.2, tf);
    const weed = smoothstep(2.2, 0.6, y) * smoothstep(-2.5, -0.5, y);
    r = lerp(r, 0.55, weed); g = lerp(g, 0.5, weed); b = lerp(b, 0.36, weed);
    const k = 0.85 + NZ.noise(x * 0.3, z * 0.3) * 0.15;
    colors[i * 3] = r * k; colors[i * 3 + 1] = g * k; colors[i * 3 + 2] = b * k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  // split into a 6x6 grid of chunks that share the vertex buffers: each gets its own bounds, so the main pass and
  // every shadow-map face cull the parts of the island they cannot see
  const N = 6, per = SEG / N, row = SEG + 1, srcIdx = geo.index.array;
  const chunkIdx = Array.from({ length: N * N }, () => []);
  for (let t = 0; t < srcIdx.length; t += 3) {
    const a = srcIdx[t], ix = a % row, iy = (a / row) | 0;
    chunkIdx[Math.min(N - 1, (iy / per) | 0) * N + Math.min(N - 1, (ix / per) | 0)].push(srcIdx[t], srcIdx[t + 1], srcIdx[t + 2]);
  }
  for (let c = 0; c < N * N; c++) {
    const idx = chunkIdx[c]; if (!idx.length) continue;
    const g = new THREE.BufferGeometry();
    for (const k of ['position', 'normal', 'uv', 'color']) g.setAttribute(k, geo.attributes[k]);
    g.setIndex(idx);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const v of idx) {
      const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2);
    const land = new THREE.Mesh(g, M.rock);
    land.receiveShadow = true; land.castShadow = true; land.name = 'terrain';
    group.add(land);
  }


  const B = new Builder();
  const rnd = mulberry32(99);

  // ---- boulders along the shore and cliffs
  for (let i = 0; i < 140; i++) {
    const a = rnd() * TAU, cr = coastR(a);
    const r = cr - 1 - rnd() * 9;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(x) < 6 && z > 12 && z < 40) continue;
    const h = terrainHeight(x, z);
    if (h > 6.2) continue;
    const s = 0.5 + rnd() * rnd() * 2.6;
    B.add(rockGeo(rnd), M.rock, x, h - s * 0.25, z, rnd() * 3, rnd() * 3, rnd() * 3, s, s, s);
  }
  for (const [sx, sz, sr] of STACKS) for (let i = 0; i < 9; i++) {
    const a = rnd() * TAU, r = sr * (0.9 + rnd() * 0.7), x = sx + Math.cos(a) * r, z = sz + Math.sin(a) * r;
    const s = 0.8 + rnd() * 1.8;
    B.add(rockGeo(rnd), M.rock, x, terrainHeight(x, z) - s * 0.3, z, rnd() * 3, rnd() * 3, 0, s, s, s);
  }

  // ---- carved stone steps down to the landing
  const SB = new Builder();
  const tread = (STEPS.z1 - STEPS.z0) / STEPS.n, rise = (STEPS.y0 - STEPS.y1) / STEPS.n;
  for (let k = 0; k < STEPS.n; k++) {
    const top = STEPS.y0 - (k + 1) * rise, zc = STEPS.z0 + (k + 0.5) * tread;
    SB.box(STEPS.hw * 2 + (rnd() - 0.5) * 0.1, 0.7, tread + 0.06, M.granite, (rnd() - 0.5) * 0.05, top - 0.35, zc, 0, (rnd() - 0.5) * 0.03, 0, 1.2);
  }
  SB.box(3.0, 0.6, 1.2, M.granite, 0, 6.75, STEPS.z0 - 0.55, 0, 0, 0, 1.2);
  const stepMeshes = SB.build(group, { name: 'steps' });
  stepMeshes.forEach(m => col.addWalk(m, 'stone'));
  col.addSeg(-STEPS.hw - 0.1, STEPS.z0 - 0.2, -STEPS.hw - 0.1, STEPS.z1 + 0.2, -10, 30);
  col.addSeg(STEPS.hw + 0.1, STEPS.z0 - 0.2, STEPS.hw + 0.1, STEPS.z1 + 0.2, -10, 30);
  // rope handrail on iron posts
  for (const side of [-1, 1]) {
    const pts = [];
    for (let k = 0; k <= STEPS.n; k += 4) {
      const z = STEPS.z0 + k * tread, y = STEPS.y0 - k * rise;
      B.cyl(0.035, 0.04, 1.1, M.ironBlack, side * (STEPS.hw + 0.05), y + 0.45, z, 8);
      B.add(new THREE.SphereGeometry(0.05, 8, 6), M.ironBlack, side * (STEPS.hw + 0.05), y + 1.0, z);
      pts.push(new THREE.Vector3(side * (STEPS.hw + 0.05), y + 0.95, z));
    }
    const sag = [];
    for (let i = 0; i < pts.length - 1; i++) {
      for (let s = 0; s < 6; s++) { const t = s / 6; const p = pts[i].clone().lerp(pts[i + 1], t); p.y -= Math.sin(t * Math.PI) * 0.12; sag.push(p); }
    }
    sag.push(pts[pts.length - 1]);
    B.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sag), 80, 0.022, 5), M.rope);
  }

  // ---- jetty
  const JB = new Builder();
  for (let z = JETTY.z0; z < JETTY.z1; z += 0.27) {
    JB.box(2.1 + (rnd() - 0.5) * 0.1, 0.07, 0.24, M.jettyWood, (rnd() - 0.5) * 0.04, JETTY.y - 0.035, z + 0.12, 0, (rnd() - 0.5) * 0.02, (rnd() - 0.5) * 0.02, 1.0);
  }
  const jettyMeshes = JB.build(group, { name: 'jetty' });
  jettyMeshes.forEach(m => col.addWalk(m, 'wood'));
  for (let z = JETTY.z0 + 1.0; z <= JETTY.z1; z += 2.2) for (const x of [-1.0, 1.0]) {
    B.cyl(0.13, 0.15, 7.0, M.woodDark, x, JETTY.y - 3.5 + 0.25, z, 10);
    B.box(0.12, 0.22, 2.3, M.woodDark, x, JETTY.y - 0.2, z - 1.1, 0, 0, 0, 0.8);
  }
  for (const x of [-1.07, 1.07]) B.box(0.14, 0.14, JETTY.z1 - JETTY.z0, M.woodDark, x, JETTY.y + 0.07, (JETTY.z0 + JETTY.z1) / 2, 0, 0, 0, 0.8);
  B.box(2.3, 0.14, 0.14, M.woodDark, 0, JETTY.y + 0.07, JETTY.z1, 0, 0, 0, 0.8);
  for (const [x, z] of [[-0.85, 31], [0.85, 36.5]]) {
    B.cyl(0.11, 0.13, 0.45, M.ironBlack, x, JETTY.y + 0.22, z, 12);
    B.cyl(0.16, 0.16, 0.05, M.ironBlack, x, JETTY.y + 0.46, z, 12);
  }
  col.addSeg(-1.1, JETTY.z0 + 0.6, -1.1, JETTY.z1, JETTY.y - 0.5, JETTY.y + 0.9);
  col.addSeg(1.1, JETTY.z0 + 0.6, 1.1, JETTY.z1, JETTY.y - 0.5, JETTY.y + 0.9);
  col.addSeg(-1.1, JETTY.z1, 1.1, JETTY.z1, JETTY.y - 0.5, JETTY.y + 0.9);
  // landing-shelf clutter: lobster pots, rope, crates
  for (const [x, z] of [[3.3, 23.4], [3.9, 24.2], [-3.6, 23.6]]) {
    const y = terrainHeight(x, z);
    B.add(lathe([[0.001, 0], [0.32, 0], [0.34, 0.2], [0.3, 0.42], [0.12, 0.5], [0.001, 0.5]], 10), M.rope, x, y, z);
    col.addCircle(x, z, 0.33, y, y + 0.5);
  }
  for (let i = 0; i < 6; i++) B.add(new THREE.TorusGeometry(0.32 - i * 0.02, 0.035, 6, 20), M.rope, -2.6, terrainHeight(-2.6, 24.6) + 0.04 + i * 0.06, 24.6, Math.PI / 2);

  // ---- low dry-stone wall around the plateau edge
  const wallPts = [];
  for (let a = 0; a < 360; a += 4) {
    const ar = a * DEG, c = Math.cos(ar), s = Math.sin(ar);
    let r = 9;
    for (; r < 30; r += 0.25) if (terrainHeight(c * r, s * r) < 6.7) break;
    wallPts.push({ a, x: c * (r - 1.6), z: s * (r - 1.6) });
  }
  for (let i = 0; i < wallPts.length; i++) {
    const p = wallPts[i], q = wallPts[(i + 1) % wallPts.length];
    if (Math.abs(angDiff(p.a * DEG, Math.PI / 2)) < 9 * DEG) continue; // opening for the steps
    if ((i % 11) === 5) continue; // tumbled gaps
    const y0 = Math.min(terrainHeight(p.x, p.z), terrainHeight(q.x, q.z));
    if (y0 < 6.2) continue;
    const dx = q.x - p.x, dz = q.z - p.z, len = Math.hypot(dx, dz), ry = Math.atan2(-dz, dx);
    for (let c = 0; c < 3; c++) {
      const n = 3;
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5 + (c % 2) * 0.3) / n;
        if (t > 1) continue;
        const sx = len / n * (0.9 + rnd() * 0.25);
        B.box(sx, 0.3, 0.5 - c * 0.06, M.granite, p.x + dx * t, y0 + 0.15 + c * 0.29, p.z + dz * t, (rnd() - 0.5) * 0.08, ry + (rnd() - 0.5) * 0.08, (rnd() - 0.5) * 0.08, 1.0);
      }
    }
    col.addSeg(p.x, p.z, q.x, q.z, y0 - 1, y0 + 0.9);
  }

  // ---- worn path stones
  const pathPts = [];
  for (let z = 5.9; z < STEPS.z0 - 1.0; z += 0.55) pathPts.push([Math.sin(z) * 0.15, z]);
  for (let a = 90; a < 175; a += 7) pathPts.push([Math.cos(a * DEG) * 6.6, Math.sin(a * DEG) * 6.6]);
  for (let x = -6.6; x > SHED.x + SHED.w / 2 + 0.3; x -= 0.55) pathPts.push([x, SHED.z + Math.sin(x) * 0.1]);
  for (const [x, z] of pathPts) {
    B.box(0.5 + rnd() * 0.25, 0.08, 0.4 + rnd() * 0.2, M.graniteDark, x + (rnd() - 0.5) * 0.3, terrainHeight(x, z) + 0.02, z + (rnd() - 0.5) * 0.2, 0, rnd() * 3, 0, 0.8);
  }

  // ---- anemometer & rain gauge by the oil store
  const anemo = new THREE.Group(); anemo.position.set(SHED.x + 1.0, 7, SHED.z - SHED.d / 2 - 1.6); group.add(anemo);
  B.cyl(0.04, 0.05, 4.2, M.ironBlack, anemo.position.x, 9.1, anemo.position.z, 8);
  col.addCircle(anemo.position.x, anemo.position.z, 0.1, 6, 11);
  const cups = new THREE.Group(); cups.position.y = 4.25; anemo.add(cups);
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU;
    const arm = new THREE.Mesh(cylGeo(0.012, 0.012, 0.9, 6), M.ironBlack); arm.rotation.z = Math.PI / 2; arm.rotation.y = a; arm.position.set(Math.cos(a) * 0.45, 0, -Math.sin(a) * 0.45);
    const cup = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8, 0, TAU, 0, Math.PI / 2), M.tin);
    cup.position.set(Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9); cup.rotation.set(0, a, Math.PI / 2);
    cups.add(arm, cup);
  }
  ctx.onUpdate((dt, t) => { cups.rotation.y += dt * (9 + Math.sin(t * 0.7) * 3 + ctx.weather.gust * 6); });
  B.cyl(0.1, 0.1, 0.4, M.brass, SHED.x + 2.6, 7.2, SHED.z - SHED.d / 2 - 0.8, 12);
  B.cyl(0.03, 0.03, 0.6, M.ironBlack, SHED.x + 2.6, 7.0, SHED.z - SHED.d / 2 - 0.8, 6);

  // ---- oil store building (shell; contents live in interior.js)
  buildShed(B, M, col, rnd, group);

  // ---- rowing boat moored at the jetty
  ctx.boat = buildBoat(M);
  ctx.boat.position.set(-2.35, 0, 33.2);
  group.add(ctx.boat);

  B.build(group, { name: 'island-props' });
  return group;
}

function buildShed(B, M, col, rnd, group) {
  const { x, z, w, d, h } = SHED;
  const t = 0.42, y0 = 7.0;
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
  const dw = 1.15, dh = 2.05; // door in east wall at z
  const wall = (cx, cz, sx, sz, hh = h, yb = y0) => B.box(sx, hh, sz, M.stoneWhite, cx, yb + hh / 2, cz, 0, 0, 0, 2.0);
  wall(x, z0 + t / 2, w, t); // north
  wall(x, z1 - t / 2, w, t); // south
  wall(x0 + t / 2, z, t, d - 2 * t); // west
  const seg = (d - 2 * t - dw) / 2;
  wall(x1 - t / 2, z0 + t + seg / 2, t, seg);
  wall(x1 - t / 2, z1 - t - seg / 2, t, seg);
  wall(x1 - t / 2, z, t, dw, h - dh, y0 + dh);
  // gables
  const gs = new THREE.Shape(); gs.moveTo(-d / 2, 0); gs.lineTo(d / 2, 0); gs.lineTo(0, 1.5); gs.closePath();
  const gg = new THREE.ExtrudeGeometry(gs, { depth: t, bevelEnabled: false });
  for (const gx of [x0, x1 - t]) B.add(gg, M.stoneWhite, gx, y0 + h, z, 0, Math.PI / 2, 0).add(gg, M.stoneWhite, gx + t, y0 + h, z, 0, -Math.PI / 2, 0);
  // roof: two slate slopes, ridge along x
  const slopeL = Math.hypot(d / 2 + 0.35, 1.55), ang = Math.atan2(1.55, d / 2 + 0.35);
  for (const s of [-1, 1]) {
    B.box(w + 0.6, 0.12, slopeL, M.slate, x, y0 + h + 0.78, z + s * (d / 4 + 0.17), s * ang, 0, 0, 1.5);
  }
  B.box(w + 0.65, 0.16, 0.22, M.ironBlack, x, y0 + h + 1.56, z, 0, 0, 0);
  // chimney stub & door frame & step
  B.box(0.5, 1.0, 0.5, M.brick, x - 1.2, y0 + h + 1.6, z + 1.0, 0, 0, 0, 1);
  B.box(0.12, dh, 0.12, M.woodDark, x1 + 0.02, y0 + dh / 2, z - dw / 2 - 0.02);
  B.box(0.12, dh, 0.12, M.woodDark, x1 + 0.02, y0 + dh / 2, z + dw / 2 + 0.02);
  B.box(0.12, 0.14, dw + 0.3, M.woodDark, x1 + 0.02, y0 + dh + 0.05, z);
  // floor
  const FB = new Builder();
  FB.box(w - 2 * t, 0.1, d - 2 * t, M.flags, x, y0 + 0.0, z, 0, 0, 0, 2.0);
  FB.box(0.6, 0.1, dw, M.flags, x1 + 0.1, y0 + 0.0, z, 0, 0, 0, 2.0);
  FB.build(group, { name: 'shed-floor' }).forEach(m => col.addWalk(m, 'stone'));
  // fog horn trumpet on the west gable
  B.add(lathe([[0.09, 0], [0.1, 0.6], [0.16, 1.1], [0.3, 1.45], [0.55, 1.65], [0.57, 1.68], [0.5, 1.66], [0.28, 1.47], [0.14, 1.12], [0.08, 0.6], [0.07, 0]], 20), M.ironGreen, x0 - 0.15, y0 + h + 0.9, z, 0, 0, Math.PI / 2);
  B.box(0.3, 0.6, 0.3, M.ironBlack, x0 + 0.1, y0 + h + 0.55, z);
  // collision
  col.addSeg(x0, z0, x1, z0, 5, 12);
  col.addSeg(x0, z1, x1, z1, 5, 12);
  col.addSeg(x0, z0, x0, z1, 5, 12);
  col.addSeg(x1, z0, x1, z - dw / 2, 5, 12);
  col.addSeg(x1, z + dw / 2, x1, z1, 5, 12);
  col.addSeg(x1 - t, z0, x1 - t, z - dw / 2, 5, 12);
  col.addSeg(x1 - t, z + dw / 2, x1 - t, z1, 5, 12);
}

function buildBoat(M) {
  const g = new THREE.Group();
  const L = 3.8, Bm = 1.35, D = 0.62, nu = 24, nv = 12;
  const pos = [], idx = [], uv = [];
  for (let i = 0; i <= nu; i++) {
    const s = i / nu * 2 - 1;
    const w = Bm / 2 * Math.pow(Math.max(0, 1 - s * s), 0.55) * (s > 0 ? 1 - 0.25 * s : 1);
    const sheer = 0.18 * s * s;
    for (let j = 0; j <= nv; j++) {
      const th = j / nv * Math.PI;
      pos.push(Math.cos(th) * w, -Math.sin(th) * D * (1 - 0.25 * s * s) + sheer, s * L / 2);
      uv.push(i / nu * 3, j / nv);
    }
  }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const a = i * (nv + 1) + j, b = a + nv + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const hg = new THREE.BufferGeometry();
  hg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  hg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  hg.setIndex(idx); hg.computeVertexNormals();
  const hullMat = M.paintBlue.clone(); hullMat.side = THREE.DoubleSide;
  const hull = new THREE.Mesh(hg, hullMat); hull.castShadow = true;
  g.add(hull);
  for (const z of [-0.6, 0.5]) { const s = new THREE.Mesh(boxGeo(1.1, 0.05, 0.28, 0.6), M.wood); s.position.set(0, -0.12, z); g.add(s); }
  for (const sd of [-1, 1]) { const o = new THREE.Mesh(boxGeo(0.06, 0.04, 2.6, 0.6), M.wood); o.position.set(sd * 0.3, -0.06, 0.1); o.rotation.y = sd * 0.08; g.add(o); }
  g.userData.hull = hull;
  return g;
}
