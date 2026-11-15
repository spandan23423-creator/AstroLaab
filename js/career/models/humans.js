// ASTRO LAB Career — stylised-realistic people built from smooth procedural shapes, with idle, look-at, talk, wave, give and sit poses.
import * as THREE from '../../../vendor/three.module.js';
import { whenModel, instance, fit, markImported, makeRetarget, PERSON_MODELS } from '../../assets/models.js';
import { LOOKS } from '../data/people.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.75 }, o));
const lathe = (pts, seg = 28) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const taper = (r0, r1, len, seg = 18) => { const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1); g.translate(0, -len / 2, 0); return g; }; // hangs down from origin
const ball = (r, w = 20, hh = 14) => new THREE.SphereGeometry(r, w, hh);
const knitTex = (() => { let t = null; return () => { if (t) return t; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 64); for (let i = 0; i < 64; i += 4) { x.fillStyle = `rgba(0,0,0,${0.06 + (i % 8 ? 0 : 0.05)})`; x.fillRect(i, 0, 2, 64); } t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 4); t.colorSpace = THREE.SRGBColorSpace; return t; }; })();

// look: { skin, hair, hairStyle: 'short'|'bun'|'bob'|'long'|'balding'|'bald', shirt, pants, shoes, top: 'shirt'|'cardigan'|'jacket'|'sweater', topColor,
//         height, build, female, beard, moustache, glasses, eyes, lips, age }
export function makePerson(look = {}) {
  const L = Object.assign({ skin: 0xc68e6a, hair: 0x2b1d14, hairStyle: 'short', shirt: 0x3d5a99, pants: 0x2a2f3a, shoes: 0x1b1b1f, top: 'shirt', topColor: null, height: 1.75, build: 1, female: false, beard: false, moustache: false, glasses: false, eyes: 0x4a3222, lips: null, age: 0 }, look);
  if (L.coat && !look.top) { L.top = 'jacket'; L.topColor = L.coat; }
  const s = L.height / 1.75, b = L.build, root = new THREE.Group(); root.name = 'person';
  const skin = std(L.skin, { roughness: 0.58 });
  const shirtM = std(L.shirt, L.top === 'sweater' ? { map: knitTex() } : {});
  const topM = L.top === 'shirt' ? shirtM : std(L.topColor ?? L.shirt, { roughness: 0.85, map: L.top === 'cardigan' || L.top === 'sweater' ? knitTex() : null });
  const pantsM = std(L.pants, { roughness: 0.8 }), shoeM = std(L.shoes, { roughness: 0.42 }), hairM = std(L.hair, { roughness: 0.92 });
  const body = new THREE.Group(); body.scale.setScalar(s); root.add(body);
  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

  // ---- legs (hip -> knee -> ankle), tapered with soft joints
  const legs = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(0.095 * side * b, 0.93, 0); body.add(hip);
    add(hip, taper(0.085 * b, 0.064 * b, 0.45), pantsM);
    const knee = new THREE.Group(); knee.position.y = -0.45; hip.add(knee);
    add(knee, ball(0.064 * b, 14, 10), pantsM);
    add(knee, taper(0.062 * b, 0.046 * b, 0.43), pantsM);
    const foot = new THREE.Group(); foot.position.y = -0.43; knee.add(foot);
    const sh = add(foot, new THREE.CapsuleGeometry(0.048, 0.15, 4, 10), shoeM, 0, -0.035, 0.045); sh.rotation.x = Math.PI / 2; sh.scale.set(1.05, 1, 0.75);
    legs.push({ hip, knee, foot, side });
  }
  // ---- torso: pelvis + shaped chest (lathe), flattened front-to-back
  const spine = new THREE.Group(); spine.position.y = 0.95; body.add(spine);
  const pel = add(spine, lathe([[0.001, -0.09], [0.12 * b, -0.08], [0.142 * b, -0.02], [0.146 * b, 0.06], [0.145 * b, 0.1], [0.001, 0.1]]), pantsM); pel.scale.z = 0.7;
  const belt = add(spine, new THREE.TorusGeometry(0.15 * b, 0.012, 6, 28), std(0x2a2018, { roughness: 0.5 }), 0, 0.085, 0); belt.rotation.x = Math.PI / 2; belt.scale.set(1, 0.7, 1);
  const fw = L.female ? 0.86 : 1;
  const chestPts = [[0.001, 0.04], [0.156 * b, 0.05], [0.142 * b * fw, 0.2], [0.158 * b, 0.33], [0.175 * b * (L.female ? 0.93 : 1), 0.44], [0.16 * b, 0.52], [0.09, 0.585], [0.055, 0.6], [0.001, 0.6]];
  const chest = add(spine, lathe(chestPts), topM); chest.scale.z = 0.66;
  if (L.top === 'cardigan' || L.top === 'jacket') { // open front shows the shirt
    const under = add(spine, lathe([[0.001, 0.08], [0.07, 0.09], [0.075, 0.3], [0.06, 0.55], [0.001, 0.58]], 16), shirtM, 0, 0, 0.06 * b); under.scale.z = 0.95;
    for (const sd of [-1, 1]) { const lap = add(spine, new THREE.BoxGeometry(0.045, 0.2, 0.014), topM, 0.06 * sd, 0.45, 0.108 * b); lap.rotation.z = 0.32 * sd; lap.rotation.x = -0.12; }
    if (L.top === 'cardigan') for (let i = 0; i < 4; i++) add(spine, ball(0.008, 8, 6), std(0xe8dcc0), 0.075, 0.16 + i * 0.09, 0.105 * b);
  }
  add(spine, new THREE.TorusGeometry(0.058, 0.016, 8, 18), shirtM, 0, 0.585, 0).rotation.x = Math.PI / 2;
  if (L.female && L.top !== 'jacket') { const bust = add(spine, new THREE.CapsuleGeometry(0.06, 0.11, 4, 12), topM, 0, 0.38, 0.06); bust.rotation.z = Math.PI / 2; bust.scale.set(1, 1, 0.75); }
  // ---- neck + head
  const neck = new THREE.Group(); neck.position.y = 0.6; spine.add(neck);
  add(neck, taper(0.05, 0.046, 0.1), skin, 0, 0.1, 0);
  const head = new THREE.Group(); head.position.y = 0.18; head.scale.setScalar(1.12); neck.add(head);
  const skull = add(head, ball(0.112, 32, 24), skin); skull.scale.set(0.9, 1.06, 1.0);
  const jaw = add(head, ball(0.086, 28, 18), skin, 0, -0.036, 0.012); jaw.scale.set(0.88, 0.84, 0.95);
    const nose = add(head, new THREE.CapsuleGeometry(0.011, 0.022, 4, 10), skin, 0, -0.004, 0.104); nose.rotation.x = 0.35;
  add(head, ball(0.014, 12, 10), skin, 0, -0.022, 0.106).scale.set(1.3, 0.8, 0.9);
  const eyeW = std(0xf5f3ee, { roughness: 0.25 }), iris = std(L.eyes, { roughness: 0.3 }), pupil = std(0x0a0a0a, { roughness: 0.1 }), lidM = std(L.skin, { roughness: 0.6 });
  const eyes = [], lids = [];
  for (const sd of [-1, 1]) {
    const e = add(head, ball(0.0165, 16, 12), eyeW, 0.038 * sd, 0.018, 0.088);
    add(e, new THREE.CircleGeometry(0.0085, 16), iris, 0, 0, 0.0163);
    add(e, new THREE.CircleGeometry(0.004, 12), pupil, 0, 0, 0.0166);
    const lid = add(head, new THREE.SphereGeometry(0.0178, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), lidM, 0.038 * sd, 0.018, 0.088); lid.rotation.x = -0.25; lid.scale.y = 0.35;
    eyes.push(e); lids.push(lid);
    const brow = add(head, new THREE.CapsuleGeometry(0.005, 0.03, 3, 6), hairM, 0.04 * sd, 0.045, 0.098); brow.rotation.z = Math.PI / 2 - 0.12 * sd;
    const ear = add(head, ball(0.024, 12, 10), skin, 0.1 * sd, 0.0, -0.005); ear.scale.set(0.45, 1, 0.75);
  }
  const lipM = std(L.lips ?? (L.female ? 0xa8574f : 0x8e5446), { roughness: 0.45 });
  const mouth = new THREE.Group(); mouth.position.set(0, -0.052, L.beard ? 0.104 : 0.093); head.add(mouth);
  const upper = add(mouth, new THREE.CapsuleGeometry(0.0065, 0.03, 3, 8), lipM, 0, 0.004, 0); upper.rotation.z = Math.PI / 2;
  const lower = add(mouth, new THREE.CapsuleGeometry(0.0072, 0.026, 3, 8), lipM, 0, -0.005, -0.001); lower.rotation.z = Math.PI / 2;
  if (L.age > 0.5) for (const sd of [-1, 1]) { const w = add(head, new THREE.CapsuleGeometry(0.002, 0.018, 2, 4), std(L.skin * 0 + 0x000000, { transparent: true, opacity: 0.12 }), 0.058 * sd, 0.022, 0.087); w.rotation.z = 0.5 * sd; }
  // ---- hair
  const hs = L.hairStyle;
  if (hs !== 'bald') {
    if (hs === 'balding') {
      const ring = add(head, new THREE.TorusGeometry(0.098, 0.026, 10, 28, Math.PI * 1.3), hairM, 0, 0.012, -0.008); ring.rotation.set(Math.PI / 2, 0, Math.PI * 0.85); ring.scale.set(1.0, 1.08, 0.9);
    } else {
      const cap = add(head, new THREE.SphereGeometry(0.119, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.52), hairM, 0, 0.014, -0.004); cap.scale.set(0.95, 1.06, 1.05); cap.rotation.x = -0.32;
      const back = add(head, new THREE.SphereGeometry(0.114, 24, 14, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.3, Math.PI * 0.42), hairM, 0, 0, -0.008); back.rotation.y = Math.PI; back.scale.set(0.98, 1.05, 1.05);
      if (hs === 'bun') { add(head, ball(0.055, 16, 12), hairM, 0, 0.065, -0.112); add(head, new THREE.TorusGeometry(0.03, 0.008, 6, 14), std(0x6b4f8a), 0, 0.062, -0.085).rotation.y = 0.2; }
      if (hs === 'bob') { const bob = add(head, new THREE.SphereGeometry(0.128, 24, 14, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.35), hairM, 0, -0.02, -0.01); bob.scale.set(1.0, 1.1, 1.05); }
      if (hs === 'long') { const ln = add(head, new THREE.CapsuleGeometry(0.1, 0.18, 4, 14), hairM, 0, -0.1, -0.055); ln.scale.set(1.05, 1, 0.55); }
    }
  }
  if (L.beard) { const bd = add(head, new THREE.SphereGeometry(0.092, 26, 14, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), hairM, 0, -0.03, 0.016); bd.scale.set(0.92, 0.95, 1.0); bd.rotation.x = -0.35; }
  if (L.moustache || L.beard) { const mu = add(head, new THREE.CapsuleGeometry(0.009, 0.042, 3, 8), hairM, 0, -0.039, L.beard ? 0.107 : 0.1); mu.rotation.z = Math.PI / 2; }
  if (L.glasses) {
    const gm = std(0x2a2a2a, { metalness: 0.6, roughness: 0.3 }), lens = new THREE.MeshStandardMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.1 });
    for (const sd of [-1, 1]) { add(head, new THREE.TorusGeometry(0.022, 0.0028, 6, 20), gm, 0.039 * sd, 0.018, 0.108); add(head, new THREE.CircleGeometry(0.021, 16), lens, 0.039 * sd, 0.018, 0.107); const arm = add(head, new THREE.BoxGeometry(0.003, 0.003, 0.1), gm, 0.062 * sd, 0.02, 0.06); arm.rotation.y = -0.15 * sd; }
    add(head, new THREE.BoxGeometry(0.03, 0.003, 0.003), gm, 0, 0.024, 0.11);
  }
  // ---- arms (shoulder -> elbow -> wrist), hands with thumb and finger block
  const arms = [];
  const sleeveM = L.top === 'shirt' ? shirtM : topM;
  for (const side of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(0.172 * side * b, 0.5, 0); spine.add(sh);
    add(sh, ball(0.05 * b, 14, 10), sleeveM).scale.set(1, 0.9, 1);
    add(sh, taper(0.052 * b, 0.042 * b, 0.29), sleeveM);
    const el = new THREE.Group(); el.position.y = -0.29; sh.add(el);
    add(el, ball(0.043 * b, 12, 10), sleeveM);
    add(el, taper(0.041 * b, 0.032 * b, 0.25), L.top === 'shirt' && L.shortSleeves ? skin : sleeveM);
    const wrist = new THREE.Group(); wrist.position.y = -0.25; el.add(wrist);
    add(wrist, taper(0.03, 0.028, 0.03), skin);
    const palm = add(wrist, new THREE.BoxGeometry(0.06, 0.08, 0.026), skin, 0, -0.06, 0); palm.geometry.translate(0, 0, 0);
    const fing = add(wrist, new THREE.CapsuleGeometry(0.013, 0.05, 3, 8), skin, 0, -0.115, 0.002); fing.scale.set(2.1, 1, 0.9);
    const th = add(wrist, new THREE.CapsuleGeometry(0.011, 0.035, 3, 8), skin, 0.032 * -side * -1, -0.05, 0.016); th.rotation.z = 0.6 * side;
    sh.rotation.z = 0.07 * side; el.rotation.x = -0.12;
    arms.push({ sh, el, wrist, side });
  }
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  head.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } }); // small face parts look blotchy with self-shadowing
  // stand exactly on the floor: the shoe soles used to sit about 2 cm below it, so every built-in NPC sank into the ground
  { root.updateMatrixWorld(true); const bb = new THREE.Box3(), part = new THREE.Box3(); root.traverse(o => { if (o.isMesh) bb.union(part.setFromObject(o, true)); }); if (bb.min.y < 0 && bb.min.y > -0.1) body.position.y -= bb.min.y; }
  const rig = { root, body, spine, neck, head, legs, arms, eyes, lids, mouth, lower, t: Math.random() * 10, talk: 0, wave: 0, give: 0, giveTarget: 0, sit: 0, sitTarget: 0, lookTarget: null, hold: null,
    walk: 0, walkTarget: 0, walkPh: 0, ground: 0, groundTarget: 0, mask: null, cough: 0, holdHead: 0, holdHeadTarget: 0 };
  root.userData.rig = rig;
  rig.procMeshes = []; root.traverse(o => { if (o.isMesh) rig.procMeshes.push(o); });
  const name = look.model || Object.keys(LOOKS).find(k => LOOKS[k] === look);
  if (PERSON_MODELS[name]) attachPersonModel(rig, PERSON_MODELS[name], L.height);
  return rig;
}

