// Conceptual-design aerodynamics for a fifth-generation fighter.
// Lift slope: DATCOM / Helmbold subsonic, linear supersonic theory, blended transonic.
// Drag: parabolic polar with Mach-dependent zero-lift drag (wave drag rise).

import { isa, G0, recoveryTemperature } from './atmosphere.js';

// F-22A Raptor reference data (USAF fact sheet, Lockheed Martin product card, P&W F119 data).
export const FIGHTER = {
  wingArea: 78.04,          // m² (840 ft²)
  span: 13.56,              // m (44 ft 6 in)
  sweepHalfChord: 0.288,    // rad (16.5°): from 42° LE / −17° TE sweep, AR 2.36, taper 0.169
  massCombat: 29410,        // kg, typical combat / gross weight (64,840 lb)
  thrustMilSL: 2 * 116e3,   // N, dry (2 × F119-PW-100, ≈ 26,000 lbf class)
  thrustMaxSL: 2 * 156e3,   // N, full afterburner (2 × 35,000 lbf class)
  clMax: 1.6,               // matches liftSlope(0.3) × alphaStall, so lift peaks at the stall and then falls
  alphaStall: 32,           // deg, wing with leading-edge flaps; thrust vectoring lets the jet fly far beyond it
  gLimit: 9,                // +9 / −3 g
  // published figures the lab and tests compare the model against (not used by the equations)
  massEmpty: 19700,         // kg (43,340 lb)
  massMaxTakeoff: 38000,    // kg (83,500 lb)
  fuelInternal: 8200,       // kg (18,000 lb)
  machMax: 2.25,            // at altitude
  machSeaLevel: 1.21,       // 800 kt, a structural / dynamic-pressure limit
  machSupercruise: 1.76,    // at altitude, military power
  ceiling: 19812,           // m (65,000 ft)
  gNegLimit: -3,
  tvcDeg: 20,               // 2-D nozzles vector ±20° in pitch
  qMax: 103.9e3,            // Pa, dynamic-pressure limit (Mach 1.21 = 800 kt at sea level)
  dryLapseSupersonic: 0.55, // F119 dry-thrust density lapse exponent above Mach 1.4 (ram recovery), vs 0.78
};

const AR = (FIGHTER.span ** 2) / FIGHTER.wingArea;
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Lift-curve slope per radian. */
export function liftSlope(mach) {
  const sub = (m) => {
    const beta2 = Math.max(0.05, 1 - m * m);
    const k = 0.95;
    const tanL = Math.tan(FIGHTER.sweepHalfChord);
    return (2 * Math.PI * AR) /
      (2 + Math.sqrt(4 + ((AR * AR * beta2) / (k * k)) * (1 + (tanL * tanL) / beta2)));
  };
  const sup = (m) => 4 / Math.sqrt(m * m - 1);
  if (mach <= 0.85) return sub(mach);
  if (mach >= 1.25) return Math.min(sup(mach), sub(0.85));
  const t = smooth(0.85, 1.25, mach);
  return sub(0.85) * (1 - t) + Math.min(sup(1.25), sub(0.85)) * t;
}

/** Zero-lift drag coefficient vs Mach (transonic wave-drag rise peaking near M 1.1). */
export function cd0(mach) {
  const base = 0.0165;
  const rise = 0.026 * smooth(0.82, 1.08, mach);
  const decay = 0.001 * smooth(1.2, 2.2, mach);
  return base + rise - decay;
}

/** Induced-drag factor K in CD = CD0 + K·CL². */
export function inducedK(mach) {
  const sub = 1 / (Math.PI * AR * 0.82);
  if (mach < 0.9) return sub;
  return sub + 0.09 * smooth(0.9, 2.0, mach) * Math.min(1.5, mach - 0.9 + 0.3);
}

/** Installed thrust (N) for a throttle 0..1, where 0.8 = military power and 1 = max afterburner. */
export function thrust(throttle, mach, altitude) {
  const { sigma } = isa(altitude);
  const lapse = Math.pow(sigma, 0.78);
  const milFrac = Math.min(throttle, 0.8) / 0.8;
  const dry = FIGHTER.thrustMilSL * (0.06 + 0.94 * milFrac) * lapse * (1 + 0.18 * mach);
  if (throttle <= 0.8) return dry;
  const ab = (throttle - 0.8) / 0.2;
  const wet = FIGHTER.thrustMaxSL * lapse * (1 + 0.52 * mach);
  return dry + (wet - dry) * ab;
}

/** Full flight-condition solution at a given angle of attack (deg). */
export function flightState({ altitude, mach, alpha, throttle, mass = FIGHTER.massCombat }) {
  const atm = isa(altitude);
  const V = mach * atm.a;
  const q = 0.5 * atm.rho * V * V;
  const a = liftSlope(mach);
  const alphaRad = (alpha * Math.PI) / 180;
  let cl = a * alphaRad;
  let stalled = false;
  if (alpha > FIGHTER.alphaStall) {
    stalled = true;
    const over = alpha - FIGHTER.alphaStall;
    cl = FIGHTER.clMax * Math.max(0.55, 1 - over * 0.04);
  } else {
    cl = Math.min(cl, FIGHTER.clMax);
  }
  const cd = cd0(mach) + inducedK(mach) * cl * cl + (stalled ? 0.25 : 0);
  const S = FIGHTER.wingArea;
  const W = mass * G0;
  const L = q * S * cl;
  const D = q * S * cd;
  const T = thrust(throttle, mach, altitude);
  const n = L / W;
  return {
    atm, V, q, cl, cd, L, D, T, n, stalled,
    lOverD: cd > 0 ? cl / cd : 0,
    ps: (V * (T - D)) / W,                    // specific excess power, m/s
    stagnationT: recoveryTemperature(atm.T, mach, 0.89),
    overG: n > FIGHTER.gLimit || n < -3,
  };
}

/** Specific excess power in 1-g level flight across a Mach sweep (energy-maneuverability chart). */
export function psSweep({ altitude, throttle, mass = FIGHTER.massCombat, from = 0.2, to = 2.5, steps = 92 }) {
  const atm = isa(altitude);
  const S = FIGHTER.wingArea;
  const W = mass * G0;
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const M = from + ((to - from) * i) / steps;
    const V = M * atm.a;
    const q = 0.5 * atm.rho * V * V;
    const clReq = W / (q * S);
    const feasible = clReq <= FIGHTER.clMax;
    const cd = cd0(M) + inducedK(M) * clReq * clReq;
    const D = q * S * cd;
    const T = thrust(throttle, M, altitude);
    out.push({ mach: M, ps: feasible ? (V * (T - D)) / W : NaN });
  }
  return out;
}
