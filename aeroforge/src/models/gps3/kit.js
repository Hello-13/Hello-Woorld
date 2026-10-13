// Shared dimensions and small geometry helpers for the GPS III model.
//
// Axes (metres): the GPS spacecraft body frame used by the IGS. +Z points at the Earth (nadir, the
// L-band antenna side), +Y runs along the solar-array axis (the two radiator faces), +X completes
// the right-handed set and faces the Sun's hemisphere under yaw steering. Origin at the centre of
// the bus box.
//
// Size: the U.S. Space Force fact sheet gives 97 in wide × 70 in deep × 134 in high
// (2.46 × 1.78 × 3.40 m). The 97-in width is taken along the array axis (Y), as in the IGS
// box-wing model, whose X face (≈ 7.5 m²) is about twice the Z face (≈ 4.0 m²). The 134-in height
// is read as the stowed height from the separation plane to the antenna tops (an assumption), which
// leaves a 2.80 m box.

import * as THREE from 'three';
import { mergeGeometries } from '../../engine/geometry.js';
import { mesh } from '../../engine/assembly.js';
import { G } from './materials.js';

export const BX = 1.78, BY = 2.46, BZ = 2.80;         // bus box (fact-sheet footprint; height see above)
export const HX = BX / 2, HY = BY / 2, HZ = BZ / 2;
export const T = 0.025;                               // honeycomb panel thickness
export const RC = 0.62;                               // central cylinder radius (estimate)
export const IX = HX - T, IY = HY - T, IZ = HZ - T;   // inner faces of the closure panels
export const DECK = HZ + 0.012;                       // top of the Earth-deck blanket
export const AFT = -HZ - 0.013;                       // outer face of the aft-deck blanket

/** Non-indexed copy so geometries of any kind can be merged. */
export const flat = (g) => (g.index ? g.toNonIndexed() : g);
export const merge = (list) => mergeGeometries(list.map(flat));

/** Axis-aligned box geometry centred at c with size s. */
export function boxG(c, s) {
  return new THREE.BoxGeometry(s[0], s[1], s[2]).translate(c[0], c[1], c[2]);
}

/** Cylinder geometry along an axis ('x' | 'y' | 'z') centred at c. r is the −axis end radius, r2 the +axis end. */
export function cylG(c, r, h, axis = 'z', seg = 24, r2 = r, open = false) {
  const g = new THREE.CylinderGeometry(r2, r, h, seg, 1, open);   // Three's cylinder runs along +Y, top radius first
  if (axis === 'x') g.rotateZ(-Math.PI / 2);
  else if (axis === 'z') g.rotateX(Math.PI / 2);
  return g.translate(c[0], c[1], c[2]);
}

/** Cylinder between two points. */
export function rodG(a, b, r, seg = 10) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const g = new THREE.CylinderGeometry(r, r, A.distanceTo(B), seg, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()));
  const m = A.add(B).multiplyScalar(0.5);
  return g.translate(m.x, m.y, m.z);
}

/** Polyline tube with gently rounded corners (plumbing / harness runs). */
export function pipeG(points, r = 0.006, radial = 6) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = new THREE.Vector3(...points[i]), b = new THREE.Vector3(...points[i + 1]);
    const len = a.distanceTo(b);
    if (len < 1e-4) continue;
    const g = new THREE.CylinderGeometry(r, r, len, radial, 1, true);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
    const m = a.clone().add(b).multiplyScalar(0.5);
    g.translate(m.x, m.y, m.z);
    out.push(g);
    if (i > 0) out.push(new THREE.SphereGeometry(r, radial, 4).translate(a.x, a.y, a.z));
  }
  return merge(out);
}

/** Flat polygon (x, y points) extruded `thick` along z, bottom face at z0. */
export function plateG(points, thick, z0, holes = []) {
  const s = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) s.holes.push(h);
  return new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 40 }).translate(0, 0, z0);
}

/** Regular octagon (flat sides on the axes) of across-flats size d, as x, y points. */
export function octagon(cx, cy, d) {
  const R = d / 2 / Math.cos(Math.PI / 8);
  return Array.from({ length: 8 }, (_, k) => {
    const a = Math.PI / 8 + (k * Math.PI) / 4;
    return [cx + Math.cos(a) * R, cy + Math.sin(a) * R];
  });
}

/** Helical conductor of radius r between z0 and z1, centred on (x, y). */
export function helixG(x, y, r, z0, z1, turns, wire = 0.0032, phase = 0, r1 = r) {
  const pts = [];
  const n = Math.max(8, Math.ceil(turns * 16));
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = phase + t * turns * Math.PI * 2, rr = r + (r1 - r) * t;
    pts.push(new THREE.Vector3(x + Math.cos(a) * rr, y + Math.sin(a) * rr, z0 + (z1 - z0) * t));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, wire, 5, false);
}

const AX = { x: 0, y: 1, z: 2 };

/**
 * An avionics box: body, mounting flange on the panel side and a row of connectors on one face.
 * c: centre, s: size [x, y, z], mount: '+x'|'-x'|'+y'|'-y'|'+z'|'-z' (the face against the panel),
 * conn: the face carrying the connectors, n: connector count, fins: ribs on the free face.
 * Returns two meshes (body in `mat`, connectors in a dark metal).
 */
export function unit(c, s, mat, { mount = '+y', conn = '-z', n = 4, fins = 0 } = {}) {
  const body = [boxG(c, s)];
  const ma = AX[mount[1]], msign = mount[0] === '+' ? 1 : -1;
  // flange: a thin plate 3 cm larger than the footprint, at the mounting face
  const fs = s.slice(); const fc = c.slice();
  fs[ma] = 0.006; fc[ma] = c[ma] + msign * (s[ma] / 2 - 0.003);
  for (let k = 0; k < 3; k++) if (k !== ma) fs[k] = s[k] + 0.03;
  body.push(boxG(fc, fs));
  // cooling / stiffening ribs along the free face opposite the mount
  for (let i = 0; i < fins; i++) {
    const rc = c.slice(), rs = s.slice();
    const other = [0, 1, 2].filter((k) => k !== ma);
    const along = other[0], across = other[1];
    rs[ma] = 0.012; rc[ma] = c[ma] - msign * (s[ma] / 2 + 0.006);
    rs[along] = 0.008; rc[along] = c[along] - s[along] / 2 + ((i + 0.5) / fins) * s[along];
    rs[across] = s[across] * 0.9;
    body.push(boxG(rc, rs));
  }
  const ca = AX[conn[1]], csign = conn[0] === '+' ? 1 : -1;
  const other = [0, 1, 2].filter((k) => k !== ca);
  const along = other.find((k) => k !== ma) ?? other[0];
  const cons = [];
  for (let i = 0; i < n; i++) {
    const p = c.slice();
    p[ca] = c[ca] + csign * (s[ca] / 2 + 0.012);
    p[along] = c[along] - s[along] / 2 + ((i + 0.5) / n) * s[along];
    cons.push(cylG(p, 0.016, 0.024, conn[1], 10));
  }
  const meshes = [mesh(merge(body), mat)];
  if (cons.length) meshes.push(mesh(merge(cons), G.connector()));
  return meshes;
}

/** Point on the connector face of a unit (where a harness or cable lands). */
export function connPoint(c, s, conn, off = 0.03) {
  const p = c.slice();
  const a = AX[conn[1]];
  p[a] += (conn[0] === '+' ? 1 : -1) * (s[a] / 2 + off);
  return p;
}
