// ASTRO LAB Career — Training 6: Emergency Alarm Drill. Inside a station-module mock-up an alarm goes off:
// fire, rapid pressure loss or a toxic (ammonia) leak. Read the warning panel, report to Mission Control,
// follow the procedure card in the right order, and confirm the crew is safe.
import * as THREE from '../../../vendor/three.module.js';
import { MAT } from '../models/materials.js';
import { makeSign } from '../models/props.js';
import { std, box, cyl } from '../models/house.js';
import { makeScreen, infoScreen } from '../models/centre.js';
import { makeUsable } from '../engine/interact.js';
import { makePerson, animatePerson, putOnMask } from '../models/humans.js';
import { LOOKS } from '../data/people.js';
import { fx as fxLayer } from '../engine/layers.js';
import { trainingRoom, timer, finishExercise } from './kit.js';
import { h, openModal } from '../../ui/dom.js';

const KINDS = {
  fire: { name: 'FIRE', col: '#ff5a3a', where: 'Lab rack 3', steps: ['mask', 'power', 'ext'],
    card: ['Put on your oxygen mask: smoke is poisonous.', 'Switch off power to the burning rack. Without power, most electrical fires go out.', 'Pick up the extinguisher from its wall bracket, aim at the base of the flames and hold the trigger (F / left mouse) until the fire is out.'], report: 'Fire alarm in the Lab, smoke at rack 3.' },
  depress: { name: 'RAPID DEPRESS', col: '#ffc857', where: 'Lab module', steps: ['gauge', 'leave', 'hatch'],
    card: ['Read the pressure gauge to see how fast air is leaving: that tells you how long you have.', 'Move to the safe side, through the hatch into the Node.', 'Close the hatch behind you to seal off the leaking module.'], report: 'Rapid depress alarm, pressure falling in the Lab.' },
  ammonia: { name: 'TOXIC ATMOSPHERE', col: '#c07aff', where: 'Lab module', steps: ['mask', 'leave', 'hatch'],
    card: ['Put on your oxygen mask straight away: ammonia burns your eyes and lungs.', 'Move to the safe side, through the hatch into the Node.', 'Close the hatch behind you to keep the ammonia out.'], report: 'Toxic atmosphere alarm, ammonia smell in the Lab.' }
};
const ACT = { mask: 'Put on the oxygen mask', power: 'Switch off rack power', ext: 'Use the fire extinguisher', gauge: 'Read the pressure gauge', leave: 'Move to the Node', hatch: 'Close the hatch' };