// Swap in an imported person model once it has loaded. Rigged models are driven by this rig's joints every frame
// (so sitting, walking, waving and giving still work); static models just stand in place and turn a little to look.
function attachPersonModel(rig, key, height) {
  whenModel(key, gltf => {
    if (rig.model) return;
    const obj = instance(gltf);
    const holder = markImported(fit(obj, { size: height, by: 'height' }));
    rig.root.add(holder); rig.root.updateMatrixWorld(true);
    const R = rig.arms.find(a => a.side === 1), Lf = rig.arms.find(a => a.side === -1), LR = rig.legs.find(l => l.side === 1), LL = rig.legs.find(l => l.side === -1);
    const segs = { hips: rig.spine, neck: rig.neck, head: rig.head, upperArmL: R.sh, foreArmL: R.el, handL: R.wrist, upperArmR: Lf.sh, foreArmR: Lf.el, handR: Lf.wrist, thighL: LR.hip, calfL: LR.knee, thighR: LL.hip, calfR: LL.knee };
    let rt = null;
    let skinned = false; obj.traverse(o => { if (o.isSkinnedMesh) skinned = true; });
    if (skinned) {
      // measure against the standing rest pose (the rig may already be sitting when the model arrives)
      const saved = rig.root.userData.restSnapshot = snapshotRest(rig);
      rt = makeRetarget(obj, rig.root, segs);
      restoreSnapshot(saved);
    }
    for (const m of rig.procMeshes) m.visible = false;
    rig.model = { holder, obj, rt, wristBase: rig.arms.map(a => a.wrist.position.clone()), headBase: rig.head.position.clone() };
  });
}
// set every joint to its rest rotation for a moment (returns what to restore)
function snapshotRest(rig) {
  const saved = [];
  rig.root.traverse(o => { if ((o.isGroup || o.type === 'Object3D') && !o.userData.importedPart) { saved.push([o, o.quaternion.clone(), o.position.clone()]); } });
  const keep = new Set([rig.root]);
  for (const [o] of saved) if (!keep.has(o)) o.rotation.set(0, 0, 0);
  rig.spine.position.y = 0.95; rig.legs.forEach(l => { l.hip.position.y = 0.93; });
  rig.arms.forEach(a => { a.sh.rotation.z = 0.07 * a.side; a.el.rotation.x = -0.12; });
  rig.root.updateMatrixWorld(true);
  return saved;
}
function restoreSnapshot(saved) { for (const [o, q, p] of saved) { o.quaternion.copy(q); o.position.copy(p); } }
const _hw = new THREE.Vector3();
function syncPersonModel(rig, dt) {
  const M = rig.model;
  if (M.rt) {
    M.holder.position.y = 0.1 * rig.ground; // imported bodies are fuller than the built-in one: lift a little when sitting on the ground
    M.rt.update();
    // keep held objects and masks on the model's hands and head
    const b = M.rt.bones;
    for (const a of rig.arms) {
      const hand = a.side === 1 ? b.handL : b.handR; if (!hand) continue;
      hand.getWorldPosition(_hw); a.el.updateMatrixWorld(true); a.wrist.position.copy(a.el.worldToLocal(_hw));
    }
    if (b.head) { b.head.getWorldPosition(_hw); rig.neck.updateMatrixWorld(true); rig.head.position.copy(rig.neck.worldToLocal(_hw)); }
  } else {
    // static statue: turn the whole body a little towards what the head looks at, and breathe
    const yaw = rig.neck.rotation.y + rig.head.rotation.y;
    M.holder.rotation.y += (yaw * 0.45 - M.holder.rotation.y) * Math.min(1, dt * 4);
    M.holder.scale.y = 1 + Math.sin(rig.t * 1.6) * 0.004;
  }
}

