// Deployable and external hardware: the two SA3 rigid solar-array wings on their drives, the two
// high-gain antennas on deployable masts, the low-gain antennas, the magnetic torquer bars,
// magnetometers and coarse sun sensors.
//
// SA3 wings (2002): 7.1 × 2.6 m each (NASA), gallium-arsenide cells, about 5 kW together.
// The arrays sit on the ±V2 (±z) sides of the forward shell; the high-gain antenna masts on the
// ±V3 (±y) sides. Mast lengths and dish size are estimates from photographs.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { rod, lathe, mergeGeometries } from '../../engine/geometry.js';
import { RAD, ST, az, deg, ni } from './layout.js';
import { HM } from './materials.js';

const merge = (list) => mergeGeometries(list.map(ni));

export const SA = { x: 6.3, rDrive: RAD.shell, mast: 0.75, wing: 7.1, width: 2.6 };
export const HGA = { x: 6.95, mast: 3.3, dish: 0.65 };

export function buildAppendages(P) {
  const out = { arrays: [], hgas: [] };

  // ------------------------------------------------------------------ solar arrays (±z)
  for (const s of [1, -1]) {
    const side = s > 0 ? '+V2' : '−V2';
    // drive housing fixed to the forward shell
    const drive = [new THREE.CylinderGeometry(0.2, 0.24, 0.22, 24).rotateX(Math.PI / 2).translate(SA.x, 0, s * (SA.rDrive + 0.1))];
    drive.push(new THREE.BoxGeometry(0.62, 0.38, 0.1).translate(SA.x, 0, s * (SA.rDrive + 0.03)));
    const pivot = new THREE.Group();
    pivot.position.set(SA.x, 0, s * (SA.rDrive + 0.2));
    const mastGeo = [rod([0, 0, 0], [0, 0, s * SA.mast], 0.07, 16), new THREE.CylinderGeometry(0.13, 0.13, 0.12, 20).rotateX(Math.PI / 2).translate(0, 0, s * 0.06)];
    pivot.add(mesh(merge(mastGeo), HM.al()));
    const dp = P(`Solar array drive & mast (${side})`, {
      system: 'Power', material: 'Stepper-motor drive with slip rings, aluminium mast', mass: 55, temp: 280, explode: [0, 0, s * 1.0],
      desc: 'Turns its wing through a full rotation about the mast so the cells face the Sun wherever the telescope points; slip rings carry the power across the rotating joint. A deployment hinge at the root swings the mast out from its stowed position.',
    }, [mesh(merge(drive), HM.al()), pivot]);

    // the wing: two halves, the outer folding back over the inner when stowed
    const wingRoot = new THREE.Group();
    wingRoot.position.set(0, 0, s * SA.mast);
    pivot.add(wingRoot);
    const half = SA.wing / 2;
    const panel = (z0) => {
      const g = new THREE.BoxGeometry(SA.width, 0.035, half - 0.04);
      g.translate(0, 0, s * (z0 + half / 2));
      return g;
    };
    const frame = (z0) => {
      const f = [];
      const z1 = z0 + half - 0.04;
      for (const x of [-SA.width / 2, 0, SA.width / 2]) f.push(rod([x, 0.03, s * z0], [x, 0.03, s * z1], 0.022, 6));
      for (const z of [z0, (z0 + z1) / 2, z1]) f.push(rod([-SA.width / 2, 0.03, s * z], [SA.width / 2, 0.03, s * z], 0.018, 6));
      return f;
    };
    const mats = [HM.sa3Back(), HM.sa3Back(), HM.sa3Cells(), HM.sa3Back(), HM.sa3Back(), HM.sa3Back()];
    const inner = new THREE.Group();
    inner.add(mesh(panel(0.04), mats), mesh(merge(frame(0.04)), HM.al()));
    const hingeG = new THREE.Group();
    hingeG.position.set(0, 0.04, s * (half + 0.02));
    const outer = new THREE.Group();
    outer.position.set(0, -0.04, -s * (half + 0.02));
    outer.add(mesh(panel(half + 0.04), mats), mesh(merge(frame(half + 0.04)), HM.al()));
    hingeG.add(outer);
    inner.add(hingeG, mesh(rod([-SA.width / 2 + 0.1, 0.04, s * (half + 0.02)], [SA.width / 2 - 0.1, 0.04, s * (half + 0.02)], 0.03, 10), HM.ti()));
    const track = new THREE.Group();          // sun-tracking rotation about the mast axis
    track.add(inner);
    wingRoot.add(track);
    const wp = P(`Solar array wing (${side})`, {
      system: 'Power', material: 'Gallium-arsenide cells on rigid aluminium-honeycomb panels (Iridium-derived)', mass: 230, temp: 330,
      explode: [0, 0, s * 1.6], count: 4,
      desc: 'The third set of arrays, fitted in 2002: 7.1 × 2.6 m, rigid instead of the roll-up blankets that flexed and jittered the telescope as they crossed between sunlight and shadow. A third smaller than the old wings yet about 20 % more powerful; together roughly 5 kW. Fold scheme simplified.',
      callout: s > 0, anchor: [0.3, 0.4, s * 5.0],
    }, track);
    wp.userData.part.thermalRole = 'array';
    // re-parent: the wing part must sit inside the rotating mast so it follows deployment
    wingRoot.add(wp);
    out.arrays.push({ s, pivot, hinge: hingeG, track, drivePart: dp, wingPart: wp });
  }

  // ------------------------------------------------------------------ high-gain antennas (±y)
  const dishProfile = Array.from({ length: 14 }, (_, i) => { const r = (i / 13) * HGA.dish; return [r, (r * r) / (4 * 0.42)]; });
  for (const s of [1, -1]) {
    const side = s > 0 ? '+V3' : '−V3';
    const base = [new THREE.BoxGeometry(0.5, 0.12, 0.34).translate(HGA.x, s * (RAD.shell + 0.05), 0)];
    base.push(new THREE.CylinderGeometry(0.08, 0.08, 0.42, 16).rotateX(Math.PI / 2).translate(HGA.x, s * (RAD.shell + 0.14), 0));
    const pivot = new THREE.Group();
    pivot.position.set(HGA.x, s * (RAD.shell + 0.14), 0);
    pivot.add(mesh(merge([rod([0, 0, 0], [0, s * HGA.mast, 0], 0.065, 16), rod([0, s * 0.1, 0.0], [0.0, s * 0.1, 0.0], 0.1, 16)]), HM.al()));
    const mp = P(`High-gain antenna mast (${side})`, {
      system: 'Communications', material: 'Aluminium/graphite boom with root deployment hinge, waveguide and cabling', mass: 30, temp: 255, explode: [0, s * 4.4, 0],
      desc: 'Holds its antenna clear of the telescope so the dish can see a TDRS relay over most of the sky. Folded flat along the forward shell for launch, it swung out 90° after release in 1990. Length estimated.',
    }, [mesh(merge(base), HM.al()), pivot]);
    const tip = new THREE.Group();
    tip.position.set(0, s * HGA.mast, 0);
    pivot.add(tip);
    const gimbal = new THREE.Group();
    tip.add(gimbal);
    const g2 = new THREE.Group();              // elevation axis
    gimbal.add(g2);
    const dish = lathe(dishProfile, 48);
    if (s < 0) dish.rotateZ(Math.PI);
    dish.translate(0, s * 0.3, 0);
    const back = [];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      back.push(rod([0, s * 0.27, 0], [Math.cos(a) * HGA.dish * 0.92, s * (0.3 + (HGA.dish * 0.92) ** 2 / 1.68 - 0.02), Math.sin(a) * HGA.dish * 0.92], 0.012, 5));
    }
    const feed = [new THREE.CylinderGeometry(0.05, 0.08, 0.16, 16).translate(0, s * (0.3 + 0.38), 0)];
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.4;
      feed.push(rod([Math.cos(a) * HGA.dish * 0.85, s * (0.3 + (HGA.dish * 0.85) ** 2 / 1.68), Math.sin(a) * HGA.dish * 0.85], [0, s * (0.3 + 0.36), 0], 0.01, 5));
    }
    const gim = [new THREE.BoxGeometry(0.22, 0.2, 0.22).translate(0, s * 0.1, 0), new THREE.CylinderGeometry(0.07, 0.07, 0.34, 14).rotateZ(Math.PI / 2).translate(0, s * 0.22, 0)];
    g2.add(mesh(dish, HM.dish()), mesh(merge(back), HM.grEp()), mesh(merge(feed), HM.al()));
    gimbal.add(mesh(merge(gim), HM.box()));
    const hp = P(`High-gain antenna (${side})`, {
      system: 'Communications', material: 'Parabolic graphite-epoxy reflector, S-band feed, two-axis gimbal', mass: 42, temp: 250,
      explode: [0, s * 0.8, 0],
      desc: 'Steerable dish (≈1.3 m, estimated) that sends science data to NASA\'s Tracking and Data Relay Satellites 36,000 km up, which relay it to White Sands. The two-axis gimbal tracks the relay satellite as Hubble circles the Earth.',
      callout: s > 0, anchor: [0.4, s * 0.5, 0.4],
    }, gimbal);
    tip.add(hp);
    out.hgas.push({ s, pivot, gimbal, g2, mastPart: mp, dishPart: hp });
  }

  // ------------------------------------------------------------------ low-gain antennas
  const lga = (dir) => {
    const g = [new THREE.CylinderGeometry(0.035, 0.035, 0.32, 10).translate(0, 0.16, 0), new THREE.ConeGeometry(0.11, 0.24, 20, 1, true).translate(0, 0.42, 0), new THREE.CylinderGeometry(0.11, 0.11, 0.02, 20).translate(0, 0.31, 0)];
    const m = merge(g);
    if (dir > 0) m.rotateZ(-Math.PI / 2); else m.rotateZ(Math.PI / 2);
    return m;
  };
  const fwd = lga(1).translate(ST.front - 0.12, ...az(deg(200), RAD.shell + 0.2).slice(1));
  P('Low-gain antenna (forward)', {
    system: 'Communications', material: 'Conical spiral antenna on a bracket', mass: 4, temp: 245, explode: [1.6, -0.6, 0],
    desc: 'One of two near-omnidirectional antennas, this one looking forward along the optical axis. They receive every command sent to Hubble and keep a link alive if the telescope loses attitude.',
  }, [mesh(fwd, HM.dish()), mesh(new THREE.BoxGeometry(0.4, 0.06, 0.12).translate(ST.front - 0.25, ...az(deg(200), RAD.shell + 0.1).slice(1)).rotateX(0), HM.al())]);
  const aft = lga(-1).translate(-0.02, ...az(deg(270), 1.75).slice(1));
  P('Low-gain antenna (aft)', {
    system: 'Communications', material: 'Conical spiral antenna', mass: 4, temp: 255, explode: [-3.8, 0, -0.6],
    desc: 'The aft-looking twin on the aft bulkhead; between them the two cover nearly the whole sky at low data rates through the multiple-access transponders.',
  }, mesh(aft, HM.dish()));

  // ------------------------------------------------------------------ magnetic torquer bars (light shield)
  for (const [n, c] of [[1, 45], [2, 135], [3, 225], [4, 315]]) {
    const p = deg(c);
    const bar = [rod(az(p, RAD.shell + 0.16, 9.65), az(p, RAD.shell + 0.16, 12.15), 0.06, 16)];
    for (const x of [9.75, 12.05]) bar.push(new THREE.BoxGeometry(0.14, 0.18, 0.18).translate(0, RAD.shell + 0.1, 0).rotateX(p).translate(x, 0, 0));
    for (const x of [9.65, 12.15]) bar.push(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 16).rotateZ(Math.PI / 2).translate(x, 0, 0).translate(0, ...az(p, RAD.shell + 0.16).slice(1)));
    P(`Magnetic torquer bar ${n}`, {
      system: 'Attitude control', material: 'Permalloy-core electromagnet, about 2.5 m long, under a protective cover', mass: 25, temp: 250,
      explode: az(p, 0.9, 0.6), desc: 'Pushes against the Earth\'s magnetic field to bleed off momentum the reaction wheels build up from gravity-gradient and aerodynamic torques — Hubble carries no thrusters. Two of the four have redundant windings that failed and were covered with new electronics in 1999.',
      callout: n === 1, anchor: az(p, RAD.shell + 0.3, 10.9),
    }, mesh(merge(bar), HM.mtb()));
  }

  // ------------------------------------------------------------------ magnetometers and coarse sun sensors
  const mss = [];
  for (const c of [70, 290]) {
    const p = deg(c);
    mss.push(rod(az(p, RAD.shell, 12.6), az(p, RAD.shell + 0.3, 12.6), 0.02, 8));
    mss.push(new THREE.BoxGeometry(0.14, 0.12, 0.12).translate(0, RAD.shell + 0.36, 0).rotateX(p).translate(12.6, 0, 0));
  }
  P('Magnetometers', {
    system: 'Attitude control', material: 'Two three-axis fluxgate magnetic sensing systems', mass: 6, count: 2, temp: 245, explode: [1.4, 0.3, 0],
    desc: 'Measure the strength and direction of the Earth\'s field so the torquer bars can be driven in the right direction. Mounted near the front of the light shield, away from the electronics.',
  }, mesh(merge(mss), HM.iridite()));
  const css = [];
  for (const [x, r, c] of [[ST.front - 0.2, RAD.shell, 110], [ST.front - 0.2, RAD.shell, 250], [0.6, RAD.big, 75], [0.6, RAD.big, 285]]) {
    const p = deg(c);
    css.push(new THREE.CylinderGeometry(0.07, 0.08, 0.06, 16).translate(0, r + 0.03, 0).rotateX(p).translate(x, 0, 0));
    css.push(new THREE.SphereGeometry(0.05, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, r + 0.06, 0).rotateX(p).translate(x, 0, 0));
  }
  P('Coarse sun sensors', {
    system: 'Attitude control', material: 'Silicon photodiode sensors', mass: 4, count: 4, temp: 260, explode: [0, 0, 0],
    desc: 'Four simple sensors that always know roughly where the Sun is: they guide the safe mode that turns the arrays to the Sun, and they trigger the aperture door to close if sunlight threatens the optics.',
  }, mesh(merge(css), HM.box()));

  return out;
}
