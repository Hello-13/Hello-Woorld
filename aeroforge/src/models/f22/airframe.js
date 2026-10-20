// F-22A airframe: fuselage skins by section, primary structure (frames, titanium bulkheads,
// longerons, keel, EB-welded booms), wings with their multi-spar boxes, all-moving stabilators,
// canted vertical tails and every wing/tail control surface with its actuators.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { wingPanel, wingPoint, mirrorZ, naca00, mergeGeometries } from '../../engine/geometry.js';
import { F } from './materials.js';
import * as FR from './frame.js';
import { merge, dedupe, frameBand, platePoly, slab, hinge, ribPlate, sparWeb, mirror, toothedGrid } from './util.js';

const { X, P3, lerp, DEG, smooth } = FR;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** Sorted station list from s0 to s1 with roughly `step` spacing that includes every `must`. */
export function stations(s0, s1, step, must = []) {
  const out = new Set([s0, s1, ...must.filter((m) => m > s0 && m < s1)]);
  const n = Math.ceil((s1 - s0) / step);
  for (let k = 1; k < n; k++) {
    const s = s0 + ((s1 - s0) * k) / n;
    if (must.every((m) => Math.abs(m - s) > step * 0.3)) out.add(s);
  }
  return [...out].sort((a, b) => a - b);
}
/** Ring stations of the forward-fuselage (A) loft, shared with the panels laid on it. */
export const loftStationsA = () => stations(0, FR.S_AB, 0.13, [0.05, 0.12, 0.22, 0.35, 0.5, 0.7, 0.95, 1.25, 1.6, 2.0, FR.M(2.55), FR.CANOPY_S0, FR.HOLE_S0, FR.HOLE_S1, FR.CANOPY_S1, ...FR.noseWellStations()]);
const inRange = (s0, s1, r) => s0 >= r.s0 - 1e-6 && s1 <= r.s1 + 1e-6;
const zy = (pts) => dedupe(pts.map((p) => [p[2], p[1]]));

/** Clip a closed polygon to y ≤ ymax (Sutherland–Hodgman). */
function clipBelow(poly, ymax) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ain = a[1] <= ymax, bin = b[1] <= ymax;
    if (ain) out.push(a);
    if (ain !== bin) { const t = (ymax - a[1]) / (b[1] - a[1]); out.push([a[0] + (b[0] - a[0]) * t, ymax]); }
  }
  return out;
}

/** Clip a closed polygon to y ≥ ymin. */
function clipAbove(poly, ymin) {
  return clipBelow(poly.map(([z, y]) => [z, -y]), -ymin).map(([z, y]) => [z, -y]);
}

/** Fan cap over a ring (facing aft). */
function capAft(ring) {
  const c = [0, 0, 0];
  for (const p of ring) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }
  c.forEach((v, i) => { c[i] = v / ring.length; });
  const pos = [...c], idx = [];
  for (const p of ring) pos.push(...p);
  for (let k = 0; k < ring.length; k++) idx.push(0, 1 + k, 1 + ((k + 1) % ring.length));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const n = new THREE.Vector3(...pos.slice(3, 6)).sub(new THREE.Vector3(...c)).cross(new THREE.Vector3(...pos.slice(6, 9)).sub(new THREE.Vector3(...c)));
  if (n.x > 0) for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Open-sided cavity (bay / well liner): `edge(s)` gives the two opening edge points and
 * `inward(s)` the depth direction. Returns walls, back and end caps.
 */
export function cavity(st, edge, inward, depth) {
  return cavityGrid(st.map((s) => {
    const [a, b] = edge(s);
    const d = inward(s).map((v) => v * depth);
    return [a, [a[0] + d[0], a[1] + d[1], a[2] + d[2]], [b[0] + d[0], b[1] + d[1], b[2] + d[2]], b];
  }));
}

