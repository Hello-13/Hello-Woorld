// UH-60M power and drive: two GE T700-GE-701D turboshafts (modules, inlet particle separators and
// their blowers, line-replaceable sensors and valves, upturned exhausts), the five-module main
// transmission (two input modules with their bevel sets and ramp-roller freewheels, the main module
// with its combining bevel and planetary stages and its lubrication system, two accessory modules),
// engine output shafts and forward supports, rotor brake and gust lock, oil cooler, the six-section
// tail drive shaft with its disc couplings and hanger bearings, the APU, the pneumatic start system
// and the engine fire detection and extinguishing systems.
// Gear data: NASA TP-2626 (Mitchell, Oswald & Coe 1986) Table I; see ./gears.js.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { lathe, loftRings, orientOutward } from '../../engine/geometry.js';
import { MAT, DEG, V3, merge, box, cyl, tube, pipe, place, TAIL } from './common.js';
import { GEARS, SPEEDS, ratio } from './gears.js';
import { aftDeckPoint } from './tail.js';

const ENG = { y: 2.58, z: 0.76, front: -0.5, rear: -1.67 };   // inlet face and exhaust flange: 1.17 m
const rpm = (x) => Math.round(x).toLocaleString('en-US');

/** Lathe a profile [[r, s], …] (s along the axis, front at the largest s) and lay it along +x. */
function latheX(profile, seg = 32) {
  const g = lathe(profile, seg);
  g.rotateZ(-Math.PI / 2);   // +y → +x
  return g;
}

/** Open loft of superellipse sections centred on a path (ducts, cowlings). */
function duct(stations, n = 28) {
  // stations: [{ c: [x,y,z], w, h, e }] ordered aft → forward so the normals face outward
  const rings = stations.map(({ c, w, h, e = 2 }) => {
    const pts = [];
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2;
      const cs = Math.cos(a), sn = Math.sin(a);
      pts.push([c[0], c[1] + h * Math.sign(sn) * Math.abs(sn) ** (2 / e), c[2] + w * Math.sign(cs) * Math.abs(cs) ** (2 / e)]);
    }
    return pts;
  });
  return loftRings(rings, { uvMode: 'metric' });
}

/**
 * Duct bending in a vertical plane: superellipse sections perpendicular to a curve through `pts`,
 * half-width w (lateral, along z) and half-depth h (in the bend plane) interpolated along it.
 */
function bentDuct(pts, w0, w1, h0, h1, e0 = 2, e1 = 4, n = 28, m = 14) {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const side = V3(0, 0, 1);
  const rings = [];
  for (let i = 0; i <= m; i++) {
    const t = i / m, c = curve.getPoint(t), T = curve.getTangent(t);
    const N = side.clone().cross(T).normalize();
    const w = w0 + (w1 - w0) * t, h = h0 + (h1 - h0) * t, e = e0 + (e1 - e0) * t;
    const ring = [];
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a);
      const u = w * Math.sign(cs) * Math.abs(cs) ** (2 / e), v = h * Math.sign(sn) * Math.abs(sn) ** (2 / e);
      ring.push([c.x + N.x * v, c.y + N.y * v, c.z + u]);
    }
    rings.push(ring);
  }
  return { g: loftRings(rings, { uvMode: 'metric' }), curve };
}

/** Flexible multiple-disc coupling at p, its axis along dir: two flanges round a pack of thin discs. */
function discCoupling(p, dir, r = 0.065, len = 0.05) {
  const d = dir.clone().normalize(), out = [];
  out.push(tube(p.clone().addScaledVector(d, -len / 2), p.clone().addScaledVector(d, -len / 2 + 0.012), r, 16));
  out.push(tube(p.clone().addScaledVector(d, len / 2 - 0.012), p.clone().addScaledVector(d, len / 2), r, 16));
  for (let k = 0; k < 4; k++) { const s = -len / 2 + 0.016 + k * ((len - 0.032) / 3); out.push(tube(p.clone().addScaledVector(d, s - 0.002), p.clone().addScaledVector(d, s + 0.002), r * 0.92, 16)); }
  return out;
}

/** Spur/bevel gear wheel: a disc with a row of teeth, axis along 'x' | 'y' | 'z'. */
function gearWheel(r, w, teeth, at, axis = 'y', seg = 32) {
  const g = [cyl(r * 0.92, r * 0.92, w, [0, 0, 0], 'y', seg)];
  const n = Math.min(teeth, 48);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    g.push(box(Math.min(0.03, (2 * Math.PI * r) / n * 0.5), w, r * 0.12, [r * 0.98 * Math.cos(a), 0, r * 0.98 * Math.sin(a)], [0, -a + Math.PI / 2, 0]));
  }
  const m = merge(g);
  if (axis === 'x') m.rotateZ(-Math.PI / 2);
  else if (axis === 'z') m.rotateX(Math.PI / 2);
  return m.translate(...at);
}

