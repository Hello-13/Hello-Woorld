// Merlin 1D and Merlin Vacuum geometry (engine frame: y = 0 at the nozzle exit plane, axis +y).
//
// Merlin 1D: open gas-generator cycle, RP-1 / LOX at a mixture ratio ≈ 2.36, 9.7 MPa chamber,
// pintle injector, single-shaft turbopump (one shaft carries the LOX impeller, the RP-1 impeller
// and the turbine; the 36,000 rpm / 10,000 hp often quoted are the Barber-Nichols pump of Merlin
// 1A–1C, and no Merlin 1D figure is published), dual TEA-TEB ignition, a milled copper-alloy
// liner regeneratively cooled in the chamber and nozzle, 16 : 1 expansion, ≈ 0.92 m exit. Each
// engine has its own main LOX and fuel valves, gas-generator valve, a servo-driven butterfly valve
// that trims the mixture ratio, an engine-chill bleed and two TVC actuators worked by
// high-pressure RP-1 from its own pump. Internal lengths and the placement of the turbopump, gas
// generator, valves and lines are estimates sized from photographs.
// Merlin Vacuum: same powerhead, 165 : 1 expansion with a radiatively cooled niobium-alloy
// extension to a 3.3 m exit (the published 3.3 m and 165 : 1 do not quite fit the sea-level
// engine's throat; the exit size is kept); its turbine exhaust is dumped into a manifold at the top
// of the extension. Extension length (2.75 m) and nozzle length are estimates.

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
 * Inside the detailed chamber: the pintle (a central post whose sleeve meters RP-1 outward across a
 * sheet of LOX), the injector faceplate, the LOX dome above it and the fuel manifold ring at the
 * chamber wall. dy raises it for the MVac chamber.
 */
export function pintleInjector(dy = 0, k = M1D) {
  const top = k.chamberTop + 0.14 + dy;
  return [
    post(0, 0, top - 0.15, top + 0.0, 0.04, 16),                         // pintle post, ≈ Ø80 × 150 mm
    post(0, 0, top - 0.17, top - 0.15, 0.055, 16, 0.04),                  // pintle tip
    post(0, 0, top - 0.005, top + 0.01, 0.205, 32),                       // faceplate
    lathe([[0.02, top + 0.09], [0.12, top + 0.075], [0.19, top + 0.03], [0.2, top + 0.012]], 24),   // LOX dome (inner)
    hoop(0.205, 0.018, top - 0.02, { seg: 32, tube: 6 }),                // fuel manifold ring
  ];
}

/**
 * Powerhead kit of one Merlin 1D in engine coordinates, the turbopump on local +x.
 * level 'full' (a broken-out engine) or 'mid' (the cluster engines: the same components, fewer
 * segments). Returns geometry lists by component:
 *   pump   LOX and RP-1 volutes, turbine housing, shaft housing, volute outlets
 *   gg     gas generator and its injector head
 *   duct   turbine exhaust duct
 *   line   propellant ducts: pump discharges to the injector and the regenerative-cooling inlet, pump inlets
 *   valve  main oxidiser and fuel valves, GG valve, mixture-ratio trim valve and its servo, igniter valve
 *   ign    TEA-TEB igniter lines (to the chamber and the gas generator, dual-redundant)
 *   act    two TVC actuators and the gimbal block
 *   tvc    high-pressure RP-1 supply and return lines of the TVC actuators
 *   bleed  engine-chill bleed valve and its overboard line
 * The legacy `detail` flag maps to level 'full'.
 */
