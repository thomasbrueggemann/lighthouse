import * as THREE from 'three';
import { FLOORS } from './config.js';
import { GLSL_PROBE, skyU } from './sky.js';

const v2 = (x, y = x) => new THREE.Vector2(x, y);

// small warm/cool environment for reflections on brass, glass and wet surfaces
function makeEnv(renderer) {
  const scene = new THREE.Scene();
  const geo = new THREE.SphereGeometry(10, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec3 vD; void main(){ vec3 d = normalize(vD);
      vec3 c = mix(vec3(0.03,0.025,0.02), vec3(0.09,0.085,0.08), smoothstep(-0.3,0.8,d.y));
      c += vec3(1.0,0.6,0.25) * 1.6 * pow(max(dot(d, normalize(vec3(0.6,0.2,0.5))),0.),24.);
      c += vec3(1.0,0.7,0.35) * 0.9 * pow(max(dot(d, normalize(vec3(-0.7,0.4,-0.3))),0.),18.);
      c += vec3(0.5,0.6,0.75) * 0.5 * pow(max(dot(d, normalize(vec3(0.1,0.3,-0.9))),0.),10.);
      gl_FragColor = vec4(c,1.); }`,
  });
  scene.add(new THREE.Mesh(geo, mat));
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(scene, 0.02);
  pm.dispose();
  return rt.texture;
}

// triplanar mapping for the island rock (no UV stretching on cliffs) + wetness near the sea
function triplanar(mat, scale = 0.16, nrm = null) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTri = { value: scale };
    sh.uniforms.uRockN = { value: nrm };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed,1.)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN; uniform float uTri; uniform sampler2D uRockN;')
      .replace('#include <map_fragment>', `
        vec3 bw = pow(abs(vWN), vec3(4.)); bw /= (bw.x + bw.y + bw.z);
        vec4 tx = texture2D(map, vWP.zy * uTri); vec4 ty = texture2D(map, vWP.xz * uTri); vec4 tz = texture2D(map, vWP.xy * uTri);
        vec4 tB = texture2D(map, vWP.xz * uTri * 0.23 + 0.37);
        vec4 texelColor = (tx * bw.x + ty * bw.y + tz * bw.z) * mix(vec4(1.), tB * 1.6, 0.35);
        diffuseColor *= texelColor;
        float wet = 1.0 - smoothstep(0.5, 4.5, vWP.y);
        diffuseColor.rgb *= mix(1.0, 0.55, wet);`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        vec3 nx = texture2D(uRockN, vWP.zy * uTri).xyz * 2. - 1.;
        vec3 ny = texture2D(uRockN, vWP.xz * uTri).xyz * 2. - 1.;
        vec3 nz = texture2D(uRockN, vWP.xy * uTri).xyz * 2. - 1.;
        vec3 nd = texture2D(uRockN, vWP.xz * uTri * 4.1).xyz * 2. - 1.;
        vec3 wn = normalize(vWN + 1.4 * (bw.x * vec3(0., nx.y, nx.x) + bw.y * vec3(ny.x + nd.x * 0.5, 0., ny.y + nd.y * 0.5) + bw.z * vec3(nz.x, nz.y, 0.)));
        normal = normalize((viewMatrix * vec4(wn, 0.)).xyz);`)
      .replace('#include <roughnessmap_fragment>', `
        float roughnessFactor = roughness * mix(0.62, 0.2, wet) / 0.62;`);
  };
  return mat;
}

