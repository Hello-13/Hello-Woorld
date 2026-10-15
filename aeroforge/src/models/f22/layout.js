// F-22A Raptor: reference frame and outer mould line (three.js-free, so tests can import it).
//
// Axes: nose toward +x, y up, right wing toward +z. Fuselage station s is measured aft from the
// nose tip in metres (x = SN − s); y = 0 is the chine / wing-root reference plane. Real scale:
// 18.92 m long, 13.56 m span, 5.07 m tall standing on its gear (ground at y = −2.09).
//
// Stations and shapes are measured (scratchpad station study, 2025 re-layout) on the US Navy NAWDC
// orthographic side / top / bottom / front / back renders (DVIDS 9081638–9081672, scaled to 18.92 m), the
// USAF rescue technical order T.O. 00-105E-9 Rev 11 (F-22A dimension, panel and hazard pages) and published
// photographs; dimensions follow the USAF fact sheet. The outer mould line is three lofts and their tails:
//   A  forward fuselage, nose → S_AB (chined radome, cockpit and spine, belly between the inlets)
//   C  caret inlet cowls, raked lip → S_AB (one per side, wrapping each inlet duct)
//   B  centre / aft fuselage, S_AB → S_BE (wing glove, inlet trunks, weapons bays, engine bays); behind S_BE the
//      two tail booms (beside the nozzles, to their 43° aft ends under the stabilators) and the stinger between
//      the nozzles carry on, and the nozzles' external flaps close the top and bottom between them.

export const LENGTH = 18.92;
export const SN = 9.46;                       // model x of the nose tip
export const X = (s) => SN - s;
export const GROUND = -2.09;                  // T.O. 00-105E-9 side view: nose tip 1.96 m above the ground, fin tips 16 ft 7 in
export const DEG = Math.PI / 180;
export const S_AB = 6.85;                     // station where A and the cowls hand over to B (just ahead of the bays)
export const S_BE = 15.0;                     // end of the full B section: booms, stinger and nozzle flaps carry on
export const S_B_END = S_BE;

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------ station maps from the pre-2025 layout
// The interior was first laid out on outer stations that turned out 0.9–2 m off (canopy, inlets and bays too far
// aft, engine 1.8 m too far aft). Until each unit is re-placed from sources, interior literals carried over from
// that layout are written M(old station) (fuselage interior), EM(old) (the engine and everything hung on it) or
// WM(old) (units carried in the wing), so they keep their place relative to the structure around them.
const pw = (keys) => (s) => {
  const n = keys.length;
  if (s <= keys[0][0]) return keys[0][1] + (s - keys[0][0]);
  for (let i = 0; i < n - 1; i++) {
    const [a, A] = keys[i], [b, B] = keys[i + 1];
    if (s <= b) return A + ((B - A) * (s - a)) / (b - a);
  }
  return keys[n - 1][1] + (s - keys[n - 1][0]);
};
/** Old → new fuselage station anchors: nose, radar bulkhead, cockpit, inlet hand-over, main-bay ends, fan face, nozzle. */
export const STATION_MAP = [[0, 0], [2.55, 2.15], [4.45, 2.99], [7.02, 5.56], [8.40, 6.85], [12.35, 11.10], [13.38, 11.55], [15.62, 13.79], [17.25, 15.25], [18.52, 16.53], [18.92, 17.0]];
export const M = pw(STATION_MAP);
/** The engine installation moved as one block: fan face 13.38 → 11.55; the augmentor and nozzle are 0.16 m shorter. */
export const ENGINE_MAP = [[13.38, 11.55], [15.62, 13.79], [17.25, 15.25], [18.52, 16.53]];
export const EM = pw(ENGINE_MAP);
/** Units carried in the wing follow its apex (6.06 → 6.58). */
export const WM = (s) => s + 0.52;

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
  // slopes are cached on the key array itself (a hidden property): this is the hottest call in the build
  let m = keys.__slopes;
  if (!m) { m = slopes.get(keys) || pchipSlopes(keys); slopes.set(keys, m); Object.defineProperty(keys, '__slopes', { value: m }); }
  let i = 0;
  while (i < n - 2 && s > keys[i + 1][0]) i++;
  const k0 = keys[i], k1 = keys[i + 1], s0 = k0[0], v0 = k0[1], s1 = k1[0], v1 = k1[1];
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
// chine half-width from the NAWDC top view; height above / below the chine on the centre line from its side view
const A_W = [[0, 0.012], [0.25, 0.138], [0.5, 0.25], [0.75, 0.354], [1.0, 0.44], [1.5, 0.564], [2.0, 0.646], [2.5, 0.705], [3.0, 0.762], [3.5, 0.806], [4.0, 0.83], [4.5, 0.846], [4.78, 0.852], [5.6, 0.87], [6.85, 0.885]];
const A_YC = [[0, -0.13], [1.5, -0.08], [3.0, -0.03], [4.5, 0], [6.85, 0]];
// centre-line top: radome, the coaming / turtle deck under the canopy, then the dorsal spine behind it
const A_HT = [[0, 0.012], [0.25, 0.113], [0.5, 0.218], [0.75, 0.29], [1.0, 0.352], [1.25, 0.395], [1.5, 0.43], [2.0, 0.50], [2.55, 0.645], [2.8, 0.665], [3.2, 0.685],
  [3.7, 0.70], [4.2, 0.722], [4.6, 0.738], [4.9, 0.765], [5.15, 0.86], [5.4, 1.12], [5.6, 1.115], [5.8, 1.085], [6.0, 1.055], [6.2, 1.035], [6.4, 0.968], [6.6, 0.927], [6.85, 0.875]];
const A_HB = [[0, 0.012], [0.25, 0.133], [0.5, 0.224], [0.75, 0.30], [1.0, 0.366], [1.25, 0.41], [1.5, 0.478], [2.0, 0.564], [2.5, 0.648], [3.0, 0.724], [3.5, 0.784],
  [4.0, 0.833], [4.5, 0.872], [4.78, 0.89], [5.5, 0.94], [6.0, 0.97], [6.85, 1.0]];
export const aW = (s) => mono(A_W, s);
export const aYC = (s) => mono(A_YC, s);
export const aHT = (s) => mono(A_HT, s);
export const aHB = (s) => mono(A_HB, s);
const bU = (s) => smooth(5.9, S_AB, s);       // A's upper surface → B's at the hand-over
const bL = (s) => smooth(4.5, 5.4, s);        // A's belly → the box between the inlets (its sides are the inlets' inner walls)
/** The inlets' inner (diverter-side) walls lean inboard at the bottom about 26°, parallel to the outer walls (front view). */
export const INNER_LEAN = Math.tan(26 * DEG);
/** Lower outer corner [z, y] of A's belly box at station s (where the inlet's inner wall meets the belly). */
export function aBoxCorner(s) {
  const w = aW(s), D = aHB(s) - aYC(s);
  return [w - INNER_LEAN * D * bL(s), -aHB(s) + aYC(s)];
}

