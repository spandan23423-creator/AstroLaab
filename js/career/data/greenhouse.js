// ASTRO LAB Career — space greenhouse data and simulation: the store catalogue, crops, the 11 construction steps,
// faults, and a simple life-support model (temperature, humidity, water, nutrients, light, airflow, CO2/O2, power).
// Numbers are simplified for play, but the ideal ranges follow real controlled-environment farming guidance.

// Store catalogue. cost in credits. need = required for a working greenhouse. cat groups the store list.
export const CATALOG = [
  { id: 'frame', cat: 'Structure', name: 'Frame kit', cost: 120, need: true, desc: 'Aluminium ribs and floor plates.' },
  { id: 'shell', cat: 'Structure', name: 'Inflatable pressure shell', cost: 140, need: true, desc: 'Holds air in. Layered to block some radiation.' },
  { id: 'airlock', cat: 'Structure', name: 'Small airlock', cost: 90, need: true, desc: 'Lets you in without losing the air.' },
  { id: 'solar', cat: 'Power', name: 'Solar panels (3 kW)', cost: 110, need: true, desc: 'Main power on the lunar day side.' },
  { id: 'battery', cat: 'Power', name: 'Battery pack', cost: 70, need: true, desc: 'Keeps systems running in shade and dust.' },
  { id: 'ledBasic', cat: 'Light', name: 'LED grow lights (basic)', cost: 60, alt: 'light', desc: 'Cheaper, uses more power, more heat.' },
  { id: 'ledEff', cat: 'Light', name: 'LED grow lights (red/blue, efficient)', cost: 95, alt: 'light', desc: 'Only the colours plants use most. Less power, less heat.' },
  { id: 'fans', cat: 'Air', name: 'Fans and air ducts', cost: 45, need: true, desc: 'Moves air so leaves don\'t sit in a bubble of used air.' },
  { id: 'co2', cat: 'Air', name: 'CO₂ / O₂ control unit', cost: 80, need: true, desc: 'Adds CO₂ for plants, removes extra O₂.' },
  { id: 'heater', cat: 'Air', name: 'Heater and thermostat', cost: 50, need: true, desc: 'The Moon swings from +120 °C to −170 °C outside.' },
  { id: 'tank', cat: 'Water', name: 'Water tank (200 L)', cost: 60, need: true, desc: 'Water shipped from Earth is very expensive.' },
  { id: 'pump', cat: 'Water', name: 'Pumps (main + backup)', cost: 55, need: true, desc: 'Circulates water and nutrients.' },
  { id: 'recycler', cat: 'Water', name: 'Water recycler', cost: 100, need: true, desc: 'Collects water the plants breathe out and cleans it.' },
  { id: 'filter', cat: 'Water', name: 'Spare recycler filter', cost: 25, desc: 'Filters clog. A spare saves the day.' },
  { id: 'hydro', cat: 'Growing', name: 'Hydroponic trays', cost: 90, alt: 'beds', desc: 'Roots in water with nutrients. No soil needed.' },
  { id: 'regolith', cat: 'Growing', name: 'Raw lunar regolith (local, cheap)', cost: 10, alt: 'beds', desc: 'Moon dust and rock, collected outside.' },
  { id: 'processor', cat: 'Growing', name: 'Regolith processor', cost: 75, desc: 'Sieves, washes and mixes regolith with compost and nutrients.' },
  { id: 'nutrients', cat: 'Growing', name: 'Nutrient concentrate', cost: 40, need: true, desc: 'Nitrogen, phosphorus, potassium and trace elements.' },
  { id: 'sensors', cat: 'Control', name: 'Sensors + control panel', cost: 85, need: true, desc: 'Measures everything and lets you adjust it.' },
  { id: 'spareLed', cat: 'Spares', name: 'Spare LED panel', cost: 30, desc: 'Swap in if a light panel fails.' }
];
export const CAT_MAP = Object.fromEntries(CATALOG.map(c => [c.id, c]));
export const BASE_BUDGET = 1500;

