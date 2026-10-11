import * as THREE from 'three';
import { waveHeight } from './ocean.js';
import { boxGeo, cylGeo, Builder } from './geom.js';
import { R_IN, CELLAR_Y, LANTERN_Y, SHED, FLOORS, clamp } from './config.js';
import { terrainHeight } from './island.js';

export const ITEMS = {
  matches: { name: 'Box of matches', icon: '🔥' },
  oilcan: { name: 'Can of paraffin', icon: '🛢️' },
  hammer: { name: 'Hammer & nails', icon: '🔨' },
  boards: { name: 'Spare boards', icon: '🪵' },
  belt: { name: 'Leather drive belt', icon: '➰' },
  crowbar: { name: 'Crowbar', icon: '🔧' },
  rag: { name: 'Cleaning rag', icon: '🧽' },
};

export const TREASURES = {
  sovereigns: {
    hint: 'The cellar wall keeps a promise to the boy. Look for a stone that stands proud.',
    name: 'A purse of gold sovereigns', where: 'Behind a loose stone in the cellar',
    text: 'Twelve gold sovereigns, Victoria\'s young head on every one, wrapped in oilcloth. A slip of paper: <em>"For the boy, should I not come back from the Sound. — E.M."</em>',
  },
  spyglass: {
    hint: 'Smugglers kept a sea chest in the cave under the rock. The tunnel is boarded up from the cellar.',
    name: "Captain Harlan's brass spyglass", where: 'In the smugglers\' chest in the sea cave',
    text: 'Engraved along the draw-tube: <em>"Capt. J. Harlan — Brig MARIANNE — Bristol 1879."</em> The Marianne went down on Skerry Reef in the winter of 1887. No bodies were ever recovered. No cargo, either.',
  },
  journal: {
    hint: 'A confession lies on a ledge in the cave, near what is left of its writer.',
    name: 'Journal of Elias Marrow, 1887', where: 'On a rock ledge in the sea cave',
    text: '<em>"Nov. 3rd — Harlan rowed in again tonight. The casks go down the tunnel to the cave and the Board none the wiser. I tell myself it is only brandy. Nov. 19th — Gale from the NW. I was to show two lights for the Marianne. I did not. God forgive me, I put the lamp out."</em>',
  },
  watch: {
    hint: 'Walk the bedroom floor and listen for a board that creaks underfoot.',
    name: 'A silver pocket watch', where: 'Under a loose floorboard in the bedroom',
    text: 'Stopped at twenty past two. Inside the case: <em>"To Elias, from your Mary. Keep the light."</em> A lock of fair hair is pressed behind the glass.',
  },
  bottleShip: {
    hint: 'One red book sits proud on a study shelf. Pull it, then look in the wall behind.',
    name: 'The Marianne, in a bottle', where: 'In the hidden alcove behind the study bookcase',
    text: 'A perfect little brig, every line rigged with thread. Tucked beneath the stand, a note in Marrow\'s hand: <em>"I built her as she was, before I drowned her. The rest of Harlan\'s gold lies where the sea can watch it."</em>',
  },
  compass: {
    hint: 'Go all the way round the gallery outside the lantern. Something is wedged by the railing.',
    name: 'An engraved brass compass', where: 'Wedged beneath the gallery railing',
    text: 'The needle does not point north. It swings, slowly and stubbornly, toward the reef. On the lid: <em>"She will lead you home."</em>',
  },
  pearls: {
    hint: 'The rowing boat at the jetty has something under its seat.',
    name: 'A rope of black pearls', where: 'Under the thwart of the moored rowing boat',
    text: 'Forty black pearls on a rotten silk thread, in a tin marked <em>MARIANNE — PERSONAL EFFECTS</em>. Someone has been out to the wreck. Recently.',
  },
  message: {
    hint: 'The sea leaves its letters on the rocks of the landing, south of the tower.',
    name: 'A message in a bottle', where: 'Washed into the rocks of the landing shelf',
    text: 'The ink has run but the words survive: <em>"To whoever keeps Skerryhead now — the cave remembers. Count the stones. Light the lamp. Whatever you do, do not let it go dark."</em>',
  },
};