// ------------------------------------------------------------------ centre / aft fuselage B
// chine (wing-root) half-width: NAWDC top view 2.0 at 6.7, 2.1 at 7.7, 2.2 at the wing root; the booms beside the
// nozzles are about 2.0 wide at the stabilator roots (bottom view)
const B_W = [[6.85, 2.035], [7.5, 2.078], [8.0, 2.123], [8.55, 2.20], [9.5, 2.21], [12.5, 2.21], [15.0, 2.21], [15.75, 2.19], [16.4, 2.04], [18.1, 1.97]];
// centre-line deck height (NAWDC side view) and belly depth below the chine (side and front views)
const B_HT = [[6.85, 0.875], [7.5, 0.765], [8.0, 0.712], [8.5, 0.672], [9.0, 0.652], [10, 0.622], [11, 0.603], [12, 0.585], [13, 0.565], [14, 0.535], [15, 0.48], [16, 0.32], [16.6, 0.22], [16.95, 0.155], [17.05, 0.07], [17.5, 0.03], [18.1, 0.0]];
const B_D = [[6.85, 1.0], [8.0, 1.01], [11, 1.01], [12, 1.0], [13, 0.965], [14, 0.885], [15, 0.79], [15.6, 0.73], [16, 0.68], [16.5, 0.49], [17.0, 0.38], [17.5, 0.255], [18.1, 0.16]];
// lower outer corner of the inlet trunk (flat bottom's edge) and the trunk wall's top under the chine flange
const B_WB = [[6.85, 1.33], [8.0, 1.38], [10.0, 1.42], [10.8, 1.52], [12.9, 1.52], [13.6, 1.46], [15.0, 1.40], [16.5, 1.45], [18.1, 1.6]];
const B_ZK = [[6.85, 1.76], [8.0, 1.84], [12.5, 1.86], [15.0, 1.86], [16.0, 1.84], [18.1, 1.86]];
export const bW = (s) => mono(B_W, s);
export const bHT = (s) => mono(B_HT, s);
export const bD = (s) => mono(B_D, s);
export const bWb = (s) => mono(B_WB, s);              // lower outer corner of the trunk / engine bay
export const bZk = (s) => Math.min(mono(B_ZK, s), bW(s) - 0.05);
export const B_KNEE = 0.2;                             // the chine flange's underside meets the trunk wall 0.2 m below the chine

/** B's upper surface height at lateral position z (0 ≤ z ≤ W). */
export function upperB(s, z) {
  const w = bW(s), ht = bHT(s);
  // a crowned deck (fitted to the NAWDC front view: 0.50 m at z 1.0, 0.39 at 1.3), a little fuller over the engine
  // bays so the 1.22 m F119s fit under it; just aft of the canopy the deck is still the narrow dorsal spine
  const k = smooth(10.6, 11.8, s), c = 1 - smooth(S_AB, 8.6, s);
  const a1 = lerp(lerp(0.34, 0.36, k), 0.02, c), a2 = lerp(lerp(0.42, 0.44, k), 0.88, c), b2 = lerp(0.92, 0.26, c);
  return bezY([[0, ht], [w * a1, ht], [w * a2, ht * b2], [w, 0]], clamp(z, 0, w));
}
// Beside the cockpit the upper fuselage sides stand steeply (close to the fins' 62° from horizontal) so the canopy
// sill sits high on them. Elsewhere the shoulder is rounder.
const cockpitShoulder = (s) => smooth(2.2, 2.9, s) * (1 - smooth(5.3, 6.3, s));
// behind the canopy the top narrows to the dorsal spine, which falls away steeply on both sides (NAWDC front view)
const spine = (s) => smooth(5.3, 5.9, s);
// The canopy frame's foot runs straight in side view, 0.51 m at s 2.8 rising to 0.80 m at 5.3 (NAWDC side view; the
// front view's canopy outline agrees), so the sill edge lies in one plane tilted 6.8° nose-down. Beside the cockpit
// the section is solved to pass through it: [s, z, y] (z is the sill's half-width, sillW, held at 0.5 behind the canopy).
const SHOULDER = [[2.75, 0.31, 0.512], [2.8, 0.36, 0.51], [3.0, 0.43, 0.53], [3.3, 0.5, 0.566], [3.7, 0.545, 0.614], [4.1, 0.565, 0.662],
  [4.5, 0.565, 0.71], [4.8, 0.545, 0.746], [5.05, 0.5, 0.776], [5.3, 0.5, 0.74], [5.6, 0.5, 0.68], [5.9, 0.5, 0.62]];
const SH_Z = SHOULDER.map((r) => [r[0], r[1]]), SH_Y = SHOULDER.map((r) => [r[0], r[2]]);
const shoulderFit = (s) => smooth(2.62, 2.8, s) * (1 - smooth(5.3, 5.8, s));
function upperAnative(s, z) {
  const w = aW(s), ht = aHT(s), yc = aYC(s);
  const k = cockpitShoulder(s), sp = spine(s);
  const P1 = [w * lerp(lerp(0.55, 0.66, k), 0.05, sp), ht];
  const P2 = [w * lerp(lerp(0.7, 0.82, k), 0.62, sp), lerp(lerp(Math.min(w * 0.17, ht * 0.6), ht * 0.62, k), ht * 0.3, sp)];
  const f = shoulderFit(s), zc = clamp(z, 0, w);
  if (f <= 0) return yc + bezY([[0, ht], P1, P2, [w, 0]], zc);
  // y at the sill is linear in P2's height for a fixed curve parameter, so solve for it; below the sill the side
  // runs straight down to the chine (about 60° from horizontal)
  const zt = Math.min(s < 5.05 ? Math.max(sillW(s), 0.3) : mono(SH_Z, s), w - 0.1), yt = mono(SH_Y, s);
  let lo = 0, hi = 1;
  for (let it = 0; it < 30; it++) { const t = (lo + hi) / 2; if (bez1(0, P1[0], P2[0], w, t) < zt) lo = t; else hi = t; }
  const t = (lo + hi) / 2, m = 1 - t, b01 = m * m * m + 3 * m * m * t, b2 = 3 * m * t * t;
  const native = yc + bezY([[0, ht], P1, P2, [w, 0]], zc);
  if (b2 > 0.05) P2[1] = (yt - yc - b01 * ht) / b2;
  const fitted = zc <= zt ? yc + bezY([[0, ht], P1, P2, [w, 0]], zc) : lerp(yt, yc, (zc - zt) / (w - zt));
  return lerp(native, fitted, f);
}
function lowerAnative(s, z) {
  const w = aW(s), hb = aHB(s), yc = aYC(s);
  return yc + bezY([[w, 0], [w * 0.78, -Math.min(w * 0.2, hb * 0.6)], [w * 0.45, -hb], [0, -hb]], clamp(z, 0, w));
}
/** Height of the fuselage top at (s, z) over the forward and centre fuselage. */
export function upperA(s, z) {
  const b = bU(s);
  if (b <= 0) return upperAnative(s, z);
  // B's section at the hand-over, lifted along the crown to A's spine height so the blend keeps the profile
  const lift = (aHT(s) - aHT(S_AB)) * (1 - smooth(0, aW(s) * 0.85, Math.abs(z)));
  return lerp(upperAnative(s, z), upperB(Math.max(s, S_AB), z) + lift, b);
}
/** Junction of A's upper surface with its side / the cowl top: [z, y]. */
export const aJunction = (s) => [aW(s), lerp(aYC(s), upperB(S_AB, aW(s)), bU(s))];
/** Top of the fuselage at any station and lateral position (for fitting internals). */
export function topAt(s, z) {
  if (s >= S_AB) return upperB(s, Math.min(Math.abs(z), bW(s)));
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
// One-piece transparency 2.55 → 5.40 (frame aft V to 5.55), 1.14 m wide, crown 1.31 m at s 4.2 (NAWDC side and top
// views, T.O. top view, side-on photographs). The published 140 in (3.56 m) is longer than the 2.85 m projected
// length every drawing and photograph shows, so it is probably a developed length along the bubble.
const SILL = [[2.55, 0.0], [2.65, 0.2], [2.8, 0.36], [3.0, 0.43], [3.3, 0.5], [3.7, 0.545], [4.1, 0.565], [4.5, 0.565], [4.8, 0.545], [5.05, 0.5], [5.2, 0.42], [5.3, 0.27], [5.36, 0.12], [5.40, 0.0]];
export const CANOPY_S0 = 2.55, CANOPY_S1 = 5.40;
export const CANOPY_FRAME_S1 = 5.55;
export const sillW = (s) => (s <= CANOPY_S0 || s >= CANOPY_S1 ? 0 : mono(SILL, s));
// cockpit opening under the canopy: the skin carries on under the front of the canopy as the coaming over the
// instrument panel; the forward pressure bulkhead sits at HOLE_S0, and behind the headrest the turtle deck rises
// under the canopy's aft end
export const HOLE_S0 = 2.99, HOLE_S1 = 5.15;
// canopy crown height (NAWDC side view)
const CAN_Y = [[2.55, 0.598], [2.75, 0.78], [3.0, 0.92], [3.25, 1.055], [3.5, 1.18], [3.75, 1.265], [4.0, 1.305], [4.2, 1.312], [4.45, 1.298], [4.75, 1.27], [5.0, 1.225], [5.2, 1.18], [5.40, 1.13]];
export const canopyTop = (s) => Math.max(mono(CAN_Y, s), upperA(s, 0));

// nose-gear well (between the inlets, under the cockpit floor) and its doors: the leg retracts forward
export const NOSE_WELL = { s0: 3.95, s1: 5.95, z: 0.24, hump0: 4.0, hump1: 4.55 };

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
  // the ring at HOLE_S1 closes the opening at the sill line, so no slit is left beside the canopy's aft end
  const hole = s > HOLE_S0 && s <= HOLE_S1;
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
  const [cz] = aBoxCorner(s);
  const wellZ = w > 0.5 ? NOSE_WELL.z : 0.3 * w;
  const nat = [], box = [];
  const outerN = NL - 3;      // points from the chine down to the well edge
  for (let j = 0; j <= NL; j++) {
    let z;
    if (j <= outerN) { const f = j / outerN; z = w - (w - wellZ) * (f * f * 0.45 + f * 0.55); } else z = wellZ * (1 - (j - outerN) / 3);
    nat.push([z, lowerAnative(s, z)]);
    if (j === 0) box.push([jz, jy]);
    else if (j <= 3) box.push([lerp(w, cz, j / 3), lerp(jy, -D, j / 3)]);     // the leaning inner wall of the inlet
    else if (j <= outerN) { const f = (j - 3) / (outerN - 3); box.push([cz - (cz - wellZ) * f, -D]); }
    else box.push([z, -D]);
  }
  nat[0] = [w, yc];
  const b = bL(s);
  const lower = nat.map((p, j) => (j === 0 && bU(s) > 0 ? [jz, jy] : [lerp(p[0], box[j][0], b), lerp(p[1], box[j][1], b)]));
  const half = right.concat(lower);
  const left = half.slice(1, -1).reverse().map(([z, y]) => [-z, y]);
  const pts = half.concat(left).map(([z, y]) => [X(s), y, z]);
  return { pts, nu: NU, nl: NL, half: half.length };
}