// Crops: ideal ranges and days to harvest. 6 growth stages.
export const CROPS = {
  lettuce: { name: 'Lettuce', icon: '🥬', days: 35, temp: [17, 24], hum: [50, 70], light: [14, 18], col: 0x6fbf4a, fact: 'Astronauts on the space station have grown and eaten red romaine lettuce in the Veggie unit.' },
  radish: { name: 'Radish', icon: '🌱', days: 28, temp: [15, 22], hum: [50, 70], light: [12, 16], col: 0xd04a6a, fact: 'Radishes grew on the space station in 2020: fast, nutritious and easy to study.' },
  wheat: { name: 'Dwarf wheat', icon: '🌾', days: 70, temp: [18, 24], hum: [50, 70], light: [18, 22], col: 0xd9b44a, fact: 'Dwarf wheat was bred to be short so it fits in a space greenhouse.' },
  tomato: { name: 'Dwarf tomato', icon: '🍅', days: 70, temp: [20, 27], hum: [60, 80], light: [14, 18], col: 0xd9402a, fact: 'Dwarf tomatoes were grown on the space station in 2023.' },
  potato: { name: 'Potato', icon: '🥔', days: 90, temp: [15, 22], hum: [60, 80], light: [12, 16], col: 0x8a6a3a, fact: 'Potatoes give a lot of food per square metre, which matters when space is tight.' }
};
export const STAGES = ['Seed', 'Germination', 'Seedling', 'Leafy growth', 'Flowering / forming', 'Ready to harvest'];

// 11 construction steps, in order. needs: catalogue ids (any one of a group if an array)
export const BUILD = [
  { id: 'site', name: 'Level the site and lay the floor plates', needs: ['frame'], at: [0, -2] },
  { id: 'frame', name: 'Assemble the frame', needs: ['frame'], at: [0, 2.8] },
  { id: 'shell', name: 'Fit and inflate the pressure shell', needs: ['shell'], at: [4.8, 0] },
  { id: 'airlock', name: 'Install the airlock', needs: ['airlock'], at: [0, 6.2] },
  { id: 'power', name: 'Connect solar panels and battery', needs: ['solar', 'battery'], at: [-8.6, 3.4] },
  { id: 'lights', name: 'Hang the LED grow lights', needs: [['ledBasic', 'ledEff']], at: [-1.6, 0] },
  { id: 'air', name: 'Install fans, heater and CO₂/O₂ unit', needs: ['fans', 'heater', 'co2'], at: [-4.6, -2.6] },
  { id: 'water', name: 'Install the water tank and pumps', needs: ['tank', 'pump'], at: [4.2, -2.8] },
  { id: 'recycler', name: 'Install the water recycler and filter', needs: ['recycler'], at: [4.2, 2.4] },
  { id: 'beds', name: 'Set up the growing beds', needs: [['hydro', 'regolith']], at: [0, 0] },
  { id: 'control', name: 'Wire up sensors and the control panel', needs: ['sensors', 'nutrients'], at: [-4.6, 2.2] }
];

// Faults the mission can inject. fix: the control-panel action that solves it.
export const FAULTS = {
  pump: { name: 'Main pump failed', where: 'water', fix: 'Switch to the backup pump', why: 'Without circulation, roots run out of oxygen and nutrients.' },
  led: { name: 'LED panel 2 failed', where: 'light', fix: 'Swap in the spare LED panel', alt: 'Run the remaining lights 4 hours longer', why: 'Less light means less photosynthesis.' },
  heater: { name: 'Heater breaker tripped', where: 'temp', fix: 'Reset the heater breaker', why: 'Cold slows growth and can kill warm-loving crops.' },
  filter: { name: 'Recycler filter clogged', where: 'water', fix: 'Replace the recycler filter', alt: 'Clean the filter (slower, recovers less)', why: 'A clogged filter stops water being recycled, so the tank drains.' },
  co2: { name: 'CO₂ too high', where: 'air', fix: 'Turn on the CO₂ scrubber', why: 'Some CO₂ helps plants, but above about 5,000 ppm it harms people and plants.' },
  dust: { name: 'Dust storm: solar power down 60%', where: 'power', fix: 'Shed load: dim the lights to 12 hours', why: 'When power drops, cut non-essential loads first so life support keeps running.' }
};

