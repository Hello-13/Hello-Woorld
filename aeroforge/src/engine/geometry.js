// Procedural geometry toolkit: lofted surfaces, NACA airfoil wings, lathe profiles,
// lattices and helpers used by every vehicle model.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export { mergeGeometries };

/**
 * Loft a skin through closed rings of 3-D points. Every ring must have the same point count.
 * rings: Array<Array<[x,y,z]>>. Options: capStart, capEnd, closed (ring closure).
 * UVs: u runs along the loft, v around each ring (by arc length).
 */
export function loftRings(rings, { capStart = false, capEnd = false, closed = true } = {}) {
  const n = rings[0].length;
  const m = rings.length;
  const positions = [];
  const uvs = [];
  const indices = [];
  const cols = closed ? n + 1 : n;

  // cumulative length along the loft (for u) using ring centroids
  const centroids = rings.map((ring) => {
    const c = [0, 0, 0];
    for (const p of ring) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }
    return c.map((v) => v / n);
  });
  const along = [0];
  for (let i = 1; i < m; i++) {
    const a = centroids[i - 1], b = centroids[i];
    along.push(along[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  const total = along[m - 1] || 1;

  for (let i = 0; i < m; i++) {
    const ring = rings[i];
    const per = [0];
    for (let j = 1; j < cols; j++) {
      const a = ring[(j - 1) % n], b = ring[j % n];
      per.push(per[j - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
    }
    const perTotal = per[cols - 1] || 1;
    for (let j = 0; j < cols; j++) {
      const p = ring[j % n];
      positions.push(p[0], p[1], p[2]);
      uvs.push(along[i] / total, per[j] / perTotal);
    }
  }
  for (let i = 0; i < m - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j, b = i * cols + j + 1;
      const c = (i + 1) * cols + j, d = (i + 1) * cols + j + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const addCap = (ringIndex, flip) => {
    const ring = rings[ringIndex];
    const c = centroids[ringIndex];
    const base = positions.length / 3;
    positions.push(c[0], c[1], c[2]);
    uvs.push(ringIndex === 0 ? 0 : 1, 0.5);
    for (let j = 0; j < n; j++) {
      positions.push(ring[j][0], ring[j][1], ring[j][2]);
      uvs.push(ringIndex === 0 ? 0 : 1, j / n);
    }
    for (let j = 0; j < n; j++) {
      const a = base + 1 + j, b = base + 1 + ((j + 1) % n);
      if (flip) indices.push(base, a, b); else indices.push(base, b, a);
    }
  };
  if (capStart) addCap(0, true);
  if (capEnd) addCap(m - 1, false);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/** Ensure outward-facing triangles: flips winding if the signed volume is negative. */
export function orientOutward(geometry) {
  const pos = geometry.attributes.position;
  const idx = geometry.index.array;
  let vol = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < idx.length; i += 3) {
    a.fromBufferAttribute(pos, idx[i]);
    b.fromBufferAttribute(pos, idx[i + 1]);
    c.fromBufferAttribute(pos, idx[i + 2]);
    vol += a.dot(b.cross(c));
  }
  if (vol < 0) {
    for (let i = 0; i < idx.length; i += 3) {
      const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t;
    }
    geometry.index.needsUpdate = true;
    geometry.computeVertexNormals();
  }
  return geometry;
}

/** Mirror a geometry across the XY plane (z → −z) keeping outward winding. */
export function mirrorZ(geometry) {
  const g = geometry.clone();
  g.scale(1, 1, -1);
  const idx = g.index.array;
  for (let i = 0; i < idx.length; i += 3) {
    const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t;
  }
  g.index.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** NACA 4-digit symmetric half-thickness at chord fraction x for thickness ratio t. */
export function naca00(x, t) {
  return 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
}

/**
 * Closed airfoil ring between chord fractions [c0, c1] with cosine spacing.
 * Returns [chordFraction, thicknessOffset] pairs ordered upper (TE→LE) then lower (LE→TE).
 * A truncated section (c0 > 0 or c1 < 1) gets a flat face, as at a control-surface hinge line.
 */
export function airfoilLoop(t, n = 24, c0 = 0, c1 = 1, camber = 0) {
  const xs = [];
  for (let i = 0; i <= n; i++) {
    const s = 0.5 * (1 - Math.cos((Math.PI * i) / n));
    xs.push(c0 + (c1 - c0) * s);
  }
  const yc = (x) => camber * 4 * x * (1 - x);
  const upper = xs.slice().reverse().map((x) => [x, yc(x) + Math.max(naca00(x, t), x > 0.999 ? 0.0006 : 0)]);
  const lower = xs.slice(1, -1).map((x) => [x, yc(x) - Math.max(naca00(x, t), 0.0006)]);
  return upper.concat(lower);
}

/**
 * Lofted wing panel along +z from a root to a tip section.
 * root/tip: { le: [x, y, z], chord, t }. Nose of the vehicle points +x, so chord runs toward −x.
 * Options: c0/c1 chord-fraction window, stations, twist (deg at tip), camber.
 */
export function wingPanel({ root, tip, c0 = 0, c1 = 1, stations = 6, twist = 0, camber = 0, n = 22, eta0 = 0, eta1 = 1 }) {
  const rings = [];
  for (let k = 0; k <= stations; k++) {
    const eta = eta0 + ((eta1 - eta0) * k) / stations;
    const le = [0, 1, 2].map((i) => root.le[i] + (tip.le[i] - root.le[i]) * eta);
    const chord = root.chord + (tip.chord - root.chord) * eta;
    const t = root.t + (tip.t - root.t) * eta;
    const tw = (twist * eta * Math.PI) / 180;
    const loop = airfoilLoop(t, n, c0, c1, camber);
    rings.push(loop.map(([xc, yt]) => {
      const dx = -xc * chord, dy = yt * chord;
      // twist about the leading edge (nose-down washout for positive twist)
      const rx = dx * Math.cos(tw) - dy * Math.sin(tw);
      const ry = dx * Math.sin(tw) + dy * Math.cos(tw);
      return [le[0] + rx, le[1] + ry, le[2]];
    }));
  }
  return orientOutward(loftRings(rings, { capStart: true, capEnd: true }));
}

/** Point on a wing's hinge line at spanwise fraction eta and chord fraction cf (mid-thickness). */
export function wingPoint(root, tip, eta, cf) {
  const le = [0, 1, 2].map((i) => root.le[i] + (tip.le[i] - root.le[i]) * eta);
  const chord = root.chord + (tip.chord - root.chord) * eta;
  return new THREE.Vector3(le[0] - cf * chord, le[1], le[2]);
}

/**
 * Wrap a geometry in a pivot so it rotates about the line p0→p1.
 * Returns { pivot, mesh, setAngle(rad) }.
 */
export function hingedMesh(geometry, material, p0, p1) {
  const pivot = new THREE.Group();
  pivot.position.copy(p0);
  const mesh = new THREE.Mesh(geometry.clone().translate(-p0.x, -p0.y, -p0.z), material);
  pivot.add(mesh);
  const axis = new THREE.Vector3().subVectors(p1, p0).normalize();
  return {
    pivot, mesh, axis,
    setAngle(a) { pivot.quaternion.setFromAxisAngle(axis, a); },
  };
}

/** Lathe from [r, y] pairs (revolves around +Y). */
export function lathe(profile, segments = 48, phiStart = 0, phiLength = Math.PI * 2) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y));
  return new THREE.LatheGeometry(pts, segments, phiStart, phiLength);
}

/** Tangent ogive nose profile: base radius R, length L, from y0 upward. */
export function ogiveProfile(R, L, y0 = 0, steps = 18) {
  const rho = (R * R + L * L) / (2 * R);
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const x = (L * i) / steps;               // distance from base
    const r = Math.sqrt(rho * rho - x * x) + R - rho;
    out.push([Math.max(r, 0.001), y0 + x]);
  }
  return out;
}

/** A thin box stretched between two points (struts, slats, rails). */
export function beam(p0, p1, w = 0.05, h = w) {
  const a = new THREE.Vector3(...p0), b = new THREE.Vector3(...p1);
  const len = a.distanceTo(b);
  const g = new THREE.BoxGeometry(w, len, h);
  const dir = new THREE.Vector3().subVectors(b, a).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  g.applyQuaternion(q);
  const mid = a.add(b).multiplyScalar(0.5);
  g.translate(mid.x, mid.y, mid.z);
  return g;
}

/** Cylinder between two points. */
export function rod(p0, p1, r = 0.03, seg = 10) {
  const a = new THREE.Vector3(...p0), b = new THREE.Vector3(...p1);
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  const dir = new THREE.Vector3().subVectors(b, a).normalize();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
  const mid = a.add(b).multiplyScalar(0.5);
  g.translate(mid.x, mid.y, mid.z);
  return g;
}

/**
 * Diamond lattice inside a w×h frame in the XY plane (grid fins).
 * Slats run at ±45°; each is clipped to the frame analytically.
 */
export function latticePanel(w, h, pitch = 0.16, slat = 0.018, depth = 0.12, frame = 0.05) {
  const parts = [];
  const hw = w / 2, hh = h / 2;
  // frame
  parts.push(beam([-hw, -hh, 0], [hw, -hh, 0], frame, depth));
  parts.push(beam([-hw, hh, 0], [hw, hh, 0], frame, depth));
  parts.push(beam([-hw, -hh, 0], [-hw, hh, 0], frame, depth));
  parts.push(beam([hw, -hh, 0], [hw, hh, 0], frame, depth));
  const clipLine = (sx, c) => {
    // line y = sx * x + c  clipped to the rectangle
    const pts = [];
    const tryPt = (x, y) => {
      if (x >= -hw - 1e-6 && x <= hw + 1e-6 && y >= -hh - 1e-6 && y <= hh + 1e-6) pts.push([x, y]);
    };
    tryPt(-hw, sx * -hw + c); tryPt(hw, sx * hw + c);
    tryPt((-hh - c) / sx, -hh); tryPt((hh - c) / sx, hh);
    if (pts.length < 2) return null;
    pts.sort((p, q) => p[0] - q[0]);
    return [pts[0], pts[pts.length - 1]];
  };
  const span = hw + hh;
  for (const sx of [1, -1]) {
    for (let c = -span + pitch / 2; c < span; c += pitch) {
      const seg = clipLine(sx, c);
      if (!seg) continue;
      const [[x0, y0], [x1, y1]] = seg;
      if (Math.hypot(x1 - x0, y1 - y0) < 0.04) continue;
      parts.push(beam([x0, y0, 0], [x1, y1, 0], slat, depth * 0.9));
    }
  }
  return mergeGeometries(parts.map((g) => g.toNonIndexed()));
}

/** Ring of N copies of a geometry around +X (rotor/stator rows), merged. */
export function ringArray(geometry, count, axis = 'x') {
  const out = [];
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const g = geometry.clone();
    const a = (i / count) * Math.PI * 2;
    if (axis === 'x') m.makeRotationX(a); else if (axis === 'y') m.makeRotationY(a); else m.makeRotationZ(a);
    g.applyMatrix4(m);
    out.push(g.index ? g.toNonIndexed() : g);
  }
  return mergeGeometries(out);
}

/** Count triangles in an object tree. */
export function triangleCount(obj) {
  let n = 0;
  obj.traverse((o) => {
    if (o.isMesh && o.geometry) {
      const g = o.geometry;
      n += (g.index ? g.index.count : g.attributes.position.count) / 3;
    }
  });
  return Math.round(n);
}

/** Catmull–Rom interpolation over keyed scalars: keys = [[s, v], ...] sorted by s. */
export function interpKeys(keys, s) {
  if (s <= keys[0][0]) return keys[0][1];
  if (s >= keys[keys.length - 1][0]) return keys[keys.length - 1][1];
  let i = 0;
  while (i < keys.length - 2 && s > keys[i + 1][0]) i++;
  const p1 = keys[i], p2 = keys[i + 1];
  const p0 = keys[Math.max(0, i - 1)], p3 = keys[Math.min(keys.length - 1, i + 2)];
  const t = (s - p1[0]) / (p2[0] - p1[0]);
  const m1 = ((p2[1] - p0[1]) / (p2[0] - p0[0] || 1)) * (p2[0] - p1[0]);
  const m2 = ((p3[1] - p1[1]) / (p3[0] - p1[0] || 1)) * (p2[0] - p1[0]);
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2;
}

/** For an open tube lofted along some axis: flip winding so normals point away from the ring centroid. */
export function orientTubeOutward(geometry) {
  const pos = geometry.attributes.position;
  const nrm = geometry.attributes.normal;
  const idx = geometry.index.array;
  let score = 0;
  const c = new THREE.Vector3(), p = new THREE.Vector3(), n = new THREE.Vector3();
  // centroid of the whole tube is a fine reference for short, mostly straight ducts
  for (let i = 0; i < pos.count; i++) c.add(p.fromBufferAttribute(pos, i));
  c.divideScalar(pos.count);
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).sub(c);
    n.fromBufferAttribute(nrm, i);
    score += Math.sign(p.dot(n));
  }
  if (score < 0) {
    for (let i = 0; i < idx.length; i += 3) {
      const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t;
    }
    geometry.index.needsUpdate = true;
    geometry.computeVertexNormals();
  }
  return geometry;
}
