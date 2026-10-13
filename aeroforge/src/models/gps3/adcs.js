// GPS III attitude determination and control, and the bus avionics: four reaction wheels in a
// pyramid, infrared Earth sensors and Sun sensors for nadir pointing and yaw steering, an inertial
// reference unit, the spacecraft control processor and its remote interface units.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { G } from './materials.js';
import { HX, HY, HZ, IX, IY, IZ, boxG, cylG, merge, unit } from './kit.js';
import { DECK } from './payload.js';

export function buildADCS(P) {
  // ------------------------------------------------------------------ reaction wheels (aft deck corners, spin axes tilted 40° outward)
  const rotors = [];
  const tilt = THREE.MathUtils.degToRad(40);
  [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(([sx, sy], k) => {
    const c = new THREE.Vector3(sx * 0.64, sy * 0.66, -1.05);
    const out = new THREE.Vector3(sx, sy, 0).normalize();
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
    const ped = mesh(cylG([c.x, c.y, (-IZ + c.z) / 2 - 0.02], 0.055, Math.abs(-IZ - c.z) - 0.02, 'z', 16), G.aluminium());
    P(`Reaction wheel ${k + 1}`, {
      system: 'Attitude control', material: 'Steel flywheel on ball bearings, sealed aluminium housing', mass: 13, temp: 295,
      explode: [sx * 0.45, sy * 0.45, -0.9],
      desc: k === 0
        ? 'Four wheels in a pyramid, spin axes tilted 40° (count and geometry estimated from A2100 practice): any three give full three-axis control. Speeding a wheel up turns the spacecraft the other way — angular momentum is conserved — so pointing costs electricity, not propellant.'
        : 'One of the four reaction wheels. Steady torques (mostly solar pressure) slowly spin the wheels up; thrusters periodically dump that stored momentum.',
      callout: k === 0, anchor: [c.x, c.y, c.z + 0.12],
    }, [g, ped]);
  });

  // ------------------------------------------------------------------ Earth sensors (Earth deck)
  const earthSensor = (name, x, y) => {
    const z0 = DECK;
    const body = merge([boxG([x, y, z0 + 0.06], [0.16, 0.14, 0.1]), boxG([x, y, z0 + 0.005], [0.2, 0.18, 0.01])]);
    const lens = merge([cylG([x - 0.035, y, z0 + 0.118], 0.03, 0.016, 'z', 20), cylG([x + 0.035, y, z0 + 0.118], 0.03, 0.016, 'z', 20)]);
    const hood = merge([cylG([x - 0.035, y, z0 + 0.14], 0.04, 0.03, 'z', 20, 0.046, true), cylG([x + 0.035, y, z0 + 0.14], 0.04, 0.03, 'z', 20, 0.046, true)]);
    return P(name, {
      system: 'Attitude control', material: 'Germanium optics, thermopile detector arrays', mass: 4, temp: 265, explode: [0, 0, 1.9],
      desc: 'Infrared horizon sensor: it sees the Earth\'s 14–16 µm carbon-dioxide glow, which looks the same by day and night, and measures where the 27.8°-wide disc sits in its field to keep the antennas on nadir (sensor type and placement estimated).',
    }, [mesh(body, G.blackBox()), mesh(lens, G.lens()), mesh(hood, G.darkMetal())]);
  };
  earthSensor('Earth sensor (A)', -0.74, 0.62);
  earthSensor('Earth sensor (B)', 0.5, -0.8);

  // ------------------------------------------------------------------ Sun sensors
  const heads = [];
  const sh = (x, y, z, n) => {
    const d = new THREE.Vector3(...n).normalize();
    const g = new THREE.BoxGeometry(0.05, 0.05, 0.025);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d));
    heads.push(g.translate(x, y, z));
  };
  sh(HX + 0.027, 0.3, HZ - 0.12, [1, 0, 0.6]); sh(HX + 0.027, -0.3, HZ - 0.12, [1, 0, 0.6]);
  sh(-HX - 0.027, 0.3, HZ - 0.12, [-1, 0, 0.6]); sh(-HX - 0.027, -0.3, HZ - 0.12, [-1, 0, 0.6]);
  sh(HX + 0.027, 0, -HZ + 0.12, [1, 0, -0.6]); sh(-HX - 0.027, 0, -HZ + 0.12, [-1, 0, -0.6]);
  P('Sun sensors', {
    system: 'Attitude control', material: 'Silicon photocells behind cover glass', mass: 2.4, count: 6, temp: 290, explode: [0, 0, 0.3],
    desc: 'Sun sensors on the ±X faces tell the yaw-steering law where the Sun is. GPS satellites rotate slowly about their Earth-pointing axis all orbit long so the arrays\' rotation axis stays perpendicular to the sunlight (count and positions estimated).',
  }, mesh(merge(heads), G.lens()));

  // ------------------------------------------------------------------ avionics
  P('Inertial reference unit', {
    system: 'Attitude control', material: 'Gyroscopes in an aluminium housing', mass: 9, temp: 295, explode: [-0.5, -0.5, 1.0],
    desc: 'Gyroscopes that measure the spacecraft\'s rotation rates between sensor updates, essential during apogee burns and eclipses when the Earth and Sun sensors are not enough on their own (gyro type not published).',
  }, unit([-0.7, -0.42, IZ - 0.07], [0.16, 0.16, 0.14], G.blackBox(), { mount: '+z', conn: '+x', n: 2 }));
  P('Spacecraft control processor', {
    system: 'Avionics', material: 'Radiation-hardened computer in an aluminium chassis', mass: 18, temp: 300, explode: [0, -1.2, 0],
    desc: 'The bus flight computer: it runs attitude control and yaw steering, power and thermal management, executes stored commands and watches for faults, switching to redundant units on its own if one fails.',
  }, unit([-0.4, -(IY - 0.08), 0.16], [0.32, 0.16, 0.24], G.alodine(), { mount: '-y', conn: '+z', n: 5 }));
  P('Remote interface unit (A)', {
    system: 'Avionics', material: 'Aluminium chassis', mass: 9, temp: 298, explode: [1.1, 0, 0],
    desc: 'Collects temperatures, pressures, currents and switch states from the units around it and distributes commands, so the computer does not need a dedicated wire to every sensor.',
  }, unit([IX - 0.06, 0.45, 0.4], [0.12, 0.26, 0.2], G.alodine(), { mount: '+x', conn: '+z', n: 4 }));
  P('Remote interface unit (B)', {
    system: 'Avionics', material: 'Aluminium chassis', mass: 9, temp: 290, explode: [-1.1, 0, 0],
    desc: 'The redundant interface unit on the shadow side; it also reads the propulsion pressure transducers on the pressurant panel below it.',
  }, unit([-(IX - 0.06), 0.45, 0.4], [0.12, 0.26, 0.2], G.alodine(), { mount: '-x', conn: '+z', n: 4 }));
  P('Wheel & thruster drive electronics', {
    system: 'Avionics', material: 'Aluminium chassis', mass: 11, temp: 300, explode: [1.1, 0, 0],
    desc: 'Power electronics that drive the four wheel motors and open the thruster valves for milliseconds at a time on the processor\'s command.',
  }, unit([IX - 0.06, -0.45, 0.4], [0.12, 0.3, 0.22], G.alodine(), { mount: '+x', conn: '+z', n: 4 }));

  return { rotors };
}

export { HY };
