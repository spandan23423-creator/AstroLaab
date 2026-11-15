// ASTRO LAB Career — scene runner: builds a first-person scene, runs the frame loop, pause, save and exit.
import * as THREE from '../../vendor/three.module.js';
import { $, h, openModal, closeAllModals, modalOpen, toast } from '../ui/dom.js';
import { settings, progress, save, saveNow, saveHealthy, addXP, awardBadge, log, bus } from '../systems/core.js';
import { World } from './engine/world.js';
import { Input } from './engine/input.js';
import { FPController } from './engine/fpController.js';
import { Interactor } from './engine/interact.js';
import { Carry } from './engine/carry.js';
import { Hands } from './engine/hands.js';
import { auditScene } from './engine/layers.js';
import { Dialogue } from './engine/dialogue.js';
import { CareerHUD } from './ui/hud.js';
import { openResults } from './ui/results.js';
import { career, sceneState, recordTraining } from './state/careerSave.js';
import { difficulty } from './state/difficulty.js';
import { sfx, playMusic, stopMusic, playAmbience, stopAmbience } from './engine/audio.js';
import { openCareerControls } from './ui/menus.js';
import { openLetter } from './ui/letter.js';
import { showIdCard } from './ui/idCard.js';

const SCENES = { tutorial: () => import('./scenes/tutorial.js'), home: () => import('./scenes/home.js'), car: () => import('./scenes/car.js'), arrival: () => import('./scenes/arrival.js'), centre: () => import('./scenes/centre.js'), suit: () => import('./scenes/suit.js'), inspection: () => import('./scenes/inspection.js'), mobility: () => import('./scenes/mobility.js'), lowg: () => import('./scenes/lowg.js'), pool: () => import('./scenes/pool.js'), emergency: () => import('./scenes/emergency.js'), equipment: () => import('./scenes/equipment.js'), survival: () => import('./scenes/survival.js'), greenhouse: () => import('./scenes/greenhouse.js'), medical: () => import('./scenes/medical.js'), spacecraft: () => import('./scenes/spacecraft.js'), eva: () => import('./scenes/eva.js'), launch: () => import('./scenes/launch.js'), powerlab: () => import('./scenes/powerlab.js'), moonpower: () => import('./scenes/moonpower.js') };
export const SCENE_IDS = Object.keys(SCENES);
let app = null, run = null;
export function initCareer(a) {
  app = a;
  // Save position immediately when the tab is hidden or closed (the normal save is debounced)
  const flush = () => { if (run && !run.disposed) { run.save(); saveNow(); } };
  addEventListener('pagehide', flush); document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
}
export const careerRunning = () => !!run;

function fade(on, ms = 600) {
  let f = document.getElementById('cx-fade');
  if (!f) { f = h('div', { id: 'cx-fade', 'aria-hidden': 'true' }); document.body.append(f); }
  f.style.transitionDuration = (settings.reducedMotion ? 0 : ms) + 'ms';
  requestAnimationFrame(() => f.classList.toggle('on', on));
  return new Promise(r => setTimeout(r, settings.reducedMotion ? 0 : ms + 30));
}
// Move from one story scene to the next with a fade to black
async function gotoScene(id, opts = {}) {
  const cur = run; if (!cur) return startCareerScene(id, opts);
  await fade(true);
  cur.save(); cur.dispose(); run = null; $('#screen-career').innerHTML = '';
  const c = career(); c.scene = id; c.pos = null; save();
  await startCareerScene(id, { mode: cur.mode, ...opts, fromTransition: true });
  await fade(false, 900);
}

export async function startCareerScene(id, { mode = 'story', resume = false, fromTransition = false } = {}) {
  if (run) return;
  if (!SCENES[id]) { id = 'centre'; resume = false; } // a save from an older build may point at a removed area (robotic arm)
  if (!fromTransition) await fade(true, 250);
  const test = document.createElement('canvas');
  if (!(test.getContext('webgl2') || test.getContext('webgl'))) { fade(false, 0); openModal({ title: '3D unavailable', body: '<p>Career Mode needs WebGL. Try updating your browser or turning on hardware acceleration.</p>' }); return; }
  closeAllModals();
  const screen = $('#screen-career'); screen.innerHTML = '';
  const loading = h('div', { class: 'sx-loading' }, h('div', { class: 'logo-orbit' }, h('span', { class: 'logo-planet' })), h('p', {}, 'Loading…'));
  screen.append(loading); app.show('career');
  try {
    const def = (await SCENES[id]()).default;
    run = new Runtime(def, mode);
    await run.build(screen, resume);
    loading.remove(); run.start();
    if (!fromTransition) fade(false, 700);
  } catch (e) {
    fade(false, 0);
    console.error(e); try { run?.dispose(); } catch {}
    run = null; screen.innerHTML = '';
    toast({ icon: '⚠️', title: 'Could not load this area', text: 'Returning to the main menu.' }); app.toMenu();
  }
}

