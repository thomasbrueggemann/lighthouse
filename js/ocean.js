import * as THREE from 'three';
import { GLSL_SKY, skyU } from './sky.js';

// [dirX, dirZ, amplitude, wavelength] — storm swell rolling in from the west
const RAW = [
  [1.0, 0.25, 1.05, 52],
  [0.92, -0.38, 0.62, 33],
  [1.0, 0.62, 0.42, 21],
  [0.70, -0.71, 0.26, 12.5],
  [1.0, -0.12, 0.17, 7.8],
  [0.45, 0.89, 0.11, 5.1],
];
const STEEP = 0.62;
export const WAVES = RAW.map(([dx, dz, a, L], i) => {
  const l = Math.hypot(dx, dz), k = 2 * Math.PI / L;
  return { dx: dx / l, dz: dz / l, a, k, w: Math.sqrt(9.81 * k), q: Math.min(1, STEEP / (k * a * RAW.length)), p: i * 1.7 };
});

const _v = new THREE.Vector3();
export function waveDisp(x, z, t, out = _v) {
  let dx = 0, dy = 0, dz = 0;
  for (const w of WAVES) {
    const ph = w.k * (w.dx * x + w.dz * z) - w.w * t + w.p;
    const c = Math.cos(ph), s = Math.sin(ph);
    dx += w.q * w.a * w.dx * c; dz += w.q * w.a * w.dz * c; dy += w.a * s;
  }
  return out.set(dx, dy, dz);
}
export function waveHeight(x, z, t) {
  let px = x, pz = z;
  for (let i = 0; i < 3; i++) { waveDisp(px, pz, t); px = x - _v.x; pz = z - _v.z; }
  return waveDisp(px, pz, t).y;
}

