import * as THREE from 'three';
import { Noise2D, mulberry32 } from './noise.js';

const N = new Noise2D(7);
const N2 = new Noise2D(91);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const to8 = (x) => (x <= 0 ? 0 : x >= 1 ? 255 : (x * 255) | 0);

function dataTex(data, S, srgb) {
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function normalFromHeight(h, S, strength) {
  const out = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) {
    const yu = (y + 1) % S, yd = (y - 1 + S) % S;
    for (let x = 0; x < S; x++) {
      const xr = (x + 1) % S, xl = (x - 1 + S) % S;
      const dx = (h[y * S + xr] - h[y * S + xl]) * strength;
      const dy = (h[yu * S + x] - h[yd * S + x]) * strength;
      const l = Math.hypot(dx, dy, 1);
      const j = (y * S + x) * 4;
      out[j] = to8(-dx / l * 0.5 + 0.5); out[j + 1] = to8(-dy / l * 0.5 + 0.5); out[j + 2] = to8(1 / l * 0.5 + 0.5); out[j + 3] = 255;
    }
  }
  return out;
}

function gen(S, fn, normalStrength = 3) {
  const col = new Uint8Array(S * S * 4), rgh = new Uint8Array(S * S * 4), hgt = new Float32Array(S * S);
  const o = { r: 0, g: 0, b: 0, h: 0, ro: 0.8 };
  for (let y = 0; y < S; y++) {
    const v = y / S;
    for (let x = 0; x < S; x++) {
      o.h = 0; o.ro = 0.8;
      fn(x / S, v, o, x, y);
      const i = y * S + x, j = i * 4;
      col[j] = to8(o.r); col[j + 1] = to8(o.g); col[j + 2] = to8(o.b); col[j + 3] = 255;
      const rr = to8(o.ro); rgh[j] = rr; rgh[j + 1] = rr; rgh[j + 2] = rr; rgh[j + 3] = 255;
      hgt[i] = o.h;
    }
  }
  return {
    map: dataTex(col, S, true),
    normalMap: dataTex(normalFromHeight(hgt, S, normalStrength * S / 256), S, false),
    roughnessMap: dataTex(rgh, S, false),
  };
}

// ---------------------------------------------------------------- generators

function genPlaster() {
  // old lime-washed plaster, one tile = 2 m x 2 m: cloudy tone, water stains, hairline cracks, faint trowel sweeps
  return gen(1024, (u, v, o) => {
    const n = N.fbm(u * 5, v * 5, 5, 5, 5);
    const n2 = N2.fbm(u * 18, v * 18, 3, 18, 18);
    const st = N2.fbm(u * 2, v * 2, 4, 2, 2);
    const fine = N.noise(u * 256, v * 256, 256, 256);
    const sweep = N2.fbm(u * 2, v * 9, 3, 2, 9);
    let r = 0.90, g = 0.86, b = 0.76;
    const k = 0.93 + n * 0.12 + n2 * 0.04 + fine * 0.03 + sweep * 0.035;
    const stain = sstep(0.2, 0.75, st);
    r *= k * (1 - stain * 0.15); g *= k * (1 - stain * 0.21); b *= k * (1 - stain * 0.34);
    const cr = N.ridged(u * 4 + 1.7, v * 4 + 5.1, 4, 4, 4);
    const crack = sstep(0.945, 0.985, cr) * sstep(0.28, 0.5, N2.fbm(u * 2 + 5, v * 2 + 1, 3, 2, 2));
    r *= 1 - crack * 0.5; g *= 1 - crack * 0.5; b *= 1 - crack * 0.45;
    o.r = r; o.g = g; o.b = b;
    o.h = n * 0.35 + n2 * 0.1 + fine * 0.05 + sweep * 0.08 - crack * 0.12;
    o.ro = 0.9 - stain * 0.05 - crack * 0.1;
  }, 2.2);
}

function genDado() {
  // tongue-and-groove wainscot: 22 vertical boards per 2 m, varnished pine, scuffed toward the floor
  const PL = 22, BIG = 1048576;
  return gen(1024, (u, v, o) => {
    const pi = Math.floor(u * PL), fu = u * PL - pi;
    const tone = 0.8 + ((pi * 0.6180339) % 1) * 0.4;
    const grain = N.fbm(fu * 4 + pi * 3.1, v * 3 + pi * 1.7, 4, BIG, 3);
    const fine = N2.noise(fu * 40 + pi, v * 6, BIG, 6);
    const ring = Math.sin((fu * 5 + grain * 2.2) * 6.2831853 * 1.3);
    let k = tone * (0.86 + grain * 0.26 + ring * 0.035 + fine * 0.02);
    const scuff = sstep(0.55, 0.0, v);
    k *= 0.9 + 0.1 * sstep(0.0, 0.2, v) - scuff * 0.04;
    let r = 0.50 * k, g = 0.31 * k, b = 0.17 * k;
    const groove = Math.min(fu, 1 - fu);
    const gv = sstep(0.07, 0.01, groove);
    r *= 1 - gv * 0.78; g *= 1 - gv * 0.78; b *= 1 - gv * 0.74;
    o.r = r; o.g = g; o.b = b;
    o.h = 0.55 + grain * 0.06 - gv * 0.5 + (groove < 0.1 ? -0.04 : 0);
    o.ro = 0.46 + grain * 0.1 + gv * 0.4;
  }, 2.5);
}

