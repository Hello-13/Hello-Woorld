// Where things sit on the GPS III Earth deck and on the two equipment panels, shared by the modules
// that build them and the cables and harnesses that join them. Body axes as in kit.js (IGS frame:
// x Sun side, y array axis, z nadir); deck positions are (x, y), panel positions (x, z).
//
// Earth deck: measured from the +Z photograph of the manufacturer's scale model (Steigenberger et al.
// 2020, Fig. 4), scaled to the 2.46 × 1.78 m deck: the array centre sits about 0.15 m toward +X;
// Earth-coverage helices 4 at r ≈ 0.17 m and 8 at r ≈ 0.53 m, crosslink elements 4 at r ≈ 0.36 m
// and 8 at r ≈ 0.82 m (the 4 + 8 rings of Lockheed patent US 10,749,252, Fig. 1); the four M-code
// elements in a group at the −X end; the burst detector's sunshade in the −X/−Y corner; a white
// two-aperture unit near the −X/+Y corner (taken here as the Earth sensor pair Lockheed labels
// "ESA (2)", an identification estimate). Items without a published position say so in their desc.

import { HX, IY } from './dims.js';

const D = Math.PI / 180;
export const ARRAY_C = [0.15, 0];
const ring = (n, r, a0) => Array.from({ length: n }, (_, k) => { const a = (a0 + (k * 360) / n) * D; return [ARRAY_C[0] + Math.cos(a) * r, ARRAY_C[1] + Math.sin(a) * r]; });
export const EC_INNER = ring(4, 0.17, 22.5), EC_OUTER = ring(8, 0.53, 0);
export const UHF_INNER = ring(4, 0.36, 67.5), UHF_OUTER = ring(8, 0.82, 22.5);
export const MEC = [[-0.88, -0.10], [-1.12, -0.10], [-0.88, 0.14], [-1.12, 0.14]];

export const DECK_AT = {
  sunshade: [-0.55, -0.76],      // burst detector optical sensor and its white sunshade (−X/−Y corner)
  xray: [-0.97, -0.6],           // burst detector X-ray / dosimeter head (position estimated)
  esa: [-0.7, 0.66],             // the two Earth sensor assemblies
  hpeSensor: [1.03, 0.72],       // the hosted-payload "Sensor" of Lockheed's figure, at the opposite corner
  hpeS: [1.13, 0.43],            // hosted-payload S-band antenna
  hpeRx: [1.33, 0.05],           // hosted-payload receive antenna, on the panel's +X tab (estimate)
  lra: [0.85, -0.68],            // laser retroreflector array (SV09, SV10; position estimated)
  scot: [1.1, -0.06],            // SV10 optical communications terminal (position not public)
  fwdMast: [0.0, 0.81],          // forward TT&C S-band antenna mast
  mast2: [1.15, -0.78],          // second mast, labelled only "Antenna"
};
// eight JIB monopole canisters (positions not public; placed clear of the elements, on the panel)
export const JIB_POS = [[-1.07, 0.8], [-0.42, 0.8], [0.22, 0.81], [0.72, 0.8], [0.2, -0.8], [-1.1, -0.31], [-1.13, 0.48], [-0.16, -0.6]];

// L-band antenna panel outline (x, y): nearly the whole deck, chamfered, with a tab at the +X end, the
// M-code group at the −X end and a notch for the sunshade
export const PANEL_OUTLINE = [[1.08, -0.86], [-0.3, -0.86], [-0.3, -0.53], [-0.84, -0.42], [-1.06, -0.42], [-1.25, -0.22], [-1.25, 0.8], [-1.19, 0.86],
  [1.1, 0.86], [1.1, 0.56], [1.21, 0.56], [1.4, 0.22], [1.4, -0.12], [1.21, -0.52], [1.08, -0.52]];

// Bus/NCE/HPE panel (−Y), unit centres (x, z) and sizes [x, depth y, z]
export const BUS = {
  ectsA: { c: [-0.9, 0.36], s: [0.4, 0.18, 0.24] }, ectsB: { c: [-0.9, 0.06], s: [0.4, 0.18, 0.24] },
  tcuA: { c: [-0.42, 0.38], s: [0.3, 0.12, 0.16] }, tcuB: { c: [-0.42, 0.14], s: [0.3, 0.12, 0.16] },
  sutA: { c: [-0.02, 0.4], s: [0.25, 0.12, 0.16] }, sutB: { c: [-0.02, 0.16], s: [0.25, 0.12, 0.16] },
  ssma: { c: [0.36, 0.38], s: [0.25, 0.12, 0.16] }, stpx: { c: [0.36, 0.14], s: [0.25, 0.12, 0.16] },
  uduA: { c: [0.1, 1.5], s: [0.26, 0.13, 0.16] }, uduB: { c: [0.1, 1.27], s: [0.26, 0.13, 0.16] },
};
/** Centre of a unit of depth d on the +Y (NPE) panel or the −Y (bus) panel. */
export const onNPE = ([x, z], d) => [x, IY - d / 2, z];
export const onBUS = ([x, z], d) => [x, -(IY - d / 2), z];
export const AFT_ANT = [1.0, 0.72];   // aft TT&C S-band antenna, an aft corner (Fig. 4)
export { HX };
