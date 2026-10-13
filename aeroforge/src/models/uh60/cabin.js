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
    callout: true, anchor: [2.45, 1.92, -0.53],
  }, [mesh(merge(seatF), MAT.seat()), mesh(merge(seatA), MAT.armour())]);

  const panelG = [place(new THREE.BoxGeometry(0.06, 0.52, 1.92), [3.72, 1.2, 0], [0, 0, 0.22]), box(0.24, 0.05, 1.84, [3.66, 1.47, 0])];
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
  // upper cutter: a serrated blade leaning forward from a base on the roof, braced from behind
  const ws = [
    place(new THREE.BoxGeometry(0.05, 0.46, 0.022), [roofP.x + 0.12, roofP.y + 0.2, 0], [0, 0, -0.62]),
    tube([roofP.x - 0.16, roofP.y + 0.01, 0], [roofP.x + 0.05, roofP.y + 0.3, 0], 0.016, 6),
    box(0.3, 0.05, 0.1, [roofP.x, roofP.y + 0.015, 0]),
  ];
  for (let k = 0; k < 5; k++) ws.push(place(new THREE.BoxGeometry(0.03, 0.03, 0.018), [roofP.x + 0.04 + k * 0.045, roofP.y + 0.08 + k * 0.06, 0], [0, 0, 0.6]));
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
  const under = [];
  for (const z of [0.53, -0.53]) under.push(pipe([[3.2, 0.6, z], [2.9, 0.6, z], [2.6, 0.6, z * 0.6], [2.4, 0.62, -0.7], [2.35, 0.66, -0.9]], 0.012));
  under.push(pipe([[2.6, 0.78, 0.23], [2.5, 0.64, 0.0], [2.38, 0.64, -0.85]], 0.01), pipe([[3.74, 0.74, 0.53], [3.5, 0.62, 0.2], [2.45, 0.63, -0.82]], 0.01));
  P('Cockpit control linkages', {
    system: 'Flight controls', material: 'Aluminium push-pull tubes and bellcranks under the cockpit floor', mass: 9, explode: [0.6, -0.4, -0.4],
    desc: 'Interconnect the two pilots\' cyclics, collectives and pedals under the floor, so both sets move together, and gather them at the foot of the control closet.',
  }, [mesh(merge(under), MAT.structure())]);
  P('Control closet push-pull tubes', {
    system: 'Flight controls', material: 'Vertical aluminium tubes in the closet behind the copilot', mass: 8, explode: [0.5, 1.0, -0.8],
    desc: 'Rigid tubes climb the control closet behind the copilot\'s seat from the cockpit floor to the upper deck: short, stiff and protected inside the structure.',
  }, [mesh(merge([pipe([[2.35, 0.66, -0.9], [2.3, 1.2, -0.94], [2.3, 2.05, -0.9], [2.15, 2.33, -0.55], [1.95, 2.42, -0.3]], 0.012), pipe([[2.38, 0.66, -0.84], [2.33, 1.3, -0.88], [2.33, 2.05, -0.84], [2.1, 2.36, -0.45], [1.95, 2.42, -0.15]], 0.012)]), MAT.structure())]);
  P('Upper deck control rods', {
    system: 'Flight controls', material: 'Push-pull rods and bellcranks from the mixing unit to the primary servos', mass: 8, explode: [0.6, 1.6, -0.4],
    desc: 'Carry the mixed outputs forward of the main gearbox to the input levers of the three primary servos — fore, aft and lateral — around the transmission.',
  }, [mesh(merge([pipe([[1.15, 2.45, -0.05], [0.8, 2.43, 0.05], [0.42, 2.38, 0.0]], 0.012), pipe([[1.15, 2.42, -0.1], [0.6, 2.38, -0.3], [0.0, 2.35, -0.42]], 0.012), pipe([[1.15, 2.4, -0.15], [0.5, 2.33, -0.5], [-0.45, 2.33, -0.46], [-0.5, 2.36, -0.05]], 0.01)]), MAT.structure())]);
  const cab = [];
  for (const dz of [0.05, 0.1]) {
    const pts = [[1.2, 2.4, dz], [-0.8, 2.33, dz + 0.1], [-3.6, 2.12, dz]];
    for (let x = -4.4; x >= -8.2; x -= 0.95) pts.push([x, 1.98 - (x + 4.4) * -0.015, dz]);
    pts.push([-8.9, 2.2, -0.02], [-9.2, 2.6, -0.11], [-9.38, 2.92, -0.22]);
    cab.push(pipe(pts, 0.006, 4));
  }
  P('Tail rotor control cables', {
    system: 'Flight controls', material: 'Stainless-steel cables over pulleys, quadrant at the tail servo', mass: 6, explode: [-1.6, 0.9, 0],
    desc: 'Pedal and mixing-unit inputs run aft along the tail cone as a pair of cables to the tail-rotor servo in the pylon — light, and tolerant of the tail cone flexing.',
  }, [mesh(merge(cab), MAT.steel())]);

  // ------------------------------------------------------------------ hydraulics
  // Three independent systems, no fluid shared (UH-60 hydraulic student guide; TM 1-1520-237-10):
  //   No. 1: left pump module → No. 1 transfer module → first stage of the three primary servos and
  //          of the tail-rotor servo
  //   No. 2: right pump module → No. 2 transfer module → second stage of the primary servos and the
  //          pilot-assist servos
  //   backup: AC-motor pump → utility module → second stage of the tail-rotor servo, the APU
  //          accumulator, and either primary system if its pump fails
  for (const s of [-1, 1]) {
    P(s < 0 ? 'No. 1 hydraulic pump module (left)' : 'No. 2 hydraulic pump module (right)', {
      system: 'Hydraulics', material: 'Variable-delivery piston pump with integral reservoir and filters', mass: 12, explode: [1.2, 0.5, 0.6 * s],
      desc: s < 0
        ? 'Driven by the left accessory module, so it runs whenever the rotor turns — even in autorotation. About 3,000 psi (21 MPa); its integral reservoir and filters make it a self-contained module.'
        : 'Driven by the right accessory module, at about 3,000 psi. Pump, reservoir and filters are one module that can be changed as a unit.',
    }, [mesh(merge([cyl(0.07, 0.07, 0.2, [0.44, 2.36, 0.5 * s], 'x', 14), box(0.14, 0.12, 0.12, [0.3, 2.37, 0.5 * s]), cyl(0.04, 0.04, 0.06, [0.3, 2.46, 0.5 * s], 'y', 10)]), MAT.hydraulic())]);
    P(s < 0 ? 'No. 1 transfer module' : 'No. 2 transfer module', {
      system: 'Hydraulics', material: 'Valve block with shutoff valves, pressure switches and filters', mass: 5, explode: [0.2, 0.6, 1.0 * s],
      desc: s < 0
        ? 'Distributes No. 1 pressure to the first stage of the three primary servos and the first stage of the tail-rotor servo, with shutoff valves that isolate a leaking branch.'
        : 'Distributes No. 2 pressure to the second stage of the primary servos and to the pilot-assist servos (boost and SAS).',
    }, [mesh(merge([box(0.16, 0.1, 0.1, [-0.3, 2.37, 0.45 * s]), cyl(0.025, 0.025, 0.08, [-0.25, 2.44, 0.45 * s], 'y', 8)]), MAT.casting())]);
  }
  P('Backup hydraulic pump', {
    system: 'Hydraulics', material: 'AC-motor-driven pump module with reservoir', mass: 18, explode: [-0.5, 1.6, 0.6],
    desc: 'An electric pump that takes over automatically if either primary system fails, always powers the second stage of the tail-rotor servo, recharges the APU accumulator, and runs the controls on the ground with the rotor stopped.',
  }, [mesh(merge([cyl(0.08, 0.08, 0.26, [-1.25, 2.38, 0.27], 'x', 14), box(0.16, 0.14, 0.14, [-1.05, 2.38, 0.27]), new THREE.SphereGeometry(0.07, 12, 10).translate(-1.45, 2.4, 0.27)]), MAT.hydraulic())]);
  P('Utility module', {
    system: 'Hydraulics', material: 'Valve manifold on the backup system', mass: 4, explode: [-0.3, 0.8, -0.9],
    desc: 'Connects the backup pump to the No. 1 and No. 2 transfer modules, so backup pressure can replace either primary system, and to the APU accumulator.',
  }, [mesh(merge([box(0.18, 0.1, 0.12, [-0.78, 2.36, -0.26]), cyl(0.02, 0.02, 0.07, [-0.72, 2.43, -0.26], 'y', 8)]), MAT.casting())]);
  P('APU accumulator', {
    system: 'Hydraulics', material: 'Nitrogen-charged piston accumulator, 3,000 psi', mass: 9, explode: [-1.2, 1.4, 0.8],
    desc: 'Stores hydraulic fluid at about 3,000 psi against a nitrogen charge. Its discharge spins the APU\'s hydraulic start motor, so the APU can be started with no ground power; the backup pump recharges it afterwards. (Location approximate.)',
  }, [mesh(merge([cyl(0.075, 0.075, 0.34, [-2.05, 2.36, 0.16], 'x', 16), new THREE.SphereGeometry(0.075, 14, 10).translate(-1.88, 2.36, 0.16), new THREE.SphereGeometry(0.075, 14, 10).translate(-2.22, 2.36, 0.16)]), MAT.hydraulic())]);
  P('APU hand pump & servicing pump', {
    system: 'Hydraulics', material: 'Lever-operated hand pumps', mass: 4, count: 2, explode: [-1.0, 1.7, 1.0],
    desc: 'If the accumulator is flat, a crew member recharges it with a hand pump on the deck; a separate servicing hand pump refills the system reservoirs. (Location approximate.)',
  }, [mesh(merge([box(0.1, 0.12, 0.08, [-1.66, 2.3, 0.15]), tube([-1.66, 2.36, 0.15], [-1.52, 2.42, 0.15], 0.01, 6), box(0.08, 0.1, 0.07, [-1.6, 2.31, -0.26])]), MAT.casting())]);
  P('APU hydraulic start motor', {
    system: 'Hydraulics', material: 'Axial-piston hydraulic motor on the APU gearbox', mass: 4, explode: [-1.0, 1.2, -1.1],
    desc: 'Fed from the APU accumulator, it cranks the APU up to self-sustaining speed in a few seconds; the battery supplies the APU\'s start control and ignition.',
  }, [mesh(merge([cyl(0.05, 0.05, 0.12, [-1.86, 2.38, -0.18], 'x', 14), box(0.06, 0.07, 0.07, [-1.88, 2.31, -0.18])]), MAT.hydraulic())]);
  // lines, one part per system so each can be traced in the Systems view
  const servoFwd = [0.42, 2.33, 0.0], servoAft = [-0.47, 2.33, 0.0], servoLat = [-0.05, 2.33, -0.43];
  const trServo = [-9.38, 2.95, -0.24];
  const tailRun = (dz) => [[-1.0, 2.3, -0.36 + dz * 0.2], [-2.0, 2.28, -0.2 + dz], [-3.0, 2.12, -0.16 + dz], [-5.0, 1.97, -0.14 + dz], [-7.5, 1.86, -0.1 + dz], [-8.6, 2.08, -0.02 + dz * 0.5], [-9.0, 2.5, -0.08 + dz * 0.3], [-9.3, 2.85, -0.2 + dz * 0.2], trServo];
  const no1 = [pipe([[0.3, 2.31, -0.5], [0.0, 2.31, -0.48], [-0.25, 2.33, -0.45]], 0.01), pipe([[-0.32, 2.33, -0.4], [-0.1, 2.31, -0.38], servoLat], 0.008), pipe([[-0.3, 2.33, -0.4], [-0.45, 2.31, -0.2], servoAft], 0.008), pipe([[-0.3, 2.34, -0.4], [0.2, 2.31, -0.3], servoFwd], 0.008), pipe([[-0.36, 2.33, -0.45], ...tailRun(0)], 0.007)];
  const no2 = [pipe([[0.3, 2.31, 0.5], [0.0, 2.31, 0.48], [-0.25, 2.33, 0.45]], 0.01), pipe([[-0.32, 2.33, 0.4], [-0.2, 2.31, 0.05], servoAft], 0.008), pipe([[-0.3, 2.34, 0.4], [0.25, 2.31, 0.2], servoFwd], 0.008), pipe([[-0.3, 2.35, 0.42], [0.1, 2.34, 0.1], servoLat], 0.008), pipe([[-0.25, 2.35, 0.45], [0.6, 2.32, 0.5], [1.5, 2.36, 0.2], [1.85, 2.4, -0.05]], 0.008)];
  const bk = [pipe([[-1.05, 2.33, 0.27], [-0.9, 2.32, 0.0], [-0.8, 2.33, -0.2]], 0.009), pipe([[-0.7, 2.33, -0.26], [-0.5, 2.31, -0.4], [-0.38, 2.33, -0.45]], 0.008), pipe([[-0.7, 2.34, -0.24], [-0.5, 2.31, 0.3], [-0.38, 2.33, 0.45]], 0.008),
    pipe([[-0.85, 2.33, -0.3], [-1.4, 2.32, -0.1], [-1.88, 2.34, 0.12]], 0.008), pipe([[-1.9, 2.34, 0.08], [-1.88, 2.33, -0.12]], 0.008), pipe([[-1.45, 2.34, 0.3], ...tailRun(0.2)], 0.007)];
  P('No. 1 system hydraulic lines', {
    system: 'Hydraulics', material: 'Stainless/titanium tubing and flexible hoses', mass: 6, explode: [0.3, 1.0, -1.3],
    desc: 'From the left pump module through the No. 1 transfer module to the first stages of the three primary servos, and along the left of the tail cone to the tail-rotor servo\'s first stage.',
  }, [mesh(merge(no1), MAT.hydraulic())]);
  P('No. 2 system hydraulic lines', {
    system: 'Hydraulics', material: 'Stainless/titanium tubing and flexible hoses', mass: 5, explode: [0.3, 1.0, 1.3],
    desc: 'From the right pump module through the No. 2 transfer module to the second stages of the primary servos and forward to the pilot-assist servos. Routed apart from No. 1 so a single hit cannot drain both.',
  }, [mesh(merge(no2), MAT.hydraulic())]);
  P('Backup system hydraulic lines', {
    system: 'Hydraulics', material: 'Stainless/titanium tubing and flexible hoses', mass: 6, explode: [-0.6, 1.3, 0.3],
    desc: 'From the backup pump to the utility module and on to both transfer modules, the APU accumulator and start motor, and down the tail cone to the tail-rotor servo\'s second stage.',
  }, [mesh(merge(bk), MAT.hydraulic())]);

  // ------------------------------------------------------------------ electrical
  P('AC generators', {
    system: 'Electrical', material: 'Two 30/45 kVA, 115 V 400 Hz brushless generators', mass: 30, count: 2, explode: [1.6, 0.6, 0],
    desc: 'One on each accessory module, so they turn with the rotor whether or not the engines run. Either can carry the whole aircraft\'s AC load.',
  }, [mesh(merge([cyl(0.095, 0.095, 0.24, [0.66, 2.52, 0.5], 'x', 18), cyl(0.095, 0.095, 0.24, [0.66, 2.52, -0.5], 'x', 18)]), MAT.casting())]);
  P('APU generator', {
    system: 'Electrical', material: '115 V AC generator on the APU gearbox', mass: 14, explode: [-1.2, 1.5, -1.0],
    desc: 'Driven by the APU, it powers the aircraft on the ground with the rotor stopped — for avionics checks, cabin lights and the backup hydraulic pump — and can back up the main generators in flight.',
  }, [mesh(cyl(0.075, 0.075, 0.16, [-2.42, 2.32, 0.17], 'x', 16), MAT.casting())]);
  P('Main battery', {
    system: 'Electrical', material: '24 V sealed battery (location approximate)', mass: 36, explode: [1.6, -0.3, 0.6],
    desc: 'Powers the APU start control and ignition and keeps the essential buses alive if every generator fails. (Exact bay location varies with configuration; shown in the nose bay.)',
  }, [mesh(box(0.24, 0.2, 0.28, [4.33, 0.9, 0.24]), MAT.black())]);
  P('AC/DC converters', {
    system: 'Electrical', material: 'Two transformer-rectifier units', mass: 16, count: 2, explode: [0.8, 0.8, 0],
    desc: 'Turn 115 V AC into 28 V DC for most of the aircraft\'s equipment; two units, so one can fail without losing the DC buses.',
  }, [mesh(merge([box(0.3, 0.18, 0.4, [2.0, 1.88, 0.55]), box(0.3, 0.18, 0.4, [2.0, 1.88, -0.55])]), MAT.avionics())]);
  P('Power distribution panels', {
    system: 'Electrical', material: 'AC and DC bus panels, relays and circuit protection', mass: 12, explode: [-1.0, 0.6, 1.0],
    desc: 'AC and DC buses are split into primary and essential groups, so losing one generator or converter sheds only the non-essential loads.',
  }, [mesh(box(0.25, 0.14, 0.3, [-2.3, 1.62, 0.6]), MAT.avionics())]);
  // harnesses kept 6 cm inside the skin, following its curvature
  const inSkin = (pts, side, inset = 0.06) => pts.map(([x, a]) => surfPoint(x, side > 0 ? a : Math.PI - a, -inset));
  const wires = [];
  for (const s of [1, -1]) wires.push(pipe(inSkin([[3.95, 0.1], [3.5, 0.6], [3.0, 0.98], [2.4, 1.08], [1.0, 1.08], [-0.6, 1.08], [-1.75, 1.05], [-2.25, 0.95]], s), 0.016));
  P('Cabin wiring harnesses', {
    system: 'Electrical', material: 'Shielded wiring bundles in clamped runs', mass: 30, explode: [0, 0.7, 0],
    desc: 'Several kilometres of wire run up from the nose bay and aft along both sides of the cabin roof; critical circuits are duplicated and routed apart for survivability.',
  }, [mesh(merge(wires), MAT.wiring())]);
  const tw = [];
  for (let x = -2.4; x >= -8.6; x -= 0.6) tw.push([x, Math.PI - 1.15]);
  P('Tail cone wiring harness', {
    system: 'Electrical', material: 'Shielded wiring bundle', mass: 12, explode: [-2.2, 0.6, -0.5],
    desc: 'Runs aft along the upper left of the tail cone to the tail lights, the tail-rotor de-ice, the stabilator actuators and the aft sensors.',
  }, [mesh(pipe(inSkin(tw, 1, 0.04), 0.012), MAT.wiring())]);

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
  const antennas = (list) => merge(list.map(([x, a]) => bladeAntenna(surfPoint(x, a, -0.004), surfNormal(x, a), 0.22, 0.26)));
  P('VHF-FM (SINCGARS) antennas', {
    system: 'Communications', material: 'Composite blade antennas', mass: 3, count: 2, explode: [0.4, 0.8, 0],
    desc: 'Secure frequency-hopping FM for talking to troops on the ground, and FM homing to find them. Blade antennas on the cockpit roof (placement approximate).',
  }, [mesh(antennas([[2.45, 1.2], [2.45, Math.PI - 1.2]]), MAT.paintDark())]);
  P('UHF/VHF-AM antennas', {
    system: 'Communications', material: 'Composite blade antennas', mass: 3, count: 2, explode: [0, -0.8, 0],
    desc: 'Air-to-air and air-traffic-control voice on the belly, where the fuselage shadows them from the rotor (placement approximate).',
  }, [mesh(antennas([[1.0, -1.45], [-0.6, -1.65]]), MAT.paintDark())]);
  P('IFF transponder antennas', {
    system: 'Communications', material: 'Small blade antennas, top and bottom', mass: 2, count: 2, explode: [-1.6, 0.4, -0.4],
    desc: 'One above and one below, so the identification-friend-or-foe transponder answers interrogations from any direction (placement approximate).',
  }, [mesh(antennas([[-1.4, -1.57], [-4.8, Math.PI / 2 + 0.55]]), MAT.paintDark())]);
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

  // ------------------------------------------------------------------ active vibration control (UH-60M)
  // Sikorsky's UH-60M feature list: active vibration control replaced the A/L's passive cockpit and
  // cabin absorbers. Count and placement of the force generators are approximate.
  const fg = (x, y, z) => [box(0.22, 0.12, 0.2, [x, y, z]), cyl(0.07, 0.07, 0.21, [x, y, z], 'x', 14)];
  P('AVCS force generators', {
    system: 'Avionics', material: 'Counter-rotating eccentric-mass actuators', mass: 72, count: 4, explode: [0, -0.6, 0],
    desc: 'Each spins a pair of eccentric masses so that it shakes the structure with a controlled four-per-rev force, phased to cancel the rotor\'s vibration where crew and troops sit. Two under the cockpit floor and two in the aft cabin ceiling (count and placement approximate).',
  }, [mesh(merge([...fg(3.98, 0.73, 0.32), ...fg(3.98, 0.73, -0.32), ...fg(-1.5, 2.0, 0.3), ...fg(-1.5, 2.0, -0.3)]), MAT.casting())]);
  const acc = [];
  for (const [x, y, z] of [[3.3, 0.7, 0.5], [3.3, 0.7, -0.5], [2.6, 0.7, 0.0], [1.6, 0.64, 0.8], [1.6, 0.64, -0.8], [0.3, 0.64, 0.0], [-1.2, 0.64, 0.8], [-1.2, 0.64, -0.8]]) acc.push(box(0.05, 0.035, 0.05, [x, y, z]));
  P('AVCS accelerometers', {
    system: 'Avionics', material: 'Piezoelectric accelerometers on the floor structure', mass: 1, count: 8, explode: [0, -0.3, 0],
    desc: 'Measure the vibration that actually reaches the cockpit and cabin floors; the controller adjusts the force generators until these readings are as small as it can make them.',
  }, [mesh(merge(acc), MAT.yellow())]);
  P('AVCS controller', {
    system: 'Avionics', material: 'Digital vibration-control computer', mass: 7, explode: [-1.2, 0.3, -0.8],
    desc: 'Reads the accelerometers and a rotor-speed reference and continuously re-tunes the amplitude and phase of each force generator. The bifilar on the hub removes the bulk of the vibration first; the AVCS cancels what still reaches the cabin.',
  }, [mesh(box(0.22, 0.14, 0.2, [-2.62, 1.68, -0.42]), MAT.avionics())]);

  // ------------------------------------------------------------------ aircraft survivability equipment
  // Encyclopedic level: the visible sensor fairings and dispensers of the UH-60M's ASE suite.
  const onSkin = (x, a, g, off = 0) => {
    const n = surfNormal(x, a), p = surfPoint(x, a, off);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), n));
    return g.translate(p.x, p.y, p.z);
  };
  const dome = (r, h) => new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, h / r, 1);
  const both = (x, a, make, off) => [onSkin(x, a, make(), off), onSkin(x, Math.PI - a, make(), off)];
  P('Missile warning sensors (CMWS)', {
    system: 'Sensors', material: 'AN/AAR-57 ultraviolet electro-optic sensors in faceted fairings', mass: 12, count: 4, explode: [0, 0.4, 0.9],
    desc: 'The Common Missile Warning System watches all round the aircraft for the ultraviolet flash of a missile motor and cues the countermeasures automatically. Two sensors face forward on the nose and two aft on the rear fuselage (typical installation).',
  }, [mesh(merge([...both(4.05, -0.32, () => cyl(0.075, 0.06, 0.08, [0, 0.03, 0], 'y', 6)), ...both(-3.95, -0.25, () => cyl(0.07, 0.055, 0.08, [0, 0.03, 0], 'y', 6))]), MAT.paintDark()),
    mesh(merge([...both(4.05, -0.32, () => cyl(0.045, 0.045, 0.012, [0, 0.075, 0], 'y', 12)), ...both(-3.95, -0.25, () => cyl(0.042, 0.042, 0.012, [0, 0.075, 0], 'y', 12))]), MAT.lens())]);
  P('CMWS electronic control unit', {
    system: 'Sensors', material: 'Processor box on the aft avionics shelf', mass: 8, explode: [-1.4, 0.8, 0],
    desc: 'Fuses the four sensors\' detections, rejects false alarms such as sun glints and fires, and tells the crew and the dispensers where a threat is coming from.',
  }, [mesh(box(0.26, 0.14, 0.22, [-2.85, 1.66, 0.0]), MAT.avionics())]);
  P('Laser warning sensors (AVR-2B)', {
    system: 'Sensors', material: 'AN/AVR-2B laser detecting sensor heads', mass: 4, count: 4, explode: [0.3, 0.7, 0.9],
    desc: 'Detect a rangefinder, designator or beam-rider laser illuminating the aircraft and tell the crew its type and bearing. A UH-60M feature; four heads, nose and tail (typical installation).',
  }, [mesh(merge([...both(4.45, 0.45, () => dome(0.05, 0.04)), ...both(-6.4, 0.55, () => dome(0.045, 0.035))]), MAT.radome())]);
  P('Radar warning antennas', {
    system: 'Sensors', material: 'Flush spiral antennas for the radar warning receiver', mass: 3, count: 4, explode: [0.6, 0.3, 0.9],
    desc: 'Four cavity-backed spiral antennas — two looking forward, two aft — give the radar warning receiver all-round coverage of radars tracking the helicopter (typical installation).',
  }, [mesh(merge([...both(4.62, 0.05, () => cyl(0.06, 0.06, 0.02, [0, 0.005, 0], 'y', 16)), ...both(-8.9, 0.2, () => cyl(0.05, 0.05, 0.02, [0, 0.005, 0], 'y', 16))]), MAT.radome())]);
  P('Countermeasure dispensers', {
    system: 'Weapons', material: 'Flare and chaff dispenser magazines (M130 / AN/ALE-47 class)', mass: 16, count: 2, explode: [-1.0, -0.6, 1.2],
    desc: 'Magazines on the lower tail cone fire decoy flares or chaff when the missile warning system calls a threat, or when the crew presses the dispense switch.',
  }, [mesh(merge(both(-5.0, -0.55, () => box(0.42, 0.06, 0.2, [0, 0.02, 0]), -0.01)), MAT.paintDark())]);

  // ------------------------------------------------------------------ lights (exterior, under the nose; interior)
  const lamp = (x, side) => { const p = surfPoint(x, side > 0 ? -Math.PI / 2 + 0.22 : 1.5 * Math.PI - 0.22); return p; };
  const ll = lamp(3.15, 1), sl = lamp(3.15, -1);
  P('Landing light', {
    system: 'Electrical', material: 'Retractable, extendable landing lamp under the nose', mass: 4, explode: [0.5, -0.8, 0.6],
    desc: 'Extends from the belly under the cockpit and can be aimed forward and down from a switch on the collective, so the pilot never takes a hand off the controls on a night approach.',
  }, [mesh(merge([cyl(0.1, 0.1, 0.05, [ll.x, ll.y - 0.02, ll.z], 'y', 20)]), MAT.black()), mesh(cyl(0.085, 0.085, 0.01, [ll.x, ll.y - 0.05, ll.z], 'y', 20), MAT.lens())]);
  P('Searchlight', {
    system: 'Electrical', material: 'Steerable searchlight (white or infrared) under the nose', mass: 6, explode: [0.5, -0.8, -0.6],
    desc: 'A controllable light on a pan-and-tilt mount under the cockpit, slewed from the collective: white for search and landing-zone work, or infrared for crews on night-vision goggles.',
  }, [mesh(merge([cyl(0.11, 0.11, 0.06, [sl.x, sl.y - 0.02, sl.z], 'y', 20), box(0.08, 0.06, 0.08, [sl.x, sl.y + 0.02, sl.z])]), MAT.black()), mesh(cyl(0.09, 0.09, 0.01, [sl.x, sl.y - 0.055, sl.z], 'y', 20), MAT.lens())]);
  const dl = [];
  for (const x of [-1.2, 0.0, 1.2]) dl.push(cyl(0.06, 0.06, 0.02, [x, 2.06, 0], 'y', 14));
  for (const z of [0.4, -0.4]) dl.push(cyl(0.035, 0.035, 0.05, [3.05, 2.06, z], 'y', 10));
  P('Cockpit & cabin lighting', {
    system: 'Electrical', material: 'NVG-compatible dome, flood and utility lights', mass: 3, count: 5, explode: [0, 0.4, 0],
    desc: 'Cabin dome lights switch between white and a dim blue-green that does not blind night-vision goggles; cockpit floods and utility lights are NVG-compatible too.',
  }, [mesh(merge(dl), MAT.lens())]);

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
