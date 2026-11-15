// ASTRO LAB Career — Chapter 1, The drive: ride in the back of the family car from the suburbs, along the highway, to the training centre.
// The car stays still at the origin; the road, ground and scenery scroll past.
import * as THREE from '../../../vendor/three.module.js';
import { TEX, MAT } from '../models/materials.js';
import { makeCar, makeRoadHouse, makeTree, makeLamppost, makePowerPole, makeRoadSign, makeFence, makeFlag, waveFlag, makeTrainingCentre, makeDisplayRocket, makeDaySky } from '../models/outdoor.js';
import { makePerson, animatePerson } from '../models/humans.js';
import { LOOKS } from '../data/people.js';
import { setAmbienceRate } from '../engine/audio.js';

const STOP = 1500;                         // metres to the training centre car park
const EYE = new THREE.Vector3(0.0, 1.24, 0.86); // rear seat, middle (sees the road between the front seats)
const ROAD_X = -1.8;                       // the car drives in the right-hand lane

export default {
  id: 'car', title: 'Chapter 1 · The drive', music: 'home', ambience: 'car',
  steps: [
    { id: 'ride', text: 'Ride to the training centre (look around · L re-reads your letter)', touch: 'Ride to the training centre (drag to look around · ✉ re-reads your letter)' },
    { id: 'exit', text: 'Open the car door (E)', touch: 'Open the car door (✋)' }
  ],
  initialState: { steps: {}, mistakes: [], d: 0, talked: {} },

  async build(ctx) {
    const { scene, world, player, hud, sfx, state } = ctx;
    scene.background = new THREE.Color(0x62a0e0); scene.fog = new THREE.Fog(0xcfe4f6, 90, 420); scene.add(makeDaySky()); // blue sky with clouds (fog colour matches its horizon)
    world.camera.far = 600; world.camera.updateProjectionMatrix();
    scene.add(new THREE.HemisphereLight(0xdfefff, 0x6a7a55, 1.1));
    const sun = world.shadowLight(new THREE.DirectionalLight(0xfff1d6, 2.2)); sun.position.set(30, 40, 10); sun.target.position.set(0, 0, 0);
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 120 }); scene.add(sun, sun.target);

    // ---------- ground and road (textures scroll) ----------
    const grassT = TEX.grass([120, 120]).clone(); grassT.needsUpdate = true; grassT.repeat.set(120, 120);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), MAT.std({ map: grassT, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; scene.add(ground);
    const roadT = TEX.road([1, 60]).clone(); roadT.needsUpdate = true; roadT.repeat.set(1, 60);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 600), MAT.std({ map: roadT, roughness: 0.85 })); road.rotation.x = -Math.PI / 2; road.position.set(ROAD_X, 0.005, -200); road.receiveShadow = true; scene.add(road);
    const kerbM = MAT.std({ color: 0xb9b6ae, roughness: 0.9 });
    for (const x of [ROAD_X - 4.4, ROAD_X + 4.4]) { const k = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 600), kerbM); k.position.set(x, 0.06, -200); k.receiveShadow = true; scene.add(k); }

    // ---------- the car with the family inside ----------
    const car = makeCar(0x3a6ea5); scene.add(car);
    const bug = makePerson(LOOKS.bug); bug.root.position.set(-0.4, 0.13, -0.12); bug.root.rotation.y = Math.PI; bug.sitTarget = bug.sit = 1; car.add(bug.root);
    const cat = makePerson(LOOKS.cat); cat.root.position.set(0.4, 0.13, -0.12); cat.root.rotation.y = Math.PI; cat.sitTarget = cat.sit = 1; car.add(cat.root);
    // Bug's hands on the wheel
    const R = bug.arms.find(a => a.side === 1), Lf = bug.arms.find(a => a.side === -1);
    player.seat = { pos: EYE.clone(), yaw: 0, yawRange: 2.0, pitchMin: -0.8, pitchMax: 0.8, roll: 0 };
    player.floorAt = () => 0;

    // ---------- scenery pool: objects live at a road distance s and scroll past ----------
    const items = [];
    const place = (obj, s, x, rotY = 0) => { obj.position.set(x, 0, 0); obj.rotation.y = rotY; obj.userData.s = s; scene.add(obj); items.push(obj); return obj; };
    const rnd = (n => () => (n = (n * 16807) % 2147483647) / 2147483647)(12345);
    for (let s = 20; s < STOP + 200; s += 16) {
      const zone = s < 450 ? 'suburb' : s < 1250 ? 'highway' : 'campus';
      for (const side of [-1, 1]) {
        const x0 = ROAD_X + side * 5.2, r = rnd();
        if (zone === 'suburb') {
          if (side === 1 && (s % 48) < 16) place(makeLamppost(), s, x0, 0);
          if (r < 0.7 && (s % 32) < 16) place(makeRoadHouse(s + side), s + 6, ROAD_X + side * 15, side > 0 ? -Math.PI / 2 : Math.PI / 2);
          else if (r < 0.95) place(makeTree((s / 16) | 0, 0.9 + rnd() * 0.4), s, ROAD_X + side * (8 + rnd() * 3));
        } else if (zone === 'highway') {
          if (side === -1 && (s % 64) < 16) place(makePowerPole(), s, ROAD_X - 9);
          if (r < 0.65) place(makeTree((s / 16) | 0, 1 + rnd() * 0.6), s, ROAD_X + side * (10 + rnd() * 25)); // fuller roadside: the highway stretch looked empty
          if (rnd() < 0.4) place(makeTree((s / 16) | 0 + 7, 1.3 + rnd() * 0.8), s + 8, ROAD_X + side * (40 + rnd() * 60));
        } else {
          if (side === 1 && s < STOP + 10) { const f = place(makeFence(16), s, ROAD_X + 7.5, Math.PI / 2); void f; }
          else if (r < 0.4) place(makeTree((s / 16) | 0, 1.1), s, ROAD_X - 9 - rnd() * 10);
        }
      }
    }
    place(makeRoadSign('Astronaut Training Centre', '1 km · next right', '#1f4f8a'), 520, ROAD_X + 5.6, 0);
    place(makeRoadSign('Astronaut Training Centre', 'Turn right here', '#1f4f8a'), 1180, ROAD_X + 5.6, 0);
    place(makeRoadSign('Welcome, cadets', 'Junior Astronaut Training Program', '#0d2f6e'), 1300, ROAD_X + 5.6, 0);
    const centre = place(makeTrainingCentre(), STOP + 55, 22, -Math.PI / 2 + 0.25);
    const rocket = place(makeDisplayRocket(1), STOP + 18, 15);
    const flags = ['emblem', 'class', 'emblem'].map((k, i) => place(makeFlag(k), STOP + 25 + i * 5, 10));
    // distant hills all round the horizon (they stay put: at this distance there is almost no parallax), so the edges of the
    // world are never an empty flat line
    { const hm = MAT.std({ color: 0x6f8a5a, roughness: 1 }); let hs = 99; const hr = () => (hs = (hs * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2 + hr() * 0.2, d = 330 + hr() * 60, hgt = 18 + hr() * 30, w = 60 + hr() * 70; const m = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), hm); m.scale.set(w, hgt, w * 0.7); m.position.set(Math.sin(a) * d, -1, Math.cos(a) * d); scene.add(m); } }
    // oncoming traffic
    const traffic = [0xb83a3a, 0xe6e6e6, 0x2f3a46, 0x6a8a4a].map(c => { const t = makeCar(c, { interior: false }); t.rotation.y = Math.PI; t.position.x = ROAD_X - 1.9; t.userData.s = 999999; scene.add(t); return t; });
    let tIdx = 0, tTimer = 4;

    // ---------- driving ----------
    let d = Math.min(state.d || 0, STOP), v = d >= STOP ? 0 : 6, stopped = d >= STOP, t = 0;
    const api = { timeScale: 1 };
    const target = s => s < 80 ? 9 : s < 430 ? 13 : s < 470 ? 16 : s < 1150 ? 26 : s < 1250 ? 14 : s < STOP - 120 ? 10 : Math.max(0, (STOP - s) * 0.09);
    const talks = [
      { at: 60, id: 'nervous', script: [
        { who: 'Cat', text: 'Are you nervous, {name}?', choices: [
          { text: 'A little bit, yes.', goto: 'little' }, { text: 'No way. I\'m ready!', goto: 'ready' }, { text: 'What if I mess something up?', goto: 'mess' }] },
        { id: 'little', who: 'Cat', text: 'That\'s normal. Real astronauts get butterflies too. Being a bit nervous means you care.', goto: 'end' },
        { id: 'ready', who: 'Bug', text: 'Ha! That\'s the spirit. Just remember to listen to your instructors.', goto: 'end' },
        { id: 'mess', who: 'Bug', text: 'Then you\'ll learn from it. That\'s what training is for. Astronauts practise things hundreds of times on the ground.', goto: 'end' }] },
      { at: 620, id: 'pool', script: [
        { who: 'Bug', text: 'Did you know astronauts practise spacewalks underwater?' },
        { who: 'Bug', text: 'NASA\'s Neutral Buoyancy Laboratory in Houston is a giant pool, about 12 metres deep, holding around 23 million litres of water. A full-size piece of the space station sits on the bottom.' },
        { who: 'Cat', text: 'They add weights and floats to the suit until it neither sinks nor floats. That\'s as close to weightlessness as you can get on the ground for hours at a time.', choices: [
          { text: 'Will I get to train in a pool?', goto: 'will' }, { text: 'That\'s so cool.', goto: 'cool' }] },
        { id: 'will', who: 'Bug', text: 'Read your letter again, kiddo. "Spacewalk practice." I\'d bet on it.', goto: 'end' },
        { id: 'cool', who: 'Cat', text: 'It is. And you\'re about to see the real thing.', goto: 'end' }] },
      { at: 1330, id: 'there', script: [
        { who: 'Cat', text: 'Look, {name}! There it is, on the right. The Astronaut Training Centre.' },
        { who: 'Bug', text: 'And would you look at that rocket out front. Big day.' }] }
    ];
    let talkingNow = null, doorOpen = false;
    async function runTalk(tk) { talkingNow = tk.id; state.talked[tk.id] = true; await ctx.talk(tk.script); talkingNow = null; }
    function arrive() {
      if (stopped && ctx.isDone('ride')) return; stopped = true; ctx.done('ride');
      hud.cap('[Engine stops · seatbelt clicks]'); setAmbienceRate(0);
      setTimeout(async () => { await ctx.talk([{ who: 'Bug', text: 'Here we are. Out you get, astronaut. We\'ll walk you to the door.' }]); hud.flash(ctx.input.touch ? 'Tap ✋ to open the car door.' : 'Press E to open the car door.', '', 4000); }, 600);
    }
    if (stopped && !ctx.isDone('ride')) arrive();

    const tmp = new THREE.Vector3();
    Object.assign(api, {
      spawn: [EYE.x, EYE.z, 0.22, -0.04, 0],
      markerFor: () => null,
      onEnter: () => { if (!stopped) hud.flash(ctx.input.touch ? 'Drag to look out of the windows.' : 'Move the mouse to look out of the windows. Press L to read your letter again.', '', 4500); },
      defaultPrompt: () => ctx.isDone('ride') && !ctx.isDone('exit') ? { verb: 'Open', label: 'the car door' } : null,
      onUse: () => { if (ctx.isDone('ride') && !ctx.isDone('exit')) { sfx.carDoor(); ctx.done('exit'); doorOpen = true; setTimeout(() => ctx.goto('arrival'), 900); } },
      // The drive is a ride: it can be skipped to the car park (conversations on the way are optional chat)
      cinematic: () => !stopped && !ctx.dlg.active,
      skipCinematic: () => { if (stopped) return; for (const tk of talks) state.talked[tk.id] = true; d = STOP; v = 0; arrive(); },
      saveState: st => { st.d = Math.round(d); },
      update(dt, blocked) {
        t += dt; const frozen = blocked && !ctx.dlg.active; // paused or reading the letter: the car waits
        const k = frozen ? 0 : dt * api.timeScale;
        if (!stopped) {
          const tv = target(d); v += Math.max(-4 * k, Math.min(2.5 * k, tv - v)); v = Math.max(d < STOP - 2 ? 2 : 0, v);
          d = Math.min(STOP, d + v * k); setAmbienceRate(v / 26);
          if (d >= STOP - 0.5) arrive();
        }
        for (const tk of talks) if (!state.talked[tk.id] && d >= tk.at && !talkingNow && !blocked) runTalk(tk);
        // scroll the world
        const off = d;
        roadT.offset.y = (off / 10) % 1; grassT.offset.y = (off / 7.5) % 1;
        for (const o of items) { const z = -(o.userData.s - off); o.position.z = z; o.visible = z < 30 && z > -440; } // appear only once fully inside the fog (no pop-in)
        for (const f of flags) if (f.visible) waveFlag(f, t);
        // traffic
        tTimer -= k; if (tTimer <= 0 && d > 80 && d < STOP - 150) { tTimer = 5 + Math.random() * 8; const c = traffic[tIdx++ % traffic.length]; c.userData.z = -440; }
        for (const c of traffic) if (c.userData.z != null) { c.userData.z += (v + 18) * k; c.position.z = c.userData.z; c.visible = c.userData.z < 40; if (c.userData.z > 40) c.userData.z = null; } else c.visible = false;
        // car motion: wheels, a little body sway, the steering wheel and Bug's hands
        car.userData.wheels.forEach(w => w.rotation.x -= v * k / 0.33);
        car.userData.steerWheels.forEach(w => { w.rotation.y = Math.sin(t * 0.6) * 0.03; });
        const rd = car.userData.doors.find(o => o.side === 1 && !o.front); if (rd) { rd.open += ((doorOpen ? 1 : 0) - rd.open) * Math.min(1, dt * 5); rd.g.rotation.y = rd.open * 1.1; }
        const sway = stopped ? 0 : Math.sin(t * 1.3) * 0.004 + Math.sin(t * 7.1) * 0.0015 * (v / 20);
        car.position.y = sway; car.rotation.z = Math.sin(t * 0.7) * 0.004 * (v / 20);
        player.seat.pos.copy(EYE).add(car.position);
        car.userData.steer.rotation.z = Math.sin(t * 0.6) * 0.08;
        // people: Bug watches the road; Cat glances back when talking
        world.camera.getWorldPosition(tmp);
        const who = ctx.dlg.active ? (ctx.dlg.el.querySelector('.cx-who')?.textContent || '') : '';
        animatePerson(bug, dt, { lookAt: who === 'Bug' && stopped ? tmp : null, talking: who === 'Bug' });
        animatePerson(cat, dt, { lookAt: who === 'Cat' ? tmp : null, talking: who === 'Cat' });
        R.sh.rotation.x = -1.05; R.el.rotation.x = -0.55; R.sh.rotation.z = 0.25; Lf.sh.rotation.x = -1.05; Lf.el.rotation.x = -0.55; Lf.sh.rotation.z = -0.25;
        void centre; void rocket;
      },
      dispose() { setAmbienceRate(0); }
    });
    return api;
  }
};
