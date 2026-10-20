// F-22A signal and power wiring that ties the units together:
//   fly-by-wire   command harnesses from the triplex vehicle-management computers to the surface actuators
//                 and both FADECs (which also set the vectoring nozzles). The real routing is not published;
//                 the model simplifies it to three separated trunks: right side (right wing and tail), left
//                 side (left wing and tail, each with its FADEC) and spine (both tails)
//   data buses    fibre-optic high-speed buses from the two CIPs to the radar, EW, CNI, INS, VMS,
//                 cockpit displays and the aft apertures
//   power         wiring out to the wing-tip and fin lights, wing apertures, strobes and tail light
// Routes are approximate: they follow the free paths between the modelled units.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { F } from './materials.js';
import * as FR from './frame.js';
import { naca00 } from '../../engine/geometry.js';
import { merge } from './util.js';

const { X, M, WM } = FR;
/** Station of the leading-edge-flap power drive unit at the wing root (airframe.js puts it at z = SURF.lef[0] − 0.06, 10 % chord). */
const lefPdu = () => FR.lefPduAt();
/** Route points clamped 3 cm inside the fuselage skin (the re-laid-out outer mould line). */
const inside = (pts, m = 0.03) => pts.map((p) => FR.inBody(p, m));
/** Out of the trunk into the wing root: up under the chine flange, where the wing joins it behind its leading edge. */
const toWingRoot = (z, ds = 0.06) => [[8.3 + ds, -0.15, z * (FR.wallZ(8.3 + ds, -0.15) - 0.04)], [8.62 + ds, -0.05, z * 2.06], [8.78 + ds, -0.035, z * 2.17]];
/** Point on the fin's mid-plane at height y (the fin is canted outboard from its root line). */
const finMid = (y) => FR.FIN.rootZ + (y - FR.FIN.rootY) * Math.tan(FR.FIN.cant);
/** Station of chord fraction f of the wing at span z. */
const wingS = (z, f) => FR.wingLE(z) + f * (FR.wingTEline(z) - FR.wingLE(z));

/** Point on a fin in station space: fin-local chord fraction f at span fraction e, offset d off the mid-plane. */
function finPoint(side, e, f, d = 0) {
  const T = FR.FIN;
  const c = T.rootC + (T.tipC - T.rootC) * e;
  const p = new THREE.Vector3(-T.span * e * Math.tan(T.sweep) - f * c, d, T.span * e);
  p.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2 + T.cant * side).setPosition(X(T.rootS), T.rootY, side * T.rootZ));
  return [FR.SN - p.x, p.y, p.z];
}

