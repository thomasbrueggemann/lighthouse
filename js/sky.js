import * as THREE from 'three';
import { GLSL_NOISE } from './noise.js';

// The moon sits behind the cloud deck to the north-west. Everything that needs to agree about where it is
// (sky dome, sea reflections, reflection probe, the directional light) reads it from here.
export const MOON_DIR = new THREE.Vector3(-0.5, 0.42, -0.62).normalize();

// Uniforms shared by the sky dome, the ocean's reflections and the reflection probe.
export const skyU = {
  uTime: { value: 0 },
  uFlash: { value: 0 },
  uFlashDir: { value: new THREE.Vector3(1, 0.4, 0) },
  uCalm: { value: 0 },
  uMoonVis: { value: 0.4 },
  uMoonDir: { value: MOON_DIR.clone() },
};

// Linear HDR radiance of the storm sky in direction d. `full` = 1 for the dome, 0 for cheap reflection lookups.
export const GLSL_SKY = /* glsl */`
${GLSL_NOISE}
uniform float uTime, uFlash, uCalm, uMoonVis;
uniform vec3 uFlashDir, uMoonDir;

vec3 stormSky(vec3 d, float full){
  float h = d.y, hh = max(h, 0.0);
  // sea-haze glow at the horizon, deepening to a blue-black zenith
  vec3 base = mix(vec3(0.058, 0.072, 0.092), vec3(0.020, 0.028, 0.042), smoothstep(0.0, 0.28, hh));
  base = mix(base, vec3(0.007, 0.011, 0.020), smoothstep(0.25, 1.0, hh));

  // cloud deck projected on a plane, scrolling with the wind
  vec2 uv = d.xz / (hh + 0.15);
  vec2 wind = vec2(uTime * 0.020, uTime * 0.008);
  float lo = fbm(uv * 0.5 + wind);
  float hi = full > 0.5 ? fbm(uv * 1.7 - wind * 1.7 + lo * 1.4) : lo;
  float dens = lo * 0.74 + hi * 0.44;
  float md = max(dot(d, uMoonDir), 0.0);
  // a drifting window in the cloud around the moon (uMoonVis also drives the moonlight itself)
  float gap = pow(md, 90.0) * uMoonVis;
  float cover = smoothstep(0.33, 0.80, dens - gap * 0.5);

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

  vec3 col = mix(base, cloud, cover);
  // the moon itself, seen through the thin spots
  float disc = smoothstep(0.99905, 0.99965, md);
  col += vec3(0.85, 0.92, 1.1) * disc * pow(1.0 - cover, 2.0) * (0.3 + uMoonVis) * 1.8;
  col += vec3(0.30, 0.38, 0.55) * pow(md, 220.0) * (1.0 - cover * 0.8) * (0.3 + uMoonVis);

  // lightning lights the cloud deck from within
  float fd = max(dot(d, normalize(uFlashDir)), 0.0);
  float fl = uFlash * (0.25 + 0.75 * pow(fd, 3.0));
  col += vec3(0.50, 0.58, 0.85) * fl * (0.15 + cover * (0.7 + rim * 1.2)) * 1.6;

  // dawn: a thin warm band along the horizon as the storm passes
  col = mix(col, col + vec3(0.30, 0.20, 0.16), uCalm * smoothstep(0.35, -0.05, h) * 0.55);
  return col;
}
`;

// A cheap stand-in for the sky when reflecting it in wet stone and puddles: gradient, a few cloud octaves, the moon and the flashes.
export const GLSL_PROBE = /* glsl */`
${GLSL_NOISE}
uniform float uTime, uFlash, uMoonVis;
uniform vec3 uFlashDir, uMoonDir;
vec3 skyProbe(vec3 d){
  float hh = max(d.y, 0.0);
  vec3 base = mix(vec3(0.058, 0.072, 0.092), vec3(0.012, 0.017, 0.03), smoothstep(0.0, 0.5, hh));
  float cover = smoothstep(0.3, 0.8, fbm3(d.xz / (hh + 0.15) * 0.5 + vec2(uTime * 0.02, uTime * 0.008)));
  float md = max(dot(d, uMoonDir), 0.0);
  vec3 col = mix(base, vec3(0.02, 0.026, 0.04), cover * 0.6);
  col += vec3(0.30, 0.38, 0.55) * (pow(md, 6.0) * 0.25 + pow(md, 60.0) * 1.2) * (0.3 + uMoonVis * (1.0 - cover * 0.7));
  col += vec3(0.5, 0.58, 0.85) * uFlash * (0.3 + 0.7 * pow(max(dot(d, normalize(uFlashDir)), 0.0), 3.0)) * (0.2 + cover) * 1.6;
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
}
