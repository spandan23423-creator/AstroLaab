// ASTRO LAB Career — Training 3: Suit Mobility Course. Walk a numbered course in a weighted training suit: gates in order,
// a crouch tunnel, steps and a ramp, then carry a sample box to the drop pad. The suit is heavy and stiff, so you move slowly.
import * as THREE from '../../../vendor/three.module.js';
import { MAT, TEX } from '../models/materials.js';
import { makeSign } from '../models/props.js';
import { std, box } from '../models/house.js';
import { LOOKS } from '../data/people.js';
import { trainingRoom, instructor, timer, finishExercise, floorMark, invisibleMark } from './kit.js';

const GATES = [[-6, 3.5, 0], [-6, 0.2, 0], [-6, -4.6, 0], [1.6, -4.5, 1], [6.4, -2, 0], [6.4, 2.5, 0]];
// steps up to a platform and down a ramp
const PLAT = { x0: 0, x1: 3.2, z0: -5.6, z1: -3.4, y: 0.45 };
const TUN = { x0: -6.8, x1: -5.2, z0: -3.2, z1: -0.8 };

export default {
  id: 'mobility', title: 'Suit Mobility Course', music: 'centre', ambience: 'vent',
  steps: [
    { id: 'brief', text: 'Talk to Coach Lindqvist and put on the training suit' },
    { id: 'gates', text: 'Walk through gates 1 to 6 in order (crouch in the tunnel)' },
    { id: 'carry', text: 'Carry the sample box to the yellow drop pad' }
  ],
  initialState: { steps: {}, mistakes: [], next: 0, warned: {}, tunnel: false },

  async build(ctx) {
    const { scene, player, carry, ix, hud, sfx, state } = ctx;
    trainingRoom(ctx, { w: 16, d: 13, hgt: 4, title: 'MOBILITY COURSE', sub: 'Gates in order · crouch · steps · carry' });
    const T = timer(ctx, 240);
    // suit makes you slow
    const suited = () => { player.speed = { walk: 1.35, sprint: 1.9, crouch: 0.75 }; };
    if (ctx.isDone('brief')) suited();
    // gates
    const gates = GATES.map(([x, z, r], i) => {
      const g = new THREE.Group(), m = MAT.glow(0xffc857, 0.5);
      box(0.12, 2.3, 0.12, m, -0.8, 1.15, 0, g); box(0.12, 2.3, 0.12, m, 0.8, 1.15, 0, g); box(1.72, 0.12, 0.12, m, 0, 2.3, 0, g);
      const n = makeSign(String(i + 1), '', 0.6); n.position.set(0, 2.65, 0.07); g.add(n); const n2 = n.clone(); n2.rotation.y = Math.PI; n2.position.z = -0.07; g.add(n2);
      g.position.set(x, i === 3 ? PLAT.y : 0, z); g.rotation.y = r ? Math.PI / 2 : 0; scene.add(g); return g;
    });
    const paint = () => gates.forEach((g, i) => g.children.slice(0, 3).forEach(b => { const c = i < state.next ? 0x3fe0a0 : i === state.next ? 0xffc857 : 0x6a7080; b.material.color.set(c); b.material.emissive.set(c); }));
    paint();
    // crouch tunnel after gate 2
    const tm = std(0x3e5c8a, { roughness: 0.6 }), tl = TUN.z1 - TUN.z0, tz = (TUN.z0 + TUN.z1) / 2;
    box(TUN.x1 - TUN.x0 + 0.2, 0.12, tl, tm, (TUN.x0 + TUN.x1) / 2, 1.32, tz, scene);
    box(0.1, 1.32, tl, tm, TUN.x0 - 0.05, 0.66, tz, scene); box(0.1, 1.32, tl, tm, TUN.x1 + 0.05, 0.66, tz, scene);
    player.addBox(TUN.x0 - 0.1, TUN.x0, TUN.z0, TUN.z1, 0, 1.4); player.addBox(TUN.x1, TUN.x1 + 0.1, TUN.z0, TUN.z1, 0, 1.4); player.addBox(TUN.x0, TUN.x1, TUN.z0, TUN.z1, 1.26, 1.4, 'tunnel');
    const ts = makeSign('CROUCH', 'Hold C or Ctrl', 1); ts.position.set(-6, 1.75, TUN.z1 + 0.02); scene.add(ts);
    // platform with steps (west side) and a ramp (east side)
    const pm = std(0x9aa3b2, { roughness: 0.8 }), pz = (PLAT.z0 + PLAT.z1) / 2, pd = PLAT.z1 - PLAT.z0;
    box(PLAT.x1 - PLAT.x0, PLAT.y, pd, pm, (PLAT.x0 + PLAT.x1) / 2, PLAT.y / 2, pz, scene);
    for (let i = 0; i < 3; i++) box(0.3, PLAT.y * (i + 1) / 3, pd, pm, PLAT.x0 - 0.75 + i * 0.3, PLAT.y * (i + 1) / 6, pz, scene);
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.06, pd), pm); ramp.position.set(PLAT.x1 + 1, PLAT.y / 2, pz); ramp.rotation.z = -Math.atan2(PLAT.y, 2); ramp.receiveShadow = true; scene.add(ramp);
    floorMark(scene, PLAT.x0 - 0.45, pz, 0.9, pd, 0xf2b632).position.y = 0.004;
    player.floorAt = (x, z) => {
      if (z < PLAT.z0 || z > PLAT.z1) return 0;
      if (x >= PLAT.x0 && x <= PLAT.x1) return PLAT.y;
      if (x >= PLAT.x0 - 0.9 && x < PLAT.x0) return PLAT.y * Math.ceil((x - (PLAT.x0 - 0.9)) / 0.3) / 3;
      if (x > PLAT.x1 && x <= PLAT.x1 + 2) return PLAT.y * (1 - (x - PLAT.x1) / 2);
      return 0;
    };
    // sample box and the drop pad
    const crate = new THREE.Group(); box(0.45, 0.3, 0.35, std(0xe8ebf0), 0, 0.15, 0, crate); box(0.47, 0.05, 0.37, std(0x2b6ad8), 0, 0.325, 0, crate); crate.position.set(6.4, 0, 5.3); scene.add(crate); // lid sits on top of the body (their top faces used to share a plane and flicker)
    carry.makeCarriable(crate, { id: 'sample', name: 'Sample box' });
    const pad = floorMark(scene, -2.5, 5.2, 1.2, 1.2); const padSock = invisibleMark(scene, -2.5, 0.2, 5.2); padSock.scale.set(4, 1.4, 4);
    const ps = makeSign('DROP PAD', 'Sample box here', 1.1); ps.position.set(-2.5, 1.3, 6.46); ps.rotation.y = Math.PI; scene.add(ps);
    carry.makeSocket(padSock, { accepts: 'sample', label: 'Drop pad', lock: true, onPlace: () => { ctx.done('carry'); finish(); } });
    const coach = instructor(ctx, LOOKS.coach, 'Coach Lindqvist', [-0.8, 2.6, -Math.PI / 2], () => ctx.isDone('brief') ? [{ who: 'Coach Lindqvist', text: !ctx.isDone('gates') ? `Gate ${state.next + 1} is next. Yellow means next, green means done.` : 'Grab the sample box near gate 6 and bring it to the drop pad.' }] : [
      { who: 'Coach Lindqvist', text: 'I\'m Coach Lindqvist. Today you move like an astronaut in a suit: heavy, stiff and slow. This training suit adds weight and stops your knees bending far.' },
      { who: 'Coach Lindqvist', text: 'Walk through the six gates in order. Gate 2 leads into a low tunnel, so crouch. Then climb the steps, go down the ramp, and finish by carrying a sample box to the drop pad.' },
      { who: 'Coach Lindqvist', text: 'Don\'t skip a gate. On the Moon a missed waypoint means a lost astronaut. Suit on!', do: () => { if (ctx.done('brief')) { suited(); T.start(); sfx.carDoor(); hud.cap('[The training suit clicks shut. Everything feels heavier.]', 3000); } } }]);

    return {
      spawn: [-2.2, 4.4, Math.PI / 2, 0],
      markerFor: id => ({ brief: coach.rig.root, gates: gates[Math.min(state.next, 5)], carry: carry.held ? padSock : crate }[id] || null),
      onEnter: () => { if (!ctx.isDone('brief')) hud.flash('Talk to Coach Lindqvist to begin.', '', 3500); },
      update(dt, blocked) {
        coach.update(dt); T.update(dt, blocked);
        if (!ctx.isDone('brief') || ctx.isDone('gates')) return;
        const p = player.pos;
        if (p.x > TUN.x0 && p.x < TUN.x1 && p.z > TUN.z0 && p.z < TUN.z1) state.tunnel = true;
        GATES.forEach(([x, z], i) => {
          if (Math.hypot(p.x - x, p.z - z) > 0.75) return;
          if (i === 2 && i === state.next && !state.tunnel && !state.warned.tun) { state.warned.tun = true; ctx.mistake('Walked around the crouch tunnel instead of through it.'); hud.flash('You went around the tunnel. In a real cave or under a rover you would have to crouch.', 'bad'); }
          if (i === state.next) { state.next++; sfx.good(); hud.cap(`[Gate ${i + 1} ✓]`, 1500); paint(); ix.mark(gates[Math.min(state.next, 5)]); if (state.next === 6) { ctx.done('gates'); hud.flash('Course complete! Now carry the sample box to the drop pad.', 'good'); } }
          else if (i > state.next && !state.warned[i]) { state.warned[i] = true; sfx.wrong(); hud.flash(`That's gate ${i + 1}. You missed gate ${state.next + 1}: go back.`, 'bad'); ctx.mistake(`Reached gate ${i + 1} before gate ${state.next + 1}.`); }
        });
      }
    };
    function finish() {
      player.speed = { walk: 2.3, sprint: 4, crouch: 1.2 };
      finishExercise(ctx, { id: 'mobility', title: 'Suit Mobility Course', timer: T, xp: 120,
        science: 'A pressurised spacesuit is like a balloon in the shape of a person: bending a joint squeezes the air inside, so every movement takes effort. Suit engineers add bearings and pleated joints to help. On the Moon, Apollo astronauts found it easier to hop than to walk, and they fell over now and then because the suit hid their feet and moved their balance point.' });
    }
  }
};
