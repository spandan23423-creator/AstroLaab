// ASTRO LAB — Lunar Mission surface data: real gravity, sky geometry and geography of Earth's Moon.
//
// Coordinates: metres. +x = east, −z = north, y = up. The lander/landing point is near (0, 0).
// Sizes of named features come from mission data (Apollo surface maps, LRO, Galileo, Cassini,
// Voyager 2, New Horizons, Huygens). Positions of features relative to each other are approximate,
// and small features (boulders, small craters, pebbles) are generated, not mapped.

const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
export const mix = (a, b, t) => { t = Math.max(0, Math.min(1, t)); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
const C = Object.fromEntries(Object.entries({
  mare: '#5c5a57', mareLight: '#77736d', highland: '#9c9890', highlandLight: '#b9b4ab', ejecta: '#a8a49c', shadowGrey: '#3d3c3a'
}).map(([k, v]) => [k, hex(v)]));
export const COLORS = C;

// ---------- Bodies (all values real) ----------
export const SURFACE_BODIES = {
  moon: {
    name: 'Moon', g: 1.62, radiusKm: 1737.4, escape: 2380,
    atm: { rho: 0, label: 'None (exosphere ~10⁻¹⁵ bar)' },
    temp: { sun: 'up to +120 °C', shade: 'down to −170 °C' },
    dose: 1.58e-5, doseNote: 'Chang\'e 4 measured ~1.4 mSv per day on the lunar surface (about 200× Earth\'s surface rate).',
    sunAU: 1, sky: 'black', starOpacity: 0.18,
    facts: ['No air means no sound, no wind and no weather — dust kicked up flies in perfect parabolas and falls straight back.', 'You weigh about 1/6 of your Earth weight here (1.62 m/s² vs 9.81 m/s²).', 'Stars are hard to see in daylight: the bright ground and Sun overwhelm your eyes and cameras, which is why Apollo photos show a black, starless sky.']
  }
};

// ---------- Landing sites ----------
// sun / parent: azimuth (degrees clockwise from north) and elevation (degrees above horizon); ang = angular diameter (degrees).
export const SITES = [
  // ===================== EARTH'S MOON =====================
  {
    id: 'tranquility', body: 'moon', name: 'Tranquility Base', badge: 'moonwalker',
    subtitle: 'Apollo 11 · Mare Tranquillitatis · 0.67°N 23.47°E',
    blurb: 'Where Neil Armstrong and Buzz Aldrin landed on 20 July 1969. A flat, dark basalt plain with Little West and West craters nearby.',
    extent: 700, res: 340, seed: 11,
    sun: { az: 90, el: 14 }, parent: { tex: 'earth', name: 'Earth', ang: 1.9, az: 270, el: 66 },
    spawn: { x: 7, z: 9, yaw: 90 },
    terrain: [
      { t: 'noise', amp: 1.4, scale: 90, oct: 4 },
      { t: 'noise', amp: 0.18, scale: 6, oct: 2 },
      { t: 'crater', x: 60, z: 2, d: 33, depth: 0.16, fresh: 0.6, name: 'Little West crater' },
      { t: 'crater', x: 400, z: 20, d: 185, depth: 0.17, fresh: 1, name: 'West crater' },
      { t: 'crater', x: -150, z: -210, d: 70, depth: 0.08, fresh: 0.1 },
      { t: 'crater', x: -320, z: 160, d: 110, depth: 0.07, fresh: 0.05 },
      { t: 'craterField', n: 220, dMin: 1.5, dMax: 22, seed: 3 },
      { t: 'craterField', n: 25, dMin: 25, dMax: 70, seed: 4, worn: true }
    ],
    paint: { base: 'mare', alt: 'mareLight', ejecta: 'ejecta' },
    rocks: { n: 900, min: 0.08, max: 0.6, bias: [{ x: 400, z: 20, r: 220, n: 350, max: 3.5 }, { x: 60, z: 2, r: 30, n: 60, max: 0.9 }], color: 'mareLight' },
    lander: { x: 0, z: 0, model: 'lm', name: 'Eagle descent stage' },
    rover: null,
    pois: [
      { id: 'eagle', name: 'Eagle (LM descent stage)', x: 0, z: 0, icon: '🛸', r: 8, fact: 'The descent stage stayed behind as the launch pad for the ascent stage. Its plaque reads: "We came in peace for all mankind."' },
      { id: 'flag', name: 'US flag', x: -5, z: -9, icon: '🏳️', r: 4, model: 'flag', fact: 'The flag was blown over by the ascent engine exhaust at liftoff, as Aldrin saw.' },
      { id: 'lrrr', name: 'Laser Ranging Retroreflector', x: -10, z: 19, icon: '🔦', r: 4, model: 'lrrr', fact: 'Still in use: observatories bounce lasers off it to measure the Earth–Moon distance to millimetres. The Moon recedes about 3.8 cm per year.' },
      { id: 'psep', name: 'Passive Seismic Experiment', x: -3, z: 17, icon: '📈', r: 4, model: 'psep', fact: 'The first seismometer on another world. It recorded moonquakes and the astronauts\' footsteps during its three weeks of operation.' },
      { id: 'littlewest', name: 'Little West crater rim', x: 46, z: 0, icon: '🕳️', r: 6, fact: 'About 33 m across and 60 m east of the LM. Armstrong ran here alone for the farthest walk of Apollo 11 — about 60 metres.' },
      { id: 'westcrater', name: 'West crater rim', x: 310, z: 20, icon: '🕳️', r: 12, fact: 'About 185 m across and strewn with boulders. Armstrong steered Eagle past it by hand, landing with about 25 seconds of fuel margin.' }
    ],
    samples: [
      { id: '10003', name: 'Sample 10003 — low-potassium basalt', x: 16, z: 10, fact: 'A volcanic rock that crystallised about 3.8 billion years ago from lava that flooded Mare Tranquillitatis.' },
      { id: '10017', name: 'Sample 10017 — high-potassium basalt', x: -14, z: -22, fact: 'A fine-grained basalt about 3.6 billion years old. The mare lavas are much younger than the bright highlands.' },
      { id: '10046', name: 'Sample 10046 — regolith breccia', x: 54, z: -16, fact: 'Soil and rock fragments welded together by meteorite impacts. Apollo 11 brought back 21.5 kg of samples in total.' },
      { id: '10084', name: 'Sample 10084 — lunar soil', x: -24, z: 8, fact: 'Fine regolith with tiny glass beads made by impacts. It smells like spent gunpowder, according to the astronauts.' }
    ],
    zones: [],
    objectives: [
      { id: 'walk', text: 'Take your first steps — walk 15 m', type: 'walk', n: 15 },
      { id: 'look', text: 'Find Earth in the sky and look at it', type: 'look', target: 'parent' },
      { id: 'jump', text: 'Jump higher than 0.5 m (hold Space)', type: 'jump', n: 0.5 },
      { id: 'samples', text: 'Collect 3 rock samples', type: 'samples', n: 3 },
      { id: 'lrrr', text: 'Visit the laser retroreflector', type: 'reach', poi: 'lrrr' },
      { id: 'littlewest', text: 'Walk to Little West crater (60 m east)', type: 'reach', poi: 'littlewest' }
    ],
    reward: { xp: 250 }
  },
  {
    id: 'hadley', body: 'moon', name: 'Hadley–Apennine', badge: 'lunar-driver',
    subtitle: 'Apollo 15 · Hadley Rille · 26.13°N 3.63°E',
    blurb: 'Apollo 15 landed beside a 1.2 km-wide lava channel at the foot of the Apennine Mountains and drove the first Lunar Roving Vehicle.',
    extent: 3300, res: 420, seed: 15,
    sun: { az: 95, el: 20 }, parent: { tex: 'earth', name: 'Earth', ang: 1.9, az: 188, el: 64 },
    spawn: { x: 8, z: 11, yaw: 100 },
    terrain: [
      { t: 'noise', amp: 5, scale: 300, oct: 4 },
      { t: 'noise', amp: 0.25, scale: 8, oct: 2 },
      { t: 'rille', x: -2150, angle: 0, width: 1200, depth: 300, meander: 160, wl: 1500, name: 'Hadley Rille' },
      { t: 'rise', x: 0, z: 4200, r: 2800, h: 650, name: 'Hadley Delta foothills' },
      { t: 'crater', x: 420, z: 2700, d: 100, depth: 0.12, fresh: 0.4, name: 'Spur crater' },
      { t: 'crater', x: -1250, z: 2200, d: 400, depth: 0.1, fresh: 0.2, name: 'Elbow crater' },
      { t: 'crater', x: 650, z: -900, d: 260, depth: 0.12, fresh: 0.3 },
      { t: 'craterField', n: 600, dMin: 4, dMax: 60, seed: 6 },
      { t: 'craterField', n: 40, dMin: 60, dMax: 220, seed: 7, worn: true }
    ],
    paint: { base: 'mare', alt: 'mareLight', ejecta: 'ejecta', slopeLight: 'highland' },
    rocks: { n: 1600, min: 0.1, max: 0.9, bias: [{ x: -1800, z: 300, r: 260, n: 400, max: 4 }, { x: 420, z: 2700, r: 120, n: 80, max: 1.5 }], color: 'mareLight' },
    lander: { x: 0, z: 0, model: 'lm', name: 'Falcon descent stage' },
    rover: { x: 12, z: 5, yaw: 110, name: 'Lunar Roving Vehicle', max: 3.6 },
    backdrop: [
      { name: 'Mons Hadley', az: 40, dist: 20000, h: 4500, w: 16000 },
      { name: 'Hadley Delta', az: 175, dist: 8500, h: 3500, w: 14000 },
      { name: 'Apennine front', az: 120, dist: 26000, h: 3000, w: 20000 },
      { name: 'Apennine front', az: 80, dist: 30000, h: 2600, w: 14000 }
    ],
    pois: [
      { id: 'falcon', name: 'Falcon (LM descent stage)', x: 0, z: 0, icon: '🛸', r: 9, fact: 'Apollo 15 was the first "J-mission": three days on the surface and 18 hours of moonwalks.' },
      { id: 'flag', name: 'US flag', x: 6, z: -14, icon: '🏳️', r: 4, model: 'flag', fact: 'Dave Scott and Jim Irwin raised it on the first moonwalk, 31 July 1971.' },
      { id: 'alsep', name: 'ALSEP science station', x: -110, z: -20, icon: '📡', r: 8, model: 'psep', fact: 'A nuclear-powered science station, set up about 110 m from the LM. It measured moonquakes and heat flow and sent data to Earth until 1977.' },
      { id: 'memorial', name: 'Fallen Astronaut memorial', x: 90, z: 14, icon: '🕯️', r: 4, model: 'plaque', fact: 'A small aluminium figure and a plaque listing 14 astronauts and cosmonauts who died, left by the crew beside the rover.' },
      { id: 'st9a', name: 'Station 9A — rille edge', x: -1730, z: 300, icon: '🏞️', r: 25, fact: 'Hadley Rille is about 1.2 km wide and 300 m deep — a channel carved by flowing lava more than 3.3 billion years ago. Layered lava flows show in its far wall.' },
      { id: 'spur', name: 'Spur crater (Station 7)', x: 420, z: 2640, icon: '🕳️', r: 20, fact: 'On the slope of Hadley Delta, Scott and Irwin found a white anorthosite rock perched on top of a boulder: the "Genesis Rock".' },
      { id: 'elbow', name: 'Elbow crater (Station 1)', x: -1140, z: 2080, icon: '🕳️', r: 25, fact: 'A 400 m crater near a bend in the rille, the first stop of the first rover drive.' }
    ],
    samples: [
      { id: '15415', name: 'Sample 15415 — the Genesis Rock', x: 445, z: 2620, fact: 'Anorthosite about 4.1 billion years old — a piece of the Moon\'s early crust that crystallised from a global magma ocean.' },
      { id: '15555', name: 'Sample 15555 — "Great Scott" basalt', x: -1712, z: 282, fact: 'Collected near the rille edge. This 9.6 kg olivine basalt is about 3.3 billion years old and one of the most studied Apollo rocks.' },
      { id: '15016', name: 'Sample 15016 — vesicular basalt', x: 70, z: -60, fact: 'Full of gas bubbles (vesicles) left by volcanic gases as the lava cooled.' }
    ],
    zones: [],
    objectives: [
      { id: 'board', text: 'Board the Lunar Roving Vehicle (E)', type: 'board' },
      { id: 'drive', text: 'Drive 400 m in the rover', type: 'drive', n: 400 },
      { id: 'air', text: 'Get the rover airborne (drive fast over bumps and rims)', type: 'air', n: 0.3 },
      { id: 'drop', text: 'Do the hammer–feather drop test (G)', type: 'drop' },
      { id: 'st9a', text: 'Reach the edge of Hadley Rille (Station 9A)', type: 'reach', poi: 'st9a' },
      { id: 'genesis', text: 'Collect the Genesis Rock at Spur crater', type: 'sample', sample: '15415' }
    ],
    reward: { xp: 300 }
  },
  {
    id: 'shackleton', body: 'moon', name: 'Shackleton Rim', badge: 'ice-hunter',
    subtitle: 'Lunar south pole · Shackleton crater · 89.7°S',
    blurb: 'A 21 km-wide, 4 km-deep crater at the south pole. The Sun skims the horizon and the crater floor has not seen sunlight for billions of years.',
    extent: 1600, res: 360, seed: 21,
    sun: { az: 90, el: 1.5 }, parent: { tex: 'earth', name: 'Earth', ang: 1.9, az: 15, el: 4 },
    temp: { sun: 'about −50 °C on the sunlit rim', shade: 'below −200 °C' },
    spawn: { x: 215, z: 40, yaw: 270 },
    terrain: [
      { t: 'noise', amp: 6, scale: 260, oct: 4 },
      { t: 'noise', amp: 0.25, scale: 8, oct: 2 },
      { t: 'wall', x: -40, angle: 0, slope: 27, rim: 18, rimW: 140, outer: -2.5, name: 'Shackleton inner wall' },
      { t: 'craterField', n: 340, dMin: 3, dMax: 45, seed: 8 },
      { t: 'craterField', n: 20, dMin: 50, dMax: 150, seed: 9, worn: true }
    ],
    paint: { base: 'highland', alt: 'highlandLight', ejecta: 'highlandLight' },
    rocks: { n: 1100, min: 0.1, max: 1.0, color: 'highland' },
    lander: { x: 250, z: 0, model: 'lander', name: 'Crew lander' },
    rover: { x: 232, z: 70, yaw: 270, name: 'Polar rover', max: 3.6 },
    pois: [
      { id: 'lander', name: 'Crew lander', x: 250, z: 0, icon: '🛸', r: 12, fact: 'NASA\'s Artemis programme has picked the south polar region for crewed landings, partly for water ice and near-constant sunlight on the rims.' },
      { id: 'crest', name: 'Rim crest — a "peak of near-eternal light"', x: -30, z: -20, icon: '☀️', r: 18, fact: 'Because the Moon\'s axis tilts only 1.5°, some rim points here are sunlit over 80% of the time — ideal for solar power.' },
      { id: 'psr', name: 'Permanently shadowed region', x: -260, z: 30, icon: '🧊', r: 40, fact: 'Below the rim the Sun never rises. LRO\'s Diviner instrument measured some polar shadows below −240 °C, cold enough to trap water ice for billions of years.' }
    ],
    samples: [
      { id: 'icecore', name: 'Icy regolith core', x: -260, z: 30, needsShadow: true, fact: 'A predicted sample: neutron and laser data suggest polar shadows hold water ice mixed into the soil. In 2009 the LCROSS impact at nearby Cabeus crater found about 5.6% water by mass.' },
      { id: 'anorth', name: 'Highland anorthosite chip', x: 150, z: -70, fact: 'The south pole sits in bright highland crust — feldspar-rich rock very different from the dark mare basalts.' }
    ],
    zones: [
      { id: 'ice', x: -260, z: 30, r: 140, needsShadow: true, result: 'Neutron spectrometer: strong drop in fast neutrons — hydrogen-rich soil. Likely water ice, a few % by mass. Surface temperature here: about −200 °C.' }
    ],
    objectives: [
      { id: 'crest', text: 'Walk to the sunlit rim crest', type: 'reach', poi: 'crest' },
      { id: 'look', text: 'Find Earth low on the horizon', type: 'look', target: 'parent' },
      { id: 'shadow', text: 'Descend into permanent shadow', type: 'shadow' },
      { id: 'scan', text: 'Scan for water ice in the shadow (R)', type: 'scan', zone: 'ice' },
      { id: 'core', text: 'Collect an icy regolith core', type: 'sample', sample: 'icecore' },
      { id: 'return', text: 'Climb back to the rim crest', type: 'reach', poi: 'crest', after: 'core' }
    ],
    reward: { xp: 300 }
  }
];
export const SITE_MAP = Object.fromEntries(SITES.map(s => [s.id, s]));
export const sitesFor = bodyId => SITES.filter(s => s.body === bodyId);
export const SURFACE_BODY_IDS = Object.keys(SURFACE_BODIES);
