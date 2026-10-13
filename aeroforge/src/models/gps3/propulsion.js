// GPS III propulsion (A2100 dual-mode system): a bipropellant liquid apogee engine for orbit raising
// and hydrazine monopropellant thrusters for attitude control and station-keeping, fed from a fuel
// and an oxidiser tank stacked in the central cylinder and pressurised by helium.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { lathe } from '../../engine/geometry.js';
import { G } from './materials.js';
import { GPS3 } from './data.js';
import { HX, HY, HZ, IX, IY, IZ, RC, boxG, cylG, merge, pipeG } from './kit.js';

export const FUEL = { z: 0.555, r: 0.58, barrel: 0.17 };
export const OX = { z: -0.63, r: 0.5 };
export const HE = { c: [0.62, 0.66, -0.55], r: 0.2 };
const LAE_TOP = -1.17;

/** Small monopropellant thruster pointing along `dir`, valve at p. */
function thrusterG(p, dir) {
  const d = new THREE.Vector3(...dir).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), d);
  const parts = [
    new THREE.CylinderGeometry(0.017, 0.017, 0.04, 12).translate(0, -0.02, 0),       // valve
    new THREE.CylinderGeometry(0.01, 0.01, 0.035, 10).translate(0, -0.057, 0),       // catalyst bed / chamber
    new THREE.CylinderGeometry(0.009, 0.022, 0.05, 14, 1, true).translate(0, -0.099, 0),  // nozzle
  ];
  return parts.map((g) => g.applyQuaternion(q).translate(p[0], p[1], p[2]));
}

