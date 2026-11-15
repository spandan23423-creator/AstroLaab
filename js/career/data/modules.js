// ASTRO LAB Career — every training module, in story order, with what unlocks it.
// `scene` is set once the module is built. `after` lists modules that must be done first (story mode).
import { career } from '../state/careerSave.js';

export const MODULES = [
  { id: 'tutorial', icon: '🎮', name: 'Controls Practice', desc: 'Look, walk, crouch, pick up, rotate, place, talk and open doors in the Training Bay.', scene: 'tutorial', practiceOnly: true },
  { id: 'registration', icon: '🪪', name: 'Registration & Astronaut ID', desc: 'Security, check-in, your astronaut ID and badge, the safety rules and the trainee agreement.', scene: 'centre', storyOnly: true },
  { id: 'suit', icon: '🧑‍🚀', name: 'Spacesuit Preparation', desc: 'Inspect and assemble the suit in the right order, swap a damaged part and lock every seal.', scene: 'suit', after: ['registration'], group: 'physical' },
  { id: 'inspection', icon: '🔧', name: 'Equipment Inspection', desc: 'Inspect six pieces of equipment, tag the faults and file a report.', scene: 'inspection', after: ['suit'], group: 'physical' },
  { id: 'mobility', icon: '🏃', name: 'Mobility Course', desc: 'Checkpoints, a crouch tunnel, a narrow beam and a carry, against the clock.', scene: 'mobility', after: ['inspection'], group: 'physical' },
  { id: 'lowg', icon: '🪂', name: 'Reduced-Gravity Handrails', desc: 'Float in a weightless training module: push off, grab handrails and stop without crashing.', scene: 'lowg', after: ['mobility'], group: 'physical' },
  { id: 'pool', icon: '🌊', name: 'Neutral Buoyancy Pool', desc: 'Trim your weights until you neither sink nor float, then repair a panel underwater.', scene: 'pool', after: ['lowg'], group: 'physical' },
  { id: 'emergency', icon: '🚨', name: 'Emergency Response', desc: 'An alarm sounds: mask on, find the right extinguisher, call Mission Control, close the hatch.', scene: 'emergency', after: ['pool'], group: 'physical' },
  { id: 'equipment', icon: '🎒', name: 'Equipment Management', desc: 'Pack a cargo bag from a manifest under a mass limit, and stow it with labels out.', scene: 'equipment', after: ['emergency'], group: 'physical' },
  { id: 'survival', icon: '🏝️', name: 'Survival & Teamwork', desc: 'Your capsule lands off course. Lead the crew: signal, shelter, water and roles.', scene: 'survival', after: ['equipment'], group: 'physical' },
  { id: 'greenhouse', icon: '🌱', name: 'Space Greenhouse & Life Support', desc: 'Mission GREENHOUSE-01: buy parts, build a greenhouse, run its systems and grow two crops.', scene: 'greenhouse', after: ['survival'] },
  { id: 'medical', icon: '🧠', name: 'Health & Neuroscience', desc: 'Eye test, migraine triggers, a safe light-sensitivity sim, a hydration challenge and a lunar medical scenario', scene: 'medical', after: ['survival'] },
  { id: 'spacecraft', icon: '🎛️', name: 'Spacecraft Systems', desc: 'Run power, oxygen, pressure, temperature and comms, and diagnose faults.', scene: 'spacecraft', after: ['greenhouse', 'medical'] },
  { id: 'powerlab', icon: '🔋', name: 'Power & Life Support Lab', desc: 'Wire a habitat power system, replace a blown fuse safely and keep life support alive through a 3-hour shadow. Certifies you on the lunar outpost\'s power kit.', scene: 'powerlab', after: ['spacecraft'] },
  { id: 'moonpower', icon: '🌒', name: 'Mission: Lunar Outpost Power', desc: 'On the Moon\'s south pole: unfold and aim four solar panels, wire the outpost, and keep the crew safe through a crater-rim shadow.', scene: 'moonpower', after: ['powerlab'] },
  { id: 'eva', icon: '🛰️', name: 'EVA / Spacewalk', desc: 'Suit up, depressurise the airlock, move by handrails and repair a station antenna.', scene: 'eva', after: ['spacecraft'] },
  { id: 'launch', icon: '🚀', name: 'Launch & Flight', desc: 'Final checks, countdown, liftoff, ascent and your first orbit.', scene: 'launch', after: ['eva'] }
];
export const MODULE_MAP = Object.fromEntries(MODULES.map(m => [m.id, m]));
// Built so far (scenes are registered here as each phase lands)
export function setModuleScene(id, scene) { if (MODULE_MAP[id]) MODULE_MAP[id].scene = scene; }

export const isDone = id => !!career().training[id]?.done;
// 'done' | 'open' | 'locked' | 'soon' (not built yet)
export function moduleState(id) {
  const m = MODULE_MAP[id]; if (!m) return 'locked';
  if (isDone(id)) return 'done';
  if (!m.scene) return 'soon';
  return (m.after || []).every(isDone) ? 'open' : 'locked';
}
export const nextModule = () => MODULES.find(m => !m.practiceOnly && m.id !== 'registration' && moduleState(m.id) === 'open') || null;
