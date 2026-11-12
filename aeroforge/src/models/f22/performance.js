// F-22A performance model used by the lab (three.js-free, so the tests can import it).
//
// It builds on the shared conceptual aero model (src/physics/aero.js) with two F-22-specific
// refinements:
//   1. F119 dry thrust at supersonic speed. The shared thrust() lapses every engine's thrust as
//      σ^0.78 with altitude. A supercruise engine breathes air that the inlet has already ram-
//      compressed (at Mach 1.76 and 12 km the inlet total pressure is about sea-level static), so
//      its dry thrust falls off far less: here the dry lapse eases to σ^0.55 above Mach 1.4
//      (blended from Mach 0.9), capped at 80 % of full-afterburner thrust. Afterburning thrust is
//      left as the shared model has it.
//   2. Post-stall lift starts from the lift the wing actually had at the stall, min(a·α_stall,
//      CLmax), and decays from there, so lift never jumps up when the wing stalls.
// It also applies the published dynamic-pressure limit (q ≈ 104 kPa, Mach 1.21 at sea level).

import { flightState, thrust, liftSlope, cd0, inducedK, FIGHTER } from '../../physics/aero.js';
import { isa, G0 } from '../../physics/atmosphere.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const MIL = 0.8;

/** Installed thrust of both F119s (N) for throttle 0..1 (0.8 = military power, 1 = max A/B). */
export function installedThrust(throttle, mach, altitude) {
  const base = thrust(throttle, mach, altitude);
  const dryShared = thrust(Math.min(throttle, MIL), mach, altitude);
  const { sigma } = isa(altitude);
  const k = smooth(0.9, 1.4, mach);
  // dry thrust never exceeds ~80 % of full afterburner (the F119's 116 / 156 kN is 74 % at sea level)
  const dryF119 = Math.max(dryShared, Math.min(dryShared * Math.pow(sigma, -(0.78 - FIGHTER.dryLapseSupersonic) * k), 0.8 * thrust(1, mach, altitude)));
  const dryWeight = throttle <= MIL ? 1 : 1 - (throttle - MIL) / (1 - MIL);
  return base + (dryF119 - dryShared) * dryWeight;
}

/** Full flight condition at an angle of attack (deg): the shared solution with the refinements above. */
export function flight({ altitude, mach, alpha, throttle, mass = FIGHTER.massCombat }) {
  const f = flightState({ altitude, mach, alpha, throttle, mass });
  let { cl, cd, L, D, n } = f;
  const S = FIGHTER.wingArea, W = mass * G0;
  if (f.stalled) {
    const atStall = Math.min(liftSlope(mach) * (FIGHTER.alphaStall * Math.PI) / 180, FIGHTER.clMax);
    cl = atStall * Math.max(0.55, 1 - (alpha - FIGHTER.alphaStall) * 0.04);
    cd = cd0(mach) + inducedK(mach) * cl * cl + 0.25;
    L = f.q * S * cl; D = f.q * S * cd; n = L / W;
  }
  const T = installedThrust(throttle, mach, altitude);
  return {
    ...f, cl, cd, L, D, n, T,
    lOverD: cd > 0 ? cl / cd : 0,
    ps: (f.V * (T - D)) / W,
    overG: n > FIGHTER.gLimit || n < FIGHTER.gNegLimit,
    overQ: f.q > FIGHTER.qMax,
  };
}

/** Specific excess power in 1 g level flight over a Mach sweep; NaN where 1 g needs more than CLmax or q exceeds its limit. */
export function psCurve({ altitude, throttle, mass = FIGHTER.massCombat, from = 0.2, to = 2.5, steps = 92 }) {
  const atm = isa(altitude);
  const S = FIGHTER.wingArea, W = mass * G0;
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const M = from + ((to - from) * i) / steps;
    const V = M * atm.a;
    const q = 0.5 * atm.rho * V * V;
    const clReq = W / (q * S);
    const ok = clReq <= FIGHTER.clMax && q <= FIGHTER.qMax;
    const D = q * S * (cd0(M) + inducedK(M) * clReq * clReq);
    out.push({ mach: M, ps: ok ? (V * (installedThrust(throttle, M, altitude) - D)) / W : NaN });
  }
  return out;
}

/** Fastest Mach with Ps ≥ 0 in 1 g level flight (thrust- or q-limited), or NaN. */
export function maxLevelMach(altitude, throttle, mass = FIGHTER.massCombat) {
  const c = psCurve({ altitude, throttle, mass, steps: 460 }).filter((p) => p.ps >= 0);
  return c.length ? c[c.length - 1].mach : NaN;
}

/** Angle of attack (deg, 0.1° steps) for 1 g level flight at a condition. */
export function trimAlpha({ altitude, mach }, mass = FIGHTER.massCombat) {
  const atm = isa(altitude);
  const V = mach * atm.a;
  const q = 0.5 * atm.rho * V * V;
  return Math.round(((mass * G0) / (q * FIGHTER.wingArea * liftSlope(mach))) * (180 / Math.PI) * 10) / 10;
}
