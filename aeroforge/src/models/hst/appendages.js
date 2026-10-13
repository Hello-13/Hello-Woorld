// Deployable and external hardware: the two SA3 rigid solar-array wings on their drives, the two
// high-gain antennas on deployable masts, the low-gain antennas, the magnetic torquer bars,
// magnetometers and coarse sun sensors.
//
// SA3 wings (2002): 7.1 × 2.6 m and 640 lb (290 kg) each (SM4 Media Guide Fig. 5-25), four
// Iridium-derived gallium-arsenide panels per wing on an aluminium-lithium frame, 5,270 W together.
// The arrays sit on the ±V2 sides of the forward shell (−V2 = +z), the high-gain antenna masts on
// the ±V3 (±y) sides; the four torquer bars ride on the forward shell at 90° intervals and the
// magnetometers and two of the five coarse sun sensors on the light shield (SM3A Media Guide §5.1).
// Mast lengths and dish size are estimates from photographs.

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
    const side = s > 0 ? '−V2' : '+V2';
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
    // root yoke: a hub on the mast tip and a spreader beam carrying the inner panel's root edge
    const yoke = [new THREE.CylinderGeometry(0.1, 0.1, 0.14, 20).rotateX(Math.PI / 2).translate(0, 0, s * 0.0)];
    yoke.push(new THREE.BoxGeometry(SA.width - 0.1, 0.06, 0.07).translate(0, 0.03, s * 0.045));
    for (const x of [-1, 1]) yoke.push(rod([0, 0.02, s * 0.03], [x * (SA.width / 2 - 0.15), 0.03, s * 0.06], 0.025, 6));
    inner.add(mesh(panel(0.04), mats), mesh(merge(frame(0.04)), HM.al()), mesh(merge(yoke), HM.ti()));
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
      system: 'Power', material: 'Gallium-arsenide cells on four Iridium-derived rigid panels per wing, aluminium-lithium frame', mass: 290, massSource: 'NASA SM4 Media Guide (640 lb per wing)', temp: 330,
      explode: [0, 0, s * 1.6],
      desc: 'The third set of arrays (SA3), fitted in 2002: 7.1 × 2.6 m, rigid instead of the roll-up blankets that flexed and jittered the telescope as they crossed between sunlight and shadow. Smaller than the old wings yet about 30 % more powerful: ≈ 5.3 kW together (5,270 W predicted at 6 years). Fold scheme in the deploy demo simplified.',
      callout: s > 0, anchor: [0.3, 0.4, s * 5.0],
    }, track, wingRoot);
    wp.userData.part.thermalRole = 'array';
    out.arrays.push({ s, pivot, hinge: hingeG, track, drivePart: dp, wingPart: wp });
  }

  // ------------------------------------------------------------------ high-gain antennas (±y)
  const dishProfile = Array.from({ length: 24 }, (_, i) => { const r = (i / 23) * HGA.dish; return [r, (r * r) / (4 * 0.42)]; });
  for (const s of [1, -1]) {
    const side = s > 0 ? '+V3' : '−V3';
    const base = [new THREE.BoxGeometry(0.5, 0.12, 0.34).translate(HGA.x, s * (RAD.shell + 0.05), 0)];
    base.push(new THREE.CylinderGeometry(0.08, 0.08, 0.42, 16).rotateX(Math.PI / 2).translate(HGA.x, s * (RAD.shell + 0.14), 0));
    const pivot = new THREE.Group();
    pivot.position.set(HGA.x, s * (RAD.shell + 0.14), 0);
    pivot.add(mesh(merge([rod([0, 0, 0], [0, s * HGA.mast, 0], 0.065, 16), new THREE.CylinderGeometry(0.11, 0.11, 0.2, 16).rotateX(Math.PI / 2)]), HM.al()));
    const mp = P(`High-gain antenna mast (${side})`, {
      system: 'Communications', material: 'Aluminium/graphite boom with root deployment hinge, waveguide and cabling', mass: 30, temp: 255, explode: [2.5, s * 2.0, 0],
      desc: 'Holds its antenna clear of the telescope so the dish can see a TDRS relay over most of the sky. Latched flat along the forward shell and light shield for launch, it was swung out 90° by its hinge drive after release in 1990. Length estimated.',
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
    // eight ribs following the back of the reflector, 2.5 cm behind its surface
    const back = [];
    const backY = (r) => s * (0.3 + (r * r) / 1.68 - 0.025);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const rs = [0.05, 0.2, 0.35, 0.48, 0.6];
      for (let i = 0; i < rs.length - 1; i++) back.push(rod([Math.cos(a) * rs[i], backY(rs[i]), Math.sin(a) * rs[i]], [Math.cos(a) * rs[i + 1], backY(rs[i + 1]), Math.sin(a) * rs[i + 1]], 0.012, 5));
    }
    back.push(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 16).translate(0, s * 0.25, 0));   // hub on the gimbal
    const feed = [new THREE.CylinderGeometry(0.05, 0.08, 0.16, 16).translate(0, s * (0.3 + 0.38), 0)];
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.4;
      feed.push(rod([Math.cos(a) * HGA.dish * 0.85, s * (0.3 + (HGA.dish * 0.85) ** 2 / 1.68), Math.sin(a) * HGA.dish * 0.85], [0, s * (0.3 + 0.36), 0], 0.01, 5));
    }
    const gim = [new THREE.BoxGeometry(0.22, 0.2, 0.22).translate(0, s * 0.1, 0), new THREE.CylinderGeometry(0.07, 0.07, 0.34, 14).rotateZ(Math.PI / 2).translate(0, s * 0.22, 0)];
    g2.add(mesh(dish, HM.dish()), mesh(merge(back), HM.grEp()), mesh(merge(feed), HM.al()));
    // waveguide and cable run along the mast
    pivot.add(mesh(merge([rod([0.09, s * 0.15, 0.05], [0.09, s * (HGA.mast - 0.1), 0.05], 0.018, 6), rod([-0.08, s * 0.15, -0.05], [-0.08, s * (HGA.mast - 0.1), -0.05], 0.012, 6)]), HM.kapton()));
    const hp = P(`High-gain antenna (${side})`, {
      system: 'Communications', material: 'Parabolic reflector of aluminium honeycomb with graphite-epoxy facesheets (General Electric), S-band feed', mass: 28, temp: 250,
      explode: [0, s * 0.8, 0],
      desc: 'Steerable dish (≈1.3 m, estimated) that sends science data at 2255.5 or 2287.5 MHz to NASA\'s Tracking and Data Relay Satellites 36,000 km up, which relay it to White Sands. Its beam is about 4° wide, so the gimbal aims it to within 1° as Hubble circles the Earth.',
      callout: s > 0, anchor: [0.4, s * 0.5, 0.4],
    }, gimbal, tip);
    P(`HGA gimbal (${side})`, {
      system: 'Communications', material: 'Two-axis stepper-motor gimbal with rotary joints for the RF path', mass: 14, temp: 255, explode: [0, s * 0.35, 0],
      desc: 'Turns the dish up to 100° either way on two axes so it can follow a TDRS satellite across the sky while Hubble holds its target. Rotary joints carry the S-band signal across both axes.',
    }, mesh(merge(gim), HM.box()), gimbal);
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
    desc: 'One of two spiral-cone antennas (2.1–2.3 GHz), this one on the light shield looking forward. Between them they see almost the whole sky: every command sent to Hubble arrives through them, and they keep a link alive if the telescope loses attitude.',
  }, [mesh(fwd, HM.dish()), mesh(new THREE.BoxGeometry(0.4, 0.06, 0.12).translate(ST.front - 0.25, ...az(deg(200), RAD.shell + 0.1).slice(1)).rotateX(0), HM.al())]);
  const aft = lga(-1).translate(-0.02, ...az(deg(270), 1.75).slice(1));
  P('Low-gain antenna (aft)', {
    system: 'Communications', material: 'Conical spiral antenna', mass: 4, temp: 255, explode: [-3.8, 0, -0.6],
    desc: 'The aft-looking twin on the aft bulkhead, set 180° from the forward antenna; between them the two cover nearly the whole sky at low data rates through the multiple-access transponders.',
  }, mesh(aft, HM.dish()));

  // ------------------------------------------------------------------ magnetic torquer bars (forward shell, 90° apart)
  const MT0 = 6.3, MT1 = MT0 + 2.5;
  for (const [n, c] of [[1, 45], [2, 135], [3, 225], [4, 315]]) {
    const p = deg(c);
    const bar = [rod(az(p, RAD.shell + 0.15, MT0), az(p, RAD.shell + 0.15, MT1), 0.045, 16)];
    for (const x of [MT0 + 0.1, MT1 - 0.1]) bar.push(new THREE.BoxGeometry(0.14, 0.16, 0.16).translate(0, RAD.shell + 0.08, 0).rotateX(p).translate(x, 0, 0));
    for (const x of [MT0, MT1]) bar.push(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 16).rotateZ(Math.PI / 2).translate(x, 0, 0).translate(0, ...az(p, RAD.shell + 0.15).slice(1)));
    P(`Magnetic torquer bar ${n}`, {
      system: 'Attitude control', material: 'Ferromagnetic-core electromagnet with redundant windings, 2.5 m long', mass: 45, massSource: 'NASA SM3A Media Guide (100 lb)', temp: 255,
      explode: az(p, 0.9, 0.3), desc: 'One of four bars on the forward shell. Driven against the Earth\'s magnetic field, it bleeds off the momentum the reaction wheels build up from gravity-gradient and aerodynamic torques, and can hold attitude in a contingency. Hubble carries no thrusters at all.',
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
  const cssGeo = (list) => {
    const g = [];
    for (const [x, r, c] of list) {
      const p = deg(c);
      g.push(new THREE.CylinderGeometry(0.07, 0.08, 0.06, 16).translate(0, r + 0.03, 0).rotateX(p).translate(x, 0, 0));
      g.push(new THREE.SphereGeometry(0.05, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, r + 0.06, 0).rotateX(p).translate(x, 0, 0));
    }
    return merge(g);
  };
  P('Coarse sun sensors (forward)', {
    system: 'Attitude control', material: 'Silicon photodiode sensors', mass: 2, count: 2, temp: 250, explode: [0.8, 0, 0],
    desc: 'Two of Hubble\'s five coarse sun sensors, near the aperture. They always know roughly where the Sun is, and if it comes within 35° of the optical axis they start the aperture door closing.',
  }, mesh(cssGeo([[ST.front - 0.2, RAD.shell, 110], [ST.front - 0.2, RAD.shell, 250]]), HM.box()));
  P('Coarse sun sensors (aft)', {
    system: 'Attitude control', material: 'Silicon photodiode sensors', mass: 3, count: 3, temp: 262, explode: [-1.6, -4.0, 0],
    desc: 'The other three sun sensors, on the aft shroud. Together the five fix the initial attitude after deployment and guide the safe mode that turns the solar arrays toward the Sun when something goes wrong. Positions approximate.',
  }, mesh(cssGeo([[0.85, RAD.big, 20], [0.85, RAD.big, 180], [0.85, RAD.big, 340]]), HM.box()));

  // ------------------------------------------------------------------ wiring: data/power trunk, array power, RF
  // trunk bundles from the equipment section forward to the light-shield hardware and aft to the instruments
  const hz = [];
  for (const c of [62, 118, 242, 298]) {
    hz.push(rod(az(deg(c), 1.485, ST.equip), az(deg(c), 1.485, ST.fwdShell), 0.016, 6), rod(az(deg(c), 1.485, ST.fwdShell), az(deg(c), 1.485, 12.6), 0.012, 6));
  }
  for (const c of [20, 160, 200, 340]) {
    hz.push(rod(az(deg(c), 1.96, 3.5), az(deg(c), 1.96, 0.45), 0.022, 6));
    hz.push(rod(az(deg(c), 1.96, 0.45), az(deg(c), 1.15, 0.28), 0.018, 6));
  }
  P('Electrical harness', {
    system: 'Electrical', material: 'Shielded copper wiring bundles and connectors', mass: 150, temp: 285, explode: [0, 0, 0],
    desc: 'Many kilometres of wire tie the equipment bays to the instruments, sensors and drives through hundreds of connectors — the reason servicing tools were designed to be worked in pressure gloves. Shown as the main trunk runs; routing simplified.',
  }, mesh(merge(hz), new THREE.MeshStandardMaterial({ color: 0x5a5148, roughness: 0.7, metalness: 0.2 })));

  // array power: each wing's drive → along the forward shell → round the equipment section to the
  // power control unit in bay 4, passing the battery bays 2 and 3
  const arc = (list, r, x, a0, a1, rr = 0.02, step = 15) => {
    const n = Math.max(1, Math.round(Math.abs(a1 - a0) / step));
    for (let i = 0; i < n; i++) list.push(rod(az(deg(a0 + ((a1 - a0) * i) / n), r, x), az(deg(a0 + ((a1 - a0) * (i + 1)) / n), r, x), rr, 6));
  };
  const pw = [];
  for (const c of [90, 270]) {
    pw.push(rod(az(deg(c), SA.rDrive + 0.03, SA.x), az(deg(c), 1.485, SA.x), 0.024, 6), rod(az(deg(c), 1.485, SA.x), az(deg(c), 1.485, 5.02), 0.024, 6), rod(az(deg(c), 1.485, 5.02), az(deg(c), 1.6, 4.98), 0.024, 6));
  }
  arc(pw, 1.6, 4.98, 90, 225, 0.024);
  arc(pw, 1.6, 4.98, 270, 225, 0.024);
  pw.push(rod(az(deg(225), 1.6, 4.98), az(deg(225), 1.6, 4.82), 0.024, 6));
  for (const c of [165, 195]) pw.push(rod(az(deg(c), 1.6, 4.98), az(deg(c), 1.62, 4.9), 0.02, 6));
  P('Solar array power harness', {
    system: 'Power', material: 'Heavy-gauge copper power cables', mass: 40, temp: 285, explode: [0, 0, 0],
    desc: 'Carries each wing\'s current from its drive\'s slip rings along the inside of the forward shell to the power control unit in bay 4, past the battery modules in bays 2 and 3 that it recharges every orbit. Routing simplified.',
  }, mesh(merge(pw), new THREE.MeshStandardMaterial({ color: 0x7a4b2c, roughness: 0.6, metalness: 0.35 })));

  // RF: the transmitters and transponders in bay 5 → coax to both high-gain antennas and waveguide to the low-gain antennas
  const rf = [];
  const B5 = 285;
  rf.push(rod(az(deg(B5), 1.62, 4.62), az(deg(B5), 1.62, 4.88), 0.016, 6));
  arc(rf, 1.62, 4.88, B5, 360, 0.016);
  arc(rf, 1.62, 4.88, B5, 180, 0.016);
  for (const c of [0, 180]) rf.push(rod(az(deg(c), 1.62, 4.88), az(deg(c), 1.47, 5.05), 0.016, 6), rod(az(deg(c), 1.47, 5.05), az(deg(c), 1.47, HGA.x), 0.016, 6), rod(az(deg(c), 1.47, HGA.x), az(deg(c), RAD.shell + 0.05, HGA.x), 0.016, 6));
  rf.push(rod(az(deg(200), 1.62, 4.88), az(deg(200), 1.47, 5.05), 0.014, 6), rod(az(deg(200), 1.47, 5.05), az(deg(200), 1.47, ST.front - 0.15), 0.014, 6), rod(az(deg(200), 1.47, ST.front - 0.15), az(deg(200), RAD.shell + 0.1, ST.front - 0.15), 0.014, 6));
  rf.push(rod(az(deg(297), 1.62, 4.88), az(deg(297), 1.62, 3.62), 0.016, 6), rod(az(deg(297), 1.62, 3.62), az(deg(297), 1.9, 3.5), 0.016, 6), rod(az(deg(297), 1.9, 3.5), az(deg(297), 1.9, 0.3), 0.016, 6), rod(az(deg(297), 1.9, 0.3), az(deg(270), 1.75, 0.08), 0.016, 6));
  P('RF cables & waveguide', {
    system: 'Communications', material: 'Low-loss S-band coaxial cable and waveguide, with RF transfer switches', mass: 20, temp: 280, explode: [0, 0, 0],
    desc: 'Links the transmitters and transponders in bay 5 to the two high-gain antennas (up their masts through the gimbals\' rotary joints) and, by waveguide, to the forward and aft low-gain antennas, so any radio can reach any antenna. Routing simplified.',
  }, mesh(merge(rf), HM.kapton()));

  return out;
}
