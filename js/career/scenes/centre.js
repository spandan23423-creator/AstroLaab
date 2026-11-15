// ASTRO LAB Career — Chapter 2, the Astronaut Training Centre: security, registration, astronaut ID and badge, rules, agreement,
// then the training dashboard, which is the hub for every training module afterwards.
import * as THREE from '../../../vendor/three.module.js';
import { TEX, MAT } from '../models/materials.js';
import * as H from '../models/house.js';
import { makeSign, makeCeilingLight, makeSlidingDoor } from '../models/props.js';
import { makeCounter, makeKiosk, makePrinter, makeStand, makeTerminal, makeScannerArch, setLamp, makeChairRow, makeEmblemPlaque, makeClipboard, makeSatelliteModel, makeScreen, infoScreen, screenTex } from '../models/centre.js';
import { makePerson, animatePerson, holdInHand } from '../models/humans.js';
import { LOOKS } from '../data/people.js';
import { makeUsable } from '../engine/interact.js';
import { askName, openLetter } from '../ui/letter.js';
import { openIdCreator, drawIdCard } from '../ui/idCard.js';
import { runQuiz, readDoc } from '../ui/panels.js';
import { openDashboard } from '../ui/dashboard.js';
import { nextModule } from '../data/modules.js';
import { career } from '../state/careerSave.js';
import { h, openModal } from '../../ui/dom.js';
import { save } from '../../systems/core.js';
import { whenModel, instance, fit, markImported } from '../../assets/models.js';

const X0 = -12, X1 = 12, Z0 = -16, Z1 = 4, HT = 4.2;
const RULES = [
  ['Safety first, always.', 'If anything looks wrong, stop and say so. Anyone can call "stop" during training, and everyone stops.'],
  ['Follow the procedure.', 'Do each step in order and read the checklist out loud. Skipping a step is how accidents happen.'],
  ['Check your equipment.', 'Inspect suits, tools and tethers before you use them. Report damage; never hide it.'],
  ['Listen to your instructor and Mission Control.', 'Their instructions come first. Repeat back important instructions so they know you heard.'],
  ['Work as a team.', 'Tell your crewmates what you are doing. Help each other and never leave someone behind.'],
  ['Keep the training area tidy.', 'Put every tool back where it belongs, with its label facing out, so the next crew can find it.']
];
const RULES_QUIZ = [
  { q: 'You notice a small tear in a glove before a pool session. What do you do?', options: ['Stop and report it so the glove can be replaced', 'Tape it up and keep going', 'Say nothing, it is only small', 'Swap gloves with a crewmate without telling anyone'], explain: 'Damage is always reported. A small tear in a real suit glove could leak air in space.' },
  { q: 'Mission Control gives you an important instruction. What is the best reply?', options: ['Repeat it back so they know you understood', 'Stay quiet and do it', 'Ask them to say it again later', 'Do what you think is better'], explain: 'Crews "read back" key instructions. It catches misunderstandings before they cause a problem.' },
  { q: 'Who is allowed to call "stop" during training?', options: ['Anyone who sees a safety problem', 'Only the instructor', 'Only Mission Control', 'Nobody, training must not stop'], explain: 'Anyone can call a stop. It is one of the most important safety rules in human spaceflight.' },
  { q: 'You finish with a tool. Where does it go?', options: ['Back in its place with the label facing out', 'In your pocket for next time', 'On the nearest table', 'In the bin'], explain: 'Tidy, labelled stowage saves time. On the space station crews track thousands of items this way.', hard: true }
];

