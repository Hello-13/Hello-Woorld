// Honeywell TPE331-10GD installation for the MQ-9A, in aircraft coordinates (see shape.js).
// The TPE331 is a single-shaft turboprop: air enters behind the offset reduction gearbox, goes
// through a two-stage centrifugal compressor, turns into a reverse-flow annular combustor wrapped
// around a three-stage axial turbine and leaves at the end opposite the gearbox. In the pusher
// MQ-9 the gearbox faces aft, so the exhaust end faces forward and dumps through two side stacks.
// Engine envelope ≈ 1.1 m long × 0.53 m wide × 0.66 m tall (TPE331-10 data); internal sizes are
// estimates scaled to that envelope.

import * as THREE from 'three';
import { wingPanel } from '../../engine/geometry.js';
import { X, merge, box, cylX, latheX, tubeBetween, pipe, lru } from './shape.js';

export const ENGINE_Y = 1.55;          // engine centreline
export const SHAFT_Y = 1.73;           // propeller axis (gearbox output is offset above the engine)
export const PROP_X = X(10.52);        // propeller plane
export const PROP_R = 1.3;             // 2.6 m diameter (estimate)
export const STATIONS = { exhaust: 7.92, turbine0: 7.98, turbine1: 8.55, comp1: 9.05, inlet1: 9.25, gear1: 9.65 };

/** Combustor & turbine section: combustor case, turbine casing, fuel manifold and nozzles, exhaust collector. */
export function turbineGeo() {
  const x0 = X(STATIONS.turbine1), x1 = X(STATIONS.turbine0);   // aft end, forward end (x1 > x0)
  const casing = latheX([
    [0.15, x0], [0.2, x0 + 0.02], [0.215, x0 + 0.12], [0.215, x0 + 0.38], [0.2, x0 + 0.48], [0.17, x1 - 0.02], [0.16, x1],
  ], 28).translate(0, ENGINE_Y, 0);
  const flanges = [x0 + 0.02, x0 + 0.25, x0 + 0.47].map((x) => cylX(x - 0.012, x + 0.012, 0.225, 0.225, ENGINE_Y, 0, 28));
  const manifold = new THREE.TorusGeometry(0.228, 0.008, 6, 36).rotateY(Math.PI / 2).translate(x0 + 0.15, ENGINE_Y, 0);
  const nozzles = [];
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    nozzles.push(cylX(x0 + 0.13, x0 + 0.18, 0.012, 0.012, ENGINE_Y + Math.cos(a) * 0.222, Math.sin(a) * 0.222, 6));
  }
  const igniters = [0.6, -0.6].map((a) => tubeBetween([x0 + 0.3, ENGINE_Y + Math.cos(a) * 0.21, Math.sin(a) * 0.21], [x0 + 0.3, ENGINE_Y + Math.cos(a) * 0.26, Math.sin(a) * 0.26], 0.012, 6));
  const collector = new THREE.TorusGeometry(0.15, 0.06, 10, 28).rotateY(Math.PI / 2).translate(x1 + 0.04, ENGINE_Y, 0);
  return { hot: merge([casing, ...flanges, collector]), fittings: merge([manifold, ...nozzles, ...igniters]) };
}

/** Two-stage centrifugal compressor: impeller scroll housings, diffuser ducts, inlet screen. */
export function compressorGeo() {
  const x0 = X(STATIONS.comp1), x1 = X(STATIONS.turbine1);
  const housing = latheX([
    [0.12, x0], [0.2, x0 + 0.02], [0.245, x0 + 0.09], [0.245, x0 + 0.17], [0.2, x0 + 0.24], [0.21, x0 + 0.27], [0.25, x0 + 0.34], [0.25, x0 + 0.42], [0.2, x1 - 0.02], [0.15, x1],
  ], 30).translate(0, ENGINE_Y, 0);
  const ducts = [];
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k / 4) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    ducts.push(pipe([[x0 + 0.38, ENGINE_Y + c * 0.24, s * 0.24], [x0 + 0.46, ENGINE_Y + c * 0.25, s * 0.25], [x1 + 0.12, ENGINE_Y + c * 0.235, s * 0.235]], 0.028, 8, 10));
  }
  const screen = cylX(X(STATIONS.inlet1), x0, 0.17, 0.17, ENGINE_Y, 0, 28, true);
  return { case: merge([housing, ...ducts]), screen };
}

/** Offset reduction gearbox with the propeller output above the engine centreline. */
export function gearboxGeo() {
  const x0 = X(STATIONS.gear1), x1 = X(STATIONS.inlet1);
  const len = x1 - x0;
  const body = lru(len, 0.36, 0.42, [x0 + len / 2, ENGINE_Y + 0.06, 0], 0.08);
  const nose = cylX(x0 - 0.06, x0 + 0.02, 0.07, 0.1, SHAFT_Y, 0, 20);
  const pads = [cylX(x0 - 0.02, x0 + 0.01, 0.09, 0.09, 1.6, 0.12, 16), cylX(x0 - 0.02, x0 + 0.01, 0.075, 0.075, 1.6, -0.12, 16)];
  return merge([body, nose, ...pads]);
}

/** Propeller drive shaft from the gearbox output to the propeller flange, with flexible couplings. */
export function shaftGeo() {
  const x0 = X(STATIONS.gear1) - 0.06, x1 = X(10.42);
  return merge([
    cylX(x1, x0, 0.038, 0.038, SHAFT_Y, 0, 14),
    cylX(x0 - 0.04, x0, 0.075, 0.075, SHAFT_Y, 0, 18), cylX(x1, x1 + 0.04, 0.075, 0.075, SHAFT_Y, 0, 18),
    cylX((x0 + x1) / 2 - 0.02, (x0 + x1) / 2 + 0.02, 0.06, 0.06, SHAFT_Y, 0, 18),
  ]);
}

/** Exhaust stacks: collector outlets ducted out through both fuselage sides, angled aft. */
export function exhaustGeo() {
  const x = X(STATIONS.exhaust);
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
