import * as THREE from 'three';
import { mulberry32 } from './noise.js';
import { Builder, boxGeo, cylGeo, lathe } from './geom.js';
import { DEG, TAU, FLOORS, R_IN, CELLAR_Y, LANTERN_Y, LENS_Y, R_GLASS, SHED, CAVE, SECRET_NICHE, faceIn, polar, clamp } from './config.js';
import { terrainHeight, JETTY } from './island.js';
import { HATCH } from './tower.js';
import { ORDERS } from './game.js';
import { addLamp } from './lights.js';
import { makeEnv } from './rooms/env.js';
import * as F from './furniture.js';
import { buildStore } from './rooms/store.js';
import { buildKitchen } from './rooms/kitchen.js';
import { buildParlour } from './rooms/parlour.js';
import { buildBedroom } from './rooms/bedroom.js';
import { buildGuest } from './rooms/guest.js';
import { buildStudy } from './rooms/study.js';
import { buildLibrary } from './rooms/library.js';
import { buildWorkshop } from './rooms/workshop.js';
import { buildWatch } from './rooms/watch.js';

const A = (d) => d * DEG;
const toWorld = F.toWorld;
const faceTo = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
const crate = F.crate;

// ------------------------------------------------------------------ build all interiors and their interactions
export function buildInterior(ctx) {
  const { scene, M, col, inter, game, audio } = ctx;
  const S = game.S;
  const rnd = mulberry32(2024);
  const g = new THREE.Group(); g.name = 'interior'; scene.add(g);
  const B = new Builder();
  const T = ctx.tower;
  const interact = (obj, opts) => inter.add(obj, opts);
  const group = (x = 0, y = 0, z = 0, ry = 0) => { const o = new THREE.Group(); o.position.set(x, y, z); o.rotation.y = ry; g.add(o); return o; };
  const atWall = (aDeg, r, y, rot = 0) => { const a = A(aDeg); return [r * Math.cos(a), y, r * Math.sin(a), faceIn(a) + rot]; };
  const pushWall = (aDeg, r, y, rot = 0) => { const [x, yy, z, ry] = atWall(aDeg, r, y, rot); B.push(x, yy, z, ry); };
  const colWall = (aDeg, r, w, d, y0, y1, rot = 0) => { const [x, , z, ry] = atWall(aDeg, r, 0, rot); return col.addBox(x, z, w, d, ry, y0, y1); };

  // everything a room module needs: the shared builder, the placement helpers, and the game hooks
  const env = makeEnv(ctx, B, g);
  const X = { ctx, B, g, env, rnd, S, T, M, col, game, audio, interact, group, atWall, pushWall, colWall, toWorld, A, faceTo, ORDERS, Builder, addLamp, fab: F.fab, logEntry };

  // ================================================================ THE TOWER'S ROOMS (see rooms/)
  buildStore(X);
  buildKitchen(X);
  buildParlour(X);
  buildBedroom(X);
  buildGuest(X);
  buildStudy(X);
  buildLibrary(X);
  buildWorkshop(X);
  buildWatch(X);

  // ================================================================ CELLAR
  {
    const y = CELLAR_Y;
    // hanging storm lantern
    B.cyl(0.006, 0.006, 1.0, M.ironBlack, -2.0, 6.2, 1.5, 4);
    B.cyl(0.08, 0.1, 0.05, M.ironBlack, -2.0, 5.6, 1.5, 10); B.cyl(0.1, 0.08, 0.05, M.ironBlack, -2.0, 5.3, 1.5, 10);
    const cl = new THREE.Mesh(cylGeo(0.07, 0.08, 0.24, 10), M.lampGlass); cl.position.set(-2.0, 5.45, 1.5); g.add(cl);
    addLamp(ctx, -2.0, 5.4, 1.5, { color: 0xffa050, base: 4, dist: 10, flicker: 0.15 });
    // cistern
    const [cx, , cz] = atWall(48, 2.75, 0);
    B.add(lathe([[0.001, 0], [0.85, 0], [0.92, 0.8], [0.88, 1.6], [0.001, 1.6]], 24), M.woodDark, cx, y, cz);
    for (const t of [0.15, 0.5, 0.85]) B.add(new THREE.TorusGeometry(0.89 + Math.sin(t * Math.PI) * 0.04, 0.015, 4, 30), M.ironBlack, cx, y + t * 1.6, cz, Math.PI / 2);
    B.cyl(0.05, 0.05, 0.3, M.brass, cx + 0.7, y + 0.35, cz + 0.4, 8, Math.PI / 2, 0.5);
    col.addCircle(cx, cz, 0.95, y, y + 2);
    // wine rack & casks
    pushWall(140, 3.75, y);
    B.box(1.4, 1.6, 0.4, M.woodDark, 0, 0.8, 0.0);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) if (rnd() < 0.7) B.cyl(0.04, 0.04, 0.3, M.glassBottle, -0.55 + j * 0.22, 0.25 + i * 0.38, 0.22, 8, Math.PI / 2);
    B.pop(); colWall(140, 3.75, 1.45, 0.5, y, y + 2);
    for (const a of [168, 185]) { pushWall(a, 3.4, y, Math.PI / 2); B.add(lathe([[0.001, 0], [0.32, 0], [0.38, 0.4], [0.32, 0.8], [0.001, 0.8]], 16), M.wood, 0, 0.38, -0.4, Math.PI / 2); B.pop(); const [x, , z] = atWall(a, 3.4, 0); col.addCircle(x, z, 0.42, y, y + 1); }
    // old nets & broken crates
    pushWall(318, 3.4, y); crate(B, M, 0.5); B.pop(); colWall(318, 3.4, 0.55, 0.55, y, y + 0.6);
    pushWall(330, 3.45, y, 0.6); crate(B, M, 0.42); B.pop();
    for (let i = 0; i < 5; i++) { const [x, , z] = atWall(300 + i * 4, 3.6, 0); B.add(new THREE.SphereGeometry(0.25, 8, 6), M.rope, x, y + 0.1, z, 0, 0, 0, 1.4, 0.4, 1.0); }
    // loose stone with the sovereigns
    {
      const [x, , z, ry] = atWall(212, R_IN - 0.02, y + 1.35);
      const o = group(x, y + 1.35, z, ry);
      const st = new THREE.Mesh(boxGeo(0.42, 0.26, 0.12, 0.6), M.cellarRock); st.position.z = 0.04; o.add(st);
      const cav = new THREE.Mesh(boxGeo(0.4, 0.24, 0.02, 0.6), M.black); cav.position.z = -0.01; cav.visible = false; o.add(cav);
      let pulled = false;
      interact(o, { assist: true, range: 2.2, prompt: () => pulled ? null : 'One stone stands proud of the others. Pull it free', hold: 1.6, onHold: () => { if (Math.random() < 0.15) audio.stoneScrape(); }, action: () => { pulled = true; st.position.set(0.1, -1.2, 0.5); st.rotation.set(0.6, 0.3, 0.2); cav.visible = true; audio.thud(); setTimeout(() => game.findTreasure('sovereigns'), 500); } });
    }
    // boards nailed across the tunnel
    {
      const [x, , z, ry] = atWall(270, R_IN - 0.03, y);
      const o = group(x, y, z, ry);
      const b = new Builder();
      for (let k = 0; k < 5; k++) b.box(1.75, 0.22, 0.04, M.woodDark, (rnd() - 0.5) * 0.1, 0.3 + k * 0.42, 0.0, 0, 0, (rnd() - 0.5) * 0.12, 0.8);
      b.build(o);
      const seg = colWall(270, R_IN - 0.05, 1.8, 0.1, y - 1, y + 2.4);
      interact(o, {
        prompt: () => S.boardsPried ? null : game.has('crowbar') ? 'Pry the boards off with the crowbar' : 'Boards nailed across an opening. A cold draught whistles through…',
        hold: 2.5, onHold: () => { if (Math.random() < 0.12) audio.creak(0.5); },
        action: () => {
          if (!game.has('crowbar')) { game.toast('They\'re nailed fast. You need something to <b>pry</b> them off with. Perhaps the oil store has a tool.'); return; }
          S.boardsPried = true; o.visible = false; seg.forEach(s => (s.on = false)); audio.thud(); audio.thud();
          game.toast('The boards give way. Behind them, a <b>rough tunnel</b> slopes down into the rock, smelling of the sea.');
        },
      });
      // make the boards non-blocking for a no-crowbar hold (needs instant feedback)
      o.userData.inter.hold = 0; // replaced dynamically below
      ctx.onUpdate(() => { o.userData.inter.hold = game.has('crowbar') ? 2.5 : 0; });
    }
  }

  // ================================================================ SEA CAVE
  {
    const y = CAVE.y;
    // smugglers' chest with the spyglass
    {
      const x = CAVE.x - 2.1, z = CAVE.z - 0.6, ry = 1.2;
      const o = group(x, y, z, ry);
      const b = new Builder();
      b.box(0.9, 0.45, 0.55, M.woodDark, 0, 0.25, 0, 0, 0, 0, 0.6);
      for (const sx of [-0.3, 0.3]) b.box(0.05, 0.47, 0.57, M.ironBlack, sx, 0.25, 0);
      b.box(0.08, 0.1, 0.03, M.brass, 0, 0.38, 0.29);
      b.build(o);
      const lid = new THREE.Group(); lid.position.set(0, 0.48, -0.27); o.add(lid);
      const lb = new Builder(); lb.add(new THREE.CylinderGeometry(0.28, 0.28, 0.9, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(Math.PI / 2), M.woodDark, 0, 0, 0.27, 0, 0, 0); lb.build(lid);
      const glass = new THREE.Group(); glass.position.set(0, 0.35, 0); o.add(glass);
      const gb = new Builder(); gb.cyl(0.035, 0.03, 0.5, M.brass, 0, 0, 0, 12, 0, 0, Math.PI / 2); gb.cyl(0.042, 0.042, 0.06, M.brass, 0.25, 0, 0, 12, 0, 0, Math.PI / 2); gb.build(glass); glass.visible = false;
      col.addBox(x, z, 0.95, 0.6, ry, y - 1, y + 0.6);
      let open = false, taken = false;
      interact(o, {
        assist: true,
        prompt: () => !open ? 'Open the old sea chest' : !taken ? 'Take the brass spyglass' : null,
        action: () => {
          if (!open) { open = true; audio.creak(0.7); glass.visible = true; const t0 = ctx.time; const u = ctx.onUpdate(() => { lid.rotation.x = -Math.min(1.9, (ctx.time - t0) * 2.5); }); }
          else { taken = true; glass.visible = false; game.findTreasure('spyglass'); }
        },
      });
    }
    // ledge with the journal, and what's left of its writer
    {
      const x = CAVE.x - 0.9, z = CAVE.z - 3.0;
      B.add(new THREE.IcosahedronGeometry(0.55, 1), M.cellarRock, x, y + 0.25, z, 0, 0, 0, 1.3, 0.7, 0.9);
      col.addCircle(x, z, 0.6, y - 1, y + 0.7);
      const o = group(x, y + 0.62, z, 0.4);
      const b = new Builder(); b.box(0.22, 0.05, 0.3, M.leather, 0, 0.025, 0); b.box(0.2, 0.04, 0.28, M.candle, 0.01, 0.03, 0); b.build(o);
      interact(o, { assist: true, prompt: () => game.treasures.has('journal') ? null : 'A water-stained journal', action: () => { o.visible = false; game.findTreasure('journal'); } });
      B.add(new THREE.SphereGeometry(0.11, 12, 10), M.candle, x + 0.55, y + 0.1, z + 0.45, 0, 0, 0, 1, 0.9, 1.15);
      B.add(new THREE.SphereGeometry(0.06, 8, 6), M.black, x + 0.5, y + 0.12, z + 0.53);
      B.add(new THREE.SphereGeometry(0.06, 8, 6), M.black, x + 0.6, y + 0.12, z + 0.53);
      for (let i = 0; i < 5; i++) B.cyl(0.018, 0.022, 0.35 + rnd() * 0.2, M.candle, x + 0.2 + rnd() * 0.8, y + 0.03, z + 0.6 + rnd() * 0.5, 6, Math.PI / 2, rnd() * 3);
      B.cyl(0.08, 0.1, 0.25, M.ironBlack, x - 0.4, y + 0.12, z + 0.5, 8);
    }
    for (const [x, z] of [[-2.6, -11.7], [-3.2, -12.6]]) { B.add(lathe([[0.001, 0], [0.28, 0], [0.33, 0.35], [0.28, 0.7], [0.001, 0.7]], 14), M.woodDark, x, y, z); col.addCircle(x, z, 0.35, y - 1, y + 1); }
  }


  // ================================================================ LANTERN ROOM & GALLERY
  {
    const lens = T.lens;
    const burnerHit = new THREE.Group(); burnerHit.position.set(0, LENS_Y - 0.3, 0); g.add(burnerHit);
    burnerHit.add(new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 8), new THREE.MeshBasicMaterial({ visible: false })));
    interact(burnerHit, {
      range: 2.8,
      prompt: () => {
        if (S.lampLit) return null;
        if (!S.fuelFilled) return 'The lamp. Its reservoir below is dry.';
        if (S.pressure < 0.98) return 'The lamp. There\'s no pressure in the line.';
        if (!game.has('matches')) return 'The lamp. You need matches.';
        return 'Light the lamp';
      },
      hold: 2.0, onHold: () => { if (Math.random() < 0.05) audio.match(); },
      action: () => {
        if (!S.fuelFilled) { game.toast('Fill the <b>paraffin reservoir</b> in the watch room below first.'); return; }
        if (S.pressure < 0.98) { game.toast('<b>Pump up the pressure</b> at the reservoir in the watch room.'); return; }
        if (!game.has('matches')) { game.toast('You need <b>matches</b>.'); return; }
        S.lampLit = true; S.lampLitAt = game.time; audio.match(); setTimeout(() => audio.whoosh(), 400);
        game.toast('The mantle flares white-hot. <b>Skerryhead Light is lit.</b>', 5); game.refresh();
      },
    });
    ctx.onUpdate(() => { burnerHit.userData.inter.hold = S.fuelFilled && S.pressure >= 0.98 && game.has('matches') && !S.lampLit ? 2.0 : 0; });
    interact(T.lanternDoor.hinge, { prompt: () => T.lanternDoor.open ? 'Close the gallery door' : 'Open the door to the gallery', action: () => { const d = T.lanternDoor; d.open = !d.open; d.seg.on = !d.open; audio.door(); } });
    for (const pane of T.panes) {
      interact(pane.mesh, {
        range: 2.8,
        prompt: () => {
          if (pane.dirt <= 0.02) return null;
          const p = ctx.player.pos; if (Math.hypot(p.x, p.z) < R_GLASS) return 'The salt is on the outside of the glass: step out onto the gallery to scrub it';
          return game.has('rag') ? 'Scrub the salt off the glass' : 'Salt-crusted glass. You need a rag.';
        },
        hold: 2.5, onHold: (dt) => { if (game.has('rag') && Math.hypot(ctx.player.pos.x, ctx.player.pos.z) > R_GLASS) { pane.dirt = Math.max(0.05, pane.dirt - dt / 2.5); pane.mat.opacity = pane.dirt * 0.95; if (Math.random() < 0.2) audio.wipe(); } },
        action: () => {
          if (!game.has('rag') || Math.hypot(ctx.player.pos.x, ctx.player.pos.z) < R_GLASS) { pane.mat.opacity = pane.dirt * 0.95; if (!game.has('rag')) game.toast('There\'s a <b>cleaning rag</b> on the bench in the watch room.'); return; }
          pane.dirt = 0; pane.mesh.visible = false; S.glassCleaned++; game.refresh();
          if (S.glassCleaned >= 6) game.toast('The last pane gleams. The beam blazes out across the sea.');
        },
      });
      ctx.onUpdate(() => { pane.mesh.userData.inter.hold = game.has('rag') && Math.hypot(ctx.player.pos.x, ctx.player.pos.z) > R_GLASS ? 2.5 : 0; });
    }
    // dressing the lantern room: the keeper's drawers with his things, a stool and little table for tea, a shelf of polish and rags
    {
      const apo = R_GLASS * Math.cos(Math.PI / 16);
      const onSide = (i, w, d, h, draw) => {
        const ac = (i + 0.5) / 16 * TAU, rr = apo - 0.05 - d / 2, x = rr * Math.cos(ac), z = rr * Math.sin(ac), ry = faceIn(ac);
        B.push(x, LANTERN_Y, z, ry); draw(); B.pop(); col.addBox(x, z, w, d, ry, LANTERN_Y, LANTERN_Y + h); return { x, z, ry, rr };
      };
      onSide(1, 0.95, 0.5, 0.95, () => {
        F.chestOfDrawers(B, M, 0.95, 0.5, 0.95, M.woodDark);
        B.push(-0.2, 0.95, 0.0); F.bookPile(B, M, 3, rnd); B.pop();
        B.cyl(0.04, 0.045, 0.12, M.brass, 0.2, 1.01, 0.05, 10); B.cyl(0.012, 0.012, 0.12, M.brass, 0.27, 1.0, 0.05, 6, 0, 0, Math.PI / 2 - 0.5);   // oil can with its spout
        B.cbox(0.2, 0.05, 0.14, F.fab(M, 0xd8d0b0), 0.0, 0.975, 0.14, 0, 0.3, 0, 0.5, null, 0.01);
      });
      const tb = onSide(3, 0.7, 0.5, 0.78, () => { F.table(B, M, 0.7, 0.5, 0.75, M.wood); B.push(-0.12, 0.75, 0); F.teapot(B, M, M.ceramicBlue); B.pop(); B.push(0.16, 0.75, 0.05); F.cup(B, M); B.pop(); });
      { const sx = Math.cos((3.5 / 16) * TAU) * 2.0, sz = Math.sin((3.5 / 16) * TAU) * 2.0; B.push(sx, LANTERN_Y, sz, faceTo(sx, sz, tb.x, tb.z)); F.stool(B, M, 0.47); B.pop(); col.addCircle(sx, sz, 0.2, LANTERN_Y, LANTERN_Y + 0.5); }
      onSide(15, 0.9, 0.36, 0.95, () => {
        B.cbox(0.9, 0.04, 0.36, M.woodDark, 0, 0.5, 0, 0, 0, 0, 0.8, null, 0.006); B.cbox(0.9, 0.04, 0.36, M.woodDark, 0, 0.95, 0, 0, 0, 0, 0.8, null, 0.006);
        for (const sx of [-1, 1]) B.cbox(0.04, 0.95, 0.36, M.woodDark, sx * 0.43, 0.475, 0, 0, 0, 0, 0.8, null, 0.006);
        for (let k = 0; k < 3; k++) { B.cyl(0.05, 0.05, 0.04, M.tin, -0.3 + k * 0.14, 0.54, 0.0, 12); B.cyl(0.052, 0.052, 0.01, M.tin, -0.3 + k * 0.14, 0.565, 0.0, 12); }
        B.cbox(0.22, 0.06, 0.16, F.fab(M, 0xe8e0c8), 0.2, 0.98, 0.0, 0, 0.3, 0, 0.5, null, 0.01); B.cbox(0.2, 0.05, 0.14, F.fab(M, 0xc8b890), 0.25, 1.035, 0.0, 0, -0.2, 0, 0.5, null, 0.01);
      });
      const bx = apo * 0.8 * Math.cos((12.2 / 16) * TAU), bz = apo * 0.8 * Math.sin((12.2 / 16) * TAU);
      B.push(bx, LANTERN_Y, bz); B.add(lathe([[0.001, 0], [0.14, 0], [0.17, 0.28], [0.162, 0.28], [0.13, 0.02], [0.001, 0.015]], 14), M.tin); B.pop(); col.addCircle(bx, bz, 0.17, LANTERN_Y, LANTERN_Y + 0.3);
    }
    // compass tin on the gallery
    {
      const p = polar(5.45, A(122), LANTERN_Y);
      const o = group(p.x, p.y, p.z, 0.6);
      const b = new Builder(); b.box(0.14, 0.05, 0.1, M.tin, 0, 0.025, 0); b.build(o);
      interact(o, { assist: true, range: 3.0, prompt: () => game.treasures.has('compass') ? null : 'A small tin, wedged against the railing', action: () => { o.visible = false; game.findTreasure('compass'); } });
    }
  }


  // ================================================================ OIL STORE & FOG SIGNAL
  {
    const { x: sx, z: sz, w, d } = SHED;
    const y = 7.05;
    const x0 = sx - w / 2 + 0.42, x1 = sx + w / 2 - 0.42, z0 = sz - d / 2 + 0.42, z1 = sz + d / 2 - 0.42;
    // bulk tank on its cradle
    B.cyl(0.55, 0.55, 2.4, M.ironRed, sx - 0.6, y + 0.85, z0 + 0.65, 20, 0, 0, Math.PI / 2);
    for (const k of [-0.8, 0.8]) B.box(0.12, 0.35, 0.9, M.woodDark, sx - 0.6 + k, y + 0.17, z0 + 0.65);
    B.cyl(0.03, 0.03, 0.25, M.brass, sx - 0.6, y + 0.2, z0 + 1.2, 8);
    col.addBox(sx - 0.6, z0 + 0.65, 2.5, 1.2, 0, y, y + 1.5);
    for (let k = 0; k < 3; k++) { B.box(0.28, 0.38, 0.18, M.ironRed, sx + 0.9 + k * 0.32, y + 0.19, z0 + 0.3, 0, 0.1 * k, 0); B.cyl(0.03, 0.03, 0.05, M.brass, sx + 0.95 + k * 0.32, y + 0.4, z0 + 0.3, 6); }
    {
      const o = group(sx + 1.3, y, z0 + 0.95, 0.3);
      const b = new Builder(); b.box(0.28, 0.38, 0.18, M.ironRed, 0, 0.19, 0); b.box(0.04, 0.04, 0.16, M.ironBlack, 0, 0.42, 0); b.cyl(0.03, 0.03, 0.05, M.brass, 0.08, 0.4, 0, 6); b.build(o);
      interact(o, { prompt: () => game.has('oilcan') ? null : S.fuelFilled && S.fuel > 0.3 ? null : 'Take a can of paraffin', action: () => { game.give('oilcan'); game.toast('Heavy. You won\'t be running anywhere with this.'); } });
    }
    // fog signal compressor
    const ex = sx - 0.9, ez = z1 - 0.8;
    B.box(1.3, 0.25, 0.8, M.ironBlack, ex, y + 0.12, ez);
    B.box(0.7, 0.55, 0.55, M.ironGreen, ex - 0.15, y + 0.52, ez);
    B.cyl(0.14, 0.16, 0.45, M.ironGreen, ex - 0.15, y + 1.0, ez, 12);
    B.cyl(0.35, 0.35, 1.2, M.ironGreen, x0 + 0.45, y + 0.6, ez + 0.1, 16);
    B.cyl(0.04, 0.04, 2.0, M.ironBlack, x0 + 0.45, y + 2.0, ez + 0.1, 8);
    col.addBox(ex, ez, 1.4, 0.9, 0, y, y + 1.3); col.addCircle(x0 + 0.45, ez + 0.1, 0.38, y, y + 1.3);
    const fly = new THREE.Group(); fly.position.set(ex + 0.45, y + 0.55, ez + 0.3); g.add(fly);
    { const fb = new Builder(); fb.cyl(0.3, 0.3, 0.06, M.ironBlack, 0, 0, 0, 24, Math.PI / 2); for (let k = 0; k < 4; k++) fb.box(0.04, 0.55, 0.03, M.ironBlack, 0, 0, 0.0, 0, 0, k * Math.PI / 4); fb.cyl(0.06, 0.06, 0.12, M.steel, 0, 0, 0, 10, Math.PI / 2); fb.build(fly); }
    const pulley = new THREE.Group(); pulley.position.set(ex - 0.15, y + 0.75, ez + 0.3); g.add(pulley);
    { const pb = new Builder(); pb.cyl(0.1, 0.1, 0.06, M.steel, 0, 0, 0, 16, Math.PI / 2); pb.build(pulley); }
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.015, 4, 30), M.leather); belt.scale.set(1, 0.55, 1); belt.position.set(ex + 0.15, y + 0.65, ez + 0.33); belt.rotation.z = 0.35; belt.visible = false; g.add(belt);
    const crankP = new THREE.Group(); crankP.position.set(ex + 0.45, y + 0.55, ez + 0.36); g.add(crankP);
    { const cb = new Builder(); cb.box(0.04, 0.3, 0.03, M.ironBlack, 0, -0.15, 0); cb.cyl(0.025, 0.025, 0.15, M.woodDark, 0, -0.3, 0.07, 8, Math.PI / 2); cb.build(crankP); }
    const hornP = new THREE.Vector3(sx - w / 2 - 1.5, 10.5, sz);
    let blastT = 3;
    ctx.onUpdate((dt) => {
      if (!S.foghornOn) return;
      fly.rotation.z -= dt * 8; pulley.rotation.z -= dt * 20; crankP.rotation.z = fly.rotation.z;
      blastT -= dt; if (blastT <= 0) { blastT = 30; audio.foghorn(hornP.x, hornP.y, hornP.z); }
    });
    const engHit = group(ex, y + 0.6, ez + 0.2);
    engHit.add(new THREE.Mesh(boxGeo(1.3, 0.9, 0.7), new THREE.MeshBasicMaterial({ visible: false })));
    interact(engHit, {
      prompt: () => {
        if (S.foghornOn) return null;
        if (!S.beltFitted) return game.has('belt') ? 'Fit the drive belt to the compressor' : 'The fog signal compressor. Its drive belt has snapped.';
        return 'Crank the engine to start the fog signal';
      },
      hold: 0, onHold: (dt) => { crankP.rotation.z -= dt * 10; if (Math.random() < 0.2) audio.ratchet(); },
      action: () => {
        if (!S.beltFitted) {
          if (!game.has('belt')) { game.toast('The old belt lies in two pieces. There should be a <b>spare</b> in the tower store room.'); return; }
          S.beltFitted = true; belt.visible = true; game.take('belt'); audio.thud(); game.toast('You stretch the new belt over the pulleys. Now crank her over.'); return;
        }
        S.foghornOn = true; game.refresh(); audio.thud(); blastT = 1.5;
        game.toast('The engine coughs, catches and thumps into life. The great horn bellows out over the water.', 5);
        audio.addLoop('engine', ex, y + 0.6, ez, 0.12, 0.14, (pan) => audio.burst({ buf: audio.brown, type: 'lowpass', f: 220, a: 0.005, d: 0.09, g: 0.5, dest: pan }), 2);
      },
    });
    ctx.onUpdate(() => { engHit.userData.inter.hold = S.beltFitted && !S.foghornOn ? 3.0 : 0; });
    // workbench with the crowbar
    B.box(0.6, 0.85, 1.6, M.woodDark, x0 + 0.3, y + 0.42, sz - 0.2);
    B.box(0.04, 1.0, 1.2, M.woodDark, x0 + 0.02, y + 1.6, sz - 0.2);
    col.addBox(x0 + 0.3, sz - 0.2, 0.6, 1.6, 0, y, y + 0.9);
    {
      const o = group(x0 + 0.08, y + 1.55, sz - 0.1, Math.PI / 2);
      const b = new Builder(); b.box(0.035, 0.75, 0.025, M.ironBlack, 0, 0, 0); b.box(0.035, 0.1, 0.025, M.ironBlack, 0.03, 0.4, 0, 0, 0, -0.8); b.build(o);
      interact(o, { prompt: () => game.has('crowbar') ? null : 'Take the crowbar', action: () => { game.give('crowbar'); o.visible = false; } });
    }
    B.box(0.3, 0.2, 0.25, M.tin, x0 + 0.3, y + 0.95, sz - 0.6);
    for (let i = 0; i < 6; i++) B.add(new THREE.TorusGeometry(0.25 - i * 0.012, 0.025, 6, 18), M.rope, x1 - 0.4, y + 0.03 + i * 0.045, z1 - 0.4, Math.PI / 2);
    // hanging lamp
    B.cyl(0.006, 0.006, 0.5, M.ironBlack, sx + 0.3, y + 2.5, sz, 4);
    const gl = new THREE.Mesh(cylGeo(0.06, 0.08, 0.18, 10), M.lampGlass); gl.position.set(sx + 0.3, y + 2.15, sz); g.add(gl);
    addLamp(ctx, sx + 0.3, y + 2.1, sz, { base: 4.5, dist: 9, flicker: 0.12 });
  }

  // ================================================================ OUTSIDE: boat & bottle
  {
    const boat = ctx.boat;
    const tin = new THREE.Mesh(boxGeo(0.16, 0.06, 0.1), M.tin); tin.position.set(0.2, -0.3, -0.6); boat.add(tin);
    interact(tin, { assist: true, range: 3.2, prompt: () => game.treasures.has('pearls') ? null : 'Something glints under the thwart', action: () => { tin.visible = false; game.findTreasure('pearls'); } });
    ctx.onUpdate((dt, t) => {
      const b = boat.position; const h = ctx.waveH(b.x, b.z);
      const hf = ctx.waveH(b.x, b.z + 1.5), hs = ctx.waveH(b.x + 0.6, b.z);
      boat.position.y += (h + 0.25 - boat.position.y) * Math.min(1, dt * 3);
      boat.rotation.x += ((hf - h) * 0.4 - boat.rotation.x) * Math.min(1, dt * 3);
      boat.rotation.z += (-(hs - h) * 0.6 - boat.rotation.z) * Math.min(1, dt * 3);
    });
    const bx = 3.7, bz = 26.2, by = terrainHeight(bx, bz);
    const o = group(bx, by + 0.06, bz, 0.8);
    const b = new Builder(); b.add(lathe([[0.001, 0], [0.06, 0], [0.065, 0.02], [0.065, 0.2], [0.03, 0.26], [0.016, 0.29], [0.016, 0.33], [0.001, 0.33]], 12), M.glassBottle, 0, 0.06, 0, 0, 0, Math.PI / 2 - 0.2); b.build(o);
    interact(o, { assist: true, range: 2.8, prompt: () => game.treasures.has('message') ? null : 'A bottle, wedged between the rocks', action: () => { o.visible = false; game.findTreasure('message'); } });
  }

  B.build(g, { name: 'interior-static' });
}

function logEntry(game) {
  const S = game.S, n = game.treasures.size;
  return `<h2>Skerryhead Light — Journal</h2>
<p><em>In your own hand, beneath your predecessor's last entry:</em></p>
<p>"Oct. 10th. Wind NW, whole gale, veering. Barometer 28.3 and falling. Heavy sea breaking over the landing. Relief boat unable to land.</p>
<p>Light exhibited at dusk${S.glassCleaned >= 6 ? ', glass cleaned of salt' : ''}. Fog signal run through the night. Broken casement in the bedroom boarded.</p>
<p>At the height of the gale the SS <b>Aurora</b> called on the wireless, lost and near the reef. Guided her south by the light and the horn. She is safe in open water.${S.tea ? ' Tea taken at 2 a.m.' : ''}</p>
<p>${n >= 8 ? 'I have found all of Elias Marrow\'s secrets now. The Marianne may rest. ' : n > 0 ? `Strange things about this old tower: ${n} relics of the keeper Marrow found so far. ` : ''}All well."</p>
<p class="sig">— Keeper on watch</p>`;
}
