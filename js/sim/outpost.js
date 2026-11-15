// ASTRO LAB — shared outpost simulation: power, oxygen, CO2, water and heat for a small crewed habitat.
// Pure JavaScript (no rendering), so the Academy test stand and the lunar outpost run the exact same rules,
// and it can be tested in Node (tools/test-sim.mjs). Time is in hours; power in kW; energy in kWh.
//
// Simplifications (labelled for players in the logbook): the cabin is one well-mixed volume, machines are on/off
// (heaters are a thermostat), and the battery has a single round-trip efficiency.

// Reference values (see the blueprint's accuracy section; check before changing)
export const REF = {
  o2PerPersonKgH: 0.84 / 24,      // about 0.84 kg of oxygen per person per day
  co2PerPersonKgH: 1.0 / 24,      // about 1 kg of CO2 per person per day
  waterPerPersonLH: 3.5 / 24,     // drinking, food and hygiene water, litres per person per day (game value)
  waterPerO2Kg: 18 / 16,          // electrolysis: 1.125 kg (L) of water per kg of O2
  airKg: 120,                     // cabin air mass (about 100 m³ at 1 atm)
  o2SafeLowPct: 19.5, o2TargetPct: 21, co2WarnPct: 0.5, co2BadPct: 1.0,
  tempLow: 18, tempHigh: 27
};
const pctFromKg = (kg, molar) => kg / REF.airKg * (29 / molar) * 100;
const kgFromPct = (pct, molar) => pct / 100 * REF.airKg * (molar / 29);

// The machines an outpost can power. priority: higher = more essential (shed last). life: part of life support.
export const LOAD_TYPES = {
  o2gen:    { name: 'O2 generator',     kW: 1.2, priority: 9, life: true },
  scrubber: { name: 'CO2 scrubber',     kW: 0.6, priority: 10, life: true },
  recycler: { name: 'Water recycler',   kW: 0.4, priority: 7, life: true },
  heaters:  { name: 'Heaters',          kW: 2.0, priority: 8, life: true, thermostat: true },
  comms:    { name: 'Comms',            kW: 0.2, priority: 6 },
  lights:   { name: 'Cabin lights',     kW: 0.3, priority: 4 },
  science:  { name: 'Science lab',      kW: 0.8, priority: 2 },
  rover:    { name: 'Rover charger',    kW: 1.5, priority: 1 },
  greenhouse: { name: 'Greenhouse',     kW: 1.5, priority: 3 }
};

export class Outpost {
  // panels: [{ id, peakKW }]  loads: ids from LOAD_TYPES  battery: { capKWh, socPct }
  constructor({ crew = 4, panels = [], loads = Object.keys(LOAD_TYPES), battery = { capKWh: 20, socPct: 80 }, waterL = 300, tempC = 21, sunlit = true, ambientC = -30 } = {}) {
    this.t = 0; this.crew = crew; this.ambientC = ambientC;
    this.sun = sunlit ? 1 : 0;                       // 0..1 sunlight on the panels (set by the scene: day, shadow, lamp)
    this.panels = panels.map(p => ({ id: p.id, peakKW: p.peakKW ?? 2, angleErr: p.angleErr ?? 0, dust: 0, connected: p.connected ?? true, deployed: p.deployed ?? true }));
    this.battery = { capKWh: battery.capKWh, kWh: battery.capKWh * battery.socPct / 100, connected: battery.connected ?? true, maxChargeKW: 6, eff: 0.92 };
    this.busConnected = true;                        // controller -> load bus
    this.loads = loads.map(id => Object.assign({ id, on: true, powered: false, fuseBlown: false, wear: 1, setC: 21 }, LOAD_TYPES[id]));
    this.o2Kg = kgFromPct(REF.o2TargetPct, 32); this.co2Kg = kgFromPct(0.04, 44);
    this.waterL = waterL; this.tempC = tempC;
    this.recyclerEff = 0.95;
    this.log = []; this.min = { socPct: 100, o2Pct: 21 }; this.lifeOutH = 0; this.blackouts = 0;
    this.solarKW = 0; this.loadKW = 0; this.netKW = 0;
  }
  load(id) { return this.loads.find(l => l.id === id); }
  get socPct() { return this.battery.capKWh ? this.battery.kWh / this.battery.capKWh * 100 : 0; }
  get o2Pct() { return pctFromKg(this.o2Kg, 32); }
  get co2Pct() { return pctFromKg(this.co2Kg, 44); }
  setPriority(id, p) { const l = this.load(id); if (l) l.priority = p; }
  setOn(id, on) { const l = this.load(id); if (l) l.on = on; }
  // order loads most essential first
  byPriority() { return [...this.loads].sort((a, b) => b.priority - a.priority); }

