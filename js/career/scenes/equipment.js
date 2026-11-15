// ASTRO LAB Career — Training 7: Equipment Management. Unpack a cargo delivery into the right lockers, answer a crewmate
// who can't find something, and pack a spacewalk tool bag under a mass limit. On a space station, lost items stay lost.
import * as THREE from '../../../vendor/three.module.js';
import { MAT } from '../models/materials.js';
import { makeSign } from '../models/props.js';
import { std, box, cyl } from '../models/house.js';
import { makeTerminal, infoScreen } from '../models/centre.js';
import { LOOKS } from '../data/people.js';
import { makeUsable } from '../engine/interact.js';
import { trainingRoom, instructor, timer, finishExercise, invisibleMark } from './kit.js';
import { runQuiz } from '../ui/panels.js';
import { h, openModal } from '../../ui/dom.js';

const LOCKERS = { MED: ['MEDICAL', '#8a1f24', 0xc8202a], FOOD: ['FOOD', '#1f6b3a', 0x2e8a4a], TOOLS: ['TOOLS', '#6a4a1a', 0xd9a441], SCI: ['SCIENCE', '#1e2a52', 0x2b6ad8] };
const ITEMS = [
  ['firstaid', 'First-aid kit', 'MED', 0xffffff, [0.32, 0.2, 0.22]], ['meds', 'Medicine pack', 'MED', 0xf2d0d0, [0.22, 0.1, 0.16]],
  ['food', 'Food pouches', 'FOOD', 0xd9a441, [0.34, 0.16, 0.24]], ['drinks', 'Drink bags', 'FOOD', 0x9fd0ff, [0.3, 0.14, 0.2]],
  ['wrench', 'Torque wrench', 'TOOLS', 0x9aa3b2, [0.4, 0.06, 0.08]], ['tape', 'Duct tape', 'TOOLS', 0x8a8f99, [0.14, 0.06, 0.14]],
  ['tubes', 'Sample tubes', 'SCI', 0xdff6ff, [0.22, 0.12, 0.12]], ['camera', 'Microscope camera', 'SCI', 0x2a2d33, [0.18, 0.14, 0.14]]
];
const BAG = [ // spacewalk tool bag: [id, name, kg, required]
  ['tether', 'Spare safety tether', 1.2, true], ['pgt', 'Pistol grip tool', 3.6, true], ['sockets', 'Socket set', 1.5, true], ['camera', 'Helmet camera', 0.8, true],
  ['wipes', 'Cleaning wipes', 0.3, false], ['bags', 'Trash bags', 0.4, false], ['hammer', 'Hammer', 1.4, false], ['laptop', 'Laptop', 3.2, false], ['ladder', 'Folding step', 4.5, false]
];

