// Honeywell TPE331-10GD installation for the MQ-9A, in aircraft coordinates (see shape.js).
// The TPE331 is a single-shaft turboprop: air enters behind the offset reduction gearbox, goes
// through a two-stage centrifugal compressor, turns into a reverse-flow annular combustor wrapped
// around a three-stage axial turbine and leaves at the end opposite the gearbox. In the pusher
// MQ-9 the gearbox faces aft, so the exhaust end faces forward and dumps through two side stacks.
// Envelope: TPE331-10 length 1.088 m (42.82 in) including the gearbox, about 0.53 m wide and 0.66 m
// tall, 175 kg (385 lb) dry (Honeywell data as quoted by Wikipedia). Module lengths inside that
// envelope, the installed position and every internal size are estimates.
//
// Fuselage stations (s, metres aft of the nose): exhaust collector 7.88, combustor and turbine
// 7.94–8.24, compressor 8.24–8.58, inlet 8.58–8.66, gearbox 8.66–8.98: 1.10 m in all. The engine
// sits as far aft as the tapering fuselage allows; a drive shaft carries the power on to the
// propeller (installation estimated).

import * as THREE from 'three';
import { wingPanel } from '../../engine/geometry.js';
import { X, merge, cylX, latheX, tubeBetween, pipe, lru } from './shape.js';

export const ENGINE_Y = 1.57;          // engine centreline
export const SHAFT_Y = 1.73;           // propeller axis (gearbox output is offset above the engine)
export const PROP_X = X(10.52);        // propeller plane
export const PROP_R = 1.3;             // 2.6 m diameter (estimate)
export const STATIONS = { exhaust: 7.88, turbine0: 7.94, turbine1: 8.24, comp1: 8.58, inlet1: 8.66, gear1: 8.98 };
export const ENGINE_LENGTH = STATIONS.gear1 - STATIONS.exhaust;

const XS = (s) => X(s);
const ring = (x, r, tube, seg = 32) => new THREE.TorusGeometry(r, tube, 6, seg).rotateY(Math.PI / 2).translate(x, ENGINE_Y, 0);

/** Combustor case (outer) and the reverse-flow annular liner inside it, around the turbine. */
export function combustorGeo() {
  const xa = XS(STATIONS.turbine1), xf = XS(STATIONS.turbine0);       // aft (compressor) end, forward (exhaust) end
  const L = xf - xa;
  const casing = latheX([
    [0.19, xa], [0.212, xa + 0.02], [0.218, xa + 0.08], [0.218, xa + L * 0.7], [0.2, xa + L * 0.9], [0.17, xf],
  ], 30).translate(0, ENGINE_Y, 0);
  const flanges = [xa + 0.015, xa + L * 0.55].map((x) => cylX(x - 0.008, x + 0.008, 0.224, 0.224, ENGINE_Y, 0, 30));
  // liner: an annulus between r 0.15 and 0.2, closed at the forward end (the flow turns there)
  const liner = latheX([[0.15, xa + 0.04], [0.15, xf - 0.03], [0.175, xf - 0.012], [0.2, xf - 0.03], [0.2, xa + 0.04]], 26).translate(0, ENGINE_Y, 0);
  return { casing: merge([casing, ...flanges]), liner };
}

/** Three axial turbine stages (disc, blade ring and the nozzle ring ahead of each) on the main shaft. */
export function turbineGeo() {
  const xa = XS(STATIONS.turbine1), xf = XS(STATIONS.turbine0);
  const L = xf - xa;
  const rotors = [], nozzles = [];
  for (let k = 0; k < 3; k++) {
    const x = xa + L * (0.28 + k * 0.25);
    const rb = 0.13 + k * 0.006;                   // blade tips grow toward the exhaust as the gas expands
    rotors.push(cylX(x - 0.014, x + 0.014, 0.085, 0.085, ENGINE_Y, 0, 24));
    rotors.push(cylX(x - 0.01, x + 0.01, rb, rb, ENGINE_Y, 0, 30, true));
    rotors.push(cylX(x - 0.01, x + 0.01, rb - 0.035, rb - 0.035, ENGINE_Y, 0, 30, true));
    nozzles.push(ring(x - 0.04, rb - 0.015, 0.011, 28));
  }
  return { rotors: merge(rotors), nozzles: merge(nozzles) };
}

