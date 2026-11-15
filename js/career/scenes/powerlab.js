// ASTRO LAB Career — Module 4 practical: Power & Life Support Lab (first vertical slice, blueprint section 17).
// A test stand of the lunar habitat's power system: two solar panels under a sun lamp, the charge controller, the battery
// and the habitat load bus. Wire it, replace a blown fuse safely, then keep life support running through a 3-hour shadow.
// Everything here (models, sockets, wiring rules, the power panel, the simulation) is reused on the Moon in `moonpower`.
import * as THREE from '../../../vendor/three.module.js';
import { std, box } from '../models/house.js';
import { MAT } from '../models/materials.js';
import { makeSign } from '../models/props.js';
import { makeTerminal, infoScreen } from '../models/centre.js';
import { makeSolarPanel, makeController, makeBatteryRack, makeBusBoard, setBreakers, setBatteryLeds, makeFuseBox } from '../models/power.js';
import { LOOKS } from '../data/people.js';
import { makeUsable } from '../engine/interact.js';
import { trainingRoom, instructor, timer, finishExercise } from './kit.js';
import { cablePlugs, shadowTest } from './powerkit.js';
import { openPowerPanel, powerReadout } from '../ui/powerPanel.js';
import { runQuiz, pickOne } from '../ui/panels.js';
import { awardCert } from '../state/careerSave.js';
import { Outpost, LOAD_TYPES } from '../../sim/outpost.js';
import { Wiring } from '../../sim/wiring.js';

const LOADS = ['scrubber', 'o2gen', 'heaters', 'recycler', 'comms', 'lights', 'greenhouse', 'science', 'rover'];
const QUIZ = [
  { q: 'What does the charge controller do?', options: ['Takes the panels\' changing power, charges the battery safely and feeds the machines', 'Stores energy for the night', 'Turns sunlight into electricity', 'Cools the battery'], explain: 'Panel output rises and falls with the light. The controller smooths that, stops the battery overcharging or over-draining, and feeds the load bus.' },
  { q: 'A 20 kWh battery runs 4 kW of machines. About how long does it last from full?', options: ['About 5 hours', 'About 20 hours', 'About 80 hours', 'About 4 minutes'], explain: 'Energy ÷ power = time: 20 kWh ÷ 4 kW = 5 h. kWh is stored energy; kW is how fast you use it.' },
  { q: 'A long shadow is coming. Which machine do you switch off first?', options: ['Rover charger', 'CO2 scrubber', 'O2 generator', 'Heaters'], explain: 'Life support comes first. The rover can wait until the sun is back.' },
  { q: 'Why keep the battery above about 20%?', options: ['Deep discharge ages it fast and leaves no margin for surprises', 'Below 20% it can\'t be recharged by sunlight', 'Batteries explode at 19%', 'It makes the panels work better'], explain: 'Lithium batteries last far longer when they are not drained to empty, and the margin covers faults and longer shadows.' },
  { q: 'What do you do before replacing a blown fuse?', options: ['Switch that circuit off', 'Fit a bigger fuse', 'Turn the whole battery off and on', 'Nothing: fuses are safe to change live'], explain: 'A live circuit can arc as the fuse goes in. And a bigger fuse would let a fault overheat the wires.' },
  { q: 'Why does a power failure make CO2 rise in a habitat?', options: ['The CO2 scrubber needs electricity to remove the CO2 the crew breathe out', 'Batteries release CO2 when they fail', 'Solar panels absorb CO2', 'Heaters make CO2'], explain: 'Each person breathes out about 1 kg of CO2 a day. Without power the scrubber stops and CO2 builds up within hours.', hard: true }
];

