// UH-60M crew stations and onboard systems: glass cockpit (four multifunction displays, flight-
// management CDUs), armoured crashworthy seats, cyclic/collective/pedals, the cabin with stroking
// troop seats and crew-chief stations, window gun mounts, wire-strike protection, flight-control
// runs and mixing, hydraulics, electrical generation and distribution, avionics, antennas,
// air-data probes, environmental control.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { MAT, V3, merge, box, cyl, tube, pipe, place } from './common.js';

/** A blade antenna standing on point p with its root along the surface normal n. */
function bladeAntenna(p, n, h = 0.22, c = 0.26) {
  // swept blade in the x–y plane (chord fore-aft), stood up along the normal (a rotation about x)
  const sh = new THREE.Shape();
  sh.moveTo(c / 2, 0); sh.lineTo(-c / 2, 0); sh.lineTo(-c * 0.3, h); sh.lineTo(-c * 0.05, h); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.018, bevelEnabled: false }).translate(0, 0, -0.009);
  const nn = V3(0, n.y, n.z).normalize();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), nn));
  g.translate(p.x, p.y, p.z);
  return g;
}

/** Sling seat: aluminium tube frame, fabric pan and back, energy-absorber straps to the ceiling. */
function slingSeat(x, z, facing = 1, ceiling = 1.98, floor = 0.62) {
  const f = facing;
  const frame = [
    tube([x - 0.2 * f, floor + 0.42, z - 0.21], [x + 0.22 * f, floor + 0.42, z - 0.21], 0.012, 6),
    tube([x - 0.2 * f, floor + 0.42, z + 0.21], [x + 0.22 * f, floor + 0.42, z + 0.21], 0.012, 6),
    tube([x - 0.2 * f, floor + 0.42, z - 0.21], [x - 0.22 * f, floor + 0.98, z - 0.21], 0.012, 6),
    tube([x - 0.2 * f, floor + 0.42, z + 0.21], [x - 0.22 * f, floor + 0.98, z + 0.21], 0.012, 6),
    tube([x + 0.18 * f, floor, z - 0.2], [x + 0.18 * f, floor + 0.42, z - 0.21], 0.012, 6),
    tube([x + 0.18 * f, floor, z + 0.2], [x + 0.18 * f, floor + 0.42, z + 0.21], 0.012, 6),
    tube([x - 0.22 * f, floor + 0.98, z - 0.15], [x - 0.24 * f, ceiling, z - 0.15], 0.01, 6),
    tube([x - 0.22 * f, floor + 0.98, z + 0.15], [x - 0.24 * f, ceiling, z + 0.15], 0.01, 6),
    cyl(0.025, 0.025, 0.18, [x - 0.24 * f, ceiling - 0.25, z - 0.15], 'y', 8),
    cyl(0.025, 0.025, 0.18, [x - 0.24 * f, ceiling - 0.25, z + 0.15], 'y', 8),
  ];
  const fabric = [box(0.42, 0.03, 0.42, [x + 0.01 * f, floor + 0.43, z]), place(new THREE.BoxGeometry(0.03, 0.55, 0.42), [x - 0.21 * f, floor + 0.71, z], [0, 0, 0.04 * f])];
  return { frame, fabric };
}

