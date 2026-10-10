import * as THREE from 'three';
import { GLSL_SKY, skyU, updateSky } from './sky.js';
import { waveHeight } from './ocean.js';
import { shorePoints } from './island.js';
import { TAU, SHED, R_OUT_BASE, R_OUT_TOP, TOWER_BASE, TOWER_TOP, LANTERN_Y, clamp } from './config.js';

export class Weather {
  constructor(ctx) {
    this.ctx = ctx;
    this.flash = 0; this.gust = 0.5; this.calm = 0;
    this.nextStrike = 5 + Math.random() * 5;
    this.seq = null; this.seqT = 0;
    this.flashDir = new THREE.Vector3(1, 0.5, 0).normalize();
    this.buildSky();
    this.buildRain();
    this.buildSpray();
    this.buildLightning();
    this.shore = shorePoints().map(p => ({ ...p, prev: 0, cool: Math.random() * 3 }));
    this.shoreIdx = 0;
  }

  buildSky() {
    this.skyU = Object.assign({ uFog: { value: new THREE.Color() } }, skyU);
    this.moonVis = 0.5;
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: this.skyU,
      vertexShader: 'varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position = p.xyww; }',
      fragmentShader: `${GLSL_SKY}
        uniform vec3 uFog; varying vec3 vD;
        void main(){
          vec3 d = normalize(vD);
          vec3 col = stormSky(d, 1.0);
          col = mix(col, uFog, smoothstep(0.14, -0.04, d.y));
          gl_FragColor = vec4(col, 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), mat);
    this.sky.frustumCulled = false; this.sky.renderOrder = -10;
    this.ctx.scene.add(this.sky);
  }

  buildRain() {
    // each drop is a camera-facing quad stretched along its fall: soft edges, a bright head and a tapering tail
    const N = 9000;
    const pos = new Float32Array(N * 4 * 3), end = new Float32Array(N * 4), side = new Float32Array(N * 4), idx = new Uint16Array(N * 6);
    for (let i = 0; i < N; i++) {
      const x = Math.random(), y = Math.random(), z = Math.random();
      for (let k = 0; k < 4; k++) { const j = i * 4 + k; pos[j * 3] = x; pos[j * 3 + 1] = y; pos[j * 3 + 2] = z; end[j] = k >> 1; side[j] = (k & 1) ? 1 : -1; }
      const v = i * 4; idx.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    g.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.rainU = {
      uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(44, 26, 44) }, uWind: { value: new THREE.Vector2(9, 3) },
      uIsland: { value: this.ctx.island.tex }, uIslandRect: { value: this.ctx.island.rect }, uFlash: { value: 0 }, uAmount: { value: 1 }, uBeam: { value: 0 },
      uShed: { value: new THREE.Vector4(SHED.x, SHED.z, SHED.w / 2 + 0.4, SHED.d / 2 + 0.4) },
    };
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: this.rainU, side: THREE.DoubleSide,
      vertexShader: `
        attribute float aEnd; attribute float aSide; uniform float uTime, uAmount; uniform vec3 uCam, uBox, uIslandRect; uniform vec2 uWind; uniform sampler2D uIsland; uniform vec4 uShed;
        varying float vA; varying float vNear; varying float vAlong; varying float vS;
        void main(){
          float sp = 0.85 + 0.3 * fract(position.x * 91.7 + position.z * 13.3);
          vec3 vel = vec3(uWind.x, -17.0, uWind.y) * sp;
          vec3 p = position * uBox + vel * uTime;
          p = mod(p - uCam + uBox * 0.5, uBox) + uCam - uBox * 0.5;
          vec3 dir = normalize(vel);
          float len = 0.3 + 0.32 * sp;
          vec3 tail = p - dir * len;
          float r = length(p.xz);
          float hide = 0.0;
          float rOut = mix(${R_OUT_BASE.toFixed(2)}, ${R_OUT_TOP.toFixed(2)}, clamp((p.y - ${TOWER_BASE.toFixed(1)}) / ${(TOWER_TOP - TOWER_BASE).toFixed(1)}, 0., 1.));
          if (p.y < ${TOWER_TOP.toFixed(1)} && r < rOut + 0.1) hide = 1.0;
          if (p.y < ${(LANTERN_Y + 5.8).toFixed(1)} && r < 3.5) hide = 1.0;
          if (abs(p.x - uShed.x) < uShed.z && abs(p.z - uShed.y) < uShed.w && p.y < 11.3) hide = 1.0;
          vec2 iuv = (p.xz - uIslandRect.xy) / uIslandRect.z;
          if (iuv.x > 0. && iuv.y > 0. && iuv.x < 1. && iuv.y < 1. && p.y < texture2D(uIsland, iuv).r + 0.05) hide = 1.0;
          if (fract(position.y * 37.1) > uAmount) hide = 1.0;
          float d = length(p - uCam);
          vNear = exp(-d * 0.22);
          vA = (1.0 - hide) * (1.0 - smoothstep(12., 22., d));
          // widen the quad perpendicular to the streak, in view space, so it always faces the camera and never thins below a pixel
          vec4 mvh = viewMatrix * vec4(p, 1.0), mvt = viewMatrix * vec4(tail, 1.0);
          vec3 axis = normalize(mvt.xyz - mvh.xyz);
          vec3 sideV = normalize(cross(axis, normalize(mvh.xyz)));
          float w = max(0.010, d * 0.0011);
          vec4 mv = mix(mvh, mvt, aEnd);
          mv.xyz += sideV * aSide * w * 0.5;
          vAlong = aEnd; vS = aSide;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform float uFlash, uBeam; varying float vA; varying float vNear; varying float vAlong; varying float vS;
        void main(){ if (vA < 0.01) discard;
          float soft = 1.0 - vS * vS, taper = 1.0 - vAlong;
          vec3 c = vec3(0.55,0.6,0.66) * (0.12 + uFlash * 3.0 + uBeam * 0.18) + vec3(1.0,0.75,0.45) * vNear * 0.26;
          gl_FragColor = vec4(c, vA * (0.13 + vNear * 0.17) * soft * taper); }`,
    });
    this.rain = new THREE.Mesh(g, mat);
    this.rain.frustumCulled = false; this.rain.renderOrder = 8;
    this.ctx.scene.add(this.rain);
  }

  buildSpray() {
    const N = 2600;
    this.sp = { N, pos: new Float32Array(N * 3), vel: new Float32Array(N * 3), life: new Float32Array(N), max: new Float32Array(N), size: new Float32Array(N), next: 0 };
    const g = new THREE.BufferGeometry();
    this.spPos = new THREE.BufferAttribute(this.sp.pos, 3); this.spPos.setUsage(THREE.DynamicDrawUsage);
    this.spLife = new THREE.BufferAttribute(new Float32Array(N), 1); this.spLife.setUsage(THREE.DynamicDrawUsage);
    this.spSize = new THREE.BufferAttribute(this.sp.size, 1);
    g.setAttribute('position', this.spPos); g.setAttribute('aLife', this.spLife); g.setAttribute('aSize', this.spSize);
    this.sprayU = { uTex: { value: this.ctx.T.glow }, uFlash: { value: 0 }, uScale: { value: 600 }, uBeam: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: this.sprayU, fog: false,
      vertexShader: `attribute float aLife; attribute float aSize; uniform float uScale; varying float vL; varying float vD;
        void main(){ vL = aLife; vec4 mv = modelViewMatrix * vec4(position, 1.); vD = -mv.z;
          gl_PointSize = aLife <= 0.0 ? 0.0 : aSize * (1.0 + (1.0 - aLife) * 2.5) * uScale / max(-mv.z, 0.5);
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D uTex; uniform float uFlash, uBeam; varying float vL; varying float vD;
        void main(){ vec4 t = texture2D(uTex, gl_PointCoord); float a = t.a * vL * 0.7 * exp(-vD * 0.005);
          vec3 c = vec3(0.72,0.78,0.8) * (0.26 + uFlash * 3.0 + uBeam * 0.1);
          gl_FragColor = vec4(c, a); }`,
    });
    this.spray = new THREE.Points(g, mat);
    this.spray.frustumCulled = false; this.spray.renderOrder = 7;
    this.ctx.scene.add(this.spray);
  }

  burst(x, y, z, n, power, nx, nz) {
    const s = this.sp;
    for (let i = 0; i < n; i++) {
      const k = s.next; s.next = (s.next + 1) % s.N;
      s.pos[k * 3] = x + (Math.random() - 0.5) * 2.5; s.pos[k * 3 + 1] = y + Math.random() * 0.5; s.pos[k * 3 + 2] = z + (Math.random() - 0.5) * 2.5;
      const up = power * (0.5 + Math.random() * 0.8);
      s.vel[k * 3] = -nx * power * 0.3 + (Math.random() - 0.5) * 3 + 2;
      s.vel[k * 3 + 1] = up;
      s.vel[k * 3 + 2] = -nz * power * 0.3 + (Math.random() - 0.5) * 3 + 0.8;
      s.max[k] = 1.6 + Math.random() * 1.8; s.life[k] = s.max[k];
      s.size[k] = 1.2 + Math.random() * 2.0;
    }
  }

  buildLightning() {
    const L = new THREE.DirectionalLight(0xbfd0ff, 0);
    L.castShadow = true;
    L.shadow.mapSize.set(2048, 2048);
    const c = L.shadow.camera; c.left = -45; c.right = 45; c.top = 45; c.bottom = -45; c.near = 1; c.far = 260;
    L.shadow.bias = -0.0008; L.shadow.normalBias = 0.04;
    L.shadow.autoUpdate = false; // re-rendered once per strike
    L.target.position.set(0, 12, 0);
    this.ctx.scene.add(L, L.target);
    this.light = L;
    this.boltMat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(8, 8.5, 12), transparent: true, opacity: 1, fog: false });
    this.bolt = null;
  }

  makeBolt(az, dist) {
    if (this.bolt) { this.ctx.scene.remove(this.bolt); this.bolt.geometry.dispose(); }
    const pts = [];
    let p = new THREE.Vector3(Math.cos(az) * dist, 180, Math.sin(az) * dist);
    const end = new THREE.Vector3(Math.cos(az) * dist + (Math.random() - 0.5) * 60, 0, Math.sin(az) * dist + (Math.random() - 0.5) * 60);
    const n = 22;
    for (let i = 0; i <= n; i++) {
      const t = i / n; const q = p.clone().lerp(end, t);
      if (i > 0 && i < n) { q.x += (Math.random() - 0.5) * 22; q.z += (Math.random() - 0.5) * 22; q.y += (Math.random() - 0.5) * 6; }
      pts.push(q);
    }
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1), 80, 0.9, 4);
    this.bolt = new THREE.Mesh(geo, this.boltMat);
    this.bolt.frustumCulled = false;
    this.ctx.scene.add(this.bolt);
  }

  strike() {
    const az = Math.random() * TAU, dist = 220 + Math.random() * 420;
    this.flashDir.set(Math.cos(az), 0.35 + Math.random() * 0.35, Math.sin(az)).normalize();
    this.light.position.copy(this.flashDir).multiplyScalar(120).add(this.light.target.position);
    this.light.shadow.needsUpdate = true;
    const big = Math.random() < 0.55;
    if (big) this.makeBolt(az, dist); else if (this.bolt) this.bolt.visible = false;
    const k = big ? 1 : 0.45;
    this.seq = [[0, 1 * k], [0.06, 0.15 * k], [0.11, 0.9 * k], [0.19, 0.05], [0.3, 0.55 * k], [0.45, 0.08], [0.7, 0]];
    if (Math.random() < 0.4) this.seq.splice(5, 0, [0.52, 0.35 * k]);
    this.seqT = 0;
    this.ctx.audio?.thunder(0.25 + dist / 343 * 0.5, big ? 1 - dist / 900 : 0.45);
  }

  update(dt, t, camera, indoor) {
    const c = this.calm;
    this.gust = clamp(0.55 + 0.25 * Math.sin(t * 0.21) * Math.sin(t * 0.53 + 1.3) + 0.2 * Math.sin(t * 1.7) * Math.sin(t * 0.31), 0, 1) * (1 - c * 0.7);
    // lightning
    this.nextStrike -= dt;
    if (this.nextStrike <= 0) { this.strike(); this.nextStrike = (7 + Math.random() * 16) * (1 + c * 4); }
    let f = 0;
    if (this.seq) {
      this.seqT += dt;
      const s = this.seq;
      for (let i = 0; i < s.length - 1; i++) if (this.seqT >= s[i][0] && this.seqT < s[i + 1][0]) {
        const u = (this.seqT - s[i][0]) / (s[i + 1][0] - s[i][0]);
        f = s[i][1] + (s[i + 1][1] - s[i][1]) * (s[i + 1][1] > s[i][1] ? u * u : Math.sqrt(u));
      }
      if (this.seqT > s[s.length - 1][0]) { this.seq = null; if (this.bolt) this.bolt.visible = false; }
      else if (this.bolt) { this.bolt.visible = f > 0.3; this.boltMat.opacity = f; }
    }
    this.flash = f;
    // without shadow maps the flash would light the rooms straight through the walls
    this.light.intensity = f * 5.5 * (this.ctx.quality.shadows ? 1 : 0.06 + 0.94 * (this.ctx.outK ?? 1));
    const r = this.ctx.renderer;

    // the cloud deck parts around the moon now and then; the moonlight itself follows `moonVis`
    const swell = 0.5 + 0.5 * Math.sin(t * 0.06 + 0.5);
    this.moonVis = clamp(swell * swell * (0.85 + 0.15 * Math.sin(t * 0.23)) + c, 0, 1);
    updateSky(t, f, this.flashDir, c, this.moonVis);
    this.sky.position.copy(camera.position);
    const fog = this.ctx.scene.fog;
    fog.color.copy(this.ctx.fogBase).lerp(this.ctx.fogFlash, f * 0.6);
    fog.color.lerp(this.ctx.fogDawn, c);
    this.skyU.uFog.value.copy(fog.color);

    this.rainU.uTime.value = t;
    this.rainU.uCam.value.copy(camera.position);
    this.rainU.uFlash.value = f;
    this.rainU.uWind.value.set(7 + this.gust * 8, 2 + this.gust * 3);
    this.rainU.uAmount.value = 1 - c * 0.85;

    // shore spray
    const pts = this.shore;
    for (let n = 0; n < 60; n++) {
      const p = pts[this.shoreIdx]; this.shoreIdx = (this.shoreIdx + 1) % pts.length;
      const h = waveHeight(p.x, p.z, t);
      if (p.prev < 0.45 && h >= 0.45 && t > p.cool) {
        const power = (5 + h * 4) * (0.5 + p.exposure) * (1 - c * 0.6);
        const count = Math.floor((10 + 30 * p.exposure) * (0.6 + h * 0.4) * (1 - c * 0.7));
        this.burst(p.x, h, p.z, count, power, p.nx, p.nz);
        p.cool = t + 2.0 + Math.random() * 2;
        this.ctx.audio?.crash(p.x, h, p.z, clamp(p.exposure * (0.4 + h * 0.4), 0.15, 1));
      }
      p.prev = h;
    }
    const s = this.sp, life = this.spLife.array, wx = 3 + this.gust * 4;
    for (let k = 0; k < s.N; k++) {
      if (s.life[k] <= 0) { life[k] = 0; continue; }
      s.life[k] -= dt;
      const j = k * 3;
      s.vel[j] += (wx - s.vel[j]) * 0.8 * dt; s.vel[j + 2] += (1.5 - s.vel[j + 2]) * 0.8 * dt;
      s.vel[j + 1] -= 9.0 * dt; s.vel[j + 1] *= 1 - 0.6 * dt;
      s.pos[j] += s.vel[j] * dt; s.pos[j + 1] += s.vel[j + 1] * dt; s.pos[j + 2] += s.vel[j + 2] * dt;
      life[k] = Math.max(0, s.life[k] / s.max[k]);
    }
    this.spPos.needsUpdate = true; this.spLife.needsUpdate = true; this.spSize.needsUpdate = true;
    this.sprayU.uFlash.value = f;
    this.sprayU.uScale.value = r.domElement.height * 0.5;
  }
}
