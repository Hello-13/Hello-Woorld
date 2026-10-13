// F-22A Raptor: reference frame, outer mould line and loft helpers shared by the model modules.
//
// Axes: nose toward +x, y up, right wing toward +z. Fuselage station s is measured aft from the
// nose tip in metres (x = SN − s); y = 0 is the chine / wing reference plane. Real scale:
// 18.92 m long, 13.56 m span, 5.08 m tall standing on its gear (ground at y = −1.95).
//
// The outer mould line is three lofts that meet without overlap:
//   A  forward fuselage, nose → s 8.4 (chined nose, cockpit, belly between the inlets)
//   C  caret inlet cowls, raked lip → s 8.4 (one per side, wrapping each inlet duct)
//   B  centre / aft fuselage, s 8.4 → 17.55 (glove, intake trunks, weapons bays, engine bays)
// Ahead of s 8.4, A blends toward B's cross-section so the seams are continuous.

import * as THREE from 'three';

export const LENGTH = 18.92;
export const SN = 9.46;                       // model x of the nose tip
export const X = (s) => SN - s;
export const GROUND = -1.95;
export const DEG = Math.PI / 180;
export const S_AB = 8.4;                      // station where A and the cowls hand over to B
export const S_B_END = 17.55;

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------ monotone cubic keys (no overshoot)
const slopes = new WeakMap();
function pchipSlopes(k) {
  const n = k.length;
  const d = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) d[i] = (k[i + 1][1] - k[i][1]) / (k[i + 1][0] - k[i][0]);
  const m = new Array(n);
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else {
      const h0 = k[i][0] - k[i - 1][0], h1 = k[i + 1][0] - k[i][0];
      const w1 = 2 * h1 + h0, w2 = h1 + 2 * h0;
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  return m;
}
/** Monotone (Fritsch–Carlson) interpolation over [[s, v], …] sorted by s. */
export function mono(keys, s) {
  const n = keys.length;
  if (s <= keys[0][0]) return keys[0][1];
  if (s >= keys[n - 1][0]) return keys[n - 1][1];
  let m = slopes.get(keys);
  if (!m) { m = pchipSlopes(keys); slopes.set(keys, m); }
  let i = 0;
  while (i < n - 2 && s > keys[i + 1][0]) i++;
  const [s0, v0] = keys[i], [s1, v1] = keys[i + 1];
  const h = s1 - s0, t = (s - s0) / h, t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * v0 + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * v1 + (t3 - t2) * h * m[i + 1];
}

// ------------------------------------------------------------------ cubic Bézier y(z)
function bez1(a, b, c, d, t) { const u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d; }
/** y on a cubic Bézier P0..P3 ([z, y] pairs, z monotone in t) at a given z. */
function bezY(P, z) {
  const inc = P[3][0] > P[0][0];
  let lo = 0, hi = 1;
  for (let it = 0; it < 26; it++) {
    const t = (lo + hi) / 2;
    const zt = bez1(P[0][0], P[1][0], P[2][0], P[3][0], t);
    if ((zt < z) === inc) lo = t; else hi = t;
  }
  const t = (lo + hi) / 2;
  return bez1(P[0][1], P[1][1], P[2][1], P[3][1], t);
}

