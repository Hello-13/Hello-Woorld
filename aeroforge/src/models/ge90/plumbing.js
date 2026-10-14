// The lines that join the GE90-115B's units into systems a student can trace end to end: fuel
// (aircraft supply → pump boost stage → main fuel/oil heat exchanger → filter → gear stage → HMU →
// flow transmitter → manifolds), servo fuel (HMU → every variable-geometry and clearance-control
// actuator, a head line and a rod line each), lubrication (tank → anti-leak valve → lubrication
// unit → pressurizing valve → filter → sumps; sumps → scavenge elements → scavenge filter → debris
// monitor → heat exchanger → tank; tank vent → deoiler), the fan, core, nacelle and EGT harnesses,
// the engine sensors and the valves on the core. Routings are estimated: GE does not publish
// installation drawings, so each line takes a plausible path between the units it joins.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { GM } from './materials.js';
import { coreAt } from './layout.js';
import { cutPair, boxAt, axialCyl, radialCyl, tangentCyl, hoop, merge, P3, tube, arc, cutTube, atPhi } from './geom.js';
import { AT, PHI } from './accessories.js';

const TAU = Math.PI * 2;
const UP = Math.PI * 1.5;
const BOTTOM = Math.PI / 2;

const m = (g, mat) => mesh(g, mat);
const at = (a) => P3(a[0], a[1], a[2]);
/** A tube through [r, y, phi] points (or Vector3s), with segments in proportion to its length. */
const line = (pts, radius, radial = 6, step = 0.03) => {
  const p = pts.map((q) => (q.isVector3 ? q : P3(q[0], q[1], q[2])));
  let len = 0;
  for (let i = 1; i < p.length; i++) len += p[i].distanceTo(p[i - 1]);
  return tube(p, radius, { seg: Math.max(6, Math.round(len / step)), radial });
};