// Life-support model: returns a new state each tick. dt in sim days.
export function newSystems() {
  return { temp: 21, hum: 60, water: 180, ec: 1.8, lightH: 16, air: 1, co2: 900, o2: 21, power: 2.4, set: { temp: 21, hum: 60, lightH: 16, dose: 1, fan: 1 }, faults: {}, fixed: {} };
}
export function stepSystems(S, dt, { ledEff, regolithOK, crops }) {
  const f = S.faults, set = S.set;
  const powerIn = (f.dust && !S.fixed.dust ? 1.2 : 3.0); // kW
  const lightLoad = (ledEff ? 0.07 : 0.11) * set.lightH * (f.led && !S.fixed.led ? 0.5 : 1);
  const load = lightLoad + 0.25 * set.fan + 0.3 + 0.4;
  S.power = +(powerIn - load).toFixed(2);
  const powerOK = S.power >= 0;
  const heaterOK = !(f.heater && !S.fixed.heater) && powerOK;
  // temperature drifts to the setpoint (or towards cold if the heater is off). Basic LEDs add heat.
  const tgtT = heaterOK ? set.temp + (ledEff ? 0 : 1.5) : 9;
  S.temp += (tgtT - S.temp) * Math.min(1, dt * 1.2);
  S.hum += (set.hum + (crops * 3) - S.hum) * Math.min(1, dt * 1.5);
  S.lightH = set.lightH * (f.led && !S.fixed.led ? (S.fixed.ledAlt ? 0.75 : 0.5) : 1) * (powerOK ? 1 : 0.4);
  S.air = set.fan;
  // water: plants drink ~1.5 L/day, recycler gives back ~95% when the pump and filter work
  const pumpOK = !(f.pump && !S.fixed.pump);
  const recyc = f.filter && !S.fixed.filter ? 0 : f.filter && S.fixed.filterAlt ? 0.7 : 0.95;
  S.water = Math.max(0, S.water - dt * crops * 1.5 * (1 - (pumpOK ? recyc : 0)));
  S.ec = Math.max(0, S.ec + dt * (set.dose * 0.08 - 0.08 * crops / 2));
  // CO2 and O2: plants take in CO2 and give out O2 when lit; the control unit balances them
  const co2Fault = f.co2 && !S.fixed.co2;
  S.co2 += ((co2Fault ? 6000 : 1000) - S.co2) * Math.min(1, dt * 0.6);
  S.o2 += (21 - S.o2) * Math.min(1, dt);
  return { powerOK, pumpOK, regolithOK };
}
// How happy a crop is right now, 0..1, and which reading is the problem
export function cropHealth(c, S, { pumpOK, regolithOK }) {
  const C = CROPS[c]; const issues = [];
  const band = (v, [lo, hi], soft) => v >= lo && v <= hi ? 1 : Math.max(0, 1 - Math.min(Math.abs(v - lo), Math.abs(v - hi)) / soft);
  const t = band(S.temp, C.temp, 6), h = band(S.hum, C.hum, 25), l = band(S.lightH, C.light, 6);
  const w = S.water > 20 ? 1 : S.water / 20, n = band(S.ec, [1.2, 2.5], 1.2), a = S.air ? 1 : 0.7, co2 = S.co2 < 2000 ? 1 : S.co2 < 5000 ? 0.8 : 0.5;
  if (t < 0.9) issues.push('temperature'); if (h < 0.9) issues.push('humidity'); if (l < 0.9) issues.push('light'); if (w < 0.9) issues.push('water'); if (n < 0.9) issues.push('nutrients'); if (co2 < 1) issues.push('CO₂'); if (!pumpOK) issues.push('pump'); if (!regolithOK) issues.push('soil');
  return { health: Math.max(0, t * h * l * w * n * a * co2 * (pumpOK ? 1 : 0.6) * (regolithOK ? 1 : 0.35)), issues };
}

// Regolith facts for the processing step
export const REGOLITH_FACTS = [
  'Lunar regolith has no organic matter, no living microbes and almost no nitrogen: plants need all three.',
  'Its grains are sharp, glassy and full of fine dust that packs hard and can damage roots.',
  'Plants have grown in real Apollo soil samples in a lab (2022), but they were small and stressed. Mixing it with compost and nutrients helps.'
];
