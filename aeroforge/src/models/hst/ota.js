// Optical Telescope Assembly (Perkin-Elmer, now L3Harris): the 2.4 m Ritchey–Chrétien telescope.
// The mirror shapes are the design conics solved in physics/optics.js (K1 = −1.0023, K2 = −1.4969),
// the spacings are NASA's (4.906 m between vertices, focus 1.5 m behind the primary). Structure
// sizes follow the SM3A Media Reference Guide §5.2: titanium main ring 2.9 m across and 38 cm deep,
// beryllium reaction plate behind the mirror, graphite-epoxy metering truss 4.8 m long and 2.7 m
// across (48 struts, three rings), main baffle 4.8 m × 2.7 m, central baffle 3 m long.
// Also builds the light-path overlay drawn in X-ray, Systems and Blueprint.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { rod, beam, mergeGeometries } from '../../engine/geometry.js';
import { ST, RAD, OPT, pmSurface, smSurface, az, deg, axial, tube, annulus, ni } from './layout.js';
import { HM } from './materials.js';

const merge = (list) => mergeGeometries(list.map(ni));

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
    system: 'Optics', material: 'Corning ULE (titanium-silicate) glass; 65 nm aluminium + 25 nm MgF₂ coating', mass: 828, massSource: 'NASA (1,825 lb, whole mirror)', temp: 294, explode: [-0.3, 0, 0],
    desc: '2.4 m concave hyperboloid, f/2.3, radius of curvature 11.04 m, polished to about 10 nm. In 1990 it proved to be 2.2 µm too flat at the edge — spherical aberration from a mis-spaced test instrument — corrected optically in 1993. The 828 kg includes the core and rear plate.',
    callout: true, anchor: [xPM + 0.05, 0.9, 0.7],
  }, [face, mesh(axial(plate.slice().reverse(), 96), HM.ule()), mesh(merge(bands), HM.ule())]);

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
    system: 'Optics', material: 'ULE glass ribs fused between the faceplates', temp: 294, explode: [-0.75, 0, 0],
    desc: 'A grid of thin glass ribs between the two faceplates: the mirror is mostly empty space, so it weighs 828 kg where a solid blank would weigh about 3.6 t, and it is stiff enough to hold its figure under its own weight on the ground. Mass included in the primary mirror.',
  }, mesh(merge(core), HM.ule()));
  const rear = axial([[OPT.rHole, xBack], [OPT.rPM, xBack], [OPT.rPM, xBack + fp], [OPT.rHole, xBack + fp], [OPT.rHole, xBack]], 96);
  P('Primary mirror rear faceplate', {
    system: 'Optics', material: 'ULE glass plate, 25 mm', temp: 294, explode: [-1.2, 0, 0],
    desc: 'Closes the back of the sandwich. The 24 figure-control actuators and the three mounts push against it. Mass included in the primary mirror.',
  }, mesh(rear, HM.ule()));

  // mounts and figure-control actuators on the back
  const sup = [];
  for (let k = 0; k < 3; k++) {
    const p = deg(30 + k * 120);
    sup.push(rod(az(p, 1.08, xBack + 0.05), az(p, 1.32, xBack - 0.12), 0.035, 8));
    sup.push(new THREE.BoxGeometry(0.12, 0.16, 0.16).translate(...az(p, 1.08, xBack - 0.02)));
  }
  const act = [];
  for (let k = 0; k < 24; k++) {
    const ring = k < 8 ? 0.55 : 0.98;
    const p = deg(k < 8 ? k * 45 + 22.5 : (k - 8) * 22.5);
    act.push(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 10).rotateZ(Math.PI / 2).translate(...az(p, ring, xBack - 0.08)));
  }
  P('Primary mirror mounts & actuators', {
    system: 'Optics', material: 'Titanium kinematic linkages; 24 figure-control actuators', mass: 45, temp: 294, explode: [-1.6, 0, 0], count: 24,
    desc: 'Three rods through the glass fix the mirror axially and three bonded pads hold it laterally, so the main ring carries it without forcing its shape. 24 actuators in two rings behind it can push the surface by fractions of a wavelength; they proved too weak to cancel the 1990 spherical aberration.',
  }, [mesh(merge(sup), HM.ti()), mesh(merge(act), HM.box())]);

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
    system: 'Structure', material: 'Beryllium: 15 radial I-beams, 48 intercostal ribs, central ring', mass: 90, temp: 293, explode: [-2.0, 0, 0],
    desc: 'A wheel of beryllium I-beams spanning the main ring behind the primary. It carries the heater array that keeps the back of the mirror at 21 °C, the 24 figure-control actuators, and the central baffle on its centre ring. Rib layout simplified.',
  }, mesh(merge(rp), HM.ti()));

  const heater = annulus(OPT.rHole + 0.05, OPT.rPM - 0.02, xBack - 0.012, 64, -1);
  P('Primary mirror heaters', {
    system: 'Thermal control', material: 'Kapton heater panels with thermostats', mass: 18, temp: 294, explode: [-1.85, 0, 0],
    desc: 'Heaters behind the mirror hold the glass near 21 °C (70 °F) so its figure does not change as the telescope passes between sunlight and Earth shadow every orbit.',
  }, mesh(heater, HM.kapton()));

  // ------------------------------------------------------------------ main ring and OTA–SSM links
  const ringProfile = [[1.24, 3.72], [1.42, 3.72], [1.42, 4.12], [1.24, 4.12], [1.24, 3.72]];
  const ringParts = [axial(ringProfile, 96)];
  for (let k = 0; k < 24; k++) ringParts.push(new THREE.BoxGeometry(0.36, 0.08, 0.025).rotateX(deg(k * 15)).translate(...az(deg(k * 15), 1.46, 3.92)));
  out.mainRing = P('Main ring', {
    system: 'Structure', material: 'Titanium hollow box-section ring, 38 cm deep', mass: 545, massSource: 'NASA SM3A Media Guide (1,200 lb)', temp: 292, explode: [0, 0, 0],
    desc: 'The structural backbone of the telescope, 2.9 m across: the primary mirror, the main baffle, the metering truss and the focal-plane structure all hang from it, and kinematic brackets tie it to the spacecraft.',
  }, mesh(merge(ringParts), HM.ti()));
  const links = [];
  for (let k = 0; k < 3; k++) {
    const p = deg(60 + k * 120);
    links.push(rod(az(p, 1.42, 3.92), az(p, RAD.shell - 0.02, 3.75), 0.045, 10));
    links.push(new THREE.BoxGeometry(0.25, 0.1, 0.25).translate(...az(p, RAD.shell - 0.06, 3.75)));
  }
  P('OTA kinematic links', {
    system: 'Structure', material: 'Titanium links with spherical bearings', mass: 24, count: 3, temp: 290, explode: [0, 0, 0],
    desc: 'Three statically determinate links join the main ring to the equipment section, so flexing of the spacecraft cannot bend the optics out of alignment.',
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
    system: 'Structure', material: 'Graphite fibre-reinforced epoxy struts and rings, titanium end fittings; aluminised-Mylar MLI inside', mass: 114, temp: 292, explode: [0, 0, 0],
    desc: 'A cage of 48 struts and three rings, 4.8 m long and 2.7 m across, that holds the secondary mirror 4.906 m in front of the primary to within 2.5 µm. Graphite-epoxy barely expands with temperature, but it slowly sheds absorbed water, so the secondary has been refocused by a few micrometres over the years.',
    callout: true, anchor: [6.0, 1.42, 0.2],
  }, [mesh(merge(struts), HM.grEp()), mesh(merge(ringsGeo), HM.grEp()), mesh(merge(fittings), HM.fitting())]);

  // ------------------------------------------------------------------ baffles
  const mb = [tube(1.3, 4.12, 8.92, { seg: 72 })];
  for (let k = 0; k < 13; k++) mb.push(annulus(1.235, 1.3, 4.3 + k * 0.36, 72, 1));
  P('Main baffle', {
    system: 'Optics', skin: true, material: 'Aluminium cylinder with internal stray-light fins, flat black', mass: 70, temp: 290, explode: [0.6, 0, 0],
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
  P('Central baffle', {
    system: 'Optics', material: 'Aluminium cone, flat black with vanes', mass: 18, temp: 291, explode: [0.9, 0, 0],
    desc: 'A cone about 3 m long, mounted on the reaction plate and rising through the 60 cm hole in the primary. With the secondary baffle it blocks every straight path from the sky to the focal plane, so only light that has bounced off both mirrors reaches the instruments.',
  }, mesh(merge(cb), HM.black()));

  // ------------------------------------------------------------------ secondary mirror and its assembly
  const sm = [];
  for (let i = 0; i <= 12; i++) { const r = (OPT.rSM * i) / 12; sm.push([Math.max(r, 0.0005), smSurface(r)]); }
  const smFace = mesh(axial(sm.slice().reverse(), 64), HM.mirror());
  const smBody = mesh(tube(OPT.rSM, smSurface(OPT.rSM), OPT.xSM + 0.055, { seg: 48, open: false }), HM.ule());
  out.sm = P('Secondary mirror', {
    system: 'Optics', material: 'Zerodur glass ceramic, Al + MgF₂ coating', mass: 12, temp: 291, explode: [1.3, 0, 0],
    desc: '0.3 m convex hyperboloid (conic −1.497) facing back down the tube. It multiplies the primary\'s 5.52 m focal length by 10.4 into the 57.6 m, f/24 beam and sends it back through the hole in the primary. Its surface is figured even more accurately than the primary\'s.',
    callout: true, anchor: [OPT.xSM, 0.3, 0.15],
  }, [smFace, smBody]);

  const sma = [tube(0.22, OPT.xSM + 0.06, OPT.xSM + 0.36, { seg: 40, open: false })];
  for (let k = 0; k < 6; k++) sma.push(new THREE.BoxGeometry(0.1, 0.05, 0.05).translate(...az(deg(k * 60 + 30), 0.18, OPT.xSM + 0.4)));
  P('Secondary mirror assembly', {
    system: 'Optics', material: 'Central hub with base plate, three pairs of alignment actuators', mass: 48, temp: 290, explode: [1.9, 0, 0],
    desc: 'The hub at the front of the truss holds the secondary on three pairs of actuators that can tilt, decenter and refocus it from the ground, using wavefront data from the optical control sensors in the Fine Guidance Sensors. Focus moves of a few micrometres compensate the slow shrinkage of the truss.',
  }, mesh(merge(sma), HM.grEp()));

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
    system: 'Optics', material: 'Flat-black aluminium shroud', mass: 7, temp: 290, explode: [1.3, 0.5, 0],
    desc: 'A 0.79 m shroud around the secondary. Its shadow sets Hubble\'s central obscuration: 33 % of the aperture diameter, about 11 % of the area.',
  }, mesh(merge(sb), HM.black()));

  // ------------------------------------------------------------------ focal-plane structure
  const fps = [];
  const c = 1.02, xd = 2.62;
  for (const [sy, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    fps.push(beam([0.42, sy * c, sz * c], [3.72, sy * c, sz * c], 0.12, 0.12));
    fps.push(beam([3.72, sy * c, sz * c], az(Math.atan2(sz, sy), 1.3, 3.72), 0.08, 0.08));
  }
  for (const x of [0.42, xd]) {
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
  P('Focal plane structure', {
    system: 'Structure', material: 'Graphite-epoxy optical bench with guide rails and latches', mass: 545, massSource: 'NASA SM3A Media Guide (more than 1,200 lb)', temp: 293, explode: [-2.2, 0, 0],
    desc: 'A 3 m × 2.1 m optical bench cantilevered off the rear of the main ring at eight flexible points. It holds the axial instruments, the radial camera and the three Fine Guidance Sensors at the focal surface so swapped instruments land in focus; its −V3 side carries the star trackers and gyros.',
  }, mesh(merge(fps), HM.grEp()));

  const latches = [];
  for (const [sy, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    latches.push(new THREE.BoxGeometry(0.1, 0.14, 0.14).translate(2.5, sy * 0.86, sz * 0.86));
    latches.push(new THREE.BoxGeometry(0.1, 0.12, 0.12).translate(0.5, sy * 0.9, sz * 0.9));
  }
  P('Instrument registration latches', {
    system: 'Structure', material: 'Titanium A- and B-latches', mass: 22, count: 8, temp: 292, explode: [-2.2, 0, 0],
    desc: 'Each axial instrument is held at three points: a forward A-latch carries the load and fixes focus, an aft B-latch steadies it. Spacewalkers drive the latches with a power tool through access ports.',
  }, mesh(merge(latches), HM.ti()));

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
  const rayMesh = mesh(mergeGeometries(rays.map(ni)), HM.ray(), { cast: false, receive: false });
  // beam envelopes
  // faint envelopes of the two converging cones (the incoming beam is shown by its rays only)
  const cone1 = axial([[OPT.rPM, pmSurface(OPT.rPM)], [OPT.rPM * k, smSurface(OPT.rPM * k)]], 64);
  const cone2 = axial([[OPT.rPM * k, smSurface(OPT.rPM * k)], [0.002, OPT.xFocus]], 48);
  const env = mesh(mergeGeometries([cone1, cone2].map(ni)), HM.beam(), { cast: false, receive: false });
  const focus = mesh(new THREE.SphereGeometry(0.035, 16, 10).translate(OPT.xFocus, 0, 0), HM.focus(), { cast: false, receive: false });
  const fieldDisc = mesh(new THREE.RingGeometry(0.0, OPT.rField, 48).rotateY(Math.PI / 2).translate(OPT.xFocus, 0, 0), HM.beam(), { cast: false, receive: false });
  for (const m of [rayMesh, env, focus, fieldDisc]) {
    m.userData.fx = true;
    m.userData.keepInModes = true;
    m.userData.noAO = true;
    m.renderOrder = 5;
    m.raycast = () => {};
    g.add(m);
  }
  g.visible = false;
  return g;
}
