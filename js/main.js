// ASTRO LAB — boot, screen routing and the main menu. The game is Lunar-only: astronaut training (Career Mode)
// and the Lunar Mission (Moon landing sites). Free Explore and the solar system were removed.
import { $, $$, closeTopModal, closeAllModals, modalOpen, toast } from './ui/dom.js';
import { settings, loadSave } from './systems/core.js';
import { generateTexture, TEXTURE_IDS, spherePreview } from './scene/textures.js';
import { upgradeMoonTextures } from './scene/realMaps.js';
import { initModals, openSettings } from './ui/modals.js';
import { initSurface, openSitePicker, surfaceEsc } from './ui/surface.js';
import { initCareer, startCareerScene, careerEsc, careerDebug } from './career/career.js';
import { initCareerMenus, openNewGame, resumeGame, openTrainingModules, openAchievements, openCredits, quitGame } from './career/ui/menus.js';
import { careerStarted } from './career/state/careerSave.js';
import { playMusic } from './career/engine/audio.js';
import { startMenuParticles } from './career/ui/menuFx.js';
import { preloadModels } from './assets/models.js';

const app = {
  scene: null, textures: {}, previews: {}, mode: 'loading',
  toMenu, applyJoystick, show: id => show(id),
  open: what => { if (what === 'settings') openSettings(); else if (what === 'menu') toMenu(); },
  openSurface: () => openSitePicker(),
  menuAction: a => menuAction(a)
};
window.__astrolab = app; // handy for debugging in the console
app.careerRun = () => careerDebug();
preloadModels(); // imported GLB models (embedded in index.html) are decoded in the background; scenes swap them in when ready

// ---------------- Error handling ----------------
let errShown = 0;
window.addEventListener('error', e => { console.error(e.error || e.message); if (errShown++ < 2 && app.mode !== 'loading') toast({ icon: '⚠️', title: 'Something went wrong', text: 'The game recovered. If anything looks odd, reload the page.' }); });
window.addEventListener('unhandledrejection', e => console.error(e.reason));

function fatal(msg) { const f = $('#fatal'); f.hidden = false; f.innerHTML = `<div class="glass" style="padding:24px;max-width:520px"><h2>ASTRO LAB couldn't start</h2><p>${msg}</p><button class="btn primary" onclick="location.reload()">Reload</button></div>`; }

// ---------------- Screens ----------------
function show(id) {
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === `screen-${id}`));
  $(`#screen-${id}`)?.classList.add('fade-in');
  app.mode = id;
  const backdrop = id === 'menu' || id === 'quit';
  $('#scene-root').style.visibility = backdrop ? 'visible' : 'hidden';
  app.scene?.setActive(backdrop);
}
function toMenu() {
  closeAllModals(); show('menu');
  $('#btn-resume').hidden = !careerStarted();
  $('#menu-note').textContent = !app.scene ? 'This browser could not start WebGL, which the 3D game needs. Try updating your browser or turning on hardware acceleration.'
    : careerStarted() ? '' : 'New here? Press New Game to start your astronaut story.';
  if (musicPrimed) playMusic('menu');
}

