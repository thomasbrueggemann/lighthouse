// Procedural storm & interaction audio built from filtered noise and oscillators.
export class AudioEngine {
  constructor() { this.ok = false; this.t = 0; this.loops = {}; }

  init() {
    if (this.ok) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.c = new AC();
    this.master = c.createGain(); this.master.gain.value = 0.9;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(c.destination);
    // outdoor bus gets muffled indoors
    this.outLP = c.createBiquadFilter(); this.outLP.type = 'lowpass'; this.outLP.frequency.value = 18000;
    this.outG = c.createGain(); this.outG.gain.value = 1;
    this.outLP.connect(this.outG).connect(this.master);
    this.white = this.noiseBuf('white', 3); this.brown = this.noiseBuf('brown', 5); this.pink = this.noiseBuf('pink', 4);

    const loop = (buf) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = Math.random(); s.start(0, Math.random() * buf.duration); return s; };
    // wind body
    this.windF = c.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.frequency.value = 420; this.windF.Q.value = 0.6;
    this.windG = c.createGain(); this.windG.gain.value = 0.5;
    loop(this.brown).connect(this.windF).connect(this.windG).connect(this.outLP);
    // wind whistle
    this.whF = c.createBiquadFilter(); this.whF.type = 'bandpass'; this.whF.frequency.value = 900; this.whF.Q.value = 14;
    this.whG = c.createGain(); this.whG.gain.value = 0.12;
    loop(this.white).connect(this.whF).connect(this.whG).connect(this.outLP);
    // rain
    const rHP = c.createBiquadFilter(); rHP.type = 'highpass'; rHP.frequency.value = 900;
    const rLP = c.createBiquadFilter(); rLP.type = 'lowpass'; rLP.frequency.value = 9000;
    this.rainG = c.createGain(); this.rainG.gain.value = 0.22;
    loop(this.pink).connect(rHP).connect(rLP).connect(this.rainG).connect(this.outLP);
    // rain against glass/stone, heard indoors
    const iBP = c.createBiquadFilter(); iBP.type = 'bandpass'; iBP.frequency.value = 2200; iBP.Q.value = 0.7;
    this.inRainG = c.createGain(); this.inRainG.gain.value = 0;
    loop(this.white).connect(iBP).connect(this.inRainG).connect(this.master);
    // surf roar
    this.surfF = c.createBiquadFilter(); this.surfF.type = 'lowpass'; this.surfF.frequency.value = 500;
    this.surfG = c.createGain(); this.surfG.gain.value = 0.4;
    loop(this.brown).connect(this.surfF).connect(this.surfG).connect(this.outLP);
    // deep storm rumble through the stone
    const rum = c.createBiquadFilter(); rum.type = 'lowpass'; rum.frequency.value = 90;
    this.rumG = c.createGain(); this.rumG.gain.value = 0.35;
    loop(this.brown).connect(rum).connect(this.rumG).connect(this.master);
    this.ok = true;
  }

  noiseBuf(type, sec) {
    const c = this.c, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    let last = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (type === 'white') d[i] = w * 0.5;
      else if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
      else { b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12; }
    }
    return b;
  }

  panner(x, y, z, ref = 3, roll = 1.2) {
    const p = this.c.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = roll; p.maxDistance = 300;
    if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z);
    p.connect(this.master);
    return p;
  }

  // one-shot noise burst through a filter
  burst({ buf = this.white, type = 'bandpass', f = 1000, q = 1, a = 0.005, d = 0.2, g = 0.5, dest = this.master, when = 0, rate = 1, fEnd = null }) {
    if (!this.ok) return;
    const c = this.c, t = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (fEnd) fl.frequency.exponentialRampToValueAtTime(fEnd, t + a + d);
    const gn = c.createGain(); gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(g, t + a); gn.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    s.connect(fl).connect(gn).connect(dest);
    s.loop = true; s.start(t, Math.random() * Math.max(0, buf.duration - 0.5)); s.stop(t + a + d + 0.05);
  }
  tone({ f = 440, type = 'sine', a = 0.01, d = 0.3, g = 0.2, dest = this.master, when = 0, fEnd = null }) {
    if (!this.ok) return;
    const c = this.c, t = c.currentTime + when;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, t + a + d);
    const gn = c.createGain(); gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(g, t + a); gn.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    o.connect(gn).connect(dest); o.start(t); o.stop(t + a + d + 0.05);
  }

  update(dt, s) {
    if (!this.ok) return;
    this.t += dt;
    const c = this.c, now = c.currentTime;
    const L = c.listener, p = s.pos, f = s.fwd;
    if (L.positionX) {
      L.positionX.setTargetAtTime(p.x, now, 0.05); L.positionY.setTargetAtTime(p.y, now, 0.05); L.positionZ.setTargetAtTime(p.z, now, 0.05);
      L.forwardX.setTargetAtTime(f.x, now, 0.05); L.forwardY.setTargetAtTime(f.y, now, 0.05); L.forwardZ.setTargetAtTime(f.z, now, 0.05);
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else { L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, 0, 1, 0); }
    const ind = s.indoor ? 1 : 0, ug = s.underground ? 1 : 0;
    const calm = s.calm || 0;
    const gust = s.gust * (1 - calm * 0.7);
    const height = Math.max(0, (p.y - 7) / 25);
    this.outLP.frequency.setTargetAtTime(ind ? (ug ? 260 : 700) : 18000, now, 0.25);
    this.outG.gain.setTargetAtTime(ind ? (ug ? 0.35 : 0.55) : 1, now, 0.25);
    this.windG.gain.setTargetAtTime((0.25 + gust * 0.6 + height * 0.3) * (1 - calm * 0.6), now, 0.4);
    this.windF.frequency.setTargetAtTime(280 + gust * 520 + height * 200, now, 0.4);
    this.whG.gain.setTargetAtTime((ind ? 0.05 + gust * 0.12 : 0.02 + gust * 0.1) * (1 - calm), now, 0.5);
    this.whF.frequency.setTargetAtTime(700 + gust * 900 + Math.sin(this.t * 0.7) * 120, now, 0.3);
    this.rainG.gain.setTargetAtTime(0.22 * (1 - calm * 0.85), now, 0.5);
    this.inRainG.gain.setTargetAtTime(ind && !ug ? 0.045 * (1 - calm * 0.8) : 0, now, 0.5);
    const shore = s.shoreDist ?? 20;
    this.surfG.gain.setTargetAtTime((0.25 + 0.7 / (1 + shore * 0.08)) * (1 - calm * 0.5), now, 0.5);
    this.rumG.gain.setTargetAtTime(ind ? 0.4 : 0.2, now, 0.5);
    // positional loops
    for (const k in this.loops) this.loops[k].tick(dt);
  }

  // looping positional emitter that fires `fire(panner)` at random intervals
  addLoop(name, x, y, z, minI, maxI, fire, ref = 2.5) {
    if (!this.ok) return;
    const pan = this.panner(x, y, z, ref, 1.6);
    let next = Math.random() * maxI;
    const lp = { on: true, tick: (dt) => { if (!lp.on) return; next -= dt; if (next <= 0) { next = minI + Math.random() * (maxI - minI); fire(pan); } } };
    this.loops[name] = lp;
    return lp;
  }
  setLoop(name, on) { if (this.loops[name]) this.loops[name].on = on; }

  // ------------------------------------------------------------ events
  thunder(delay, k) {
    if (!this.ok) return;
    k = Math.max(0.15, Math.min(1, k));
    this.burst({ buf: this.brown, type: 'lowpass', f: 900 * k + 200, fEnd: 60, a: 0.04 + (1 - k) * 0.3, d: 3.5 + k * 3, g: 1.1 * k, when: delay, dest: this.outLP });
    this.burst({ buf: this.white, type: 'lowpass', f: 2500, fEnd: 200, a: 0.01, d: 0.5, g: 0.4 * k * k, when: delay, dest: this.outLP });
    for (let i = 0; i < 4; i++) this.burst({ buf: this.brown, type: 'lowpass', f: 300, fEnd: 50, a: 0.1, d: 1.2 + Math.random(), g: 0.6 * k, when: delay + 0.5 + Math.random() * 2.5, dest: this.outLP });
  }
  crash(x, y, z, k) {
    if (!this.ok) return;
    const pan = this.panner(x, y, z, 8, 1.0);
    this.burst({ buf: this.pink, type: 'lowpass', f: 1800 * k + 400, fEnd: 250, a: 0.05, d: 1.4 + k, g: 1.6 * k, dest: pan });
    this.burst({ buf: this.white, type: 'highpass', f: 2000, a: 0.08, d: 1.0, g: 0.4 * k, dest: pan, when: 0.1 });
    setTimeout(() => pan.disconnect(), 4000);
  }
  footstep(surface, run) {
    const g = run ? 0.5 : 0.35;
    if (surface === 'wood') { this.burst({ buf: this.brown, type: 'lowpass', f: 380, a: 0.004, d: 0.12, g: g * 1.4 }); this.burst({ type: 'bandpass', f: 1600 + Math.random() * 600, q: 3, a: 0.002, d: 0.04, g: g * 0.15 }); if (Math.random() < 0.08) this.creak(0.15); }
    else if (surface === 'metal') { this.burst({ type: 'bandpass', f: 2400 + Math.random() * 400, q: 12, a: 0.002, d: 0.2, g: g * 0.5 }); this.burst({ buf: this.brown, type: 'lowpass', f: 300, a: 0.003, d: 0.08, g }); }
    else if (surface === 'water') { this.burst({ buf: this.pink, type: 'bandpass', f: 900, q: 0.8, a: 0.02, d: 0.35, g: g * 1.2 }); }
    else if (surface === 'stone') { this.burst({ type: 'bandpass', f: 2200 + Math.random() * 800, q: 2, a: 0.002, d: 0.06, g: g * 0.4 }); this.burst({ buf: this.brown, type: 'lowpass', f: 250, a: 0.003, d: 0.06, g: g * 0.8 }); }
    else { this.burst({ buf: this.pink, type: 'bandpass', f: 1300 + Math.random() * 500, q: 1.2, a: 0.004, d: 0.12, g: g * 0.6 }); this.burst({ buf: this.brown, type: 'lowpass', f: 220, a: 0.004, d: 0.08, g: g * 0.6 }); }
  }
  creak(g = 0.3, dest) {
    if (!this.ok) return;
    const c = this.c, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth';
    const f0 = 90 + Math.random() * 120; o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * (0.7 + Math.random() * 0.8), t + 0.5);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700 + Math.random() * 500; bp.Q.value = 6;
    const gn = c.createGain(); gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(g * 0.4, t + 0.08); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    const lfo = c.createOscillator(); lfo.frequency.value = 28 + Math.random() * 20; const lg = c.createGain(); lg.gain.value = g * 0.3; lfo.connect(lg).connect(gn.gain);
    o.connect(bp).connect(gn).connect(dest || this.master); o.start(t); o.stop(t + 0.7); lfo.start(t); lfo.stop(t + 0.7);
  }
  click() { this.burst({ type: 'bandpass', f: 3000, q: 4, a: 0.001, d: 0.03, g: 0.3 }); }
  pickup() { this.tone({ f: 660, d: 0.15, g: 0.08 }); this.tone({ f: 990, d: 0.25, g: 0.06, when: 0.08 }); this.burst({ buf: this.pink, type: 'bandpass', f: 1500, a: 0.01, d: 0.12, g: 0.2 }); }
  treasure() { [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone({ f, type: 'triangle', d: 1.4 - i * 0.15, g: 0.07, when: i * 0.09 })); }
  door() { this.creak(0.6); this.burst({ buf: this.brown, type: 'lowpass', f: 200, a: 0.01, d: 0.3, g: 0.6, when: 0.5 }); }
  thud() { this.burst({ buf: this.brown, type: 'lowpass', f: 250, a: 0.005, d: 0.25, g: 0.9 }); this.burst({ type: 'bandpass', f: 900, q: 2, a: 0.002, d: 0.08, g: 0.2 }); }
  hammer() { this.burst({ type: 'bandpass', f: 2600, q: 8, a: 0.001, d: 0.12, g: 0.5 }); this.burst({ buf: this.brown, type: 'lowpass', f: 400, a: 0.002, d: 0.1, g: 0.8 }); }
  wipe() { this.burst({ buf: this.pink, type: 'bandpass', f: 2500 + Math.random() * 1500, q: 1.5, a: 0.05, d: 0.18, g: 0.3 }); }
  ratchet() { this.burst({ type: 'bandpass', f: 3500, q: 10, a: 0.001, d: 0.025, g: 0.4 }); this.burst({ type: 'bandpass', f: 1200, q: 6, a: 0.001, d: 0.03, g: 0.2 }); }
  pump() { this.burst({ buf: this.pink, type: 'bandpass', f: 600, fEnd: 1400, q: 2, a: 0.05, d: 0.3, g: 0.4 }); }
  pour() { for (let i = 0; i < 18; i++) this.burst({ buf: this.pink, type: 'bandpass', f: 500 + Math.random() * 900, q: 6, a: 0.02, d: 0.12, g: 0.25, when: i * 0.1 }); }
  match() { this.burst({ type: 'highpass', f: 2000, a: 0.005, d: 0.15, g: 0.4 }); this.burst({ buf: this.pink, type: 'bandpass', f: 800, q: 0.7, a: 0.08, d: 0.6, g: 0.4, when: 0.12 }); }
  whoosh() { this.burst({ buf: this.brown, type: 'bandpass', f: 300, fEnd: 900, q: 0.8, a: 0.2, d: 0.9, g: 0.8 }); }
  stoneScrape() { this.burst({ buf: this.pink, type: 'bandpass', f: 400, fEnd: 250, q: 1.5, a: 0.1, d: 0.9, g: 0.7 }); }
  purr() {
    if (!this.ok) return;
    const c = this.c, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.brown;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180;
    const g = c.createGain(); g.gain.value = 0;
    const lfo = c.createOscillator(); lfo.frequency.value = 24; const lg = c.createGain(); lg.gain.value = 0.5; lfo.connect(lg).connect(g.gain);
    const env = c.createGain(); env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(1.2, t + 0.3); env.gain.setValueAtTime(1.2, t + 2.2); env.gain.exponentialRampToValueAtTime(0.0001, t + 3);
    s.connect(lp).connect(g).connect(env).connect(this.master); s.start(t); s.stop(t + 3.1); lfo.start(t); lfo.stop(t + 3.1);
    this.tone({ f: 700, fEnd: 500, type: 'triangle', a: 0.05, d: 0.35, g: 0.05, when: 0.2 });
  }
  foghorn(x, y, z) {
    if (!this.ok) return;
    const c = this.c, t = c.currentTime;
    const pan = this.panner(x, y, z, 15, 0.6);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7, t + 0.35); g.gain.setValueAtTime(0.7, t + 2.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.6);
    lp.connect(g).connect(pan);
    for (const f of [98, 99.5, 196.5]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 0.92, t); o.frequency.linearRampToValueAtTime(f, t + 0.4); o.connect(lp); o.start(t); o.stop(t + 3.7); }
    setTimeout(() => pan.disconnect(), 5000);
  }
  shipHorn() {
    if (!this.ok) return;
    const c = this.c;
    for (let k = 0; k < 2; k++) {
      const t = c.currentTime + k * 2.2;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.2); g.gain.setValueAtTime(0.25, t + 1.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
      lp.connect(g).connect(this.outLP);
      for (const f of [146, 185]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(t); o.stop(t + 2); }
    }
  }
  radioCall() { for (let i = 0; i < 6; i++) this.tone({ f: 880, type: 'square', d: i % 3 === 2 ? 0.25 : 0.08, g: 0.03, when: i * 0.18 }); this.burst({ type: 'bandpass', f: 1800, q: 0.8, a: 0.05, d: 1.4, g: 0.12 }); }
  radioBurst(d) {
    for (let i = 0; i < d * 6; i++) this.burst({ type: 'bandpass', f: 900 + Math.random() * 1500, q: 2, a: 0.02, d: 0.12 + Math.random() * 0.1, g: 0.06 + Math.random() * 0.05, when: i / 6 });
  }
  kettle() { this.tone({ f: 1800, fEnd: 2300, type: 'sine', a: 0.6, d: 1.5, g: 0.04 }); }
}
