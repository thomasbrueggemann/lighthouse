import * as THREE from 'three';
import { GLSL_NOISE } from './noise.js';

// The moon sits behind the cloud deck to the north-west. Everything that needs to agree about where it is
// (sky dome, sea reflections, reflection probe, the directional light) reads it from here.
export const MOON_DIR = new THREE.Vector3(-0.5, 0.42, -0.62).normalize();

// When the storm has passed the sun comes up opposite the moon, east-north-east. `calm` (0..1, ramped over the
// ninety seconds after the log is written) drives all of it: twilight glow first, then the disc climbs to about 8 degrees.
export const SUN_AZ = new THREE.Vector2(0.9, -0.44).normalize();   // horizontal direction (x, z)
export const SUN_SIN_FINAL = 0.14;                                 // sine of the sun's final elevation
const smooth01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function dawnState(calm) {
  const s = calm * calm * (3 - 2 * calm);
  const sunY = -0.22 + (SUN_SIN_FINAL + 0.22) * s;
  return { sunY, glow: smooth01(-0.22, 0.0, sunY), up: smooth01(0.0, 0.07, sunY) };   // glow: twilight 0..1, up: sun clear of the horizon 0..1
}
export function sunDirAt(sunY, out = new THREE.Vector3()) {
  const ce = Math.sqrt(1 - sunY * sunY);
  return out.set(SUN_AZ.x * ce, sunY, SUN_AZ.y * ce);
}

// Uniforms shared by the sky dome, the ocean's reflections and the reflection probe.
export const skyU = {
  uTime: { value: 0 },
  uFlash: { value: 0 },
  uFlashDir: { value: new THREE.Vector3(1, 0.4, 0) },
  uCalm: { value: 0 },
  uDawn: { value: 0 },
  uMoonVis: { value: 0.4 },
  uMoonDir: { value: MOON_DIR.clone() },
  uSunDir: { value: sunDirAt(-0.22) },
};

// The warm glow of a clearing sky near the horizon, brightest toward the sun and mauve away from it. The dome adds it to
// the sky, the ocean adds it to the haze it fades into, and wet stone picks it up in its reflections.
const GLSL_DAWN = /* glsl */`
uniform float uCalm, uDawn;
uniform vec3 uSunDir;
vec3 dawnGlow(vec3 d){
  if (uDawn < 0.001) return vec3(0.0);
  float hh = max(d.y, 0.0);
  float az = 0.5 + 0.5 * dot(normalize(d.xz + 1e-5), normalize(uSunDir.xz));      // 1 toward the sun, 0 away from it
  float side = az * az;
  float band = exp(-hh * mix(11.0, 3.4, side));                                   // hugs the horizon, taller on the sun side
  vec3 c = mix(vec3(0.050, 0.040, 0.085), vec3(0.80, 0.17, 0.05), pow(az, 3.0)); // dusky violet -> rose -> deep orange
  c = mix(c, vec3(1.25, 0.52, 0.15), pow(az, 14.0) * 0.7);                        // gold right at the sun
  return c * band * (0.15 + 0.85 * side) * uDawn;
}
`;

