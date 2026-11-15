// ASTRO LAB Career — the player's first-person hands. They live on the first-person layer (World.fpRoot), so they never clip
// into walls. States: hidden, idle, reach (looking at something usable), grab (short animation), hold (carrying), release, drop.
// Two hands are used for big items. Scenes can also call hands.grip() / hands.release() for handrails, levers and tools.
import * as THREE from '../../../vendor/three.module.js';
import { RO } from './layers.js';

const SKIN = 0xd2a07c, CUFF = 0x2b4f8f;
function buildHand(side, skinCol = SKIN, cuffCol = CUFF) {
  const g = new THREE.Group(); g.name = 'hand';
  const skin = new THREE.MeshStandardMaterial({ color: skinCol, roughness: 0.6 });
  const cuff = new THREE.MeshStandardMaterial({ color: cuffCol, roughness: 0.8 });
  const add = (geo, mat, x, y, z, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  // forearm sleeve + wrist cuff
  const sleeve = add(new THREE.CylinderGeometry(0.039, 0.045, 0.18, 14), cuff, 0, 0, 0.12); // shorter, slimmer sleeve: it used to fill the corner of the screen sleeve.rotation.x = Math.PI / 2;
  add(new THREE.TorusGeometry(0.041, 0.008, 6, 16), cuff, 0, 0, 0.03);
  // palm (rounded block)
  const palm = add(new THREE.CapsuleGeometry(0.036, 0.04, 4, 10), skin, 0, -0.002, -0.035); palm.rotation.x = Math.PI / 2; palm.scale.set(1.25, 1, 0.62);
  // four fingers, two segments each (curl bends them)
  const fingers = [];
  for (let i = 0; i < 4; i++) {
    const base = new THREE.Group(); base.position.set((-0.03 + i * 0.02) * side, 0, -0.08 + Math.abs(i - 1.5) * 0.004); g.add(base);
    const len = [0.036, 0.042, 0.04, 0.032][i];
    const p1 = add(new THREE.CapsuleGeometry(0.0095, len, 3, 8), skin, 0, 0, -len / 2, base); p1.rotation.x = Math.PI / 2;
    const mid = new THREE.Group(); mid.position.z = -len; base.add(mid);
    const p2 = add(new THREE.CapsuleGeometry(0.0088, len * 0.8, 3, 8), skin, 0, 0, -len * 0.4, mid); p2.rotation.x = Math.PI / 2;
    fingers.push({ base, mid });
  }
  // thumb
  const th = new THREE.Group(); th.position.set(0.042 * side, -0.006, -0.03); th.rotation.set(0, 0.7 * side, 0); g.add(th);
  const t1 = add(new THREE.CapsuleGeometry(0.011, 0.035, 3, 8), skin, 0, 0, -0.02, th); t1.rotation.x = Math.PI / 2;
  g.traverse(o => { if (o.isMesh) { o.renderOrder = RO.HELD; o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; } });
  g.userData.parts = { fingers, th, skin, cuff };
  return g;
}

// Hand poses in camera space: [x, y, z, pitch, yaw, roll, curl]
const POSE = {
  hidden: [0.3, -0.62, -0.42, 0.3, 0, 0, 0.3],
  idle: [0.27, -0.36, -0.46, 0.15, 0.1, -0.2, 0.35],
  reach: [0.2, -0.24, -0.5, 0.05, 0.15, -0.35, 0.05],
  grab: [0.14, -0.16, -0.62, -0.05, 0.15, -0.4, 0.9],
  hold: [0.2, -0.33, -0.5, 0.25, 0.25, -0.6, 0.7],
  release: [0.2, -0.28, -0.56, 0.05, 0.15, -0.35, 0.0],
  drop: [0.22, -0.5, -0.5, 0.5, 0.1, -0.2, 0.0],
  grip: [0.12, -0.2, -0.55, -0.2, 0.2, -0.5, 0.95]
};
const mirror = p => [-p[0], p[1], p[2], p[3], -p[4], -p[5], p[6]];

export class Hands {
  constructor(world) {
    this.world = world; this.R = buildHand(1); this.L = buildHand(-1);
    world.fpRoot.add(this.R, this.L);
    this.cur = { R: [...POSE.hidden], L: mirror(POSE.hidden) };
    this.state = 'hidden'; this.anim = null; this.twoHands = false; this.enabled = true; this.t = 0;
    this.R.visible = this.L.visible = false;
  }
  // Short one-off animations: 'grab' -> hold, 'release' -> idle, 'drop' -> idle, 'grip' (handrail, lever) -> idle
  play(name, ms = 260, then = null) { this.anim = { name, t: 0, dur: ms / 1000, then }; }
  grab() { this.play('grab', 220, 'hold'); }
  release() { this.play('release', 260, null); }
  drop() { this.play('drop', 300, null); }
  grip(ms = 600) { this.play('grip', ms, null); }
  setLook(skin, cuff) { for (const hnd of [this.R, this.L]) { if (skin != null) hnd.userData.parts.skin.color.set(skin); if (cuff != null) hnd.userData.parts.cuff.color.set(cuff); } }
  // focus: something usable under the crosshair. holding: the carried object (or null). big: needs two hands.
  update(dt, { focus = false, holding = null, big = false, hidden = false, holdAt = null, half = 0.1 } = {}) {
    this.t += dt;
    let want = hidden || !this.enabled ? 'hidden' : holding ? 'hold' : this.gripping ? 'grip' : focus ? 'reach' : 'hidden';
    if (this.anim) { this.anim.t += dt; want = this.anim.name; if (this.anim.t >= this.anim.dur) { const nx = this.anim.then; this.anim = null; if (nx) want = nx; } }
    this.state = want;
    const two = (want === 'hold' && big) || (want === 'grip' && this.twoGrip);
    const k = Math.min(1, dt * (want === 'grab' || want === 'grip' ? 16 : 10));
    const bob = want === 'hold' || want === 'idle' ? Math.sin(this.t * 2) * 0.004 : 0;
    let tR = POSE[want] || POSE.hidden, tL = two ? mirror(POSE[want]) : mirror(POSE.hidden);
    if (want === 'hold' && holdAt) { // hands follow the held item: one hand under a small item, two hands on the sides of a big one
      const [hx, hy, hz] = holdAt;
      if (big) { const w = Math.min(0.42, half + 0.015); tR = [hx + w, hy - 0.03, hz + 0.1, 0.1, 0.35, -1.35, 0.55]; tL = [hx - w, hy - 0.03, hz + 0.1, 0.1, -0.35, 1.35, 0.55]; }
      else tR = [hx + Math.min(0.12, half + 0.035), hy - 0.015, hz + 0.05, 0.05, 0.3, -1.25, 0.8]; // wrap the hand round the side of a small item, palm facing it (it used to sit flat under it)
    }
    for (const [hnd, cur, tgt] of [[this.R, this.cur.R, tR], [this.L, this.cur.L, tL]]) {
      for (let i = 0; i < 7; i++) cur[i] += (tgt[i] - cur[i]) * k;
      hnd.position.set(cur[0], cur[1] + bob, cur[2]); hnd.rotation.set(cur[3], cur[4], cur[5]);
      const c = cur[6]; hnd.userData.parts.fingers.forEach((f, i) => { f.base.rotation.x = -c * (1.1 + i * 0.05); f.mid.rotation.x = -c * 1.3; });
      hnd.userData.parts.th.rotation.x = -c * 0.6;
      hnd.visible = cur[1] > -0.58; // slid out of view = hidden
    }
  }
  dispose() { this.R.removeFromParent(); this.L.removeFromParent(); }
}
