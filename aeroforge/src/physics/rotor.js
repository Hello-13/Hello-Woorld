// Rotorcraft performance for the UH-60M Black Hawk lab.
//
//   Hover        momentum (actuator-disc) theory: ideal power T·v_h = T^1.5 / √(2ρA), divided by the
//                figure of merit FM that the induced-loss factor κ and the blade profile drag produce.
//   Forward      the classic power polar: induced (Glauert) + profile (1 + 4.65 μ²) + parasite ½ρV³f,
//                plus an empirical compressibility penalty once the advancing tip passes M ≈ 0.85.
//   Anti-torque  the tail rotor balances main-rotor torque Q = P/Ω at its 9.93 m arm; its 20° cant
//                lets it carry part of the weight, and the cambered pylon unloads it at speed.
//   Engines      two GE T700-GE-701D ratings with a δ·θ^−k altitude/temperature lapse, capped by the
//                3,400 shp main-transmission rating.
//   Limits       hover ceilings in and out of ground effect (Cheeseman–Bennett), advancing-tip Mach,
//                retreating-blade stall (a blade-loading boundary CT/σ versus μ), autorotation.
//
// Pure functions in SI units (N, W, m, s); no three.js import so the tests run in node.

import { isa, G0, R_AIR, GAMMA_AIR, RHO_SL, T_SL, P_SL } from './atmosphere.js';

export const SHP = 745.6999;     // W per shaft horsepower
export const KT = 0.514444;      // m/s per knot
export const FPM = 0.00508;      // m/s per ft/min
const DEG = Math.PI / 180;

/** UH-60M data. Published figures are marked; everything else is a documented estimate. */
export const UH60 = {
  // main rotor: 16.36 m diameter, 4 blades, 258 rpm (published). Chord: the wide-chord blade adds
  // about 10 % solidity to the 0.527 m UH-60A blade (NASA/Yeo), so ≈ 0.58 m (estimate).
  R: 8.18, blades: 4, chord: 0.58, rpm: 258,
  Cd0: 0.0095,           // mean blade profile-drag coefficient (estimate)
  kappa: 1.12,           // induced-power factor: non-uniform inflow and tip losses (estimate)
  liftSlope: 5.73,       // blade-section lift-curve slope, per radian
  bladeMass: 120,        // kg per blade (estimate) for the rotor's stored energy
  hubHeight: 3.33,       // m, rotor hub above the ground on static oleos (from the 3.76 m rotor-head height)
  // tail rotor: 3.35 m diameter, 4 blades, canted 20° (published); 1,190 rpm and 0.247 m chord (GenHel data)
  tr: { R: 1.676, blades: 4, chord: 0.247, rpm: 1190, arm: 9.93, cant: 20, Cd0: 0.010, kappa: 1.2 },
  fin: { area: 3.0, cl: 0.2 },  // cambered pylon: side force that unloads the tail rotor at speed (estimate)
  f: 2.7,                // equivalent flat-plate drag area, m², clean aircraft incl. rotor hub (estimate)
  download: 0.05,        // hover download on the fuselage as a fraction of weight (estimate)
  transEff: 0.975,       // gearbox efficiency (estimate)
  accessoriesKW: 45,     // generators, hydraulic pumps, oil-cooler blower (estimate)
  engines: 2,
  ratings: { contingency: 2000, max: 1994, irp: 1902, mcp: 1716 },  // shp per engine, GE T700-701D datasheet
  install: 0.97,         // installed losses: inlet particle separator and IR suppressor (estimate)
  lapse: 1.5,            // power ∝ δ·θ^(−1.5) at fixed turbine temperature (estimate)
  lapseCap: 1.05,        // cold-day power growth stops at the engine's torque/speed limits (estimate)
  transLimit: 3400,      // shp, dual-engine main-transmission rating (UH-60L/M)
  mtow: 9979, mtowExternal: 10660, empty: 5675,   // kg (Sikorsky: 22,000 / 23,500 / 12,511 lb)
  mDrag: 0.85,           // advancing-tip Mach where compressibility drag starts to bite (estimate)
  compressibility: 220,  // empirical power-rise coefficient beyond mDrag (estimate)
  tipMachLimit: 0.92,    // advancing-tip limit used as a speed boundary (estimate, swept tip)
  stall: [0.13, 0.21],   // retreating-blade boundary (CT/σ)max ≈ 0.13 − 0.21 μ² (McHugh-type fit, estimate)
};

