// MQ-9A nose sensors and the radio links' plumbing, in aircraft coordinates (see shape.js).
// Lynx (AN/APY-8): Sandia built the radar as two packages, a gimbal assembly in the lower nose and
// a radar electronics assembly (REA) behind it. The gimbal is a three-axis gimbal with every
// component on the inner gimbal: a vertically polarised horn-fed dish (3.2° × 7° beam), the
// travelling-wave-tube amplifier and low-noise amplifier, and a Litton LN-200 fibre-optic IMU on
// the back of the antenna (Tsunoda et al., Sandia, OSTI 4263). Sizes from the GA-ASI Lynx
// datasheet: gimbal swept volume 17.1 in high × 19.5 in across, REA 23.7 × 10.6 × 12.6 in.
// Mount layout, cable routing and every unmarked size here are estimates.

import * as THREE from 'three';
import { X, prof, fusePoint, merge, box, lru, cylX, tubeBetween, pipe, latheX } from './shape.js';

const roof = (s, z = 0, d = 0.035) => [X(s), prof(s).top - d, z];
const keel = (s, z = 0, d = 0.03) => [X(s), prof(s).bot + d, z];

/** Lynx gimbal assembly and radar electronics. Returns the three gimbal stages for update(). */
export function buildLynx({ P, L, m }) {
  const LX = [X(0.48), 1.22, 0];                // gimbal centre (elevation axis on the azimuth axis)
  const lynx = new THREE.Group();
  lynx.position.set(...LX);
  const az = new THREE.Group();                 // outer gimbal: azimuth, about the vertical
  const el = new THREE.Group();                 // middle gimbal: elevation, about the lateral axis
  const roll = new THREE.Group();               // inner gimbal: about the boresight; carries everything
  lynx.add(az); az.add(el); el.add(roll);

  // fixed: the mounting deck across the lower nose, its brackets to the s 0.95 frame, the azimuth
  // bearing housing and its motor hanging under the deck
  const dy = 1.42 - LX[1];
  const deck = [box(0.6, 0.012, 0.5, [X(0.63) - LX[0], dy, 0])];
  for (const zs of [1, -1]) deck.push(box(0.04, 0.03, 0.17, [X(0.93) - LX[0], dy - 0.02, 0.33 * zs]));
  deck.push(new THREE.CylinderGeometry(0.085, 0.085, 0.05, 28).translate(0, dy - 0.031, 0));
  deck.push(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 14).translate(-0.1, dy - 0.036, 0.07));
  // azimuth stage: turntable collar, yoke and the elevation bearings and motor
  const yoke = [new THREE.CylinderGeometry(0.075, 0.075, 0.016, 28).translate(0, dy - 0.064, 0), box(0.06, 0.025, 0.43, [0, 0.14, 0])];
  for (const zs of [1, -1]) {
    yoke.push(box(0.05, 0.15, 0.016, [0, 0.07, 0.2 * zs]));
    yoke.push(new THREE.CylinderGeometry(0.024, 0.024, 0.03, 12).rotateX(Math.PI / 2).translate(0, 0, 0.2 * zs));
  }
  yoke.push(lru(0.06, 0.05, 0.035, [0, 0.085, 0.177]));
  // elevation stage: the elliptical ring bearing of the inner (roll) gimbal and its trunnions
  const ringG = [new THREE.TorusGeometry(0.17, 0.011, 8, 36).rotateY(Math.PI / 2).scale(1, 0.62, 1)];
  for (const zs of [1, -1]) ringG.push(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 10).rotateX(Math.PI / 2).translate(0, 0, 0.185 * zs));
  const gimbal = P('Lynx three-axis gimbal', {
    system: 'Sensors', material: 'Machined aluminium gimbal with torque motors and resolvers, on a nose deck', mass: 14, xrayWeight: 0.6, count: 3, explode: [1.35, 0, 0],
    desc: 'Sandia’s three-axis gimbal for Lynx: azimuth, elevation and an inner gimbal about the beam axis, hanging from a deck in the lower nose. It points the antenna anywhere from 5° to 60° below the horizon, all the way round (±180°), inside a swept volume 0.43 m high and 0.50 m across (GA-ASI datasheet).',
  }, lynx);
  lynx.add(L(merge(deck), m.darkMetal));
  az.add(L(merge(yoke), m.darkMetal));
  el.add(L(merge(ringG), m.alu));

  // inner gimbal: dish (0.40 × 0.18 m, f = 0.2 m), feed horn at its focus on a waveguide arm
  const f = 0.2, v0 = 0.012;
  const prof0 = [];
  for (let i = 0; i <= 8; i++) { const r = 0.004 + (i / 8) * 0.196; prof0.push([r, v0 + (r * r) / (4 * f)]); }
  const dish = latheX(prof0, 36).scale(1, 0.45, 1);
  const back = box(0.012, 0.16, 0.3, [0, 0, 0]);
  const horn = merge([
    cylX(v0 + f - 0.03, v0 + f + 0.008, 0.034, 0.011, 0, 0, 4),                                  // pyramidal feed horn, mouth toward the dish
    tubeBetween([v0 + f + 0.006, 0, 0], [v0 + f + 0.006, -0.03, 0], 0.009, 4),
    tubeBetween([v0 + f + 0.006, -0.03, 0], [v0 + 0.05, -0.083, 0], 0.009, 4),                     // waveguide arm to the lower rim
    tubeBetween([v0 + 0.05, -0.083, 0], [-0.02, -0.07, 0], 0.009, 4),
  ]);
  P('AN/APY-8 Lynx SAR antenna', {
    system: 'Sensors', material: 'Horn-fed reflector dish on the inner gimbal', mass: 4, xrayWeight: 0.5, explode: [0.35, 0, 0],
    desc: 'A vertically polarised, horn-fed dish 0.40 m wide and 0.18 m tall (estimated), with a 3.2° by 7° beam at 15.2–18.2 GHz (Sandia). By recording echoes as the aircraft flies, Lynx makes images of the ground through cloud, smoke and darkness down to 0.1 m resolution in spotlight mode, and in GMTI mode picks out vehicles moving at 6 knots or more.',
    callout: true, anchor: [0.03, -0.04, 0.07],   // on the dish face near the azimuth axis (inner-gimbal frame), so the dot barely moves
  }, [L(dish, m.dish), L(merge([back, horn]), m.darkMetal)], roll);
  P('Lynx TWT amplifier & LNA', {
    system: 'Sensors', material: 'Travelling-wave-tube amplifier and low-noise amplifier', mass: 6, count: 2, explode: [-0.3, 0.12, 0.3],
    desc: 'The radar’s microwave front end rides on the inner gimbal right behind the dish, so the transmit and receive paths stay short: a travelling-wave-tube amplifier (360 W peak on the current datasheet, at a 35 % duty cycle) and the low-noise amplifier for the faint echoes (Sandia; GA-ASI).',
  }, L(merge([lru(0.1, 0.1, 0.25, [-0.062, -0.035, 0.02], 0.012), lru(0.06, 0.04, 0.07, [-0.045, 0.06, 0.1], 0.008)]), m.lruOlive), roll);
  P('Lynx LN-200 IMU', {
    system: 'Sensors', material: 'Litton LN-200 fibre-optic inertial measurement unit', mass: 0.75, explode: [-0.3, 0.2, -0.3],
    desc: 'A fibre-optic IMU on the back of the antenna measures its every movement. A synthetic aperture only focuses if the antenna’s path is known to a fraction of the 1.8 cm wavelength, so these readings, with carrier-phase GPS, correct the image for the aircraft’s bumps and sways (Sandia).',
  }, L(box(0.09, 0.085, 0.09, [-0.052, 0.058, -0.08]), m.darkMetal), roll);

  // radar electronics assembly behind the SATCOM pedestal, and its cables forward to the gimbal base
  const REA = [X(1.575), 1.195, 0];
  const rea = [lru(0.6, 0.27, 0.32, REA, 0.015), box(0.012, 0.2, 0.26, [REA[0] + 0.305, REA[1], 0])];
  for (const zs of [1, -1]) for (let k = 0; k < 6; k++) rea.push(box(0.012, 0.22, 0.008, [REA[0] - 0.24 + k * 0.096, REA[1], 0.163 * zs]));
  for (const z of [-0.08, 0, 0.08]) rea.push(cylX(REA[0] + 0.31, REA[0] + 0.33, 0.018, 0.018, REA[1] + 0.05, z, 10));
  P('Lynx radar electronics', {
    system: 'Sensors', material: 'Sealed, conduction-cooled VME chassis', mass: 30, xrayWeight: 0.6, explode: [0.9, -0.2, 0.6],
    desc: 'The radar electronics assembly, 0.60 × 0.27 × 0.32 m (GA-ASI): exciter, receiver, digital waveform synthesis and the image processors on VME boards in a sealed chassis cooled through its walls. The whole radar weighs under 62 kg and draws 1.4 kW on average (1.9 kW peak) from the 28 V bus, one of the largest electrical loads on the aircraft.',
  }, L(merge(rea), m.lruOlive));
  const cab = [];
  for (const [dz, r] of [[0.08, 0.009], [0.115, 0.007]]) cab.push(pipe([[REA[0] + 0.33, REA[1] + 0.05, dz], [X(1.12), 1.25, dz + 0.03], [X(0.95), 1.3, dz + 0.02], [X(0.75), 1.37, dz], [X(0.6), 1.395, dz - 0.03], [LX[0] - 0.085, 1.39, dz - 0.06]], r, 6, 40));
  P('Lynx RF & data cables', {
    system: 'Sensors', material: 'Low-loss RF cable and shielded data and power bundle (routing estimated)', mass: 2, count: 2, xrayWeight: 0.6, explode: [1.1, -0.1, 0.3],
    desc: 'Join the electronics to the gimbal: the exciter’s drive and the received signal on low-loss RF cable, and power and control for the gimbal motors, the TWT and the IMU. Sandia notes the cable assemblies vary from platform to platform.',
  }, L(merge(cab), m.harness));
  return { az, el, roll };
}

