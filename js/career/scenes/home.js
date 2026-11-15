// ASTRO LAB Career — Chapter 1, Home: wake up, choose your name, get up, go downstairs, Bug and Cat, the envelope, the letter, out of the front door.
import * as THREE from '../../../vendor/three.module.js';
import { TEX, MAT } from '../models/materials.js';
import * as H from '../models/house.js';
import { makePerson, animatePerson, holdInHand } from '../models/humans.js';
import { LOOKS } from '../data/people.js';
import { makeUsable } from '../engine/interact.js';
import { askName, openLetter } from '../ui/letter.js';
import { career } from '../state/careerSave.js';
import { save } from '../../systems/core.js';

// Layout (metres). Ground floor y=0 (ceiling 2.8), upstairs floor y=3.0 (ceiling 5.6). House x -6..6, z -5..5.
const UP = 3.0, GC = 2.8, TOP = 5.6;
const STAIR = { x0: 3.6, x1: 4.8, zTop: -3.4, zBot: 2.6 };
const BED_EYE = new THREE.Vector3(-5.3, UP + 0.86, -2.1);
const STAND_AT = [-3.35, -2.1];

export default {
  id: 'home', title: 'Chapter 1 · Home', music: 'home', ambience: 'home',
  steps: [
    { id: 'alarm', text: 'Switch off the alarm clock (E)', touch: 'Switch off the alarm clock (✋)' },
    { id: 'getup', text: 'Get out of bed (E)', touch: 'Get out of bed (✋)' },
    { id: 'door', text: 'Open your bedroom door' },
    { id: 'down', text: 'Go downstairs' },
    { id: 'talk', text: 'Say good morning to Bug and Cat' },
    { id: 'take', text: 'Take the envelope from Cat' },
    { id: 'read', text: 'Open the envelope and read the letter (E)', touch: 'Open the envelope and read the letter (✋)' },
    { id: 'out', text: 'Go out of the front door to the car' }
  ],
  initialState: { steps: {}, mistakes: [] },

  async build(ctx) {
    const { scene, world, player, ix, hud, sfx } = ctx;
    scene.background = new THREE.Color(0xcfe3f5);

    // ---------- materials (textures repeat by wall size so patterns keep their scale) ----------
    const tex = (fn, ...a) => (len, hgt) => MAT.std({ map: fn([Math.max(1, len / 1.1), Math.max(1, hgt / 1.1)], ...a), roughness: 0.85 });
    const bedroomWall = tex(TEX.wallpaper, '#dfe8f3', 'rgba(70,100,150,.16)');
    const livingWall = tex(TEX.wallpaper, '#f0e5cf');
    const plainWall = (len, hgt) => MAT.std({ color: 0xf1ede4, roughness: 0.9 });
    const ceilM = MAT.std({ color: 0xf6f4ef, roughness: 0.95 });
    const W = (...a) => H.wall(scene, player, ...a);
    const WG = (...a) => H.wallWithGaps(scene, player, ...a);

    // ---------- floors & ceilings ----------
    H.floorPlane(scene, -6, 6, -5, 5, 0, MAT.std({ map: TEX.planks([6, 5]), roughness: 0.6 }));
    H.floorPlane(scene, -6, 0.5, -5, -1.2, 0.003, MAT.std({ map: TEX.tiles([8, 5]), roughness: 0.35 }));        // kitchen tiles
    H.floorPlane(scene, -6, 2.4, -5, 1, UP + 0.002, MAT.std({ map: TEX.carpet([5, 4], '#7d8fb3'), roughness: 1 })); // bedroom carpet
    H.floorPlane(scene, 2.4, 6, -5, -3.4, UP + 0.002, MAT.std({ map: TEX.planks([2, 1]), roughness: 0.6 }));       // landing
    // slab between floors, with the stairwell hole
    const slab = (x0, x1, z0, z1) => { const m = H.box(x1 - x0, UP - GC, z1 - z0, ceilM, (x0 + x1) / 2, (GC + UP) / 2, (z0 + z1) / 2, scene); m.castShadow = false; return m; };
    slab(-6, STAIR.x0, -5, 5); slab(STAIR.x1, 6, -5, 5); slab(STAIR.x0, STAIR.x1, -5, STAIR.zTop); slab(STAIR.x0, STAIR.x1, 0.6, 5);
    H.floorPlane(scene, -6, 6, -5, 5, TOP, ceilM, false);

    // ---------- outer walls (both floors) ----------
    WG('x', -5, -6, 6, 0, GC, livingWall, [{ at: -3.4, w: 1.6, y0: 1.0, y1: 2.3 }]);              // north, ground: kitchen window
    WG('x', -5, -6, 6, GC, TOP, bedroomWall, [{ at: -2.2, w: 1.6, y0: UP + 0.9, y1: UP + 2.2 }]); // north, upstairs: bedroom window
    WG('x', 5, -6, 6, 0, GC, livingWall, [{ at: -3.0, w: 1.8, y0: 0.9, y1: 2.3 }, { at: 4.8, w: 0.9 }]); // south: living window + front door
    W(-6, 5, 6, 5, GC, TOP, plainWall);
    W(-6, -5, -6, 5, 0, GC, livingWall); W(-6, -5, -6, 1, GC, TOP, bedroomWall); W(-6, 1, -6, 5, GC, TOP, plainWall);
    W(6, -5, 6, 5, 0, TOP, plainWall);

    // ---------- upstairs walls ----------
    W(-6, 1, 2.4, 1, UP, TOP, bedroomWall);                                                       // bedroom south
    WG('z', 2.4, -5, 1, UP, TOP, bedroomWall, [{ at: -4.2, w: 0.9 }]);                             // bedroom east, door
    W(2.4, STAIR.zTop, STAIR.x0, STAIR.zTop, UP, TOP, plainWall); W(STAIR.x1, STAIR.zTop, 6, STAIR.zTop, UP, TOP, plainWall); // landing edge
    H.wall(scene, null, STAIR.x0, STAIR.zTop, STAIR.x0, 0.6, GC, TOP, plainWall); H.wall(scene, null, STAIR.x1, STAIR.zTop, STAIR.x1, 0.6, GC, TOP, plainWall);
    H.wall(scene, null, STAIR.x0, 0.6, STAIR.x1, 0.6, GC, TOP, plainWall);                        // end of the stairwell (visual only)

    // ---------- stairs, closet under the landing, banister ----------
    const wood = MAT.std({ map: TEX.wood([1, 0.4]), color: 0xc9a27a, roughness: 0.6 });
    for (let i = 0; i < 12; i++) { const zf = STAIR.zBot - i * 0.5; H.box(STAIR.x1 - STAIR.x0, 0.25 * (i + 1), 0.5, wood, (STAIR.x0 + STAIR.x1) / 2, 0.125 * (i + 1), zf - 0.25, scene); }
    W(STAIR.x1, STAIR.zTop, STAIR.x1, STAIR.zBot, 0, GC, livingWall); W(STAIR.x1, STAIR.zBot, 6, STAIR.zBot, 0, GC, livingWall);
    player.addBox(STAIR.x1, 6, STAIR.zTop, STAIR.zBot, 0, TOP);                                  // closet + stairwell east side
    player.addBox(3.5, STAIR.x0, STAIR.zTop, STAIR.zBot - 0.2, 0, TOP + 1);                         // banister / west side
    player.addBox(STAIR.x0, 6, -5, STAIR.zTop, 0, GC);                                             // under the landing
    const rail = MAT.std({ color: 0x5c3d24, roughness: 0.5 });
    const railLen = Math.hypot(6, 3); const hand = H.box(0.06, 0.06, railLen, rail, 3.55, 1.5 + 0.9, -0.4, scene); hand.rotation.x = Math.atan2(3, 6);
    for (let i = 0; i < 12; i++) { const z = STAIR.zBot - 0.25 - i * 0.5; H.box(0.035, 0.9, 0.035, MAT.std({ color: 0xf3efe6 }), 3.58, 0.25 * (i + 1) + 0.45, z, scene); }
    H.box(0.1, 1.1, 0.1, rail, 3.55, 0.55, STAIR.zBot - 0.1, scene);                                   // newel post

    // ---------- floor height: ramp on the stairs, otherwise whichever floor you're on ----------
    player.floorAt = (x, z, y = 0) => {
      if (x > STAIR.x0 - 0.15 && x < STAIR.x1 + 0.15 && z > STAIR.zTop && z < STAIR.zBot) return Math.max(0, Math.min(UP, 0.5 * (STAIR.zBot - z)));
      return y > 1.5 ? UP : 0;
    };
    player.surfaceAt = (x, z, y = 0) => (y > 1.5 && x < 2.4) ? 'carpet' : 'hard';

    // ---------- lights ----------
    scene.add(new THREE.HemisphereLight(0xfff6e8, 0x8a7a66, 0.85));
    const bedLight = world.shadowLight(new THREE.SpotLight(0xfff0dc, 30, 12, 1.2, 0.7, 1.5)); bedLight.position.set(-2, TOP - 0.1, -2); bedLight.target.position.set(-2.5, UP, -2.5); scene.add(bedLight, bedLight.target);
    const sunUp = new THREE.PointLight(0xfff4d6, 6, 7, 1.6); sunUp.position.set(-2.2, UP + 1.8, -4.2); scene.add(sunUp);
    const liv = world.shadowLight(new THREE.SpotLight(0xfff0dc, 34, 14, 1.25, 0.7, 1.5)); liv.position.set(-1.5, GC - 0.1, 1.5); liv.target.position.set(-1.5, 0, 1.5); scene.add(liv, liv.target);
    for (const [x, y, z, i] of [[-3.4, 1.9, -4.3, 5], [-3, 1.8, 4.3, 5], [4.4, 2.2, 3.6, 4], [4.2, UP + 1.9, -4.2, 3], [-4.2, 1.6, 2.5, 3]]) { const p = new THREE.PointLight(0xfff1dc, i, 7, 1.6); p.position.set(x, y, z); scene.add(p); }

    // ================= BEDROOM =================
    const bed = H.makeBed(); bed.position.set(-4.85, UP, -2.1); bed.rotation.y = Math.PI / 2; scene.add(bed); player.addBox(-6, -3.77, -2.97, -1.23, UP, UP + 0.7);
    const ns = H.makeNightstand(); ns.position.set(-5.65, UP, -0.85); ns.rotation.y = Math.PI / 2; scene.add(ns); player.addBox(-6, -5.4, -1.1, -0.6, UP, UP + 0.6);
    const clock = H.makeAlarmClock(); clock.position.set(-5.62, UP + 0.55, -0.82); clock.rotation.y = Math.PI / 2 + 0.5; scene.add(clock);
    const lampBed = H.makeFloorLamp(); lampBed.scale.setScalar(0.35); lampBed.position.set(-5.7, UP + 0.55, -0.6); scene.add(lampBed);
    const bwin = H.makeWindow(1.6, 1.3, 'garden'); bwin.position.set(-2.2, UP + 1.55, -4.93); scene.add(bwin);
    const bcur = H.makeCurtains(2.2, 1.7, 0x2e4a7a); bcur.position.set(-2.2, UP + 1.6, -4.85); scene.add(bcur);
    const desk = H.makeDesk(); desk.position.set(-2.2, UP, -4.55); scene.add(desk); player.addBox(-2.95, -1.45, -5, -4.2, UP, UP + 0.8);
    const chair = H.makeChair(); chair.position.set(-2.1, UP, -3.85); chair.rotation.y = 0.3; scene.add(chair); player.addBox(-2.35, -1.85, -4.1, -3.6, UP, UP + 0.9);
    const rocket = H.makeRocketModel(); rocket.position.set(-1.65, UP + 0.76, -4.75); scene.add(rocket);
    const scope = H.makeTelescope(); scope.position.set(-0.5, UP, -4.3); scope.rotation.y = -0.6; scene.add(scope); player.addBox(-0.8, -0.2, -4.6, -4.0, UP, UP + 1.5);
    const ward = H.makeWardrobe(); ward.position.set(-0.6, UP, 0.66); ward.rotation.y = Math.PI; scene.add(ward); player.addBox(-1.25, 0.05, 0.35, 1, UP, TOP);
    const p1 = H.makePoster('saturn'); p1.position.set(2.33, UP + 1.55, -1.6); p1.rotation.y = -Math.PI / 2; scene.add(p1);
    const p2 = H.makePoster('moon'); p2.position.set(-3.4, UP + 1.6, 0.93); p2.rotation.y = Math.PI; scene.add(p2);
    const rug1 = H.makeRug(2.2, 1.6, '#2e4a7a', '#e8d5b0'); rug1.position.set(-1.8, UP + 0.006, -1.9); scene.add(rug1);
    const shelfB = H.makeBookshelf(1.0, 1.2); shelfB.position.set(1.0, UP, 0.75); shelfB.rotation.y = Math.PI; scene.add(shelfB); player.addBox(0.45, 1.55, 0.5, 1, UP, UP + 1.3);
    // a glow-in-the-dark star sticker set on the ceiling above the bed (you see it when you wake up)
    const starM = new THREE.MeshBasicMaterial({ color: 0xd8f5a8, side: THREE.DoubleSide });
    const starShape = new THREE.Shape(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 0.4 : 1, an = k / 10 * Math.PI * 2; starShape[k ? 'lineTo' : 'moveTo'](Math.sin(an) * r, Math.cos(an) * r); }
    const starGeo = new THREE.ShapeGeometry(starShape);
    for (let i = 0; i < 18; i++) { const st = new THREE.Mesh(starGeo, starM); st.scale.setScalar(0.03 + Math.random() * 0.03); st.rotation.x = Math.PI / 2; st.position.set(-5.4 + Math.random() * 3, TOP - 0.004, -3.2 + Math.random() * 2.3); scene.add(st); }
    // bedroom door
    const bdoor = H.makeHingedDoor(0.9, 2.05); bdoor.position.set(2.4, UP, -4.65); bdoor.rotation.y = -Math.PI / 2; scene.add(bdoor);
    const bdoorCol = player.addBox(2.33, 2.47, -4.65, -3.75, UP, UP + 2.1);
    let bdoorOpen = false;
    makeUsable(bdoor, { label: 'Bedroom door', verb: 'Open', range: 2.2, enabled: () => !bdoorOpen && ctx.isDone('getup'), use: () => { bdoorOpen = true; bdoorCol.on = false; sfx.door(); hud.cap('[Door creaks open]'); ctx.done('door'); } });
    ix.add(bdoor);
    if (ctx.isDone('door')) { bdoorOpen = true; bdoorCol.on = false; bdoor.userData.leaf.rotation.y = Math.PI / 2; }
    makeUsable(clock, { label: 'Alarm clock', verb: 'Switch off', range: 2.4, enabled: () => !ctx.isDone('alarm') && named, use: () => alarmOff() }); ix.add(clock);
    // landing extras
    const fr1 = H.makeFrame(3); fr1.position.set(5.94, UP + 1.6, -4.2); fr1.rotation.y = -Math.PI / 2; scene.add(fr1);
    const plantUp = H.makePlant(1.2); plantUp.position.set(5.6, UP, -4.6); scene.add(plantUp);

    // ================= GROUND FLOOR =================
    // Kitchen (north)
    const counter = H.makeCounter(4.2); counter.position.set(-3.6, 0, -4.65); scene.add(counter); player.addBox(-5.75, -1.45, -5, -4.3, 0, 1);
    const fridge = H.makeFridge(); fridge.position.set(-0.9, 0, -4.6); scene.add(fridge); player.addBox(-1.3, -0.5, -5, -4.25, 0, 1.9);
    const kwin = H.makeWindow(1.6, 1.3, 'garden'); kwin.position.set(-3.4, 1.65, -4.93); scene.add(kwin);
    const table = H.makeTable(1.6, 0.9); table.position.set(-3.2, 0, -2.2); scene.add(table); player.addBox(-4.05, -2.35, -2.7, -1.7, 0, 0.8);
    for (const [x, z, r] of [[-3.7, -2.95, Math.PI], [-2.7, -2.95, Math.PI], [-3.7, -1.45, 0], [-2.7, -1.45, 0]]) { const c = H.makeChair(0x8a6240); c.position.set(x, 0, z); c.rotation.y = r; scene.add(c); }
    const kplant = H.makePlant(0.7); kplant.position.set(-5.4, 0.92, -4.6); scene.add(kplant);
    // Living room (south-west)
    const rug2 = H.makeRug(3.2, 2.4, '#8b3a3a', '#e8d5b0'); rug2.position.set(-3.6, 0.006, 2.6); scene.add(rug2);
    const tv = H.makeTV(); tv.position.set(-5.7, 0, 2.6); tv.rotation.y = Math.PI / 2; scene.add(tv); player.addBox(-6, -5.45, 1.7, 3.5, 0, 1.4);
    const sofa = H.makeSofa(2.2); sofa.position.set(-2.4, 0, 2.6); sofa.rotation.y = -Math.PI / 2; scene.add(sofa); player.addBox(-2.85, -1.95, 1.5, 3.7, 0, 0.9);
    const ctab = H.makeCoffeeTable(); ctab.position.set(-4.0, 0, 2.6); ctab.rotation.y = Math.PI / 2; scene.add(ctab); player.addBox(-4.3, -3.7, 2.05, 3.15, 0, 0.5);
    const chairA = H.makeSofa(1.0, 0x7a5a3a); chairA.position.set(-0.4, 0, 3.9); chairA.rotation.y = -Math.PI / 2; scene.add(chairA); player.addBox(-0.85, 0.05, 3.4, 4.4, 0, 0.9);
    const books = H.makeBookshelf(1.8, 2.0); books.position.set(1.6, 0, 4.82); books.rotation.y = Math.PI; scene.add(books); player.addBox(0.7, 2.5, 4.6, 5, 0, 2.0);
    const flamp = H.makeFloorLamp(); flamp.position.set(-5.5, 0, 4.5); scene.add(flamp);
    const lwin = H.makeWindow(1.8, 1.4, 'street'); lwin.position.set(-3.0, 1.6, 4.93); lwin.rotation.y = Math.PI; scene.add(lwin);
    const lcur = H.makeCurtains(2.4, 1.8, 0x9a6a3a); lcur.position.set(-3.0, 1.65, 4.85); lcur.rotation.y = Math.PI; scene.add(lcur);
    for (const [x, seed] of [[-1.2, 1], [-0.6, 2], [0.0, 4]]) { const f = H.makeFrame(seed, 0.3, 0.38); f.position.set(x, 1.7, -4.93); scene.add(f); }
    const fr2 = H.makeFrame(5, 0.5, 0.36); fr2.position.set(-5.93, 1.8, 2.6); fr2.rotation.y = Math.PI / 2; scene.add(fr2);
    const plant2 = H.makePlant(1.3); plant2.position.set(0.3, 0, 4.6); scene.add(plant2);
    const plant3 = H.makePlant(1.1); plant3.position.set(3.2, 0, 4.6); scene.add(plant3);
    // Hall: coat hooks and a mat by the front door
    const mat = H.box(1.0, 0.012, 0.6, MAT.std({ color: 0x5a4632, roughness: 1 }), 4.8, 0.006, 4.5, scene); mat.castShadow = false;
    for (let i = 0; i < 3; i++) { const c = H.box(0.32, 0.7, 0.12, MAT.std({ color: [0x2f4f6f, 0x8a3a3a, 0x5a6a3a][i], roughness: 0.95 }), 5.92 - 0.08, 1.35, 3.4 + i * 0.4, scene); c.rotation.y = Math.PI / 2; }
    // Front door
    const fdoor = H.makeHingedDoor(0.9, 2.05, 0x2f4f6f); fdoor.position.set(4.35, 0, 5); scene.add(fdoor);
    const fdoorCol = player.addBox(4.35, 5.25, 4.94, 5.06, 0, 2.1);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4), new THREE.MeshStandardMaterial({ map: TEX.view('street'), emissive: 0xffffff, emissiveMap: TEX.view('street'), emissiveIntensity: 0.8 })); glass.position.set(0.45, 1.65, -0.03); glass.rotation.y = Math.PI; fdoor.userData.leaf.add(glass);
    let leaving = false;
    makeUsable(fdoor, { label: 'Front door', verb: 'Open', range: 2.4, enabled: () => !leaving, use: () => {
      if (!ctx.isDone('read')) { sfx.wrong(); hud.flash(ctx.isDone('talk') ? 'Open the envelope first. Bug and Cat are waiting to hear what it says!' : 'Say good morning to Bug and Cat first.', 'bad'); return; }
      leaving = true; fdoorCol.on = false; sfx.door(); hud.cap('[Front door opens · birdsong]'); ctx.done('out');
      setTimeout(() => ctx.goto('car'), 900);
    } });
    ix.add(fdoor);

    // ---------- Bug and Cat ----------
    const bug = makePerson(LOOKS.bug); bug.root.position.set(-0.45, 0.08, 3.9); bug.root.rotation.y = Math.PI / 2; bug.sitTarget = bug.sit = 1; scene.add(bug.root);
    const cat = makePerson(LOOKS.cat); cat.root.position.set(1.0, 0, 2.3); cat.root.rotation.y = Math.PI / 2 + 0.35; scene.add(cat.root); player.addBox(0.75, 1.25, 2.05, 2.55, 0, 1.8);
    const mug = H.cyl(0.04, 0.035, 0.1, MAT.std({ color: 0xd8a83a, roughness: 0.35 })); holdInHand(bug, mug, -1); mug.position.set(0, -0.12, 0.05);
    const env = H.makeEnvelope(); env.scale.setScalar(1.15);
    let talking = null;
    const holdingEnv = () => ctx.isDone('take') && !ctx.isDone('read');
    const talkParents = async () => {
      if (talking) return;
      if (!ctx.isDone('talk')) {
        talking = 'both';
        await ctx.talk([
          { who: 'Cat', text: 'Good morning, {name}! There you are. Did you sleep well?', choices: [
            { text: 'Like a log.', goto: 'log' },
            { text: 'I dreamed about space again.', goto: 'dream' },
            { text: 'Not really. I kept thinking about my application.', goto: 'nerv' }] },
          { id: 'log', who: 'Cat', text: 'Good. You\'ll need your energy today, I have a feeling.', goto: 'post' },
          { id: 'dream', who: 'Bug', text: 'Again? That\'s the third time this week. Was it the Moon or Mars this time?', goto: 'post' },
          { id: 'nerv', who: 'Cat', text: 'Oh, sweetheart. Well, maybe the waiting is over.', goto: 'post' },
          { id: 'post', who: 'Bug', text: 'Something came in the post for you this morning. Your mum wouldn\'t let me open it.' },
          { who: 'Cat', text: 'Of course not, it\'s addressed to {name}! It has a very official-looking stamp on it.' },
          { who: 'Bug', text: 'Go on, then. We\'ve been dying to know all morning.' }
        ]);
        talking = null; ctx.done('talk'); cat.giveTarget = 1; holdInHand(cat, env, 1); env.position.set(0, -0.12, 0.08); env.rotation.set(0.3, 0, 0);
        ctx.refreshObjectives();
        return;
      }
      if (!ctx.isDone('take')) return takeEnvelope();
      if (!ctx.isDone('read')) { talking = 'both'; await ctx.talk([{ who: 'Bug', text: 'Well? Don\'t keep us in suspense, open it!' }]); talking = null; return; }
      talking = 'both';
      await ctx.talk([{ who: 'Cat', text: 'Go on, out to the car. We\'re right behind you.' }]);
      talking = null;
    };
    makeUsable(bug.root, { label: 'Bug', verb: 'Talk to', range: 2.8, enabled: () => !talking && !holdingEnv(), use: talkParents }); ix.add(bug.root);
    makeUsable(cat.root, { label: 'Cat', verb: 'Talk to', range: 2.8, enabled: () => !talking && !holdingEnv(), use: () => (ctx.isDone('talk') && !ctx.isDone('take')) ? takeEnvelope() : talkParents() }); ix.add(cat.root);
    // The prompt verb for Cat changes once she holds the envelope
    Object.defineProperty(cat.root.userData.it, 'verb', { get: () => (ctx.isDone('talk') && !ctx.isDone('take')) ? 'Take the envelope from' : 'Talk to' });
    function takeEnvelope() {
      if (ctx.isDone('take')) return;
      sfx.paper(); cat.giveTarget = 0; holdEnvelope(); ctx.done('take');
      hud.flash(ctx.input.touch ? 'Tap ✋ to open the envelope.' : 'Press E to open the envelope.', '', 3500);
    }
    function holdEnvelope() { env.removeFromParent(); world.camera.add(env); env.position.set(0.1, -0.2, -0.42); env.rotation.set(1.15, 0, -0.12); env.scale.setScalar(1); }

    // Opening the envelope: the flap lifts, the letter slides out, then the letter fills the screen
    let opening = 0;
    async function openEnvelope() {
      if (opening) return; opening = 0.001; sfx.paper(); hud.cap('[Paper tearing]');
      env.userData.seal.visible = false;
      await new Promise(r => setTimeout(r, 1300));
      ctx.input.releaseLock();
      openLetter({ first: true, onDone: afterLetter });
    }
    async function afterLetter() {
      env.removeFromParent(); ctx.giveItem('letter', 'Acceptance letter', '✉'); ctx.done('read');
      talking = 'both';
      await ctx.talk([
        { who: 'Cat', text: '{name}… you got in! Oh, come here. We\'re so proud of you.' },
        { who: 'Bug', text: 'The Junior Astronaut Training Program! And it says report this morning. No time to lose.', choices: [
          { text: 'I can\'t believe it!', goto: 'a' },
          { text: 'What if I\'m not good enough?', goto: 'b' }] },
        { id: 'a', who: 'Bug', text: 'Believe it, kiddo. You\'ve wanted this since you could point at the Moon.', goto: 'go' },
        { id: 'b', who: 'Cat', text: 'They picked you out of a whole stack of applications. They already know you\'re good enough. Now you get to learn.', goto: 'go' },
        { id: 'go', who: 'Bug', text: 'Right. I\'ll get the car out front. Grab your things and meet us outside.' },
        { who: 'Cat', text: 'And bring the letter! You can read it again any time.' }
      ]);
      talking = null; bug.wave = 2.2;
      hud.flash(ctx.input.touch ? 'Tap ✉ (top right) to read the letter again.' : 'Press L (or the ✉ button) to read the letter again.', '', 4500);
    }

    // ---------- Waking up ----------
    let named = !!career().player.name, alarmT = 0, wakeT = 0, standing = null;
    const inBed = () => !ctx.isDone('getup');
    if (inBed()) player.seat = { pos: BED_EYE.clone(), yaw: -Math.PI / 2, yawRange: 1.9, pitchMin: -0.6, pitchMax: 1.4, roll: 0 };
    function alarmOff() { if (ctx.isDone('alarm')) return; sfx.ui(); hud.cap('[Click. The alarm stops.]'); ctx.done('alarm'); hud.flash(ctx.input.touch ? 'Tap ✋ to get out of bed.' : 'Press E to get out of bed.', '', 3500); }
    function getUp() {
      if (standing || !inBed()) return;
      standing = { t: 0, from: BED_EYE.clone(), to: new THREE.Vector3(STAND_AT[0], UP + 1.62, STAND_AT[1]) };
      sfx.paper(); hud.cap('[Duvet rustles]');
    }
    async function wake() {
      if (!named) {
        await new Promise(r => setTimeout(r, 1600));
        ctx.input.releaseLock();
        const nm = await askName();
        const c = career(); c.player.name = nm; save(); named = true;
        ctx.refreshObjectives();
      }
      if (!ctx.isDone('alarm')) hud.flash(ctx.input.touch ? 'Tap ✋ to switch off the alarm.' : 'Press E to switch off the alarm. Move the mouse to look around.', '', 4500);
    }

    // Restore mid-chapter state on resume
    if (ctx.isDone('talk') && !ctx.isDone('take')) { cat.giveTarget = cat.give = 1; holdInHand(cat, env, 1); env.position.set(0, -0.12, 0.08); env.rotation.set(0.3, 0, 0); }
    if (ctx.isDone('take') && !ctx.isDone('read')) holdEnvelope();
    if (ctx.isDone('read') && !ctx.hasItem('letter')) ctx.giveItem('letter', 'Acceptance letter', '✉');
    const stairMark = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial({ visible: false })); stairMark.position.set(4.2, 3.2, -3.0); scene.add(stairMark);

    const camPos = new THREE.Vector3();
    return {
      spawn: inBed() ? [STAND_AT[0], STAND_AT[1], -Math.PI / 2, 0.75, UP] : [STAND_AT[0], STAND_AT[1], -Math.PI / 2, 0, UP],
      markerFor: id => ({ alarm: clock, door: bdoor, talk: cat.root, take: cat.root, out: fdoor, down: stairMark }[id] || null),
      onEnter: () => { if (inBed()) wake(); },
      defaultPrompt: () => {
        if (inBed() && named && !standing) return ctx.isDone('alarm') ? { verb: 'Get out of bed', label: '' } : { verb: 'Switch off', label: 'the alarm' };
        if (ctx.isDone('take') && !ctx.isDone('read') && !opening) return { verb: 'Open', label: 'the envelope' };
        return null;
      },
      onUse: () => {
        if (inBed() && named) { if (!ctx.isDone('alarm')) alarmOff(); else getUp(); return; }
        if (ctx.isDone('take') && !ctx.isDone('read')) openEnvelope();
      },
      update(dt, blocked) {
        world.camera.getWorldPosition(camPos);
        // alarm: beeps until switched off
        if (!ctx.isDone('alarm')) { alarmT -= dt; if (alarmT <= 0 && !blocked) { alarmT = 1.6; sfx.alarm(); hud.cap('[Alarm clock beeping]', 1500); } clock.userData.face.material.emissiveIntensity = (performance.now() % 800) < 400 ? 1.6 : 0.4; }
        else clock.userData.face.material.emissiveIntensity = 1.2;
        // get-up animation: sit up, swing round, stand
        if (standing) {
          standing.t += dt / 1.8; const t = Math.min(1, standing.t), e = t * t * (3 - 2 * t);
          const mid = new THREE.Vector3(-4.6, UP + 1.15, -1.35);
          const a = standing.from.clone().lerp(mid, Math.min(1, e * 2)), b = mid.clone().lerp(standing.to, Math.max(0, e * 2 - 1));
          player.seat.pos.copy(e < 0.5 ? a : b);
          player.seat.pitchMax = 1.35 - e * 1.2; player.pitch = Math.min(player.pitch, player.seat.pitchMax);
          if (t >= 1) { player.seat = null; player.place(STAND_AT[0], STAND_AT[1], player.yaw, Math.min(0.2, player.pitch), UP); standing = null; ctx.done('getup'); hud.flash('Your bedroom door is on the far wall.', '', 3000); }
        }
        if (inBed() && !standing) { wakeT += dt; }
        // doors
        if (bdoorOpen) bdoor.userData.leaf.rotation.y += (Math.PI / 2 - bdoor.userData.leaf.rotation.y) * Math.min(1, dt * 3);
        if (leaving) fdoor.userData.leaf.rotation.y += (Math.PI / 2 - fdoor.userData.leaf.rotation.y) * Math.min(1, dt * 3);
        // envelope flap and letter sliding out
        if (opening && opening < 1) { opening = Math.min(1, opening + dt / 1.1); env.userData.hinge.rotation.x = Math.PI * Math.min(1, opening * 1.6); const L = env.userData.letter; L.visible = opening > 0.4; L.position.z = -0.13 * Math.max(0, (opening - 0.4) / 0.6); L.position.y = 0.004; }
        // story progress by position
        const p = player.pos;
        if (ctx.isDone('door') && !ctx.isDone('down') && p.y < 0.2 && p.z > 1.5) { ctx.done('down'); hud.flash('Bug and Cat are in the living room.', '', 3000); }
        // parents
        const near = camPos.distanceTo(cat.root.position) < 7 && camPos.y < 2.6;
        animatePerson(bug, dt, { lookAt: near ? camPos : null, talking: !!talking && ctx.dlg.active && /Bug/.test(ctx.dlg.el.querySelector('.cx-who')?.textContent || '') });
        if (near) { const want = Math.atan2(camPos.x - cat.root.position.x, camPos.z - cat.root.position.z); let d = want - cat.root.rotation.y; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; cat.root.rotation.y += d * Math.min(1, dt * (talking || cat.giveTarget ? 2.5 : 0.8)); }
        animatePerson(cat, dt, { lookAt: near ? camPos : null, talking: !!talking && ctx.dlg.active && /Cat/.test(ctx.dlg.el.querySelector('.cx-who')?.textContent || '') });
      },
      dispose() { env.removeFromParent(); }
    };

  }
};
