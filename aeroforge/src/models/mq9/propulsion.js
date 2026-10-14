// MQ-9A powerplant parts: the TPE331-10 and everything bolted to it or serving it in the engine
// bay (s 8.95–10.4), the propeller, and the engine's own controls, lubrication and fuel metering.
// Positions follow the Honeywell TPE331-10 installation drawing (N61-1491) scaled into the aft
// body; the installation inside the MQ-9 cowling is estimated from USAF engine-change photographs.

import * as THREE from 'three';
import { loftRings, orientTubeOutward } from '../../engine/geometry.js';
import { X, prof, fusePoint, merge, box, lru, cylX, tubeBetween, pipe, bulkhead } from './shape.js';
import {
  ENGINE_Y, SHAFT_Y, PROP_X, PROP_R, STATIONS, GEARBOX, PADS, FRONT_MOUNT_S, REAR_MOUNT_S, REAR_MOUNT_R, STACK_S,
  combustorGeo, turbineGeo, manifoldGeo, startManifoldGeo, ignitersGeo, exhaustGeo, stacksGeo, compressorGeo, impellersGeo,
  mainShaftGeo, screenGeo, plenumGeo, gearboxGeo, padsGeo, bladesGeo, hubGeo, pitchGeo, spinnerGeo,
} from './powerplant.js';

export const FIREWALL_S = 8.95;
const XS = (s) => X(s);
const E = (dy, dz) => [ENGINE_Y + dy, dz];

/** Rounded-rectangle duct along a path in the x–y plane (centre z given per point). */
export function duct(points, w, h, n = 16) {
  const P = points.map((p) => new THREE.Vector3(...p));
  const rings = P.map((p, i) => {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
    const t = b.clone().sub(a).normalize();
    const nrm = new THREE.Vector3(-t.y, t.x, 0).normalize();
    const ring = [];
    for (let j = 0; j < n; j++) {
      const th = (j / n) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
      const u = Math.sign(c) * Math.abs(c) ** 0.6 * (w / 2), v = Math.sign(s) * Math.abs(s) ** 0.6 * (h / 2);
      ring.push([p.x + nrm.x * v, p.y + nrm.y * v, p.z + u]);
    }
    return ring;
  });
  return orientTubeOutward(loftRings(rings, { uvMode: 'metric' }));
}

/**
 * Build the propulsion parts. ctx: { P, L, m, role, air }. Returns the spinning groups for update()
 * and a few attachment points other systems route to.
 */
