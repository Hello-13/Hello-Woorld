// UH-60M fuselage: one parametric outer surface from the nose to the tail cone, cut into skin
// panels, doors and transparencies that share its grid (so every door and window fits its opening
// exactly), plus the primary structure that sits just inside it.
//
// Section at station x: a superellipse with half-width hw, waist height yW, top yT and keel yB,
// boxier below (flat cabin floor and belly) than above. Angle a runs −π/2 (keel) → 0 (right
// waist) → π/2 (roof) → π (left waist) → 3π/2 (keel). Ground y = 0; rotor shaft at x = 0.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { MAT, pchip, merge, tube, pipe, box, bar, V3, mirror } from './common.js';

const K = {
  yB: [[-9.35, 1.62], [-8.75, 1.52], [-8.0, 1.43], [-6.5, 1.29], [-5.0, 1.14], [-4.0, 1.0], [-3.2, 0.8], [-2.6, 0.62], [-2.0, 0.51], [-1.6, 0.47], [2.4, 0.47], [3.2, 0.49], [3.8, 0.53], [4.2, 0.6], [4.5, 0.7], [4.7, 0.84], [4.81, 1.0]],
  yT: [[-9.35, 1.9], [-8.75, 1.96], [-8.0, 1.99], [-6.5, 2.05], [-5.0, 2.11], [-4.0, 2.16], [-3.2, 2.21], [-2.6, 2.24], [-1.6, 2.25], [2.4, 2.28], [3.0, 2.31], [3.35, 2.26], [3.6, 2.1], [3.9, 1.86], [4.2, 1.6], [4.5, 1.47], [4.7, 1.32], [4.81, 1.08]],
  hw: [[-9.35, 0.16], [-8.75, 0.26], [-8.0, 0.3], [-6.5, 0.37], [-5.0, 0.47], [-4.0, 0.58], [-3.2, 0.8], [-2.6, 1.02], [-2.0, 1.15], [-1.6, 1.18], [2.3, 1.18], [2.9, 1.14], [3.4, 1.09], [3.8, 1.0], [4.1, 0.9], [4.4, 0.75], [4.6, 0.58], [4.72, 0.4], [4.78, 0.24], [4.81, 0.03]],
  yW: [[-9.35, 1.76], [-8.75, 1.74], [-6.5, 1.67], [-4.0, 1.55], [-3.2, 1.42], [-2.6, 1.26], [-2.0, 1.15], [-1.6, 1.12], [2.4, 1.12], [3.4, 1.1], [4.2, 1.05], [4.81, 1.04]],
  nUp: [[-9.35, 2.2], [-3.2, 2.3], [-2.0, 2.8], [2.4, 3.0], [3.4, 2.6], [4.2, 2.4], [4.81, 2.2]],
  nLo: [[-9.35, 2.2], [-3.2, 2.6], [-2.0, 4.0], [2.4, 4.5], [3.6, 3.5], [4.3, 2.6], [4.81, 2.2]],
};
export const NOSE_X = 4.81, TAIL_X = -9.35;

const sectionCache = new Map();
export function section(x) {
  const key = Math.round(x * 1e5);
  let s = sectionCache.get(key);
  if (!s) {
    s = { yB: pchip(K.yB, x), yT: pchip(K.yT, x), hw: pchip(K.hw, x), yW: pchip(K.yW, x), nUp: pchip(K.nUp, x), nLo: pchip(K.nLo, x) };
    if (sectionCache.size > 60000) sectionCache.clear();
    sectionCache.set(key, s);
  }
  return s;
}

/** Surface point at station x and section angle a (see header), optionally offset along the normal. */
export function surfPoint(x, a, off = 0) {
  const s = section(x);
  const c = Math.cos(a), sn = Math.sin(a);
  const up = sn >= 0;
  const e = 2 / (up ? s.nUp : s.nLo);
  const z = s.hw * Math.sign(c) * Math.pow(Math.abs(c), e);
  const y = s.yW + (up ? s.yT - s.yW : s.yW - s.yB) * Math.sign(sn) * Math.pow(Math.abs(sn), e);
  const p = V3(x, y, z);
  if (off) p.addScaledVector(surfNormal(x, a), off);
  return p;
}
export function surfNormal(x, a) {
  const h = 0.01, k = 0.004;
  const dx = surfPoint(Math.min(NOSE_X, x + h), a).sub(surfPoint(Math.max(TAIL_X, x - h), a));
  const da = surfPoint(x, a + k).sub(surfPoint(x, a - k));
  const n = dx.cross(da);
  return n.lengthSq() > 1e-14 ? n.normalize() : V3(1, 0, 0);
}
/** Top of the fuselage (roof/tail-cone crest) at station x. */
export const roofY = (x) => pchip(K.yT, x);