/** Rotor geometry derived from the data: disc area, rotational speed, tip speed, solidity. */
export function rotorGeometry(r = UH60) {
  const A = Math.PI * r.R * r.R;
  const omega = (r.rpm * 2 * Math.PI) / 60;
  return { A, omega, vtip: omega * r.R, sigma: (r.blades * r.chord) / (Math.PI * r.R) };
}

/**
 * Air data at a pressure altitude with a temperature deviation from ISA.
 * Returns density, temperature, speed of sound, δ = p/p0, θ = T/T0 and density altitude.
 */
export function airData(pressureAltitude = 0, isaDev = 0) {
  const s = isa(pressureAltitude);
  const T = s.T + isaDev;
  const rho = s.p / (R_AIR * T);
  const sig = rho / RHO_SL;
  // troposphere: ρ/ρ0 = (1 − L·h/T0)^4.2559  →  h = (T0/L)(1 − σ^0.23497)
  const densityAltitude = (T_SL / 0.0065) * (1 - Math.pow(sig, 0.234969));
  return { p: s.p, T, rho, a: Math.sqrt(GAMMA_AIR * R_AIR * T), delta: s.p / P_SL, theta: T / T_SL, sigma: sig, densityAltitude, oatC: T - 273.15 };
}

/** Ideal hover induced velocity v_h = √(T / 2ρA). */
export const hoverInducedVelocity = (T, rho, A) => Math.sqrt(T / (2 * rho * A));

/**
 * Glauert's forward-flight induced velocity for a lightly tilted disc: v⁴ + V²v² = v_h⁴.
 * Equals v_h in the hover and tends to v_h²/V at speed.
 */
export function inducedVelocity(vh, V = 0) {
  if (!(V > 0)) return vh;
  const V2 = V * V;
  return Math.sqrt((-V2 + Math.sqrt(V2 * V2 + 4 * vh ** 4)) / 2);
}

/** Vertical-climb induced velocity from momentum theory: v = −Vc/2 + √((Vc/2)² + v_h²). */
export const climbInducedVelocity = (vh, Vc) => -Vc / 2 + Math.sqrt((Vc * Vc) / 4 + vh * vh);

/**
 * Ground-effect factor on induced power (Cheeseman & Bennett): 1 − (R/4z)² near the ground,
 * fading with forward speed as 1/(1 + (V/v)²). z is the rotor height above the ground.
 */
export function groundEffect(R, z, V = 0, vi = 1) {
  if (!Number.isFinite(z) || z <= 0) return 1;
  const g = Math.min(0.25, (R / (4 * z)) ** 2);
  return 1 - g / (1 + (V / Math.max(vi, 0.1)) ** 2);
}

/** Empirical compressibility power penalty once the advancing tip passes mDrag. */
function compressibilityPower(P0hover, mAdv, r = UH60) {
  const dm = mAdv - r.mDrag;
  return dm > 0 ? P0hover * r.compressibility * dm * dm : 0;
}

/**
 * Power of a single rotor producing `thrust` at forward speed V (edgewise) or climb rate Vc.
 * Returns components in W and the non-dimensional coefficients.
 */
export function rotorPower({ thrust, rho, a = 340.3, V = 0, Vc = 0, groundZ = Infinity, alphaDisc = 0, rotor = UH60, compress = true }) {
  const { A, omega, vtip, sigma } = rotorGeometry(rotor);
  const vh = hoverInducedVelocity(Math.max(thrust, 1), rho, A);
  const mu = V / vtip;
  const vi = V > 0 ? inducedVelocity(vh, V) : climbInducedVelocity(vh, Math.max(0, Vc));
  const kG = groundEffect(rotor.R, groundZ, V, vi);
  const induced = rotor.kappa * thrust * vi * kG;
  const P0hover = ((sigma * rotor.Cd0) / 8) * rho * A * vtip ** 3;
  const mAdv = (vtip + V) / a;
  const profile = P0hover * (1 + 4.65 * mu * mu) + (compress ? compressibilityPower(P0hover, mAdv, rotor) : 0);
  const climb = thrust * Math.max(0, Vc);
  const CT = thrust / (rho * A * vtip * vtip);
  // collective at 0.75 R from blade-element/momentum trim: CT = (σa/2)[θ.75(1/3 + μ²/2) − λ/2]
  const lambda = (V * Math.sin(alphaDisc) + vi * kG + Math.max(0, Vc)) / vtip;
  const theta75 = ((2 * CT) / (sigma * rotor.liftSlope) + lambda / 2) / (1 / 3 + (mu * mu) / 2);
  return {
    A, omega, vtip, sigma, vh, vi, mu, kG, induced, profile, climb, P0hover,
    total: induced + profile + climb, ideal: thrust * vh, CT, CTs: CT / sigma, lambda, theta75, mAdv, torque: (induced + profile + climb) / omega,
  };
}

