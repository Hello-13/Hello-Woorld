// Focal-plane instruments (post-SM4, 2009) and the sensors that share the aft shroud.
//
// Quadrants from the SM3A Media Reference Guide's field-of-view map (Fig. 5-18, looking forward):
// axial bays behind the primary — STIS at +V3/+V2 (the former GHRS bay), COS at +V3/−V2 (where
// COSTAR, and before it the High Speed Photometer, sat), ACS at −V3/−V2 (former FOC bay) and
// NICMOS at −V3/+V2 (former FOS bay). Radial bays at the focal plane: WFC3 on the −V3 side,
// FGS 2 at +V3, FGS 1 at −V2 and FGS 3 at +V2. The gyros and star trackers sit on the −V3 side of
// the focal plane structure (SM3A/SM4 guides), reached through the −V3 aft shroud doors.
// Model azimuth: +y = +V3, +z = −V2.
//
// Instrument sub-units follow the SM4 Media Guide's figures (4-2 WFC3, 4-5 COS, 4-7 ACS, 4-9 NCS,
// 4-10 NICMOS, 4-11 STIS, 4-12 FGS); their placement inside each enclosure is schematic.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { rod, beam, mergeGeometries } from '../../engine/geometry.js';
import { decal, stencilText } from '../../engine/decals.js';
import { RAD, OPT, az, deg, shellPatch, ix, cablePath } from './layout.js';
import { HM } from './materials.js';

const merge = (list) => mergeGeometries(list.map(ix));
const X_SI0 = 0.35, X_SI1 = 2.55;               // axial instrument envelope, 0.9 × 0.9 × 2.2 m

/** Wedge (trapezoid section) at azimuth φ: inner width w0 at r0, outer width w1 at r1, x0..x1. */
function wedge(phi, r0, r1, w0, w1, x0, x1) {
  const s = new THREE.Shape([new THREE.Vector2(-w0 / 2, r0), new THREE.Vector2(w0 / 2, r0), new THREE.Vector2(w1 / 2, r1), new THREE.Vector2(-w1 / 2, r1)]);
  const g = new THREE.ExtrudeGeometry(s, { depth: x1 - x0, bevelEnabled: false });
  // shape X → tangential (0, sin φ, −cos φ), shape Y → radial (0, cos φ, sin φ), extrude Z → +x
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, Math.sin(phi), -Math.cos(phi)), new THREE.Vector3(0, Math.cos(phi), Math.sin(phi)), new THREE.Vector3(1, 0, 0));
  g.applyMatrix4(m);
  g.translate(x0, 0, 0);
  return g;
}

/** Box in an azimuthal frame: a (axial), r (radial), t (tangential) sizes at x, radius, tangential offset. */
function rbox(phi, sa, sr, st, x, r, t = 0) {
  return new THREE.BoxGeometry(sa, sr, st).translate(x, r, t).rotateX(phi);
}
/** Cylinder in an azimuthal frame with its axis along 'x' (axial), 'r' (radial) or 't' (tangential). */
function rcyl(phi, rad, len, axis, x, r, t = 0, seg = 16) {
  const g = new THREE.CylinderGeometry(rad, rad, len, seg);
  if (axis === 'x') g.rotateZ(Math.PI / 2); else if (axis === 't') g.rotateX(Math.PI / 2);
  return g.translate(x, r, t).rotateX(phi);
}
/** A point in an azimuthal frame. */
const rpt = (phi, x, r, t = 0) => new THREE.Vector3(x, r, t).applyAxisAngle(new THREE.Vector3(1, 0, 0), phi).toArray();

/** Geometry helpers for an axial quadrant: offsets are distances from the axis (0.05 … 0.95). */
function quad(qy, qz) {
  const p = (x, oy, oz) => [x, qy * oy, qz * oz];
  return {
    p,
    box: (sa, sy, sz, x, oy, oz) => new THREE.BoxGeometry(sa, sy, sz).translate(x, qy * oy, qz * oz),
    cylX: (r, len, x, oy, oz, seg = 24) => new THREE.CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2).translate(x, qy * oy, qz * oz),
    cylY: (r, len, x, oy, oz, seg = 24) => new THREE.CylinderGeometry(r, r, len, seg).translate(x, qy * oy, qz * oz),
    cylZ: (r, len, x, oy, oz, seg = 24) => new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2).translate(x, qy * oy, qz * oz),
    cable: (pts, r = 0.01) => cablePath(pts.map((q) => p(...q)), r, 6),
    strap: (a, b, w = 0.04) => beam(p(...a), p(...b), w, 0.006),
  };
}

const MAT = { box: () => HM.box(), al: () => HM.al(), copper: () => HM.copper(), mirror: () => HM.mirror(), kapton: () => HM.kapton(), cable: () => HM.harness(), grEp: () => HM.grEp(), white: () => HM.radiator() };