/** Cavity liner from rows of any equal length (opening edge, round the back, opening edge), ear-clipped end caps. */
export function cavityRows(grid, caps = true) {
  const pos = [], idx = [];
  const m = grid.length, k = grid[0].length;
  for (const row of grid) for (const p of row) pos.push(...p);
  for (let r = 0; r < m - 1; r++) {
    for (let c = 0; c < k - 1; c++) {
      const a = r * k + c, b = a + 1, cc = a + k, d = cc + 1;
      idx.push(a, cc, b, b, cc, d);
    }
  }
  if (caps) for (const r of [0, m - 1]) {
    const contour = grid[r].map((p) => new THREE.Vector2(p[2], p[1]));
    for (const f of THREE.ShapeUtils.triangulateShape(contour, [])) idx.push(r * k + f[0], r * k + f[1], r * k + f[2]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Cavity liner from rows of four points per station: opening edge, two back corners, opening edge. */
export function cavityGrid(grid) {
  const pos = [], idx = [];
  const m = grid.length;
  for (const row of grid) for (const p of row) pos.push(...p);
  for (let r = 0; r < m - 1; r++) {
    for (let c = 0; c < 3; c++) {
      const a = r * 4 + c, b = a + 1, cc = a + 4, d = cc + 1;
      idx.push(a, cc, b, b, cc, d);
    }
  }
  for (const r of [0, m - 1]) idx.push(r * 4, r * 4 + 1, r * 4 + 2, r * 4, r * 4 + 2, r * 4 + 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Surface through columns of points (each column the same length, columns side by side), wound so its normals point
 * along out(p) (a THREE.Vector3 for a point [x, y, z]). Extra per-vertex attributes: attrs(p) → { name: value }.
 */
export function columnsMesh(cols, out, attrs = null, uvf = null) {
  const pos = [], idx = [], ex = {}, uv = [];
  const n = cols[0].length;
  for (const c of cols) for (const p of c) { pos.push(...p); uv.push(...(uvf ? uvf(p) : [0, 0])); if (attrs) for (const [k, v] of Object.entries(attrs(p))) (ex[k] = ex[k] || []).push(v); }
  for (let i = 0; i < cols.length - 1; i++) for (let j = 0; j < n - 1; j++) { const a = i * n + j, b = a + 1, c = a + n, d = c + 1; idx.push(a, c, b, b, c, d); }
  // wind every triangle the same way, checked on the largest one against the outward direction there
  let best = -1, bi = 0;
  const v = (k) => new THREE.Vector3(pos[3 * k], pos[3 * k + 1], pos[3 * k + 2]);
  for (let t = 0; t < idx.length; t += 3) { const ar = v(idx[t + 1]).sub(v(idx[t])).cross(v(idx[t + 2]).sub(v(idx[t]))).length(); if (ar > best) { best = ar; bi = t; } }
  const A = v(idx[bi]), nrm = v(idx[bi + 1]).sub(A).cross(v(idx[bi + 2]).sub(A));
  if (nrm.dot(out([A.x, A.y, A.z])) < 0) for (let t = 0; t < idx.length; t += 3) { const q = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = q; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  for (const [k, a] of Object.entries(ex)) g.setAttribute(k, new THREE.Float32BufferAttribute(a, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Cavity liner through rows of equal length (as cavityRows), its two end walls closed along `closure(r)` (extra [x, y, z]
 *  points from the row's last point back to its first, e.g. along the skin) instead of a straight line. */
export function cavityRowsClosed(grid, closure) {
  const g = cavityRows(grid, false);
  const pos = [...g.attributes.position.array], idx = [...g.index.array];
  for (const r of [0, grid.length - 1]) {
    const loop = dedupe3([...grid[r], ...closure(r)]);
    if (loop.length < 3) continue;
    const base = pos.length / 3;
    for (const p of loop) pos.push(...p);
    for (const f of THREE.ShapeUtils.triangulateShape(loop.map((p) => new THREE.Vector2(p[2], p[1])), [])) idx.push(base + f[0], base + f[1], base + f[2]);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setIndex(idx);
  out.computeVertexNormals();
  return out;
}
/** Drop consecutive duplicate points (and a closing duplicate) from a 3-D loop. */
function dedupe3(pts, eps = 1e-5) {
  const out = [];
  for (const p of pts) { const q = out[out.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) > eps) out.push(p); }
  while (out.length > 2 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1], out[0][2] - out[out.length - 1][2]) < eps) out.pop();
  return out;
}

/** Spar caps: flat flanges along the upper and lower skins at chord fraction f. */
function sparCaps(secs, f, w, t, scale) {
  const geo = [];
  for (const sgn of [1, -1]) {
    const grid = secs.map((sec) => {
      const x = sec.le[0] - f * sec.chord, h = naca00(f, sec.t) * sec.chord * scale;
      return [[x + w / 2, sec.le[1] + sgn * h, sec.le[2]], [x - w / 2, sec.le[1] + sgn * h, sec.le[2]]];
    });
    geo.push(slab(grid, () => [0, -sgn * t, 0]));
  }
  return merge(geo);
}

/**
 * Slide a wing panel's root-station vertices (z = root z) outboard along their own chord lines until each clears
 * the inlet duct by 2.5 cm. The skin root runs inside the fuselage, and without this its inboard strip would
 * cross the engine air passage of the caret inlet and S-duct.
 */
function trimRootFromDuct(g, root, tip) {
  const p = g.attributes.position, zr = root.le[2];
  const q = [0, 0, 0];
  const atRoot = new Uint8Array(p.count);
  for (let i = 0; i < p.count; i++) {
    if (Math.abs(p.getZ(i) - zr) > 1e-6) continue;
    atRoot[i] = 1;
    const xc = (root.le[0] - p.getX(i)) / root.chord;
    let yt = (p.getY(i) - root.le[1]) / (root.chord * root.t);
    const at = (eta) => {
      const ch = root.chord + (tip.chord - root.chord) * eta, t = root.t + (tip.t - root.t) * eta;
      q[0] = root.le[0] + (tip.le[0] - root.le[0]) * eta - xc * ch;
      q[1] = root.le[1] + (tip.le[1] - root.le[1]) * eta + yt * ch * t;
      q[2] = root.le[2] + (tip.le[2] - root.le[2]) * eta;
    };
    // upper and lower points at one chord station (and the mid-plane between) move together, so the faces
    // that join them through the wing stay clear of the duct as well
    const ytv = yt;
    const clear = (e) => { at(e); return FR.ductDepth(FR.SN - q[0], q[1], q[2]) <= -0.025; };
    let eta = 0;
    for (const f of [1, 0.5, 0, -0.5, -1]) {
      yt = ytv * f;
      if (clear(eta)) continue;
      let lo = eta, hi = eta;
      while (hi < 0.07 && !clear(hi)) { lo = hi; hi = Math.min(0.07, hi + 0.008); }
      for (let k = 0; k < 6; k++) { const m = (lo + hi) / 2; if (clear(m)) hi = m; else lo = m; }
      eta = hi;
    }
    yt = ytv;
    at(eta);
    if (eta > 0) p.setXYZ(i, q[0], q[1], q[2]);
  }
  // the root end cap (all three corners on the root station) is dropped: the root lies inside the fuselage, and
  // once its edge is trimmed a flat cap would span the duct's outer corner
  const idx = g.index.array, kept = [];
  for (let k = 0; k < idx.length; k += 3) if (!(atRoot[idx[k]] && atRoot[idx[k + 1]] && atRoot[idx[k + 2]])) kept.push(idx[k], idx[k + 1], idx[k + 2]);
  g.setIndex(kept);
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** Keep only the triangles of g for which keep(i0, i1, i2) holds. */
function filterTris(g, keep) {
  const idx = g.index.array, out = [];
  for (let k = 0; k < idx.length; k += 3) if (keep(idx[k], idx[k + 1], idx[k + 2])) out.push(idx[k], idx[k + 1], idx[k + 2]);
  g.setIndex(out);
  return g;
}
/** Drop a wing panel's span-end caps at the given spans (strip joints inside the wing). */
function dropCaps(g, zs) {
  const p = g.attributes.position, at = (i, z) => Math.abs(p.getZ(i) - z) < 1e-6 || Math.abs(p.getZ(i) + z) < 1e-6;
  return filterTris(g, (a, b, c) => !zs.some((z) => at(a, z) && at(b, z) && at(c, z)));
}
/** Keep only a wing panel's upper skin (no lower skin, chordwise walls or span-end caps). */
function upperOnly(g) {
  const p = g.attributes.position, sd = g.attributes.side;
  return filterTris(g, (a, b, c) => sd.getX(a) > 0 && sd.getX(b) > 0 && sd.getX(c) > 0 && !(Math.abs(p.getZ(a) - p.getZ(b)) < 1e-6 && Math.abs(p.getZ(a) - p.getZ(c)) < 1e-6));
}

export function buildAirframe(ctx) {
  const { P, anim } = ctx;

  // ================================================================== fuselage A (nose → S_AB)
  const RS = FR.M(2.55);                       // radar bulkhead / radome joint (radome length approximate)
  const sA = loftStationsA();
  const ringsA = sA.map((s) => FR.ringA(s).pts);
  const HA = FR.ringA(1).half;           // points in one half (25)
  const mirA = (j) => (j < HA - 1 ? j : 2 * HA - 3 - j);
  const keepA = (st) => (i, j) => {
    const q = mirA(j), s0 = st[i], s1 = st[i + 1];
    if (q < 5 && s0 >= FR.HOLE_S0 - 1e-6 && s1 <= FR.HOLE_S1 + 1e-6) return false;
    // nose-gear well: the three belly bands open where the pointed door outline is at least as wide as the band
    if (q >= 21 && q <= 23 && FR.noseBandOpen([FR.NOSE_WELL.z, ...FR.NOSE_WELL.bands.slice(0, 2).reverse()][q - 21], s0, s1)) return false;
    return true;
  };
  const iR = sA.indexOf(RS);
  const radome = P('Radome', {
    system: 'Skin & fairings', skin: true, material: 'Quartz / cyanate-ester composite shell with frequency-selective layers',
    mass: 95, explode: [3.4, 0.2, 0], temp: 288,
    desc: 'A smooth, chined composite radome about 2.1 m long over the radar (joint station approximate): continuously curved like the rest of the F-22 (not faceted like the F-117), with its chine edges aligned to the planform. It is a frequency-selective surface, transparent in the AN/APG-77\'s own X band and reflective outside it, so it adds almost nothing to the radar cross-section.',
  }, mesh(FR.gridSurface(ringsA.slice(0, iR + 1), { closed: true }), F.skin()));
  radome.userData.part.thermalRole = 'stagnation';

  const stF = sA.slice(iR);
  P('Forward fuselage skin', {
    system: 'Skin & fairings', skin: true, material: 'Composite and aluminium panels with RAM coatings',
    mass: 320, explode: [1.3, 0.75, 0],
    desc: 'Skins the cockpit section from the radar bulkhead to the inlets, and the dorsal spine behind the canopy. The chine along each side is a sharp edge set at the same plan-view angle as the wing leading edge, so it reflects radar into the same few directions.',
  }, mesh(FR.gridSurface(ringsA.slice(iR), { closed: true, keep: keepA(stF) }), F.skin()));

  // ================================================================== fuselage B (S_AB → S_BE), booms and stinger
  const W = FR.MAIN_WELL;
  const S_MA = 11.7;                           // mid / aft fuselage skin split (Boeing's aft fuselage, which houses the engines)
  const bMust = [FR.SIDE_BAY.s0, FR.SIDE_BAY.s1, FR.MAIN_BAY.s0, FR.MAIN_BAY.s1, W.s0, W.sIn1, W.s1, S_MA, FR.CM_BAY.s0, FR.CM_BAY.s1, FR.ENGINE_DOOR.s0, FR.ENGINE_DOOR.s1];
  const sB = stations(FR.S_AB, FR.S_BE, 0.15, bMust);
  ctx.sB = sB;
  const ringsB = sB.map((s) => FR.ringB(s).pts);
  const HB = FR.ringB(10).half;           // 37
  const mirB = (j) => (j < HB - 1 ? j : 2 * HB - 3 - j);
  const keepB = (st, upper) => (i, j) => {
    const q = mirB(j), s0 = st[i], s1 = st[i + 1];
    if (upper !== (q <= 16)) return false;
    if (q >= 32 && inRange(s0, s1, FR.MAIN_BAY)) return false;
    // main-gear wells: the trunk side from the wing junction down to the lower corner (main door), and the belly
    // from the corner in to the inboard door's hinge line
    // (with the trunk's buried upper side and the upper deck's edge inside the wing root over it, where the wheel stows)
    if (q >= 13 && q <= 25 && inRange(s0, s1, W)) return false;
    if (q >= 26 && q <= 30 && inRange(s0, s1, { s0: W.s0, s1: W.sIn1 })) return false;
    if (q >= 21 && q <= 23 && inRange(s0, s1, FR.SIDE_BAY)) return false;
    if (q === 22 && inRange(s0, s1, FR.CM_BAY)) return false;
    if (q >= FR.ENGINE_DOOR.q0 && q < FR.ENGINE_DOOR.q1 && inRange(s0, s1, FR.ENGINE_DOOR)) return false;
    return true;
  };
  const iM = sB.indexOf(S_MA);
  const stM = sB.slice(0, iM + 1), stAft = sB.slice(iM);
  const rM = ringsB.slice(0, iM + 1), rAft = ringsB.slice(iM);
  P('Mid-fuselage upper skin', {
    system: 'Skin & fairings', skin: true, material: 'Bismaleimide (BMI) composite panels, RAM coated',
    mass: 260, explode: [0, 1.5, 0],
    desc: 'The broad upper deck over the inlet ducts and fuselage tanks, blending into the wing glove. Thermoset composites make up about a quarter of the F-22\'s structural weight.',
  }, mesh(FR.gridSurface(rM, { closed: true, keep: keepB(stM, true) }), F.skin()));
  // round the main-gear doors' outline the skin's rectangular cut-out is filled by a patch on the outer mould line, so the
  // opening is the doors' saw-toothed outline exactly: on the trunk side and belly (fore and aft of the outline, from the
  // inboard door's hinge up to the wing junction) and on the wing root's underside (between the cut-out's chord lines)
  const wellPatch = (() => {
    const zsAt = (a, b, must) => { const out = new Set(must.filter((z) => z >= a - 1e-9 && z <= b + 1e-9)); for (let z = a; z < b - 1e-9; z += 0.02) out.add(+z.toFixed(4)); out.add(b); return [...out].sort((p, q) => p - q); };
    const vz = [...FR.MAIN_DOORS.main.fore, ...FR.MAIN_DOORS.main.aft, ...FR.MAIN_DOORS.inboard.fore, ...FR.MAIN_DOORS.inboard.aft].map((v) => v[0]);
    const zT = zsAt(W.zIn, W.zJunction, [...vz, FR.bWb(11.6), 1.5435]), zW = zsAt(W.zJunction, W.hingeZ, vz);
    const T = [0, 1 / 3, 2 / 3, 1];
    const trunkPt = (s, z) => { const [zz, y] = FR.wellSkin(s, z); return [X(s), y, zz]; };
    const outT = (p) => { const s = FR.SN - p[0], z = p[2], a = FR.wellSkin(s, z - 0.004), b = FR.wellSkin(s, z + 0.004); return new THREE.Vector3(0, -(b[0] - a[0]), b[1] - a[1]); };
    // (texture coordinates as the loft lays them: u = −x, v = arc length round the ring from the top centre line)
    const arcAt = (s, z) => {
      const r = FR.ringB(s).pts; let a = 0;
      for (let j = 1; j < 37; j++) {
        const p = r[j - 1], q = r[j], L = Math.hypot(p[1] - q[1], p[2] - q[2]);
        if (j > 20 && q[2] <= z + 1e-9 && p[2] >= z - 1e-9 && L > 1e-9) return a + Math.hypot(p[1] - q[1], p[2] - q[2]) * ((p[2] - z) / Math.max(1e-9, p[2] - q[2]));
        a += L;
      }
      return a;
    };
    const uvT = (p) => { const s = FR.SN - p[0]; return [-p[0], arcAt(s, p[2])]; };
    const geo = [];
    for (const [sa, sb] of [[() => W.s0, FR.doorFore], [FR.doorAft, () => W.s1]]) {
      const cols = zT.map((z) => T.map((t) => trunkPt(lerp(sa(z), sb(z), t), z)));
      geo.push(columnsMesh(cols, outT, null, uvT));
    }
    const wingG = [];
    const cs = (c, z) => FR.wingLE(z) + c * (FR.wingTEline(z) - FR.wingLE(z)), [c0, c1] = FR.wellWingChord(W.hingeZ);
    const wingPt = (s, z) => [X(s), FR.wingSurfaces(s, z)[0], z];
    const wAttr = (p) => { const s = FR.SN - p[0], z = p[2]; return { chord: (s - FR.wingLE(z)) / (FR.wingTE(z) - FR.wingLE(z)), side: -1 }; };
    for (const [sa, sb] of [[(z) => cs(c0, z), FR.doorFore], [FR.doorAft, (z) => cs(c1, z)]]) {
      const cols = zW.map((z) => T.map((t) => wingPt(lerp(sa(z), sb(z), t), z)));
      wingG.push(columnsMesh(cols, () => new THREE.Vector3(0, -1, 0), wAttr, (p) => [p[2] - 1.45, FR.SN - p[0]]));
    }
    const both = (list) => [...list, ...list.map(mirror)];
    return { trunk: merge(both(geo)), wing: (side) => mergeGeometries(side > 0 ? wingG : wingG.map(mirror)) };
  })();
  ctx.wellPatch = wellPatch;
  P('Intake trunk & lower fuselage skin', {
    system: 'Skin & fairings', skin: true, material: 'Composite and titanium panels, RAM coated',
    mass: 300, explode: [0, -1.25, 0],
    desc: 'Wraps the intake trunks and the belly. Below the wing roots the trunk sides lean inboard about 39° from the vertical down to the flat bottom, whose outer corners are only about 2.5 m apart (NAWDC front and back views), on the line of the inlets\' outer walls; over the main wheel wells the upper side bulges out to meet the wing root. The openings for the main weapons bay, both side bays and the main-gear wells are cut here; their doors close flush with saw-toothed edges.',
  }, [mesh(FR.gridSurface(rM, { closed: true, keep: keepB(stM, false) }), F.skin()), mesh(wellPatch.trunk, F.skin())]);
  P('Aft fuselage upper skin', {
    system: 'Skin & fairings', skin: true, material: 'Titanium and high-temperature composite panels, engine-bay access doors',
    mass: 230, explode: [-0.6, 1.5, 0],
    desc: 'Covers the engine bays between the vertical tails, with access panels over the accessory drives and engine-bay equipment. The engines themselves come out downward, through the lower engine-change doors.',
  }, mesh(FR.gridSurface(rAft, { closed: true, keep: keepB(stAft, true) }), F.skin()));
  // behind S_BE: a boom each side of the nozzles, cut off at 43° in plan under the stabilator, and the stinger
  const boomRing = (s, side) => {
    const zi = FR.boomInner(s), w = FR.bW(s), D = FR.bD(s), wb = FR.bWb(s);
    const zTop = Math.min(zi, w - 0.01);
    const half = [];
    for (let k = 0; k <= 10; k++) { const z = lerp(zTop, w, k / 10); half.push([z, FR.upperB(s, z)]); }
    // trunk wall from the chine down to the lower corner, or to where it meets the boom's inner wall
    let yEnd = -D;
    if (wb < zTop) { let lo = -D, hi = 0; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (FR.wallZ(s, m) < zTop) lo = m; else hi = m; } yEnd = (lo + hi) / 2; }
    for (let k = 1; k <= 8; k++) { const y = lerp(0, yEnd, k / 8); half.push([FR.wallZ(s, y), y]); }
    for (let k = 1; k <= 4; k++) half.push(wb > zTop ? [lerp(wb, zTop, k / 4), -D] : [zTop, yEnd]);
    const yBot = half[half.length - 1][1], yTop = half[0][1];
    for (let k = 1; k < 5; k++) half.push([zTop, lerp(yBot, yTop, k / 5)]);
    return half.map(([z, y]) => [X(s), y, side * z]);
  };
  const sBoom = [];
  for (let s = FR.S_BE; s < FR.BOOM.sEnd1 - 0.02; s += 0.15) sBoom.push(s);
  sBoom.push(FR.BOOM.sEnd1 - 0.02);
  const booms = [];
  for (const side of [1, -1]) {
    const rings = sBoom.map((s) => boomRing(s, side));
    // the last ring collapses to the end point of the 43° cut
    booms.push(FR.gridSurface(side > 0 ? rings : rings.map((r) => r.slice().reverse()), { closed: true, uv: 'n' }));
    const endR = rings[rings.length - 1];
    booms.push(capAft(endR));
  }
  const ST = FR.STINGER;
  const stg = [];
  for (let s = FR.S_BE; s <= ST.s1 + 1e-6; s += 0.25) {
    const t = (s - FR.S_BE) / (ST.s1 - FR.S_BE);
    const top = FR.mono([[FR.S_BE, FR.bHT(FR.S_BE) - 0.04], [16.0, 0.27], [16.5, 0.15], [17.0, 0.045], [ST.s1, 0.02]], s), bot = Math.max(-FR.bD(s), -FR.bD(FR.S_BE));
    const hw = ST.half * (1 - 0.85 * smooth(0.82, 1, t)), hh = (top - bot) * (1 - 0.75 * smooth(0.82, 1, t));
    stg.push(FR.superRing(X(s), 0, (top + bot) / 2, 2 * hw, hh, 16, 3.4));
  }
  P('Aft fuselage lower skin', {
    system: 'Skin & fairings', skin: true, material: 'Titanium panels (hot structure beside the nozzles)',
    mass: 210, explode: [-0.6, -1.3, 0],
    desc: 'The underside of the engine bays, the two tail booms that run aft beside the nozzles to the stabilators, and the stinger between the nozzles that houses the arresting hook. The nozzles end inside the booms, which shield them from the side. Titanium is used where exhaust heat would soften aluminium or composites; the two large engine-change doors are cut into the underside.',
  }, [mesh(merge([FR.gridSurface(rAft, { closed: true, keep: keepB(stAft, false) }), ...booms, FR.gridSurface(stg, { closed: true, uv: 'n' }), capAft(stg[stg.length - 1])]), F.skin())]);

  // lower engine-change doors: each F119 is lowered out of its bay on a trailer
  for (const side of [1, -1]) {
    const R = side > 0 ? 'right' : 'left';
    const { s0, s1, q0, q1 } = FR.ENGINE_DOOR;
    const st = sB.filter((s) => s >= s0 - 1e-6 && s <= s1 + 1e-6);
    const zAt = (s, u) => { const zs = FR.bottomSamples(s); return lerp(zs[q0 - 27], zs[q1 - 27], u); };
    const grid = toothedGrid((s, u) => [X(s), -FR.bD(s) - 0.002, side * zAt(s, u)], st, { width: 1.02 });
    const door = slab(grid, () => [0, 0.025, 0], V(0, -1, 0));
    const seams = [];
    for (const s of [s0 + 0.02, (s0 + s1) / 2, s1 - 0.02]) seams.push(new THREE.BoxGeometry(0.03, 0.012, 1.0).translate(X(s), -FR.bD(s) + 0.012, side * 0.8));
    P(`Engine-change door (${R})`, {
      system: 'Skin & fairings', skin: true, material: 'Titanium / composite door on quick-release hinges and latches', mass: 70,
      explode: [-0.4, -1.9, 0.45 * side],
      desc: 'A large door under each engine bay, saw-toothed fore and aft. To change an F119 the door is opened, the engine is lowered straight down onto a trailer and a spare is raised in; the axially split case and colour-coded harnesses keep the job short (layout approximate).',
    }, [mesh(door, F.door()), mesh(merge(seams), F.tiDull())]);
  }

  // ================================================================== primary structure
  // forward fuselage: radar bulkhead, cockpit bulkheads and U-frames around the cockpit
  {
    const g = [];
    // forward cockpit pressure bulkhead: from the cockpit floor up to the panel (the nose-gear well is below)
    g.push(platePoly(FR.HOLE_S0, clipAbove(clipBelow(zy(FR.ringA(FR.HOLE_S0).pts), 0.4), 0.025), 0.025));
    // aft cockpit pressure bulkhead behind the seat, under the turtle deck
    const sAft = 5.46;
    g.push(platePoly(sAft, clipAbove(zy(FR.ringA(sAft).pts), -0.02), 0.025));
    for (const s of [FR.M(3.1), FR.M(3.75), FR.M(5.0), FR.M(5.7), FR.M(6.4), 6.2]) {
      const ys = FR.upperA(s, FR.sillW(s)) - 0.05;
      const cut = s > FR.HOLE_S0 && s < FR.HOLE_S1;
      // (a frame across the nose-gear well stops either side of it, at the well's side walls)
      const NW = FR.NOSE_WELL, well = s > NW.s0 && s < NW.s1;
      const keep = (p) => (!cut || p[1] < ys || Math.abs(p[0]) > FR.sillW(s) + 0.06) && (!well || Math.abs(p[0]) > NW.wall + 0.01 || p[1] > NW.roof);
      g.push(frameBand(s, zy(FR.ringA(s).pts), { depth: 0.07, thick: 0.03, keep: cut || well ? keep : null }));
    }
    P('Forward fuselage frames & bulkheads', {
      system: 'Structure', material: 'Aluminium and titanium machined frames', mass: 410, explode: [1.7, 0.4, 0],
      desc: 'Behind the forward avionics bay the forward and aft cockpit pressure bulkheads close the cockpit, and U-shaped frames pass under the canopy sills. Lockheed Martin built the forward fuselage at Marietta, about half aluminium and half composite.',
    }, mesh(merge(g), F.alu()));
    // radar bulkhead: a stiffened plate across the whole nose section, with the radome attach ring
    const rb = [platePoly(RS, zy(FR.ringA(RS).pts), 0.03)];
    rb.push(frameBand(RS - 0.02, zy(FR.ringA(RS - 0.02).pts), { depth: 0.05, thick: 0.03, skinGap: 0.004 }));
    const sr = RS + 0.035;
    for (const zz of [-0.36, 0, 0.36]) {
      const y0 = FR.bottomAt(sr, zz) + 0.04, y1 = FR.topAt(sr, Math.abs(zz)) - 0.04;
      rb.push(FR.boxS(sr, (y0 + y1) / 2, zz, 0.04, y1 - y0, 0.03));
    }
    for (const yy of [-0.25, 0.18]) {
      let hw = 0;
      for (let zz = 0; zz < FR.aW(sr); zz += 0.01) if (FR.bottomAt(sr, zz) < yy - 0.04 && FR.topAt(sr, zz) > yy + 0.04) hw = zz;
      rb.push(FR.boxS(sr, yy, 0, 0.04, 0.03, 2 * hw));
    }
    P('Radar bulkhead', {
      system: 'Structure', material: 'Machined aluminium bulkhead with stiffeners, radome attach ring', mass: 45,
      explode: [2.3, -0.35, 0],
      desc: `Closes the front of the fuselage about ${RS.toFixed(1)} m behind the nose tip (station approximate). Its face carries the mount for the 1,956-module APG-77 array (about 0.9 m across), its rim the attach ring and latches for the radome, which swings or comes off for radar maintenance.`,
    }, mesh(merge(rb), F.alu()));
  }
  // mid fuselage (Lockheed Martin Fort Worth; ≈ 30 % titanium, 30 % aluminium, 30 % composite): titanium
  // wing-carry-through bulkheads where the titanium front and mid spars attach, aluminium frames between
  // (the titanium spars reach the side of the body at the stations below; the RTM spars between them)
  const sparAt = (f) => FR.sparStation(f);
  // a frame that crosses a main-gear well opening is interrupted there: its band stops at the opening's edges (the
  // wing junction above, the inboard door's hinge line on the belly, or the lower corner aft of the inboard door)
  const wellKeep = (s) => {
    const MW = FR.MAIN_WELL;
    if (s < MW.s0 - 0.03 || s > MW.s1 + 0.03) return () => true;
    // (a ring point just inside the skin, under the doors' outline at either face of the frame)
    return (p) => { const z = Math.abs(p[0]); return p[1] > FR.junctionY(s) + 0.02 || ![-0.025, 0, 0.025].some((ds) => [-0.02, 0, 0.02].some((dz) => FR.wellOpen(s + ds, z + dz))); };
  };
  // (and inside the well cavity, at either face of the frame, it stops at the well's liner)
  const inWell = (s, p) => [-0.025, 0, 0.025].some((ds) => FR.inMainWell(s + ds, p[1], p[0], -0.01));
  {
    // each frame stays 3 cm clear of the inlet ducts that pass through it: where a duct comes close to the skin
    // the frame is made shallower
    // (checked at both faces of the frame, since the duct moves across it); where the duct runs right up to the
    // skin, as it does just behind the inlet, the frame stops either side of it
    // (the main-gear wells too: the bulkhead over them stops round the wheel bay)
    // (and round the gun in the right wing root and the APU in the left one, which sit in dry bays between frames)
    const G = FR.GUN, A = FR.APU;
    const gunDep = (ss, y, z) => (z > 0 && ss > G.muzzle - 0.2 && ss < G.breech + 0.35 ? 0.15 - Math.hypot(y - G.y, z - G.z) : -1);
    const apuDep = (ss, y, z) => (z < 0 && ss > A.inlet[0] - 0.05 && ss < A.exhaust[1] + 0.05 ? 0.22 - Math.hypot((y - A.y) * 1.2, z - A.z) : -1);
    // the air-cooled fuel coolers and their exhaust plenums up to the grilles (thermal.js: 10 cm under the skin)
    const AC = FR.ACFC, acZ = (AC.z0 + AC.z1) / 2;
    const acfcDep = (ss, y, z) => (ss > AC.s0 && ss < AC.s1 ? Math.min(Math.abs(z) - (acZ - 0.17), acZ + 0.17 - Math.abs(z), y - (FR.topAt(ss, acZ) - 0.24)) : -1);
    // (and the inlet-bypass plenums that stand on the ducts' roofs under the louvre doors)
    const BP = FR.BYPASS;
    const bypDep = (ss, y, z) => { const az = Math.abs(z); if (!(ss > BP.s0 - 0.03 && ss < BP.s1 + 0.03 && az > BP.z0 - 0.03 && az < BP.z1 + 0.03)) return -1; const sp = FR.ductSpan(ss, az); return sp && y > sp.hi - 0.02 ? 0.1 : -1; };
    const depAt = (s, th) => (y, z) => Math.max(...[s - th / 2, s, s + th / 2].map((ss) => Math.max(FR.ductDepth(ss, y, z), FR.mainWellDepth(ss, y, z), gunDep(ss, y, z), apuDep(ss, y, z), acfcDep(ss, y, z), bypDep(ss, y, z))));
    const clipDuct = (s, th) => {
      const dep = depAt(s, th);
      return (o, i) => {
        if (dep(i[1], i[0]) < -0.03) return i;
        let lo = 0, hi = 1;                                 // fraction of the way from the outer edge to i
        for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2; if (dep(lerp(o[1], i[1], m), lerp(o[0], i[0], m)) < -0.03) lo = m; else hi = m; }
        return [lerp(o[0], i[0], lo), lerp(o[1], i[1], lo)];
      };
    };
    const band = (s) => {
      const D = FR.bD(s);
      const sideBay = s > FR.SIDE_BAY.s0 && s < FR.SIDE_BAY.s1, dep = depAt(s, 0.05);
      return frameBand(s, zy(FR.ringB(s).pts), {
        depth: 0.15, thick: 0.05, clip: clipDuct(s, 0.05), avoid: (p) => dep(p[1], p[0]) > -0.028,
        keep: (p) => !(p[1] < -D + 0.12 && Math.abs(p[0]) < FR.MAIN_BAY.z + 0.05) && !(sideBay && p[1] < FR.SIDE_BAY.y0 + 0.04 && p[1] > FR.SIDE_BAY.y1 - 0.04 && Math.abs(p[0]) > FR.wallZ(s, -0.6) - 0.4) && wellKeep(s)(p) && !inWell(s, p) && dep(p[1], p[0]) < -0.015,
      });
    };
    // forward bulkhead behind the inlets, the front-spar bulkhead, and the bulkhead just ahead of the fan faces
    // that carries the main-gear trunnions
    P('Mid-fuselage titanium bulkheads', {
      system: 'Structure', material: 'Ti-6Al-4V bulkheads machined from large forgings', mass: 620, xrayWeight: 0.5,
      explode: [0, 0.65, 0],
      desc: 'Heavy wing-carry-through bulkheads — at the front of the main weapons bay, at the wing\'s titanium front spar, and just ahead of the engine faces where the main-gear loads come in — carry wing bending across the fuselage around the inlet ducts and over the main weapons bay. Titanium is about 40 % of the F-22\'s structural weight (sources give 39–42 %), more than any earlier US fighter (assignment of bulkheads approximate).',
    }, mesh(merge(FR.FRAMES.ti.map(band)), F.ti()));
    P('Mid-fuselage aluminium frames', {
      system: 'Structure', material: 'Machined aluminium frames', mass: 260, xrayWeight: 0.5,
      explode: [0, 0.9, 0],
      desc: 'Lighter frames between the titanium bulkheads, where the composite spars attach, and the frame that closes the aft end of the main weapons bay ahead of the gun\'s ammunition container. The mid fuselage is built as three modules with about 5,000 structural parts and over 100,000 fasteners, and houses all or part of the fuel, hydraulic, electrical, environmental and APU systems.',
    }, mesh(merge(FR.FRAMES.al.map(band)), F.alu()));
  }
  // engine-bay frames (the mid and rear titanium spars meet the aft fuselage here)
  {
    const g = [];
    // (the first one is open across the belly under each accessory drive, where the air-turbine starter exhausts
    // through the screens behind the AMAD bay)
    const amadBay = (s) => (p) => !(Math.abs(s - FR.FRAMES.engine[0]) < 0.01 && p[1] < -0.8 && Math.abs(p[0]) > FR.AMAD.z - 0.27 && Math.abs(p[0]) < FR.AMAD.z + 0.22);
    for (const s of FR.FRAMES.engine) {
      const wk = wellKeep(s), sweep = (p) => Math.max(FR.mainWellDepth(s - 0.02, p[1], p[0]), FR.mainWellDepth(s + 0.02, p[1], p[0])) < -0.015;
      // (made shallow where the deck comes close over the engine: 1.5 cm off the F119's case, accessories included)
      const rE = (s <= FR.AUG_S ? FR.F119.rMax : FR.mono(FR.F119_AUG.map(([r, st]) => [st, r]), s)) + 0.015;
      const engDep = (y, z) => rE - Math.hypot(y - FR.ENG_Y, Math.abs(z) - FR.ENG_Z);
      const clipEng = (o, i) => {
        if (engDep(i[1], i[0]) < 0) return i;
        let lo = 0, hi = 1;
        for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2; if (engDep(lerp(o[1], i[1], m), lerp(o[0], i[0], m)) < 0) lo = m; else hi = m; }
        return [lerp(o[0], i[0], lo), lerp(o[1], i[1], lo)];
      };
      g.push(frameBand(s, zy(FR.ringB(s).pts), { depth: 0.07, thick: 0.04, clip: clipEng, keep: (p) => amadBay(s)(p) && wk(p) && sweep(p) && !inWell(s, p) && engDep(p[1], p[0]) < -0.005 }));
    }
    P('Engine-bay frames', {
      system: 'Structure', material: 'Titanium frames', mass: 420, explode: [-1.0, 0.9, 0],
      desc: 'Hoop frames around the two engine bays tie the keel, the booms and the upper deck together and carry the vertical-tail and stabilator loads forward; the wing\'s titanium mid and rear spars attach to them.',
    }, mesh(merge(g), F.tiDull()));
  }
  // keel and longerons
  {
    const g = [];
    const keel = [];
    for (let s = 11.6; s <= FR.S_BE + 1.3; s += 0.25) keel.push(s);
    // keel web between the engines, carried on into the stinger
    const kTop = (s) => (s < FR.S_BE ? FR.topAt(s, 0) - 0.06 : lerp(FR.bHT(FR.S_BE) - 0.1, 0.12, (s - FR.S_BE) / 1.4));
    const kBot = (s) => (s < FR.S_BE ? -FR.bD(s) + 0.05 : lerp(-FR.bD(FR.S_BE) + 0.06, -0.62, (s - FR.S_BE) / 1.4));
    const grid = [keel.map((s) => [X(s), kTop(s), 0]), keel.map((s) => [X(s), kBot(s), 0])];
    g.push(slab([grid[0].map((p) => [p[0], p[1], -0.02]), grid[1].map((p) => [p[0], p[1], -0.02])], () => [0, 0, 0.04]));
    // weapons-bay longerons along the door edges and the bay ceiling
    const yL = (s) => -FR.bD(s) + 0.045;
    const zE = FR.MAIN_BAY.z + 0.03;
    for (const z of [-zE, zE]) {
      // the bay-edge longerons run from the bay's front bulkhead to its aft frame; behind the ammunition container
      // keel longerons low inboard carry on under the inlet ducts into the engine bays
      const s0 = FR.MAIN_BAY.s0 - 0.02, s1 = FR.MAIN_BAY.s1 + 0.02;
      g.push(FR.pipe([[s0, yL(s0), z], [lerp(s0, s1, 0.4), yL(lerp(s0, s1, 0.4)), z], [s1 - 0.35, yL(s1 - 0.35), z], [s1, yL(s1), z]], 0.035, 6));
      const sk = FR.FRAMES.ti[2];
      g.push(FR.pipe([[sk, -0.92, Math.sign(z) * 0.18], [sk + 0.5, -0.92, Math.sign(z) * 0.18], [11.8, -0.9, Math.sign(z) * 0.12], [11.9, -0.88, Math.sign(z) * 0.06], [12.0, -0.87, Math.sign(z) * 0.025]], 0.035, 6, 12));
      // ceiling longeron along the break of the bay ceiling (outside the bay, under the duct floor; flush with the
      // ceiling toward the aft end, where the duct floor comes down to it)
      const cz = FR.BAY_CEIL_BREAK;
      const dy = (sv) => 0.035 - 0.03 * FR.smooth(s1 - 0.5, s1 - 0.1, sv);
      // (stepped inboard along the ceiling where the duct's floor comes down outboard of it, behind the bay's front)
      const zL = (sv) => { let zz = cz; while (zz > 0.25 && [-0.03, 0, 0.03].some((d) => FR.ductDepth(sv, FR.BAY_CEIL + dy(sv) + d, zz) > -0.055)) zz -= 0.01; return zz; };
      const stL = stations(s0 + 0.04, s1, 0.1);
      const zs = stL.map(zL), zsm = zs.map((_, k) => Math.min(...zs.slice(Math.max(0, k - 3), k + 4)));
      g.push(FR.pipe(stL.map((sv, k) => [sv, FR.BAY_CEIL + dy(sv), Math.sign(z) * zsm[k]]), 0.03, 6, 80));
    }
    P('Keel & weapons-bay longerons', {
      system: 'Structure', material: 'Titanium keel web, steel / titanium longerons', mass: 380, explode: [0, -0.45, 0],
      desc: 'Heavy longerons run along both edges of the main weapons bay, the largest cut-out in the airframe, and continue aft into the keel that separates the two engine bays and stops a fire spreading between them.',
    }, mesh(merge(g), F.ti()));
  }
  {
    const g = [];
    for (const side of [1, -1]) {
      const fwd = [];
      for (let s = FR.M(2.7); s <= FR.M(7.6); s += 0.15) {
        const z = Math.max(0.42, FR.sillW(s) + 0.07);
        fwd.push([s, FR.topAt(s, Math.min(z, FR.aW(s) - 0.05)) - 0.06, side * Math.min(z, FR.aW(s) - 0.05)]);
      }
      g.push(FR.pipe(fwd, 0.028, 6));
      const mid = [];
      // (inboard of the fuel coolers' exhaust plenums over FR.ACFC)
      const zM = (s) => 0.45 - 0.065 * FR.smooth(FR.ACFC.s0 - 0.35, FR.ACFC.s0 - 0.1, s) * (1 - FR.smooth(FR.ACFC.s1 + 0.1, FR.ACFC.s1 + 0.35, s));
      // (over the ducts and the weapons bays to the first engine-bay frame, where the aft fuselage's titanium booms
      // and the keel take over)
      const sEnd = FR.FRAMES.engine[0];
      for (let s = FR.M(7.6); s < sEnd - 0.1; s += 0.25) mid.push([s, FR.topAt(s, zM(s)) - 0.06, side * zM(s)]);
      mid.push([sEnd, FR.topAt(sEnd, 0.45) - 0.06, side * 0.45]);
      g.push(FR.pipe(mid, 0.028, 6));
      const chine = [];
      for (let s = FR.M(2.7); s <= FR.S_AB - 0.2; s += 0.4) chine.push([s, FR.aYC(s) - 0.02, side * (FR.aW(s) - 0.06)]);
      g.push(FR.pipe(chine, 0.022, 6));
    }
    P('Upper longerons & canopy rails', {
      system: 'Structure', material: 'Titanium extrusions', mass: 140, explode: [0.4, 1.0, 0],
      desc: 'Continuous longerons along the cockpit sills (the canopy rails), the upper deck and the forward chines carry fuselage bending between the frames.',
    }, mesh(merge(g), F.tiDull()));
  }
  // EB-welded titanium aft booms, beside the engines and nozzles, that carry the vertical tails and the stabilator pivots
  for (const side of [1, -1]) {
    const g = [];
    const rings = [];
    const BZ = 1.55;
    // the box section tapers in depth aft, staying inside the boom skin as it thins toward the stabilator
    const boomTop = (s) => Math.min(0.3, FR.upperB(s, BZ + 0.12) - 0.035), boomBot = (s) => Math.max(-0.2, -FR.bD(s) + 0.05);
    const ring = (s, dw = 0, dh = 0) => FR.superRing(X(s), side * BZ, (boomTop(s) + boomBot(s)) / 2, 0.2 + dw, boomTop(s) - boomBot(s) + dh, 12, 6);
    for (const s of [12.1, 12.6, 13.6, 14.6, 15.6, 16.6, 17.33]) rings.push(ring(s));
    g.push(FR.gridSurface(rings, { closed: true }));
    // machined forward, middle and end frames that the isogrid panels are welded to
    const frames = [];
    for (const s of [12.13, 14.6, 17.3]) frames.push(FR.gridSurface([ring(s - 0.03, 0.025, 0.02), ring(s + 0.03, 0.025, 0.02)], { closed: true, uv: 'n' }));
    P(side > 0 ? 'Aft boom (right)' : 'Aft boom (left)', {
      system: 'Structure', material: 'Ti-6Al-4V isogrid panels electron-beam welded to machined frames (90+ pieces per ship set)', mass: 310,
      explode: [-1.9, 0.25, 1.15 * side],
      desc: 'Box-section titanium booms outboard of each engine carry the vertical tail and stabilator; the aft fuselage is 55 % titanium because the booms run beside the hot nozzles. Aerojet robotically electron-beam welded integrally stiffened isogrid panels to machined forward, middle and end frames — about 3,600 in (91 m) of welds per ship set instead of fasteners.',
    }, [mesh(merge(g), F.isogrid()), mesh(merge(frames), F.ti())]);
  }

  // ================================================================== wings
  // two trapezoids: root → the trailing-edge kink at z 5.87, then the 42° tip clip to the ≈ 1.0 m tip chord; built on
  // the structural chord and squeezed onto the real trailing edge (FR.warpWing)
  const ZR = 1.45, ZK = FR.WING.kinkZ, ZT = FR.WING.semi;
  const wRoot = FR.wingSection(ZR), wKink = FR.wingSection(ZK), wTip = FR.wingSection(ZT);
  const PAN = [[wRoot, wKink, ZR, ZK], [wKink, wTip, ZK, ZT]];
  /** wingPanel pieces between spans za and zb (split at the kink), chord fractions c0..c1. */
  const wingPieces = ({ c0, c1, za, zb, stations = 2 }) => {
    const out = [];
    for (const [r, t, z0, z1] of PAN) {
      const a = Math.max(za, z0), b = Math.min(zb, z1);
      if (b - a < 1e-6) continue;
      const eta0 = (a - z0) / (z1 - z0), eta1 = (b - z0) / (z1 - z0);
      const n = Math.max(1, Math.round((stations * (b - a)) / (zb - za)));
      const g = wingPanel({ root: r, tip: t, n: 22, c0, c1, eta0, eta1, stations: n });
      out.push(FR.warpWing(eta0 === 0 && r === wRoot ? trimRootFromDuct(g, wRoot, wKink) : g));
    }
    return out;
  };
  /** Mid-thickness point on the wing at span z and chord fraction cf. */
  const wPt = (z, cf) => { const sec = FR.wingSection(z); return V(sec.le[0] - cf * sec.chord, sec.le[1], z); };
  const SF = FR.SURF, HF = SF.hinge;
  const naca = naca00;
  for (const side of [1, -1]) {
    const flip = (g) => (side > 0 ? g : mirrorZ(g));
    const mz = (v) => new THREE.Vector3(v.x, v.y, v.z * side);
    const R = side > 0 ? 'right' : 'left';
    const panel = (o) => wingPieces(o).map(flip);
    // over the main-gear well the lower skin is cut out between the chord lines of FR.MAIN_WELL.wing from the root out to
    // the door's hinge (the buried root strip inside the fuselage, then the wing root's underside, where the fuselage's
    // patch fills the cut-out round the door's outline); the pieces either side keep their closing walls on those chord
    // lines, the middle piece keeps only its upper skin, and no span-end caps are left inside the wing at the strip joint
    const wellSkin = [];
    let zw = ZR;
    for (const [zz, ca, cb] of FR.MAIN_WELL.wing) {
      const o = { za: zw, zb: zz, stations: 1 };
      wellSkin.push(...panel({ c0: HF.lef, c1: ca, ...o }).map((g) => dropCaps(g, [zw, zz].filter((v) => v > ZR))));
      wellSkin.push(...panel({ c0: ca, c1: cb, ...o }).map(upperOnly));
      wellSkin.push(...panel({ c0: cb, c1: HF.flaperon, ...o }).map((g) => dropCaps(g, [zw, zz].filter((v) => v > ZR))));
      zw = zz;
    }
    const skin = [
      ...wellSkin,
      ...panel({ c0: HF.lef, c1: HF.flaperon, za: FR.MAIN_WELL.hingeZ, zb: SF.aileron[0], stations: 5 }).map((g) => dropCaps(g, [FR.MAIN_WELL.hingeZ])),
      ...panel({ c0: HF.lef, c1: HF.aileron, za: SF.aileron[0], zb: ZK, stations: 3 }),
      ...panel({ c0: HF.lef, c1: 1, za: ZK, zb: ZT, stations: 2 }),
      ...panel({ c0: 0, c1: HF.lef, za: ZR, zb: SF.lef[0], stations: 1 }),
      ...panel({ c0: 0, c1: HF.lef, za: SF.lef[1], zb: ZT, stations: 1 }),
      ...panel({ c0: HF.flaperon, c1: 1, za: ZR, zb: SF.flaperon[0], stations: 1 }),
      ...panel({ c0: HF.flaperon, c1: 1, za: SF.flaperon[1] - 0.02, zb: SF.flaperon[1], stations: 1 }),
      ...panel({ c0: HF.aileron, c1: 1, za: SF.aileron[0], zb: SF.aileron[0] + 0.02, stations: 1 }),
      ...panel({ c0: HF.aileron, c1: 1, za: SF.aileron[1] - 0.02, zb: ZK, stations: 1 }),
    ];
    const wing = P(`Wing skin (${R})`, {
      system: 'Skin & fairings', skin: true, material: 'Bismaleimide composite skins, RAM-treated edges', mass: 420,
      explode: [0, 0.35, 2.7 * side], callout: false,
      desc: 'Upper and lower skins of a 42°-swept wing with a −17° trailing edge; 78.04 m² for both wings (reference trapezoid) and a 13.56 m span, with 3.25° of anhedral. The trailing edge itself runs 0.145 m ahead of the trapezoid\'s (NAWDC and T.O. plan views), and outboard of the ailerons it is cut back parallel to the leading edge, so the real tip chord is only about 1 m. The real wing uses NACA 64A-series sections (5.92 % thick at the root, 4.29 % at the tip) with conical camber and twist; the model keeps the thickness but uses symmetric sections.',
    }, [mesh(mergeGeometries(skin), F.wing()), mesh(ctx.wellPatch.wing(side), F.wing())]);   // the panels keep their chord / side attributes
    wing.userData.part.thermalRole = 'leadingEdge';

    // control surfaces
    const surf = (name, info, o, c, toward, testCf) => {
      const geo = mergeGeometries(panel(o));
      const p0 = mz(wPt(o.za, c)), p1 = mz(wPt(o.zb, c));
      const test = mz(wPt((o.za + o.zb) / 2, testCf));
      const h = hinge(mesh(geo, F.wing()), p0, p1, test, toward);
      const part = P(name, info, h.pivot);
      part.userData.part.thermalRole = info.thermal || null;
      return h;
    };
    const down = V(0, -1, 0);
    anim.lef.push({ side, h: surf(`Leading-edge flap (${R})`, {
      system: 'Flight controls', material: 'Composite over titanium torque tube', mass: 95, explode: [1.0, 0.1, 2.9 * side], thermal: 'leadingEdge',
      desc: 'A flap along most of the leading edge, from just outboard of the body to near the tip, driven by rotary actuators. It droops automatically with angle of attack to keep the flow attached, extending usable lift toward the 60° angles of attack the F-22 can fly with thrust vectoring.',
    }, { c0: 0, c1: HF.lef, za: SF.lef[0], zb: SF.lef[1], stations: 6 }, HF.lef, down, 0.0) });
    anim.flaperon.push({ side, h: surf(`Flaperon (${R})`, {
      system: 'Flight controls', material: 'Composite', mass: 120, explode: [-1.4, 0.15, 2.4 * side],
      desc: 'Inboard trailing-edge surface, from the body out to mid-span, that works as a flap for take-off and landing and as an aileron for roll. With the ailerons and rudders it also serves as the speed brake — the F-22 has no separate airbrake panel.',
    }, { c0: HF.flaperon, c1: 1, za: SF.flaperon[0], zb: SF.flaperon[1] - 0.02, stations: 3 }, HF.flaperon, down, 1) });
    anim.aileron.push({ side, h: surf(`Aileron (${R})`, {
      system: 'Flight controls', material: 'Composite', mass: 60, explode: [-1.2, 0.15, 3.3 * side],
      desc: 'Outboard trailing-edge surface for roll, ending where the tip is cut back. The fly-by-wire system blends it with the flaperons, differential stabilators and, at low speed, the rudders.',
    }, { c0: HF.aileron, c1: 1, za: SF.aileron[0] + 0.02, zb: SF.aileron[1] - 0.02, stations: 3 }, HF.aileron, down, 1) });

    // wing box (Boeing; the wing is almost 50 % titanium): titanium front, mid and rear spars machined
    // from forgings, resin-transfer-moulded "sine-wave" composite intermediate spars, ribs, and root
    // fittings that bolt the spars to the mid-fuselage bulkheads at the side of the body
    const zSOB = FR.WING.bodyZ - 0.08, zEnd = 6.7;
    const TI_F = [0.10, 0.49, 0.75], RTM_F = [0.23, 0.36, 0.62];
    const spanSecs = [zSOB, 2.7, 3.4, 4.1, 4.8, 5.5, ZK, 6.3, zEnd].map((z) => FR.wingSection(z));
    const ti = [], rtm = [], ribs = [], fits = [];
    for (const f of TI_F) {
      ti.push(sparWeb(spanSecs, f, f === 0.49 ? 0.018 : 0.024, 0.9, naca));
      ti.push(sparCaps(spanSecs, f, 0.075, 0.012, 0.9));
    }
    for (const f of RTM_F) {
      // corrugated web: a sine wave in plan (≈ 0.16 m pitch, estimate) stiffens a thin composite web
      const wave = [];
      for (let z = zSOB; z <= zEnd + 1e-6; z += 0.02) {
        const sec = FR.wingSection(z);
        wave.push({ le: [sec.le[0] + 0.018 * Math.sin((2 * Math.PI * (z - zSOB)) / 0.16), sec.le[1], z], chord: sec.chord, t: sec.t });
      }
      rtm.push(sparWeb(wave, f, 0.01, 0.9, naca));
      rtm.push(sparCaps(spanSecs, f, 0.06, 0.008, 0.9));
    }
    // (the root rib stops either side of the main-gear well, and a short rib just outboard of the main door's hinge
    // closes the well's outboard end between the 36 % and 49 % spars)
    for (const z of [2.65, 3.25, 3.85, 4.45, 5.05, 5.55, ZK, 6.3, zEnd]) ribs.push(ribPlate(FR.wingSection(z), 0.1, 0.75, 0.012, 0.88, naca));
    for (const [c0, c1] of [[0.1, 0.355], [0.495, 0.75]]) ribs.push(ribPlate(FR.wingSection(zSOB), c0, c1, 0.02, 0.88, naca));
    ribs.push(ribPlate(FR.wingSection(FR.MAIN_WELL.hingeZ + 0.06), 0.36, 0.49, 0.012, 0.88, naca));
    // root fittings: a lug on each spar end, bolted to the bulkhead it lines up with
    const sob = FR.wingSection(zSOB);
    for (const f of [...TI_F, ...RTM_F]) {
      // (the lugs of the spars either side of the main-gear well are shorter and stand off it, on the bulkhead's
      // forward face and the engine-bay frame's aft face)
      const dx = f === 0.36 ? 0.04 : f === 0.49 ? -0.075 : 0, ls = f === 0.36 || f === 0.49 ? 0.1 : 0.16;
      const x = sob.le[0] - f * sob.chord + dx, hh = naca(f, sob.t) * sob.chord * 0.9;
      // short in z, so the lugs stay in the side wall clear of the gun, its ammunition container and the APU ducts
      fits.push(new THREE.BoxGeometry(ls, hh * 1.7, 0.06).translate(x, sob.le[1], zSOB - 0.03));
      for (const dy of [-hh * 0.55, hh * 0.55]) fits.push(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 10).rotateX(Math.PI / 2).translate(x, sob.le[1] + dy, zSOB - 0.03));
    }
    const sideG = (g) => (side > 0 ? g : mirror(g));
    P(`Wing titanium spars (${R})`, {
      system: 'Structure', material: 'Ti-6Al-4V spars machined from forgings, with spar caps', mass: 330,
      explode: [0, -0.2, 2.2 * side], callout: side > 0, anchor: [X(FR.WM(10.44)), FR.wingY(3.4), 3.4 * side],
      desc: 'The front, mid and rear spars are machined titanium forgings. Boeing\'s wing is almost 50 % titanium, partly because an intermediate composite spar was changed to titanium wherever it was needed to tolerate battle damage (every third one, by Flight\'s account).',
    }, mesh(sideG(FR.warpWing(merge(ti))), F.tiDull()));
    P(`Wing RTM sine-wave spars (${R})`, {
      system: 'Structure', material: 'Resin-transfer-moulded composite spars with corrugated (sine-wave) webs', mass: 120,
      explode: [0, -0.5, 2.35 * side],
      desc: 'Intermediate spars made by resin transfer moulding: dry fibre preforms are injected with resin in a closed mould, and the wavy web stays stiff without heavy stiffeners. Dow-UT delivered these RTM spars — 44 per ship set — among the first production RTM primary structure.',
    }, mesh(sideG(FR.warpWing(merge(rtm))), F.composite()));
    P(`Wing ribs (${R})`, {
      system: 'Structure', material: 'Machined aluminium / titanium and composite ribs', mass: 230,
      explode: [0, 0.15, 2.5 * side],
      desc: 'Ribs across the spars hold the airfoil shape, carry the skin loads into the spars and divide the integral wing tank into bays (rib count approximate). The root rib closes the wing at the side of the body.',
    }, mesh(sideG(FR.warpWing(merge(ribs))), F.alu()));
    P(`Wing root attach fittings (${R})`, {
      system: 'Structure', material: 'Titanium lugs and high-strength steel shear pins', mass: 110,
      explode: [0, -0.15, 1.7 * side],
      desc: 'Each spar ends in a lug at the side of the body, pinned to the fuselage bulkhead or frame it lines up with, so wing bending passes straight into the fuselage carry-through structure (lug detail approximate).',
    }, mesh(sideG(merge(fits)), F.steel()));

    // wing control actuators: LEF power drive unit, torque tube and rotary actuators; trailing-edge actuators
    {
      const g = [];
      // (along the space between the flap's hinge line and the front spar's caps, FR.lefDriveF)
      const lefA = mz(wPt(SF.lef[0] + 0.05, FR.lefDriveF(SF.lef[0] + 0.05).f)), lefB = mz(wPt(SF.lef[1] - 0.1, FR.lefDriveF(SF.lef[1] - 0.1).f));
      g.push(FR.pipe([[FR.SN - lefA.x, lefA.y, lefA.z], [FR.SN - lefB.x, lefB.y, lefB.z]], 0.014, 6, 4));
      for (const z of [2.7, 3.5, 4.3, 5.1, 5.9]) {
        const LD = FR.lefDriveF(z), p = mz(wPt(z, LD.f));
        // geared rotary actuator on the torque tube, sized to the local wing depth behind the flap hinge,
        // with its output arm forward to the flap
        const sec = FR.wingSection(z);
        const r = Math.min(0.05, naca(LD.f, sec.t) * sec.chord * 0.5, LD.half - 0.003);
        g.push(new THREE.CylinderGeometry(r, r, 0.2, 12).rotateX(Math.PI / 2).translate(p.x, p.y, p.z));
        g.push(new THREE.CylinderGeometry(r * 1.15, r * 1.15, 0.05, 12).rotateX(Math.PI / 2).translate(p.x, p.y, p.z + 0.06));
        g.push(new THREE.BoxGeometry(0.16, r * 0.6, 0.03).translate(p.x + 0.08, p.y, p.z - 0.06));
      }
      // power drive unit at the wing root, just outboard of the body side, geared into the inboard end of the torque tube
      const [pS, pY, pZ] = FR.lefPduAt(), pdu = mz(V(FR.SN - pS, pY, pZ));
      g.push(new THREE.BoxGeometry(0.26, 0.09, 0.13).translate(pdu.x, pdu.y, pdu.z));
      P(`Leading-edge flap drive (${R})`, {
        system: 'Flight controls', material: 'Hydraulic power drive unit, titanium torque tube, rotary geared actuators', mass: 55, explode: [0.6, -0.6, 2.6 * side],
        desc: 'A hydraulic power drive unit at the wing root turns a torque tube along the front spar, and geared rotary actuators along it move the leading-edge flap. Curtiss-Wright developed these geared rotary actuators and has supplied them since the start of the programme (actuator count approximate; each is sized to the local wing depth).',
      }, mesh(merge(g), F.hyd()));
      const t = [];
      for (const k of ['flaperon', 'aileron']) {
        const { z, c, len } = FR.TE_ACT[k];
        const p = mz(wPt(z, c));
        t.push(new THREE.CylinderGeometry(0.045, 0.04, len, 10).rotateZ(Math.PI / 2).translate(p.x + len / 2 - 0.05, p.y, p.z));
        t.push(new THREE.BoxGeometry(0.06, 0.07, 0.08).translate(p.x - 0.05, p.y, p.z));
      }
      P(`Flaperon & aileron actuators (${R})`, {
        system: 'Flight controls', material: 'Steel / titanium 4,000 psi linear hydraulic actuators', mass: 45, explode: [-0.5, -0.7, 2.6 * side],
        desc: 'One linear hydraulic actuator drives each surface, the flaperon and the aileron: the F-22 saves weight with a single actuator on every control surface and relies on flight-control reconfiguration if one fails (Flight International, 1997). Each is commanded electrically by the vehicle-management system (positions approximate).',
      }, mesh(merge(t), F.hyd()));
    }

    // store hardpoints inside the wing box: four in all, the inboard pair plumbed for 600 US gal ferry tanks
    {
      const g = [], f = [];
      for (const [zz, wet] of [[2.75, true], [4.15, false]]) {
        const p = mz(wPt(zz, 0.42));
        const sec = FR.wingSection(Math.abs(p.z));
        const yb = p.y - naca(0.42, sec.t) * sec.chord * 0.9;
        g.push(new THREE.BoxGeometry(0.62, 0.05, 0.12).translate(p.x, yb + 0.035, p.z));
        for (const dx of [-0.24, 0.24]) g.push(new THREE.CylinderGeometry(0.025, 0.025, 0.05, 10).translate(p.x + dx, yb + 0.02, p.z));
        g.push(new THREE.BoxGeometry(0.08, 0.04, 0.06).translate(p.x - 0.27, yb + 0.03, p.z));                     // aft pivot fitting
        if (wet) {
          // fuel and air (tank pressurisation) couplings, each piped up into the wing tank above
          f.push(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 10).translate(p.x - 0.05, yb + 0.03, p.z + 0.08 * side));
          f.push(new THREE.CylinderGeometry(0.022, 0.022, 0.05, 10).translate(p.x + 0.1, yb + 0.03, p.z + 0.08 * side));
          f.push(FR.pipe([[FR.SN - (p.x - 0.05), yb + 0.06, p.z + 0.08 * side], [FR.SN - (p.x - 0.05), yb + 0.16, p.z + 0.1 * side], [FR.SN - (p.x + 0.1), yb + 0.2, p.z + 0.18 * side]], 0.014, 6, 6));
          f.push(FR.pipe([[FR.SN - (p.x + 0.1), yb + 0.055, p.z + 0.08 * side], [FR.SN - (p.x + 0.12), yb + 0.18, p.z + 0.08 * side]], 0.01, 6, 4));
          g.push(new THREE.CylinderGeometry(0.02, 0.02, 0.04, 10).translate(p.x + 0.18, yb + 0.03, p.z - 0.06 * side));   // electrical connector
        }
      }
      P(`Wing store hardpoints (${R})`, {
        system: 'Structure', material: 'Titanium pylon fittings and sway-brace pads, flush under the lower skin', mass: 30, count: 2,
        explode: [0, -1.1, 2.9 * side],
        desc: 'Two of the F-22\'s four underwing hardpoints, each rated for about 5,000 lb, with sway-brace pads and an aft pivot for the pylon. They are normally bare and covered flush; the inboard one also has fuel, air and electrical couplings for a 600 US gal (2,270 L) ferry tank on a BRU-47/A rack, at the cost of stealth.',
      }, [mesh(merge(g), F.tiDull()), mesh(merge(f), F.pipe())]);
    }

    // nav light lens and formation strip on the wing tip
    ctx.wingTips = ctx.wingTips || [];
    ctx.wingTips.push({ side, le: mz(new THREE.Vector3(wTip.le[0], wTip.le[1], wTip.le[2])), chord: wTip.chord });
  }

  // ================================================================== stabilators
  for (const side of [1, -1]) {
    const R = side > 0 ? 'right' : 'left';
    const flip = (g) => (side > 0 ? g : mirrorZ(g));
    // the outline turns at the notch (cut-back leading edge → 42° edge), the trailing-edge vertex and the tip
    const brk = FR.STAB_BREAKS();
    const geo = [];
    for (let k = 0; k < brk.length - 1; k++) {
      const a = FR.stabSection(brk[k]), b = FR.stabSection(brk[k + 1]);
      geo.push(flip(wingPanel({ root: a, tip: b, stations: Math.max(1, Math.round((brk[k + 1] - brk[k]) / 0.4)), n: 20 })));
    }
    const p0 = V(X(FR.STAB.pivotS), FR.STAB.y, 0), p1 = V(X(FR.STAB.pivotS), FR.STAB.y, side);
    const testTE = V(X(18.0), FR.STAB.y, side * 2.6);
    const h = hinge(mesh(mergeGeometries(geo), F.wing()), p0, p1, testTE, V(0, -1, 0));
    const stab = P(`Stabilator (${R})`, {
      system: 'Flight controls', material: 'Composite skins on a titanium torque box', mass: 290,
      explode: [-2.3, -0.2, 1.9 * side], callout: false,
      desc: 'All-moving horizontal tail (8.84 m span over both sides) for pitch control. Its leading edge repeats the wing\'s 42°, and the aft-most point of the whole aircraft is the corner of its notched trailing edge. On the jet the inboard leading edge tucks under the flaperon; the model cuts it back to run just behind the wing (the real travel limits are not published). The two sides also move differentially to help roll at high angle of attack.',
    }, h.pivot);
    stab.userData.part.thermalRole = 'leadingEdge';
    anim.stab.push({ side, h });

    // torque box and spindle (rotates with the stabilator)
    const secs = [brk[0], brk[1], brk[2], 3.6, 4.3].map((z) => FR.stabSection(z));
    const g = [];
    for (const f of [0.15, 0.42, 0.7]) g.push(sparWeb(secs, f, 0.016, 0.88, naca00));
    for (const sec of secs) g.push(ribPlate(sec, 0.12, 0.75, 0.012, 0.86, naca00));
    const spindle = new THREE.CylinderGeometry(0.062, 0.062, 0.7, 16).rotateX(Math.PI / 2).translate(X(FR.STAB.pivotS), FR.STAB.y, FR.STAB.rootZ - 0.2);
    g.push(spindle);
    const boxGeo = merge(g);
    const hb = hinge(mesh(side > 0 ? boxGeo : mirror(boxGeo), F.ti()), p0, p1, testTE, V(0, -1, 0));
    P(`Stabilator torque box & spindle (${R})`, {
      system: 'Structure', material: 'Titanium spindle and spars', mass: 110, explode: [-2.3, -0.2, 1.4 * side],
      desc: 'The whole stabilator turns on a single titanium spindle carried in bearings in the aft boom (pivot station approximate); spars and ribs inside spread the load into the composite skins.',
    }, hb.pivot);
    anim.stab.push({ side, h: hb });

    // actuator in the boom driving the spindle crank
    const act = [];
    const ps = FR.STAB.pivotS;
    act.push(new THREE.CylinderGeometry(0.075, 0.065, 0.9, 12).rotateZ(Math.PI / 2 - 0.25).translate(X(ps - 0.5), -0.2, side * 1.62));
    act.push(new THREE.BoxGeometry(0.12, 0.3, 0.1).translate(X(ps), -0.12, side * 1.62));
    P(`Stabilator actuator (${R})`, {
      system: 'Flight controls', material: 'Dual-tandem hydraulic actuator, 4,000 psi', mass: 55, explode: [-1.6, -0.75, 1.25 * side],
      desc: 'The stabilator\'s single actuator (the F-22 has one on each control surface) sits in the boom and drives a crank on the spindle. If its hydraulic supply fails, a compensator keeps the actuator stiff and the flight controls reconfigure to fly on the remaining surfaces (Flight International, 1997).',
    }, mesh(merge(act), F.hyd()));
  }

  // ================================================================== vertical tails
  for (const side of [1, -1]) {
    const R = side > 0 ? 'right' : 'left';
    const T = FR.FIN;
    const vRoot = { le: [0, 0, 0], chord: T.rootC, t: 0.045 };
    const vTip = { le: [-T.span * Math.tan(T.sweep), 0, T.span], chord: T.tipC, t: 0.035 };
    const place = (part) => {
      part.position.set(X(T.rootS), T.rootY, side * T.rootZ);
      part.rotation.x = -Math.PI / 2 + T.cant * side;
      return part;
    };
    const fin = [
      wingPanel({ root: vRoot, tip: vTip, c0: 0, c1: 0.72, stations: 5 }),
      wingPanel({ root: vRoot, tip: vTip, c0: 0.72, c1: 1, eta0: 0, eta1: 0.06, stations: 1 }),
      wingPanel({ root: vRoot, tip: vTip, c0: 0.72, c1: 1, eta0: 0.66, eta1: 1, stations: 2 }),
    ];
    const vt = place(P(`Vertical tail (${R})`, {
      system: 'Skin & fairings', skin: true, material: 'Composite skins, RAM-treated edges', mass: 230,
      explode: [-0.9, 2.0, 1.1 * side], callout: side > 0, anchor: [-2.0, 0.03, 2.9],
      desc: 'Each fin is canted 28° outward so neither presents a flat, vertical surface to a radar looking from the side. Together the two give about 16.5 m² of vertical tail area.',
    }, mesh(mergeGeometries(fin), F.wing())));
    vt.userData.part.thermalRole = 'leadingEdge';

    const rud = wingPanel({ root: vRoot, tip: vTip, c0: 0.72, c1: 1, eta0: 0.06, eta1: 0.66, stations: 3 });
    const h = hinge(mesh(rud, F.wing()), wingPoint(vRoot, vTip, 0.06, 0.72), wingPoint(vRoot, vTip, 0.66, 0.72),
      wingPoint(vRoot, vTip, 0.36, 1.0), V(0, -1, 0));
    place(P(`Rudder (${R})`, {
      system: 'Flight controls', material: 'Composite', mass: 45, explode: [-1.5, 2.1, 1.45 * side],
      desc: 'Rudders on the lower two-thirds of each fin trailing edge yaw the jet; deflected outward together they also act as part of the speed brake.',
    }, h.pivot));
    anim.rudder.push({ side, h });

    const secs = [0, 0.33, 0.66, 0.95].map((e) => {
      const le = [lerp(vRoot.le[0], vTip.le[0], e), 0, lerp(0, T.span, e)];
      return { le, chord: lerp(T.rootC, T.tipC, e), t: lerp(0.045, 0.035, e) };
    });
    const g = [];
    for (const f of [0.12, 0.4, 0.68]) g.push(sparWeb(secs, f, 0.016, 0.88, naca00));
    for (const sec of secs) g.push(ribPlate(sec, 0.12, 0.68, 0.012, 0.86, naca00));
    place(P(`Fin box (${R})`, {
      system: 'Structure', material: 'Composite front and intermediate spars, titanium rear spar, composite ribs, titanium root fittings', mass: 140, explode: [-0.9, 1.4, 0.75 * side],
      desc: 'Spars and ribs make each fin a stiff torque box, bolted at its root to the aft boom. The rear spar was changed from composite to titanium during development to cure fin buffet at high angle of attack.',
    }, mesh(merge(g), F.composite())));

    // in the fin's local frame: chord along −x, span along +z, thickness along y
    const act = [new THREE.CylinderGeometry(0.028, 0.03, 0.56, 10).rotateX(Math.PI / 2).translate(-T.rootC * 0.64, 0, 0.36)];
    act.push(new THREE.BoxGeometry(0.18, 0.06, 0.16).translate(-T.rootC * 0.64, 0, 0.1));
    place(P(`Rudder actuator (${R})`, {
      system: 'Flight controls', material: 'Hydraulic actuator in the fin root', mass: 25, explode: [-1.4, 1.2, 1.0 * side],
      desc: 'A compact hydraulic actuator at the base of the fin drives the rudder through its lower hinge.',
    }, mesh(merge(act), F.hyd())));
  }

  // ================================================================== bay / well liners
  {
    const g = [];
    // side weapons bays (in the trunk walls)
    const stS = stations(FR.SIDE_BAY.s0, FR.SIDE_BAY.s1, 0.2);
    for (const side of [1, -1]) {
      g.push(cavityGrid(stS.map((s) => FR.sideBaySection(s).map(([zz, y]) => [X(s), y, side * zz]))));
      // countermeasure bay behind the side bay
      const stC = stations(FR.CM_BAY.s0, FR.CM_BAY.s1, 0.3);
      const edgeC = (s) => {
        const wf = FR.wallFractions(s);
        const a = FR.wallB(s, wf[5]), b = FR.wallB(s, wf[6]);
        return [[X(s), a[1], side * a[0]], [X(s), b[1], side * b[0]]];
      };
      g.push(cavity(stC, edgeC, () => [0, 0.05, -side * 1], 0.12));
    }
    // main-gear wells (FR.wellRow): the deep well from the belly inboard of the opening round its inboard wall, which
    // stays clear of the fan case and the engine-bay harness above the gear beam, under a roof below the upper deck and
    // the wing's upper skin, out to the door's hinge, between the 36 % and 49 % spars in the wing root; the shallow
    // pockets under the skin where the doors' outline reaches past it (the forward teeth, and aft of the engine-bay frame
    // at sAft). Its end walls close along the skin; the bulkhead web and the gear beam stand inside it.
    const MW = FR.MAIN_WELL;
    const vs = [...FR.MAIN_DOORS.main.fore, ...FR.MAIN_DOORS.main.aft, ...FR.MAIN_DOORS.inboard.fore, ...FR.MAIN_DOORS.inboard.aft].map((v) => v[1]);
    const sparS = (f, z) => FR.wingLE(z) + f * (FR.wingTEline(z) - FR.wingLE(z));
    const must = [...vs, ...[0.36, 0.49].flatMap((f) => [sparS(f, MW.zSob), sparS(f, MW.hingeZ)]), FR.AMMO.s1 + MW.ammoNotch - 0.0005, FR.AMMO.s1 + MW.ammoNotch + 0.0005];
    const sEnd = Math.max(...vs) - 0.001;
    const deepSt = stations(MW.s0, MW.sAft, 0.03, must), pocketSt = stations(MW.sAft + 0.003, sEnd, 0.02, must);
    for (const side of [1, -1]) {
      for (const [st, po] of [[deepSt, false], [pocketSt, true]]) {
        const rows = st.map((s) => FR.wellRow(s, po && s <= MW.sAft + 0.0031));
        const grid = rows.map((r, i) => r.pts.map(([z, y]) => [X(st[i]), y, side * z]));
        const close = (i) => FR.wellRowClosure(st[i], rows[i]).map(([z, y]) => [X(st[i]), y, side * z]);
        g.push(cavityRowsClosed(grid, (r) => close(r)));
      }
    }
    // nose-gear well: between the inlets, from the stepped opening up its side walls to the underside of the cockpit
    // floor, and behind the cockpit's aft bulkhead to F-1A's stepped floor over the trunnion
    {
      const NW = FR.NOSE_WELL;
      const stN = [...new Set([...stations(NW.front, NW.aft, 0.1, [NW.sStep]), NW.sStep + 0.002])].sort((p, q) => p - q);
      g.push(cavityRows(stN.map((s) => {
        const roof = s <= NW.sStep + 1e-6 ? NW.roof : NW.roofAft, b = (z) => FR.bottomAt(s, z);
        const row = [[-NW.z, b(NW.z)], [-NW.wall, b(NW.wall) + 0.02], [-NW.wall, roof], [-0.09, roof], [0.09, roof], [NW.wall, roof], [NW.wall, b(NW.wall) + 0.02], [NW.z, b(NW.z)]];
        return row.map(([z, y]) => [X(s), y, z]);
      })));
    }
    P('Side bay & gear-well liners', {
      system: 'Structure', material: 'Aluminium / composite liners', mass: 120, explode: [0, -0.35, 0],
      desc: 'Sealed liners form the two side weapons bays and the countermeasure bays in the inlet trunks and the three landing-gear wells, keeping airflow and moisture out of the fuselage when the doors open.',
    }, mesh(merge(g), F.bay()));
  }

  return { ringsA, ringsB, sA, sB };
}
