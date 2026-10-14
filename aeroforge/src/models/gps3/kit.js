// Small geometry helpers for the GPS III model, and the harness landing-point registry. The body
// axes and the dimensions are in dims.js (three.js-free, so the tests can read them); they are
// re-exported here for the building modules.

import * as THREE from 'three';
import { mergeGeometries, lathe } from '../../engine/geometry.js';
import { mesh } from '../../engine/assembly.js';
import { G } from './materials.js';

export { BX, BY, BZ, HX, HY, HZ, T, CORE, BAY, IX, IY, IZ, DECK, AFT, ADAPTER, SEP_Z, SADA_C } from './dims.js';

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

/** Capsule (cylinder with hemispherical ends) along an axis, centred at c, radius r, overall length L. */
export function capsuleG(c, r, L, axis = 'z', radial = 48, cap = 14) {
  const g = new THREE.CapsuleGeometry(r, Math.max(0.001, L - 2 * r), cap, radial);
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

/** Solid of revolution about the z axis from a closed (r, z) outline listed counter-clockwise (r out,
 *  z up). Each edge is turned on its own, so corners stay sharp and every face points outward: open
 *  ring frames, flanges and thin shields that read correctly from inside and below. */
export function latheLoopG(loop, seg = 48) {
  const out = [];
  for (let i = 0; i < loop.length; i++) {
    const g = lathe([loop[i], loop[(i + 1) % loop.length]], seg).rotateX(Math.PI / 2);
    g.normalizeNormals();
    out.push(g);
  }
  return merge(out);
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

/** Flat polygon (x, y points) extruded `thick` along z, bottom face at z0; `seg` sets how finely
 *  round holes are divided (small lightening holes need far fewer than the 1.7 m adapter cut-out). */
export function plateG(points, thick, z0, holes = [], seg = 40) {
  const s = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) s.holes.push(h);
  return new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: seg }).translate(0, 0, z0);
}

/** Rectangular hole path (for plateG / panel cut-outs), centre (cx, cy), size w × h. */
export function rectHole(cx, cy, w, h) {
  const p = new THREE.Path();
  p.moveTo(cx - w / 2, cy - h / 2); p.lineTo(cx - w / 2, cy + h / 2); p.lineTo(cx + w / 2, cy + h / 2); p.lineTo(cx + w / 2, cy - h / 2); p.closePath();
  return p;
}

/** Regular octagon (flat sides on the axes) of across-flats size d, as x, y points. */
export function octagon(cx, cy, d) {
  const R = d / 2 / Math.cos(Math.PI / 8);
  return Array.from({ length: 8 }, (_, k) => {
    const a = Math.PI / 8 + (k * Math.PI) / 4;
    return [cx + Math.cos(a) * R, cy + Math.sin(a) * R];
  });
}

/** Helical conductor of radius r (tapering to r1) between z0 and z1, centred on (x, y). Built directly
 *  as a tube of `radial` sides around the analytic helix (no curve fitting or Frenet frames, which
 *  made the 64 antenna helices the slowest part of the build). */
export function helixG(x, y, r, z0, z1, turns, wire = 0.0032, phase = 0, r1 = r, radial = 5) {
  const n = Math.max(8, Math.ceil(turns * 16));
  const pos = new Float32Array((n + 1) * radial * 3), nor = new Float32Array((n + 1) * radial * 3);
  const idx = [];
  const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), d = new THREE.Vector3();
  const w = turns * Math.PI * 2, h = z1 - z0;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = phase + t * w, rr = r + (r1 - r) * t, c = Math.cos(a), s = Math.sin(a);
    T.set(-s * rr * w + c * (r1 - r), c * rr * w + s * (r1 - r), h).normalize();   // dP/dt
    N.set(c, s, 0); N.addScaledVector(T, -N.dot(T)).normalize();                   // outward, square to the wire
    B.crossVectors(T, N);
    const px = x + c * rr, py = y + s * rr, pz = z0 + h * t;
    for (let j = 0; j < radial; j++) {
      const b = (j / radial) * Math.PI * 2, k = (i * radial + j) * 3;
      d.copy(N).multiplyScalar(Math.cos(b)).addScaledVector(B, Math.sin(b));
      pos[k] = px + d.x * wire; pos[k + 1] = py + d.y * wire; pos[k + 2] = pz + d.z * wire;
      nor[k] = d.x; nor[k + 1] = d.y; nor[k + 2] = d.z;
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < radial; j++) {
    const a = i * radial + j, b = i * radial + ((j + 1) % radial), c = a + radial, e = b + radial;
    idx.push(a, b, c, b, e, c);   // counter-clockwise seen from outside (face normal along N)
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((n + 1) * radial * 2), 2));
  g.setIndex(idx);
  return g;
}

/** Bolt heads (small hex-ish cylinders) at points, axis along `axis`. */
export function boltsG(points, axis = 'y', r = 0.008, h = 0.006) {
  return merge(points.map((p) => cylG(p, r, h, axis, 6)));
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

/**
 * Harness landing points, collected from every module and drawn last (harness.js).
 * side: 'npe' (+Y panel), 'bus' (−Y panel), 'deck' (Earth deck units), 'aft' (aft-end units);
 * power: true when the unit also gets a drop from the power harness (the larger loads);
 * lead: points the data cable follows from the unit before the side's usual routing takes over
 * (along an outrigger, or up through the aft deck from a unit mounted outside it).
 */
export const NET = { nodes: [] };
export const reg = (p, side, power = false, lead = []) => { NET.nodes.push({ p, side, power, lead }); return p; };
