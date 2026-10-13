// MQ-9A Reaper outer mould line and geometry helpers, in metres.
// Axes (same as the rest of uav.js): nose toward +x, y up, starboard wing toward +z, the ground
// at y = 0 with the aircraft on its wheels. Fuselage stations s run aft from the nose tip:
// x = 5.5 − s, so the 11.0 m aircraft spans x = +5.5 (nose) … −5.45 (spinner tip).
//
// The profile is fitted to the USAF / GA-ASI figures (length 11 m, span 20.1 m, height 3.81 m)
// and to published photographs: a bulbous upper nose (Ku-band SATCOM radome), a near-flat top
// line and a bottom line that sweeps up to the pusher propeller. Section shapes are estimates.

import * as THREE from 'three';
import { loftRings, orientOutward, interpKeys, naca00, mergeGeometries } from '../../engine/geometry.js';

export const X = (s) => 5.5 - s;

// [s, top y, bottom y, half-width]
const KEYS = [
  [0.00, 1.40, 1.30, 0.04],
  [0.10, 1.62, 1.15, 0.24],
  [0.30, 1.80, 1.05, 0.34],
  [0.65, 1.92, 1.00, 0.41],
  [1.10, 1.97, 0.99, 0.43],
  [1.60, 1.95, 0.99, 0.43],
  [2.20, 1.87, 1.00, 0.41],
  [2.90, 1.84, 1.00, 0.40],
  [3.70, 1.85, 1.00, 0.41],
  [4.50, 1.86, 1.01, 0.42],
  [5.30, 1.86, 1.04, 0.42],
  [6.20, 1.85, 1.10, 0.41],
  [7.10, 1.85, 1.18, 0.39],
  [8.00, 1.85, 1.27, 0.36],
  [8.80, 1.85, 1.36, 0.32],
  [9.50, 1.85, 1.45, 0.27],
  [10.00, 1.87, 1.55, 0.205],
  [10.40, 1.88, 1.58, 0.15],
];
const col = (c) => KEYS.map((k) => [k[0], k[c]]);
const TOP = col(1), BOT = col(2), HW = col(3);
export const FUSE_END = 10.4;
const P = 2.4;               // superellipse exponent: rounded-rectangle sections

/** Fuselage section at station s: { top, bot, hw, yc } (absolute y). */
export function prof(s) {
  const top = interpKeys(TOP, s), bot = interpKeys(BOT, s), hw = interpKeys(HW, s);
  return { top, bot, hw, yc: (top + bot) / 2 };
}

/** Point on the section at station s, angle θ (0 = starboard side, π/2 = top), inset d metres. */
export function fusePoint(s, th, d = 0) {
  const { top, bot, hw, yc } = prof(s);
  const a = Math.max(0.005, (top - bot) / 2 - d), b = Math.max(0.005, hw - d);
  const c = Math.cos(th), sn = Math.sin(th);
  return [X(s), yc + a * Math.sign(sn) * Math.abs(sn) ** (2 / P), b * Math.sign(c) * Math.abs(c) ** (2 / P)];
}

/** Closed section ring. The seam sits on the keel (θ = −π/2) where it never catches a highlight. */
export function ring(s, n = 44, d = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) pts.push(fusePoint(s, -Math.PI / 2 + (i / n) * Math.PI * 2, d));
  return pts;
}

/** Fuselage outer skin as one smooth loft; split it into panels afterwards with splitTris. */
export function fuselageLoft(stations, n = 44) {
  return orientOutward(loftRings(stations.map((s) => ring(s, n)), { capStart: true, capEnd: true, uvMode: 'metric-x' }));
}

/** Station list with breaks exactly at the given panel joints. */
export function stationsWithBreaks(breaks, step = 0.2) {
  const out = [0, 0.015, 0.04, 0.075, 0.12, 0.18, 0.25];
  let s = 0.25;
  while (s < FUSE_END - 1e-6) {
    const nextBreak = breaks.find((b) => b > s + 1e-6);
    const next = Math.min(s + (s < 1.2 ? 0.12 : step), nextBreak ?? FUSE_END, FUSE_END);
    out.push(+next.toFixed(4));
    s = next;
  }
  return out;
}

