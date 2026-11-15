// ASTRO LAB Career — Phase 7c: EVA / Spacewalk (simulated). Check the suit, run the airlock depress, float out along the
// handrails clipping your safety tether as you go, replace a failed antenna unit, and come back in.
import * as THREE from '../../../vendor/three.module.js';
import { MAT } from '../models/materials.js';
import { std, box, cyl } from '../models/house.js';
import { makeScreen, infoScreen } from '../models/centre.js';
import { makeUsable } from '../engine/interact.js';
import { Floater } from '../engine/float.js';
import { timer, finishExercise, invisibleMark } from './kit.js';
import { spaceBackdrop } from './space.js';
import { readDoc } from '../ui/panels.js';
import { h } from '../../ui/dom.js';

const ANCHORS = [[0, 2.2, -2.2], [4, 2.0, -4.2], [8, 2.0, -4.2], [11.6, 2.0, -4.2]];
const TETHER = 5.5;

export default {
  id: 'eva', title: 'EVA / Spacewalk', music: 'centre', ambience: 'vent',
  steps: [
    { id: 'brief', text: 'Listen to EVA Officer Rivera' },
    { id: 'suit', text: 'Suit check (helmet, gloves, oxygen, comms, tether)' },
    { id: 'depress', text: 'Run the airlock: close the inner hatch, depress, leak check, vacuum, open the outer hatch' },
    { id: 'translate', text: 'Move along the truss to the antenna, clipping your tether at each anchor' },
    { id: 'repair', text: 'Swap the failed antenna unit (unbolt, stow, install, bolt)' },
    { id: 'return', text: 'Return to the airlock and repressurise' }
  ],
  initialState: { steps: {}, mistakes: [], seq: 0, anchor: 0, bolts: [1, 1], rep: 'old' },

  async build(ctx) {
    const { scene, world, carry, ix, hud, sfx, state } = ctx;
    scene.background = new THREE.Color(0x000000);
    const sky = spaceBackdrop(scene, { earthPos: [0, -95, -30], earthR: 80, sun: [60, 50, 40] });
    scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x203050, 0.55));
    const white = std(0xe8ebf0, { roughness: 0.6 }), grey = MAT.metal(0x9aa3b2);
    // airlock module (open-ended tube we start inside), with hatches
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 4, 28, 1, true), std(0xe8ebf0, { roughness: 0.6, side: THREE.DoubleSide })); tube.rotation.x = Math.PI / 2; tube.position.set(0, 1.2, 0.4); scene.add(tube);
    const inner = new THREE.Mesh(new THREE.CircleGeometry(1.5, 28), white); inner.position.set(0, 1.2, 2.4); inner.rotation.y = Math.PI; scene.add(inner);
    const innerHatch = new THREE.Mesh(new THREE.CircleGeometry(0.6, 24), std(0x3a3f4a)); innerHatch.position.set(0, 1.2, 2.38); innerHatch.rotation.y = Math.PI; scene.add(innerHatch);
    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.08, 8, 28), grey); outerRing.position.set(0, 1.2, -1.6); scene.add(outerRing);
    const outerHatch = new THREE.Mesh(new THREE.CircleGeometry(1.45, 28), std(0xd9dce2, { roughness: 0.5, side: THREE.DoubleSide })); outerHatch.position.set(0, 1.2, -1.6); scene.add(outerHatch);
    const lampIn = new THREE.PointLight(0xfff0e0, 4, 5, 1.4); lampIn.position.set(0, 2.2, 0.8); scene.add(lampIn);
    const panel = makeScreen(0.55, 0.38, infoScreen('AIRLOCK', ['Pressure 14.7 psi'], { w: 384, hgt: 256 }), [384, 256]); panel.position.set(1.2, 1.3, 0.8); panel.rotation.y = -Math.PI / 2 - 0.3; scene.add(panel);
    // truss, antenna
    const truss = new THREE.Group(); for (let x = 0; x <= 14; x += 1.5) { box(0.06, 1.0, 0.06, grey, x, 0, -0.5, truss); box(0.06, 1.0, 0.06, grey, x, 0, 0.5, truss); } box(14.2, 0.08, 0.08, grey, 7, 0.5, 0.5, truss); box(14.2, 0.08, 0.08, grey, 7, -0.5, 0.5, truss); box(14.2, 0.08, 0.08, grey, 7, 0.5, -0.5, truss); box(14.2, 0.08, 0.08, grey, 7, -0.5, -0.5, truss);
    truss.position.set(0, 1.2, -4.2); scene.add(truss);
    const ant = new THREE.Group(); cyl(0.06, 0.06, 1.2, grey, 0, 0.6, 0, ant, 8); const dish = new THREE.Mesh(new THREE.SphereGeometry(0.7, 20, 10, 0, Math.PI * 2, 0, 1.0), std(0xf2f2f2, { side: THREE.DoubleSide })); dish.position.y = 1.4; dish.rotation.x = Math.PI; ant.add(dish); ant.position.set(12.4, 1.7, -4.2); scene.add(ant);
    const mount = new THREE.Group(); box(0.6, 0.4, 0.06, std(0x2a2d33), 0, 0, 0, mount); mount.position.set(12.4, 2.0, -3.62); scene.add(mount);
    const bolts = [[-0.22, 0.12], [0.22, -0.12]].map(([x, y], i) => { const b = cyl(0.03, 0.03, 0.05, MAT.metal(0xc0c4cc), 12.4 + x, 2.0 + y, -3.56, scene, 6); b.rotation.x = Math.PI / 2; b.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), new THREE.MeshBasicMaterial({ visible: false })));
      makeUsable(b, { label: `Antenna bolt ${i + 1}`, verb: 'Turn', range: 1.9, enabled: () => ctx.isDone('translate') && ((state.rep === 'old' && state.bolts[i]) || (state.rep === 'in' && !state.bolts[i])), use: () => { sfx.ui(); hud.cap('[Whirr: pistol grip tool]', 1000); state.bolts[i] = state.bolts[i] ? 0 : 1; b.position.z = state.bolts[i] ? -3.56 : -3.5; if (state.rep === 'in' && state.bolts.every(Boolean)) { ctx.done('repair'); hud.flash('Antenna fixed! Mission Control sees the signal. Head back to the airlock.', 'good', 4500); } if (state.rep === 'old' && state.bolts.every(v => !v)) { oldU.userData.locked = false; hud.flash('Bolts free. Take the old unit and stow it in your tool bag.', '', 3000); } } }); ix.add(b); return b; });
    const unit = (col, lamp) => { const g = new THREE.Group(); box(0.4, 0.26, 0.16, std(col), 0, 0, 0, g); box(0.05, 0.04, 0.01, MAT.glow(lamp, 1.2), 0.12, 0.08, 0.085, g); return g; };
    const oldU = unit(0x8a8f99, 0xff4040); oldU.position.set(12.4, 2.0, -3.5); scene.add(oldU); carry.makeCarriable(oldU, { id: 'oldunit', name: 'Failed antenna unit' }); oldU.userData.locked = true;
    const newU = unit(0x3e5c8a, 0x3fe0a0); newU.visible = false; scene.add(newU); carry.makeCarriable(newU, { id: 'newunit', name: 'New antenna unit' });
    const bag = new THREE.Group(); box(0.4, 0.3, 0.25, std(0xf2f2f2, { roughness: 0.95 }), 0, 0, 0, bag); bag.position.set(11.6, 1.75, -3.6); scene.add(bag);
    const bagS = invisibleMark(scene, 11.6, 1.75, -3.6); bagS.scale.set(2, 1.6, 1.6);
    carry.makeSocket(bagS, { accepts: 'oldunit', label: 'Tool bag', lock: true, onPlace: o => { o.visible = false; bagS.userData.filled = null; newU.position.set(11.6, 2.05, -3.6); newU.visible = true; state.rep = 'new'; } });
    const slot = invisibleMark(scene, 12.4, 2.0, -3.5); slot.scale.set(2, 1.4, 1);
    carry.makeSocket(slot, { accepts: o => o === newU || o === oldU, label: 'Antenna mount', lock: true, check: o => o === oldU ? { ok: false, msg: 'That\'s the failed unit (red light). Stow it in the tool bag.' } : { ok: true }, onPlace: () => { state.rep = 'in'; hud.flash('New unit seated. Tighten both bolts.', 'good'); } });
    // body + tether
    const T = timer(ctx, 540);
    const F = new Floater(ctx, { bounds: [-1.4, 1.4, 0, 2.4, -1.5, 2.2], start: [0, 1.25, 1.2], yaw: 0, push: 0.6, hardPush: 1.2, bumpLimit: 0.9 * ctx.diff.tolerance, onBump: v => ctx.mistake(`Hit the station at ${v.toFixed(1)} m/s.`) });
    F.addRail([-0.8, 0.5, 1.6], [0.8, 0.5, 1.6]); F.grab(F.rails[0]);
    const hatchRail = F.addRail([-0.5, 2.5, -1.75], [0.5, 2.5, -1.75], { label: 'Hatch handrail' });
    F.addRail([0.5, 2.25, -3.2], [0.5, 2.25, -3.9]);
    for (let x = 1.5; x <= 12; x += 2.5) F.addRail([x, 1.85, -3.6], [x + 1.2, 1.85, -3.6]);
    F.addRail([11.8, 2.45, -3.6], [12.9, 2.45, -3.6], { label: 'Work-site handrail' });
    // outside, every structure is solid: the truss, the airlock module you came out of, the antenna mast and dish, the
    // work-site mount plate and the tool bag (before, only the truss was, so you could drift through the rest)
    const outside = () => { F.bounds = [-3, 15, -2, 6, -8, 2.2]; F.boxes = [[-0.1, 14.1, 0.65, 1.75, -4.75, -3.65], [-1.55, 1.55, -0.35, 2.75, -1.5, 2.2], [12.3, 12.5, 1.7, 2.95, -4.3, -4.1], [11.7, 13.1, 2.75, 3.35, -4.9, -3.5], [12.1, 12.7, 1.8, 2.2, -3.68, -3.58], [11.4, 11.8, 1.6, 1.9, -3.73, -3.47]]; };
    if (state.seq >= 5) outside();
    // tether anchors (clip to the next one before you drift too far)
    const anchors = ANCHORS.map((p, i) => { const g = new THREE.Group(); const r = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 6, 16), MAT.glow(0xffc857, 0.8)); g.add(r); g.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 4), new THREE.MeshBasicMaterial({ visible: false }))); g.position.set(...p); scene.add(g);
      makeUsable(g, { label: `Tether anchor ${i + 1}`, verb: 'Clip to', range: 1.9, enabled: () => state.seq >= 5 && state.anchor !== i, use: () => { if (Math.abs(i - state.anchor) > 1) { sfx.wrong(); hud.flash('Clip anchors in order. Never unclip before the new hook is on.', 'bad'); ctx.mistake('Tried to skip a tether anchor.'); return; } state.anchor = i; sfx.place(); hud.cap(`[Click: tether hook on anchor ${i + 1}]`, 1500); paint(); } }); ix.add(g); return g; });
    const paint = () => anchors.forEach((a, i) => { const c = i === state.anchor ? 0x3fe0a0 : 0xffc857; a.children[0].material.color.set(c); a.children[0].material.emissive.set(c); });
    paint();
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffe08a })); scene.add(line);
    // airlock sequence
    const SEQ = ['Close the inner hatch', 'Depress to 5 psi', 'Suit leak check', 'Depress to vacuum', 'Open the outer hatch'];
    let psi = state.seq >= 4 ? 0 : state.seq >= 2 ? 5 : 14.7, target = psi;
    const drawPanel = () => panel.userData.screen.redraw(infoScreen('AIRLOCK', [`Pressure ${psi.toFixed(1)} psi`, ...SEQ.map((s, i) => [`${i < state.seq ? '✓' : i === state.seq ? '▶' : ' '} ${s}`, i < state.seq ? '#3fe0a0' : i === state.seq ? '#ffc857' : '#8a96b8'])], { w: 384, hgt: 256 }));
    drawPanel();
    function seqStep() {
      if (!ctx.isDone('suit')) { hud.flash('Do your suit check first.', 'bad'); return; }
      if (Math.abs(psi - target) > 0.05) return;
      const i = state.seq;
      if (i === 0) { innerHatch.material.color.set(0x2e8a4a); sfx.door(); }
      if (i === 1) { target = 5; hud.cap('[Hiss: air pumping out]', 3000); }
      if (i === 2) { hud.flash('Suit holds 4.3 psi, leak rate 0.0. Good seal.', 'good', 3000); }
      if (i === 3) { target = 0; hud.cap('[Hiss fades to silence]', 3000); }
      if (i === 4) { if (psi > 0.05) return; outerHatch.visible = false; sfx.door(); outside(); ctx.done('depress'); hud.flash('Hatch open. Clip your tether to anchor 1 outside, then follow the handrails to the antenna.', 'good', 5000); }
      state.seq++; drawPanel();
    }
    makeUsable(panel, { label: 'Airlock panel', verb: 'Next step:', range: 1.9, enabled: () => ctx.isDone('suit') && state.seq < 5, use: seqStep }); ix.add(panel);
    if (state.seq >= 5) outerHatch.visible = false;
    if (state.seq >= 1) innerHatch.material.color.set(0x2e8a4a);
    // return: catch the hatch handrail after the repair
    F.onGrab = rail => {
      if (rail.obj !== hatchRail || !ctx.isDone('repair') || ctx.isDone('return')) return;
      hud.flash('Inside. Closing the outer hatch and repressurising…', 'good', 3000); outerHatch.visible = true; sfx.door();
      F.bounds = [-1.4, 1.4, 0, 2.4, -1.5, 2.2]; F.boxes = []; F.pos.set(0, 1.25, -0.6); F.rail = null; F.vel.set(0, 0, 0); target = 14.7; returning = true;
    };
    let returning = false;
    const brief = () => ctx.talk([
      { who: 'EVA Officer Rivera (radio)', text: 'This is it, {name}: a full spacewalk simulation. You\'re in the airlock in your suit. Outside, an antenna unit has failed.' },
      { who: 'EVA Officer Rivera (radio)', text: 'Rules of the spacewalk: always stay tethered. Clip the next anchor before you leave the reach of the old one. Move hand over hand, gently. You have a lot of mass now: the suit alone is over 100 kg.' },
      { who: 'EVA Officer Rivera (radio)', text: 'Start with your suit check. Press E with nothing in view, or use the 🧑‍🚀 button.', do: () => { if (ctx.done('brief')) T.start(); } }]);
    const suitCheck = async () => {
      if (ctx.isDone('suit')) return; ctx.input.releaseLock();
      await readDoc({ title: '🧑‍🚀 Suit check', body: h('p', {}, 'Read each item on your wrist checklist and confirm it.'), ticks: ['Helmet locked to the neck ring', 'Both gloves locked, fingertips OK', 'Oxygen 100%, fan running', 'Comms check: Houston hears you', 'Safety tether hooked to the airlock'], confirm: 'Suit ready ▸' });
      ctx.done('suit'); hud.flash('Suit ready. Run the airlock sequence on the panel.', 'good');
    };
    const suitBtn = h('button', { class: 'tbtn cx-trim-btn', 'aria-label': 'Suit check', onclick: () => { if (!ctx.dlg.active) suitCheck(); } }, '🧑‍🚀', h('span', {}, 'Suit'));
    document.querySelector('#screen-career').append(suitBtn);
    if (ctx.isDone('suit')) suitBtn.remove();
    const tmp = new THREE.Vector3();
    return {
      spawn: [0, 1.2, 0, 0], floater: F,
      markerFor: id => ({ depress: panel, translate: carry.held ? null : ANCHORS.findIndex((p, i) => i > state.anchor) >= 0 ? anchors[state.anchor + 1] : ant, repair: state.rep === 'old' ? (state.bolts.some(Boolean) ? bolts.find((b, i) => state.bolts[i]) : oldU) : state.rep === 'new' ? (carry.held ? slot : newU) : bolts.find((b, i) => !state.bolts[i]) || mount, return: hatchRail }[id] || null),
      onEnter: () => { if (!ctx.isDone('brief')) brief(); else T.start(); },
      onUse: () => { if (!ctx.isDone('suit') && ctx.isDone('brief')) { suitCheck().then(() => suitBtn.remove()); return; } F.reel(); },
      dispose: () => suitBtn.remove(),
      update(dt, blocked) {
        sky.update(dt); T.update(dt, blocked);
        if (ctx.isDone('suit')) suitBtn.remove();
        F.enabled = ctx.isDone('depress') && !ctx.isDone('return') && !returning;
        F.update(dt, blocked);
        // pressure animation
        if (Math.abs(psi - target) > 0.01) { psi += Math.sign(target - psi) * Math.min(Math.abs(target - psi), dt * 2.2); drawPanel(); if (returning && psi >= 14.6) { ctx.done('return'); finish(); } }
        // tether: limit distance from the current anchor, draw the line
        if (state.seq >= 5) {
          const A = tmp.set(...ANCHORS[state.anchor]); const d = F.pos.distanceTo(A);
          if (d > TETHER && !F.rail) { const n = F.pos.clone().sub(A).normalize(); F.pos.copy(A).addScaledVector(n, TETHER); const vOut = F.vel.dot(n); if (vOut > 0) F.vel.addScaledVector(n, -vOut * 1.3); if (!this._tw) { this._tw = 1; hud.flash('Your tether is tight! Clip to the next anchor before moving on.', 'bad'); ctx.mistake('Pulled the safety tether tight.'); } }
          if (d < TETHER - 1) this._tw = 0;
          line.geometry.setFromPoints([A.clone(), F.pos.clone().add(new THREE.Vector3(0, -0.5, 0))]); line.visible = !ctx.isDone('return');
        } else line.visible = false;
        if (!ctx.isDone('translate') && ctx.isDone('depress') && F.pos.distanceTo(new THREE.Vector3(12.4, 2.0, -3.0)) < 1.6) { if (state.anchor < ANCHORS.length - 1) { if (!this._aw) { this._aw = 1; hud.flash('Clip to the last anchor next to the antenna first.', 'bad'); } } else { ctx.done('translate'); hud.flash('At the work site. Unbolt the failed unit.', 'good'); } }
        if (!blocked) hud.setReadout('Suit', [['O₂', `${(state.o2 = Math.min(state.o2 ?? 100, Math.max(60, 100 - Math.floor(T.t / 12))))}%`, 'good'], ['Suit pressure', state.seq >= 3 && !returning ? '4.3 psi' : 'cabin', ''], ['Speed', `${F.speed.toFixed(2)} m/s`, F.speed > F.bumpLimit ? 'bad' : ''], ['Tether', state.seq >= 5 ? `anchor ${state.anchor + 1}` : 'airlock', 'good']]);
      }
    };
    function finish() {
      finishExercise(ctx, { id: 'eva', title: 'EVA / Spacewalk', timer: T, xp: 260, badge: 'eva-ready', bonus: F.bumps ? 0 : 5,
        science: 'Spacewalks usually last 6 to 7 hours. Before going out, astronauts breathe pure oxygen to flush nitrogen from their blood and avoid "the bends", then the airlock is slowly emptied with a leak check on the way. Outside, they are always tethered and move hand over hand along handrails: there is nothing to push against except the station. This was a simplified simulation.' });
    }
  }
};
