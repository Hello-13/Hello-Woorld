// GPS III antenna subsystem element on the Earth deck (Marquis & Shaw 2011, Figs. 3 and 4; layout
// from the manufacturer's scale model, Steigenberger et al. 2020, Fig. 4, see layout.js): the black
// L-band panel with 12 tapered Earth-coverage helices and 4 military Earth-coverage (M-code)
// elements, 12 white UHF crosslink elements interleaved with them, the beam-forming and crosslink
// feed networks, the forward TT&C S-band mast and a second mast, the aft TT&C antenna, eight
// deployable JIB monopoles, the stowed antenna on the +X face and the hosted-payload antennas.
// Element sizes and heights are estimates scaled from the photographs.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { lathe } from '../../engine/geometry.js';
import { G } from './materials.js';
import { HX, HY, IY, IZ, DECK, AFT, boxG, cylG, merge, pipeG, plateG, helixG, rectHole, reg } from './kit.js';
import { ARRAY_C, EC_INNER, EC_OUTER, UHF_INNER, UHF_OUTER, MEC, DECK_AT, JIB_POS, PANEL_OUTLINE, BUS, onBUS, AFT_ANT } from './layout.js';

export const PANEL_Z = DECK + 0.085;      // top of the L-band antenna panel
const PANEL_T = 0.03;
const JIB_L = 0.5;

/** Radome: a cylinder or frustum with a shallow dome, base radius r, top radius rt, height h, standing on z0. */
function radomeG(x, y, r, h, z0, rt = r, seg = 28) {
  const prof = [[r, 0], [rt, h - 0.02], [rt * 0.7, h - 0.004], [0.0001, h]];
  return lathe(prof, seg).rotateX(Math.PI / 2).translate(x, y, z0);
}
const circle = (x, y, r) => { const p = new THREE.Path(); p.absarc(x, y, r, 0, Math.PI * 2, true); return p; };

/** A helical element on the panel: base cup, mast, radome and conductor. */
function element(x, y, { h, r, rt = r, turns, quad = false, mat }) {
  const z0 = PANEL_Z;
  const metal = merge([cylG([x, y, z0 + 0.015], r + 0.008, 0.03, 'z', 24), cylG([x, y, z0 + 0.03 + (h - 0.07) / 2], 0.009, h - 0.07, 'z', 8)]);
  const wire = quad
    ? merge([0, 1, 2, 3].map((k) => helixG(x, y, Math.min(r, rt) - 0.015, z0 + 0.05, z0 + h - 0.02, turns, 0.004, (k * Math.PI) / 2)))
    : helixG(x, y, r - 0.018, z0 + 0.04, z0 + h - 0.03, turns, 0.0032, 0, rt - 0.012);
  return [mesh(metal, G.aluminium()), mesh(radomeG(x, y, r, h, z0 + 0.03, rt), mat), mesh(wire, G.helixWire())];
}

