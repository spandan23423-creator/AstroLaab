// ASTRO LAB Career — outdoor models: the family car (with a full interior), roadside scenery, the training centre and a display rocket.
import * as THREE from '../../../vendor/three.module.js';
import { TEX, MAT } from './materials.js';
import { std, box, cyl } from './house.js';
import { drawEmblem } from '../ui/letter.js';
import { makeSign } from './props.js';
import { swapModel } from '../../assets/models.js';

const shadowAll = g => { g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g; };

// Car: faces -z, centre at the origin on the ground. A shaped body (extruded side profile with wheel arches),
// a glazed cabin with pillars, four opening doors, spinning and steering wheels, lights, bumpers, grille and plates.
// userData: wheels (spin groups, rotate .x), steerWheels (front, rotate .y), doors [{ g, side, front }], steer (steering wheel)
const W2 = 0.88; // half width of the body
function carProfile(sh, pts) { sh.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) { const p = pts[i]; if (p.arc) sh.absarc(p.arc[0], p.arc[1], p.arc[2], p.arc[3], p.arc[4], false); else sh.lineTo(p[0], p[1]); } return sh; }
function extrudeSide(shape, depth, mat, bevel = 0.03) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 14 });
  geo.rotateY(-Math.PI / 2); geo.translate(depth / 2, 0, 0); // shape x -> car z, extrusion -> car x (centred)
  return new THREE.Mesh(geo, mat);
}
function quad(a, b, c, d, mat) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3)); g.computeVertexNormals(); return new THREE.Mesh(g, mat); }
function plateTex(text) { const c = document.createElement('canvas'); c.width = 128; c.height = 32; const x = c.getContext('2d'); x.fillStyle = '#f4f4ee'; x.fillRect(0, 0, 128, 32); x.strokeStyle = '#222'; x.lineWidth = 3; x.strokeRect(2, 2, 124, 28); x.fillStyle = '#1a1a1a'; x.font = 'bold 20px monospace'; x.textAlign = 'center'; x.fillText(text, 64, 23); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
export function makeCar(color = 0x3a6ea5, { interior = true } = {}) {
  const g = new THREE.Group();
  const paint = std(color, { roughness: 0.28, metalness: 0.5 }), dark = std(0x16181d, { roughness: 0.85 }), trim = std(0x2a2d33, { roughness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x7fa6c4, transparent: true, opacity: 0.28, roughness: 0.04, metalness: 0.4, side: THREE.DoubleSide, depthWrite: false });
  const seatM = std(0x767c88, { roughness: 0.95 }), chrome = MAT.metal(0xd0d4da);
  const arch = (cx) => ({ arc: [cx, 0.33, 0.42, 0, Math.PI] });
  // nose (bonnet + front wings) and tail (boot + rear wings): full-width solid blocks with the wheel arches cut out
  const nose = carProfile(new THREE.Shape(), [[-2.18, 0.26], [-2.26, 0.42], [-2.25, 0.66], [-2.1, 0.79], [-0.95, 0.9], [-0.95, 0.458], { arc: [-1.35, 0.33, 0.42, 0.31, Math.PI] }, [-2.18, 0.26]]);
  void arch;
  const tailFix = carProfile(new THREE.Shape(), [[2.12, 0.26], [2.22, 0.4], [2.25, 0.72], [2.12, 0.9], [1.45, 0.95], [1.45, 0.738]]);
  tailFix.absarc(1.35, 0.33, 0.42, 1.33, 0, true); tailFix.lineTo(1.77, 0.26); tailFix.lineTo(2.12, 0.26);
  const noseM = extrudeSide(nose, W2 * 2 - 0.06, paint); g.add(noseM);
  const tailM = extrudeSide(tailFix, W2 * 2 - 0.06, paint); g.add(tailM);
  // rear wheel arch top (between the cabin and the boot)
  const rArch = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, W2 * 2 - 0.08, 24, 1, true, 0, Math.PI), std(0x111216, { roughness: 1, side: THREE.DoubleSide })); rArch.rotation.z = Math.PI / 2; rArch.position.set(0, 0.33, 1.35); g.add(rArch);
  const fArch = rArch.clone(); fArch.position.z = -1.35; g.add(fArch);
  // side panels (the full side profile, thin) with sills; the doors sit on top of them
  const side = carProfile(new THREE.Shape(), [[-0.95, 0.9], [1.45, 0.95], [1.45, 0.738], { arc: [1.35, 0.33, 0.42, 1.33, Math.PI] }, [0.93, 0.3], [-0.93, 0.3], { arc: [-1.35, 0.33, 0.42, 0, 0.31] }, [-0.95, 0.9]]);
  for (const sx of [-1, 1]) { const sp = extrudeSide(side, 0.04, paint, 0.01); sp.position.x = sx * (W2 - 0.03); g.add(sp); box(0.06, 0.08, 2.4, trim, sx * (W2 - 0.01), 0.3, 0.25, g); }
  // cabin: pillars, roof, glass
  const A0 = z => [-0.95, 0.9], roofF = -0.22, roofR = 0.98, roofY = 1.43; void A0;
  for (const sx of [-1, 1]) {
    const x0 = sx * (W2 - 0.04), x1 = sx * (W2 - 0.14);
    const pil = (a, b, r = 0.035) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b); const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, A.distanceTo(B), 10), paint); m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); g.add(m); };
    pil([x0, 0.9, -0.95], [x1, roofY, roofF]); pil([x0, 0.95, 1.6], [x1, roofY, roofR]); pil([x0 * 0.99, 0.93, 0.35], [x1, roofY, 0.35], 0.04);
    // side windows (front and rear), slightly inside the pillars
    const xs = sx * (W2 - 0.09);
    g.add(quad([xs, 0.93, -0.88], [xs, 0.94, 0.3], [xs, roofY - 0.04, 0.3], [xs, roofY - 0.04, roofF + 0.06], glass));
    g.add(quad([xs, 0.94, 0.4], [xs, 0.95, 1.52], [xs, roofY - 0.04, roofR + 0.04], [xs, roofY - 0.04, 0.4], glass));
    box(0.03, 0.03, 2.5, chrome, sx * (W2 - 0.02), 0.95, 0.3, g);                          // window-line trim
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.06, roofR - roofF + 0.1, 1, 1, 1), paint); roof.position.set(0, roofY + 0.02, (roofF + roofR) / 2); g.add(roof);
  g.add(quad([-0.8, 0.9, -0.95], [0.8, 0.9, -0.95], [0.72, roofY, roofF], [-0.72, roofY, roofF], glass));       // windscreen
  g.add(quad([-0.8, 0.95, 1.6], [0.8, 0.95, 1.6], [0.72, roofY, roofR], [-0.72, roofY, roofR], glass));          // rear window
  for (const sx of [-1, 1]) { const wp = box(0.5, 0.012, 0.02, dark, sx * 0.3, 0.93, -0.9, g); wp.rotation.y = sx * 0.12; } // wipers
  // doors: four panels that open on hinges at their front edge
  const doors = [];
  for (const sx of [-1, 1]) for (const [z0, z1, front] of [[-0.93, 0.33, true], [0.37, 0.92, false]]) {
    const pivot = new THREE.Group(); pivot.position.set(sx * (W2 + 0.005), 0, z0); g.add(pivot);
    const len = z1 - z0; box(0.035, 0.6, len, paint, 0, 0.62, len / 2, pivot);
    box(0.02, 0.025, 0.16, chrome, sx * 0.025, 0.82, len - 0.22, pivot);                 // handle
    box(0.01, 0.6, 0.008, dark, 0, 0.62, 0.004, pivot); box(0.01, 0.6, 0.008, dark, 0, 0.62, len - 0.004, pivot); // shut lines
    if (front) { const mir = box(0.16, 0.1, 0.08, paint, sx * 0.1, 0.98, 0.1, pivot); void mir; box(0.01, 0.08, 0.06, std(0x9fb3c4, { roughness: 0.05, metalness: 0.9 }), sx * 0.18, 0.98, 0.1, pivot); }
    doors.push({ g: pivot, side: sx, front, open: 0 });
  }
  // front: bumper, grille, headlights, plate; back: bumper, tail lights, plate
  box(1.84, 0.2, 0.16, trim, 0, 0.36, -2.24, g); box(1.84, 0.2, 0.16, trim, 0, 0.36, 2.22, g);
  box(0.9, 0.18, 0.04, dark, 0, 0.6, -2.255, g); for (let i = 0; i < 4; i++) box(0.88, 0.012, 0.02, chrome, 0, 0.54 + i * 0.04, -2.27, g);
  for (const sx of [-1, 1]) {
    box(0.36, 0.13, 0.05, std(0xdfe6ee, { roughness: 0.1, metalness: 0.6 }), sx * 0.66, 0.66, -2.23, g); box(0.26, 0.08, 0.02, MAT.glow(0xfff6d8, 1.4), sx * 0.66, 0.66, -2.26, g);
    box(0.34, 0.12, 0.04, MAT.glow(0xd8202a, 0.9), sx * 0.66, 0.72, 2.235, g); box(0.1, 0.12, 0.042, MAT.glow(0xffa030, 0.5), sx * 0.44, 0.72, 2.236, g);
  }
  for (const [z, ry] of [[-2.33, Math.PI], [2.31, 0]]) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.11), new THREE.MeshStandardMaterial({ map: plateTex('AL·2026'), roughness: 0.5 })); pl.position.set(0, 0.36, z); pl.rotation.y = ry; g.add(pl); }
  // wheels: tyre, rim, five spokes and a hub cap, in a spin group (front ones also steer)
  g.userData.wheels = []; g.userData.steerWheels = [];
  for (const sx of [-1, 1]) for (const z of [-1.35, 1.35]) {
    const steer = new THREE.Group(); steer.position.set(sx * (W2 - 0.1), 0.33, z); g.add(steer);
    const spin = new THREE.Group(); steer.add(spin);
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.22, 28), dark); tyre.rotation.z = Math.PI / 2; spin.add(tyre);
    const sidewall = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.045, 8, 28), dark); sidewall.rotation.y = Math.PI / 2; sidewall.position.x = sx * 0.1; spin.add(sidewall);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.225, 24), chrome); rim.rotation.z = Math.PI / 2; spin.add(rim);
    for (let i = 0; i < 5; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.36, 0.05), std(0x9aa0aa, { metalness: 0.7, roughness: 0.3 })); sp.position.x = sx * 0.115; sp.rotation.x = i * Math.PI * 2 / 5; spin.add(sp); }
    const capM = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.24, 14), chrome); capM.rotation.z = Math.PI / 2; spin.add(capM);
    g.userData.wheels.push(spin); if (z < 0) g.userData.steerWheels.push(steer);
  }
  g.userData.doors = doors;
  // a car seen only from outside still needs a cabin behind the glass
  if (!interior) {
    box(1.6, 0.06, 2.3, std(0x30333a, { roughness: 1 }), 0, 0.4, 0.25, g);
    box(1.6, 0.3, 0.4, std(0x3a3e46, { roughness: 0.7 }), 0, 0.88, -0.98, g);
    for (const sx of [-1, 1]) { box(0.5, 0.12, 0.5, seatM, sx * 0.4, 0.55, -0.15, g); const bk = box(0.5, 0.55, 0.1, seatM, sx * 0.4, 0.86, 0.12, g); bk.rotation.x = -0.12; }
    box(1.5, 0.14, 0.55, seatM, 0, 0.55, 0.78, g); box(1.5, 0.6, 0.12, seatM, 0, 0.88, 1.08, g);
    box(1.5, 0.02, 1.2, std(0xd9d6cf, { roughness: 1 }), 0, roofY - 0.02, 0.38, g);
  }
  if (interior) {
    box(1.7, 0.05, 2.5, std(0x30333a, { roughness: 1 }), 0, 0.36, 0.15, g);               // floor
    box(1.7, 0.3, 0.45, std(0x3a3e46, { roughness: 0.7 }), 0, 0.86, -1.0, g);                                             // dashboard
    box(0.5, 0.1, 0.02, MAT.glow(0x7ad8ff, 0.6), -0.4, 0.98, -0.77, g);                       // instrument cluster glow
    box(0.25, 0.14, 0.02, std(0x0b0d12, { roughness: 0.2 }), 0, 0.98, -0.77, g);              // radio screen
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.022, 10, 28), dark); wheel.position.set(-0.4, 1.0, -0.62); wheel.rotation.x = -0.35; g.add(wheel); g.userData.steer = wheel;
    cyl(0.02, 0.02, 0.25, dark, -0.4, 0.95, -0.72, g).rotation.x = Math.PI / 2 - 0.35;
    for (const sx of [-1, 1]) { // front seats
      box(0.55, 0.12, 0.5, seatM, sx * 0.4, 0.55, -0.15, g);
      const bk = box(0.5, 0.52, 0.1, seatM, sx * 0.4, 0.86, 0.12, g); bk.rotation.x = -0.12;
      box(0.22, 0.15, 0.08, seatM, sx * 0.4, 1.22, 0.15, g);                                  // headrest
      box(0.04, 0.5, 2.3, std(0x5a5f6a, { roughness: 0.9 }), sx * 0.84, 0.75, 0.15, g);       // inner door trim
      box(0.08, 0.04, 0.5, trim, sx * 0.82, 0.86, 0.75, g);                                   // armrest
    }
    box(1.5, 0.14, 0.55, seatM, 0, 0.55, 0.78, g);                                           // rear bench
    const rb = box(1.5, 0.62, 0.12, seatM, 0, 0.88, 1.08, g); rb.rotation.x = -0.15;
    box(1.6, 0.04, 0.35, trim, 0, 1.0, 1.32, g);                                              // parcel shelf
    box(1.55, 0.02, 1.5, std(0xd9d6cf, { roughness: 1, emissive: 0x3a3832 }), 0, 1.43, 0.22, g);
    const cabin = new THREE.PointLight(0xfff3e0, 1.6, 3.2, 1.5); cabin.position.set(0, 1.3, 0.2); g.add(cabin);                  // headliner
    const mirror = box(0.22, 0.06, 0.02, trim, 0, 1.36, -0.55, g); void mirror;
  }
  shadowAll(g);
  // imported car (faces +z, so turn it to face -z like this one); repainted in this car's colour
  swapModel(g, 'car', { size: 4.4, by: 'z', rotY: Math.PI }, { after: h => paintCar(h, color) });
  return g;
}
// A small sky-and-ground reflection map, so the imported car's paint and glass reflect something (without one the
// metallic paint rendered flat and dark). Equirectangular canvas: blue sky, bright horizon, grey asphalt below.
let carEnvTex = null;
function carEnv() {
  if (carEnvTex) return carEnvTex;
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, '#5f8fd0'); gr.addColorStop(0.45, '#cfe2f5'); gr.addColorStop(0.5, '#f4f6f8'); gr.addColorStop(0.53, '#8a8d92'); gr.addColorStop(1, '#3c3e42');
  x.fillStyle = gr; x.fillRect(0, 0, 256, 128);
  carEnvTex = new THREE.CanvasTexture(c); carEnvTex.mapping = THREE.EquirectangularReflectionMapping; carEnvTex.colorSpace = THREE.SRGBColorSpace;
  return carEnvTex;
}
function paintCar(holder, color) {
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.5, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08, envMap: carEnv(), envMapIntensity: 0.9, name: 'carPaint' });
  holder.traverse(o => {
    if (!o.isMesh) return; const m = o.material, n = o.name;
    if (m && m.isMeshStandardMaterial && !m.envMap && m.metalness > 0.3) { o.material = m.clone(); o.material.envMap = carEnv(); o.material.envMapIntensity = 0.7; } // chrome, rims
    if (/CarPaint_Max_1$/.test(n)) o.material = paint;                                                       // body paint
    else if (/CarPaint_Max_2$/.test(n)) { o.material = m.clone(); Object.assign(o.material, { transparent: true, opacity: 0.6, depthWrite: false, roughness: 0.08, metalness: 0.5, envMap: carEnv(), envMapIntensity: 1 }); o.castShadow = false; } // tinted windows and glass roof
    else if (/LightGlass_Clear/.test(n)) { o.material = m.clone(); Object.assign(o.material, { transparent: true, opacity: 0.3, depthWrite: false }); o.castShadow = false; } // clear glass
  });
}

