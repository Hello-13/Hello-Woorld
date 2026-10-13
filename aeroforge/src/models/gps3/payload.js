// GPS III payloads, laid out after Lockheed Martin's expanded view (Marquis & Shaw 2011, Fig. 4):
// - Navigation payload element (L3Harris, formerly ITT) on the +Y "NPE panel": filters and the
//   L1/L2/L5 multiplexer at the top, the L1/L3/L5 transmitters on one side and L2 on the other, the
//   Mission Data Unit, three rubidium clocks and the fourth clock position at the aft end.
// - Network communications element (General Dynamics) on the −Y "Bus/NCE/HPE panel": two crosslink
//   transponders (ECTS), two thin communications units, two SUTs, the SSMA and STPX, two S-band
//   uplink/downlink units (TT&C).
// - Hosted payload element: the Sandia / Los Alamos Global Burst Detector of the nuclear detonation
//   detection system (sensors on the Earth deck, four processors on the −Y panel).
// - The laser retroreflector (SV09, SV10) and SV10's optical communications terminal.
// Box sizes and exact positions are estimates; the descs say what the source does and does not give.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { lathe } from '../../engine/geometry.js';
import { G } from './materials.js';
import { IY, IZ, HZ, DECK, AFT, boxG, cylG, merge, unit, pipeG, plateG, octagon, connPoint, reg } from './kit.js';
import { ARRAY_C, DECK_AT, BUS, onNPE, onBUS, AFT_ANT } from './layout.js';
import { PANEL_Z } from './antennas.js';

const COMPOSITE = 'The model shows a composite of the series: the burst detector flew on SV01–SV08 (Sandia\'s block of eight ended with SV08 on 30 May 2025), the laser retroreflector on SV09 and SV10.';

