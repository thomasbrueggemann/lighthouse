import * as THREE from 'three';

// A small pool of shadow-casting point lights that follows the player around the tower.
//
// Every lamp in the game keeps its own cheap, unshadowed light (the glow that fills the room). The two slots here
// are extra lights that are lent to the lamps nearest the camera: a lamp holding a slot hands most of its output
// to the slot, so the rooms you are standing in get real shadows (chair legs on the wall, lens bars sweeping the
// lantern room) while every lamp elsewhere stays cheap. Slots cross-fade when they change hands, and their shadow
// maps are refreshed a few times a second rather than every frame.
const SLOTS = 2;
const SHADOW_SHARE = 0.72;   // fraction of a lamp's output carried by its shadowed twin
const FADE = 3.0;            // per second
const REFRESH = 0.4;         // seconds between shadow-map refreshes

export class LightRig {
  constructor(ctx) {
    this.ctx = ctx;
    this.enabled = !!ctx.quality.shadows;
    this.slots = [];
    this.extra = [];            // lamps whose intensity is managed elsewhere (the lens lamp)
    this.pos = new THREE.Vector3();
    if (!this.enabled) return;
    for (let i = 0; i < SLOTS; i++) {
      const L = new THREE.PointLight(0xffa458, 0, 11, 2);
      L.castShadow = true;
      L.shadow.mapSize.set(512, 512);
      L.shadow.bias = -0.0025; L.shadow.normalBias = 0.035; L.shadow.radius = 2.4;
      L.shadow.camera.near = 0.12;
      L.shadow.autoUpdate = false; L.shadow.needsUpdate = true; // allocate the map up front
      ctx.scene.add(L);
      this.slots.push({ light: L, lamp: null, k: 0, age: i * REFRESH / SLOTS });
    }
  }

  addExtra(light) { this.extra.push({ light, base: 0, rig: true }); }

  // call once per frame, after every lamp has had its intensity for this frame set
  update(dt) {
    if (!this.enabled) return;
    const cam = this.ctx.camera.position;
    if (!this.all || this.all.length !== this.ctx.lights.length + this.extra.length) this.all = this.ctx.lights.concat(this.extra);
    const lamps = this.all;

    // who deserves a shadow right now: bright and close
    for (const l of lamps) {
      l.light.getWorldPosition(this.pos);
      const d2 = cam.distanceToSquared(this.pos);
      const reach = (l.light.distance || 10) + 3;
      l.full = l.light.intensity;
      l.score = d2 > reach * reach ? 0 : l.full / (d2 + 3);
      if (this.slots.some(s => s.lamp === l && !s.leaving)) l.score *= 1.35; // hysteresis: don't swap on a whim
    }
    const want = lamps.filter(l => l.score > 1e-3).sort((a, b) => b.score - a.score).slice(0, SLOTS);

    for (const s of this.slots) s.leaving = !!s.lamp && !want.includes(s.lamp);
    for (const l of want) {
      if (this.slots.some(s => s.lamp === l)) continue;
      const free = this.slots.find(s => !s.lamp);
      if (!free) continue;       // all busy: a leaving slot frees itself within a third of a second
      free.lamp = l; free.k = 0; free.leaving = false;
      l.light.getWorldPosition(free.light.position);
      free.light.color.copy(l.light.color);
      free.light.distance = l.light.distance; free.light.decay = l.light.decay;
      free.light.shadow.needsUpdate = true; free.age = 0;
    }

    for (const s of this.slots) {
      const L = s.light;
      if (!s.lamp) { L.intensity = 0; continue; }
      s.k = THREE.MathUtils.clamp(s.k + (s.leaving ? -1 : 1) * FADE * dt, 0, 1);
      const share = SHADOW_SHARE * s.k;
      L.intensity = s.lamp.full * share;
      s.lamp.light.intensity = s.lamp.full * (1 - share);
      s.age += dt;
      if (s.age > REFRESH && s.k > 0) { s.age = 0; L.shadow.needsUpdate = true; }
      if (s.leaving && s.k <= 0) { s.lamp = null; L.intensity = 0; }
    }
  }
}
