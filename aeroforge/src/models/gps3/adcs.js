// GPS III attitude control subsystem and bus avionics. The ACS sensors and actuators listed for GPS
// III are coarse sun sensors, Earth sensors, an inertial measurement unit, reaction wheels, magnetic
// torque rods and the 0.2-lbf thrusters (Marquis & Shaw, InsideGNSS 2011); Honeywell supplied the
// on-board computer, reaction wheel assembly and IMU. Lockheed's expanded view (Fig. 4) puts the
// "RWA (4)", the OBC and the IMU together on the Bus/NCE/HPE panel (−Y here), with "RIU (2)" and a
// "TFU", the "Sun Sensor Electronics (2)" and "Sun Sensor (4) Detectors" near the aft corners, and
// "ESA (2)" on the Earth deck. Exact positions and sizes not in those sources are estimates.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { G } from './materials.js';
import { HX, HY, HZ, IY, IZ, DECK, AFT, boxG, cylG, merge, unit, connPoint, reg } from './kit.js';
import { DECK_AT, onNPE, onBUS } from './layout.js';

/** Reaction wheel centres (x, z) on the −Y panel: a 2 × 2 cluster at 0.36 m pitch (layout estimate). */
export const WHEELS = [[0.44, 0.68], [0.8, 0.68], [0.44, 1.04], [0.8, 1.04]];
const WHEEL_Y = -0.72;

