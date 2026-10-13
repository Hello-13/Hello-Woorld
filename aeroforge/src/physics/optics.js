// Telescope optics and low-orbit relations for the Hubble lab and model.
//
//  · diffraction:      θ = 1.22 λ / D  (Rayleigh criterion, first dark ring of the Airy pattern)
//  · seeing:           ground-based blur from turbulence, ∝ λ^(−1/5) (Kolmogorov)
//  · light grasp:      collecting area ∝ D² (minus the central obscuration)
//  · plate scale:      206 265″ / f  (arc-seconds per unit length at the focal plane)
//  · two-mirror (Ritchey–Chrétien) geometry: secondary magnification, back focus and the conic
//    constants that cancel spherical aberration and coma (Schroeder, Astronomical Optics, §6)
//  · drag decay of a circular orbit through an exponential thermosphere (illustrative)
//
// Units: SI (metres, seconds, radians) unless a name says otherwise.

import { MU, RE } from './orbital.js';

export const ARCSEC_PER_RAD = (180 * 3600) / Math.PI;   // 206 264.806″
export const toArcsec = (rad) => rad * ARCSEC_PER_RAD;
export const fromArcsec = (as) => as / ARCSEC_PER_RAD;

/** Hubble's Optical Telescope Assembly (NASA / Perkin-Elmer design values). */
export const HST_OTA = {
  D: 2.4,              // primary aperture (m)
  D2: 0.3,             // secondary mirror diameter (m)
  obscuration: 0.33,   // central obstruction, fraction of the aperture diameter
  F: 57.6,             // system focal length (m), f/24
  R1: 11.04,           // primary radius of curvature (m): f1 = 5.52 m, f/2.3
  d: 4.906,            // primary–secondary vertex separation (m)
  K1asBuilt: -1.0139,  // primary conic as polished (the 1990 flaw)
};

/** Rayleigh diffraction limit (rad) for wavelength λ (m) and aperture D (m). */
export const diffractionLimit = (lambda, D) => (1.22 * lambda) / D;

/** Rayleigh limit in arc-seconds for λ in nanometres. */
export const rayleighArcsec = (lambdaNm, D) => toArcsec(diffractionLimit(lambdaNm * 1e-9, D));

/** Full width at half maximum of the Airy core (″), ≈ 1.03 λ / D. */
export const airyFwhmArcsec = (lambdaNm, D) => toArcsec((1.029 * lambdaNm * 1e-9) / D);

/** Ground seeing (″) at λ given the seeing at 500 nm: FWHM ∝ λ / r0 and r0 ∝ λ^(6/5). */
export const seeingAt = (lambdaNm, seeing500) => seeing500 * (lambdaNm / 500) ** -0.2;

/** Image size actually delivered: diffraction and seeing added in quadrature (a common rule of thumb). */
export const deliveredArcsec = (lambdaNm, D, seeing500 = 0) => Math.hypot(rayleighArcsec(lambdaNm, D), seeing500 ? seeingAt(lambdaNm, seeing500) : 0);

/** Collecting area (m²) of a circular aperture with a central obstruction (fraction of D). */
export const collectingArea = (D, obscuration = 0) => (Math.PI / 4) * D * D * (1 - obscuration * obscuration);

/** Light-gathering ratio of aperture D1 over D2 (unobstructed). */
export const lightGrasp = (D1, D2) => (D1 / D2) ** 2;

/** Limiting-magnitude gain of D1 over D2 for the same exposure: 5 log10(D1 / D2). */
export const magnitudeGain = (D1, D2) => 5 * Math.log10(D1 / D2);

/** Plate scale (″ per millimetre) at the focus of a telescope with focal length f (m). */
export const plateScale = (f) => ARCSEC_PER_RAD / (f * 1000);

/** Diameter of the Airy disk to its first dark ring (m): 2.44 λ N. */
export const airyDiskDiameter = (lambda, N) => 2.44 * lambda * N;

/** Smallest feature (m) resolved at distance r (m) with angular resolution θ (rad), small angle. */
export const linearResolution = (r, theta) => r * theta;

/** Sag of a conic surface z(r) = r² / (R (1 + √(1 − (1 + K) r² / R²))). */
export function conicSag(r, R, K = 0) {
  const c = 1 / R;
  return (c * r * r) / (1 + Math.sqrt(Math.max(0, 1 - (1 + K) * c * c * r * r)));
}

/**
 * Two-mirror Cassegrain-family telescope from the primary focal length f1, the system focal
 * length F and the mirror separation d (all m, positive).
 * Returns the secondary magnification m, the distance from the secondary to the primary focus p,
 * the back focal distance behind the primary vertex b, the secondary's radius of curvature R2,
 * the ray-height ratio k (secondary / primary) and the Ritchey–Chrétien conic constants K1, K2.
 */
