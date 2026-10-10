import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

// Post-processing pipeline, replacing the EffectComposer chain:
//   scene -> HDR target (4x MSAA, with a depth texture)
//   depth -> half-res ambient occlusion -> bilateral blur
//   scene -> dual-filter bloom (progressive down/up sampling, no boxy halos)
//   one composite pass: lens drops, chromatic fringe, AO, bloom, ACES tone map, grade, vignette, grain

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';

const shader = (frag, uniforms, defines = {}, extra = {}) => new THREE.ShaderMaterial({
  vertexShader: VERT, fragmentShader: frag, uniforms, defines, depthTest: false, depthWrite: false, toneMapped: false, ...extra,
});

const LINZ = /* glsl */`
uniform float uNear, uFar;
float linZ(float d){ return 2.0 * uNear * uFar / (uFar + uNear - (d * 2.0 - 1.0) * (uFar - uNear)); }
`;

const AO_FRAG = /* glsl */`
uniform sampler2D tDepth;
uniform vec2 uRes, uProjScale;
uniform float uRadius, uIntensity, uBias, uFocal;
varying vec2 vUv;
${LINZ}
vec3 viewPos(vec2 uv){
  float l = linZ(texture2D(tDepth, uv).x);
  return vec3((uv * 2.0 - 1.0) * uProjScale * l, -l);
}
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main(){
  float d0 = texture2D(tDepth, vUv).x;
  if (d0 > 0.99999) { gl_FragColor = vec4(1.0); return; }
  vec3 P = viewPos(vUv);
  vec2 tx = 1.0 / uRes;
  vec3 pr = viewPos(vUv + vec2(tx.x, 0.0)), pl = viewPos(vUv - vec2(tx.x, 0.0));
  vec3 pu = viewPos(vUv + vec2(0.0, tx.y)), pd = viewPos(vUv - vec2(0.0, tx.y));
  vec3 dx = abs(pr.z - P.z) < abs(P.z - pl.z) ? pr - P : P - pl;
  vec3 dy = abs(pu.z - P.z) < abs(P.z - pd.z) ? pu - P : P - pd;
  vec3 N = normalize(cross(dx, dy));
  float rpx = clamp(uRadius * uFocal / -P.z, 3.0, 36.0);
  float rot = ign(gl_FragCoord.xy) * 6.2831853;
  float occ = 0.0;
  for (int i = 0; i < SAMPLES; i++) {
    float fi = (float(i) + 0.5) / float(SAMPLES);
    float a = rot + float(i) * 2.3999632;
    vec2 off = vec2(cos(a), sin(a)) * rpx * (0.2 + 0.8 * fi) * tx;
    vec3 v = viewPos(vUv + off) - P;
    float len = length(v);
    float c = dot(N, v) / max(len, 1e-4);
    float fall = clamp(1.0 - len / uRadius, 0.0, 1.0);
    occ += max(c - uBias, 0.0) * fall;
  }
  float ao = 1.0 - clamp(occ * uIntensity / float(SAMPLES), 0.0, 1.0);
  gl_FragColor = vec4(vec3(ao), 1.0);
}`;

const BLUR_FRAG = /* glsl */`
uniform sampler2D tAO, tDepth;
uniform vec2 uStep;
varying vec2 vUv;
${LINZ}
void main(){
  float z0 = linZ(texture2D(tDepth, vUv).x);
  float sum = texture2D(tAO, vUv).r, wsum = 1.0;
  for (int i = -3; i <= 3; i++) {
    if (i == 0) continue;
    vec2 uv = vUv + uStep * float(i);
    float z = linZ(texture2D(tDepth, uv).x);
    float w = exp(-abs(z - z0) / (0.04 * z0 + 0.03)) * (1.0 - abs(float(i)) * 0.22);
    sum += texture2D(tAO, uv).r * w; wsum += w;
  }
  gl_FragColor = vec4(vec3(sum / wsum), 1.0);
}`;