  solarNow() {
    let kw = 0;
    for (const p of this.panels) if (p.connected && p.deployed) kw += p.peakKW * this.sun * Math.max(0, Math.cos(p.angleErr)) * (1 - p.dust);
    return kw;
  }
  // power each load wants this instant (thermostat heaters only when cold)
  demandOf(l) {
    if (!l.on || l.fuseBlown) return 0;
    if (l.thermostat) return this.tempC < l.setC + 0.5 ? l.kW : 0;
    return l.kW;
  }

  // Advance by dt hours. Use small steps (the scene calls it every frame with game-time hours).
  tick(dt) {
    if (dt <= 0) return;
    const steps = Math.ceil(dt / (1 / 60)); const h = dt / steps;     // at most 1 game-minute per step
    for (let i = 0; i < steps; i++) this.step(h);
  }
  step(h) {
    this.t += h;
    const B = this.battery, solar = this.solarNow();
    // decide which loads get power: the most essential first, while solar + battery can supply them
    const canBattery = B.connected && B.kWh > 0.001;
    const battMaxKW = canBattery ? B.kWh / h : 0;
    let budget = solar + battMaxKW, used = 0;
    let starved = false;
    for (const l of this.byPriority()) {
      const d = this.demandOf(l);
      if (d > 0 && this.busConnected && used + d <= budget + 1e-9) { l.powered = true; l.starved = false; used += d; }
      else { l.powered = false; l.starved = d > 0; if (l.starved && l.life) starved = true; }
    }
    if (starved) this.lifeOutH += h;
    // battery flow
    const net = solar - used;
    if (net >= 0) { if (B.connected) B.kWh = Math.min(B.capKWh, B.kWh + Math.min(net, B.maxChargeKW) * B.eff * h); }
    else B.kWh = Math.max(0, B.kWh + net * h);
    this.solarKW = solar; this.loadKW = used; this.netKW = net;
    // life support chemistry
    const P = id => this.load(id)?.powered;
    const breathO2 = REF.o2PerPersonKgH * this.crew * h, breathCO2 = REF.co2PerPersonKgH * this.crew * h;
    this.o2Kg -= breathO2; this.co2Kg += breathCO2;
    if (P('o2gen')) { // electrolysis replaces what the crew breathes (up to 0.16 kg/h, never above 21%), so oxygen holds steady
      // but never climbs: on the Moon there is no outside source, and the readout must not go up. Stops when there is no water.
      const want = Math.max(0, kgFromPct(REF.o2TargetPct, 32) - this.o2Kg), make = Math.min(want, breathO2, 0.16 * h, this.waterL / REF.waterPerO2Kg);
      this.o2Kg += make; this.waterL -= make * REF.waterPerO2Kg;
    }
    if (P('scrubber')) this.co2Kg = Math.max(kgFromPct(0.04, 44), this.co2Kg - 0.25 * h);
    const used_water = REF.waterPerPersonLH * this.crew * h; this.waterL -= used_water;
    if (P('recycler')) this.waterL += used_water * this.recyclerEff;
    this.waterL = Math.max(0, this.waterL);
    // heat: electronics warm the cabin a little, heaters a lot, the cold outside pulls heat away
    // nearly all electrical power inside ends up as heat; the radiator loop dumps extra heat above 23 °C
    const outside = (P('rover') ? this.load('rover').kW : 0);
    const heatIn = (used - outside) * 0.7 + this.sun * 0.6;
    const heatOut = (this.tempC - this.ambientC) * 0.06 + (this.tempC > 23 ? Math.min(4, (this.tempC - 23) * 2) : 0);
    this.tempC += (heatIn - heatOut) / 2.0 * h;               // 2 kWh per °C of thermal mass
    // bookkeeping
    this.min.socPct = Math.min(this.min.socPct, this.socPct); this.min.o2Pct = Math.min(this.min.o2Pct, this.o2Pct);
  }

