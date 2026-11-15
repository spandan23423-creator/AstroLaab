// ASTRO LAB Career — the programme emblem (original design), the name screen and the acceptance letter.
import { h, openModal } from '../../ui/dom.js';
import { career } from '../state/careerSave.js';
import { sfx } from '../engine/audio.js';

// Original "agency-style" emblem: blue disc, stars, an orbit swoosh and a rocket. Not a real agency logo.
export function emblemSVG(size = 96) {
  const stars = [[30, 28], [70, 24], [22, 62], [78, 66], [44, 18], [62, 78]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#fff"/>`).join('');
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="Junior Astronaut Training Program emblem">
    <defs><path id="ring" d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0"/></defs>
    <circle cx="50" cy="50" r="48" fill="#0d2f6e" stroke="#c9d6ff" stroke-width="2"/>
    <circle cx="50" cy="50" r="31" fill="#123f8f"/>${stars}
    <ellipse cx="50" cy="52" rx="34" ry="11" fill="none" stroke="#e8423a" stroke-width="4" transform="rotate(-22 50 52)"/>
    <path d="M50 26 C56 34 57 44 55 56 L45 56 C43 44 44 34 50 26 Z" fill="#f4f6ff"/><path d="M45 56 L40 63 L45 61 Z M55 56 L60 63 L55 61 Z" fill="#f4f6ff"/><path d="M47 58 L50 68 L53 58 Z" fill="#ffb347"/>
    <text font-family="system-ui, sans-serif" font-size="7.2" font-weight="700" fill="#fff" letter-spacing="1"><textPath href="#ring" startOffset="2%">JUNIOR ASTRONAUT · TRAINING PROGRAM ·</textPath></text>
  </svg>`;
}
// The same emblem drawn on a canvas (used for the envelope stamp and signs)
export function drawEmblem(c, cx, cy, r, { ink = null } = {}) {
  const k = r / 48; c.save(); c.translate(cx, cy); c.scale(k, k); c.translate(-50, -50);
  c.fillStyle = ink || '#0d2f6e'; c.beginPath(); c.arc(50, 50, 48, 0, 7); c.fill();
  c.strokeStyle = ink ? 'rgba(255,255,255,.35)' : '#c9d6ff'; c.lineWidth = 2; c.stroke();
  c.fillStyle = ink ? 'rgba(255,255,255,.12)' : '#123f8f'; c.beginPath(); c.arc(50, 50, 31, 0, 7); c.fill();
  c.fillStyle = '#fff'; for (const [x, y] of [[30, 28], [70, 24], [22, 62], [78, 66], [44, 18], [62, 78]]) { c.beginPath(); c.arc(x, y, 1.6, 0, 7); c.fill(); }
  c.save(); c.translate(50, 52); c.rotate(-22 * Math.PI / 180); c.strokeStyle = ink ? '#fff' : '#e8423a'; c.lineWidth = 4; c.beginPath(); c.ellipse(0, 0, 34, 11, 0, 0, 7); c.stroke(); c.restore();
  c.fillStyle = '#f4f6ff'; c.beginPath(); c.moveTo(50, 26); c.bezierCurveTo(56, 34, 57, 44, 55, 56); c.lineTo(45, 56); c.bezierCurveTo(43, 44, 44, 34, 50, 26); c.fill();
  c.font = 'bold 7px system-ui, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#fff';
  const txt = 'JUNIOR ASTRONAUT · TRAINING PROGRAM ·'; const step = (Math.PI * 2) / (txt.length + 2);
  for (let i = 0; i < txt.length; i++) { const a = -Math.PI * 0.95 + i * step; c.save(); c.translate(50 + Math.cos(a) * 40, 50 + Math.sin(a) * 40); c.rotate(a + Math.PI / 2); c.fillText(txt[i], 0, 2.5); c.restore(); }
  c.restore();
}

// ---------- Name screen ----------
export const NAME_RE = /^[A-Za-z0-9]{1,9}$/;
export function validateName(raw) {
  const v = String(raw ?? '').trim();
  if (!v) return { ok: false, msg: 'Please enter a name.' };
  if (v.length > 9) return { ok: false, msg: `That's ${v.length} characters. Names can be up to 9.` };
  if (!/^[A-Za-z0-9]+$/.test(v)) return { ok: false, msg: 'Use letters and numbers only (no spaces or symbols).' };
  return { ok: true, value: v };
}
export function askName() {
  return new Promise(resolve => {
    const input = h('input', { type: 'text', class: 'cx-name-in', maxlength: 12, autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false', 'aria-label': 'Your name', 'aria-describedby': 'cx-name-msg', placeholder: 'e.g. Nova7', value: career().player.name || '' });
    const msg = h('p', { id: 'cx-name-msg', class: 'cx-name-msg', 'aria-live': 'polite' }, 'Up to 9 letters or numbers.');
    const count = h('span', { class: 'cx-name-count' }, '0/9');
    const ok = h('button', { class: 'btn primary', disabled: true }, 'That\'s me ▸');
    const check = () => { const r = validateName(input.value); count.textContent = `${input.value.trim().length}/9`; count.classList.toggle('bad', input.value.trim().length > 9); ok.disabled = !r.ok; msg.textContent = input.value ? (r.ok ? `Nice to meet you, ${r.value}.` : r.msg) : 'Up to 9 letters or numbers.'; msg.classList.toggle('bad', !!input.value && !r.ok); return r; };
    input.addEventListener('input', check);
    input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') submit(); });
    const submit = () => { const r = check(); if (!r.ok) { sfx.wrong(); input.focus(); msg.textContent = r.msg; msg.classList.add('bad'); return; } sfx.good(); m.close(); resolve(r.value); };
    ok.addEventListener('click', submit);
    const m = openModal({ title: 'Who are you?', label: 'Choose your name', closable: false, cls: 'cx-name-modal', body: h('div', {},
      h('p', {}, 'You open your eyes. Morning light is coming through the curtains. Before anything else: what\'s your name?'),
      h('label', { class: 'cx-name-row' }, input, count), msg), foot: [ok] });
    setTimeout(() => { input.focus(); check(); }, 60);
  });
}

// ---------- Acceptance letter ----------
export function letterDate() { try { return new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return ''; } }
export function openLetter({ first = false, onDone } = {}) {
  const name = career().player.name || 'Cadet';
  sfx.paper();
  const paper = h('article', { class: 'cx-letter', 'aria-label': 'Acceptance letter' },
    h('header', { html: emblemSVG(78) + '<div><b>Junior Astronaut Training Program</b><small>NASA-style training programme · Astronaut Training Centre</small></div>' }),
    h('p', { class: 'cx-ldate' }, letterDate()),
    h('p', {}, `Dear ${name},`),
    h('p', {}, 'Congratulations! We are delighted to tell you that you have been selected for the ', h('b', {}, 'NASA Junior Astronaut Training Program'), '.'),
    h('p', {}, 'Out of many applicants, you stood out for your curiosity, your persistence and your love of science. Over the coming weeks you will train like a real astronaut candidate: spacesuits, life support, growing food in space, medicine, spacewalk practice and, if you complete it all, a launch.'),
    h('p', {}, 'Please report to the Astronaut Training Centre this morning. Bring this letter. Your instructors will meet you at registration.'),
    h('p', {}, 'Welcome to the team. The sky is not the limit.'),
    h('p', { class: 'cx-lsig' }, h('span', { class: 'cx-sigline' }, 'D. Reyes'), h('small', {}, 'Director, Junior Astronaut Training Program')),
    h('p', { class: 'cx-lnote' }, 'ASTRO LAB is a fan-made educational game; this letter and its emblem are fictional.'));
  const m = openModal({ title: first ? '✉ You open the envelope…' : '✉ Acceptance letter', label: 'Acceptance letter', wide: true, cls: 'cx-letter-modal', closable: !first, body: paper,
    foot: [h('button', { class: 'btn primary', onclick: () => { m.close(); onDone?.(); } }, first ? 'Finished reading ▸' : 'Fold the letter')] });
  return m;
}
