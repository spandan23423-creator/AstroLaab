// ASTRO LAB Career — Training 2: Equipment Inspection. Check six pieces of spacewalk and safety gear, read the gauges and tags,
// and sort each one into SERVICEABLE (green) or UNSERVICEABLE (red). Two or three items have a hidden fault.
import * as THREE from '../../../vendor/three.module.js';
import { MAT } from '../models/materials.js';
import { makeSign } from '../models/props.js';
import { std, box, cyl } from '../models/house.js';
import { makeLabTable, makeBin } from '../models/suit.js';
import { LOOKS } from '../data/people.js';
import { makeUsable } from '../engine/interact.js';
import { trainingRoom, instructor, timer, finishExercise, invisibleMark } from './kit.js';
import { h, openModal } from '../../ui/dom.js';

const shadow = g => { g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g; };
const ITEMS = {
  tether: { name: 'Safety tether', y: 0.04, build() { const g = new THREE.Group(); const t = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.02, 8, 24), std(0x2b6ad8)); t.rotation.x = Math.PI / 2; g.add(t); box(0.08, 0.03, 0.05, MAT.metal(0xc0c4cc), 0.16, 0, 0, g); return g; },
    ok: ['Webbing: no fraying or cuts', 'Hook gate: snaps shut on its own', 'Load test tag: in date (next due in 5 months)'],
    faults: [[0, 'Webbing: frayed for about 3 cm next to the hook'], [1, 'Hook gate: stays open, the spring is broken'], [2, 'Load test tag: expired 2 months ago']] },
  oxygen: { name: 'Oxygen bottle', y: 0.09, build() { const g = new THREE.Group(); const c = cyl(0.07, 0.07, 0.42, std(0x3fa060, { roughness: 0.4 }), 0, 0, 0, g); c.rotation.z = Math.PI / 2; const v = cyl(0.03, 0.03, 0.08, MAT.metal(), 0.25, 0, 0, g); v.rotation.z = Math.PI / 2; cyl(0.035, 0.035, 0.02, std(0xffffff), 0.27, 0.05, 0, g); return g; },
    ok: ['Gauge: 2,950 psi (must be at least 2,800 psi)', 'Valve: turns smoothly, no hiss when closed', 'Cylinder: no dents'],
    faults: [[0, 'Gauge: 1,900 psi (must be at least 2,800 psi)'], [1, 'Valve: you hear a faint hiss when it is closed'], [2, 'Cylinder: a deep dent near the neck']] },
  light: { name: 'Helmet light', y: 0.05, build() { const g = new THREE.Group(); box(0.18, 0.08, 0.1, std(0xf2f3f5), 0, 0, 0, g); box(0.12, 0.05, 0.01, MAT.glow(0xfff4d0, 0.8), 0, 0, 0.055, g); return g; },
    ok: ['Lens: clear, no cracks', 'Battery: 98%', 'Switch: all three modes work'],
    faults: [[0, 'Lens: cracked across the middle'], [2, 'Switch: the light flickers and turns off']] },
  drill: { name: 'Pistol grip tool', y: 0.08, build() { const g = new THREE.Group(), m = std(0xd9dce2); box(0.24, 0.08, 0.08, m, 0, 0.04, 0, g); box(0.06, 0.16, 0.07, m, -0.06, -0.06, 0, g); cyl(0.02, 0.02, 0.06, MAT.metal(), 0.15, 0.04, 0, g).rotation.z = Math.PI / 2; box(0.05, 0.03, 0.01, MAT.glow(0x3fe0a0, 0.6), -0.02, 0.06, 0.042, g); return g; },
    ok: ['Torque check: set 25.0, measured 25.2 (allowed ±1.0)', 'Battery: 100%', 'Socket: locks in place'],
    faults: [[0, 'Torque check: set 25.0, measured 31.4 (allowed ±1.0)'], [2, 'Socket: wobbles and falls out']] },
  radio: { name: 'Comm cap (radio headset)', y: 0.06, build() { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(0xf2f2f2)); g.add(c); for (const s of [-1, 1]) cyl(0.045, 0.045, 0.03, std(0x1a1d24), s * 0.1, -0.02, 0, g).rotation.z = Math.PI / 2; box(0.01, 0.01, 0.12, std(0x1a1d24), 0.1, -0.04, 0.07, g); return g; },
    ok: ['Mic check: Mission Control hears you clearly', 'Earpieces: both work', 'Cable and plug: undamaged'],
    faults: [[0, 'Mic check: no signal, Mission Control cannot hear you'], [2, 'Cable: the insulation is split and wires show']] },
  extinguisher: { name: 'Fire extinguisher', y: 0.2, build() { const g = new THREE.Group(); cyl(0.07, 0.07, 0.36, std(0xc8202a, { roughness: 0.4 }), 0, 0, 0, g); box(0.06, 0.06, 0.06, std(0x1a1d24), 0, 0.21, 0, g); cyl(0.022, 0.022, 0.01, std(0xffffff), 0, 0.21, 0.035, g).rotation.x = Math.PI / 2; return g; },
    ok: ['Gauge needle: in the green band', 'Safety pin and seal: in place', 'Hose: no cracks'],
    faults: [[0, 'Gauge needle: in the red band (empty)'], [1, 'Safety pin and seal: missing']] }
};
const ORDER = Object.keys(ITEMS);

