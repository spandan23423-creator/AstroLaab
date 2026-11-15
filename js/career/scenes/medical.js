// ASTRO LAB Career — Phase 6: Health and Neuroscience. In the medical centre:
//  1. record your baseline (heart and blood pressure, a real tumbling-E eye test, balance),
//  2. the Migraine Trigger Lab: test six stations and identify three migraine triggers by their effects (10A),
//  3. the Light Sensitivity Sim: a safe, non-strobing glare simulation you solve by fixing the light sources (10B),
//  4. the Hydration Challenge: fill and drink from a bottle until the meter reaches the goal; coffee, salt and exercise lower it (10C),
//  5. the lunar habitat scenario: Commander Arden has a headache from high CO2; assess her, find the cause, swap the scrubber fan (10D),
//  6. a knowledge check.
// The 3D brain model was removed (spec 10). Every topic is labelled "confirmed" or "still being researched". Not medical advice.
// Photosensitivity: all light effects are slow (under 1 pulse per second), low contrast and never flash; a warning comes first
// and "Effects off" replaces them with text descriptions (also the default when the system asks for reduced motion).
import * as THREE from '../../../vendor/three.module.js';
import { MAT } from '../models/materials.js';
import { makeSign } from '../models/props.js';
import { std, box, cyl } from '../models/house.js';
import { makeScreen, infoScreen, makeTerminal } from '../models/centre.js';
import { makePerson, animatePerson } from '../models/humans.js';
import { LOOKS } from '../data/people.js';
import { makeUsable } from '../engine/interact.js';
import { worldUI, fx as fxLayer } from '../engine/layers.js';
import { trainingRoom, instructor, timer, finishExercise, floorMark } from './kit.js';
import { runQuiz, pickOne } from '../ui/panels.js';
import { runEyeTest } from '../ui/eyeTest.js';
import { settings } from '../../systems/core.js';
import { h, openModal } from '../../ui/dom.js';

const QUIZ = [
  { q: 'Why do many astronauts feel sick in their first days in space?', options: ['Their eyes and inner ear send the brain mixed signals about movement', 'Space food is too salty', 'The air is too thin', 'Radiation hits the stomach'], explain: 'Space motion sickness comes from a mismatch between vision and the vestibular system. Confirmed, and usually gone in a few days.' },
  { q: 'Which change to astronauts\' eyes is a confirmed risk on long missions?', options: ['Swelling at the back of the eye and changes in vision (SANS)', 'Eyes changing colour', 'Losing all colour vision', 'Eyes getting bigger'], explain: 'SANS is well documented. Its exact cause is still being studied.' },
  { q: 'Which of these is a common migraine trigger?', options: ['Flickering or very bright light', 'A soft, steady desk lamp', 'A potted plant', 'Quiet background music'], explain: 'Flicker and glare are among the most common triggers. Many people with migraine are sensitive to light.' },
  { q: 'Light from a window is causing glare on your screen. What is the best fix?', options: ['Close the blind and lower the screen brightness', 'Turn the screen to maximum brightness', 'Wear a dark visor all day', 'Ignore it'], explain: 'Remove the source of glare and reduce contrast: blinds, steady lighting and a dimmer screen.' },
  { q: 'Why do astronauts have to plan their drinking in space?', options: ['Fluid shifts to the head, so they feel less thirsty than they really are', 'Water is not allowed on the station', 'Drinking makes them float', 'Their stomach stops working'], explain: 'Thirst is weaker in weightlessness, so crews follow a hydration plan. Dehydration can also trigger headaches.' },
  { q: 'Which of these lowers your hydration?', options: ['Hard exercise and a lot of coffee or salty food', 'Small sips of water often', 'Eating fruit', 'Resting in the shade'], explain: 'Sweating, caffeine (a mild diuretic in large amounts) and salt all work against hydration.' },
  { q: 'Which of these is still being researched rather than confirmed?', options: ['Long-term effects of space radiation on memory', 'Space motion sickness', 'Astronauts getting taller in space', 'Balance problems after landing'], explain: 'Radiation effects on the brain are mostly known from animal studies, so they are still being researched.' },
  { q: 'A crewmate has a headache after a long EVA. What should you check early?', options: ['CO₂ levels: high carbon dioxide can cause headaches', 'Their favourite food', 'The colour of their suit', 'How many photos they took'], explain: 'High CO₂ is a known cause of headaches on spacecraft. It is checked early, along with other causes.' }
];
const SCEN = 'Lunar habitat (simulation)';
// Migraine trigger lab stations (10A). trigger = is it a common migraine trigger?
const TRIG = [
  { id: 'flicker', name: 'Flickering tube light', verb: 'Switch on', trigger: true, at: [3.0, -6.3], react: 'head', cap: '[The tube light pulses unevenly and buzzes. Ivan squints and shades his eyes.]', why: 'Flickering or very bright light is one of the most common migraine triggers. Many people with migraine are also extra sensitive to light (photophobia).' },
  { id: 'noise', name: 'Loudspeaker', verb: 'Play noise on', trigger: true, at: [5.2, -6.3], react: 'ears', cap: '[A loud, harsh grinding noise. Ivan winces and covers his ears.]', why: 'Loud or sudden noise is a common trigger, and noise usually feels worse during a migraine.' },
  { id: 'smell', name: 'Strong solvent cleaner', verb: 'Open', trigger: true, at: [7.4, -6.3], react: 'cough', cap: '[A sharp chemical smell fills the air. Ivan coughs and waves it away.]', why: 'Strong smells such as perfume, paint, smoke or cleaning chemicals are a commonly reported trigger.' },
  { id: 'sleep', name: 'Night-shift bunk (3 h sleep)', verb: 'Try', trigger: true, at: [9.2, -4.6], react: 'head', cap: '[Alarm after only 3 hours of sleep. Everything feels heavy and dim. Ivan rubs his temples.]', why: 'Too little sleep, or a sudden change in sleep pattern (common on missions with shifting schedules), is a well-known trigger.' },
  { id: 'plant', name: 'Potted basil plant', verb: 'Smell', trigger: false, at: [9.2, -2.9], react: 'ok', cap: '[A mild, fresh smell of basil. Ivan shrugs: "Smells like pizza."]', why: 'A mild, everyday plant smell is not a typical trigger. Strong chemical smells are the problem, not normal ones.' },
  { id: 'lamp', name: 'Warm, steady desk lamp', verb: 'Switch on', trigger: false, at: [9.2, -1.9], react: 'ok', cap: '[Soft, steady, warm light. Ivan relaxes.]', why: 'Soft, steady, warm light is comfortable. It is flicker and glare that cause trouble.' }
];
// Light sensitivity sim sources (10B): weight = how much discomfort each adds while it is a problem
const LIGHT = [
  { id: 'tube', name: 'Flickering overhead tube', fix: 'Swap for a steady LED', weight: 35, done: 'Steady LED fitted: no more uneven pulsing.' },
  { id: 'window', name: 'Window (direct sunlight)', fix: 'Close the blind', weight: 30, done: 'Blind closed: the harsh sunlight and glare are gone.' },
  { id: 'screen', name: 'Screen at full brightness', fix: 'Lower brightness / night mode', weight: 25, done: 'Screen dimmed to match the room.' },
  { id: 'board', name: 'Glossy whiteboard (reflection)', fix: 'Put the matte cover on', weight: 10, done: 'Matte cover on: the reflection is gone.' }
];
const HYD = { start: 40, goal: 100, sip: 10, sips: 5, decay: 0.12, warn: 25 };
// Where the water bottle sits in the hand (camera space): low right, fully in view, above the sleeve
const DRINK_HOLD = [0.17, -0.22, -0.5];

