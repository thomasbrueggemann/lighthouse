import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const PLATEAU_Y = 7;
export const FLOOR_H = 4.5;
export const R_IN = 4.0;
export const R_OUT_BASE = 5.6;
export const R_OUT_TOP = 4.5;
export const TOWER_BASE = 7;
export const TOWER_TOP = 29.5;
export const CELLAR_Y = 3.2;
export const LANTERN_Y = 29.5;
export const LENS_Y = 31.35;
export const R_GLASS = 3.0;
export const R_GALLERY = 5.9;
export const GLASS_TOP = 33.3;
export const WALL_SEGS = 96;

export const FLOORS = [
  { id: 'store', name: 'The Store Room', y: 7.0 },
  { id: 'kitchen', name: 'The Kitchen', y: 11.5 },
  { id: 'bedroom', name: "The Keeper's Bedroom", y: 16.0 },
  { id: 'study', name: 'The Study', y: 20.5 },
  { id: 'watch', name: 'The Watch Room', y: 25.0 },
];

// spiral stairs from floor i to floor i+1 (angles in degrees, world angle: x = r cos a, z = r sin a)
export const STAIRS = [
  { start: 120, span: 135, steps: 20, r0: 2.95, r1: 3.98 },
  { start: 295, span: 135, steps: 20, r0: 2.95, r1: 3.98 },
  { start: 110, span: 135, steps: 20, r0: 2.95, r1: 3.98 },
  { start: 285, span: 135, steps: 20, r0: 2.95, r1: 3.98 },
  { start: 100, span: 140, steps: 18, r0: 1.9, r1: 2.85 },
];

// windows per floor: center angle (deg), number of wall segments, sill & head height above floor
export const WINDOWS = [
  [{ a: 300, n: 4, yb: 1.0, yt: 2.4 }, { a: 22.5, n: 4, yb: 1.0, yt: 2.4 }],
  [{ a: 157.5, n: 4, yb: 1.0, yt: 2.4 }, { a: 270, n: 4, yb: 1.1, yt: 2.4 }],
  [{ a: 262.5, n: 4, yb: 1.0, yt: 2.4, broken: true }, { a: 30, n: 4, yb: 1.0, yt: 2.4 }],
  [{ a: 82.5, n: 4, yb: 1.0, yt: 2.4 }, { a: 262.5, n: 4, yb: 1.0, yt: 2.4 }],
  [{ a: 0, n: 4, yb: 1.2, yt: 2.3 }, { a: 90, n: 4, yb: 1.2, yt: 2.3 }, { a: 180, n: 4, yb: 1.2, yt: 2.3 }, { a: 270, n: 4, yb: 1.2, yt: 2.3 }],
];

export const DOOR_ANGLE = 90; // deg, +z (south)
export const SECRET_NICHE = { floor: 3, a: 142.5, n: 4 };
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
