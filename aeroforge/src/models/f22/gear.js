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

const { X, lerp, smooth } = FR;
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

  // ================================================================== nose gear (retracts forward under the cockpit floor)
  {
    const G = FR.GEAR.nose;
    const T = V(X(G.trunnion[0]), G.trunnion[1], G.trunnion[2]);
    const Rn = G.r, Wn = G.w;
    const axle = V(X(G.axleS), FR.GROUND + Rn, G.axleZ);
    const leg = axle.clone().sub(T);
    const L = leg.length();
    const dir = leg.clone().normalize();
    const at = (k) => dir.clone().multiplyScalar(L * k);
    // stowed: the leg lies forward, very slightly nose-down, the wheel under the cockpit floor
    const stowDir = V(X(G.stowS) - T.x, G.stowY - T.y, 0).normalize();
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
      desc: 'A single-wheel oleo-pneumatic strut: nitrogen and hydraulic oil inside it absorb the landing and taxi loads. Its trunnion sits at the aft end of the well and it retracts forward into the well under the cockpit floor, as photographs and the T.O. side view show (geometry approximate).',
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
      const Fp = V(X(G.trunnion[0] - 1.06), -0.15, dz);
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
      desc: 'A folding brace straddling the strut holds the leg against drag loads. Locked straight with the gear down (the yellow downlock at the knee), it breaks at the knee and folds flat as the leg swings up and forward (arrangement approximate).',
    }, bg);
    // retraction actuator, airframe end on a fitting in the well roof just ahead of the trunnion
    const Fa = V(X(G.trunnion[0] + 0.09), -0.06, 0);
    const Aa = legPoint(T, q, at(0.12).add(V(0, 0.0, 0)));
    const aBar = unitRod(0.042, F.hyd(), 12), aRod = unitRod(0.022, F.chrome(), 8);
    const aLen = Math.min(Fa.distanceTo(Aa(0)), Fa.distanceTo(Aa(1))) * 0.85;
    P('Nose gear retraction actuator', {
      system: 'Landing gear', material: 'Hydraulic jack, 4,000 psi', mass: 12,
      explode: [0.35, -0.3, -0.5],
      desc: 'A hydraulic jack between a fitting in the roof of the well and the top of the strut swings the leg up and forward into its well; hydraulic pressure also keeps the gear down until the downlock engages.',
    }, [aBar, aRod]);
    // uplock: hook on the well roof that catches a roller on the stowed leg
    const sU = G.trunnion[0] - 0.6 * L, yHi = -0.03, yLo = G.stowY + 0.13;      // from the well roof down to the stowed leg
    const ul = [new THREE.BoxGeometry(0.1, yHi - yLo, 0.08).translate(X(sU), (yHi + yLo) / 2, 0), new THREE.TorusGeometry(0.035, 0.012, 6, 12, Math.PI).rotateZ(Math.PI).translate(X(sU), yLo - 0.03, 0)];
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

  // ================================================================== main gears (swing up and aft, wheels turning flat)
  for (const side of [1, -1]) {
    const R = side > 0 ? 'right' : 'left';
    const G = FR.GEAR.main, W = FR.MAIN_WELL;
    const T = V(X(G.trunnion[0]), G.trunnion[1], side * G.trunnion[2]);
    const Rm = G.r, Wm = G.w;
    // the leg runs from the trunnion to its foot, where a stub axle carries the wheel G.stub m outboard
    const foot = V(X(G.axleS), FR.GROUND + Rm, side * G.legZ);
    const vd = foot.clone().sub(T);
    const L = vd.length();
    const dir = vd.clone().normalize();
    // stowed, the wheel lies flat under the foot (stub straight down) with its centre at G.stow; the leg keeps
    // its length, which sets how far inboard the foot comes (≈ 1.03 m out, so the wheel clears the trunk wall)
    const fs = [X(G.stow[0]), G.stow[1] + G.stub];
    const dS = fs[0] - T.x, dY = fs[1] - T.y;
    const footS = V(fs[0], fs[1], T.z - side * Math.sqrt(L * L - dS * dS - dY * dY));
    const q = new THREE.Quaternion().setFromUnitVectors(dir, footS.clone().sub(T).normalize());
    const trunnionAxis = dir.clone().cross(footS.clone().sub(T)).normalize();
    const at = (k) => dir.clone().multiplyScalar(L * k);
    const pv = [];
    // shock strut: outer cylinder on a trunnion pin (along the retraction axis), chromed piston, knuckle
    const sg = [rodV(at(-0.06), at(0.55), 0.1, 16), rodV(trunnionAxis.clone().multiplyScalar(-0.18), trunnionAxis.clone().multiplyScalar(0.18), 0.06, 14)];
    const ch = [rodV(at(0.5), at(0.97), 0.07, 14)];
    const pA = pivotAt(T);
    pA.add(mesh(merge(sg), F.gear()), mesh(merge(ch), F.chrome()));
    // brake line down the outboard side of the leg; the knuckle at the foot turns the stub axle from outboard
    // (gear down) to straight down (stowed), so the wheel goes into the well edge-on and lies flat once inside
    pA.add(mesh(rodV(at(0.05).add(V(0, 0, side * 0.105)), at(0.93).add(V(0, 0, side * 0.08)), 0.011, 6), F.hyd()));
    const knuckle = new THREE.Group();
    knuckle.position.copy(at(1));
    knuckle.add(mesh(merge([new THREE.CylinderGeometry(0.075, 0.075, 0.09, 16).rotateX(Math.PI / 2), new THREE.CylinderGeometry(0.055, 0.055, G.stub - Wm * 0.4, 12).rotateX(Math.PI / 2).translate(0, 0, side * (G.stub - Wm * 0.4) / 2)]), F.gear()));
    knuckle.add(mesh(FR.pipe([[0, 0.075, side * 0.06], [0, 0.11, side * 0.12], [0, 0.105, side * (G.stub - Wm * 0.4 - 0.006)]].map(([a, b, c]) => [X(0) - a, b, c]), 0.011, 5, 6), F.hyd()));
    pA.add(knuckle);
    pA.add(mesh(rodV(at(0.86).add(V(0, 0, side * 0.06)), at(0.86).add(V(0, 0, side * 0.17)), 0.015, 8), F.steel()));   // uplock roller pin
    P(`Main gear shock strut (${R})`, {
      system: 'Landing gear', material: '300M high-strength steel, chromed oleo piston', mass: 200,
      explode: [0, -0.95, 0.45 * side], callout: side > 0, anchor: [X(11.45), -1.25, side * 1.4],
      desc: 'Oleo-pneumatic shock strut on a trunnion in the well under the intake trunk. Its wheel rides on a stub axle outboard of the leg; to stow, the leg swings up and aft while the wheel turns over to lie flat in the well behind the weapons bay (geometry approximate).',
    }, pA);
    pv.push(pA);
    const pT = pivotAt(T);
    // on the inboard side of the leg, away from the wheel (which lies under the leg once stowed)
    const tl = (k, d) => at(k).add(V(0, 0, -side * d));
    pT.add(mesh(merge([rodV(tl(0.62, 0.12), tl(0.78, 0.2), 0.026), rodV(tl(0.78, 0.2), tl(0.93, 0.08), 0.026),
      new THREE.CylinderGeometry(0.03, 0.03, 0.14, 8).translate(...tl(0.78, 0.2).toArray())]), F.steel()));
    {
      // on the inboard side of the oleo cylinder above the torque links, well away from the tyre
      const pW = pivotAt(T);
      const Wo = G.wow, c = at(Wo.k).add(V(Wo.fwd, 0, side * Wo.dz));
      pW.add(mesh(merge([new THREE.BoxGeometry(...Wo.box).translate(c.x, c.y, c.z), rodV(c.clone().add(V(0, 0.025, side * 0.02)), at(0.15).add(V(0, 0, side * (Wo.dz + 0.01))), 0.006, 5)]), F.yellow()));
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
    // wheel and brake on the stub axle; the knuckle at the foot turns the axle from outboard (gear down) to
    // straight down (stowed), so the wheel goes into the well edge-on and lies flat once inside
    const w = wheelGeos(Rm, Wm, true);
    const pC = pivotAt(T);
    const turn = new THREE.Group();
    turn.position.copy(at(1));
    const wheel = new THREE.Group(); wheel.position.set(0, 0, side * G.stub);
    wheel.add(mesh(w.tyre, F.tyre()), mesh(w.hub, F.wheel()), mesh(w.cap, F.steel()), mesh(w.brake, F.brake()));
    turn.add(wheel);
    pC.add(turn);
    P(`Main wheel & carbon brake (${R})`, {
      system: 'Landing gear', material: 'Aluminium wheel, carbon–carbon brake stack, nitrogen-filled tyre', mass: 120,
      explode: [0, -1.35, 0.95 * side],
      desc: 'A single wheel per main leg on a cantilevered stub axle, with a multi-disc carbon brake, which stays strong when red-hot and weighs far less than steel (tyre size not published). Anti-skid control works through the brake-by-wire system.',
    }, pC);
    pv.push(pC);
    // the turn: world rotation about the fore-aft axis by beta, expressed in the swinging leg's frame
    // (and pitched nose-down by G.pitch once flat, following the belly, which rises toward the engine bay)
    const qLeg = new THREE.Quaternion(), qW = new THREE.Quaternion(), qP = new THREE.Quaternion(), ax = V(1, 0, 0), az = V(0, 0, 1);
    gear.push({
      pivots: pv, q,
      twist: {
        set(ku) {
          const t = smooth(G.turn[0], G.turn[1], ku);
          qLeg.copy(qI).slerp(q, ku).invert();
          qW.setFromAxisAngle(ax, side * (Math.PI / 2) * t);
          qP.setFromAxisAngle(az, -G.pitch * t);
          turn.quaternion.multiplyQuaternions(qLeg, qP.multiply(qW));
          knuckle.quaternion.copy(turn.quaternion);
        },
      },
    });

    // folding drag brace from a fitting on the wheel-bay roof, aft of the leg, to the strut, and its downlock
    const Fp = V(X(12.05), -0.48, side * 1.12);
    const Ad = legPoint(T, q, at(0.45));
    const fb = foldingBrace(Fp, Ad(0).clone(), Ad(1).clone(), V(1, -0.3, 0));
    const up = unitRod(0.042, F.gear()), lo = unitRod(0.038, F.gear()), lock = mesh(new THREE.BoxGeometry(0.08, 0.08, 0.07), F.yellow());
    const fit = mesh(new THREE.BoxGeometry(0.12, 0.07, 0.1).translate(Fp.x, Fp.y + 0.02, Fp.z), F.tiDull());
    P(`Main gear folding brace & downlock (${R})`, {
      system: 'Landing gear', material: 'Steel / titanium two-piece brace, spring-loaded downlock link', mass: 40,
      explode: [0.5, -0.75, 0.15 * side],
      desc: 'A two-piece drag brace runs forward and down from a fitting in the roof of the well to the strut and takes the drag loads. With the gear down it is locked straight by the yellow downlock link at its knee; it breaks there and folds as the leg swings back.',
    }, [up, lo, lock, fit]);
    // retraction actuator from the outboard roof of the well, aft of the trunnion, to the top of the strut
    const Fa = V(X(11.80), -0.48, side * 1.36);
    const Aa = legPoint(T, q, at(0.2));
    const aBar = unitRod(0.055, F.hyd(), 12), aRod = unitRod(0.03, F.chrome(), 10);
    const aLen = Math.min(Fa.distanceTo(Aa(0)), Fa.distanceTo(Aa(1))) * 0.85;
    P(`Main gear retraction actuator (${R})`, {
      system: 'Landing gear', material: 'Hydraulic jack, 4,000 psi', mass: 28,
      explode: [0.85, -0.45, 0.35 * side],
      desc: 'A hydraulic jack from a fitting in the roof of the well to the top of the strut pulls the leg up and aft in a few seconds; it is fed by the gear lines from the utility hydraulic manifold.',
    }, [aBar, aRod]);
    // uplock hanging from the wheel-bay roof beside the stowed leg; its hook closes round a roller pin on the
    // outboard side of the strut
    const ul = [new THREE.BoxGeometry(0.12, 0.085, 0.07).translate(X(12.23), -0.468, side * 1.205), new THREE.TorusGeometry(0.035, 0.012, 6, 14, Math.PI * 1.3).rotateZ(-Math.PI * 0.15).translate(X(12.23), -0.552, side * 1.205)];
    P(`Main gear uplock (${R})`, {
      system: 'Landing gear', material: 'Steel hook, hydraulic and free-fall release', mass: 6,
      explode: [-0.4, 0.35, 0.4 * side],
      desc: 'Latches a roller on the stowed strut so the hydraulics can be unloaded in flight; in an emergency it is released and the leg free-falls and locks down (position approximate).',
    }, mesh(merge(ul), F.steel()));

    // main door over the wheel bay, hinged on its inboard edge; a strut door over the leg slot ahead of it,
    // hinged on its outboard edge, folds up inside the well against the trunk wall
    const stM = ctx.sB.filter((s) => s >= W.sStep - 1e-6 && s <= W.s1 + 1e-6);
    const grid = toothedGrid((s, u) => [X(s), -FR.bD(s) - 0.002, side * lerp(FR.wellInner(s), FR.wellOuter(s) + 0.004, u)], stM, { width: FR.wellOuter(W.s1 - 0.33) - W.z0, fore: false, pitch: 0.1 });
    const door = slab(grid, () => [0, 0.02, 0], V(0, -1, 0));
    const hp0 = V(X(W.sStep), -FR.bD(W.sStep), side * W.z0);
    const h = hinge(mesh(door, F.door()), hp0, V(X(W.s1), -FR.bD(W.s1), side * W.z0), V(X(12.35), -1.0, side * 1.0), V(0, -1, 0));
    P(`Main gear door (${R})`, {
      system: 'Skin & fairings', skin: true, material: 'Composite door with saw-tooth edges', mass: 28,
      explode: [0, -1.65, 1.15 * side],
      desc: 'The large door over the wheel bay, about 0.9 m square, hinged on its inboard edge; open, it hangs straight down behind the wheel, as photographs of the jet show. Like the bay doors its aft edge is serrated to keep radar reflections in a few narrow directions.',
    }, h.pivot);
    anim.gearDoors.push({ h, angle: 1.55 });
    const stS = ctx.sB.filter((s) => s >= W.s0 - 1e-6 && s <= W.sStep + 1e-6);
    const zo = FR.wellOuter(W.s0);
    const gridS = toothedGrid((s, u) => [X(s), -FR.bD(s) - 0.002, side * lerp(W.zSlot, FR.wellOuter(s) + 0.004, u)], stS, { width: zo - W.zSlot, aft: false });
    const hS = hinge(mesh(slab(gridS, () => [0, 0.03, 0], V(0, -1, 0)), F.door()), V(X(W.s0), -FR.bD(W.s0), side * zo), V(X(W.sStep), -FR.bD(W.sStep), side * zo), V(X(11.6), -1.0, side * 1.25), V(0, 1, 0));
    P(`Main gear strut door (${R})`, {
      system: 'Skin & fairings', skin: true, material: 'Composite door, saw-tooth fore edge', mass: 6,
      explode: [0.3, -1.45, 1.35 * side],
      desc: 'Closes the slot the leg swings through, ahead of the main door. Opened, it folds up inside the well against its outboard wall, out of the way of the leg (arrangement approximate).',
    }, hS.pivot);
    anim.gearDoors.push({ h: hS, angle: 1.56 });
    // main-door jack at the forward inboard corner of the wheel bay, near the hinge, clear of the stowed wheel
    const Fd = V(X(12.03), -0.62, side * 0.62), Pd = V(X(12.03), -FR.bD(12.03) + 0.025, side * 0.7);
    const dBar = unitRod(0.03, F.hyd(), 10), dRod = unitRod(0.016, F.chrome(), 8);
    const dLen = Fd.distanceTo(Pd) * 0.85;
    const dq = new THREE.Quaternion(), dp = new THREE.Vector3();
    P(`Main gear door actuator (${R})`, {
      system: 'Landing gear', material: 'Hydraulic jack', mass: 5,
      explode: [-0.2, -1.2, 0.75 * side],
      desc: 'A small jack at the forward inboard corner of the wheel bay opens the door ahead of the leg and closes it behind it; the sequence valve keeps door and leg from colliding.',
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
      // each door runs from the centre line, where the pair meet, to its hinge on the cut-out's edge
      const grid = toothedGrid((s, u) => { const zz = side * lerp(0, z, u); return [X(s), FR.bottomAt(s, zz) - 0.002, zz]; }, st, { width: 0.24 });
      const door = slab(grid, () => [0, 0.03, 0], V(0, -1, 0));
      const h = hinge(mesh(door, F.door()), V(X(s0), FR.bottomAt(s0, z), side * z), V(X(s1), FR.bottomAt(s1, z), side * z), V(X((s0 + s1) / 2), -0.95, side * 0.05), V(0, -1, 0));
      pivots.push(h.pivot);
      hs.push({ h, side });
      anim.gearDoors.push({ h, angle: 1.55 });
    }
    P('Nose gear doors', {
      system: 'Skin & fairings', skin: true, material: 'Composite doors with saw-tooth fore and aft edges', mass: 18,
      explode: [0.4, -1.4, 0],
      desc: 'Two 2 m doors hinged at their outer edges close the nose-gear well between the inlets; a mechanical linkage opens them with the leg, and their fore and aft edges are saw-toothed like every other door.',
    }, pivots);
    // door linkage: a bellcrank on the well roof, driven by the leg near its trunnion, with a rod to a horn
    // on each door's hinge line
    const sK = s1 - 0.12;
    const crank = V(X(sK), -0.1, 0);
    const rods = [], horns = [];
    for (const { h, side } of hs) {
      const horn = V(X(sK), FR.bottomAt(sK, z) + 0.06, side * (z - 0.05));
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
    // the shank rises a little aft to stay inside the stinger, whose underside climbs behind the engine bays
    const h0 = 14.0, h1 = 16.3, hy = -0.56, hy1 = Math.max(hy, -FR.bD(h1) + 0.1);
    const g = [rodV(V(X(h0), hy, 0), V(X(h1), hy1, 0), 0.04, 10)];
    g.push(new THREE.BoxGeometry(0.14, 0.08, 0.16).rotateZ(-Math.atan2(hy1 - hy, h1 - h0)).translate(X(h1 - 0.03), hy1 - 0.02, 0));
    g.push(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 12).rotateX(Math.PI / 2).translate(X(h0), hy, 0));
    const a = [rodV(V(X(h0 + 0.2), hy + 0.05, 0), V(X(h0 + 0.7), hy + 0.1, 0), 0.035, 10), rodV(V(X(h0 - 0.08), hy + 0.08, 0), V(X(h0 + 0.2), hy + 0.05, 0), 0.02, 8)];
    P('Arresting hook', {
      system: 'Landing gear', material: 'Steel shank and hook point, hydraulic hold-down / damper', mass: 40,
      explode: [-0.6, -1.0, 0],
      desc: 'An emergency tail hook stowed on the centre line between the engines and in the stinger between the nozzles. A damper holds it up and, when released, drops it to catch a runway cable if brakes or steering fail (the T.O. calls it pneumatically extended and retracted).',
    }, [mesh(merge(g), F.steel()), mesh(merge(a), F.hyd())]);
    const yD = (s) => -FR.bD(s) - 0.002;
    const door = slab(toothedGrid((s, u) => [X(s), yD(s), lerp(-0.1, 0.1, u)], [h0 - 0.05, 14.7, 15.4, 16.0, h1 + 0.05], { width: 0.2 }), () => [0, 0.02, 0], V(0, -1, 0));
    P('Arresting hook door', {
      system: 'Skin & fairings', skin: true, material: 'Composite door, saw-tooth ends', mass: 5,
      explode: [-0.6, -1.5, 0],
      desc: 'A narrow flush door between the engine bays covers the hook so it adds nothing to the radar signature.',
    }, mesh(door, F.door()));
  }
}
