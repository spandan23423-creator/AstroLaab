// ASTRO LAB Career — power-system hardware, the same models on the Academy test stand and on the Moon:
// solar panel on a turntable stand, charge controller, battery rack, load bus board, fuse box, and plug-in sockets.
import * as THREE from '../../../vendor/three.module.js';
import { MAT } from './materials.js';
import { std, box, cyl } from './house.js';
import { makeSign } from './props.js';
import { worldUI } from '../engine/layers.js';

let cellTex = null;
function solarCells() {
  if (cellTex) return cellTex;
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#0c1d44'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#13306e' : '#112a62'; x.fillRect(i * 32 + 1, j * 32 + 1, 30, 30); x.fillStyle = 'rgba(200,220,255,.18)'; x.fillRect(i * 32 + 1, j * 32 + 15, 30, 1); }
  cellTex = new THREE.CanvasTexture(c); cellTex.colorSpace = THREE.SRGBColorSpace; return cellTex;
}

// A socket people plug cables into. Colour by kind (PV yellow, battery red, load green). Returns the mesh.
const KIND_COL = { pv: 0xffc857, 'ctrl-pv': 0xffc857, 'ctrl-batt': 0xe0483a, batt: 0xe0483a, 'ctrl-load': 0x3fe0a0, bus: 0x3fe0a0 };
export function makeSocket(kind) {
  const g = new THREE.Group();
  const ring = cyl(0.045, 0.045, 0.03, MAT.glow(KIND_COL[kind] ?? 0xffffff, 0.8), 0, 0, 0, g, 16); ring.rotation.x = Math.PI / 2;
  cyl(0.028, 0.028, 0.035, std(0x15171c), 0, 0, 0.004, g, 12).rotation.x = Math.PI / 2;
  // a bigger invisible hit sphere, so the socket is easy to aim at (the ring itself is only 9 cm across)
  const hit = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.userData.hitbox = true; g.add(hit);
  g.userData.ring = ring; g.userData.kind = kind; return g;
}

// Solar panel: a cell array on a tilt frame, on a turntable post. userData: head (rotate .y to aim), tilt, socket, panel.
// deployed=false starts folded flat on the ground (call unfoldPanel to animate it up).
export function makeSolarPanel({ w = 1.6, hgt = 1.0, tilt = 0.35, post = 1.0 } = {}) {
  const g = new THREE.Group(), metal = MAT.metal(0xa8b0bc);
  cyl(0.28, 0.32, 0.08, std(0x3a3f4a), 0, 0.04, 0, g, 20);
  const head = new THREE.Group(); head.position.y = 0.08; g.add(head);
  cyl(0.04, 0.05, post, metal, 0, post / 2, 0, head, 10);
  const tiltG = new THREE.Group(); tiltG.position.y = post; tiltG.rotation.x = -(Math.PI / 2 - tilt); head.add(tiltG);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, 0.04), [metal, metal, metal, metal, std(0xffffff, { map: solarCells(), roughness: 0.25, metalness: 0.4 }), std(0xc8ccd4)]);
  panel.position.y = hgt / 2 - 0.1; panel.castShadow = true; tiltG.add(panel);
  box(w + 0.04, 0.03, 0.06, metal, 0, -0.1, 0, tiltG);
  const sock = makeSocket('pv'); sock.position.set(0.24, 0.3, 0.06); g.add(sock);
  box(0.16, 0.12, 0.06, std(0x2a2d33), 0.24, 0.3, 0.02, g);
  g.userData = { head, tilt: tiltG, tiltAngle: tilt, socket: sock, panel, deployed: 1 };
  return g;
}
// 0 = folded (panel lying low on its crate), 1 = up. Call every frame with a target.
export function setPanelDeploy(p, k) {
  const u = p.userData; u.deployed = k;
  u.head.scale.y = 0.15 + 0.85 * k; u.tilt.rotation.x = -(Math.PI / 2 - u.tiltAngle) * k - (Math.PI / 2) * (1 - k) * 0.98;
}

