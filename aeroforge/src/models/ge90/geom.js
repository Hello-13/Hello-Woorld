// Geometry helpers for the GE90-115B model, all in the lathe frame (see layout.js): engine axis
// +y, x = r·sin(phi), z = r·cos(phi). Static, axisymmetric pieces are built twice, whole and
// with a sector removed, so the cutaway can be switched off. Rotor blades always stay whole
// because they turn; everything axisymmetric (disks, drums, shafts) is cut like the casings.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { lathe, loftRings, airfoilLoop, orientOutward, mergeGeometries } from '../../engine/geometry.js';
import { M } from '../../engine/materials.js';

const TAU = Math.PI * 2;

/**
 * Cut sectors. 'engine' removes the upper quadrant facing the viewer (phi 270°…360°), the
 * classic museum cutaway; 'nacelle' removes the whole viewer half of the Boeing nacelle
 * (phi −90°…+90°) so the fan-case accessories show as on a shop stand with the cowls open.
 */
export const CUTS = {
  engine: { start: 0, length: Math.PI * 1.5 },
  nacelle: { start: Math.PI / 2, length: Math.PI },
};

/** Keep test for an object at angle phi under a cut. */
export function kept(phi, cut = 'engine') {
  const c = CUTS[cut];
  const p = (((phi - c.start) % TAU) + TAU) % TAU;
  return p <= c.length;
}

export const P3 = (r, y, phi) => new THREE.Vector3(Math.sin(phi) * r, y, Math.cos(phi) * r);

/**
 * A lathe solid that can be cut. profile: [r, y] pairs (closed loop by default).
 * Returns a Group carrying userData.cutaway = { full, cut, caps }.
 */
export function cutLathe(profile, material, { seg = 64, caps = true, closed = true, cut = 'engine', capMat = null } = {}) {
  // one profile, or several merged into the same pair of meshes; closed loops are made
  // counter-clockwise in (r, y) so LatheGeometry's faces and normals point out of the material
  let profiles = typeof profile[0][0] === 'number' ? [profile] : profile;
  if (closed) profiles = profiles.map(ccw);
  profile = profiles[0];
  const c = CUTS[cut];
  const segCut = Math.max(8, Math.round(seg * (c.length / TAU)));
  const build = (p0, len, s) => merge(profiles.map((p) => lathe(closed ? p.concat([p[0]]) : p, s, p0, len)));
  const group = new THREE.Group();
  const full = mesh(profiles.length > 1 ? build(0, TAU, seg) : lathe(closed ? profile.concat([profile[0]]) : profile, seg, 0, TAU), material);
  const part = mesh(profiles.length > 1 ? build(c.start, c.length, segCut) : lathe(closed ? profile.concat([profile[0]]) : profile, segCut, c.start, c.length), material);
  part.visible = false;
  group.add(full, part);
  const capMeshes = [];
  if (caps && closed) {
    const capGeo = merge(profiles.map((p) => new THREE.ShapeGeometry(new THREE.Shape(p.map(([r, y]) => new THREE.Vector2(r, y))))));
    for (const phi of [c.start, c.start + c.length]) {
      const m = mesh(capGeo, capMat || M.section(), { cast: false });
      m.rotation.y = phi - Math.PI / 2;
      m.visible = false;
      group.add(m);
      capMeshes.push(m);
    }
  }
  group.userData.cutaway = { full, cut: part, caps: capMeshes };
  return group;
}

/** A pair of meshes (whole / cut) made from a builder that takes a keep(phi) filter. */
export function cutPair(build, material, cut = 'engine') {
  const group = new THREE.Group();
  const full = mesh(build(() => true), material);
  const g = build((phi) => kept(phi, cut));
  const part = mesh(g, material);
  part.visible = false;
  group.add(full, part);
  group.userData.cutaway = { full, cut: part, caps: [] };
  return group;
}

/** Closed [r, y] loop in counter-clockwise order. */
export function ccw(p) {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const [x0, y0] = p[i], [x1, y1] = p[(i + 1) % p.length];
    a += x0 * y1 - x1 * y0;
  }
  return a >= 0 ? p : p.slice().reverse();
}

export function setCut(group, on) {
  const c = group.userData.cutaway;
  if (!c) return;
  c.full.visible = !on;
  c.cut.visible = on;
  for (const m of c.caps) m.visible = on;
}

/** Thin shell of revolution between an inner and outer line, each [[r, y] …] from front to back. */
export function shell(outer, inner) {
  return outer.concat(inner.slice().reverse());
}

/** Offset a [y, r] line radially into a closed [r, y] wall of thickness t (outward if t > 0). */
export function wall(line, t) {
  const a = line.map(([y, r]) => [r, y]);
  const b = line.map(([y, r]) => [r + t, y]);
  return t > 0 ? b.concat(a.slice().reverse()) : a.concat(b.slice().reverse());
}

/**
 * One airfoil lofted from hub to tip. Local frame: engine axis +y, blade radial along +x,
 * tangential +z. Every spanwise quantity can be a number (constant), a [hub, tip] pair
 * (linear) or a function of span fraction f.
 */