export function buildPropulsion({ P, L, m, role }) {
  const XT0 = XS(STATIONS.turbine0);
  const cb = combustorGeo();
  role(P('TPE331 turbine case', {
    system: 'Propulsion', material: 'Steel case, nickel-alloy hot section', mass: 22, explode: [0.55, 1.25, 0],
    desc: 'The hot section of the Honeywell TPE331-10. USAF lists the MQ-9A’s engine as the TPE331-10GD at 900 shp; NASA gives Ikhana’s as a -10T and the NTSB the 2006 aircraft’s as a -10Y. Honeywell rates the basic engine at 940 shp (1,000 shp thermodynamic). The whole engine, gearbox included, is only 1.09 m long and 175 kg (385 lb) dry, because the reverse-flow combustor folds the gas path back around the turbine.',
    callout: true, anchor: [X(9.3), ENGINE_Y - 0.197, 0.114],   // on the case, 60° below the starboard side
  }, L(cb.casing, m.hot)), 'turbine');
  role(P('Annular combustor liner', {
    system: 'Propulsion', material: 'Nickel-alloy liner with cooling holes', mass: 6, explode: [0.55, 0.55, 0.55],
    desc: 'Compressed air runs toward the hot end outside the liner, turns 180° into it, burns with the fuel and turns again into the first turbine nozzle. Folding the flow this way is what keeps the TPE331 short.',
  }, L(cb.liner, m.hot)), 'turbine');
  const tg = turbineGeo();
  const rotors = role(P('Three-stage axial turbine', {
    system: 'Propulsion', material: 'Nickel-superalloy discs and cast blades', mass: 18, count: 3, xrayWeight: 0.5, explode: [0.55, 0.55, -0.55],
    desc: 'Three bladed discs on the single shaft extract the gas energy that drives both the two-stage compressor and, through the gearbox, the propeller. About 40 blades per disc are shown (the real counts are not published). After the 2006 Nogales crash Honeywell’s borescope check named the first-stage turbine nozzle and the third-stage turbine.',
  }, [L(tg.discs, m.hot), L(tg.blades, m.hot)]), 'turbine');
  rotors.children[1].userData.xrayWeight = 0.35;
  role(P('Turbine nozzle rings', {
    system: 'Propulsion', material: 'Cast nickel-alloy vane rings', mass: 6, count: 3, xrayWeight: 0.5, explode: [0.8, 0.3, -0.75],
    desc: 'Ahead of each turbine disc a fixed ring of vanes (about 25 shown per stage) speeds up the gas and turns it onto the blades: a turbine stage is a nozzle ring and the bladed disc it drives. The first-stage nozzle sees the hottest gas in the engine.',
  }, [L(tg.nozzles, m.darkMetal), L(tg.vanes, m.darkMetal)]), 'turbine');
  role(P('Main fuel manifolds & nozzles', {
    system: 'Propulsion', material: 'Stainless manifolds, atomising nozzles', mass: 3, count: 10, explode: [0.75, 1.3, 0.4],
    desc: 'Two manifolds round the hot end of the combustor (Honeywell’s drawing labels them “fuel manifolds”) feed the atomising nozzles that spray metered fuel into the liner. Ten nozzles are shown; the real count is not published.',
  }, L(manifoldGeo(10), m.pipe)), 'turbine');
  role(P('Starting fuel manifold', {
    system: 'Propulsion', material: 'Stainless manifold with small starting nozzles', mass: 0.6, count: 3, explode: [0.6, -0.55, 0.5],
    desc: 'A separate manifold on the lower case with a few small nozzles. The engine lights on these during the start; once the flame holds, the main manifolds take over.',
  }, L(startManifoldGeo(), m.pipe)), 'turbine');
  role(P('Igniter plugs', {
    system: 'Propulsion', material: 'Surface-discharge igniters', mass: 0.6, count: 2, explode: [0.75, 1.3, -0.4],
    desc: 'Two igniters, one on top of the combustor case and one on its left side (the NTSB names “the top igniter” and “the left side igniter”). The TPE331-10 has dual continuous ignition, so it can also be left on in heavy rain or turbulence.',
  }, L(ignitersGeo(), m.darkMetal)), 'turbine');
  role(P('Exhaust outlet & Y-duct', {
    system: 'Propulsion', material: 'Inconel', mass: 7, explode: [0.95, 0.8, 0],
    desc: 'The engine exhausts through one round outlet, 0.277 m across, at its hot end, which in this pusher faces forward. A Y-duct splits the flow and turns it back into a pipe up each side of the engine (routing estimated from photographs).',
  }, L(exhaustGeo(), m.hot)), 'exhaust');
  const stackG = stacksGeo();
  const hotDouble = m.hot.clone(); hotDouble.side = THREE.DoubleSide;
  role(P('Exhaust stacks', {
    system: 'Propulsion', material: 'Inconel', mass: 4, count: 2, explode: [0.2, 0.75, 0],
    desc: 'Short stacks on each upper side, just behind the V-tail trailing edge and ahead of the spinner, throw the exhaust aft and outward. Little jet thrust is left at that point: the propeller does the work.',
  }, L(stackG, hotDouble)), 'exhaust');
  role(P('TPE331 compressor housing', {
    system: 'Propulsion', material: 'Aluminium and steel housings, diffusers and crossover ducts', mass: 26, explode: [0, 1.05, 0],
    desc: 'Houses the two centrifugal stages in series: crossover ducts carry the air from the first stage to the second. Honeywell gives the TPE331-10 a 10.55:1 pressure ratio and 3.5 kg/s (7.7 lb/s) of airflow, for a specific fuel consumption of 0.534 lb per equivalent shaft horsepower per hour.',
  }, L(compressorGeo(), m.titanium)), 'compressor');
  role(P('Centrifugal impellers', {
    system: 'Propulsion', material: 'Titanium impellers', mass: 9, count: 2, xrayWeight: 0.5, explode: [0, 0.55, 0.55],
    desc: 'Two centrifugal impellers on the main shaft fling the air outward into their diffusers. A centrifugal stage does the work of several axial stages in a short, rugged package that tolerates dust and ingested debris.',
  }, L(impellersGeo(), m.titanium)), 'compressor');
  P('Main shaft & bearings', {
    system: 'Propulsion', material: 'Steel shaft, three rolling-element bearings', mass: 6, count: 3, explode: [0, 0.55, -0.55],
    desc: 'One shaft carries the turbine, both impellers and the gearbox input pinion, turning at 41,730 rpm at 100 % speed (Honeywell). A 2018 MQ-9 loss began with a failing compressor bearing: metal particles in an oil sample taken the day before flagged it, but the result reached the crew too late (USAF investigation).',
  }, L(mainShaftGeo(), m.pipe));
  P('Inlet screen', {
    system: 'Propulsion', material: 'Stainless wire screen', mass: 1, explode: [-0.25, 0.8, 0],
    desc: 'A mesh drum between the gearbox and the first compressor stage that keeps debris drawn through the inlet duct out of the impellers.',
  }, L(screenGeo(), m.darkMetal));
  // dorsal ram-air scoop at the front of the engine hump, a flat duct over the accessory bay and the
  // engine, and the annular plenum round the compressor inlet (routing estimated)
  const inletPath = [[XS(7.92), 1.882, 0], [XS(8.1), 1.89, 0], [XS(8.45), 1.935, 0], [XS(8.95), 1.99, 0], [XS(9.4), 2.025, 0], [XS(9.68), 2.03, 0], [XS(9.78), 2.0, 0], [XS(9.83), 1.93, 0]];
  const scoop = lru(0.34, 0.075, 0.25, [XS(8.02), 1.895, 0], 0.04);
  P('Engine air inlet & plenum', {
    system: 'Propulsion', material: 'Composite scoop and duct, aluminium plenum (routing approximate)', mass: 8, explode: [0, 1.6, 0],
    desc: 'A dorsal ram-air scoop at the front of the engine hump feeds a flat duct over the accessory bay and the engine to an annular plenum round the inlet screen, just ahead of the gearbox, where the TPE331 draws its 3.5 kg of air a second. The NTSB checked this “inlet assembly ducting” for debris after the 2006 loss (scoop position from photographs; duct routing estimated).',
  }, [L(merge([scoop, duct(inletPath, 0.24, 0.055), plenumGeo()]), m.skin), L(box(0.004, 0.055, 0.21, [XS(8.02) + 0.171, 1.895, 0]), m.intake)]);

  // ---- reduction gearbox and accessory drives
  const gb = gearboxGeo();
  role(P('Propeller reduction gearbox', {
    system: 'Propulsion', material: 'Cast gearbox case, steel gears (an aluminium case is a Honeywell option)', mass: 50, explode: [-0.55, 1.05, 0],
    desc: 'The largest part of the engine, 0.53 m wide and 0.68 m tall, with the front mount on top. It steps 41,730 engine rpm down to 1,591 propeller rpm (26.2:1, for counter-clockwise rotation; 2,000 rpm for clockwise). Its output sits 0.090 m above the engine centreline, which is why the propeller shaft is higher than the turbine.',
  }, L(gb.housing, m.gun)), 'gearbox');
  role(P('Accessory drive case', {
    system: 'Propulsion', material: 'Cast case with splined drive pads', mass: 6, count: 4, explode: [0.2, -0.75, 0],
    desc: 'The lower, engine-side face of the gearbox carries the accessory drive pads (Honeywell): starter-generator 10,887 rpm (300 lb·in continuous), aircraft accessory 3,959 rpm, tachometer-generator 4,187 rpm, plus the propeller-governor pad at 3,754 rpm.',
  }, [L(gb.accessory, m.gun), L(padsGeo(), m.darkMetal)]), 'gearbox');
  P('Propeller shaft & flange', {
    system: 'Propulsion', material: 'Steel output shaft and propeller flange', mass: 7, explode: [-1.05, 0.45, 0],
    desc: 'The gearbox output shaft ends in the propeller flange the hub bolts to; the beta tube that sets reverse pitch runs through its bore. Up to 900 shp (671 kW) passes through it at about 1,590 rpm, a torque near 4 kN·m.',
  }, L(gb.output, m.titanium));
  const tachX0 = XS(GEARBOX.s0 - 0.07);
  P('Tachometer-generator', {
    system: 'Propulsion', material: 'Small engine-driven generator', mass: 0.8, explode: [0.3, -0.95, 0.15],
    desc: 'Driven from its own pad at 4,187 rpm, it makes a voltage proportional to engine speed for the rpm indication and the engine control (Honeywell pad table).',
  }, L(merge([cylX(tachX0, tachX0 + 0.11, 0.032, 0.032, PADS.tach.y, 0.03, 14), cylX(tachX0, tachX0 + 0.012, 0.04, 0.04, PADS.tach.y, 0.03, 14)]), m.darkMetal));
  const starterX0 = XS(GEARBOX.s0 - 0.075);
  role(P('Starter-generator', {
    system: 'Electrical', material: 'Air-cooled brush-type DC starter-generator', mass: 18, explode: [-0.45, -0.75, 0.75],
    desc: 'An air-cooled, brush-type machine on the starter-generator pad: it spins the engine for starting, then becomes the main generator. Block 5 aircraft have a higher-capacity unit (45 kVA main power). In a 2015 loss its air temperature climbed and its output fell from 156 A to 0 (USAF investigation); the NTSB found debris in the cooling duct of the 2006 aircraft’s unit.',
  }, L(merge([cylX(starterX0, starterX0 + 0.25, 0.072, 0.072, PADS.starter.y, PADS.starter.z, 20), cylX(starterX0 + 0.25, starterX0 + 0.27, 0.05, 0.05, PADS.starter.y, PADS.starter.z, 14), box(0.06, 0.03, 0.05, [starterX0 + 0.12, PADS.starter.y + 0.08, PADS.starter.z])]), m.darkMetal)), 'generator');
  role(P('Backup generator', {
    system: 'Electrical', material: 'Brushless permanent-magnet alternator', mass: 9, explode: [-0.45, -0.75, -0.75],
    desc: 'A second, independent source on the aircraft-accessory pad. Block 1 aircraft first had none: after a generator failure only the battery remained, so the Electrical Safety Improvement Program added a direct-drive brushless permanent-magnet alternator for the flight-critical avionics. The GA-ASI Block 5 sheet gives 4 kW of backup power.',
  }, L(merge([cylX(starterX0, starterX0 + 0.2, 0.06, 0.06, PADS.accessory.y, PADS.accessory.z, 18)]), m.darkMetal)), 'generator');
  const fanEnd = [starterX0 + 0.27, PADS.starter.y, PADS.starter.z];
  const coolIn = fusePoint(9.98, -0.3, 0.03);
  P('Starter-generator cooling duct', {
    system: 'Electrical', material: 'Flexible ducting from a flush cowling inlet', mass: 0.6, explode: [-0.2, -0.9, 1.0],
    desc: 'Ram air from a small inlet on the lower starboard cowling runs forward to the fan end of the starter-generator and blows through its windings, then vents into the engine bay. A blocked duct overheats the generator: debris was found in it after the 2006 loss (routing estimated).',
  }, [L(pipe([coolIn, [XS(9.88), 1.5, 0.222], [XS(9.62), 1.525, 0.218], [fanEnd[0] + 0.03, fanEnd[1] - 0.01, fanEnd[2] + 0.05], fanEnd], 0.024, 8, 24), m.harness), L(lru(0.07, 0.028, 0.06, [coolIn[0], coolIn[1] - 0.006, coolIn[2] - 0.006]), m.intake)]);

  // ---- propeller control
  const govP = [XS(10.1), 1.965, 0.215];
  P('Propeller governor', {
    system: 'Propulsion', material: 'Woodward flyweight governor and oil pump', mass: 3, explode: [-0.75, 0.85, 0.3],
    desc: 'A Woodward unit on the governor pad (3,754 rpm): flyweights sense propeller speed and meter gearbox oil to the pitch-change piston, coarsening the blades when the engine speeds up. The speed-lever servo sets it through a cable. If propeller speed falls below 1,488 rpm an automatic air restart begins (NTSB; position on the gearbox estimated).',
  }, L(merge([cylX(govP[0] - 0.06, govP[0] + 0.06, 0.032, 0.032, govP[1], govP[2], 14), box(0.03, 0.04, 0.03, [govP[0] + 0.02, govP[1] + 0.03, govP[2] - 0.01])]), m.gun));
  P('NTS & beta-pressure switch', {
    system: 'Propulsion', material: 'Negative-torque-sensing valve and pressure switch with oil lines', mass: 0.8, count: 2, explode: [-0.9, 0.2, 0.55],
    desc: 'Two small units on the gearbox (Honeywell basic engine). The negative-torque-sensing (NTS) system notices when a windmilling propeller starts to drive the engine and moves the blades toward feather to cut the drag; the beta-pressure switch reports that the blades are in the ground (beta) range.',
  }, L(merge([cylX(XS(10.245), XS(10.215), 0.026, 0.026, ENGINE_Y - 0.09, 0.15, 12), cylX(XS(10.24), XS(10.215), 0.02, 0.02, ENGINE_Y - 0.09, -0.15, 12),
    pipe([[XS(10.23), ENGINE_Y - 0.09, 0.15], [XS(10.24), ENGINE_Y - 0.02, 0.12], [XS(10.23), SHAFT_Y - 0.08, 0.06]], 0.005, 5, 10)]), m.darkMetal));

  // ---- engine-mounted fuel metering
  const fcuP = [XS(9.55), ENGINE_Y + 0.268, 0];
  role(P('Fuel control unit', {
    system: 'Propulsion', material: 'Hydromechanical fuel control with underspeed governor', mass: 5, explode: [-0.2, 1.3, 0.5],
    desc: 'On top of the engine over the compressor (Honeywell drawing), the hydromechanical fuel control meters fuel for the power lever’s setting. In the beta range its underspeed governor holds rpm with fuel flow. After the 2006 crash investigators found the power lever at 90°, the propeller pitch control at 89° and the underspeed governor at 32°. In 2025 a chafed wire inside an FCU fired the electrical shutoff valve and an MQ-9 was lost.',
  }, L(merge([lru(0.2, 0.06, 0.13, [fcuP[0], fcuP[1], 0], 0.02), box(0.03, 0.03, 0.03, [fcuP[0] + 0.06, fcuP[1] + 0.035, 0.05]), cylX(fcuP[0] - 0.05, fcuP[0] - 0.02, 0.012, 0.012, fcuP[1] + 0.038, -0.04, 8)]), m.darkMetal)), 'compressor');
  const pumpP = [XS(9.72), ENGINE_Y + 0.235, 0.04];
  role(P('Engine-driven fuel pump', {
    system: 'Propulsion', material: 'Gear-type high-pressure pump on a drive from the gearbox', mass: 3, explode: [-0.45, 1.25, 0.3],
    desc: 'Raises the boost-pump pressure to the several hundred psi the nozzles need to atomise the fuel, and hands it to the fuel control. The NTSB found its drive shaft still connected after the 2006 crash.',
  }, L(merge([cylX(pumpP[0] - 0.06, pumpP[0] + 0.06, 0.045, 0.045, pumpP[1], pumpP[2], 16), cylX(pumpP[0] - 0.09, pumpP[0] - 0.06, 0.02, 0.02, pumpP[1], pumpP[2], 10)]), m.darkMetal)), 'compressor');
  const msovP = [XS(9.44), ENGINE_Y + 0.27, -0.05];
  P('Mechanical fuel shutoff valve (MSOV)', {
    system: 'Propulsion', material: 'Lever-operated shutoff valve at the fuel-control outlet', mass: 0.5, explode: [0.35, 1.45, -0.35],
    desc: 'The engine’s own fuel shutoff valve. The condition lever has three positions: Run; Stop, which closes this mechanical valve; and Stop & Feather, which also feathers the propeller. The MQ-9A has a second, electrical valve (the FSOV) at the firewall.',
  }, L(merge([cylX(msovP[0] - 0.03, msovP[0] + 0.03, 0.022, 0.022, msovP[1], msovP[2], 12), box(0.012, 0.05, 0.012, [msovP[0], msovP[1] + 0.03, msovP[2] - 0.02])]), m.lruOlive));
  const xMan = XS(STATIONS.turbine0) - 0.035;
  P('Metered fuel line', {
    system: 'Propulsion', material: 'Stainless tube, fire-sleeved', mass: 0.5, explode: [0.55, 1.6, -0.2],
    desc: 'Carries metered fuel from the fuel-control outlet, past the MSOV, forward along the top of the combustor to the main manifolds at the hot end.',
  }, L(merge([pipe([[fcuP[0] + 0.1, fcuP[1], 0], [msovP[0] - 0.02, msovP[1], msovP[2]]], 0.006, 6, 8),
    pipe([[msovP[0] + 0.03, msovP[1], msovP[2]], [XS(9.35), ENGINE_Y + 0.255, -0.06], [xMan + 0.02, ENGINE_Y + 0.25, -0.05], [xMan, ENGINE_Y + 0.236, -0.03]], 0.006, 6, 24)]), m.pipe));
  P('Fuel purge system', {
    system: 'Propulsion', material: 'Small accumulator and valve on the main manifold', mass: 0.4, explode: [0.6, -0.8, 0.2],
    desc: 'At shutdown it blows the fuel left in the manifolds and nozzles into the combustor so it cannot cook into carbon in the hot nozzle tips (Honeywell basic engine).',
  }, L(merge([cylX(xMan - 0.04, xMan + 0.04, 0.024, 0.024, ENGINE_Y - 0.27, 0.07, 12), tubeBetween([xMan, ENGINE_Y - 0.25, 0.07], [xMan, ENGINE_Y - 0.236, 0.02], 0.005, 5)]), m.alu));
  const heatP = [XS(9.36), ENGINE_Y - 0.19, -0.245];
  P('Engine fuel heater', {
    system: 'Propulsion', material: 'Oil-to-fuel heat exchanger (fuel anti-ice)', mass: 1.5, explode: [0.3, -0.5, -0.8],
    desc: 'The TPE331-10’s own fuel anti-ice heating: warm engine oil heats the fuel before the high-pressure pump so that water in it cannot freeze into filter-blocking ice crystals at altitude (Honeywell basic engine; position estimated).',
  }, L(merge([cylX(heatP[0] - 0.09, heatP[0] + 0.09, 0.038, 0.038, heatP[1], heatP[2], 14), cylX(heatP[0] + 0.03, heatP[0] + 0.05, 0.044, 0.044, heatP[1], heatP[2], 14)]), m.alu));

  // ---- lubrication
  const tankP = [XS(9.36), ENGINE_Y - 0.17, 0.26];
  role(P('Oil tank', {
    system: 'Propulsion', material: 'Aluminium tank with filler and sight gauge', mass: 4, explode: [0, -0.55, 0.95],
    desc: 'Holds the engine and gearbox oil (a few litres; size and position estimated). The same oil cools the bearings, lubricates the gears, heats the fuel and works the propeller’s pitch-change piston.',
  }, L(merge([cylX(tankP[0] - 0.11, tankP[0] + 0.11, 0.043, 0.043, tankP[1], tankP[2], 16), cylX(tankP[0] - 0.06, tankP[0] - 0.03, 0.016, 0.016, tankP[1] + 0.05, tankP[2], 8)]), m.alu)), 'oil');
  const filtX = XS(GEARBOX.s0 - 0.07);
  role(P('Oil filter & chip detector', {
    system: 'Propulsion', material: 'Filter canister with a magnetic chip detector plug', mass: 0.8, explode: [0.35, -1.0, -0.3],
    desc: 'On the gearbox sump: the filter catches debris and a magnetic plug collects iron particles shed by wearing gears and bearings, the early warning that oil sampling also gives. In 2018 metal in an oil sample flagged a failing compressor bearing a day before it failed.',
  }, L(merge([cylX(filtX, filtX + 0.12, 0.028, 0.028, PADS.tach.y + 0.01, -0.065, 14), cylX(filtX + 0.12, filtX + 0.135, 0.01, 0.01, PADS.tach.y + 0.01, -0.065, 8)]), m.alu)), 'oil');
  P('Oil pressure & temperature sensors', {
    system: 'Propulsion', material: 'Pressure transmitter and temperature bulb', mass: 0.3, count: 2, explode: [-0.3, -0.3, -1.05],
    desc: 'A pressure transmitter and the oil temperature-sensing bulb (Honeywell basic engine) on the gearbox report to the engine control and the ground station; low pressure or high temperature is often the first sign of a lubrication fault.',
  }, L(merge([tubeBetween([XS(10.0), ENGINE_Y - 0.05, -0.255], [XS(10.0), ENGINE_Y - 0.05, -0.29], 0.013, 8), tubeBetween([XS(10.06), ENGINE_Y - 0.13, -0.235], [XS(10.06), ENGINE_Y - 0.13, -0.27], 0.01, 8)]), m.darkMetal));
  // ventral oil cooler ahead of the ventral fin (scoop position from photographs)
  const coolS = 7.95, coolY = prof(coolS).bot;
  role(P('Oil cooler & scoop', {
    system: 'Propulsion', material: 'Aluminium matrix cooler, composite scoop (position approximate)', mass: 8, explode: [0, -0.8, 0],
    desc: 'Engine and gearbox oil rejects its heat to ram air through a ventral scoop and cooler matrix just ahead of the ventral fin. At 15 km the air is thin, so the cooler is sized for climbing slowly at high power.',
  }, [L(merge([lru(0.5, 0.075, 0.22, [X(coolS), coolY - 0.012, 0], 0.03), box(0.13, 0.12, 0.22, [X(coolS - 0.1), coolY + 0.1, 0])]), m.skin), L(box(0.004, 0.05, 0.18, [X(coolS) + 0.252, coolY - 0.015, 0]), m.intake)]), 'oil');
  const tcvP = [X(coolS - 0.24), coolY + 0.11, -0.09];
  role(P('Oil temperature control valve', {
    system: 'Propulsion', material: 'Thermostatic bypass valve', mass: 0.6, explode: [0.3, -0.55, -0.6],
    desc: 'At the cooler inlet: cold oil bypasses the matrix and hot oil is sent through it, so the oil warms quickly and then holds its temperature. A 2009 MQ-9 was lost when an improperly assembled temperature control valve caused a severe oil-flow imbalance and engine failure (USAF investigation).',
  }, L(merge([cylX(tcvP[0] - 0.04, tcvP[0] + 0.04, 0.026, 0.026, tcvP[1], tcvP[2], 12), box(0.03, 0.03, 0.03, [tcvP[0], tcvP[1] + 0.03, tcvP[2]])]), m.alu)), 'oil');
  const oilLines = [];
  for (const [dz, dy] of [[0, 0], [0.04, 0.02]]) {
    oilLines.push(pipe([[filtX + 0.06, PADS.tach.y - 0.02, -0.11 + dz], [XS(9.6), 1.44 + dy, -0.2 + dz], [XS(9.2), 1.43 + dy, -0.21 + dz], [XS(FIREWALL_S), 1.42 + dy, -0.2 + dz], [XS(8.4), 1.39 + dy, -0.16 + dz], [tcvP[0] - 0.05, tcvP[1] + dy * 0.5, tcvP[2] + dz]], 0.008, 6, 48));
  }
  oilLines.push(pipe([[tankP[0] - 0.08, tankP[1] - 0.03, tankP[2] - 0.02], [XS(9.6), ENGINE_Y - 0.25, 0.14], [filtX + 0.05, PADS.tach.y, 0.0]], 0.007, 6, 16));
  role(P('Engine oil lines', {
    system: 'Propulsion', material: 'Stainless tube and fire-sleeved hose', mass: 2, count: 3, explode: [0, -0.3, -0.75],
    desc: 'Supply and return lines between the gearbox sump and the ventral oil cooler, through the firewall in fire-resistant fittings, and a line from the oil tank to the pump (routing estimated).',
  }, L(merge(oilLines), m.pipe)), 'oil');

  // ---- ignition and engine sensors
  const excP = [XS(9.36), ENGINE_Y - 0.06, -0.285];
  role(P('Ignition exciter', {
    system: 'Propulsion', material: 'Capacitor-discharge ignition unit', mass: 2, explode: [0.3, 0.2, -1.0],
    desc: 'Charges capacitors from the 24 V supply and fires the two igniter plugs through shielded leads, during starts and whenever continuous ignition is selected.',
  }, L(merge([lru(0.13, 0.05, 0.05, excP), pipe([excP, [XS(9.29), ENGINE_Y + 0.05, -0.27], [XS(9.27), ENGINE_Y + 0.2, -0.15], [XS(9.27), ENGINE_Y + 0.27, 0]], 0.004, 5, 16), pipe([excP, [XS(9.28), ENGINE_Y, -0.27]], 0.004, 5, 8)]), m.lruOlive)), 'generator');
  const egtX = XT0 - 0.022;
  const egt = [new THREE.TorusGeometry(0.2, 0.005, 5, 40).rotateY(Math.PI / 2).translate(egtX, ENGINE_Y, 0)];
  for (let k = 0; k < 8; k++) {
    const a = ((k + 0.5) / 8) * Math.PI * 2;
    egt.push(tubeBetween([egtX, ENGINE_Y + Math.cos(a) * 0.14, Math.sin(a) * 0.14], [egtX, ENGINE_Y + Math.cos(a) * 0.205, Math.sin(a) * 0.205], 0.005, 5));
  }
  egt.push(pipe([[egtX, ENGINE_Y + 0.14, 0.14], [XS(9.1), 1.82, 0.24], [XS(FIREWALL_S), 1.78, 0.25], [XS(8.82), 1.76, 0.23]], 0.005, 5, 20));
  role(P('EGT thermocouple harness', {
    system: 'Propulsion', material: 'Chromel-alumel thermocouples on a ring harness', mass: 1, count: 8, xrayWeight: 0.5, explode: [0.95, 0.55, 0.5],
    desc: 'Probes in the gas path average the exhaust gas temperature, the TPE331’s key limit. The single red-line (SRL) limiting in the engine control keeps it below its maximum (probe count and position estimated).',
  }, L(merge(egt), m.copper)), 'turbine');
  P('Torque & speed pickups', {
    system: 'Propulsion', material: 'Torque sensor and magnetic speed pickup', mass: 1, count: 2, explode: [-0.55, 1.35, 0.3],
    desc: 'Torque measured inside the gearbox and engine speed from a magnetic pickup are what the crew’s power gauges show: shaft power = torque × rpm. The heads-down display warns of a torque loss (positions estimated).',
  }, L(merge([cylX(XS(9.87), XS(9.83), 0.02, 0.02, ENGINE_Y + 0.17, -0.17, 10), cylX(XS(9.87), XS(9.84), 0.014, 0.014, ENGINE_Y + 0.17, 0.17, 10)]), m.darkMetal));

  // ---- engine electronics and control linkage, on the accessory-bay rack ahead of the firewall
  const DEEC_P = [XS(8.66), 1.65, 0.2], ESM_P = [XS(8.66), 1.61, -0.205];
  P('DEEC engine control', {
    system: 'Propulsion', material: 'Digital electronic engine control unit', mass: 4, explode: [0.4, 0.75, 0.75],
    desc: 'The digital electronic engine control, developed by Honeywell and GA-ASI. NASA’s Ikhana was the first production Predator B to carry it, and it made the aircraft 5–10 % more fuel-efficient (NASA fact sheet). It trims fuel and propeller pitch for the commanded power and guards the temperature and torque limits, ahead of the firewall where it stays cool.',
  }, L(lru(0.1, 0.2, 0.19, DEEC_P), m.lruOlive));
  P('Engine start module & SRL', {
    system: 'Propulsion', material: 'Start sequencer and single red-line EGT limiter', mass: 2, explode: [0.4, 0.75, -0.75],
    desc: 'Sequences an automatic start (starter, ignition, fuel, then cut-out) and holds the single red-line exhaust-temperature limit. The TPE331-10’s basic control is a “Single Red Line / Auto-Start Controller”; USAF investigators list an Engine Start Module beside the DEEC.',
  }, L(lru(0.1, 0.12, 0.15, ESM_P), m.lruOlive));
  const servoX = [8.66, 8.74, 8.82].map(XS);
  const servoG = [box(0.3, 0.012, 0.36, [XS(8.74), 1.78, 0])];
  servoX.forEach((x, i) => servoG.push(lru(0.06, 0.08, 0.1, [x, 1.83, -0.12 + i * 0.12], 0.01), box(0.012, 0.04, 0.012, [x - 0.03, 1.86, -0.12 + i * 0.12])));
  P('Engine control servos', {
    system: 'Propulsion', material: 'Three electromechanical servos on a bracket', mass: 3, count: 3, explode: [0.35, 1.25, 0],
    desc: 'With no cockpit, servos move the engine’s own levers: power lever, speed lever (propeller governor) and condition lever (stop & feather). After the 2006 crash every cable was still attached to its servo (NTSB). Positions estimated.',
  }, L(merge(servoG), m.lruOlive));
  const cabStart = (i) => [servoX[i] - 0.035, 1.86, -0.12 + i * 0.12];
  const cables = [
    pipe([cabStart(0), [XS(8.95), 1.9, -0.1], [XS(9.3), 1.94, -0.08], [fcuP[0] + 0.08, fcuP[1] + 0.03, -0.06]], 0.003, 4, 24),       // power lever → FCU
    pipe([cabStart(1), [XS(8.95), 1.88, 0.0], [XS(9.3), 1.94, -0.04], [msovP[0], msovP[1] + 0.05, msovP[2] - 0.02]], 0.003, 4, 24),       // condition lever → MSOV
    pipe([cabStart(2), [XS(8.95), 1.86, 0.12], [XS(9.2), 1.58, 0.28], [XS(9.6), 1.58, 0.285], [XS(9.95), 1.8, 0.26], [govP[0] + 0.06, govP[1] + 0.03, govP[2] - 0.01]], 0.003, 4, 40),  // speed lever → governor
  ];
  P('Engine control cables', {
    system: 'Propulsion', material: 'Push-pull control cables in conduit', mass: 0.8, count: 3, explode: [0.1, 1.55, 0.2],
    desc: 'Push-pull cables from the servos through the firewall to the fuel control’s power lever, the condition lever on the shutoff valve and the governor’s speed lever. A chafed propeller-governor cable was found at a 3,000-hour engine inspection in 2025 (routing estimated).',
  }, L(merge(cables), m.darkMetal));

  // ---- engine mounting
  P('Firewall', {
    system: 'Structure', material: 'Titanium sheet (est.)', mass: 9, explode: [0.15, 0.95, 0],
    desc: 'Fireproof bulkhead between the engine bay and the accessory bay ahead of it, with fire-sealed pass-throughs for the fuel, oil, control cables and harnesses. Titanium keeps its strength at flame temperatures where aluminium would melt.',
  }, L(bulkhead(FIREWALL_S), m.titanium));
  const mt = [];
  const lugTop = [XS(REAR_MOUNT_S), ENGINE_Y + REAR_MOUNT_R + 0.02, 0], lugBot = [XS(REAR_MOUNT_S), ENGINE_Y - REAR_MOUNT_R - 0.02, 0];
  for (const lug of [lugTop, lugBot]) mt.push(box(0.05, 0.035, 0.06, lug), cylX(lug[0] - 0.03, lug[0] + 0.03, 0.01, 0.01, lug[1], 0, 8));
  for (const th of [0.75, Math.PI - 0.75]) mt.push(tubeBetween(fusePoint(FIREWALL_S + 0.02, th, 0.05), lugTop, 0.012, 8));
  for (const th of [-0.75, -Math.PI + 0.75]) mt.push(tubeBetween(fusePoint(FIREWALL_S + 0.02, th, 0.05), lugBot, 0.012, 8));
  const fm = [XS(FRONT_MOUNT_S), ENGINE_Y + GEARBOX.top + 0.002, 0];
  for (const th of [0.42, Math.PI - 0.42]) mt.push(tubeBetween(fusePoint(9.31, th, 0.05), fm, 0.0125, 8), tubeBetween(fusePoint(10.3, th + (th < 1.6 ? -0.15 : 0.15), 0.04), fm, 0.011, 8));
  for (const th of [0.42, Math.PI - 0.42]) mt.push(tubeBetween(fusePoint(9.31, th, 0.05), lugTop, 0.01, 8));
  P('Engine mount truss', {
    system: 'Structure', material: 'Welded steel tube with elastomeric isolators (est.)', mass: 13, explode: [0, 1.15, 0],
    desc: 'The TPE331 hangs from Honeywell’s three mount points: two rear mounts, top and bottom at the hot end 0.20 m from the centreline, tied by tubes to the firewall frame, and a front mount on top of the gearbox, 0.60 m further aft, braced to the V-tail spar frames. Rubber isolators keep engine vibration out of the airframe and the sensors (tube layout estimated).',
  }, L(merge(mt), m.darkMetal));

  // ---- propeller (rotating groups)
  const propSpin = new THREE.Group(); propSpin.position.set(PROP_X, SHAFT_Y, 0);
  const hubSpin = new THREE.Group(); hubSpin.position.copy(propSpin.position);
  const domeSpin = new THREE.Group(); domeSpin.position.copy(propSpin.position);
  const bl = bladesGeo(3);
  P('Three-blade propeller', {
    system: 'Propulsion', material: 'Aluminium-alloy scimitar blades, matte black with yellow tips', mass: 45, count: 3, explode: [-2.3, -1.0, 0],
    desc: 'A McCauley 3GFR36C606 propeller with three 110GFA-0 blades: aluminium-alloy scimitar blades 1.46 m (57.5 in) long and 0.23 m (9 in) wide, 2.79 m (110 in) across, full-feathering and reversing (NTSB; overhaul records). The yellow tip stripes mark the tip arc for ground crews. Behind the wing and sensors it never blocks the view.',
    callout: true, anchor: [PROP_X + 0.03, SHAFT_Y - 0.58, -0.98],   // near the blade tips, lower port quadrant of the disc
  }, propSpin);
  propSpin.add(L(bl.black, m.blade), L(bl.yellow, m.bladeTip));
  const hub = hubGeo(3);
  P('Propeller hub & blade clamps', {
    system: 'Propulsion', material: 'Forged aluminium hub, steel clamps and counterweights', mass: 22, count: 3, explode: [-1.75, -1.0, 0],
    desc: 'The hub holds the three blade shanks in clamps that let each blade turn about its own axis. Counterweights on the clamps swing the blades toward feather if oil pressure is lost, so a failed engine’s propeller stops windmilling and adding drag.',
  }, hubSpin);
  hubSpin.add(L(hub.body, m.alu), L(hub.weights, m.darkMetal));
  const pc = pitchGeo();
  P('Pitch-change dome & feather spring', {
    system: 'Propulsion', material: 'Aluminium cylinder, steel piston, spring and stops', mass: 8, explode: [-2.25, -0.55, 0],
    desc: 'Governor oil pushes a piston in the dome toward low pitch and reverse; the feather spring and counterweights push the other way. Stops set flight idle and full reverse (beta). Reverse pitch is the MQ-9A’s main way of stopping: in 2018, when the propeller failed to reverse, the brakes could not absorb the energy and the aircraft left the runway.',
  }, domeSpin);
  domeSpin.add(L(pc.dome, m.alu), L(pc.piston, m.darkMetal), L(pc.spring, m.titanium), L(pc.stops, m.darkMetal));
  domeSpin.children[0].userData.xrayWeight = 0.6;
  P('Spinner', {
    system: 'Skin & fairings', skin: true, material: 'Polished aluminium spinner', mass: 5, explode: [-2.85, -1.0, 0],
    desc: 'A large polished spinner, about 0.6 m across, fairs the hub and the pitch-change dome into the end of the cowling so that the flow into the propeller roots stays smooth.',
  }, L(spinnerGeo().translate(PROP_X, SHAFT_Y, 0), m.spinner));

  return { propSpin, hubSpin, domeSpin, fanEnd, fcuP, pumpP, heatP, govP };
}
