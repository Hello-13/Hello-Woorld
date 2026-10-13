// Separate-exhaust, two-spool turbofan cycle (non-ideal Brayton cycle, Mattingly-style),
// tuned to the GE Aerospace GE90-115B at its sea-level-static take-off rating.
// Station numbering follows SAE ARP755: 0 freestream, 2 fan face, 13 fan (bypass) exit,
// 25 booster exit = HPC inlet, 3 HPC exit, 4 combustor exit, 45 HPT exit / LPT inlet
// (the GE90 measures EGT here, as T49), 5 LPT exit, 9 / 19 core / fan nozzle exits.
//
// Spools: the LP spool (fan + 4-stage booster) is driven by the 6-stage LPT; the HP spool
// (9-stage HPC) by the 2-stage HPT.

import { isa } from './atmosphere.js';

const CP_C = 1004.5, GAMMA_C = 1.4;     // cold section
const CP_T = 1150.0, GAMMA_T = 1.33;    // hot section
const R_C = CP_C * (GAMMA_C - 1) / GAMMA_C;
const R_T = CP_T * (GAMMA_T - 1) / GAMMA_T;
const H_FUEL = 43.1e6;                  // J/kg, Jet-A lower heating value

/** Published GE90-115B figures used by the model (FAA/EASA TCDS, GE, Aircraft Commerce). */
export const GE90 = {
  name: 'GE90-115B',
  // Take-off airflow is not published; ≈ 3,530 lb/s is an estimate from the 3.25 m fan
  // annulus at a fan-face Mach number of about 0.6.
  massFlowSL: 1600,       // kg/s total airflow at sea-level static, take-off
  fanDiameter: 3.25,      // m (128 in)
  ratedThrust: 513e3,     // N (115,300 lbf certified take-off)
  n1Rpm100: 2355,         // rpm at 100 % N1 (TCDS)
  n2Rpm100: 9332,         // rpm at 100 % N2 (TCDS)
  egtLimitK: 1363,        // K, take-off EGT (T49) limit 1,090 °C (TCDS)
};
// kept for older imports
export const TF90 = GE90;

export const DEFAULT_CYCLE = {
  altitude: 0, mach: 0, throttle: 1,
  // fan tip PR, booster PR (fan hub + 4 booster stages), overall PR, combustor exit T, BPR
  // GE90-115B take-off: OPR 42 (GE). BPR 7.2 (Aircraft Commerce, -115B); the 8–9 often quoted
  // belongs to the earlier -76B…-94B. Fan PR, booster PR and combustor exit temperature are
  // not published — they are chosen so 513 kN and a T49 (EGT) under the 1,090 °C limit result.
  fpr: 1.7, lpcpr: 2.3, opr: 42, tit: 1680, bpr: 7.2,
  eff: { inlet: 0.995, fan: 0.92, lpc: 0.89, comp: 0.88, burner: 0.995, burnerPR: 0.955, hpt: 0.91, lpt: 0.93, mech: 0.99, nozzle: 0.98 },
};

/**
 * Solve the cycle. Returns station table, performance and validity flags.
 * throttle scales turbine inlet temperature (idle ≈ 980 K) and airflow.
 */