export function merlinKit({ detail = false, level = detail ? 'full' : 'mid' } = {}) {
  const full = level === 'full';
  const seg = full ? 20 : 10;
  const lseg = full ? 6 : 4;                  // small lines
  const px = 0.36;                            // turbopump axis offset
  const ringSeg = full ? 24 : 14, ringTube = full ? 6 : 4;
  const pump = [
    post(px, 0, 1.96, 2.16, 0.15, seg),         // LOX pump volute (top)
    post(px, 0, 1.73, 1.93, 0.14, seg),         // RP-1 pump volute
    post(px, 0, 1.52, 1.72, 0.125, seg),        // turbine housing
    post(px, 0, 1.5, 2.2, 0.075, seg),          // shaft housing
    hoop(0.15, 0.025, 2.06, { x: px, seg: ringSeg, tube: ringTube }), hoop(0.14, 0.022, 1.83, { x: px, seg: ringSeg, tube: ringTube }),
    hoop(0.125, 0.02, 1.6, { x: px, seg: ringSeg, tube: ringTube }),
    // volute outlets (tangential scrolls)
    pipe([[px + 0.12, 2.06, 0.08], [px + 0.02, 2.08, 0.2], [0.12, 1.98, 0.14]], 0.045, { seg: full ? 8 : 6, tubular: full ? 14 : 8 }),
    pipe([[px + 0.11, 1.83, -0.08], [px + 0.0, 1.84, -0.17], [px - 0.1, 1.82, -0.09]], 0.04, { seg: full ? 8 : 6, tubular: full ? 12 : 6 }),
  ];
  const line = [
    // LOX pump discharge → injector dome
    pipe([[px, 2.16, 0], [px * 0.7, 2.06, 0], [0.16, 1.9, 0], [0.05, 1.84, 0]], 0.05, { seg, tubular: full ? 16 : 8 }),
    // RP-1 discharge → regenerative cooling inlet near the throat
    pipe([[px - 0.1, 1.82, -0.09], [0.26, 1.7, -0.14], [0.23, 1.45, -0.12], [0.16, 1.28, -0.1]], 0.042, { seg, tubular: full ? 16 : 8 }),
    // propellant inlets from the stage feed system
    post(px, 0, 2.16, 2.5, 0.07, seg),
    pipe([[px + 0.13, 1.83, 0], [px + 0.25, 1.95, 0], [px + 0.25, 2.45, 0]], 0.055, { seg, tubular: 8 }),
  ];
  const gg = [post(px, 0.2, 1.36, 1.56, 0.055, seg), post(px, 0.2, 1.56, 1.62, 0.035, seg)];
  const duct = [pipe([[px, 1.52, 0], [px + 0.08, 1.42, 0.02], [px + 0.15, 1.3, 0.03], [px + 0.16, 0.95, 0.03]], 0.07, { seg, tubular: full ? 16 : 8 })];
  const act = [];
  for (const a of [125, 235]) {
    const c = Math.cos((a * Math.PI) / 180), s = Math.sin((a * Math.PI) / 180);
    act.push(rod([c * 0.5, 2.12, s * 0.5], [c * 0.3, 1.66, s * 0.3], 0.042, seg));
    act.push(rod([c * 0.3, 1.66, s * 0.3], [c * 0.215, 1.42, s * 0.215], 0.022, 8));
  }
  act.push(block(0, 1.92, 0, 0.22, 0.16, 0.22));    // gimbal block
  const valve = [
    block(px * 0.62, 2.04, 0, 0.12, 0.1, 0.12),                        // main oxidiser valve
    block(0.24, 1.62, -0.15, 0.1, 0.1, 0.1),                            // main fuel valve
    post(px + 0.06, 0.2, 1.62, 1.7, 0.03, 8),                           // GG valve
    post(0.228, -0.127, 1.47, 1.53, 0.05, full ? 14 : 8),              // mixture-ratio trim butterfly valve
    block(0.3, 1.5, -0.2, 0.06, 0.08, 0.06),                            // its servo motor
    block(-0.3, 2.32, 0.1, 0.08, 0.08, 0.08),                           // TEA-TEB igniter valve
  ];
  const ign = [
    // TEA-TEB igniter feeds to the injector and the gas generator (dual-redundant)
    pipe([[-0.3, 2.3, 0.1], [-0.18, 1.95, 0.12], [-0.06, 1.86, 0.06]], 0.012, { seg: lseg, tubular: full ? 12 : 8 }),
    pipe([[-0.3, 2.3, 0.1], [0.1, 2.1, 0.3], [px, 1.62, 0.22]], 0.012, { seg: lseg, tubular: full ? 14 : 8 }),
  ];
  // TVC hydraulics: high-pressure RP-1 from the fuel-pump discharge to each actuator, and the
  // return to the pump's low-pressure inlet (no separate hydraulic fluid to run out)
  const tvcR = full ? 0.01 : 0.009, tv = { seg: lseg, tubular: full ? 14 : 8 };
  const port = (a, r, y) => [Math.cos((a * Math.PI) / 180) * r, y, Math.sin((a * Math.PI) / 180) * r];
  const tvc = [
    pipe([[px - 0.08, 1.86, -0.12], [0.05, 1.95, -0.3], port(235, 0.45, 2.03)], tvcR, tv),
    pipe([[0.05, 1.95, -0.3], [-0.15, 1.99, -0.33], [-0.34, 2.0, -0.05], [-0.33, 2.01, 0.2], port(125, 0.45, 2.03)], tvcR, tv),
    pipe([port(125, 0.47, 2.09), [0.0, 2.15, 0.36], [0.35, 2.25, 0.22], [px + 0.24, 2.3, 0.04]], tvcR, tv),
    pipe([port(235, 0.47, 2.09), [0.0, 2.15, -0.36], [0.35, 2.25, -0.22], [px + 0.24, 2.3, -0.04]], tvcR, tv),
  ];
  // engine chill: a bleed valve on the LOX pump inlet dumps LOX through the pump overboard,
  // through the heat shield, until the hardware is cold enough for start
  // (an outer engine's line drops past the pump on its leading side and pulls in toward the engine
  // before the heat shield, inboard of the Octaweb's lower ring and the hold-down fittings)
  // (an outer engine's valve sits higher and its line hops over the Octaweb strut to the corner
  // beside it, then drops past the pump's leading side and pulls in toward the engine before the heat
  // shield, inboard of the Octaweb's lower ring and the hold-down fittings)
  const bleed = full ? [
    block(px - 0.1, 2.32, -0.08, 0.07, 0.07, 0.07),
    pipe([[px - 0.1, 2.3, -0.12], [px + 0.02, 2.15, -0.28], [px + 0.1, 1.85, -0.3], [px + 0.1, 1.2, -0.27]], 0.0125, { seg: lseg, tubular: 14 }),
  ] : [
    block(px - 0.1, 2.38, -0.08, 0.07, 0.07, 0.07),
    pipe([[px - 0.1, 2.37, -0.12], [px - 0.06, 2.4, -0.2], [px, 2.32, -0.3], [px + 0.04, 2.12, -0.3], [px + 0.14, 1.85, -0.16], [px + 0.19, 1.55, -0.1], [px + 0.2, 1.2, -0.08]], 0.0125, { seg: lseg, tubular: 16 }),
  ];
  return { pump, line, gg, duct, act, valve, ign, tvc, bleed };
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
// jointY 2.75 m above the exit: a ≈ 2.75 m niobium extension (the Merlin 1C Vacuum's was 9 ft,
// 2.7 m; the M1D Vacuum's longer bell to a 3.3 m exit is not published, so its length is estimated)
export const MVAC = { exitR: 1.65, jointR: 0.5, jointY: 2.75, throatR: 0.115, throatY: 3.28, chamberTop: 3.7, domeTop: 3.94, gimbalTop: 4.1 };

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
  return lathe(bellPoints(MVAC.jointR, MVAC.jointY, MVAC.exitR, 0, 34, 14, 28), seg);
}

