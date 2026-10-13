// Support Systems Module (Lockheed Martin): the spacecraft wrapped around the telescope.
// Stacked cylinders from front to back — aperture door, light shield, forward shell, the ring of
// ten equipment bays, aft shroud and aft bulkhead — plus the servicing hardware added for
// spacewalkers and, in 2009, the soft-capture mechanism.
//
// Equipment-bay contents follow NASA media guides: bay 1 data management, bays 2–3 batteries,
// bay 4 power control, bay 5 communications, bays 6 and 9 reaction wheels, bay 7 mechanism
// control, bay 8 pointing-control electronics and a data recorder, bay 10 the SI C&DH. The order of
// the bays around the ring is schematic.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { rod, mergeGeometries } from '../../engine/geometry.js';
import { ST, RAD, az, deg, axial, tube, annulus, shellPatch, patchFrame, ni } from './layout.js';
import { HM } from './materials.js';

const merge = (list) => mergeGeometries(list.map(ni));
const flange = (r0, r1, x0, x1, seg = 96) => axial([[r0, x0], [r1, x0], [r1, x1], [r0, x1], [r0, x0]], seg);

export const BAY_PHI = Array.from({ length: 10 }, (_, k) => deg(18 + k * 36));   // bay k+1 centre azimuth
const BAY_EDGE = 2 * RAD.big * Math.sin(deg(18));                                  // 1.30 m door width
const X_EQ0 = ST.aftShroud, X_EQ1 = ST.equip, X_EQM = (X_EQ0 + X_EQ1) / 2;

/** Geometry built in a bay's local frame (x axial, y radius, z tangential) rotated into bay k (1-based). */
const inBay = (k, g) => g.rotateX(BAY_PHI[k - 1]);
const bayBox = (k, sx, sy, sz, x, r, t = 0) => inBay(k, new THREE.BoxGeometry(sx, sy, sz).translate(x, r, t));

