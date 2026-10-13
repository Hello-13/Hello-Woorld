// Accessory drive and engine systems: inlet gearbox, radial drive shaft, transfer gearbox and the
// fan-case accessory gearbox with its starter, pumps, HMU, generators and alternator; FADEC; the
// lubrication system (tank, pump, filters, chip detectors, deoiler, sensors, supply and scavenge
// lines); fuel, bleed, starting and anti-ice plumbing; hydraulic and electrical runs to the strut;
// drains; fire detection and extinguishing; harnesses; ignition; and the main sensors.
//
// Positions on the fan case are estimated (GE does not publish installation drawings). The gearbox
// hangs on the fan case on the viewer's side, below the horizontal (phi ≈ 0.42…1.34 rad); lines
// that run to the strut take the short way up that side, so the cutaway cuts them like the case.
// Items marked "aircraft (Boeing) equipment" are supplied with the 777 and driven or served by the
// engine; they are left out of the engine's certified dry weight.

import { mesh } from '../../engine/assembly.js';
import { GM } from './materials.js';
import { coreAt, ROWS } from './layout.js';
import { cutLathe, cutPair, sector, boxAt, axialCyl, radialCyl, hoop, merge, P3, tube, arc, cutTube, bladeGeometry, atPhi } from './geom.js';

const TAU = Math.PI * 2;
const UP = Math.PI * 1.5;
const BOTTOM = Math.PI / 2;
export const PHI = { radial: Math.PI / 3, n1: Math.PI / 6, fadec: 0.24, tank: 0.25, agb0: 0.42, agb1: 1.34 };

// accessory gearbox: centre radius, forward and aft face stations
const R_AGB = 1.845, Y_AGB_F = -0.56, Y_AGB_A = -0.94;

const m = (g, mat) => mesh(g, mat);
const strap = (r, y, phi, w = 0.02) => boxAt(r, y, phi, [0.01, w, 0.05]);
/** A small threaded plug: boss on the surface at r0 and a hex head out to r1. */
const plug = (r0, r1, y, phi, rad = 0.012) => merge([radialCyl(r0, r1, y, phi, rad, 10), radialCyl(r1, r1 + 0.012, y, phi, rad * 1.5, 6)]);

