// UH-60M crew stations and onboard systems: glass cockpit (four multifunction displays, flight-
// management CDUs), armoured crashworthy seats with sliding side armour, cyclic/collective/pedals
// with their grips, the cabin with stroking troop seats, crew-chief stations, stowage compartments
// and window gun mounts, the nine wire-strike cutters and deflectors, flight-control runs (control
// linkages, closet tubes, bellcranks and pulleys, boost servos, SAS and trim actuators, mixing unit,
// deck rods to the primary servos, tail-rotor cables), hydraulics, electrical generation and
// distribution, blade de-ice control and icing sensors, avionics, antennas, air-data probes and
// the heating and ventilation system.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { MAT, V3, merge, box, cyl, tube, pipe, place, DEICE } from './common.js';
import { aftDeckPoint } from './tail.js';

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

export function buildCabin({ A, P, surfPoint, surfNormal, roofY, servoInputs = [], servoBases = [] }) {
  const handles = {};
  const fl = 0.66;   // cockpit floor
  const sideA = (a, s) => (s > 0 ? a : Math.PI - a);          // mirror a section angle to the left side
  const onSkin = (x, a, g, off = 0) => {
    const n = surfNormal(x, a), p = surfPoint(x, a, off);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), n));
    return g.translate(p.x, p.y, p.z);
  };

  // ------------------------------------------------------------------ cockpit
  const seatF = [], seatA = [];
  for (const z of [0.53, -0.53]) {
    const x = 2.78;
    seatF.push(box(0.5, 0.09, 0.5, [x, 1.0, z]), place(new THREE.BoxGeometry(0.1, 0.78, 0.5), [x - 0.27, 1.42, z], [0, 0, -0.12]), box(0.08, 0.16, 0.36, [x - 0.33, 1.9, z]));
    seatF.push(tube([x - 0.34, fl, z - 0.18], [x - 0.34, 2.0, z - 0.18], 0.025, 8), tube([x - 0.34, fl, z + 0.18], [x - 0.34, 2.0, z + 0.18], 0.025, 8), box(0.35, 0.3, 0.06, [x, 0.8, z]));
    seatA.push(box(0.06, 0.65, 0.48, [x - 0.36, 1.4, z]), box(0.5, 0.04, 0.5, [x, 0.95, z]));
  }
  P('Armoured crashworthy pilot seats', {
    system: 'Crew systems', material: 'One-piece ceramic-composite armoured bucket, energy-absorbing stroke tubes', mass: 150, count: 2, explode: [0.6, 1.4, 0],
    desc: 'Each seat\'s one-piece ceramic-composite bucket protects against 7.62 mm rounds from the back and below. It rides on vertical guides with energy-absorbing tubes: in a crash it strokes down into a recess in the floor, holding the pilot\'s spinal load to survivable levels.',
    callout: true, anchor: [2.4, 2.05, -0.53],
  }, [mesh(merge(seatF), MAT.seat()), mesh(merge(seatA), MAT.armour())]);
  const sa = [], saRail = [];
  for (const s of [1, -1]) {
    const z = 0.86 * s;
    sa.push(box(0.58, 0.6, 0.022, [2.77, 1.25, z]));
    saRail.push(tube([2.36, 0.94, z + 0.02 * s], [3.12, 0.94, z + 0.02 * s], 0.012, 6), tube([2.36, 1.56, z + 0.02 * s], [3.12, 1.56, z + 0.02 * s], 0.012, 6), box(0.04, 0.1, 0.03, [3.08, 1.2, z - 0.025 * s]));
  }
  P('Sliding armour side panels', {
    system: 'Crew systems', material: 'Ceramic-composite armour panels on rails', mass: 30, count: 2, explode: [0.3, 0.6, 0.0],
    desc: 'An armoured "wing" beside each seat. With the bucket it protects the pilot from 7.62 mm rounds from the side as well as the back and below; a lever at its front unlocks it so it slides aft on its rails for getting in and out.',
  }, [mesh(merge(sa), MAT.armour()), mesh(merge(saRail), MAT.steel())]);

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
    desc: 'Between the seats: two control-display units for the dual flight-management system, plus radio, transponder and the AUTO FLIGHT CONTROL panel (SAS, trim, FPS and boost switches).',
  }, [mesh(merge([place(new THREE.BoxGeometry(0.62, 0.32, 0.32), [3.25, 0.88, 0], [0, 0, 0.25]), box(0.24, 0.1, 0.3, [3.55, 1.08, 0])]), MAT.black()), mesh(merge(cdu), MAT.screenAmber(), { cast: false })]);
  P('Overhead console', {
    system: 'Crew systems', material: 'Circuit-breaker and switch panels', mass: 9, explode: [0.8, 1.2, 0],
    desc: 'Engine control levers, the ENG FUEL SYS selector levers, fuel, electrical, de-ice and lighting switches and circuit breakers, within reach of both pilots overhead.',
  }, [mesh(merge([box(0.55, 0.08, 0.5, [2.95, 2.17, 0]), box(0.12, 0.05, 0.28, [3.12, 2.11, 0]), box(0.08, 0.02, 0.46, [2.75, 2.215, 0])]), MAT.black())]);   // hung from the canopy-bow frame

  // cyclic, collective, pedals (animated)
  const cyclics = [], collectives = [], pedals = [];
  const cycG = merge([cyl(0.016, 0.02, 0.6, [0, 0.3, 0], 'y', 10), box(0.05, 0.13, 0.045, [0.015, 0.645, 0]), cyl(0.024, 0.02, 0.05, [0.0, 0.58, 0], 'y', 10)]);
  const cycSw = merge([cyl(0.009, 0.009, 0.02, [0.03, 0.71, 0], 'y', 6), box(0.012, 0.012, 0.012, [0.045, 0.69, 0.016]), box(0.012, 0.012, 0.012, [0.045, 0.69, -0.016]), box(0.02, 0.03, 0.01, [0.042, 0.62, 0])]);
  const cycPart = P('Cyclic sticks', {
    system: 'Flight controls', material: 'Aluminium sticks with multi-function grips', mass: 6, count: 2, explode: [0.6, 0.5, 0],
    desc: 'Moving the stick tilts the swashplate and hence the rotor disc: forward to accelerate, sideways to roll. Its grip carries the stick-trim and trim-release switches, go-around, cargo-hook release, radio/ICS switches and the stabilator slew-up switch; it reaches the swashplate through the mixing unit and primary servos — there is no direct cable to any one blade.',
  }, []);
  const cycBase = [];
  for (const z of [0.53, -0.53]) {
    const g = new THREE.Group(); g.position.set(3.2, 0.68, z); g.add(mesh(cycG, MAT.black()), mesh(cycSw, MAT.darkMetal()));
    cycPart.add(g); cyclics.push(g);
    // gimbal housing bolted on the floor, its boot, and the stick's lower arm through the floor to the
    // under-floor linkage
    cycBase.push(box(0.14, 0.012, 0.14, [3.2, 0.686, z]), cyl(0.07, 0.042, 0.07, [3.2, 0.727, z], 'y', 14, true), cyl(0.022, 0.022, 0.09, [3.2, 0.63, z], 'y', 8));
  }
  cycPart.add(mesh(merge(cycBase), MAT.black()));
  const colHead = [place(new THREE.BoxGeometry(0.15, 0.06, 0.06), [0.5, 0.08, 0], [0, 0, 0.1]), cyl(0.012, 0.012, 0.025, [0.47, 0.12, 0], 'y', 6), cyl(0.012, 0.012, 0.025, [0.53, 0.125, 0], 'y', 6), box(0.03, 0.02, 0.02, [0.56, 0.1, 0.03])];
  const colG = merge([tube([0, 0, 0], [0.48, 0.07, 0], 0.018, 8), ...colHead]);
  // the copilot's collective telescopes aft for seat access: a sleeve over the forward tube
  const colG2 = merge([tube([0, 0, 0], [0.48, 0.07, 0], 0.018, 8), tube([0.12, 0.0175, 0], [0.3, 0.044, 0], 0.025, 8), ...colHead]);
  const colPart = P('Collective levers', {
    system: 'Flight controls', material: 'Aluminium levers with switch heads; the copilot\'s telescopes', mass: 5, count: 2, explode: [0.2, 0.5, 0],
    desc: 'Raising the collective lifts the whole swashplate, adding pitch to all four blades at once: more thrust to climb, more torque for the tail rotor to cancel. Its head carries the landing-light and searchlight switches, servo shutoff, engine-rpm trim and the cargo-hook emergency release; the copilot\'s lever telescopes aft so he can get in and out of the seat.',
  }, []);
  [[0.23, colG], [-0.83, colG2]].forEach(([z, g0]) => {
    const g = new THREE.Group(); g.position.set(2.6, 0.84, z); g.add(mesh(g0, MAT.black()));
    colPart.add(g); collectives.push(g);
  });
  const pedPart = P('Tail rotor pedals', {
    system: 'Flight controls', material: 'Adjustable pedal assemblies with toe brakes', mass: 6, count: 2, explode: [0.9, 0.3, 0],
    desc: 'Pedals change tail-rotor pitch to point the nose; the toe tops work the wheel brakes on the ground, and switches in the pedals let the yaw trim hold them where the pilot leaves them.',
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
    system: 'Crew systems', material: 'Aluminium tube frames, nylon fabric, wire-bender energy absorbers', mass: 110, count: 11, explode: [0, 1.0, 0], xrayWeight: 0.45,
    desc: 'Eleven crashworthy troop seats hang from the cabin ceiling; in a crash wire-bending energy absorbers let each seat stroke downward so the occupant is not hit by the full deceleration. They fold to clear the floor for cargo or four litters, and stow in the compartments at the rear of the cabin — which moves the centre of gravity. (Layout varies by configuration.)',
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
  // two stowage compartments behind the aft cabin bulkhead, over the fuel cells, doors facing the cabin
  const st = [], stDoor = [];
  for (const s of [1, -1]) {
    const z0 = 0.13 * s, z1 = 0.66 * s, zc = (z0 + z1) / 2, w = Math.abs(z1 - z0);
    st.push(box(0.46, 0.015, w, [-2.04, 1.56, zc]), box(0.46, 0.015, w, [-2.04, 2.05, zc]), box(0.015, 0.5, w, [-2.27, 1.805, zc]), box(0.46, 0.5, 0.015, [-2.04, 1.805, z0]), box(0.46, 0.5, 0.015, [-2.04, 1.805, z1]));
    stDoor.push(box(0.015, 0.44, w - 0.06, [-1.757, 1.805, zc]), box(0.02, 0.03, 0.08, [-1.745, 1.82, zc + 0.15 * s]));
  }
  P('Stowage compartments', {
    system: 'Crew systems', material: 'Aluminium compartments with doors in the aft cabin bulkhead', mass: 16, count: 2, explode: [0.5, 0.7, 0],
    desc: 'Two compartments at the rear of the cabin, over the main fuel cells, open into the cabin and hold the flyaway equipment — covers, tie-downs and tools. Loading troop seats or gear into them moves the centre of gravity aft, so it goes into the weight-and-balance sums.',
  }, [mesh(merge(st), MAT.interiorFront()), mesh(merge(stDoor), MAT.primer())]);

  // ------------------------------------------------------------------ wire-strike protection: nine cutters and deflectors
  const ws = (name, info, objs) => P(name, { system: 'Structure', material: 'Hardened steel', ...info }, objs);
  {
    // upper cutter on the rear of the forward sliding fairing: a serrated blade raked forward
    const bx = 1.5, by = 2.66;
    const g = [place(new THREE.BoxGeometry(0.05, 0.42, 0.022), [bx + 0.1, by + 0.18, 0], [0, 0, -0.56]), tube([bx - 0.22, by + 0.02, 0], [bx + 0.02, by + 0.27, 0], 0.016, 6), box(0.34, 0.03, 0.1, [bx - 0.06, by + 0.0, 0])];
    for (let k = 0; k < 6; k++) g.push(place(new THREE.BoxGeometry(0.03, 0.03, 0.018), [bx + 0.03 + k * 0.035, by + 0.07 + k * 0.055, 0], [0, 0, 0.6]));
    ws('Upper wire cutter', {
      mass: 3, explode: [0.6, 1.2, 0],
      desc: 'On the rear of the forward sliding fairing, ahead of the rotor head: a wire that rides up over the cockpit is guided down its forward-raked edge into the serrated jaw and cut before it can reach the rotor. The whole system is passive — no motors and no explosives.',
    }, [mesh(merge(g), MAT.steel())]);
  }
  {
    const g = [tube([3.42, 2.27, 0], [2.64, 2.46, 0], 0.016, 6), place(new THREE.BoxGeometry(0.12, 0.05, 0.02), [2.66, 2.5, 0], [0, 0, -0.6]), box(0.12, 0.03, 0.06, [3.42, 2.27, 0])];
    ws('Pitot wire cutter & deflector', {
      mass: 1.5, explode: [1.0, 0.9, 0],
      desc: 'Between the pitot masts at the front of the sliding fairing: it lifts a wire over the pitot tubes and cuts it at the fairing\'s nose.',
    }, [mesh(merge(g), MAT.steel())]);
  }
  {
    const post = [];
    for (let i = 0; i <= 8; i++) post.push(surfPoint(3.4 + i * 0.09, Math.PI / 2, 0.025));
    const g = [new THREE.TubeGeometry(new THREE.CatmullRomCurve3(post), 16, 0.012, 5)];
    for (const s of [1, -1]) g.push(onSkin(4.14, sideA(0.82, s), place(new THREE.BoxGeometry(0.1, 0.03, 0.05), [0, 0.015, 0], [0, 0, 0.5]), 0.0));
    ws('Windshield post & wiper deflectors', {
      mass: 1.5, count: 3, explode: [1.3, 0.6, 0],
      desc: 'A deflector down the windshield centre post steers a wire up and aft to the cutters instead of letting it catch, and small ramps over the wiper pivots let it slide over the wipers.',
    }, [mesh(merge(g), MAT.steel())]);
  }
  {
    const g = [];
    for (const s of [1, -1]) { const pts = []; for (let i = 0; i <= 8; i++) pts.push(surfPoint(3.375, sideA(-0.45 + i * 0.14, s), 0.018)); g.push(pipe(pts, 0.012, 5)); }
    ws('Cockpit door-hinge deflectors', {
      mass: 1, count: 2, explode: [0.9, 0, 0.8],
      desc: 'Strips along the front (hinge) edge of each cockpit door, so a wire sliding along the fuselage cannot catch in the door gap or on the hinges.',
    }, [mesh(merge(g), MAT.steel())]);
  }
  {
    const g = [];
    for (const s of [1, -1]) {
      const sill = surfPoint(2.75, sideA(-0.58, s), 0.0);
      g.push(box(0.3, 0.025, 0.12, [sill.x, sill.y - 0.07, sill.z + 0.07 * s]), tube([sill.x - 0.1, sill.y - 0.07, sill.z + 0.02 * s], [sill.x - 0.1, sill.y + 0.01, sill.z - 0.02 * s], 0.012, 6), tube([sill.x + 0.1, sill.y - 0.07, sill.z + 0.02 * s], [sill.x + 0.1, sill.y + 0.01, sill.z - 0.02 * s], 0.012, 6));
      const f = surfPoint(3.3, sideA(-0.6, s), 0.01);
      g.push(tube(f, [sill.x - 0.16, sill.y - 0.07, sill.z + 0.13 * s], 0.014, 6));
    }
    ws('Step & extension deflectors', {
      mass: 2, count: 2, explode: [0.6, -0.6, 0.8],
      desc: 'The crew step below each cockpit door has a deflector raked forward from the fuselage to its tip, so a wire striking low slides off instead of snagging the step.',
    }, [mesh(merge(g), MAT.steel())]);
  }
  {
    const g = [];
    for (const s of [1, -1]) {
      g.push(tube([3.38, 0.6, 0.82 * s], [3.05, 0.44, 1.0 * s], 0.016, 6));                                   // gear-joint deflector over the drag-beam pivot
      g.push(place(new THREE.BoxGeometry(0.03, 0.62, 0.02), [2.36, 0.8, 1.2 * s], [0, 0, -0.07]));            // cutter blade ahead of the oleo
      g.push(tube([2.33, 1.12, 1.19 * s], [2.6, 1.0, 1.09 * s], 0.014, 6));                                   // deflector from the oleo top to the fuselage
    }
    ws('Main gear wire cutters & deflectors', {
      mass: 3, count: 4, explode: [0.8, -0.9, 0.4],
      desc: 'A deflector over each drag-beam joint and a cutter along the front of each oleo deal with wires that strike between the tyres and the fuselage — the lower half of the wire-strike system\'s coverage.',
    }, [mesh(merge(g), MAT.steel())]);
  }
  {
    const b = surfPoint(-5.62, -Math.PI / 2, 0.0);
    ws('Tail gear wire deflector', {
      mass: 1, explode: [0, -0.8, 0],
      desc: 'A rod raked down and aft from the tail cone to the tail-wheel fork, so a wire caught under the tail slides down over the wheel instead of hooking the strut.',
    }, [mesh(merge([tube(b, [-6.33, 0.47, 0], 0.016, 6), box(0.1, 0.03, 0.06, [b.x, b.y - 0.015, 0])]), MAT.steel())]);
  }

  // ------------------------------------------------------------------ flight-control runs
  P('Mixing unit', {
    system: 'Flight controls', material: 'Mechanical bellcrank and walking-beam assembly', mass: 14, explode: [0.6, 1.9, 0],
    desc: 'Mechanically blends the pilot\'s inputs four ways: collective into tail-rotor pitch (to cancel the extra torque), collective into lateral and into fore-aft cyclic, and yaw into pitch, so the pilot does not have to make those corrections by hand. An electronic collective/airspeed-to-yaw coupling through the yaw trim adds to the first.',
  }, [mesh(merge([box(0.42, 0.2, 0.36, [1.35, 2.43, -0.05]), cyl(0.03, 0.03, 0.42, [1.35, 2.55, -0.05], 'z', 8)]), MAT.casting()),
    // the linkage on and around the case: input cross-shaft and levers forward (from the boost
    // servos), four walking beams on top (one per mix), output cranks aft (to the primary-servo rods
    // and the tail-rotor cable quadrant)
    mesh(merge([
      cyl(0.016, 0.016, 0.3, [1.585, 2.47, -0.2], 'z', 8),
      ...[-0.3, -0.2, -0.1].map((z) => box(0.02, 0.07, 0.025, [1.585, 2.45, z])),
      ...[-0.17, -0.07, 0.03, 0.11].flatMap((z) => [box(0.34, 0.025, 0.02, [1.35, 2.585, z]), cyl(0.012, 0.012, 0.04, [1.35, 2.575, z], 'z', 6)]),
      cyl(0.016, 0.016, 0.32, [1.12, 2.45, -0.03], 'z', 8),
      ...[-0.18, -0.05, 0.08].map((z) => box(0.025, 0.07, 0.025, [1.115, 2.43, z])),
    ]), MAT.steel())]);
  const bsG = [], sasG = [];
  for (const z of [-0.38, -0.26, -0.14]) {
    bsG.push(cyl(0.04, 0.04, 0.3, [1.87, 2.43, z], 'x', 12), cyl(0.014, 0.014, 0.12, [1.66, 2.43, z], 'x', 8), box(0.07, 0.06, 0.08, [2.05, 2.43, z]));
    sasG.push(cyl(0.028, 0.028, 0.2, [1.86, 2.345, z], 'x', 10), box(0.06, 0.05, 0.06, [2.0, 2.345, z]));
  }
  bsG.push(box(0.36, 0.015, 0.34, [1.87, 2.38, -0.26]));
  P('Boost servos', {
    system: 'Flight controls', material: 'Hydraulic boost actuators (collective, yaw, pitch)', mass: 12, count: 3, explode: [0.9, 2.05, -0.3],
    desc: 'Three boost servos — collective, yaw and pitch — sit between the cockpit controls and the mixing unit and take most of the effort out of the controls. They run on No. 2 hydraulics, with the backup pump standing in if No. 2 fails.',
  }, [mesh(merge(bsG), MAT.hydraulic())]);
  P('SAS actuators', {
    system: 'Flight controls', material: 'Electrohydraulic stability-augmentation actuators (pitch, roll, yaw)', mass: 6, count: 3, explode: [1.2, 1.7, -0.3],
    desc: 'Three small actuators in series with the controls turn the stability-augmentation computers\' commands into control movements, damping pitch, roll and yaw rates. Each has only 10 % control authority (5 % with one SAS off), so a runaway is easy for the pilot to overpower.',
  }, [mesh(merge(sasG), MAT.hydraulic())]);
  P('Trim actuators & pedal damper', {
    system: 'Flight controls', material: 'Electromechanical roll and yaw trim with slip clutches, electrohydromechanical pitch trim, pedal damper', mass: 8, count: 4, explode: [1.4, 2.0, 0.2],
    desc: 'With trim engaged these hold the cyclic and pedals where the pilot leaves them. Roll and yaw trim are electromechanical with slip clutches a pilot can override at 13 lb (roll) and 80 lb (yaw) if one jams; pitch trim is electrohydromechanical. The yaw trim also adds the collective/airspeed-to-yaw coupling, strongest from 0 to 40 kt and gone above 100 kt. A damper smooths the pedals. (Location approximate.)',
  }, [mesh(merge([box(0.2, 0.1, 0.1, [2.16, 2.35, -0.38]), box(0.2, 0.1, 0.1, [2.2, 2.36, -0.22]), cyl(0.04, 0.04, 0.2, [2.18, 2.37, -0.06], 'x', 12), cyl(0.025, 0.025, 0.16, [2.36, 2.34, -0.14], 'x', 10)]), MAT.casting())]);
  const under = [];
  for (const z of [0.53, -0.53]) under.push(pipe([[3.2, 0.6, z], [2.9, 0.6, z], [2.6, 0.6, z * 0.6], [2.4, 0.62, -0.7], [2.35, 0.66, -0.9]], 0.012));
  under.push(pipe([[2.6, 0.78, 0.23], [2.5, 0.64, 0.0], [2.38, 0.64, -0.85]], 0.01), pipe([[3.74, 0.74, 0.53], [3.5, 0.62, 0.2], [2.45, 0.63, -0.82]], 0.01));
  P('Cockpit control linkages', {
    system: 'Flight controls', material: 'Aluminium push-pull tubes and bellcranks under the cockpit floor', mass: 9, explode: [0.6, -0.4, -0.4],
    desc: 'Interconnect the two pilots\' cyclics, collectives and pedals under the floor, so both sets move together, and gather them at the foot of the control closet.',
  }, [mesh(merge(under), MAT.structure())]);
  P('Control closet push-pull tubes', {
    system: 'Flight controls', material: 'Vertical aluminium tubes in the closet behind the copilot', mass: 8, explode: [0.5, 1.0, -0.8],
    desc: 'Rigid tubes climb the control closet behind the copilot\'s seat from the cockpit floor to the upper deck, where they enter the boost servos: short, stiff and protected inside the structure.',
  }, [mesh(merge([pipe([[2.35, 0.66, -0.9], [2.3, 1.2, -0.94], [2.3, 2.05, -0.9], [2.18, 2.33, -0.58], [2.1, 2.43, -0.38]], 0.012), pipe([[2.38, 0.66, -0.84], [2.33, 1.3, -0.88], [2.33, 2.05, -0.84], [2.16, 2.36, -0.45], [2.1, 2.43, -0.26]], 0.012)]), MAT.structure())]);
  // deck rods: mixing-unit outputs to the three primary-servo input levers
  const deckRods = [];
  servoInputs.forEach((p, k) => {
    const z0 = -0.18 + 0.13 * k;
    deckRods.push(pipe([[1.13, 2.42, z0], [0.9, 2.39, (z0 + p.z) / 2], [p.x + 0.12, p.y + 0.02, p.z], p], 0.012));
  });
  deckRods.push(pipe([[1.66, 2.43, -0.38], [1.58, 2.44, -0.3]], 0.01), pipe([[1.66, 2.43, -0.26], [1.58, 2.44, -0.2]], 0.01), pipe([[1.66, 2.43, -0.14], [1.58, 2.44, -0.1]], 0.01));
  P('Upper deck control rods', {
    system: 'Flight controls', material: 'Push-pull rods from the boost servos to the mixing unit and on to the primary servos', mass: 8, explode: [0.6, 1.6, -0.4],
    desc: 'Carry the boosted inputs into the mixing unit and its mixed outputs aft along the deck to the input pilot-valve levers of the three primary servos, forward of the main gearbox.',
  }, [mesh(merge(deckRods), MAT.structure())]);
  const cab = [], cabPts = [];
  // from the mixing unit down through the roof, under the two roof cross beams and the main-module
  // sump in the cabin ceiling, aft through the transition section and along the tail cone
  for (const dz of [0.05, 0.1]) {
    const pts = [[1.2, 2.4, dz], [0.95, 2.28, dz + 0.1], [0.75, 2.12, dz + 0.12], [0.5, 2.055, dz + 0.12], [0.0, 2.1, dz + 0.12], [-0.5, 2.055, dz + 0.12], [-1.0, 2.1, dz + 0.12], [-1.6, 2.13, dz + 0.1], [-2.4, 2.15, dz + 0.05], [-3.6, 2.12, dz]];
    for (let x = -4.4; x >= -8.2; x -= 0.95) pts.push([x, 1.98 - (x + 4.4) * -0.015, dz]);
    pts.push([-8.9, 2.2, -0.02], [-9.2, 2.6, -0.11], [-9.33, 2.86, -0.22]);
    cab.push(pipe(pts, 0.006, 4));
    if (dz === 0.05) cabPts.push(...pts);
  }
  P('Tail rotor control cables', {
    system: 'Flight controls', material: 'Stainless-steel cables over pulleys and fairleads', mass: 6, explode: [-1.6, 0.9, 0],
    desc: 'Pedal and mixing-unit inputs run aft along the tail cone as a pair of cables to the tail-rotor quadrant and servo in the pylon — light, and tolerant of the tail cone flexing.',
  }, [mesh(merge(cab), MAT.steel())]);
  // bellcranks at the corners of the rod runs, walking beam on the deck, pulleys along the tail cone
  const bc = [];
  const crank = (p, ax = 'z') => [cyl(0.03, 0.03, 0.04, p, ax, 10), box(0.1, 0.02, 0.025, [p[0] + 0.03, p[1] + 0.02, p[2]])];
  for (const p of [[2.62, 0.6, 0.32], [2.62, 0.6, -0.32], [2.4, 0.62, -0.7], [2.35, 0.68, -0.88], [2.3, 2.05, -0.92], [2.2, 2.3, -0.6]]) bc.push(...crank(p));
  bc.push(box(0.04, 0.03, 0.4, [1.0, 2.4, -0.1]), cyl(0.02, 0.02, 0.06, [1.0, 2.38, -0.1], 'y', 8));
  for (const p of cabPts.slice(cabPts.findIndex((q) => q[0] === -3.6), -2)) bc.push(cyl(0.032, 0.032, 0.025, [p[0], p[1] + 0.01, 0.075], 'z', 12), box(0.05, 0.08, 0.06, [p[0], p[1] + 0.06, 0.075]));
  P('Control bellcranks & cable pulleys', {
    system: 'Flight controls', material: 'Aluminium bellcranks and walking beam, phenolic cable pulleys on brackets', mass: 5, count: 15, explode: [0.0, 1.4, -0.9],
    desc: 'Wherever a control run changes direction there is a bellcrank: under the cockpit floor, at the foot and the top of the control closet, and a walking beam on the deck. Along the tail cone the two tail-rotor cables run over pulleys on brackets about every metre.',
  }, [mesh(merge(bc), MAT.casting())]);

  // ------------------------------------------------------------------ hydraulics
  // Three independent systems, no fluid shared (UH-60 hydraulic student guide; TM 1-1520-237-10):
  //   No. 1: left pump module → No. 1 transfer module → first stage of the three primary servos and
  //          of the tail-rotor servo
  //   No. 2: right pump module → No. 2 transfer module → second stage of the primary servos and the
  //          pilot-assist servos
  //   backup: AC-motor pump → utility module → second stage of the tail-rotor servo, the APU
  //          accumulator, and either primary system if its pump fails
  const pumpModule = (x, y, z, s) => [cyl(0.07, 0.07, 0.2, [x + 0.14, y, z], 'x', 14), box(0.14, 0.12, 0.12, [x, y + 0.01, z]), cyl(0.04, 0.04, 0.06, [x, y + 0.1, z], 'y', 10),
    cyl(0.022, 0.022, 0.08, [x - 0.04, y + 0.0, z + 0.085 * s], 'y', 10), cyl(0.022, 0.022, 0.08, [x + 0.04, y + 0.0, z + 0.085 * s], 'y', 10)];
  const pmDetail = (x, y, z, s) => [box(0.06, 0.03, 0.006, [x + 0.14, y + 0.0, z + 0.072 * s]), cyl(0.008, 0.008, 0.015, [x - 0.04, y + 0.045, z + 0.085 * s], 'y', 6), cyl(0.008, 0.008, 0.015, [x + 0.04, y + 0.045, z + 0.085 * s], 'y', 6)];
  for (const s of [-1, 1]) {
    P(s < 0 ? 'No. 1 hydraulic pump module (left)' : 'No. 2 hydraulic pump module (right)', {
      system: 'Hydraulics', material: 'Variable-delivery piston pump with integral reservoir and filters', mass: 12, explode: [1.2, 0.5, 0.6 * s],
      desc: (s < 0
        ? 'Driven by the left accessory module, so it runs whenever the rotor turns — even in autorotation — at 3,000 psi (21 MPa). '
        : 'Driven by the right accessory module, at 3,000 psi. ')
        + 'Pump and reservoir are one module, identical to and interchangeable with the other two; a window on the reservoir reads REFILL, FULL or EXPANSION, and its pressure and return filters each pop a red button at about 70 psi above normal pressure drop.',
    }, [mesh(merge(pumpModule(0.3, 2.36, 0.5 * s, s)), MAT.hydraulic()), mesh(merge(pmDetail(0.3, 2.36, 0.5 * s, s)), MAT.red())]);
    P(s < 0 ? 'No. 1 transfer module' : 'No. 2 transfer module', {
      system: 'Hydraulics', material: 'Valve block with shutoff valves, pressure switches and filters', mass: 5, explode: [0.2, 0.6, 1.0 * s],
      desc: s < 0
        ? 'Distributes No. 1 pressure to the first stage of the three primary servos and the first stage of the tail-rotor servo, with shutoff valves that isolate a leaking branch.'
        : 'Distributes No. 2 pressure to the second stage of the primary servos and to the pilot-assist servos (boost and SAS).',
    }, [mesh(merge([box(0.16, 0.1, 0.1, [-0.3, 2.37, 0.45 * s]), cyl(0.025, 0.025, 0.08, [-0.25, 2.44, 0.45 * s], 'y', 8)]), MAT.casting())]);
  }
  // backup pump module on its AC motor, on the left forward deck inside the main-rotor pylon fairing
  P('Backup hydraulic pump', {
    system: 'Hydraulics', material: 'Pump/reservoir module (identical to No. 1 and No. 2) on an AC electric motor', mass: 18, explode: [0.9, 1.3, -0.8],
    desc: 'The same pump module as No. 1 and No. 2, driven by an AC electric motor. It starts automatically when a transfer-module pressure switch sees either system fall below 2,000 psi (armed in flight by the weight-on-wheels switch), delivers 3,000 psi, always powers the tail-rotor servo\'s second stage when needed, recharges the APU accumulator and runs the controls on the ground with the rotor stopped.',
  }, [mesh(merge([...pumpModule(0.86, 2.42, -0.43, -1), cyl(0.06, 0.06, 0.2, [1.2, 2.42, -0.43], 'x', 16), box(0.06, 0.08, 0.08, [1.2, 2.5, -0.43])]), MAT.hydraulic()), mesh(merge(pmDetail(0.86, 2.42, -0.43, -1)), MAT.red())]);
  P('Utility module', {
    system: 'Hydraulics', material: 'Valve manifold on the backup system', mass: 4, explode: [0.9, 0.9, -1.1],
    desc: 'Connects the backup pump to the No. 1 and No. 2 transfer modules, so backup pressure can replace either primary system, and to the APU accumulator.',
  }, [mesh(merge([box(0.18, 0.1, 0.12, [0.92, 2.37, -0.63]), cyl(0.02, 0.02, 0.07, [0.98, 2.44, -0.63], 'y', 8)]), MAT.casting())]);
  P('APU accumulator', {
    system: 'Hydraulics', material: 'Nitrogen-charged piston accumulator, 3,000 psi', mass: 9, explode: [-0.6, -0.6, 0.4],
    desc: 'In the aft cabin ceiling. It stores hydraulic fluid at 3,000 psi against a nitrogen charge; its discharge spins the APU\'s hydraulic start motor, so the APU starts with no ground power. It must hold at least 2,800 psi for a start, and afterwards the backup pump runs for 90 seconds to recharge it.',
  }, [mesh(merge([cyl(0.06, 0.06, 0.34, [-1.54, 2.08, 0], 'x', 16), new THREE.SphereGeometry(0.06, 14, 10).translate(-1.37, 2.08, 0), new THREE.SphereGeometry(0.06, 14, 10).translate(-1.71, 2.08, 0), box(0.06, 0.05, 0.16, [-1.54, 2.15, 0])]), MAT.hydraulic())]);
  P('APU hand pump & accumulator gauge', {
    system: 'Hydraulics', material: 'Lever-operated hand pump, pressure gauge on the aft cabin wall', mass: 3, explode: [-0.3, -0.5, -0.4],
    desc: 'If the accumulator is flat, a crew member recharges it with this hand pump in the cabin ceiling, watching the accumulator pressure gauge on the aft cabin wall come up to 2,800 psi.',
  }, [mesh(merge([box(0.1, 0.12, 0.08, [-1.4, 2.04, -0.13]), tube([-1.4, 1.98, -0.13], [-1.24, 1.94, -0.13], 0.01, 6), pipe([[-1.4, 2.08, -0.09], [-1.38, 2.1, -0.04], [-1.37, 2.09, 0]], 0.006, 4)]), MAT.casting()),
    mesh(merge([cyl(0.04, 0.04, 0.02, [-1.758, 1.88, -0.26], 'x', 14), pipe([[-1.76, 1.92, -0.26], [-1.76, 2.06, -0.18], [-1.72, 2.08, -0.06]], 0.005, 4)]), MAT.black())]);
  P('Hydraulic servicing hand pump & selector', {
    system: 'Hydraulics', material: 'Reservoir-fill hand pump and manual selector valve', mass: 3, explode: [0.0, 0.85, 1.25],
    desc: 'On the right side of the upper deck: one hand pump refills all three reservoirs, a selector valve picks which one, and all three reservoir levels can be read from the same spot.',
  }, [mesh(merge([box(0.14, 0.08, 0.08, [-0.1, 2.35, 0.53]), tube([-0.1, 2.39, 0.53], [0.02, 2.43, 0.53], 0.009, 6), box(0.08, 0.06, 0.06, [0.02, 2.34, 0.6]), cyl(0.012, 0.012, 0.04, [0.02, 2.39, 0.6], 'y', 6)]), MAT.casting())]);
  P('APU hydraulic start motor', {
    system: 'Hydraulics', material: 'Axial-piston hydraulic motor on the APU gearbox', mass: 4, explode: [-1.0, 1.2, -1.1],
    desc: 'Fed from the APU accumulator, it cranks the APU up to self-sustaining speed in a few seconds; the battery supplies the APU\'s start control and ignition.',
  }, [mesh(merge([cyl(0.05, 0.05, 0.12, [-1.86, 2.38, -0.18], 'x', 14), box(0.06, 0.07, 0.07, [-1.88, 2.31, -0.18])]), MAT.hydraulic())]);
  P('Hydraulic logic modules', {
    system: 'Hydraulics', material: 'Two electronic logic modules in the left and right relay panels', mass: 2, count: 2, explode: [0.6, 0.4, 0],
    desc: 'They read the reservoir-level and pressure switches. If a system starts losing fluid they close the shutoff valves on the leaking branch and bring the backup pump on, isolating the leak automatically and telling the pilot on the caution panel. Shown on the frame behind the cockpit (relay-panel location approximate).',
  }, [mesh(merge([box(0.08, 0.1, 0.15, [2.136, 1.98, 0.83]), box(0.08, 0.1, 0.15, [2.136, 1.98, -0.83])]), MAT.avionics()),
    mesh(merge([box(0.012, 0.12, 0.17, [2.172, 1.98, 0.83]), box(0.012, 0.12, 0.17, [2.172, 1.98, -0.83])]), MAT.casting())]);   // mounting flanges on the frame at x 2.2
  // lines, one part per system so each can be traced in the Systems view
  const sv = servoBases.length ? servoBases.map((p) => [p.x - 0.02, p.y + 0.04, p.z]) : [[0.45, 2.33, -0.3], [0.5, 2.33, 0], [0.45, 2.33, 0.3]];
  const trServo = [-9.38, 2.95, -0.24];
  const tailRun = (dz) => [[-1.0, 2.3, -0.36 + dz * 0.2], [-2.0, 2.28, -0.2 + dz], [-3.0, 2.12, -0.16 + dz], [-5.0, 1.97, -0.14 + dz], [-7.5, 1.86, -0.1 + dz], [-8.6, 2.08, -0.02 + dz * 0.5], [-9.0, 2.5, -0.08 + dz * 0.3], [-9.3, 2.85, -0.2 + dz * 0.2], trServo];
  // transfer module → round the outside of the main-module case → over the servo deck brackets to
  // each servo's manifold (sv is ordered left, centre, right)
  const toServos = (s) => {
    // between the case bowl and the oil filter, outboard of the forward transmission pad, up over
    // the servo brackets; No. 2 enters each manifold 3 cm above No. 1 (its second-stage port)
    const run = [[-0.25, 2.325, 0.41 * s], [-0.16, 2.31, 0.42 * s], [-0.04, 2.31, 0.44 * s], [0.1, 2.32, 0.43 * s], [0.22, 2.33, 0.39 * s], [0.3, 2.355, 0.345 * s]];
    const port = (p) => [p[0], p[1] + (s > 0 ? 0.03 : 0), p[2]];
    const near = port(sv[s > 0 ? 2 : 0]), mid = port(sv[1]), far = port(sv[s > 0 ? 0 : 2]);
    const dN = s > 0 ? 0.025 : 0;       // No. 2 crosses over No. 1 in front of the case
    const toMid = [[0.4, 2.39 + dN, 0.18 * s], [0.43, 2.385 + dN, 0.06 * s]];
    return [pipe([...run, [0.36, 2.41, near[2] + 0.007 * s], near], 0.008),
      pipe([...run, ...toMid, [0.46, 2.4 + dN, mid[2]], mid], 0.008),
      pipe([...run, ...toMid, [0.43, 2.385 + dN, -0.15 * s], [0.37, 2.4 + dN, far[2] + 0.033 * s], far], 0.008)];
  };
  // pump module → transfer module, low along the case bowl (inboard of the oil filter)
  const pumpRun = (s) => pipe([[0.24, 2.31, 0.5 * s], [0.1, 2.285, 0.47 * s], [0.0, 2.278, 0.455 * s], [-0.08, 2.275, 0.44 * s], [-0.16, 2.275, 0.425 * s], [-0.25, 2.29, 0.425 * s], [-0.3, 2.33, 0.45 * s]], 0.01);
  const no1 = [pumpRun(-1), ...toServos(-1), pipe([[-0.36, 2.33, -0.45], ...tailRun(0)], 0.007)];
  const no2 = [pumpRun(1), ...toServos(1), pipe([[-0.25, 2.36, 0.45], [-0.04, 2.345, 0.465], [0.1, 2.355, 0.455], [0.18, 2.355, 0.425], [0.26, 2.36, 0.405], [0.4, 2.37, 0.42], [0.55, 2.37, 0.42], [0.85, 2.36, 0.33], [1.4, 2.36, 0.18], [1.75, 2.4, -0.05], [1.9, 2.42, -0.2]], 0.008)];
  const bk = [pipe([[0.86, 2.36, -0.5], [0.88, 2.33, -0.58], [0.92, 2.33, -0.6]], 0.009),
    pipe([[0.86, 2.33, -0.66], [0.4, 2.32, -0.66], [0.0, 2.32, -0.62], [-0.16, 2.33, -0.585], [-0.26, 2.33, -0.53], [-0.3, 2.33, -0.48]], 0.008),   // outboard of the oil filter
    pipe([[-0.26, 2.33, -0.53], [-0.42, 2.31, -0.525], [-0.55, 2.272, -0.35], [-0.58, 2.272, 0.0], [-0.55, 2.272, 0.35], [-0.42, 2.3, 0.47], [-0.33, 2.33, 0.46]], 0.008),   // aft of the main module, under the deck plate, to No. 2
    pipe([[-0.575, 2.272, -0.1], [-0.8, 2.275, -0.17], [-1.0, 2.3, -0.2], [-1.3, 2.24, -0.08], [-1.32, 2.12, -0.02], [-1.34, 2.08, 0]], 0.008),
    pipe([[-1.74, 2.1, 0.0], [-1.8, 2.22, -0.08], [-1.84, 2.3, -0.14], [-1.86, 2.34, -0.17]], 0.008),
    pipe([[-0.575, 2.272, -0.12], [-0.8, 2.275, -0.2], ...tailRun(0.2)], 0.007)];
  P('No. 1 system hydraulic lines', {
    system: 'Hydraulics', material: 'Stainless/titanium tubing and flexible hoses', mass: 6, explode: [0.3, 1.0, -1.3], xrayWeight: 0.6,
    desc: 'From the left pump module through the No. 1 transfer module to the first stages of the three primary servos, and along the left of the tail cone to the tail-rotor servo\'s first stage.',
  }, [mesh(merge(no1), MAT.hydraulic())]);
  P('No. 2 system hydraulic lines', {
    system: 'Hydraulics', material: 'Stainless/titanium tubing and flexible hoses', mass: 5, explode: [0.3, 1.0, 1.3], xrayWeight: 0.6,
    desc: 'From the right pump module through the No. 2 transfer module to the second stages of the primary servos and forward to the pilot-assist servos. Routed apart from No. 1 so a single hit cannot drain both.',
  }, [mesh(merge(no2), MAT.hydraulic())]);
  P('Backup system hydraulic lines', {
    system: 'Hydraulics', material: 'Stainless/titanium tubing and flexible hoses', mass: 6, explode: [-0.6, 1.3, 0.3], xrayWeight: 0.6,
    desc: 'From the backup pump on the left forward deck to the utility module and on to both transfer modules, down through the roof to the APU accumulator and up again to the APU start motor, and along the tail cone to the tail-rotor servo\'s second stage.',
  }, [mesh(merge(bk), MAT.hydraulic())]);

  // ------------------------------------------------------------------ electrical
  P('AC generators', {
    system: 'Electrical', material: 'Two 30/45 kVA, 115/200 V 400 Hz oil-cooled generators', mass: 30, count: 2, explode: [1.6, 0.6, 0],
    desc: 'One on each accessory module, so they turn with the rotor whether or not the engines run, and either can carry the whole aircraft. If a generator\'s main bearing wears or fails a caution comes on, and an auxiliary bearing lets it run about 10 more hours.',
  }, [mesh(merge([cyl(0.095, 0.095, 0.24, [0.66, 2.52, 0.5], 'x', 18), cyl(0.095, 0.095, 0.24, [0.66, 2.52, -0.5], 'x', 18)]), MAT.casting())]);
  P('Generator control units', {
    system: 'Electrical', material: 'Two generator control units (GCUs)', mass: 6, count: 2, explode: [0.9, -0.4, 0],
    desc: 'Each generator has its own GCU, which regulates its voltage and takes it off line if it misbehaves — over- or under-voltage, or underfrequency, a protection the weight-on-wheels switch disables in flight. (Location approximate.)',
  }, [mesh(merge([box(0.2, 0.1, 0.15, [1.72, 2.02, 0.3]), box(0.2, 0.1, 0.15, [1.72, 2.02, -0.3])]), MAT.avionics())]);
  const fd = [], ct = [];
  for (const s of [1, -1]) {
    // from the underside of the generator, down through the roof inboard of the roof beam, under the
    // frame at x 1.0, to the control unit and the converter
    fd.push(pipe([[0.7, 2.44, 0.5 * s], [0.71, 2.35, 0.47 * s], [0.76, 2.25, 0.42 * s], [0.88, 2.13, 0.4 * s], [1.0, 2.1, 0.39 * s], [1.4, 2.08, 0.36 * s], [1.62, 2.04, 0.32 * s], [1.85, 1.96, 0.42 * s], [1.98, 1.97, 0.4 * s]], 0.015, 6));
    fd.push(pipe([[2.0, 1.97, 0.35 * s], [2.0, 2.02, 0.26 * s], [2.0, 2.05, 0.2 * s]], 0.012, 6));
    ct.push(cyl(0.03, 0.03, 0.03, [0.708, 2.37, 0.478 * s], 'y', 12), box(0.06, 0.04, 0.05, [2.06, 2.0, 0.3 * s]));
  }
  P('Generator feeders, current transformers & limiters', {
    system: 'Electrical', material: 'Heavy-gauge feeder cables, current transformers, current limiters', mass: 12, count: 2, explode: [1.0, 0.2, 0],
    desc: 'Each generator\'s feeder runs down through the cabin roof to its control unit, the converters and the distribution panel. A current transformer on the feeder lets the GCU see a fault current, and a current limiter protects the bus; each set is interchangeable side to side.',
  }, [mesh(merge(fd), MAT.wiring()), mesh(merge(ct), MAT.casting())]);
  P('APU generator', {
    system: 'Electrical', material: '115 V AC generator on the APU gearbox', mass: 14, explode: [-1.2, 1.5, -1.0],
    desc: 'Driven by the APU, it powers the aircraft on the ground with the rotor stopped — for avionics checks, cabin lights and the backup hydraulic pump — and can supply all the flight-essential buses, or the blade de-ice if one main generator fails.',
  }, [mesh(cyl(0.075, 0.075, 0.16, [-2.42, 2.32, 0.17], 'x', 16), MAT.casting())]);
  P('Main battery', {
    system: 'Electrical', material: '24 V battery (5.5 Ah NiCd or 9.5 Ah sealed lead-acid)', mass: 36, explode: [0.4, 0.3, -0.9],
    desc: 'Powers the APU start control and ignition and keeps the essential buses alive if both converters fail: about 22 minutes by day and 14 at night from 80 % charge. Shown where the UH-60A/L manual and S-70A rescue charts put it, on the cabin floor behind the copilot, cabled up the closet side to the DC distribution panel; its UH-60M location is not in public sources.',
  }, [mesh(merge([box(0.24, 0.2, 0.28, [2.24, 0.79, -0.56]), box(0.2, 0.02, 0.24, [2.24, 0.9, -0.56])]), MAT.black()),
    mesh(merge([pipe([[2.24, 0.91, -0.62], [2.25, 1.0, -0.72], [2.25, 1.4, -0.79], [2.24, 1.85, -0.8], [2.2, 2.0, -0.6], [2.1, 2.05, -0.3]], 0.011, 5), cyl(0.022, 0.022, 0.03, [2.24, 0.915, -0.5], 'y', 8)]), MAT.wiring())]);
  P('AC/DC converters', {
    system: 'Electrical', material: 'Two 200 A transformer-rectifier units', mass: 16, count: 2, explode: [0.8, 0.8, 0],
    desc: 'Turn 115 V AC into 28 V DC for most of the aircraft\'s equipment; two 200 A units, so one can fail without losing the DC buses. There is no external DC connector — all DC comes from these and the battery.',
  }, [mesh(merge([box(0.3, 0.18, 0.4, [2.0, 1.88, 0.55]), box(0.3, 0.18, 0.4, [2.0, 1.88, -0.55])]), MAT.avionics())]);
  P('Power distribution panels', {
    system: 'Electrical', material: 'AC and DC bus panels, relays and circuit protection', mass: 12, count: 2, explode: [0.9, 0.9, 0],
    desc: 'AC and DC buses are split into primary and essential groups, so losing one generator or converter sheds only the non-essential loads; an electric priority feature lets a main generator supersede the APU generator, which supersedes external power. (Location approximate.)',
  }, [mesh(merge([box(0.25, 0.12, 0.22, [2.0, 2.06, 0.18]), box(0.25, 0.12, 0.22, [2.0, 2.06, -0.18])]), MAT.avionics())]);
  P('External AC power receptacle', {
    system: 'Electrical', material: 'Three-pin 115 V 400 Hz ground-power receptacle behind a hinged door', mass: 1, explode: [-0.3, 0, 0.9],
    desc: 'On the right side of the fuselage, it accepts 115 V, three-phase, 400 Hz ground power; an advisory light shows EXT PWR CONNECTED. There is deliberately no DC socket.',
  }, [mesh(onSkin(-2.05, 0.08, box(0.16, 0.012, 0.16, [0, 0.004, 0])), MAT.paintDark()), mesh(merge([onSkin(-2.05, 0.08, cyl(0.04, 0.04, 0.012, [0, 0.012, 0], 'y', 14))]), MAT.black())]);
  // harnesses kept 6 cm inside the skin, following its curvature
  const inSkin = (pts, side, inset = 0.06) => pts.map(([x, a]) => surfPoint(x, side > 0 ? a : Math.PI - a, -inset));
  const wires = [];
  for (const s of [1, -1]) wires.push(pipe(inSkin([[3.95, 0.1], [3.5, 0.6], [3.0, 0.98], [2.4, 1.08], [1.0, 1.08], [-0.6, 1.08], [-1.75, 1.05], [-2.25, 0.95]], s), 0.016));
  P('Cabin wiring harnesses', {
    system: 'Electrical', material: 'Shielded wiring bundles in clamped runs', mass: 30, explode: [0, 0.7, 0], xrayWeight: 0.6,
    desc: 'Several kilometres of wire run up from the nose bay and aft along both sides of the cabin roof; critical circuits are duplicated and routed apart for survivability.',
  }, [mesh(merge(wires), MAT.wiring())]);
  const tw = [];
  for (let x = -2.4; x > -8.5; x -= 0.6) tw.push([x, Math.PI - 1.15]);
  P('Tail cone wiring harness', {
    system: 'Electrical', material: 'Shielded wiring bundle', mass: 12, explode: [-2.2, 0.6, -0.5], xrayWeight: 0.6,
    desc: 'Runs aft along the upper left of the tail cone to the tail lights, the tail-rotor de-ice slip ring, the stabilator actuators and the aft sensors.',
  }, [mesh(pipe([inSkin([[-2.25, 0.95]], -1)[0], ...inSkin(tw, 1, 0.04), V3(...DEICE.tailEnd)], 0.012), MAT.wiring())]);
  // windshield wipers: pivots at the base of each windshield, arms lying on the glass
  const wp = [];
  for (const s of [1, -1]) {
    const pts = [];
    for (let i = 0; i <= 6; i++) pts.push(surfPoint(4.12 - i * 0.07, sideA(0.8 + i * 0.045, s), 0.02));
    wp.push(pipe(pts, 0.008, 5), onSkin(4.12, sideA(0.8, s), cyl(0.025, 0.025, 0.03, [0, 0.01, 0], 'y', 10)));
    const tip = surfPoint(3.75, sideA(1.05, s), 0.026), mid = surfPoint(3.95, sideA(0.92, s), 0.026);
    wp.push(tube(mid, tip, 0.012, 6));
  }
  P('Windshield wipers', {
    system: 'Electrical', material: 'Electric wiper motors, arms and blades', mass: 3, count: 2, explode: [1.4, 0.4, 0],
    desc: 'One electric wiper for each pilot\'s windshield. Its pivot sits under a wire-strike deflector ramp, so a wire slides over the wiper instead of catching it.',
  }, [mesh(merge(wp), MAT.black())]);

  // ------------------------------------------------------------------ blade de-ice control and icing sensors
  P('Blade de-ice controller & junction box', {
    system: 'Electrical', material: 'De-ice system controller, junction box with current limiters', mass: 8, count: 2, explode: [-0.4, -0.5, -0.4],
    desc: 'The controller times the heater cycles: the ice detector\'s icing rate sets how long the heaters stay off between cycles, and the outside air temperature sets how long each stays on. Main-rotor heater power passes through current limiters in the junction box on to the slip ring, and the tail-rotor feed goes out through the cabin and tail-cone harnesses. A test panel and caution lights report faults. (Shown on the left roof beam; cabin location approximate.)',
  }, [mesh(merge([box(0.25, 0.12, 0.15, [-1.02, 2.11, -0.357]), box(0.2, 0.1, 0.1, DEICE.jb)]), MAT.avionics()),
    mesh(merge([box(0.62, 0.13, 0.006, [-0.87, 2.11, -0.428]),                                       // mounting plate on the beam's inboard face
      ...[-1.12, -0.92, -0.8, -0.64].map((x) => cyl(0.008, 0.008, 0.012, [x, 2.16, -0.425], 'z', 6)),
      cyl(0.022, 0.022, 0.025, [DEICE.lead[0] + 0.01, DEICE.lead[1], DEICE.lead[2]], 'x', 10),       // slip-ring lead connector
      cyl(0.02, 0.02, 0.02, [-1.02, 2.045, -0.36], 'y', 10)]), MAT.casting()),                        // harness connector
    // pigtail from the left cabin harness, under the roof beam, to the controller; link to the junction box
    mesh(merge([pipe([surfPoint(-1.02, Math.PI - 1.08, -0.06), [-1.02, 2.07, -0.63], [-1.02, 2.045, -0.55], [-1.02, 2.04, -0.46], [-1.02, 2.045, -0.4], [-1.02, 2.05, -0.36]], 0.012, 6),
      pipe([[-0.895, 2.12, -0.36], [-0.86, 2.13, -0.362], [-0.82, 2.12, -0.37]], 0.01, 5)]), MAT.wiring())]);
  P('Ice detector', {
    system: 'Sensors', material: 'Vibrating-probe ice detector on a short strut', mass: 1, explode: [0.4, 0.6, 0.6],
    desc: 'A probe vibrating at its natural frequency: ice building on it adds mass and lowers the frequency, which the detector turns into an icing rate — trace, light, moderate or heavy — on a cockpit meter and for the de-ice controller. On the upper right fuselage (position approximate).',
  }, [mesh(merge([onSkin(1.75, 0.78, merge([cyl(0.03, 0.025, 0.08, [0, 0.04, 0], 'y', 10), cyl(0.008, 0.008, 0.1, [0.0, 0.12, 0], 'y', 8)]))]), MAT.steel())]);
  P('OAT sensor', {
    system: 'Sensors', material: 'Outside-air-temperature probe', mass: 0.3, explode: [0.6, -0.2, 0.3],
    desc: 'Below the windshield, it reads the outside air temperature for the instruments and for the de-ice controller: the colder the air, the longer each blade heater stays on.',
  }, [mesh(onSkin(4.32, 0.25, merge([cyl(0.02, 0.012, 0.07, [0, 0.035, 0], 'y', 8), cyl(0.025, 0.025, 0.01, [0, 0.0, 0], 'y', 10)])), MAT.steel())]);

  // ------------------------------------------------------------------ avionics (nose bay and aft transition avionics compartment)
  const rack = (boxes) => merge(boxes.map(([x, y, z, w, h, d]) => box(w, h, d, [x, y, z])));
  // nose-bay equipment racks: three trays on tubular posts standing on the bay floor (the lower skin)
  const bottomAt = (x, z) => { let lo = -Math.PI / 2, hi = 0; for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (surfPoint(x, m).z < Math.abs(z)) lo = m; else hi = m; } return surfPoint(x, lo).y; };
  const trays = [
    { x0: 4.1, x1: 4.4, z0: -0.45, z1: 0.07, y: 0.77, posts: [[4.11, 0.06], [4.39, 0.06], [4.39, -0.44]] },        // AFCS computers
    { x0: 4.4, x1: 4.62, z0: -0.3, z1: 0.3, y: 0.85, posts: [[4.41, 0.29], [4.41, -0.29], [4.61, 0.29], [4.61, -0.29]] },   // GPS/INS units
    { x0: 4.15, x1: 4.48, z0: -0.46, z1: 0.46, y: 1.13, posts: [[4.16, 0.45], [4.16, -0.45], [4.47, 0.45], [4.47, -0.45]] },  // FMS / display computers
  ];
  const rk = [], rkPost = [];
  for (const t of trays) {
    rk.push(box(t.x1 - t.x0, 0.015, t.z1 - t.z0, [(t.x0 + t.x1) / 2, t.y, (t.z0 + t.z1) / 2]));
    rk.push(box(t.x1 - t.x0, 0.03, 0.012, [(t.x0 + t.x1) / 2, t.y + 0.015, t.z0 + 0.006]), box(t.x1 - t.x0, 0.03, 0.012, [(t.x0 + t.x1) / 2, t.y + 0.015, t.z1 - 0.006]));   // tray lips
    for (const [x, z] of t.posts) rkPost.push(tube([x, bottomAt(x, z) - 0.01, z], [x, t.y, z], 0.012, 8), cyl(0.024, 0.024, 0.01, [x, bottomAt(x, z) + 0.004, z], 'y', 10));
  }
  P('Nose avionics racks', {
    system: 'Avionics', material: 'Aluminium equipment trays with hold-down clamps on tubular posts', mass: 9, explode: [2.0, 0.0, 0],
    desc: 'The nose bay behind the hinged doors holds the flight-critical computers on three trays, at waist height for a maintainer standing on the ground: the AFCS computers low on the left, the GPS/INS units forward and the flight-management and display computers on top. Each unit slides in and clamps down, so it can be swapped in minutes.',
  }, [mesh(merge(rk), MAT.structure()), mesh(merge(rkPost), MAT.casting())]);
  P('Flight management & display computers', {
    system: 'Avionics', material: 'Dual flight-management computers and display generators', mass: 22, count: 2, explode: [1.9, 0.5, 0],
    desc: 'Dual computers drive the four displays and run navigation, fuel planning and moving maps — the heart of the M model\'s common avionics architecture.',
  }, [mesh(rack([[4.32, 1.2175, 0.24, 0.3, 0.16, 0.22], [4.32, 1.2175, -0.24, 0.3, 0.16, 0.22]]), MAT.avionics())]);
  P('Embedded GPS/INS units', {
    system: 'Avionics', material: 'Two ring-laser-gyro inertial units with embedded GPS receivers', mass: 18, count: 2, explode: [2.1, 0.2, 0],
    desc: 'Two embedded GPS/inertial units give position, attitude and heading for the displays and autopilot; either can do the job alone.',
  }, [mesh(rack([[4.5, 0.9425, 0.18, 0.2, 0.17, 0.2], [4.5, 0.9425, -0.18, 0.2, 0.17, 0.2]]), MAT.avionics())]);
  P('Digital AFCS computers', {
    system: 'Avionics', material: 'Dual flight-control computers', mass: 12, count: 2, explode: [1.8, 0.0, 0],
    desc: 'The digital automatic flight control system: stability augmentation, trim, attitude and altitude hold and coupled approaches to a hover, through the SAS and trim actuators. On the M the same two computers also drive the stabilator.',
  }, [mesh(rack([[4.25, 0.8575, -0.3, 0.26, 0.16, 0.2], [4.25, 0.8575, -0.06, 0.26, 0.16, 0.2]]), MAT.avionics())]);
  P('Communication radios & IFF', {
    system: 'Communications', material: 'VHF/UHF/FM (SINCGARS) and HF radios, IFF transponder', mass: 40, explode: [-0.9, 0.9, 0],
    desc: 'Radios on a shelf in the aft avionics compartment, behind the stowage compartments: secure VHF-FM for ground troops, VHF/UHF (including satellite) for aviation and HF for long range, plus an IFF transponder.',
  }, [mesh(rack([[-2.65, 1.68, -0.25, 0.32, 0.18, 0.3], [-2.65, 1.68, 0.12, 0.32, 0.18, 0.3], [-3.0, 1.67, -0.1, 0.3, 0.16, 0.36], [-2.8, 1.58, -0.05, 0.6, 0.02, 0.9]]), MAT.avionics())]);
  P('Health monitoring & data recorders', {
    system: 'Avionics', material: 'Integrated vehicle health management unit, crash-survivable memory unit', mass: 12, explode: [-1.2, 1.1, 0.5],
    desc: 'The M\'s integrated vehicle health management system: vibration sensors on the drive train feed a monitoring unit that flags wearing bearings and gears before they fail, and a crash-survivable memory unit keeps flight data and cockpit audio.',
  }, [mesh(rack([[-3.0, 1.67, 0.38, 0.22, 0.16, 0.2]]), MAT.avionics()), mesh(box(0.18, 0.14, 0.14, [-3.0, 1.82, 0.38]), MAT.red())]);

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
  P('Stormscope antenna', {
    system: 'Sensors', material: 'Passive lightning-detection antenna', mass: 1, explode: [0, -0.9, 0.3],
    desc: 'Stormscope, one of the UH-60M cockpit\'s listed features, listens passively for the radio crackle of lightning and maps thunderstorm activity on the displays without a weather radar. (Placement not published; shown on the belly.)',
  }, [mesh(onSkin(2.0, -Math.PI / 2 + 0.25, box(0.25, 0.04, 0.12, [0, 0.01, 0])), MAT.radome())]);
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
  }, [mesh(box(0.22, 0.14, 0.2, [-3.0, 1.66, -0.4]), MAT.avionics())]);

  // ------------------------------------------------------------------ aircraft survivability equipment
  // Encyclopedic level: the visible sensor fairings and dispensers of the UH-60M's ASE suite.
  const dome = (r, h) => new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, h / r, 1);
  const both = (x, a, make, off) => [onSkin(x, a, make(), off), onSkin(x, Math.PI - a, make(), off)];
  P('Missile warning sensors (CMWS)', {
    system: 'Sensors', material: 'AN/AAR-57 ultraviolet electro-optic sensors in faceted fairings', mass: 12, count: 4, explode: [0, 0.4, 0.9],
    desc: 'The Common Missile Warning System watches all round the aircraft for the ultraviolet flash of a missile motor and cues the countermeasures automatically. Two sensors face forward on the nose and two aft on the rear fuselage (typical installation).',
  }, [mesh(merge([...both(4.05, -0.32, () => cyl(0.075, 0.06, 0.08, [0, 0.03, 0], 'y', 6)), ...both(-3.95, -0.25, () => cyl(0.07, 0.055, 0.08, [0, 0.03, 0], 'y', 6))]), MAT.paintDark()),
    mesh(merge([...both(4.05, -0.32, () => cyl(0.045, 0.045, 0.012, [0, 0.075, 0], 'y', 12)), ...both(-3.95, -0.25, () => cyl(0.042, 0.042, 0.012, [0, 0.075, 0], 'y', 12))]), MAT.lens())]);
  P('CMWS electronic control unit', {
    system: 'Sensors', material: 'Processor box in the aft avionics compartment', mass: 8, explode: [-1.4, 0.8, 0],
    desc: 'Fuses the four sensors\' detections, rejects false alarms such as sun glints and fires, and tells the crew and the dispensers where a threat is coming from.',
  }, [mesh(box(0.26, 0.14, 0.22, [-3.28, 1.66, 0.0]), MAT.avionics())]);
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
  const lamp = (x, side) => surfPoint(x, side > 0 ? -Math.PI / 2 + 0.22 : 1.5 * Math.PI - 0.22);
  const ll = lamp(3.15, -1), sl = lamp(3.15, 1);
  P('Landing light', {
    system: 'Electrical', material: '600 W retractable, extendable landing lamp under the nose, left', mass: 4, explode: [0.5, -0.8, -0.6],
    desc: 'A 600 W lamp under the left side of the nose. It extends, retracts and aims from a switch on the collective, so the pilot never takes a hand off the controls on a night approach.',
  }, [mesh(merge([cyl(0.1, 0.1, 0.05, [ll.x, ll.y - 0.02, ll.z], 'y', 20)]), MAT.black()), mesh(cyl(0.085, 0.085, 0.01, [ll.x, ll.y - 0.05, ll.z], 'y', 20), MAT.lens())]);
  P('Searchlight', {
    system: 'Electrical', material: 'Steerable searchlight (150 W, up to 450 W lamps) under the nose, right', mass: 6, explode: [0.5, -0.8, 0.6],
    desc: 'Under the right side of the nose, slewed from the collective: it swings forward through 120° and turns a full 360°. An infrared filter turns it into an invisible light for crews on night-vision goggles.',
  }, [mesh(merge([cyl(0.11, 0.11, 0.06, [sl.x, sl.y - 0.02, sl.z], 'y', 20), box(0.08, 0.06, 0.08, [sl.x, sl.y + 0.02, sl.z])]), MAT.black()), mesh(cyl(0.09, 0.09, 0.01, [sl.x, sl.y - 0.055, sl.z], 'y', 20), MAT.lens())]);
  const dl = [];
  // cabin domes under the roof frames at x −1.2 and 1.0 and under the aft roof cross beam; cockpit
  // floods under the canopy-bow frame
  for (const [x, y] of [[-1.2, 2.158], [-0.5, 2.061], [1.0, 2.17]]) dl.push(cyl(0.06, 0.06, 0.02, [x, y, 0], 'y', 14));
  for (const z of [0.4, -0.4]) dl.push(cyl(0.035, 0.035, 0.05, [2.75, 2.168, z], 'y', 10));
  P('Cockpit & cabin lighting', {
    system: 'Electrical', material: 'NVG-compatible dome, flood and utility lights', mass: 3, count: 5, explode: [0, 0.4, 0],
    desc: 'Cabin dome lights switch between white and a dim blue-green that does not blind night-vision goggles; cockpit floods and utility lights are NVG-compatible too.',
  }, [mesh(merge(dl), MAT.lens())]);

  // ------------------------------------------------------------------ heating and ventilation
  P('Heater mixing valve & overtemperature sensors', {
    system: 'Environmental control', material: 'Bleed-air modulation and mixing valve, mixing chamber, two overtemperature sensors', mass: 6, explode: [-0.3, 1.6, 0.9],
    desc: 'Bleed air from the engines, the APU or a ground cart is mixed here with outside air to the temperature set on the overhead HEATER control. Two sensors, at the valve inlet and in the mixing chamber, shut the bleed off at about 90–96 °C, and an interlock cuts the heater\'s flow when engine anti-ice is on so the engines are not over-bled.',
  }, [mesh(merge([cyl(0.07, 0.07, 0.16, [-1.62, 2.4, 0.27], 'x', 14), box(0.1, 0.1, 0.12, [-1.62, 2.38, 0.18]), cyl(0.016, 0.016, 0.04, [-1.56, 2.47, 0.27], 'y', 8), cyl(0.016, 0.016, 0.04, [-1.68, 2.47, 0.27], 'y', 8)]), MAT.casting())]);
  P('Ventilation blower', {
    system: 'Environmental control', material: 'Electric centrifugal blower', mass: 7, explode: [0.6, 1.4, 0.6],
    desc: 'With VENT BLOWER on, it forces outside air into the cabin ducts; switched off, the heater gives its maximum output. Ram-air vents beside the consoles cool the cockpit.',
  }, [mesh(merge([cyl(0.1, 0.1, 0.16, [1.82, 2.4, 0.28], 'x', 18), box(0.12, 0.12, 0.16, [1.68, 2.38, 0.28])]), MAT.casting())]);
  const ecs = [];
  for (const s of [1, -1]) ecs.push(pipe([[2.2, 1.97, 0.6 * s], [0.5, 1.97, 0.7 * s], [-1.6, 1.97, 0.7 * s]], 0.04, 8));
  ecs.push(pipe([[1.82, 2.32, 0.3], [2.3, 2.15, 0.4], [2.9, 2.05, 0.45], [3.5, 1.5, 0.75]], 0.035, 8));
  ecs.push(pipe([[1.75, 2.32, 0.28], [1.7, 2.1, 0.45], [1.8, 1.99, 0.62]], 0.035, 8));
  ecs.push(pipe([[-1.62, 2.34, 0.18], [-1.62, 2.12, 0.0], [-1.6, 2.0, -0.4], [-1.6, 1.97, -0.68]], 0.035, 8), pipe([[-1.62, 2.12, 0.1], [-1.6, 1.98, 0.5], [-1.6, 1.97, 0.68]], 0.035, 8));
  const reg = [];
  for (const s of [1, -1]) for (const x of [1.6, 0.4, -0.8]) reg.push(box(0.12, 0.03, 0.08, [x, 1.93, 0.68 * s]));
  P('Heating & ventilation ducts & registers', {
    system: 'Environmental control', material: 'Composite ducts along the cabin ceiling, adjustable registers', mass: 14, explode: [0.0, 1.15, 0], xrayWeight: 0.5,
    desc: 'Ducts carry the mixed or ventilating air along both sides of the cabin ceiling and forward to the cockpit, with adjustable registers over the seats.',
  }, [mesh(merge(ecs), MAT.casting()), mesh(merge(reg), MAT.black())]);
  const hi = aftDeckPoint(roofY, -2.3, 0.15), hq = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), hi.n);
  const onFair = (g, off) => { const c = hi.p.clone().addScaledVector(hi.n, off); return g.applyQuaternion(hq).translate(c.x, c.y, c.z); };
  const intakeFace = onFair(box(0.15, 0.008, 0.07, [0, 0, 0]), 0.0);
  const intakeGrid = merge([0, 1, 2, 3].map((k) => onFair(box(0.008, 0.008, 0.06, [-0.045 + k * 0.03, 0, 0]), 0.006)));
  const intakeIn = hi.p.clone().addScaledVector(hi.n, -0.03);
  P('Heater air intake port', {
    system: 'Environmental control', material: 'Screened ambient-air intake with short duct to the mixing valve', mass: 1, explode: [-0.3, 1.2, 1.3],
    desc: 'The heater\'s cold-air source: a screened intake low on the right side of the aft deck fairing, behind the engine cowling and under the exhaust, feeds outside air forward under the extinguisher bottles to the mixing valve, where bleed air warms it. (Position approximate.)',
  }, [mesh(merge([intakeFace, intakeGrid]), MAT.black()), mesh(pipe([intakeIn, [-2.22, 2.29, 0.27], [-2.05, 2.29, 0.24], [-1.85, 2.29, 0.24], [-1.77, 2.33, 0.26], [-1.71, 2.39, 0.27]], 0.025, 8), MAT.casting())]);

  return handles;
}