export function buildInstruments(P, root) {
  const out = { labels: [] };
  /** A sub-unit of an instrument: one part per entry, meshes per material. */
  const sub = (parent, s, explode, geoms, extra = {}) => {
    const groups = Array.isArray(geoms) && geoms.length && !(geoms[0] instanceof THREE.BufferGeometry) ? geoms : [[s.mat || null, geoms]];
    const meshes = groups.map(([m, list]) => mesh(merge(list), m ? MAT[m]() : (s.temp < 150 ? HM.kapton() : HM.iridite())));
    // sub-units stack inside their enclosures, so X-ray draws them at 60 % unless told otherwise
    return P(s.name, { system: s.system || 'Payload', material: s.material, temp: s.temp, count: s.count, mass: s.mass, explode, xrayWeight: s.xw ?? 0.6, desc: `${s.desc} ${s.tail || ''}`.trim(), ...extra }, meshes, parent);
  };

  // ------------------------------------------------------------------ axial instruments
  const AXIAL = [
    {
      name: 'Space Telescope Imaging Spectrograph', short: 'STIS', q: [1, -1], mass: 374, massSource: 'NASA SM4 Media Guide (825 lb)', temp: 293,
      material: 'Carbon-fibre optical bench, 2.2 × 0.98 × 0.98 m; one CCD and two MAMA photon-counting detectors',
      desc: 'Axial bay at +V3/+V2 (since 1997, replacing GHRS). Spreads light from 115 nm to 1 µm into spectra, including long slits across galaxies and planets. Its power supply failed in 2004 and was repaired in orbit in 2009 — an instrument never designed to be opened.',
      subs: (Q) => [
        { name: 'STIS CCD', material: '1024 × 1024 CCD, thermoelectrically cooled', temp: 190,
          desc: 'The visible-light detector, 200 nm–1 µm, with a 51″ field: it takes long-slit spectra and also works as a camera for acquiring targets.',
          geo: [Q.box(0.42, 0.26, 0.26, 2.0, 0.58, 0.36)] },
        { name: 'STIS MAMA detectors', material: 'Two Multi-Anode Microchannel Arrays, 1024 × 1024 photon-counting', temp: 290, count: 2,
          desc: 'Photon counters for the far (115–170 nm) and near (165–310 nm) ultraviolet, with a 24.9″ field. They are so sensitive that a too-bright target can damage them, so every STIS target is screened first.',
          geo: [Q.box(0.3, 0.2, 0.2, 1.45, 0.3, 0.66), Q.box(0.3, 0.2, 0.2, 1.45, 0.66, 0.3)] },
        { name: 'STIS mode select mechanism', material: 'Grating wheel assembly: rotating carousel of gratings, echelles and mirrors', temp: 293,
          desc: 'A motor-driven wheel of gratings and mirrors that chooses the spectral mode: low or high resolution, first-order or echelle, ultraviolet or visible.',
          geo: [Q.cylZ(0.16, 0.08, 1.0, 0.5, 0.5, 28)] },
        { name: 'STIS slit wheel', material: 'Wheel of slits, apertures and coronagraphic bars at the focal surface', temp: 293,
          desc: 'Sits at Hubble\'s focus just inside the entrance aperture and sets the slit: long slits for spectra across a galaxy, tiny apertures for a single star, or a bar to block a bright one.',
          geo: [Q.cylX(0.11, 0.03, 2.42, 0.22, 0.22, 28), Q.cylX(0.03, 0.06, 2.38, 0.22, 0.22, 12)] },
        { name: 'STIS mode isolation shutter', material: 'Fast shutter behind the slit wheel', temp: 293,
          desc: 'Closes the beam to the detector not in use, so light meant for the CCD cannot reach the far more sensitive MAMAs.',
          geo: [Q.box(0.06, 0.12, 0.12, 2.3, 0.32, 0.3)] },
        { name: 'STIS calibration subsystem', material: 'Platinum-neon and deuterium lamps with an input mechanism', temp: 295,
          desc: 'Lamps of known spectra that the calibration input mechanism switches into the beam, so every spectrum can be put on an exact wavelength scale.',
          geo: [Q.box(0.3, 0.16, 0.2, 0.65, 0.42, 0.62), Q.cylX(0.025, 0.08, 0.84, 0.38, 0.58, 10), Q.cylX(0.025, 0.08, 0.84, 0.46, 0.66, 10)] },
        { name: 'STIS main electronics box', material: 'MEB-1: power supplies and control electronics', temp: 296,
          desc: 'The box whose low-voltage power supply failed in 2004, on the face toward the +V2 doors so a spacewalker could reach it in 2009.',
          mat: 'box', geo: [Q.box(0.5, 0.34, 0.14, 0.75, 0.72, 0.85)] },
        { name: 'STIS low-voltage power supply (2009 repair)', material: 'Replacement LVPS-2 circuit card inside the main electronics box', temp: 296,
          desc: 'The card whose power converter failed in August 2004. In 2009 a spacewalker removed 111 small screws, held captive by a fastener capture plate, pulled the card and slid in a new one.',
          mat: 'copper', geo: [Q.box(0.36, 0.25, 0.02, 0.75, 0.72, 0.928)] },
        { name: 'STIS MEB cover (2009)', material: 'Replacement cover plate with two EVA-friendly latches and a handle', temp: 280,
          desc: 'The old cover was held by 111 small screws; its 2009 replacement closes the box with two latches a gloved hand can work.',
          geo: [['al', [Q.box(0.52, 0.36, 0.014, 0.75, 0.72, 0.957)]], ['box', [Q.box(0.06, 0.05, 0.03, 0.53, 0.62, 0.975), Q.box(0.06, 0.05, 0.03, 0.97, 0.62, 0.975)]], ['kapton', Q.cable([[0.62, 0.84, 0.965], [0.62, 0.84, 1.02], [0.88, 0.84, 1.02], [0.88, 0.84, 0.965]], 0.01)]] },
        { name: 'STIS MAMA heat pipes & radiator plate', system: 'Thermal control', material: 'Internal heat pipes to a copper radiator plate on the aft bulkhead', temp: 285,
          desc: 'STIS\'s own cooling path: heat pipes carry the MAMA detectors\' heat to a copper radiator plate on the instrument\'s aft bulkhead, which radiates into the aft shroud. A 2000 design to plug it into a shroud cooling system never flew.',
          geo: [['copper', [Q.box(0.012, 0.14, 0.3, 0.343, 0.15, 0.3), ...Q.cable([[1.3, 0.3, 0.6], [0.9, 0.2, 0.45], [0.36, 0.15, 0.4]], 0.008), ...Q.cable([[1.3, 0.6, 0.3], [0.9, 0.4, 0.2], [0.36, 0.15, 0.2]], 0.008)]]] },
      ],
    },
    {
      name: 'Near Infrared Camera and Multi-Object Spectrometer', short: 'NICMOS', q: [-1, -1], mass: 391, massSource: 'NASA SM4 Media Guide (861 lb)', temp: 290,
      material: 'Three cameras with 256 × 256 HgCdTe arrays in a dewar, 2.2 × 0.88 × 0.88 m',
      desc: 'Axial bay at −V3/+V2 (since 1997, replacing FOS). Infrared cameras covering 0.8–2.5 µm. Its solid-nitrogen coolant ran out in 1999; a cryocooler revived it in 2002. Dormant since 2008, its infrared work is now done by WFC3.',
      subs: (Q) => [
        { name: 'NICMOS dewar', material: 'Aluminium cryostat, now cooled by the external cryocooler', temp: 77, xw: 0.6,
          desc: 'Built to hold a block of solid nitrogen around the detectors for 4.5 years; a thermal short made it run out after less than two. From 2002 the NICMOS Cooling System pumped cold neon through its cryo interface instead, holding the arrays near 77 K.',
          geo: [Q.cylX(0.29, 0.9, 1.55, 0.5, 0.5, 32)] },
        { name: 'NICMOS cameras NIC1–3', material: 'Three 256 × 256 HgCdTe arrays, each with its own filter wheel', temp: 77, count: 3,
          desc: 'Three cameras look at neighbouring parts of the field at once, with 51″, 19″ and 11″ fields: the same 0.8–2.5 µm band at three magnifications.',
          geo: [Q.cylX(0.05, 0.22, 1.86, 0.63, 0.5, 14), Q.cylX(0.05, 0.22, 1.86, 0.435, 0.61, 14), Q.cylX(0.05, 0.22, 1.86, 0.435, 0.39, 14)] },
        { name: 'NICMOS main electronics compartment', material: 'Control, detector and filter-wheel electronics', temp: 294,
          desc: 'Fills the aft end of the enclosure, nearest the connector panel; the room-temperature fore-optics relay the image forward into the dewar.',
          mat: 'box', geo: [Q.box(0.36, 0.78, 0.78, 0.6, 0.5, 0.5)] },
      ],
    },
    {
      name: 'Advanced Camera for Surveys', short: 'ACS', q: [-1, 1], mass: 397, massSource: 'NASA SM4 Media Guide (875 lb)', temp: 292,
      material: 'Wide Field Channel and Solar Blind Channel; High Resolution Channel inoperative',
      desc: 'Axial bay at −V3/−V2 (since 2002, replacing FOC). Hubble\'s survey camera, behind the Ultra Deep Field and many of its best-known pictures. Its CCD electronics failed in 2007 and were rebuilt by spacewalkers in 2009.',
      subs: (Q) => [
        { name: 'ACS Wide Field Channel', material: 'Two 2048 × 4096 CCDs, 0.05″ pixels', temp: 192,
          desc: 'The workhorse: a 202″ × 202″ field from 350 nm to 1.1 µm. Its CCDs run at −81 °C.',
          geo: [Q.box(0.7, 0.3, 0.32, 1.75, 0.5, 0.42)] },
        { name: 'ACS Solar Blind Channel', material: 'MAMA detector, 115–170 nm, with its own filter wheel', temp: 290,
          desc: 'A far-ultraviolet camera blind to visible light, so faint ultraviolet sources are not swamped by the much brighter visible light of the same field.',
          geo: [Q.box(0.4, 0.22, 0.22, 0.85, 0.38, 0.64)] },
        { name: 'ACS High Resolution Channel (inoperative)', material: '1024 × 1024 CCD, 0.025″ pixels, with a coronagraph', temp: 290,
          desc: 'The channel that covered 170–350 nm and took the sharpest ACS images. It failed with the CCD electronics in January 2007 and could not be restored in 2009, which is why ACS now has no channel between the far ultraviolet and 350 nm.',
          geo: [Q.box(0.4, 0.22, 0.22, 1.0, 0.72, 0.3)] },
        { name: 'ACS filter wheels', material: 'Two shared WFC/HRC filter wheels', temp: 292, count: 2,
          desc: 'WFC and HRC share these two wheels, so the channels could never pick their filters independently in parallel observations.',
          geo: [['al', [Q.cylX(0.175, 0.035, 1.25, 0.5, 0.5, 32), Q.cylX(0.175, 0.035, 1.31, 0.5, 0.5, 32)]], ['box', [Q.cylX(0.04, 0.12, 1.28, 0.5, 0.5, 12)]]] },
        { name: 'ACS shutters', material: 'WFC and HRC shutter mechanisms', temp: 292, count: 2,
          desc: 'Blade shutters time each exposure; the WFC one was copied for WFC3. A calibration platform beside the HRC and SBC carries their lamps.',
          mat: 'box', geo: [Q.box(0.05, 0.16, 0.16, 2.18, 0.5, 0.42), Q.box(0.05, 0.12, 0.12, 1.24, 0.72, 0.3)] },
        { name: 'ACS CCD electronics box (CEB-R, 2009)', material: 'WFC CCD electronics box with the four-card CEB-R cartridge', temp: 296,
          desc: 'The 2009 repair: a spacewalker cut away an EMI grid, removed 32 fasteners into a capture plate, pulled four failed cards and slid in a four-card cartridge — on the face toward the −V2 doors.',
          geo: [['box', [Q.box(0.32, 0.3, 0.13, 0.6, 0.62, 0.86)]], ['copper', [Q.box(0.26, 0.22, 0.02, 0.6, 0.62, 0.935)]]] },
        { name: 'ACS LVPS-R (2009)', material: 'Replacement low-voltage power supply on the outside of the enclosure', temp: 298,
          desc: 'A new power supply bolted to the outside of ACS on its −V2 face. It runs the new cartridge and bypasses both failed electronics boxes, which brought the Wide Field Channel back.',
          geo: [['box', [Q.box(0.35, 0.28, 0.09, 0.97, 0.18, 1.0)]], ['al', [Q.box(0.38, 0.33, 0.012, 0.97, 0.18, 0.956)]]] },
        { name: 'ACS PIE harness (2009)', system: 'Electrical', material: 'Power input harness with a tee at the input power connector', temp: 290,
          desc: 'Carries power from the LVPS-R round the aft edge of the enclosure to a tee at the ACS input power connector, so the new supply draws from the instrument\'s own feed.',
          mat: 'cable', geo: [...Q.cable([[0.79, 0.15, 1.0], [0.42, 0.15, 1.0], [0.32, 0.15, 0.9], [0.31, 0.6, 0.52]], 0.012), Q.box(0.04, 0.06, 0.08, 0.31, 0.6, 0.52)] },
      ],
    },
    {
      name: 'Cosmic Origins Spectrograph', short: 'COS', q: [1, 1], mass: 386, massSource: 'NASA SM4 Media Guide (850 lb)', temp: 292,
      material: 'Single-reflection grating design; far-UV and near-UV channels, 0.9 × 0.9 × 2.2 m',
      desc: 'Axial bay at +V3/−V2, installed in 2009 in the bay COSTAR vacated (it had held the High Speed Photometer until 1993). The most sensitive ultraviolet spectrograph Hubble has carried (115–320 nm), built to read the faint absorption of the gas between galaxies.',
      subs: (Q) => [
        { name: 'COS aperture mechanism', material: 'Primary science and bright-object apertures', temp: 292,
          desc: 'Puts a 2.5″ science aperture, or a bright-object aperture, at Hubble\'s focus in front of the gratings.',
          mat: 'box', geo: [Q.box(0.1, 0.14, 0.14, 2.45, 0.18, 0.18)] },
        { name: 'COS optics select mechanism 1 (FUV)', material: 'Rotating mount of far-UV gratings', temp: 292,
          desc: 'Turns to put one of the far-UV gratings in the beam. In this channel light makes just one bounce, off a grating that both disperses and focuses, because every extra reflection would cost a large share of the far ultraviolet.',
          geo: [Q.cylZ(0.2, 0.08, 2.05, 0.5, 0.5, 28)] },
        { name: 'COS optics select mechanism 2 (NUV)', material: 'Rotating mount of near-UV gratings and a mirror', temp: 292,
          desc: 'Selects the near-UV grating or mirror, which sends the light through three camera mirrors to the NUV detector.',
          geo: [Q.cylZ(0.13, 0.07, 1.75, 0.72, 0.28, 24)] },
        { name: 'COS calibration lamp platform', material: 'Platinum-neon wavelength lamps and a deuterium flat-field lamp', temp: 293,
          desc: 'Lamps flashed through the instrument during observations to pin every spectrum to an exact wavelength scale.',
          geo: [Q.box(0.26, 0.12, 0.24, 2.25, 0.82, 0.78), Q.cylX(0.025, 0.07, 2.42, 0.82, 0.72, 10), Q.cylX(0.025, 0.07, 2.42, 0.82, 0.84, 10)] },
        { name: 'COS far-UV detector', material: 'Cross-delay-line microchannel-plate detector', temp: 292,
          desc: 'Counts individual ultraviolet photons from 115 to 177 nm and times each one, on two side-by-side segments.',
          geo: [Q.box(0.45, 0.28, 0.3, 0.9, 0.5, 0.5)] },
        { name: 'COS FUV detector electronics box', material: 'DEB: high-voltage and time-to-digital electronics', temp: 296,
          desc: 'Powers the far-UV detector\'s microchannel plates and turns each photon\'s delay-line pulses into a position and arrival time.',
          mat: 'box', geo: [Q.box(0.32, 0.3, 0.14, 0.55, 0.5, 0.83)] },
        { name: 'COS near-UV detector', material: 'MAMA photon-counting detector (a spare built for STIS)', temp: 292,
          desc: 'Covers the near ultraviolet, 175–320 nm, through its own channel with three camera mirrors.',
          geo: [Q.box(0.3, 0.2, 0.2, 1.45, 0.75, 0.25)] },
        { name: 'COS main electronics box', material: 'MEB: instrument computer, mechanism and thermal control', temp: 296,
          desc: 'Runs the instrument: it takes commands from the SI C&DH through the remote interface unit and drives the mechanisms and heaters.',
          mat: 'box', geo: [Q.box(0.4, 0.14, 0.38, 0.62, 0.84, 0.42)] },
      ],
    },
  ];
  out.axial = [];
  for (const si of AXIAL) {
    const [qy, qz] = si.q;
    const Q = quad(qy, qz);
    const cy = qy * 0.5, cz = qz * 0.5;
    const L = X_SI1 - X_SI0, xm = (X_SI0 + X_SI1) / 2;
    const shell = new THREE.BoxGeometry(L, 0.9, 0.9).translate(xm, cy, cz);
    const shellMesh = mesh(shell, HM.siGrey());
    shellMesh.userData.xrayWeight = 0.45;
    const det = [];
    // guide rails along the two outer faces, connector plate and handholds aft, stiffening frames
    det.push(new THREE.BoxGeometry(L - 0.1, 0.04, 0.06).translate(xm, cy + qy * 0.47, cz), new THREE.BoxGeometry(L - 0.1, 0.06, 0.04).translate(xm, cy, cz + qz * 0.47));
    det.push(new THREE.BoxGeometry(0.03, 0.18, 0.4).translate(X_SI0 - 0.015, cy + qy * 0.15, cz - qz * 0.12));
    const frames = [];
    for (const x of [0.75, 1.45, 2.15]) frames.push(new THREE.BoxGeometry(0.05, 0.92, 0.92).translate(x, cy, cz));
    const detMesh = mesh(merge(det), HM.box());
    const frameMesh = mesh(merge(frames), HM.box());
    frameMesh.userData.xrayWeight = 0.3;
    const ap = new THREE.BoxGeometry(0.03, 0.09, 0.09).translate(X_SI1 + 0.015, qy * 0.12, qz * 0.12);
    const handles = [];
    for (const s of [-1, 1]) {
      const a = [X_SI0 - 0.01, cy + s * 0.25, cz + qz * 0.22], b = [X_SI0 - 0.16, cy + s * 0.25, cz + qz * 0.22];
      const c2 = [X_SI0 - 0.16, cy + s * 0.25, cz - qz * 0.22], d = [X_SI0 - 0.01, cy + s * 0.25, cz - qz * 0.22];
      handles.push(rod(a, b, 0.016, 6), rod(b, c2, 0.016, 6), rod(c2, d, 0.016, 6));
    }
    const p = P(si.name, {
      system: 'Payload', material: si.material, mass: si.mass, massSource: si.massSource, temp: si.temp, explode: [-3.4, qy * 0.25, qz * 0.25], xrayWeight: 0.45,
      desc: si.desc, callout: si.short === 'COS', anchor: [X_SI0 + 0.05, cy + qy * 0.46, cz + qz * 0.46],
    }, [shellMesh, detMesh, frameMesh, mesh(ap, HM.black()), mesh(merge(handles), HM.handrail())]);
    p.userData.part.short = si.short;
    // internal: COS (the tour's example of an instrument swap) is labelled only while a tour step
    // focuses it; the other three are named by the stencils on their aft faces
    p.userData.part.tourLabel = true;
    const tail = `Part of ${si.short}; mass included in the instrument.`;
    for (const s of si.subs(Q)) sub(p, { ...s, tail }, [0, qy * 0.9, qz * 0.9], s.geo);

    // every axial swap ends the same way: latch, ground strap, connectors
    const jumpers = [], plugs = [];
    for (let i = 0; i < 4; i++) {
      const oz = 0.23 + i * 0.1;
      plugs.push(Q.cylX(0.028, 0.07, 0.3, 0.65, oz, 14), Q.cylX(0.034, 0.015, 0.325, 0.65, oz, 14));
      jumpers.push(...Q.cable([[0.265, 0.65, oz], [0.2, 0.65, oz], [0.2, 0.72 + i * 0.075, 0.98], [0.28, 0.72 + i * 0.075, 1.0]], 0.011));
    }
    sub(p, {
      name: `${si.short} connectors & ground strap`, system: 'Electrical', material: 'Four circular connectors, cable jumpers to the FPS connector panel and a ground strap', temp: 290, count: 4,
      desc: 'Every instrument swap ends the same way: close the latches, attach the ground strap, mate the connectors. COS needed four. Connector positions approximate.', tail,
    }, [-0.4, 0, 0], [['box', plugs], ['cable', jumpers], ['copper', [Q.strap([0.34, 0.93, 0.15], [0.42, 1.0, 0.15])]]]);
    sub(p, {
      name: `${si.short} remote interface unit`, system: 'Avionics', material: 'RIU: command, clock and engineering-data interface to the SI C&DH', temp: 296,
      desc: 'One of six RIUs: it carries commands, clock signals and engineering data between the instrument and the SI C&DH, but never science data. A bus coupler isolates any RIU that fails. Size estimated.', tail,
    }, [-0.5, 0, 0], [['box', [Q.box(0.12, 0.16, 0.18, 0.29, 0.86, 0.86), Q.cylX(0.02, 0.04, 0.215, 0.86, 0.82, 10)]], ['cable', Q.cable([[0.215, 0.86, 0.8], [0.22, 0.72, 0.6], [0.29, 0.66, 0.58]], 0.009)]]);
    out.labels.push({ part: p, target: shellMesh, text: si.short, at: [X_SI0 - 0.002, cy - qy * 0.12, cz + qz * 0.18] });
    out.axial.push(p);
  }

  // ------------------------------------------------------------------ radial instruments
  // WFC3 on the −V3 side; its 0.8 × 2.2 m radiator is part of the shroud skin
  const wPhi = deg(180);
  const W0 = 1.22, W1 = 3.42;
  const wfc3Body = mesh(wedge(wPhi, 1.0, 2.04, 0.5, 0.82, W0, W1), HM.siGrey());
  wfc3Body.userData.xrayWeight = 0.45;
  const wfc3Det = [];
  for (const x of [W0 + 0.05, W1 - 0.05]) wfc3Det.push(rbox(wPhi, 0.06, 0.9, 0.6, x, 1.52));                         // end frames
  wfc3Det.push(rbox(wPhi, W1 - W0 - 0.1, 0.05, 0.06, (W0 + W1) / 2, 1.04, 0));                                       // guide rail
  const wfc3 = P('Wide Field Camera 3', {
    system: 'Payload', material: 'UVIS channel (two 2k × 4k CCDs) and IR channel (1k × 1k HgCdTe), thermoelectrically cooled; camera 1 × 1.3 × 0.5 m', mass: 404, massSource: 'NASA SM4 Media Guide (890 lb)', temp: 292,
    explode: [0, -1.9, 0], xrayWeight: 0.45,
    desc: 'The radial-bay camera since 2009, replacing WFPC2 (whose corrective optics had fixed Hubble\'s vision in 1993). One instrument spans 200 nm to 1.7 µm through two channels; its pick-off mirror takes the centre of Hubble\'s field. It reuses the enclosure, radiator and filter assembly of the returned WFPC1. Enclosure drawn to the radiator\'s length; inner shape approximate.',
  }, [wfc3Body, mesh(merge(wfc3Det), HM.box())]);
  const W = (s, explode, geo) => sub(wfc3, { ...s, tail: 'Part of WFC3; mass included in the instrument.' }, explode, geo);
  W({ name: 'WFC3 pick-off mirror arm', material: 'Arm carrying the pick-off mirror into the centre of the field', temp: 292,
    desc: 'Reaches from the camera into the middle of Hubble\'s beam, just ahead of the focus, so its 45° mirror can take the on-axis field and send it out along the arm into the camera.' },
  [0, -0.4, 0], [['box', [rbox(wPhi, 0.24, 0.92, 0.16, OPT.xFocus + 0.15, 0.54)]]]);
  W({ name: 'WFC3 channel select mechanism', material: 'Rotating fold mirror', temp: 292, mat: 'mirror',
    desc: 'A mirror that either stays out of the beam, sending light to the UVIS channel, or swings in to divert it to the infrared channel. The two channels cannot observe at the same time.' },
  [0, -0.5, 0], [new THREE.CylinderGeometry(0.09, 0.09, 0.04, 20).rotateZ(Math.PI / 4).translate(0, -1.22, 0).translate(2.25, 0, 0)]);
  W({ name: 'WFC3 UVIS filter assembly (SOFA)', material: 'Selectable Optical Filter Assembly: stacked filter wheels and a shutter', temp: 292, mat: 'al',
    desc: 'A stack of filter wheels between the corrector mirror and the UVIS CCDs, reworked from WFPC1\'s filter assembly; a shutter copied from ACS follows it.' },
  [0, -0.7, -0.3], [0, 1, 2, 3].map((i) => rcyl(wPhi, 0.11, 0.012, 'r', 2.5, 1.27 + i * 0.03, -0.13, 24)));
  W({ name: 'WFC3 UVIS channel', material: 'Two 2051 × 4096 CCDs, 0.04″ pixels, thermoelectrically cooled to −83 °C', temp: 190,
    desc: 'Ultraviolet-to-visible camera, 200–1000 nm: two butted CCDs make a 16-megapixel, 162″ field. It made the 2014 Ultraviolet Deep Field.' },
  [0, -0.9, -0.6], [rbox(wPhi, 0.36, 0.22, 0.24, 2.5, 1.5, -0.13)]);
  W({ name: 'WFC3 IR cold enclosure', material: 'Enclosure held at −35 °C behind a fold mirror, with corrector, cold mask and filter wheel', temp: 238, mat: 'al', xw: 0.6,
    desc: 'The infrared beam passes a fold mirror into this enclosure, kept at −35 °C to cut the background heat glow, through a refractive corrector for the primary\'s aberration, a cold mask and a filter.' },
  [0, -0.9, 0.3], [rbox(wPhi, 0.42, 0.26, 0.3, 1.95, 1.5, 0.13)]);
  W({ name: 'WFC3 IR channel', material: '1024 × 1024 HgCdTe array, 0.13″ pixels, six-stage thermoelectric cooler to 145 K', temp: 145,
    desc: 'Near-infrared camera, 800–1700 nm, over a 136″ × 123″ field — the channel that took over from NICMOS and re-imaged the Pillars of Creation in infrared. Cutting its response off at 1.7 µm let it be cooled electrically, with no cryogen.' },
  [0, -0.9, 0.6], [rbox(wPhi, 0.16, 0.12, 0.14, 1.95, 1.56, 0.13)]);
  W({ name: 'WFC3 electronics boxes', material: 'MEB1, MEB2, low-voltage power supply, CCD and detector electronics boxes', temp: 297, count: 5, mat: 'box',
    desc: 'Five boxes along the camera\'s outer half (SM4 Fig. 4-2): two main electronics boxes, the low-voltage power supply, the UVIS CCD electronics and the IR detector electronics. Their heat goes out through the radiator above them. Positions approximate.' },
  [0, -1.2, 0], [[1.55, -0.17], [1.55, 0.17], [2.0, -0.17], [3.1, -0.17], [3.1, 0.17]].map(([x, t]) => rbox(wPhi, 0.3, 0.18, 0.28, x, 1.8, t)));
  W({ name: 'WFC3 remote interface unit', system: 'Avionics', material: 'RIU: command and engineering-data interface to the SI C&DH', temp: 296,
    desc: 'WFC3\'s link to the SI C&DH for commands, clock and housekeeping data, at the camera\'s outer end. Size estimated.' },
  [0, -1.4, 0], [['box', [rbox(wPhi, 0.12, 0.12, 0.12, 1.3, 1.88, 0.26)]]]);
  W({ name: 'WFC3 blind-mate connector & ground strap', system: 'Electrical', material: 'Blind-mate connector on the aft face; copper-braid ground strap to the FPS rail', temp: 290,
    desc: 'WFC3\'s single blind-mate connector mated by itself as the camera seated in its bay, so the 2009 crew only had to drive the A latch and attach the ground strap. Positions approximate.' },
  [-0.3, 0, 0], [['box', [rbox(wPhi, 0.06, 0.12, 0.22, W0 - 0.03, 1.3, 0), rbox(wPhi, 0.05, 0.16, 0.26, W0 - 0.085, 1.3, 0)]], ['copper', [beam(rpt(wPhi, W0 - 0.01, 1.06, -0.26), rpt(wPhi, W0 - 0.01, 1.03, -0.47), 0.04, 0.006)]]]);

  const radPanel = shellPatch(RAD.big + 0.02, W0 + 0.02, W1, deg(169), deg(191), { nphi: 8, nx: 3 });
  const radFins = [];
  for (let k = 0; k < 5; k++) radFins.push(rod(az(deg(171.5 + k * 4.25), RAD.big + 0.03, W0 + 0.08), az(deg(171.5 + k * 4.25), RAD.big + 0.03, W1 - 0.06), 0.012, 6));
  const rad = P('WFC3 radiator', {
    system: 'Thermal control', skin: true, material: 'White-painted aluminium radiator with embedded heat pipes, 0.8 × 2.2 m', temp: 235, mass: 45, explode: [0, -2.6, 0],
    desc: 'The camera\'s outer face, 0.8 m wide and 2.2 m long, is a curved radiator that forms part of the aft shroud skin. It carries away the heat pumped out by the detectors\' thermoelectric coolers; WFC3 is behind it.',
    callout: true, anchor: [1.35, -2.09, -0.37],   // aft corner, so the label clears the Systems legend
  }, [mesh(radPanel, HM.radiator()), mesh(merge(radFins), HM.al())]);
  rad.userData.part.thermalRole = 'radiator';

  // three Fine Guidance Sensors at 90° intervals (units after SM4: FGS-1R, FGS-2R2, FGS-3); each a
  // 0.5 × 1 × 1.6 m box (SM4 Fig. 4-12). The guide does not say which way each dimension runs; drawn
  // long along V1, 1 m deep radially and 0.5 m wide, an assumption the desc states
  const FGS = [
    { n: 1, phi: 90, side: '−V2', ama: true, note: 'FGS-1R (1997) is the most stable and serves as Hubble\'s astrometer, measuring star positions to about a milliarcsecond.' },
    { n: 2, phi: 0, side: '+V3', ama: true, note: 'The unit installed in 2009, FGS-2R2, is a refurbished sensor returned from an earlier mission.' },
    { n: 3, phi: 270, side: '+V2', ama: false, note: 'Two of the three guiders lock on stars for every observation; the third can do science.' },
  ];
  const FX0 = 1.82, FX1 = 3.4, FW = 0.5;
  out.fgs = [];
  for (const f of FGS) {
    const phi = deg(f.phi);
    const body = mesh(wedge(phi, 1.0, 2.02, FW, FW, FX0, FX1), new THREE.MeshStandardMaterial({ color: 0xb4b9be, roughness: 0.5, metalness: 0.45 }));
    body.userData.xrayWeight = 0.45;
    const det = [rbox(phi, 0.24, 0.74, 0.16, OPT.xFocus + 0.15, 0.63)];                    // pick-off arm into the field
    for (const x of [FX0 + 0.025, FX1 - 0.025]) det.push(rbox(phi, 0.05, 1.0, FW + 0.04, x, 1.51));
    const hh = [];
    for (const x of [2.2, 3.05]) hh.push(...cablePath([rpt(phi, x - 0.12, 2.02, -0.14), rpt(phi, x - 0.12, 2.07, -0.14), rpt(phi, x + 0.12, 2.07, -0.14), rpt(phi, x + 0.12, 2.02, -0.14)], 0.014, 6));
    const p = P(`Fine Guidance Sensor ${f.n}`, {
      system: 'Attitude control', material: 'Optical bench with star selectors, Koesters-prism interferometers and photomultipliers; 0.5 × 1 × 1.6 m', mass: 220, massSource: 'NASA SM4 Media Guide (485 lb)', temp: 292,
      explode: az(phi, 1.8), xrayWeight: 0.45, desc: `Radial bay on the ${f.side} side. Its pick-off mirror takes a 90° arc at the edge of the field; it finds a guide star there and holds it to a few milliarcseconds, 40 times a second. It also houses one of the optical control (wavefront) sensors. ${f.note} NASA gives the box as 0.5 × 1 × 1.6 m without saying which way each side runs, so its orientation here (long along the telescope axis) is uncertain.`,
      callout: f.n === 1, anchor: az(phi, 2.0, 2.6),
    }, [body, mesh(merge(det), HM.box()), mesh(merge(hh), HM.handrail())]);
    if (f.n === 1) p.userData.part.tourLabel = true;
    const tail = 'Part of the FGS; mass included.';
    // optics train: pick-off → aspheric collimator → two star selectors → corrector group →
    // deviation prism → two Koesters prisms → four pinhole/lens assemblies and photomultipliers
    const bench = [rbox(phi, 1.4, 0.9, 0.025, 2.6, 1.5, -0.2)];
    const optics = [rcyl(phi, 0.09, 0.03, 'r', 2.8, 1.08, 0, 20), rcyl(phi, 0.04, 0.12, 'x', 2.25, 1.45, 0, 12)];
    const servos = [rbox(phi, 0.16, 0.16, 0.16, 2.75, 1.3, 0.04), rbox(phi, 0.16, 0.16, 0.16, 2.45, 1.3, 0.04), rcyl(phi, 0.05, 0.08, 't', 2.75, 1.3, 0.16, 14), rcyl(phi, 0.05, 0.08, 't', 2.45, 1.3, 0.16, 14)];
    const prisms = [rbox(phi, 0.06, 0.06, 0.06, 2.12, 1.53, 0), rbox(phi, 0.08, 0.08, 0.08, 2.03, 1.63, -0.08), rbox(phi, 0.08, 0.08, 0.08, 2.03, 1.63, 0.08)];
    const pmts = [-0.15, -0.05, 0.05, 0.15].map((t) => rcyl(phi, 0.025, 0.16, 'r', 1.97, 1.8, t, 12));
    sub(p, {
      name: `FGS ${f.n} star selectors & interferometers`, system: 'Attitude control', material: 'Optics train on a graphite-epoxy bench: aspheric collimator, two star-selector servos with encoders, corrector group, deviation prism, two Koesters prisms, four pinhole/lens assemblies and photomultipliers', temp: 292, count: 2,
      desc: 'Each star selector is an optical gimbal, one servo moving north–south and one east–west, that steers a 5″ detector field across the 60 arcmin² field in a spiral search for the guide star. The Koesters prisms then split its wavefront; comparing the light in the photomultipliers measures the star\'s position to milliarcseconds. Layout inside the enclosure schematic.', tail,
    }, az(phi, 0.5), [['grEp', bench], ['mirror', optics], ['box', [...servos, ...pmts]], ['al', prisms]]);
    if (f.ama) {
      sub(p, {
        name: `FGS ${f.n} fold-flat actuator (AMA)`, system: 'Attitude control', material: 'Articulating mirror assembly on fold flat #3', temp: 292,
        desc: `FGS-${f.n === 1 ? '1R' : '2R2'} can realign its fold flat #3 in orbit with this actuator, commanded through the optical control electronics, to bring its interferometer back into focus.`, tail,
      }, az(phi, 0.35), [['box', [rbox(phi, 0.1, 0.1, 0.12, 2.6, 1.15, 0.13), rcyl(phi, 0.03, 0.06, 'x', 2.68, 1.15, 0.13, 10)]]]);
    }
    const conn = [];
    for (const x of [1.98, 2.08]) for (const t of [-0.18, -0.06, 0.06, 0.18]) conn.push(rcyl(phi, 0.026, 0.06, 'r', x, 2.04, t, 12));
    sub(p, {
      name: `FGS ${f.n} connectors & ground strap`, system: 'Electrical', material: 'Eight circular connectors and a ground strap at the outboard end', temp: 290, count: 8,
      desc: 'Each guider plugs in through eight connectors at its outboard end, under the bay door, plus a ground strap: the last steps of the 2009 FGS change after the A latch was driven home. Positions approximate.', tail,
    }, az(phi, 0.3), [['box', conn], ['copper', [beam(rpt(phi, 2.45, 1.97, 0.25), rpt(phi, 2.58, 1.97, 0.28), 0.04, 0.006)]]]);
    out.fgs.push(p);
  }

  // ------------------------------------------------------------------ gyros, star trackers, NICMOS cooler
  // on the −V3 (shadow) side of the focal plane structure at the forward end of the aft shroud,
  // behind the −V3 doors: the rate sensor units on one side of WFC3, the star trackers on the other
  const rsuPhi = deg(157);
  const rsu = (n, x) => {
    const box = rbox(rsuPhi, 0.28, 0.22, 0.26, x, 1.72);
    const gyros = [0, 1].map((i) => new THREE.CylinderGeometry(0.06, 0.06, 0.18, 16).translate(x - 0.07 + i * 0.14, 1.86, 0).rotateX(rsuPhi));
    const plate = rbox(rsuPhi, 0.32, 0.03, 0.32, x, 1.595);
    return P(`Rate sensor unit ${n}`, {
      system: 'Attitude control', material: 'Two gas-bearing rate-integrating gyroscopes in an enclosure, on a mounting plate', mass: 24, count: 2, temp: 296,
      explode: az(rsuPhi, 1.2, -0.6), desc: `Each unit carries two gyros, six in all, measuring rotation rate about their sensitive axes; electronics control units in bay 10 process their output. The gyros' flex leads corroded over time; all three units were replaced in 2009. Since 2024 Hubble points with a single gyro to conserve the rest. Position on the −V3 side approximate.`,
      callout: n === 2, anchor: az(rsuPhi, 1.9, x),
    }, [mesh(box, HM.iridite()), mesh(merge([...gyros, plate]), HM.box())]);
  };
  rsu(1, 2.55); rsu(3, 3.25);
  rsu(2, 2.9).userData.part.tourLabel = true;      // the middle unit names the gyros during the tour

  const fh = [], shades = [];
  for (const a of [198.5, 206, 213.5].map(deg)) {
    fh.push(rbox(a, 0.3, 0.3, 0.22, 3.0, 1.82));
    // light shade out through the shroud door, tilted 20° toward the aperture
    const g = new THREE.CylinderGeometry(0.11, 0.08, 0.42, 4, 1, true).rotateY(Math.PI / 4).translate(0, 0.2, 0).rotateZ(deg(-20));
    g.translate(3.0, RAD.big - 0.02, 0).rotateX(a);
    shades.push(g);
  }
  const fhst = P('Fixed-head star trackers', {
    system: 'Attitude control', material: 'Image-dissector star sensors with sunshades', mass: 54, count: 3, temp: 285, explode: az(deg(206), 1.6, 0.4),
    callout: true, anchor: az(deg(206), 1.98, 3.0),
    desc: 'Three trackers behind the focal plane structure, next to the gyros, look out through light-sealed openings in the −V3 doors and map bright stars to fix Hubble\'s attitude to about an arc-minute — coarse enough to put the guide stars inside the Fine Guidance Sensors\' view. Positions approximate.',
  }, [mesh(merge(fh), HM.box()), mesh(merge(shades), HM.black())]);
  fhst.userData.part.tourLabel = true;

  // NICMOS Cooling System (2002): reverse-Brayton cryocooler, its electronics support module, the
  // neon circulator loop to the dewar and the capillary pumped loop to the external radiator
  const ncsPhi = deg(240);
  const cc = [rbox(ncsPhi, 0.62, 0.03, 0.48, 2.95, 1.47)];
  const ccParts = [rcyl(ncsPhi, 0.09, 0.3, 'x', 3.06, 1.6, -0.12, 20), rcyl(ncsPhi, 0.05, 0.12, 'x', 2.78, 1.56, 0.14, 16), rcyl(ncsPhi, 0.065, 0.46, 'x', 2.95, 1.7, 0.12, 18)];
  const ccDet = [rbox(ncsPhi, 0.16, 0.1, 0.16, 3.18, 1.72, -0.12), rbox(ncsPhi, 0.1, 0.08, 0.1, 2.72, 1.53, -0.12), rcyl(ncsPhi, 0.04, 0.12, 'r', 2.86, 1.84, -0.14, 12)];
  P('NCS cryocooler', {
    system: 'Thermal control', material: 'Reverse-Brayton cryocooler: compressor, turboalternator, recuperator, on a mounting plate', mass: 50, temp: 300, explode: az(ncsPhi, 1.2, -0.3), xrayWeight: 0.6,
    desc: 'Installed in 2002 to revive NICMOS after its solid-nitrogen dewar ran dry. A compressor drives neon gas through a recuperator heat exchanger to a tiny turboalternator spinning at about 7,000 revolutions per second, where the expanding gas gets cold. Layout and location approximate.',
  }, [mesh(merge(cc), HM.al()), mesh(merge(ccParts), HM.iridite()), mesh(merge(ccDet), HM.box())]);
  // the ESM hangs on a flat plate bolted across two of the shroud's internal longerons (236.25° and
  // 258.75°); the plate's ends meet the longerons' inner faces, the box sits on its inner face
  const esmPhi = deg(247.5);
  const esmPlate = [rbox(esmPhi, 0.5, 0.02, 0.84, 2.25, 1.975)];
  for (const t of [-0.39, 0.39]) for (const x of [2.06, 2.44]) esmPlate.push(rcyl(esmPhi, 0.012, 0.02, 'r', x, 1.955, t, 6));   // bolts at the longerons
  P('NCS electronics support module', {
    system: 'Thermal control', material: 'ESM: cryocooler drive and control electronics, on a mounting plate across two shroud longerons', mass: 15, temp: 298, explode: az(esmPhi, 1.2, -0.3),
    desc: 'The cooler\'s electronics box, installed with it in 2002, sets the compressor and turbine speeds. Power reaches it over the Cross Aft Shroud Harness. Drawn on a plate bolted across two of the shroud\'s longerons; position approximate.',
  }, [mesh(merge([rbox(esmPhi, 0.4, 0.22, 0.3, 2.25, 1.855), rcyl(esmPhi, 0.022, 0.05, 'x', 2.47, 1.855, -0.08, 10), rcyl(esmPhi, 0.022, 0.05, 'x', 2.47, 1.855, 0.06, 10)]), HM.box()), mesh(merge(esmPlate), HM.al())]);
  const loop = [
    ...cablePath([az(deg(236), 1.53, 2.68), [2.45, -0.8, -1.0], [2.2, -0.7, -0.93], [2.0, -0.62, -0.62]], 0.012, 8),
    ...cablePath([az(deg(232), 1.53, 2.62), [2.4, -0.86, -0.99], [2.15, -0.76, -0.93], [2.0, -0.55, -0.7]], 0.012, 8),
  ];
  P('NCS neon circulator loop', {
    system: 'Thermal control', material: 'Insulated neon lines from the cryocooler\'s cold-load interface to the NICMOS cryo interface', mass: 4, temp: 80, explode: az(ncsPhi, 0.6, -0.3),
    desc: 'A closed loop that circulates cold neon gas from the cooler, through the enclosure wall, into the dewar\'s cryo interface and back, holding the detectors near 77 K. Route approximate.',
  }, mesh(merge(loop), HM.kapton()));
  const cpl = [
    ...cablePath([az(deg(244), 1.64, 3.15), az(deg(244), 2.05, 3.15), az(deg(245), 2.12, 3.3)], 0.01, 6),
    ...cablePath([az(deg(237), 1.64, 2.8), az(deg(237), 2.05, 2.8), az(deg(238), 2.12, 2.6)], 0.01, 6),
  ];
  P('NCS capillary pumped loop lines', {
    system: 'Thermal control', material: 'Ammonia capillary-pumped-loop lines through the shroud wall', mass: 4, temp: 260, explode: az(ncsPhi, 1.5, -0.3),
    desc: 'Carry the cooler\'s waste heat out through the shroud wall to the external radiator. The ammonia is moved by surface tension in a wick alone — no pump, no vibration. Route approximate.',
  }, mesh(merge(cpl), HM.al()));
  const cplPanel = [shellPatch(RAD.big + 0.025, 2.4, 3.4, deg(230), deg(251), { nphi: 8 })];
  const cplLoop = [];
  for (let k = 0; k < 4; k++) cplLoop.push(rod(az(deg(233 + k * 5), RAD.big + 0.035, 2.45), az(deg(233 + k * 5), RAD.big + 0.035, 3.36), 0.01, 6));
  const cplP = P('NCS radiator', {
    system: 'Thermal control', skin: true, material: 'Capillary-pumped-loop radiator panel, white paint', mass: 30, temp: 225, explode: az(ncsPhi, 1.8, -0.3),
    desc: 'Rejects the cryocooler\'s heat to space through the capillary pumped loop. Mounted outside the aft shroud; exact position approximate.',
  }, [mesh(merge(cplPanel), HM.radiator()), mesh(merge(cplLoop), HM.al())]);
  cplP.userData.part.thermalRole = 'radiator';

  void root;
  return out;
}

/** Stencil the short names on the aft faces of the axial instruments (call after matrices are current). */
export function labelInstruments(labels) {
  for (const { part, target, text, at } of labels) {
    part.add(decal(target, stencilText(text, 'rgba(24,28,32,0.92)', true), { at, dir: [-1, 0, 0], size: [0.5, 0.13, 0.2], roughness: 0.5, metalness: 0.2 }));
  }
}