// ------------------------------------------------------------------ forward fuselage A
const A_W = [[0, 0.012], [0.5, 0.17], [1.2, 0.33], [2.0, 0.47], [2.8, 0.59], [3.6, 0.69], [4.6, 0.80], [5.6, 0.88], [6.4, 0.92], [7.4, 0.96], [8.4, 0.99]];
const A_YC = [[0, -0.13], [1.5, -0.08], [3.0, -0.03], [4.5, 0], [8.4, 0]];
const A_HT = [[0, 0.012], [0.5, 0.13], [1.2, 0.25], [2.0, 0.36], [2.8, 0.45], [3.4, 0.51], [4.6, 0.57], [5.8, 0.61], [6.8, 0.65], [8.4, 0.72]];
const A_HB = [[0, 0.012], [0.5, 0.12], [1.2, 0.22], [2.0, 0.32], [2.8, 0.40], [3.6, 0.47], [4.6, 0.54], [5.6, 0.62], [6.4, 0.70], [7.4, 0.80], [8.4, 0.88]];
export const aW = (s) => mono(A_W, s);
export const aYC = (s) => mono(A_YC, s);
export const aHT = (s) => mono(A_HT, s);
export const aHB = (s) => mono(A_HB, s);
const bU = (s) => smooth(6.6, S_AB, s);       // A's upper surface → B's glove
const bL = (s) => smooth(5.0, 6.5, s);        // A's belly → flat-bottomed box between the inlets

// ------------------------------------------------------------------ centre / aft fuselage B
const B_W = [[8.4, 1.86], [9.5, 1.90], [11, 1.91], [12.5, 1.88], [14, 1.80], [15.4, 1.72], [16.5, 1.66], [17.55, 1.60]];
const B_HT = [[8.4, 0.74], [9.5, 0.75], [11, 0.73], [12.5, 0.71], [14, 0.67], [15.5, 0.63], [17, 0.59], [17.55, 0.57]];
const B_D = [[8.4, 0.88], [9.5, 0.90], [11, 0.90], [12.4, 0.89], [13.5, 0.83], [15, 0.73], [16.5, 0.65], [17.55, 0.60]];
export const bW = (s) => mono(B_W, s);
export const bHT = (s) => mono(B_HT, s);
export const bD = (s) => mono(B_D, s);
export const bWb = (s) => bW(s) - 0.4 * bD(s);           // lower outer corner of the trunk / engine bay

/** B's upper surface height at lateral position z (0 ≤ z ≤ W). */
export function upperB(s, z) {
  const w = bW(s), ht = bHT(s);
  return bezY([[0, ht], [w * 0.45, ht], [w * 0.72, ht * 0.8], [w, 0]], clamp(z, 0, w));
}
function upperAnative(s, z) {
  const w = aW(s), ht = aHT(s), yc = aYC(s);
  return yc + bezY([[0, ht], [w * 0.55, ht], [w * 0.7, Math.min(w * 0.17, ht * 0.6)], [w, 0]], clamp(z, 0, w));
}
function lowerAnative(s, z) {
  const w = aW(s), hb = aHB(s), yc = aYC(s);
  return yc + bezY([[w, 0], [w * 0.78, -Math.min(w * 0.2, hb * 0.6)], [w * 0.45, -hb], [0, -hb]], clamp(z, 0, w));
}
/** Height of the fuselage top at (s, z) over the forward and centre fuselage. */
export function upperA(s, z) {
  const b = bU(s);
  if (b <= 0) return upperAnative(s, z);
  return lerp(upperAnative(s, z), upperB(Math.max(s, S_AB), z), b);
}
/** Junction of A's upper surface with its side / the cowl top: [z, y]. */
export const aJunction = (s) => [aW(s), lerp(aYC(s), upperB(S_AB, aW(s)), bU(s))];
/** Top of the fuselage at any station and lateral position (for fitting internals). */
export function topAt(s, z) {
  if (s >= S_AB) return upperB(s, Math.min(z, bW(s)));
  return upperA(s, Math.min(Math.abs(z), aW(s)));
}
/** Bottom of the fuselage at (s, z): A's belly ahead of the inlets, the flat bottom aft. */
export function bottomAt(s, z) {
  const az = Math.abs(z);
  if (s >= S_AB) return -bD(s);
  const box = -aHB(s) + aYC(s);
  return lerp(lowerAnative(s, Math.min(az, aW(s))), box, bL(s));
}

