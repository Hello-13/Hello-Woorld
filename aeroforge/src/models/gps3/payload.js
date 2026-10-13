// GPS III navigation payload (L3Harris): the L-band helix array and its feed network, the three
// rubidium clocks, the Mission Data Unit and L-band transmitters; the hosted nuclear-detonation
// sensors; the laser retroreflector array; crosslink and telemetry antennas and radios.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { lathe } from '../../engine/geometry.js';
import { G } from './materials.js';
import { HX, HY, HZ, IX, IY, IZ, boxG, cylG, merge, unit, pipeG } from './kit.js';

export const DECK = HZ + 0.012;           // top of the Earth-deck blanket
export const PANEL_Z = DECK + 0.085;      // top of the L-band antenna panel
const PANEL_R = 0.68;

/** Helical conductor of radius r between z0 and z1, centred on (x, y). */
function helixG(x, y, r, z0, z1, turns, wire = 0.0032, phase = 0) {
  const pts = [];
  const n = Math.ceil(turns * 18);
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = phase + t * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(x + Math.cos(a) * r, y + Math.sin(a) * r, z0 + (z1 - z0) * t));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, wire, 5, false);
}

/** Radome: a cylinder with a shallow dome, height h, standing on z0. */
function radomeG(x, y, r, h, z0, seg = 28) {
  const prof = [[r, 0], [r, h - 0.03], [r * 0.72, h - 0.008], [0.0001, h]];
  return lathe(prof, seg).rotateX(Math.PI / 2).translate(x, y, z0);
}

