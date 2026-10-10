import * as THREE from 'three';
import * as F from '../furniture.js';
import { R_IN } from '../config.js';
import { lathe } from '../geom.js';

// Eighth level: the lamp workshop, where burners are trimmed, mantles changed and spare optics kept. Stairwell opening
// 226..321, low treads 345..55, corridor 312..345; the nook (55..88) holds stock shelves.
export function buildWorkshop(X) {
  const { ctx, B, env, rnd, M, toWorld, A, faceTo, atWall } = X;
  const r = env.room(7), y = r.y, W = R_IN - 0.015;
  r.curtains(X.fab(M, 0xd8d0a8, true));

  // ---- stock shelves in the nook
  r.wall(67, 1.1, 0.4, 1.7, () => F.shelving(B, M, 1.1, 0.4, 1.7, rnd, 'workshop', 5), { name: 'stock shelves' });
  r.wall(83, 0.9, 0.45, 1.7, () => F.cupboard(B, M, 0.9, 0.45, 1.7, M.paintGreen), { name: 'parts cupboard' });
  // ---- the grindstone and a bucket
  r.wall(101, 0.6, 0.4, 0.95, () => F.grindstone(B, M), { name: 'grindstone' });
  { const [x, , z] = atWall(106, 3.35, 0); r.round(x, z, 0.17, 0.3, () => { B.add(lathe([[0.001, 0], [0.14, 0], [0.17, 0.28], [0.162, 0.28], [0.13, 0.02], [0.001, 0.015]], 14), M.tin); }, { name: 'bucket', nocheck: true }); }
  // ---- the workbench under the south-east window, with burners laid out on a cloth
  const wb = r.wall(120, 1.7, 0.65, 1.0, () => {
    F.workTable(B, M, 1.7, 0.65, 0.9, M.woodDark);
    B.cbox(1.0, 0.012, 0.45, X.fab(M, 0xd8d0b0), 0.1, 0.906, 0.0, 0, 0, 0, 0.5);
    for (let k = 0; k < 4; k++) { B.cyl(0.04, 0.05, 0.05, M.brass, -0.2 + k * 0.18, 0.94, 0.0, 10); B.cyl(0.015, 0.015, 0.07, M.brass, -0.2 + k * 0.18, 0.99, 0.0, 6); }
    B.add(new THREE.CylinderGeometry(0.035, 0.05, 0.2, 10), M.lampGlass, 0.62, 1.0, -0.1);
    B.cbox(0.22, 0.12, 0.14, M.ironBlack, -0.7, 0.96, 0.1, 0, 0, 0, 0.5, null, 0.008);
  }, { name: 'workbench' });
  { const p = toWorld(120, wb.r, y + 0.92, 0.5, 0, 0.15); F.bankersLamp(ctx, B, p.x, p.y, p.z, 4.0); }
  r.round(...(() => { const [x, , z] = atWall(120, 2.8, 0); return [x, z]; })(), 0.18, 0.5, () => F.stool(B, M, 0.5), { name: 'stool', nocheck: true });
  r.at(120, W, 1.5, () => { B.cbox(0.9, 0.5, 0.02, M.woodDark, 0, 0, 0.01, 0, 0, 0, 0.8, null, 0.004); for (const [x, len] of [[-0.3, 0.3], [-0.1, 0.24], [0.1, 0.34], [0.3, 0.2]]) B.cbox(0.025, len, 0.012, M.steel, x, 0.0, 0.03); });
  // ---- spare optics, more shelving and the parts drawers
  r.wall(142, 1.1, 0.4, 2.0, () => F.shelving(B, M, 1.1, 0.4, 2.0, rnd, 'workshop', 6), { name: 'shelves' });
  r.wall(158, 0.9, 0.5, 1.4, () => F.lensStand(B, M), { name: 'spare lens', nocheck: false });
  r.wall(176, 1.0, 0.4, 2.0, () => F.shelving(B, M, 1.0, 0.4, 2.0, rnd, 'workshop', 6), { name: 'shelves' });
  r.wall(197, 0.95, 0.5, 0.95, () => F.chestOfDrawers(B, M, 0.95, 0.5, 0.95, M.woodDark), { name: 'parts drawers' });
  r.sill(1, () => { F.plant(B, M, 0.22, false); }, -0.2);
  r.wall(214, 1.0, 0.45, 1.9, () => F.cupboard(B, M, 1.0, 0.45, 1.9, M.paintBlue), { name: 'oil cupboard' });
  // ---- the big table in the middle where a lens panel is being polished
  const tx = 0.1, tz = 0.0;
  r.flat(tx, tz, 0, () => F.rugAt(B, M.ticking, 0, 0, 0, 2.4, 1.6, 0.3));
  r.free(tx, tz, 0.3, 1.8, 0.9, 0.95, () => {
    F.workTable(B, M, 1.8, 0.9, 0.9, M.wood);
    B.cbox(0.7, 0.04, 0.5, X.fab(M, 0xd8d0b0), -0.3, 0.92, 0.0, 0, 0, 0, 0.5, null, 0.01);
    B.add(new THREE.PlaneGeometry(0.62, 0.42), M.lensSpare, -0.3, 0.95, 0.0, -Math.PI / 2);
    B.add(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 10), M.tin, 0.4, 0.95, 0.15);
    for (let k = 0; k < 3; k++) B.cbox(0.2, 0.025, 0.14, X.fab(M, k % 2 ? 0xe8e0c8 : 0xc8b890), 0.45, 0.92 + k * 0.025, -0.1, 0, k * 0.4, 0, 0.5);
  }, { name: 'polishing table' });
  for (const [dx, dz] of [[0.6, 0.85], [-0.7, -0.85]]) r.round(tx + dx, tz + dz, 0.18, 0.5, () => F.stool(B, M, 0.5), { name: 'stool', nocheck: true });
  F.hangingLamp(ctx, B, tx, y + 2.44, tz, 0.5, 5.0);
  { const [x, , z] = atWall(186, 3.55, 0); r.round(x, z, 0.34, 1.0, () => F.barrel(B, M), { name: 'oil barrel', nocheck: true }); }
}
