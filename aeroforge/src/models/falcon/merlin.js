// Merlin 1D and Merlin Vacuum geometry (engine frame: y = 0 at the nozzle exit plane, axis +y).
//
// Merlin 1D: open gas-generator cycle, RP-1 / LOX at a mixture ratio ≈ 2.36, 9.7 MPa chamber,
// pintle injector, single-shaft turbopump (≈ 36,000 rpm, ≈ 10,000 hp), dual TEA-TEB ignition,
// regeneratively cooled chamber and nozzle, 16 : 1 expansion. Exit ≈ 0.92 m. Internal lengths and
// the placement of the turbopump, gas generator and lines are estimates sized from photographs.
// Merlin Vacuum: same powerhead, 165 : 1 expansion with a radiatively cooled niobium-alloy
// extension to a 3.3 m exit (the published 3.3 m and 165 : 1 do not quite fit the sea-level
// engine's throat; the exit size is kept); its turbine exhaust is dumped into a manifold at the top
// of the extension. Nozzle length (≈ 2.6 m throat to exit) is an estimate.

import * as THREE from 'three';
import { lathe, rod } from '../../engine/geometry.js';
import { merge, pipe, hoop, post, block, revolve } from './util.js';

/** Rao-style bell: quadratic Bézier from throat (rt, yt) to exit (re, ye) with wall angles th0 → the (deg). */
export function bellPoints(rt, yt, re, ye, th0 = 32, the = 8, n = 18) {
  const d0 = [Math.sin((th0 * Math.PI) / 180), -Math.cos((th0 * Math.PI) / 180)];
  const d2 = [Math.sin((the * Math.PI) / 180), -Math.cos((the * Math.PI) / 180)];
  // P1 = P0 + a d0 = P2 − b d2
  const det = d0[0] * -d2[1] - -d2[0] * d0[1];
  const rx = re - rt, ry = ye - yt;
  const a = (rx * -d2[1] - -d2[0] * ry) / det;
  const p1 = [rt + a * d0[0], yt + a * d0[1]];
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * rt + 2 * u * t * p1[0] + t * t * re, u * u * yt + 2 * u * t * p1[1] + t * t * ye]);
  }
  return out;
}

// ---------------------------------------------------------------------- Merlin 1D (sea level)
export const M1D = { exitR: 0.46, throatR: 0.115, throatY: 1.18, chamberR: 0.2, chamberTop: 1.6, domeTop: 1.84, gimbalTop: 2.0 };

/** Chamber + injector dome (top → throat), as a lathe profile. */
function chamberProfile(k = M1D) {
  return [[0.001, k.domeTop], [0.13, k.domeTop - 0.02], [0.22, k.chamberTop + 0.14], [0.225, k.chamberTop + 0.06], [k.chamberR, k.chamberTop],
    [k.chamberR, k.throatY + 0.18], [k.chamberR * 0.8, k.throatY + 0.08], [k.throatR, k.throatY]];
}

/** Whole thrust chamber assembly for the simplified cluster engines (chamber + bell in one lathe). */
export function merlinBell(seg = 28) {
  const prof = chamberProfile().concat(bellPoints(M1D.throatR, M1D.throatY, M1D.exitR, 0, 32, 8, 16).slice(1));
  return lathe(prof, seg);
}

/** Nozzle only (throat → exit), for the detailed engine. */
export function merlinNozzle(seg = 56) {
  return lathe(bellPoints(M1D.throatR, M1D.throatY, M1D.exitR, 0, 32, 8, 26), seg);
}

/** Chamber + injector dome only (detailed engine). */
export function merlinChamber(seg = 48) {
  return lathe(chamberProfile(), seg);
}

/**
 * Powerhead kit of one Merlin 1D in engine coordinates, the turbopump on local +x.
 * Returns geometry lists by finish: { pump, line, duct, gg, act, valve }.
 */