// Roadside: a simple house, a tree, a lamppost, a power pole, a sign, a fence panel
const ROOF = [0x7a3a2e, 0x4a4f5a, 0x5c4436, 0x3d5566];
const WALLS = [0xe9e2d0, 0xd8c8a8, 0xc9d6e0, 0xe6d3c3, 0xd0dcc4];
export function makeRoadHouse(seed = 0) {
  const g = new THREE.Group(), r = n => ((Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  const w = 7 + r(1) * 3, d = 6 + r(2) * 2, hh = 3 + (r(3) < 0.4 ? 2.6 : 0);
  box(w, hh, d, std(WALLS[(r(4) * WALLS.length) | 0], { roughness: 0.9 }), 0, hh / 2, 0, g);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, d * 0.72, w + 0.6, 4, 1), std(ROOF[(r(5) * ROOF.length) | 0], { roughness: 0.85 }));
  roof.rotation.z = Math.PI / 2; roof.rotation.x = Math.PI / 4; roof.scale.set(1, 1, 0.55); roof.position.y = hh + 0.9; g.add(roof);
  const winM = std(0x8fb3d0, { roughness: 0.1, metalness: 0.3, emissive: 0x223344, emissiveIntensity: 0.3 });
  for (const x of [-w / 3, w / 3]) box(1.2, 1.1, 0.05, winM, x, 1.6, d / 2 + 0.02, g);
  box(1.0, 2.0, 0.06, std(0x6a4030), 0, 1.0, d / 2 + 0.03, g);
  if (hh > 4) for (const x of [-w / 3, 0, w / 3]) box(1.0, 1.0, 0.05, winM, x, 4.2, d / 2 + 0.02, g);
  return shadowAll(g);
}
export function makeTree(seed = 0, sc = 1) {
  const g = new THREE.Group(); cyl(0.14 * sc, 0.2 * sc, 2.2 * sc, std(0x5a3e2a), 0, 1.1 * sc, 0, g, 8);
  const leaf = std([0x4f8a3c, 0x3f7a35, 0x5d9445][seed % 3], { roughness: 0.95 });
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry((1.0 + (i % 2) * 0.3) * sc, 0), leaf); b.position.set(Math.cos(i * 2.1 + seed) * 0.6 * sc, (2.6 + (i % 3) * 0.5) * sc, Math.sin(i * 2.1 + seed) * 0.6 * sc); b.castShadow = true; g.add(b); }
  return g;
}
export function makeLamppost() { const g = new THREE.Group(), m = MAT.metal(0x4a4f5a); cyl(0.06, 0.08, 5, m, 0, 2.5, 0, g, 8); box(0.9, 0.06, 0.08, m, -0.45, 4.95, 0, g); box(0.35, 0.1, 0.2, MAT.glow(0xfff3d0, 0.4), -0.85, 4.88, 0, g); return g; }
export function makePowerPole() { const g = new THREE.Group(), m = std(0x6a5038); cyl(0.12, 0.15, 8, m, 0, 4, 0, g, 8); box(1.8, 0.12, 0.12, m, 0, 7.4, 0, g); return g; }
export function makeRoadSign(text, sub, col = '#1f6b3a') { const g = new THREE.Group(); const s = makeSign(text, sub, 3.2, col); s.position.y = 3.2; g.add(s); for (const x of [-1.2, 1.2]) cyl(0.05, 0.05, 3.2, MAT.metal(0x8a8f99), x, 1.6, -0.03, g, 8); return g; }
export function makeFence(len = 10) { const g = new THREE.Group(), m = MAT.metal(0x9aa0aa); for (let x = -len / 2; x <= len / 2 + 0.01; x += 2.5) cyl(0.04, 0.04, 1.8, m, x, 0.9, 0, g, 6); for (const y of [0.3, 1.7]) box(len, 0.04, 0.04, m, 0, y, 0, g); const mesh = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.4), new THREE.MeshStandardMaterial({ color: 0x9aa0aa, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false })); mesh.position.y = 1.0; g.add(mesh); return g; }

