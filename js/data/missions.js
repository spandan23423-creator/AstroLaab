// ASTRO LAB — badges and ranks (Lunar Mission expeditions and astronaut training)
import { CAREER_BADGES } from '../career/data/badges.js';

// ---------- Badges ----------
// The three Moon expedition badges are awarded when every objective at that landing site is done (surface/surfaceGame.js).
export const LUNAR_BADGES = [
  { id: 'moonwalker', name: 'Moonwalker', icon: '👣', desc: 'Completed the Tranquility Base expedition.' },
  { id: 'lunar-driver', name: 'Lunar Driver', icon: '🚙', desc: 'Completed the Hadley–Apennine rover expedition.' },
  { id: 'ice-hunter', name: 'Ice Hunter', icon: '🧊', desc: 'Found water ice at the lunar south pole.' },
  { id: 'lunar-explorer', name: 'Lunar Explorer', icon: '🌕', desc: 'Completed all three Moon expeditions.', check: p => ['tranquility', 'hadley', 'shackleton'].every(id => p.surface?.sites?.[id]?.complete) }
];
export const BADGES = [...LUNAR_BADGES, ...CAREER_BADGES];
export const BADGE_MAP = Object.fromEntries(BADGES.map(b => [b.id, b]));

// ---------- Ranks ----------
export const RANKS = [
  { xp: 0, name: 'Cadet' }, { xp: 300, name: 'Ensign' }, { xp: 800, name: 'Lieutenant' }, { xp: 1500, name: 'Lt. Commander' },
  { xp: 2500, name: 'Commander' }, { xp: 4000, name: 'Captain' }, { xp: 6000, name: 'Commodore' }, { xp: 9000, name: 'Admiral' }
];
export function rankFor(xp) {
  let i = 0; while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++;
  const cur = RANKS[i], next = RANKS[i + 1];
  return { level: i + 1, name: cur.name, floor: cur.xp, next: next ? next.xp : null, pct: next ? (xp - cur.xp) / (next.xp - cur.xp) : 1 };
}