/** Split a geometry's triangles into buckets by classify(cx, cy, cz) → key (normals and UVs kept). */
export function splitTris(geo, classify) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position.array, nor = g.attributes.normal.array, uv = g.attributes.uv?.array;
  const buckets = new Map();
  for (let t = 0; t < pos.length; t += 9) {
    const cx = (pos[t] + pos[t + 3] + pos[t + 6]) / 3, cy = (pos[t + 1] + pos[t + 4] + pos[t + 7]) / 3, cz = (pos[t + 2] + pos[t + 5] + pos[t + 8]) / 3;
    const k = classify(cx, cy, cz);
    if (k == null) continue;
    if (!buckets.has(k)) buckets.set(k, { p: [], n: [], u: [] });
    const b = buckets.get(k);
    for (let j = 0; j < 9; j++) { b.p.push(pos[t + j]); b.n.push(nor[t + j]); }
    if (uv) { const u0 = (t / 9) * 6; for (let j = 0; j < 6; j++) b.u.push(uv[u0 + j]); }
  }
  const out = new Map();
  for (const [k, b] of buckets) {
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
    bg.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
    if (uv) bg.setAttribute('uv', new THREE.Float32BufferAttribute(b.u, 2));
    out.set(k, bg);
  }
  return out;
}

/** Strip a geometry to position / normal / uv, non-indexed, so mixed primitives merge. */
export function clean(g) {
  let n = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
  if (!n.attributes.normal) n.computeVertexNormals();
  if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
  n.morphAttributes = {};
  return n;
}

/** Merge any mix of geometries into one. */
export function merge(list) {
  return mergeGeometries(list.filter(Boolean).map(clean));
}

/** Box centred at c with optional Euler rotation. */
export function box(w, h, d, c = [0, 0, 0], rot = null) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot)));
  return g.translate(...c);
}

/** Rounded box (an LRU, a battery): box with chamfered vertical edges via an extruded rounded rect. */
export function lru(w, h, d, c = [0, 0, 0], r = 0.012) {
  const sh = new THREE.Shape();
  const x0 = -w / 2, z0 = -d / 2;
  sh.moveTo(x0 + r, z0); sh.lineTo(x0 + w - r, z0); sh.quadraticCurveTo(x0 + w, z0, x0 + w, z0 + r);
  sh.lineTo(x0 + w, z0 + d - r); sh.quadraticCurveTo(x0 + w, z0 + d, x0 + w - r, z0 + d);
  sh.lineTo(x0 + r, z0 + d); sh.quadraticCurveTo(x0, z0 + d, x0, z0 + d - r);
  sh.lineTo(x0, z0 + r); sh.quadraticCurveTo(x0, z0, x0 + r, z0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 2 });
  g.rotateX(-Math.PI / 2);
  g.translate(c[0], c[1] - h / 2, c[2]);
  g.computeVertexNormals();
  return g;
}

/** Cylinder of radius r0 → r1 along the x axis from x0 to x1, centred at (y, z). */
export function cylX(x0, x1, r0, r1, y = 0, z = 0, seg = 20, open = false) {
  const g = new THREE.CylinderGeometry(r1, r0, Math.abs(x1 - x0), seg, 1, open);
  g.rotateZ(-Math.PI / 2);             // +y → +x : r0 at x0 (low x), r1 at x1
  if (x1 < x0) g.rotateY(Math.PI);
  return g.translate((x0 + x1) / 2, y, z);
}

/** Cylinder between two points. */
export function tubeBetween(p0, p1, r = 0.02, seg = 10) {
  const a = new THREE.Vector3(...p0), b = new THREE.Vector3(...p1);
  const g = new THREE.CylinderGeometry(r, r, a.distanceTo(b), seg, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
  const m = a.add(b).multiplyScalar(0.5);
  return g.translate(m.x, m.y, m.z);
}

/** Smooth tube through a polyline (fuel lines, harnesses). */
export function pipe(points, r = 0.012, seg = 6, tubular = null) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  return new THREE.TubeGeometry(curve, tubular || Math.max(8, points.length * 8), r, seg, false);
}