// The programme's flag: emblem on deep blue (original design)
function flagTex(kind) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160; const x = c.getContext('2d');
  if (kind === 'emblem') { x.fillStyle = '#0d2f6e'; x.fillRect(0, 0, 256, 160); drawEmblem(x, 128, 80, 60); }
  else if (kind === 'stripes') { for (let i = 0; i < 5; i++) { x.fillStyle = i % 2 ? '#f4f6ff' : '#e8423a'; x.fillRect(0, i * 32, 256, 32); } x.fillStyle = '#0d2f6e'; x.fillRect(0, 0, 100, 96); x.fillStyle = '#fff'; for (let i = 0; i < 9; i++) { x.beginPath(); x.arc(16 + (i % 3) * 34, 18 + Math.floor(i / 3) * 30, 6, 0, 7); x.fill(); } }
  else { x.fillStyle = '#123f8f'; x.fillRect(0, 0, 256, 160); x.fillStyle = '#fff'; x.font = 'bold 34px system-ui'; x.textAlign = 'center'; x.fillText('CLASS OF', 128, 70); x.font = 'bold 48px system-ui'; x.fillText(String(new Date().getFullYear()), 128, 122); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function makeFlag(kind = 'emblem', poleH = 9) {
  const g = new THREE.Group(); cyl(0.06, 0.08, poleH, MAT.metal(0xc8ccd2), 0, poleH / 2, 0, g, 10);
  const geo = new THREE.PlaneGeometry(2.4, 1.5, 16, 4); geo.translate(1.2, 0, 0);
  const flag = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: flagTex(kind), side: THREE.DoubleSide, roughness: 0.9 })); flag.position.y = poleH - 0.85; flag.castShadow = true; g.add(flag);
  g.userData.flag = flag; g.userData.base = Float32Array.from(geo.attributes.position.array); g.userData.ph = Math.random() * 6;
  return g;
}
export function waveFlag(f, t) {
  const pos = f.userData.flag.geometry.attributes.position, b = f.userData.base;
  for (let i = 0; i < pos.count; i++) { const x = b[i * 3]; pos.setZ(i, Math.sin(x * 2.2 - t * 4 + f.userData.ph) * 0.12 * (x / 2.4)); }
  pos.needsUpdate = true;
}