export function buildADCS(P) {
  const box = (name, info, c, s, mat, opts, side, power = false) => { reg(connPoint(c, s, opts.conn, 0.04), side, power); return P(name, info, unit(c, s, mat, opts)); };

  // ------------------------------------------------------------------ reaction wheel assembly (−Y panel), spin axes in a pyramid
  const rotors = [];
  const tilt = THREE.MathUtils.degToRad(30);
  const cc = [0.62, 0.86];
  WHEELS.forEach(([x, z], k) => {
    const out = new THREE.Vector3(Math.sign(x - cc[0]), 0, Math.sign(z - cc[1])).normalize();
    const axis = new THREE.Vector3(0, Math.cos(tilt), 0).addScaledVector(out, Math.sin(tilt));
    const g = new THREE.Group();
    g.position.set(x, WHEEL_Y, z);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
    const housing = mesh(merge([
      new THREE.CylinderGeometry(0.15, 0.15, 0.1, 36), new THREE.CylinderGeometry(0.06, 0.08, 0.03, 20).translate(0, 0.065, 0),
      new THREE.CylinderGeometry(0.165, 0.165, 0.012, 36).translate(0, -0.056, 0),
    ]), G.gunmetal());
    const rotor = new THREE.Group();
    const rim = mesh(merge([new THREE.CylinderGeometry(0.13, 0.13, 0.06, 32, 1, true), new THREE.CylinderGeometry(0.035, 0.035, 0.07, 12)]), G.silverBox());
    const mark = mesh(boxG([0.1, 0, 0], [0.05, 0.062, 0.02]), G.alodine());
    rotor.add(rim, mark);
    g.add(housing, rotor);
    rotors.push(rotor);
    const ped = mesh(merge([cylG([x, (-IY + WHEEL_Y) / 2 - 0.02, z], 0.07, Math.abs(-IY - WHEEL_Y) - 0.04, 'y', 18), cylG([x, -IY + 0.006, z], 0.11, 0.012, 'y', 22)]), G.aluminium());
    reg([x + 0.17, -0.7, z], 'bus', true);
    P(`Reaction wheel ${k + 1}`, {
      system: 'Attitude control', material: 'Steel flywheel on ball bearings, sealed housing (Honeywell)', mass: 13, temp: 295,
      explode: [Math.sign(x - cc[0]) * 0.2, -1.05, Math.sign(z - cc[1]) * 0.2],
      desc: k === 0
        ? 'Part of Honeywell\'s reaction wheel assembly ("RWA (4)" in Lockheed\'s figure), grouped with the computer and the IMU on the bus panel. The four spin axes are tilted 30° from the panel normal in a pyramid (geometry estimated), so any three give full three-axis control. Speeding a wheel up turns the spacecraft the other way, because angular momentum is conserved, so pointing costs electricity, not propellant.'
        : 'One of the four reaction wheels, about 0.30 m across. Steady torques, mostly from sunlight pressure, slowly spin the wheels up; the thrusters or the torque rods periodically dump that stored momentum.',
    }, [g, ped]);
  });
  box('Reaction wheel drive electronics', {
    system: 'Attitude control', material: 'Aluminium chassis', mass: 9, temp: 300, explode: [0.15, -1.1, 0],
    desc: 'Power electronics that drive the four wheel motors and report their speeds to the on-board computer, which commands torque many times a second (unit split and position estimated).',
  }, onBUS([1.08, 0.86], 0.12), [0.18, 0.12, 0.3], G.alodine(), { mount: '-y', conn: '+y', n: 4 }, 'bus', true);

  // ------------------------------------------------------------------ Earth sensor assemblies (the white two-aperture unit on the deck)
  const [ex, ey] = DECK_AT.esa;
  const earthSensor = (name, y, desc) => {
    const body = merge([boxG([ex, y, DECK + 0.1], [0.24, 0.13, 0.2]), boxG([ex, y, DECK + 0.005], [0.27, 0.145, 0.01])]);
    const lens = merge([cylG([ex, y, DECK + 0.204], 0.05, 0.01, 'z', 24)]);
    const hood = merge([cylG([ex, y, DECK + 0.215], 0.058, 0.024, 'z', 24, 0.062, true)]);
    reg([ex, y, IZ - 0.02], 'deck');
    return P(name, {
      system: 'Attitude control', material: 'White-painted housing, germanium optics, thermopile detectors', mass: 4, temp: 265, explode: [-0.2, (y - ey) * 2 + 0.15, 2.0], desc,
    }, [mesh(body, G.whitePaint()), mesh(lens, G.lens()), mesh(hood, G.darkMetal())]);
  };
  earthSensor('Earth sensor (A)', ey - 0.076, 'One of the two Earth sensor assemblies ("ESA (2)" in Lockheed\'s figure), taken here to be the white two-aperture unit in the scale model near the −X/+Y deck corner (identification estimated). An infrared Earth sensor sees the planet\'s 14–16 µm carbon-dioxide glow, which looks the same by day and night, and measures where the 27.8°-wide disc sits in its field to keep the antennas on nadir.');
  earthSensor('Earth sensor (B)', ey + 0.076, 'The second Earth sensor assembly, a redundant twin of the first. Either one can hold nadir pointing to well within the accuracy the 27.8° Earth-coverage beam needs (sensor type assumed infrared).');

  // ------------------------------------------------------------------ coarse sun sensors: four detector heads at the aft corners, two electronics boxes
  const heads = [];
  for (const sx of [1, -1]) for (const sy of [1, -1]) {
    const p = [sx * (HX - 0.03), sy * (HY - 0.05), AFT - 0.035];
    const d = new THREE.Vector3(sx, sy * 0.7, -0.8).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
    heads.push(new THREE.BoxGeometry(0.06, 0.06, 0.03).applyQuaternion(q).translate(...p), boxG([p[0] - sx * 0.02, p[1] - sy * 0.02, AFT - 0.01], [0.07, 0.07, 0.02]));
    reg([p[0] - sx * 0.08, p[1] - sy * 0.08, -HZ + 0.06], 'aft');
  }
  P('Sun sensor detectors', {
    system: 'Attitude control', material: 'Silicon photocells behind cover glass on angled brackets', mass: 1.2, count: 4, temp: 260, explode: [0, 0, -1.7],
    desc: 'Four coarse sun sensor heads ("Sun Sensor (4) Detectors" in Lockheed\'s figure) near the aft corners, angled outward so together they see most of the sky. They feed the yaw-steering law that keeps the array axis perpendicular to the Sun–satellite–Earth plane all orbit long (positions estimated).',
  }, mesh(merge(heads), G.lens()));
  const sse = (name, z) => box(name, {
    system: 'Attitude control', material: 'Aluminium chassis', mass: 1.5, temp: 295, explode: [0, -1.1, 0],
    desc: 'One of the two "Sun Sensor Electronics" boxes of Lockheed\'s figure: it amplifies the photocell currents and turns them into a Sun direction for the computer (panel position estimated).',
  }, onBUS([-1.02, z], 0.1), [0.15, 0.1, 0.1], G.alodine(), { mount: '-y', conn: '+y', n: 2 }, 'bus');
  sse('Sun sensor electronics (A)', 1.5);
  sse('Sun sensor electronics (B)', 1.33);

  // ------------------------------------------------------------------ IMU, torque rods
  box('Inertial measurement unit', {
    system: 'Attitude control', material: 'Fibre-optic gyroscopes in an aluminium housing (Honeywell)', mass: 9, temp: 295, explode: [0.1, -1.1, 0.05],
    desc: 'Honeywell\'s IMU, on the bus panel between the computer and the wheels as Lockheed\'s figure shows. Fibre-optic gyros measure rotation by the Sagnac effect, light sent both ways round a coil returning slightly out of step when it turns. It carries attitude through apogee burns and eclipses, and the 12-year mean mission duration depends on gyros like these lasting.',
  }, onBUS([1.0, 1.44], 0.16), [0.16, 0.16, 0.14], G.blackBox(), { mount: '-y', conn: '+y', n: 2 }, 'bus', true);
  const rodMesh = (a, b) => {
    const ax = ['x', 'y', 'z'][[0, 1, 2].find((i) => Math.abs(a[i] - b[i]) > 1e-6)];
    const c = a.map((v, i) => (v + b[i]) / 2), L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const g = [cylG(c, 0.018, L, ax, 12)];
    for (const e of [a, b]) g.push(cylG(e, 0.026, 0.04, ax, 12));
    for (const t of [0.25, 0.75]) g.push(boxG(a.map((v, i) => v + (b[i] - v) * t), ax === 'z' ? [0.03, 0.05, 0.03] : ax === 'x' ? [0.03, 0.03, 0.05] : [0.05, 0.03, 0.03]));
    return mesh(merge(g), G.darkMetal());
  };
  const torque = (name, a, b, ex, where) => { reg(b, 'core'); return P(name, {
    system: 'Attitude control', material: 'Copper winding on a permalloy core', mass: 2.5, temp: 293, explode: ex,
    desc: `An electromagnet that pushes against the Earth's magnetic field for fine momentum control, ${where}. At 20,180 km the field is about 70 times weaker than at the surface (it falls as 1/r³), so the torques are tiny (one rod per axis; count, size and position estimated).`,
  }, rodMesh(a, b)); };
  torque('Magnetic torque rod (X)', [0.56, 0.3, 1.4], [1.12, 0.3, 1.4], [0.75, 0, 0.3], 'high in the +X bay');
  torque('Magnetic torque rod (Y)', [1.03, -0.3, 1.53], [1.03, 0.3, 1.53], [0.85, 0, 0.35], 'under the Earth deck in the +X bay');
  // on the +X bay face of the +X/+Y shear web (web face at y = 0.475; end caps r 0.026 seat against it), inboard of the tank struts
  torque('Magnetic torque rod (Z)', [0.64, 0.449, -1.1], [0.64, 0.449, -0.5], [0.8, 0.1, 0], 'on the +X/+Y shear web');

  // ------------------------------------------------------------------ bus avionics (TT&C subsystem)
  box('On-board computer', {
    system: 'Avionics', material: 'Radiation-hardened PowerPC processors in an aluminium chassis (Honeywell)', mass: 18, temp: 300, explode: [0, -1.1, 0.05],
    desc: 'The bus computer ("OBC"), with redundant processors used in every phase from launch and transfer orbit to disposal. Honeywell described it as the first radiation-hardened high-speed processor based on PowerPC; its flight software runs attitude, power and thermal control, talking to the units over the bus MIL-STD-1553B data bus.',
  }, onBUS([0.62, 1.44], 0.16), [0.32, 0.16, 0.26], G.alodine(), { mount: '-y', conn: '+y', n: 5, fins: 5 }, 'bus', true);
  const RIU = [0.26, 0.12, 0.2];
  box('Remote interface unit (A)', {
    system: 'Avionics', material: 'Aluminium chassis', mass: 8, temp: 298, explode: [0, -1.1, 0],
    desc: 'One of the two remote interface units on the bus panel ("RIU (2)"). It gathers temperatures, pressures, currents and switch states from the units around it and distributes commands, so the computer does not need a dedicated wire to every sensor.',
  }, onBUS([-0.95, 0.92], RIU[1]), RIU, G.alodine(), { mount: '-y', conn: '+y', n: 4 }, 'bus');
  box('Remote interface unit (B)', {
    system: 'Avionics', material: 'Aluminium chassis', mass: 8, temp: 298, explode: [0, -1.1, 0],
    desc: 'The second bus-panel interface unit; between them the two RIUs read the thermistors, the propulsion pressure transducers and the wheel and array telemetry.',
  }, onBUS([0.8, 0.3], RIU[1]), RIU, G.alodine(), { mount: '-y', conn: '+y', n: 4 }, 'bus');
  box('Remote interface unit (NPE panel)', {
    system: 'Avionics', material: 'Aluminium chassis', mass: 8, temp: 298, explode: [0, 1.1, 0],
    desc: 'A third remote interface unit, low on the navigation payload panel beside the TFU (Fig. 4 colours it as a TT&C unit), serving the clocks, transmitters and payload heaters.',
  }, onNPE([0.86, -0.92], RIU[1]), RIU, G.alodine(), { mount: '+y', conn: '-y', n: 4 }, 'npe');
  box('TFU (bus panel)', {
    system: 'Avionics', material: 'Aluminium chassis', mass: 4, temp: 298, explode: [0, -1.1, 0],
    desc: 'The bus panel\'s "TFU", one of two in Lockheed\'s figure (the other is on the NPE panel). The source does not expand the acronym or describe the unit (size estimated).',
  }, onBUS([-0.55, 0.92], 0.12), [0.2, 0.12, 0.15], G.alodine(), { mount: '-y', conn: '+y', n: 2 }, 'bus');

  return { rotors };
}

export { HZ, IY };
