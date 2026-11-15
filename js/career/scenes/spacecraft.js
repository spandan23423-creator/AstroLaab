// ASTRO LAB Career — Phase 7a: Spacecraft Systems. Seated in a capsule cockpit simulator: power up with the checklist,
// then handle fault drills (power, oxygen, pressure, temperature, comms): silence the master alarm, read the caution panel,
// and throw the right switch before the clock runs out.
import * as THREE from '../../../vendor/three.module.js';
import { MAT, TEX } from '../models/materials.js';
import { std, box, cyl } from '../models/house.js';
import { makeScreen, infoScreen } from '../models/centre.js';
import { makeUsable } from '../engine/interact.js';
import { timer, finishExercise } from './kit.js';
import { spaceBackdrop } from './space.js';

const POWERUP = [['bus', 'MAIN BUS A'], ['avionics', 'AVIONICS'], ['life', 'LIFE SUPPORT'], ['comms', 'COMMS'], ['displays', 'DISPLAYS']];
const FIX = [['busB', 'BUS B TIE'], ['o2b', 'O2 TANK 2'], ['repress', 'CABIN REPRESS'], ['pump2', 'COOLANT PUMP 2'], ['hga', 'HIGH-GAIN ANT']];
const DRILLS = {
  power: { name: 'MAIN BUS A UNDERVOLT', sys: 'Power', fix: 'busB', why: 'Bus A voltage dropped to 22 V. Tie in bus B so every system keeps power.' },
  o2: { name: 'O2 TANK 1 PRESSURE LOW', sys: 'Oxygen', fix: 'o2b', why: 'Tank 1 is leaking down. Switch the supply to O2 tank 2.' },
  press: { name: 'CABIN PRESSURE LOW', sys: 'Pressure', fix: 'repress', why: 'Cabin pressure 13.1 psi and falling slowly. Open the repress valve to add air while you look for the leak.' },
  temp: { name: 'COOLANT LOOP 1 TEMP HIGH', sys: 'Temperature', fix: 'pump2', why: 'Coolant pump 1 failed and avionics are heating up. Start coolant pump 2.' },
  comms: { name: 'S-BAND SIGNAL LOST', sys: 'Comms', fix: 'hga', why: 'The low-gain antenna lost lock. Switch to the high-gain antenna.' }
};