/** Lathe about the x axis: profile [[r, x], …] with x increasing toward the nose. */
export function latheX(profile, seg = 24) {
  const g = new THREE.LatheGeometry(profile.map(([r, x]) => new THREE.Vector2(Math.max(r, 1e-4), x)), seg);
  g.rotateZ(-Math.PI / 2);             // lathe axis +y → +x
  return g;
}

/** Ring frame (hoop) inside the skin at station s: flange depth along x, radial height h. */
export function hoop(s, { inset = 0.012, h = 0.045, depth = 0.03, n = 36, from = -Math.PI / 2, to = Math.PI * 1.5 } = {}) {
  const outer0 = [], outer1 = [], inner0 = [], inner1 = [];
  const full = Math.abs(to - from - Math.PI * 2) < 1e-6;
  const cnt = full ? n : n + 1;
  for (let i = 0; i < cnt; i++) {
    const th = from + ((to - from) * i) / n;
    const a = fusePoint(s - depth / 2, th, inset), b = fusePoint(s + depth / 2, th, inset);
    const c = fusePoint(s + depth / 2, th, inset + h), d = fusePoint(s - depth / 2, th, inset + h);
    outer0.push(a); outer1.push(b); inner1.push(c); inner0.push(d);
  }
  if (full) return orientOutward(loftRings([outer0, outer1, inner1, inner0, outer0], { uvMode: 'metric' }));
  // open arc: build as a strip of closed quads around the arc
  const rings = [];
  for (let i = 0; i < cnt; i++) rings.push([outer0[i], outer1[i], inner1[i], inner0[i]]);
  return orientOutward(loftRings(rings, { capStart: true, capEnd: true, uvMode: 'metric' }));
}

/** Apply a matrix; a mirroring matrix (negative determinant) also flips the triangle winding. */
export function applyMat(g, m) {
  g.applyMatrix4(m);
  if (m.determinant() < 0) {
    if (g.index) {
      const a = g.index.array;
      for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; }
    } else {
      for (const attr of Object.values(g.attributes)) {
        const a = attr.array, k = attr.itemSize;
        for (let t = 0; t < attr.count; t += 3) for (let j = 0; j < k; j++) { const i1 = (t + 1) * k + j, i2 = (t + 2) * k + j; const v = a[i1]; a[i1] = a[i2]; a[i2] = v; }
      }
    }
  }
  return g;                            // applyMatrix4 already carried the normals through the matrix
}

/** Flat plate filling the fuselage section at s (bulkheads, firewall). */
export function bulkhead(s, { inset = 0.015, thick = 0.012, n = 40 } = {}) {
  const pts = ring(s, n, inset);
  const sh = new THREE.Shape(pts.map((p) => new THREE.Vector2(p[2], p[1])));
  const g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: false, curveSegments: 1 });
  // shape (u = z, v = y), extrusion w → x
  return applyMat(g, new THREE.Matrix4().set(0, 0, 1, X(s) - thick / 2, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1));
}

// ------------------------------------------------------------------------------------- wing
// Planform fitted to the 20.1 m span and an estimated 24 m² reference area (aspect ratio 16.8):
// root chord 1.65 m at the centreline, tip chord 0.74 m, a nearly straight leading edge and
// about 1.5° of dihedral. Thickness 16 % at the root to 12 % at the tip (estimates).
export const WING = {
  semi: 10.05,
  le0: [1.42, 1.66], le1: [1.12, 1.66 + 10.05 * Math.tan((1.5 * Math.PI) / 180)],
  c0: 1.65, c1: 0.74, t0: 0.16, t1: 0.12,
  twist: -2.5,                 // washout at the tip, deg (wingPanel sign: negative = tip nose-down)
  zRoot: 0.40,                 // wing panels start just inside the fuselage side
};