// Jimenez / CoD:AW dual filter. The first level uses a Karis average so single fireflies cannot flicker.
const DOWN_FRAG = /* glsl */`
uniform sampler2D tSrc; uniform vec2 uTexel;
varying vec2 vUv;
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 karis(vec3 c){ return c / (1.0 + luma(c)); }
void main(){
  vec2 t = uTexel;
  vec3 a = texture2D(tSrc, vUv + t * vec2(-2.0, -2.0)).rgb, b = texture2D(tSrc, vUv + t * vec2(0.0, -2.0)).rgb, c = texture2D(tSrc, vUv + t * vec2(2.0, -2.0)).rgb;
  vec3 d = texture2D(tSrc, vUv + t * vec2(-2.0, 0.0)).rgb,  e = texture2D(tSrc, vUv).rgb,                       f = texture2D(tSrc, vUv + t * vec2(2.0, 0.0)).rgb;
  vec3 g = texture2D(tSrc, vUv + t * vec2(-2.0, 2.0)).rgb,  h = texture2D(tSrc, vUv + t * vec2(0.0, 2.0)).rgb,  i = texture2D(tSrc, vUv + t * vec2(2.0, 2.0)).rgb;
  vec3 j = texture2D(tSrc, vUv + t * vec2(-1.0, -1.0)).rgb, k = texture2D(tSrc, vUv + t * vec2(1.0, -1.0)).rgb;
  vec3 l = texture2D(tSrc, vUv + t * vec2(-1.0, 1.0)).rgb,  m = texture2D(tSrc, vUv + t * vec2(1.0, 1.0)).rgb;
  #ifdef FIRST
    vec3 g0 = (a + b + d + e) * 0.25, g1 = (b + c + e + f) * 0.25, g2 = (d + e + g + h) * 0.25, g3 = (e + f + h + i) * 0.25, g4 = (j + k + l + m) * 0.25;
    vec3 o = karis(g0) * 0.125 + karis(g1) * 0.125 + karis(g2) * 0.125 + karis(g3) * 0.125 + karis(g4) * 0.5;
    o *= 1.0 + luma(o);
  #else
    vec3 o = (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + e * 0.125 + (j + k + l + m) * 0.125;
  #endif
  gl_FragColor = vec4(o, 1.0);
}`;

const UP_FRAG = /* glsl */`
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uWeight;
varying vec2 vUv;
void main(){
  vec4 d = uTexel.xyxy * vec4(1.0, 1.0, -1.0, 0.0);
  vec3 s = texture2D(tSrc, vUv - d.xy).rgb + texture2D(tSrc, vUv - d.wy).rgb * 2.0 + texture2D(tSrc, vUv - d.zy).rgb
         + texture2D(tSrc, vUv + d.zw).rgb * 2.0 + texture2D(tSrc, vUv).rgb * 4.0 + texture2D(tSrc, vUv + d.xw).rgb * 2.0
         + texture2D(tSrc, vUv + d.zy).rgb + texture2D(tSrc, vUv + d.wy).rgb * 2.0 + texture2D(tSrc, vUv + d.xy).rgb;
  gl_FragColor = vec4(s * (uWeight / 16.0), 1.0);
}`;

const COMPOSITE_FRAG = /* glsl */`
uniform sampler2D tScene, tBloom, tAO;
uniform vec2 uRes;
uniform float uTime, uWet, uExposure, uBloom, uBloomNorm, uAO, uCA, uVignette, uGrain, uContrast, uSat, uSplit, uFade, uSharp;
varying vec2 vUv;

float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
// water drops sliding on the lens: returns a UV offset
vec2 drops(vec2 uv, float t){
  vec2 asp = vec2(uRes.x / uRes.y, 1.); vec2 off = vec2(0.);
  for (int l = 0; l < 2; l++){
    float sc = l == 0 ? 9. : 17.;
    vec2 p = uv * asp * sc; p.y += t * 0.04 * float(l + 1);
    vec2 id = floor(p), f = fract(p) - .5;
    float r1 = h21(id + float(l) * 7.3), r2 = h21(id * 1.7 + 3.1);
    vec2 c = (vec2(r1, r2) - .5) * .6;
    float life = fract(t * (.12 + r1 * .2) + r2);
    float rad = (.12 + .22 * h21(id + 11.)) * smoothstep(0., .08, life) * smoothstep(1., .55, life);
    vec2 d = f - c; float dist = length(d * vec2(1., .85));
    float m = smoothstep(rad, rad * .6, dist) * step(.45, h21(id + 5.));
    off += d * m * -.9 / sc;
  }
  return off;
}

// same curve as three's ACESFilmicToneMapping
vec3 aces(vec3 color){
  const mat3 inM = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 outM = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color *= uExposure / 0.6;
  color = inM * color;
  vec3 a = color * (color + 0.0245786) - 0.000090537;
  vec3 b = color * (0.983729 * color + 0.4329510) + 0.238081;
  return clamp(outM * (a / b), 0.0, 1.0);
}
vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }

void main(){
  vec2 uv = vUv;
  vec2 o = uWet > 0.001 ? drops(uv, uTime) * uWet : vec2(0.);
  uv += o;
  vec2 q = uv - 0.5;
  vec2 ca = q * dot(q, q) * uCA;
  vec3 col = vec3(texture2D(tScene, uv - ca).r, texture2D(tScene, uv).g, texture2D(tScene, uv + ca).b);
  #ifdef USE_AO
    float ao = texture2D(tAO, uv).r;
    #ifdef DEBUG_AO
      gl_FragColor = vec4(vec3(ao), 1.0); return;
    #endif
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    // occlusion matters where light is ambient; strongly lit surfaces and emitters are left alone
    col *= mix(mix(1.0, ao, uAO), 1.0, smoothstep(0.25, 2.0, lum));
  #endif
  #ifdef USE_BLOOM
    col += texture2D(tBloom, uv).rgb * (uBloom * uBloomNorm);
  #endif
  col += vec3(length(o) * 60. * 0.02);
  vec3 c = toSRGB(aces(col));

  // grade: gentle S-curve, cool shadows / warm highlights, slight desaturation
  c = mix(c, c * c * (3.0 - 2.0 * c), uContrast);
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c += (vec3(-0.012, 0.004, 0.030) * (1.0 - l) * (1.0 - l) + vec3(0.034, 0.014, -0.022) * l * l) * uSplit;
  c = mix(vec3(l), c, uSat);

  float vig = smoothstep(.95, .25, length(q * vec2(1.1, 1.)));
  c *= mix(1.0 - uVignette, 1., vig);
  c += (h21(uv * uRes + fract(uTime) * 100.) - .5) * uGrain;
  c *= 1. - uFade;
  gl_FragColor = vec4(c, 1.);
}`;