// ---- rain-soaked surfaces. One shared uniform (the storm eases off toward dawn); only fragments outside the tower get wet.
// Wet stone is darker and glossier, streaked down its height, and mirrors the storm sky (so lightning flashes in it);
// on the island's flat ground (WET_PUDDLES) it also pools into puddles that ripple with raindrops.
export const rainWet = { value: 1 };
const WET_FUNCS = /* glsl */`
vec2 rainRipples(vec2 p, float t){
  vec2 acc = vec2(0.);
  for (int l = 0; l < 2; l++){
    float sc = l == 0 ? 2.2 : 3.7;
    vec2 q = p * sc + float(l) * 17.3, id = floor(q), f = fract(q) - 0.5;
    float h = hash12(id + float(l) * 7.1);
    float life = fract(t * (0.55 + 0.5 * h) + h * 5.0);
    vec2 c = (vec2(hash12(id * 1.7), hash12(id * 2.9)) - 0.5) * 0.5;
    vec2 d = f - c; float r = length(d);
    float ring = sin((r - life * 0.45) * 38.0) * smoothstep(0.45, 0.0, r) * smoothstep(life * 0.45 + 0.1, life * 0.45 - 0.05, r) * (1.0 - life);
    acc += normalize(d + 1e-4) * ring * 0.35;
  }
  return acc;
}`;
function wetten(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = function (sh, renderer) {
    if (prev) prev.call(this, sh, renderer);
    sh.uniforms.uRainWet = rainWet; Object.assign(sh.uniforms, skyU);
    if (!sh.vertexShader.includes('varying vec3 vWP;')) {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;');
    }
    const geoUp = sh.fragmentShader.includes('varying vec3 vWN;') ? 'vWN.y' : 'wN.y';   // the island supplies a geometric normal
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_PROBE}\nuniform float uRainWet;\n${WET_FUNCS}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        float outdoors = smoothstep(4.0, 4.8, length(vWP.xz));
        vec3 wN = inverseTransformDirection(normal, viewMatrix);
        float rainK = uRainWet * outdoors * (0.55 + 0.45 * vnoise(vec2((vWP.x + vWP.z) * 2.2, vWP.y * 0.35)));
        float puddle = 0.;
        #ifdef WET_PUDDLES
          puddle = uRainWet * outdoors * smoothstep(0.56, 0.7, vnoise(vWP.xz * 0.42 + 4.0) * 0.7 + vnoise(vWP.xz * 1.3) * 0.3) * smoothstep(0.9, 0.98, ${geoUp});
          if (puddle > 0.0) {
            vec2 rp = rainRipples(vWP.xz, uTime);
            normal = normalize((viewMatrix * vec4(normalize(vec3(rp.x, 1.0, rp.y)), 0.0)).xyz);
            diffuseColor.rgb *= mix(1.0, 0.4, puddle);
            roughnessFactor = mix(roughnessFactor, 0.03, puddle);
          }
        #endif
        diffuseColor.rgb *= mix(1.0, 0.7, rainK);
        roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.72, rainK);`)
      .replace('#include <opaque_fragment>', `{
          vec3 Vv = normalize(vViewPosition);
          vec3 Rw = inverseTransformDirection(reflect(-Vv, normal), viewMatrix);
          float fr = 0.04 + 0.96 * pow(1.0 - clamp(dot(normal, Vv), 0.0, 1.0), 5.0);
          outgoingLight += skyProbe(Rw) * fr * (rainK * 0.4 + puddle * 1.1) * 1.3;
        }
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'wet' + (mat.defines?.WET_PUDDLES !== undefined ? 'P' : '') + (prev ? 'T' : '');
  return mat;
}

