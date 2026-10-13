// External stores for the MQ-9A at the encyclopedic level of public fact sheets and museum
// displays: GBU-12 Paveway II (Mk 82 body, 3.27 m × 0.273 m, ≈ 230 kg), AGM-114 Hellfire
// (1.63 m × 0.178 m, 45–49 kg), a two-rail M299-family launcher and aerodynamic pylons.
// Every builder returns geometries grouped by finish so a store is a handful of meshes.
// Stores are built along +x (nose forward), centred on their length, with the suspension
// lugs on top at y = +radius.

import * as THREE from 'three';
import { wingPanel } from '../../engine/geometry.js';
import { merge, latheX, box, cylX } from './shape.js';

/** Thin trapezoidal fin in the x–r plane, rotated to angle phi about the x axis. */
function fin(xLE, rootChord, tipChord, span, sweep, r0, phi, th = 0.006) {
  const sh = new THREE.Shape();
  sh.moveTo(xLE, 0);
  sh.lineTo(xLE - rootChord, 0);
  sh.lineTo(xLE - sweep - tipChord, span);
  sh.lineTo(xLE - sweep, span);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false });
  g.translate(0, r0 - 0.004, -th / 2);
  g.rotateX(phi);
  return g;
}

function fins(n, offset, ...args) {
  const out = [];
  for (let k = 0; k < n; k++) out.push(fin(...args.slice(0, 6), offset + (k / n) * Math.PI * 2));
  return out;
}

/** Narrow band (paint ring) slightly proud of a cylinder of radius r. */
const band = (x0, x1, r) => cylX(x0, x1, r + 0.0015, r + 0.0015, 0, 0, 28, true);

/** GBU-12 Paveway II: MAU-169-class guidance section, Mk 82 bomb body, folded airfoil group. */
export function gbu12() {
  const R = 0.1365, L = 3.27, h = L / 2;
  const body = latheX([
    [0.001, -h], [0.085, -h], [0.098, -h + 0.06], [0.104, -1.25], [0.122, -1.16], [R, -0.98],
    [R, 0.42], [0.128, 0.6], [0.105, 0.78], [0.082, 0.92], [0.076, 0.95],
  ], 28);
  const guidance = latheX([[0.076, 0.95], [0.086, 1.0], [0.088, 1.40], [0.072, 1.46]], 24);
  const ring = cylX(1.43, 1.57, 0.094, 0.094, 0, 0, 28, true);      // seeker ring tail (wind vane)
  const strut = [0, 1, 2, 3].map((k) => box(0.1, 0.006, 0.03, [1.5, 0.083, 0], null).rotateX((k * Math.PI) / 2 + Math.PI / 4));
  const dome = latheX([[0.072, 1.46], [0.07, 1.5], [0.058, 1.56], [0.034, 1.61], [0.001, h]], 20);
  const canards = fins(4, Math.PI / 4, 1.33, 0.2, 0.08, 0.1, 0.1, 0.086);
  const wings = fins(4, Math.PI / 4, -1.2, 0.42, 0.34, 0.19, 0.04, 0.104);
  const lugs = [-0.178, 0.178].map((x) => box(0.05, 0.03, 0.025, [x, R + 0.012, 0]));
  return {
    body: merge([body, ...wings, ...lugs]),
    guidance: merge([guidance, ring, ...strut, ...canards]),
    dome,
    band: merge([band(0.46, 0.53, 0.132)]),        // yellow nose band: high-explosive fill
    length: L, radius: R,
  };
}

/** AGM-114 Hellfire: semi-active laser seeker dome, canards, long-chord mid wings, tail controls. */
export function hellfire() {
  const R = 0.089, L = 1.63, h = L / 2;
  const body = latheX([[0.001, -h], [0.07, -h], [0.08, -h + 0.02], [R, -h + 0.05], [R, 0.6], [0.086, 0.64], [0.08, 0.67]], 22);
  const dome = latheX([[0.08, 0.67], [0.074, 0.72], [0.058, 0.77], [0.032, 0.805], [0.001, h]], 18);
  const canards = fins(4, Math.PI / 4, 0.6, 0.12, 0.05, 0.07, 0.05, 0.086);
  const wings = fins(4, Math.PI / 4, 0.08, 0.5, 0.36, 0.075, 0.12, 0.086);
  const tails = fins(4, Math.PI / 4, -0.62, 0.15, 0.1, 0.06, 0.04, 0.086);
  const shoe = [box(0.07, 0.022, 0.03, [0.32, R + 0.01, 0]), box(0.07, 0.022, 0.03, [-0.36, R + 0.01, 0])];
  return {
    body: merge([body, ...canards, ...wings, ...tails, ...shoe]),
    dome,
    band: band(0.48, 0.52, R),          // yellow band: high-explosive warhead
    motor: band(-0.3, -0.26, R),        // brown band: live rocket motor
    length: L, radius: R,
  };
}

/** Two-rail M299-family launcher: strongback, rails and the launcher electronics housing. */
export function launcher() {
  const parts = [
    box(1.55, 0.13, 0.12, [0, 0, 0]),
    latheX([[0.065, 0.775], [0.06, 0.82], [0.035, 0.88], [0.001, 0.92]], 12).scale(1, 1, 0.9),
    box(0.42, 0.1, 0.2, [0.45, 0.02, 0]),                  // launcher electronics assembly
  ];
  for (const s of [1, -1]) {
    parts.push(box(1.45, 0.04, 0.05, [-0.02, -0.075, 0.12 * s]));     // rail
    parts.push(box(1.2, 0.03, 0.14, [-0.05, -0.05, 0.06 * s]));       // rail arm
  }
  return merge(parts);
}

/** Aerodynamic pylon: symmetric section lofted downward from the wing, with a rack and sway braces. */
export function pylon(chord, height, t = 0.13) {
  const skin = wingPanel({ root: { le: [0, 0, 0], chord, t }, tip: { le: [-0.04, 0, height], chord: chord * 0.92, t }, stations: 2, n: 14, withChord: false });
  skin.rotateX(Math.PI / 2);             // span +z → −y, thickness → z
  const rack = [
    box(chord * 0.55, 0.05, 0.06, [-chord * 0.45, -height + 0.02, 0]),
    box(0.04, 0.05, 0.03, [-chord * 0.45 + 0.178, -height - 0.015, 0]),
    box(0.04, 0.05, 0.03, [-chord * 0.45 - 0.178, -height - 0.015, 0]),
  ];
  for (const s of [1, -1]) for (const dx of [0.22, -0.22]) rack.push(box(0.025, 0.05, 0.025, [-chord * 0.45 + dx, -height - 0.02, 0.07 * s], [0.5 * s, 0, 0]));
  return { skin, rack: merge(rack) };
}
