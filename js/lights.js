import * as THREE from 'three';
import { R_IN, FLOORS, LANTERN_Y, SHED, N_FLOORS, floorIndexAt } from './config.js';

// Lamps are *virtual*: a registry of positions with a colour, an output and a flicker, as many as the rooms want.
// A fixed pool of real point lights is lent each frame to the lamps that matter most to whoever is looking, and
// they cross-fade as you walk around. Per-pixel lighting cost therefore stays constant however many lamps a room
// has, which is what lets every room carry several light sources.
//
//   * the best two lamps get shadow-casting lights (chair legs on the wall, lens bars sweeping the lantern room)
//   * the next few get plain lights
//   * lamps in other rooms count for very little, so light does not leak through floors and walls
const SHADOW_SLOTS = 2;
const PLAIN_SLOTS = 6;
const FADE = 3.0;          // per second
const REFRESH = 0.4;       // seconds between shadow-map refreshes

const ROOM_IDX = { cave: -2, cellar: -1, lantern: N_FLOORS, ...Object.fromEntries(FLOORS.map((f, i) => [f.id, i])) };

// which room a point belongs to (matches the zone names Player reports)
export function roomAt(x, y, z) {
  const r = Math.hypot(x, z);
  if (Math.abs(x - SHED.x) < SHED.w / 2 && Math.abs(z - SHED.z) < SHED.d / 2 && y < 11) return 'shed';
  if (r < R_IN + 0.15) {
    if (y < FLOORS[0].y - 0.5) return 'cellar';
    if (y > LANTERN_Y - 0.1) return 'lantern';
    return FLOORS[floorIndexAt(y)].id;
  }
  if (y < 6.5 && z < -6) return 'cave';
  return 'out';
}

// register a virtual lamp. `on` (optional) gates it; `manual` lamps have their output `I` set by whoever owns them.
export function addLamp(ctx, x, y, z, o = {}) {
  const lamp = {
    pos: new THREE.Vector3(x, y, z), color: new THREE.Color(o.color ?? 0xffb468), base: o.base ?? 4, dist: o.dist ?? 9, decay: o.decay ?? 2,
    flicker: o.flicker ?? 0.1, flame: o.flame ?? null, on: o.on ?? null, manual: !!o.manual, I: 0, score: 0, w: 0,
    room: o.room ?? roomAt(x, y, z),
  };
  ctx.lights.push(lamp);
  return lamp;
}

// how much a lamp in `lampRoom` matters to a viewer in `camZone`
function roomWeight(camZone, lampRoom) {
  const outside = camZone === 'outside' || camZone === 'gallery';
  if (outside) return lampRoom === 'out' || lampRoom === 'shed' ? 1 : lampRoom === 'lantern' ? (camZone === 'gallery' ? 1 : 0.3) : 0.04;
  if (camZone === 'shed') return lampRoom === 'shed' ? 1 : lampRoom === 'out' ? 0.3 : 0.02;
  if (lampRoom === 'out') return camZone === 'store' ? 0.4 : 0.02;
  if (lampRoom === 'shed') return 0.02;
  const a = ROOM_IDX[camZone], b = ROOM_IDX[lampRoom];
  if (a === undefined || b === undefined) return 0.05;
  const d = Math.abs(a - b);
  return d === 0 ? 1 : d === 1 ? 0.12 : 0.02;
}

export class LightRig {
  constructor(ctx) {
    this.ctx = ctx;
    this.slots = [];
    const shadows = !!ctx.quality.shadows;
    const make = (shadow) => {
      const L = new THREE.PointLight(0xffa458, 0, 10, 2);
      if (shadow) {
        L.castShadow = true;
        L.shadow.mapSize.set(512, 512);
        L.shadow.bias = -0.0025; L.shadow.normalBias = 0.035; L.shadow.radius = 2.4;
        L.shadow.camera.near = 0.12;
        L.shadow.autoUpdate = false; L.shadow.needsUpdate = true; // allocate the map up front
      }
      ctx.scene.add(L);
      return { light: L, shadow, lamp: null, k: 0, leaving: false, age: 0 };
    };
    for (let i = 0; i < SHADOW_SLOTS && shadows; i++) this.slots.push(make(true));
    for (let i = 0; i < PLAIN_SLOTS + (shadows ? 0 : SHADOW_SLOTS); i++) this.slots.push(make(false));
    this.nShadow = shadows ? SHADOW_SLOTS : 0;
    this.nPlain = this.slots.length - this.nShadow;
  }

  // call once per frame, after every lamp's output `I` has been set
  update(dt) {
    const { ctx } = this, cam = ctx.camera.position, zone = ctx.player?.zone ?? 'outside';
    const lamps = ctx.lights, slots = this.slots;

    // who matters right now: bright, close, and in the viewer's room. The room weight also scales the lamp's output
    // (smoothed, so crossing a floor on the stairs does not pop): a lamp upstairs is a faint glow through the boards
    for (const l of lamps) {
      l.w += (roomWeight(zone, l.room) - l.w) * Math.min(1, dt * 4);
      const d2 = cam.distanceToSquared(l.pos);
      const reach = l.dist + 4;
      l.score = d2 > reach * reach || l.I <= 0.001 || l.w < 0.04 ? 0 : (l.I / (d2 + 3)) * l.w;
      if (slots.some(s => s.lamp === l && !s.leaving)) l.score *= 1.3; // hysteresis: no swapping on a whim
    }
    const ranked = lamps.filter(l => l.score > 1e-4).sort((a, b) => b.score - a.score);
    const wantShadow = ranked.filter(l => l.w > 0.5).slice(0, this.nShadow);   // shadows only for lamps in the viewer's own room
    const wantPlain = ranked.filter(l => !wantShadow.includes(l)).slice(0, this.nPlain);

    for (const s of slots) s.leaving = !!s.lamp && !(s.shadow ? wantShadow : wantPlain).includes(s.lamp);
    for (const [want, isShadow] of [[wantShadow, true], [wantPlain, false]]) {
      for (const l of want) {
        if (slots.some(s => s.shadow === isShadow && s.lamp === l && !s.leaving)) continue;
        const free = slots.find(s => s.shadow === isShadow && !s.lamp);
        if (!free) continue;         // all busy: a leaving slot frees itself within a third of a second
        free.lamp = l; free.k = 0; free.leaving = false;
        free.light.position.copy(l.pos); free.light.color.copy(l.color);
        free.light.distance = l.dist; free.light.decay = l.decay;
        if (isShadow) { free.light.shadow.needsUpdate = true; free.age = 0; }
      }
    }

    for (const s of slots) {
      const L = s.light;
      if (!s.lamp) { L.intensity = 0; continue; }
      s.k = THREE.MathUtils.clamp(s.k + (s.leaving ? -1 : 1) * FADE * dt, 0, 1);
      L.intensity = s.lamp.I * s.lamp.w * s.k;
      if (s.shadow) {
        s.age += dt;
        if (s.age > REFRESH && s.k > 0) { s.age = 0; L.shadow.needsUpdate = true; }
      }
      if (s.leaving && s.k <= 0) { s.lamp = null; L.intensity = 0; }
    }
  }
}