/** Wing section at span station z (≥ 0) on the full planform. */
export function wsec(z) {
  const e = z / WING.semi;
  return {
    le: [WING.le0[0] + (WING.le1[0] - WING.le0[0]) * e, WING.le0[1] + (WING.le1[1] - WING.le0[1]) * e, z],
    chord: WING.c0 + (WING.c1 - WING.c0) * e,
    t: WING.t0 + (WING.t1 - WING.t0) * e,
  };
}

export const W_ROOT = wsec(WING.zRoot);
export const W_TIP = wsec(WING.semi - 0.06);

/**
 * Point on the wing surface exactly as wingPanel builds it (same root/tip, same twist law):
 * z span station, cf chord fraction, side +1 upper / −1 lower / 0 camber line, inset metres.
 */
export function wpt(z, cf, side = 0, inset = 0, root = W_ROOT, tip = W_TIP, twist = WING.twist) {
  const eta = (z - root.le[2]) / (tip.le[2] - root.le[2]);
  const le = [0, 1].map((i) => root.le[i] + (tip.le[i] - root.le[i]) * eta);
  const chord = root.chord + (tip.chord - root.chord) * eta;
  const t = root.t + (tip.t - root.t) * eta;
  const tw = (twist * eta * Math.PI) / 180;
  const dx = -cf * chord;
  const dy = side ? side * Math.max(0, naca00(Math.min(1, Math.max(0, cf)), t) * chord - inset) : 0;
  return [le[0] + dx * Math.cos(tw) - dy * Math.sin(tw), le[1] + dx * Math.sin(tw) + dy * Math.cos(tw), z];
}

/** Box-section spar web following the wing between z0 and z1 at chord fraction cf. */
export function sparGeo(z0, z1, cf, { width = 0.03, inset = 0.008, steps = 10, root = W_ROOT, tip = W_TIP, twist = WING.twist } = {}) {
  const rings = [];
  for (let k = 0; k <= steps; k++) {
    const z = z0 + ((z1 - z0) * k) / steps;
    const u0 = wpt(z, cf - width / 2 / ((root.chord + tip.chord) / 2), 1, inset, root, tip, twist);
    const u1 = wpt(z, cf + width / 2 / ((root.chord + tip.chord) / 2), 1, inset, root, tip, twist);
    const l1 = wpt(z, cf + width / 2 / ((root.chord + tip.chord) / 2), -1, inset, root, tip, twist);
    const l0 = wpt(z, cf - width / 2 / ((root.chord + tip.chord) / 2), -1, inset, root, tip, twist);
    rings.push([u0, u1, l1, l0]);
  }
  return orientOutward(loftRings(rings, { capStart: true, capEnd: true, uvMode: 'metric' }));
}

/**
 * Rib: airfoil-shaped plate at span z between chord fractions c0..c1, thickness th. `holes` lists
 * chord fractions for elliptical lightening / fuel-flow holes centred on the camber line.
 */
export function ribGeo(z, c0, c1, { th = 0.01, inset = 0.006, n = 14, root = W_ROOT, tip = W_TIP, twist = WING.twist, holes = [] } = {}) {
  const up = [], lo = [];
  for (let i = 0; i <= n; i++) {
    const cf = c0 + ((c1 - c0) * (1 - Math.cos((Math.PI * i) / n))) / 2;
    up.push(wpt(z, cf, 1, inset, root, tip, twist));
    lo.push(wpt(z, cf, -1, inset, root, tip, twist));
  }
  const loop = up.concat(lo.reverse());
  const sh = new THREE.Shape(loop.map((p) => new THREE.Vector2(p[0], p[1])));
  const eta = (z - root.le[2]) / (tip.le[2] - root.le[2]);
  const chord = root.chord + (tip.chord - root.chord) * eta;
  for (const cf of holes) {
    const a = wpt(z, cf, 1, inset, root, tip, twist), b = wpt(z, cf, -1, inset, root, tip, twist);
    const ry = Math.abs(a[1] - b[1]) * 0.27;
    const hole = new THREE.Path();
    hole.absellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, chord * 0.05, ry, 0, Math.PI * 2, false);
    sh.holes.push(hole);
  }
  const g = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false, curveSegments: holes.length ? 5 : 1 });
  return g.translate(0, 0, z - th / 2);
}
