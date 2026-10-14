// Propeller-aircraft mission performance for the General Atomics MQ-9A Reaper: Breguet endurance
// and range at constant altitude and airspeed, power required versus power available, stall margin,
// service ceiling, and the drag and weight of the stores fit.

import { isa, G0 } from './atmosphere.js';

// Published figures (USAF / GA-ASI fact sheets) and the estimates the model needs. Wing area,
// drag polar, propeller efficiency, part-power fuel consumption, CLmax and the power lapse are not
// published: they are engineering estimates, with bsfc and the lapse exponent calibrated so the
// model reproduces the published 27 h clean endurance and 50,000 ft ceiling.
export const MQ9 = {
  span: 20.1,              // m, published
  wingArea: 24.0,          // m², estimate (aspect ratio ≈ 16.8)
  oswald: 0.8,             // span efficiency, estimate
  cd0: 0.0265,             // clean zero-lift drag incl. turret, antennas and empty pylons, estimate
  massEmpty: 2223,         // kg, published (4,900 lb)
  maxFuel: 1800,           // kg, published (4,000 lb)
  maxInternal: 386,        // kg, published internal payload (850 lb)
  maxExternal: 1361,       // kg, external stores: 3,000 lb on older GA-ASI sheets (the Block 5 sheet gives 3,750 lb)
  mtow: 4760,              // kg, published (10,500 lb)
  powerSL: 671,            // kW shaft, TPE331-10GD 900 shp, published
  lapse: 0.5,              // P_avail = P_SL · σ^lapse, calibrated to the 15,240 m ceiling
  propEff: 0.78,           // estimate
  bsfc: 0.385,             // kg/(kW·h) at loiter power, calibrated to 27 h clean
  clMax: 1.45,             // flaps up, estimate
  reserve: 0.05,           // fraction of fuel kept in reserve
  marginV: 1.2,            // operating floor: 1.2 × stall speed
};

// Stores fits. Masses: GBU-12 ≈ 230 kg, AGM-114 ≈ 49 kg and the M310 two-rail launcher ≈ 43 kg
// (42 kg / 92 lb empty, Lockheed Martin) are published; every drag area (f = ΔCD0 · S) is an estimate.
// The ER fit's `fuel` is external fuel burned with the internal load: GA-ASI gives 6,450 lb with the
// two ER pods against 3,800 lb internal, so 2,650 lb (1,202 kg) in the pods; the pods' empty mass is
// an estimate.
export const LOADOUTS = {
  clean: { label: 'Clean', detail: 'sensors only', mass: 0, dragArea: 0 },
  hellfire: { label: '4 × Hellfire', detail: '4 × AGM-114 on two M310 launchers', mass: 4 * 49 + 2 * 43, dragArea: 2 * 0.035 },
  strike: { label: '+ 2 × GBU-12', detail: '2 × GBU-12 + 4 × AGM-114', mass: 2 * 230 + 4 * 49 + 2 * 43, dragArea: 2 * 0.026 + 2 * 0.035 },
  er: { label: 'ER fuel pods', detail: '2 × ER fuel pods (1,202 kg of extra fuel)', mass: 2 * 45, fuel: 1202, dragArea: 2 * 0.045 },
};

const AR = (MQ9.span ** 2) / MQ9.wingArea;
const K = 1 / (Math.PI * AR * MQ9.oswald);
// power-specific fuel consumption as weight flow per watt: N/(W·s)
const C_POWER = (MQ9.bsfc * G0) / (1000 * 3600);

export const aspectRatio = AR;

export function dragPolar(cl, cd0 = MQ9.cd0) {
  return cd0 + K * cl * cl;
}

/** Shaft power available at altitude (kW). */
export function powerAvailable(altitude) {
  return MQ9.powerSL * isa(altitude).sigma ** MQ9.lapse;
}

/** Speed for a lift coefficient at weight W (N) and density rho. */
const speedFor = (W, rho, cl) => Math.sqrt((2 * W) / (rho * MQ9.wingArea * cl));

/**
 * Constant-altitude, constant-airspeed loiter. Endurance uses the mid-mission lift coefficient.
 * payload is internal (sensors) in kg; stores is a LOADOUTS key. Returns hours, km, kW, m/s.
 */
