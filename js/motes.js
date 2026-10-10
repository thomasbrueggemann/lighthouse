import * as THREE from 'three';

// Dust motes turning slowly in the lamplight. A few hundred soft points wrap around the camera and glow only where the lamps
// currently lent real lights are close; they fade away outdoors (the rain takes over there).
export class Motes {
  constructor(ctx) {
    this.ctx = ctx;
    const N = 260, pos = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) { pos[i * 3] = Math.random(); pos[i * 3 + 1] = Math.random(); pos[i * 3 + 2] = Math.random(); seed[i] = Math.random(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.u = {
      uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(7, 3.4, 7) }, uAmount: { value: 0 },
      uScale: { value: 600 }, uLamp: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: `attribute float aSeed; uniform float uTime, uAmount, uScale; uniform vec3 uCam, uBox; uniform vec4 uLamp[3]; varying float vA;
        void main(){
          vec3 p = position * uBox;
          p += vec3(sin(uTime * 0.11 + aSeed * 40.0) * 0.5, -uTime * 0.018 * (0.5 + aSeed), cos(uTime * 0.09 + aSeed * 23.0) * 0.5);
          p = mod(p - uCam + uBox * 0.5, uBox) + uCam - uBox * 0.5;
          float light = 0.0;
          for (int i = 0; i < 3; i++) { vec3 d = p - uLamp[i].xyz; light += uLamp[i].w / (dot(d, d) + 0.6); }
          vec4 mv = viewMatrix * vec4(p, 1.0);
          float tw = 0.65 + 0.35 * sin(uTime * (1.3 + aSeed * 2.0) + aSeed * 60.0);
          vA = clamp(light * 0.07, 0.0, 0.8) * tw * uAmount * (1.0 - smoothstep(2.5, 3.4, length(p - uCam)));
          gl_PointSize = max(1.5, (0.9 + aSeed * 0.9) * uScale * 0.012 / max(-mv.z, 0.4));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `varying float vA; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float a = (1.0 - smoothstep(0.2, 1.0, r)) * vA; if (a < 0.003) discard; gl_FragColor = vec4(vec3(1.0, 0.86, 0.6) * a * 1.6, a); }`,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false; this.points.renderOrder = 6;
    ctx.scene.add(this.points);
  }

  update(t, outK) {
    const { ctx, u } = this;
    u.uTime.value = t; u.uCam.value.copy(ctx.camera.position);
    u.uAmount.value = Math.max(0, 1 - outK * 1.2);
    u.uScale.value = ctx.renderer.domElement.height;
    this.points.visible = u.uAmount.value > 0.01;
    if (!this.points.visible) return;
    // the three brightest lamps that currently hold a real light
    const best = ctx.rig.slots.filter(s => s.lamp && s.k > 0).sort((a, b) => b.light.intensity - a.light.intensity).slice(0, 3);
    for (let i = 0; i < 3; i++) {
      const s = best[i];
      if (s) u.uLamp.value[i].set(s.lamp.pos.x, s.lamp.pos.y, s.lamp.pos.z, s.light.intensity); else u.uLamp.value[i].set(0, -100, 0, 0);
    }
  }
}
