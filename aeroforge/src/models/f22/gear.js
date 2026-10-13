// F-22A landing gear: steerable nose gear, two main gears (strut, drag brace and retraction
// actuator, wheel with carbon brake), their doors and the arresting hook. Retraction geometry is
// modelled from photographs and is approximate.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { F } from './materials.js';
import * as FR from './frame.js';
import { merge, slab, hinge } from './util.js';

const { X } = FR;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** Tyre + hub + brake (optional) about the local z axis. */
function wheelGeos(R, W, brake) {
  const tube = Math.min(W * 0.5, R * 0.32);
  const tyre = new THREE.TorusGeometry(R - tube, tube, 14, 40);
  tyre.scale(1, 1, (W * 0.5) / tube);
  const hub = new THREE.CylinderGeometry(R * 0.5, R * 0.5, W * 0.8, 28).rotateX(Math.PI / 2);
  const cap = new THREE.CylinderGeometry(R * 0.16, R * 0.2, W * 0.95, 14).rotateX(Math.PI / 2);
  const spokes = [];
  for (let k = 0; k < 8; k++) spokes.push(new THREE.BoxGeometry(R * 0.07, R * 0.62, W * 0.84).rotateZ((k / 8) * Math.PI));
  const out = { tyre, hub: merge([hub, ...spokes]), cap };
  if (brake) out.brake = new THREE.CylinderGeometry(R * 0.44, R * 0.44, W * 0.6, 24).rotateX(Math.PI / 2);
  return out;
}

/** Cylinder between two Vector3 points. */
function rodV(a, b, r, seg = 10) {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()));
  const m = a.clone().add(b).multiplyScalar(0.5);
  return g.translate(m.x, m.y, m.z);
}

