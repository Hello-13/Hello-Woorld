// Honeywell TPE331-10 installation for the MQ-9A, in aircraft coordinates (see shape.js).
// The TPE331 is a single-shaft turboprop: air enters between the offset reduction gearbox and the compressor, goes
// through a two-stage centrifugal compressor, turns into a reverse-flow annular combustor wrapped
// around a three-stage axial turbine and leaves at the end opposite the gearbox. In the pusher
// MQ-9 the gearbox faces aft and drives the propeller directly (USAF engine-change photographs
// show the propeller bolted to the gearbox), so the hot end faces forward and a collector bell turns
// the exhaust back into one duct along the upper starboard side of the engine, to a single stack on top
// of the cowling directly above the spinner (as tail-on photographs show).
//
// Envelope (Honeywell TPE331-10 brochure N61-1491, specification table and installation drawing):
// length 1.088 m (42.82 in) from the exhaust flange to the propeller flange; the gearbox is the
// largest section, 0.533 m wide × 0.676 m tall (20.98 × 26.62 in), with the output shaft 0.090 m
// (3.53 in) above the engine centreline and its top 0.300 m (11.8 in) above the output shaft; rear
// mount pads at the hot end, 0.198 m (7.8 in) above and below the centreline (side view) and
// 0.183 m (7.2 in) to either side of it (front view), so 0.27 m out at about 47° from the vertical;
// front mount on top of the gearbox 0.603 m (23.75 in) from them; exhaust outlet Ø 0.277 m
// (10.9 in); 175 kg (385 lb).
// Module lengths inside that envelope and every internal size are estimates.
//
// Fuselage stations (s, metres aft of the nose): exhaust flange 9.17, combustor and turbine
// 9.20–9.50, compressor 9.50–9.79, inlet screen 9.79–9.87, gearbox 9.87–10.215, output shaft and
// propeller flange to 10.255: 1.085 m in all. Propeller plane s 10.45.

import * as THREE from 'three';
import { loftRings, orientOutward, orientTubeOutward, airfoilLoop } from '../../engine/geometry.js';
import { X, fusePoint, skinY, FUSE_END, merge, cylX, latheX, tubeBetween, pipe, lru, box } from './shape.js';

export const ENGINE_Y = 1.69;          // engine centreline
export const SHAFT_Y = ENGINE_Y + 0.0897;   // propeller axis: the gearbox output is 3.53 in above the engine centreline
export const PROP_S = 10.45;
export const PROP_X = X(PROP_S);       // propeller plane
export const PROP_R = 1.397;           // McCauley 110GFA blades: 110 in (2.79 m) basic diameter
export const STATIONS = { exhaust: 9.17, turbine0: 9.2, turbine1: 9.5, comp1: 9.79, inlet1: 9.87, gear1: 10.255 };
export const ENGINE_LENGTH = STATIONS.gear1 - STATIONS.exhaust;
export const GEARBOX = { s0: 9.87, s1: 10.215, top: 0.389, bot: 0.287, hw: 0.2665 };   // offsets from the engine centreline
export const FRONT_MOUNT_S = 9.89, REAR_MOUNT_S = 9.287, REAR_MOUNT_R = 0.198, REAR_MOUNT_Z = 0.183;   // rear pads: 7.8 in up or down, 7.2 in to the side

const XS = (s) => X(s);
const ring = (x, r, tube, seg = 32, y = ENGINE_Y) => new THREE.TorusGeometry(r, tube, 6, seg).rotateY(Math.PI / 2).translate(x, y, 0);