export default {
  id: 'inspection', title: 'Equipment Inspection', music: 'centre', ambience: 'vent',
  steps: [
    { id: 'brief', text: 'Talk to Inspector Rivera' },
    { id: 'check', text: 'Inspect all six items on the inspection mat' },
    { id: 'sign', text: 'Sign off the inspection log' }
  ],
  initialState: { steps: {}, mistakes: [], faulty: null, verdicts: {} },

  async build(ctx) {
    const { scene, player, carry, ix, hud, sfx, state } = ctx;
    trainingRoom(ctx, { w: 11, d: 8, title: 'EQUIPMENT CHECK', sub: 'Look · test · tag' });
    if (!state.faulty) { // 2 faulty items (3 on hard), each with one random fault
      const n = ctx.diff.faults === 'single' ? 2 : 3, pick = [...ORDER].sort(() => Math.random() - 0.5).slice(0, n);
      state.faulty = Object.fromEntries(pick.map(id => [id, Math.floor(Math.random() * ITEMS[id].faults.length)]));
    }
    const T = timer(ctx, 300);
    const bench = makeLabTable(4.2, 0.8); bench.position.set(-2, 0, -3.4); scene.add(bench); player.addBox(-4.1, 0.1, -3.8, -3.0, 0, 1);
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), std(0x2a6a4a, { roughness: 0.9 })); mat.rotation.x = -Math.PI / 2; mat.position.set(1.8, 0.935, -3.4);
    const mt = makeLabTable(1.4, 0.8, 0xdfe8f2); mt.position.set(1.8, 0, -3.4); scene.add(mt, mat); player.addBox(1.1, 2.5, -3.8, -3.0, 0, 1);
    const matSock = invisibleMark(scene, 1.8, 1.0, -3.4); matSock.scale.set(3, 0.6, 2);
    const s1 = makeSign('INSPECTION MAT', 'One item at a time', 1.3); s1.position.set(1.8, 2.1, -3.98); scene.add(s1);
    const good = makeBin(0x2e8a4a, 'SERVICEABLE'), bad = makeBin(0xc8202a, 'UNSERVICEABLE');
    good.position.set(4.2, 0, -1.4); bad.position.set(4.2, 0, 0.6); scene.add(good, bad); player.addBox(3.9, 4.5, -1.65, -1.15, 0, 0.7); player.addBox(3.9, 4.5, 0.35, 0.85, 0, 0.7);
    for (const [b, t, c] of [[good, 'SERVICEABLE', '#1f6b3a'], [bad, 'UNSERVICEABLE', '#8a1f24']]) { const s = makeSign(t, '', 1.1, c); s.position.set(5.46, 1.5, b.position.z); s.rotation.y = -Math.PI / 2; scene.add(s); }
    const logBook = new THREE.Group(); box(0.32, 0.03, 0.42, std(0x22406f), 0, 0, 0, logBook); box(0.3, 0.005, 0.4, std(0xf6f2e6), 0, 0.018, 0, logBook); logBook.position.set(-3.84, 0.95, -3.4); /* at the left end of the bench, clear of item 1 (they used to overlap) */ scene.add(logBook);
    const tech = instructor(ctx, LOOKS.tech, 'Inspector Rivera', [-1, -1.6, Math.PI * 0.8], () => ctx.isDone('brief') ? [{ who: 'Inspector Rivera', text: !ctx.isDone('check') ? 'Put an item on the green mat, read every line, then decide. Numbers matter: compare each reading with the limit.' : 'Sign the log book at the end of the bench.' }] : [
      { who: 'Inspector Rivera', text: 'Welcome back, {name}. Before any spacewalk, every tool and every piece of safety gear is checked. One bad tether or an empty oxygen bottle can end a mission.' },
      { who: 'Inspector Rivera', text: 'Six items are on the bench. Put each one on the inspection mat and work through its checklist. If anything is outside the limits, tag it UNSERVICEABLE. If it all checks out, tag it SERVICEABLE.' },
      { who: 'Inspector Rivera', text: 'Two of them have a fault today. Maybe more. Don\'t guess: read.', do: () => { if (ctx.done('brief')) T.start(); } }]);

    const objs = {};
    const tagged = id => state.verdicts[id] != null;
    ORDER.forEach((id, i) => {
      const o = shadow(ITEMS[id].build()); o.userData.iid = id; objs[id] = o;
      o.position.set(-3.3 + i * 0.6, 0.93 + ITEMS[id].y, -3.4); /* six evenly spaced slots between the log book and the bench end */ scene.add(o);
      carry.makeCarriable(o, { id, name: ITEMS[id].name });
    });
    const binPos = v => v === 'ok' ? new THREE.Vector3(4.2 + (Math.random() - 0.5) * 0.25, 0.62, -1.4 + (Math.random() - 0.5) * 0.2) : new THREE.Vector3(4.2 + (Math.random() - 0.5) * 0.25, 0.62, 0.6 + (Math.random() - 0.5) * 0.2);
    const toBin = (o, v) => { o.position.copy(binPos(v)); o.userData.locked = true; o.userData.it.enabled = () => false; };
    for (const id of ORDER) if (tagged(id)) toBin(objs[id], state.verdicts[id]);
    carry.makeSocket(matSock, { accepts: () => true, label: 'Inspection mat', offset: new THREE.Vector3(0, -0.05, 0),
      onPlace: o => { matSock.userData.filled = null; inspect(o); } });
    function inspect(o) {
      const id = o.userData.iid, I = ITEMS[id], f = state.faulty[id];
      const lines = I.ok.map((t, i) => (f != null && I.faults[f][0] === i) ? I.faults[f][1] : t);
      ctx.input.releaseLock();
      const decide = v => {
        m.close(); state.verdicts[id] = v; sfx.place();
        const isBad = f != null;
        if (v === 'ok' && isBad) ctx.mistake(`Tagged the ${I.name.toLowerCase()} serviceable, but: ${I.faults[f][1]}.`);
        if (v === 'bad' && !isBad) ctx.mistake(`Tagged a working ${I.name.toLowerCase()} unserviceable.`);
        hud.cap(`[${I.name} tagged ${v === 'ok' ? 'SERVICEABLE' : 'UNSERVICEABLE'}]`); toBin(o, v);
        if (ORDER.every(tagged)) { ctx.done('check'); hud.flash('All six items tagged. Sign the inspection log.', '', 3500); }
      };
      const m = openModal({ title: `🔍 ${I.name}`, label: 'Inspection', closable: false,
        body: h('div', {}, h('p', {}, 'Check every line. Is it safe to fly?'), h('ul', { class: 'cx-checklist' }, lines.map(l => { const [k, v] = l.split(': '); return h('li', {}, h('b', {}, k + ': '), v); }))),
        foot: [h('button', { class: 'btn', onclick: () => decide('bad') }, '🟥 Unserviceable'), h('button', { class: 'btn primary', onclick: () => decide('ok') }, '🟩 Serviceable')] });
    }
    ix.add(logBook); makeUsable(logBook, { label: 'Inspection log', verb: 'Sign', enabled: () => ctx.isDone('check') && !ctx.isDone('sign'), use: () => {
      ctx.input.releaseLock();
      const rows = ORDER.map(id => h('li', {}, h('b', {}, ITEMS[id].name + ': '), state.verdicts[id] === 'ok' ? 'SERVICEABLE' : 'UNSERVICEABLE'));
      const m = openModal({ title: '📋 Inspection log', label: 'Inspection log', closable: false, body: h('div', {}, h('ul', { class: 'cx-checklist' }, rows), h('p', { class: 'muted' }, `Inspected by ${ctx.name}. Faulty items are sent for repair and never packed for a mission.`)),
        foot: [h('button', { class: 'btn primary', onclick: () => { m.close(); ctx.done('sign'); finish(); } }, '✍ Sign the log')] });
    } });

    return {
      spawn: [0, 2.6, 0, 0],
      markerFor: id => ({ brief: tech.rig.root, check: ctx.isDone('brief') ? matSock : null, sign: logBook }[id] || null),
      onEnter: () => { if (!ctx.isDone('brief')) hud.flash('Talk to Inspector Rivera to begin.', '', 3500); },
      update(dt, blocked) { tech.update(dt); T.update(dt, blocked); }
    };
    function finish() {
      finishExercise(ctx, { id: 'inspection', title: 'Equipment Inspection', timer: T, xp: 130, badge: 'equipment-inspector',
        science: 'Before every spacewalk, crews check tethers, tools, lights and suit parts against written limits. Space station tools such as the pistol grip tool must tighten bolts to an exact torque, because a bolt that is too loose or too tight can fail in the cold of space. Safety tethers are load-tested and have expiry dates, just like climbing gear on Earth.' });
    }
  }
};