/** Half-width of the outer surface at station x and height y (0 outside the section). */
export function halfWidthAt(x, y) {
  const s = section(x);
  if (y <= s.yB || y >= s.yT) return 0;
  let lo = y < s.yW ? -Math.PI / 2 : 0, hi = y < s.yW ? 0 : Math.PI / 2;
  const rising = true;                       // y(a) increases from −π/2 to π/2 on the right side
  for (let i = 0; i < 40; i++) {
    const m = 0.5 * (lo + hi);
    if ((surfPoint(x, m).y < y) === rising) lo = m; else hi = m;
  }
  return surfPoint(x, 0.5 * (lo + hi)).z;
}
/** Smallest half-width over stations [x0, x1] at height y (for parts that must stay inside the skin). */
export function minHalfWidth(x0, x1, y, n = 6) {
  let w = Infinity;
  for (let i = 0; i <= n; i++) w = Math.min(w, halfWidthAt(x0 + ((x1 - x0) * i) / n, y));
  return w;
}

// --------------------------------------------------------------------------- openings (right side)
// Each is an (x, a) rectangle; `mirror` adds the left-hand twin at a → π − a.
const O = {
  windshield: { x0: 3.36, x1: 4.2, a0: 0.46, a1: Math.PI / 2 - 0.035 },
  quarter: { x0: 3.4, x1: 4.06, a0: 0.06, a1: 0.4 },
  overhead: { x0: 2.8, x1: 3.3, a0: 0.95, a1: Math.PI / 2 - 0.1 },
  ckDoor: { x0: 2.3, x1: 3.36, a0: -0.55, a1: 0.78 },
  ckWindow: { x0: 2.4, x1: 3.28, a0: 0.0, a1: 0.7 },
  gunner: { x0: 1.56, x1: 2.18, a0: 0.05, a1: 0.7 },
  cabDoor: { x0: -0.42, x1: 1.42, a0: -0.72, a1: 0.86 },
  cabWindow: { x0: 0.5, x1: 1.12, a0: 0.12, a1: 0.66 },       // forward window of each sliding door
  cabWindow2: { x0: -0.24, x1: 0.38, a0: 0.12, a1: 0.66 },    // aft window
  avDoor: { x0: 4.22, x1: 4.7, a0: -0.5, a1: 0.75 },
  hookWell: { x0: -0.31, x1: 0.15, a0: -Math.PI / 2, a1: -Math.PI / 2 + 0.08 },   // cargo-hook well in the belly
};
export const OPENINGS = O;
const both = (r) => [{ ...r, side: 1 }, { ...r, side: -1 }];
const inside = (r, x, a) => {
  if (x < r.x0 || x > r.x1) return false;
  return r.side > 0 ? a >= r.a0 && a <= r.a1 : a >= Math.PI - r.a1 && a <= Math.PI - r.a0;
};

// --------------------------------------------------------------------------- grid
function buildGrid() {
  const edgesX = [], edgesA = [];
  for (const r of Object.values(O)) { edgesX.push(r.x0, r.x1); edgesA.push(r.a0, r.a1, Math.PI - r.a0, Math.PI - r.a1); }
  edgesX.push(-3.4, -1.8, 2.2, 3.36, 4.2);
  const xs = [];
  for (let x = TAIL_X; x < 4.5; x += 0.11) xs.push(x);
  for (let x = 4.5; x < NOSE_X; x += 0.03) xs.push(x);
  const dedup = (arr, edges, tol) => {
    const keep = arr.filter((v) => !edges.some((e) => Math.abs(v - e) < tol));
    return [...new Set([...keep, ...edges].map((v) => +v.toFixed(5)))].sort((p, q) => p - q);
  };
  const X = dedup(xs, [...edgesX, NOSE_X, TAIL_X], 0.035).filter((x) => x >= TAIL_X - 1e-6 && x <= NOSE_X + 1e-6);
  const as = [];
  const NA = 84;
  for (let j = 0; j <= NA; j++) as.push(-Math.PI / 2 + (2 * Math.PI * j) / NA);
  // the angles were rounded to 1e-5 in dedup, so the keel rows (−π/2, 3π/2) need a tolerance above that
  const Aa = dedup(as, edgesA, 0.03).filter((a) => a >= -Math.PI / 2 - 1e-4 && a <= 1.5 * Math.PI + 1e-4);
  const P = [], N = [], U = [];
  for (const x of X) {
    const rowP = [], rowN = [], rowU = [];
    let arc = 0, prev = null;
    for (const a of Aa) {
      const p = surfPoint(x, a);
      if (prev) arc += p.distanceTo(prev);
      prev = p;
      rowP.push(p); rowN.push(surfNormal(x, a)); rowU.push([x, arc]);
    }
    P.push(rowP); N.push(rowN); U.push(rowU);
  }
  return { X, A: Aa, P, N, U };
}

