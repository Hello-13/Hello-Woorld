// UH-60M landing gear, fuel and external load: fixed main gear (drag beams, two-stage
// energy-absorbing oleos, wheels and brakes), the castoring tail gear, the two crash-resistant
// self-sealing fuel cells with their breakaway-valve plumbing and refuelling ports, and the
// 9,000 lb cargo hook.

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

  // tail gear
  const tw = { x: -6.62, y: 0.22 };
  const tTop = V3(-6.22, 1.3, 0), tBot = V3(-6.5, 0.4, 0);
  const tg = [tube(tTop, tTop.clone().lerp(tBot, 0.6), 0.075, 16), tube(tTop.clone().lerp(tBot, 0.5), tBot, 0.05, 14), box(0.2, 0.12, 0.2, [tTop.x, tTop.y, 0]), tube(tBot, V3(tw.x, tw.y, 0.1), 0.035, 10), tube(tBot, V3(tw.x, tw.y, -0.1), 0.035, 10), box(0.1, 0.08, 0.26, [tBot.x, tBot.y, 0]), cyl(0.03, 0.03, 0.24, [tw.x, tw.y, 0], 'z', 10)];
  const ttire = tire(0.22, 0.15).translate(tw.x, tw.y, 0);
  P('Tail landing gear', {
    system: 'Landing gear', material: 'Steel yoke and oleo, castoring wheel with lock', mass: 40, explode: [0, -1.0, 0],
    desc: 'A castoring tail wheel on its own oleo, about 8.8 m behind the main wheels. It keeps the tail rotor clear of the ground on landing and is locked straight for take-off and running landings.',
  }, [mesh(merge(tg), MAT.steel()), mesh(ttire, MAT.rubber()), mesh(cyl(0.11, 0.11, 0.13, [tw.x, tw.y, 0], 'z', 18), MAT.casting())]);

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
      callout: side > 0, anchor: [-2.4, 1.25, 0.95],
    }, [mesh(g, MAT.fuelCell()), mesh(merge(fittings), MAT.casting())]);
  }
  const lines = [];
  for (const s of [1, -1]) {
    lines.push(pipe([[-2.2, 1.5, 0.55 * s], [-2.0, 1.95, 0.6 * s], [-1.8, 2.2, 0.7 * s], [-1.5, 2.42, 0.76 * s]], 0.018));
    lines.push(pipe([[-2.5, 1.5, 0.3 * s], [-2.3, 1.9, 0.15 * s], [-2.0, 2.3, -0.1 * s], [-2.0, 2.35, -0.19 * s]], 0.012));
  }
  lines.push(tube([-2.4, 1.0, 0.06], [-2.4, 1.0, -0.06], 0.03, 10));
  const valves = [];
  for (const s of [1, -1]) valves.push(cyl(0.035, 0.035, 0.06, [-2.2, 1.55, 0.55 * s], 'y', 12), cyl(0.035, 0.035, 0.06, [-1.6, 2.4, 0.76 * s], 'x', 12));
  P('Fuel lines & breakaway valves', {
    system: 'Fuel', material: 'Self-sealing hoses, frangible breakaway valves, suction boost', mass: 22, explode: [-0.6, -0.6, 0],
    desc: 'The engines draw fuel by suction, so a cut line sucks air instead of spraying fuel. Breakaway valves at every structural joint seal both ends if a line is torn out in a crash — the main reason post-crash fires are rare in H-60s.',
  }, [mesh(merge(lines), MAT.hydraulic()), mesh(merge(valves), MAT.red())]);
  P('Refuelling ports', {
    system: 'Fuel', material: 'Gravity filler caps and a closed-circuit pressure receptacle', mass: 4, count: 3, explode: [-0.3, 0, 1.3],
    desc: 'Gravity filler on each side behind the cabin door, plus a closed-circuit receptacle on the left for rapid "hot" refuelling with the rotor turning.',
  }, [mesh(merge([cyl(0.06, 0.06, 0.03, [-2.4, 1.3, 1.0], 'z', 16), cyl(0.06, 0.06, 0.03, [-2.4, 1.3, -1.0], 'z', 16), cyl(0.05, 0.05, 0.03, [-2.0, 1.0, -1.12], 'z', 16)]), MAT.yellow())]);

  // ------------------------------------------------------------------ cargo hook
  const hook = [box(0.36, 0.12, 0.26, [-0.1, 0.43, 0]), tube([-0.1, 0.38, 0], [-0.1, 0.24, 0], 0.03, 10)];
  const hk = new THREE.TorusGeometry(0.07, 0.02, 8, 16, Math.PI * 1.4).rotateZ(Math.PI * 0.8).translate(-0.1, 0.2, 0);
  P('External cargo hook', {
    system: 'Payload', material: 'Steel hook with electrical, manual and emergency release', mass: 18, explode: [0, -1.3, 0],
    desc: 'Rated at 9,000 lb (4,082 kg), enough to sling a 105 mm howitzer or a light vehicle under the rotor, close to the centre of gravity so the load barely changes the trim.',
    callout: true, anchor: [-0.1, 0.2, 0.1],
  }, [mesh(merge([...hook, hk]), MAT.steel())]);

  return { oleos };
}
