// UH-60M landing gear, fuel and external load: fixed main gear (drag beams, two-stage
// energy-absorbing oleos, wheels, two-disc brakes, brake plumbing, the weight-on-wheels switch,
// jack-and-kneel fittings), the castoring tail gear (strut, yoke, wheel, lock), the two
// crash-resistant self-sealing fuel cells with their valves, probes, drains, pressure-refuel
// manifold, frangible filler necks, feed lines, firewall selector valves and crossfeed, and the
// 9,000 lb cargo hook, which stows up in a belly well under a hatch in the cabin floor.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { loftRings, orientOutward, lathe } from '../../engine/geometry.js';
import { MAT, V3, merge, box, cyl, tube, pipe } from './common.js';
import { halfWidthAt, section } from './fuselage.js';

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
  for (const side of [1, -1]) {
    const s = side, zW = AXLE.z * s;
    const R = side > 0 ? '(right)' : '(left)';
    const pivot = V3(3.12, 0.5, 0.9 * s), axleIn = V3(AXLE.x, AXLE.y + 0.02, 1.17 * s);
    const beam = [tube(pivot, axleIn, 0.07, 12), box(0.18, 0.16, 0.16, [pivot.x, pivot.y, pivot.z]), cyl(0.05, 0.05, 0.3, [AXLE.x, AXLE.y, 1.2 * s], 'z', 14)];
    P(`Main gear drag beam ${R}`, {
      system: 'Landing gear', material: 'Forged high-strength steel beam', mass: 38, explode: [0.4, -1.0, 0.8 * s],
      desc: 'A trailing beam pivoted on the lower fuselage carries the wheel. In a hard landing it swings up, stroking the oleo; in a crash it can fail in a controlled way rather than punch into the cabin.',
    }, [mesh(merge(beam), MAT.steel())]);
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
      desc: 'A two-stage shock strut. The lower stage alone absorbs landings up to 10 ft/s (3 m/s); above that the upper and lower stages combine to absorb impacts up to 39 ft/s (11.9 m/s, about 11.25 g) before the airframe has to.',
    }, holder);
    oleos.push({ pistonGroup, dir: bot.clone().sub(top).normalize() });
    const wheel = [tire(0.33, 0.25)];
    const hubG = [cyl(0.16, 0.16, 0.2, [0, 0, 0], 'z', 24), cyl(0.07, 0.07, 0.26, [0, 0, 0], 'z', 16)];
    for (const g of wheel) g.translate(AXLE.x, AXLE.y, zW);
    for (const g of hubG) g.translate(AXLE.x, AXLE.y, zW);
    P(`Main wheel & tyre ${R}`, {
      system: 'Landing gear', material: '26 × 10 tyre, aluminium wheel', mass: 36, explode: [0, -1.1, 1.4 * s],
      desc: 'Fixed gear: no retraction system to fail or to fill with dust. The 2.71 m track and wide tyres let it land on rough ground and on slopes in any direction.',
    }, [mesh(wheel[0], MAT.rubber()), mesh(merge(hubG), MAT.casting())]);
    const bz = zW - 0.095 * s;
    P(`Main wheel brake ${R}`, {
      system: 'Landing gear', material: 'Two steel rotating discs, brake pucks, hydraulic piston housing', mass: 6, explode: [0.3, -0.8, 0.6 * s],
      desc: 'Each brake has two steel rotating discs gripped by brake pucks from a hydraulic housing. It adjusts itself as the pucks wear, and a pin shows the remaining puck life at a glance. The toe pedals work it, and a parking-brake handle locks both brakes.',
    }, [mesh(merge([cyl(0.15, 0.15, 0.012, [AXLE.x, AXLE.y, bz + 0.008 * s], 'z', 28), cyl(0.15, 0.15, 0.012, [AXLE.x, AXLE.y, bz + 0.03 * s], 'z', 28)]), MAT.steel()),
      mesh(merge([box(0.12, 0.08, 0.05, [AXLE.x + 0.13, AXLE.y + 0.04, bz - 0.01 * s]), cyl(0.008, 0.008, 0.05, [AXLE.x + 0.15, AXLE.y + 0.09, bz - 0.03 * s], 'z', 6)]), MAT.casting())]);
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
    brk.push(pipe([[3.58, 0.72, 0.65 * s], [3.2, 0.64, 0.75 * s], [3.0, 0.62, 0.86 * s], [3.05, 0.53, 0.95 * s], [2.7, 0.42, 1.08 * s], [2.45, 0.38, 1.2 * s], [2.43, 0.37, 1.23 * s]], 0.007, 5));
  }
  brk.push(box(0.08, 0.05, 0.08, [3.25, 0.66, 0.0]));     // parking-brake valve
  P('Brake master cylinders & lines', {
    system: 'Landing gear', material: 'Pedal master cylinders, parking-brake valve, steel and flexible brake lines', mass: 5, explode: [0.6, -0.6, 0.6],
    desc: 'The toe brakes on each pilot\'s pedals work master cylinders; their lines run under the cockpit floor and down the drag beams to the wheel brakes, with a parking-brake valve to hold the aircraft on the deck.',
  }, [mesh(merge(mc), MAT.hydraulic()), mesh(merge(brk), MAT.steel())]);
  P('Weight-on-wheels switch', {
    system: 'Landing gear', material: 'Sealed switch on the left main gear', mass: 1, explode: [0.3, -0.3, -0.9],
    desc: 'One switch on the left main gear tells the aircraft whether it is on the ground. In flight it arms the backup hydraulic pump\'s automatic start, disables the leak tests and the generators\' underfrequency protection, and changes other systems\' behaviour. Aircraft with external-stores provisions add a second switch on the right drag beam for underfrequency cutout and stores jettison.',
  }, [mesh(merge([box(0.05, 0.05, 0.05, [2.22, 1.2, -1.12]), tube([2.22, 1.2, -1.12], [2.24, 1.3, -1.08], 0.005, 4)]), MAT.yellow())]);
  // jack-and-kneel: jacking pads under the main-gear fittings and the tail cone, kneel fittings at the oleo tops
  const jk = [];
  for (const s of [1, -1]) {
    const z = (halfWidthAt(2.6, 0.6) - 0.12) * s;
    jk.push(cyl(0.045, 0.045, 0.03, [2.6, 0.545, z], 'y', 14), box(0.12, 0.05, 0.1, [2.6, 0.58, z]), box(0.08, 0.05, 0.07, [2.22, 1.34, 1.19 * s]));
  }
  const yTail = section(-5.85).yB;
  jk.push(cyl(0.04, 0.04, 0.03, [-5.85, yTail - 0.005, 0], 'y', 14), box(0.1, 0.04, 0.08, [-5.85, yTail + 0.025, 0]));
  P('Jacking & kneel fittings', {
    system: 'Landing gear', material: 'Steel jack pads and kneel fittings', mass: 3, count: 5, explode: [0, -1.5, 0],
    desc: 'The gear has a jack-and-kneel feature: by hand, the fuselage can be raised on jacks at these pads or lowered (knelt) on its main gear so the helicopter fits inside a transport aircraft.',
  }, [mesh(merge(jk), MAT.steel())]);

  // ------------------------------------------------------------------ fuel
  for (const side of [1, -1]) {
    const s = side;
    const z = (a, b) => (s > 0 ? [a, b] : [-b, -a]);
    const [fz0, fz1] = z(0.05, 0.92), [rz0, rz1] = z(0.05, 0.66);
    const g = cell({ x: -1.84, y0: 0.56, y1: 1.5, z0: fz0, z1: fz1 }, { x: -3.0, y0: 0.84, y1: 1.5, z0: rz0, z1: rz1 });
    const fittings = [cyl(0.06, 0.06, 0.06, [-2.3, 1.52, 0.5 * s], 'y', 14), cyl(0.05, 0.05, 0.05, [-2.6, 0.9, 0.5 * s], 'y', 12)];
    P(side > 0 ? 'Fuel cell (right)' : 'Fuel cell (left)', {
      system: 'Fuel', material: 'Crash-resistant, self-sealing rubberised-fabric bladder', mass: 40, explode: [-0.3, -1.4, 0.9 * s],
      desc: 'One of two interchangeable cells holding 360 US gal (1,360 L, ≈1,090 kg of JP-8) between them, aft of the cabin under the stowage compartments. Each must survive a 20 m (65 ft) drop test full of water without leaking, and the self-sealing layers close up after small-arms penetration. Mass shown is the empty cell.',
      callout: side > 0, anchor: [-2.9, 0.9, 0.6],
    }, [mesh(g, MAT.fuelCell()), mesh(merge(fittings), MAT.casting())]);
  }
  const cellTop = 1.5, cellBot = (x) => 0.56 + ((0.84 - 0.56) * (-1.84 - x)) / 1.16;
  const valves = [];
  for (const s of [1, -1]) {
    valves.push(cyl(0.05, 0.05, 0.05, [-2.2, cellBot(-2.2) + 0.01, 0.45 * s], 'y', 14));                    // refuel/defuel valve
    for (const [x, zz] of [[-2.05, 0.3], [-2.65, 0.35]]) valves.push(cyl(0.04, 0.04, 0.06, [x, cellTop - 0.01, zz * s], 'y', 12), cyl(0.03, 0.03, 0.12, [x, cellTop - 0.1, zz * s], 'y', 10));   // high-level float shutoffs
    valves.push(cyl(0.04, 0.04, 0.05, [-2.7, cellBot(-2.7) + 0.02, 0.3 * s], 'y', 12));                     // low-level shutoff
    valves.push(cyl(0.035, 0.035, 0.07, [-2.22, cellTop + 0.04, 0.55 * s], 'y', 12));                       // check valve at the feed outlet
    valves.push(cyl(0.045, 0.045, 0.04, [-2.0, cellTop + 0.02, 0.7 * s], 'y', 12));                         // self-sealing breakaway vent valve
  }
  P('Fuel cell valves', {
    system: 'Fuel', material: 'Refuel/defuel, high- and low-level shutoff, check and breakaway vent valves', mass: 6, count: 12, explode: [-0.3, -0.5, 1.6],
    desc: 'Each cell carries its own set: a refuel/defuel valve at the bottom, two float-operated high-level shutoffs at the top that end a pressure fill, a low-level shutoff, a check valve at the feed outlet and a self-sealing breakaway vent valve that closes if the vent line is torn away in a crash.',
  }, [mesh(merge(valves), MAT.casting())]);
  // single-point pressure refuel/defuel: receptacle on the left, manifold under the cells to each valve
  const inside = (x, y, d) => -(halfWidthAt(x, y) - d);
  const man = [pipe([[-2.0, 1.0, inside(-2.0, 1.0, 0.04)], [-2.05, 0.82, inside(-2.05, 0.82, 0.05)], [-2.12, 0.66, inside(-2.12, 0.66, 0.07)], [-2.18, 0.605, -0.6], [-2.2, 0.6, -0.3], [-2.2, 0.6, 0.0], [-2.2, 0.6, 0.45]], 0.025, 8)];
  for (const s of [1, -1]) man.push(tube([-2.2, 0.6, 0.45 * s], [-2.2, cellBot(-2.2) - 0.01, 0.45 * s], 0.025, 8));
  P('Pressure refuel/defuel manifold', {
    system: 'Fuel', material: 'Aluminium manifold from the single-point receptacle', mass: 4, explode: [-0.3, -1.0, 0],
    desc: 'From one closed-circuit receptacle on the left side, a manifold under the cells reaches each cell\'s bottom refuel/defuel valve, so both cells can be pressure-fuelled — or emptied — from a single point with no electrical power on the aircraft. Dual float valves in each cell end the fill.',
  }, [mesh(merge(man), MAT.hydraulic())]);
  const necks = [];
  for (const s of [1, -1]) {
    const zSkin = halfWidthAt(-2.4, 1.3) - 0.01, zCell = 0.92 - (0.26 * 0.56) / 1.16;
    necks.push(tube([-2.4, 1.3, zSkin * s], [-2.4, 1.28, (zCell - 0.02) * s], 0.04, 14), cyl(0.046, 0.046, 0.012, [-2.4, 1.285, (zCell + 0.04) * s], 'z', 14));
  }
  P('Gravity filler necks', {
    system: 'Fuel', material: 'Frangible (breakaway) filler necks', mass: 2, count: 2, explode: [-0.3, 0.2, 1.7],
    desc: 'A short neck joins each gravity filler port to its cell. It is a frangible joint: if a crash pulls the skin and the cell apart, the neck breaks cleanly instead of tearing the cell open.',
  }, [mesh(merge(necks), MAT.hydraulic())]);
  // Each feed line stays inside a skin all the way: up through the transition section, through the
  // roof into the aft deck fairing, forward along the inboard side of the engine-bay firewall to the
  // firewall-mounted selector valve, then round the underside of the engine to its boost pump.
  const lines = [];
  for (const s of [1, -1]) {
    lines.push(pipe([[-2.22, 1.56, 0.55 * s], [-2.1, 1.85, 0.47 * s], [-1.95, 2.1, 0.36 * s], [-1.8, 2.3, 0.32 * s], [-1.6, 2.38, 0.38 * s], [-1.2, 2.4, 0.38 * s], [-0.96, 2.42, 0.38 * s], [-0.9, 2.42, 0.42 * s]], 0.016));
    lines.push(pipe([[-0.8, 2.42, 0.5 * s], [-0.84, 2.36, 0.62 * s], [-0.85, 2.33, 0.72 * s], [-0.86, 2.4, 0.95 * s], [-0.86, 2.62, 1.0 * s], [-0.86, 2.7, 0.95 * s]], 0.016));
  }
  lines.push(tube([-2.4, 1.0, 0.06], [-2.4, 1.0, -0.06], 0.03, 10));
  const bv = [];
  for (const s of [1, -1]) bv.push(cyl(0.035, 0.035, 0.06, [-2.22, 1.62, 0.55 * s], 'y', 12), cyl(0.03, 0.03, 0.05, [-1.89, 2.18, 0.34 * s], 'y', 10), cyl(0.03, 0.03, 0.05, [-1.2, 2.4, 0.38 * s], 'x', 10));
  P('Fuel lines & breakaway valves', {
    system: 'Fuel', material: 'Self-sealing hoses, frangible breakaway valves', mass: 20, explode: [-0.6, -0.6, 0], xrayWeight: 0.6,
    desc: 'Each cell feeds its own engine, which draws the fuel by suction, so a cut line sucks air instead of spraying fuel. Self-sealing breakaway valves at every structural joint (here at the cell outlets, where the lines pass through the roof and where they enter the engine bay) seal both ends if a line is torn out in a crash — the main reason post-crash fires are rare in H-60s.',
  }, [mesh(merge(lines), MAT.hydraulic()), mesh(merge(bv), MAT.red())]);
  const selG = [];
  for (const s of [1, -1]) {
    selG.push(cyl(0.04, 0.04, 0.1, [-0.85, 2.42, 0.47 * s], 'x', 12), box(0.06, 0.04, 0.07, [-0.85, 2.47, 0.47 * s]), box(0.14, 0.12, 0.012, [-0.85, 2.43, 0.44 * s]));
    selG.push(pipe([[-0.86, 2.47, 0.47 * s], [-0.84, 2.53, 0.44 * s], [-0.75, 2.52, 0.4 * s], [-0.55, 2.48, 0.4 * s]], 0.006, 4));           // push-pull cable toward the overhead levers
  }
  // crossfeed between the two valves, under the tail drive shaft, with a check valve in each half
  selG.push(pipe([[-0.86, 2.4, 0.43], [-0.92, 2.34, 0.36], [-0.92, 2.32, 0.15], [-0.92, 2.32, -0.15], [-0.92, 2.34, -0.36], [-0.86, 2.4, -0.43]], 0.012));
  for (const s of [1, -1]) selG.push(cyl(0.022, 0.022, 0.06, [-0.92, 2.32, 0.26 * s], 'z', 10));
  P('Fuel selector valves', {
    system: 'Fuel', material: 'Cable-operated selector valves on the engine-bay firewalls, crossfeed line with check valves', mass: 4, count: 2, explode: [-0.8, 0.9, 0],
    desc: 'One on the firewall of each engine bay, set by low-friction push-pull cables from the overhead ENG FUEL SYS levers to OFF, DIR (direct from its own cell) or XFD (crossfeed from the other cell). A check valve in each half of the crossfeed stops air from a dead engine\'s line being drawn into the running engine.',
  }, [mesh(merge(selG), MAT.red())]);
  P('Fuel prime/boost pump', {
    system: 'Fuel', material: 'Electric pump in the left cell (location approximate)', mass: 4, explode: [-0.6, -0.3, -1.1],
    desc: 'An electric pump primes the engine fuel lines before a start and feeds the APU, which draws from the left cell; in flight the engines\' own pumps do the work.',
  }, [mesh(merge([cyl(0.06, 0.06, 0.14, [-2.65, 0.95, -0.45], 'y', 14), pipe([[-2.65, 1.02, -0.45], [-2.6, 1.6, -0.35], [-2.4, 2.22, -0.3], [-2.1, 2.29, -0.32], [-1.98, 2.3, -0.32]], 0.008)]), MAT.casting())]);
  P('APU fuel shutoff valve', {
    system: 'Fuel', material: 'Solenoid shutoff valve on the APU compartment firewall', mass: 1, explode: [-0.9, 1.3, -1.0],
    desc: 'The prime/boost pump\'s shutoff valve doubles as the APU\'s firewall fuel shutoff: it closes the APU feed at the compartment wall, and the APU fire T-handle shuts it.',
  }, [mesh(merge([cyl(0.03, 0.03, 0.07, [-1.98, 2.3, -0.32], 'x', 12), box(0.04, 0.05, 0.04, [-1.98, 2.35, -0.32]), pipe([[-1.95, 2.3, -0.32], [-1.93, 2.33, -0.26], [-1.92, 2.37, -0.2]], 0.007, 4)]), MAT.red())]);
  const probes = [];
  for (const s of [1, -1]) probes.push(cyl(0.02, 0.02, 0.86, [-2.3, 1.06, 0.38 * s], 'y', 8), cyl(0.03, 0.03, 0.05, [-2.3, 1.5, 0.38 * s], 'y', 10), cyl(0.018, 0.018, 0.05, [-2.75, 0.9, 0.3 * s], 'x', 8));
  P('Fuel quantity probes', {
    system: 'Fuel', material: 'Capacitance probes and low-level sensors', mass: 2, count: 4, explode: [-0.2, -0.9, 0.4],
    desc: 'A capacitance probe standing in each cell measures the fuel height for the cockpit gauge. A low-level sensor on each probe flashes FUEL LOW when about 172 lb (78 kg) is left in that tank — a quantity, not a fixed time, since endurance depends on power.',
  }, [mesh(merge(probes), MAT.steel())]);
  const drains = [];
  for (const s of [1, -1]) {
    drains.push(cyl(0.025, 0.025, 0.04, [-2.15, 0.535, 0.45 * s], 'y', 10));   // stands about 2 cm proud of the belly
    drains.push(pipe([[-2.0, 1.54, 0.7 * s], [-1.95, 1.9, 0.8 * s], [-1.92, 2.07, 0.79 * s]], 0.01));
  }
  P('Fuel sump drains & vents', {
    system: 'Fuel', material: 'Drain valves at the low points, vent lines with rollover valves', mass: 2, count: 4, explode: [-0.4, -1.1, 0.8],
    desc: 'Drain valves at each cell\'s low point let the crew check for water and sediment before flight; vent lines let air in as fuel is used, with valves that close if the aircraft rolls over.',
  }, [mesh(merge(drains), MAT.casting())]);
  P('Refuelling ports', {
    system: 'Fuel', material: 'Gravity filler caps and a closed-circuit pressure receptacle', mass: 4, count: 3, explode: [-0.3, 0, 1.3],
    desc: 'Gravity filler on each side behind the cabin door, plus a pressure and closed-circuit receptacle on the left for rapid "hot" refuelling with the rotor turning.',
  }, [mesh(merge([cyl(0.06, 0.06, 0.03, [-2.4, 1.3, 1.0], 'z', 16), cyl(0.06, 0.06, 0.03, [-2.4, 1.3, -1.0], 'z', 16), cyl(0.05, 0.05, 0.03, [-2.0, 1.0, -1.12], 'z', 16)]), MAT.yellow())]);

  // ------------------------------------------------------------------ cargo hook
  // deployed it hangs under the CG; to stow it the crew opens the cover in the cabin floor and pulls
  // it to the right and up, where its load beam rests on a spring-loaded latch in the belly well
  const hookPivot = new THREE.Group();
  hookPivot.position.set(-0.08, 0.55, -0.06);
  const hk = new THREE.TorusGeometry(0.06, 0.018, 8, 16, Math.PI * 1.4).rotateZ(Math.PI * 0.8).translate(0, -0.3, 0);
  hookPivot.add(mesh(merge([box(0.1, 0.12, 0.16, [0, -0.04, 0]), tube([0, -0.08, 0], [0, -0.25, 0], 0.028, 10), cyl(0.03, 0.03, 0.2, [0, 0, 0], 'x', 10), hk]), MAT.steel()));
  const well = box(0.46, 0.1, 0.8, [-0.08, 0.525, 0]);            // as wide as its opening in the belly skin
  const hookPart = P('External cargo hook', {
    system: 'Payload', material: 'Steel hook with electrical, manual and explosive emergency release; recessed belly well', mass: 18, explode: [0, -1.3, 0],
    desc: 'Rated at 9,000 lb (4,082 kg), enough to sling a 105 mm howitzer or a light vehicle under the rotor, close to the centre of gravity so the load barely changes the trim. It has three ways to drop a load: an electrical release from either cyclic, a manual release worked by a crew member through a covered hatch in the cabin floor, and an explosive emergency release from the collective.',
    callout: true, anchor: [-0.1, 0.36, 0.1],
  }, [hookPivot, mesh(well, MAT.interior(), { cast: false })]);
  const setHook = (k) => { hookPivot.rotation.x = -(1 - k) * Math.PI / 2; };
  setHook(0);
  P('Cargo hook floor hatch & manual release', {
    system: 'Payload', material: 'Hinged floor access cover, manual-release handle, spring-loaded stow latch', mass: 4, explode: [0, 0.7, 0.4],
    desc: 'A covered hatch in the cabin floor right above the hook. Through it a crew member can release a load by hand, look down at the load, or pull the hook right and up onto its spring-loaded stow latch, where a Teflon bumper stops it rattling.',
  }, [mesh(merge([box(0.4, 0.015, 0.5, [-0.08, 0.627, 0]), cyl(0.012, 0.012, 0.36, [-0.28, 0.63, 0], 'z', 8)]), MAT.interiorFront()),
    mesh(merge([box(0.05, 0.02, 0.1, [0.08, 0.64, 0.12]), tube([0.02, 0.6, 0.3], [0.02, 0.66, 0.3], 0.01, 6), box(0.06, 0.04, 0.05, [-0.08, 0.56, 0.3])]), MAT.red())]);
  P('Cargo hook crew pendant', {
    system: 'Payload', material: 'Hand-held release switch on a coiled cord, stowed in the aft cabin', mass: 1, explode: [-0.4, 0.5, 0.6],
    desc: 'A hand-held pendant the crew chief can plug in to release the load from the cabin while watching it through the floor hatch; it stows on the aft cabin wall.',
  }, [mesh(merge([box(0.06, 0.12, 0.05, [-1.73, 1.76, 0.52]), new THREE.TorusGeometry(0.035, 0.006, 6, 16).translate(-1.74, 1.66, 0.52)]), MAT.black())]);

  return { oleos, setHook, hookPart };
}
