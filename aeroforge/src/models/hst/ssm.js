// Support Systems Module (Lockheed Martin): the spacecraft wrapped around the telescope.
// Stacked cylinders from front to back — aperture door, light shield, forward shell, the ring of
// equipment bays, aft shroud and aft bulkhead — plus the servicing hardware added for spacewalkers
// and, in 2009, the soft-capture mechanism.
//
// Equipment section (SM3A Media Reference Guide §5.1.1, Figs. 5-7 and 5-13): twelve 30° trapezoidal
// slots, 1.1 m wide at the door, 0.78 m at the inner barrel and 1.5 m deep. Going clockwise from
// +V3 looking forward: bay 8 pointing control, 9 reaction wheels, 10 SI C&DH, a trunnion bay,
// 1 data management, 2–3 batteries, 4 power control, a trunnion bay, 5 communications,
// 6 reaction wheels, 7 mechanism control. Box sizes are the guide's where it gives them.
// The OTA equipment section (ten small bays A–J for the telescope's own electronics) rides on
// the +V3 side of the forward shell.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { rod, mergeGeometries } from '../../engine/geometry.js';
import { ST, RAD, az, deg, axial, tube, annulus, shellPatch, patchFrame, ni } from './layout.js';
import { HM } from './materials.js';

const merge = (list) => mergeGeometries(list.map(ni));

/**
 * An outer shell as two half-cylinders, the +V3 (Sun) side and the −V3 (shadow) side, each with
 * its own temperature for the Thermal view: Hubble keeps the Sun on its +V3 side.
 */
function sunShadowShell(r, x0, x1, mat, tSun, tShade, opts = {}) {
  // CylinderGeometry θ runs from +z toward +x; after tube()'s rotation, θ ∈ [−π, 0] is the y > 0 half
  const sun = mesh(tube(r, x0, x1, { ...opts, thetaStart: -Math.PI, thetaLength: Math.PI }), mat);
  const shade = mesh(tube(r, x0, x1, { ...opts, thetaStart: 0, thetaLength: Math.PI }), mat);
  sun.userData.temp = tSun;
  shade.userData.temp = tShade;
  return [sun, shade];
}
const flange = (r0, r1, x0, x1, seg = 96, phiStart, phiLength) => axial([[r0, x0], [r1, x0], [r1, x1], [r0, x1], [r0, x0]], seg, phiStart, phiLength);

// twelve slots clockwise from +V3 looking forward (model azimuth φ runs from +y toward +z = −V2)
const SLOTS = [8, 9, 10, 'T', 1, 2, 3, 4, 'T', 5, 6, 7];
export const BAY_PHI = {};                 // bay number → centre azimuth (rad)
export const TRUNNION_PHI = [];            // the two unnumbered trunnion-support bays
SLOTS.forEach((b, i) => { const p = deg(15 + i * 30); if (b === 'T') TRUNNION_PHI.push(p); else BAY_PHI[b] = p; });
const FACE = RAD.big * Math.cos(deg(15));                // 2.03 m: door plane (dodecagon apothem)
const BAY_EDGE = 2 * RAD.big * Math.sin(deg(15));        // 1.09 m door width
const X_EQ0 = ST.aftShroud, X_EQ1 = ST.equip, X_EQM = (X_EQ0 + X_EQ1) / 2;

/** Geometry built in a slot's local frame (x axial, y radius, z tangential) rotated to azimuth φ. */
const atPhi = (phi, g) => g.rotateX(phi);
const inBay = (k, g) => atPhi(BAY_PHI[k], g);
const bayBox = (k, sx, sy, sz, x, r, t = 0) => inBay(k, new THREE.BoxGeometry(sx, sy, sz).translate(x, r, t));

/**
 * Orbital replacement unit(s) in bay k: each box [sx, sy, sz, x, r, t, onDoor] (axial, radial,
 * tangential size; station; radius; tangential offset) gets connectors and an EVA handle on its
 * open face — the outer face for boxes on the bay floor, the inner face for boxes bolted to the
 * inside of the door. Returns [body mesh, detail mesh].
 */
function oru(k, boxes, mat) {
  const body = [], det = [];
  for (const [sx, sy, sz, x, r, t = 0, onDoor = false] of boxes) {
    body.push(bayBox(k, sx, sy, sz, x, r, t));
    const s = onDoor ? -1 : 1;
    const top = r + s * sy / 2;
    const n = Math.max(2, Math.min(5, Math.floor(sz / 0.1)));
    for (let i = 0; i < n; i++) {
      const tt = t - sz / 2 + ((i + 0.5) * sz) / n;
      det.push(inBay(k, new THREE.CylinderGeometry(0.022, 0.022, 0.05, 10).translate(x + sx * 0.32, top + s * 0.025, tt)));
    }
    const ht = Math.min(0.09, sz / 2 - 0.03);
    for (const dt of [-ht, ht]) det.push(inBay(k, new THREE.BoxGeometry(0.02, 0.05, 0.02).translate(x - sx * 0.3, top + s * 0.025, t + dt)));
    det.push(inBay(k, new THREE.BoxGeometry(0.022, 0.02, 2 * ht + 0.02).translate(x - sx * 0.3, top + s * 0.055, t)));
  }
  return [mesh(merge(body), mat), mesh(merge(det), HM.box())];
}