export function cassegrain({ f1, F, d }) {
  const m = F / f1;
  const p = f1 - d;                   // primary focus lies p beyond the secondary
  const s2 = m * p;                   // secondary → final focus
  const b = s2 - d;                   // final focus behind the primary vertex
  const f2 = (p * s2) / (s2 - p);     // convex secondary focal length (magnitude)
  const beta = b / f1;
  const K1 = -1 - (2 * (1 + beta)) / (m * m * (m - beta));
  const K2 = -(((m + 1) / (m - 1)) ** 2) - (2 * m * (m + 1)) / ((m - beta) * (m - 1) ** 3);
  return { m, p, s2, b, f2, R2: 2 * f2, k: p / f1, beta, K1, K2, N: null };
}

/** Hubble's design solved from its published f1, F and d. */
export function hubbleDesign() {
  const o = HST_OTA;
  const c = cassegrain({ f1: o.R1 / 2, F: o.F, d: o.d });
  return { ...c, N: o.F / o.D, f1: o.R1 / 2, plate: plateScale(o.F) };
}

/**
 * Surface error at radius r (m) of a mirror polished to conic Kbuilt instead of Kdesign.
 * Positive means the as-built surface lies below the design (too flat toward the edge).
 */
export const conicError = (r, R, Kdesign, Kbuilt) => conicSag(r, R, Kdesign) - conicSag(r, R, Kbuilt);

// ------------------------------------------------------------------------------- orbit and drag

/** Circular-orbit relations at altitude h (km). */
export function orbitAt(h) {
  const r = RE + h;                                   // km
  const v = Math.sqrt(MU / r);                        // km/s
  const T = 2 * Math.PI * Math.sqrt(r ** 3 / MU);     // s
  // longest eclipse (Sun in the orbit plane, cylindrical shadow): arc 2·asin(RE / r)
  const eclipse = (T * Math.asin(RE / r)) / Math.PI;  // s
  return { r, v, T, perDay: 86400 / T, eclipse, sunlit: T - eclipse };
}

// Exponential thermosphere: base altitude (km), density (kg/m³), scale height (km).
// Vallado, Fundamentals of Astrodynamics, Table 8-4 (moderate solar activity).
const THERMO = [
  [150, 2.070e-9, 22.523], [180, 5.464e-10, 29.740], [200, 2.789e-10, 37.105], [250, 7.248e-11, 45.546],
  [300, 2.418e-11, 53.628], [350, 9.518e-12, 53.298], [400, 3.725e-12, 58.515], [450, 1.585e-12, 60.828],
  [500, 6.967e-13, 63.822], [600, 1.454e-13, 71.835], [700, 3.614e-14, 88.667], [800, 1.170e-14, 124.64],
];

/** Thermosphere density (kg/m³) at altitude h (km); activity scales it (≈0.3 solar minimum … ≈3 maximum). */
export function thermosphereDensity(h, activity = 1) {
  let row = THERMO[0];
  for (const t of THERMO) if (h >= t[0]) row = t;
  return row[1] * Math.exp(-(h - row[0]) / row[2]) * activity;
}

/** Hubble's ballistic figures for the drag model (estimates: mean projected area, SM4 mass). */
export const HST_DRAG = { mass: 12200, area: 45, cd: 2.2 };

/**
 * Rate of change of a circular orbit's radius from drag (km per year, negative = decaying):
 * da/dt = −ρ (Cd A / m) √(μ a).
 */
export function decayRate(h, { activity = 1, mass = HST_DRAG.mass, area = HST_DRAG.area, cd = HST_DRAG.cd } = {}) {
  const a = (RE + h) * 1000;
  const rho = thermosphereDensity(h, activity);
  const dadt = -rho * ((cd * area) / mass) * Math.sqrt(MU * 1e9 * a);   // m/s
  return (dadt * 365.25 * 86400) / 1000;
}

/**
 * Integrate the altitude forward from h0 (km) at year y0 until hEnd or the time limit.
 * Returns samples [{ x: year, y: altitude km }] and the year the orbit reaches hEnd (or null).
 */
export function decayHistory(h0, y0, { activity = 1, hEnd = 200, years = 30, step = 1 / 52, ...ballistic } = {}) {
  const out = [{ x: y0, y: h0 }];
  let h = h0, y = y0, reached = null;
  while (y < y0 + years) {
    // shorten the step as the decay speeds up so the last weeks are resolved
    const rate = decayRate(h, { activity, ...ballistic });
    const dt = Math.min(step, Math.max(1 / 365, 5 / Math.max(1e-6, -rate)));
    h += rate * dt;
    y += dt;
    if (h <= hEnd) { reached = y; out.push({ x: y, y: hEnd }); break; }
    if (out.length < 4000) out.push({ x: y, y: h });
  }
  return { points: out, reentry: reached };
}
