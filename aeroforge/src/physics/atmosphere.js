// International Standard Atmosphere (ISA / US Standard Atmosphere 1976).
// Exact layer model from 0 to 86 km geometric, exponential tail above.

export const G0 = 9.80665;          // m/s²
export const R_AIR = 287.053;       // J/(kg·K)
export const GAMMA_AIR = 1.4;
export const P_SL = 101325;         // Pa
export const T_SL = 288.15;         // K
export const RHO_SL = 1.225;        // kg/m³
const R_EARTH_GEOPOT = 6356766;     // m, radius used for geopotential altitude
const GMR = 0.0341632;              // g0·M / R*  (K/m)

// [base geopotential altitude (m), base temperature (K), lapse rate (K/m), base pressure (Pa)]
const LAYERS = [
  [0, 288.15, -0.0065, 101325.0],
  [11000, 216.65, 0.0, 22632.06],
  [20000, 216.65, 0.001, 5474.889],
  [32000, 228.65, 0.0028, 868.0187],
  [47000, 270.65, 0.0, 110.9063],
  [51000, 270.65, -0.0028, 66.93887],
  [71000, 214.65, -0.002, 3.956420],
  [84852, 186.946, 0.0, 0.3734],
];

/**
 * Atmospheric state at geometric altitude z (m).
 * Returns { T (K), p (Pa), rho (kg/m³), a (m/s), sigma (rho/rho_SL) }.
 */
export function isa(z) {
  const zc = Math.max(-500, z);
  if (zc > 86000) {
    // Thermosphere approximation: density decays with a ~7 km scale height.
    const base = isa(86000);
    const rho = base.rho * Math.exp(-(zc - 86000) / 7000);
    const T = 186.87 + Math.min(zc - 86000, 60000) * 0.003;
    const p = rho * R_AIR * T;
    return { T, p, rho, a: Math.sqrt(GAMMA_AIR * R_AIR * T), sigma: rho / RHO_SL };
  }
  const h = (R_EARTH_GEOPOT * zc) / (R_EARTH_GEOPOT + zc);
  let i = LAYERS.length - 1;
  while (i > 0 && h < LAYERS[i][0]) i--;
  const [hb, Tb, L, Pb] = LAYERS[i];
  const T = Tb + L * (h - hb);
  const p = L === 0
    ? Pb * Math.exp((-GMR * (h - hb)) / Tb)
    : Pb * Math.pow(Tb / T, GMR / L);
  const rho = p / (R_AIR * T);
  return { T, p, rho, a: Math.sqrt(GAMMA_AIR * R_AIR * T), sigma: rho / RHO_SL };
}

/** Stagnation (total) temperature for a recovery factor r (0.89 ≈ turbulent boundary layer). */
export function recoveryTemperature(T, mach, r = 1) {
  return T * (1 + r * 0.5 * (GAMMA_AIR - 1) * mach * mach);
}