/** Combustor case (outer) and the reverse-flow annular liner inside it, around the turbine. */
export function combustorGeo() {
  const xa = XS(STATIONS.turbine1), xf = XS(STATIONS.turbine0);       // aft (compressor) end, forward (exhaust) end
  const L = xf - xa;
  const casing = latheX([
    [0.205, xa], [0.222, xa + 0.02], [0.228, xa + 0.07], [0.228, xa + L * 0.72], [0.214, xa + L * 0.9], [0.17, xf], [0.15, xf + 0.012],
  ], 36).translate(0, ENGINE_Y, 0);
  const flanges = [xa + 0.012, xa + L * 0.55].map((x) => cylX(x - 0.007, x + 0.007, 0.234, 0.234, ENGINE_Y, 0, 36));
  // liner: an annulus between r 0.155 and 0.205, closed at the forward end where the flow turns
  const liner = latheX([[0.155, xa + 0.035], [0.155, xf - 0.03], [0.178, xf - 0.012], [0.205, xf - 0.03], [0.205, xa + 0.035]], 30).translate(0, ENGINE_Y, 0);
  return { casing: merge([casing, ...flanges]), liner };
}

/**
 * Three axial turbine stages between the combustor and the exhaust: each a fixed nozzle ring (vanes
 * that speed up and turn the gas) followed by a bladed disc. The flow runs forward (toward +x).
 * Blade and vane counts are not published: ≈ 40 blades and ≈ 25 vanes per stage are shown.
 */
export function turbineGeo() {
  const xa = XS(STATIONS.turbine1), xf = XS(STATIONS.turbine0);
  const L = xf - xa;
  const discs = [], blades = [], nozzles = [], vanes = [];
  for (let k = 0; k < 3; k++) {
    const xr = xa + L * (0.34 + k * 0.24);              // rotor plane
    const xn = xr - 0.034;                              // nozzle ring just upstream
    const r0 = 0.088, rt = 0.128 + k * 0.007;           // hub and tip radii grow as the gas expands
    discs.push(cylX(xr - 0.012, xr + 0.012, r0, r0, ENGINE_Y, 0, 28));
    discs.push(cylX(xr - 0.02, xr + 0.02, 0.045, 0.045, ENGINE_Y, 0, 16));
    for (let j = 0; j < 40; j++) {
      const a = (j / 40) * Math.PI * 2;
      blades.push(new THREE.BoxGeometry(0.022, rt - r0, 0.003).rotateX(0.0).rotateY(0.55).translate(xr, (r0 + rt) / 2, 0).rotateX(a));
    }
    nozzles.push(cylX(xn - 0.008, xn + 0.008, rt + 0.012, rt + 0.012, ENGINE_Y, 0, 30, true), cylX(xn - 0.008, xn + 0.008, r0 - 0.004, r0 - 0.004, ENGINE_Y, 0, 24, true));
    // mounting flange from the outer shroud to the liner's inner wall (r 0.155), which carries the ring
    nozzles.push(latheX([[rt + 0.011, xn - 0.004], [0.1548, xn - 0.004], [0.1548, xn + 0.004], [rt + 0.011, xn + 0.004], [rt + 0.011, xn - 0.004]], 30).translate(0, ENGINE_Y, 0));
    for (let j = 0; j < 25; j++) {
      const a = ((j + 0.5) / 25) * Math.PI * 2;
      vanes.push(new THREE.BoxGeometry(0.026, rt - r0 + 0.012, 0.004).rotateY(-0.7).translate(xn, (r0 + rt) / 2, 0).rotateX(a));
    }
  }
  const t = (g) => g.translate(0, ENGINE_Y, 0);
  return { discs: merge(discs), blades: t(merge(blades)), nozzles: merge(nozzles), vanes: t(merge(vanes)) };
}

/** Main fuel manifolds (two rings feeding the atomising nozzles) round the combustor case at its hot end. */
export function manifoldGeo(n = 10) {
  const x = XS(STATIONS.turbine0) - 0.035;
  const out = [ring(x, 0.236, 0.006, 40), ring(x - 0.022, 0.236, 0.005, 40)];
  for (let k = 0; k < n; k++) {
    const a = ((k + 0.5) / n) * Math.PI * 2;
    out.push(cylX(x - 0.03, x + 0.008, 0.009, 0.009, ENGINE_Y + Math.cos(a) * 0.236, Math.sin(a) * 0.236, 6));
    out.push(tubeBetween([x - 0.011, ENGINE_Y + Math.cos(a) * 0.236, Math.sin(a) * 0.236], [x - 0.011, ENGINE_Y + Math.cos(a) * 0.222, Math.sin(a) * 0.222], 0.008, 6));
  }
  return merge(out);
}

