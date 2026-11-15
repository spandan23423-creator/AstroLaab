// ASTRO LAB Career — Chapter 1, Arrival: say goodbye to Bug and Cat in front of the Astronaut Training Centre and walk to the doors.
import * as THREE from '../../../vendor/three.module.js';
import { TEX, MAT } from '../models/materials.js';
import { makeCar, makeTree, makeLamppost, makeFlag, waveFlag, makeTrainingCentre, makeDisplayRocket, makeFence, makeDaySky } from '../models/outdoor.js';
import { makePerson, animatePerson } from '../models/humans.js';
import { makePlant, box } from '../models/house.js';
import { LOOKS } from '../data/people.js';
import { makeUsable } from '../engine/interact.js';
import { whenModel, instance, fit, markImported } from '../../assets/models.js';

const FRONT = -20; // building front face (z)

export default {
  id: 'arrival', title: 'Chapter 1 · Arrival', music: 'centre', ambience: 'outdoor',
  steps: [
    { id: 'bye', text: 'Say goodbye to Bug and Cat' },
    { id: 'enter', text: 'Walk to the entrance doors' }
  ],
  initialState: { steps: {}, mistakes: [] },

  async build(ctx) {
    const { scene, world, player, ix, hud, sfx } = ctx;
    scene.background = new THREE.Color(0x62a0e0); scene.fog = new THREE.Fog(0xcfe4f6, 60, 300); scene.add(makeDaySky(380)); // same blue sky with clouds as the drive
    world.camera.far = 500; world.camera.updateProjectionMatrix();
    scene.add(new THREE.HemisphereLight(0xdfefff, 0x6a7a55, 1.05));
    const sun = world.shadowLight(new THREE.DirectionalLight(0xfff1d6, 2.4)); sun.position.set(25, 40, 25); sun.target.position.set(0, 0, -5);
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 }); scene.add(sun, sun.target);

    // ground: grass, plaza paving, the access road
    const g = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), MAT.std({ map: TEX.grass([80, 80]), roughness: 1 })); g.rotation.x = -Math.PI / 2; g.position.y = -0.02; g.receiveShadow = true; scene.add(g);
    const pav = new THREE.Mesh(new THREE.PlaneGeometry(44, 36), MAT.std({ map: TEX.paving([11, 9]), roughness: 0.85 })); pav.rotation.x = -Math.PI / 2; pav.position.set(0, 0.004, -2); pav.receiveShadow = true; scene.add(pav);
    const rd = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 300), MAT.std({ map: TEX.road([1, 30]), roughness: 0.85 })); rd.rotation.x = -Math.PI / 2; rd.rotation.z = Math.PI / 2; rd.position.set(0, 0.006, 21); rd.receiveShadow = true; scene.add(rd);
    // bays painted for parking
    const lineM = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
    for (let x = -14; x <= 14; x += 3) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 5), lineM); l.rotation.x = -Math.PI / 2; l.position.set(x + 0.5, 0.01, 8.5); scene.add(l); }

    // building, rocket, flags, trees, lamps
    const centre = makeTrainingCentre(); centre.position.set(0, 0, FRONT); scene.add(centre);
    player.addBox(-18, 18, FRONT - 14, FRONT - 0.1, 0, 12);
    player.addBox(-6.2, -5, FRONT, FRONT + 4.6, 0, 5); player.addBox(5, 6.2, FRONT, FRONT + 4.6, 0, 5); // canopy pillars area edges
    const doorCol = player.addBox(-1.4, 1.4, FRONT, FRONT + 0.35, 0, 3);
    const rocket = makeDisplayRocket(0.85); rocket.position.set(-13, 0, -8); scene.add(rocket); player.addBox(-15.2, -10.8, -10.2, -5.8, 0, 20);
    const plaque = box(1.6, 1.0, 0.1, MAT.std({ map: TEX.sign('DISPLAY ROCKET', 'A model of a crew launch vehicle'), roughness: 0.6 }), -13, 0.9, -5.2, scene); plaque.rotation.x = -0.3;
    const flags = ['emblem', 'class', 'stripes', 'emblem'].map((k, i) => { const f = makeFlag(k, 9); f.position.set(8 + i * 3, 0, -12); scene.add(f); player.addBox(7.8 + i * 3, 8.2 + i * 3, -12.2, -11.8, 0, 9); return f; });
    for (const [x, z] of [[-19, 4], [-19, -6], [19, 4], [19, -6], [-8, 12], [8, 12]]) { const t = makeTree(Math.abs(x + z) | 0, 1.2); t.position.set(x, 0, z); scene.add(t); player.addBox(x - 0.4, x + 0.4, z - 0.4, z + 0.4, 0, 4); }
    for (const x of [-9, 9]) { const l = makeLamppost(); l.position.set(x, 0, 2); l.rotation.y = x < 0 ? Math.PI : 0; scene.add(l); }
    for (const x of [-4.5, 4.5]) { const p = makePlant(2.2); p.position.set(x, 0, FRONT + 5.2); scene.add(p); player.addBox(x - 0.4, x + 0.4, FRONT + 4.8, FRONT + 5.6, 0, 1.5); }
    const f1 = makeFence(44); f1.position.set(0, 0, 16); scene.add(f1);
    // research greenhouse (imported model) on the lawn beside the plaza
    whenModel('greenhouse', gltf => { const gh = markImported(fit(instance(gltf), { size: 6.4, by: 'length', rotY: Math.PI / 2 })); gh.position.set(-17.6, 0, 10.2); scene.add(gh); });
    player.addBox(-20.8, -14.4, 8.6, 11.8, 0, 3.2);
    // plaza bounds
    player.addBox(-22.5, -21.5, -34, 17); player.addBox(21.5, 22.5, -34, 17); player.addBox(-22, 22, 15.6, 16.4);

    // the family car, parked; Bug and Cat beside it
    const car = makeCar(0x3a6ea5, { interior: false }); car.position.set(6, 0, 8.5); scene.add(car); player.addBox(5.05, 6.95, 6.25, 10.75, 0, 1.6);
    const bug = makePerson(LOOKS.bug); bug.root.position.set(3.0, 0, 6.2); bug.root.rotation.y = 2.2; scene.add(bug.root); player.addBox(2.75, 3.25, 5.95, 6.45, 0, 1.8);
    for (const r of [bug]) { r.lookRange = 0.55; r.lookRate = 2.5; } /* Bug and Cat only turn their heads a little to follow you, smoothly */
    const cat = makePerson(LOOKS.cat); cat.root.position.set(2.4, 0, 7.4); cat.lookRange = 0.55; cat.lookRate = 2.5; cat.root.rotation.y = 2.0; scene.add(cat.root); player.addBox(2.15, 2.65, 7.15, 7.65, 0, 1.8);
    let talking = false;
    const bye = async () => {
      if (talking) return; talking = true;
      if (!ctx.isDone('bye')) {
        await ctx.talk([
          { who: 'Cat', text: 'This is it, {name}. Have you got your letter?', choices: [
            { text: 'Right here. (Pat your pocket.)', goto: 'pocket' }, { text: 'I think so… yes, got it!', goto: 'pocket' }] },
          { id: 'pocket', who: 'Bug', text: 'Good. Remember: listen to your instructors, ask lots of questions, and enjoy it.' },
          { who: 'Cat', text: 'We\'ll be right here when you finish today.', choices: [
            { text: 'Thanks for everything.', goto: 'thanks' }, { text: 'I\'ll make you proud.', goto: 'proud' }] },
          { id: 'thanks', who: 'Cat', text: 'Oh, stop it, you\'ll make me cry in the car park.', goto: 'go' },
          { id: 'proud', who: 'Bug', text: 'You already have. Now go and show them what you can do.', goto: 'go' },
          { id: 'go', who: 'Bug', text: 'Go on, astronaut. The doors are straight ahead.' }
        ]);
        ctx.done('bye'); bug.wave = 2.2; cat.wave = 2.2; doorCol.on = false;
        hud.flash('Walk to the entrance doors.', '', 3000);
      } else await ctx.talk([{ who: 'Cat', text: 'Go on, they\'re waiting for you! We love you.' }]);
      talking = false;
    };
    for (const [p, n] of [[bug, 'Bug'], [cat, 'Cat']]) { makeUsable(p.root, { label: n, verb: ctx.isDone('bye') ? 'Talk to' : 'Say goodbye to', range: 2.8, enabled: () => !talking, use: bye }); ix.add(p.root); }
    if (ctx.isDone('bye')) doorCol.on = false;

    // entrance marker and the finish
    const doorMark = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, 0.2), new THREE.MeshBasicMaterial({ visible: false })); doorMark.position.set(0, 1.3, FRONT + 0.2); scene.add(doorMark);
    let opening = 0, ended = false, warned = 0;
    function finish() {
      if (ended) return; ended = true; ctx.done('enter');
      setTimeout(() => ctx.finishChapter({
        id: 'home', title: 'Chapter 1 complete: Home', xp: 100, badge: 'accepted',
        science: 'Real astronaut candidates train for about two years before they can be assigned to a mission. Training includes spacewalk practice underwater in NASA\'s Neutral Buoyancy Laboratory, spacecraft systems, robotics, survival skills, flying jet aircraft and learning languages for working with international crewmates.',
        next: 'Chapter 2, Registration: go through security, check in at the desk and get your astronaut ID.',
        continueLabel: 'Go inside ▸',
        onContinue: () => { const c = ctx.career; c.chapter = 'centre'; ctx.saveNow(); ctx.goto('centre'); }
      }), 1300);
    }

    const cam = new THREE.Vector3(); let t = 0;
    return {
      spawn: [4.2, 9.2, 0.55, -0.02],
      markerFor: id => ({ bye: cat.root, enter: doorMark }[id] || null),
      onEnter: () => { hud.cap('[Birdsong · flags flapping]'); },
      update(dt) {
        t += dt; flags.forEach(f => waveFlag(f, t));
        world.camera.getWorldPosition(cam);
        const near = cam.distanceTo(bug.root.position) < 8;
        const who = ctx.dlg.active ? (ctx.dlg.el.querySelector('.cx-who')?.textContent || '') : '';
        animatePerson(bug, dt, { lookAt: near ? cam : null, talking: who === 'Bug' });
        animatePerson(cat, dt, { lookAt: near ? cam : null, talking: who === 'Cat' });
        const p = player.pos, dz = p.z - FRONT, dx = Math.abs(p.x);
        if (dx < 3 && dz < 4.5) {
          if (ctx.isDone('bye')) { if (!opening) { opening = 0.001; sfx.door(); hud.cap('[Doors slide open]'); } }
          else if (performance.now() - warned > 4000) { warned = performance.now(); sfx.wrong(); hud.flash('Say goodbye to Bug and Cat before you go in.', 'bad'); }
        }
        if (opening) { opening = Math.min(1, opening + dt * 1.5); centre.userData.doors.forEach((l, i) => { l.position.x = (i ? 1 : -1) * (0.6 + 1.15 * opening); }); }
        if (opening > 0.5 && dx < 1.8 && dz < 3.2) finish();
      }
    };
  }
};
