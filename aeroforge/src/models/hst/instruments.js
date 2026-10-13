// Focal-plane instruments (post-SM4, 2009) and the sensors that share the aft shroud.
//
// Quadrants from the SM3A Media Reference Guide's field-of-view map (Fig. 5-18, looking forward):
// axial bays behind the primary — STIS at +V3/+V2 (the former GHRS bay), COS at +V3/−V2 (where
// COSTAR, and before it the High Speed Photometer, sat), ACS at −V3/−V2 (former FOC bay) and
// NICMOS at −V3/+V2 (former FOS bay). Radial bays at the focal plane: WFC3 on the −V3 side,
// FGS 2 at +V3, FGS 1 at −V2 and FGS 3 at +V2. The gyros and star trackers sit on the −V3 side of
// the focal plane structure (SM3A/SM4 guides), reached through the −V3 aft shroud doors.
// Model azimuth: +y = +V3, +z = −V2.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { rod, mergeGeometries } from '../../engine/geometry.js';
import { decal, stencilText } from '../../engine/decals.js';
import { RAD, OPT, az, deg, shellPatch, ni } from './layout.js';
import { HM } from './materials.js';

const merge = (list) => mergeGeometries(list.map(ni));
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

export function buildInstruments(P, root) {
  const out = { labels: [] };

  // ------------------------------------------------------------------ axial instruments
  const AXIAL = [
    {
      name: 'Space Telescope Imaging Spectrograph', short: 'STIS', q: [1, -1], mass: 374, massSource: 'NASA SM3A Media Guide (825 lb)', temp: 293,
      material: 'Carbon-fibre optical bench, 2.2 × 0.98 × 0.98 m; one CCD and two MAMA photon-counting detectors',
      desc: 'Axial bay at +V3/+V2 (since 1997, replacing GHRS). Spreads light from 115 nm to 1 µm into spectra, including long slits across galaxies and planets. Its power supply failed in 2004 and was repaired in orbit in 2009 — an instrument never designed to be opened.',
      subs: [
        { name: 'STIS CCD', material: '1024 × 1024 CCD, thermoelectrically cooled', temp: 190,
          desc: 'The visible-light detector, 200 nm–1 µm: it takes long-slit spectra and also works as a camera for acquiring targets. Its electronics were among the boards spacewalkers replaced in 2009.',
          geo: (c) => [new THREE.BoxGeometry(0.42, 0.26, 0.26).translate(2.0, c[0] * 0.58, c[1] * 0.36)] },
        { name: 'STIS MAMA detectors', material: 'Two Multi-Anode Microchannel Arrays, 1024 × 1024 photon-counting', temp: 290, count: 2,
          desc: 'Photon counters for the far (115–170 nm) and near (165–310 nm) ultraviolet. They are so sensitive that a too-bright target can damage them, so every STIS target is screened first.',
          geo: (c) => [new THREE.BoxGeometry(0.3, 0.2, 0.2).translate(1.45, c[0] * 0.3, c[1] * 0.66), new THREE.BoxGeometry(0.3, 0.2, 0.2).translate(1.45, c[0] * 0.66, c[1] * 0.3)] },
        { name: 'STIS mode select mechanism', material: 'Rotating grating carousel', temp: 293,
          desc: 'A motor-driven wheel of gratings and mirrors that chooses the spectral mode: low or high resolution, first-order or echelle, ultraviolet or visible.',
          geo: (c) => [new THREE.CylinderGeometry(0.16, 0.16, 0.08, 28).rotateX(Math.PI / 2).translate(1.0, c[0] * 0.5, c[1] * 0.5)] },
        { name: 'STIS low-voltage power supply (2009 repair)', material: 'Replacement LVPS-2 circuit board behind a new latched cover plate', temp: 296,
          desc: 'The board whose power converter failed in August 2004. In 2009 a spacewalker removed 111 small screws, held captive by a fastener capture plate, pulled the board and slid in a new one, then closed the bay with a cover held by two latches. Position inside the enclosure approximate.',
          geo: (c) => [new THREE.BoxGeometry(0.36, 0.06, 0.3).translate(0.75, c[0] * 0.88, c[1] * 0.5)] },
      ],
    },
    {
      name: 'Near Infrared Camera and Multi-Object Spectrometer', short: 'NICMOS', q: [-1, -1], mass: 391, temp: 290,
      material: 'Three cameras with 256 × 256 HgCdTe arrays in a dewar',
      desc: 'Axial bay at −V3/+V2 (since 1997, replacing FOS). Infrared cameras covering 0.8–2.5 µm. Its solid-nitrogen coolant ran out in 1999; a cryocooler revived it in 2002. Dormant since 2008, its infrared work is now done by WFC3.',
      subs: [
        { name: 'NICMOS dewar', material: 'Aluminium cryostat, now cooled by the external cryocooler', temp: 77,
          desc: 'Built to hold a block of solid nitrogen around the detectors for 4.5 years; a thermal short made it run out after less than two. From 2002 the NICMOS Cooling System pumped cold neon through it instead, holding the arrays near 77 K.',
          geo: (c) => [new THREE.CylinderGeometry(0.29, 0.29, 0.9, 32).rotateZ(Math.PI / 2).translate(1.55, c[0] * 0.5, c[1] * 0.5)] },
      ],
    },
    {
      name: 'Advanced Camera for Surveys', short: 'ACS', q: [-1, 1], mass: 398, temp: 292,
      material: 'Wide Field Channel and Solar Blind Channel; High Resolution Channel inoperative',
      desc: 'Axial bay at −V3/−V2 (since 2002, replacing FOC). Hubble\'s survey camera, behind the Ultra Deep Field and many of its best-known pictures. Its CCD electronics failed in 2007 and were rebuilt by spacewalkers in 2009.',
      subs: [
        { name: 'ACS Wide Field Channel', material: 'Two 2048 × 4096 CCDs, 0.05″ pixels', temp: 192,
          desc: 'The workhorse: a 202″ × 202″ field from 350 nm to 1.1 µm. Its CCDs run at −81 °C. Rebuilt electronics installed in 2009 restored it after the 2007 failure.',
          geo: (c) => [new THREE.BoxGeometry(0.7, 0.3, 0.32).translate(1.75, c[0] * 0.5, c[1] * 0.42)] },
        { name: 'ACS Solar Blind Channel', material: 'MAMA detector, 115–170 nm', temp: 290,
          desc: 'A far-ultraviolet camera blind to visible light, so faint ultraviolet sources are not swamped by the much brighter visible light of the same field.',
          geo: (c) => [new THREE.BoxGeometry(0.4, 0.22, 0.22).translate(0.85, c[0] * 0.38, c[1] * 0.64)] },
        { name: 'ACS High Resolution Channel (inoperative)', material: '1024 × 1024 CCD, 0.025″ pixels, with a coronagraph', temp: 290,
          desc: 'The channel that covered 170–350 nm and took the sharpest ACS images. It failed with the CCD electronics in January 2007 and could not be restored in 2009, which is why ACS now has no channel between the far ultraviolet and 350 nm.',
          geo: (c) => [new THREE.BoxGeometry(0.4, 0.22, 0.22).translate(1.0, c[0] * 0.72, c[1] * 0.3)] },
        { name: 'ACS replacement CCD electronics (2009)', material: 'CCD electronics box and low-voltage power supply installed in orbit', temp: 296,
          desc: 'The 2009 repair: spacewalkers took 32 screws out of an electronics access panel never meant to be opened in space, swapped the failed CCD electronics cards for a new box and power supply, and brought the Wide Field Channel back. Position inside the enclosure approximate.',
          geo: (c) => [new THREE.BoxGeometry(0.3, 0.1, 0.3).translate(0.55, c[0] * 0.86, c[1] * 0.62)] },
      ],
    },
    {
      name: 'Cosmic Origins Spectrograph', short: 'COS', q: [1, 1], mass: 386, temp: 292,
      material: 'Single-reflection grating design; far-UV and near-UV channels',
      desc: 'Axial bay at +V3/−V2, installed in 2009 in the bay COSTAR vacated (it had held the High Speed Photometer until 1993). The most sensitive ultraviolet spectrograph Hubble has carried (115–320 nm), built to read the faint absorption of the gas between galaxies.',
      subs: [
        { name: 'COS optics select mechanism', material: 'Rotating mount of gratings', temp: 292,
          desc: 'Turns to put one of COS\'s gratings in the beam. Each grating both disperses and refocuses the light, because every extra reflection would throw away a large share of the far ultraviolet.',
          geo: (c) => [new THREE.CylinderGeometry(0.2, 0.2, 0.08, 28).rotateX(Math.PI / 2).translate(2.0, c[0] * 0.5, c[1] * 0.5)] },
        { name: 'COS far-UV detector', material: 'Cross-delay-line microchannel-plate detector', temp: 292,
          desc: 'Counts individual ultraviolet photons from 115 to 205 nm and times each one, on two side-by-side segments.',
          geo: (c) => [new THREE.BoxGeometry(0.45, 0.28, 0.3).translate(0.9, c[0] * 0.5, c[1] * 0.5)] },
        { name: 'COS near-UV detector', material: 'MAMA photon-counting detector (a spare built for STIS)', temp: 292,
          desc: 'Covers the near ultraviolet, 170–320 nm, through its own channel with three camera mirrors.',
          geo: (c) => [new THREE.BoxGeometry(0.3, 0.2, 0.2).translate(1.45, c[0] * 0.75, c[1] * 0.25)] },
      ],
    },
  ];
  out.axial = [];
  for (const si of AXIAL) {
    const [qy, qz] = si.q;
    const cy = qy * 0.5, cz = qz * 0.5;
    const L = X_SI1 - X_SI0, xm = (X_SI0 + X_SI1) / 2;
    const shell = new THREE.BoxGeometry(L, 0.9, 0.9).translate(xm, cy, cz);
    const shellMesh = mesh(shell, HM.siGrey());
    const det = [];
    // guide rails along the two outer faces, entrance aperture near the axis, connector panel and handholds aft
    det.push(new THREE.BoxGeometry(L - 0.1, 0.04, 0.06).translate(xm, cy + qy * 0.47, cz), new THREE.BoxGeometry(L - 0.1, 0.06, 0.04).translate(xm, cy, cz + qz * 0.47));
    det.push(new THREE.BoxGeometry(0.03, 0.18, 0.4).translate(X_SI0 - 0.015, cy + qy * 0.15, cz - qz * 0.12));
    for (const x of [0.75, 1.45, 2.15]) det.push(new THREE.BoxGeometry(0.05, 0.92, 0.92).translate(x, cy, cz));     // stiffening frames
    const ap = new THREE.BoxGeometry(0.03, 0.09, 0.09).translate(X_SI1 + 0.015, qy * 0.12, qz * 0.12);
    const handles = [];
    for (const s of [-1, 1]) {
      const a = [X_SI0 - 0.01, cy + s * 0.25, cz + qz * 0.22], b = [X_SI0 - 0.16, cy + s * 0.25, cz + qz * 0.22];
      const c2 = [X_SI0 - 0.16, cy + s * 0.25, cz - qz * 0.22], d = [X_SI0 - 0.01, cy + s * 0.25, cz - qz * 0.22];
      handles.push(rod(a, b, 0.016, 6), rod(b, c2, 0.016, 6), rod(c2, d, 0.016, 6));
    }
    const p = P(si.name, {
      system: 'Payload', material: si.material, mass: si.mass, massSource: si.massSource, temp: si.temp, explode: [-3.4, qy * 0.25, qz * 0.25],
      desc: si.desc, callout: true, anchor: [X_SI0 + 0.05, cy + qy * 0.46, cz + qz * 0.46],
    }, [shellMesh, mesh(merge(det), HM.box()), mesh(ap, HM.black()), mesh(merge(handles), HM.handrail())]);
    p.userData.part.short = si.short;
    p.userData.part.tourLabel = true;            // internal: labelled only while a tour focuses it
    for (const sub of si.subs) {
      const m = mesh(merge(sub.geo([qy, qz])), sub.temp < 150 ? HM.kapton() : HM.iridite());
      P(sub.name, { system: 'Payload', material: sub.material, temp: sub.temp, count: sub.count, explode: [0, qy * 0.9, qz * 0.9], desc: `${sub.desc} Part of ${si.short}; mass included in the instrument.` }, m, p);
    }
    out.labels.push({ part: p, target: shellMesh, text: si.short, at: [X_SI0 - 0.002, cy - qy * 0.12, cz + qz * 0.18] });
    out.axial.push(p);
  }

  // ------------------------------------------------------------------ radial instruments
  const neck = (phi, rIn) => [
    rbox(phi, 0.24, 1.0 - rIn, 0.16, OPT.xFocus + 0.15, (1.0 + rIn) / 2),
  ];
  // WFC3 on the −V3 side; its 0.8 × 2.2 m radiator is part of the shroud skin
  const wPhi = deg(180);
  const W0 = 1.22, W1 = 3.42;
  const wfc3Body = mesh(wedge(wPhi, 1.0, 2.04, 0.5, 0.82, W0, W1), HM.siGrey());
  const wfc3Det = [...neck(wPhi, 0.08)];
  for (const x of [W0 + 0.05, W1 - 0.05]) wfc3Det.push(rbox(wPhi, 0.06, 0.9, 0.6, x, 1.52));                         // end frames
  wfc3Det.push(rbox(wPhi, W1 - W0 - 0.1, 0.05, 0.06, (W0 + W1) / 2, 1.04, 0));                                       // guide rail
  const wfc3 = P('Wide Field Camera 3', {
    system: 'Payload', material: 'UVIS channel (two 2k × 4k CCDs) and IR channel (1k × 1k HgCdTe), thermoelectrically cooled; camera 1 × 1.3 × 0.5 m', mass: 404, massSource: 'NASA SM4 Media Guide (890 lb)', temp: 292,
    explode: [0, -1.9, 0],
    desc: 'The radial-bay camera since 2009, replacing WFPC2 (whose corrective optics had fixed Hubble\'s vision in 1993). One instrument spans 200 nm to 1.7 µm through two channels; its pick-off mirror takes the centre of Hubble\'s field. Enclosure drawn to the radiator\'s length; inner shape approximate.',
  }, [wfc3Body, mesh(merge(wfc3Det), HM.box())]);
  P('WFC3 UVIS channel', {
    system: 'Payload', material: 'Two 2051 × 4096 CCDs, 0.04″ pixels, thermoelectrically cooled to −83 °C', temp: 190, explode: [0, -0.9, -0.6],
    desc: 'Ultraviolet-to-visible camera, 200–1000 nm, over a 162″ field. It made the 2014 Ultraviolet Deep Field. Part of WFC3; mass included in the instrument.',
  }, mesh(rbox(wPhi, 0.36, 0.22, 0.24, 2.5, 1.5, -0.13), HM.iridite()), wfc3);
  P('WFC3 IR channel', {
    system: 'Payload', material: '1024 × 1024 HgCdTe array, 0.13″ pixels, six-stage thermoelectric cooler to 145 K', temp: 145, explode: [0, -0.9, 0.6],
    desc: 'Near-infrared camera, 800–1700 nm, over a 136″ × 123″ field — the channel that took over from NICMOS and re-imaged the Pillars of Creation in infrared. Part of WFC3; mass included in the instrument.',
  }, mesh(rbox(wPhi, 0.36, 0.22, 0.24, 1.95, 1.5, 0.13), HM.kapton()), wfc3);
  P('WFC3 channel select mechanism', {
    system: 'Payload', material: 'Rotating fold mirror', temp: 292, explode: [0, -0.5, 0],
    desc: 'A mirror that either stays out of the beam, sending light to the UVIS channel, or swings in to divert it to the infrared channel. The two channels cannot observe at the same time. Part of WFC3; mass included.',
  }, mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 20).rotateZ(Math.PI / 4).translate(0, -1.22, 0).translate(2.25, 0, 0), HM.mirror()), wfc3);
  const radPanel = shellPatch(RAD.big + 0.02, W0 + 0.02, W1, deg(169), deg(191), { nphi: 8, nx: 3 });
  const radFins = [];
  for (let k = 0; k < 5; k++) radFins.push(rod(az(deg(171.5 + k * 4.25), RAD.big + 0.03, W0 + 0.08), az(deg(171.5 + k * 4.25), RAD.big + 0.03, W1 - 0.06), 0.012, 6));
  const rad = P('WFC3 radiator', {
    system: 'Thermal control', skin: true, material: 'White-painted aluminium radiator with embedded heat pipes, 0.8 × 2.2 m', temp: 235, mass: 45, explode: [0, -2.6, 0],
    desc: 'The camera\'s outer face, 0.8 m wide and 2.2 m long, is a curved radiator that forms part of the aft shroud skin. It carries away the heat pumped out by the detectors\' thermoelectric coolers; WFC3 is behind it.',
    callout: true, anchor: [1.35, -2.09, -0.37],   // aft corner, so the label clears the Systems legend
  }, [mesh(radPanel, HM.radiator()), mesh(merge(radFins), HM.al())]);
  rad.userData.part.thermalRole = 'radiator';

  // three Fine Guidance Sensors at 90° intervals (units after SM4: FGS-1R, FGS-2R2, FGS-3)
  const FGS = [
    { n: 1, phi: 90, side: '−V2', note: 'FGS-1R (1997) is the most stable and serves as Hubble\'s astrometer, measuring star positions to about a milliarcsecond.' },
    { n: 2, phi: 0, side: '+V3', note: 'The unit installed in 2009 is a refurbished sensor returned from an earlier mission.' },
    { n: 3, phi: 270, side: '+V2', note: 'Two of the three guiders lock on stars for every observation; the third can do science.' },
  ];
  out.fgs = [];
  for (const f of FGS) {
    const phi = deg(f.phi);
    const body = mesh(wedge(phi, 1.0, 2.04, 0.62, 1.12, 1.82, 3.4), new THREE.MeshStandardMaterial({ color: 0xb4b9be, roughness: 0.5, metalness: 0.45 }));
    const det = [...neck(phi, 0.26), rbox(phi, 0.5, 0.25, 0.4, 2.3, 1.5), rbox(phi, 0.06, 0.4, 0.5, 3.0, 1.6)];
    const p = P(`Fine Guidance Sensor ${f.n}`, {
      system: 'Attitude control', material: 'Two Koesters-prism interferometers, four photomultipliers, two star-selector servos; 1.5 × 1 m', mass: 220, massSource: 'NASA SM3A Media Guide (485 lb)', temp: 292,
      explode: az(phi, 1.8), desc: `Radial bay on the ${f.side} side. Its pick-off mirror takes a 90° arc at the edge of the field; it finds a guide star there and holds it to a few milliarcseconds, 40 times a second. It also houses one of the optical control (wavefront) sensors. ${f.note}`,
      callout: f.n === 1, anchor: az(phi, 2.0, 2.6),
    }, [body, mesh(merge(det), HM.box())]);
    if (f.n === 1) p.userData.part.tourLabel = true;
    const opt = [rbox(phi, 0.3, 0.16, 0.2, 2.75, 1.25, -0.12), rbox(phi, 0.3, 0.16, 0.2, 2.75, 1.25, 0.12), rbox(phi, 0.22, 0.14, 0.42, 2.1, 1.75)];
    P(`FGS ${f.n} star selectors & interferometers`, {
      system: 'Attitude control', material: 'Two star-selector servo assemblies, two Koesters-prism interferometers with four photomultipliers', temp: 292, count: 2, explode: az(phi, 0.5),
      desc: 'The two star selectors steer a 5″ instantaneous field across the guider\'s arc to find the guide star; the Koesters prisms then split its wavefront, and comparing the light in the photomultipliers measures the star\'s position to milliarcseconds. Part of the FGS; mass included. Layout inside the enclosure schematic.',
    }, mesh(merge(opt), HM.iridite()), p);
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

  const ncsPhi = deg(240);
  const ncs = [rbox(ncsPhi, 0.6, 0.32, 0.46, 2.95, 1.62)];
  ncs.push(rod(az(ncsPhi, 1.46, 2.7), [1.6, -0.9, -0.95], 0.02, 8), rod(az(ncsPhi, 1.76, 3.25), az(ncsPhi, RAD.big - 0.02, 3.3), 0.02, 8));
  P('NICMOS cooling system', {
    system: 'Thermal control', material: 'Turbo-Brayton neon cryocooler with circulator loop', mass: 105, temp: 300, explode: az(ncsPhi, 1.2, -0.3),
    desc: 'Installed in 2002 to replace NICMOS\'s exhausted solid-nitrogen dewar. A tiny turbine spinning at about 7,000 revolutions per second cooled the detectors to about 77 K. Location approximate.',
  }, mesh(merge(ncs), HM.iridite()));
  const cpl = [shellPatch(RAD.big + 0.025, 2.4, 3.4, deg(230), deg(251), { nphi: 8 })];
  const cplLoop = [];
  for (let k = 0; k < 4; k++) cplLoop.push(rod(az(deg(233 + k * 5), RAD.big + 0.035, 2.45), az(deg(233 + k * 5), RAD.big + 0.035, 3.36), 0.01, 6));
  const cplP = P('NCS radiator', {
    system: 'Thermal control', skin: true, material: 'Capillary-pumped-loop radiator panel, white paint', mass: 30, temp: 225, explode: az(ncsPhi, 1.8, -0.3),
    desc: 'Rejects the cryocooler\'s heat through a capillary pumped loop — fluid driven by surface tension alone, no pump. Mounted outside the aft shroud; exact position approximate.',
  }, [mesh(merge(cpl), HM.radiator()), mesh(merge(cplLoop), HM.al())]);
  cplP.userData.part.thermalRole = 'radiator';

  // aft shroud cooling system: one radiator on each leaf of the two axial door pairs
  const ascs = [];
  for (const [a, b] of [[226, 269], [271, 314], [46, 89], [91, 134]]) ascs.push(shellPatch(RAD.big + 0.03, 0.55, 1.5, deg(a + 6), deg(b - 6), { nphi: 6 }));
  const ascsP = P('Aft shroud cooling system', {
    system: 'Thermal control', skin: true, material: 'Heat pipes and white radiator panels on the axial-bay doors', mass: 40, count: 4, temp: 240, explode: [-1.4, 0, 0],
    desc: 'Added in 2002 so the axial instruments could run more electronics: heat pipes carry their heat to radiators on the outside of the aft shroud doors. Panel layout approximate.',
  }, mesh(merge(ascs), HM.radiator()));
  ascsP.userData.part.thermalRole = 'radiator';

  void root;
  return out;
}

/** Stencil the short names on the aft faces of the axial instruments (call after matrices are current). */
export function labelInstruments(labels) {
  for (const { part, target, text, at } of labels) {
    part.add(decal(target, stencilText(text, 'rgba(24,28,32,0.92)', true), { at, dir: [-1, 0, 0], size: [0.5, 0.13, 0.2], roughness: 0.5, metalness: 0.2 }));
  }
}