export function createMaterials(T, renderer) {
  const env = makeEnv(renderer);
  const S = (o) => new THREE.MeshStandardMaterial(o);
  const t3 = (t, extra = {}) => S({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 1, ...extra });
  const emissive = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace) });

  const M = {
    env,
    plaster: t3(T.plaster, { normalScale: v2(0.7) }),
    ceiling: t3(T.plaster, { color: 0xe6d9bd, normalScale: v2(0.5) }),
    dado: t3(T.dado, { normalScale: v2(0.9), envMap: env, envMapIntensity: 0.35 }),
    stoneWhite: t3(T.stoneWhite, { normalScale: v2(1.4), roughness: 0.85 }),
    stoneRed: t3(T.stoneRed, { normalScale: v2(1.4), roughness: 0.8 }),
    granite: t3(T.rock, { color: 0xb0aca4, normalScale: v2(1.2) }),
    graniteDark: t3(T.rock, { color: 0x77736c, normalScale: v2(1.2), roughness: 0.7 }),
    cellarRock: t3(T.rock, { color: 0x8a8278, normalScale: v2(2.0) }),
    planks: t3(T.planks, { normalScale: v2(0.9) }),
    wood: t3(T.wood, { normalScale: v2(0.5) }),
    woodDark: t3(T.wood, { color: 0x6a5545, normalScale: v2(0.5) }),
    woodRed: t3(T.wood, { color: 0xc08070, normalScale: v2(0.5) }),
    paintTeal: t3(T.paintWood, { color: 0x5f8a84 }),
    paintWhite: t3(T.paintWood, { color: 0xe8e4da }),
    paintGreen: t3(T.paintWood, { color: 0x4f6a4c }),
    paintBlue: t3(T.paintWood, { color: 0x4a5f7a }),
    ironBlack: t3(T.ironBlack, { metalness: 0.6, envMap: env, envMapIntensity: 0.6 }),
    ironRed: t3(T.ironRed, { metalness: 0.3, envMap: env, envMapIntensity: 0.4 }),
    ironGreen: t3(T.ironGreen, { metalness: 0.4, envMap: env, envMapIntensity: 0.5 }),
    copper: t3(T.copper, { metalness: 0.5, envMap: env, envMapIntensity: 0.6 }),
    brick: t3(T.brick, { normalScale: v2(1.2) }),
    rug: t3(T.rug, { normalScale: v2(0.6) }),
    rug2: t3(T.rug2, { normalScale: v2(0.6) }),
    quilt: t3(T.quilt, { normalScale: v2(0.8) }),
    slate: t3(T.slate, { normalScale: v2(1.2), envMap: env, envMapIntensity: 0.3 }),
    flags: t3(T.flags, { normalScale: v2(1.2) }),
    cloth: (color) => t3(T.cloth, { color, normalScale: v2(0.5) }),
    brass: S({ color: 0xc9a050, metalness: 1, roughness: 0.3, envMap: env, envMapIntensity: 1.2 }),
    steel: S({ color: 0x8a8d90, metalness: 1, roughness: 0.4, envMap: env, envMapIntensity: 0.8 }),
    tin: S({ color: 0x9a9890, metalness: 0.8, roughness: 0.5, envMap: env, envMapIntensity: 0.6 }),
    black: S({ color: 0x111111, roughness: 0.6 }),
    ceramic: S({ color: 0xe8e2d4, roughness: 0.25, envMap: env, envMapIntensity: 0.5 }),
    ceramicBlue: S({ color: 0x3a5a8a, roughness: 0.25, envMap: env, envMapIntensity: 0.5 }),
    leather: S({ color: 0x4a2a18, roughness: 0.55 }),
    rope: t3(T.cloth, { color: 0x9a8058 }),
    oilskin: S({ color: 0xc89a1a, roughness: 0.35, envMap: env, envMapIntensity: 0.4 }),
    paper: S({ map: T.paper, roughness: 0.9 }),
    chart: S({ map: T.chart, roughness: 0.85 }),
    painting: S({ map: T.painting, roughness: 0.6 }),
    portrait: S({ map: T.portrait, roughness: 0.6 }),
    logbook: S({ map: T.logbook, roughness: 0.85 }),
    clockFace: S({ map: T.clock, roughness: 0.4 }),
    gaugeFace: S({ map: T.gauge, roughness: 0.4 }),
    baroFace: S({ map: T.baro, roughness: 0.4 }),
    radioFace: S({ map: T.radio, roughness: 0.5, emissive: 0x000000, emissiveMap: T.radio }),
    books: S({ vertexColors: true, roughness: 0.75 }),
    candle: S({ color: 0xeee6cf, roughness: 0.6 }),
    // window glass adds only reflections (additive, no diffuse): the storm stays visible through it, and a lamp in the room
    // ghosts into the pane at a slant, as it does on a real night window
    glass: S({ color: 0x000000, roughness: 0.03, metalness: 0, transparent: true, blending: THREE.AdditiveBlending, envMap: env, envMapIntensity: 3.0, depthWrite: false, side: THREE.DoubleSide }),
    glassBottle: S({ color: 0x3d6b4a, roughness: 0.08, transparent: true, opacity: 0.55, envMap: env, envMapIntensity: 1.2, depthWrite: false }),
    lampGlass: S({ color: 0xfff2d8, roughness: 0.05, transparent: true, opacity: 0.25, emissive: 0xffa040, emissiveIntensity: 0.4, depthWrite: false }),
    windowGlow: [emissive(1.1, 0.66, 0.3), emissive(1.6, 1.0, 0.46), emissive(2.2, 1.4, 0.62)],
    flame: emissive(9, 4.2, 1.2),
    ember: emissive(4.5, 1.1, 0.15),
    lensGlow: emissive(14, 11, 7),
    redLight: emissive(6, 0.2, 0.1),
    greenLight: emissive(0.2, 6, 0.6),
    shipLight: emissive(6, 5, 3),
    gold: S({ color: 0xe0b040, metalness: 1, roughness: 0.25, envMap: env, envMapIntensity: 1.4 }),
    silver: S({ color: 0xd8d8dc, metalness: 1, roughness: 0.2, envMap: env, envMapIntensity: 1.4 }),
    pearl: S({ color: 0xf2ece0, roughness: 0.15, envMap: env, envMapIntensity: 1.0 }),
    cork: S({ color: 0x9a7448, roughness: 0.9 }),
    ragRug: S({ map: T.ragrug, roughness: 1 }),
    ragRug2: S({ map: T.ragrug2, roughness: 1 }),
    gingham: S({ map: T.gingham, roughness: 0.95, side: THREE.DoubleSide }),
    tartan: S({ map: T.tartan, roughness: 0.95 }),
    ticking: S({ map: T.ticking, roughness: 0.95 }),
    terracotta: S({ color: 0xb5603a, roughness: 0.85 }),
    shadeGreen: S({ color: 0x1f5a3a, roughness: 0.5, side: THREE.DoubleSide, emissive: 0x0a2a18, emissiveIntensity: 0.6 }),
    lensSpare: S({ map: T.lens, color: 0xc8e0e0, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.55, side: THREE.DoubleSide, envMap: env, envMapIntensity: 1.0, depthWrite: false }),
    soil: S({ color: 0x2a1c12, roughness: 1 }),
    foliage: S({ color: 0x3f6b34, roughness: 0.8, side: THREE.DoubleSide }),
    flower: S({ color: 0xc42a2a, roughness: 0.7 }),
    apple: S({ color: 0xb8362a, roughness: 0.45 }),
    bread: S({ color: 0xb98a4a, roughness: 0.9 }),
    water: S({ color: 0x0c1418, roughness: 0.05, metalness: 0.2, envMap: env, envMapIntensity: 1.0, transparent: true, opacity: 0.85 }),
    puddle: S({ color: 0x0c0b09, roughness: 0.05, metalness: 0.1, envMap: env, envMapIntensity: 0.3, transparent: true, opacity: 0.6, depthWrite: false }),
    fur: S({ color: 0x8a5a2b, roughness: 1 }),
    furDark: S({ color: 0x2a2018, roughness: 1 }),
    rock: triplanar(S({ map: T.rock.map, roughness: 0.62, vertexColors: true, envMap: env, envMapIntensity: 0.25 }), 0.16, T.rock.normalMap),
  };
  // each room is limewashed a different colour: butter-cream kitchen, blush parlour, sage bedroom, deep green study...
  const TINTS = { store: 0xd9d4c4, kitchen: 0xffe2a8, parlour: 0xe9c3b4, bedroom: 0xcfdcc2, guest: 0xc3d0e0, study: 0x9fbfa6, library: 0xd9b68c, workshop: 0xd5d8d2, watch: 0xd2dadc };
  const tint = (c) => { const m = M.plaster.clone(); m.color = new THREE.Color(c); return m; };
  M.plasterFloor = FLOORS.map(f => tint(TINTS[f.id] ?? 0xe8e0d0));
  M.rock.defines.WET_PUDDLES = '';   // add to the existing defines: MeshStandardMaterial needs its STANDARD flag
  for (const k of ['rock', 'stoneWhite', 'stoneRed', 'granite', 'graniteDark', 'slate']) wetten(M[k]);
  M.jettyWood = wetten(M.woodDark.clone());
  // the triplanar rock uses its own sampler coordinates
  M.rock.map.wrapS = M.rock.map.wrapT = THREE.RepeatWrapping;
  return M;
}