/**
 * Starting fuel manifold: a short arc under the case with three small nozzles that light first. It spans ±36° about the
 * bottom, so it stays inboard of the lower rear mount pads (47° out) beside it.
 */
export function startManifoldGeo() {
  const x = XS(STATIONS.turbine0) - 0.075;
  const out = [new THREE.TorusGeometry(0.238, 0.005, 5, 12, Math.PI * 0.4).rotateZ(-Math.PI * 0.7).rotateY(Math.PI / 2).translate(x, ENGINE_Y, 0)];
  for (const a of [Math.PI * 0.86, Math.PI, Math.PI * 1.14]) out.push(cylX(x - 0.02, x + 0.006, 0.007, 0.007, ENGINE_Y + Math.cos(a) * 0.238, Math.sin(a) * 0.238, 6));
  out.push(pipe([[x, ENGINE_Y - 0.238, 0], [x - 0.08, ENGINE_Y - 0.25, 0.04], [XS(9.6), ENGINE_Y - 0.25, 0.08]], 0.005, 5, 12));
  return merge(out);
}

/** Two igniter plugs in the combustor case: one on top and one on the left (port) side (NTSB). */
export function ignitersGeo() {
  const x = XS(STATIONS.turbine0) - 0.1;
  return merge([[0.205, 0.27, Math.PI / 2], [0.205, 0.27, Math.PI]].map(([r0, r1, a]) => merge([
    tubeBetween([x, ENGINE_Y + Math.sin(a) * r0, Math.cos(a) * r0], [x, ENGINE_Y + Math.sin(a) * r1, Math.cos(a) * r1], 0.011, 10),
    tubeBetween([x, ENGINE_Y + Math.sin(a) * (r1 - 0.02), Math.cos(a) * (r1 - 0.02)], [x, ENGINE_Y + Math.sin(a) * (r1 + 0.005), Math.cos(a) * (r1 + 0.005)], 0.016, 6),
  ])));
}

/**
 * Exhaust: the engine's round outlet flange (Ø 0.277 m) at the hot end, a collector bell that turns the forward-facing flow,
 * and one flattened duct that runs aft along the upper starboard side of the engine, under the access door, and climbs over the
 * front of the gearbox to a single stack on top of the cowling, on the centreline just behind the V-tail and directly above the
 * spinner. Photographs (tail-on and side views of USAF aircraft) show that one large rectangular stack, sooted inside; the duct's
 * route inside the cowling is estimated, and its section is flattened because only 0.15 m separates the engine case from the skin.
 */
export const STACK_S = 10.3;             // the stack's lip
const SECT_C = [ENGINE_Y, 0];            // the engine axis (y, z): the duct's section is kept flat against the skin, radially from it

/**
 * Loft a duct of varying section along a Catmull-Rom path. ctrl: [{ p: [x, y, z], w, h, k }] with half-width w (tangential),
 * half-height h (radial) and k the superellipse exponent (1 = ellipse, 0.6 = rounded rectangle), interpolated between points.
 * `up` (the h direction) defaults to the direction from the engine axis, or a control point's own `up`, blended along the path;
 * clip(point) may move a ring vertex (the stack's base).
 */
