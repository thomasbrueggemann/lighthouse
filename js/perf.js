// Watches real frame times and, if the game cannot hold about 36 fps, steps the expensive effects down one at a time:
// resolution scale, ambient occlusion, dynamic shadows, then MSAA. It never steps back up (that would oscillate), and it
// remembers where it ended up so the next visit starts there.
const STEPS = ['resolution', 'ao', 'shadows', 'msaa'];

export class Governor {
  constructor(ctx, post, renderer) {
    this.ctx = ctx; this.post = post; this.renderer = renderer;
    this.samples = []; this.level = 0; this.cool = 6; this.last = 0;
    this.slowMs = 1000 / 36;
  }

  // call once per animation frame with the unclamped frame time (seconds); `active` is false while paused or hidden
  tick(dt, active) {
    if (!active || dt <= 0 || dt > 1) { this.samples.length = 0; return; }
    this.cool -= dt;
    this.samples.push(dt * 1000);
    if (this.samples.length < 90 || this.cool > 0 || this.level >= STEPS.length) return;
    const sorted = [...this.samples].sort((a, b) => a - b), median = sorted[sorted.length >> 1];
    this.samples.length = 0;
    if (median < this.slowMs) return;
    this.degrade(median);
  }

  degrade(ms) {
    const { ctx, post, renderer } = this, q = ctx.quality;
    const step = STEPS[this.level++]; this.cool = 5; this.last = ms;
    if (step === 'resolution') {
      if (renderer.getPixelRatio() > 1.01) { renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight); post.setSize(); } else return this.degrade(ms);
    } else if (step === 'ao') {
      if (post.ao) post.configure({ ao: false }); else return this.degrade(ms);
    } else if (step === 'shadows') {
      if (!q.shadows) return this.degrade(ms);
      for (const s of ctx.rig.slots) if (s.shadow) { s.light.castShadow = false; ctx.scene.remove(s.light); s.light.dispose?.(); }
      ctx.player.lantern.light.castShadow = false;
      ctx.rig.slots = ctx.rig.slots.filter(s => !s.shadow); ctx.rig.nShadow = 0; ctx.rig.nPlain = ctx.rig.slots.length;
    } else if (step === 'msaa') {
      if (post.samples) post.configure({ samples: 0 }); else return;
    }
    ctx.perfSteps = (ctx.perfSteps ?? []).concat(step);
    if (this.level === 3) ctx.onQualityDropped?.();   // start the next visit on Medium
    ctx.ui?.toast('The frame rate was dropping, so some effects were turned down.', 4);
  }
}