export function solveTurbofan(input = {}) {
  const c = { ...DEFAULT_CYCLE, ...input, eff: { ...DEFAULT_CYCLE.eff, ...(input.eff || {}) } };
  const e = c.eff;
  if (e.turb != null) { e.hpt = e.turb; e.lpt = e.turb; }
  const atm = isa(c.altitude);
  const T0 = atm.T, P0 = atm.p;
  const a0 = Math.sqrt(GAMMA_C * R_C * T0);
  const V0 = c.mach * a0;

  const thr = Math.min(1, Math.max(0, c.throttle));
  const Tt4 = 980 + (c.tit - 980) * thr;
  const kc = (GAMMA_C - 1) / GAMMA_C, kt = (GAMMA_T - 1) / GAMMA_T;
  const Tt0 = T0 * (1 + 0.5 * (GAMMA_C - 1) * c.mach ** 2);
  const Pt0 = P0 * Math.pow(Tt0 / T0, 1 / kc);
  const Tt2 = Tt0, Pt2 = Pt0 * e.inlet;
  // part power: spool speed falls with throttle. Compressor maps scale with corrected speed
  // N/√θ2, so in cold air at altitude the same mechanical speed gives more pressure ratio.
  const n1 = 0.42 + 0.58 * Math.sqrt(thr);
  const n1c = Math.min(1.1, n1 * Math.sqrt(288.15 / Tt2));
  const opr = 1 + (c.opr - 1) * Math.pow(n1c, 2.4);
  const lpcpr = Math.min(opr * 0.95, 1 + (c.lpcpr - 1) * Math.pow(n1c, 1.6));
  const hpcpr = opr / lpcpr;
  // core stream: fan hub + booster (2 → 25), then the HP compressor (25 → 3)
  const Pt25 = Pt2 * lpcpr;
  const Tt25 = Tt2 * (1 + (Math.pow(lpcpr, kc) - 1) / e.lpc);
  const Pt3 = Pt2 * opr;
  const Tt3 = Tt25 * (1 + (Math.pow(hpcpr, kc) - 1) / e.comp);
  const f = (CP_T * Tt4 - CP_C * Tt3) / (e.burner * H_FUEL - CP_T * Tt4);
  const Pt4 = Pt3 * e.burnerPR;
  const turbPR = (TtIn, TtOut, eta) => {
    const ideal = 1 - (1 - TtOut / TtIn) / eta;
    return ideal > 0 ? Math.pow(ideal, 1 / kt) : NaN;
  };

  // HPT drives the HP compressor (25 → 3). The LPT drives the fan tip for the bypass flow and
  // the fan hub + booster for the core flow. Match the fan to the work the LPT can deliver: if
  // the requested fan pressure ratio would leave the core nozzle below a 1.15 pressure ratio,
  // bisect the fan pressure ratio down.
  const Tt45 = Tt4 - (CP_C * (Tt3 - Tt25)) / (e.mech * (1 + f) * CP_T);
  const Pt45 = Pt4 * turbPR(Tt4, Tt45, e.hpt);
  const fanStation = (fprTry) => {
    const Pt13 = Pt2 * fprTry;
    const Tt13 = Tt2 * (1 + (Math.pow(fprTry, kc) - 1) / e.fan);
    const Tt5 = Tt45 - (CP_C * (c.bpr * (Tt13 - Tt2) + (Tt25 - Tt2))) / (e.mech * (1 + f) * CP_T);
    const Pt5 = Pt45 * turbPR(Tt45, Tt5, e.lpt);
    const ok = Tt5 > T0 && Number.isFinite(Pt5) && Pt5 > P0 * 1.15 && f > 0 && Tt45 > T0;
    return { Pt13, Tt13, Tt5, Pt5, ok };
  };
  const fprRequested = 1 + (c.fpr - 1) * n1c * n1c;
  let fpr = fprRequested;
  let st = fanStation(fpr);
  let fanLimited = false;
  if (!st.ok) {
    let lo = 1.0, hi = fpr;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (fanStation(mid).ok) lo = mid; else hi = mid;
    }
    fpr = lo;
    st = fanStation(fpr);
    fanLimited = true;
  }
  const { Pt13, Tt13, Tt5, Pt5 } = st;
  const valid = st.ok && fpr > 1.02;

  // ideally expanded nozzles with an isentropic-efficiency penalty
  const V9 = valid ? Math.sqrt(2 * CP_T * Tt5 * e.nozzle * (1 - Math.pow(P0 / Pt5, kt))) : 0;
  const T9 = valid ? Tt5 - (V9 * V9) / (2 * CP_T) : Tt5;
  const V19 = Pt13 > P0 ? Math.sqrt(2 * CP_C * Tt13 * e.nozzle * (1 - Math.pow(P0 / Pt13, kc))) : 0;
  const T19 = Tt13 - (V19 * V19) / (2 * CP_C);

  const specThrust = valid ? ((1 + f) * V9 - V0 + c.bpr * (V19 - V0)) / (1 + c.bpr) : 0;   // N/(kg/s)
  // airflow follows corrected flow: W√θ2/δ2 rises with corrected fan speed
  const m0 = GE90.massFlowSL * (Pt2 / 101325) / Math.sqrt(Tt2 / 288.15) * Math.pow(n1c, 2.2);
  const thrust = specThrust * m0;
  const mCore = m0 / (1 + c.bpr);
  const fuelFlow = f * mCore;
  const tsfc = thrust > 0 ? fuelFlow / thrust : NaN;          // kg/(N·s)
  const keGain = 0.5 * ((1 + f) * V9 * V9 + c.bpr * V19 * V19 - (1 + c.bpr) * V0 * V0);
  const etaTh = valid ? keGain / (f * H_FUEL) : 0;
  const etaP = keGain > 0 ? (specThrust * (1 + c.bpr) * V0) / keGain : 0;

  // entropy relative to freestream: s = cp ln(T/T0) − R ln(P/P0)
  const sC = (T, P) => CP_C * Math.log(T / T0) - R_C * Math.log(P / P0);
  const sT = (T, P) => sC(Tt3, Pt3) + CP_T * Math.log(T / Tt3) - R_T * Math.log(P / Pt3);

  const stations = [
    { id: '0', name: 'Freestream', T: T0, P: P0, s: 0 },
    { id: '2', name: 'Fan face', T: Tt2, P: Pt2, s: sC(Tt2, Pt2) },
    { id: '13', name: 'Fan exit (bypass)', T: Tt13, P: Pt13, s: sC(Tt13, Pt13) },
    { id: '25', name: 'Booster exit / HPC inlet', T: Tt25, P: Pt25, s: sC(Tt25, Pt25) },
    { id: '3', name: 'HPC exit', T: Tt3, P: Pt3, s: sC(Tt3, Pt3) },
    { id: '4', name: 'Combustor exit', T: Tt4, P: Pt4, s: sT(Tt4, Pt4) },
    { id: '45', name: 'HPT exit (EGT, T49)', T: Tt45, P: Pt45, s: sT(Tt45, Pt45) },
    { id: '5', name: 'LPT exit', T: Tt5, P: Pt5, s: sT(Tt5, Pt5) },
    { id: '9', name: 'Core nozzle', T: T9, P: P0, s: sT(T9, P0) },
    { id: '19', name: 'Fan nozzle', T: T19, P: P0, s: sC(T19, P0) },
  ];

  const n2 = (0.62 + 0.38 * Math.sqrt(thr)) * 100;
  return {
    input: c, atm, V0, valid, fanLimited, fprRequested, n1: n1 * 100, n2,
    n1Rpm: n1 * GE90.n1Rpm100, n2Rpm: (n2 / 100) * GE90.n2Rpm100,
    egt: Tt45, egtMargin: GE90.egtLimitK - Tt45,
    fpr, lpcpr, hpcpr, opr, f, Tt4, stations, V9, V19, specThrust, m0, mCore, thrust, fuelFlow, tsfc,
    etaTh, etaP, etaO: etaTh * etaP, byStation: Object.fromEntries(stations.map((s) => [s.id, s])),
  };
}
