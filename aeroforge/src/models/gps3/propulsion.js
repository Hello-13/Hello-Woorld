// GPS III propulsion subsystem (A2100 dual-mode system): a bipropellant liquid apogee engine for
// final orbit insertion, "5-lbf" (22 N) thrusters for large on-orbit manoeuvres and "0.2-lbf"
// (0.9 N) thrusters for attitude and station-keeping (Marquis & Shaw, InsideGNSS 2011), fed from a
// hydrazine and an oxidiser tank stacked in the central cylinder and pressurised by helium. The
// tanks are Orbital ATK composite tanks. Counts, sizes and routing not in public sources are
// estimates and say so.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { lathe } from '../../engine/geometry.js';
import { G } from './materials.js';
import { GPS3 } from './data.js';
import { HZ, IX, IZ, RC, AFT, boxG, cylG, merge, pipeG, rodG } from './kit.js';

export const FUEL = { z: 0.62, r: 0.58, barrel: 0.24 };
export const OX = { z: -0.68, r: 0.52 };
export const HE = { a: [0.45, 0.9, -0.62], b: [-0.45, -0.9, -0.62], r: 0.24 };
const LAE_TOP = -1.38;
export const CORNERS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
export const CLUSTER = (sx, sy) => [sx * 0.79, sy * 1.11];

/** Small thruster pointing along `dir` with its valve at p; scale k (1 = 0.9 N class). */
function thrusterG(p, dir, k = 1) {
  const d = new THREE.Vector3(...dir).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), d);
  const parts = [
    new THREE.CylinderGeometry(0.017 * k, 0.017 * k, 0.04 * k, 12).translate(0, -0.02 * k, 0),             // valve
    new THREE.CylinderGeometry(0.01 * k, 0.01 * k, 0.035 * k, 10).translate(0, -0.057 * k, 0),             // catalyst bed / chamber
    new THREE.CylinderGeometry(0.009 * k, 0.022 * k, 0.05 * k, 14, 1, true).translate(0, -0.099 * k, 0),   // nozzle
  ];
  return parts.map((g) => g.applyQuaternion(q).translate(p[0], p[1], p[2]));
}