export function buildPayload(P) {
  /** A box on a panel; registers its harness landing on the payload or bus data bus. */
  const box = (name, info, c, s, mat, opts, side, power = false) => {
    reg(connPoint(c, s, opts.conn, 0.04), side, power);
    return P(name, info, unit(c, s, mat, opts));
  };
  const npe = (xz, s) => onNPE(xz, s[1]);
  const bus = (xz, s) => onBUS(xz, s[1]);

  // ================================================================== NAVIGATION PAYLOAD (+Y NPE panel)
  // ---- top: two filters and the multiplexer
  const FS = [0.15, 0.15, 0.2];
  const filt = (name, xz, desc, ex) => box(name, { system: 'Payload', material: 'Silver-plated invar cavity filter', mass: 2.5, temp: 300, explode: ex, desc }, npe(xz, FS), FS, G.silverBox(), { mount: '+y', conn: '-y', n: 2, fins: 3 }, 'npe');
  filt('Signal filter (A)', [-0.86, 1.42], 'One of the two "filter" units Lockheed\'s figure shows beside the multiplexer at the top of the panel. Filters keep each transmitter\'s output inside its allocated band, suppressing harmonics and spurious emissions; which signal passes through each is not stated (size estimated).', [0, 1.2, 0.1]);
  filt('Signal filter (B)', [-0.64, 1.42], 'The second "filter" unit at the top of the NPE panel. Invar cavities are used because invar barely expands with temperature, so the filters stay tuned as the panel warms and cools (size estimated).', [0, 1.2, 0.1]);
  const MUX = { c: [-0.15, 1.36], s: [0.42, 0.22, 0.26] };
  const muxC = npe(MUX.c, MUX.s);
  const cav = [];
  for (let i = 0; i < 6; i++) cav.push(cylG([muxC[0] - 0.14 + (i % 3) * 0.14, muxC[1] - 0.11 - 0.035, muxC[2] - 0.06 + Math.floor(i / 3) * 0.12], 0.034, 0.07, 'y', 16));
  reg(connPoint(muxC, MUX.s, '+z', 0.04), 'npe');
  P('L1/L2/L5 multiplexer', {
    system: 'Payload', material: 'Silver-plated invar filter cavities', mass: 18, temp: 300, explode: [0, 1.2, 0.15],
    desc: 'Combines the L1, L2 and L5 transmitter outputs onto the single feed of the L-band antenna (the block diagram\'s "L1, L2, L5 Multiplexer"); L3 has its own filter. Each channel is a chain of tuned cavities, so one antenna can radiate three carriers more than 100 MHz apart without the transmitters loading each other.',
  }, [...unit(muxC, MUX.s, G.silverBox(), { mount: '+y', conn: '+z', n: 3 }), mesh(merge(cav), G.silverBox())]);
  const L3F = { c: [0.4, 1.42], s: FS };
  box('L3 filter', {
    system: 'Payload', material: 'Silver-plated cavity filter', mass: 2.5, temp: 300, explode: [0, 1.2, 0.1],
    desc: 'The separate "L3 Filter" of the block diagram, between the L3 transmitter and the antenna feed. L3 (1381.05 MHz) carries the detection system\'s data, not navigation, so it is filtered and fed on its own path (size estimated).',
  }, npe(L3F.c, L3F.s), L3F.s, G.silverBox(), { mount: '+y', conn: '+z', n: 2, fins: 3 }, 'npe');

  // ---- middle: transmitters (L5, L3, L1 on the +X side, L2 on the −X side)
  const TXS = [0.44, 0.2, 0.24];
  const TX = {};
  const tx = (name, xz, desc, s = TXS, mass = 30) => {
    TX[name] = { c: npe(xz, s), s };
    return box(name, { system: 'Payload', material: 'Solid-state L-band power amplifiers, aluminium heat-sink chassis', mass, temp: 305, explode: [0, 1.15, 0], desc }, TX[name].c, s, G.blackBox(), { mount: '+y', conn: '-y', n: 3, fins: 5 }, 'npe', true);
  };
  tx('L5 transmitter', [0.62, 0.96], 'Amplifies 1176.45 MHz (115 × 10.23 MHz), the civil safety-of-life signal in a protected aeronautical band, with a 10.23 Mchip/s code ten times faster than C/A for sharper ranging (amplifier type and mass estimated).');
  tx('L3 transmitter', [0.62, 0.6], 'Carries the nuclear-detonation detection system\'s data down to the ground on 1381.05 MHz (135 × 10.23 MHz), through its own L3 filter. It is not a navigation signal (size and mass estimated).', [0.38, 0.18, 0.2], 18);
  tx('L1 transmitter', [0.62, 0.24], 'Amplifies the 1575.42 MHz carrier (154 × 10.23 MHz) that holds the civil C/A and L1C signals and the military P(Y) and M-code. Higher power is one reason GPS III gives military users up to eight times the anti-jam margin of earlier satellites (amplifier type and mass estimated).');
  tx('L2 transmitter', [-0.62, 0.7], 'Amplifies 1227.60 MHz (120 × 10.23 MHz): the civil L2C signal plus P(Y) and M-code. Two frequencies let a receiver measure and remove the ionosphere\'s delay, which scales with 1/f². Lockheed\'s figure puts it on the opposite side of the panel from the other three.');

  // ---- bottom: Mission Data Unit, clocks, fourth clock slot
  const MDU = { c: npe([-0.68, -1.2], [0.46, 0.22, 0.34]), s: [0.46, 0.22, 0.34] };
  box('Mission Data Unit', {
    system: 'Payload', material: 'Aluminium chassis, radiation-hardened processors', mass: 52, temp: 300, explode: [0, 1.15, 0],
    desc: 'L3Harris\'s payload computer, with the waveform generator first introduced on GPS IIR-M: a largely (about 70 %) digital unit that builds every ranging code and navigation message from the clock reference. Lockheed\'s figure puts it at the aft end of the NPE panel next to the clocks. GPS III must hold a 1.0 m user range error at 24 hours, three times better than Block IIR.',
  }, MDU.c, MDU.s, G.alodine(), { mount: '+y', conn: '+x', n: 5, fins: 6 }, 'npe', true);
  const CB = { x: 0.1, z: -1.22 };
  P('Clock baseplate', {
    system: 'Thermal control', material: 'Aluminium plate with heaters and thermostats', mass: 8, temp: 293, explode: [0, 1.25, 0],
    desc: 'A temperature-controlled mounting plate with four clock positions at the aft end of the NPE panel. A rubidium standard\'s frequency shifts slightly with temperature, so the plate holds the clocks to a fraction of a degree as the satellite swings between sunlight and eclipse.',
  }, mesh(boxG([CB.x, IY - 0.01, CB.z], [0.9, 0.02, 0.46]), G.silverBox()));
  const CLK_X = [-0.22, -0.01, 0.2];
  const CS = [0.15, 0.15, 0.3];
  const clockAt = (x) => [x, IY - 0.02 - 0.075, CB.z];
  /** Face of one of a clock package's two connectors (k 0: reference output, 1: power and telemetry), plus off. */
  const clkConn = (x, k, off = 0) => [x + (k ? 1 : -1) * CS[0] / 4, IY - 0.02 - 0.075, CB.z - CS[2] / 2 - 0.024 - off];
  CLK_X.forEach((x, k) => {
    const c = clockAt(x);
    const pkg = unit(c, CS, G.silverBox(), { mount: '+y', conn: '-z', n: 2 });
    pkg.push(mesh(cylG([x, c[1] - 0.075 - 0.03, CB.z + 0.06], 0.045, 0.06, 'y', 20), G.alodine()));
    reg(clkConn(x, 1, 0.028), 'npe', true);   // power and telemetry on the second connector
    P(`Rubidium atomic clock ${k + 1}`, {
      system: 'Payload', material: 'Rubidium lamp, absorption cell and quartz oscillator (Excelitas RAFS)', mass: 8, temp: 293, explode: [0, 1.1, 0],
      desc: k === 0
        ? 'Rubidium atomic frequency standard. It locks a quartz oscillator to the 6.834 682 6 GHz hyperfine transition of rubidium-87 and drifts only a few parts in 10¹⁴ over a day, a few nanoseconds. One clock drives the navigation signal while GPS III can run a second and monitor its stability, with redundant time-keeping loops, a first among GPS generations.'
        : 'One of the three rubidium atomic frequency standards. A one-nanosecond clock error is a 30 cm range error, so the spares are kept ready to take over (mass estimated).',
    }, pkg);
  });
  const dx = 0.42, dc = clockAt(dx);
  const drafs = unit(dc, CS, G.alodine(), { mount: '+y', conn: '-z', n: 2 });
  drafs.push(mesh(merge([boxG([dx, dc[1] - 0.085, CB.z + 0.07], [0.1, 0.02, 0.08])]), G.blackBox()));
  reg(clkConn(dx, 1, 0.028), 'npe', true);
  P('Digital rubidium clock (SV10)', {
    system: 'Payload', material: 'Rubidium physics package with digital control electronics', mass: 8, temp: 293, explode: [0, 1.1, 0],
    desc: 'GPS III was designed with a fourth clock position for new or experimental frequency standards, such as a hydrogen maser. Lockheed says SV10, launched on 21 April 2026, carries a demonstration Digital Rubidium Atomic Frequency Standard; that it sits in this fourth slot is an inference, and on SV01–SV09 the slot is empty.',
  }, drafs);

  // ---- clock reference cables: each clock to the Mission Data Unit
  const ck = [], yc = IY - 0.12;
  [...CLK_X, dx].forEach((x, i) => {
    const p = clkConn(x, 0), xc = p[0];
    const zr = -1.47 - i * 0.022;
    ck.push(pipeG([p, [xc, p[1], zr], [xc, yc - i * 0.012, zr], [MDU.c[0] + 0.25, yc - i * 0.012, zr], [MDU.c[0] + 0.25, yc - i * 0.012, MDU.c[2] - 0.12 + i * 0.06], [MDU.c[0] + MDU.s[0] / 2 + 0.01, yc - i * 0.012, MDU.c[2] - 0.12 + i * 0.06]], 0.005));
  });
  P('Clock reference cables', {
    system: 'Payload', material: 'Semi-rigid coaxial cable', mass: 1.2, count: 4, temp: 293, explode: [0, 1.0, 0],
    desc: 'Short coaxial runs that carry each clock\'s reference frequency to the Mission Data Unit, which derives every code and carrier from it. Their length and temperature are kept steady, because a 1 ns timing error is about 30 cm of range (routing estimated).',
  }, mesh(merge(ck), G.tubing()));

  P('TFU (NPE panel)', {
    system: 'Payload', material: 'Aluminium chassis', mass: 4, temp: 298, explode: [0, 1.15, 0],
    desc: 'A unit Lockheed\'s figure labels "TFU", low on the NPE panel beside the interface unit; a second TFU sits on the bus panel. The source does not expand the acronym or say what it does (size estimated).',
  }, unit(npe([0.86, -0.62], [0.2, 0.12, 0.15]), [0.2, 0.12, 0.15], G.alodine(), { mount: '+y', conn: '-y', n: 2 }));
  reg(connPoint(npe([0.86, -0.62], [0.2, 0.12, 0.15]), [0.2, 0.12, 0.15], '-y', 0.04), 'npe');

  // ---- L-band RF cables: transmitters → multiplexer / L3 filter → through the Earth deck → beam-forming network
  const rf = [], yr = IY - 0.235;
  // the three inputs enter the multiplexer's lower face, below its filter cavities (input ports drawn as short SMA-style bosses)
  const muxBot = muxC[2] - MUX.s[2] / 2;
  const muxIn = (k) => [muxC[0] - 0.13 + k * 0.13, muxC[1] - 0.04, muxBot - 0.012];
  const ports = [];
  [['L1 transmitter', 0], ['L5 transmitter', 1], ['L2 transmitter', 2]].forEach(([n, k]) => {
    const { c, s } = TX[n];
    const p = [c[0] - s[0] / 2 + 0.06, c[1] - s[1] / 2 - 0.012, c[2]], m = muxIn(k);
    // L1's cable climbs in front of the L3 and L5 boxes, so L5's runs between L1's and its own box face
    const yy = k === 1 ? yr + 0.018 : yr - k * 0.014, zr = muxBot - 0.07 - k * 0.022;
    rf.push(pipeG([p, [p[0], yy, p[2]], [p[0], yy, zr], [m[0], yy, zr], [m[0], m[1], zr], m], 0.007));
    ports.push(cylG([m[0], m[1], muxBot - 0.006], 0.013, 0.012, 'z', 10));
  });
  rf.push(...ports);
  {
    const { c, s } = TX['L3 transmitter'];
    const p = [c[0] + s[0] / 2 - 0.06, c[1] - s[1] / 2 - 0.012, c[2]], f = npe(L3F.c, L3F.s);
    const yf = yr + 0.03;   // across to the filter outboard of the transmitters' power drops
    rf.push(pipeG([p, [p[0], yr, p[2]], [p[0], yr, f[2] - 0.13], [p[0], yf, f[2] - 0.13], [f[0], yf, f[2] - 0.13], [f[0], f[1] - 0.09, f[2] - 0.13], [f[0], f[1] - 0.09, f[2] - 0.1]], 0.007));
  }
  const zA = DECK + 0.035;
  // the multiplexer's output leaves its −X top connector (the middle one carries telemetry), clear of the UHF element above
  const mo = [muxC[0] - MUX.s[0] / 3, muxC[1], muxC[2] + MUX.s[2] / 2], fo = connPoint(npe(L3F.c, L3F.s), L3F.s, '+z', 0.0);
  rf.push(pipeG([mo, [mo[0], mo[1], HZ - 0.01], [mo[0], mo[1], zA], [ARRAY_C[0] - 0.12, 0.3, zA], [ARRAY_C[0] - 0.05, 0.12, zA], [ARRAY_C[0], 0.05, DECK + 0.03]], 0.011));
  rf.push(pipeG([fo, [fo[0], fo[1], HZ - 0.01], [fo[0], fo[1], zA], [ARRAY_C[0] + 0.05, 0.3, zA], [ARRAY_C[0] + 0.05, 0.12, zA], [ARRAY_C[0] + 0.03, 0.05, DECK + 0.03]], 0.009));
  P('L-band RF cables', {
    system: 'Payload', material: 'Low-loss semi-rigid coaxial cable', mass: 5, temp: 295, explode: [0, 0.95, 0.4],
    desc: 'Coaxial lines from the L1, L2 and L5 transmitters to the multiplexer and from the L3 transmitter to its filter, then up through the Earth deck to the beam-forming network under the antenna panel. Every tenth of a decibel lost here is transmitter power wasted as heat (routing estimated).',
  }, mesh(merge(rf), G.tubing()));

  // ================================================================== NETWORK COMMUNICATIONS ELEMENT (−Y bus panel)
  const nce = (name, key, desc, mass, mat = G.alodine(), conn = '+y', n = 3) => {
    const { c, s } = BUS[key];
    return box(name, { system: 'Communications', material: 'Aluminium chassis', mass, temp: 298, explode: [0, -1.15, 0], desc }, bus(c, s), s, mat, { mount: '-y', conn, n }, 'bus', mass > 10);
  };
  const ECTS = 'The enhanced crosslink transponder subsystem transmits and receives on the UHF crosslinks; Lockheed\'s figure shows "ECTS (2)" on this panel. Inter-satellite ranges and relayed data keep the constellation\'s orbit and clock estimates current even if ground uploads stop for a while.';
  nce('Crosslink transponder (ECTS A)', 'ectsA', ECTS, 16, G.alodine(), '+z', 3);
  nce('Crosslink transponder (ECTS B)', 'ectsB', 'The redundant second crosslink transponder. General Dynamics supplied the network communications element, which covers the UHF crosslink and the TT&C units.', 16, G.alodine(), '+z', 3);
  nce('Thin communications unit (A)', 'tcuA', 'The thin communications unit distributes commands to the payload units and collects their telemetry; the figure shows two of them ("Thin Comm Unit (2)").', 7);
  nce('Thin communications unit (B)', 'tcuB', 'The redundant thin communications unit, the second link in the block diagram\'s ECTS → TCU → SUT → SSMA → STPX chain.', 7);
  const SUTD = 'The block diagram chains the network communications element as ECTS → Thin Comm Unit → SUT → SSMA → STPX, each tied to the payload MIL-STD-1553B bus, and the expanded view shows "SUT (2)" on this panel. The source does not expand the acronym (size estimated).';
  nce('SUT (A)', 'sutA', SUTD, 4);
  nce('SUT (B)', 'sutB', 'The second SUT of the redundant pair (acronym not expanded in the source; size estimated).', 4);
  nce('SSMA unit', 'ssma', 'The "SSMA" of the network-communications chain in Lockheed\'s block diagram, between the SUTs and the STPX. The source does not expand the acronym or describe the unit (size estimated).', 4);
  nce('STPX unit', 'stpx', 'The "STPX", last unit of the network-communications chain in Lockheed\'s block diagram. The source does not expand the acronym (size estimated).', 4);
  const UDU = 'One of a redundant pair of S-band uplink/downlink units, the TT&C transponders: each demodulates and decrypts ground commands, returns telemetry and turns the ranging tones around so the ground can measure the satellite\'s distance, over SGLS with the Air Force Satellite Control Network or with Unified S-Band stations.';
  nce('Uplink/downlink unit (A)', 'uduA', UDU, 8);
  nce('Uplink/downlink unit (B)', 'uduB', 'The second S-band uplink/downlink unit; either one can reach the ground through the forward or the aft antenna.', 8);
  // S-band RF cables: UDU A → forward mast (through the top windows of the core walls, then up under the
  // data trunk and the power bus to the mast), UDU B → aft antenna (along the panel between the power
  // drops and the units, down the +X edge outboard of Battery 2, across the foot of the +X bay)
  const ua = bus(BUS.uduA.c, BUS.uduA.s), ub = bus(BUS.uduB.c, BUS.uduB.s);
  const [fx, fy] = DECK_AT.fwdMast, [ax, ay] = AFT_ANT;
  const fa = [ua[0] + 0.06, ua[1] + BUS.uduA.s[1] / 2 + 0.012, ua[2]], fb = [ub[0] + 0.06, ub[1] + BUS.uduB.s[1] / 2 + 0.012, ub[2]];
  const ZBS = -HZ + 0.1;   // the aft run, above the thruster and oxidiser lines on the aft deck
  const ZFS = 1.555;       // the forward run's last leg, under the top data trunk and the main power bus
  P('S-band RF cables', {
    system: 'Communications', material: 'Semi-rigid coaxial cable', mass: 2.5, temp: 290, explode: [0, -0.6, 0],
    desc: 'Coaxial lines from the two uplink/downlink units to the forward TT&C mast on the Earth deck and to the aft antenna at the far end, cross-strapped so either radio can reach the ground whichever way the satellite points (routing estimated).',
  }, mesh(merge([
    pipeG([fa, [fa[0], -0.64, fa[2]], [fa[0], 0.6, fa[2]], [fa[0], 0.6, ZFS], [fx, 0.6, ZFS], [fx, fy, ZFS], [fx, fy, DECK + 0.02]], 0.007),
    pipeG([fb, [fb[0], -0.672, fb[2]], [1.19, -0.672, fb[2]], [1.19, -0.672, ZBS], [1.14, -0.672, ZBS], [1.14, ay, ZBS], [ax, ay, ZBS], [ax, ay, AFT - 0.01]], 0.007),
  ]), G.tubing()));

  // ================================================================== HOSTED PAYLOAD: Global Burst Detector (NDS)
  const PS = [0.3, 0.15, 0.2];
  [[-0.3, 1.47], [-0.68, 1.47], [-0.3, 1.22], [-0.68, 1.22]].forEach((xz, k) => box(`NDS processor ${k + 1}`, {
    system: 'Payload', material: 'Aluminium chassis (government-furnished equipment)', mass: 9, temp: 298, explode: [0, -1.15, 0],
    desc: k === 0
      ? `One of four hosted-payload "Processor" boxes that Lockheed's figure shows on the bus panel. Sandia and Los Alamos design the Global Burst Detector's five subsystems and Sandia integrates them; it detects, time-stamps and records electromagnetic pulses in specific bands plus X-ray and optical flashes, and reports over the L3 link and the crosslinks. ${COMPOSITE}`
      : 'A hosted-payload processor of the Global Burst Detector. Its function is described publicly only at this level (size and position on the panel estimated).',
  }, bus(xz, PS), PS, G.alodine(), { mount: '-y', conn: '+y', n: 3, fins: 4 }, 'bus', true));
  // optical sensor under its white sunshade, −X/−Y corner of the Earth deck
  const [sx, sy] = DECK_AT.sunshade;
  const shadeProf = [[0.115, 0], [0.225, 0.36], [0.215, 0.36], [0.105, 0.005]];
  const shade = lathe(shadeProf, 40).rotateX(Math.PI / 2).translate(sx, sy, DECK + 0.1);
  const sens = merge([boxG([sx, sy, DECK + 0.05], [0.26, 0.26, 0.1]), boxG([sx, sy, DECK + 0.004], [0.3, 0.3, 0.008])]);
  const optL = merge([cylG([sx, sy - 0.055, DECK + 0.106], 0.045, 0.012, 'z', 22), cylG([sx, sy + 0.055, DECK + 0.106], 0.045, 0.012, 'z', 22)]);
  reg([sx, sy, IZ - 0.02], 'deck');
  P('NDS optical sensor & sunshade', {
    system: 'Payload', material: 'Optical radiometers behind filters under a white-painted sunshade', mass: 14, temp: 260, explode: [-0.2, -0.3, 2.1],
    desc: `The burst detector's optical sensor, with "a prominent sunshade" (white, about 0.45 m tall and as wide) in this corner of the Earth deck: the feature IGS analysts used to fix GPS III's body axes. Two apertures look out through the cone for the double flash of a nuclear explosion; GPS satellites have carried such sensors since 1980, supporting test-ban monitoring. ${COMPOSITE}`,
    callout: true, anchor: [sx - 0.05, sy - 0.2, DECK + 0.46],
  }, [mesh(sens, G.alodine()), mesh(shade, G.whitePaint()), mesh(optL, G.lens())]);
  const [xx, xy] = DECK_AT.xray;
  reg([xx, xy, IZ - 0.02], 'deck');
  P('NDS X-ray & dosimeter sensor', {
    system: 'Payload', material: 'Detector head with beryllium window (generic)', mass: 7, temp: 255, explode: [-0.3, -0.2, 1.95],
    desc: 'X-ray and charged-particle sensors of the burst detector. On earlier GPS blocks a combined X-ray and dosimeter instrument also mapped the radiation belts; Los Alamos released 16 years of its particle data in 2017 (generic stand-in, position estimated).',
  }, [mesh(merge([boxG([xx, xy, DECK + 0.08], [0.12, 0.12, 0.16]), boxG([xx, xy, DECK + 0.004], [0.16, 0.16, 0.008])]), G.alodine()), mesh(cylG([xx, xy, DECK + 0.164], 0.035, 0.008, 'z', 16), G.prism())]);
  const [hx, hy] = DECK_AT.hpeSensor;
  reg([hx, hy, IZ - 0.02], 'deck');
  P('HPE sensor', {
    system: 'Payload', material: 'Sensor head (government-furnished, generic)', mass: 6, temp: 255, explode: [0.3, 0.25, 2.0],
    desc: 'A second hosted-payload sensor, drawn in Lockheed\'s figure as a green box labelled simply "Sensor" at the opposite end of the Earth deck from the sunshade. Which of the burst detector\'s sensors it is, is not public (generic box, size estimated).',
  }, [mesh(merge([boxG([hx, hy, DECK + 0.1], [0.15, 0.15, 0.2]), boxG([hx, hy, DECK + 0.004], [0.19, 0.19, 0.008])]), G.alodine()), mesh(cylG([hx, hy, DECK + 0.204], 0.04, 0.01, 'z', 18), G.lens())]);

  // ================================================================== laser retroreflector array (SV09, SV10)
  const [lx, ly] = DECK_AT.lra, lz = DECK + 0.1;
  const plate = mesh(merge([plateG(octagon(lx, ly, 0.406), 0.04, lz), cylG([lx, ly, (DECK + lz) / 2], 0.06, lz - DECK, 'z', 16), cylG([lx, ly, DECK + 0.006], 0.12, 0.012, 'z', 24)]), G.aluminium());
  const pts = [], pitch = 0.046;
  for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) {
    const x = (i + (j % 2 ? 0.5 : 0)) * pitch, y = j * pitch * 0.866;
    pts.push([x, y, Math.hypot(x, y)]);
  }
  pts.sort((a, b) => a[2] - b[2]);
  const cubes = pts.slice(0, 48).map(([x, y]) => cylG([lx + x, ly + y, lz + 0.044], 0.0203, 0.008, 'z', 12));
  P('Laser retroreflector array', {
    system: 'Payload', material: '48 fused-silica corner cubes in an aluminium plate', mass: 10, count: 48, temp: 250, explode: [0.2, -0.3, 2.0],
    desc: `NASA array of 48 corner cubes, each 1.6 in (4.1 cm) across, in a 16-in plate. They return ground-station laser pulses straight back, so the satellite's range is measured to millimetres, an independent check on the orbit in the navigation message. SV09 (launched January 2026) and SV10 are the GPS III satellites that carry one; two Block IIA satellites carried arrays in the 1990s. Position on the deck estimated. ${COMPOSITE}`,
  }, [plate, mesh(merge(cubes), G.prism())]);

  // ================================================================== SV10 optical communications terminal
  const [ox, oy] = DECK_AT.scot;
  const head = merge([boxG([ox, oy, DECK + 0.1], [0.26, 0.19, 0.12]), cylG([ox, oy, DECK + 0.185], 0.075, 0.05, 'z', 24), new THREE.SphereGeometry(0.075, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(ox, oy, DECK + 0.21)]);
  const ped = merge([boxG([ox, oy, DECK + 0.02], [0.22, 0.16, 0.04])]);
  const ap = cylG([ox + 0.05, oy, DECK + 0.255], 0.042, 0.03, 'x', 20).rotateY(0);
  reg([ox, oy, IZ - 0.02], 'deck', true);
  P('Optical communications terminal (SV10)', {
    system: 'Communications', material: 'Tesat SCOT80 terminal: 80 mm telescope on a coarse pointing head', mass: 12, temp: 270, explode: [0.45, 0, 2.05],
    desc: 'SV10 carries an optical-crosslink demonstration: a Tesat SCOT80 laser terminal with an 80 mm aperture, about 12 kg and 60–80 W, to prove laser links at GPS altitude ahead of GPS IIIF. Its position on the satellite is not public; it is placed here at the +X end of the Earth deck (estimate), and SV01–SV09 do not carry it.',
  }, [mesh(head, G.whitePaint()), mesh(ped, G.alodine()), mesh(ap, G.lens())]);
}
