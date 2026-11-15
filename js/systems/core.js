// ASTRO LAB — event bus, persistence and progression (XP, ranks, badges)
import { BADGES, BADGE_MAP, rankFor } from '../data/missions.js';

// ---------------- Event bus ----------------
const listeners = new Map();
export const bus = {
  on(evt, fn) { if (!listeners.has(evt)) listeners.set(evt, new Set()); listeners.get(evt).add(fn); return () => listeners.get(evt).delete(fn); },
  emit(evt, data) {
    const set = listeners.get(evt);
    if (set) for (const fn of [...set]) { try { fn(data); } catch (e) { console.error('[bus]', evt, e); } }
    const any = listeners.get('*');
    if (any) for (const fn of [...any]) { try { fn(evt, data); } catch (e) { console.error('[bus*]', e); } }
  }
};

// ---------------- Safe storage ----------------
const SAVE_KEY = 'astrolab.save.v1';
const SETTINGS_KEY = 'astrolab.settings.v1';
function readJSON(key) {
  let s = null;
  try { s = localStorage.getItem(key); return s ? JSON.parse(s) : null; }
  catch { if (s) { try { localStorage.setItem(key + '.corrupt', s); } catch {} } return null; } // keep a copy of an unreadable save
}
// Storage health: a failed write (quota full, private browsing, storage blocked) is reported once, not swallowed.
let saveError = null;
export const saveHealthy = () => !saveError;
function writeJSON(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); if (saveError) { saveError = null; bus.emit('save:ok'); } return true; }
  catch (e) {
    const first = !saveError; saveError = e;
    console.warn('[save] write failed', e);
    if (first) bus.emit('toast', { icon: '⚠️', title: 'Progress not saved', text: /quota/i.test(`${e?.name} ${e?.message}`) ? 'Browser storage is full. Free some space or progress made now will be lost when you close the page.' : 'This browser is blocking storage (private mode or site-data settings). Progress will be lost when you close the page.', ms: 8000 });
    return false;
  }
}

export const defaultSettings = () => ({ quality: 'auto', sound: true, reducedMotion: matchMedia?.('(prefers-reduced-motion: reduce)').matches || false, textScale: 1, joystick: 'auto',
  difficulty: 'normal', musicVol: 0.5, sfxVol: 0.8, textSpeed: 'normal', sensitivity: 1, invertY: false, subtitles: true, colorblind: false, language: 'en', controls: 'auto' });
export const settings = Object.assign(defaultSettings(), readJSON(SETTINGS_KEY) || {});
export function saveSettings() { writeJSON(SETTINGS_KEY, settings); bus.emit('settings', settings); }

const freshProgress = () => ({
  version: 1, created: Date.now(), xp: 0, badges: [], log: [], stats: {}, surface: { sites: {}, jumps: {} }, career: null
});

export const progress = freshProgress();
export function hasSave() { return !!readJSON(SAVE_KEY); }
// Keep only fields whose type matches the fresh save, so a damaged or hand-edited save can't break the game later.
const STRING_LISTS = ['badges'];
export function sanitizeSave(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return null;
  const d = freshProgress(), out = {}, isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  for (const [k, v] of Object.entries(s)) {
    const dv = d[k];
    if (!(k in d)) out[k] = v; // fields from newer versions are kept as they are
    else if (Array.isArray(dv)) { if (Array.isArray(v)) out[k] = STRING_LISTS.includes(k) ? v.filter(x => typeof x === 'string') : k === 'log' ? v.filter(x => isObj(x) && typeof x.text === 'string') : v; }
    else if (k === 'career') out[k] = isObj(v) ? v : null;
    else if (isObj(dv)) { if (isObj(v)) out[k] = v; }
    else if (typeof v === typeof dv && (typeof v !== 'number' || Number.isFinite(v))) out[k] = v;
  }
  const st = isObj(out.stats) ? out.stats : {}; out.stats = { ...d.stats };
  for (const k of Object.keys(d.stats)) if (Number.isFinite(st[k])) out.stats[k] = st[k];
  return out;
}
export function loadSave() {
  const raw = readJSON(SAVE_KEY), s = sanitizeSave(raw);
  if (raw && !s) console.warn('[save] invalid save ignored');
  if (s) Object.assign(progress, freshProgress(), s);
  return !!s;
}
export function resetProgress() { try { localStorage.removeItem(SAVE_KEY); } catch {} Object.keys(progress).forEach(k => delete progress[k]); Object.assign(progress, freshProgress()); bus.emit('progress'); }
let saveTimer = null;
export function save() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { saveTimer = null; writeJSON(SAVE_KEY, progress); }, 150); }
export function saveNow() { clearTimeout(saveTimer); saveTimer = null; return writeJSON(SAVE_KEY, progress); }
// Flush a pending (debounced) save before the page can go away: tab close, reload, app switch, mobile background.
const flush = () => { if (saveTimer) saveNow(); };
addEventListener('pagehide', flush); addEventListener('beforeunload', flush);
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

export function log(text, icon = '📡') {
  progress.log.unshift({ t: Date.now(), text, icon });
  if (progress.log.length > 200) progress.log.length = 200;
  save();
}

// ---------------- Rewards ----------------
export function addXP(n, reason) {
  const before = rankFor(progress.xp);
  progress.xp += n;
  const after = rankFor(progress.xp);
  bus.emit('toast', { icon: '✨', title: `+${n} XP`, text: reason || '' });
  if (after.level > before.level) {
    log(`Promoted to ${after.name}!`, '⭐');
    bus.emit('toast', { icon: '⭐', title: 'Promotion!', text: `You are now ${after.name}.`, big: true });
    bus.emit('sfx', 'levelup');
  }
  bus.emit('progress'); save();
}
export function awardBadge(id) {
  if (!id || progress.badges.includes(id) || !BADGE_MAP[id]) return false;
  progress.badges.push(id);
  const b = BADGE_MAP[id];
  log(`Badge earned: ${b.name}`, b.icon);
  bus.emit('toast', { icon: b.icon, title: 'Badge earned', text: b.name, big: true });
  bus.emit('sfx', 'badge'); bus.emit('progress'); save();
  return true;
}
export function checkBadges() {
  for (const b of BADGES) if (b.check && !progress.badges.includes(b.id) && b.check(progress)) awardBadge(b.id);
}

// Gameplay events (e.g. 'surface:objective') go out on the bus as 'game:<event>' for anything that wants them.
export function gameEvent(evt, data = {}) { bus.emit('game:' + evt, data); }

export { rankFor };
