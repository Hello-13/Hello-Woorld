// Accessory drive and the units on the fan case: inlet gearbox, radial drive shaft, transfer
// gearbox and the fan-case accessory gearbox (housing and spur-gear train) with its starter,
// pumps, HMU, lubrication unit, generators and alternator; FADEC with its rating plug and
// configuration box; oil tank; heat exchangers and coolers; the debris monitoring system; bleed,
// starting and anti-ice air; hydraulic and generator runs to the strut; drains; fire detection
// and extinguishing; ignition. The fuel, oil and servo lines, harnesses and sensors that join
// these units are in plumbing.js.
//
// Positions on the fan case are estimated (GE does not publish installation drawings). The gearbox
// hangs on the fan case on the viewer's side, below the horizontal (phi ≈ 0.42…1.34 rad); lines
// that run to the strut take the short way up that side, so the cutaway cuts them like the case.
// Items marked "aircraft (Boeing) equipment" are supplied with the 777 and driven or served by the
// engine; they are left out of the engine's certified dry weight.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { GM } from './materials.js';
import { coreAt, AGB_PADS } from './layout.js';
import { cutLathe, cutPair, sector, boxAt, axialCyl, radialCyl, tangentCyl, hoop, merge, P3, tube, arc, cutTube, bladeGeometry, atPhi } from './geom.js';
import { toothedGear, axialGear, agbTrain } from './gears.js';

const TAU = Math.PI * 2;
const UP = Math.PI * 1.5;
const BOTTOM = Math.PI / 2;
export const PHI = { radial: Math.PI / 3, n1: Math.PI / 6, fadec: 0.24, tank: 0.25, agb0: 0.42, agb1: 1.34 };

// accessory gearbox: centre radius, forward and aft face stations
export const R_AGB = 1.845, Y_AGB_F = -0.56, Y_AGB_A = -0.94;
/** Attachment points (r, y, phi) on the units, where the lines in plumbing.js join them. */
export const AT = {
  pumpBoostOut: [1.845, -0.262, 0.82], pumpInlet: [1.866, -0.44, 0.774],
  hxFuelIn: [1.84, 0.012, 1.44], hxFuelOut: [1.84, -0.552, 1.44], hxOilIn: [1.84, -0.45, 1.352], hxOilOut: [1.84, -0.1, 1.528],
  filterIn: [1.99, -0.42, 0.852], hmuMetered: [1.945, -0.5, 1.03],
  unitSupply: [1.83, -0.52, 1.243], unitScavIn: [1.845, -0.42, 1.245], unitPress: [1.89, -0.42, 1.135], unitScavOut: [1.93, -0.545, 1.185],
  oilFilterHead: [2.04, -0.45, 1.2], scavFilterIn: [1.965, -0.665, 1.243], dmsOut: [1.97, -0.966, 1.3],
  tankOut: [1.84, -1.2, 0.435], tankReturn: [1.94, -0.86, 0.25], tankVent: [1.94, -1.0, 0.12], deoilerIn: [1.845, -1.088, 1.3],
  flowIn: [1.81, -1.065, 1.47], flowOut: [1.81, -1.235, 1.47], fadecA: [1.92, -0.15, 0.19], fadecB: [1.92, -0.51, 0.29],
};

const m = (g, mat) => mesh(g, mat);
// stations of the generators' own oil lines to their air/oil cooler: [supply, return] on each
// generator, and the cooler's four ports in the same order (VSCF supply first)
const GEN_OIL = { vscf: [-1.19, -1.22], idg: [-1.255, -1.285], ports: [-1.08, -1.11, -1.14, -1.17] };
/** A small threaded plug: boss on the surface at r0 and a hex head out to r1. */
const plug = (r0, r1, y, phi, rad = 0.012) => merge([radialCyl(r0, r1, y, phi, rad, 10), radialCyl(r1, r1 + 0.012, y, phi, rad * 1.5, 6)]);

/** A box at (r, y, phi) of size [radial, axial, tangential] built as five walls and a removable side. */
function shellBox(r, y, phi, [dr, dy, dt], t = 0.012) {
  const w = (cx, cy, cz, sx, sy, sz) => atPhi(new THREE.BoxGeometry(sx, sy, sz).translate(r + cx, y + cy, cz), phi);
  const keep = merge([
    w(-dr / 2 + t / 2, 0, 0, t, dy, dt), w(dr / 2 - t / 2, 0, 0, t, dy, dt),
    w(0, dy / 2 - t / 2, 0, dr, t, dt), w(0, -dy / 2 + t / 2, 0, dr, t, dt),
    w(0, 0, -dt / 2 + t / 2, dr, dy, t),
  ]);
  // local +z is the side towards decreasing phi, the side facing the viewer on this half of the engine
  const rest = w(0, 0, dt / 2 - t / 2, dr, dy, t);
  return { keep, rest };
}
/** A group of a housing and its removable cover: the cutaway takes the cover off. */
function opened(keepGeo, restGeo, mat, cut) {
  const g = new THREE.Group();
  const k = mesh(keepGeo, mat), r = mesh(restGeo, mat);
  r.visible = false;
  g.add(k, r);
  g.userData.cutaway = { rest: r, caps: [] };
  return cut(g);
}

