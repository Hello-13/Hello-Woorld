// GPS III propulsion subsystem, the A2100 dual-mode system: a bipropellant liquid apogee engine for
// final orbit insertion that burns hydrazine from one central tank with nitrogen tetroxide from two
// flanking tanks, "5-lbf" (22 N) thrusters for large on-orbit manoeuvres and "0.2-lbf" (0.9 N)
// thrusters for attitude and station-keeping, both on hydrazine alone (Marquis & Shaw 2011;
// Wikipedia "Lockheed Martin A2100"). The A2100 central tank is 0.90 m across and up to 2.0 m long;
// the two oxidiser tanks 0.54 m across and up to 1.65 m long. Lockheed's figure shows the fuel tank
// inside the core and "Oxidizer Tank (2)" outside it, and the scale model shows one tank in each ±X
// bay. Helium pressurises all three. Counts, sizes and routing not in public sources are estimates.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { lathe } from '../../engine/geometry.js';
import { G } from './materials.js';
import { GPS3 } from './data.js';
import { HX, HZ, IZ, CORE, AFT, ADAPTER, boxG, cylG, capsuleG, merge, pipeG, rodG, plateG, reg } from './kit.js';

import { FUEL, OX, HE } from './dims.js';

export { FUEL, OX, HE };
const LAE_TOP = -1.72;
export const CORNERS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
/** Thruster cluster position (outboard end of each aft-corner outrigger bracket). */
export const CLUSTER = (sx, sy) => [sx * 1.5, sy * 0.45, -1.86];
const fuelTop = FUEL.c[2] + FUEL.L / 2, fuelBot = FUEL.c[2] - FUEL.L / 2;
const oxTop = OX.z + OX.L / 2, oxBot = OX.z - OX.L / 2;

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
  // ------------------------------------------------------------------ liquid apogee engine and its mount
  const prof = [[0.045, 0.0], [0.046, -0.16], [0.03, -0.185], [0.024, -0.198], [0.028, -0.215]];
  for (let i = 1; i <= 14; i++) { const t = i / 14; prof.push([0.028 + (0.135 - 0.028) * Math.pow(t, 0.62), -0.215 - 0.465 * t]); }
  const bell = lathe(prof, 44).rotateX(Math.PI / 2).translate(0, 0, LAE_TOP - 0.06);
  const head = merge([cylG([0, 0, LAE_TOP - 0.03], 0.075, 0.06, 'z', 28), cylG([0, 0, LAE_TOP - 0.075], 0.05, 0.03, 'z', 24)]);
  const lae = P('Liquid apogee engine', {
    system: 'Propulsion', material: 'Niobium-alloy chamber and radiation-cooled nozzle', mass: 4.5, temp: 270, explode: [0, 0, -2.3],
    desc: `The 100-lbf-class bipropellant engine (hydrazine burned with nitrogen tetroxide) that lifts GPS III from its transfer orbit to 20,180 km in a series of apogee burns. The A2100's apogee engine is the LEROS 1c (${GPS3.laeThrust} N, Isp ${GPS3.laeIsp} s, niobium-alloy chamber); that GPS III flies the same engine is likely but unconfirmed, so its figures are used here. The nozzle reaches about 0.2 m below the separation ring.`,
    callout: true, anchor: [0.135, 0, LAE_TOP - 0.74],
  }, [mesh(bell, G.nozzle()), mesh(head, G.gunmetal())]);
  lae.userData.part.thermalRole = 'engine';
  const mnt = [cylG([0, 0, LAE_TOP + 0.005], 0.1, 0.02, 'z', 28)];
  for (const sx of [1, -1]) for (const sy of [1, -1]) mnt.push(rodG([sx * 0.07, sy * 0.07, LAE_TOP + 0.01], [sx * (CORE - 0.06), sy * (CORE - 0.06), -HZ + 0.04], 0.014, 8), boxG([sx * (CORE - 0.06), sy * (CORE - 0.06), -HZ + 0.04], [0.06, 0.06, 0.04]));
  P('Engine mount', {
    system: 'Propulsion', material: 'Titanium struts and mounting ring', mass: 3, count: 4, temp: 280, explode: [0, 0, -1.9],
    desc: 'Four struts from the core\'s bottom corners hold the engine on the spacecraft axis, so its thrust passes close to the centre of mass; the ring isolates the hot engine from the structure (form estimated).',
  }, mesh(merge(mnt), G.satinTi()));
  P('Engine bipropellant valve', {
    system: 'Propulsion', material: 'Torque-motor valves on the injector head', mass: 1.2, temp: 280, explode: [0, 0, -2.1],
    desc: 'Twin valves that open fuel and oxidiser to the injector together, so the hypergolic propellants meet only in the chamber. Each apogee burn lasts many minutes; the valves open and close for every one (form estimated).',
  }, mesh(merge([boxG([0.085, 0, LAE_TOP - 0.03], [0.06, 0.05, 0.05]), boxG([-0.085, 0, LAE_TOP - 0.03], [0.06, 0.05, 0.05]), boxG([0, 0.075, LAE_TOP - 0.02], [0.05, 0.03, 0.04])]), G.gunmetal()));
  const shield = merge([new THREE.RingGeometry(0.1, 0.36, 48).translate(0, 0, LAE_TOP - 0.1), cylG([0, 0, LAE_TOP - 0.16], 0.1, 0.12, 'z', 32, 0.16, true)]);
  P('Engine heat shield', {
    system: 'Thermal control', material: 'Polished molybdenum / titanium radiation shield', mass: 3, temp: 320, explode: [0, 0, -2.05],
    desc: 'The nozzle glows above 1,000 °C during a burn and is cooled only by radiating. This shield reflects that heat away from the core foot, the adapter and the propellant lines.',
  }, mesh(shield, G.silverBox()));

  // ------------------------------------------------------------------ tanks
  const fuelMounts = [cylG(FUEL.c, FUEL.r + 0.012, 0.05, 'z', 56), cylG([0, 0, fuelTop + 0.01], 0.06, 0.04, 'z', 16), cylG([0, 0, fuelBot - 0.01], 0.06, 0.04, 'z', 16)];
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; fuelMounts.push(rodG([Math.cos(a) * (FUEL.r + 0.012), Math.sin(a) * (FUEL.r + 0.012), FUEL.c[2]], [Math.sign(Math.cos(a)) * (CORE - 0.035), Math.sign(Math.sin(a)) * (CORE - 0.035), FUEL.c[2] + (k % 2 ? 0.25 : -0.25)], 0.012, 8)); }
  P('Fuel tank (hydrazine)', {
    system: 'Fuel', material: 'Titanium liner with carbon-fibre overwrap (ATK), propellant-management device', mass: 42, temp: 293, explode: [0, 0, 0.55],
    desc: `The A2100's one central hydrazine tank, 0.90 m across and about 2.0 m long, standing on the core axis and filling most of its height. It holds about ${GPS3.fuelLoad} kg (estimate) for both the apogee engine and every thruster; surface-tension vanes inside keep liquid over the outlet in weightlessness. ATK supplied the GPS III propellant tank set.`,
  }, [mesh(capsuleG(FUEL.c, FUEL.r, FUEL.L, 'z', 56, 16), G.tank()), mesh(merge(fuelMounts), G.satinTi())]);
  for (const s of [1, -1]) {
    const tag = s > 0 ? '+X' : '−X', c = [s * OX.x, 0, OX.z];
    const m = [cylG([c[0], 0, OX.z + 0.25], OX.r + 0.01, 0.04, 'z', 40), cylG([c[0], 0, OX.z - 0.35], OX.r + 0.01, 0.04, 'z', 40), cylG([c[0], 0, oxTop + 0.008], 0.035, 0.03, 'z', 14), cylG([c[0], 0, oxBot - 0.008], 0.035, 0.03, 'z', 14)];
    for (const z of [OX.z + 0.25, OX.z - 0.35]) for (const sy of [1, -1]) m.push(rodG([c[0], sy * (OX.r + 0.01), z], [c[0] - s * 0.12, sy * 0.46, z], 0.011, 8), rodG([c[0] - s * (OX.r + 0.01), 0, z], [s * (CORE + 0.01), sy * 0.12, z], 0.011, 8));
    P(`Oxidiser tank (${tag})`, {
      system: 'Fuel', material: 'Titanium liner with carbon-fibre overwrap (ATK), gold MLI wrap', mass: 17, temp: 293, explode: [s * 0.95, 0, -0.2],
      desc: s > 0
        ? 'One of the two flanking nitrogen tetroxide tanks of the A2100, about 0.54 m across and 1.5 m long, standing in the +X bay outside the core (Lockheed\'s "Oxidizer Tank (2)"; the scale model shows it gold-wrapped behind the blanket). The pair hold about 620 kg (estimate; 627 kg is the A2100 maximum), used only by the apogee engine.'
        : `The second oxidiser tank, in the −X bay, balancing its twin across the core. Hydrazine and NTO ignite on contact (hypergolic), so the engine needs no igniter and restarts reliably for every apogee burn.`,
    }, [mesh(capsuleG(c, OX.r, OX.L, 'z', 40, 12), G.goldMLI()), mesh(merge(m), G.satinTi())]);
  }
  for (const s of [1, -1]) {
    const tag = s > 0 ? '+X' : '−X', c = [s * HE.x, 0, HE.z];
    const straps = [cylG(c, HE.r + 0.006, 0.03, 'z', 32), cylG([c[0], 0, c[2] + HE.r], 0.03, 0.03, 'z', 12), cylG([c[0], 0, c[2] - HE.r], 0.03, 0.03, 'z', 12)];
    for (const sy of [1, -1]) straps.push(rodG([c[0], sy * (HE.r + 0.006), c[2]], [c[0] - s * 0.05, sy * 0.46, c[2]], 0.012, 8));
    straps.push(rodG([c[0] - s * (HE.r + 0.006), 0, c[2]], [s * (CORE + 0.01), 0, c[2]], 0.012, 8));
    P(`Helium tank (${tag})`, {
      system: 'Fuel', material: 'Carbon-overwrapped titanium-lined pressure vessel', mass: 12, temp: 293, explode: [s * 0.95, 0, 0.45],
      desc: s > 0
        ? 'One of two helium pressurant tanks, about 58 L each at around 300 bar (estimates), here in the upper part of the +X bay above the oxidiser tank (position estimated). Together they hold enough gas to push the whole propellant load, about 1.3 m³ (900 kg of hydrazine ≈ 0.90 m³ plus 620 kg of nitrogen tetroxide ≈ 0.43 m³), out of the three tanks.'
        : 'The second helium tank, in the −X bay above the other oxidiser tank, under the pressurant control panel. Tank count, size and position are estimates.',
    }, [mesh(new THREE.SphereGeometry(HE.r, 32, 20).translate(...c), G.copv()), mesh(merge(straps), G.aluminium())]);
  }

  // ------------------------------------------------------------------ pressurant control panel (on the −X core wall, above the −X bay)
  const px = -CORE - 0.016, cx = -CORE - 0.055, PZ = 1.33;
  P('Pressurant control panel', {
    system: 'Fuel', material: 'Aluminium mounting plate', mass: 3, temp: 290, explode: [-0.65, 0, 0.15],
    desc: 'Carries the helium controls in the order the gas flows through them: isolation valves, regulator, check valves, with pressure transducers at each stage for the ground to watch. Mounted on the core wall above the −X tank bay (position estimated).',
  }, mesh(boxG([px + 0.008, 0, PZ], [0.016, 0.46, 0.44]), G.silverBox()));
  P('Pyrotechnic isolation valves', {
    system: 'Fuel', material: 'Stainless-steel normally-closed pyro valves', mass: 1.2, count: 2, temp: 290, explode: [-0.72, 0, 0.15],
    desc: 'Seal the helium in its tanks from the factory until orbit. A small charge, switched by the pyro relay assembly, fires once to open each valve; it can never close again, so the regulator takes over from then on.',
  }, mesh(merge([cylG([cx, -0.12, PZ + 0.14], 0.022, 0.06, 'z', 14), cylG([cx, 0.12, PZ + 0.14], 0.022, 0.06, 'z', 14), boxG([cx + 0.005, -0.12, PZ + 0.1], [0.03, 0.03, 0.03]), boxG([cx + 0.005, 0.12, PZ + 0.1], [0.03, 0.03, 0.03])]), G.tubing()));
  P('Helium pressure regulator', {
    system: 'Fuel', material: 'Stainless-steel pressure regulator', mass: 1.5, temp: 290, explode: [-0.78, 0, 0.15],
    desc: 'Steps the helium down from around 300 bar to a steady tank pressure (about 18–20 bar, estimate), so the apogee engine burns at a constant mixture ratio as the tanks empty.',
  }, mesh(merge([cylG([cx, 0, PZ], 0.035, 0.14, 'z', 18), cylG([cx, 0, PZ + 0.09], 0.02, 0.04, 'z', 12)]), G.tubing()));
  P('Check valves', {
    system: 'Fuel', material: 'Stainless-steel check valves', mass: 0.6, count: 2, temp: 290, explode: [-0.72, 0, 0.15],
    desc: 'One-way valves after the regulator, one on the fuel branch and one on the oxidiser branch, so fuel and oxidiser vapours can never flow back and meet upstream of the hypergolic apogee engine.',
  }, mesh(merge([cylG([cx, -0.12, PZ - 0.15], 0.018, 0.05, 'z', 12), cylG([cx, 0.12, PZ - 0.15], 0.018, 0.05, 'z', 12)]), G.tubing()));
  P('Pressure transducers', {
    system: 'Fuel', material: 'Strain-gauge transducers', mass: 0.5, count: 3, temp: 290, explode: [-0.78, 0, 0.15],
    desc: 'Read the helium pressure before and after the regulator; tank pressures and temperatures are how the ground estimates the propellant left in orbit (count and position estimated).',
  }, mesh(merge([[-0.19, PZ + 0.06], [0.19, PZ + 0.06], [0.07, PZ - 0.06]].map(([y, z]) => cylG([cx + 0.01, y, z], 0.012, 0.05, 'x', 10))), G.blackBox()));
  reg([cx, 0.2, PZ + 0.2], 'core');

  // ------------------------------------------------------------------ helium lines: both tanks → panel → the tops of all three propellant tanks
  const r = 0.005;
  const heTop = HE.z + HE.r, heBot = HE.z - HE.r;
  P('Helium pressurant lines', {
    system: 'Fuel', material: 'Titanium tubing', mass: 4, temp: 290, explode: [-0.3, 0, 0.2],
    desc: 'Carry helium from the two tanks through the isolation valves, regulator and check valves, then on to the top of the hydrazine tank and the tops of both oxidiser tanks (routing estimated).',
  }, mesh(merge([
    pipeG([[-HE.x, 0, heTop], [-HE.x, 0, heTop + 0.06], [-HE.x, -0.12, heTop + 0.06], [-HE.x, -0.12, 1.6], [cx, -0.12, 1.6], [cx, -0.12, PZ + 0.17]], r),
    pipeG([[HE.x, 0, heTop], [HE.x, 0, 1.645], [cx, 0.12, 1.645], [cx, 0.12, PZ + 0.17]], r),
    pipeG([[cx, -0.12, PZ + 0.11], [cx, -0.12, PZ + 0.1], [cx, 0, PZ + 0.1], [cx, 0, PZ + 0.07]], r),
    pipeG([[cx, 0.12, PZ + 0.11], [cx, 0.12, PZ + 0.1], [cx, 0, PZ + 0.1]], r),
    pipeG([[cx, 0, PZ - 0.07], [cx, 0, PZ - 0.1], [cx, -0.12, PZ - 0.1], [cx, -0.12, PZ - 0.125]], r),
    pipeG([[cx, 0, PZ - 0.1], [cx, 0.12, PZ - 0.1], [cx, 0.12, PZ - 0.125]], r),
    // fuel branch: into the core to the hydrazine tank's top boss
    pipeG([[cx, -0.12, PZ - 0.175], [cx, -0.12, 1.14], [-0.3, -0.06, 1.16], [0, 0, 1.16], [0, 0, fuelTop + 0.03]], r),
    // oxidiser branch: down the −X bay beside the helium tank, and across the core top to the +X bay
    pipeG([[cx, 0.12, PZ - 0.175], [cx, 0.12, 1.12], [-0.6, 0.36, 1.1], [-0.6, 0.36, 0.3], [-OX.x, 0.1, oxTop + 0.06], [-OX.x, 0, oxTop + 0.03]], r),
    pipeG([[cx, 0.12, 1.12], [cx + 0.02, 0.2, 1.12], [-0.42, 0.2, 1.2], [0.6, 0.2, 1.2], [0.6, 0.36, 1.1], [0.6, 0.36, 0.3], [OX.x, 0.1, oxTop + 0.06], [OX.x, 0, oxTop + 0.03]], r),
  ]), G.tubing()));

  // ------------------------------------------------------------------ fuel and oxidiser feed
  const zo = -HZ + 0.085, zm = -HZ + 0.04;   // oxidiser lines and thruster manifold, on the aft deck's inner face
  P('Fuel feed lines', {
    system: 'Fuel', material: 'Titanium tubing', mass: 4, temp: 290, explode: [0.25, 0, -0.35],
    desc: 'Hydrazine leaves the bottom of its tank, passes the filter and the latch valves at the core foot and splits: one branch to the apogee engine valve, one to the thruster manifold. Every line is wrapped with heaters because hydrazine freezes at 2 °C (routing estimated).',
  }, mesh(merge([
    pipeG([[0, 0, fuelBot - 0.03], [0, 0, -1.12], [0.1, 0.15, -1.18], [0.1, 0.15, -1.62], [0.085, 0.05, -1.69], [0.085, 0, LAE_TOP - 0.006]], r),
    pipeG([[0.1, 0.15, -1.3], [0.3, 0.15, -1.3], [0.3, 0.15, zm], [0.3, 0.62, zm]], r),
  ]), G.tubing()));
  P('Oxidiser feed lines', {
    system: 'Fuel', material: 'Titanium tubing', mass: 3, temp: 290, explode: [0, 0, -0.55],
    desc: 'Nitrogen tetroxide leaves the bottom of each flanking tank, runs inboard along the aft deck to a tee in the core foot, passes its latch valve and drops to the engine\'s bipropellant valve. The thrusters never use it (routing estimated).',
  }, mesh(merge([
    pipeG([[OX.x, 0, oxBot - 0.025], [OX.x, 0, zo], [0.4, -0.15, zo], [0, -0.15, zo]], r),
    pipeG([[-OX.x, 0, oxBot - 0.025], [-OX.x, 0, zo], [-0.4, -0.15, zo], [0, -0.15, zo]], r),
    pipeG([[0, -0.15, zo], [-0.085, -0.15, zo], [-0.085, -0.05, -1.69], [-0.085, 0, LAE_TOP - 0.006]], r),
  ]), G.tubing()));
  const loop = [[0.62, 0.62], [-0.62, 0.62], [-0.62, -0.62], [0.62, -0.62], [0.62, 0.62]].map(([x, y]) => [x, y, zm]);
  const man = [pipeG(loop, r)];
  for (const [sx, sy] of CORNERS) {
    const c = CLUSTER(sx, sy);
    man.push(pipeG([[sx * 0.62, c[1], zm], [sx * 1.12, c[1], zm], [sx * 1.12, c[1], AFT - 0.02], [sx * 1.3, c[1], -1.78], [c[0] - sx * 0.04, c[1], c[2] + 0.06]], r));
  }
  P('Thruster manifold', {
    system: 'Fuel', material: 'Titanium tubing', mass: 3, temp: 290, explode: [0, 0, -0.4],
    desc: 'A loop of tubing around the core foot, on the aft deck\'s inner face, that feeds hydrazine out through the deck to all four thruster outriggers, so any cluster can draw from the same tank (routing estimated).',
  }, mesh(merge(man), G.tubing()));
  P('Latch valves & filter', {
    system: 'Fuel', material: 'Latching solenoid valves, etched-disc filter', mass: 2.4, count: 4, temp: 290, explode: [0.4, 0, -0.5],
    desc: 'A filter catches particles before they reach a valve seat; latching valves, which hold open or closed with no power, let the ground isolate the engine fuel branch, the thruster branch or the oxidiser line (count estimated).',
  }, mesh(merge([cylG([0.1, 0.15, -1.22], 0.025, 0.08, 'z', 14), cylG([0.1, 0.15, -1.45], 0.022, 0.05, 'z', 12), cylG([0.3, 0.15, -1.45], 0.022, 0.05, 'z', 12), cylG([-0.04, -0.15, zo], 0.022, 0.05, 'x', 12),
    boxG([0.1, 0.15, -1.45], [0.03, 0.06, 0.03]), boxG([0.3, 0.15, -1.45], [0.03, 0.06, 0.03])]), G.silverBox()));
  reg([0.2, 0.15, -1.45], 'core');
  const FV = -1.02;
  const fdv = (name, y, desc) => P(name, {
    system: 'Fuel', material: 'Stainless-steel service valve with cap', mass: 0.6, temp: 240, explode: [-0.3, 0, -1.9], desc,
  }, mesh(merge([cylG([FV, y, AFT - 0.03], 0.018, 0.06, 'z', 12), cylG([FV, y, AFT - 0.07], 0.024, 0.02, 'z', 6)]), G.silverBox()));
  fdv('Fuel fill-and-drain valve', 0.15, 'Where technicians in protective suits load the hydrazine at the launch site, weeks before launch. Placed outside the adapter at the −X end of the aft deck (position estimated).');
  fdv('Oxidiser fill-and-drain valve', -0.15, 'Loading port for the nitrogen tetroxide, which reaches both oxidiser tanks through the tee. Fuel and oxidiser are loaded on different days so a spill of one can never meet the other (position estimated).');
  fdv('Helium fill valve', 0.0, 'Charging port for the helium, loaded last, after the propellants (position estimated).');
  P('Fill lines', {
    system: 'Fuel', material: 'Titanium tubing', mass: 0.8, count: 3, temp: 290, explode: [-0.3, 0, -0.7],
    desc: 'Run from the three service valves into the bus: the fuel line joins the hydrazine feed, the oxidiser line the NTO tee, and the helium line climbs the −X bay, clear of the oxidiser tank, to the −X helium tank; the +X tank fills through the manifold (routing estimated).',
  }, mesh(merge([
    pipeG([[FV, 0.15, AFT], [FV, 0.15, zo + 0.02], [0.1, 0.15, zo + 0.02]], r),
    pipeG([[FV, -0.15, AFT], [FV, -0.15, zo - 0.012], [-0.4, -0.15, zo - 0.012]], r),
    pipeG([[FV, 0, AFT], [FV, 0, zo + 0.04], [FV, 0.36, zo + 0.04], [FV, 0.36, 0.4], [-HE.x, 0.1, heBot - 0.06], [-HE.x, 0, heBot - 0.02]], r),
  ]), G.tubing()));

  // ------------------------------------------------------------------ thruster outriggers and thrusters (four aft corners)
  for (const [sx, sy] of CORNERS) {
    const tag = `${sx > 0 ? '+X' : '−X'}${sy > 0 ? '+Y' : '−Y'}`;
    const c = CLUSTER(sx, sy);
    // two perforated side plates (x–z plane) joined by a top plate, an end plate and a root fitting
    const side = [];
    const holes = [[1.31, -1.77], [1.41, -1.79], [1.5, -1.81], [1.36, -1.86], [1.46, -1.88]].map(([u, v]) => { const h = new THREE.Path(); h.absarc(sx * u, v, 0.022, 0, Math.PI * 2, true); return h; });
    const outline = [[1.2, -1.69], [1.6, -1.73], [1.6, -1.93], [1.24, -1.84]].map(([u, v]) => [sx * u, v]);
    const toXZ = new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -1, 0));
    for (const dy of [-0.1, 0.1]) side.push(plateG(outline, 0.012, -0.006, holes, 7).applyMatrix4(toXZ).translate(0, c[1] + dy, 0));
    side.push(boxG([sx * 1.4, c[1], -1.715], [0.4, 0.22, 0.012]), boxG([sx * 1.6, c[1], -1.83], [0.012, 0.22, 0.2]), boxG([sx * 1.215, c[1], -1.76], [0.03, 0.22, 0.12]));
    P(`Thruster outrigger (${tag})`, {
      system: 'Propulsion', material: 'White-painted perforated aluminium truss bracket', mass: 2.5, temp: 260, explode: [sx * 0.5, sy * 0.25, -1.6],
      desc: 'One of four white lattice brackets at the aft corners that stand the thruster pod about 0.35 m outboard of the ±X faces (scale model), keeping the 0.9 N and 22 N plumes clear of the radiators, the stowed arrays and the blankets (size estimated).',
    }, mesh(merge(side), G.whitePaint()));
    const pod = [boxG([c[0], c[1], c[2] + 0.04], [0.1, 0.14, 0.05])];
    const small = [
      ...thrusterG([c[0] + sx * 0.04, c[1] + 0.04, c[2] + 0.03], [sx, 0, -0.35]),
      ...thrusterG([c[0], c[1] + sy * 0.06, c[2] + 0.03], [0, sy, -0.35]),
      ...thrusterG([c[0] - sx * 0.02, c[1] - sy * 0.04, c[2] + 0.015], [0.2 * sx, 0.2 * sy, -1]),
    ];
    const t = P(`Thruster cluster (${tag})`, {
      system: 'Propulsion', material: 'Catalytic hydrazine thrusters on a titanium valve block', mass: 2.6, count: 3, temp: 270, explode: [sx * 0.7, sy * 0.3, -1.85],
      desc: `Three of the ${GPS3.thrusterSmall} N ("0.2-lbf") hydrazine thrusters, Isp ≈ ${GPS3.rcsIsp} s: hydrazine decomposes over an iridium catalyst into hot gas, with no oxidiser. They control attitude, unload the reaction wheels and make the periodic station-keeping moves (count and layout estimated).`,
    }, [mesh(merge(pod), G.satinTi()), mesh(merge(small), G.nozzle())]);
    t.userData.part.thermalRole = 'thruster';
    const big = P(`22 N thruster (${tag})`, {
      system: 'Propulsion', material: 'Catalytic hydrazine thruster', mass: 0.7, temp: 270, explode: [sx * 0.75, sy * 0.35, -2.0],
      desc: 'One of the "5-lbf" (22 N) hydrazine thrusters for the larger on-orbit manoeuvres, such as moving the satellite to a new slot in its plane or the final move to a disposal orbit above the constellation (count and position estimated).',
    }, mesh(merge(thrusterG([c[0] + sx * 0.03, c[1] - sy * 0.02, c[2] - 0.0], [0, 0, -1], 1.6)), G.nozzle()));
    big.userData.part.thermalRole = 'thruster';
    reg([c[0] - sx * 0.1, c[1], c[2] + 0.1], 'aft');
  }

  // ------------------------------------------------------------------ heaters
  const heaters = [
    cylG([0, 0, FUEL.c[2] + 0.3], FUEL.r + 0.004, 0.06, 'z', 56, FUEL.r + 0.004, true),
    cylG([0, 0, FUEL.c[2] - 0.3], FUEL.r + 0.004, 0.06, 'z', 56, FUEL.r + 0.004, true),
    cylG([OX.x, 0, OX.z], OX.r + 0.004, 0.05, 'z', 40, OX.r + 0.004, true),
    cylG([-OX.x, 0, OX.z], OX.r + 0.004, 0.05, 'z', 40, OX.r + 0.004, true),
    cylG([0, 0, LAE_TOP - 0.03], 0.079, 0.03, 'z', 28, 0.079, true),
  ];
  P('Propulsion heaters & thermostats', {
    system: 'Thermal control', material: 'Kapton film heaters, bimetallic thermostats', mass: 6, temp: 300, explode: [0, 0, 0.25],
    desc: 'Film heaters on the three tanks, the engine valves and every propellant line keep the hydrazine liquid (it freezes at 2 °C); thermostats and the flight software switch them as each part cools in shadow.',
  }, mesh(merge(heaters), G.heater()));
}

export { HX, IZ, ADAPTER };