export const ORDERS = `<h2>Standing Orders — Skerryhead Light</h2>
<p><em>Northern Lighthouse Board. To be read by the Keeper on taking up the watch.</em></p>
<ol>
<li>The light shall be exhibited from sunset to sunrise without fail. A light that is out is worse than no light at all.</li>
<li>Paraffin is kept in the <b>oil store</b> on the rock. Carry it up to the reservoir in the <b>watch room</b>, then <b>pump the pressure</b> before lighting.</li>
<li>Light the mantle in the <b>lantern room</b>. Wind the <b>clockwork</b> in the watch room so the optic turns: two flashes every twenty seconds. It must be rewound when it runs down.</li>
<li>In heavy weather the lantern glass salts over. Take a rag out onto the <b>gallery</b> and keep it clean.</li>
<li>The <b>fog signal</b> compressor in the oil store is to be run whenever visibility falls below two miles.</li>
<li>All events of the watch to be entered in the <b>journal</b> in the study before relief.</li>
</ol>
<p class="sig">— Superintendent R. Gillies<br><small>P.S. The relief boat cannot land in this. You are on your own tonight. Mind the cat.</small></p>`;

export const TASKS = [
  { id: 'stove', text: 'Light the stove in the kitchen', done: (S) => S.stoveLit },
  { id: 'oil', text: 'Fetch paraffin from the oil store outside', done: (S, g) => S.fuelFilled || g.has('oilcan') },
  { id: 'fuel', text: 'Fill the lamp reservoir in the watch room', done: (S) => S.fuelFilled },
  { id: 'pressure', text: 'Pump up the reservoir pressure', done: (S) => S.pressure > 0.98 || S.lampLit, show: (S) => S.fuelFilled },
  { id: 'lamp', text: 'Light the lamp in the lantern room', done: (S) => S.lampLit },
  { id: 'wind', text: (S) => S.clockwork <= 0 && S.everWound ? 'The clockwork has run down: rewind it!' : 'Wind the clockwork so the lens turns', done: (S) => S.clockwork > 0, urgent: (S) => S.clockwork <= 0 && S.everWound },
  { id: 'glass', text: (S) => `Scrub the salt off the lantern glass (${S.glassCleaned}/6)`, done: (S) => S.glassCleaned >= 6 },
  { id: 'window', text: 'Board up the broken bedroom window', done: (S) => S.windowBoarded },
  { id: 'foghorn', text: 'Get the fog signal running in the oil store', done: (S) => S.foghornOn },
  { id: 'radio', text: 'The wireless is calling: answer it in the study', show: (S) => S.radioCalling, done: (S) => S.radioAnswered, urgent: (S) => S.radioCalling && !S.radioAnswered },
  { id: 'ship', text: 'Guide the SS Aurora safely past the reef', show: (S) => S.radioAnswered, done: (S) => S.shipState === 'passed' },
  { id: 'baro', text: 'Read the barometer in the study', show: (S) => S.shipState === 'passed', done: (S) => S.baroRead },
  { id: 'log', text: "Write the night's entry in the journal", show: (S) => S.shipState === 'passed', done: (S) => S.logWritten },
];

export class Game {
  constructor(ctx) {
    this.ctx = ctx;
    this.S = {
      stoveLit: false, tea: false, fuelFilled: false, fuel: 0, pressure: 0, lampLit: false, clockwork: 0, everWound: false,
      glassCleaned: 0, windowBoarded: false, beltFitted: false, foghornOn: false, radioCalling: false, radioAnswered: false,
      shipState: 'none', shipProgress: 0, baroRead: false, logWritten: false, rugMoved: false, boardsPried: false, secretOpen: false,
      floorboardPried: false, lampLitAt: 0,
    };
    this.inv = new Map();
    this.treasures = new Set();
    this.time = 0;
    this.started = false;
    this.lastWarn = {};
    this.shipWait = 0;
    this.waveCool = 0;
  }
  get ui() { return this.ctx.ui; }
  has(id) { return this.inv.has(id); }
  give(id, quiet = false) {
    this.inv.set(id, ITEMS[id]);
    this.ui.setInventory([...this.inv.values()]);
    if (!quiet) { this.ctx.audio.pickup(); this.toast(`Picked up: <b>${ITEMS[id].name}</b>`); }
    this.refresh();
  }
  take(id) { this.inv.delete(id); this.ui.setInventory([...this.inv.values()]); this.refresh(); }
  toast(msg, dur = 4) { this.ui.toast(msg, dur); }
  findTreasure(id) {
    if (this.treasures.has(id)) return;
    this.treasures.add(id);
    const t = TREASURES[id];
    this.ctx.audio.treasure();
    this.ui.setTreasures(this.treasures.size, Object.keys(TREASURES).length);
    this.ui.showNote(`<h2>${t.name}</h2><p>${t.text}</p><p class="sig">Treasure ${this.treasures.size} of ${Object.keys(TREASURES).length}</p>`);
    this.ui.setJournal(this.treasures);
  }
  refresh() {
    const S = this.S;
    const list = TASKS.filter(t => !t.show || t.show(S)).map(t => ({
      text: typeof t.text === 'function' ? t.text(S) : t.text,
      done: t.done(S, this), urgent: t.urgent ? t.urgent(S) : false,
    }));
    this.ui.setTasks(list);
  }
  beamOK() { const S = this.S; return S.lampLit && S.fuel > 0 && S.clockwork > 0 && S.glassCleaned >= 4; }
  beamIntensity() {
    const S = this.S;
    if (!S.lampLit) return 0;
    return clamp(S.fuel * 6, 0, 1) * (0.3 + 0.7 * S.glassCleaned / 6);
  }
  radio(lines, i = 0) {
    if (i >= lines.length) return;
    const [who, text, d] = lines[i];
    this.ui.subtitle(who, text, d);
    if (who !== 'You') this.ctx.audio.radioBurst(d);
    setTimeout(() => this.radio(lines, i + 1), d * 1000 + 300);
  }
  warn(key, msg, every = 25) {
    if ((this.lastWarn[key] || -1e9) + every > this.time) return;
    this.lastWarn[key] = this.time; this.toast(msg, 5);
  }

