// GPS III antenna farm on the Earth deck. Layout after the GPS III nadir antenna deck shown as prior
// art in Lockheed Martin patent US 10,749,252 (Fig. 1): an Earth-coverage (EC) L-band array of 12
// tapered helices interleaved with 12 UHF crosslink elements, a 4-element military Earth-coverage
// (MEC) group at one end of the same panel, and the laser retroreflector at the other end. Element
// sizes and heights, and the exact positions, are estimates scaled from that drawing.
// Also here: the deployable JIB monopoles and the two S-band TT&C antennas.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { lathe } from '../../engine/geometry.js';
import { G } from './materials.js';
import { HX, HY, HZ, IY, IZ, DECK, AFT, boxG, cylG, merge, pipeG, plateG, helixG } from './kit.js';

export const PANEL_Z = DECK + 0.085;      // top of the L-band antenna panel
const PANEL_T = 0.03;

// panel outline: a chamfered octagon over the array with a tongue toward −Y for the MEC group
const OUTLINE = [[0.8, -0.5], [0.8, 0.5], [0.5, 0.8], [-0.5, 0.8], [-0.8, 0.5], [-0.8, -0.5], [-0.5, -0.8], [-0.26, -0.8],
  [-0.26, -1.12], [-0.18, -1.2], [0.18, -1.2], [0.26, -1.12], [0.26, -0.8], [0.5, -0.8]];

const D = Math.PI / 180;
const ring = (n, r, a0) => Array.from({ length: n }, (_, k) => { const a = (a0 + (k * 360) / n) * D; return [Math.cos(a) * r, Math.sin(a) * r]; });
export const EC_INNER = ring(4, 0.13, 22.5), EC_OUTER = ring(8, 0.46, 0);
export const UHF_INNER = ring(4, 0.29, 67.5), UHF_OUTER = ring(8, 0.70, 22.5);
export const MEC = [[-0.075, -0.925], [0.075, -0.925], [-0.075, -1.075], [0.075, -1.075]];
export const LRA_C = [0, 1.02];
export const JIB_POS = [[-0.36, 1.16], [0.36, 1.16], [-0.82, 1.16], [0.82, 1.16], [-0.36, -1.16], [0.36, -1.16], [-0.82, -1.16], [0.82, -1.16]];
const JIB_L = 0.5;

/** Radome: a cylinder with a shallow dome, height h, standing on z0. */
function radomeG(x, y, r, h, z0, seg = 28) {
  const prof = [[r, 0], [r, h - 0.03], [r * 0.72, h - 0.008], [0.0001, h]];
  return lathe(prof, seg).rotateX(Math.PI / 2).translate(x, y, z0);
}

/** A helical element on the panel: base cup, mast, radome and tapered conductor. */
function helixElement(x, y, h, rr, turns, { quad = false } = {}) {
  const z0 = PANEL_Z;
  const metal = merge([cylG([x, y, z0 + 0.015], rr + 0.008, 0.03, 'z', 24), cylG([x, y, z0 + 0.03 + (h - 0.07) / 2], 0.009, h - 0.07, 'z', 8)]);
  const wire = quad
    ? merge([0, 1, 2, 3].map((k) => helixG(x, y, rr - 0.02, z0 + 0.05, z0 + h - 0.02, turns, 0.004, (k * Math.PI) / 2)))
    : helixG(x, y, rr - 0.018, z0 + 0.04, z0 + h - 0.02, turns, 0.0032, 0, rr - 0.03);
  return [mesh(metal, G.aluminium()), mesh(radomeG(x, y, rr, h, z0 + 0.03), G.radome()), mesh(wire, G.helixWire())];
}