export function buildPropulsion(P) {
  // ------------------------------------------------------------------ liquid apogee engine
  const prof = [[0.045, -0.1], [0.046, -0.19], [0.03, -0.215], [0.024, -0.228], [0.028, -0.245]];
  for (let i = 1; i <= 12; i++) { const t = i / 12; prof.push([0.028 + (0.135 - 0.028) * Math.pow(t, 0.62), -0.245 - 0.365 * t]); }
  const bell = lathe(prof, 40).rotateX(Math.PI / 2).translate(0, 0, LAE_TOP);
  const head = merge([cylG([0, 0, LAE_TOP - 0.03], 0.075, 0.06, 'z', 28), cylG([0, 0, LAE_TOP - 0.08], 0.05, 0.04, 'z', 24)]);
  const lae = P('Liquid apogee engine', {
    system: 'Propulsion', material: 'Refractory-metal chamber and radiation-cooled nozzle', mass: 5, temp: 270, explode: [0, 0, -2.2],
    desc: `The ${GPS3.laeThrust} N-class bipropellant engine (hydrazine burned with nitrogen tetroxide) that lifts GPS III from its transfer orbit to 20,180 km in a series of apogee burns, the "final orbit insertion" of the design papers. Thrust and Isp ≈ ${GPS3.laeIsp} s are estimates; the engine is not named in public sources.`,
    callout: true, anchor: [0.135, 0, LAE_TOP - 0.61],
  }, [mesh(bell, G.nozzle()), mesh(head, G.gunmetal())]);
  lae.userData.part.thermalRole = 'engine';
  P('Engine bipropellant valve', {
    system: 'Propulsion', material: 'Torque-motor valves on the injector head', mass: 1.2, temp: 280, explode: [0, 0, -2.0],
    desc: 'Twin valves that open fuel and oxidiser to the injector together, so the hypergolic propellants meet only in the chamber. Each apogee burn lasts many minutes; the valves open and close for every one (form estimated).',
  }, mesh(merge([boxG([0.085, 0, LAE_TOP - 0.03], [0.06, 0.05, 0.05]), boxG([-0.085, 0, LAE_TOP - 0.03], [0.06, 0.05, 0.05]), boxG([0, 0.075, LAE_TOP - 0.02], [0.05, 0.03, 0.04])]), G.gunmetal()));
  const shield = merge([
    new THREE.RingGeometry(0.09, 0.3, 48).translate(0, 0, -HZ - 0.02),
    cylG([0, 0, -HZ - 0.075], 0.09, 0.11, 'z', 32, 0.14, true),
  ]);
  P('Engine heat shield', {
    system: 'Thermal control', material: 'Polished molybdenum / titanium radiation shield', mass: 3, temp: 320, explode: [0, 0, -1.85],
    desc: 'The nozzle glows above 1,000 °C during a burn and is cooled only by radiating. This shield reflects that heat away from the aft deck, the adapter and the propellant lines.',
  }, mesh(shield, G.silverBox()));

  // ------------------------------------------------------------------ tanks
  const fuelG = new THREE.CapsuleGeometry(FUEL.r, FUEL.barrel, 16, 56).rotateX(Math.PI / 2).translate(0, 0, FUEL.z);
  const fuelMounts = [cylG([0, 0, FUEL.z], FUEL.r + 0.012, 0.05, 'z', 56), cylG([0, 0, FUEL.z + FUEL.barrel / 2 + FUEL.r], 0.05, 0.03, 'z', 16), cylG([0, 0, FUEL.z - FUEL.barrel / 2 - FUEL.r], 0.05, 0.03, 'z', 16)];
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; fuelMounts.push(boxG([Math.cos(a) * (FUEL.r + 0.024), Math.sin(a) * (FUEL.r + 0.024), FUEL.z], [0.03, 0.03, 0.06])); }
  P('Fuel tank (hydrazine)', {
    system: 'Fuel', material: 'Titanium liner with carbon-fibre overwrap (Orbital ATK), propellant-management device', mass: 45, temp: 293, explode: [0, 0, 1.0],
    desc: `Holds about ${GPS3.fuelLoad} kg of hydrazine (estimate) for both the apogee engine and the thrusters. Surface-tension vanes inside keep liquid over the outlet in weightlessness. 1.16 m across, sized here to the central cylinder; the tanks are composite, built by Orbital ATK.`,
  }, [mesh(fuelG, G.tank()), mesh(merge(fuelMounts), G.satinTi())]);
  const oxMounts = [cylG([0, 0, OX.z], OX.r + 0.01, 0.045, 'z', 48), cylG([0, 0, OX.z - OX.r], 0.045, 0.03, 'z', 16)];
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + 0.2; oxMounts.push(new THREE.BoxGeometry(0.12, 0.03, 0.04).rotateZ(a).translate(Math.cos(a) * (OX.r + 0.06), Math.sin(a) * (OX.r + 0.06), OX.z)); }
  const oxIn = [-0.26, 0, OX.z + OX.r * Math.cos(Math.PI / 6)];
  oxMounts.push(cylG(oxIn, 0.03, 0.03, 'z', 12));
  P('Oxidiser tank (NTO)', {
    system: 'Fuel', material: 'Titanium liner with carbon-fibre overwrap (Orbital ATK)', mass: 28, temp: 293, explode: [0, 0, -0.85],
    desc: `About ${GPS3.oxLoad} kg of nitrogen tetroxide (estimate), used only by the apogee engine. Hydrazine and NTO ignite on contact (hypergolic), so the engine needs no igniter and restarts reliably for every apogee burn.`,
  }, [mesh(new THREE.SphereGeometry(OX.r, 48, 28).translate(0, 0, OX.z), G.tank()), mesh(merge(oxMounts), G.satinTi())]);
  for (const [tag, c] of [['A', HE.a], ['B', HE.b]]) {
    const inward = [-c[0], -c[1]].map((v) => v / Math.hypot(c[0], c[1]));
    const straps = [cylG(c, HE.r + 0.006, 0.03, 'z', 32), cylG([c[0], c[1], c[2] + HE.r], 0.03, 0.03, 'z', 12), cylG([c[0], c[1], c[2] - HE.r], 0.03, 0.03, 'z', 12)];
    for (const dz of [-0.07, 0.07]) {
      const a = [c[0] + inward[0] * (HE.r - 0.01), c[1] + inward[1] * (HE.r - 0.01), c[2] + dz];
      const b = [inward[0] * -(RC + 0.005), inward[1] * -(RC + 0.005), c[2] + dz];
      straps.push(rodG(a, b, 0.014, 8));
    }
    P(`Helium tank (${tag})`, {
      system: 'Fuel', material: 'Carbon-overwrapped titanium-lined pressure vessel (Orbital ATK)', mass: 12, temp: 293, explode: [c[0] * 0.6, c[1] * 0.6, -0.3],
      desc: tag === 'A'
        ? 'One of two helium pressurant tanks, about 58 L each at around 300 bar (estimates). Together they hold enough gas to push the whole propellant load, about 1.3 m³ (900 kg of hydrazine ≈ 0.90 m³ plus 620 kg of nitrogen tetroxide ≈ 0.43 m³), out of the tanks at the regulated pressure; sized here to that load.'
        : 'The second helium tank, on the opposite side of the cylinder to balance the spacecraft. Tank count and size are estimates.',
    }, [mesh(new THREE.SphereGeometry(HE.r, 32, 20).translate(...c), G.copv()), mesh(merge(straps), G.aluminium())]);
  }

  // ------------------------------------------------------------------ pressurant control panel (−X panel inner face)
  const px = -IX;
  P('Pressurant control panel', {
    system: 'Fuel', material: 'Aluminium mounting plate', mass: 3, temp: 290, explode: [-1.0, 0, 0],
    desc: 'Carries the helium controls in the order the gas flows through them: isolation valves, regulator, check valves, with pressure transducers at each stage for the ground to watch.',
  }, mesh(boxG([px + 0.008, 0.55, -0.75], [0.016, 0.36, 0.42]), G.silverBox()));
  P('Pyrotechnic isolation valves', {
    system: 'Fuel', material: 'Stainless-steel normally-closed pyro valves', mass: 1.2, count: 2, temp: 290, explode: [-1.05, 0, 0],
    desc: 'Seal the helium in its tanks from the factory until orbit. A small charge fires once to open each valve; it can never close again, so the regulator takes over from then on.',
  }, mesh(merge([cylG([px + 0.045, 0.47, -0.6], 0.022, 0.05, 'x', 14), cylG([px + 0.045, 0.63, -0.6], 0.022, 0.05, 'x', 14), boxG([px + 0.05, 0.47, -0.56], [0.03, 0.02, 0.03]), boxG([px + 0.05, 0.63, -0.56], [0.03, 0.02, 0.03])]), G.tubing()));
  P('Helium pressure regulator', {
    system: 'Fuel', material: 'Stainless-steel pressure regulator', mass: 1.5, temp: 290, explode: [-1.1, 0, 0],
    desc: 'Steps the helium down from around 300 bar to a steady tank pressure (about 18–20 bar, estimate), so the apogee engine burns at a constant mixture ratio as the tanks empty.',
  }, mesh(merge([cylG([px + 0.06, 0.55, -0.75], 0.035, 0.14, 'z', 18), cylG([px + 0.06, 0.55, -0.66], 0.02, 0.04, 'z', 12)]), G.tubing()));
  P('Check valves', {
    system: 'Fuel', material: 'Stainless-steel check valves', mass: 0.6, count: 2, temp: 290, explode: [-1.05, 0, 0],
    desc: 'One-way valves on the regulator outlets, one toward each tank, so fuel and oxidiser vapours can never flow back and meet upstream of the engine.',
  }, mesh(merge([cylG([px + 0.045, 0.45, -0.9], 0.018, 0.05, 'x', 12), cylG([px + 0.045, 0.65, -0.9], 0.018, 0.05, 'x', 12)]), G.tubing()));
  P('Pressure transducers', {
    system: 'Fuel', material: 'Strain-gauge transducers', mass: 0.5, count: 3, temp: 290, explode: [-1.1, 0, 0],
    desc: 'Read the helium pressure before and after the regulator; tank pressures and temperatures are how the ground estimates the propellant left in orbit (count and position estimated).',
  }, mesh(merge([[0.4, -0.75], [0.7, -0.75], [0.55, -0.53]].map(([y, z]) => cylG([px + 0.04, y, z], 0.012, 0.05, 'x', 10))), G.blackBox()));

  // ------------------------------------------------------------------ lines
  const r = 0.005, mz = -IZ + 0.013, mr = 0.76;
  const fuelTop = FUEL.z + FUEL.r + FUEL.barrel / 2, fuelBot = FUEL.z - FUEL.r - FUEL.barrel / 2;
  P('Helium pressurant lines', {
    system: 'Fuel', material: 'Titanium tubing', mass: 4, temp: 290, explode: [-0.2, 0, 0.1],
    desc: 'Carry helium from the two tanks to the control panel and on to the tops of the fuel and oxidiser tanks (routing estimated).',
  }, mesh(merge([
    pipeG([[HE.a[0], HE.a[1], HE.a[2] + HE.r], [HE.a[0], HE.a[1], -0.3], [0.1, 0.8, -0.3], [-0.3, 0.78, -0.3], [-0.7, 0.55, -0.3], [px + 0.07, 0.55, -0.48]], r),
    pipeG([[HE.b[0], HE.b[1], HE.b[2] + HE.r], [HE.b[0], HE.b[1], -0.3], [-0.75, -0.4, -0.3], [-0.75, 0.3, -0.3], [px + 0.07, 0.4, -0.48], [px + 0.07, 0.55, -0.48]], r),
    pipeG([[px + 0.07, 0.55, -0.48], [px + 0.07, 0.47, -0.52], [px + 0.07, 0.47, -0.62], [px + 0.07, 0.55, -0.66]], r),
    pipeG([[px + 0.07, 0.55, -0.48], [px + 0.07, 0.63, -0.52], [px + 0.07, 0.63, -0.62], [px + 0.07, 0.55, -0.66]], r),
    pipeG([[px + 0.07, 0.55, -0.84], [px + 0.07, 0.45, -0.86], [px + 0.07, 0.45, -0.94]], r),
    pipeG([[px + 0.07, 0.55, -0.84], [px + 0.07, 0.65, -0.86], [px + 0.07, 0.65, -0.94]], r),
    pipeG([[px + 0.07, 0.45, -0.94], [-0.76, 0.35, -0.94], [-0.76, 0.35, 1.3], [-0.4, 0.15, 1.355], [0, 0, 1.355], [0, 0, fuelTop]], r),
    pipeG([[px + 0.07, 0.65, -0.94], [-0.74, 0.2, -0.94], [-0.74, 0.2, oxIn[2]], [oxIn[0], 0, oxIn[2]]], r),
  ]), G.tubing()));
  P('Fuel feed lines', {
    system: 'Fuel', material: 'Titanium tubing', mass: 4, temp: 290, explode: [0.25, 0, -0.2],
    desc: 'Hydrazine leaves the bottom of its tank, passes the filter and latch valves at the aft deck and splits: one branch to the apogee engine, one to the thruster manifold. Every line is wrapped with heaters because hydrazine freezes at 2 °C (routing estimated).',
  }, mesh(merge([
    pipeG([[0, 0, fuelBot], [0, 0, -0.12], [0.55, 0.1, -0.12], [0.72, 0.15, -0.12], [0.72, 0.15, -1.12]], r),
    pipeG([[0.72, 0.15, -1.2], [0.72, 0.15, -1.3], [0.7, 0.15, -1.355], [0.12, 0.05, -1.4], [0.09, 0, LAE_TOP - 0.03]], r),
    pipeG([[0.72, 0.15, -1.25], [0.72, -0.15, -1.25], [0.72, -0.15, -1.3], [0.745, -0.15, mz]], r),
    pipeG([[0.74, 0.3, AFT], [0.74, 0.3, -1.33], [0.72, 0.18, -1.25]], r),
  ]), G.tubing()));
  P('Oxidiser feed line', {
    system: 'Fuel', material: 'Titanium tubing', mass: 1.5, temp: 290, explode: [0, 0, -0.5],
    desc: 'A short line from the bottom of the oxidiser tank, through its latch valve, to the engine valve; the fill line joins it from the aft service panel.',
  }, mesh(merge([
    pipeG([[0, 0, OX.z - OX.r], [0, 0, -1.33], [-0.05, 0, -1.37], [-0.09, 0, LAE_TOP - 0.03]], r),
    pipeG([[0.74, 0.45, AFT], [0.74, 0.45, -1.33], [0.45, 0.3, -1.33], [0.05, 0.05, -1.3], [0, 0, -1.3]], r),
  ]), G.tubing()));
  const ring = [];
  for (let k = 0; k <= 40; k++) { const a = (k / 40) * Math.PI * 2; ring.push([Math.cos(a) * mr, Math.sin(a) * mr, mz]); }
  const man = [pipeG(ring, r)];
  for (const [sx, sy] of CORNERS) {
    const [cx, cy] = CLUSTER(sx, sy);
    const a = Math.atan2(sy * 0.5, sx);
    man.push(pipeG([[Math.cos(a) * mr, Math.sin(a) * mr, mz], [sx * 0.8, sy * 0.42, mz], [sx * 0.8, cy, mz], [cx, cy, AFT - 0.005]], r));
  }
  P('Thruster manifold', {
    system: 'Fuel', material: 'Titanium tubing', mass: 3, temp: 290, explode: [0, 0, -0.3],
    desc: 'A ring of tubing on the aft deck that feeds hydrazine to all four thruster clusters, so any cluster can draw from the same tank (routing estimated).',
  }, mesh(merge(man), G.tubing()));
  P('Latch valves & filter', {
    system: 'Fuel', material: 'Latching solenoid valves, etched-disc filter', mass: 2.4, count: 4, temp: 290, explode: [0.4, 0, -0.4],
    desc: 'A filter catches particles before they reach a valve seat; latching valves, which hold open or closed with no power, let the ground isolate the engine or the thrusters or a leaking branch (count estimated).',
  }, mesh(merge([cylG([0.72, 0.15, -1.16], 0.025, 0.08, 'z', 14), cylG([0.72, 0.15, -1.29], 0.022, 0.05, 'z', 12), cylG([0.72, -0.15, -1.29], 0.022, 0.05, 'z', 12), cylG([0, 0, -1.27], 0.022, 0.05, 'z', 12), boxG([0.72, 0.15, -1.29], [0.06, 0.03, 0.03]), boxG([0.72, -0.15, -1.29], [0.06, 0.03, 0.03])]), G.silverBox()));
  const fdv = (name, y, desc) => P(name, {
    system: 'Fuel', material: 'Stainless-steel service valve with cap', mass: 0.6, temp: 240, explode: [0.3, 0, -1.85], desc,
  }, mesh(merge([cylG([0.74, y, AFT - 0.03], 0.018, 0.06, 'z', 12), cylG([0.74, y, AFT - 0.07], 0.024, 0.02, 'z', 6)]), G.silverBox()));
  fdv('Fuel fill-and-drain valve', 0.3, 'Where technicians in protective suits load the hydrazine at the launch site, weeks before launch. Position estimated.');
  fdv('Oxidiser fill-and-drain valve', 0.45, 'Loading port for the nitrogen tetroxide. Fuel and oxidiser are loaded on different days so a spill of one can never meet the other. Position estimated.');
  fdv('Helium fill valve', 0.6, 'Charging port for the helium, loaded last, after the propellants. Position estimated.');
  P('Helium fill line', {
    system: 'Fuel', material: 'Titanium tubing', mass: 0.4, temp: 290, explode: [0.3, 0, -0.6],
    desc: 'Runs from the helium fill valve to the first helium tank; the second fills through the manifold on the control panel.',
  }, mesh(pipeG([[0.74, 0.6, AFT], [0.74, 0.6, -1.0], [HE.a[0], HE.a[1], HE.a[2] - HE.r]], r), G.tubing()));

  // ------------------------------------------------------------------ thrusters (four corner clusters on the aft deck)
  for (const [sx, sy] of CORNERS) {
    const [cx, cy] = CLUSTER(sx, sy);
    const tag = `${sx > 0 ? '+X' : '−X'}${sy > 0 ? '+Y' : '−Y'}`;
    const top = AFT;   // bracket seated on the aft blanket
    const bracket = [boxG([cx, cy, top - 0.02], [0.14, 0.14, 0.04])];
    const small = [
      ...thrusterG([cx + 0.04 * sx, cy + 0.04 * sy, top - 0.04], [0.15 * sx, 0.15 * sy, -1]),
      ...thrusterG([cx + 0.07 * sx, cy - 0.02 * sy, top - 0.03], [1 * sx, 0, -0.35]),
      ...thrusterG([cx - 0.02 * sx, cy + 0.07 * sy, top - 0.03], [0, 1 * sy, -0.35]),
    ];
    const t = P(`Thruster cluster (${tag})`, {
      system: 'Propulsion', material: 'Catalytic hydrazine thrusters on a titanium bracket', mass: 2.6, count: 3, temp: 270, explode: [sx * 0.4, sy * 0.4, -1.7],
      desc: `Three of the ${GPS3.thrusterSmall} N ("0.2-lbf") hydrazine thrusters, Isp ≈ ${GPS3.rcsIsp} s: hydrazine decomposes over an iridium catalyst into hot gas, with no oxidiser. They control attitude, unload the reaction wheels and make the small station-keeping moves (count and layout estimated).`,
    }, [mesh(merge(bracket), G.satinTi()), mesh(merge(small), G.nozzle())]);
    t.userData.part.thermalRole = 'thruster';
    const big = P(`22 N thruster (${tag})`, {
      system: 'Propulsion', material: 'Catalytic hydrazine thruster', mass: 0.7, temp: 270, explode: [sx * 0.45, sy * 0.45, -1.9],
      desc: 'One of the "5-lbf" (22 N) hydrazine thrusters used for the larger on-orbit manoeuvres, such as moving the satellite to a new slot in its orbital plane or the final move to a disposal orbit (count and position estimated).',
    }, mesh(merge(thrusterG([cx - 0.035 * sx, cy - 0.035 * sy, top - 0.04], [0, 0, -1], 1.6)), G.nozzle()));
    big.userData.part.thermalRole = 'thruster';
  }

  // ------------------------------------------------------------------ heaters
  const heaters = [
    cylG([0, 0, FUEL.z + 0.06], FUEL.r + 0.004, 0.06, 'z', 56, FUEL.r + 0.004, true),
    cylG([0, 0, OX.z + 0.12], Math.sqrt(OX.r ** 2 - 0.12 ** 2) + 0.004, 0.05, 'z', 48, Math.sqrt(OX.r ** 2 - 0.12 ** 2) + 0.004, true),
    cylG([0, 0, LAE_TOP - 0.03], 0.079, 0.03, 'z', 28, 0.079, true),
  ];
  P('Propulsion heaters & thermostats', {
    system: 'Thermal control', material: 'Kapton film heaters, bimetallic thermostats', mass: 6, temp: 300, explode: [0, 0, 0.2],
    desc: 'Film heaters on the tanks, engine valves and every propellant line keep the hydrazine liquid (it freezes at 2 °C); thermostats and the flight software switch them as each part cools in shadow.',
  }, mesh(merge(heaters), G.heater()));
}