export function mission({ fuel = 1300, payload = 250, stores = 'clean', altitude = 7600, speed = 80, transit = 0 } = {}) {
  const atm = isa(altitude);
  const S = MQ9.wingArea;
  const fit = LOADOUTS[stores] || LOADOUTS.clean;
  const cd0 = MQ9.cd0 + fit.dragArea / S;
  const totalFuel = fuel + (fit.fuel || 0);                 // internal + external (ER pods)
  const W0 = (MQ9.massEmpty + totalFuel + payload + fit.mass) * G0;
  const W1 = (MQ9.massEmpty + payload + fit.mass + totalFuel * MQ9.reserve) * G0;
  const Wmid = Math.sqrt(W0 * W1);
  const q = 0.5 * atm.rho * speed * speed;
  const cl = Wmid / (q * S);
  const stall = cl > MQ9.clMax;
  const lowMargin = cl > MQ9.clMax / MQ9.marginV ** 2;
  const cd = dragPolar(cl, cd0);
  const lOverD = cl / cd;
  const eta = MQ9.propEff;
  const powerReq = (Wmid / lOverD) * speed / eta;           // shaft W at mid-mission
  const powerAvailKW = powerAvailable(altitude);
  const powerLimited = powerReq / 1000 > powerAvailKW;
  const enduranceS = (eta / (C_POWER * speed)) * lOverD * Math.log(W0 / W1);
  const rangeM = (eta / C_POWER) * lOverD * Math.log(W0 / W1);
  const enduranceH = stall ? 0 : enduranceS / 3600;
  const transitH = (2 * transit * 1000) / speed / 3600;
  const vStall = speedFor(Wmid, atm.rho, MQ9.clMax);
  const vFloor = vStall * MQ9.marginV;
  const vMinPower = speedFor(Wmid, atm.rho, Math.sqrt((3 * cd0) / K));
  const vMinDrag = speedFor(Wmid, atm.rho, Math.sqrt(cd0 / K));
  return {
    atm, cl, cd, cd0, lOverD, stall, lowMargin, powerLimited,
    endurance: enduranceH,
    range: stall ? 0 : rangeM / 1000,
    onStation: Math.max(0, enduranceH - transitH),
    powerKW: powerReq / 1000,
    powerAvailKW,
    takeoffMass: W0 / G0,
    storesMass: fit.mass + (fit.fuel || 0),
    totalFuel,
    overweight: W0 / G0 > MQ9.mtow,
    overPayload: payload > MQ9.maxInternal || fit.mass + (fit.fuel || 0) > MQ9.maxExternal,
    vStall,
    vMinPower,
    // best-endurance and best-range speeds, held above 1.2 × stall speed: on this long wing the
    // ideal minimum-power speed falls below that floor at loiter altitudes
    vMaxEndurance: Math.max(vMinPower, vFloor),
    vMaxRange: Math.max(vMinDrag, vFloor),
  };
}

/** Endurance across airspeed; NaN where the speed is below 1.2 Vs or needs more power than the engine has. */
export function enduranceSweep(params, from = 40, to = 140, steps = 80) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const v = from + ((to - from) * i) / steps;
    const m = mission({ ...params, speed: v });
    const ok = !m.lowMargin && !m.powerLimited;
    out.push({ speed: v, endurance: ok ? m.endurance : NaN, range: ok ? m.range : NaN });
  }
  return out;
}

/**
 * Service ceiling (m) at mass `mass` kg with the given stores: the highest altitude where the
 * aircraft can still climb at 0.5 m/s (100 ft/min) at its best-climb speed (held above 1.2 Vs).
 */
export function serviceCeiling(mass, stores = 'clean') {
  const fit = LOADOUTS[stores] || LOADOUTS.clean;
  const cd0 = MQ9.cd0 + fit.dragArea / MQ9.wingArea;
  const W = mass * G0;
  const excess = (h) => {
    const rho = isa(h).rho;
    const v = Math.max(speedFor(W, rho, Math.sqrt((3 * cd0) / K)), speedFor(W, rho, MQ9.clMax) * MQ9.marginV);
    const cl = W / (0.5 * rho * v * v * MQ9.wingArea);
    const pReq = (W / (cl / dragPolar(cl, cd0))) * v;                 // W of thrust power
    return (MQ9.propEff * powerAvailable(h) * 1000 - pReq) / W - 0.5;  // climb rate above 0.5 m/s
  };
  if (excess(0) < 0) return 0;
  let lo = 0, hi = 20000;
  if (excess(hi) > 0) return hi;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (excess(mid) > 0) lo = mid; else hi = mid; }
  return lo;
}