export function buildPropulsion(P) {
  // ------------------------------------------------------------------ liquid apogee engine
  const prof = [[0.045, -0.1], [0.046, -0.19], [0.03, -0.215], [0.024, -0.228], [0.028, -0.245]];
  for (let i = 1; i <= 12; i++) { const t = i / 12; prof.push([0.028 + (0.135 - 0.028) * Math.pow(t, 0.62), -0.245 - 0.365 * t]); }
  const bell = lathe(prof, 40).rotateX(Math.PI / 2).translate(0, 0, LAE_TOP);
  const head = merge([
    cylG([0, 0, LAE_TOP - 0.03], 0.075, 0.06, 'z', 28), cylG([0, 0, LAE_TOP - 0.08], 0.05, 0.04, 'z', 24),
    boxG([0.085, 0, LAE_TOP - 0.03], [0.06, 0.05, 0.05]), boxG([-0.085, 0, LAE_TOP - 0.03], [0.06, 0.05, 0.05]),
  ]);
  const lae = P('Liquid apogee engine', {
    system: 'Propulsion', material: 'Refractory-metal chamber and radiation-cooled nozzle', mass: 5, temp: 270, explode: [0, 0, -2.2],
    desc: `The ${GPS3.laeThrust} N-class bipropellant engine (hydrazine burned with nitrogen tetroxide) that lifts GPS III from its transfer orbit to 20,180 km in a series of apogee burns. Thrust and Isp ≈ ${GPS3.laeIsp} s are estimates; the engine model is not named in public sources.`,
    callout: true, anchor: [0.135, 0, LAE_TOP - 0.61],
  }, [mesh(bell, G.nozzle()), mesh(head, G.gunmetal())]);
  lae.userData.part.thermalRole = 'engine';
  const shield = merge([
    cylG([0, 0, -HZ - 0.02], 0.3, 0.004, 'z', 48, 0.3),
    cylG([0, 0, -HZ - 0.075], 0.09, 0.11, 'z', 32, 0.14, true),
  ]);
  P('Engine heat shield', {
    system: 'Thermal control', material: 'Polished molybdenum / titanium radiation shield', mass: 3, temp: 320, explode: [0, 0, -1.85],
    desc: 'The nozzle glows above 1,000 °C during a burn and is cooled only by radiating. This shield reflects that heat away from the aft deck, the adapter and the propellant lines.',
  }, mesh(shield, G.silverBox()));

  // ------------------------------------------------------------------ tanks
  const fuelG = new THREE.CapsuleGeometry(FUEL.r, FUEL.barrel, 16, 56).rotateX(Math.PI / 2).translate(0, 0, FUEL.z);
  const fuelMounts = [cylG([0, 0, FUEL.z], FUEL.r + 0.012, 0.05, 'z', 56)];
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; fuelMounts.push(boxG([Math.cos(a) * (FUEL.r + 0.024), Math.sin(a) * (FUEL.r + 0.024), FUEL.z], [0.03, 0.03, 0.06])); }
  P('Fuel tank (hydrazine)', {
    system: 'Fuel', material: 'Titanium alloy shell with propellant-management device', mass: 52, temp: 293, explode: [0, 0, 1.0],
    desc: `Holds about ${GPS3.fuelLoad} kg of hydrazine (estimate) for both the apogee engine and the thrusters. Surface-tension vanes inside keep liquid over the outlet in weightlessness. 1.16 m diameter, sized to the central cylinder.`,
    callout: true, anchor: [0.41, -0.41, FUEL.z + 0.1],
  }, [mesh(fuelG, G.tank()), mesh(merge(fuelMounts), G.aluminium())]);
  const oxMounts = [cylG([0, 0, OX.z], OX.r + 0.01, 0.045, 'z', 48)];
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + 0.2; oxMounts.push(new THREE.BoxGeometry(0.12, 0.03, 0.04).rotateZ(a).translate(Math.cos(a) * (OX.r + 0.06), Math.sin(a) * (OX.r + 0.06), OX.z)); }
  P('Oxidiser tank (NTO)', {
    system: 'Fuel', material: 'Titanium alloy sphere', mass: 34, temp: 293, explode: [0, 0, -0.85],
    desc: `About ${GPS3.oxLoad} kg of nitrogen tetroxide (estimate), used only by the apogee engine. Hydrazine and NTO ignite on contact (hypergolic), so the engine needs no igniter and restarts reliably for every apogee burn.`,
  }, [mesh(new THREE.SphereGeometry(OX.r, 48, 28).translate(0, 0, OX.z), G.tank()), mesh(merge(oxMounts), G.aluminium())]);
  // equatorial strap and two struts back to the central cylinder wall (clear of the reaction wheel below)
  const inward = [-HE.c[0], -HE.c[1]].map((v) => v / Math.hypot(HE.c[0], HE.c[1]));
  const heStraps = [cylG(HE.c, HE.r + 0.006, 0.03, 'z', 32)];
  for (const dz of [-0.07, 0.07]) {
    const a = [HE.c[0] + inward[0] * (HE.r - 0.01), HE.c[1] + inward[1] * (HE.r - 0.01), HE.c[2] + dz];
    const b = [inward[0] * -(RC + 0.005), inward[1] * -(RC + 0.005), HE.c[2] + dz];
    heStraps.push(pipeG([a, b], 0.014, 8));
  }
  P('Helium pressurant tank', {
    system: 'Fuel', material: 'Carbon-overwrapped titanium-lined pressure vessel', mass: 20, temp: 293, explode: [0.6, 0.6, -0.3],
    desc: 'Stores helium at around 300 bar (estimate). A regulator feeds it to the propellant tanks at a steady pressure so the apogee engine burns at a constant mixture ratio.',
  }, [mesh(new THREE.SphereGeometry(HE.r, 32, 20).translate(...HE.c), G.copv()), mesh(merge(heStraps), G.aluminium())]);

  // ------------------------------------------------------------------ pressurant panel, lines, valves
  const px = -IX;
  const panel = [boxG([px + 0.008, 0.42, -0.55], [0.016, 0.36, 0.42])];
  const comps = [cylG([px + 0.06, 0.42, -0.5], 0.035, 0.13, 'z', 16)];
  for (const [y, z] of [[0.3, -0.68], [0.54, -0.68], [0.3, -0.4], [0.54, -0.4]]) comps.push(cylG([px + 0.045, y, z], 0.022, 0.05, 'x', 14));
  comps.push(cylG([px + 0.04, 0.42, -0.7], 0.016, 0.06, 'z', 10), cylG([px + 0.04, 0.42, -0.35], 0.012, 0.05, 'x', 10));
  P('Pressurant control panel', {
    system: 'Fuel', material: 'Regulator, latch valves, filters and pressure transducers on an aluminium plate', mass: 14, temp: 290, explode: [-1.0, 0, 0],
    desc: 'Pyrotechnic and latching valves isolate the helium until it is needed, a regulator steps it down to tank pressure, and check valves keep fuel and oxidiser vapours from ever meeting upstream of the engine.',
  }, [mesh(merge(panel), G.silverBox()), mesh(merge(comps), G.tubing())]);

  const r = 0.005, mz = -IZ + 0.013, mr = 0.76;
  const lines = [
    // fuel: tank outlet → out through the cylinder → down → engine valve
    pipeG([[0, 0, FUEL.z - FUEL.r - FUEL.barrel / 2 + 0.005], [0.3, 0.06, -0.12], [0.7, 0.08, -0.12], [0.7, 0.08, mz], [0.09, 0.03, LAE_TOP - 0.03]], r),
    // oxidiser: tank outlet → engine valve
    pipeG([[0, 0, OX.z - OX.r + 0.005], [-0.04, 0, LAE_TOP + 0.01], [-0.09, 0, LAE_TOP - 0.03]], r),
    // helium: tank → pressurant panel → tank tops
    pipeG([[HE.c[0], HE.c[1], HE.c[2] + HE.r], [HE.c[0], HE.c[1], -0.3], [0, 0.72, -0.3], [-0.7, 0.42, -0.3], [px + 0.06, 0.42, -0.43]], r),
    pipeG([[px + 0.06, 0.32, -0.42], [-0.74, 0.32, -0.42], [-0.74, 0.32, 1.12], [-0.3, 0.1, 1.2], [0, 0, FUEL.z + FUEL.r + FUEL.barrel / 2 - 0.005]], r),
    pipeG([[px + 0.06, 0.52, -0.62], [-0.75, 0.2, -0.62], [-0.7, 0.1, -0.13], [0, 0, OX.z + OX.r - 0.005]], r),
  ];
  // thruster manifold ring on the aft deck and its branches to the four clusters
  const ring = [];
  for (let k = 0; k <= 40; k++) { const a = (k / 40) * Math.PI * 2; ring.push([Math.cos(a) * mr, Math.sin(a) * mr, mz]); }
  lines.push(pipeG(ring, r));
  lines.push(pipeG([[0.7, 0.08, mz], [mr, 0.08, mz]], r));
  const corners = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (const [sx, sy] of corners) {
    const a = Math.atan2(sy, sx);
    lines.push(pipeG([[Math.cos(a) * mr, Math.sin(a) * mr, mz], [sx * 0.79, sy * 0.81, mz], [sx * 0.79, sy * 0.81, -HZ - 0.03]], r));
  }
  P('Propellant lines & valves', {
    system: 'Fuel', material: 'Titanium tubing, latch valves, filters', mass: 24, temp: 290, explode: [0, 0, -0.3],
    desc: 'Quarter-inch-class titanium lines carry helium to the tanks and propellant to the engine and the thruster manifold; latch valves let the ground isolate a leaking branch. Every line is wrapped with heaters because hydrazine freezes at 2 °C (routing estimated).',
  }, mesh(merge(lines), G.tubing()));
  const fdv = [];
  for (let k = 0; k < 3; k++) {
    const y = 0.28 + k * 0.1;
    fdv.push(cylG([-0.72, y, -HZ - 0.04], 0.018, 0.06, 'z', 12), cylG([-0.72, y, -HZ - 0.08], 0.024, 0.02, 'z', 6));
  }
  P('Fill-and-drain valves', {
    system: 'Fuel', material: 'Stainless-steel service valves with caps', mass: 2, count: 3, temp: 240, explode: [-0.3, 0, -1.85],
    desc: 'Where technicians in protective suits load the hydrazine, the oxidiser and the helium at the launch site, weeks before launch. Count and position estimated.',
  }, mesh(merge(fdv), G.silverBox()));

  // ------------------------------------------------------------------ hydrazine thruster clusters
  for (const [sx, sy] of corners) {
    const p = [sx * 0.79, sy * 0.81, -HZ - 0.03];
    const bracket = [boxG([p[0], p[1], p[2] - 0.02], [0.12, 0.12, 0.04])];
    const thr = [
      ...thrusterG([p[0], p[1], p[2] - 0.04], [0.12 * sx, 0.12 * sy, -1]),
      ...thrusterG([p[0] + 0.045 * sx, p[1], p[2] - 0.03], [1 * sx, 0, -0.35]),
      ...thrusterG([p[0], p[1] + 0.045 * sy, p[2] - 0.03], [0, 1 * sy, -0.35]),
    ];
    const t = P(`Thruster cluster (${sx > 0 ? '+X' : '−X'}${sy > 0 ? '+Y' : '−Y'})`, {
      system: 'Propulsion', material: 'Catalytic hydrazine thrusters on a titanium bracket', mass: 3.2, count: 3, temp: 270, explode: [sx * 0.4, sy * 0.4, -1.7],
      desc: `Three small hydrazine thrusters (Isp ≈ ${GPS3.rcsIsp} s): hydrazine decomposes over an iridium catalyst into hot gas, with no oxidiser. They control attitude during apogee burns, unload the reaction wheels and make the small station-keeping and disposal moves (count and layout estimated).`,
    }, [mesh(merge(bracket), G.titanium()), mesh(merge(thr), G.nozzle())]);
    t.userData.part.thermalRole = 'thruster';
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