function genStone(red) {
  const ROWS = 8, rnd = mulberry32(42);
  const rows = [];
  for (let r = 0; r < ROWS; r++) {
    const start = rnd(); const cuts = []; let p = start;
    while (p < start + 0.9) { cuts.push(p % 1); p += 0.17 + rnd() * 0.15; }
    cuts.sort((a, b) => a - b);
    rows.push({ cuts, tones: cuts.map(() => 0.92 + rnd() * 0.12) });
  }
  return gen(1024, (u, v, o) => {
    const ri = Math.min(ROWS - 1, Math.floor(v * ROWS)), fv = v * ROWS - ri, row = rows[ri], c = row.cuts;
    let idx = -1;
    for (let i = 0; i < c.length; i++) { if (c[i] <= u) idx = i; else break; }
    if (idx < 0) idx = c.length - 1;
    let dl = u - c[idx]; if (dl < 0) dl += 1;
    let dr = c[(idx + 1) % c.length] - u; if (dr <= 0) dr += 1;
    const d = Math.min(Math.min(dl, dr), Math.min(fv, 1 - fv) / ROWS);
    const n = N.fbm(u * 16, v * 16, 4, 16, 16);
    const fine = N2.noise(u * 128, v * 128, 128, 128);
    let r, g, b, h, ro;
    if (d < 0.0024) {
      const m = 0.42 + n * 0.08; r = m; g = m * 0.98; b = m * 0.93; h = 0; ro = 0.95;
    } else {
      const bev = sstep(0.0024, 0.011, d);
      h = 0.45 + 0.4 * bev + n * 0.14 + fine * 0.03;
      const peel = N2.fbm(u * 6, v * 6, 4, 6, 6) + 0.18 * N.noise(u * 40, v * 40, 40, 40) + (1 - bev) * 0.12;
      if (peel > 0.42) {
        const s = 0.33 + n * 0.1 + fine * 0.04; r = s; g = s * 0.98; b = s * 0.95; ro = 0.86; h -= 0.08;
        if (peel < 0.45) { r *= 0.75; g *= 0.75; b *= 0.75; }
      } else {
        const tone = row.tones[idx];
        if (red) { const f = (0.85 + n * 0.2) * tone; r = 0.46 * f; g = 0.07 * f; b = 0.055 * f; }
        else { const f = (0.88 + n * 0.08) * tone; r = 0.84 * f; g = 0.84 * f; b = 0.8 * f; }
        ro = 0.75;
      }
    }
    const s = N.fbm(u * 24, v * 2, 3, 24, 2);
    const streak = sstep(0.08, 0.55, s) * 0.5;
    r *= 1 - streak * 0.9; g *= 1 - streak * 0.82; b *= 1 - streak * 0.95;
    o.r = r; o.g = g; o.b = b; o.h = h; o.ro = ro;
  }, 3);
}

function genPlanks() {
  const P = 8, rnd = mulberry32(7);
  const pl = [];
  for (let i = 0; i < P; i++) pl.push({ off: rnd(), two: rnd() < 0.6, t1: 0.75 + rnd() * 0.45, t2: 0.75 + rnd() * 0.45, seed: rnd() * 50 });
  return gen(1024, (u, v, o) => {
    const pi = Math.min(P - 1, Math.floor(v * P)), fv = v * P - pi, p = pl[pi];
    const uu = (u + p.off) % 1;
    const seg = p.two ? (uu < 0.5 ? 0 : 1) : 0;
    const tone = seg ? p.t2 : p.t1;
    const segLen = p.two ? 0.5 : 1, su = p.two ? uu % 0.5 : uu, jd = Math.min(su, segLen - su);
    const g1 = N.fbm(u * 4, v * 96, 4, 4, 96);
    const g2 = N2.noise(u * 2, v * 48, 2, 48);
    const ring = Math.sin((fv * 3 + g2 * 2.5 + seg * 1.3 + p.seed) * 7.5);
    const k = tone * (0.82 + g1 * 0.28 + ring * 0.06);
    let r = 0.40 * k, g = 0.26 * k, b = 0.15 * k;
    let h = 0.6 + g1 * 0.1 - (fv - 0.5) * (fv - 0.5) * 0.5, ro = 0.6 + g1 * 0.12;
    const wear = N.fbm(u * 3, v * 3, 3, 3, 3);
    r *= 1 + wear * 0.18; g *= 1 + wear * 0.18; b *= 1 + wear * 0.14; ro -= Math.max(0, wear) * 0.15;
    if (fv < 0.025 || fv > 0.975) { r = 0.04; g = 0.028; b = 0.018; h = 0; ro = 1; }
    else if (jd < 0.0018) { r *= 0.25; g *= 0.25; b *= 0.25; h = 0.1; }
    else {
      const nd = Math.hypot(jd - 0.012, Math.min(Math.abs(fv - 0.25), Math.abs(fv - 0.75)) / P);
      if (nd < 0.0028) { r = 0.1; g = 0.09; b = 0.085; ro = 0.4; h = 0.55; }
    }
    o.r = r; o.g = g; o.b = b; o.h = h; o.ro = ro;
  }, 3);
}