export function sectionLoft(ctrl, { N = 48, n = 20, capStart = true, capEnd = true, upY = false, clip = null } = {}) {
  const curve = new THREE.CatmullRomCurve3(ctrl.map((c) => new THREE.Vector3(...c.p)), false, 'centripetal');
  const rings = [];
  let prevUp = null;
  for (let i = 0; i <= N; i++) {
    const t = i / N, f = t * (ctrl.length - 1), i0 = Math.min(ctrl.length - 2, Math.floor(f)), fr = f - i0;
    const A = ctrl[i0], B = ctrl[i0 + 1];
    const w = A.w + (B.w - A.w) * fr, h = A.h + (B.h - A.h) * fr, k = (A.k ?? 1) + ((B.k ?? 1) - (A.k ?? 1)) * fr;
    const p = curve.getPoint(t), tg = curve.getTangent(t).normalize();
    const radial = (q) => { const r = new THREE.Vector3(0, q.y - SECT_C[0], q.z - SECT_C[1]); return upY || r.length() < 0.06 ? new THREE.Vector3(0, 1, 0) : r.normalize(); };
    const uA = A.up ? new THREE.Vector3(...A.up) : radial(new THREE.Vector3(...A.p)), uB = B.up ? new THREE.Vector3(...B.up) : radial(new THREE.Vector3(...B.p));
    const up = uA.clone().lerp(uB, fr);
    if (up.length() < 0.2) up.copy(radial(p));
    up.addScaledVector(tg, -up.dot(tg));
    if (up.length() < 0.2) up.set(0, 0, 1).addScaledVector(tg, -tg.z);
    up.normalize();
    if (prevUp && up.dot(prevUp) < 0) up.negate();
    prevUp = up;
    const side = new THREE.Vector3().crossVectors(tg, up).normalize();
    const ring = [];
    for (let j = 0; j < n; j++) {
      const ph = (j / n) * Math.PI * 2, c = Math.cos(ph), sn = Math.sin(ph);
      const a = Math.sign(c) * Math.abs(c) ** k * w, b = Math.sign(sn) * Math.abs(sn) ** k * h;
      const q = [p.x + side.x * a + up.x * b, p.y + side.y * a + up.y * b, p.z + side.z * a + up.z * b];
      ring.push(clip ? clip(q) : q);
    }
    rings.push(ring);
  }
  return orientTubeOutward(loftRings(rings, { capStart, capEnd, uvMode: 'metric' }));
}

/** The internal exhaust duct: outlet flange, collector bell and the flattened duct to the stack's base. */
export function exhaustDuctGeo() {
  const xo = XS(STATIONS.exhaust);
  const bell = [
    cylX(xo - 0.004, xo + 0.012, 0.15, 0.15, ENGINE_Y, 0, 30),                     // outlet flange
    latheX([[0.139, xo], [0.139, xo + 0.03], [0.12, xo + 0.07], [0.07, xo + 0.1]], 28).translate(0, ENGINE_Y, 0),   // collector bell
  ];
  const ctrl = [
    { p: [xo + 0.07, ENGINE_Y + 0.01, 0.02], w: 0.05, h: 0.05 },                   // inside the bell
    { p: [xo + 0.13, ENGINE_Y + 0.12, 0.09], w: 0.06, h: 0.06 },                   // the elbow, forward and up
    { p: [xo + 0.1, ENGINE_Y + 0.215, 0.17], w: 0.08, h: 0.055 },                  // turning aft, flattening against the skin
    { p: fusePoint(9.27, 0.6, 0.075), w: 0.085, h: 0.05 },                         // along the upper starboard side, below the
    { p: fusePoint(9.45, 0.62, 0.08), w: 0.085, h: 0.05 },                         // V-tail root fittings and outboard of the inlet duct
    { p: fusePoint(9.62, 0.68, 0.085), w: 0.085, h: 0.05 },
    { p: fusePoint(9.72, 0.78, 0.09), w: 0.08, h: 0.055 },
    { p: fusePoint(9.78, 0.95, 0.07), w: 0.07, h: 0.06 },                          // then straight up through the cowling beside the
    { p: [XS(9.84), 2.12, 0.12], w: 0.065, h: 0.055, up: [0, 0, 1] },             // inlet duct's end, as a narrow ribbon, clear of the
    { p: [XS(9.9), 2.18, 0.06], w: 0.07, h: 0.055, up: [0, 0.5, 0.85] },           // gearbox and its front mount below, and over
    { p: [XS(9.98), 2.21, 0.01], w: 0.08, h: 0.055, up: [0, 1, 0] },              // onto the centreline inside the stack's base
    { p: [XS(10.08), 2.225, 0], w: 0.085, h: 0.06, up: [0, 1, 0] },               // ends inside the stack
  ];
  return merge([...bell, sectionLoft(ctrl, { N: 64, n: 20 })]);
}
/** The stack on top of the cowling: a rounded-rectangle duct faired down onto the skin at its front, open aft over the spinner. */
export function exhaustStackGeo() {
  const clip = (q) => {
    const s = 5.5 - q[0];
    if (s > FUSE_END) return q;
    const yS = skinY(s, q[2]);
    return q[1] < yS + 0.004 ? [q[0], yS - 0.015, q[2]] : q;
  };
  const ctrl = [
    { p: [XS(9.7), skinY(9.7, 0) - 0.004, 0], w: 0.006, h: 0.006, k: 0.6 },         // nose of the base fairing, behind the V-tail
    { p: [XS(9.78), 2.112, 0], w: 0.13, h: 0.045, k: 0.6 },
    { p: [XS(9.85), 2.145, 0], w: 0.21, h: 0.09, k: 0.6 },
    { p: [XS(9.93), 2.17, 0], w: 0.21, h: 0.11, k: 0.6 },
    { p: [XS(10.0), 2.19, 0], w: 0.19, h: 0.105, k: 0.6 },
    { p: [XS(10.1), 2.215, 0], w: 0.168, h: 0.1, k: 0.6 },
    { p: [XS(STACK_S - 0.02), 2.245, 0], w: 0.16, h: 0.1, k: 0.6 },
    { p: [XS(STACK_S), 2.248, 0], w: 0.166, h: 0.106, k: 0.6 },                    // rolled lip
  ];
  return sectionLoft(ctrl, { N: 40, n: 28, capStart: true, capEnd: false, upY: true, clip });
}