// ------------------------------------------------------------------ canopy sill / cockpit opening
const SILL = [[3.45, 0.0], [3.6, 0.17], [3.9, 0.33], [4.3, 0.45], [4.8, 0.53], [5.3, 0.565], [5.7, 0.57], [6.1, 0.55], [6.45, 0.48], [6.75, 0.33], [6.95, 0.12], [7.02, 0.0]];
export const CANOPY_S0 = 3.45, CANOPY_S1 = 7.02;
export const sillW = (s) => (s <= CANOPY_S0 || s >= CANOPY_S1 ? 0 : mono(SILL, s));
export const HOLE_S0 = 3.62, HOLE_S1 = 6.92;    // cockpit opening under the canopy

// nose-gear well (in A's belly) and its doors
export const NOSE_WELL = { s0: 3.95, s1: 5.75, z: 0.24 };

// ------------------------------------------------------------------ ring builders
const NU = 12, NL = 11;
/**
 * A's ring at station s: right half from the top centre round the chine to the belly centre,
 * then the left half mirrored. Returns { pts, uSplit, lowerStart } for hole tests.
 */
export function ringA(s) {
  const w = aW(s);
  const yc = aYC(s);
  const right = [];
  // upper: inner samples cover the cockpit opening, outer ones run to the chine
  const sw = sillW(s);
  const hole = s > HOLE_S0 && s < HOLE_S1;
  const zIn = hole ? Math.max(0.05, sw - 0.03) : 0.32 * w;
  const NI = 5;
  for (let k = 0; k <= NU; k++) {
    let z;
    if (k <= NI) z = zIn * (k / NI);
    else { const f = (k - NI) / (NU - NI); z = zIn + (w - zIn) * (1 - (1 - f) * (1 - f) * 0.35 - 0.65 * (1 - f)); }
    if (k === NU) z = w;
    right.push([z, upperA(s, z)]);
  }
  const [jz, jy] = aJunction(s);
  right[NU] = [jz, jy];
  // lower: from the chine (crease duplicate) to the centre
  const D = aHB(s) - yc;
  const wellZ = w > 0.5 ? NOSE_WELL.z : 0.3 * w;
  const nat = [], box = [];
  const outerN = NL - 3;      // points from the chine down to the well edge
  for (let j = 0; j <= NL; j++) {
    let z;
    if (j <= outerN) { const f = j / outerN; z = w - (w - wellZ) * (f * f * 0.45 + f * 0.55); } else z = wellZ * (1 - (j - outerN) / 3);
    nat.push([z, lowerAnative(s, z)]);
    if (j === 0) box.push([jz, jy]);
    else if (j <= 3) box.push([w, lerp(jy, -D, j / 3)]);
    else if (j <= outerN) { const f = (j - 3) / (outerN - 3); box.push([w - (w - wellZ) * f, -D]); }
    else box.push([z, -D]);
  }
  nat[0] = [w, yc];
  const b = bL(s);
  const lower = nat.map((p, j) => (j === 0 && bU(s) > 0 ? [jz, jy] : [lerp(p[0], box[j][0], b), lerp(p[1], box[j][1], b)]));
  // A's well edge must stay exact where the nose-gear well is cut
  const half = right.concat(lower);
  const left = half.slice(1, -1).reverse().map(([z, y]) => [-z, y]);
  const pts = half.concat(left).map(([z, y]) => [X(s), y, z]);
  return { pts, nu: NU, nl: NL, half: half.length };
}

