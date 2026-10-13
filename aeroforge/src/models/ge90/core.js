// Core and LP turbine: 9-stage HP compressor with variable stators, compressor rear frame, dual
// annular combustor and its 30 fuel nozzles, 2-stage HP turbine, 6-stage LP turbine, turbine rear
// frame, core exhaust nozzle and plug, both spool shafts, the main bearings and their sumps.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { lathe } from '../../engine/geometry.js';
import { M } from '../../engine/materials.js';
import { GM } from './materials.js';
import { ROWS, coreAt, PLUG_TIP } from './layout.js';
import { cutLathe, cutPair, bladeGeometry, ring, boxAt, radialCyl, axialCyl, hoop, kept, merge, P3, tube } from './geom.js';
import { coreRow } from './fan.js';

const TAU = Math.PI * 2;

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
    const m = mesh(coreRow({ ...r, stagger: [36, 54], t: [0.065, 0.045], gap: 0.0025 }), GM.ti6246(i));
    m.userData.temp = lt('25', '3', (i + 0.5) / 9);
    const g = new THREE.Group();
    g.add(m);
    ctx.spin.n2.push(g);
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
    const s = cut(cutPair((keep) => coreRow({ ...r, rotor: false, gap: 0.0025 }, keep), r.variable ? GM.titanium() : GM.ti6246(i + 1)));
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
  const ogv = cut(cutPair((keep) => coreRow({ ...ROWS.hpcOGV, rotor: false, stagger: [-4, -6], camber: -0.04 }, keep), GM.ti6246(8)));
  P('HPC outlet guide vanes', {
    system: 'Propulsion', material: 'Nickel-alloy vanes (count estimated)', mass: 9, count: ROWS.hpcOGV.count,
    explode: [-0.6, -0.7, 0],
    desc: 'Take the last swirl out of the compressor delivery air before the diffuser slows it for the combustor.',
  }, ogv).userData.part.stationTemp = '3';

  // HPC rotor: nine disks on a bolted drum
  const hpcDisks = [lineWall(-2.13, -3.04, -0.022, -0.012, 0)];
  for (const r of ROWS.hpcRotors) {
    const h = coreAt(r.y)[0];
    hpcDisks.push([[h - 0.012, r.y + 0.03], [h, r.y + 0.03], [h, r.y - 0.03], [h - 0.012, r.y - 0.03], [h - 0.05, r.y - 0.012], [0.24, r.y - 0.01], [0.24, r.y - 0.03], [0.2, r.y - 0.03], [0.2, r.y + 0.03], [0.24, r.y + 0.03], [0.24, r.y + 0.01], [h - 0.05, r.y + 0.012]]);
  }
  const hpcSpool = cut(cutLathe(hpcDisks, GM.titanium(), { seg: 64 }));
  P('HP compressor spool', {
    system: 'Propulsion', material: 'Titanium front disks, nickel-alloy rear disks', mass: 360,
    explode: [0, -0.7, 0], temp: 650,
    desc: 'The rotating drum that carries all nine HPC rotor stages. The HP turbine drives it through the compressor-discharge seal drum at the back; the whole HP spool turns at N2.',
    callout: true, anchor: [-0.3, -2.6, 0.02],
  }, hpcSpool).userData.part.stationTemp = '3';

  // HPC casing with stage flanges and the variable-vane trunnion bosses
  const hpcCase = [lineWall(-2.06, -3.12, 0.003, 0.024, 1)];
  for (const y of [-2.06, -2.56, -3.12]) { const t = coreAt(y)[1]; hpcCase.push(rect(t + 0.02, t + 0.075, y + 0.012, y - 0.012)); }
  for (const r of [ROWS.hpcIGV, ...ROWS.hpcStators.filter((s) => s.variable)]) { const t = coreAt(r.y)[1]; hpcCase.push(rect(t + 0.022, t + 0.042, r.y + 0.02, r.y - 0.02)); }
  // outer bleed-manifold wall over the rear stages
  hpcCase.push([[0.56, -2.58], [0.575, -2.58], [0.575, -3.1], [0.5, -3.12], [0.5, -3.1], [0.56, -3.08]]);
  const casing = cut(cutLathe(hpcCase, GM.casing(), { seg: 72 }));
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
      list.push(hoop(t + 0.08, r.y - 0.02, 0.008, { tubular: 96, arc: keep(Math.PI * 1.75) ? TAU : Math.PI * 1.5 }));
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
    callout: true, anchor: [0.15, -2.3, 0.64],
  }, vsvGrp);

  // ====================================================================== compressor rear frame
  const crf = [
    rect(0.735, 0.755, -3.08, -3.74), rect(0.755, 0.8, -3.08, -3.1), rect(0.755, 0.8, -3.72, -3.74),
    rect(0.405, 0.42, -3.1, -3.7),
    // diffuser walls
    [[0.476, -3.11], [0.49, -3.11], [0.54, -3.26], [0.525, -3.26]], [[0.418, -3.11], [0.426, -3.11], [0.44, -3.26], [0.43, -3.26]],
  ];
  const crfRings = cut(cutLathe(crf, GM.casing(), { seg: 72 }));
  const crfStruts = cut(cutPair((keep) => ring(bladeGeometry({ rHub: 0.42, rTip: 0.74, chord: 0.11, stagger: 0, t: 0.28, camber: 0, y: -3.18, stations: 1, n: 6 }), 20, { keep }), GM.casing()));
  P('Compressor rear frame', {
    system: 'Structure', material: 'Cast nickel-alloy frame', mass: 380,
    explode: [0, -1.0, 0], temp: 900,
    desc: 'Combustor casing and structural frame in one: its struts carry the HP rotor\'s mid bearing loads out to the casing, its diffuser slows the compressor delivery air (about Mach 0.3) for the flame, and its outer wall holds the fuel nozzles and igniters.',
  }, [crfRings, crfStruts]).userData.part.stationTemp = '3';

  // ====================================================================== dual annular combustor
  const liners = cut(cutLathe([
    [[0.664, -3.34], [0.672, -3.34], [0.68, -3.42], [0.673, -3.52], [0.648, -3.62], [0.622, -3.71], [0.614, -3.71], [0.64, -3.62], [0.665, -3.52], [0.672, -3.42]],
    [[0.438, -3.34], [0.446, -3.34], [0.444, -3.42], [0.455, -3.52], [0.48, -3.62], [0.508, -3.71], [0.5, -3.71], [0.472, -3.62], [0.447, -3.52], [0.436, -3.42]],
    // centre body between the pilot (outer) and main (inner) domes
    [[0.548, -3.3], [0.562, -3.3], [0.56, -3.44], [0.555, -3.48], [0.55, -3.44]],
  ], GM.liner(), { seg: 80 }));
  const burnerMat = M.burner().clone();
  ctx.burnerMat = burnerMat;
  const flame = cut(cutLathe([[0.452, -3.36], [0.546, -3.36], [0.555, -3.47], [0.564, -3.36], [0.66, -3.36], [0.662, -3.52], [0.638, -3.62], [0.612, -3.69], [0.51, -3.69], [0.478, -3.62], [0.456, -3.52]], burnerMat, { seg: 80, capMat: burnerMat }));
  flame.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.userData.temp = () => T['4']; } });
  P('Dual annular combustor', {
    system: 'Propulsion', material: 'Nickel / cobalt-alloy liners with thermal-barrier coating', mass: 160,
    explode: [0, -1.0, 1.25],
    desc: 'Two rings of burners, one above the other: the outer pilot dome burns alone at idle for low smoke and hydrocarbons, and the inner main dome joins in at high power, keeping the flame lean and short to cut NOx. Gas leaves at about 1,680 K (modelled) — above the roughly 1,600 K at which the turbine alloys melt.',
    callout: true, anchor: [0.0, -3.5, 0.66],
  }, [liners, flame]).userData.part.stationTemp = '4';

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
    desc: 'Each nozzle stem carries two fuel circuits, one for a pilot cup and one for a main cup, spraying atomised kerosene into the swirlers. At take-off the engine burns about 4.7 kg of fuel a second (modelled). The count of 30 is an estimate; GE does not publish it.',
  }, nozzles).userData.part.stationTemp = '3';

  const manifold = cut(cutPair((keep) => {
    const arc = keep(Math.PI * 1.75) ? TAU : Math.PI * 1.5;
    return merge([hoop(0.86, -3.275, 0.012, { arc, tubular: 120 }), hoop(0.885, -3.31, 0.012, { arc, tubular: 120 })]);
  }, GM.steel()));
  P('Fuel manifolds', {
    system: 'Fuel', material: 'Stainless-steel tubing', mass: 22, count: 2,
    explode: [0, -1.0, 0], temp: 420,
    desc: 'Two rings round the combustor case, one feeding the pilot circuits and one the main circuits. The FADEC stages fuel between them through the hydromechanical unit.',
  }, manifold);

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
    const m = mesh(coreRow({ ...r, stagger: [34, 40], t: [0.2, 0.14], camber: 0.16, gap: 0.002, n: 7 }), GM.tbc());
    m.userData.temp = hptT[i * 2 + 1];
    const g = new THREE.Group();
    g.add(m);
    ctx.spin.n2.push(g);
    P(`HPT stage ${i + 1} blades`, {
      system: 'Propulsion', material: 'Single-crystal nickel superalloy, thermal-barrier coated (count estimated)', mass: 30, count: r.count,
      explode: [0, -1.25, 0],
      desc: i === 0
        ? 'Each blade is cast as a single crystal with no grain boundaries to creep along, coated with ceramic and cooled from inside by compressor air that is itself above 600 °C. The gas around them is hundreds of degrees hotter than the alloy\'s melting point; each blade pulls with tonnes of centrifugal force.'
        : 'Second HPT stage. Between them, the two HPT stages extract the roughly 100 MW the HP compressor absorbs at take-off (modelled).',
      ...(i === 0 ? { callout: true, anchor: [-0.56, -3.85, 0.05] } : {}),
    }, g);
  });
  const hptDisk = [];
  for (const r of ROWS.hptBlades) {
    const h = coreAt(r.y)[0];
    hptDisk.push([[h - 0.04, r.y + 0.035], [h, r.y + 0.035], [h, r.y - 0.035], [h - 0.04, r.y - 0.035], [0.32, r.y - 0.025], [0.22, r.y - 0.05], [0.18, r.y - 0.05], [0.18, r.y + 0.05], [0.22, r.y + 0.05], [0.32, r.y + 0.025]]);
  }
  hptDisk.push([[0.4, -3.775], [0.47, -3.81], [0.47, -3.82], [0.395, -3.79]]);           // forward cooling plate
  hptDisk.push(rect(0.43, 0.47, -3.89, -3.99));                                         // interstage seal
  const hptRotor = cut(cutLathe(hptDisk, GM.nickelDark(), { seg: 64 }));
  P('HPT disks & cooling plates', {
    system: 'Propulsion', material: 'Powder-metallurgy nickel superalloy', mass: 230,
    explode: [0, -1.25, 0], temp: 900,
    desc: 'Two thick disks hold the HPT blades in fir-tree slots. Cooling plates on their faces meter cooling air up into the blade roots and keep the hot gas away from the disk rims.',
  }, hptRotor).userData.part.stationTemp = '45';
  const hptCase = cut(cutLathe([lineWall(-3.78, -4.08, 0.006, 0.03, 1, 0.03), rect(0.7, 0.722, -3.72, -4.14), rect(0.722, 0.77, -3.72, -3.74), rect(0.722, 0.77, -4.12, -4.14), [[0.65, -3.8], [0.7, -3.78], [0.7, -3.8], [0.66, -3.82]], [[0.665, -4.06], [0.7, -4.04], [0.7, -4.06], [0.67, -4.08]]], GM.casing(), { seg: 72 }));
  P('HPT casing & shrouds', {
    system: 'Structure', material: 'Nickel-alloy case, ceramic-coated shroud segments', mass: 150,
    explode: [-0.6, -1.25, 0], temp: 950,
    desc: 'Shroud segments ride a few tenths of a millimetre outside the blade tips. Every extra 0.25 mm of tip gap costs roughly 1 % in fuel burn, which is why the case is actively cooled to shrink it at cruise.',
  }, hptCase).userData.part.stationTemp = '45';
  const hptAcc = cut(cutPair((keep) => {
    const arc = keep(Math.PI * 1.75) ? TAU : Math.PI * 1.5;
    const list = [hoop(0.745, -3.84, 0.013, { arc }), hoop(0.745, -3.98, 0.013, { arc })];
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

  // ====================================================================== LP turbine
  ROWS.lptNozzles.forEach((r, i) => {
    const vanes = cut(cutPair((keep) => coreRow({ ...r, rotor: false, stagger: [-40, -46], t: [0.14, 0.1], camber: -0.12, gap: 0.004, stations: 3, n: 6 }, keep), GM.heat(i / 5)));
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
    const m = mesh(coreRow({ ...r, stagger: [32, 40], t: [0.12, 0.06], camber: 0.12, gap: 0.004, stations: 3, n: 6 }), GM.heat(0.2 + i * 0.12));
    m.userData.temp = lt('45', '5', (i + 0.6) / 6);
    const g = new THREE.Group();
    g.add(m);
    ctx.spin.n1.push(g);
    const tip = coreAt(r.y)[1];
    const shroud = cut(cutLathe(rect(tip - 0.01, tip - 0.003, r.y + r.chord * 0.4, r.y - r.chord * 0.4), GM.heat(0.2 + i * 0.12), { seg: 64 }));
    P(`LPT stage ${i + 1} blades`, {
      system: 'Propulsion', material: 'Cast nickel-superalloy blades with interlocking tip shrouds (count estimated)', mass: 50 + i * 12, count: r.count,
      explode: [0, -1.55, 0],
      desc: i === 5
        ? 'Last and largest LPT stage, about 33 cm tall. The six stages together turn the fan and booster at N1 (100 % = 2,355 rpm) through the LP shaft — tens of megawatts at take-off.'
        : `LP turbine stage ${i + 1}. Tip shrouds on neighbouring blades lock together into a ring that damps vibration and seals the tip gap.`,
    }, [g, shroud]);
  });
  const lptDisks = [lineWall(-4.22, -5.12, -0.03, -0.018, 0)];
  for (const r of ROWS.lptBlades) {
    const h = coreAt(r.y)[0];
    lptDisks.push([[h - 0.02, r.y + 0.03], [h, r.y + 0.03], [h, r.y - 0.03], [h - 0.02, r.y - 0.03], [h - 0.05, r.y - 0.01], [0.3, r.y - 0.01], [0.3, r.y - 0.025], [0.26, r.y - 0.025], [0.26, r.y + 0.025], [0.3, r.y + 0.025], [0.3, r.y + 0.01], [h - 0.05, r.y + 0.01]]);
  }
  lptDisks.push([[0.29, -4.76], [0.3, -4.76], [0.112, -5.1], [0.102, -5.1]]);           // LPT shaft cone to the LP shaft
  const lptRotor = cut(cutLathe(lptDisks, GM.nickelDark(), { seg: 64 }));
  P('LP turbine rotor', {
    system: 'Propulsion', material: 'Nickel-alloy disks on a bolted drum', mass: 640,
    explode: [0, -1.55, 0], temp: 800,
    desc: 'Six disks bolted into one drum, joined to the LP shaft by a cone behind stage 4. All the power for the fan and booster — roughly 90 MW at take-off (modelled) — passes through this joint.',
    callout: true, anchor: [-0.4, -4.6, 0.02],
  }, lptRotor).userData.part.stationTemp = '5';
  const lptCase = [lineWall(-4.12, -5.13, 0.006, 0.026, 1)];
  for (const y of [-4.12, -4.52, -4.85, -5.13]) { const t = coreAt(y)[1]; lptCase.push(rect(t + 0.02, t + 0.065, y + 0.012, y - 0.012)); }
  const lptC = cut(cutLathe(lptCase, GM.casing(), { seg: 72 }));
  P('LPT casing', {
    system: 'Structure', material: 'Nickel-alloy conical case', mass: 420,
    explode: [-0.6, -1.55, 0], temp: 750,
    desc: 'The flared case that holds the six LPT nozzle rows. Its cone angle shows how much the gas expands: the annulus area grows about 2.5-fold from LPT inlet to exit.',
  }, lptC).userData.part.stationTemp = '5';
  const lptAcc = cut(cutPair((keep) => {
    const arc = keep(Math.PI * 1.75) ? TAU : Math.PI * 1.5;
    const list = ROWS.lptBlades.map((r) => hoop(coreAt(r.y)[1] + 0.075, r.y, 0.012, { arc, tubular: 96 }));
    for (const phi of [0.3, 2.4]) {
      if (!keep(phi)) continue;
      const pts = ROWS.lptBlades.map((r) => P3(coreAt(r.y)[1] + 0.105, r.y, phi));
      list.push(tube([P3(1.03, -3.95, phi), P3(0.86, -4.12, phi), ...pts], 0.026, { seg: 40, radial: 10 }));
      list.push(axialCyl(1.03, -3.92, phi, 0.05, 0.1, 16));
    }
    return merge(list);
  }, GM.duct()));
  P('LPT active clearance control', {
    system: 'Thermal control', material: 'Aluminium / stainless spray tubes, fan-air valve', mass: 30,
    explode: [-0.95, -1.55, 0.3], temp: 360,
    desc: 'Fan air ducted from the bypass stream through a FADEC-controlled valve and sprayed on the LPT case through perforated rings, shrinking it onto the blade tips in cruise.',
  }, lptAcc);

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
    desc: 'Converging nozzle for the hot core stream: at take-off the core jet leaves at about 440 m/s and 730 K, faster than the fan jet (about 305 m/s) but carrying far less mass.',
  }, nozzle).userData.part.stationTemp = '9';
  const plugLine = [[0.56, -5.36], [0.548, -5.46], [0.515, -5.6], [0.462, -5.75], [0.39, -5.92], [0.3, -6.08], [0.2, -6.23], [0.1, -6.38], [0.03, -6.46], [0.001, PLUG_TIP]];
  const plugProf = plugLine.concat(plugLine.slice(0, -1).reverse().map(([r, y]) => [Math.max(0.001, r - 0.01), y - 0.004]));
  const plug = cut(cutLathe(plugProf, GM.heat(0.85), { seg: 72 }));
  P('Centre plug', {
    system: 'Propulsion', material: 'Inconel 625 / titanium cone', mass: 65,
    explode: [0, -2.5, 0],
    desc: 'The exhaust cone fills the hole left by the turbine hub so the core stream expands smoothly and does not separate. Its tip marks the aft end of the engine: 7.29 m from the spinner tip.',
  }, plug).userData.part.stationTemp = '9';

  // ====================================================================== shafts, bearings and sumps
  const B = (...a) => bearing(...a).map(cut);
  const lpShaft = cut(cutLathe([rect(0.078, 0.102, -0.42, -5.32), [[0.13, -0.3], [0.142, -0.3], [0.112, -0.5], [0.102, -0.5]]], GM.shaft(), { seg: 40 }));
  P('LP shaft', {
    system: 'Drive system', material: 'High-strength steel', mass: 420,
    explode: [0.85, -0.25, 1.6], temp: 400,
    desc: 'About 5 m long and running inside the HP spool, it carries the LP turbine\'s torque forward to the fan and booster. At take-off it carries more than three times the torque of the HP spool, because it delivers similar power at a quarter of the speed.',
  }, lpShaft);
  const hpShaft = cut(cutLathe([rect(0.15, 0.166, -1.93, -2.12), [[0.166, -2.08], [0.178, -2.08], [0.24, -2.16], [0.226, -2.16]],
    rect(0.385, 0.4, -3.04, -3.78),
    rect(0.125, 0.14, -4.06, -4.18), [[0.14, -4.06], [0.18, -4.02], [0.18, -4.04], [0.14, -4.08]]], GM.shaft(), { seg: 48 }));
  P('HP shaft & CDP seal drum', {
    system: 'Drive system', material: 'Nickel-alloy drum, steel stub shafts', mass: 140,
    explode: [0.55, -0.7, 1.25], temp: 650,
    desc: 'The HP spool\'s backbone: a forward stub shaft into the thrust bearing, the compressor-discharge-pressure seal drum that links compressor to turbine, and an aft stub shaft. It is hollow, so the LP shaft passes straight through.',
  }, hpShaft).userData.part.stationTemp = '3';

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
    system: 'Drive system', material: 'M50 bearing steel', mass: 8,
    explode: [0, -1.25, 0], temp: 520,
    desc: 'Supports the back of the HP spool. It is modelled as an intershaft roller riding on the LP shaft, the usual GE arrangement on engines without a turbine mid-frame; the GE90\'s exact arrangement is not published.',
  }, B(-4.13, 0.102, 0.14, { balls: false, n: 28 }));
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

  void kept; void lathe;
}
