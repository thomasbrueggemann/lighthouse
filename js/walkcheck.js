import * as THREE from 'three';
import { FLOORS, R_IN, DEG, N_FLOORS } from './config.js';
import { stairInfo } from './tower.js';

// Developer tool, loaded on demand (`await skerry.checkWalk()` in the console). For every storey it flood-fills the
// floor using the real collision world and the player's capsule, then checks that you can walk from where you arrive
// (or from the door, on the ground floor) to the foot of the next flight, and that every interactive object has a
// reachable spot within arm's length. Furniture that blocks the stairs fails here.
const CELL = 0.2, N = Math.ceil(8.2 / CELL), O = -4.1;

export function run(ctx) {
  const col = ctx.col, tmp = new THREE.Vector3(), wp = new THREE.Vector3(), out = [];
  const idx = (x, z) => [Math.floor((x - O) / CELL), Math.floor((z - O) / CELL)];
  for (let k = 0; k < N_FLOORS; k++) {
    const y0 = FLOORS[k].y, ok = new Uint8Array(N * N), seen = new Uint8Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = O + (i + 0.5) * CELL, z = O + (j + 0.5) * CELL;
      if (Math.hypot(x, z) > R_IN - 0.25) continue;
      tmp.set(x, y0, z); col.resolve(tmp, 0.28, 1.72);
      if (Math.hypot(tmp.x - x, tmp.z - z) > 0.02) continue;                  // something solid is here
      const g = col.ground(x, z, y0 + 0.5);
      if (g.y < y0 - 0.1 || g.y > y0 + 0.45) continue;                          // no floor (stairwell opening) or a step too high
      ok[j * N + i] = 1;
    }
    const at = (a, r) => idx(r * Math.cos(a * DEG), r * Math.sin(a * DEG));
    const near = (c) => {
      let best = null, bd = 1e9;
      for (let dj = -4; dj <= 4; dj++) for (let di = -4; di <= 4; di++) { const i = c[0] + di, j = c[1] + dj; if (i < 0 || j < 0 || i >= N || j >= N || !ok[j * N + i]) continue; const d = di * di + dj * dj; if (d < bd) { bd = d; best = [i, j]; } }
      return best;
    };
    const info = stairInfo(k);
    const arriveA = k === 0 ? 90 : ((stairInfo(k - 1).a1 / DEG) % 360) + 6, arriveR = k === 0 ? 3.2 : 3.45;
    const s0 = near(at(arriveA, arriveR)), goal = near(at(info.a0 / DEG + 2.5, k === N_FLOORS - 1 ? 2.4 : 3.45));
    if (!s0 || !goal) { out.push({ floor: k, room: FLOORS[k].id, error: 'arrival point or the foot of the stairs is blocked' }); continue; }
    const queue = [s0]; seen[s0[1] * N + s0[0]] = 1;
    for (let q = 0; q < queue.length; q++) {
      const [i, j] = queue[q];
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= N || b >= N || seen[b * N + a] || !ok[b * N + a]) continue;
        if (di && dj && (!ok[j * N + a] || !ok[b * N + i])) continue;           // no squeezing through diagonal gaps
        seen[b * N + a] = 1; queue.push([a, b]);
      }
    }
    const miss = [];
    for (const it of ctx.inter.items) {
      it.obj.getWorldPosition(wp);
      if (wp.y < y0 - 0.2 || wp.y > y0 + 2.9 || Math.hypot(wp.x, wp.z) > R_IN + 0.3) continue;
      const reach = Math.min(it.range ?? 2.6, 2.2);
      let found = false;
      for (let j = 0; j < N && !found; j++) for (let i = 0; i < N; i++) { if (seen[j * N + i] && Math.hypot(O + (i + 0.5) * CELL - wp.x, O + (j + 0.5) * CELL - wp.z) < reach) { found = true; break; } }
      if (!found) miss.push(`${it.prompt?.() ?? '?'} @(${wp.x.toFixed(1)}, ${wp.z.toFixed(1)})`);
    }
    out.push({ floor: k, room: FLOORS[k].id, reachNextFlight: !!seen[goal[1] * N + goal[0]], walkableArea: +(queue.length * CELL * CELL).toFixed(1), unreachableInteractables: miss });
  }
  return out;
}

// Walks a simulated player (real physics and collision, W held, steering toward waypoints) from the front door up every
// flight to the lantern room, and reports where, if anywhere, the climb gets stuck. Run: `await skerry.checkClimb()`.
export function climb(ctx) {
  const p = ctx.player, keys = p.keys, out = [];
  const yawTo = (tx, tz) => Math.atan2(-(tx - p.pos.x), -(tz - p.pos.z));
  const was = { freeze: ctx.freeze, enabled: p.enabled };
  ctx.freeze = false; p.enabled = true; p.vel.set(0, 0, 0);
  p.pos.set(Math.cos(90 * DEG) * 3.3, FLOORS[0].y, Math.sin(90 * DEG) * 3.3); p.camY = p.pos.y + 1.62;
  const walkTo = (x, z, tol = 0.4, maxFrames = 600) => {
    for (let f = 0; f < maxFrames; f++) {
      if (Math.hypot(p.pos.x - x, p.pos.z - z) < tol) return true;
      p.yaw = yawTo(x, z); keys.KeyW = true; ctx.step(1, 1 / 60, false);
    }
    return false;
  };
  for (let k = 0; k < N_FLOORS; k++) {
    const info = stairInfo(k), y1 = k < N_FLOORS - 1 ? FLOORS[k + 1].y : ctx.tower.lens ? FLOORS[N_FLOORS - 1].y + 3 : 0;
    const rm = (info.r0 + info.r1) / 2, pts = [];
    if (k === 0) pts.push([Math.cos(112 * DEG) * 3.45, Math.sin(112 * DEG) * 3.45]);          // from the door along the wall to the foot
    for (let s = 0; s <= info.steps; s++) { const a = info.a0 + (s + 0.5) * info.d; pts.push([Math.cos(a) * rm, Math.sin(a) * rm]); }
    let ok = true, at = null;
    for (const [x, z] of pts) { if (!walkTo(x, z)) { ok = false; at = `(${x.toFixed(1)}, ${z.toFixed(1)}) at y=${p.pos.y.toFixed(2)}`; break; } }
    // step off the top onto the landing
    if (ok && k < N_FLOORS - 1) { const a = info.a1 + 6 * DEG; ok = walkTo(Math.cos(a) * 3.45, Math.sin(a) * 3.45, 0.45, 120); if (!ok) at = `landing at y=${p.pos.y.toFixed(2)}`; }
    out.push({ flight: k, from: FLOORS[k].id, reachedY: +p.pos.y.toFixed(2), wantY: k < N_FLOORS - 1 ? FLOORS[k + 1].y : 'lantern', ok: ok && (k >= N_FLOORS - 1 || Math.abs(p.pos.y - FLOORS[k + 1].y) < 0.35), stuckAt: at });
    if (!ok) break;
  }
  keys.KeyW = false; ctx.freeze = was.freeze; p.enabled = was.enabled;
  return out;
}
