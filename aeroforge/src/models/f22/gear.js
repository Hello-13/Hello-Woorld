// F-22A landing gear, broken into the components a maintainer would name: for the steerable nose
// gear and each main gear, the oleo shock strut, torque links, folding drag (or side) brace with its
// downlock, retraction actuator, uplock, wheel / tyre / carbon brake and doors with their actuators,
// plus the arresting hook. Each brace and actuator is a live linkage: its airframe end stays on its
// fitting while the leg swings, the brace folds at its knee and the actuator telescopes. Retraction
// geometry is modelled from photographs and is approximate.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { F } from './materials.js';
import * as FR from './frame.js';
import { merge, slab, hinge, toothedGrid } from './util.js';

const { X, lerp } = FR;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

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
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize()));
  const m = a.clone().add(b).multiplyScalar(0.5);
  return g.translate(m.x, m.y, m.z);
}

/** A unit-length rod mesh (along +y, centred) that `place` stretches between two points. */
function unitRod(r, mat, seg = 10) { return mesh(new THREE.CylinderGeometry(r, r, 1, seg), mat); }
const tmpD = new THREE.Vector3(), tmpM = new THREE.Vector3();
function place(m, a, b, len = null) {
  tmpD.subVectors(b, a);
  const L = Math.max(1e-4, tmpD.length());
  tmpD.multiplyScalar(1 / L);
  const l = len ?? L;
  m.position.copy(tmpM.copy(a).addScaledVector(tmpD, l / 2));
  m.quaternion.setFromUnitVectors(UP, tmpD);
  m.scale.set(1, l, 1);
}

/**
 * Two-link folding brace from a fixed airframe fitting F to a point A on the leg. The links are
 * sized so the brace is straight (locked) with the gear down and folds flat back on itself with
 * the gear up; in between the knee breaks toward `bend`.
 */
function foldingBrace(Fp, Adown, Astow, bend) {
  const dD = Fp.distanceTo(Adown), dS = Fp.distanceTo(Astow);
  const l1 = (dD + dS) / 2, l2 = (dD - dS) / 2;
  const u = new THREE.Vector3(), b = new THREE.Vector3(), knee = new THREE.Vector3();
  return {
    l1, l2,
    knee(A) {
      u.subVectors(A, Fp);
      const d = Math.max(1e-4, u.length());
      u.multiplyScalar(1 / d);
      const along = Math.min(l1, (l1 * l1 - l2 * l2 + d * d) / (2 * d));
      const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
      b.copy(bend).addScaledVector(u, -bend.dot(u)).normalize();
      return knee.copy(Fp).addScaledVector(u, along).addScaledVector(b, h);
    },
  };
}

