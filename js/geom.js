import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TAU } from './config.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

// Accumulates raw triangles; quads are auto-oriented to face along the given normal.
export class GeoBuilder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; }
  get empty() { return this.pos.length === 0; }
  quad(p, n, uv) {
    _a.subVectors(p[1], p[0]); _b.subVectors(p[2], p[0]); _c.crossVectors(_a, _b);
    const n0 = n.isVector3 ? n : n[0];
    const order = _c.dot(n0) >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    for (const i of order) {
      const v = p[i], nn = n.isVector3 ? n : n[i];
      this.pos.push(v.x, v.y, v.z); this.nor.push(nn.x, nn.y, nn.z); this.uv.push(uv[i][0], uv[i][1]);
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere();
    return g;
  }
}

const P = (r, a, y) => new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a));
const radial = (a) => new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
const tangent = (a) => new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
const UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);

// Solid annular sector (stair treads, decks, sills)
export function annularSector(r0, r1, a0, a1, y0, y1, nseg = 4, ts = 1, gb = new GeoBuilder()) {
  for (let j = 0; j < nseg; j++) {
    const b0 = a0 + (a1 - a0) * j / nseg, b1 = a0 + (a1 - a0) * (j + 1) / nseg;
    const q = [P(r0, b0, y1), P(r1, b0, y1), P(r1, b1, y1), P(r0, b1, y1)];
    gb.quad(q, UP, q.map(v => [v.x / ts, v.z / ts]));
    const qb = [P(r0, b0, y0), P(r1, b0, y0), P(r1, b1, y0), P(r0, b1, y0)];
    gb.quad(qb, DOWN, qb.map(v => [v.x / ts, v.z / ts]));
    const bm = (b0 + b1) / 2, la = r1 * (b1 - b0) / ts, li = r0 * (b1 - b0) / ts;
    gb.quad([P(r1, b0, y0), P(r1, b1, y0), P(r1, b1, y1), P(r1, b0, y1)], radial(bm), [[0, 0], [la, 0], [la, (y1 - y0) / ts], [0, (y1 - y0) / ts]]);
    gb.quad([P(r0, b0, y0), P(r0, b1, y0), P(r0, b1, y1), P(r0, b0, y1)], radial(bm).negate(), [[0, 0], [li, 0], [li, (y1 - y0) / ts], [0, (y1 - y0) / ts]]);
  }
  const h = (y1 - y0) / ts, w = (r1 - r0) / ts;
  gb.quad([P(r0, a0, y0), P(r1, a0, y0), P(r1, a0, y1), P(r0, a0, y1)], tangent(a0).negate(), [[0, 0], [w, 0], [w, h], [0, h]]);
  gb.quad([P(r0, a1, y0), P(r1, a1, y0), P(r1, a1, y1), P(r0, a1, y1)], tangent(a1), [[0, 0], [w, 0], [w, h], [0, h]]);
  return gb;
}

/**
 * Thick cylindrical wall with real openings.
 * openings: [{ s0, n, yb, yt, kind: 'window'|'door'|'niche', depth }] in segment indices.
 * Returns { inner, outer, reveal } geometries (any may be null).
 */