/** Surface patch over station range [x0, x1] and angle range [a0, a1], minus holes, offset along the normal. */
function patch(G, { x0 = -99, x1 = 99, a0 = -9, a1 = 9, holes = [], off = 0, only = null, capTip = false, capTail = false }) {
  const pos = [], nrm = [], uv = [], idx = [];
  const map = new Map();
  const NA = G.A.length;
  const vid = (i, j) => {
    const key = i * NA + j;
    let v = map.get(key);
    if (v === undefined) {
      const p = G.P[i][j], n = G.N[i][j];
      pos.push(p.x + n.x * off, p.y + n.y * off, p.z + n.z * off);
      nrm.push(n.x, n.y, n.z);
      uv.push(G.U[i][j][0], G.U[i][j][1]);
      v = pos.length / 3 - 1;
      map.set(key, v);
    }
    return v;
  };
  for (let i = 0; i < G.X.length - 1; i++) {
    const xm = 0.5 * (G.X[i] + G.X[i + 1]);
    if (xm < x0 || xm > x1) continue;
    for (let j = 0; j < NA - 1; j++) {
      const am = 0.5 * (G.A[j] + G.A[j + 1]);
      if (am < a0 || am > a1) continue;
      if (only && !only.some((r) => inside(r, xm, am))) continue;
      if (holes.some((r) => inside(r, xm, am))) continue;
      const a = vid(i, j), b = vid(i, j + 1), c = vid(i + 1, j), d = vid(i + 1, j + 1);
      idx.push(a, c, b, b, c, d);
    }
  }
  const fan = (i, flip) => {
    const ring = G.P[i];
    const cen = ring.reduce((s, p) => s.add(p), V3()).multiplyScalar(1 / ring.length);
    const base = pos.length / 3;
    pos.push(cen.x, cen.y, cen.z); nrm.push(flip ? -1 : 1, 0, 0); uv.push(cen.x, 0);
    for (let j = 0; j < NA; j++) { const p = ring[j]; pos.push(p.x, p.y, p.z); nrm.push(flip ? -1 : 1, 0, 0); uv.push(p.x, j * 0.05); }
    for (let j = 0; j < NA - 1; j++) { if (flip) idx.push(base, base + 2 + j, base + 1 + j); else idx.push(base, base + 1 + j, base + 2 + j); }
  };
  if (capTip) fan(G.X.length - 1, false);
  if (capTail) fan(0, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Rubber seal / frame along the outline of an opening (x, a rectangle). */
function outline(r, off = 0.004, rad = 0.014) {
  const pts = [];
  const a0 = r.side > 0 ? r.a0 : Math.PI - r.a1, a1 = r.side > 0 ? r.a1 : Math.PI - r.a0;
  const n = 10;
  for (let i = 0; i <= n; i++) pts.push(surfPoint(r.x0 + ((r.x1 - r.x0) * i) / n, a0, off));
  for (let i = 1; i <= n; i++) pts.push(surfPoint(r.x1, a0 + ((a1 - a0) * i) / n, off));
  for (let i = 1; i <= n; i++) pts.push(surfPoint(r.x1 - ((r.x1 - r.x0) * i) / n, a1, off));
  for (let i = 1; i < n; i++) pts.push(surfPoint(r.x0, a1 - ((a1 - a0) * i) / n, off));
  pts.push(pts[0].clone());
  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.1);
  return new THREE.TubeGeometry(curve, 80, rad, 5, true);
}

/**
 * Painted marking as a thin patch of the surface itself (no projection needed): the texture is
 * mapped over stations [x0, x1] and angles [a0, a1] on the right side, mirrored for side −1 so
 * the lettering reads nose-first on both sides. Studio-only, like a decal.
 */
export function stencil(texture, { x0, x1, a0, a1, side = 1, off = 0.004, nx = 16, na = 6 }) {
  const pos = [], nrm = [], uv = [], idx = [];
  for (let i = 0; i <= nx; i++) {
    const x = x0 + ((x1 - x0) * i) / nx;
    for (let j = 0; j <= na; j++) {
      const ar = a0 + ((a1 - a0) * j) / na;
      const a = side > 0 ? ar : Math.PI - ar;
      const p = surfPoint(x, a, off), n = surfNormal(x, a);
      pos.push(p.x, p.y, p.z); nrm.push(n.x, n.y, n.z);
      uv.push(side > 0 ? i / nx : 1 - i / nx, j / na);
    }
  }
  for (let i = 0; i < nx; i++) for (let j = 0; j < na; j++) {
    const a = i * (na + 1) + j, b = a + 1, c = a + na + 1, d = c + 1;
    if (side > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: texture, transparent: true, depthWrite: false, roughness: 0.8, metalness: 0.02, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.userData.decal = true;
  m.raycast = () => {};
  return m;
}

/** Interior lining: the same patch seen from inside (studio only, so X-ray stays clean). */
function liner(g) {
  const m = mesh(g, MAT.interior(), { cast: false });
  m.userData.decal = true;
  m.raycast = () => {};
  return m;
}

/** A hoop frame following the surface at station x, inset, skipping the angle gaps. */
function hoop(x, gaps = [], inset = 0.06, r = 0.028) {
  const out = [];
  let run = [];
  const flush = () => { if (run.length > 2) out.push(pipe(run, r, 5)); run = []; };
  for (let k = 0; k <= 72; k++) {
    const a = -Math.PI / 2 + (2 * Math.PI * k) / 72;
    const inGap = gaps.some(([g0, g1]) => a > g0 && a < g1);
    if (inGap) { flush(); continue; }
    run.push(surfPoint(x, a, -inset));
  }
  flush();
  return out;
}
/** A stringer/longeron along constant angle a between stations. */
function stringer(x0, x1, a, inset = 0.06, r = 0.022) {
  const pts = [];
  for (let i = 0; i <= 12; i++) pts.push(surfPoint(x0 + ((x1 - x0) * i) / 12, a, -inset));
  return pipe(pts, r, 5);
}

/** Aft cabin bulkhead at x = -1.78: a plate cut to the section 3 cm inside the skin, from the floor
 *  up to the roof beams (a plain rectangle would push its corners out through the side skin). */
function aftBulkhead(x = -1.78, inset = 0.03, y0 = 0.585, y1 = 2.135) {
  const sh = new THREE.Shape();
  let last = null;
  for (let k = 0; k < 96; k++) {
    const p = surfPoint(x, -Math.PI / 2 + (2 * Math.PI * k) / 96, -inset);
    const u = p.z, v = Math.min(y1, Math.max(y0, p.y));
    if (last && Math.abs(last[0] - u) < 1e-4 && Math.abs(last[1] - v) < 1e-4) continue;
    if (!last) sh.moveTo(u, v); else sh.lineTo(u, v);
    last = [u, v];
  }
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: false, curveSegments: 1 });
  g.rotateY(Math.PI / 2);                    // shape (z, y) → the y-z plane; extrusion along x
  g.translate(x - 0.015, 0, 0);
  return g;
}

export function buildFuselage({ A, P }) {
  const G = buildGrid();
  const paint = MAT.paint();
  const holesFwd = [...both(O.windshield), ...both(O.quarter), ...both(O.overhead), ...both(O.ckDoor), ...both(O.avDoor)];
  const holesCab = [...both(O.gunner), ...both(O.cabDoor), ...both(O.hookWell)];

  // ------------------------------------------------------------------ skins
  const skin = (name, info, range, opts = {}) => {
    const g = patch(G, { ...range, ...opts });
    const objs = [mesh(g, paint)];
    if (opts.lined) objs.push(liner(g));
    return P(name, { system: 'Skin & fairings', skin: true, ...info }, objs);
  };
  skin('Nose & cockpit skin', {
    material: 'Aluminium skins on aluminium frames; Kevlar/graphite nose fairing', mass: 120, explode: [1.6, 0, 0],
    desc: 'Encloses the two-pilot cockpit and the nose avionics bay. A wire-strike deflector runs down the windshield centre post; behind and above it, the pitot and upper cutters sit on the sliding fairing ahead of the rotor head.',
  }, { x0: 2.2, x1: NOSE_X }, { holes: holesFwd, capTip: true, lined: true });
  const cabinSkin = skin('Cabin skin', {
    material: '2024/7075 aluminium skins, honeycomb floor panels', mass: 210, explode: [0, 0, 0],
    desc: 'Skins of the 3.84 m long, 2.21 m wide, 1.37 m high troop cabin. Large sliding-door openings on both sides let a squad get out in seconds.',
  }, { x0: -1.8, x1: 2.2 }, { holes: holesCab, lined: true });
  skin('Transition section skin', {
    material: 'Aluminium skins', mass: 55, explode: [-0.8, 0, 0],
    desc: 'Tapers the wide cabin into the tail cone. Inside it sit the two crash-resistant fuel cells and an avionics shelf.',
  }, { x0: -3.4, x1: -1.8 }, { lined: true });
  skin('Tail cone skin', {
    material: 'Aluminium semi-monocoque skins', mass: 95, explode: [-2.4, 0, 0],
    desc: 'The 6 m tail cone carries the tail drive shaft along its top and the tail landing gear underneath; it is the moment arm (9.93 m) the tail rotor pushes on.',
  }, { x0: TAIL_X, x1: -3.4 }, { capTail: true });

  // avionics-bay doors (hinged upward for access)
  P('Nose avionics bay doors', {
    system: 'Skin & fairings', skin: true, material: 'Aluminium/composite doors with quick-release latches', mass: 14, count: 2, explode: [1.2, 0.3, 0],
    desc: 'Large hinged doors on both sides of the nose open the avionics compartment for maintenance at waist height.',
  }, [mesh(patch(G, { only: both(O.avDoor), off: 0.004 }), paint)]);

  // transparencies (one part) + window seals
  const glassG = merge([
    patch(G, { only: [...both(O.windshield), ...both(O.quarter), ...both(O.overhead)], off: -0.006 }),
  ]);
  const seals = merge([...both(O.windshield), ...both(O.quarter), ...both(O.overhead)].map((r) => outline(r)));
  P('Windshields & cockpit windows', {
    system: 'Skin & fairings', skin: true, material: 'Laminated glass windshields, stretched-acrylic side and overhead windows', mass: 48, explode: [1.0, 1.1, 0],
    desc: 'Two heated, laminated-glass windshields with acrylic quarter and overhead windows: a wide field of view for low-level flight and landing in dust.',
  }, [mesh(glassG, MAT.glass(), { cast: false }), mesh(seals, MAT.rubber())]);

  // cockpit doors (jettisonable), each with its window
  for (const side of [1, -1]) {
    const door = { ...O.ckDoor, side };
    const win = { ...O.ckWindow, side };
    const skinG = patch(G, { only: [door], holes: [win], off: 0.006 });
    const glass = patch(G, { only: [win], off: 0.0 });
    const handle = box(0.12, 0.03, 0.03, [2.55, 1.05, surfPoint(2.55, side > 0 ? -0.1 : Math.PI + 0.1).z + side * 0.02]);
    P(side > 0 ? 'Pilot door (right)' : 'Copilot door (left)', {
      system: 'Skin & fairings', skin: true, material: 'Aluminium frame, acrylic window, jettisonable hinge pins', mass: 22, explode: [0, 0, 1.4 * side],
      desc: side > 0
        ? 'Hinged at the front edge. For an emergency exit a jettison handle pulls the hinge pins so the whole door falls away. The right seat is the pilot station and the left the copilot station; either can be flown by the pilot in command.'
        : 'The copilot\'s door, hinged at the front edge like the pilot\'s; its emergency handle pulls the hinge pins so the whole door can be jettisoned.',
    }, [mesh(skinG, paint), liner(skinG), mesh(glass, MAT.glass(), { cast: false }), mesh(merge([outline(win, 0.008, 0.012), handle]), MAT.black())]);
  }

  // gunner (crew chief) windows: forward-sliding hatch windows split vertically into two panels
  for (const side of [1, -1]) {
    const r = { ...O.gunner, side };
    const xm = 0.5 * (r.x0 + r.x1);
    const fore = { ...r, x0: xm + 0.01 }, aft = { ...r, x1: xm - 0.01 };
    const aMid = 0.5 * (r.a0 + r.a1), aS = side > 0 ? aMid : Math.PI - aMid;
    const latch = surfPoint(aft.x0 + 0.06, aS, 0.012);
    const bars = [];
    for (let i = 0; i <= 6; i++) bars.push(surfPoint(xm, side > 0 ? r.a0 + ((r.a1 - r.a0) * i) / 6 : Math.PI - r.a0 - ((r.a1 - r.a0) * i) / 6, 0.008));
    P(side > 0 ? 'Gunner window (right)' : 'Gunner window (left)', {
      system: 'Skin & fairings', skin: true, material: 'Acrylic panels in sliding aluminium frames', mass: 9, explode: [0.2, 0.3, 1.2 * side],
      desc: 'The crew chief/gunner window at the front of the cabin is a forward-sliding hatch split vertically into two panels, with a security latch on the aft panel. Slid open it clears the window gun mount and gives a view of the tail and the landing zone.',
    }, [mesh(patch(G, { only: [fore, aft], off: 0.0 }), MAT.glass(), { cast: false }),
      mesh(merge([outline(fore, 0.006, 0.014), outline(aft, 0.006, 0.014), pipe(bars, 0.012, 5), box(0.05, 0.03, 0.025, [latch.x, latch.y, latch.z])]), MAT.black())]);
  }

  // sliding cabin doors
  const doors = [];
  for (const side of [1, -1]) {
    const door = { ...O.cabDoor, side };
    const wins = [{ ...O.cabWindow, side }, { ...O.cabWindow2, side }];
    const skinG = patch(G, { only: [door], holes: wins, off: 0.012 });
    const glass = patch(G, { only: wins, off: 0.008 });
    const holder = new THREE.Group();
    holder.add(mesh(skinG, paint), liner(skinG), mesh(glass, MAT.glass(), { cast: false }), mesh(merge([...wins.map((w) => outline(w, 0.016, 0.013)), box(0.16, 0.035, 0.04, [-0.32, 1.25, side * 1.205])]), MAT.black()));
    const part = P(side > 0 ? 'Cabin door (right)' : 'Cabin door (left)', {
      system: 'Skin & fairings', skin: true, material: 'Aluminium honeycomb panel on roller tracks, two acrylic windows', mass: 38, explode: [-0.6, 0, 1.5 * side],
      desc: 'Slides aft on upper and lower tracks to open a 1.75 m-wide doorway. Each door has two windows that can be jettisoned for an emergency exit. Doors usually fly open or removed on assault missions; the opening also takes litters.',
    }, holder);
    doors.push({ holder, side, part });
  }
  // door tracks on the cabin and transition skins
  const tracks = [];
  for (const side of [1, -1]) {
    const aTop = side > 0 ? 0.9 : Math.PI - 0.9, aBot = side > 0 ? -0.76 : Math.PI + 0.76;
    for (const a of [aTop, aBot]) {
      const pts = [];
      for (let i = 0; i <= 8; i++) pts.push(surfPoint(-2.35 + (1.6 * i) / 8 + 0.2, a, 0.012));
      tracks.push(pipe(pts, 0.018, 5));
    }
  }

  cabinSkin.add(mesh(merge(tracks), MAT.steel()));

  // ------------------------------------------------------------------ structure
  const gapsCab = (x) => {
    const g = [];
    for (const r of [O.cabDoor, O.gunner, O.ckDoor]) {
      if (x > r.x0 && x < r.x1) g.push([r.a0, r.a1], [Math.PI - r.a1, Math.PI - r.a0]);
    }
    if (x > O.windshield.x0 - 0.05) g.push([O.quarter.a0, Math.PI - O.quarter.a0]);
    return g;
  };
  const ckFrames = [], cabFrames = [], trFrames = [], tcFrames = [];
  for (const x of [2.25, 2.75, 3.38, 3.95]) ckFrames.push(...hoop(x, gapsCab(x)));
  // the frames beside the cabin doorway stop at its heavy door posts (which take their place round the
  // opening), and the two frames under the main module stop at the roof beams either side of the
  // transmission well, where the gearbox case and sump hang through the deck
  const extraGaps = (x) => {
    const g = [];
    for (const xp of [O.cabDoor.x0 - 0.03, O.cabDoor.x1 + 0.03]) if (Math.abs(x - xp) < 0.05) g.push([O.cabDoor.a0 - 0.04, O.cabDoor.a1 + 0.04], [Math.PI - O.cabDoor.a1 - 0.04, Math.PI - O.cabDoor.a0 + 0.04]);
    if (x > -0.5 && x < 0.42) g.push([Math.PI / 2 - 0.23, Math.PI / 2 + 0.23]);
    return g;
  };
  for (const x of [-1.78, -1.2, -0.44, 0.3, 1.0, 1.44, 1.86, 2.2]) cabFrames.push(...hoop(x, [...gapsCab(x), ...extraGaps(x)]));
  for (const a of [0.9, Math.PI - 0.9, -0.76, Math.PI + 0.76, 1.25, Math.PI - 1.25]) cabFrames.push(stringer(-1.78, 2.2, a));
  for (const x of [-2.3, -2.85, -3.38]) trFrames.push(...hoop(x, [], 0.05, 0.026));
  for (const x of [-4.0, -4.7, -5.4, -6.1, -6.8, -7.5, -8.2, -8.9]) tcFrames.push(...hoop(x, [], 0.035, 0.02));
  for (const a of [0.5, Math.PI - 0.5, -0.6, Math.PI + 0.6, Math.PI / 2 - 0.15, Math.PI / 2 + 0.15]) tcFrames.push(stringer(-9.0, -3.38, a, 0.035, 0.016));
  for (const a of [0.6, Math.PI - 0.6, -0.5, Math.PI + 0.5]) trFrames.push(stringer(-3.38, -1.78, a, 0.05, 0.02));

  P('Cockpit frames & canopy bow', {
    system: 'Structure', material: '7075 aluminium frames, steel canopy-bow and roll-over structure', mass: 140, explode: [1.6, 0.6, 0], xrayWeight: 0.35,
    desc: 'Frames and the canopy bows around the windshields form a roll-over structure, so the cockpit keeps its shape if the aircraft turns over in a crash.',
  }, [mesh(merge(ckFrames), MAT.primer())]);
  // roof beams that carry the main transmission, plus cabin frames
  const roof = [];
  // the roof narrows aft and towards its crown, so the beams sit 3–5 cm inside the roof skin all the
  // way along (they end at the transition section, where the roof is too narrow for them)
  for (const z of [-0.5, 0.5]) roof.push(bar([-2.1, 2.12, z], [2.6, 2.12, z], 0.1, 0.14));
  for (const x of [-0.5, 0.5]) roof.push(bar([x, 2.12, -0.62], [x, 2.12, 0.62], 0.1, 0.1));
  for (const x of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) roof.push(box(0.14, 0.05, 0.12, [x, 2.19, z]));   // transmission/deck fittings
  P('Main roof beams', {
    system: 'Structure', material: 'Two machined aluminium longitudinal beams, two cross beams, titanium transmission fittings', mass: 150, explode: [0, 1.05, 0],
    desc: 'The main transmission sits on top of the cabin between the engines, so these two deep roof beams and their cross beams carry the whole rotor lift — and the engines — into the airframe. They are designed to hold the 1-tonne-plus gearbox and rotor head in place in a hard crash rather than let them collapse into the cabin.',
  }, [mesh(merge(roof), MAT.primer())]);
  P('Cabin frames & stringers', {
    system: 'Structure', material: 'Aluminium ring frames and stringers', mass: 150, explode: [0, 0.8, 0], xrayWeight: 0.3,
    desc: 'Ring frames about every 0.6 m round the cabin, broken by the door openings and tied together by stringers, give the cabin its shape and its crash strength.',
  }, [mesh(merge(cabFrames), MAT.primer())]);
  const posts = [];
  for (const side of [1, -1]) for (const x of [O.cabDoor.x0 - 0.03, O.cabDoor.x1 + 0.03]) {
    const pts = [];
    for (let i = 0; i <= 10; i++) { const a = O.cabDoor.a0 - 0.04 + ((O.cabDoor.a1 - O.cabDoor.a0 + 0.08) * i) / 10; pts.push(surfPoint(x, side > 0 ? a : Math.PI - a, -0.05)); }
    posts.push(pipe(pts, 0.035, 6));
  }
  P('Cabin door posts', {
    system: 'Structure', material: 'Heavy aluminium door-frame posts and sills', mass: 30, count: 4, explode: [0, 0.5, 0.6],
    desc: 'The 1.75 m sliding-door openings cut right through the ring frames, so heavy posts at the front and rear of each opening carry the loads round the hole.',
  }, [mesh(merge(posts), MAT.primer())]);
  P('Aft cabin bulkhead', {
    system: 'Structure', material: 'Aluminium bulkhead at the rear of the cabin', mass: 25, explode: [-0.5, 0.2, 0],
    desc: 'Closes the back of the cabin. Behind it sit the stowage compartments, opening through doors in the bulkhead, with the two fuel cells beneath them.',
  }, [mesh(aftBulkhead(), MAT.primer())]);
  P('Transition section frames', {
    system: 'Structure', material: 'Aluminium frames and stringers', mass: 65, explode: [-0.9, 0.3, 0], xrayWeight: 0.3,
    desc: 'Carries the fuel-cell bays below and the stowage compartments and aft avionics compartment above, and joins the tail cone to the cabin.',
  }, [mesh(merge(trFrames), MAT.primer())]);
  P('Tail cone frames & longerons', {
    system: 'Structure', material: 'Aluminium frames and extruded longerons', mass: 120, explode: [-2.4, 0.4, 0], xrayWeight: 0.3,
    desc: 'Semi-monocoque tail cone: frames every ~0.7 m tied by longerons. It reacts the tail-rotor thrust as torsion and the tail-wheel loads as bending.',
  }, [mesh(merge(tcFrames), MAT.primer())]);

  // floor and keel (energy-absorbing lower structure)
  // floor panels in 0.2 m strips, each trimmed 2.5 cm inside the local section so nothing shows outside
  const strips = (x0, x1, y, h, step = 0.2, inset = 0.025) => {
    const out = [];
    for (let x = x0; x < x1 - 1e-6; x += step) {
      const xb = Math.min(x1, x + step);
      const hw = Math.min(minHalfWidth(x, xb, y - h / 2, 3), minHalfWidth(x, xb, y + h / 2, 3)) - inset;
      if (hw > 0.05) out.push(box(xb - x, h, 2 * hw, [(x + xb) / 2, y, 0]));
    }
    return out;
  };
  const floor = [...strips(-1.755, 2.195, 0.6, 0.04), ...strips(2.195, 3.65, 0.66, 0.04, 0.15)];
  const tieDowns = [];
  for (let x = -1.5; x <= 2.0; x += 0.5) for (const z of [-0.85, -0.3, 0.3, 0.85]) tieDowns.push(new THREE.TorusGeometry(0.025, 0.006, 4, 10).rotateX(Math.PI / 2).translate(x, 0.625, z));
  P('Cabin floor', {
    system: 'Structure', material: 'Aluminium honeycomb panels with tie-down rings', mass: 160, explode: [0, -0.5, 0], xrayWeight: 0.5,
    desc: 'Flat floor 0.6 m above the ground for quick loading; tie-down rings rated for cargo restraint. Beneath it the lower fuselage is a crushable structure.',
  }, [mesh(merge(floor), MAT.interiorFront()), mesh(merge(tieDowns), MAT.steel())]);
  const keel = [];
  for (const z of [-0.42, 0.42]) keel.push(box(4.8, 0.1, 0.06, [0.8, 0.545, z]));
  for (let x = -1.5; x <= 3.0 + 1e-6; x += 0.5) {
    if (x > O.hookWell.x0 - 0.03 && x < O.hookWell.x1 + 0.03) continue;   // the hook well interrupts this one
    // each cross-member is cut to the rounded lower corner: a narrower lower flange, a wider web above
    const w0 = minHalfWidth(x - 0.02, x + 0.02, 0.5, 2) - 0.02, w1 = minHalfWidth(x - 0.02, x + 0.02, 0.555, 2) - 0.02;
    if (w0 > 0.1) keel.push(box(0.04, 0.05, 2 * w0, [x, 0.522, 0]));
    if (w1 > 0.1) keel.push(box(0.04, 0.05, 2 * w1, [x, 0.572, 0]));
  }
  P('Keel beams & crushable belly', {
    system: 'Structure', material: 'Aluminium keel beams, crushable sub-floor structure', mass: 170, explode: [0, -1.0, 0], xrayWeight: 0.5,
    desc: 'Two keel beams and a crushable sub-floor. In a survivable crash the gear, the belly and the stroking seats share the work of stopping the occupants — the airframe is built to keep a living space at vertical impacts of about 11.6 m/s (38 ft/s).',
  }, [mesh(merge(keel), MAT.primer())]);

  return {
    G, doors, surfPoint, section, roofY, halfWidthAt,
  };
}
