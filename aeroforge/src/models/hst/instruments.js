// Focal-plane instruments (post-SM4, 2009) and the sensors that share the aft shroud.
//
// Axial bays (behind the primary, parallel to the optical axis): position 1 STIS, 2 NICMOS,
// 3 ACS, 4 COS (in the bay COSTAR vacated in 2009, which had held the High Speed Photometer).
// Radial bays (around the focal plane, perpendicular to the axis): WFC3 and the three Fine
// Guidance Sensors. The quadrant each bay occupies around the axis is schematic.

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
      name: 'Space Telescope Imaging Spectrograph', short: 'STIS', q: [1, 1], mass: 374, temp: 293,
      material: 'Aluminium optical bench; CCD and two MAMA photon-counting detectors',
      desc: 'Axial bay 1 (since 1997, replacing GHRS). Spreads light from 115 nm to 1 µm into spectra, including long slits across galaxies and planets. Its power supply failed in 2004 and was repaired in orbit in 2009 — an instrument never designed to be opened.',
      inner: (c) => [new THREE.BoxGeometry(0.5, 0.3, 0.3).translate(1.9, c[0] * 0.55, c[1] * 0.45), new THREE.CylinderGeometry(0.12, 0.12, 0.25, 20).rotateZ(Math.PI / 2).translate(1.1, c[0] * 0.45, c[1] * 0.6)],
    },
    {
      name: 'Near Infrared Camera and Multi-Object Spectrometer', short: 'NICMOS', q: [1, -1], mass: 391, temp: 290,
      material: 'Three HgCdTe 256 × 256 cameras in a dewar, cooled by the NICMOS Cooling System',
      desc: 'Axial bay 2 (since 1997, replacing FOS). Infrared cameras covering 0.8–2.5 µm. Its solid-nitrogen coolant ran out in 1999; a cryocooler revived it in 2002. Dormant since 2008, its infrared work is now done by WFC3.',
      inner: (c) => [new THREE.CylinderGeometry(0.28, 0.28, 0.9, 32).rotateZ(Math.PI / 2).translate(1.55, c[0] * 0.5, c[1] * 0.5)],
      cold: true,
    },
    {
      name: 'Advanced Camera for Surveys', short: 'ACS', q: [-1, -1], mass: 398, temp: 292,
      material: 'Wide Field Channel (two 2048 × 4096 CCDs) and Solar Blind Channel',
      desc: 'Axial bay 3 (since 2002, replacing FOC). Hubble\'s survey camera, behind the Ultra Deep Field and many of its best-known pictures. Its CCD electronics failed in 2007 and were rebuilt by spacewalkers in 2009.',
      inner: (c) => [new THREE.BoxGeometry(0.7, 0.32, 0.32).translate(1.7, c[0] * 0.5, c[1] * 0.42), new THREE.BoxGeometry(0.4, 0.22, 0.22).translate(0.85, c[0] * 0.38, c[1] * 0.66)],
    },
    {
      name: 'Cosmic Origins Spectrograph', short: 'COS', q: [-1, 1], mass: 386, temp: 292,
      material: 'Gratings on a rotating mount; far-UV cross-delay-line and near-UV MAMA detectors',
      desc: 'Axial bay 4, installed in 2009 in the bay COSTAR vacated. The most sensitive ultraviolet spectrograph Hubble has carried (115–320 nm), built to read the faint absorption of the gas between galaxies.',
      inner: (c) => [new THREE.CylinderGeometry(0.2, 0.2, 0.08, 28).rotateX(Math.PI / 2).translate(2.0, c[0] * 0.5, c[1] * 0.5), new THREE.BoxGeometry(0.45, 0.28, 0.3).translate(0.9, c[0] * 0.5, c[1] * 0.5)],
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
    const ap = new THREE.BoxGeometry(0.03, 0.09, 0.09).translate(X_SI1 + 0.015, qy * 0.12, qz * 0.12);
    const inner = mesh(merge(si.inner([qy, qz])), HM.box());
    if (si.cold) inner.userData.temp = 77;
    const handles = [];
    for (const s of [-1, 1]) {
      const a = [X_SI0 - 0.01, cy + s * 0.25, cz + qz * 0.22], b = [X_SI0 - 0.16, cy + s * 0.25, cz + qz * 0.22];
      const c2 = [X_SI0 - 0.16, cy + s * 0.25, cz - qz * 0.22], d = [X_SI0 - 0.01, cy + s * 0.25, cz - qz * 0.22];
      handles.push(rod(a, b, 0.016, 6), rod(b, c2, 0.016, 6), rod(c2, d, 0.016, 6));
    }
    const p = P(si.name, {
      system: 'Payload', material: si.material, mass: si.mass, temp: si.temp, explode: [-2.4, qy * 0.25, qz * 0.25],
      desc: si.desc, callout: si.short === 'COS', anchor: [X_SI0 + 0.3, cy + qy * 0.48, cz + qz * 0.48],
    }, [shellMesh, mesh(merge(det), HM.box()), mesh(ap, HM.black()), inner, mesh(merge(handles), HM.handrail())]);
    p.userData.part.short = si.short;
    out.labels.push({ part: p, target: shellMesh, text: si.short, at: [X_SI0 - 0.002, cy - qy * 0.12, cz + qz * 0.18] });
    out.axial.push(p);
  }

  // ------------------------------------------------------------------ radial instruments
  const neck = (phi, rIn) => [
    rbox(phi, 0.24, 1.0 - rIn, 0.16, OPT.xFocus + 0.15, (1.0 + rIn) / 2),
  ];
  // WFC3 on the −V3 side; its radiator is part of the shroud skin
  const wPhi = deg(180);
  const wfc3Body = mesh(wedge(wPhi, 1.0, 2.04, 0.75, 1.35, 1.82, 3.4), HM.siGrey());
  const wfc3Det = [];
  wfc3Det.push(...neck(wPhi, 0.08));
  const wDet = mesh(merge([rbox(wPhi, 0.3, 0.18, 0.22, 2.4, 1.45, -0.25), rbox(wPhi, 0.3, 0.18, 0.22, 2.4, 1.45, 0.25)]), HM.box());
  wDet.userData.temp = 160;             // UVIS CCDs ≈ −83 °C, IR array ≈ −128 °C
  const wfc3 = P('Wide Field Camera 3', {
    system: 'Payload', material: 'UVIS channel (two 2k × 4k CCDs) and IR channel (1k × 1k HgCdTe), thermoelectrically cooled', mass: 408, temp: 292,
    explode: [0, -1.9, 0],
    desc: 'The radial-bay camera since 2009, replacing WFPC2. One instrument spans 200 nm to 1.7 µm through two channels; its pick-off mirror takes the centre of Hubble\'s field. It made the 2014 Ultraviolet Deep Field and the infrared Pillars of Creation.',
    callout: true, anchor: [2.6, -2.15, 0.4],
  }, [wfc3Body, mesh(merge(wfc3Det), HM.box()), wDet]);
  const radPanel = shellPatch(RAD.big + 0.02, 1.84, 3.38, deg(161), deg(199), { nphi: 12 });
  const radFins = [];
  for (let k = 0; k < 7; k++) radFins.push(rod(az(deg(164 + k * 5.3), RAD.big + 0.03, 1.9), az(deg(164 + k * 5.3), RAD.big + 0.03, 3.32), 0.012, 6));
  const rad = P('WFC3 radiator', {
    system: 'Thermal control', material: 'White-painted aluminium radiator with embedded heat pipes', mass: 45, temp: 235, explode: [0, -2.6, 0],
    desc: 'The camera\'s outer face is a curved radiator that forms part of the aft shroud skin. It carries away the heat pumped out by the detectors\' thermoelectric coolers.',
  }, [mesh(radPanel, HM.radiator()), mesh(merge(radFins), HM.al())]);
  rad.userData.part.thermalRole = 'radiator';
  void wfc3;

  // three Fine Guidance Sensors (positions after SM4: FGS-1R, FGS-2R2, FGS-3)
  const FGS = [
    { n: 1, phi: 90, note: 'FGS-1R (1997) is the most stable and serves as Hubble\'s astrometer, measuring star positions to about a milliarcsecond.' },
    { n: 2, phi: 0, note: 'The 2009 unit is a refurbished sensor returned from an earlier mission.' },
    { n: 3, phi: 270, note: 'Two of the three guiders lock on stars for every observation; the third can do science.' },
  ];
  out.fgs = [];
  for (const f of FGS) {
    const phi = deg(f.phi);
    const body = mesh(wedge(phi, 1.0, 2.04, 0.62, 1.12, 1.82, 3.4), new THREE.MeshStandardMaterial({ color: 0xb4b9be, roughness: 0.5, metalness: 0.45 }));
    const det = [...neck(phi, 0.26), rbox(phi, 0.5, 0.25, 0.4, 2.3, 1.5), rbox(phi, 0.06, 0.4, 0.5, 3.0, 1.6)];
    const p = P(`Fine Guidance Sensor ${f.n}`, {
      system: 'Attitude control', material: 'White-light shearing interferometers (Koesters prisms), photomultipliers, star selectors', mass: 220, temp: 292,
      explode: az(phi, 1.8), desc: `Radial bay. Locks on a guide star at the edge of the field and senses its position to a few milliarcseconds, 40 times a second. ${f.note}`,
      callout: f.n === 1, anchor: az(phi, 2.2, 2.6),
    }, [body, mesh(merge(det), HM.box())]);
    out.fgs.push(p);
  }

  // ------------------------------------------------------------------ gyros, star trackers, NICMOS cooler
  const rsu = (n, t) => {
    const phi = deg(135);
    const box = rbox(phi, 0.28, 0.22, 0.26, 2.62, 1.72, t);
    const gyros = [0, 1].map((i) => new THREE.CylinderGeometry(0.06, 0.06, 0.18, 16).translate(2.55 + i * 0.14, 1.86, t).rotateX(phi));
    return P(`Rate sensor unit ${n}`, {
      system: 'Attitude control', material: 'Two gas-bearing rate-integrating gyroscopes in an enclosure', mass: 24, count: 2, temp: 296,
      explode: az(phi, 1.2, -0.6), desc: `Each unit carries two gyros, six in all. The gyros' flex leads corroded over time; all six were replaced in 2009. Since 2024 Hubble points with a single gyro to conserve the rest. Location in the aft shroud approximate.`,
      callout: n === 2, anchor: az(phi, 2.0, 2.62),
    }, [mesh(box, HM.iridite()), mesh(merge(gyros), HM.box())]);
  };
  rsu(1, -0.36); rsu(2, 0); rsu(3, 0.36);

  const fh = [], shades = [];
  for (const [i, a] of [[0, 124], [1, 136], [2, 148]].map(([i, a]) => [i, deg(a)])) {
    fh.push(rbox(a, 0.3, 0.3, 0.24, 3.12, 1.82));
    // light shade through the shroud, tilted 20° toward the aperture
    const g = new THREE.CylinderGeometry(0.11, 0.08, 0.42, 4, 1, true).rotateY(Math.PI / 4).translate(0, 0.2, 0).rotateZ(deg(-20));
    g.translate(3.12, RAD.big - 0.02, 0).rotateX(a);
    shades.push(g);
    void i;
  }
  P('Fixed-head star trackers', {
    system: 'Attitude control', material: 'Image-dissector star sensors with sunshades', mass: 54, count: 3, temp: 285, explode: az(deg(136), 1.6, 0.4),
    desc: 'Three trackers look out through the aft shroud and map bright stars to fix Hubble\'s attitude to about an arc-minute — coarse enough to put the guide stars inside the Fine Guidance Sensors\' view. Positions approximate.',
  }, [mesh(merge(fh), HM.box()), mesh(merge(shades), HM.black())]);

  const ncsPhi = deg(225);
  const ncs = [rbox(ncsPhi, 0.6, 0.32, 0.46, 2.95, 1.62)];
  ncs.push(rod(az(ncsPhi, 1.46, 2.7), [1.6, -0.9, -0.95], 0.02, 8), rod(az(ncsPhi, 1.76, 3.25), az(ncsPhi, RAD.big - 0.02, 3.3), 0.02, 8));
  P('NICMOS cooling system', {
    system: 'Thermal control', material: 'Turbo-Brayton neon cryocooler with circulator loop', mass: 105, temp: 300, explode: az(ncsPhi, 1.2, -0.3),
    desc: 'Installed in 2002 to replace NICMOS\'s exhausted solid-nitrogen dewar. A tiny turbine spinning at about 7,000 revolutions per second cooled the detectors to about 77 K. Location approximate.',
  }, mesh(merge(ncs), HM.iridite()));
  const cpl = [shellPatch(RAD.big + 0.025, 2.46, 3.4, deg(207), deg(243), { nphi: 10 })];
  const cplLoop = [];
  for (let k = 0; k < 5; k++) cplLoop.push(rod(az(deg(210 + k * 7.5), RAD.big + 0.035, 2.5), az(deg(210 + k * 7.5), RAD.big + 0.035, 3.36), 0.01, 6));
  const cplP = P('NCS radiator', {
    system: 'Thermal control', material: 'Capillary-pumped-loop radiator panel, white paint', mass: 30, temp: 225, explode: az(ncsPhi, 1.8, -0.3),
    desc: 'Rejects the cryocooler\'s heat through a capillary pumped loop — fluid driven by surface tension alone, no pump. Mounted outside the aft shroud; exact position approximate.',
  }, [mesh(merge(cpl), HM.radiator()), mesh(merge(cplLoop), HM.al())]);
  cplP.userData.part.thermalRole = 'radiator';

  const ascs = [];
  for (const c of [45, 315]) ascs.push(shellPatch(RAD.big + 0.03, 0.55, 1.6, deg(c - 22), deg(c - 4), { nphi: 6 }), shellPatch(RAD.big + 0.03, 0.55, 1.6, deg(c + 4), deg(c + 22), { nphi: 6 }));
  const ascsP = P('Aft shroud cooling system', {
    system: 'Thermal control', material: 'Heat pipes and white radiator panels on the axial-bay doors', mass: 40, temp: 240, explode: [-1.4, 0, 0],
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
