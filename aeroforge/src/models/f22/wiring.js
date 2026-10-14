// F-22A signal and power wiring that ties the units together:
//   fly-by-wire   command harnesses from the triplex vehicle-management computers to the surface actuators
//                 and both FADECs (which also set the vectoring nozzles). The real routing is not published;
//                 the model simplifies it to three separated trunks: right side (right wing and tail), left
//                 side (left wing and tail) and spine (both tails and both FADECs)
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

const { X } = FR;
/** Station of chord fraction f of the wing at span z. */
const wingS = (z, f) => FR.wingLE(z) + f * (FR.wingTE(z) - FR.wingLE(z));

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
      // channel A (right) / B (left): from the VMS boxes down the fuselage side, under each inlet duct, then
      // round its lower outboard corner ahead of the main-gear well, aft over the well's roof (clear of the
      // stowed leg) and under the boom to the engine bay
      const trunk = [[4.3, -0.22, z * 0.3], [4.6, -0.16, z * 0.6], [5.6, -0.16, z * 0.74], [6.8, -0.3, z * 0.82], [7.3, -0.42, z * 0.915], [8.4, -0.42, z * 0.93],
        [10.4, -0.4, z * 0.93], [11.05, -0.405, z * 1.05], [11.15, -0.4, z * 1.16], [11.25, -0.37, z * 1.28], [11.38, -0.31, z * 1.42], [11.6, -0.2, z * 1.47], [12.55, -0.17, z * 1.47],
        [12.76, -0.24, z * 1.47], [13.0, -0.245, z * 1.42], [13.3, -0.24, z * 1.38], [14.0, -0.235, z * 1.38], [14.6, -0.3, z * 1.32]];
      g.push(tube(trunk));
      // to the stabilator actuator and up the boom to the rudder actuator
      g.push(tube([[14.9, -0.29, z * 1.33], [15.6, -0.27, z * 1.38], [16.0, -0.25, z * 1.39], [16.2, -0.24, z * 1.38]]));
      g.push(tube([[15.0, -0.28, z * 1.34], [15.4, 0.0, z * 1.35], [15.8, 0.3, z * 1.4], [15.95, 0.42, z * 1.46]]));
      // leading-edge flap power drive unit, round the front of the side bay and outboard of the duct
      g.push(tube([[8.4, -0.42, z * 0.93], [8.4, -0.6, z * 1.3], [8.42, -0.45, z * 1.66], [8.4, -0.2, z * 1.71], [8.36, -0.05, z * 1.73]]));   // ends in the LEF power drive unit
      // along the rear spar to the flaperon and aileron actuators (one per surface), riding above the flaperon
      // actuator where it crosses it, ending on the aileron actuator; a stub drops into the flaperon actuator
      const fl = FR.teActuator('flaperon'), ai = FR.teActuator('aileron');
      const lift = (zz) => { const sec = FR.wingSection(zz); return Math.min(0.055, naca00((13.38 - FR.wingLE(zz)) / sec.chord, sec.t) * sec.chord * 0.9 - 0.02); };
      const rear = [[13.3, -0.24, z * 1.38], [13.32, -0.25, z * 1.6], [13.32, -0.12, z * 1.8], [13.38, -0.07, z * 1.95]];
      for (const zz of [2.1, 2.5, fl.z, 3.3, 3.6, 4.4]) rear.push([13.38, FR.wingY(zz) + lift(zz), z * zz]);
      rear.push([13.38, ai.y, z * ai.z]);
      g.push(tube(rear));
      g.push(tube([[13.38, fl.y + lift(fl.z), z * fl.z], [13.44, fl.y + 0.03, z * fl.z], [fl.s1 - 0.13, fl.y + 0.01, z * fl.z]]));
      // channel C (spine): over the tanks under the upper skin, branching aft to both tails and FADECs
      const up = (sv, zz) => [sv, FR.topAt(sv, zz) - 0.045, z * zz];
      g.push(tube([up(14.0, 0.3), up(14.4, 0.9), up(15.0, 1.3), up(15.6, 1.36), [15.9, 0.4, z * 1.44]]));
      g.push(tube([up(15.0, 1.3), [15.2, 0.1, z * 1.36], [15.9, -0.1, z * 1.38], [16.25, -0.22, z * 1.37]]));
      g.push(tube([up(14.4, 0.9), [14.75, 0.2, z * 1.36], [14.8, -0.2, z * 1.34], [14.78, -0.3, z * 1.3]]));
    }
    const spine = [[4.7, -0.22, -0.36], [4.9, -0.12, -0.3], [6.9, -0.12, -0.3], [6.95, 0.3, -0.3], [7.1, FR.topAt(7.1, 0.3) - 0.04, -0.3]];
    for (const s of [7.6, 8.4, 9.5, 11.0, 12.4, 13.2]) spine.push([s, FR.topAt(s, 0.3) - 0.035, -0.3]);
    spine.push([13.6, FR.topAt(13.6, 0.12) - 0.045, -0.12], [14.0, FR.topAt(14.0, 0) - 0.045, 0.0]);
    g.push(tube(spine));
    for (const z of [0.3, -0.3]) g.push(tube([[14.0, FR.topAt(14.0, 0) - 0.045, 0.0], [14.0, FR.topAt(14.0, 0.3) - 0.045, z]]));
    P('Fly-by-wire harnesses (triplex)', {
      system: 'Flight controls', material: 'Shielded twisted-pair signal harnesses, three physically separated routes', mass: 26, xrayWeight: 0.7,
      explode: [0.0, -0.3, 0],
      desc: 'The "wire" in fly-by-wire: command lines from the vehicle-management system to every leading-edge-flap drive, flaperon, aileron, stabilator and rudder actuator and to both FADECs, which also set the vectoring nozzles. The VMS runs on triplex digital flight-control computers with no electrical or mechanical back-up (Flight International, 1997), so each actuator is commanded over redundant channels. The real harness routing is not published; the model simplifies it to three separated trunks: down the right side to the right wing and tail, down the left side to the left, and along the spine to both tails and FADECs.',
    }, mesh(merge(g), F.fbw()));
  }

  // ------------------------------------------------------------------ avionics data buses
  {
    const g = [];
    for (const side of [1, -1]) {
      const z = side;
      g.push(tube([[3.3, 0.28, z * 0.2], [3.0, 0.3, z * 0.1], [2.75, 0.24, 0.0]], 0.007));                       // CIP → radar receiver / exciter
      g.push(tube([[3.05, 0.0, z * 0.2], [2.85, -0.1, z * 0.1], [2.75, -0.2, 0.0]], 0.007));
      g.push(tube([[3.2, 0.2, z * 0.2], [3.05, 0.12, z * 0.05], [2.98, 0.1, 0.0]], 0.006));                       // INS
      g.push(tube([[3.3, -0.02, z * 0.2], [3.25, -0.08, z * 0.18], [3.22, -0.09, z * 0.16]], 0.006));              // CNI
      g.push(tube([[3.55, 0.12, z * 0.2], [3.75, 0.12, z * 0.24], [3.78, 0.12, z * 0.25]], 0.006));                // ALR-94 receivers
      g.push(tube([[3.55, 0.05, z * 0.2], [4.0, -0.15, z * 0.34], [4.15, -0.22, z * 0.36]], 0.006));               // VMS
    }
    g.push(tube([[3.55, 0.2, 0.2], [4.2, 0.18, 0.1], [4.45, 0.2, 0.0], [4.7, 0.3, 0.0]], 0.007));                  // cockpit displays
    g.push(tube([[3.55, 0.0, 0.2], [4.3, -0.1, 0.42], [4.7, -0.2, 0.42]], 0.007));                                  // IFDL processor
    // aft along the spine (right of the fly-by-wire channel C) to the CNI / IFDL apertures and aft EW antennas
    const aft = [[4.7, -0.2, 0.42], [6.9, -0.12, 0.3], [6.95, 0.3, 0.3], [7.1, FR.topAt(7.1, 0.3) - 0.04, 0.3]];
    for (const s of [7.6, 8.4, 9.5, 10.8, 12.4, 13.6, 15.0, 16.0]) aft.push([s, FR.topAt(s, 0.3) - 0.035, 0.3]);
    g.push(tube(aft, 0.007));
    for (const side of [1, -1]) {
      g.push(tube([[10.8, FR.topAt(10.8, 0.3) - 0.035, 0.3], [11.0, FR.topAt(11.0, 0.8) - 0.035, side * 0.8], [11.0, FR.topAt(11.0, 1.2) - 0.03, side * 1.2]], 0.006));
      g.push(tube([[15.0, FR.topAt(15.0, 0.3) - 0.035, 0.3], [15.5, FR.topAt(15.5, 0.8) - 0.035, side * 0.8], [15.6, FR.topAt(15.6, 1.12) - 0.03, side * 1.12]], 0.006));
      g.push(tube([[16.0, FR.topAt(16.0, 0.3) - 0.035, 0.3], [16.3, FR.topAt(16.3, 0.9) - 0.035, side * 0.9], [16.25, FR.topAt(16.25, 1.38) - 0.03, side * 1.38]], 0.006));
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
      const front = [[8.4, -0.44, z * 0.95], [8.4, -0.62, z * 1.3], [8.43, -0.47, z * 1.65], [8.4, -0.2, z * 1.76], [8.37, -0.04, z * 1.86], [8.4, -0.03, z * 1.96]];
      for (const zz of [2.4, 3.2, 4.0, 4.8, 5.6, 6.3]) front.push([wingS(zz, 0.12), FR.wingY(zz), z * zz]);
      const tipLe = FR.wingLE(FR.WING.semi), tipC = FR.wingTE(FR.WING.semi) - tipLe;
      front.push([tipLe + 0.12 * tipC, FR.wingY(6.62), z * 6.62], [tipLe + 0.15 * tipC, FR.wingY(6.74), z * 6.74]);
      g.push(tube(front, 0.008));
      // stubs forward to the ALR-94 leading-edge apertures
      for (const eta of [0.2, 0.45, 0.7, 0.92]) {
        const zz = 1.45 + eta * (FR.WING.semi - 1.45);
        g.push(tube([[wingS(zz, 0.12), FR.wingY(zz), z * zz], [wingS(zz, 0.04), FR.wingY(zz), z * zz]], 0.006));
      }
      // up the fin's front spar to the formation strip
      const fin = [[15.0, -0.1, z * 1.36], [14.2, 0.2, z * 1.4], finPoint(side, 0.05, 0.14)];
      for (const e of [0.25, 0.45, 0.68]) fin.push(finPoint(side, e, 0.14));
      fin.push(finPoint(side, 0.68, 0.4));
      g.push(tube(fin, 0.008));
    }
    // strobes on the belly and the spine, and the tail light on the left boom fairing
    g.push(tube([[13.8, -0.6, 0.1], [13.5, -0.72, 0.05], [12.85, -0.86, 0.0]], 0.008));
    g.push(tube([[13.8, -0.6, -0.1], [14.4, -0.1, -0.03], [15.6, 0.3, -0.03], [16.8, FR.topAt(16.8, 0) - 0.04, 0.0]], 0.008));
    g.push(tube([[16.6, -0.1, -1.38], [17.4, -0.02, -1.45], [18.2, -0.06, -1.5], [18.55, -0.08, -1.52]], 0.008));
    P('Wing & tail wiring runs', {
      system: 'Electrical', material: 'Shielded 28 V DC power and signal wiring in conduits', mass: 14, xrayWeight: 0.7,
      explode: [0, 0.45, 0],
      desc: 'Power and signal wiring from the fuselage harnesses out along each wing\'s front spar to the tip position and formation lights and the electronic-warfare apertures, up each fin to its formation strip, and aft to the strobes and the tail light (routing approximate).',
    }, mesh(merge(g), F.harness()));
  }
}
