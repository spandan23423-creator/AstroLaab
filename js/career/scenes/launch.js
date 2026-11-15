// ASTRO LAB Career — Phase 8: Launch Day (simplified). Final checks in the crew room, suit up, ride to the pad,
// strap in, the countdown with a GO/NO-GO poll, liftoff, ascent callouts, a circularisation burn, then orbit operations
// (system alerts and a roll-stability manoeuvre).
// Ends the story and hands you over to the solar-system game.
import * as THREE from '../../../vendor/three.module.js';
import { MAT, TEX } from '../models/materials.js';
import { makeSign } from '../models/props.js';
import { std, box, cyl } from '../models/house.js';
import { makeDisplayRocket } from '../models/outdoor.js';
import { makeScreen, infoScreen } from '../models/centre.js';
import { makePart, PART_ORDER, makeSuitStand } from '../models/suit.js';
import { LOOKS } from '../data/people.js';
import { makeUsable } from '../engine/interact.js';
import { trainingRoom, instructor, finishExercise } from './kit.js';
import { spaceBackdrop } from './space.js';
import { readDoc } from '../ui/panels.js';
import { career } from '../state/careerSave.js';
import { settings, save } from '../../systems/core.js';
import { h, openModal } from '../../ui/dom.js';

const PAD = new THREE.Vector3(300, 0, -60);
const EVENTS = [[12, 'throttle', 'Max Q: throttle down', 'THROTTLE'], [24, 'stage', 'Booster separation', 'STAGE'], [32, 'tower', 'Escape tower jettison', null], [46, 'meco', 'Main engine cutoff', 'MECO'], [50, 'sep', 'Spacecraft separation', 'SEP']];

