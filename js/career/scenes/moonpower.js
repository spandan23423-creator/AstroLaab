// ASTRO LAB Career — Mission task 4: Lunar Outpost Power (first vertical slice, blueprint section 17).
// At the lunar south pole the Sun skims the horizon. Unfold and aim four solar panels at it, wire them to the same charge
// controller, battery and load bus you trained on, set the habitat up for a 4-hour crater-rim shadow, and keep the crew's
// life support running. Same models, sockets, wiring rules, power panel and simulation as the Power Lab.
import * as THREE from '../../../vendor/three.module.js';
import { std, box, cyl } from '../models/house.js';
import { MAT } from '../models/materials.js';
import { makeSign } from '../models/props.js';
import { makeTerminal, infoScreen } from '../models/centre.js';
import { makeSolarPanel, setPanelDeploy, makeController, makeBatteryRack, makeBusBoard, setBreakers, setBatteryLeds } from '../models/power.js';
import { rockTex, rockGeometry, makeLM } from '../../surface/models.js';
import { spaceBackdrop } from './space.js';
import { makeUsable } from '../engine/interact.js';
import { timer, finishExercise } from './kit.js';
import { cablePlugs, shadowTest, powerRefresher } from './powerkit.js';
import { openPowerPanel, powerReadout } from '../ui/powerPanel.js';
import { hasCert } from '../state/careerSave.js';
import { Outpost, LOAD_TYPES } from '../../sim/outpost.js';
import { Wiring } from '../../sim/wiring.js';

const LOADS = ['scrubber', 'o2gen', 'heaters', 'recycler', 'comms', 'lights', 'greenhouse', 'science', 'rover'];
const SUN = new THREE.Vector3(140, 9, 45);                     // a low polar Sun, about 3.5° above the horizon
const SUN_AZ = Math.atan2(SUN.x, SUN.z);
const PANELS = [[9, -7], [11.5, -7], [9, -3.6], [11.5, -3.6]];
const CAPCOM = 'Mensah (Systems CAPCOM)';
const wrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

