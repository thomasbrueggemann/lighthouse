import { Noise2D, mulberry32 } from './noise.js';

// Procedural texture generators. Pure computation (no three.js), so they run on the main thread or in Web Workers
// (texworker.js). Each returns raw typed arrays: { S, col, rgh, nrm } for a PBR set, or { S, nrm } for a normal map.

const N = new Noise2D(7);
const N2 = new Noise2D(91);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const to8 = (x) => (x <= 0 ? 0 : x >= 1 ? 255 : (x * 255) | 0);

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
  return { S, col, rgh, nrm: normalFromHeight(hgt, S, normalStrength * S / 256) };
}

// ---------------------------------------------------------------- generators

// Tileable normal map for the sea's chop: broad swells, sharp ridged ripples and fine wind-roughening.
function genWaterNormal() {
  const S = 256, h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    h[y * S + x] = N.fbm(u * 5, v * 5, 5, 5, 5) * 0.5 + (1 - Math.abs(N2.noise(u * 12, v * 12, 12, 12))) * 0.32 + N.fbm(u * 22 + 3, v * 22, 3, 22, 22) * 0.18;
  }
  return { S, nrm: normalFromHeight(h, S, 5) };
}

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


export const JOBS = {
  rock: genRock, stoneWhite: () => genStone(false), stoneRed: () => genStone(true), planks: genPlanks, plaster: genPlaster, dado: genDado,
  wood: genWood, paintWood: genPaintWood,
  ironBlack: () => genMetal([0.075, 0.08, 0.075]), ironRed: () => genMetal([0.40, 0.05, 0.04], 0.38), ironGreen: () => genMetal([0.10, 0.20, 0.15]),
  copper: genCopper, brick: genBrick,
  rug: () => genRug([0.42, 0.08, 0.07], [0.08, 0.1, 0.2], [0.75, 0.62, 0.38]),
  rug2: () => genRug([0.1, 0.18, 0.22], [0.5, 0.25, 0.08], [0.7, 0.66, 0.5]),
  quilt: genQuilt, cloth: genCloth, slate: genSlate, flags: genFlags, waterN: genWaterNormal,
};
