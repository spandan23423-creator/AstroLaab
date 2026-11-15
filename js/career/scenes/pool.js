// ASTRO LAB Career — Training 5: Neutral Buoyancy Pool. Trim your weights until you neither sink nor float,
// move along handrails to a space station mock-up on the pool floor, and swap a faulty electronics box.
import * as THREE from '../../../vendor/three.module.js';
import { MAT } from '../models/materials.js';
import { makeSign } from '../models/props.js';
import { std, box, cyl } from '../models/house.js';
import { makePerson, animatePerson } from '../models/humans.js';
import { LOOKS } from '../data/people.js';
import { makeUsable } from '../engine/interact.js';
import { Floater } from '../engine/float.js';
import { timer, finishExercise, invisibleMark } from './kit.js';
import { h, openModal } from '../../ui/dom.js';

const KG = 0.5; // one lead weight
const PANEL = new THREE.Vector3(0, 1.7, -2.04);

export default {
  id: 'pool', title: 'Neutral Buoyancy Pool', music: 'centre', ambience: 'vent',
  steps: [
    { id: 'brief', text: 'Listen to Dive Lead Moana' },
    { id: 'trim', text: 'Trim your weights so you are neutral (use the weight pockets)' },
    { id: 'reach', text: 'Use the handrails to reach the mock-up\'s work panel' },
    { id: 'open', text: 'Undo the four panel bolts' },
    { id: 'swap', text: 'Stow the faulty box in the tool bag and install the new one' },
    { id: 'close', text: 'Tighten the four bolts again' },
    { id: 'ok', text: 'Give the safety diver the OK sign' }
  ],
  initialState: { steps: {}, mistakes: [], need: null, weights: 2, bolts: [1, 1, 1, 1], phase: 'old' },

  async build(ctx) {
    const { scene, world, carry, ix, hud, sfx, state } = ctx;
    if (state.need == null) state.need = 5 + Math.floor(Math.random() * 4); // weights needed for neutral (5..8)
    const W = 14, D = 14, H = 7.2;
    scene.background = new THREE.Color(0x0b3a52); scene.fog = new THREE.FogExp2(0x115a78, 0.075);
    scene.add(new THREE.HemisphereLight(0x9fe8ff, 0x0a2a3a, 1.1));
    const sun = world.shadowLight(new THREE.DirectionalLight(0xbff0ff, 1.6)); sun.position.set(2, 12, 3); scene.add(sun, sun.target);
    // pool tiles, walls, surface
    const tile = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#3aa0c8'; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#2a7a9e'; x.lineWidth = 3; for (let i = 0; i <= 128; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.moveTo(0, i); x.lineTo(128, i); x.stroke(); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const fl = tile.clone(); fl.repeat.set(7, 7); fl.needsUpdate = true;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), std(0xffffff, { map: fl, roughness: 0.6 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    for (const [x, z, r] of [[0, -D / 2, 0], [0, D / 2, Math.PI], [-W / 2, 0, Math.PI / 2], [W / 2, 0, -Math.PI / 2]]) { const t = tile.clone(); t.repeat.set(7, 3.6); t.needsUpdate = true; const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), std(0xffffff, { map: t, roughness: 0.6 })); m.position.set(x, H / 2, z); m.rotation.y = r; scene.add(m); }
    const surf = new THREE.Mesh(new THREE.PlaneGeometry(W, D, 24, 24), new THREE.MeshStandardMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.2, side: THREE.DoubleSide, emissive: 0x3a8aa8, emissiveIntensity: 0.4 })); surf.rotation.x = -Math.PI / 2; surf.position.y = H; scene.add(surf);
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(0.3, D - 1), std(0x1a3a5a)); lane.rotation.x = -Math.PI / 2; lane.position.set(-4, 0.005, 0); scene.add(lane);
    // bubbles
    const bub = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ color: 0xdff6ff, transparent: true, opacity: 0.6 }), 60); scene.add(bub);
    const bubs = Array.from({ length: 60 }, () => ({ x: (Math.random() - 0.5) * 10, y: Math.random() * H, z: (Math.random() - 0.5) * 10, s: 0.3 + Math.random() * 0.4 }));
    // the mock-up module on the pool floor
    const mod = new THREE.Group(), white = std(0xe8ebf0, { roughness: 0.6 });
    const shell = cyl(1.5, 1.5, 6, white, 0, 0, 0, mod, 28); shell.rotation.z = Math.PI / 2;
    for (const x of [-2.6, 0, 2.6]) { const r = cyl(1.55, 1.55, 0.12, MAT.metal(0x9aa3b2), x, 0, 0, mod, 28); r.rotation.z = Math.PI / 2; }
    mod.position.set(0, 1.5, -3.6); scene.add(mod);
    const nameS = makeSign('MOCK-UP', 'Station module, full size', 2); nameS.position.set(0, 3.3, -3.6); nameS.rotation.x = -0.3; scene.add(nameS);
    // work panel (on the module's side, facing +z)
    const panel = new THREE.Group(); box(1.0, 0.7, 0.06, std(0xd9dce2), 0, 0, 0, panel); box(0.62, 0.42, 0.02, std(0x1a1d24), 0, 0, 0.035, panel); panel.position.copy(PANEL); scene.add(panel);
    const boltPos = [[-0.42, 0.28], [0.42, 0.28], [-0.42, -0.28], [0.42, -0.28]];
    const bolts = boltPos.map(([x, y], i) => {
      const b = cyl(0.035, 0.035, 0.05, MAT.metal(0xc0c4cc), PANEL.x + x, PANEL.y + y, PANEL.z + 0.06, scene, 6); b.rotation.x = Math.PI / 2;
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), new THREE.MeshBasicMaterial({ visible: false })); b.add(hit);
      makeUsable(b, { label: `Bolt ${i + 1}`, verb: 'Turn', range: 1.9, enabled: () => (ctx.isDone('reach') && !ctx.isDone('open') && state.bolts[i]) || (ctx.isDone('swap') && !ctx.isDone('close') && !state.bolts[i]), use: () => turnBolt(i) }); ix.add(b);
      return b;
    });
    const setBolt = i => { bolts[i].position.z = PANEL.z + (state.bolts[i] ? 0.06 : 0.12); bolts[i].material = MAT.metal(state.bolts[i] ? 0xc0c4cc : 0xffc857); };
    bolts.forEach((b, i) => setBolt(i));
    function turnBolt(i) {
      sfx.ui(); hud.cap('[Whirr: pistol grip tool]', 1200); state.bolts[i] = state.bolts[i] ? 0 : 1; setBolt(i);
      if (!ctx.isDone('open') && state.bolts.every(b => !b)) { ctx.done('open'); hud.flash('Panel open. Pull the faulty box out and stow it in the tool bag.', 'good'); oldBox.userData.locked = false; }
      if (ctx.isDone('swap') && state.bolts.every(b => b)) { ctx.done('close'); hud.flash('Panel closed. Show the safety diver the OK sign.', 'good'); }
    }
    // the faulty box, the new box and the tool bag
    const ebox = (col, lamp) => { const g = new THREE.Group(); box(0.5, 0.32, 0.22, std(col, { roughness: 0.5 }), 0, 0, 0, g); box(0.06, 0.04, 0.01, MAT.glow(lamp, 1.2), 0.15, 0.1, 0.115, g); box(0.3, 0.04, 0.04, MAT.metal(), 0, -0.1, 0.12, g); return g; };
    const slot = invisibleMark(scene, PANEL.x, PANEL.y, PANEL.z + 0.14); slot.scale.set(2, 1.4, 1);
    const oldBox = ebox(0x8a8f99, 0xff4040); oldBox.position.set(PANEL.x, PANEL.y, PANEL.z + 0.14); scene.add(oldBox);
    carry.makeCarriable(oldBox, { id: 'oldbox', name: 'Faulty electronics box' }); oldBox.userData.locked = !ctx.isDone('open');
    const bag = new THREE.Group(); box(0.6, 0.45, 0.35, std(0xf2f2f2, { roughness: 0.9 }), 0, 0, 0, bag); box(0.62, 0.04, 0.37, std(0x2b6ad8), 0, 0.2, 0, bag); bag.position.set(1.3, 1.55, -2.0); scene.add(bag);
    const bagSock = invisibleMark(scene, 1.3, 1.6, -2.0); bagSock.scale.set(2.4, 2, 1.6);
    const newBox = ebox(0x3e5c8a, 0x3fe0a0); newBox.visible = false; scene.add(newBox);
    carry.makeCarriable(newBox, { id: 'newbox', name: 'New electronics box' });
    carry.makeSocket(bagSock, { accepts: 'oldbox', label: 'Tool bag', lock: true, offset: new THREE.Vector3(0, 0.05, 0), onPlace: o => { o.visible = false; bagSock.userData.filled = null; newBox.position.set(1.3, 1.85, -2.0); newBox.visible = true; state.phase = 'new'; hud.flash('Faulty box stowed. Take the new box out of the bag.', '', 3000); } });
    carry.makeSocket(slot, { accepts: o => o === newBox || o === oldBox, label: 'Box slot', lock: true,
      check: o => o === oldBox ? { ok: false, msg: 'That is the faulty box (red light). Stow it in the tool bag.' } : { ok: true },
      onPlace: () => { ctx.done('swap'); state.phase = 'done'; hud.flash('New box in. Tighten all four bolts.', 'good'); } });
    // restore
    if (state.phase !== 'old') { oldBox.visible = false; oldBox.userData.locked = true; newBox.visible = true; newBox.position.set(1.3, 1.85, -2.0); }
    if (state.phase === 'done') { newBox.position.set(PANEL.x, PANEL.y, PANEL.z + 0.14); newBox.userData.locked = true; slot.userData.filled = newBox; }
    // safety diver
    const diver = makePerson(LOOKS.diver); diver.root.position.set(2.6, 2.2, 0.6); diver.root.rotation.y = -0.9; scene.add(diver.root);
    const tank = cyl(0.12, 0.12, 0.6, std(0xd9a441, { metalness: 0.6, roughness: 0.3 }), 0, 1.3, -0.2, diver.root);
    makeUsable(diver.root, { label: 'Safety diver', verb: 'Give the OK sign to', range: 3.5, enabled: () => ctx.isDone('close') && !ctx.isDone('ok'), use: () => { ctx.done('ok'); hud.cap('[The safety diver signals OK back 👌]', 2000); setTimeout(finish, 1200); } }); ix.add(diver.root);
    // the floating body
    const T = timer(ctx, 360);
    const net = () => state.need * KG - state.weights * KG; // + floats up, - sinks (kg)
    const F = new Floater(ctx, { bounds: [-W / 2, W / 2, 0.1, H - 0.2, -D / 2, D / 2], start: [-3.2, 4.2, 4], yaw: Math.PI * 0.15, water: true, push: 0.6, hardPush: 1.2, bumpLimit: 0.9 * ctx.diff.tolerance,
      buoyancy: () => Math.max(-0.35, Math.min(0.35, net() * 0.12)), onBump: v => ctx.mistake(`Bumped into the pool or mock-up at ${v.toFixed(1)} m/s.`) });
    F.addBox([-3.1, 3.1, 0, 3.0, -5.1, -2.1]);
    // every interactive object in the water is solid as well: the work panel, the tool bag, the safety diver and the sign post
    F.addBox([PANEL.x - 0.52, PANEL.x + 0.52, PANEL.y - 0.37, PANEL.y + 0.37, PANEL.z - 0.05, PANEL.z + 0.1]);
    F.addBox([1.0, 1.6, 1.32, 1.8, -2.18, -1.82]);
    F.addBox([2.3, 2.9, 2.2, 4.0, 0.3, 0.9]);
    F.addBox([-1.0, 1.0, 3.0, 3.6, -3.8, -3.4]);
    F.addRail([-3.4, 4.2, 4.5], [-3.4, 4.2, 3.5]);
    F.addRail([-2.6, 3.25, -2.6], [-1.4, 3.25, -2.6]);
    F.addRail([-0.6, 2.25, -1.95], [0.6, 2.25, -1.95], { label: 'Work-site handrail' });
    F.addRail([0.9, 1.15, -1.95], [1.7, 1.15, -1.95]);
    F.grab(F.rails[0]);
    // weight pockets: shown as a usable item on your belt (onUse when nothing is in view, or the button)
    const trim = () => {
      ctx.input.releaseLock(); let n = state.weights;
      const out = h('div', { class: 'cx-trim' }), draw = () => { const v = (state.need - n) * KG; out.innerHTML = `<p style="font-size:1.3rem;text-align:center"><b>${n}</b> weights (${(n * KG).toFixed(1)} kg)</p><p style="text-align:center">Before you commit, watch the bubbles and feel which way you drift.</p>`; };
      draw();
      const m = openModal({ title: '⚖ Weight pockets', label: 'Weight pockets', body: h('div', {}, h('p', {}, 'Your suit is full of air, so it wants to float. Lead weights pull you down. Too few and you rise; too many and you sink. Add or remove one at a time.'), out),
        foot: [h('button', { class: 'btn', onclick: () => { n = Math.max(0, n - 1); draw(); } }, '− Remove one'), h('button', { class: 'btn', onclick: () => { n = Math.min(12, n + 1); draw(); } }, '+ Add one'), h('button', { class: 'btn primary', onclick: () => { state.weights = n; m.close(); sfx.place(); hud.cap('[Clunk: weights adjusted]'); } }, 'Done')] });
    };
    let still = 0;
    const brief = () => ctx.talk([
      { who: 'Dive Lead Moana (radio)', text: 'Hi {name}, Moana here. You\'re 4 metres down in the Neutral Buoyancy Pool. Astronauts practise spacewalks here for hours at a time.' },
      { who: 'Dive Lead Moana (radio)', text: 'First, get neutral: not sinking, not rising. Press E with nothing in view, or tap the ⚖ button, to open your weight pockets. Then hold still on the rail and watch the readout.' },
      { who: 'Dive Lead Moana (radio)', text: 'Water slows you down, so it\'s more forgiving than real zero-g, but treat it like space: handrails, slow pushes, no kicking into the hardware. Your job is to replace the faulty box on the mock-up\'s work panel.', do: () => { if (ctx.done('brief')) T.start(); } }]);
    const trimBtn = h('button', { class: 'tbtn cx-trim-btn', 'aria-label': 'Weight pockets', title: 'Weight pockets', onclick: () => { if (!ctx.dlg.active) trim(); } }, '⚖', h('span', {}, 'Weights'));
    document.querySelector('#screen-career').append(trimBtn);
    return {
      spawn: [-3.2, 4, 0, 0], floater: F,
      markerFor: id => ({ reach: panel, open: bolts.find((b, i) => state.bolts[i]) || null, swap: state.phase === 'old' ? bagSock : slot, close: bolts.find((b, i) => !state.bolts[i]) || null, ok: diver.root }[id] || null),
      onEnter: () => { if (!ctx.isDone('brief')) brief(); else T.start(); },
      onUse: () => { if (!F.rail && F.reel()) return; trim(); },
      update(dt, blocked) {
        F.enabled = ctx.isDone('brief') && ctx.isDone('trim') && !ctx.isDone('ok');
        // before trimming you can still drift with buoyancy, but you can't let go of the rail
        if (!ctx.isDone('trim') && F.rail) { F.grabPt.y += net() * 0.06 * dt; F.grabPt.y = Math.max(1, Math.min(H - 0.5, F.grabPt.y)); }
        F.update(dt, blocked); T.update(dt, blocked);
        animatePerson(diver, dt, { lookAt: world.camera.position.distanceTo(diver.root.position) < 8 ? world.camera.position : null });
        diver.root.position.y = 2.2 + Math.sin(performance.now() / 900) * 0.05;
        const nv = net(), drift = Math.abs(nv) < 0.26 ? 'neutral' : nv > 0 ? 'rising ↑' : 'sinking ↓';
        if (!blocked) hud.setReadout('Buoyancy', [['Weights', `${state.weights} (${(state.weights * KG).toFixed(1)} kg)`, ''], ['You are', drift, drift === 'neutral' ? 'good' : 'warn'], ['Speed', `${F.speed.toFixed(2)} m/s`, F.speed > F.bumpLimit ? 'bad' : ''], ['Air', 'umbilical OK', 'good']]);
        if (ctx.isDone('brief') && !ctx.isDone('trim')) { if (drift === 'neutral') { still += dt; if (still > 1.5) { ctx.done('trim'); hud.flash('Neutral! Now use the handrails to reach the work panel.', 'good'); } } else still = 0; }
        if (ctx.isDone('trim') && !ctx.isDone('reach') && F.pos.distanceTo(PANEL) < 1.5) { ctx.done('reach'); hud.flash('At the work site. Undo the four bolts.', 'good'); }
        const t = performance.now() / 1000; bubs.forEach((b, i) => { b.y += b.s * dt; if (b.y > H) b.y = 0; const m = new THREE.Matrix4().makeTranslation(b.x + Math.sin(t + i) * 0.05, b.y, b.z); bub.setMatrixAt(i, m); }); bub.instanceMatrix.needsUpdate = true;
        surf.position.y = H + Math.sin(t) * 0.02;
      }
    };
    function finish() {
      trimBtn.remove(); F.enabled = false;
      finishExercise(ctx, { id: 'pool', title: 'Neutral Buoyancy Pool', timer: T, xp: 160, badge: 'zero-g-trainee', bonus: F.bumps ? 0 : 5,
        science: 'NASA\'s Neutral Buoyancy Laboratory in Houston holds about 23 million litres of water and a full-size copy of parts of the space station. Divers add weights and floats to each suited astronaut until they neither sink nor rise. It feels a lot like weightlessness, but water drag slows you down, which real space does not. Astronauts train about 7 hours in the pool for every hour of a real spacewalk.' });
    }
  }
};