/** Compressor housing: first- and second-stage impeller shrouds, diffusers and crossover ducts. */
export function compressorGeo() {
  const xa = XS(STATIONS.comp1), xf = XS(STATIONS.turbine1);         // inlet (aft) end, combustor (forward) end
  const L = xf - xa;
  const housing = latheX([
    [0.13, xa], [0.17, xa + 0.012], [0.19, xa + L * 0.15], [0.19, xa + L * 0.3], [0.165, xa + L * 0.45],
    [0.17, xa + L * 0.55], [0.2, xa + L * 0.68], [0.2, xa + L * 0.84], [0.205, xf - 0.01], [0.205, xf],
  ], 36).translate(0, ENGINE_Y, 0);
  const ducts = [];
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k / 4) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    ducts.push(pipe([[xa + L * 0.2, ENGINE_Y + c * 0.18, s * 0.18], [xa + L * 0.42, ENGINE_Y + c * 0.19, s * 0.19], [xa + L * 0.64, ENGINE_Y + c * 0.18, s * 0.18]], 0.02, 8, 10));
  }
  return merge([housing, ...ducts]);
}

/** The two centrifugal impellers inside the housing, with their vanes. */
export function impellersGeo() {
  const xa = XS(STATIONS.comp1), xf = XS(STATIONS.turbine1);
  const L = xf - xa;
  const imp = (x0, r) => latheX([[0.027, x0], [0.055, x0 + 0.015], [0.09, x0 + 0.04], [r, x0 + 0.06], [r, x0 + 0.068], [0.027, x0 + 0.075]], 28);   // hub bore on the 0.026 m shaft
  const vanes = [];
  for (const [x0, r] of [[xa + L * 0.05, 0.15], [xa + L * 0.52, 0.16]]) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      vanes.push(new THREE.BoxGeometry(0.05, r - 0.05, 0.003).translate(x0 + 0.04, (r + 0.05) / 2, 0).rotateX(a));
    }
  }
  return merge([imp(xa + L * 0.05, 0.15), imp(xa + L * 0.52, 0.16), ...vanes]).translate(0, ENGINE_Y, 0);
}