/** Figure of merit from the hover breakdown: ideal power / actual power. */
export const figureOfMerit = (h) => h.ideal / (h.induced + h.profile);

/**
 * Total shaft power the engines must deliver for the whole aircraft in level flight (V, m/s),
 * vertical climb (Vc, m/s) or a hover at wheel height `wheelHeight` (m; Infinity = out of ground effect).
 */
export function powerRequired({ mass, pressureAltitude = 0, isaDev = 0, V = 0, Vc = 0, wheelHeight = Infinity, compress = true, r = UH60 } = {}) {
  const air = airData(pressureAltitude, isaDev);
  const { rho } = air;
  const W = mass * G0;
  const dl = r.download / (1 + (V / 8) ** 2);          // download fades quickly once the wake blows aft
  const D = 0.5 * rho * V * V * r.f;                    // airframe parasite drag
  const groundZ = Number.isFinite(wheelHeight) ? r.hubHeight + wheelHeight : Infinity;
  const trG = rotorGeometry(r.tr);
  const mrG = rotorGeometry(r);
  const cant = r.tr.cant * DEG;
  const finForce = 0.5 * rho * V * V * r.fin.area * r.fin.cl;
  let Ttr = 0, Tyaw = 0, mr = null, tr = null, Tmr = 0, Pmr = 0, parasite = 0;
  for (let it = 0; it < 4; it++) {
    const lift = W * (1 + dl) - Ttr * Math.sin(cant);   // the canted tail rotor lifts the tail
    Tmr = Math.hypot(lift, D);                         // the disc tilts forward to balance drag
    mr = rotorPower({ thrust: Tmr, rho, a: air.a, V, Vc, groundZ, alphaDisc: Math.atan2(D, lift), rotor: r, compress });
    parasite = D * V;
    Pmr = mr.total + parasite;
    // yaw balance: the tail rotor's lateral thrust × arm = main-rotor torque, less the fin's share
    Tyaw = Math.max(0, Pmr / mrG.omega / r.tr.arm - finForce);
    Ttr = Tyaw / Math.cos(cant);
  }
  tr = rotorPower({ thrust: Math.max(Ttr, 1), rho, a: air.a, V, groundZ: Infinity, rotor: r.tr, compress: false });
  const Ptr = Ttr > 1 ? tr.total : tr.profile;
  const rotors = Pmr + Ptr;
  const total = rotors / r.transEff + r.accessoriesKW * 1000;
  return {
    air, W, mass, V, Vc, D, dl, Tmr, Ttr, Tyaw, finForce, mr, tr,
    induced: mr.induced, profile: mr.profile, parasite, climb: mr.climb,
    mainRotor: Pmr, tailRotor: Ptr, losses: rotors / r.transEff - rotors, accessories: r.accessoriesKW * 1000,
    total, shp: total / SHP,
    diskLoadingN: W / mrG.A, diskLoadingKg: mass / mrG.A,
    tipMach: mrG.vtip / air.a, advancingTipMach: (mrG.vtip + V) / air.a,
  };
}

/**
 * Engine power available (shp at the transmission input) at an altitude and temperature.
 * rating: 'contingency' | 'max' | 'irp' | 'mcp'. oei: one engine inoperative (the survivor at contingency).
 */
export function powerAvailable({ pressureAltitude = 0, isaDev = 0, rating = 'irp', oei = false, r = UH60 } = {}) {
  const air = airData(pressureAltitude, isaDev);
  const lapse = Math.min(r.lapseCap, air.delta * Math.pow(air.theta, -r.lapse));
  const perEngine = r.ratings[oei ? 'contingency' : rating] * lapse * r.install;
  const engines = oei ? perEngine : r.engines * perEngine;
  const shp = Math.min(engines, r.transLimit);
  return { shp, W: shp * SHP, perEngine, engines, lapse, limit: engines > r.transLimit ? 'transmission' : 'engines' };
}