export function buildAntennas(P) {
  // ------------------------------------------------------------------ support frame, panel, feed networks
  const struts = [];
  const strutAt = [[0.72, -0.42], [0.72, 0.42], [0.42, 0.72], [-0.42, 0.72], [-0.72, 0.42], [-0.72, -0.42], [-0.42, -0.72], [0.42, -0.72], [-0.18, -1.12], [0.18, -1.12]];
  for (const [x, y] of strutAt) struts.push(cylG([x, y, (DECK + PANEL_Z - PANEL_T) / 2], 0.014, PANEL_Z - PANEL_T - DECK, 'z', 10), cylG([x, y, DECK + 0.004], 0.03, 0.008, 'z', 12));
  P('Antenna support frame', {
    system: 'Structure', material: 'Carbon-fibre struts with titanium end fittings', mass: 10, temp: 250, explode: [0, 0, 1.85],
    desc: 'Stands the L-band antenna panel off the Earth deck so its feed networks fit underneath, and holds the array\'s pointing to the spacecraft axes. Geometry estimated.',
  }, mesh(merge(struts), G.cfrp(2)));

  P('L-band antenna panel', {
    system: 'Payload', material: 'White-painted aluminium honeycomb ground plane', mass: 40, temp: 245, explode: [0, 0, 2.05],
    desc: 'Ground plane of the navigation antennas. Its 12 Earth-coverage helices broadcast every civil and military signal to the whole visible Earth; four military Earth-coverage (M-code) elements sit at one end. Lockheed\'s patent drawing of the GPS III nadir deck shows this arrangement; panel size and element positions here are scaled from it (estimate).',
    callout: true, anchor: [0.8, -0.2, PANEL_Z],
  }, mesh(plateG(OUTLINE, PANEL_T, PANEL_Z - PANEL_T), G.whitePaint()));

  const bfn = [cylG([0, 0, DECK + 0.03], 0.24, 0.03, 'z', 40)];
  for (const [x, y] of [...EC_INNER, ...EC_OUTER]) {
    const a = Math.atan2(y, x), r0 = 0.22;
    bfn.push(pipeG([[Math.cos(a) * r0, Math.sin(a) * r0, DECK + 0.04], [x, y, DECK + 0.04], [x, y, PANEL_Z - PANEL_T]], 0.007));
  }
  bfn.push(boxG([0, -1.0, DECK + 0.03], [0.2, 0.2, 0.03]));
  for (const [x, y] of MEC) bfn.push(pipeG([[x * 0.5, -1.0, DECK + 0.04], [x, y, DECK + 0.04], [x, y, PANEL_Z - PANEL_T]], 0.007));
  bfn.push(pipeG([[0, -0.22, DECK + 0.03], [0, -0.92, DECK + 0.03]], 0.009));
  P('Beam-forming network', {
    system: 'Payload', material: 'Coaxial power dividers and phase-trimmed cables', mass: 16, temp: 270, explode: [0, 0, 1.95],
    desc: 'Splits each signal twelve ways and sets the phase of the inner and outer elements, shaping the beam so a receiver at the Earth\'s edge, about 5,600 km farther away than one directly below (roughly 2 dB more path loss), still gets nearly the same signal strength. A second divider feeds the four M-code elements.',
  }, mesh(merge(bfn), G.connector()));

  // ------------------------------------------------------------------ Earth-coverage helices
  EC_INNER.forEach(([x, y], k) => P(`L-band helix, inner ${k + 1}`, {
    system: 'Payload', material: 'Tapered copper helix on a dielectric support inside a fibreglass radome', mass: 1.8, temp: 240, explode: [x * 0.4, y * 0.4, 2.35],
    desc: 'One of the four central Earth-coverage elements. An axial-mode helix about one wavelength round (19 cm at L1) radiates right-hand circularly polarised waves; each element carries L1, L2 and L5 at once, at more than 300 W of continuous RF per antenna (patent figure). Element dimensions estimated.',
  }, helixElement(x, y, 0.3, 0.06, 6)));
  EC_OUTER.forEach(([x, y], k) => P(`L-band helix, outer ${k + 1}`, {
    system: 'Payload', material: 'Tapered copper helix on a dielectric support inside a fibreglass radome', mass: 1.8, temp: 240, explode: [x * 0.4, y * 0.4, 2.3],
    desc: 'One of eight ring elements of the Earth-coverage array. Fed with a phase offset from the central four, the ring pushes power out toward the limb so the beam covers the whole Earth disc, 13.9° either side of nadir. Its phase centre moves slightly with frequency, one reason later designs study other element types (element dimensions estimated).',
  }, helixElement(x, y, 0.3, 0.06, 6)));
  MEC.forEach(([x, y], k) => P(`M-code helix ${k + 1}`, {
    system: 'Payload', material: 'Tapered copper helix in a fibreglass radome', mass: 1.6, temp: 240, explode: [x * 0.6, -0.25, 2.3],
    desc: 'One of four military Earth-coverage (MEC) elements at the end of the antenna panel, listed by Lockheed among the GPS III antenna assemblies. They add M-code power for military users: GPS III delivers M-code at least −153 dBW at the ground, 5 dB more than Block IIR and IIF (element size estimated).',
  }, helixElement(x, y, 0.28, 0.058, 5.5)));

  // ------------------------------------------------------------------ UHF crosslink elements, interleaved with the EC array
  const uhf = (name, x, y, k, inner) => P(name, {
    system: 'Communications', material: 'Quadrifilar helix in a fibreglass radome', mass: 2.4, temp: 245, explode: [x * 0.55, y * 0.55, 2.2],
    desc: inner
      ? 'One of the UHF crosslink elements interleaved with the L-band helices, as the GPS III patent drawing shows: satellites exchange data and measure the distances between each other over these links. The form of each element (here a quadrifilar helix) and its size are estimates.'
      : 'Outer-ring UHF crosslink element. Placing the crosslink elements among high-power L-band helices raises the risk of passive intermodulation, one reason Lockheed and Northrop Grumman have patented alternative layouts (element form and size estimated).',
    callout: !inner && k === 5, anchor: [x, y, PANEL_Z + 0.4],
  }, helixElement(x, y, 0.4, 0.078, 0.75, { quad: true }));
  UHF_INNER.forEach(([x, y], k) => uhf(`UHF crosslink element, inner ${k + 1}`, x, y, k, true));
  UHF_OUTER.forEach(([x, y], k) => uhf(`UHF crosslink element, outer ${k + 1}`, x, y, k, false));
  // UHF feed ring under the panel and a trunk down to the crosslink transponder on the +Y radiator
  const uf = [];
  const fr = [];
  for (let k = 0; k <= 48; k++) { const a = (k / 48) * Math.PI * 2; fr.push([Math.cos(a) * 0.58, Math.sin(a) * 0.58, DECK + 0.025]); }
  uf.push(pipeG(fr, 0.008));
  for (const [x, y] of [...UHF_INNER, ...UHF_OUTER]) {
    const a = Math.atan2(y, x);
    uf.push(pipeG([[Math.cos(a) * 0.58, Math.sin(a) * 0.58, DECK + 0.025], [x, y, DECK + 0.025], [x, y, PANEL_Z - PANEL_T]], 0.006));
  }
  uf.push(pipeG([[-0.12, 0.567, DECK + 0.025], [-0.12, 0.7, DECK + 0.025], [-0.12, 0.7, IZ - 0.04], [-0.12, IY - 0.12, IZ - 0.06], [-0.12, IY - 0.12, 0.3], [-0.3, IY - 0.1, 0.3], [-0.42, IY - 0.09, 0.25]], 0.01));
  P('UHF feed network', {
    system: 'Communications', material: 'Coaxial cables, hybrid combiners', mass: 6, temp: 270, explode: [0, 0, 1.9],
    desc: 'Combines the twelve UHF elements and carries the crosslink signal through the Earth deck to the crosslink transponder on the payload radiator (routing estimated).',
  }, mesh(merge(uf), G.connector()));

  // ------------------------------------------------------------------ deployable JIB monopoles
  const rods = [];
  JIB_POS.forEach(([x, y], k) => {
    const can = merge([boxG([x, y, DECK + 0.033], [0.1, 0.1, 0.065]), cylG([x, y, DECK + 0.07], 0.022, 0.012, 'z', 14)]);
    const pivot = new THREE.Group();
    pivot.position.set(x, y, DECK + 0.075);
    const rod = mesh(merge([cylG([0, 0, JIB_L / 2], 0.0065, JIB_L, 'z', 8), cylG([0, 0, JIB_L], 0.01, 0.012, 'z', 8)]), G.stem());
    pivot.add(rod);
    rods.push(pivot);
    P(`JIB antenna ${k + 1}`, {
      system: 'Communications', material: 'Stored-energy STEM monopole in an aluminium canister', mass: 0.7, temp: 250, explode: [Math.sign(x) * 0.15, Math.sign(y) * 0.15, 1.95],
      desc: k === 0
        ? 'One of eight "Jack-in-the-Box" deployable monopoles (Northrop Grumman Astro Aerospace). Stowed in a canister about 10 × 10 × 6 cm, each springs out in about 200 ms once the satellite is on station, and together they form an RF antenna array. Their function, length and positions are not public; 0.5 m rods are shown.'
        : 'Deployable JIB monopole antenna, one of eight that together form an RF array. Northrop Grumman has delivered more than 1,000 JIB assemblies for GPS IIR, IIF and III (rod length and position estimated).',
    }, [mesh(can, G.alodine()), pivot]);
  });

  // ------------------------------------------------------------------ S-band telemetry, tracking and command antennas
  const sAnt = (name, x, y, z0, dir, ex, desc) => {
    const s = Math.sign(dir);
    const metal = merge([cylG([x, y, z0 + s * 0.025], 0.05, 0.05, 'z', 20), cylG([x, y, z0 + s * 0.06], 0.012, 0.03, 'z', 8)]);
    const cone = cylG([x, y, z0 + s * 0.13], s > 0 ? 0.075 : 0.02, 0.12, 'z', 24, s > 0 ? 0.02 : 0.075);
    return P(name, { system: 'Communications', material: 'Conical-spiral element in a radome', mass: 1.5, temp: 240, explode: ex, desc }, [mesh(metal, G.aluminium()), mesh(cone, G.radome())]);
  };
  sAnt('S-band antenna (Earth side)', -0.62, -1.02, DECK, 1, [-0.2, -0.2, 1.9], 'Telemetry, tracking and command antenna facing the Earth. Ground antennas of the Space Force control segment send commands and navigation uploads on S-band (Space-Ground Link System, uplink ≈ 1,783.74 MHz). Position estimated.');
  sAnt('S-band antenna (aft)', 0.72, 0.0, AFT, -1, [0.3, 0, -1.9], 'The second TT&C antenna, on the anti-Earth side, so the satellite can be commanded in any attitude, which is essential while it reorients for apogee burns (downlink ≈ 2,227.5 MHz). Position estimated.');

  /** Rods stowed at d = 0 (inside their canisters), out at d = 1; they spring out once on station. */
  const setJIB = (d) => {
    const s = THREE.MathUtils.smoothstep(d, 0.55, 0.95);
    for (const r of rods) { r.scale.set(1, 1, Math.max(0.02, s)); r.visible = s > 0.03; }
  };
  return { setJIB };
}

export { HX, HY, HZ };
