// Core and LP turbine: 9-stage HP compressor with variable stators, compressor rear frame, dual
// annular combustor and its 30 fuel nozzles, 2-stage HP turbine, 6-stage LP turbine, turbine rear
// frame, core exhaust nozzle and plug, both spool shafts, the main bearings and their sumps.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { lathe } from '../../engine/geometry.js';
import { M } from '../../engine/materials.js';
import { GM } from './materials.js';
import { ROWS, coreAt, PLUG_TIP, TCF, CORE_COWL, cowlAt } from './layout.js';
import { cutLathe, cutPair, bladeGeometry, ring, boxAt, radialCyl, axialCyl, hoop, kept, merge, P3, tube, cutTube, rotorRow } from './geom.js';
import { coreRow, coreRotor, coreBlade } from './fan.js';

const TAU = Math.PI * 2;
/** Angle at which the metered-fuel line meets the nozzle manifolds (feed tee). */
export const FEED_PHI = 1.36;

/** Annular wall following the core tip (or hub) line between y0 and y1, offset d0…d1. */
function lineWall(y0, y1, d0, d1, which = 1, step = 0.05) {
  const a = [], b = [];
  for (let y = y0; y >= y1 - 1e-6; y -= step) { const r = coreAt(y)[which]; a.push([r + d0, y]); b.push([r + d1, y]); }
  const r1 = coreAt(y1)[which];
  if (a[a.length - 1][1] > y1 + 1e-6) { a.push([r1 + d0, y1]); b.push([r1 + d1, y1]); }
  return a.concat(b.reverse());
}

/** Rectangle profile r0…r1 × y0…y1. */
const rect = (r0, r1, y0, y1) => [[r0, y0], [r1, y0], [r1, y1], [r0, y1]];

/** Rolling-element bearing: inner and outer races plus a ring of balls or rollers. */
function bearing(y, rIn, rOut, { balls = true, n = 22 } = {}) {
  const w = 0.03;
  const races = cutLathe([rect(rIn, rIn + 0.012, y + w / 2, y - w / 2), rect(rOut - 0.012, rOut, y + w / 2, y - w / 2)], GM.bearing(), { seg: 48 });
  const rm = (rIn + rOut) / 2, re = (rOut - rIn) / 2 - 0.012;
  const elems = cutPair((keep) => {
    const list = [];
    for (let i = 0; i < n; i++) {
      const phi = (i / n) * TAU;
      if (!keep(phi)) continue;
      if (balls) { const s = new THREE.SphereGeometry(re, 10, 8); const p = P3(rm, y, phi); s.translate(p.x, p.y, p.z); list.push(s); } else list.push(axialCyl(rm, y, phi, re, w * 0.9, 10));
    }
    return merge(list);
  }, GM.steel());
  return [races, elems];
}

