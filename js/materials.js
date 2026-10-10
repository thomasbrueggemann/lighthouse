import * as THREE from 'three';

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

export function createMaterials(T, renderer) {
  const env = makeEnv(renderer);
  const S = (o) => new THREE.MeshStandardMaterial(o);
  const t3 = (t, extra = {}) => S({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 1, ...extra });
  const emissive = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace) });

  const M = {
    env,
    plaster: t3(T.plaster, { normalScale: v2(0.7) }),
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
    glass: S({ color: 0x9fb4b8, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.16, envMap: env, envMapIntensity: 1.5, depthWrite: false, side: THREE.DoubleSide }),
    glassBottle: S({ color: 0x3d6b4a, roughness: 0.08, transparent: true, opacity: 0.55, envMap: env, envMapIntensity: 1.2, depthWrite: false }),
    lampGlass: S({ color: 0xfff2d8, roughness: 0.05, transparent: true, opacity: 0.25, emissive: 0xffa040, emissiveIntensity: 0.4, depthWrite: false }),
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
    water: S({ color: 0x0c1418, roughness: 0.05, metalness: 0.2, envMap: env, envMapIntensity: 1.0, transparent: true, opacity: 0.85 }),
    puddle: S({ color: 0x0c0b09, roughness: 0.05, metalness: 0.1, envMap: env, envMapIntensity: 0.3, transparent: true, opacity: 0.6, depthWrite: false }),
    fur: S({ color: 0x8a5a2b, roughness: 1 }),
    furDark: S({ color: 0x2a2018, roughness: 1 }),
    rock: triplanar(S({ map: T.rock.map, roughness: 0.62, vertexColors: true, envMap: env, envMapIntensity: 0.25 }), 0.16, T.rock.normalMap),
  };
  // the triplanar rock uses its own sampler coordinates
  M.rock.map.wrapS = M.rock.map.wrapT = THREE.RepeatWrapping;
  return M;
}
