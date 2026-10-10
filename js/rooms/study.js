import * as THREE from 'three';
import * as F from '../furniture.js';
import { R_IN, SECRET_NICHE, faceIn, polar } from '../config.js';
import { mulberry32 } from '../noise.js';
import { boxGeo, lathe } from '../geom.js';

// Sixth level: the study. Journal desk under the south-west window, the wireless, the barometer, the chart table, and the
// bookcase that hides the alcove. Stairwell opening 314..49, low treads 73..143, corridor 40..73; the nook (143..176)
// holds a low shelf and a filing cabinet. The secret bookcase (247.5 degrees) slides toward lower angles, so that side stays clear.
export function buildStudy(X) {
  const { ctx, B, g, env, rnd, S, T, M, col, game, audio, interact, group, toWorld, A, faceTo, atWall, logEntry } = X;
  const r = env.room(5), y = r.y, W = R_IN - 0.015;
  r.curtains(X.fab(M, 0x7a2a2a, true));

  // ---- bookcases: an ordinary one by the stairs end, and the one that hides the alcove
  r.wall(188, 0.95, 0.4, 2.3, () => F.bookcase(B, M, 0.95, 2.25, rnd, 6), { name: 'bookcase' });
  {
    const a = A(SECRET_NICHE.a);
    const base = polar(3.74, a, y);
    const o = group(base.x, y, base.z, faceIn(a));
    const b = new X.Builder(); F.bookcase(b, M, 1.1, 2.25, mulberry32(77)); b.build(o);
    const redBook = new THREE.Mesh(boxGeo(0.045, 0.27, 0.24, 0.4), new THREE.MeshStandardMaterial({ color: 0x8a1010, roughness: 0.5 })); redBook.position.set(0.3, 0.08 + 3 * (2.25 - 0.15) / 5 + 0.15, 0.17); o.add(redBook);
    const segs = col.addBox(base.x, base.z, 1.1, 0.4, faceIn(a), y, y + 2.3);
    const slideDir = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), faceIn(a)).multiplyScalar(-1);   // toward lower angles
    let t0 = null;
    interact(redBook, {
      range: 2.2, prompt: () => S.secretOpen ? null : 'One red book sits a little proud. Pull it',
      action: () => {
        S.secretOpen = true; redBook.rotation.x = -0.4; audio.click(); setTimeout(() => audio.stoneScrape(), 300);
        t0 = ctx.time; segs.forEach(s => (s.on = false));
        const np = base.clone().addScaledVector(slideDir, 1.15);
        col.addBox(np.x, np.z, 1.1, 0.4, faceIn(a), y, y + 2.3);
        game.toast('With a click and a grinding of stone, the bookcase swings aside, revealing a <b>hidden alcove</b>.', 5);
      },
    });
    ctx.onUpdate(() => { if (t0 === null) return; const k = Math.min(1, (ctx.time - t0) / 2.2); const e = k * k * (3 - 2 * k); o.position.copy(base).addScaledVector(slideDir, 1.15 * e); });
    // the alcove: a little ship in a bottle on a stand
    const np = polar(R_IN + 0.35, a, y + 1.0);
    B.box(0.9, 0.04, 0.5, M.woodDark, np.x, np.y, np.z, 0, faceIn(a), 0);
    const sh = group(np.x, np.y + 0.02, np.z, faceIn(a) + Math.PI / 2);
    const sb = new X.Builder();
    sb.add(lathe([[0.001, 0], [0.08, 0], [0.085, 0.02], [0.085, 0.3], [0.05, 0.36], [0.025, 0.4], [0.025, 0.45], [0.001, 0.45]], 16), M.glassBottle, 0, 0.09, 0, 0, 0, Math.PI / 2);
    sb.box(0.25, 0.03, 0.03, M.woodDark, -0.1, 0.03, 0.04); sb.box(0.25, 0.03, 0.03, M.woodDark, -0.1, 0.03, -0.04);
    sb.box(0.22, 0.04, 0.05, M.woodDark, -0.22, 0.08, 0); sb.box(0.004, 0.12, 0.004, M.woodDark, -0.2, 0.15, 0); sb.box(0.004, 0.1, 0.004, M.woodDark, -0.27, 0.14, 0);
    sb.box(0.003, 0.08, 0.05, M.paintWhite, -0.2, 0.15, 0); sb.cyl(0.02, 0.02, 0.03, M.cork, 0.33, 0.09, 0, 8, 0, 0, Math.PI / 2);
    sb.build(sh);
    interact(sh, { range: 2.4, prompt: () => !S.secretOpen || game.treasures.has('bottleShip') ? null : 'Take the ship in the bottle', action: () => { sh.visible = false; game.findTreasure('bottleShip'); } });
  }

  // ---- the keeper's desk under the window, with the journal and a lamp
  const deskA = 208;
  const ds = r.wall(deskA, 1.4, 0.7, 0.85, () => {
    F.desk(B, M, 1.4, 0.7, 0.78);
    B.cyl(0.035, 0.04, 0.05, M.glassBottle, -0.5, 0.81, -0.12, 10); B.box(0.005, 0.005, 0.2, M.black, -0.44, 0.8, 0.0, 0.3, 0.6, 0);
    for (let k = 0; k < 4; k++) B.box(0.2, 0.003, 0.28, M.paper, -0.52 + rnd() * 0.1, 0.785 + k * 0.003, 0.12, 0, rnd() - 0.5, 0);
  }, { name: 'desk' });
  { const p = toWorld(deskA, ds.r, y + 0.78, 0.5, 0, -0.1); F.tableLamp(ctx, B, p.x, p.y, p.z, 4.6); }
  { const [x, , z] = atWall(deskA, 2.75, 0); r.free(x, z, faceTo(x, z, ds.x, ds.z), 0.46, 0.46, 0.95, () => F.chair(B, M, M.woodDark, X.fab(M, 0x2a3a4a)), { name: 'desk chair', nocheck: true }); }
  {
    const p = toWorld(deskA, ds.r, y + 0.785, 0.0, 0, 0.05);
    const o = group(p.x, p.y, p.z, faceIn(A(deskA)));
    const b = new X.Builder(); b.box(0.5, 0.035, 0.33, M.leather, 0, 0.015, 0); b.build(o);
    const pg = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.31), M.logbook); pg.rotation.x = -Math.PI / 2; pg.position.y = 0.034; o.add(pg);
    interact(o, {
      prompt: () => S.logWritten ? 'Read your entry for tonight' : S.shipState === 'passed' ? (S.baroRead ? 'Write tonight\'s entry in the journal' : 'Write the journal (read the barometer first)') : 'The keeper\'s journal',
      hold: 0, action: () => {
        if (S.shipState !== 'passed') { ctx.ui.showNote(`<h2>Skerryhead Light — Journal</h2><p><em>The last entry, in your predecessor's careful hand:</em></p><p>"Oct. 3rd. Wind SW, fresh. All lamps in order. The cat has taken the good chair again. Barometer falling. Relief due on the 10th."</p><p class="sig">You'll write tonight's entry when the watch is done.</p>`); return; }
        if (!S.baroRead) { game.toast('A proper entry needs the barometer reading. It hangs on the study wall.'); return; }
        if (!S.logWritten) { S.logWritten = true; game.refresh(); ctx.onLogWritten(); }
        ctx.ui.showNote(logEntry(game));
      },
    });
  }
  r.at(deskA, W, 1.9, () => F.painting(B, M, 0.36, 0.45, M.portrait));

  // ---- the wireless set and the barometer
  const rad = r.wall(262, 0.62, 0.45, 1.4, () => {
    B.cbox(0.6, 0.85, 0.42, M.woodDark, 0, 0.425, 0, 0, 0, 0, 0.8, null, 0.01); B.cbox(0.55, 0.5, 0.4, M.wood, 0, 1.12, -0.01, 0, 0, 0, 0.8, null, 0.01);
    B.add(new THREE.PlaneGeometry(0.4, 0.2), M.radioFace, 0, 1.22, 0.195);
    for (const x of [-0.15, 0, 0.15]) B.cyl(0.035, 0.035, 0.03, M.black, x, 1.0, 0.2, 12, Math.PI / 2);
    B.cyl(0.006, 0.006, 0.55, M.brass, 0.18, 1.62, -0.1, 4);
  }, { name: 'wireless' });
  {
    const p = toWorld(262, rad.r, y + 1.1, 0, 0, 0.22);
    const o = group(p.x, p.y, p.z, faceIn(A(262)));
    const hit = new THREE.Mesh(boxGeo(0.56, 0.55, 0.05), new THREE.MeshBasicMaterial({ visible: false })); o.add(hit);
    ctx.onUpdate((dt, t) => { const on = S.radioCalling && !S.radioAnswered; M.radioFace.emissive.setRGB(on ? 0.8 + Math.sin(t * 8) * 0.3 : 0.25, on ? 0.5 : 0.15, 0.05); });
    interact(o, {
      prompt: () => S.radioCalling && !S.radioAnswered ? 'Answer the wireless' : 'Listen to the wireless',
      action: () => {
        if (!(S.radioCalling && !S.radioAnswered)) { audio.radioBurst(2); game.toast('Nothing but static and the moan of the gale in the aerial.'); return; }
        S.radioAnswered = true; S.shipState = 'approach'; game.refresh();
        game.radio([
          ['SS Aurora', 'Skerryhead Light, Skerryhead Light, this is the steamer Aurora. Do you read? Over.', 4.5],
          ['You', 'Aurora, Skerryhead. Reading you. Go ahead.', 3],
          ['SS Aurora', "We've lost our bearings in this muck and our compass is playing up. We're making for the Sound.", 4.5],
          ['SS Aurora', "We'll need your light turning bright and your fog signal sounding to clear the reef. Over.", 4.5],
          ['You', "Understood, Aurora. Keep her well to the south. I'll keep the light.", 3.5],
        ]);
      },
    });
  }
  const baroA = 273;
  r.at(baroA, W, 1.8, () => { B.add(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 28).rotateX(Math.PI / 2), M.woodDark, 0, 0, 0.025); B.add(new THREE.TorusGeometry(0.15, 0.015, 6, 28), M.brass, 0, 0, 0.055); B.add(new THREE.CircleGeometry(0.14, 28), M.baroFace, 0, 0, 0.056); });
  {
    const p = toWorld(baroA, W, y + 1.8, 0, 0, 0.06);
    const o = group(p.x, p.y, p.z, faceIn(A(baroA)));
    const needle = new THREE.Mesh(boxGeo(0.006, 0.12, 0.004), M.black); needle.geometry.translate(0, 0.05, 0); needle.rotation.z = 1.6; o.add(needle);
    const hit = new THREE.Mesh(new THREE.CircleGeometry(0.17, 12), new THREE.MeshBasicMaterial({ visible: false })); o.add(hit);
    interact(o, { prompt: () => 'Tap the barometer', action: () => { audio.click(); needle.rotation.z = 1.75; setTimeout(() => (needle.rotation.z = 1.85), 150); S.baroRead = true; game.refresh(); game.toast('<b>28.3 inches</b> and still falling. The needle quivers at STORMY.'); } });
    ctx.onUpdate((dt, t) => { if (!S.baroRead) needle.rotation.z = 1.6 + Math.sin(t * 0.3) * 0.01; });
  }

  // ---- window bench, telescope and globe at the north-west window
  r.wall(285, 1.15, 0.45, 0.5, () => {
    B.cbox(1.1, 0.42, 0.42, M.woodDark, 0, 0.21, 0, 0, 0, 0, 0.7, null, 0.01);
    F.cushion(B, M, 0x2a3a4a, 0, 0.46, 0, 1.0, 0.4); F.cushion(B, M, 0x7a2a2a, -0.33, 0.55, -0.1, 0.32, 0.26, -0.4);
  }, { name: 'window bench' });
  { const [x, , z] = atWall(298, 3.2, 0); r.round(x, z, 0.3, 1.4, () => F.telescope(B, M), { name: 'telescope' }); }
  { const [x, , z] = atWall(307, 3.3, 0); r.round(x, z, 0.26, 1.3, () => F.globe(B, M), { name: 'globe' }); }

  // ---- the chart table in the open middle, on a patterned rug
  const [chx, , chz] = atWall(335, 1.35, 0);
  const chr = -A(335);
  r.flat(chx, chz, chr, () => F.rugAt(B, M.rug, 0, 0, 0, 2.3, 1.5, 0));
  r.free(chx, chz, chr, 1.2, 0.8, 1.0, () => F.table(B, M, 1.2, 0.8, 0.95, M.woodDark), { name: 'chart table' });
  {
    const o = group(chx, y + 0.952, chz, chr);
    const c = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.72), M.chart); c.rotation.x = -Math.PI / 2; o.add(c);
    const b = new X.Builder(); b.box(0.02, 0.02, 0.18, M.brass, 0.2, 0.01, 0.1, 0, 0.4, 0); b.box(0.02, 0.02, 0.18, M.brass, 0.25, 0.01, 0.1, 0, 0.7, 0); b.build(o);
    interact(o, { prompt: () => 'Study the chart', action: () => ctx.ui.showNote(`<h2>Skerry Sound & Approaches</h2><p>Soundings in fathoms. Skerryhead light: <b>two white flashes every twenty seconds</b>, visible eighteen miles. Fog signal: one blast every thirty seconds.</p><p>A dotted red line marks the safe passage south of the reef. In pencil, in the margin, someone has written: <em>"Cave below N. face. Count the stones from the cistern: twelve paces, then down."</em></p>`) });
  }
  F.hangingLamp(ctx, B, chx, y + 2.44, chz, 0.5, 4.0);

  // ---- the reading corner: armchair, side table and lamp, a rag rug
  const ax = Math.cos(A(184)) * 2.15, az = Math.sin(A(184)) * 2.15;
  r.flat(ax + 0.2, az, 0, () => F.rugRound(B, M.ragRug, 0, 0, 0, 1.0));
  r.free(ax, az, faceTo(ax, az, 0.8, -0.2), 0.85, 0.8, 1.0, () => F.armchair(B, M, 0x2a4a3a), { name: 'armchair' });
  { const sx = ax + 0.15, sz = az - 0.85; r.round(sx, sz, 0.22, 0.56, () => F.sideTable(B, M), { name: 'side table', nocheck: true }); F.tableLamp(ctx, B, sx, y + 0.56, sz, 3.4); B.push(sx + 0.05, y + 0.56, sz); F.cup(B, M); B.pop(); }

  // ---- the nook under the stairs: a low shelf and a filing cabinet
  r.wall(151, 1.0, 0.34, 1.5, () => F.bookcase(B, M, 1.0, 1.45, rnd, 4), { name: 'low shelf' });
  r.wall(165, 0.8, 0.45, 0.9, () => F.chestOfDrawers(B, M, 0.8, 0.45, 0.9, M.woodDark), { name: 'filing cabinet' });
  r.at(165, W, 1.35, () => F.painting(B, M, 0.5, 0.36, M.painting));
}