export function buildCore(ctx) {
  const { P, T, lt, cut } = ctx;

  // ====================================================================== HP compressor
  const hpcStatorParts = [];
  const igv = cut(cutPair((keep) => coreRow({ ...ROWS.hpcIGV, rotor: false, stagger: [-6, -12], camber: -0.02, t: 0.07 }, keep), GM.titanium()));
  hpcStatorParts.push(P('HPC variable inlet guide vanes', {
    system: 'Propulsion', material: 'Titanium vanes on trunnions (count estimated)', mass: 18, count: ROWS.hpcIGV.count,
    explode: [-0.6, -0.7, 0], temp: 375,
    desc: 'The first of the HP compressor\'s variable rows. Each vane turns on a trunnion through the casing; closing them at low speed lowers the angle of attack on the front rotor blades so they do not stall.',
  }, igv));
  hpcStatorParts[0].userData.part.stationTemp = '25';

  ROWS.hpcRotors.forEach((r, i) => {
    const m = coreRotor({ ...r, stagger: [36, 54], t: [0.065, 0.045], gap: 0.0025, n: i < 4 ? 5 : 4 }, GM.ti6246(i));
    m.userData.temp = lt('25', '3', (i + 0.5) / 9);
    const g = new THREE.Group();
    g.add(m);
    ctx.spin.n2.push({ rotor: m });
    P(`HPC rotor ${i + 1}`, {
      system: 'Propulsion', material: i < 5 ? 'Titanium alloy blades' : 'Nickel-alloy blades', mass: Math.round(16 - i * 1.1), count: r.count,
      explode: [0, -0.7, 0],
      desc: i === 0
        ? 'First HP compressor stage, turning at N2 (100 % = 9,332 rpm, four times fan speed). Blade counts on this page are estimates; GE does not publish them.'
        : i === 8
          ? 'Ninth and last stage: blades only about 6 cm tall, because air at roughly 42 times ambient pressure takes up little room. Rear stages are nickel alloy since the air here is hotter than 600 °C.'
          : `HP compressor stage ${i + 1} rotor. Each of the nine stages adds a pressure ratio of about 1.38; the blades shrink stage by stage as the air densifies.`,
    }, g);
  });
  ROWS.hpcStators.forEach((r, i) => {
    const s = cut(cutPair((keep) => coreRow({ ...r, rotor: false, gap: 0.0025, n: 4 }, keep), r.variable ? GM.titanium() : GM.ti6246(i + 1)));
    const p = P(r.variable ? `HPC variable stator ${i + 1}` : `HPC stator ${i + 1}`, {
      system: 'Propulsion', material: r.variable ? 'Titanium vanes on trunnions (count estimated)' : 'Nickel-alloy vanes (count estimated)', mass: 8, count: r.count,
      explode: [-0.6, -0.7, 0],
      desc: r.variable
        ? `Variable stator row ${i + 1}: its vanes rotate together with the inlet guide vanes, scheduled on corrected core speed by the FADEC. GE does not publish how many HPC rows are variable on the -115B; the inlet guide vanes plus three rows are modelled, as on GE's other nine-stage cores.`
        : `Fixed stator row ${i + 1}: turns the flow leaving one rotor into the right direction for the next and recovers pressure.`,
    }, s);
    p.userData.part.stationTemp = '3';
    hpcStatorParts.push(p);
  });
  const ogv = cut(cutPair((keep) => coreRow({ ...ROWS.hpcOGV, rotor: false, stagger: [-4, -6], camber: -0.04, n: 4 }, keep), GM.ti6246(8)));
  P('HPC outlet guide vanes', {
    system: 'Propulsion', material: 'Nickel-alloy vanes (count estimated)', mass: 9, count: ROWS.hpcOGV.count,
    explode: [-0.6, -0.7, 0],
    desc: 'Take the last swirl out of the compressor delivery air before the diffuser slows it for the combustor.',
  }, ogv).userData.part.stationTemp = '3';

  // HPC rotor: nine disks bolted into a drum, split into the four life-limited pieces a shop
  // handles: stage 1 disk, stage 2–5 spool, stage 6 disk and stage 7–9 spool. Each piece carries
  // its share of the drum, knife-edge seal teeth under the stator rows and a bolted flange at its
  // aft joint.
  const hpcDisk = (r) => {
    const h = coreAt(r.y)[0];
    return [[h - 0.012, r.y + 0.03], [h, r.y + 0.03], [h, r.y - 0.03], [h - 0.012, r.y - 0.03], [h - 0.05, r.y - 0.012], [0.24, r.y - 0.01], [0.24, r.y - 0.03], [0.2, r.y - 0.03], [0.2, r.y + 0.03], [0.24, r.y + 0.03], [0.24, r.y + 0.01], [h - 0.05, r.y + 0.012]];
  };
  const hpcPiece = (i0, i1, y0, y1) => {
    const list = [lineWall(y0, y1, -0.022, -0.012, 0, 0.02)];
    for (let i = i0; i <= i1; i++) list.push(hpcDisk(ROWS.hpcRotors[i]));
    // seal teeth on the drum under each stator row inside this piece
    for (const s of ROWS.hpcStators) {
      if (s.y > y0 || s.y < y1) continue;
      const h = coreAt(s.y)[0] - 0.012;
      for (const dy of [0.008, -0.008]) list.push([[h, s.y + dy + 0.002], [h + 0.007, s.y + dy + 0.0008], [h + 0.007, s.y + dy - 0.0008], [h, s.y + dy - 0.002]]);
    }
    if (y1 > -3.03) { const h = coreAt(y1)[0]; list.push(rect(h - 0.036, h - 0.022, y1 + 0.006, y1 - 0.006)); }
    return list;
  };
  const hp = (i0, i1, y0, y1, mat) => cut(cutLathe(hpcPiece(i0, i1, y0, y1), mat(), { seg: 48 }));
  P('HPC stage 1 disk', {
    system: 'Propulsion', material: 'Forged titanium-alloy disk (life-limited part)', mass: 40,
    explode: [0, -0.7, 0], temp: 400,
    desc: 'The first HP-compressor disk, a single forging bolted to the front of the stage 2–5 spool and to the forward stub shaft. That stages 1 and 6 are single disks is inferred from the base GE90\'s parts list (disk 1, spool 2–6, disk 7, spool 8–10), from which the -115B dropped one front stage.',
  }, hp(0, 0, -2.13, -2.23, GM.titanium)).userData.part.stationTemp = '25';
  P('HPC stage 2–5 spool', {
    system: 'Propulsion', material: 'One-piece titanium-alloy spool of four disks and their spacer arms (life-limited part)', mass: 150,
    explode: [0, -0.7, 0], temp: 550,
    desc: 'Four disks machined as one drum. In 2013 cracks were found in the aft spacer arms of some stage 2–5 spools, growing hidden under the coating of the seal teeth, before the parts reached their published life; the FAA had them removed early (AD 2013-24-17).',
    callout: true, anchor: [-0.355, -2.45, 0],
  }, hp(1, 4, -2.23, -2.66, GM.titanium)).userData.part.stationTemp = '3';
  P('HPC stage 6 disk', {
    system: 'Propulsion', material: 'Nickel-alloy disk (life-limited part)', mass: 35,
    explode: [0, -0.7, 0], temp: 700,
    desc: 'A single disk between the two spools. Like every HP-compressor disk it is a life-limited part: it is retired after a fixed number of flight cycles, cracked or not, because a burst disk cannot be contained by the casing.',
  }, hp(5, 5, -2.66, -2.76, GM.nickel)).userData.part.stationTemp = '3';
  P('HPC stage 7–9 spool', {
    system: 'Propulsion', material: 'Powder-metallurgy nickel-superalloy spool (life-limited part)', mass: 135,
    explode: [0, -0.7, 0], temp: 850,
    desc: 'The hottest compressor stages, near 900 K at take-off (modelled), made as one spool of powder-metal nickel alloy. In 2023 GE found that some stage 7–9 spools, HPT disks and seals came from powder suspected to contain iron inclusions, and the FAA ordered them replaced (AD 2023-26-07).',
  }, hp(6, 8, -2.76, -3.04, GM.nickelDark)).userData.part.stationTemp = '3';

  // HPC casing with stage flanges and the variable-vane trunnion bosses
  const hpcCase = [lineWall(-2.06, -3.12, 0.003, 0.024, 1)];
  for (const y of [-2.06, -2.56, -3.12]) { const t = coreAt(y)[1]; hpcCase.push(rect(t + 0.02, t + 0.075, y + 0.012, y - 0.012)); }
  for (const r of [ROWS.hpcIGV, ...ROWS.hpcStators.filter((s) => s.variable)]) { const t = coreAt(r.y)[1]; hpcCase.push(rect(t + 0.022, t + 0.042, r.y + 0.02, r.y - 0.02)); }
  // outer bleed-manifold wall over the rear stages
  hpcCase.push([[0.56, -2.58], [0.575, -2.58], [0.575, -3.1], [0.5, -3.12], [0.5, -3.1], [0.56, -3.08]]);
  const casing = cut(cutLathe(hpcCase, GM.casing(), { seg: 56 }));
  P('HPC casing', {
    system: 'Structure', material: 'Steel front casing, nickel-alloy rear casing', mass: 310,
    explode: [-0.6, -0.7, 0], temp: 600,
    desc: 'Holds the stator rows and contains roughly 4 MPa at the back. On GE engines it is split along the horizontal centreline so the casing halves lift off for blade inspection. Ports tap air for the aircraft bleed system and turbine cooling.',
  }, casing).userData.part.stationTemp = '3';

  // variable stator vane actuation: unison rings, lever arms, crank shaft and two actuators
  const vsvRows = [ROWS.hpcIGV, ...ROWS.hpcStators.filter((s) => s.variable)];
  const vsv = (keep) => {
    const list = [];
    for (const r of vsvRows) {
      const t = coreAt(r.y)[1];
      list.push(hoop(t + 0.08, r.y - 0.02, 0.008, { tubular: 48, start: keep.start, arc: keep.arc }));
      for (let i = 0; i < 36; i++) {
        const phi = (i / 36) * TAU;
        if (!keep(phi)) continue;
        list.push(boxAt(t + 0.06, r.y - 0.01, phi, [0.04, 0.03, 0.008]));
      }
    }
    for (const phi of [0.35, 0.35 + Math.PI]) {
      if (!keep(phi)) continue;
      const t0 = coreAt(-2.1)[1];
      list.push(axialCyl(t0 + 0.13, -2.32, phi, 0.028, 0.34), axialCyl(t0 + 0.13, -2.1, phi, 0.012, 0.16));
      list.push(axialCyl(t0 + 0.105, -2.22, phi + 0.09, 0.012, 0.36));
      for (const r of vsvRows) list.push(boxAt(coreAt(r.y)[1] + 0.09, r.y - 0.02, phi + 0.09, [0.05, 0.015, 0.015]));
    }
    return merge(list);
  };
  const vsvGrp = cut(cutPair(vsv, GM.steel()));
  P('VSV actuators & unison rings', {
    system: 'Propulsion', material: 'Steel unison rings and levers, fuel-powered actuators', mass: 48, count: 2,
    explode: [-0.85, -0.7, 0.25], temp: 380,
    desc: 'Two actuators, powered by high-pressure fuel from the hydromechanical unit, swing a crank shaft that turns every unison ring; each ring rotates all the vanes of its row through small lever arms. This keeps the front stages away from stall and surge across the whole speed range.',
  }, vsvGrp);

  // ====================================================================== compressor rear frame
  // the outer pressure casing (combustion case) is its own life-limited part; the frame inside it
  // is the diffuser, the inner ring and the struts between them
  const ccase = cut(cutLathe([rect(0.735, 0.755, -3.08, -3.74), rect(0.755, 0.8, -3.08, -3.1), rect(0.755, 0.8, -3.72, -3.74),
    // stiffening lands either side of the fuel-nozzle bosses
    rect(0.755, 0.765, -3.24, -3.25), rect(0.755, 0.765, -3.335, -3.345)], GM.casing(), { seg: 72 }));
  // bosses: 30 fuel-nozzle pads, two igniter bosses, the T3 probe and PS3 tap bosses
  const NOZ_N = 30, IGN_PHI = [0.62, 2.52];
  const caseBosses = cut(cutPair((keep) => {
    const list = [];
    for (let i = 0; i < NOZ_N; i++) { const phi = (i / NOZ_N) * TAU; if (keep(phi)) list.push(radialCyl(0.75, 0.759, -3.29, phi, 0.042, 10)); }
    for (const phi of IGN_PHI) if (keep(phi)) list.push(radialCyl(0.75, 0.77, -3.43, phi, 0.03, 10));
    for (const [y, phi] of [[-3.2, 0.78], [-3.12, 0.85]]) if (keep(phi)) list.push(radialCyl(0.75, 0.765, y, phi, 0.02, 8));
    return merge(list);
  }, GM.casing()));
  P('Combustion case', {
    system: 'Structure', material: 'Nickel-alloy pressure casing (life-limited part)', mass: 210,
    explode: [-0.6, -1.0, 0], temp: 900,
    desc: 'The outer wall of the combustor section, a pressure vessel holding about 4.2 MPa at take-off (modelled) and carrying the fuel nozzles, igniters and borescope ports in its bosses. It is life-limited: in 2018 the FAA had cases with a supplier\'s unapproved weld repairs removed from service (AD 2018-20-22).',
  }, [ccase, caseBosses]).userData.part.stationTemp = '3';

  const crf = [
    rect(0.405, 0.42, -3.1, -3.7),
    // diffuser walls
    [[0.476, -3.11], [0.49, -3.11], [0.54, -3.26], [0.525, -3.26]], [[0.418, -3.11], [0.426, -3.11], [0.44, -3.26], [0.43, -3.26]],
  ];
  const crfRings = cut(cutLathe(crf, GM.casing(), { seg: 72 }));
  // abradable land the rotating CDP seal's teeth run against
  const cdpLand = cut(cutLathe(rect(0.4035, 0.4055, -3.6, -3.7), GM.rubStrip(), { seg: 48, caps: false }));
  const crfStruts = cut(cutPair((keep) => ring(bladeGeometry({ rHub: 0.42, rTip: 0.74, chord: 0.11, stagger: 0, t: 0.28, camber: 0, y: -3.18, stations: 1, n: 6 }), 20, { keep }), GM.casing()));
  P('Compressor rear frame', {
    system: 'Structure', material: 'Cast nickel-alloy diffuser, inner ring and struts (strut count estimated)', mass: 170, count: 20,
    explode: [0, -1.0, 0], temp: 900,
    desc: 'Inside the combustion case: the diffuser that slows the compressor delivery air to about Mach 0.3 for the flame, and struts that tie the inner ring to the case and duct air and service lines inwards. Its inner ring carries the stationary land of the compressor-discharge-pressure seal. Whether it also carries a bearing on the -115B is not published.',
  }, [crfRings, cdpLand, crfStruts]).userData.part.stationTemp = '3';

  // ====================================================================== dual annular combustor
  // liners: outer (beside the pilot dome), inner (beside the main dome) and the centre body
  // between the domes, each with rows of dilution holes (dark discs through the wall)
  const holes = (rIn, rOut, ys, n, rad) => cut(cutPair((keep) => {
    const list = [];
    ys.forEach((y, k) => { for (let i = 0; i < n; i++) { const phi = ((i + (k % 2) * 0.5) / n) * TAU; if (keep(phi)) list.push(radialCyl(rIn, rOut, y, phi, rad, 6)); } });
    return merge(list);
  }, GM.hole()));
  const outerLiner = cut(cutLathe([[0.664, -3.34], [0.672, -3.34], [0.68, -3.42], [0.673, -3.52], [0.648, -3.62], [0.622, -3.71], [0.614, -3.71], [0.64, -3.62], [0.665, -3.52], [0.672, -3.42]], GM.liner(), { seg: 80 }));
  P('Combustor outer liner (pilot)', {
    system: 'Propulsion', material: 'Nickel / cobalt-alloy sheet with thermal-barrier coating', mass: 55,
    explode: [0, -1.0, 1.45], temp: 1300,
    desc: 'The outer wall of the flame zone, beside the pilot dome. Rows of dilution holes let in jets of compressor air that finish the burning and cool the gas to a temperature profile the turbine can survive; thousands of tiny film holes keep the wall itself cool.',
  }, [outerLiner, holes(0.662, 0.684, [-3.47, -3.57], 36, 0.008)]).userData.part.stationTemp = '4';
  const innerLiner = cut(cutLathe([[0.438, -3.34], [0.446, -3.34], [0.444, -3.42], [0.455, -3.52], [0.48, -3.62], [0.508, -3.71], [0.5, -3.71], [0.472, -3.62], [0.447, -3.52], [0.436, -3.42]], GM.liner(), { seg: 80 }));
  P('Combustor inner liner (main)', {
    system: 'Propulsion', material: 'Nickel / cobalt-alloy sheet with thermal-barrier coating', mass: 45,
    explode: [0, -1.0, 0.95], temp: 1300,
    desc: 'The inner wall of the flame zone, beside the main dome, with its own rows of dilution holes. The main dome only lights above idle, so at low power this side of the combustor runs on air alone.',
  }, [innerLiner, holes(0.436, 0.456, [-3.47, -3.57], 36, 0.007)]).userData.part.stationTemp = '4';
  const centerbody = cut(cutLathe([[0.548, -3.3], [0.562, -3.3], [0.56, -3.44], [0.555, -3.48], [0.55, -3.44]], GM.liner(), { seg: 80 }));
  P('Combustor centerbody', {
    system: 'Propulsion', material: 'Cooled nickel-alloy ring', mass: 20,
    explode: [0, -1.0, 1.2], temp: 1300,
    desc: 'The ring between the two domes that divides the front of the combustor into two annular flame zones, so the pilot and main burners can be fuelled separately: the pilot ring alone at idle cuts smoke and unburnt hydrocarbons, the main ring joins at high power for low NOx.',
  }, centerbody).userData.part.stationTemp = '4';
  const burnerMat = M.burner().clone();
  ctx.burnerMat = burnerMat;
  const flame = cut(cutLathe([[0.452, -3.36], [0.546, -3.36], [0.555, -3.47], [0.564, -3.36], [0.66, -3.36], [0.662, -3.52], [0.638, -3.62], [0.612, -3.69], [0.51, -3.69], [0.478, -3.62], [0.456, -3.52]], burnerMat, { seg: 80, capMat: burnerMat }));
  flame.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.userData.temp = () => T['4']; } });
  P('Dual annular combustor', {
    system: 'Propulsion', material: 'Combustion gas in the two annular flame zones (shown glowing)', mass: null,
    explode: [0, -1.0, 1.2],
    desc: 'Two rings of burners, one above the other: the outer pilot dome burns alone at idle for low smoke and hydrocarbons, and the inner main dome joins in at high power, keeping the flame lean and short to cut NOx; GE says hydrocarbons stay well under the international limit. At take-off the gas leaves at about 1,740 K (modelled), some 150 K above the roughly 1,600 K at which the turbine alloys melt; in the hottest streaks it is hotter still.',
    callout: true, anchor: [0.57, -3.5, 0.33],
  }, flame).userData.part.stationTemp = '4';

  const domes = cut(cutLathe([rect(0.562, 0.668, -3.33, -3.345), rect(0.442, 0.548, -3.33, -3.345),
    [[0.66, -3.33], [0.69, -3.3], [0.67, -3.27], [0.6, -3.27], [0.56, -3.3]], [[0.55, -3.3], [0.51, -3.27], [0.45, -3.27], [0.428, -3.3], [0.44, -3.33]]], GM.nickel(), { seg: 80 }));
  const cups = cut(cutPair((keep) => {
    const list = [];
    for (let i = 0; i < 30; i++) {
      const phi = (i / 30) * TAU;
      if (!keep(phi)) continue;
      list.push(axialCyl(0.615, -3.335, phi, 0.024, 0.05, 14), axialCyl(0.495, -3.335, phi, 0.024, 0.05, 14));
    }
    return merge(list);
  }, GM.nickelDark()));
  P('Combustor domes & swirl cups', {
    system: 'Propulsion', material: 'Nickel-alloy domes and swirlers', mass: 60, count: 60,
    explode: [0, -1.0, 1.05], temp: 900,
    desc: 'Each of the two domes carries 30 swirl cups (count estimated). Swirlers spin the incoming air so a ring of recirculating gas holds the flame in place at airflows that would otherwise blow it out.',
  }, [domes, cups]).userData.part.stationTemp = '3';

  // fuel nozzles: one stem per pilot/main pair, entering through the frame's outer wall
  const nozzles = cut(cutPair((keep) => {
    const list = [];
    for (let i = 0; i < 30; i++) {
      const phi = (i / 30) * TAU;
      if (!keep(phi)) continue;
      list.push(radialCyl(0.49, 0.8, -3.295, phi, 0.011, 8));
      list.push(axialCyl(0.615, -3.31, phi, 0.013, 0.04, 8), axialCyl(0.495, -3.31, phi, 0.013, 0.04, 8));
      list.push(boxAt(0.768, -3.29, phi, [0.018, 0.06, 0.07]));
      list.push(radialCyl(0.8, 0.86, -3.275, phi, 0.008, 6), radialCyl(0.8, 0.885, -3.31, phi + 0.02, 0.008, 6));
    }
    return merge(list);
  }, GM.steel()));
  P('Fuel nozzles', {
    system: 'Fuel', material: 'Stainless steel stems, dual-orifice tips', mass: 45, count: 30,
    explode: [0, -1.0, 0],
    desc: 'Each nozzle stem carries two fuel circuits, one for a pilot cup and one for a main cup, spraying atomised kerosene into the swirlers. At take-off the engine burns about 4.6 kg of fuel a second (ICAO emissions databank). The count of 30 is an estimate; GE does not publish it.',
  }, nozzles).userData.part.stationTemp = '3';

  const manifold = cut(cutPair((keep) => {
        return merge([hoop(0.86, -3.275, 0.012, { start: keep.start, arc: keep.arc, tubular: 80 }), hoop(0.885, -3.31, 0.012, { start: keep.start, arc: keep.arc, tubular: 80 })]);
  }, GM.steel()));
  P('Fuel manifolds', {
    system: 'Fuel', material: 'Stainless-steel tubing', mass: 22, count: 2,
    explode: [0, -1.0, 0], temp: 420,
    desc: 'Two rings round the combustor case, one feeding the pilot circuits and one the main circuits, fed at a tee where the metered-fuel line arrives from the fan case. The FADEC stages fuel between them through the hydromechanical unit.',
  }, [manifold, mesh(merge([boxAt(0.874, -3.282, FEED_PHI, [0.045, 0.075, 0.05]), radialCyl(0.852, 0.862, -3.25, FEED_PHI, 0.016, 10)]), GM.steel())]);
  P('Fuel manifold pressure sensor', {
    system: 'Sensors', material: 'Kulite strain-gauge pressure transducer', mass: 0.4,
    explode: [0.15, -1.0, 0.3], temp: 420,
    desc: 'Reports the pressure in the nozzle manifolds to the FADEC, which uses it to check the fuel staging between pilot and main circuits and to spot a blocked or leaking nozzle. All 4.59 kg/s of take-off fuel (ICAO databank) flows past it.',
  }, mesh(merge([radialCyl(0.897, 0.935, -3.262, FEED_PHI, 0.014, 10), radialCyl(0.935, 0.95, -3.262, FEED_PHI, 0.011, 6), boxAt(0.93, -3.3, FEED_PHI, [0.02, 0.03, 0.03])]), GM.connector()));

  const igniters = cut(cutPair((keep) => merge([0.62, 2.52].filter((p) => keep(p)).flatMap((phi) => [radialCyl(0.672, 0.82, -3.43, phi, 0.012, 10), boxAt(0.835, -3.43, phi, [0.04, 0.05, 0.05])])), GM.steel()));
  P('Igniters', {
    system: 'Electrical', material: 'Surface-discharge spark plugs', mass: 3, count: 2,
    explode: [0.4, -1.0, 0.5], temp: 700,
    desc: 'Two igniter plugs reach through the outer liner. They spark only to light the combustor at start or as a precaution in heavy rain, ice or turbulence; once lit, the flame sustains itself.',
  }, igniters);

  // ====================================================================== HP turbine
  const hptT = [() => T['4'] * 0.97, lt('4', '45', 0.35), lt('4', '45', 0.6), lt('4', '45', 0.85)];
  ROWS.hptNozzles.forEach((r, i) => {
    const vanes = cut(cutPair((keep) => coreRow({ ...r, rotor: false, stagger: [-48, -52], t: [0.22, 0.2], camber: -0.14, gap: 0, n: 7 }, keep), GM.tbc()));
    const bands = cut(cutLathe([rect(coreAt(r.y)[0] - 0.014, coreAt(r.y)[0], r.y + 0.045, r.y - 0.045), rect(coreAt(r.y)[1], coreAt(r.y)[1] + 0.014, r.y + 0.045, r.y - 0.045)], GM.nickelDark(), { seg: 64 }));
    vanes.traverse((o) => { if (o.isMesh) o.userData.temp = hptT[i * 2]; });
    P(`HPT stage ${i + 1} nozzle`, {
      system: 'Propulsion', material: 'Single-crystal nickel vanes, thermal-barrier coated (count estimated)', mass: 40, count: r.count,
      explode: [-0.6, -1.25, 0], temp: 1500,
      desc: i === 0
        ? 'The hottest metal in the engine: these vanes face combustor gas directly and accelerate it to near sonic speed, turning it onto the first rotor. Compressor air flows through internal passages and out of rows of film-cooling holes.'
        : 'Second-stage nozzle guide vanes, also air-cooled, re-turn the flow for the second rotor.',
    }, [vanes, bands]).userData.part.stationTemp = i === 0 ? '4' : '45';
  });
  ROWS.hptBlades.forEach((r, i) => {
    const m = coreRotor({ ...r, stagger: [34, 40], t: [0.2, 0.14], camber: 0.16, gap: 0.002, n: 7 }, GM.tbc());
    m.userData.temp = hptT[i * 2 + 1];
    const g = new THREE.Group();
    g.add(m);
    ctx.spin.n2.push({ rotor: m });
    P(`HPT stage ${i + 1} blades`, {
      system: 'Propulsion', material: 'Single-crystal nickel superalloy, thermal-barrier coated (count estimated)', mass: 30, count: r.count,
      explode: [0, -1.25, 0],
      desc: i === 0
        ? 'Each blade is cast as a single crystal with no grain boundaries to creep along, coated with ceramic and cooled from inside by compressor air that is itself above 600 °C. The gas reaching them averages about 1,740 K at take-off (modelled), some 150 K above the roughly 1,600 K at which the alloy melts, and its hot streaks run hotter (the rotor sees a little less, because it moves with the flow); each blade also pulls with tonnes of centrifugal force.'
        : 'Second HPT stage. Between them, the two HPT stages extract the roughly 100 MW the HP compressor absorbs at take-off (modelled).',
    }, g);
  });
  // HPT rotor, as the shop splits it: forward rotor seal (cooling plate), stage 1 disk, interstage
  // seal and stage 2 disk, all life-limited powder-metal nickel parts
  const hptDiskProf = (r) => {
    const h = coreAt(r.y)[0];
    return [[h - 0.04, r.y + 0.035], [h, r.y + 0.035], [h, r.y - 0.035], [h - 0.04, r.y - 0.035], [0.32, r.y - 0.025], [0.22, r.y - 0.05], [0.18, r.y - 0.05], [0.18, r.y + 0.05], [0.22, r.y + 0.05], [0.32, r.y + 0.025]];
  };
  const PM = 'Powder-metallurgy nickel superalloy (life-limited part)';
  P('Forward HPT rotor seal', {
    system: 'Propulsion', material: PM, mass: 30,
    explode: [0, -1.25, 0.35], temp: 850,
    desc: 'A cooling plate bolted to the front of the stage 1 disk: it seals the compressor-discharge air fed to the turbine and meters it up into the blade roots. It is one of the powder-metal parts the FAA had replaced in 2024 over suspected iron inclusions (AD 2023-26-07).',
  }, cut(cutLathe([[[0.4, -3.775], [0.47, -3.81], [0.47, -3.82], [0.395, -3.79]], rect(0.385, 0.405, -3.775, -3.79)], GM.nickelDark(), { seg: 48 }))).userData.part.stationTemp = '45';
  P('HPT stage 1 disk', {
    system: 'Propulsion', material: PM, mass: 95,
    explode: [0, -1.25, 0], temp: 900,
    desc: 'Holds the 72 stage-1 blades (count estimated) in fir-tree slots broached into its rim. Each blade pulls with several tonnes at take-off, so the disk is thick at the bore, where the hoop stress is highest.',
  }, cut(cutLathe(hptDiskProf(ROWS.hptBlades[0]), GM.nickelDark(), { seg: 48 }))).userData.part.stationTemp = '45';
  // interstage seal: rim ring with knife-edge teeth under the stage 2 nozzle, and a web to a bore
  // boss, pierced by a ring of web holes that feed cooling air outwards
  const IS_Y = -3.94, WEB_HOLE_R = 0.33;
  const isProf = [rect(0.43, 0.47, -3.89, -3.99), rect(0.27, 0.43, IS_Y + 0.006, IS_Y - 0.006), rect(0.25, 0.275, IS_Y + 0.016, IS_Y - 0.016)];
  for (const dy of [0.025, 0, -0.025]) isProf.push([[0.47, IS_Y + dy + 0.006], [0.483, IS_Y + dy + 0.0015], [0.483, IS_Y + dy - 0.0015], [0.47, IS_Y + dy - 0.006]]);
  const webHoles = cut(cutPair((keep) => {
    const list = [];
    for (let i = 0; i < 18; i++) { const phi = ((i + 0.5) / 18) * TAU; if (keep(phi)) list.push(axialCyl(WEB_HOLE_R, IS_Y, phi, 0.01, 0.0135, 10)); }
    return merge(list);
  }, GM.hole()));
  P('Interstage HPT rotor seal', {
    system: 'Propulsion', material: PM, mass: 40,
    explode: [0, -1.25, 0.6], temp: 900,
    desc: 'Rides between the two HPT disks and holds the stage 2 cooling air in, with knife-edge teeth sealing against the stage 2 nozzle. On 19 October 2019 a 777\'s GE90-115B failed during take-off when high-cycle-fatigue cracks grew from these web holes until the seal\'s rim broke away; debris went through the fuselage and into the other engine (FAA ADs 2019-21-51 and 2024-06-15).',
  }, [cut(cutLathe(isProf, GM.nickelDark(), { seg: 48 })), webHoles]).userData.part.stationTemp = '45';
  P('HPT stage 2 disk', {
    system: 'Propulsion', material: PM, mass: 85,
    explode: [0, -1.25, -0.2], temp: 880,
    desc: 'Carries the stage 2 blades and, through a cone on its aft face, the HP spool\'s aft stub shaft into the #4 bearing. In 2022 the FAA cut the life limit of some stage 2 disks, interstage seals and rotating CDP seals after melt-related "freckles" were found in their forgings (AD 2022-18-06).',
  }, cut(cutLathe(hptDiskProf(ROWS.hptBlades[1]), GM.nickelDark(), { seg: 48 }))).userData.part.stationTemp = '45';
  const hptCase = cut(cutLathe([lineWall(-3.78, -4.06, 0.006, 0.03, 1, 0.03), rect(0.7, 0.722, -3.72, -4.06), rect(0.722, 0.77, -3.72, -3.74), rect(0.722, 0.77, -4.048, -4.06), [[0.65, -3.8], [0.7, -3.78], [0.7, -3.8], [0.66, -3.82]], [[0.662, -4.03], [0.7, -4.02], [0.7, -4.04], [0.667, -4.05]]], GM.casing(), { seg: 72 }));
  P('HPT casing & shrouds', {
    system: 'Structure', material: 'Nickel-alloy case, ceramic-coated shroud segments', mass: 150,
    explode: [-0.6, -1.25, 0], temp: 950,
    desc: 'Shroud segments ride a few tenths of a millimetre outside the blade tips. Every extra 0.25 mm of tip gap costs roughly 1 % in fuel burn, which is why the case is actively cooled to shrink it at cruise.',
  }, hptCase).userData.part.stationTemp = '45';
  const hptAcc = cut(cutPair((keep) => {
        const list = [hoop(0.745, -3.84, 0.013, { start: keep.start, arc: keep.arc }), hoop(0.745, -3.98, 0.013, { start: keep.start, arc: keep.arc })];
    if (keep(0.95)) {
      list.push(tube([P3(0.95, -3.1, 0.95), P3(0.9, -3.4, 0.95), P3(0.8, -3.7, 0.95), P3(0.745, -3.84, 0.95)], 0.02, { seg: 24 }));
      list.push(axialCyl(0.95, -3.05, 0.95, 0.04, 0.12, 14));
      list.push(tube([P3(0.745, -3.84, 0.95), P3(0.76, -3.91, 0.95), P3(0.745, -3.98, 0.95)], 0.013, { seg: 12 }));
    }
    return merge(list);
  }, GM.duct()));
  P('HPT active clearance control', {
    system: 'Thermal control', material: 'Stainless manifolds and FADEC-controlled valve', mass: 18,
    explode: [-0.95, -1.25, 0.3], temp: 500,
    desc: 'Spray rings that blow cooler air onto the HPT case. In cruise the FADEC opens the valve, the case shrinks onto the blade tips and the tip gap closes; at take-off it stays shut so a hot, growing rotor cannot rub.',
  }, hptAcc);

  // ====================================================================== turbine center frame
  // The GE90's mid-engine frame (GE patent EP 1 149 987 / US 6,358,001): 12 hollow struts, each
  // bolted to the outer case by eight bolts and a shear bolt, carry the aft HP-turbine bearing's
  // load from the hub and conical sump out to the casing; fairings shield them from the gas.
  const { y0: TCF_Y0, y1: TCF_Y1, ym: TCF_YM, struts: TCF_N } = TCF;
  const tcfPhi = (k) => Math.PI / 2 + (k / TCF_N) * TAU;           // struts at multiples of 30°, one at 6 o'clock
  const [tcfHub, tcfTip] = coreAt(TCF_YM);
  const tcfRings = cut(cutLathe([
    rect(0.7, 0.72, TCF_Y0, TCF_Y1), rect(0.72, 0.77, TCF_Y0, TCF_Y0 - 0.012), rect(0.72, 0.77, TCF_Y1 + 0.012, TCF_Y1),
    // the two continuous stiffening ribs either side of the strut collars
    rect(0.72, 0.737, -4.08, -4.087), rect(0.72, 0.737, -4.143, -4.15),
    rect(0.488, 0.512, -4.07, -4.165),                                 // hub ring
  ], GM.casing(), { seg: 72 }));
  const tcfLiners = cut(cutLathe([lineWall(TCF_Y0, TCF_Y1, 0, 0.006, 1, 0.02), lineWall(TCF_Y0, TCF_Y1, -0.006, 0, 0, 0.02)], GM.fairing(), { seg: 72 }));
  const tcfFairings = cut(cutPair((keep) => ring(bladeGeometry({ rHub: tcfHub - 0.004, rTip: tcfTip + 0.004, chord: 0.09, stagger: 0, t: 0.34, camber: 0, y: TCF_YM, stations: 1, n: 8 }), TCF_N, { keep }), GM.fairing()));
  const tcfStruts = cut(cutPair((keep) => {
    const list = [];
    for (let k = 0; k < TCF_N; k++) {
      const phi = tcfPhi(k);
      if (!keep(phi)) continue;
      list.push(boxAt(0.61, TCF_YM, phi, [0.22, 0.05, 0.016]));                       // hollow strut, hub to case
      list.push(boxAt(0.729, -4.115, phi, [0.018, 0.054, 0.08]));                     // collar on the case
      // eight bolts round the collar and a shear bolt in its middle
      for (const [dy, dt] of [[0.018, -0.03], [0.018, -0.01], [0.018, 0.01], [0.018, 0.03], [-0.018, -0.03], [-0.018, -0.01], [-0.018, 0.01], [-0.018, 0.03], [0, 0]]) {
        list.push(radialCyl(0.738, 0.745, -4.115 + dy, phi + dt / 0.738, dt === 0 && dy === 0 ? 0.007 : 0.0045, 6));
      }
    }
    return merge(list);
  }, GM.casingDark()));
  P('Turbine center frame', {
    system: 'Structure', material: 'Nickel-alloy case and hub, 12 bolted hollow struts with sheet-metal fairings', mass: 180, count: 12,
    explode: [-0.25, -1.4, 0], temp: 1100,
    desc: 'The GE90\'s mid-engine frame between the HP and LP turbines. Twelve hollow struts, each bolted to the outer case with eight bolts and a shear bolt, carry the aft HP-turbine bearing\'s load out to the casing, while fairings shield them from gas at about 1,270 K (modelled). Tubes inside the struts serve that bearing, and air piped through them purges the HP and LP turbine rotor cavities (GE patent EP 1 149 987).',
    callout: true, anchor: [0.0, -4.11, 0.72],
  }, [tcfRings, tcfLiners, tcfFairings, tcfStruts]).userData.part.stationTemp = '45';

  // TCF sump: the conical sump member from the hub to the bearing housing, with its seals
  const TCF_BRG_Y = TCF.bearingY;
  P('TCF sump & bearing housing', {
    system: 'Drive system', material: 'Steel bearing housing and conical sump member, carbon and labyrinth seals', mass: 45,
    explode: [0, -1.4, 0.45], temp: 700,
    desc: 'A cone from the frame\'s hub carries the housing of the #4 bearing at its centre. The housing is an oil-wetted sump closed by seals at both ends and pressurised from outside with buffer air, so oil cannot reach the 1,000 K cavities around it.',
  }, cut(cutLathe([
    [[0.2, -4.12], [0.2, -4.132], [0.488, -4.168], [0.488, -4.156]],
    rect(0.19, 0.2, -4.098, -4.162),
    rect(0.146, 0.2, -4.098, -4.104), rect(0.146, 0.2, -4.156, -4.162),
    rect(0.1435, 0.146, -4.092, -4.104), rect(0.1435, 0.146, -4.156, -4.168),
  ], GM.casingDark(), { seg: 48 })));

  // oil supply and scavenge tubes through the struts at 6 and 7 o'clock, joining the core oil lines
  const SUP_PHI = tcfPhi(0), SCV_PHI = tcfPhi(1);
  const strutRun = (phi, from) => [...from, P3(0.78, TCF_YM, phi), P3(0.7, TCF_YM, phi), P3(0.54, TCF_YM, phi), P3(0.48, -4.142, phi), P3(0.34, -4.133, phi), P3(0.215, -4.118, phi)];
  P('TCF bearing service tubes', {
    system: 'Drive system', material: 'Stainless oil tubes inside the hollow struts', mass: 4, count: 2,
    explode: [0.45, -1.4, 0.25], temp: 650,
    desc: 'An oil-supply tube and a larger scavenge tube run down through two of the hollow frame struts to the #4 bearing\'s sump; GE\'s patent describes tubes within the struts "which service the aft HPT bearing". A jet at the end of the supply tube sprays the bearing.',
  }, mesh(merge([
    tube(strutRun(SUP_PHI, [P3(0.95, -3.86, 1.6), P3(0.9, -3.98, 1.59), P3(0.84, -4.07, SUP_PHI)]), 0.006, { seg: 48, radial: 6 }),
    tube(strutRun(SCV_PHI, [P3(0.95, -3.86, 2.05), P3(0.9, -3.98, 2.07), P3(0.84, -4.07, SCV_PHI)]), 0.008, { seg: 48, radial: 6 }),
    axialCyl(0.212, -4.116, SUP_PHI, 0.008, 0.02, 8),
  ]), GM.oil()));
  P('TCF accelerometer', {
    system: 'Sensors', material: 'Vibro-Meter piezoelectric accelerometer on a mounting pad', mass: 0.5,
    explode: [-0.6, -1.4, 0.35], temp: 600,
    desc: 'One of the -115B\'s two vibration sensors, bolted to the turbine center frame\'s case, where it hears the HP and LP turbines\' once-per-revolution vibration close to their bearing. Its lead joins the core harness to the FADEC.',
  }, mesh(merge([boxAt(0.744, -4.1, 0.64, [0.045, 0.045, 0.04]), radialCyl(0.766, 0.78, -4.1, 0.64, 0.009, 8)]), GM.connector()));

  // ====================================================================== LP turbine
  ROWS.lptNozzles.forEach((r, i) => {
    const vanes = cut(cutPair((keep) => coreRow({ ...r, rotor: false, stagger: [-40, -46], t: [0.14, 0.1], camber: -0.12, gap: 0.004, stations: 2, n: 5 }, keep), GM.heat(i / 5)));
    vanes.traverse((o) => { if (o.isMesh) o.userData.temp = lt('45', '5', (i + 0.1) / 6); });
    P(`LPT stage ${i + 1} nozzle`, {
      system: 'Propulsion', material: 'Cast nickel-alloy vane segments (count estimated)', mass: 55 + i * 10, count: r.count,
      explode: [-0.6, -1.55, 0],
      desc: i === 0
        ? 'First LP turbine vanes; EGT (the GE90\'s T49) is measured just ahead of them, because the HP turbine inlet is too hot for thermocouples. The -115B take-off EGT limit is 1,090 °C.'
        : `LP turbine nozzle ${i + 1}. The flow path widens through the six stages as the gas expands towards ambient pressure.`,
    }, vanes).userData.part.stationTemp = '45';
  });
  ROWS.lptBlades.forEach((r, i) => {
    const bo = { ...r, stagger: [32, 40], t: [0.12, 0.06], camber: 0.12, gap: 0.004, stations: 2, n: 5 };
    let m;
    if (i === 5) {
      // stage 6: the interlocking Z-notch faces of the tip shrouds, one between each pair of blades
      const tipR = coreAt(r.y)[1], pitch = TAU / r.count;
      const notch = new THREE.BoxGeometry(0.005, r.chord * 0.7, 0.003).rotateX(0.65).translate(tipR - 0.0045, r.y, 0).rotateY(pitch / 2);
      m = rotorRow(merge([coreBlade(bo), notch]), r.count, GM.heat(0.2 + i * 0.12));
    } else m = coreRotor(bo, GM.heat(0.2 + i * 0.12));
    m.userData.temp = lt('45', '5', (i + 0.6) / 6);
    const g = new THREE.Group();
    g.add(m);
    ctx.spin.n1.push({ rotor: m });
    const tip = coreAt(r.y)[1];
    const shroud = cut(cutLathe(rect(tip - 0.01, tip - 0.003, r.y + r.chord * 0.4, r.y - r.chord * 0.4), GM.heat(0.2 + i * 0.12), { seg: 64 }));
    P(`LPT stage ${i + 1} blades`, {
      system: 'Propulsion', material: 'Cast nickel-superalloy blades with interlocking tip shrouds (count estimated)', mass: 50 + i * 12, count: r.count,
      explode: [0, -1.55, 0],
      desc: i === 5
        ? 'Last and largest LPT stage, about 33 cm tall; the six stages together turn the fan and booster at N1 (100 % = 2,355 rpm). After eight single-blade separations on GE90-115Bs, traced to wear of the interlocking Z-notch faces where neighbouring tip shrouds lock together, the FAA required repeat inspections of these blades and their replacement at the next shop visit (AD 2009-25-14).'
        : `LP turbine stage ${i + 1}. Tip shrouds on neighbouring blades lock together into a ring that damps vibration and seals the tip gap.`,
    }, [g, shroud]);
  });
  // LP turbine rotor: six disks, each its own life-limited part, bolted into one drum; each disk
  // carries its share of the drum and a bolted flange at its aft joint
  const LPT_Y = ROWS.lptBlades.map((r) => r.y);
  const lptB = [-4.22, ...LPT_Y.slice(1).map((y, i) => (y + LPT_Y[i]) / 2), -5.12];
  ROWS.lptBlades.forEach((r, i) => {
    const h = coreAt(r.y)[0];
    const prof = [lineWall(lptB[i], lptB[i + 1], -0.03, -0.018, 0, 0.03),
      [[h - 0.02, r.y + 0.03], [h, r.y + 0.03], [h, r.y - 0.03], [h - 0.02, r.y - 0.03], [h - 0.05, r.y - 0.01], [0.3, r.y - 0.01], [0.3, r.y - 0.025], [0.26, r.y - 0.025], [0.26, r.y + 0.025], [0.3, r.y + 0.025], [0.3, r.y + 0.01], [h - 0.05, r.y + 0.01]]];
    if (i < 5) { const hj = coreAt(lptB[i + 1])[0]; prof.push(rect(hj - 0.044, hj - 0.03, lptB[i + 1] + 0.006, lptB[i + 1] - 0.006)); }
    if (i === 3) prof.push(rect(0.28, 0.312, -4.787, -4.797));          // flange for the LPT cone shaft
    P(`LPT stage ${i + 1} disk`, {
      system: 'Propulsion', material: 'Forged nickel-alloy disk (life-limited part)', mass: 70 + i * 12,
      explode: [0, -1.55, 0], temp: 800,
      desc: i === 0
        ? 'First of the six LP-turbine disks ("LPTR Disk, Stage 1" to "Stage 6" in GE\'s life-limited parts list), each bolted to the next through the drum arms so the six turn as one rotor.'
        : i === 3
          ? 'Stage 4 disk: the LPT cone shaft bolts to a flange on its bore, so all the power for the fan and booster, about 90 MW at take-off (modelled), leaves the turbine drum here.'
          : `LP-turbine stage ${i + 1} disk, a life-limited forging retired after a fixed number of flight cycles.`,
    }, cut(cutLathe(prof, GM.nickelDark(), { seg: 48 }))).userData.part.stationTemp = '5';
  });
  const lptCase = [lineWall(-4.17, -5.13, 0.006, 0.026, 1), (() => { const t = coreAt(-4.17)[1]; return rect(t + 0.02, t + 0.065, -4.17, -4.182); })()];
  for (const y of [-4.52, -4.85, -5.13]) { const t = coreAt(y)[1]; lptCase.push(rect(t + 0.02, t + 0.065, y + 0.012, y - 0.012)); }
  const lptC = cut(cutLathe(lptCase, GM.casing(), { seg: 64 }));
  P('LPT casing', {
    system: 'Structure', material: 'Nickel-alloy conical case', mass: 420,
    explode: [-0.6, -1.55, 0], temp: 750,
    desc: 'The flared case that holds the six LPT nozzle rows. Its cone angle shows how much the gas expands: the annulus area grows about 2.5-fold from LPT inlet to exit.',
  }, lptC).userData.part.stationTemp = '5';
  // LPT ACC, all inside the core compartment: each stage has a spray hoop over its blade row, kept
  // at least 12 mm inside the core cowl (the cowl closes in over the last stages); two half-manifolds
  // are fed at 0.3 and 2.4 rad, leaving room at the bottom for the oil lines. Each feed header leaves
  // its valve aft, crosses the EGT plane outboard of the thermocouple harness ring, and runs aft along
  // the hoops; the last hoop, where the cowl is closest, is fed by a smaller jumper tube.
  const ACC_PHI = [0.3, 2.4], ACC_VALVE = { r: 0.965, y: -3.92, rad: 0.05, len: 0.1 }, HDR = 0.022;
  const cowlIn = (y) => cowlAt(y) - CORE_COWL.t;
  const hoopR = (y) => Math.min(coreAt(y)[1] + 0.075, cowlIn(y) - 0.024);
  const hdrR = (y) => Math.min(coreAt(y)[1] + 0.105, cowlIn(y) - HDR - 0.008);
  const LPT_ROW_Y = ROWS.lptBlades.map((r) => r.y);
  const hdrY = [...LPT_ROW_Y.slice(0, 4), -4.85, LPT_ROW_Y[4]];          // -4.85: over the case flange
  const lptAcc = cut(cutPair((keep) => {
    const GAP0 = 1.35, GAP1 = 2.2;
    const list = [];
    for (const y of LPT_ROW_Y) {
      const rr = hoopR(y);
      const a0 = Math.max(keep.start, GAP1), a1 = keep.start + keep.arc;
      if (keep.start < GAP0) list.push(hoop(rr, y, 0.012, { start: keep.start, arc: Math.min(GAP0, a1) - keep.start, tubular: 24, radial: 5 }));
      if (a1 > a0) list.push(hoop(rr, y, 0.012, { start: a0, arc: a1 - a0, tubular: 40, radial: 5 }));
    }
    for (const phi of ACC_PHI) {
      if (!keep(phi)) continue;
      const V = ACC_VALVE;
      list.push(axialCyl(V.r, V.y, phi, V.rad, V.len, 16));
      // inlet neck from the top of the valve to the cowl's inner wall, under the scoop
      list.push(radialCyl(V.r + V.rad - 0.01, cowlIn(-3.922) - 0.0008, -3.9, phi, 0.022, 12));
      list.push(tube([P3(V.r, V.y - 0.035, phi), P3(0.915, -4.08, phi), P3(0.88, -4.165, phi), ...hdrY.map((y) => P3(hdrR(y), y, phi))], HDR, { seg: 40, radial: 8 }));
      const y5 = LPT_ROW_Y[4], y6 = LPT_ROW_Y[5];
      list.push(tube([P3(hdrR(y5), y5, phi), P3((hdrR(y5) + hoopR(y6)) / 2, (y5 + y6) / 2, phi), P3(hoopR(y6), y6, phi)], 0.012, { seg: 10, radial: 6 }));
    }
    return merge(list);
  }, GM.duct()));
  // fan-air scoops on the core cowl's outer face, over the valve necks; cut with the cowl
  // (seated on the cowl at its forward end; the cowl falls away by 2 mm towards its aft end)
  const SCOOP_Y = -3.89, SCOOP_L = 0.09, SCOOP_R = 0.025, scoopR = cowlAt(SCOOP_Y + SCOOP_L / 2) + SCOOP_R * Math.cos(Math.PI / 14) + 0.0003;
  const scoops = cut(cutPair((keep) => merge(ACC_PHI.filter((p) => keep(p)).map((phi) => axialCyl(scoopR, SCOOP_Y, phi, SCOOP_R, SCOOP_L, 14))), GM.duct(), 'nacelle'));
  const mouths = cut(cutPair((keep) => merge(ACC_PHI.filter((p) => keep(p)).map((phi) => axialCyl(scoopR, SCOOP_Y + SCOOP_L / 2 + 0.0008, phi, 0.019, 0.002, 14))), GM.hole(), 'nacelle'));
  P('LPT active clearance control', {
    system: 'Thermal control', material: 'Aluminium / stainless spray tubes, fan-air valves and cowl scoops', mass: 30,
    explode: [-0.95, -1.55, 0.3], temp: 360,
    desc: 'Fan air taken from the bypass stream through a scoop in the core cowl, metered by a FADEC-controlled valve and sprayed on the LPT case through a perforated ring over each of the six stages, shrinking the case onto the blade tips in cruise. Two valves and feed headers serve the two halves of the rings (scoop and valve positions estimated).',
  }, [lptAcc, scoops, mouths]);

  // ====================================================================== turbine rear frame
  const trf = cut(cutLathe([rect(0.905, 0.935, -5.13, -5.4), rect(0.935, 0.98, -5.13, -5.15), rect(0.5, 0.56, -5.14, -5.4), rect(0.935, 1.02, -5.22, -5.32)], GM.casing(), { seg: 72 }));
  const trfStruts = cut(cutPair((keep) => ring(bladeGeometry({ rHub: 0.55, rTip: 0.91, chord: 0.22, stagger: 0, t: 0.12, camber: 0, y: -5.27, stations: 2, n: 7, lean: [0, 0.06] }), 14, { keep }), GM.casing()));
  P('Turbine rear frame', {
    system: 'Structure', material: 'Cast nickel-alloy frame (strut count estimated)', mass: 360, count: 14,
    explode: [0, -1.85, 0], temp: 760,
    desc: 'Rear structural frame: its struts take the swirl out of the LPT exhaust and carry the LP shaft\'s rear bearing out to the case, where the aft engine mount attaches.',
  }, [trf, trfStruts]).userData.part.stationTemp = '5';

  // ====================================================================== exhaust
  const nozzle = cut(cutLathe([[0.975, -5.1], [0.968, -5.3], [0.905, -5.48], [0.782, -5.65], [0.724, -5.65], [0.842, -5.5], [0.893, -5.4], [0.905, -5.4], [0.94, -5.38], [0.945, -5.12]], GM.heat(0.75), { seg: 80 }));
  P('Core exhaust nozzle', {
    system: 'Propulsion', material: 'Inconel 625 sheet', mass: 120,
    explode: [0, -2.2, 0],
    desc: 'Converging nozzle for the hot core stream: at take-off the core jet leaves at about 490 m/s and 750 K, faster than the fan jet (about 325 m/s) but carrying far less mass (modelled).',
  }, nozzle).userData.part.stationTemp = '9';
  const plugLine = [[0.56, -5.36], [0.548, -5.46], [0.515, -5.6], [0.462, -5.75], [0.39, -5.92], [0.3, -6.08], [0.2, -6.23], [0.1, -6.38], [0.03, -6.46], [0.001, PLUG_TIP]];
  const plugProf = plugLine.concat(plugLine.slice(0, -1).reverse().map(([r, y]) => [Math.max(0.001, r - 0.01), y - 0.004]));
  const plug = cut(cutLathe(plugProf, GM.heat(0.85), { seg: 72 }));
  P('Centre plug', {
    system: 'Propulsion', material: 'Inconel 625 / titanium cone', mass: 65,
    explode: [0, -2.5, 0],
    desc: 'The exhaust cone fills the hole left by the turbine hub so the core stream expands smoothly and does not separate. Its tip marks the aft end of the engine: 7.28 m (286.7 in) from the spinner tip, the type-certificate length.',
  }, plug).userData.part.stationTemp = '9';

  // ====================================================================== shafts, bearings and sumps
  const B = (...a) => bearing(...a).map(cut);
  // LP shaft: three life-limited pieces joined by splines and coupling nuts (GE: fan forward shaft,
  // LPT fan mid shaft, LPT cone shaft)
  const LP_J1 = -1.0, LP_J2 = -4.85;
  const nut = (y) => [rect(0.102, 0.117, y + 0.022, y - 0.022), rect(0.117, 0.121, y + 0.012, y - 0.012)];
  P('Fan forward shaft', {
    system: 'Drive system', material: 'High-strength steel (life-limited part)', mass: 110,
    explode: [1.1, 0.25, 2.2], temp: 360,
    desc: 'Bolted to the fan disk through its cone, it carries the inner races of the #1 ball and #2 roller bearings and is splined to the mid shaft behind them. GE kept the earlier GE90\'s shaft diameter for the -115B, whose fan moves 12 % more air, and carried the extra torque with a stronger alloy instead (Aircraft Commerce, 2012).',
  }, cut(cutLathe([rect(0.078, 0.102, -0.42, LP_J1), [[0.13, -0.3], [0.142, -0.3], [0.112, -0.5], [0.102, -0.5]], ...nut(LP_J1)], GM.shaft(), { seg: 40 })));
  P('Fan mid shaft', {
    system: 'Drive system', material: 'High-strength steel (life-limited part)', mass: 230,
    explode: [1.1, -0.25, 2.2], temp: 420,
    desc: 'The long middle piece, almost 4 m, running inside the hollow HP spool. At take-off it carries more than three times the HP spool\'s torque, because it delivers similar power at a quarter of the speed. Splines at each end let the engine be split into modules.',
  }, cut(cutLathe([rect(0.078, 0.102, LP_J1, LP_J2)], GM.shaft(), { seg: 40 })));
  P('LPT cone shaft', {
    system: 'Drive system', material: 'Nickel-alloy cone with a steel stub shaft (life-limited part)', mass: 80,
    explode: [1.1, -0.9, 2.2], temp: 650,
    desc: 'The cone bolted to the stage 4 LP-turbine disk takes the whole turbine\'s torque down to the shaft line; its stub, splined to the mid shaft and held by a coupling nut, runs aft into the #5 bearing.',
    callout: true, anchor: [0.2, -4.93, 0.0],
  }, cut(cutLathe([[[0.29, -4.785], [0.3, -4.785], [0.112, -5.1], [0.102, -5.1]], rect(0.078, 0.102, LP_J2, -5.32), ...nut(LP_J2)], GM.shaft(), { seg: 40 })));
  const hpShaft = cut(cutLathe([rect(0.15, 0.166, -1.93, -2.12), [[0.166, -2.08], [0.178, -2.08], [0.24, -2.16], [0.226, -2.16]],
    rect(0.385, 0.4, -3.04, -3.6),
    rect(0.125, 0.14, -4.06, -4.18), [[0.14, -4.06], [0.18, -4.02], [0.18, -4.04], [0.14, -4.08]]], GM.shaft(), { seg: 48 }));
  P('HP shaft & compressor-to-turbine drum', {
    system: 'Drive system', material: 'Nickel-alloy drum, steel stub shafts', mass: 120,
    explode: [0.9, -0.7, 0.4], temp: 650,
    desc: 'The HP spool\'s backbone: a forward stub shaft into the #3 thrust bearing, the drum under the combustor that carries the turbine\'s torque forward to the compressor (the rotating CDP seal, a separate part, is bolted between its aft end and the HP turbine), and an aft stub shaft into the #4 bearing in the turbine center frame. It is hollow, so the LP shaft passes straight through.',
  }, hpShaft).userData.part.stationTemp = '3';
  const cdp = [rect(0.385, 0.4, -3.6, -3.775)];
  for (let k = 0; k < 4; k++) { const y = -3.615 - k * 0.025; cdp.push([[0.4, y + 0.004], [0.4033, y + 0.0008], [0.4033, y - 0.0008], [0.4, y - 0.004]]); }
  P('Rotating CDP seal', {
    system: 'Drive system', material: 'Nickel-superalloy seal with knife-edge teeth (life-limited part)', mass: 20,
    explode: [0.35, -1.12, 0.3], temp: 900,
    desc: 'Knife-edge teeth on this ring run against a land on the compressor rear frame and hold back compressor-discharge air at about 4.2 MPa (modelled), so it goes to the combustor and turbine cooling instead of leaking inwards. Opening this joint is what counts as an engine shop visit; in 2022 the FAA cut its life limit after melt-related freckles were found in some forgings (AD 2022-18-06).',
  }, cut(cutLathe(cdp, GM.nickelDark(), { seg: 48 }))).userData.part.stationTemp = '3';

  P('Fan bearings (#1 ball, #2 roller)', {
    system: 'Drive system', material: 'M50 bearing steel', mass: 40, count: 2,
    explode: [0, 0.4, 0], temp: 360,
    desc: 'The ball bearing locates the LP rotor axially and carries its net thrust — the fan\'s forward pull less the LP turbine\'s rearward push; the roller bearing takes radial loads. They sit in the forward sump, fed with oil and sealed by air.',
  }, [...B(-0.58, 0.102, 0.158, { balls: true, n: 22 }), ...B(-0.88, 0.102, 0.158, { balls: false, n: 26 })]);
  P('HP thrust bearing (#3 ball)', {
    system: 'Drive system', material: 'M50 bearing steel', mass: 18,
    explode: [0, -0.35, 0], temp: 380,
    desc: 'Locates the HP spool axially, carrying the difference between compressor and turbine thrust. The bevel gear that drives the accessory gearbox sits right beside it.',
  }, B(-1.97, 0.166, 0.218, { balls: true, n: 26 }));
  P('HP aft roller bearing (#4)', {
    system: 'Drive system', material: 'M50 bearing steel', mass: 12,
    explode: [0, -1.4, 0.7], temp: 620,
    desc: 'Supports the back of the HP spool: its inner race sits on the aft stub shaft and its outer race in the housing at the centre of the turbine center frame\'s sump, which carries the load out through the frame\'s struts. Oil reaches it, and is scavenged, through tubes inside those struts (GE patent EP 1 149 987).',
  }, B(TCF_BRG_Y, 0.14, 0.19, { balls: false, n: 30 }));
  P('LPT roller bearing (#5)', {
    system: 'Drive system', material: 'M50 bearing steel', mass: 14,
    explode: [0, -1.85, 0], temp: 480,
    desc: 'Carries the rear of the LP shaft in the turbine rear frame.',
  }, B(-5.27, 0.102, 0.155, { balls: false, n: 26 }));

  const fwdSump = cut(cutLathe([
    [[0.3, -1.7], [0.312, -1.7], [0.17, -0.92], [0.158, -0.92]], rect(0.158, 0.17, -0.54, -0.94),
    [[0.3, -1.82], [0.312, -1.82], [0.228, -1.97], [0.218, -1.97]], rect(0.218, 0.228, -1.94, -2.0),
    [[0.17, -0.56], [0.24, -0.56], [0.24, -0.6], [0.17, -0.6]],
  ], GM.casingDark(), { seg: 48 }));
  P('Forward sump & bearing supports', {
    system: 'Drive system', material: 'Steel housings, carbon and labyrinth seals', mass: 110,
    explode: [0, 0.2, 0], temp: 380,
    desc: 'Cones from the fan hub frame carry the #1, #2 and #3 bearings. The sump around them is an oil-wetted chamber pressurised by air through its seals, so oil can never leak into the gas path.',
  }, fwdSump);
  const aftSump = cut(cutLathe([[[0.5, -5.2], [0.512, -5.2], [0.165, -5.3], [0.155, -5.3]], rect(0.155, 0.4, -5.38, -5.4), rect(0.39, 0.4, -5.3, -5.4)], GM.casingDark(), { seg: 48 }));
  P('Aft sump', {
    system: 'Drive system', material: 'Steel housing', mass: 35,
    explode: [0, -1.85, 0], temp: 600,
    desc: 'Oil chamber round the #5 bearing inside the turbine rear frame, with its own scavenge line back to the gearbox.',
  }, aftSump);

  // ====================================================================== secondary air and maintenance access
  // LPT cooling: mid-stage HPC air piped outside the casings to the first LPT nozzle (stage and
  // count estimated); the air cools the LPT stage 1 vanes and purges the disk cavities
  const COOL = [1.05, 2.62, 4.19, 5.76];
  const coolPath = (phi) => [P3(0.58, -2.68, phi), P3(0.75, -2.85, phi), P3(0.95, -3.1, phi), P3(0.95, -3.8, phi), P3(0.88, -3.98, phi), P3(0.8, -4.08, phi), P3(0.755, -4.115, phi)];
  P('LPT cooling-air pipes', {
    system: 'Thermal control', material: 'Stainless pipes with bellows joints (count and source stage estimated)', mass: 16, count: 4,
    explode: [-0.9, -1.1, 0.55], temp: 640,
    desc: 'Air bled from the middle of the HP compressor bypasses the combustor through these pipes to ports on the turbine center frame, aligned with four of its hollow struts: through them it purges the HP and LP turbine rotor cavities and cools the struts and hub (GE patent EP 1 149 987). Using mid-stage air instead of compressor-exit air saves the work of compressing it further.',
  }, cut(cutPair((keep) => merge(COOL.filter((p) => keep(p)).flatMap((phi) => [tube(coolPath(phi), 0.02, { seg: 30, radial: 8 }), axialCyl(0.58, -2.66, phi, 0.03, 0.06, 12), radialCyl(0.72, 0.755, -4.115, phi, 0.022, 10)])), GM.duct())));

  // borescope ports: plugged holes through which an inspection camera reaches each module
  const port = (r0, y, phi) => merge([radialCyl(r0, r0 + 0.03, y, phi, 0.011, 10), radialCyl(r0 + 0.03, r0 + 0.042, y, phi, 0.018, 6)]);
  const PORT_PHI = 0.32;
  const ports = (list) => cut(cutPair((keep) => merge(list.filter(([, phi]) => keep(phi)).map(([r0, phi, y]) => port(r0, y, phi))), GM.steel()));
  P('Borescope ports (HP compressor)', {
    system: 'Structure', material: 'Threaded steel plugs (count estimated)', mass: 2, count: 9,
    explode: [-0.75, -0.7, 0.2], temp: 500,
    desc: 'One port per HP-compressor stage. With the plug out and the HP spool turned slowly by hand from the gearbox, a borescope camera checks every blade for nicks from ingested debris without taking the engine apart.',
  }, ports(ROWS.hpcRotors.map((r) => [coreAt(r.y)[1] + 0.024, PORT_PHI, r.y])));
  P('Borescope ports (combustor)', {
    system: 'Structure', material: 'Threaded steel plugs (count estimated)', mass: 1, count: 4,
    explode: [0.2, -1.0, 0.6], temp: 800,
    desc: 'Ports through the combustor case let an inspector see the liners, domes and fuel-nozzle tips, where cracking and burn-through show up first.',
  }, ports([[0.755, PORT_PHI, -3.52], [0.755, PORT_PHI + Math.PI / 2, -3.52], [0.755, PORT_PHI + Math.PI, -3.52], [0.755, PORT_PHI + 1.5 * Math.PI, -3.52]]));
  P('Borescope ports (HP turbine)', {
    system: 'Structure', material: 'Threaded high-temperature plugs (count estimated)', mass: 1, count: 2,
    explode: [-0.75, -1.25, 0.2], temp: 900,
    desc: 'Give a view of the first-stage nozzle vanes and blades, the parts that set an engine\'s life: inspectors look for coating loss, burning and cracks around the cooling holes.',
  }, ports(ROWS.hptBlades.map((r) => [0.722, PORT_PHI, r.y])));
  P('Borescope ports (LP turbine)', {
    system: 'Structure', material: 'Threaded high-temperature plugs (count estimated)', mass: 2, count: 6,
    explode: [-0.75, -1.55, 0.2], temp: 750,
    desc: 'One per LP-turbine stage, between the rows of nozzle vanes.',
  }, ports(ROWS.lptNozzles.map((r) => [coreAt(r.y)[1] + 0.026, PORT_PHI + 0.1, r.y])));          // clear of the LPT ACC feed header at 0.3 rad

  // centre vent tube: the bearing sumps vent their seal air aft through the LP shaft and out of the plug
  const vent = cut(cutLathe([rect(0.035, 0.045, -0.5, -6.43)], GM.duct(), { seg: 24 }));
  P('Centre vent tube', {
    system: 'Drive system', material: 'Thin-walled steel tube inside the LP shaft', mass: 12,
    explode: [1.1, -0.45, 2.2], temp: 450,
    desc: 'The bearing sumps are kept at low pressure so their seals leak air inwards, never oil outwards; that air leaves through this tube, which runs the whole length of the LP shaft and out of the tip of the centre plug.',
  }, vent);

  void kept; void lathe;
}