export default {
  id: 'medical', title: 'Health & Neuroscience', music: 'centre', ambience: 'vent',
  steps: [
    { id: 'brief', text: 'Talk to Flight Surgeon Dr. Hart' },
    { id: 'baseline', text: 'Record your baseline: heart and blood pressure, eye test, balance' },
    { id: 'triggers', text: 'Migraine Trigger Lab: test the stations and identify 3 migraine triggers' },
    { id: 'light', text: 'Light Sensitivity Sim: find the light sources causing glare and fix them' },
    { id: 'hydrate', text: 'Hydration Challenge: fill your bottle and drink until the meter reaches 100%' },
    { id: 'scenario', text: 'Lunar scenario: help Commander Arden (headache and dizziness)' },
    { id: 'quiz', text: 'Pass the knowledge check on the records terminal' }
  ],
  initialState: { steps: {}, mistakes: [], base: {}, trig: {}, light: {}, hyd: null, scen: {}, fxMode: null },

  async build(ctx) {
    const { scene, player, ix, hud, sfx, state, world, carry, input } = ctx;
    state.trig ||= {}; state.light ||= {}; state.scen ||= {}; state.base ||= {};
    trainingRoom(ctx, { w: 20, d: 14, hgt: 3.4, title: 'MEDICAL CENTRE', sub: 'Flight medicine · neuroscience', light: 1.05 });
    const T = timer(ctx, 900);
    const white = std(0xf2f4f6, { roughness: 0.5 }), grey = std(0x8a90a0), dark = std(0x2a2d33, { roughness: 0.5 });
    const sign = (t, s, x, y, z, ry = 0, w = 1.2, col) => { const sg = worldUI(makeSign(t, s, w, col)); sg.position.set(x, y, z); sg.rotation.y = ry; scene.add(sg); return sg; };
    const station = (o, x, z, ry = 0) => { o.position.set(x, 0, z); o.rotation.y = ry; scene.add(o); o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
    const hitBox = (parent, w, hh, d, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), new THREE.MeshBasicMaterial({ visible: false })); m.position.set(x, y, z); m.userData.hitbox = true; parent.add(m); return m; };

    // ---------- screen effects (soft overlays; never flashing) ----------
    const fxEl = {}; for (const n of ['glare', 'haze', 'vignette', 'blur']) { fxEl[n] = h('div', { class: `cx-screenfx ${n}`, 'aria-hidden': 'true' }); hud.root.append(fxEl[n]); }
    const fxOff = () => state.fxMode === 'off';
    const setFx = (n, v) => { const cap = fxOff() ? 0.25 : 1; const o = Math.max(0, Math.min(1, v)) * cap; const s = o.toFixed(3); if (fxEl[n].style.opacity !== s) fxEl[n].style.opacity = s; };
    const clearFx = () => Object.keys(fxEl).forEach(n => setFx(n, 0));
    let shake = 0;
    const fxBtn = h('button', { class: 'tbtn', title: 'Light and screen effects', 'aria-label': 'Toggle light and screen effects', onclick: () => { state.fxMode = fxOff() ? 'gentle' : 'off'; updFxBtn(); hud.flash(fxOff() ? 'Screen effects off: effects are described in text instead.' : 'Gentle screen effects on (slow, no flashing).', '', 2500); } });
    const updFxBtn = () => { fxBtn.innerHTML = ''; fxBtn.append('💡', h('span', {}, fxOff() ? 'Effects: off' : 'Effects: gentle')); };
    hud.top.prepend(fxBtn); if (!state.fxMode) state.fxMode = settings.reducedMotion ? 'off' : 'gentle'; updFxBtn();
    // One-time photosensitivity notice before the light activities
    let warning = null;
    function lightWarning() {
      if (state.fxWarned) return Promise.resolve();
      if (warning) return warning;
      input.releaseLock();
      warning = pickOne({ title: '⚠ Light sensitivity notice', cancel: false, intro: 'The next activities simulate how light, noise and smells can feel to someone with migraine. The effects are gentle: soft glare, haze and blur that change slowly. There is no strobing or rapid flashing. You can change this at any time with the 💡 button (top right).', options: [
        { id: 'gentle', icon: '🌤', name: 'Gentle effects', desc: 'Soft glare and blur, at most one slow pulse per second' },
        { id: 'off', icon: '📝', name: 'Effects off', desc: 'No screen effects; each effect is described in text' }] }).then(pick => { state.fxMode = pick || 'off'; state.fxWarned = true; updFxBtn(); warning = null; });
      return warning;
    }

    // ---------- people ----------
    const doc = instructor(ctx, LOOKS.medic, 'Dr. Hart', [-1.5, 1.2, Math.PI * 0.9], () => talkHart());
    function talkHart() {
      if (!ctx.isDone('brief')) return [
        { who: 'Dr. Hart', text: 'Hello {name}, I\'m Dr. Hart, a flight surgeon: a doctor for astronauts. Space changes the human body, and your brain most of all.' },
        { who: 'Dr. Hart', text: 'First we record your baseline. Then three hands-on labs: migraine triggers, light sensitivity and hydration. Finally you\'ll help a crewmate in our lunar habitat simulator.' },
        { who: 'Dr. Hart', text: 'One rule in here: we always say what is a confirmed risk and what is still being researched. And this is training, not medical advice.', do: () => { if (ctx.done('brief')) T.start(); } }];
      const tip = { baseline: 'Three stations on the west side: heart and blood pressure, the eye test from the blue line, and the balance board.', triggers: 'The Migraine Trigger Lab is in the north-east corner. Test each station, watch Ivan, then decide: trigger or harmless?', light: 'The Light Sensitivity Sim is the desk in the south-east corner. Find what makes the glare and fix it.', hydrate: 'Grab the water bottle by the dispenser on the south wall, fill it and drink. Keep an eye on the meter.', scenario: 'Commander Arden is in the lunar habitat simulator, south-west. Treat it like the real thing.', quiz: 'The knowledge check is on the records terminal by the north wall.' }[ctx.current()?.id];
      return [{ who: 'Dr. Hart', text: tip || 'Well done.' }];
    }

    // ================= 1. Baseline (north-west) =================
    const bed = new THREE.Group(); box(0.9, 0.08, 2, white, 0, 0.75, 0, bed); box(0.9, 0.7, 0.1, grey, 0, 0.37, -0.9, bed); box(0.9, 0.7, 0.1, grey, 0, 0.37, 0.9, bed); station(bed, -9.0, -4.8); player.addBox(-9.5, -8.5, -5.85, -3.75, 0, 0.9);
    const bp = new THREE.Group(); box(0.4, 1.1, 0.3, white, 0, 0.55, 0, bp); box(0.3, 0.22, 0.04, std(0x1a1d24), 0, 1.25, 0.12, bp); const cuff = cyl(0.06, 0.06, 0.18, std(0x2b4f8f), 0.25, 1.0, 0.1, bp, 12); cuff.rotation.z = Math.PI / 2; station(bp, -7, -6.5); player.addBox(-7.25, -6.75, -6.7, -6.3, 0, 1.4);
    sign('HEART & BP', '', -7, 2.3, -6.97, 0, 1.0);
    const board = new THREE.Group(); box(0.7, 0.08, 0.5, std(0x3a3f4a), 0, 0.04, 0, board); box(0.6, 0.02, 0.4, std(0x2e8a4a), 0, 0.09, 0, board); hitBox(board, 0.7, 0.4, 0.5, 0, 0.2, 0); station(board, -4.6, -5.6);
    sign('BALANCE', 'Stand on the board', -4.6, 2.3, -6.97, 0, 1.0);
    // eye test lane: a big, sharp chart on the west wall, a blue line 4.5 m away
    const chartTex = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 768; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 512, 768); x.textAlign = 'center';
      const rows = [1, 2, 3, 4, 5, 6];
      rows.forEach((n, i) => { const s = 120 - i * 19, y = 95 + i * 115; for (let j = 0; j < n; j++) { x.save(); x.fillStyle = '#111'; x.translate(240 + (j - (n - 1) / 2) * s * 1.3, y); x.rotate(((i * 3 + j * 7) % 4) * Math.PI / 2); const u = s / 5; x.fillRect(-2.5 * u, -2.5 * u, u, 5 * u); for (const k of [0, 2, 4]) x.fillRect(-2.5 * u, (-2.5 + k) * u, 5 * u, u); x.restore(); } x.font = '20px sans-serif'; x.fillStyle = '#c33'; x.fillText(['6/60', '6/36', '6/24', '6/18', '6/12', '6/6'][i], 478, y + 8); });
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; })();
    const eye = new THREE.Group(); const chartM = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.2), std(0xffffff, { map: chartTex, roughness: 0.7 })); eye.add(chartM);
    const frameM = new THREE.Mesh(new THREE.BoxGeometry(0.88, 1.28, 0.03), dark); frameM.position.z = -0.02; eye.add(frameM); worldUI(chartM);
    eye.position.set(-9.95, 1.55, -1.0); eye.rotation.y = Math.PI / 2; scene.add(eye);
    const LANE = new THREE.Vector3(-5.5, 0, -1.0);
    const tape = floorMark(scene, LANE.x, LANE.z, 0.12, 0.9, 0x2b6ad8); tape.material.opacity = 0.95;
    sign('EYE TEST', 'Stand on the blue line', -9.97, 2.55, -1.0, Math.PI / 2, 1.0);
    // records terminal (knowledge check), north wall
    const rec = makeTerminal(infoScreen('HEALTH RECORDS', ['Astronaut medical file', ['Baseline: not recorded', '#ffc857']], { w: 512, hgt: 320 })); rec.position.set(0.5, 0, -6.55); scene.add(rec); player.addBox(0.2, 0.8, -6.85, -6.25, 0, 1.3);
    const hr = 58 + Math.floor(Math.random() * 18), sys = 108 + Math.floor(Math.random() * 14), dia = 68 + Math.floor(Math.random() * 10);
    const recScreen = () => rec.userData.screen?.redraw?.(infoScreen('HEALTH RECORDS', state.base.bp && state.base.vision && state.base.balance ? [`Heart rate ${state.base.bp.hr} bpm · BP ${state.base.bp.sys}/${state.base.bp.dia}`, `Vision ${state.base.vision} · Balance ${state.base.balance}`, ['Baseline recorded ✓', '#3fe0a0']] : ['Astronaut medical file', ['Baseline: in progress', '#ffc857']], { w: 512, hgt: 320 }));
    const baseDone = () => { recScreen(); if (['bp', 'vision', 'balance'].every(k => state.base[k]) && ctx.done('baseline')) hud.flash('Baseline recorded. Next: the Migraine Trigger Lab (north-east).', 'good'); };
    makeUsable(bp, { label: 'Blood pressure monitor', verb: 'Measure', range: 2.2, enabled: () => ctx.isDone('brief') && !state.base.bp, use: async () => {
      input.releaseLock(); sfx.ui(); hud.cap('[Cuff inflates: pssshhh... beep]', 2200);
      await new Promise(r => setTimeout(r, 1500));
      state.base.bp = { hr, sys, dia };
      openModal({ title: '❤ Heart and blood pressure', body: h('div', {}, h('p', { class: 'cx-vitals' }, `Heart rate: ${hr} beats per minute`, h('br'), `Blood pressure: ${sys}/${dia} mmHg`), h('p', {}, 'In space, fluid shifts towards the head and the heart doesn\'t have to work against gravity. Over months it can shrink a little, a bit like an unused muscle.'), h('span', { class: 'cx-tag good' }, '✅ Confirmed effect'), h('p', { class: 'muted tiny' }, 'For learning only. Not medical advice.')) });
      baseDone();
    } }); ix.add(bp);
    // Eye test (item 9): only from the blue line; a real test flow with input, validation, feedback, retry and a saved result
    const onLane = () => Math.hypot(player.pos.x - LANE.x, player.pos.z - LANE.z) < 0.8;
    let eyeBusy = false;
    makeUsable(eye, { label: 'Eye chart', verb: 'Start the eye test at the', range: 5.5, enabled: () => ctx.isDone('brief') && !state.base.vision && !eyeBusy, use: async () => {
      if (!onLane()) { hud.flash('Stand on the blue line first (4.5 m from the chart), so the test is fair.', 'bad'); sfx.wrong(); return; }
      eyeBusy = true; input.releaseLock();
      try {
        const r = await runEyeTest({ perLetter: ctx.diff.timeLimit ? 8 : 12 });
        if (!r.done) { hud.flash('Eye test stopped. Start it again from the blue line when you are ready.', '', 3000); return; }
        if (!r.passed) { hud.flash(`Smallest line read: ${r.acuity}. Not recorded yet: try the test again.`, 'bad', 3500); return; }
        state.base.vision = r.acuity; sfx.good();
        openModal({ title: '👁 Vision in space', body: h('div', {}, h('p', {}, `Saved: ${r.acuity}. Astronauts' eyes are checked before, during and after long missions, because many develop swelling at the back of the eye and need stronger glasses in space (SANS).`), h('span', { class: 'cx-tag good' }, '✅ Confirmed risk'), h('p', {}, 'Why it happens is ', h('b', {}, 'still being researched'), ': fluid shifts are the leading idea.'), h('span', { class: 'cx-tag warn' }, '🔬 Still being researched'), h('p', { class: 'muted tiny' }, 'For learning only. Not medical advice.')) });
        baseDone();
      } finally { eyeBusy = false; }
    } }); ix.add(eye);
    let balT = 0, balOn = false;
    makeUsable(board, { label: 'Balance board', verb: 'Step on', range: 2.2, enabled: () => ctx.isDone('brief') && !state.base.balance && !balOn, use: () => { player.pos.set(board.position.x, 0.08, board.position.z); balOn = true; balT = 0; player.frozenByScene = true; hud.flash('Stand still for 5 seconds with your eyes closed (don\'t touch the controls).', '', 4000); } }); ix.add(board);

    // ================= 2. Migraine Trigger Lab (north-east, 10A) =================
    sign('MIGRAINE TRIGGER LAB', 'Test each station · find 3 triggers', 6.0, 2.55, -6.97, 0, 2.2, '#5a2a6a');
    const labMark = floorMark(scene, 6.1, -4.2, 7.4, 5.0, 0x9a6ad8); labMark.material.opacity = 0.12;
    const ivan = makePerson(LOOKS.crewC); ivan.root.position.set(6.0, 0, -3.4); ivan.root.rotation.y = Math.PI * 0.85; scene.add(ivan.root); player.addBox(5.75, 6.25, -3.65, -3.15, 0, 1.8);
    const trigObj = {}, lamps = {};
    const table = (x, z) => { const g = new THREE.Group(); box(0.9, 0.05, 0.6, std(0xd9dce2), 0, 0.78, 0, g); for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(0.025, 0.025, 0.78, MAT.metal(0x9aa3b2), sx * 0.4, 0.39, sz * 0.25, g, 8); station(g, x, z); player.addBox(x - 0.45, x + 0.45, z - 0.3, z + 0.3, 0, 0.85); return g; };
    { // flickering tube light on a test frame
      const t = TRIG[0], g = new THREE.Group(); for (const sx of [-0.6, 0.6]) cyl(0.03, 0.03, 2.2, MAT.metal(0x8a8f99), sx, 1.1, 0, g, 8); box(1.3, 0.06, 0.1, dark, 0, 2.2, 0, g);
      const tube = box(1.1, 0.06, 0.06, MAT.glow(0xdde8ff, 0.1), 0, 2.12, 0, g); const pl = new THREE.PointLight(0xe8f0ff, 0, 5, 1.5); pl.position.set(0, 1.9, 0.4); g.add(pl); hitBox(g, 1.3, 2.2, 0.3, 0, 1.1, 0);
      station(g, ...t.at); player.addBox(t.at[0] - 0.7, t.at[0] + 0.7, t.at[1] - 0.12, t.at[1] + 0.12, 0, 2.3); trigObj.flicker = g; g.userData.tube = tube; g.userData.pl = pl; }
    { // loudspeaker on a stand
      const t = TRIG[1], g = new THREE.Group(); cyl(0.03, 0.18, 1.0, dark, 0, 0.5, 0, g, 10); box(0.42, 0.6, 0.34, std(0x1a1d24), 0, 1.3, 0, g);
      const cone = cyl(0.13, 0.13, 0.02, std(0x3a3f4a), 0, 1.42, 0.175, g, 18); cone.rotation.x = Math.PI / 2; const tw = cyl(0.07, 0.07, 0.02, std(0x3a3f4a), 0, 1.18, 0.175, g, 18); tw.rotation.x = Math.PI / 2;
      station(g, ...t.at); player.addBox(t.at[0] - 0.25, t.at[0] + 0.25, t.at[1] - 0.25, t.at[1] + 0.25, 0, 1.7); trigObj.noise = g; g.userData.cone = cone; }
    { // solvent bottle on a table
      const t = TRIG[2]; table(...t.at); const g = new THREE.Group(); cyl(0.07, 0.08, 0.26, std(0xffd23a, { roughness: 0.4 }), 0, 0.13, 0, g, 14); cyl(0.03, 0.03, 0.06, std(0xc8202a), 0, 0.29, 0, g, 10); box(0.1, 0.08, 0.005, std(0x111111), 0, 0.13, 0.08, g); hitBox(g, 0.3, 0.36, 0.3, 0, 0.16, 0); g.position.set(t.at[0], 0.805, t.at[1]); scene.add(g); trigObj.smell = g;
      const mist = new THREE.Group(); for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshBasicMaterial({ color: 0xc8e090, transparent: true, opacity: 0 })); s.userData.ph = i / 9; mist.add(s); } fxLayer(mist); mist.traverse(o => { o.userData.noBlock = true; }); mist.position.set(t.at[0], 1.0, t.at[1]); scene.add(mist); g.userData.mist = mist; }
    { // night-shift bunk with an alarm clock
      const t = TRIG[3], g = new THREE.Group(); box(0.9, 0.35, 2.0, std(0x4a5a7a), 0, 0.175, 0, g); box(0.85, 0.12, 1.9, std(0xe8ecf2), 0, 0.41, 0, g); box(0.6, 0.1, 0.35, white, 0, 0.52, -0.75, g);
      box(0.18, 0.1, 0.08, std(0x1a1d24), 0.3, 0.52, 0.85, g); const face = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.07), MAT.glow(0xff4a3a, 0.2)); face.position.set(0.3, 0.52, 0.891); g.add(face); g.userData.face = face;
      station(g, t.at[0], t.at[1]); player.addBox(t.at[0] - 0.45, t.at[0] + 0.45, t.at[1] - 1.0, t.at[1] + 1.0, 0, 0.6); trigObj.sleep = g; }
    { // potted basil and a warm desk lamp (both harmless), on a shared table
      table(9.2, -2.4); const p = new THREE.Group(); cyl(0.1, 0.08, 0.16, std(0xa0522d), 0, 0.08, 0, p, 14); for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), std(0x3a8a3a)); l.scale.set(1, 0.5, 1.4); l.position.set(Math.cos(i * 2.4) * 0.07, 0.2 + (i % 3) * 0.05, Math.sin(i * 2.4) * 0.07); p.add(l); } hitBox(p, 0.26, 0.34, 0.26, 0, 0.17, 0); p.position.set(9.2, 0.805, -2.75); scene.add(p); trigObj.plant = p;
      const L = new THREE.Group(); cyl(0.07, 0.08, 0.03, dark, 0, 0.015, 0, L, 14); cyl(0.012, 0.012, 0.35, MAT.metal(0x9aa3b2), 0, 0.19, 0, L, 8); const shade = cyl(0.06, 0.12, 0.12, std(0xf2e2c0, { roughness: 0.8 }), 0, 0.38, 0, L, 16); const wl = new THREE.PointLight(0xffd8a0, 0, 3, 1.6); wl.position.set(0, 0.3, 0); L.add(wl); hitBox(L, 0.26, 0.46, 0.26, 0, 0.23, 0); L.position.set(9.2, 0.805, -2.05); scene.add(L); trigObj.lamp = L; L.userData.pl = wl; L.userData.shade = shade; }
    // a small indicator light on each station: green = trigger identified, blue = correctly judged harmless
    for (const t of TRIG) { const o = trigObj[t.id]; const b = new THREE.Box3().setFromObject(o); const l = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), MAT.glow(0x444444, 0.1)); l.position.set((b.min.x + b.max.x) / 2, b.max.y + 0.12, (b.min.z + b.max.z) / 2); l.userData.noBlock = true; scene.add(l); lamps[t.id] = l; }
    const setLamp = (id) => { const ok = state.trig[id] === 'ok', t = TRIG.find(x => x.id === id), col = !ok ? 0x444444 : t.trigger ? 0x3fe0a0 : 0x5aa8ff; lamps[id].material.color.set(col); lamps[id].material.emissive.set(col); lamps[id].material.emissiveIntensity = ok ? 1.8 : 0.1; };
    const found = () => TRIG.filter(t => t.trigger && state.trig[t.id] === 'ok').length;
    const trigReadout = () => hud.setReadout('Migraine triggers', [['Triggers found', `${found()} / 3`, found() >= 3 ? 'good' : ''], ...TRIG.filter(t => state.trig[t.id] === 'ok').map(t => [t.name, t.trigger ? '⚠ trigger' : '✓ harmless', t.trigger ? 'warn' : 'good'])]);
    let demo = null; // the station currently being demonstrated: { id, t, dur }
    async function testStation(t) {
      if (demo) return; await lightWarning(); input.releaseLock();
      demo = { id: t.id, t: 0, dur: 3.6 }; hud.cap(t.cap, 4200); trigReadout();
      if (t.id === 'noise') sfx.loud(3.0); else if (t.id === 'flicker') sfx.hum(true); else if (t.id === 'smell') setTimeout(() => sfx.cough(), 900); else if (t.id === 'sleep') sfx.alarm(); else sfx.ui();
      if (fxOff()) hud.flash({ flicker: 'Effect (described): the light pulses and glares; the room feels too bright to look at.', noise: 'Effect (described): the noise is harsh and loud; the view shakes a little.', smell: 'Effect (described): a chemical haze; it is hard to think clearly.', sleep: 'Effect (described): everything feels heavy, dim and slow.', plant: 'Effect (described): a mild, pleasant smell. Nothing changes.', lamp: 'Effect (described): soft, steady warm light. Nothing uncomfortable.' }[t.id], '', 3800);
      await new Promise(r => setTimeout(r, 3700));
      const ans = await pickOne({ title: `${t.name}: migraine trigger?`, cancel: false, intro: `You saw how Ivan reacted. Is the ${t.name.toLowerCase()} a common migraine trigger?`, options: [{ id: 'yes', icon: '⚠', name: 'Yes, it is a migraine trigger' }, { id: 'no', icon: '✅', name: 'No, it is harmless' }] });
      const right = (ans === 'yes') === t.trigger;
      if (right) { state.trig[t.id] = 'ok'; sfx.good(); hud.flash((t.trigger ? '✓ Correct: a trigger. ' : '✓ Correct: harmless. ') + t.why, 'good', 6000); }
      else { sfx.wrong(); ctx.mistake(`Trigger lab: misjudged the ${t.name.toLowerCase()}.`); hud.flash('✗ Not quite. ' + t.why + ' Test it again and decide again.', 'bad', 6500); }
      setLamp(t.id); trigReadout(); ctx.refreshObjectives();
      if (found() >= 3 && ctx.done('triggers')) { hud.flash('Three migraine triggers identified! Next: the Light Sensitivity Sim (south-east desk).', 'good', 4500); setTimeout(() => { if (ctx.current()?.id !== 'triggers') hud.setReadout(null); }, 4600); }
    }
    for (const t of TRIG) { makeUsable(trigObj[t.id], { label: t.name, verb: t.verb, range: 2.6, enabled: () => ctx.isDone('baseline') && !ctx.isDone('triggers') && !demo && state.trig[t.id] !== 'ok', use: () => testStation(t) }); ix.add(trigObj[t.id]); setLamp(t.id); }
    function demoStep(dt) {
      if (!demo) return; demo.t += dt; const t = TRIG.find(x => x.id === demo.id), k = Math.min(1, demo.t / 0.6) * Math.min(1, Math.max(0, (demo.dur - demo.t) / 0.6));
      const slow = fxOff() ? 0 : 0.5 + 0.5 * Math.sin(demo.t * Math.PI * 2 * 0.9); // under 1 slow pulse per second
      if (t.id === 'flicker') { const g = trigObj.flicker, i = k * (0.55 + 0.45 * slow); g.userData.pl.intensity = 8 * i; g.userData.tube.material.emissiveIntensity = 0.3 + 2.2 * i; setFx('glare', 0.55 * i); }
      if (t.id === 'noise') { shake = fxOff() || settings.reducedMotion ? 0 : 0.006 * k; setFx('vignette', 0.35 * k); trigObj.noise.userData.cone.scale.setScalar(1 + 0.08 * Math.sin(demo.t * 30) * k); }
      if (t.id === 'smell') { setFx('haze', 0.7 * k); trigObj.smell.userData.mist.children.forEach(s => { const p = (s.userData.ph + demo.t * 0.25) % 1; s.position.set(Math.sin(s.userData.ph * 9) * 0.6 * p, p * 1.2, Math.cos(s.userData.ph * 7) * 0.6 * p); s.scale.setScalar(0.5 + p * 2); s.material.opacity = 0.3 * k * (1 - p); }); }
      if (t.id === 'sleep') { setFx('vignette', 0.75 * k); setFx('blur', 0.6 * k); trigObj.sleep.userData.face.material.emissiveIntensity = 0.3 + 1.5 * k; }
      if (t.id === 'lamp') { trigObj.lamp.userData.pl.intensity = 3 * k; trigObj.lamp.userData.shade.material.emissive?.set(0xffc880); trigObj.lamp.userData.shade.material.emissiveIntensity = 0.6 * k; }
      ivan.holdHeadTarget = (t.react === 'head' || t.react === 'ears') && k > 0.2 ? 1 : 0;
      if (t.react === 'cough' && k > 0.3 && Math.floor(demo.t * 1.2) !== Math.floor((demo.t - dt) * 1.2)) ivan.cough = 0.5;
      if (demo.t >= demo.dur) { demo = null; shake = 0; clearFx(); ivan.holdHeadTarget = 0; trigObj.flicker.userData.pl.intensity = 0; trigObj.flicker.userData.tube.material.emissiveIntensity = 0.1; trigObj.lamp.userData.pl.intensity = 0; trigObj.smell.userData.mist.children.forEach(s => s.material.opacity = 0); }
    }

    // ================= 3. Light Sensitivity Sim (south-east, 10B) =================
    sign('LIGHT SENSITIVITY SIM', 'Find the glare · fix the light', 6.5, 2.6, 6.97, Math.PI, 2.0, '#1e2a52');
    const LZ = { x0: 3.2, x1: 10, z0: 1.6, z1: 7 }, inLight = () => player.pos.x > LZ.x0 && player.pos.x < LZ.x1 && player.pos.z > LZ.z0 && player.pos.z < LZ.z1;
    const lzMark = floorMark(scene, 6.6, 4.3, 6.6, 5.2, 0x5ad8ff); lzMark.material.opacity = 0.08;
    const desk = new THREE.Group(); box(1.6, 0.05, 0.75, std(0xd9dce2), 0, 0.75, 0, desk); for (const sx of [-0.75, 0.75]) box(0.05, 0.75, 0.7, grey, sx, 0.375, 0, desk); station(desk, 6.5, 4.9); player.addBox(5.7, 7.3, 4.52, 5.28, 0, 0.8);
    const chair = new THREE.Group(); box(0.5, 0.06, 0.5, dark, 0, 0.48, 0, chair); box(0.5, 0.5, 0.06, dark, 0, 0.75, 0.25, chair); cyl(0.03, 0.03, 0.45, MAT.metal(), 0, 0.24, 0, chair, 8); station(chair, 6.5, 4.0, Math.PI);
    const LO = {};
    { // overhead tube
      const g = new THREE.Group(); box(1.4, 0.08, 0.25, dark, 0, 0, 0, g); const tube = box(1.25, 0.05, 0.06, MAT.glow(0xdde8ff, 1.6), 0, -0.06, 0, g); const pl = new THREE.PointLight(0xe8f0ff, 6, 6, 1.4); pl.position.y = -0.3; g.add(pl);
      hitBox(g, 1.5, 0.4, 0.5); g.position.set(6.5, 3.0, 4.6); scene.add(g); LO.tube = g; g.userData.tube = tube; g.userData.pl = pl; }
    { // window with sunlight and a roller blind, east wall
      const g = new THREE.Group(); box(0.08, 1.5, 1.7, std(0xe8ebf0), 0, 0, 0, g); const sun = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.2), MAT.glow(0xfff4d0, 2.2)); sun.rotation.y = -Math.PI / 2; sun.position.x = -0.05; g.add(sun);
      const blind = box(0.04, 1.2, 1.45, std(0xd8d0c0, { roughness: 0.9 }), -0.08, 0.6, 0, g); blind.geometry.translate(0, -0.6, 0); blind.position.y = 0.66; blind.scale.y = 0.06; const roll = cyl(0.04, 0.04, 1.5, std(0xcfc6b4), -0.09, 0.66, 0, g, 10); roll.rotation.x = Math.PI / 2;
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.4, 4, 4, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.12, side: THREE.DoubleSide })); beam.rotation.z = Math.PI / 2 - 0.45; beam.rotation.y = Math.PI / 4; beam.position.set(-1.7, -0.6, 0); g.add(beam); fxLayer(beam); beam.userData.noBlock = true;
      const sl = new THREE.SpotLight(0xfff0d0, 30, 9, 0.6, 0.5, 1.2); sl.position.set(-0.2, 0.3, 0); sl.target.position.set(-4, -1.6, 0); g.add(sl, sl.target);
      g.position.set(9.95, 1.65, 4.8); scene.add(g); LO.window = g; Object.assign(g.userData, { sun, blind, beam, sl }); }
    { // monitor on the desk
      const g = makeScreen(0.72, 0.44, infoScreen('MISSION LOG', ['Brightness: 100%', ['Contrast: maximum', '#ff6a6a']], { w: 384, hgt: 240 }), [384, 240]); g.position.set(6.5, 1.06, 5.1); g.rotation.y = Math.PI; scene.add(g);
      cyl(0.02, 0.02, 0.2, dark, 0, -0.3, 0, g, 8); LO.screen = g; worldUI(g); }
    { // glossy whiteboard, south wall
      const g = new THREE.Group(); const wb = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), std(0xffffff, { roughness: 0.05, metalness: 0.2 })); g.add(wb);
      const spot = new THREE.Mesh(new THREE.CircleGeometry(0.22, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })); spot.position.set(0.4, 0.15, 0.005); g.add(spot);
      const cover = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), std(0xb8c4b0, { roughness: 1 })); cover.position.z = 0.01; cover.visible = false; g.add(cover);
      g.position.set(4.6, 1.5, 6.96); g.rotation.y = Math.PI; scene.add(g); worldUI(g); LO.board = g; Object.assign(g.userData, { spot, cover }); }
    // a warm, steady floor lamp (not a problem: the decoy)
    const floorLamp = new THREE.Group(); cyl(0.15, 0.18, 0.04, dark, 0, 0.02, 0, floorLamp, 16); cyl(0.015, 0.015, 1.5, MAT.metal(), 0, 0.77, 0, floorLamp, 8); cyl(0.12, 0.2, 0.25, std(0xf2e2c0, { emissive: 0xffc880, emissiveIntensity: 0.5 }), 0, 1.55, 0, floorLamp, 18);
    const flp = new THREE.PointLight(0xffd8a0, 2.5, 4, 1.6); flp.position.y = 1.4; floorLamp.add(flp); hitBox(floorLamp, 0.4, 1.7, 0.4, 0, 0.85, 0); station(floorLamp, 3.8, 6.4); player.addBox(3.6, 4.0, 6.2, 6.6, 0, 1.7);
    const discomfort = () => LIGHT.reduce((s, L) => s + (state.light[L.id] ? 0 : L.weight), 0);
    const applyLight = (id) => {
      const on = !state.light[id];
      if (id === 'tube') { LO.tube.userData.tube.material.color.set(on ? 0xdde8ff : 0xfff2e0); LO.tube.userData.tube.material.emissive.set(on ? 0xdde8ff : 0xfff2e0); LO.tube.userData.pl.intensity = on ? 6 : 4; LO.tube.userData.pl.color.set(on ? 0xe8f0ff : 0xfff0dc); }
      if (id === 'window') { LO.window.userData.blind.scale.y = on ? 0.06 : 1; LO.window.userData.beam.visible = on; LO.window.userData.sl.intensity = on ? 30 : 0; LO.window.userData.sun.material.emissiveIntensity = on ? 2.2 : 0.3; }
      if (id === 'screen') LO.screen.userData.screen?.redraw?.(infoScreen('MISSION LOG', on ? ['Brightness: 100%', ['Contrast: maximum', '#ff6a6a']] : ['Brightness: 40% · night mode', ['Comfortable ✓', '#3fe0a0']], { w: 384, hgt: 240, accent: on ? '#ffffff' : '#ffb347' }));
      if (id === 'board') { LO.board.userData.spot.visible = on; LO.board.userData.cover.visible = !on; }
    };
    for (const L of LIGHT) {
      makeUsable(LO[L.id], { label: L.name, verb: L.fix + ':', range: 4.5, enabled: () => ctx.current()?.id === 'light' && !state.light[L.id], use: () => {
        state.light[L.id] = true; applyLight(L.id); sfx.click(); hud.flash(`✓ ${L.done} Discomfort now ${discomfort()}%.`, 'good', 3500);
        if (L.id === 'tube') sfx.hum(false);
        if (discomfort() <= 15 && ctx.done('light')) { clearFx(); hud.setReadout(null); setTimeout(() => ctx.talk([{ who: 'Dr. Hart', text: 'That\'s it. You found the causes: flicker, direct sunlight and a glaring screen. For someone with light sensitivity, steady warm light, blinds and a dimmer screen make the difference between a good day and a migraine.' }, { who: 'Dr. Hart', text: 'On the station, crews use adjustable LED lights for the same reason: steady, tunable light helps comfort and sleep. Next, the Hydration Challenge by the water dispenser.' }]), 400); }
      } }); ix.add(LO[L.id]);
    }
    makeUsable(floorLamp, { label: 'Warm floor lamp', verb: 'Switch off', range: 3, enabled: () => ctx.current()?.id === 'light', use: () => { sfx.wrong(); ctx.mistake('Light sim: switched off the soft, steady lamp instead of a glare source.'); hud.flash('That lamp gives soft, steady, warm light: it is not causing the glare, and you need some light to work. Look for flicker, direct sunlight and harsh brightness.', 'bad', 5500); } }); ix.add(floorLamp);
    LIGHT.forEach(L => applyLight(L.id));
    let lightT = 0, lightCap = 0;
    function lightStep(dt) {
      if (ctx.current()?.id !== 'light') return;
      if (!inLight()) { clearFx(); hud.setReadout('Light discomfort', [['Sim area', 'south-east corner', '']]); return; }
      if (!state.fxWarned) { lightWarning(); return; }
      lightT += dt; const d = discomfort() / 100, pulse = !fxOff() && !state.light.tube ? 0.08 * Math.sin(lightT * Math.PI * 2 * 0.5) : 0;
      setFx('glare', 0.55 * d + pulse); setFx('blur', Math.max(0, d - 0.55) * 1.1); // capped: soft glare, mild blur, 0.5 Hz pulse at most setFx('vignette', 0.3 * d);
      if (!state.light.tube) { LO.tube.userData.pl.intensity = 6 + 2 * Math.sin(lightT * Math.PI * 2 * 0.5); if ((lightT % 4) < dt) sfx.hum(true); }
      fxEl.glare.style.setProperty('--gx', !state.light.window ? '85%' : '50%');
      hud.setReadout('Light discomfort', [['Discomfort', `${Math.round(d * 100)}%`, d > 0.5 ? 'bad' : d > 0.15 ? 'warn' : 'good'], ...LIGHT.map(L => [L.name, state.light[L.id] ? 'fixed ✓' : '?', state.light[L.id] ? 'good' : ''])]);
      if ((lightCap -= dt) <= 0) { lightCap = 6; hud.cap(d > 0.5 ? '[You squint. The glare makes your eyes water and the screen hard to read.]' : '[Better, but something still glares.]', 3500); }
    }

    // ================= 4. Hydration Challenge (south wall, 10C) =================
    sign('HYDRATION STATION', 'Goal: 100%', -1.6, 2.6, 6.97, Math.PI, 1.4, '#1f5a7a');
    const counter = new THREE.Group(); box(2.6, 0.9, 0.6, std(0xd9dce2), 0, 0.45, 0, counter); station(counter, -2.8, 6.6); player.addBox(-4.1, -1.5, 6.3, 7, 0, 1);
    const disp = new THREE.Group(); box(0.4, 1.1, 0.4, white, 0, 0.55, 0, disp); cyl(0.17, 0.17, 0.45, new THREE.MeshStandardMaterial({ color: 0x8ac8f0, transparent: true, opacity: 0.55, roughness: 0.1 }), 0, 1.33, 0, disp, 18); box(0.08, 0.05, 0.06, std(0x2b6ad8), 0, 0.9, 0.22, disp); box(0.3, 0.02, 0.2, grey, 0, 0.62, 0.12, disp);
    station(disp, -0.6, 6.7); player.addBox(-0.82, -0.38, 6.48, 7, 0, 1.6);
    const btable = new THREE.Group(); box(0.6, 0.05, 0.5, std(0xd9dce2), 0, 0.75, 0, btable); cyl(0.03, 0.03, 0.75, MAT.metal(), 0, 0.375, 0, btable, 8); station(btable, 0.6, 6.6); player.addBox(0.3, 0.9, 6.35, 6.85, 0, 0.8);
    const bottle = new THREE.Group();
    const shellM = new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.35, roughness: 0.1, depthWrite: false });
    cyl(0.04, 0.04, 0.22, shellM, 0, 0.11, 0, bottle, 16); cyl(0.022, 0.022, 0.035, std(0x2b6ad8), 0, 0.24, 0, bottle, 12);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.2, 16), new THREE.MeshStandardMaterial({ color: 0x3a9ad8, roughness: 0.2 })); water.geometry.translate(0, 0.1, 0); water.position.y = 0.01; bottle.add(water);
    bottle.position.set(0.6, 0.775, 6.6); scene.add(bottle);
    carry.makeCarriable(bottle, { id: 'bottle', name: 'Water bottle', stow: false, hold: { rot: [0, 0, 0], pos: DRINK_HOLD, big: false } });
    const coffee = new THREE.Group(); box(0.3, 0.42, 0.3, std(0x1a1d24), 0, 0.21, 0, coffee); box(0.1, 0.06, 0.03, MAT.glow(0xffb347, 0.8), 0, 0.33, 0.16, coffee); cyl(0.04, 0.035, 0.08, white, 0, 0.06, 0.1, coffee, 12); coffee.position.set(-3.6, 0.9, 6.55); coffee.rotation.y = Math.PI; scene.add(coffee);
    const crisps = new THREE.Group(); cyl(0.14, 0.09, 0.08, std(0x3a6ea5), 0, 0.04, 0, crisps, 18); for (let i = 0; i < 8; i++) { const c = new THREE.Mesh(new THREE.CircleGeometry(0.035, 8), std(0xf2c85a, { side: THREE.DoubleSide })); c.position.set(Math.cos(i) * 0.06, 0.085, Math.sin(i * 1.7) * 0.06); c.rotation.set(-Math.PI / 2 + Math.sin(i) * 0.4, 0, i); crisps.add(c); } hitBox(crisps, 0.3, 0.16, 0.3, 0, 0.06, 0); crisps.position.set(-2.4, 0.9, 6.55); scene.add(crisps);
    const bike = new THREE.Group(); box(0.12, 0.08, 1.1, dark, 0, 0.04, 0, bike); cyl(0.04, 0.04, 0.8, dark, 0, 0.45, 0.3, bike, 8); box(0.26, 0.06, 0.3, std(0x1a1d24), 0, 0.88, 0.3, bike); cyl(0.04, 0.04, 0.9, dark, 0, 0.5, -0.35, bike, 8); box(0.5, 0.04, 0.05, dark, 0, 0.96, -0.38, bike); const wheel = cyl(0.25, 0.25, 0.06, std(0x3a3f4a), 0, 0.3, -0.35, bike, 20); wheel.rotation.z = Math.PI / 2;
    hitBox(bike, 0.5, 1.0, 1.2, 0, 0.5, 0); station(bike, 2.1, 5.7); player.addBox(1.9, 2.3, 5.1, 6.3, 0, 1);
    const meter = h('div', { class: 'cx-meters', hidden: true }), mBox = h('div', { class: 'cx-meter glass', role: 'meter', 'aria-label': 'Hydration' }), mHead = h('b', {}), mBar = h('div', { class: 'cx-bar' }, h('i')), mNote = h('small', { class: 'muted' });
    mBox.append(mHead, mBar, mNote); meter.append(mBox); hud.root.append(meter);
    const H = () => state.hyd || (state.hyd = { lvl: HYD.start, fill: 0, coffee: 0, diuretic: 0, warned: false });
    function drawMeter() {
      const s = H(), v = Math.round(s.lvl), cls = v < HYD.warn ? 'bad' : v < 50 ? 'warn' : '';
      mHead.textContent = ''; mHead.append(h('span', {}, '💧 Hydration'), h('span', {}, `${v}% / ${HYD.goal}%`)); mBox.setAttribute('aria-valuenow', v);
      const bar = mBar.firstChild; bar.style.width = `${Math.min(100, v)}%`; bar.style.background = v < HYD.warn ? '#ff6a6a' : v < 50 ? '#ffb347' : '#5ad8ff';
      mBox.className = `cx-meter glass ${cls}`;
      mNote.textContent = `Bottle: ${s.fill ? `${s.fill}/${HYD.sips} sips` : 'empty'}${s.diuretic > 0 ? ' · ☕ caffeine: losing water faster' : ''}${v < HYD.warn ? ' · ⚠ dehydrated' : ''}`;
      water.scale.y = Math.max(0.001, s.fill / HYD.sips); water.visible = s.fill > 0;
    }
    const bump = (d, why, kind = '') => { const s = H(); s.lvl = Math.max(0, Math.min(100, s.lvl + d)); if (why) hud.flash(why, kind, 4000); drawMeter(); checkHyd(); };
    function checkHyd() {
      const s = H();
      if (s.lvl < HYD.warn && !s.warned) { s.warned = true; sfx.wrong(); hud.flash('⚠ Dehydration warning: headache, tiredness and poor focus are early signs. Drink some water!', 'bad', 4500); }
      if (s.lvl >= HYD.warn + 8) s.warned = false;
      if (s.lvl >= HYD.goal && ctx.current()?.id === 'hydrate' && ctx.done('hydrate')) { hud.flash('💧 Goal reached: fully hydrated! Next: Commander Arden in the lunar habitat sim (south-west).', 'good', 5000); setTimeout(() => { meter.hidden = true; }, 5000); }
    }
    const hydActive = () => ctx.current()?.id === 'hydrate';
    makeUsable(disp, { label: 'Water dispenser', verb: 'Fill the bottle at the', range: 2.4, enabled: () => hydActive() && carry.held === bottle && H().fill < HYD.sips, use: () => { sfx.pour(); hud.cap('[Glug glug: the bottle fills up]', 1500); const s = H(); const from = s.fill; let t = 0; const id = setInterval(() => { t += 0.1; s.fill = Math.min(HYD.sips, Math.round(from + (HYD.sips - from) * Math.min(1, t))); drawMeter(); if (t >= 1) clearInterval(id); }, 100); } }); ix.add(disp);
    makeUsable(coffee, { label: 'Coffee machine', verb: 'Drink a coffee from the', range: 2.4, enabled: () => hydActive(), use: () => { const s = H(); s.coffee++; sfx.pour(); s.diuretic = 25;
      if (s.coffee === 1) bump(3, '☕ One coffee is fine and counts a little towards your fluids, but caffeine makes you lose water faster for a while.', '');
      else { ctx.mistake('Hydration: drank several coffees instead of water.'); bump(-6, '☕ Too much caffeine! It makes you lose more water, and too much caffeine (or suddenly stopping it) can also trigger migraines.', 'bad'); } } }); ix.add(coffee);
    makeUsable(crisps, { label: 'Salty crisps', verb: 'Eat some', range: 2.4, enabled: () => hydActive(), use: () => { sfx.paper(); bump(-6, '🧂 Salty snacks make your body hold on to salt and make you thirstier. Hydration down.', 'bad'); } }); ix.add(crisps);
    let biking = 0;
    makeUsable(bike, { label: 'Exercise bike', verb: 'Do a 6-second sprint on the', range: 2.4, enabled: () => hydActive() && !biking, use: () => { biking = 6; player.frozenByScene = true; hud.flash('🚴 Pedal! Exercise makes you sweat, and sweat is water you need to replace.', '', 3500); } }); ix.add(bike);
    let sipCD = 0, drinkT = 0;
    // A sip lifts the bottle up to the mouth, tips it towards you and brings it back down (the hands follow the bottle).
    const DRINK_T = 0.75;
    function drinkPose(dt) {
      const hold = carry.hold; if (!hold) return;
      if (carry.held !== bottle) { if (drinkT) { drinkT = 0; hold.rotation.set(0, 0, 0); } return; }
      drinkT = Math.max(0, drinkT - dt);
      const k = drinkT > 0 ? Math.sin(Math.PI * (1 - drinkT / DRINK_T)) : 0;
      hold.position.set(DRINK_HOLD[0] - 0.17 * k, DRINK_HOLD[1] + 0.2 * k, DRINK_HOLD[2] + 0.2 * k);
      hold.rotation.set(1.25 * k, 0, 0);
    }
    function hydStep(dt, blocked) {
      drinkPose(dt);
      if (!hydActive()) { if (input.touchButtons?.spray) input.touchButtons.spray.hidden = true; return; }
      meter.hidden = false; const s = H(); sipCD -= dt;
      if (input.touchButtons?.spray) input.touchButtons.spray.hidden = carry.held !== bottle;
      if (blocked) return;
      const rate = biking > 0 ? 2.5 : HYD.decay * (s.diuretic > 0 ? 3 : 1); // a 6 s sprint costs about 15%
      s.lvl = Math.max(0, s.lvl - rate * dt); s.diuretic = Math.max(0, s.diuretic - dt);
      if (biking > 0) { biking -= dt; wheel.rotation.x += dt * 14; if (biking <= 0) { biking = 0; player.frozenByScene = false; hud.flash('Sprint done. You sweated out a lot of water: drink to replace it.', '', 3500); } }
      if (carry.held === bottle && input.hit('spray') && sipCD <= 0) {
        sipCD = 0.8;
        if (s.fill <= 0) { sfx.wrong(); hud.flash('The bottle is empty. Fill it at the water dispenser.', '', 2500); }
        else { s.fill--; sfx.gulp(); drinkT = DRINK_T; bump(HYD.sip, null); hud.cap('[Gulp]', 800); }
      }
      if (Math.random() < dt * 2) drawMeter(); checkHyd();
      if (!demo) setFx('vignette', s.lvl < HYD.warn ? 0.35 * (1 - s.lvl / HYD.warn) : 0);
    }

    // ================= 5. Lunar habitat sim with Commander Arden (south-west, 10D) =================
    box(0.08, 2.4, 3.6, std(0x9aa3b2), -4.6, 1.2, 5.2, scene); player.addBox(-4.66, -4.54, 3.4, 7, 0, 2.5);
    sign('LUNAR HABITAT SIM', 'Medical scenario', -4.55, 2.0, 4.6, Math.PI / 2, 1.4, '#1e2a52');
    const habMark = floorMark(scene, -7.3, 4.6, 5.2, 4.6, 0x8a90a0); habMark.material.opacity = 0.1;
    const cot = new THREE.Group(); box(0.8, 0.32, 1.9, std(0x5a6e8c), 0, 0.16, 0, cot); box(0.78, 0.08, 1.85, std(0xe8ecf2), 0, 0.36, 0, cot); box(0.5, 0.08, 0.3, white, 0, 0.44, -0.75, cot); station(cot, -8.8, 4.8); player.addBox(-9.2, -7.95, 3.85, 5.75, 0, 0.6);
    // Arden sits on the edge of the cot (sit pose, feet on the floor): no floating, no clipping, her whole body visible
    const arden = makePerson(LOOKS.commander); arden.root.position.set(-8.7, 0, 4.8); /* hips over the mattress, knees just past the cot edge */ arden.root.rotation.y = Math.PI / 2; arden.sit = arden.sitTarget = 1; scene.add(arden.root);
    arden.holdHeadTarget = ctx.isDone('scenario') || state.scen.fixed ? 0 : 1;
    const co2Hi = 4800 + Math.floor(Math.random() * 1200); let co2 = state.scen.fixed ? 900 : co2Hi;
    const mon = makeScreen(0.7, 0.44, infoScreen('HABITAT', ['CO₂: —', 'Pressure: —'], { w: 384, hgt: 256 }), [384, 256]); mon.position.set(-9.95, 1.6, 3.0); mon.rotation.y = Math.PI / 2; scene.add(mon); worldUI(mon);
    const drawMon = () => mon.userData.screen.redraw(infoScreen('HABITAT', [[`CO₂: ${Math.round(co2)} ppm${co2 > 2500 ? '  ⚠ HIGH' : '  ✓'}`, co2 > 2500 ? '#ff6a6a' : '#3fe0a0'], 'Pressure: 10.2 psi', 'O₂: 21.1%', state.scen.fixed ? ['Scrubber: running ✓', '#3fe0a0'] : ['Scrubber: fan fault', '#ffb347']], { w: 384, hgt: 256 }));
    const scrub = new THREE.Group(); box(0.6, 1.3, 0.5, std(0xc8ccd4), 0, 0.65, 0, scrub); const grille = cyl(0.18, 0.18, 0.04, std(0x2a2d33), 0, 0.9, 0.26, scrub, 20); grille.rotation.x = Math.PI / 2;
    const fan = new THREE.Group(); fan.position.set(0, 0.9, 0.29); scrub.add(fan); for (let i = 0; i < 4; i++) { const b = box(0.04, 0.15, 0.01, std(0x9aa3b2), 0, 0, 0, fan); b.rotation.z = i * Math.PI / 2; b.position.set(Math.sin(i * Math.PI / 2) * 0.07, Math.cos(i * Math.PI / 2) * 0.07, 0); }
    const fault = box(0.06, 0.06, 0.02, MAT.glow(state.scen.fixed ? 0x3fe0a0 : 0xff4a3a, 1.5), 0.2, 1.2, 0.26, scrub);
    station(scrub, -9.55, 6.55, Math.PI / 2); player.addBox(-9.85, -9.25, 6.25, 6.85, 0, 1.4);
    let talking = false;
    makeUsable(arden.root, { label: 'Commander Arden', verb: 'Help', range: 2.6, enabled: () => ctx.isDone('hydrate') && !ctx.isDone('scenario') && !talking, use: () => scenario() }); ix.add(arden.root);
    makeUsable(mon, { label: 'Habitat monitor', verb: 'Check', range: 2.8, enabled: () => ctx.isDone('hydrate') && !state.scen.co2, use: () => { state.scen.co2 = true; sfx.ui(); drawMon(); hud.flash(`CO₂ is ${co2Hi} ppm, far above the normal limit of about 2,500. That could explain the headache! Talk to Arden again.`, 'bad', 5000); ctx.refreshObjectives(); } }); ix.add(mon);
    makeUsable(scrub, { label: 'CO₂ scrubber', verb: 'Swap the fan in the', range: 2.4, enabled: () => state.scen.plan && !state.scen.fixed, use: () => {
      state.scen.fixed = true; sfx.click(); setTimeout(() => sfx.hum(true), 300); fault.material.color.set(0x3fe0a0); fault.material.emissive.set(0x3fe0a0); drawMon();
      hud.flash('Fan swapped. The scrubber is running: watch the CO₂ fall on the monitor, then check on Arden.', 'good', 4000); ctx.refreshObjectives();
    } }); ix.add(scrub);
    async function scenario() {
      const S = state.scen; talking = true;
      try {
        if (!S.asked) {
          await ctx.talk([
            { who: `Commander Arden (${SCEN})`, text: 'Hey, {name}. I\'ve had a pounding headache since I came in from the spacewalk, and the room spins when I turn my head. Maybe it\'s nothing.' },
            { who: ctx.name, text: '(What do you do first?)', choices: [{ text: 'Keep her sitting and resting while you ask some questions', goto: 'rest' }, { text: 'Give her painkillers straight away', goto: 'pill' }, { text: 'Tell her to walk it off', goto: 'walk' }] },
            { id: 'pill', who: 'Dr. Hart (radio)', text: 'Hold on. Medicine comes after you understand what\'s happening, and on a mission only on the flight surgeon\'s advice. Make her safe and ask questions first.', do: () => ctx.mistake('Gave medicine before assessing the crewmate.'), goto: 'rest' },
            { id: 'walk', who: 'Dr. Hart (radio)', text: 'With dizziness she could fall. Keep her sitting.', do: () => ctx.mistake('Told a dizzy crewmate to keep moving.'), goto: 'rest' },
            { id: 'rest', who: 'Commander Arden', text: 'Okay, I\'ll stay sitting. What do you want to know?', choices: [{ text: 'Did you hit your head? Any nausea, blurry vision?', goto: 'q1' }, { text: 'What did you eat for breakfast?', goto: 'q0' }] },
            { id: 'q0', who: 'Commander Arden', text: 'Porridge... is that important? (Ask about injury and symptoms instead.)', do: () => ctx.mistake('Asked an unhelpful question during the assessment.'), goto: 'q1' },
            { id: 'q1', who: 'Commander Arden', text: 'No bump. A bit sick, no blurry vision. The headache got worse in here. Ivan felt a headache this morning too.' },
            { who: ctx.name, text: '(Two people with headaches in the same room. What might you check?)', choices: [{ text: 'Check the habitat CO₂ level on the monitor', goto: 'c1' }, { text: 'Nothing: headaches are normal in space', goto: 'c0' }] },
            { id: 'c0', who: 'Dr. Hart (radio)', text: 'Headaches are common up there, but two crew at once points to the air. Check the habitat readings.', do: () => ctx.mistake('Did not suspect the habitat air.'), goto: 'c1' },
            { id: 'c1', who: 'Dr. Hart (radio)', text: 'Go and check the monitor on the wall, then talk to her again.', do: () => { S.asked = true; ctx.refreshObjectives(); } }
          ]);
          return;
        }
        if (!S.co2) { hud.flash('Check the habitat monitor on the wall first.', '', 3000); return; }
        if (!S.plan) {
          await ctx.talk([
            { who: ctx.name, text: '(CO₂ is high. What now?)', choices: [{ text: 'Get fresh air from the next module, report to Mission Control, and fix the scrubber', goto: 'ok' }, { text: 'Open the outer hatch for fresh air', goto: 'bad' }] },
            { id: 'bad', who: 'Dr. Hart (radio)', text: 'On the Moon that would empty the habitat into a vacuum! Fresh air means another module with working life support.', do: () => ctx.mistake('Suggested opening the outer hatch on the Moon.'), goto: 'ok' },
            { id: 'ok', who: 'Mission Control (1.3 s delay)', text: '...Copy, habitat. Open the hatch to the Node for airflow and swap the scrubber fan. It\'s the grey unit in the corner. Flight surgeon wants her vitals every 15 minutes.', do: () => { S.plan = true; ctx.refreshObjectives(); } }]);
          hud.flash('Swap the fan in the CO₂ scrubber (grey unit in the corner).', '', 3500); return;
        }
        if (!S.fixed) { hud.flash('Swap the fan in the CO₂ scrubber first (grey unit in the corner).', '', 3000); return; }
        if (co2 > 2500) { await ctx.talk([{ who: 'Commander Arden', text: 'I can hear the fan. Let\'s wait for the CO₂ to come down a bit more.' }]); return; }
        await ctx.talk([
          { who: 'Commander Arden', text: 'The headache is easing already. Thanks, {name}. Good catch on the CO₂.' },
          { who: 'Dr. Hart', text: 'Excellent. High CO₂ causing headaches is a confirmed problem on spacecraft. The dizziness when turning her head could also be the inner ear readapting, which we\'d keep watching.', do: () => ctx.done('scenario') }]);
        hud.flash('Scenario complete. Take the knowledge check on the records terminal (north wall).', 'good');
      } finally { talking = false; }
    }
    makeUsable(rec, { label: 'Records terminal', verb: 'Use', range: 2.4, enabled: () => ctx.isDone('scenario') && !ctx.isDone('quiz'), use: async () => {
      input.releaseLock();
      const qs = [...QUIZ].sort(() => Math.random() - 0.5).slice(0, 5);
      const r = await runQuiz({ title: '🧠 Knowledge check', intro: 'Five questions. You need 3 or more to pass.', questions: qs });
      for (const w of r.wrong || []) ctx.mistake(`Quiz: ${w}`);
      if (r.correct < 3) { hud.flash(`${r.correct} of 5. Talk to Dr. Hart for hints and try again.`, 'bad', 4000); return; }
      ctx.done('quiz'); finish();
    } }); ix.add(rec);

    // ---------- restore after a reload ----------
    if (ctx.isDone('brief')) T.start();
    recScreen(); if (state.scen.co2) drawMon();
    if (ctx.current()?.id === 'triggers') trigReadout();
    if (state.hyd) drawMeter();
    const cam = new THREE.Vector3();
    return {
      spawn: [0, 3.5, 0, 0],
      markerFor: id => ({
        brief: doc.rig.root,
        baseline: !state.base.bp ? bp : !state.base.vision ? (onLane() ? eye : tape) : board,
        triggers: trigObj[TRIG.find(t => t.trigger && state.trig[t.id] !== 'ok')?.id] || ivan.root,
        light: LO[LIGHT.find(L => !state.light[L.id])?.id] || desk,
        hydrate: carry.held !== bottle ? bottle : H().fill ? null : disp,
        scenario: !state.scen.asked ? arden.root : !state.scen.co2 ? mon : !state.scen.plan ? arden.root : !state.scen.fixed ? scrub : arden.root,
        quiz: rec }[id] || null),
      onEnter: () => { if (!ctx.isDone('brief')) hud.flash('Talk to Dr. Hart to begin.', '', 3500); },
      defaultPrompt: () => carry.held === bottle && hydActive() ? { verb: H().fill ? 'Drink from' : 'Empty: fill it at the dispenser,', label: 'the water bottle', key: { action: 'spray' } } : null,
      test: { bal: () => [balOn, balT], hyd: () => H(), disc: () => discomfort(), co2: () => co2, demo: () => demo, bottle, arden, ivan, LANE, trigObj, LO },
      update(dt, blocked) {
        doc.update(dt); T.update(dt, blocked);
        world.camera.getWorldPosition(cam);
        const who = ctx.dlg.active ? (ctx.dlg.el.querySelector('.cx-who')?.textContent || '') : '';
        animatePerson(arden, dt, { lookAt: cam.distanceTo(arden.root.position) < 6 ? cam : null, talking: /Arden/.test(who) });
        animatePerson(ivan, dt, { lookAt: cam.distanceTo(ivan.root.position) < 6 ? cam : null, talking: false });
        demoStep(blocked ? 0 : dt); if (!demo) lightStep(blocked ? 0 : dt); hydStep(dt, blocked);
        if (shake && !blocked) { world.camera.rotation.z += Math.sin(performance.now() / 40) * shake; world.camera.rotation.x += Math.cos(performance.now() / 53) * shake; }
        // CO2 falls once the scrubber runs; Arden's headache eases with it
        if (state.scen.fixed && co2 > 900) { co2 = Math.max(900, co2 - dt * 450); if (Math.random() < dt * 3 || co2 === 900) drawMon(); if (co2 < 2500) arden.holdHeadTarget = 0; }
        if (state.scen.fixed) fan.rotation.z += dt * 20;
        if (balOn && !blocked) {
          balT += dt; const sway = Math.sin(balT * 2.3) * 0.02; world.camera.rotation.z = sway; hud.setReadout('Balance', [['Time', `${balT.toFixed(1)} / 5 s`, ''], ['Sway', `${Math.round(Math.abs(sway) * 900)} mm`, 'good']]);
          if (balT >= 5) { balOn = false; player.frozenByScene = false; world.camera.rotation.z = 0; hud.setReadout(null); state.base.balance = 'steady'; sfx.good();
            openModal({ title: '⚖ Balance', body: h('div', {}, h('p', {}, 'Baseline saved: steady. After landing, astronauts are re-tested here. For days, many sway and stumble while the inner ear and cerebellum re-learn gravity.'), h('span', { class: 'cx-tag good' }, '✅ Confirmed effect'), h('p', { class: 'muted tiny' }, 'For learning only. Not medical advice.')) });
            baseDone(); }
        }
      }
    };
    function finish() {
      clearFx(); meter.hidden = true;
      finishExercise(ctx, { id: 'medical', title: 'Health & Neuroscience', timer: T, xp: 260, badge: 'medical-observer',
        science: 'Confirmed: space motion sickness, fluid shifting to the head, vision changes (SANS), bone and muscle loss, balance problems after landing, and headaches from high CO₂. Migraine triggers differ from person to person; flicker and glare, loud noise, strong smells, poor sleep, dehydration and too much caffeine are among the most commonly reported. Still being researched: the long-term effects of space radiation on the brain and how Mars-length missions affect thinking. This training is for learning only and is not medical advice.' });
    }
  }
};