export function buildPayload(P) {
  // ------------------------------------------------------------------ L-band antenna: support frame, panel, beam-forming network
  const struts = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    struts.push(cylG([Math.cos(a) * 0.56, Math.sin(a) * 0.56, DECK + 0.035], 0.014, 0.07, 'z', 10));
  }
  struts.push(cylG([0, 0, DECK + 0.004], 0.6, 0.008, 'z', 64, 0.6), cylG([0, 0, DECK + 0.004], 0.36, 0.008, 'z', 48, 0.36));
  P('Antenna support frame', {
    system: 'Structure', material: 'Carbon-fibre struts and ring', mass: 10, temp: 250, explode: [0, 0, 1.85],
    desc: 'Stands the L-band antenna panel off the Earth deck so its beam-forming network fits underneath, and holds the array\'s pointing to the spacecraft axes. Geometry estimated.',
  }, mesh(merge(struts), G.cfrp(2)));

  const panel = merge([
    cylG([0, 0, PANEL_Z - 0.015], PANEL_R, 0.03, 'z', 72),
    cylG([0, 0, PANEL_Z - 0.032], PANEL_R - 0.02, 0.006, 'z', 72),
  ]);
  P('L-band antenna panel', {
    system: 'Payload', material: 'White-painted aluminium honeycomb ground plane', mass: 38, temp: 245, explode: [0, 0, 2.05],
    desc: 'Ground plane for the twelve L-band helices that broadcast every GPS signal to the whole visible Earth. GPS III keeps the two-ring, 12-helix layout of the Block IIR/IIR-M panel (four inner, eight outer); its exact element design is not public. Diameter estimated at 1.36 m.',
    callout: true, anchor: [PANEL_R * 0.72, -PANEL_R * 0.72, PANEL_Z],
  }, mesh(panel, G.whitePaint()));

  const bfn = [cylG([0, 0, DECK + 0.03], 0.46, 0.03, 'z', 48)];
  const inner = [0, 1, 2, 3].map((k) => (k / 4) * Math.PI * 2 + Math.PI / 4);
  const outer = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => (k / 8) * Math.PI * 2 + Math.PI / 8);
  for (const a of inner) bfn.push(pipeG([[Math.cos(a) * 0.12, Math.sin(a) * 0.12, DECK + 0.05], [Math.cos(a) * 0.22, Math.sin(a) * 0.22, DECK + 0.05], [Math.cos(a) * 0.22, Math.sin(a) * 0.22, PANEL_Z - 0.03]], 0.008));
  for (const a of outer) bfn.push(pipeG([[Math.cos(a) * 0.4, Math.sin(a) * 0.4, DECK + 0.05], [Math.cos(a) * 0.52, Math.sin(a) * 0.52, DECK + 0.05], [Math.cos(a) * 0.52, Math.sin(a) * 0.52, PANEL_Z - 0.03]], 0.008));
  bfn.push(pipeG([[0.3, 0.6, IZ - 0.02], [0.3, 0.6, DECK + 0.02], [0.2, 0.4, DECK + 0.03]], 0.012));
  P('Beam-forming network', {
    system: 'Payload', material: 'Coaxial power dividers and phase-trimmed cables', mass: 16, temp: 270, explode: [0, 0, 1.95],
    desc: 'Splits each transmitter\'s output twelve ways and sets the phase between the inner and outer rings, shaping the beam so a receiver at the Earth\'s edge — about 5,600 km farther away than one directly below, roughly 2 dB more path loss — still gets nearly the same signal strength.',
  }, [mesh(merge(bfn), G.connector())]);

  // ------------------------------------------------------------------ twelve L-band helices
  const helix = (name, x, y, h, ex, ring) => {
    const z0 = PANEL_Z;
    const metal = merge([cylG([x, y, z0 + 0.015], 0.074, 0.03, 'z', 24), cylG([x, y, z0 + 0.03 + (h - 0.07) / 2], 0.009, h - 0.07, 'z', 8)]);
    return P(name, {
      system: 'Payload', material: 'Copper helix on a dielectric support inside a fibreglass radome', mass: 2, temp: 240, explode: ex,
      desc: ring === 'inner'
        ? 'One of four inner-ring helical elements. An axial-mode helix about one wavelength round (19 cm at L1) radiates right-hand circularly polarised waves. Each element radiates L1, L2 and L5 together; how the bands are combined at the element is not public (element dimensions estimated).'
        : 'One of eight outer-ring helices. Fed with a phase offset from the inner ring, the outer ring pushes power out toward the limb so the beam covers the whole Earth disc, 13.9° either side of nadir (element dimensions estimated).',
    }, [mesh(metal, G.aluminium()), mesh(radomeG(x, y, 0.062, h, z0 + 0.03), G.radome()), mesh(helixG(x, y, 0.042, z0 + 0.04, z0 + h - 0.02, Math.round((h - 0.06) / 0.048)), G.helixWire())]);
  };
  inner.forEach((a, k) => helix(`L-band helix, inner ${k + 1}`, Math.cos(a) * 0.22, Math.sin(a) * 0.22, 0.34, [Math.cos(a) * 0.15, Math.sin(a) * 0.15, 2.3], 'inner'));
  outer.forEach((a, k) => helix(`L-band helix, outer ${k + 1}`, Math.cos(a) * 0.52, Math.sin(a) * 0.52, 0.44, [Math.cos(a) * 0.35, Math.sin(a) * 0.35, 2.25], 'outer'));

  // ------------------------------------------------------------------ payload electronics on the +Y radiator (inner face y = IY)
  const at = (d) => IY - d / 2;
  P('Mission Data Unit', {
    system: 'Payload', material: 'Aluminium chassis, radiation-hardened processors', mass: 52, temp: 300, explode: [0, 1.2, 0],
    desc: 'L3Harris\'s signal generator, the heart of the navigation payload: a largely (about 70 %) digital unit that builds every ranging code and navigation message from the clock reference. It enables accuracy about three times better than earlier GPS satellites.',
    callout: true, anchor: [0.36, at(0.2) - 0.1, 0.94],
  }, unit([0.36, at(0.2), 0.78], [0.46, 0.2, 0.32], G.alodine(), { mount: '+y', conn: '-y', n: 6, fins: 6 }));

  P('Clock baseplate', {
    system: 'Thermal control', material: 'Aluminium plate with heaters and thermostats', mass: 7, temp: 293, explode: [0, 1.25, 0],
    desc: 'A temperature-controlled mounting plate for the three clocks. A rubidium standard\'s frequency shifts slightly with temperature, so the plate holds them to a fraction of a degree as the satellite swings between sunlight and eclipse.',
  }, mesh(boxG([-0.42, IY - 0.01, 0.78], [0.62, 0.02, 0.42]), G.silverBox()));
  [-0.62, -0.42, -0.22].forEach((x, k) => {
    const pkg = unit([x, IY - 0.02 - 0.075, 0.78], [0.15, 0.15, 0.3], G.silverBox(), { mount: '+y', conn: '-z', n: 2 });
    pkg.push(mesh(cylG([x, IY - 0.02 - 0.075 - 0.075 - 0.035, 0.84], 0.045, 0.07, 'y', 20), G.alodine()));
    P(`Rubidium atomic clock ${k + 1}`, {
      system: 'Payload', material: 'Rubidium lamp, absorption cell and quartz oscillator (Excelitas RAFS)', mass: 8, temp: 293, explode: [0, 1.15, 0],
      desc: k === 0
        ? 'Rubidium atomic frequency standard. It locks a quartz oscillator to the 6.834 682 6 GHz hyperfine transition of rubidium-87 and drifts only a few parts in 10¹⁴ over a day — a few nanoseconds. One clock runs the payload; the other two are spares.'
        : 'One of the three rubidium atomic frequency standards. A one-nanosecond clock error is a 30 cm range error, so the spares are kept ready to take over (mass estimated).',
      callout: k === 0, anchor: [x, IY - 0.17, 0.95],
    }, pkg);
  });
  P('Frequency synthesiser', {
    system: 'Payload', material: 'Aluminium chassis, phase-locked synthesisers', mass: 12, temp: 298, explode: [0, 1.2, 0],
    desc: 'Turns the active clock\'s output into the 10.23 MHz reference that every GPS code and carrier is a multiple of: L1 = 154 × 10.23 MHz, L2 = 120 ×, L5 = 115 ×.',
  }, unit([-0.42, at(0.15), 0.38], [0.44, 0.15, 0.16], G.alodine(), { mount: '+y', conn: '-z', n: 4 }));
  const tx = (name, x, z, desc) => P(name, {
    system: 'Payload', material: 'High-power L-band amplifier, aluminium heat-sink chassis', mass: 30, temp: 305, explode: [0, 1.2, 0], desc,
  }, unit([x, at(0.2), z], [0.44, 0.2, 0.24], G.blackBox(), { mount: '+y', conn: '+z', n: 3, fins: 8 }));
  tx('L1 transmitter', 0.36, 0.36, 'Amplifies the 1575.42 MHz carrier holding the civil C/A and L1C signals and the military P(Y) and M-code. GPS III raises the transmitted power, which with M-code improves anti-jam capability up to eightfold (amplifier type and mass estimated).');
  tx('L2 transmitter', 0.36, 0.06, 'Amplifies 1227.60 MHz: the civil L2C signal plus P(Y) and M-code. Two frequencies let a receiver measure and remove the ionosphere\'s delay, which scales with 1/f².');
  tx('L5 transmitter', -0.42, 0.06, 'Amplifies 1176.45 MHz, the civil safety-of-life signal in a protected aeronautical band, with a 10.23 Mchip/s code ten times faster than C/A for sharper ranging.');

  // output multiplexer under the Earth deck (inner face z = IZ)
  const omux = [boxG([0.35, 0.75, IZ - 0.012], [0.38, 0.2, 0.024])];
  for (let i = 0; i < 6; i++) omux.push(cylG([0.21 + (i % 3) * 0.14, 0.7 + Math.floor(i / 3) * 0.1, IZ - 0.024 - 0.065], 0.034, 0.13, 'z', 16));
  P('L-band output multiplexer', {
    system: 'Payload', material: 'Silver-plated invar filter cavities', mass: 20, temp: 300, explode: [0, 0.6, 1.0],
    desc: 'Filters and combines the L1, L2 and L5 transmitter outputs (and the L3 detection-system link at 1381.05 MHz) onto the single antenna feed, keeping each signal inside its allocated band.',
  }, [mesh(merge(omux), G.silverBox())]);

  // ------------------------------------------------------------------ nuclear detonation detection system (hosted)
  const nds = [boxG([-0.46, 0.8, DECK + 0.06], [0.24, 0.15, 0.12])];
  const ndsLens = [cylG([-0.52, 0.8, DECK + 0.125], 0.03, 0.012, 'z', 18), cylG([-0.4, 0.8, DECK + 0.125], 0.022, 0.012, 'z', 18), cylG([-0.4, 0.84, DECK + 0.125], 0.012, 0.012, 'z', 12)];
  P('NDS sensor package', {
    system: 'Payload', material: 'Optical, X-ray and EMP sensor heads (generic)', mass: 40, temp: 260, explode: [0, 0, 1.9],
    desc: 'Hosted sensors of the US Nuclear Detonation Detection System, flown on GPS since the early 1980s: optical (bhangmeter), X-ray and EMP sensors watch for the signatures of a nuclear explosion anywhere on Earth, supporting test-ban treaty monitoring. Their real layout is not public, so this is a generic stand-in.',
  }, [mesh(merge(nds), G.alodine()), mesh(merge(ndsLens), G.lens())]);
  P('NDS processor', {
    system: 'Payload', material: 'Aluminium chassis', mass: 22, temp: 298, explode: [0, 1.2, 0],
    desc: 'Processes the detection sensors\' data and sends reports to the ground on the L3 signal at 1381.05 MHz (135 × 10.23 MHz) and between satellites over the UHF crosslinks. Generic box; size and position estimated.',
  }, unit([-0.42, at(0.15), -0.24], [0.36, 0.15, 0.2], G.alodine(), { mount: '+y', conn: '-z', n: 3 }));

  // ------------------------------------------------------------------ laser retroreflector array (SV09 onward)
  const lraC = [-0.66, -0.74];
  const plate = [boxG([lraC[0], lraC[1], DECK + 0.02], [0.34, 0.26, 0.04])];
  const cubes = [];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 6; j++) {
    cubes.push(cylG([lraC[0] - 0.14 + i * 0.04, lraC[1] - 0.1 + j * 0.04, DECK + 0.038], 0.0185, 0.006, 'z', 12));
  }
  P('Laser retroreflector array', {
    system: 'Payload', material: '48 fused-silica corner cubes in an aluminium plate', mass: 10, count: 48, temp: 250, explode: [-0.2, -0.2, 1.9],
    desc: 'NASA / Naval Research Laboratory array of 48 recessed corner cubes, each 4.09 cm across, that return ground-station laser pulses straight back so the satellite\'s range is measured to millimetres — an independent check on the orbit in the navigation message. First flown on GPS III SV09 (launched January 2026); SV01–SV08 do not carry it.',
    callout: true, anchor: [lraC[0], lraC[1], DECK + 0.05],
  }, [mesh(merge(plate), G.aluminium()), mesh(merge(cubes), G.prism())]);

  // ------------------------------------------------------------------ UHF crosslink
  const uhfC = [0.66, 0.7], uhfH = 0.55, uhfR = 0.13;
  const uhfBase = merge([cylG([uhfC[0], uhfC[1], DECK + 0.02], uhfR + 0.02, 0.04, 'z', 32)]);
  const qha = [];
  for (let k = 0; k < 4; k++) qha.push(helixG(uhfC[0], uhfC[1], uhfR - 0.02, DECK + 0.05, DECK + uhfH - 0.02, 0.75, 0.005, (k * Math.PI) / 2));
  P('UHF crosslink antenna', {
    system: 'Communications', material: 'Quadrifilar helix in a fibreglass radome', mass: 9, temp: 245, explode: [0.25, 0.25, 1.9],
    desc: 'GPS satellites talk to each other over UHF crosslinks, relaying data and measuring the ranges between satellites. Modelled as a quadrifilar helix; its real size and position are estimates.',
    callout: true, anchor: [uhfC[0], uhfC[1], DECK + uhfH],
  }, [mesh(uhfBase, G.aluminium()), mesh(radomeG(uhfC[0], uhfC[1], uhfR, uhfH - 0.04, DECK + 0.04, 36), G.radome()), mesh(merge(qha), G.helixWire())]);
  P('UHF crosslink transceiver', {
    system: 'Communications', material: 'Aluminium chassis', mass: 14, temp: 300, explode: [0.6, 0.6, 1.0],
    desc: 'Transmits and receives on the crosslinks. Inter-satellite ranges let the constellation keep its orbit and clock estimates current even if ground uploads stop for a while.',
  }, unit([0.7, 0.45, IZ - 0.075], [0.22, 0.18, 0.15], G.alodine(), { mount: '+z', conn: '-x', n: 3 }));

  // ------------------------------------------------------------------ S-band telemetry, tracking and command
  const sAnt = (name, x, y, z0, dir, ex, desc) => {
    const s = Math.sign(dir);
    const metal = merge([cylG([x, y, z0 + s * 0.025], 0.05, 0.05, 'z', 20), cylG([x, y, z0 + s * 0.06], 0.012, 0.03, 'z', 8)]);
    const cone = cylG([x, y, z0 + s * 0.13], s > 0 ? 0.075 : 0.02, 0.12, 'z', 24, s > 0 ? 0.02 : 0.075);
    return P(name, { system: 'Communications', material: 'Conical-spiral element in a radome', mass: 1.5, temp: 240, explode: ex, desc }, [mesh(metal, G.aluminium()), mesh(cone, G.radome())]);
  };
  sAnt('S-band antenna (Earth side)', 0.76, -0.62, DECK, 1, [0.2, -0.2, 1.9], 'Telemetry, tracking and command antenna facing the Earth. Ground antennas of the Space Force control segment send commands and navigation uploads on S-band (Space-Ground Link System, uplink ≈ 1,783.74 MHz).');
  sAnt('S-band antenna (aft)', 0.74, 0.02, -HZ - 0.012, -1, [0.3, 0, -1.9], 'The second TT&C antenna, on the anti-Earth side, so the satellite can be commanded in any attitude — essential while it tumbles or reorients for apogee burns (downlink ≈ 2,227.5 MHz).');
  const xp = (name, z, ex) => P(name, {
    system: 'Communications', material: 'Aluminium chassis', mass: 8, temp: 298, explode: ex,
    desc: 'One of a redundant pair of S-band transponders: it demodulates and decrypts ground commands, returns telemetry and turns the ranging tones around so the ground can measure the satellite\'s distance.',
  }, unit([-0.4, -(IY - 0.065), z], [0.26, 0.13, 0.16], G.alodine(), { mount: '-y', conn: '+z', n: 3 }));
  xp('S-band transponder (A)', -0.16, [0, -1.2, 0]);
  xp('S-band transponder (B)', -0.38, [0, -1.2, 0]);
}

export { HX, HY, IX };