function genWood() {
  return gen(512, (u, v, o) => {
    const g1 = N.fbm(u * 3, v * 40, 4, 3, 40);
    const g2 = N2.noise(u * 1, v * 12, 1, 12);
    const ring = Math.sin((v * 12 + g2 * 3) * 6.2831);
    const k = 0.85 + g1 * 0.3 + ring * 0.07;
    o.r = 0.38 * k; o.g = 0.24 * k; o.b = 0.13 * k;
    o.h = g1 * 0.3 + ring * 0.05; o.ro = 0.5 + g1 * 0.12;
  }, 1.5);
}

function genPaintWood() {
  return gen(512, (u, v, o) => {
    const g1 = N.fbm(u * 3, v * 40, 4, 3, 40);
    const chip = N2.fbm(u * 8, v * 8, 4, 8, 8) + N.noise(u * 50, v * 50, 50, 50) * 0.15;
    const k = 0.9 + g1 * 0.08;
    if (chip > 0.5) { o.r = 0.2 * k; o.g = 0.13 * k; o.b = 0.08 * k; o.ro = 0.8; o.h = 0; }
    else { o.r = 0.8 * k; o.g = 0.8 * k; o.b = 0.78 * k; o.ro = 0.55; o.h = 0.3 + g1 * 0.15; }
  }, 2);
}

function genRock() {
  return gen(1024, (u, v, o) => {
    const n = N.fbm(u * 8, v * 8, 6, 8, 8);
    const rg = N2.ridged(u * 4, v * 4, 5, 4, 4);
    const sp = N.noise(u * 180, v * 180, 180, 180);
    let base = 0.27 + 0.11 * n;
    let r = base, g = base * 0.97, b = base * 0.93;
    let h = n * 0.6 + rg * 0.4, ro = 0.86;
    if (sp > 0.5) { r += 0.1; g += 0.1; b += 0.09; } else if (sp < -0.6) { r *= 0.7; g *= 0.7; b *= 0.7; }
    const c = sstep(0.86, 0.96, rg);
    r *= 1 - c * 0.6; g *= 1 - c * 0.6; b *= 1 - c * 0.6; h -= c * 0.5;
    const l = N.fbm(u * 6 + 7, v * 6 + 3, 4, 6, 6);
    const la = sstep(0.22, 0.4, l) * 0.75;
    r = mix(r, 0.52 * (0.85 + sp * 0.15), la); g = mix(g, 0.46 * (0.85 + sp * 0.15), la); b = mix(b, 0.22, la);
    const l2 = N2.fbm(u * 5 + 1, v * 5 + 9, 4, 5, 5);
    const lb = sstep(0.28, 0.42, l2) * 0.5;
    r = mix(r, 0.40, lb); g = mix(g, 0.44, lb); b = mix(b, 0.38, lb);
    o.r = r; o.g = g; o.b = b; o.h = h; o.ro = ro;
  }, 3);
}

function genMetal(paint, roughPaint = 0.42) {
  return gen(512, (u, v, o) => {
    const n = N.fbm(u * 6 + 3, v * 6, 5, 6, 6);
    const f = N2.noise(u * 60, v * 60, 60, 60);
    const rust = sstep(0.16, 0.38, n + f * 0.12);
    const pk = 0.9 + N.noise(u * 20, v * 20, 20, 20) * 0.1;
    const rr = 0.8 + f * 0.3;
    o.r = mix(paint[0] * pk, 0.28 * rr, rust); o.g = mix(paint[1] * pk, 0.13 * rr, rust); o.b = mix(paint[2] * pk, 0.06 * rr, rust);
    o.ro = mix(roughPaint, 0.92, rust); o.h = rust * 0.4 + f * 0.05;
  }, 2);
}

function genCopper() {
  return gen(512, (u, v, o) => {
    const n = N.fbm(u * 5, v * 5, 5, 5, 5);
    const f = N2.noise(u * 40, v * 40, 40, 40);
    const s = N.fbm(u * 20, v * 2, 3, 20, 2);
    const ver = sstep(-0.1, 0.25, n + f * 0.15 + s * 0.3);
    o.r = mix(0.42, 0.28, ver) * (0.9 + f * 0.1); o.g = mix(0.22, 0.52, ver) * (0.9 + f * 0.1); o.b = mix(0.12, 0.44, ver) * (0.9 + f * 0.1);
    o.ro = mix(0.4, 0.85, ver); o.h = ver * 0.3 + f * 0.05;
  }, 2);
}