  update(dt) {
    if (!this.started) return;
    this.time += dt;
    const S = this.S, ctx = this.ctx;
    if (S.lampLit) {
      S.fuel = Math.max(0, S.fuel - dt / 1100);
      if (S.fuel <= 0) { S.lampLit = false; this.toast('The lamp has gutted out. <b>The reservoir is dry!</b> Fetch more paraffin.', 6); S.fuelFilled = false; S.pressure = 0; this.refresh(); }
      else if (S.fuel < 0.15) this.warn('fuel', 'The lamp is guttering. Fuel is running low.', 40);
    }
    if (S.clockwork > 0) {
      S.clockwork = Math.max(0, S.clockwork - dt / 210);
      if (S.clockwork <= 0) { this.toast('The clockwork has run down. <b>The light has stopped turning!</b>', 6); this.refresh(); }
      else if (S.clockwork < 0.12) this.warn('clock', 'The clockwork weight is nearly at the bottom of the tube.', 40);
    }
    // radio call once the light is properly working
    if (!S.radioCalling && S.lampLit && S.clockwork > 0 && this.time - S.lampLitAt > 25) {
      S.radioCalling = true; this.refresh();
      this.toast('The wireless set in the study crackles into life…', 6);
      ctx.audio.radioCall();
    }
    if (S.radioCalling && !S.radioAnswered) {
      this.radioNag = (this.radioNag || 0) + dt;
      if (this.radioNag > 9) { this.radioNag = 0; ctx.audio.radioCall(); }
    }
    // ship
    if (S.shipState === 'approach' || S.shipState === 'waiting') {
      const ok = this.beamOK() && S.foghornOn;
      if (ok) {
        if (S.shipState === 'waiting') { S.shipState = 'approach'; this.radio([['SS Aurora', 'We have your light again, Skerryhead! Proceeding.', 3.5]]); }
        S.shipProgress = Math.min(1, S.shipProgress + dt / 150);
        if (S.shipProgress >= 1) {
          S.shipState = 'passed'; this.refresh();
          ctx.audio.shipHorn();
          this.radio([['SS Aurora', 'Skerryhead, Aurora. We are clear of the reef and into open water.', 4], ['SS Aurora', 'God bless you, keeper. We owe you our lives. Aurora out.', 4]]);
          setTimeout(() => this.toast('The ship is safe. Read the barometer and write up the journal in the study.', 7), 9000);
        }
      } else {
        this.shipWait += dt;
        if (S.shipState === 'approach' && this.shipWait > 6) {
          S.shipState = 'waiting'; this.shipWait = 0;
          const why = !S.foghornOn ? 'We cannot hear your fog signal!' : !S.lampLit ? 'Your light has gone out!' : S.clockwork <= 0 ? 'Your light is not turning, we cannot read it!' : 'Your light is too dim, man! The glass must be fouled!';
          this.radio([['SS Aurora', `Skerryhead! ${why} We're heaving to.`, 4]]);
        }
        if (S.shipState === 'waiting') this.warn('ship', 'The Aurora is waiting. She needs a turning, bright light <b>and</b> the fog signal.', 30);
      }
    }
    if (ctx.ship) ctx.ship.update(dt, this.time, S);
    // waves breaking over the landing
    const p = ctx.player.pos;
    this.waveCool -= dt;
    if (p.y < 4 && !ctx.player.indoor && this.waveCool < 0) {
      const h = waveHeight(p.x, p.z, ctx.time);
      if (h > p.y - 0.2 && p.z > 20) {
        this.waveCool = 4;
        ctx.player.knock(0, -6.5);
        ctx.audio.crash(p.x, h, p.z, 1);
        ctx.weather.burst(p.x, h, p.z + 2, 40, 6, 0, 1);
        this.toast('A wave breaks over the landing and nearly takes you!', 3);
      }
    }
    if (p.y < 0.6 && !ctx.player.underground) this.drown();
    // UI status
    this.ui.setStatus(S, this.beamIntensity());
  }
  drown() {
    const ctx = this.ctx;
    ctx.ui.fade(true);
    ctx.audio.crash(ctx.player.pos.x, 0, ctx.player.pos.z, 1);
    setTimeout(() => {
      ctx.player.teleport(new THREE.Vector3(0, 7.0, 2.6), Math.PI);
      ctx.ui.fade(false);
      this.toast('The sea took you, and somehow gave you back. You come to, soaked, inside the tower door.', 6);
    }, 1200);
  }
}

