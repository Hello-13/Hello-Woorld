// F-22A landing gear, broken into the components a maintainer would name: for the steerable nose
// gear and each main gear, the oleo shock strut, torque links, folding drag (or side) brace with its
// downlock, retraction actuator, uplock, wheel / tyre / carbon brake and doors with their actuators,
// plus the arresting hook. The kinematics are solved in layout.js (FR.GEAR, gearRotation): each leg
// turns about its trunnion axis, the nose oleo shortens as it swings forward and the main wheel's stub
// axle turns on a knuckle at the foot so the wheel lies almost flat in the wing root. Every brace and
// actuator is a live linkage: its airframe end stays on its fitting while the leg swings, the brace
// folds at its knee and the actuator telescopes. Retraction geometry is estimated from photographs,
// the T.O. 00-105E-9 drawings and the NAWDC views; it is not published.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { F } from './materials.js';
import * as FR from './frame.js';
import { merge, slab, hinge, toothedGrid, platePoly } from './util.js';

const { X, lerp, smooth } = FR;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
/** Station point [s, y, z] → model Vector3 (z times side). */
const S3 = (p, side = 1) => V(X(p[0]), p[1], side * p[2]);
/** Station direction → model direction (s runs opposite to x). */
const D3 = (d, side = 1) => V(-d[0], d[1], side * d[2]).normalize();

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

/** Box centred at c with its edges along the (orthonormal) axes ex, ey, ez and sizes sx, sy, sz. */
function boxAlong(c, ex, ey, ez, sx, sy, sz) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  g.applyMatrix4(new THREE.Matrix4().makeBasis(ex, ey, ez));
  return g.translate(c.x, c.y, c.z);
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

/** Knee of a two-link brace from F to A (links l1, l2), broken toward `bend`. */
const kU = new THREE.Vector3(), kB = new THREE.Vector3();
function knee(Fp, A, l1, l2, bend, out) {
  kU.subVectors(A, Fp);
  const d = Math.max(1e-4, kU.length());
  kU.multiplyScalar(1 / d);
  const along = Math.min(l1, (l1 * l1 - l2 * l2 + d * d) / (2 * d));
  const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  kB.copy(bend).addScaledVector(kU, -bend.dot(kU)).normalize();
  return out.copy(Fp).addScaledVector(kU, along).addScaledVector(kB, h);
}

/** Pivot group for a moving assembly: the group sits at p, its contents are given in model coordinates. */
function pivotAt(p) {
  const pivot = new THREE.Group();
  pivot.position.copy(p);
  const inner = new THREE.Group();
  inner.position.copy(p).negate();
  pivot.add(inner);
  return { pivot, inner };
}

/** Telescoping jack: barrel from its fitting, rod to the moving end. */
function jackMeshes(rBarrel, rRod) { return { bar: unitRod(rBarrel, F.hyd(), 12), rod: unitRod(rRod, F.chrome(), 8) }; }
function placeJack(j, Fp, A, barLen, rodStart = 0.06) {
  place(j.bar, Fp, A, Math.min(barLen, Fp.distanceTo(A) - 0.02));
  tmpM.subVectors(A, Fp).normalize();
  place(j.rod, tmpM.clone().multiplyScalar(rodStart).add(Fp), A);
}