export function ringWall({ rIn, rOutFn, y0, y1, segs = 96, openings = [], innerTileW = 2.0, innerTileH = 4.5, outerTileW = 4.5, outerTileH = 4.5, noOuter = false }) {
  const gi = new GeoBuilder(), go = new GeoBuilder(), gr = new GeoBuilder();
  const segA = TAU / segs;
  const op = new Array(segs).fill(null);
  for (const o of openings) for (let k = 0; k < o.n; k++) op[((o.s0 + k) % segs + segs) % segs] = o;
  const nIn = Math.max(1, Math.round(TAU * rIn / innerTileW));
  const rMid = rOutFn((y0 + y1) / 2);
  const nOut = Math.max(1, Math.round(TAU * rMid / outerTileW));
  const uIn = (a) => a / TAU * nIn, uOut = (a) => a / TAU * nOut;
  const vIn = (y) => (y - y0) / innerTileH, vOut = (y) => y / outerTileH;

  const innerQuad = (a0, a1, ya, yb) => {
    if (yb - ya < 1e-4) return;
    gi.quad([P(rIn, a0, ya), P(rIn, a1, ya), P(rIn, a1, yb), P(rIn, a0, yb)],
      [radial(a0).negate(), radial(a1).negate(), radial(a1).negate(), radial(a0).negate()],
      [[uIn(a0), vIn(ya)], [uIn(a1), vIn(ya)], [uIn(a1), vIn(yb)], [uIn(a0), vIn(yb)]]);
  };
  const outerQuad = (a0, a1, ya, yb) => {
    if (noOuter || yb - ya < 1e-4) return;
    go.quad([P(rOutFn(ya), a0, ya), P(rOutFn(ya), a1, ya), P(rOutFn(yb), a1, yb), P(rOutFn(yb), a0, yb)],
      [radial(a0), radial(a1), radial(a1), radial(a0)],
      [[uOut(a0), vOut(ya)], [uOut(a1), vOut(ya)], [uOut(a1), vOut(yb)], [uOut(a0), vOut(yb)]]);
  };
  for (let i = 0; i < segs; i++) {
    const a0 = i * segA, a1 = (i + 1) * segA;
    const o = op[i];
    if (!o) { innerQuad(a0, a1, y0, y1); outerQuad(a0, a1, y0, y1); continue; }
    const yb = Math.max(o.yb, y0), yt = Math.min(o.yt, y1);
    innerQuad(a0, a1, y0, yb); innerQuad(a0, a1, yt, y1);
    const rBack = o.kind === 'niche' ? rIn + o.depth : null;
    if (o.kind === 'niche') { outerQuad(a0, a1, y0, y1); } else { outerQuad(a0, a1, y0, yb); outerQuad(a0, a1, yt, y1); }
    const rEnd = (y) => (rBack ?? rOutFn(y));
    // sill & lintel
    if (yb > y0 + 1e-4) {
      const q = [P(rIn, a0, yb), P(rIn, a1, yb), P(rEnd(yb), a1, yb), P(rEnd(yb), a0, yb)];
      gr.quad(q, UP, q.map(v => [v.x / 1.2, v.z / 1.2]));
    }
    {
      const q = [P(rIn, a0, yt), P(rIn, a1, yt), P(rEnd(yt), a1, yt), P(rEnd(yt), a0, yt)];
      gr.quad(q, DOWN, q.map(v => [v.x / 1.2, v.z / 1.2]));
    }
    if (rBack) {
      const q = [P(rBack, a0, yb), P(rBack, a1, yb), P(rBack, a1, yt), P(rBack, a0, yt)];
      gr.quad(q, radial((a0 + a1) / 2).negate(), [[0, 0], [rBack * segA / 1.2, 0], [rBack * segA / 1.2, (yt - yb) / 1.2], [0, (yt - yb) / 1.2]]);
    }
    // jambs
    const prev = op[(i - 1 + segs) % segs], next = op[(i + 1) % segs];
    const jamb = (a, nrm) => {
      const q = [P(rIn, a, yb), P(rEnd(yb), a, yb), P(rEnd(yt), a, yt), P(rIn, a, yt)];
      gr.quad(q, nrm, [[0, yb / 1.2], [(rEnd(yb) - rIn) / 1.2, yb / 1.2], [(rEnd(yt) - rIn) / 1.2, yt / 1.2], [0, yt / 1.2]]);
    };
    if (prev !== o) jamb(a0, tangent(a0));
    if (next !== o) jamb(a1, tangent(a1).negate());
  }
  return {
    inner: gi.empty ? null : gi.geometry(),
    outer: go.empty ? null : go.geometry(),
    reveal: gr.empty ? null : gr.geometry(),
  };
}

export function scaleUV(g, su, sv = su) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return g;
}

// Box with UVs in world units (ts = metres per texture tile)
export function boxGeo(w, h, d, ts = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const k = f * 4 + i;
    uv.setXY(k, uv.getX(k) * dims[f][0] / ts, uv.getY(k) * dims[f][1] / ts);
  }
  return g;
}

export function cylGeo(rt, rb, h, seg = 16, open = false, ts = 1) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
  return scaleUV(g, TAU * Math.max(rt, rb) / ts, h / ts);
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
export function mat4(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}

const KEEP = ['position', 'normal', 'uv'];

// Batches many static parts per material into a handful of draw calls.
export class Builder {
  constructor() { this.groups = new Map(); this.stack = [new THREE.Matrix4()]; }
  top() { return this.stack[this.stack.length - 1]; }
  push(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, s = 1) {
    this.stack.push(this.top().clone().multiply(mat4(x, y, z, rx, ry, rz, s, s, s)));
    return this;
  }
  pop() { this.stack.pop(); return this; }
  add(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, color = null) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!KEEP.includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    if (mat.vertexColors) {
      const c = color || new THREE.Color(1, 1, 1), n = g.attributes.position.count, arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3));
    }
    g.applyMatrix4(this.top().clone().multiply(mat4(x, y, z, rx, ry, rz, sx, sy, sz)));
    if (!this.groups.has(mat)) this.groups.set(mat, []);
    this.groups.get(mat).push(g);
    return this;
  }
  box(w, h, d, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, ts = 0.8, color = null) {
    return this.add(boxGeo(w, h, d, ts), mat, x, y, z, rx, ry, rz, 1, 1, 1, color);
  }
  cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 16, rx = 0, ry = 0, rz = 0, ts = 0.8, open = false) {
    return this.add(cylGeo(rt, rb, h, seg, open, ts), mat, x, y, z, rx, ry, rz);
  }
  build(parent, { shadows = true, name = '' } = {}) {
    const meshes = [];
    for (const [mat, list] of this.groups) {
      if (!list.length) continue;
      const merged = mergeGeometries(list, false);
      if (!merged) { console.warn('merge failed', name, mat); continue; }
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = shadows && !mat.transparent; mesh.receiveShadow = true;
      mesh.name = name;
      parent.add(mesh); meshes.push(mesh);
      list.forEach(g => g.dispose());
    }
    this.groups.clear();
    return meshes;
  }
}

export function lathe(points, seg = 24) {
  return new THREE.LatheGeometry(points.map(p => new THREE.Vector2(p[0], p[1])), seg);
}