export function buildWiring(ctx) {
  const { P } = ctx;
  const tube = (pts, r = 0.009, seg = 5) => FR.pipe(pts, r, seg, Math.max(8, pts.length * 5));      // thin hidden runs: 5 segments per control point

  // ------------------------------------------------------------------ fly-by-wire (three channels)
  {
    const g = [];
    for (const side of [1, -1]) {
      const z = side;
      // channel A (right) / B (left): from the VMS box in the forward avionics bay aft under the boxes below the
      // cockpit floor, through the corridor beside the nose well and under F-1A (FR.ROUTE.nose), outboard ahead of
      // the main bay's front wall to the bay sill under the inlet duct, round the duct's lower outboard corner
      // ahead of the main-gear well, aft over the well's roof and under the boom to the engine bay
      const RT = FR.ROUTE, fb = RT.sill.fbw, NR = RT.nose, VM = FR.AV_BAY.vms, vs = VM.at[0][0] + VM.ls / 2, vy = FR.AV_BAY.shelfLo + 0.01 + VM.h / 2;
      const trunk = [[vs - 0.02, vy, z * VM.z], [vs + 0.04, vy - 0.03, z * 0.43], [3.0, -0.33, z * 0.47], [3.3, -0.37, z * 0.5], [3.8, NR.under - 0.01, z * 0.47], [NR.descend[0], NR.under - 0.01, z * 0.46], [NR.descend[1], NR.fbw[1], z * 0.46],
        [NR.rise, NR.fbw[1], z * NR.fbw[0]], [NR.slot - 0.05, NR.fbw[1], z * NR.fbw[0]], [NR.slot, NR.fbw[1] + NR.slotDrop, z * 0.75], [NR.slot + 0.02, NR.fbw[1] + 0.01 + NR.slotDrop, z * 0.98], [7.1, fb[1], z * fb[0]], [9.0, fb[1], z * fb[0]],
        [FR.MAIN_BAY.s1, fb[1], z * fb[0]], [FR.AMMO.s1 + 0.04, -0.62, z * 1.04], [12.0, -0.66, z * 1.04], [12.35, -0.7, z * 1.06], [12.6, -0.7, z * 1.12], [13.0, -0.68, z * 1.12], [13.4, -0.58, z * 1.12], [14.2, -0.48, z * 1.22], [14.95, -0.37, z * 1.3]];   // (inside the main-well reserve's inboard edge, under the engine feed line)
      g.push(tube(trunk));
      // to the FADEC on the engine case
      g.push(tube([[12.92, -0.685, z * 1.12], [12.92, -0.6, z * 1.15], [12.92, -0.535, z * 1.17]]));
      // to the stabilator actuator and up the boom to the rudder actuator
      const stabAct = [FR.STAB.pivotS - 0.9, -0.21, z * 1.62];
      g.push(tube([...inside([[14.95, -0.37, z * 1.3], [15.2, -0.3, z * 1.38]]), [15.4, -0.25, z * 1.5], stabAct]));
      // up into the fin root (which sits below the deck) to the rudder actuator at 64 % of the root chord
      const T = FR.FIN, rudAct = [T.rootS + 0.64 * T.rootC, T.rootY + 0.3 * Math.cos(T.cant), z * (T.rootZ + 0.3 * Math.sin(T.cant))];   // the actuator's lower end (as systems.js)
      // (8 cm ahead of the hydraulic lines that take the same way up into the fin)
      g.push(tube([...inside([[15.2, -0.3, z * 1.38], [15.22, 0.0, z * 1.37]]), [15.27, 0.2, z * finMid(0.2)], rudAct]));
      // leading-edge flap power drive unit, round the front of the side bay and outboard of the duct
      { const [ps, py, pz] = lefPdu(); g.push(tube([...inside([[7.05, fb[1], z * fb[0]], [6.97, -0.52, z * 1.25], [6.968, -0.44, z * 1.6], [7.45, -0.26, z * (FR.wallZ(7.45, -0.26) - 0.04)]]), ...toWingRoot(z), [ps - 0.5, py + 0.03, z * (pz - 0.04)], [ps + 0.02, py + 0.01, z * (pz - 0.03)]])); }   // ends in the LEF power drive unit
      // along the rear spar to the flaperon and aileron actuators (one per surface), riding above the flaperon
      // actuator where it crosses it, ending on the aileron actuator; a stub drops into the flaperon actuator
      const fl = FR.teActuator('flaperon'), ai = FR.teActuator('aileron');
      const lift = (zz) => { const sec = FR.wingSection(zz); return Math.min(0.055, naca00((FR.ROUTE.rearSpar + 0.04 - FR.wingLE(zz)) / sec.chord, sec.t) * sec.chord * 0.9 - 0.02); };
      const sR = RT.rearSpar + 0.04;
      const rear = inside([[14.2, -0.48, z * 1.22], [sR, -0.46, z * 1.5], [sR, -0.3, z * (FR.wallZ(sR, -0.3) - 0.03)], [sR, -0.18, z * (FR.wallZ(sR, -0.18) - 0.03)]]);
      // (outboard of the flaperon it steps forward of the aileron's nose, which sits further forward on the
      // forward-swept trailing edge, and ends in the aileron actuator)
      for (const zz of [2.3, 2.6, fl.z, 3.8, 4.1]) rear.push([sR, FR.wingY(zz) + lift(zz), z * zz]);
      rear.push([ai.sHinge + 0.08, FR.wingY(4.6) + lift(4.6), z * 4.6], [ai.s1 - 0.02, ai.y, z * ai.z]);
      g.push(tube(rear));
      g.push(tube([[sR, fl.y + lift(fl.z), z * fl.z], [sR + 0.06, fl.y + 0.03, z * fl.z], [fl.s1 - 0.13, fl.y + 0.01, z * fl.z]]));
      // channel C (spine): over the tanks under the upper skin, branching aft to both tails' actuators
      // (over the A-1 feed cells, which fill up to 3.5 cm under the skin, the runs ride in the gap above them)
      const overA1 = (sv) => sv > FR.FUEL.a1[0] - 0.05 && sv < FR.FUEL.a1[1] + 0.03;
      const up = (sv, zz) => [sv, FR.topAt(sv, zz) - (overA1(sv) && zz > 0.75 ? 0.017 : 0.045), z * zz];
      g.push(tube([[M(14.0), FR.topAt(M(14.0), 0.3) - 0.09, z * 0.3], up(M(14.4), 0.9), up(M(15.0), 1.3), up(M(15.6), 1.36), [14.6, 0.19, z * finMid(0.19)], [15.15, 0.24, z * finMid(0.24)], finPoint(side, 0.12, 0.6)]));
      g.push(tube([up(12.9, 1.13), up(13.6, 1.1), up(14.5, 1.12), up(14.97, 1.15), ...inside([[15.03, 0.1, z * 1.3], [15.2, -0.1, z * 1.4]]), [15.38, -0.2, z * 1.5], [FR.STAB.pivotS - 0.95, -0.2, z * 1.6]]));
    }
    // channel C: from the left aft VMS box under the cockpit floor (outboard of the nose well), up behind the aft
    // cockpit bulkhead ahead of F-1A and aft along the spine
    const VA = FR.AV_BAY.vms, va = VA.at[2][0] + VA.ls / 2, vay = FR.AV_BAY.shelfLo + 0.01 + VA.h / 2, sC = FR.ROUTE.nose.rise + 0.05;
    const spine = [[va - 0.02, vay, -VA.z], [va + 0.04, -0.1, -0.37], [3.2, -0.075, -0.36], [5.3, -0.075, -0.36], [sC - 0.03, -0.07, -0.32], [sC, 0.0, -0.32], [sC, FR.topAt(sC, 0.32) - 0.06, -0.32], [M(7.1) + 0.03, FR.topAt(M(7.1) + 0.03, 0.3) - 0.04, -0.3]];
    for (let s = M(7.1) + 0.15; s <= M(13.2) + 1e-9; s += 0.15) spine.push([s, FR.topAt(s, 0.3) - 0.035, -0.3]);      // under the skin, which falls away fast behind the canopy
    // inboard to the centre line under the vent gallery, the stored-energy lines, the inert-gas line and the
    // refuelling manifold, which run 3.5 cm under the skin, then out to both tails' branches
    const dC = 0.09;
    spine.push([M(13.6), FR.topAt(M(13.6), 0.15) - dC, -0.15], [M(14.0), FR.topAt(M(14.0), 0) - dC, 0.0]);
    g.push(tube(spine));
    for (const z of [0.3, -0.3]) g.push(tube([[M(14.0), FR.topAt(M(14.0), 0) - dC, 0.0], [M(14.0), FR.topAt(M(14.0), 0.3) - dC, z]]));
    P('Fly-by-wire harnesses (triplex)', {
      system: 'Flight controls', material: 'Shielded twisted-pair signal harnesses, three physically separated routes', mass: 26, xrayWeight: 0.7,
      explode: [0.0, -0.3, 0],
      desc: 'The "wire" in fly-by-wire: command lines from the vehicle-management system to every leading-edge-flap drive, flaperon, aileron, stabilator and rudder actuator and to both FADECs, which also set the vectoring nozzles. The VMS runs on triplex digital flight-control computers with no electrical or mechanical back-up (Flight International, 1997), so each actuator is commanded over redundant channels. The real harness routing is not published; the model simplifies it to three separated trunks: down the right side to the right wing, tail and FADEC, down the left side to the left, and along the spine to both tails.',
    }, mesh(merge(g), F.fbw()));
  }

  // ------------------------------------------------------------------ avionics data buses
  {
    const g = [];
    // short jumpers between neighbouring boxes in the forward avionics bay (FR.AV_BAY); runs to the lower shelf go
    // round the shelves' aft edge
    const AV = FR.AV_BAY, cF = AV.cip.s - AV.cip.ls / 2, cA = AV.cip.s + AV.cip.ls / 2, rA = AV.rex.s + AV.rex.ls / 2, eA = AV.s1 + 0.007;
    for (const side of [1, -1]) {
      const z = side;
      g.push(tube([[cF + 0.01, 0.2, z * 0.15], [(cF + rA) / 2, 0.2, z * 0.12], [rA - 0.01, 0.19, z * 0.1]], 0.007));       // CIP → radar receiver / exciter
      g.push(tube([[cF + 0.01, 0.1, z * 0.26], [(cF + rA) / 2, 0.1, z * 0.27], [rA - 0.01, 0.1, z * 0.27]], 0.006));        // ALR-94 receivers
      g.push(tube([[2.6, 0.08, z * 0.1], [2.59, 0.08, z * 0.085], [AV.ins.s + AV.ins.ls / 2 - 0.005, 0.08, z * 0.06]], 0.006));    // INS
      g.push(tube([[cA - 0.01, 0.0, z * 0.2], [cA + 0.015, -0.01, z * 0.2], [eA, -0.07, z * 0.22], [cA + 0.015, -0.14, z * 0.2], [cA - 0.01, -0.15, z * AV.cni.z]], 0.006));   // CNI
      // VMS: the right box's aft face, the left aft box's top
      if (side > 0) g.push(tube([[eA, -0.07, 0.25], [eA - 0.002, -0.2, 0.33], [AV.vms.at[0][0] + AV.vms.ls / 2 - 0.01, -0.22, AV.vms.z]], 0.006));
      else g.push(tube([[eA, -0.07, -0.25], [cA + 0.015, -0.11, -0.33], [cA - 0.005, -0.125, -AV.vms.z]], 0.006));
    }
    g.push(tube([[cA - 0.01, 0.2, 0.2], [cA + 0.015, 0.2, 0.1], [3.0, 0.2, 0.0], [3.24, 0.3, 0.0], [3.36, 0.32, 0.0]], 0.007));     // cockpit displays (through the forward pressure bulkhead to the back of the panel)
    // IFDL processor under the cockpit floor, then aft under the floor (outboard of the nose well), up behind the aft
    // cockpit bulkhead ahead of F-1A and along the spine (right of the fly-by-wire channel C) to the CNI / IFDL
    // apertures and aft EW antennas
    const sD = FR.ROUTE.nose.rise + 0.05;
    g.push(tube([[cA - 0.01, 0.0, 0.2], [eA, -0.07, 0.24], [3.1, -0.08, 0.36], [3.3, -0.125, 0.42]], 0.007));
    const aft = [[3.6, -0.125, 0.42], [3.7, -0.075, 0.36], [5.3, -0.075, 0.36], [sD - 0.03, -0.07, 0.33], [sD, 0.0, 0.33], [sD, FR.topAt(sD, 0.33) - 0.06, 0.33], [M(7.1) + 0.03, FR.topAt(M(7.1) + 0.03, 0.3) - 0.04, 0.3]];
    // (dipping under the refuelling manifold's branch into the right A-1 cell)
    const dipB = (sv) => 0.055 * FR.smooth(FR.FUEL.a1[0] - 0.3, FR.FUEL.a1[0] - 0.18, sv) * (1 - FR.smooth(FR.FUEL.a1[0] + 0.02, FR.FUEL.a1[0] + 0.14, sv));
    for (let s = M(7.1) + 0.15; s < M(16.0) - 0.05; s += 0.15) aft.push(FR.inBody([s, FR.topAt(s, 0.3) - 0.035 - dipB(s), 0.3], 0.04));
    aft.push([M(16.0), FR.topAt(M(16.0), 0.3) - 0.035, 0.3]);
    g.push(tube(aft, 0.007));
    // branches out to the apertures: under the skin, ahead of the inlet-bypass plenum for the forward IFDL aperture
    // and in the gap above the A-1 feed cells (3.5 cm under the skin) for the aft ones
    const tp = (sv, zz, d) => [sv, FR.topAt(sv, zz) - d, zz];
    const B = FR.BYPASS;
    for (const side of [1, -1]) {
      const z = side, ap = M(11.0);
      g.push(tube([tp(B.s0 - 0.2, 0.3, 0.035), [B.s0 - 0.12, FR.topAt(B.s0 - 0.12, 0.8) - 0.035, z * 0.8], [B.s0 - 0.07, FR.topAt(B.s0 - 0.07, B.z1 + 0.1) - 0.03, z * (B.z1 + 0.1)], [ap - 0.03, FR.topAt(ap - 0.03, 1.22) - 0.025, z * 1.22]], 0.006));
      // (the left ones cross the centre line just under the skin, over the dump line, the upper longerons and,
      // aft of the stored-energy bottles and their compressor, over the keel)
      const g1 = [tp(M(15.0), 0.3, 0.035)], g2 = [tp(M(16.0), 0.3, 0.035)];
      if (side < 0) { g1.push([M(15.0) + 0.08, FR.topAt(M(15.0) + 0.08, 0) - 0.017, 0]); g2.push([14.6, FR.topAt(14.6, 0.3) - 0.035, 0.3], [14.66, FR.topAt(14.66, 0) - 0.017, 0]); }
      g.push(tube([...g1, [M(15.5), FR.topAt(M(15.5), 0.8) - 0.017, z * 0.8], [M(15.6), FR.topAt(M(15.6), 1.12) - 0.017, z * 1.12]], 0.006));
      g.push(tube([...g2, [side > 0 ? M(16.3) : 14.5, FR.topAt(side > 0 ? M(16.3) : 14.5, 0.9) - 0.017, z * 0.9], [M(16.25), FR.topAt(M(16.25), 1.38) - 0.017, z * 1.38]], 0.006));
    }
    P('Avionics data buses', {
      system: 'Avionics', material: 'Fibre-optic high-speed data buses and IEEE 1394B copper buses', mass: 9, xrayWeight: 0.7,
      explode: [1.0, 0.6, 0.3],
      desc: 'Sensor fusion means every sensor\'s data runs through the two CIPs: high-speed buses link them to the radar, EW receivers, CNI, inertial navigator, flight-control computers and cockpit displays, and aft to the data-link apertures. The IEEE 1394B bus was developed for the F-22 from commercial FireWire (routing approximate).',
    }, mesh(merge(g), F.fibre()));
  }

  // ------------------------------------------------------------------ power wiring to the extremities
  {
    const g = [];
    for (const side of [1, -1]) {
      const z = side;
      // out to the wing: round the front of the side bay, then along the front spar to the tip light
      const hz = FR.ROUTE.sill.harness;
      const front = [...inside([[7.1, hz[1], z * hz[0]], [6.99, -0.57, z * 1.24], [6.99, -0.48, z * 1.58], [7.5, -0.29, z * (FR.wallZ(7.5, -0.29) - 0.04)]]), ...toWingRoot(z, 0.12)];
      for (const zz of [2.4, 3.2, 4.0, 4.8, 5.6, 6.3]) front.push([wingS(zz, 0.12), FR.wingY(zz), z * zz]);
      const tipLe = FR.wingLE(FR.WING.semi), tipC = FR.wingTE(FR.WING.semi) - tipLe;
      front.push([tipLe + 0.12 * tipC, FR.wingY(6.62), z * 6.62], [tipLe + 0.15 * tipC, FR.wingY(6.74), z * 6.74]);
      g.push(tube(front, 0.008));
      // stubs forward to the ALR-94 leading-edge apertures
      for (const eta of [0.2, 0.45, 0.72, 0.92]) {
        const zz = 1.45 + eta * (FR.WING.semi - 1.45);
        // (to the flap's hinge line, where the aperture's own lead takes over through a flexible loop; over the flap
        // drive's torque tube, which runs along the hinge line)
        const sec = FR.wingSection(zz);
        g.push(tube([[wingS(zz, 0.12), FR.wingY(zz), z * zz], [wingS(zz, 0.1), sec.le[1] + 0.022, z * zz], [wingS(zz, 0.077), sec.le[1] + 0.022, z * zz]], 0.006));
      }
      // up the fin's front spar to the formation strip
      // (from the spine bundle where fly-by-wire channel C branches to the tails, alongside that branch in the gap
      // between the A-1 cell's top and the skin, into the fin root)
      const gap = (sv, zz, d) => [sv, FR.topAt(sv, zz) - d, z * zz];
      const fin = [gap(M(14.0) + 0.03, 0.3, 0.09), gap(12.42, 0.6, 0.06), gap(12.65, 0.88, 0.017), gap(13.25, 1.25, 0.017), [13.3, 0.16, z * finMid(0.16)], finPoint(side, 0.05, 0.14)];
      for (const e of [0.25, 0.45, 0.68]) fin.push(finPoint(side, e, 0.14));
      fin.push(finPoint(side, 0.68, 0.4));
      g.push(tube(fin, 0.008));
    }
    // strobes on the belly and the spine, and the tail light on the left boom fairing
    // (the belly strobe's lead passes beside the brake accumulator, which sits on the centre line just ahead of it)
    const sL = M(12.8), bA = FR.ROUTE.brakeAcc;
    g.push(tube([[M(13.8), -0.6, 0.1], [M(13.5), -0.72, 0.09], [bA[0] + 0.2, bA[1] + 0.02, 0.09], [sL + 0.03, -FR.bD(sL) + 0.03, 0.05], [sL, -FR.bD(sL) + 0.01, 0.0]], 0.008));
    g.push(tube([[M(13.8), -0.6, -0.1], [M(14.4), -0.1, -0.03], [14.3, 0.3, -0.03], [14.6, FR.topAt(14.6, 0) - 0.04, 0.0]], 0.008));
    // tail light: off the left fin run, aft over the A-1 cell under the skin, then down into the left titanium boom
    // (which houses the stabilator actuator) and aft inside it to the light on its fairing
    g.push(tube([[13.25, FR.topAt(13.25, 1.25) - 0.017, -1.25], [14.5, FR.topAt(14.5, 1.3) - 0.017, -1.3], [14.97, FR.topAt(14.97, 1.36) - 0.017, -1.36], [15.06, 0.02, -1.5], [16.3, -0.04, -1.5], [17.0, -0.03, -1.5], [17.45, -0.04, -1.52]], 0.008));
    P('Wing & tail wiring runs', {
      system: 'Electrical', material: 'Shielded 28 V DC power and signal wiring in conduits', mass: 14, xrayWeight: 0.7,
      explode: [0, 0.45, 0],
      desc: 'Power and signal wiring from the fuselage harnesses out along each wing\'s front spar to the tip position and formation lights and the electronic-warfare apertures, up each fin to its formation strip, and aft to the strobes and the tail light (routing approximate).',
    }, mesh(merge(g), F.harness()));
  }
}
