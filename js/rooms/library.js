import * as THREE from 'three';
import * as F from '../furniture.js';
import { R_IN } from '../config.js';

// Seventh level: the library. Walls of books on every stretch the stairs leave free, a long reading table under two
// green lamps, a rolling ladder, and a window seat to read in. Stairwell opening 90..185, low treads 209..279,
// corridor 176..209; the nook (279..312) takes low bookcases.
export function buildLibrary(X) {
  const { ctx, B, env, rnd, M, toWorld, A, faceTo, atWall } = X;
  const r = env.room(6), y = r.y, W = R_IN - 0.015;
  r.curtains(X.fab(M, 0x3a5a40, true));

  // ---- low cases in the under-stair nook, tall ones beyond it
  for (const a of [289, 304]) r.wall(a, 1.0, 0.34, 1.7, () => F.bookcase(B, M, 1.0, 1.65, rnd, 5), { name: 'nook bookcase' });
  for (const a of [316, 329]) r.wall(a, 1.0, 0.36, 2.3, () => F.bookcase(B, M, 1.0, 2.25, rnd, 6), { name: 'bookcase' });
  // ---- the east window: a seat to read in, a sconce, a plant
  r.wall(344, 1.15, 0.45, 0.5, () => {
    B.cbox(1.1, 0.42, 0.42, M.woodDark, 0, 0.21, 0, 0, 0, 0, 0.7, null, 0.01);
    F.cushion(B, M, 0x2f5a40, 0, 0.46, 0, 1.0, 0.4); F.cushion(B, M, 0xc8a050, 0.33, 0.55, -0.1, 0.3, 0.26, -0.4); F.cushion(B, M, 0x7a2a2a, -0.33, 0.55, -0.1, 0.32, 0.26, -0.4);
  }, { name: 'window seat' });
  r.sill(0, () => F.plant(B, M, 0.3));
  F.sconce(ctx, B, 344, y + 2.3, 2.6);
  // ---- the great wall of books between the windows, with a ladder at one end
  for (const a of [0, 15, 30, 45]) r.wall(a, 1.0, 0.36, 2.3, () => F.bookcase(B, M, 1.0, 2.25, rnd, 6), { name: 'bookcase' });
  { const [x, , z, ry] = atWall(23, 3.52, 0); r.free(x, z, ry, 0.48, 0.34, 2.3, () => F.ladder(B, M, 2.2), { name: 'ladder', nocheck: true }); }
  // ---- the north-east window: an armchair, a side table with a lamp
  r.wall(61, 0.8, 0.4, 0.5, () => { B.cbox(0.7, 0.42, 0.36, M.woodDark, 0, 0.21, 0, 0, 0, 0, 0.7, null, 0.01); F.cushion(B, M, 0x2f5a40, 0, 0.46, 0, 0.7, 0.34); }, { name: 'window seat' });
  r.sill(1, () => F.plant(B, M, 0.26));
  r.wall(79, 0.9, 0.34, 1.7, () => F.bookcase(B, M, 0.9, 1.65, rnd, 5), { name: 'bookcase' });
  {
    const ax = Math.cos(A(48)) * 2.25, az = Math.sin(A(48)) * 2.25;
    r.free(ax, az, faceTo(ax, az, 0.2, 0.0), 0.85, 0.8, 1.0, () => F.armchair(B, M, 0x6a3a22), { name: 'armchair' });
    const sx = ax - 0.3, sz = az - 0.75; r.round(sx, sz, 0.22, 0.56, () => F.sideTable(B, M), { name: 'side table', nocheck: true }); F.tableLamp(ctx, B, sx, y + 0.56, sz, 3.4);
    B.push(sx + 0.04, y + 0.56, sz); F.cup(B, M); B.pop();
  }

  // ---- the long reading table under two green lamps, on a braided rug
  const tx = -0.2, tz = 0.15;
  r.flat(tx, tz, 0, () => F.rugRound(B, M.ragRug2, 0, 0, 0, 1.9));
  r.free(tx, tz, Math.PI / 2, 1.7, 0.9, 0.8, () => { F.readingTable(B, M, 1.7, 0.9, 0.76); B.push(0.1, 0.77, 0.1); F.bookPile(B, M, 4, rnd); B.pop(); B.push(-0.45, 0.77, -0.05); F.bookPile(B, M, 2, rnd); B.pop(); B.add(new THREE.CylinderGeometry(0.01, 0.01, 0.6, 5), M.black, 0.2, 0.78, 0.3, 0, 0, Math.PI / 2); }, { name: 'reading table' });
  // table axis runs along z (rotated 90 degrees): lamps sit on the table's long ends
  F.bankersLamp(ctx, B, tx + 0.0, y + 0.76, tz - 0.55, 3.6);
  F.bankersLamp(ctx, B, tx + 0.0, y + 0.76, tz + 0.55, 3.6);
  for (const [dx, dz, ry] of [[0.7, -0.3, -Math.PI / 2], [0.7, 0.4, -Math.PI / 2], [-0.7, 0.0, Math.PI / 2]]) r.free(tx + dx, tz + dz, ry, 0.46, 0.46, 0.95, () => F.chair(B, M, M.woodDark, X.fab(M, 0x3a5a40)), { name: 'chair', nocheck: true });
}
