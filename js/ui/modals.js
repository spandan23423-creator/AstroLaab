// ASTRO LAB — Settings dialog (shared by the main menu, Career Mode and the Lunar Mission)
import { h, openModal, toast } from './dom.js';
import { settings, saveSettings, resetProgress } from '../systems/core.js';

let app = null;
export function initModals(a) { app = a; }

// ---------------- Settings ----------------
export function openSettings() {
  const seg = (key, opts, onChange) => h('div', { class: 'seg', role: 'group' }, opts.map(([v, l]) => h('button', { 'aria-pressed': String(settings[key] === v), onclick: e => { settings[key] = v; saveSettings(); [...e.currentTarget.parentNode.children].forEach(c => c.setAttribute('aria-pressed', String(c === e.currentTarget))); onChange && onChange(v); } }, l)));
  const toggle = (key, label, onChange) => h('div', { class: 'srow' }, h('span', {}, label), seg(key, [[true, 'On'], [false, 'Off']], onChange));
  const row = (label, ctrl, note) => h('div', { class: 'srow' }, h('span', {}, label, note ? h('small', { class: 'muted block' }, note) : null), ctrl);
  const slider = (key, min, max, step, fmt) => {
    const out = h('output', {}, fmt(settings[key]));
    const inp = h('input', { type: 'range', min, max, step, value: settings[key], 'aria-label': key, oninput: e => { settings[key] = +e.target.value; out.textContent = fmt(settings[key]); saveSettings(); } });
    return h('div', { class: 'srange' }, inp, out);
  };
  const pct = v => `${Math.round(v * 100)}%`;
  const sec = (t) => h('h3', { class: 'ssec' }, t);
  openModal({ title: '⚙ Settings', label: 'Settings', wide: true, body: h('div', { class: 'settings-list two' },
    h('div', {},
      sec('Gameplay'),
      row('Difficulty', seg('difficulty', [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard'], ['realistic', 'Realistic']]), 'Affects supplies, time limits, quizzes, tolerances, faults, greenhouse stability and scoring.'),
      row('Text speed', seg('textSpeed', [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast'], ['instant', 'Instant']])),
      toggle('subtitles', 'Subtitles (sound captions)'),
      row('Language', seg('language', [['en', 'English']]), 'More languages may be added later.'),
      sec('Graphics'),
      row('Graphics quality', seg('quality', [['auto', 'Auto'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra']])),
      toggle('reducedMotion', 'Reduce motion', v => document.body.classList.toggle('reduced-motion', v)),
      h('p', { class: 'muted tiny' }, 'Low turns off shadows and lowers resolution. Ultra uses full resolution and sharper shadows.')),
    h('div', {},
      sec('Audio'),
      toggle('sound', 'Sound'),
      row('Music volume', slider('musicVol', 0, 1, 0.05, pct)),
      row('Sound effects volume', slider('sfxVol', 0, 1, 0.05, pct)),
      sec('Controls'),
      row('Control scheme', seg('controls', [['auto', 'Auto'], ['kbm', 'Keyboard & mouse'], ['gamepad', 'Gamepad'], ['touch', 'Touch']], () => app.applyJoystick()), 'Auto switches to whatever you touch last.'),
      row('Camera sensitivity', slider('sensitivity', 0.3, 2.5, 0.05, v => `${v.toFixed(2)}×`)),
      toggle('invertY', 'Invert Y-axis'),
      row('On-screen joystick', seg('joystick', [['auto', 'Auto'], ['on', 'On'], ['off', 'Off']], () => app.applyJoystick())),
      sec('Accessibility'),
      toggle('colorblind', 'Colourblind-friendly colours', v => document.body.classList.toggle('cb', v)),
      row('Text size', seg('textScale', [[0.9, 'Small'], [1, 'Normal'], [1.15, 'Large'], [1.3, 'X-Large']], v => document.documentElement.style.setProperty('--ts', v))),
      row('Reset all progress', h('button', { class: 'btn sm', onclick: () => confirmReset() }, 'Reset…')))) });
}
function confirmReset() {
  const m = openModal({ title: 'Reset progress?', body: '<p>This permanently erases your career, XP, badges and Lunar Mission progress on this device.</p>',
    foot: [h('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: () => { resetProgress(); m.close(); toast({ icon: '🗑️', title: 'Progress reset' }); app.toMenu(); } }, 'Erase progress')] });
}
