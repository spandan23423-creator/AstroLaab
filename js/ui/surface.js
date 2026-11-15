// ASTRO LAB — Lunar Mission: landing-site picker and screen flow (Earth's Moon only)
import { SITES, SURFACE_BODIES, sitesFor } from '../data/surfaces.js';
import { $, h, openModal, closeAllModals, toast } from './dom.js';
import { progress, settings, saveHealthy } from '../systems/core.js';

let app = null, game = null;
export function initSurface(a) { app = a; }
export const surfaceRunning = () => !!game;

const G = 9.81;
function siteRec(id) { return progress.surface?.sites?.[id]; }

export function openSitePicker() {
  const B = SURFACE_BODIES.moon, body = h('div', { class: 'sx-picker' });
  const head = h('div', { class: 'sx-bodyhead' });
  const pv = app.previews?.moon;
  if (pv) { const c = h('canvas', { width: 48, height: 48, 'aria-hidden': 'true' }); c.getContext('2d').drawImage(pv, 0, 0, 48, 48); head.append(c); }
  head.append(h('div', {}, h('b', {}, B.name), h('small', { class: 'muted' }, ` · gravity ${B.g} m/s² (${(B.g / G * 100).toFixed(0)}% of Earth) · ${B.atm.label}`)));
  body.append(h('p', { class: 'muted tiny' }, 'Walk, hop and drive on the Moon in real lunar gravity. Sky, Sun angle and landmark sizes use real mission data.'), head);
  for (const s of sitesFor('moon')) {
    const r = siteRec(s.id), done = r?.obj?.length || 0, total = s.objectives.length;
    body.append(h('div', { class: `sx-site ${r?.complete ? 'complete' : ''}` },
      h('div', { class: 'sx-site-main' }, h('b', {}, s.name), h('small', { class: 'muted' }, s.subtitle), h('p', { class: 'tiny' }, s.blurb),
        h('div', { class: 'chips' }, h('span', { class: `chip ${r?.complete ? 'good' : ''}` }, r?.complete ? '✓ Expedition complete' : `${done}/${total} objectives`), s.rover ? h('span', { class: 'chip violet' }, '🚙 Rover') : null, B.dose > 0.01 ? h('span', { class: 'chip warn' }, '☢️ Radiation') : null)),
      h('button', { class: 'btn primary', onclick: () => startSurface(s.id) }, '🧑‍🚀 Land')));
  }
  openModal({ title: '🌕 Lunar Mission', wide: true, label: 'Lunar Mission', body });
}

// While the surface is being built, `landing` is set; Esc cancels it and nothing else can touch the half-built game.
let landing = null;
export async function startSurface(siteId) {
  if (game || landing) return;
  const test = document.createElement('canvas');
  if (!(test.getContext('webgl2') || test.getContext('webgl'))) { openModal({ title: '3D unavailable', body: '<p>Surface expeditions need WebGL.</p>' }); return; }
  closeAllModals();
  const screen = $('#screen-surface'); screen.innerHTML = '';
  const site = SITES.find(s => s.id === siteId);
  const me = landing = { cancelled: false };
  const loading = h('div', { class: 'sx-loading' }, h('div', { class: 'logo-orbit' }, h('span', { class: 'logo-planet' })), h('p', {}, `Descending to ${site.name}…`), h('small', { class: 'muted' }, 'Building terrain from survey data'),
    h('button', { class: 'btn sm ghost', style: 'margin-top:12px', onclick: () => cancelLanding() }, 'Cancel landing (Esc)'));
  screen.append(loading);
  app.show('surface');
  let g = null;
  try {
    const { SurfaceGame } = await import('../surface/surfaceGame.js');
    if (me.cancelled) throw new Error('cancelled');
    g = new SurfaceGame(app, siteId, onExit); me.game = g;
    await g.build(screen);
    if (me.cancelled || g.disposed) throw new Error('cancelled');
    g.buildHUD(screen); g.bindInput();
    loading.remove(); landing = null;
    game = app.surface = g; g.start();
  } catch (e) {
    landing = null;
    try { g?.dispose(); } catch {}
    game = app.surface = null; screen.innerHTML = '';
    if (me.cancelled) toast({ icon: '↩', title: 'Landing cancelled', text: `You stayed in orbit above ${site.name}.`, ms: 2200 });
    else { console.error(e); toast({ icon: '⚠️', title: 'Landing aborted', text: 'The surface could not be built on this device.' }); }
    backToPrevious();
  }
}
function cancelLanding() { if (!landing) return; landing.cancelled = true; try { landing.game?.dispose(); } catch {} }
// Back to the main menu (the only place a Lunar Mission is launched from)
function backToPrevious() { app.toMenu(); }
function onExit(site) {
  game = app.surface = null; $('#screen-surface').innerHTML = '';
  app.toMenu();
  toast({ icon: '🚀', title: 'Lifted off', text: `You left ${site.name}.`, ms: 2200 });
}
export function surfaceEsc() {
  if (landing) { cancelLanding(); return true; } // still building: Esc cancels the landing instead of pausing
  if (!game || !game.running) return false;
  const saved = saveHealthy() ? 'Objectives and samples are saved as you go.' : '⚠️ Progress can\'t be saved right now: this browser is blocking or out of storage.';
  const m = openModal({ title: '❚❚ Expedition paused', body: `<p>${game.site.name}, ${game.body.name}. ${saved}</p>`, foot: [
    h('button', { class: 'btn', onclick: () => { m.close(); game?.help(); } }, '❔ Controls'),
    h('button', { class: 'btn', onclick: () => { m.close(); game?.exit(); } }, '⏏ Lift off'),
    h('button', { class: 'btn primary', onclick: () => m.close() }, '▶ Resume')] });
  return true;
}
