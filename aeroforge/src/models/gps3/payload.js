// GPS III navigation payload element (L3Harris): the Mission Data Unit, the L1, L2, L3 and L5
// transmitters, the atomic frequency standards and the signal filters (Marquis & Shaw, InsideGNSS
// 2011); the network communications element (crosslink transponder, thin communications unit,
// S-band uplink/downlink units); the hosted nuclear-detonation sensors; the laser retroreflector.
// Unit positions on the radiator panels are estimates.

import { mesh } from '../../engine/assembly.js';
import { G } from './materials.js';
import { IY, IZ, DECK, AFT, boxG, cylG, merge, unit, pipeG, plateG, octagon, connPoint } from './kit.js';
import { LRA_C } from './antennas.js';

/** Harness landing points collected from every module; the harness is drawn last (power.js). */
export const HARNESS = [];

export function buildPayload(P) {
  const yP = (d) => IY - d / 2;          // centre of a unit of depth d on the +Y radiator
  const yB = (d) => -(IY - d / 2);       // ... on the −Y radiator
  const box = (name, info, c, s, mat, opts) => {
    HARNESS.push(connPoint(c, s, opts.conn, 0.04));
    return P(name, info, unit(c, s, mat, opts));
  };

  // ------------------------------------------------------------------ Mission Data Unit and transmitters (+Y radiator, x > 0)
  box('Mission Data Unit', {
    system: 'Payload', material: 'Aluminium chassis, radiation-hardened processors', mass: 52, temp: 300, explode: [0, 1.2, 0],
    desc: 'L3Harris\'s payload computer and waveform generator, the heart of the navigation payload: a largely (about 70 %) digital unit that builds every ranging code and navigation message from the clock reference. GPS III is required to hold a 1.0 m user range error at 24 hours, three times better than Block IIR.',
  }, [0.40, yP(0.22), 1.13], [0.46, 0.22, 0.34], G.alodine(), { mount: '+y', conn: '-x', n: 6, fins: 6 });
  const TX = { s: [0.44, 0.2, 0.24] };
  const tx = (name, z, desc, s = TX.s) => box(name, {
    system: 'Payload', material: 'High-power L-band amplifier, aluminium heat-sink chassis', mass: s === TX.s ? 30 : 18, temp: 305, explode: [0, 1.2, 0], desc,
  }, [0.40, yP(s[1]), z], s, G.blackBox(), { mount: '+y', conn: '-y', n: 3 });
  tx('L1 transmitter', 0.78, 'Amplifies the 1575.42 MHz carrier (154 × 10.23 MHz) holding the civil C/A and L1C signals and the military P(Y) and M-code. Higher transmitted power is one reason GPS III gives military users up to eight times the anti-jam margin of earlier satellites (amplifier type and mass estimated).');
  tx('L2 transmitter', 0.48, 'Amplifies 1227.60 MHz (120 × 10.23 MHz): the civil L2C signal plus P(Y) and M-code. Two frequencies let a receiver measure and remove the ionosphere\'s delay, which scales with 1/f².');
  tx('L5 transmitter', 0.18, 'Amplifies 1176.45 MHz (115 × 10.23 MHz), the civil safety-of-life signal in a protected aeronautical band, with a 10.23 Mchip/s code ten times faster than C/A for sharper ranging.');
  tx('L3 transmitter', -0.11, 'Carries the nuclear-detonation detection system\'s data down to the ground on 1381.05 MHz (135 × 10.23 MHz). It is not a navigation signal (size and mass estimated).', [0.38, 0.18, 0.2]);

  // output multiplexer under the Earth deck (inner face z = IZ)
  const omux = [boxG([0.45, 0.74, IZ - 0.012], [0.4, 0.22, 0.024])];
  for (let i = 0; i < 6; i++) omux.push(cylG([0.31 + (i % 3) * 0.14, 0.69 + Math.floor(i / 3) * 0.1, IZ - 0.024 - 0.065], 0.034, 0.13, 'z', 16));
  P('L-band output multiplexer', {
    system: 'Payload', material: 'Silver-plated invar filter cavities', mass: 20, temp: 300, explode: [0, 0.6, 1.0],
    desc: 'The payload\'s signal filters: they keep each transmitter inside its allocated band and combine L1, L2, L3 and L5 onto the antenna feed. Invar is used because it barely expands with temperature, so the cavities stay tuned.',
  }, mesh(merge(omux), G.silverBox()));
  // RF cables: transmitter fronts → up the radiator → multiplexer → through the deck → beam-forming network
  const rf = [];
  [0.78, 0.48, 0.18, -0.11].forEach((z, i) => {
    const x = 0.3 + i * 0.05, y0 = IY - 0.2 - 0.03, y1 = IY - 0.25 - i * 0.012;
    rf.push(pipeG([[x, y0, z], [x, y1, z], [x, y1, 1.33], [0.31 + (i % 3) * 0.14, 0.86, 1.33], [0.31 + (i % 3) * 0.14, 0.8, 1.29]], 0.008));
  });
  rf.push(pipeG([[0.45, 0.74, IZ], [0.45, 0.74, DECK + 0.03], [0.17, 0.17, DECK + 0.03]], 0.011));
  P('L-band RF cables', {
    system: 'Payload', material: 'Low-loss semi-rigid coaxial cable', mass: 5, temp: 295, explode: [0, 0.9, 0.5],
    desc: 'Coaxial lines from each transmitter to the output multiplexer, and from the multiplexer through the Earth deck to the antenna\'s beam-forming network. Every tenth of a decibel lost here is transmitter power wasted as heat (routing estimated).',
  }, mesh(merge(rf), G.tubing()));

  // ------------------------------------------------------------------ clocks (+Y radiator, x < 0)
  P('Clock baseplate', {
    system: 'Thermal control', material: 'Aluminium plate with heaters and thermostats', mass: 8, temp: 293, explode: [0, 1.25, 0],
    desc: 'A temperature-controlled mounting plate with four clock positions. A rubidium standard\'s frequency shifts slightly with temperature, so the plate holds the clocks to a fraction of a degree as the satellite swings between sunlight and eclipse.',
  }, mesh(boxG([-0.455, IY - 0.01, 1.1], [0.7, 0.02, 0.48]), G.silverBox()));
  const CLK_X = [-0.72, -0.555, -0.39];
  CLK_X.forEach((x, k) => {
    const c = [x, IY - 0.02 - 0.075, 1.1], s = [0.15, 0.15, 0.3];
    const pkg = unit(c, s, G.silverBox(), { mount: '+y', conn: '-z', n: 2 });
    pkg.push(mesh(cylG([x, c[1] - 0.075 - 0.03, 1.16], 0.045, 0.06, 'y', 20), G.alodine()));
    HARNESS.push(connPoint(c, s, '-z', 0.04));
    P(`Rubidium atomic clock ${k + 1}`, {
      system: 'Payload', material: 'Rubidium lamp, absorption cell and quartz oscillator (Excelitas RAFS)', mass: 8, temp: 293, explode: [0, 1.15, 0],
      desc: k === 0
        ? 'Rubidium atomic frequency standard. It locks a quartz oscillator to the 6.834 682 6 GHz hyperfine transition of rubidium-87 and drifts only a few parts in 10¹⁴ over a day, a few nanoseconds. One clock runs the payload; GPS III can also run a second one and monitor its stability in orbit.'
        : 'One of the three rubidium atomic frequency standards. A one-nanosecond clock error is a 30 cm range error, so the spares are kept ready to take over (mass estimated).',
    }, pkg);
  });
  const slot = [boxG([-0.225, IY - 0.026, 1.1], [0.15, 0.012, 0.3])];
  for (const dx of [-0.055, 0.055]) for (const dz of [-0.12, 0.12]) slot.push(cylG([-0.225 + dx, IY - 0.035, 1.1 + dz], 0.008, 0.012, 'y', 8));
  P('Fourth clock slot', {
    system: 'Payload', material: 'Mounting pad with inserts, harness connector', mass: 1, temp: 293, explode: [0, 1.15, 0],
    desc: 'GPS III was designed with a fourth clock position for a new or experimental frequency standard, such as a hydrogen maser, so future clocks can be tried in orbit without redesigning the payload (shown empty).',
  }, mesh(merge(slot), G.connector()));
  box('Frequency synthesiser & distribution unit', {
    system: 'Payload', material: 'Aluminium chassis, phase-locked synthesisers', mass: 12, temp: 298, explode: [0, 1.2, 0],
    desc: 'Turns the active clock\'s output into the 10.23 MHz reference that every GPS code and carrier is a multiple of, and distributes it to the Mission Data Unit. A unit of this kind flew on Block IIR; its GPS III form is not described publicly.',
  }, [-0.42, yP(0.15), 0.7], [0.44, 0.15, 0.18], G.alodine(), { mount: '+y', conn: '-y', n: 4 });

  // ------------------------------------------------------------------ nuclear detonation detection system (hosted)
  box('NDS processor', {
    system: 'Payload', material: 'Aluminium chassis (generic)', mass: 22, temp: 298, explode: [0, 1.2, 0],
    desc: 'Processes the detection sensors\' data and reports to the ground on the L3 link and between satellites over the UHF crosslinks. Generic box; size and position estimated.',
  }, [-0.42, yP(0.16), 0.42], [0.36, 0.16, 0.22], G.alodine(), { mount: '+y', conn: '-y', n: 3 });
  const opt = [boxG([-0.62, 1.02, DECK + 0.05], [0.24, 0.16, 0.1]), boxG([-0.62, 1.02, DECK + 0.004], [0.28, 0.2, 0.008])];
  const optL = [cylG([-0.69, 1.02, DECK + 0.106], 0.032, 0.012, 'z', 18), cylG([-0.57, 1.0, DECK + 0.106], 0.024, 0.012, 'z', 18), cylG([-0.57, 1.06, DECK + 0.106], 0.014, 0.012, 'z', 12)];
  P('NDS optical sensors', {
    system: 'Payload', material: 'Silicon photodiode radiometers ("bhangmeters") behind filters (generic)', mass: 16, temp: 260, explode: [0, 0, 1.9],
    desc: 'GPS satellites have carried bhangmeters since 1980: fast optical sensors that see the double flash a nuclear explosion makes in the atmosphere, supporting test-ban treaty monitoring. Their real layout is not public, so this is a generic stand-in.',
  }, [mesh(merge(opt), G.alodine()), mesh(merge(optL), G.lens())]);
  P('NDS X-ray & dosimeter sensor', {
    system: 'Payload', material: 'Detector head with beryllium window (generic)', mass: 8, temp: 255, explode: [0, 0, 1.9],
    desc: 'X-ray and charged-particle sensors of the hosted detection payload. On earlier GPS blocks a combined X-ray and dosimeter instrument also mapped the radiation belts; Los Alamos released 16 years of its particle data in 2017 (generic stand-in, position estimated).',
  }, [mesh(merge([boxG([-0.36, 0.93, DECK + 0.04], [0.12, 0.12, 0.08])]), G.alodine()), mesh(cylG([-0.36, 0.93, DECK + 0.084], 0.035, 0.008, 'z', 16), G.prism())]);

  // ------------------------------------------------------------------ laser retroreflector array (SV09 and SV10)
  const plate = mesh(plateG(octagon(LRA_C[0], LRA_C[1], 0.406), 0.04, DECK), G.aluminium());
  const pts = [];
  const pitch = 0.046;
  for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) {
    const x = (i + (j % 2 ? 0.5 : 0)) * pitch, y = j * pitch * 0.866;
    pts.push([x, y, Math.hypot(x, y)]);
  }
  pts.sort((a, b) => a[2] - b[2]);
  const cubes = pts.slice(0, 48).map(([x, y]) => cylG([LRA_C[0] + x, LRA_C[1] + y, DECK + 0.034], 0.0203, 0.006, 'z', 12));
  P('Laser retroreflector array', {
    system: 'Payload', material: '48 fused-silica corner cubes in an aluminium plate', mass: 10, count: 48, temp: 250, explode: [0, 0.2, 1.9],
    desc: 'NASA array of 48 corner cubes, each 1.6 in (4.1 cm) across, in a 16-in planar plate. They return ground-station laser pulses straight back, so the satellite\'s range is measured to millimetres, an independent check on the orbit in the navigation message. SV09 (launched January 2026) and SV10 are the first GPS III satellites to carry one; two Block IIA satellites carried arrays in the 1990s.',
    callout: true, anchor: [LRA_C[0] + 0.2, LRA_C[1], DECK + 0.04],
  }, [plate, mesh(merge(cubes), G.prism())]);

  // ------------------------------------------------------------------ network communications element
  box('Crosslink transponder (ECTS)', {
    system: 'Communications', material: 'Aluminium chassis', mass: 16, temp: 300, explode: [0, 1.2, 0],
    desc: 'The enhanced crosslink transponder subsystem transmits and receives on the UHF crosslinks. Inter-satellite ranges and relayed data keep the constellation\'s orbit and clock estimates current even if ground uploads stop for a while.',
  }, [-0.42, yP(0.18), 0.1], [0.4, 0.18, 0.24], G.alodine(), { mount: '+y', conn: '+z', n: 3 });
  box('Thin communications unit', {
    system: 'Communications', material: 'Aluminium chassis', mass: 7, temp: 298, explode: [0, 1.2, 0],
    desc: 'The TCU distributes commands to the payload units and collects their telemetry, part of the network communications element alongside the crosslink and S-band boxes.',
  }, [-0.42, yP(0.12), -0.2], [0.3, 0.12, 0.16], G.alodine(), { mount: '+y', conn: '-y', n: 3 });
  const udu = (name, z, ex) => box(name, {
    system: 'Communications', material: 'Aluminium chassis', mass: 8, temp: 298, explode: ex,
    desc: 'One of a redundant pair of S-band uplink/downlink units (transponders): each demodulates and decrypts ground commands, returns telemetry and turns the ranging tones around so the ground can measure the satellite\'s distance.',
  }, [-0.42, yB(0.13), z], [0.26, 0.13, 0.16], G.alodine(), { mount: '-y', conn: '+y', n: 3 });
  udu('Uplink/downlink unit (A)', 0.14, [0, -1.2, 0]);
  udu('Uplink/downlink unit (B)', -0.1, [0, -1.2, 0]);
  const sc = [
    pipeG([[-0.5, -(IY - 0.16), 0.14], [-0.5, -1.0, 0.14], [-0.6, -1.0, 1.33], [-0.62, -1.02, 1.36], [-0.62, -1.02, DECK + 0.02]], 0.007),
    pipeG([[-0.5, -(IY - 0.16), -0.1], [-0.5, -1.0, -0.1], [-0.42, -1.0, -1.3], [-0.2, -0.75, -1.3], [0.2, -0.7, -1.3], [0.62, -0.45, -1.3], [0.76, -0.1, -1.3], [0.72, 0, -1.34], [0.72, 0, AFT - 0.01]], 0.007),
  ];
  P('S-band RF cables', {
    system: 'Communications', material: 'Semi-rigid coaxial cable', mass: 2, temp: 290, explode: [0, -0.9, 0],
    desc: 'Coaxial lines from the two uplink/downlink units to the Earth-side and aft S-band antennas, so either radio can reach the ground whichever way the satellite points (routing estimated).',
  }, mesh(merge(sc), G.tubing()));
}