// ---------------- Boot ----------------
async function boot() {
  document.documentElement.style.setProperty('--ts', settings.textScale);
  if (!['auto', 'low', 'medium', 'high', 'ultra'].includes(settings.quality)) settings.quality = 'auto';
  document.body.classList.toggle('reduced-motion', !!settings.reducedMotion);
  if (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) document.body.classList.add('touch');
  applyJoystick();
  loadSave();
  const fill = $('#load-fill'), txt = $('#load-text'), bar = $('.load-bar');
  const setP = (p, t) => { fill.style.width = `${p}%`; bar.setAttribute('aria-valuenow', p); if (t) txt.textContent = t; };
  const q = settings.quality === 'low' ? 'low' : (matchMedia('(max-width: 720px)').matches ? 'medium' : 'high');
  for (let i = 0; i < TEXTURE_IDS.length; i++) {
    const id = TEXTURE_IDS[i];
    try { app.textures[id] = generateTexture(id, q); } catch (e) { console.warn('Texture failed', id, e); app.textures[id] = null; }
    setP(Math.round((i + 1) / (TEXTURE_IDS.length + 2) * 100), 'Preparing the Moon…');
    await new Promise(r => setTimeout(r, 0));
  }
  // Swap in the real map of the Moon (LRO-based). Any failure keeps the generated texture.
  txt.textContent = 'Loading the lunar map…';
  try { app.realMaps = await upgradeMoonTextures(app.textures, q); } catch (e) { console.warn(e); app.realMaps = []; }
  try { app.previews.moon = spherePreview(app.textures.moon, 144); } catch { app.previews.moon = null; }
  initModals(app); initSurface(app); initCareer(app); initCareerMenus(app, startCareerScene);
  document.body.classList.toggle('cb', !!settings.colorblind);
  startMenuParticles($('#menu-particles'), () => app.mode === 'menu');
  const prime = () => { musicPrimed = true; if (app.mode === 'menu' || app.mode === 'quit') playMusic('menu'); removeEventListener('pointerdown', prime, true); removeEventListener('keydown', prime, true); };
  addEventListener('pointerdown', prime, true); addEventListener('keydown', prime, true);
  // 3D menu backdrop (Earth and the Moon). Career Mode and the Lunar Mission build their own renderers.
  try {
    const test = document.createElement('canvas');
    if (!(test.getContext('webgl2') || test.getContext('webgl'))) throw new Error('WebGL not supported');
    const { MenuBackdrop } = await import('./scene/menuBackdrop.js');
    app.scene = new MenuBackdrop($('#scene-root'), app.textures);
  } catch (e) { console.error(e); app.scene = null; }
  setP(100, 'Ready.');
  initMenu(); initKeys();
  await new Promise(r => setTimeout(r, settings.reducedMotion ? 0 : 450));
  toMenu();
}

// ---------------- Menu ----------------
function initMenu() {
  $('#screen-menu').addEventListener('click', e => {
    const a = e.target.closest('[data-action]')?.dataset.action; if (a) menuAction(a);
  });
  $('#btn-unquit').addEventListener('click', () => toMenu());
}
function menuAction(a) {
  if (a === 'newgame') openNewGame();
  if (a === 'resume') resumeGame();
  if (a === 'training') openTrainingModules();
  if (a === 'lunar') openSitePicker();
  if (a === 'achievements') openAchievements();
  if (a === 'settings') openSettings();
  if (a === 'credits') openCredits();
  if (a === 'quit') quitGame();
}

let musicPrimed = false;
function applyJoystick() {
  document.body.classList.toggle('joy-on', settings.joystick === 'on');
  document.body.classList.toggle('joy-off', settings.joystick === 'off');
  const b = document.body;
  if (settings.controls === 'touch') b.classList.add('touch');
  else if (settings.controls === 'kbm' || settings.controls === 'gamepad') b.classList.remove('touch');
  else if (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) b.classList.add('touch');
  b.classList.toggle('force-kbm', settings.controls === 'kbm' || settings.controls === 'gamepad');
}

// ---------------- Keyboard ----------------
// Career Mode and the Lunar Mission handle their own movement keys; here only Esc and the Lunar Mission's H.
function initKeys() {
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); handleEsc(); return; }
    // H opens the Lunar Mission controls during an expedition (Career Mode handles its own H)
    if (e.code === 'KeyH' && app.mode === 'surface' && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && !modalOpen()) { const g = window.__astrolab.surface; if (g?.running) g.help(); }
  });
}
function handleEsc() {
  if (closeTopModal()) return;
  if (app.mode === 'surface') { surfaceEsc(); return; }
  if (app.mode === 'career') { careerEsc(); return; }
  if (app.mode === 'quit') { toMenu(); return; }
}

boot().catch(e => { console.error(e); fatal('An unexpected error occurred while loading. Please reload the page.'); });