/** Single main shaft from the gearbox input pinion to the last turbine disc, with its three bearings. */
export function mainShaftGeo() {
  const xg = XS(STATIONS.inlet1) - 0.03, xt = XS(STATIONS.turbine0) - 0.04;
  return merge([
    cylX(xg, xt, 0.026, 0.026, ENGINE_Y, 0, 14),
    ...[xg - 0.01, XS(STATIONS.turbine1) - 0.01, xt - 0.015].map((x) => cylX(x - 0.011, x + 0.011, 0.045, 0.045, ENGINE_Y, 0, 18)),
  ]);
}

/** Inlet screen: the open mesh drum between the gearbox and the first compressor stage. */
export function screenGeo() {
  return cylX(XS(STATIONS.inlet1), XS(STATIONS.comp1), 0.145, 0.145, ENGINE_Y, 0, 30, true);
}
/**
 * Inlet plenum round the screen. The duct feeds it from above; underneath, the gearbox's accessory drive case fills the space in
 * front of its lower half, so the plenum's floor is flat there and sits on the case's top face instead of wrapping round below.
 */
export const PLENUM_FLOOR = 0.168;            // floor below the engine centreline (the accessory case's top is 0.17 below it)
export function plenumGeo(n = 40) {
  const x0 = XS(STATIONS.inlet1) + 0.004, x1 = XS(STATIONS.comp1) - 0.004;
  const prof = [[0.15, x0], [0.205, x0 + 0.01], [0.215, (x0 + x1) / 2], [0.205, x1 - 0.01], [0.15, x1]];
  const rings = prof.map(([r, x]) => {
    const ring = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      ring.push([x, ENGINE_Y + Math.max(-PLENUM_FLOOR, r * Math.sin(a)), r * Math.cos(a)]);
    }
    return ring;
  });
  return orientTubeOutward(loftRings(rings, { uvMode: 'metric' }));
}

/** Gearbox housing outline at scale k (front view: top 0.389, bottom 0.287, half-width 0.267 about the engine centreline). */
function housingRing(x, k, n = 40) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const th = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const c = Math.cos(th), sn = Math.sin(th);
    const up = sn >= 0;
    const e = up ? 3.2 : 2.6;
    const a = (up ? GEARBOX.top : GEARBOX.bot) * k, b = GEARBOX.hw * k;
    pts.push([x, ENGINE_Y + a * Math.sign(sn) * Math.abs(sn) ** (2 / e), b * Math.sign(c) * Math.abs(c) ** (2 / e)]);
  }
  return pts;
}

/**
 * Offset reduction gearbox: the housing with its front mount pad on top, the accessory case on the
 * lower engine-side face with its drive pads, and the output shaft nose and propeller flange.
 */
export function gearboxGeo() {
  const rings = [[GEARBOX.s0, 0.95], [GEARBOX.s0 + 0.012, 1.0], [10.02, 1.0], [10.14, 0.965], [GEARBOX.s1 - 0.012, 0.9], [GEARBOX.s1, 0.86]].map(([s, k]) => housingRing(XS(s), k));
  const housing = orientOutward(loftRings(rings, { capStart: true, capEnd: true, uvMode: 'metric' }));
  const mount = [box(0.06, 0.012, 0.1, [XS(FRONT_MOUNT_S), ENGINE_Y + GEARBOX.top - 0.004, 0])];      // front mount pad (Honeywell drawing)
  // accessory case: a deeper lower section on the engine side of the housing, carrying the drive pads; its top face, 0.17 m
  // below the engine centreline, is the inlet plenum's floor, so the two meet at a surface
  const accessory = [lru(0.07, 0.115, 0.36, [XS(GEARBOX.s0 - 0.03), ENGINE_Y - 0.2275, 0], 0.03)];
  const output = [
    cylX(XS(GEARBOX.s1 + 0.04), XS(GEARBOX.s1 - 0.01), 0.085, 0.1, SHAFT_Y, 0, 24),       // output nose
    cylX(XS(STATIONS.gear1 + 0.01), XS(STATIONS.gear1 - 0.005), 0.115, 0.115, SHAFT_Y, 0, 28),   // propeller flange
    cylX(XS(10.36), XS(STATIONS.gear1), 0.055, 0.055, SHAFT_Y, 0, 18),                       // shaft extension to the hub
  ];
  return { housing: merge([housing, ...mount]), accessory: merge(accessory), output: merge(output) };
}