/** Fuel manifold ring around the combustor case with its fuel nozzles. */
export function manifoldGeo(n = 10) {
  const xa = XS(STATIONS.turbine1), xf = XS(STATIONS.turbine0);
  const x = xf - 0.05;
  const out = [ring(x, 0.228, 0.007, 36)];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    out.push(cylX(x - 0.022, x + 0.022, 0.009, 0.009, ENGINE_Y + Math.cos(a) * 0.222, Math.sin(a) * 0.222, 6));
  }
  out.push(tubeBetween([x, ENGINE_Y - 0.228, 0], [xa + 0.02, ENGINE_Y - 0.21, 0.05], 0.007, 6));
  return merge(out);
}

/** Two igniter plugs in the combustor case. */
export function ignitersGeo() {
  const x = XS(STATIONS.turbine0) - 0.09;
  return merge([0.7, -0.7].map((a) => tubeBetween([x, ENGINE_Y + Math.cos(a) * 0.205, Math.sin(a) * 0.205], [x, ENGINE_Y + Math.cos(a) * 0.255, Math.sin(a) * 0.255], 0.011, 8)));
}

/** Exhaust collector: the annular duct at the forward end that gathers the turbine exhaust. */
export function collectorGeo() {
  return new THREE.TorusGeometry(0.15, 0.055, 10, 28).rotateY(Math.PI / 2).translate(XS(STATIONS.turbine0) + 0.04, ENGINE_Y, 0);
}

/** Compressor housing: first- and second-stage impeller shrouds, diffusers and crossover ducts. */
export function compressorGeo() {
  const xa = XS(STATIONS.comp1), xf = XS(STATIONS.turbine1);         // inlet (aft) end, combustor (forward) end
  const L = xf - xa;
  const housing = latheX([
    [0.15, xa], [0.2, xa + 0.015], [0.225, xa + L * 0.15], [0.225, xa + L * 0.32], [0.2, xa + L * 0.45],
    [0.205, xa + L * 0.55], [0.23, xa + L * 0.68], [0.23, xa + L * 0.84], [0.205, xf - 0.01], [0.19, xf],
  ], 32).translate(0, ENGINE_Y, 0);
  const ducts = [];
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k / 4) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    ducts.push(pipe([[xa + L * 0.22, ENGINE_Y + c * 0.215, s * 0.215], [xa + L * 0.4, ENGINE_Y + c * 0.228, s * 0.228], [xa + L * 0.62, ENGINE_Y + c * 0.215, s * 0.215]], 0.022, 8, 10));
  }
  return merge([housing, ...ducts]);
}

/** The two centrifugal impellers inside the housing. */
export function impellersGeo() {
  const xa = XS(STATIONS.comp1), xf = XS(STATIONS.turbine1);
  const L = xf - xa;
  const imp = (x0, r) => latheX([[0.05, x0], [0.07, x0 + 0.02], [0.11, x0 + 0.05], [r, x0 + 0.075], [r, x0 + 0.085], [0.05, x0 + 0.09]], 24);
  const vanes = [];
  for (const [x0, r] of [[xa + L * 0.06, 0.17], [xa + L * 0.52, 0.18]]) {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      vanes.push(new THREE.BoxGeometry(0.06, r - 0.06, 0.004).translate(x0 + 0.05, (r + 0.06) / 2, 0).rotateX(a));
    }
  }
  return merge([imp(xa + L * 0.06, 0.17), imp(xa + L * 0.52, 0.18), ...vanes]).translate(0, ENGINE_Y, 0);
}

/** Single main shaft from the gearbox input to the last turbine disc, with its three bearings. */
export function mainShaftGeo() {
  const xg = XS(STATIONS.inlet1) + 0.02, xt = XS(STATIONS.turbine0) - 0.05;
  return merge([
    cylX(xg, xt, 0.03, 0.03, ENGINE_Y, 0, 14),
    ...[xg - 0.01, XS(STATIONS.turbine1) - 0.01, xt - 0.02].map((x) => cylX(x - 0.012, x + 0.012, 0.05, 0.05, ENGINE_Y, 0, 18)),
  ]);
}

