// GPS III attitude control subsystem and bus avionics. The ACS sensors and actuators listed for GPS
// III are coarse sun sensors, Earth sensors, an inertial measurement unit, reaction wheels, magnetic
// torque rods and thrusters (Marquis & Shaw, InsideGNSS 2011); Honeywell supplies the on-board
// computer, reaction wheel assembly and inertial measurement unit. Counts, positions and sizes not
// in those sources are estimates.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { G } from './materials.js';
import { HX, HZ, IX, IY, IZ, DECK, boxG, cylG, merge, unit, connPoint } from './kit.js';
import { HARNESS } from './payload.js';

export const WHEELS = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([sx, sy]) => [sx * 0.6, sy * 0.93, -1.17]);

export function buildADCS(P) {
  const box = (name, info, c, s, mat, opts) => { HARNESS.push(connPoint(c, s, opts.conn, 0.04)); return P(name, info, unit(c, s, mat, opts)); };

  // ------------------------------------------------------------------ reaction wheels (aft-deck corners, spin axes tilted 40° outward)
  const rotors = [];
  const tilt = THREE.MathUtils.degToRad(40);
  WHEELS.forEach(([x, y, z], k) => {
    const c = new THREE.Vector3(x, y, z);
    const out = new THREE.Vector3(Math.sign(x), Math.sign(y), 0).normalize();
    const axis = new THREE.Vector3().copy(out).multiplyScalar(Math.sin(tilt)).setZ(Math.cos(tilt));
    const g = new THREE.Group();
    g.position.copy(c);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
    const housing = mesh(merge([
      new THREE.CylinderGeometry(0.15, 0.15, 0.1, 36), new THREE.CylinderGeometry(0.06, 0.08, 0.03, 20).translate(0, 0.065, 0),
      new THREE.CylinderGeometry(0.17, 0.17, 0.012, 36).translate(0, -0.056, 0),
    ]), G.gunmetal());
    const rotor = new THREE.Group();
    const rim = mesh(merge([new THREE.CylinderGeometry(0.13, 0.13, 0.06, 32, 1, true), new THREE.CylinderGeometry(0.035, 0.035, 0.07, 12)]), G.silverBox());
    const mark = mesh(boxG([0.1, 0, 0], [0.05, 0.062, 0.02]), G.alodine());
    rotor.add(rim, mark);
    g.add(housing, rotor);
    rotors.push(rotor);
    const ped = mesh(merge([cylG([x, y, (-IZ + z) / 2 - 0.02], 0.055, Math.abs(-IZ - z) - 0.02, 'z', 16), cylG([x, y, -IZ + 0.006], 0.09, 0.012, 'z', 20)]), G.aluminium());
    P(`Reaction wheel ${k + 1}`, {
      system: 'Attitude control', material: 'Steel flywheel on ball bearings, sealed housing (Honeywell)', mass: 13, temp: 295,
      explode: [Math.sign(x) * 0.45, Math.sign(y) * 0.45, -0.9],
      desc: k === 0
        ? 'Part of Honeywell\'s reaction wheel assembly. Four wheels in a pyramid with spin axes tilted 40° (count and geometry estimated from A2100 practice): any three give full three-axis control. Speeding a wheel up turns the spacecraft the other way, because angular momentum is conserved, so pointing costs electricity, not propellant.'
        : 'One of the four reaction wheels. Steady torques, mostly from sunlight pressure, slowly spin the wheels up; thrusters periodically dump that stored momentum.',
    }, [g, ped]);
  });
  box('Reaction wheel drive electronics', {
    system: 'Attitude control', material: 'Aluminium chassis', mass: 9, temp: 300, explode: [1.1, 0, 0],
    desc: 'Power electronics that drive the four wheel motors and report their speeds to the on-board computer, which commands torque many times a second (unit split and position estimated).',
  }, [IX - 0.06, -0.55, 0.5], [0.12, 0.3, 0.22], G.alodine(), { mount: '+x', conn: '+z', n: 4 });

  // ------------------------------------------------------------------ Earth sensors (Earth deck)
  const earthSensor = (name, x, y) => {
    const z0 = DECK;
    const body = merge([boxG([x, y, z0 + 0.06], [0.16, 0.14, 0.1]), boxG([x, y, z0 + 0.005], [0.2, 0.18, 0.01])]);
    const lens = merge([cylG([x - 0.035, y, z0 + 0.118], 0.03, 0.016, 'z', 20), cylG([x + 0.035, y, z0 + 0.118], 0.03, 0.016, 'z', 20)]);
    const hood = merge([cylG([x - 0.035, y, z0 + 0.14], 0.04, 0.03, 'z', 20, 0.046, true), cylG([x + 0.035, y, z0 + 0.14], 0.04, 0.03, 'z', 20, 0.046, true)]);
    return P(name, {
      system: 'Attitude control', material: 'Germanium optics, thermopile detector arrays', mass: 4, temp: 265, explode: [0, 0, 1.9],
      desc: 'Infrared Earth sensor: it sees the Earth\'s 14–16 µm carbon-dioxide glow, which looks the same by day and night, and measures where the 27.8°-wide disc sits in its field to keep the antennas on nadir (sensor type, count and placement estimated).',
    }, [mesh(body, G.blackBox()), mesh(lens, G.lens()), mesh(hood, G.darkMetal())]);
  };
  earthSensor('Earth sensor (A)', 0.62, 1.02);
  earthSensor('Earth sensor (B)', 0.62, -1.02);

  // ------------------------------------------------------------------ coarse sun sensors
  const heads = [];
  const sh = (x, y, z, n) => {
    const d = new THREE.Vector3(...n).normalize();
    const g = new THREE.BoxGeometry(0.05, 0.05, 0.025);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d));
    heads.push(g.translate(x, y, z));
  };
  for (const sx of [1, -1]) for (const sy of [1, -1]) {
    sh(sx * (HX + 0.027), sy * 0.95, HZ - 0.12, [sx, 0, 0.6]);
    sh(sx * (HX + 0.027), sy * 0.95, -HZ + 0.12, [sx, 0, -0.6]);
  }
  P('Coarse sun sensors', {
    system: 'Attitude control', material: 'Silicon photocells behind cover glass', mass: 2.4, count: 8, temp: 290, explode: [0, 0, 0.3],
    desc: 'Simple photocells on the ±X corners that together see the whole sky, telling the yaw-steering law where the Sun is. GPS satellites rotate slowly about their Earth-pointing axis all orbit long so the arrays\' rotation axis stays perpendicular to the sunlight (count and positions estimated).',
  }, mesh(merge(heads), G.lens()));

  // ------------------------------------------------------------------ IMU, torque rods
  box('Inertial measurement unit', {
    system: 'Attitude control', material: 'Fibre-optic gyroscopes in an aluminium housing (Honeywell)', mass: 9, temp: 295, explode: [0.5, -0.5, 1.0],
    desc: 'Honeywell\'s IMU measures the spacecraft\'s rotation with fibre-optic gyroscopes: light sent both ways round a coil of fibre returns slightly out of step when the coil turns (the Sagnac effect). It carries attitude through apogee burns and eclipses, between Earth- and Sun-sensor updates.',
  }, [0.55, -0.75, IZ - 0.07], [0.16, 0.16, 0.14], G.blackBox(), { mount: '+z', conn: '+x', n: 2 });
  const rodMesh = (a, b) => {
    const ax = ['x', 'y', 'z'][[0, 1, 2].find((i) => Math.abs(a[i] - b[i]) > 1e-6)];
    const c = a.map((v, i) => (v + b[i]) / 2), L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const g = [cylG(c, 0.018, L, ax, 12)];
    for (const e of [a, b]) g.push(cylG(e, 0.026, 0.04, ax, 12));
    for (const t of [0.25, 0.75]) g.push(boxG(a.map((v, i) => v + (b[i] - v) * t), ax === 'z' ? [0.03, 0.05, 0.03] : ax === 'x' ? [0.03, 0.03, 0.05] : [0.05, 0.03, 0.03]));
    return mesh(merge(g), G.darkMetal());
  };
  const torque = (name, a, b, ex) => P(name, {
    system: 'Attitude control', material: 'Copper winding on a permalloy core', mass: 2.5, temp: 293, explode: ex,
    desc: 'An electromagnet that pushes against the Earth\'s magnetic field to make fine adjustments to the spacecraft\'s momentum. At 20,180 km the field is about 70 times weaker than at the surface (it falls as 1/r³), so the torques are tiny (one per axis modelled; count and size estimated).',
  }, rodMesh(a, b));
  torque('Magnetic torque rod (X)', [-0.65, 0.72, IZ - 0.04], [-0.15, 0.72, IZ - 0.04], [0, 0.4, 0.8]);
  torque('Magnetic torque rod (Y)', [-0.7, -0.7, IZ - 0.04], [-0.7, -0.2, IZ - 0.04], [-0.4, 0, 0.8]);
  torque('Magnetic torque rod (Z)', [IX - 0.07, 0.55, -0.55], [IX - 0.07, 0.55, 0.05], [0.9, 0, 0]);

  // ------------------------------------------------------------------ bus avionics (TT&C subsystem)
  box('On-board computer', {
    system: 'Avionics', material: 'Radiation-hardened PowerPC processors in an aluminium chassis (Honeywell)', mass: 18, temp: 300, explode: [0, -1.2, 0],
    desc: 'The bus computer, with redundant processors used in every phase from launch and transfer orbit to disposal. Honeywell described it as the first radiation-hardened high-speed processor based on PowerPC; its flight software runs attitude, power and thermal control.',
  }, [-0.42, -(IY - 0.08), 0.45], [0.32, 0.16, 0.26], G.alodine(), { mount: '-y', conn: '+y', n: 5 });
  box('Remote interface unit (A)', {
    system: 'Avionics', material: 'Aluminium chassis', mass: 9, temp: 298, explode: [1.1, 0, 0],
    desc: 'Collects temperatures, pressures, currents and switch states from the units around it and distributes commands, so the computer does not need a dedicated wire to every sensor.',
  }, [IX - 0.06, 0.55, 0.5], [0.12, 0.26, 0.2], G.alodine(), { mount: '+x', conn: '+z', n: 4 });
  box('Remote interface unit (B)', {
    system: 'Avionics', material: 'Aluminium chassis', mass: 9, temp: 290, explode: [-1.1, 0, 0],
    desc: 'The second interface unit, on the shadow side; it also reads the pressure transducers on the pressurant control panel below it.',
  }, [-(IX - 0.06), 0.55, 0.5], [0.12, 0.26, 0.2], G.alodine(), { mount: '-x', conn: '+z', n: 4 });

  return { rotors };
}
