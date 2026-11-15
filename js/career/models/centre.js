// ASTRO LAB Career — training centre furniture and equipment: counters, kiosks, terminals, wall screens, scanner gate, chairs.
import * as THREE from '../../../vendor/three.module.js';
import { MAT } from './materials.js';
import { std, box, cyl } from './house.js';
import { drawEmblem } from '../ui/letter.js';

const shadowAll = g => { g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g; };

// A canvas "screen" texture. draw(ctx, w, h) paints it; returns { tex, redraw(fn) }.
export function screenTex(w = 512, hgt = 320, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = hgt; const x = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const redraw = fn => { x.clearRect(0, 0, w, hgt); (fn || draw)(x, w, hgt); tex.needsUpdate = true; };
  redraw(draw); return { tex, redraw, canvas: c };
}
// Standard look for an info screen: dark blue, title bar, lines of text
export function infoScreen(title, lines = [], { accent = '#5ad8ff', w = 512, hgt = 320 } = {}) {
  return (x) => {
    const g = x.createLinearGradient(0, 0, 0, hgt); g.addColorStop(0, '#0b1830'); g.addColorStop(1, '#0a1022'); x.fillStyle = g; x.fillRect(0, 0, w, hgt);
    x.fillStyle = accent; x.fillRect(0, 0, w, 6); x.font = `bold ${Math.round(hgt * 0.085)}px system-ui, sans-serif`; x.fillStyle = '#fff'; x.fillText(title, 20, hgt * 0.15);
    x.font = `${Math.round(hgt * 0.06)}px system-ui, sans-serif`;
    lines.forEach((l, i) => { const [t, col] = Array.isArray(l) ? l : [l, '#c9d6ff']; x.fillStyle = col; x.fillText(t, 20, hgt * 0.28 + i * hgt * 0.095); });
  };
}
export function makeScreen(wm, hm, drawFn, px = [512, 320]) {
  const s = screenTex(px[0], px[1], drawFn);
  const g = new THREE.Group();
  const bezel = std(0x1a1d24, { roughness: 0.4 });
  box(wm + 0.08, hm + 0.08, 0.06, bezel, 0, 0, -0.03, g);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(wm, hm), new THREE.MeshStandardMaterial({ map: s.tex, emissive: 0xffffff, emissiveMap: s.tex, emissiveIntensity: 0.85, roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 })); face.position.z = 0.006; g.add(face);
  // the border is a raised frame in front of the picture's edges (it used to be only the box behind it, so on big screens
  // it flickered with the picture and looked like it was drawn behind it)
  const fb = 0.04, fz = 0.012; box(wm + 0.08, fb, 0.016, bezel, 0, hm / 2 + 0.02, fz, g); box(wm + 0.08, fb, 0.016, bezel, 0, -hm / 2 - 0.02, fz, g); box(fb, hm + 0.08, 0.016, bezel, wm / 2 + 0.02, 0, fz, g); box(fb, hm + 0.08, 0.016, bezel, -wm / 2 - 0.02, 0, fz, g);
  g.userData.screen = s; g.userData.face = face; return g;
}
// Reception counter: an L of desk with a raised front and a glowing strip
export function makeCounter(len = 3.2) {
  const g = new THREE.Group(), front = std(0xf1f3f6, { roughness: 0.4 }), top = std(0x2b4f8f, { roughness: 0.3 });
  box(len, 1.1, 0.25, front, 0, 0.55, 0.35, g); box(len + 0.1, 0.05, 0.4, top, 0, 1.12, 0.35, g);
  box(len, 0.75, 0.6, std(0xdfe3ea, { roughness: 0.6 }), 0, 0.375, -0.1, g); box(len, 0.04, 0.7, std(0xc9cdd6, { roughness: 0.4 }), 0, 0.77, -0.1, g);
  box(len, 0.04, 0.02, MAT.glow(0x5ad8ff, 1.2), 0, 0.2, 0.48, g);
  const mon = box(0.5, 0.32, 0.03, std(0x111216, { roughness: 0.3 }), -len / 4, 1.0, -0.2, g); mon.rotation.y = Math.PI; void mon;
  return shadowAll(g);
}
// Self-service kiosk with a camera and a screen (front faces +z)
export function makeKiosk(drawFn) {
  const g = new THREE.Group(), body = std(0xe8ebf0, { roughness: 0.35 });
  box(0.7, 1.0, 0.45, body, 0, 0.5, 0, g); const head = box(0.7, 0.75, 0.12, body, 0, 1.4, -0.12, g); head.rotation.x = -0.15;
  const scr = makeScreen(0.58, 0.4, drawFn, [384, 264]); scr.position.set(0, 1.42, -0.05); scr.rotation.x = -0.15; g.add(scr); g.userData.screen = scr.userData.screen;
  cyl(0.035, 0.035, 0.03, std(0x111216), 0, 1.86, -0.08, g).rotation.x = Math.PI / 2; box(0.02, 0.02, 0.01, MAT.glow(0x3fe0a0, 2), 0.06, 1.86, -0.06, g);
  box(0.7, 0.04, 0.5, std(0x2b4f8f), 0, 1.02, 0.02, g);
  return shadowAll(g);
}
// Card printer with an output tray
export function makePrinter() {
  const g = new THREE.Group(); box(0.45, 0.3, 0.4, std(0x2a2d33, { roughness: 0.5 }), 0, 0.15, 0, g); box(0.3, 0.02, 0.14, std(0x111216), 0, 0.12, 0.26, g);
  box(0.06, 0.02, 0.01, MAT.glow(0x3fe0a0, 1.6), 0.15, 0.27, 0.201, g); g.userData.lamp = g.children[g.children.length - 1];
  return shadowAll(g);
}
export function makeStand(hgt = 0.95) { const g = new THREE.Group(); box(0.6, hgt, 0.5, std(0xd9dce2, { roughness: 0.5 }), 0, hgt / 2, 0, g); return shadowAll(g); }
// Standing console: pedestal + angled touch screen (front faces +z)
export function makeTerminal(drawFn) {
  const g = new THREE.Group(); cyl(0.12, 0.18, 1.0, MAT.metal(0x8a8f99), 0, 0.5, 0, g, 16); box(0.5, 0.04, 0.45, MAT.metal(0x6a707c), 0, 0.02, 0, g);
  const scr = makeScreen(0.62, 0.42, drawFn, [448, 304]); scr.position.set(0, 1.18, 0.02); scr.rotation.x = -0.55; g.add(scr); g.userData.screen = scr.userData.screen;
  return shadowAll(g);
}
// Walk-through body scanner arch with a status lamp
export function makeScannerArch() {
  const g = new THREE.Group(), m = std(0xd9dce2, { roughness: 0.4 });
  box(0.22, 2.3, 0.6, m, -0.65, 1.15, 0, g); box(0.22, 2.3, 0.6, m, 0.65, 1.15, 0, g); box(1.52, 0.25, 0.6, m, 0, 2.42, 0, g);
  const lamp = box(0.5, 0.08, 0.04, MAT.glow(0xff4455, 1.5), 0, 2.42, 0.32, g); g.userData.lamp = lamp;
  for (const sx of [-1, 1]) box(0.02, 1.9, 0.4, MAT.glow(0x5ad8ff, 0.5), sx * 0.535, 1.15, 0, g);
  return shadowAll(g);
}
export function setLamp(lamp, col) { lamp.material.color.set(col); lamp.material.emissive.set(col); }
export function makeChairRow(n = 4, col = 0x2b4f8f) {
  const g = new THREE.Group(), m = std(col, { roughness: 0.7 }), metal = MAT.metal(0x8a8f99);
  for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * 0.6; box(0.5, 0.06, 0.48, m, x, 0.46, 0, g); box(0.5, 0.48, 0.05, m, x, 0.72, 0.22, g); }
  box(n * 0.6, 0.04, 0.05, metal, 0, 0.4, 0, g); for (const x of [-(n * 0.3) + 0.1, n * 0.3 - 0.1]) box(0.04, 0.4, 0.4, metal, x, 0.2, 0, g);
  return shadowAll(g);
}
export function makeEmblemPlaque(r = 1.1) {
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'); drawEmblem(x, 256, 256, 240);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.5 }));
}
// A clipboard with paper (for the agreement)
export function makeClipboard() { const g = new THREE.Group(); box(0.26, 0.01, 0.34, std(0x8a6240), 0, 0.005, 0, g); box(0.22, 0.004, 0.3, std(0xfbf8ef), 0, 0.012, 0.01, g); box(0.1, 0.012, 0.03, MAT.metal(0xc0c4c8), 0, 0.016, -0.15, g); const pen = cyl(0.006, 0.006, 0.15, std(0x0d2f6e), 0.16, 0.01, 0, g, 8); pen.rotation.x = Math.PI / 2; return g; }
// A big hanging model satellite for the atrium
export function makeSatelliteModel() {
  const g = new THREE.Group(); box(0.8, 0.8, 1.2, std(0xd9b44a, { roughness: 0.45, metalness: 0.25 }), 0, 0, 0, g); // gold foil body (very metallic gold rendered almost black indoors, with nothing to reflect)
  for (const sx of [-1, 1]) { const p = box(2.4, 0.04, 0.9, std(0x2a55a8, { roughness: 0.35, metalness: 0.2, emissive: 0x0a1a3a, emissiveIntensity: 0.4 }), sx * 1.7, 0, 0, g); box(2.44, 0.03, 0.04, MAT.metal(), sx * 1.7, 0, 0.45, g); box(2.44, 0.03, 0.04, MAT.metal(), sx * 1.7, 0, -0.45, g); void p; cyl(0.02, 0.02, 0.5, MAT.metal(), sx * 0.6, 0, 0, g).rotation.z = Math.PI / 2; } // solar wings with frames
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 10, 0, Math.PI * 2, 0, 1.0), std(0xf2f2f2, { side: THREE.DoubleSide })); dish.rotation.x = -Math.PI / 2; dish.position.z = 1.1; g.add(dish); cyl(0.04, 0.04, 0.3, MAT.metal(), 0, 0, 0.75, g, 8).rotation.x = Math.PI / 2; // dish opens outwards, on a short boom (it used to cut into the body)
  return shadowAll(g);
}