export function buildCabin({ A, P, surfPoint, surfNormal }) {
  const handles = {};
  const fl = 0.66;   // cockpit floor

  // ------------------------------------------------------------------ cockpit
  const seatF = [], seatA = [];
  for (const z of [0.53, -0.53]) {
    const x = 2.78;
    seatF.push(box(0.5, 0.09, 0.5, [x, 1.0, z]), place(new THREE.BoxGeometry(0.1, 0.78, 0.5), [x - 0.27, 1.42, z], [0, 0, -0.12]), box(0.08, 0.16, 0.36, [x - 0.33, 1.9, z]));
    seatF.push(tube([x - 0.34, fl, z - 0.18], [x - 0.34, 2.0, z - 0.18], 0.025, 8), tube([x - 0.34, fl, z + 0.18], [x - 0.34, 2.0, z + 0.18], 0.025, 8), box(0.35, 0.3, 0.06, [x, 0.8, z]));
    const out = Math.sign(z);
    seatA.push(box(0.46, 0.5, 0.03, [x, 1.3, z + out * 0.28]), box(0.06, 0.65, 0.48, [x - 0.36, 1.4, z]));
  }
  P('Armoured crashworthy pilot seats', {
    system: 'Crew systems', material: 'Composite armour (boron-carbide class) bucket, energy-absorbing stroke guides', mass: 150, count: 2, explode: [0.6, 1.4, 0],
    desc: 'Each seat rides on vertical guides with energy absorbers: in a crash it strokes down about 0.3 m, holding the pilot\'s spinal load to survivable levels. Ceramic-composite armour shields the bucket and a sliding side panel.',
    callout: true, anchor: [2.5, 1.95, 0.53],
  }, [mesh(merge(seatF), MAT.seat()), mesh(merge(seatA), MAT.armour())]);

  const panelG = [place(new THREE.BoxGeometry(0.06, 0.52, 1.92), [3.72, 1.2, 0], [0, 0, 0.22]), box(0.24, 0.05, 1.96, [3.66, 1.47, 0])];
  const mfd = [], bezel = [];
  for (const z of [-0.75, -0.3, 0.3, 0.75]) {
    const g = new THREE.PlaneGeometry(0.17, 0.22).rotateY(-Math.PI / 2).rotateZ(0.22).translate(3.676, 1.2, z);
    mfd.push(g);
    bezel.push(place(new THREE.BoxGeometry(0.03, 0.27, 0.22), [3.7, 1.2, z], [0, 0, 0.22]));
  }
  bezel.push(place(new THREE.BoxGeometry(0.03, 0.09, 0.09), [3.7, 1.36, 0], [0, 0, 0.22]));
  P('Instrument panel & multifunction displays', {
    system: 'Crew systems', material: 'Four 6 × 8 in active-matrix LCD multifunction displays, standby instrument, glareshield', mass: 55, explode: [1.6, 0.9, 0],
    desc: 'The M model\'s glass cockpit: four multifunction displays show flight, engine, navigation and moving-map pages, replacing dozens of round gauges; one standby instrument backs them up.',
    callout: true, anchor: [3.66, 1.55, -0.3],
  }, [mesh(merge(panelG), MAT.black()), mesh(merge(bezel), MAT.avionics()), mesh(merge(mfd), MAT.screen(), { cast: false })]);
  const cdu = [new THREE.PlaneGeometry(0.13, 0.1).rotateX(-Math.PI / 2).rotateZ(0.6).translate(3.3, 1.04, 0.0)];
  P('Centre console & flight-management CDUs', {
    system: 'Crew systems', material: 'Console with two control-display units, radio and AFCS panels', mass: 18, explode: [1.2, 0.6, 0],
    desc: 'Between the seats: two control-display units for the dual flight-management system, plus radio, transponder and flight-director controls.',
  }, [mesh(merge([place(new THREE.BoxGeometry(0.62, 0.32, 0.32), [3.25, 0.88, 0], [0, 0, 0.25]), box(0.24, 0.1, 0.3, [3.55, 1.08, 0])]), MAT.black()), mesh(merge(cdu), MAT.screenAmber(), { cast: false })]);
  P('Overhead console', {
    system: 'Crew systems', material: 'Circuit-breaker and switch panels', mass: 9, explode: [0.8, 1.2, 0],
    desc: 'Engine control levers, fuel, electrical and lighting switches and the circuit breakers, within reach of both pilots overhead.',
  }, [mesh(merge([box(0.55, 0.08, 0.5, [2.95, 2.12, 0]), box(0.12, 0.05, 0.28, [3.12, 2.06, 0])]), MAT.black())]);

  // cyclic, collective, pedals (animated)
  const cyclics = [], collectives = [], pedals = [];
  const cycG = merge([cyl(0.016, 0.02, 0.6, [0, 0.3, 0], 'y', 10), box(0.05, 0.12, 0.04, [0.015, 0.64, 0])]);
  const colG = merge([tube([0, 0, 0], [0.48, 0.07, 0], 0.018, 8), place(new THREE.BoxGeometry(0.14, 0.05, 0.05), [0.5, 0.08, 0], [0, 0, 0.1])]);
  const cycPart = P('Cyclic sticks', {
    system: 'Flight controls', material: 'Aluminium sticks with trim and weapons-free grips', mass: 6, count: 2, explode: [0.6, 0.5, 0],
    desc: 'Moving the stick tilts the swashplate and hence the rotor disc: forward to accelerate, sideways to roll. It moves the swashplate through the mixing unit and primary servos — there is no direct cable to any one blade.',
  }, []);
  for (const z of [0.53, -0.53]) {
    const g = new THREE.Group(); g.position.set(3.2, 0.68, z); g.add(mesh(cycG, MAT.black()));
    cycPart.add(g); cyclics.push(g);
  }
  const colPart = P('Collective levers', {
    system: 'Flight controls', material: 'Aluminium levers with throttle-trim grips', mass: 5, count: 2, explode: [0.2, 0.5, 0],
    desc: 'Raising the collective lifts the whole swashplate, adding pitch to all four blades at once: more thrust to climb, more torque for the tail rotor to cancel.',
  }, []);
  for (const z of [0.23, -0.83]) {
    const g = new THREE.Group(); g.position.set(2.6, 0.84, z); g.add(mesh(colG, MAT.black()));
    colPart.add(g); collectives.push(g);
  }
  const pedPart = P('Tail rotor pedals', {
    system: 'Flight controls', material: 'Adjustable pedal assemblies with toe brakes', mass: 6, count: 2, explode: [0.9, 0.3, 0],
    desc: 'Pedals change tail-rotor pitch to point the nose; the toe tops work the wheel brakes on the ground.',
  }, []);
  for (const z of [0.53, -0.53]) {
    for (const dz of [0.12, -0.12]) {
      const g = new THREE.Group(); g.position.set(3.74, 0.84, z + dz);
      g.add(mesh(merge([box(0.03, 0.18, 0.1, [0, 0, 0]), tube([0, -0.08, 0], [-0.15, -0.16, 0], 0.012, 6)]), MAT.darkMetal()));
      pedPart.add(g); pedals.push({ g, side: Math.sign(dz) });
    }
  }
  handles.cyclics = cyclics; handles.collectives = collectives; handles.pedals = pedals;

  // ------------------------------------------------------------------ cabin
  const sf = [], sfab = [];
  const add = (s) => { sf.push(...s.frame); sfab.push(...s.fabric); };
  for (const z of [-0.78, -0.26, 0.26, 0.78]) add(slingSeat(-1.48, z, 1));
  for (const z of [-0.78, -0.26, 0.26, 0.78]) add(slingSeat(-0.35, z, 1));
  for (const z of [-0.52, 0, 0.52]) add(slingSeat(1.2, z, -1));
  P('Troop seats', {
    system: 'Crew systems', material: 'Aluminium tube frames, nylon fabric, wire-bender energy absorbers', mass: 110, count: 11, explode: [0, 1.0, 0],
    desc: 'Eleven crashworthy troop seats hang from the cabin ceiling; in a crash wire-bending energy absorbers let each seat stroke downward so the occupant is not hit by the full deceleration. They fold to clear the floor for cargo or four litters. (Layout varies by configuration.)',
    callout: true, anchor: [-0.35, 1.7, 0.78],
  }, [mesh(merge(sf), MAT.structure()), mesh(merge(sfab), MAT.fabric())]);
  const cc = [], ccf = [];
  for (const s of [1, -1]) {
    const seat = slingSeat(1.86, 0.62 * s, 1);
    for (const g of [...seat.frame, ...seat.fabric]) { g.translate(-1.86, 0, -0.62 * s); g.rotateY(-s * Math.PI / 2); g.translate(1.86, 0, 0.62 * s); }
    cc.push(...seat.frame); ccf.push(...seat.fabric);
  }
  P('Crew chief & gunner seats', {
    system: 'Crew systems', material: 'Crashworthy stroking seats', mass: 30, count: 2, explode: [0.3, 0.8, 0],
    desc: 'At the front of the cabin, facing outboard at the gunner windows: the crew chief and gunner watch the tail rotor and the landing zone, call clearances to the pilots and man the window guns.',
  }, [mesh(merge(cc), MAT.structure()), mesh(merge(ccf), MAT.fabric())]);
  const gm = [];
  for (const s of [1, -1]) {
    const z = 1.12 * s;
    gm.push(cyl(0.025, 0.025, 0.3, [1.87, 1.25, z], 'y', 10), tube([1.87, 1.4, z], [1.87, 1.42, z + 0.28 * s], 0.022, 8), box(0.16, 0.06, 0.1, [1.87, 1.45, z + 0.32 * s]));
  }
  P('Window gun mounts', {
    system: 'Weapons', material: 'Steel pintle arms', mass: 14, count: 2, explode: [0.3, 0.4, 1.0],
    desc: 'Swing-out pintle mounts at the gunner windows for a 7.62 mm M240H machine gun on each side (guns not shown); they stow inboard when not in use.',
  }, [mesh(merge(gm), MAT.darkMetal())]);

  // ------------------------------------------------------------------ wire-strike protection
  const roofP = surfPoint(2.95, Math.PI / 2);
  const ws = [
    place(new THREE.BoxGeometry(0.42, 0.04, 0.03), [roofP.x + 0.05, roofP.y + 0.2, 0], [0, 0, -0.75]),
    tube([roofP.x - 0.1, roofP.y, 0], [roofP.x + 0.15, roofP.y + 0.32, 0], 0.02, 6),
    box(0.06, 0.06, 0.1, [roofP.x - 0.1, roofP.y + 0.02, 0]),
  ];
  const post = [];
  for (let i = 0; i <= 8; i++) post.push(surfPoint(3.4 + i * 0.09, Math.PI / 2, 0.025));
  ws.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(post), 16, 0.012, 5));
  const chin = surfPoint(4.1, -Math.PI / 2);
  ws.push(place(new THREE.BoxGeometry(0.38, 0.04, 0.03), [chin.x + 0.02, chin.y - 0.15, 0], [0, 0, 0.75]), tube([chin.x - 0.12, chin.y, 0], [chin.x + 0.14, chin.y - 0.3, 0], 0.02, 6));
  P('Wire strike protection system', {
    system: 'Structure', material: 'Hardened steel cutter blades and deflectors', mass: 12, explode: [1.2, 0.8, 0],
    desc: 'Low flying means wires. An upper cutter on the cockpit roof, a deflector down the windshield post and a lower cutter under the nose guide a wire into the blades and cut it before it can snag the rotor head or landing gear.',
  }, [mesh(merge(ws), MAT.steel())]);

  // ------------------------------------------------------------------ flight-control runs
  P('Mixing unit', {
    system: 'Flight controls', material: 'Mechanical bellcrank and walking-beam assembly', mass: 14, explode: [0.6, 1.9, 0],
    desc: 'Mechanically blends the pilot\'s inputs: collective into tail-rotor pitch (to cancel the extra torque), collective into lateral and fore-aft cyclic, and yaw into pitch, so the pilot does not have to make those corrections by hand.',
  }, [mesh(merge([box(0.42, 0.2, 0.36, [1.35, 2.43, -0.05]), cyl(0.03, 0.03, 0.42, [1.35, 2.55, -0.05], 'z', 8)]), MAT.casting())]);
  P('Pilot-assist servos (SAS, trim, boost)', {
    system: 'Flight controls', material: 'Hydraulic boost servos, SAS actuators, electric trim actuators', mass: 22, explode: [0.9, 1.9, 0],
    desc: 'Between the cockpit controls and the mixing unit: boost servos lighten the stick forces, and the stability-augmentation and trim actuators let the digital AFCS hold attitude, heading and altitude.',
  }, [mesh(merge([cyl(0.04, 0.04, 0.3, [1.85, 2.42, -0.35], 'x', 12), cyl(0.04, 0.04, 0.3, [1.85, 2.42, -0.2], 'x', 12), cyl(0.04, 0.04, 0.3, [1.85, 2.42, -0.05], 'x', 12), box(0.2, 0.12, 0.45, [2.05, 2.4, -0.2])]), MAT.hydraulic())]);
  const runs = [];
  for (const z of [0.53, -0.53]) runs.push(pipe([[3.2, 0.6, z], [2.6, 0.6, z], [2.35, 0.64, -0.92], [2.3, 1.2, -0.95], [2.3, 2.05, -0.9], [2.1, 2.35, -0.5], [1.9, 2.42, -0.3]], 0.012));
  runs.push(pipe([[1.15, 2.45, -0.05], [0.6, 2.42, 0.1], [0.42, 2.36, 0.0]], 0.012), pipe([[1.15, 2.42, -0.1], [0.6, 2.38, -0.3], [0.0, 2.33, -0.43]], 0.012));
  P('Flight-control rods & bellcranks', {
    system: 'Flight controls', material: 'Aluminium push-pull tubes, bellcranks, duplicated where single failures matter', mass: 28, explode: [0.5, 1.3, -0.6],
    desc: 'Rigid push-pull tubes run from the cockpit controls up a closet behind the copilot to the upper deck, through the pilot-assist servos and mixing unit to the primary servos.',
  }, [mesh(merge(runs), MAT.structure())]);
  const cab = [];
  for (const dz of [0.05, 0.1]) {
    const pts = [[1.2, 2.4, dz], [-0.8, 2.33, dz + 0.1], [-3.6, 2.12, dz]];
    for (let x = -4.4; x >= -8.2; x -= 0.95) pts.push([x, 1.98 - (x + 4.4) * -0.015, dz]);
    pts.push([-8.9, 2.25, -0.05], [-9.4, 2.7, -0.2], [-9.75, 2.95, -0.32]);
    cab.push(pipe(pts, 0.006, 4));
  }
  P('Tail rotor control cables', {
    system: 'Flight controls', material: 'Stainless-steel cables over pulleys, quadrant at the tail servo', mass: 6, explode: [-1.6, 0.9, 0],
    desc: 'Pedal and mixing-unit inputs run aft along the tail cone as a pair of cables to the tail-rotor servo in the pylon — light, and tolerant of the tail cone flexing.',
  }, [mesh(merge(cab), MAT.steel())]);

  // ------------------------------------------------------------------ hydraulics
  const pumps = [];
  for (const s of [1, -1]) pumps.push(cyl(0.07, 0.07, 0.2, [0.44, 2.36, 0.55 * s], 'x', 14), box(0.14, 0.12, 0.12, [0.3, 2.38, 0.55 * s]));
  P('Hydraulic pump modules (No. 1 & No. 2)', {
    system: 'Hydraulics', material: 'Variable-delivery piston pumps with integral reservoirs and filters', mass: 24, count: 2, explode: [1.2, 1.0, 0],
    desc: 'One pump module on each accessory module, ≈3,000 psi (21 MPa). Driven by the transmission, they keep working in autorotation; No. 1 feeds the primary servos\' first stages, No. 2 the second stages and the tail-rotor servo.',
  }, [mesh(merge(pumps), MAT.hydraulic())]);
  P('Backup hydraulic pump', {
    system: 'Hydraulics', material: 'AC-motor-driven pump and accumulator', mass: 20, explode: [-0.5, 1.6, 0.6],
    desc: 'An electric pump that takes over automatically if either primary system fails, and powers the controls on the ground for checks with the rotor stopped.',
  }, [mesh(merge([cyl(0.08, 0.08, 0.26, [-1.25, 2.38, 0.27], 'x', 14), box(0.16, 0.14, 0.14, [-1.05, 2.38, 0.27]), new THREE.SphereGeometry(0.07, 12, 10).translate(-1.45, 2.4, 0.27)]), MAT.hydraulic())]);
  const hl = [];
  for (const s of [1, -1]) hl.push(pipe([[0.44, 2.3, 0.55 * s], [0.25, 2.3, 0.45 * s], [0.0, 2.32, 0.45 * s], [-0.45, 2.33, 0.1 * s]], 0.01));
  hl.push(pipe([[0.44, 2.3, 0.55], [0.4, 2.31, 0.0], [0.39, 2.33, -0.05]], 0.01));
  const tailLine = [[-1.25, 2.3, 0.2], [-3.0, 2.12, 0.18], [-5.0, 1.98, 0.16], [-7.5, 1.88, 0.14], [-8.9, 2.3, 0.0], [-9.7, 2.9, -0.28]];
  hl.push(pipe(tailLine, 0.008));
  P('Hydraulic lines', {
    system: 'Hydraulics', material: 'Stainless/titanium tubing and flexible hoses', mass: 18, explode: [0, 1.4, 0.5],
    desc: 'Three independent systems with no fluid shared between them, routed apart so that a single hit or leak cannot take out control of the main rotor.',
  }, [mesh(merge(hl), MAT.hydraulic())]);

  // ------------------------------------------------------------------ electrical
  P('AC generators', {
    system: 'Electrical', material: 'Two 30/45 kVA, 115 V 400 Hz brushless generators', mass: 32, count: 2, explode: [1.6, 1.2, 0],
    desc: 'One on each accessory module, so they turn with the rotor whether or not the engines run. The APU drives a third generator on the ground.',
  }, [mesh(merge([cyl(0.1, 0.1, 0.26, [0.68, 2.55, 0.55], 'x', 18), cyl(0.1, 0.1, 0.26, [0.68, 2.55, -0.55], 'x', 18)]), MAT.casting())]);
  P('Main battery', {
    system: 'Electrical', material: '24 V sealed battery (location approximate)', mass: 36, explode: [1.6, -0.3, 0.6],
    desc: 'Starts the APU and keeps essential instruments alive if all generators fail. (Exact bay location varies with configuration; shown in the nose bay.)',
  }, [mesh(box(0.26, 0.22, 0.3, [4.38, 0.86, 0.3]), MAT.black())]);
  P('Power distribution & converters', {
    system: 'Electrical', material: 'Circuit-breaker panels, AC/DC converters (transformer-rectifiers)', mass: 30, explode: [0.8, 0.8, 0],
    desc: 'Converters turn 115 V AC into 28 V DC; AC and DC buses are split so that losing one generator or converter sheds only non-essential loads.',
  }, [mesh(merge([box(0.3, 0.18, 0.4, [2.0, 1.88, 0.55]), box(0.3, 0.18, 0.4, [2.0, 1.88, -0.55]), box(0.25, 0.14, 0.3, [-2.3, 1.62, 0.6])]), MAT.avionics())]);
  const wires = [];
  for (const s of [1, -1]) {
    wires.push(pipe([[3.9, 1.0, 0.7 * s], [3.0, 1.9, 0.95 * s], [2.0, 1.95, 0.95 * s], [-1.7, 1.95, 0.95 * s], [-2.3, 1.75, 0.75 * s]], 0.016));
  }
  const tw = [];
  for (let x = -2.4; x >= -8.6; x -= 0.6) tw.push([x, 2.0 + (x + 2.4) * 0.008, -0.22]);
  wires.push(pipe(tw, 0.012));
  P('Wiring harnesses', {
    system: 'Electrical', material: 'Shielded wiring bundles', mass: 60, explode: [0, 0.7, 0],
    desc: 'Several kilometres of wire run along the cabin roof and down the tail cone; critical circuits are duplicated and routed apart for survivability.',
  }, [mesh(merge(wires), MAT.wiring())]);

  // ------------------------------------------------------------------ avionics
  const rack = (boxes) => merge(boxes.map(([x, y, z, w, h, d]) => box(w, h, d, [x, y, z])));
  P('Flight management & display computers', {
    system: 'Avionics', material: 'Dual flight-management computers and display generators', mass: 22, count: 2, explode: [1.9, 0.5, 0],
    desc: 'Dual computers drive the four displays and run navigation, fuel planning and moving maps — the heart of the M model\'s common avionics architecture.',
  }, [mesh(rack([[4.32, 1.22, 0.24, 0.3, 0.16, 0.22], [4.32, 1.22, -0.24, 0.3, 0.16, 0.22]]), MAT.avionics())]);
  P('Embedded GPS/INS units', {
    system: 'Avionics', material: 'Two ring-laser-gyro inertial units with embedded GPS receivers', mass: 18, count: 2, explode: [2.1, 0.2, 0],
    desc: 'Two embedded GPS/inertial units give position, attitude and heading for the displays and autopilot; either can do the job alone.',
  }, [mesh(rack([[4.5, 0.95, 0.18, 0.2, 0.17, 0.2], [4.5, 0.95, -0.18, 0.2, 0.17, 0.2]]), MAT.avionics())]);
  P('Digital AFCS computers', {
    system: 'Avionics', material: 'Dual flight-control computers', mass: 12, count: 2, explode: [1.8, 0.0, 0],
    desc: 'The digital automatic flight control system: stability augmentation, attitude and altitude hold and coupled approaches to a hover, through the pilot-assist servos.',
  }, [mesh(rack([[4.25, 0.86, -0.3, 0.26, 0.16, 0.2], [4.25, 0.86, -0.06, 0.26, 0.16, 0.2]]), MAT.avionics())]);
  P('Communication radios & IFF', {
    system: 'Communications', material: 'VHF/UHF/FM (SINCGARS) and HF radios, IFF transponder', mass: 40, explode: [-0.9, 0.9, 0],
    desc: 'Radios on a shelf behind the cabin: secure VHF-FM for ground troops, VHF/UHF (including satellite) for aviation and HF for long range, plus an IFF transponder.',
  }, [mesh(rack([[-2.15, 1.72, -0.25, 0.32, 0.18, 0.3], [-2.15, 1.72, 0.12, 0.32, 0.18, 0.3], [-2.5, 1.7, -0.1, 0.3, 0.16, 0.36], [-2.15, 1.58, -0.05, 0.6, 0.02, 0.9]]), MAT.avionics())]);
  P('Health monitoring & data recorders', {
    system: 'Avionics', material: 'Health and usage monitoring unit, crash-survivable recorder', mass: 12, explode: [-1.2, 1.1, 0.5],
    desc: 'Vibration sensors on the drive train feed a health-and-usage monitoring unit that flags wearing bearings and gears before they fail; a crash-protected recorder keeps flight data and cockpit audio.',
  }, [mesh(rack([[-2.62, 1.68, 0.4, 0.22, 0.16, 0.2]]), MAT.avionics()), mesh(box(0.18, 0.14, 0.14, [-2.62, 1.84, 0.4]), MAT.red())]);

  // ------------------------------------------------------------------ antennas & sensors
  const ant = [];
  for (const [x, a] of [[2.45, 1.2], [2.45, Math.PI - 1.2], [1.0, -1.45], [-0.6, -1.65], [-1.4, -1.57], [-4.8, Math.PI / 2 + 0.55]]) {
    ant.push(bladeAntenna(surfPoint(x, a, -0.004), surfNormal(x, a), 0.22, 0.26));
  }
  P('VHF/UHF/FM blade antennas', {
    system: 'Communications', material: 'Composite blade antennas', mass: 8, count: 6, explode: [0, 0.6, 0],
    desc: 'Blade antennas on the roof, belly and tail cone for the radios, IFF and FM homing; spaced so they do not shadow each other.',
  }, [mesh(merge(ant), MAT.paintDark())]);
  const hf = [];
  const hfPts = [];
  for (let x = -3.8; x >= -7.6; x -= 0.4) hfPts.push(surfPoint(x, 0.25, 0.1));
  hf.push(pipe(hfPts, 0.012, 6));
  for (const x of [-3.8, -5.7, -7.6]) hf.push(tube(surfPoint(x, 0.25), surfPoint(x, 0.25, 0.1), 0.012, 6));
  P('HF towel-bar antenna', {
    system: 'Communications', material: 'Aluminium rail on insulated standoffs', mass: 4, explode: [-2.2, 0, 0.7],
    desc: 'The rail along the right side of the tail cone is the HF radio\'s antenna, for communication far beyond line of sight.',
  }, [mesh(merge(hf), MAT.steel())]);
  P('GPS & SATCOM antennas', {
    system: 'Communications', material: 'Flush patch antennas', mass: 3, count: 3, explode: [-0.6, 2.4, 0],
    desc: 'Patch antennas on top of the aft fairing see the sky: two for the embedded GPS units and one for satellite communications.',
  }, [mesh(merge([cyl(0.07, 0.07, 0.02, [-2.0, 2.645, 0.14], 'y', 16), cyl(0.07, 0.07, 0.02, [-2.0, 2.645, -0.14], 'y', 16), cyl(0.1, 0.1, 0.025, [-2.7, 2.56, 0], 'y', 18)]), MAT.radome())]);
  const ra = [];
  for (const x of [-4.4, -4.9]) { const p = surfPoint(x, -Math.PI / 2); ra.push(box(0.16, 0.02, 0.16, [p.x, p.y - 0.008, 0])); }
  P('Radar altimeter antennas', {
    system: 'Sensors', material: 'Transmit and receive patch antennas', mass: 2, count: 2, explode: [-2.2, -0.8, 0],
    desc: 'One transmits and one receives a radio signal off the ground below, giving true height above terrain for low-level flight and hover hold.',
  }, [mesh(merge(ra), MAT.paintDark())]);
  const pit = [];
  for (const z of [0.28, -0.28]) {
    const p = surfPoint(3.15, Math.PI / 2 - Math.sign(z) * 0.28);
    pit.push(tube([p.x, p.y - 0.02, p.z], [p.x + 0.03, p.y + 0.16, p.z], 0.012, 6), tube([p.x + 0.03, p.y + 0.16, p.z], [p.x + 0.33, p.y + 0.16, p.z], 0.01, 8));
  }
  P('Pitot-static probes', {
    system: 'Sensors', material: 'Heated stainless-steel pitot tubes on roof masts', mass: 2, count: 2, explode: [0.9, 1.1, 0],
    desc: 'Two heated pitot tubes on the cockpit roof, above the rotor-downwash chaos near the fuselage, measure airspeed for each pilot and the AFCS.',
  }, [mesh(merge(pit), MAT.steel())]);

  // ------------------------------------------------------------------ environmental control
  const ecs = [box(0.36, 0.2, 0.3, [1.9, 2.42, 0.32])];
  for (const s of [1, -1]) ecs.push(pipe([[2.2, 1.97, 0.6 * s], [0.5, 1.97, 0.7 * s], [-1.6, 1.97, 0.7 * s]], 0.04, 8));
  ecs.push(pipe([[1.9, 2.32, 0.32], [2.3, 2.15, 0.4], [2.9, 2.05, 0.45], [3.5, 1.5, 0.75]], 0.035, 8));
  P('Heating, ventilation & cooling', {
    system: 'Environmental control', material: 'Bleed-air heater, blower, vapour-cycle cooling unit, ducts', mass: 45, explode: [0.4, 1.2, 0.6],
    desc: 'A bleed-air heater and blower warm the cockpit and cabin; the M model adds vapour-cycle air conditioning to keep crew and avionics cool in hot climates.',
  }, [mesh(merge(ecs), MAT.casting())]);

  return handles;
}