export function buildSSM(P) {
  const out = { rails: [], sockets: [] };

  // ------------------------------------------------------------------ light shield
  const ls = mesh(tube(RAD.shell, ST.fwdShell, ST.front, { seg: 96, hs: 4 }), HM.mliShield());
  const lsLiner = mesh(tube(RAD.inner, ST.fwdShell, ST.front - 0.02, { seg: 96 }), HM.black());
  const lsRings = mesh(merge([flange(RAD.inner, RAD.shell + 0.04, ST.front - 0.1, ST.front), flange(RAD.shell - 0.02, RAD.shell + 0.025, ST.fwdShell - 0.04, ST.fwdShell + 0.04)]), HM.al());
  out.lightShield = P('Light shield', {
    system: 'Skin & fairings', skin: true, material: 'Machined magnesium corrugated barrel under silvered-Teflon MLI; flat-black interior', mass: 380, temp: 245, explode: [2.6, 2.4, 0],
    desc: 'About 4 m long with a 3 m bore, it shades the optics from sunlight, moonlight and earthshine. Its stiffened magnesium skin carries the aperture door, the magnetic torquers and the forward sensors.',
  }, [ls, lsLiner, lsRings]);
  out.lightShield.userData.part.thermalRole = 'blanket';

  const lb = [];
  for (let k = 0; k < 10; k++) lb.push(annulus(1.33, RAD.inner, 9.35 + k * 0.37, 96, 1));
  P('Light shield internal baffles', {
    system: 'Optics', material: 'Flat-black aluminium rings', mass: 40, count: 10, temp: 250, explode: [2.0, 0, 0],
    desc: 'Ten sharp-edged rings inside the light shield catch light glancing in from bright sources off the axis, the first stage of Hubble\'s stray-light defence.',
  }, mesh(merge(lb), HM.black()));

  // ------------------------------------------------------------------ aperture door
  const doorPivot = new THREE.Group();
  doorPivot.position.set(ST.door, RAD.shell + 0.07, 0);
  const rDoor = 1.6;
  const leaf = new THREE.CylinderGeometry(rDoor, rDoor, 0.07, 72, 1, false);
  leaf.rotateZ(-Math.PI / 2).translate(0.035, -(RAD.shell + 0.07), 0);
  const leafMesh = mesh(leaf, [HM.al(), HM.mli(), HM.black()]);
  const ribs = [];
  for (const z of [-0.75, 0, 0.75]) ribs.push(new THREE.BoxGeometry(0.06, 2 * Math.sqrt(rDoor ** 2 - z * z) - 0.2, 0.08).translate(0.1, -(RAD.shell + 0.07), z));
  ribs.push(new THREE.BoxGeometry(0.06, 0.08, 2.9).translate(0.1, -(RAD.shell + 0.07), 0));
  for (const z of [-0.55, 0.55]) ribs.push(new THREE.BoxGeometry(0.1, 0.5, 0.08).translate(0.08, -0.22, z));
  doorPivot.add(leafMesh, mesh(merge(ribs), HM.al()));
  out.door = P('Aperture door', {
    system: 'Skin & fairings', skin: true, material: 'Aluminium honeycomb panel, MLI outside, flat black inside', mass: 110, temp: 250, explode: [3.6, 2.4, 0],
    desc: 'A 3 m hinged lid. Open, it doubles as a sunshade; coarse sun sensors make it close within about a minute if the Sun strays toward the aperture. Hubble normally never points within 50° of the Sun.',
    callout: true, anchor: [ST.door + 0.05, RAD.shell + 0.12, 0.7],
  }, doorPivot);
  out.doorPivot = doorPivot;

  const hinge = [new THREE.CylinderGeometry(0.06, 0.06, 1.5, 16).rotateX(Math.PI / 2).translate(ST.door, RAD.shell + 0.07, 0)];
  for (const z of [-0.55, 0.55]) hinge.push(new THREE.BoxGeometry(0.22, 0.12, 0.14).translate(ST.door - 0.1, RAD.shell + 0.02, z));
  hinge.push(new THREE.BoxGeometry(0.42, 0.16, 0.3).translate(12.55, RAD.shell + 0.08, 0), rod([12.75, RAD.shell + 0.1, 0.12], [ST.door - 0.05, RAD.shell + 0.08, 0.12], 0.022, 8));
  P('Aperture door hinge & drive', {
    system: 'Structure', material: 'Redundant drive motors, gearbox, hinge line', mass: 18, temp: 255, explode: [3.0, 2.6, 0],
    desc: 'Redundant motors swing the door through about 105° in a minute. The door is a safety device as much as a lid: it can close by itself when the sun sensors see danger.',
  }, mesh(merge(hinge), HM.al()));

  // ------------------------------------------------------------------ forward shell
  const fs = mesh(tube(RAD.shell, ST.equip, ST.fwdShell, { seg: 96, hs: 4 }), HM.mli());
  const fsLiner = mesh(tube(RAD.inner, ST.equip, ST.fwdShell, { seg: 96 }), HM.black());
  const fsRings = mesh(merge([flange(RAD.shell - 0.02, RAD.shell + 0.03, ST.equip, ST.equip + 0.1), flange(RAD.shell - 0.02, RAD.shell + 0.025, 7.05, 7.12)]), HM.al());
  out.fwdShell = P('Forward shell', {
    system: 'Skin & fairings', skin: true, material: 'Aluminium skin-and-stringer shell under silvered-Teflon MLI', mass: 650, temp: 262, explode: [0, 3.9, 0],
    desc: 'The 4 m central barrel around the metering truss and secondary mirror. The solar-array drives, high-gain antenna masts and grapple fixtures bolt to it.',
  }, [fs, fsLiner, fsRings]);
  out.fwdShell.userData.part.thermalRole = 'blanket';

  // ------------------------------------------------------------------ equipment section structure
  const deca = new THREE.Shape(Array.from({ length: 10 }, (_, k) => {
    const p = deg(k * 36);
    return new THREE.Vector2(-RAD.big * Math.sin(p), RAD.big * Math.cos(p));
  }));
  const hole = new THREE.Path();
  hole.absarc(0, 0, RAD.shell, 0, Math.PI * 2, true);
  deca.holes.push(hole);
  const plateGeo = (x) => new THREE.ShapeGeometry(deca, 24).rotateY(Math.PI / 2).translate(x, 0, 0);
  const eq = [plateGeo(X_EQ0 + 0.01), plateGeo(X_EQ1 - 0.01), tube(RAD.shell, X_EQ0, X_EQ1, { seg: 64 })];
  for (let k = 0; k < 10; k++) eq.push(new THREE.BoxGeometry(X_EQ1 - X_EQ0, RAD.big - RAD.shell, 0.025).translate(X_EQM, (RAD.big + RAD.shell) / 2, 0).rotateX(deg(k * 36)));
  for (let k = 0; k < 10; k++) eq.push(new THREE.BoxGeometry(X_EQ1 - X_EQ0 + 0.04, 0.06, 0.06).translate(X_EQM, RAD.big - 0.03, 0).rotateX(deg(k * 36)));
  out.equip = P('Equipment section', {
    system: 'Structure', material: 'Aluminium ring frame: ten trapezoidal bays between bulkheads', mass: 1150, temp: 278, explode: [0, 0, 0],
    desc: 'A 4.2 m ring of ten bays around the primary mirror holding most of the spacecraft electronics, each behind a hinged door so spacewalkers can swap boxes as orbital replacement units.',
  }, mesh(merge(eq), new THREE.MeshStandardMaterial({ color: 0x9aa1a8, roughness: 0.5, metalness: 0.7, side: THREE.DoubleSide })));

  // bay doors (radiators)
  const doorNames = [
    'data management', 'battery module 1', 'battery module 2', 'power control', 'communications',
    'reaction wheels 1–2', 'mechanism control', 'pointing control', 'reaction wheels 3–4', 'SI C&DH',
  ];
  out.bayDoors = [];
  for (let k = 1; k <= 10; k++) {
    const face = RAD.big * Math.cos(deg(18));
    const g = bayBox(k, X_EQ1 - X_EQ0 - 0.07, 0.03, BAY_EDGE - 0.05, X_EQM, face + 0.015);
    const rails = [];
    for (const t of [-0.44, 0.44]) {
      rails.push(inBay(k, rod([X_EQ0 + 0.15, face + 0.09, t], [X_EQ1 - 0.15, face + 0.09, t], 0.016, 4)));
      for (const x of [X_EQ0 + 0.2, X_EQM, X_EQ1 - 0.2]) rails.push(inBay(k, rod([x, face + 0.03, t], [x, face + 0.09, t], 0.012, 4)));
    }
    out.rails.push(...rails);
    out.sockets.push(bayBox(k, 0.1, 0.05, 0.1, X_EQ1 - 0.22, face + 0.05, 0));
    const p = P(`Bay ${k} door (${doorNames[k - 1]})`, {
      system: 'Thermal control', skin: true, material: 'Aluminium honeycomb radiator door, silvered-Teflon tape', mass: 22, temp: k === 6 || k === 9 ? 268 : 258,
      explode: az(BAY_PHI[k - 1], 1.3), desc: k === 10
        ? 'Bay 10\'s door carries the Science Instrument Command and Data Handling unit on its inner face. Like every bay door it is a radiator: electronics bolted inside dump their heat through it to space.'
        : `Hinged access door and radiator for bay ${k}. Its outer face sheds the heat of the ${doorNames[k - 1]} equipment to deep space; spacewalkers open it with a power tool to reach the boxes inside.`,
    }, mesh(g, HM.bayDoor()));
    p.userData.part.thermalRole = 'radiator';
    out.bayDoors.push(p);
  }

  // NOBL covers fitted in 2009 over bays 5, 7 and 8
  const nobl = [];
  for (const k of [5, 7, 8]) nobl.push(bayBox(k, X_EQ1 - X_EQ0 - 0.18, 0.02, BAY_EDGE - 0.16, X_EQM, RAD.big * Math.cos(deg(18)) + 0.045));
  P('New outer blanket layers (NOBL)', {
    system: 'Thermal control', skin: true, material: 'Stainless-steel framed covers, silvered-Teflon radiating surface', mass: 30, count: 3, temp: 250, explode: az(BAY_PHI[6], 2.0),
    desc: 'The original Teflon blankets cracked and peeled after years of ultraviolet light and atomic oxygen. Astronauts bolted new outer covers over the worst bays in 2002 and over bays 5, 7 and 8 in 2009 to keep the electronics cool.',
  }, mesh(merge(nobl), HM.nobl()));

  // ------------------------------------------------------------------ bay contents
  const B = (k, name, info, objs) => P(name, { explode: az(BAY_PHI[k - 1], 0.75), ...info }, objs);
  const face = RAD.big * Math.cos(deg(18));
  // bay 1: data management
  B(1, 'Data management unit', {
    system: 'Avionics', material: 'Rad-hard data-handling electronics', mass: 38, temp: 296,
    desc: 'Bay 1. The spacecraft\'s data switchboard: it formats engineering telemetry, routes commands and keeps the clock, linking the flight computer to every other box through remote data interface units.',
  }, mesh(merge([bayBox(1, 1.0, 0.3, 0.5, X_EQM, 1.76, -0.22), bayBox(1, 0.9, 0.04, 0.42, X_EQM, 1.93, -0.22)]), HM.iridite()));
  B(1, 'Flight computer (80486)', {
    system: 'Avionics', material: 'Radiation-hardened Intel 80486 processor boards', mass: 32, temp: 297,
    desc: 'Installed in December 1999, replacing the 1980s DF-224 and its co-processor: an Intel 80486 running at 25 MHz, about 20 times faster with six times the memory. It runs pointing, safing and housekeeping.',
  }, mesh(bayBox(1, 0.6, 0.3, 0.4, X_EQM, 1.76, 0.3), HM.box()));
  // bays 2–3: batteries
  for (const [k, n] of [[2, 1], [3, 2]]) {
    const frame = [bayBox(k, 1.38, 0.03, 0.95, X_EQM, 1.6)];
    const cells = [];
    for (let b = 0; b < 3; b++) {
      const x = X_EQ0 + 0.27 + b * 0.48;
      frame.push(bayBox(k, 0.44, 0.1, 0.9, x, 1.67));
      for (let i = 0; i < 11; i++) for (const dx of [-0.1, 0.1]) {
        cells.push(inBay(k, new THREE.CylinderGeometry(0.042, 0.042, 0.2, 12).translate(x + dx, 1.82, -0.39 + i * 0.078)));
      }
    }
    const p = B(k, `Battery module ${n} (bay ${k})`, {
      system: 'Power', material: 'Three 22-cell nickel–hydrogen batteries on a common plate', mass: 209, massSource: 'NASA SM4 battery fact sheet (460 lb)', count: 3, temp: 274,
      desc: `Bay ${k}. Three batteries of 22 NiH₂ pressure-vessel cells; with the other module they carry Hubble through the ~36 minutes of shadow on every orbit. About 88 Ah each when new, charged to ~75 Ah in orbit. The set flying now was installed in 2009.`,
      callout: n === 1, anchor: az(BAY_PHI[k - 1], 2.15, X_EQM),
    }, [mesh(merge(frame), HM.iridite()), mesh(merge(cells), HM.cell())]);
    p.userData.part.thermalRole = 'battery';
  }
  // bay 4: power control
  B(4, 'Power control unit', {
    system: 'Power', material: 'Relay and charge-control electronics', mass: 55, temp: 299,
    desc: 'Bay 4. Switches solar-array power to the loads and the battery chargers. Replaced in 2002 on a spacewalk that required powering the whole observatory down for the first time.',
  }, mesh(bayBox(4, 1.1, 0.3, 0.8, X_EQM, 1.76), HM.iridite()));
  B(4, 'Power distribution units', {
    system: 'Power', material: 'Fuse and relay boxes', mass: 30, count: 4, temp: 296,
    desc: 'Four distribution units fan the 28 V bus out through fuses to every subsystem. Their placement on the bay 4 door is approximate.',
  }, mesh(merge([[-0.3, 3.95], [0.3, 3.95], [-0.3, 4.65], [0.3, 4.65]].map(([t, x]) => bayBox(4, 0.3, 0.07, 0.26, x, face - 0.06, t))), HM.box()));
  // bay 5: communications + recorder
  B(5, 'S-band transmitters & transponders', {
    system: 'Communications', material: 'Two single-access transmitters, two multiple-access transponders', mass: 26, count: 4, temp: 297,
    desc: 'Bay 5. The single-access transmitters send science data through the high-gain antennas; the multiple-access transponders handle commands and low-rate telemetry through any antenna. All links go through NASA\'s TDRS relays.',
  }, mesh(merge([[-0.3, 3.95], [0.3, 3.95], [-0.3, 4.6], [0.3, 4.6]].map(([t, x]) => bayBox(5, 0.36, 0.17, 0.28, x, 1.72, t))), HM.box()));
  B(5, 'Solid-state recorder (bay 5)', {
    system: 'Avionics', material: 'DRAM memory boards, 12 Gbit', mass: 11, temp: 297,
    desc: 'Stores science and engineering data between TDRS contacts. Solid-state recorders replaced Hubble\'s reel-to-reel tape recorders in 1997 and 1999; no moving parts to wear out.',
  }, mesh(bayBox(5, 0.36, 0.16, 0.32, X_EQM, 1.89), HM.iridite()));
  // bays 6 and 9: reaction wheels
  out.wheels = [];
  const wheel = (k, n, x, tilt) => {
    const g = new THREE.Group();
    const housing = mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.2, 40), HM.box());
    const flangeM = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 40).translate(0, -0.1, 0), HM.al());
    const rotor = mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.07, 32), HM.rotor());
    const spokes = mesh(merge([0, 1, 2].map((i) => new THREE.BoxGeometry(0.46, 0.05, 0.04).rotateY((i * Math.PI) / 3).translate(0, 0.05, 0))), HM.ti());
    const rot = new THREE.Group();
    rot.add(rotor, spokes);
    g.add(housing, flangeM, rot);
    const c = new THREE.Vector3(x, 1.77, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), BAY_PHI[k - 1]);
    const axis = new THREE.Vector3(Math.sin(tilt) * 0.5, Math.cos(tilt), Math.sin(tilt) * 0.86).normalize().applyAxisAngle(new THREE.Vector3(1, 0, 0), BAY_PHI[k - 1]);
    g.position.copy(c);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
    out.wheels.push(rot);
    return B(k, `Reaction wheel assembly ${n}`, {
      system: 'Attitude control', material: 'Steel-rimmed flywheel on ball bearings, brushless DC motor', mass: 45, temp: 300,
      desc: `Bay ${k}. Spinning a flywheel faster or slower turns the telescope the other way — no propellant, no vibration from thrusters. Four wheels with skewed axes, any three enough; they slew Hubble about 90° in 15 minutes, as slow as a minute hand.`,
      callout: n === 1, anchor: c.clone().addScaledVector(axis, 0.3).toArray(),
    }, g);
  };
  wheel(6, 1, X_EQ0 + 0.4, 0.35); wheel(6, 2, X_EQ1 - 0.4, -0.35);
  wheel(9, 3, X_EQ0 + 0.4, 0.35); wheel(9, 4, X_EQ1 - 0.4, -0.35);
  // bay 7: mechanism control
  B(7, 'Mechanism control unit', {
    system: 'Avionics', material: 'Motor-driver electronics', mass: 20, temp: 296,
    desc: 'Bay 7. Drives the aperture door, the antenna and array deployment hinges and the high-gain antenna gimbals.',
  }, mesh(bayBox(7, 0.7, 0.26, 0.5, X_EQ0 + 0.45, 1.75, -0.18), HM.box()));
  B(7, 'Solar array drive electronics', {
    system: 'Power', material: 'Two stepper-motor controllers', mass: 16, count: 2, temp: 297,
    desc: 'Bay 7. Steps the two array drives so the wings keep facing the Sun as Hubble points around the sky. One unit was replaced on the 1997 servicing mission.',
  }, mesh(merge([bayBox(7, 0.36, 0.2, 0.3, X_EQ1 - 0.35, 1.73, -0.25), bayBox(7, 0.36, 0.2, 0.3, X_EQ1 - 0.35, 1.73, 0.25)]), HM.iridite()));
  // bay 8: pointing control + recorder
  B(8, 'Pointing control electronics', {
    system: 'Attitude control', material: 'Pointing/safe-mode electronics and gyro interface boxes', mass: 42, temp: 296,
    desc: 'Bay 8. Pointing-control hardware, including the independent safe-mode electronics that can hold the telescope Sun-pointed if the main computer fails. Box breakdown approximate.',
  }, mesh(bayBox(8, 0.8, 0.28, 0.55, X_EQ0 + 0.5, 1.76, 0.15), HM.box()));
  B(8, 'Solid-state recorder (bay 8)', {
    system: 'Avionics', material: 'DRAM memory boards, 12 Gbit', mass: 11, temp: 297,
    desc: 'Second solid-state recorder (1999). Hubble can store a day of observations and play them back through the high-gain antennas when a TDRS satellite is in view.',
  }, mesh(bayBox(8, 0.36, 0.16, 0.32, X_EQ1 - 0.35, 1.89, -0.2), HM.iridite()));
  // bay 10: SI C&DH on the door
  const sic = [bayBox(10, 1.3, 0.025, 1.0, X_EQM, face - 0.03)];
  for (let i = 0; i < 4; i++) for (const t of [-0.24, 0.24]) sic.push(bayBox(10, 0.26, 0.2, 0.36, X_EQ0 + 0.3 + i * 0.3, face - 0.15, t));
  B(10, 'Science instrument command & data handling unit', {
    system: 'Avionics', material: 'Redundant computer, control-unit/science-data-formatter and power modules on a tray', mass: 107, temp: 298,
    desc: 'Bay 10. Commands the instruments and formats their data. Its side A failed in September 2008, delaying the last servicing mission; astronauts installed the spare in May 2009.',
  }, mesh(merge(sic), HM.iridite()));

  // ------------------------------------------------------------------ aft shroud
  const shroud = mesh(tube(RAD.big, ST.bulkhead, ST.aftShroud, { seg: 128, hs: 3 }), HM.mli());
  const shroudRings = mesh(merge([flange(RAD.big - 0.02, RAD.big + 0.035, ST.bulkhead, ST.bulkhead + 0.09, 128), flange(RAD.big - 0.02, RAD.big + 0.035, ST.aftShroud - 0.09, ST.aftShroud, 128)]), HM.al());
  out.aftShroud = P('Aft shroud', {
    system: 'Skin & fairings', skin: true, material: 'Aluminium skin-and-frame shell under silvered-Teflon MLI', mass: 980, temp: 270, explode: [-1.6, -4.0, 0],
    desc: 'The 3.5 m, 4.2 m-wide housing around the focal plane: four axial instruments, the radial camera, three Fine Guidance Sensors, the gyros and the star trackers, all behind light-tight doors sized for a spacewalker.',
  }, [shroud, shroudRings]);
  out.aftShroud.userData.part.thermalRole = 'blanket';

  // access doors: four pairs for the axial instruments and one for the star trackers / gyros
  const doors = [], frames = [];
  const rD = RAD.big + 0.018;
  for (const c of [45, 135, 225, 315]) {
    for (const [a, b] of [[c - 27, c - 1], [c + 1, c + 27]]) {
      doors.push(shellPatch(rD, 0.35, 2.35, deg(a), deg(b), { nphi: 10 }));
      frames.push(...patchFrame(rD + 0.008, 0.35, 2.35, deg(a), deg(b), 0.014, rod));
    }
  }
  doors.push(shellPatch(rD, 2.48, 3.42, deg(118), deg(152), { nphi: 10 }));
  frames.push(...patchFrame(rD + 0.008, 2.48, 3.42, deg(118), deg(152), 0.014, rod));
  P('Aft shroud access doors', {
    system: 'Skin & fairings', skin: true, material: 'Hinged honeycomb doors with light-tight seals', mass: 160, count: 9, temp: 268, explode: [-1.4, -4.4, 0],
    desc: 'Paired doors open onto each axial instrument bay, and one onto the star trackers and rate-sensor units. Door layout simplified from servicing-mission photographs.',
  }, [mesh(merge(doors), HM.bayDoor()), mesh(merge(frames), HM.al())]);
  const rdoors = [], rframes = [];
  for (const c of [0, 90, 270]) {
    rdoors.push(shellPatch(rD, 1.78, 3.38, deg(c - 14), deg(c + 14), { nphi: 8 }));
    rframes.push(...patchFrame(rD + 0.008, 1.78, 3.38, deg(c - 14), deg(c + 14), 0.014, rod));
  }
  P('Radial bay doors (FGS)', {
    system: 'Skin & fairings', skin: true, material: 'Hinged honeycomb doors', mass: 45, count: 3, temp: 266, explode: [0, 0, 0],
    desc: 'Doors over the three Fine Guidance Sensor bays. The radial camera has none: its own radiator forms that part of the shroud skin.',
  }, [mesh(merge(rdoors), HM.bayDoor()), mesh(merge(rframes), HM.al())]);

  // ------------------------------------------------------------------ aft bulkhead and servicing interfaces
  const bh = [tube(RAD.big - 0.01, 0, ST.bulkhead, { seg: 96, open: false })];
  for (let k = 0; k < 12; k++) bh.push(new THREE.BoxGeometry(0.06, 1.5, 0.05).translate(-0.025, 1.2, 0).rotateX(deg(k * 30 + 15)));
  bh.push(tube(0.42, -0.05, 0, { seg: 40, open: false }));
  out.bulkhead = P('Aft bulkhead', {
    system: 'Structure', skin: true, material: 'Aluminium ribbed plate', mass: 280, temp: 262, explode: [-3.4, 0, 0],
    desc: 'Closes the back of the telescope and carries the berthing pins, the aft low-gain antenna, the umbilical connector and, since 2009, the soft-capture mechanism.',
  }, mesh(merge(bh), new THREE.MeshStandardMaterial({ color: 0xaab0b6, roughness: 0.48, metalness: 0.75 })));

  const pins = [];
  for (const p of [60, 180, 300]) {
    pins.push(new THREE.BoxGeometry(0.12, 0.22, 0.22).translate(...az(deg(p), 1.55, -0.06)));
    pins.push(new THREE.CylinderGeometry(0.045, 0.045, 0.26, 16).rotateZ(Math.PI / 2).translate(...az(deg(p), 1.55, -0.24)));
    pins.push(new THREE.SphereGeometry(0.07, 16, 10).translate(...az(deg(p), 1.55, -0.38)));
  }
  P('Berthing pins', {
    system: 'Structure', material: 'Titanium pins', mass: 15, count: 3, temp: 262, explode: [-3.6, 0, 0],
    desc: 'Three pins the Shuttle\'s Flight Support System latched onto, standing Hubble upright in the payload bay for every servicing mission. The soft-capture mechanism now uses them.',
  }, mesh(merge(pins), HM.ti()));

  P('Umbilical connector panel', {
    system: 'Power', material: 'Spring-loaded electrical connector plate', mass: 8, temp: 262, explode: [-3.5, 0, 0.4],
    desc: 'While berthed in the payload bay, Hubble ran on Shuttle power through this umbilical, so its batteries were not drained during the servicing spacewalks.',
  }, mesh(new THREE.BoxGeometry(0.1, 0.3, 0.42).translate(...az(deg(120), 0.95, -0.05)), HM.box()));

  const scm = [axial([[0.56, -0.5], [0.74, -0.5], [0.74, -0.6], [0.56, -0.6], [0.56, -0.5]], 64)];
  for (const p of [60, 180, 300]) {
    const pin = az(deg(p), 1.55, -0.36);
    scm.push(rod(pin, az(deg(p - 40), 0.72, -0.52), 0.035, 10), rod(pin, az(deg(p + 40), 0.72, -0.52), 0.035, 10));
    scm.push(new THREE.BoxGeometry(0.16, 0.18, 0.18).translate(...pin));
  }
  for (const p of [0, 120, 240]) {
    // guide petal: a plate leaning outward from the ring
    scm.push(new THREE.BoxGeometry(0.3, 0.02, 0.26).translate(-0.15, 0, 0).rotateZ(deg(-18)).translate(-0.6, 0.66, 0).rotateX(deg(p)));
    scm.push(new THREE.BoxGeometry(0.12, 0.1, 0.16).translate(...az(deg(p + 60), 0.64, -0.56)));
  }
  out.scm = P('Soft capture mechanism', {
    system: 'Structure', material: 'Aluminium docking ring with guide petals (LIDS/NDS-compatible), attached to the berthing pins', mass: 440, temp: 262, explode: [-4.4, 0, 0],
    desc: 'Fitted on the last spacewalk in 2009 so that a future robotic spacecraft can dock and steer Hubble to a safe re-entry, or boost it. The three petals guide a docking ring into its latches.',
    callout: true, anchor: [-0.75, 0.6, 0],
  }, mesh(merge(scm), new THREE.MeshStandardMaterial({ color: 0xc9cdd1, roughness: 0.42, metalness: 0.7, side: THREE.DoubleSide })));
  const tg = [];
  for (const p of [90, 210, 330]) tg.push(new THREE.BoxGeometry(0.01, 0.16, 0.16).translate(...az(deg(p), 0.66, -0.61)));
  P('Relative-navigation targets', {
    system: 'Structure', material: 'Black-and-white contrast targets', mass: 1, count: 3, temp: 262, explode: [-4.6, 0, 0],
    desc: 'High-contrast patterns on the capture ring give a visiting spacecraft\'s cameras a precise range and attitude reference for the final approach.',
  }, mesh(merge(tg), HM.target()));

  // trunnions (launch and landing attach points in the Shuttle payload bay)
  const tr = [];
  for (const p of [90, 270]) {
    tr.push(new THREE.CylinderGeometry(0.075, 0.075, 0.42, 20).translate(0, RAD.big + 0.15, 0).rotateX(deg(p)).translate(X_EQ0 + 0.18, 0, 0));
    tr.push(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 20).translate(0, RAD.big + 0.36, 0).rotateX(deg(p)).translate(X_EQ0 + 0.18, 0, 0));
  }
  P('Longeron trunnions', {
    system: 'Structure', material: 'Titanium trunnion pins', mass: 40, count: 2, temp: 270, explode: [0, 0, 0],
    desc: 'Two side pins that sat in the Shuttle payload bay\'s longeron latches at launch in 1990 and carried the telescope\'s weight through ascent. Station along the equipment section approximate.',
  }, mesh(merge(tr), HM.ti()));
  P('Keel trunnion', {
    system: 'Structure', material: 'Titanium keel pin', mass: 18, temp: 270, explode: [0, -0.6, 0],
    desc: 'A single pin under the equipment section that sat in the payload-bay keel latch to take side loads at launch. Location approximate.',
  }, mesh(merge([new THREE.CylinderGeometry(0.07, 0.07, 0.42, 20).translate(0, -(RAD.big + 0.12), 0).translate(X_EQM + 0.3, 0, 0)]), HM.ti()));

  // grapple fixtures for the Shuttle's robot arm
  const gf = [];
  for (const p of [150, 330]) {
    gf.push(new THREE.BoxGeometry(0.4, 0.05, 0.4).translate(5.48, RAD.shell + 0.03, 0).rotateX(deg(p)));
    gf.push(new THREE.CylinderGeometry(0.04, 0.05, 0.3, 14).translate(5.48, RAD.shell + 0.2, 0).rotateX(deg(p)));
    gf.push(new THREE.BoxGeometry(0.14, 0.04, 0.05).translate(5.48, RAD.shell + 0.34, 0).rotateX(deg(p)));
    gf.push(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 8).translate(5.72, RAD.shell + 0.16, 0.12).rotateX(deg(p)));
    gf.push(new THREE.CylinderGeometry(0.06, 0.06, 0.01, 16).translate(5.72, RAD.shell + 0.28, 0.12).rotateX(deg(p)));
  }
  P('Grapple fixtures', {
    system: 'Structure', material: 'Aluminium fixtures with grapple shaft, cam and alignment target', mass: 24, count: 2, temp: 262, explode: [0, 0, 0],
    desc: 'The Shuttle\'s robot arm closed its end-effector snares on these shafts to pluck Hubble out of orbit for servicing and to release it afterwards. Positions approximate.',
  }, mesh(merge(gf), HM.al()));

  // ------------------------------------------------------------------ EVA aids (handrails and foot-restraint sockets)
  const rail = (p0, p1) => {
    out.rails.push(rod(p0, p1, 0.016, 4));
  };
  const standoff = (phi, r, x, h = 0.07) => out.rails.push(rod(az(phi, r, x), az(phi, r + h, x), 0.012, 4));
  // aft shroud: along the edges of every axial door pair, and two ring rails
  const rR = RAD.big + 0.09;
  for (const c of [45, 135, 225, 315]) for (const s of [-1, 1]) {
    const p = deg(c + s * 30);
    rail(az(p, rR, 0.45), az(p, rR, 2.25));
    for (const x of [0.5, 1.35, 2.2]) standoff(p, RAD.big + 0.02, x);
  }
  for (const x of [0.24, 3.46]) {
    for (let a = 0; a < 360; a += 20) {
      rail(az(deg(a + 2), rR, x), az(deg(a + 18), rR, x));
      standoff(deg(a + 10), RAD.big + 0.02, x);
    }
  }
  // forward shell: four longitudinal rails and a ring rail
  const rF = RAD.shell + 0.09;
  for (const c of [45, 135, 225, 315]) {
    rail(az(deg(c), rF, 5.25), az(deg(c), rF, 8.85));
    for (let x = 5.3; x < 8.9; x += 0.7) standoff(deg(c), RAD.shell, x);
  }
  for (let a = 0; a < 360; a += 30) {
    rail(az(deg(a + 3), rF, 5.2), az(deg(a + 27), rF, 5.2));
    standoff(deg(a + 15), RAD.shell, 5.2);
  }
  P('EVA handrails', {
    system: 'Crew systems', material: 'Painted aluminium rails on stand-offs', mass: 95, temp: 265, explode: [0, 0, 0],
    desc: 'Hubble was designed to be repaired by hand: 225 ft (69 m) of handrails let spacewalkers move hand over hand to every door. Five servicing missions between 1993 and 2009 used them. Rail runs simplified.',
  }, mesh(merge(out.rails), HM.handrail()));

  // 31 portable-foot-restraint sockets (10 on the bay doors above, 21 placed here)
  for (let k = 0; k < 12; k++) out.sockets.push(new THREE.BoxGeometry(0.1, 0.06, 0.1).translate(0, RAD.big + 0.03, 0).rotateX(deg(k * 30 + 15)).translate(k % 2 ? 3.3 : 0.55, 0, 0));
  for (let k = 0; k < 9; k++) out.sockets.push(new THREE.BoxGeometry(0.1, 0.06, 0.1).translate(0, RAD.shell + 0.03, 0).rotateX(deg(k * 40 + 20)).translate(k % 3 === 0 ? 5.6 : k % 3 === 1 ? 6.9 : 8.4, 0, 0));
  P('Foot-restraint sockets', {
    system: 'Crew systems', material: 'Aluminium sockets for portable foot restraints', mass: 12, count: 31, temp: 265, explode: [0, 0, 0],
    desc: '31 sockets accept the portable foot restraint, a platform that locks an astronaut\'s boots in place so both hands are free to work. Socket positions approximate.',
  }, mesh(merge(out.sockets), HM.handrail()));

  return out;
}
