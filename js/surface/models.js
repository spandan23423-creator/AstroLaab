// ASTRO LAB — models for surface expeditions, built in code (no external assets).
// Materials use small procedural textures (suit fabric, crinkled foil, wire-mesh tyres, rock grain).
import * as THREE from '../../vendor/three.module.js';
import { whenModel, instance, fit, markImported, makeRetarget } from '../assets/models.js';

// ---------------- procedural textures ----------------
const cache = {};
function canvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
function tex(key, w, h, draw, { srgb = true, repeat = [1, 1] } = {}) {
  const k = key + repeat.join('x');
  if (cache[k]) return cache[k];
  const t = new THREE.CanvasTexture(canvas(w, h, draw)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return (cache[k] = t);
}
let seed = 1; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
// Beta-cloth suit fabric: off-white weave with quilting seams
const fabric = (rep = [2, 2]) => tex('fabric', 256, 256, (c, w, h) => {
  c.fillStyle = '#eceae4'; c.fillRect(0, 0, w, h);
  const img = c.getImageData(0, 0, w, h);
  for (let i = 0; i < w * h; i++) { const x = i % w, y = i / w | 0; const v = ((x + y) % 4 < 2 ? 4 : -4) + (rnd() - 0.5) * 14; for (let k = 0; k < 3; k++) img.data[i * 4 + k] += v; }
  c.putImageData(img, 0, 0);
  c.strokeStyle = 'rgba(120,118,110,0.55)'; c.lineWidth = 2;
  for (let y = 0; y < h; y += 64) { c.beginPath(); c.moveTo(0, y + 0.5); c.lineTo(w, y + 0.5); c.stroke(); }
  c.strokeStyle = 'rgba(150,148,140,0.35)'; c.lineWidth = 1;
  for (let x = 0; x < w; x += 128) { c.beginPath(); c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, h); c.stroke(); }
}, { repeat: rep });
// Crinkled gold / silver Kapton foil (Apollo descent stage)
const foil = (key, base) => tex(key, 512, 512, (c, w, h) => {
  c.fillStyle = base; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) {
    const x = rnd() * w, y = rnd() * h, r = 8 + rnd() * 40, a = rnd() * Math.PI;
    const l = 0.75 + rnd() * 0.5; c.fillStyle = `rgba(${l > 1 ? 255 : 0},${l > 1 ? 240 : 0},${l > 1 ? 200 : 0},${Math.abs(l - 1) * 0.5})`;
    c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 4; k++) { const aa = a + k * Math.PI / 2 + (rnd() - 0.5); c.lineTo(x + Math.cos(aa) * r, y + Math.sin(aa) * r * 0.6); } c.closePath(); c.fill();
  }
  c.strokeStyle = 'rgba(60,40,0,0.35)'; c.lineWidth = 1;
  for (let i = 0; i < 260; i++) { const x = rnd() * w, y = rnd() * h; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rnd() - 0.5) * 70, y + (rnd() - 0.5) * 70); c.stroke(); }
});
// Wire-mesh tyre with titanium chevron treads (like the Apollo LRV tyres)
const tread = () => tex('tread', 256, 64, (c, w, h) => {
  c.clearRect(0, 0, w, h);
  c.strokeStyle = 'rgba(170,172,176,0.95)'; c.lineWidth = 1.2;
  for (let x = -h; x < w + h; x += 6) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + h, h); c.stroke(); c.beginPath(); c.moveTo(x + h, 0); c.lineTo(x, h); c.stroke(); }
  c.fillStyle = 'rgba(120,122,128,1)';
  for (let x = 0; x < w; x += 16) { c.beginPath(); c.moveTo(x, 6); c.lineTo(x + 8, h / 2); c.lineTo(x, h - 6); c.lineTo(x + 4, h - 6); c.lineTo(x + 12, h / 2); c.lineTo(x + 4, 6); c.closePath(); c.fill(); }
}, { repeat: [3, 1] });
export const rockTex = () => tex('rock', 256, 256, (c, w, h) => {
  const img = c.createImageData(w, h);
  for (let i = 0; i < w * h; i++) { const v = 150 + (rnd() - 0.5) * 70; img.data.set([v, v, v, 255], i * 4); }
  c.putImageData(img, 0, 0); c.filter = 'blur(1px)'; c.drawImage(c.canvas, 0, 0); c.filter = 'none';
  for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${0.08 + rnd() * 0.15})`; c.beginPath(); c.arc(rnd() * w, rnd() * h, 0.5 + rnd() * 2.5, 0, 7); c.fill(); }
}, { repeat: [2, 2] });
const panel = () => tex('panel', 256, 256, (c, w, h) => {
  c.fillStyle = '#e8e8e6'; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(90,95,105,0.6)'; c.lineWidth = 2;
  for (let y = 0; y <= h; y += 64) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  for (let x = 0; x <= w; x += 85) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
  c.fillStyle = 'rgba(90,95,105,0.5)'; for (let y = 8; y < h; y += 64) for (let x = 8; x < w; x += 85) { c.fillRect(x, y, 3, 3); c.fillRect(x + 70, y, 3, 3); }
}, { repeat: [3, 2] });

// ---------------- helpers ----------------
function std(color, o = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.8, metalness: o.m ?? 0, emissive: o.e || 0x000000, emissiveIntensity: o.ei ?? 1, side: o.side || THREE.FrontSide, map: o.map || null, bumpMap: o.bump || null, bumpScale: o.bs ?? 1, transparent: !!o.transparent, alphaTest: o.alphaTest || 0 });
  if (o.env) m.userData.env = o.env; // the scene gives these an environment map for reflections
  return m;
}
const shadowAll = g => { g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g; };
function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; }
function rbox(w, h, d, r = 0.03, seg = 3) { // rounded box
  const sh = new THREE.Shape(); sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); sh.lineTo(w / 2, h / 2 - r); sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); sh.lineTo(-w / 2 + r, h / 2); sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); sh.lineTo(-w / 2, -h / 2 + r); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.001, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.6, bevelSegments: seg, curveSegments: 4 });
  g.translate(0, 0, -(d - 2 * r) / 2); g.computeVertexNormals(); return g;
}
const tube = (pts, r, mat) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 16, r, 6, false), mat);
const limb = (r0, r1, len, mat) => { const g = new THREE.CylinderGeometry(r0, r1, len, 12, 3); g.translate(0, -len / 2, 0); return new THREE.Mesh(g, mat); };

// ---------------- Astronaut: jointed rig, ~1.85 m tall in suit ----------------
// Joints: hips → spine → (head, shoulders → elbows → wrists) and hips → hip joints → knees → ankles.
// Sign convention: +rotation.x swings a hanging limb forward (toward −z, the facing direction).
export const LEG = { thigh: 0.44, shin: 0.43, ankleH: 0.105, hipY: 0.975 };
export function makeAstronaut() {
  seed = 7;
  const suit = std(0xf1efe9, { r: 0.92, map: fabric([3, 3]), bump: fabric([3, 3]), bs: 0.6 });
  const suitDark = std(0xd9d6ce, { r: 0.9, map: fabric([2, 2]) });
  const rubber = std(0x3a4150, { r: 0.75 }), sole = std(0x22252b, { r: 0.95 }), grey = std(0x9aa0a8, { r: 0.55, m: 0.3, env: 1 });
  const glove = std(0x4a5468, { r: 0.6 }), red = std(0xb4202a, { r: 0.7 }), blue = std(0x2f5fb3, { r: 0.6 }), chrome = std(0xd7dade, { r: 0.18, m: 1, env: 1 });
  const visor = std(0xd29b3a, { r: 0.05, m: 1, env: 1.4 });
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = LEG.hipY; root.add(hips);
  const pelvis = mesh(new THREE.SphereGeometry(0.205, 18, 12), suit, 0, 0.02, 0); pelvis.scale.set(1.05, 0.72, 0.82); hips.add(pelvis);
  const spine = new THREE.Group(); spine.position.y = 0.06; hips.add(spine);
  // torso (lathe profile), squashed front-to-back
  const prof = [[0.001, 0], [0.19, 0.0], [0.215, 0.1], [0.235, 0.26], [0.235, 0.4], [0.2, 0.5], [0.12, 0.555], [0.001, 0.56]].map(([x, y]) => new THREE.Vector2(x, y));
  const torso = mesh(new THREE.LatheGeometry(prof, 22), suit); torso.scale.z = 0.8; spine.add(torso);
  spine.add(mesh(new THREE.TorusGeometry(0.205, 0.022, 6, 22), suitDark, 0, 0.02, 0).rotateX(Math.PI / 2)); // waist ring
  // chest display & control unit with knobs
  const dcm = mesh(rbox(0.3, 0.15, 0.1, 0.02), grey, 0, 0.3, -0.215); spine.add(dcm);
  for (const x of [-0.09, 0, 0.09]) spine.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 10), x === 0 ? red : rubber, x, 0.31, -0.275).rotateX(Math.PI / 2));
  // life-support backpack (PLSS) + oxygen purge system on top
  spine.add(mesh(rbox(0.5, 0.66, 0.25, 0.05), suitDark, 0, 0.3, 0.3));
  spine.add(mesh(rbox(0.44, 0.15, 0.2, 0.03), suit, 0, 0.71, 0.29));
  spine.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.28, 6), grey, 0.17, 0.92, 0.33)); // antenna
  for (const s of [-1, 1]) spine.add(tube([[s * 0.07, 0.28, -0.23], [s * 0.2, 0.22, -0.18], [s * 0.26, 0.24, -0.02], [s * 0.24, 0.3, 0.16]], 0.02, s < 0 ? blue : red));
  spine.add(mesh(new THREE.TorusGeometry(0.115, 0.025, 8, 24), chrome, 0, 0.56, -0.01).rotateX(Math.PI / 2)); // neck ring
  // helmet with gold reflective visor
  const head = new THREE.Group(); head.position.y = 0.67; spine.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.2, 24, 18), suit));
  const v = mesh(new THREE.SphereGeometry(0.207, 28, 16, Math.PI * 0.18, Math.PI * 0.64, Math.PI * 0.26, Math.PI * 0.42), visor); v.rotation.y = Math.PI; head.add(v);
  head.add(mesh(new THREE.TorusGeometry(0.206, 0.013, 6, 28, Math.PI * 0.75), red).rotateY(Math.PI / 2).rotateZ(Math.PI * 0.32)); // commander's stripe over the crown
  // arms
  const arm = s => {
    const sh = new THREE.Group(); sh.position.set(s * 0.285, 0.44, 0); spine.add(sh);
    sh.add(mesh(new THREE.SphereGeometry(0.1, 14, 10), suit));
    sh.add(limb(0.085, 0.075, 0.3, suit));
    sh.add(mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.035, 12), red, 0, -0.09, 0)); // commander's stripe
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
    el.add(mesh(new THREE.SphereGeometry(0.078, 12, 10), suit));
    el.add(limb(0.073, 0.064, 0.26, suit));
    const wr = new THREE.Group(); wr.position.y = -0.28; el.add(wr);
    wr.add(mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.04, 12), chrome, 0, 0.01, 0));
    const hand = mesh(new THREE.SphereGeometry(0.06, 12, 10), glove, 0, -0.06, 0); hand.scale.set(0.8, 1.25, 1.05); wr.add(hand);
    const th = mesh(new THREE.CapsuleGeometry(0.02, 0.04, 3, 6), glove, -s * 0.035, -0.05, -0.04); th.rotation.z = s * 0.5; wr.add(th);
    return { sh, el, wr };
  };
  const leg = s => {
    const hp = new THREE.Group(); hp.position.set(s * 0.112, -0.02, 0); hips.add(hp);
    hp.add(mesh(new THREE.SphereGeometry(0.11, 14, 10), suit));
    hp.add(limb(0.105, 0.09, LEG.thigh, suit));
    hp.add(mesh(new THREE.CylinderGeometry(0.096, 0.096, 0.035, 12), red, 0, -0.2, 0));
    const kn = new THREE.Group(); kn.position.y = -LEG.thigh; hp.add(kn);
    kn.add(mesh(new THREE.SphereGeometry(0.094, 12, 10), suit));
    for (const y of [-0.02, 0.02]) kn.add(mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 16), suitDark, 0, y, 0).rotateX(Math.PI / 2)); // bellows
    kn.add(limb(0.088, 0.078, LEG.shin, suit));
    const an = new THREE.Group(); an.position.y = -LEG.shin; kn.add(an);
    an.add(mesh(rbox(0.16, 0.13, 0.31, 0.04), rubber, 0, -0.04, -0.045));
    an.add(mesh(rbox(0.165, 0.03, 0.32, 0.012), sole, 0, -0.095, -0.045));
    return { hp, kn, an };
  };
  const armL = arm(-1), armR = arm(1), legL = leg(-1), legR = leg(1);
  shadowAll(root);
  root.userData = { hips, spine, head, armL, armR, legL, legR };
  attachAstronautModel(root);
  return root;
}
// Imported astronaut: driven by the procedural joints above (walk, lope, crouch, jumps and the rover seat all keep working).
function attachAstronautModel(root) {
  const u = root.userData, proc = []; root.traverse(o => { if (o.isMesh) proc.push(o); });
  whenModel('astronaut', gltf => {
    if (u.model) return;
    const obj = instance(gltf);
    const holder = markImported(fit(obj, { size: 1.9, by: 'height', rotY: Math.PI })); // the model faces +z, this rig faces -z
    root.add(holder);
    // measure in the rest pose, then put the current pose back
    const saved = []; root.traverse(o => { if (!o.isMesh && o !== root && !o.userData.importedPart) saved.push([o, o.quaternion.clone(), o.position.clone()]); });
    for (const [o] of saved) o.rotation.set(0, 0, 0); u.hips.position.y = LEG.hipY; root.updateMatrixWorld(true);
    const rt = makeRetarget(obj, root, { hips: u.spine, head: u.head, upperArmL: u.armL.sh, foreArmL: u.armL.el, handL: u.armL.wr, upperArmR: u.armR.sh, foreArmR: u.armR.el, handR: u.armR.wr,
      thighL: u.legL.hp, calfL: u.legL.kn, thighR: u.legR.hp, calfR: u.legR.kn }, { procFwd: -1, hipsFrom: u.hips });
    for (const [o, q, p] of saved) { o.quaternion.copy(q); o.position.copy(p); }
    if (!rt) { root.remove(holder); return; }
    for (const m of proc) m.visible = false;
    u.model = { holder, rt };
  });
}

// Procedural animator: walk, low-gravity lope ("bunny hop"), idle, crouch, air, landing and seated poses,
// blended smoothly. Hips drop automatically so the planted foot stays on the ground.
const POSE_KEYS = ['hipL', 'hipR', 'kneeL', 'kneeR', 'ankL', 'ankR', 'shL', 'shR', 'shZL', 'shZR', 'elL', 'elR', 'spineX', 'spineY', 'spineZ', 'headX', 'headY', 'bounce'];
const zero = () => Object.fromEntries(POSE_KEYS.map(k => [k, 0]));
const addW = (out, p, w) => { for (const k of POSE_KEYS) out[k] += (p[k] || 0) * w; return out; };
export class AstroAnimator {
  constructor(model) { this.m = model; this.u = model.userData; this.phase = 0; this.w = { move: 0, lope: 0, air: 0, crouch: 0, slide: 0 }; this.land = 0; this.landAmt = 0; this.t = 0; this.cur = zero(); this.onStep = null; this.bank = 0; }
  impact(v) { this.land = 1; this.landAmt = Math.min(1, v / 2.2); }
  update(dt, s) {
    const u = this.u, w = this.w; this.t += dt;
    const ap = (k, target, rate) => { w[k] += (target - w[k]) * Math.min(1, dt * rate); };
    const sp = s.speed;
    ap('move', s.ground ? Math.min(1, sp / 0.9) : w.move, 6);
    ap('lope', s.ground && s.g < 3 && sp > 1.0 ? 1 : 0, 4);
    ap('air', s.ground ? 0 : 1, s.ground ? 14 : 6);
    ap('crouch', s.crouch, 12); ap('slide', s.sliding ? 1 : 0, 5);
    this.land = Math.max(0, this.land - dt * 3.2);
    // phase: walking stride ties to distance (no foot sliding); loping uses a hop cadence that slows in low gravity
    const stride = 2 * (0.34 + 0.28 * Math.min(sp, 1.6));
    const walkRate = sp / stride * Math.PI * 2;
    // loping (sprint in low gravity): each hop covers a distance that grows with speed, so the cadence follows the ground
    // speed and the planted foot no longer skates when you run fast (it used to keep one fixed beat at every speed)
    const lopeT = Math.min(1.6, Math.max(0.45, 0.62 * Math.sqrt(1.62 / Math.max(0.05, s.g))));
    const hopLen = Math.max(0.9, Math.min(2.2, 0.9 + 0.35 * sp)), lopeRate = Math.max(Math.PI * 2 / (lopeT * 1.6), sp / hopLen * Math.PI * 2);
    const rate = s.ground ? walkRate * (1 - w.lope) + lopeRate * w.lope : 0;
    const prev = this.phase; this.phase += rate * dt;
    const steps = [];
    if (this.onStep && s.ground && sp > 0.25) {
      const cross = (a) => Math.floor((prev - a) / (Math.PI * 2)) !== Math.floor((this.phase - a) / (Math.PI * 2));
      if (w.lope > 0.5) { if (cross(0)) steps.push(2); }
      else { if (cross(Math.PI / 2)) steps.push(0); if (cross(Math.PI * 1.5)) steps.push(1); }
    }
    const f = this.phase, b = Math.sin(this.t * 1.7);
    // --- component poses ---
    const idle = { shZL: 0.16, shZR: -0.16, shL: 0.05 + b * 0.02, shR: 0.05 - b * 0.02, elL: 0.25, elR: 0.25, spineX: 0.02 * b, headY: Math.sin(this.t * 0.35) * 0.25, kneeL: -0.06, kneeR: -0.06, hipL: 0.03, hipR: 0.03, ankL: 0.03, ankR: 0.03 };
    const A = 0.5 + 0.5 * Math.min(1, sp / 1.2);
    const walk = {
      hipL: 0.42 * A * Math.sin(f), hipR: 0.42 * A * Math.sin(f + Math.PI),
      kneeL: -A * (0.1 + 0.75 * Math.max(0, Math.cos(f))), kneeR: -A * (0.1 + 0.75 * Math.max(0, Math.cos(f + Math.PI))),
      shL: -0.32 * A * Math.sin(f), shR: -0.32 * A * Math.sin(f + Math.PI), shZL: 0.18, shZR: -0.18, elL: 0.35 + 0.15 * A, elR: 0.35 + 0.15 * A,
      spineX: -0.06 * A, spineY: 0.07 * A * Math.sin(f), headY: -0.04 * A * Math.sin(f), bounce: 0.025 * A * Math.abs(Math.cos(f))
    };
    const hop = Math.abs(Math.sin(f / 2)), comp = Math.pow(1 - hop, 3);
    const LA = 0.75 + 0.35 * Math.min(1, sp / 3); // bigger leg swing the faster you lope
    const lope = {
      hipL: (0.45 + 0.25 * Math.sin(f - 0.6)) * LA, hipR: (-0.1 + 0.3 * Math.sin(f - 1.4)) * LA,
      kneeL: -(0.25 + 0.7 * comp), kneeR: -(0.45 + 0.5 * comp + 0.3 * hop),
      shL: 0.4 + 0.08 * hop, shR: 0.4 + 0.08 * hop, shZL: 0.35, shZR: -0.35, elL: 0.7, elR: 0.7,
      spineX: -0.2 - 0.06 * comp, headX: 0.12, bounce: 0.11 * hop * Math.min(1, sp / 1.5) - 0.04 * comp
    };
    const c = w.crouch;
    const crouch = { hipL: 0.85, hipR: 0.85, kneeL: -1.55, kneeR: -1.55, shL: -0.55, shR: -0.55, shZL: 0.25, shZR: -0.25, elL: 0.4, elR: 0.4, spineX: -0.4, headX: 0.3 };
    const rising = Math.max(-1, Math.min(1, (s.vy || 0) / 1.5));
    const air = {
      hipL: 0.15 - 0.3 * rising, hipR: -0.05 - 0.15 * rising, kneeL: -0.35 + 0.2 * rising, kneeR: -0.6 + 0.3 * rising,
      shL: 0.35 + 0.3 * rising, shR: 0.35 + 0.3 * rising, shZL: 0.6, shZR: -0.6, elL: 0.45, elR: 0.45, spineX: -0.08, headX: -0.1 * rising
    };
    const slide = { spineX: 0.25, shZL: 0.8, shZR: -0.8, shL: 0.4, shR: 0.4, kneeL: -0.5, kneeR: -0.5, hipL: 0.35, hipR: 0.1 };
    // --- blend ---
    let ground = zero();
    addW(ground, idle, 1 - w.move);
    addW(ground, walk, w.move * (1 - w.lope));
    addW(ground, lope, w.move * w.lope);
    const landC = this.land * this.landAmt;
    const cr = Math.min(1, c + landC);
    const g2 = zero(); addW(g2, ground, 1 - cr); addW(g2, crouch, cr); ground = g2;
    const g3 = zero(); addW(g3, ground, 1 - w.slide); addW(g3, slide, w.slide); ground = g3;
    const pose = zero(); addW(pose, ground, 1 - w.air); addW(pose, air, w.air);
    if (s.seated) Object.assign(pose, zero(), { hipL: 1.5, hipR: 1.5, kneeL: -0.95, kneeR: -0.95, ankL: 0, ankR: 0, shL: 0.75, shR: 0.75, shZL: 0.15, shZR: -0.15, elL: 0.6, elR: 0.6, spineX: 0.08, headY: Math.sin(this.t * 0.4) * 0.3 });
    // feet stay roughly flat
    pose.ankL += -(pose.hipL + pose.kneeL) * 0.8; pose.ankR += -(pose.hipR + pose.kneeR) * 0.8;
    // lean into turns when moving fast
    this.bank += (Math.max(-0.35, Math.min(0.35, -(s.turnRate || 0) * sp * 0.12)) - this.bank) * Math.min(1, dt * 6);
    pose.spineZ = this.bank * (1 - w.air);
    // apply
    const L = u.legL, R = u.legR, AL = u.armL, AR = u.armR;
    L.hp.rotation.x = pose.hipL; R.hp.rotation.x = pose.hipR; L.kn.rotation.x = pose.kneeL; R.kn.rotation.x = pose.kneeR; L.an.rotation.x = pose.ankL; R.an.rotation.x = pose.ankR;
    AL.sh.rotation.x = pose.shL; AR.sh.rotation.x = pose.shR; AL.sh.rotation.z = -pose.shZL; AR.sh.rotation.z = -pose.shZR; AL.el.rotation.x = pose.elL; AR.el.rotation.x = pose.elR;
    u.spine.rotation.set(pose.spineX, pose.spineY, pose.spineZ); u.head.rotation.set(pose.headX, pose.headY, 0);
    // hip height from leg geometry so the lower foot touches the ground
    const drop = (h, k) => LEG.thigh * Math.cos(h) + LEG.shin * Math.cos(h + k);
    const legDrop = Math.max(drop(pose.hipL, pose.kneeL), drop(pose.hipR, pose.kneeR));
    const standY = LEG.ankleH + legDrop;
    u.hips.position.y = s.seated ? 0.4 : (standY + pose.bounce) * (1 - w.air) + LEG.hipY * w.air;
    u.hips.rotation.x = s.seated ? 0 : -0.15 * cr;
    if (u.model) u.model.rt.update();
    for (const k of steps) this.onStep(k);
  }
}

// ---------------- Lunar Roving Vehicle style rover (3.1 m long, 81.8 cm wire-mesh wheels) ----------------
export function makeRover() {
  const g = new THREE.Group();
  const frame = std(0xc4c7cc, { r: 0.35, m: 0.7, env: 1 }), dark = std(0x2a2b2f, { r: 0.9 }), seat = std(0x59606c, { r: 0.85, map: fabric([2, 2]) }), gold = std(0xd0a040, { r: 0.35, m: 0.9, map: foil('foilG', '#c8962e'), bump: foil('foilG', '#c8962e'), bs: 1.2, env: 1 });
  const chassis = new THREE.Group(); chassis.position.y = 0.6; g.add(chassis);
  chassis.add(mesh(rbox(1.9, 0.1, 3.0, 0.03), frame));
  for (const x of [-0.92, 0.92]) chassis.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.0, 8), frame, x, 0.02, 0).rotateX(Math.PI / 2));
  // two seats with tube frames and seat belts
  for (const x of [-0.4, 0.4]) {
    chassis.add(mesh(rbox(0.62, 0.06, 0.55, 0.02), seat, x, 0.2, 0.15));
    const back = mesh(rbox(0.62, 0.5, 0.05, 0.02), seat, x, 0.47, 0.43); back.rotation.x = -0.15; chassis.add(back);
    chassis.add(tube([[x - 0.3, 0.05, -0.15], [x - 0.3, 0.2, -0.1], [x - 0.3, 0.7, 0.45]], 0.015, frame));
    chassis.add(tube([[x + 0.3, 0.05, -0.15], [x + 0.3, 0.2, -0.1], [x + 0.3, 0.7, 0.45]], 0.015, frame));
  }
  chassis.add(mesh(rbox(0.36, 0.3, 0.2, 0.03), frame, 0, 0.35, -0.6)); // control & display console
  chassis.add(mesh(new THREE.BoxGeometry(0.06, 0.18, 0.06), dark, 0, 0.3, -0.35)); // hand controller
  chassis.add(mesh(rbox(0.5, 0.16, 0.36, 0.02), std(0x222831, { r: 0.4, m: 0.4 }), 0, 0.53, -0.62)); // display
  const mast = mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6), frame, 0.6, 0.75, -1.05); chassis.add(mast);
  const dish = mesh(new THREE.SphereGeometry(0.5, 20, 6, 0, Math.PI * 2, 0, 0.55), std(0xf0f0f0, { r: 0.45, side: THREE.DoubleSide }), 0.6, 1.6, -1.1); dish.rotation.x = -1.0; chassis.add(dish);
  const cam = mesh(rbox(0.16, 0.12, 0.26, 0.02), std(0xe6e6e6, { r: 0.4 }), -0.6, 0.85, -1.2); chassis.add(cam); chassis.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6), frame, -0.6, 0.5, -1.2));
  chassis.add(mesh(rbox(1.3, 0.38, 0.5, 0.03), gold, 0, 0.2, 1.35)); // aft stowage pallet
  chassis.add(mesh(rbox(0.5, 0.3, 0.3, 0.03), gold, 0, 0.17, -1.3)); // forward electronics
  const tyreMat = std(0xb0b3b8, { r: 0.5, m: 0.6, map: tread(), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, env: 1 });
  const hubMat = std(0x8a8d92, { r: 0.4, m: 0.7, env: 1 }), fenderMat = std(0x9a7230, { r: 0.6, m: 0.2, side: THREE.DoubleSide });
  const wheels = [];
  for (const [x, z] of [[-1.03, -1.15], [1.03, -1.15], [-1.03, 1.15], [1.03, 1.15]]) {
    const w = new THREE.Group(); w.position.set(x, 0.41, z); w.userData.baseY = 0.41;
    const spin = new THREE.Group(); w.add(spin);
    const tyre = mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.23, 28, 1, true), tyreMat); tyre.rotation.z = Math.PI / 2; spin.add(tyre);
    const inner = mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.18, 20, 1, true), std(0x45474c, { r: 0.8, side: THREE.DoubleSide })); inner.rotation.z = Math.PI / 2; spin.add(inner);
    const hub = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.25, 14), hubMat); hub.rotation.z = Math.PI / 2; spin.add(hub);
    for (let k = 0; k < 4; k++) { const sp = mesh(new THREE.BoxGeometry(0.02, 0.62, 0.04), hubMat); sp.rotation.x = k * Math.PI / 4; spin.add(sp); }
    const fender = mesh(new THREE.CylinderGeometry(0.49, 0.49, 0.27, 16, 1, true, Math.PI * 0.12, Math.PI * 0.76), fenderMat); fender.rotation.z = Math.PI / 2; w.add(fender);
    const arm = mesh(new THREE.BoxGeometry(0.06, 0.06, 0.5), frame, -Math.sign(x) * 0.12, 0.12, z < 0 ? 0.25 : -0.25); w.add(arm);
    g.add(w); wheels.push(w);
  }
  shadowAll(g); g.userData = { wheels, chassis };
  return g;
}

// ---------------- Apollo Lunar Module descent stage (the ascent stage has left) ----------------
export function makeLM() {
  const g = new THREE.Group();
  const gfoil = foil('foilG', '#c8962e'), sfoil = foil('foilS', '#9a9a96');
  const goldM = std(0xffffff, { r: 0.32, m: 0.9, map: gfoil, bump: gfoil, bs: 2, env: 1 });
  const blackM = std(0x262626, { r: 0.55, map: sfoil, bump: sfoil, bs: 1 }), silver = std(0xc8c8c8, { r: 0.3, m: 0.85, env: 1 });
  const stage = mesh(new THREE.CylinderGeometry(2.1, 2.1, 1.65, 8, 1), goldM, 0, 2.1, 0); stage.rotation.y = Math.PI / 8; g.add(stage);
  for (let i = 0; i < 4; i++) { const p = mesh(new THREE.BoxGeometry(1.5, 1.4, 0.04), blackM); const a = i * Math.PI / 2; p.position.set(Math.cos(a) * 1.96, 2.1, Math.sin(a) * 1.96); p.rotation.y = -a + Math.PI / 2; g.add(p); }
  g.add(mesh(new THREE.CylinderGeometry(1.75, 2.0, 0.14, 8), blackM, 0, 2.99, 0));
  g.add(mesh(new THREE.ConeGeometry(0.78, 0.95, 18, 1, true), std(0x3a3a3a, { r: 0.4, m: 0.6, side: THREE.DoubleSide, env: 1 }), 0, 0.98, 0));
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4, cx = Math.cos(a), cz = Math.sin(a);
    const leg = mesh(new THREE.CylinderGeometry(0.08, 0.07, 3.1, 10), goldM); leg.position.set(cx * 3.3, 1.05, cz * 3.3); leg.lookAt(cx * 1.9, 2.3, cz * 1.9); leg.rotateX(Math.PI / 2); g.add(leg);
    const pad = mesh(new THREE.CylinderGeometry(0.47, 0.42, 0.14, 18), silver, cx * 4.4, 0.06, cz * 4.4); g.add(pad);
    g.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.7, 4), silver, cx * 4.4, 0.9, cz * 4.4)); // contact probe
    for (const off of [-0.5, 0.5]) { const perp = [-cz, cx]; const s = mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.4, 6), silver); s.position.set(cx * 3.0 + perp[0] * off, 0.85, cz * 3.0 + perp[1] * off); s.lookAt(cx * 2.05 + perp[0] * off * 2.2, 1.6, cz * 2.05 + perp[1] * off * 2.2); s.rotateX(Math.PI / 2); g.add(s); }
  }
  for (let i = 0; i < 9; i++) g.add(mesh(new THREE.BoxGeometry(0.06, 0.04, 0.5), silver, 2.55 + i * 0.12, 0.45 + i * 0.25, 0)); // ladder
  g.add(mesh(new THREE.BoxGeometry(1.2, 0.06, 0.9), silver, 2.5, 2.62, 0)); // porch
  g.add(mesh(new THREE.BoxGeometry(0.45, 0.3, 0.02), std(0xd8d8d8, { r: 0.3, m: 0.9, env: 1 }), 2.35, 1.6, 0.53)); // commemorative plaque on the ladder strut
  shadowAll(g); return g;
}

// ---------------- Generic crew lander (original Astro Lab design) ----------------
export function makeLander() {
  const g = new THREE.Group();
  const white = std(0xffffff, { r: 0.5, map: panel(), bump: panel(), bs: 0.4 }), grey = std(0x6d7178, { r: 0.5, m: 0.4, env: 1 }), accent = std(0x4f8cff, { r: 0.45, e: 0x0e1e40, ei: 0.5 }), black = std(0x1b1b1d, { r: 0.4, m: 0.6, env: 1 });
  const gfoil = foil('foilG', '#c8962e');
  g.add(mesh(new THREE.CylinderGeometry(2.2, 2.4, 5.5, 24), white, 0, 4.4, 0));
  g.add(mesh(new THREE.ConeGeometry(2.2, 1.6, 24), white, 0, 7.95, 0));
  g.add(mesh(new THREE.CylinderGeometry(2.42, 2.42, 0.25, 24), accent, 0, 3.0, 0));
  g.add(mesh(new THREE.CylinderGeometry(2.45, 2.45, 1.2, 24, 1, true), std(0xffffff, { r: 0.35, m: 0.85, map: gfoil, bump: gfoil, bs: 1.5, env: 1, side: THREE.DoubleSide }), 0, 2.2, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.9, 1.3, 1.1, 18, 1, true), black, 0, 1.2, 0));
  g.add(mesh(rbox(0.95, 1.9, 0.14, 0.05), grey, 0, 3.9, -2.32)); // hatch
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 12), std(0x6fc6ff, { r: 0.1, m: 0.6, e: 0x0a2a44, ei: 0.6, env: 1 }), Math.sin(a) * 2.21, 6.2, Math.cos(a) * 2.21).rotateX(Math.PI / 2).rotateZ(a)); }
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2, cx = Math.cos(a), cz = Math.sin(a);
    const leg = mesh(new THREE.CylinderGeometry(0.12, 0.1, 3.8, 10), grey); leg.position.set(cx * 3.2, 1.6, cz * 3.2); leg.lookAt(cx * 2.0, 3.4, cz * 2.0); leg.rotateX(Math.PI / 2); g.add(leg);
    g.add(mesh(new THREE.CylinderGeometry(0.62, 0.55, 0.18, 16), grey, cx * 4.3, 0.09, cz * 4.3));
  }
  for (let i = 0; i < 10; i++) g.add(mesh(new THREE.BoxGeometry(0.6, 0.05, 0.08), grey, 0, 0.4 + i * 0.3, -2.55));
  shadowAll(g); return g;
}

export function makeFlag() {
  const g = new THREE.Group(); const pole = std(0xdadada, { r: 0.3, m: 0.7, env: 1 });
  g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.2, 8), pole, 0, 1.1, 0));
  const rod = mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.0, 6), pole, 0.5, 2.1, 0); rod.rotation.z = Math.PI / 2; g.add(rod);
  const cv = canvas(380, 200, (c) => {
    for (let i = 0; i < 13; i++) { c.fillStyle = i % 2 ? '#f4f4f4' : '#b22234'; c.fillRect(0, i * 200 / 13, 380, 200 / 13 + 0.5); }
    c.fillStyle = '#3c3b6e'; c.fillRect(0, 0, 152, 108); c.fillStyle = '#fff'; for (let y = 0; y < 9; y++) for (let x = 0; x < (y % 2 ? 5 : 6); x++) { c.beginPath(); c.arc(13 + x * 25 + (y % 2) * 12, 10 + y * 11, 3, 0, 7); c.fill(); }
  });
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
  const f = mesh(new THREE.PlaneGeometry(0.95, 0.5, 16, 4), new THREE.MeshStandardMaterial({ map: tx, side: THREE.DoubleSide, roughness: 0.9 }), 0.5, 1.84, 0);
  const p = f.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 9) * 0.025 + Math.sin(p.getX(i) * 4 + p.getY(i) * 3) * 0.015); // the famous "wrinkle" from the bent rod
  f.geometry.computeVertexNormals();
  g.add(f); shadowAll(g); return g;
}
export function makeRetroreflector() {
  const g = new THREE.Group(); const al = std(0xc8c8c8, { r: 0.35, m: 0.8, env: 1 });
  const panelTex = tex('lrrr', 128, 128, (c, w, h) => { c.fillStyle = '#20242a'; c.fillRect(0, 0, w, h); for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) { c.fillStyle = '#5c6a80'; c.beginPath(); c.arc(7 + x * 12.4, 7 + y * 12.4, 5, 0, 7); c.fill(); } });
  const p = mesh(new THREE.BoxGeometry(0.46, 0.05, 0.46), new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.12, metalness: 0.9 }), 0, 0.42, 0); p.material.userData.env = 1.5; p.rotation.x = -0.35; g.add(p);
  for (const [x, z] of [[-0.2, -0.15], [0.2, -0.15], [0, 0.18]]) g.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4), al, x, 0.2, z));
  shadowAll(g); return g;
}
export function makeSeismometer() {
  const g = new THREE.Group(); const gf = foil('foilG', '#c8962e'); const foilM = std(0xffffff, { r: 0.35, m: 0.8, map: gf, bump: gf, bs: 1, env: 1 });
  const cellTex = tex('cells', 128, 64, (c, w, h) => { c.fillStyle = '#121a33'; c.fillRect(0, 0, w, h); c.strokeStyle = '#34446e'; for (let x = 0; x < w; x += 8) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y < h; y += 8) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } });
  const solar = new THREE.MeshStandardMaterial({ map: cellTex, roughness: 0.2, metalness: 0.7 }); solar.userData.env = 1;
  g.add(mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.45, 14), foilM, 0, 0.23, 0));
  const a = mesh(new THREE.BoxGeometry(0.7, 0.02, 0.5), solar, -0.55, 0.38, 0); a.rotation.z = 0.25; g.add(a);
  const b = mesh(new THREE.BoxGeometry(0.7, 0.02, 0.5), solar, 0.55, 0.38, 0); b.rotation.z = -0.25; g.add(b);
  shadowAll(g); return g;
}
export function makePlaque() {
  const g = new THREE.Group(); const al = std(0xd0d0d0, { r: 0.3, m: 0.8, env: 1 });
  g.add(mesh(new THREE.BoxGeometry(0.16, 0.02, 0.09), al, 0, 0.012, 0));
  const fig = mesh(new THREE.CapsuleGeometry(0.01, 0.06, 3, 6), al, 0.12, 0.012, 0); fig.rotation.z = Math.PI / 2; g.add(fig);
  shadowAll(g); return g;
}
export function makeHuygens() {
  const g = new THREE.Group(); const m = std(0xb7b2a8, { r: 0.45, m: 0.5, env: 1 }), gf = foil('foilG', '#c8962e'), fo = std(0xffffff, { r: 0.4, m: 0.7, map: gf, bump: gf, bs: 1, env: 1 });
  g.add(mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.35, 24), m, 0, 0.18, 0));
  g.add(mesh(new THREE.ConeGeometry(0.65, 0.3, 24), fo, 0, 0.5, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.08, 14), m, 0.3, 0.68, 0.1));
  g.rotation.z = 0.1; shadowAll(g); return g;
}

// ---------------- Rocks: noise-displaced, flattened bases, with grain texture ----------------
function h3(x, y, z, s) { let h = (x * 374761393 + y * 668265263 + z * 1274126177 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vn3(x, y, z, s) { const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), f = t => t * t * (3 - 2 * t); const xf = f(x - xi), yf = f(y - yi), zf = f(z - zi); const l = (a, b, t) => a + (b - a) * t; const c = (i, j, k) => h3(xi + i, yi + j, zi + k, s); return l(l(l(c(0, 0, 0), c(1, 0, 0), xf), l(c(0, 1, 0), c(1, 1, 0), xf), yf), l(l(c(0, 0, 1), c(1, 0, 1), xf), l(c(0, 1, 1), c(1, 1, 1), xf), yf), zf); }
export function rockGeometry(sd = 1, round = false) {
  const g = new THREE.IcosahedronGeometry(1, round ? 3 : 2);
  const p = g.attributes.position, v = new THREE.Vector3();
  const facets = Array.from({ length: round ? 0 : 5 }, (_, i) => new THREE.Vector3(h3(i, 1, 2, sd) - 0.5, h3(i, 3, 4, sd) - 0.3, h3(i, 5, 6, sd) - 0.5).normalize());
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    let r = 1 + (vn3(v.x * 1.6 + sd, v.y * 1.6, v.z * 1.6, sd) - 0.5) * (round ? 0.25 : 0.55) + (vn3(v.x * 5, v.y * 5, v.z * 5, sd + 9) - 0.5) * (round ? 0.04 : 0.14);
    for (const f of facets) { const d = v.dot(f); if (d > 0.55) r = Math.min(r, 0.55 / d + 0.08); } // fractured flat faces
    v.multiplyScalar(r);
    v.y = v.y < -0.25 ? -0.25 + (v.y + 0.25) * 0.15 : v.y; // flattened base sits in the regolith
    v.y *= round ? 0.75 : 0.72;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
}

// Footprint and wheel-track decal textures
export const bootprintTex = () => tex('boot2', 64, 128, (c, w, h) => {
  // compacted regolith inside a print looks darker than the fluffy surface around it
  c.clearRect(0, 0, w, h); c.filter = 'blur(1.5px)';
  const grd = c.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, h * 0.5); grd.addColorStop(0, 'rgba(0,0,0,0.85)'); grd.addColorStop(0.8, 'rgba(0,0,0,0.7)'); grd.addColorStop(1, 'rgba(0,0,0,0.35)');
  c.fillStyle = grd; c.beginPath(); c.ellipse(w / 2, h * 0.3, w * 0.4, h * 0.25, 0, 0, 7); c.fill(); c.beginPath(); c.ellipse(w / 2, h * 0.72, w * 0.33, h * 0.2, 0, 0, 7); c.fill();
  c.fillRect(w * 0.2, h * 0.3, w * 0.6, h * 0.42);
  c.fillStyle = 'rgba(0,0,0,1)'; for (let y = 12; y < h - 10; y += 10) c.fillRect(w * 0.16, y, w * 0.68, 3.5); // ribbed overshoe sole
}, { srgb: false });
export const trackTex = () => tex('track2', 64, 64, (c, w, h) => {
  c.clearRect(0, 0, w, h); c.filter = 'blur(1px)'; c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(5, 0, w - 10, h);
  c.fillStyle = 'rgba(0,0,0,1)'; for (let y = 0; y < h; y += 16) { c.beginPath(); c.moveTo(9, y); c.lineTo(w / 2, y + 8); c.lineTo(w - 9, y); c.lineTo(w - 9, y + 5); c.lineTo(w / 2, y + 13); c.lineTo(9, y + 5); c.closePath(); c.fill(); }
}, { srgb: false });

export function makeModel(kind) {
  return ({ lm: makeLM, lander: makeLander, flag: makeFlag, lrrr: makeRetroreflector, psep: makeSeismometer, plaque: makePlaque, huygens: makeHuygens })[kind]?.() || null;
}