/** MVac powerhead kit (same layout as Merlin 1D, raised to the MVac chamber). */
export function mvacKit() {
  const dy = MVAC.throatY - M1D.throatY;
  const k = merlinKit({ level: 'full' });
  const lift = (list) => list.map((g) => g.clone().translate(0, dy, 0));
  const out = {};
  for (const key of Object.keys(k)) out[key] = lift(k[key]);
  // the MVac turbine exhausts into the extension manifold instead of overboard
  out.duct = [
    pipe([[0.36, 1.52 + dy, 0], [0.5, 1.2 + dy, 0.05], [0.58, MVAC.jointY + 0.4, 0.06], [0.56, MVAC.jointY + 0.08, 0.05]], 0.07, { seg: 14, tubular: 18 }),
    hoop(MVAC.jointR + 0.07, 0.06, MVAC.jointY + 0.02, { seg: 64, tube: 10 }),
  ];
  // the chill bleed vents into the interstage rather than through a heat shield
  out.bleed = [
    block(0.26, 2.32 + dy, -0.08, 0.07, 0.07, 0.07),
    pipe([[0.26, 2.3 + dy, -0.12], [0.38, 2.15 + dy, -0.28], [0.5, 1.9 + dy, -0.36], [0.62, 1.6 + dy, -0.4]], 0.0125, { seg: 6, tubular: 12 }),
  ];
  // insulation lagging over the igniter lines (added after the first v1.1 relight failure, 2013)
  out.lag = [
    pipe([[-0.3, 2.28 + dy, 0.1], [-0.18, 1.95 + dy, 0.12], [-0.07, 1.87 + dy, 0.065]], 0.024, { seg: 8, tubular: 12 }),
    pipe([[-0.3, 2.28 + dy, 0.1], [0.1, 2.1 + dy, 0.3], [0.35, 1.64 + dy, 0.22]], 0.024, { seg: 8, tubular: 14 }),
  ];
  out.inj = pintleInjector(dy);
  return out;
}

/** Gimbal mount ring + thrust frame stub shared by MVac (stage frame helpers use it). */
export function thrustCone(r0, y0, r1, y1, seg = 48) {
  return revolve([[r0, y0], [r1, y1]], seg);
}

export { THREE, merge };