function oceanGeometry(N = 320, L = 700) {
  const pos = new Float32Array((N + 1) * (N + 1) * 3), idx = [];
  const map = (t) => L * (0.12 * t + 0.88 * t * t * t);
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const k = (j * (N + 1) + i) * 3;
    pos[k] = map(i / N * 2 - 1); pos[k + 1] = 0; pos[k + 2] = map(j / N * 2 - 1);
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = j * (N + 1) + i, b = a + N + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

export class Ocean {
  constructor(ctx) {
    const W = WAVES.map(w => new THREE.Vector4(w.dx, w.dz, w.a, w.k));
    const W2 = WAVES.map(w => new THREE.Vector4(w.w, w.q, w.p, 0));
    this.uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uBeam: { value: 0 }, uBeamAngle: { value: 0 },
      uLantern: { value: new THREE.Vector3(0, 31.35, 0) },
      uIsland: { value: null }, uIslandRect: { value: new THREE.Vector3() },
      uW: { value: W }, uW2: { value: W2 },
      uDeep: { value: new THREE.Color(0x02080b) }, uShallow: { value: new THREE.Color(0x0b2a2c) },
      uFoam: { value: new THREE.Color(0xc8d2d6) }, uSkyLow: { value: new THREE.Color(0x0b0f14) }, uSkyHigh: { value: new THREE.Color(0x151b22) },
      uAmbient: { value: 1 },
    }]);
    Object.assign(this.uniforms, skyU); // uTime, uFlash, moon & sky state are shared with the dome
    this.uniforms.uIsland.value = ctx.island.tex;
    this.uniforms.uIslandRect.value = ctx.island.rect;
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, fog: true,
      vertexShader: /* glsl */`
        #include <fog_pars_vertex>
        uniform float uTime; uniform vec4 uW[6]; uniform vec4 uW2[6];
        varying vec3 vW; varying vec3 vN; varying float vJ; varying float vH;
        void main(){
          vec3 p = position; vec3 d = vec3(0.); vec3 n = vec3(0.,1.,0.);
          float fade = 1.0 - smoothstep(250., 650., length(p.xz));
          for(int i=0;i<6;i++){
            vec4 w = uW[i]; vec4 w2 = uW2[i];
            float ph = w.w * dot(w.xy, p.xz) - w2.x * uTime + w2.z;
            float c = cos(ph), s = sin(ph);
            d.x += w2.y * w.z * w.x * c; d.z += w2.y * w.z * w.y * c; d.y += w.z * s;
            n.x -= w.x * w.w * w.z * c; n.z -= w.y * w.w * w.z * c; n.y -= w2.y * w.w * w.z * s;
          }
          d *= fade; n = mix(vec3(0.,1.,0.), n, fade);
          vec3 wp = p + d;
          vW = wp; vN = n; vJ = n.y; vH = d.y;
          vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */`
        #include <common>
        #include <fog_pars_fragment>
        ${GLSL_SKY}
        uniform float uBeam, uBeamAngle, uAmbient;
        uniform vec3 uLantern, uIslandRect, uDeep, uShallow, uFoam, uSkyLow, uSkyHigh;
        uniform sampler2D uIsland;
        varying vec3 vW; varying vec3 vN; varying float vJ; varying float vH;
        float islandH(vec2 xz){ vec2 uv = (xz - uIslandRect.xy) / uIslandRect.z;
          if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) return -30.; return texture2D(uIsland, uv).r; }
        void main(){
          float rh = islandH(vW.xz);
          if (rh > 3.2) discard;
          vec3 N = normalize(vN);
          // fine chop
          vec2 q = vW.xz;
          vec2 dn = vec2(0.);
          dn += vec2(0.8, 0.5) * cos(dot(q, vec2(3.3, 2.1)) - uTime * 5.1) * 0.10;
          dn += vec2(-0.4, 0.9) * cos(dot(q, vec2(-2.0, 4.6)) - uTime * 6.0) * 0.08;
          dn += vec2(0.9, -0.3) * cos(dot(q, vec2(6.1, -2.2)) - uTime * 7.7) * 0.06;
          dn += vec2(0.2, 1.0) * cos(dot(q, vec2(1.5, 8.0)) - uTime * 8.9) * 0.05;
          float dist = length(cameraPosition - vW);
          dn *= 1.0 - smoothstep(40., 160., dist);
          N = normalize(N + vec3(dn.x, 0., dn.y));
          vec3 V = normalize(cameraPosition - vW);
          float NdV = max(dot(N, V), 0.);
          float fres = 0.02 + 0.98 * pow(1. - NdV, 5.);
          vec3 R = reflect(-V, N); R.y = abs(R.y);
          float amb = uAmbient + uFlash * 7.0;
          vec3 sky = stormSky(R, 0.0);
          float depthT = clamp(vH * 0.3 + 0.45, 0., 1.);
          vec3 water = mix(uDeep, uShallow, depthT) * (0.7 + uFlash * 5.0);
          float near = exp(-max(-rh, 0.) * 0.3) * step(-29., rh);
          water = mix(water, uShallow * 1.8 * amb, near * 0.45);
          vec3 col = mix(water, sky, fres);
          // lighthouse beam sweeping the sea
          vec3 toF = vW - uLantern;
          float hd = length(toF.xz);
          float ang = atan(toF.z, toF.x);
          float d1 = abs(mod(ang - uBeamAngle + PI, PI2) - PI);
          float d2 = abs(mod(ang - uBeamAngle, PI2) - PI);
          float bd = min(d1, d2);
          float bw = 0.05 + 3.0 / (hd + 4.);
          float beam = exp(-bd * bd / (bw * bw)) * uBeam;
          vec3 Lb = normalize(uLantern - vW);
          vec3 Hh = normalize(Lb + V);
          float spec = pow(max(dot(N, Hh), 0.), 90.);
          col += vec3(1., .92, .72) * beam * (0.04 + spec * 2.5) * 40. / (hd * 0.12 + 6.);
          // foam: breaking crests + surf against the rocks
          float fn = fbm(vW.xz * 0.22 + vec2(uTime * 0.32, uTime * 0.07));
          float fn2 = fbm(vW.xz * 0.9 - vec2(uTime * 0.25, -uTime * 0.05));
          float crest = smoothstep(0.62, 0.18, vJ) + smoothstep(0.9, 1.6, vH) * 0.5;
          float shore = exp(-pow((rh - vH * 0.6 + 0.4) / 1.3, 2.)) * step(-29., rh);
          float surge = 0.6 + 0.4 * sin(uTime * 0.9 + vW.x * 0.08 + vW.z * 0.05);
          float foamAmt = crest * fn * 1.5 + shore * (0.3 + fn2 * 1.1) * surge;
          foamAmt *= smoothstep(0.3, 0.75, fn2 * 0.75 + foamAmt * 0.45);
          foamAmt += smoothstep(0.3, 0.9, fn) * 0.06;
          foamAmt = clamp(foamAmt, 0., 1.);
          vec3 foamCol = uFoam * (0.16 * uAmbient + uFlash * 4.0) + vec3(1., .93, .75) * beam * 0.5 * 30. / (hd * 0.12 + 6.);
          col = mix(col, foamCol, foamAmt);
          gl_FragColor = vec4(col, 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(oceanGeometry(), mat);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'ocean';
    this.mesh.renderOrder = 1;
    ctx.scene.add(this.mesh);
  }
  update(t, flash, beamI, beamAngle) {
    const u = this.uniforms;
    u.uTime.value = t; u.uFlash.value = flash; u.uBeam.value = beamI; u.uBeamAngle.value = beamAngle;
  }
}
