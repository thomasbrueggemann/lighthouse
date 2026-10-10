import * as THREE from 'three';
import { mulberry32 } from './noise.js';
import { JOBS } from './texgen.js';

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

function dataTex(data, S, srgb) {
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 16;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}
const toTextures = (raw) => raw.col
  ? { map: dataTex(raw.col, raw.S, true), normalMap: dataTex(raw.nrm, raw.S, false), roughnessMap: dataTex(raw.rgh, raw.S, false) }
  : dataTex(raw.nrm, raw.S, false);

// ---------------------------------------------------------------- canvas textures

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function parchment(g, w, h, base = '#d8c79f') {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  const rnd = mulberry32(3);
  for (let i = 0; i < 600; i++) {
    g.fillStyle = `rgba(${90 + rnd() * 40},${60 + rnd() * 30},${20},${rnd() * 0.05})`;
    const r = 4 + rnd() * 40; g.beginPath(); g.arc(rnd() * w, rnd() * h, r, 0, 7); g.fill();
  }
  const grd = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
  grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(70,40,10,0.45)');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
}

function scribble(g, x, y, w, lines, lh, rnd, color = 'rgba(30,25,40,0.8)') {
  g.strokeStyle = color; g.lineWidth = 1.3;
  for (let l = 0; l < lines; l++) {
    let cx = x; const cy = y + l * lh; const end = x + w * (0.6 + rnd() * 0.4);
    g.beginPath(); g.moveTo(cx, cy);
    while (cx < end) {
      const ww = 4 + rnd() * 18;
      for (let k = 0; k < ww; k += 2) g.lineTo(cx + k, cy + Math.sin(k * 1.3 + rnd()) * 2.5 - rnd() * 2);
      cx += ww + 4; g.moveTo(cx, cy);
    }
    g.stroke();
  }
}

function ragRug(g, w, h, cols, seed) {
  const rnd = mulberry32(seed), cx = w / 2, cy = h / 2;
  g.fillStyle = '#cdbb98'; g.fillRect(0, 0, w, h);
  let r = w / 2, ci = 0;
  while (r > 6) {
    const bw = 8 + rnd() * 20;
    g.strokeStyle = cols[ci % cols.length]; g.lineWidth = bw + 1; g.beginPath(); g.arc(cx, cy, Math.max(1, r - bw / 2), 0, 6.2832); g.stroke();
    r -= bw; ci += 1 + (rnd() < 0.25 ? 1 : 0);
  }
  g.fillStyle = cols[ci % cols.length]; g.beginPath(); g.arc(cx, cy, 8, 0, 6.2832); g.fill();
  // the braid: short dashes lying along the rings
  for (let i = 0; i < 14000; i++) {
    const a = rnd() * 6.2832, rr = 6 + rnd() * (w / 2 - 6);
    g.save(); g.translate(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); g.rotate(a + Math.PI / 2);
    g.fillStyle = rnd() < 0.5 ? `rgba(0,0,0,${0.05 + rnd() * 0.1})` : `rgba(255,255,255,${0.03 + rnd() * 0.07})`; g.fillRect(-3, -1, 6, 2); g.restore();
  }
}
const tiled = (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };

export function makeCanvasTextures() {
  const T = {};
  T.ragrug = canvasTex(512, 512, (g, w, h) => ragRug(g, w, h, ['#7a2a22', '#2f4a5a', '#d8c8a8', '#8a6a3a', '#3f5a3a', '#a85a3a'], 5));
  T.ragrug2 = canvasTex(512, 512, (g, w, h) => ragRug(g, w, h, ['#2f4a5a', '#d8c8a8', '#6a3a2a', '#c8a050', '#2a3a2a'], 9));
  T.gingham = tiled(canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#efe6d0'; g.fillRect(0, 0, w, h);
    const c = w / 8;
    for (let i = 0; i < 8; i += 2) { g.fillStyle = 'rgba(150,64,56,0.4)'; g.fillRect(i * c, 0, c, h); g.fillRect(0, i * c, w, c); }
    const rnd = mulberry32(2); for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.05})`; g.fillRect(rnd() * w, rnd() * h, 2, 1); }
  }));
  T.tartan = tiled(canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#26402e'; g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.62;
    for (const [p, wd, col] of [[0.12, 0.05, '#a02a2a'], [0.3, 0.1, '#1c2a4a'], [0.5, 0.025, '#d8b040'], [0.72, 0.08, '#a02a2a'], [0.88, 0.03, '#d8c8a0']]) { g.fillStyle = col; g.fillRect(p * w, 0, wd * w, h); g.fillRect(0, p * h, w, wd * h); }
    g.globalAlpha = 1;
    const rnd = mulberry32(4); for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.08})`; g.fillRect(rnd() * w, rnd() * h, 2, 1); }
  }));
  T.ticking = tiled(canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#e8e0cc'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) { g.fillStyle = 'rgba(40,62,96,0.8)'; g.fillRect(x, 0, 14, h); }
    const rnd = mulberry32(6); for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.06})`; g.fillRect(rnd() * w, rnd() * h, 1, 2); }
  }));
  T.salt = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(17);
    for (let i = 0; i < 2600; i++) {
      const a = rnd() * 0.5 + 0.2; g.fillStyle = `rgba(255,255,255,${a})`;
      const r = rnd() * rnd() * 7 + 0.5; g.beginPath(); g.arc(rnd() * w, rnd() * h, r, 0, 7); g.fill();
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(255,255,255,${0.05 + rnd() * 0.1})`; const x = rnd() * w;
      g.fillRect(x, rnd() * h * 0.5, 2 + rnd() * 4, h * (0.3 + rnd() * 0.6));
    }
  }, false);
  T.glow = canvasTex(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.2, 'rgba(255,255,255,0.6)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.12)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }, false);
  T.lens = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#9fb3b5'; g.fillRect(0, 0, w, h);
    for (let r = 120; r > 4; r -= 9) {
      const grd = g.createRadialGradient(128, 128, r - 9, 128, 128, r);
      grd.addColorStop(0, 'rgba(255,255,255,0.05)'); grd.addColorStop(0.85, 'rgba(255,255,255,0.75)'); grd.addColorStop(1, 'rgba(40,60,60,0.6)');
      g.fillStyle = grd; g.beginPath(); g.arc(128, 128, r, 0, 7); g.fill();
    }
    g.strokeStyle = '#6b5226'; g.lineWidth = 8; g.strokeRect(2, 2, w - 4, h - 4);
  });
  T.chart = canvasTex(1024, 768, (g, w, h) => {
    parchment(g, w, h, '#d9caa4');
    const rnd = mulberry32(21);
    g.fillStyle = 'rgba(160,140,90,0.5)'; g.strokeStyle = '#4a3b26'; g.lineWidth = 2;
    for (const [cx, cy, r] of [[300, 300, 90], [720, 520, 140], [880, 180, 60], [140, 620, 70]]) {
      g.beginPath();
      for (let a = 0; a <= 64; a++) { const t = a / 64 * 6.283; const rr = r * (0.75 + 0.35 * Math.sin(t * 3 + cx) * Math.cos(t * 5 + cy) + rnd() * 0.08); g.lineTo(cx + Math.cos(t) * rr, cy + Math.sin(t) * rr); }
      g.closePath(); g.fill(); g.stroke();
    }
    g.strokeStyle = 'rgba(80,60,40,0.35)'; g.lineWidth = 1;
    for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; g.beginPath(); g.moveTo(520, 360); g.lineTo(520 + Math.cos(a) * 900, 360 + Math.sin(a) * 900); g.stroke(); }
    g.fillStyle = '#3a2f20'; g.font = '13px Georgia';
    for (let i = 0; i < 120; i++) g.fillText(String(Math.floor(rnd() * 40 + 3)), rnd() * w, rnd() * h);
    g.font = 'italic 34px Georgia'; g.fillText('Skerry Sound & Approaches', 330, 60);
    g.save(); g.translate(520, 360);
    g.fillStyle = '#7a2a1c'; g.beginPath(); g.moveTo(0, -70); g.lineTo(12, 0); g.lineTo(0, 70); g.lineTo(-12, 0); g.closePath(); g.fill();
    g.fillStyle = '#2a2a2a'; g.beginPath(); g.moveTo(-70, 0); g.lineTo(0, 12); g.lineTo(70, 0); g.lineTo(0, -12); g.closePath(); g.fill();
    g.restore();
    g.fillStyle = '#b21f1f'; g.beginPath(); g.arc(300, 300, 6, 0, 7); g.fill();
    g.font = 'italic 18px Georgia'; g.fillStyle = '#3a2f20'; g.fillText('Skerryhead Lt.  Fl.(2) W 20s', 312, 296);
    g.strokeStyle = 'rgba(178,31,31,0.8)'; g.setLineDash([8, 6]); g.lineWidth = 2;
    g.beginPath(); g.moveTo(20, 480); g.bezierCurveTo(300, 470, 500, 440, 1000, 430); g.stroke(); g.setLineDash([]);
  });
  T.painting = canvasTex(512, 384, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#2b2f33'); grd.addColorStop(0.5, '#4c5458'); grd.addColorStop(0.55, '#1d2a2e'); grd.addColorStop(1, '#0d1517');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(8);
    for (let i = 0; i < 900; i++) {
      const y = rnd() * h, light = y < h * 0.5 ? 60 + rnd() * 60 : 30 + rnd() * 50;
      g.strokeStyle = `rgba(${light},${light + 8},${light + 10},${0.1 + rnd() * 0.2})`; g.lineWidth = 1 + rnd() * 4;
      g.beginPath(); const x = rnd() * w; g.moveTo(x, y); g.quadraticCurveTo(x + 20, y - 8 * rnd(), x + 40 + rnd() * 30, y + (rnd() - 0.5) * 10); g.stroke();
    }
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(230,235,230,${rnd() * 0.5})`; g.fillRect(rnd() * w, h * 0.55 + rnd() * h * 0.4, 2 + rnd() * 12, 1 + rnd() * 3); }
    g.fillStyle = '#121212';
    g.beginPath(); g.moveTo(180, 230); g.lineTo(340, 225); g.lineTo(320, 250); g.lineTo(200, 252); g.closePath(); g.fill();
    g.fillRect(250, 120, 4, 110); g.fillRect(290, 140, 3, 90);
    g.beginPath(); g.moveTo(254, 125); g.lineTo(310, 200); g.lineTo(254, 205); g.fill();
    g.beginPath(); g.moveTo(250, 130); g.lineTo(200, 210); g.lineTo(250, 212); g.fill();
    g.fillStyle = '#f5e6b0'; g.fillRect(445, 150, 6, 20);
    const lg = g.createRadialGradient(448, 150, 0, 448, 150, 60); lg.addColorStop(0, 'rgba(255,240,180,0.7)'); lg.addColorStop(1, 'rgba(255,240,180,0)');
    g.fillStyle = lg; g.fillRect(380, 90, 140, 120);
  });
  T.portrait = canvasTex(256, 320, (g, w, h) => {
    const grd = g.createRadialGradient(128, 140, 10, 128, 160, 180); grd.addColorStop(0, '#5a4a36'); grd.addColorStop(1, '#1a140e');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2a221a'; g.beginPath(); g.ellipse(128, 300, 100, 90, 0, 0, 7); g.fill();
    g.fillStyle = '#a07a5a'; g.beginPath(); g.ellipse(128, 140, 46, 60, 0, 0, 7); g.fill();
    g.fillStyle = '#d8d0c0'; g.beginPath(); g.ellipse(128, 185, 40, 30, 0, 0, 3.14); g.fill();
    g.fillStyle = '#1a1612'; g.fillRect(84, 78, 88, 26); g.fillRect(70, 98, 116, 8);
    g.fillStyle = '#201810'; g.fillRect(108, 130, 12, 5); g.fillRect(136, 130, 12, 5);
  });
  T.logbook = canvasTex(1024, 640, (g, w, h) => {
    parchment(g, w, h, '#e3d5b0');
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(w / 2 - 6, 0, 12, h);
    const rnd = mulberry32(31);
    g.strokeStyle = 'rgba(80,90,140,0.35)'; g.lineWidth = 1;
    for (let y = 70; y < h - 30; y += 28) { g.beginPath(); g.moveTo(30, y); g.lineTo(w / 2 - 20, y); g.moveTo(w / 2 + 20, y); g.lineTo(w - 30, y); g.stroke(); }
    g.fillStyle = '#2a2030'; g.font = 'italic 26px Georgia'; g.fillText('Skerryhead Light — Journal', 40, 46);
    scribble(g, 40, 92, w / 2 - 80, 18, 28, rnd);
    scribble(g, w / 2 + 30, 92, w / 2 - 80, 7, 28, rnd);
  });
  T.paper = canvasTex(512, 700, (g, w, h) => {
    parchment(g, w, h, '#e6dcc0');
    g.fillStyle = '#2a2030'; g.font = 'bold italic 30px Georgia'; g.fillText('Standing Orders', 90, 70);
    scribble(g, 40, 120, w - 80, 18, 30, mulberry32(9));
  });
  T.clock = canvasTex(256, 256, (g) => {
    g.fillStyle = '#efe6cf'; g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fill();
    g.strokeStyle = '#222'; g.lineWidth = 3; g.beginPath(); g.arc(128, 128, 118, 0, 7); g.stroke();
    g.fillStyle = '#222'; g.font = '22px Georgia'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const R = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283 - 1.5708; g.fillText(R[i], 128 + Math.cos(a) * 95, 128 + Math.sin(a) * 95); }
    for (let i = 0; i < 60; i++) { const a = i / 60 * 6.283; g.fillRect(128 + Math.cos(a) * 112 - 1, 128 + Math.sin(a) * 112 - 1, 2, 2); }
  });
  T.gauge = canvasTex(256, 256, (g) => {
    g.fillStyle = '#f2ecdc'; g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fill();
    g.strokeStyle = '#a01818'; g.lineWidth = 14; g.beginPath(); g.arc(128, 128, 96, -0.4, 0.75); g.stroke();
    g.strokeStyle = '#222'; g.lineWidth = 2;
    for (let i = 0; i <= 10; i++) { const a = 2.36 + i / 10 * 4.71; g.beginPath(); g.moveTo(128 + Math.cos(a) * 104, 128 + Math.sin(a) * 104); g.lineTo(128 + Math.cos(a) * 88, 128 + Math.sin(a) * 88); g.stroke(); }
    g.fillStyle = '#222'; g.font = 'bold 18px Georgia'; g.textAlign = 'center'; g.fillText('PRESSURE', 128, 178); g.font = '13px Georgia'; g.fillText('lbs / sq. in.', 128, 198);
  });
  T.baro = canvasTex(256, 256, (g) => {
    g.fillStyle = '#efe6cf'; g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fill();
    g.fillStyle = '#222'; g.font = 'bold 15px Georgia'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const words = ['STORMY', 'RAIN', 'CHANGE', 'FAIR', 'V. DRY'];
    words.forEach((wd, i) => { const a = 2.5 + i / 4 * 4.4; g.save(); g.translate(128 + Math.cos(a) * 88, 128 + Math.sin(a) * 88); g.rotate(a + 1.5708); g.fillText(wd, 0, 0); g.restore(); });
    for (let i = 0; i <= 40; i++) { const a = 2.5 + i / 40 * 4.4; g.fillRect(128 + Math.cos(a) * 110 - 1, 128 + Math.sin(a) * 110 - 1, 2, 2); }
  });
  T.radio = canvasTex(256, 128, (g) => {
    g.fillStyle = '#2a1c10'; g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#e8c87a'; g.fillRect(16, 16, 224, 50);
    g.fillStyle = '#3a2a10'; g.font = '11px Georgia';
    for (let i = 0; i < 10; i++) { g.fillRect(24 + i * 22, 40, 1, 20); g.fillText(String(500 + i * 100), 18 + i * 22, 34); }
  });
  return T;
}


// Generates every procedural texture. The noise work runs in a pool of Web Workers (largest jobs first); if workers are
// unavailable it falls back to computing on this thread, yielding between jobs so the loading bar keeps moving.
export async function generateTextures(progress) {
  const T = {}, names = Object.keys(JOBS);
  let done = 0;
  const finish = (name, raw) => { if (T[name]) return; T[name] = toTextures(raw); progress(++done / names.length, name); };
  const buffers = (raw) => [raw.col?.buffer, raw.rgh?.buffer, raw.nrm?.buffer].filter(Boolean);
  try {
    const size = Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 4) - 1));
    const workers = [];
    await new Promise((resolve, reject) => {
      const queue = [...names]; let active = 0;
      const next = (w) => { const name = queue.shift(); if (name) w.postMessage({ name }); else if (--active === 0) resolve(); };
      for (let i = 0; i < Math.min(size, names.length); i++) {
        const w = new Worker(new URL('./texworker.js', import.meta.url), { type: 'module' });
        workers.push(w); active++;
        w.onmessage = (e) => { finish(e.data.name, e.data.raw); next(w); };
        w.onerror = (e) => reject(e);
        next(w);
      }
    }).finally(() => workers.forEach(w => w.terminate()));
  } catch (e) { /* no workers: fall through and compute whatever is missing here */ }
  for (const name of names) {
    if (T[name]) continue;
    finish(name, JOBS[name]());
    await new Promise((r) => setTimeout(r, 0));
  }
  Object.assign(T, makeCanvasTextures());
  return T;
}