// ------------------------------------------------------------------ the steamer
export class Ship {
  constructor(ctx) {
    this.ctx = ctx;
    const M = ctx.M;
    const g = new THREE.Group(); g.visible = false; ctx.scene.add(g);
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.7 });
    const supMat = new THREE.MeshStandardMaterial({ color: 0x8a8070, roughness: 0.8 });
    const B = new Builder();
    const shape = new THREE.Shape();
    shape.moveTo(-22, 3); shape.lineTo(-23, 0.5); shape.quadraticCurveTo(-21, -3, -14, -3.5); shape.lineTo(16, -3.5); shape.quadraticCurveTo(22, -3, 25, 3.8); shape.lineTo(-22, 3);
    const hg = new THREE.ExtrudeGeometry(shape, { depth: 7, bevelEnabled: true, bevelSize: 0.8, bevelThickness: 1.2, bevelSegments: 3 });
    hg.translate(0, 0, -3.5);
    B.add(hg, hullMat);
    B.box(14, 3, 6, supMat, -2, 4.6, 0); B.box(8, 2.4, 5, supMat, -2, 7.2, 0); B.box(5, 1.6, 7.5, supMat, -2, 8.8, 0);
    B.cyl(1.2, 1.3, 5, hullMat, -8, 7.5, 0, 14);
    B.cyl(0.18, 0.22, 16, hullMat, 12, 10, 0, 6); B.cyl(0.15, 0.2, 13, hullMat, -16, 9, 0, 6);
    B.build(g);
    const lights = new Builder();
    for (let i = 0; i < 9; i++) lights.box(0.5, 0.4, 0.1, M.shipLight, -8 + i * 1.5, 5.0, 3.06);
    for (let i = 0; i < 9; i++) lights.box(0.5, 0.4, 0.1, M.shipLight, -8 + i * 1.5, 5.0, -3.06);
    lights.add(new THREE.SphereGeometry(0.35, 8, 6), M.shipLight, 12, 18.2, 0);
    lights.add(new THREE.SphereGeometry(0.3, 8, 6), M.redLight, -1, 9.8, -3.8);
    lights.add(new THREE.SphereGeometry(0.3, 8, 6), M.greenLight, -1, 9.8, 3.8);
    lights.build(g, { shadows: false });
    this.group = g;
    this.p0 = new THREE.Vector3(-330, 0, 150);
    this.p1 = new THREE.Vector3(330, 0, 100);
  }
  update(dt, t, S) {
    const g = this.group;
    g.visible = S.shipState !== 'none';
    if (!g.visible) return;
    const pr = S.shipState === 'passed' ? Math.min(1.4, S.shipProgress + (t - (this.passT ??= t)) / 150) : S.shipProgress;
    const p = this.p0.clone().lerp(this.p1, pr);
    const h = waveHeight(p.x, p.z, this.ctx.time);
    g.position.set(p.x, h * 0.4 - 0.5, p.z);
    g.rotation.set(Math.sin(t * 0.55) * 0.07, Math.atan2(-(this.p1.z - this.p0.z), this.p1.x - this.p0.x), Math.sin(t * 0.41) * 0.04);
  }
}