export function merlinKit({ detail = false } = {}) {
  const seg = detail ? 20 : 10;
  const px = 0.36;                              // turbopump axis offset
  const pump = [
    post(px, 0, 1.96, 2.16, 0.15, seg),         // LOX pump volute (top)
    post(px, 0, 1.73, 1.93, 0.14, seg),         // RP-1 pump volute
    post(px, 0, 1.52, 1.72, 0.125, seg),        // turbine housing
    post(px, 0, 1.5, 2.2, 0.075, seg),          // shaft housing
  ];
  if (detail) {
    pump.push(hoop(0.15, 0.025, 2.06, { x: px, seg: 24, tube: 6 }), hoop(0.14, 0.022, 1.83, { x: px, seg: 24, tube: 6 }), hoop(0.125, 0.02, 1.6, { x: px, seg: 24, tube: 6 }));
    // volute outlets (tangential scrolls)
    pump.push(pipe([[px + 0.12, 2.06, 0.08], [px + 0.02, 2.08, 0.2], [0.12, 1.98, 0.14]], 0.045, { seg: 8, tubular: 14 }));
  }
  const line = [
    // LOX pump discharge → injector dome
    pipe([[px, 2.16, 0], [px * 0.7, 2.06, 0], [0.16, 1.9, 0], [0.05, 1.84, 0]], 0.05, { seg, tubular: detail ? 16 : 8 }),
    // RP-1 discharge → regenerative cooling inlet near the throat
    pipe([[px - 0.1, 1.82, -0.09], [0.26, 1.7, -0.14], [0.23, 1.45, -0.12], [0.16, 1.28, -0.1]], 0.042, { seg, tubular: detail ? 16 : 8 }),
    // propellant inlets from the stage feed system
    post(px, 0, 2.16, 2.5, 0.07, seg),
    pipe([[px + 0.13, 1.83, 0], [px + 0.25, 1.95, 0], [px + 0.25, 2.45, 0]], 0.055, { seg, tubular: 8 }),
  ];
  const gg = [post(px, 0.2, 1.36, 1.56, 0.055, seg), post(px, 0.2, 1.56, 1.62, 0.035, seg)];
  const duct = [pipe([[px, 1.52, 0], [px + 0.08, 1.42, 0.02], [px + 0.15, 1.3, 0.03], [px + 0.16, 0.95, 0.03]], 0.07, { seg, tubular: detail ? 16 : 8 })];
  const act = [];
  for (const a of [125, 235]) {
    const c = Math.cos((a * Math.PI) / 180), s = Math.sin((a * Math.PI) / 180);
    act.push(rod([c * 0.5, 2.12, s * 0.5], [c * 0.3, 1.66, s * 0.3], 0.042, seg));
    act.push(rod([c * 0.3, 1.66, s * 0.3], [c * 0.215, 1.42, s * 0.215], 0.022, 8));
  }
  act.push(block(0, 1.92, 0, 0.22, 0.16, 0.22));    // gimbal block
  const valve = [];
  if (detail) {
    valve.push(block(px * 0.62, 2.04, 0, 0.12, 0.1, 0.12));          // main oxidiser valve
    valve.push(block(0.24, 1.62, -0.15, 0.1, 0.1, 0.1));              // main fuel valve
    valve.push(post(px + 0.06, 0.2, 1.62, 1.7, 0.03, 8));             // GG valve
    // TEA-TEB igniter feeds to the gas generator and the injector
    valve.push(pipe([[-0.3, 2.3, 0.1], [-0.18, 1.95, 0.12], [-0.06, 1.86, 0.06]], 0.012, { seg: 6, tubular: 12 }));
    valve.push(pipe([[-0.3, 2.3, 0.1], [0.1, 2.1, 0.3], [px, 1.62, 0.22]], 0.012, { seg: 6, tubular: 14 }));
    valve.push(block(-0.3, 2.32, 0.1, 0.08, 0.08, 0.08));
  }
  return { pump, line, gg, duct, act, valve };
}

/** Place a list of engine-frame geometries at (x, y0, z) turned by yaw (rad). */
export function placeAll(list, x, y0, z, yaw) {
  return list.map((g) => {
    const c = g.clone();
    c.rotateY(yaw);
    c.translate(x, y0, z);
    return c;
  });
}

// ---------------------------------------------------------------------- Merlin Vacuum
export const MVAC = { exitR: 1.65, jointR: 0.5, jointY: 2.05, throatR: 0.115, throatY: 2.58, chamberTop: 3.0, domeTop: 3.24, gimbalTop: 3.4 };

export function mvacChamber(seg = 48) {
  const k = { ...M1D, throatY: MVAC.throatY, chamberTop: MVAC.chamberTop, domeTop: MVAC.domeTop };
  return lathe(chamberProfile(k), seg);
}

/** Regeneratively cooled section from the throat to the extension joint (≈ 19 : 1). */
export function mvacRegen(seg = 56) {
  return lathe(bellPoints(MVAC.throatR, MVAC.throatY, MVAC.jointR, MVAC.jointY, 50, 30, 14), seg);
}

/** Niobium-alloy extension from the joint to the 165 : 1 exit. */
export function mvacExtension(seg = 96) {
  return lathe(bellPoints(MVAC.jointR, MVAC.jointY, MVAC.exitR, 0, 38, 18, 26), seg);
}

/** MVac powerhead kit (same layout as Merlin 1D, raised to the MVac chamber). */
export function mvacKit() {
  const dy = MVAC.throatY - M1D.throatY;
  const k = merlinKit({ detail: true });
  const lift = (list) => list.map((g) => g.clone().translate(0, dy, 0));
  const out = {};
  for (const key of Object.keys(k)) out[key] = lift(k[key]);
  // the MVac turbine exhausts into the extension manifold instead of overboard
  out.duct = [
    pipe([[0.36, 1.52 + dy, 0], [0.5, 1.2 + dy, 0.05], [0.58, MVAC.jointY + 0.4, 0.06], [0.56, MVAC.jointY + 0.08, 0.05]], 0.07, { seg: 14, tubular: 18 }),
    hoop(MVAC.jointR + 0.07, 0.06, MVAC.jointY + 0.02, { seg: 64, tube: 10 }),
  ];
  return out;
}

/** Gimbal mount ring + thrust frame stub shared by MVac (stage frame helpers use it). */
export function thrustCone(r0, y0, r1, y1, seg = 48) {
  return revolve([[r0, y0], [r1, y1]], seg);
}

export { THREE };