export default {
  id: 'launch', title: 'Launch Day', music: 'centre', ambience: 'vent',
  steps: [
    { id: 'brief', text: 'Talk to Instructor Okafor in the crew room' },
    { id: 'medical', text: 'Final medical check with Dr. Hart' },
    { id: 'weather', text: 'Read the launch weather board' },
    { id: 'suit', text: 'Suit up and leak-check' },
    { id: 'drive', text: 'Ride the crew van to the launch pad' },
    { id: 'harness', text: 'Strap in: five harness buckles, then comms check' },
    { id: 'countdown', text: 'Countdown: answer the GO/NO-GO poll' },
    { id: 'ascent', text: 'Ascent: confirm each event when it is called' },
    { id: 'orbit', text: 'In orbit: burn at the highest point to circularise' },
    { id: 'ops', text: 'Orbit operations: answer system alerts, then stabilise the roll' }
  ],
  initialState: { steps: {}, mistakes: [], stage: 'room', buckles: 0 },

  async build(ctx) {
    const { scene, world, player, ix, hud, sfx, state } = ctx;
    // ---------- crew room ----------
    trainingRoom(ctx, { w: 12, d: 9, title: 'CREW QUARTERS', sub: 'Launch day', light: 1.05 });
    const okafor = instructor(ctx, LOOKS.okafor, 'Instructor Okafor', [-2.5, -2.4, 0.5], () => !ctx.isDone('brief') ? [
      { who: 'Instructor Okafor', text: 'Good morning, {name}. Today you launch. It\'s a simulation, but a very complete one, and I\'m proud of you.' },
      { who: 'Instructor Okafor', text: 'Final checks first: medical with Dr. Hart, the weather board, then suit up. The crew van leaves when you\'re ready.', do: () => ctx.done('brief') }]
      : [{ who: 'Instructor Okafor', text: ctx.isDone('suit') ? 'The van is waiting by the door. Go make history.' : 'Medical, weather, suit. Then the van.' }]);
    const hart = instructor(ctx, LOOKS.medic, 'Dr. Hart', [3.2, -2.8, -0.4], () => !ctx.isDone('brief') ? [{ who: 'Dr. Hart', text: 'Talk to Okafor first, {name}.' }] : !ctx.isDone('medical') ? [
      { who: 'Dr. Hart', text: 'Heart rate 72, blood pressure 118 over 76, temperature normal. Slept well?', choices: [{ text: 'Seven hours. Feeling good.', goto: 'ok' }, { text: 'Honestly, I\'m a bit nervous.', goto: 'nerv' }] },
      { id: 'nerv', who: 'Dr. Hart', text: 'That\'s completely normal, and honest. Breathe slowly; your training will take over.', goto: 'ok' },
      { id: 'ok', who: 'Dr. Hart', text: 'You\'re cleared to fly.', do: () => ctx.done('medical') }] : [{ who: 'Dr. Hart', text: 'Cleared to fly. Good luck.' }]);
    const wx = makeScreen(1.4, 0.9, infoScreen('LAUNCH WEATHER', ['Wind: 14 km/h (limit 55)', 'Lightning: none within 18 km', 'Cloud: thin, high', 'Upper-level winds: within limits', ['Probability GO: 90%', '#3fe0a0']], { w: 512, hgt: 330 }), [512, 330]);
    wx.position.set(-5.95, 1.7, 1.2); wx.rotation.y = Math.PI / 2; scene.add(wx);
    makeUsable(wx, { label: 'Weather board', verb: 'Read', range: 3, enabled: () => ctx.isDone('brief') && !ctx.isDone('weather'), use: () => { ctx.done('weather'); hud.flash('Weather is GO. Strong wind, lightning or high-altitude wind would have scrubbed the launch.', 'good', 4500); } }); ix.add(wx);
    const stand = makeSuitStand(); stand.position.set(4.5, 0, 2.6); scene.add(stand);
    PART_ORDER.filter(p => p !== 'cooling').forEach(id => { const o = makePart(id); const m = { lower: [0, 0.62, 0], boots: [0, 0.08, 0.04], upper: [0, 1.12, 0], plss: [0, 1.12, -0.3], gloveL: [-0.42, 0.66, 0.02], gloveR: [0.42, 0.66, 0.02], helmet: [0, 1.5, 0.02] }[id]; if (id === 'plss') return; o.position.set(4.5 + m[0], m[1], 2.6 + m[2]); stand.parent.add(o); });
    const suitHit = new THREE.Mesh(new THREE.BoxGeometry(1, 1.9, 0.8), new THREE.MeshBasicMaterial({ visible: false })); suitHit.position.set(4.5, 0.95, 2.6); scene.add(suitHit);
    makeUsable(suitHit, { label: 'Launch and entry suit', verb: 'Suit up', range: 2.6, enabled: () => ctx.isDone('medical') && ctx.isDone('weather') && !ctx.isDone('suit'), use: async () => {
      ctx.input.releaseLock();
      await readDoc({ title: '🧑‍🚀 Suit up', body: h('p', {}, 'The launch suit protects you if the cabin loses pressure during launch or landing. Technicians help you into it.'), ticks: ['Suit on, zips closed', 'Gloves locked', 'Helmet on, visor up', 'Leak check: suit holds pressure', 'Comm cap plugged in'], confirm: 'Ready ▸' });
      ctx.done('suit'); hud.flash('Suited up! Head to the crew van door.', 'good');
    } }); ix.add(suitHit);
    const door = new THREE.Group(); box(1.4, 2.3, 0.1, std(0x3a3f4a), 0, 1.15, 0, door); door.position.set(0, 0, 4.45); scene.add(door);
    const ds = makeSign('CREW VAN', 'To the launch pad', 1.2); ds.position.set(0, 2.7, 4.42); ds.rotation.y = Math.PI; scene.add(ds);
    makeUsable(door, { label: 'Door to the crew van', verb: 'Go through', range: 2.6, enabled: () => state.stage === 'room', use: () => { if (!ctx.isDone('suit')) { hud.flash('Finish your checks and suit up first.', 'bad'); return; } toVan(); } }); ix.add(door);
    // ---------- outside: road, pad, rocket ----------
    const out = new THREE.Group(); out.visible = false; scene.add(out);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), std(0x7a8a5a, { map: TEX.grass?.([80, 80]) || null, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.set(PAD.x, -0.02, 0); out.add(ground);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(8, 300), std(0x3a3d42, { roughness: 0.9 })); road.rotation.x = -Math.PI / 2; road.position.set(PAD.x, 0, 90); out.add(road);
    const rocket = makeDisplayRocket(2.2); rocket.position.copy(PAD); out.add(rocket);
    const tower = new THREE.Group(); for (let y = 0; y < 54; y += 3) { box(3, 0.2, 3, MAT.metal(0xc84a2a), 0, y, 0, tower); for (const [x, z] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) box(0.2, 3, 0.2, MAT.metal(0xc84a2a), x, y + 1.5, z, tower); } tower.position.set(PAD.x + 7, 0, PAD.z); out.add(tower);
    // crew van: an open cabin you sit inside (the old one was a solid box around the camera, so its faces were culled and
    // you saw neither the van nor much else). Walls are double-sided, the windows are real gaps, and it drives with you.
    const van = new THREE.Group(), vw = std(0xf2f2f2, { roughness: 0.4, side: THREE.DoubleSide }), vs = std(0x2b4f8f, { side: THREE.DoubleSide }), vd = std(0x2a2d33, { roughness: 0.8 });
    box(2.4, 0.08, 5, vd, 0, 0.62, 0, van);                                                     // floor
    box(2.4, 0.08, 5, vw, 0, 2.42, 0, van);                                                     // roof
    for (const sx of [-1, 1]) { box(0.06, 0.62, 5, vw, sx * 1.2, 0.95, 0, van); box(0.06, 0.12, 5, vs, sx * 1.2, 1.32, 0, van); for (const z of [-2.45, -0.9, 0.9, 2.45]) box(0.06, 1.0, 0.12, vw, sx * 1.2, 1.88, z, van); } // lower sides, stripe, window pillars
    box(2.4, 1.8, 0.06, vw, 0, 1.5, 2.5, van);                                                  // rear wall
    box(2.4, 0.5, 0.5, vd, 0, 1.1, -2.3, van); for (const sx of [-1, 1]) box(0.12, 1.1, 0.08, vw, sx * 1.15, 1.85, -2.5, van); // dashboard, windscreen pillars
    for (const [x, z] of [[-0.55, -1.2], [0.5, -1.2], [-0.55, 0.3], [0.5, 0.3]]) { box(0.55, 0.12, 0.55, std(0x3a3e46), x, 1.05, z, van); box(0.55, 0.6, 0.1, std(0x3a3e46), x, 1.4, z + 0.3, van); } // seats
    for (const [x, z] of [[-1.1, -1.6], [1.1, -1.6], [-1.1, 1.7], [1.1, 1.7]]) { const w = cyl(0.38, 0.38, 0.28, vd, x, 0.38, z, van, 18); w.rotation.z = Math.PI / 2; }
    van.position.set(PAD.x, 0, 160.2); out.add(van);
    // ---------- capsule cabin (moves with the launch) ----------
    const cab = new THREE.Group(); cab.visible = false; scene.add(cab);
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.9, 2.4, 24, 1, true), std(0xd9dce2, { roughness: 0.7, side: THREE.BackSide })); shell.position.y = 1.2; cab.add(shell);
    const panel = new THREE.Group(); box(1.8, 0.8, 0.1, std(0x2a2d33), 0, 0, 0, panel); panel.position.set(0, 1.9, -0.95); panel.rotation.x = 0.5; cab.add(panel);
    const scr = makeScreen(0.9, 0.5, infoScreen('FLIGHT', ['—'], { w: 512, hgt: 290 }), [512, 290]); scr.position.set(0, 0.05, 0.06); panel.add(scr);
    const cabLight = new THREE.PointLight(0xfff0e0, 4, 5, 1.4); cabLight.position.set(0, 2.2, 0.4); cab.add(cabLight);
    const buckles = [[-0.25, 1.25, 0.15], [0.25, 1.25, 0.15], [-0.2, 0.75, 0.25], [0.2, 0.75, 0.25], [0, 0.95, 0.3]].map((p, i) => { const b = new THREE.Group(); box(0.07, 0.07, 0.03, MAT.metal(0xc0c4cc), 0, 0, 0, b); b.add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), new THREE.MeshBasicMaterial({ visible: false }))); b.position.set(...p); cab.add(b);
      makeUsable(b, { label: `Harness buckle ${i + 1}`, verb: 'Fasten', range: 1.6, enabled: () => state.stage === 'cabin' && state.buckles === i, use: () => { state.buckles++; sfx.place(); hud.cap('[Click]', 600); b.children[0].material = MAT.glow(0x3fe0a0, 0.8); if (state.buckles === 5) { hud.flash('Harness secure. Press the comm button for a radio check.', 'good'); } } }); ix.add(b); return b; });
    const comm = new THREE.Group(); cyl(0.05, 0.05, 0.03, std(0x2b6ad8), 0, 0, 0, comm, 14).rotation.x = Math.PI / 2; comm.position.set(0.7, 0.3, 0.07); panel.add(comm);
    const btns = {}; EVENTS.filter(e => e[3]).forEach(([, id, , label], i) => { const b = new THREE.Group(); box(0.16, 0.08, 0.04, std(0xc8202a), 0, 0, 0, b); const l = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.05), new THREE.MeshBasicMaterial({ map: TEX.sign(label, '', '#3a1d1d'), transparent: true })); l.position.set(0, -0.07, 0.02); b.add(l); b.position.set(-0.6 + i * 0.3, -0.28, 0.07); panel.add(b); btns[id] = b;
      makeUsable(b, { label, verb: 'Press', range: 1.8, enabled: () => state.stage === 'ascent', use: () => press(id) }); ix.add(b); });
    let sky = null;
    // ---------- stage changes ----------
    async function toVan() {
      await ctx.fade(true, 500); state.stage = 'van'; out.visible = true; scene.background = new THREE.Color(0x9cc8f0); scene.fog = new THREE.Fog(0xbcd7ef, 80, 500);
      const sun = new THREE.DirectionalLight(0xfff2e0, 2.2); sun.position.set(PAD.x + 50, 80, 40); sun.target.position.copy(PAD); scene.add(sun, sun.target);
      player.seat = { pos: new THREE.Vector3(PAD.x + 0.5, 1.82, 159), yaw: 0, yawRange: 2.0, pitchMin: -0.8, pitchMax: 0.9, roll: 0 }; player.yaw = 0; player.pitch = 0.1;
      await ctx.fade(false, 600); hud.cap('[The van hums down the road towards the pad]', 4000); vanT = 0;
    }
    let vanT = -1, t = 0, cd = null, poll = false, ascT = -1, evI = 0, evT = 0, orbitStarted = false;
    async function toCabin() {
      await ctx.fade(true, 600); state.stage = 'cabin'; van.visible = false; ctx.done('drive');
      cab.visible = true; cab.position.set(PAD.x, 44, PAD.z); rocket.visible = true;
      player.seat = { pos: new THREE.Vector3(PAD.x, 44 + 1.15, PAD.z + 0.45), yaw: 0, yawRange: 2.0, pitchMin: -1.1, pitchMax: 1.1, roll: 0 }; player.yaw = 0; player.pitch = -0.2;
      await ctx.fade(false, 700);
      hud.flash('You ride the elevator up the tower and climb into the capsule. Fasten the five harness buckles.', '', 5000); drawScr();
    }
    makeUsable(comm, { label: 'Comm button', verb: 'Press', range: 1.8, enabled: () => state.stage === 'cabin' && state.buckles === 5 && !ctx.isDone('harness'), use: async () => {
      await ctx.talk([{ who: ctx.name, text: 'Launch Control, crew. Comm check.' }, { who: 'Launch Control', text: 'Loud and clear, {name}. Harness confirmed. Starting the terminal count.', do: () => ctx.done('harness') }]);
      cd = 60; drawScr();
    } }); ix.add(comm);
    function drawScr() {
      const lines = state.stage === 'cabin' ? (cd == null ? ['Pre-launch', `Harness: ${state.buckles}/5`, ['Waiting for comm check', '#ffc857']] : [[`T−${Math.ceil(cd)} s`, '#ffc857'], cd > 30 ? 'Terminal count' : cd > 10 ? 'Go for launch' : 'Ignition sequence', 'Fuel: 100%']) :
        state.stage === 'ascent' ? [[`T+${Math.floor(ascT)} s`, '#3fe0a0'], `Altitude ${Math.round(alt())} km`, `Speed ${Math.round(spd())} km/h`, `G-force ${gf().toFixed(1)} g`, evI < EVENTS.length ? [`Next: ${EVENTS[evI][2]}`, '#ffc857'] : ['Orbit insertion', '#3fe0a0']] : ['Orbit', 'Simplified simulation'];
      scr.userData.screen.redraw(infoScreen('FLIGHT', lines, { w: 512, hgt: 290 }));
    }
    const alt = () => Math.min(400, 0.16 * ascT * ascT), spd = () => Math.min(27600, ascT * ascT * 11), gf = () => ascT < 0 ? 1 : ascT < 24 ? 1.2 + ascT * 0.08 : ascT < 46 ? 1 + (ascT - 24) * 0.12 : 0;
    async function goPoll() {
      poll = true; ctx.input.releaseLock();
      const hold = ctx.diff.randomEvents || Math.random() < 0.35;
      await ctx.talk([{ who: 'Launch Director', text: hold ? 'Hold, hold, hold. Range reports a boat inside the safety zone.' : 'Launch Director here. Time for the final poll. Crew, are you GO for launch?' },
        { who: ctx.name, text: '(Your answer:)', choices: hold ? [{ text: 'Crew copies the hold. Standing by.', goto: 'ok' }, { text: 'We\'re GO anyway, launch!', goto: 'bad' }] : [{ text: 'Crew is GO for launch.', goto: 'ok' }, { text: 'Um... maybe?', goto: 'meh' }] },
        { id: 'bad', who: 'Launch Director', text: 'Negative. Nobody launches during a hold. Safety first.', do: () => ctx.mistake('Pushed to launch during a safety hold.'), goto: 'ok' },
        { id: 'meh', who: 'Launch Director', text: 'I need a clear GO or NO-GO, crew. ...Copy, crew is GO.', do: () => ctx.mistake('Gave an unclear answer in the GO/NO-GO poll.'), goto: 'ok' },
        { id: 'ok', who: 'Launch Director', text: hold ? 'Boat has cleared the zone. Resuming the count. Crew is GO. Good luck and Godspeed.' : 'Copy. All stations GO. Good luck and Godspeed.' }]);
      ctx.done('countdown');
    }
    function press(id) {
      const ev = EVENTS[evI];
      if (!ev || ev[1] !== id || ascT < ev[0]) { sfx.wrong(); hud.flash('Not yet! Wait for the callout.', 'bad'); ctx.mistake(`Pressed ${id.toUpperCase()} at the wrong time.`); return; }
      sfx.good(); hud.cap(`[${ev[2]} confirmed]`, 1500); if (evT > 6) ctx.mistake(`Confirmed "${ev[2]}" late (${evT.toFixed(0)} s).`);
      if (id === 'stage') rocket.visible = false; evI++; evT = 0; drawScr();
    }
    function orbitBurn() {
      state.stage = 'orbit'; orbitStarted = true; ctx.done('ascent'); ctx.input.releaseLock();
      const cv = h('canvas', { width: 420, height: 300, class: 'cx-orbit-cv' }); const info = h('p', {}); let th = 0, ap = 410, pe = 160, fuel = 100, burning = false, done = false;
      const tolK = ctx.diff.tolerance, lo = 400 - 25 * tolK, hi = 400 + 35 * tolK;
      const btn = h('button', { class: 'btn primary', onpointerdown: () => { burning = true; }, onpointerup: () => { burning = false; }, onpointerleave: () => { burning = false; } }, '🔥 Hold to burn');
      const m = openModal({ title: '🛰 Circularise your orbit (simplified)', label: 'Orbit burn', wide: true, closable: false, body: h('div', {}, h('p', {}, 'You\'re in an oval orbit: 410 km at the top, only 160 km at the bottom, which would drag you back into the air. Fire the engine at the highest point (apogee) to lift the lowest point (perigee) up to about 400 km.'), cv, info, h('p', { class: 'muted tiny' }, 'Simplified: real burns are planned by computers and Mission Control.')), foot: [btn] });
      const x = cv.getContext('2d'); let last = performance.now();
      const loop = now => {
        if (done) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; th = (th + dt * 0.7) % (Math.PI * 2);
        const atApo = Math.abs(th - Math.PI) < 0.35;
        if (burning && fuel > 0) { fuel = Math.max(0, fuel - dt * 12); if (atApo) pe += dt * 70; else { ap += dt * 40; pe += dt * 15; if (!this_w) { this_w = true; ctx.mistake('Burned away from apogee, wasting fuel.'); } } }
        const a = (ap + pe) / 2 + 6371, e = (ap - pe) / (ap + pe + 2 * 6371), sc = 100 / a * 1.05;
        x.fillStyle = '#05070f'; x.fillRect(0, 0, 420, 300); x.save(); x.translate(210, 150);
        x.fillStyle = '#2a5ad8'; x.beginPath(); x.arc(0, 0, 6371 * sc, 0, 7); x.fill();
        x.strokeStyle = '#5ad8ff'; x.lineWidth = 2; x.beginPath(); for (let k = 0; k <= 64; k++) { const f = k / 64 * Math.PI * 2, r = a * (1 - e * e) / (1 + e * Math.cos(f)); x.lineTo(r * Math.cos(f) * sc * 1.6, r * Math.sin(f) * sc); } x.stroke();
        const r = a * (1 - e * e) / (1 + e * Math.cos(th)); x.fillStyle = burning ? '#ff9a3a' : '#fff'; x.beginPath(); x.arc(r * Math.cos(th) * sc * 1.6, r * Math.sin(th) * sc, 5, 0, 7); x.fill();
        x.fillStyle = '#ffc857'; x.font = '12px system-ui'; x.fillText('apogee', -a * (1 + e) * sc * 1.6 - 18, -8); x.restore();
        info.innerHTML = `Apogee <b>${ap.toFixed(0)} km</b> · Perigee <b>${pe.toFixed(0)} km</b> · Fuel <b>${fuel.toFixed(0)}%</b> · ${atApo ? '<span style="color:#3fe0a0">AT APOGEE: burn now</span>' : 'coast…'}`;
        const ok = pe >= lo && ap <= hi + 10, fail = fuel <= 0 && !ok;
        if (ok || fail) { done = true; m.close(); if (fail) ctx.mistake(pe > 250 ? 'Orbit stable but not circular.' : 'Ran out of fuel with a low perigee (Mission Control helped you out).'); ctx.done('orbit'); orbitOps(pe, ap); return; }
        requestAnimationFrame(loop);
      };
      let this_w = false; requestAnimationFrame(loop);
    }
    // Orbit operations (simplified): watch six systems, answer the alerts with the right fix, then null out a slow roll with the thrusters.
    let opsT = null;
    const SYS = {
      power: ['⚡ Power', 'Battery charge dropping: the solar arrays are not tracking the Sun.', 'Re-point the solar arrays'],
      o2: ['🫁 Oxygen', 'Cabin O₂ partial pressure is low.', 'Open the O₂ supply valve'],
      press: ['🎈 Pressure', 'Cabin pressure falling slowly: a vent valve is stuck open.', 'Close the cabin vent valve'],
      temp: ['🌡 Temperature', 'Cabin temperature rising: primary coolant loop flow is low.', 'Switch to the backup coolant loop'],
      comms: ['📡 Comms', 'Lost signal: the ground station is below the horizon.', 'Switch to the relay satellite'],
      nav: ['🧭 Navigation', 'Navigation drift: the star tracker has lost lock.', 'Re-align the star tracker']
    };
    function orbitOps(pe, ap) {
      state.stage = 'orbit';
      const keys = Object.keys(SYS), n = { single: 2, linked: 3, chained: 4 }[ctx.diff.faults] || 3;
      const order = keys.slice().sort(() => Math.random() - 0.5).slice(0, n);
      const level = Object.fromEntries(keys.map(k => [k, 100]));
      const T = opsT = { phase: 'watch', alert: null, order, rate: 0, fuel: 100, steady: 0, answered: 0 };
      const gauges = h('div', { class: 'cx-ops-grid' }), alertBox = h('div', { class: 'cx-ops-alert', role: 'alert', 'aria-live': 'assertive' }), acts = h('div', { class: 'cx-ops-acts' });
      const cv = h('canvas', { width: 220, height: 160, class: 'cx-ops-cv', 'aria-hidden': 'true' }), rollInfo = h('p', { 'aria-live': 'polite' });
      const rollBox = h('div', { class: 'cx-ops-roll', hidden: true }, h('p', {}, 'Last job: the separation left the spacecraft slowly rolling. Fire short thruster pulses against the roll until the rate is almost zero, and hold it steady for 3 seconds. Use the buttons or Q / E (← / →).'), cv, rollInfo);
      let thrust = 0; const tb = (dir, label) => h('button', { class: 'btn', onpointerdown: e => { e.preventDefault(); thrust = dir; }, onpointerup: () => { thrust = 0; }, onpointerleave: () => { thrust = 0; }, onkeydown: e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); thrust = dir; } }, onkeyup: () => { thrust = 0; } }, label);
      const rollBtns = h('div', { class: 'cx-ops-acts', hidden: true }, tb(-1, '⟲ Roll left'), tb(1, 'Roll right ⟳'));
      const kd = e => { if (T.phase !== 'roll') return; if (e.code === 'KeyQ' || e.code === 'ArrowLeft') thrust = -1; if (e.code === 'KeyE' || e.code === 'ArrowRight') thrust = 1; };
      const ku = e => { if (['KeyQ', 'KeyE', 'ArrowLeft', 'ArrowRight'].includes(e.code)) thrust = 0; };
      addEventListener('keydown', kd); addEventListener('keyup', ku);
      const m = openModal({ title: '🛰 Orbit operations (simplified)', label: 'Orbit operations', wide: true, closable: false,
        body: h('div', {}, h('p', {}, `Orbit reached: ${Math.round(ap)} × ${Math.round(pe)} km. Keep an eye on the spacecraft systems. When an alert appears, read it and choose the right fix.`), gauges, alertBox, acts, rollBox, rollBtns, h('p', { class: 'muted tiny' }, 'Simplified: on a real flight, Mission Control and onboard computers handle much of this with the crew.')) });
      const drawG = () => { gauges.replaceChildren(...keys.map(k => { const v = level[k], col = v > 70 ? '#3fe0a0' : v > 40 ? '#ffc857' : '#ff5a5a'; return h('div', { class: 'cx-ops-g' + (T.alert === k ? ' on' : '') }, h('b', {}, SYS[k][0]), h('div', { class: 'cx-bar' }, h('i', { style: `width:${v}%;background:${col}` })), h('span', { class: 'tiny' }, v > 70 ? 'Nominal' : v > 40 ? 'Caution' : 'WARNING')); })); };
      let wait = 3 + Math.random() * 2, at = 0, last = performance.now(), done = false;
      function raise() {
        const k = T.order[T.answered]; T.alert = k; at = 0; sfx.alarm(); hud.cap(`[Master alarm: ${SYS[k][0].slice(2).trim()}]`, 2000);
        alertBox.textContent = `⚠ ${SYS[k][1]}`;
        const opts = [k, ...keys.filter(x => x !== k).sort(() => Math.random() - 0.5).slice(0, ctx.diff.quizOptions ? Math.max(1, ctx.diff.quizOptions - 1) : 3)].sort(() => Math.random() - 0.5);
        acts.replaceChildren(...opts.map(o => h('button', { class: 'btn', onclick: () => answer(o) }, SYS[o][2])));
        acts.querySelector('button')?.focus({ preventScroll: true }); drawG();
      }
      function answer(o) {
        const k = T.alert; if (!k) return;
        if (o !== k) { sfx.wrong(); hud.flash('That doesn\'t fix this alert. Read it again.', 'bad'); ctx.mistake(`Orbit ops: chose "${SYS[o][2]}" for a ${SYS[k][0].slice(2).trim()} alert.`); return; }
        sfx.good(); if (at > 20 * ctx.diff.tolerance) ctx.mistake(`Orbit ops: slow to answer the ${SYS[k][0].slice(2).trim()} alert (${at.toFixed(0)} s).`);
        level[k] = 100; T.alert = null; T.answered++; alertBox.textContent = '✓ Fixed. Systems nominal.'; acts.replaceChildren(); wait = 3 + Math.random() * 3; drawG();
        if (T.answered >= T.order.length) { T.phase = 'roll'; T.rate = (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 3); rollBox.hidden = false; rollBtns.hidden = false; alertBox.textContent = ''; rollBtns.querySelector('button')?.focus({ preventScroll: true }); }
      }
      let ang = 0, warned = false;
      const loop = now => {
        if (done) return; const dt = Math.min(0.05, (now - last) / 1000); last = now;
        if (T.phase === 'watch') {
          if (T.alert) { at += dt; level[T.alert] = Math.max(15, level[T.alert] - dt * 4); if (Math.floor(at * 2) !== Math.floor((at - dt) * 2)) drawG(); }
          else if ((wait -= dt) <= 0) raise();
        } else {
          if (thrust && T.fuel > 0) { T.rate += thrust * dt * 4; T.fuel = Math.max(0, T.fuel - dt * 9); }
          if (T.fuel <= 0 && !warned) { warned = true; ctx.mistake('Orbit ops: used all the thruster fuel (Mission Control finished the manoeuvre).'); T.rate = 0; }
          ang += T.rate * dt; const lim = 0.5 * ctx.diff.tolerance;
          T.steady = Math.abs(T.rate) < lim ? T.steady + dt : 0;
          const x = cv.getContext('2d'); x.fillStyle = '#05070f'; x.fillRect(0, 0, 220, 160); x.save(); x.translate(110, 80); x.rotate(ang * Math.PI / 180);
          x.fillStyle = '#c9d4e8'; x.fillRect(-14, -24, 28, 48); x.fillStyle = '#2a5ad8'; x.fillRect(-70, -8, 50, 16); x.fillRect(20, -8, 50, 16); x.restore();
          x.strokeStyle = '#ffc857'; x.beginPath(); x.moveTo(110, 4); x.lineTo(110, 18); x.stroke();
          rollInfo.innerHTML = `Roll rate <b style="color:${Math.abs(T.rate) < lim ? '#3fe0a0' : '#ffc857'}">${T.rate.toFixed(1)} °/s</b> (target under ${lim.toFixed(1)}) · Thruster fuel <b>${T.fuel.toFixed(0)}%</b> · Steady <b>${Math.min(3, T.steady).toFixed(1)} / 3 s</b>`;
          if (T.steady >= 3) { done = true; T.phase = 'done'; removeEventListener('keydown', kd); removeEventListener('keyup', ku); m.close(); sfx.good(); ctx.done('ops'); finish(pe, ap); return; }
        }
        requestAnimationFrame(loop);
      };
      drawG(); requestAnimationFrame(loop);
    }
    // restore: anything after the room restarts from the van
    if (['van', 'cabin', 'ascent', 'orbit'].includes(state.stage)) { state.stage = 'room'; state.buckles = 0; for (const k of ['drive', 'harness', 'countdown', 'ascent', 'orbit', 'ops']) { delete state.steps[k]; const s = ctx.steps.find(x => x.id === k); if (s) s.done = false; } }
    const shake = new THREE.Vector3();
    return {
      spawn: [0, 2.2, Math.PI, 0],
      markerFor: id => ({ brief: okafor.rig.root, medical: hart.rig.root, weather: wx, suit: suitHit, drive: door, harness: state.buckles < 5 ? buckles[state.buckles] : comm, ascent: btns[EVENTS[evI]?.[1]] || null }[id] || null),
      onEnter: () => { if (!ctx.isDone('brief')) hud.flash('Talk to Instructor Okafor.', '', 3500); },
      update(dt, blocked) {
        okafor.update(dt); hart.update(dt); t += dt;
        if (state.stage === 'van' && vanT >= 0 && !blocked) { vanT += dt; const z = 159 - vanT * 12; player.seat.pos.z = z; van.position.z = z + 1.2; /* the van drives with you (you sit in the front passenger seat) */ if (vanT > 9) { vanT = -1; toCabin(); } }
        if (state.stage === 'cabin' && cd != null && !blocked) {
          if (cd > 30 && cd - dt <= 30 && !poll) goPoll();
          if (!(poll && !ctx.isDone('countdown'))) cd -= dt;
          if (Math.floor(cd) !== Math.floor(cd + dt)) { drawScr(); if (cd < 10.5 && cd > 0) hud.cap(`[Launch Control: ${Math.ceil(cd)}]`, 900); }
          if (cd <= 0) { state.stage = 'ascent'; ascT = 0; sfx.alarm(); hud.flash('LIFTOFF!', 'good', 3000); hud.cap('[Rumbling roar of the engines]', 4000); sky = spaceBackdrop(scene, { earthPos: [PAD.x, -480, PAD.z], earthR: 300, center: [PAD.x, 44, PAD.z], sun: [PAD.x + 200, 160, PAD.z + 100] }); }
        }
        if (state.stage === 'ascent' && !blocked) {
          ascT += dt; evT += dt;
          const h = Math.min(1, alt() / 100); scene.background.setRGB(0.61 * (1 - h), 0.78 * (1 - h), 0.94 * (1 - h)); if (alt() > 60) scene.fog = null; else if (scene.fog) scene.fog.far = 500 + alt() * 50;
          out.position.y = -alt() * 30; out.visible = alt() < 3; if (sky) sky.earth.position.y = 44 - 300 - Math.max(6, 220 - alt() * 0.55); if (sky) sky.atm.position.copy(sky.earth.position); player.seat.pos.y = 44 + 1.15;
          const amp = settings.reducedMotion ? 0 : (ascT < 46 ? 0.012 * gf() : 0); shake.set((Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp, 0); player.seat.pos.add(shake);
          const ev = EVENTS[evI]; if (ev && ascT >= ev[0]) { if (evT > ascT - ev[0] + 0.1) evT = ascT - ev[0]; if (!ev[3]) { hud.cap(`[${ev[2]}: automatic]`, 1500); evI++; evT = 0; } else if (Math.abs(ascT - ev[0]) < dt * 1.5) { sfx.alarm(); hud.flash(`${ev[2]}! Press ${ev[3]}.`, '', 3500); } }
          if (Math.floor(ascT * 2) !== Math.floor((ascT - dt) * 2)) drawScr();
          hud.setReadout('Ascent', [['T+', `${Math.floor(ascT)} s`, ''], ['Altitude', `${Math.round(alt())} km`, ''], ['Speed', `${Math.round(spd())} km/h`, ''], ['G-force', `${gf().toFixed(1)} g`, gf() > 3 ? 'warn' : '']]);
          if (evI >= EVENTS.length && ascT > 52 && !orbitStarted) { hud.setReadout(null); orbitBurn(); }
        }
        sky?.update(dt);
      },
      test: { press, setCd: v => { cd = v; }, orbit: () => ({ stage: state.stage, ascT, evI, cd }), ops: () => opsT, startOps: () => orbitOps(380, 410) }
    };
    function finish(pe, ap) {
      const c = career(); c.chapter = 'graduated'; save();
      finishExercise(ctx, { id: 'launch', title: 'Launch Day', xp: 400, badge: ['launch-candidate', 'junior-astronaut'],
        continueLabel: ctx.mode === 'story' ? '🪐 Fly to the solar system ▸' : 'Main menu', next: ctx.mode === 'story' ? 'You are a Junior Astronaut! Your next missions are out among the planets.' : 'Return to the main menu.',
        onContinue: rt => { rt.exit(); if (ctx.mode === 'story') setTimeout(() => window.__astrolab?.menuAction?.('start'), 300); },
        science: `Final orbit: ${Math.round(ap)} × ${Math.round(pe)} km. Rockets launch towards the east to borrow Earth's spin, and climb out of the thick lower air before turning sideways to build speed: about 28,000 km/h is needed to stay in low Earth orbit. Max Q is the moment of greatest air pressure on the rocket, so engines throttle down to protect it. This launch was simplified.` });
    }
  }
};