export default {
  id: 'centre', title: 'Chapter 2 · Training Centre', music: 'centre', ambience: 'vent',
  steps: [
    { id: 'security', text: 'Show your letter to the security officer' },
    { id: 'scan', text: 'Walk through the security scanner' },
    { id: 'register', text: 'Check in at the registration desk' },
    { id: 'id', text: 'Create your astronaut ID at the ID kiosk' },
    { id: 'badge', text: 'Collect your ID badge from the printer' },
    { id: 'rules', text: 'Read the safety rules in the briefing room' },
    { id: 'sign', text: 'Sign the trainee agreement' },
    { id: 'dash', text: 'Open the training dashboard' },
    { id: 'train', text: 'Start your next training module at the dashboard' }
  ],
  initialState: { steps: {}, mistakes: [] },

  async build(ctx) {
    const { scene, world, player, ix, hud, sfx, state } = ctx;
    scene.background = new THREE.Color(0x0d1018);
    const wallM = (len, hgt) => MAT.std({ map: TEX.wallPanel([Math.max(1, len / 1.4), Math.max(1, hgt / 1.4)]), roughness: 0.8 });
    const W = (...a) => H.wall(scene, player, ...a);
    // floor, ceiling, walls
    H.floorPlane(scene, X0, X1, Z0, Z1, 0, MAT.std({ map: TEX.vinyl([20, 17]), roughness: 0.5 }));
    H.floorPlane(scene, X0, X1, Z0, Z1, HT, MAT.std({ map: TEX.ceiling([20, 17]) }), false);
    H.wallWithGaps(scene, player, 'x', Z1, X0, X1, 0, HT, wallM, [{ at: 0, w: 2.6, y1: 2.7 }]);  // south, entrance
    H.wallWithGaps(scene, player, 'x', Z0, X0, X1, 0, HT, wallM);
    W(X0, Z0, X0, Z1, 0, HT, wallM); W(X1, Z0, X1, Z1, 0, HT, wallM);
    player.addBox(-1.3, 1.3, Z1, Z1 + 0.5);                                                         // closed entrance behind you
    // briefing room wall (door at x=0)
    H.wallWithGaps(scene, player, 'x', -10, X0, X1, 0, HT, wallM, [{ at: 0, w: 1.6, y1: 2.5 }]);
    // security partition (glass), gate at x=0
    const glass = new THREE.MeshStandardMaterial({ color: 0x9fc4e0, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.3, depthWrite: false });
    for (const [a, b] of [[X0, -1.0], [1.0, X1]]) { const m = H.box(b - a, 2.2, 0.05, glass, (a + b) / 2, 1.1, 0, scene); m.castShadow = false; player.addBox(a, b, -0.08, 0.08, 0, 2.2); H.box(b - a, 0.06, 0.08, MAT.metal(0x8a8f99), (a + b) / 2, 2.22, 0, scene); }
    const gateCol = player.addBox(-1.0, 1.0, -0.1, 0.1, 0, 2.3);
    const arch = makeScannerArch(); arch.position.set(0, 0, 0); scene.add(arch);
    // lights
    scene.add(new THREE.HemisphereLight(0xf2f5ff, 0x4a4e58, 0.8));
    const key = world.shadowLight(new THREE.SpotLight(0xfff3e2, 70, 26, 1.2, 0.6, 1.3)); key.position.set(-2, HT - 0.1, -5); key.target.position.set(-2, 0, -5); scene.add(key, key.target);
    for (const [x, z] of [[-7, 2], [7, 2], [-7, -6], [7, -6], [0, -13], [-6, -13], [6, -13]]) { const p = new THREE.PointLight(0xfff1dc, 9, 12, 1.4); p.position.set(x, HT - 0.8, z); scene.add(p); }
    for (let x = -9; x <= 9; x += 4.5) for (const z of [2, -3, -7.5, -13]) { const l = makeCeilingLight(1.4, 0.3); l.position.set(x, HT - 0.02, z); scene.add(l); }
    // decor: emblem, signs, plants, satellite model, wing doors
    const emb = makeEmblemPlaque(1.0); emb.position.set(-0.0, 3.1, -9.93); emb.rotation.y = Math.PI; emb.rotation.y = 0; emb.position.z = -9.92; scene.add(emb);
    const welcome = makeSign('WELCOME, CADETS', 'Junior Astronaut Training Program', 3.6); welcome.position.set(0, 3.1, 3.92); welcome.rotation.y = Math.PI; scene.add(welcome);
    const secSign = makeSign('SECURITY', 'Show your letter · walk through the scanner', 2.4); secSign.position.set(-3.2, 2.9, 0.06); scene.add(secSign);
    const regSign = makeSign('REGISTRATION', 'Check in here', 2.0); regSign.position.set(-6, 3.0, -9.92); scene.add(regSign);
    const idSign = makeSign('ID KIOSK', 'Astronaut ID & badge', 1.6); idSign.position.set(X0 + 0.02, 2.6, -6.8); idSign.rotation.y = Math.PI / 2; scene.add(idSign);
    const dashSign = makeSign('TRAINING DASHBOARD', 'Start your modules here', 2.6); dashSign.position.set(X1 - 0.02, 3.0, -5); dashSign.rotation.y = -Math.PI / 2; scene.add(dashSign);
    const briefSign = makeSign('BRIEFING ROOM', 'Rules · agreement', 1.8); briefSign.position.set(2.2, 2.9, -9.92); scene.add(briefSign);
    for (const [z, t, sub] of [[1.5, 'TRAINING HALL', 'Suits · pool · mobility'], [-1.5, 'SPACECRAFT LAB', 'Cockpit · power · EVA']]) { const d = makeSlidingDoor(1.4, 2.4, t.split(' ')[0]); d.position.set(X1 - 0.09, 0, z); d.rotation.y = -Math.PI / 2; scene.add(d); const s = makeSign(t, sub, 1.4); s.position.set(X1 - 0.02, 3.0, z); s.rotation.y = -Math.PI / 2; scene.add(s); }
    { const d = makeSlidingDoor(1.4, 2.4, 'LAB'); d.position.set(X0 + 0.09, 0, 1.5); d.rotation.y = Math.PI / 2; scene.add(d); const s = makeSign('LIFE SCIENCES', 'Greenhouse · medical', 1.4); s.position.set(X0 + 0.02, 3.0, 1.5); s.rotation.y = Math.PI / 2; scene.add(s); }
    for (const [x, z] of [[-11.3, 3.3], [11.3, 3.3], [-11.3, -9.3], [3.5, -9.3]]) { const p = H.makePlant(1.6); p.position.set(x, 0, z); scene.add(p); player.addBox(x - 0.3, x + 0.3, z - 0.3, z + 0.3, 0, 1.2); }
    // model satellite on a display stand in the lobby (it used to hang in mid-air with its thin panels edge-on to the player)
    const satStand = new THREE.Group(); H.box(1.4, 0.12, 1.0, MAT.metal(0x5a6070), 0, 0.06, 0, satStand); H.cyl(0.07, 0.09, 1.3, MAT.metal(0x8a8f99), 0, 0.77, 0, satStand, 12);
    const sat = makeSatelliteModel(); sat.scale.setScalar(0.62); sat.position.set(0, 1.42 + 0.25, 0); sat.rotation.set(0.18, -0.5, 0); satStand.add(sat);
    satStand.position.set(5.6, 0, -5.4); scene.add(satStand); player.addBox(4.9, 6.3, -5.9, -4.9, 0, 2.2);
    const satSign = makeSign('MODEL SATELLITE', 'Solar arrays · comms dish', 1.2); satSign.position.set(0, 0.62, 0.52); satSign.rotation.x = -0.5; satSign.scale.setScalar(0.5); satStand.add(satSign);
    // notice board (imported model; its pinned side faces -x in the file) on the back wall of the lobby
    whenModel('bulletin', gltf => { const nb = markImported(fit(instance(gltf), { size: 1.6, by: 'x', rotY: Math.PI / 2, ground: false })); nb.position.set(7.2, 1.55, -9.9); scene.add(nb); });
    const benches = makeChairRow(4, 0x3a5a8a); benches.position.set(-8, 0, 3.3); benches.rotation.y = Math.PI; scene.add(benches); player.addBox(-9.3, -6.7, 3, 3.6, 0, 1);

    // ---------- people ----------
    const guard = makePerson(LOOKS.guard); guard.root.position.set(3.4, 0, 1.6); guard.root.rotation.y = -Math.PI / 2; scene.add(guard.root);
    const gdesk = makeCounter(1.6); gdesk.position.set(2.6, 0, 1.6); gdesk.rotation.y = -Math.PI / 2; gdesk.scale.set(1, 0.9, 1); scene.add(gdesk); player.addBox(2.1, 3.7, 0.7, 2.5, 0, 1.2);
    const reg = makePerson(LOOKS.registrar); reg.root.position.set(-6, 0, -6.2); scene.add(reg.root);
    const rdesk = makeCounter(3.4); rdesk.position.set(-6, 0, -5.4); rdesk.rotation.y = Math.PI; scene.add(rdesk); player.addBox(-7.8, -4.2, -6.6, -4.9, 0, 1.2);
    const okafor = makePerson(LOOKS.okafor); okafor.root.position.set(-4.5, 0, -14.6); okafor.root.rotation.y = 0.4; scene.add(okafor.root); player.addBox(-4.75, -4.25, -14.85, -14.35, 0, 1.8);
    let talking = null;
    const who = () => ctx.dlg.active ? (ctx.dlg.el.querySelector('.cx-who')?.textContent || '') : '';

    // ---------- security ----------
    makeUsable(guard.root, { label: 'Officer Hale', verb: 'Talk to', range: 3.2, enabled: () => !talking, use: async () => {
      talking = 'guard';
      if (!ctx.isDone('security')) {
        const picked = await ctx.talk([
          { who: 'Officer Hale', text: 'Morning. Welcome to the Astronaut Training Centre. Can I see your invitation, please?', choices: [
            { text: 'Show your acceptance letter', goto: 'show', id: 'show' }, { text: 'I… think I left it in the car.', goto: 'left', id: 'left' }] },
          { id: 'left', who: 'Officer Hale', text: 'Check your pockets. Nobody gets past this desk without a letter.', goto: 'end' },
          { id: 'show', who: 'Officer Hale', text: 'Let\'s see… {name}, Junior Astronaut Training Program. You\'re on the list. Welcome!' },
          { who: 'Officer Hale', text: 'Walk through the scanner, nice and steady. Registration is the desk on the left.' }]);
        if (picked.includes('show')) { ctx.done('security'); gateCol.on = false; setLamp(arch.userData.lamp, 0x3fe0a0); sfx.good(); hud.cap('[Scanner gate unlocks]'); }
        else ctx.mistake('Said you forgot your letter at security.');
      } else await ctx.talk([{ who: 'Officer Hale', text: ctx.isDone('scan') ? 'Good luck in there, cadet.' : 'Go ahead, walk through the scanner.' }]);
      talking = null;
    } }); ix.add(guard.root);
    if (ctx.isDone('security')) { gateCol.on = false; setLamp(arch.userData.lamp, 0x3fe0a0); }

    // ---------- registration ----------
    makeUsable(reg.root, { label: 'Registrar Kim', verb: 'Talk to', range: 3.2, enabled: () => !talking && ctx.isDone('scan'), use: async () => {
      talking = 'reg';
      if (!ctx.isDone('register')) {
        let ok = false;
        while (!ok) {
          const picked = await ctx.talk([
            { who: 'Registrar Kim', text: 'Hello and welcome! Let\'s get you checked in. I have your name down as {name}. Is that right?', choices: [
              { text: 'Yes, that\'s me.', id: 'yes', goto: 'yes' }, { text: 'No, I need to correct it.', id: 'no', goto: 'no' }] },
            { id: 'yes', who: 'Registrar Kim', text: 'Perfect. You\'re checked in, {name}.', goto: 'end' },
            { id: 'no', who: 'Registrar Kim', text: 'No problem, type it in for me.', goto: 'end' }]);
          if (picked.includes('yes')) ok = true;
          else { ctx.input.releaseLock(); const nm = await askName(); career().player.name = nm; save(); }
        }
        await ctx.talk([
          { who: 'Registrar Kim', text: 'Next, the ID kiosk behind me on the left wall. It takes your photo and prints your astronaut ID badge.' },
          { who: 'Registrar Kim', text: 'Then head into the briefing room for the safety rules and your trainee agreement. Instructor Okafor is waiting for you.' }]);
        ctx.done('register');
      } else await ctx.talk([{ who: 'Registrar Kim', text: !ctx.isDone('badge') ? 'The ID kiosk is on the left wall, {name}.' : !ctx.isDone('sign') ? 'The briefing room is straight through the door at the back.' : 'You\'re all set! The training dashboard is on the right-hand wall.' }]);
      talking = null;
    } }); ix.add(reg.root);

    // ---------- ID kiosk and badge printer ----------
    const kiosk = makeKiosk(infoScreen('ASTRONAUT ID', ['Stand in front of the camera', 'and press Start.', '', ['▶ START', '#3fe0a0']], { w: 384, hgt: 264 }));
    kiosk.position.set(X0 + 0.5, 0, -7.6); kiosk.rotation.y = Math.PI / 2; scene.add(kiosk); player.addBox(X0, X0 + 0.85, -7.95, -7.25, 0, 2);
    const pstand = makeStand(0.95); pstand.position.set(X0 + 0.45, 0, -6.2); scene.add(pstand); player.addBox(X0, X0 + 0.75, -6.45, -5.95, 0, 1.3);
    const printer = makePrinter(); printer.position.set(X0 + 0.45, 0.95, -6.2); printer.rotation.y = Math.PI / 2; scene.add(printer);
    // the printed badge: a small card with the ID texture
    const cardTex = screenTex(640, 400, (x) => { const c = career(); drawIdCard(x, { name: c.player.name, idNo: c.player.idNo, look: c.player.look }); });
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.086, 0.054, 0.003), [MAT.std({ color: 0xf7f9fd }), MAT.std({ color: 0xf7f9fd }), MAT.std({ color: 0xf7f9fd }), MAT.std({ color: 0xf7f9fd }), MAT.std({ map: cardTex.tex, roughness: 0.5 }), MAT.std({ color: 0xf7f9fd })]);
    badge.scale.setScalar(2.2); badge.visible = false; badge.rotation.x = -Math.PI / 2; badge.position.set(X0 + 0.7, 1.09, -6.2); badge.rotation.z = Math.PI / 2; scene.add(badge);
    makeUsable(kiosk, { label: 'ID kiosk', verb: 'Use', range: 2.4, enabled: () => !talking, use: async () => {
      if (!ctx.isDone('register')) { sfx.wrong(); hud.flash('Check in at the registration desk first.', 'bad'); return; }
      if (ctx.isDone('id')) { hud.flash(ctx.isDone('badge') ? 'Your ID is done. Show it any time with the 🪪 button.' : 'Your badge is in the printer tray.'); return; }
      ctx.input.releaseLock(); talking = 'kiosk';
      await openIdCreator(); talking = null;
      kiosk.userData.screen.redraw(infoScreen('ASTRONAUT ID', [['Photo taken ✓', '#3fe0a0'], 'Printing your badge…', 'Collect it from the tray.'], { w: 384, hgt: 264 }));
      sfx.ui(); hud.cap('[Camera click · printer whirrs]'); ctx.done('id');
      cardTex.redraw(); setTimeout(() => { badge.visible = true; sfx.place(); }, 900);
    } }); ix.add(kiosk);
    makeUsable(printer, { label: 'Badge printer', verb: 'Take your badge from the', range: 2.4, enabled: () => ctx.isDone('id') && !ctx.isDone('badge'), use: () => takeBadge() }); ix.add(printer);
    makeUsable(badge, { label: 'ID badge', verb: 'Take', range: 2.4, enabled: () => !ctx.isDone('badge'), use: () => takeBadge() }); ix.add(badge);
    function takeBadge() { if (ctx.isDone('badge')) return; badge.visible = false; sfx.pickup(); ctx.giveItem('idcard', 'Astronaut ID badge', '🪪'); ctx.done('badge'); hud.flash('Badge clipped on! Show it any time with the 🪪 button. Now the briefing room.', '', 4000); }
    if (ctx.isDone('id') && !ctx.isDone('badge')) badge.visible = true;

    // ---------- briefing room: rules screen, agreement, Okafor ----------
    const rulesScr = makeScreen(3.2, 1.8, infoScreen('SAFETY RULES', RULES.map((r, i) => `${i + 1}. ${r[0]}`), { w: 768, hgt: 432 }), [768, 432]);
    rulesScr.position.set(1.5, 2.0, Z0 + 0.06); scene.add(rulesScr);
    for (let r = 0; r < 3; r++) { const row = makeChairRow(5); row.position.set(1.5, 0, -11.3 - r * 1.1); scene.add(row); player.addBox(-0.1, 3.1, -11.55 - r * 1.1, -11.05 - r * 1.1, 0, 0.9); }
    const tbl = H.makeTable(1.2, 0.7); tbl.position.set(7, 0, -12.5); scene.add(tbl); player.addBox(6.35, 7.65, -12.9, -12.1, 0, 0.8);
    const clip = makeClipboard(); clip.position.set(7, 0.78, -12.5); scene.add(clip);
    makeUsable(rulesScr, { label: 'Safety rules screen', verb: 'Read', range: 5, enabled: () => !talking, use: () => readRules() }); ix.add(rulesScr);
    makeUsable(clip, { label: 'Trainee agreement', verb: 'Read and sign', range: 2.4, enabled: () => !talking, use: () => signAgreement() }); ix.add(clip);
    makeUsable(okafor.root, { label: 'Instructor Okafor', verb: 'Talk to', range: 3.2, enabled: () => !talking, use: async () => {
      talking = 'okafor';
      await ctx.talk([{ who: 'Instructor Okafor', text: !ctx.isDone('rules') ? 'Welcome, {name}! Before anything else, read the safety rules on the big screen. There\'s a short check at the end.' : !ctx.isDone('sign') ? 'Good. Now read and sign the trainee agreement on the table.' : 'You\'re ready. Use the training dashboard in the lobby to start your first module: spacesuit preparation. I\'ll see you in the training hall.' }]);
      talking = null;
    } }); ix.add(okafor.root);
    async function readRules() {
      if (!ctx.isDone('badge')) { sfx.wrong(); hud.flash('Get your ID badge first: the kiosk is on the left wall of the lobby.', 'bad'); return; }
      talking = 'rules'; ctx.input.releaseLock();
      await readDoc({ title: '📋 Training centre safety rules', confirm: 'Take the check ▸', body: h('div', {}, h('p', {}, 'Every astronaut candidate follows these six rules in every session.'), h('ol', {}, RULES.map(([t, d]) => h('li', {}, h('b', {}, t), ' ', d)))), ticks: ['I have read and understood the safety rules.'] });
      const r = await runQuiz({ title: '✅ Safety rules check', intro: 'Three quick questions about the rules.', questions: RULES_QUIZ });
      r.wrong.forEach(q => ctx.mistake(`Rules check: "${q}"`));
      state.rulesScore = `${r.correct}/${r.total}`; talking = null;
      ctx.done('rules'); hud.flash(`Rules check: ${r.correct} of ${r.total} correct. Now sign the agreement on the table.`, r.wrong.length ? '' : 'good', 4000);
    }
    async function signAgreement() {
      if (!ctx.isDone('rules')) { sfx.wrong(); hud.flash('Read the safety rules on the big screen first.', 'bad'); return; }
      if (ctx.isDone('sign')) { hud.flash('Already signed. Head to the training dashboard in the lobby.'); return; }
      talking = 'sign'; ctx.input.releaseLock();
      const nm = career().player.name;
      await signDoc(nm);
      sfx.paper(); ctx.done('sign'); talking = null;
      await ctx.talk([{ who: 'Instructor Okafor', text: 'Welcome to the programme, Cadet {name}. Your training dashboard is in the lobby on the right-hand wall. It shows every module and what comes next.' }]);
    }

    // ---------- dashboard terminals ----------
    const terms = [-3.5, -5, -6.5].map(z => { const t = makeTerminal(infoScreen('TRAINING', ['Dashboard', ['Tap to open', '#3fe0a0']], { w: 448, hgt: 304 })); t.position.set(X1 - 0.6, 0, z); t.rotation.y = -Math.PI / 2; scene.add(t); player.addBox(X1 - 0.85, X1 - 0.35, z - 0.25, z + 0.25, 0, 1.4); return t; });
    const bigScr = makeScreen(3.6, 2.0, drawBig, [768, 432]); bigScr.position.set(X1 - 0.08, 2.4, -5); bigScr.rotation.y = -Math.PI / 2; scene.add(bigScr);
    function drawBig(x) { const n = nextModule(); infoScreen('TRAINING DASHBOARD', [`Cadet: ${career().player.name || '—'}`, `ID: ${career().player.idNo || 'not issued yet'}`, '', n ? [`Next: ${n.name}`, '#3fe0a0'] : ['Registration first', '#ffc857']], { w: 768, hgt: 432 })(x); }
    const useDash = () => {
      if (!ctx.isDone('sign')) { sfx.wrong(); hud.flash(!ctx.isDone('badge') ? 'Register and get your ID badge first.' : 'Read the rules and sign the agreement in the briefing room first.', 'bad'); return; }
      ctx.input.releaseLock();
      if (!ctx.isDone('dash')) { ctx.done('dash'); return finishRegistration(); }
      openHub();
    };
    terms.forEach(t => { makeUsable(t, { label: 'Training dashboard', verb: 'Open', range: 2.4, enabled: () => !talking, use: useDash }); ix.add(t); });
    function openHub() {
      openDashboard({ intro: 'Pick your next module. Each one ends with a score, your mistakes and the science behind it.', onStart: md => {
        const c = career(); delete c.scenes[md.scene]; c.pos = null; save();  // every run starts fresh
        ctx.goto(md.scene);
      } });
    }
    function finishRegistration() {
      const pen = ctx.diff.mistakePenalty, mistakes = [...state.mistakes];
      ctx.finish({ id: 'registration', title: 'Registration complete', score: Math.max(40, 100 - mistakes.length * pen), mistakes, xp: 150, badge: 'cadet-registered', card: 'Astronaut ID',
        science: 'Real astronaut candidates spend their first weeks on exactly this: safety briefings, medical checks, paperwork and an introduction to every training facility. Crews use the same rules you just learned: anyone can call a stop, instructions are read back, and every piece of equipment is checked before use.',
        next: 'Your first training module: Spacesuit Preparation. Open the training dashboard to start it.',
        continueLabel: 'Open the dashboard',
        onContinue: rt => { rt.finished = false; bigScr.userData.screen.redraw(drawBig); openHub(); } });
      state.mistakes = [];
    }
    function signDoc(name) {
      return new Promise(resolve => {
        const cv = h('canvas', { class: 'cx-sign', width: 600, height: 140, 'aria-label': 'Signature pad: draw your signature' }); const cx = cv.getContext('2d');
        cx.fillStyle = '#fbf8ef'; cx.fillRect(0, 0, 600, 140); cx.strokeStyle = '#aab'; cx.beginPath(); cx.moveTo(20, 110); cx.lineTo(580, 110); cx.stroke();
        let pts = 0, down = false, last = null;
        const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * 600 / r.width, (e.clientY - r.top) * 140 / r.height]; };
        cv.addEventListener('pointerdown', e => { down = true; last = pos(e); cv.setPointerCapture(e.pointerId); });
        cv.addEventListener('pointermove', e => { if (!down) return; const p = pos(e); cx.strokeStyle = '#0d2f6e'; cx.lineWidth = 3; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(...last); cx.lineTo(...p); cx.stroke(); last = p; pts++; chk(); });
        cv.addEventListener('pointerup', () => { down = false; });
        const typed = h('button', { class: 'btn sm', onclick: () => { cx.fillStyle = '#0d2f6e'; cx.font = 'italic 46px Georgia, serif'; cx.fillText(name, 40, 98); pts = 99; chk(); } }, `✍ Sign as "${name}" for me`);
        const ok = h('button', { class: 'btn primary', disabled: true }, 'Sign the agreement ▸');
        const boxes = ['I will follow the safety rules and my instructors.', 'I will report any problem with equipment or with how I feel.', 'I will look after my crewmates.'].map(t => h('label', { class: 'cx-tick' }, h('input', { type: 'checkbox', onchange: () => chk() }), ' ', t));
        const chk = () => { ok.disabled = !(pts > 15 && boxes.every(b => b.querySelector('input').checked)); };
        const md = openModal({ title: '✍ Trainee agreement', label: 'Trainee agreement', wide: true, closable: false, body: h('div', { class: 'cx-doc' },
          h('p', {}, `I, ${name}, join the Junior Astronaut Training Program as an astronaut candidate.`),
          h('p', {}, 'I understand that training includes physical activity, simulations, water training and teamwork, and that my instructors may stop any session for safety.'),
          h('div', { class: 'cx-ticks' }, boxes), h('p', { class: 'muted tiny' }, 'Draw your signature on the line (mouse or finger), or use the button.'), cv, typed),
          foot: [ok] });
        ok.onclick = () => { md.close(); resolve(true); };
      });
    }

    // ---------- spawn and progress by position ----------
    const registered = ctx.isDone('dash');
    const doorMarks = { scan: new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshBasicMaterial({ visible: false })) }; doorMarks.scan.position.set(0, 1.4, 0); scene.add(doorMarks.scan);
    const cam = new THREE.Vector3();
    return {
      spawn: registered ? [X1 - 2.6, -5, -Math.PI / 2, 0] : [0, 2.8, 0, 0],
      markerFor: id => ({ security: guard.root, scan: doorMarks.scan, register: reg.root, id: kiosk, badge: ctx.isDone('id') ? printer : kiosk, rules: rulesScr, sign: clip, dash: terms[1], train: terms[1] }[id] || null),
      onEnter: () => { if (!ctx.isDone('security')) hud.flash('Show your letter to Officer Hale at the security desk on the right.', '', 4000); else if (registered) { bigScr.userData.screen.redraw(drawBig); const n = nextModule(); hud.flash(n ? `Next up: ${n.name}. Use the dashboard on this wall.` : 'Use the dashboard to replay modules.', '', 4000); } },
      update(dt) {
        world.camera.getWorldPosition(cam);
        const w = who();
        animatePerson(guard, dt, { lookAt: cam.distanceTo(guard.root.position) < 7 ? cam : null, talking: w === 'Officer Hale' });
        animatePerson(reg, dt, { lookAt: cam.distanceTo(reg.root.position) < 7 ? cam : null, talking: w === 'Registrar Kim' });
        animatePerson(okafor, dt, { lookAt: cam.distanceTo(okafor.root.position) < 8 ? cam : null, talking: w === 'Instructor Okafor' });
        sat.rotation.y += dt * 0.08;
        const p = player.pos;
        if (ctx.isDone('security') && !ctx.isDone('scan') && p.z < -0.6) { ctx.done('scan'); sfx.good(); hud.cap('[Scanner beeps: clear]'); hud.flash('Clear! Registration is the desk on the left.', 'good'); }
      }
    };
    void holdInHand; void openLetter;
  }
};