const B_UP = [0, 0.08, 0.16, 0.24, 0.32, 0.40, 0.48, 0.55, 0.62, 0.69, 0.75, 0.81, 0.86, 0.905, 0.94, 0.97, 1];
export const SIDE_BAY = { s0: 7.95, s1: 11.15, y0: -0.42, y1: -0.82 };
export const MAIN_BAY = { s0: 8.25, s1: 12.2, z: 0.78 };
export const MAIN_WELL = { s0: 11.2, s1: 12.95, z0: 0.86, z1: 1.46 };
/** Wall fractions (chine → lower corner) with exact side-bay edges. */
export function wallFractions(s) {
  const D = bD(s);
  const fa = Math.min(SIDE_BAY.y0 / -D, 0.6), fb = Math.min(SIDE_BAY.y1 / -D, 0.93);
  return [0, 0.1, 0.2, 0.31, fa, fa + (fb - fa) / 3, fa + (2 * (fb - fa)) / 3, fb, (fb + 1) / 2, 1];
}
/** Point on B's trunk wall at fraction f from the chine (0) to the lower corner (1). */
export function wallB(s, f) {
  const w = bW(s), wb = bWb(s), D = bD(s);
  return [lerp(w, wb, f) + 0.025 * Math.sin(Math.PI * f), -D * f];
}
export function bottomSamples(s) {
  const wb = bWb(s);
  const o = Math.min(MAIN_WELL.z1, wb - 0.05);
  return [wb, o, lerp(o, MAIN_WELL.z0, 1 / 3), lerp(o, MAIN_WELL.z0, 2 / 3), MAIN_WELL.z0, MAIN_BAY.z, MAIN_BAY.z * 0.75, MAIN_BAY.z * 0.5, MAIN_BAY.z * 0.25, 0];
}
/** B's ring at station s; index layout: upper (17), chine dup, wall (10), corner dup, bottom (10). */
export function ringB(s) {
  const w = bW(s), D = bD(s);
  const half = [];
  for (const f of B_UP) half.push([f * w, upperB(s, f * w)]);
  const wf = wallFractions(s);
  for (const f of wf) half.push(wallB(s, f));                 // first point duplicates the chine
  for (const z of bottomSamples(s)) half.push([z, -D]);         // first point duplicates the corner
  const left = half.slice(1, -1).reverse().map(([z, y]) => [-z, y]);
  const pts = half.concat(left).map(([z, y]) => [X(s), y, z]);
  return { pts, half: half.length, nUp: B_UP.length, nWall: wf.length };
}

// ------------------------------------------------------------------ caret inlet cowl
// Lip corners [z, y, s]: inner-top, outer-top (the chine), outer-bottom, inner-bottom.
export const LIP = { IT: [0, 0, 6.05], OT: [1.78, -0.04, 6.85], OB: [1.47, -0.93, 7.30], IB: [0, -0.86, 6.62] };
const gap = (s) => 0.06 * (1 - smooth(6.4, 7.5, s));
const EDGE_N = { top: 8, outer: 9, bottom: 5, inner: 6 };
/**
 * Cowl point at loft fraction tau (0 lip → 1 at S_AB) for edge e and edge fraction f.
 * The inner edges ride on A's side (with the diverter gap); the outer ones blend to B.
 */