/** Drive pads on the accessory case (face toward the engine): [name, y, z, radius]. */
export const PADS = {
  starter: { y: ENGINE_Y - 0.235, z: 0.145, r: 0.062 },
  accessory: { y: ENGINE_Y - 0.235, z: -0.145, r: 0.052 },
  tach: { y: ENGINE_Y - 0.25, z: 0, r: 0.04 },
};
export function padsGeo() {
  const x = XS(GEARBOX.s0 - 0.065);
  return merge(Object.values(PADS).map((p) => cylX(x - 0.012, x + 0.004, p.r, p.r, p.y, p.z, 18)));
}

// ------------------------------------------------------------------------------- propeller
// McCauley 3GFR36C606 hub with 110GFA-0 blades: three aluminium-alloy scimitar blades. In McCauley's
// blade designation the leading number is the basic diameter in inches and the dash number the cut-off
// from it, so 110GFA-0 is a full 110 in (2.794 m) disc and each tip is 1.397 m from the shaft axis. The
// airfoil runs from inside the hub clamp (r 0.16) to the tip, about 1.24 m, and is 0.23 m (9 in) wide at
// its widest; full-feathering and reversing. (A removed blade has been listed as 57.5 in "tall": a
// measurement of the loose blade, not of radius, so it is not used here.) Built in the propeller's own frame: origin at the propeller plane on the shaft axis,
// x along the aircraft axis (aft = −x), blade 0 along +z. Rotation is positive about +x (counter-
// clockwise seen from ahead, as the 1,591 rpm "ccw from rear" gearbox option).
const BLADE = [
  // r (m), chord (m), thickness/chord, pitch (deg to the disc plane), sweep (m, + toward the trailing edge)
  [0.16, 0.085, 0.6, 62, 0], [0.24, 0.14, 0.3, 56, 0], [0.36, 0.2, 0.16, 49, 0.004], [0.5, 0.228, 0.11, 43, 0.006],
  [0.66, 0.23, 0.09, 38, 0.004], [0.82, 0.222, 0.08, 34, 0.008], [0.98, 0.205, 0.072, 31, 0.022], [1.1, 0.186, 0.066, 28.5, 0.042],
  [1.2, 0.165, 0.062, 26.5, 0.066], [1.28, 0.142, 0.058, 25, 0.092], [1.34, 0.115, 0.055, 24, 0.118], [1.375, 0.085, 0.052, 23.5, 0.137], [1.397, 0.045, 0.05, 23, 0.152],
];
const bladeAt = (r) => {
  let i = 0;
  while (i < BLADE.length - 2 && r > BLADE[i + 1][0]) i++;
  const a = BLADE[i], b = BLADE[i + 1], t = Math.min(1, Math.max(0, (r - a[0]) / (b[0] - a[0])));
  return a.map((v, k) => v + (b[k] - v) * t);
};
/** One blade section ring at radius r (pitch offset dPitch in degrees, e.g. feather or reverse). */
function bladeRing(r, airfoil, dPitch = 0) {
  const [, c, tc, beta0, sw] = bladeAt(r);
  const beta = ((beta0 + dPitch) * Math.PI) / 180;
  const cd = [-Math.sin(beta), Math.cos(beta)];          // chord direction (x, y): leading edge toward −y (direction of travel)
  const nd = [Math.cos(beta), Math.sin(beta)];           // toward the suction face (forward, +x)
  return airfoil(tc).map(([xc, yt]) => {
    const u = (xc - 0.3) * c, v = yt * c;
    return [cd[0] * u + nd[0] * v, cd[1] * u + nd[1] * v + sw, r];
  });
}
/**
 * Three blades, split into finish bands: matte black with yellow tip warning stripes (the stripes
 * mark the tip arc for ground crews). Returns { black, yellow } geometries in the propeller frame.
 */