export function buildAccessories(ctx) {
  const { P, cut } = ctx;
  const C = (build, mat, which = 'engine') => cut(cutPair(build, mat, which));

  // ================================================================== drive train
  const igbRing = cut(cutLathe([[0.166, -1.905], [0.24, -1.915], [0.24, -1.935], [0.166, -1.945]], GM.bronze(), { seg: 48 }));
  const igbBox = m(merge([radialCyl(0.24, 0.31, -1.86, PHI.radial, 0.035, 14), boxAt(0.3, -1.88, PHI.radial, [0.1, 0.12, 0.12])]), GM.casingDark());
  P('Inlet gearbox', {
    system: 'Drive system', material: 'Steel bevel gears in a cast housing', mass: 15,
    explode: [0.09, -0.15, 0.58], temp: 380,
    desc: 'A bevel gear on the front of the HP shaft turns the drive through 90° into the radial shaft. Accessories run off the HP spool because it is the one the starter has to turn, and it keeps a steady speed range.',
  }, [igbRing, igbBox]);

  const radial = m(merge([radialCyl(0.31, 1.76, -1.84, PHI.radial, 0.026, 12), radialCyl(0.9, 1.0, -1.84, PHI.radial, 0.034, 12)]), GM.shaft());
  P('Radial drive shaft', {
    system: 'Drive system', material: 'Steel tube with splined ends', mass: 12,
    explode: [0.19, -0.15, 1.01], temp: 330,
    desc: 'Runs out through a fan-frame strut — across both the core duct and the bypass duct — to the transfer gearbox on the fan case. At start it carries the starter\'s torque the other way, inwards, to spin the HP spool.',
  }, radial);
  const tgb = m(merge([boxAt(1.83, -1.72, PHI.radial, [0.16, 0.26, 0.26]), axialCyl(1.83, -1.55, PHI.radial, 0.05, 0.1, 16), radialCyl(1.72, 1.76, -1.84, PHI.radial, 0.05, 16)]), GM.magnesium());
  P('Transfer gearbox', {
    system: 'Drive system', material: 'Cast aluminium housing, bevel gears', mass: 28,
    explode: [0.24, -0.1, 1.23], temp: 340,
    desc: 'Turns the drive from the radial shaft into a shaft running forward along the fan case to the accessory gearbox.',
  }, tgb);
  P('Horizontal drive shaft', {
    system: 'Drive system', material: 'Steel tube', mass: 9,
    explode: [0.26, 0.05, 1.38], temp: 320,
    desc: 'Links the transfer gearbox to the accessory gearbox.',
  }, m(axialCyl(1.83, -1.24, PHI.radial, 0.024, 0.62, 12), GM.shaft()));

  // ------------------------------------------------------------------ accessory gearbox
  const agbBody = sector(1.77, 1.92, Y_AGB_F, Y_AGB_A, PHI.agb0, PHI.agb1, 30);
  const pads = [];
  // pads: [phi, radius, face (+1 forward, −1 aft)]
  const accs = [[0.62, 0.105, 1], [0.82, 0.085, 1], [1.0, 0.07, 1], [1.2, 0.075, 1], [1.31, 0.035, 1], [0.5, 0.075, -1], [0.7, 0.135, -1], [0.95, 0.085, -1], [1.21, 0.06, -1], [PHI.radial, 0.035, -1], [1.3, 0.05, -1]];
  for (const [phi, rad, face] of accs) pads.push(axialCyl(R_AGB, face > 0 ? Y_AGB_F + 0.02 : Y_AGB_A - 0.02, phi, rad + 0.02, 0.04, 20));
  // mounting links to the fan case and the gearbox's own sump drain boss
  for (const phi of [0.5, 0.9, 1.25]) pads.push(radialCyl(1.705, 1.77, -0.75, phi, 0.025, 8), boxAt(1.73, -0.75, phi, [0.03, 0.06, 0.08]));
  P('Accessory gearbox', {
    system: 'Drive system', material: 'Cast aluminium/magnesium housing, spur gear train', mass: 140,
    explode: [0.32, 0.1, 1.52], temp: 360,
    desc: 'A crescent-shaped gearbox hung on the fan case. Its gear train drives every pad at its own fixed ratio to N2: the 777\'s generator pad turns at 0.7947 × N2 (about 7,400 rpm at 100 %), the hydraulic-pump pad at 0.3783 × N2 and the backup-generator pad at 2.4126 × N2 (EASA type certificate).',
    callout: true, anchor: [1.62, -0.75, 1.0],
  }, m(merge([agbBody, ...pads]), GM.magnesium()));
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
  }, m(merge([axialCyl(1.99, -0.5, 0.62, 0.05, 0.14, 18), boxAt(2.03, -0.5, 0.66, [0.05, 0.08, 0.06]), radialCyl(1.96, 1.99, -0.45, 0.62, 0.04, 14)]), GM.aluminium()));
  // starter duct: from the strut down the viewer's side of the fan case to the valve
  const starterPath = [P3(2.0, -0.92, UP - 0.06), P3(1.99, -0.72, UP + 0.08), ...arc(1.99, -0.68, UP + 0.16, TAU + 0.5, 0.1), P3(1.99, -0.6, TAU + 0.6)];
  P('Starter duct', {
    system: 'Propulsion', material: 'Stainless-steel duct with flexible joints', mass: 14,
    explode: [0.3, 0.5, 2.1], temp: 300,
    desc: 'Brings starting air from the 777\'s pneumatic manifold in the strut down the side of the fan case to the starter air valve, about 15 cm across so the starter gets enough flow (the duct is cut away with the case here).',
  }, C((keep) => cutTube(starterPath, 0.05, keep, { radial: 12 }), GM.duct()));
  P('Main fuel pump', {
    system: 'Fuel', material: 'Aluminium housing, centrifugal boost stage and gear stage', mass: 32,
    explode: [0.35, 0.35, 1.89], temp: 300,
    desc: 'A centrifugal boost stage feeding a high-pressure gear pump, driven by the gearbox. It delivers far more fuel than the engine burns; the hydromechanical unit meters what is needed and returns the rest.',
  }, m(merge([fwd(0.82, 0.085, 0.24), axialCyl(R_AGB, Y_AGB_F + 0.26, 0.82, 0.05, 0.05, 16)]), GM.aluminium()));
  P('Fuel filter & bypass indicator', {
    system: 'Fuel', material: 'Disposable filter element in an aluminium bowl, pop-out ΔP indicator', mass: 6,
    explode: [0.37, 0.55, 1.89], temp: 300,
    desc: 'Cleans the fuel between the pump\'s boost and high-pressure stages. When it clogs, a bypass valve keeps fuel flowing and a red button pops out of the bowl, and the crew sees a filter-bypass message, so it gets changed at the next stop.',
  }, m(merge([radialCyl(1.93, 2.02, -0.42, 0.82, 0.042, 18), radialCyl(2.02, 2.035, -0.42, 0.82, 0.03, 12), radialCyl(1.93, 1.96, -0.36, 0.86, 0.012, 8)]), GM.aluminium()));
  P('Hydromechanical unit (HMU)', {
    system: 'Fuel', material: 'Aluminium body with torque-motor servo valves', mass: 35,
    explode: [0.37, 0.35, 2.03], temp: 300,
    desc: 'The FADEC\'s muscles: electrically commanded valves meter fuel to the nozzles, and the same high-pressure fuel acts as hydraulic fluid to move the variable stators, bleed valves and clearance-control valves.',
  }, m(merge([boxAt(R_AGB + 0.01, Y_AGB_F + 0.15, 1.0, [0.14, 0.3, 0.2]), axialCyl(R_AGB + 0.07, Y_AGB_F + 0.18, 1.0, 0.025, 0.2, 10)]), GM.blue()));
  P('Lube & scavenge pump', {
    system: 'Drive system', material: 'Aluminium housing, gerotor elements', mass: 18,
    explode: [0.37, 0.35, 1.74], temp: 360,
    desc: 'One pressure element sends oil to the bearings and gears; several scavenge elements suck it back from each sump, through filters and coolers, to the tank. The lubrication system shares the drive system\'s colour here.',
  }, m(merge([fwd(1.2, 0.075, 0.2), boxAt(R_AGB, Y_AGB_F + 0.2, 1.2, [0.1, 0.06, 0.12])]), GM.oil()));
  P('Main oil filter', {
    system: 'Drive system', material: 'Pleated filter element in an aluminium bowl, ΔP switch', mass: 4,
    explode: [0.4, 0.55, 1.74], temp: 370,
    desc: 'Filters the pressure oil before it reaches the bearings. A pressure-difference switch warns the crew before it clogs, and a bypass valve keeps the bearings fed if it does.',
  }, m(merge([radialCyl(1.92, 2.02, -0.45, 1.2, 0.04, 18), radialCyl(2.02, 2.035, -0.45, 1.2, 0.028, 12)]), GM.oil()));
  P('Scavenge oil filter', {
    system: 'Drive system', material: 'Filter element in an aluminium bowl', mass: 4,
    explode: [0.4, 0.3, 1.7], temp: 380,
    desc: 'Catches debris in the oil returning from the sumps before it goes back to the tank, so wear products from one bearing cannot circulate through the others.',
  }, m(merge([radialCyl(1.92, 2.01, -0.75, 1.1, 0.038, 18), radialCyl(2.01, 2.025, -0.75, 1.1, 0.026, 12)]), GM.oil()));
  P('Magnetic chip detectors', {
    system: 'Sensors', material: 'Magnetic plugs in self-closing valves (count estimated)', mass: 1, count: 5,
    explode: [0.42, 0.2, 1.68], temp: 370,
    desc: 'Magnets in each scavenge line and in the gearbox sump that collect steel flakes. Checked at every inspection: a few fuzzy particles are normal, but chips mean a bearing or gear is starting to fail, often long before it vibrates.',
  }, m(merge([[-0.62, 1.28], [-0.7, 1.28], [-0.78, 1.28], [-0.86, 1.28], [-0.9, 0.55]].map(([y, phi]) => plug(1.92, 1.945, y, phi, 0.011))), GM.connector()));

  // ------------------------------------------------------------------ accessories on the aft face
  P('Integrated drive generator (IDG)', {
    system: 'Electrical', material: 'Constant-speed drive and 120 kVA generator (aircraft equipment)', mass: 70,
    explode: [0.35, -0.3, 1.81], temp: 330,
    desc: 'The 777\'s main 115 V, 400 Hz generator for this engine, Boeing equipment driven from an engine pad. Its pad turns at 0.7947 × N2 and is rated 181 kW continuous; a hydraulic constant-speed drive inside holds the generator at a steady speed while the engine\'s speed varies.',
  }, m(merge([aft(0.7, 0.135, 0.42), axialCyl(R_AGB, Y_AGB_A - 0.44, 0.7, 0.09, 0.04, 20)]), GM.painted()));
  P('Backup generator (VSCF/PMG)', {
    system: 'Electrical', material: 'Variable-speed generator with integral permanent-magnet generators (aircraft equipment)', mass: 22,
    explode: [0.33, -0.3, 1.66], temp: 330,
    desc: 'The 777\'s backup generator, Boeing equipment on its own engine pad: its pad turns fastest of all, at 2.4126 × N2 (about 22,500 rpm at 100 %), rated 43 kW. Its permanent-magnet sections also power the flight-control electronics if everything else fails.',
  }, m(merge([aft(0.5, 0.075, 0.3), axialCyl(R_AGB, Y_AGB_A - 0.32, 0.5, 0.05, 0.04, 16)]), GM.painted()));
  P('Engine-driven hydraulic pump', {
    system: 'Hydraulics', material: 'Variable-displacement piston pump (aircraft equipment)', mass: 25,
    explode: [0.37, -0.3, 1.96], temp: 330,
    desc: 'Pressurises one of the 777\'s hydraulic systems to 3,000 psi (20.7 MPa) for flight controls, gear and brakes. Boeing equipment on an engine pad turning at 0.3783 × N2, rated 63.5 kW.',
  }, m(aft(0.95, 0.085, 0.26), GM.aluminium()));
  P('Permanent-magnet alternator', {
    system: 'Electrical', material: 'Permanent-magnet generator', mass: 8,
    explode: [0.37, -0.3, 2.1], temp: 330,
    desc: 'The FADEC\'s private power supply: once the engine turns fast enough, it powers the control even if the aircraft\'s electrical system fails.',
  }, m(aft(1.21, 0.06, 0.12), GM.avionics()));
  P('Air/oil separator (deoiler)', {
    system: 'Drive system', material: 'Gear-driven centrifugal separator', mass: 6,
    explode: [0.4, -0.35, 2.2], temp: 360,
    desc: 'Air leaks into the sumps through their seals and has to be vented. This spinning separator on the gearbox flings the oil mist out of that air and returns it, so very little oil leaves through the vent line.',
  }, m(merge([aft(1.3, 0.05, 0.14), radialCyl(1.88, 1.98, Y_AGB_A - 0.1, 1.3, 0.018, 10)]), GM.magnesium()));
  P('Deoiler vent line', {
    system: 'Drive system', material: 'Aluminium tube to an overboard vent', mass: 2,
    explode: [0.42, -0.35, 2.3], temp: 340,
    desc: 'Carries the cleaned sump vent air from the deoiler to the drain mast at the bottom of the fan cowl. (The bearing sumps also vent aft through the centre vent tube inside the LP shaft.)',
  }, m(tube([P3(1.98, Y_AGB_A - 0.1, 1.3), P3(2.0, -1.0, 1.4), P3(2.0, -0.85, 1.52), P3(1.99, -0.66, BOTTOM - 0.02)], 0.016, { seg: 24 }), GM.duct()));

  // ------------------------------------------------------------------ FADEC, oil tank, coolers on the fan case
  const fadec = merge([
    boxAt(1.82, -0.32, PHI.fadec, [0.12, 0.5, 0.38]),
    ...[0.15, 0.27, 0.39].map((dy) => radialCyl(1.88, 1.92, -0.07 - dy, PHI.fadec + 0.05, 0.022, 12)),
    ...[-0.12, 0.12].flatMap((dp) => [radialCyl(1.705, 1.76, -0.2, PHI.fadec + dp, 0.018, 8), radialCyl(1.705, 1.76, -0.44, PHI.fadec + dp, 0.018, 8)]),
  ]);
  P('FADEC (electronic engine control)', {
    system: 'Avionics', material: 'Dual-channel computer in a fan-case-mounted, vibration-isolated box', mass: 25,
    explode: [0.24, 0.4, 1.89], temp: 300,
    desc: 'Full Authority Digital Engine Control: two independent channels, either able to run the engine alone, read dozens of sensors and schedule fuel, variable geometry and clearance control. The pilot\'s thrust lever only sends a request; the FADEC decides how to meet it within the engine\'s limits.',
    callout: true, anchor: [0.48, -0.32, 1.77],
  }, m(fadec, GM.avionics()));
  const tank = merge([sector(1.75, 1.93, -0.8, -1.36, PHI.tank - 0.16, PHI.tank + 0.16, 10), radialCyl(1.93, 1.97, -0.9, PHI.tank, 0.03, 12), boxAt(1.935, -1.12, PHI.tank + 0.1, [0.01, 0.08, 0.05]),
    ...[-0.12, 0.12].flatMap((dp) => [radialCyl(1.69, 1.75, -0.9, PHI.tank + dp, 0.018, 8), radialCyl(1.69, 1.75, -1.26, PHI.tank + dp, 0.018, 8)])]);
  P('Oil tank', {
    system: 'Drive system', material: 'Aluminium tank with sight glass and filler', mass: 25,
    explode: [0.21, -0.2, 1.89], temp: 340,
    desc: 'Holds the engine\'s lubricating oil, which also carries heat away from the bearings and gears; it is checked through a sight glass after each flight. The continuous oil-temperature limit is 132 °C (EASA type certificate). The lubrication system shares the drive system\'s colour here.',
  }, m(tank, GM.aluminium()));
  P('Oil quantity transmitter', {
    system: 'Sensors', material: 'Float-type level sensor', mass: 1,
    explode: [0.23, -0.2, 2.03], temp: 340,
    desc: 'Measures the oil level in the tank for the cockpit display, so crews can spot a slow leak or oil consumption trend between flights.',
  }, m(merge([radialCyl(1.93, 1.975, -1.25, PHI.tank - 0.08, 0.02, 10), boxAt(1.985, -1.25, PHI.tank - 0.08, [0.03, 0.05, 0.05])]), GM.connector()));
  const ohe = merge([boxAt(1.84, -0.27, 1.44, [0.13, 0.38, 0.24]), axialCyl(1.84, -0.04, 1.44, 0.04, 0.08, 12), axialCyl(1.84, -0.5, 1.44, 0.04, 0.08, 12), radialCyl(1.705, 1.775, -0.27, 1.44, 0.02, 8)]);
  P('Fuel/oil heat exchanger', {
    system: 'Thermal control', material: 'Aluminium tube-bundle cooler', mass: 35,
    explode: [0.39, 0.3, 1.45], temp: 360,
    desc: 'Hot scavenged oil gives its heat to the cold fuel on its way to the burners — cooling the oil, warming the fuel so ice cannot block its filter, and putting the heat back into the cycle instead of wasting it.',
  }, m(ohe, GM.aluminium()));
  P('IDG fuel/oil cooler', {
    system: 'Thermal control', material: 'Aluminium plate-fin cooler (aircraft equipment)', mass: 12,
    explode: [0.42, 0.3, 1.3], temp: 350,
    desc: 'The generator\'s own oil is cooled by engine fuel here, in a separate cooler so that IDG oil and engine oil never mix.',
  }, m(merge([boxAt(1.8, -0.25, 1.62, [0.1, 0.3, 0.18]), radialCyl(1.705, 1.75, -0.25, 1.62, 0.018, 8), tube([P3(1.8, -0.4, 1.6), P3(1.8, -0.7, 1.2), P3(1.8, Y_AGB_A - 0.05, 0.75)], 0.012, { seg: 20 })]), GM.aluminium()));

  // ------------------------------------------------------------------ fuel lines
  const fuelSupply = [];
  for (let k = 0; k <= 24; k++) { const f = k / 24; fuelSupply.push(P3(1.9, -1.05 + 0.3 * f, UP - (UP - 0.82) * f)); }
  fuelSupply.push(P3(1.87, -0.55, 0.82));
  const toManifold = [P3(1.87, -0.25, 1.0), P3(1.88, -0.6, 1.25), P3(1.8, -1.2, 1.48), P3(1.6, -1.74, BOTTOM - 0.012), P3(1.1, -1.76, BOTTOM - 0.012), P3(0.85, -1.85, BOTTOM - 0.012), P3(0.72, -2.4, 1.45), P3(0.7, -2.9, 1.4), P3(0.84, -3.05, 1.38), P3(0.86, -3.25, 1.36)];
  P('Fuel supply lines', {
    system: 'Fuel', material: 'Stainless-steel tubing', mass: 25,
    explode: [0.32, 0.0, 1.52], temp: 300,
    desc: 'Fuel comes from the wing tanks down the strut, round the fan case to the pump, through the heat exchanger and HMU, then down a fan-frame strut to the combustor manifolds.',
  }, m(merge([tube(fuelSupply, 0.022, { seg: 96 }), tube(toManifold, 0.016, { seg: 72 })]), GM.steel()));
  P('Fuel flow meter', {
    system: 'Fuel', material: 'Turbine-type mass flow transmitter', mass: 4,
    explode: [0.42, 0.0, 1.62], temp: 300,
    desc: 'Measures the metered fuel on its way to the nozzles for the cockpit fuel-flow display and fuel-used totals: about 4.6 kg/s (16.5 t an hour) at take-off, as the ICAO emissions databank lists, and about 1.2 kg/s in cruise (modelled).',
  }, m(merge([axialCyl(1.81, -1.15, 1.47, 0.045, 0.16, 16), boxAt(1.86, -1.15, 1.47, [0.04, 0.06, 0.06])]), GM.blue()));

  // ------------------------------------------------------------------ lubrication lines
  const oilSupply = [
    tube([P3(1.86, -1.08, PHI.tank + 0.16), P3(1.88, -0.9, 0.7), P3(1.89, -0.6, 1.1), P3(1.87, -0.56, 1.2)], 0.014, { seg: 40 }),
    // down a fan-frame strut at 6 o'clock to the forward sump
    tube([P3(1.8, -0.95, 1.2), P3(1.75, -1.5, 1.45), P3(1.6, -1.8, BOTTOM + 0.012), P3(0.8, -1.82, BOTTOM + 0.012), P3(0.45, -1.8, BOTTOM + 0.012), P3(0.32, -1.7, BOTTOM + 0.012)], 0.012, { seg: 48 }),
    // and aft along the core, outside the casings and inside the core cowl, in through a turbine-rear-frame strut
    tube([P3(0.8, -1.82, BOTTOM + 0.012), P3(0.64, -1.98, 1.63), P3(0.68, -2.3, 1.68), P3(0.66, -2.8, 1.68), P3(0.84, -3.12, 1.65), P3(0.95, -3.3, 1.62), P3(0.95, -3.85, 1.6), P3(0.88, -4.25, 1.58), P3(0.87, -4.52, BOTTOM), P3(0.94, -4.85, BOTTOM), P3(0.945, -5.0, BOTTOM), P3(0.93, -5.12, BOTTOM), P3(0.8, -5.24, BOTTOM), P3(0.45, -5.3, BOTTOM)], 0.012, { seg: 110 }),
  ];
  P('Oil supply lines', {
    system: 'Drive system', material: 'Stainless-steel tubing', mass: 16,
    explode: [0.3, -0.1, 1.67], temp: 380,
    desc: 'Pressure oil from the pump to the forward sump, down a fan-frame strut, and to the aft sump: that line runs the length of the core under the core cowl and in through a turbine-rear-frame strut.',
  }, m(merge(oilSupply), GM.oil()));
  const SCAV = BOTTOM + Math.PI / 6;     // the next fan-frame strut round
  const oilScav = [
    tube([P3(0.32, -1.75, SCAV), P3(0.45, -1.82, SCAV), P3(0.8, -1.8, SCAV), P3(1.6, -1.78, SCAV), P3(1.8, -1.5, SCAV - 0.1), ...arc(1.8, -1.32, SCAV - 0.25, 1.4, 0.1), P3(1.8, -0.97, 1.29)], 0.014, { seg: 60 }),
    tube([P3(0.45, -5.3, 2.02), P3(0.8, -5.24, 2.02), P3(0.93, -5.12, 2.02), P3(0.945, -5.0, 2.02), P3(0.94, -4.85, 2.02), P3(0.87, -4.52, 2.03), P3(0.88, -4.25, 2.04), P3(0.95, -3.85, 2.05), P3(0.95, -3.3, 2.06), P3(0.84, -3.12, 2.07), P3(0.66, -2.8, 2.08), P3(0.68, -2.3, 2.09), P3(0.64, -1.98, SCAV), P3(0.8, -1.8, SCAV)], 0.014, { seg: 110 }),
  ];
  P('Oil scavenge lines', {
    system: 'Drive system', material: 'Stainless-steel tubing', mass: 16,
    explode: [0.15, -0.1, 1.67], temp: 400,
    desc: 'Return oil sucked out of the aft and forward sumps by the scavenge pumps, up the next fan-frame strut and back to the pump and its filter. Scavenge lines are larger than supply lines because the returning oil is frothy with sump air.',
  }, m(merge(oilScav), GM.oil()));
  P('Oil pressure & temperature sensors', {
    system: 'Sensors', material: 'Pressure transmitter and resistance-thermometer probe', mass: 1, count: 2,
    explode: [0.42, 0.35, 1.55], temp: 370,
    desc: 'Measure the oil leaving the pump for the cockpit gauges and the FADEC: low pressure or high temperature are among the first signs of a lubrication problem.',
  }, m(merge([boxAt(1.95, -0.62, 1.16, [0.04, 0.05, 0.05]), radialCyl(1.905, 1.93, -0.62, 1.16, 0.012, 8), radialCyl(1.88, 1.96, -0.7, 1.13, 0.008, 8), boxAt(1.97, -0.7, 1.13, [0.03, 0.04, 0.04])]), GM.connector()));

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

  // ------------------------------------------------------------------ hydraulic and electrical runs to the strut
  // the pump and generators sit on the gearbox; their lines go aft of it and up the side of the fan case
  const upSide = (r, y, phi0) => [...arc(r, y, phi0, 0.0, 0.1), ...arc(r, y, TAU, UP + 0.12, 0.1), P3(r + 0.03, y - 0.05, UP + 0.05)];
  P('Hydraulic pump lines', {
    system: 'Hydraulics', material: 'Stainless pressure, suction and case-drain lines (aircraft equipment)', mass: 9, count: 3,
    explode: [0.2, -0.45, 1.6], temp: 330,
    desc: 'Three lines join the pump to the airplane: a large suction line from the reservoir, the 3,000 psi pressure line, and a small case-drain line whose flow is filtered and cooled, and watched, because a rising case-drain flow means the pump is wearing.',
  }, C((keep) => merge([
    cutTube([P3(1.84, Y_AGB_A - 0.27, 0.95), P3(1.84, -1.33, 0.93), ...upSide(1.84, -1.4, 0.9)], 0.016, keep),
    cutTube([P3(1.88, Y_AGB_A - 0.27, 0.97), P3(1.89, -1.35, 0.95), ...upSide(1.89, -1.42, 0.92)], 0.022, keep),
    cutTube([P3(1.8, Y_AGB_A - 0.25, 0.93), P3(1.79, -1.32, 0.9), ...upSide(1.79, -1.38, 0.88)], 0.01, keep),
  ]), GM.steel()));
  P('IDG feeder cables', {
    system: 'Electrical', material: 'Three-phase aluminium feeders in fire-resistant sleeves (aircraft equipment)', mass: 18,
    explode: [0.25, -0.4, 1.75], temp: 330,
    desc: 'Carry the generator\'s 115 V, 400 Hz output up into the strut and on to the 777\'s power panels: three thick phase cables and a neutral, sized for the 120 kVA rating.',
  }, C((keep) => cutTube([P3(1.98, Y_AGB_A - 0.2, 0.6), P3(1.98, -1.25, 0.55), ...upSide(1.98, -1.28, 0.5)], 0.022, keep, { radial: 8 }), GM.harness()));

  // ------------------------------------------------------------------ drains
  const drainHdr = [P3(1.73, -0.53, 0.6), ...arc(1.73, -0.53, 0.6, 1.36, 0.1), P3(1.8, -0.6, 1.5)];
  P('Drain lines & collector', {
    system: 'Fuel', material: 'Small stainless tubes to a collector tank', mass: 5,
    explode: [0.4, 0.45, 1.45], temp: 300,
    desc: 'Every pad seal and actuator leaks a few drops of fuel, oil or hydraulic fluid by design; these lines collect it from the starter, pumps, HMU and generator pads so it can be measured. More than the maintenance-manual limit from one line points to the seal that needs changing.',
  }, m(merge([tube(drainHdr, 0.007, { seg: 40, radial: 6 }), ...[0.62, 0.82, 1.0, 1.2].map((phi) => radialCyl(1.73, 1.76, -0.53, phi, 0.006, 6)), boxAt(1.82, -0.6, 1.5, [0.06, 0.1, 0.1]), tube([P3(1.85, -0.6, 1.52), P3(1.92, -0.6, BOTTOM)], 0.01, { seg: 6 })]), GM.steel()));
  const mast = atPhi(bladeGeometry({ rHub: 1.92, rTip: 2.2, chord: [0.16, 0.1], stagger: 0, t: 0.28, camber: 0, y: -0.6, sweep: [0, -0.06], stations: 1, n: 8 }), BOTTOM);
  P('Drain mast', {
    system: 'Fuel', material: 'Streamlined aluminium mast', mass: 2,
    explode: [0.9, 0.2, 0], temp: 290,
    desc: 'Sticks out of the bottom of the fan cowl and drops the drained fluids into the airstream, away from hot parts. On the ground a mechanic counts the drips from each of its outlets.',
  }, m(mast, GM.painted()));

  // ------------------------------------------------------------------ fire detection and extinguishing
  const fanLoop = [P3(1.96, -0.12, 0.05), ...arc(1.96, -0.12, 0.05, 1.75, 0.1), P3(2.0, -0.75, 1.78), P3(2.04, -1.38, 1.75), ...arc(2.04, -1.38, 1.75, 0.05, 0.1), P3(2.0, -0.75, 0.03), P3(1.96, -0.13, 0.05)];
  P('Fire detector loops (fan compartment)', {
    system: 'Sensors', material: 'Twin gas-filled or eutectic sensing tubes on clips, with responders', mass: 4, count: 2,
    explode: [0.15, 0.25, 2.3], temp: 300,
    desc: 'Two independent sensing loops run round the accessories. Heat anywhere along a loop raises its gas pressure (or drops its resistance) and the responder signals FIRE or overheat in the cockpit; both loops must agree, so a single fault cannot give a false alarm.',
  }, m(merge([tube(fanLoop, 0.006, { seg: 160, radial: 5 }), boxAt(1.98, -0.12, 0.02, [0.04, 0.06, 0.06]), boxAt(2.05, -1.32, 1.78, [0.04, 0.06, 0.06])]), GM.connector()));
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
    explode: [0.21, -0.2, 2.03], temp: 380,
    desc: 'Twin, separately routed looms connect each FADEC channel to its own set of sensors and actuators, so a single chafed harness cannot take out both.',
  }, m(merge(loom), GM.harness()));

  // ------------------------------------------------------------------ ignition
  P('Ignition exciters', {
    system: 'Electrical', material: 'Capacitor-discharge units', mass: 10, count: 2,
    explode: [0.19, -0.7, 1.09], temp: 420,
    desc: 'Each exciter stores energy in a capacitor and dumps it into its igniter as a spark of several joules, a few times a second. Two independent systems give redundancy.',
  }, m(merge([0.62, 2.52].map((phi) => boxAt(0.66, -2.78, phi, [0.08, 0.22, 0.12]))), GM.painted()));
  P('Igniter leads', {
    system: 'Electrical', material: 'Shielded, air-cooled high-tension leads', mass: 3, count: 2,
    explode: [0.25, -0.8, 1.0], temp: 600,
    desc: 'Carry the exciters\' high-voltage pulses to the two igniter plugs. They are shielded so the spark energy does not interfere with the FADEC\'s sensor wiring.',
  }, m(merge([0.62, 2.52].map((phi) => tube([P3(0.66, -2.9, phi), P3(0.7, -3.1, phi), P3(0.8, -3.3, phi), P3(0.84, -3.43, phi)], 0.01, { seg: 20 }))), GM.braid()));

  // ------------------------------------------------------------------ sensors
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
  P('T25 probe', {
    system: 'Sensors', material: 'Thermocouple / pressure probe', mass: 1,
    explode: [0.12, -0.5, 0.87], temp: 375,
    desc: 'Senses temperature (and pressure) at the HP compressor inlet; the FADEC uses it to schedule the variable stator vanes on corrected core speed.',
  }, m(merge([radialCyl(0.45, 0.64, -2.06, 0.75, 0.009, 8), boxAt(0.65, -2.06, 0.75, [0.04, 0.05, 0.05])]), GM.steel()));
  P('T3 / PS3 sensors', {
    system: 'Sensors', material: 'Thermocouple probe and static-pressure tap', mass: 1,
    explode: [0.12, -1.0, 0.87], temp: 900,
    desc: 'Compressor discharge temperature and pressure, close to 920 K and 4.2 MPa at take-off (modelled). PS3 is a key FADEC input for fuel scheduling and surge protection.',
  }, m(merge([radialCyl(0.47, 0.82, -3.2, 0.78, 0.009, 8), boxAt(0.83, -3.2, 0.78, [0.04, 0.05, 0.05]), radialCyl(0.76, 0.84, -3.12, 0.85, 0.008, 8)]), GM.steel()));
  const egt = cutPair((keep) => {
    const list = [];
    for (let i = 0; i < 12; i++) {
      const phi = ((i + 0.5) / 12) * TAU;
      if (!keep(phi)) continue;
      list.push(radialCyl(0.645, 0.81, -4.165, phi, 0.008, 6), boxAt(0.815, -4.165, phi, [0.03, 0.04, 0.04]));
    }
    list.push(hoop(0.83, -4.165, 0.01, { tubular: 96, start: keep.start, arc: keep.arc }));
    return merge(list);
  }, GM.connector());
  P('EGT thermocouples (T49)', {
    system: 'Sensors', material: 'Chromel–alumel thermocouple probes on a harness ring (count estimated)', mass: 4, count: 12,
    explode: [-0.85, -1.55, 0.51], temp: 1200,
    desc: 'A ring of probes at the LP turbine inlet, averaged into the exhaust gas temperature shown in the cockpit. EGT margin — how far below the 1,090 °C take-off limit (1,050 °C continuous) an engine runs — shrinks as it wears and is how airlines decide when to overhaul it.',
  }, cut(egt));
  P('N2 speed sensor', {
    system: 'Sensors', material: 'Magnetic pick-up', mass: 1,
    explode: [0.37, -0.3, 2.17], temp: 330,
    desc: 'Counts gear teeth in the accessory gearbox, which turns at a fixed ratio to the HP spool.',
  }, m(axialCyl(R_AGB + 0.03, Y_AGB_A - 0.05, 1.27, 0.02, 0.1, 10), GM.steel()));
  P('Vibration sensors', {
    system: 'Sensors', material: 'Piezoelectric accelerometers', mass: 2, count: 2,
    explode: [0.17, -0.5, 1.3], temp: 400,
    desc: 'One accelerometer near the #1 bearing on the fan frame and one on the turbine rear frame. They track once-per-revolution vibration of each spool: fan imbalance from ice or a damaged blade shows up here first.',
  }, m(merge([boxAt(1.74, -1.65, 0.12, [0.05, 0.05, 0.05]), boxAt(0.995, -5.25, 0.6, [0.05, 0.05, 0.05])]), GM.connector()));

  void ROWS;
}
