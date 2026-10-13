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
  cabWindow: { x0: 0.18, x1: 1.02, a0: 0.12, a1: 0.66 },
  avDoor: { x0: 4.22, x1: 4.7, a0: -0.5, a1: 0.75 },
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
  const Aa = dedup(as, edgesA, 0.03).filter((a) => a >= -Math.PI / 2 - 1e-9 && a <= 1.5 * Math.PI + 1e-9);
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

export function buildFuselage({ A, P }) {
  const G = buildGrid();
  const paint = MAT.paint();
  const holesFwd = [...both(O.windshield), ...both(O.quarter), ...both(O.overhead), ...both(O.ckDoor), ...both(O.avDoor)];
  const holesCab = [...both(O.gunner), ...both(O.cabDoor)];

  // ------------------------------------------------------------------ skins
  const skin = (name, info, range, opts = {}) => {
    const g = patch(G, { ...range, ...opts });
    const objs = [mesh(g, paint)];
    if (opts.lined) objs.push(liner(g));
    return P(name, { system: 'Skin & fairings', skin: true, ...info }, objs);
  };
  skin('Nose & cockpit skin', {
    material: 'Aluminium skins on aluminium frames; Kevlar/graphite nose fairing', mass: 120, explode: [1.6, 0, 0],
    desc: 'Encloses the two-pilot cockpit and the nose avionics bay. The framing around the windshields carries the wire-strike deflector and the upper cutter.',
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
      system: 'Skin & fairings', skin: true, material: 'Aluminium frame, acrylic window, emergency jettison hinges', mass: 22, explode: [0, 0, 1.4 * side],
      desc: `Hinged at the front edge; the window can be jettisoned with a handle for emergency exit. The pilot in command sits on the right in US Army helicopters.`,
    }, [mesh(skinG, paint), liner(skinG), mesh(glass, MAT.glass(), { cast: false }), mesh(merge([outline(win, 0.008, 0.012), handle]), MAT.black())]);
  }

  // gunner (crew chief) windows
  for (const side of [1, -1]) {
    const r = { ...O.gunner, side };
    P(side > 0 ? 'Gunner window (right)' : 'Gunner window (left)', {
      system: 'Skin & fairings', skin: true, material: 'Acrylic in a hinged aluminium frame', mass: 9, explode: [0.2, 0.3, 1.2 * side],
      desc: 'The crew chief\'s window at the front of the cabin swings open for the window gun mount and for a clear view of the tail and the landing zone.',
    }, [mesh(patch(G, { only: [r], off: 0.0 }), MAT.glass(), { cast: false }), mesh(outline(r, 0.006, 0.016), MAT.black())]);
  }

  // sliding cabin doors
  const doors = [];
  for (const side of [1, -1]) {
    const door = { ...O.cabDoor, side };
    const win = { ...O.cabWindow, side };
    const skinG = patch(G, { only: [door], holes: [win], off: 0.012 });
    const glass = patch(G, { only: [win], off: 0.008 });
    const holder = new THREE.Group();
    holder.add(mesh(skinG, paint), liner(skinG), mesh(glass, MAT.glass(), { cast: false }), mesh(merge([outline(win, 0.016, 0.013), box(0.16, 0.035, 0.04, [-0.25, 1.25, side * 1.205])]), MAT.black()));
    const part = P(side > 0 ? 'Cabin door (right)' : 'Cabin door (left)', {
      system: 'Skin & fairings', skin: true, material: 'Aluminium honeycomb panel on roller tracks, acrylic window', mass: 38, explode: [-0.6, 0, 1.5 * side],
      desc: 'Slides aft on upper and lower tracks to open a 1.75 m-wide doorway. Doors usually fly open or removed on assault missions; the opening also takes litters.',
    }, holder);
    doors.push({ holder, side, part });
  }
  // door tracks on the cabin and transition skins
  const tracks = [];
  for (const side of [1, -1]) {
    const aTop = side > 0 ? 0.9 : Math.PI - 0.9, aBot = side > 0 ? -0.76 : Math.PI + 0.76;
    for (const a of [aTop, aBot]) {
      const pts = [];
      for (let i = 0; i <= 8; i++) pts.push(surfPoint(-2.35 + (1.6 * i) / 8 + 0.2, a, 0.02));
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
  for (const x of [-1.78, -1.2, -0.44, 0.3, 1.0, 1.44, 1.86, 2.2]) cabFrames.push(...hoop(x, gapsCab(x)));
  for (const a of [0.9, Math.PI - 0.9, -0.76, Math.PI + 0.76, 1.25, Math.PI - 1.25]) cabFrames.push(stringer(-1.78, 2.2, a));
  for (const x of [-2.3, -2.85, -3.38]) trFrames.push(...hoop(x, [], 0.05, 0.026));
  for (const x of [-4.0, -4.7, -5.4, -6.1, -6.8, -7.5, -8.2, -8.9]) tcFrames.push(...hoop(x, [], 0.035, 0.02));
  for (const a of [0.5, Math.PI - 0.5, -0.6, Math.PI + 0.6, Math.PI / 2 - 0.15, Math.PI / 2 + 0.15]) tcFrames.push(stringer(-9.0, -3.38, a, 0.035, 0.016));
  for (const a of [0.6, Math.PI - 0.6, -0.5, Math.PI + 0.5]) trFrames.push(stringer(-3.38, -1.78, a, 0.05, 0.02));

  P('Cockpit frames & canopy bow', {
    system: 'Structure', material: '7075 aluminium frames, steel canopy-bow and roll-over structure', mass: 140, explode: [1.6, 0.6, 0],
    desc: 'Frames and the canopy bows around the windshields form a roll-over structure, so the cockpit keeps its shape if the aircraft turns over in a crash.',
  }, [mesh(merge(ckFrames), MAT.primer())]);
  // roof beams that carry the main transmission, plus cabin frames
  const roof = [];
  for (const z of [-0.52, 0.52]) roof.push(bar([-2.6, 2.17, z], [2.6, 2.17, z], 0.1, 0.16));
  for (const x of [-0.5, 0.5]) roof.push(bar([x, 2.17, -0.62], [x, 2.17, 0.62], 0.1, 0.16));
  P('Cabin frames & roof beams', {
    system: 'Structure', material: 'Aluminium frames, machined roof beams, titanium transmission fittings', mass: 380, explode: [0, 0.8, 0],
    desc: 'Ring frames around the cabin and two deep longitudinal roof beams that carry the main transmission and engines. They are designed to hold the 1-tonne-plus gearbox and rotor head in place in a hard crash rather than let them collapse into the cabin.',
    callout: false,
  }, [mesh(merge([...cabFrames, ...roof]), MAT.primer())]);
  P('Transition section frames', {
    system: 'Structure', material: 'Aluminium frames and the aft cabin bulkhead', mass: 90, explode: [-0.9, 0.3, 0],
    desc: 'Carries the aft cabin bulkhead, the fuel-cell bays below and the avionics shelf above, and joins the tail cone to the cabin.',
  }, [mesh(merge([...trFrames, box(0.03, 1.55, 2.12, [-1.78, 1.36, 0])]), MAT.primer())]);
  P('Tail cone frames & longerons', {
    system: 'Structure', material: 'Aluminium frames and extruded longerons', mass: 120, explode: [-2.4, 0.4, 0],
    desc: 'Semi-monocoque tail cone: frames every ~0.7 m tied by longerons. It reacts the tail-rotor thrust as torsion and the tail-wheel loads as bending.',
  }, [mesh(merge(tcFrames), MAT.primer())]);

  // floor and keel (energy-absorbing lower structure)
  const floor = [box(3.95, 0.04, 2.14, [0.22, 0.6, 0]), box(1.4, 0.04, 1.9, [2.95, 0.66, 0])];
  const tieDowns = [];
  for (let x = -1.5; x <= 2.0; x += 0.5) for (const z of [-0.85, -0.3, 0.3, 0.85]) tieDowns.push(new THREE.TorusGeometry(0.025, 0.006, 4, 10).rotateX(Math.PI / 2).translate(x, 0.625, z));
  P('Cabin floor', {
    system: 'Structure', material: 'Aluminium honeycomb panels with tie-down rings', mass: 160, explode: [0, -0.5, 0],
    desc: 'Flat floor 0.6 m above the ground for quick loading; tie-down rings rated for cargo restraint. Beneath it the lower fuselage is a crushable structure.',
  }, [mesh(merge(floor), MAT.interiorFront()), mesh(merge(tieDowns), MAT.steel())]);
  const keel = [];
  for (const z of [-0.42, 0.42]) keel.push(box(5.6, 0.12, 0.06, [0.85, 0.53, z]));
  for (let x = -1.6; x <= 3.4; x += 0.5) keel.push(box(0.04, 0.1, 1.9, [x, 0.53, 0]));
  P('Keel beams & crushable belly', {
    system: 'Structure', material: 'Aluminium keel beams, crushable sub-floor structure', mass: 170, explode: [0, -1.0, 0],
    desc: 'Two keel beams and a crushable sub-floor. In a survivable crash the gear, the belly and the stroking seats share the work of stopping the occupants — the airframe is built to keep a living space at vertical impacts of about 11.6 m/s (38 ft/s).',
  }, [mesh(merge(keel), MAT.primer())]);

  return {
    G, doors, surfPoint, section, roofY,
  };
}