export function buildSSM(P) {
  const out = { rails: [], sockets: [] };

  // ------------------------------------------------------------------ light shield
  const ls = sunShadowShell(RAD.shell, ST.fwdShell, ST.front, HM.mliShield(), 315, 190, { seg: 48, hs: 4 });
  const lsLiner = mesh(tube(RAD.inner, ST.fwdShell, ST.front - 0.02, { seg: 96 }), HM.black());
  const lsRings = mesh(merge([flange(RAD.inner, RAD.shell + 0.04, ST.front - 0.1, ST.front), flange(RAD.shell - 0.02, RAD.shell + 0.025, ST.fwdShell - 0.04, ST.fwdShell + 0.04)]), HM.al());
  out.lightShield = P('Light shield', {
    system: 'Skin & fairings', skin: true, material: 'Machined magnesium monocoque, stiffened corrugated barrel, under MLI (15 layers aluminised Kapton, aluminised-Teflon outer layer); flat-black interior', mass: 420, temp: 245, explode: [2.6, 2.4, 0],
    desc: '4 m long with a 3 m bore, it shades the optics from sunlight, moonlight and earthshine. Its magnesium skin carries the aperture door, the forward low-gain antenna, two magnetometers, two coarse sun sensors and the latches that held the arrays and antennas folded for launch.',
  }, [...ls, lsLiner, lsRings]);
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
  const rDoor = 1.56;
  const leaf = new THREE.CylinderGeometry(rDoor, rDoor, 0.07, 72, 1, false);
  leaf.rotateZ(-Math.PI / 2).translate(0.035, -(RAD.shell + 0.07), 0);
  const leafMesh = mesh(leaf, [HM.al(), HM.mli(), HM.black()]);
  const ribs = [];
  for (const z of [-0.75, 0, 0.75]) ribs.push(new THREE.BoxGeometry(0.06, 2 * Math.sqrt(rDoor ** 2 - z * z) - 0.2, 0.08).translate(0.1, -(RAD.shell + 0.07), z));
  ribs.push(new THREE.BoxGeometry(0.06, 0.08, 2.84).translate(0.1, -(RAD.shell + 0.07), 0));
  for (const z of [-0.55, 0.55]) ribs.push(new THREE.BoxGeometry(0.1, 0.5, 0.08).translate(0.08, -0.22, z));
  doorPivot.add(leafMesh, mesh(merge(ribs), HM.al()));
  out.door = P('Aperture door', {
    system: 'Skin & fairings', skin: true, material: 'Honeycomb aluminium, aluminised FOSR tape outside, flat black inside', mass: 110, temp: 250, explode: [3.6, 2.4, 0],
    desc: 'A hinged lid about 3 m across that opens up to 105° and doubles as a sunshade. Sun sensors start it closing when the Sun comes within 35° of the optical axis and have it shut by 20°, in under a minute.',
    callout: true, anchor: [ST.door + 0.05, RAD.shell + 0.12, 0.7],
  }, doorPivot);
  out.doorPivot = doorPivot;

  const hinge = [new THREE.CylinderGeometry(0.06, 0.06, 1.5, 16).rotateX(Math.PI / 2).translate(ST.door, RAD.shell + 0.07, 0)];
  for (const z of [-0.55, 0.55]) hinge.push(new THREE.BoxGeometry(0.22, 0.12, 0.14).translate(ST.door - 0.1, RAD.shell + 0.02, z));
  hinge.push(new THREE.BoxGeometry(0.42, 0.16, 0.3).translate(12.55, RAD.shell + 0.08, 0), rod([12.75, RAD.shell + 0.1, 0.12], [ST.door - 0.05, RAD.shell + 0.08, 0.12], 0.022, 8));
  P('Aperture door hinge & drive', {
    system: 'Structure', material: 'Hinge line driven by a stepper-motor rotary drive actuator, hex fitting for manual drive', mass: 18, temp: 255, explode: [3.0, 2.6, 0],
    desc: 'One of three hinge drives on the spacecraft (the others raised the two antenna masts). A spacewalker can turn it by hand with a hex wrench if the motor fails, and a ninth latch holds the door shut for launch.',
  }, mesh(merge(hinge), HM.al()));

  // ------------------------------------------------------------------ forward shell
  const fs = sunShadowShell(RAD.shell, ST.equip, ST.fwdShell, HM.mli(), 305, 205, { seg: 48, hs: 4 });
  const fsLiner = mesh(tube(RAD.inner, ST.equip, ST.fwdShell, { seg: 96 }), HM.black());
  const fsRings = mesh(merge([flange(RAD.shell - 0.02, RAD.shell + 0.03, ST.equip, ST.equip + 0.1), flange(RAD.shell - 0.02, RAD.shell + 0.025, 7.05, 7.12)]), HM.al());
  out.fwdShell = P('Forward shell', {
    system: 'Skin & fairings', skin: true, material: 'Machined aluminium plate, external reinforcing rings, internal stiffened panels; MLI outside', mass: 650, temp: 262, explode: [0, 3.9, 0],
    desc: 'The 4 m central barrel, 3 m across, around the main baffle and secondary mirror. Its reinforcing rings are on the outside so the telescope inside has clearance. The solar-array drives, antenna masts, magnetic torquers, grapple fixtures and the OTA equipment bays bolt to it.',
  }, [...fs, fsLiner, fsRings]);
  out.fwdShell.userData.part.thermalRole = 'blanket';

  // ------------------------------------------------------------------ OTA equipment section (+V3 side of the forward shell)
  const O0 = ST.equip + 0.07, O1 = ST.equip + 0.73, OM = (O0 + O1) / 2, rO = 1.95;
  const OPHI = (i) => deg(-90 + i * 18);              // bay boundaries A…J from +V2 over the top to −V2
  const oes = [flange(RAD.shell, rO, O0, O0 + 0.02, 40, -Math.PI, Math.PI), flange(RAD.shell, rO, O1 - 0.02, O1, 40, -Math.PI, Math.PI)];
  for (let i = 0; i <= 10; i++) oes.push(atPhi(OPHI(i), new THREE.BoxGeometry(O1 - O0, rO - RAD.shell, 0.02).translate(OM, (rO + RAD.shell) / 2, 0)));
  const oDoors = [], oHw = [];
  for (let i = 0; i < 10; i++) {
    const a = OPHI(i) + deg(0.7), b = OPHI(i + 1) - deg(0.7);
    oDoors.push(shellPatch(rO + 0.01, O0 + 0.02, O1 - 0.02, a, b, { nphi: 4, nx: 1 }));
    for (const x of [O0 + 0.12, O1 - 0.12]) oHw.push(atPhi(OPHI(i) + deg(9), new THREE.CylinderGeometry(0.018, 0.018, 0.03, 8).translate(x, rO + 0.025, 0)));    // J-hook fasteners
  }
  P('OTA equipment section', {
    system: 'Structure', skin: true, material: 'Semicircular aluminium compartment ring, ten MLI-covered doors (bays A–J)', mass: 95, temp: 270, explode: [0, 1.0, 0],
    desc: 'A half-ring of ten small bays on the +V3 side of the forward shell that houses the telescope\'s own electronics, separate from the spacecraft\'s. Spacewalkers swapped boxes here too, such as the optical control electronics upgrade in 1999. Bay depth estimated.',
  }, [mesh(merge(oes), HM.al()), mesh(merge(oDoors), HM.mli()), mesh(merge(oHw), HM.al())]);
  const oBox = (i, sx, sy, sz, r) => atPhi(OPHI(i) + deg(9), new THREE.BoxGeometry(sx, sy, sz).translate(OM, r, 0));
  P('OTA electronics', {
    system: 'Avionics', material: 'Electrical power / thermal control electronics, actuator control electronics, optical control electronics', mass: 85, temp: 294, explode: [0, 1.4, 0],
    desc: 'The EP/TCE distributes power to the telescope and runs the heaters that hold the mirrors near 21 °C; the actuator control electronics drive the 24 primary and 6 secondary mirror actuators; the optical control electronics run the wavefront sensors in the guiders. Bay-by-bay layout approximate.',
  }, mesh(merge([oBox(3, 0.5, 0.24, 0.36, 1.72), oBox(4, 0.5, 0.24, 0.36, 1.72), oBox(5, 0.5, 0.24, 0.36, 1.72), oBox(6, 0.46, 0.22, 0.34, 1.71), oBox(8, 0.46, 0.2, 0.32, 1.7)]), HM.iridite()));
  P('Fine guidance electronics', {
    system: 'Attitude control', material: 'One electronics assembly per Fine Guidance Sensor', mass: 60, count: 3, temp: 294, explode: [0, 1.6, 0],
    desc: 'Each Fine Guidance Sensor has its own electronics box here: it powers and commands the sensor, does its computations and passes the guide-star error signals to the pointing system.',
  }, mesh(merge([oBox(0, 0.5, 0.24, 0.36, 1.72), oBox(1, 0.5, 0.24, 0.36, 1.72), oBox(9, 0.5, 0.24, 0.36, 1.72)]), HM.box()));

  // ------------------------------------------------------------------ equipment section structure
  const dodeca = new THREE.Shape(Array.from({ length: 12 }, (_, k) => {
    const p = deg(k * 30);
    return new THREE.Vector2(-RAD.big * Math.sin(p), RAD.big * Math.cos(p));
  }));
  const hole = new THREE.Path();
  hole.absarc(0, 0, RAD.shell, 0, Math.PI * 2, true);
  dodeca.holes.push(hole);
  const plateGeo = (x) => new THREE.ShapeGeometry(dodeca, 24).rotateY(Math.PI / 2).translate(x, 0, 0);
  const eq = [plateGeo(X_EQ0 + 0.01), plateGeo(X_EQ1 - 0.01), tube(RAD.shell, X_EQ0, X_EQ1, { seg: 64 })];
  for (let k = 0; k < 12; k++) eq.push(atPhi(deg(k * 30), new THREE.BoxGeometry(X_EQ1 - X_EQ0, RAD.big - RAD.shell, 0.025).translate(X_EQM, (RAD.big + RAD.shell) / 2, 0)));
  for (let k = 0; k < 12; k++) eq.push(atPhi(deg(k * 30), new THREE.BoxGeometry(X_EQ1 - X_EQ0 + 0.04, 0.06, 0.06).translate(X_EQM, RAD.big - 0.03, 0)));
  for (const p of TRUNNION_PHI) eq.push(atPhi(p, new THREE.BoxGeometry(X_EQ1 - X_EQ0 - 0.07, 0.03, BAY_EDGE - 0.05).translate(X_EQM, FACE + 0.015, 0)));   // trunnion-bay close-outs
  const eqMat = new THREE.MeshStandardMaterial({ color: 0x9aa1a8, roughness: 0.5, metalness: 0.7, side: THREE.DoubleSide });
  out.equip = P('Equipment section', {
    system: 'Structure', material: 'Machined, stiffened aluminium frame panels on an inner aluminium barrel', mass: 1100, temp: 278, explode: [0, 0, 0],
    desc: 'A doughnut-shaped ring of twelve trapezoidal bays, 4.2 m across, holding about 90 % of the spacecraft electronics: ten equipment bays behind hinged doors, so spacewalkers can swap boxes as orbital replacement units, and two that carry the aft trunnion pins.',
  }, mesh(merge(eq), eqMat));

  // bay doors (radiators)
  const doorNames = {
    1: 'data management', 2: 'battery module 1', 3: 'battery module 2', 4: 'power control', 5: 'communications',
    6: 'reaction wheels 1–2', 7: 'mechanism control', 8: 'pointing control', 9: 'reaction wheels 3–4', 10: 'SI C&DH',
  };
  out.bayDoors = [];
  for (let k = 1; k <= 10; k++) {
    const g = bayBox(k, X_EQ1 - X_EQ0 - 0.07, 0.03, BAY_EDGE - 0.05, X_EQM, FACE + 0.015);
    const rails = [];
    for (const t of [-0.36, 0.36]) {
      rails.push(inBay(k, rod([X_EQ0 + 0.15, FACE + 0.09, t], [X_EQ1 - 0.15, FACE + 0.09, t], 0.016, 4)));
      for (const x of [X_EQ0 + 0.2, X_EQM, X_EQ1 - 0.2]) rails.push(inBay(k, rod([x, FACE + 0.03, t], [x, FACE + 0.09, t], 0.012, 4)));
    }
    out.rails.push(...rails);
    out.sockets.push(bayBox(k, 0.1, 0.05, 0.1, X_EQ1 - 0.22, FACE + 0.05, 0));
    const hw = [];
    for (const t of [-0.38, 0, 0.38]) hw.push(inBay(k, new THREE.CylinderGeometry(0.025, 0.025, 0.16, 10).rotateX(Math.PI / 2).translate(X_EQ0 + 0.05, FACE + 0.035, t)));
    for (const [x, t] of [[X_EQ1 - 0.07, -0.47], [X_EQ1 - 0.07, 0.47], [X_EQM, -0.49], [X_EQM, 0.49], [X_EQ0 + 0.12, -0.47], [X_EQ0 + 0.12, 0.47]]) {
      hw.push(inBay(k, new THREE.CylinderGeometry(0.018, 0.018, 0.03, 8).translate(x, FACE + 0.03, t)));      // six J-hooks
    }
    hw.push(inBay(k, new THREE.BoxGeometry(0.06, 0.04, 0.16).translate(X_EQ1 - 0.08, FACE + 0.04, 0.26)));
    const wheels = k === 6 || k === 9;
    const p = P(`Bay ${k} door (${doorNames[k]})`, {
      system: 'Thermal control', skin: true, material: wheels ? 'Thermally stiffened panel door' : 'Flat honeycomb aluminium door, silvered FOSR tape and MLI pattern', mass: 22, temp: Math.round(250 + 35 * Math.cos(BAY_PHI[k])),
      explode: az(BAY_PHI[k], 1.3), desc: k === 10
        ? 'Bay 10\'s door carries the Science Instrument Command and Data Handling unit on its inner face. Like the other honeycomb doors it is a radiator: electronics bolted to it dump their heat to space.'
        : wheels
          ? `Bay ${k} door. The two reaction-wheel bays have thermally stiffened panel doors rather than the flat honeycomb equipment doors; spacewalkers open each by releasing six J-hooks.`
          : `Hinged access door and radiator for bay ${k}. Its outer face sheds the heat of the ${doorNames[k]} equipment to deep space; spacewalkers open it by releasing six J-hooks.`,
    }, [mesh(g, HM.bayDoor()), mesh(merge(hw), HM.al())]);
    p.userData.part.thermalRole = 'radiator';
    out.bayDoors.push(p);
  }

  // NOBL covers fitted in 2009 over bays 5, 7 and 8
  const nobl = [];
  for (const k of [5, 7, 8]) nobl.push(bayBox(k, X_EQ1 - X_EQ0 - 0.18, 0.02, BAY_EDGE - 0.16, X_EQM, FACE + 0.045));
  P('New outer blanket layers (NOBL)', {
    system: 'Thermal control', skin: true, material: 'Silicon-dioxide-coated stainless-steel sheet on frames', mass: 30, count: 3, temp: 250, explode: az(BAY_PHI[8], 2.0),
    desc: 'The original Teflon outer layers cracked and peeled after years of ultraviolet light and atomic oxygen. Earlier crews patched other bays; in 2009 astronauts bolted these coated stainless-steel covers over bays 5, 7 and 8 to keep the electronics behind them cool.',
  }, mesh(merge(nobl), HM.nobl()));

  // ------------------------------------------------------------------ bay contents
  const B = (k, name, info, objs) => P(name, { explode: az(BAY_PHI[k], 0.75), ...info }, objs);
  const DOOR_IN = FACE - 0.005;                     // inner face of the bay doors
  const dIU = [];                                   // data interface units, gathered from bays 3, 7, 10 and the OTA bays
  const diuBox = (k, x, r, t = 0) => dIU.push(bayBox(k, 0.38, 0.18, 0.41, x, r, t));
  // bay 1: data management
  B(1, 'Data management unit', {
    system: 'Avionics', material: 'Printed-circuit boards on a backplate, dual DC-DC converters', mass: 37.7, massSource: 'NASA SM3A Media Guide (83 lb)', temp: 296,
    desc: 'Bay 1, on the inside of the door. The spacecraft\'s data switchboard and central clock: it decodes every incoming command, encodes telemetry, receives the science data from the SI C&DH, and talks to the other boxes through four data interface units. 60 × 70 × 17 cm.',
  }, oru(1, [[0.7, 0.17, 0.6, X_EQM + 0.32, DOOR_IN - 0.085, 0, true]], HM.iridite()));
  B(1, 'Flight computer (80486)', {
    system: 'Avionics', material: 'Three radiation-tolerant Intel 80486 single-board computers', mass: 32, massSource: 'NASA SM3A Media Guide (70.5 lb)', temp: 297,
    desc: 'Installed in December 1999, replacing the 1980s DF-224 and its co-processor: three independent 25 MHz 80486 boards, one in control at a time, about 20 times faster with six times the memory. It runs pointing, safing and housekeeping. 48 × 46 × 33 cm.',
  }, oru(1, [[0.48, 0.33, 0.46, X_EQ0 + 0.36, RAD.shell + 0.175, 0]], HM.box()));
  // bays 2–3: batteries (a 90 × 90 × 25 cm module of three 22-cell batteries in each)
  const module = (k) => {
    const xm = X_EQ1 - 0.52;
    const frame = [bayBox(k, 0.9, 0.025, 0.9, xm, RAD.shell + 0.06)];
    const cells = [], handles = [];
    for (let b = 0; b < 3; b++) {
      const x = xm - 0.3 + b * 0.3;
      frame.push(bayBox(k, 0.28, 0.04, 0.86, x, RAD.shell + 0.09));
      let n = 0;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 8; j++) {
        if ((i === 1 && (j === 0 || j === 7))) continue;          // 22 cells per battery
        cells.push(inBay(k, new THREE.CylinderGeometry(0.042, 0.042, 0.22, 12).translate(x - 0.092 + i * 0.092, RAD.shell + 0.22, -0.3675 + j * 0.105)));
        n++;
      }
      void n;
    }
    for (const t of [-0.3, 0.3]) {                                  // the two big yellow EVA handles
      handles.push(inBay(k, rod([xm - 0.44, RAD.shell + 0.08, t], [xm - 0.44, RAD.shell + 0.43, t], 0.014, 6)), inBay(k, rod([xm + 0.44, RAD.shell + 0.08, t], [xm + 0.44, RAD.shell + 0.43, t], 0.014, 6)));
      handles.push(inBay(k, rod([xm - 0.44, RAD.shell + 0.43, t], [xm + 0.44, RAD.shell + 0.43, t], 0.018, 8)));
    }
    return [mesh(merge(frame), HM.iridite()), mesh(merge(cells), HM.cell()), mesh(merge(handles), HM.handrail())];
  };
  for (const [k, n] of [[2, 1], [3, 2]]) {
    const p = B(k, `Battery module ${n} (bay ${k})`, {
      system: 'Power', material: 'Three 22-cell nickel–hydrogen batteries on a common plate, 90 × 90 × 25 cm', mass: 209, massSource: 'NASA SM4 battery fact sheet (460 lb)', count: 3, temp: 274,
      desc: `Bay ${k}. Three batteries of 22 NiH₂ pressure-vessel cells in series; with the other module they carry Hubble through the ~36 minutes of shadow on every orbit. Each holds more than 75 Ah charged and has its own charge current controller. This set was installed in 2009.`,
      callout: n === 1, anchor: az(BAY_PHI[k], 2.15, X_EQM),
    }, module(k));
    p.userData.part.thermalRole = 'battery';
  }
  B(2, 'Oscillators (bay 2)', {
    system: 'Avionics', material: 'Ultra-stable quartz oscillator and a backup, 10 cm × 23 cm cylinders', mass: 2.8, massSource: 'NASA SM3A Media Guide (3 lb each)', count: 2, temp: 296,
    desc: 'The master clock: a highly stable timing pulse, distributed by the data management unit, that time-tags every observation and keeps every box in step.',
  }, mesh(merge([-0.13, 0.13].map((t) => inBay(2, new THREE.CylinderGeometry(0.05, 0.05, 0.23, 16).rotateZ(Math.PI / 2).translate(X_EQ0 + 0.25, RAD.shell + 0.1, t)))), HM.iridite()));
  diuBox(3, X_EQ0 + 0.3, RAD.shell + 0.12);
  // bay 4: power control
  B(4, 'Power control unit', {
    system: 'Power', material: 'Relay and switching electronics, 109 × 30 × 20 cm', mass: 55, massSource: 'NASA SM3A Media Guide (120 lb)', temp: 299,
    desc: 'Bay 4. Interconnects and switches the current among the solar arrays, batteries and charge controllers and feeds the main bus to the four distribution units. Replaced in 2002 on a spacewalk that required powering the whole observatory down for the first time.',
  }, oru(4, [[1.09, 0.2, 0.3, X_EQM, RAD.shell + 0.11, 0]], HM.iridite()));
  B(4, 'Power distribution units', {
    system: 'Power', material: 'Bus, switch and fuse boxes, 25 × 12.5 × 45 cm each', mass: 44, massSource: 'NASA SM3A Media Guide (25 lb each)', count: 4, temp: 296,
    desc: 'Four distribution units on the inside of the bay 4 door carry the power buses, switches, fuses and monitors: two buses feed the telescope, instruments and SI C&DH, two the spacecraft.',
  }, mesh(merge([[-0.13, X_EQM - 0.25], [0.13, X_EQM - 0.25], [-0.13, X_EQM + 0.25], [0.13, X_EQM + 0.25]].map(([t, x]) => bayBox(4, 0.45, 0.125, 0.25, x, DOOR_IN - 0.0625, t))), HM.box()));
  // bay 5: communications + recorder
  B(5, 'S-band transmitters & transponders', {
    system: 'Communications', material: 'Two S-band single-access transmitters, two multiple-access transponders', mass: 26, count: 4, temp: 297,
    desc: 'Bay 5. The single-access transmitters send science data at up to 1 Mbit/s through the high-gain antennas; the multiple-access transponders receive commands and carry low-rate telemetry through any antenna. Every link goes through NASA\'s TDRS relays.',
  }, oru(5, [[-0.17, 3.95], [0.17, 3.95], [-0.17, 4.62], [0.17, 4.62]].map(([t, x]) => [0.36, 0.17, 0.26, x, RAD.shell + 0.11, t]), HM.box()));
  B(5, 'Solid-state recorder (bay 5)', {
    system: 'Avionics', material: 'DRAM memory boards, 12 Gbit, 30 × 23 × 18 cm', mass: 11, temp: 297,
    desc: 'Stores science and engineering data between TDRS contacts: 12 gigabits, ten times a tape recorder of the same size, and no moving parts. Solid-state recorders replaced the reel-to-reel tapes in 1997 and 1999.',
  }, oru(5, [[0.3, 0.18, 0.23, X_EQM, 1.88, 0]], HM.iridite()));
  // bays 6 and 9: reaction wheels, No. 1 / No. 3 forward
  out.wheels = [];
  const wheel = (k, n, x, tilt) => {
    const g = new THREE.Group();
    const housing = mesh(new THREE.CylinderGeometry(0.295, 0.295, 0.2, 40), HM.box());
    const flangeM = mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.03, 40).translate(0, -0.1, 0), HM.al());
    const rotor = mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.07, 32), HM.rotor());
    const spokes = mesh(merge([0, 1, 2].map((i) => new THREE.BoxGeometry(0.5, 0.05, 0.04).rotateY((i * Math.PI) / 3).translate(0, 0.05, 0))), HM.ti());
    const rot = new THREE.Group();
    rot.add(rotor, spokes);
    g.add(housing, flangeM, rot);
    const c = new THREE.Vector3(x, 1.8, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), BAY_PHI[k]);
    const axis = new THREE.Vector3(Math.sin(tilt) * 0.5, Math.cos(tilt), Math.sin(tilt) * 0.86).normalize().applyAxisAngle(new THREE.Vector3(1, 0, 0), BAY_PHI[k]);
    g.position.copy(c);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
    out.wheels.push(rot);
    return B(k, `Reaction wheel assembly ${n}`, {
      system: 'Attitude control', material: 'Flywheel on ball bearings up to 3,000 rpm, brushless DC motor', mass: 45, massSource: 'NASA SM3A Media Guide (about 100 lb)', temp: 300,
      desc: `Bay ${k}, ${n % 2 ? 'forward' : 'aft'} position. Spinning a 59 cm flywheel faster or slower turns the telescope the other way — no propellant, no thruster vibration. Four wheels with skewed axes, any three enough; they slew Hubble about 90° in 15 minutes, as slow as a minute hand.`,
      callout: n === 1, anchor: c.clone().addScaledVector(axis, 0.3).toArray(),
    }, g);
  };
  wheel(6, 1, X_EQ1 - 0.42, -0.35); wheel(6, 2, X_EQ0 + 0.42, 0.35);
  wheel(9, 3, X_EQ1 - 0.42, -0.35); wheel(9, 4, X_EQ0 + 0.42, 0.35);
  // bay 7: mechanism control
  B(7, 'Mechanism control unit', {
    system: 'Avionics', material: 'Stepper-motor driver electronics', mass: 20, temp: 296,
    desc: 'Bay 7. Drives the rotary drive actuators of the nine latches and three hinge drives (aperture door and antenna masts) and the high-gain antenna gimbals.',
  }, oru(7, [[0.7, 0.26, 0.44, X_EQ0 + 0.45, RAD.shell + 0.15, -0.06]], HM.box()));
  B(7, 'Solar array drive electronics', {
    system: 'Power', material: 'Two stepper-motor controllers (SADE), one per wing', mass: 16, count: 2, temp: 297,
    desc: 'Bay 7. Each unit steps its wing\'s drive so the cells keep facing the Sun as Hubble points around the sky. One was replaced on the 1997 servicing mission. Position within the bay approximate.',
  }, oru(7, [[0.36, 0.2, 0.26, X_EQ1 - 0.35, RAD.shell + 0.12, -0.17], [0.36, 0.2, 0.26, X_EQ1 - 0.35, RAD.shell + 0.12, 0.17]], HM.iridite()));
  diuBox(7, X_EQ1 - 0.4, DOOR_IN - 0.1);
  // bay 8: pointing control + recorder
  B(8, 'Pointing control electronics', {
    system: 'Attitude control', material: 'Pointing/Safemode Electronics Assembly (40 circuit boards) and Retrieval Mode Gyro Assembly', mass: 42, temp: 296,
    desc: 'Bay 8. The independent safe-mode computer: if the flight computer stops sending its keep-alive signal, it takes over, turns the arrays to the Sun using the sun sensors and its own low-grade gyros, and sheds power until the ground steps in. Box breakdown approximate.',
  }, oru(8, [[0.8, 0.28, 0.5, X_EQ0 + 0.5, RAD.shell + 0.16, 0.08], [0.3, 0.16, 0.25, X_EQ1 - 0.35, RAD.shell + 0.1, 0.2]], HM.box()));
  B(8, 'Solid-state recorder (bay 8)', {
    system: 'Avionics', material: 'DRAM memory boards, 12 Gbit, 30 × 23 × 18 cm', mass: 11, temp: 297,
    desc: 'Second solid-state recorder (1999). Hubble can store a day of observations and play them back through the high-gain antennas when a TDRS satellite is in view.',
  }, oru(8, [[0.3, 0.18, 0.23, X_EQ1 - 0.35, 1.88, -0.12]], HM.iridite()));
  // bay 10: SI C&DH on the door, gyro electronics on the floor
  const sic = [bayBox(10, 1.3, 0.025, 0.95, X_EQM, DOOR_IN - 0.0125)];
  for (let i = 0; i < 3; i++) for (const t of [-0.2, 0.2]) sic.push(bayBox(10, 0.36, 0.2, 0.34, X_EQ0 + 0.35 + i * 0.4, DOOR_IN - 0.125, t));
  B(10, 'Science instrument command & data handling unit', {
    system: 'Avionics', material: 'Fourteen boxes in six stacks on one tray: NASA standard spacecraft computer, control unit/science data formatter, power units', mass: 107, temp: 298,
    desc: 'Bay 10. Commands the instruments and formats their data for the data management unit. Its side A failed in September 2008, delaying the last servicing mission; astronauts installed a replacement in May 2009.',
  }, mesh(merge(sic), HM.iridite()));
  B(10, 'Gyro electronics control units', {
    system: 'Attitude control', material: 'Three dual-string electronics control units', mass: 21, count: 3, temp: 297,
    desc: 'Bay 10. Each rate gyro assembly pairs a sensor unit in the aft shroud with an electronics control unit here that processes the two gyros\' outputs.',
  }, mesh(merge([0, 1, 2].map((i) => bayBox(10, 0.3, 0.14, 0.24, X_EQ0 + 0.3 + i * 0.36, RAD.shell + 0.08, -0.14))), HM.box()));
  diuBox(10, X_EQ1 - 0.3, RAD.shell + 0.1, 0.2);
  dIU.push(new THREE.BoxGeometry(0.38, 0.2, 0.34).translate(OM, 1.72, 0).rotateX(OPHI(7) + deg(9)));        // the OTA DIU
  P('Data interface units', {
    system: 'Avionics', material: 'Dual-redundant command/data interface boxes, 38 × 41 × 18 cm', mass: 64, massSource: 'NASA SM3A Media Guide (35 lb each)', count: 4, temp: 296,
    desc: 'Four relay boxes between the data management unit and the rest of the electronics: in bays 3, 7 and 10 and in the OTA equipment section. Each is two complete units in one, so either half can do the job.',
  }, mesh(merge(dIU), HM.box()));

  // ------------------------------------------------------------------ aft shroud
  const shroud = sunShadowShell(RAD.big, ST.bulkhead, ST.aftShroud, HM.mli(), 300, 215, { seg: 64, hs: 3 });
  const shroudRings = mesh(merge([flange(RAD.big - 0.02, RAD.big + 0.035, ST.bulkhead, ST.bulkhead + 0.09, 128), flange(RAD.big - 0.02, RAD.big + 0.035, ST.aftShroud - 0.09, ST.aftShroud, 128)]), HM.al());
  out.aftShroud = P('Aft shroud', {
    system: 'Skin & fairings', skin: true, material: 'Stiffened aluminium skin, internal panels and rings, 16 longeron bars; silvered FOSR tape outside', mass: 1050, temp: 270, explode: [-1.6, -4.0, 0],
    desc: 'The 3.5 m housing, 4.3 m across, around the focal plane: four axial instruments, the radial camera, three Fine Guidance Sensors, the gyros and the star trackers. Lights inside illuminate the bays for spacewalkers, and every vent is light-tight.',
  }, [...shroud, shroudRings]);
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
  for (const c of [45, 135, 225, 315]) for (const [edge, hingeSide] of [[c - 27, 1], [c + 27, -1]]) {
    // hinge knuckles along the outer edge of each door, axis parallel to the telescope
    for (const x of [0.6, 1.35, 2.1]) frames.push(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 10).rotateZ(Math.PI / 2).translate(x, rD + 0.02, 0).rotateX(deg(edge)));
    frames.push(new THREE.BoxGeometry(0.18, 0.05, 0.06).translate(1.35, rD + 0.03, 0).rotateX(deg(c + hingeSide * 3)));
  }
  doors.push(shellPatch(rD, 2.48, 3.42, deg(118), deg(152), { nphi: 10 }));
  frames.push(...patchFrame(rD + 0.008, 2.48, 3.42, deg(118), deg(152), 0.014, rod));
  P('Aft shroud access doors', {
    system: 'Skin & fairings', skin: true, material: 'Hinged honeycomb doors with light-tight seals; radiation shields inside', mass: 160, count: 9, temp: 268, explode: [-1.4, -4.4, 0],
    desc: 'Paired doors open onto each axial instrument bay, and one onto the star trackers and rate-sensor units. Door layout simplified from servicing-mission photographs.',
  }, [mesh(merge(doors), HM.bayDoor()), mesh(merge(frames), HM.al())]);
  const rdoors = [], rframes = [];
  for (const c of [0, 90, 270]) {
    rdoors.push(shellPatch(rD, 1.78, 3.38, deg(c - 14), deg(c + 14), { nphi: 8 }));
    rframes.push(...patchFrame(rD + 0.008, 1.78, 3.38, deg(c - 14), deg(c + 14), 0.014, rod));
  }
  P('Radial bay doors (FGS)', {
    system: 'Skin & fairings', skin: true, material: 'Hinged honeycomb doors', mass: 45, count: 3, temp: 266, explode: [0, 0, 0],
    desc: 'Doors over the three Fine Guidance Sensor bays, near the joint with the equipment section. The radial camera has none: its own radiator forms that part of the shroud skin.',
  }, [mesh(merge(rdoors), HM.bayDoor()), mesh(merge(rframes), HM.al())]);

  // ------------------------------------------------------------------ aft bulkhead and servicing interfaces
  const bh = [tube(RAD.big - 0.01, 0, ST.bulkhead, { seg: 96, open: false })];
  for (const p of [60, 180, 300]) bh.push(atPhi(deg(p), new THREE.BoxGeometry(0.1, 1.55, 0.12).translate(-0.05, 0.98, 0)));   // pin support beams
  bh.push(tube(0.42, -0.05, 0, { seg: 40, open: false }));
  out.bulkhead = P('Aft bulkhead', {
    system: 'Structure', skin: true, material: '2 in (5 cm) honeycomb aluminium panels, three radial aluminium beams; silvered FOSR tape', mass: 250, temp: 262, explode: [-3.4, 0, 0],
    desc: 'Closes the back of the telescope. Its three radial beams carry the berthing pins; it also holds the aft low-gain antenna, the umbilical connectors and, since 2009, the soft-capture mechanism.',
  }, mesh(merge(bh), new THREE.MeshStandardMaterial({ color: 0xaab0b6, roughness: 0.48, metalness: 0.75 })));

  const pins = [];
  for (const p of [60, 180, 300]) {
    pins.push(new THREE.BoxGeometry(0.12, 0.22, 0.22).translate(...az(deg(p), 1.55, -0.06)));
    pins.push(new THREE.CylinderGeometry(0.045, 0.045, 0.26, 16).rotateZ(Math.PI / 2).translate(...az(deg(p), 1.55, -0.24)));
    pins.push(new THREE.SphereGeometry(0.07, 16, 10).translate(...az(deg(p), 1.55, -0.38)));
  }
  P('Berthing pins', {
    system: 'Structure', material: 'Titanium Flight Support System pins', mass: 15, count: 3, temp: 262, explode: [-3.6, 0, 0],
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
    system: 'Structure', material: 'Aluminium docking ring with guide petals (LIDS/NDS-compatible), clamped to the berthing pins', mass: 440, temp: 262, explode: [-4.4, 0, 0],
    desc: 'Fitted on the last servicing mission in 2009 so that a future spacecraft can dock and steer Hubble to a safe re-entry, or boost it. The three petals guide a docking ring into its latches.',
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
  for (const p of TRUNNION_PHI) {
    tr.push(atPhi(p, new THREE.CylinderGeometry(0.075, 0.075, 0.42, 20).translate(X_EQM, FACE + 0.21, 0)));
    tr.push(atPhi(p, new THREE.CylinderGeometry(0.11, 0.11, 0.06, 20).translate(X_EQM, FACE + 0.43, 0)));
    tr.push(atPhi(p, new THREE.BoxGeometry(0.5, 0.06, 0.5).translate(X_EQM, FACE + 0.06, 0)));
  }
  P('Aft trunnion pins', {
    system: 'Structure', material: 'Titanium trunnion pins on reinforced fittings', mass: 40, count: 2, temp: 270, explode: [0, -0.3, 0],
    desc: 'The two unnumbered bays of the equipment section exist to carry these pins and their scuff plates. They sat in the payload bay\'s longeron latches at launch in 1990 and carried the telescope through ascent.',
  }, mesh(merge(tr), HM.ti()));
  P('Forward trunnion', {
    system: 'Structure', material: 'Titanium trunnion pin', mass: 18, temp: 270, explode: [0, -0.6, 0],
    desc: 'The forward shell carries one more trunnion that locked into a payload-bay latch for launch. Its exact azimuth and station here are approximate.',
  }, mesh(merge([atPhi(deg(180), new THREE.CylinderGeometry(0.07, 0.07, 0.42, 20).translate(6.3, RAD.shell + 0.21, 0)), atPhi(deg(180), new THREE.BoxGeometry(0.36, 0.05, 0.36).translate(6.3, RAD.shell + 0.025, 0))]), HM.ti()));

  // grapple fixtures for the Shuttle's robot arm, next to the high-gain antenna drives
  const gf = [];
  for (const p of [340, 160]) {
    gf.push(new THREE.BoxGeometry(0.4, 0.05, 0.4).translate(6.95, RAD.shell + 0.03, 0).rotateX(deg(p)));
    gf.push(new THREE.CylinderGeometry(0.04, 0.05, 0.3, 14).translate(6.95, RAD.shell + 0.2, 0).rotateX(deg(p)));
    gf.push(new THREE.BoxGeometry(0.14, 0.04, 0.05).translate(6.95, RAD.shell + 0.34, 0).rotateX(deg(p)));
    gf.push(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 8).translate(7.19, RAD.shell + 0.16, 0.12).rotateX(deg(p)));
    gf.push(new THREE.CylinderGeometry(0.06, 0.06, 0.01, 16).translate(7.19, RAD.shell + 0.28, 0.12).rotateX(deg(p)));
  }
  P('Grapple fixtures', {
    system: 'Structure', material: 'Aluminium fixtures with grapple shaft, cam and alignment target', mass: 24, count: 2, temp: 262, explode: [0, 0, 0],
    desc: 'The Shuttle\'s robot arm closed its end-effector snares on these shafts, beside the high-gain antenna drives, to pluck Hubble out of orbit for servicing and release it afterwards. Exact positions approximate.',
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
  // forward shell: four longitudinal rails between the masts and torquers, and a ring rail
  const rF = RAD.shell + 0.09;
  for (const c of [22.5, 112.5, 202.5, 292.5]) {
    rail(az(deg(c), rF, 5.95), az(deg(c), rF, 8.85));
    for (let x = 6.0; x < 8.9; x += 0.7) standoff(deg(c), RAD.shell, x);
  }
  for (let a = 0; a < 360; a += 30) {
    rail(az(deg(a + 3), rF, 5.9), az(deg(a + 27), rF, 5.9));
    standoff(deg(a + 15), RAD.shell, 5.9);
  }
  P('EVA handrails', {
    system: 'Crew systems', material: 'Yellow-painted aluminium rails on stand-offs', mass: 95, temp: 265, explode: [0, 0, 0],
    desc: 'Hubble was designed to be repaired by hand: 225 ft (69 m) of handrails let spacewalkers move hand over hand to every door. Five servicing missions between 1993 and 2009 used them. Rail runs simplified.',
  }, mesh(merge(out.rails), HM.handrail()));

  // 31 portable-foot-restraint sockets (10 on the bay doors above, 21 placed here)
  for (let k = 0; k < 12; k++) out.sockets.push(new THREE.BoxGeometry(0.1, 0.06, 0.1).translate(0, RAD.big + 0.03, 0).rotateX(deg(k * 30 + 15)).translate(k % 2 ? 3.3 : 0.55, 0, 0));
  for (const [x, c] of [[6.25, 30], [6.25, 150], [6.25, 210], [6.25, 330], [7.7, 90], [7.7, 270], [8.6, 60], [8.6, 240], [8.6, 0]]) {
    out.sockets.push(new THREE.BoxGeometry(0.1, 0.06, 0.1).translate(x, RAD.shell + 0.03, 0).rotateX(deg(c)));
  }
  P('Foot-restraint sockets', {
    system: 'Crew systems', material: 'Aluminium sockets for portable foot restraints', mass: 12, count: 31, temp: 265, explode: [0, 0, 0],
    desc: '31 sockets accept the portable foot restraint, a platform that locks an astronaut\'s boots in place so both hands are free to work. Socket positions approximate.',
  }, mesh(merge(out.sockets), HM.handrail()));

  return out;
}