// Put an object in a person's right hand (e.g. the envelope)
export function holdInHand(rig, obj, side = 1) { const a = rig.arms.find(x => x.side === side); a.wrist.add(obj); obj.position.set(0, -0.11, 0.03); rig.hold = obj; return obj; }

const v = new THREE.Vector3(), q = new THREE.Quaternion(), eul = new THREE.Euler();
export function animatePerson(rig, dt, { lookAt = null, talking = false } = {}) {
  rig.t += dt; const t = rig.t, k = Math.min(1, dt * 5);
  // sitting blend
  rig.sit += (rig.sitTarget - rig.sit) * Math.min(1, dt * 4); const S = rig.sit;
  // sitting on the ground (legs out in front, leaning back on the hands)
  rig.ground += (rig.groundTarget - rig.ground) * Math.min(1, dt * 4); const G = rig.ground;
  // walking: leg and arm swing (set rig.walkTarget 0..1 and move rig.root yourself)
  rig.walk += (rig.walkTarget - rig.walk) * Math.min(1, dt * 6); const Wk = rig.walk; rig.walkPh += dt * 7.5 * Wk;
  rig.legs.forEach(l => {
    const ph = rig.walkPh + (l.side > 0 ? 0 : Math.PI), sw = Math.sin(ph) * 0.45 * Wk;
    l.hip.rotation.x = -1.5 * S - 1.45 * G + sw; l.knee.rotation.x = 1.5 * S + 0.12 * G + Math.max(0, Math.sin(ph + 1.2)) * 0.7 * Wk; l.foot.rotation.x = -0.05 * S;
  });
  rig.spine.position.y = 0.95 - 0.47 * S - 0.86 * G + Math.sin(t * 1.6) * 0.004 + Math.abs(Math.sin(rig.walkPh)) * 0.02 * Wk;
  rig.legs.forEach(l => { l.hip.position.y = 0.93 - 0.47 * S - 0.86 * G; });
  rig.spine.rotation.x = -0.05 * S; rig.spine.rotation.z = Math.sin(t * 0.4) * 0.012;
  // look at target (yaw/pitch limited), smoothed
  let yaw = 0, pitch = 0;
  if (lookAt) {
    rig.head.getWorldPosition(v); const dx = lookAt.x - v.x, dy = lookAt.y - v.y, dz = lookAt.z - v.z;
    rig.root.getWorldQuaternion(q); const ry = eul.setFromQuaternion(q, 'YXZ').y;
    yaw = Math.atan2(dx, dz) - ry; while (yaw > Math.PI) yaw -= Math.PI * 2; while (yaw < -Math.PI) yaw += Math.PI * 2;
    const lr = rig.lookRange ?? 1.1; // a scene can narrow how far an NPC turns to follow you (rig.lookRange, radians)
    yaw = Math.max(-lr, Math.min(lr, yaw)); pitch = Math.max(-0.5 * lr / 1.1, Math.min(0.45 * lr / 1.1, -Math.atan2(dy, Math.hypot(dx, dz))));
  }
  const kl = rig.lookRate ? Math.min(1, dt * rig.lookRate) : k;
  rig.neck.rotation.y += (yaw * 0.55 - rig.neck.rotation.y) * kl; rig.head.rotation.y += (yaw * 0.45 - rig.head.rotation.y) * kl;
  rig.head.rotation.x += (pitch - rig.head.rotation.x) * kl;
  rig.eyes.forEach(e => { e.rotation.y = yaw * 0.25; e.rotation.x = pitch * 0.3; });
  // blink
  const bl = (t % 3.8) < 0.13; rig.lids.forEach(l => { l.scale.y = bl ? 1.0 : 0.35; });
  // talking: jaw/lip motion + small nods + right-hand gesture
  rig.talk += ((talking ? 1 : 0) - rig.talk) * Math.min(1, dt * 6);
  const open = rig.talk * Math.max(0, Math.sin(t * 15) * 0.5 + Math.sin(t * 9.3) * 0.5);
  rig.lower.position.y = -0.005 - open * 0.008; rig.mouth.scale.x = 1 - open * 0.15;
  rig.head.rotation.x += Math.sin(t * 3.1) * 0.03 * rig.talk;
  // arms: rest, gesture, give, wave
  const R = rig.arms.find(a => a.side === 1), Lf = rig.arms.find(a => a.side === -1);
  rig.give += (rig.giveTarget - rig.give) * Math.min(1, dt * 3);
  const restX = 0.06 * S - 0.04 + Math.sin(t * 1.6) * 0.015;
  R.sh.rotation.x = restX - 0.3 * rig.talk * (1 - rig.give) - 1.1 * rig.give - 0.5 * S + Math.sin(t * 2.3) * 0.1 * rig.talk;
  R.el.rotation.x = -0.15 - 0.85 * rig.talk * (1 - rig.give) - 0.35 * rig.give - 0.6 * S;
  R.sh.rotation.z = 0.07 + 0.1 * rig.give;
  if (rig.wave > 0) { rig.wave -= dt; const w = Math.min(1, rig.wave * 2, (2.2 - rig.wave) * 3); Lf.sh.rotation.z = -2.5 * w - 0.07 * (1 - w); Lf.el.rotation.z = Math.sin(t * 10) * 0.4 * w; Lf.sh.rotation.x = restX; }
  else { Lf.sh.rotation.z += (-0.07 - Lf.sh.rotation.z) * k; Lf.el.rotation.z *= 0.9; Lf.sh.rotation.x = restX - 0.5 * S; Lf.el.rotation.x = -0.12 - 0.6 * S; }
  // walking arm swing, ground sitting (hands behind on the ground), a hand to the head (headache), a cough
  if (Wk > 0.01) for (const a of rig.arms) a.sh.rotation.x += -Math.sin(rig.walkPh + (a.side > 0 ? 0 : Math.PI)) * 0.35 * Wk;
  if (G > 0.01) { rig.spine.rotation.x += -0.25 * G; for (const a of rig.arms) { a.sh.rotation.x = 0.55 * G + a.sh.rotation.x * (1 - G); a.sh.rotation.z = a.side * 0.25 * G + a.sh.rotation.z * (1 - G); a.el.rotation.x = -0.05 * G + a.el.rotation.x * (1 - G); } }
  rig.holdHead += (rig.holdHeadTarget - rig.holdHead) * Math.min(1, dt * 4); const HH = rig.holdHead;
  if (HH > 0.01) { Lf.sh.rotation.x = Lf.sh.rotation.x * (1 - HH) - 2.6 * HH; Lf.sh.rotation.z = Lf.sh.rotation.z * (1 - HH) - 0.5 * HH; Lf.el.rotation.x = Lf.el.rotation.x * (1 - HH) - 1.9 * HH; rig.head.rotation.z = Math.sin(t * 1.3) * 0.06 * HH; }
  if (rig.cough > 0) { rig.cough -= dt; const c = Math.max(0, Math.sin(rig.cough * 18)) * 0.15; rig.spine.rotation.x += c; rig.head.rotation.x += c; }
  if (rig.model) syncPersonModel(rig, dt);
}
// Put an oxygen mask over a person's mouth and nose (emergency drills). Returns the mask.
export function putOnMask(rig, col = 0xf2b632) {
  if (rig.mask) return rig.mask;
  const m = new THREE.Group(); const cup = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(col, { roughness: 0.4 })); cup.rotation.x = Math.PI / 2; m.add(cup);
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.005, 6, 24), std(0x222222)); strap.rotation.y = Math.PI / 2; strap.rotation.z = Math.PI / 2; strap.position.z = -0.08; m.add(strap);
  const hose = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.25, 8), std(0x2e8a4a)); hose.position.set(0, -0.14, 0.02); m.add(hose);
  m.position.set(0, -0.035, 0.095); rig.head.add(m); rig.mask = m; return m;
}
