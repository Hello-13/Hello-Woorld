// Two-body orbital mechanics: circular orbits, Hohmann transfers with a combined
// apoapsis plane change, Kepler's equation and the rocket equation for propellant budgets.

import { G0 } from './atmosphere.js';

export const MU = 398600.4418;   // km³/s²
export const RE = 6378.137;      // km, equatorial radius
export const GEO_ALT = 35786;    // km
export const C_LIGHT = 299792.458;          // km/s
export const W0_GEOID = 62636856.0;         // m²/s², gravity + rotation potential on the geoid (IERS 2010)
export const SIDEREAL_DAY = 86164.0905;     // s

export const circularVelocity = (r) => Math.sqrt(MU / r);
export const period = (a) => 2 * Math.PI * Math.sqrt((a ** 3) / MU);

/**
 * Hohmann transfer between circular orbits at altitudes h1 → h2 (km), with an
 * inclination change di (deg) performed at the second burn (cheapest place, lowest speed).
 */
export function hohmann(h1, h2, di = 0) {
  const r1 = RE + h1, r2 = RE + h2;
  const at = (r1 + r2) / 2;
  const v1 = circularVelocity(r1);
  const v2 = circularVelocity(r2);
  const vp = Math.sqrt(MU * (2 / r1 - 1 / at));
  const va = Math.sqrt(MU * (2 / r2 - 1 / at));
  const dRad = (di * Math.PI) / 180;
  const dv1 = Math.abs(vp - v1);
  const dv2 = Math.sqrt(va * va + v2 * v2 - 2 * va * v2 * Math.cos(dRad));
  const dv2Coplanar = Math.abs(v2 - va);
  return {
    r1, r2, at, v1, v2, vp, va,
    e: Math.abs(r2 - r1) / (r1 + r2),
    dv1, dv2, dvTotal: dv1 + dv2,
    dvPlaneChange: dv2 - dv2Coplanar,
    tof: Math.PI * Math.sqrt((at ** 3) / MU),      // s
    period1: period(r1), period2: period(r2),
  };
}

/** Propellant (kg) to deliver dv (km/s) from initial mass m0 (kg) with specific impulse isp (s). */
export function propellantFor(dv, m0, isp) {
  return m0 * (1 - Math.exp(-(dv * 1000) / (isp * G0)));
}

/**
 * Rate of a clock in a circular orbit at altitude h (km) relative to an identical clock on the
 * geoid, from the weak-field metric: the gravitational term (W₀ − μ/r)/c² makes the orbiting clock
 * run fast, the velocity term −v²/2c² (special relativity, v² = μ/r) makes it run slow.
 * Returns fractional rates and the same in µs per day (positive = the satellite clock gains).
 */
export function clockRelativity(h) {
  const mu = MU * 1e9, c2 = (C_LIGHT * 1e3) ** 2;   // SI
  const r = (RE + h) * 1e3;
  const grav = (W0_GEOID - mu / r) / c2;
  const vel = -mu / (2 * r * c2);
  const net = grav + vel;
  const usDay = (x) => x * 86400 * 1e6;
  return { grav, vel, net, gravUs: usDay(grav), velUs: usDay(vel), netUs: usDay(net) };
}

/** Altitude (km) at which the two relativistic effects cancel: r = 3μ / 2W₀. */
export const clockCrossoverAlt = () => (1.5 * MU * 1e9) / W0_GEOID / 1e3 - RE;

/** Solve Kepler's equation M = E − e·sinE for the eccentric anomaly (Newton–Raphson). */
export function solveKepler(M, e) {
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 30; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

/** True anomaly and radius on an ellipse (a, e) at time t after periapsis (s). */
export function positionOnEllipse(a, e, t) {
  const n = Math.sqrt(MU / (a ** 3));
  const M = (n * t) % (2 * Math.PI);
  const E = solveKepler(M, e);
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const r = a * (1 - e * Math.cos(E));
  return { nu, r, E };
}
