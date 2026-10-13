// Geometry helpers for the GE90-115B model, all in the lathe frame (see layout.js): engine axis
// +y, x = r·sin(phi), z = r·cos(phi). Static pieces are built as two sectors, the one a cutaway
// keeps and the one it removes, so the cutaway can be switched off. Turning blade rows in the core
// are cut too, blade by blade (rotorRow): they turn through less than one blade pitch and then
// start again, which looks exactly like continuous turning because the blades are identical, so
// the blades inside the removed sector stay a fixed, contiguous block that is simply not drawn.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { lathe, loftRings, orientOutward, mergeGeometries } from '../../engine/geometry.js';
import { bladeRings } from './blade.js';
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

/** Selector for the kept sector of a cut, or (rest = true) for the sector it removes. */
export function selector(cut = 'engine', rest = false) {
  const c = CUTS[cut];
  const f = rest ? (phi) => !kept(phi, cut) : (phi) => kept(phi, cut);
  f.start = rest ? c.start + c.length : c.start;
  f.arc = rest ? TAU - c.length : c.length;
  return f;
}

/**
 * A lathe solid that can be cut. profile: [r, y] pairs (closed loop by default), or a list of
 * such profiles merged into one mesh. Built as two sectors — the part a cutaway keeps and the
 * part it removes — so switching the cutaway off costs no extra triangles. Section caps (the
 * red cut faces) show only with the cutaway on. Returns a Group with userData.cutaway.
 */
export function cutLathe(profile, material, { seg = 64, caps = true, closed = true, cut = 'engine', capMat = null } = {}) {
  // closed loops are made counter-clockwise in (r, y) so LatheGeometry's faces point out of the material
  let profiles = typeof profile[0][0] === 'number' ? [profile] : profile;
  if (closed) profiles = profiles.map(ccw);
  const c = CUTS[cut];
  const segKeep = Math.max(6, Math.round(seg * (c.length / TAU)));
  const segRest = Math.max(4, seg - segKeep);
  const build = (p0, len, s) => merge(profiles.map((p) => lathe(closed ? p.concat([p[0]]) : p, s, p0, len)));
  const group = new THREE.Group();
  const rest = mesh(build(c.start + c.length, TAU - c.length, segRest), material);
  const keep = mesh(build(c.start, c.length, segKeep), material);
  rest.visible = false;
  group.add(keep, rest);
  const capMeshes = [];
  if (caps && closed) {
    const capGeo = merge(profiles.map((p) => new THREE.ShapeGeometry(new THREE.Shape(p.map(([r, y]) => new THREE.Vector2(r, y))))));
    for (const phi of [c.start, c.start + c.length]) {
      const m = mesh(capGeo, capMat || M.section(), { cast: false });
      m.rotation.y = phi - Math.PI / 2;
      group.add(m);
      capMeshes.push(m);
    }
  }
  group.userData.cutaway = { rest, caps: capMeshes };
  return group;
}

/**
 * Ringed items (vane rows, nozzles, links …) split the same way. build(sel) returns the
 * geometry for the items sel(phi) accepts; sel.start / sel.arc give the arc for anything
 * continuous (hoops, rings).
 */
