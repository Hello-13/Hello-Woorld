// Geometry helpers for the Falcon Heavy model: tank barrels with continuous paint UVs,
// ellipsoidal bulkheads, bent tubes, rings and a merge that tolerates mixed index state.

import * as THREE from 'three';
import { lathe, mergeGeometries } from '../../engine/geometry.js';

/** Merge geometries after dropping indices (mergeGeometries needs a uniform index state). */
export function merge(list) {
  const flat = list.filter(Boolean).map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
    if (!n.attributes.normal) n.computeVertexNormals();
    for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
    return n;
  });
  return mergeGeometries(flat);
}

/**
 * Open cylinder (lathe) from y0 to y1 whose texture v runs with height over [v0y, v1y], so the
 * paint stays continuous across separately built tank sections. phiStart puts u = 0.5 on +z.
 */
export function barrel(r, y0, y1, { seg = 96, v0y = y0, v1y = y1, rings = 2, phiStart = Math.PI } = {}) {
  const prof = [];
  for (let i = 0; i < rings; i++) prof.push([r, y0 + ((y1 - y0) * i) / (rings - 1)]);
  const g = lathe(prof, seg, phiStart);
  remapV(g, v0y, v1y);
  return g;
}

/** Set uv.y = (y − y0) / (y1 − y0) from vertex height. */
export function remapV(g, y0, y1) {
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setY(i, (p.getY(i) - y0) / (y1 - y0));
  uv.needsUpdate = true;
  return g;
}

/** Profile of a tapered lathe through [r, y] pairs (any order), returned as a lathe. */
export function revolve(profile, seg = 48, phiStart = 0, phiLength = Math.PI * 2) {
  return lathe(profile, seg, phiStart, phiLength);
}

/**
 * Ellipsoidal bulkhead (dome) of equator radius r at height yEq bulging by depth toward dir (+1 up,
 * −1 down). Returned as an open lathe shell.
 */
export function dome(r, yEq, depth, dir = 1, { seg = 64, steps = 12 } = {}) {
  const prof = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * (Math.PI / 2);
    prof.push([Math.max(0.002, Math.cos(t) * r), yEq + dir * Math.sin(t) * depth]);
  }
  if (dir < 0) prof.reverse();
  return lathe(prof, seg);
}

/** Height of an ellipsoidal dome surface at radius x. */
export function domeY(r, yEq, depth, dir, x) {
  return yEq + dir * depth * Math.sqrt(Math.max(0, 1 - (x / r) ** 2));
}

/** Tube through points [[x, y, z] …] (Catmull–Rom; set tension 0 for crisper bends). */
export function pipe(points, radius, { seg = 8, tubular = null, closed = false, tension = 0.2 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed, 'catmullrom', tension);
  const n = tubular || Math.max(8, Math.round(curve.getLength() / 0.25));
  return new THREE.TubeGeometry(curve, Math.min(n, 160), radius, seg, closed);
}

/** Horizontal torus (ring in the xz plane) of major radius R and tube radius r at height y. */
export function hoop(R, r, y, { seg = 64, tube = 8, x = 0, z = 0 } = {}) {
  const g = new THREE.TorusGeometry(R, r, tube, seg);
  g.rotateX(Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

/** Vertical cylinder (closed) centred at (x, ·, z) spanning y0 → y1. */
export function post(x, z, y0, y1, r, seg = 12, r1 = r) {
  const g = new THREE.CylinderGeometry(r1, r, y1 - y0, seg);
  g.translate(x, (y0 + y1) / 2, z);
  return g;
}

/** Box centred at (x, y, z), turned by ry about +y. */
export function block(x, y, z, w, h, d, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}

/** Capsule-ended cylinder (COPV / pressure bottle) along +y centred at (x, y, z). */
export function bottle(x, y, z, r, len, seg = 20) {
  const g = new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 6, seg);
  g.translate(x, y, z);
  return g;
}

/** Copy a geometry around the y axis n times (first copy at a0 degrees). */
export function aroundY(geo, n, a0 = 0, step = 360 / n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const g = geo.clone();
    g.rotateY((-(a0 + i * step) * Math.PI) / 180);
    out.push(g);
  }
  return merge(out);
}

/** Rotation that turns local +z to point radially outward at azimuth a (deg, +x toward +z). */
export function radialYaw(aDeg) {
  return Math.PI / 2 - (aDeg * Math.PI) / 180;
}

/** A flat annulus / disc with circular holes, extruded downward by thickness, top face at y. */
export function perforatedDisc(rOuter, holes, y, thickness = 0.06, seg = 72) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, rOuter, 0, Math.PI * 2, false);
  for (const [x, z, r] of holes) {
    const h = new THREE.Path();
    h.absarc(x, -z, r, 0, Math.PI * 2, true);
    shape.holes.push(h);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: seg / 4 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y - thickness, 0);
  return g;
}