function cowlPoint(e, f, tau) {
  const sAt = (s0) => lerp(s0, S_AB, tau);
  const inner = (s, top) => {
    const [jz, jy] = aJunction(s);
    const g = gap(s);
    return top ? [jz + g, jy] : [jz + g, bottomAt(s, jz)];
  };
  const outerTop = (s) => {
    const t = clamp((s - LIP.OT[2]) / (S_AB - LIP.OT[2]), 0, 1);
    return [lerp(LIP.OT[0], bW(S_AB), t), lerp(LIP.OT[1], 0, t)];
  };
  const outerBot = (s) => {
    const t = clamp((s - LIP.OB[2]) / (S_AB - LIP.OB[2]), 0, 1);
    return [lerp(LIP.OB[0], bWb(S_AB), t), lerp(LIP.OB[1], -bD(S_AB), t)];
  };
  if (e === 'top') {
    const sa = sAt(LIP.IT[2]), sb = sAt(LIP.OT[2]);
    const a = inner(sa, true), b = outerTop(sb);
    const z = lerp(a[0], b[0], f);
    const flat = lerp(a[1], b[1], f) + 0.035 * Math.sin(Math.PI * f) * (1 - tau);
    // the shelf over the inlet sweeps up into the wing glove toward S_AB
    const glove = upperB(S_AB, z) + (a[1] - upperB(S_AB, a[0])) * (1 - f) + (b[1] - upperB(S_AB, b[0])) * f;
    return [z, lerp(flat, glove, smooth(0.3, 1, tau)), lerp(sa, sb, f)];
  }
  if (e === 'outer') {
    const sa = sAt(LIP.OT[2]), sb = sAt(LIP.OB[2]);
    const a = outerTop(sa), b = outerBot(sb);
    const k = smooth(0.2, 1, tau);
    const wall = wallB(S_AB, f);
    const lip = [lerp(a[0], b[0], f) + 0.02 * Math.sin(Math.PI * f), lerp(a[1], b[1], f)];
    return [lerp(lip[0], wall[0], k), lerp(lip[1], wall[1], k), lerp(sa, sb, f)];
  }
  if (e === 'bottom') {
    const sa = sAt(LIP.OB[2]), sb = sAt(LIP.IB[2]);
    const a = outerBot(sa), b = inner(sb, false);
    return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(sa, sb, f)];
  }
  // inner wall (diverter side), bottom → top
  const sa = sAt(LIP.IB[2]), sb = sAt(LIP.IT[2]);
  const a = inner(sa, false), b = inner(sb, true);
  return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(sa, sb, f)];
}
/** Closed cowl ring (right side) at fraction tau; corners duplicated so the lips stay sharp. */
export function cowlRing(tau) {
  const pts = [];
  for (const e of ['top', 'outer', 'bottom', 'inner']) {
    const n = EDGE_N[e];
    for (let i = 0; i <= n; i++) {
      const [z, y, s] = cowlPoint(e, i / n, tau);
      pts.push([X(s), y, z]);
    }
  }
  return pts;
}
export const COWL_TAUS = [0, 0.015, 0.04, 0.08, 0.13, 0.2, 0.28, 0.37, 0.47, 0.58, 0.7, 0.82, 0.92, 1];

// ------------------------------------------------------------------ inlet duct centre line (right side)
export const FAN_S = 13.38;                      // F119 fan face
export const ENG_Z = 0.78, ENG_Y = -0.02;        // engine centre line
export const DUCT = [
  // [s, z, y, width, height, roundness 0 (lip shape) … 1 (circle)]
  [7.6, 1.36, -0.30, 0.66, 0.76, 0.12],
  [8.4, 1.33, -0.13, 0.62, 0.72, 0.25],
  [9.4, 1.26, -0.04, 0.66, 0.72, 0.38],
  [10.4, 1.17, 0.01, 0.72, 0.74, 0.52],
  [11.4, 1.05, 0.04, 0.82, 0.80, 0.70],
  [12.4, 0.90, 0.03, 0.92, 0.90, 0.88],
  [FAN_S, ENG_Z, ENG_Y, 0.98, 0.98, 1.0],
];

// ------------------------------------------------------------------ wing, tails
const tan = Math.tan;
export const WING = {
  // reference trapezoid: apex (centre-line LE) at s 6.06, centre-line chord 9.844 m, tip chord 1.667 m
  apex: 6.06, c0: 9.844, le: 42 * DEG, te: -17 * DEG, semi: 6.78, anhedral: 3.25 * DEG,
};
export const wingLE = (z) => WING.apex + z * tan(WING.le);
export const wingTE = (z) => WING.apex + WING.c0 + z * tan(WING.te);
export const wingY = (z) => -0.02 - (z - 1.45) * tan(WING.anhedral);
/** wingPanel section at span z (root t/c 5.92 %, tip 4.29 % — NACA 64A-series per public data). */
export function wingSection(z) {
  const eta = (z - 1.45) / (WING.semi - 1.45);
  return { le: [X(wingLE(z)), wingY(z), z], chord: wingTE(z) - wingLE(z), t: lerp(0.0592, 0.0429, eta) };
}
export const STAB = { rootZ: 1.55, tipZ: 4.42, rootLE: 14.97, rootC: 3.95, y: -0.1, pivotS: 16.75 };
export function stabSection(z) {
  const d = z - STAB.rootZ;
  const le = STAB.rootLE + d * tan(42 * DEG);
  const te = STAB.rootLE + STAB.rootC - d * tan(17 * DEG);
  const eta = d / (STAB.tipZ - STAB.rootZ);
  return { le: [X(le), STAB.y, z], chord: te - le, t: lerp(0.045, 0.035, eta) };
}
// vertical tail: built in a local frame (chord toward −x, span along +z) then canted 28° outward
export const FIN = { rootS: 13.45, rootZ: 1.42, rootY: 0.33, span: 3.18, rootC: 3.9, tipC: 1.45, sweep: 22.9 * DEG, cant: 28 * DEG };

