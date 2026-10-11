import { TREASURES } from './game.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.el = {
      prompt: $('prompt'), promptText: $('promptText'), hold: $('holdbar'), holdFill: $('holdfill'), cross: $('crosshair'),
      tasks: $('tasks'), inv: $('inventory'), toasts: $('toasts'), loc: $('location'), status: $('status'),
      note: $('note'), noteBody: $('noteBody'), journal: $('journal'), journalBody: $('journalBody'), treasures: $('treasureCount'),
      sub: $('subtitle'), fade: $('fade'),
    };
    this.noteOpen = false;
    this.lastLoc = '';
    this.el.note.addEventListener('click', (e) => { if (e.target.closest('.close') || e.target === this.el.note) this.closeNote(); });
  }
  setPrompt(text, progress) {
    const e = this.el;
    if (!text) { e.prompt.classList.remove('on'); e.cross.classList.remove('active'); return; }
    e.prompt.classList.add('on'); e.cross.classList.add('active');
    if (this._pt !== text) { e.promptText.innerHTML = text; this._pt = text; }
    e.prompt.classList.toggle('holdable', progress !== null);
    e.holdFill.style.width = `${Math.round((progress || 0) * 100)}%`;
  }
  toast(msg, dur = 4) {
    const d = document.createElement('div');
    d.className = 'toast'; d.innerHTML = msg;
    this.el.toasts.prepend(d);
    requestAnimationFrame(() => d.classList.add('on'));
    setTimeout(() => { d.classList.remove('on'); setTimeout(() => d.remove(), 700); }, dur * 1000);
    while (this.el.toasts.children.length > 4) this.el.toasts.lastChild.remove();
  }
  setTasks(list) {
    this.el.tasks.innerHTML = list.map(t => `<li class="${t.done ? 'done' : ''} ${t.urgent ? 'urgent' : ''}">${t.text}</li>`).join('');
  }
  setInventory(items) {
    this.el.inv.innerHTML = items.map(i => `<div class="slot" title="${i.name}"><span>${i.icon}</span><small>${i.name}</small></div>`).join('');
  }
  setTreasures(n, total) { this.el.treasures.textContent = `${n} / ${total}`; }
  setJournal(found) {
    this.el.journalBody.innerHTML = Object.entries(TREASURES).map(([id, t]) => found.has(id)
      ? `<div class="relic found"><h3>${t.name}</h3><p>${t.text}</p><small>${t.where}</small></div>`
      : `<div class="relic"><h3>— undiscovered —</h3><small>${t.hint}</small></div>`).join('');
  }
  location(name) {
    if (name === this.lastLoc) return;
    this.lastLoc = name;
    const e = this.el.loc; e.textContent = name; e.classList.remove('on'); void e.offsetWidth; e.classList.add('on');
    clearTimeout(this._lt); this._lt = setTimeout(() => e.classList.remove('on'), 2600);
  }
  setStatus(S, beam) {
    const bar = (v, warn) => `<span class="bar ${warn ? 'warn' : ''}"><i style="width:${Math.round(v * 100)}%"></i></span>`;
    const h = `
      <div><b>Lamp</b> ${S.lampLit ? '<em class="ok">lit</em>' : '<em class="bad">dark</em>'}</div>
      <div><b>Paraffin</b> ${bar(S.fuel, S.fuel < 0.15)}</div>
      <div><b>Pressure</b> ${bar(S.pressure, false)}</div>
      <div><b>Clockwork</b> ${bar(S.clockwork, S.clockwork < 0.12)}</div>
      <div><b>Glass</b> ${S.glassCleaned}/6 &nbsp; <b>Fog signal</b> ${S.foghornOn ? '<em class="ok">on</em>' : '<em class="bad">off</em>'}</div>`;
    if (h !== this._sh) { this.el.status.innerHTML = h; this._sh = h; }
  }
  showNote(html) {
    this.el.noteBody.innerHTML = html;
    this.el.note.classList.remove('hidden');
    this.noteOpen = true;
    if (document.pointerLockElement) document.exitPointerLock();
  }
  closeNote() {
    this.el.note.classList.add('hidden'); this.noteOpen = false;
    this.onCloseNote && this.onCloseNote();
  }
  toggleJournal(show) {
    const j = this.el.journal; const on = show ?? j.classList.contains('hidden');
    j.classList.toggle('hidden', !on);
    return on;
  }
  subtitle(who, text, dur) {
    const s = this.el.sub;
    s.innerHTML = `<b>${who}:</b> ${text}`;
    s.classList.toggle('you', who === 'You');
    s.classList.add('on');
    clearTimeout(this._st); this._st = setTimeout(() => s.classList.remove('on'), dur * 1000);
  }
  fade(on) { this.el.fade.classList.toggle('on', on); }
}