export function bladesGeo(count = 3) {
  const af = (tc) => airfoilLoop(tc, 12, 0, 1, 0.025);
  const bands = { black: [[0.16, 0.86 * PROP_R], [0.905 * PROP_R, 0.945 * PROP_R]], yellow: [[0.86 * PROP_R, 0.905 * PROP_R], [0.945 * PROP_R, PROP_R]] };
  const out = { black: [], yellow: [] };
  for (const [key, list] of Object.entries(bands)) {
    for (const [r0, r1] of list) {
      const rs = BLADE.map((b) => b[0]).filter((r) => r > r0 + 1e-4 && r < r1 - 1e-4);
      const stations = [r0, ...rs, r1];
      const g = orientOutward(loftRings(stations.map((r) => bladeRing(r, af)), { capStart: true, capEnd: true, uvMode: 'metric' }));
      for (let k = 0; k < count; k++) out[key].push(g.clone().rotateX((k / count) * Math.PI * 2));
    }
  }
  return { black: merge(out.black), yellow: merge(out.yellow) };
}

/** Hub, blade clamps and counterweights (propeller frame). */
export function hubGeo(count = 3) {
  const body = [latheX([[0.06, 0.08], [0.13, 0.075], [0.15, 0.04], [0.15, -0.06], [0.13, -0.1], [0.09, -0.105]], 28)];
  const clamps = [], weights = [];
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2;
    const rad = (r) => [0, Math.sin(a) * -r, Math.cos(a) * r];     // radial direction of blade k after rotateX(a)
    clamps.push(tubeBetween(rad(0.1), rad(0.2), 0.058, 18), tubeBetween(rad(0.185), rad(0.205), 0.064, 18));
    // counterweight arms on each clamp: they swing the blades toward feather if oil pressure is lost
    for (const dx of [0.07, -0.07]) weights.push(tubeBetween(rad(0.17).map((v, i) => (i === 0 ? v + dx * 0.55 : v)), rad(0.17).map((v, i) => (i === 0 ? v + dx : v)), 0.022, 10));
  }
  return { body: merge([...body, ...clamps]), weights: merge(weights) };
}

/**
 * Pitch-change mechanism (propeller frame): the cylinder (dome) on the hub's aft face, the piston and
 * the feather spring inside it, the beta (reverse) and flight-idle stop collar, and the beta tube.
 */
export function pitchGeo() {
  const dome = latheX([[0.03, -0.1], [0.098, -0.105], [0.1, -0.2], [0.09, -0.26], [0.05, -0.285], [0.001, -0.29]], 24);
  const piston = merge([cylX(-0.17, -0.15, 0.092, 0.092, 0, 0, 24), cylX(-0.15, 0.06, 0.018, 0.018, 0, 0, 10)]);
  const coil = [];
  const turns = 6, n = turns * 14, pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n, a = t * turns * Math.PI * 2; pts.push(new THREE.Vector3(-0.172 - t * 0.09, Math.cos(a) * 0.07, Math.sin(a) * 0.07)); }
  coil.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, 0.006, 5, false));
  const stops = [cylX(0.075, 0.095, 0.075, 0.075, 0, 0, 24)];
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + Math.PI / 3; stops.push(box(0.03, 0.025, 0.02, [0.085, Math.cos(a) * 0.09, Math.sin(a) * 0.09])); }
  return { dome, piston, spring: merge(coil), stops: merge(stops) };
}

/** Polished spinner (propeller frame): base Ø 0.6 m meeting the fuselage end, 0.6 m long. */
export function spinnerGeo() {
  const x0 = X(10.385) - PROP_X;                        // base, just inside the end of the cowling
  const prof = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, x = x0 - t * (X(10.385) - X(11.0));
    prof.push([Math.max(0.001, 0.298 * Math.sqrt(1 - t ** 1.7) * (1 - 0.06 * t)), x]);
  }
  return latheX(prof.reverse(), 40);
}