export default {
  id: 'equipment', title: 'Equipment Management', music: 'centre', ambience: 'vent',
  steps: [
    { id: 'brief', text: 'Talk to Stowage Lead Kim' },
    { id: 'stow', text: 'Stow all 8 cargo items in the right lockers' },
    { id: 'find', text: 'Help the crewmate find things (inventory terminal)' },
    { id: 'pack', text: 'Pack the spacewalk tool bag under the mass limit' }
  ],
  initialState: { steps: {}, mistakes: [], stowed: {} },

  async build(ctx) {
    const { scene, player, carry, ix, hud, sfx, state } = ctx;
    trainingRoom(ctx, { w: 12, d: 9, title: 'STOWAGE', sub: 'A place for everything', light: 1 });
    const T = timer(ctx, 300);
    const limit = Math.round(8.4 * (ctx.diff.budget >= 1.5 ? 1.15 : ctx.diff.budget < 1 ? 0.95 : 1) * 10) / 10;
    // cargo bag (open) with the items on a table
    const tbl = new THREE.Group(); box(2.4, 0.06, 0.9, std(0xe8ebf0), 0, 0.9, 0, tbl); for (const [x, z] of [[-1.1, -0.38], [1.1, -0.38], [-1.1, 0.38], [1.1, 0.38]]) box(0.05, 0.88, 0.05, MAT.metal(), x, 0.44, z, tbl); tbl.position.set(0, 0, 0.6); scene.add(tbl); player.addBox(-1.25, 1.25, 0.1, 1.1, 0, 1);
    const cargo = new THREE.Group(); box(0.8, 0.4, 0.6, std(0xf2f2f2, { roughness: 0.95 }), 0, 0.2, 0, cargo); cargo.position.set(-1.5, 0, 2.0); scene.add(cargo); player.addBox(-1.9, -1.1, 1.7, 2.3, 0, 0.5);
    const cs = makeSign('CARGO', 'Unpack me', 0.72); cs.position.set(-1.5, 0.2, 2.305); scene.add(cs); // on the bag's front face (it used to float in mid-air in front of it)
    const objs = ITEMS.map(([id, name, cat, col, [w, hh, d]], i) => {
      const o = new THREE.Group(); box(w, hh, d, std(col, { roughness: 0.6 }), 0, hh / 2, 0, o); box(Math.min(w, 0.1), 0.012, 0.05, std(0xffffff), 0, hh + 0.006, 0, o);
      o.traverse(m => { if (m.isMesh) m.castShadow = true; }); o.position.set(-1.0 + (i % 4) * 0.66, 0.93, 0.35 + Math.floor(i / 4) * 0.45); scene.add(o);
      carry.makeCarriable(o, { id, name }); o.userData.cat = cat;
      if (state.stowed[id]) o.visible = false; return o;
    });
    // lockers on the north wall
    const keys = Object.keys(LOCKERS);
    const socks = keys.map((k, i) => {
      const [name, sc, col] = LOCKERS[k], x = -4.2 + i * 2.8;
      const l = new THREE.Group(); box(1.6, 2.0, 0.6, std(0xd9dce2, { roughness: 0.5 }), 0, 1.0, 0, l); box(1.5, 1.9, 0.02, std(col, { roughness: 0.5 }), 0, 1.0, 0.31, l); box(0.1, 0.3, 0.03, MAT.metal(), 0.6, 1.0, 0.33, l);
      l.position.set(x, 0, -4.1); scene.add(l); player.addBox(x - 0.8, x + 0.8, -4.5, -3.8, 0, 2.1);
      const s = makeSign(name, '', 1.2, sc); s.position.set(x, 2.4, -3.78); scene.add(s);
      const sock = invisibleMark(scene, x, 1.0, -3.7); sock.scale.set(5, 6, 1.5);
      carry.makeSocket(sock, { accepts: () => true, label: `${name} locker`,
        check: o => o.userData.cat === k ? { ok: true } : { ok: false, msg: `${o.userData.carry.name} doesn't belong in ${name}. Think about who would look for it there.` },
        onMistake: () => ctx.mistake(`Tried to stow something in the wrong locker.`),
        onPlace: o => { sock.userData.filled = null; o.visible = false; o.userData.locked = true; state.stowed[o.userData.carry.id] = k; hud.cap(`[Beep: ${o.userData.carry.name} scanned into ${name}]`, 1800); if (ITEMS.every(([id]) => state.stowed[id])) { ctx.done('stow'); hud.flash('All stowed. Check the inventory terminal.', 'good'); } } });
      return sock;
    });
    // inventory terminal
    const term = makeTerminal(infoScreen('INVENTORY', ['Barcode scanner: ready', ['Crew request waiting', '#ffc857']], { w: 512, hgt: 320 })); term.position.set(4.6, 0, 1.6); term.rotation.y = -Math.PI / 2; scene.add(term); player.addBox(4.3, 4.9, 1.3, 1.9, 0, 1.3);
    makeUsable(term, { label: 'Inventory terminal', verb: 'Use', range: 2.4, enabled: () => ctx.isDone('stow') && !ctx.isDone('find'), use: async () => {
      ctx.input.releaseLock();
      const pick = [...ITEMS].sort(() => Math.random() - 0.5).slice(0, 3);
      const names = Object.fromEntries(keys.map(k => [k, LOCKERS[k][0] + ' locker']));
      const r = await runQuiz({ title: '📟 Crew request', intro: 'Your crewmate on the station radio: "Hey, where did the new stuff go?" Use the inventory you just made.',
        questions: pick.map(([id, name, cat]) => ({ q: `Where is the ${name.toLowerCase()}?`, options: [names[cat], ...keys.filter(k => k !== cat).map(k => names[k])], explain: `It was scanned into the ${names[cat]}.` })) });
      for (const w of r.wrong || []) ctx.mistake(`Sent the crew to the wrong locker: ${w}`);
      ctx.done('find'); hud.flash('Next: pack the spacewalk tool bag on the bench.', '', 3500);
    } }); ix.add(term);
    // EVA tool bag on a bench
    const bag = new THREE.Group(); box(0.55, 0.3, 0.3, std(0xf2f2f2, { roughness: 0.95 }), 0, 0.15, 0, bag); box(0.57, 0.05, 0.32, std(0x2b6ad8), 0, 0.325, 0, bag); bag.position.set(-4.8, 0.93, 1.6); scene.add(bag); // lid sits on top of the body (they used to share a top face and flicker)
    const bench = new THREE.Group(); box(1.2, 0.06, 0.7, std(0xe8ebf0), 0, 0.9, 0, bench); box(1.1, 0.86, 0.6, std(0xc0c4cc), 0, 0.44, 0, bench); bench.position.set(-4.8, 0, 1.6); scene.add(bench); player.addBox(-5.4, -4.2, 1.25, 1.95, 0, 1);
    const bs = makeSign('EVA TOOL BAG', `Max ${limit} kg`, 1.1); bs.position.set(-5.96, 1.9, 1.6); bs.rotation.y = Math.PI / 2; scene.add(bs);
    makeUsable(bag, { label: 'Spacewalk tool bag', verb: 'Pack', range: 2.4, enabled: () => ctx.isDone('find') && !ctx.isDone('pack'), use: () => {
      ctx.input.releaseLock(); const sel = new Set();
      const total = h('p', { class: 'cx-total' });
      const upd = () => { const kg = BAG.filter(b => sel.has(b[0])).reduce((a, b) => a + b[2], 0); total.innerHTML = `Total: <b>${kg.toFixed(1)} kg</b> of ${limit} kg max`; total.style.color = kg > limit ? '#ff8a8a' : ''; };
      const list = h('div', { class: 'cx-ticks' }, BAG.map(([id, name, kg]) => h('label', { class: 'cx-tick' }, h('input', { type: 'checkbox', onchange: e => { e.target.checked ? sel.add(id) : sel.delete(id); upd(); } }), ` ${name} (${kg} kg)`)));
      upd();
      const m = openModal({ title: '🎒 Pack the tool bag', label: 'Pack the tool bag', closable: true, body: h('div', {}, h('p', {}, 'Tomorrow\'s spacewalk replaces a camera on the station\'s truss. The task card lists: a spare tether, the pistol grip tool with its socket set, and a helmet camera. Extra mass makes the bag harder to control.'), list, total),
        foot: [h('button', { class: 'btn primary', onclick: () => {
          const kg = BAG.filter(b => sel.has(b[0])).reduce((a, b) => a + b[2], 0), miss = BAG.filter(b => b[3] && !sel.has(b[0]));
          if (miss.length) { sfx.wrong(); ctx.mistake(`Tool bag was missing: ${miss.map(b => b[1].toLowerCase()).join(', ')}.`); hud.flash(`Missing from the task card: ${miss.map(b => b[1]).join(', ')}.`, 'bad', 4000); return; }
          if (kg > limit) { sfx.wrong(); ctx.mistake(`Tool bag was over the mass limit (${kg.toFixed(1)} kg).`); hud.flash(`Too heavy: ${kg.toFixed(1)} kg. Take out what the task doesn't need.`, 'bad', 4000); return; }
          m.close(); sfx.good(); ctx.done('pack'); finish(kg);
        } }, 'Seal the bag ✓')] });
    } }); ix.add(bag);
    const kim = instructor(ctx, LOOKS.registrar, 'Stowage Lead Kim', [2.6, 2.6, -Math.PI * 0.75], () => ctx.isDone('brief') ? [{ who: 'Stowage Lead Kim', text: !ctx.isDone('stow') ? 'Each locker has a colour and a name. Medical things in MEDICAL, food and drink in FOOD, and so on.' : !ctx.isDone('find') ? 'The inventory terminal is by the east wall.' : 'Pack only what the task card needs, and stay under the mass limit.' }] : [
      { who: 'Stowage Lead Kim', text: 'Hi {name}, we met at registration. Here I\'m the stowage lead. On the station, there\'s no "it rolled under the sofa". Anything you don\'t stow properly floats away, and crews have spent hours hunting for lost items.' },
      { who: 'Stowage Lead Kim', text: 'A cargo ship just arrived. Unpack the eight items into the right lockers: every one gets scanned as you stow it. Then answer the crew\'s questions and pack tomorrow\'s spacewalk bag.', do: () => { if (ctx.done('brief')) T.start(); } }]);

    return {
      spawn: [0, 3.2, 0, 0],
      markerFor: id => ({ brief: kim.rig.root, stow: carry.held ? socks[keys.indexOf(carry.held.userData.cat)] : objs.find(o => o.visible), find: term, pack: bag }[id] || null),
      onEnter: () => { if (!ctx.isDone('brief')) hud.flash('Talk to Stowage Lead Kim to begin.', '', 3500); },
      update(dt, blocked) { kim.update(dt); T.update(dt, blocked); }
    };
    function finish(kg) {
      finishExercise(ctx, { id: 'equipment', title: 'Equipment Management', timer: T, xp: 130, bonus: kg < limit - 1.5 ? 5 : 0,
        science: 'The space station holds tens of thousands of items, each with a barcode. Crews scan everything they stow into a computer inventory so that the next crew, or Mission Control, can find it. Mass matters too: every kilogram launched to space costs a lot of money, and a heavy tool bag is harder to control during a spacewalk because of its inertia.' });
    }
  }
};
