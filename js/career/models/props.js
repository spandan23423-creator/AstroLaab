// ASTRO LAB Career — reusable props: crate, shelf, sliding door, sign, floor ring, bench, locker, ceiling light.
import * as THREE from '../../../vendor/three.module.js';
import { TEX, MAT } from './materials.js';

export function makeCrate(size = 0.5) {
  const side = MAT.std({ map: TEX.crateSide(), roughness: 0.55 }), front = MAT.std({ map: TEX.crate(), roughness: 0.55 });
  // BoxGeometry face order: +x, -x, +y, -y, +z (label), -z
  const m = new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.8, size * 0.8), [side, side, side, side, front, side]);
  m.position.y = size * 0.4; m.castShadow = true; m.receiveShadow = true;
  const g = new THREE.Group(); g.add(m);
  const handle = MAT.metal(0x3b4252);
  for (const sx of [-1, 1]) { const hd = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.16), handle); hd.position.set(sx * (size / 2 + 0.01), size * 0.55, 0); g.add(hd); }
  return g;
}
export function makeShelf(w = 1.6, hgt = 2, d = 0.5, levels = [0.15, 0.95, 1.7]) {
  const g = new THREE.Group(), metal = MAT.metal(0x6d7686, { roughness: 0.5 }), board = MAT.std({ map: TEX.wood([1, 0.4]), roughness: 0.65 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.04, hgt, 0.04), metal); p.position.set(sx * (w / 2 - 0.02), hgt / 2, sz * (d / 2 - 0.02)); g.add(p); }
  for (const y of levels) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), board); b.position.y = y; b.receiveShadow = true; b.castShadow = true; g.add(b); }
  return g;
}
export function makeSlidingDoor(w = 1.2, hgt = 2.2, label = 'EXIT') {
  const g = new THREE.Group();
  const frame = MAT.metal(0x5a6274, { roughness: 0.45 });
  const fl = new THREE.Mesh(new THREE.BoxGeometry(0.08, hgt + 0.08, 0.16), frame); fl.position.set(-w / 2 - 0.04, hgt / 2, 0);
  const fr = fl.clone(); fr.position.x = w / 2 + 0.04; const ft = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.08, 0.16), frame); ft.position.y = hgt + 0.04;
  g.add(fl, fr, ft);
  const leaf = new THREE.Group();
  const panel = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, 0.06), MAT.std({ color: 0x9fb2cf, roughness: 0.35, metalness: 0.4 })); panel.position.y = hgt / 2; leaf.add(panel);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.5, 0.5), MAT.std({ color: 0x223355, roughness: 0.1, metalness: 0.2, emissive: 0x0a1630 })); win.position.set(0, hgt * 0.68, 0.031); leaf.add(win);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.6, w * 0.225), MAT.std({ map: TEX.sign(label), roughness: 0.6 })); sign.position.set(0, hgt * 0.42, 0.031); leaf.add(sign);
  leaf.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.add(leaf); g.userData.leaf = leaf; g.userData.w = w;
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.04), MAT.glow(0xff4455, 2)); lamp.position.set(0, hgt + 0.16, 0.06); g.add(lamp); g.userData.lamp = lamp;
  return g;
}
export function openDoor(door, dt, open = true) { const L = door.userData.leaf, target = open ? door.userData.w + 0.05 : 0; L.position.x += (target - L.position.x) * Math.min(1, dt * 3); return Math.abs(target - L.position.x) < 0.02; }
export function makeSign(text, sub = '', w = 1.6, col) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.375), MAT.std({ map: TEX.sign(text, sub, col), roughness: 0.6 })); return m; }
// A free-standing sign: the board is mounted on a backing panel held up by two posts set into the ground
// (instead of a bare sign floating in mid-air). centreY = height of the board's centre above the ground.
export function makeSignBoard(text, sub = '', w = 1.2, col, centreY = 1.25) {
  const g = new THREE.Group(), hgt = w * 0.375, metal = MAT.metal(0x8a8f99);
  const back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, hgt + 0.06, 0.04), MAT.std({ color: 0x2a2d33, roughness: 0.6 })); back.position.set(0, centreY, -0.03); g.add(back);
  const face = makeSign(text, sub, w, col); face.position.set(0, centreY, 0.0); g.add(face);
  face.material.polygonOffset = true; face.material.polygonOffsetFactor = -2; face.material.polygonOffsetUnits = -8; face.renderOrder = 2;
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, centreY + hgt / 2, 10), metal); post.position.set(sx * (w / 2 - 0.08), (centreY + hgt / 2) / 2, -0.07); g.add(post);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.06, 12), MAT.std({ color: 0x5a5048, roughness: 1 })); foot.position.set(sx * (w / 2 - 0.08), 0.03, -0.07); g.add(foot);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData.face = face; return g;
}
export function makeRing(r = 0.6, color = 0xffc857) {
  const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.8, r, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.01; return m;
}
export function makeBench(w = 1.6) {
  const g = new THREE.Group(), metal = MAT.metal(0x4c5566), seat = MAT.std({ map: TEX.wood([2, 0.3]) });
  const s = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 0.4), seat); s.position.y = 0.45; g.add(s);
  for (const sx of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.45, 0.36), metal); l.position.set(sx * (w / 2 - 0.1), 0.225, 0); g.add(l); }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
export function makeLocker(col = 0x3e5c8a) {
  const g = new THREE.Group(); const m = MAT.std({ color: col, roughness: 0.45, metalness: 0.45 });
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.9, 0.5), m); b.position.y = 0.95; g.add(b);
  for (let i = 0; i < 6; i++) { const v = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.015, 0.01), MAT.std({ color: 0x1a2233 })); v.position.set(0, 1.6 - i * 0.04, 0.255); g.add(v); }
  const hd = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.03), MAT.metal(0xcccccc)); hd.position.set(0.18, 1.0, 0.26); g.add(hd);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
export function makeCeilingLight(w = 1.2, d = 0.3) {
  const g = new THREE.Group();
  const housing = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.05, d + 0.06), MAT.metal(0xb0b6c2)); g.add(housing);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, d), MAT.glow(0xfff6e6, 2.2)); panel.rotation.x = Math.PI / 2; panel.position.y = -0.034; panel.material.polygonOffset = true; panel.material.polygonOffsetFactor = -1; panel.material.polygonOffsetUnits = -4; g.add(panel); /* clear of the housing's underside: at 1 mm apart the two flickered (z-fighting) in every room */
  return g;
}
