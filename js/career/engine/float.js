// ASTRO LAB Career — floating movement for weightless training (handrail course) and the neutral-buoyancy pool.
// Uses the player's seat camera: the view is free in every direction, and the body drifts with momentum.
// Grab a handrail (E / Use), then push off with W / forward. Hold Shift (Jog) for a hard push.
// Hitting a wall too fast counts as a mistake. In water there is drag, buoyancy and gentle fin kicks.
import * as THREE from '../../../vendor/three.module.js';
import { makeUsable } from './interact.js';
import { sfx } from './audio.js';
import { settings } from '../../systems/core.js';

const _q = new THREE.Vector3();
export class Floater {
  constructor(ctx, { bounds, start, yaw = 0, water = false, push = 0.8, hardPush = 1.7, bumpLimit = 1.1, onBump, buoyancy }) {
    this.ctx = ctx; this.bounds = bounds; this.water = water; this.push = push; this.hardPush = hardPush; this.bumpLimit = bumpLimit; this.onBump = onBump;
    this.buoyancy = buoyancy || (() => 0); // m/s² up (+) or down (-), water only
    this.pos = new THREE.Vector3(...start); this.vel = new THREE.Vector3(); this.rail = null; this.grabPt = new THREE.Vector3();
    this.boxes = []; this.rails = []; this.bumpT = 0; this.roll = 0; this.enabled = true; this.pushes = 0; this.bumps = 0;
    const p = ctx.player; p.seat = { pos: new THREE.Vector3().copy(this.pos), yaw, yawRange: Math.PI * 1.01, pitchMin: -1.5, pitchMax: 1.5, roll: 0, float: true }; p.yaw = yaw; p.pitch = 0;
  }
  // Solid box obstacle: [x0, x1, y0, y1, z0, z1]
  addBox(b) { this.boxes.push(b); }
  // A yellow handrail between two points. Returns the mesh (a usable target "Handrail").
  // Every rail is anchored: it finds the nearest module surface (wall, floor or ceiling) and gets two standoff posts and
  // base plates down to it, so no handrail ever hangs in mid-air. mount: optional [nx, ny, nz] direction to the surface.
  addRail(a, b, { label = 'Handrail', color = 0xf2b632, mount = null } = {}) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
    const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.2 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x9aa3b2, roughness: 0.35, metalness: 0.8 });
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 12), m); bar.position.copy(A).add(B).multiplyScalar(0.5); bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); g.add(bar);
    // mount direction and distance: towards the closest bound of the module
    const mid = A.clone().add(B).multiplyScalar(0.5), bd = this.bounds;
    let dir = mount ? new THREE.Vector3(...mount).normalize() : null, gap = 0;
    if (!dir) {
      const c = [[mid.x - bd[0], [-1, 0, 0]], [bd[1] - mid.x, [1, 0, 0]], [mid.y - bd[2], [0, -1, 0]], [bd[3] - mid.y, [0, 1, 0]], [mid.z - bd[4], [0, 0, -1]], [bd[5] - mid.z, [0, 0, 1]]].sort((p, q) => p[0] - q[0])[0];
      dir = new THREE.Vector3(...c[1]); gap = c[0];
    } else { const k = ['x', 'y', 'z'].find(k => Math.abs(dir[k]) > 0.5); gap = dir[k] > 0 ? bd[{ x: 1, y: 3, z: 5 }[k]] - mid[k] : mid[k] - bd[{ x: 0, y: 2, z: 4 }[k]]; }
    const ab = B.clone().sub(A).normalize();
    for (const P of [A.clone().addScaledVector(ab, 0.06), B.clone().addScaledVector(ab, -0.06)]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, gap, 8), metal); post.position.copy(P).addScaledVector(dir, gap / 2); post.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); g.add(post);
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.015, 14), metal); plate.position.copy(P).addScaledVector(dir, gap - 0.006); plate.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); g.add(plate);
      const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), m); knuckle.position.copy(P); g.add(knuckle);
    }
    const fat = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, len, 6), new THREE.MeshBasicMaterial({ visible: false })); fat.position.copy(bar.position); fat.quaternion.copy(bar.quaternion); fat.userData.hitbox = true; g.add(fat);
    g.traverse(o => { if (o.isMesh && o !== fat) { o.castShadow = true; o.receiveShadow = true; } });
    this.ctx.scene.add(g);
    g.userData.rail = true; g.userData.static = true; // anchored: never moves, never falls
    const rail = { A, B, obj: g, bar };
    makeUsable(g, { label, verb: 'Grab', range: 1.9, enabled: () => this.enabled && this.rail !== rail, use: () => this.grab(rail) }); this.ctx.ix.add(g);
    this.rails.push(rail); return g;
  }
  closest(rail, p, out = new THREE.Vector3()) { const ab = rail.B.clone().sub(rail.A); const t = Math.max(0, Math.min(1, p.clone().sub(rail.A).dot(ab) / ab.lengthSq())); return out.copy(rail.A).addScaledVector(ab, t); }
  grab(rail) {
    const hit = this.vel.length(); this.rail = rail; this.closest(rail, this.pos, this.grabPt);
    // hold the rail at arm's length: keep the body ~0.55 m from it on the side we came from
    const off = this.pos.clone().sub(this.grabPt); if (off.lengthSq() < 0.01) off.set(0, 0, 1); off.setLength(0.55); this.grabPt.add(off);
    this.vel.set(0, 0, 0); sfx.place(); this.ctx.hud.cap(hit > 0.9 ? '[Thump: you catch the rail hard]' : '[You catch the handrail]', 1600);
    // feedback: the hand closes on the rail, and the rail glows while you hold it
    this.ctx.hands?.grip(500); if (this.ctx.hands) this.ctx.hands.gripping = true; for (const r of this.rails) r.bar.material.emissive?.set(r === rail ? 0x6a4a00 : 0x000000);
    this.onGrab?.(rail, hit);
  }
  release() { this.rail = null; if (this.ctx.hands) this.ctx.hands.gripping = false; for (const r of this.rails) r.bar.material.emissive?.set(0x000000); }
  lookDir(out = new THREE.Vector3()) { const p = this.ctx.player; return out.set(-Math.sin(p.yaw) * Math.cos(p.pitch), Math.sin(p.pitch), -Math.cos(p.yaw) * Math.cos(p.pitch)); }
  // E with nothing in view: pull gently towards the nearest rail on your safety tether (only when nearly stopped)
  reel() {
    if (this.rail || this.vel.length() > 0.12) return false;
    let best = null, bd = 1e9; const q = new THREE.Vector3();
    for (const r of this.rails) { const d = this.closest(r, this.pos, q).distanceTo(this.pos); if (d < bd) { bd = d; best = r; } }
    if (!best) return false; const tgt = this.closest(best, this.pos, q); this.vel.copy(tgt.sub(this.pos)).setLength(0.35); this.ctx.hud.cap('[You tug your safety tether]', 1500); return true;
  }
  get speed() { return this.vel.length(); }
  update(dt, blocked) {
    const p = this.ctx.player, I = this.ctx.input;
    this.bumpT -= dt;
    if (!blocked && this.enabled) {
      const fwd = I.move.y < -0.5, hard = I.held('sprint');
      if (this.rail && fwd) { // push off
        this.release(); this.ctx.hands?.release(); this.vel.copy(this.lookDir()).multiplyScalar(hard ? this.hardPush : this.push); this.pushes++; sfx.step('hard'); this.onPush?.(hard);
      } else if (this.water && !this.rail) { // fin kicks: slow but steerable
        const s = 0.55; const f = this.lookDir(), r = new THREE.Vector3(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
        this.vel.addScaledVector(f, -I.move.y * s * dt * 1.6).addScaledVector(r, I.move.x * s * dt * 1.6);
      }
    }
    if (this.rail) { this.pos.lerp(this.grabPt, Math.min(1, dt * 6)); this.vel.set(0, 0, 0); }
    else {
      if (this.water) { this.vel.y += this.buoyancy() * dt; this.vel.multiplyScalar(Math.exp(-1.1 * dt)); }
      this.pos.addScaledVector(this.vel, dt);
      this.collide();
    }
    // a slow body roll while drifting makes it feel weightless (not in water, off with reduced motion)
    const reduce = settings.reducedMotion;
    this.roll += ((this.rail || reduce || this.water ? 0 : Math.sin(performance.now() / 2400) * 0.05) - this.roll) * Math.min(1, dt * 1.5);
    p.seat.pos.copy(this.pos); p.seat.roll = this.roll; p.pos.set(this.pos.x, this.pos.y - 1.6, this.pos.z);
  }
  collide() {
    const R = 0.32, b = this.bounds, v = this.vel; let hit = 0;
    const axis = (k, lo, hi) => { if (this.pos[k] < lo + R) { this.pos[k] = lo + R; hit = Math.max(hit, Math.abs(v[k])); v[k] = Math.abs(v[k]) * 0.3; } else if (this.pos[k] > hi - R) { this.pos[k] = hi - R; hit = Math.max(hit, Math.abs(v[k])); v[k] = -Math.abs(v[k]) * 0.3; } };
    axis('x', b[0], b[1]); axis('y', b[2], b[3]); axis('z', b[4], b[5]);
    for (const [x0, x1, y0, y1, z0, z1] of this.boxes) {
      const P = this.pos; if (P.x < x0 - R || P.x > x1 + R || P.y < y0 - R || P.y > y1 + R || P.z < z0 - R || P.z > z1 + R) continue;
      const pen = [[P.x - (x0 - R), 'x', -1], [(x1 + R) - P.x, 'x', 1], [P.y - (y0 - R), 'y', -1], [(y1 + R) - P.y, 'y', 1], [P.z - (z0 - R), 'z', -1], [(z1 + R) - P.z, 'z', 1]].sort((a, c) => a[0] - c[0])[0];
      P[pen[1]] += pen[2] * pen[0]; hit = Math.max(hit, Math.abs(v[pen[1]])); v[pen[1]] = pen[2] * Math.abs(v[pen[1]]) * 0.3;
    }
    // handrails are solid bars too: the body (about 0.2 m around the camera) cannot drift through one; the rail you hold is skipped
    const RB = 0.2 + 0.025, q = _q;
    for (const r of this.rails) {
      if (r === this.rail) continue;
      this.closest(r, this.pos, q); const d = this.pos.distanceTo(q); if (d >= RB || d < 1e-6) continue;
      const n = this.pos.clone().sub(q).divideScalar(d), vn = v.dot(n);
      this.pos.addScaledVector(n, RB - d); if (vn < 0) { hit = Math.max(hit, -vn); v.addScaledVector(n, -vn * 1.3); }
    }
    if (hit > 0.15) {
      if (hit > this.bumpLimit && this.bumpT <= 0) { this.bumpT = 1.5; this.bumps++; sfx.wrong(); this.ctx.hud.flash(`Too fast! You hit the wall at ${hit.toFixed(1)} m/s. Push off more gently.`, 'bad'); this.onBump?.(hit); }
      else if (hit > 0.3) sfx.place();
    }
  }
  dispose() { this.ctx.player.seat = null; if (this.ctx.hands) this.ctx.hands.gripping = false; }
}