export default {
  id: 'emergency', title: 'Emergency Alarm Drill', music: 'centre', ambience: 'vent',
  steps: [
    { id: 'brief', text: 'Check in with Mission Control on the comm panel' },
    { id: 'identify', text: 'Read the caution and warning panel' },
    { id: 'report', text: 'Report the emergency to Mission Control' },
    { id: 'respond', text: 'Follow the emergency procedure card, in order' },
    { id: 'safe', text: 'Tell Mission Control the crew is safe' }
  ],
  initialState: { steps: {}, mistakes: [], kind: null, done: [] },

  async build(ctx) {
    const { scene, world, player, ix, hud, sfx, state } = ctx;
    if (!state.kind) state.kind = ['fire', 'depress', 'ammonia'][Math.floor(Math.random() * 3)];
    const K = KINDS[state.kind];
    trainingRoom(ctx, { w: 4.4, d: 16, hgt: 3.2, title: 'STATION MOCK-UP', sub: 'Lab module · Node', light: 0.9 });
    const T = timer(ctx, 200);
    // hatch wall between the Lab (z > -4) and the Node (z < -4)
    const wm = std(0xd9dce2, { roughness: 0.6 });
    box(1.4, 3.2, 0.2, wm, -1.5, 1.6, -4, scene); box(1.4, 3.2, 0.2, wm, 1.5, 1.6, -4, scene); box(1.6, 0.9, 0.2, wm, 0, 2.75, -4, scene);
    player.addBox(-2.2, -0.8, -4.1, -3.9, 0, 3.2); player.addBox(0.8, 2.2, -4.1, -3.9, 0, 3.2);
    const hatchFrame = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.06, 8, 32), MAT.metal(0x9aa3b2)); hatchFrame.position.set(0, 1.25, -4.12); scene.add(hatchFrame);
    const door = new THREE.Group(); box(1.5, 2.25, 0.08, std(0xb8bec8, { roughness: 0.5 }), 0.75, 0, 0, door); box(0.3, 0.06, 0.06, MAT.metal(0x3a3f4a), 1.2, 0, 0.06, door);
    door.position.set(-0.75, 1.15, -4.25); door.rotation.y = -Math.PI / 2; scene.add(door);
    const doorCol = player.addBox(-0.8, 0.8, -4.3, -4.2, 0, 3); doorCol.on = false;
    const nodeS = makeSign('NODE', 'Safe haven', 1.2, '#1f6b3a'); nodeS.position.set(0, 1.6, -7.98); /* below the STATION MOCK-UP title board: the two used to sit in exactly the same spot */ scene.add(nodeS);
    const labS = makeSign('LAB', 'Module', 1.2); labS.position.set(0, 2.5, 7.98); labS.rotation.y = Math.PI; scene.add(labS);
    // racks along the Lab walls
    const racks = [];
    for (let z = -2; z <= 6; z += 2) for (const s of [-1, 1]) { const r = new THREE.Group(); box(0.4, 2, 1.7, std(0xe8ebf0, { roughness: 0.6 }), 0, 0, 0, r); for (let i = 0; i < 5; i++) box(0.02, 0.24, 1.4, std([0x2b6ad8, 0x3a3f4a, 0x9aa3b2, 0x3a3f4a, 0x2b4f8f][i]), s * -0.21, -0.7 + i * 0.36, 0, r); r.position.set(s * 2.0, 1.2, z); scene.add(r); racks.push(r); player.addBox(s * 2.0 - 0.2, s * 2.0 + 0.2, z - 0.85, z + 0.85, 0, 2.2); }
    const rack3 = racks[5]; // east wall, z = 2
    // caution & warning panel, comm panel, procedure book, mask, power switch, extinguisher, gauge
    const cw = makeScreen(0.8, 0.5, infoScreen('CAUTION & WARNING', ['All systems normal', ['●  No alarms', '#3fe0a0']], { w: 384, hgt: 240 }), [384, 240]); cw.position.set(-1.78, 1.6, 0.9); cw.rotation.y = Math.PI / 2; scene.add(cw);
    const comm = makeScreen(0.5, 0.36, infoScreen('COMM', ['S-band: locked', 'Space-to-ground 1'], { w: 320, hgt: 230 }), [320, 230]); comm.position.set(-1.78, 1.5, 3.4); comm.rotation.y = Math.PI / 2; scene.add(comm);
    const book = new THREE.Group(); box(0.28, 0.36, 0.04, std(0xc8202a), 0, 0, 0, book); book.position.set(1.78, 1.5, -1.2); book.rotation.y = -Math.PI / 2; scene.add(book);
    const bookS = makeSign('EMERGENCY', 'Procedures', 0.7, '#8a1f24'); bookS.position.set(1.79, 1.95, -1.2); bookS.rotation.y = -Math.PI / 2; scene.add(bookS);
    const mask = new THREE.Group(); const mm = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(0xf2b632)); mm.rotation.x = Math.PI / 2; mask.add(mm); cyl(0.04, 0.04, 0.25, std(0x2e8a4a), 0, -0.18, -0.03, mask); mask.position.set(-1.78, 1.3, 5.1); mask.rotation.y = Math.PI / 2; scene.add(mask);
    const powerSw = new THREE.Group(); box(0.18, 0.26, 0.05, std(0x1a1d24), 0, 0, 0, powerSw); const lever = box(0.04, 0.12, 0.04, std(0xc8202a), 0, 0.04, 0.04, powerSw); powerSw.position.set(1.78, 1.6, 1.0); powerSw.rotation.y = -Math.PI / 2; scene.add(powerSw);
    // fire extinguishers: picked up by hand, aimed and sprayed manually (never used automatically)
    const makeExt = () => {
      const g = new THREE.Group(), red = std(0xc8202a, { roughness: 0.35, metalness: 0.2 }), blk = std(0x1a1d24, { roughness: 0.6 });
      cyl(0.075, 0.075, 0.42, red, 0, 0.21, 0, g, 20); const dome = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), red); dome.position.y = 0.42; g.add(dome);
      cyl(0.02, 0.025, 0.05, blk, 0, 0.5, 0, g, 10); box(0.03, 0.02, 0.14, blk, 0, 0.54, 0.05, g); const lever = box(0.025, 0.015, 0.12, MAT.metal(0x9aa3b2), 0, 0.57, 0.04, g); lever.rotation.x = -0.25;
      const gauge = cyl(0.018, 0.018, 0.01, std(0xffffff), 0.03, 0.49, 0.03, g, 12); gauge.rotation.z = Math.PI / 2;
      const hose = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 16, Math.PI), blk); hose.position.set(0, 0.42, 0.09); hose.rotation.y = Math.PI / 2; g.add(hose);
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 12, 1, true), blk); horn.position.set(0, 0.3, 0.12); g.add(horn);
      box(0.1, 0.12, 0.002, std(0xf2f2f2), 0, 0.22, 0.076, g); // label
      g.userData.nozzle = new THREE.Object3D(); g.userData.nozzle.position.set(0, 0.52, 0.16); g.add(g.userData.nozzle);
      return g;
    };
    const bracket = (x, z, ry) => { const b = new THREE.Group(); box(0.04, 0.5, 0.18, MAT.metal(0x8a90a0), 0, 0.45, 0, b); box(0.16, 0.03, 0.18, MAT.metal(0x8a90a0), 0.08, 0.22, 0, b); b.position.set(x, 0, z); b.rotation.y = ry; scene.add(b); return b; };
    bracket(-2.18, -3.3, 0); bracket(2.18, -6.6, Math.PI);
    const ext = makeExt(); ext.position.set(-2.06, 0.235, -3.3); scene.add(ext);
    const ext2 = makeExt(); ext2.position.set(2.06, 0.235, -6.6); scene.add(ext2);
    const extSign = makeSign('EXTINGUISHER', 'Pick up · aim · spray', 0.8, '#8a1f24'); extSign.position.set(-2.18, 1.25, -3.3); extSign.rotation.y = Math.PI / 2; scene.add(extSign);
    const fuel = new Map([[ext, 100], [ext2, 100]]);
    const gauge = new THREE.Group(); cyl(0.12, 0.12, 0.04, MAT.metal(0x9aa3b2), 0, 0, 0, gauge, 24).rotation.x = Math.PI / 2; cyl(0.1, 0.1, 0.01, std(0xffffff), 0, 0, 0.025, gauge, 24).rotation.x = Math.PI / 2; const needle = box(0.012, 0.08, 0.005, std(0xc8202a), 0, 0.03, 0.035, gauge); gauge.position.set(-1.78, 1.7, -2.4); gauge.rotation.y = Math.PI / 2; scene.add(gauge);
    // effects: red alarm lights, smoke or mist
    const alarmL = new THREE.PointLight(0xff3020, 0, 14, 1.4); alarmL.position.set(0, 2.9, 2); scene.add(alarmL);
    const puffs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshBasicMaterial({ color: state.kind === 'fire' ? 0x555555 : 0xd8c8ff, transparent: true, opacity: 0.35, depthWrite: false }), 40); puffs.visible = false; scene.add(puffs);
    const P = Array.from({ length: 40 }, () => ({ t: Math.random() * 3, x: 0, z: 0 }));
    let alarm = false, alarmT = 0, extinguished = false;
    // the fire itself (fire drill only): flickering flames at rack 3 with their own light
    const fire = new THREE.Group(); fire.position.set(1.72, 0.95, 2.0); scene.add(fire); fire.visible = false;
    const flames = Array.from({ length: 7 }, (_, i) => { const f = new THREE.Mesh(new THREE.ConeGeometry(0.09 + (i % 3) * 0.03, 0.4 + (i % 2) * 0.2, 10), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffb030 : 0xff5a20, transparent: true, opacity: 0.85, depthWrite: false })); f.position.set(-0.04 * (i % 2), 0.15, -0.5 + i * 0.17); fire.add(f); return f; });
    const fireL = new THREE.PointLight(0xff7a30, 0, 6, 1.6); fireL.position.set(-0.4, 0.4, 0); fire.add(fireL);
    fxLayer(fire); let fireHP = state.kind === 'fire' ? 100 : 0, reignWarn = false, orderWarn = false;
    const spray = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 4), new THREE.MeshBasicMaterial({ color: 0xf4f6fa, transparent: true, opacity: 0.55, depthWrite: false }), 80); spray.count = 0; spray.frustumCulled = false; fxLayer(spray); scene.add(spray);
    const SP = []; let sprayT = 0;
    // crew: two station crew working in the Lab who react to the alarm and move to the Node with you
    const crewDefs = [['Rosa', LOOKS.crewD, -1.25, 2.6, -Math.PI / 2, [-0.6, -6.2]], ['Ivan', LOOKS.crewC, 1.25, 5.0, Math.PI / 2, [0.7, -6.6]]];
    const crew = crewDefs.map(([name, look, x, z, ry, safe]) => {
      const rig = makePerson(look); rig.root.position.set(x, 0, z); rig.root.rotation.y = ry; scene.add(rig.root);
      const col = player.addBox(x - 0.25, x + 0.25, z - 0.25, z + 0.25, 0, 1.8);
      makeUsable(rig.root, { label: name, verb: 'Talk to', range: 2.6, use: () => ctx.talk([{ who: name, text: !alarm ? (ctx.isDone('brief') ? 'Just running the morning checks. If an alarm goes off, follow the book and we\'ll follow you.' : 'Morning! Check in with Houston on the comm panel first.') : state.kind === 'fire' ? 'Masks on, power off, then the extinguisher. We\'re heading for the Node!' : 'We\'re heading for the Node. Don\'t close the hatch until we\'re through!' }]) }); ix.add(rig.root);
      return { name, rig, col, path: [], safe, home: [x, z, ry], inNode: false };
    });
    // each crew member keeps to their own side of the hatch and the second one waits a moment, so they never walk through or stand inside each other
    const crewGo = () => crew.forEach((c, i) => { if (c.path.length || c.inNode) return; const lane = i ? 0.28 : -0.28; c.wait = i * 1.4; c.path = [[c.rig.root.position.x * 0.4, -1.0 - i * 0.3], [lane, -3.4], [lane, -4.8], c.safe]; c.rig.walkTarget = 1; });
    const crewInNode = () => crew.every(c => c.inNode);

    const redrawCW = () => cw.userData.screen.redraw(infoScreen('CAUTION & WARNING', alarm ? [[`⚠ ${K.name}`, K.col], `Location: ${K.where}`, ctx.isDone('identify') ? ['Acknowledged', '#c9d6ff'] : ['Press to acknowledge', '#ffc857']] : ['All systems normal', ['●  No alarms', '#3fe0a0']], { w: 384, hgt: 240 }));
    const startAlarm = () => { alarm = true; alarmT = 0; puffs.visible = state.kind !== 'depress'; fire.visible = state.kind === 'fire' && fireHP > 0; redrawCW(); hud.flash(`⚠ ALARM: ${K.name}`, 'bad', 4000);
      crew.forEach(c => { if (state.kind !== 'depress') { c.rig.cough = 1.2; setTimeout(() => putOnMask(c.rig), 1800); } }); };
    // Talking to Mission Control (via the comm panel)
    const MC = 'Mission Control (CAPCOM)';
    makeUsable(comm, { label: 'Comm panel', verb: 'Call Mission Control', range: 2.4, enabled: () => !ctx.isDone('brief') || (ctx.isDone('identify') && !ctx.isDone('report')) || (ctx.isDone('respond') && !ctx.isDone('safe')), use: async () => {
      if (!ctx.isDone('brief')) {
        await ctx.talk([{ who: MC, text: 'Station, Houston. Good morning, {name}. Today you\'re crew on our station mock-up. At some point an alarm will sound. You won\'t know which one.' },
          { who: MC, text: 'When it does: read the caution and warning panel, call us, then follow the red emergency book exactly, step by step. Speed matters, but order matters more.' },
          { who: MC, text: 'Take a look around and find the panel, the book, the masks and the hatch. Houston standing by.', do: () => { if (ctx.done('brief')) { T.start(); setTimeout(startAlarm, 9000 + Math.random() * 6000); } } }]);
      } else if (!ctx.isDone('report')) {
        const opts = Object.entries(KINDS).map(([k, v]) => ({ text: `Houston, Station: ${v.report}`, goto: k === state.kind ? 'right' : 'wrong' }));
        opts.sort(() => Math.random() - 0.5);
        await ctx.talk([{ who: ctx.name, text: '(Choose your report.)', choices: opts }, { id: 'wrong', who: MC, text: 'Station, Houston: our data shows something different. Look at the panel again. Copy?', do: () => ctx.mistake('Reported the wrong emergency to Mission Control.'), goto: 'end' },
          { id: 'right', who: MC, text: 'Station, Houston: copy. We see it too. Follow the emergency book. We\'re with you.', do: () => { ctx.done('report'); crewGo(); hud.cap('[Rosa and Ivan head for the Node]', 2500); } }]);
      } else {
        await ctx.talk([{ who: ctx.name, text: `Houston, Station: emergency procedure complete. Crew is safe${state.kind === 'fire' ? ', fire is out' : ', hatch is closed'}.` }, { who: MC, text: 'Copy, Station. Great work. That\'s the end of the drill. Take a breath.', do: () => { ctx.done('safe'); finish(); } }]);
      }
    } }); ix.add(comm);
    makeUsable(cw, { label: 'Caution & warning panel', verb: 'Read', range: 2.4, enabled: () => alarm && !ctx.isDone('identify'), use: () => { ctx.done('identify'); redrawCW(); hud.flash(`${K.name} in the ${K.where}. Report it to Mission Control.`, '', 4000); } }); ix.add(cw);
    makeUsable(book, { label: 'Emergency procedure book', verb: 'Open', range: 2.4, use: () => {
      ctx.input.releaseLock();
      const body = !alarm ? h('p', {}, 'The book has one card for each emergency: fire, rapid depress and toxic atmosphere. Come back when an alarm sounds.')
        : h('div', {}, h('p', {}, h('b', {}, `${K.name} card`), ' (do these in order):'), h('ol', { class: 'cx-checklist' }, K.card.map((c, i) => h('li', { class: state.done.includes(K.steps[i]) ? 'done' : '' }, c))));
      openModal({ title: '📕 Emergency procedures', label: 'Emergency procedures', body });
    } }); ix.add(book);
    // response actions: checked against the card order
    function act(id) {
      if (!alarm) { hud.flash('No alarm yet. Look around and get ready.', '', 2500); return; }
      if (!ctx.isDone('report')) { sfx.wrong(); hud.flash('Read the panel and report to Mission Control before you act.', 'bad'); ctx.mistake('Acted before reporting the alarm.'); return; }
      const want = K.steps[state.done.length];
      if (!K.steps.includes(id)) { sfx.wrong(); hud.flash(`${ACT[id]} is not on the ${K.name} card.`, 'bad'); ctx.mistake(`${ACT[id]}: not part of the ${K.name.toLowerCase()} procedure.`); return; }
      if (id !== want) { sfx.wrong(); hud.flash(`Not yet: the card says "${ACT[want]}" first.`, 'bad'); ctx.mistake(`Did "${ACT[id]}" before "${ACT[want]}".`); return; }
      state.done.push(id); sfx.good(); hud.cap(`[${ACT[id]} ✓]`, 1800); effects(id);
      if (state.done.length === K.steps.length) { ctx.done('respond'); alarm = false; alarmL.intensity = 0; hud.flash('Procedure complete. Tell Mission Control on the comm panel.', 'good'); }
    }
    function effects(id) {
      if (id === 'mask') { mask.visible = false; document.querySelector('#screen-career').classList.add('cx-masked'); }
      if (id === 'power') lever.rotation.x = Math.PI;
      if (id === 'ext') { extinguished = true; fireHP = 0; fire.visible = false; puffs.material.color.set(0xeeeeee); }
      if (id === 'hatch') { door.rotation.y = 0; door.position.set(-0.75, 1.15, -4.25); doorCol.on = true; sfx.door(); }
      if (id === 'gauge') hud.flash('Pressure 14.2 psi and falling 0.4 psi per minute: about 20 minutes before it gets dangerous. Move!', '', 4500);
    }
    makeUsable(mask, { label: 'Oxygen mask', verb: 'Put on', range: 2.2, enabled: () => mask.visible, use: () => act('mask') }); ix.add(mask);
    makeUsable(powerSw, { label: 'Rack 3 power switch', verb: 'Switch off', range: 2.2, enabled: () => !state.done.includes('power'), use: () => act('power') }); ix.add(powerSw);
    // the extinguisher is a normal carried item: pick it up (E), aim at the fire, hold F / left mouse / RT to spray
    for (const e of [ext, ext2]) ctx.carry.makeCarriable(e, { id: 'extinguisher', name: e === ext ? 'Fire extinguisher' : 'Spare fire extinguisher', hold: { rot: [-0.35, Math.PI, 0], pos: [0.24, -0.34, -0.55], big: false }, stow: false });
    makeUsable(gauge, { label: 'Pressure gauge', verb: 'Read', range: 2.2, enabled: () => !state.done.includes('gauge'), use: () => act('gauge') }); ix.add(gauge);
    makeUsable(door, { label: 'Hatch', verb: 'Close', range: 2.6, enabled: () => !state.done.includes('hatch'), use: () => {
      if (alarm && !crewInNode()) { sfx.wrong(); hud.flash('Wait! Rosa and Ivan are still coming through the hatch.', 'bad'); ctx.mistake('Tried to close the hatch before the whole crew was in the Node.'); return; }
      if (player.pos.z > -4.2) { sfx.wrong(); hud.flash('Close the hatch from the Node side, so you end up on the safe side.', 'bad'); if (alarm && ctx.isDone('report')) ctx.mistake('Tried to close the hatch from the dangerous side.'); return; }
      act('hatch');
    } }); ix.add(door);
    // restore
    if (ctx.isDone('brief') && !ctx.isDone('respond')) { T.start(); setTimeout(startAlarm, 1500); }
    for (const id of state.done) effects(id);
    if (ctx.isDone('report')) crew.forEach(c => { c.rig.root.position.set(c.safe[0], 0, c.safe[1]); Object.assign(c.col, { x0: c.safe[0] - 0.25, x1: c.safe[0] + 0.25, z0: c.safe[1] - 0.25, z1: c.safe[1] + 0.25 }); c.inNode = true; if (state.kind !== 'depress') putOnMask(c.rig); });
    const nozzleW = new THREE.Vector3(), aimDir = new THREE.Vector3(), tmpV = new THREE.Vector3(), fireC = new THREE.Vector3(2.0 - 0.3, 1.25, 2.0);
    function sprayStep(dt, on) {
      const held = ctx.carry.held, isExt = held === ext || held === ext2;
      if (ctx.input.touchButtons?.spray) ctx.input.touchButtons.spray.hidden = !isExt;
      if (isExt && on) {
        let f = fuel.get(held);
        if (f <= 0) { if ((sprayT += dt) > 1) { sprayT = 0; sfx.wrong(); hud.flash(held === ext ? 'Empty! Grab the spare extinguisher on the Node wall.' : 'This one is empty too.', 'bad', 2500); } }
        else {
          f = Math.max(0, f - dt * 12); fuel.set(held, f); sprayT += dt; if (sprayT > 0.18) { sprayT = 0; sfx.spray(); }
          held.userData.nozzle.getWorldPosition(nozzleW); world.camera.getWorldDirection(aimDir);
          // the item is drawn in the first-person layer, so map its nozzle to the world via the camera
          nozzleW.copy(world.camera.position).addScaledVector(aimDir, 0.55).add(tmpV.set(0, -0.18, 0));
          for (let i = 0; i < 3; i++) SP.push({ p: nozzleW.clone(), v: aimDir.clone().multiplyScalar(5 + Math.random()).add(tmpV.set((Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.6 + 0.2, (Math.random() - 0.5) * 0.9)), t: 0 });
          // does the cone of spray reach the fire?
          const toFire = fireC.clone().sub(world.camera.position), dist = toFire.length(), ang = toFire.normalize().angleTo(aimDir);
          if (fire.visible && dist < 5 && ang < 0.26) {
            const want = K.steps[state.done.length];
            if (!ctx.isDone('report')) { if (!orderWarn) { orderWarn = true; hud.flash('Report the alarm to Mission Control first, then follow the card.', 'bad'); ctx.mistake('Fought the fire before reporting it.'); } }
            else if (want !== 'ext') { if (!orderWarn) { orderWarn = true; sfx.wrong(); hud.flash(`Not yet: the card says "${ACT[want]}" first.`, 'bad'); ctx.mistake(`Sprayed the fire before "${ACT[want]}".`); } fireHP = Math.max(55, fireHP - dt * 30); }
            else { fireHP = Math.max(0, fireHP - dt * 38); if (fireHP <= 0) { hud.cap('[Hiss... the flames are out]', 2500); act('ext'); } }
            if (!state.done.includes('power') && fireHP <= 55 && !reignWarn) { reignWarn = true; hud.flash('The flames keep coming back: rack 3 still has power.', 'bad', 3500); }
          }
        }
      }
      // spray particles
      let n = 0; const M = new THREE.Matrix4();
      for (let i = SP.length - 1; i >= 0; i--) { const q = SP[i]; q.t += dt; if (q.t > 0.7) { SP.splice(i, 1); continue; } q.v.y -= dt * 2; q.p.addScaledVector(q.v, dt); const s = 0.4 + q.t * 3; if (n < 80) spray.setMatrixAt(n++, M.compose(q.p, new THREE.Quaternion(), tmpV.set(s, s, s))); }
      spray.count = n; spray.instanceMatrix.needsUpdate = true;
      if (isExt) hud.setReadout('Extinguisher', [['Agent left', `${Math.round(fuel.get(held))} %`, fuel.get(held) > 30 ? 'good' : 'bad'], ...(state.kind === 'fire' && !extinguished ? [['Fire', fireHP > 0 ? `${Math.round(fireHP)} %` : 'out', fireHP > 0 ? 'bad' : 'good']] : []), ['Spray', `hold ${ctx.input.lastDevice === 'pad' ? 'RT' : ctx.input.touch ? '💨' : 'F / left mouse'}`, '']]);
      else if (!isExt && this_readout) hud.setReadout(null);
      this_readout = isExt;
    }
    let this_readout = false;

    return {
      spawn: [0, 6.5, 0, 0],
      markerFor: id => {
        if (id === 'brief' || id === 'report' || id === 'safe') return comm;
        if (id === 'identify') return alarm ? cw : null;
        if (id === 'respond') { const n = K.steps[state.done.length]; if (n === 'ext') return (ctx.carry.held === ext || ctx.carry.held === ext2) ? fire : fuel.get(ext) > 0 ? ext : ext2; return { mask, power: powerSw, gauge, hatch: door, leave: nodeS }[n] || book; }
        return null;
      },
      onEnter: () => { if (!ctx.isDone('brief')) hud.flash('Call Mission Control on the comm panel to begin.', '', 3500); },
      defaultPrompt: () => (ctx.carry.held === ext || ctx.carry.held === ext2) ? { verb: 'Hold to spray at', label: fire.visible ? 'the fire' : 'a fire', key: { action: 'spray' } } : null,
      update(dt, blocked) {
        T.update(dt, blocked);
        sprayStep(blocked ? 0 : dt, !blocked && ctx.input.held('spray'));
        if (fire.visible) { const k = fireHP / 100; flames.forEach((f, i) => { const s = (0.4 + 0.6 * k) * (0.85 + Math.sin(performance.now() / 90 + i * 1.7) * 0.15); f.scale.set(s, s * (1 + Math.sin(performance.now() / 70 + i) * 0.15), s); }); fireL.intensity = (5 + Math.sin(performance.now() / 50) * 1.5) * k; if (fireHP <= 0) fire.visible = false; }
        const cam = world.camera.position;
        for (const c of crew) {
          if (c.wait > 0 && !blocked) c.wait -= dt;
          else if (c.path.length && !blocked) {
            const [tx, tz] = c.path[0], P = c.rig.root.position, dx = tx - P.x, dz = tz - P.z, d = Math.hypot(dx, dz);
            if (d < 0.08) { c.path.shift(); if (!c.path.length) { c.inNode = true; c.rig.walkTarget = 0; c.rig.root.rotation.y = 0; } }
            else { const sp = Math.min(d, dt * 1.1); P.x += dx / d * sp; P.z += dz / d * sp; let a = Math.atan2(dx, dz) - c.rig.root.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a)); c.rig.root.rotation.y += a * Math.min(1, dt * 8); }
            Object.assign(c.col, { x0: P.x - 0.25, x1: P.x + 0.25, z0: P.z - 0.25, z1: P.z + 0.25 });
          }
          animatePerson(c.rig, dt, { lookAt: !c.path.length && cam.distanceTo(c.rig.root.position) < 6 ? cam : null, talking: ctx.dlg.active && (ctx.dlg.el.querySelector('.cx-who')?.textContent || '') === c.name });
        }
        if (alarm) { alarmT += dt; alarmL.intensity = 8 * (0.5 + 0.5 * Math.sin(alarmT * 6)); if ((alarmT % 1.6) < dt) { sfx.alarm(); hud.cap('[Alarm: beep beep beep]', 1200); } }
        if (puffs.visible) {
          const src = state.kind === 'fire' ? rack3.position : new THREE.Vector3(1.6, 2, 4);
          P.forEach((q, i) => { q.t += dt * (extinguished ? 0.3 : 1); if (q.t > 3) { q.t = 0; q.x = (Math.random() - 0.5) * 0.4; q.z = (Math.random() - 0.5) * 0.8; } const s = 0.4 + q.t; puffs.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(src.x - 0.3 - q.t * 0.25 + q.x, src.y + 0.6 + q.t * 0.5, src.z + q.z * (1 + q.t)), new THREE.Quaternion(), new THREE.Vector3(s, s, s))); });
          puffs.instanceMatrix.needsUpdate = true; if (extinguished) puffs.material.opacity = Math.max(0, puffs.material.opacity - dt * 0.08);
        }
        if (state.kind === 'depress' && alarm) needle.rotation.z = Math.min(1.2, alarmT * 0.02);
        // 'leave' completes by walking through the hatch into the Node
        if (alarm && ctx.isDone('report') && K.steps.includes('leave') && !state.done.includes('leave') && player.pos.z < -4.6) {
          if (K.steps[state.done.length] === 'leave') act('leave');
          else if (!this._warnLeave) { this._warnLeave = true; act('leave'); }
        }
      }
    };
    function finish() {
      document.querySelector('#screen-career').classList.remove('cx-masked'); hud.setReadout(null);
      finishExercise(ctx, { id: 'emergency', title: 'Emergency Alarm Drill', timer: T, xp: 150,
        science: `The space station has three emergencies that every crew trains for: fire, rapid depressurisation and a toxic atmosphere (such as ammonia from the cooling system). For each one, the crew follows a printed procedure in a fixed order, working closely with Mission Control. Today you had: ${K.name.toLowerCase()}. Crews practise these drills on Earth and again soon after arriving on the station.` });
    }
  }
};
