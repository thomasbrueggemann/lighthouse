import * as THREE from 'three';
import { TAU } from './config.js';

// 2.5D collision: vertical-extent line segments and circles in XZ, plus raycast ground.
export class CollisionWorld {
  constructor() {
    this.segs = [];
    this.circles = [];
    this.walk = [];
    this.terrain = null; // { height(x,z), valid(x,z) }
    this.ray = new THREE.Raycaster();
    this.ray.far = 60;
    this._o = new THREE.Vector3(); this._d = new THREE.Vector3(0, -1, 0);
  }
  addSeg(ax, az, bx, bz, y0, y1, tag = null) {
    const s = { ax, az, bx, bz, y0, y1, on: true, tag };
    this.segs.push(s); return s;
  }
  addPoly(points, y0, y1, closed = false) {
    const out = [];
    for (let i = 0; i < points.length - (closed ? 0 : 1); i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      out.push(this.addSeg(a[0], a[1], b[0], b[1], y0, y1));
    }
    return out;
  }
  // oriented box footprint (center, size, rotation about Y)
  addBox(cx, cz, w, d, ry, y0, y1) {
    const c = Math.cos(ry), s = Math.sin(ry);
    const pt = (x, z) => [cx + x * c + z * s, cz - x * s + z * c];
    const hw = w / 2, hd = d / 2;
    return this.addPoly([pt(-hw, -hd), pt(hw, -hd), pt(hw, hd), pt(-hw, hd)], y0, y1, true);
  }
  addCircle(x, z, r, y0, y1) { const c = { x, z, r, y0, y1, on: true }; this.circles.push(c); return c; }
  // arc of segments around (cx,cz); gaps = [[a0,a1],...] radians to skip
  addArc(cx, cz, r, a0, a1, y0, y1, n = 32) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const t0 = a0 + (a1 - a0) * i / n, t1 = a0 + (a1 - a0) * (i + 1) / n;
      out.push(this.addSeg(cx + r * Math.cos(t0), cz + r * Math.sin(t0), cx + r * Math.cos(t1), cz + r * Math.sin(t1), y0, y1));
    }
    return out;
  }
  addRing(cx, cz, r, y0, y1, n = 48, gaps = []) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const t0 = i / n * TAU, t1 = (i + 1) / n * TAU, tm = (t0 + t1) / 2;
      if (gaps.some(([g0, g1]) => inArc(tm, g0, g1))) continue;
      out.push(this.addSeg(cx + r * Math.cos(t0), cz + r * Math.sin(t0), cx + r * Math.cos(t1), cz + r * Math.sin(t1), y0, y1));
    }
    return out;
  }
  addWalk(mesh, surface = 'wood') { mesh.userData.surface = surface; this.walk.push(mesh); return mesh; }
  removeWalk(mesh) { const i = this.walk.indexOf(mesh); if (i >= 0) this.walk.splice(i, 1); }

  resolve(p, radius, height) {
    const y0 = p.y + 0.05, y1 = p.y + height;
    for (let it = 0; it < 3; it++) {
      let moved = false;
      for (const s of this.segs) {
        if (!s.on || y1 < s.y0 || y0 > s.y1) continue;
        const dx = s.bx - s.ax, dz = s.bz - s.az;
        const l2 = dx * dx + dz * dz || 1e-9;
        let t = ((p.x - s.ax) * dx + (p.z - s.az) * dz) / l2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const cx = s.ax + dx * t, cz = s.az + dz * t;
        let ex = p.x - cx, ez = p.z - cz;
        const d2 = ex * ex + ez * ez;
        if (d2 < radius * radius) {
          let d = Math.sqrt(d2);
          if (d < 1e-6) { ex = -dz; ez = dx; d = Math.hypot(ex, ez); }
          const push = (radius - d) / d;
          p.x += ex * push; p.z += ez * push; moved = true;
        }
      }
      for (const c of this.circles) {
        if (!c.on || y1 < c.y0 || y0 > c.y1) continue;
        const ex = p.x - c.x, ez = p.z - c.z, d = Math.hypot(ex, ez), m = c.r + radius;
        if (d < m && d > 1e-6) { p.x += ex / d * (m - d); p.z += ez / d * (m - d); moved = true; }
      }
      if (!moved) break;
    }
  }

  // highest walkable surface at or below fromY
  ground(x, z, fromY) {
    let best = -Infinity, surface = 'rock', terrain = false;
    this._o.set(x, fromY, z);
    this.ray.set(this._o, this._d);
    const hits = this.ray.intersectObjects(this.walk, false);
    if (hits.length) { best = hits[0].point.y; surface = hits[0].object.userData.surface || 'wood'; }
    if (this.terrain && this.terrain.valid(x, z)) {
      const h = this.terrain.height(x, z);
      if (h <= fromY + 0.01 && h > best) { best = h; surface = 'rock'; terrain = true; }
    }
    return { y: best, surface, terrain };
  }
}

export function inArc(a, a0, a1) {
  const t = ((a - a0) % TAU + TAU) % TAU, w = ((a1 - a0) % TAU + TAU) % TAU;
  return t <= w;
}
