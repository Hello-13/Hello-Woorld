// Small geometry utilities for the F-22A model: frames, thin slabs, hinges, airfoil plates.

import * as THREE from 'three';
import { mergeGeometries } from '../../engine/geometry.js';
import { X, merge as mergeList } from './frame.js';

export const merge = (list) => mergeList(list, mergeGeometries);

/** Remove consecutive duplicate 2-D points (crease duplicates) from a closed outline. */
export function dedupe(pts, eps = 1e-5) {
  const out = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > eps) out.push(p);
  }
  if (out.length > 2 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < eps) out.pop();
  return out;
}

/** Offset a closed 2-D polygon (clockwise in z–y with z right, y up) inward by d. */
export function insetPoly(pts, d) {
  const n = pts.length;
  // signed area to know which side is inside
  let area = 0;
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const sgn = area > 0 ? 1 : -1;     // > 0: counter-clockwise
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = pts[(i - 1 + n) % n], c = pts[i], q = pts[(i + 1) % n];
    const e1 = [c[0] - p[0], c[1] - p[1]], e2 = [q[0] - c[0], q[1] - c[1]];
    const l1 = Math.hypot(...e1) || 1, l2 = Math.hypot(...e2) || 1;
    // inward normals (left of the edge for CCW)
    const n1 = [-e1[1] / l1 * sgn, e1[0] / l1 * sgn], n2 = [-e2[1] / l2 * sgn, e2[0] / l2 * sgn];
    let nx = n1[0] + n2[0], ny = n1[1] + n2[1];
    const ln = Math.hypot(nx, ny) || 1;
    nx /= ln; ny /= ln;
    const cosHalf = Math.max(0.35, nx * n1[0] + ny * n1[1]);
    out.push([c[0] + nx * d / cosHalf, c[1] + ny * d / cosHalf]);
  }
  return out;
}

/**
 * A frame / bulkhead ring at station s: the band between the outline inset by `skinGap` and by
 * `skinGap + depth`, `thick` deep along x. Optional `keep(zy)` drops vertices (e.g. the part of a
 * frame that would cross the cockpit opening) by splitting the band into open runs.
 */