const RT_OPTS = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false };

export class Post {
  constructor(renderer, scene, camera, quality) {
    this.r = renderer; this.scene = scene; this.camera = camera; this.q = quality;
    this.quad = new FullScreenQuad(null);
    this.ao = !!quality.ao; this.bloom = !!quality.bloom; this.samples = quality.name === 'low' ? 0 : 4;
    this.size = new THREE.Vector2();
    this.u = { // live-tunable look parameters
      uTime: { value: 0 }, uWet: { value: 0 }, uRes: { value: new THREE.Vector2() }, uExposure: { value: 1.2 },
      uBloom: { value: 0.2 }, uBloomNorm: { value: 1 }, uAO: { value: 0.9 }, uCA: { value: 0.0045 }, uVignette: { value: 0.42 }, uGrain: { value: 0.024 },
      uContrast: { value: 0.35 }, uSat: { value: 1.0 }, uSplit: { value: 1.0 }, uFade: { value: 0 }, uSharp: { value: 0 },
    };
    // bloomR: how much each blur level contributes relative to the finest one (normalised in the composite)
    this.params = { aoRadius: 0.7, aoIntensity: 2.4, aoBias: 0.15, bloomR: [1.0, 0.85, 0.7, 0.5, 0.35, 0.2] };
    this.rts = [];
    this.build();
  }