// ------------------------------------------------------------------ geometry helpers
/**
 * Grid surface through rings of equal length. keep(i, j) decides whether the quad between rings
 * i, i+1 and points j, j+1 is emitted (holes for bays, wells, the cockpit).
 * UVs: u = −x (stations, metres), v = arc length around the ring (metres).
 */
export function gridSurface(rings, { closed = false, keep = null, uv = 'metric-x' } = {}) {
  const n = rings[0].length, m = rings.length;
  const cols = closed ? n + 1 : n;
  const pos = [], uvs = [], idx = [];
  for (let i = 0; i < m; i++) {
    const r = rings[i];
    let arc = 0;
    let cx = 0;
    for (const p of r) cx += p[0];
    cx /= n;
    for (let j = 0; j < cols; j++) {
      const p = r[j % n];
      if (j > 0) { const q = r[(j - 1) % n]; arc += Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); }
      pos.push(p[0], p[1], p[2]);
      uvs.push(uv === 'metric-x' ? -cx : i / (m - 1), arc);
    }
  }
  for (let i = 0; i < m - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      if (keep && !keep(i, j)) continue;
      const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Rounded-rectangle (superellipse) ring in the y–z plane around (cz, cy) at model x. */
export function superRing(x, cz, cy, w, h, n = 24, k = 3.2, start = Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = start - (i / n) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    pts.push([x, cy + Math.sign(s) * Math.abs(s) ** (2 / k) * h / 2, cz + Math.sign(c) * Math.abs(c) ** (2 / k) * w / 2]);
  }
  return pts;
}

/** Point helper: [x, y, z] from a station. */
export const P3 = (s, y, z) => new THREE.Vector3(X(s), y, z);

/** Box with its centre at station s. */
export function boxS(s, y, z, ls, h, w) {
  return new THREE.BoxGeometry(ls, h, w).translate(X(s), y, z);
}

/** Cylinder along x (the flight direction) centred at station s. */
export function cylX(s, y, z, len, r0, r1 = r0, seg = 24, open = false) {
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, open);
  g.rotateZ(Math.PI / 2);          // +y axis → −x, so r0 (bottom, now +x side) is the forward end
  g.translate(X(s), y, z);
  return g;
}

/** Tube through station-space points [[s, y, z], …]. */
export function pipe(points, r = 0.02, seg = 6, tubular = null) {
  const curve = new THREE.CatmullRomCurve3(points.map(([s, y, z]) => new THREE.Vector3(X(s), y, z)), false, 'catmullrom', 0.2);
  return new THREE.TubeGeometry(curve, tubular || Math.max(8, points.length * 6), r, seg, false);
}

/** Merge geometries after making them non-indexed (mixed indexed / non-indexed inputs). */
export function merge(list, mergeGeometries) {
  const flat = list.filter(Boolean).map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of flat) { if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); }
  const keepAttrs = ['position', 'normal', 'uv'];
  for (const g of flat) for (const k of Object.keys(g.attributes)) if (!keepAttrs.includes(k)) g.deleteAttribute(k);
  return mergeGeometries(flat);
}