export function buildGear(ctx) {
  const { P, anim } = ctx;
  const gear = anim.gear;

  // ------------------------------------------------------------------ nose gear (retracts aft)
  {
    const T = V(X(4.05), -0.3, 0);
    const Rn = 0.28, Wn = 0.19;
    const axle = V(X(3.96), FR.GROUND + Rn, 0);
    const leg = axle.clone().sub(T);
    const strutG = [];
    const L = leg.length();
    const dir = leg.clone().normalize();
    const at = (k) => dir.clone().multiplyScalar(L * k);
    strutG.push(rodV(at(0), at(0.62), 0.075, 14));
    strutG.push(new THREE.BoxGeometry(0.2, 0.12, 0.22).translate(...at(0.5).toArray()));      // steering collar
    strutG.push(rodV(at(0.1), at(0.1).add(V(0.0, 0.1, 0.0)).add(V(0.42, 0.05, 0)), 0.04));     // drag brace stub
    const chrome = [rodV(at(0.58), at(0.92), 0.052, 12)];
    // fork and torque links
    const ax = at(1);
    strutG.push(new THREE.BoxGeometry(0.08, 0.24, Wn + 0.14).translate(ax.x, ax.y + 0.12, ax.z));
    strutG.push(rodV(at(0.7).add(V(0.09, 0, 0)), at(0.82).add(V(0.16, 0, 0)), 0.02), rodV(at(0.82).add(V(0.16, 0, 0)), at(0.92).add(V(0.06, 0, 0)), 0.02));
    // steering actuator and the taxi / landing light
    strutG.push(rodV(at(0.42).add(V(-0.12, 0, 0.1)), at(0.52).add(V(-0.02, 0, 0.13)), 0.025));
    const light = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 14).rotateZ(Math.PI / 2).translate(...at(0.66).add(V(0.12, 0, 0)).toArray()), F.lens());
    const pivotA = new THREE.Group(); pivotA.position.copy(T);
    pivotA.add(mesh(merge(strutG), F.gear()), mesh(merge(chrome), F.chrome()), light);
    const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.04, 14).rotateY(Math.PI / 2).translate(...at(0.66).add(V(0.15, 0, 0)).toArray()), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff2d8, emissiveIntensity: 0 }));
    lamp.userData.fx = true;
    pivotA.add(lamp);
    anim.taxiLight = lamp.material;
    P('Nose gear strut & steering', {
      system: 'Landing gear', material: '300M / titanium strut, hydraulic steering', mass: 110,
      explode: [0.4, -0.85, 0],
      desc: 'A single-wheel oleo-pneumatic strut with hydraulic nose-wheel steering and the taxi / landing light. It retracts aft into a well under the cockpit floor (geometry approximate).',
    }, pivotA);
    const w = wheelGeos(Rn, Wn, false);
    const pivotB = new THREE.Group(); pivotB.position.copy(T);
    const wheel = new THREE.Group(); wheel.position.copy(ax);
    wheel.add(mesh(w.tyre, F.tyre()), mesh(w.hub, F.wheel()), mesh(w.cap, F.steel()));
    pivotB.add(wheel);
    P('Nose wheel & tyre', {
      system: 'Landing gear', material: 'Aluminium wheel, nitrogen-filled radial tyre', mass: 32,
      explode: [0.6, -1.0, 0],
      desc: 'A single nose wheel. Like all military jet tyres it is filled with dry nitrogen, which does not support combustion and keeps its pressure steady through big temperature swings (tyre size not published).',
    }, pivotB);
    gear.push({ pivots: [pivotA, pivotB], q: new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), -94 * FR.DEG) });
  }

  // ------------------------------------------------------------------ main gears (fold up into wells under the ducts)
  for (const side of [1, -1]) {
    const R = side > 0 ? 'right' : 'left';
    const T = V(X(11.3), -0.55, side * 1.28);
    const Rm = 0.43, Wm = 0.29;
    const axle = V(X(11.38), FR.GROUND + Rm, side * 1.62);
    const vd = axle.clone().sub(T);
    const L = vd.length();
    const vs = V(X(12.33) - T.x, -0.5 - T.y, side * 1.2 - T.z).normalize().multiplyScalar(L);
    const q = new THREE.Quaternion().setFromUnitVectors(vd.clone().normalize(), vs.clone().normalize());
    const dir = vd.clone().normalize();
    const at = (k) => dir.clone().multiplyScalar(L * k);
    // strut
    const sg = [rodV(at(-0.06), at(0.6), 0.1, 16), new THREE.BoxGeometry(0.3, 0.16, 0.24).translate(0, 0, 0)];
    const ch = [rodV(at(0.56), at(0.94), 0.07, 14)];
    const ax = at(1);
    sg.push(new THREE.CylinderGeometry(0.055, 0.055, 0.32, 12).rotateX(Math.PI / 2).translate(ax.x, ax.y, ax.z - side * 0.08));
    sg.push(rodV(at(0.66).add(V(0.12, 0, 0)), at(0.8).add(V(0.22, 0, 0)), 0.026), rodV(at(0.8).add(V(0.22, 0, 0)), at(0.92).add(V(0.08, 0, 0)), 0.026));
    sg.push(rodV(at(0.05).add(V(-0.08, 0, -side * 0.06)), at(0.9).add(V(-0.1, 0, -side * 0.08)), 0.012, 6));      // brake line
    const pA = new THREE.Group(); pA.position.copy(T);
    pA.add(mesh(merge(sg), F.gear()), mesh(merge(ch), F.chrome()));
    P(`Main gear strut (${R})`, {
      system: 'Landing gear', material: '300M high-strength steel, chromed oleo piston', mass: 230,
      explode: [0, -0.95, 0.45 * side], callout: side > 0, anchor: [X(11.4), -1.15, side * 1.5],
      desc: 'Oleo-pneumatic shock strut on a trunnion in the well beneath the inlet duct. To stow, it swings up and aft while the wheel turns to lie flat (geometry approximate).',
    }, pA);
    // drag brace and retraction actuator
    const bg = [rodV(at(0.42), at(0.42).add(V(0.75, 0.32, -side * 0.12)), 0.045, 10), rodV(at(0.42).add(V(0.75, 0.32, -side * 0.12)), V(0.9, 0.35, -side * 0.15), 0.04, 10)];
    const act = [rodV(at(0.18), at(0.18).add(V(-0.25, 0.32, -side * 0.35)), 0.05, 12), rodV(at(0.18).add(V(-0.25, 0.32, -side * 0.35)), at(0.18).add(V(-0.38, 0.4, -side * 0.5)), 0.035, 10)];
    const pB = new THREE.Group(); pB.position.copy(T);
    pB.add(mesh(merge(bg), F.gear()), mesh(merge(act), F.hyd()));
    P(`Main gear drag brace & retraction actuator (${R})`, {
      system: 'Landing gear', material: 'Steel / titanium brace, hydraulic actuator', mass: 70,
      explode: [0.5, -0.75, 0.8 * side],
      desc: 'The folding drag brace locks the leg against braking and landing loads; a hydraulic actuator powered by the 4,000 psi system swings the leg up into its well.',
    }, pB);
    // wheel and brake: an inner group turns the wheel flat about the leg as it retracts
    const w = wheelGeos(Rm, Wm, true);
    const pC = new THREE.Group(); pC.position.copy(T);
    const twist = new THREE.Group();
    const wheel = new THREE.Group(); wheel.position.copy(ax);
    wheel.add(mesh(w.tyre, F.tyre()), mesh(w.hub, F.wheel()), mesh(w.cap, F.steel()), mesh(w.brake, F.brake()));
    twist.add(wheel);
    pC.add(twist);
    // find the twist about the leg axis that leaves the axle vertical when stowed
    let best = 0, bestY = -1;
    for (let k = 0; k < 72; k++) {
      const phi = (k / 72) * Math.PI * 2;
      const a = V(0, 0, 1).applyAxisAngle(dir, phi).applyQuaternion(q);
      if (Math.abs(a.y) > bestY) { bestY = Math.abs(a.y); best = phi; }
    }
    if (best > Math.PI) best -= Math.PI * 2;
    P(`Main wheel & carbon brake (${R})`, {
      system: 'Landing gear', material: 'Aluminium wheel, carbon–carbon brake stack, nitrogen-filled tyre', mass: 120,
      explode: [0, -1.25, 0.95 * side],
      desc: 'A single wheel per main leg with a multi-disc carbon brake, which stays strong when red-hot and weighs far less than steel (tyre size not published). Anti-skid control works through the brake-by-wire system.',
    }, pC);
    gear.push({ pivots: [pA, pB, pC], q, twist: { g: twist, axis: dir, angle: best } });

    // main gear door, hinged at its inboard edge
    const st = ctx.sB.filter((s) => s >= FR.MAIN_WELL.s0 - 1e-6 && s <= FR.MAIN_WELL.s1 + 1e-6);
    const zs = [FR.MAIN_WELL.z0 + 0.004, 1.06, 1.26, FR.MAIN_WELL.z1 - 0.004];
    const grid = st.map((s) => zs.map((z) => [X(s), -FR.bD(s) - 0.002, side * Math.min(z, FR.bWb(s) - 0.054)]));
    const door = slab(grid, () => [0, 0.03, 0], V(0, -1, 0));
    const h = hinge(mesh(door, F.skin()), V(X(FR.MAIN_WELL.s0), -FR.bD(FR.MAIN_WELL.s0), side * FR.MAIN_WELL.z0), V(X(FR.MAIN_WELL.s1), -FR.bD(FR.MAIN_WELL.s1), side * FR.MAIN_WELL.z0), V(X(12), -0.9, side * 1.3), V(0, -1, 0));
    P(`Main gear door (${R})`, {
      system: 'Skin & fairings', skin: true, material: 'Composite door with saw-tooth edges', mass: 28,
      explode: [0, -1.55, 1.15 * side],
      desc: 'Closes the main-gear well flush with the belly; like the bay doors its edges are serrated to keep radar reflections in a few narrow directions.',
    }, h.pivot);
    anim.gearDoors.push({ h, angle: 1.6 });
  }

  // ------------------------------------------------------------------ nose gear doors
  {
    const { s0, s1, z } = FR.NOSE_WELL;
    const st = ctx.sA.filter((s) => s >= s0 - 1e-6 && s <= s1 + 1e-6);
    const pivots = [];
    for (const side of [1, -1]) {
      const zs = [0.006, z * 0.5, z - 0.004].map((v) => v * side);
      const grid = st.map((s) => zs.map((zz) => [X(s), FR.bottomAt(s, zz) - 0.002, zz]));
      const door = slab(grid, () => [0, 0.03, 0], V(0, -1, 0));
      const h = hinge(mesh(door, F.skin()), V(X(s0), FR.bottomAt(s0, z), side * z), V(X(s1), FR.bottomAt(s1, z), side * z), V(X(4.8), -0.7, side * 0.05), V(0, -1, 0));
      pivots.push(h.pivot);
      anim.gearDoors.push({ h, angle: 1.55 });
    }
    P('Nose gear doors', {
      system: 'Skin & fairings', skin: true, material: 'Composite doors', mass: 18,
      explode: [0.4, -1.3, 0],
      desc: 'Two doors hinged at their outer edges close the nose-gear well under the cockpit.',
    }, pivots);
  }

  // ------------------------------------------------------------------ arresting hook
  {
    const g = [rodV(V(X(15.7), -0.5, 0), V(X(17.1), -0.5, 0), 0.04, 10)];
    g.push(new THREE.BoxGeometry(0.14, 0.08, 0.16).translate(X(17.12), -0.52, 0));
    g.push(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 12).rotateX(Math.PI / 2).translate(X(15.7), -0.5, 0));
    g.push(rodV(V(X(15.9), -0.45, 0), V(X(16.4), -0.4, 0), 0.035, 10));
    const door = new THREE.BoxGeometry(1.7, 0.02, 0.2).translate(X(16.45), -FR.bD(16.45) + 0.004, 0);
    P('Arresting hook', {
      system: 'Landing gear', material: 'Steel shank and hook point, composite door', mass: 45,
      explode: [-0.6, -1.0, 0],
      desc: 'An emergency tail hook stowed between the engines under a door. It drops to catch a runway cable if brakes or steering fail.',
    }, [mesh(merge(g), F.steel()), mesh(door, F.skin())]);
  }
}