export function buildAccessories(ctx) {
  const { P, cut } = ctx;
  const C = (build, mat, which = 'engine') => cut(cutPair(build, mat, which));

  // ================================================================== drive train
  // inlet gearbox: a bevel ring on the front of the HP shaft, meshing with the radial shaft's pinion
  const igbRing = cut(cutLathe([[0.166, -1.905], [0.24, -1.915], [0.24, -1.935], [0.166, -1.945]], GM.bronze(), { seg: 48 }));
  const igbTeeth = C((keep) => {
    const list = [];
    for (let i = 0; i < 64; i++) { const phi = (i / 64) * TAU; if (keep(phi)) list.push(boxAt(0.222, -1.908, phi, [0.034, 0.01, 0.0055])); }
    return merge(list);
  }, GM.bronze());
  // pinion at the foot of the radial shaft, riding on the ring's face teeth: a bevel with its axis
  // radial and a shallow cone whose apex lies on the engine axis
  const pinion = toothedGear([0.029, 0.025], 0.026, { teeth: 16, depth: 0.005 }).rotateZ(-Math.PI / 2).translate(0.2225, -1.879, 0);
  const igbHousing = shellBox(0.28, -1.86, PHI.radial, [0.07, 0.1, 0.1], 0.01);
  P('Inlet gearbox', {
    system: 'Drive system', material: 'Steel bevel gears in a cast housing (cover cut away)', mass: 15,
    explode: [0.09, -0.15, 0.58], temp: 380,
    desc: 'A bevel ring on the front of the HP shaft turns the drive through 90° into the pinion at the foot of the radial shaft. Its gear turns at N2, 9,332 rpm at 100 %; at start it carries the air turbine starter\'s torque the other way, from the radial shaft into the HP spool.',
  }, [igbRing, igbTeeth, m(atPhi(pinion, PHI.radial), GM.bronze()), opened(merge([igbHousing.keep, radialCyl(0.315, 0.33, -1.84, PHI.radial, 0.035, 14)]), igbHousing.rest, GM.casingDark(), cut)]);

  const radial = m(merge([tube([P3(0.236, -1.879, PHI.radial), P3(0.27, -1.87, PHI.radial), P3(0.33, -1.842, PHI.radial)], 0.02, { seg: 8, radial: 10 }), radialCyl(0.33, 1.795, -1.84, PHI.radial, 0.026, 12), radialCyl(0.9, 1.0, -1.84, PHI.radial, 0.034, 12)]), GM.shaft());
  P('Radial drive shaft', {
    system: 'Drive system', material: 'Steel tube with splined ends', mass: 12,
    explode: [0.19, -0.15, 1.01], temp: 330,
    desc: 'Runs out through a fan-frame strut — across both the core duct and the bypass duct — to the transfer gearbox on the fan case. At start it carries the starter\'s torque the other way, inwards, to spin the HP spool.',
  }, radial);

  // transfer gearbox: a bevel pair turns the drive from the radial shaft into the horizontal shaft.
  // The apex of the pair sits where the two shaft axes meet, at r = R_AGB, y = −1.84.
  const TGB = { r: R_AGB, y: -1.745, apexY: -1.84 };
  const tgbBox = shellBox(TGB.r, TGB.y, PHI.radial, [0.16, 0.31, 0.24]);
  P('Transfer gearbox', {
    system: 'Drive system', material: 'Cast aluminium housing (cover cut away)', mass: 22,
    explode: [0.24, -0.1, 1.23], temp: 340,
    desc: 'Turns the drive from the radial shaft into the horizontal shaft that runs forward along the fan case to the accessory gearbox. Losing the drive here stops every accessory, the fuel pump included, so the engine shuts down.',
  }, opened(merge([tgbBox.keep, axialCyl(TGB.r, -1.575, PHI.radial, 0.045, 0.04, 16), radialCyl(1.72, 1.77, -1.84, PHI.radial, 0.05, 16)]), tgbBox.rest, GM.magnesium(), cut));
  const bevelA = toothedGear([0.03, 0.05], 0.02, { teeth: 22, depth: 0.006 }).rotateZ(-Math.PI / 2).translate(TGB.r - 0.04, TGB.apexY, 0);
  const bevelB = toothedGear([0.05, 0.03], 0.02, { teeth: 22, depth: 0.006 }).translate(TGB.r, TGB.apexY + 0.04, 0);
  P('TGB radial gearshaft & bevel gears', {
    system: 'Drive system', material: 'Carburised steel bevel gearshafts', mass: 6, count: 2,
    explode: [0.32, -0.25, 1.45], temp: 340,
    desc: 'The radial gearshaft\'s bevel, about 10 cm across, meshes with the horizontal shaft\'s. Cracking of this radial gearshaft caused in-flight shutdowns of GE90-110B1/-115B engines in 2013, and two more later were traced to burrs from rework of its teeth; inspection and replacement are mandatory (FAA ADs 2013-14-51 and 2021-26-06).',
  }, m(atPhi(merge([bevelA, bevelB, radialCyl(1.765, 1.8, TGB.apexY, Math.PI / 2, 0.02, 10), axialCyl(TGB.r, -1.7, Math.PI / 2, 0.022, 0.18, 10)]), PHI.radial), GM.gear()));
  P('Horizontal drive shaft', {
    system: 'Drive system', material: 'Steel tube', mass: 9,
    explode: [0.26, 0.05, 1.38], temp: 320,
    desc: 'Links the transfer gearbox to the accessory gearbox\'s input gear, turning at a fixed ratio to N2.',
  }, m(axialCyl(R_AGB, -1.25, PHI.radial, 0.024, 0.64, 12), GM.shaft()));

  // ------------------------------------------------------------------ accessory gearbox
  const [A0, A1] = [PHI.agb0, PHI.agb1];
  const RI = 1.77, RO = 1.92, WT = 0.015;
  const housing = merge([
    sector(RI, RI + WT, Y_AGB_F, Y_AGB_A, A0, A1, 30),
    sector(RI, RO, Y_AGB_F, Y_AGB_F - WT, A0, A1, 30), sector(RI, RO, Y_AGB_A + WT, Y_AGB_A, A0, A1, 30),
    sector(RI, RO, Y_AGB_F, Y_AGB_A, A0, A0 + 0.008, 1), sector(RI, RO, Y_AGB_F, Y_AGB_A, A1 - 0.008, A1, 1),
  ]);
  const cover = sector(RO - WT, RO, Y_AGB_F - WT, Y_AGB_A + WT, A0 + 0.008, A1 - 0.008, 30);
  const pads = [];
  // pads: [phi, radius, face (+1 forward, −1 aft)]
  const accs = [[0.62, 0.105, 1], [0.82, 0.085, 1], [1.0, 0.07, 1], [1.2, 0.075, 1], [1.31, 0.035, 1], [0.5, 0.075, -1], [0.7, 0.135, -1], [0.95, 0.085, -1], [1.21, 0.06, -1], [PHI.radial, 0.035, -1], [1.3, 0.05, -1]];
  for (const [phi, rad, face] of accs) pads.push(axialCyl(R_AGB, face > 0 ? Y_AGB_F + 0.02 : Y_AGB_A - 0.02, phi, rad + 0.02, 0.04, 20));
  // mounting links to the fan case
  for (const phi of [0.5, 0.9, 1.25]) pads.push(radialCyl(1.705, 1.77, -0.75, phi, 0.025, 8), boxAt(1.73, -0.75, phi, [0.03, 0.06, 0.08]));
  P('Accessory gearbox', {
    system: 'Drive system', material: 'Cast aluminium/magnesium housing (outer cover cut away)', mass: 110,
    explode: [0.32, 0.1, 1.52], temp: 360,
    desc: 'A crescent-shaped gearbox hung on the fan case, with the accessories on its forward and aft faces. With its outer cover off, as here, the spur-gear train inside shows: one gear on each pad shaft, idlers between them.',
    callout: true, anchor: [1.62, -0.75, 1.0],
  }, opened(merge([housing, ...pads]), cover, GM.magnesium(), cut));

  // gear train: pad gears sized from the published pad ratios where they fit (the hydraulic pump,
  // slowest at 0.3783 × N2, gets about 2.1 times the generator gear's diameter at 0.7947 × N2)
  const TRAIN = agbTrain(R_AGB, AGB_PADS);
  const GY = (Y_AGB_F + Y_AGB_A) / 2, GY2 = GY - 0.07;     // main gear plane, and the step-up plane behind it
  const gears = [], shafts = [];
  for (const g of TRAIN) {
    gears.push(axialGear(R_AGB, GY, g.phi, g.r, 0.028));
    if (g.kind === 'idler') shafts.push(axialCyl(R_AGB, GY, g.phi, 0.011, 0.07, 10));
    else if (g.kind === 'compound') {
      // layshaft carrying the train gear and the step-up gear, and the pinion on the pad shaft
      const st = g.stepUp;
      gears.push(axialGear(R_AGB, GY2, g.phi, st.r, 0.024), axialGear(R_AGB, GY2, st.phi, st.pinion, 0.024));
      shafts.push(axialCyl(R_AGB, (GY + GY2) / 2, g.phi, 0.011, 0.13, 10), axialCyl(R_AGB, (GY2 + Y_AGB_A) / 2, st.phi, 0.012, GY2 - Y_AGB_A + 0.02, 10));
    } else shafts.push(axialCyl(R_AGB, GY, g.phi, 0.013, Y_AGB_F - Y_AGB_A - 0.03, 10));
  }
  P('AGB gear train', {
    system: 'Drive system', material: 'Carburised steel spur gears on roller-bearing shafts (layout estimated)', mass: 30, count: TRAIN.length + 2,
    explode: [0.45, 0.1, 1.75], temp: 360,
    desc: 'Every pad turns at a fixed ratio of N2 set by its gears: the generator at 0.7947 (7,416 rpm at 100 %), the hydraulic pump at 0.3783 (3,530 rpm) and the backup generator at 2.4126 (22,515 rpm) (EASA type certificate). So the slow hydraulic-pump gear is about twice the generator gear\'s diameter; idlers carry the drive between pads. The backup generator is too fast for one gear, so its train gear sits on a layshaft whose second, larger gear drives a small pinion on the pad shaft, stepping it up 26 : 12 (the real gear layout is not published).',
  }, [m(merge(gears), GM.gear()), m(merge(shafts), GM.steel())]);
  P('AGB hand-cranking pad', {
    system: 'Drive system', material: 'Steel drive socket under a bolted cover', mass: 1,
    explode: [0.37, 0.35, 1.6], temp: 340,
    desc: 'A square socket on the gearbox: with its cover off, a mechanic turns the HP spool slowly by hand with a ratchet while looking through the borescope ports, blade by blade.',
  }, m(merge([axialCyl(R_AGB, Y_AGB_F + 0.03, 1.31, 0.035, 0.03, 16), axialCyl(R_AGB, Y_AGB_F + 0.05, 1.31, 0.03, 0.012, 6)]), GM.steel()));

  // ------------------------------------------------------------------ accessories on the forward face
  const fwd = (phi, rad, len) => axialCyl(R_AGB, Y_AGB_F + len / 2, phi, rad, len, 24);
  const aft = (phi, rad, len) => axialCyl(R_AGB, Y_AGB_A - len / 2, phi, rad, len, 24);
  P('Air turbine starter', {
    system: 'Propulsion', material: 'Aluminium housing, single-stage air turbine', mass: 40,
    explode: [0.35, 0.35, 1.74], temp: 300,
    desc: 'Compressed air from the APU, a running engine or a ground cart spins this small turbine, which turns the HP spool through the gearbox up to about a quarter of its speed before fuel is lit. A clutch disengages it once the engine runs.',
  }, m(merge([fwd(0.62, 0.105, 0.3), axialCyl(R_AGB, Y_AGB_F + 0.33, 0.62, 0.07, 0.06, 20), radialCyl(1.93, 1.96, -0.42, 0.62, 0.045, 14)]), GM.aluminium()));
  P('Starter air valve', {
    system: 'Propulsion', material: 'Pneumatic butterfly valve with solenoid control and manual override (aircraft equipment)', mass: 9,
    explode: [0.35, 0.5, 1.95], temp: 300,
    desc: 'Opens when the pilot selects start, letting duct air into the starter, and closes when the FADEC sees the engine accelerating on its own at about 50 % N2. A square drive lets a mechanic open it by hand if its solenoid fails.',
  }, m(merge([axialCyl(2.02, -0.48, 0.62, 0.045, 0.14, 18), boxAt(2.03, -0.48, 0.655, [0.05, 0.08, 0.05]), radialCyl(1.955, 1.985, -0.44, 0.62, 0.035, 14)]), GM.aluminium()));
  P('Starter control valve', {
    system: 'Propulsion', material: 'Solenoid pilot valve (Safran), listed for the -110B1/-113B/-115B', mass: 2,
    explode: [0.35, 0.6, 2.05], temp: 300,
    desc: 'A small solenoid valve beside the starter air valve: a sense tube brings it duct pressure, which it ports to the big valve\'s actuator, so the starter air valve opens and closes on command. GE lists it separately from the Honeywell starter air valve and the air turbine starter.',
  }, m(merge([boxAt(2.035, -0.48, 0.695, [0.05, 0.055, 0.045]), radialCyl(2.06, 2.074, -0.48, 0.695, 0.011, 8),
    tube([P3(2.035, -0.48, 0.686), P3(2.035, -0.48, 0.662)], 0.006, { seg: 4, radial: 5 }),
    tube([P3(2.03, -0.6, 0.62), P3(2.045, -0.57, 0.66), P3(2.04, -0.525, 0.69), P3(2.035, -0.5, 0.695)], 0.005, { seg: 10, radial: 5 })]), GM.connector()));
  // starter duct: from the strut down the viewer's side of the fan case to the valve
  // (out of the strut aft of the fuel line and nacelle looms, under the fan cowl's frame, then across
  // the tank end outside the lines that run aft from the FADEC, into the valve's aft face)
  const starterPath = [P3(2.03, -1.2, UP - 0.05), P3(2.02, -1.12, UP + 0.07), P3(1.99, -1.0, UP + 0.18), P3(1.975, -0.84, UP + 0.28), P3(1.975, -0.74, UP + 0.36), P3(1.995, -0.68, UP + 0.44), P3(2.025, -0.65, UP + 0.54),
    ...arc(2.03, -0.65, UP + 0.62, TAU + 0.48, 0.1), P3(2.03, -0.65, TAU + 0.53), P3(2.025, -0.62, TAU + 0.6), P3(2.02, -0.58, TAU + 0.618), P3(2.02, -0.545, TAU + 0.62)];
  P('Starter duct', {
    system: 'Propulsion', material: 'Stainless-steel duct with flexible joints', mass: 14,
    explode: [0.3, 0.5, 2.1], temp: 300,
    desc: 'Brings starting air from the 777\'s pneumatic manifold in the strut down the side of the fan case to the starter air valve, about 10 cm across so the starter gets enough flow (the duct is cut away with the case here; routing estimated).',
  }, C((keep) => cutTube(starterPath, 0.048, keep, { radial: 12 }), GM.duct()));
  P('Main fuel pump', {
    system: 'Fuel', material: 'Aluminium housing, centrifugal boost stage and gear stage', mass: 32,
    explode: [0.35, 0.35, 1.89], temp: 300,
    desc: 'A centrifugal boost stage (the cap at the front) feeding a high-pressure gear stage, driven by the gearbox. Fuel arrives at 34.5 to 482.6 kPa (EASA type certificate); the boost stage sends it round the heat exchanger and filter, then the gear stage raises it far above combustor pressure for the HMU, which meters what is needed and returns the rest.',
  }, m(merge([fwd(0.82, 0.085, 0.24), axialCyl(R_AGB, Y_AGB_F + 0.26, 0.82, 0.05, 0.05, 16), tangentCyl(1.866, -0.44, 0.78, 0.018, 0.03, 10), tangentCyl(1.86, -0.33, 0.905, 0.014, 0.16, 10)]), GM.aluminium()));
  P('Fuel filter & bypass indicator', {
    system: 'Fuel', material: 'Disposable filter element in an aluminium bowl, pop-out ΔP indicator', mass: 6,
    explode: [0.37, 0.55, 1.89], temp: 300,
    desc: 'Cleans the fuel between the pump\'s boost and high-pressure stages. When it clogs, a bypass valve keeps fuel flowing and a red button pops out of the bowl, and the crew sees a filter-bypass message, so it gets changed at the next stop.',
  }, m(merge([radialCyl(1.93, 2.02, -0.42, 0.82, 0.042, 18), radialCyl(2.02, 2.035, -0.42, 0.82, 0.03, 12), radialCyl(1.93, 1.96, -0.36, 0.86, 0.012, 8), tangentCyl(1.99, -0.42, 0.847, 0.016, 0.02, 10)]), GM.aluminium()));
  P('Hydromechanical unit (HMU)', {
    system: 'Fuel', material: 'Aluminium body with torque-motor servo valves', mass: 35,
    explode: [0.37, 0.35, 2.03], temp: 300,
    desc: 'The FADEC\'s muscles: electrically commanded valves meter fuel to the nozzles (4.59 kg/s at take-off), and the same high-pressure fuel, used as hydraulic fluid, is sent down a pair of servo lines to every variable-geometry actuator and clearance-control valve.',
  }, m(merge([boxAt(R_AGB + 0.01, Y_AGB_F + 0.15, 1.0, [0.14, 0.3, 0.2]), axialCyl(R_AGB + 0.07, Y_AGB_F + 0.18, 1.0, 0.025, 0.2, 10), radialCyl(1.925, 1.945, -0.5, 1.03, 0.017, 10), boxAt(1.935, -0.31, 1.0, [0.02, 0.06, 0.16])]), GM.blue()));

  // lubrication unit: one pressure element and four scavenge elements stacked on one shaft
  const LU = [[0.072, -0.56, -0.52], [0.066, -0.515, -0.48], [0.066, -0.475, -0.44], [0.066, -0.435, -0.40], [0.066, -0.395, -0.37], [0.05, -0.37, -0.35]];
  const lu = LU.flatMap(([rad, y0, y1]) => [axialCyl(R_AGB, (y0 + y1) / 2, 1.2, rad, y1 - y0, 22), axialCyl(R_AGB, y1 + 0.002, 1.2, rad + 0.006, 0.004, 22)]);
  P('Lubrication unit', {
    system: 'Drive system', material: 'Techspace Aero unit: aluminium housings, gerotor elements on one shaft', mass: 18,
    explode: [0.37, 0.35, 1.74], temp: 360,
    desc: 'On the -115B the oil pumps are one Techspace Aero lubrication unit: a pressure element (nearest the gearbox) that feeds the bearings and gears, and scavenge elements on the same shaft that suck the oil back out of the sumps. The type certificate\'s minimum oil pressure is 69 kPa differential.',
    callout: true, anchor: [1.79, -0.45, 0.7],
  }, m(merge([...lu, tangentCyl(1.83, -0.52, 1.24, 0.016, 0.03, 10), tangentCyl(1.845, -0.42, 1.24, 0.018, 0.03, 10), boxAt(1.92, -0.545, 1.185, [0.02, 0.04, 0.04])]), GM.oil()));
  P('Oil pressurizing valve', {
    system: 'Drive system', material: 'Spring-loaded poppet valve (Techspace Aero)', mass: 1,
    explode: [0.37, 0.45, 1.68], temp: 360,
    desc: 'On the pressure element\'s outlet: it stays shut until the pump has built up pressure, then opens and holds the supply pressure so the jets in every sump get a steady flow.',
  }, m(merge([axialCyl(1.86, -0.42, 1.135, 0.022, 0.09, 14), tangentCyl(1.86, -0.42, 1.152, 0.012, 0.03, 8), radialCyl(1.882, 1.9, -0.42, 1.135, 0.012, 8), tube([P3(1.9, -0.42, 1.135), P3(1.935, -0.43, 1.16), P3(1.94, -0.45, 1.178)], 0.01, { seg: 8, radial: 6 })]), GM.oil()));
  P('Main oil filter', {
    system: 'Drive system', material: 'Pleated filter element in an aluminium bowl, ΔP switch', mass: 4,
    explode: [0.4, 0.55, 1.74], temp: 370,
    desc: 'Filters the pressure oil before it reaches the bearings. A pressure-difference switch warns the crew before it clogs, and a bypass valve keeps the bearings fed if it does.',
  }, m(merge([radialCyl(1.92, 2.02, -0.45, 1.2, 0.04, 18), radialCyl(2.02, 2.035, -0.45, 1.2, 0.028, 12)]), GM.oil()));
  P('Scavenge oil filter', {
    system: 'Drive system', material: 'Filter element in an aluminium bowl', mass: 4,
    explode: [0.4, 0.3, 1.7], temp: 380,
    desc: 'Catches debris in the oil returning from the sumps before it goes on to the debris monitor and the tank, so wear products from one bearing cannot circulate through the others.',
  }, m(merge([radialCyl(1.92, 2.01, -0.7, 1.26, 0.038, 18), radialCyl(2.01, 2.025, -0.7, 1.26, 0.026, 12)]), GM.oil()));
  P('Magnetic chip detectors', {
    system: 'Sensors', material: 'Magnetic plugs in self-closing valves (count and positions estimated)', mass: 1, count: 5,
    explode: [0.42, 0.2, 1.68], temp: 370,
    desc: 'Magnets in each scavenge element\'s inlet and in the gearbox sump that collect steel flakes, checked at every inspection: a few fuzzy particles are normal, but chips mean a bearing or gear is starting to fail. They complement the debris monitor, which counts particles electrically in flight.',
  }, m(merge([...[-0.383, -0.4575, -0.4975, -0.538].flatMap((y) => [tangentCyl(1.885, y, 1.233, 0.009, 0.02, 10), tangentCyl(1.885, y, 1.2425, 0.013, 0.008, 6)]), plug(1.92, 1.945, -0.64, 1.32, 0.011)]), GM.connector()));

  // ------------------------------------------------------------------ accessories on the aft face
  P('Integrated drive generator (IDG)', {
    system: 'Electrical', material: 'Constant-speed drive and 120 kVA generator (aircraft equipment)', mass: 70,
    explode: [0.35, -0.3, 1.81], temp: 330,
    desc: 'The 777\'s main 115 V, 400 Hz generator for this engine, Boeing equipment driven from an engine pad. Its pad turns at 0.7947 × N2 and is rated 181.3 kW (EASA type certificate); a hydraulic constant-speed drive inside holds the generator at a steady speed while the engine\'s speed varies.',
  }, m(merge([aft(0.7, 0.135, 0.42), axialCyl(R_AGB, Y_AGB_A - 0.44, 0.7, 0.09, 0.04, 20),
    ...GEN_OIL.idg.map((y) => radialCyl(1.97, 1.992, y, 0.7, 0.013, 10)), boxAt(1.98, -1.335, 0.72, [0.035, 0.05, 0.07])]), GM.painted()));
  P('Backup generator (VSCF/PMG)', {
    system: 'Electrical', material: 'Variable-speed generator with integral permanent-magnet generators (aircraft equipment)', mass: 22,
    explode: [0.33, -0.3, 1.66], temp: 330,
    desc: 'The 777\'s backup generator, Boeing equipment on its own engine pad: its pad turns fastest of all, at 2.4126 × N2 (about 22,500 rpm at 100 %), rated 43 kW. Its permanent-magnet sections also power the flight-control electronics if everything else fails.',
  }, m(merge([aft(0.5, 0.075, 0.3), axialCyl(R_AGB, Y_AGB_A - 0.32, 0.5, 0.05, 0.04, 16), ...GEN_OIL.vscf.map((y) => radialCyl(1.912, 1.935, y, 0.5, 0.013, 10))]), GM.painted()));
  P('Engine-driven hydraulic pump', {
    system: 'Hydraulics', material: 'Variable-displacement piston pump (aircraft equipment)', mass: 25,
    explode: [0.37, -0.3, 1.96], temp: 330,
    desc: 'Pressurises one of the 777\'s hydraulic systems to 3,000 psi (20.7 MPa) for flight controls, gear and brakes. Boeing equipment on an engine pad turning at 0.3783 × N2, rated 63.5 kW.',
  }, m(aft(0.95, 0.085, 0.26), GM.aluminium()));
  P('Permanent-magnet alternator', {
    system: 'Electrical', material: 'Permanent-magnet generator with separate windings for each FADEC channel', mass: 8,
    explode: [0.37, -0.3, 2.1], temp: 330,
    desc: 'The FADEC\'s private power supply: once the engine turns fast enough, its windings power both control channels even if the aircraft\'s electrical system fails.',
  }, m(aft(1.21, 0.06, 0.12), GM.avionics()));
  P('Air/oil separator (deoiler)', {
    system: 'Drive system', material: 'Gear-driven centrifugal separator', mass: 6,
    explode: [0.4, -0.35, 2.2], temp: 360,
    desc: 'Air leaks into the sumps through their seals and has to be vented, together with the oil tank\'s vent. This spinning separator on the gearbox flings the oil mist out of that air and returns it, so very little oil leaves through the vent line.',
  }, m(merge([aft(1.3, 0.05, 0.14), tangentCyl(1.845, -1.04, 1.33, 0.016, 0.03, 10)]), GM.magnesium()));
  P('Deoiler vent line', {
    system: 'Drive system', material: 'Aluminium tube to an overboard vent', mass: 2,
    explode: [0.42, -0.35, 2.3], temp: 340,
    desc: 'Carries the cleaned sump and tank vent air from the deoiler, round behind the gearbox, to the drain mast at the bottom of the fan cowl. (The bearing sumps also vent aft through the centre vent tube inside the LP shaft.)',
  }, m(tube([P3(1.845, -1.04, 1.345), P3(1.87, -1.12, 1.355), P3(1.88, -1.44, 1.37), P3(1.89, -1.49, 1.45), P3(1.9, -1.47, 1.54), P3(1.94, -1.2, 1.555), P3(1.97, -0.85, 1.556), P3(1.95, -0.7, BOTTOM - 0.012)], 0.014, { seg: 48, radial: 6 }), GM.duct()));

  // ------------------------------------------------------------------ FADEC, rating plug and configuration box
  // two channel halves side by side, each with its own row of harness connectors on the outer face
  const FP = PHI.fadec;
  const fadecBox = merge([
    boxAt(1.82, -0.32, FP - 0.052, [0.12, 0.5, 0.185]), boxAt(1.82, -0.32, FP + 0.052, [0.12, 0.5, 0.185]),
    ...[-0.12, 0.12].flatMap((dp) => [radialCyl(1.705, 1.76, -0.2, FP + dp, 0.018, 8), radialCyl(1.705, 1.76, -0.44, FP + dp, 0.018, 8)]),
  ]);
  const connectors = merge([...[-0.15, -0.27, -0.39, -0.51].flatMap((y) => [radialCyl(1.88, 1.915, y, FP - 0.05, 0.021, 12), radialCyl(1.88, 1.915, y, FP + 0.05, 0.021, 12)])]);
  P('FADEC (electronic engine control)', {
    system: 'Avionics', material: 'FADEC International (BAE Systems) dual-channel computer in a vibration-isolated box', mass: 25,
    explode: [0.24, 0.4, 1.89], temp: 300,
    desc: 'Full Authority Digital Engine Control: two independent channels (the two halves here, each with its own row of connectors and looms) read dozens of sensors and schedule fuel, variable geometry and clearance control; either can run the engine alone. After a loss of thrust control with uncommanded high thrust, the FAA had its MN4 microprocessor replaced at intervals until a software revision added mitigation (ADs 2021-15-05 and 2025).',
    callout: true, anchor: [0.48, -0.32, 1.77],
  }, [m(fadecBox, GM.avionics()), m(connectors, GM.connector())]);
  P('FADEC rating (identification) plug', {
    system: 'Avionics', material: 'Coded plug on a lanyard (Safran)', mass: 0.2,
    explode: [0.3, 0.55, 2.05], temp: 300,
    desc: 'Tells the FADEC which thrust rating to run. The -110B1, -113B and -115B are the same hardware: the type certificate says the -115B differs from the -110B1 only in its higher thrust ratings, by a "rating plug change". It stays with the engine when the FADEC is swapped.',
  }, m(merge([boxAt(1.9, -0.105, FP, [0.03, 0.05, 0.05]), tube([P3(1.9, -0.13, FP + 0.02), P3(1.91, -0.16, FP + 0.03), P3(1.885, -0.19, FP + 0.02)], 0.003, { seg: 8, radial: 4 })]), GM.orange()));
  P('Configuration type box', {
    system: 'Avionics', material: 'Coded configuration module (Safran)', mass: 0.4,
    explode: [0.3, 0.65, 2.0], temp: 300,
    desc: 'Tells the FADEC which hardware is fitted to this engine (the type certificate links each configuration to its FADEC software and limits). Like the rating plug it belongs to the engine, not the FADEC, so a replacement control learns the engine it is on.',
  }, m(boxAt(1.9, -0.555, FP, [0.04, 0.06, 0.1]), GM.orange()));

  // ------------------------------------------------------------------ oil tank, coolers
  const tank = merge([sector(1.75, 1.93, -0.8, -1.36, PHI.tank - 0.16, PHI.tank + 0.16, 10), boxAt(1.935, -1.12, PHI.tank + 0.1, [0.01, 0.08, 0.05]),
    radialCyl(1.93, 1.945, -0.86, PHI.tank, 0.02, 10), radialCyl(1.93, 1.945, -1.0, 0.12, 0.016, 10), tangentCyl(1.84, -1.2, 0.418, 0.016, 0.02, 10),
    ...[-0.12, 0.12].flatMap((dp) => [radialCyl(1.69, 1.75, -0.9, PHI.tank + dp, 0.018, 8), radialCyl(1.69, 1.75, -1.26, PHI.tank + dp, 0.018, 8)])]);
  P('Oil tank', {
    system: 'Drive system', material: 'Aluminium tank with sight glass', mass: 25,
    explode: [0.21, -0.2, 1.89], temp: 340,
    desc: 'Holds the engine\'s oil, which also carries heat away from the bearings and gears. Scavenged oil returns at the top and de-aerates; the supply leaves from the low end and the vent from the high end. The -115B\'s oil-temperature limits are 132 °C continuous and 143 °C for 15 minutes (EASA type certificate).',
  }, m(tank, GM.aluminium()));
  P('Oil tank cap', {
    system: 'Drive system', material: 'Locking filler cap (Safran), listed for the -110B1/-113B/-115B', mass: 0.3,
    explode: [0.23, -0.1, 2.0], temp: 340,
    desc: 'The gravity-filler cap. Oil is added within about half an hour of shutdown, while it is still warm and the level reading is valid; a cap left unlocked can let the tank empty in flight.',
  }, m(merge([radialCyl(1.93, 1.955, -1.12, 0.2, 0.026, 14), boxAt(1.962, -1.12, 0.2, [0.01, 0.045, 0.012])]), GM.red()));
  P('Oil level sensor', {
    system: 'Sensors', material: 'Ametek float-type level transmitter', mass: 1,
    explode: [0.23, -0.2, 2.03], temp: 340,
    desc: 'Measures the oil level in the tank for the 777\'s EICAS display, so crews and engineers can trend oil consumption and spot a slow leak between flights.',
  }, m(merge([radialCyl(1.93, 1.975, -1.33, PHI.tank - 0.08, 0.02, 10), boxAt(1.985, -1.33, PHI.tank - 0.08, [0.03, 0.05, 0.05])]), GM.connector()));
  // main fuel/oil heat exchanger: fuel in and out at the ends, oil in and out at the sides
  const ohe = merge([boxAt(1.84, -0.27, 1.44, [0.13, 0.38, 0.24]), axialCyl(1.84, -0.04, 1.44, 0.04, 0.08, 12), axialCyl(1.84, -0.5, 1.44, 0.04, 0.08, 12), radialCyl(1.705, 1.775, -0.27, 1.44, 0.02, 8),
    tangentCyl(1.84, -0.45, 1.364, 0.018, 0.04, 10), tangentCyl(1.84, -0.1, 1.516, 0.018, 0.04, 10)]);
  P('Main fuel/oil heat exchanger', {
    system: 'Thermal control', material: 'Triumph Thermal tube-bundle cooler ("lube/servo fuel/oil cooler")', mass: 35,
    explode: [0.39, 0.3, 1.45], temp: 360,
    desc: 'Fuel is the engine\'s coolant: hot scavenged oil, entering at one side and leaving at the other, gives its heat to the cold fuel flowing end to end, warming the fuel so ice cannot block its filter and putting the heat back into the cycle. After an engine and airplane fire, the FAA had units P/N 1838M88P11 and -P13 replaced (AD 2017-08-06).',
  }, m(ohe, GM.aluminium()));
  // IDG/VSCF air/oil cooler: fan air in from the fan frame, out through the fan cowl (position and routing estimated)
  const AOC = 0.062, AOC_PORT = 0.057;
  P('IDG/VSCF air/oil cooler', {
    system: 'Thermal control', material: 'Triumph Thermal plate-fin air/oil cooler with inlet and exit ducts (aircraft equipment; position estimated)', mass: 14,
    explode: [0.3, -0.35, 1.95], temp: 330,
    desc: 'On the -110B1/-113B/-115B the 777\'s generators\' oil is cooled by fan air here (the base GE90s used a fuel-cooled unit instead): each generator\'s oil comes round the fan case to the four ports on its outer face and back. The IDG it cools is rated 120 kVA, 181.3 kW at its pad (EASA type certificate). Its position and duct routing are estimated.',
  }, m(merge([boxAt(1.84, -1.05, AOC, [0.18, 0.3, 0.1]), tube([P3(1.7, -1.48, AOC), P3(1.76, -1.38, AOC), P3(1.8, -1.2, AOC)], 0.045, { seg: 10, radial: 10 }), tube([P3(1.93, -1.0, AOC + 0.013), P3(2.0, -0.98, AOC + 0.013), P3(2.075, -0.94, AOC + 0.013)], 0.035, { seg: 8, radial: 10 }),
    ...GEN_OIL.ports.map((y) => radialCyl(1.926, 1.946, y, AOC_PORT, 0.012, 10))]), GM.aluminium()));
  // each line: up off its generator, round the fan case over the tank's outer face at r 2.0 (clear of
  // the looms and sense lines along the tank), then forward and down onto its port
  const genLine = (y, yPort, phi0, r0) => tube([P3(r0, y, phi0), P3((r0 + 2.0) / 2 + 0.003, y, phi0 - 0.012), P3(2.0, y, phi0 - 0.04), ...arc(2.0, y, phi0 - 0.07, 0.15, 0.06),
    P3(1.997, y + 0.04, 0.115), P3(1.975, (y + yPort) / 2 + 0.03, 0.08), P3(1.952, yPort, AOC_PORT + 0.004), P3(1.94, yPort, AOC_PORT)], 0.0095, { seg: 64, radial: 6 });
  P('IDG & VSCF cooler oil lines', {
    system: 'Thermal control', material: 'Stainless supply and return tubes carrying the generators\' own oil (aircraft equipment; routing estimated)', mass: 4, count: 4,
    explode: [0.32, -0.4, 1.9], temp: 340,
    desc: 'A supply and a return tube for each generator join it to the air/oil cooler beside the oil tank. The oil in them is the generators\' own, kept apart from the engine\'s; it carries the heat of the IDG\'s constant-speed drive and of the backup generator out to the fan air. Boeing does not publish the routing: the tubes are drawn round the aft face of the gearbox and over the tank.',
  }, m(merge([
    ...GEN_OIL.vscf.map((y, i) => genLine(y, GEN_OIL.ports[i], 0.5, 1.93)),
    ...GEN_OIL.idg.map((y, i) => genLine(y, GEN_OIL.ports[i + 2], 0.7, 1.99)),
  ]), GM.steel()));
  P('VSCF/lube oil-oil cooler', {
    system: 'Thermal control', material: 'Triumph Thermal oil-to-oil cooler', mass: 5,
    explode: [0.4, -0.35, 1.8], temp: 340,
    desc: 'Passes the backup generator\'s heat into the engine\'s lube oil, which then dumps it into the fuel in the main heat exchanger. The VSCF pad is the fastest on the gearbox, 2.4126 × N2, about 22,500 rpm at 100 %. Engine oil enters at its forward face and leaves at its side on the way back to the tank (the oil return line); the two stubs underneath carry the generator\'s oil.',
  }, m(merge([boxAt(1.965, -1.08, 0.5, [0.07, 0.15, 0.12]), radialCyl(1.92, 1.93, -1.04, 0.5, 0.012, 8), radialCyl(1.92, 1.93, -1.12, 0.5, 0.012, 8),
    axialCyl(1.965, -1.0, 0.5, 0.017, 0.014, 10), tangentCyl(1.965, -1.08, 0.4695, 0.017, 0.014, 10)]), GM.aluminium()));

  // ------------------------------------------------------------------ debris monitoring system (Eaton)
  P('DMS separator', {
    system: 'Sensors', material: 'Eaton centrifugal air/oil separator', mass: 1.5,
    explode: [0.45, 0.2, 1.9], temp: 380,
    desc: 'The first stage of the debris monitoring system: it spins the air out of the frothy scavenge oil, because bubbles would confuse the sensor that counts metal particles after it.',
  }, m(merge([radialCyl(1.92, 2.0, -0.805, 1.3, 0.034, 16), radialCyl(2.0, 2.012, -0.805, 1.3, 0.024, 10)]), GM.connector()));
  P('DMS debris sensor', {
    system: 'Sensors', material: 'Eaton inductive particle sensor', mass: 1,
    explode: [0.48, 0.1, 1.95], temp: 380,
    desc: 'Every metal particle passing through its coils disturbs their field, so it counts ferrous and non-ferrous debris electrically in flight. Rising counts flag bearing or gear wear long before vibration shows it.',
  }, m(merge([axialCyl(1.97, -0.9, 1.3, 0.025, 0.1, 14), axialCyl(1.97, -0.9, 1.3, 0.03, 0.02, 14), axialCyl(1.97, -0.845, 1.3, 0.012, 0.016, 8), axialCyl(1.97, -0.958, 1.3, 0.012, 0.016, 8)]), GM.connector()));
  P('DMS signal conditioner', {
    system: 'Avionics', material: 'Eaton signal-conditioning unit', mass: 1,
    explode: [0.3, 0.3, 2.1], temp: 300,
    desc: 'Turns the debris sensor\'s pulses into particle counts by size and passes them to the FADEC and the airline\'s maintenance system, so the oil is watched every flight rather than only when the chip detectors are pulled.',
  }, m(boxAt(1.8, -0.68, 0.33, [0.05, 0.12, 0.08]), GM.avionics()));

  // ------------------------------------------------------------------ bleed air (aircraft pneumatic system, Boeing)
  const BL = UP - 0.25;
  const tIP = coreAt(-2.61)[1] + 0.02, tHP = coreAt(-3.0)[1] + 0.02;
  P('Bleed ducts & manifold', {
    system: 'Environmental control', material: 'Inconel / stainless ducts with flexible joints', mass: 35,
    explode: [-0.6, -0.7, -0.6], temp: 700,
    desc: 'Air is tapped from a mid HP-compressor stage and from the compressor exit, joined in a manifold and ducted up through the upper bifurcation into the strut, to the precooler and on to the cabin packs, wing anti-ice and engine starting.',
  }, m(merge([
    radialCyl(tIP, 0.66, -2.61, BL, 0.05, 16), radialCyl(tHP, 0.66, -3.0, BL, 0.04, 16),
    tube([P3(0.66, -2.61, BL), P3(0.7, -2.72, BL), P3(0.72, -2.82, BL)], 0.04, { seg: 12 }),
    tube([P3(0.66, -3.0, BL), P3(0.7, -2.92, BL), P3(0.72, -2.82, BL)], 0.035, { seg: 12 }),
    tube([P3(0.72, -2.82, BL), P3(0.82, -2.82, UP - 0.15), P3(1.1, -2.85, UP - 0.03), P3(1.6, -2.9, UP - 0.02), P3(2.1, -2.95, UP - 0.02)], 0.06, { seg: 40, radial: 12 }),
  ]), GM.duct()));
  P('IP check valve', {
    system: 'Environmental control', material: 'Stainless flapper valve (aircraft equipment)', mass: 4,
    explode: [-0.62, -0.75, -0.62], temp: 600,
    desc: 'Lets mid-stage air out but stops the hotter high-pressure air flowing backwards into the compressor when the high-stage valve is open.',
  }, m(axialCyl(0.69, -2.68, BL, 0.06, 0.1, 18), GM.duct()));
  P('High-pressure shutoff valve', {
    system: 'Environmental control', material: 'Pneumatically actuated butterfly valve (aircraft equipment)', mass: 7,
    explode: [-0.62, -0.75, -0.62], temp: 800,
    desc: 'Opens at low power, when mid-stage air is too weak for the aircraft\'s needs, and draws the hotter compressor-exit air instead; above about cruise power it shuts and the engine runs on mid-stage air, which costs less fuel.',
  }, m(merge([axialCyl(0.69, -2.95, BL, 0.055, 0.1, 18), boxAt(0.76, -2.95, BL, [0.06, 0.06, 0.08])]), GM.duct()));
  P('Pressure-regulating shutoff valve (PRSOV)', {
    system: 'Environmental control', material: 'Pneumatic regulating butterfly valve (aircraft equipment)', mass: 9,
    explode: [-0.65, -0.7, -0.6], temp: 650,
    desc: 'Holds the bleed air delivered to the aircraft at a steady pressure whatever the engine is doing, and shuts the engine off from the aircraft\'s duct system when the crew selects the bleed off or the fire handle is pulled.',
  }, m(merge([axialCyl(1.75, -2.9, UP - 0.02, 0.075, 0.14, 20), boxAt(1.75, -2.9, UP - 0.12, [0.08, 0.1, 0.06])]), GM.duct()));
  P('Precooler', {
    system: 'Environmental control', material: 'Stainless plate-fin air-to-air heat exchanger in the strut (aircraft equipment)', mass: 40,
    explode: [-1.0, -0.6, 0], temp: 500,
    desc: 'Cools the bleed air, which can be well above 500 °C, to about 200 °C with cold fan air before it goes into the wing; the warmed fan air is dumped overboard through the top of the strut.',
  }, m(merge([boxAt(2.22, -2.9, UP, [0.24, 0.7, 0.3]), boxAt(2.08, -2.95, UP, [0.06, 0.2, 0.16])]), GM.duct()));
  const fav = [P3(1.38, -2.25, UP - 0.07), P3(1.62, -2.35, UP - 0.06), P3(1.9, -2.45, UP - 0.04), P3(2.08, -2.6, UP - 0.02)];
  P('Fan-air valve & duct', {
    system: 'Environmental control', material: 'Modulating butterfly valve, aluminium duct from a bypass-duct scoop (aircraft equipment)', mass: 10,
    explode: [-0.95, -0.55, -0.1], temp: 300,
    desc: 'Takes cold fan air from the bypass duct into the precooler. The valve opens just enough to hold the bleed air at its target temperature, so as little fan thrust as possible is wasted.',
  }, m(merge([tube(fav, 0.045, { seg: 24 }), axialCyl(1.9, -2.45, UP - 0.04, 0.055, 0.12, 18), boxAt(1.38, -2.25, UP - 0.07, [0.08, 0.14, 0.1])]), GM.aluminium()));

  // ------------------------------------------------------------------ nacelle anti-ice
  const naiDuct = [P3(coreAt(-3.0)[1] + 0.02, -3.0, UP - 0.42), P3(0.72, -2.9, UP - 0.4), P3(1.05, -2.5, UP - 0.035), P3(1.5, -2.0, UP - 0.035), P3(1.82, -1.62, UP - 0.12), P3(1.9, -1.2, UP - 0.12), P3(1.9, 0.1, UP - 0.12), P3(1.88, 0.4, UP - 0.12), P3(1.78, 1.2, UP - 0.12), P3(1.72, 1.55, UP - 0.12), P3(1.7, 1.68, UP - 0.12)];
  P('Nacelle anti-ice valve & duct', {
    system: 'Environmental control', material: 'Stainless duct, motorised valve, piccolo tube (aircraft equipment)', mass: 30,
    explode: [-0.6, 0.4, -0.8], temp: 500,
    desc: 'Hot compressor air piped forward over the fan case into the inlet lip, where a perforated ring (the piccolo tube) sprays it round the inside of the lip to stop ice forming.',
  }, [m(merge([tube(naiDuct, 0.035, { seg: 120, radial: 10 }), axialCyl(1.9, -0.9, UP - 0.12, 0.06, 0.16, 18)]), GM.duct()),
    cut(cutPair((keep) => hoop(1.695, 1.69, 0.014, { start: keep.start, arc: keep.arc, tubular: 80 }), GM.duct(), 'nacelle'))]);

  // ------------------------------------------------------------------ hydraulic and generator runs to the strut
  // the pump and generators sit on the gearbox; their lines go aft of it and up the side of the fan case
  const upSide = (r, y, phi0) => [...arc(r, y, phi0, 0.0, 0.1), ...arc(r, y, TAU, UP + 0.12, 0.1), P3(r + 0.03, y - 0.05, UP + 0.05)];
  P('Hydraulic pump lines', {
    system: 'Hydraulics', material: 'Stainless pressure, suction and case-drain lines (aircraft equipment)', mass: 9, count: 3,
    explode: [0.2, -0.45, 1.6], temp: 330,
    desc: 'Three lines join the pump to the airplane: a large suction line from the reservoir, the 3,000 psi pressure line, and a small case-drain line whose flow is filtered and cooled, and watched, because a rising case-drain flow means the pump is wearing.',
  }, C((keep) => merge([
    cutTube([P3(1.9, Y_AGB_A - 0.2, 0.95), P3(1.95, -1.3, 0.955), P3(1.95, -1.42, 0.94), ...upSide(1.95, -1.46, 0.9)], 0.016, keep),
    cutTube([P3(1.93, Y_AGB_A - 0.15, 0.97), P3(2.0, -1.28, 0.975), P3(2.0, -1.44, 0.96), ...upSide(2.0, -1.5, 0.92)], 0.022, keep),
    cutTube([P3(1.88, Y_AGB_A - 0.24, 0.93), P3(1.91, -1.32, 0.93), P3(1.92, -1.48, 0.92), ...upSide(1.915, -1.53, 0.88)], 0.01, keep),
  ]), GM.steel()));
  P('IDG feeder cables', {
    system: 'Electrical', material: 'Three-phase aluminium feeders in fire-resistant sleeves (aircraft equipment)', mass: 18,
    explode: [0.25, -0.4, 1.75], temp: 330,
    desc: 'Carry the generator\'s 115 V, 400 Hz output from the terminal block on its aft end up into the strut and on to the 777\'s power panels: three thick phase cables and a neutral, sized for the 120 kVA rating.',
  }, C((keep) => cutTube([P3(1.995, -1.35, 0.715), P3(2.012, -1.4, 0.68), P3(2.015, -1.42, 0.62), ...upSide(2.015, -1.42, 0.57)], 0.022, keep, { radial: 8 }), GM.harness()));

  // ------------------------------------------------------------------ drains
  const drainHdr = [P3(1.735, -0.505, 0.6), ...arc(1.735, -0.505, 0.6, 1.36, 0.1), P3(1.8, -0.6, 1.5)];
  P('Drain lines & collector', {
    system: 'Fuel', material: 'Small stainless tubes to a collector tank', mass: 5,
    explode: [0.4, 0.45, 1.45], temp: 300,
    desc: 'Every pad seal and actuator leaks a few drops of fuel, oil or hydraulic fluid by design; these lines collect it from the starter, pumps, HMU and generator pads so it can be measured. More than the maintenance-manual limit from one line points to the seal that needs changing.',
  }, m(merge([tube(drainHdr, 0.007, { seg: 40, radial: 6 }), ...[0.62, 0.82, 1.0, 1.2].map((phi) => radialCyl(1.735, 1.765, -0.5, phi, 0.006, 6)), boxAt(1.82, -0.6, 1.5, [0.06, 0.1, 0.1]), tube([P3(1.85, -0.6, 1.52), P3(1.92, -0.6, BOTTOM)], 0.01, { seg: 6 })]), GM.steel()));
  const mast = atPhi(bladeGeometry({ rHub: 1.92, rTip: 2.2, chord: [0.16, 0.1], stagger: 0, t: 0.28, camber: 0, y: -0.6, sweep: [0, -0.06], stations: 1, n: 8 }), BOTTOM);
  P('Drain mast', {
    system: 'Fuel', material: 'Streamlined aluminium mast', mass: 2,
    explode: [0.9, 0.2, 0], temp: 290,
    desc: 'Sticks out of the bottom of the fan cowl and drops the drained fluids into the airstream, away from hot parts. On the ground a mechanic counts the drips from each of its outlets.',
  }, m(mast, GM.painted()));

  // ------------------------------------------------------------------ fire detection and extinguishing
  const fanLoop = [P3(1.96, -0.12, 0.05), ...arc(1.96, -0.12, 0.05, 1.75, 0.1), P3(2.0, -0.75, 1.78), P3(2.0, -1.2, 1.775), P3(2.01, -1.33, 1.76), P3(2.04, -1.38, 1.75), ...arc(2.04, -1.38, 1.75, 0.05, 0.1),
    P3(2.01, -1.33, 0.045), P3(2.0, -1.2, 0.04), P3(2.0, -0.9, 0.035), P3(1.965, -0.72, 0.03), P3(1.965, -0.58, 0.03), P3(1.962, -0.3, 0.04), P3(1.96, -0.13, 0.05)];
  P('Fire detector loops (fan compartment)', {
    system: 'Sensors', material: 'Twin gas-filled or eutectic sensing tubes on clips, with responders', mass: 4, count: 2,
    explode: [0.15, 0.25, 2.3], temp: 300,
    desc: 'Two independent sensing loops run round the accessories. Heat anywhere along a loop raises its gas pressure (or drops its resistance) and the responder signals FIRE or overheat in the cockpit; both loops must agree, so a single fault cannot give a false alarm.',
  }, m(merge([tube(fanLoop, 0.006, { seg: 180, radial: 5 }), boxAt(1.98, -0.12, 0.02, [0.04, 0.06, 0.06]), boxAt(2.0, -1.22, 1.79, [0.04, 0.06, 0.06])]), GM.connector()));
  P('Fire detector loops (core compartment)', {
    system: 'Sensors', material: 'Twin sensing tubes on clips round the combustor and turbine casings', mass: 4, count: 2,
    explode: [-0.85, -1.05, 0.65], temp: 600,
    desc: 'The core compartment, between the casings and the core cowl, holds hot cases, fuel and oil lines, so it has its own pair of loops. They alarm at a higher temperature than the fan-compartment loops because the space runs hot.',
  }, C((keep) => merge([
    hoop(0.9, -2.6, 0.006, { start: keep.start, arc: keep.arc, tubular: 120, radial: 5 }),
    hoop(0.9, -3.62, 0.006, { start: keep.start, arc: keep.arc, tubular: 120, radial: 5 }),
    ...[0.4, 4.4].filter((p) => keep(p)).map((phi) => tube([P3(0.9, -2.6, phi), P3(0.92, -3.1, phi), P3(0.9, -3.62, phi)], 0.006, { seg: 10, radial: 5 })),
  ]), GM.connector()));
  const ext = [P3(2.05, -2.7, UP - 0.03), P3(1.6, -2.7, UP - 0.03), P3(1.1, -2.7, UP - 0.03), P3(1.0, -2.72, UP - 0.12), ...arc(0.99, -2.75, UP - 0.2, UP - 0.9, 0.1)];
  P('Fire-extinguisher discharge lines', {
    system: 'Propulsion', material: 'Stainless lines and nozzles from the 777\'s Halon bottles (aircraft equipment)', mass: 6,
    explode: [-0.8, -0.65, 0.2], temp: 400,
    desc: 'When the crew pulls the fire handle, Halon from bottles in the airplane floods the fan and core compartments through these lines and nozzles; the handle also shuts the fuel, bleed and hydraulic valves to the engine first.',
  }, m(merge([tube(ext, 0.012, { seg: 40 }), ...[UP - 0.5, UP - 0.9].map((phi) => radialCyl(0.97, 0.99, -2.75, phi, 0.018, 8)), tube([P3(2.05, -1.05, UP - 0.2), P3(1.98, -1.0, UP - 0.3), P3(1.95, -0.9, UP - 0.5)], 0.012, { seg: 12 })]), GM.red()));

  // ------------------------------------------------------------------ ignition
  P('Ignition exciters', {
    system: 'Electrical', material: 'Capacitor-discharge units', mass: 10, count: 2,
    explode: [0.19, -0.7, 1.09], temp: 420,
    desc: 'Each exciter stores energy in a capacitor and dumps it into its igniter as a spark of several joules, a few times a second. Two independent systems give redundancy.',
  }, m(merge([0.62, 2.52].map((phi) => boxAt(0.66, -2.79, phi, [0.08, 0.2, 0.12]))), GM.painted()));
  P('Igniter leads', {
    system: 'Electrical', material: 'Shielded, air-cooled high-tension leads', mass: 3, count: 2,
    explode: [0.25, -0.8, 1.0], temp: 600,
    desc: 'Carry the exciters\' high-voltage pulses to the two igniter plugs. They are shielded so the spark energy does not interfere with the FADEC\'s sensor wiring.',
  }, m(merge([0.62, 2.52].map((phi) => tube([P3(0.68, -2.89, phi), P3(0.78, -3.02, phi), P3(0.88, -3.12, phi), P3(0.925, -3.22, phi), P3(0.92, -3.37, phi), P3(0.865, -3.425, phi)], 0.01, { seg: 24 }))), GM.braid()));
}