export function buildGear(ctx) {
  const { P, anim } = ctx;
  const gear = anim.gear;
  anim.gearLinks = [];
  const qI = new THREE.Quaternion();

  /** Leg kinematics: a point in leg coordinates (relative to the trunnion) at retraction ku. */
  const legPoint = (T, q, local) => {
    const qq = new THREE.Quaternion();
    const out = new THREE.Vector3();
    return (ku) => out.copy(local).applyQuaternion(qq.copy(qI).slerp(q, ku)).add(T);
  };
  const pivotAt = (T) => { const g = new THREE.Group(); g.position.copy(T); return g; };

  // ================================================================== nose gear (retracts aft under the cockpit floor)
  {
    const G = FR.GEAR.nose;
    const T = V(X(G.trunnion[0]), G.trunnion[1], G.trunnion[2]);
    const Rn = G.r, Wn = G.w;
    const axle = V(X(G.axleS), FR.GROUND + Rn, G.axleZ);
    const leg = axle.clone().sub(T);
    const L = leg.length();
    const dir = leg.clone().normalize();
    const at = (k) => dir.clone().multiplyScalar(L * k);
    // stowed: leg lies aft, very slightly nose-down, wheel centred under the floor hump
    const stowDir = V(X(4.06 + L) - T.x, -0.3 - T.y, 0).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(dir, stowDir);
    const pv = [];

    // shock strut: outer cylinder, chromed piston, fork, trunnion and the taxi / landing light
    const sg = [rodV(at(0), at(0.62), 0.075, 14)];
    sg.push(new THREE.CylinderGeometry(0.04, 0.04, 0.34, 10).rotateX(Math.PI / 2));                     // trunnion pin
    const ch = [rodV(at(0.58), at(0.92), 0.052, 12)];
    const ax = at(1);
    sg.push(new THREE.BoxGeometry(0.08, 0.24, Wn + 0.14).translate(ax.x, ax.y + 0.12, ax.z));
    const pA = pivotAt(T);
    pA.add(mesh(merge(sg), F.gear()), mesh(merge(ch), F.chrome()));
    P('Nose gear shock strut', {
      system: 'Landing gear', material: '300M steel / titanium oleo-pneumatic strut, chromed piston', mass: 85,
      explode: [0.4, -0.85, 0],
      desc: 'A single-wheel oleo-pneumatic strut: nitrogen and hydraulic oil inside it absorb the landing and taxi loads. It retracts aft into a well under the cockpit floor (geometry approximate).',
    }, pA);
    pv.push(pA);
    // taxi / landing light on a bracket at the front of the strut
    {
      const pL = pivotAt(T);
      const c = at(0.66);
      const body = merge([new THREE.CylinderGeometry(0.055, 0.05, 0.07, 16).rotateZ(Math.PI / 2).translate(c.x + 0.12, c.y, c.z), new THREE.BoxGeometry(0.1, 0.03, 0.04).translate(c.x + 0.06, c.y, c.z)]);
      const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.045, 16).rotateY(Math.PI / 2).translate(c.x + 0.156, c.y, c.z), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff2d8, emissiveIntensity: 0 }));
      lamp.userData.fx = true;
      pL.add(mesh(body, F.lens()), lamp);
      anim.taxiLight = lamp.material;
      P('Taxi / landing light', {
        system: 'Electrical', material: 'Sealed lamp on the nose strut, 28 V DC', mass: 2,
        explode: [1.1, -0.75, 0.3],
        desc: 'The jet\'s one forward-facing white light, on the nose leg so it stows inside the well with the gear. Like the other lights it runs from the 28 V DC buses fed by the 270 → 28 V converter-regulators; it comes on only with the gear down.',
      }, pL);
      pv.push(pL);
    }
    // weight-on-wheels switch on the front of the strut, beside the upper torque link and well clear of the tyre
    {
      const pW = pivotAt(T);
      const Wo = G.wow, c = at(Wo.k).add(V(Wo.fwd, 0, Wo.dz));
      pW.add(mesh(merge([new THREE.BoxGeometry(...Wo.box).translate(c.x, c.y, c.z), rodV(c.clone().add(V(-0.02, 0.025, 0)), at(0.35).add(V(0.085, 0, Wo.dz)), 0.006, 5)]), F.yellow()));
      P('Nose gear weight-on-wheels switch', {
        system: 'Landing gear', material: 'Proximity sensor on the strut by the torque links, redundant channels', mass: 1,
        explode: [1.0, -1.3, 0.45],
        desc: 'Senses when the oleo compresses under load. Weight-on-wheels interlocks stop the gear retracting on the ground; in a 2018 mishap the jet sensed weight off wheels at 135 KCAS after rotating early, and the gear came up before it could fly.',
      }, pW);
      pv.push(pW);
    }

    const pS = pivotAt(T);
    pS.add(mesh(merge([new THREE.BoxGeometry(0.2, 0.12, 0.22).translate(...at(0.5).toArray()), rodV(at(0.42).add(V(-0.12, 0, 0.1)), at(0.52).add(V(-0.02, 0, 0.13)), 0.025)]), F.hyd()));
    P('Nose-wheel steering unit', {
      system: 'Landing gear', material: 'Hydraulic steering collar and actuator, electrically commanded', mass: 14,
      explode: [0.75, -0.6, 0.45],
      desc: 'A collar on the strut with a hydraulic actuator turns the nose wheel on command from the rudder pedals through the vehicle-management system; it centres the wheel before the leg retracts.',
    }, pS);
    pv.push(pS);

    const pT = pivotAt(T);
    pT.add(mesh(merge([rodV(at(0.7).add(V(0.09, 0, 0)), at(0.82).add(V(0.16, 0, 0)), 0.02), rodV(at(0.82).add(V(0.16, 0, 0)), at(0.92).add(V(0.06, 0, 0)), 0.02),
      new THREE.CylinderGeometry(0.022, 0.022, 0.12, 8).rotateX(Math.PI / 2).translate(...at(0.82).add(V(0.16, 0, 0)).toArray())]), F.steel()));
    P('Nose gear torque links', {
      system: 'Landing gear', material: 'Forged steel scissor links', mass: 5,
      explode: [0.95, -1.05, 0.2],
      desc: 'A scissor linkage between the strut and the piston lets the oleo compress while keeping the wheel from turning on it, so steering commands reach the wheel.',
    }, pT);
    pv.push(pT);

    const w = wheelGeos(Rn, Wn, false);
    const pB = pivotAt(T);
    const wheel = new THREE.Group(); wheel.position.copy(ax);
    wheel.add(mesh(w.tyre, F.tyre()), mesh(w.hub, F.wheel()), mesh(w.cap, F.steel()));
    pB.add(wheel);
    P('Nose wheel & tyre', {
      system: 'Landing gear', material: 'Aluminium wheel, nitrogen-filled radial tyre', mass: 32,
      explode: [0.6, -1.1, 0],
      desc: 'A single nose wheel. Like all military jet tyres it is filled with dry nitrogen, which does not support combustion and keeps its pressure steady through big temperature swings (tyre size not published).',
    }, pB);
    pv.push(pB);
    gear.push({ pivots: pv, q });

    // folding drag brace (twin links straddling the strut) and its downlock
    const brace = [];
    const bg = new THREE.Group();
    for (const dz of [-0.13, 0.13]) {
      const Fp = V(X(4.75), -0.2, dz);
      const Ad = legPoint(T, q, at(0.3).add(V(0, 0, dz)));
      const fb = foldingBrace(Fp, Ad(0).clone(), Ad(1).clone(), V(0.3, -1, 0));
      const up = unitRod(0.03, F.gear()), lo = unitRod(0.028, F.gear()), lock = mesh(new THREE.BoxGeometry(0.06, 0.06, 0.05), F.yellow());
      const fit = mesh(new THREE.BoxGeometry(0.08, 0.06, 0.06).translate(Fp.x, Fp.y + 0.02, Fp.z), F.tiDull());
      bg.add(up, lo, lock, fit);
      brace.push({ Fp, Ad, fb, up, lo, lock });
    }
    P('Nose gear drag brace & downlock', {
      system: 'Landing gear', material: 'Steel twin-link folding brace, spring-loaded downlock', mass: 18,
      explode: [0.2, -0.55, 0.55],
      desc: 'A folding brace straddling the strut holds the leg against drag loads. Locked straight with the gear down (the yellow downlock at the knee), it breaks at the knee and folds flat as the leg swings up and aft.',
    }, bg);
    // retraction actuator, airframe end on a fitting under the forward cockpit bulkhead
    const Fa = V(X(4.35), -0.11, 0);
    const Aa = legPoint(T, q, at(0.12).add(V(0, 0.0, 0)));
    const aBar = unitRod(0.042, F.hyd(), 12), aRod = unitRod(0.022, F.chrome(), 8);
    const aLen = Math.min(Fa.distanceTo(Aa(0)), Fa.distanceTo(Aa(1))) * 0.85;
    P('Nose gear retraction actuator', {
      system: 'Landing gear', material: 'Hydraulic jack, 4,000 psi', mass: 12,
      explode: [0.35, -0.3, -0.5],
      desc: 'A hydraulic jack between a fitting under the cockpit floor and the top of the strut pulls the leg up and aft into its well; hydraulic pressure also keeps the gear down until the downlock engages.',
    }, [aBar, aRod]);
    // uplock: hook on the well roof that catches a roller on the stowed leg
    const ul = [new THREE.BoxGeometry(0.1, 0.12, 0.08).translate(X(5.0), -0.135, 0), new THREE.TorusGeometry(0.035, 0.012, 6, 12, Math.PI).rotateZ(Math.PI).translate(X(5.0), -0.2, 0)];
    P('Nose gear uplock', {
      system: 'Landing gear', material: 'Steel hook with hydraulic release and manual (free-fall) release', mass: 3,
      explode: [0.0, 0.35, 0.35],
      desc: 'A hook in the roof of the well latches the retracted leg so no hydraulic pressure is needed to hold it up; for emergency extension it is released and the gear falls and locks under its own weight and the airflow.',
    }, mesh(merge(ul), F.steel()));
    anim.gearLinks.push((ku) => {
      for (const b of brace) {
        const A = b.Ad(ku);
        const k = b.fb.knee(A);
        place(b.up, b.Fp, k);
        place(b.lo, k, A);
        b.lock.position.copy(k);
      }
      const A = Aa(ku);
      place(aBar, Fa, A, aLen);
      tmpM.subVectors(A, Fa).normalize();
      place(aRod, tmpM.clone().multiplyScalar(0.08).add(Fa), A);
    });
  }

  // ================================================================== main gears (fold up and aft into wells under the ducts)
  for (const side of [1, -1]) {
    const R = side > 0 ? 'right' : 'left';
    const G = FR.GEAR.main;
    const T = V(X(G.trunnion[0]), G.trunnion[1], side * G.trunnion[2]);
    const Rm = G.r, Wm = G.w;
    const axle = V(X(G.axleS), FR.GROUND + Rm, side * G.axleZ);
    const vd = axle.clone().sub(T);
    const L = vd.length();
    const vs = V(X(12.33) - T.x, -0.585 - T.y, side * 1.225 - T.z).normalize().multiplyScalar(L);   // stowed axle: the wheel clears the closed door and stays inside the trunk side wall
    const q = new THREE.Quaternion().setFromUnitVectors(vd.clone().normalize(), vs.clone().normalize());
    const dir = vd.clone().normalize();
    const at = (k) => dir.clone().multiplyScalar(L * k);
    const pv = [];
    // shock strut
    const sg = [rodV(at(-0.06), at(0.6), 0.1, 16), new THREE.BoxGeometry(0.3, 0.16, 0.24).translate(0, 0, 0)];
    const ch = [rodV(at(0.56), at(0.94), 0.07, 14)];
    const ax = at(1);
    sg.push(new THREE.CylinderGeometry(0.055, 0.055, 0.32, 12).rotateX(Math.PI / 2).translate(ax.x, ax.y, ax.z - side * 0.08));
    const pA = pivotAt(T);
    pA.add(mesh(merge(sg), F.gear()), mesh(merge(ch), F.chrome()));
    P(`Main gear shock strut (${R})`, {
      system: 'Landing gear', material: '300M high-strength steel, chromed oleo piston', mass: 200,
      explode: [0, -0.95, 0.45 * side], callout: side > 0, anchor: [X(11.4), -1.15, side * 1.5],
      desc: 'Oleo-pneumatic shock strut on a trunnion in the well beneath the inlet duct. To stow, it swings up and aft while the wheel turns to lie flat (geometry approximate).',
    }, pA);
    pv.push(pA);
    const pT = pivotAt(T);
    pT.add(mesh(merge([rodV(at(0.66).add(V(0.12, 0, 0)), at(0.8).add(V(0.22, 0, 0)), 0.026), rodV(at(0.8).add(V(0.22, 0, 0)), at(0.92).add(V(0.08, 0, 0)), 0.026),
      new THREE.CylinderGeometry(0.03, 0.03, 0.14, 8).rotateX(Math.PI / 2).translate(...at(0.8).add(V(0.22, 0, 0)).toArray())]), F.steel()));
    {
      // on the front of the oleo cylinder above the torque links, inboard of the tyre and clear of its rim
      const pW = pivotAt(T);
      const Wo = G.wow, c = at(Wo.k).add(V(Wo.fwd, 0, side * Wo.dz));
      pW.add(mesh(merge([new THREE.BoxGeometry(...Wo.box).translate(c.x, c.y, c.z), rodV(c.clone().add(V(-0.025, 0.025, 0)), at(0.15).add(V(0.113, 0, side * Wo.dz)), 0.006, 5)]), F.yellow()));
      P(`Main gear weight-on-wheels switch (${R})`, {
        system: 'Landing gear', material: 'Proximity sensor on the oleo cylinder by the torque links, redundant channels', mass: 1,
        explode: [0.75, -1.5, 0.75 * side],
        desc: 'Tells the flight controls, gear handle interlock and brakes whether the leg is carrying weight. The gear-retraction interlock relies on it, so a false weight-off-wheels signal at low speed can raise the gear too soon.',
      }, pW);
      pv.push(pW);
    }
    P(`Main gear torque links (${R})`, {
      system: 'Landing gear', material: 'Forged steel scissor links', mass: 8,
      explode: [0.55, -1.2, 0.5 * side],
      desc: 'Scissor links join the strut to the sliding piston so the oleo can compress without letting the axle twist under braking.',
    }, pT);
    pv.push(pT);
    // wheel and brake: an inner group turns the wheel flat about the leg as it retracts
    const w = wheelGeos(Rm, Wm, true);
    const pC = pivotAt(T);
    const twist = new THREE.Group();
    const wheel = new THREE.Group(); wheel.position.copy(ax);
    wheel.add(mesh(w.tyre, F.tyre()), mesh(w.hub, F.wheel()), mesh(w.cap, F.steel()), mesh(w.brake, F.brake()));
    twist.add(wheel);
    pC.add(twist);
    // brake line down the leg to the brake (rides on the wheel group so it follows the twist)
    twist.add(mesh(rodV(at(0.05).add(V(-0.08, 0, -side * 0.06)), at(0.9).add(V(-0.1, 0, -side * 0.08)), 0.012, 6), F.hyd()));
    // stowed wheel twisted as flat as the splayed leg allows (0.5° search)
    let best = 0, bestY = -1;
    for (let k = 0; k < 720; k++) {
      const phi = (k / 720) * Math.PI * 2;
      const a = V(0, 0, 1).applyAxisAngle(dir, phi).applyQuaternion(q);
      if (Math.abs(a.y) > bestY) { bestY = Math.abs(a.y); best = phi; }
    }
    if (best > Math.PI) best -= Math.PI * 2;
    P(`Main wheel & carbon brake (${R})`, {
      system: 'Landing gear', material: 'Aluminium wheel, carbon–carbon brake stack, nitrogen-filled tyre', mass: 120,
      explode: [0, -1.35, 0.95 * side],
      desc: 'A single wheel per main leg with a multi-disc carbon brake, which stays strong when red-hot and weighs far less than steel (tyre size not published). Anti-skid control works through the brake-by-wire system.',
    }, pC);
    pv.push(pC);
    gear.push({ pivots: pv, q, twist: { g: twist, axis: dir, angle: best } });

    // folding side / drag brace from the inboard well roof to the strut, and its downlock
    const Fp = V(X(11.42), -0.47, side * 0.92);
    const Ad = legPoint(T, q, at(0.4));
    const fb = foldingBrace(Fp, Ad(0).clone(), Ad(1).clone(), V(0.4, -1, 0));
    const up = unitRod(0.042, F.gear()), lo = unitRod(0.038, F.gear()), lock = mesh(new THREE.BoxGeometry(0.08, 0.08, 0.07), F.yellow());
    const fit = mesh(new THREE.BoxGeometry(0.12, 0.07, 0.1).translate(Fp.x, Fp.y + 0.02, Fp.z), F.tiDull());
    P(`Main gear folding brace & downlock (${R})`, {
      system: 'Landing gear', material: 'Steel / titanium two-piece brace, spring-loaded downlock link', mass: 40,
      explode: [0.5, -0.75, 0.15 * side],
      desc: 'A two-piece brace runs from the inboard roof of the well to the strut and takes the side and drag loads. With the gear down it is locked straight by the yellow downlock link at its knee; it breaks there and folds flat as the leg retracts.',
    }, [up, lo, lock, fit]);
    // retraction actuator from the forward well roof to the top of the strut
    const Fa = V(X(11.24), -0.47, side * 1.02);
    const Aa = legPoint(T, q, at(0.2));
    const aBar = unitRod(0.055, F.hyd(), 12), aRod = unitRod(0.03, F.chrome(), 10);
    const aLen = Math.min(Fa.distanceTo(Aa(0)), Fa.distanceTo(Aa(1))) * 0.85;
    P(`Main gear retraction actuator (${R})`, {
      system: 'Landing gear', material: 'Hydraulic jack, 4,000 psi', mass: 28,
      explode: [0.85, -0.45, 0.35 * side],
      desc: 'A hydraulic jack from a fitting in the forward roof of the well to the top of the strut swings the leg up and aft in a few seconds; it is fed by the gear lines from the utility hydraulic manifold.',
    }, [aBar, aRod]);
    // uplock on the aft well roof, over the stowed axle
    const ul = [new THREE.BoxGeometry(0.14, 0.08, 0.1).translate(X(11.84), -0.4, side * 1.28), new THREE.TorusGeometry(0.04, 0.014, 6, 12, Math.PI).rotateZ(Math.PI).translate(X(11.84), -0.44, side * 1.28)];
    P(`Main gear uplock (${R})`, {
      system: 'Landing gear', material: 'Steel hook, hydraulic and free-fall release', mass: 6,
      explode: [-0.4, 0.35, 0.4 * side],
      desc: 'Latches a roller on the stowed strut so the hydraulics can be unloaded in flight; in an emergency it is released and the leg free-falls and locks down (position approximate).',
    }, mesh(merge(ul), F.steel()));

    // main gear door, hinged at its inboard edge, with its actuator
    const st = ctx.sB.filter((s) => s >= FR.MAIN_WELL.s0 - 1e-6 && s <= FR.MAIN_WELL.s1 + 1e-6);
    const grid = toothedGrid((s, u) => [X(s), -FR.bD(s) - 0.002, side * Math.min(lerp(FR.MAIN_WELL.z0 + 0.004, FR.MAIN_WELL.z1 - 0.004, u), FR.bWb(s) - 0.054)], st, { width: 0.6 });
    const door = slab(grid, () => [0, 0.03, 0], V(0, -1, 0));
    const hp0 = V(X(FR.MAIN_WELL.s0), -FR.bD(FR.MAIN_WELL.s0), side * FR.MAIN_WELL.z0);
    const h = hinge(mesh(door, F.door()), hp0, V(X(FR.MAIN_WELL.s1), -FR.bD(FR.MAIN_WELL.s1), side * FR.MAIN_WELL.z0), V(X(12), -0.9, side * 1.3), V(0, -1, 0));
    P(`Main gear door (${R})`, {
      system: 'Skin & fairings', skin: true, material: 'Composite door with saw-tooth edges', mass: 28,
      explode: [0, -1.65, 1.15 * side],
      desc: 'Closes the main-gear well flush with the belly; like the bay doors its edges are serrated to keep radar reflections in a few narrow directions.',
    }, h.pivot);
    anim.gearDoors.push({ h, angle: 1.6 });
    const Fd = V(X(12.6), -0.5, side * 0.95), Pd = V(X(12.6), -FR.bD(12.6) + 0.03, side * 1.12);
    const dBar = unitRod(0.03, F.hyd(), 10), dRod = unitRod(0.016, F.chrome(), 8);
    const dLen = Fd.distanceTo(Pd) * 0.85;
    const dq = new THREE.Quaternion(), dp = new THREE.Vector3();
    P(`Main gear door actuator (${R})`, {
      system: 'Landing gear', material: 'Hydraulic jack', mass: 5,
      explode: [-0.2, -1.2, 0.75 * side],
      desc: 'A small jack in the inboard roof of the well opens the door ahead of the leg and closes it behind it; the sequence valve keeps door and leg from colliding.',
    }, [dBar, dRod]);
    anim.gearLinks.push((ku) => {
      const A = Ad(ku);
      const k = fb.knee(A);
      place(up, Fp, k);
      place(lo, k, A);
      lock.position.copy(k);
      const A2 = Aa(ku);
      place(aBar, Fa, A2, aLen);
      tmpM.subVectors(A2, Fa).normalize();
      place(aRod, tmpM.clone().multiplyScalar(0.1).add(Fa), A2);
      // door point follows the hinge rotation
      dq.copy(h.pivot.quaternion);
      dp.subVectors(Pd, hp0).applyQuaternion(dq).add(hp0);
      place(dBar, Fd, dp, dLen);
      tmpM.subVectors(dp, Fd).normalize();
      place(dRod, tmpM.clone().multiplyScalar(0.06).add(Fd), dp);
    });
  }

  // ------------------------------------------------------------------ nose gear doors
  {
    const { s0, s1, z } = FR.NOSE_WELL;
    const st = ctx.sA.filter((s) => s >= s0 - 1e-6 && s <= s1 + 1e-6);
    const pivots = [];
    const hs = [];
    for (const side of [1, -1]) {
      const grid = toothedGrid((s, u) => { const zz = side * lerp(0.006, z - 0.004, u); return [X(s), FR.bottomAt(s, zz) - 0.002, zz]; }, st, { width: 0.24 });
      const door = slab(grid, () => [0, 0.03, 0], V(0, -1, 0));
      const h = hinge(mesh(door, F.door()), V(X(s0), FR.bottomAt(s0, z), side * z), V(X(s1), FR.bottomAt(s1, z), side * z), V(X(4.8), -0.7, side * 0.05), V(0, -1, 0));
      pivots.push(h.pivot);
      hs.push({ h, side });
      anim.gearDoors.push({ h, angle: 1.55 });
    }
    P('Nose gear doors', {
      system: 'Skin & fairings', skin: true, material: 'Composite doors with saw-tooth fore and aft edges', mass: 18,
      explode: [0.4, -1.4, 0],
      desc: 'Two 1.8 m doors hinged at their outer edges close the nose-gear well under the cockpit; a mechanical linkage opens them with the leg, and their fore and aft edges are saw-toothed like every other door.',
    }, pivots);
    // door linkage: a bellcrank on the well roof, driven by the leg near its trunnion, with a rod to a horn
    // on each door's hinge line
    const crank = V(X(4.2), -0.1, 0);
    const rods = [], horns = [];
    for (const { h, side } of hs) {
      const horn = V(X(4.2), FR.bottomAt(4.2, z) + 0.06, side * (z - 0.05));
      const rod = mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 1, 6), F.steel());
      rods.push(rod);
      horns.push({ h, horn, rod, p0: V(X(s0), FR.bottomAt(s0, z), side * z) });
    }
    const crankG = mesh(merge([new THREE.BoxGeometry(0.08, 0.04, 0.12).translate(crank.x, crank.y, crank.z), new THREE.CylinderGeometry(0.0075, 0.0075, 0.22, 6).translate(crank.x + 0.06, crank.y - 0.11, 0)]), F.steel());
    P('Nose gear door linkage', {
      system: 'Landing gear', material: 'Steel push rods and bellcrank', mass: 3,
      explode: [0.6, -0.95, 0.5],
      desc: 'Mechanical rods from a bellcrank on the well roof, worked by the leg as it swings, open and close both nose-gear doors in step with the gear, so no separate door actuators are needed (linkage geometry approximate).',
    }, [crankG, ...rods]);
    const hp = new THREE.Vector3();
    anim.gearLinks.push(() => {
      for (const k of horns) {
        hp.subVectors(k.horn, k.p0).applyQuaternion(k.h.pivot.quaternion).add(k.p0);
        place(k.rod, crank, hp);
      }
    });
  }

  // ------------------------------------------------------------------ arresting hook and its door
  {
    const g = [rodV(V(X(15.7), -0.5, 0), V(X(17.1), -0.5, 0), 0.04, 10)];
    g.push(new THREE.BoxGeometry(0.14, 0.08, 0.16).translate(X(17.12), -0.52, 0));
    g.push(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 12).rotateX(Math.PI / 2).translate(X(15.7), -0.5, 0));
    const a = [rodV(V(X(15.9), -0.45, 0), V(X(16.4), -0.4, 0), 0.035, 10), rodV(V(X(15.62), -0.42, 0), V(X(15.9), -0.45, 0), 0.02, 8)];
    P('Arresting hook', {
      system: 'Landing gear', material: 'Steel shank and hook point, hydraulic hold-down / damper', mass: 40,
      explode: [-0.6, -1.0, 0],
      desc: 'An emergency tail hook stowed between the engines. A hydraulic damper holds it up and, when released, drops it to catch a runway cable if brakes or steering fail.',
    }, [mesh(merge(g), F.steel()), mesh(merge(a), F.hyd())]);
    const door = slab(toothedGrid((s, u) => [X(s), -FR.bD(s) - 0.002, lerp(-0.1, 0.1, u)], [15.65, 16.0, 16.35, 16.7, 17.05], { width: 0.2 }), () => [0, 0.02, 0], V(0, -1, 0));
    P('Arresting hook door', {
      system: 'Skin & fairings', skin: true, material: 'Composite door, saw-tooth ends', mass: 5,
      explode: [-0.6, -1.5, 0],
      desc: 'A narrow flush door between the engine bays covers the hook so it adds nothing to the radar signature.',
    }, mesh(door, F.door()));
  }
}
