import * as THREE from 'three';
import * as F from '../furniture.js';
import { R_IN, polar } from '../config.js';

// Fifth level: the assistant keeper's room, a young man's quarters with a bunk, a desk by the window and a shelf of
// ship models. Stairwell opening 178..273, low treads 297..7, corridor 264..297; the nook (7..40) holds a chest of drawers.
export function buildGuest(X) {
  const { ctx, B, env, rnd, M, toWorld, A, faceTo, atWall } = X;
  const r = env.room(4), y = r.y, W = R_IN - 0.015;
  r.curtains(X.fab(M, 0x5a7a9a, true));

  // ---- the nook: chest of drawers with a shaving mirror and a candle
  const cd = r.wall(21, 0.95, 0.5, 0.95, () => F.chestOfDrawers(B, M, 0.95, 0.5, 0.95, M.woodDark), { name: 'chest of drawers' });
  r.at(21, W, 1.35, () => F.mirror(B, M, 0.34, 0.44));
  { const p = toWorld(21, cd.r, y + 0.95, 0.0, 0, 0.0); F.candle(ctx, B, p.x + 0.2, p.y, p.z, 2.4); B.push(p.x - 0.2, p.y, p.z); F.bookPile(B, M, 2, rnd); B.pop(); }

  // ---- the desk under the east window, with a lamp, papers and a half-built ship
  const ds = r.wall(52, 1.1, 0.6, 0.85, () => { F.desk(B, M, 1.1, 0.6, 0.76); B.cyl(0.03, 0.03, 0.08, M.glassBottle, -0.4, 0.8, -0.1, 8); B.push(0.1, 0.77, 0.02); F.shipModel(B, M); B.pop(); }, { name: 'desk' });
  { const p = toWorld(52, ds.r, y + 0.77, -0.3, 0, 0.0); F.tableLamp(ctx, B, p.x, p.y, p.z, 3.8); }
  { const [x, , z] = atWall(52, 2.75, 0); r.free(x, z, faceTo(x, z, ds.x, ds.z), 0.44, 0.42, 0.95, () => F.chair(B, M, M.wood, X.fab(M, 0x2f4a5a)), { name: 'desk chair', nocheck: true }); }
  r.at(52, W, 1.55, () => F.painting(B, M, 0.7, 0.5, M.chart));

  // ---- under the window: a toy chest and a plant
  r.wall(72, 0.85, 0.5, 0.5, () => F.trunk(B, M, 0.85, true), { name: 'toy chest' });
  r.sill(0, () => F.plant(B, M, 0.28));

  // ---- the bunk bed, a washstand with a mirror, the shelf of ship models
  r.wall(100, 1.0, 2.0, 1.95, () => F.bunkBed(B, M), { name: 'bunk bed' });
  F.sconce(ctx, B, 113, y + 1.6, 3.0);
  const ws = r.wall(122, 0.7, 0.45, 0.9, () => F.washstand(B, M), { name: 'washstand' });
  r.at(122, W, 1.45, () => F.mirror(B, M, 0.4, 0.55));
  r.wall(136, 0.85, 0.34, 1.7, () => {
    F.bookcase(B, M, 0.85, 1.65, rnd, 5);
    B.push(-0.18, 1.7, 0.15); F.shipModel(B, M); B.pop();
  }, { name: 'bookcase' });

  // ---- window seat by the south-west window, wardrobe beside it
  r.wall(149, 1.15, 0.45, 0.5, () => {
    B.cbox(1.1, 0.42, 0.42, M.paintBlue, 0, 0.21, 0, 0, 0, 0, 0.7, null, 0.01);
    F.cushion(B, M, 0xc8a050, 0, 0.46, 0, 1.0, 0.4); F.cushion(B, M, 0x7a3a2a, 0.3, 0.55, -0.1, 0.3, 0.26, -0.4);
  }, { name: 'window seat' });
  r.sill(1, () => { B.push(0.1, 0, 0); F.shipModel(B, M); B.pop(); });
  r.wall(165, 1.1, 0.6, 2.05, () => F.wardrobe(B, M, 1.1, 2.0), { name: 'wardrobe' });

  // ---- a card table with two stools on a braided rug, in the middle of the room
  r.flat(0.1, -0.2, 0, () => F.rugRound(B, M.ragRug2, 0, 0, 0, 1.3));
  r.round(0.1, -0.2, 0.5, 0.74, () => F.table(B, M, 0.7, 0.7, 0.72, M.wood), { name: 'card table', nocheck: true });
  for (const [dx, dz] of [[0.65, -0.2], [-0.45, 0.0]]) r.round(0.1 + dx, -0.2 + dz, 0.18, 0.46, () => F.stool(B, M), { name: 'stool', nocheck: true });
  { B.push(0.1, y + 0.72, -0.2); for (const [dx, dz, c] of [[-0.12, -0.08, 0x2a2a2a], [0.12, 0.08, 0xe8e0c8]]) B.add(new THREE.SphereGeometry(0.03, 8, 6), X.fab(M, c), dx, 0.03, dz); B.cbox(0.4, 0.015, 0.4, X.fab(M, 0x6a4a2a), 0, 0.008, 0, 0, 0.3, 0, 0.5); B.pop(); }
  F.hangingLamp(ctx, B, 0.1, y + 2.44, -0.2, 0.42, 3.6);
}