  build() {
    const r = this.r; r.getDrawingBufferSize(this.size);
    const w = Math.max(2, this.size.x | 0), h = Math.max(2, this.size.y | 0);
    this.dispose(true);
    this.depth = new THREE.DepthTexture(w, h);
    this.depth.type = THREE.UnsignedIntType; this.depth.minFilter = this.depth.magFilter = THREE.NearestFilter;
    this.sceneRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: this.samples, depthTexture: this.depth, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.rts.push(this.sceneRT);
    this.u.uRes.value.set(w, h);

    const defines = {};
    if (this.ao) {
      const aw = Math.max(2, w >> 1), ah = Math.max(2, h >> 1);
      this.aoA = new THREE.WebGLRenderTarget(aw, ah, { ...RT_OPTS, type: THREE.UnsignedByteType });
      this.aoB = new THREE.WebGLRenderTarget(aw, ah, { ...RT_OPTS, type: THREE.UnsignedByteType });
      this.rts.push(this.aoA, this.aoB);
      const near = { uNear: { value: 0 }, uFar: { value: 0 } };
      this.aoU = { ...near, tDepth: { value: this.depth }, uRes: { value: new THREE.Vector2(aw, ah) }, uProjScale: { value: new THREE.Vector2() }, uRadius: { value: 0.7 }, uIntensity: { value: 2.4 }, uBias: { value: 0.15 }, uFocal: { value: 1 } };
      this.aoMat = shader(AO_FRAG, this.aoU, { SAMPLES: 12 });
      this.blurU = { ...near, tAO: { value: null }, tDepth: { value: this.depth }, uStep: { value: new THREE.Vector2() } };
      this.blurMat = shader(BLUR_FRAG, this.blurU);
      defines.USE_AO = '';
    }
    if (this.bloom) {
      this.mips = [];
      let mw = w >> 1, mh = h >> 1;
      for (let i = 0; i < 6 && mw >= 4 && mh >= 4; i++, mw >>= 1, mh >>= 1) {
        const rt = new THREE.WebGLRenderTarget(mw, mh, { ...RT_OPTS, type: THREE.HalfFloatType, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping });
        this.mips.push(rt); this.rts.push(rt);
      }
      this.downU = { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } };
      this.downFirst = shader(DOWN_FRAG, this.downU, { FIRST: '' });
      this.down = shader(DOWN_FRAG, this.downU);
      this.upU = { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uWeight: { value: 1 } };
      this.up = shader(UP_FRAG, this.upU, {}, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, transparent: true });
      defines.USE_BLOOM = '';
    }
    this.compU = { ...this.u, tScene: { value: this.sceneRT.texture }, tBloom: { value: this.bloom ? this.mips[0].texture : null }, tAO: { value: this.ao ? this.aoA.texture : null } };
    this.comp = shader(COMPOSITE_FRAG, this.compU, defines);
  }

  setSize() { this.build(); }

  // change effects at run time (the quality governor uses this); rebuilds the targets and the composite
  configure({ ao = this.ao, samples = this.samples } = {}) { this.ao = ao; this.samples = samples; this.build(); }

  dispose(keepQuad = false) {
    for (const rt of this.rts) rt.dispose();
    this.rts.length = 0;
    this.depth?.dispose();
    for (const m of [this.aoMat, this.blurMat, this.downFirst, this.down, this.up, this.comp]) m?.dispose();
    if (!keepQuad) this.quad.dispose();
  }

  pass(material, target) {
    const r = this.r;
    this.quad.material = material;
    r.setRenderTarget(target);
    this.quad.render(r);
  }

  render() {
    const r = this.r, cam = this.camera, P = this.params;
    r.setRenderTarget(this.sceneRT);
    r.render(this.scene, cam);

    if (this.ao) {
      const u = this.aoU, a = this.aoA;
      u.uNear.value = this.blurU.uNear.value = cam.near; u.uFar.value = this.blurU.uFar.value = cam.far;
      const p11 = cam.projectionMatrix.elements[5];
      u.uProjScale.value.set(1 / cam.projectionMatrix.elements[0], 1 / p11);
      u.uFocal.value = 0.5 * a.height * p11;
      u.uRadius.value = P.aoRadius; u.uIntensity.value = P.aoIntensity; u.uBias.value = P.aoBias;
      this.pass(this.aoMat, this.aoA);
      this.blurU.tAO.value = this.aoA.texture; this.blurU.uStep.value.set(1 / a.width, 0);
      this.pass(this.blurMat, this.aoB);
      this.blurU.tAO.value = this.aoB.texture; this.blurU.uStep.value.set(0, 1 / a.height);
      this.pass(this.blurMat, this.aoA);
    }

    if (this.bloom) {
      const m = this.mips, prevAuto = r.autoClear;
      this.downU.tSrc.value = this.sceneRT.texture;
      this.downU.uTexel.value.set(1 / this.sceneRT.width, 1 / this.sceneRT.height);
      this.pass(this.downFirst, m[0]);
      for (let i = 1; i < m.length; i++) {
        this.downU.tSrc.value = m[i - 1].texture; this.downU.uTexel.value.set(1 / m[i - 1].width, 1 / m[i - 1].height);
        this.pass(this.down, m[i]);
      }
      r.autoClear = false; // upsample additively onto the existing down-sampled content
      for (let i = m.length - 1; i > 0; i--) {
        this.upU.tSrc.value = m[i].texture; this.upU.uTexel.value.set(1 / m[i].width, 1 / m[i].height);
        this.upU.uWeight.value = P.bloomR[i] / P.bloomR[i - 1]; // chained: level i reaches mip 0 with weight bloomR[i]
        this.pass(this.up, m[i - 1]);
      }
      r.autoClear = prevAuto;
      let norm = 0; for (let i = 0; i < m.length; i++) norm += P.bloomR[i];
      this.u.uBloomNorm.value = 1 / norm;
    }

    this.u.uExposure.value = r.toneMappingExposure;
    this.pass(this.comp, null);
  }
}