// Charge controller on a post or wall: display + three labelled sockets (PV in, BATTERY, LOAD out). userData.sockets, screen
export function makeController() {
  const g = new THREE.Group();
  box(0.7, 0.9, 0.18, std(0xe6e9ee, { roughness: 0.5 }), 0, 0, 0, g);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.26), new THREE.MeshStandardMaterial({ color: 0x0a1a2c, emissive: 0x1a6ad8, emissiveIntensity: 0.35, roughness: 0.2 })); scr.position.set(0, 0.22, 0.092); g.add(scr);
  const lab = makeSign('CHARGE CONTROLLER', 'PV in · Battery · Load out', 0.62, '#1f3a6b'); lab.position.set(0, 0.47 + 0.14, 0.095); g.add(lab);
  const sockets = {};
  [['ctrl-pv', 'PV IN', -0.2], ['ctrl-batt', 'BATT', 0], ['ctrl-load', 'LOAD', 0.2]].forEach(([kind, txt, x]) => {
    const s = makeSocket(kind); s.position.set(x, -0.15, 0.1); g.add(s); sockets[kind] = s;
    const t = makeSign(txt, '', 0.16, kind === 'ctrl-pv' ? '#7a5a10' : kind === 'ctrl-batt' ? '#7a1f18' : '#1f6b3a'); t.position.set(x, -0.3, 0.095); g.add(t);
  });
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData = { sockets, screen: scr }; return g;
}
// Battery rack: cabinet with 4 modules and charge LEDs. userData.socket, leds (for the charge display)
export function makeBatteryRack() {
  const g = new THREE.Group();
  box(0.9, 1.3, 0.6, std(0x2e3440, { roughness: 0.6 }), 0, 0.65, 0, g);
  const leds = [];
  for (let i = 0; i < 4; i++) { box(0.78, 0.24, 0.02, std(0x4a5262), 0, 0.22 + i * 0.29, 0.305, g); const l = box(0.06, 0.04, 0.01, MAT.glow(0x3fe0a0, 1.2), 0.3, 0.22 + i * 0.29, 0.318, g); leds.push(l); }
  const lab = makeSign('BATTERY', 'Li-ion bank', 0.7, '#7a1f18'); lab.position.set(0, 1.42, 0.0); g.add(lab);
  const s = makeSocket('batt'); s.position.set(-0.3, 1.1, 0.31); g.add(s);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData = { socket: s, leds }; return g;
}
export function setBatteryLeds(rack, socPct, on = true) {
  rack.userData.leds.forEach((l, i) => { const lit = on && socPct > i * 25 + 5; const c = !on ? 0x222222 : socPct < 20 ? 0xe0483a : 0x3fe0a0; l.material.color.set(lit ? c : 0x222222); l.material.emissive.set(lit ? c : 0x000000); });
}
// Load bus board: the habitat's power distribution panel with a breaker per machine. userData.socket, breakers {id: mesh}
export function makeBusBoard(loadIds = [], names = {}) {
  const g = new THREE.Group();
  box(1.2, 1.4, 0.12, std(0xd9dce2, { roughness: 0.5 }), 0, 0, 0, g);
  const lab = makeSign('LOAD BUS', 'Habitat power distribution', 1.0, '#1f6b3a'); lab.position.set(0, 0.92, 0.0); g.add(lab); // above the board, not half inside it
  const breakers = {};
  loadIds.forEach((id, i) => { const y = 0.5 - i * 0.13; const b = box(0.08, 0.06, 0.04, MAT.glow(0x3fe0a0, 0.8), -0.45, y, 0.07, g); breakers[id] = b; const t = makeSign(names[id] || id, '', 0.62, '#2a3550'); t.scale.setScalar(0.55); t.position.set(0.02, y, 0.075); g.add(t); worldUI(t); });
  const s = makeSocket('bus'); s.position.set(0.45, -0.58, 0.08); g.add(s);
  g.userData = { socket: s, breakers }; return g;
}
export function setBreakers(board, sim) {
  for (const [id, b] of Object.entries(board.userData.breakers)) { const l = sim.load(id); const c = !l ? 0x555555 : l.fuseBlown ? 0xe0483a : !l.on ? 0x555555 : l.powered ? 0x3fe0a0 : 0xffc857; b.material.color.set(c); b.material.emissive.set(c); }
}
// Fuse box with a hinged door. userData.door
export function makeFuseBox() {
  const g = new THREE.Group();
  box(0.5, 0.6, 0.14, std(0x9aa3b2, { roughness: 0.45, metalness: 0.3 }), 0, 0, 0, g);
  for (let i = 0; i < 6; i++) box(0.05, 0.12, 0.03, std(i === 1 ? 0x3a3a3a : 0xe8c24a), -0.15 + (i % 3) * 0.15, i < 3 ? 0.1 : -0.1, 0.075, g);
  const lab = makeSign('FUSES', '', 0.4, '#5a3a10'); lab.position.set(0, 0.38, 0.0); g.add(lab);
  return g;
}

// A sagging cable between two world points (yellow by default)
export function makeCable(a, b, col = 0x1b1d22) {
  const mid = a.clone().lerp(b, 0.5); const len = a.distanceTo(b); mid.y = Math.max(0.03, Math.min(a.y, b.y) - Math.min(0.6, len * 0.18));
  const pts = [a, a.clone().lerp(mid, 0.5).setY(Math.min(a.y, mid.y + 0.05)), mid, b.clone().lerp(mid, 0.5).setY(Math.min(b.y, mid.y + 0.05)), b];
  const curve = new THREE.CatmullRomCurve3(pts);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.014, 6, false), std(col, { roughness: 0.7 })); m.castShadow = true; return m;
}
