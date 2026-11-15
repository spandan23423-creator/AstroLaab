// ASTRO LAB Career — Phase 5: Space Greenhouse and Life Support. In the lunar surface analogue dome:
// buy parts on a limited budget, build a greenhouse in 11 steps, plant two crops and run Mission GREENHOUSE-01:
// keep temperature, humidity, water, nutrients, light, air, CO2/O2 and power in range, fix faults, recycle water, harvest, report.
import * as THREE from '../../../vendor/three.module.js';
import { MAT } from '../models/materials.js';
import { makeSign } from '../models/props.js';
import { std, box, cyl } from '../models/house.js';
import { makeTerminal, makeScreen, infoScreen } from '../models/centre.js';
import { LOOKS } from '../data/people.js';
import { makeUsable } from '../engine/interact.js';
import { whenModel, instance, fit, markImported } from '../../assets/models.js';
import { trainingRoom, instructor, timer, finishExercise } from './kit.js';
import { runQuiz, readDoc, pickOne } from '../ui/panels.js';
import { h, openModal } from '../../ui/dom.js';
import { makeAssembly } from './assembly.js';
import { CATALOG, CAT_MAP, CROPS, STAGES, BUILD, FAULTS, REGOLITH_FACTS, newSystems, stepSystems, cropHealth } from '../data/greenhouse.js';

const REPORT_Q = [
  { q: 'Why does a space greenhouse recycle its water?', options: ['Shipping water from Earth is very expensive, so every litre is reused', 'Recycled water makes plants grow twice as fast', 'Plants can only drink recycled water', 'To make the greenhouse lighter at launch'], explain: 'Launching anything costs a lot, so water is cleaned and reused again and again.' },
  { q: 'Why can\'t raw lunar regolith be used as soil straight away?', options: ['It has no organic matter or nitrogen and its grains are sharp', 'It is radioactive and glows', 'It is too wet', 'It is made of sugar'], explain: 'Regolith is crushed rock and glass: it must be sieved, washed and mixed with compost and nutrients.' },
  { q: 'Why do many space greenhouses use red and blue LEDs?', options: ['Plants use red and blue light most for photosynthesis, so less power is wasted', 'Green light is banned in space', 'Red and blue LEDs are the only ones that work in a vacuum', 'They keep insects away'], explain: 'Chlorophyll absorbs mostly red and blue light. Efficient lights save power and make less heat.' },
  { q: 'What should you switch off first if power drops?', options: ['Non-essential loads like extra lighting hours, so life support keeps running', 'The heater', 'The air fans', 'The control panel'], explain: 'Protect life support first; plants can survive a few dimmer days.' },
  { q: 'Plants in the greenhouse give out...', options: ['Oxygen, and they take in carbon dioxide', 'Carbon dioxide only', 'Nitrogen', 'Nothing at all'], explain: 'Photosynthesis uses CO₂ and light to make sugar and releases O₂: a living part of life support.' }
];

