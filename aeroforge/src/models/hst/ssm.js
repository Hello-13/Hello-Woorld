// Support Systems Module (Lockheed Martin): the spacecraft wrapped around the telescope.
// Stacked cylinders from front to back — aperture door, light shield, forward shell, the ring of
// equipment bays, aft shroud and aft bulkhead — plus the servicing hardware added for spacewalkers
// and, in 2009, the soft-capture mechanism.
//
// Equipment section (SM3A and SM4 Media Reference Guides §5, Figs. 5-7 and 5-13): twelve 30°
// trapezoidal slots, 1 m wide at the door, 0.78 m at the inner barrel and 1.5 m deep. Going
// clockwise from +V3 looking forward: bay 8 pointing control, 9 reaction wheels, 10 SI C&DH, a
// trunnion bay, 1 data management, 2–3 batteries, 4 power control, a trunnion bay,
// 5 communications, 6 reaction wheels, 7 mechanism control. Box sizes are the guides' where they
// give them. The OTA equipment section (nine small bays, A–H and J, for the telescope's own
// electronics) rides on the forward shell.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { rod, mergeGeometries } from '../../engine/geometry.js';
import { ST, RAD, az, deg, axial, tube, annulus, shellPatch, patchFrame, ni, cablePath, arcPts, pathLength } from './layout.js';
import { HM } from './materials.js';

const merge = (list) => mergeGeometries(list.map(ni));

/**
 * An outer shell as two half-cylinders, the +V3 (Sun) side and the −V3 (shadow) side, each with
 * its own temperature for the Thermal view: Hubble keeps the Sun on its +V3 side.
 * mat may be one material or [sun-side, shadow-side].
 */
function sunShadowShell(r, x0, x1, mat, tSun, tShade, opts = {}) {
  const [mSun, mShade] = Array.isArray(mat) ? mat : [mat, mat];
  // CylinderGeometry θ runs from +z toward +x; after tube()'s rotation, θ ∈ [−π, 0] is the y > 0 half
  const sun = mesh(tube(r, x0, x1, { ...opts, thetaStart: -Math.PI, thetaLength: Math.PI }), mSun);
  const shade = mesh(tube(r, x0, x1, { ...opts, thetaStart: 0, thetaLength: Math.PI }), mShade);
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
export const FACE = RAD.big * Math.cos(deg(15));         // 2.03 m: door plane (dodecagon apothem)
const BAY_EDGE = 2 * RAD.big * Math.sin(deg(15));        // 1.09 m door width
export const X_EQ0 = ST.aftShroud, X_EQ1 = ST.equip, X_EQM = (X_EQ0 + X_EQ1) / 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
/** Connector points (world) of the boxes in each bay, for the harness drops; filled by oru(). */
export const CONN = {};

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
function oru(k, boxes, mat, { coax = 0 } = {}) {
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
    for (let i = 0; i < coax; i++) det.push(inBay(k, new THREE.CylinderGeometry(0.0125, 0.0125, 0.04, 8).translate(x + sx * 0.12, top + s * 0.02, t - 0.06 + i * 0.06)));
    (CONN[k] || (CONN[k] = [])).push(new THREE.Vector3(x + sx * 0.32, top + s * 0.05, t).applyAxisAngle(X_AXIS, BAY_PHI[k]).toArray());
    const ht = Math.min(0.09, sz / 2 - 0.03);
    for (const dt of [-ht, ht]) det.push(inBay(k, new THREE.BoxGeometry(0.02, 0.05, 0.02).translate(x - sx * 0.3, top + s * 0.025, t + dt)));
    det.push(inBay(k, new THREE.BoxGeometry(0.022, 0.02, 2 * ht + 0.02).translate(x - sx * 0.3, top + s * 0.055, t)));
  }
  return [mesh(merge(body), mat), mesh(merge(det), HM.box())];
}

const addConn = (k, x, r, t = 0) => (CONN[k] || (CONN[k] = [])).push(new THREE.Vector3(x, r, t).applyAxisAngle(X_AXIS, BAY_PHI[k]).toArray());