// Generic display rocket (not a real vehicle): core stage, two boosters, upper stage, capsule and escape tower
export function makeDisplayRocket(sc = 1) {
  const g = new THREE.Group(), white = std(0xf2f3f5, { roughness: 0.45 }), grey = std(0x6a707c, { roughness: 0.5 }), orange = std(0xd9773a, { roughness: 0.6 }), black = std(0x1c1f25);
  cyl(1.0, 1.0, 14, white, 0, 9, 0, g, 28); for (const y of [4, 8, 12]) cyl(1.02, 1.02, 0.25, black, 0, y, 0, g, 28);
  for (const sx of [-1, 1]) { cyl(0.45, 0.45, 11, white, sx * 1.5, 7.5, 0, g, 18); const n = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.4, 18), white); n.position.set(sx * 1.5, 13.7, 0); g.add(n); cyl(0.5, 0.35, 0.8, grey, sx * 1.5, 1.6, 0, g, 16); }
  cyl(0.8, 1.0, 1.2, grey, 0, 16.6, 0, g, 24); cyl(0.8, 0.8, 3, white, 0, 18.7, 0, g, 24);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.6, 24), std(0xdfe2e8, { roughness: 0.35, metalness: 0.2 })); cap.position.y = 21; g.add(cap);
  cyl(0.05, 0.05, 1.8, orange, 0, 22.6, 0, g, 8);
  for (let i = 0; i < 4; i++) { const f = box(0.08, 2.2, 1.4, grey, 0, 3, 0, g); f.rotation.y = i * Math.PI / 2; f.translateZ(1.6); }
  cyl(0.7, 1.1, 1.2, black, 0, 1.4, 0, g, 20);
  // launch stand
  box(5, 0.8, 5, std(0x8a8f99, { roughness: 0.8 }), 0, 0.4, 0, g);
  const c2 = document.createElement('canvas'); c2.width = 128; c2.height = 512; const x = c2.getContext('2d'); x.fillStyle = '#f2f3f5'; x.fillRect(0, 0, 128, 512); x.fillStyle = '#0d2f6e'; x.font = 'bold 54px system-ui'; x.textAlign = 'center'; [...'JATP'].forEach((ch, i) => x.fillText(ch, 64, 90 + i * 100));
  const t = new THREE.CanvasTexture(c2); t.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 3.6), std(0xffffff, { map: t, transparent: true })); label.position.set(0, 9.5, 1.01); g.add(label);
  g.scale.setScalar(sc);
  return shadowAll(g);
}