class Runtime {
  constructor(def, mode) { this.def = def; this.mode = mode; this.paused = false; this.saveT = 0; this.disposed = false; }
  async build(screen, resume) {
    const world = this.world = new World(screen);
    const input = this.input = new Input(screen, world.renderer.domElement);
    const player = this.player = new FPController(world.camera, input);
    const hud = this.hud = new CareerHUD(screen, { onPause: () => this.pause(), onHelp: () => this.help() });
    hud.touch = input.touch;
    const ix = this.ix = new Interactor(world, player);
    const carry = this.carry = new Carry(world, player, ix, hud);
    const hands = this.hands = new Hands(world); carry.hands = hands;
    const dlg = this.dlg = new Dialogue(screen);
    input.buildTouchUI(screen, [
      { action: 'use', icon: '✋', label: 'Use / pick up', short: 'Use', cls: 'big' },
      { action: 'crouch', icon: '⤵', label: 'Crouch (toggle)', short: 'Crouch' },
      { action: 'rotate', icon: '⟳', label: 'Rotate held item', short: 'Rotate' },
      { action: 'drop', icon: '⤓', label: 'Put down held item', short: 'Drop' },
      { action: 'throw', icon: '↗', label: 'Throw held item', short: 'Throw' },
      { action: 'inventory', icon: '🎒', label: 'Backpack: put away or take out', short: 'Pack' },
      { action: 'spray', icon: '💨', label: 'Hold to spray', short: 'Spray', hold: true },
      { action: 'sprint', icon: '»', label: 'Hold to jog', short: 'Jog', hold: true }
    ]);
    if (input.touchButtons?.spray) input.touchButtons.spray.hidden = true; // shown by scenes that have a spray tool
    input.onUnlock = () => { if (input.expectUnlock) { input.expectUnlock = false; return; } if (!this.dlg.active && !modalOpen() && !this.disposed) this.pause(); };
    input.onTap = (x, y) => { // tap an object to use it (touch)
      const r = world.renderer.domElement.getBoundingClientRect();
      const it = ix.pick(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1));
      if (it && !this.blocked()) it.use();
    };
    const st = this.mode === 'story' ? sceneState(this.def.id, this.def.initialState || {}) : JSON.parse(JSON.stringify(this.def.initialState || {}));
    const steps = (this.def.steps || []).map(s => ({ ...s, done: !!st.steps?.[s.id] }));
    const self = this;
    this.ctx = {
      THREE, world, scene: world.scene, player, ix, carry, hands, hud, dlg, input, sfx, mode: this.mode, state: st, career: career(), diff: difficulty(),
      steps, mistakes: st.mistakes || (st.mistakes = []),
      get name() { return career().player.name || 'Cadet'; },
      done(id) { const s = steps.find(x => x.id === id); if (!s || s.done) return false; s.done = true; (st.steps || (st.steps = {}))[id] = true; sfx.good(); self.refreshObjectives(); self.save(); return true; },
      isDone: id => !!steps.find(x => x.id === id)?.done,
      current: () => steps.find(s => !s.done),
      mistake(text) { st.mistakes.push(text); save(); },
      talk: (script) => self.talk(script),
      finish: (result) => self.finish(result),
      finishChapter: (r) => self.finishChapter(r),
      save: () => self.save(),
      saveNow: () => save(),
      goto: (id) => gotoScene(id),
      fade,
      hasItem: id => career().inventory.items.some(x => x.id === id),
      giveItem(id, name, icon) { const inv = career().inventory; if (!inv.items.some(x => x.id === id)) inv.items.push({ id, name, icon }); save(); self.refreshItems(); },
      refreshObjectives: () => self.refreshObjectives()
    };
    this.api = await this.def.build(this.ctx);
    // Anything tagged as portable by its model (clipboards, mugs, small boxes...) can be picked up, carried and put down
    const loose = []; world.scene.traverse(o => { if (o.userData.portable && !o.userData.it && !o.userData.carry) loose.push(o); });
    loose.forEach((o, i) => carry.makeCarriable(o, { id: 'loose' + i, name: o.userData.portable, critical: false }));
    auditScene(world.scene); // render-order convention: transparent, decal and hit-box fixes (engine/layers.js)
    const c = career();
    if (resume && c.scene === this.def.id && c.pos) player.place(c.pos[0], c.pos[2], c.yaw || 0, c.pitch || 0, c.pos[1]);
    else player.place(...this.api.spawn);
    if (this.mode === 'story') { c.scene = this.def.id; save(); }
    this.refreshObjectives(); this.refreshItems();
    world.updaters.add(dt => this.frame(dt));
    playMusic(this.def.music || 'centre'); playAmbience(this.def.ambience || 'room');
    if (this.api.onEnter) setTimeout(() => this.api.onEnter(), 400);
  }
  start() { this.world.start(); }
  // Items the player carries between scenes: the acceptance letter (L) and the astronaut ID badge. Buttons re-open them.
  refreshItems() {
    this.itemBtn?.remove(); this.itemBtn = null;
    if (this.mode !== 'story') return;
    const btns = [];
    if (this.ctx.hasItem('letter')) btns.push(h('button', { class: 'tbtn', 'aria-label': 'Read your acceptance letter (L)', title: 'Acceptance letter (L)', onclick: () => this.readLetter() }, '✉', h('span', {}, 'Letter')));
    if (this.ctx.hasItem('idcard')) btns.push(h('button', { class: 'tbtn', 'aria-label': 'Show your astronaut ID', title: 'Astronaut ID', onclick: () => { if (!this.blocked()) { this.input.releaseLock(); showIdCard(); } } }, '🪪', h('span', {}, 'ID')));
    if (!btns.length) return;
    this.itemBtn = h('div', { class: 'cx-item-btn' }, btns);
    $('#screen-career').append(this.itemBtn);
  }
  readLetter() { if (this.blocked()) return; this.input.releaseLock(); openLetter({}); }
  blocked() { return this.paused || this.dlg.active || modalOpen() || this.ending; }
  refreshObjectives() {
    const s = this.ctx.steps, cur = s.findIndex(x => !x.done);
    this.hud.setObjectives(this.def.title, s, cur);
    const curStep = s[cur]; this.ix.mark(curStep ? this.api.markerFor?.(curStep.id) || null : null);
  }
  async talk(script) {
    this.input.releaseLock(); this.player.frozen = true;
    try { return await this.dlg.run(script, { name: this.ctx.name }); } finally { this.player.frozen = false; }
  }
  frame(dt) {
    const blocked = this.blocked();
    this.player.frozen = blocked || this.player.frozenByScene;
    const seated = !!this.player.seat && !this.player.seat.float; if (seated !== this._seated) { this._seated = seated; $('#screen-career')?.classList.toggle('cx-seated', seated); }
    this.player.update(dt);
    const it = blocked ? null : this.ix.update(dt);
    if (blocked) this.ix.update(0);
    this.hud.showPrompt(it || (blocked ? null : this.api.defaultPrompt?.() || null), this.input.lastDevice, !blocked && this.carry.held && !it);
    const hp = this.carry.hold.position; this.hands.update(dt, { focus: !!it, holding: this.carry.held, big: this.carry.heldBig, holdAt: [hp.x, hp.y, hp.z], half: this.carry.heldHalf || 0.1, hidden: (blocked && !this.dlg.active) || this.api.hideHands?.() });
    const cine = !this.paused && !modalOpen() && this.api.cinematic?.(); this.hud.setSkip(cine ? () => this.api.skipCinematic?.() : null);
    const I = this.input;
    if (!blocked) {
      if (I.hit('use')) { if (it) it.use(); else this.api.onUse?.(); }
      if (I.hit('letter') && this.ctx.hasItem('letter')) this.readLetter();
      if (I.hit('rotate')) this.carry.rotate(1);
      if (I.hit('rotateBack')) this.carry.rotate(-1);
      if (I.hit('drop')) { if (this.carry.held) this.carry.drop(); }
      if (I.hit('throw') && this.carry.held) this.carry.throw();
      if (I.hit('inventory') && (this.carry.held || this.carry.stowed.length)) this.carry.stow();
      if (cine && I.hit('skip')) this.api.skipCinematic?.();
      if (I.hit('help')) this.help();
      if (I.hit('pause')) this.pause();
    } else if (this.dlg.active) {
      if (I.padActions?.has(0)) this.dlg.padNext?.();
      if (I.padActions?.has(1)) this.dlg.skip?.(); // B = skip conversation
      [0, 1, 2, 3].forEach(k => { if (I.padActions?.has(12 + k)) this.dlg.padChoose?.(k); }); // d-pad picks choices
    }
    this.carry.update(dt);
    this.api.update?.(dt, blocked);
    this.hud.setLockHint(!I.touch && !I.pointerLocked() && !blocked && I.lastDevice === 'kbm');
    I.endFrame();
    this.saveT += dt; if (this.saveT > 3 && !blocked) { this.saveT = 0; this.save(); }
  }
  save() {
    if (this.mode !== 'story' || this.disposed || this.finished) return;
    const c = career(), p = this.player.pos;
    c.scene = this.def.id; c.pos = [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)]; c.yaw = +this.player.yaw.toFixed(3); c.pitch = +this.player.pitch.toFixed(3);
    this.api.saveState?.(this.ctx.state);
    save();
  }
  pause() {
    if (this.paused || this.ending) return; this.paused = true; this.input.releaseLock();
    const m = openModal({ title: '❚❚ Paused', label: 'Pause menu', body: `<p>${this.def.title}. ${this.mode === 'story' ? (saveHealthy() ? 'Your progress is saved automatically.' : '⚠️ Progress can\'t be saved right now: this browser is blocking or out of storage.') : 'Practice run: story progress is not affected.'}</p>`, onClose: () => { this.paused = false; }, foot: [
      h('button', { class: 'btn', onclick: () => { m.close(); this.help(); } }, '❔ Controls'),
      h('button', { class: 'btn', onclick: () => { app.open('settings'); } }, '⚙ Settings'),
      h('button', { class: 'btn', onclick: () => { m.close(); this.exit(); } }, this.mode === 'story' ? '💾 Save & main menu' : '☰ Main menu'),
      h('button', { class: 'btn primary', onclick: () => m.close() }, '▶ Resume')] });
  }
  help() { this.input.releaseLock(); openCareerControls(); }
  // Called by the scene when its activity is complete: XP/badge once, results card, then the scene decides what's next
  finish({ id, title, score, mistakes, science, xp = 0, badge, card, next, onContinue, continueLabel }) {
    this.ending = true; this.input.releaseLock(); this.save(); this.finished = true;
    const first = !career().training[id]?.done;
    recordTraining(id, { score, mistakes, passed: true });
    const rewards = {};
    if (first) { if (xp) { addXP(xp, title); rewards.xp = xp; } const won = [].concat(badge || []).filter(b => awardBadge(b)); if (won.length) { rewards.badge = won[0]; rewards.badges = won; } if (card) rewards.card = card; log(`Training complete: ${title} (${score}/100)`, '🎓'); }
    openResults({ title, score, mistakes, science, rewards, next, continueLabel, onContinue: () => { this.ending = false; onContinue ? onContinue(this) : this.exit(); } });
  }
  // End of a story chapter: no score, a short card with XP (first time only), then the scene decides what's next
  finishChapter({ id, title, xp = 0, badge, science, next, onContinue, continueLabel = 'Continue' }) {
    this.ending = true; this.input.releaseLock(); this.save(); this.finished = true;
    const c = career(), key = 'chapter_' + id, first = !c.flags[key], rewards = {};
    c.flags[key] = true;
    if (first) { if (xp) { addXP(xp, title); rewards.xp = xp; } const won = [].concat(badge || []).filter(b => awardBadge(b)); if (won.length) { rewards.badge = won[0]; rewards.badges = won; } log(`Chapter complete: ${title}`, '📖'); }
    save();
    openResults({ chapter: true, title, science, rewards, next, continueLabel, onContinue: () => { this.ending = false; onContinue ? onContinue(this) : this.exit(); } });
  }
  exit() { if (this.disposed) return; this.save(); this.dispose(); run = null; $('#screen-career').innerHTML = ''; stopAmbience(); playMusic('menu'); app.toMenu(); }
  dispose() { this.disposed = true; $('#screen-career')?.classList.remove('cx-seated'); this.hands?.dispose(); this.world.dispose(); this.input.dispose(); this.api?.dispose?.(); }
}

export function careerEsc() { if (!run) return false; if (!run.paused) run.pause(); return true; }
export function careerHelp() { if (run) run.help(); else openCareerControls(); }
export function careerDebug() { return run; }