/** Pitot-static, OAT and angle-of-attack lines to the air data computer, and the AoA vane. */
export function buildAirData({ P, L, m }, adc) {
  const lines = [];
  // two lines (pitot and static) from each probe, aft inside the lower nose and up through the floor
  for (const zs of [1, -1]) {
    const th = zs > 0 ? -0.32 : Math.PI + 0.32;
    for (const dy of [0.012, -0.012]) {
      const off = (p) => [p[0], p[1] + dy, p[2]];
      const tail = zs > 0
        ? [[X(1.45), 1.42 + dy, 0.33], [X(1.62), 1.44 + dy, 0.22], [X(1.64), 1.52, 0.2 + dy]]
        : [[X(1.45), 1.42 + dy, -0.33], [X(1.55), 1.43 + dy, 0.0], [X(1.62), 1.44 + dy, 0.16], [X(1.65), 1.52, 0.15 + dy]];
      lines.push(pipe([off(fusePoint(0.62, th, 0.006)), off(fusePoint(0.75, th, 0.025)), off(fusePoint(0.9, th, 0.03)), off(fusePoint(1.25, th + 0.12 * zs, 0.035)), ...tail], 0.003, 4, 40));
    }
  }
  // OAT wire forward along the starboard side; AoA wire aft from the vane
  lines.push(pipe([fusePoint(3.0, -0.9, 0.004), fusePoint(2.95, -0.75, 0.025), fusePoint(2.85, -0.2, 0.03), fusePoint(2.0, -0.15, 0.035), [X(1.75), 1.44, 0.3], [X(1.72), 1.52, adc[2] + 0.11]], 0.0035, 4, 40));
  lines.push(pipe([fusePoint(0.85, -0.05, 0.05), fusePoint(1.2, -0.08, 0.04), [X(1.5), 1.43, 0.31], [X(1.66), 1.52, adc[2] + 0.1]], 0.0035, 4, 30));
  P('Air data lines', {
    system: 'Sensors', material: 'Nylon pressure tubing, 6 mm; shielded sensor wires', mass: 0.6, count: 6, xrayWeight: 0.6, explode: [1.0, 0.2, 0.25],
    desc: 'Pitot and static lines from both probes, the outside-air-temperature wire and the angle-of-attack wire, all to the air data computer. Its airspeed feeds the hold modes and the stall protection: a 2012 investigation records an airspeed hold set to 111 kt against a calculated stall speed of 81 kt (USAF; routing estimated).',
  }, L(merge(lines), m.harness));
  const base = new THREE.Vector3(...fusePoint(0.85, -0.05)), n = base.clone().sub(new THREE.Vector3(...fusePoint(0.85, -0.05, 0.02))).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
  // vane: span 0.06 m out from the skin, chord 0.05 m, flat faces up and down so it weathercocks in pitch
  const vane = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(-0.05, 0), new THREE.Vector2(-0.05, 0.06), new THREE.Vector2(-0.025, 0.06)]);
  const vg = new THREE.ExtrudeGeometry(vane, { depth: 0.004, bevelEnabled: false }).translate(0.02, 0, -0.002).applyQuaternion(q).translate(base.x + n.x * 0.004, base.y + n.y * 0.004, base.z + n.z * 0.004);
  P('Angle-of-attack vane', {
    system: 'Sensors', material: 'Heated vane on a resolver (type and position not public)', mass: 0.4, explode: [0.6, -0.2, 0.6],
    desc: 'A small vane that weathercocks into the local airflow and reports the wing’s angle of attack. Crews read it in “units” on the head-up display, and the stall protection acts on it: in the 2012 Nevada mishap the aircraft neared the stall at about 12 units (USAF investigation; vane type and position not public).',
  }, [L(merge([new THREE.CylinderGeometry(0.028, 0.028, 0.006, 16).applyQuaternion(q).translate(base.x, base.y, base.z),
    new THREE.CylinderGeometry(0.022, 0.022, 0.05, 12).applyQuaternion(q).translate(base.x - n.x * 0.025, base.y - n.y * 0.025, base.z - n.z * 0.025)]), m.darkMetal),
  L(vg, m.dark)]);
}