export default {
  id: 'moonpower', title: 'Mission: Lunar Outpost Power', music: 'space', ambience: 'suit',
  steps: [
    { id: 'brief', text: 'Listen to Mission Control' },
    { id: 'deploy', text: 'Unfold the four solar panels in the solar field' },
    { id: 'aim', text: 'Turn every panel to face the low Sun (each turn = 30°)' },
    { id: 'wire', text: 'Wire the field: panels → controller PV IN, BATT → battery, LOAD → habitat bus' },
    { id: 'shadow', text: 'Crater-rim shadow coming: set up the power panel and keep life support running for 4 hours' },
    { id: 'report', text: 'Report to Mission Control on the radio' }
  ],
  initialState: { steps: {}, mistakes: [], cables: [], deployed: [false, false, false, false], yaw: [0, 0, 0, 0], settings: null, tries: 0 },

  async build(ctx) {
    const { scene, hud, sfx, state, ix, player } = ctx;
    // --- the Moon: black sky, Earth low over the horizon, a hard low Sun, grey regolith
    scene.background = new THREE.Color(0x000000);
    const sky = spaceBackdrop(scene, { earthPos: [-70, 14, -150], earthR: 9, sun: SUN.toArray(), stars: 1500 });
    sky.sun.intensity = 3.2;
    const amb = new THREE.HemisphereLight(0xb0b6c0, 0x3a3a40, 0.5); scene.add(amb);
    const sun = sky.sun; sun.castShadow = true; Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 260 }); sun.shadow.mapSize.set(2048, 2048);
    const rt = rockTex(); rt.repeat?.set(60, 60);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), std(0xa8a8a8, { map: rt, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 70; i++) { const r = new THREE.Mesh(rockGeometry(0.2 + rnd() * 0.6), std(0x77767a, { roughness: 1 })); const a = rnd() * 6.28, d = 14 + rnd() * 60; r.position.set(Math.cos(a) * d, 0.05, Math.sin(a) * d); r.castShadow = r.receiveShadow = true; scene.add(r); }
    // the crater rim that will cut off the Sun (far away, in the Sun's direction)
    const rim = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), std(0x6e6d70, { roughness: 1 })); rim.scale.set(1.6, 0.16, 0.8); rim.position.copy(SUN).setLength(230).setY(-2); scene.add(rim);
    // --- the outpost: habitat module on legs, lander, power pallet, solar field
    const hab = new THREE.Group(); const shell = std(0xe8e9ec, { roughness: 0.55 });
    const body = cyl(1.7, 1.7, 7, shell, 0, 0, 0, hab, 32); body.rotation.z = Math.PI / 2;
    for (const x of [-3.5, 3.5]) { const cap = new THREE.Mesh(new THREE.SphereGeometry(1.7, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), shell); cap.rotation.z = x < 0 ? Math.PI / 2 : -Math.PI / 2; cap.position.x = x; hab.add(cap); }
    for (const x of [-2.6, 2.6]) for (const z of [-1.2, 1.2]) cyl(0.08, 0.1, 1.9, MAT.metal(0x8a8f99), x, -1.6, z, hab, 8);
    box(1.2, 2.0, 1.0, std(0xd0d3d8), 0, -0.4, 1.9, hab); box(0.8, 1.6, 0.04, std(0x3a3f4a), 0, -0.5, 2.41, hab);
    const hs = makeSign('OUTPOST HABITAT', 'Crew of 4 inside', 2.4, '#1f3a6b'); hs.position.set(0, 1.15, 1.55); hs.rotation.x = -0.35; hab.add(hs);
    hab.position.set(0, 2.5, -9); scene.add(hab); hab.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } }); player.addBox(-5.3, 5.3, -10.8, -7.2, 0, 5);
    const lm = makeLM(); lm.position.set(-14, 0, 6); lm.rotation.y = 0.6; scene.add(lm); player.addBox(-16.5, -11.5, 3.5, 8.5, 0, 6);
    const ctrl = makeController(); const post = new THREE.Group(); cyl(0.06, 0.08, 1.2, MAT.metal(0x8a8f99), 0, 0.6, -0.12, post, 8); ctrl.position.set(0, 1.35, 0); post.add(ctrl); post.position.set(5.0, 0, -2.6); scene.add(post); player.addBox(4.6, 5.4, -2.9, -2.3, 0, 2);
    const batt = makeBatteryRack(); batt.position.set(6.4, 0, -2.6); scene.add(batt); player.addBox(5.9, 6.9, -3.0, -2.2, 0, 1.6);
    const bus = makeBusBoard(LOADS, Object.fromEntries(LOADS.map(id => [id, LOAD_TYPES[id].name]))); const bpost = new THREE.Group(); box(0.15, 2.2, 0.15, MAT.metal(0x8a8f99), 0, 1.1, -0.15, bpost); bus.position.set(0, 1.5, 0); bpost.add(bus); bpost.position.set(3.0, 0, -6.6); scene.add(bpost); player.addBox(2.3, 3.7, -6.9, -6.3, 0, 2.4);
    const term = makeTerminal(infoScreen('OUTPOST POWER', ['Same panel as the Power Lab', ['Plan for the crater-rim shadow', '#ffc857']])); term.position.set(3.6, 0, -1.2); term.rotation.y = -0.4; scene.add(term); player.addBox(3.35, 3.85, -1.45, -0.95, 0, 1.4);
    const radio = new THREE.Group(); box(0.35, 0.5, 0.25, std(0x2a2d33), 0, 1.0, 0, radio); cyl(0.01, 0.01, 0.6, MAT.metal(0xb0b4b8), 0.12, 1.5, 0, radio, 6); box(0.08, 1.0, 0.08, MAT.metal(0x8a8f99), 0, 0.5, 0, radio); const rs = makeSign('RADIO', 'Mission Control', 0.5, '#2a3550'); rs.position.set(0, 1.38, 0.13); radio.add(rs); radio.position.set(1.8, 0, -1.4); scene.add(radio); player.addBox(1.6, 2.0, -1.6, -1.2, 0, 1.6);
    // generous invisible hit boxes, so the thin radio mast, the lander and the panel post are easy to aim at
    const hitBox = (obj, w, hh, d, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), new THREE.MeshBasicMaterial({ visible: false })); m.position.y = y; m.userData.hitbox = true; obj.add(m); return m; };
    hitBox(radio, 0.5, 1.8, 0.4, 0.9); hitBox(lm, 4.2, 5.2, 4.2, 2.6); hitBox(term, 0.7, 1.5, 0.5, 0.75);
    const field = makeSign('SOLAR FIELD', 'Panels face the Sun, low in the east', 2.2, '#7a5a10'); field.position.set(10.2, 1.6, -9.0); scene.add(field);
    // --- simulation
    const sim = new Outpost({ crew: 4, loads: LOADS, panels: PANELS.map((_, i) => ({ id: 'P' + (i + 1), peakKW: 2.5, deployed: state.deployed[i], connected: false })), battery: { capKWh: 30, socPct: 60 }, sunlit: true, ambientC: -30 });
    if (state.settings) for (const [id, on, p] of state.settings) { const l = sim.load(id); if (l) { l.on = on; l.priority = p; } }
    const saveSettings = () => { state.settings = sim.loads.map(l => [l.id, l.on, l.priority]); ctx.save(); };
    // --- solar panels (start folded on their pallets)
    const panels = PANELS.map(([x, z], i) => {
      const p = makeSolarPanel({ tilt: 1.42, post: 1.1 }); p.position.set(x, 0, z); scene.add(p); player.addBox(x - 0.45, x + 0.45, z - 0.45, z + 0.45, 0, 1.6);
      p.userData.head.rotation.y = state.yaw[i]; setPanelDeploy(p, state.deployed[i] ? 1 : 0); p.userData.k = state.deployed[i] ? 1 : 0;
      makeUsable(p, { label: `Solar panel ${i + 1}`, range: 2.6, enabled: () => ctx.isDone('brief') && !test.running && (!state.deployed[i] || !ctx.isDone('aim')),
        use: () => {
          if (!state.deployed[i]) { state.deployed[i] = true; sim.panels[i].deployed = true; sfx.place(); if (state.deployed.every(Boolean)) { ctx.done('deploy'); hud.flash('All four panels up. Now turn each one to face the Sun.', 'good', 4000); } ctx.save(); return; }
          if (!ctx.isDone('deploy')) { hud.flash('Unfold all four panels first.', ''); return; }
          state.yaw[i] = wrap(state.yaw[i] + Math.PI / 6); sfx.click(); ctx.save(); aimCheck();
        } });
      Object.defineProperty(p.userData.it, 'verb', { get: () => state.deployed[i] ? 'Turn 30°:' : 'Unfold', configurable: true });
      ix.add(p); return p;
    });
    const facing = i => Math.cos(wrap(state.yaw[i] - SUN_AZ));
    const aimCheck = () => { const ok = panels.every((_, i) => facing(i) > 0.96); if (ok && ctx.isDone('deploy') && !ctx.isDone('aim')) { ctx.done('aim'); hud.flash('Every panel faces the Sun. Now wire the field to the power pallet.', 'good', 4000); } };
    // --- wiring (same sockets and rules as the Power Lab)
    const wiring = new Wiring([...PANELS.map((_, i) => ({ id: 'p' + (i + 1), kind: 'pv', owner: 'P' + (i + 1) })), { id: 'cpv', kind: 'ctrl-pv' }, { id: 'cb', kind: 'ctrl-batt' }, { id: 'cl', kind: 'ctrl-load' }, { id: 'bt', kind: 'batt' }, { id: 'bus', kind: 'bus' }]);
    const plugs = cablePlugs(ctx, wiring, [
      ...panels.map((p, i) => ({ id: 'p' + (i + 1), kind: 'pv', obj: p.userData.socket, label: `Panel ${i + 1} output` })),
      { id: 'cpv', kind: 'ctrl-pv', obj: ctrl.userData.sockets['ctrl-pv'], label: 'Controller PV IN' },
      { id: 'cb', kind: 'ctrl-batt', obj: ctrl.userData.sockets['ctrl-batt'], label: 'Controller BATT' },
      { id: 'cl', kind: 'ctrl-load', obj: ctrl.userData.sockets['ctrl-load'], label: 'Controller LOAD out' },
      { id: 'bt', kind: 'batt', obj: batt.userData.socket, label: 'Battery terminal' },
      { id: 'bus', kind: 'bus', obj: bus.userData.socket, label: 'Habitat load bus' }
    ], { saved: state.cables, enabled: () => ctx.isDone('aim') && !test.running,
      onRefuse: why => { ctx.mistake(`Wrong connection (covered in the Power Lab): ${why}`); },
      onConnect: st => { state.cables = plugs.cables(); wiring.apply(sim); ctx.save();
        if (st.complete && !ctx.isDone('wire')) { ctx.done('wire'); hud.flash('Outpost grid online! Mission Control has a warning for you…', 'good'); setTimeout(warnShadow, 2500); }
        else if (!st.complete) hud.flash(`${st.panels.length}/4 panels · battery ${st.battery ? '✓' : '✗'} · habitat bus ${st.bus ? '✓' : '✗'}`, '', 2500); } });
    wiring.apply(sim);
    // --- the shadow
    const setSun = k => { sun.intensity = 0.04 + 3.16 * k; amb.intensity = 0.2 + 0.3 * k; };
    const test = shadowTest(sim, { hours: 4, seconds: 60, onSun: setSun });
    const countdown = { t: -1 };
    function warnShadow() {
      if (ctx.isDone('shadow')) return;
      countdown.t = ctx.diff.timeLimit ? 120 : 180; sfx.alarm();
      ctx.talk([{ who: CAPCOM, text: 'Outpost, Houston. The Sun is about to drop behind the crater rim to your east. You\'ll be in shadow for about four hours.' },
        { who: CAPCOM, text: 'The battery\'s at 90% after charging this morning: 30 kWh bank. Use the outpost power panel to get the habitat ready. Same panel as the test stand. Shadow starts when the clock hits zero.' }]);
    }
    if (ctx.isDone('wire') && !ctx.isDone('shadow')) countdown.t = 90;
    const panel = () => openPowerPanel(sim, { title: '⚡ Outpost power and life support', sub: 'Crew of 4 inside. In shadow only the 30 kWh battery powers the habitat.', canEdit: true, onChange: saveSettings, review: () => powerRefresher() });
    makeUsable(term, { label: 'Outpost power panel', verb: 'Open the', enabled: () => ctx.isDone('brief'), use: () => { ctx.input.releaseLock?.(); panel(); } }); ix.add(term);
    // the lander: look it over any time (it is the crew's ride home and the outpost's emergency shelter)
    makeUsable(lm, { label: 'Lunar lander', verb: 'Inspect the', range: 4.5, use: () => ctx.talk([{ who: CAPCOM, text: ctx.isDone('report') ? 'That lander is your ride home, outpost. Ascent stage is fuelled and healthy.' : 'That\'s the crew lander: your ride home and the shelter if the habitat ever loses pressure. It has its own batteries, so it can\'t power the outpost. Focus on the solar field.' }]) }); ix.add(lm);
    makeUsable(radio, { label: 'Radio', verb: 'Call Mission Control on the', enabled: () => ctx.isDone('brief') && !test.running && (!ctx.isDone('shadow') || !ctx.isDone('report')), use: async () => {
      if (!ctx.isDone('shadow')) { // before the shadow: a status check, so the radio always answers
        const st = wiring.status();
        await ctx.talk([{ who: 'You', text: 'Houston, outpost. Radio check.' }, { who: CAPCOM, text: !state.deployed.every(Boolean) ? 'Loud and clear, outpost. Unfold all four panels in the solar field first.' : !ctx.isDone('aim') ? 'Loud and clear. Turn each panel until it faces the low Sun.' : !st.complete ? 'Loud and clear. Wire the field to the pallet: panels to PV IN, BATT to the battery, LOAD to the habitat bus.' : 'Loud and clear. Grid looks good from here. Get the habitat ready on the power panel before the shadow.' }]);
        return;
      }
      await ctx.talk([{ who: 'You', text: 'Houston, outpost. We\'re through the shadow. Life support stayed up the whole time, and the panels are charging again.' },
        { who: CAPCOM, text: `Copy that, outpost. Lowest battery ${Math.round(test.result?.minSoc ?? 0)}%. That's textbook. Power is the root of everything up there, and you just proved you can run it.` }]);
      ctx.done('report'); finish();
    } }); ix.add(radio);
    // --- briefing (with the training callback)
    const T = timer(ctx, 900);
    const certified = hasCert('power');
    const brief = () => ctx.talk([
      { who: CAPCOM, text: 'Good morning, outpost. Welcome to the south pole of the Moon. The habitat is down safely, but it\'s running on a small backup battery. Today you give it real power.' },
      { who: CAPCOM, text: certified ? 'You know this hardware: same panels, same charge controller, same battery and load bus as the test stand in the Power Lab. Same panel to run it, too.' : 'Heads up: you haven\'t finished the Power Lab, so you\'re on your own with this kit. The power panel\'s Review button has the basics.' },
      { who: CAPCOM, text: 'Here the Sun never climbs high: it skims the horizon, only a few degrees up. So the panels stand almost upright, and each one has to be turned to face it.' },
      { who: CAPCOM, text: 'Unfold the four panels in the solar field, aim them, then wire them to the pallet by the habitat. Call me when the grid\'s up.', do: () => { if (ctx.done('brief')) T.start(); } }]);
    function finish() {
      const pen = ctx.state.mistakes.length;
      finishExercise(ctx, { id: 'moonpower', title: 'Mission: Lunar Outpost Power', timer: T, xp: 260, bonus: pen ? 0 : 10, badge: 'outpost-power',
        science: `At the lunar poles the Sun stays within a few degrees of the horizon, so panels stand nearly upright and turn to follow it, and nearby crater rims can block it for hours. During those shadows the battery is the outpost's only power, so the crew switch off what can wait and protect life support: the CO2 scrubber, the O2 generator and the heaters. ${pen ? 'Every mistake here was covered in the Power Lab: replay it from the training dashboard to sharpen up.' : 'No mistakes: your Power Lab training carried straight over to the Moon.'}` });
    }
    return {
      spawn: [0, 3, 0, 0],
      markerFor: id => ({ deploy: panels[state.deployed.findIndex(d => !d)] || null, aim: panels[panels.findIndex((_, i) => facing(i) <= 0.96)] || null, wire: !wiring.status().battery ? batt : !wiring.status().bus ? bus : post, shadow: test.running ? null : term, report: radio }[id] || null),
      onEnter: () => { hud.flash(certified ? '🎖️ Trained in: Power Lab (Power Systems L1)' : 'No Power Systems certification yet', certified ? 'good' : 'bad', 4000); if (!ctx.isDone('brief')) setTimeout(brief, 600); else T.start(); },
      update(dt, blocked) {
        T.update(dt, blocked); sky.update?.(dt);
        // panels: unfold animation and aim
        panels.forEach((p, i) => { const target = state.deployed[i] ? 1 : 0; p.userData.k += (target - p.userData.k) * Math.min(1, dt * 2.5); setPanelDeploy(p, p.userData.k); const hy = p.userData.head.rotation; hy.y += wrap(state.yaw[i] - hy.y) * Math.min(1, dt * 4); sim.panels[i].angleErr = Math.acos(Math.max(-1, Math.min(1, facing(i)))); });
        // shadow countdown and test
        if (countdown.t > 0 && !blocked) { countdown.t -= dt; hud.setTimer(`🌑 Shadow in ${Math.ceil(countdown.t)} s`, countdown.t < 20); if (countdown.t <= 0) { hud.setTimer(null); sim.battery.kWh = sim.battery.capKWh * 0.9; sim.tempC = 21; state.tries++; test.start(); hud.flash('The Sun has gone behind the crater rim. Battery only now.', 'bad', 4000); } }
        const res = test.update(dt, blocked);
        if (!test.running && countdown.t <= 0 && !blocked && wiring.status().complete) sim.tick(dt * 0.05); // before the grid is up the habitat runs on its own backup battery
        if (!blocked) hud.setReadout(test.running ? `🌑 Shadow ${Math.min(100, Math.round(test.t / 60 * 100))}%` : '⚡ Outpost power', [...powerReadout(sim), ...(ctx.isDone('deploy') && !ctx.isDone('aim') ? [['Panels on Sun', panels.map((_, i) => `${Math.round(Math.max(0, facing(i)) * 100)}%`).join(' '), 'warn']] : [])]);
        setBreakers(bus, sim); setBatteryLeds(batt, sim.socPct, wiring.status().battery);
        if (res === 'pass') { ctx.done('shadow'); hud.flash(`Through the shadow! Lowest battery ${Math.round(test.result.minSoc)}%. Life support never lost power. Report on the radio.`, 'good', 6000); }
        if (res === 'fail') {
          const why = test.result.lifeOutH > 0.02 ? 'life support lost power and the crew had to put their suits on' : `the battery fell to ${Math.round(test.result.minSoc)}%`;
          ctx.mistake(`Shadow failed (covered in the Power Lab): ${why}.`); sfx.wrong();
          hud.flash(`Shadow failed: ${why}. Mission Control is giving you another go when the next shadow comes. Use the panel: switch off what the crew can live without.`, 'bad', 8000);
          countdown.t = 60;
        }
      },
      dispose() { hud.setReadout(null); hud.setTimer(null); }
    };
  }
};