export default {
  id: 'greenhouse', title: 'Space Greenhouse & Life Support', music: 'centre', ambience: 'vent',
  steps: [
    { id: 'brief', text: 'Talk to Dr. Osei, the mission botanist' },
    { id: 'store', text: 'Buy the parts you need at the supply terminal' },
    { id: 'build', text: 'Build the greenhouse: 11 steps' },
    { id: 'lifesupport', text: 'Life support: service the air unit (fans off, swap the CO₂ cartridge, restart)' },
    { id: 'plant', text: 'Choose two crops, plant the seedling trays and water both beds' },
    { id: 'grow', text: 'Mission GREENHOUSE-01: keep both crops healthy until harvest' },
    { id: 'harvest', text: 'Harvest both crops' },
    { id: 'report', text: 'File the mission report' }
  ],
  initialState: { steps: {}, mistakes: [], asmActive: null, ls: {}, planting: null, bought: [], spent: 0, built: [], regolithOK: false, crops: [], prog: {}, sys: null, plan: null, faultAt: {}, warned: {}, yield: {}, day: 0 },

  async build(ctx) {
    const { scene, player, ix, hud, sfx, state, carry } = ctx;
    trainingRoom(ctx, { w: 26, d: 22, hgt: 9, title: 'LUNAR SURFACE ANALOGUE', sub: 'Greenhouse build site', bg: 0x05060a, light: 0.8 });
    // grey regolith floor over the hangar floor, and a painted Earth on the far wall
    const rg = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#8a8a88'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 9000; i++) { const g = 100 + Math.random() * 80; x.fillStyle = `rgba(${g},${g},${g - 4},.5)`; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 9); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const reg = new THREE.Mesh(new THREE.PlaneGeometry(25.6, 21.6), std(0xffffff, { map: rg, roughness: 1 })); reg.rotation.x = -Math.PI / 2; reg.position.y = 0.004; reg.receiveShadow = true; scene.add(reg);
    const earth = new THREE.Mesh(new THREE.CircleGeometry(1.4, 40), std(0x3a6ad8, { emissive: 0x2a4a9a, emissiveIntensity: 0.6 })); earth.position.set(7, 6.4, -10.95); scene.add(earth);
    const budget = Math.round(1220 + (ctx.diff.budget - 0.65) * 800), refunds = ctx.diff.id !== 'realistic';
    const has = id => state.bought.includes(id);
    const T = timer(ctx, 600);
    // ---- the supply terminal
    const term = makeTerminal(infoScreen('SUPPLY DEPOT', [`Budget: ${budget} credits`, ['Order parts here', '#ffc857']], { w: 512, hgt: 320 })); term.position.set(-10.5, 0, -7); term.rotation.y = Math.PI / 2; scene.add(term); player.addBox(-10.8, -10.2, -7.3, -6.7, 0, 1.3);
    const pallets = new THREE.Group(); scene.add(pallets); pallets.position.set(-10, 0, -3);
    const drawPallets = () => { pallets.clear(); state.bought.filter(id => !usedBy(id)).forEach((id, i) => { box(0.7, 0.5, 0.6, std(0xd9a441, { roughness: 0.8 }), (i % 3) * 0.8, 0.25 + Math.floor(i / 9) * 0.52, Math.floor(i / 3) % 3 * 0.75, pallets); }); };
    const usedBy = id => BUILD.some(b => state.built.includes(b.id) && b.needs.flat().includes(id));
    function store() {
      ctx.input.releaseLock();
      const sel = new Set(state.bought), cats = [...new Set(CATALOG.map(c => c.cat))];
      const total = h('p', { class: 'cx-total' });
      const cost = () => [...sel].reduce((a, id) => a + CAT_MAP[id].cost, 0);
      const upd = () => { const c = cost(); total.innerHTML = `Spent: <b>${c}</b> of ${budget} credits${refunds ? '' : ' · Realistic: no refunds'}`; total.style.color = c > budget ? '#ff8a8a' : ''; };
      const body = h('div', {}, h('p', {}, 'Everything must be shipped to the Moon, so every credit counts. Required parts are marked ★. For lights and growing beds, pick one option.'),
        ...cats.map(cat => h('div', {}, h('h4', {}, cat), h('div', { class: 'cx-ticks' }, CATALOG.filter(c => c.cat === cat).map(c => {
          const locked = state.bought.includes(c.id) && (usedBy(c.id) || !refunds);
          return h('label', { class: 'cx-tick' }, h('input', { type: 'checkbox', checked: sel.has(c.id), disabled: locked, onchange: e => { e.target.checked ? sel.add(c.id) : sel.delete(c.id); upd(); } }), ' ', h('b', {}, `${c.need ? '★ ' : ''}${c.name}`), ` · ${c.cost} cr`, h('small', { class: 'muted', style: 'display:block;margin-left:24px' }, c.desc));
        })))), total);
      upd();
      const m = openModal({ title: '🛒 Supply depot', label: 'Supply depot', wide: true, body, foot: [h('button', { class: 'btn primary', onclick: () => {
        const c = cost(); if (c > budget) { sfx.wrong(); hud.flash(`Over budget by ${c - budget} credits.`, 'bad'); return; }
        const miss = CATALOG.filter(x => x.need && !sel.has(x.id)), noLight = !sel.has('ledBasic') && !sel.has('ledEff'), noBed = !sel.has('hydro') && !sel.has('regolith');
        if (miss.length || noLight || noBed) { sfx.wrong(); hud.flash(`Still missing: ${[...miss.map(x => x.name), noLight ? 'grow lights' : null, noBed ? 'growing beds' : null].filter(Boolean).join(', ')}.`, 'bad', 4500); if (!ctx.isDone('store')) ctx.mistake('Tried to order an incomplete greenhouse kit.'); return; }
        state.bought = [...sel]; state.spent = c; m.close(); sfx.good(); hud.cap('[Order confirmed: crates delivered to the pallets]', 2500); drawPallets();
        if (ctx.done('store')) hud.flash(`Order placed: ${budget - c} credits left. Start building at the glowing marker.`, 'good', 4000);
        ctx.refreshObjectives();
      } }, 'Place order ✓')] });
    }
    makeUsable(term, { label: 'Supply terminal', verb: 'Order parts at', range: 2.6, enabled: () => ctx.isDone('brief'), use: store }); ix.add(term);

    // ---- the greenhouse parts that appear as you build
    const G = new THREE.Group(); scene.add(G);
    const glass = new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.18, roughness: 0.1, side: THREE.DoubleSide, depthWrite: false });
    const piece = {
      site: () => { const g = new THREE.Group(); box(11, 0.08, 10, std(0xb8bec8, { roughness: 0.7 }), 0, 0.04, 1, g); for (let x = -5; x <= 5; x += 2.2) box(0.03, 0.09, 10, std(0x8a90a0), x, 0.045, 1, g); return g; },
      frame: () => { const g = new THREE.Group(); for (let z = -3.8; z <= 5.8; z += 1.6) { const r = new THREE.Mesh(new THREE.TorusGeometry(5.4, 0.06, 6, 32, Math.PI), MAT.metal(0xb8bec8)); r.position.set(0, 0, z); r.scale.y = 0.62; g.add(r); } return g; },
      shell: () => { const g = new THREE.Group(); g.add(frontWall()); const s = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 9.8, 40, 1, true, -Math.PI / 2, Math.PI), glass); s.rotation.x = -Math.PI / 2; s.scale.set(1, 1, 0.62); s.position.z = 1; g.add(s); const w = new THREE.Mesh(new THREE.CircleGeometry(5.5, 40, 0, Math.PI), glass); w.scale.y = 0.62; w.position.z = -3.9; g.add(w); return g; },
      // hollow airlock you can walk through: two side walls, a roof, a floor plate and a sliding outer door
      airlock: () => { const g = new THREE.Group(), wm = std(0xe8ebf0, { roughness: 0.5 }); for (const sx of [-1, 1]) box(0.08, 2.4, 1.6, wm, sx * 1.0, 1.2, 6.7, g); box(2.08, 0.08, 1.6, wm, 0, 2.44, 6.7, g); box(2.0, 0.04, 1.6, std(0x9aa0aa), 0, 0.02, 6.7, g);
        for (const sx of [-1, 1]) box(0.45, 2.4, 0.08, wm, sx * 0.78, 1.2, 7.5, g); box(1.2, 0.3, 0.08, wm, 0, 2.25, 7.5, g);
        const door = box(1.1, 2.1, 0.05, std(0x3a3f4a), 0, 1.05, 7.56, g); const win = new THREE.Mesh(new THREE.CircleGeometry(0.16, 20), new THREE.MeshStandardMaterial({ color: 0x9ac8f0, transparent: true, opacity: 0.5 })); win.position.set(0, 0.5, 0.03); door.add(win); g.userData.door = door; return g; },
      power: () => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const p = new THREE.Group(); box(1.6, 0.04, 1, std(0x1a2a5a, { metalness: 0.4, roughness: 0.3 }), 0, 0, 0, p); p.rotation.x = -0.5; p.position.set(-11.6 + i * 1.8, 1.1, 5.4); g.add(p); cyl(0.04, 0.04, 1, MAT.metal(), -11.6 + i * 1.8, 0.5, 5.4, g, 6); } box(0.8, 0.6, 0.5, std(0x3a3f4a), -8.6, 0.3, 4.4, g); return g; }, // solar field 3 m west of the dome: the east panel used to overlap the shell
      // the grow-light rack and the air unit are assembled by hand (see the assemblies below); these add the finishing touches
      lights: () => { const g = new THREE.Group(), eff = has('ledEff'); const l = new THREE.PointLight(eff ? 0xd06aff : 0xfff2e0, 6, 8, 1.4); l.position.set(0, 2.2, 0); g.add(l); setLeds(true); return g; },
      air: () => new THREE.Group(),
      water: () => { const g = new THREE.Group(); cyl(0.55, 0.55, 1.5, std(0x5a9ad8, { roughness: 0.3 }), 4.2, 0.75, -2.8, g); box(0.4, 0.3, 0.3, std(0x3a3f4a), 3.4, 0.15, -2.4, g); box(0.4, 0.3, 0.3, std(0x3a3f4a), 3.4, 0.15, -3.1, g); return g; },
      recycler: () => { const g = new THREE.Group(); box(0.9, 1.3, 0.7, std(0xe8ebf0), 4.2, 0.65, 2.4, g); box(0.3, 0.3, 0.05, std(0x2b6ad8), 4.2, 0.9, 2.02, g); return g; },
      beds: () => { const g = new THREE.Group(), soil = has('hydro') ? std(0xf2f2f2) : std(0x6a5a48, { roughness: 1 }); for (const x of [-1.3, 1.3]) { box(1.1, 0.5, 4.2, std(0xd9dce2), x, 0.25, 0, g); box(1.0, 0.04, 4.1, has('hydro') ? std(0x7ab8d8, { roughness: 0.2 }) : soil, x, 0.51, 0, g); } return g; },
      control: () => { const g = new THREE.Group(); return g; }
    };
    const markers = {}, built = {};
    // Collision for every built piece (no walking through tanks, beds or the dome), and the glass dome blocks using things through it
    const COLS = { shell: [[-5.2, -5.0, -3.9, 5.9], [5.0, 5.2, -3.9, 5.9], [-5.5, 5.5, -4.0, -3.85], [-5.5, -0.62, 5.85, 5.95], [0.62, 5.5, 5.85, 5.95]], airlock: [[-1.06, -0.94, 5.9, 7.5], [0.94, 1.06, 5.9, 7.5], [-1.0, -0.55, 7.46, 7.54], [0.55, 1.0, 7.46, 7.54]],
      water: [[3.6, 4.8, -3.4, -2.2], [3.15, 3.65, -3.3, -2.2]], recycler: [[3.7, 4.7, 2.0, 2.8]], beds: [[-1.9, -0.7, -2.15, 2.15], [0.7, 1.9, -2.15, 2.15]], control: [[-4.72, -4.48, 2.08, 2.32]], power: [[-9.05, -8.15, 4.1, 4.7], [-11.65, -11.55, 5.35, 5.45], [-9.85, -9.75, 5.35, 5.45], [-8.05, -7.95, 5.35, 5.45]] };
    function showPiece(id) { const p = piece[id](); p.traverse(o => { if (o.isMesh && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } }); G.add(p); built[id] = p;
      for (const [x0, x1, z0, z1] of COLS[id] || []) player.addBox(x0, x1, z0, z1, 0, id === 'beds' ? 1 : 3);
      if (id === 'shell') { p.userData.blocker = true; ix.blockers.push(p); }
    }
    function frontWall() { // the dome's front end, with a doorway into the airlock
      const sh = new THREE.Shape(); sh.moveTo(-5.5, 0); for (let i = 1; i < 40; i++) { const a = Math.PI - i / 40 * Math.PI; sh.lineTo(Math.cos(a) * 5.5, Math.sin(a) * 5.5 * 0.62); } sh.lineTo(5.5, 0); sh.lineTo(0.6, 0); sh.lineTo(0.6, 2.1); sh.lineTo(-0.6, 2.1); sh.lineTo(-0.6, 0); sh.lineTo(-5.5, 0);
      const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), glass); m.position.z = 5.9; return m;
    }
    BUILD.forEach((b, i) => {
      const m = new THREE.Group(); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.04, 8, 32), MAT.glow(0xffc857, 0.8)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.06; m.add(ring);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 0.7), new THREE.MeshBasicMaterial({ visible: false })); post.position.y = 0.7; m.add(post);
      m.position.set(b.at[0], 0, b.at[1]); scene.add(m); markers[b.id] = m;
      makeUsable(m, { label: `Step ${i + 1}: ${b.name}`, verb: 'Build', range: 2.8, enabled: () => ctx.isDone('store') && nextBuild() === b && !busy, use: () => doBuild(b) }); ix.add(m);
    });
    const nextBuild = () => BUILD.find(b => !state.built.includes(b.id));
    let busy = false;
    async function doBuild(b) {
      const miss = b.needs.filter(n => Array.isArray(n) ? !n.some(has) : !has(n));
      if (miss.length) { sfx.wrong(); hud.flash(`You need: ${miss.map(n => Array.isArray(n) ? n.map(x => CAT_MAP[x].name).join(' or ') : CAT_MAP[n].name).join(', ')}. Order it at the supply terminal.`, 'bad', 4500); return; }
      if (b.id === 'beds' && has('regolith') && !has('hydro') && !state.regolithOK) {
        ctx.input.releaseLock();
        if (!has('processor')) {
          if (!state.warned.regolith) { state.warned.regolith = true; ctx.mistake('Planned to grow crops in raw regolith with no way to process it.'); }
          await readDoc({ title: '🪨 Raw regolith won\'t work', body: h('div', {}, h('p', {}, 'You tip a bag of raw regolith into the bed. Dr. Osei shakes her head.'), h('ul', {}, REGOLITH_FACTS.map(f => h('li', {}, f))), h('p', {}, h('b', {}, 'Order the regolith processor or hydroponic trays at the supply terminal.'))), confirm: 'Understood' });
          return;
        }
        await readDoc({ title: '🪨 Process the regolith', body: h('div', {}, h('ul', {}, REGOLITH_FACTS.map(f => h('li', {}, f))), h('p', {}, 'Run each stage of the processor:')), ticks: ['Sieve out sharp rocks and fine dust', 'Wash out harmful salts', 'Mix in compost, nitrogen and nutrients'], confirm: 'Fill the beds ▸' });
        state.regolithOK = true;
      }
      if (ASM[b.id]) { // hands-on assembly: lay the parts out on the workbench and install them one by one
        if (state.asmActive !== b.id) { state.asmActive = b.id; sfx.ui(); hud.flash(`${ASM[b.id].title}: pick up each part from the workbench and install it where the blue outline shows. Wrong parts won't fit.`, '', 6000); ctx.refreshObjectives(); }
        else hud.flash(`Install the remaining parts: ${ASM[b.id].installed()} of ${ASM[b.id].parts} done.`, '', 3000);
        markers[b.id].visible = false; return;
      }
      busy = true; ctx.input.releaseLock(); sfx.ui(); hud.cap(`[Clank, whirr: ${b.name.toLowerCase()}]`, 1600);
      const r = markers[b.id].children[0]; r.material.color.set(0x5ad8ff); r.material.emissive.set(0x5ad8ff);
      await new Promise(res => setTimeout(res, 1200));
      busy = false; completeBuild(b);
    }
    function completeBuild(b) {
      state.built.push(b.id); showPiece(b.id); markers[b.id].visible = false; drawPallets(); sfx.place(); if (state.asmActive === b.id) state.asmActive = null;
      if (b.id === 'beds' && has('hydro')) state.regolithOK = true;
      const n = state.built.length; hud.flash(`Step ${n} of 11 done: ${b.name}.`, 'good', 2500);
      ctx.steps.find(s => s.id === 'build').text = `Build the greenhouse: ${n} of 11 steps`; ctx.refreshObjectives();
      if (n === BUILD.length) { ctx.done('build'); controlScreen.visible = true; hud.flash('Greenhouse complete and pressurised! Before planting: the life-support air unit needs its first service. Its status light is red.', 'good', 5500); }
    }
    // control panel (appears with step 11)
    const controlScreen = makeScreen(1.0, 0.65, infoScreen('GREENHOUSE CONTROL', ['Systems offline'], { w: 512, hgt: 320 }), [512, 320]);
    controlScreen.position.set(-4.6, 1.5, 2.2); controlScreen.rotation.y = Math.PI / 2; controlScreen.visible = false; scene.add(controlScreen);
    box(0.1, 1.5, 0.1, MAT.metal(), 0, -0.75, -0.05, controlScreen); // the post reaches the floor (it used to stop 0.3 m above it)

    // ================= Hands-on assembly (11B): the grow-light rack and the life-support air unit =================
    const metal = MAT.metal(0xb8bec8), ledCol = () => has('ledEff') ? 0xd04aff : 0xfff4e0;
    // grow-light rack: a frame hanging over the beds; two LED panels, a driver and a light sensor are fitted into it
    const lightRig = new THREE.Group(); lightRig.position.set(0, 2.55, 0); scene.add(lightRig);
    for (const x of [-2.0, 2.0]) box(0.06, 0.06, 4.3, metal, x, 0, 0, lightRig);
    for (const z of [-2.15, 2.15]) box(4.06, 0.06, 0.06, metal, 0, 0, z, lightRig);
    for (const x of [-2.0, 2.0]) for (const z of [-2.15, 2.15]) cyl(0.008, 0.008, 0.7, std(0x222222), x, 0.35, z, lightRig, 4);
    const ledMats = [];
    const ledPanel = () => { const g = new THREE.Group(); box(1.0, 0.05, 1.6, std(0x30343c, { roughness: 0.5 }), 0, 0.025, 0, g); for (const z of [-0.55, 0, 0.55]) { const m = MAT.glow(ledCol(), 0.05); ledMats.push(m); box(0.85, 0.02, 0.3, m, 0, -0.005, z, g); } return g; };
    const ASM = {};
    const asmLights = ASM.lights = Object.assign(makeAssembly(ctx, {
      key: 'asmLights', title: 'Grow-light rack', chassis: lightRig, bench: [-3.3, 0.4, Math.PI / 2],
      active: () => state.asmActive === 'lights' && !state.built.includes('lights'),
      parts: [
        { id: 'ledA', name: 'LED panel (left)', make: ledPanel, slot: [-1.3, -0.08, 0] },
        { id: 'ledB', name: 'LED panel (right)', make: ledPanel, slot: [1.3, -0.08, 0] },
        { id: 'driver', name: 'LED driver box', make: () => { const g = new THREE.Group(); box(0.32, 0.14, 0.22, std(0x2a2d33), 0, 0.07, 0, g); box(0.05, 0.03, 0.01, MAT.glow(0x3fe0a0, 1), 0.1, 0.1, 0.115, g); return g; }, slot: [0, -0.17, -2.15] },
        { id: 'sensor', name: 'Light sensor', make: () => { const g = new THREE.Group(); cyl(0.06, 0.07, 0.05, std(0xe8ebf0), 0, 0.025, 0, g, 14); const d = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(0xfff4c0, { roughness: 0.2 })); d.position.y = 0.05; g.add(d); return g; }, slot: [0, -0.11, 2.15] }],
      decoys: [{ id: 'pumpX', name: 'Spare water pump', why: 'Pumps belong to the water system, not the light rack.', make: () => { const g = new THREE.Group(); cyl(0.09, 0.09, 0.22, std(0x2b6ad8), 0, 0.11, 0, g, 14); box(0.2, 0.04, 0.12, std(0x3a3f4a), 0, 0.02, 0, g); return g; } }],
      onDone: () => { completeBuild(BUILD.find(b => b.id === 'lights')); hud.flash('Grow-light rack assembled and switched on!', 'good', 3500); }
    }), { title: 'Grow-light rack', parts: 4 });
    function setLeds(on) { for (const m of ledMats) { m.color.set(ledCol()); m.emissive.set(ledCol()); m.emissiveIntensity = on ? 1.4 : 0.05; } }
    // air unit (life support): an open cabinet; fan module, heater core, CO2 scrubber cartridge and O2 sensor are fitted into it
    const airUnit = new THREE.Group(); airUnit.position.set(-4.6, 0, -2.6); airUnit.rotation.y = Math.PI / 2; scene.add(airUnit);
    { const wm = std(0xd9dce2, { roughness: 0.5 }); box(0.9, 1.4, 0.04, wm, 0, 0.7, -0.28, airUnit); for (const sx of [-1, 1]) box(0.04, 1.4, 0.6, wm, sx * 0.45, 0.7, 0, airUnit); box(0.94, 0.04, 0.6, wm, 0, 1.42, 0, airUnit); box(0.9, 0.06, 0.6, std(0x5a5f6a), 0, 0.03, 0, airUnit); box(0.86, 0.02, 0.5, std(0x9aa0aa), 0, 0.45, -0.02, airUnit); box(0.86, 0.02, 0.5, std(0x9aa0aa), 0, 0.82, -0.02, airUnit); }
    const airLamp = box(0.08, 0.05, 0.02, MAT.glow(0xff4a3a, 1.4), 0.3, 1.3, 0.31, airUnit);
    const airScreen = makeScreen(0.34, 0.22, infoScreen('AIR UNIT', ['Offline'], { w: 256, hgt: 160 }), [256, 160]); airScreen.position.set(-0.05, 1.22, 0.31); airUnit.add(airScreen);
    const airCol = player.addBox(-4.92, -4.28, -3.07, -2.13, 0, 1.5);
    const cartridge = (dirty) => () => { const g = new THREE.Group(); cyl(0.09, 0.09, 0.3, std(dirty ? 0x6a5a48 : 0xf2f4f6, { roughness: dirty ? 1 : 0.4 }), 0, 0.15, 0, g, 16); cyl(0.092, 0.092, 0.05, std(dirty ? 0x3a3a30 : 0x2b6ad8), 0, 0.2, 0, g, 16); cyl(0.04, 0.04, 0.03, std(0x3a3f4a), 0, 0.315, 0, g, 10); return g; };
    const asmAir = ASM.air = Object.assign(makeAssembly(ctx, {
      key: 'asmAir', title: 'Air unit', chassis: airUnit, bench: [-2.7, -3.3, 0],
      active: () => state.asmActive === 'air' && !state.built.includes('air'),
      parts: [
        { id: 'fan', name: 'Fan module', make: () => { const g = new THREE.Group(); box(0.5, 0.32, 0.1, std(0x3a3f4a), 0, 0.16, 0, g); const f = cyl(0.13, 0.13, 0.02, std(0x9aa3b2), 0, 0.16, 0.06, g, 18); f.rotation.x = Math.PI / 2; return g; }, slot: [0, 0.85, 0.12] },
        { id: 'heater', name: 'Heater core', make: () => { const g = new THREE.Group(); box(0.6, 0.22, 0.28, std(0xc8502a, { roughness: 0.6 }), 0, 0.11, 0, g); for (let i = -2; i <= 2; i++) box(0.02, 0.2, 0.3, std(0x8a3a1a), i * 0.11, 0.11, 0, g); return g; }, slot: [0, 0.47, 0] },
        { id: 'co2', name: 'CO₂ scrubber cartridge', make: cartridge(false), slot: [-0.2, 0.06, 0.02] },
        { id: 'o2', name: 'O₂ sensor', make: () => { const g = new THREE.Group(); box(0.14, 0.12, 0.1, std(0xe8ebf0), 0, 0.06, 0, g); box(0.06, 0.03, 0.01, MAT.glow(0x5ad8ff, 1), 0, 0.08, 0.051, g); return g; }, slot: [0.24, 0.06, 0.05] }],
      decoys: [{ id: 'old', name: 'Clogged old cartridge', why: 'It is saturated with CO₂ and dust: it would not clean the air.', make: cartridge(true) }],
      onDone: () => { completeBuild(BUILD.find(b => b.id === 'air')); hud.flash('Air unit assembled: fans, heater, CO₂ scrubber and O₂ sensor all fitted.', 'good', 3500); }
    }), { title: 'Air unit', parts: 4 });
    const asmMarker = id => { const A = id === 'lights' ? asmLights : asmAir; const p = Object.keys(A.sockets).find(k => !A.sockets[k].userData.filled); if (!p) return null; return carry.held === A.items[p] ? A.sockets[p] : A.items[p]; };
    const showAir = () => { const v = state.asmActive === 'air' || state.built.includes('air'); airUnit.visible = v; airCol.on = v; lightRig.visible = state.asmActive === 'lights' || state.built.includes('lights'); };

    // ================= Life support activity (11A): service the air unit =================
    // Fans off at the breaker -> take out the saturated CO2 cartridge -> bin it -> fit a new cartridge -> fans on.
    // Failure states: opening the unit with the fans running, restarting with no cartridge, refitting the old one.
    const LS = state.ls || (state.ls = {});
    const lsActive = () => ctx.current()?.id === 'lifesupport';
    let co2 = LS.done ? 800 : 3900;
    const breaker = new THREE.Group(); box(0.08, 0.16, 0.06, std(0x1a1d24), 0, 0, 0, breaker); const lever = box(0.03, 0.08, 0.03, std(0xffc857), 0, 0.04, 0.04, breaker); breaker.position.set(0.49, 1.0, 0.18); breaker.rotation.y = Math.PI / 2; airUnit.add(breaker);
    const brkHit = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 0.25), new THREE.MeshBasicMaterial({ visible: false })); brkHit.userData.hitbox = true; breaker.add(brkHit);
    const setLever = () => { lever.position.y = LS.fansOff ? -0.04 : 0.04; };
    const bin = new THREE.Group(); cyl(0.2, 0.17, 0.5, std(0x3a5a3a, { roughness: 0.8 }), 0, 0.25, 0, bin, 18); const binLbl = box(0.2, 0.08, 0.01, std(0xf2f4f6), 0, 0.35, 0.2, bin); bin.position.set(-4.0, 0, -1.5); scene.add(bin); player.addBox(-4.22, -3.78, -1.72, -1.28, 0, 0.6);
    const binSock = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.6, 0.45), new THREE.MeshBasicMaterial({ visible: false })); binSock.position.set(-4.0, 0.3, -1.5); binSock.userData.hitbox = true; scene.add(binSock);
    const spare = cartridge(false)(); spare.position.set(-2.3, 0.905, -3.3); scene.add(spare); carry.makeCarriable(spare, { id: 'ls-new', name: 'New CO₂ cartridge', stow: false });
    const slotAt = airUnit.localToWorld(new THREE.Vector3(-0.2, 0.06, 0.02));
    const lsSock = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.3), new THREE.MeshBasicMaterial({ visible: false })); lsSock.position.copy(slotAt).add(new THREE.Vector3(0, 0.17, 0)); lsSock.userData.hitbox = true; scene.add(lsSock);
    const oldC = () => asmAir.items.co2; // the cartridge fitted during assembly is the one that gets saturated
    function lsPrepare() { // make the fitted cartridge the "saturated" one that has to come out
      const o = oldC(); if (!o || LS.binned) return;
      o.userData.carry.id = 'ls-old'; o.userData.carry.name = 'Saturated CO₂ cartridge'; o.userData.it.label = 'Saturated CO₂ cartridge';
      o.traverse(m => { if (m.isMesh && m.material.color) { m.material = m.material.clone(); m.material.color.multiplyScalar(0.55); } });
      if (!LS.out) { o.userData.locked = false; }
      const pick = o.userData.it.use; o.userData.it.use = () => { if (!LS.fansOff) { sfx.wrong(); if (!LS.warnFans) { LS.warnFans = true; ctx.mistake('Life support: tried to open the air unit with the fans running.'); } hud.flash('Stop! Switch the fans off at the breaker first: never open a running air unit.', 'bad', 4000); return; } pick(); };
      o.userData.carry.onPick = () => { if (!LS.out) { LS.out = true; asmAir.sockets.co2.userData.ghost.visible = false; asmAir.sockets.co2.userData.filled = o; } drawAir(); };
      o.userData.lsReady = true;
    }
    carry.makeSocket(binSock, { label: 'Waste bin', lock: true, accepts: it => /^ls-/.test(it.userData.carry.id), check: it => it.userData.carry.id === 'ls-old' ? { ok: true } : { ok: false, msg: 'That is the new cartridge: it goes into the air unit, not the bin.' }, onPlace: it => { it.visible = false; LS.binned = true; hud.flash('Old cartridge binned. Now fit the new one from the workbench.', 'good', 3000); drawAir(); } });
    carry.makeSocket(lsSock, { label: 'Air unit: cartridge slot', lock: true, accepts: it => /^ls-/.test(it.userData.carry.id), check: it => !lsActive() ? { ok: false, msg: 'Not now.' } : it.userData.carry.id === 'ls-new' ? { ok: true } : { ok: false, msg: 'That is the saturated cartridge: it would not clean the air. Put it in the waste bin and fit the new one.' }, onPlace: it => { it.position.copy(slotAt); it.rotation.set(0, airUnit.rotation.y, 0); LS.newIn = true; hud.flash('New cartridge fitted. Switch the fans back on at the breaker.', 'good', 3000); drawAir(); } });
    makeUsable(brkHit, { label: 'Air unit fan breaker', verb: () => LS.fansOff ? 'Switch fans ON' : 'Switch fans OFF', range: 2.4, enabled: () => lsActive() && !LS.done, use: () => {
      sfx.click();
      if (!LS.fansOff) { LS.fansOff = true; setLever(); sfx.hum(false); hud.flash('Fans off: the unit is safe to open. Take out the saturated CO₂ cartridge.', '', 3500); drawAir(); return; }
      if (!LS.out) { sfx.wrong(); hud.flash('The saturated cartridge is still fitted: switching back on now would not clean the air. Swap the cartridge first.', 'bad', 4000); return; }
      if (!LS.newIn) { sfx.alarm(); if (!LS.warnEmpty) { LS.warnEmpty = true; ctx.mistake('Life support: restarted the air unit with no CO₂ cartridge.'); } hud.flash('⚠ Alarm: no scrubber cartridge fitted! Without it, CO₂ would keep rising. The fans stay off: fit the new cartridge first.', 'bad', 5000); return; }
      LS.fansOff = false; LS.done = true; setLever(); sfx.hum(true); airLamp.material.color.set(0x3fe0a0); airLamp.material.emissive.set(0x3fe0a0); drawAir();
      hud.flash('Fans on. CO₂ is falling and O₂ is steady: life support is green.', 'good', 4000);
    } }); brkHit.userData.it.verb = 'Switch the fans OFF/ON at'; ix.add(brkHit);
    function drawAir() {
      const lines = !state.built.includes('air') ? ['Offline'] : [[`CO₂ ${Math.round(co2)} ppm`, co2 > 2500 ? '#ff6a6a' : '#3fe0a0'], ['O₂ 20.9 %', '#3fe0a0'], LS.fansOff ? ['Fans: OFF', '#ffb347'] : ['Fans: ON', '#3fe0a0'], LS.done ? ['Cartridge: new ✓', '#3fe0a0'] : ['Cartridge: SATURATED', '#ff6a6a']];
      airScreen.userData.screen.redraw(infoScreen('AIR UNIT', lines, { w: 256, hgt: 160 }));
      if (lsActive()) hud.setReadout('Air unit service', [['CO₂', `${Math.round(co2)} ppm`, co2 > 2500 ? 'bad' : 'good'], ['1. Fans off', LS.fansOff || LS.done ? '✓' : '—', LS.fansOff || LS.done ? 'good' : ''], ['2. Old cartridge out', LS.out ? '✓' : '—', LS.out ? 'good' : ''], ['3. Old cartridge binned', LS.binned ? '✓' : '—', LS.binned ? 'good' : ''], ['4. New cartridge in', LS.newIn ? '✓' : '—', LS.newIn ? 'good' : ''], ['5. Fans on', LS.done ? '✓' : '—', LS.done ? 'good' : '']]);
    }
    let airT = 0;
    function lsUpdate(dt, blocked) {
      showAir();
      const act = lsActive();
      spare.visible = act || LS.newIn; spare.userData.locked = !act || LS.newIn && spare.userData.inSocket;
      if (act && !oldC()?.userData.lsReady) lsPrepare();
      if (blocked) return;
      if (state.built.includes('air') && !LS.done && !LS.fansOff) co2 = Math.min(5200, co2 + dt * 6);
      if (LS.done && co2 > 800) co2 = Math.max(800, co2 - dt * 600);
      if ((airT -= dt) < 0) { airT = 0.5; if (state.built.includes('air')) drawAir(); }
      if (act && LS.done && co2 <= 2500 && ctx.done('lifesupport')) { hud.setReadout(null); hud.flash('Life support serviced! Talk to Dr. Osei to choose your crops.', 'good', 4000); }
    }
    const lsMarker = () => !LS.fansOff && !LS.out ? brkHit : !LS.out ? oldC() : !LS.binned ? binSock : !LS.newIn ? (carry.held === spare ? lsSock : spare) : brkHit;
    setLever();
    if (LS.binned && oldC()) { oldC().visible = false; oldC().userData.locked = true; }
    if (LS.newIn) { spare.position.copy(slotAt); spare.userData.locked = true; spare.userData.inSocket = lsSock; lsSock.userData.filled = spare; }
    if (LS.done) { airLamp.material.color.set(0x3fe0a0); airLamp.material.emissive.set(0x3fe0a0); }

    // ================= Greenhouse activity (11A): plant the seedlings and water the beds =================
    const shelf = new THREE.Group(); box(0.9, 0.04, 0.5, std(0x8a6a48), 0, 0.7, 0, shelf); for (const sx of [-1, 1]) box(0.04, 0.7, 0.5, MAT.metal(0x6a707a), sx * 0.43, 0.35, 0, shelf); shelf.position.set(2.6, 0, 4.6); scene.add(shelf);
    const shelfCol = player.addBox(2.13, 3.07, 4.33, 4.87, 0, 0.8); shelfCol.on = false; shelf.visible = false;
    const trays = [], bedSocks = [], waterHits = [];
    const can = new THREE.Group(); cyl(0.11, 0.13, 0.24, std(0x2e8a4a, { roughness: 0.5 }), 0, 0.12, 0, can, 16); const spout = cyl(0.015, 0.025, 0.3, std(0x2e8a4a), 0.17, 0.2, 0, can, 8); spout.rotation.z = -0.9; const handle = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 16, Math.PI), std(0x2e8a4a)); handle.position.y = 0.24; can.add(handle);
    can.position.set(3.2, 0, -1.6); can.visible = false; scene.add(can);
    let canMade = false;
    const tankHit = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.6, 1.3), new THREE.MeshBasicMaterial({ visible: false })); tankHit.position.set(4.2, 0.8, -2.8); tankHit.userData.hitbox = true; scene.add(tankHit);
    const plantingActive = () => ctx.isDone('lifesupport') && !ctx.isDone('plant') && state.crops.length && state.planting;
    function setupPlanting() {
      const P = state.planting || (state.planting = { trays: {}, watered: {}, can: 0 });
      shelf.visible = true; shelfCol.on = true;
      if (!trays.length) state.crops.forEach((c, i) => {
        const t = new THREE.Group(); box(0.55, 0.06, 0.38, std(0x3a3f4a), 0, 0.03, 0, t); box(0.5, 0.03, 0.33, std(0x5a4a3a, { roughness: 1 }), 0, 0.065, 0, t);
        for (let k = 0; k < 6; k++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 5), std(0x5aaa3a)); sp.position.set(-0.16 + (k % 3) * 0.16, 0.11, k < 3 ? -0.08 : 0.08); t.add(sp); }
        t.position.set(2.35 + i * 0.5, 0.72, 4.6); scene.add(t); carry.makeCarriable(t, { id: 'tray-' + i, name: `${CROPS[c].name} seedlings (tray)`, stow: false }); t.userData.crop = c; trays.push(t);
      });
      if (!canMade) { canMade = true; can.visible = true; carry.makeCarriable(can, { id: 'can', name: 'Watering can', stow: false, hold: { rot: [0, 0, 0] } }); }
      if (!bedSocks.length) [-1.3, 1.3].forEach((x, bi) => {
        const s = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 1.4), new THREE.MeshBasicMaterial({ visible: false })); s.position.set(x, 0.75, 0); s.userData.hitbox = true; scene.add(s);
        carry.makeSocket(s, { label: `Bed ${bi ? 'B (right)' : 'A (left)'}`, lock: true, accepts: it => /^tray-/.test(it.userData.carry.id), check: () => P.trays[bi] ? { ok: false, msg: 'This bed already has a tray. Use the other bed.' } : { ok: true },
          onPlace: it => { it.position.set(x, 0.53, 0); it.rotation.set(0, 0, 0); P.trays[bi] = it.userData.crop; hud.flash(`${CROPS[it.userData.crop].name} planted in bed ${bi ? 'B' : 'A'}.`, 'good', 2500); checkPlanting(); } });
        bedSocks.push(s);
        const w = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 4.0), new THREE.MeshBasicMaterial({ visible: false })); w.position.set(x, 0.75, 0); w.userData.hitbox = true; scene.add(w);
        makeUsable(w, { label: `Bed ${bi ? 'B' : 'A'}`, verb: 'Water', range: 2.4, enabled: () => plantingActive() && carry.held === can && P.trays[bi] != null, use: () => {
          if (P.can <= 0) { sfx.wrong(); hud.flash('The can is empty. Fill it at the water tank.', '', 2500); return; }
          if (P.watered[bi]) { sfx.wrong(); ctx.mistake('Greenhouse: overwatered a bed.'); hud.flash('Overwatered! Roots need air as well as water. The extra drains back to the recycler, but don\'t water the same bed twice.', 'bad', 4500); P.can--; return; }
          P.can--; P.watered[bi] = true; sfx.pour(); hud.cap('[Splish: water soaks into the bed]', 1500); hud.flash(`Bed ${bi ? 'B' : 'A'} watered.`, 'good', 2000); checkPlanting();
        } }); ix.add(w); waterHits.push(w);
      });
      // restore trays already in beds
      Object.entries(P.trays).forEach(([bi, c]) => { const t = trays.find(x => x.userData.crop === c); if (t) { t.position.set(bi == 1 ? 1.3 : -1.3, 0.53, 0); t.userData.locked = true; t.userData.inSocket = bedSocks[bi]; bedSocks[bi].userData.filled = t; } });
    }
    makeUsable(tankHit, { label: 'Water tank', verb: 'Fill the watering can at the', range: 2.4, enabled: () => plantingActive() && carry.held === can, use: () => { state.planting.can = 2; sfx.pour(); hud.cap('[Glug glug: the can fills up]', 1500); hud.flash('Can filled: enough for both beds.', '', 2000); } }); ix.add(tankHit);
    function checkPlanting() {
      const P = state.planting; if (!(P.trays[0] != null && P.trays[1] != null && P.watered[0] && P.watered[1])) return;
      if (carry.held === can) { carry.held = null; }
      can.visible = false; can.userData.locked = true; trays.forEach(t => { t.visible = false; t.userData.locked = true; }); shelf.visible = false; shelfCol.on = false;
      makePlants(); ctx.done('plant'); sfx.good(); hud.flash('Planted and watered! Mission GREENHOUSE-01 has started. Open the control panel and set it up for both crops.', 'good', 5000);
    }
    const plantMarker = () => { if (!ctx.isDone('lifesupport')) return null; if (!state.crops.length) return osei.rig.root; const P = state.planting || {}; const t = trays.find(x => !x.userData.inSocket); if (t) return carry.held === t ? bedSocks.find((s, i) => P.trays[i] == null) : t; if (carry.held !== can) return can; if (P.can <= 0) return tankHit; return waterHits.find((w, i) => !P.watered[i]) || null; };
    // airlock: the outer door slides open when you come close
    function doorUpdate(dt) { const d = built.airlock?.userData.door; if (!d) return; const near = Math.hypot(player.pos.x, player.pos.z - 7.5) < 2.4; d.position.x += ((near ? 1.1 : 0) - d.position.x) * Math.min(1, dt * 4); }
    // plants
    const plantG = new THREE.Group(); scene.add(plantG); let plantMeshes = [];
    function makePlants() {
      plantG.clear(); plantMeshes = [];
      state.crops.forEach((c, bi) => { const x = bi ? 1.3 : -1.3; for (let k = 0; k < 10; k++) { const p = new THREE.Group(); const stem = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 6), std(0x4a9a3a)); stem.position.y = 0.15; p.add(stem); const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), std(CROPS[c].col)); fruit.position.set(0.05, 0.22, 0.04); fruit.visible = false; p.add(fruit); p.position.set(x + (k % 2 ? 0.25 : -0.25), 0.53, -1.8 + Math.floor(k / 2) * 0.9); plantG.add(p); plantMeshes.push({ p, c, stem, fruit }); cropModel(p, c, stem, fruit, k); } });
    }
    // imported crop models (lettuce, dwarf wheat, tomato, potato plants with potatoes at harvest); the cone/ball stay as fallback
    const CROP_MODELS = { lettuce: ['lettuce', 0.4, 'length'], wheat: ['wheat', 0.7, 'height'], tomato: ['tomato', 0.65, 'height'], potato: ['potatoplants', 0.8, 'length'] };
    function cropModel(p, c, stem, fruit, k) {
      const def = CROP_MODELS[c]; if (!def) return;
      whenModel(def[0], gltf => {
        if (!p.parent) return;
        const h = markImported(fit(instance(gltf), { size: def[1], by: def[2], rotY: k * 1.3 })); p.add(h);
        stem.material = stem.material.clone(); stem.material.visible = false; // keeps the health colour logic harmless
        fruit.material = fruit.material.clone(); fruit.material.visible = false;
        if (c === 'potato') whenModel('potato', g2 => { for (const [dx, dz] of [[0.08, 0.06], [-0.07, 0.02], [0.01, -0.08]]) { const t = markImported(fit(instance(g2), { size: 0.09, by: 'max' })); t.position.set(dx, -0.2, dz); fruit.add(t); } });
      });
    }
    // ---- instructor
    const osei = instructor(ctx, LOOKS.botanist, 'Dr. Osei', [-6.5, -5.5, 0.6], () => talkOsei());
    function talkOsei() {
      if (!ctx.isDone('brief')) return [
        { who: 'Dr. Osei', text: 'Welcome to the lunar surface analogue, {name}. I\'m Dr. Amara Osei, mission botanist. Out here we pretend we\'re on the Moon: no shops, no rain, and every kilogram shipped from Earth.' },
        { who: 'Dr. Osei', text: 'Long missions can\'t carry all their food. A greenhouse grows fresh food, recycles water and even helps make oxygen. Your job: buy the parts, build one, and keep two crops alive until harvest.' },
        { who: 'Dr. Osei', text: `You have ${budget} credits. Choose carefully: cheaper isn't always better. The supply terminal is by the west wall.`, choices: [{ text: 'Can I use Moon dirt as soil?', goto: 'soil' }, { text: 'What will go wrong?', goto: 'faults' }, { text: 'Let\'s build.', goto: 'go' }] },
        { id: 'soil', who: 'Dr. Osei', text: 'Good question. Lunar regolith is cheap because it\'s already here, but raw, it\'s crushed rock and glass with no nutrients. It needs processing first.', goto: 'go' },
        { id: 'faults', who: 'Dr. Osei', text: 'Something always does. Pumps fail, filters clog, and dust can cut your solar power. The control panel shows every reading. Watch it.', goto: 'go' },
        { id: 'go', who: 'Dr. Osei', text: 'Order your parts, then build step by step at the glowing markers.', do: () => { if (ctx.done('brief')) T.start(); } }];
      if (ctx.isDone('build') && !ctx.isDone('lifesupport')) return [{ who: 'Dr. Osei', text: 'Beautiful work. One thing first: the air unit\'s CO₂ cartridge was saturated during the pressure test. Switch the fans off at its breaker, take the old cartridge out, bin it, fit a new one from the bench and switch the fans back on.' }];
      if (ctx.isDone('lifesupport') && !ctx.isDone('plant') && state.crops.length) return [{ who: 'Dr. Osei', text: 'Carry each seedling tray to its own bed, then fill the watering can at the water tank and water both beds. Not too much!' }];
      if (ctx.isDone('lifesupport') && !ctx.isDone('plant')) return [{ who: 'Dr. Osei', text: 'Beautiful work. Now choose two crops. Each one likes different conditions, so you\'ll need settings that suit both.', do: () => setTimeout(plant, 50) }];
      const cur = ctx.current()?.id;
      const tip = { store: 'Every ★ part is required. Pick one kind of light and one kind of growing bed.', build: `Next: ${nextBuild()?.name}.`, grow: 'Keep checking the control panel. Each crop shows its ideal range and what is bothering it.', harvest: 'Harvest from the beds when they say Ready.', report: 'File your report on the control panel.' }[cur];
      return [{ who: 'Dr. Osei', text: tip || 'Good work.' }];
    }
    async function plant() {
      while (ctx.dlg.active) await new Promise(r => setTimeout(r, 100)); // let Dr. Osei finish talking first
      if (ctx.isDone('plant')) return;
      ctx.input.releaseLock(); const chosen = [];
      for (let k = 0; k < 2; k++) {
        const id = await pickOne({ title: `🌱 Choose crop ${k + 1} of 2`, cancel: false, intro: k ? 'Pick a second crop. A crop with similar needs is easier to keep happy.' : 'Pick your first crop.', options: Object.entries(CROPS).filter(([i]) => !chosen.includes(i)).map(([i, c]) => ({ id: i, icon: c.icon, name: c.name, desc: `${c.days} days · ${c.temp[0]}–${c.temp[1]} °C · humidity ${c.hum[0]}–${c.hum[1]}% · light ${c.light[0]}–${c.light[1]} h`, note: c.fact })) });
        chosen.push(id);
      }
      state.crops = chosen; state.prog = Object.fromEntries(chosen.map(c => [c, 0])); state.sys = newSystems(); state.day = 0;
      const n = ctx.diff.faults === 'single' ? 2 : ctx.diff.faults === 'linked' ? 3 : 4;
      const pool = ['pump', 'led', 'heater', 'filter', 'co2'].sort(() => Math.random() - 0.5).slice(0, n - (ctx.diff.randomEvents ? 1 : 0)); if (ctx.diff.randomEvents) pool.push('dust');
      const maxD = Math.max(...chosen.map(c => CROPS[c].days));
      state.plan = pool.map((f, i) => [f, Math.round(maxD * (0.15 + i * 0.6 / pool.length))]);
      if (ctx.diff.faults === 'linked' && pool.includes('pump') && !pool.includes('filter')) state.plan.push(['filter', state.plan.find(p => p[0] === 'pump')[1] + 2]);
      state.planting = { trays: {}, watered: {}, can: 0 }; setupPlanting(); sfx.good();
      hud.flash('Crops chosen. Carry each seedling tray (by the airlock) to a growing bed, then water both beds with the watering can.', '', 6000);
    }
    // ---- mission simulation
    const maxDays = () => Math.max(...state.crops.map(c => CROPS[c].days));
    const rate = () => maxDays() / 240; // sim days per real second
    let link = { powerOK: true, pumpOK: true, regolithOK: true }, panelOpen = null, screenT = 0;
    const stageOf = c => Math.min(5, Math.floor(state.prog[c] / CROPS[c].days * 6));
    const stageAvg = () => state.crops.length ? state.crops.map(stageOf).reduce((a, b) => a + b) / state.crops.length : 0;
    function sim(dt) {
      const S = state.sys; if (!S) return;
      const d = dt * rate(); state.day += d;
      link = stepSystems(S, d, { ledEff: has('ledEff'), regolithOK: state.regolithOK, crops: state.crops.length });
      for (const [f, at] of state.plan) if (state.day >= at && !S.faults[f]) { S.faults[f] = state.day; sfx.alarm(); hud.flash(`⚠ ${FAULTS[f].name}! Check the control panel.`, 'bad', 5000); hud.cap('[Alarm: greenhouse fault]', 2000); }
      for (const f of Object.keys(S.faults)) if (!S.fixed[f] && state.day - S.faults[f] > 6 && !state.warned['f' + f]) { state.warned['f' + f] = true; ctx.mistake(`Left "${FAULTS[f].name}" unfixed for more than 6 days.`); }
      for (const c of state.crops) {
        const { health } = cropHealth(c, S, link); const k = Math.min(1, d * 0.08); state.yield[c] = (state.yield[c] ?? 1) * (1 - k) + health * k;
        state.prog[c] = Math.min(CROPS[c].days, state.prog[c] + d * Math.max(0.15, health));
        if (health < 0.3 && !state.warned['h' + c]) { state.warned['h' + c] = true; ctx.mistake(`${CROPS[c].name} got badly stressed.`); hud.flash(`${CROPS[c].name} is wilting! Check the control panel.`, 'bad'); }
      }
      if (S.water <= 0 && !state.warned.water) { state.warned.water = true; ctx.mistake('The water tank ran dry.'); }
      if (state.crops.every(c => state.prog[c] >= CROPS[c].days) && !ctx.isDone('grow')) { ctx.done('grow'); hud.flash('Both crops are ready! Harvest them from the beds.', 'good', 4000); }
    }
    function drawPlants() {
      for (const m of plantMeshes) { const st = stageOf(m.c), hl = cropHealth(m.c, state.sys, link).health; const s = 0.2 + st * 0.35 + state.prog[m.c] / CROPS[m.c].days * 0.3; m.p.scale.setScalar(m.p.userData.harvested ? 0.001 : s); m.stem.material.color.setHSL(hl > 0.5 ? 0.3 : 0.12, 0.55, 0.32 + hl * 0.08); m.fruit.visible = st >= 4; }
    }
    // control panel UI (live while open)
    function openPanel() {
      ctx.input.releaseLock();
      const S = state.sys; const out = h('div', { class: 'cx-gh' });
      const slider = (k, label, min, max, step, unit) => h('label', { class: 'cx-slider' }, h('span', {}, label), h('input', { type: 'range', min, max, step, value: S.set[k], oninput: e => { S.set[k] = +e.target.value; e.target.nextSibling.textContent = `${S.set[k]}${unit}`; } }), h('em', {}, `${S.set[k]}${unit}`));
      const controls = h('div', { class: 'cx-gh-ctrl' }, slider('temp', 'Temperature setpoint', 10, 30, 1, ' °C'), slider('hum', 'Humidity setpoint', 30, 90, 5, ' %'), slider('lightH', 'Light hours per day', 8, 24, 1, ' h'), slider('dose', 'Nutrient dosing', 0, 2, 0.5, '×'),
        h('label', { class: 'cx-tick' }, h('input', { type: 'checkbox', checked: !!S.set.fan, onchange: e => { S.set.fan = e.target.checked ? 1 : 0; } }), ' Air fans on'));
      const faults = h('div', { class: 'cx-gh-faults' });
      const read = h('div', { class: 'cx-gh-read' }), crops = h('div', { class: 'cx-gh-crops' });
      const draw = () => {
        const r = (l, v, ok) => `<div class="${ok ? 'good' : 'bad'}"><span>${l}</span><em>${v}</em></div>`;
        read.innerHTML = `<b>Day ${Math.floor(state.day)}</b>` + r('Temperature', `${S.temp.toFixed(1)} °C`, S.temp > 12 && S.temp < 29) + r('Humidity', `${S.hum.toFixed(0)} %`, S.hum > 40 && S.hum < 85) + r('Water tank', `${S.water.toFixed(0)} L`, S.water > 40) + r('Nutrients (EC)', S.ec.toFixed(1), S.ec >= 1.2 && S.ec <= 2.5) + r('Light', `${S.lightH.toFixed(0)} h/day`, true) + r('Airflow', S.air ? 'on' : 'off', !!S.air) + r('CO₂', `${Math.round(S.co2)} ppm`, S.co2 < 2000) + r('O₂', `${S.o2.toFixed(1)} %`, S.o2 < 23.5) + r('Power margin', `${S.power} kW`, S.power >= 0);
        crops.innerHTML = state.crops.map(c => { const C = CROPS[c], { health, issues } = cropHealth(c, S, link); return `<div class="cx-gh-crop"><b>${C.icon} ${C.name}</b> · ${STAGES[stageOf(c)]} (${Math.round(state.prog[c] / C.days * 100)}%)<br><small>Likes ${C.temp[0]}–${C.temp[1]} °C, ${C.hum[0]}–${C.hum[1]}% humidity, ${C.light[0]}–${C.light[1]} h light</small><div class="cx-bar"><i style="width:${Math.round(health * 100)}%;background:${health > 0.7 ? '#3fe0a0' : health > 0.4 ? '#ffb347' : '#ff6a6a'}"></i></div>${issues.length ? `<small class="bad">Problem: ${issues.join(', ')}</small>` : '<small class="good">Happy</small>'}</div>`; }).join('');
        const open = Object.keys(S.faults).filter(f => !S.fixed[f]);
        faults.replaceChildren(...(open.length ? open.map(f => { const F = FAULTS[f], spare = f === 'filter' ? 'filter' : f === 'led' ? 'spareLed' : null, canMain = !spare || has(spare);
          return h('div', { class: 'cx-gh-fault' }, h('b', {}, `⚠ ${F.name}`), h('small', {}, F.why), h('div', {}, h('button', { class: 'btn sm primary', disabled: !canMain, title: canMain ? '' : 'You did not buy a spare', onclick: () => { S.fixed[f] = true; sfx.good(); hud.cap(`[${F.fix}]`); draw(); } }, F.fix + (canMain ? '' : ' (no spare)')),
            F.alt ? h('button', { class: 'btn sm', onclick: () => { S.fixed[f] = true; S.fixed[f + 'Alt'] = true; sfx.ui(); hud.cap(`[${F.alt}]`); if (f === 'led') S.set.lightH = Math.min(24, S.set.lightH + 4); draw(); } }, F.alt) : null)); }) : [h('small', { class: 'good' }, 'No faults.')]));
      };
      draw();
      const iv = setInterval(draw, 500);
      panelOpen = openModal({ title: '🎛 Greenhouse control', label: 'Greenhouse control', wide: true, onClose: () => { clearInterval(iv); panelOpen = null; }, body: h('div', { class: 'cx-gh-grid' }, h('div', {}, h('h4', {}, 'Readings'), read, h('h4', {}, 'Faults'), faults), h('div', {}, h('h4', {}, 'Crops'), crops, h('h4', {}, 'Settings'), controls)),
        foot: [ctx.isDone('harvest') && !ctx.isDone('report') ? h('button', { class: 'btn primary', onclick: () => { panelOpen.close(); report(); } }, '📝 File mission report') : null, h('button', { class: 'btn', onclick: () => panelOpen.close() }, 'Close')].filter(Boolean) });
    }
    makeUsable(controlScreen, { label: 'Greenhouse control panel', verb: 'Use', range: 2.6, enabled: () => controlScreen.visible && ctx.isDone('plant'), use: openPanel }); ix.add(controlScreen);
    // harvest from the beds
    const bedHit = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.8, 4.2), new THREE.MeshBasicMaterial({ visible: false })); bedHit.position.set(0, 0.6, 0); scene.add(bedHit);
    makeUsable(bedHit, { label: 'Growing beds', verb: 'Harvest', range: 3, enabled: () => ctx.isDone('plant') && !ctx.isDone('harvest') && (ctx.isDone('grow') || (T.over && stageAvg() >= 3)), use: () => {
      for (const m of plantMeshes) m.p.userData.harvested = true;
      const y = state.crops.map(c => `${CROPS[c].icon} ${CROPS[c].name}: ${Math.round((state.yield[c] ?? 0) * 100)}% of a perfect harvest`).join(' · ');
      sfx.good(); ctx.done('harvest'); hud.flash(`Harvested! ${y}. File your report on the control panel.`, 'good', 6000);
    } }); ix.add(bedHit);
    async function report() {
      const qs = [...REPORT_Q].sort(() => Math.random() - 0.5).slice(0, 3);
      const r = await runQuiz({ title: '📝 Mission GREENHOUSE-01 report', intro: `Day ${Math.floor(state.day)}. Crops: ${state.crops.map(c => CROPS[c].name).join(' and ')}. Credits left: ${budget - state.spent}. Answer three questions for the science team.`, questions: qs });
      for (const w of r.wrong || []) ctx.mistake(`Report question missed: ${w}`);
      ctx.done('report'); finish();
    }
    // restore
    state.built.forEach(id => { showPiece(id); markers[id].visible = false; });
    if (state.built.length) ctx.steps.find(s => s.id === 'build').text = `Build the greenhouse: ${state.built.length} of 11 steps`;
    if (ctx.isDone('build')) controlScreen.visible = true;
    if (state.crops.length && ctx.isDone('plant')) makePlants(); else if (state.crops.length) setupPlanting();
    if (ctx.isDone('brief')) T.start();
    drawPallets();

    return {
      spawn: [-8, -4, -Math.PI * 0.75, 0],
      markerFor: id => ({ brief: osei.rig.root, store: term, build: state.asmActive ? asmMarker(state.asmActive) : markers[nextBuild()?.id] || null, lifesupport: lsMarker(), plant: plantMarker(), grow: controlScreen, harvest: bedHit, report: controlScreen }[id] || null),
      onEnter: () => { if (!ctx.isDone('brief')) hud.flash('Talk to Dr. Osei to begin.', '', 3500); },
      update(dt, blocked) {
        osei.update(dt); T.update(dt, blocked && !panelOpen); asmLights.update(dt); asmAir.update(dt); lsUpdate(dt, blocked); doorUpdate(dt);
        if (ctx.isDone('plant') && !ctx.isDone('harvest') && (!blocked || panelOpen)) sim(dt);
        if (state.sys) { drawPlants(); screenT -= dt; if (screenT < 0) { screenT = 0.6; const S = state.sys, open = Object.keys(S.faults).filter(f => !S.fixed[f]); controlScreen.userData.screen.redraw(infoScreen('GREENHOUSE CONTROL', [`Day ${Math.floor(state.day)} · ${state.crops.map(c => CROPS[c].icon + ' ' + STAGES[stageOf(c)]).join('  ')}`, `${S.temp.toFixed(0)} °C · ${S.hum.toFixed(0)}% · water ${S.water.toFixed(0)} L`, open.length ? [`⚠ ${FAULTS[open[0]].name}`, '#ff6a6a'] : ['All systems normal', '#3fe0a0']], { w: 512, hgt: 320 })); }
          if (!blocked && ctx.isDone('plant') && !ctx.isDone('harvest')) hud.setReadout('GREENHOUSE-01', [['Day', Math.floor(state.day), ''], ...state.crops.map(c => [CROPS[c].name, STAGES[stageOf(c)], cropHealth(c, state.sys, link).health > 0.7 ? 'good' : 'warn']), ['Faults', Object.keys(state.sys.faults).filter(f => !state.sys.fixed[f]).length || 'none', Object.keys(state.sys.faults).some(f => !state.sys.fixed[f]) ? 'bad' : 'good']]);
          else if (!blocked) hud.setReadout(null);
        }
      }
    };
    function finish() {
      const avg = state.crops.reduce((a, c) => a + (state.yield[c] ?? 0), 0) / Math.max(1, state.crops.length);
      finishExercise(ctx, { id: 'greenhouse', title: 'Space Greenhouse & Life Support', timer: T, xp: 300, badge: ['greenhouse-engineer', 'life-support-tech'], bonus: Math.round((avg - 0.85) * 40),
        science: `Your harvest reached ${Math.round(avg * 100)}% of a perfect crop. Space agencies are testing greenhouses like this for the Moon and Mars: NASA's Veggie and Advanced Plant Habitat on the space station, and the EDEN ISS greenhouse in Antarctica, which grew hundreds of kilograms of vegetables with LED light, hydroponics and recycled water. Plants also take in carbon dioxide and give out oxygen, so they can become part of a crew's life-support system.` });
    }
  }
};
