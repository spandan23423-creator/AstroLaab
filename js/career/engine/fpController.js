// ASTRO LAB Career — first-person walker: walk, sprint, crouch, wall collision, floors/stairs, head bob, footsteps.
import * as THREE from '../../../vendor/three.module.js';
import { settings } from '../../systems/core.js';
import { sfx } from './audio.js';

const STAND = 1.62, CROUCH = 1.02, RADIUS = 0.28;
export class FPController {
  constructor(camera, input) {
    this.camera = camera; this.input = input;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0; this.eye = STAND; this.crouched = false; this.frozen = false;
    this.colliders = []; this.floorAt = () => 0; this.surfaceAt = () => 'hard';
    this.speed = { walk: 2.3, sprint: 4, crouch: 1.2 };
    this.bob = 0; this.stepDist = 0; this.lookTotal = 0; this.moved = 0; this.bounds = null;
  }
  place(x, z, yaw = 0, pitch = 0, y = null) { this.pos.set(x, y ?? this.floorAt(x, z, this.pos.y), z); this.yaw = yaw; this.pitch = pitch; this.vel.set(0, 0, 0); this.vy = 0; this.apply(0); }
  // Colliders: { x0, x1, z0, z1, y0, y1 } in world metres. y0..y1 lets crouching pass under low obstacles.
  addBox(x0, x1, z0, z1, y0 = 0, y1 = 3, tag) { const c = { x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y0, y1, tag, on: true }; this.colliders.push(c); return c; }
  headroomOK(x, z, eye) {
    const top = this.pos.y + eye + 0.12, feet = this.pos.y + 0.25;
    for (const c of this.colliders) { if (!c.on || c.y1 <= feet || c.y0 >= top) continue; const cx = Math.max(c.x0, Math.min(x, c.x1)), cz = Math.max(c.z0, Math.min(z, c.z1)); if (Math.hypot(x - cx, z - cz) < RADIUS - 0.02) return false; }
    return true;
  }
  update(dt) {
    const I = this.input, look = I.poll(dt);
    if (!this.frozen) {
      this.yaw += look.yaw; this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch + look.pitch));
      this.lookTotal += Math.abs(look.yaw) + Math.abs(look.pitch);
    }
    // Seated / lying: no walking, the view is limited around a centre direction
    if (this.seat) {
      const S = this.seat; let d = this.yaw - S.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      d = Math.max(-S.yawRange, Math.min(S.yawRange, d)); this.yaw = S.yaw + d;
      this.pitch = Math.max(S.pitchMin ?? -1.2, Math.min(S.pitchMax ?? 1.2, this.pitch));
      this.camera.position.copy(S.pos); this.camera.rotation.set(this.pitch, this.yaw, S.roll || 0);
      return;
    }
    // Crouch: toggle on tap for touch/pad, hold for keyboard
    const wantCrouch = I.held('crouch') || this.crouchToggle;
    if (I.hit('crouch') && I.lastDevice !== 'kbm') this.crouchToggle = !this.crouchToggle;
    if (!wantCrouch && this.crouched && !this.headroomOK(this.pos.x, this.pos.z, STAND)) { /* stay crouched under low ceiling */ }
    else this.crouched = !!wantCrouch;
    const targetEye = this.crouched ? CROUCH : STAND; this.eye += (targetEye - this.eye) * Math.min(1, dt * 10);
    // Movement
    let mx = this.frozen ? 0 : I.move.x, mz = this.frozen ? 0 : I.move.y;
    const sprint = I.held('sprint') && !this.crouched && mz < 0;
    const sp = this.crouched ? this.speed.crouch : sprint ? this.speed.sprint : this.speed.walk;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const wx = (mx * cos + mz * sin) * sp, wz = (-mx * sin + mz * cos) * sp;
    const k = Math.min(1, dt * 12); this.vel.x += (wx - this.vel.x) * k; this.vel.z += (wz - this.vel.z) * k;
    const ox = this.pos.x, oz = this.pos.z;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    this.collide();
    const fy = this.floorAt(this.pos.x, this.pos.z, this.pos.y);
    if (fy - this.pos.y > 0.45) { this.pos.x = ox; this.pos.z = oz; } // too tall to step up
    else if (fy >= this.pos.y - 0.02) { this.pos.y += (fy - this.pos.y) * Math.min(1, dt * 14); this.vy = 0; } // stepping up stairs: smooth
    else { // walking off a ledge: fall under gravity instead of gliding down (Earth gravity unless the scene sets one)
      this.vy = (this.vy || 0) - (this.gravity ?? 9.81) * dt; this.pos.y += this.vy * dt;
      if (this.pos.y <= fy) { this.pos.y = fy; this.vy = 0; }
    }
    const d = Math.hypot(this.pos.x - ox, this.pos.z - oz); this.moved += d;
    // Head bob + footsteps
    if (d > 0.0005) {
      this.stepDist += d; this.bob += d * (sprint ? 2.6 : 3.1);
      const stride = sprint ? 0.95 : this.crouched ? 0.55 : 0.72;
      if (this.stepDist > stride) { this.stepDist = 0; sfx.step(this.surfaceAt(this.pos.x, this.pos.z, this.pos.y)); }
    }
    this.apply(dt);
  }
  collide() {
    const feet = this.pos.y + 0.25, top = this.pos.y + this.eye + 0.12;
    for (let it = 0; it < 3; it++) for (const c of this.colliders) {
      if (!c.on || c.y1 <= feet || c.y0 >= top) continue;
      const cx = Math.max(c.x0, Math.min(this.pos.x, c.x1)), cz = Math.max(c.z0, Math.min(this.pos.z, c.z1));
      let dx = this.pos.x - cx, dz = this.pos.z - cz; const dd = Math.hypot(dx, dz);
      if (dd >= RADIUS) continue;
      if (dd < 1e-5) { // centre inside the box: push out along the shortest axis
        const pen = [[this.pos.x - c.x0, -1, 0], [c.x1 - this.pos.x, 1, 0], [this.pos.z - c.z0, 0, -1], [c.z1 - this.pos.z, 0, 1]].sort((a, b) => a[0] - b[0])[0];
        this.pos.x += pen[1] * (pen[0] + RADIUS); this.pos.z += pen[2] * (pen[0] + RADIUS); continue;
      }
      const push = (RADIUS - dd) / dd; this.pos.x += dx * push; this.pos.z += dz * push;
    }
  }
  apply() {
    const bobOn = !settings.reducedMotion;
    const by = bobOn ? Math.sin(this.bob * 2) * 0.025 * Math.min(1, Math.hypot(this.vel.x, this.vel.z) / 2) : 0;
    this.camera.position.set(this.pos.x, this.pos.y + this.eye + by, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
  forward(out = new THREE.Vector3()) { return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
}