// The Astronaut Training Centre facade (front faces +z). Width 36 m, two glass sliding doors at x=0.
export function makeTrainingCentre() {
  const g = new THREE.Group();
  const wallM = std(0xe8eaee, { roughness: 0.8 }), glassM = std(0x2a4766, { roughness: 0.08, metalness: 0.6, emissive: 0x0a1a2c, emissiveIntensity: 0.4 }), frameM = MAT.metal(0x8a8f99);
  box(36, 11, 14, wallM, 0, 5.5, -7, g);
  box(36.3, 0.45, 14.3, std(0x6a6e78, { roughness: 0.9 }), 0, 0.225, -7, g);                         // plinth
  // parapet and roof equipment (the roof is no longer a bare box top)
  const parM = std(0xd2d6dc, { roughness: 0.7 });
  box(36.4, 0.7, 0.3, parM, 0, 11.35, 0.05, g); box(36.4, 0.7, 0.3, parM, 0, 11.35, -14.05, g); box(0.3, 0.7, 14.4, parM, -18.05, 11.35, -7, g); box(0.3, 0.7, 14.4, parM, 18.05, 11.35, -7, g);
  for (const [x, z, w, d] of [[-9, -5, 4, 2.5], [6, -8, 3, 3], [12, -4, 2.2, 2]]) { box(w, 1.4, d, std(0xb8bec8, { roughness: 0.6 }), x, 11.7, z, g); box(w * 0.6, 0.1, d * 0.6, std(0x3a3f4a), x, 12.45, z, g); }
  const dish = new THREE.Mesh(new THREE.SphereGeometry(1.1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 3), std(0xf2f2f2, { roughness: 0.4, side: THREE.DoubleSide })); dish.rotation.x = -2.2; dish.position.set(-14, 12.6, -9); g.add(dish); cyl(0.08, 0.1, 1.4, frameM, -14, 11.7, -9, g, 8);
  // windows: glass set into light frames, on the front and both sides
  const frameW = std(0xb9bec8, { roughness: 0.5, metalness: 0.3 });
  const win = (x, y, z, ry) => { const w = new THREE.Group(); box(1.6, 1.8, 0.06, glassM, 0, 0, 0.03, w); box(1.72, 0.08, 0.1, frameW, 0, 0.94, 0.05, w); box(1.72, 0.1, 0.14, frameW, 0, -0.94, 0.07, w); for (const sx of [-1, 1]) box(0.08, 1.88, 0.1, frameW, sx * 0.82, 0, 0.05, w); box(0.04, 1.8, 0.08, frameW, 0, 0, 0.06, w); w.position.set(x, y, z); w.rotation.y = ry; g.add(w); };
  for (let row = 0; row < 3; row++) for (let i = -8; i <= 8; i++) { if (row === 0 && Math.abs(i) < 3) continue; if (row === 2 && Math.abs(i) < 4) continue; win(i * 2, 2.0 + row * 3.2, 0, 0); }
  for (let row = 0; row < 3; row++) for (let i = 0; i < 5; i++) for (const sx of [-1, 1]) win(sx * 18, 2.0 + row * 3.2, -2.2 - i * 2.4, sx * Math.PI / 2);
  // floor bands between storeys
  for (const y of [3.6, 6.8]) box(36.1, 0.18, 0.08, std(0xcfd3da, { roughness: 0.6 }), 0, y, 0.04, g);
  // fascia board behind the big sign (the sign used to sit on the window glass and flicker)
  box(14.6, 5.5, 0.16, std(0x0d2f6e, { roughness: 0.6 }), 0, 8.8, 0.08, g);
  // entrance: glass block, canopy, doors
  box(10, 4.4, 0.08, glassM, 0, 2.2, 0.05, g);
  box(12, 0.35, 4.5, std(0xd9dce2, { roughness: 0.5 }), 0, 4.6, 2.2, g); for (const x of [-5.6, 5.6]) cyl(0.15, 0.15, 4.5, frameM, x, 2.25, 4.1, g, 12);
  const lobby = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.7), new THREE.MeshStandardMaterial({ color: 0xe8eef6, emissive: 0xc8d4e4, emissiveIntensity: 0.7, roughness: 0.6 })); lobby.position.set(0, 1.35, 0.095); g.add(lobby);
  const doors = new THREE.Group(); doors.position.set(0, 0, 0.12); g.add(doors);
  const leaves = [-1, 1].map(sx => { const l = box(1.2, 2.6, 0.06, std(0x9fc4e0, { transparent: true, opacity: 0.45, roughness: 0.05, metalness: 0.4 }), sx * 0.6, 1.3, 0, doors); box(1.2, 0.08, 0.08, frameM, 0, 1.3, 0.02, l); return l; });
  box(2.6, 0.12, 0.12, frameM, 0, 2.66, 0.1, doors);
  g.userData.doors = leaves;
  const sign = makeSign('ASTRONAUT TRAINING CENTRE', 'Junior Astronaut Training Program', 14, '#0d2f6e'); sign.position.set(0, 8.8, 0.17); g.add(sign);
  box(12, 0.25, 4.6, std(0xc4c8cf, { roughness: 0.8 }), 0, 0.125, 2.3, g); // entrance step under the canopy
  // banners with the emblem either side
  for (const x of [-11, 11]) {
    const c = document.createElement('canvas'); c.width = 160; c.height = 400; const x2 = c.getContext('2d'); x2.fillStyle = '#0d2f6e'; x2.fillRect(0, 0, 160, 400); drawEmblem(x2, 80, 110, 62); x2.fillStyle = '#fff'; x2.font = 'bold 26px system-ui'; x2.textAlign = 'center'; x2.fillText('WELCOME', 80, 240); x2.fillText('CADETS', 80, 276); x2.font = '16px system-ui'; x2.fillText('Train · Explore · Return', 80, 330);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const b = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 6), std(0xffffff, { map: t, roughness: 0.9, side: THREE.DoubleSide })); b.position.set(x, 6.5, 0.32); g.add(b);
    for (const y of [9.55, 3.45]) { cyl(0.04, 0.04, 2.6, frameM, x, y, 0.32, g, 8).rotation.z = Math.PI / 2; for (const sx of [-1, 1]) box(0.05, 0.05, 0.3, frameM, x + sx * 1.2, y, 0.17, g); } // banner rods and wall brackets
  }
  shadowAll(g);
  // imported NASA building behind the entrance: keep the entrance (doors, glass, canopy, step, lobby) and the big sign
  const keep = []; g.traverse(o => { if (o.isMesh && o.position.z > -0.4 && Math.abs(o.position.x) < 6.3 && o.position.y < 5 && o.parent === g) keep.push(o); });
  keep.push(sign, ...leaves, doors);
  swapModel(g, 'nasa', { size: 40, by: 'x' }, { keep, after: h => { h.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(h); h.position.z -= b.max.z - 0.05; h.position.y -= 0.02; const top = b.max.y - b.min.y; sign.position.y = Math.max(top + 1.6, 5.6); sign.scale.setScalar(0.8); } });
  return g;
}

