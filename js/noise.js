export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GX = new Float32Array([1, -1, 0, 0, 0.7071, -0.7071, 0.7071, -0.7071]);
const GY = new Float32Array([0, 0, 1, -1, 0.7071, 0.7071, -0.7071, -0.7071]);
const BIG = 1048576;

// 2D gradient noise with optional integer periods (for tileable textures)
export class Noise2D {
  constructor(seed = 1) {
    const r = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    this.p = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.p[i] = p[i & 255];
  }
  noise(x, y, px = BIG, py = BIG) {
    let xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    xi = ((xi % px) + px) % px; yi = ((yi % py) + py) % py;
    const xj = (xi + 1) % px, yj = (yi + 1) % py;
    const P = this.p;
    const a = P[xi & 255], b = P[xj & 255];
    const h00 = P[(a + (yi & 255)) & 511] & 7, h10 = P[(b + (yi & 255)) & 511] & 7;
    const h01 = P[(a + (yj & 255)) & 511] & 7, h11 = P[(b + (yj & 255)) & 511] & 7;
    const n00 = GX[h00] * xf + GY[h00] * yf;
    const n10 = GX[h10] * (xf - 1) + GY[h10] * yf;
    const n01 = GX[h01] * xf + GY[h01] * (yf - 1);
    const n11 = GX[h11] * (xf - 1) + GY[h11] * (yf - 1);
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
    const nx0 = n00 + u * (n10 - n00), nx1 = n01 + u * (n11 - n01);
    return (nx0 + v * (nx1 - nx0)) * 1.42;
  }
  fbm(x, y, oct = 5, px = BIG, py = BIG, gain = 0.5) {
    let a = 1, f = 1, s = 0, n = 0;
    for (let i = 0; i < oct; i++) { s += a * this.noise(x * f, y * f, px * f, py * f); n += a; a *= gain; f *= 2; }
    return s / n;
  }
  ridged(x, y, oct = 5, px = BIG, py = BIG) {
    let a = 1, f = 1, s = 0, n = 0;
    for (let i = 0; i < oct; i++) { s += a * (1 - Math.abs(this.noise(x * f, y * f, px * f, py * f))); n += a; a *= 0.5; f *= 2; }
    return s / n;
  }
}

export const GLSL_NOISE = /* glsl */`
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
// quintic interpolation (no visible lattice at low frequency) and a rotation between octaves (no axis-aligned structure)
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*f*(f*(f*6.-15.)+10.);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }
const mat2 FBM_ROT = mat2(0.8, -0.6, 0.6, 0.8);
float fbm(vec2 p){ float s = 0., a = .5; for(int i=0;i<5;i++){ s += a*vnoise(p); p = FBM_ROT * p * 2.03 + vec2(1.7, 9.2); a *= .5; } return s; }
float fbm3(vec2 p){ float s = 0., a = .5; for(int i=0;i<3;i++){ s += a*vnoise(p); p = FBM_ROT * p * 2.03 + vec2(1.7, 9.2); a *= .5; } return s; }
`;