export function buildPlumbing(ctx) {
  const { P, cut } = ctx;
  const C = (build, mat, which = 'engine') => cut(cutPair(build, mat, which));

  // ================================================================== fuel
  P('Aircraft fuel supply line', {
    system: 'Fuel', material: 'Stainless-steel tube with a shrouded flexible section (Boeing interface at the strut)', mass: 8,
    explode: [0.25, 0.1, 1.45], temp: 290,
    desc: 'Fuel from the 777\'s wing tanks comes down the strut and round the fan case to the inlet of the main fuel pump\'s boost stage. The type certificate allows 34.5 to 482.6 kPa at the pump inlet (cut away with the case here).',
  }, C((keep) => cutTube([P3(2.02, -0.95, UP + 0.02), P3(2.0, -0.6, UP + 0.12), ...arc(2.0, -0.32, UP + 0.2, TAU + 0.7, 0.1), P3(1.96, -0.36, 0.735), P3(1.9, -0.43, 0.757), at(AT.pumpInlet)], 0.022, keep, { radial: 10 }), GM.steel()));
  P('Low-pressure fuel loop', {
    system: 'Fuel', material: 'Stainless-steel tubes', mass: 6,
    explode: [0.32, 0.25, 1.62], temp: 300,
    desc: 'From the pump\'s boost stage the fuel runs forward to the main fuel/oil heat exchanger, where it takes heat from the oil, then back to the filter on top of the pump and into its high-pressure gear stage. Warming the fuel first keeps ice crystals from blocking the filter.',
  }, m(merge([
    line([at(AT.pumpBoostOut), [1.85, -0.16, 0.84], [1.86, -0.08, 0.95], ...arc(1.86, -0.07, 1.02, 1.3, 0.08), [1.85, 0.03, 1.38], [1.84, 0.06, 1.43], at(AT.hxFuelIn)], 0.018, 8),
    line([at(AT.hxFuelOut), [1.86, -0.6, 1.42], [1.97, -0.615, 1.37], ...arc(2.04, -0.615, 1.32, 0.92, 0.07), [2.02, -0.52, 0.875], at(AT.filterIn)], 0.016, 8),
  ]), GM.steel()));
  P('Metered fuel line', {
    system: 'Fuel', material: 'Stainless-steel tube with a flexible section across the fan frame', mass: 9,
    explode: [0.32, 0.0, 1.52], temp: 300,
    desc: 'Carries the fuel the HMU has metered, 4.59 kg/s at take-off (ICAO databank), through the flow transmitter, down the 6 o\'clock fan-frame strut and along the core to the tee that feeds the pilot and main manifolds.',
  }, m(merge([
    line([at(AT.hmuMetered), [1.965, -0.58, 1.03], [1.965, -0.95, 1.035], [1.965, -1.05, 1.08], ...arc(1.965, -1.05, 1.12, 1.4, 0.07), [1.88, -1.055, 1.45], at(AT.flowIn)], 0.016, 8),
    line([at(AT.flowOut), [1.79, -1.38, 1.5], [1.78, -1.58, 1.52], [1.72, -1.75, BOTTOM - 0.022], [1.6, -1.765, BOTTOM - 0.022], [1.1, -1.775, BOTTOM - 0.022], [0.85, -1.85, BOTTOM - 0.022], [0.72, -2.4, 1.45], [0.7, -2.9, 1.4], [0.84, -3.05, 1.38], [0.857, -3.25, 1.36]], 0.016, 8),
  ]), GM.steel()));
  P('Fuel flow transmitter', {
    system: 'Fuel', material: 'Ametek turbine-type mass flow transmitter', mass: 4,
    explode: [0.42, 0.0, 1.62], temp: 300,
    desc: 'Measures the metered fuel on its way to the nozzles for the cockpit fuel-flow display and fuel-used totals: 4.59 kg/s (about 16.5 t an hour) at take-off, as the ICAO emissions databank lists, and about 1.2 kg/s in cruise (modelled).',
  }, m(merge([axialCyl(1.81, -1.15, 1.47, 0.045, 0.16, 16), boxAt(1.86, -1.15, 1.47, [0.04, 0.06, 0.06])]), GM.blue()));
  P('Fuel/oil temperature sensor', {
    system: 'Sensors', material: 'Goodrich resistance-thermometer probe', mass: 0.3,
    explode: [0.45, 0.35, 1.5], temp: 330,
    desc: 'Sits at the main heat exchanger\'s fuel outlet and tells the crew and the FADEC how hot the fuel and, through it, the oil run. The -115B\'s oil limits are 132 °C continuous and 143 °C for 15 minutes (EASA type certificate).',
  }, m(merge([radialCyl(1.88, 1.935, -0.5, 1.44, 0.01, 8), boxAt(1.945, -0.5, 1.44, [0.022, 0.03, 0.03])]), GM.connector()));

  // ------------------------------------------------------------------ servo fuel
  // HMU → fan case → 6 o'clock fan-frame strut → each actuator: [name, head path, rod path]
  const SERVO = [
    ['VBV actuator', [[0.92, -1.585, 1.5], ...arc(0.88, -1.59, 1.45, 0.82, 0.1), [0.865, -1.578, 0.75]], [[0.92, -1.6, 1.52], ...arc(0.9, -1.6, 1.46, 0.84, 0.1), [0.9, -1.45, 0.8], [0.875, -1.33, 0.784]]],
    ['VBV actuator', [[0.92, -1.585, 1.64], ...arc(0.88, -1.59, 1.7, 3.84, 0.1), [0.865, -1.578, 3.89]], [[0.92, -1.6, 1.62], ...arc(0.9, -1.6, 1.68, 3.82, 0.1), [0.9, -1.45, 3.86], [0.875, -1.33, 3.858]]],
    ['VSV actuator', [[0.97, -1.86, 1.52], [0.8, -2.05, 1.45], ...arc(0.745, -2.12, 1.4, 0.43, 0.1), [0.71, -2.3, 0.39], [0.69, -2.505, 0.36], [0.665, -2.508, 0.35]], [[0.97, -1.86, 1.53], [0.81, -2.05, 1.46], ...arc(0.76, -2.1, 1.4, 0.44, 0.1), [0.7, -2.16, 0.4], [0.668, -2.17, 0.393]]],
    ['VSV actuator', [[0.97, -1.86, 1.62], [0.8, -2.05, 1.7], ...arc(0.745, -2.12, 1.75, 3.45, 0.1), [0.71, -2.3, 3.47], [0.69, -2.505, 3.48], [0.665, -2.508, 3.49]], [[0.97, -1.86, 1.61], [0.81, -2.05, 1.69], ...arc(0.76, -2.1, 1.74, 3.44, 0.1), [0.7, -2.16, 3.45], [0.668, -2.17, 3.447]]],
    ['HPT ACC valve', [[0.97, -1.86, 1.5], [0.88, -2.2, 1.42], [0.86, -2.7, 1.2], [0.92, -2.97, 1.02], [0.95, -3.02, 0.996]], [[0.97, -1.86, 1.51], [0.89, -2.2, 1.43], [0.87, -2.7, 1.21], [0.93, -3.03, 1.03], [0.95, -3.08, 0.996]]],
    ['LPT ACC valve', [[0.97, -1.86, 1.49], [0.88, -2.25, 1.38], [0.84, -2.8, 1.1], [0.9, -3.4, 0.62], [0.99, -3.8, 0.37], [1.03, -3.9, 0.352]], [[0.97, -1.86, 1.48], [0.89, -2.25, 1.37], [0.85, -2.8, 1.09], [0.91, -3.4, 0.6], [1.0, -3.84, 0.36], [1.03, -3.94, 0.352]]],
    ['LPT ACC valve', [[0.97, -1.86, 1.65], [0.88, -2.25, 1.76], [0.84, -2.8, 2.0], [0.9, -3.4, 2.24], [0.99, -3.8, 2.35], [1.03, -3.9, 2.348]], [[0.97, -1.86, 1.66], [0.89, -2.25, 1.77], [0.85, -2.8, 2.01], [0.91, -3.4, 2.26], [1.0, -3.84, 2.36], [1.03, -3.94, 2.348]]],
    ['booster anti-ice valve', [[0.97, -1.86, 1.55], [0.8, -2.05, 1.4], [0.73, -2.13, 1.28], [0.705, -2.15, 1.257]], null],
  ];
  const servo = [];
  let n = 0;
  for (const [, head, rod] of SERVO) {
    for (const path of [head, rod]) {
      if (!path) continue;
      const k = n >> 1, j = n & 1;
      const lane = 1.07 + 0.006 * n, laneB = 1.5 + 0.006 * n;
      const ys = -1.632 - 0.0105 * k, ps = BOTTOM + (j ? 0.01 : -0.01);
      servo.push(line([[1.935, -0.29, 0.965 + 0.005 * n], [1.98, -0.34, 1.0 + 0.005 * n], [2.0, -0.46, lane], [2.0, -0.95, lane], [2.02, -1.06, 1.2 + 0.006 * n], [2.02, -1.12, 1.4 + 0.006 * n], [2.01, -1.22, laneB], [2.01, -1.4, laneB], [1.9, -1.55, 1.54 + 0.003 * n], [1.72, -1.62, ps], [1.62, ys, ps], [1.0, ys - 0.005, ps], ...path], 0.0055, 4, 0.05));
      n++;
    }
  }
  P('Servo fuel lines', {
    system: 'Fuel', material: 'Small stainless tubes in pairs (head and rod side of each actuator)', mass: 10, count: n,
    explode: [0.2, -0.35, 1.25], temp: 330,
    desc: 'The HMU uses high-pressure fuel as hydraulic fluid, so every fuel-powered actuator gets a pair of tubes, one to each side of its piston: the two VBV and two VSV actuators and the HPT and LPT clearance-control valves, plus one to the booster anti-ice valve. One VBV actuator supply tube (P/N 2165M22P01) had a natural frequency inside the cruise vibration range; it cracked at its end weld and one leak caused an under-cowl fire (FAA AD 2013-23-18).',
  }, m(merge(servo), GM.steel()));

  // ================================================================== lubrication
  P('Static anti-leak valve', {
    system: 'Drive system', material: 'Spring-loaded check valve (Techspace Aero)', mass: 0.6,
    explode: [0.25, -0.35, 1.85], temp: 340,
    desc: 'In the supply line at the tank\'s outlet: while the engine is stopped it shuts, so oil cannot siphon from the tank into the gearbox and sumps; the pump\'s suction opens it at start.',
  }, m(merge([axialCyl(AT.tankOut[0], AT.tankOut[1], AT.tankOut[2], 0.022, 0.08, 14), axialCyl(AT.tankOut[0], AT.tankOut[1], AT.tankOut[2], 0.027, 0.012, 6)]), GM.oil()));
  const supplyAft = [[0.8, -1.82, BOTTOM + 0.022], [0.64, -1.98, 1.63], [0.68, -2.3, 1.68], [0.7, -2.55, 1.68], [0.705, -2.75, 1.68], [0.84, -3.12, 1.65], [0.95, -3.3, 1.62], [0.95, -3.86, 1.6], [0.88, -4.25, 1.58], [0.87, -4.52, BOTTOM], [0.94, -4.85, BOTTOM], [0.945, -5.0, BOTTOM], [0.93, -5.12, BOTTOM], [0.8, -5.24, BOTTOM], [0.45, -5.3, BOTTOM]];
  P('Oil supply lines', {
    system: 'Drive system', material: 'Stainless-steel tubing', mass: 16,
    explode: [0.3, -0.1, 1.67], temp: 380,
    desc: 'Oil leaves the tank through the anti-leak valve, runs round behind the gearbox to the lubrication unit\'s pressure element, and goes on from the main filter down the 6 o\'clock fan-frame strut to the forward sump, along the core to the turbine center frame\'s sump and in through a turbine-rear-frame strut to the aft sump.',
  }, m(merge([
    line([[AT.tankOut[0], AT.tankOut[1] - 0.04, AT.tankOut[2]], [1.83, -1.32, 0.44], [1.8, -1.44, 0.48], ...arc(1.8, -1.44, 0.52, 1.32, 0.08), [1.8, -1.4, 1.36], [1.8, -1.0, 1.36], [1.8, -0.66, 1.365], [1.78, -0.57, 1.348], [1.775, -0.52, 1.3], at(AT.unitSupply)], 0.012),
    line([[2.025, -0.45, 1.222], [2.05, -0.38, 1.27], [2.0, -0.3, 1.42], [1.98, -0.31, 1.55], [1.93, -0.45, 1.6], [1.9, -0.65, 1.605], [1.87, -1.0, 1.6], [1.82, -1.4, 1.6], [1.8, -1.6, 1.595], [1.74, -1.78, BOTTOM + 0.022], [1.6, -1.82, BOTTOM + 0.022], [0.8, -1.82, BOTTOM + 0.022], [0.45, -1.8, BOTTOM + 0.022], [0.32, -1.7, BOTTOM + 0.022]], 0.012),
    line(supplyAft, 0.012),
  ]), GM.oil()));
  const SCAV = BOTTOM + Math.PI / 6;     // the next fan-frame strut round
  P('Oil scavenge lines', {
    system: 'Drive system', material: 'Stainless-steel tubing', mass: 16,
    explode: [0.15, -0.1, 1.67], temp: 400,
    desc: 'Return oil sucked out of the aft, turbine-center-frame and forward sumps by the scavenge elements, up the next fan-frame strut and back round the gearbox to the lubrication unit. Scavenge lines are larger than supply lines because the returning oil is frothy with sump air.',
  }, m(merge([
    line([[0.32, -1.75, SCAV], [0.45, -1.82, SCAV], [0.8, -1.8, SCAV], [1.6, -1.78, SCAV], [1.8, -1.5, SCAV - 0.1], ...arc(1.86, -1.36, SCAV - 0.22, 1.44, 0.1), [1.86, -1.0, 1.42], [1.86, -0.66, 1.42], [1.86, -0.6, 1.38], [1.855, -0.48, 1.3], at(AT.unitScavIn)], 0.014),
    line([[0.45, -5.3, 2.02], [0.8, -5.24, 2.02], [0.93, -5.12, 2.02], [0.945, -5.0, 2.02], [0.94, -4.85, 2.02], [0.87, -4.52, 2.03], [0.88, -4.25, 2.04], [0.95, -3.85, 2.05], [0.95, -3.3, 2.06], [0.84, -3.12, 2.07], [0.705, -2.75, 2.08], [0.7, -2.55, 2.085], [0.68, -2.3, 2.09], [0.64, -1.98, SCAV], [0.8, -1.8, SCAV]], 0.014),
  ]), GM.oil()));
  P('Oil return line', {
    system: 'Drive system', material: 'Stainless-steel tubing', mass: 6,
    explode: [0.42, 0.15, 1.8], temp: 400,
    desc: 'Closes the oil loop: from the scavenge elements through the scavenge filter and the debris monitor, then through the main fuel/oil heat exchanger, where the hot oil gives its heat to the fuel, forward round the gearbox and aft over its cover to the VSCF/lube oil-oil cooler on the backup generator, where the cooled oil takes up that generator\'s heat, and back to the top of the tank to de-aerate (routing estimated).',
  }, m(merge([
    line([at(AT.unitScavOut), [1.95, -0.6, 1.21], [1.965, -0.64, 1.235], at(AT.scavFilterIn)], 0.012),
    line([[1.96, -0.73, 1.262], [1.96, -0.755, 1.28], [1.96, -0.772, 1.296]], 0.012),
    line([at(AT.dmsOut), [1.97, -0.99, 1.32], [1.95, -0.96, 1.36], [1.95, -0.66, 1.36], [1.9, -0.56, 1.352], at(AT.hxOilIn)], 0.012),
    line([at(AT.hxOilOut), [1.9, -0.12, 1.53], [1.975, -0.2, 1.45], ...arc(1.975, -0.2, 1.4, 0.58, 0.08), [1.97, -0.25, 0.51], [1.955, -0.32, 0.5], [1.955, -0.66, 0.5], [1.962, -0.88, 0.5], [1.965, -0.975, 0.5], [1.965, -1.0, 0.5]], 0.013),
    line([[1.965, -1.08, 0.475], [1.975, -1.07, 0.455], [2.0, -1.0, 0.42], [2.007, -0.92, 0.34], [2.0, -0.885, 0.285], [1.965, -0.865, 0.258], at(AT.tankReturn)], 0.013),
  ]), GM.oil()));
  P('Oil tank vent line', {
    system: 'Drive system', material: 'Aluminium tube', mass: 2,
    explode: [0.45, -0.25, 2.05], temp: 340,
    desc: 'From the high end of the tank to the deoiler, so the air that comes out of the returning oil, and the tank\'s breathing as the oil level changes, is cleaned of oil mist before it is vented overboard.',
  }, m(line([at(AT.tankVent), [1.99, -1.06, 0.18], [2.03, -1.12, 0.26], ...arc(2.03, -1.12, 0.3, 1.2, 0.08), [1.97, -1.12, 1.27], [1.88, -1.1, 1.3], at(AT.deoilerIn)], 0.01), GM.duct()));
  P('Oil pressure & temperature sensors', {
    system: 'Sensors', material: 'Pressure transmitter on the filter head and resistance-thermometer probe', mass: 1, count: 2,
    explode: [0.42, 0.35, 1.55], temp: 370,
    desc: 'Measure the oil leaving the pump for the cockpit gauges and the FADEC: the -115B\'s minimum oil pressure is 69 kPa differential (EASA type certificate), and low pressure or high temperature are among the first signs of a lubrication problem.',
  }, m(merge([boxAt(2.05, -0.45, 1.2, [0.03, 0.04, 0.04]), tangentCyl(1.99, -0.45, 1.18, 0.008, 0.03, 8), boxAt(1.99, -0.45, 1.168, [0.02, 0.025, 0.012])]), GM.connector()));

  // ================================================================== sensors
  P('T12 fan-inlet temperature sensor', {
    system: 'Sensors', material: 'Resistance-thermometer probe', mass: 1,
    explode: [0.1, 0.6, 0.87], temp: 288,
    desc: 'Measures the air temperature entering the fan. The FADEC divides speed by the square root of this temperature to get corrected speed — what a compressor really responds to.',
  }, m(merge([radialCyl(1.56, 1.67, 0.18, 0.42, 0.01, 8), boxAt(1.7, 0.18, 0.42, [0.06, 0.07, 0.06])]), GM.steel()));
  P('N1 speed sensor', {
    system: 'Sensors', material: 'Magnetic pick-up probe', mass: 2,
    explode: [0.14, 0.0, 1.01], temp: 300,
    desc: 'A long probe down a fan-frame strut that counts teeth on a wheel on the fan shaft. N1 (fan speed) is the GE90\'s primary thrust-setting parameter: the FADEC sets thrust by holding a target N1.',
  }, m(merge([radialCyl(0.33, 1.76, -1.7, PHI.n1, 0.011, 8), boxAt(1.78, -1.7, PHI.n1, [0.05, 0.08, 0.08])]), GM.steel()));
  // T25/PT25: a probe across the HPC inlet with a wedge ice shield on its upstream face
  const shield = new THREE.CylinderGeometry(0.022, 0.022, 0.08, 3).rotateZ(-Math.PI / 2).rotateX(-Math.PI / 2).translate(0.49, -2.06 + 0.012, 0);
  const coreA = [[1.6, -1.66, 0.538], [1.2, -1.66, 0.538], [0.95, -1.68, 0.538], [0.82, -1.98, 0.58], [0.72, -2.1, 0.62], [0.69, -2.4, 0.65], [0.7, -2.6, 0.64], [0.725, -2.8, 0.66], [0.735, -3.0, 0.72], [0.8, -3.3, 0.7], [0.82, -3.6, 0.62], [0.83, -3.95, 0.52], [0.85, -4.02, 0.5]];
  // channel B's route from the FADEC over the oil tank, ending aft of the gearbox (and of the IDG)
  const fanAft = (dPhi, dy) => [[1.915, -0.51, 0.29 + dPhi], [1.95, -0.6, 0.3 + dPhi], [1.965, -0.85, 0.31 + dPhi], [1.965, -1.36 + dy, 0.3 + dPhi], [1.965, -1.4 + dy, 0.38]];
  P('T25/PT25 sensor', {
    system: 'Sensors', material: 'Goodrich temperature/pressure probe with extended wedge ice shield', mass: 1,
    explode: [0.12, -0.5, 0.87], temp: 375,
    desc: 'Measures temperature and pressure at the HP-compressor inlet; the FADEC schedules the variable stators from it, and its pressure is piped to the control through the small tube along the core harness. The type certificate requires some configurations to carry the "PT25 extended wedge ice shield" (Service Bulletin 77-008) together with a FADEC software update.',
  }, m(merge([radialCyl(0.45, 0.64, -2.06, 0.75, 0.009, 8), boxAt(0.65, -2.06, 0.75, [0.04, 0.05, 0.05]), atPhi(shield, 0.75),
    line([[0.67, -2.06, 0.75], [0.72, -2.08, 0.66], ...coreA.slice(0, 5).reverse().map(([r, y, p]) => [r, y - 0.012, p + 0.008]), [1.7, -1.652, 0.545], [1.76, -1.6, 0.52], [1.86, -1.51, 0.505], [1.955, -1.42, 0.39], ...fanAft(0.02, -0.012).reverse().slice(1, -1), [1.88, -0.4, 0.31], [1.9, -0.34, 0.3]], 0.004, 5)]), GM.steel()));
  P('T3 / PS3 sensors', {
    system: 'Sensors', material: 'Thermocouple probe and static-pressure tap', mass: 1,
    explode: [0.12, -1.0, 0.87], temp: 900,
    desc: 'Compressor discharge temperature and pressure, close to 920 K and 4.2 MPa at take-off (modelled). PS3 is a key FADEC input for fuel scheduling and surge protection.',
  }, m(merge([radialCyl(0.47, 0.82, -3.2, 0.78, 0.009, 8), boxAt(0.83, -3.2, 0.78, [0.04, 0.05, 0.05]), radialCyl(0.76, 0.84, -3.12, 0.85, 0.008, 8)]), GM.steel()));
  P('PS3 sense line & pressure transducers', {
    system: 'Sensors', material: 'Stainless sense tube to three Kulite pressure transducers beside the FADEC (location estimated)', mass: 2, count: 3,
    explode: [0.2, -0.6, 1.3], temp: 500,
    desc: 'A thin tube carries compressor-discharge static pressure, about 4.2 MPa at take-off (modelled), from its tap on the combustion case along the core harness, up a fan-frame strut and over the oil tank to separate Kulite transducers near the FADEC, which turn it into the electrical signal the control uses for fuel scheduling and surge detection.',
  }, m(merge([
    line([[0.84, -3.12, 0.85], [0.8, -3.0, 0.76], [0.73, -2.66, 0.66], [0.7, -2.4, 0.66], [0.73, -2.1, 0.63], [0.84, -1.96, 0.58], [0.96, -1.82, 0.528], [1.2, -1.82, 0.528], [1.6, -1.82, 0.528], [1.72, -1.72, 0.488], [1.86, -1.52, 0.46], [1.955, -1.38, 0.36], [1.955, -0.85, 0.36], [1.9, -0.72, 0.25], [1.81, -0.7, 0.215]], 0.005, 5),
    ...[0.17, 0.2, 0.23].map((p) => axialCyl(1.79, -0.68, p, 0.013, 0.05, 10)),
  ]), GM.steel()));
  const egtProbes = cutPair((keep) => {
    const list = [];
    for (let i = 0; i < 12; i++) {
      const phi = ((i + 0.5) / 12) * TAU;
      if (!keep(phi)) continue;
      list.push(radialCyl(0.645, 0.81, -4.165, phi, 0.008, 6), boxAt(0.815, -4.165, phi, [0.03, 0.04, 0.04]));
    }
    return merge(list);
  }, GM.connector());
  P('EGT thermocouples (T49)', {
    system: 'Sensors', material: 'Chromel–alumel thermocouple probes through the turbine center frame\'s aft edge (count estimated)', mass: 3, count: 12,
    explode: [-0.85, -1.55, 0.51], temp: 1200,
    desc: 'A ring of probes at the LP turbine inlet, between the frame\'s struts, averaged into the exhaust gas temperature shown in the cockpit. EGT margin — how far below the 1,090 °C take-off limit (1,050 °C continuous) an engine runs — shrinks as it wears and is how airlines decide when to overhaul it.',
  }, cut(egtProbes));
  P('EGT (T4.9) thermocouple harness', {
    system: 'Electrical', material: 'Flexible thermocouple harness ring and lead (LaBarge type)', mass: 2,
    explode: [-0.95, -1.55, 0.65], temp: 900,
    desc: 'A ring of thermocouple wire joins the probes in parallel, so the signal it carries is already their average, and a lead takes it to a junction box on the core where the core harness picks it up for the FADEC.',
  }, [cut(cutPair((keep) => hoop(0.83, -4.165, 0.01, { tubular: 96, start: keep.start, arc: keep.arc }), GM.braid())), m(merge([line([[0.83, -4.165, 0.5], [0.84, -4.1, 0.5], [0.855, -4.035, 0.5]], 0.008), boxAt(0.87, -4.02, 0.5, [0.04, 0.05, 0.06])]), GM.braid())]);
  P('N2 speed sensor', {
    system: 'Sensors', material: 'Magnetic pick-up', mass: 1,
    explode: [0.37, -0.3, 2.17], temp: 330,
    desc: 'Counts gear teeth in the accessory gearbox, which turns at a fixed ratio to the HP spool.',
  }, m(axialCyl(1.875, -0.99, 1.27, 0.02, 0.1, 10), GM.steel()));
  // #1 bearing accelerometer: on the bearing support inside the forward sump, its lead out through a strut
  P('#1 bearing accelerometer', {
    system: 'Sensors', material: 'Vibro-Meter piezoelectric accelerometer with a mineral-insulated lead', mass: 0.6,
    explode: [0.2, 0.3, 0.9], temp: 360,
    desc: 'One of the -115B\'s two vibration sensors, mounted right on the #1 bearing\'s support inside the forward sump, so fan imbalance from ice or a damaged blade is measured at its source. Its lead runs back along the sump cone and out through a fan-frame strut to a junction on the fan case.',
  }, m(merge([boxAt(0.205, -0.625, 0.5, [0.04, 0.04, 0.04]),
    line([[0.205, -0.648, 0.5], [0.18, -0.8, 0.5], [0.18, -0.92, 0.5], [0.245, -1.3, 0.5], [0.315, -1.68, 0.51], [0.4, -1.86, PHI.n1], [0.77, -1.88, PHI.n1], [1.0, -1.88, PHI.n1], [1.62, -1.88, PHI.n1], [1.7, -1.8, 0.476], [1.745, -1.68, 0.474], [1.768, -1.625, 0.49]], 0.005, 5),
    boxAt(1.78, -1.6, 0.5, [0.035, 0.05, 0.05])]), GM.connector()));

  // ================================================================== harnesses
  // each FADEC channel has its own looms: channel A forward along the fan case, channel B aft over
  // the oil tank and down a fan-frame strut with the core harnesses
  const trunk = (y) => [[1.915, y - 0.02, 0.205], [1.93, y, 0.3], [1.86, y, 0.37], [1.76, y, 0.4], ...arc(1.75, y, 0.42, 1.62, 0.08)];
  const fan = [
    line(trunk(-0.13), 0.013), line(trunk(-0.18), 0.012),
    line([[1.915, -0.15, 0.19], [1.945, -0.1, 0.24], [1.86, 0.02, 0.36], [1.79, 0.1, 0.41], [1.73, 0.18, 0.42]], 0.01),                      // T12
    line([[1.75, -0.13, 1.0], [1.78, -0.2, 1.0], [1.8, -0.255, 1.0]], 0.008), line([[1.75, -0.18, 0.97], [1.78, -0.23, 0.97], [1.8, -0.258, 0.97]], 0.008), // HMU, both channels
    line([[1.75, -0.13, 1.22], [1.9, -0.2, 1.24], [2.05, -0.3, 1.235], [2.07, -0.4, 1.21], [2.066, -0.45, 1.2]], 0.007),                     // oil pressure
    line([[1.75, -0.13, 1.52], [1.85, -0.4, 1.525], [1.91, -0.5, 1.5], [1.955, -0.5, 1.445]], 0.007),                                         // fuel/oil temperature
    line([[1.75, -0.13, 1.62], [1.76, -0.5, 1.65], [1.78, -0.9, 1.65], [1.85, -1.12, 1.55], [1.885, -1.15, 1.48]], 0.008),                   // fuel flow
    // over the gearbox to the DMS sensor, the PMA and the N2 sensor
    line([[1.915, -0.39, 0.29], [1.95, -0.5, 0.3], [1.955, -0.68, 0.36], [2.06, -0.86, 0.42], ...arc(2.06, -0.86, 0.46, 1.25, 0.08), [2.0, -0.9, 1.3], [1.985, -0.88, 1.3]], 0.01),
    line([[2.06, -0.86, 1.21], [2.0, -0.97, 1.213], [1.93, -0.99, 1.21], [1.91, -0.99, 1.21]], 0.008),
    line([[2.06, -0.86, 1.27], [1.97, -0.98, 1.27], [1.9, -1.05, 1.27], [1.875, -1.045, 1.27]], 0.007),
    line([[1.8, -0.62, 0.33], [1.85, -0.6, 0.3], [1.915, -0.52, 0.295]], 0.008),                                                            // DMS conditioner
    line([[1.79, -0.655, 0.2], [1.85, -0.6, 0.21], [1.915, -0.53, 0.19]], 0.007),                                                           // PS3 transducers
    // channel B aft: over the tank to the oil level sensor, N1 sensor and #1 bearing accelerometer junction
    line([...fanAft(0, 0), [1.9, -1.43, 0.45], [1.82, -1.5, 0.5], [1.79, -1.56, 0.5]], 0.016), line([[1.965, -1.33, 0.3], [1.99, -1.33, 0.2], [1.99, -1.33, 0.17]], 0.006),
    line([[1.9, -1.43, 0.46], [1.82, -1.5, 0.53], [1.8, -1.62, 0.526], [1.805, -1.68, PHI.n1]], 0.008),
  ];
  P('Fan harnesses (W701–W719)', {
    system: 'Electrical', material: 'Shielded, fire-resistant looms in braided sleeves (GE W701–W704, W707–W709, W719)', mass: 30,
    explode: [0.21, -0.2, 2.03], temp: 320,
    desc: 'The fan-case looms join the FADEC to the sensors and units round it: T12, the N1 and N2 sensors, the PMA, HMU, oil and fuel sensors, the debris monitor and the PS3 transducers. Each FADEC channel has its own looms on separate routes, so one chafed harness cannot blind both.',
  }, m(merge(fan), GM.harness()));
  const coreB = [[1.6, -1.76, 0.508], [1.2, -1.76, 0.512], [0.95, -1.78, 0.512], [0.82, -2.02, 0.48], [0.74, -2.15, 0.44], [0.72, -2.4, 0.43], [0.74, -3.0, 0.46], [0.8, -3.6, 0.42], [0.84, -3.9, 0.36], [0.97, -3.92, 0.32]];
  const core = [
    line([[1.965, -1.395, 0.39], [1.9, -1.44, 0.47], [1.84, -1.5, 0.51], [1.77, -1.58, 0.534], [1.7, -1.64, 0.537], ...coreA], 0.014),
    line([[1.965, -1.405, 0.37], [1.88, -1.43, 0.44], [1.8, -1.48, 0.5], [1.76, -1.62, 0.503], [1.7, -1.74, 0.503], ...coreB], 0.014),
    line([[0.72, -2.1, 0.62], [0.72, -2.07, 0.7], [0.68, -2.06, 0.75]], 0.007),                                       // T25
    line([[0.75, -3.1, 0.715], [0.84, -3.17, 0.76], [0.85, -3.2, 0.78]], 0.007),                                      // T3
    line([[0.7, -2.6, 0.64], [0.69, -2.645, 0.632], [0.668, -2.66, 0.63]], 0.009),                                   // to the distributor ring
    line([[0.8, -3.3, 0.7], [0.88, -3.36, 0.76], ...arc(0.96, -3.36, 0.82, 1.3, 0.08), [0.962, -3.31, 1.34], [0.958, -3.27, 1.358], [0.952, -3.262, 1.36]], 0.007), // fuel manifold pressure
    line([[0.83, -3.95, 0.52], [0.8, -4.05, 0.6], [0.783, -4.1, 0.64]], 0.007),                                       // TCF accelerometer
    line([[1.0, -1.7, 0.512], [0.92, -1.6, 0.6], [0.9, -1.5, 0.72], [0.888, -1.45, 0.75]], 0.007),                     // VBV actuator position
    line([[0.74, -2.15, 0.44], [0.705, -2.3, 0.38], [0.693, -2.32, 0.36]], 0.007),                                    // VSV actuator position
    line([[0.82, -1.98, 0.58], ...arc(0.9, -2.06, 0.62, 1.12, 0.08), [0.93, -2.1, 1.16], [0.96, -2.1, 1.18]], 0.008), // core compartment cooling valve
    // distributor ring round the HP compressor to the far-side actuators
    hoop(0.665, -2.66, 0.012, { tubular: 100, arc: 4.3 }),
    ...Array.from({ length: 11 }, (_, k) => boxAt(0.665, -2.66, (k / 10) * 4.3, [0.01, 0.02, 0.05])),
    line([[0.665, -2.66, 3.49], [0.7, -2.6, 3.505], [0.715, -2.5, 3.51], [0.708, -2.36, 3.503], [0.697, -2.33, 3.5]], 0.007),
    line([[0.665, -2.66, 3.89], [0.72, -2.3, 3.9], [0.75, -2.05, 3.9], [0.86, -1.75, 3.88], [0.888, -1.5, 3.89]], 0.007),
  ];
  P('Core harnesses (W721–W739)', {
    system: 'Electrical', material: 'High-temperature looms in braided sleeves (GE W721–W724, W727–W729, W731, W732, W737–W739)', mass: 24,
    explode: [0.5, -0.9, 1.5], temp: 450,
    desc: 'Two looms, one per FADEC channel, run down a fan-frame strut into the core compartment and along the casings to T25, T3, the fuel manifold pressure sensor, the VSV and VBV actuator position sensors, the clearance-control valves, the core compartment cooling valve, the TCF accelerometer and the EGT junction, with a ring round the compressor for the far side.',
  }, m(merge(core), GM.harness()));
  P('Nacelle harnesses (W717, W718)', {
    system: 'Electrical', material: 'Looms to the strut disconnect panel (GE W717, W718)', mass: 6, count: 2,
    explode: [0.1, 0.3, 1.2], temp: 300,
    desc: 'Join the FADEC to the 777 through connectors at the strut: thrust-lever and air-data inputs, reverser commands and the engine data the cockpit displays (cut away with the case here).',
  }, C((keep) => merge([0.15, 0.42].map((y) => cutTube([P3(1.82, -y, 0.13), P3(1.84, -y - 0.02, 0.08), ...arc(1.85, -y - 0.05, 0.04, UP + 0.1 - TAU, 0.1), P3(1.95, -0.6 - y * 0.2, UP + 0.07 - TAU), P3(2.02, -0.95, UP + 0.05 - TAU)], 0.012, keep, { radial: 6 })).concat(keep(UP + 0.05) ? [boxAt(2.04, -1.0, UP + 0.05, [0.04, 0.08, 0.06])] : [])), GM.harness()));

  // ================================================================== valves on the core
  P('Booster anti-ice valve', {
    system: 'Environmental control', material: 'Parker fuel-actuated valve with a duct to the splitter (routing estimated)', mass: 3,
    explode: [-0.3, -0.5, 1.0], temp: 450,
    desc: 'Listed only for the -110B1/-113B/-115B: opened by servo fuel from the HMU, it lets warm compressor air forward through the fan hub frame to keep ice off the booster inlet. GE does not publish its routing; the duct here is drawn through the frame to the splitter.',
  }, m(merge([axialCyl(0.66, -2.15, 1.25, 0.028, 0.07, 14), boxAt(0.695, -2.15, 1.25, [0.03, 0.05, 0.04]), radialCyl(0.56, 0.635, -2.17, 1.25, 0.018, 10),
    line([[0.66, -2.118, 1.25], [0.665, -2.0, 1.27], [0.78, -1.84, 1.3], [0.86, -1.6, 1.32], [0.87, -1.2, 1.33], [0.875, -0.82, 1.33]], 0.018, 8)]), GM.duct()));
  P('Core compartment cooling valve', {
    system: 'Thermal control', material: 'Parker FADEC-commanded butterfly valve and duct (location estimated)', mass: 3,
    explode: [0.4, -0.55, 0.9], temp: 400,
    desc: 'Admits fan air through the core cowl into the core compartment, where fuel and oil lines and harnesses run beside casings near 900 K. It is listed for the -110B1/-113B/-115B; its air source and position are not published, and fan air from the bypass duct is drawn here.',
  }, m(merge([radialCyl(0.92, 1.035, -2.1, 1.2, 0.045, 14), tangentCyl(0.965, -2.1, 1.2, 0.048, 0.012, 14), boxAt(0.965, -2.1, 1.155, [0.05, 0.06, 0.04])]), GM.aluminium()));
  P('Sump eductor & shutoff valves', {
    system: 'Drive system', material: 'Whittaker eductor valve and hand-operated shutoff valve with their pipes (positions estimated)', mass: 3, count: 2,
    explode: [-0.4, -0.55, -0.5], temp: 500,
    desc: 'An eductor is a jet pump: compressor air blown in at its side drags the forward sump\'s vent air, which enters at its front, out through its back and overboard, keeping the bearing sumps below their seal-air pressure at low power so oil cannot weep out. A hand-operated shutoff valve sits in the compressor-air line.',
  }, m(merge([
    axialCyl(0.67, -2.15, 2.45, 0.026, 0.08, 12), tangentCyl(0.67, -2.16, 2.49, 0.014, 0.012, 8), radialCyl(0.575, 0.6, -2.7, 2.5, 0.014, 8),
    line([[0.6, -2.7, 2.5], [0.632, -2.5, 2.5], [0.648, -2.3, 2.5], [0.665, -2.2, 2.497], [0.67, -2.16, 2.492]], 0.012), axialCyl(0.639, -2.45, 2.5, 0.02, 0.05, 10), boxAt(0.667, -2.45, 2.5, [0.04, 0.012, 0.012]),
    line([[0.31, -1.72, 2.618], [0.4, -1.86, 2.618], [0.6, -1.9, 2.618], [0.668, -2.05, 2.55], [0.672, -2.09, 2.48], [0.67, -2.112, 2.455]], 0.014),
    line([[0.67, -2.188, 2.45], [0.75, -2.29, 2.42], [0.95, -2.4, 2.4], [1.02, -2.42, 2.4]], 0.016),
  ]), GM.duct()));

  void coreAt;
}
