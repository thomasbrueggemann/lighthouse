import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const PLATEAU_Y = 7;
export const FLOOR_H = 3.0;           // floor to floor: about 2.7 m clear, 2.5 m under the beams
export const R_IN = 4.0;
export const R_OUT_BASE = 5.6;
export const R_OUT_TOP = 4.5;
export const TOWER_BASE = 7;
export const CELLAR_Y = 3.2;
export const R_GLASS = 3.0;
export const R_GALLERY = 5.9;
export const WALL_SEGS = 96;

// the nine storeys, bottom to top
export const FLOORS = [
  ['store', 'The Store Room'], ['kitchen', 'The Kitchen'], ['parlour', 'The Parlour'], ['bedroom', "The Keeper's Bedroom"],
  ['guest', "The Assistant's Room"], ['study', 'The Study'], ['library', 'The Library'], ['workshop', 'The Lamp Workshop'], ['watch', 'The Watch Room'],
].map(([id, name], i) => ({ id, name, y: TOWER_BASE + i * FLOOR_H }));
export const N_FLOORS = FLOORS.length;
export const TOWER_TOP = TOWER_BASE + N_FLOORS * FLOOR_H;
export const LANTERN_Y = TOWER_TOP;
export const LENS_Y = LANTERN_Y + 1.85;
export const GLASS_TOP = LANTERN_Y + 3.8;
export const RED_FLOORS = [4, 5];     // the painted band on the outside of the tower

// index of the storey whose room a height belongs to (clamped)
export const floorIndexAt = (y) => Math.max(0, Math.min(N_FLOORS - 1, Math.floor((y - TOWER_BASE + 0.5) / FLOOR_H)));

// One continuous spiral: every flight winds 96 degrees round the wall and the next begins 40 degrees on (the landing).
// Angles in degrees on the plan (x = cos a, z = sin a). The last flight winds round the clockwork to the lantern.
export const STAIR_SPAN = 96, STAIR_GAP = 40, STAIR_STEPS = 16;
export const STAIRS = FLOORS.map((f, k) => {
  const start = (120 + k * (STAIR_SPAN + STAIR_GAP)) % 360;
  return k < N_FLOORS - 1
    ? { start, span: STAIR_SPAN, steps: STAIR_STEPS, r0: 2.95, r1: 3.98 }
    : { start, span: 112, steps: STAIR_STEPS, r0: 1.9, r1: 2.85 };
});

// Windows per floor: centre angle (deg), number of wall segments, sill & head height above the floor.
// They sit in free arcs of wall (never behind the low treads) and wind round the tower as it rises.
const win = (a, extra = {}) => ({ a: ((a % 360) + 360) % 360, n: 4, yb: 0.95, yt: 2.15, ...extra });
export const WINDOWS = FLOORS.map((f, k) => {
  const s = STAIRS[k].start;
  if (k === N_FLOORS - 1) return [0, 90, 180, 270].map(a => win(a + 45, { yb: 1.0, yt: 2.15 }));
  const list = [win(s + 128), win(s + 205)];
  if (k % 2 === 1) list.push(win(s - 78));          // some floors also get a window where the previous flight arrives
  if (f.id === 'bedroom') list[0].broken = true;     // the casement that has torn loose in the gale
  return list;
});

export const DOOR_ANGLE = 90; // deg, +z (south)
export const SECRET_NICHE = { floor: 5, a: 247.5, n: 4 };
export const LANTERN_DOOR_SIDE = 13; // of 16 sides
export const DIRTY_PANES = [0, 2, 4, 6, 9, 11];

export const SHED = { x: -10.8, z: 1.5, w: 5.0, d: 6.4, h: 2.7 }; // w along x, d along z
export const CAVE = { x: 0, y: 1.8, z: -13.6, r: 4.3, h: 3.3 };

export function rOutAt(y) {
  const t = Math.min(1, Math.max(0, (y - TOWER_BASE) / (TOWER_TOP - TOWER_BASE)));
  return R_OUT_BASE + (R_OUT_TOP - R_OUT_BASE) * t;
}

export const polar = (r, aRad, y = 0) => new THREE.Vector3(r * Math.cos(aRad), y, r * Math.sin(aRad));

// rotation.y so that an object's local +z faces the tower axis from angle a
export const faceIn = (aRad) => Math.atan2(-Math.cos(aRad), -Math.sin(aRad));

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
