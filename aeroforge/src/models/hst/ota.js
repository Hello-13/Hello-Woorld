// Optical Telescope Assembly (Perkin-Elmer, now Goodrich/Collins): the 2.4 m Ritchey–Chrétien
// telescope. The mirror shapes are the design conics solved in physics/optics.js (K1 = −1.0023,
// K2 = −1.4969), the spacings are NASA's (4.906 m between vertices, focus 1.5 m behind the primary).
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
  // body: front plate thickness, outer and inner edge bands, back plate (closed lathe profile)
  const body = [];
  for (const [r, x] of front) body.push([r, x - 0.004]);
  body.push([OPT.rPM, xBack], [OPT.rHole, xBack], [OPT.rHole, pmSurface(OPT.rHole) - 0.004]);
  const glass = mesh(axial(body.reverse(), 96), HM.ule());
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
  const coreMesh = mesh(merge(core), HM.ule());
  coreMesh.userData.temp = 294;
  out.pm = P('Primary mirror', {
    system: 'Optics', material: 'Corning ULE (titanium silicate) glass: front and back faceplates fused to an egg-crate core; 65 nm aluminium + 25 nm MgF₂ coating',
    mass: 828, massSource: 'NASA (1,825 lb)', temp: 294, explode: [-0.4, 0, 0],
    desc: '2.4 m concave hyperboloid, f/2.3, radius of curvature 11.04 m. The lightweight core cuts the mass to 828 kg — a solid blank would weigh about 3.6 t. It was polished 2.2 µm too flat at the edge (spherical aberration), corrected optically in 1993.',
    callout: true, anchor: [xPM + 0.05, 0.9, 0.7],
  }, [face, glass, coreMesh]);

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
  // reaction structure behind the mirror: six radial beams from the main ring
  for (let k = 0; k < 6; k++) {
    const p = deg(k * 60);
    sup.push(beam(az(p, 0.45, xBack - 0.18), az(p, 1.3, xBack - 0.18), 0.07, 0.07));
  }
  sup.push(tube(0.45, xBack - 0.22, xBack - 0.14, { seg: 32, open: false }));
  P('Primary mirror mounts & actuators', {
    system: 'Optics', material: 'Titanium flexure mounts, 24 push-pull figure actuators', mass: 95, temp: 294, explode: [-1.1, 0, 0], count: 24,
    desc: 'Three kinematic flexures hang the mirror from the main ring without forcing its shape; 24 actuators on the back can push the surface by fractions of a wavelength. They proved too weak to cancel the spherical aberration.',
  }, [mesh(merge(sup), HM.ti()), mesh(merge(act), HM.box())]);

  const heater = annulus(OPT.rHole + 0.05, OPT.rPM - 0.02, xBack - 0.012, 64, -1);
  P('Primary mirror heaters', {
    system: 'Thermal control', material: 'Kapton heater panels with thermostats', mass: 18, temp: 294, explode: [-1.6, 0, 0],
    desc: 'Heaters behind the mirror hold the glass near 21 °C (70 °F) so its figure does not change as the telescope passes between sunlight and Earth shadow every orbit.',
  }, mesh(heater, HM.kapton()));

  // ------------------------------------------------------------------ main ring and OTA–SSM links
  const ringProfile = [[1.24, 3.72], [1.42, 3.72], [1.42, 4.12], [1.24, 4.12], [1.24, 3.72]];
  const ringParts = [axial(ringProfile, 96)];
  for (let k = 0; k < 24; k++) ringParts.push(new THREE.BoxGeometry(0.36, 0.08, 0.025).rotateX(deg(k * 15)).translate(...az(deg(k * 15), 1.46, 3.92)));
  out.mainRing = P('Main ring', {
    system: 'Structure', material: 'Titanium box-section ring', mass: 520, temp: 292, explode: [0, 0, 0],
    desc: 'The structural heart of the telescope: the primary mirror, the metering truss and the focal-plane structure all hang from it, and three kinematic links tie it to the spacecraft. 2.9 m across.',
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
  const rings = [4.12, 5.41, 6.7, 7.99, 9.28];
  const nodes = 12;
  const nodeAt = (i, j) => az(deg((j + (i % 2) * 0.5) * (360 / nodes)), RAD.truss, rings[i]);
  const struts = [], fittings = [];
  for (let i = 0; i < rings.length; i++) {
    for (let j = 0; j < nodes; j++) {
      struts.push(rod(nodeAt(i, j), nodeAt(i, (j + 1) % nodes), 0.026, 8));
      fittings.push(new THREE.IcosahedronGeometry(0.055, 0).translate(...nodeAt(i, j)));
      if (i < rings.length - 1) {
        const back = (i % 2) ? j : (j - 1 + nodes) % nodes;
        const fwd = (i % 2) ? (j + 1) % nodes : j;
        struts.push(rod(nodeAt(i, j), nodeAt(i + 1, back), 0.03, 8));
        struts.push(rod(nodeAt(i, j), nodeAt(i + 1, fwd), 0.03, 8));
      }
    }
  }
  out.truss = P('Metering truss', {
    system: 'Structure', material: 'Graphite-epoxy tubes, titanium end fittings', mass: 114, temp: 292, explode: [0, 0, 0],
    desc: 'A 5.3 m cylindrical truss, 2.9 m across, that holds the secondary mirror 4.906 m in front of the primary. Graphite-epoxy barely expands with temperature, but it slowly sheds absorbed water, so the secondary has been refocused by a few micrometres over the years. Strut layout simplified.',
    callout: true, anchor: [6.7, 1.5, 0.2],
  }, [mesh(merge(struts), HM.grEp()), mesh(merge(fittings), HM.ti())]);

  // ------------------------------------------------------------------ baffles
  const mb = [tube(1.31, 4.3, 7.75, { seg: 72 })];
  for (let k = 0; k < 10; k++) mb.push(annulus(1.235, 1.31, 4.45 + k * 0.36, 72, 1));
  P('Main baffle', {
    system: 'Optics', material: 'Aluminium cylinder with internal stray-light vanes, flat black', mass: 55, temp: 290, explode: [0.6, 0, 0],
    desc: 'Lines the inside of the metering truss in front of the primary. Its sharp-edged vanes trap light that enters the tube at an angle so it cannot scatter onto the mirror and fog the images.',
  }, mesh(merge(mb), HM.black()));
  const cb = [tube(0.3, 3.86, 6.35, { seg: 40, rTop: 0.24 })];
  for (let k = 0; k < 6; k++) {
    const x = 4.3 + k * 0.38;
    const r = 0.3 + ((0.24 - 0.3) * (x - 3.86)) / (6.35 - 3.86);
    cb.push(annulus(0.215, r, x, 40, 1));
  }
  P('Central baffle', {
    system: 'Optics', material: 'Aluminium cone, flat black with vanes', mass: 14, temp: 291, explode: [0.9, 0, 0],
    desc: 'A cone rising 2.2 m from the hole in the primary. Together with the secondary baffle it blocks every straight path from the sky to the focal plane, so only light that has bounced off both mirrors reaches the instruments.',
  }, mesh(merge(cb), HM.black()));

  // ------------------------------------------------------------------ secondary mirror and its assembly
  const sm = [];
  for (let i = 0; i <= 12; i++) { const r = (OPT.rSM * i) / 12; sm.push([Math.max(r, 0.0005), smSurface(r)]); }
  const smFace = mesh(axial(sm.slice().reverse(), 64), HM.mirror());
  const smBody = mesh(tube(OPT.rSM, smSurface(OPT.rSM), OPT.xSM + 0.055, { seg: 48, open: false }), HM.ule());
  out.sm = P('Secondary mirror', {
    system: 'Optics', material: 'Low-expansion glass (ULE), Al + MgF₂ coating', mass: 12, temp: 291, explode: [1.3, 0, 0],
    desc: '0.3 m convex hyperboloid (conic −1.497) facing back down the tube. It multiplies the primary\'s 5.52 m focal length by 10.4 into the 57.6 m, f/24 beam and sends it through the hole in the primary.',
    callout: true, anchor: [OPT.xSM, 0.3, 0.15],
  }, [smFace, smBody]);

  const sma = [tube(0.22, OPT.xSM + 0.06, OPT.xSM + 0.36, { seg: 40, open: false })];
  for (let k = 0; k < 6; k++) sma.push(new THREE.BoxGeometry(0.1, 0.05, 0.05).translate(...az(deg(k * 60 + 30), 0.18, OPT.xSM + 0.4)));
  P('Secondary mirror assembly', {
    system: 'Optics', material: 'Graphite-epoxy housing, stepper-motor actuators', mass: 48, temp: 290, explode: [1.9, 0, 0],
    desc: 'Holds the secondary on actuators that can tilt, decenter and refocus it from the ground. Focus moves of a few micrometres compensate the slow shrinkage of the metering truss.',
  }, mesh(merge(sma), HM.grEp()));

  const vanes = [];
  for (let k = 0; k < 4; k++) {
    const p = deg(k * 90);
    const g = new THREE.BoxGeometry(0.3, RAD.truss - 0.4, 0.022);
    g.translate(0, (RAD.truss + 0.4) / 2, 0).rotateX(p).translate(OPT.xSM + 0.2, 0, 0);
    vanes.push(g);
  }
  P('Secondary mirror spider', {
    system: 'Optics', material: 'Thin graphite-epoxy vanes', mass: 9, count: 4, temp: 290, explode: [1.6, 0, 0],
    desc: 'Four thin vanes hold the secondary assembly in the beam. Light diffracting around them makes the four-pointed spikes on every bright star in a Hubble picture.',
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
    system: 'Structure', material: 'Graphite-epoxy box frame with registration fittings', mass: 290, temp: 293, explode: [-0.6, 0, 0],
    desc: 'Hangs behind the main ring and holds the four axial instruments, the radial instrument and the three Fine Guidance Sensors at the focal surface to within a few hundredths of a millimetre, so swapped instruments land in focus.',
  }, mesh(merge(fps), HM.grEp()));

  const latches = [];
  for (const [sy, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    latches.push(new THREE.BoxGeometry(0.1, 0.14, 0.14).translate(2.5, sy * 0.86, sz * 0.86));
    latches.push(new THREE.BoxGeometry(0.1, 0.12, 0.12).translate(0.5, sy * 0.9, sz * 0.9));
  }
  P('Instrument registration latches', {
    system: 'Structure', material: 'Titanium A- and B-latches', mass: 22, count: 8, temp: 292, explode: [-0.9, 0, 0],
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
    const p0 = az(phi, r, 14.4);
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
  const envIn = tube(OPT.rPM, pmSurface(OPT.rPM), 14.4, { seg: 64 });
  const envIn2 = tube(OPT.rObsc, pmSurface(OPT.rObsc), 9.0, { seg: 48 });
  const cone1 = axial([[OPT.rPM, pmSurface(OPT.rPM)], [OPT.rPM * k, smSurface(OPT.rPM * k)]], 64);
  const cone2 = axial([[OPT.rPM * k, smSurface(OPT.rPM * k)], [0.002, OPT.xFocus]], 48);
  const env = mesh(mergeGeometries([envIn, envIn2, cone1, cone2].map(ni)), HM.beam(), { cast: false, receive: false });
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