const B_UP = [0, 0.08, 0.16, 0.24, 0.32, 0.40, 0.48, 0.55, 0.62, 0.69, 0.75, 0.81, 0.86, 0.905, 0.94, 0.97, 1];
/** Side weapons bays (doors 7.0 → 10.25 in the trunk walls; NAWDC, T.O. bottom view and the Duluth underside photo). */
export const SIDE_BAY = { s0: 7.0, s1: 10.25, y0: -0.48, y1: -0.88 };
/**
 * Side-bay cavity (right side) at station s as four [z, y] points: the door opening's top and bottom edges on
 * the trunk wall and the two back-wall corners 0.34 m in. Near the front of the bay the inlet duct's floor dips
 * low, so there the roof slopes down inboard to stay at least 3 cm under the duct.
 */
export function sideBaySection(s) {
  const wf = wallFractions(s);
  const a = wallB(s, wf[4]), b = wallB(s, wf[7]);
  const aIn = [a[0] - 0.99 * 0.34, a[1] + 0.08 * 0.34], bIn = [b[0] - 0.99 * 0.34, b[1] + 0.08 * 0.34];
  const ok = (y) => { for (let u = 0; u <= 1.0001; u += 0.1) if (ductDepth(s, lerp(a[1], y, u), lerp(a[0], aIn[0], u)) >= -0.03) return false; return true; };
  if (!ok(aIn[1])) {
    let hi = aIn[1], lo = aIn[1] - 0.3;                 // hi fails, lo (30 cm lower) clears
    for (let k = 0; k < 10; k++) { const m = (lo + hi) / 2; if (ok(m)) lo = m; else hi = m; }
    aIn[1] = lo;
  }
  return [a, aIn, bIn, b];
}
/** Countermeasure (flare) bay behind each side bay, "between the landing gear doors and weapons bays doors" (T.O.). */
export const CM_BAY = { s0: 10.3, s1: 10.75 };
/** Lower engine-bay doors under each engine (bottom-sample quads 28–34, z ≈ 0.2–1.4; T.O. bottom-view panel map). */
export const ENGINE_DOOR = { s0: 12.95, s1: 14.9, q0: 28, q1: 34 };
/**
 * Main weapons bay: cavity 6.9 → 10.74, doors out to z ±0.97 (NAWDC bottom view: door edges at ±1.0, fold line at
 * ±0.36–0.4; T.O. 00-105E-9 bottom panel map: ±0.97, panels split at ±0.35; the T.O. map is to one scale, checked
 * on the stabilator vertex at ±2.78). The doors' aft edge is one big chevron per door, swept parallel to the wing
 * leading edge (NAWDC: 10.80 on the centre line, 11.20 at z ±0.45, 10.74 at the outer corner), so the cavity ends at
 * the corners and the chevron tips lie over a door land behind it; the gun's ammunition container lies across the
 * belly just aft of it, "immediately forward of the right main landing gear door" (T.O.).
 */
export const MAIN_BAY = { s0: 6.9, s1: 10.74, z: 0.97 };
/** Aft edge of the closed main-bay doors at |z| (the chevron). */
export const mainDoorAft = (z) => { const a = Math.abs(z), t = Math.tan(42 * DEG); return a <= 0.45 ? 10.80 + t * a : 10.80 + t * (0.9 - a); };
/**
 * Main-gear well (right side; z mirrors). The belly opening is L-shaped: a slot (s0 → sStep) for the leg, from
 * zSlot out to the trunk's lower corner, and the wheel bay (sStep → s1) from z0 out to z1, aft of the main weapons
 * bay, where the whole belly is free to take the 0.86 m wheel lying flat. Inside, the forward cavity (from cav0,
 * inboard wall at cavIn) holds the trunnion, brace and actuator. (Moved with the gear; the measured doors run
 * 11.1 → 12.3 and sit further outboard, which needs the retraction re-designed.)
 */
export const MAIN_WELL = { s0: 11.15, sStep: 11.89, sNotch: 11.94, s1: 12.83, zSlot: 1.05, zNotch: 0.86, z0: 0.55, cav0: 11.12, cavIn: 0.95 };
/**
 * Inboard edge of the main-gear well opening at station s: the slot, then the wheel bay, which keeps a notch
 * (zNotch) for its first few centimetres, clear of the saw teeth on the main-bay doors' aft edges.
 */