function genBrick() {
  const ROWS = 16, COLS = 4;
  return gen(512, (u, v, o) => {
    const ri = Math.floor(v * ROWS), fv = v * ROWS - ri;
    const uu = (u * COLS + (ri % 2) * 0.5), ci = Math.floor(uu), fu = uu - ci;
    const mort = fv < 0.08 || fu < 0.035;
    const n = N.fbm(u * 16, v * 16, 4, 16, 16), f = N2.noise(u * 100, v * 100, 100, 100);
    const id = (ri * 13 + ((ci % COLS) + COLS) % COLS * 7) % 17 / 17;
    if (mort) { const m = 0.35 + n * 0.05; o.r = m; o.g = m * 0.96; o.b = m * 0.9; o.h = 0; o.ro = 0.95; }
    else {
      const k = 0.8 + id * 0.35 + n * 0.15 + f * 0.04;
      o.r = 0.42 * k; o.g = 0.16 * k; o.b = 0.1 * k; o.h = 0.6 + n * 0.2; o.ro = 0.85;
      const soot = sstep(0.0, 0.5, N.fbm(u * 3, v * 3, 3, 3, 3)); o.r *= 1 - soot * 0.6; o.g *= 1 - soot * 0.6; o.b *= 1 - soot * 0.6;
    }
  }, 3);
}

function genRug(c1, c2, c3) {
  return gen(512, (u, v, o) => {
    const x = Math.abs(u - 0.5) * 2, y = Math.abs(v - 0.5) * 2;
    const box = Math.max(x, y), dia = x + y;
    let col;
    if (box > 0.92) col = c2;
    else if (box > 0.86) col = c3;
    else if (box > 0.78) col = ((Math.floor(u * 40) + Math.floor(v * 40)) % 2) ? c2 : c3;
    else if (box > 0.74) col = c3;
    else if (dia < 0.5) col = dia < 0.3 ? (dia < 0.12 ? c3 : c2) : c3;
    else if (Math.abs(Math.sin(x * 14) * Math.sin(y * 14)) > 0.7) col = c2;
    else col = c1;
    const n = N.fbm(u * 10, v * 10, 4, 10, 10), weave = N2.noise(u * 200, v * 200, 200, 200) * 0.06;
    const wear = 0.85 + n * 0.15 + weave - sstep(0.4, 0.0, Math.hypot(u - 0.5, v - 0.5)) * 0.08;
    o.r = col[0] * wear; o.g = col[1] * wear; o.b = col[2] * wear; o.h = weave * 4 + n * 0.2; o.ro = 0.95;
  }, 2);
}

function genQuilt() {
  const rnd = mulberry32(11);
  const pal = [[0.55, 0.15, 0.12], [0.75, 0.68, 0.5], [0.2, 0.3, 0.45], [0.35, 0.42, 0.25], [0.62, 0.42, 0.2], [0.5, 0.2, 0.3]];
  const cells = []; for (let i = 0; i < 64; i++) cells.push(pal[Math.floor(rnd() * pal.length)]);
  return gen(512, (u, v, o) => {
    const cx = Math.floor(u * 8), cy = Math.floor(v * 8), fx = u * 8 - cx, fy = v * 8 - cy;
    const c = cells[cy * 8 + cx];
    const n = N.fbm(u * 20, v * 20, 3, 20, 20), w = N2.noise(u * 300, v * 300, 300, 300) * 0.05;
    const seam = Math.min(fx, 1 - fx, fy, 1 - fy) < 0.03;
    const quilting = Math.abs(((fx + fy) * 3) % 1 - 0.5) < 0.03;
    const k = (0.85 + n * 0.12 + w) * (seam ? 0.6 : quilting ? 0.85 : 1);
    o.r = c[0] * k; o.g = c[1] * k; o.b = c[2] * k; o.h = seam || quilting ? 0 : 0.6 + n * 0.3; o.ro = 0.95;
  }, 3);
}

function genCloth() {
  return gen(256, (u, v, o) => {
    const w = Math.sin(u * 256 * Math.PI) * Math.sin(v * 256 * Math.PI);
    const n = N.fbm(u * 8, v * 8, 4, 8, 8);
    const k = 0.75 + w * 0.06 + n * 0.12;
    o.r = k; o.g = k; o.b = k; o.h = w * 0.5 + n * 0.3; o.ro = 0.95;
  }, 1.5);
}