export function buildAntennas(P) {
  const A = DECK_AT;
  // ------------------------------------------------------------------ support frame, panel, feed networks
  const struts = [];
  const strutAt = [[1.0, -0.78], [1.0, 0.78], [0.45, 0.0], [0.4, -0.78], [0.4, 0.78], [-0.2, -0.78], [-0.3, 0.78], [-0.75, 0.78], [-1.18, 0.75], [-1.18, -0.15], [-0.75, -0.38], [1.3, 0.05], [-0.15, 0.0]];
  for (const [x, y] of strutAt) struts.push(cylG([x, y, (DECK + PANEL_Z - PANEL_T) / 2], 0.014, PANEL_Z - PANEL_T - DECK, 'z', 10), cylG([x, y, DECK + 0.004], 0.03, 0.008, 'z', 12));
  P('Antenna support frame', {
    system: 'Structure', material: 'Carbon-fibre posts with titanium end fittings', mass: 9, count: 13, temp: 250, explode: [0, 0, 1.85],
    desc: 'Stands the L-band antenna panel off the Earth deck so the beam-forming and crosslink feed networks fit underneath, and holds the array\'s pointing to the spacecraft axes. Geometry estimated.',
  }, mesh(merge(struts), G.cfrp(2)));

  const holes = [rectHole(A.esa[0], A.esa[1], 0.3, 0.36), rectHole(A.lra[0], A.lra[1], 0.44, 0.44), rectHole(A.scot[0], A.scot[1], 0.3, 0.23), rectHole(A.hpeSensor[0], A.hpeSensor[1], 0.18, 0.18),
    circle(A.fwdMast[0], A.fwdMast[1], 0.065), circle(A.hpeS[0], A.hpeS[1], 0.07)];
  P('L-band antenna panel', {
    system: 'Payload', material: 'Black-finished aluminium honeycomb ground plane', mass: 38, temp: 245, explode: [0, 0, 2.05],
    desc: 'Ground plane of the navigation antennas, about 2.4 × 1.8 m and covering nearly the whole Earth deck, with a tab at each end. Its 12 Earth-coverage helices broadcast every civil and military signal to the whole visible Earth; the four M-code elements sit at the −X end. SV01\'s published calibration puts the L1 phase centre 1.232 m above the centre of mass, and IGS orbit fits agreed to 2 mm.',
    callout: true, anchor: [1.36, -0.08, PANEL_Z],
  }, mesh(plateG(PANEL_OUTLINE, PANEL_T, PANEL_Z - PANEL_T, holes), G.blackPaint()));

  const bfn = [cylG([ARRAY_C[0], ARRAY_C[1], DECK + 0.03], 0.2, 0.03, 'z', 40)];
  for (const [x, y] of [...EC_INNER, ...EC_OUTER]) {
    const a = Math.atan2(y - ARRAY_C[1], x - ARRAY_C[0]), r0 = 0.18;
    bfn.push(pipeG([[ARRAY_C[0] + Math.cos(a) * r0, ARRAY_C[1] + Math.sin(a) * r0, DECK + 0.042], [x, y, DECK + 0.042], [x, y, PANEL_Z - PANEL_T]], 0.007));
  }
  const mc = [-1.0, 0.02];
  bfn.push(boxG([mc[0], mc[1], DECK + 0.03], [0.16, 0.16, 0.03]));
  for (const [x, y] of MEC) bfn.push(pipeG([[mc[0] + (x - mc[0]) * 0.4, mc[1] + (y - mc[1]) * 0.4, DECK + 0.045], [x, y, DECK + 0.045], [x, y, PANEL_Z - PANEL_T]], 0.007));
  bfn.push(pipeG([[ARRAY_C[0] - 0.2, 0.02, DECK + 0.03], [mc[0] + 0.08, 0.02, DECK + 0.03]], 0.009));
  P('Beam-forming network', {
    system: 'Payload', material: 'Coaxial power dividers and phase-trimmed cables', mass: 15, temp: 270, explode: [0, 0, 1.95],
    desc: 'Splits each signal twelve ways and sets the phase of the inner and outer elements, shaping the beam so a receiver at the Earth\'s edge, about 5,600 km farther away than one directly below (roughly 2 dB more path loss), still gets nearly the same signal strength. A branch feeds the four M-code elements.',
  }, mesh(merge(bfn), G.connector()));

  // ------------------------------------------------------------------ Earth-coverage and M-code helices (black, tapered)
  const EC = { h: 0.35, r: 0.06, rt: 0.034, turns: 6, mat: G.radomeBlack() };
  EC_INNER.forEach(([x, y], k) => P(`L-band helix, inner ${k + 1}`, {
    system: 'Payload', material: 'Tapered copper helix on a dielectric support inside a black tapered radome', mass: 1.8, temp: 240, explode: [(x - ARRAY_C[0]) * 0.4, y * 0.4, 2.35],
    desc: 'One of the four central Earth-coverage elements, about 0.17 m from the array centre. An axial-mode helix about one wavelength round (19 cm at L1) radiates right-hand circularly polarised waves; each element carries L1, L2 and L5 at once, at more than 300 W of continuous RF per antenna (patent figure). Element dimensions estimated.',
  }, element(x, y, EC)));
  EC_OUTER.forEach(([x, y], k) => P(`L-band helix, outer ${k + 1}`, {
    system: 'Payload', material: 'Tapered copper helix on a dielectric support inside a black tapered radome', mass: 1.8, temp: 240, explode: [(x - ARRAY_C[0]) * 0.4, y * 0.4, 2.3],
    desc: 'One of eight ring elements of the Earth-coverage array, about 0.53 m from its centre. Fed with a phase offset from the central four, the ring pushes power out toward the limb so the beam covers the whole Earth disc, 13.9° either side of nadir (element dimensions estimated).',
  }, element(x, y, EC)));
  const MECE = { h: 0.3, r: 0.058, rt: 0.034, turns: 5.5, mat: G.radomeBlack() };
  MEC.forEach(([x, y], k) => P(`M-code helix ${k + 1}`, {
    system: 'Payload', material: 'Tapered copper helix in a black radome', mass: 1.6, temp: 240, explode: [-0.35, (y - 0.02) * 0.8, 2.3],
    desc: 'One of four military Earth-coverage (MEC) elements in the group at the −X end of the antenna panel. They add M-code power for military users: GPS III delivers M-code at no less than −153 dBW at 5° elevation, against −158 dBW for Block IIR and IIF (element size estimated).',
  }, element(x, y, MECE)));

  // ------------------------------------------------------------------ UHF crosslink elements (white cylinders), interleaved
  const UHF = { h: 0.45, r: 0.08, turns: 0.75, quad: true, mat: G.radome() };
  const uhf = (name, x, y, inner) => P(name, {
    system: 'Communications', material: 'Quadrifilar helix in a white fibreglass radome', mass: 2.4, temp: 245, explode: [(x - ARRAY_C[0]) * 0.55, y * 0.55, 2.2],
    desc: inner
      ? 'One of the four inner UHF crosslink elements (about 0.36 m from the array centre), interleaved with the L-band helices as the GPS III patent drawing shows: satellites exchange data and measure the distances between each other over these links. The form of each element (here a quadrifilar helix) is an estimate.'
      : 'One of eight outer-ring UHF crosslink elements; the ring is about 1.66 m across, almost the full 1.78 m deck depth. Placing crosslink elements among high-power L-band helices raises the risk of passive intermodulation, one reason Lockheed and Northrop Grumman have patented other layouts (element form estimated).',
  }, element(x, y, UHF));
  UHF_INNER.forEach(([x, y], k) => uhf(`UHF crosslink element, inner ${k + 1}`, x, y, true));
  UHF_OUTER.forEach(([x, y], k) => uhf(`UHF crosslink element, outer ${k + 1}`, x, y, false));
  // UHF feed ring under the panel and a trunk down to the two crosslink transponders on the −Y panel
  const uf = [], fr = [], RR = 0.63, zf = DECK + 0.028;
  for (let k = 0; k <= 56; k++) { const a = (k / 56) * Math.PI * 2; fr.push([ARRAY_C[0] + Math.cos(a) * RR, ARRAY_C[1] + Math.sin(a) * RR, zf]); }
  uf.push(pipeG(fr, 0.008));
  for (const [x, y] of [...UHF_INNER, ...UHF_OUTER]) {
    const a = Math.atan2(y - ARRAY_C[1], x - ARRAY_C[0]);
    uf.push(pipeG([[ARRAY_C[0] + Math.cos(a) * RR, ARRAY_C[1] + Math.sin(a) * RR, zf], [x, y, zf], [x, y, PANEL_Z - PANEL_T]], 0.006));
  }
  const ya = -0.62, xa = -0.84;
  const ectsA = onBUS(BUS.ectsA.c, BUS.ectsA.s[1]), ectsB = onBUS(BUS.ectsB.c, BUS.ectsB.s[1]);
  uf.push(pipeG([[ARRAY_C[0] - 0.22, -0.59, zf], [ARRAY_C[0] - 0.22, ya, zf], [xa, ya, zf], [xa, ya, 1.55], [xa, ya, ectsA[2] + 0.17], [ectsA[0] + 0.1, ectsA[1] + 0.02, ectsA[2] + 0.17], [ectsA[0] + 0.1, ectsA[1] + 0.02, ectsA[2] + 0.13]], 0.011));
  uf.push(pipeG([[xa, ya, ectsA[2] + 0.17], [xa, ya, ectsB[2] + 0.165], [ectsB[0] + 0.1, ectsB[1] + 0.06, ectsB[2] + 0.165], [ectsB[0] + 0.1, ectsB[1] + 0.06, ectsB[2] + 0.13]], 0.009));
  P('UHF feed network', {
    system: 'Communications', material: 'Coaxial cables, hybrid combiners', mass: 6, temp: 270, explode: [0, -0.4, 1.4],
    desc: 'Combines the twelve UHF elements and carries the crosslink signal through the Earth deck to the redundant pair of crosslink transponders (ECTS) on the bus panel (routing estimated).',
  }, mesh(merge(uf), G.connector()));

  // ------------------------------------------------------------------ deployable JIB monopoles
  const rods = [];
  JIB_POS.forEach(([x, y], k) => {
    const can = merge([boxG([x, y, PANEL_Z + 0.033], [0.1, 0.1, 0.065]), cylG([x, y, PANEL_Z + 0.07], 0.022, 0.012, 'z', 14)]);
    const pivot = new THREE.Group();
    pivot.position.set(x, y, PANEL_Z + 0.075);
    const rod = mesh(merge([cylG([0, 0, JIB_L / 2], 0.0065, JIB_L, 'z', 8), cylG([0, 0, JIB_L], 0.01, 0.012, 'z', 8)]), G.stem());
    pivot.add(rod);
    rods.push(pivot);
    P(`JIB antenna ${k + 1}`, {
      system: 'Communications', material: 'Stored-energy STEM monopole in an aluminium canister', mass: 0.7, temp: 250, explode: [Math.sign(x) * 0.15, Math.sign(y) * 0.15, 2.0],
      desc: k === 0
        ? 'One of eight "Jack-in-the-Box" deployable monopoles (Northrop Grumman Astro Aerospace). Stowed in a canister about 10 × 10 × 6 cm, each springs out in about 200 ms once the satellite is on station, and together they form an RF antenna array whose user is not public. Their length and positions are not public either; 0.5 m rods are shown.'
        : 'Deployable JIB monopole antenna, one of eight that together form an RF array. Northrop Grumman has delivered more than 1,000 JIB assemblies for GPS IIR, IIF and III (rod length and position estimated).',
    }, [mesh(can, G.alodine()), pivot]);
  });

  // ------------------------------------------------------------------ TT&C S-band antennas and the second mast
  const mast = (name, [x, y], H, desc, ex, extra = {}) => {
    const metal = merge([cylG([x, y, DECK + 0.01], 0.06, 0.02, 'z', 18), cylG([x, y, DECK + 0.05], 0.035, 0.06, 'z', 14), cylG([x, y, DECK + (H * 0.78) / 2], 0.022, H * 0.78, 'z', 12),
      cylG([x, y, DECK + H * 0.4], 0.03, 0.025, 'z', 12)]);
    const tip = merge([cylG([x, y, DECK + H * 0.78 + (H * 0.22) / 2], 0.036, H * 0.22, 'z', 16), cylG([x, y, DECK + H + 0.008], 0.024, 0.016, 'z', 12)]);
    return P(name, { system: 'Communications', material: 'Composite mast with a radiating element under a black radome', mass: 2.2, temp: 245, explode: ex, desc, ...extra }, [mesh(metal, G.satinTi()), mesh(tip, G.radomeBlack())]);
  };
  mast('Forward TT&C S-band antenna', A.fwdMast, 1.05, 'Lockheed\'s figure labels a "Fwd TT&C S-band Antenna" on a mast at this edge of the Earth deck (which of the two masts it is, is not certain). It carries commands, telemetry and ranging with the Air Force Satellite Control Network over SGLS, or with Unified S-Band stations; standing about 1 m clear of the elements gives it a clean pattern (height from the scale model).',
    [0, 0.25, 2.1], { callout: true, anchor: [A.fwdMast[0], A.fwdMast[1], DECK + 1.0] });
  mast('Antenna mast (+X, −Y corner)', A.mast2, 0.9, 'A second mast, about 0.9 m tall in the scale model, that Lockheed\'s figure labels only "Antenna". The block diagram lists several hosted-payload antennas beside the TT&C ones; which this is, is not public.', [0.3, -0.3, 2.0]);
  const [axa, aya] = AFT_ANT;
  P('Aft TT&C S-band antenna', {
    system: 'Communications', material: 'Conical-spiral element in a radome', mass: 1.5, temp: 230, explode: [0.4, 0.3, -1.95],
    desc: 'The second TT&C antenna, at an aft corner of the core base (Fig. 4), facing away from the Earth. With the forward antenna it lets the ground command the satellite in any attitude, essential while it reorients for the apogee burns (downlink ≈ 2,227.5 MHz).',
  }, [mesh(merge([cylG([axa, aya, AFT - 0.02], 0.06, 0.04, 'z', 20), cylG([axa, aya, AFT - 0.055], 0.012, 0.03, 'z', 8)]), G.aluminium()), mesh(cylG([axa, aya, AFT - 0.135], 0.02, 0.13, 'z', 24, 0.075), G.radome())]);

  // ------------------------------------------------------------------ stowed antenna on the +X face
  const sx0 = HX + 0.075, sy0 = 0.22, z0 = -1.05, z1 = 0.95;
  const sm = [cylG([sx0, sy0, (z0 + z1) / 2], 0.025, z1 - z0, 'z', 14)];
  for (const z of [-0.55, -0.05, 0.45]) sm.push(cylG([sx0, sy0, z], 0.045, 0.12, 'z', 14));
  sm.push(cylG([sx0, sy0, z1 + 0.05], 0.035, 0.1, 'z', 14));
  const brk = [];
  for (const z of [-0.85, 0.0, 0.8]) brk.push(pipeG([[sx0, sy0, z], [HX + 0.03, 0.5, z], [HX + 0.014, 0.58, z]], 0.012, 8), boxG([HX + 0.017, 0.6, z], [0.01, 0.07, 0.07]));
  brk.push(boxG([sx0, sy0, z0 - 0.04], [0.07, 0.07, 0.08]), cylG([sx0, sy0 + 0.05, z0 - 0.04], 0.018, 0.04, 'y', 10));
  P('Stowed antenna (+X)', {
    system: 'Communications', material: 'Composite mast with element fittings; titanium launch-lock brackets', mass: 6, temp: 380, explode: [1.0, 0.1, 0],
    desc: 'A mast about 2 m long folded along the Sun-side face for launch, with element fittings along it. Lockheed\'s expanded view calls it the "Stowed Antenna (−X)" in its own axes, which is +X in the IGS axes used here (the scale model shows its stand-off fittings on this face). Its function and how it deploys are not given in the source, so it is shown stowed (length and position estimated).',
  }, [mesh(merge(sm), G.radome()), mesh(merge(brk), G.satinTi())]);

  // ------------------------------------------------------------------ hosted-payload antennas
  const [hx, hy] = A.hpeS;
  P('HPE S-band antenna', {
    system: 'Payload', material: 'Conical-spiral element in a radome (generic)', mass: 1.2, temp: 245, explode: [0.25, 0.2, 2.0],
    desc: 'The hosted-payload "S-band Antenna" that Lockheed\'s figure places near the hosted-payload sensor at the +X/+Y end of the deck, separate from the TT&C antennas. Its use is not described publicly (form and size estimated).',
  }, [mesh(merge([cylG([hx, hy, DECK + 0.05], 0.05, 0.1, 'z', 18)]), G.aluminium()), mesh(cylG([hx, hy, DECK + 0.17], 0.06, 0.14, 'z', 22, 0.02), G.radome())]);
  const [rx, ry] = A.hpeRx;
  P('HPE receive antenna', {
    system: 'Payload', material: 'Cavity-backed element (generic)', mass: 1.0, temp: 245, explode: [0.45, 0, 2.0],
    desc: 'The block diagram lists a hosted-payload receive antenna among the antenna elements. The burst detector records electromagnetic pulses in specific bands, which needs a receiving antenna; this generic unit on the panel\'s +X tab stands in for it (identification, form and position estimated).',
  }, [mesh(boxG([rx, ry, PANEL_Z + 0.03], [0.13, 0.13, 0.06]), G.whitePaint()), mesh(new THREE.SphereGeometry(0.055, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(rx, ry, PANEL_Z + 0.06), G.radome())]);

  /** Rods stowed at d = 0 (inside their canisters), out at d = 1; they spring out once on station. */
  const setJIB = (d) => {
    const s = THREE.MathUtils.smoothstep(d, 0.55, 0.95);
    for (const r of rods) { r.scale.set(1, 1, Math.max(0.02, s)); r.visible = s > 0.03; }
  };
  reg([hx, hy, IZ - 0.02], 'deck');
  reg([rx, ry, IZ - 0.02], 'deck');
  return { setJIB };
}

export { HX, HY, IY, IZ };