export function wellInner(s) {
  const W = MAIN_WELL;
  if (s <= W.sStep) return W.zSlot;
  if (s < W.sStep + 0.01) return lerp(W.zSlot, W.zNotch, (s - W.sStep) / 0.01);
  if (s <= W.sNotch) return W.zNotch;
  if (s < W.sNotch + 0.01) return lerp(W.zNotch, W.z0, (s - W.sNotch) / 0.01);
  return Math.max(W.z0, wellChamferIn(s));
}
/** The wheel bay's aft inboard corner is cut off on a diagonal too, so lines can pass between it and the engine. */
export const wellChamferIn = (s) => 0.55 + Math.max(0, s - (MAIN_WELL.s1 - 0.23)) * 1.3;
/**
 * Outboard edge of the opening, 4–5 cm inside the trunk's lower corner. It is also the belly's second sample
 * everywhere (the engine-change doors start on it), so it only widens by 1.2 cm along the well.
 */
export function wellOuter(s) {
  const W = MAIN_WELL, wb = bWb(s);
  const win = smooth(W.s0 - 0.3, W.s0, s) * (1 - smooth(W.s1, ENGINE_DOOR.s0, s));
  const o = Math.min(1.46, wb - 0.05) + 0.012 * win;
  if (s <= W.s1) return Math.min(o, wellChamfer(s));
  return lerp(Math.min(o, wellChamfer(W.s1)), o, smooth(W.s1, ENGINE_DOOR.s0, s));       // and back out to the engine doors
}
/**
 * The wheel bay's aft outboard corner is cut off on a diagonal (well clear of the stowed wheel), leaving room
 * for the generator on the front of the airframe gearbox.
 */
export const wellChamfer = (s) => 1.47 - Math.max(0, s - (MAIN_WELL.s1 - 0.23)) * (0.27 / 0.28);
/**
 * Main-gear well roof height at (s, z): high over the slot and over the wheel bay 0.3 m above the belly's mid-line,
 * held 2 cm under the inlet duct's floor wherever the duct comes down beside it (over the slot's inboard edge at
 * the fan face, and over the wheel bay).
 */
export function mainWellRoof(s, z) {
  let y = s < MAIN_WELL.sStep ? -0.40 : -0.42;
  for (let dz = -0.04; dz <= 0.0401; dz += 0.02) { const sp = ductSpan(s, z + dz); if (sp) y = Math.min(y, sp.lo - 0.02); }
  return y;
}
/** Inboard wall of the main-gear well cavity at station s (the forward cavity reaches in past the slot). */
export function wellInWall(s) {
  const W = MAIN_WELL;
  if (s <= W.sStep) return W.cavIn;
  if (s < W.sStep + 0.01) return lerp(W.cavIn, W.zNotch, (s - W.sStep) / 0.01);
  if (s <= W.sNotch) return W.zNotch;
  if (s < W.sNotch + 0.01) return lerp(W.zNotch, W.z0, (s - W.sNotch) / 0.01);
  return Math.max(W.z0, wellChamferIn(s));
}
/**
 * Outboard wall of the cavity at (s, y): straight up from the opening's edge over the slot (clear of the
 * countermeasure bay in the trunk wall beside it), parallel to the trunk's side skin over the wheel bay.
 */
export function wellWallZ(s, y) {
  if (s <= MAIN_WELL.sStep) return wellOuter(s);
  const D = bD(s);
  const wz = (yy) => wallZ(s, yy);
  const o = Math.min(1.46, bWb(s) - 0.05) + 0.012;
  return Math.min(wz(y) - (wz(-D) - o), wellChamfer(s));
}
/** Signed depth of (s, y, |z|) inside the right main-gear well cavity (> 0 inside; rough outside it). */
export function mainWellDepth(s, y, z) {
  const W = MAIN_WELL, az = Math.abs(z), sc = clamp(s, W.cav0, W.s1);
  const floor = sc < W.s0 ? -bD(sc) + 0.025 : -bD(sc);
  return Math.min(s - W.cav0, W.s1 - s, az - wellInWall(sc), wellWallZ(sc, y) - az, y - floor, mainWellRoof(sc, az) - y);
}
/**
 * Gear legs, gear down: trunnion [s, y, z], axle station / span, tyre radius and width (m). Wheelbase 6.01 m
 * (published 6.04 m; T.O. 00-105E-9 side view: nose axle 5.37, main 11.39). The nose leg retracts forward. The main
 * legs carry their wheels on a stub axle `stub` m outboard of the leg (leg foot at legZ), as photographs of the jet
 * show, so the strut never passes through the tyre; stowed, the wheel lies flat (axle vertical) with its centre at
 * `stow` [s, y], turning over between fractions `turn` of the retraction and pitching nose-down by `pitch` rad. The
 * weight-on-wheels switch sits on the leg at fraction k from trunnion to leg foot, `fwd` m ahead of the leg and `dz`
 * m to the side (× side for the mains), clear of the tyre and the torque links.
 */
export const GEAR = {
  nose: { trunnion: [5.66, -0.42, 0], axleS: 5.42, axleZ: 0, legZ: 0, r: 0.27, w: 0.19, stowS: 4.26, stowY: -0.47, wow: { k: 0.72, fwd: 0.11, dz: 0.075, box: [0.06, 0.05, 0.045] } },
  main: { trunnion: [11.48, -0.72, 1.265], axleS: 11.427, legZ: 1.36, axleZ: 1.66, stub: 0.30, r: 0.43, w: 0.29, stow: [12.351, -0.76], turn: [0.09, 0.80], pitch: 0.05, wow: { k: 0.5, fwd: 0, dz: -0.105, box: [0.05, 0.06, 0.05] } },
};
/** Centre [s, y, z] of a gear leg's weight-on-wheels switch box (gear down; right main for 'main'). */
export function wowCentre(g) {
  const [s0, y0, z0] = g.trunnion;
  const a = [g.axleS, GROUND + g.r, g.legZ];
  return [s0 + (a[0] - s0) * g.wow.k - g.wow.fwd, y0 + (a[1] - y0) * g.wow.k, z0 + (a[2] - z0) * g.wow.k + g.wow.dz];
}
/** Wall fractions (chine → lower corner) with exact knee and side-bay edges. */
export function wallFractions(s) {
  const D = bD(s);
  const fk = Math.min(B_KNEE / D, 0.35);
  const fa = clamp(SIDE_BAY.y0 / -D, fk + 0.05, 0.6), fb = clamp(SIDE_BAY.y1 / -D, fa + 0.1, 0.93);
  return [0, fk / 2, fk, (fk + fa) / 2, fa, fa + (fb - fa) / 3, fa + (2 * (fb - fa)) / 3, fb, (fb + 1) / 2, 1];
}
/** Trunk side at height y (0 … −D): the chine flange's underside in to the knee, then the inward-leaning trunk wall. */
export function wallZ(s, y) {
  const w = bW(s), wb = bWb(s), zk = bZk(s), D = bD(s), yk = Math.min(B_KNEE, 0.35 * D);
  const t = clamp(-y, 0, D);
  const flange = w + ((zk - w) * t) / yk;                 // chine flange underside, extended
  const wall = zk + ((wb - zk) * (t - yk)) / (D - yk);    // trunk wall, extended above the knee
  const r = 0.04;                                         // soft corner at the knee
  const d = flange - wall;
  return wall + (Math.abs(d) < r ? (d + r) * (d + r) / (4 * r) : Math.max(0, d));
}
/** Half-width of the forward fuselage's lower side (below the chine) at height y: the round native side blended
 *  into the inlets' leaning inner walls, as ringA builds it. */
