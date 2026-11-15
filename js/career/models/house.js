// ASTRO LAB Career — home furniture and building helpers (procedural).
import * as THREE from '../../../vendor/three.module.js';
import { TEX, MAT } from './materials.js';
import { drawEmblem } from '../ui/letter.js';
import { swapModel } from '../../assets/models.js';

export const std = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.7 }, o));
export function box(w, hgt, d, mat, x = 0, y = 0, z = 0, parent) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent?.add(m); return m; }
export function cyl(rt, rb, hgt, mat, x = 0, y = 0, z = 0, parent, seg = 20) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, hgt, seg), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent?.add(m); return m; }
const shadowAll = g => { g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g; };

// A wall slab from (x0,z0) to (x1,z1) between heights y0..y1, with a matching collider. Thin walls are 0.12 m.
export function wall(scene, player, x0, z0, x1, z1, y0, y1, mat, t = 0.12) {
  const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0);
  const m = new THREE.Mesh(new THREE.BoxGeometry(len, y1 - y0, t), typeof mat === 'function' ? mat(len, y1 - y0) : mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); m.rotation.y = -ang; m.receiveShadow = true; m.castShadow = true; scene.add(m);
  if (player) player.addBox(Math.min(x0, x1) - t / 2, Math.max(x0, x1) + t / 2, Math.min(z0, z1) - t / 2, Math.max(z0, z1) + t / 2, y0, y1);
  return m;
}
// A wall along x or z with door/window openings: gaps [{ at, w, y0?, y1? }] measured along the wall from its start
export function wallWithGaps(scene, player, axis, fixed, from, to, y0, y1, mat, gaps = []) {
  const P = (a, b) => axis === 'x' ? [a, fixed, b, fixed] : [fixed, a, fixed, b];
  let cur = from; const sorted = [...gaps].sort((a, b) => a.at - b.at);
  for (const g of sorted) {
    const a = g.at - g.w / 2, b = g.at + g.w / 2;
    if (a > cur) wall(scene, player, ...P(cur, a), y0, y1, mat);
    const gy0 = g.y0 ?? y0, gy1 = g.y1 ?? (y0 + 2.1);
    if (gy0 > y0 + 0.01) wall(scene, player, ...P(a, b), y0, gy0, mat);  // under a window
    if (gy1 < y1 - 0.01) wall(scene, null, ...P(a, b), gy1, y1, mat);   // lintel
    cur = b;
  }
  if (to > cur) wall(scene, player, ...P(cur, to), y0, y1, mat);
}
export function floorPlane(scene, x0, x1, z0, z1, y, mat, up = true) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat); m.rotation.x = up ? -Math.PI / 2 : Math.PI / 2; m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); m.receiveShadow = true; scene.add(m); return m;
}
// Window: frame + "view" pane (emissive so it reads as daylight) + sill
export function makeWindow(w = 1.6, hgt = 1.3, view = 'garden') {
  const g = new THREE.Group(), fm = std(0xf4f1ea, { roughness: 0.5 });
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), new THREE.MeshStandardMaterial({ map: TEX.view(view), emissive: 0xffffff, emissiveMap: TEX.view(view), emissiveIntensity: 0.9, roughness: 0.2 }));
  g.add(pane);
  box(w + 0.1, 0.06, 0.08, fm, 0, hgt / 2 + 0.03, 0.03, g); box(w + 0.1, 0.06, 0.08, fm, 0, -hgt / 2 - 0.03, 0.03, g);
  box(0.06, hgt, 0.08, fm, -w / 2 - 0.02, 0, 0.03, g); box(0.06, hgt, 0.08, fm, w / 2 + 0.02, 0, 0.03, g); box(0.04, hgt, 0.05, fm, 0, 0, 0.03, g); box(w, 0.04, 0.05, fm, 0, 0, 0.03, g);
  box(w + 0.24, 0.04, 0.2, fm, 0, -hgt / 2 - 0.07, 0.1, g);
  return g;
}
export function makeCurtains(w = 2, hgt = 1.8, col = 0x6d88b5) {
  const g = new THREE.Group(), m = std(col, { roughness: 0.95, side: THREE.DoubleSide });
  for (const sd of [-1, 1]) {
    const geo = new THREE.PlaneGeometry(w * 0.28, hgt, 12, 1); const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 40) * 0.035);
    geo.computeVertexNormals(); const c = new THREE.Mesh(geo, m); c.position.set(sd * (w / 2 - w * 0.14), 0, 0); c.castShadow = true; g.add(c);
  }
  cyl(0.015, 0.015, w + 0.3, MAT.metal(0x8a8f99), 0, hgt / 2 + 0.05, 0, g).rotation.z = Math.PI / 2;
  return g;
}
export function makeBed() {
  const g = new THREE.Group(), wood = std(0x8b5e3c, { map: TEX.wood([1, 1]) });
  box(1.7, 0.3, 2.15, wood, 0, 0.22, 0, g);                       // base
  box(1.7, 0.9, 0.08, wood, 0, 0.6, -1.06, g);                      // headboard
  box(1.62, 0.2, 2.05, std(0xf1efe9), 0, 0.47, 0.0, g);             // mattress
  const duvet = box(1.68, 0.12, 1.45, std(0x3f5f9a, { roughness: 0.95 }), 0, 0.6, 0.33, g); duvet.geometry.translate(0, 0, 0);
  box(1.68, 0.13, 0.25, std(0xeae6dc), 0, 0.605, -0.33, g);          // folded sheet
  for (const sd of [-1, 1]) { const p = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.4, 4, 10), std(0xf8f6f0, { roughness: 0.95 })); p.rotation.z = Math.PI / 2; p.scale.set(1, 1, 0.6); p.position.set(sd * 0.38, 0.65, -0.82); g.add(p); }
  return shadowAll(g);
}
export function makeNightstand() { const g = new THREE.Group(), w = std(0x8b5e3c, { map: TEX.wood([0.5, 0.5]) }); box(0.5, 0.55, 0.42, w, 0, 0.275, 0, g); box(0.42, 0.18, 0.02, std(0x7a5234), 0, 0.38, 0.215, g); cyl(0.015, 0.015, 0.02, MAT.metal(0xc9a14a), 0, 0.38, 0.23, g).rotation.x = Math.PI / 2; return g; }
export function makeAlarmClock() {
  const g = new THREE.Group();
  box(0.2, 0.11, 0.08, std(0x222630, { roughness: 0.4 }), 0, 0.055, 0, g);
  const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#05080a'; x.fillRect(0, 0, 128, 64); x.fillStyle = '#ff4a3a'; x.font = 'bold 44px monospace'; x.textAlign = 'center'; x.fillText('7:00', 64, 48);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.085), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.2 })); face.position.set(0, 0.055, 0.041); g.add(face);
  box(0.06, 0.015, 0.03, std(0x9aa0aa), 0, 0.118, 0, g); g.userData.face = face;
  // imported clock; the glowing 7:00 display stays on its screen
  swapModel(g, 'alarmclock', { size: 0.21, by: 'x' }, { keep: [face], after: h => { h.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(h), hgt = b.max.y - b.min.y; face.position.set(0, hgt * 0.47, b.max.z + 0.002); face.scale.set(0.92, 0.9, 1); } });
  return g;
}
export function makeDesk() {
  const g = new THREE.Group(), w = std(0xd8c3a0, { map: TEX.wood([1, 0.5]) }), metal = MAT.metal(0x3c4250);
  box(1.4, 0.04, 0.65, w, 0, 0.74, 0, g); for (const [x, z] of [[-0.65, -0.28], [0.65, -0.28], [-0.65, 0.28], [0.65, 0.28]]) box(0.04, 0.72, 0.04, metal, x, 0.36, z, g);
  // books + lamp
  const cols = [0xa83a3a, 0x3a6aa8, 0x3a9a5a, 0xd8a83a]; cols.forEach((c, i) => box(0.04, 0.24, 0.17, std(c), -0.6 + i * 0.045, 0.88, -0.2, g));
  cyl(0.07, 0.08, 0.02, metal, 0.5, 0.77, -0.15, g); const arm = cyl(0.01, 0.01, 0.35, metal, 0.5, 0.94, -0.15, g); arm.rotation.z = 0.2;
  const shade = cyl(0.03, 0.08, 0.1, std(0x2b3a6a), 0.46, 1.1, -0.12, g); shade.rotation.z = 0.6;
  // a notebook with a drawing of a rocket
  box(0.3, 0.01, 0.22, std(0xf3efe2), 0.05, 0.765, 0.05, g);
  return shadowAll(g);
}
export function makeChair(col = 0x2e3e66) { const g = new THREE.Group(), m = std(col), metal = MAT.metal(0x3c4250); box(0.45, 0.06, 0.45, m, 0, 0.46, 0, g); box(0.45, 0.45, 0.05, m, 0, 0.72, 0.21, g); for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) box(0.03, 0.44, 0.03, metal, x, 0.22, z, g); return shadowAll(g); }
export function makeTelescope() {
  // A proper refractor on an alt-azimuth tripod: three legs splayed out from a mount head, an accessory tray, a fork that
  // holds the tube, a dew shield, eyepiece and finder scope. The tube points along -z, tilted up about 35 degrees.
  const g = new THREE.Group(), metal = MAT.metal(0x2b2f38), steel = MAT.metal(0x9aa0aa), white = std(0xf2f2f2, { roughness: 0.35 }), black = std(0x15171c, { roughness: 0.6 });
  const HEAD = 1.05, SPREAD = 0.34, up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 3; i++) { // legs from the floor to the head
    const a = i / 3 * Math.PI * 2 + Math.PI / 6, foot = new THREE.Vector3(Math.cos(a) * SPREAD, 0, Math.sin(a) * SPREAD), top = new THREE.Vector3(Math.cos(a) * 0.05, HEAD - 0.04, Math.sin(a) * 0.05);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.016, foot.distanceTo(top), 8), metal); leg.position.copy(foot).add(top).multiplyScalar(0.5); leg.quaternion.setFromUnitVectors(up, top.clone().sub(foot).normalize()); g.add(leg);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), black); tip.position.copy(foot).setY(0.01); g.add(tip);
  }
  const tray = cyl(0.12, 0.12, 0.012, metal, 0, 0.42, 0, g, 3); tray.rotation.y = Math.PI / 6;           // accessory tray (spreader)
  cyl(0.07, 0.08, 0.06, metal, 0, HEAD, 0, g, 16);                                                      // mount head
  const az = new THREE.Group(); az.position.y = HEAD + 0.03; g.add(az);
  for (const sx of [-1, 1]) box(0.02, 0.2, 0.06, steel, sx * 0.1, 0.1, 0, az);                          // fork arms
  box(0.22, 0.02, 0.07, steel, 0, 0.0, 0, az);
  const alt = new THREE.Group(); alt.position.y = 0.17; alt.rotation.x = 0.6; az.add(alt);              // ~35 degrees up
  const tube = cyl(0.065, 0.065, 0.95, white, 0, 0, 0, alt, 24); tube.rotation.x = Math.PI / 2;          // optical tube along -z
  const dew = cyl(0.072, 0.072, 0.18, black, 0, 0, -0.52, alt, 24); dew.rotation.x = Math.PI / 2;       // dew shield at the front
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.062, 24), std(0x2a4a6a, { roughness: 0.05, metalness: 0.6 })); lens.position.z = -0.6; lens.rotation.y = Math.PI; alt.add(lens);
  const back = cyl(0.05, 0.06, 0.1, black, 0, 0, 0.52, alt, 16); back.rotation.x = Math.PI / 2;           // focuser
  const ep = cyl(0.018, 0.018, 0.1, black, 0, 0.06, 0.56, alt, 10); ep.rotation.x = -0.6;                 // eyepiece, angled up to the eye
  const fs = cyl(0.016, 0.016, 0.22, black, 0.08, 0.08, -0.1, alt, 10); fs.rotation.x = Math.PI / 2;      // finder scope
  box(0.02, 0.05, 0.02, steel, 0.06, 0.06, -0.1, alt);
  return shadowAll(g);
}
export function makeWardrobe() { const g = new THREE.Group(), w = std(0xe8e2d6, { roughness: 0.5 }); box(1.2, 2.1, 0.58, w, 0, 1.05, 0, g); box(0.01, 2.0, 0.01, std(0x9a9488), 0, 1.05, 0.295, g); for (const sd of [-1, 1]) cyl(0.01, 0.01, 0.18, MAT.metal(0xb0a080), sd * 0.06, 1.1, 0.31, g); return g; }
export function makeRocketModel() { const g = new THREE.Group(), w = std(0xf2f2f2, { roughness: 0.4 }), r = std(0xd23a3a); cyl(0.05, 0.05, 0.4, w, 0, 0.2, 0, g); const n = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 16), r); n.position.y = 0.47; g.add(n); for (let i = 0; i < 3; i++) { const f = box(0.004, 0.1, 0.07, r, 0, 0.05, 0, g); f.rotation.y = i * 2.09; f.translateZ(0.06); } return shadowAll(g); }
export function makePoster(kind) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.85), std(0xffffff, { map: TEX.poster(kind), roughness: 0.6 })); return m; }
export function makeFrame(seed = 0, w = 0.32, hgt = 0.4) { const g = new THREE.Group(); box(w + 0.05, hgt + 0.05, 0.03, std(0x3a2a1c), 0, 0, 0, g); const p = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), std(0xffffff, { map: TEX.photo(seed), roughness: 0.4 })); p.position.z = 0.016; g.add(p); return g; }
export function makeRug(w, d, a, b) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), std(0xffffff, { map: TEX.rug(a, b), roughness: 1 })); m.rotation.x = -Math.PI / 2; m.receiveShadow = true; return m; }
export function makeSofa(len = 2.1, col = 0x5a6e8c) {
  const g = new THREE.Group(), m = std(col, { roughness: 0.95 });
  box(len, 0.42, 0.9, m, 0, 0.21, 0, g); box(len, 0.5, 0.2, m, 0, 0.62, 0.35, g);
  for (const sd of [-1, 1]) box(0.18, 0.6, 0.9, m, sd * (len / 2 - 0.09), 0.3, 0, g);
  const n = Math.max(2, Math.round(len / 0.75)); for (let i = 0; i < n; i++) { const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, (len - 0.4) / n - 0.22, 4, 10), std(col + 0x080808, { roughness: 0.95 })); c.rotation.z = Math.PI / 2; c.scale.set(1, 1, 3.2); c.position.set(-len / 2 + 0.2 + (i + 0.5) * (len - 0.4) / n, 0.5, -0.02); g.add(c); }
  const cushion = box(0.4, 0.35, 0.12, std(0xd9a441, { roughness: 1 }), len / 2 - 0.4, 0.66, 0.2, g); cushion.rotation.set(-0.2, 0, 0.15);
  return shadowAll(g);
}
export function makeCoffeeTable() { const g = new THREE.Group(), w = std(0x6b4a2e, { map: TEX.wood([1, 0.6]) }); box(1.1, 0.05, 0.6, w, 0, 0.42, 0, g); for (const [x, z] of [[-0.5, -0.25], [0.5, -0.25], [-0.5, 0.25], [0.5, 0.25]]) box(0.05, 0.4, 0.05, w, x, 0.2, z, g); box(0.25, 0.02, 0.2, std(0xd8d0c0), -0.2, 0.455, 0.05, g); cyl(0.04, 0.035, 0.1, std(0xf2f2f2, { roughness: 0.3 }), 0.25, 0.5, -0.05, g); return shadowAll(g); }
export function makeTV() { const g = new THREE.Group(); box(1.8, 0.5, 0.45, std(0x3a2a20, { map: TEX.wood([1, 0.4]) }), 0, 0.25, 0, g); box(1.3, 0.75, 0.05, std(0x111216, { roughness: 0.25, metalness: 0.3 }), 0, 0.98, -0.05, g); const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.69), new THREE.MeshStandardMaterial({ color: 0x0a0d14, roughness: 0.1, metalness: 0.5 })); scr.position.set(0, 0.98, -0.018); g.add(scr); for (const [w, h2, x, y] of [[1.3, 0.04, 0, 0.98 + 0.355], [1.3, 0.04, 0, 0.98 - 0.355], [0.04, 0.75, 0.63, 0.98], [0.04, 0.75, -0.63, 0.98]]) box(w, h2, 0.012, std(0x111216, { roughness: 0.25, metalness: 0.3 }), x, y, -0.012, g); /* TV frame in front of the picture's edges */ box(0.3, 0.03, 0.2, std(0x111216), 0, 0.52, -0.05, g); return shadowAll(g); }
export function makeBookshelf(w = 1.8, hgt = 2.0) {
  const g = new THREE.Group(), wd = std(0x5c3d24, { map: TEX.wood([1, 1]) }); box(w, hgt, 0.04, wd, 0, hgt / 2, -0.16, g);
  for (const sd of [-1, 1]) box(0.04, hgt, 0.34, wd, sd * w / 2, hgt / 2, 0, g);
  const cols = [0xa83a3a, 0x3a6aa8, 0x3a9a5a, 0xd8a83a, 0x6a3a8a, 0xe6e0d0, 0x2a2a2a];
  for (let s = 0; s < 5; s++) { const y = 0.04 + s * hgt / 5; box(w, 0.03, 0.32, wd, 0, y, 0, g); let x = -w / 2 + 0.05; while (x < w / 2 - 0.12) { const bw = 0.03 + Math.random() * 0.03, bh = 0.2 + Math.random() * 0.12; if (Math.random() < 0.85) { const bk = box(bw, bh, 0.22, std(cols[(Math.random() * cols.length) | 0], { roughness: 0.8 }), x + bw / 2, y + 0.015 + bh / 2, 0.02, g); if (Math.random() < 0.1) bk.rotation.z = 0.25; } x += bw + 0.004; } }
  return shadowAll(g);
}
export function makeFloorLamp() { const g = new THREE.Group(), metal = MAT.metal(0x2a2d33); cyl(0.16, 0.18, 0.03, metal, 0, 0.015, 0, g); cyl(0.012, 0.012, 1.5, metal, 0, 0.76, 0, g); const sh = cyl(0.14, 0.22, 0.28, std(0xf1e4c8, { emissive: 0xffd9a0, emissiveIntensity: 0.6, side: THREE.DoubleSide }), 0, 1.55, 0, g); sh.castShadow = false; return g; }
export function makePlant(sc = 1) { const g = new THREE.Group(); cyl(0.14 * sc, 0.11 * sc, 0.28 * sc, std(0xb5643c), 0, 0.14 * sc, 0, g); for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.12 * sc, 8, 6), std(i % 2 ? 0x3f7d3a : 0x4f9a45)); l.position.set(Math.cos(i * 1.7) * 0.12 * sc, (0.4 + (i % 3) * 0.12) * sc, Math.sin(i * 1.7) * 0.12 * sc); l.scale.set(1, 1.4, 0.6); l.castShadow = true; g.add(l); } return g; }
export function makeCounter(len = 3) {
  const g = new THREE.Group(), cab = std(0x5e7a6a, { roughness: 0.6 }), top = std(0xe8e4dc, { roughness: 0.3 });
  box(len, 0.88, 0.6, cab, 0, 0.44, 0, g); box(len + 0.04, 0.04, 0.64, top, 0, 0.9, 0, g);
  for (let i = 0; i < Math.floor(len / 0.6); i++) box(0.01, 0.7, 0.01, std(0x445a4e), -len / 2 + 0.6 * (i + 1), 0.44, 0.301, g);
  box(0.5, 0.02, 0.4, MAT.metal(0xc0c4c8), len / 2 - 0.6, 0.915, 0, g); // sink
  cyl(0.012, 0.012, 0.25, MAT.metal(0xc0c4c8), len / 2 - 0.6, 1.03, -0.22, g);
  cyl(0.09, 0.1, 0.22, std(0xd23a3a, { roughness: 0.3 }), -len / 2 + 0.4, 1.03, 0, g); // kettle
  return shadowAll(g);
}
export function makeFridge() { const g = new THREE.Group(), w = std(0xeef0f2, { roughness: 0.3, metalness: 0.2 }); box(0.75, 1.85, 0.68, w, 0, 0.925, 0, g); box(0.73, 0.01, 0.01, std(0xa0a4a8), 0, 1.25, 0.345, g); box(0.03, 0.4, 0.03, MAT.metal(0xb0b4b8), 0.3, 1.5, 0.36, g); box(0.03, 0.3, 0.03, MAT.metal(0xb0b4b8), 0.3, 0.9, 0.36, g); return g; }
export function makeTable(w = 1.4, d = 0.85) { const g = new THREE.Group(), wd = std(0x8a6240, { map: TEX.wood([1, 0.6]) }); box(w, 0.05, d, wd, 0, 0.75, 0, g); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(0.06, 0.73, 0.06, wd, x * (w / 2 - 0.08), 0.365, z * (d / 2 - 0.08), g); cyl(0.12, 0.1, 0.06, std(0xe8e0d0), 0, 0.81, 0, g); return shadowAll(g); }
export function makeHingedDoor(w = 0.9, hgt = 2.05, col = 0xf3efe6, { knobSide = 1 } = {}) {
  const g = new THREE.Group(); const leaf = new THREE.Group(); g.add(leaf);
  const p = box(w, hgt, 0.045, std(col, { roughness: 0.55 }), w / 2, hgt / 2, 0, leaf);
  for (const y of [0.55, 1.45]) box(w * 0.7, 0.6, 0.01, std(col - 0x0a0a0a, { roughness: 0.6 }), w / 2, y, 0.027, leaf);
  for (const sd of [-1, 1]) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), MAT.metal(0xc9a14a)); k.position.set(w - 0.08, 1.0, sd * 0.045); leaf.add(k); }
  g.userData.leaf = leaf; g.userData.open = 0; void p; void knobSide;
  return g;
}
export function makeEnvelope() {
  const g = new THREE.Group();
  const c = document.createElement('canvas'); c.width = 512; c.height = 320; const x = c.getContext('2d');
  x.fillStyle = '#f4efe2'; x.fillRect(0, 0, 512, 320); x.fillStyle = 'rgba(0,0,0,.04)'; for (let i = 0; i < 400; i++) x.fillRect(Math.random() * 512, Math.random() * 320, 2, 2);
  drawEmblem(x, 80, 80, 52);
  x.fillStyle = '#0d2f6e'; x.font = 'bold 20px system-ui'; x.fillText('JUNIOR ASTRONAUT', 150, 66); x.fillText('TRAINING PROGRAM', 150, 92); x.font = '16px system-ui'; x.fillStyle = '#556'; x.fillText('Official correspondence', 150, 116);
  x.fillStyle = '#c8202a'; x.save(); x.translate(400, 240); x.rotate(-0.2); x.strokeStyle = '#c8202a'; x.lineWidth = 4; x.strokeRect(-70, -24, 140, 48); x.font = 'bold 22px system-ui'; x.textAlign = 'center'; x.fillText('ACCEPTED', 0, 8); x.restore();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const paper = std(0xf4efe2, { roughness: 0.85 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.006, 0.15), [paper, paper, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }), paper, paper, paper]); g.add(body);
  const flapG = new THREE.BufferGeometry(); flapG.setAttribute('position', new THREE.Float32BufferAttribute([-0.12, 0, 0, 0.12, 0, 0, 0, 0, 0.075], 3)); flapG.computeVertexNormals();
  const hinge = new THREE.Group(); hinge.position.set(0, -0.0035, -0.075); const flap = new THREE.Mesh(flapG, std(0xece5d2, { side: THREE.DoubleSide })); hinge.add(flap); g.add(hinge); hinge.rotation.x = 0; // closed: folded over the back; opening swings it to PI
  const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.004, 18), std(0xb3202a, { roughness: 0.4 })); seal.position.set(0, -0.006, 0.0); g.add(seal);
  const letter = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.002, 0.14), std(0xfbf8ef)); letter.position.y = 0; letter.visible = false; g.add(letter);
  g.userData = { hinge, letter, seal };
  return g;
}
