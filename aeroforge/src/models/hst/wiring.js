// The wiring that ties Hubble's systems together, so a student can trace each one end to end in the
// Systems view: the equipment section's ring harness and its bay drops, the main power buses from
// the distribution units, the SI C&DH bus to the instruments and the science-data path out to the
// transmitters, the OTA harness, the mechanism-control harness, the Cross Aft Shroud Harness, the
// gyro harness and the pointing-sensor harness.
//
// Topology from the SM3A Media Reference Guide §5.1.3–5.1.5, §5.2.4 and §5.5 and the SM4 Media
// Guide; the runs themselves are simplified (real harnesses follow cable trays and clamp to the
// structure all the way). Model azimuth from +V3 (+y) toward −V2 (+z), in degrees here.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { mergeGeometries } from '../../engine/geometry.js';
import { az, deg, ix, arcPts, cablePath, pathLength } from './layout.js';
import { BAY_PHI, CONN, X_EQ0, X_EQ1 } from './ssm.js';
import { HM } from './materials.js';

const merge = (list) => mergeGeometries(list.map(ix));
const A = (a, r, x) => az(deg(a), r, x);
const BAY = (k) => (BAY_PHI[k] * 180) / Math.PI;

export function buildWiring(P, { oes }) {
  const out = { length: {} };
  const run = (key, list, pts, r) => { list.push(...cablePath(pts, r, 6)); out.length[key] = (out.length[key] || 0) + pathLength(pts); };

  // ------------------------------------------------------------------ equipment-section ring harness
  // two rings, at the aft bulkhead face and at the forward frame panel, pass through all twelve bay
  // walls; in each bay a run along one side wall joins them and drops to every box's connectors
  const XR0 = X_EQ0 + 0.05, XR1 = X_EQ1 - 0.04, RR = 1.7;
  const ring = [];
  for (const x of [XR0, XR1]) run('ring', ring, arcPts(RR, x, 0, 360, 8), 0.022);
  for (let k = 1; k <= 10; k++) {
    const side = k === 2 || k === 3 || k === 10 ? -1 : 1;
    const wa = BAY(k) + side * (k === 2 || k === 3 ? 13.5 : 13);
    const wr = k === 2 || k === 3 ? 1.97 : RR;
    run('ring', ring, [A(wa, RR, XR0), A(wa, wr, XR0 + 0.06), A(wa, wr, XR1 - 0.06), A(wa, RR, XR1)], 0.018);
    for (const p of CONN[k] || []) {
      const rp = Math.hypot(p[1], p[2]);
      run('ring', ring, [A(wa, wr, p[0]), A(wa, rp, p[0]), p], 0.009);
    }
  }
  P('Equipment-section ring harness', {
    system: 'Electrical', material: 'Shielded wire bundles laced to the bay walls, two rings through all twelve walls', mass: 60, temp: 290, explode: [0, 0, 0], xrayWeight: 0.4,
    desc: 'About 90 % of the spacecraft\'s electronics sit in these ten bays, and they all talk over one bus: the data management unit in bay 1 reaches every box through the DIUs in bays 3, 7 and 10 and in the OTA section. Two rings join the bays, a run down one side wall of each feeds its boxes; in 1999 spacewalkers tucked loose connectors behind the harness along bay 5\'s side wall. Routing simplified.',
  }, mesh(merge(ring), HM.harness()));

  // ------------------------------------------------------------------ main power buses
  // the four PDUs on the bay 4 door feed the rings; one trunk goes aft through the bulkhead to a
  // distribution ring behind the instruments, one forward into the OTA equipment section
  const pb = [];
  const XA = 0.26, RA = 1.62;                                     // aft distribution ring
  run('power', pb, [A(220, 1.9, 4.05), A(212, 1.9, 4.05), A(212, RR, XR0 + 0.02), A(214, 1.62, X_EQ0 - 0.05), A(222, 1.62, 3.4), A(222, 1.62, XA + 0.1), A(222, RA, XA)], 0.018);
  run('power', pb, [A(212, 1.9, 4.05), A(212, RR, XR1 - 0.02)], 0.016);
  run('power', pb, arcPts(RA, XA, 0, 360, 10), 0.016);
  const SI_PANELS = [50.6, 129.4, 230.6, 309.4];                  // the four FPS connector panels
  for (const a of SI_PANELS) run('power', pb, [A(a - 3, RA, XA), A(a - 3, 1.36, 0.29), A(a - 3, 1.3, 0.3)], 0.012);
  run('power', pb, [A(178, RA, XA), A(178, 1.6, 0.4), A(178, 1.42, 1.06), A(178, 1.32, 1.11)], 0.012);       // WFC3
  run('power', pb, [A(222, 1.62, 3.0), A(216, 1.66, 3.0)], 0.01);                                              // star trackers
  run('power', pb, [A(oes.phiDeg(oes.bays.eptce), RR, XR1), A(oes.phiDeg(oes.bays.eptce), 1.6, X_EQ1 + 0.04), A(oes.phiDeg(oes.bays.eptce), 1.6, oes.x - 0.12)], 0.016);   // to the EP/TCE
  P('Main power bus harness', {
    system: 'Electrical', material: 'Heavy-gauge power bus cables', mass: 45, temp: 290, explode: [0, 0, 0], xrayWeight: 0.5,
    desc: 'Four power distribution units hold the buses, switches, fuses and monitors: two buses feed the telescope, instruments and SI C&DH, two the spacecraft. From the bay 4 door they feed both ring harnesses, a trunk aft through the bulkhead to a ring behind the instruments, and the telescope\'s own power electronics in the OTA equipment section. Routing simplified.',
  }, mesh(merge(pb), HM.powerCable()));

  // ------------------------------------------------------------------ SI C&DH bus to the instruments
  const XD = 0.2, RD = 1.54;
  const si = [];
  run('sicdh', si, [A(75, 1.95, X_EQ0 + 0.11), A(86, 1.95, X_EQ0 + 0.09), A(86, 1.8, X_EQ0 + 0.01), A(70, 1.78, X_EQ0 - 0.07), A(62, 1.78, 3.3), A(62, 1.78, 0.5), A(56, RD, XD)], 0.02);
  run('sicdh', si, arcPts(RD, XD, 0, 360, 10), 0.014);
  for (const a of SI_PANELS) run('sicdh', si, [A(a + 3, RD, XD), A(a + 3, 1.36, 0.27), A(a + 3, 1.3, 0.29)], 0.011);
  run('sicdh', si, [A(182, RD, XD), A(182, 1.5, 0.4), A(182, 1.4, 1.06), A(182, 1.3, 1.11)], 0.011);         // WFC3
  P('SI C&DH harness', {
    system: 'Avionics', material: 'Shielded data bundles from the bay 10 door through the aft bulkhead to the instrument connector panels', mass: 15, temp: 290, explode: [0, 0, 0], xrayWeight: 0.4,
    desc: 'The science instruments\' command and data bus: from the SI C&DH on the bay 10 door, aft through the equipment section\'s bulkhead and round a ring behind the focal plane structure to each instrument\'s connector panel and WFC3. Commands go out, science frames come back. Routing simplified.',
  }, mesh(merge(si), HM.dataCable()));

  const sd = [];
  run('data', sd, [A(75, 1.95, X_EQ0 + 0.11), A(78, 1.6, X_EQ0 + 0.07), ...arcPts(1.6, X_EQ0 + 0.05, 78, 275, 8)], 0.012);
  run('data', sd, [A(135, 1.6, X_EQ0 + 0.05), A(147, 1.6, X_EQ0 + 0.07), A(147, 1.9, X_EQM() - 0.06), A(140, 1.92, X_EQM() - 0.03)], 0.011);   // to the DMU on the bay 1 door
  run('data', sd, [A(275, 1.6, X_EQ0 + 0.05), A(273, 1.85, X_EQ0 + 0.1), A(273, 1.88, 4.15), A(280.7, 1.88, 4.14)], 0.011);                  // to the solid-state recorders
  run('data', sd, [A(280.7, 1.88, 4.14), A(279, 1.75, 4.14), A(279.1, 1.75, 3.99)], 0.011);                                                 // and on to the transmitter
  P('Science data path', {
    system: 'Avionics', material: 'Data cables SI C&DH → data management unit → solid-state recorders → S-band transmitters', mass: 4, temp: 290, explode: [0, 0, 0], xrayWeight: 0.6,
    desc: 'Every science frame travels instrument → SI C&DH (bay 10) → data management unit (bay 1) → solid-state recorder (bay 5) → S-band transmitter → high-gain antenna → TDRS. Traced here as one cable so the path can be followed; the real signals share the ring harness.',
  }, mesh(merge(sd), HM.dataCable()));

  // ------------------------------------------------------------------ OTA harness
  // from the OTA equipment section inward through the forward shell, aft to the main ring; branches
  // to the mirror actuators and heaters, up the truss to the secondary, and aft to the three FGSs
  const ota = [];
  const o = (i) => oes.phiDeg(i);
  run('ota', ota, arcPts(1.58, 5.2, o(1) - 5, o(7) + 5, 8), 0.012);
  for (const i of [1, 2, 3, 4, 5, 6, 7]) run('ota', ota, [A(o(i), 1.58, 5.2), A(o(i), 1.6, oes.x - 0.1)], 0.009);
  run('ota', ota, [A(30, 1.58, 5.2), A(30, 1.47, 5.12), A(30, 1.47, 3.72), A(30, 1.36, 3.69), A(30, 1.36, 3.57), A(30, 0.9, 3.5)], 0.016);
  run('ota', ota, arcPts(0.9, 3.5, 30, 390, 10), 0.011);
  for (const a of [30, 120, 210, 300]) run('ota', ota, [A(a, 0.9, 3.5), A(a + 6, 0.92, 3.6)], 0.009);
  run('ota', ota, [A(30, 1.47, 4.25), A(30, 1.41, 4.14), A(45, 1.41, 6.56), A(30, 1.41, 9.0), ...arcPts(1.41, 9.02, 30, 2, 7), A(2, 1.36, 9.11), A(2, 0.42, 9.11), A(2, 0.22, 9.13), A(2, 0.2, 9.2)], 0.012);
  run('ota', ota, [A(30, 1.47, 3.72), A(30, 1.52, 3.48), A(30, 1.9, 3.47)], 0.014);
  run('ota', ota, arcPts(1.9, 3.47, -90, 90, 8), 0.013);
  for (const c of [0, 90, 270]) run('ota', ota, [A(c + 5, 1.9, 3.47), A(c + 5, 2.08, 3.44), A(c + 5, 2.08, 2.12), A(c + 5, 2.06, 2.1)], 0.01);
  P('OTA harness', {
    system: 'Electrical', material: 'Wire bundles from the OTA equipment section to the mirror actuators, heaters, secondary mirror and guiders', mass: 20, temp: 290, explode: [0, 0, 0], xrayWeight: 0.4,
    desc: 'The telescope\'s own wiring. The actuator control electronics pick which of the 24 primary and 6 secondary actuators to move; the three fine guidance electronics boxes power and command their guiders and pass guide-star errors to the pointing system; the EP/TCE\'s thermostats keep the mirrors near 21 °C. Routing simplified.',
  }, mesh(merge(ota), HM.harness()));

  // ------------------------------------------------------------------ mechanism control harness
  // from the MCU and solar-array drive electronics in bay 7 to the door's hinge drive, the antenna
  // hinge drives and latches, and the two solar-array drives
  const mc = [];
  run('mech', mc, [A(345, 1.72, 4.7), A(350, 1.6, X_EQ1 + 0.01), A(352, 1.47, X_EQ1 + 0.1), A(352, 1.47, 12.25), A(357, 1.62, 12.3), A(0, 1.62, 12.34)], 0.014);
  run('mech', mc, [A(352, 1.47, 6.95), A(5, 1.58, 6.85), A(10, 1.63, 6.85)], 0.01);                         // +V3 antenna hinge drive and gimbal
  for (const x of [10.0, 10.95]) run('mech', mc, [A(352, 1.47, x), A(358, 1.6, x), A(0, 1.62, x - 0.12)], 0.009);   // +V3 antenna latches
  run('mech', mc, [A(352, 1.44, 6.25), ...arcPts(1.44, 6.25, 352, 172, 8)], 0.012);
  run('mech', mc, [A(352, 1.44, 6.25), ...arcPts(1.44, 6.25, 352, 450, 8)], 0.012);
  for (const c of [90, 270]) run('mech', mc, [A(c, 1.44, 6.25), A(c, 1.5, 6.12), A(c, 1.62, 6.12)], 0.01);          // solar array drives
  run('mech', mc, [A(172, 1.44, 6.25), A(172, 1.47, 6.4), A(172, 1.47, 10.95)], 0.012);
  run('mech', mc, [A(172, 1.47, 6.95), A(185, 1.58, 6.85), A(190, 1.63, 6.85)], 0.01);                       // −V3 antenna hinge drive and gimbal
  for (const x of [10.0, 10.95]) run('mech', mc, [A(172, 1.47, x), A(178, 1.6, x), A(180, 1.62, x - 0.12)], 0.009);
  P('Mechanism control harness', {
    system: 'Electrical', material: 'Drive cables for the stepper-motor actuators', mass: 12, temp: 285, explode: [0, 0, 0], xrayWeight: 0.5,
    desc: 'Nine latches (four antenna, four array, one door) and three hinge drives work through stepper-motor rotary drive actuators; this harness carries their drive pulses from the mechanism control unit in bay 7, and the array drive electronics\' signals to the two wing drives. The array latches have been unused since the rigid SA3 wings arrived in 2002. Routing simplified.',
  }, mesh(merge(mc), HM.harness()));

  // ------------------------------------------------------------------ Cross Aft Shroud Harness (2002)
  const cash = [];
  run('cash', cash, [A(47, 1.62, 2.6), A(47, 1.62, 3.3), A(50, 2.0, 3.47), ...arcPts(2.0, 3.47, 50, 245, 8), A(248, 1.97, 3.3), A(248, 1.97, 2.55), A(248, 1.8, 2.5), A(248, 1.77, 2.47)], 0.015);
  P('Cross Aft Shroud Harness (CASH)', {
    system: 'Electrical', material: 'Power harness clamped to the internal handrails', mass: 6, temp: 285, explode: [0, 0, 0], xrayWeight: 0.6,
    desc: 'Spacewalkers added it in 2002 to power the NICMOS cooling system, from the bay COSTAR then held (now COS) round the −V3 side to the cooler. In 2009 they had to move it to a lower handrail just to reach the gyros — a measure of how crowded the aft shroud is. Route approximate.',
  }, mesh(merge(cash), HM.powerCable()));

  // ------------------------------------------------------------------ gyro harness (RSU → ECU)
  const gy = [];
  run('gyro', gy, [A(163, 1.75, 2.5), A(163, 1.75, 3.44), ...arcPts(1.75, 3.44, 163, 75, 8), A(70, 1.6, X_EQ0 + 0.01), A(68, 1.6, X_EQ0 + 0.11), A(66, 1.72, X_EQ0 + 0.15), A(66, 1.72, 4.6)], 0.012);
  for (const x of [2.55, 2.9, 3.25]) run('gyro', gy, [A(163, 1.75, x), A(161.6, 1.75, x)], 0.008);
  for (let i = 0; i < 3; i++) run('gyro', gy, [A(66, 1.72, X_EQ0 + 0.3 + i * 0.36), A(70.5, 1.72, X_EQ0 + 0.3 + i * 0.36)], 0.008);
  P('Gyro harness (RSU → ECU)', {
    system: 'Attitude control', material: 'Shielded signal cable', mass: 3, temp: 290, explode: [0, 0, 0], xrayWeight: 0.6,
    desc: 'Each of the three rate gyro assemblies is split in two: the sensor unit, two gyros whose wheels spin at 19,200 rpm in fluid, sits on the optical bench in the aft shroud, and its electronics control unit is in bay 10. This cable joins them through the equipment section\'s aft bulkhead. Routing simplified.',
  }, mesh(merge(gy), HM.dataCable()));

  // ------------------------------------------------------------------ pointing-sensor harness
  // torquer bars, magnetometers and the five coarse sun sensors join the forward trunk or run to bay 8
  const ps = [];
  for (const [c, t] of [[45, 62], [135, 118], [225, 242], [315, 298]]) run('pointing', ps, [A(c, 1.62, 6.4), A(c, 1.485, 6.45), ...arcPts(1.485, 6.45, c, t, 6)], 0.009);
  for (const [t, c] of [[62, 70], [298, 290]]) run('pointing', ps, [A(t, 1.485, 12.6), A(c, 1.53, 12.62)], 0.008);
  for (const [t, c] of [[118, 110], [242, 250]]) run('pointing', ps, [A(t, 1.485, 12.6), A(c, 1.5, 12.8), A(c, 1.56, 12.82)], 0.008);
  run('pointing', ps, [A(180, 2.07, 0.85), ...arcPts(1.96, 0.85, 180, 20, 8), A(20, 1.96, 3.45), A(18, 1.85, X_EQ0 + 0.06), A(17, 1.75, X_EQ0 + 0.09)], 0.01);
  run('pointing', ps, [A(340, 2.07, 0.85), ...arcPts(1.96, 0.85, 340, 380, 8)], 0.01);
  run('pointing', ps, [A(20, 1.96, 0.85), A(20, 2.07, 0.85)], 0.008);
  P('Pointing-sensor harness', {
    system: 'Attitude control', material: 'Signal and drive cables', mass: 5, temp: 285, explode: [0, 0, 0], xrayWeight: 0.6,
    desc: 'Wires the torquer bars, magnetometers and the five coarse sun sensors to the safe-mode electronics in bay 8 and, over the ring harness, to the flight computer in bay 1. The safing system needs only these to hold Hubble Sun-pointed, with no ground link, indefinitely. Routing simplified.',
  }, mesh(merge(ps), HM.dataCable()));

  return out;
}

function X_EQM() { return (X_EQ0 + X_EQ1) / 2; }