/** Bisection for the root of a decreasing function on [lo, hi]. */
function bisect(fn, lo, hi, tol = 0.5) {
  let flo = fn(lo);
  if (flo <= 0) return lo;
  if (fn(hi) > 0) return hi;
  for (let i = 0; i < 60 && hi - lo > tol; i++) {
    const mid = 0.5 * (lo + hi);
    const fm = fn(mid);
    if (fm > 0) { lo = mid; flo = fm; } else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/**
 * Hover ceiling: the highest pressure altitude (m) at which power available covers hover power
 * required, out of ground effect (wheelHeight Infinity) or in it (10 ft = 3.05 m wheel height).
 * Returns -Infinity if the aircraft cannot hover even at −500 m, Infinity above 9 km.
 */
export function hoverCeiling({ mass, isaDev = 0, wheelHeight = Infinity, rating = 'irp', oei = false, r = UH60 } = {}) {
  const margin = (h) => powerAvailable({ pressureAltitude: h, isaDev, rating, oei, r }).W - powerRequired({ mass, pressureAltitude: h, isaDev, wheelHeight, r }).total;
  if (margin(-500) < 0) return -Infinity;
  if (margin(9000) > 0) return Infinity;
  return bisect(margin, -500, 9000, 2);
}

/** Power required versus airspeed, 0 → vmaxKt in steps (for the chart and the speed schedule). */
export function powerCurve(cond, { vmaxKt = 190, stepKt = 2 } = {}) {
  const out = [];
  for (let kt = 0; kt <= vmaxKt + 1e-9; kt += stepKt) {
    const p = powerRequired({ ...cond, V: kt * KT });
    out.push({ kt, V: kt * KT, total: p.total, shp: p.shp, induced: p.induced, profile: p.profile, parasite: p.parasite, tailRotor: p.tailRotor, mainRotor: p.mainRotor, p });
  }
  return out;
}

/** Golden-section minimum of fn on [a, b]. */
function goldenMin(fn, a, b, tol = 0.05) {
  const g = (Math.sqrt(5) - 1) / 2;
  let c = b - g * (b - a), d = a + g * (b - a);
  let fc = fn(c), fd = fn(d);
  while (b - a > tol) {
    if (fc < fd) { b = d; d = c; fd = fc; c = b - g * (b - a); fc = fn(c); }
    else { a = c; c = d; fc = fd; d = a + g * (b - a); fd = fn(d); }
  }
  return 0.5 * (a + b);
}

/**
 * Speeds that matter: best endurance (minimum power), best range (minimum power per unit speed,
 * the tangent from the origin), and the maximum level speed with the limit that sets it —
 * power available, advancing-tip Mach or retreating-blade stall.
 */
export function speedSchedule(cond, { rating = 'mcp', oei = false, r = UH60 } = {}) {
  const P = (V) => powerRequired({ ...cond, V, r }).total;
  const vbe = goldenMin(P, 5, 75);
  const vbr = goldenMin((V) => P(V) / V, vbe, 105);
  const avail = powerAvailable({ pressureAltitude: cond.pressureAltitude, isaDev: cond.isaDev, rating, oei, r });
  const pmin = P(vbe);
  const top = 110;   // m/s, search ceiling (214 kt)
  const vPower = avail.W < pmin ? 0 : bisect((V) => avail.W - P(V), vbe, top, 0.05);
  const air = airData(cond.pressureAltitude, cond.isaDev);
  const { vtip, sigma, A } = rotorGeometry(r);
  const vTip = Math.max(0, r.tipMachLimit * air.a - vtip);
  // retreating-blade stall: required blade loading against the boundary (CT/σ)max(μ)
  const stallMargin = (V) => {
    const p = powerRequired({ ...cond, V, r });
    const CTs = p.Tmr / (air.rho * A * vtip * vtip * sigma);
    const mu = V / vtip;
    return r.stall[0] - r.stall[1] * mu * mu - CTs;
  };
  const vStall = stallMargin(0) < 0 ? 0 : bisect(stallMargin, 0, top, 0.05);
  const limits = [['power available', vPower], ['advancing-tip Mach', vTip], ['retreating-blade stall', vStall]];
  limits.sort((x, y) => x[1] - y[1]);
  return { vbe, vbr, pmin, avail, vPower, vTip, vStall, vmax: limits[0][1], limit: limits[0][0] };
}

/**
 * Steady autorotation, energy method: with no engine power the descent must supply what the main
 * rotor needs at that speed, plus the accessories it still drives: ROD ≈ k·(P_mr + P_acc)/W.
 * k = 1.1 covers the non-ideal inflow of a windmilling rotor (estimate).
 */
export function autorotation(cond, { r = UH60, k = 1.1 } = {}) {
  const rod = (V) => {
    const p = powerRequired({ ...cond, V, r });
    return (k * (p.mainRotor + p.accessories)) / p.W;
  };
  const vMin = goldenMin(rod, 10, 80);
  const vGlide = goldenMin((V) => rod(V) / V, vMin, 95);
  const at = (V) => rod(V);
  return { rod: at(cond.V ?? 0), vMinRod: vMin, minRod: rod(vMin), vBestGlide: vGlide, glideRatio: vGlide / rod(vGlide), at };
}

/**
 * Rotor stored energy and how long it lasts if both engines quit with the collective held:
 * time for rotor speed to fall to `toFraction` of 100 % with the rotors still absorbing P.
 */
export function rotorEnergy(powerW, { toFraction = 0.8, r = UH60 } = {}) {
  const { omega } = rotorGeometry(r);
  const I = r.blades * r.bladeMass * r.R * r.R / 3;        // uniform blade about the shaft
  const E = 0.5 * I * omega * omega;
  return { I, E, seconds: ((1 - toFraction * toFraction) * E) / Math.max(1, powerW) };
}

/** Maximum vertical rate of climb (m/s) out of ground effect from the power margin. */
export function verticalClimb({ mass, pressureAltitude = 0, isaDev = 0, rating = 'irp', oei = false, r = UH60 } = {}) {
  const avail = powerAvailable({ pressureAltitude, isaDev, rating, oei, r }).W;
  const req = (Vc) => powerRequired({ mass, pressureAltitude, isaDev, Vc, r }).total;
  if (req(0) > avail) return 0;
  return bisect((Vc) => avail - req(Vc), 0, 40, 0.01);
}

/** Stabilator incidence schedule (deg, trailing edge down positive) versus airspeed (approximate). */
export function stabilatorSchedule(kt) {
  if (kt <= 30) return 40;
  const s = Math.min(1, (kt - 30) / 120);
  return -2 + 42 * (1 - s) * (1 - s);
}

/** Everything the lab shows for one condition. */
export function heliPerformance({ mass = 7700, pressureAltitude = 0, isaDev = 0, V = 0, oei = false } = {}) {
  const cond = { mass, pressureAltitude, isaDev };
  const air = airData(pressureAltitude, isaDev);
  const hogeP = powerRequired({ ...cond, V: 0 });
  const higeP = powerRequired({ ...cond, V: 0, wheelHeight: 3.05 });
  const fwd = powerRequired({ ...cond, V });
  const irp = powerAvailable({ pressureAltitude, isaDev, rating: 'irp', oei });
  const mcp = powerAvailable({ pressureAltitude, isaDev, rating: oei ? 'contingency' : 'mcp', oei });
  const sched = speedSchedule(cond, { rating: oei ? 'contingency' : 'mcp', oei });
  const auto = autorotation({ ...cond, V });
  return {
    air, hoverOGE: hogeP, hoverIGE: higeP, fwd, irp, mcp, sched, auto,
    FM: figureOfMerit(hogeP.mr),
    ceilingOGE: hoverCeiling({ mass, isaDev, rating: 'irp', oei }),
    ceilingIGE: hoverCeiling({ mass, isaDev, rating: 'irp', oei, wheelHeight: 3.05 }),
    vroc: verticalClimb({ mass, pressureAltitude, isaDev, oei }),
    energy: rotorEnergy(fwd.mainRotor + fwd.tailRotor),
    canHoverOGE: irp.W >= hogeP.total, canHoverIGE: irp.W >= higeP.total,
    overweight: mass > UH60.mtow, overExternal: mass > UH60.mtowExternal,
  };
}
