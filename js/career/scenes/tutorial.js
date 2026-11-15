// ASTRO LAB Career — Controls Practice in the Training Bay: look, walk, crouch, pick up, rotate, place, talk, open a door.
import * as THREE from '../../../vendor/three.module.js';
import { roomShell, TEX, MAT } from '../models/materials.js';
import { makeCrate, makeShelf, makeSlidingDoor, openDoor, makeSign, makeRing, makeBench, makeLocker, makeCeilingLight } from '../models/props.js';
import { makePerson, animatePerson } from '../models/humans.js';
import { makeUsable } from '../engine/interact.js';
import { LOOKS } from '../data/people.js';

const W = 14, D = 10, H = 3.4;
export default {
  id: 'tutorial', title: 'Controls Practice', music: 'centre', ambience: 'vent',
  steps: [
    { id: 'look', text: 'Look around (move the mouse, or use the right stick)', touch: 'Look around (drag on the view)' },
    { id: 'walk', text: 'Walk to the yellow ring (W A S D or the left stick)', touch: 'Walk to the yellow ring (joystick)' },
    { id: 'crouch', text: 'Crouch (hold C) and go through the inspection tunnel', touch: 'Crouch (⤵) and go through the inspection tunnel' },
    { id: 'pick', text: 'Pick up the supply crate (E)', touch: 'Pick up the supply crate (✋ or tap it)' },
    { id: 'place', text: 'Turn the crate so its label faces out (R), then place it on the shelf (E)', touch: 'Turn the crate so its label faces out (⟳), then place it on the shelf (✋)' },
    { id: 'talk', text: 'Report to Instructor Okafor' },
    { id: 'door', text: 'Open the exit door' }
  ],
  initialState: { steps: {}, mistakes: [], cratePlaced: false },

  async build(ctx) {
    const { scene, world, player, ix, carry, hud, state, sfx } = ctx;
    scene.background = new THREE.Color(0x0d1018);
    // Room
    const shell = roomShell({ w: W, d: D, hgt: H, gaps: [{ side: 'e', at: -2.4, w: 1.3, h: 2.25 }] }); scene.add(shell.group); // doorway behind the EXIT door
    // the room behind the exit door: a lit changing room / corridor towards the training hall (before, the door opened onto
    // the bare back of the wall). Walls are solid; you see it when the door slides open.
    { const RX = W / 2 + 2.6, RZ = -2.4, room = roomShell({ w: 5, d: 4.4, hgt: 2.9, x: RX, z: RZ, gaps: [{ side: 'w', at: 0, w: 1.3, h: 2.25 }] }); scene.add(room.group);
      for (const [x0, x1, z0, z1] of room.colliders) player.addBox(x0, x1, z0, z1);
      const rl = new THREE.PointLight(0xfff1dc, 6, 8, 1.4); rl.position.set(RX, 2.5, RZ); scene.add(rl); const cl = makeCeilingLight(1.2, 0.3); cl.position.set(RX, 2.87, RZ); scene.add(cl);
      for (let i = 0; i < 4; i++) { const lk = makeLocker(); lk.position.set(RX - 1.2 + i * 0.75, 0, RZ - 2.0); scene.add(lk); }
      player.addBox(RX - 1.6, RX + 1.6, RZ - 2.2, RZ - 1.6, 0, 2);
      const bn = makeBench(); bn.position.set(RX + 0.6, 0, RZ + 1.4); scene.add(bn); player.addBox(RX - 0.2, RX + 1.4, RZ + 1.1, RZ + 1.7, 0, 0.6);
      const hs = makeSign('TRAINING HALL', 'Junior Astronaut Training Program →', 1.6); hs.position.set(RX + 2.47, 1.9, RZ); hs.rotation.y = -Math.PI / 2; scene.add(hs);
      const hd = makeSlidingDoor(1.2, 2.2, 'HALL'); hd.position.set(RX + 2.41, 0, RZ + 0.9); hd.rotation.y = -Math.PI / 2; scene.add(hd); }
    for (const [x0, x1, z0, z1] of shell.colliders) player.addBox(x0, x1, z0, z1);
    // Lights
    scene.add(new THREE.HemisphereLight(0xf2f5ff, 0x4a4e58, 0.75));
    const key = world.shadowLight(new THREE.SpotLight(0xfff3e2, 60, 18, 1.0, 0.6, 1.4)); key.position.set(0, H - 0.1, 0); key.target.position.set(0, 0, 0); scene.add(key, key.target);
    for (const x of [-4.5, 4.5]) { const p = new THREE.PointLight(0xfff1dc, 9, 14, 1.4); p.position.set(x, H - 1.0, 0); scene.add(p); }
    for (const x of [-4.5, 0, 4.5]) for (const z of [-2.5, 2.5]) { const l = makeCeilingLight(1.2, 0.3); l.position.set(x, H - 0.03, z); scene.add(l); }
    // Partition with the inspection tunnel (crouch-height opening, 1.2 m)
    const px0 = 1.2, px1 = 2.8, gap = 0.6, roof = 1.2;
    const partMat = MAT.std({ map: TEX.wallPanel([1.2, 2.4]), roughness: 0.8 });
    const block = (z0, z1, y0, y1) => { const m = new THREE.Mesh(new THREE.BoxGeometry(px1 - px0, y1 - y0, z1 - z0), partMat); m.position.set((px0 + px1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); m.castShadow = m.receiveShadow = true; scene.add(m); player.addBox(px0, px1, z0, z1, y0, y1); return m; };
    block(-D / 2, -gap, 0, H); block(gap, D / 2, 0, H); block(-gap, gap, roof, H);
    const stripe = MAT.std({ map: TEX.hazard([3, 1]) });
    for (const x of [px0 - 0.005, px1 + 0.005]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(gap * 2, 0.12), stripe); s.position.set(x, roof - 0.06, 0); s.rotation.y = x < 2 ? -Math.PI / 2 : Math.PI / 2; scene.add(s); }
    const tl = new THREE.PointLight(0xbfd8ff, 3, 3, 2); tl.position.set(2, 1.05, 0); scene.add(tl);
    const tSign = makeSign('CROUCH', 'Inspection tunnel · hold C', 1.1); tSign.position.set(px0 - 0.01, 1.75, 0); tSign.rotation.y = -Math.PI / 2; scene.add(tSign);
    // Wall signs and decor
    const bay = makeSign('TRAINING BAY 1', 'ASTRO LAB Junior Astronaut Programme', 3.2); bay.position.set(-2.5, 2.35, -D / 2 + 0.02); scene.add(bay);
    const tape = MAT.std({ color: 0xf2b632, roughness: 0.6 });
    for (const z of [-0.75, 0.75]) { const t = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 0.06), tape); t.rotation.x = -Math.PI / 2; t.position.set(-1.5, 0.006, z); scene.add(t); }
    const bench = makeBench(1.8); bench.position.set(-5.6, 0, 2.6); bench.rotation.y = Math.PI / 2; scene.add(bench); player.addBox(-5.85, -5.35, 1.7, 3.5, 0, 0.5);
    for (let i = 0; i < 4; i++) { const lk = makeLocker(i % 2 ? 0x3e5c8a : 0x35507a); lk.position.set(-6.7, 0, -3.8 + i * 0.52); lk.rotation.y = Math.PI / 2; scene.add(lk); }
    player.addBox(-7, -6.45, -4.1, -1.9);
    // Yellow ring
    const ring = makeRing(0.6); ring.position.set(-4.3, 0.01, -2.2); scene.add(ring); if (ctx.isDone('walk')) ring.visible = false;
    // Shelf (north wall, right zone)
    const shelf = makeShelf(1.6, 2, 0.5); shelf.position.set(5, 0, -D / 2 + 0.3); scene.add(shelf); player.addBox(4.2, 5.8, -D / 2, -D / 2 + 0.56);
    const sock = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.05, 0.46), new THREE.MeshBasicMaterial({ color: 0x5ad8ff, transparent: true, opacity: 0.25 }));
    sock.position.set(5, 0.98, -D / 2 + 0.3); scene.add(sock);
    const ghost = makeCrate(0.5); ghost.traverse(o => { if (o.isMesh) o.material = new THREE.MeshBasicMaterial({ color: 0x5ad8ff, transparent: true, opacity: 0.18, depthWrite: false }); });
    ghost.position.copy(sock.position); ghost.position.y = 0.965; scene.add(ghost); sock.userData.ghost = ghost;
    const shelfSign = makeSign('STOW HERE', 'Label facing out', 1.0); shelfSign.position.set(5, 2.25, -D / 2 + 0.02); scene.add(shelfSign);
    // Crate (on the floor, label facing the wall so the player must turn it)
    const crate = makeCrate(0.5); crate.position.set(5.2, 0, 3.2); crate.rotation.y = Math.PI * 0.5; scene.add(crate);
    crate.userData.collider = player.addBox(4.92, 5.48, 2.92, 3.48, 0, 0.42);
    carry.makeCarriable(crate, { id: 'crate', name: 'Supply crate', onPick: () => ctx.done('pick') });
    carry.makeSocket(sock, {
      accepts: 'crate', label: 'Shelf', lock: true, offset: new THREE.Vector3(0, -0.02, 0),
      check: (item, steps) => steps % 4 === 0 ? { ok: true } : { ok: false, msg: 'The label must face out so the crew can find it. Press R (or ⟳) to turn the crate.' },
      onMistake: () => ctx.mistake('Tried to stow the crate with its label facing the wrong way.'),
      onPlace: () => { state.cratePlaced = true; sock.visible = false; ctx.done('place'); }
    });
    if (state.cratePlaced) { carry.held = null; crate.position.set(5, 0.96, -D / 2 + 0.3); crate.rotation.y = 0; crate.userData.collider.on = false; crate.userData.locked = true; sock.userData.filled = crate; sock.visible = false; ghost.visible = false; }
    // Instructor
    const okafor = makePerson(LOOKS.okafor);
    okafor.root.position.set(5.6, 0, 0.3); okafor.root.rotation.y = -Math.PI / 2; scene.add(okafor.root); player.addBox(5.35, 5.85, 0.05, 0.55);
    makeUsable(okafor.root, { label: 'Instructor Okafor', verb: 'Talk to', range: 2.8, use: () => talkOkafor() }); ix.add(okafor.root);
    let talking = false;
    async function talkOkafor() {
      talking = true;
      const before = ctx.isDone('place');
      if (!before) {
        await ctx.talk([{ who: 'Instructor Okafor', text: 'Hi {name}. Finish stowing that supply crate first, then come back and report.' }]);
        talking = false; return;
      }
      await ctx.talk([
        { who: 'Instructor Okafor', text: 'Good work, {name}. You crouched through the tunnel and stowed the crate with the label out. That is exactly what we want.' },
        { who: 'Instructor Okafor', text: 'Anything you want to ask before you head out?', choices: [
          { text: 'Why do astronauts practise every movement?', goto: 'why' },
          { text: 'Why does the label have to face out?', goto: 'label' },
          { text: 'No questions. I\'m ready.', goto: 'ready' }] },
        { id: 'why', who: 'Instructor Okafor', text: 'Because in space there is no time to work things out. Crews rehearse procedures in full-size mock-ups, like NASA\'s Space Vehicle Mockup Facility in Houston, until the movements are automatic.', goto: 'ready' },
        { id: 'label', who: 'Instructor Okafor', text: 'On the space station, thousands of items are tracked by label and barcode. If a label faces the wall, someone wastes time looking for it, and time is precious on orbit.', goto: 'ready' },
        { id: 'ready', who: 'Instructor Okafor', text: 'Then you\'re done here. The exit door is unlocked. See you in the real training programme.' }
      ]);
      talking = false; okafor.wave = 2.2; ctx.done('talk'); door.userData.lamp.material.color.set(0x3fe0a0); door.userData.lamp.material.emissive.set(0x3fe0a0);
    }
    // Exit door (east wall)
    const door = makeSlidingDoor(1.2, 2.2, 'EXIT'); door.position.set(W / 2 - 0.09, 0, -2.4); door.rotation.y = -Math.PI / 2; scene.add(door); const doorCol = player.addBox(W / 2 - 0.15, W / 2 + 0.1, -3.05, -1.75, 0, 2.3); // closed door is solid
    let opening = false;
    makeUsable(door, { label: 'Exit door', verb: 'Open', range: 2.6, enabled: () => !opening, use: () => {
      if (!ctx.isDone('talk')) { sfx.wrong(); hud.flash(ctx.isDone('place') ? 'Report to Instructor Okafor before you leave.' : 'Finish the other objectives first.', 'bad'); return; }
      opening = true; doorCol.on = false; sfx.door(); hud.cap('[Door slides open]');
      ctx.done('door');
      setTimeout(() => finish(), 1100);
    } }); ix.add(door);
    if (ctx.isDone('talk')) { door.userData.lamp.material.color.set(0x3fe0a0); door.userData.lamp.material.emissive.set(0x3fe0a0); }

    function finish() {
      const pen = ctx.diff.mistakePenalty; const mistakes = [...state.mistakes];
      const score = Math.max(40, 100 - mistakes.length * pen);
      ctx.finish({
        id: 'tutorial', title: 'Controls Practice', score, mistakes, xp: 50,
        science: 'Astronauts rehearse every task on the ground first. NASA crews train in full-size mock-ups of their spacecraft, and they practise spacewalks in a 12-metre-deep pool, the Neutral Buoyancy Laboratory. Moving carefully, keeping hatches clear and stowing gear with labels visible all save time and prevent mistakes once in orbit.',
        continueLabel: ctx.mode === 'story' ? 'Continue' : 'Main menu',
        onContinue: rt => {
          if (ctx.mode === 'story') { const c = ctx.career; c.flags.tutorialDone = true; c.chapter = 'home'; c.scene = null; c.pos = null; ctx.saveNow(); }
          rt.exit();
        },
        next: ctx.mode === 'story' ? 'Chapter 1, Home: wake up in your bedroom.' : 'Return to the main menu.'
      });
      state.mistakes = []; // a replay starts clean
    }

    // Look target for the instructor
    const camPos = new THREE.Vector3();
    return {
      spawn: [-3, 3.2, 0, 0],
      markerFor: id => ({ walk: ring, crouch: tSign, pick: crate, place: sock, talk: okafor.root, door }[id] || null),
      onEnter: () => { if (!ctx.isDone('look')) hud.flash(ctx.input.touch ? 'Drag on the view to look around.' : 'Click the view, then move the mouse to look around. Press H for all controls.', '', 5000); },
      update(dt) {
        world.camera.getWorldPosition(camPos);
        const near = camPos.distanceTo(okafor.root.position) < 6;
        animatePerson(okafor, dt, { lookAt: near ? camPos : null, talking: talking && ctx.dlg.active });
        ring.material.opacity = 0.6 + Math.sin(performance.now() / 300) * 0.25;
        if (opening) openDoor(door, dt, true);
        const p = player.pos;
        if (!ctx.isDone('look') && player.lookTotal > 1.8) ctx.done('look');
        if (ctx.isDone('look') && !ctx.isDone('walk') && Math.hypot(p.x - ring.position.x, p.z - ring.position.z) < 0.6) { ctx.done('walk'); ring.visible = false; }
        if (!ctx.isDone('crouch') && p.x > px1 + 0.3) ctx.done('crouch');
        // Steps can be done in any order; later ones need earlier ones only where it matters (talk needs place, door needs talk).
      }
    };
  }
};