/**
 * Radio plumbing: the SATCOM rotary joint and RF run, the coax from every antenna to its radio, the
 * Iridium link (CBP Predator B fit) and the emergency locator transmitter.
 * at: { modem, cband, egi: [stbd, port], iff, floor } unit centres from uav.js.
 */
export function buildLinks({ P, L, m }, at) {
  const rj = [X(1.15), 1.225, 0];
  P('SATCOM rotary joint & RF run', {
    system: 'Communications', material: 'RF rotary joint on the azimuth axis, low-loss waveguide run (est.)', mass: 1.5, xrayWeight: 0.5, explode: [1.2, 1.15, -0.65],
    desc: 'The rotary joint on the pedestal’s azimuth axis lets the dish turn continuously while its signal passes through; a short, low-loss run takes it to the modem. Ku-band signals fade fast in cable, which is why the modem sits right beside the dish. USAF investigators call this the Predator Primary Satellite Link (PPSL).',
  }, L(merge([
    new THREE.CylinderGeometry(0.056, 0.056, 0.05, 20).translate(...rj),
    pipe([[rj[0] - 0.03, rj[1] + 0.01, -0.045], [X(1.3), 1.3, -0.2], [X(1.48), 1.42, -0.22], [at.modem[0] + 0.155, at.modem[1] - 0.02, -0.2]], 0.009, 6, 30),
  ]), m.darkMetal));

  const coax = [];
  const c = (pts, r = 0.0035) => coax.push(pipe(pts, r, 4, Math.max(16, pts.length * 10)));
  // C-band: upper blade along the roof to the transceiver; lower blade up past the floor's aft edge
  c([[X(2.5), prof(2.5).top - 0.013, 0], roof(2.55, -0.04, 0.03), roof(2.9, -0.08), [X(3.18), 1.79, -0.1], [X(3.2), at.cband[1] + 0.112, -0.1]], 0.004);
  c([[X(3.3), prof(3.3).bot + 0.013, 0], keel(3.32, -0.01, 0.025), [X(3.36), 1.2, -0.02], [X(3.41), 1.45, -0.05], [X(3.405), 1.6, -0.1], [at.cband[0] - 0.13, at.cband[1], -0.12]], 0.004);
  // GPS: the forward patch to the starboard EGI, the aft patch along the roof to the port EGI
  c([[X(3.0), prof(3.0).top - 0.012, 0], roof(2.96, 0.01, 0.03), [X(2.85), 1.76, 0.12], [at.egi[0][0] - 0.08, at.egi[0][1] + 0.08, 0.2]]);
  c([[X(5.05), prof(5.05).top - 0.012, 0], roof(4.98, -0.02, 0.03), roof(4.4, -0.04), roof(3.4, -0.04), roof(3.0, -0.08), [X(2.8), 1.74, -0.17], [at.egi[1][0] - 0.08, at.egi[1][1] + 0.08, -0.2]]);
  // IFF: upper blade forward along the roof; lower blade along the lower side and up into the bay
  c([[X(6.6), prof(6.6).top - 0.013, 0], roof(6.55, 0.02, 0.03), roof(6.0, 0.03), roof(5.0, 0.03), roof(3.6, 0.03), roof(2.9, 0.03), [X(2.68), 1.68, 0.03], [at.iff[0] - 0.02, at.iff[1] + 0.06, 0.03]]);
  // the lower blade's cable stays in the keel channel under the aft cell's floor, rising only between the gear wells
  c([[X(6.9), prof(6.9).bot + 0.013, 0], keel(6.86, -0.01, 0.022), keel(6.8, -0.03, 0.022), keel(6.62, -0.035, 0.022), keel(6.5, -0.03, 0.025), [X(6.38), 1.225, -0.012], [X(6.25), 1.29, 0.0], [X(6.0), 1.3, 0.0], [X(5.0), 1.3, 0.0], [X(4.88), 1.29, 0.04], fusePoint(4.79, -0.6, 0.035), fusePoint(4.4, -0.6, 0.035),
    fusePoint(3.6, -0.6, 0.035), fusePoint(3.1, -0.5, 0.035), [X(2.92), 1.42, 0.3], [X(2.84), 1.5, 0.2], [X(2.8), 1.54, 0.08], [at.iff[0] - 0.13, at.iff[1], 0.04]]);
  P('Antenna coax runs', {
    system: 'Communications', material: 'Low-loss coaxial cable, 6–8 mm (routing estimated)', mass: 2.5, count: 6, xrayWeight: 0.5, explode: [0.2, 0.9, 0.35],
    desc: 'A separate cable from every antenna to its radio: both C-band blades to the line-of-sight transceiver, the GPS patches to the two GPS/INS units, and the upper and lower IFF blades, 4 m aft, forward to the transponder. Upper and lower antennas each have their own cable so the radio can switch to whichever one still sees the ground station in a steep bank.',
  }, L(merge(coax), m.harness));

  const irBox = [X(2.95), at.floor + 0.047, 0.06];
  const irPatch = [X(5.45), prof(5.45).top + 0.003, 0];
  P('Iridium antenna & transceiver', {
    system: 'Communications', material: 'Satellite phone-band transceiver, patch antenna and coax (CBP fit)', mass: 2, explode: [0.2, 1.55, 0.45],
    desc: 'A secondary beyond-line-of-sight link through the Iridium satellites, fitted to the Customs and Border Protection Predator B lost in 2006 (NTSB); the USAF fit is not public. Its low data rate could fly the aircraft only through the autopilot hold modes, and when the engine stopped it was among the loads shed to save the battery.',
  }, L(merge([lru(0.2, 0.08, 0.15, irBox, 0.01), lru(0.08, 0.014, 0.08, irPatch, 0.03),
    pipe([[irPatch[0], irPatch[1] - 0.006, 0], [irPatch[0] - 0.03, irPatch[1] - 0.024, 0.04], roof(5.3, 0.06), roof(5.0, 0.06), roof(3.6, 0.065), roof(3.1, 0.07), [X(3.0), 1.66, 0.07], [irBox[0], irBox[1] + 0.04, 0.07]], 0.0035, 4, 40)]), m.lru));

  const elt = [X(6.15), 1.785, 0.12];
  const eltBlade = new THREE.Shape([new THREE.Vector2(0.05, 0), new THREE.Vector2(-0.05, 0), new THREE.Vector2(-0.02, 0.13), new THREE.Vector2(0.0, 0.13)]);
  const eltG = new THREE.ExtrudeGeometry(eltBlade, { depth: 0.012, bevelEnabled: false }).translate(X(6.32), prof(6.32).top - 0.01, -0.006);
  P('Emergency locator transmitter', {
    system: 'Communications', material: 'ELT, blade antenna and its cable (positions not public)', mass: 1.5, explode: [0, 1.4, 0.5],
    desc: 'Transmits a distress beacon after a crash so searchers can find the wreck. After the 2006 Predator B crash it was never heard: the antenna cable separated in the impact, although the transmitter itself tested normal (NTSB; positions estimated).',
  }, [L(merge([lru(0.15, 0.08, 0.08, elt, 0.01), pipe([[elt[0] - 0.075, elt[1] + 0.01, elt[2]], [X(6.28), 1.82, 0.06], [X(6.31), prof(6.32).top - 0.03, 0.01], [X(6.32), prof(6.32).top - 0.012, 0]], 0.0035, 4, 14)]), m.lruOlive), L(eltG, m.dark)]);
}
