// UH-60M power and drive: two GE T700-GE-701D turboshafts (integral inlet particle separators,
// IR suppressors), the modular main transmission (two input modules, two accessory modules and
// the main module), engine output shafts, rotor brake, oil cooler, the tail drive shaft and its
// hanger bearings, the APU and the engine fire bottles.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { lathe, loftRings } from '../../engine/geometry.js';
import { MAT, DEG, V3, merge, box, cyl, tube, pipe, place, mirror, TAIL } from './common.js';

const ENG = { y: 2.58, z: 0.76, front: -0.55, rear: -1.74 };

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
    system: 'Drive system', material: 'Magnesium/aluminium case, spiral-bevel and planetary steel gears', mass: 480, explode: [0, 1.5, 0],
    desc: 'Combines both engines\' power at a spiral-bevel ring gear and reduces it through a planetary stage to the 258 rpm rotor shaft — an overall reduction of about 81 : 1 from the engines\' 20,900 rpm. Rated at 3,400 shp with both engines.',
    callout: true, anchor: [cx, 2.78, 0.35],
  }, [mesh(merge(caseG), MAT.casting())]);

  for (const side of [1, -1]) {
    const s = side;
    const g = [
      cyl(0.14, 0.14, 0.36, [0.12, 2.55, 0.55 * s], 'x', 22),
      tube([0.05, 2.52, 0.5 * s], [cx + 0.1, 2.45, 0.28 * s], 0.12, 18),
      cyl(0.09, 0.12, 0.08, [-0.1, 2.55, 0.55 * s], 'x', 18),
    ];
    P(side > 0 ? 'Input module (right)' : 'Input module (left)', {
      system: 'Drive system', material: 'Aluminium case, bevel gears, freewheel (overrunning) clutch', mass: 62, explode: [0.3, 1.4, 1.0 * s],
      desc: 'Turns the engine\'s drive through a bevel gear set into the main module and contains the freewheel clutch, so a failed engine is disconnected automatically and the rotor keeps turning on the other engine or in autorotation.',
    }, [mesh(merge(g), MAT.casting())]);
    P(side > 0 ? 'Accessory module (right)' : 'Accessory module (left)', {
      system: 'Drive system', material: 'Aluminium gearbox', mass: 40, explode: [1.0, 1.3, 1.0 * s],
      desc: 'Bolted to the front of the input module and driven whenever the rotor turns, it runs a generator and a hydraulic pump — so electrical and hydraulic power continue even with both engines out in autorotation.',
    }, [mesh(merge([cyl(0.12, 0.12, 0.26, [0.43, 2.55, 0.55 * s], 'x', 20), box(0.2, 0.2, 0.18, [0.4, 2.5, 0.55 * s])]), MAT.casting())]);
  }
  // engine output (high-speed) shafts with diaphragm couplings
  for (const side of [1, -1]) {
    const a = V3(ENG.front + 0.02, ENG.y, ENG.z * side), b = V3(-0.12, 2.55, 0.55 * side);
    P(side > 0 ? 'Engine output shaft (right)' : 'Engine output shaft (left)', {
      system: 'Drive system', material: 'Steel shaft with flexible diaphragm couplings', mass: 9, explode: [0.6, 1.2, 1.25 * side],
      desc: 'Runs from the front of the engine through the centre of its inlet to the input module at 20,900 rpm; diaphragm couplings absorb misalignment as the engine and gearbox move on their mounts.',
    }, [mesh(merge([tube(a, b, 0.035, 12), cyl(0.07, 0.07, 0.04, [a.x - 0.04, a.y, a.z], 'x', 16), cyl(0.07, 0.07, 0.04, [b.x - 0.04, b.y, b.z], 'x', 16)]), MAT.steel())]);
  }

  // ------------------------------------------------------------------ engines
  const engines = [];
  for (const side of [1, -1]) {
    const s = side, z = ENG.z * s;
    const L = ENG.front - ENG.rear;
    const core = latheX([
      [0.001, 0], [0.16, 0], [0.22, 0.04], [0.25, 0.14], [0.27, 0.3], [0.27, 0.45], [0.24, 0.55], [0.22, 0.7], [0.23, 0.82], [0.27, 0.9], [0.28, 1.0], [0.26, L], [0.001, L],
    ], 36);
    core.translate(ENG.rear, ENG.y, z);
    const acc = box(0.38, 0.13, 0.2, [ENG.front - 0.36, ENG.y + 0.3, z]);
    const lines = [pipe([[ENG.front - 0.2, ENG.y + 0.27, z + 0.1 * s], [ENG.front - 0.6, ENG.y + 0.2, z + 0.24 * s], [ENG.front - 1.0, ENG.y + 0.02, z + 0.27 * s]], 0.012), pipe([[ENG.front - 0.3, ENG.y + 0.25, z - 0.12 * s], [ENG.front - 0.8, ENG.y + 0.22, z - 0.2 * s], [ENG.front - 1.1, ENG.y + 0.1, z - 0.26 * s]], 0.01)];
    const eng = P(side > 0 ? 'T700-GE-701D engine (right)' : 'T700-GE-701D engine (left)', {
      system: 'Propulsion', material: 'Steel/titanium cold section, nickel-alloy hot section', mass: 207, massSource: 'GE Aviation T700-701D datasheet (456 lb dry)', explode: [0, 1.1, 1.7 * s],
      desc: 'Front-drive turboshaft: five axial and one centrifugal compressor stages (17 : 1), an annular combustor, a two-stage gas-generator turbine and a two-stage free power turbine whose shaft runs forward through the core. 1,994 shp for 10 minutes, 1,716 shp continuous.',
      callout: side > 0, anchor: [-1.1, ENG.y + 0.42, z],
    }, [mesh(merge([core, acc]), MAT.darkMetal()), mesh(merge(lines), MAT.copper())]);
    eng.userData.part.thermalRole = 'engine';
    engines.push(eng);

    // inlet particle separator: swirl vanes in the annulus, scroll case and blower
    const vanes = [];
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2;
      const v = new THREE.BoxGeometry(0.06, 0.12, 0.008);
      v.rotateY(0.6);
      v.translate(0, 0.2, 0);
      v.rotateX(a);
      v.translate(ENG.front + 0.06, ENG.y, z);
      vanes.push(v);
    }
    const ipsG = [
      cyl(0.31, 0.31, 0.2, [ENG.front + 0.02, ENG.y, z], 'x', 32, true),
      cyl(0.13, 0.16, 0.22, [ENG.front + 0.05, ENG.y, z], 'x', 24),
      place(lathe([[0.13, 0], [0.12, 0.02], [0.06, 0.1], [0.001, 0.12]], 20), [ENG.front + 0.16, ENG.y, z], [0, 0, -Math.PI / 2]),
      cyl(0.08, 0.08, 0.14, [ENG.front - 0.12, ENG.y - 0.24, z + 0.16 * s], 'z', 16),     // scavenge blower
      ...vanes,
    ];
    P(side > 0 ? 'Inlet particle separator (right)' : 'Inlet particle separator (left)', {
      system: 'Propulsion', material: 'Steel swirl vanes, aluminium scroll case, electric-free scavenge blower', mass: 14, explode: [0.8, 1.1, 1.7 * s],
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
      desc: 'The hover infrared suppressor (HIRSS) mixes cool ambient air into the ~550 °C exhaust and turns it outboard and up, away from heat-seeking missiles below, so neither the plume nor the duct walls glow hot in the infrared.',
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
    fw.push(box(1.5, 0.42, 0.02, [-1.15, 2.5, 0.37 * s]));
    for (const x of [ENG.front - 0.1, ENG.rear + 0.2]) fw.push(tube([x, 2.29, 0.5 * s], [x, ENG.y - 0.2, ENG.z * s], 0.02), tube([x, 2.29, 0.98 * s], [x, ENG.y - 0.2, ENG.z * s], 0.02));
  }
  fw.push(box(1.4, 0.03, 1.5, [-0.05, 2.3, 0]));     // transmission deck plate
  for (const [x, z] of [[0.42, 0.44], [0.42, -0.44], [-0.5, 0.44], [-0.5, -0.44]]) fw.push(box(0.14, 0.1, 0.14, [x, 2.34, z]));
  P('Upper deck, firewalls & mounts', {
    system: 'Structure', material: 'Titanium firewalls, steel engine mount links, transmission mounting pads', mass: 95, explode: [0, 1.0, 0],
    desc: 'The deck above the cabin roof carries the transmission on four pads and each engine on tubular links; titanium firewalls separate the engines from the gearbox and from each other.',
  }, [mesh(merge(fw), MAT.titanium())]);

  // ------------------------------------------------------------------ tail take-off, brake, oil cooler, tail shafts
  const tto = V3(cx - 0.62, 2.45, 0);
  P('Rotor brake', {
    system: 'Drive system', material: 'Steel disc, hydraulic caliper', mass: 12, explode: [-0.4, 1.2, 0],
    desc: 'A hydraulic disc brake on the tail take-off stops the rotor after shutdown and holds it while the engines are started with the rotor locked.',
  }, [mesh(merge([cyl(0.15, 0.15, 0.02, [tto.x - 0.02, tto.y, 0], 'x', 28), box(0.09, 0.12, 0.08, [tto.x - 0.02, tto.y + 0.14, 0])]), MAT.steel())]);
  P('Transmission oil cooler & blower', {
    system: 'Drive system', material: 'Aluminium heat exchanger, axial blower', mass: 26, explode: [-0.6, 1.5, 0],
    desc: 'The first section of tail drive shaft spins an axial blower that pulls air through the transmission oil cooler, so the gearbox stays cool whenever the rotor turns.',
  }, [mesh(merge([cyl(0.17, 0.17, 0.42, [-1.3, 2.43, 0], 'x', 28), box(0.36, 0.18, 0.5, [-1.3, 2.62, 0])]), MAT.casting())]);

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
  }, [mesh(merge([cyl(0.14, 0.14, 0.55, [-2.35, 2.44, -0.19], 'x', 22), cyl(0.09, 0.09, 0.2, [-2.0, 2.44, -0.19], 'x', 18), tube([-2.66, 2.44, -0.19], [-2.82, 2.6, -0.2], 0.07, 14)]), MAT.darkMetal())]).userData.part.thermalRole = 'apu';
  P('Engine fire extinguisher bottles', {
    system: 'Propulsion', material: 'Steel spheres charged with halon-replacement agent', mass: 12, count: 2, explode: [-0.4, 1.9, 0.5],
    desc: 'Two bottles that can be discharged into either engine bay from the cockpit fire handles — a main and a reserve shot.',
  }, [mesh(merge([new THREE.SphereGeometry(0.09, 16, 12).translate(-0.95, 2.4, 0.3), new THREE.SphereGeometry(0.09, 16, 12).translate(-0.95, 2.4, -0.3)]), MAT.red())]);

  return { engines, ENG };
}