  // hours until a resource runs out at the current rate (Infinity when it is not falling)
  reserveHours(res) {
    if (res === 'battery') return this.netKW < 0 ? this.battery.kWh / -this.netKW : Infinity;
    if (res === 'o2') { const drop = REF.o2PerPersonKgH * this.crew - (this.load('o2gen')?.powered ? 0.16 : 0); return drop > 0 ? (this.o2Kg - kgFromPct(REF.o2SafeLowPct, 32)) / drop : Infinity; }
    if (res === 'water') { const r = this.load('recycler')?.powered ? 1 - this.recyclerEff : 1; const drop = REF.waterPerPersonLH * this.crew * r + (this.load('o2gen')?.powered ? 0.16 * REF.waterPerO2Kg * 0.3 : 0); return drop > 0 ? this.waterL / drop : Infinity; }
    return Infinity;
  }
  // current alarms, most serious first: [{ id, level: 'critical'|'warning', text }]
  alarms() {
    const a = [];
    if (this.socPct < 10) a.push({ id: 'batt', level: 'critical', text: `Battery ${this.socPct.toFixed(0)}%: life support will shut down` });
    else if (this.socPct < 20) a.push({ id: 'batt', level: 'warning', text: `Battery low: ${this.socPct.toFixed(0)}%` });
    for (const l of this.loads) {
      if (l.fuseBlown) a.push({ id: 'fuse-' + l.id, level: l.life ? 'critical' : 'warning', text: `${l.name}: fuse blown` });
      else if (l.life && l.on && l.starved) a.push({ id: 'off-' + l.id, level: 'critical', text: `${l.name}: no power` });
      else if (l.life && !l.on) a.push({ id: 'sw-' + l.id, level: 'warning', text: `${l.name} switched off` });
    }
    if (this.o2Pct < REF.o2SafeLowPct) a.push({ id: 'o2', level: 'critical', text: `Oxygen ${this.o2Pct.toFixed(1)}%` });
    if (this.co2Pct > REF.co2BadPct) a.push({ id: 'co2', level: 'critical', text: `CO2 ${this.co2Pct.toFixed(2)}%` });
    else if (this.co2Pct > REF.co2WarnPct) a.push({ id: 'co2', level: 'warning', text: `CO2 rising: ${this.co2Pct.toFixed(2)}%` });
    if (this.tempC < REF.tempLow - 3) a.push({ id: 'temp', level: 'warning', text: `Cabin cold: ${this.tempC.toFixed(0)} °C` });
    if (this.waterL < 50) a.push({ id: 'water', level: 'warning', text: `Water low: ${this.waterL.toFixed(0)} L` });
    return a.sort((x, y) => (x.level === 'critical' ? 0 : 1) - (y.level === 'critical' ? 0 : 1));
  }
  // faults (the scenes and the event director call these)
  blowFuse(id) { const l = this.load(id); if (l) l.fuseBlown = true; }
  replaceFuse(id) { const l = this.load(id); if (l) l.fuseBlown = false; }
  addDust(frac) { for (const p of this.panels) p.dust = Math.min(0.9, p.dust + frac); }
  cleanPanels() { for (const p of this.panels) p.dust = 0; }
}
