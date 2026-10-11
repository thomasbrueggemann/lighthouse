import * as THREE from 'three';
import { R_IN, CELLAR_Y, LANTERN_Y, R_GLASS, SHED, FLOORS, CAVE, floorIndexAt, clamp } from './config.js';
import { terrainHeight } from './island.js';
import { cylGeo, Builder } from './geom.js';

const RADIUS = 0.25, HEIGHT = 1.72, EYE = 1.62, STEP = 0.5;
// ducking: a slimmer, lower body that fits between furniture and the stair rail
const DUCK_RADIUS = 0.16, DUCK_HEIGHT = 1.05, DUCK_EYE = 1.0;

export class Player {
  constructor(ctx, camera) {
    this.ctx = ctx; this.camera = camera;
    this.pos = new THREE.Vector3(1.0, FLOORS[1].y, 1.4);
    this.vel = new THREE.Vector3();
    this.yaw = -2.3; this.pitch = -0.05;
    this.keys = {};
    this.onGround = true; this.surface = 'wood';
    this.camY = this.pos.y + EYE;
    this.bob = 0; this.stepAcc = 0;
    this.indoor = true; this.underground = false;
    this.knockV = new THREE.Vector2();
    this.enabled = false;
    this.duck = 0; // 0 standing .. 1 fully crouched
    addEventListener('keydown', (e) => { this.keys[e.code] = true; if (e.code === 'KeyF' && this.enabled) this.toggleLantern(); });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    addEventListener('mousemove', (e) => {
      if (!document.pointerLockElement || !this.enabled) return;
      const s = 0.0022 * (ctx.settings?.sens ?? 1);
      this.yaw -= e.movementX * s; this.pitch -= e.movementY * s;
      this.pitch = clamp(this.pitch, -1.5, 1.5);
    });
    addEventListener('blur', () => { this.keys = {}; });
    this.buildLantern();
  }