export function buildSSM(P) {
  for (const k of Object.keys(CONN)) delete CONN[k];
  const out = { sockets: [], conn: CONN, railLength: {} };
  const rails = { ls: [], fs: [], eq: [], aft: [] };          // EVA handrail runs by region
  const railLen = { ls: 0, fs: 0, eq: 0, aft: 0 };
  const listKey = (list) => Object.keys(rails).find((k) => rails[k] === list);
  const rail = (list, p0, p1) => { list.push(rod(p0, p1, 0.016, 4)); railLen[listKey(list)] += pathLength([p0, p1]); };
  const standoff = (list, phi, r, x, h = 0.07) => list.push(rod(az(phi, r, x), az(phi, r + h, x), 0.012, 4));
  // portable-foot-restraint socket: a 10 cm square receptacle on a doubler plate, base at radius r
  const socket = (x, r, phi) => {
    const g = [new THREE.BoxGeometry(0.16, 0.012, 0.16).translate(x, r + 0.006, 0)];
    for (const s of [-1, 1]) g.push(new THREE.BoxGeometry(0.1, 0.05, 0.012).translate(x, r + 0.037, s * 0.044), new THREE.BoxGeometry(0.012, 0.05, 0.076).translate(x + s * 0.044, r + 0.037, 0));
    for (const m of g) out.sockets.push(m.rotateX(phi));
  };

  // ------------------------------------------------------------------ light shield
  const ls = sunShadowShell(RAD.shell, ST.fwdShell, ST.front, [HM.mliShield(), HM.mliShield(1)], 315, 190, { seg: 48, hs: 4 });
  const lsLiner = mesh(tube(RAD.inner, ST.fwdShell, ST.front - 0.02, { seg: 96 }), HM.black());
  const lsRings = mesh(merge([flange(RAD.inner, RAD.shell + 0.04, ST.front - 0.1, ST.front), flange(RAD.shell - 0.02, RAD.shell + 0.025, ST.fwdShell - 0.04, ST.fwdShell + 0.04)]), HM.al());
  out.lightShield = P('Light shield', {
    system: 'Skin & fairings', skin: true, material: 'Machined magnesium monocoque, stiffened corrugated barrel, under MLI (15 layers aluminised Kapton, aluminised-Teflon outer layer); flat-black interior', mass: 380, temp: 245, explode: [2.6, 2.4, 0],
    desc: '4 m long with a 3 m bore, it shades the optics from sunlight, moonlight and earthshine. Its magnesium skin carries the aperture door, the forward low-gain antenna, two magnetometers, two coarse sun sensors, the high-gain antenna launch latches and a pair of scuff plates.',
  }, [...ls, lsLiner, lsRings]);
  out.lightShield.userData.part.thermalRole = 'blanket';

  const lb = [];
  for (let k = 0; k < 10; k++) lb.push(annulus(1.33, RAD.inner, 9.35 + k * 0.37, 96, 1));
  P('Light shield internal baffles', {
    system: 'Optics', skin: true, material: 'Flat-black aluminium rings on the light-shield liner', mass: 40, count: 10, temp: 250, explode: [2.0, 0, 0],
    desc: 'Ten sharp-edged rings inside the light shield catch light glancing in from bright sources off the axis, the first stage of Hubble\'s stray-light defence. Each is a knife edge 17 cm deep, so light that hits one is trapped between the rings.',
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

  // high-gain antenna launch latches: the masts and dishes lay along the +V3 and −V3 sides of
  // the forward shell and light shield until the 1990 deployment
  const hl = [];
  for (const p of [0, 180]) for (const x of [10.0, 10.95]) {
    hl.push(atPhi(deg(p), new THREE.BoxGeometry(0.22, 0.08, 0.3).translate(x, RAD.shell + 0.04, 0)));
    hl.push(atPhi(deg(p), new THREE.BoxGeometry(0.06, 0.14, 0.05).translate(x + 0.05, RAD.shell + 0.13, 0.1)));
    hl.push(atPhi(deg(p), new THREE.CylinderGeometry(0.025, 0.025, 0.3, 10).rotateX(Math.PI / 2).translate(x - 0.06, RAD.shell + 0.1, 0)));
  }
  P('High-gain antenna launch latches', {
    system: 'Structure', material: 'Hook latches on four-bar linkages, each driven by a stepper-motor rotary drive actuator', mass: 12, count: 4, temp: 245, explode: [2.6, 2.4, 0],
    desc: 'They held the two antenna masts and dishes flat against the light shield for launch; the mechanism control unit released them on the first day in orbit. Like all nine of Hubble\'s latches they work through a four-bar linkage driven by a rotary drive actuator, with a hex fitting for a spacewalker\'s wrench. Positions along the shield approximate.',
  }, mesh(merge(hl), HM.fitting()));
  const lr = [];
  for (const x of [10.0, 10.95]) lr.push(flange(RAD.shell - 0.01, RAD.shell + 0.025, x - 0.025, x + 0.025, 96));
  P('HGA & SA latch support rings', {
    system: 'Structure', material: 'Machined rings, 50 mm wide, on the light shield barrel', mass: 16, count: 2, temp: 245, explode: [2.6, 2.4, 0], xrayWeight: 0.4,
    desc: 'The structural rings the launch latches bolt to: they carried the stowed antennas and the old roll-up arrays through ascent. Ring stations approximate.',
  }, mesh(merge(lr), HM.al()));
  const sal = [];
  for (const p of [90, 270]) for (const x of [10.0, 10.95]) {
    sal.push(atPhi(deg(p), new THREE.BoxGeometry(0.2, 0.1, 0.25).translate(x, RAD.shell + 0.05, 0.38)));
    sal.push(atPhi(deg(p), new THREE.BoxGeometry(0.05, 0.12, 0.06).translate(x + 0.05, RAD.shell + 0.14, 0.45)));
  }
  P('Solar array launch latches (unused)', {
    system: 'Structure', material: 'Hook latches on four-bar linkages with rotary drive actuators', mass: 10, count: 4, temp: 245, explode: [2.6, 0, 0],
    desc: 'Four of Hubble\'s nine latches held the original roll-up solar arrays along the ±V2 sides for launch. The rigid SA3 wings fitted in 2002 never stow, so these have not been used since. Positions approximate.',
  }, mesh(merge(sal), HM.fitting()));

  // scuff plates on the ±V2 sides of the light shield (the aft pair rides on the trunnion bays)
  const scuff = (phi, x, r0, list) => {
    const out2 = list;
    out2.push(atPhi(phi, new THREE.BoxGeometry(0.6, 0.025, 0.5).translate(x, r0 + 0.76, 0)));
    for (const [dx, dt] of [[-0.24, -0.19], [-0.24, 0.19], [0.24, -0.19], [0.24, 0.19]]) out2.push(atPhi(phi, rod([x + dx * 0.6, r0, dt * 0.6], [x + dx, r0 + 0.75, dt], 0.022, 6)));
    out2.push(atPhi(phi, new THREE.BoxGeometry(0.36, 0.03, 0.3).translate(x, r0 + 0.015, 0)));
  };
  const sp = [];
  scuff(deg(90), 10.5, RAD.shell, sp);
  scuff(deg(270), 10.5, RAD.shell, sp);
  for (const p of TRUNNION_PHI) scuff(p, X_EQ0 + 0.4, FACE + 0.03, sp);
  P('Scuff plates', {
    system: 'Crew systems', material: 'Aluminium plates on strut frames, about 30 in (0.76 m) proud of the skin', mass: 40, count: 4, temp: 255, explode: [0, 0, 0],
    desc: 'Large protective plates standing off the skin: a pair on the ±V2 sides of the light shield and a pair on the two trunnion bays. They kept Hubble from scraping the payload-bay structure while it was lowered onto its berthing pins, and give spacewalkers something to hold. Plate size estimated.',
  }, mesh(merge(sp), HM.al()));

  // light shield handrails: two rings (open over the antenna latch lines) and four runs along the barrel
  for (const [a0, a1] of [[28, 77], [103, 152], [208, 257], [283, 332]]) {
    const pts = arcPts(RAD.shell + 0.09, 9.45, a0, a1, 12);
    for (let i = 0; i < pts.length - 1; i++) rail(rails.ls, pts[i], pts[i + 1]);
    for (let a = a0 + 4; a < a1; a += 16) standoff(rails.ls, deg(a), RAD.shell, 9.45);
  }
  for (const c of [45, 135, 225, 315]) {
    rail(rails.ls, az(deg(c), RAD.shell + 0.09, 9.25), az(deg(c), RAD.shell + 0.09, 12.3));
    for (let x = 9.3; x < 12.35; x += 0.75) standoff(rails.ls, deg(c), RAD.shell, x);
  }

  // ------------------------------------------------------------------ forward shell
  const fs = sunShadowShell(RAD.shell, ST.equip, ST.fwdShell, [HM.mli(), HM.mli(1)], 305, 205, { seg: 48, hs: 4 });
  const fsLiner = mesh(tube(RAD.inner, ST.equip, ST.fwdShell, { seg: 96 }), HM.black());

  out.fwdShell = P('Forward shell', {
    system: 'Skin & fairings', skin: true, material: 'Machined aluminium plate, external reinforcing rings, internal stiffened panels; MLI outside', mass: 440, temp: 262, explode: [0, 3.9, 0],
    desc: 'The 4 m central barrel, 3 m across, around the main baffle and secondary mirror. Its reinforcing rings are on the outside so the telescope inside has clearance. The solar-array drives, antenna masts, magnetic torquers, grapple fixtures and the OTA equipment bays bolt to it.',
  }, [...fs, fsLiner]);
  out.fwdShell.userData.part.thermalRole = 'blanket';
  const fsr = [flange(RAD.shell - 0.02, RAD.shell + 0.03, ST.equip, ST.equip + 0.1)];
  for (const x of [6.0, 7.08, 8.2]) fsr.push(flange(RAD.shell - 0.005, RAD.shell + 0.03, x - 0.035, x + 0.035));
  P('Forward shell reinforcing rings', {
    system: 'Structure', material: 'Machined aluminium rings outside the skin', mass: 80, count: 4, temp: 262, explode: [0, 3.9, 0], xrayWeight: 0.3,
    desc: 'The forward shell is stiffened from the outside so the main baffle and secondary mirror inside have full clearance. The aft ring bolts the shell to the equipment section. Ring stations approximate.',
  }, mesh(merge(fsr), HM.al()));

  // patches over cracked outer blanket layers (1997 servicing); positions illustrative
  const pt = [];
  for (const [r, x0, x1, a0, a1] of [[RAD.shell + 0.006, 10.3, 11.0, -30, -8], [RAD.shell + 0.006, 11.6, 12.3, 18, 42], [RAD.shell + 0.006, 9.6, 10.1, 300, 318], [RAD.shell + 0.006, 7.5, 8.3, 25, 40]]) pt.push(shellPatch(r, x0, x1, deg(a0), deg(a1), { nphi: 4, nx: 1 }));
  P('MLI repair patches', {
    system: 'Thermal control', skin: true, material: 'Teflon patches over torn outer blanket layers', mass: 2, count: 4, temp: 300, explode: [0, 4.4, 0],
    desc: 'By 1997 the outer Teflon layer of the blankets was cracking and peeling after years of ultraviolet light and atomic oxygen; spacewalkers patched the worst tears, and later crews fitted the stainless-steel NOBL covers over the bay doors. Patch positions illustrative.',
  }, mesh(merge(pt), HM.mli(9)));

  // ------------------------------------------------------------------ OTA equipment section (on the forward shell)
  // nine bays A–H, J over the +V3 half; lettering runs from +V2 over the top to −V2 (assumed)
  const O0 = ST.equip + 0.07, O1 = ST.equip + 0.73, OM = (O0 + O1) / 2, rO = 1.95;
  const OPHI = (i) => deg(-90 + i * 20);              // bay boundaries
  const OMID = (i) => OPHI(i) + deg(10);              // bay centres
  const oes = [flange(RAD.shell, rO, O0, O0 + 0.02, 40, -Math.PI, Math.PI), flange(RAD.shell, rO, O1 - 0.02, O1, 40, -Math.PI, Math.PI)];
  for (let i = 0; i <= 9; i++) oes.push(atPhi(OPHI(i), new THREE.BoxGeometry(O1 - O0, rO - RAD.shell, 0.02).translate(OM, (rO + RAD.shell) / 2, 0)));
  const oHw = [];
  for (let i = 0; i < 9; i++) for (const x of [O0 + 0.1, OM, O1 - 0.1]) oHw.push(atPhi(OMID(i), new THREE.CylinderGeometry(0.018, 0.018, 0.03, 8).translate(x, rO + 0.025, 0)));    // three J-hooks per door
  P('OTA equipment section', {
    system: 'Structure', material: 'Semicircular aluminium compartment ring: two flanges and ten bay walls', mass: 70, temp: 270, explode: [0, 5.6, 0],
    desc: 'A half-ring of nine small bays outside the forward shell, seven for the telescope\'s own electronics and two for support, separate from the spacecraft\'s. NASA\'s text puts it on the +V3 side, but its own figure drawn looking forward shows it on the −V3 half, so the side is uncertain; bay depth estimated.',
  }, [mesh(merge(oes), HM.al()), mesh(merge(oHw), HM.al())]);
  const oDoors = [];
  for (let i = 0; i < 9; i++) oDoors.push(shellPatch(rO + 0.01, O0 + 0.02, O1 - 0.02, OPHI(i) + deg(0.7), OPHI(i + 1) - deg(0.7), { nphi: 4, nx: 1 }));
  P('OTA equipment section doors', {
    system: 'Skin & fairings', skin: true, material: 'Nine outward-opening doors under MLI, with heaters and insulation behind', mass: 25, count: 9, temp: 268, explode: [0, 6.3, 0],
    desc: 'Every OTA bay has its own outward-opening door held by three J-hooks, so spacewalkers could reach the boxes: in 1999 one opened the bay C door this way to plug an enhancement-kit harness into the optical control electronics.',
  }, mesh(merge(oDoors), HM.mli()));
  const oBox = (i, sx, sy, sz, r = 1.72) => atPhi(OMID(i), new THREE.BoxGeometry(sx, sy, sz).translate(OM, r, 0));
  const OTA_BOX = (name, info, bays, dims = [0.5, 0.24, 0.36], mat = HM.iridite()) => P(name, { explode: [0, 5.9, 0], temp: 294, xrayWeight: 0.5, ...info }, mesh(merge(bays.map((i) => oBox(i, ...dims))), mat));
  // bays A–H, J are indices 0–8. The OCE is in bay C (the 1999 spacewalk opened bay C to reach its
  // J11 connector), the DIU beside it and the EP/TCE on the far side (SM3A Fig. 5-25); A and J are
  // taken as the two support bays and the rest are assigned approximately
  out.oes = { phi: OMID, phiDeg: (i) => -80 + i * 20, r: 1.72, x: OM, bays: { oce: 2, diu: 3, ace: 5, eptce: 6, fge: [1, 4, 7] } };
  OTA_BOX('OTA electrical power & thermal control electronics', {
    system: 'Power', material: 'EP/TCE: power switching and heater controllers', mass: 30,
    desc: 'Distributes power from the spacecraft to the telescope\'s electronics and runs the thermostat-controlled heaters that hold the primary and secondary near 21 °C, so the optics keep their shape and spacing. Drawn on the far side of the section from the OCE (SM3A Fig. 5-25); bay G assumed.',
  }, [6]);
  OTA_BOX('Actuator control electronics', {
    system: 'Optics', material: 'ACE: stepper-motor drivers for the mirror actuators', mass: 15,
    desc: 'Picks which of the 24 primary-mirror and 6 secondary-mirror actuators to move and checks each one\'s response — the hardware behind every focus adjustment made since 1990. Bay assignment approximate.',
  }, [5], [0.46, 0.22, 0.34]);
  OTA_BOX('Optical control electronics', {
    system: 'Optics', material: 'OCE: wavefront-sensor electronics, upgraded with an enhancement kit in 1999 and 2009', mass: 25,
    desc: 'Bay C. Runs the optical control sensors — small wavefront sensors inside the Fine Guidance Sensors — that measure the telescope\'s focus and alignment. In 1999 a spacewalker opened the bay C door by its three J-hooks and plugged the enhancement kit\'s harness into its J11 connector; the 2009 kit lets FGS-2R2 realign its own optics in orbit.',
  }, [2]);
  OTA_BOX('Fine guidance electronics', {
    system: 'Attitude control', material: 'One electronics assembly per Fine Guidance Sensor', mass: 60, count: 3,
    desc: 'Each Fine Guidance Sensor has its own electronics box here: it powers and commands the sensor, does its computations and passes the guide-star error signals to the pointing system. Bays assigned by the side of each sensor, approximate.',
  }, [1, 4, 7], [0.5, 0.24, 0.36], HM.box());

  // ------------------------------------------------------------------ equipment section structure
  const dodeca = new THREE.Shape(Array.from({ length: 12 }, (_, k) => {
    const p = deg(k * 30);
    return new THREE.Vector2(-RAD.big * Math.sin(p), RAD.big * Math.cos(p));
  }));
  const hole = new THREE.Path();
  hole.absarc(0, 0, RAD.shell, 0, Math.PI * 2, true);
  dodeca.holes.push(hole);
  const plateGeo = (x) => new THREE.ShapeGeometry(dodeca, 24).rotateY(Math.PI / 2).translate(x, 0, 0);
  const frame = [];
  for (let k = 0; k < 12; k++) frame.push(atPhi(deg(k * 30), new THREE.BoxGeometry(X_EQ1 - X_EQ0, RAD.big - RAD.shell, 0.025).translate(X_EQM, (RAD.big + RAD.shell) / 2, 0)));
  for (let k = 0; k < 12; k++) frame.push(atPhi(deg(k * 30), new THREE.BoxGeometry(X_EQ1 - X_EQ0 + 0.04, 0.06, 0.06).translate(X_EQM, RAD.big - 0.03, 0)));
  for (let k = 0; k < 12; k++) for (const x of [X_EQ0 + 0.02, X_EQ1 - 0.02]) frame.push(atPhi(deg(k * 30 + 15), new THREE.BoxGeometry(0.04, 0.05, BAY_EDGE - 0.06).translate(x, FACE - 0.03, 0)));
  const eqMat = new THREE.MeshStandardMaterial({ color: 0x9aa1a8, roughness: 0.5, metalness: 0.7, side: THREE.DoubleSide });
  out.equip = P('Equipment section', {
    system: 'Structure', material: 'Machined, stiffened aluminium frame panels and door sills', mass: 540, temp: 278, explode: [0, 0, 0], xrayWeight: 0.25,
    desc: 'A doughnut-shaped ring of twelve trapezoidal bays, 4.2 m across, holding about 90 % of the spacecraft electronics: ten equipment bays behind hinged doors, so spacewalkers can swap boxes as orbital replacement units, and two that carry the aft trunnion pins and scuff plates.',
  }, mesh(merge(frame), eqMat));
  const barrel = [plateGeo(X_EQ0 + 0.01), plateGeo(X_EQ1 - 0.01), tube(RAD.shell, X_EQ0, X_EQ1, { seg: 64 })];
  for (const p of TRUNNION_PHI) barrel.push(atPhi(p, new THREE.BoxGeometry(X_EQ1 - X_EQ0 - 0.07, 0.03, BAY_EDGE - 0.05).translate(X_EQM, FACE + 0.015, 0)));   // trunnion-bay close-outs
  P('Equipment section barrel & bulkheads', {
    system: 'Structure', skin: true, material: 'Inner aluminium barrel, forward frame panel and aft bulkhead; trunnion-bay close-out panels', mass: 350, temp: 278, explode: [0, 0, 0], xrayWeight: 0.2,
    desc: 'The inner barrel the bays are built on, closed by a forward frame panel and an aft bulkhead; six mounts on the inside of the bulkhead hold the telescope. Shown ghosted in X-ray and Systems so the primary mirror and the bay contents can be seen and picked.',
  }, mesh(merge(barrel), eqMat));

  const wb = [];
  for (let k = 0; k < 12; k++) for (const s of [-1, 1]) wb.push(atPhi(deg(k * 30), new THREE.BoxGeometry(X_EQ1 - X_EQ0 - 0.12, RAD.big - RAD.shell - 0.12, 0.006).translate(X_EQM, (RAD.big + RAD.shell) / 2 - 0.03, s * 0.017)));
  P('Bay wall blankets', {
    system: 'Thermal control', skin: true, material: 'Multi-layer insulation blankets on both faces of the twelve radial bay walls', mass: 18, count: 24, temp: 285, explode: [0, 0, 0], xrayWeight: 0.25,
    desc: 'Blankets on the walls between bays keep each bay\'s thermal balance separate, so a hot box in one bay does not cook its neighbour; the heat-dissipating boxes are put in bays that are mostly in orbit shadow. Shown ghosted.',
  }, mesh(merge(wb), HM.mli(4)));

  // bay doors (radiators)
  const doorNames = {
    1: 'data management', 2: 'battery module 1', 3: 'battery module 2', 4: 'power control', 5: 'communications',
    6: 'reaction wheels 1–2', 7: 'mechanism control', 8: 'pointing control', 9: 'reaction wheels 3–4', 10: 'SI C&DH',
  };
  out.bayDoors = [];
  for (let k = 1; k <= 10; k++) {
    const g = bayBox(k, X_EQ1 - X_EQ0 - 0.07, 0.03, BAY_EDGE - 0.05, X_EQM, FACE + 0.015);
    for (const t of [-0.36, 0.36]) {
      rails.eq.push(inBay(k, rod([X_EQ0 + 0.25, FACE + 0.09, t], [X_EQ1 - 0.25, FACE + 0.09, t], 0.016, 4)));
      railLen.eq += X_EQ1 - X_EQ0 - 0.5;
      for (const x of [X_EQ0 + 0.28, X_EQM, X_EQ1 - 0.28]) rails.eq.push(inBay(k, rod([x, FACE + 0.03, t], [x, FACE + 0.09, t], 0.012, 4)));
    }
    socket(X_EQ1 - 0.22, FACE + 0.015, BAY_PHI[k]);
    const hw = [];
    for (const t of [-0.38, 0, 0.38]) hw.push(inBay(k, new THREE.CylinderGeometry(0.025, 0.025, 0.16, 10).rotateX(Math.PI / 2).translate(X_EQ0 + 0.05, FACE + 0.035, t)));
    for (const [x, t] of [[X_EQ1 - 0.07, -0.47], [X_EQ1 - 0.07, 0.47], [X_EQM, -0.49], [X_EQM, 0.49], [X_EQ0 + 0.12, -0.47], [X_EQ0 + 0.12, 0.47]]) {
      hw.push(inBay(k, new THREE.CylinderGeometry(0.018, 0.018, 0.03, 8).translate(x, FACE + 0.03, t)));      // six J-hooks
    }
    hw.push(inBay(k, new THREE.BoxGeometry(0.06, 0.04, 0.16).translate(X_EQ1 - 0.08, FACE + 0.04, 0.26)));
    // integral door stay, folded flat against the inside of the door, on a pivot bracket by the hinge
    hw.push(inBay(k, rod([X_EQ0 + 0.1, FACE - 0.035, 0.43], [X_EQ1 - 0.3, FACE - 0.035, 0.43], 0.012, 6)), inBay(k, new THREE.BoxGeometry(0.06, 0.04, 0.06).translate(X_EQ0 + 0.1, FACE - 0.035, 0.43)));
    const wheels = k === 6 || k === 9;
    if (wheels) {                                   // door handle and door stop (the 1999 NOBLs were clipped to them)
      hw.push(...cablePath([[X_EQ1 - 0.12, FACE + 0.015, -0.12], [X_EQ1 - 0.12, FACE + 0.07, -0.12], [X_EQ1 - 0.12, FACE + 0.07, 0.12], [X_EQ1 - 0.12, FACE + 0.015, 0.12]], 0.012, 6).map((g) => g.rotateX(BAY_PHI[k])));
      hw.push(inBay(k, new THREE.BoxGeometry(0.08, 0.06, 0.05).translate(X_EQ0 + 0.06, FACE + 0.045, 0.5)));
    }
    const p = P(`Bay ${k} door (${doorNames[k]})`, {
      system: 'Thermal control', skin: true, material: wheels ? 'Thermally stiffened panel door' : 'Flat honeycomb aluminium door, silvered FOSR tape and MLI pattern', mass: 22, temp: Math.round(250 + 35 * Math.cos(BAY_PHI[k])),
      explode: az(BAY_PHI[k], 1.3), desc: k === 10
        ? 'Bay 10\'s door carries the Science Instrument Command and Data Handling unit on its inner face. Like the other honeycomb doors it is a radiator: electronics bolted to it dump their heat to space.'
        : wheels
          ? `Bay ${k} door. The two reaction-wheel bays have thermally stiffened panel doors rather than the flat honeycomb equipment doors; spacewalkers open each by releasing six J-hooks.`
          : `Hinged access door and radiator for bay ${k}. Its outer face sheds the heat of the ${doorNames[k]} equipment to deep space; spacewalkers open it by releasing six J-hooks, and an integral stay props it open while they work.`,
    }, [mesh(g, HM.bayDoor()), mesh(merge(hw), HM.al())]);
    p.userData.part.thermalRole = 'radiator';
    out.bayDoors.push(p);
  }

  // NOBL covers: bays 6, 9 and 10 in 1999–2002, bays 5, 7 and 8 in 2009
  for (const [k, when] of [[6, 'SM3A/SM3B (1999–2002)'], [9, 'SM3A/SM3B (1999–2002)'], [10, 'SM3A/SM3B (1999–2002)'], [5, 'SM4 (2009)'], [7, 'SM4 (2009)'], [8, 'SM4 (2009)']]) {
    const g = [bayBox(k, X_EQ1 - X_EQ0 - 0.18, 0.02, BAY_EDGE - 0.16, X_EQM, FACE + 0.045)];
    for (const t of [-0.44, 0.44]) g.push(bayBox(k, X_EQ1 - X_EQ0 - 0.16, 0.025, 0.025, X_EQM, FACE + 0.045, t));
    for (const x of [X_EQ0 + 0.13, X_EQ1 - 0.13]) g.push(bayBox(k, 0.025, 0.025, BAY_EDGE - 0.14, x, FACE + 0.045));
    const plugs = [];
    for (const [x, t] of [[X_EQ0 + 0.2, -0.36], [X_EQ0 + 0.2, 0.36], [X_EQ1 - 0.2, -0.36], [X_EQ1 - 0.2, 0.36]]) plugs.push(inBay(k, new THREE.CylinderGeometry(0.02, 0.024, 0.03, 10).translate(x, FACE + 0.065, t)));
    plugs.push(inBay(k, new THREE.CylinderGeometry(0.015, 0.015, 0.04, 8).translate(X_EQ1 - 0.07, FACE + 0.06, 0.47)), inBay(k, rod([X_EQ1 - 0.07, FACE + 0.06, 0.47], [X_EQ1 - 0.16, FACE + 0.06, 0.4], 0.006, 4)));
    P(`New outer blanket layer (bay ${k})`, {
      system: 'Thermal control', skin: true, material: 'Silicon-dioxide-coated stainless-steel foil on a steel picture frame, expanding vent plugs', mass: 10, temp: 250, explode: az(BAY_PHI[k], 2.0),
      desc: `Fitted over the bay ${k} door on ${when}. The original Teflon outer layers cracked and peeled after years of ultraviolet light and atomic oxygen; these coated stainless-steel covers, life-tested for ten years, keep the electronics behind them cool. Four expanding plugs pushed into the door's vent holes hold each one on, and a ground cap connects it to a door J-bolt.${when.startsWith('SM4') ? ' The 2009 covers were rolled flat into place with a roller tool.' : ''}`,
    }, [mesh(merge(g), HM.nobl()), mesh(merge(plugs), HM.al())]);
  }

  // ------------------------------------------------------------------ bay contents
  // bay boxes sit four or five deep along every line of sight, so X-ray draws them at 40 %
  const B = (k, name, info, objs, parent) => P(name, { explode: az(BAY_PHI[k], 0.75), xrayWeight: 0.4, ...info }, objs, parent);
  const DOOR_IN = FACE - 0.005;                     // inner face of the bay doors
  const DIU = (k, where, x, r, t = 0) => B(k, `Data interface unit (${where})`, {
    system: 'Avionics', material: 'Dual-redundant command/data interface box, 38 × 41 × 18 cm', mass: 16, massSource: 'NASA SM3A Media Guide (35 lb)', temp: 296,
    desc: `One of four DIUs, here in ${where}: a relay between the data management unit and the boxes around it, passing commands out and status back. Each is two complete units in one, so either half can do the job.`,
  }, oru(k, [[0.38, 0.18, 0.41, x, r, t]], HM.box()));
  // bay 1: data management
  B(1, 'Data management unit', {
    system: 'Avionics', material: 'Printed-circuit boards on a backplate, dual DC-DC converters', mass: 37.7, massSource: 'NASA SM3A Media Guide (83 lb)', temp: 296,
    desc: 'Bay 1, on the inside of the door. The spacecraft\'s data switchboard and central clock: it decodes every incoming command, encodes telemetry, receives the science data from the SI C&DH, and talks to the other boxes through four data interface units. 60 × 70 × 17 cm.',
  }, oru(1, [[0.7, 0.17, 0.6, X_EQM + 0.32, DOOR_IN - 0.085, 0, true]], HM.iridite()));
  B(1, 'Flight computer (80486)', {
    system: 'Avionics', material: 'Three radiation-tolerant Intel 80486 single-board computers', mass: 32, massSource: 'NASA SM3A Media Guide (70.5 lb)', temp: 297,
    desc: 'Installed in December 1999, replacing the 1980s DF-224 and its co-processor: three independent 25 MHz 80486 boards, one in control at a time, about 20 times faster with six times the memory. It runs pointing, safing and housekeeping. 48 × 46 × 33 cm.',
  }, oru(1, [[0.48, 0.33, 0.46, X_EQ0 + 0.36, RAD.shell + 0.175, 0]], HM.box()));
  // bays 2–3: batteries (a 91 × 81 × 28 cm module of three 22-cell batteries in each)
  const module = (k) => {
    const xm = X_EQ1 - 0.52;
    const frm = [bayBox(k, 0.91, 0.025, 0.81, xm, RAD.shell + 0.06)];
    const cells = [], handles = [];
    for (let b = 0; b < 3; b++) {
      const x = xm - 0.3 + b * 0.3;
      frm.push(bayBox(k, 0.28, 0.04, 0.78, x, RAD.shell + 0.09));
      for (let i = 0; i < 3; i++) for (let j = 0; j < 8; j++) {
        if (i === 1 && (j === 0 || j === 7)) continue;          // 22 cells per battery
        cells.push(inBay(k, new THREE.CylinderGeometry(0.042, 0.042, 0.22, 12).translate(x - 0.092 + i * 0.092, RAD.shell + 0.22, -0.3325 + j * 0.095)));
      }
    }
    for (const t of [-0.28, 0.28]) {                                // the two big yellow EVA handles
      handles.push(inBay(k, rod([xm - 0.44, RAD.shell + 0.08, t], [xm - 0.44, RAD.shell + 0.43, t], 0.014, 6)), inBay(k, rod([xm + 0.44, RAD.shell + 0.08, t], [xm + 0.44, RAD.shell + 0.43, t], 0.014, 6)));
      handles.push(inBay(k, rod([xm - 0.44, RAD.shell + 0.43, t], [xm + 0.44, RAD.shell + 0.43, t], 0.018, 8)));
    }
    // the 14 bolts that hold the module plate to the bay floor
    const bolts = [];
    for (let i = 0; i < 5; i++) for (const t of [-0.39, 0.39]) bolts.push(inBay(k, new THREE.CylinderGeometry(0.013, 0.013, 0.02, 6).translate(xm - 0.42 + i * 0.21, RAD.shell + 0.082, t)));
    for (const x of [xm - 0.44, xm + 0.44]) for (const t of [-0.13, 0.13]) bolts.push(inBay(k, new THREE.CylinderGeometry(0.013, 0.013, 0.02, 6).translate(x, RAD.shell + 0.082, t)));
    // per battery: an isolation switch and a harness connector in the gaps of the middle cell row
    for (let b = 0; b < 3; b++) {
      const x = xm - 0.3 + b * 0.3;
      batSw.push(inBay(k, new THREE.BoxGeometry(0.07, 0.1, 0.06).translate(x, RAD.shell + 0.25, 0.3325)), inBay(k, rod([x, RAD.shell + 0.3, 0.3325], [x + 0.04, RAD.shell + 0.36, 0.3325], 0.008, 6)));
      batConn.push(inBay(k, new THREE.CylinderGeometry(0.03, 0.03, 0.12, 14).translate(x, RAD.shell + 0.26, -0.3325)), inBay(k, new THREE.CylinderGeometry(0.036, 0.036, 0.02, 14).translate(x, RAD.shell + 0.32, -0.3325)));
      addConn(k, x, RAD.shell + 0.33, -0.3325);
    }
    return [mesh(merge(frm), HM.iridite()), mesh(merge(cells), HM.cell()), mesh(merge(handles), HM.handrail()), mesh(merge(bolts), HM.al())];
  };
  const batSw = [], batConn = [];
  for (const [k, n] of [[2, 1], [3, 2]]) {
    const p = B(k, `Battery module ${n} (bay ${k})`, {
      system: 'Power', material: 'Three 22-cell nickel–hydrogen batteries on a common plate, 91 × 81 × 28 cm', mass: 209, massSource: 'NASA SM4 battery fact sheet (460 lb)', count: 3, temp: 274,
      desc: `Bay ${k}. Three batteries of 22 NiH₂ pressure-vessel cells in series; with the other module they carry Hubble through the ~36 minutes of shadow on every orbit. Each started with about 88 Ah and is charged to about 75 Ah in orbit, with its own charge current controller. This set went in during 2009; a spacewalker frees a module by releasing 14 bolts.`,
      xrayWeight: 0.3,
    }, module(k));
    p.userData.part.thermalRole = 'battery';
  }
  P('Battery isolation switches & connectors', {
    system: 'Power', material: 'One isolation switch and one harness connector per battery, six of each', mass: 3, count: 12, temp: 280, explode: [0, -1.4, 0],
    desc: 'Each 2009 battery has an isolation switch that dead-faces its connector, so a spacewalker never touches a live plug: the last step of the change-out was turning each switch on. Positions on the modules approximate.',
  }, [mesh(merge(batSw), HM.box()), mesh(merge(batConn), HM.iridite())]);
  const ccc = [];
  for (const k of [2, 3]) for (const t of [-0.26, 0, 0.26]) { ccc.push(bayBox(k, 0.26, 0.1, 0.22, X_EQ0 + 0.23, DOOR_IN - 0.05, t)); addConn(k, X_EQ0 + 0.23, DOOR_IN - 0.1, t); }
  P('Charge current controllers', {
    system: 'Power', material: 'Six voltage–temperature charge regulators, one per battery', mass: 24, count: 6, temp: 296, explode: [0, -1.0, 0],
    desc: 'Each battery has its own controller, which tapers the charging current from the arrays as the battery\'s voltage and temperature rise so it is never overcharged — the care that let the 1990 batteries last 19 years. Placed in bays 2 and 3 beside their batteries; exact position approximate.',
  }, mesh(merge(ccc), HM.iridite()));
  B(2, 'Oscillators (bay 2)', {
    system: 'Avionics', material: 'Ultra-stable quartz oscillator and a backup, 10 cm × 23 cm cylinders', mass: 2.8, massSource: 'NASA SM3A Media Guide (3 lb each)', count: 2, temp: 296,
    desc: 'The master clock: a highly stable timing pulse, distributed by the data management unit, that time-tags every observation and keeps every box in step.',
  }, mesh(merge([-0.13, 0.13].map((t) => inBay(2, new THREE.CylinderGeometry(0.05, 0.05, 0.23, 16).rotateZ(Math.PI / 2).translate(X_EQ0 + 0.25, RAD.shell + 0.1, t)))), HM.iridite()));
  for (const t of [-0.13, 0.13]) addConn(2, X_EQ0 + 0.25, RAD.shell + 0.15, t);
  DIU(3, 'bay 3', X_EQ0 + 0.3, RAD.shell + 0.12);
  // bay 4: power control
  B(4, 'Power control unit', {
    system: 'Power', material: 'Relay and switching electronics, 109 × 30 × 20 cm', mass: 55, massSource: 'NASA SM3A Media Guide (120 lb)', temp: 299,
    desc: 'Bay 4. Interconnects and switches the current among the solar arrays, batteries and charge controllers and feeds the main bus to the four distribution units. Replaced in 2002 on a spacewalk that required powering the whole observatory down for the first time.',
  }, oru(4, [[1.09, 0.2, 0.3, X_EQM, RAD.shell + 0.11, 0]], HM.iridite()));
  for (const [t, x] of [[-0.13, X_EQM - 0.25], [0.13, X_EQM - 0.25], [-0.13, X_EQM + 0.25], [0.13, X_EQM + 0.25]]) addConn(4, x - 0.2, DOOR_IN - 0.13, t);
  B(4, 'Power distribution units', {
    system: 'Power', material: 'Bus, switch and fuse boxes, 25 × 12.5 × 45 cm each', mass: 44, massSource: 'NASA SM3A Media Guide (25 lb each)', count: 4, temp: 296,
    desc: 'Four distribution units on the inside of the bay 4 door carry the power buses, switches, fuses and monitors: two buses feed the telescope, instruments and SI C&DH, two the spacecraft. Their fuses are plug-in units a gloved hand can change; a spare fuse-plug bracket flew in 2009.',
  }, [mesh(merge([[-0.13, X_EQM - 0.25], [0.13, X_EQM - 0.25], [-0.13, X_EQM + 0.25], [0.13, X_EQM + 0.25]].map(([t, x]) => bayBox(4, 0.45, 0.125, 0.25, x, DOOR_IN - 0.0625, t))), HM.box()),
    mesh(merge([[-0.13, X_EQM - 0.25], [0.13, X_EQM - 0.25], [-0.13, X_EQM + 0.25], [0.13, X_EQM + 0.25]].flatMap(([t, x]) => [-0.15, -0.05, 0.05, 0.15].map((dx) => bayBox(4, 0.03, 0.03, 0.03, x + dx, DOOR_IN - 0.14, t + 0.05)))), HM.iridite())]);
  // bay 5: communications + two recorders
  B(5, 'S-band single-access transmitters', {
    system: 'Communications', material: 'Two S-band transmitters (one on, one spare)', mass: 13, count: 2, temp: 297,
    desc: 'Bay 5. Send the science data at up to 1 Mbit/s through a high-gain antenna to a TDRS relay; "single access" names the relay\'s dish they aim at. One failed in 1998 and was replaced in 1999 — two circular and three coaxial connectors to demate, on a box never designed to be changed, so the crew used a special tool.',
  }, oru(5, [[-0.17, 3.95], [0.17, 3.95]].map(([t, x]) => [0.36, 0.17, 0.26, x, RAD.shell + 0.11, t]), HM.box(), { coax: 3 }));
  B(5, 'Multiple-access transponders', {
    system: 'Communications', material: 'Two S-band transponders (receive and transmit)', mass: 13, count: 2, temp: 297,
    desc: 'Bay 5. Receive every command sent to Hubble and return low-rate engineering telemetry, through either the high-gain or the low-gain antennas — the link that keeps working in safe mode.',
  }, oru(5, [[-0.17, 4.62], [0.17, 4.62]].map(([t, x]) => [0.36, 0.17, 0.26, x, RAD.shell + 0.11, t]), HM.box(), { coax: 3 }));
  for (const [n, t, year] of [[1, -0.14, 1997], [3, 0.14, 1999]]) {
    B(5, `Solid-state recorder ${n} (bay 5)`, {
      system: 'Avionics', material: 'DRAM memory boards, 12 Gbit, 30 × 23 × 18 cm', mass: 9, massSource: 'NASA SM4 Media Guide (20 lb)', temp: 297,
      desc: `SSR-${n}, installed in ${year} in place of a reel-to-reel tape recorder. Stores science and engineering data between TDRS contacts: 12 gigabits, ten times a tape of the same size, with no moving parts. Placement of both SSRs in bay 5 inferred from the 1999 spacewalk.`,
    }, oru(5, [[0.3, 0.18, 0.23, X_EQM, 1.88, t]], HM.iridite()));
  }
  // bays 6 and 9: reaction wheels, No. 1 / No. 3 forward
  out.wheels = [];
  const wheel = (k, n, x, tilt, label = false) => {
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
    (CONN[k] || (CONN[k] = [])).push(c.toArray());
    out.wheels.push(rot);
    const p = B(k, `Reaction wheel assembly ${n}`, {
      system: 'Attitude control', material: 'Flywheel on ball bearings up to 3,000 rpm, brushless DC motor', mass: 45, massSource: 'NASA SM3A Media Guide (about 100 lb)', temp: 300,
      desc: `Bay ${k}, ${n % 2 ? 'forward' : 'aft'} position. Spinning a 59 cm flywheel faster or slower turns the telescope the other way — no propellant, no thruster vibration. Four wheels with skewed axes, any three enough; they slew Hubble about 90° in 15 minutes, as slow as a minute hand.`,
    }, g);
    // internal: one wheel names the set while a tour step focuses it
    if (label) Object.assign(p.userData.part, { callout: true, anchor: c.clone().addScaledVector(axis, 0.14), tourLabel: true });
    return p;
  };
  wheel(6, 1, X_EQ1 - 0.42, -0.35, true); wheel(6, 2, X_EQ0 + 0.42, 0.35);
  wheel(9, 3, X_EQ1 - 0.42, -0.35); wheel(9, 4, X_EQ0 + 0.42, 0.35);
  // bay 7: mechanism control
  B(7, 'Mechanism control unit', {
    system: 'Avionics', material: 'Stepper-motor driver electronics', mass: 20, temp: 296,
    desc: 'Bay 7. Drives the rotary actuators of the launch latches and the three hinge drives (aperture door and antenna masts) and the high-gain antenna gimbals.',
  }, oru(7, [[0.7, 0.26, 0.44, X_EQ0 + 0.45, RAD.shell + 0.15, -0.06]], HM.box()));
  B(7, 'Solar array drive electronics', {
    system: 'Power', material: 'Two stepper-motor controllers (SADE), one per wing', mass: 16, count: 2, temp: 297,
    desc: 'Bay 7. Each unit steps its wing\'s drive so the cells keep facing the Sun as Hubble points around the sky. One was replaced on the 1997 servicing mission. Position within the bay approximate.',
  }, oru(7, [[0.36, 0.2, 0.26, X_EQ1 - 0.35, RAD.shell + 0.12, -0.17], [0.36, 0.2, 0.26, X_EQ1 - 0.35, RAD.shell + 0.12, 0.17]], HM.iridite()));
  DIU(7, 'bay 7', X_EQ1 - 0.4, DOOR_IN - 0.1);
  // bay 8: pointing control + the backup tape recorder
  B(8, 'Pointing/safemode electronics assembly', {
    system: 'Attitude control', material: 'PSEA: about 40 circuit boards in one enclosure', mass: 39, massSource: 'NASA SM3A Media Guide (86 lb)', temp: 296,
    desc: 'Bay 8. The independent safe-mode computer: if the flight computer stops sending its keep-alive signal, it takes over, turns the arrays to the Sun using the coarse sun sensors and sheds power until the ground steps in. Box size approximate.',
  }, oru(8, [[0.8, 0.28, 0.5, X_EQ0 + 0.5, RAD.shell + 0.16, 0.08]], HM.box()));
  B(8, 'Retrieval mode gyro assembly', {
    system: 'Attitude control', material: 'RMGA: three low-grade rate gyros', mass: 10, temp: 296,
    desc: 'Bay 8. Simple gyros that let the safe-mode electronics hold Hubble steady if the main gyros are unavailable, as during a retrieval by the Shuttle. Box size approximate.',
  }, oru(8, [[0.3, 0.16, 0.25, X_EQ1 - 0.35, RAD.shell + 0.1, 0.2]], HM.box()));
  B(8, 'Engineering/science tape recorder (bay 8)', {
    system: 'Avionics', material: 'Reel-to-reel tape recorder, 1.2 Gbit, 30 × 23 × 18 cm', mass: 9, massSource: 'NASA SM4 Media Guide (20 lb)', temp: 297,
    desc: 'The last of the three original reel-to-reel recorders, kept as a backup to the two solid-state recorders. NASA puts the three recorders in bays 5 and 8; this one\'s placement in bay 8 is inferred.',
  }, oru(8, [[0.3, 0.18, 0.23, X_EQ1 - 0.35, 1.88, -0.12]], HM.box()));
  // bay 10: SI C&DH on the door, gyro electronics on the floor. The unit is a tray of boxes in
  // redundant pairs (rows from aft: NSSC-I, CU/SDF, standard interfaces, power control unit) with
  // bus couplers, an RIU and the connector drive stud down the middle
  const ROW = (i) => X_EQ0 + 0.25 + i * 0.33;
  const sicTray = bayBox(10, 1.3, 0.025, 0.95, X_EQM, DOOR_IN - 0.0125);
  const sicBox = (i, t, sy = 0.2) => bayBox(10, 0.28, sy, 0.33, ROW(i), DOOR_IN - 0.025 - sy / 2, t);
  const recept = [];
  for (const x of [X_EQ0 + 0.3, X_EQM, X_EQ1 - 0.3]) for (const t of [-0.5, 0.5]) recept.push(inBay(10, new THREE.CylinderGeometry(0.03, 0.03, 0.03, 12).translate(x, DOOR_IN - 0.02, t)));
  for (let i = 0; i < 10; i++) recept.push(inBay(10, new THREE.CylinderGeometry(0.012, 0.012, 0.03, 6).translate(X_EQ0 + 0.18 + (i % 5) * 0.29, DOOR_IN - 0.035, i < 5 ? -0.46 : 0.46)));   // the ten mounting bolts
  const sic = B(10, 'Science instrument command & data handling unit', {
    system: 'Avionics', material: 'Orbital replacement unit tray on the bay 10 door carrying its boxes in redundant pairs', mass: 107, temp: 298, xrayWeight: 0.4,
    desc: 'Bay 10. Commands the instruments and formats their data for the data management unit. Its side A failed in September 2008, delaying the last servicing mission. In 2009 astronauts removed ten bolts and turned one connector drive stud to unplug the whole unit from receptacles on the door, then drove the new one down evenly onto them.',
  }, [mesh(sicTray, HM.iridite()), mesh(merge(recept), HM.al())]);
  out.sicdh = sic;
  const SUB = (name, info, objs) => P(name, { temp: 298, explode: [0, 0, 0], ...info }, objs, sic);
  SUB('NASA standard spacecraft computer (NSSC-I)', {
    system: 'Avionics', material: 'One central processor (and a spare) with eight 8,192-word, 18-bit memory modules',
    desc: 'The SI C&DH\'s own computer runs the instrument "applications": it moves commands and programs in and out of the processor, checks each instrument\'s health and stores timed commands for when Hubble is out of contact. Part of the SI C&DH; mass included.',
  }, mesh(merge([sicBox(0, -0.235), sicBox(0, 0.235)]), HM.box()));
  SUB('Control unit / science data formatters', {
    system: 'Avionics', material: 'Two CU/SDF units', count: 2,
    desc: 'Translate ground and spacecraft commands into one common format for the instruments (ground commands use 27-bit words, spacecraft commands 16-bit) and format the instruments\' science data for the recorders. Part of the SI C&DH; mass included.',
  }, mesh(merge([sicBox(1, -0.235), sicBox(1, 0.235)]), HM.iridite()));
  SUB('SI C&DH standard interfaces', {
    system: 'Avionics', material: 'Two standard interface boards', count: 2,
    desc: 'Link the NSSC-I processor and the formatters to the spacecraft\'s data management unit. Part of the SI C&DH; mass included.',
  }, mesh(merge([sicBox(2, -0.235, 0.16), sicBox(2, 0.235, 0.16)]), HM.box()));
  SUB('SI C&DH power control unit', {
    system: 'Power', material: 'Redundant DC–DC converters', count: 2,
    desc: 'Makes +5, −5 and +12 V for the processor memories and +28 V for the control unit / science data formatters from the spacecraft bus. Part of the SI C&DH; mass included.',
  }, mesh(merge([sicBox(3, -0.235, 0.18), sicBox(3, 0.235, 0.18)]), HM.iridite()));
  SUB('SI C&DH bus coupler units', {
    system: 'Avionics', material: 'Bus couplers on the instrument data bus', count: 2,
    desc: 'Couple the remote interface units onto the shared instrument bus and isolate any one that fails, so a single bad instrument cannot take the bus down. Part of the SI C&DH; mass included.',
  }, mesh(merge([0, 1].map((i) => bayBox(10, 0.2, 0.1, 0.1, ROW(i), DOOR_IN - 0.075, 0))), HM.box()));
  SUB('SI C&DH remote interface unit', {
    system: 'Avionics', material: 'RIU serving the CU/SDF and the power control unit',
    desc: 'The sixth RIU: the other five sit on the instruments. It passes commands, clock signals and engineering data — never science data — and can drive two expander units. Part of the SI C&DH; mass included.',
  }, mesh(bayBox(10, 0.2, 0.12, 0.12, ROW(3), DOOR_IN - 0.085, 0), HM.box()));
  SUB('SI C&DH connector drive stud', {
    system: 'Crew systems', material: 'Hex drive stud on a jack screw',
    desc: 'One turn of a tool on this stud jacks the whole unit off, or down onto, its blind-mate receptacles on the door, so dozens of connectors mate evenly at once. Part of the SI C&DH.',
  }, mesh(merge([bayBox(10, 0.06, 0.12, 0.06, ROW(2), DOOR_IN - 0.085, 0), inBay(10, new THREE.CylinderGeometry(0.015, 0.015, 0.06, 6).translate(ROW(2), DOOR_IN - 0.175, 0))]), HM.ti()));
  B(10, 'Gyro electronics control units', {
    system: 'Attitude control', material: 'Three dual-string electronics control units', mass: 21, count: 3, temp: 297,
    desc: 'Bay 10. Each rate gyro assembly pairs a sensor unit in the aft shroud with an electronics control unit here that processes the two gyros\' outputs.',
  }, mesh(merge([0, 1, 2].map((i) => bayBox(10, 0.3, 0.14, 0.24, X_EQ0 + 0.3 + i * 0.36, RAD.shell + 0.08, -0.14))), HM.box()));
  for (let i = 0; i < 3; i++) addConn(10, X_EQ0 + 0.3 + i * 0.36, RAD.shell + 0.16, -0.14);
  addConn(10, X_EQ0 + 0.11, DOOR_IN - 0.06, 0);
  DIU(10, 'bay 10', X_EQ1 - 0.3, RAD.shell + 0.1, 0.2);
  P('Data interface unit (OTA equipment section)', {
    system: 'Avionics', material: 'Dual-redundant command/data interface box, 38 × 41 × 18 cm', mass: 16, massSource: 'NASA SM3A Media Guide (35 lb)', temp: 296, explode: [0, 5.9, 0],
    desc: 'The fourth DIU, in the OTA equipment section beside the optical control electronics (SM3A Fig. 5-25): it relays commands and data between the data management unit and the telescope\'s own electronics. Bay D assumed.',
  }, mesh(oBox(3, 0.38, 0.2, 0.34), HM.box()));

  // ------------------------------------------------------------------ aft shroud
  const shroud = sunShadowShell(RAD.big, ST.bulkhead, ST.aftShroud, [HM.mli(2), HM.mli(3)], 300, 215, { seg: 64, hs: 3 });
  const shroudRings = mesh(merge([flange(RAD.big - 0.02, RAD.big + 0.035, ST.bulkhead, ST.bulkhead + 0.09, 128), flange(RAD.big - 0.02, RAD.big + 0.035, ST.aftShroud - 0.09, ST.aftShroud, 128)]), HM.al());
  out.aftShroud = P('Aft shroud', {
    system: 'Skin & fairings', skin: true, material: 'Stiffened aluminium skin and internal panels; silvered FOSR tape outside', mass: 730, temp: 270, explode: [-1.6, -4.0, 0],
    desc: 'The 3.5 m housing, 4.3 m across, around the focal plane: four axial instruments, the radial camera, three Fine Guidance Sensors, the gyros and the star trackers. Lights inside illuminate the bays for spacewalkers, and every vent is light-tight.',
  }, [...shroud, shroudRings]);
  out.aftShroud.userData.part.thermalRole = 'blanket';
  const lon = [];
  for (let k = 0; k < 16; k++) lon.push(atPhi(deg(11.25 + k * 22.5), new THREE.BoxGeometry(ST.aftShroud - ST.bulkhead - 0.2, 0.05, 0.04).translate((ST.bulkhead + ST.aftShroud) / 2, RAD.big - 0.05, 0)));
  for (const x of [0.22, 1.8, 3.4]) lon.push(flange(RAD.big - 0.1, RAD.big - 0.02, x - 0.025, x + 0.025, 96));
  P('Aft shroud longerons & rings', {
    system: 'Structure', material: 'Aluminium longeron bars and internal reinforcing rings', mass: 120, count: 16, temp: 272, explode: [-1.6, -3.4, 0], xrayWeight: 0.25,
    desc: 'Sixteen longeron bars, inside and outside the skin, and internal rings stiffen the shroud around its large door cut-outs. Shown evenly spaced; their real stations follow the doors.',
  }, mesh(merge(lon), HM.al()));

  // access doors: a pair on each ±V2 side for the axial instruments, a pair on −V3 for the gyros and
  // star trackers either side of the WFC3 radiator, and three radial doors for the guiders
  const rD = RAD.big + 0.018;
  const doorPair = (name, leaves, x0, x1, info) => {
    const doors = [], frames = [];
    for (const [a, b, hingeAt] of leaves) {
      doors.push(shellPatch(rD, x0, x1, deg(a), deg(b), { nphi: 10 }));
      frames.push(...patchFrame(rD + 0.008, x0, x1, deg(a), deg(b), 0.014, rod));
      // hinge knuckles along the outer edge, axis parallel to the telescope; latch at the meeting edge
      for (let x = x0 + 0.25; x < x1 - 0.1; x += (x1 - x0 - 0.4) / 2) frames.push(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 10).rotateZ(Math.PI / 2).translate(x, rD + 0.02, 0).rotateX(deg(hingeAt)));
      const latchAt = hingeAt === a ? b - 2.5 : a + 2.5;
      frames.push(new THREE.BoxGeometry(0.18, 0.05, 0.06).translate((x0 + x1) / 2, rD + 0.03, 0).rotateX(deg(latchAt)));
    }
    return P(name, { system: 'Skin & fairings', skin: true, temp: 268, ...info }, [mesh(merge(doors), HM.bayDoor()), mesh(merge(frames), HM.al())]);
  };
  const AX0 = 0.3, AX1 = 1.75;
  doorPair('+V2 aft shroud doors (STIS, NICMOS)', [[226, 269, 226], [271, 314, 314]], AX0, AX1, {
    material: 'Two hinged honeycomb doors with light-tight seals', mass: 60, count: 2, explode: [-1.4, 0, -3.2],
    desc: 'Open onto the two +V2 axial bays, STIS and NICMOS; in 2009 a spacewalker opened them to repair STIS\'s power supply. The axial instruments slide out aft along guide rails once the doors are open. Door size estimated.',
  });
  doorPair('−V2 aft shroud doors (COS, ACS)', [[46, 89, 46], [91, 134, 134]], AX0, AX1, {
    material: 'Two hinged honeycomb doors with light-tight seals', mass: 60, count: 2, explode: [-1.4, 0, 3.2],
    desc: 'Open onto the two −V2 axial bays: COSTAR came out through them in 2009 and the Cosmic Origins Spectrograph went in, and the ACS repair was done here. The doors were stiff to close, so the crew carried Latch Over Center Kits to help. Door size estimated.',
  });
  doorPair('−V3 aft shroud doors (gyros, star trackers)', [[147, 166, 147], [194, 218, 218]], 2.35, 3.42, {
    material: 'Hinged honeycomb doors with light-tight seals around the star-tracker openings', mass: 30, count: 2, explode: [-0.6, -4.6, 0],
    desc: 'Behind them, at the forward end of the aft shroud on the shadow side, sit the three rate sensor units and the fixed-head star trackers. In 2009 spacewalkers retracted the star-tracker door seals, opened these doors and swapped all three gyro units. Leaf sizes estimated.',
  });
  doorPair('Radial bay doors (FGS)', [0, 90, 270].flatMap((c) => [[c - 14, c - 0.6, c - 14], [c + 0.6, c + 14, c + 14]]), 1.85, 3.38, {
    material: 'Three pairs of hinged honeycomb door leaves, hinged at their outer edges and latched where they meet', mass: 45, count: 6, explode: [0, 0, 0],
    desc: 'A pair of doors over each Fine Guidance Sensor bay near the joint with the equipment section (FGS-2 on +V3, FGS-1 and FGS-3 on the ±V2 sides). In 2009 the crew opened the +V3 FGS-2 doors and carried eight Aft Shroud Latch Repair kits in case a door latch ran stiff. The radial camera has no door: its own radiator forms that part of the skin.',
  });

  // retractable light seals around the star-tracker openings in the −V3 door, with their seal bolts
  const seals = [];
  for (const a of [198.5, 206, 213.5]) {
    seals.push(new THREE.TorusGeometry(0.12, 0.014, 6, 24).rotateX(Math.PI / 2).translate(3.0, rD + 0.02, 0).rotateX(deg(a)));
    for (let i = 0; i < 4; i++) seals.push(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 6).translate(3.0 + 0.15 * Math.cos(i * Math.PI / 2 + 0.785), rD + 0.025, 0.15 * Math.sin(i * Math.PI / 2 + 0.785)).rotateX(deg(a)));
  }
  P('Star-tracker door light seals', {
    system: 'Skin & fairings', material: 'Retractable light-seal rings with seal bolts', mass: 3, count: 3, temp: 262, explode: [-0.6, -4.8, 0],
    desc: 'Before opening the gyro doors in 2009 spacewalkers first retracted the star trackers\' door seal bolts, and the job was not done until the seals were extended again so no stray light could leak in. Ring size estimated.',
  }, mesh(merge(seals), HM.fitting()));

  // interior lights at the internal rings near each door pair, for the spacewalkers
  const il = [], lens = [];
  for (const [x, a] of [[0.4, 90], [0.4, 180], [0.4, 270], [3.3, 72], [3.3, 165], [3.3, 288]]) {
    il.push(atPhi(deg(a), new THREE.BoxGeometry(0.15, 0.08, 0.1).translate(x, 2.0, 0)));
    lens.push(atPhi(deg(a), new THREE.BoxGeometry(0.11, 0.01, 0.07).translate(x, 1.955, 0)));
  }
  P('Aft shroud interior lights', {
    system: 'Crew systems', material: 'Floodlights on the internal rings', mass: 4, count: 6, temp: 270, explode: [-0.8, 0, 0],
    desc: 'There is no sunlight inside a 4.3 m drum: lights on the internal rings by each door pair illuminate the instrument compartments while spacewalkers work in them. Positions and size estimated.',
  }, [mesh(merge(il), HM.box()), mesh(merge(lens), HM.radiator())]);

  // radiation shields inside the doors and blankets lining the shroud and bulkhead
  const shield = [];
  for (const [a, b, x0, x1] of [[226, 314, AX0, AX1], [46, 134, AX0, AX1], [147, 218, 2.35, 3.42], [-14, 14, 1.85, 3.38], [76, 104, 1.85, 3.38], [256, 284, 1.85, 3.38]]) shield.push(shellPatch(RAD.big - 0.025, x0 + 0.04, x1 - 0.04, deg(a + 1), deg(b - 1), { nphi: 8, nx: 1 }));
  shield.push(annulus(0.95, RAD.big - 0.04, ST.bulkhead + 0.004, 72, 1));
  P('Aft shroud radiation shields & interior MLI', {
    system: 'Thermal control', skin: true, material: 'Radiation shields behind the door leaves; MLI lining the bulkhead', mass: 25, temp: 285, explode: [-1.0, 0, 0],
    desc: 'Shields inside the doors and blankets lining the shroud keep the instruments\' temperature steady while the outside swings between sunlight and shadow every 95 minutes. Shown ghosted.',
  }, mesh(merge(shield), HM.mli(5)));

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
    desc: 'Three pins the Shuttle\'s Flight Support System latched onto, standing Hubble upright in the payload bay for every servicing mission. The soft-capture mechanism is clamped to them.',
  }, mesh(merge(pins), HM.ti()));

  // umbilical tower at the aft end: the FSS main umbilical drives onto J101; P105/P106 under covers
  // and the backup plugs P107/P108 on its sides
  const UT = deg(330);
  const ut = [new THREE.BoxGeometry(0.3, 0.25, 0.3).translate(-0.15, 1.82, 0), new THREE.BoxGeometry(0.04, 0.32, 0.38).translate(-0.02, 1.82, 0)];
  const utC = [new THREE.BoxGeometry(0.04, 0.12, 0.18).translate(-0.32, 1.82, 0)];
  for (const [x, t] of [[-0.1, -0.15], [-0.22, -0.15], [-0.1, 0.15], [-0.22, 0.15]]) utC.push(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 16).rotateX(Math.PI / 2).translate(x, 1.82, t + Math.sign(t) * 0.015));
  P('Umbilical tower (J101)', {
    system: 'Electrical', material: 'Connector tower with the J101 umbilical receptacle, P105/P106 under covers and backup plugs P107/P108', mass: 10, temp: 262, explode: [-3.6, 0, 0.4],
    desc: 'Once Hubble was berthed, the Flight Support System drove its umbilical 4.5 in (in about 8 s) onto connector J101 here, so the Shuttle powered the telescope during the spacewalks. The P105/P106 covers were inspected every day; backup plugs P107/P108 could be mated by hand. Position on the bulkhead approximate.',
  }, [mesh(merge(ut.map((g) => g.rotateX(UT))), HM.al()), mesh(merge(utC.map((g) => g.rotateX(UT))), HM.box())]);

  // light-tight purge vents between the pin beams, and the berthing target the FSS camera watched
  const pv = [];
  for (const p of [0, 120, 240]) {
    pv.push(new THREE.BoxGeometry(0.04, 0.16, 0.16).translate(-0.02, 1.0, 0).rotateX(deg(p)));
    for (let i = 0; i < 3; i++) pv.push(new THREE.BoxGeometry(0.03, 0.012, 0.15).rotateZ(0.6).translate(-0.05, 0.95 + i * 0.05, 0).rotateX(deg(p)));
  }
  P('Light-tight purge vents', {
    system: 'Structure', material: 'Baffled vent housings', mass: 1.5, count: 3, temp: 262, explode: [-3.4, 0, 0],
    desc: 'A dry-gas purge kept the instruments clean before launch. Every vent is baffled light-tight, so no stray light reaches the focal plane through the bulkhead. Positions and size approximate.',
  }, mesh(merge(pv), HM.black()));
  P('Berthing target', {
    system: 'Structure', material: 'High-contrast target plate', mass: 1, temp: 262, explode: [-3.5, 0, 0],
    desc: 'The crew berthed Hubble by watching this target on its aft end through a television camera on the Flight Support System, then closed three latches on its pins; up to 2 in of misalignment was allowed. Position approximate.',
  }, mesh(new THREE.BoxGeometry(0.01, 0.3, 0.3).translate(-0.006, 1.25, 0).rotateX(deg(30)), HM.target()));

  // soft capture mechanism: a 1.83 m (72 in) ring structure about 0.6 m (2 ft) high, clamped to the three pins
  const RS0 = 0.8, RS1 = 0.915, XS0 = -0.06, XS1 = -0.66;
  const scm = [axial([[RS0, XS0], [RS1, XS0], [RS1, XS0 - 0.06], [RS1 - 0.04, XS0 - 0.06], [RS1 - 0.04, XS1 + 0.09], [RS0, XS1 + 0.09], [RS0, XS0]], 72)];
  const lids = [axial([[RS0, XS1 + 0.09], [RS1, XS1 + 0.09], [RS1, XS1], [RS0, XS1], [RS0, XS1 + 0.09]], 72)];
  for (let k = 0; k < 12; k++) scm.push(atPhi(deg(k * 30 + 15), new THREE.BoxGeometry(XS0 - XS1 - 0.12, 0.07, 0.03).translate((XS0 + XS1) / 2, RS1 - 0.06, 0)));   // stiffeners
  for (const p of [60, 180, 300]) {
    const pin = az(deg(p), 1.55, -0.36);
    scm.push(rod(pin, az(deg(p - 25), RS1, -0.5), 0.035, 10), rod(pin, az(deg(p + 25), RS1, -0.5), 0.035, 10), rod(pin, az(deg(p), RS1, -0.2), 0.03, 10));
    scm.push(new THREE.BoxGeometry(0.2, 0.2, 0.2).translate(...pin));                                     // pin clamp
  }
  for (const p of [0, 120, 240]) {
    // LIDS-style guide petal leaning inward from the aft ring
    lids.push(new THREE.BoxGeometry(0.34, 0.02, 0.36).translate(-0.17, 0, 0).rotateZ(deg(16)).translate(XS1, RS0 + 0.04, 0).rotateX(deg(p)));
    lids.push(new THREE.BoxGeometry(0.14, 0.1, 0.18).translate(...az(deg(p + 60), RS0 - 0.04, XS1 + 0.06)));   // capture latch
  }
  const scmMat = new THREE.MeshStandardMaterial({ color: 0xc9cdd1, roughness: 0.42, metalness: 0.7, side: THREE.DoubleSide });
  out.scm = P('Soft capture mechanism', {
    system: 'Structure', material: 'Aluminium ring structure clamped to the three berthing pins', mass: 440, temp: 262, explode: [-4.4, 0, 0], xrayWeight: 0.4,
    desc: 'Fitted on the last servicing mission in 2009: about 1.83 m (72 in) across and 0.6 m (2 ft) high, so a future spacecraft can dock and steer Hubble to a safe re-entry, or boost it. It rode up on the FSS berthing ring and was clamped onto Hubble\'s pins as the telescope was released. Mass estimated.',
    callout: true, anchor: [XS1 - 0.1, 0.75, 0.3],
  }, mesh(merge(scm), scmMat));
  P('SCM LIDS interface ring', {
    system: 'Structure', material: 'Low Impact Docking System interface ring with three guide petals and capture latches', temp: 262, explode: [-0.5, 0, 0],
    desc: 'The docking face a future vehicle would capture: a Low Impact Docking System ring whose three petals guide the visitor\'s ring into its latches. Part of the soft capture mechanism; mass included.',
  }, mesh(merge(lids), scmMat), out.scm);
  const drv = [new THREE.BoxGeometry(0.16, 0.14, 0.16).translate(-0.3, RS1 + 0.07, 0).rotateX(deg(120)), new THREE.CylinderGeometry(0.022, 0.022, 0.05, 6).translate(-0.3, RS1 + 0.165, 0).rotateX(deg(120))];
  drv.push(...cablePath(arcPts(RS1 + 0.03, -0.36, 60, 300, 15), 0.016, 6));
  for (const p of [60, 180, 300]) drv.push(...cablePath([az(deg(p), RS1 + 0.03, -0.36), az(deg(p), 1.45, -0.36)], 0.016, 6));
  P('SCM EVA drive & clamp linkage', {
    system: 'Structure', material: 'Single-bolt EVA drive fitting with torque tubes to the three pin clamps', temp: 262, explode: [-0.3, 0, 0],
    desc: 'A spacewalker transferred the mechanism to Hubble by turning one bolt: this drive fitting works all three pin clamps at once through linkages round the ring. Linkage layout schematic. Part of the soft capture mechanism; mass included.',
  }, [mesh(merge(drv.slice(0, 2)), HM.ti()), mesh(merge(drv.slice(2)), HM.fitting())], out.scm);
  const tg = [];
  for (const p of [90, 210, 330]) tg.push(new THREE.BoxGeometry(0.01, 0.12, 0.16).rotateX(deg(p)).translate(...az(deg(p), (RS0 + RS1) / 2, XS1 - 0.006)));
  P('Relative-navigation targets', {
    system: 'Structure', material: 'Black-and-white contrast targets', mass: 1, count: 3, temp: 262, explode: [-4.6, 0, 0],
    desc: 'High-contrast patterns on the capture ring give a visiting spacecraft\'s cameras a precise range and attitude reference for the final approach.',
  }, mesh(merge(tg), HM.target()));

  // trunnions (launch and landing attach points in the Shuttle payload bay); the two aft pins share
  // one line parallel to V2 so both seat in the payload-bay sill latches
  const tr = [];
  const XT = X_EQM + 0.3;
  for (const p of TRUNNION_PHI) {
    const s = Math.sign(Math.sin(p));
    const [, y0, z0] = az(p, FACE + 0.03);
    tr.push(atPhi(p, new THREE.BoxGeometry(0.5, 0.06, 0.5).translate(XT, FACE + 0.06, 0)));                 // reinforced fitting
    tr.push(new THREE.BoxGeometry(0.24, 0.28, 0.2).translate(XT, y0 + 0.02, z0 + s * 0.12));                // block squaring the tilted face to the pin
    tr.push(new THREE.CylinderGeometry(0.075, 0.075, 0.42, 20).rotateX(Math.PI / 2).translate(XT, y0, z0 + s * 0.42));
    tr.push(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 20).rotateX(Math.PI / 2).translate(XT, y0, z0 + s * 0.64));
  }
  P('Aft trunnion pins', {
    system: 'Structure', material: 'Titanium trunnion pins on reinforced fittings', mass: 40, count: 2, temp: 270, explode: [0, -0.3, 0],
    desc: 'Carried by the two unnumbered bays of the equipment section, with the aft scuff plates. Both pins lie on one line parallel to the payload bay\'s width, so they sat in its longeron latches at launch in 1990 and carried the telescope through ascent.',
  }, mesh(merge(tr), HM.ti()));
  P('Forward trunnion', {
    system: 'Structure', material: 'Titanium trunnion pin', mass: 18, temp: 270, explode: [0, -0.6, 0],
    desc: 'The forward shell carries one more trunnion that locked into a payload-bay keel latch for launch. Its exact azimuth and station here are approximate.',
  }, mesh(merge([atPhi(deg(180), new THREE.CylinderGeometry(0.07, 0.07, 0.42, 20).translate(6.3, RAD.shell + 0.21, 0)), atPhi(deg(180), new THREE.BoxGeometry(0.36, 0.05, 0.36).translate(6.3, RAD.shell + 0.025, 0))]), HM.ti()));

  // grapple fixtures for the Shuttle's robot arm, next to the −V3 high-gain antenna drive
  const gf = [];
  for (const p of [160, 200]) {
    gf.push(new THREE.BoxGeometry(0.4, 0.05, 0.4).translate(7.35, RAD.shell + 0.03, 0).rotateX(deg(p)));
    gf.push(new THREE.CylinderGeometry(0.04, 0.05, 0.3, 14).translate(7.35, RAD.shell + 0.2, 0).rotateX(deg(p)));
    gf.push(new THREE.BoxGeometry(0.14, 0.04, 0.05).translate(7.35, RAD.shell + 0.34, 0).rotateX(deg(p)));
    gf.push(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 8).translate(7.59, RAD.shell + 0.16, 0.12).rotateX(deg(p)));
    gf.push(new THREE.CylinderGeometry(0.06, 0.06, 0.01, 16).translate(7.59, RAD.shell + 0.28, 0.12).rotateX(deg(p)));
  }
  P('Grapple fixtures', {
    system: 'Structure', material: 'Aluminium fixtures with grapple shaft, cam and alignment target', mass: 24, count: 2, temp: 262, explode: [0, -0.5, 0],
    desc: 'The Shuttle\'s robot arm closed its end-effector snares on these shafts, beside the −V3 high-gain antenna drive, to pluck Hubble out of orbit for servicing and release it afterwards. Exact positions approximate.',
  }, mesh(merge(gf), HM.al()));

  // ------------------------------------------------------------------ EVA aids (handrails and foot-restraint sockets)
  // aft shroud: along the outer edges of the axial door pairs, beside the −V3 doors and the WFC3 radiator, two ring rails
  const rR = RAD.big + 0.09;
  for (const c of [42, 138, 222, 318]) {
    rail(rails.aft, az(deg(c), rR, AX0 + 0.1), az(deg(c), rR, AX1 - 0.05));
    for (const x of [AX0 + 0.15, (AX0 + AX1) / 2, AX1 - 0.1]) standoff(rails.aft, deg(c), RAD.big + 0.02, x);
  }
  for (const c of [165, 195]) {
    rail(rails.aft, az(deg(c), rR, 1.35), az(deg(c), rR, 3.3));
    for (const x of [1.4, 2.3, 3.25]) standoff(rails.aft, deg(c), RAD.big + 0.02, x);
  }
  // along the outer edges of each pair of FGS doors
  for (const c of [0, 90, 270]) for (const s of [-1, 1]) {
    rail(rails.aft, az(deg(c + s * 16), rR, 1.95), az(deg(c + s * 16), rR, 3.3));
    for (const x of [2.0, 2.62, 3.25]) standoff(rails.aft, deg(c + s * 16), RAD.big + 0.02, x);
  }
  // forward shell: four longitudinal rails between the masts, torquers and grapple fixtures, and a ring rail
  const rF = RAD.shell + 0.09;
  for (const c of [22.5, 112.5, 247.5, 337.5]) {
    rail(rails.fs, az(deg(c), rF, 5.95), az(deg(c), rF, 8.85));
    for (let x = 6.0; x < 8.9; x += 0.7) standoff(rails.fs, deg(c), RAD.shell, x);
  }
  for (const c of [22.5, 112.5, 247.5, 337.5]) {
    const pts = arcPts(rF, 5.9, c - 15, c + 15, 10);
    for (let i = 0; i < pts.length - 1; i++) rail(rails.fs, pts[i], pts[i + 1]);
    for (const a of [c - 12, c + 12]) standoff(rails.fs, deg(a), RAD.shell, 5.9);
  }
  const HR = (where, list, mass, desc) => P(`EVA handrails (${where})`, {
    system: 'Crew systems', material: 'Yellow-painted aluminium rails, 3.2 cm across, on stand-offs', mass, temp: 265, explode: [0, 0, 0], xrayWeight: 0.25, desc,
  }, mesh(merge(list), HM.handrail()));
  out.railLength = railLen;
  const m = (k) => Math.round(railLen[k]);
  HR('aft shroud', rails.aft, 14, `Rails along the edges of every instrument door, about ${m('aft')} m here. Hubble was designed to be repaired by hand: 225 ft (69 m) of handrails in all let spacewalkers move hand over hand to every door. Runs simplified.`);
  HR('equipment section', rails.eq, 16, `Two rails on every bay door, ${m('eq')} m in all, give a spacewalker something to hold while the J-hooks are released and the door swings open.`);
  HR('forward shell', rails.fs, 12, `Four runs along the barrel, joined by short arcs at the equipment section (${m('fs')} m), lead forward past the antenna masts, torquer bars and grapple fixtures. Runs simplified.`);
  HR('light shield', rails.ls, 14, `Four runs toward the aperture and arcs between the antenna latch lines and scuff plates, ${m('ls')} m in all. Runs simplified.`);

  // 31 portable-foot-restraint sockets (10 on the bay doors above, 21 placed here)
  for (const [x, c] of [[3.3, 30], [3.3, 60], [3.3, 120], [3.3, 240], [3.3, 300], [3.3, 330], [0.45, 0], [0.45, 30], [0.45, 150], [0.45, 180], [0.45, 210], [0.45, 330]]) socket(x, RAD.big + 0.005, deg(c));
  for (const [x, c] of [[6.25, 30], [6.25, 150], [6.25, 210], [6.25, 330], [7.7, 90], [7.7, 270], [8.6, 60], [8.6, 240], [8.6, 0]]) socket(x, RAD.shell, deg(c));
  P('Foot-restraint sockets', {
    system: 'Crew systems', material: 'Square aluminium receptacles on doubler plates', mass: 12, count: 31, temp: 265, explode: [0, 0, 0], xrayWeight: 0.25,
    desc: '31 sockets accept the portable foot restraint, a platform that locks an astronaut\'s boots in place so both hands are free to work. Its probe drops into the 10 cm square socket; a 90° socket converter lets the same socket face another way. Socket positions approximate.',
  }, mesh(merge(out.sockets), HM.handrail()));

  return out;
}