export function aLowerZ(s, y) {
  const w = aW(s), yc = aYC(s), D = aHB(s) - yc;
  if (y >= yc) return w;
  let lo = 0, hi = w;
  for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (lowerAnative(s, m) < y) lo = m; else hi = m; }
  const [jz, jy] = aJunction(s), [cz] = aBoxCorner(s);
  const zb = y <= -D ? cz : jz + ((cz - jz) * (jy - y)) / (jy + D);
  return lerp((lo + hi) / 2, zb, bL(s));
}
/**
 * Clamp a point [s, y, z] (z signed) to lie at least m inside the fuselage skin, for routing pipes and harnesses
 * after the re-layout (forward and centre fuselage to the end of the full section; booms, wings and tails are left
 * alone).
 */
export function inBody(p, m = 0.03) {
  let [s, y, z] = p;
  if (s > S_BE) return p;
  const sg = z < 0 ? -1 : 1, B = s >= S_AB;
  let az = Math.min(Math.abs(z), (B ? bW(s) : aW(s)) - m);
  y = Math.min(y, topAt(s, az) - m);
  if (y < (B ? 0 : aYC(s))) az = Math.min(az, (B ? wallZ(s, y) : aLowerZ(s, y)) - m);
  y = Math.max(y, (B ? -bD(s) : bottomAt(s, az)) + m);
  return [s, y, sg * Math.max(0, az)];
}
/** Point on B's trunk wall at fraction f from the chine (0) to the lower corner (1). */
export function wallB(s, f) {
  const D = bD(s);
  return [wallZ(s, -D * f), -D * f];
}
/**
 * Belly sample z's at station s, corner → centre line: corner, the well opening's outboard and inboard edges
 * (with two between), then the main-bay edge and three more. Along the gear well the inboard edge follows the
 * opening (slot, then wheel bay) and aft of the weapons bay the bay samples tuck in under it; well forward and
 * from the engine-change doors aft the samples are the plain ones.
 */
