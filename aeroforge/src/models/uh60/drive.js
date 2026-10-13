// UH-60M power and drive: two GE T700-GE-701D turboshafts (integral inlet particle separators,
// IR suppressors), the modular main transmission (two input modules, two accessory modules and
// the main module), engine output shafts, rotor brake, oil cooler, the tail drive shaft and its
// hanger bearings, the APU and the engine fire bottles.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { lathe, loftRings } from '../../engine/geometry.js';
import { MAT, DEG, V3, merge, box, cyl, tube, pipe, place, mirror, TAIL } from './common.js';

const ENG = { y: 2.58, z: 0.76, front: -0.5, rear: -1.67 };   // inlet face and exhaust flange: 1.17 m

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

export function buildDrive({ A, P, roofY }) {
  // ------------------------------------------------------------------ main transmission
  // The main module (the M's improved-durability gearbox): a magnesium/aluminium housing around
  // the combining spiral-bevel stage and the planetary stage, with its own lubrication system.
  const cx = -0.04;   // shaft axis at transmission height (the shaft leans 3° forward)
  const caseG = [
    place(lathe([[0.001, 0], [0.38, 0], [0.44, 0.1], [0.44, 0.24], [0.4, 0.34], [0.29, 0.42], [0.18, 0.48], [0.16, 0.52], [0.001, 0.52]], 36), [cx, 2.24, 0]),
    box(0.82, 0.12, 0.74, [cx, 2.25, 0]),                           // sump
    cyl(0.11, 0.11, 0.3, [cx - 0.5, 2.45, 0], 'x', 20),            // tail take-off housing
  ];
  for (let k = 0; k < 12; k++) {                                     // case ribs
    const a = (k / 12) * Math.PI * 2;
    caseG.push(box(0.03, 0.26, 0.06, [cx + 0.44 * Math.cos(a), 2.4, 0.44 * Math.sin(a)], [0, -a, 0]));
  }
  P('Main module (main transmission)', {
    system: 'Drive system', material: 'Magnesium/aluminium housing, steel bearing liners', mass: 230, explode: [0, 0.3, 0],
    desc: 'The housing of the main gearbox: it carries both engines\' power through two stages — a combining spiral-bevel set and a planetary — down to the 258 rpm rotor shaft, an overall reduction of about 81 : 1 from the engines\' 20,900 rpm. The M\'s improved-durability gearbox is rated at 3,400 shp with both engines; the tail take-off leaves from its aft face.',
    callout: true, anchor: [cx + 0.3, 2.34, 0.4],
  }, [mesh(merge(caseG), MAT.casting())]);
  // combining bevel stage inside the case: one bull gear driven by a pinion from each input module
  const bevel = [cyl(0.36, 0.33, 0.07, [cx, 2.38, 0], 'y', 40), cyl(0.12, 0.12, 0.14, [cx, 2.33, 0], 'y', 20)];
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2;
    bevel.push(box(0.035, 0.05, 0.02, [cx + 0.35 * Math.cos(a), 2.42, 0.35 * Math.sin(a)], [0, -a, 0]));
  }
  for (const sd of [1, -1]) bevel.push(place(new THREE.CylinderGeometry(0.055, 0.09, 0.14, 18), [cx + 0.06, 2.45, 0.36 * sd], [Math.PI / 2 * sd, 0, 0]));
  bevel.push(place(new THREE.CylinderGeometry(0.05, 0.075, 0.1, 16), [cx - 0.36, 2.45, 0], [0, 0, Math.PI / 2]));   // tail take-off pinion
  P('Main bevel gear & combining pinions', {
    system: 'Drive system', material: 'Carburised steel spiral-bevel gears', mass: 105, explode: [0.5, 0.45, 0],
    desc: 'Inside the main module the two input pinions mesh with one large spiral-bevel bull gear, combining both engines on a vertical shaft; a third pinion off the same gear drives the tail take-off. If one engine stops, its freewheel unit lets the other drive the gear alone.',
  }, [mesh(merge(bevel), MAT.steel())]);
  const planet = [cyl(0.32, 0.32, 0.09, [cx, 2.62, 0], 'y', 40, true), cyl(0.07, 0.07, 0.12, [cx, 2.62, 0], 'y', 16), cyl(0.27, 0.27, 0.03, [cx, 2.68, 0], 'y', 36)];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    planet.push(cyl(0.105, 0.105, 0.08, [cx + 0.185 * Math.cos(a), 2.62, 0.185 * Math.sin(a)], 'y', 20));
  }
  P('Planetary reduction stage', {
    system: 'Drive system', material: 'Steel sun gear, five planet gears, fixed ring gear and planet carrier', mass: 95, explode: [-0.5, 0.45, 0],
    desc: 'The final stage: the bull-gear shaft turns a sun gear, five planets roll round a fixed ring gear, and their carrier drives the rotor shaft. Splitting the torque five ways keeps the gears small enough for the transmission to fit under the rotor.',
  }, [mesh(merge(planet), MAT.steel())]);
  P('Main transmission lubrication & chip detectors', {
    system: 'Drive system', material: 'Gear-driven oil pump, filter with bypass indicator, magnetic chip detectors', mass: 22, explode: [0.2, 0.25, -0.9],
    desc: 'A pump in the sump sprays oil onto every gear mesh and bearing; it returns through a filter and the oil cooler aft. Magnetic chip detectors in each module light a cockpit caution when metal debris appears — early warning of a failing bearing.',
  }, [mesh(merge([box(0.18, 0.12, 0.14, [cx + 0.18, 2.2, -0.3]), cyl(0.05, 0.05, 0.16, [cx - 0.22, 2.22, -0.33], 'y', 14),
    cyl(0.02, 0.02, 0.05, [cx + 0.38, 2.2, 0.2], 'x', 10), cyl(0.02, 0.02, 0.05, [cx - 0.3, 2.2, 0.32], 'x', 10), cyl(0.02, 0.02, 0.05, [cx - 0.55, 2.4, 0.1], 'z', 10),
    pipe([[cx - 0.22, 2.3, -0.33], [cx - 0.6, 2.36, -0.28], [-1.0, 2.4, -0.18], [-1.12, 2.43, -0.1]], 0.014)]), MAT.yellow())]);

  for (const side of [1, -1]) {
    const s = side;
    const g = [
      cyl(0.13, 0.13, 0.3, [0.16, 2.52, 0.5 * s], 'x', 22),
      tube([0.1, 2.5, 0.46 * s], [cx + 0.1, 2.45, 0.28 * s], 0.11, 18),
      cyl(0.085, 0.11, 0.08, [-0.03, 2.52, 0.5 * s], 'x', 18),
    ];
    P(side > 0 ? 'Input module (right)' : 'Input module (left)', {
      system: 'Drive system', material: 'Aluminium case, bevel gears, freewheel (overrunning) clutch', mass: 58, explode: [0.3, 0.6, 1.0 * s],
      desc: 'Turns the engine\'s drive through a bevel gear set into the main module and contains the freewheel clutch, so a failed engine is disconnected automatically and the rotor keeps turning on the other engine or in autorotation.',
    }, [mesh(merge(g), MAT.casting())]);
    P(side > 0 ? 'Accessory module (right)' : 'Accessory module (left)', {
      system: 'Drive system', material: 'Aluminium gearbox', mass: 36, explode: [1.0, 0.6, 1.0 * s],
      desc: 'Bolted to the front of the input module and driven whenever the rotor turns, it runs a generator and a hydraulic pump — so electrical and hydraulic power continue even with both engines out in autorotation.',
    }, [mesh(merge([cyl(0.11, 0.11, 0.24, [0.43, 2.52, 0.5 * s], 'x', 20), box(0.2, 0.18, 0.17, [0.4, 2.47, 0.5 * s])]), MAT.casting())]);
  }
  // engine output (high-speed) shafts with diaphragm couplings
  for (const side of [1, -1]) {
    const a = V3(ENG.front + 0.02, ENG.y, ENG.z * side), b = V3(-0.07, 2.52, 0.5 * side);
    P(side > 0 ? 'Engine output shaft (right)' : 'Engine output shaft (left)', {
      system: 'Drive system', material: 'Steel shaft with flexible diaphragm couplings', mass: 9, explode: [0.6, 0.9, 1.25 * side],
      desc: 'Runs from the front of the engine through the centre of its inlet to the input module at 20,900 rpm; diaphragm couplings absorb misalignment as the engine and gearbox move on their mounts.',
    }, [mesh(merge([tube(a, b, 0.035, 12), cyl(0.065, 0.065, 0.04, [a.x - 0.04, a.y, a.z], 'x', 16), cyl(0.065, 0.065, 0.04, [b.x - 0.03, b.y, b.z], 'x', 16)]), MAT.steel())]);
  }

  // ------------------------------------------------------------------ engines
  // GE T700-GE-701D: 46 in (1.17 m) long, 15.6 in (0.396 m) nominal core diameter, 456 lb (207 kg).
  // Built, like the real engine, from modules: the front frame with its particle separator, the cold
  // section (compressor), the hot section (combustor and gas-generator turbine), the power turbine,
  // and the accessory section on top, plus the hydromechanical fuel control and the DECU.
  const engines = [];
  const L = ENG.front - ENG.rear;
  for (const side of [1, -1]) {
    const s = side, z = ENG.z * s, R = s > 0 ? '(right)' : '(left)';
    const at = (d) => ENG.front - d;          // x at distance d behind the inlet face
    const ring = (d, r, w = 0.012, seg = 32) => cyl(r, r, w, [at(d), ENG.y, z], 'x', seg);

    // cold section: five axial blisk stages and one centrifugal stage, main frame with integral oil tank
    // stations behind the inlet face: front frame 0–0.30 m, cold 0.30–0.78, hot 0.78–0.98, power turbine 0.98–1.17
    const cold = [latheX([[0.001, 0], [0.18, 0], [0.2, 0.03], [0.2, 0.11], [0.175, 0.16], [0.168, 0.22], [0.162, 0.4], [0.158, 0.48], [0.001, 0.48]], 32).translate(at(0.78), ENG.y, z)];
    for (const d of [0.34, 0.38, 0.42, 0.46, 0.5]) cold.push(ring(d, 0.166, 0.014));
    cold.push(ring(0.72, 0.205, 0.02, 36));
    const coldP = P(`T700 cold section ${R}`, {
      system: 'Propulsion', material: 'Steel and titanium blisks, AM355 steel casing, aluminium main frame', mass: 62, explode: [0.15, 1.1, 1.7 * s],
      desc: 'Five axial stages (one-piece "blisks") and one centrifugal stage raise the pressure about 17 : 1 (approximate) at 44,700 rpm gas-generator speed; the inlet guide vanes and first two stators are variable. The main frame ahead of it holds the engine\'s integral oil tank. The whole engine weighs 207 kg (456 lb, GE).',
    }, [mesh(merge(cold), MAT.darkMetal())]);
    // hot section: through-flow annular combustor with 12 fuel injectors and two igniters, 2-stage GG turbine
    const hot = [latheX([[0.001, 0], [0.18, 0], [0.19, 0.03], [0.205, 0.08], [0.205, 0.16], [0.19, 0.2], [0.001, 0.2]], 32).translate(at(0.98), ENG.y, z)];
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      hot.push(cyl(0.012, 0.012, 0.04, [at(0.81), ENG.y + 0.2 * Math.sin(a), z + 0.2 * Math.cos(a)], 'x', 6));
    }
    hot.push(ring(0.92, 0.198, 0.016), ring(0.95, 0.192, 0.016));
    const hotP = P(`T700 hot section ${R}`, {
      system: 'Propulsion', material: 'Nickel-alloy combustor liner, single-crystal turbine blades, thermal-barrier coatings', mass: 38, explode: [-0.25, 1.15, 1.75 * s],
      desc: 'An annular combustor fed by 12 fuel injectors and lit by two igniters, then a two-stage gas-generator turbine that drives the compressor. Gas leaving the combustor is above 1,200 °C; the cooled blades sit downstream of it.',
      callout: s > 0, anchor: [at(0.88), ENG.y + 0.42, z + 0.05],
    }, [mesh(merge(hot), MAT.hot())]);
    // power turbine: two stages, exhaust frame; its shaft runs forward through the core to the front drive
    const ptG = [latheX([[0.001, 0], [0.15, 0], [0.19, 0.03], [0.2, 0.09], [0.19, 0.19], [0.001, 0.19]], 32).translate(ENG.rear, ENG.y, z), ring(L - 0.08, 0.202, 0.014), ring(L - 0.14, 0.2, 0.014)];
    for (let k = 0; k < 6; k++) {                    // exhaust-frame struts
      const a = (k / 6) * Math.PI * 2 + 0.3;
      ptG.push(box(0.12, 0.02, 0.008, [ENG.rear + 0.06, ENG.y + 0.12 * Math.sin(a), z + 0.12 * Math.cos(a)], [a, 0, 0]));
    }
    const ptP = P(`T700 power turbine ${R}`, {
      system: 'Propulsion', material: 'Nickel-alloy discs and tip-shrouded blades, exhaust frame', mass: 40, explode: [-0.7, 1.15, 1.85 * s],
      desc: 'A two-stage free power turbine, not mechanically tied to the gas generator: its shaft runs forward through the hollow core to the front of the engine and the output shaft, at 20,900 rpm at 100 %. The exhaust frame behind it leads into the IR suppressor.',
    }, [mesh(merge(ptG), MAT.hot())]);
    // accessory section: top-mounted gearbox with the air-turbine starter, alternator, oil cooler and filter
    const ag = [box(0.42, 0.11, 0.22, [at(0.27), ENG.y + 0.27, z]), cyl(0.07, 0.07, 0.17, [at(0.13), ENG.y + 0.3, z - 0.1 * s], 'x', 16), cyl(0.05, 0.05, 0.1, [at(0.44), ENG.y + 0.3, z + 0.08 * s], 'x', 14), box(0.1, 0.1, 0.07, [at(0.5), ENG.y + 0.24, z - 0.12 * s])];
    const agbP = P(`T700 accessory section ${R}`, {
      system: 'Propulsion', material: 'Aluminium gearbox, air-turbine starter, alternator, oil pump, cooler and filter', mass: 30, explode: [0.3, 1.55, 1.7 * s],
      desc: 'On top of the engine\'s front frame, driven off the gas generator by a radial shaft. It carries the air-turbine starter (spun by bleed air from the APU or the other engine), an alternator that powers the ignition and the DECU, and the oil pump, cooler and filter.',
    }, [mesh(merge(ag), MAT.casting())]);
    // hydromechanical unit, engine-driven boost pump and filter, fuel manifold to the injectors
    const fuelLines = [pipe([[at(0.5), ENG.y + 0.2, z + 0.15 * s], [at(0.7), ENG.y + 0.22, z + 0.22 * s], [at(0.88), ENG.y + 0.16, z + 0.2 * s]], 0.011), pipe([[at(0.35), ENG.y + 0.18, z - 0.14 * s], [at(0.7), ENG.y + 0.2, z - 0.2 * s], [at(0.88), ENG.y + 0.14, z - 0.2 * s]], 0.009)];
    const hmuP = P(`T700 fuel control & pump ${R}`, {
      system: 'Propulsion', material: 'Hydromechanical unit (HMU), engine-driven boost pump, fuel filter, copper/steel lines', mass: 15, explode: [0.6, 1.4, 2.1 * s],
      desc: 'The engine-driven boost pump draws fuel by suction from the cell (a cut line sucks air rather than spraying fuel), the filter cleans it and the HMU meters it to the injectors on the DECU\'s commands, with a hydromechanical backup if the electronics fail.',
    }, [mesh(merge([box(0.16, 0.13, 0.12, [at(0.5), ENG.y + 0.18, z + 0.13 * s]), cyl(0.045, 0.045, 0.12, [at(0.36), ENG.y + 0.17, z + 0.17 * s], 'y', 12)]), MAT.casting()), mesh(merge(fuelLines), MAT.copper())]);
    const decuP = P(`T700 DECU & ignition ${R}`, {
      system: 'Propulsion', material: 'Digital electronic control unit, ignition exciter, shielded leads', mass: 8, explode: [0.1, 0.7, 2.0 * s],
      desc: 'The -701D\'s digital electronic control unit trims the fuel flow to hold rotor speed at 100 %, shares load between the two engines and limits turbine temperature; the ignition exciter beside it fires the two igniters only during the start.',
    }, [mesh(merge([box(0.26, 0.06, 0.16, [at(0.62), ENG.y - 0.22, z]), box(0.1, 0.06, 0.07, [at(0.85), ENG.y - 0.2, z + 0.14 * s])]), MAT.avionics()), mesh(pipe([[at(0.85), ENG.y - 0.19, z + 0.16 * s], [at(0.88), ENG.y - 0.08, z + 0.22 * s], [at(0.88), ENG.y + 0.05, z + 0.21 * s]], 0.007), MAT.wiring())]);
    for (const [p, r] of [[coldP, 'compressor'], [hotP, 'engine'], [ptP, 'engine'], [agbP, 'gearbox'], [hmuP, 'warm'], [decuP, 'avionics']]) p.userData.part.thermalRole = r;
    engines.push(coldP, hotP, ptP, agbP, hmuP, decuP);

    // inlet particle separator: swirl vanes in the annulus, scroll case and blower
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
      cyl(0.08, 0.08, 0.14, [ENG.front - 0.18, ENG.y - 0.24, z + 0.16 * s], 'z', 16),     // scavenge blower
      ...vanes,
    ];
    P(side > 0 ? 'Inlet particle separator (right)' : 'Inlet particle separator (left)', {
      system: 'Propulsion', material: 'Steel swirl vanes, aluminium scroll case, gear-driven scavenge blower', mass: 14, explode: [0.8, 1.1, 1.7 * s],
      desc: 'Built into the T700\'s front frame: swirl vanes spin the incoming air so sand and dust are flung outward into a scroll and blown overboard by a blower, removing roughly 85 % of sand before it can erode the compressor.',
    }, [mesh(merge(ipsG), MAT.darkMetal())]);

    // exhaust IR suppressor (HIRSS): duct angled aft and outboard, mixing cool air into the plume
    const stations = [];
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      const x = ENG.rear - 0.02 - 1.42 * t;
      stations.push({ c: [x, ENG.y + 0.06 * t, z + 0.36 * t * s], w: 0.2 + 0.08 * t, h: 0.21 + 0.11 * t, e: 2 + 2.5 * t });
    }
    stations.reverse();
    const hirss = duct(stations);
    const lips = [];
    const outX = ENG.rear - 1.44;
    for (let k = 0; k < 5; k++) lips.push(box(0.03, 0.56, 0.02, [outX + 0.01, ENG.y + 0.06, z + 0.36 * s - 0.2 + k * 0.1]));
    const hir = P(side > 0 ? 'Exhaust IR suppressor (right)' : 'Exhaust IR suppressor (left)', {
      system: 'Propulsion', material: 'Inconel inner duct and mixer, low-emissivity-coated outer duct', mass: 45, explode: [-1.0, 1.1, 1.95 * s],
      desc: 'The hover infrared suppressor (HIRSS) mixes cool ambient air into the ~550 °C exhaust and turns it outboard and up (the M\'s "upturned exhaust"), away from heat-seeking missiles below, so neither the plume nor the duct walls glow hot in the infrared.',
    }, [mesh(hirss, MAT.paintDark()), mesh(merge(lips), MAT.hot()), mesh(duct([{ c: [outX + 0.005, ENG.y + 0.06, z + 0.36 * s], w: 0.27, h: 0.31, e: 4.5 }, { c: [outX + 0.15, ENG.y + 0.05, z + 0.33 * s], w: 0.26, h: 0.3, e: 4.2 }]), MAT.intake())]);
    hir.userData.part.thermalRole = 'suppressor';

    // nacelle cowling (skin): fold-down side cowls double as work platforms
    const cst = [];
    const keys = [[-2.02, 0.3], [-1.85, 0.35], [-1.5, 0.39], [-1.0, 0.4], [-0.5, 0.4], [-0.32, 0.39], [-0.26, 0.37]];
    for (const [x, r] of keys) cst.push({ c: [x, ENG.y, z], w: r, h: r * 0.98, e: 2.3 });
    const cow = duct(cst, 36);
    const lip = new THREE.TorusGeometry(0.365, 0.022, 8, 40).rotateY(Math.PI / 2).translate(-0.26, ENG.y, z);
    const aftRing = new THREE.RingGeometry(0.2, 0.31, 32).rotateY(-Math.PI / 2).translate(-2.02, ENG.y, z);
    const inner = cyl(0.35, 0.32, 0.3, [-0.4, ENG.y, z], 'x', 32, true);
    P(side > 0 ? 'Engine cowling (right)' : 'Engine cowling (left)', {
      system: 'Skin & fairings', skin: true, material: 'Kevlar/graphite composite cowls, titanium firewall seals', mass: 32, explode: [0, 1.6, 2.4 * s],
      desc: 'The side cowls hinge down to become work platforms, so a mechanic can stand on them to service the engine and transmission without a stand.',
    }, [mesh(merge([cow, lip, aftRing]), MAT.paint()), mesh(inner, MAT.intake())]);
  }

  // engine firewalls and mounts (structure on the upper deck)
  const fw = [];
  for (const s of [1, -1]) {
    fw.push(box(1.5, 0.32, 0.02, [-1.15, 2.45, 0.38 * s]));
    for (const x of [ENG.front - 0.1, ENG.rear + 0.2]) fw.push(tube([x, 2.29, 0.5 * s], [x, ENG.y - 0.2, ENG.z * s], 0.02), tube([x, 2.29, 0.98 * s], [x, ENG.y - 0.2, ENG.z * s], 0.02));
  }
  const deck = [box(1.4, 0.03, 1.5, [-0.05, 2.3, 0])];     // transmission deck plate (primed aluminium)
  for (const [x, z] of [[0.42, 0.44], [0.42, -0.44], [-0.5, 0.44], [-0.5, -0.44]]) deck.push(box(0.14, 0.1, 0.14, [x, 2.34, z]));
  P('Upper deck, firewalls & mounts', {
    system: 'Structure', material: 'Titanium firewalls, steel engine mount links, primed aluminium deck with transmission mounting pads', mass: 95, explode: [0, 0.12, 0],
    desc: 'The deck above the cabin roof carries the transmission on four pads and each engine on tubular links; titanium firewalls separate the engines from the gearbox and from each other.',
  }, [mesh(merge(fw), MAT.titanium()), mesh(merge(deck), MAT.primer())]);

  // ------------------------------------------------------------------ tail take-off, brake, oil cooler, tail shafts
  const tto = V3(cx - 0.62, 2.45, 0);
  P('Rotor brake', {
    system: 'Drive system', material: 'Steel disc, hydraulic caliper', mass: 12, explode: [-0.4, 1.2, 0],
    desc: 'A hydraulic disc brake on the tail take-off stops the rotor after shutdown and holds it while the engines are started with the rotor locked.',
  }, [mesh(merge([cyl(0.15, 0.15, 0.02, [tto.x - 0.02, tto.y, 0], 'x', 28), box(0.09, 0.12, 0.08, [tto.x - 0.02, tto.y + 0.14, 0])]), MAT.steel())]);
  P('Transmission oil cooler & blower', {
    system: 'Drive system', material: 'Aluminium heat exchanger, axial blower', mass: 26, explode: [-0.6, 1.5, 0],
    desc: 'The first section of tail drive shaft spins an axial blower that pulls air through the transmission oil cooler, so the gearbox stays cool whenever the rotor turns.',
  }, [mesh(merge([cyl(0.17, 0.17, 0.42, [-1.3, 2.43, 0], 'x', 28), box(0.36, 0.13, 0.36, [-1.3, 2.535, 0])]), MAT.casting())]);

  const shaftPts = [tto.clone().add(V3(-0.04, 0, 0)), V3(-1.05, 2.43, 0), V3(-1.55, 2.42, 0), V3(-3.6, roofY(-3.6) + 0.08, 0)];
  for (let x = -4.4; x >= -8.2; x -= 0.8) shaftPts.push(V3(x, roofY(x) + 0.08, 0));
  shaftPts.push(V3(TAIL.igb[0] + 0.12, TAIL.igb[1], 0));
  const fwdShaft = [], coneShaft = [], hangers = [];
  for (let k = 0; k < shaftPts.length - 1; k++) {
    const a = shaftPts[k], b = shaftPts[k + 1];
    (a.x > -3.65 ? fwdShaft : coneShaft).push(tube(a, b, 0.05, 12));
    (a.x > -3.65 ? fwdShaft : coneShaft).push(cyl(0.075, 0.075, 0.05, [b.x, b.y, b.z], 'x', 14));
  }
  for (const x of [-3.6, -5.2, -6.8, -8.2]) {
    const y = roofY(x) + 0.08;
    hangers.push(cyl(0.085, 0.085, 0.07, [x + 0.25, y, 0], 'x', 18), box(0.06, 0.1, 0.24, [x + 0.25, y - 0.07, 0]));
  }
  P('Tail drive shaft, forward sections', {
    system: 'Drive system', material: 'Aluminium-alloy tube with flexible couplings', mass: 18, explode: [-1.0, 1.3, 0],
    desc: 'Takes about 4,100 rpm (estimate) off the back of the main module, through the rotor brake and oil-cooler blower, to the start of the tail cone.',
  }, [mesh(merge(fwdShaft), MAT.steel())]);
  P('Tail drive shaft, tail cone sections', {
    system: 'Drive system', material: 'Aluminium-alloy tubes with flexible-disc couplings', mass: 28, explode: [-2.4, 1.0, 0],
    callout: true, anchor: [-6.0, roofY(-6.0) + 0.14, 0],
    desc: 'Several short sections joined by flexible couplings run along the top of the tail cone, so the shaft can follow the tail cone as it bends in flight.',
  }, [mesh(merge(coneShaft), MAT.steel())]);
  P('Viscous-damped hanger bearings', {
    system: 'Drive system', material: 'Sealed ball bearings in viscous-damped mounts', mass: 10, count: 4, explode: [-2.4, 1.4, 0],
    desc: 'Support the tail shaft between couplings. Viscous damping in the mounts keeps the long shaft from whirling as it passes through its critical speeds.',
  }, [mesh(merge(hangers), MAT.casting())]);

  // ------------------------------------------------------------------ APU and fire extinguishers
  P('Auxiliary power unit', {
    system: 'Propulsion', material: 'Small gas turbine with starter-generator', mass: 45, explode: [-1.1, 1.8, -0.6],
    desc: 'Starts the main engines with compressed bleed air and powers the electrical and hydraulic systems on the ground with the rotor stopped, so the helicopter needs no ground cart.',
  }, [mesh(merge([cyl(0.12, 0.12, 0.55, [-2.35, 2.38, -0.18], 'x', 22), cyl(0.08, 0.08, 0.2, [-2.0, 2.38, -0.18], 'x', 18), tube([-2.64, 2.38, -0.18], [-2.82, 2.56, -0.18], 0.065, 14)]), MAT.darkMetal())]).userData.part.thermalRole = 'apu';
  P('Engine fire extinguisher bottles', {
    system: 'Propulsion', material: 'Steel bottles of Halon 1301 (CF₃Br) pressurised with nitrogen', mass: 12, count: 2, explode: [-0.4, 1.9, 0.5],
    desc: 'A main and a reserve bottle, cross-plumbed so that either can be discharged into either engine bay from the cockpit fire handles — two shots for one fire.',
  }, [mesh(merge([new THREE.SphereGeometry(0.085, 16, 12).translate(-0.95, 2.38, 0.22), new THREE.SphereGeometry(0.085, 16, 12).translate(-0.95, 2.38, -0.22)]), MAT.red())]);

  return { engines, ENG };
}