export function buildGear(ctx) {
  const { P, anim } = ctx;
  anim.gearLinks = [];
  const legSet = [];                                   // (ku) → leg pivots and knuckles
  const setLeg = (pivot, key, side) => { const k = new THREE.Vector3(); return (ku) => { const r = FR.gearRotation(key, ku, side); k.set(-r.k[0], r.k[1], r.k[2]).normalize(); pivot.quaternion.setFromAxisAngle(k, -r.angle); }; };
  /** Leg-fixed point p (model coords, gear down) at retraction ku. */
  const legPt = (key, side) => { const q = new THREE.Quaternion(), k = new THREE.Vector3(); return (p, ku, out = new THREE.Vector3()) => { const r = FR.gearRotation(key, ku, side); const T = S3(r.T); k.set(-r.k[0], r.k[1], r.k[2]).normalize(); q.setFromAxisAngle(k, -r.angle); return out.copy(p).sub(T).applyQuaternion(q).add(T); }; };

  // ================================================================== nose gear (retracts forward under the cockpit floor)
  {
    const G = FR.GEAR.nose, NF = FR.NOSE_FIT, NW = FR.NOSE_WELL;
    const Ts = G.trunnion, T = S3(Ts), Rn = G.r, Wn = G.w;
    const axD = [G.axleS, FR.GROUND + Rn, 0];
    const u = D3([axD[0] - Ts[0], axD[1] - Ts[1], 0]);                 // down the leg (model)
    const aft = V(1, 0, 0).addScaledVector(u, -u.x).normalize().negate(); // perpendicular to the leg, toward +s (aft)
    const lat = V(0, 0, 1);
    const at = (t, a = 0, z = 0) => T.clone().addScaledVector(u, t).addScaledVector(aft, a).add(V(0, 0, z));
    const Lg = G.legLength;
    const lp = legPt('nose', 1);
    const pivots = [];
    const legGroup = () => { const g = pivotAt(T); pivots.push(g.pivot); return g; };
    const sliders = [];
    const slideGroup = (parent) => { const g = new THREE.Group(); parent.add(g); sliders.push(g); return g; };

    // shock strut: trunnion cross-tube in bearings on the well's side walls, outer cylinder, steering collar, chromed
    // piston and the fork (yoke) round the wheel, with the axle across it
    const s1 = legGroup();
    const cyl = [rodV(T.clone().add(V(0, 0, -NW.wall + 0.005)), T.clone().add(V(0, 0, NW.wall - 0.005)), 0.04, 12), rodV(at(-0.04), at(0.40), 0.065, 16), rodV(at(0.30), at(0.37), 0.085, 18)];
    // lugs: drag brace (front), retraction jack (right side), steering actuator (aft, right)
    cyl.push(boxAlong(at(NF.brace.at, -0.075), u, aft, lat, 0.07, 0.06, 0.08));
    cyl.push(rodV(at(NF.jack.at, 0, 0.05), at(NF.jack.at, 0, NF.jack.z), 0.025, 10));
    const yoke = [];
    const crown = at(0.645);
    yoke.push(boxAlong(crown, u, aft, lat, 0.05, 0.09, 0.29));
    for (const zz of [-0.122, 0.122]) yoke.push(boxAlong(at(0.82, 0, zz), u, aft, lat, 0.36, 0.07, 0.025));
    yoke.push(rodV(at(Lg, 0, -0.14), at(Lg, 0, 0.14), 0.03, 12));
    yoke.push(rodV(at(Lg, 0, -0.135), at(Lg, 0, -0.165), 0.02, 10));                // uplock roller on the left arm
    const pis = [rodV(at(0.36), at(0.625), 0.045, 14)];
    s1.inner.add(mesh(merge(cyl), F.gear()));
    const sl1 = slideGroup(s1.inner);
    sl1.add(mesh(merge(yoke), F.gear()), mesh(merge(pis), F.chrome()));
    P('Nose gear shock strut', {
      system: 'Landing gear', material: 'Steel oleo-pneumatic strut (AerMet 100 per GlobalSecurity), chromed piston, forged fork', mass: 85,
      explode: [0.4, -0.85, 0],
      desc: 'A single-wheel oleo-pneumatic strut: nitrogen and hydraulic oil inside it absorb the landing and taxi loads. A forged fork carries the wheel on an axle across its arms, as photographs show. The trunnion is at the aft end of the well, 0.2 m behind the axle, so the leg rakes forward; it retracts FORWARD into the well under the cockpit floor (T.O. 00-105E-9 side view, photographs), and the oleo is drawn 0.2 m shorter on the way up so the wheel fits the 1.6 m well (shortening estimated).',
    }, s1.pivot);

    // taxi / landing light on the fork's crown, facing forward
    {
      const g = legGroup(), sl = slideGroup(g.inner);
      const c = at(0.645, -0.095);
      const body = merge([new THREE.CylinderGeometry(0.05, 0.045, 0.06, 16).rotateZ(Math.PI / 2).translate(c.x + 0.03, c.y, c.z), new THREE.BoxGeometry(0.06, 0.03, 0.04).translate(c.x - 0.01, c.y, c.z)]);
      const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.04, 16).rotateY(Math.PI / 2).translate(c.x + 0.061, c.y, c.z), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff2d8, emissiveIntensity: 0 }));
      lamp.userData.fx = true;
      sl.add(mesh(body, F.lens()), lamp);
      anim.taxiLight = lamp.material;
      P('Taxi / landing light', {
        system: 'Electrical', material: 'Sealed lamp on the nose strut, 28 V DC', mass: 2,
        explode: [1.1, -0.75, 0.3],
        desc: 'The jet\'s one forward-facing white light, on the nose leg\'s fork so it stows inside the well with the gear. Like the other lights it runs from the 28 V DC buses fed by the 270 → 28 V converter-regulators; it comes on only with the gear down.',
      }, g.pivot);
    }
    // weight-on-wheels switch on the front of the cylinder, above the fork and well clear of the tyre
    {
      const g = legGroup();
      const Wo = G.wow, c = S3(FR.wowCentre(G));
      g.inner.add(mesh(merge([new THREE.BoxGeometry(...Wo.box).translate(c.x, c.y, c.z), rodV(c.clone().add(V(-0.02, 0.015, 0)), at(0.26, -0.06, Wo.dz * 0.6), 0.006, 5)]), F.yellow()));
      P('Nose gear weight-on-wheels switch', {
        system: 'Landing gear', material: 'Proximity sensor on the strut, redundant channels', mass: 1,
        explode: [1.0, -1.3, 0.45],
        desc: 'Senses when the oleo compresses under load. Weight-on-wheels interlocks stop the gear retracting on the ground; in a 2018 mishap the jet sensed weight off wheels at 135 KCAS after rotating early, and the gear came up before it could fly.',
      }, g.pivot);
    }
    {
      const g = legGroup();
      g.inner.add(mesh(merge([boxAlong(at(0.335, 0.1, 0.05), u, aft, lat, 0.08, 0.07, 0.09), rodV(at(0.30, 0.10, 0.11), at(0.37, 0.07, 0.10), 0.018)]), F.hyd()));
      P('Nose-wheel steering unit', {
        system: 'Landing gear', material: 'Hydraulic steering collar and actuator, electrically commanded', mass: 14,
        explode: [0.75, -0.6, 0.45],
        desc: 'A collar on the strut with a hydraulic actuator behind it turns the nose wheel on command from the rudder pedals through the vehicle-management system; it centres the wheel before the leg retracts.',
      }, g.pivot);
    }
    // torque links behind the strut: a scissor from the cylinder's lower collar to the fork, folding as the oleo shortens
    const tq = { g: legGroup(), up: unitRod(0.018, F.steel()), lo: unitRod(0.018, F.steel()), pin: mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.08, 8).rotateX(Math.PI / 2), F.steel()) };
    tq.g.inner.add(tq.up, tq.lo, tq.pin);
    const tqA = at(0.385, 0.075), tqB0 = at(0.635, 0.06), tqL = 0.135, tqTmp = new THREE.Vector3(), tqK = new THREE.Vector3();
    P('Nose gear torque links', {
      system: 'Landing gear', material: 'Forged steel scissor links', mass: 5,
      explode: [0.95, -1.05, 0.2],
      desc: 'A scissor linkage between the cylinder and the fork lets the oleo compress (and shorten on retraction) while keeping the fork from turning on the piston, so steering commands reach the wheel.',
    }, tq.g.pivot);

    const w = wheelGeos(Rn, Wn, false);
    const gW = legGroup(), slW = slideGroup(gW.inner);
    const wheel = new THREE.Group(); wheel.position.copy(at(Lg));
    wheel.add(mesh(w.tyre, F.tyre()), mesh(w.hub, F.wheel()), mesh(w.cap, F.steel()));
    slW.add(wheel);
    P('Nose wheel & tyre', {
      system: 'Landing gear', material: 'Aluminium wheel, nitrogen-filled radial tyre (23.5 × 7.5 R10, 22-ply, 290 psi)', mass: 32,
      explode: [0.6, -1.1, 0],
      desc: `A single nose wheel on a 23.5 × 7.5 R10 radial tyre (Michelin's F-22 data: 22-ply, rated for 14,000 lb at 290 psi and 248 mph). Like all military jet tyres it is filled with dry nitrogen, which does not support combustion and keeps its pressure steady through big temperature swings.`,
    }, gW.pivot);
    legSet.push((ku) => {
      const r = FR.gearRotation('nose', ku), q = new THREE.Quaternion().setFromAxisAngle(V(-r.k[0], r.k[1], r.k[2]).normalize(), -r.angle);
      for (const p of pivots) p.quaternion.copy(q);
      const sh = FR.noseShrink(ku);
      for (const g of sliders) g.position.copy(u).multiplyScalar(-sh);
      const B = tqTmp.copy(tqB0).addScaledVector(u, -sh);
      knee(tqA, B, tqL, tqL, aft, tqK);
      place(tq.up, tqA, tqK); place(tq.lo, tqK, B); tq.pin.position.copy(tqK);
    });

    // drag brace ahead of the leg, from a fitting under the cockpit floor to the cylinder's front lug; locked straight
    // with the gear down, it breaks aft and up at the knee as the leg swings forward
    {
      const Fp = S3(NF.brace.fit), Ad = at(NF.brace.at, -0.075), dD = Fp.distanceTo(Ad), l1 = NF.brace.alpha * dD, l2 = dD - l1;
      const up = unitRod(0.028, F.gear()), lo = unitRod(0.026, F.gear()), lock = mesh(new THREE.BoxGeometry(0.06, 0.06, 0.07), F.yellow());
      const fit = mesh(merge([new THREE.BoxGeometry(0.09, NW.roof - Fp.y + 0.02, 0.12).translate(Fp.x, (NW.roof + Fp.y) / 2, 0), new THREE.CylinderGeometry(0.02, 0.02, 0.14, 8).rotateX(Math.PI / 2).translate(Fp.x, Fp.y, 0)]), F.tiDull());
      P('Nose gear drag brace & downlock', {
        system: 'Landing gear', material: 'Steel two-piece folding brace, spring-loaded downlock', mass: 18,
        explode: [0.6, -0.55, 0.55],
        desc: 'A folding brace from a fitting under the cockpit floor to the front of the strut holds the leg against drag loads. Locked straight with the gear down (the yellow downlock at the knee), it breaks at the knee — aft and upward — and folds as the leg swings up and forward (arrangement estimated).',
      }, [up, lo, lock, fit]);
      const bend = V(-1, 1, 0).normalize(), A = new THREE.Vector3(), K = new THREE.Vector3();
      anim.gearLinks.push((ku) => { lp(Ad, ku, A); knee(Fp, A, l1, l2, bend, K); place(up, Fp, K); place(lo, K, A); lock.position.copy(K); });
    }
    // retraction jack beside the wheel (right), from a fitting under the cockpit floor to the strut's side lug
    {
      const Fp = S3(NF.jack.fit), Ad = at(NF.jack.at, 0, NF.jack.z);
      const j = jackMeshes(0.04, 0.022);
      const barLen = Math.min(Fp.distanceTo(Ad), Fp.distanceTo(lp(Ad, 1))) - 0.06;
      const fit = mesh(new THREE.BoxGeometry(0.1, NW.roof - Fp.y + 0.02, 0.08).translate(Fp.x, (NW.roof + Fp.y) / 2, Fp.z), F.tiDull());
      P('Nose gear retraction actuator', {
        system: 'Landing gear', material: 'Hydraulic jack, 4,000 psi', mass: 12,
        explode: [0.35, -0.3, -0.5],
        desc: 'A hydraulic jack beside the wheel, from a fitting under the forward cockpit floor to a lug on the side of the strut, pulls the leg up and forward into its well; hydraulic pressure also holds the gear down until the downlock engages.',
      }, [j.bar, j.rod, fit]);
      const A = new THREE.Vector3();
      anim.gearLinks.push((ku) => { lp(Ad, ku, A); placeJack(j, Fp, A, barLen, 0.1); });
    }
    // uplock on a bracket from the well roof beside the stowed wheel (left), its hook round the fork's roller
    {
      const Rs = lp(at(Lg - FR.noseShrink(1), 0, -0.15), 1);
      const zU = NF.uplock.z, top = NW.roof, bot = Rs.y + 0.04;
      const g = [new THREE.BoxGeometry(0.07, top - bot, 0.04).translate(Rs.x, (top + bot) / 2, zU), new THREE.BoxGeometry(0.1, 0.05, 0.05).translate(Rs.x, bot + 0.01, zU + 0.02),
        new THREE.TorusGeometry(0.03, 0.01, 6, 14, Math.PI * 1.2).rotateZ(-Math.PI * 0.1).translate(Rs.x, Rs.y, -0.15)];
      P('Nose gear uplock', {
        system: 'Landing gear', material: 'Steel hook with hydraulic release and manual (free-fall) release', mass: 3,
        explode: [0.0, 0.35, -0.35],
        desc: 'A hook on a bracket from the roof of the well, beside the stowed wheel, latches a roller on the fork so no hydraulic pressure is needed to hold the leg up; for emergency extension stored-energy-system air releases it (T.O. 00-105E-9) and the gear falls and locks under its own weight and the airflow (position estimated).',
      }, mesh(merge(g), F.steel()));
    }
    // external canopy switch and the canopy's manual drive adapter on the well's forward left side wall (T.O. 00-105E-9:
    // "located in the nose wheel well on the forward left sidewall"; the manual adapter takes a drill or hand tool)
    {
      const sC = NW.front + 0.08, zC = -(NW.wall - 0.015);
      const g = [FR.boxS(sC, -0.30, zC, 0.12, 0.10, 0.03), FR.boxS(sC + 0.12, -0.30, zC, 0.08, 0.08, 0.03)];
      const k = [new THREE.CylinderGeometry(0.008, 0.008, 0.03, 8).rotateX(Math.PI / 2).translate(X(sC), -0.28, zC + 0.03), new THREE.CylinderGeometry(0.015, 0.015, 0.03, 10).rotateX(Math.PI / 2).translate(X(sC + 0.12), -0.30, zC + 0.03)];
      P('External canopy switch & manual drive adapter', {
        system: 'Crew systems', material: 'Switch box and 3/8 in square-drive adapter in the nose-wheel well', mass: 1,
        explode: [0.9, -0.5, -0.6],
        desc: 'On the forward left side wall of the nose-wheel well: the external canopy up / hold / down switch and the adapter where a ground crew can drive the canopy actuator by hand or with a power drill (T.O. 00-105E-9 rescue information; positions approximate).',
      }, [mesh(merge(g), F.boxLight()), mesh(merge(k), F.steel())]);
    }
    // trunnion fittings on the well's side walls
    P('Nose gear trunnion fittings', {
      system: 'Landing gear', material: 'Titanium bearing housings on the well side walls', mass: 6,
      explode: [0.1, -0.2, 0.6],
      desc: 'Bearing housings on both side walls of the well at its aft end carry the nose leg\'s trunnion cross-tube; the leg pivots here as it swings forward.',
    }, mesh(merge([-1, 1].map((sd) => new THREE.CylinderGeometry(0.06, 0.06, 0.035, 14).rotateX(Math.PI / 2).translate(T.x, T.y, sd * (NW.wall + 0.0075)))), F.tiDull()));
  }

  // ================================================================== main gears (swing outward and up into the wing roots)
  for (const side of [1, -1]) {
    const R = side > 0 ? 'right' : 'left';
    const G = FR.GEAR.main, MF = FR.MAIN_FIT, W = FR.MAIN_WELL;
    const Rm = G.r, Wm = G.w;
    const T = S3(G.trunnion, side), Fd = S3(G.foot, side);
    const u = Fd.clone().sub(T).normalize(), Lg = G.legLength;
    const kAx = D3(G.k, side);                                     // trunnion axis (model; for the left, mirrored)
    const aft = V(1, 0, 0).addScaledVector(u, -u.x).normalize().negate();   // perpendicular to the leg, aft
    const out = new THREE.Vector3().crossVectors(aft, u).multiplyScalar(side).normalize();    // perpendicular, outboard
    const at = (t, a = 0, o = 0) => T.clone().addScaledVector(u, t).addScaledVector(aft, a).addScaledVector(out, o);
    const kPerp = kAx.clone().addScaledVector(u, -kAx.dot(u)).normalize();
    const w3 = new THREE.Vector3().crossVectors(u, kPerp).normalize();
    const lp = legPt('main', side);
    const pivots = [];
    const legGroup = () => { const g = pivotAt(T); pivots.push(g.pivot); return g; };
    // knuckle at the foot: turns the stub axle (and the wheel) as the leg swings
    const qAx = D3(G.knuckleAxis, side), knuckles = [];
    const knuckleGroup = (parent) => { const g = pivotAt(Fd); parent.add(g.pivot); knuckles.push(g.pivot); return g.inner; };
    const stubDir = V(0, 0, side);

    // shock strut: trunnion tube along the trunnion axis (its ends in the bulkhead web's and the gear beam's
    // bearings), the yoke down to the outer cylinder, chromed piston, axle fork at the foot holding the knuckle pin
    const sA = legGroup();
    const sg = [rodV(T.clone().addScaledVector(kAx, MF.bearing[0] - 0.01), T.clone().addScaledVector(kAx, MF.bearing[1] + 0.02), 0.05, 14)];
    sg.push(boxAlong(T.clone().addScaledVector(u, 0.08).addScaledVector(kPerp, 0.07), u, kPerp, w3, 0.22, 0.17, 0.10));
    sg.push(rodV(at(0.20), at(0.47), 0.075, 18));
    // lugs: side brace (toward its fitting), retraction jack (toward the gear beam)
    const braceFit = S3(MF.brace.fit, side), jackFit = S3(MF.jack.fit, side);
    // a lug points between the directions of its fitting as seen from the leg gear down and stowed, so the brace or
    // jack meets it from the lug's side in both
    const qUp = new THREE.Quaternion().setFromAxisAngle(V(-FR.gearRotation('main', 1, side).k[0], FR.gearRotation('main', 1, side).k[1], FR.gearRotation('main', 1, side).k[2]).normalize(), -FR.gearRotation('main', 1, side).angle);
    const lugDir = (Fp, t) => {
      const perp = (d) => d.addScaledVector(u, -d.dot(u)).normalize();
      const d0 = perp(Fp.clone().sub(at(t))), d1 = perp(Fp.clone().sub(T).applyQuaternion(qUp.clone().invert()).add(T).sub(at(t)));
      return d0.add(d1).normalize();
    };
    const bLug = at(MF.brace.at).addScaledVector(lugDir(braceFit, MF.brace.at), 0.11), jLug = at(MF.jack.at).addScaledVector(lugDir(jackFit, MF.jack.at), 0.11);
    sg.push(rodV(at(MF.brace.at), bLug, 0.03, 10), rodV(at(MF.jack.at), jLug, 0.032, 10));
    sg.push(boxAlong(at(Lg - 0.02), u, qAx, new THREE.Vector3().crossVectors(u, qAx).normalize(), 0.1, 0.17, 0.1));
    const ch = [rodV(at(0.45), at(Lg - 0.06), 0.055, 16)];
    sA.inner.add(mesh(merge(sg), F.gear()), mesh(merge(ch), F.chrome()));
    // brake line down the aft side of the leg into the knuckle
    sA.inner.add(mesh(rodV(at(0.22, 0.1), at(Lg - 0.08, 0.075), 0.011, 6), F.hyd()));
    const kn = knuckleGroup(sA.inner);
    kn.add(mesh(merge([rodV(Fd.clone().addScaledVector(qAx, -0.06), Fd.clone().addScaledVector(qAx, 0.06), 0.05, 14),
      rodV(Fd, Fd.clone().addScaledVector(stubDir, G.stub + Wm * 0.5 + 0.005), 0.05, 14)]), F.gear()));
    kn.add(mesh(FR.pipe([[FR.SN - (Fd.x - 0.075), Fd.y + 0.05, Fd.z], [FR.SN - (Fd.x - 0.06), Fd.y + 0.09, Fd.z + side * 0.04], [FR.SN - (Fd.x - 0.03), Fd.y + 0.12, Fd.z + side * 0.07]], 0.011, 5, 6), F.hyd()));
    // uplock roller on the end of the stub axle
    kn.add(mesh(rodV(Fd.clone().addScaledVector(stubDir, G.stub + Wm * 0.5), Fd.clone().addScaledVector(stubDir, G.stub + Wm * 0.5 + 0.04), MF.uplock.roller, 10), F.steel()));
    P(`Main gear shock strut (${R})`, {
      system: 'Landing gear', material: 'Steel (AerMet 100 per GlobalSecurity), chromed oleo piston; Goodrich, Haltom City', mass: 200,
      explode: [0, -0.95, 0.45 * side], callout: side > 0, anchor: [X(11.45), -1.25, side * 1.4],
      desc: 'Oleo-pneumatic shock strut on a trunnion just behind the titanium bulkhead at the wing\'s 36 % spar, raked forward at the top about 15° and splayed out at the foot, as photographs and the T.O. 00-105E-9 drawings show. Its wheel rides on a stub axle outboard of the leg. To stow, the leg swings OUTWARD and up about a trunnion axis skewed in plan, out through the trunk side, while a knuckle at the foot turns the stub axle about 26°, so the wheel ends lying almost flat in the wing root between the 36 % and 49 % spars (GlobalSecurity: the main gear retracts outward; retraction geometry estimated). The model stands as the NAWDC side view and the T.O. side drawing are drawn, with the fin tips at the published 5.08 m; the T.O.\'s labelled heights for a fully serviced jet (canopy 10 ft 6 in, lower fuselage 3 ft 2 in, fin 16 ft 7 in) put it about 0.1 m lower and 1° nose-down, the oleos compressed further by a full fuel load. DLA procurement notices name Goodrich Corporation (CAGE 6K4C8, Haltom City, Texas; Menasco passed to Goodrich in 1999, and Goodrich is now part of Collins Aerospace) as the F-22 gear\'s maker. Only GlobalSecurity (now paywalled, not checked again here) says the legs are AerMet 100 steel, chosen for strength and corrosion protection, and that the main strut is a dual-piston design.',
    }, sA.pivot);
    // torque links on the aft side of the leg
    const sT = legGroup();
    sT.inner.add(mesh(merge([rodV(at(0.44, 0.09), at(0.60, 0.19), 0.022), rodV(at(0.60, 0.19), at(0.76, 0.07), 0.022),
      new THREE.CylinderGeometry(0.026, 0.026, 0.1, 8).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, out)).translate(...at(0.60, 0.19).toArray())]), F.steel()));
    P(`Main gear torque links (${R})`, {
      system: 'Landing gear', material: 'Forged steel scissor links', mass: 8,
      explode: [0.55, -1.2, 0.5 * side],
      desc: 'Scissor links behind the leg join the cylinder to the sliding piston so the oleo can compress without letting the axle twist under braking.',
    }, sT.pivot);
    {
      // on the inboard side of the oleo cylinder, well away from the tyre
      const sW = legGroup();
      const Wo = G.wow, c = S3(FR.wowCentre(G), side);
      sW.inner.add(mesh(merge([new THREE.BoxGeometry(...Wo.box).translate(c.x, c.y, c.z), rodV(c.clone().add(V(0, 0.03, 0)), at(0.25, 0, -0.08), 0.006, 5)]), F.yellow()));
      P(`Main gear weight-on-wheels switch (${R})`, {
        system: 'Landing gear', material: 'Proximity sensor on the oleo cylinder, redundant channels', mass: 1,
        explode: [0.75, -1.5, 0.75 * side],
        desc: 'Tells the flight controls, gear handle interlock and brakes whether the leg is carrying weight. The gear-retraction interlock relies on it, so a false weight-off-wheels signal at low speed can raise the gear too soon.',
      }, sW.pivot);
    }
    // strut door: fixed to the leg on its forward side (photographs), a saw-toothed panel that swings with it
    {
      const sD = legGroup();
      // (on the lower leg, below the side brace's lug and inboard of the tyre's inner face)
      const t0 = 0.43, t1 = 0.66, wIn = -0.10, wOut = 0.07, off = 0.11, th = 0.02;
      const pts = (t, wv) => at(t, -off, 0).addScaledVector(out, wv);
      const grid = toothedGrid((t, v) => pts(t, lerp(wIn, wOut, v)).toArray(), [t0, (t0 + t1) / 2, t1], { width: wOut - wIn, pitch: 0.08 });
      const door = slab(grid, () => aft.clone().multiplyScalar(th).toArray());
      const br = [rodV(at(0.47, -off + th), at(0.47, -0.05), 0.012, 6), rodV(at(0.62, -off + th), at(0.62, -0.05), 0.012, 6)];
      sD.inner.add(mesh(door, F.door()), mesh(merge(br), F.steel()));
      P(`Main gear strut door (${R})`, {
        system: 'Skin & fairings', skin: true, material: 'Composite door, saw-tooth edges', mass: 6,
        explode: [0.3, -1.45, 1.35 * side],
        desc: 'A small fairing door fixed to the forward side of the leg, as photographs show; it swings with the leg and, with the gear down, closes the front of the gap the leg stands in.',
      }, sD.pivot);
    }
    // wheel and brake on the stub axle (in the knuckle)
    {
      const sC = legGroup();
      const knC = knuckleGroup(sC.inner);
      const w = wheelGeos(Rm, Wm, true);
      const wheel = new THREE.Group(); wheel.position.copy(Fd.clone().addScaledVector(stubDir, G.stub));
      wheel.add(mesh(w.tyre, F.tyre()), mesh(w.hub, F.wheel()), mesh(w.cap, F.steel()), mesh(w.brake, F.brake()));
      knC.add(wheel);
      P(`Main wheel & carbon brake (${R})`, {
        system: 'Landing gear', material: 'Aluminium wheel, carbon–carbon brake stack, nitrogen-filled radial tyre (37 × 11.5 R18, 28-ply, 275 psi)', mass: 120,
        explode: [0, -1.35, 0.95 * side],
        desc: 'A single wheel per main leg on a cantilevered stub axle, on a 37 × 11.5 R18 radial tyre (Michelin\'s F-22 data: 28-ply, rated for 36,000 lb at 275 psi and 248 mph), with a multi-disc carbon brake, which stays strong when red-hot and weighs far less than steel. Anti-skid control works through the brake-by-wire system.',
      }, sC.pivot);
    }
    legSet.push((ku) => {
      const r = FR.gearRotation('main', ku, side), q = new THREE.Quaternion().setFromAxisAngle(V(-r.k[0], r.k[1], r.k[2]).normalize(), -r.angle);
      for (const p of pivots) p.quaternion.copy(q);
      const kq = new THREE.Quaternion().setFromAxisAngle(qAx, -side * G.knuckle * smooth(G.knuckleRamp[0], G.knuckleRamp[1], ku));
      for (const k of knuckles) k.quaternion.copy(kq);
    });

    // well structure: the bulkhead's web across the front of the well with the forward trunnion bearing and the side
    // brace's fitting, the gear beam along the inboard wall with the aft bearing and the jack's fitting
    {
      const sw = MF.web.s, D0 = MF.web, wz = (y) => FR.wallZ(sw, y) - 0.03;
      const poly = [[0.95, D0.y0], [0.95, -0.78], [1.09, -0.62], [1.26, -0.45], [1.26, D0.y1], [wz(D0.y1), D0.y1], [wz(-0.6), -0.6], [wz(-0.8), -0.8], [wz(D0.y0), D0.y0]].map(([z, y]) => [side * z, y]);
      const web = platePoly(sw + 0.025 - 0.0185, side > 0 ? poly : poly.slice().reverse(), 0.037, 0);
      const B = MF.beam;
      const parts = [web, FR.boxS((B.s0 + B.s1) / 2, (B.y0 + B.y1) / 2, side * (B.z0 + B.z1) / 2, B.s1 - B.s0, B.y1 - B.y0, B.z1 - B.z0)];
      const bF = T.clone().addScaledVector(kAx, MF.bearing[0]), bA = T.clone().addScaledVector(kAx, MF.bearing[1]);
      parts.push(rodV(bF.clone().addScaledVector(kAx, -0.025), bF.clone().addScaledVector(kAx, 0.025), 0.075, 16));
      parts.push(rodV(bA.clone().addScaledVector(kAx, -0.03), bA.clone().addScaledVector(kAx, 0.03), 0.075, 16));
      parts.push(new THREE.BoxGeometry(0.06, bA.y - B.y1 + 0.06, Math.abs(bA.z - side * B.z1) + 0.06).translate(bA.x, (bA.y + B.y1) / 2 - 0.01, (bA.z + side * B.z1) / 2));
      parts.push(new THREE.BoxGeometry(X(sw + 0.025) - braceFit.x + 0.04, 0.08, 0.1).translate((X(sw + 0.025) + braceFit.x - 0.04) / 2, braceFit.y, braceFit.z));
      // (the jack's fitting on a bracket out from the beam's outboard face)
      parts.push(new THREE.BoxGeometry(0.1, 0.07, Math.abs(jackFit.z) - B.z1 + 0.04).translate(jackFit.x, jackFit.y, side * (Math.abs(jackFit.z) + B.z1 - 0.04) / 2));
      P(`Main gear trunnion fittings & gear beam (${R})`, {
        system: 'Structure', material: 'Titanium web, machined bearing housings and gear beam', mass: 70,
        explode: [0.2, -0.5, 0.5 * side],
        desc: 'The main-gear loads come into the titanium bulkhead at the wing\'s 36 % spar: a web across the front of the wheel well carries the forward trunnion bearing and the side brace\'s fitting, and a beam along the well\'s inboard wall, from that bulkhead to the engine-bay frame at the 49 % spar, carries the aft bearing and the retraction jack (arrangement estimated).',
      }, mesh(merge(parts), F.tiDull()));
    }
    // side brace from the web to the leg; locked straight with the gear down, breaking downward at the knee as the leg
    // swings out and up
    {
      const Fp = braceFit, dD = Fp.distanceTo(bLug), l1 = MF.brace.alpha * dD, l2 = dD - l1;
      const up = unitRod(0.036, F.gear()), lo = unitRod(0.034, F.gear()), lock = mesh(new THREE.BoxGeometry(0.075, 0.075, 0.075), F.yellow());
      P(`Main gear side brace & downlock (${R})`, {
        system: 'Landing gear', material: 'Steel / titanium two-piece folding brace, spring-loaded downlock link', mass: 40,
        explode: [0.5, -0.75, 0.15 * side],
        desc: 'A two-piece side brace from a fitting on a bracket off the bulkhead web at the front of the well to the strut takes the side loads (the trunnion\'s two bearings take the drag loads). With the gear down it is locked straight by the yellow downlock link at its knee; it breaks aft, down and out there and folds as the leg swings out and up (arrangement estimated).',
      }, [up, lo, lock]);
      const bend = D3(MF.brace.bend, side), A = new THREE.Vector3(), K = new THREE.Vector3();
      anim.gearLinks.push((ku) => { lp(bLug, ku, A); knee(Fp, A, l1, l2, bend, K); place(up, Fp, K); place(lo, K, A); lock.position.copy(K); });
    }
    // retraction jack from the gear beam to the strut's inboard lug
    {
      const Fp = jackFit, j = jackMeshes(0.05, 0.028);
      const barLen = Math.min(Fp.distanceTo(jLug), Fp.distanceTo(lp(jLug, 1))) - 0.05;
      P(`Main gear retraction actuator (${R})`, {
        system: 'Landing gear', material: 'Hydraulic jack, 4,000 psi', mass: 28,
        explode: [0.85, -0.45, 0.35 * side],
        desc: 'A hydraulic jack from a fitting on the gear beam, low on the well\'s inboard wall, to a lug on the strut pushes the leg out and up in a few seconds; it is fed by the gear lines from the utility hydraulic manifold.',
      }, [j.bar, j.rod]);
      const A = new THREE.Vector3();
      anim.gearLinks.push((ku) => { lp(jLug, ku, A); placeJack(j, Fp, A, barLen, 0.08); });
    }
    // uplock in the roof of the well over the stowed wheel, catching the roller on the end of the stub axle
    {
      const P1 = FR.mainWheelPose(1, side), c = P1.centre, n = P1.axle;
      const r = [c[0] + n[0] * (Wm * 0.5 + 0.02), c[1] + n[1] * (Wm * 0.5 + 0.02), c[2] + n[2] * (Wm * 0.5 + 0.02)];
      const Rp = S3(r), [bx, , bz] = MF.uplock.box, yTop = Math.min(0.16, FR.topAt(r[0], Math.abs(r[2])) - 0.025);
      const g = [new THREE.BoxGeometry(bx, yTop - Rp.y - 0.015, bz).translate(Rp.x, (yTop + Rp.y + 0.015) / 2, Rp.z + side * 0.03),
        new THREE.TorusGeometry(0.04, 0.012, 6, 14, Math.PI * 1.25).rotateZ(-Math.PI * 0.62).rotateX(Math.PI / 2).translate(Rp.x, Rp.y + 0.005, Rp.z)];
      P(`Main gear uplock (${R})`, {
        system: 'Landing gear', material: 'Steel hook, hydraulic and free-fall release', mass: 6,
        explode: [-0.4, 0.45, 0.4 * side],
        desc: 'A hook in the roof of the well, over the stowed wheel, latches a roller on the end of the stub axle so the hydraulics can be unloaded in flight. For emergency extension, high-pressure air from the stored-energy system\'s bottles releases the gear (T.O. 00-105E-9) and the leg falls and locks down (position estimated).',
      }, mesh(merge(g), F.steel()));
    }

    // weapons-bay door safing panel in each well (T.O. 00-105E-9: "Door Safing Switches are located in the Main Landing
    // Gear Wheel Well on each respective side"; its picture shows guarded switches for the side-bay, main-bay and EW doors)
    {
      const sP = W.s0 + 0.015, yP = -0.40, zP = side * 1.45, g = [FR.boxS(sP, yP, zP, 0.03, 0.13, 0.17)], k = [];
      for (const dy of [0.03, -0.03]) for (const dz of [-0.05, 0, 0.05]) k.push(new THREE.CylinderGeometry(0.007, 0.007, 0.03, 8).rotateZ(Math.PI / 2).translate(X(sP + 0.03), yP + dy, zP + dz));
      P(`Weapons-bay door safing panel (${R})`, {
        system: 'Weapons', material: 'Guarded safing switches on a panel in the wheel well', mass: 1,
        explode: [0.4, -0.6, 1.1 * side],
        desc: 'On the front wall of each main wheel well: guarded switches that safe the main-bay, side-bay and countermeasure (EW) doors on that side, so they cannot be driven while people work round the jet (T.O. 00-105E-9; switch layout approximate).',
      }, [mesh(merge(g), F.boxLight()), mesh(merge(k), F.steel())]);
    }
    // service panel in the left well: APU shutdown switch, external battery switch and the portable maintenance aid's
    // ports, on the well's front wall by the door frame
    if (side < 0) {
      const sP = W.s0 + 0.015, yP = -0.56, zP = -1.40, g = [FR.boxS(sP, yP, zP, 0.03, 0.16, 0.22)], k = [];
      for (const dz of [-0.06, 0, 0.06]) k.push(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 8).rotateZ(Math.PI / 2).translate(X(sP + 0.03), yP + 0.04, zP + dz));
      for (const dz of [-0.045, 0.045]) k.push(new THREE.CylinderGeometry(0.02, 0.02, 0.025, 12).rotateZ(Math.PI / 2).translate(X(sP + 0.025), yP - 0.035, zP + dz));
      P('Left main-well service panel', {
        system: 'Electrical', material: 'Switch panel with guarded toggles and PMA connectors', mass: 2,
        explode: [0.4, -0.9, -1.0],
        desc: 'On the front wall of the left main wheel well, by the door frame: the APU shutdown switch and an external battery switch a ground crew can reach from outside the cockpit, above the portable-maintenance-aid (PMA) ports (T.O. 00-105E-9; panel layout approximate).',
      }, [mesh(merge(g), F.boxLight()), mesh(merge(k), F.steel())]);
    }

    // ---------------------------------------------------------------- main door and inboard door
    // Both doors follow the outer mould line closed (3 mm proud), inside their saw-toothed outlines (FR.MAIN_DOORS), and
    // meet with a 1 mm seam on the crease. Columns run across a door from its hinge to the crease, rows from its fore edge
    // to its aft edge at each column's plan position.
    const junc = (s) => [W.zJunction, FR.junctionY(s)], crease = (s) => FR.wallB(s, FR.wallFractions(s)[5]);
    const lo = (s, z) => FR.wingSurfaces(s, z)[0];
    const nIn = (s, z) => { const e = 0.004, a = FR.wellSkin(s, z - e), b = FR.wellSkin(s, z + e), L = Math.hypot(b[0] - a[0], b[1] - a[1]); return [-(b[1] - a[1]) / L, (b[0] - a[0]) / L]; };
    const doorGrid = (cols, rowsT) => {
      const pts = rowsT.map((t) => cols.map((c) => { const s = lerp(FR.doorFore(c.z), FR.doorAft(c.z), t), [zz, yy] = c.at(s); return [X(s), yy, side * zz]; }));
      const offs = rowsT.map((t) => cols.map((c) => { const s = lerp(FR.doorFore(c.z), FR.doorAft(c.z), t), [dz, dy] = c.off(s); return [0, dy, side * dz]; }));
      return slab(pts, (p, r, c) => offs[r][c]);
    };
    const TH = 0.02, PROUD = 0.003, TR = [0, 0.04, 0.12, 0.25, 0.4, 0.55, 0.7, 0.85, 0.94, 1];
    // a bend column: the point moved PROUD outward along the bisector of the two faces' normals, the door's thickness kept
    const bend = (z, nA, nB) => ({ z, at: (s) => { const [zz, yy] = FR.wellSkin(s, z), a = nA(s), b = nB(s), n = [a[0] + b[0], a[1] + b[1]], L = Math.hypot(...n); return [zz - (n[0] / L) * PROUD, yy - (n[1] / L) * PROUD]; },
      off: (s) => { const a = nA(s), b = nB(s), n = [a[0] + b[0], a[1] + b[1]], L = Math.hypot(...n), c = (n[0] * a[0] + n[1] * a[1]) / L; return [(n[0] / L) * TH / c, (n[1] / L) * TH / c]; } });
    const facetN = (s) => { const J = junc(s), C = crease(s), L = Math.hypot(J[0] - C[0], J[1] - C[1]); return [-(J[1] - C[1]) / L, (J[0] - C[0]) / L]; };
    const lowerN = (s) => { const C = crease(s), k = FR.bWb(s), D = FR.bD(s), L = Math.hypot(C[0] - k, C[1] + D); return [-(C[1] + D) / L, (C[0] - k) / L]; };
    // the facet's points by fraction of the way from the junction to the crease (which moves a few mm along the trunk)
    const onFacet = (z, endGap = 0) => ({ z, at: (s) => { const J = junc(s), C = crease(s), f = Math.min(1 - endGap / Math.hypot(J[0] - C[0], J[1] - C[1]), (W.zJunction - z) / (W.zJunction - C[0])), n = facetN(s); return [lerp(J[0], C[0], f) - n[0] * PROUD, lerp(J[1], C[1], f) - n[1] * PROUD]; }, off: (s) => facetN(s).map((v) => v * TH) });
    const onLower = (z, endGap = 0, toCrease = false) => ({ z, at: (s) => { const C = crease(s), k = FR.bWb(s), D = FR.bD(s), L = Math.hypot(C[0] - k, C[1] + D), f = toCrease ? 1 - endGap / L : Math.min(1 - endGap / L, (z - k) / (C[0] - k)), n = lowerN(s); return [lerp(k, C[0], f) - n[0] * PROUD, lerp(-D, C[1], f) - n[1] * PROUD]; }, off: (s) => lowerN(s).map((v) => v * TH) });
    {
      // the main door: hinge 5 mm inside the outline's outer edge, the wing part to the junction (a bend there), the
      // bulged facet to the crease; three small teeth by the hinge on its forward edge, a large and a small one aft
      const hz = W.hingeZ - 0.005, D = FR.MAIN_DOORS.splitZ;
      const wingCols = [hz, 2.40, 2.33, 2.23, 2.1475, 2.065, 2.02, 1.9825].map((z) => ({ z, at: (s) => [z, lo(s, z) - PROUD], off: () => [0, TH] }));
      const cols = [...wingCols, bend(W.zJunction, () => [0, 1], facetN), ...[1.94, 1.90, 1.84, 1.77, 1.70, 1.62].map((z) => onFacet(z)), onFacet(D, 0.0005)];
      const door = doorGrid(cols, TR);
      const sh0 = FR.doorFore(W.hingeZ), sh1 = FR.doorAft(W.hingeZ);
      const p0 = V(X(sh0), lo(sh0, hz) + TH / 2 - PROUD, side * hz), p1 = V(X(sh1), lo(sh1, hz) + TH / 2 - PROUD, side * hz);
      const test = V(X(11.8), -0.45, side * 1.75);
      const h = hinge(mesh(door, F.door()), p0, p1, test, V(0, -1, 0));
      P(`Main gear door (${R})`, {
        system: 'Skin & fairings', skin: true, material: 'Composite door with saw-tooth edges', mass: 34,
        explode: [0, -1.65, 1.6 * side],
        desc: 'The large outer door over the main wheel well: one panel bent along the wing junction, over the wing root\'s underside and the bulged trunk side down to the crease where the inboard door meets it, about 1.05 m from its hinge far outboard on the wing to that edge and 1.37 m fore and aft over its saw teeth (0.71 m along the hinge; NAWDC bottom view and photographs of the open door). Open, it hangs about 11° off vertical outboard of the wheel, its lower edge about 0.1 m below the tyre top. Its edges run at 42°, parallel to the wing\'s leading edge.',
      }, h.pivot);
      anim.gearDoorsMain = anim.gearDoorsMain || [];
      anim.gearDoorsMain.push({ h, angle: FR.MAIN_DOORS.open.main * FR.DEG });
      // rotary actuator at the aft end of the hinge line, inside the wing, bracketed to the 49 % spar
      const ax = p1.clone().sub(p0).normalize(), a0 = p1.clone().addScaledVector(ax, 0.012).add(V(0, 0.045, 0)), a1 = a0.clone().addScaledVector(ax, 0.13);
      const sp = FR.wingLE(hz) + 0.49 * (FR.wingTEline(hz) - FR.wingLE(hz));
      const ra = [rodV(a0, a1, 0.035, 14), new THREE.BoxGeometry(Math.abs(X(sp) - a1.x) + 0.02, 0.05, 0.06).translate((X(sp) + a1.x) / 2, a1.y, a1.z), rodV(p1.clone(), a0, 0.012, 6)];
      P(`Main gear door actuator (${R})`, {
        system: 'Landing gear', material: 'Hydraulic rotary actuator', mass: 6,
        explode: [-0.3, -0.8, 1.2 * side],
        desc: 'A hydraulic rotary actuator at the aft end of the main door\'s hinge line, inside the wing root and bracketed to the 49 % spar, swings the door open ahead of the leg and closes it behind it; the sequence valve keeps door and leg from colliding (arrangement estimated).',
      }, mesh(merge(ra), F.hyd()));
    }
    // inboard door on the belly, hinged on its inboard edge: over the belly to the trunk's lower corner and up the lower
    // trunk side to the crease; open, it hangs almost straight down inboard of the leg
    {
      const D = FR.MAIN_DOORS.splitZ, zk = FR.bWb(11.6);
      const belly = (z) => ({ z, at: (s) => [z, -FR.bD(s) - PROUD], off: () => [0, TH] });
      const cols = [belly(W.zIn + 0.003), belly(1.15), belly(1.195), bend(zk, () => [0, 1], lowerN), ...[1.30, 1.38, 1.46].map((z) => onLower(z)), onLower(D, 0.0005, true)];
      const door = doorGrid(cols, TR);
      const sh0 = FR.doorFore(W.zIn), sh1 = FR.doorAft(W.zIn);
      const h = hinge(mesh(door, F.door()), V(X(sh0), -FR.bD(sh0) + TH / 2 - PROUD, side * W.zIn), V(X(sh1), -FR.bD(sh1) + TH / 2 - PROUD, side * W.zIn), V(X(11.6), -0.9, side * 1.35), V(0, -1, 0));
      P(`Main gear inboard door (${R})`, {
        system: 'Skin & fairings', skin: true, material: 'Composite door, saw-tooth edges', mass: 12,
        explode: [0.2, -1.6, 0.7 * side],
        desc: 'The inner door of the main wheel well, hinged on the belly about 1.1 m out from the centre line: it covers the belly out to the trunk\'s lower corner and the lower trunk side up to the crease, where the leg leaves the fuselage (the inner panel of the NAWDC outline; T.O. panel 8210 / 8211). It opens with the main door and stays open, hanging almost straight down inboard of the leg, while the gear is down.',
      }, h.pivot);
      anim.gearDoorsMain.push({ h, angle: FR.MAIN_DOORS.open.inboard * FR.DEG });
    }
  }

  // ------------------------------------------------------------------ nose gear doors and their actuators
  {
    const NW = FR.NOSE_WELL, NF = FR.NOSE_FIT;
    const st = ctx.sA.filter((s) => s >= NW.s0 - 1e-6 && s <= NW.s1 + 1e-6);
    const pivots = [], hs = [];
    const hs0 = NW.s0 + NW.tip0, hs1 = NW.s1 - NW.tip1;
    for (const side of [1, -1]) {
      // each door runs from the centre line, where the pair meet, out to its hinge; pointed fore and aft
      const grid = st.map((s) => [0, 0.25, 0.5, 0.75, 1].map((uu) => { const zz = side * uu * FR.noseDoorHalf(s); return [X(s), FR.bottomAt(s, Math.abs(zz)) - 0.002, zz]; }));
      const door = slab(grid, () => [0, 0.025, 0]);
      const h = hinge(mesh(door, F.door()), V(X(hs0), FR.bottomAt(hs0, NW.z), side * NW.z), V(X(hs1), FR.bottomAt(hs1, NW.z), side * NW.z), V(X((NW.s0 + NW.s1) / 2), -0.95, side * 0.05), V(0, -1, 0));
      pivots.push(h.pivot);
      hs.push({ h, side });
    }
    anim.gearDoorsNose = hs.map(({ h }) => ({ h, angle: 1.55 }));
    P('Nose gear doors', {
      system: 'Skin & fairings', skin: true, material: 'Composite doors, pointed fore and aft', mass: 18,
      explode: [0.4, -1.4, 0],
      desc: 'Two 1.65 m doors hinged at their outer edges close the nose-gear well between the inlets; together they make the long hexagon, pointed at both ends, of the NAWDC bottom view. They open before the leg moves and close after it.',
    }, pivots);
    // door actuators: a small jack each, from a fitting under F-1A's stepped floor at the aft end of the well to a horn
    // on its door just inside the hinge
    const sJ = NF.doorJack.fit[0], jacks = [];
    for (const { h, side } of hs) {
      const Fp = V(X(sJ), NF.doorJack.fit[1], side * 0.17), horn = V(X(sJ), FR.bottomAt(sJ, NW.z - 0.04) + NF.doorJack.horn, side * (NW.z - 0.04));
      const j = jackMeshes(0.018, 0.01), barLen = Fp.distanceTo(horn) * 0.6;
      const fit = new THREE.BoxGeometry(0.06, NW.roofAft - Fp.y + 0.02, 0.05).translate(Fp.x, (NW.roofAft + Fp.y) / 2 - 0.005, Fp.z);
      const hornG = new THREE.BoxGeometry(0.03, NF.doorJack.horn + 0.02, 0.03).translate(horn.x, horn.y - NF.doorJack.horn / 2, horn.z);
      h.pivot.children[0].add(mesh(hornG, F.steel()));
      jacks.push({ h, j, Fp, horn, barLen, p0: h.pivot.position.clone(), fit });
    }
    P('Nose gear door actuators', {
      system: 'Landing gear', material: 'Hydraulic jacks, 4,000 psi', mass: 4,
      explode: [0.6, -0.95, 0.5],
      desc: 'A small hydraulic jack for each nose door, from a fitting under F-1A\'s stepped floor at the aft end of the well to a horn on the door just inside its hinge, opens the doors ahead of the leg and closes them behind it (arrangement estimated).',
    }, [...jacks.flatMap((k) => [k.j.bar, k.j.rod]), mesh(merge(jacks.map((k) => k.fit)), F.tiDull())]);
    const hp = new THREE.Vector3();
    anim.gearLinks.push(() => {
      for (const k of jacks) { hp.subVectors(k.horn, k.p0).applyQuaternion(k.h.pivot.quaternion).add(k.p0); placeJack(k.j, k.Fp, hp, k.barLen, 0.03); }
    });
  }

  anim.gearSet = (ku, kd) => {
    for (const f of legSet) f(ku);
    for (const d of anim.gearDoorsMain) d.h.set(d.angle * kd);
    for (const d of anim.gearDoorsNose) d.h.set(d.angle * kd);
    for (const f of anim.gearLinks) f(ku, kd);
  };

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
