// Accessory drive and engine systems: inlet gearbox, radial drive shaft, transfer gearbox and the
// fan-case accessory gearbox with its starter, pumps, HMU, IDG and alternator; FADEC; oil, fuel,
// bleed and anti-ice plumbing; harnesses; ignition exciters; and the main sensors.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { GM } from './materials.js';
import { coreAt, FAN } from './layout.js';
import { cutLathe, cutPair, sector, boxAt, axialCyl, radialCyl, hoop, merge, P3, tube } from './geom.js';

const TAU = Math.PI * 2;
const UP = Math.PI * 1.5;
const BOTTOM = Math.PI / 2;
export const PHI = { radial: Math.PI / 3, n1: Math.PI / 6, fadec: 0.24, tank: 0.25, agb0: 0.48, agb1: 1.34 };

// accessory pads on the gearbox: [name, phi, radius, length, face (+1 forward, −1 aft)]
const R_AGB = 1.845, Y_AGB_F = -0.56, Y_AGB_A = -0.94;

const m = (g, mat) => mesh(g, mat);
const strap = (r, y, phi, w = 0.02) => boxAt(r, y, phi, [0.01, w, 0.05]);

export function buildAccessories(ctx) {
  const { P, cut } = ctx;

  // ------------------------------------------------------------------ inlet gearbox (bevel set on the HP shaft)
  const igbRing = cutLathe([[0.166, -1.905], [0.24, -1.915], [0.24, -1.935], [0.166, -1.945]], GM.bronze(), { seg: 48 });
  const igbBox = m(merge([radialCyl(0.24, 0.31, -1.86, PHI.radial, 0.035, 14), boxAt(0.3, -1.88, PHI.radial, [0.1, 0.12, 0.12])]), GM.casingDark());
  P('Inlet gearbox', {
    system: 'Drive system', material: 'Steel bevel gears in a cast housing', mass: 15,
    explode: [0.25, -0.15, 0.4], temp: 380,
    desc: 'A bevel gear on the front of the HP shaft turns the drive through 90° into the radial shaft. Accessories run off the HP spool because it is the one the starter has to turn, and it keeps a steady speed range.',
  }, [cut(igbRing), igbBox]);

  // ------------------------------------------------------------------ radial and horizontal drive shafts
  const radial = m(merge([radialCyl(0.31, 1.76, -1.84, PHI.radial, 0.026, 12), radialCyl(0.9, 1.0, -1.84, PHI.radial, 0.034, 12)]), GM.shaft());
  P('Radial drive shaft', {
    system: 'Drive system', material: 'Steel tube with splined ends', mass: 12,
    explode: [0.55, -0.15, 0.7], temp: 330,
    desc: 'Runs out through a fan-frame strut — across both the core duct and the bypass duct — to the transfer gearbox on the fan case. At start it carries the starter\'s torque the other way, inwards, to spin the HP spool.',
  }, radial);
  const tgb = m(merge([boxAt(1.83, -1.72, PHI.radial, [0.16, 0.26, 0.26]), axialCyl(1.83, -1.55, PHI.radial, 0.05, 0.1, 16), radialCyl(1.72, 1.76, -1.84, PHI.radial, 0.05, 16)]), GM.magnesium());
  P('Transfer gearbox', {
    system: 'Drive system', material: 'Cast aluminium housing, bevel gears', mass: 28,
    explode: [0.7, -0.1, 0.85], temp: 340,
    desc: 'Turns the drive from the radial shaft into a shaft running forward along the fan case to the accessory gearbox.',
  }, tgb);
  const horiz = m(axialCyl(1.83, -1.24, PHI.radial, 0.024, 0.62, 12), GM.shaft());
  P('Horizontal drive shaft', {
    system: 'Drive system', material: 'Steel tube', mass: 9,
    explode: [0.75, 0.05, 0.95], temp: 320,
    desc: 'Links the transfer gearbox to the accessory gearbox.',
  }, horiz);

  // ------------------------------------------------------------------ accessory gearbox
  const agbBody = sector(1.77, 1.92, Y_AGB_F, Y_AGB_A, PHI.agb0, PHI.agb1, 28);
  const pads = [];
  const accs = [['starter', 0.62, 0.105, 1], ['fuel', 0.82, 0.085, 1], ['hmu', 1.0, 0.07, 1], ['lube', 1.2, 0.075, 1], ['idg', 0.7, 0.135, -1], ['edp', 0.95, 0.085, -1], ['pma', 1.21, 0.06, -1], ['hds', PHI.radial, 0.035, -1]];
  for (const [, phi, rad, face] of accs) pads.push(axialCyl(R_AGB, face > 0 ? Y_AGB_F + 0.02 : Y_AGB_A - 0.02, phi, rad + 0.02, 0.04, 20));
  for (const phi of [0.55, 0.9, 1.25]) pads.push(radialCyl(1.74, 1.77, -0.75, phi, 0.025, 8));      // mounting links to the fan case
  P('Accessory gearbox', {
    system: 'Drive system', material: 'Cast aluminium/magnesium housing, spur gear train', mass: 140,
    explode: [0.9, 0.1, 1.05], temp: 360,
    desc: 'A crescent-shaped gearbox hung under the fan case. Its gear train drives every pad at its own speed: starter, fuel pump and HMU, lube and scavenge pump, the aircraft\'s generator and hydraulic pump, and the FADEC\'s own alternator.',
    callout: true, anchor: [1.62, -0.75, 1.0],
  }, m(merge([agbBody, ...pads]), GM.magnesium()));

  // ------------------------------------------------------------------ accessories on the forward face
  const fwd = (phi, rad, len) => axialCyl(R_AGB, Y_AGB_F + len / 2, phi, rad, len, 24);
  const aft = (phi, rad, len) => axialCyl(R_AGB, Y_AGB_A - len / 2, phi, rad, len, 24);
  P('Air turbine starter', {
    system: 'Propulsion', material: 'Aluminium housing, single-stage air turbine', mass: 40,
    explode: [1.0, 0.35, 1.2], temp: 300,
    desc: 'Compressed air from the APU, a running engine or a ground cart spins this small turbine, which turns the HP spool through the gearbox up to about a quarter of its speed before fuel is lit. A clutch disengages it once the engine runs.',
  }, m(merge([fwd(0.62, 0.105, 0.3), axialCyl(R_AGB, Y_AGB_F + 0.33, 0.62, 0.07, 0.06, 20), radialCyl(1.9, 1.96, -0.36, 0.62, 0.05, 14)]), GM.aluminium()));
  P('Main fuel pump', {
    system: 'Fuel', material: 'Aluminium housing, centrifugal boost stage and gear stage', mass: 32,
    explode: [1.0, 0.35, 1.3], temp: 300,
    desc: 'A centrifugal boost stage feeding a high-pressure gear pump, driven by the gearbox. It delivers far more fuel than the engine burns; the hydromechanical unit meters what is needed and returns the rest.',
  }, m(merge([fwd(0.82, 0.085, 0.24), axialCyl(R_AGB, Y_AGB_F + 0.26, 0.82, 0.05, 0.05, 16)]), GM.aluminium()));
  P('Hydromechanical unit (HMU)', {
    system: 'Fuel', material: 'Aluminium body with torque-motor servo valves', mass: 35,
    explode: [1.05, 0.35, 1.4], temp: 300,
    desc: 'The FADEC\'s muscles: electrically commanded valves meter fuel to the nozzles, and the same high-pressure fuel acts as hydraulic fluid to move the variable stators, bleed valves and clearance-control valves.',
  }, m(merge([boxAt(R_AGB + 0.01, Y_AGB_F + 0.15, 1.0, [0.14, 0.3, 0.2]), axialCyl(R_AGB + 0.07, Y_AGB_F + 0.18, 1.0, 0.025, 0.2, 10)]), GM.blue()));
  P('Lube & scavenge pump', {
    system: 'Drive system', material: 'Aluminium housing, gerotor elements', mass: 18,
    explode: [1.05, 0.35, 1.2], temp: 360,
    desc: 'One pressure element sends oil to the bearings and gears; several scavenge elements suck it back from each sump, through filters and coolers, to the tank. The lubrication system shares the drive system\'s colour here.',
  }, m(merge([fwd(1.2, 0.075, 0.2), boxAt(R_AGB, Y_AGB_F + 0.2, 1.2, [0.1, 0.06, 0.12])]), GM.oil()));

  // ------------------------------------------------------------------ accessories on the aft face
  P('Integrated drive generator (IDG)', {
    system: 'Electrical', material: 'Constant-speed drive and 120 kVA generator', mass: 70,
    explode: [1.0, -0.3, 1.25], temp: 330,
    desc: 'Generates the 777\'s 115 V, 400 Hz AC power. A hydraulic constant-speed drive inside holds the generator at a steady speed while the engine\'s speed varies.',
  }, m(merge([aft(0.7, 0.135, 0.42), axialCyl(R_AGB, Y_AGB_A - 0.44, 0.7, 0.09, 0.04, 20)]), GM.painted()));
  P('Engine-driven hydraulic pump', {
    system: 'Hydraulics', material: 'Variable-displacement piston pump', mass: 25,
    explode: [1.05, -0.3, 1.35], temp: 330,
    desc: 'Pressurises one of the 777\'s hydraulic systems to 3,000 psi (20.7 MPa) for flight controls, gear and brakes.',
  }, m(aft(0.95, 0.085, 0.26), GM.aluminium()));
  P('Permanent-magnet alternator', {
    system: 'Electrical', material: 'Permanent-magnet generator', mass: 8,
    explode: [1.05, -0.3, 1.45], temp: 330,
    desc: 'The FADEC\'s private power supply: once the engine turns fast enough, it powers the control even if the aircraft\'s electrical system fails.',
  }, m(aft(1.21, 0.06, 0.12), GM.avionics()));

  // ------------------------------------------------------------------ FADEC, oil tank and heat exchanger on the fan case
  const fadec = merge([
    boxAt(1.82, -0.32, PHI.fadec, [0.12, 0.5, 0.38]),
    ...[0.15, 0.27, 0.39].map((dy) => radialCyl(1.88, 1.92, -0.07 - dy, PHI.fadec + 0.05, 0.022, 12)),
    ...[-0.12, 0.12].map((dp) => radialCyl(1.75, 1.77, -0.32, PHI.fadec + dp, 0.02, 8)),
  ]);
  P('FADEC (electronic engine control)', {
    system: 'Avionics', material: 'Dual-channel computer in a fan-case-mounted, vibration-isolated box', mass: 25,
    explode: [0.7, 0.4, 1.3], temp: 300,
    desc: 'Full Authority Digital Engine Control: two independent channels, either able to run the engine alone, read dozens of sensors and schedule fuel, variable geometry and clearance control. The pilot\'s thrust lever only sends a request; the FADEC decides how to meet it within the engine\'s limits.',
    callout: true, anchor: [0.48, -0.32, 1.77],
  }, m(fadec, GM.avionics()));
  const tank = merge([sector(1.75, 1.93, -0.8, -1.36, PHI.tank - 0.16, PHI.tank + 0.16, 10), radialCyl(1.93, 1.97, -0.9, PHI.tank, 0.03, 12), boxAt(1.935, -1.12, PHI.tank + 0.1, [0.01, 0.08, 0.05])]);
  P('Oil tank', {
    system: 'Drive system', material: 'Aluminium tank with sight glass and filler', mass: 25,
    explode: [0.6, -0.2, 1.3], temp: 340,
    desc: 'Holds the engine\'s lubricating oil, which also carries heat away from the bearings and gears; it is checked through a sight glass after each flight. The lubrication system shares the drive system\'s colour here.',
  }, m(tank, GM.aluminium()));
  P('Fuel/oil heat exchanger', {
    system: 'Thermal control', material: 'Aluminium tube-bundle cooler', mass: 35,
    explode: [1.1, 0.3, 1.0], temp: 360,
    desc: 'Hot scavenged oil gives its heat to the cold fuel on its way to the burners — cooling the oil, warming the fuel so ice cannot block its filter, and putting the heat back into the cycle instead of wasting it.',
  }, m(merge([boxAt(1.84, -0.27, 1.44, [0.13, 0.38, 0.24]), axialCyl(1.84, -0.04, 1.44, 0.04, 0.08, 12), axialCyl(1.84, -0.5, 1.44, 0.04, 0.08, 12)]), GM.aluminium()));

  // ------------------------------------------------------------------ fuel lines
  const fuelSupply = [];
  for (let k = 0; k <= 24; k++) { const f = k / 24; fuelSupply.push(P3(1.9, -1.05 + 0.3 * f, UP - (UP - 0.82) * f)); }
  fuelSupply.push(P3(1.87, -0.55, 0.82));
  const toManifold = [P3(1.87, -0.25, 1.0), P3(1.88, -0.6, 1.25), P3(1.8, -1.2, 1.48), P3(1.6, -1.74, BOTTOM - 0.012), P3(1.1, -1.76, BOTTOM - 0.012), P3(0.85, -1.85, BOTTOM - 0.012), P3(0.7, -2.4, 1.45), P3(0.68, -3.0, 1.4), P3(0.86, -3.25, 1.36)];
  P('Fuel supply lines', {
    system: 'Fuel', material: 'Stainless-steel tubing', mass: 25,
    explode: [0.9, 0, 1.05], temp: 300,
    desc: 'Fuel comes from the wing tanks down the strut, round the fan case to the pump, through the heat exchanger and HMU, then down a bifurcation to the combustor manifolds.',
  }, m(merge([tube(fuelSupply, 0.022, { seg: 96 }), tube(toManifold, 0.016, { seg: 72 })]), GM.steel()));

  // ------------------------------------------------------------------ oil lines
  const oil = [
    tube([P3(1.86, -1.08, PHI.tank + 0.16), P3(1.88, -0.9, 0.7), P3(1.89, -0.6, 1.1), P3(1.87, -0.56, 1.2)], 0.014, { seg: 40 }),
    tube([P3(1.8, -0.95, 1.2), P3(1.75, -1.5, 1.45), P3(1.6, -1.8, BOTTOM + 0.012), P3(0.8, -1.82, BOTTOM + 0.012), P3(0.45, -1.8, BOTTOM + 0.012), P3(0.32, -1.7, BOTTOM + 0.012)], 0.012, { seg: 48 }),
    tube([P3(0.62, -1.95, BOTTOM + 0.06), P3(0.62, -2.6, 1.7), P3(0.72, -3.5, 1.7), P3(0.8, -4.3, 1.68), P3(0.98, -5.0, 1.65), P3(0.97, -5.3, 1.62), P3(0.45, -5.32, 1.62)], 0.012, { seg: 80 }),
  ];
  P('Oil supply & scavenge lines', {
    system: 'Drive system', material: 'Stainless-steel tubing', mass: 30,
    explode: [0.85, -0.1, 1.15], temp: 380,
    desc: 'Pressure lines to the forward and aft sumps and scavenge lines back. The aft line runs the length of the core and in through a turbine-rear-frame strut.',
  }, m(merge(oil), GM.oil()));

  // ------------------------------------------------------------------ bleed air and nacelle anti-ice
  const bleed = [
    radialCyl(coreAt(-2.61)[1] + 0.02, 0.66, -2.61, UP - 0.25, 0.05, 16), radialCyl(coreAt(-3.0)[1] + 0.02, 0.66, -3.0, UP - 0.25, 0.04, 16),
    axialCyl(0.7, -2.82, UP - 0.25, 0.065, 0.12, 20), axialCyl(0.82, -2.82, UP - 0.12, 0.07, 0.12, 20),
    tube([P3(0.66, -2.61, UP - 0.25), P3(0.7, -2.75, UP - 0.25), P3(0.7, -2.95, UP - 0.25), P3(0.66, -3.0, UP - 0.25)], 0.04, { seg: 16 }),
    tube([P3(0.7, -2.82, UP - 0.25), P3(0.8, -2.82, UP - 0.15), P3(1.1, -2.85, UP - 0.03), P3(1.6, -2.9, UP - 0.02), P3(2.05, -3.0, UP - 0.02)], 0.06, { seg: 40, radial: 12 }),
  ];
  P('Bleed air valves & ducts', {
    system: 'Environmental control', material: 'Inconel / stainless ducts, pneumatic shut-off valves', mass: 70,
    explode: [-1.0, -0.7, -0.35], temp: 700,
    desc: 'Air is tapped from a mid HP-compressor stage and from the compressor exit; a high-stage valve switches to the hotter source at low power. Ducts rise through the upper bifurcation to a precooler in the strut, then to the cabin packs, wing anti-ice and engine starting.',
  }, m(merge(bleed), GM.duct()));
  const nai = [
    tube([P3(coreAt(-3.0)[1] + 0.02, -3.0, UP - 0.42), P3(0.72, -2.9, UP - 0.4), P3(1.05, -2.5, UP - 0.035), P3(1.5, -2.0, UP - 0.035), P3(1.82, -1.62, UP - 0.12), P3(1.9, -1.2, UP - 0.12), P3(1.9, 0.1, UP - 0.12), P3(1.88, 0.4, UP - 0.12), P3(1.78, 1.2, UP - 0.12), P3(1.72, 1.55, UP - 0.12), P3(1.7, 1.68, UP - 0.12)], 0.035, { seg: 120, radial: 10 }),
    axialCyl(1.9, -0.9, UP - 0.12, 0.06, 0.16, 18),
    hoop(1.695, 1.69, 0.014, { tubular: 160 }),
  ];
  P('Nacelle anti-ice valve & duct', {
    system: 'Environmental control', material: 'Stainless duct, motorised valve, piccolo tube', mass: 30,
    explode: [-1.1, 0.4, -0.5], temp: 500,
    desc: 'Hot compressor air piped forward over the fan case into the inlet lip, where a perforated ring (the piccolo tube) sprays it round the inside of the lip to stop ice forming.',
  }, m(merge(nai), GM.duct()));

  // ------------------------------------------------------------------ harnesses
  const loom = [];
  const fa = (r, y, phi) => P3(r, y, phi);
  loom.push(tube([fa(1.8, -0.56, PHI.fadec), fa(1.79, 0.05, 0.4), fa(1.69, 0.18, 0.4)], 0.016, { seg: 30 }));
  loom.push(tube([fa(1.8, -0.57, PHI.fadec + 0.1), fa(1.8, -1.0, 0.45), fa(1.82, -1.6, PHI.n1), fa(1.79, -1.7, PHI.n1)], 0.016, { seg: 30 }));
  loom.push(tube([fa(1.79, -0.6, PHI.fadec + 0.15), fa(1.8, -0.75, 0.48)], 0.014, { seg: 8 }));
  loom.push(tube([fa(1.8, -0.58, PHI.fadec + 0.05), fa(1.79, -1.3, 0.3), fa(1.75, -1.66, PHI.n1 + 0.014), fa(1.2, -1.66, PHI.n1 + 0.014), fa(0.95, -1.68, PHI.n1 + 0.014), fa(0.68, -2.0, 0.6), fa(0.665, -2.66, 0.62), fa(0.7, -3.0, 0.7), fa(0.8, -3.6, 0.6), fa(0.82, -4.16, 0.5)], 0.018, { seg: 100 }));
  loom.push(hoop(0.665, -2.66, 0.014, { tubular: 120, arc: Math.PI * 1.5 }));
  for (let k = 0; k < 12; k++) { const phi = (k / 12) * Math.PI * 1.5; loom.push(strap(0.665, -2.66, phi)); }
  P('Electrical harnesses', {
    system: 'Electrical', material: 'Shielded, fire-resistant wiring looms in braided sleeves', mass: 60,
    explode: [0.6, -0.2, 1.4], temp: 380,
    desc: 'Twin, separately routed looms connect each FADEC channel to its own set of sensors and actuators, so a single chafed harness cannot take out both.',
  }, m(merge(loom), GM.harness()));

  // ------------------------------------------------------------------ ignition exciters (with leads to the igniters)
  const exc = [];
  for (const phi of [0.62, 2.52]) {
    exc.push(boxAt(0.66, -2.78, phi, [0.08, 0.22, 0.12]));
    exc.push(tube([P3(0.66, -2.9, phi), P3(0.7, -3.1, phi), P3(0.8, -3.3, phi), P3(0.84, -3.43, phi)], 0.01, { seg: 20 }));
  }
  P('Ignition exciters', {
    system: 'Electrical', material: 'Capacitor-discharge units', mass: 10, count: 2,
    explode: [0.55, -0.7, 0.75], temp: 420,
    desc: 'Each exciter stores energy in a capacitor and dumps it into its igniter as a spark of several joules, a few times a second. Two independent systems give redundancy.',
  }, m(merge(exc), GM.painted()));

  // ------------------------------------------------------------------ sensors
  P('T12 fan-inlet temperature sensor', {
    system: 'Sensors', material: 'Resistance-thermometer probe', mass: 1,
    explode: [0.3, 0.6, 0.6], temp: 288,
    desc: 'Measures the air temperature entering the fan. The FADEC divides speed by the square root of this temperature to get corrected speed — what a compressor really responds to.',
  }, m(merge([radialCyl(1.56, 1.67, 0.18, 0.42, 0.01, 8), boxAt(1.7, 0.18, 0.42, [0.06, 0.07, 0.06])]), GM.steel()));
  P('N1 speed sensor', {
    system: 'Sensors', material: 'Magnetic pick-up probe', mass: 2,
    explode: [0.4, 0, 0.7], temp: 300,
    desc: 'A long probe down a fan-frame strut that counts teeth on a wheel on the fan shaft. N1 (fan speed) is the GE90\'s primary thrust-setting parameter: the FADEC sets thrust by holding a target N1.',
  }, m(merge([radialCyl(0.33, 1.76, -1.7, PHI.n1, 0.011, 8), boxAt(1.78, -1.7, PHI.n1, [0.05, 0.08, 0.08])]), GM.steel()));
  P('T25 probe', {
    system: 'Sensors', material: 'Thermocouple / pressure probe', mass: 1,
    explode: [0.35, -0.5, 0.6], temp: 375,
    desc: 'Senses temperature (and pressure) at the HP compressor inlet; the FADEC uses it to schedule the variable stator vanes on corrected core speed.',
  }, m(merge([radialCyl(0.45, 0.64, -2.06, 0.75, 0.009, 8), boxAt(0.65, -2.06, 0.75, [0.04, 0.05, 0.05])]), GM.steel()));
  P('T3 / PS3 sensors', {
    system: 'Sensors', material: 'Thermocouple probe and static-pressure tap', mass: 1,
    explode: [0.35, -1.0, 0.6], temp: 900,
    desc: 'Compressor discharge temperature and pressure, close to 930 K and 4.2 MPa at take-off (modelled). PS3 is a key FADEC input for fuel scheduling and surge protection.',
  }, m(merge([radialCyl(0.47, 0.82, -3.2, 0.78, 0.009, 8), boxAt(0.83, -3.2, 0.78, [0.04, 0.05, 0.05]), radialCyl(0.76, 0.84, -3.12, 0.85, 0.008, 8)]), GM.steel()));
  const egt = cutPair((keep) => {
    const list = [];
    for (let i = 0; i < 12; i++) {
      const phi = ((i + 0.5) / 12) * TAU;
      if (!keep(phi)) continue;
      list.push(radialCyl(0.645, 0.81, -4.165, phi, 0.008, 6), boxAt(0.815, -4.165, phi, [0.03, 0.04, 0.04]));
    }
    list.push(hoop(0.83, -4.165, 0.01, { tubular: 120, arc: keep(Math.PI * 1.75) ? TAU : Math.PI * 1.5 }));
    return merge(list);
  }, GM.connector());
  P('EGT thermocouples (T49)', {
    system: 'Sensors', material: 'Chromel–alumel thermocouple probes on a harness ring (count estimated)', mass: 4, count: 12,
    explode: [-0.85, -1.55, 0.35], temp: 1200,
    desc: 'A ring of probes at the LP turbine inlet, averaged into the exhaust gas temperature shown in the cockpit. EGT margin — how far below the 1,090 °C limit a take-off runs — shrinks as the engine wears and is how airlines decide when to overhaul it.',
  }, cut(egt));
  P('N2 speed sensor', {
    system: 'Sensors', material: 'Magnetic pick-up', mass: 1,
    explode: [1.05, -0.3, 1.5], temp: 330,
    desc: 'Counts gear teeth in the accessory gearbox, which turns at a fixed ratio to the HP spool.',
  }, m(axialCyl(R_AGB + 0.03, Y_AGB_A - 0.05, 1.3, 0.02, 0.1, 10), GM.steel()));
  P('Vibration sensors', {
    system: 'Sensors', material: 'Piezoelectric accelerometers', mass: 2, count: 2,
    explode: [0.5, -0.5, 0.9], temp: 400,
    desc: 'One accelerometer near the #1 bearing on the fan frame and one on the turbine rear frame. They track once-per-revolution vibration of each spool: fan imbalance from ice or a damaged blade shows up here first.',
  }, m(merge([boxAt(1.74, -1.65, 0.12, [0.05, 0.05, 0.05]), boxAt(0.995, -5.25, 0.6, [0.05, 0.05, 0.05])]), GM.connector()));

  void FAN; void cutLathe;
}
