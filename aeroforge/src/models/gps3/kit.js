// Shared dimensions and small geometry helpers for the GPS III model.
//
// Axes (metres): the GPS spacecraft body frame. +Z points at the Earth (nadir, the L-band antenna
// side), +Y runs along the solar-array axis (the two radiator faces), +X completes the right-handed
// set and faces the Sun's hemisphere under yaw steering. Origin at the centre of the bus box.

import * as THREE from 'three';
import { mergeGeometries } from '../../engine/geometry.js';
import { mesh } from '../../engine/assembly.js';
import { G } from './materials.js';

export const BX = 1.80, BY = 1.90, BZ = 2.50;         // bus box (estimate within the reported ≈ 1.8 m × 3.4 m envelope)
export const HX = BX / 2, HY = BY / 2, HZ = BZ / 2;
export const T = 0.025;                               // honeycomb panel thickness
export const RC = 0.62;                               // central cylinder radius
export const IX = HX - T, IY = HY - T, IZ = HZ - T;   // inner faces of the closure panels

/** Non-indexed copy so geometries of any kind can be merged. */
export const flat = (g) => (g.index ? g.toNonIndexed() : g);
export const merge = (list) => mergeGeometries(list.map(flat));

/** Axis-aligned box geometry centred at c with size s. */
export function boxG(c, s) {
  return new THREE.BoxGeometry(s[0], s[1], s[2]).translate(c[0], c[1], c[2]);
}

/** Cylinder geometry along an axis ('x' | 'y' | 'z') centred at c. */
export function cylG(c, r, h, axis = 'z', seg = 24, r2 = r, open = false) {
  const g = new THREE.CylinderGeometry(r2, r, h, seg, 1, open);   // Three's cylinder runs along +Y, top radius first
  if (axis === 'x') g.rotateZ(-Math.PI / 2);
  else if (axis === 'z') g.rotateX(Math.PI / 2);
  return g.translate(c[0], c[1], c[2]);
}

/** Tube through points (smooth Catmull–Rom path). */
export function tubeG(points, r = 0.006, seg = 48, radial = 6) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'centripetal', 0.2);
  return new THREE.TubeGeometry(curve, seg, r, radial, false);
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

const AX = { x: 0, y: 1, z: 2 };

/**
 * An avionics box: body, mounting flange on the panel side and a row of connectors on one face.
 * c: centre, s: size [x, y, z], mount: '+x'|'-x'|'+y'|'-y'|'+z'|'-z' (the face against the panel),
 * conn: the face carrying the connectors, n: connector count.
 * Returns two meshes (body in `mat`, connectors in a dark metal).
 */
export function unit(c, s, mat, { mount = '+y', conn = '-z', n = 4, fins = 0 } = {}) {
  const body = [boxG(c, s)];
  const ma = AX[mount[1]], msign = mount[0] === '+' ? 1 : -1;
  // flange: a thin plate 1.5 cm larger than the footprint, at the mounting face
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
    const axis = conn[1];
    cons.push(cylG(p, 0.016, 0.024, axis, 10));
  }
  const meshes = [mesh(merge(body), mat)];
  if (cons.length) meshes.push(mesh(merge(cons), G.connector()));
  return meshes;
}
