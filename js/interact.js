import * as THREE from 'three';

function visibleDeep(o) { while (o) { if (!o.visible) return false; o = o.parent; } return true; }

// Look-at-and-press-E interaction with optional hold-to-complete actions.
export class Interaction {
  constructor(ctx, camera) {
    this.ctx = ctx; this.camera = camera;
    this.items = []; this.objects = [];
    this.ray = new THREE.Raycaster(); this.ray.far = 3.2;
    this.center = new THREE.Vector2(0, 0);
    this.target = null; this.progress = 0;
    this.down = false; this.consumed = false;
    addEventListener('keydown', (e) => { if (e.code === 'KeyE' && !e.repeat) { this.down = true; this.consumed = false; this.pressed = true; } });
    addEventListener('keyup', (e) => { if (e.code === 'KeyE') { this.down = false; this.progress = 0; } });
    addEventListener('mousedown', (e) => { if (e.button === 0 && document.pointerLockElement) { this.down = true; this.consumed = false; this.pressed = true; } });
    addEventListener('mouseup', (e) => { if (e.button === 0) { this.down = false; this.progress = 0; } });
  }
  add(obj, opts) {
    const rec = { obj, range: 2.6, hold: 0, ...opts };
    obj.traverse(o => { o.userData.inter = rec; });
    this.items.push(rec); this.objects.push(obj);
    return rec;
  }
  remove(rec) {
    const i = this.items.indexOf(rec); if (i >= 0) this.items.splice(i, 1);
    const j = this.objects.indexOf(rec.obj); if (j >= 0) this.objects.splice(j, 1);
  }
  update(dt, enabled) {
    const ui = this.ctx.ui;
    let rec = null, prompt = null;
    if (enabled) {
      this.ray.setFromCamera(this.center, this.camera);
      const hits = this.ray.intersectObjects([...this.objects, ...this.ctx.occluders], true);
      for (const h of hits) {
        if (!visibleDeep(h.object)) continue;
        const r = h.object.userData.inter;
        if (r && h.distance <= r.range) { const p = r.prompt(); if (p) { rec = r; prompt = p; } }
        break;
      }
    }
    // aim assist for small finds (a bottle, a tin, a watch): if the crosshair is merely near one and nothing solid is in
    // the way, it still counts
    if (!rec && enabled) {
      const cp = this.camera.getWorldPosition(this._cp || (this._cp = new THREE.Vector3())), dir = this.camera.getWorldDirection(this._cd || (this._cd = new THREE.Vector3()));
      let best = 0.2;
      for (const r of this.items) {
        if (!r.assist || !visibleDeep(r.obj)) continue;
        const c = this._cc || (this._cc = new THREE.Vector3());
        this._box = this._box || new THREE.Box3(); this._box.setFromObject(r.obj); this._box.getCenter(c);
        c.sub(cp); const d = c.length();
        if (d > r.range || d < 0.05) continue;
        const ang = Math.acos(Math.min(1, c.dot(dir) / d));
        if (ang >= best) continue;
        const p = r.prompt(); if (!p) continue;
        this.ray.set(cp, c.normalize());
        const block = this.ray.intersectObjects(this.ctx.occluders, true).find(h => visibleDeep(h.object));
        if (block && block.distance < d - 0.35) continue;
        best = ang; rec = r; prompt = p;
      }
    }
    if (rec !== this.target) { this.target = rec; this.progress = 0; }
    ui.setPrompt(prompt, rec && rec.hold ? this.progress : null);
    if (rec && this.down && !this.consumed) {
      if (rec.hold) {
        this.progress += dt / rec.hold;
        rec.onHold && rec.onHold(dt, this.progress);
        if (this.progress >= 1) { this.progress = 0; this.consumed = true; rec.action(); }
      } else if (this.pressed) { this.consumed = true; rec.action(); }
    }
    this.pressed = false;
  }
}