/** Inlet screen: the open mesh cylinder between the gearbox and the first compressor stage. */
export function screenGeo() {
  return cylX(XS(STATIONS.inlet1), XS(STATIONS.comp1), 0.16, 0.16, ENGINE_Y, 0, 28, true);
}

/** Offset reduction gearbox with the propeller output above the engine centreline. */
export function gearboxGeo() {
  const x0 = XS(STATIONS.gear1), x1 = XS(STATIONS.inlet1);
  const len = x1 - x0;
  const body = lru(len, 0.33, 0.4, [x0 + len / 2, ENGINE_Y + 0.055, 0], 0.08);
  const nose = cylX(x0 - 0.06, x0 + 0.02, 0.07, 0.1, SHAFT_Y, 0, 20);
  const pads = [cylX(x0 - 0.02, x0 + 0.01, 0.09, 0.09, 1.6, 0.12, 16), cylX(x0 - 0.02, x0 + 0.01, 0.075, 0.075, 1.6, -0.12, 16)];
  return merge([body, nose, ...pads]);
}

/** Propeller drive shaft from the gearbox output to the propeller flange, with flexible couplings. */
export function shaftGeo() {
  const x0 = XS(STATIONS.gear1) - 0.06, x1 = X(10.42);
  return merge([
    cylX(x1, x0, 0.036, 0.036, SHAFT_Y, 0, 14),
    cylX(x0 - 0.04, x0, 0.07, 0.07, SHAFT_Y, 0, 18), cylX(x1, x1 + 0.04, 0.07, 0.07, SHAFT_Y, 0, 18),
  ]);
}

/** Exhaust stacks: collector outlets ducted out through both fuselage sides, angled aft. */
export function exhaustGeo() {
  const x = XS(STATIONS.exhaust);
  const out = [];
  for (const s of [1, -1]) {
    out.push(pipe([[x + 0.02, ENGINE_Y - 0.02, 0.15 * s], [x - 0.04, ENGINE_Y - 0.03, 0.28 * s], [x - 0.16, ENGINE_Y - 0.04, 0.4 * s]], 0.06, 14, 10));
    out.push(cylX(x - 0.24, x - 0.14, 0.072, 0.066, ENGINE_Y - 0.04, 0.41 * s, 16, true));
  }
  return merge(out);
}

/** Three blades around the x axis, root pitch ≈ 45°, washing out to ≈ 21° at the tip. */
export function bladesGeo(count = 3) {
  const out = [];
  for (let k = 0; k < count; k++) {
    const b = wingPanel({
      root: { le: [0.11, 0, 0.15], chord: 0.2, t: 0.16 }, tip: { le: [0.045, 0, PROP_R], chord: 0.1, t: 0.06 },
      stations: 8, twist: -24, camber: 0.035, uvMode: 'normalized',
    });
    b.rotateZ(Math.PI / 2 - 0.8);
    b.rotateX((k / count) * Math.PI * 2);
    out.push(b);
  }
  return out;
}

/** Hub, blade clamps and the pitch-change dome (behind the spinner). */
export function hubGeo(count = 3) {
  const parts = [cylX(-0.1, 0.1, 0.12, 0.12, 0, 0, 24), cylX(-0.22, -0.1, 0.08, 0.1, 0, 0, 20)];
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2;
    parts.push(tubeBetween([0, Math.cos(a) * 0.1, Math.sin(a) * 0.1], [0, Math.cos(a) * 0.17, Math.sin(a) * 0.17], 0.05, 14));
  }
  return merge(parts);
}

/** Spinner around the hub; local frame at the propeller plane. */
export function spinnerGeo() {
  return latheX([[0.001, -0.43], [0.045, -0.4], [0.095, -0.3], [0.13, -0.17], [0.148, -0.05], [0.152, 0.06], [0.152, 0.1]], 32);
}