export function bottomSamples(s) {
  const W = MAIN_WELL, wb = bWb(s);
  const o = wellOuter(s);
  // along the main bay the inner samples are the bay's edge and quarter lines; behind it they ease back to the
  // narrower spacing the engine-change doors and the well's tuck are built on
  const zB = lerp(MAIN_BAY.z, 0.78, smooth(MAIN_BAY.s1, MAIN_BAY.s1 + 0.3, s));
  const bay = [zB, zB * 0.75, zB * 0.5, zB * 0.25];
  const tuck = [0.47, 0.35, 0.235, 0.12];
  const ZI = lerp(1.08, 0.86, smooth(MAIN_BAY.s1, MAIN_BAY.s1 + 0.3, s));
  let zi = ZI, b = bay;
  if (s > W.s0 - 0.3 && s < W.s0) zi = lerp(ZI, W.zSlot, smooth(W.s0 - 0.3, W.s0, s));
  else if (s >= W.s0 && s <= W.s1) {
    zi = wellInner(s);
    const t = clamp((s - W.sNotch) / 0.01, 0, 1);
    b = bay.map((v, k) => lerp(v, tuck[k], t));
  } else if (s > W.s1 && s < ENGINE_DOOR.s0) {
    const t = smooth(W.s1, ENGINE_DOOR.s0, s);
    zi = lerp(wellInner(W.s1), 0.86, t); b = tuck.map((v, k) => lerp(v, bay[k], t));
  }
  return [wb, o, lerp(o, zi, 1 / 3), lerp(o, zi, 2 / 3), zi, ...b, 0];
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

// ------------------------------------------------------------------ tail booms, stinger
/**
 * Behind S_BE the aft fuselage splits: a boom each side of the nozzles (inner wall at zIn, the nozzle sidewall's
 * outer face) runs aft to an end cut at 43° in plan, from (zIn, sEnd0) out to (zEnd, sEnd1), parallel to the
 * stabilator's notch edge (NAWDC top and bottom views); the stinger between the nozzles (|z| < half) carries the
 * arresting hook and ends at sEnd.
 */
export const BOOM = { zIn: 1.16, sEnd0: 17.35, sEnd1: 18.08, zEnd: 2.0 };
/** Inner edge of the boom at station s (the 43° aft cut moves it outboard behind sEnd0). */
export const boomInner = (s) => BOOM.zIn + Math.max(0, s - BOOM.sEnd0) * ((BOOM.zEnd - BOOM.zIn) / (BOOM.sEnd1 - BOOM.sEnd0));
export const STINGER = { half: 0.14, s1: 17.5 };

// ------------------------------------------------------------------ caret inlet cowl
// Lip corners [z, y, s]: inner-top (the chine), outer-top, outer-bottom, inner-bottom (NAWDC top / bottom / front
// views, T.O. side view, Duluth underside photo). The top lip runs out from IT swept 42.6°, parallel to the wing
// leading edge; in plan the lower lip is a V (IB → OB swept back, OB → OT swept forward); in the front view the
// aperture is a parallelogram, both side walls leaning inboard at the bottom.
export const LIP = { IT: [0, 0, 4.78], OT: [1.90, 0.0, 5.72], OB: [1.35, -0.87, 6.10], IB: [0, -0.88, 5.35] };
const gap = (s) => 0.035 * (1 - smooth(5.2, 6.4, s));
const EDGE_N = { top: 8, outer: 9, bottom: 5, inner: 6 };
/**
 * Cowl point at loft fraction tau (0 lip → 1 at S_AB) for edge e and edge fraction f.
 * The inner edges ride on A's side (with the diverter gap); the outer ones blend to B.
 */
function cowlPoint(e, f, tau) {
  const sAt = (s0) => lerp(s0, S_AB, tau);
  const inner = (s, top) => {
    const g = gap(s);
    if (top) { const [jz, jy] = aJunction(s); return [jz + g, jy]; }
    const [cz, cy] = aBoxCorner(s);
    return [cz + g, cy];
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
/**
 * F119 front flange / fan face at s 11.55: the F119 is 196 in (4.98 m) long with its nozzle flaps open (TO 00-85-20
 * via Wikipedia) and its nozzle ends at s 16.5 (NAWDC top / bottom 16.3–16.65); Boeing's aft fuselage, which houses
 * the engines, is about 19 ft (5.8 m) long and ends at the booms (s ≈ 17.4), so it begins near 11.6; the AMAD cooling
 * screens on the T.O. bottom-view panel map sit at about 11.5–12.2.
 */
export const FAN_S = 11.55;
/** Engine centre lines 4 ft 3 in apart (T.O. 00-105E-9 "engine span"; NAWDC back view 1.28 m between the nozzles). */
export const ENG_Z = 0.655, ENG_Y = -0.12;
/** F119-PW-100 envelope (Wikipedia, from the USAF technical order): 38 in (0.97 m) at the inlet,
 *  48 in (1.22 m) overall, 50 in (1.27 m) maximum over the external accessories; 196 in long. */
export const F119 = { rInlet: 0.4826, rCase: 0.6, rAug: 0.575, rMax: 0.635, length: 196 * 0.0254 };
/** Station the full-diameter case ends and the augmentor starts, and the augmentor's outer radius as it tapers to
 *  the nozzle's transition section ([radius, s]; the nozzle itself lies inside the external flaps). */
export const AUG_S = EM(15.64);
export const F119_AUG = [[F119.rAug, AUG_S], [0.57, EM(16.0)], [0.53, EM(16.5)], [0.495, EM(16.9)], [0.49, EM(17.25)]];
export const DUCT = [
  // [s, z, y, width, height, roundness 0 (lip shape) … 1 (circle)]
  // A double S-bend, as the F-22's serpentine ducts keep the fan faces out of line of sight from any exterior
  // view: from the caret lip the duct climbs and swings inboard over the main weapons bay, then turns back
  // outboard and down onto the fan face. Re-solved for the 2025 stations so that no straight line through the lip
  // reaches the fan disc within ±40°, with the walls 3 cm or more off the bays and 5 cm inside the skin (the steep
  // drop onto the fan face just behind the bay is still to be smoothed). Lockheed Martin gives l/D = 6.35.
  [6.3, 1.18, -0.36, 0.76, 0.80, 0.10],
  [7.0, 1.089, -0.052, 0.741, 0.674, 0.22],
  [8.0, 0.778, 0.107, 0.678, 0.674, 0.40],
  [9.0, 0.412, 0.232, 0.667, 0.719, 0.55],
  [10.0, 0.488, 0.123, 0.721, 0.698, 0.70],
  [10.8, 0.548, 0.105, 0.831, 0.851, 0.85],
  [11.2, 0.618, 0.092, 0.904, 0.899, 0.95],
  [FAN_S, ENG_Z, ENG_Y, 0.98, 0.98, 1.0],
];

let ductCache = null;
/**
 * Duct liner rings (right side) as [x, y, z] points: the lip ring shrunk by the lip thickness (raked, so
 * its stations vary round the ring), then S-duct rings every 0.22 m from the first DUCT row to the fan face, each a
 * blend from the lip's shape toward a circle. The propulsion module lofts the liner through these rings;
 * ductSection() / ductDepth() cut the same surface so other modules can keep out of the air path.
 */
export function ductRings() {
  if (ductCache) return ductCache;
  const lip = cowlRing(0);
  const n = lip.length;
  let cz = 0, cy = 0;
  for (const p of lip) { cz += p[2]; cy += p[1]; }
  cz /= n; cy /= n;
  const inner = lip.map((p) => {
    const dz = p[2] - cz, dy = p[1] - cy, L = Math.hypot(dz, dy) || 1;
    const k = Math.max(0, 1 - 0.04 / L);
    return [p[0] - 0.03, cy + dy * k, cz + dz * k];
  });
  const rel = inner.map((p) => [p[2] - cz, p[1] - cy]);
  const ang = rel.map(([dz, dy]) => Math.atan2(dy, dz));
  const w0 = Math.max(...rel.map((r) => r[0])) - Math.min(...rel.map((r) => r[0]));
  const h0 = Math.max(...rel.map((r) => r[1])) - Math.min(...rel.map((r) => r[1]));
  const cols = [1, 2, 3, 4, 5].map((c) => DUCT.map((row) => [row[0], row[c]]));
  const rings = [inner];
  const st = [];
  for (let s = DUCT[0][0]; s < FAN_S - 0.01; s += 0.22) st.push(s);
  st.push(FAN_S);
  for (const s of st) {
    const [zc, yc, w, h, r] = cols.map((k) => mono(k, s));
    rings.push(rel.map(([dz, dy], j) => {
      const a = ang[j];
      const e = [Math.cos(a) * w / 2, Math.sin(a) * h / 2];
      const l = [(dz * w) / w0, (dy * h) / h0];
      return [X(s), yc + lerp(l[1], e[1], r), zc + lerp(l[0], e[0], r)];
    }));
  }
  ductCache = { lip, inner, rings, st: [null, ...st] };
  return ductCache;
}

// ductSection / ductDepth / ductSpan cut the liner exactly as it is lofted: between two rings the surface
// is linear, and between the raked lip ring and the first S-duct ring each point runs from its own station.
// They write into a scratch buffer instead of allocating, since the airframe calls them many thousand times.
let secZ = null, secY = null, secMeta = null;
function sectionInto(s) {
  const { inner, rings } = ductRings();
  if (!secMeta) {
    const sts = rings.map((r) => SN - r[0][0]);
    secMeta = { sts, sLip: Math.min(...inner.map((p) => SN - p[0])), n: inner.length };
    secZ = new Float64Array(inner.length); secY = new Float64Array(inner.length);
  }
  const { sts, sLip, n } = secMeta;
  if (s < sLip || s > FAN_S) return 0;
  const R0 = rings[1], s0 = sts[1];
  if (s < s0) {
    for (let j = 0; j < n; j++) {
      const p = inner[j], sj = SN - p[0], t = s > sj ? (s - sj) / (s0 - sj) : 0;
      secZ[j] = p[2] + (R0[j][2] - p[2]) * t; secY[j] = p[1] + (R0[j][1] - p[1]) * t;
    }
    return n;
  }
  let i = 1;
  while (i < rings.length - 2 && s > sts[i + 1]) i++;
  const A = rings[i], B = rings[i + 1], t = clamp((s - sts[i]) / (sts[i + 1] - sts[i]), 0, 1);
  for (let j = 0; j < n; j++) { secZ[j] = A[j][2] + (B[j][2] - A[j][2]) * t; secY[j] = A[j][1] + (B[j][1] - A[j][1]) * t; }
  return n;
}

/** Air-passage cross-section of the (right) duct at station s as [z, y] points, or null outside lip → fan face. */
export function ductSection(s) {
  const n = sectionInto(s);
  if (!n) return null;
  const out = [];
  for (let j = 0; j < n; j++) out.push([secZ[j], secY[j]]);
  return out;
}

/**
 * Signed distance (m) from the duct wall at station s: > 0 inside the engine air passage, < 0 outside
 * (either duct; z may be signed). A point is clear of the air path when ductDepth < −(its radius + gap).
 */
export function ductDepth(s, y, z) {
  const m = sectionInto(s);
  if (!m) return -1;
  const az = Math.abs(z);
  let inside = false, d2 = Infinity;
  for (let k = 0; k < m; k++) {
    const k2 = k + 1 === m ? 0 : k + 1;
    const z1 = secZ[k], y1 = secY[k], z2 = secZ[k2], y2 = secY[k2];
    if ((y1 > y) !== (y2 > y) && az < z1 + ((y - y1) * (z2 - z1)) / (y2 - y1)) inside = !inside;
    const dz = z2 - z1, dy = y2 - y1, L2 = dz * dz + dy * dy || 1;
    const u = clamp(((az - z1) * dz + (y - y1) * dy) / L2, 0, 1);
    const ez = az - z1 - u * dz, ey = y - y1 - u * dy, e2 = ez * ez + ey * ey;
    if (e2 < d2) d2 = e2;
  }
  const d = Math.sqrt(d2);
  return inside ? d : -d;
}

/** Lowest (floor) and highest (roof) duct-wall heights at station s and lateral position z, or null. */
export function ductSpan(s, z) {
  const m = sectionInto(s);
  if (!m) return null;
  const az = Math.abs(z);
  let lo = Infinity, hi = -Infinity;
  for (let k = 0; k < m; k++) {
    const k2 = k + 1 === m ? 0 : k + 1;
    const z1 = secZ[k], y1 = secY[k], z2 = secZ[k2], y2 = secY[k2];
    if ((z1 - az) * (z2 - az) > 0 || z1 === z2) continue;
    const y = y1 + ((az - z1) / (z2 - z1)) * (y2 - y1);
    if (y < lo) lo = y;
    if (y > hi) hi = y;
  }
  return lo <= hi ? { lo, hi } : null;
}

// ------------------------------------------------------------------ wing, tails
const tan = Math.tan;
export const WING = {
  // reference trapezoid: apex (centre-line LE) at s 6.58 (NAWDC LE fit s = 6.517 + 0.901 z, T.O. top 6.58–6.63,
  // Duluth photo 6.68), centre-line chord 9.844 m, tip chord 1.667 m: 78.04 m², 13.56 m, 42° / −17°
  apex: 6.58, c0: 9.844, le: 42 * DEG, te: -17 * DEG, semi: 6.78, anhedral: 3.25 * DEG,
  // the real tip is cut back parallel to the leading edge from the trailing-edge kink at z 5.87 (streamwise tip
  // chord ≈ 1.1 m: NAWDC 1.1, Virginia Tech notes 1.14, Duluth photo 1.0)
  kinkZ: 5.87,
  // the wing leaves the body at the chine, z ≈ 2.2 (NAWDC: root LE 8.50–8.56 at z 2.17–2.20)
  bodyZ: 2.2,
};
export const wingLE = (z) => WING.apex + z * tan(WING.le);
/** Station where the wing spar at chord fraction f meets the side of the body (the fuselage frame it bolts to). */
export const sparStation = (f) => wingLE(WING.bodyZ) + f * (wingTE(WING.bodyZ) - wingLE(WING.bodyZ));
/** Reference-trapezoid trailing edge (defines the 78.04 m² area and the section chords inboard of the kink). */
export const wingTEref = (z) => WING.apex + WING.c0 + z * tan(WING.te);
/** Real trailing edge: the reference line to the kink, then the 42° tip clip. */
export const wingTE = (z) => (z <= WING.kinkZ ? wingTEref(z) : wingTEref(WING.kinkZ) - (z - WING.kinkZ) * tan(WING.le));
/** Chord-plane height: 3.25° anhedral; the root sits just under the chine (NAWDC front view: wing root −0.35 → +0.12
 *  at z 2.4, tip −0.21 → −0.28; T.O.: tip 5 ft 5 in above the ground fully fuelled). */
export const wingY = (z) => -0.02 - (z - 1.45) * tan(WING.anhedral);
/** wingPanel section at span z (root t/c 5.92 %, tip 4.29 % per public data). The real wing uses
 *  NACA 64A-series sections with conical camber and twist; the model's sections are symmetric. */
export function wingSection(z) {
  const eta = (z - 1.45) / (WING.semi - 1.45);
  return { le: [X(wingLE(z)), wingY(z), z], chord: wingTE(z) - wingLE(z), t: lerp(0.0592, 0.0429, eta) };
}
/**
 * Control-surface spans (z): leading-edge flap 2.4 → 6.6 (NAWDC panel line, T.O. seal strips), flaperon from the
 * body to 4.50 and aileron 4.50 → 5.87, ending at the tip clip (NAWDC split line at 4.49 and kink at 5.87).
 */
export const SURF = { lef: [2.4, 6.6], flaperon: [2.22, 4.5], aileron: [4.5, 5.87], hinge: { flaperon: 0.85, aileron: 0.78, lef: 0.075 } };
/**
 * Trailing-edge actuators, one per surface (Flight International, 1997: "only one actuator on each control
 * surface"): span z, chord fraction c of the rod end, body length (m). teActuator() gives the rod end (s1), the
 * cylinder head (s0) and the mid-plane y at span z.
 */
export const TE_ACT = { flaperon: { z: 3.36, c: 0.79, len: 0.5 }, aileron: { z: 5.18, c: 0.72, len: 0.42 } };
export function teActuator(kind) {
  const a = TE_ACT[kind], z = a.z;
  const s = wingLE(z) + a.c * (wingTE(z) - wingLE(z));
  return { z, y: wingY(z), s0: s + 0.05 - a.len, s1: s + 0.05, sHinge: s };
}
/**
 * Stabilators (NAWDC top / bottom views, T.O. plan views, Duluth photo): leading edge s = 13.07 + 0.90 z (42°); tip
 * at z 4.42, LE 17.05, TE 18.38 (1.33 m chord); the outer trailing edge runs forward from the aft-most point of the
 * aircraft, the vertex at z 2.78 / s 18.92, and the notch edge from that vertex in to the root at +43°. Exposed root
 * at the boom side, z 1.95. On the jet the inboard leading edge tucks under the flaperon's trailing edge; the real
 * travel limits are not published, so the model cuts that inboard edge back to run 6 cm behind the wing's trailing
 * edge, which keeps the all-moving tail clear of the wing at any deflection. Pivot station unverified.
 */
export const STAB = { rootZ: 1.95, tipZ: 4.42, vertexZ: 2.78, vertexS: 18.92, tipTE: 18.38, notchSlope: Math.tan(43 * DEG), le0: 13.07, y: -0.1, pivotS: 16.5 };
const stabLEraw = (z) => STAB.le0 + z * tan(42 * DEG);
/** z where the raw leading edge passes behind the wing's trailing edge (+6 cm); inboard of it the edge is cut back. */
STAB.notchZ = (() => { let lo = STAB.rootZ, hi = STAB.tipZ; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (stabLEraw(m) < wingTE(m) + 0.06) lo = m; else hi = m; } return (lo + hi) / 2; })();
/** Stabilator leading edge at span z (cut back inboard of notchZ to run just behind the wing trailing edge). */
export function stabLE(z) {
  return z >= STAB.notchZ ? stabLEraw(z) : wingTE(z) + 0.06;
}
/** Stabilator trailing edge at span z: notch edge inboard of the vertex, outer trailing edge outboard. */
export function stabTE(z) {
  if (z <= STAB.vertexZ) return STAB.vertexS - (STAB.vertexZ - z) * STAB.notchSlope;
  return STAB.vertexS + ((STAB.tipTE - STAB.vertexS) * (z - STAB.vertexZ)) / (STAB.tipZ - STAB.vertexZ);
}
export function stabSection(z) {
  const le = stabLE(z);
  const eta = (z - STAB.rootZ) / (STAB.tipZ - STAB.rootZ);
  return { le: [X(le), STAB.y, z], chord: stabTE(z) - le, t: lerp(0.045, 0.035, eta) };
}
/** Span stations where the stabilator outline turns (root, notch, vertex, tip). */
export const STAB_BREAKS = () => [STAB.rootZ, STAB.notchZ, STAB.vertexZ, STAB.tipZ];
// vertical tail: built in a local frame (chord toward −x, span along +z) then canted 28° outward. NAWDC side view and
// side-on photo: root LE (where it meets the deck line) 13.05, tip LE 14.38, tip TE 15.65, root TE 16.92; fin root
// at y 0.15 on the boom (back view), tip 2.98 m above the chine plane (5.07 m above the ground), tips 5.97 m apart
// (T.O. 19 ft 7 in; NAWDC 5.98)
export const FIN = { rootS: 12.82, rootZ: 1.485, rootY: 0.15, span: 3.205, rootC: 4.10, tipC: 1.27, sweep: Math.atan(0.486), cant: 28 * DEG };

/** Slope of a saw-tooth edge: parallel to the 42° wing leading edge (ds/dz = tan 42°). */
export const TOOTH_SLOPE = Math.tan(42 * DEG);

/**
 * Point grid for a flush door or panel whose fore and aft edges are saw-toothed, the way every F-22
 * door edge is: each tooth edge runs parallel to the wing leading edge, so its radar reflection joins
 * the few directions the planform already uses. `point(s, u)` is the outer-surface point at station s
 * and lateral parameter u (0 … 1); `width` is the panel width (m). With `cut` false the teeth reach
 * past s0 / s1 over the surrounding skin (the cut-out stays rectangular); with `cut` true they are
 * notched into the panel instead (nozzle-flap trailing edges). Pitch ≈ 0.2 m (estimate).
 */
export function toothedGrid(point, stations, { width, pitch = 0.2, fore = true, aft = true, cut = false } = {}) {
  const n = Math.max(1, Math.round(width / pitch));
  const cols = 2 * n + 1;
  const a = TOOTH_SLOPE * (width / (2 * n));
  const s0 = stations[0], s1 = stations[stations.length - 1], last = stations.length - 1;
  return stations.map((s, r) => [...Array(cols).keys()].map((k) => {
    let ss = s;
    if (k % 2 === 1) {
      if (r === 0 && fore) ss = cut ? s0 + a : s0 - a;
      if (r === last && aft) ss = cut ? s1 - a : s1 + a;
    }
    return point(ss, k / (cols - 1));
  }));
}

// ------------------------------------------------------------------ main weapons bay layout
/** Main-bay ceiling height at lateral position z: flat inboard under the inlet ducts' floors, then sloping down
 *  outboard of z 0.55 to the bay wall at 0.97, under the ducts' outer lower corners and inboard of the side bays;
 *  the bay is 0.67 m deep at the centre under the 1.01 m belly (bay depth not published). */
export const BAY_CEIL = -0.34, BAY_CEIL_WALL = -0.70, BAY_CEIL_BREAK = 0.55;
export const bayCeil = (z) => (Math.abs(z) < BAY_CEIL_BREAK ? BAY_CEIL : BAY_CEIL - ((Math.abs(z) - BAY_CEIL_BREAK) / (MAIN_BAY.z - BAY_CEIL_BREAK)) * (BAY_CEIL - BAY_CEIL_WALL));
/** The ceiling is the same along the bay (the duct floors stay above it to the aft wall), kept as a function of s
 *  for the parts that follow it. */
export const BAY_AFT = { s0: MAIN_BAY.s1 - 0.5, s1: MAIN_BAY.s1, zBreak: BAY_CEIL_BREAK };
export function bayCeilAt(s, z) { return bayCeil(z); }
/**
 * AIM-120C stations in the right half of the main bay: [z, y, fin angle in the z–y plane]. Solved
 * numerically (simulated annealing) so the three missiles, their 44.7 cm wings and fins, the AVEL
 * hangers and ejector arms clear each other, the centre-line web, the bay wall and the closed doors,
 * and so each missile drops 23 cm clear of the open bifold doors: a zig-zag, inner and outer low,
 * middle high. The real stagger is not published in this detail.
 */
export const AMRAAM_SLOTS = [[0.2062, -0.7921, 0.8119], [0.4676, -0.5801, -0.1753], [0.7062, -0.7323, -0.0698]];
/** Station of the missiles' (and launchers') mid-length: centred in the cavity. */
export const AMRAAM_S = (MAIN_BAY.s0 + MAIN_BAY.s1) / 2;
export const AMRAAM = { r: 0.0889, tip: 0.2235, length: 3.65 };
/** Bifold main-bay doors: inner edge, fold line (NAWDC / T.O. bottom views: panel joint at ±0.35–0.4, so the outer
 *  panel is the wider one) and panel thickness (m); the centre divider web. */
export const MAIN_DOOR = { zIn: 0.03, zFold: 0.36, thick: 0.035 };
export const DIVIDER = { half: 0.015, cap: 0.03 };
/** AVEL ejection stroke (9 in) and the inboard face of the open, folded doors below the belly. */
export const AVEL_STROKE = 9 * 0.0254;
export const OPEN_DOOR_Z = MAIN_BAY.z - 2 * MAIN_DOOR.thick + 0.005;
/**
 * Main-bay door drive (right side; z mirrors): the torque shaft and its geared rotary actuators run along the
 * bay sill just above the edge longeron and clear of the bay's outboard missile, axis at (z, y). Each actuator
 * turns a crank that a link ties to a fitting on the outer door panel, `fit` (dz, dy) from the door hinge on
 * the panel's inner face; crank and fitting arm stay parallel, so the link keeps its length through the swing.
 */
export const BAY_DRIVE = { z: MAIN_BAY.z + 0.025, y: -0.865, r: 0.035, shaftR: 0.016, stations: [7.42, 8.82, 10.22], s0: 7.36, s1: 10.28, pdu: 8.15, fit: [-0.03, 0.033] };

// ------------------------------------------------------------------ gun, ammunition, APU / SES, accessory drives
/** M61A2 in the right wing root: barrel axis (z, y), muzzle and breech stations (1.83 m gun; T.O. 00-105E-9 top panel
 *  map: gun port 8.4–9.3, gun access panel to 10.5). */
export const GUN = { z: 1.72, y: 0.0, muzzle: 8.55, breech: 10.38 };
/**
 * Linear linkless ammunition container (GD-OTS F-22A gun system sheet and Wolff, NDIA 2007): a 9.1 × 9.3 in box laid
 * across the aircraft, 99.8 in from the gun's outer side to its far end, its top 44 in below the gun's transfer unit;
 * T.O. 00-105E-9: "immediately forward of the right main landing gear door and across the belly", just behind the
 * main weapons bay (its side view shows it there, ahead of the main wheel). [s0, s1] × [z0 (far end), z1 (gun end)] ×
 * [y0, y1].
 */
export const AMMO = { s0: 10.77, s1: 11.0, z0: -0.705, z1: 1.40, y0: -0.972, y1: -0.735 };
/** APU in the left wing root between its upper-surface inlet and exhaust doors (T.O. top panel map: inlet door #4263
 *  ≈ 9.75–10.2, exhaust door #4289 ≈ 10.5–10.95; NAWDC top view: exhaust diamond at 10.45–10.95, z ≈ −1.45…−1.75),
 *  between the wing-carry-through frames; the SES air and fuel bottles are under the upper panel between the engines
 *  (T.O. panel #4336, ≈ 13.5–14.3). */
export const APU = { s0: 10.3, s1: 10.92, z: -1.70, y: -0.03, inlet: [9.75, 10.2], exhaust: [10.5, 10.95] };
export const SES = { s0: 13.5, s1: 14.3 };
/** Airframe-mounted accessory drive under the front of each engine, over the AMAD bay screens on the belly (T.O. bottom
 *  panel map: AMAD screens #4223 / #4224 ≈ 11.3–11.7, z ≈ ±0.45–0.8; air-turbine-starter exhaust screens ≈ 12.0–12.4). */
export const AMAD = { s0: 11.36, s1: 11.84, z: 0.62, y: -0.865, w: 0.27, h: 0.2 };
/**
 * Space kept free for the landing-gear wells, which the next phase re-designs: the main wheel bays (NAWDC / T.O. bottom
 * views: doors ≈ 11.0–12.3, z ≈ 1.1–2.45, outboard of the engine bays) up to y −0.25, and the nose well between the
 * inlets (doors ≈ 4.65–6.0) up to the cockpit floor. Nothing new is placed in them.
 */
export const WELL_RESERVE = { main: { s0: 10.98, s1: 12.4, z0: 1.08, z1: 2.5, y1: -0.25 }, nose: { s0: 4.45, s1: 6.15, z: 0.30, y1: -0.05 } };

/** F119 mounts: forward trunnions on the engine-bay frame at the wing's mid titanium spar (into the keel web and the
 *  titanium boom, whose inner face is at boomZ), aft link at the rear engine-bay frame, up to a fitting at aftY. */
export const ENGINE_MOUNTS = { fwd: sparStation(0.49), aft: 14.75, boomZ: 1.45, aftY: upperB(14.75, ENG_Z + 0.3) - 0.085 };

// ------------------------------------------------------------------ lighting
/**
 * Anti-collision strobe brightness (emissive intensity) at time t (s) since the strobes came on:
 * one soft 0.12 s pulse per second. The model runs this clock only while the lab's flight mode
 * is on, so the strobes stay dark in the showroom and hangar.
 */
export const STROBE = { period: 1.0, pulse: 0.12, peak: 5 };
export function strobeLevel(t) {
  const ph = ((t % STROBE.period) + STROBE.period) % STROBE.period;
  return ph < STROBE.pulse ? STROBE.peak * Math.sin((Math.PI * ph) / STROBE.pulse) : 0;
}

// ------------------------------------------------------------------ ring helpers
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
