// ASTRO LAB Career — the `career` section of the shared save (astrolab.save.v1).
// XP and badges are shared with the Lunar Mission.
import { progress, save, log } from '../../systems/core.js';

export const CAREER_VERSION = 1;
export const freshCareer = () => ({
  v: CAREER_VERSION, started: false, startedAt: null, chapter: 'home', scene: null, pos: null, yaw: 0, pitch: 0,
  player: { name: '', idNo: '', look: null }, flags: {}, inventory: { slots: 12, items: [], stored: [] },
  training: {}, certs: {}, quizzes: {}, scenes: {}, greenhouse: null, spacecraft: {}, launch: { done: false }, flight: { done: false }
});

// Older saves have no career section, or an older one: fill in anything missing without touching the rest.
export function career() {
  const base = freshCareer();
  if (!progress.career || typeof progress.career !== 'object') progress.career = base;
  const c = progress.career;
  for (const k of Object.keys(base)) if (c[k] === undefined) c[k] = base[k];
  c.v = CAREER_VERSION;
  return c;
}
export const careerStarted = () => !!progress.career?.started;

export function newCareer() {
  progress.career = freshCareer();
  const c = progress.career; c.started = true; c.startedAt = Date.now();
  log('Started a new astronaut career.', '🧑‍🚀'); save();
  return c;
}
export function sceneState(id, init = {}) {
  const c = career();
  if (!c.scenes[id]) c.scenes[id] = JSON.parse(JSON.stringify(init));
  return c.scenes[id];
}
export function recordTraining(id, { score, mistakes = [], passed = true }) {
  const c = career();
  const t = c.training[id] || (c.training[id] = { done: false, best: 0, tries: 0, mistakes: [] });
  t.tries++; t.best = Math.max(t.best, score); t.mistakes = mistakes; if (passed) t.done = true; t.last = Date.now();
  save();
  return t;
}

// Player level: a gentle curve on top of the shared XP (level 2 at 100 XP, 5 at 1,600, 10 at 8,100).
export function playerLevel(xp = progress.xp) { return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1; }
export function levelRange(lv) { return [(lv - 1) ** 2 * 100, lv ** 2 * 100]; }

// Skill certifications (blueprint section 9): earned in training, checked by the mission tasks that use the skill.
export const CERT_NAMES = { power: 'Power Systems L1', lifesupport: 'Life Support L1' };
export function awardCert(id, { distinction = false } = {}) {
  const c = career(); const had = c.certs[id];
  c.certs[id] = { level: 1, distinction: distinction || !!had?.distinction, at: Date.now() };
  if (!had) log(`Certified: ${CERT_NAMES[id] || id}.`, '🎖️');
  save(); return c.certs[id];
}
export const hasCert = id => !!career().certs?.[id];