export function cutPair(build, material, cut = 'engine') {
  const group = new THREE.Group();
  const gk = build(selector(cut, false)), gr = build(selector(cut, true));
  // a side with no items gets no mesh (an empty geometry would break triangle counts)
  if (gk.attributes.position) group.add(mesh(gk, material));
  let rest = null;
  if (gr.attributes.position) { rest = mesh(gr, material); rest.visible = false; group.add(rest); }
  group.userData.cutaway = { rest, caps: [] };
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
  if (c.rest) c.rest.visible = !on;
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
 * tangential +z; each section is wrapped onto its own cylinder (see blade.js). Every spanwise
 * quantity can be a number (constant), a [hub, tip] pair (linear) or a function of span fraction f.
 */
export function bladeGeometry(o) {
  const caps = o.caps ?? true;
  return orientOutward(loftRings(bladeRings(o), { capStart: caps, capEnd: caps }));
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
export function hoop(r, y, thickness, { radial = 6, tubular = 72, arc = TAU, start = 0 } = {}) {
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
  const loop = ccw([[r0, Math.min(y0, y1)], [r1, Math.min(y0, y1)], [r1, Math.max(y0, y1)], [r0, Math.max(y0, y1)]]);
  const g = lathe(loop.concat([loop[0]]), seg, p0, p1 - p0);
  // end faces: ShapeGeometry faces +z, which the rotation turns towards decreasing phi
  const shape = new THREE.Shape(loop.map(([r, y]) => new THREE.Vector2(r, y)));
  const c0 = new THREE.ShapeGeometry(shape).rotateY(p0 - Math.PI / 2);
  const c1 = flipFaces(new THREE.ShapeGeometry(shape)).rotateY(p1 - Math.PI / 2);
  return mergeGeometries([g, c0, c1]);
}

/** Reverse triangle winding and normals of an indexed geometry. */
export function flipFaces(g) {
  const idx = g.index.array;
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return g;
}

/** Merge geometries after making them all non-indexed (mixed sources). */
export function merge(list) {
  // empty pieces (a cut run with nothing in it) are skipped
  const live = list.filter((g) => g && g.attributes.position && g.attributes.position.count);
  if (!live.length) return new THREE.BufferGeometry();
  const geos = live.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of geos) {
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  }
  // drop attributes not shared by all
  const names = Object.keys(geos[0].attributes).filter((k) => geos.every((g) => g.attributes[k]));
  for (const g of geos) for (const k of Object.keys(g.attributes)) if (!names.includes(k)) g.deleteAttribute(k);
  return mergeGeometries(geos);
}

/**
 * A turning blade row that the cutaway can cut: count copies of a blade template merged into one
 * mesh, numbered so that blade 0 sits in the middle of the removed sector. updateRotor() spins it
 * and sets the geometry's draw range to the blades outside the removed sector, so they are neither
 * drawn, nor shadowed, nor picked. Blueprint edges are built per blade so they cut the same way.
 */
export function rotorRow(template, count, material, cut = 'engine') {
  const c = CUTS[cut];
  const phase = c.start + c.length + (TAU - c.length) / 2 - Math.PI / 2;
  const m = mesh(ring(template, count, { phase }), material);
  const edgeT = new THREE.EdgesGeometry(template, 24);
  const edges = new THREE.LineSegments(ring(edgeT, count, { phase }), new THREE.LineBasicMaterial({ color: 0xffffff }));
  edges.userData.fx = true;
  edges.userData.edges = true;
  edges.visible = false;
  edges.raycast = () => {};
  m.add(edges);
  m.userData.edges = edges;
  m.userData.rotor = {
    count, phase, cut, pitch: TAU / count,
    unit: template.index ? template.index.count : template.attributes.position.count,
    edgeUnit: edgeT.attributes.position.count,
  };
  return m;
}

/** Turn a rotorRow to angle a (rad) and draw only the blades the cutaway keeps (all if cutOn is false). */
export function updateRotor(m, a, cutOn) {
  const R = m.userData.rotor;
  const rot = ((a % R.pitch) + R.pitch) % R.pitch;
  m.rotation.y = rot;
  let lo = 0, hi = R.count;
  if (cutOn) {
    const c = CUTS[R.cut], margin = 0.6 * R.pitch;
    lo = -1; hi = -1;
    for (let i = 0; i < R.count; i++) {
      const p = ((((Math.PI / 2 + R.phase + i * R.pitch + rot) - c.start) % TAU) + TAU) % TAU;
      if (p >= margin && p <= c.length - margin) { if (lo < 0) lo = i; hi = i + 1; }
    }
    if (lo < 0) { lo = 0; hi = 0; }
  }
  m.geometry.setDrawRange(lo * R.unit, (hi - lo) * R.unit);
  m.userData.edges.geometry.setDrawRange(lo * R.edgeUnit, (hi - lo) * R.edgeUnit);
}

/** Angle phi of a lathe-frame point (x = r·sin phi, z = r·cos phi), in [0, 2π). */
export const phiOf = (p) => ((Math.atan2(p.x, p.z) % TAU) + TAU) % TAU;

/** Points along a circumferential arc at radius r and station y, from phi0 to phi1 (either direction). */
export function arc(r, y, phi0, phi1, step = 0.08) {
  const n = Math.max(2, Math.ceil(Math.abs(phi1 - phi0) / step));
  return Array.from({ length: n + 1 }, (_, i) => P3(r, y, phi0 + ((phi1 - phi0) * i) / n));
}

/**
 * A pipe or cable through points, split by a cutPair selector: only the runs of points whose angle
 * sel accepts are built, so a line that crosses the removed sector is cut like everything else.
 */
export function cutTube(points, radius, sel, { radial = 8, perPoint = 3 } = {}) {
  const runs = [];
  let run = [];
  for (const p of points) {
    if (sel(phiOf(p))) run.push(p);
    else { if (run.length > 1) runs.push(run); run = []; }
  }
  if (run.length > 1) runs.push(run);
  return merge(runs.map((r) => tube(r, radius, { seg: Math.max(4, r.length * perPoint), radial })));
}