export function buildDrive({ A, P, roofY }) {
  // ------------------------------------------------------------------ main transmission
  // The main module (the M's improved-durability gearbox): a magnesium housing around the
  // combining spiral-bevel stage and the planetary stage, with its own lubrication system.
  const cx = -0.04;   // shaft axis at transmission height (the shaft leans 3° forward)
  // Each input module's output: the 80-tooth input gear (centred on the engine-shaft line, where the
  // input pinion's axis crosses it), the freewheel in its hub and the 17-tooth combining pinion all
  // sit on one shaft, which slopes down and inboard to cross the main bevel gear's axis — the apex of
  // the combining bevel set.
  const inAxis = (s) => { const G = V3(0.16, 2.52, 0.5 * s); return { G, d: V3(cx, 2.45, 0).sub(G).normalize() }; };
  const onAxis = (g, s, k) => { const { G, d } = inAxis(s); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), d)); const c = G.clone().addScaledVector(d, k); return g.translate(c.x, c.y, c.z); };
  const caseG = [
    place(lathe([[0.001, 0], [0.38, 0], [0.44, 0.1], [0.44, 0.24], [0.4, 0.34], [0.29, 0.42], [0.22, 0.46], [0.2, 0.49], [0.001, 0.49]], 36), [cx, 2.24, 0]),   // flat top cover at 2.73 carries the swashplate guide
    box(0.82, 0.12, 0.74, [cx, 2.25, 0]),                           // sump
    cyl(0.11, 0.11, 0.3, [cx - 0.5, 2.45, 0], 'x', 20),            // tail take-off housing
  ];
  for (let k = 0; k < 12; k++) {                                     // case ribs (none under the input and transfer modules)
    if ([2, 3, 4, 8, 9, 10].includes(k)) continue;
    const a = (k / 12) * Math.PI * 2;
    caseG.push(box(0.03, 0.26, 0.06, [cx + 0.44 * Math.cos(a), 2.4, 0.44 * Math.sin(a)], [0, -a, 0]));
  }
  const overall = ratio(), tailRpm = SPEEDS.tailOutput;
  P('Main module (main transmission)', {
    system: 'Drive system', material: 'Magnesium-alloy housing, steel bearing liners', mass: 230, explode: [0, 0.3, 0], xrayWeight: 0.45,
    desc: `The main gearbox: its magnesium housing holds the second and third of the transmission's three reduction stages — a ${GEARS.combPinion}:${GEARS.mainBevelLower} spiral-bevel combining stage and a planetary stage — so with the input modules the reduction is ${overall.toFixed(2)} : 1, from ${rpm(SPEEDS.input)} rpm at the engines to ${rpm(SPEEDS.rotor)} rpm at the rotor shaft. A 3° forward tilt is built in. The UH-60A's five-module transmission weighs 565 kg in flight configuration (NASA TP-2626); the M's improved-durability gearbox is rated at 3,400 shp.`,
    callout: true, anchor: [cx + 0.405, 2.47, 0.17],
  }, [mesh(merge(caseG), MAT.casting())]);
  // combining stage: one bull gear driven by a 17-tooth pinion from each input module (lower face, 81
  // teeth); its upper face (116 teeth) drives the 34-tooth tail take-off pinion
  const bevel = [cyl(0.36, 0.33, 0.07, [cx, 2.38, 0], 'y', 40), cyl(0.12, 0.12, 0.14, [cx, 2.33, 0], 'y', 20)];
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2;
    bevel.push(box(0.035, 0.05, 0.02, [cx + 0.35 * Math.cos(a), 2.42, 0.35 * Math.sin(a)], [0, -a, 0]));
  }
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    bevel.push(box(0.03, 0.025, 0.016, [cx + 0.29 * Math.cos(a), 2.428, 0.29 * Math.sin(a)], [0, -a, 0]));
  }
  // combining pinions on the input-module output shafts, narrow end toward the apex
  for (const sd of [1, -1]) bevel.push(onAxis(new THREE.CylinderGeometry(0.055, 0.09, 0.14, 18), sd, 0.18));
  bevel.push(place(new THREE.CylinderGeometry(0.045, 0.07, 0.1, 16), [cx - 0.33, 2.47, 0], [0, 0, Math.PI / 2]));   // tail take-off pinion
  P('Main bevel gear & combining pinions', {
    system: 'Drive system', material: 'Carburised steel spiral-bevel gears', mass: 105, explode: [1.05, 0.4, 0], xrayWeight: 0.45,
    desc: `The second stage. Each engine's ${GEARS.combPinion}-tooth combining pinion (${rpm(SPEEDS.inputGear)} rpm) meshes with the ${GEARS.mainBevelLower}-tooth lower face of one large spiral-bevel gear, which turns at ${rpm(SPEEDS.mainBevel)} rpm (${ratio('comb').toFixed(2)} : 1) and so combines both engines on one vertical shaft. Its upper ${GEARS.mainBevelUpper}-tooth face drives the ${GEARS.tailPinion}-tooth tail take-off pinion at ${rpm(tailRpm)} rpm. If one engine stops, its freewheel lets the other drive the gear alone.`,
  }, [mesh(merge(bevel), MAT.steel())]);
  // planetary: pitch radii in the ratio of the tooth counts (sun 62, planets 83, ring 228)
  const sunR = 0.08, plR = (sunR * GEARS.planet) / GEARS.sun, ringR = (sunR * GEARS.ring) / GEARS.sun;
  const planet = [cyl(ringR + 0.025, ringR + 0.025, 0.09, [cx, 2.62, 0], 'y', 40, true), cyl(ringR, ringR, 0.09, [cx, 2.62, 0], 'y', 40, true),
    gearWheel(sunR, 0.1, 31, [cx, 2.62, 0], 'y', 20), cyl(0.27, 0.27, 0.03, [cx, 2.685, 0], 'y', 36), gearWheel(0.24, 0.025, 48, [cx, 2.56, 0], 'y', 36)];
  for (let k = 0; k < GEARS.planets; k++) {
    const a = (k / GEARS.planets) * Math.PI * 2;
    planet.push(gearWheel(plR, 0.08, 32, [cx + (sunR + plR) * Math.cos(a), 2.62, (sunR + plR) * Math.sin(a)], 'y', 20), cyl(0.025, 0.025, 0.12, [cx + (sunR + plR) * Math.cos(a), 2.64, (sunR + plR) * Math.sin(a)], 'y', 10));
  }
  P('Planetary reduction stage', {
    system: 'Drive system', material: 'Steel sun gear, five planet gears, fixed ring gear and planet carrier', mass: 95, explode: [-1.05, 0.75, 0], xrayWeight: 0.45,
    desc: `The third and final stage: the bevel-gear shaft turns a ${GEARS.sun}-tooth sun gear; five ${GEARS.planet}-tooth planets roll round a fixed ${GEARS.ring}-tooth ring gear, and their carrier, splined to the rotor shaft, turns at ${rpm(SPEEDS.rotor)} rpm (${ratio('planetary').toFixed(2)} : 1). Splitting the torque five ways keeps the gears small enough to fit under the rotor. A ${GEARS.oilGear}-tooth gear on the carrier drives the two oil pumps.`,
  }, [mesh(merge(planet), MAT.steel())]);

  // ------------------------------------------------------------------ main transmission lubrication
  const pumps = [];
  for (const z of [0.1, -0.1]) pumps.push(cyl(0.05, 0.05, 0.11, [cx + 0.24, 2.245, z], 'y', 14), gearWheel(0.024, 0.02, 12, [cx + 0.24, 2.31, z], 'y', 10), box(0.06, 0.04, 0.06, [cx + 0.3, 2.22, z]));
  P('Main transmission oil pumps', {
    system: 'Drive system', material: 'Two combination pressure-and-scavenge pumps in the sump', mass: 6, count: 2, explode: [0.9, -0.15, 0],
    desc: `Two pumps run in parallel in the wet sump, each a pressure and scavenge pump in one, driven by ${GEARS.oilPinion}-tooth pinions off the ${GEARS.oilGear}-tooth gear on the planet carrier (${rpm(SPEEDS.oilPump)} rpm). They feed cooled, filtered oil to every gear and bearing through passages cored into the housings; regulating and bypass valves return any excess to the pump inlet. The gearbox can run 30 minutes at cruise with all its oil lost.`,
  }, [mesh(merge(pumps), MAT.casting())]);
  P('Main transmission oil filter', {
    system: 'Drive system', material: 'Two-stage filter with impending-bypass button', mass: 3, explode: [0.1, 0.35, -1.0],
    desc: 'A two-stage oil filter on the left side of the main module. When its first stage clogs, a red button pops out so the crew sees it on the walk-round; a thermal lockout stops it popping when the oil is cold and thick. Strainers in the sump catch the rest.',
  }, [mesh(merge([cyl(0.05, 0.05, 0.16, [cx - 0.125, 2.33, -0.5], 'y', 16), cyl(0.055, 0.055, 0.03, [cx - 0.125, 2.425, -0.5], 'y', 16), box(0.08, 0.06, 0.09, [cx - 0.125, 2.38, -0.44])]), MAT.casting()),
    mesh(cyl(0.012, 0.012, 0.02, [cx - 0.125, 2.45, -0.5], 'y', 8), MAT.red())]);
  const cl = [];
  for (const z of [0.12, -0.12]) cl.push(pipe([[cx - 0.4, 2.3, z * 1.6], [cx - 0.62, 2.32, z * 1.5], [-0.98, 2.36, z * 1.4], [-1.12, 2.38, z * 1.25]], 0.0125, 6));
  P('Oil cooler lines & thermostatic valve', {
    system: 'Drive system', material: 'Steel pressure and return lines, thermostatic bypass valve', mass: 3, explode: [-0.6, 0.85, 0.5],
    desc: 'The only external oil lines on the main transmission: pressure out to the cooler and return back to the module. A thermostatic valve sends the oil round the cooler instead of through it while the oil is below about 71 °C, so the gearbox warms up quickly.',
  }, [mesh(merge(cl), MAT.hydraulic()), mesh(merge([box(0.09, 0.08, 0.1, [cx - 0.46, 2.3, 0.19]), cyl(0.025, 0.025, 0.04, [cx - 0.46, 2.355, 0.19], 'y', 10)]), MAT.casting())]);
  const chips = [];
  for (const s of [1, -1]) chips.push(cyl(0.02, 0.02, 0.06, [0.16, 2.37, 0.52 * s], 'y', 10), cyl(0.02, 0.02, 0.06, [0.43, 2.52, 0.64 * s], 'z', 10));
  chips.push(cyl(0.022, 0.022, 0.06, [cx + 0.05, 2.17, -0.22], 'y', 10));
  P('Transmission chip detectors', {
    system: 'Drive system', material: 'Magnetic plugs with fuzz burn-off and self-sealing valves', mass: 1, count: 5, explode: [0.6, -0.3, 0.9],
    desc: 'Five magnetic chip detectors — both input modules, both accessory modules and the main sump — catch ferrous debris and light a caution naming the module, early warning of a failing gear or bearing. A fuzz burn-off pulse burns away tiny particles so they do not cause false warnings, and each plug self-seals so it can be pulled for inspection without losing oil.',
  }, [mesh(merge(chips), MAT.yellow())]);
  P('Transmission oil pressure & temperature switches', {
    system: 'Drive system', material: 'Pressure switch, temperature switch', mass: 0.5, count: 2, explode: [0.4, 0.9, -0.8],
    desc: 'The oil-pressure switch sits on the left accessory module because it is the farthest point from the pumps: if pressure there drops to 14 ± 2 psi the MAIN XMSN OIL PRESS caution comes on (normal continuous pressure is 30–65 psi). The temperature sensor at the oil-cooler inlet to the main module, near the tail take-off flange, lights MAIN XMSN OIL TEMP at 120 °C.',
  }, [mesh(merge([cyl(0.02, 0.02, 0.07, [0.5, 2.66, -0.5], 'y', 10), cyl(0.018, 0.018, 0.06, [cx - 0.56, 2.36, 0.14], 'y', 10)]), MAT.yellow())]);

  // ------------------------------------------------------------------ input and accessory modules
  for (const side of [1, -1]) {
    const s = side, R = s > 0 ? '(right)' : '(left)';
    const g = [
      cyl(0.13, 0.13, 0.3, [0.16, 2.52, 0.5 * s], 'x', 22),
      onAxis(cyl(0.11, 0.11, 0.12, [0, 0, 0], 'y', 18), s, 0.06), onAxis(cyl(0.13, 0.13, 0.015, [0, 0, 0], 'y', 22), s, 0.115),   // output housing and its flange on the main-module case
      cyl(0.085, 0.11, 0.08, [-0.03, 2.52, 0.5 * s], 'x', 18),
      cyl(0.13, 0.13, 0.025, [-0.065, 2.52, 0.5 * s], 'x', 22),                // flange that carries the engine's forward support
    ];
    P(`Input module ${R}`, {
      system: 'Drive system', material: 'Magnesium-alloy case', mass: 46, explode: [0.3, 0.6, 1.0 * s], xrayWeight: 0.6,
      desc: `Mounted on the ${s > 0 ? 'right' : 'left'} front of the main module, it supports the front of its engine and makes the first gear reduction, ${GEARS.inputPinion}:${GEARS.inputGear} (${ratio('input').toFixed(2)} : 1), turning the drive inboard toward the main module. It houses the input bevel set and the freewheel unit.`,
    }, [mesh(merge(g), MAT.casting())]);
    P(`Input bevel gears ${R}`, {
      system: 'Drive system', material: 'Carburised steel spiral-bevel pinion and gear', mass: 8, explode: [0.35, 1.0, 1.35 * s],
      desc: `A ${GEARS.inputPinion}-tooth spiral-bevel pinion on the engine shaft (${rpm(SPEEDS.input)} rpm) drives an ${GEARS.inputGear}-tooth gear at ${rpm(SPEEDS.inputGear)} rpm. That gear's shaft drives the accessory module forward and the combining pinion inboard.`,
    }, [mesh(merge([place(new THREE.CylinderGeometry(0.03, 0.045, 0.08, 16), [0.02, 2.52, 0.56 * s], [0, 0, -Math.PI / 2]), cyl(0.02, 0.02, 0.1, [-0.04, 2.52, 0.56 * s], 'x', 10),
      onAxis(gearWheel(0.125, 0.035, 48, [0, 0, 0], 'y', 28), s, 0), onAxis(cyl(0.03, 0.03, 0.17, [0, 0, 0], 'y', 12), s, 0.055)]), MAT.steel())]);   // gear and its output shaft to the combining pinion
    // ramp-roller clutch in the input gear's hub: outer race, inner cam, twelve rollers
    const fw = [cyl(0.075, 0.075, 0.1, [0, 0, 0], 'y', 24, true), cyl(0.048, 0.048, 0.1, [0, 0, 0], 'y', 16)];
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; fw.push(cyl(0.011, 0.011, 0.085, [0.061 * Math.cos(a), 0, 0.061 * Math.sin(a)], 'y', 6)); }
    fw.forEach((g) => onAxis(g, s, 0.03));
    P(`Freewheel unit ${R}`, {
      system: 'Drive system', material: 'Steel ramp-roller overrunning clutch', mass: 5, explode: [0.0, 1.0, 1.6 * s],
      desc: 'A ramp-roller overrunning clutch built into the input gear: rollers wedge between ramps on the inner cam and the outer race to drive, and roll free whenever the rotor turns faster than the engine. It is heavier than a sprag clutch but cannot fail by sprag "rollover". It lets a failed engine drop out — or both, in autorotation — while the rotor keeps driving this side\'s accessory module.',
    }, [mesh(merge(fw), MAT.steel())]);
    P(`Accessory module ${R}`, {
      system: 'Drive system', material: 'Aluminium gearbox', mass: 36, explode: [1.0, 0.6, 1.0 * s],
      desc: `Bolted to the forward section of the input module and driven whenever the rotor turns, it carries a generator and a hydraulic pump package — so electrical and hydraulic power continue even with both engines out in autorotation.${s > 0 ? ' A rotor-speed sensor on this module feeds the rotor rpm display.' : ' The transmission\'s oil-pressure switch sits on this module, the farthest point from the pumps.'}`,
    }, [mesh(merge([cyl(0.11, 0.11, 0.24, [0.43, 2.52, 0.5 * s], 'x', 20), box(0.2, 0.18, 0.17, [0.4, 2.47, 0.5 * s])]), MAT.casting())]);
  }
  P('Rotor speed sensor', {
    system: 'Drive system', material: 'Magnetic speed pickup on the right accessory module', mass: 0.5, explode: [0.9, 0.9, 1.3],
    desc: 'Counts gear teeth passing in the right accessory module and so measures rotor speed for the cockpit rotor-rpm display; on the L and M a second sensor on the left module also feeds the engine controls for better droop response.',
  }, [mesh(merge([cyl(0.02, 0.02, 0.08, [0.52, 2.65, 0.5], 'y', 10), cyl(0.026, 0.026, 0.02, [0.52, 2.69, 0.5], 'y', 10)]), MAT.yellow())]);
  const gco = [];
  for (const s of [1, -1]) gco.push(pipe([[0.48, 2.61, 0.58 * s], [0.58, 2.64, 0.6 * s], [0.68, 2.63, 0.58 * s]], 0.0075, 5), pipe([[0.48, 2.42, 0.6 * s], [0.6, 2.41, 0.6 * s], [0.7, 2.43, 0.58 * s]], 0.0075, 5));
  P('Generator cooling-oil lines', {
    system: 'Drive system', material: 'Steel oil lines', mass: 0.5, count: 2, explode: [1.3, 0.9, 0],
    desc: 'The AC generators are oil-cooled: transmission oil flows from each accessory module through its generator and back.',
  }, [mesh(merge(gco), MAT.hydraulic())]);

  // engine output (high-speed) shafts with Thomas disc couplings, inside the forward engine supports
  for (const side of [1, -1]) {
    const R = side > 0 ? '(right)' : '(left)';
    const a = V3(ENG.front + 0.02, ENG.y, ENG.z * side), b = V3(-0.07, 2.52, 0.5 * side);
    const dir = b.clone().sub(a).normalize();
    P(`Engine output shaft ${R}`, {
      system: 'Drive system', material: 'Steel shaft with Thomas-type flexible disc couplings', mass: 7, explode: [0.6, 0.95, 1.25 * side],
      desc: `Runs from the front of the engine, out through the centre of its inlet, to the input module at ${rpm(SPEEDS.input)} rpm. Thomas-type flexible disc couplings at each end take up misalignment as engine and gearbox move; a disc pack fails progressively and visibly rather than suddenly.`,
    }, [mesh(merge([tube(a, b, 0.035, 12), ...discCoupling(a.clone().addScaledVector(dir, 0.24), dir, 0.062), ...discCoupling(b.clone().addScaledVector(dir, -0.05), dir, 0.062)]), MAT.steel())]);
    const s0 = a.clone().addScaledVector(dir, 0.22), s1 = b.clone().addScaledVector(dir, -0.02);
    P(`Forward engine support ${R}`, {
      system: 'Propulsion', material: 'Tubular steel support housing with end flanges', mass: 6, explode: [0.55, 1.3, 1.4 * side], xrayWeight: 0.6,
      desc: 'The input modules carry the front of the engines: this tube bolts the engine\'s front frame to the input-module flange and encloses the output shaft, so engine and gearbox stay aligned as one unit. The rear of the engine hangs on tubular links from the deck.',
    }, [mesh(merge([tube(s0, s1, 0.075, 20), tube(s0.clone().addScaledVector(dir, -0.01), s0.clone().addScaledVector(dir, 0.015), 0.1, 20), tube(s1.clone().addScaledVector(dir, -0.015), s1, 0.105, 20)]), MAT.casting())]);
  }

  // ------------------------------------------------------------------ engines
  // GE T700-GE-701D: 46 in (1.17 m) long, 15.6 in (0.396 m) nominal core diameter, 456 lb (207 kg).
  // Built, like the real engine, from modules: the front frame with its particle separator, the cold
  // section (compressor), the hot section (combustor and gas-generator turbine), the power turbine,
  // and the accessory section on top, plus the fuel control, the DEC and the line-replaceable
  // sensors and valves. The module masses below add up to GE's 207 kg.
  const engines = [];
  const L = ENG.front - ENG.rear;
  for (const side of [1, -1]) {
    const s = side, z = ENG.z * s, R = s > 0 ? '(right)' : '(left)';
    const at = (d) => ENG.front - d;          // x at distance d behind the inlet face
    const ring = (d, r, w = 0.012, seg = 32) => cyl(r, r, w, [at(d), ENG.y, z], 'x', seg);
    const onCase = (d, r, ang) => [at(d), ENG.y + r * Math.sin(ang), z + r * Math.cos(ang) * s];   // ang 0 = outboard, π/2 = top

    // cold section: five axial blisk stages and one centrifugal stage, main frame with integral oil tank
    // stations behind the inlet face: front frame 0–0.30 m, cold 0.30–0.78, hot 0.78–0.98, power turbine 0.98–1.17
    const cold = [latheX([[0.001, 0], [0.18, 0], [0.2, 0.03], [0.2, 0.11], [0.175, 0.16], [0.168, 0.22], [0.162, 0.4], [0.158, 0.48], [0.001, 0.48]], 32).translate(at(0.78), ENG.y, z)];
    for (const d of [0.34, 0.38, 0.42, 0.46, 0.5]) cold.push(ring(d, 0.166, 0.014));
    cold.push(ring(0.72, 0.205, 0.02, 36));
    const coldP = P(`T700 cold section ${R}`, {
      system: 'Propulsion', material: 'Steel and titanium blisks, AM355 steel casing, aluminium main frame', mass: 61, explode: [0.15, 1.1, 1.7 * s],
      desc: 'Five axial stages (one-piece "blisks") and one centrifugal stage raise the pressure about 17 : 1 (approximate) at 44,700 rpm gas-generator speed; the inlet guide vanes and first two stators are variable. The main frame ahead of it holds the engine\'s integral oil tank. The whole engine weighs 207 kg (456 lb, GE).',
      callout: s > 0, anchor: [at(0.5), ENG.y + 0.16, z + 0.12 * s],
    }, [mesh(merge(cold), MAT.darkMetal())]);
    // hot section, part 1: annular combustor with 12 injectors and 2 igniters, air-cooled stage-1 nozzle
    const comb = [latheX([[0.001, 0], [0.18, 0], [0.19, 0.03], [0.205, 0.07], [0.205, 0.12], [0.001, 0.12]], 32).translate(at(0.9), ENG.y, z)];
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      comb.push(cyl(0.012, 0.012, 0.04, [at(0.81), ENG.y + 0.2 * Math.sin(a), z + 0.2 * Math.cos(a)], 'x', 6));
    }
    for (const ang of [-0.6, Math.PI + 0.6]) comb.push(tube(onCase(0.84, 0.2, ang), onCase(0.84, 0.24, ang), 0.013, 8));
    comb.push(ring(0.89, 0.2, 0.014));
    const combP = P(`T700 combustor ${R}`, {
      system: 'Propulsion', material: 'Nickel-alloy annular (ring-type) liner, 12 fuel injectors, 2 igniters, air-cooled stage-1 nozzle', mass: 18, explode: [-0.2, 1.15, 1.75 * s],
      desc: 'The first part of the hot-section module: an annular combustion liner fed by 12 fuel injectors and lit by two igniters, and the air-cooled stage-1 nozzle that turns the gas onto the turbine. The gas leaving it is above 1,200 °C.',
    }, [mesh(merge(comb), MAT.hot())]);
    const ggt = [latheX([[0.001, 0], [0.2, 0], [0.205, 0.04], [0.19, 0.08], [0.001, 0.08]], 32).translate(at(0.98), ENG.y, z), ring(0.92, 0.198, 0.016), ring(0.955, 0.192, 0.016)];
    const ggtP = P(`T700 gas-generator turbine ${R}`, {
      system: 'Propulsion', material: 'Air-cooled single-crystal turbine blades, thermal-barrier coatings', mass: 20, explode: [-0.45, 1.45, 1.75 * s],
      desc: 'A two-stage, air-cooled turbine that drives the compressor ahead of it and, through a radial shaft, the accessory gearbox on top. Cooling air bled from the compressor flows through its blades so they survive gas hotter than their melting point.',
    }, [mesh(merge(ggt), MAT.hot())]);
    // power turbine: two stages, exhaust frame; its shaft runs forward through the core to the front drive
    const ptG = [latheX([[0.001, 0], [0.15, 0], [0.19, 0.03], [0.2, 0.09], [0.19, 0.19], [0.001, 0.19]], 32).translate(ENG.rear, ENG.y, z), ring(L - 0.08, 0.202, 0.014), ring(L - 0.14, 0.2, 0.014)];
    for (let k = 0; k < 6; k++) {                    // exhaust-frame struts
      const a = (k / 6) * Math.PI * 2 + 0.3;
      ptG.push(box(0.12, 0.02, 0.008, [ENG.rear + 0.06, ENG.y + 0.12 * Math.sin(a), z + 0.12 * Math.cos(a)], [a, 0, 0]));
    }
    const ptP = P(`T700 power turbine ${R}`, {
      system: 'Propulsion', material: 'Nickel-alloy discs and tip-shrouded blades, exhaust frame, C-sump', mass: 39, explode: [-0.75, 1.15, 1.85 * s],
      desc: `A two-stage free power turbine, not mechanically tied to the gas generator: its shaft runs forward through the hollow core to the front of the engine and the output shaft, at ${rpm(SPEEDS.input)} rpm at 100 %. The exhaust frame behind it, which carries the C-sump bearing, leads into the upturned exhaust.`,
    }, [mesh(merge(ptG), MAT.hot())]);
    const tgt = [new THREE.TorusGeometry(0.21, 0.007, 6, 40).rotateY(Math.PI / 2).translate(at(0.965), ENG.y, z)];
    for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2 + 0.2; tgt.push(tube(onCase(0.965, 0.205, a), onCase(0.965, 0.235, a), 0.006, 6)); }
    tgt.push(pipe([onCase(0.965, 0.215, Math.PI / 2 + 0.4), onCase(0.8, 0.24, Math.PI / 2 + 0.5), onCase(0.62, 0.25, Math.PI / 2 + 0.5)], 0.007, 5));
    tgt.push(cyl(0.02, 0.02, 0.1, onCase(1.1, 0.22, -Math.PI / 2 + 0.3), 'x', 10), pipe([onCase(1.06, 0.22, -Math.PI / 2 + 0.3), onCase(0.95, 0.235, -Math.PI / 2 + 0.6), onCase(0.66, 0.23, -Math.PI / 2 + 0.7)], 0.006, 5));
    const tgtP = P(`T700 TGT harness & torque sensor ${R}`, {
      system: 'Propulsion', material: 'Chromel-alumel thermocouple harness, torque and overspeed sensor', mass: 1.5, explode: [-0.55, 1.75, 2.0 * s],
      desc: 'A ring of thermocouples at the power-turbine inlet, wired together so their readings average into one turbine gas temperature (TGT) for the cockpit and the DEC. Low on the exhaust frame, the torque and overspeed sensor reads the power-turbine shaft for the torque gauge and the overspeed trip.',
    }, [mesh(merge(tgt), MAT.copper())]);
    // accessory section: top-mounted gearbox with the air-turbine starter, alternator, oil cooler and filter
    const ag = [box(0.42, 0.11, 0.22, [at(0.27), ENG.y + 0.27, z]), cyl(0.07, 0.07, 0.17, [at(0.13), ENG.y + 0.3, z - 0.1 * s], 'x', 16), cyl(0.05, 0.05, 0.1, [at(0.44), ENG.y + 0.3, z + 0.08 * s], 'x', 14), box(0.1, 0.1, 0.07, [at(0.5), ENG.y + 0.24, z - 0.12 * s])];
    const agbP = P(`T700 accessory section ${R}`, {
      system: 'Propulsion', material: 'Aluminium gearbox, air-turbine starter, alternator, oil pump, cooler and filter', mass: 30, explode: [0.3, 1.55, 1.7 * s],
      desc: 'On top of the engine\'s front frame, driven off the gas generator by a radial shaft. It carries the air-turbine starter (spun by bleed air from the APU, the other engine or a ground cart), an alternator that powers the ignition and the DEC, the oil pump, cooler and filter, and the particle separator\'s blower.',
    }, [mesh(merge(ag), MAT.casting())]);
    // hydromechanical unit, engine-driven boost pump and filter, fuel manifold to the injectors
    const fuelLines = [pipe([[at(0.5), ENG.y + 0.2, z + 0.15 * s], [at(0.7), ENG.y + 0.22, z + 0.22 * s], [at(0.88), ENG.y + 0.16, z + 0.2 * s]], 0.011), pipe([[at(0.35), ENG.y + 0.18, z - 0.14 * s], [at(0.7), ENG.y + 0.2, z - 0.2 * s], [at(0.88), ENG.y + 0.14, z - 0.2 * s]], 0.009)];
    const hmuP = P(`T700 fuel control & pump ${R}`, {
      system: 'Propulsion', material: 'Hydromechanical unit (HMU), engine-driven boost pump, fuel filter, copper/steel lines', mass: 14, explode: [0.6, 1.4, 2.1 * s],
      desc: 'The engine-driven boost pump draws fuel by suction from the cell (a cut line sucks air rather than spraying fuel), the barrier filter cleans it and the HMU meters it to the injectors on the DEC\'s commands, with a hydromechanical backup if the electronics fail.',
    }, [mesh(merge([box(0.16, 0.13, 0.12, [at(0.5), ENG.y + 0.18, z + 0.13 * s]), cyl(0.045, 0.045, 0.12, [at(0.36), ENG.y + 0.17, z + 0.17 * s], 'y', 12)]), MAT.casting()), mesh(merge(fuelLines), MAT.copper())]);
    const vlv = [box(0.1, 0.08, 0.08, onCase(0.6, 0.22, Math.PI / 2 + 0.75)), pipe([onCase(0.6, 0.2, Math.PI / 2 + 0.75), onCase(0.55, 0.26, Math.PI / 2 + 1.0), onCase(0.32, 0.28, Math.PI / 2 + 1.1)], 0.012, 6),
      box(0.08, 0.07, 0.07, [at(0.66), ENG.y + 0.18, z + 0.14 * s])];
    const vlvP = P(`T700 bleed & overspeed-drain valves ${R}`, {
      system: 'Propulsion', material: 'Anti-icing and start bleed valve, overspeed and drain valve (ODV)', mass: 2.5, explode: [0.0, 1.8, 2.15 * s],
      desc: 'On the compressor casing, the anti-icing and start bleed valve bleeds air during starts so the compressor does not stall, and sends hot air to the inlet when anti-ice is on. Beside the HMU, the overspeed and drain valve shuts off the fuel to stop a power-turbine overspeed when the DEC trips it, and purges the fuel manifold at shutdown.',
    }, [mesh(merge(vlv), MAT.casting())]);
    const decuP = P(`T700 DECU & ignition ${R}`, {
      system: 'Propulsion', material: 'Digital electronic control unit, ignition exciter, shielded leads', mass: 8, explode: [0.1, 0.7, 2.0 * s],
      desc: 'The -701D\'s digital electronic control unit trims the fuel flow to hold rotor speed at 100 %, shares load between the two engines and limits turbine temperature; the ignition exciter beside it fires the two igniters only during the start.',
    }, [mesh(merge([box(0.26, 0.06, 0.16, [at(0.62), ENG.y - 0.22, z]), box(0.1, 0.06, 0.07, [at(0.85), ENG.y - 0.2, z + 0.14 * s])]), MAT.avionics()), mesh(pipe([[at(0.85), ENG.y - 0.19, z + 0.16 * s], [at(0.88), ENG.y - 0.08, z + 0.22 * s], [at(0.86), ENG.y + 0.05, z + 0.21 * s], onCase(0.84, 0.24, -0.6)], 0.007), MAT.wiring())]);
    for (const [p, r] of [[coldP, 'compressor'], [combP, 'engine'], [ggtP, 'engine'], [ptP, 'engine'], [tgtP, 'engine'], [agbP, 'gearbox'], [hmuP, 'warm'], [vlvP, 'warm'], [decuP, 'avionics']]) p.userData.part.thermalRole = r;
    engines.push(coldP, combP, ggtP, ptP, tgtP, agbP, hmuP, vlvP, decuP);

    // inlet particle separator: swirl vanes in the annulus and the collector scroll case
    const vanes = [];
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2;
      const v = new THREE.BoxGeometry(0.06, 0.12, 0.008);
      v.rotateY(0.6);
      v.translate(0, 0.2, 0);
      v.rotateX(a);
      v.translate(ENG.front + 0.0, ENG.y, z);
      vanes.push(v);
    }
    const ipsG = [
      cyl(0.31, 0.31, 0.2, [ENG.front - 0.04, ENG.y, z], 'x', 32, true),
      cyl(0.13, 0.16, 0.22, [ENG.front - 0.01, ENG.y, z], 'x', 24),
      place(lathe([[0.13, 0], [0.12, 0.02], [0.06, 0.1], [0.001, 0.12]], 20), [ENG.front + 0.1, ENG.y, z], [0, 0, -Math.PI / 2]),
      latheX([[0.001, 0], [0.17, 0], [0.22, 0.02], [0.31, 0.1], [0.31, 0.16], [0.001, 0.16]], 32).translate(ENG.front - 0.3, ENG.y, z),   // scroll case and main frame
      ...vanes,
    ];
    P(`Inlet particle separator ${R}`, {
      system: 'Propulsion', material: 'Steel swirl vanes, aluminium collector scroll and front frame', mass: 10, explode: [0.8, 1.1, 1.7 * s], xrayWeight: 0.6,
      desc: 'Built into the T700\'s front frame: swirl vanes spin the incoming air so sand and dust are flung outward into a collector scroll, removing roughly 85 % of the sand before it can erode the compressor; only clean air turns inward to the compressor.',
    }, [mesh(merge(ipsG), MAT.darkMetal())]);
    // blower drum on a pad on the gearbox's outboard face, just aft of the scroll case (between the
    // starter-side alternator and the boost pump, inside the cowl): axial inlet from the scroll's
    // discharge port, tangential outlet into the scavenge duct running aft along the top
    const bc = [at(0.33), ENG.y + 0.295, z + 0.14 * s];
    const blower = [cyl(0.06, 0.06, 0.06, bc, 'z', 18), cyl(0.045, 0.045, 0.012, [bc[0], bc[1], bc[2] - 0.033 * s], 'z', 14)];
    const ipsIn = pipe([onCase(0.16, 0.305, 0.97), [at(0.2), ENG.y + 0.29, z + 0.215 * s], [at(0.28), ENG.y + 0.3, z + 0.215 * s], [bc[0], bc[1], bc[2] + 0.045 * s]], 0.028, 10);
    const scav = pipe([[bc[0] + 0.03, bc[1] + 0.035, bc[2] + 0.012 * s], [at(0.38), ENG.y + 0.32, z + 0.17 * s], [at(0.5), ENG.y + 0.312, z + 0.195 * s], [at(0.8), ENG.y + 0.29, z + 0.2 * s], [at(1.0), ENG.y + 0.27, z + 0.2 * s], [at(1.2), ENG.y + 0.22, z + 0.2 * s]], 0.03, 10);
    P(`T700 IPS blower & scavenge duct ${R}`, {
      system: 'Propulsion', material: 'Gear-driven centrifugal blower, inlet and scavenge ducts', mass: 3, explode: [0.45, 2.0, 1.75 * s],
      desc: 'A gear-driven blower on a pad on the outboard face of the accessory gearbox sucks the sand and dust out of the separator\'s collector scroll through a short inlet duct and blows it aft along the top of the engine, to be dumped overboard around the exhaust.',
    }, [mesh(merge(blower), MAT.casting()), mesh(merge([ipsIn, scav]), MAT.darkMetal())]);

    // upturned exhaust (UES): out of the cowling's aft opening, through the cooling grid, then up
    const path = [V3(ENG.rear - 0.02, ENG.y, z), V3(-2.0, ENG.y + 0.01, z), V3(-2.2, ENG.y + 0.1, z + 0.02 * s), V3(-2.31, ENG.y + 0.27, z + 0.04 * s), V3(-2.34, ENG.y + 0.42, z + 0.05 * s)];
    const ues = bentDuct(path.slice().reverse(), 0.25, 0.19, 0.29, 0.19, 4.2, 2);
    const top = path[path.length - 1];
    const plates = [];
    for (let k = 0; k < 6; k++) plates.push(box(0.5, 0.06, 0.012, [top.x, top.y - 0.03, top.z - 0.2 + k * 0.08]));
    for (let k = 0; k < 4; k++) plates.push(box(0.012, 0.05, 0.42, [top.x - 0.18 + k * 0.12, top.y - 0.04, top.z]));
    const ex = P(`Upturned exhaust ${R}`, {
      system: 'Propulsion', material: 'Inconel duct and cooling grid, low-emissivity-coated outer skin', mass: 32, explode: [-1.0, 1.25, 1.95 * s],
      desc: 'The M\'s Upturned Exhaust System: behind the power turbine the ~550 °C exhaust is cooled as it passes a grid of metal plates, then the duct turns it upward into the rotor downwash, which spreads the plume and hides the hot metal from heat-seeking missiles below. (HIRSS — a three-stage removable core with low-reflectance coatings that turns the exhaust outboard — is an older, separate kit.)',
    }, [mesh(ues.g, MAT.paintDark()), mesh(merge(plates), MAT.hot()), mesh(cyl(0.2, 0.2, 0.01, [top.x, top.y - 0.07, top.z], 'y', 24), MAT.intake())]);
    ex.userData.part.thermalRole = 'suppressor';

    // nacelle cowling (skin): fold-down side cowls double as work platforms
    const cst = [];
    const keys = [[-2.02, 0.3], [-1.85, 0.35], [-1.5, 0.39], [-1.0, 0.4], [-0.5, 0.4], [-0.32, 0.39], [-0.26, 0.37]];
    for (const [x, r] of keys) cst.push({ c: [x, ENG.y, z], w: r, h: r * 0.98, e: 2.3 });
    const cow = duct(cst, 36);
    const lip = new THREE.TorusGeometry(0.365, 0.022, 8, 40).rotateY(Math.PI / 2).translate(-0.26, ENG.y, z);
    const aftRing = new THREE.RingGeometry(0.26, 0.31, 32).rotateY(-Math.PI / 2).translate(-2.02, ENG.y, z);
    const inner = cyl(0.35, 0.32, 0.3, [-0.4, ENG.y, z], 'x', 32, true);
    P(`Engine cowling ${R}`, {
      system: 'Skin & fairings', skin: true, material: 'Kevlar/graphite composite cowls, titanium firewall seals', mass: 32, explode: [0, 1.6, 2.4 * s],
      desc: 'The side cowls hinge down to become work platforms, so a mechanic can stand on them to service the engine and transmission without a stand.',
    }, [mesh(merge([cow, lip, aftRing]), MAT.paint()), mesh(inner, MAT.intake())]);
  }

  // engine firewalls and mounts (structure on the upper deck)
  const fw = [];
  for (const s of [1, -1]) {
    fw.push(box(1.15, 0.24, 0.02, [-1.03, 2.49, 0.43 * s]));          // inboard wall of the engine bay, inside the cowl
    // rear mount links only: the front of the engine is carried by the input module
    for (const x of [ENG.rear + 0.2]) fw.push(tube([x, 2.29, 0.5 * s], [x, ENG.y - 0.2, ENG.z * s], 0.02), tube([x, 2.29, 0.98 * s], [x, ENG.y - 0.2, ENG.z * s], 0.02));
  }
  // transmission deck plate (primed aluminium), kept inside the transmission fairing's footprint;
  // the main module stands on four pads (the primary servos stand on the deck ahead of the front pair)
  const deck = [box(1.36, 0.03, 0.7, [-0.05, 2.3, 0])];
  for (const [x, z] of [[-0.42, 0.37], [-0.42, -0.37]]) deck.push(box(0.12, 0.1, 0.1, [x, 2.34, z]));
  for (const z of [0.32, -0.32]) deck.push(box(0.1, 0.06, 0.07, [0.22, 2.32, z]));   // forward pads, under the case bowl
  P('Upper deck, firewalls & mounts', {
    system: 'Structure', material: 'Titanium firewalls, steel engine mount links, primed aluminium deck with transmission mounting pads', mass: 95, explode: [0, 0.12, 0], xrayWeight: 0.5,
    desc: 'The deck above the cabin roof carries the transmission on four pads and each engine on tubular links; titanium firewalls separate the engines from the gearbox and from each other.',
  }, [mesh(merge(fw), MAT.titanium()), mesh(merge(deck), MAT.primer())]);

  // ------------------------------------------------------------------ tail take-off: gust lock, rotor brake
  const tto = V3(cx - 0.62, 2.45, 0);           // -0.66: the take-off flange at the back of the main module
  const gl = [gearWheel(0.125, 0.024, 36, [tto.x - 0.05, tto.y, 0], 'x', 24), box(0.12, 0.1, 0.08, [tto.x - 0.04, tto.y + 0.17, 0.06]), box(0.03, 0.06, 0.03, [tto.x - 0.05, tto.y + 0.11, 0.06])];
  const glCable = pipe([[tto.x - 0.03, tto.y + 0.17, 0.11], [-0.8, 2.35, 0.14], [-1.0, 2.24, 0.14], [-1.4, 2.18, 0.13], [-1.68, 2.05, 0.06], [-1.74, 1.9, 0.0]], 0.006, 4);
  P('Main rotor gust lock', {
    system: 'Drive system', material: 'Locking pawl on toothed tail take-off flange, push-pull cable, cabin handle', mass: 4, explode: [-0.35, 1.05, 0.5],
    desc: 'A pawl that drops into teeth on the tail take-off flange to stop a parked rotor turning in the wind. It is strong enough to hold the rotor against one engine at IDLE, so an engine can be run for maintenance with the rotor still; it is set only with the rotor stopped and releases only with both engines shut down, from a handle at the rear of the cabin. (Described in the UH-60A/L manual; shown on the assumption the M keeps it beside its rotor brake.)',
  }, [mesh(merge(gl), MAT.steel()), mesh(glCable, MAT.wiring()), mesh(box(0.05, 0.12, 0.03, [-1.745, 1.86, 0.0]), MAT.red())]);
  P('Rotor brake', {
    system: 'Drive system', material: 'Steel disc, hydraulic caliper', mass: 12, explode: [-0.5, 1.4, -0.3],
    desc: 'New on the M (A/L aircraft had only the gust lock): a hydraulic disc brake on the tail take-off that stops the blades quickly after shutdown, for shipboard landings and to let passengers board sooner.',
  }, [mesh(merge([cyl(0.15, 0.15, 0.02, [tto.x - 0.1, tto.y, 0], 'x', 28), box(0.09, 0.12, 0.08, [tto.x - 0.1, tto.y + 0.14, -0.04])]), MAT.steel())]);
  P('Transmission oil cooler & blower', {
    system: 'Drive system', material: 'Aluminium heat exchanger, axial blower', mass: 26, explode: [-0.6, 1.5, 0],
    desc: 'The tail drive shaft spins an axial blower that pulls air through the transmission oil cooler, so the gearbox is cooled whenever the rotor turns, even with both engines stopped in autorotation.',
  }, [mesh(merge([cyl(0.17, 0.17, 0.42, [-1.3, 2.43, 0], 'x', 28), box(0.36, 0.13, 0.36, [-1.3, 2.535, 0])]), MAT.casting())]);

  // ------------------------------------------------------------------ tail drive shaft: six sections
  const ry = (x) => roofY(x) + 0.08;
  const J = [V3(tto.x - 0.14, 2.45, 0), V3(-1.55, 2.43, 0), V3(-3.6, ry(-3.6), 0), V3(-5.15, ry(-5.15), 0), V3(-6.7, ry(-6.7), 0), V3(TAIL.igb[0] + 0.295, TAIL.igb[1], 0)];   // the last joint on the 42° box's input flange, outside its case
  const igb = V3(...TAIL.igb), tgb = V3(...TAIL.tgb);
  const pyDir = tgb.clone().sub(igb).normalize();
  const secs = [
    ['Tail drive shaft section 1', [-0.7, 1.35, 0], 'The first section leaves the tail take-off behind the rotor brake and runs through the oil cooler, driving its blower.'],
    ['Tail drive shaft section 2', [-1.1, 1.1, 0], 'From the oil cooler back over the transition section to the start of the tail cone.'],
    ['Tail drive shaft section 3', [-2.4, 0.95, 0], 'The first of three sections along the top of the tail cone, under the hinged shaft cover.'],
    ['Tail drive shaft section 4', [-2.4, 1.2, 0], 'The middle tail-cone section. Like the others it is a dynamically balanced aluminium tube, ballistically tolerant if hit by a projectile.'],
    ['Tail drive shaft section 5', [-2.4, 0.95, 0], 'The last tail-cone section, ending at the 42° intermediate gearbox at the foot of the pylon.'],
  ];
  secs.forEach(([name, explode, d], k) => {
    const a = J[k], b = J[k + 1], dir = b.clone().sub(a).normalize();
    P(name, {
      system: 'Drive system', material: 'Dynamically balanced aluminium-alloy tube', mass: k === 0 ? 4 : 7, explode,
      desc: `${d} The tail drive turns at ${rpm(tailRpm)} rpm.`,
    }, [mesh(tube(a.clone().addScaledVector(dir, 0.03), b.clone().addScaledVector(dir, -0.03), 0.05, 14), MAT.steel())]);
  });
  const cpl = [];
  for (let k = 0; k < J.length; k++) cpl.push(...discCoupling(J[k], (J[k + 1] || igb).clone().sub(J[k - 1] || J[k]), 0.075, 0.05));
  // pylon shaft couplings on the 42° box's output flange and the 90° box's input flange, just outside their housings
  cpl.push(...discCoupling(igb.clone().addScaledVector(pyDir, 0.265), pyDir, 0.07, 0.05), ...discCoupling(tgb.clone().addScaledVector(pyDir, -0.265), pyDir, 0.07, 0.05));
  P('Tail drive shaft disc couplings', {
    system: 'Drive system', material: 'Stainless-steel multiple-disc flexible couplings', mass: 8, count: 8, explode: [-2.4, 1.65, 0],
    desc: 'Flexible couplings made of packs of thin steel discs join the sections instead of universal joints. The discs flex to take up the angle between sections and the bending of the tail cone in flight, need no lubrication, and turn at a constant speed where a universal joint would not.',
  }, [mesh(merge(cpl), MAT.steel())]);
  const hangers = [];
  for (const x of [-2.9, -3.75, -5.3, -6.85]) {          // the first on section 2, aft of the APU
    const k = x > -3.6 ? 1 : x > -5.15 ? 2 : x > -6.7 ? 3 : 4;
    const p = J[k].clone().lerp(J[k + 1], (x - J[k].x) / (J[k + 1].x - J[k].x));
    hangers.push(cyl(0.085, 0.085, 0.07, [p.x, p.y, 0], 'x', 18), box(0.06, 0.1, 0.24, [p.x, p.y - 0.07, 0]), box(0.12, 0.012, 0.3, [p.x, p.y - 0.125, 0]));
  }
  P('Viscous-damped hanger bearings', {
    system: 'Drive system', material: 'Sealed ball bearings in viscous-damped mounts on adjustable plates', mass: 10, count: 4, explode: [-2.4, 1.45, 0],
    desc: 'Four sealed bearings hang the shaft from the airframe, each in a viscous-damped mount on an adjustable plate bolted to a fuselage bracket. The damping keeps the long shaft from whirling as it runs up through its critical speeds.',
  }, [mesh(merge(hangers), MAT.casting())]);

  // ------------------------------------------------------------------ APU
  // exhaust: a short bend from the turbine end out to an outlet ring flush in the left side of the aft
  // deck fairing; bleed air leaves through an outlet on top of the compressor end
  let ea0 = Math.PI / 2, ea1 = Math.PI;
  for (let k = 0; k < 30; k++) { const m = (ea0 + ea1) / 2; if (aftDeckPoint(roofY, -2.69, m).p.y > 2.395) ea0 = m; else ea1 = m; }
  const exo = aftDeckPoint(roofY, -2.69, ea0);
  // outlet bead: a closed ring lying on the fairing surface round the duct's end (flush by construction)
  const daPerM = 0.01 / aftDeckPoint(roofY, -2.69, ea0 + 0.01).p.distanceTo(exo.p), bead = [];
  for (let k = 0; k < 20; k++) { const t = (k / 20) * Math.PI * 2; bead.push(aftDeckPoint(roofY, -2.69 + 0.058 * Math.cos(t), ea0 + 0.058 * daPerM * Math.sin(t), -0.001).p); }
  const exOut = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bead, true), 40, 0.006, 6, true);
  const apuG = [cyl(0.12, 0.12, 0.5, [-2.33, 2.38, -0.18], 'x', 22), cyl(0.08, 0.08, 0.2, [-2.0, 2.38, -0.18], 'x', 18),
    pipe([V3(-2.56, 2.38, -0.18), V3(-2.645, 2.385, -0.205), exo.p.clone().addScaledVector(exo.n, -0.045), exo.p.clone().addScaledVector(exo.n, -0.012)], 0.05, 12), exOut,
    cyl(0.032, 0.032, 0.03, [-2.12, 2.51, -0.18], 'y', 14)];
  P('Auxiliary power unit', {
    system: 'Propulsion', material: 'T-62T-40-1 gas turbine with gearbox, exhaust duct to the left side', mass: 45, explode: [-1.1, 1.8, -0.6],
    desc: 'A small gas turbine aft of the main transmission. It supplies bleed air to start the main engines and heat the cabin, and drives its own generator and the hydraulic start motor\'s recharge, so the helicopter needs no ground cart; its exhaust leaves through a port on the left side of the aft fairing. It is not qualified for normal use in flight.',
  }, [mesh(merge(apuG), MAT.darkMetal())]).userData.part.thermalRole = 'apu';
  P('APU electronic sequence unit', {
    system: 'Propulsion', material: 'Electronic sequence unit with BITE indicators', mass: 3, explode: [0.5, 0.5, -0.6],
    desc: 'Runs the APU\'s start sequence and shuts it down for overspeed, underspeed, high exhaust temperature, low oil pressure or loss of its own power. Built-in-test indicators on its face show the maintainer why it stopped. Mounted on the aft cabin wall (location approximate).',
  }, [mesh(box(0.1, 0.15, 0.15, [-1.71, 1.82, -0.52]), MAT.avionics()), mesh(box(0.012, 0.04, 0.1, [-1.655, 1.86, -0.52]), MAT.screenAmber())]);

  // ------------------------------------------------------------------ pneumatic start system
  // one manifold fed by either engine, the APU or a ground cart: check valves at each source and a
  // shutoff valve at each engine; branches to both starters and to the heater mixing valve
  // from the APU's bleed outlet forward over its gearbox and hydraulic start motor to the manifold tee
  const pn = [pipe([[-2.12, 2.515, -0.18], [-2.07, 2.535, -0.185], [-1.95, 2.525, -0.195], [-1.84, 2.495, -0.21], [-1.77, 2.46, -0.235], [-1.72, 2.44, -0.25]], 0.028, 8)];
  const pnFeed = {};
  for (const s of [1, -1]) {
    const pts = s < 0
      ? [[-1.72, 2.44, -0.25], [-1.4, 2.45, -0.3], [-1.05, 2.47, -0.4], [-0.86, 2.62, -0.5], [-0.8, 2.8, -0.6], [-0.74, 2.87, -0.65]]
      : [[-1.72, 2.44, -0.25], [-1.76, 2.5, 0.0], [-1.6, 2.49, 0.24], [-1.3, 2.46, 0.32], [-1.05, 2.47, 0.4], [-0.86, 2.62, 0.5], [-0.8, 2.8, 0.6], [-0.74, 2.87, 0.65]];
    pn.push(pipe(pts, 0.028, 8));
    pn.push(pipe([[-1.15, 2.5, 0.42 * s], [-1.17, 2.62, 0.52 * s], [-1.15, ENG.y + 0.17, ENG.z * s - 0.12 * s]], 0.02, 6));       // engine bleed port (cross-bleed / heater source)
    pnFeed[s] = pts;
  }
  pn.push(pipe([[-1.72, 2.44, -0.25], [-2.0, 2.4, -0.3], [-2.2, 2.39, -0.33], [-2.22, 2.39, -0.37]], 0.022, 6));               // external pneumatic port
  pn.push(pipe([[-1.6, 2.49, 0.24], [-1.615, 2.477, 0.258], [-1.62, 2.46, 0.27]], 0.024, 6));                                // heater branch into the mixing valve
  const valves = [tube([-1.88, 2.507, -0.205], [-1.8, 2.481, -0.216], 0.04, 14), cyl(0.035, 0.035, 0.07, [-2.17, 2.39, -0.33], 'x', 12)];   // APU-outlet check valve on the duct ahead of the APU
  for (const s of [1, -1]) valves.push(cyl(0.035, 0.035, 0.07, [-1.15, ENG.y + 0.1, (ENG.z - 0.2) * s], 'y', 12), box(0.09, 0.08, 0.08, [-1.0, 2.46, 0.41 * s]), box(0.04, 0.05, 0.04, [-1.0, 2.52, 0.41 * s]));
  P('Pneumatic start ducts', {
    system: 'Propulsion', material: 'Stainless-steel bleed-air ducts with V-band joints, external ground connector', mass: 9, explode: [-0.9, 1.0, -0.2], xrayWeight: 0.6,
    desc: 'One pneumatic system, fed by either engine\'s compressor bleed, the APU or a ground cart through a connector on the left side, drives both engines\' air-turbine starters and the cabin heater. Bleed from a running engine can start the other one (a cross-bleed start).',
  }, [mesh(merge(pn), MAT.steel()), mesh(cyl(0.04, 0.04, 0.02, [-2.22, 2.39, -0.375], 'z', 14), MAT.yellow())]);
  P('Bleed-air check & shutoff valves', {
    system: 'Propulsion', material: 'Flapper check valves, motor-operated shutoff valves', mass: 4, count: 6, explode: [-0.6, 1.5, -0.2],
    desc: 'A check valve at every source — the APU, each engine\'s bleed port and the ground connector — stops air flowing backwards into a source that is not running, and a shutoff valve at each engine isolates that engine\'s side of the system.',
  }, [mesh(merge(valves), MAT.casting())]);

  // ------------------------------------------------------------------ fire protection
  const det = [];
  for (const s of [1, -1]) det.push(cyl(0.025, 0.025, 0.06, [-0.95, 2.48, 0.455 * s], 'z', 10), cyl(0.025, 0.025, 0.06, [-1.25, 2.27, 0.92 * s], 'y', 10));
  det.push(cyl(0.025, 0.025, 0.06, [-2.25, 2.46, -0.02], 'y', 10));
  P('Fire detectors', {
    system: 'Propulsion', material: 'Solid-state infrared flame detectors', mass: 1, count: 5, explode: [-0.4, 0.75, 0.2],
    desc: 'Five radiation-sensing flame detectors — two in each engine bay, one on the firewall and one on the deck, and one in the APU compartment — watch continuously for the infrared of a flame. A detection lights the matching fire T-handle and the master FIRE lights; the warning resets itself when the flame stops.',
  }, [mesh(merge(det), MAT.lens())]);
  P('Engine fire extinguisher bottles', {
    system: 'Propulsion', material: 'Steel containers of liquid agent pressurised with nitrogen, each with a gauge', mass: 12, count: 2, explode: [-0.4, 1.95, 0.55],
    desc: 'Main and reserve bottles above the upper deck behind the right engine compartment. Each has dual outlets, so together they give two shots into either engine bay or the APU compartment; each carries a pressure gauge checked on the preflight walk-round.',
  }, [mesh(merge([new THREE.SphereGeometry(0.085, 16, 12).translate(-2.05, 2.42, 0.24), new THREE.SphereGeometry(0.085, 16, 12).translate(-1.85, 2.42, 0.24)]), MAT.red()),
    mesh(merge([cyl(0.02, 0.02, 0.02, [-2.05, 2.515, 0.24], 'y', 10), cyl(0.02, 0.02, 0.02, [-1.85, 2.515, 0.24], 'y', 10)]), MAT.lens())]);
  // Discharge lines, routed clear of the tail drive shaft, the fuel feeds and the heater: each bottle
  // has an outlet to each engine bay and one to the APU compartment. The right-bay pair runs forward
  // over the heater mixing valve and through the right firewall; the left-bay pair drops under the
  // tail drive shaft and climbs to the left firewall; the APU pair crosses over the shaft aft of the
  // compartment's fire detector. A thermal-relief line from both bottles runs aft to the red
  // indicator disc on the exposed right flank of the aft deck fairing.
  const dl = [];
  for (const sd of [1, -1]) {
    const nz = (z) => z * sd, fwd = [[-1.72, 2.53, 0.36], [-1.57, 2.535, 0.385], [-1.5, 2.535, 0.43], [-1.44, 2.53, 0.47], [-1.38, 2.52, 0.48]].map(([x, y, z]) => [x, y, nz(z)]);
    if (sd > 0) {
      dl.push(pipe([[-2.05, 2.48, 0.3], [-1.95, 2.5, 0.31], [-1.85, 2.51, 0.33], [-1.78, 2.52, 0.345], ...fwd], 0.01, 5));
      dl.push(pipe([[-1.85, 2.48, 0.3], [-1.84, 2.505, 0.325], [-1.8, 2.515, 0.34]], 0.01, 5));
    } else {
      // under the shaft, then up between the pneumatic manifold and the left fuel feed
      const under = [[-2.05, 2.4, 0.158], [-1.95, 2.375, 0.135], [-1.85, 2.35, 0.115], [-1.76, 2.325, 0.07], [-1.71, 2.315, 0.0], [-1.69, 2.32, -0.12], [-1.66, 2.33, -0.24], [-1.63, 2.36, -0.32], [-1.61, 2.44, -0.335], [-1.58, 2.52, -0.36], [-1.53, 2.535, -0.39], ...fwd.slice(2)];
      dl.push(pipe(under, 0.01, 5), pipe([[-1.85, 2.38, 0.165], [-1.85, 2.36, 0.13], [-1.83, 2.345, 0.11]], 0.01, 5));
    }
  }
  dl.push(pipe([[-2.12, 2.45, 0.22], [-2.25, 2.46, 0.14], [-2.36, 2.465, 0.03], [-2.38, 2.462, -0.035]], 0.009, 5),          // APU compartment
    pipe([[-1.85, 2.44, 0.157], [-1.95, 2.452, 0.14], [-2.05, 2.455, 0.14], [-2.15, 2.458, 0.145], [-2.25, 2.46, 0.14]], 0.009, 5));
  const nzl = [];
  for (const sd of [1, -1]) nzl.push(cyl(0.016, 0.016, 0.04, [-1.37, 2.52, 0.495 * sd], 'z', 8));
  nzl.push(cyl(0.016, 0.016, 0.03, [-2.38, 2.45, -0.045], 'y', 8));
  // thermal relief: both bottles' safety ports → indicator disc flush in the fairing skin
  const ind = aftDeckPoint(roofY, -2.72, 0.5);
  const indIn = ind.p.clone().addScaledVector(ind.n, -0.03);
  dl.push(pipe([[-1.85, 2.37, 0.3], [-1.95, 2.36, 0.305], [-2.05, 2.355, 0.302], [-2.2, 2.35, 0.3], [-2.45, 2.36, 0.29], [-2.62, 2.37, 0.282], indIn], 0.008, 5));
  const disc = cyl(0.03, 0.03, 0.008, [0, 0, 0], 'y', 16).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), ind.n));
  const discAt = ind.p.clone().addScaledVector(ind.n, 0.002);
  disc.translate(discAt.x, discAt.y, discAt.z);
  const rim = tube(indIn, ind.p.clone().addScaledVector(ind.n, -0.002), 0.022, 12);
  P('Fire extinguisher discharge lines', {
    system: 'Propulsion', material: 'Stainless-steel discharge tubing and nozzles, thermal discharge indicator', mass: 3, explode: [-0.4, 1.7, 0.85],
    desc: 'Tubing from both bottles to nozzles in each engine bay and the APU compartment. A thermal-discharge safety port vents a bottle that overheats and ruptures a red indicator disc in the right side of the aft deck fairing, so the crew can see on the walk-round that a bottle has emptied. (Disc position approximate.)',
  }, [mesh(merge([...dl, rim]), MAT.hydraulic()), mesh(merge(nzl), MAT.steel()), mesh(disc, MAT.red())]);

  return { engines, ENG };
}
