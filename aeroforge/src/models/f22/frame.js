// F-22A Raptor: the layout (./layout.js) plus the three.js loft and primitive helpers the model
// modules share.

import * as THREE from 'three';
import { X, SN, wingWarpS } from './layout.js';

export * from './layout.js';

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

/** Squeeze wing geometry built on the structural chord (wingSection) onto the real trailing edge, in place
 *  (layout.wingWarpS: nothing ahead of the flaperon hinge line moves). Returns the geometry. */
export function warpWing(g) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setX(i, SN - wingWarpS(SN - p.getX(i), p.getZ(i)));
  p.needsUpdate = true;
  if (g.attributes.normal) g.computeVertexNormals();
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

/** Merge geometries: indexed if every input is indexed, otherwise all made non-indexed first. */
export function merge(list, mergeGeometries) {
  const src = list.filter(Boolean);
  const allIndexed = src.every((g) => g.index);
  const flat = allIndexed ? src : src.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of flat) { if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); }
  const keepAttrs = ['position', 'normal', 'uv'];
  for (const g of flat) for (const k of Object.keys(g.attributes)) if (!keepAttrs.includes(k)) g.deleteAttribute(k);
  return mergeGeometries(flat);
}
