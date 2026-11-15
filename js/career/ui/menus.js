// ASTRO LAB Career — main-menu dialogs: New Game, Resume, Training Modules, Achievements, Credits, Quit, controls guide.
import { h, openModal, closeAllModals } from '../../ui/dom.js';
import { settings, saveSettings, progress } from '../../systems/core.js';
import { BADGES, LUNAR_BADGES } from '../../data/missions.js';
import { MOON_CREDITS } from '../../data/moonCredits.js';
import { career, careerStarted, newCareer, playerLevel, levelRange } from '../state/careerSave.js';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../state/difficulty.js';
import { CAREER_BADGES } from '../data/badges.js';
import { MODULES, moduleState } from '../data/modules.js';

let app = null, start = null;
export function initCareerMenus(a, startScene) { app = a; start = startScene; }

// ---------- New Game ----------
export function openNewGame() {
  if (careerStarted()) {
    const m = openModal({ title: 'Start a new career?', body: h('div', {}, h('p', {}, 'You already have a career in progress. Starting over resets your story and training progress.'), h('p', { class: 'muted tiny' }, 'Your XP, badges and Lunar Mission progress are kept.')),
      foot: [h('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: () => { m.close(); pickDifficulty(); } }, 'Start over')] });
  } else pickDifficulty();
}
function pickDifficulty() {
  let choice = settings.difficulty || 'normal';
  const cards = h('div', { class: 'cx-diffs', role: 'radiogroup', 'aria-label': 'Difficulty' });
  const render = () => { cards.innerHTML = ''; for (const id of DIFFICULTY_ORDER) { const d = DIFFICULTIES[id]; cards.append(h('button', { class: 'cx-diff', role: 'radio', 'aria-checked': String(choice === id), onclick: () => { choice = id; render(); } }, h('b', {}, d.name), h('small', {}, d.blurb))); } };
  render();
  const m = openModal({ title: '▶ New Game', label: 'New game', body: h('div', {},
    h('p', {}, 'You are about to become an astronaut candidate in the Junior Astronaut Training Programme.'),
    h('h3', {}, 'Choose a difficulty'), cards,
    h('p', { class: 'muted tiny' }, 'You can change difficulty at any time in Settings. New to 3D games? Try Controls Practice in Training Modules first.')),
    foot: [h('button', { class: 'btn', onclick: () => m.close() }, 'Back'), h('button', { class: 'btn primary', onclick: () => { settings.difficulty = choice; saveSettings(); newCareer(); m.close(); start('home', { mode: 'story' }); } }, 'Begin ▶')] });
}

// ---------- Resume ----------
export function resumeGame() {
  const c = career();
  if (c.scene && c.scene !== 'tutorial') { start(c.scene, { mode: 'story', resume: true }); return; }
  if (c.chapter === 'home' || c.chapter === 'tutorial') { start('home', { mode: 'story' }); return; }
  // every later chapter returns to the training centre hub, where the dashboard shows what is next
  start('centre', { mode: 'story' });
}

// ---------- Training Modules ----------
export { MODULES };
export function openTrainingModules() {
  const c = career();
  const list = h('div', { class: 'cx-modules' }, MODULES.map(md => {
    const t = c.training[md.id], st = moduleState(md.id);
    const playable = md.scene && !md.storyOnly && (md.practiceOnly || st === 'done');
    const note = md.practiceOnly ? (t ? `✓ Completed · best ${t.best}/100` : 'Practice any time.') : st === 'done' ? `✓ Completed · best ${t?.best ?? 100}/100` : st === 'soon' ? 'Coming in a later build.' : md.storyOnly ? 'Part of the story.' : 'Complete it in the story first, then replay it here.';
    return h('div', { class: `cx-module ${playable ? '' : 'locked'}` },
      h('span', { class: 'cx-mi' }, playable || st === 'done' ? md.icon : '🔒'),
      h('div', {}, h('b', {}, md.name), h('small', {}, md.desc), h('small', { class: st === 'done' || (md.practiceOnly && t) ? 'good' : 'muted' }, note)),
      playable ? h('button', { class: 'btn sm primary', onclick: () => { closeAllModals(); start(md.scene, { mode: 'practice' }); } }, t ? 'Replay' : 'Play') : null);
  }));
  openModal({ title: '🎓 Training Modules', wide: true, label: 'Training modules', body: h('div', {}, h('p', { class: 'muted tiny' }, 'Modules unlock as you progress through the story. Replays are practice runs: they never change your story progress.'), list) });
}

// ---------- Achievements ----------
export function openAchievements() {
  const lv = playerLevel(), [a, b] = levelRange(lv), pct = Math.round((progress.xp - a) / (b - a) * 100);
  const grid = list => h('div', { class: 'badge-grid' }, list.map(bd => h('div', { class: `badge ${progress.badges.includes(bd.id) ? '' : 'locked'}`, title: bd.desc }, h('span', { class: 'bi' }, bd.icon), h('b', {}, bd.name), h('small', {}, bd.desc))));
  const got = CAREER_BADGES.filter(bd => progress.badges.includes(bd.id)).length;
  openModal({ title: '🏆 Achievements', wide: true, label: 'Achievements', body: h('div', {},
    h('div', { class: 'stats' }, h('div', { class: 'stat' }, h('b', {}, `Level ${lv}`), h('small', {}, `${progress.xp} XP · ${b - progress.xp} XP to level ${lv + 1}`)),
      h('div', { class: 'stat' }, h('b', {}, `${got}/${CAREER_BADGES.length}`), h('small', {}, 'Astronaut training badges')),
      h('div', { class: 'stat' }, h('b', {}, `${progress.badges.length}/${BADGES.length}`), h('small', {}, 'All badges'))),
    h('div', { class: 'xpbar big', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('i', { style: `width:${pct}%` })),
    h('h3', {}, 'Astronaut training'), grid(CAREER_BADGES),
    h('h3', {}, 'Lunar Mission'), grid(LUNAR_BADGES))
  });
}

// ---------- Credits ----------
export function openCredits() {
  openModal({ title: '✦ Credits', label: 'Credits', body: h('div', { class: 'cx-credits' },
    h('h1', { class: 'logo small' }, 'ASTRO', h('span', {}, 'LAB')),
    h('p', {}, 'An astronomy and astronaut-training game.'),
    h('h3', {}, 'Game'), h('p', {}, 'Game concept and specification: the ASTRO LAB team. Design, code, models and sound built with Claude (Anthropic).'),
    h('h3', {}, 'Characters'), h('p', {}, 'Bug and Cat, your parents. Instructor Okafor, Training Bay 1. Director D. Reyes, Junior Astronaut Training Program.'),
    h('h3', {}, 'Technology'), h('p', {}, 'Three.js r169 (MIT licence). Music, sound effects and the remaining 3D models and textures are generated in code.'),
    h('h3', {}, 'Science sources'), h('p', {}, 'NASA (Human Research Program, Johnson Space Center astronaut training, planetary fact sheets), ESA, JAXA and peer-reviewed mission results.'),
    h('h3', {}, 'Moon map'), ...MOON_CREDITS.map(c => h('p', { class: 'tiny' }, `${c.name}: ${c.source}. ${c.licence}${c.note ? ' · ' + c.note : ''}.`)),
    h('h3', {}, 'Imported 3D models'), h('p', { class: 'tiny' }, 'People, the family car, helicopter, training-centre building, greenhouse, tent, alarm clock, notice board and crops come from the owner\'s downloaded model collection (see models/CREDITS.md). Their authors\' licences come with the downloads.'),
    h('p', { class: 'muted tiny' }, 'ASTRO LAB is a fan-made educational game. It is not affiliated with or endorsed by NASA. "NASA-style" insignia in the game are original designs.')) });
}

// ---------- Quit ----------
export function quitGame() {
  const m = openModal({ title: '⏻ Quit', body: h('div', {}, h('p', {}, 'Your progress is saved on this device.'), h('p', { class: 'muted tiny' }, 'A web page can\'t close its own tab, so after quitting just close the tab or window.')),
    foot: [h('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: () => { m.close(); app.show('quit'); } }, 'Save & quit')] });
}

// ---------- Controls guide (career) ----------
export const CAREER_KEYS = {
  desktop: [['W A S D / arrows', 'Walk'], ['Mouse (click the view first)', 'Look around'], ['Shift (hold)', 'Jog'], ['C or Ctrl (hold)', 'Crouch'], ['E or Enter', 'Use, pick up, place, talk'], ['R / Q', 'Rotate a held item'], ['G', 'Put a held item down'], ['1 – 4', 'Choose a dialogue answer'], ['Space / E', 'Next line of dialogue'], ['H', 'This controls guide'], ['Esc', 'Pause menu']],
  touch: [['Joystick (bottom-left)', 'Walk'], ['Drag on the view', 'Look around'], ['Tap an object', 'Use it'], ['✋ Use', 'Use what is under the dot'], ['⤵ Crouch', 'Crouch on / off'], ['⟳ Rotate', 'Rotate a held item'], ['⤓ Drop', 'Put a held item down'], ['» Jog', 'Hold to jog'], ['❚❚', 'Pause menu']],
  special: [['Floating (low-g, pool, EVA)', 'Look at a handrail and press E to grab it. Hold W (or push the joystick forward) to push off where you look; Shift pushes harder. With nothing in view, E reels in your tether'], ['Pool', '⚖ button: trim your weight pockets'], ['Spacecraft and launch', 'Point at a switch or button and press E (or tap it)'], ['Orbit burn', 'Hold the 🔥 button at the top of the orbit'], ['Orbit roll', 'Hold Q / E (or ← / →, or the on-screen buttons) to fire thrusters against the roll']],
  pad: [['Left stick', 'Walk'], ['Right stick', 'Look around'], ['Ⓐ (bottom)', 'Use / next line'], ['Ⓧ (left)', 'Rotate a held item'], ['Ⓨ (top)', 'Put item down'], ['L3 / R3', 'Crouch / jog'], ['D-pad', 'Choose a dialogue answer'], ['Start', 'Pause'], ['Back / Select', 'Controls guide']]
};
export function openCareerControls() {
  const table = rows => h('table', { class: 'keys' }, h('tbody', {}, rows.map(([k, v]) => h('tr', {}, h('td', {}, h('kbd', {}, k)), h('td', {}, v)))));
  openModal({ title: '❔ Controls', wide: true, label: 'Controls guide', body: h('div', {},
    h('div', { class: 'help-grid three' },
      h('div', {}, h('h2', {}, '🖱️ Keyboard & mouse'), table(CAREER_KEYS.desktop)),
      h('div', {}, h('h2', {}, '👆 Touch'), table(CAREER_KEYS.touch)),
      h('div', {}, h('h2', {}, '🎮 Gamepad'), table(CAREER_KEYS.pad))),
    h('h2', {}, '🛰 Special training controls'), table(CAREER_KEYS.special),
    h('h2', {}, '🎯 How to play'),
    h('ol', {}, h('li', {}, 'Your current objective is in the panel at the top-left. A yellow marker floats over the target.'),
      h('li', {}, 'Point the centre dot at something. When a prompt appears, press E (or tap ✋) to use it.'),
      h('li', {}, 'After each exercise you get a score, your mistakes, the science behind it and your rewards.'),
      h('li', {}, 'Progress saves automatically. Esc opens the pause menu.')),
    h('p', { class: 'muted tiny' }, 'Camera sensitivity, invert Y, text speed, subtitles and the control scheme are in Settings.')) });
}
