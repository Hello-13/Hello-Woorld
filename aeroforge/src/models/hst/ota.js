// Optical Telescope Assembly (Perkin-Elmer, now L3Harris): the 2.4 m Ritchey–Chrétien telescope.
// The mirror shapes are the conics solved in physics/optics.js from the rounded published spacings
// (K1 = −1.0023, K2 = −1.4969; the design prescription is −1.0022985 and −1.4960), the spacings are NASA's (4.906 m between vertices, focus 1.5 m behind the primary). Structure
// sizes follow the SM3A Media Reference Guide §5.2: titanium main ring 2.9 m across and 38 cm deep,
// beryllium reaction plate behind the mirror, graphite-epoxy metering truss 4.8 m long and 2.7 m
// across (48 struts, three rings), main baffle 4.8 m × 2.7 m, central baffle 3 m long.
// Also builds the light-path overlay drawn in X-ray, Systems and Blueprint.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { rod, beam, mergeGeometries } from '../../engine/geometry.js';
import { RAD, OPT, pmSurface, smSurface, az, deg, axial, tube, annulus, ix, cablePath } from './layout.js';
import { HM } from './materials.js';

const merge = (list) => mergeGeometries(list.map(ix));

export function buildOTA(P) {
  const out = {};
  const xPM = OPT.xPM;
  const xBack = xPM - OPT.tPM;           // back faceplate rear face
  const fp = 0.025;                      // faceplate thickness (≈1 in)

  // ------------------------------------------------------------------ primary mirror
  const N = 24;
  const front = [];
  for (let i = 0; i <= N; i++) {
    const r = OPT.rHole + ((OPT.rPM - OPT.rHole) * i) / N;
    front.push([r, pmSurface(r)]);
  }
  const face = mesh(axial(front, 96), HM.mirror());
  // front faceplate (25 mm) under the coating, with the outer and inner edge bands
  const plate = front.map(([r, x]) => [r, x - 0.003]);
  for (let i = front.length - 1; i >= 0; i--) plate.push([front[i][0], front[i][1] - fp]);
  plate.push(plate[0]);
  const bands = [tube(OPT.rPM, xBack + fp, pmSurface(OPT.rPM) - fp, { seg: 96 }), tube(OPT.rHole, xBack + fp, pmSurface(OPT.rHole) - fp, { seg: 48 })];
  out.pm = P('Primary mirror', {
    system: 'Optics', material: 'Corning ULE (titanium-silicate) glass; 65 nm aluminium + 25 nm MgF₂ coating', mass: 828, massSource: 'NASA (1,825 lb, whole mirror; the SM3A guide rounds it to 1,800 lb, 818 kg)', temp: 294, explode: [0.7, 0, 0],
    desc: '2.4 m concave hyperboloid, f/2.3, radius of curvature 11.04 m, polished to about 10 nm. In 1990 it proved to be 2.2 µm too flat at the edge — spherical aberration from a mis-spaced test instrument — corrected optically in 1993. NASA quotes 1,800–1,825 lb (818–828 kg) for the whole mirror, core and rear plate included; a solid blank would have weighed about 8,000 lb.',
    callout: true, anchor: [xPM + 0.05, 0.9, 0.7],
  }, [face, mesh(merge([axial(plate.slice().reverse(), 96), ...bands]), HM.ule())]);
  out.pm.userData.part.tourLabel = true;          // internal: labelled only while a tour focuses it

  // lightweighted egg-crate core between the plates (cell pitch simplified to 0.2 m)
  const core = [];
  const x0 = xBack + fp, x1 = xPM - fp, xm = (x0 + x1) / 2, depth = x1 - x0;
  for (let c = -1.1; c <= 1.1 + 1e-6; c += 0.2) {
    for (const along of ['y', 'z']) {
      const half = Math.sqrt(Math.max(0, OPT.rPM ** 2 - c * c)) - 0.03;
      if (half <= 0) continue;
      const segs = Math.abs(c) < OPT.rHole ? [[-half, -Math.sqrt(OPT.rHole ** 2 - c * c)], [Math.sqrt(OPT.rHole ** 2 - c * c), half]] : [[-half, half]];
      for (const [a, b] of segs) {
        const len = b - a;
        if (len < 0.05) continue;
        const g = along === 'y' ? new THREE.BoxGeometry(depth, len, 0.01) : new THREE.BoxGeometry(depth, 0.01, len);
        if (along === 'y') g.translate(xm, (a + b) / 2, c); else g.translate(xm, c, (a + b) / 2);
        core.push(g);
      }
    }
  }
  P('Primary mirror egg-crate core', {
    system: 'Optics', material: 'ULE glass ribs fused between the faceplates', temp: 294, explode: [-0.75, 0, 0], xrayWeight: 0.25,
    desc: 'A grid of thin glass ribs between the two faceplates: the mirror is mostly empty space, so it weighs 828 kg where a solid blank would weigh about 3.6 t, and it is stiff enough to hold its figure under its own weight on the ground. Mass included in the primary mirror.',
  }, mesh(merge(core), HM.ule()));
  const rear = axial([[OPT.rHole, xBack], [OPT.rPM, xBack], [OPT.rPM, xBack + fp], [OPT.rHole, xBack + fp], [OPT.rHole, xBack]], 96);
  P('Primary mirror rear faceplate', {
    xrayWeight: 0.4, system: 'Optics', material: 'ULE glass plate, 25 mm', temp: 294, explode: [-1.2, 0, 0],
    desc: 'Closes the back of the sandwich. The 24 figure-control actuators and the three mounts push against it. Mass included in the primary mirror.',
  }, mesh(rear, HM.ule()));

  // mounts and figure-control actuators on the back
  const sup = [];
  for (let k = 0; k < 3; k++) {
    const p = deg(30 + k * 120);
    sup.push(rod(az(p, 1.08, xBack + 0.05), az(p, 1.32, xBack - 0.12), 0.035, 8));
    sup.push(new THREE.BoxGeometry(0.12, 0.16, 0.16).translate(...az(p, 1.08, xBack - 0.02)));
  }
  const act = [], pads = [];
  for (let k = 0; k < 24; k++) {
    const ring = k < 8 ? 0.55 : 0.98;
    const p = deg(k < 8 ? k * 45 + 22.5 : (k - 8) * 22.5);
    act.push(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 10).rotateZ(Math.PI / 2).translate(...az(p, ring, xBack - 0.1)));
    pads.push(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 14).rotateZ(Math.PI / 2).translate(...az(p, ring, xBack - 0.01)));
  }
  P('Primary mirror mounts & actuators', {
    system: 'Optics', material: 'Titanium kinematic linkages; 24 figure-control actuators', mass: 45, temp: 294, explode: [-1.6, 0, 0], count: 24, xrayWeight: 0.5,
    desc: 'Three rods through the glass fix the mirror axially and three bonded pads hold it laterally, so the main ring carries it without forcing its shape. 24 actuators in two rings behind it can push the surface by fractions of a wavelength; they proved too weak to cancel the 1990 spherical aberration.',
  }, [mesh(merge(sup), HM.ti()), mesh(merge(act), HM.box())]);
  P('Primary mirror actuator pads', {
    system: 'Optics', material: 'Pads bonded to the rear faceplate, one under each actuator', mass: 2, count: 24, temp: 294, explode: [-1.4, 0, 0], xrayWeight: 0.6,
    desc: 'The 24 figure-control actuators push on the glass through pads bonded to its rear faceplate: 8 on a ring 0.55 m out and 16 on a ring at 0.98 m. They can bend the surface by fractions of a wavelength, far too little to undo the 2.2 µm error found in 1990. Pad size estimated.',
  }, mesh(merge(pads), HM.ti()));

  // reaction plate: a beryllium wheel of 15 radial I-beams behind the mirror, spanning the main ring
  const rp = [tube(0.45, xBack - 0.24, xBack - 0.13, { seg: 40, open: false })];
  for (let k = 0; k < 15; k++) {
    const p = deg(k * 24);
    const a = az(p, 0.45, xBack - 0.185), b = az(p, 1.3, xBack - 0.185);
    rp.push(beam(a, b, 0.11, 0.012));                                        // web
    rp.push(beam(az(p, 0.45, xBack - 0.135), az(p, 1.3, xBack - 0.135), 0.012, 0.07), beam(az(p, 0.45, xBack - 0.235), az(p, 1.3, xBack - 0.235), 0.012, 0.07));   // flanges
  }
  for (let k = 0; k < 15; k++) {                                             // intercostal ribs between the beams
    for (const r of [0.75, 1.05]) rp.push(rod(az(deg(k * 24), r, xBack - 0.185), az(deg(k * 24 + 24), r, xBack - 0.185), 0.012, 4));
  }
  rp.push(annulus(0.45, 1.3, xBack - 0.245, 64, -1));
  P('Reaction plate', {
    system: 'Structure', material: 'Beryllium: 15 radial I-beams, 48 intercostal ribs, central ring', mass: 90, temp: 293, explode: [-2.0, 0, 0], xrayWeight: 0.3,
    desc: 'A wheel of beryllium I-beams spanning the main ring behind the primary. It carries the heater array that keeps the back of the mirror at 21 °C, the 24 figure-control actuators, and the central baffle on its centre ring. Rib layout simplified.',
  }, mesh(merge(rp), HM.ti()));

  const heater = annulus(OPT.rHole + 0.05, OPT.rPM - 0.02, xBack - 0.012, 64, -1);
  P('Primary mirror heaters', {
    system: 'Thermal control', material: 'Kapton heater panels with thermostats', mass: 18, temp: 294, explode: [-1.85, 0, 0],
    desc: 'Heaters behind the mirror hold the glass near 21 °C (70 °F) so its figure does not change as the telescope passes between sunlight and Earth shadow every orbit.',
  }, mesh(heater, HM.kapton()));

  // the plate floats on 15 axial and 15 flexure mounts at the I-beam tips, where it meets the main ring
  const rpm = [];
  for (let k = 0; k < 15; k++) {
    const p = deg(k * 24);
    rpm.push(new THREE.BoxGeometry(0.06, 0.08, 0.08).rotateX(p).translate(...az(p, 1.33, 3.69)));                 // axial mount on the ring's aft face
    rpm.push(new THREE.BoxGeometry(0.16, 0.012, 0.06).rotateX(p + deg(5)).translate(...az(p + deg(5), 1.245, 3.74)));   // flexure blade to the ring's bore
  }
  P('Reaction plate mounts', {
    system: 'Structure', material: 'Titanium axial mounts and flexure blades', mass: 6, count: 30, temp: 292, explode: [-1.8, 0, 0], xrayWeight: 0.5,
    desc: 'The beryllium reaction plate floats on 15 axial and 15 flexure mounts, one pair at the tip of each I-beam, so the main ring\'s flexing never reaches the mirror\'s backing. Mount shape estimated.',
  }, mesh(merge(rpm), HM.fitting()));

  // ------------------------------------------------------------------ main ring and OTA–SSM links
  const ringProfile = [[1.24, 3.72], [1.42, 3.72], [1.42, 4.12], [1.24, 4.12], [1.24, 3.72]];
  const ringParts = [axial(ringProfile, 96)];
  for (let k = 0; k < 24; k++) ringParts.push(new THREE.BoxGeometry(0.36, 0.08, 0.025).rotateX(deg(k * 15)).translate(...az(deg(k * 15), 1.46, 3.92)));
  out.mainRing = P('Main ring', {
    system: 'Structure', material: 'Titanium hollow box-section ring, 38 cm deep', mass: 545, massSource: 'NASA SM3A Media Guide (1,200 lb)', temp: 292, explode: [0, 0, 0], xrayWeight: 0.4,
    desc: 'The structural backbone of the telescope, 2.9 m across: the primary mirror, the main baffle, the metering truss and the focal-plane structure all hang from it, and kinematic brackets tie it to the spacecraft.',
  }, mesh(merge(ringParts), HM.ti()));
  // three bipods (six links) from the main ring's aft face to the equipment section's forward frame
  const links = [];
  for (let k = 0; k < 3; k++) {
    const p = deg(60 + k * 120);
    const apex = az(p, 1.36, 3.7);
    links.push(new THREE.BoxGeometry(0.06, 0.1, 0.16).rotateX(p).translate(...az(p, 1.36, 3.69)));
    for (const s of [-1, 1]) {
      const foot = az(p + s * deg(9), 1.52, 3.6);
      links.push(rod(apex, foot, 0.022, 8), new THREE.SphereGeometry(0.035, 10, 8).translate(...foot), new THREE.SphereGeometry(0.035, 10, 8).translate(...apex));
      links.push(new THREE.BoxGeometry(0.1, 0.03, 0.1).rotateX(p + s * deg(9)).translate(...az(p + s * deg(9), 1.535, 3.6)));
    }
  }
  P('OTA kinematic mounts', {
    system: 'Structure', material: 'Titanium links with spherical end bearings, in three bipod pairs', mass: 24, count: 6, temp: 290, explode: [-0.4, 0, 0],
    desc: 'Six links in three bipod pairs join the main ring to the equipment section, one constraint for each of a rigid body\'s six degrees of freedom. Such a statically determinate (kinematic) mount fixes the telescope without forcing it, so flexing of the spacecraft cannot strain the optics. Link geometry approximate.',
  }, mesh(merge(links), HM.ti()));

  // ------------------------------------------------------------------ metering truss
  // three rings and 48 struts: 24 in each bay, zig-zagging between 12 nodes per ring
  const rings = [4.12, 6.56, 9.0];
  const nodes = 12;
  out.trussFront = rings[2];
  const nodeAt = (i, j) => az(deg((j + (i % 2) * 0.5) * (360 / nodes)), RAD.truss, rings[i]);
  const struts = [], ringsGeo = [], fittings = [];
  for (let i = 0; i < rings.length; i++) {
    ringsGeo.push(axial([[RAD.truss - 0.035, rings[i] - 0.04], [RAD.truss + 0.035, rings[i] - 0.04], [RAD.truss + 0.035, rings[i] + 0.04], [RAD.truss - 0.035, rings[i] + 0.04], [RAD.truss - 0.035, rings[i] - 0.04]], 72));
    for (let j = 0; j < nodes; j++) {
      fittings.push(new THREE.IcosahedronGeometry(0.06, 0).translate(...nodeAt(i, j)));
      if (i < rings.length - 1) {
        const back = (i % 2) ? j : (j - 1 + nodes) % nodes;
        const fwd = (i % 2) ? (j + 1) % nodes : j;
        struts.push(rod(nodeAt(i, j), nodeAt(i + 1, back), 0.032, 8));
        struts.push(rod(nodeAt(i, j), nodeAt(i + 1, fwd), 0.032, 8));
      }
    }
  }
  out.truss = P('Metering truss', {
    system: 'Structure', material: 'Graphite fibre-reinforced epoxy struts and rings, titanium end fittings; aluminised-Mylar MLI inside', mass: 114, temp: 292, explode: [0, 0, 0], xrayWeight: 0.5,
    desc: 'A cage of 48 struts and three rings, 4.8 m long and 2.7 m across, that holds the secondary mirror 4.906 m in front of the primary to within 2.5 µm. Graphite-epoxy barely expands with temperature, but it slowly sheds absorbed water, so the secondary has been refocused by a few micrometres over the years.',
  }, [mesh(merge([...struts, ...ringsGeo]), HM.grEp()), mesh(merge(fittings), HM.fitting())]);

  // ------------------------------------------------------------------ baffles
  const mb = [tube(1.3, 4.12, 8.92, { seg: 72 })];
  for (let k = 0; k < 13; k++) mb.push(annulus(1.235, 1.3, 4.3 + k * 0.36, 72, 1));
  P('Main baffle', {
    xrayWeight: 0.35, system: 'Optics', skin: true, material: 'Aluminium cylinder with internal stray-light fins, flat black', mass: 70, temp: 290, explode: [0.6, 0, 0],
    desc: 'A 4.8 m aluminium cylinder, 2.7 m across, standing on the front face of the main ring inside the metering truss. Its sharp-edged fins trap light that enters the tube at an angle so it cannot scatter onto the mirror and fog the images.',
  }, mesh(merge(mb), HM.black()));
  // the cone stops where it would start to clip the innermost rays bound for the secondary
  const cb0 = xBack - 0.24, cb1 = 6.4;
  const cb = [tube(0.3, cb0, cb1, { seg: 40, rTop: 0.235 })];
  for (let k = 0; k < 6; k++) {
    const x = 4.3 + k * 0.38;
    const r = 0.3 + ((0.235 - 0.3) * (x - cb0)) / (cb1 - cb0);
    cb.push(annulus(0.21, r, x, 40, 1));
  }
  const cbb = [];
  for (let k = 0; k < 5; k++) cbb.push(rod(az(deg(36 + k * 72), 0.44, xBack - 0.12), az(deg(36 + k * 72), 0.305, xBack + 0.02), 0.014, 6), new THREE.BoxGeometry(0.06, 0.02, 0.06).rotateX(deg(36 + k * 72)).translate(...az(deg(36 + k * 72), 0.31, xBack + 0.01)));
  P('Central baffle brackets', {
    system: 'Structure', material: 'Aluminium brackets on the reaction plate\'s central ring', mass: 2, count: 5, temp: 292, explode: [0.2, 0, 0],
    desc: 'Five brackets on the reaction plate\'s central ring hold the root of the central baffle, so the cone rises through the hole in the primary without touching the glass. Bracket shape estimated.',
  }, mesh(merge(cbb), HM.al()));
  P('Central baffle', {
    xrayWeight: 0.4, system: 'Optics', material: 'Aluminium cone, flat black with vanes', mass: 18, temp: 291, explode: [0.9, 0, 0],
    desc: 'A cone about 3 m long, mounted on the reaction plate and rising through the 60 cm hole in the primary. With the secondary baffle it blocks every straight path from the sky to the focal plane, so only light that has bounced off both mirrors reaches the instruments.',
  }, mesh(merge(cb), HM.black()));

  // ------------------------------------------------------------------ secondary mirror and its assembly
  const sm = [];
  for (let i = 0; i <= 12; i++) { const r = (OPT.rSM * i) / 12; sm.push([Math.max(r, 0.0005), smSurface(r)]); }
  const smFace = mesh(axial(sm.slice().reverse(), 64), HM.mirror());
  const smBody = mesh(tube(OPT.rSM, smSurface(OPT.rSM), OPT.xSM + 0.055, { seg: 48, open: false }), HM.ule());
  out.sm = P('Secondary mirror', {
    system: 'Optics', material: 'Zerodur glass ceramic, Al + MgF₂ coating', mass: 12, temp: 291, explode: [1.3, 0, 0],
    desc: '0.3 m convex hyperboloid (design conic −1.4960) facing back down the tube. It multiplies the primary\'s 5.52 m focal length by 10.4 into the 57.6 m, f/24 beam and sends it back through the hole in the primary. Its surface is figured even more accurately than the primary\'s.',
    callout: true, anchor: [OPT.xSM, 0.3, 0.15],
  }, [smFace, smBody]);
  out.sm.userData.part.tourLabel = true;

  // secondary mirror assembly (SM3A Fig. 5-23): a base plate closing the front of the hub, three
  // actuator pairs reaching back to the mirror's cell, flexures and a clamp ring holding the glass,
  // all inside a short shroud
  const xs = OPT.xSM;
  const shroudG = [tube(0.22, xs + 0.07, xs + 0.36, { seg: 40 }), annulus(0.17, 0.22, xs + 0.07, 40, -1)];
  const baseG = [tube(0.215, xs + 0.33, xs + 0.36, { seg: 40, open: false })];
  for (let k = 0; k < 3; k++) baseG.push(new THREE.BoxGeometry(0.03, 0.07, 0.1).rotateX(deg(k * 120)).translate(...az(deg(k * 120), 0.17, xs + 0.315)));   // actuator clevis blocks
  P('Secondary mirror assembly', {
    system: 'Optics', material: 'Graphite-epoxy shroud, titanium base plate on the spider hub', mass: 30, temp: 290, explode: [1.9, 0, 0], xrayWeight: 0.5,
    desc: 'The hub at the front of the truss. Its base plate carries three pairs of actuators that tilt, decenter and refocus the secondary on command from the ground, using wavefront data from the optical control sensors in the Fine Guidance Sensors; the secondary must stay within 2.5 µm (0.0001 in) of its place 4.9 m in front of the primary.',
  }, [mesh(merge(shroudG), HM.grEp()), mesh(merge(baseG), HM.ti())]);
  const smAct = [];
  for (let k = 0; k < 3; k++) {
    for (const s of [-1, 1]) {
      const a = az(deg(k * 120 + s * 24), 0.17, xs + 0.31), b = az(deg(k * 120 + s * 7), 0.16, xs + 0.13);
      const m = [a[0] + (b[0] - a[0]) * 0.35, a[1] + (b[1] - a[1]) * 0.35, a[2] + (b[2] - a[2]) * 0.35];
      smAct.push(rod(a, m, 0.026, 10), rod(m, b, 0.012, 8));             // motor housing and push rod
    }
  }
  P('Secondary mirror actuators', {
    system: 'Optics', material: 'Stepper-motor linear actuators in three pairs', mass: 6, count: 6, temp: 290, explode: [1.65, 0, 0], xrayWeight: 0.7,
    desc: 'Three pairs of actuators, 120° apart, between the base plate and the mirror cell: moving them together refocuses the secondary, moving them differently tilts or decenters it. Steps of a few micrometres have kept Hubble in focus as the graphite-epoxy truss slowly dries out and shrinks.',
  }, mesh(merge(smAct), HM.box()));
  const smCell = [tube(0.17, xs + 0.12, xs + 0.14, { seg: 40, open: false }), tube(0.172, xs + 0.02, xs + 0.065, { seg: 40 }), annulus(0.135, 0.172, xs + 0.065, 40, 1)];
  for (let k = 0; k < 3; k++) smCell.push(new THREE.BoxGeometry(0.06, 0.008, 0.05).rotateX(deg(60 + k * 120)).translate(...az(deg(60 + k * 120), 0.16, xs + 0.092)));
  P('Secondary mirror cell, flexures & clamp', {
    system: 'Optics', material: 'Titanium cell plate, three flexure blades and a clamp ring', mass: 4, temp: 290, explode: [1.45, 0, 0], xrayWeight: 0.7,
    desc: 'The clamp ring holds the 0.3 m Zerodur mirror at its edge; three thin flexure blades join it to the cell plate the actuators push on, so the glass is located without being squeezed out of shape. Sizes estimated.',
  }, mesh(merge(smCell), HM.ti()));

  const vanes = [];
  for (let k = 0; k < 4; k++) {
    const p = deg(k * 90);
    const g = new THREE.BoxGeometry(0.22, RAD.truss - 0.4, 0.02);
    g.translate(0, (RAD.truss + 0.4) / 2, 0).rotateX(p).translate(out.trussFront - 0.02, 0, 0);
    vanes.push(g);
  }
  P('Secondary mirror spider', {
    system: 'Optics', material: 'Thin graphite-epoxy vanes', mass: 9, count: 4, temp: 290, explode: [1.6, 0, 0],
    desc: 'Four thin vanes from the front ring of the truss hold the secondary assembly in the beam. Light diffracting around them makes the four-pointed spikes on every bright star in a Hubble picture.',
  }, mesh(merge(vanes), HM.grEp()));

  const sb = [tube(OPT.rObsc, 8.3, OPT.xSM + 0.06, { seg: 48 }), annulus(0.22, OPT.rObsc, OPT.xSM + 0.06, 48, 1)];
  for (let k = 0; k < 4; k++) sb.push(annulus(OPT.rObsc - 0.05, OPT.rObsc, 8.42 + k * 0.17, 48, -1));
  P('Secondary baffle', {
    xrayWeight: 0.4, system: 'Optics', material: 'Flat-black aluminium shroud', mass: 7, temp: 290, explode: [1.3, 0.5, 0],
    desc: 'A 0.79 m shroud around the secondary. Its shadow sets Hubble\'s central obscuration: 33 % of the aperture diameter, about 11 % of the area.',
  }, mesh(merge(sb), HM.black()));

  // ------------------------------------------------------------------ focal-plane structure
  // a graphite-epoxy box of three square frames (aft x 0.42, deck x 2.62, forward x 3.58) and four
  // corner longerons, hung from the main ring's aft face on eight flexures (SM3A §5.2.3, Fig. 5-24)
  const fps = [];
  const c = 1.02, xd = 2.62, xF = 3.58, xA = 0.42;
  for (const [sy, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) fps.push(beam([xA, sy * c, sz * c], [xF, sy * c, sz * c], 0.12, 0.12));
  for (const x of [xA, xd, xF]) {
    fps.push(beam([x, c, -c], [x, c, c], 0.1, 0.1), beam([x, -c, -c], [x, -c, c], 0.1, 0.1));
    fps.push(beam([x, -c, c], [x, c, c], 0.1, 0.1), beam([x, -c, -c], [x, c, -c], 0.1, 0.1));
  }
  // the deck's cross beams separate the four axial bays
  fps.push(new THREE.BoxGeometry(0.1, 2.04, 0.08).translate(xd, 0, 0), new THREE.BoxGeometry(0.1, 0.08, 2.04).translate(xd, 0, 0));
  // diagonal bracing in the four side planes
  for (const s of [1, -1]) {
    fps.push(beam([0.5, s * c, -c], [2.55, s * c, c], 0.06, 0.06));
    fps.push(beam([0.5, -c, s * c], [2.55, c, s * c], 0.06, 0.06));
  }
  // outriggers from the forward frame to the eight flexure points on the main ring
  const FLEX = Array.from({ length: 8 }, (_, k) => deg(22.5 + k * 45));
  for (const p of FLEX) fps.push(beam(az(p, 1.08, xF), az(p, 1.37, xF), 0.07, 0.07));
  P('Focal plane structure', {
    system: 'Structure', material: 'Graphite-epoxy optical bench: three square frames and four corner longerons', mass: 545, massSource: 'NASA SM3A Media Guide (more than 1,200 lb)', temp: 293, explode: [-2.2, 0, 0], xrayWeight: 0.35,
    desc: 'A 3 m × 2.1 m optical bench cantilevered off the rear of the main ring at eight flexible points. It holds the axial instruments, the radial camera and the three Fine Guidance Sensors at the focal surface so swapped instruments land in focus; its −V3 side carries the star trackers and gyros.',
  }, mesh(merge(fps), HM.grEp()));

  const flex = [];
  for (const p of FLEX) {
    flex.push(new THREE.BoxGeometry(0.14, 0.02, 0.08).rotateX(p).translate(...az(p, 1.37, 3.65)));
    for (const x of [3.6, 3.71]) flex.push(new THREE.BoxGeometry(0.03, 0.05, 0.1).rotateX(p).translate(...az(p, 1.37, x)));
  }
  P('FPS flexures', {
    system: 'Structure', material: 'Titanium blade flexures with end clamps', mass: 8, count: 8, temp: 292, explode: [-1.0, 0, 0],
    desc: 'The 545 kg bench hangs from the main ring\'s aft face on eight flexible points. They can be adjusted so thermal distortion of the spacecraft cannot pull the instruments out of focus. Azimuths and blade size estimated.',
  }, mesh(merge(flex), HM.ti()));

  // guide rails: eight axial runs under the rail strips on the instruments' outer faces, a centre
  // strut down the middle of the axial bays, and a pair of radial rails for each radial bay
  const gr = [];
  const flare = (x, y, z, alongY) => gr.push(new THREE.BoxGeometry(0.08, alongY ? 0.05 : 0.1, alongY ? 0.1 : 0.05).translate(x, y, z));
  for (const s of [1, -1]) for (const t of [1, -1]) {
    gr.push(new THREE.BoxGeometry(2.15, 0.04, 0.06).translate(1.53, s * 1.01, t * 0.5));
    gr.push(new THREE.BoxGeometry(2.15, 0.06, 0.04).translate(1.53, t * 0.5, s * 1.01));
    for (const x of [0.48, 2.58]) { flare(x, s * 1.01, t * 0.5, true); flare(x, t * 0.5, s * 1.01, false); }
  }
  gr.push(rod([0.45, 0, 0], [2.56, 0, 0], 0.03, 10));
  for (const x of [0.45, 1.5]) gr.push(rod([x, -0.04, -0.04], [x, 0.04, 0.04], 0.012, 6), rod([x, 0.04, -0.04], [x, -0.04, 0.04], 0.012, 6));
  const RADIAL = [[0, 1.82, 3.4, 0.25, 0.25], [90, 1.82, 3.4, 0.25, 0.25], [270, 1.82, 3.4, 0.25, 0.25], [180, 1.22, 3.42, 0.25, 0.41]];
  for (const [a, x0, x1, w0, w1] of RADIAL) {
    const p = deg(a), xm = (x0 + x1) / 2;
    for (const s of [-1, 1]) {
      const r0 = 1.05, r1 = 2.0;
      const t0 = s * (w0 + (w1 - w0) * (r0 - 1.0) / 1.04 + 0.03), t1 = s * (w0 + (w1 - w0) * (r1 - 1.0) / 1.04 + 0.03);
      const P0 = new THREE.Vector3(xm, r0, t0).applyAxisAngle(new THREE.Vector3(1, 0, 0), p), P1 = new THREE.Vector3(xm, r1, t1).applyAxisAngle(new THREE.Vector3(1, 0, 0), p);
      gr.push(beam(P0.toArray(), P1.toArray(), 0.06, 0.04));
    }
  }
  P('FPS guide rails', {
    system: 'Structure', material: 'Aluminium rails with flared lead-in ends; graphite-epoxy centre strut', mass: 20, count: 17, temp: 292, explode: [-2.6, 0, 0], xrayWeight: 0.4,
    desc: 'Instruments as big as a phone booth (COS: 386 kg) slide in on these rails, their flared ends guiding the instrument\'s rail strips. Once the latches close the instrument no longer touches them: every load goes through the latches. In 2009 a restraint tool was clamped to the centre strut while COS went in.',
  }, mesh(merge(gr), HM.al()));

  // latches. Axial instruments: an A latch at the forward end by the aperture (fixes all three axes),
  // a B latch at the aft end driven from the ±V2 side, and a self-aligning C stabiliser.
  // Radial instruments: one A latch with its drive bolt at the outboard face.
  const la = [], lb = [], lc = [], lr = [];
  for (const [qy, qz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    la.push(new THREE.BoxGeometry(0.14, 0.15, 0.12).translate(2.63, qy * 0.32, qz * 0.1));
    la.push(new THREE.SphereGeometry(0.035, 12, 8).translate(2.555, qy * 0.32, qz * 0.1));
    for (const s of [-1, 1]) la.push(new THREE.BoxGeometry(0.06, 0.03, 0.05).translate(2.58, qy * 0.32 + s * 0.05, qz * 0.1));
    lb.push(new THREE.BoxGeometry(0.12, 0.15, 0.13).translate(0.47, qy * 0.3, qz * 1.03));
    lb.push(rod([0.47, qy * 0.3, qz * 1.09], [0.47, qy * 0.3, qz * 1.36], 0.018, 8), new THREE.CylinderGeometry(0.024, 0.024, 0.035, 6).rotateX(Math.PI / 2).translate(0.47, qy * 0.3, qz * 1.375));
    lb.push(new THREE.SphereGeometry(0.03, 10, 8).translate(0.47, qy * 0.3, qz * 0.955));
    lc.push(new THREE.BoxGeometry(0.1, 0.09, 0.1).translate(0.47, qy * 1.03, qz * 0.3), new THREE.SphereGeometry(0.03, 10, 8).translate(0.47, qy * 0.96, qz * 0.3));
  }
  for (const [a, x] of [[0, 2.6], [90, 2.6], [270, 2.6], [180, 1.32]]) {
    const p = deg(a);
    lr.push(new THREE.BoxGeometry(0.16, 0.14, 0.16).translate(x, 1.95, 0).applyMatrix4(new THREE.Matrix4().makeRotationX(p)));
    lr.push(rod(az(p, 1.86, x), az(p, 2.075, x), 0.016, 8), new THREE.CylinderGeometry(0.024, 0.024, 0.03, 6).translate(x, 2.09, 0).applyMatrix4(new THREE.Matrix4().makeRotationX(p)));
  }
  const latchPart = (name, list, count, desc, explode) => P(name, { system: 'Structure', material: 'Titanium latch housings and fittings', mass: 1.5 * count, count, temp: 292, explode, desc }, mesh(merge(list), HM.ti()));
  latchPart('Axial instrument A-latches', la, 4, 'At the forward end of each axial bay, beside the instrument\'s aperture: a ball fitting on the instrument is clamped in a titanium spherical seat by moving jaws, fixing all three axes. It takes 38 ft-lb in 12–16 turns. Positions approximate.', [-1.4, 0, 0]);
  latchPart('Axial instrument B-latches', lb, 4, 'At the aft end, driven from the ±V2 side through the shroud doors: a plunger pushed into a ball joint drives the instrument onto its A and C fittings and goes over centre in 10–12 turns. In 2009 COS carried a B-latch alignment aid. Positions approximate.', [-3.0, 0, 0]);
  latchPart('Axial instrument C-latches', lc, 4, 'A self-aligning stabiliser ball at the aft end of each axial instrument that engages by itself as the B latch drives the instrument home. Positions approximate.', [-3.0, 0, 0]);
  latchPart('Radial instrument A-latches', lr, 4, 'Each radial instrument (WFC3 and the three Fine Guidance Sensors) has one A latch: a bolt at its outboard end pulls it inboard onto preload springs, 32–35 ft-lb in 20–22 turns. The guiders\' bolts are reached under their bay doors; WFC3 has no door, so its bolt sits under the aft end of its radiator panel. Positions approximate.', [-2.4, 0, 0]);

  // the FPS science-instrument connector panels where the harness ends meet each instrument's cables
  const cp = [];
  for (const [qy, qz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    cp.push(new THREE.BoxGeometry(0.03, 0.3, 0.2).translate(0.34, qy * 0.82, qz * 1.0));
    for (let i = 0; i < 4; i++) cp.push(new THREE.CylinderGeometry(0.028, 0.028, 0.05, 12).rotateZ(Math.PI / 2).translate(0.305, qy * (0.72 + i * 0.075), qz * 1.0));
  }
  P('SI connector panels', {
    system: 'Electrical', material: 'Bracket-mounted bulkhead connector panels on the FPS aft frame', mass: 6, count: 4, temp: 290, explode: [-2.8, 0, 0], xrayWeight: 0.6,
    desc: 'The focal plane structure\'s science-instrument connector panels: here the spacecraft harnesses end, and short instrument cables are mated by hand after the latches close. Most of Hubble\'s replaceable units hang on 7/16-inch double-height hex bolts, so one socket fits nearly every job. Panel layout approximate (SM3A Fig. 5-24).',
  }, mesh(merge(cp), HM.box()));

  // −V3 equipment shelves: the gyros' mounting plate and the star trackers' plate on struts from the FPS
  const sh = [];
  const sv = (phi, r, x, t = 0) => new THREE.Vector3(x, r, t).applyAxisAngle(new THREE.Vector3(1, 0, 0), deg(phi)).toArray();
  sh.push(new THREE.BoxGeometry(1.0, 0.025, 0.42).translate(2.9, 1.565, 0).applyMatrix4(new THREE.Matrix4().makeRotationX(deg(157))));
  for (const x of [2.45, 3.35]) {
    sh.push(beam(sv(157, 1.56, x, -0.2), [x, -c, c], 0.05, 0.05), beam(sv(157, 1.56, x, 0.2), [x, -c, 0.55], 0.05, 0.05));
  }
  sh.push(beam([2.62, -c, 0.55], [xF, -c, 0.55], 0.05, 0.05));
  sh.push(new THREE.BoxGeometry(0.55, 0.025, 0.72).translate(3.0, 1.655, 0).applyMatrix4(new THREE.Matrix4().makeRotationX(deg(206))));
  for (const x of [2.78, 3.22]) sh.push(beam(sv(206, 1.65, x, -0.34), [x, -c, -0.55], 0.05, 0.05), beam(sv(206, 1.65, x, 0.34), [x, -c, -c], 0.05, 0.05));
  sh.push(beam([2.62, -c, -0.55], [xF, -c, -0.55], 0.05, 0.05));
  P('FPS −V3 equipment shelves', {
    system: 'Structure', material: 'Graphite-epoxy shelves and struts on the FPS −V3 face', mass: 25, count: 2, temp: 290, explode: [0, -2.4, 0], xrayWeight: 0.5,
    desc: 'The bench\'s shadow side carries the three rate sensor units on one shelf and the three star trackers on another, so the gyros measure the motion of the optical bench itself. In 2009 each new gyro unit was bolted onto its plate with just three bolts. Shelf shapes estimated.',
  }, mesh(merge(sh), HM.grEp()));

  const ch = [];
  for (const [sy, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const pts = [[0.37, sy * 1.02, sz * 0.7], [0.25, sy * 1.02, sz * 0.7], [0.25, sy * 1.02, sz * 0.96], [0.37, sy * 1.02, sz * 0.96]];
    ch.push(...cablePath(pts, 0.016, 6));
  }
  P('FPS crew handles', {
    system: 'Crew systems', material: 'Yellow aluminium handles on the FPS aft frame', mass: 2, count: 4, temp: 290, explode: [-2.6, 0, 0], xrayWeight: 0.5,
    desc: 'Handles on the bench itself, reached through the ±V2 doors, so a spacewalker can steady himself inside the shroud without touching the instruments. Positions approximate (SM3A Fig. 5-24).',
  }, mesh(merge(ch), HM.handrail()));

  // pick-off mirrors at the focal surface: WFC3 takes the centre, the FGSs the outer annulus
  const pk = [];
  const pick = (phi, r, w) => {
    const g = new THREE.BoxGeometry(0.012, w, 0.09);
    g.rotateZ(deg(45)).rotateX(phi);
    g.translate(...az(phi, r, OPT.xFocus + 0.14));
    pk.push(g);
  };
  pick(deg(180), 0.05, 0.12);
  for (const p of [0, 90, 270]) pick(deg(p), 0.215, 0.07);
  P('Pick-off mirrors', {
    system: 'Optics', material: 'Aluminised fold mirrors', mass: 2, count: 4, temp: 292, explode: [0.4, 0, 0],
    desc: 'Small 45° mirrors at the focal surface divide Hubble\'s field: the radial camera\'s mirror sits on axis, the three guiders take arcs at the edge, and the axial instruments look through the gaps around them.',
  }, mesh(merge(pk), HM.mirror()));

  out.lightPath = buildLightPath();
  return out;
}

/** Ray-trace overlay: entrance rays → primary → secondary → Cassegrain focus. FX, not a part. */
function buildLightPath() {
  const g = new THREE.Group();
  g.name = 'Light path';
  const k = OPT.design.k;                  // ray height ratio at the secondary
  const rays = [];
  const add = (r, phi) => {
    const p0 = az(phi, r, 15.2);
    const p1 = az(phi, r, pmSurface(r));
    const r2 = r * k;
    const p2 = az(phi, r2, smSurface(r2));
    const p3 = [OPT.xFocus, 0, 0];
    rays.push(rod(p0, p1, 0.011, 5), rod(p1, p2, 0.011, 5), rod(p2, p3, 0.009, 5));
  };
  for (let i = 0; i < 8; i++) add(1.1, deg(22.5 + i * 45));
  for (let i = 0; i < 4; i++) add(0.62, deg(i * 90 + 45));
  // each element twice: a bright depth-tested pass and a faint ghost that shows through solid parts
  const rayGeo = mergeGeometries(rays.map(ix));
  const cone1 = axial([[OPT.rPM, pmSurface(OPT.rPM)], [OPT.rPM * k, smSurface(OPT.rPM * k)]], 64);
  const cone2 = axial([[OPT.rPM * k, smSurface(OPT.rPM * k)], [0.002, OPT.xFocus]], 48);
  const focusGeo = new THREE.SphereGeometry(0.035, 16, 10).translate(OPT.xFocus, 0, 0);
  const list = [
    [rayGeo, HM.ray(), 6], [rayGeo, HM.rayGhost(), 5],
    [mergeGeometries([cone1, cone2].map(ix)), HM.beam(), 5],
    [focusGeo, HM.focus(), 7], [focusGeo, HM.focusGhost(), 6],
    [new THREE.RingGeometry(0.0, OPT.rField, 48).rotateY(Math.PI / 2).translate(OPT.xFocus, 0, 0), HM.beam(), 5],
  ];
  for (const [geo, mat, order] of list) {
    const m = mesh(geo, mat, { cast: false, receive: false });
    m.userData.fx = true;
    m.userData.keepInModes = true;
    m.userData.noAO = true;
    m.renderOrder = order;
    m.raycast = () => {};
    g.add(m);
  }
  g.visible = false;
  return g;
}