// Rescue helicopter: fuselage, glazed cockpit, tail boom with fin and tail rotor, main rotor (4 blades), skids and a sliding door.
// Faces -z. Origin on the ground under the skids. userData: rotor, tailRotor, door (slides along +z), doorOpen 0..1
export function makeHelicopter() {
  const g = new THREE.Group();
  const red = std(0xc8202a, { roughness: 0.35, metalness: 0.3 }), white = std(0xf2f3f5, { roughness: 0.4, metalness: 0.2 }), dark = std(0x22262e, { roughness: 0.6 }), metal = MAT.metal(0x9aa3b2);
  const glass = new THREE.MeshStandardMaterial({ color: 0x5a7a96, transparent: true, opacity: 0.45, roughness: 0.05, metalness: 0.5, depthWrite: false, side: THREE.DoubleSide });
  // fuselage: a lathe body lying along z
  const prof = [[0.001, -1.9], [0.45, -1.75], [0.78, -1.3], [0.95, -0.6], [0.98, 0.4], [0.9, 1.1], [0.62, 1.7], [0.32, 2.0], [0.001, 2.05]].map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), red); body.rotation.x = Math.PI / 2; body.scale.set(1, 1, 0.92); body.position.set(0, 1.35, 0); g.add(body);
  const belly = new THREE.Mesh(new THREE.LatheGeometry(prof.map(v => new THREE.Vector2(v.x * 1.005, v.y)), 32, Math.PI * 0.62, Math.PI * 0.76), white); belly.rotation.x = Math.PI / 2; belly.scale.set(1, 1, 0.92); belly.position.copy(body.position); g.add(belly);
  // cockpit glazing (front upper part)
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.86, 24, 14, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.12, Math.PI * 0.4), glass); canopy.rotation.x = -Math.PI / 2; canopy.position.set(0, 1.42, -1.05); canopy.renderOrder = 5; g.add(canopy);
  // seats and pilot silhouettes behind the glass
  for (const sx of [-1, 1]) { box(0.45, 0.5, 0.45, dark, sx * 0.35, 1.0, -0.9, g); box(0.45, 0.7, 0.1, dark, sx * 0.35, 1.3, -0.66, g); }
  // engine cowling and exhaust
  box(0.9, 0.42, 1.6, white, 0, 2.3, 0.3, g); cyl(0.13, 0.15, 0.4, dark, 0.35, 2.3, 1.2, g, 12).rotation.x = Math.PI / 2;
  // tail boom, fins, tail rotor
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.34, 4.2, 16), red); boom.rotation.x = Math.PI / 2; boom.position.set(0, 1.62, 3.8); g.add(boom);
  box(0.06, 1.0, 0.7, red, 0, 2.15, 5.75, g); box(1.3, 0.05, 0.42, white, 0, 1.65, 5.2, g);
  const tailRotor = new THREE.Group(); tailRotor.position.set(0.12, 2.25, 5.8); g.add(tailRotor);
  for (let i = 0; i < 2; i++) { const b = box(0.02, 1.0, 0.1, dark, 0, 0, 0, tailRotor); b.rotation.x = i * Math.PI / 2; }
  cyl(0.06, 0.06, 0.1, metal, 0, 0, 0, tailRotor, 10).rotation.z = Math.PI / 2;
  // main rotor: mast, hub, four blades (with tip stripes)
  cyl(0.08, 0.1, 0.5, metal, 0, 2.75, 0, g, 12);
  const rotor = new THREE.Group(); rotor.position.set(0, 3.02, 0); g.add(rotor);
  cyl(0.22, 0.22, 0.12, dark, 0, 0, 0, rotor, 16);
  for (let i = 0; i < 4; i++) { const arm = new THREE.Group(); arm.rotation.y = i * Math.PI / 2; rotor.add(arm); box(4.0, 0.03, 0.26, dark, 2.1, 0, 0, arm); box(0.25, 0.032, 0.26, std(0xffc857), 3.95, 0, 0, arm); }
  // skids: two long tubes on cross struts
  for (const sx of [-1, 1]) { const sk = cyl(0.05, 0.05, 3.0, metal, sx * 0.95, 0.06, -0.2, g, 10); sk.rotation.x = Math.PI / 2; const tip = cyl(0.05, 0.05, 0.4, metal, sx * 0.95, 0.15, -1.82, g, 10); tip.rotation.x = Math.PI / 2 - 0.5; }
  for (const z of [-1.0, 0.6]) { const st = cyl(0.04, 0.04, 2.0, metal, 0, 0.42, z, g, 8); st.rotation.z = Math.PI / 2; for (const sx of [-1, 1]) { const leg = cyl(0.04, 0.04, 0.8, metal, sx * 0.78, 0.4, z, g, 8); leg.rotation.z = sx * 0.45; } }
  // sliding side door (right side) with a window, and a step
  const door = new THREE.Group(); door.position.set(0.97, 1.25, 0.1); g.add(door);
  box(0.04, 1.1, 1.1, white, 0, 0, 0, door); const dw = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45), glass); dw.position.set(0.025, 0.2, 0); dw.rotation.y = Math.PI / 2; door.add(dw);
  box(0.02, 0.04, 0.25, metal, 0.035, -0.1, -0.4, door);
  box(0.4, 0.04, 0.6, metal, 1.05, 0.45, 0.1, g);
  // markings: RESCUE on both sides, a white stripe
  const tex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.font = 'bold 44px system-ui'; x.textAlign = 'center'; x.fillText('RESCUE', 128, 48); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  for (const sx of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.35), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 })); m.position.set(sx * 0.93, 1.75, 2.1); m.rotation.y = sx * Math.PI / 2 + (sx > 0 ? 0.08 : -0.08); g.add(m); }
  g.traverse(o => { if (o.isMesh && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData.rotor = rotor; g.userData.tailRotor = tailRotor; g.userData.door = door; g.userData.doorOpen = 0;
  // imported helicopter (nose towards -x in its file): turn it to face -z. Its own animation spins the blades,
  // advanced by the scene (userData.mixer) at the rotor speed; the sliding door stays the built-in one.
  swapModel(g, 'helicopter', { size: 9.2, by: 'z', rotY: -Math.PI / 2 }, { keep: [door], after: (h, gltf) => {
    const src = gltf.animations[0]; if (!src) return;
    const clip = new THREE.AnimationClip('rotors', src.duration, src.tracks.filter(t => /^(Blades|Screw)\./.test(t.name))); // only the blades: the scene flies the body itself
    const mixer = new THREE.AnimationMixer(h); mixer.clipAction(clip).play(); g.userData.mixer = mixer;
    // the clip poses the whole rig, so sit it back on the skids after the first frame
    mixer.update(0.01); h.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(h, true), gb = new THREE.Box3().setFromObject(g, true);
    void gb; const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(); const lo = b.min.clone().applyMatrix4(inv); h.position.y -= lo.y;
  } });
  return g;
}

// Lean-to tent built from two poles and a parachute: a ridge line between the pole tops, the canopy sloping to stakes at the
// back, closed sides, guy ropes and stakes at the front, and a ground sheet. Origin at the middle of the front edge, on the ground.
// Faces -z (the open front). w = width between poles, d = depth to the back stakes, h = pole height.
export function makeLeanTo({ w = 2.2, d = 2.4, h = 1.8, color = 0xd96a2a } = {}) {
  const g = new THREE.Group();
  const c = document.createElement('canvas'); c.width = 128; c.height = 128; const x = c.getContext('2d'); for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#f2efe8' : '#' + color.toString(16).padStart(6, '0'); x.fillRect(i * 16, 0, 16, 128); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const fab = std(0xffffff, { map: t, roughness: 0.9, side: THREE.DoubleSide });
  const v = (a, b, cc) => [...a, ...b, ...cc];
  const tri = (pts, mat) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat ? pts : pts, 3)); geo.computeVertexNormals(); const m = new THREE.Mesh(geo, mat); g.add(m); return m; };
  const hw = w / 2 + 0.15, front = -0.25;
  // canopy: ridge (front, at pole height, with a small overhang) down to the back edge on the ground
  const canopyG = new THREE.BufferGeometry();
  canopyG.setAttribute('position', new THREE.Float32BufferAttribute([-hw, h + 0.02, front, hw, h + 0.02, front, hw, 0.05, d, -hw, h + 0.02, front, hw, 0.05, d, -hw, 0.05, d], 3));
  canopyG.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0], 2)); canopyG.computeVertexNormals();
  const canopy = new THREE.Mesh(canopyG, fab); g.add(canopy);
  // closed sides (triangles from the pole line to the back corner)
  for (const sx of [-1, 1]) tri(v([sx * hw, h, 0], [sx * hw, 0.03, 0], [sx * hw, 0.03, d - 0.02]), fab);
  // ridge rope, guy ropes, stakes
  const rope = std(0xe8e0c8, { roughness: 0.9 });
  const line = (A, B, r = 0.008) => { const a = new THREE.Vector3(...A), b = new THREE.Vector3(...B); const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 6), rope); m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); g.add(m); return m; };
  line([-w / 2, h, 0], [w / 2, h, 0], 0.012);
  const stake = (px, pz) => { const s = cyl(0.015, 0.006, 0.3, MAT.metal(0x8a8f99), px, 0.08, pz, g, 6); s.rotation.x = 0.3; };
  for (const sx of [-1, 1]) { line([sx * w / 2, h, 0], [sx * (w / 2 + 0.5), 0.05, -1.0]); stake(sx * (w / 2 + 0.5), -1.0); stake(sx * hw, d); stake(sx * hw, d * 0.5); }
  // ground sheet
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.2, d - 0.1), std(0x4a5a3a, { roughness: 1 })); sheet.rotation.x = -Math.PI / 2; sheet.position.set(0, 0.012, d / 2 - 0.05); g.add(sheet);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  sheet.castShadow = false;
  // imported tent (door towards +x in its file): turned so the door faces -z, standing over the same footprint
  swapModel(g, 'tent', { size: Math.max(w, d) * 1.05, by: 'length', rotY: Math.PI / 2 }, { after: hh => { hh.position.z = d / 2; } });
  return g;
}
