import * as THREE from 'three';
import { generateTextures } from './textures.js';
import { createMaterials } from './materials.js';
import { CollisionWorld } from './collision.js';
import { buildIsland, makeIslandTexture, terrain, terrainHeight } from './island.js';
import { buildTower } from './tower.js';
import { buildInterior } from './interior.js';
import { Ocean, waveHeight } from './ocean.js';
import { Weather } from './weather.js';
import { MOON_DIR } from './sky.js';
import { Post } from './post.js';
import { LightRig } from './lights.js';
import { Player } from './player.js';
import { Interaction } from './interact.js';
import { Game, Ship, TREASURES } from './game.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';
import { LENS_Y, R_GLASS, LANTERN_Y } from './config.js';

const store = {
  get(k, d) { try { const v = localStorage.getItem('skerry.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('skerry.' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

const ZONES = {
  store: 'The Store Room', kitchen: 'The Kitchen', bedroom: "The Keeper's Bedroom", study: 'The Study', watch: 'The Watch Room',
  lantern: 'The Lantern Room', gallery: 'The Gallery', cellar: 'The Cellar', cave: "The Smugglers' Cave", shed: 'The Oil Store', outside: 'Skerryhead Rock',
};

const $ = (id) => document.getElementById(id);
const setLoad = (p, msg) => { $('loadfill').style.width = `${Math.round(p * 100)}%`; if (msg) $('loadmsg').textContent = msg; };

async function main() {
  const qualityName = store.get('quality', 'high');
  const quality = { name: qualityName, shadows: qualityName === 'high', bloom: qualityName !== 'low', ao: qualityName === 'high', pixelRatio: qualityName === 'high' ? Math.min(devicePixelRatio, 1.5) : 1 };
  const settings = { sens: store.get('sens', 1) };

  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(quality.pixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.NoToneMapping; // tone mapping and grading happen in the post composite
  renderer.toneMappingExposure = 1.2; // the exposure the composite reads
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // shadow maps are refreshed per light (light.shadow.needsUpdate) rather than every frame
  $('app').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // sea haze: pale enough that distant rock and swell fade *into* the horizon glow rather than to black
  const fogBase = new THREE.Color().setRGB(0.026, 0.034, 0.047, THREE.LinearSRGBColorSpace);
  scene.fog = new THREE.FogExp2(fogBase.clone(), 0.0085);
  scene.background = fogBase.clone();
  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.03, 1500);
  scene.add(camera);

  const ui = new UI();
  const audio = new AudioEngine();
  const updaters = [];
  const ctx = {
    scene, renderer, camera, quality, settings, ui, audio,
    occluders: [], lights: [], time: 0,
    fogBase, fogFlash: new THREE.Color().setRGB(0.26, 0.31, 0.46, THREE.LinearSRGBColorSpace), fogDawn: new THREE.Color().setRGB(0.12, 0.10, 0.105, THREE.LinearSRGBColorSpace),
    onUpdate: (fn) => { updaters.push(fn); return fn; },
    waveH: (x, z) => waveHeight(x, z, ctx.time),
  };
  window.skerry = ctx;
  // debug helper: skerry.view(x, y, z, yaw, pitch) parks a frozen camera
  ctx.view = (x, y, z, yaw, pitch = 0) => { ctx.freeze = true; ctx.player.pos.set(x, y, z); ctx.player.yaw = yaw; ctx.player.pitch = pitch; };

  setLoad(0.02, 'Quarrying granite…');
  const T = await generateTextures((p, name) => setLoad(0.05 + p * 0.65, {
    plaster: 'Whitewashing the walls…', stoneWhite: 'Laying the courses…', planks: 'Sawing floorboards…', rock: 'Weathering the rock…', copper: 'Greening the copper…', rug: 'Weaving rugs…', quilt: 'Stitching the quilt…',
  }[name] || undefined));
  ctx.T = T;
  const M = createMaterials(T, renderer);
  ctx.M = M;
  setLoad(0.72, 'Raising the island…');
  await tick();
  ctx.island = makeIslandTexture();
  const col = new CollisionWorld(); col.terrain = terrain; ctx.col = col;
  const game = new Game(ctx); ctx.game = game;
  const inter = new Interaction(ctx, camera); ctx.inter = inter;
  const weather = new Weather(ctx); ctx.weather = weather;
  buildIsland(ctx);
  setLoad(0.8, 'Building the tower…');
  await tick();
  buildTower(ctx);
  const player = new Player(ctx, camera); ctx.player = player;
  setLoad(0.86, 'Furnishing the rooms…');
  await tick();
  buildInterior(ctx);
  const ocean = new Ocean(ctx); ctx.ocean = ocean;
  ctx.ship = new Ship(ctx);

  // lighting
  const hemi = new THREE.HemisphereLight(0x46627f, 0x14110e, 0.5);
  scene.add(hemi);
  // moonlight through the cloud deck: cool, strong enough to model rock and tower, and (on High) shadowed so it
  // cannot leak into the rooms. The shadow map never changes, so it is rendered once.
  const moon = new THREE.DirectionalLight(0x93a9d8, 0.5);
  moon.position.copy(MOON_DIR).multiplyScalar(120).add(new THREE.Vector3(0, 12, 0));
  moon.target.position.set(0, 12, 0);
  scene.add(moon, moon.target);
  if (quality.shadows) {
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    const mc = moon.shadow.camera; mc.left = -58; mc.right = 58; mc.top = 58; mc.bottom = -58; mc.near = 20; mc.far = 260;
    moon.shadow.bias = -0.0005; moon.shadow.normalBias = 0.06; moon.shadow.radius = 2;
    moon.shadow.autoUpdate = false; moon.shadow.needsUpdate = true;
  }
  ctx.moon = moon; ctx.hemi = hemi;
  const rig = new LightRig(ctx); ctx.rig = rig;
  rig.addExtra(ctx.tower.lens.lampLight); // the lens lamp can borrow a shadow slot too (lens bars sweeping the room)
  ctx.refreshShadows = () => { if (quality.shadows) moon.shadow.needsUpdate = true; };

  // post-processing: HDR scene target -> AO -> bloom -> composite (tone map, grade, lens drops, grain)
  const post = new Post(renderer, scene, camera, quality);
  ctx.post = { wet: 0, fx: post };

  // ---- interaction with the page
  let locked = false, started = false, ended = false;
  const lock = () => {
    if (ui.noteOpen) return;
    const r = renderer.domElement.requestPointerLock();
    if (r && r.catch) r.catch(() => { if (started) $('pause').classList.remove('hidden'); });
  };
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === renderer.domElement;
    player.enabled = locked;
    if (started) $('pause').classList.toggle('hidden', locked || ui.noteOpen || !$('journal').classList.contains('hidden') || !$('ending').classList.contains('hidden'));
  });
  renderer.domElement.addEventListener('click', () => { if (started && !locked) lock(); });
  $('pause').addEventListener('click', () => { $('pause').classList.add('hidden'); lock(); });
  ui.onCloseNote = () => { if (started && !ended) lock(); };
  addEventListener('keydown', (e) => {
    if (!started) return;
    if (e.code === 'KeyJ' || e.code === 'Tab') {
      e.preventDefault();
      const on = ui.toggleJournal();
      if (on) document.exitPointerLock(); else lock();
    }
    if ((e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') && ui.noteOpen) { e.preventDefault(); ui.closeNote(); }
  });
  $('journal').addEventListener('click', () => { ui.toggleJournal(false); lock(); });

  const qsel = $('quality'); qsel.value = qualityName;
  qsel.addEventListener('change', () => { store.set('quality', qsel.value); location.reload(); });
  const sens = $('sens'); sens.value = settings.sens;
  sens.addEventListener('input', () => { settings.sens = +sens.value; store.set('sens', settings.sens); });

  ui.setTreasures(0, Object.keys(TREASURES).length);
  ui.setJournal(game.treasures);
  game.refresh();
  ui.setStatus(game.S, 0);

  $('begin').addEventListener('click', () => {
    audio.init();
    $('menu').classList.add('hidden');
    $('hud').classList.remove('hidden');
    started = true; game.started = true;
    lock();
    setTimeout(() => ui.toast('Find the <b>matches</b> and light the stove. Read the <b>standing orders</b> on the table.', 7), 1200);
    setTimeout(() => ui.location(ZONES.kitchen), 400);
  });

  ctx.onLogWritten = () => {
    ended = true;
    const t0 = ctx.time;
    ctx.onUpdate(() => { weather.calm = Math.min(1, (ctx.time - t0) / 90); });
    const prev = ui.onCloseNote;
    ui.onCloseNote = () => {
      ui.onCloseNote = prev;
      const n = game.treasures.size;
      $('endStats').innerHTML = `The Aurora is safe. The light burned all night.<br>Time on watch: <b>${Math.floor(game.time / 60)} min</b> &nbsp;·&nbsp; Relics of Elias Marrow: <b>${n} / ${Object.keys(TREASURES).length}</b>${n < 8 ? '<br><small>The tower still keeps some of its secrets…</small>' : '<br><small>You have uncovered every one of Marrow\'s secrets.</small>'}`;
      $('ending').classList.remove('hidden');
    };
  };
  $('continue').addEventListener('click', () => { $('ending').classList.add('hidden'); ended = false; lock(); });

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    post.setSize();
  });

  // ---- warm up
  setLoad(0.94, 'Lighting the lamps…');
  await tick();
  player.update(0.016);
  if (renderer.compileAsync) { try { await renderer.compileAsync(scene, camera); } catch { /* fall back to lazy compile */ } }
  ctx.refreshShadows();
  weather.light.shadow.needsUpdate = true;
  post.render();
  setLoad(1, 'Ready.');
  $('loading').classList.add('hidden');
  $('menu').classList.remove('hidden');

  // ---- main loop
  const clock = new THREE.Clock();
  let lensAngle = 0;
  const fwd = new THREE.Vector3(), tmp = new THREE.Vector3();
  const lensPos = new THREE.Vector3(0, LENS_Y, 0);
  let outK = 1, frames = 0;
  const frame = (fixedDt) => {
    const dt = fixedDt ?? Math.min(clock.getDelta(), 0.05);
    ctx.time += dt;
    const t = ctx.time;
    const S = game.S;
    player.update(dt);
    inter.update(dt, (locked || ctx.debugInteract) && started);
    game.update(dt);
    for (const fn of updaters) fn(dt, t);
    weather.update(dt, t, camera, player.indoor);

    // lighthouse optic
    const beamI = game.beamIntensity();
    if (S.clockwork > 0) lensAngle += dt * 0.314;
    const lens = ctx.tower.lens;
    lens.group.rotation.y = lensAngle;
    lens.mantle.visible = S.lampLit;
    lens.lampLight.intensity = S.lampLit ? 6 + 22 * beamI : 0;
    lens.lensPanelMat.emissiveIntensity = S.lampLit ? 0.25 + beamI * 0.9 : 0;
    lens.beamMat.uniforms.uI.value = beamI * (1 - weather.calm * 0.5);
    const bAng = -lensAngle;
    tmp.copy(camera.position).sub(lensPos); const dist = tmp.length(); tmp.y = 0; tmp.normalize();
    const align = Math.max(Math.cos(bAng) * tmp.x + Math.sin(bAng) * tmp.z, -Math.cos(bAng) * tmp.x - Math.sin(bAng) * tmp.z);
    const inLantern = Math.hypot(camera.position.x, camera.position.z) < R_GLASS && camera.position.y > LANTERN_Y;
    const fl = beamI * Math.pow(Math.max(0, align), 50) * (inLantern ? 0 : 1);
    lens.flareMat.opacity = Math.min(1, fl * 1.2);
    const fs = (6 + fl * 60) * Math.min(1, dist / 30 + 0.3); lens.flare.scale.set(fs, fs, 1);
    ocean.update(t, weather.flash, beamI, bAng);
    weather.rainU.uBeam.value = fl;

    // flickering lamps
    for (let i = 0; i < ctx.lights.length; i++) {
      const l = ctx.lights[i];
      const on = l.on ? l.on() : true;
      const f = 1 + (Math.sin(t * 9.1 + i * 3.7) * 0.4 + Math.sin(t * 23.3 + i) * 0.35 + (Math.random() - 0.5) * 0.5) * l.flicker;
      l.light.intensity = on ? l.base * f : 0;
      if (l.flame) l.flame.scale.set(1, 2 * (0.9 + (f - 1) * 1.5), 1);
    }
    // ambient: dim inside, brighter outside & at dawn. Without shadow maps the moon would shine through the walls,
    // so on Low/Medium it is faded out indoors instead.
    outK += ((player.indoor ? 0 : 1) - outK) * Math.min(1, dt * 2.5);
    ctx.outK = outK;
    hemi.intensity = (0.5 + weather.flash * 1.5) * (0.25 + 0.75 * outK) + weather.calm * 0.6;
    moon.intensity = (0.10 + 0.75 * weather.moonVis) * (quality.shadows ? 1 : 0.08 + 0.92 * outK) + weather.calm * 0.4;
    rig.update(dt); // lend shadow-casting twins to the lamps nearest the camera

    // wet lens outside
    ctx.post.wet = player.indoor ? Math.max(0, ctx.post.wet - dt * 0.35) : Math.min(1, ctx.post.wet + dt * 0.2 * (1 - weather.calm));
    post.u.uWet.value = Math.min(1.6, ctx.post.wet) * 0.55;
    post.u.uTime.value = t;

    // audio
    camera.getWorldDirection(fwd);
    const p = player.pos;
    audio.update(dt, { pos: camera.position, fwd, indoor: player.indoor, underground: player.underground, gust: weather.gust, calm: weather.calm, shoreDist: Math.max(0, Math.hypot(p.x, p.z) - 22) + Math.max(0, p.y - 4) * 0.8 });

    if (started) ui.location(ZONES[player.zone] || '');
    if (fixedDt === undefined || render) post.render();
    if (++frames === 3) ctx.refreshShadows();
  };
  let render = true;
  renderer.setAnimationLoop(() => frame());
  // debug: advance the simulation without the browser's animation loop
  ctx.step = (n = 1, dt = 1 / 30, draw = false) => { render = draw; for (let i = 0; i < n; i++) frame(dt); render = true; };
  // debug: park the camera, settle the simulation and draw two frames (rAF is paused in hidden tabs)
  ctx.shot = (x, y, z, yaw, pitch = 0, warm = 20) => { ctx.view(x, y, z, yaw, pitch); ctx.step(warm, 1 / 30, false); ctx.step(2, 1 / 30, true); return `t=${ctx.time.toFixed(1)}`; };
  // debug: light the lamp and wind the clockwork so the beam can be inspected without playing the tasks
  ctx.lamp = () => { Object.assign(game.S, { lampLit: true, fuel: 1, clockwork: 1, glassCleaned: 6, fuelFilled: true, pressure: 1 }); };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

main().catch((e) => {
  console.error(e);
  $('loadmsg').textContent = 'Something went wrong: ' + e.message;
});