export function bladeGeometry(o) {
  const v = (q, f, d = 0) => (q == null ? d : typeof q === 'function' ? q(f) : Array.isArray(q) ? q[0] + (q[1] - q[0]) * f : q);
  const stations = o.stations ?? 4, n = o.n ?? 8;
  const rings = [];
  for (let k = 0; k <= stations; k++) {
    const f = k / stations;
    const r = o.rHub + (o.rTip - o.rHub) * f;
    const chord = v(o.chord, f);
    const st = (v(o.stagger, f) * Math.PI) / 180;
    const t = v(o.t, f, 0.08);
    const loop = airfoilLoop(t, n, o.c0 ?? 0, o.c1 ?? 1, v(o.camber, f, 0.04));
    const ca = -Math.cos(st), ct = Math.sin(st);
    const na = Math.sin(st), nt = Math.cos(st);
    const ax0 = (o.y ?? 0) + v(o.sweep, f, 0);
    const tg0 = v(o.lean, f, 0);
    const scale = o.scale ?? 1;
    rings.push(loop.map(([xc, yt]) => {
      const c = (xc - 0.5) * chord, h = yt * chord * scale;
      return [r, ax0 + c * ca + h * na, tg0 + c * ct + h * nt];
    }));
  }
  return orientOutward(loftRings(rings, { capStart: true, capEnd: true }));
}

/**
 * Ring of `count` copies of a geometry around the axis (blade rows, struts, bolts), merged.
 * The template sits at phi = 90° (along +x). keep(phi) drops copies (cutaway sectors).
 */
export function ring(geometry, count, { keep = () => true, phase = 0 } = {}) {
  const out = [];
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const a = phase + (i / count) * TAU;
    const phi = Math.PI / 2 + a;
    if (!keep(phi)) continue;
    m.makeRotationY(a);
    out.push(geometry.clone().applyMatrix4(m));
  }
  if (!out.length) return new THREE.BufferGeometry();
  return mergeGeometries(out);
}

/** Rotate a geometry built at phi = 90° (along +x) to angle phi. */
export function atPhi(geometry, phi) {
  return geometry.applyMatrix4(new THREE.Matrix4().makeRotationY(phi - Math.PI / 2));
}

/** Smooth tube through points. */
export function tube(points, radius, { seg = 48, radial = 8, closed = false } = {}) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed), seg, radius, radial, closed);
}

/** A circumferential pipe (torus) of radius r at station y. */
export function hoop(r, y, thickness, { radial = 8, tubular = 96, arc = TAU, start = 0 } = {}) {
  const g = new THREE.TorusGeometry(r, thickness, radial, tubular, arc);
  g.rotateX(Math.PI / 2);                 // torus in the x–z plane: x = R cos u, z = R sin u
  // so phi(u) = π/2 − u runs from π/2 − arc to π/2; rotating about y adds to phi
  g.rotateY(start + arc - Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

/** Box centred on a point of the lathe frame, oriented radial (x) / axial (y) / tangential (z). */
export function boxAt(r, y, phi, [dr, dy, dt]) {
  const g = new THREE.BoxGeometry(dr, dy, dt);
  g.translate(r, y, 0);
  return atPhi(g, phi);
}

/** Cylinder whose axis is parallel to the engine axis, centred at (r, y, phi). */
export function axialCyl(r, y, phi, radius, length, seg = 20) {
  const g = new THREE.CylinderGeometry(radius, radius, length, seg);
  g.translate(r, y, 0);
  return atPhi(g, phi);
}

/** Cylinder whose axis is radial, from r0 to r1 at (y, phi). */
export function radialCyl(r0, r1, y, phi, radius, seg = 12) {
  const g = new THREE.CylinderGeometry(radius, radius, Math.abs(r1 - r0), seg);
  g.rotateZ(Math.PI / 2);
  g.translate((r0 + r1) / 2, y, 0);
  return atPhi(g, phi);
}

/** Cylinder whose axis is tangential (circumferential), centred at (r, y, phi). */
export function tangentCyl(r, y, phi, radius, length, seg = 16) {
  const g = new THREE.CylinderGeometry(radius, radius, length, seg);
  g.rotateX(Math.PI / 2);
  g.translate(r, y, 0);
  return atPhi(g, phi);
}

/** A curved box (sector of an annulus) between radii r0…r1, stations y0…y1, angles p0…p1. */
export function sector(r0, r1, y0, y1, p0, p1, seg = 12) {
  const prof = [[r0, y0], [r1, y0], [r1, y1], [r0, y1], [r0, y0]];
  const g = lathe(prof, seg, p0, p1 - p0);
  return g;
}

/** Merge geometries after making them all non-indexed (mixed sources). */
export function merge(list) {
  if (!list.filter(Boolean).length) return new THREE.BufferGeometry();
  const geos = list.filter(Boolean).map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of geos) {
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  }
  // drop attributes not shared by all
  const names = Object.keys(geos[0].attributes).filter((k) => geos.every((g) => g.attributes[k]));
  for (const g of geos) for (const k of Object.keys(g.attributes)) if (!names.includes(k)) g.deleteAttribute(k);
  return mergeGeometries(geos);
}