function genSlate() {
  const ROWS = 10;
  return gen(512, (u, v, o) => {
    const ri = Math.floor(v * ROWS), fv = v * ROWS - ri;
    const uu = u * 6 + (ri % 2) * 0.5, ci = Math.floor(uu), fu = uu - ci;
    const n = N.fbm(u * 12, v * 12, 4, 12, 12), f = N2.noise(u * 80, v * 80, 80, 80);
    const id = ((ri * 7 + ((ci % 6) + 6) % 6 * 3) % 11) / 11;
    const edge = fu < 0.03 || fu > 0.97;
    const k = (0.75 + id * 0.3 + n * 0.15 + f * 0.05) * (edge ? 0.4 : 1) * (0.7 + fv * 0.3);
    o.r = 0.16 * k; o.g = 0.18 * k; o.b = 0.21 * k;
    o.h = fv * 0.8 + n * 0.1 - (edge ? 0.3 : 0); o.ro = 0.55 + f * 0.1;
    const lichen = sstep(0.3, 0.45, N.fbm(u * 7 + 4, v * 7, 4, 7, 7));
    o.r = mix(o.r, 0.4, lichen * 0.6); o.g = mix(o.g, 0.38, lichen * 0.6); o.b = mix(o.b, 0.2, lichen * 0.6);
  }, 3);
}

function genFlags() {
  const G = 5, rnd = mulberry32(5);
  const pts = []; for (let i = 0; i < G * G; i++) pts.push([rnd(), rnd(), 0.8 + rnd() * 0.3]);
  return gen(512, (u, v, o) => {
    const gx = u * G, gy = v * G, ix = Math.floor(gx), iy = Math.floor(gy);
    let d1 = 9, d2 = 9, best = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = ix + i, cy = iy + j;
      const p = pts[((cy % G + G) % G) * G + ((cx % G + G) % G)];
      const dx = cx + p[0] - gx, dy = cy + p[1] - gy, d = dx * dx + dy * dy;
      if (d < d1) { d2 = d1; d1 = d; best = p[2]; } else if (d < d2) d2 = d;
    }
    const e = Math.sqrt(d2) - Math.sqrt(d1);
    const n = N.fbm(u * 12, v * 12, 4, 12, 12), f = N2.noise(u * 90, v * 90, 90, 90);
    const k = best * (0.8 + n * 0.2 + f * 0.05);
    if (e < 0.05) { o.r = 0.12; o.g = 0.11; o.b = 0.1; o.h = 0; o.ro = 1; }
    else { o.r = 0.36 * k; o.g = 0.35 * k; o.b = 0.33 * k; o.h = 0.5 + sstep(0.05, 0.15, e) * 0.3 + n * 0.15; o.ro = 0.75; }
  }, 3);
}

// ---------------------------------------------------------------- canvas textures

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function parchment(g, w, h, base = '#d8c79f') {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  const rnd = mulberry32(3);
  for (let i = 0; i < 600; i++) {
    g.fillStyle = `rgba(${90 + rnd() * 40},${60 + rnd() * 30},${20},${rnd() * 0.05})`;
    const r = 4 + rnd() * 40; g.beginPath(); g.arc(rnd() * w, rnd() * h, r, 0, 7); g.fill();
  }
  const grd = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
  grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(70,40,10,0.45)');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
}

function scribble(g, x, y, w, lines, lh, rnd, color = 'rgba(30,25,40,0.8)') {
  g.strokeStyle = color; g.lineWidth = 1.3;
  for (let l = 0; l < lines; l++) {
    let cx = x; const cy = y + l * lh; const end = x + w * (0.6 + rnd() * 0.4);
    g.beginPath(); g.moveTo(cx, cy);
    while (cx < end) {
      const ww = 4 + rnd() * 18;
      for (let k = 0; k < ww; k += 2) g.lineTo(cx + k, cy + Math.sin(k * 1.3 + rnd()) * 2.5 - rnd() * 2);
      cx += ww + 4; g.moveTo(cx, cy);
    }
    g.stroke();
  }
}

function ragRug(g, w, h, cols, seed) {
  const rnd = mulberry32(seed), cx = w / 2, cy = h / 2;
  g.fillStyle = '#cdbb98'; g.fillRect(0, 0, w, h);
  let r = w / 2, ci = 0;
  while (r > 6) {
    const bw = 8 + rnd() * 20;
    g.strokeStyle = cols[ci % cols.length]; g.lineWidth = bw + 1; g.beginPath(); g.arc(cx, cy, Math.max(1, r - bw / 2), 0, 6.2832); g.stroke();
    r -= bw; ci += 1 + (rnd() < 0.25 ? 1 : 0);
  }
  g.fillStyle = cols[ci % cols.length]; g.beginPath(); g.arc(cx, cy, 8, 0, 6.2832); g.fill();
  // the braid: short dashes lying along the rings
  for (let i = 0; i < 14000; i++) {
    const a = rnd() * 6.2832, rr = 6 + rnd() * (w / 2 - 6);
    g.save(); g.translate(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); g.rotate(a + Math.PI / 2);
    g.fillStyle = rnd() < 0.5 ? `rgba(0,0,0,${0.05 + rnd() * 0.1})` : `rgba(255,255,255,${0.03 + rnd() * 0.07})`; g.fillRect(-3, -1, 6, 2); g.restore();
  }
}
const tiled = (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };

export function makeCanvasTextures() {
  const T = {};
  T.ragrug = canvasTex(512, 512, (g, w, h) => ragRug(g, w, h, ['#7a2a22', '#2f4a5a', '#d8c8a8', '#8a6a3a', '#3f5a3a', '#a85a3a'], 5));
  T.ragrug2 = canvasTex(512, 512, (g, w, h) => ragRug(g, w, h, ['#2f4a5a', '#d8c8a8', '#6a3a2a', '#c8a050', '#2a3a2a'], 9));
  T.gingham = tiled(canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#efe6d0'; g.fillRect(0, 0, w, h);
    const c = w / 8;
    for (let i = 0; i < 8; i += 2) { g.fillStyle = 'rgba(150,64,56,0.4)'; g.fillRect(i * c, 0, c, h); g.fillRect(0, i * c, w, c); }
    const rnd = mulberry32(2); for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.05})`; g.fillRect(rnd() * w, rnd() * h, 2, 1); }
  }));
  T.tartan = tiled(canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#26402e'; g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.62;
    for (const [p, wd, col] of [[0.12, 0.05, '#a02a2a'], [0.3, 0.1, '#1c2a4a'], [0.5, 0.025, '#d8b040'], [0.72, 0.08, '#a02a2a'], [0.88, 0.03, '#d8c8a0']]) { g.fillStyle = col; g.fillRect(p * w, 0, wd * w, h); g.fillRect(0, p * h, w, wd * h); }
    g.globalAlpha = 1;
    const rnd = mulberry32(4); for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.08})`; g.fillRect(rnd() * w, rnd() * h, 2, 1); }
  }));
  T.ticking = tiled(canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#e8e0cc'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) { g.fillStyle = 'rgba(40,62,96,0.8)'; g.fillRect(x, 0, 14, h); }
    const rnd = mulberry32(6); for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.06})`; g.fillRect(rnd() * w, rnd() * h, 1, 2); }
  }));
  T.salt = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(17);
    for (let i = 0; i < 2600; i++) {
      const a = rnd() * 0.5 + 0.2; g.fillStyle = `rgba(255,255,255,${a})`;
      const r = rnd() * rnd() * 7 + 0.5; g.beginPath(); g.arc(rnd() * w, rnd() * h, r, 0, 7); g.fill();
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(255,255,255,${0.05 + rnd() * 0.1})`; const x = rnd() * w;
      g.fillRect(x, rnd() * h * 0.5, 2 + rnd() * 4, h * (0.3 + rnd() * 0.6));
    }
  }, false);
  T.glow = canvasTex(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.2, 'rgba(255,255,255,0.6)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.12)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }, false);
  T.lens = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#9fb3b5'; g.fillRect(0, 0, w, h);
    for (let r = 120; r > 4; r -= 9) {
      const grd = g.createRadialGradient(128, 128, r - 9, 128, 128, r);
      grd.addColorStop(0, 'rgba(255,255,255,0.05)'); grd.addColorStop(0.85, 'rgba(255,255,255,0.75)'); grd.addColorStop(1, 'rgba(40,60,60,0.6)');
      g.fillStyle = grd; g.beginPath(); g.arc(128, 128, r, 0, 7); g.fill();
    }
    g.strokeStyle = '#6b5226'; g.lineWidth = 8; g.strokeRect(2, 2, w - 4, h - 4);
  });
  T.chart = canvasTex(1024, 768, (g, w, h) => {
    parchment(g, w, h, '#d9caa4');
    const rnd = mulberry32(21);
    g.fillStyle = 'rgba(160,140,90,0.5)'; g.strokeStyle = '#4a3b26'; g.lineWidth = 2;
    for (const [cx, cy, r] of [[300, 300, 90], [720, 520, 140], [880, 180, 60], [140, 620, 70]]) {
      g.beginPath();
      for (let a = 0; a <= 64; a++) { const t = a / 64 * 6.283; const rr = r * (0.75 + 0.35 * Math.sin(t * 3 + cx) * Math.cos(t * 5 + cy) + rnd() * 0.08); g.lineTo(cx + Math.cos(t) * rr, cy + Math.sin(t) * rr); }
      g.closePath(); g.fill(); g.stroke();
    }
    g.strokeStyle = 'rgba(80,60,40,0.35)'; g.lineWidth = 1;
    for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; g.beginPath(); g.moveTo(520, 360); g.lineTo(520 + Math.cos(a) * 900, 360 + Math.sin(a) * 900); g.stroke(); }
    g.fillStyle = '#3a2f20'; g.font = '13px Georgia';
    for (let i = 0; i < 120; i++) g.fillText(String(Math.floor(rnd() * 40 + 3)), rnd() * w, rnd() * h);
    g.font = 'italic 34px Georgia'; g.fillText('Skerry Sound & Approaches', 330, 60);
    g.save(); g.translate(520, 360);
    g.fillStyle = '#7a2a1c'; g.beginPath(); g.moveTo(0, -70); g.lineTo(12, 0); g.lineTo(0, 70); g.lineTo(-12, 0); g.closePath(); g.fill();
    g.fillStyle = '#2a2a2a'; g.beginPath(); g.moveTo(-70, 0); g.lineTo(0, 12); g.lineTo(70, 0); g.lineTo(0, -12); g.closePath(); g.fill();
    g.restore();
    g.fillStyle = '#b21f1f'; g.beginPath(); g.arc(300, 300, 6, 0, 7); g.fill();
    g.font = 'italic 18px Georgia'; g.fillStyle = '#3a2f20'; g.fillText('Skerryhead Lt.  Fl.(2) W 20s', 312, 296);
    g.strokeStyle = 'rgba(178,31,31,0.8)'; g.setLineDash([8, 6]); g.lineWidth = 2;
    g.beginPath(); g.moveTo(20, 480); g.bezierCurveTo(300, 470, 500, 440, 1000, 430); g.stroke(); g.setLineDash([]);
  });
  T.painting = canvasTex(512, 384, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#2b2f33'); grd.addColorStop(0.5, '#4c5458'); grd.addColorStop(0.55, '#1d2a2e'); grd.addColorStop(1, '#0d1517');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(8);
    for (let i = 0; i < 900; i++) {
      const y = rnd() * h, light = y < h * 0.5 ? 60 + rnd() * 60 : 30 + rnd() * 50;
      g.strokeStyle = `rgba(${light},${light + 8},${light + 10},${0.1 + rnd() * 0.2})`; g.lineWidth = 1 + rnd() * 4;
      g.beginPath(); const x = rnd() * w; g.moveTo(x, y); g.quadraticCurveTo(x + 20, y - 8 * rnd(), x + 40 + rnd() * 30, y + (rnd() - 0.5) * 10); g.stroke();
    }
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(230,235,230,${rnd() * 0.5})`; g.fillRect(rnd() * w, h * 0.55 + rnd() * h * 0.4, 2 + rnd() * 12, 1 + rnd() * 3); }
    g.fillStyle = '#121212';
    g.beginPath(); g.moveTo(180, 230); g.lineTo(340, 225); g.lineTo(320, 250); g.lineTo(200, 252); g.closePath(); g.fill();
    g.fillRect(250, 120, 4, 110); g.fillRect(290, 140, 3, 90);
    g.beginPath(); g.moveTo(254, 125); g.lineTo(310, 200); g.lineTo(254, 205); g.fill();
    g.beginPath(); g.moveTo(250, 130); g.lineTo(200, 210); g.lineTo(250, 212); g.fill();
    g.fillStyle = '#f5e6b0'; g.fillRect(445, 150, 6, 20);
    const lg = g.createRadialGradient(448, 150, 0, 448, 150, 60); lg.addColorStop(0, 'rgba(255,240,180,0.7)'); lg.addColorStop(1, 'rgba(255,240,180,0)');
    g.fillStyle = lg; g.fillRect(380, 90, 140, 120);
  });
  T.portrait = canvasTex(256, 320, (g, w, h) => {
    const grd = g.createRadialGradient(128, 140, 10, 128, 160, 180); grd.addColorStop(0, '#5a4a36'); grd.addColorStop(1, '#1a140e');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2a221a'; g.beginPath(); g.ellipse(128, 300, 100, 90, 0, 0, 7); g.fill();
    g.fillStyle = '#a07a5a'; g.beginPath(); g.ellipse(128, 140, 46, 60, 0, 0, 7); g.fill();
    g.fillStyle = '#d8d0c0'; g.beginPath(); g.ellipse(128, 185, 40, 30, 0, 0, 3.14); g.fill();
    g.fillStyle = '#1a1612'; g.fillRect(84, 78, 88, 26); g.fillRect(70, 98, 116, 8);
    g.fillStyle = '#201810'; g.fillRect(108, 130, 12, 5); g.fillRect(136, 130, 12, 5);
  });
  T.logbook = canvasTex(1024, 640, (g, w, h) => {
    parchment(g, w, h, '#e3d5b0');
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(w / 2 - 6, 0, 12, h);
    const rnd = mulberry32(31);
    g.strokeStyle = 'rgba(80,90,140,0.35)'; g.lineWidth = 1;
    for (let y = 70; y < h - 30; y += 28) { g.beginPath(); g.moveTo(30, y); g.lineTo(w / 2 - 20, y); g.moveTo(w / 2 + 20, y); g.lineTo(w - 30, y); g.stroke(); }
    g.fillStyle = '#2a2030'; g.font = 'italic 26px Georgia'; g.fillText('Skerryhead Light — Journal', 40, 46);
    scribble(g, 40, 92, w / 2 - 80, 18, 28, rnd);
    scribble(g, w / 2 + 30, 92, w / 2 - 80, 7, 28, rnd);
  });
  T.paper = canvasTex(512, 700, (g, w, h) => {
    parchment(g, w, h, '#e6dcc0');
    g.fillStyle = '#2a2030'; g.font = 'bold italic 30px Georgia'; g.fillText('Standing Orders', 90, 70);
    scribble(g, 40, 120, w - 80, 18, 30, mulberry32(9));
  });
  T.clock = canvasTex(256, 256, (g) => {
    g.fillStyle = '#efe6cf'; g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fill();
    g.strokeStyle = '#222'; g.lineWidth = 3; g.beginPath(); g.arc(128, 128, 118, 0, 7); g.stroke();
    g.fillStyle = '#222'; g.font = '22px Georgia'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const R = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283 - 1.5708; g.fillText(R[i], 128 + Math.cos(a) * 95, 128 + Math.sin(a) * 95); }
    for (let i = 0; i < 60; i++) { const a = i / 60 * 6.283; g.fillRect(128 + Math.cos(a) * 112 - 1, 128 + Math.sin(a) * 112 - 1, 2, 2); }
  });
  T.gauge = canvasTex(256, 256, (g) => {
    g.fillStyle = '#f2ecdc'; g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fill();
    g.strokeStyle = '#a01818'; g.lineWidth = 14; g.beginPath(); g.arc(128, 128, 96, -0.4, 0.75); g.stroke();
    g.strokeStyle = '#222'; g.lineWidth = 2;
    for (let i = 0; i <= 10; i++) { const a = 2.36 + i / 10 * 4.71; g.beginPath(); g.moveTo(128 + Math.cos(a) * 104, 128 + Math.sin(a) * 104); g.lineTo(128 + Math.cos(a) * 88, 128 + Math.sin(a) * 88); g.stroke(); }
    g.fillStyle = '#222'; g.font = 'bold 18px Georgia'; g.textAlign = 'center'; g.fillText('PRESSURE', 128, 178); g.font = '13px Georgia'; g.fillText('lbs / sq. in.', 128, 198);
  });
  T.baro = canvasTex(256, 256, (g) => {
    g.fillStyle = '#efe6cf'; g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fill();
    g.fillStyle = '#222'; g.font = 'bold 15px Georgia'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const words = ['STORMY', 'RAIN', 'CHANGE', 'FAIR', 'V. DRY'];
    words.forEach((wd, i) => { const a = 2.5 + i / 4 * 4.4; g.save(); g.translate(128 + Math.cos(a) * 88, 128 + Math.sin(a) * 88); g.rotate(a + 1.5708); g.fillText(wd, 0, 0); g.restore(); });
    for (let i = 0; i <= 40; i++) { const a = 2.5 + i / 40 * 4.4; g.fillRect(128 + Math.cos(a) * 110 - 1, 128 + Math.sin(a) * 110 - 1, 2, 2); }
  });
  T.radio = canvasTex(256, 128, (g) => {
    g.fillStyle = '#2a1c10'; g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#e8c87a'; g.fillRect(16, 16, 224, 50);
    g.fillStyle = '#3a2a10'; g.font = '11px Georgia';
    for (let i = 0; i < 10; i++) { g.fillRect(24 + i * 22, 40, 1, 20); g.fillText(String(500 + i * 100), 18 + i * 22, 34); }
  });
  return T;
}

export async function generateTextures(progress) {
  const T = {};
  const jobs = [
    ['plaster', genPlaster], ['dado', genDado], ['stoneWhite', () => genStone(false)], ['stoneRed', () => genStone(true)],
    ['planks', genPlanks], ['wood', genWood], ['paintWood', genPaintWood], ['rock', genRock],
    ['ironBlack', () => genMetal([0.075, 0.08, 0.075])], ['ironRed', () => genMetal([0.40, 0.05, 0.04], 0.38)],
    ['ironGreen', () => genMetal([0.10, 0.20, 0.15])],
    ['copper', genCopper], ['brick', genBrick],
    ['rug', () => genRug([0.42, 0.08, 0.07], [0.08, 0.1, 0.2], [0.75, 0.62, 0.38])],
    ['rug2', () => genRug([0.1, 0.18, 0.22], [0.5, 0.25, 0.08], [0.7, 0.66, 0.5])],
    ['quilt', genQuilt], ['cloth', genCloth], ['slate', genSlate], ['flags', genFlags],
  ];
  for (let i = 0; i < jobs.length; i++) {
    T[jobs[i][0]] = jobs[i][1]();
    progress((i + 1) / jobs.length, jobs[i][0]);
    await new Promise((r) => setTimeout(r, 0));
  }
  Object.assign(T, makeCanvasTextures());
  return T;
}
