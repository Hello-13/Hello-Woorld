// GE90-115B layout: pure data (no three.js) shared by the model and its tests.
//
// Lathe frame used throughout: y is the engine axis, +y forward (towards the intake); r is the
// radius from the axis; phi is the angle round the axis with x = r·sin(phi), z = r·cos(phi).
// The model turns this frame so that +y becomes world +x (forward) and +x becomes world down,
// so phi = 0 faces the viewer (+z), phi = π/2 points down and phi = 3π/2 points up (pylon).
// y = 0 is the fan-blade leading edge at the hub. All figures are metres.
//
// Published (GE Aerospace, EASA TCDS IM.E.002 issue 05): fan Ø 3.25 m (128 in), 22 fan blades,
// 1 fan + 4 booster + 9 HPC stages, 2 HPT + 6 LPT stages, length spinner to centre body
// 7,281 mm (286.7 in), dry mass 8,761 kg (19,316 lb), engine maximum diameter 135 in (fan case).
// Boeing nacelle maximum diameter 166 in (4.22 m). Flow-path radii, axial stations and blade counts
// below are reconstructions sized from public cutaways and from the cycle (annulus areas
// that pass the take-off airflow), not GE drawings.

export const STAGES = { fan: 1, booster: 4, hpc: 9, hpt: 2, lpt: 6 };

export const FAN = {
  tipR: 1.625,             // 128 in diameter
  hubR: 0.47,              // hub/tip ≈ 0.29
  caseR: 1.632,            // fan-case inner wall over the blades
  rubR: 1.628,             // face of the abradable rub strip set into it (blade tips 1.623: 5 mm clearance)
  blades: 22,
  le: 0.0, te: -0.5,       // hub leading / trailing edge stations
  spinnerTip: 0.8,
};

/** Overall: spinner tip to centre-plug tip is 7.281 m (EASA TCDS: 7,281 mm, 286.7 in). */
export const LENGTH = 7.281;
export const PLUG_TIP = FAN.spinnerTip - LENGTH;

// Core flow path: [y, hub r, tip r] from the splitter to the core-nozzle exit.
export const CORE = [
  [-0.72, 0.555, 0.875], [-0.80, 0.57, 0.862], [-0.90, 0.585, 0.848], [-1.00, 0.598, 0.833],
  [-1.10, 0.608, 0.818], [-1.20, 0.617, 0.804], [-1.30, 0.626, 0.791], [-1.40, 0.633, 0.779],
  [-1.50, 0.638, 0.768], [-1.60, 0.64, 0.758], [-1.70, 0.618, 0.742], [-1.80, 0.555, 0.695],
  [-1.90, 0.47, 0.628], [-2.00, 0.392, 0.566], [-2.10, 0.347, 0.535], [-2.17, 0.345, 0.53],
  [-3.15, 0.436, 0.468], [-3.22, 0.44, 0.472], [-3.30, 0.445, 0.49],
  // combustor: the gas turns through the dual-dome liner (drawn separately)
  [-3.38, 0.46, 0.64], [-3.62, 0.48, 0.63], [-3.72, 0.505, 0.61],
  [-3.76, 0.505, 0.61], [-3.85, 0.505, 0.616], [-3.94, 0.506, 0.626], [-4.03, 0.51, 0.636],
  [-4.10, 0.53, 0.665], [-4.18, 0.55, 0.70], [-5.09, 0.575, 0.90], [-5.15, 0.575, 0.905],
  [-5.35, 0.56, 0.9], [-5.65, 0.47, 0.72],
];

/** Hub and tip radius of the core gas path at axial station y. */
export function coreAt(y) {
  if (y >= CORE[0][0]) return [CORE[0][1], CORE[0][2]];
  for (let i = 1; i < CORE.length; i++) {
    if (y >= CORE[i][0]) {
      const [y0, h0, t0] = CORE[i - 1], [y1, h1, t1] = CORE[i];
      const f = (y - y0) / (y1 - y0);
      return [h0 + (h1 - h0) * f, t0 + (t1 - t0) * f];
    }
  }
  const last = CORE[CORE.length - 1];
  return [last[1], last[2]];
}