  buildLantern() {
    const M = this.ctx.M;
    const g = new THREE.Group();
    const B = new Builder();
    B.cyl(0.07, 0.075, 0.025, M.ironBlack, 0, -0.11, 0, 12);
    B.cyl(0.055, 0.07, 0.04, M.brass, 0, -0.08, 0, 12);
    B.cyl(0.075, 0.06, 0.03, M.ironBlack, 0, 0.1, 0, 12);
    B.cyl(0.03, 0.04, 0.03, M.ironBlack, 0, 0.13, 0, 8);
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; B.cyl(0.005, 0.005, 0.2, M.ironBlack, Math.cos(a) * 0.072, 0.0, Math.sin(a) * 0.072, 4); }
    B.add(new THREE.TorusGeometry(0.06, 0.005, 4, 16, Math.PI), M.ironBlack, 0, 0.15, 0);
    B.build(g, { shadows: false });
    const glass = new THREE.Mesh(cylGeo(0.05, 0.06, 0.17, 12), M.lampGlass); g.add(glass);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), M.flame); flame.scale.y = 1.8; flame.position.y = -0.02; g.add(flame);
    g.position.set(0.26, -0.36, -0.62); g.scale.setScalar(0.85);
    g.traverse(o => { o.castShadow = false; o.renderOrder = 2; });
    this.camera.add(g);
    // the lantern in your hand: a wide spot that follows your view and throws real shadows (one shadow pass rather than a
    // cube's six), plus a small unshadowed fill so the space around you still glows
    const L = new THREE.SpotLight(0xffb060, 4.8, 16, 1.0, 0.9, 1.7);
    L.position.set(0.24, -0.15, -0.45);
    L.target.position.set(0.0, -0.3, -6);
    this.camera.add(L.target);
    if (this.ctx.quality.shadows) {
      L.castShadow = true;
      L.shadow.mapSize.set(1024, 1024);
      L.shadow.bias = -0.0004; L.shadow.normalBias = 0.025; L.shadow.radius = 2.4;
      L.shadow.camera.near = 0.08;
    }
    this.camera.add(L);
    const fill = new THREE.PointLight(0xffb060, 1.1, 9, 2);
    fill.position.copy(L.position);
    this.camera.add(fill);
    this.lantern = { g, light: L, fill, flame, on: true, t: 1 };
  }
  toggleLantern() {
    this.lantern.on = !this.lantern.on;
    this.ctx.audio.click();
  }

  // which room the player is in (drives indoor ambience, the lamp pool, audio)
  updateZone() {
    const p = this.pos;
    const r = Math.hypot(p.x, p.z);
    this.underground = p.y + 1.0 < terrainHeight(p.x, p.z) - 0.3 && r > R_IN + 0.2 || (p.y < 6.9 && r < R_IN + 0.3);
    const inTower = r < R_IN + 0.15 && p.y > CELLAR_Y - 0.5 && p.y < LANTERN_Y - 0.1;
    const inLantern = r < R_GLASS && p.y >= LANTERN_Y - 0.1 && p.y < LANTERN_Y + 3;
    const inShed = Math.abs(p.x - SHED.x) < SHED.w / 2 - 0.2 && Math.abs(p.z - SHED.z) < SHED.d / 2 - 0.2 && p.y < 9;
    this.indoor = inTower || inLantern || inShed || this.underground;
    this.zone = this.underground ? (p.z < -6 ? 'cave' : 'cellar') : inTower ? FLOORS[floorIndexAt(p.y)].id : inLantern ? 'lantern' : inShed ? 'shed' : p.y > LANTERN_Y - 0.5 ? 'gallery' : 'outside';
  }

  // would standing up put your head into something (a low beam, a shelf, a stair above)?
  blockedAbove() {
    const p = this.pos, probe = this._probe || (this._probe = new THREE.Vector3());
    probe.copy(p);
    this.ctx.col.resolve(probe, RADIUS, HEIGHT);
    return Math.hypot(probe.x - p.x, probe.z - p.z) > 0.04;
  }

  teleport(p, yaw) { this.pos.copy(p); this.vel.set(0, 0, 0); if (yaw !== undefined) this.yaw = yaw; this.camY = p.y + EYE; }
  knock(vx, vz) { this.knockV.set(vx, vz); }

  update(dt) {
    const k = this.keys, ctx = this.ctx, col = ctx.col;
    if (ctx.freeze) { // debug fly-cam: no physics
      this.camera.position.set(this.pos.x, this.pos.y + EYE, this.pos.z);
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      this.updateZone();
      return;
    }
    let fx = 0, fz = 0;
    if (this.enabled) {
      if (k.KeyW || k.ArrowUp) fz += 1;
      if (k.KeyS || k.ArrowDown) fz -= 1;
      if (k.KeyA || k.ArrowLeft) fx -= 1;
      if (k.KeyD || k.ArrowRight) fx += 1;
    }
    const len = Math.hypot(fx, fz) || 1;
    fx /= len; fz /= len;
    const heavy = ctx.game.has('oilcan');
    // crouch (hold C or Ctrl); you stay low while something is overhead
    const want = this.enabled && (k.KeyC || k.ControlLeft || k.ControlRight);
    if (!want && this.duck > 0 && this.blockedAbove()) this.duckHeld = true; else this.duckHeld = false;
    const duckTo = want || this.duckHeld ? 1 : 0;
    this.duck += (duckTo - this.duck) * Math.min(1, dt * 12);
    if (Math.abs(duckTo - this.duck) < 0.01) this.duck = duckTo;
    const radius = RADIUS + (DUCK_RADIUS - RADIUS) * this.duck, height = HEIGHT + (DUCK_HEIGHT - HEIGHT) * this.duck;
    const eye = EYE + (DUCK_EYE - EYE) * this.duck;
    this.eye = eye;
    const run = (k.ShiftLeft || k.ShiftRight) && !heavy && this.duck < 0.3;
    const speed = (run ? 4.6 : 2.6) * (heavy ? 0.8 : 1) * (1 - this.duck * 0.5);
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const wx = (-sy * fz + cy * fx) * speed, wz = (-cy * fz - sy * fx) * speed;
    const acc = this.onGround ? 10 : 2;
    this.vel.x += (wx - this.vel.x) * Math.min(1, acc * dt);
    this.vel.z += (wz - this.vel.z) * Math.min(1, acc * dt);
    if (this.knockV.lengthSq() > 0.01) { this.vel.x += this.knockV.x; this.vel.z += this.knockV.y; this.knockV.set(0, 0); }
    if (this.enabled && k.Space && this.onGround && this.duck < 0.3) { this.vel.y = 4.2; this.onGround = false; }
    this.vel.y -= 18 * dt;

    const dist = Math.hypot(this.vel.x, this.vel.z) * dt;
    const n = Math.max(1, Math.ceil(dist / 0.08));
    const sdt = dt / n;
    const p = this.pos;
    let wasGround = this.onGround;
    for (let i = 0; i < n; i++) {
      const ox = p.x, oz = p.z, oy = p.y;
      p.x += this.vel.x * sdt; p.z += this.vel.z * sdt;
      col.resolve(p, radius, height);
      let g = col.ground(p.x, p.z, p.y + STEP);
      // steep rock: don't climb cliffs
      if (g.terrain && g.y > oy + 0.02) {
        const run = Math.hypot(p.x - ox, p.z - oz) || 1e-4;
        if ((g.y - oy) / run > 1.25) { p.x = ox; p.z = oz; g = col.ground(p.x, p.z, p.y + STEP); }
      }
      p.y += this.vel.y * sdt;
      if (g.y > -Infinity) {
        if (p.y <= g.y + 0.001 || (wasGround && this.vel.y <= 0 && p.y - g.y < 0.42)) {
          p.y = g.y; this.vel.y = Math.max(0, this.vel.y); this.onGround = true; wasGround = true; this.surface = g.surface;
        } else this.onGround = false;
      } else this.onGround = false;
      if (p.y < -12) { p.set(0, 7.2, 3); this.vel.set(0, 0, 0); }
    }
    this.updateZone();

    // camera
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && hs > 0.3) {
      this.bob += hs * dt * 2.4;
      this.stepAcc += hs * dt;
      const stride = run ? 0.85 : 0.68;
      if (this.stepAcc > stride) { this.stepAcc = 0; ctx.audio.footstep(this.surface, run, this.indoor); }
    }
    const targetY = p.y + eye;
    this.camY += (targetY - this.camY) * Math.min(1, dt * (targetY > this.camY ? 14 : 20));
    if (Math.abs(targetY - this.camY) > 1.2) this.camY = targetY;
    const bobA = this.onGround ? Math.min(1, hs / 3) : 0;
    this.camera.position.set(p.x + Math.cos(this.bob) * 0.025 * bobA * Math.cos(this.yaw), this.camY + Math.abs(Math.sin(this.bob)) * 0.045 * bobA, p.z - Math.cos(this.bob) * 0.025 * bobA * Math.sin(this.yaw));
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    // hand lantern sway & flicker
    const L = this.lantern;
    L.t += ((L.on ? 1 : 0) - L.t) * Math.min(1, dt * 8);
    L.g.position.set(0.26 + Math.sin(this.bob * 0.5) * 0.012 * bobA, -0.36 - (1 - L.t) * 0.4 + Math.abs(Math.cos(this.bob)) * 0.01 * bobA, -0.62);
    L.g.rotation.z = Math.sin(this.bob * 0.5) * 0.06 * bobA;
    const fl = 0.85 + Math.sin(ctx.time * 23) * 0.05 + Math.sin(ctx.time * 37.3) * 0.05 + (Math.random() - 0.5) * 0.06;
    L.light.intensity = 4.8 * L.t * fl; L.fill.intensity = 1.1 * L.t * fl;
    L.light.shadow.autoUpdate = L.t > 0.05; // a lowered lantern costs nothing
    L.flame.visible = L.t > 0.5;
  }
}