export default {
  id: 'powerlab', title: 'Power & Life Support Lab', music: 'centre', ambience: 'vent',
  steps: [
    { id: 'brief', text: 'Talk to Technician Mensah at the test stand' },
    { id: 'wire', text: 'Wire it: both panels → controller PV IN, controller BATT → battery, controller LOAD → load bus' },
    { id: 'fuse', text: 'The CO2 scrubber fuse blew: get a spare fuse and replace it safely' },
    { id: 'night', text: 'Shadow test: set up the power panel, then press START SHADOW TEST (keep life support on, battery above 20%)' },
    { id: 'quiz', text: 'Talk to Mensah for your systems check' }
  ],
  initialState: { steps: {}, mistakes: [], cables: [], hasFuse: false, tries: 0, settings: null },

  async build(ctx) {
    const { scene, hud, sfx, state, ix } = ctx;
    trainingRoom(ctx, { w: 14, d: 10, hgt: 3.6, title: 'POWER LAB', sub: 'Habitat power test stand · same kit as the Moon' });
    // --- simulation (the same one the outpost runs)
    const sim = new Outpost({ crew: 4, loads: LOADS, panels: [{ id: 'A', peakKW: 4 }, { id: 'B', peakKW: 4 }], battery: { capKWh: 20, socPct: 90 }, sunlit: true });
    if (state.settings) for (const [id, on, p] of state.settings) { const l = sim.load(id); if (l) { l.on = on; l.priority = p; } }
    const saveSettings = () => { state.settings = sim.loads.map(l => [l.id, l.on, l.priority]); ctx.save(); };
    // --- solar test stand under a sun lamp
    // the sun lamp is overhead, so the panels tilt back to face up at it (they used to stand nearly upright, edge-on to the lamp)
    const panels = [-4.2, -2.4].map(x => { const p = makeSolarPanel({ tilt: 1.15 }); p.position.set(x, 0, -2.6); scene.add(p); ctx.player.addBox(x - 0.4, x + 0.4, -3.0, -2.2, 0, 1.6); return p; });
    const lampMat = MAT.glow(0xfff2c8, 2.2); const lamp = box(3.0, 0.08, 1.4, lampMat, -3.3, 3.5, -2.6, scene);
    const lampLight = new THREE.SpotLight(0xfff2d8, 40, 6, 0.9, 0.5, 1.2); lampLight.position.set(-3.3, 3.4, -2.6); lampLight.target.position.set(-3.3, 0, -2.6); scene.add(lampLight, lampLight.target);
    const lampSign = makeSign('SUN LAMP', '100% = full sunlight', 1.2, '#7a5a10'); lampSign.position.set(-3.3, 3.0, -1.88); scene.add(lampSign);
    const setSun = k => { lampMat.emissiveIntensity = 0.1 + 2.1 * k; lampLight.intensity = 40 * k; };
    // --- controller, battery, load bus, fuse box along the north wall
    const ctrl = makeController(); ctrl.position.set(0.2, 1.3, -4.88); scene.add(ctrl);
    const batt = makeBatteryRack(); batt.position.set(1.9, 0, -4.6); scene.add(batt); ctx.player.addBox(1.4, 2.4, -5, -4.25, 0, 1.6);
    const bus = makeBusBoard(LOADS, Object.fromEntries(LOADS.map(id => [id, LOAD_TYPES[id].name]))); bus.position.set(4.3, 1.5, -4.92); scene.add(bus);
    const fuseBox = makeFuseBox(); fuseBox.position.set(6.0, 1.4, -4.92); scene.add(fuseBox);
    const spares = new THREE.Group(); box(0.6, 0.5, 0.4, std(0x3e5c8a, { roughness: 0.6 }), 0, 0.25, 0, spares); const sl = makeSign('SPARE FUSES', '20 A · scrubber', 0.55, '#5a3a10'); sl.position.set(0, 0.36, 0.205); spares.add(sl);
    spares.position.set(6.1, 0, -3.9); scene.add(spares); ctx.player.addBox(5.8, 6.4, -4.1, -3.7, 0, 0.6);
    // --- the power panel terminal + the shadow-test button
    const term = makeTerminal(infoScreen('POWER PANEL', ['Open to see power and life support', ['Same panel as the Moon outpost', '#ffc857']])); term.position.set(2.6, 0, -1.6); term.rotation.y = -0.3; scene.add(term); ctx.player.addBox(2.35, 2.85, -1.85, -1.35, 0, 1.4);
    const btn = new THREE.Group(); box(0.4, 1.0, 0.4, std(0x2a2d33), 0, 0.5, 0, btn); const red = box(0.22, 0.06, 0.22, MAT.glow(0xe0483a, 1.0), 0, 1.03, 0, btn);
    const bsign = makeSign('START SHADOW TEST', '3 hours, no sunlight', 0.8, '#7a1f18'); bsign.position.set(0, 1.35, 0.0); btn.add(bsign); btn.position.set(4.0, 0, -1.5); scene.add(btn); ctx.player.addBox(3.75, 4.25, -1.75, -1.25, 0, 1.2);
    // --- wiring
    const wiring = new Wiring([{ id: 'pA', kind: 'pv', owner: 'A' }, { id: 'pB', kind: 'pv', owner: 'B' }, { id: 'cpv', kind: 'ctrl-pv' }, { id: 'cb', kind: 'ctrl-batt' }, { id: 'cl', kind: 'ctrl-load' }, { id: 'bt', kind: 'batt' }, { id: 'bus', kind: 'bus' }]);
    const plugs = cablePlugs(ctx, wiring, [
      { id: 'pA', kind: 'pv', obj: panels[0].userData.socket, label: 'Panel A output' },
      { id: 'pB', kind: 'pv', obj: panels[1].userData.socket, label: 'Panel B output' },
      { id: 'cpv', kind: 'ctrl-pv', obj: ctrl.userData.sockets['ctrl-pv'], label: 'Controller PV IN' },
      { id: 'cb', kind: 'ctrl-batt', obj: ctrl.userData.sockets['ctrl-batt'], label: 'Controller BATT' },
      { id: 'cl', kind: 'ctrl-load', obj: ctrl.userData.sockets['ctrl-load'], label: 'Controller LOAD out' },
      { id: 'bt', kind: 'batt', obj: batt.userData.socket, label: 'Battery terminal' },
      { id: 'bus', kind: 'bus', obj: bus.userData.socket, label: 'Load bus input' }
    ], { saved: state.cables, enabled: () => ctx.isDone('brief') && !test.running,
      onRefuse: why => ctx.mistake(`Wrong connection: ${why}`),
      onConnect: st => { state.cables = plugs.cables(); wiring.apply(sim); ctx.save();
        if (st.complete && !ctx.isDone('wire')) { ctx.done('wire'); hud.flash('Wired correctly! The habitat bus is live.', 'good'); setTimeout(blowFuse, 2500); }
        else if (!st.complete) hud.flash(`${st.panels.length}/2 panels · battery ${st.battery ? '✓' : '✗'} · load bus ${st.bus ? '✓' : '✗'}`, '', 2500); } });
    wiring.apply(sim);
    function blowFuse() { if (ctx.isDone('fuse')) return; sim.blowFuse('scrubber'); sfx.alarm(); hud.flash('⚠ ALARM: CO2 scrubber fuse blown! CO2 will start rising. Get a spare fuse from the crate by the fuse box.', 'bad', 7000); ctx.refreshObjectives(); }
    if (ctx.isDone('wire') && !ctx.isDone('fuse')) sim.blowFuse('scrubber');
    makeUsable(spares, { label: 'Spare fuses', verb: 'Take a fuse from', enabled: () => ctx.isDone('wire') && !ctx.isDone('fuse') && !state.hasFuse, use: () => { state.hasFuse = true; sfx.pickup(); hud.flash('You have a 20 A spare fuse. Now open the fuse box.', '', 3000); ctx.save(); } }); ix.add(spares);
    makeUsable(fuseBox, { label: 'Fuse box', verb: 'Open', enabled: () => ctx.isDone('wire') && !ctx.isDone('fuse'), use: async () => {
      if (!state.hasFuse) { hud.flash('You need a spare fuse first: the crate is just below.', 'bad'); return; }
      const pick = await pickOne({ title: 'Replace the CO2 scrubber fuse', intro: 'How do you do it?', options: [
        { id: 'off', icon: '🔌', name: 'Switch the scrubber circuit OFF, swap the fuse, switch it back on', desc: 'Standard procedure' },
        { id: 'live', icon: '⚡', name: 'Swap it straight away: the circuit can stay on', desc: 'Quickest' },
        { id: 'big', icon: '🔺', name: 'Fit a bigger 40 A fuse so it can\'t blow again', desc: 'More robust?' }] });
      if (!pick) return;
      if (pick === 'live') { ctx.mistake('Tried to change a fuse on a live circuit.'); sfx.wrong(); hud.flash('No! A live circuit can arc as the fuse goes in. Switch the circuit off first.', 'bad', 5000); return; }
      if (pick === 'big') { ctx.mistake('Tried to fit a bigger fuse than the circuit is rated for.'); sfx.wrong(); hud.flash('A bigger fuse lets a fault overheat the wiring and start a fire. Always use the same rating.', 'bad', 5000); return; }
      sim.replaceFuse('scrubber'); state.hasFuse = false; ctx.done('fuse'); sfx.place();
      hud.flash('Fuse replaced and the scrubber is running again. Next: get ready for the shadow test at the power panel.', 'good', 5000);
    } }); ix.add(fuseBox);
    // --- the panel and the test
    const panel = () => openPowerPanel(sim, { title: '⚡ Power and life support · test stand', sub: 'The shadow test cuts the sun lamp for 3 hours of simulated time. Only the battery will power the habitat.', canEdit: !test.running, onChange: saveSettings });
    makeUsable(term, { label: 'Power panel', verb: 'Open the', enabled: () => ctx.isDone('brief'), use: () => { ctx.input.releaseLock?.(); panel(); } }); ix.add(term);
    const test = shadowTest(sim, { hours: 3, seconds: 45, onSun: setSun });
    makeUsable(btn, { label: 'START SHADOW TEST', verb: 'Press', enabled: () => ctx.isDone('fuse') && !ctx.isDone('night') && !test.running, use: () => {
      if (!wiring.status().complete) { hud.flash('Finish the wiring first.', 'bad'); return; }
      sim.battery.kWh = sim.battery.capKWh * 0.9; sim.tempC = 21;
      state.tries++; test.start(); sfx.click(); hud.flash('Shadow test running: 3 hours with no sunlight, sped up. Watch the battery.', '', 4000);
    } }); ix.add(btn);
    // --- instructor
    const T = timer(ctx, 600);
    const tech = instructor(ctx, LOOKS.tech, 'Technician Mensah', [-0.6, 0.6, -0.5], () => talkTech());
    const demo = { on: false, sim: null };
    function talkTech() {
      if (!ctx.isDone('brief')) return [
        { who: 'Technician Mensah', text: 'Welcome to the power lab, {name}. Everything on the Moon runs on electricity: no power, no fans, no oxygen generator, no CO2 scrubber, no heaters. So we learn power first.' },
        { who: 'Technician Mensah', text: 'This stand is a copy of the outpost\'s system. Two solar panels under a sun lamp, the charge controller, a 20 kWh battery, and the habitat\'s load bus with nine machines on it.' },
        { who: 'Technician Mensah', text: 'Watch the readout. I\'ll run a fully wired copy and switch the sun off.', do: () => { demo.sim = new Outpost({ crew: 4, loads: LOADS, panels: [{ id: 'A', peakKW: 4 }, { id: 'B', peakKW: 4 }], battery: { capKWh: 20, socPct: 90 } }); demo.on = true; setSun(0); demo.sim.sun = 0; } },
        { who: 'Technician Mensah', text: 'See? The solar input drops to zero and the battery starts draining. With everything switched on it\'s using over 8 kW: that battery would be flat in about two hours, and then the scrubber stops and CO2 builds up.' },
        { who: 'Technician Mensah', text: 'Remember the difference: kW is how fast you use power right now. kWh is how much energy is stored. 20 kWh at 4 kW lasts about 5 hours.', do: () => { demo.on = false; setSun(1); hud.setReadout(null); } },
        { who: 'Technician Mensah', text: 'Your job: wire the stand (the colours help: yellow is solar, red is battery, green is the load bus), handle whatever breaks, then keep life support alive through a 3-hour shadow. Start a cable by using a socket, finish it at the other socket.', do: () => { if (ctx.done('brief')) T.start(); } }];
      if (!ctx.isDone('wire')) return [{ who: 'Technician Mensah', text: 'Panels into the controller\'s yellow PV IN. Controller red BATT to the battery. Controller green LOAD out to the load bus. Never a panel straight to the battery.' }];
      if (!ctx.isDone('fuse')) return [{ who: 'Technician Mensah', text: 'Scrubber fuse blew. Spare fuses are in the blue crate. And think about safety before you touch the fuse box.' }];
      if (!ctx.isDone('night')) return [{ who: 'Technician Mensah', text: 'Open the power panel. In shadow only the battery runs things, so switch off what the crew can live without and keep life support at the top. Then press the red button.' }];
      if (!ctx.isDone('quiz')) return [{ who: 'Technician Mensah', text: 'Nice work. Last thing: a quick systems check, and then you\'re certified on this kit.', do: quiz }];
      return [{ who: 'Technician Mensah', text: 'You\'ll see this exact controller again, on the Moon.' }];
    }
    async function quiz() {
      if (ctx.isDone('quiz')) return;
      const r = await runQuiz({ title: 'Systems check: power and life support', questions: QUIZ });
      for (const q of r.wrong) ctx.mistake(`Quiz: ${q}`);
      ctx.done('quiz'); finish(r);
    }
    function finish(r) {
      const distinction = ctx.state.mistakes.length <= 1;
      awardCert('power', { distinction }); awardCert('lifesupport', { distinction });
      finishExercise(ctx, { id: 'powerlab', title: 'Power & Life Support Lab', timer: T, xp: 180, bonus: distinction ? 5 : 0, badge: 'power-l1',
        science: `You kept a habitat alive on battery power (quiz ${r.correct}/${r.total}). Solar panels make power only in sunlight, and their output changes with the light, so a charge controller sits between them, the battery and the machines. In shadow the battery's stored energy (kWh) divided by what the machines use (kW) tells you how many hours you have. Life support comes first: the CO2 scrubber, the O2 generator and the heaters. Certified: Power Systems L1 and Life Support L1${distinction ? ' (with Distinction)' : ''}. You will use this exact equipment to power the lunar outpost.` });
    }
    return {
      spawn: [0, 3.2, 0, 0],
      markerFor: id => ({ brief: tech.rig.root, wire: !wiring.status().battery ? batt : !wiring.status().bus ? bus : ctrl, fuse: state.hasFuse ? fuseBox : spares, night: test.running ? null : btn, quiz: tech.rig.root }[id] || null),
      onEnter: () => { if (!ctx.isDone('brief')) tech.talk(talkTech()); else T.start(); },
      update(dt, blocked) {
        tech.update(dt); T.update(dt, blocked);
        if (demo.on && demo.sim && !blocked) { demo.sim.tick(dt * 0.4); hud.setReadout('Demo rig (sun off)', powerReadout(demo.sim)); }
        const res = test.update(dt, blocked);
        if (!test.running && !blocked && wiring.status().complete) sim.tick(dt * 0.02);
        if (!demo.on && !blocked) hud.setReadout(test.running ? '⚡ Shadow test' : '⚡ Test stand', [...powerReadout(sim), ...(test.running ? [['Shadow', `${Math.min(100, Math.round(test.t / 45 * 100))}%`, '']] : [])]);
        setBreakers(bus, sim); setBatteryLeds(batt, sim.socPct, wiring.status().battery);
        red.material.emissiveIntensity = test.running ? 0.3 : 1 + Math.sin(performance.now() / 300) * 0.4;
        if (res === 'pass') { ctx.done('night'); hud.flash(`Shadow test passed! Lowest battery ${Math.round(test.result.minSoc)}%, life support never lost power. Talk to Mensah.`, 'good', 6000); }
        if (res === 'fail') {
          const why = test.result.lifeOutH > 0.02 ? 'life support lost power' : `the battery fell to ${Math.round(test.result.minSoc)}%`;
          ctx.mistake(`Shadow test failed: ${why}.`); sfx.wrong();
          hud.flash(`Test failed: ${why}. Open the panel: switch off machines the crew can live without (rover, science, greenhouse, lights) and keep life support at the top. Then try again.`, 'bad', 8000);
        }
      },
      dispose() { hud.setReadout(null); }
    };
  }
};