// Linear HDR radiance of the storm sky in direction d. `full` = 1 for the dome, 0 for cheap reflection lookups.
export const GLSL_SKY = /* glsl */`
${GLSL_NOISE}
${GLSL_DAWN}
uniform float uTime, uFlash, uMoonVis;
uniform vec3 uFlashDir, uMoonDir;

vec3 stormSky(vec3 d, float full){
  float h = d.y, hh = max(h, 0.0);
  // sea-haze glow at the horizon, deepening to a blue-black zenith
  vec3 base = mix(vec3(0.058, 0.072, 0.092), vec3(0.020, 0.028, 0.042), smoothstep(0.0, 0.28, hh));
  base = mix(base, vec3(0.007, 0.011, 0.020), smoothstep(0.25, 1.0, hh));
  // as the night ends the dome lifts to a deep clear blue, a little teal toward the horizon
  base += mix(vec3(0.016, 0.026, 0.050), vec3(0.010, 0.020, 0.075), smoothstep(0.0, 0.7, hh)) * uDawn * (0.4 + 0.6 * smoothstep(0.0, 0.5, uCalm));

  // cloud deck projected on a plane, scrolling with the wind
  vec2 uv = d.xz / (hh + 0.15);
  vec2 wind = vec2(uTime * 0.020, uTime * 0.008);
  float lo = fbm(uv * 0.5 + wind);
  float hi = full > 0.5 ? fbm(uv * 1.7 - wind * 1.7 + lo * 1.4) : lo;
  float dens = lo * 0.74 + hi * 0.44;
  float md = max(dot(d, uMoonDir), 0.0);
  float sd = max(dot(d, uSunDir), 0.0);
  // a drifting window in the cloud around the moon (uMoonVis also drives the moonlight itself); the deck breaks up as the storm passes
  float gap = pow(md, 90.0) * uMoonVis;
  float cover = smoothstep(0.33 + 0.24 * uCalm, 0.80 + 0.10 * uCalm, dens - gap * 0.5);

  // clouds are lit from behind: bright rims where the deck thins toward the moon, dark bellies elsewhere
  vec2 mv = normalize(uMoonDir.xz + 1e-4) * 0.16;
  float lo2 = fbm((uv + mv) * 0.5 + wind);
  float rim = clamp((lo - lo2) * 6.0 + 0.45, 0.0, 1.0);
  float glow = 0.05 + pow(md, 5.0) * 0.8 + pow(md, 48.0) * 2.2;
  vec3 cloudDark = vec3(0.012, 0.016, 0.023);
  vec3 cloudLit  = vec3(0.17, 0.21, 0.30);
  vec3 cloud = mix(cloudDark, cloudLit, clamp(glow * (0.25 + rim * 0.9), 0.0, 1.0));
  // under-lit horizon: the deck catches the sea's pale spray glow near the horizon
  cloud += vec3(0.020, 0.026, 0.034) * smoothstep(0.45, 0.0, hh);

  // sunrise light on the deck: warm and strongest toward the sun and low in the sky, with bright rims where the deck thins toward it
  if (uDawn > 0.001) {
    float rimS = 0.5;
    if (full > 0.5) {
      vec2 sv = normalize(uSunDir.xz + 1e-4) * 0.16;
      rimS = clamp((lo - fbm((uv + sv) * 0.5 + wind)) * 6.0 + 0.45, 0.0, 1.0);
    }
    float az = 0.5 + 0.5 * dot(normalize(d.xz + 1e-5), normalize(uSunDir.xz));
    float lowK = smoothstep(0.85, 0.0, hh);
    float lightK = pow(az, 2.2) * (0.12 + 0.88 * lowK) * (0.2 + 0.8 * rimS);
    vec3 sunCloud = mix(vec3(0.26, 0.055, 0.06), vec3(0.65, 0.12, 0.035), pow(az, 4.0));
    cloud = mix(cloud + vec3(0.010, 0.014, 0.028) * uDawn, sunCloud, clamp(lightK * uDawn * 1.1, 0.0, 0.9));
  }

  vec3 col = mix(base, cloud, cover);
  col += dawnGlow(d);

  // the moon itself, seen through the thin spots (it pales as the sky lightens)
  float mfade = 1.0 - 0.75 * uDawn;
  float disc = smoothstep(0.99905, 0.99965, md);
  col += vec3(0.85, 0.92, 1.1) * disc * pow(1.0 - cover, 2.0) * (0.3 + uMoonVis) * 1.8 * mfade;
  col += vec3(0.30, 0.38, 0.55) * pow(md, 220.0) * (1.0 - cover * 0.8) * (0.3 + uMoonVis) * mfade;

  // the sun: a hot disc through the gaps, a glow round it, and forward-lit cloud edges beside it
  if (uDawn > 0.001) {
    float sdisc = smoothstep(0.99945, 0.99975, sd);
    vec3 sunCol = vec3(1.0, 0.36, 0.10);
    col += vec3(1.0, 0.72, 0.42) * 22.0 * sdisc * pow(1.0 - cover, 1.6);
    col += sunCol * (pow(sd, 10.0) * 0.16 + pow(sd, 110.0) * 1.1 + pow(sd, 1400.0) * 6.0) * uDawn * (1.0 - cover * 0.55);
    col += sunCol * pow(sd, 24.0) * cover * 0.9 * uDawn;
  }

  // lightning lights the cloud deck from within
  float fd = max(dot(d, normalize(uFlashDir)), 0.0);
  float fl = uFlash * (0.25 + 0.75 * pow(fd, 3.0));
  col += vec3(0.50, 0.58, 0.85) * fl * (0.15 + cover * (0.7 + rim * 1.2)) * 1.6;
  return col;
}
`;

// A cheap stand-in for the sky when reflecting it in wet stone and puddles: gradient, a few cloud octaves, the moon and the flashes.
export const GLSL_PROBE = /* glsl */`
${GLSL_NOISE}
${GLSL_DAWN}
uniform float uTime, uFlash, uMoonVis;
uniform vec3 uFlashDir, uMoonDir;
vec3 skyProbe(vec3 d){
  float hh = max(d.y, 0.0);
  vec3 base = mix(vec3(0.058, 0.072, 0.092), vec3(0.012, 0.017, 0.03), smoothstep(0.0, 0.5, hh));
  float cover = smoothstep(0.3, 0.8, fbm3(d.xz / (hh + 0.15) * 0.5 + vec2(uTime * 0.02, uTime * 0.008)));
  float md = max(dot(d, uMoonDir), 0.0);
  vec3 col = mix(base, vec3(0.02, 0.026, 0.04), cover * 0.6);
  col += vec3(0.30, 0.38, 0.55) * (pow(md, 6.0) * 0.25 + pow(md, 60.0) * 1.2) * (0.3 + uMoonVis * (1.0 - cover * 0.7)) * (1.0 - 0.7 * uDawn);
  col += vec3(0.5, 0.58, 0.85) * uFlash * (0.3 + 0.7 * pow(max(dot(d, normalize(uFlashDir)), 0.0), 3.0)) * (0.2 + cover) * 1.6;
  col += dawnGlow(d) * (1.0 - cover * 0.4) + vec3(1.0, 0.6, 0.3) * pow(max(dot(d, uSunDir), 0.0), 60.0) * uDawn * 2.5;
  return col;
}
`;

// small helper so callers don't have to know the uniform names
export function updateSky(t, flash, flashDir, calm, moonVis) {
  skyU.uTime.value = t;
  skyU.uFlash.value = flash;
  skyU.uFlashDir.value.copy(flashDir);
  skyU.uCalm.value = calm;
  skyU.uMoonVis.value = moonVis;
  const ds = dawnState(calm);
  sunDirAt(ds.sunY, skyU.uSunDir.value);
  skyU.uDawn.value = ds.glow;
  return ds;
}
