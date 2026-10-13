// UH-60M landing gear, fuel and external load: fixed main gear (drag beams, two-stage
// energy-absorbing oleos, wheels and brakes, brake plumbing, weight-on-wheels switches), the
// castoring tail gear (strut, yoke, wheel, lock), the two crash-resistant self-sealing fuel cells
// with their pumps, valves, probes, drains and refuelling ports, and the 9,000 lb cargo hook,
// which stows in a well in the belly.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { loftRings, orientOutward, lathe } from '../../engine/geometry.js';
import { MAT, V3, merge, box, cyl, tube, pipe } from './common.js';

const AXLE = { x: 2.3, y: 0.33, z: 1.355 };   // track 2.71 m

function tire(r, w, seg = 36) {
  const prof = [];
  for (let k = 0; k <= 12; k++) {
    const a = -Math.PI / 2 + (Math.PI * k) / 12;
    prof.push([r - w * 0.32 + Math.cos(a) * w * 0.32, Math.sin(a) * w * 0.5]);
  }
  prof.unshift([r * 0.62, -w * 0.46]);
  prof.push([r * 0.62, w * 0.46]);
  const g = lathe(prof, seg);
  g.rotateX(Math.PI / 2);   // axle along z
  return g;
}

/** Rounded box loft between two rectangular sections (fuel cells). */
function cell(front, rear, n = 24) {
  const ring = ({ x, y0, y1, z0, z1 }) => {
    const pts = [];
    const cy = (y0 + y1) / 2, cz = (z0 + z1) / 2, hy = (y1 - y0) / 2, hz = (z1 - z0) / 2;
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      pts.push([x, cy + hy * Math.sign(s) * Math.abs(s) ** (2 / 6), cz + hz * Math.sign(c) * Math.abs(c) ** (2 / 6)]);
    }
    return pts;
  };
  const rings = [];
  for (let k = 0; k <= 4; k++) {
    const t = k / 4;
    const lerp = (a, b) => a + (b - a) * t;
    rings.push(ring({ x: lerp(rear.x, front.x), y0: lerp(rear.y0, front.y0), y1: lerp(rear.y1, front.y1), z0: lerp(rear.z0, front.z0), z1: lerp(rear.z1, front.z1) }));
  }
  return orientOutward(loftRings(rings, { capStart: true, capEnd: true }));
}