export default {
  id: 'spacecraft', title: 'Spacecraft Systems', music: 'centre', ambience: 'vent',
  steps: [
    { id: 'brief', text: 'Listen to the simulator supervisor' },
    { id: 'power', text: 'Power up: follow the checklist on the centre screen (5 switches, in order)' },
    { id: 'drills', text: 'Fault drills: silence the alarm, read the caution panel, fix the fault' },
    { id: 'report', text: 'Report "systems nominal" with the push-to-talk button' }
  ],
  initialState: { steps: {}, mistakes: [], on: {}, drills: null, di: 0 },

  async build(ctx) {
    const { scene, world, player, ix, hud, sfx, state } = ctx;
    scene.background = new THREE.Color(0x000000);
    spaceBackdrop(scene, { earthPos: [0, -38, -60], earthR: 34 });
    scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x1a1d24, 0.9));
    const lamp = new THREE.PointLight(0xfff0e0, 6, 6, 1.4); lamp.position.set(0, 1.9, 0.3); scene.add(lamp);
    // cockpit shell (a cone-shaped cabin around the seat)
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 2.0, 2.6, 24, 1, true), std(0xd9dce2, { roughness: 0.7, side: THREE.BackSide })); cab.position.set(0, 1.4, -0.2); scene.add(cab);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.55), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.0 })); win.position.set(0, 2.0, -1.45); scene.add(win);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 8, 4), MAT.metal(0x3a3f4a)); frame.position.set(0, 2.0, -1.38); frame.rotation.z = Math.PI / 4; frame.scale.set(1.5, 0.7, 1); scene.add(frame);
    // instrument panel
    const panel = new THREE.Group(); box(2.2, 0.9, 0.12, std(0x2a2d33, { roughness: 0.5 }), 0, 0, 0, panel); panel.position.set(0, 1.25, -1.0); panel.rotation.x = -0.35; scene.add(panel);
    const seat = new THREE.Group(); box(0.6, 0.12, 0.6, std(0x3a3f4a), 0, 0.5, 0.4, seat); box(0.6, 0.9, 0.12, std(0x3a3f4a), 0, 0.95, 0.72, seat); scene.add(seat);
    const scr = (title, lines, x, y, w = 0.5, hh = 0.32) => { const s = makeScreen(w, hh, infoScreen(title, lines, { w: 384, hgt: 246 }), [384, 246]); s.position.set(x, y, 0.07); panel.add(s); return s; };
    const center = scr('CHECKLIST', ['Power-up'], 0, 0.15, 0.62, 0.38), caution = scr('CAUTION & WARNING', ['—'], -0.68, 0.18), sysScr = scr('SYSTEMS', ['—'], 0.68, 0.18);
    // switches: power-up row and fix row
    const switches = {};
    const mkSwitch = (id, name, x, y, col) => {
      const g = new THREE.Group(); box(0.13, 0.11, 0.03, std(0x1a1d24), 0, 0, 0, g); const lev = box(0.025, 0.07, 0.025, MAT.metal(0xd9dce2), 0, -0.02, 0.03, g); lev.rotation.x = 0.5;
      const led = box(0.025, 0.025, 0.01, MAT.glow(0x333333, 0.3), 0.045, 0.035, 0.018, g);
      const lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.04), new THREE.MeshBasicMaterial({ map: TEX.sign(name, '', col || '#1a1d24'), transparent: true })); lbl.position.set(0, -0.085, 0.017); g.add(lbl);
      g.position.set(x, y, 0.07); panel.add(g);
      const set = on => { lev.rotation.x = on ? -0.5 : 0.5; led.material.color.set(on ? 0x3fe0a0 : 0x333333); led.material.emissive.set(on ? 0x3fe0a0 : 0x333333); led.material.emissiveIntensity = on ? 1.4 : 0.3; };
      makeUsable(g, { label: name, verb: 'Flip', range: 1.8, enabled: () => ctx.isDone('brief') && !state.on[id], use: () => flip(id) }); ix.add(g);
      switches[id] = { g, set }; set(!!state.on[id]); return g;
    };
    POWERUP.forEach(([id, n], i) => mkSwitch(id, n, -0.84 + i * 0.42, -0.2));
    FIX.forEach(([id, n], i) => mkSwitch(id, n, -0.84 + i * 0.42, -0.36, '#3a1d1d'));
    const alarmBtn = new THREE.Group(); cyl(0.05, 0.05, 0.03, MAT.glow(0x551010, 0.4), 0, 0, 0, alarmBtn, 16).rotation.x = Math.PI / 2; alarmBtn.position.set(-1.0, 0.36, 0.08); panel.add(alarmBtn);
    const ptt = new THREE.Group(); cyl(0.04, 0.04, 0.03, std(0x2b6ad8), 0, 0, 0, ptt, 16).rotation.x = Math.PI / 2; ptt.position.set(1.0, 0.36, 0.08); panel.add(ptt);
    const alarmM = alarmBtn.children[0].material;
    // drills
    const pool = Object.keys(DRILLS).sort(() => Math.random() - 0.5);
    if (!state.drills) state.drills = pool.slice(0, ctx.diff.faults === 'single' ? 3 : ctx.diff.faults === 'linked' ? 4 : 5);
    let D = null, alarm = false, silenced = false, read = false, dT = 0;
    const limit = Math.round(45 * (ctx.diff.timeLimit || 2));
    const T = timer(ctx, 300);
    const powered = () => POWERUP.every(([id]) => state.on[id]);
    function drawScreens() {
      const nextP = POWERUP.find(([id]) => !state.on[id]);
      center.userData.screen.redraw(infoScreen('CHECKLIST', !powered() ? POWERUP.map(([id, n], i) => [`${state.on[id] ? '✓' : i === POWERUP.findIndex(([k]) => !state.on[k]) ? '▶' : ' '} ${i + 1}. ${n}`, state.on[id] ? '#3fe0a0' : '#c9d6ff']) : D ? [['FAULT DRILL ' + (state.di + 1) + '/' + state.drills.length, '#ffc857'], silenced ? '1. Alarm silenced ✓' : '1. Silence MASTER ALARM', read ? '2. Read caution panel ✓' : '2. Read the caution panel', '3. Throw the fix switch'] : [['All systems nominal', '#3fe0a0'], ctx.isDone('drills') ? 'Press PUSH-TO-TALK to report' : 'Stand by for drills…'], { w: 384, hgt: 246 }));
      caution.userData.screen.redraw(infoScreen('CAUTION & WARNING', D && alarm ? [[`⚠ ${DRILLS[D].name}`, '#ff6a6a'], read ? DRILLS[D].why.slice(0, 44) : 'Press to read details', read ? DRILLS[D].why.slice(44, 90) : ''] : [['No alarms', '#3fe0a0']], { w: 384, hgt: 246 }));
      const sysLine = (k, ok) => [`${k}: ${ok ? 'OK' : 'FAULT'}`, ok ? '#3fe0a0' : '#ff6a6a'];
      sysScr.userData.screen.redraw(infoScreen('SYSTEMS', powered() ? ['Power', 'Oxygen', 'Pressure', 'Temperature', 'Comms'].map(k => sysLine(k, !(D && alarm && DRILLS[D].sys === k))) : ['Systems offline'], { w: 384, hgt: 246 }));
    }
    function flip(id) {
      if (POWERUP.some(([k]) => k === id)) {
        const want = POWERUP.find(([k]) => !state.on[k])[0];
        if (id !== want) { sfx.wrong(); hud.flash(`Checklist order: ${POWERUP.find(([k]) => k === want)[1]} comes next.`, 'bad'); ctx.mistake(`Flipped ${POWERUP.find(([k]) => k === id)[1]} out of checklist order.`); return; }
        state.on[id] = true; switches[id].set(true); sfx.ui(); hud.cap('[Click]', 800);
        if (powered()) { ctx.done('power'); hud.flash('Spacecraft powered up. Fault drills start in a few seconds…', 'good'); setTimeout(nextDrill, 4000); }
      } else {
        if (!D || !alarm) { sfx.wrong(); hud.flash('No fault to fix right now.', 'bad'); ctx.mistake('Threw a fix switch with no fault showing.'); return; }
        if (!read) { sfx.wrong(); hud.flash('Read the caution panel before you act.', 'bad'); ctx.mistake('Acted before reading the caution panel.'); return; }
        if (id !== DRILLS[D].fix) { sfx.wrong(); hud.flash('That switch doesn\'t fix this fault. Read the panel again.', 'bad'); ctx.mistake(`Wrong switch for ${DRILLS[D].name.toLowerCase()}.`); return; }
        switches[id].set(true); sfx.good(); hud.flash(`Fixed in ${dT.toFixed(0)} s.`, 'good'); if (dT > limit) ctx.mistake(`Took ${dT.toFixed(0)} s to fix ${DRILLS[D].name.toLowerCase()} (aim for under ${limit} s).`);
        alarm = false; D = null; state.di++; read = false; silenced = false;
        if (state.di >= state.drills.length) { ctx.done('drills'); hud.flash('All drills complete! Report to Mission Control with push-to-talk.', 'good', 4000); }
        else setTimeout(nextDrill, 3500);
      }
      drawScreens();
    }
    function nextDrill() { if (state.di >= state.drills.length || D) return; D = state.drills[state.di]; alarm = true; silenced = false; read = false; dT = 0; FIX.forEach(([id]) => switches[id].set(false)); hud.flash('⚠ MASTER ALARM', 'bad', 2500); drawScreens(); }
    makeUsable(alarmBtn, { label: 'MASTER ALARM', verb: 'Silence', range: 1.8, enabled: () => alarm && !silenced, use: () => { silenced = true; sfx.ui(); drawScreens(); } }); ix.add(alarmBtn);
    makeUsable(caution.parent ? caution : caution, { label: 'Caution & warning panel', verb: 'Read', range: 1.8, enabled: () => alarm && !read, use: () => { if (!silenced) { hud.flash('Silence the master alarm first, so you can think.', ''); } read = true; sfx.ui(); hud.flash(DRILLS[D].why, '', 6000); drawScreens(); } }); ix.add(caution);
    makeUsable(ptt, { label: 'PUSH-TO-TALK', verb: 'Press', range: 1.8, enabled: () => ctx.isDone('drills') && !ctx.isDone('report'), use: async () => { await ctx.talk([{ who: ctx.name, text: 'Houston, all faults cleared. Systems nominal.' }, { who: 'Mission Control', text: 'Copy, systems nominal. Nice work, {name}. That\'s how a crew stays calm.', do: () => ctx.done('report') }]); finish(); } }); ix.add(ptt);
    // the seat camera
    player.seat = { pos: new THREE.Vector3(0, 1.62, 0.35), yaw: 0, yawRange: 2.0, pitchMin: -1.1, pitchMax: 1.0, roll: 0 };
    player.pitch = -0.35;
    if (state.di >= state.drills.length && powered()) ctx.done('drills');
    if (powered() && !ctx.isDone('drills')) setTimeout(nextDrill, 3000);
    drawScreens();
    const brief = () => ctx.talk([
      { who: 'Sim Supervisor Okafor', text: 'Strapped in, {name}? This is a full copy of a capsule cockpit. Every switch does something.' },
      { who: 'Sim Supervisor Okafor', text: 'First, power it up in checklist order. Look at a switch and press E (or tap it) to flip it. The centre screen shows the checklist.' },
      { who: 'Sim Supervisor Okafor', text: 'Then I\'ll throw faults at you. When the master alarm goes off: silence it, read the caution panel, then throw the right switch on the red row. Don\'t guess.', do: () => { if (ctx.done('brief')) T.start(); } }]);
    return {
      spawn: [0, 0.35, 0, -0.35],
      markerFor: id => ({ power: switches[POWERUP.find(([k]) => !state.on[k])?.[0]]?.g, drills: alarm ? (!silenced ? alarmBtn : !read ? caution : null) : null, report: ptt }[id] || null),
      onEnter: () => { if (!ctx.isDone('brief')) brief(); else T.start(); },
      update(dt, blocked) {
        T.update(dt, blocked);
        if (alarm && !blocked) { dT += dt; const on = silenced ? 0.5 : (Math.sin(performance.now() / 120) > 0 ? 2 : 0.2); alarmM.color.set(0xff2020); alarmM.emissive.set(0xff2020); alarmM.emissiveIntensity = on; if (!silenced && (dT % 1.2) < dt) { sfx.alarm(); hud.cap('[Master alarm tone]', 900); } }
        else { alarmM.emissiveIntensity = 0.3; }
        if (alarm && !blocked) hud.setReadout('Fault drill', [['Time', `${dT.toFixed(0)} s / ${limit} s`, dT > limit ? 'bad' : dT > limit * 0.7 ? 'warn' : 'good'], ['Drill', `${state.di + 1} of ${state.drills.length}`, '']]);
        else if (!blocked) hud.setReadout(null);
      }
    };
    function finish() {
      finishExercise(ctx, { id: 'spacecraft', title: 'Spacecraft Systems', timer: T, xp: 200,
        science: 'Real spacecraft have a caution and warning system that sounds a master alarm and shows which system has a problem. Crews train to silence the alarm, read the message, and follow the procedure instead of guessing. Most critical systems have a backup: a second power bus, a second oxygen tank, a second coolant pump, a second antenna. This is a simplified simulator.' });
    }
  }
};
