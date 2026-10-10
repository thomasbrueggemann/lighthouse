import * as THREE from 'three';
import { R_IN, FLOORS, WINDOWS, DEG, faceIn, polar } from '../config.js';
import { checkFootprint, curtainPair } from '../furniture.js';

// Shared by every room: placing pieces against the curved wall or freestanding, with collision, and with every
// footprint checked against the stairs, the stairwell opening and the corridor between them.
export function makeEnv(ctx, B, g) {
  const { col, M } = ctx;
  const R = R_IN - 0.015;
  const wallR = (w, d) => Math.sqrt(R * R - (w / 2) ** 2) - d / 2;      // centre radius at which a w x d piece's back corners touch the wall
  ctx.layoutIssues = [];

  const room = (k) => {
    const y = FLOORS[k].y, id = FLOORS[k].id;
    const footprint = (x, z, w, d, ry) => {
      const c = Math.cos(ry), s = Math.sin(ry), pts = [];
      for (const u of [-0.5, -0.25, 0, 0.25, 0.5]) for (const v of [-0.5, 0, 0.5]) { const lx = u * w, lz = v * d; pts.push([x + lx * c + lz * s, z - lx * s + lz * c]); }
      return pts;
    };
    const verify = (name, x, z, w, d, ry, top) => {
      const issues = checkFootprint(k, footprint(x, z, w, d, ry), top);
      if (issues.length) { const msg = `[${id}] ${name}: ${issues.join('; ')}`; ctx.layoutIssues.push(msg); console.warn('Layout', msg); }
    };
    const api = {
      k, y, id,
      // a piece standing against the wall at angle aDeg: w wide, d deep, h tall; `draw` runs with the Builder at its centre (front = +z)
      wall(aDeg, w, d, h, draw, o = {}) {
        const r = wallR(w, d) - (o.gap ?? 0), a = aDeg * DEG;
        const x = r * Math.cos(a), z = r * Math.sin(a), ry = faceIn(a) + (o.rot ?? 0), yy = y + (o.y ?? 0);
        if (!o.nocheck) verify(o.name ?? 'wall piece', x, z, w, d, ry, h + (o.y ?? 0));
        B.push(x, yy, z, ry); draw(); B.pop();
        if (o.collide !== false) col.addBox(x, z, w, d, ry, yy, yy + h);
        return { x, z, ry, r, a: aDeg };
      },
      // a freestanding piece with a rectangular footprint
      free(x, z, ry, w, d, h, draw, o = {}) {
        const yy = y + (o.y ?? 0);
        if (!o.nocheck) verify(o.name ?? 'free piece', x, z, w, d, ry, h + (o.y ?? 0));
        B.push(x, yy, z, ry); draw(); B.pop();
        if (o.collide !== false) col.addBox(x, z, w, d, ry, yy, yy + h);
        return { x, z, ry };
      },
      // a freestanding piece with a round footprint
      round(x, z, rad, h, draw, o = {}) {
        const yy = y + (o.y ?? 0);
        if (!o.nocheck) verify(o.name ?? 'round piece', x, z, rad * 2, rad * 2, 0, h + (o.y ?? 0));
        B.push(x, yy, z, o.ry ?? 0); draw(); B.pop();
        if (o.collide !== false) col.addCircle(x, z, rad, yy, yy + h);
        return { x, z };
      },
      // something hung on the wall or laid on the floor: no collision, no stair check unless asked
      at(aDeg, rr, yRel, draw, rot = 0) { const a = aDeg * DEG; B.push(rr * Math.cos(a), y + yRel, rr * Math.sin(a), faceIn(a) + rot); draw(); B.pop(); },
      flat(x, z, ry, draw) { B.push(x, y, z, ry); draw(); B.pop(); },
      // curtains on every window of this floor (the broken casement stays bare)
      curtains(fabric, o = {}) {
        for (const w of WINDOWS[k]) {
          if (w.broken && !o.broken) continue;
          const a = w.a * DEG, p = polar(R_IN - 0.03, a, y);
          B.push(p.x, y, p.z, faceIn(a)); curtainPair(B, M, fabric, w.yt + 0.32, w.yb - 0.1); B.pop();
        }
      },
      // an object standing on a window sill (idx = which window of this floor)
      sill(idx, draw, dx = 0) {
        const w = WINDOWS[k][idx]; if (!w) return;
        const a = w.a * DEG, p = polar(R_IN + 0.2, a, y + w.yb + 0.05);
        B.push(p.x, y + w.yb + 0.05, p.z, faceIn(a)); B.push(dx, 0, 0); draw(w); B.pop(); B.pop();
      },
    };
    return api;
  };
  return { room, wallR, R };
}