export function buildGear({ A, P }) {
  const oleos = [];
  const wowAt = [];
  for (const side of [1, -1]) {
    const s = side, zW = AXLE.z * s;
    const R = side > 0 ? '(right)' : '(left)';
    const pivot = V3(3.12, 0.5, 0.9 * s), axleIn = V3(AXLE.x, AXLE.y + 0.02, 1.17 * s);
    const beam = [tube(pivot, axleIn, 0.07, 12), box(0.18, 0.16, 0.16, [pivot.x, pivot.y, pivot.z]), cyl(0.05, 0.05, 0.3, [AXLE.x, AXLE.y, 1.2 * s], 'z', 14)];
    P(`Main gear drag beam ${R}`, {
      system: 'Landing gear', material: 'Forged high-strength steel beam', mass: 38, explode: [0.4, -1.0, 0.8 * s],
      desc: 'A trailing beam pivoted on the lower fuselage carries the wheel. In a hard landing it swings up, stroking the oleo; in a crash it can fail in a controlled way rather than punch into the cabin.',
    }, [mesh(merge(beam), MAT.steel())]);
    wowAt.push(V3(2.22, 1.2, 1.12 * s));
    // two-stage oleo: outer cylinder from the airframe fitting, piston down to the beam
    const top = V3(2.22, 1.26, 1.19 * s), bot = V3(AXLE.x - 0.02, AXLE.y + 0.07, 1.2 * s);
    const holder = new THREE.Group();
    const cylG = merge([tube(top, top.clone().lerp(bot, 0.55), 0.075, 16), box(0.14, 0.12, 0.12, [top.x, top.y, top.z])]);
    const pistonGroup = new THREE.Group();
    const pistonG = tube(top.clone().lerp(bot, 0.45), bot, 0.05, 14);
    pistonGroup.add(mesh(pistonG, MAT.hydraulic()));
    holder.add(mesh(cylG, MAT.paintDark()), pistonGroup);
    P(`Main gear oleo ${R}`, {
      system: 'Landing gear', material: 'Steel cylinder, chromed piston, nitrogen and hydraulic fluid', mass: 30, explode: [0.2, -0.6, 1.0 * s],
      desc: 'Two-stage shock strut: a normal stage for everyday landings and a high-pressure crash stage that absorbs a large share of a survivable vertical impact (design goal ≈ 11.6 m/s / 38 ft/s) before the airframe has to.',
    }, holder);
    oleos.push({ pistonGroup, dir: bot.clone().sub(top).normalize() });
    const wheel = [tire(0.33, 0.25)];
    const hubG = [cyl(0.16, 0.16, 0.2, [0, 0, 0], 'z', 24), cyl(0.07, 0.07, 0.26, [0, 0, 0], 'z', 16)];
    for (const g of wheel) g.translate(AXLE.x, AXLE.y, zW);
    for (const g of hubG) g.translate(AXLE.x, AXLE.y, zW);
    const brake = cyl(0.13, 0.13, 0.03, [AXLE.x, AXLE.y, zW - 0.11 * s], 'z', 24);
    P(`Main wheel & brake ${R}`, {
      system: 'Landing gear', material: '26 × 10 tyre, aluminium wheel, hydraulic disc brake', mass: 42, explode: [0, -1.1, 1.4 * s],
      desc: 'Fixed gear: no retraction system to fail or to fill with dust. The 2.71 m track and wide tyres let it land on rough ground and slopes; the brakes hold it on the deck with the rotor turning.',
    }, [mesh(wheel[0], MAT.rubber()), mesh(merge(hubG), MAT.casting()), mesh(brake, MAT.steel())]);
  }

  // tail gear: 28.93 ft (8.82 m) behind the main axles (GenHel wheel base)
  const tw = { x: AXLE.x - 8.82, y: 0.22 };
  const tTop = V3(-6.12, 1.3, 0), tBot = V3(-6.4, 0.4, 0);
  P('Tail gear shock strut', {
    system: 'Landing gear', material: 'Steel cylinder and chromed piston, oil and nitrogen', mass: 18, explode: [0, -0.5, 0.5],
    desc: 'Its own two-stage oleo, mounted to a fitting in the tail cone. It protects the tail cone and tail rotor in a tail-low landing and strokes in a crash like the main struts.',
  }, [mesh(merge([tube(tTop, tTop.clone().lerp(tBot, 0.6), 0.075, 16), box(0.2, 0.12, 0.2, [tTop.x, tTop.y, 0])]), MAT.paintDark()), mesh(tube(tTop.clone().lerp(tBot, 0.5), tBot, 0.05, 14), MAT.hydraulic())]);
  P('Tail wheel yoke & axle', {
    system: 'Landing gear', material: 'Forged steel fork and axle on a swivel', mass: 10, explode: [0, -0.9, 0],
    desc: 'The fork swivels a full 360° below the strut so the tail follows the main wheels when taxiing or turning on the spot.',
  }, [mesh(merge([tube(tBot, V3(tw.x, tw.y, 0.1), 0.035, 10), tube(tBot, V3(tw.x, tw.y, -0.1), 0.035, 10), box(0.1, 0.08, 0.26, [tBot.x, tBot.y, 0]), cyl(0.03, 0.03, 0.24, [tw.x, tw.y, 0], 'z', 10)]), MAT.steel())]);
  P('Tail wheel & tyre', {
    system: 'Landing gear', material: 'Aluminium wheel, 15 × 6 class tyre (size approximate)', mass: 10, explode: [0, -1.3, 0],
    desc: 'A single castoring tail wheel, about 8.8 m behind the main wheels. It keeps the tail rotor clear of the ground on landing.',
  }, [mesh(tire(0.22, 0.15).translate(tw.x, tw.y, 0), MAT.rubber()), mesh(cyl(0.11, 0.11, 0.13, [tw.x, tw.y, 0], 'z', 18), MAT.casting())]);
  P('Tail wheel lock actuator', {
    system: 'Landing gear', material: 'Electrically actuated lock pin at the swivel', mass: 2, explode: [0.3, -0.4, 0.4],
    desc: 'A cockpit switch drives a pin into the swivel to hold the tail wheel straight for take-off, running landings and parking on slopes; unlocked, the wheel castors freely.',
  }, [mesh(merge([cyl(0.035, 0.035, 0.14, [tBot.x + 0.12, tBot.y + 0.12, 0.07], 'y', 10), box(0.06, 0.05, 0.05, [tBot.x + 0.1, tBot.y + 0.04, 0.05])]), MAT.casting())]);

  // brake plumbing: master cylinders on the pilots' pedals, lines along the floor and the drag beams
  const brk = [], mc = [];
  for (const z of [0.53, -0.53]) for (const dz of [0.12, -0.12]) mc.push(cyl(0.018, 0.018, 0.12, [3.62, 0.74, z + dz], 'x', 8));
  for (const s of [1, -1]) {
    brk.push(pipe([[3.58, 0.72, 0.65 * s], [3.2, 0.64, 0.75 * s], [3.0, 0.62, 0.86 * s], [3.05, 0.53, 0.95 * s], [2.7, 0.42, 1.08 * s], [2.36, 0.37, 1.2 * s], [2.3, 0.33, 1.24 * s]], 0.007, 5));
  }
  brk.push(box(0.08, 0.05, 0.08, [3.25, 0.66, 0.0]));     // parking-brake valve
  P('Brake master cylinders & lines', {
    system: 'Landing gear', material: 'Pedal master cylinders, parking-brake valve, steel and flexible brake lines', mass: 5, explode: [0.6, -0.6, 0.6],
    desc: 'The toe brakes on each pilot\'s pedals work master cylinders; their lines run under the cockpit floor and down the drag beams to the wheel brakes, with a parking-brake valve to hold the aircraft on the deck.',
  }, [mesh(merge(mc), MAT.hydraulic()), mesh(merge(brk), MAT.steel())]);
  P('Weight-on-wheels switches', {
    system: 'Landing gear', material: 'Sealed proximity switches on the main-gear fittings (location approximate)', mass: 1, count: 2, explode: [0.3, -0.3, 0.9],
    desc: 'Tell the aircraft systems whether it is on the ground: the AFCS, stabilator, de-ice, countermeasures and other systems change their behaviour at touchdown and lift-off.',
  }, [mesh(merge(wowAt.map((p) => box(0.05, 0.05, 0.05, [p.x, p.y, p.z]))), MAT.yellow())]);

  // ------------------------------------------------------------------ fuel
  for (const side of [1, -1]) {
    const s = side;
    const z = (a, b) => (s > 0 ? [a, b] : [-b, -a]);
    const [fz0, fz1] = z(0.05, 0.92), [rz0, rz1] = z(0.05, 0.66);
    const g = cell({ x: -1.84, y0: 0.56, y1: 1.5, z0: fz0, z1: fz1 }, { x: -3.0, y0: 0.84, y1: 1.5, z0: rz0, z1: rz1 });
    const fittings = [cyl(0.06, 0.06, 0.06, [-2.3, 1.52, 0.5 * s], 'y', 14), cyl(0.05, 0.05, 0.05, [-2.6, 0.9, 0.5 * s], 'y', 12)];
    P(side > 0 ? 'Fuel cell (right)' : 'Fuel cell (left)', {
      system: 'Fuel', material: 'Crash-resistant, self-sealing rubberised-fabric bladder', mass: 40, explode: [-0.3, -1.4, 0.9 * s],
      desc: 'One of two cells holding 360 US gal (1,360 L, ≈1,090 kg of JP-8) between them. Each must survive a 20 m (65 ft) drop test full of water without leaking, and the self-sealing layers close up after small-arms penetration. Mass shown is the empty cell.',
      callout: side > 0, anchor: [-2.9, 0.9, 0.6],
    }, [mesh(g, MAT.fuelCell()), mesh(merge(fittings), MAT.casting())]);
  }
  // Each feed line stays inside a skin all the way: up through the transition section, through the
  // roof into the aft deck fairing, across into the engine bay where the fairing meets the cowl,
  // through the selector valve on the deck under the engine, round the underside of the engine
  // and up to the engine-driven boost pump.
  const lines = [];
  for (const s of [1, -1]) {
    lines.push(pipe([[-2.2, 1.5, 0.55 * s], [-2.1, 1.85, 0.47 * s], [-1.95, 2.1, 0.36 * s], [-1.8, 2.3, 0.3 * s], [-1.68, 2.41, 0.36 * s], [-1.66, 2.43, 0.44 * s], [-1.64, 2.36, 0.56 * s], [-1.6, 2.32, 0.6 * s]], 0.016));
    lines.push(pipe([[-1.5, 2.32, 0.6 * s], [-1.42, 2.3, 0.66 * s], [-1.3, 2.26, 0.8 * s], [-1.1, 2.28, 0.98 * s], [-0.95, 2.5, 1.02 * s], [-0.88, 2.62, 0.97 * s], [-0.87, 2.68, 0.93 * s]], 0.016));
  }
  lines.push(tube([-2.4, 1.0, 0.06], [-2.4, 1.0, -0.06], 0.03, 10));
  const valves = [];
  for (const s of [1, -1]) valves.push(cyl(0.035, 0.035, 0.06, [-2.2, 1.55, 0.55 * s], 'y', 12), cyl(0.03, 0.03, 0.05, [-1.89, 2.18, 0.34 * s], 'y', 10));
  P('Fuel lines & breakaway valves', {
    system: 'Fuel', material: 'Self-sealing hoses, frangible breakaway valves', mass: 20, explode: [-0.6, -0.6, 0],
    desc: 'Each cell feeds its own engine, which draws the fuel by suction, so a cut line sucks air instead of spraying fuel. Breakaway valves at every structural joint (here at the cell outlets and where the lines pass through the roof) seal both ends if a line is torn out in a crash — the main reason post-crash fires are rare in H-60s.',
  }, [mesh(merge(lines), MAT.hydraulic()), mesh(merge(valves), MAT.red())]);
  const selG = [];
  for (const s of [1, -1]) {
    selG.push(cyl(0.04, 0.04, 0.09, [-1.55, 2.32, 0.6 * s], 'x', 12), box(0.05, 0.03, 0.06, [-1.55, 2.27, 0.6 * s]));
    // crossfeed: from the valve's inboard side through the firewall into the aft deck fairing
    selG.push(pipe([[-1.55, 2.33, 0.555 * s], [-1.56, 2.42, 0.45 * s], [-1.56, 2.36, 0.3 * s], [-1.56, 2.3, 0.12 * s], [-1.56, 2.3, 0]], 0.012));
  }
  P('Fuel selector valves', {
    system: 'Fuel', material: 'Cable-operated two-way valves, crossfeed line', mass: 4, count: 2, explode: [-0.8, 0.9, 0],
    desc: 'One per engine, in the feed line on the deck beneath the engine (location approximate), worked by the fuel selector levers overhead: each engine can draw directly from its own cell or crossfeed from the other one through the line that crosses under the aft deck fairing.',
  }, [mesh(merge(selG), MAT.red())]);
  P('Fuel prime/boost pump', {
    system: 'Fuel', material: 'Electric pump in the left cell (location approximate)', mass: 4, explode: [-0.6, -0.3, -1.1],
    desc: 'An electric pump primes the engine fuel lines before a start and feeds the APU, which draws from the left cell; in flight the engines\' own pumps do the work.',
  }, [mesh(merge([cyl(0.06, 0.06, 0.14, [-2.65, 0.95, -0.45], 'y', 14), pipe([[-2.65, 1.02, -0.45], [-2.6, 1.6, -0.35], [-2.4, 2.25, -0.22], [-2.2, 2.4, -0.19]], 0.008)]), MAT.casting())]);
  const probes = [];
  for (const s of [1, -1]) probes.push(cyl(0.02, 0.02, 0.86, [-2.3, 1.06, 0.38 * s], 'y', 8), cyl(0.03, 0.03, 0.05, [-2.3, 1.5, 0.38 * s], 'y', 10), cyl(0.018, 0.018, 0.05, [-2.75, 0.9, 0.3 * s], 'x', 8));
  P('Fuel quantity probes', {
    system: 'Fuel', material: 'Capacitance probes and low-level sensors', mass: 2, count: 4, explode: [-0.2, -0.9, 0.4],
    desc: 'A capacitance probe standing in each cell measures the fuel height for the cockpit gauge, and a low-level sensor warns when about 20 minutes of fuel remain (approximate).',
  }, [mesh(merge(probes), MAT.steel())]);
  const drains = [];
  for (const s of [1, -1]) {
    drains.push(cyl(0.025, 0.025, 0.04, [-2.15, 0.535, 0.45 * s], 'y', 10));   // stands about 2 cm proud of the belly
    drains.push(pipe([[-2.0, 1.52, 0.7 * s], [-1.95, 1.9, 0.8 * s], [-1.92, 2.07, 0.79 * s]], 0.01));
  }
  P('Fuel sump drains & vents', {
    system: 'Fuel', material: 'Drain valves at the low points, vent lines with rollover valves', mass: 2, count: 4, explode: [-0.4, -1.1, 0.8],
    desc: 'Drain valves at each cell\'s low point let the crew check for water and sediment before flight; vent lines let air in as fuel is used, with valves that close if the aircraft rolls over.',
  }, [mesh(merge(drains), MAT.casting())]);
  P('Refuelling ports', {
    system: 'Fuel', material: 'Gravity filler caps and a closed-circuit pressure receptacle', mass: 4, count: 3, explode: [-0.3, 0, 1.3],
    desc: 'Gravity filler on each side behind the cabin door, plus a closed-circuit receptacle on the left for rapid "hot" refuelling with the rotor turning.',
  }, [mesh(merge([cyl(0.06, 0.06, 0.03, [-2.4, 1.3, 1.0], 'z', 16), cyl(0.06, 0.06, 0.03, [-2.4, 1.3, -1.0], 'z', 16), cyl(0.05, 0.05, 0.03, [-2.0, 1.0, -1.12], 'z', 16)]), MAT.yellow())]);

  // ------------------------------------------------------------------ cargo hook
  // stowed it lies forward inside a well in the belly; deployed it swings down to hang under the CG
  const hookPivot = new THREE.Group();
  hookPivot.position.set(-0.3, 0.55, 0);
  const hk = new THREE.TorusGeometry(0.06, 0.018, 8, 16, Math.PI * 1.4).rotateZ(Math.PI * 0.8).translate(0, -0.3, 0);
  hookPivot.add(mesh(merge([box(0.1, 0.12, 0.16, [0, -0.04, 0]), tube([0, -0.08, 0], [0, -0.25, 0], 0.028, 10), cyl(0.03, 0.03, 0.2, [0, 0, 0], 'z', 10), hk]), MAT.steel()));
  const well = box(0.46, 0.1, 0.8, [-0.08, 0.525, 0]);            // as wide as its opening in the belly skin
  const hookPart = P('External cargo hook', {
    system: 'Payload', material: 'Steel hook with electrical, manual and emergency release; recessed belly well', mass: 18, explode: [0, -1.3, 0],
    desc: 'Rated at 9,000 lb (4,082 kg), enough to sling a 105 mm howitzer or a light vehicle under the rotor, close to the centre of gravity so the load barely changes the trim. When not in use it swings up into a well in the belly (whether a door closes the well could not be confirmed from public sources, so none is modelled).',
    callout: true, anchor: [-0.1, 0.36, 0.1],
  }, [hookPivot, mesh(well, MAT.interior(), { cast: false })]);
  const setHook = (k) => { hookPivot.rotation.z = (1 - k) * Math.PI / 2; };
  setHook(0);

  return { oleos, setHook, hookPart };
}