export function frameBand(s, outline, { depth = 0.08, thick = 0.03, skinGap = 0.01, keep = null, clip = null, avoid = null } = {}) {
  const o = insetPoly(outline, skinGap);
  const i = insetPoly(outline, skinGap + depth);
  // clip(outer, inner) may pull an inner-edge point back toward the skin (a frame made shallow round a duct)
  if (clip) for (let k = 0; k < i.length; k++) i[k] = clip(o[k], i[k]);
  const n = o.length;
  // avoid(p) → true where the frame must not reach: inner edges that cut a corner into such a region (one end
  // deep, the next pulled back) are pulled back further until the whole edge stays out
  if (avoid) {
    for (let pass = 0; pass < 12; pass++) {
      let moved = false;
      for (let k = 0; k < n; k++) {
        const k1 = (k + 1) % n, a = i[k], b = i[k1];
        let bad = false;
        for (const t of [0.2, 0.4, 0.6, 0.8]) if (avoid([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])) { bad = true; break; }
        if (!bad) continue;
        for (const [kk, q] of [[k, a], [k1, b]]) i[kk] = [o[kk][0] + (q[0] - o[kk][0]) * 0.75, o[kk][1] + (q[1] - o[kk][1]) * 0.75];
        moved = true;
      }
      if (!moved) break;
    }
  }
  const runs = [];
  let cur = [];
  for (let k = 0; k <= n; k++) {
    const kk = k % n;
    const ok = !keep || keep(o[kk]);
    if (ok) cur.push(kk);
    if (!ok || k === n) { if (cur.length > 1) runs.push(cur); cur = []; }
  }
  if (!keep) runs.splice(0, runs.length, [...Array(n + 1).keys()].map((k) => k % n));
  const geos = [];
  const x0 = X(s) + thick / 2, x1 = X(s) - thick / 2;
  for (const run of runs) {
    const pos = [], idx = [];
    const push = (x, p) => { pos.push(x, p[1], p[0]); return pos.length / 3 - 1; };
    const m = run.length;
    const A = [], B = [], C = [], D = [];
    for (const k of run) { A.push(push(x0, o[k])); B.push(push(x0, i[k])); C.push(push(x1, o[k])); D.push(push(x1, i[k])); }
    for (let j = 0; j < m - 1; j++) {
      const quad = (a, b, c, d) => idx.push(a, b, c, b, d, c);
      quad(A[j], A[j + 1], B[j], B[j + 1]);      // front face
      quad(D[j], D[j + 1], C[j], C[j + 1]);      // back face
      quad(C[j], C[j + 1], A[j], A[j + 1]);      // outer rim
      quad(B[j], B[j + 1], D[j], D[j + 1]);      // inner rim
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    geos.push(g);
  }
  return merge(geos);
}

/** Solid flat plate filling an outline at station s (radar bulkhead, firewalls). */
export function platePoly(s, outline, thick = 0.025, inset = 0.012) {
  const o = insetPoly(outline, inset);
  const shape = new THREE.Shape(o.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
  // shape lies in x–y with depth along +z: map (u, v, w) → (x = X(s) − w + thick/2, y = v, z = u)
  const p = g.attributes.position;
  for (let k = 0; k < p.count; k++) {
    const u = p.getX(k), v = p.getY(k), w = p.getZ(k);
    p.setXYZ(k, X(s) + thick / 2 - w, v, u);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * Thin slab from a grid of outer-surface points (rows along the panel, columns across), offset by
 * `off(p)` → [dx, dy, dz] toward the inside. Used for doors and access panels.
 */
export function slab(grid, off, outward = null) {
  const rows = grid.length, cols = grid[0].length;
  const pos = [], idx = [];
  const outer = [], inner = [];
  for (let r = 0; r < rows; r++) {
    outer.push([]); inner.push([]);
    for (let c = 0; c < cols; c++) {
      const p = grid[r][c];
      const d = off(p, r, c);
      outer[r].push(pos.length / 3); pos.push(p[0], p[1], p[2]);
      inner[r].push(pos.length / 3); pos.push(p[0] + d[0], p[1] + d[1], p[2] + d[2]);
    }
  }
  const quad = (a, b, c, d) => idx.push(a, c, b, b, c, d);
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      quad(outer[r][c], outer[r][c + 1], outer[r + 1][c], outer[r + 1][c + 1]);
      quad(inner[r][c + 1], inner[r][c], inner[r + 1][c + 1], inner[r + 1][c]);
    }
  }
  // the edge walls get vertices of their own: shared with the faces, their normals would be averaged into the faces'
  // rims and every door would show a dark or bright band round its edge, as if it stood off the skin
  const own = (i) => { pos.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); return pos.length / 3 - 1; };
  const wall = (a, b, c, d) => quad(own(a), own(b), own(c), own(d));
  for (let c = 0; c < cols - 1; c++) {
    wall(inner[0][c], inner[0][c + 1], outer[0][c], outer[0][c + 1]);
    wall(outer[rows - 1][c], outer[rows - 1][c + 1], inner[rows - 1][c], inner[rows - 1][c + 1]);
  }
  for (let r = 0; r < rows - 1; r++) {
    wall(outer[r][0], outer[r + 1][0], inner[r][0], inner[r + 1][0]);
    wall(inner[r][cols - 1], inner[r + 1][cols - 1], outer[r][cols - 1], outer[r + 1][cols - 1]);
  }
  if (outward) {
    // flip the winding if the first outer face points inward
    const a = new THREE.Vector3(...pos.slice(idx[0] * 3, idx[0] * 3 + 3));
    const b = new THREE.Vector3(...pos.slice(idx[1] * 3, idx[1] * 3 + 3));
    const c = new THREE.Vector3(...pos.slice(idx[2] * 3, idx[2] * 3 + 3));
    const n = b.sub(a).cross(c.sub(a));
    if (n.dot(outward) < 0) for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Rectangular duct or chute swept along station-space points [[s, y, z], …]: `w` across (horizontal),
 * `h` deep (vertical), corners kept sharp. `up` fixes the roll of the section along the path.
 */
export function rectTube(points, w, h, { n = 12, up = [0, 1, 0], caps = true } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map(([s, y, z]) => new THREE.Vector3(X(s), y, z)), false, 'catmullrom', 0.2);
  const U = new THREE.Vector3(...up).normalize();
  const rings = [];
  const T = new THREE.Vector3(), S = new THREE.Vector3(), N = new THREE.Vector3();
  for (let k = 0; k <= n; k++) {
    const u = k / n;
    const p = curve.getPointAt(u);
    curve.getTangentAt(u, T);
    S.crossVectors(T, U);
    if (S.lengthSq() < 1e-8) S.set(0, 0, 1);
    S.normalize();
    N.crossVectors(S, T).normalize();
    const c = (a, b) => [p.x + S.x * a + N.x * b, p.y + S.y * a + N.y * b, p.z + S.z * a + N.z * b];
    const A = c(w / 2, h / 2), B = c(-w / 2, h / 2), C = c(-w / 2, -h / 2), D = c(w / 2, -h / 2);
    rings.push([A, B, B, C, C, D, D, A]);
  }
  const pos = [], idx = [];
  for (const r of rings) for (const q of r) pos.push(...q);
  const m = 8;
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < m; j += 2) {
      const a = i * m + j, b = a + 1, c = a + m, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  if (caps) {
    idx.push(0, 2, 4, 0, 4, 6);                                     // start cap faces back along the path
    const o = (rings.length - 1) * m;
    idx.push(o, o + 4, o + 2, o, o + 6, o + 4);                     // end cap faces forward
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}

export { TOOTH_SLOPE, toothedGrid } from './layout.js';

/**
 * Hinged pivot for a door or surface: rotates `objects` about p0→p1. `test` is a point on the
 * moving part and `toward` the direction it should move when opened, which fixes the sign.
 */
export function hinge(objects, p0, p1, test, toward) {
  const pivot = new THREE.Group();
  pivot.position.copy(p0);
  const inner = new THREE.Group();
  inner.position.set(-p0.x, -p0.y, -p0.z);
  for (const o of [].concat(objects)) inner.add(o);
  pivot.add(inner);
  const axis = new THREE.Vector3().subVectors(p1, p0).normalize();
  let sign = 1;
  if (test && toward) {
    const r = new THREE.Vector3().subVectors(test, p0);
    const moved = r.clone().applyAxisAngle(axis, 0.05).sub(r);
    sign = moved.dot(toward) >= 0 ? 1 : -1;
  }
  return { pivot, axis, sign, set(a) { pivot.quaternion.setFromAxisAngle(axis, a * sign); } };
}

/** Flat airfoil-shaped plate (a rib) between chord fractions f0..f1 at a wing section. */
export function ribPlate(sec, f0, f1, thick = 0.012, scale = 0.94, naca) {
  const n = 10;
  const top = [], bot = [];
  for (let k = 0; k <= n; k++) {
    const f = f0 + (f1 - f0) * (k / n);
    const h = naca(f, sec.t) * sec.chord * scale;
    top.push([f, h]); bot.push([f, -h]);
  }
  const shape = new THREE.Shape([...top, ...bot.reverse()].map(([f, h]) => new THREE.Vector2(-f * sec.chord, h)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
  g.translate(0, 0, -thick / 2);
  g.translate(sec.le[0], sec.le[1], sec.le[2]);
  return g;
}

/** Spar web along a constant chord fraction f between two wing sections (a thin vertical strip). */
export function sparWeb(secs, f, thick = 0.014, scale = 0.94, naca) {
  const pos = [], idx = [];
  const m = secs.length;
  for (const sec of secs) {
    const x = sec.le[0] - f * sec.chord;
    const h = naca(f, sec.t) * sec.chord * scale;
    for (const [dy, dx] of [[h, thick / 2], [-h, thick / 2], [h, -thick / 2], [-h, -thick / 2]]) pos.push(x + dx, sec.le[1] + dy, sec.le[2]);
  }
  for (let k = 0; k < m - 1; k++) {
    const a = k * 4, b = (k + 1) * 4;
    const quad = (p, q, r, t) => idx.push(p, r, q, q, r, t);
    quad(a, b, a + 1, b + 1);
    quad(a + 2, a + 3, b + 2, b + 3);
    quad(a, a + 2, b, b + 2);
    quad(a + 1, b + 1, a + 3, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Twisted blade row around +x (a turbomachinery stage), written straight into one buffer. */
export function bladeRow({ x, y, z, count, rHub, rTip, chord, twist = 0.6, thick = 0.012, lean = 0 }) {
  const base = new THREE.BoxGeometry(chord, rTip - rHub, thick, 1, 2, 1);
  // twist the blade along its span: rotate vertices about the radial axis by an angle ∝ radius
  const p = base.attributes.position;
  for (let k = 0; k < p.count; k++) {
    const vx = p.getX(k), vy = p.getY(k), vz = p.getZ(k);
    const t = (vy + (rTip - rHub) / 2) / (rTip - rHub);
    const a = twist * (0.55 + 0.45 * t);
    p.setXYZ(k, vx * Math.cos(a) - vz * Math.sin(a), vy + (rHub + rTip) / 2, vx * Math.sin(a) + vz * Math.cos(a) + lean * t);
  }
  const flat = base.toNonIndexed();
  flat.computeVertexNormals();                       // faceted normals, as on the merged row
  const P = flat.attributes.position.array, N = flat.attributes.normal.array, UV = flat.attributes.uv.array;
  const n = P.length;
  const pos = new Float32Array(n * count), nor = new Float32Array(n * count), uv = new Float32Array(UV.length * count);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
    const o = i * n;
    for (let k = 0; k < n; k += 3) {
      const py = P[k + 1], pz = P[k + 2], ny = N[k + 1], nz = N[k + 2];
      pos[o + k] = P[k] + x; pos[o + k + 1] = c * py - sn * pz + y; pos[o + k + 2] = sn * py + c * pz + z;
      nor[o + k] = N[k]; nor[o + k + 1] = c * ny - sn * nz; nor[o + k + 2] = sn * ny + c * nz;
    }
    uv.set(UV, i * UV.length);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

/** Lathe around +x from [r, s] pairs (s = fuselage station) at lateral position (y, z). */
export function latheX(profile, y, z, seg = 32) {
  const pts = profile.map(([r, s]) => new THREE.Vector2(Math.max(r, 1e-4), -X(s)));
  const g = new THREE.LatheGeometry(pts, seg);
  // lathe axis is +y with height = −X(s); rotate so +y → −x, then height h maps to x = −h = X(s)
  g.rotateZ(Math.PI / 2);
  g.translate(0, y, z);
  return g;
}

/** Mirror across the x–y plane (z → −z) for indexed or non-indexed geometry, keeping winding. */
export function mirror(geometry) {
  const g = geometry.clone();
  g.scale(1, 1, -1);
  if (g.index) {
    const idx = g.index.array;
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    g.index.needsUpdate = true;
  } else {
    for (const a of Object.values(g.attributes)) {
      const n = a.itemSize, arr = a.array;
      for (let v = 0; v < a.count; v += 3) {
        for (let k = 0; k < n; k++) { const t = arr[(v + 1) * n + k]; arr[(v + 1) * n + k] = arr[(v + 2) * n + k]; arr[(v + 2) * n + k] = t; }
      }
      a.needsUpdate = true;
    }
  }
  g.computeVertexNormals();
  return g;
}