// Bypass duct: [y, inner r, outer r] from the fan exit to the fan-nozzle exit.
export const BYPASS = [
  [-0.55, 0.62, 1.632], [-0.72, 0.88, 1.632], [-0.9, 0.905, 1.632], [-1.3, 0.94, 1.632],
  [-1.6, 0.975, 1.632], [-2.0, 1.0, 1.625], [-2.6, 1.05, 1.605], [-3.2, 1.06, 1.565],
  [-3.95, 1.04, 1.49],
];
export const FAN_NOZZLE_Y = -3.95;

export function bypassAt(y) {
  if (y >= BYPASS[0][0]) return [BYPASS[0][1], BYPASS[0][2]];
  for (let i = 1; i < BYPASS.length; i++) {
    if (y >= BYPASS[i][0]) {
      const [y0, a0, b0] = BYPASS[i - 1], [y1, a1, b1] = BYPASS[i];
      const f = (y - y0) / (y1 - y0);
      return [a0 + (a1 - a0) * f, b0 + (b1 - b0) * f];
    }
  }
  const last = BYPASS[BYPASS.length - 1];
  return [last[1], last[2]];
}

const seq = (n, y0, dy) => Array.from({ length: n }, (_, i) => y0 + i * dy);

// Blade rows. y is the mid-chord station; chord is the axial chord at the hub; count is the
// number of airfoils in the row (estimated where GE does not publish it — see each desc).
const hpcRotorY = [-2.17, -2.29, -2.40, -2.51, -2.61, -2.71, -2.81, -2.90, -2.99];
const lptRotorY = seq(6, -4.27, -0.164);
export const ROWS = {
  boosterIGV: { y: -0.80, chord: 0.05, count: 76 },
  boosterRotors: [-0.90, -1.10, -1.30, -1.50].map((y, i) => ({ y, chord: 0.075 - i * 0.005, count: [64, 72, 76, 80][i] })),
  boosterStators: [-1.00, -1.20, -1.40, -1.60].map((y, i) => ({ y, chord: 0.06, count: [90, 96, 100, 110][i] })),
  hpcIGV: { y: -2.105, chord: 0.045, count: 44 },
  hpcRotors: hpcRotorY.map((y, i) => ({ y, chord: 0.07 - i * 0.004, count: [38, 46, 56, 64, 70, 76, 80, 84, 88][i] })),
  hpcStators: hpcRotorY.slice(0, 8).map((y, i) => ({ y: (y + hpcRotorY[i + 1]) / 2, chord: 0.05 - i * 0.002, count: [60, 70, 80, 90, 100, 110, 116, 124][i], variable: i < 3 })),
  hpcOGV: { y: -3.07, chord: 0.04, count: 130 },
  hptNozzles: [{ y: -3.76, chord: 0.07, count: 48 }, { y: -3.94, chord: 0.065, count: 50 }],
  hptBlades: [{ y: -3.85, chord: 0.06, count: 72 }, { y: -4.03, chord: 0.058, count: 74 }],
  lptNozzles: lptRotorY.map((y, i) => ({ y: y + 0.082, chord: 0.06 + i * 0.006, count: [112, 120, 128, 132, 136, 140][i] })),
  lptBlades: lptRotorY.map((y, i) => ({ y, chord: 0.055 + i * 0.006, count: [126, 134, 140, 146, 150, 156][i] })),
};

// SAE ARP755 station planes: [id, y, inner r, outer r]
export const STATIONS = [
  ['2', 0.12, 0.47, 1.632], ['13', -0.66, 0.66, 1.632], ['25', -2.06, 0.37, 0.55], ['3', -3.25, 0.44, 0.48],
  ['4', -3.735, 0.505, 0.61], ['45', -4.12, 0.54, 0.68], ['5', -5.2, 0.57, 0.905], ['9', -5.65, 0.47, 0.72],
  ['19', FAN_NOZZLE_Y, 1.04, 1.49],
];

// Nacelle (Boeing): outer and inner lines, [y, r]
export const NACELLE = {
  lipY: 1.8,
  inletAftY: 0.3,          // inlet A-flange to fan case
  fanCowlAftY: -1.45,
  sleeveFwdY: -1.72,
  maxR: 2.108,             // 166 in maximum diameter
};

/** The ARP755 station numbering used by the lab and the station planes. */
export const STATION_NAMES = {
  '2': 'Fan face', '13': 'Fan exit (bypass)', '25': 'Booster exit / HPC inlet', '3': 'HPC exit',
  '4': 'Combustor exit', '45': 'HPT exit / LPT inlet', '5': 'LPT exit', '9': 'Core nozzle', '19': 'Fan nozzle',
};
