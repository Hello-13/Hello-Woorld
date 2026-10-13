// Separate-exhaust, two-spool turbofan cycle (non-ideal Brayton cycle, Mattingly-style),
// tuned to the GE Aerospace GE90-115B at its sea-level-static take-off rating.
// Station numbering follows SAE ARP755: 0 freestream, 2 fan face, 13 fan (bypass) exit,
// 25 booster exit = HPC inlet, 3 HPC exit, 4 combustor exit, 45 HPT exit / LPT inlet
// (the GE90 measures EGT here, as T49), 5 LPT exit, 9 / 19 core / fan nozzle exits.
//
// Spools: the LP spool (fan + 4-stage booster) is driven by the 6-stage LPT; the HP spool
// (9-stage HPC) by the 2-stage HPT.
//
// Design point and operating point. The cycle-design inputs (fan, booster and overall pressure
// ratios, combustor exit temperature, bypass ratio) describe the engine at its design point:
// sea-level static take-off on a standard day. Every other condition is off-design, solved the
// way the FADEC runs the real engine:
//   1. the thrust lever sets an N1 demand (the GE90's thrust-setting parameter), from ground idle
//      (about 22 %) to 100 %; the fan then runs at corrected speed N1/√θ2, held to a maximum of
//      102 % of the design value (cold air at altitude would otherwise overspeed it aerodynamically);
//   2. the compressors follow their operating lines: their temperature rise scales with the square
//      of corrected speed (N2 follows N1 along a fixed matching line), so a cold, fast-flying engine
//      at the same corrected speed has the same pressure ratios as on the ground;
//   3. airflow follows corrected flow (δ2/√θ2 times a function of corrected speed);
//   4. the burner temperature is whatever balances both spools with the engine pressure ratio
//      EPR = Pt5/Pt2 on its operating line (EPR falls towards 1 at idle as the turbines unload).
// At the design point all of this reduces to the design inputs exactly, and at the same corrected
// speed in flight every temperature ratio equals the design value — the similarity a real engine
// shows. The fan is "work-limited" only when the design inputs ask for more fan work than the LP
// turbine can deliver at the design point; the fan pressure ratio is then bisected down.

import { isa } from './atmosphere.js';

const CP_C = 1004.5, GAMMA_C = 1.4;     // cold section
const CP_T = 1150.0, GAMMA_T = 1.33;    // hot section
const R_C = CP_C * (GAMMA_C - 1) / GAMMA_C;
const R_T = CP_T * (GAMMA_T - 1) / GAMMA_T;
const H_FUEL = 42.798e6;                // J/kg, fuel lower heating value the ratings assume (EASA TCDS IM.E.002, note 6)
const kc = (GAMMA_C - 1) / GAMMA_C, kt = (GAMMA_T - 1) / GAMMA_T;

/** Published GE90-115B figures used by the model (EASA TCDS IM.E.002, GE, Aircraft Commerce). */
export const GE90 = {
  name: 'GE90-115B',
  // Take-off airflow is not published. ≈ 1,560 kg/s (3,440 lb/s) is the modelled value that gives
  // the certified thrust with the modelled fan pressure ratio; it is about 12 % above the 1,350 kg/s
  // quoted for the earlier GE90-94B, as Aircraft Commerce describes for the -110B/-115B fan.
  massFlowSL: 1560,       // kg/s total airflow at sea-level static, take-off (modelled)
  fanDiameter: 3.25,      // m (128 in)
  ratedThrust: 513.95e3,  // N (51,395 daN = 115,540 lbf certified take-off, EASA TCDS IM.E.002)
  n1Rpm100: 2355,         // rpm at 100 % N1 (TCDS)
  n2Rpm100: 9332,         // rpm at 100 % N2 (TCDS)
  n1RpmMax: 2602,         // rpm (110.5 %), take-off and maximum-continuous N1 limit (TCDS)
  n2RpmMax: 11292,        // rpm (121.0 %), take-off and maximum-continuous N2 limit (TCDS)
  egtLimitK: 1363,        // K, take-off EGT (T49) limit 1,090 °C (TCDS)
  egtMaxContK: 1323,      // K, maximum-continuous EGT limit 1,050 °C (TCDS)
};
// kept for older imports
export const TF90 = GE90;

/** Part-power schedule (modelled; GE does not publish its control schedules). */
export const SCHEDULE = {
  n1Idle: 0.22,           // ground-idle N1 demand, fraction of 100 %
  n2Idle: 0.63,           // N2 when the fan turns at ground-idle corrected speed
  n1cMax: 1.02,           // corrected-fan-speed limit (fraction of the design value)
  fanExp: 2.2,            // compressor temperature rise ∝ (corrected speed)^fanExp
  flowExp: 1.0,           // corrected airflow ∝ n^(flowExp + n)
  eprExp: 0.8,            // EPR − 1 ∝ (corrected speed)^eprExp
  effLoss: 0.35,          // component efficiency × (1 − effLoss (1 − n)²) away from design speed n = 1
};

/** N1 demand (fraction of 100 %) for a thrust-lever position 0 (idle) … 1 (take-off). */
export const n1Demand = (throttle) => SCHEDULE.n1Idle + (1 - SCHEDULE.n1Idle) * Math.min(1, Math.max(0, throttle));
/** Corrected core speed on the spool-matching line, from corrected fan speed (fractions of design). */
export function n2Line(n1c) {
  if (n1c >= 1) return 1 + 0.35 * (n1c - 1);
  return 1 - (1 - SCHEDULE.n2Idle) * Math.pow(Math.max(0, 1 - n1c) / (1 - SCHEDULE.n1Idle), 1.25);
}

/**
 * 777-300ER operating points used by the lab: sea-level static take-off, maximum climb through
 * 5 km, and cruise at FL350 and Mach 0.84 with the thrust lever set for about 80 kN per engine (a
 * 777-300ER early in its cruise needs roughly 75–85 kN from each engine).
 */
export const OPERATING_POINTS = {
  takeoff: { altitude: 0, mach: 0, throttle: 1, label: 'Take-off' },
  climb: { altitude: 5000, mach: 0.55, throttle: 1, label: 'Max climb' },
  cruise: { altitude: 10668, mach: 0.84, throttle: 0.84, label: 'Cruise M0.84' },
};

export const DEFAULT_CYCLE = {
  altitude: 0, mach: 0, throttle: 1,
  // fan tip PR, booster PR (fan hub + 4 booster stages), overall PR, combustor exit T, BPR, all
  // at the sea-level-static take-off design point.
  // GE90-115B take-off: OPR 42 (GE). BPR 7.2 (Aircraft Commerce, -115B); the 8–9 often quoted
  // belongs to the earlier -76B…-94B. Fan PR, booster PR and combustor exit temperature are
  // not published — they are chosen so 514 kN and a T49 (EGT) under the 1,090 °C limit result.
  fpr: 1.75, lpcpr: 2.3, opr: 42, tit: 1680, bpr: 7.2,
  // isentropic component efficiencies typical of a 2000s high-bypass engine
  eff: { inlet: 0.995, fan: 0.93, lpc: 0.9, comp: 0.89, burner: 0.995, burnerPR: 0.955, hpt: 0.92, lpt: 0.935, mech: 0.99, nozzle: 0.98 },
};

const turbPR = (TtIn, TtOut, eta) => {
  const ideal = 1 - (1 - TtOut / TtIn) / eta;
  return ideal > 0 ? Math.pow(ideal, 1 / kt) : NaN;
};

/**
 * One pass through the gas path for given inlet conditions, compressor pressure ratios, burner
 * exit temperature and fan pressure ratio. ok is false when the turbines cannot supply the work.
 */
function gasPath({ T0, P0, Tt2, Pt2, lpcpr, hpcpr, Tt4, fpr, bpr, e, minNpr = 1.02 }) {
  const Pt25 = Pt2 * lpcpr;
  const Tt25 = Tt2 * (1 + (Math.pow(lpcpr, kc) - 1) / e.lpc);
  const Pt3 = Pt25 * hpcpr;
  const Tt3 = Tt25 * (1 + (Math.pow(hpcpr, kc) - 1) / e.comp);
  const f = (CP_T * Tt4 - CP_C * Tt3) / (e.burner * H_FUEL - CP_T * Tt4);
  const Pt4 = Pt3 * e.burnerPR;
  // HP spool: cp_c (Tt3 − Tt25) = η_m (1 + f) cp_t (Tt4 − Tt45)
  const Tt45 = Tt4 - (CP_C * (Tt3 - Tt25)) / (e.mech * (1 + f) * CP_T);
  const Pt45 = Pt4 * turbPR(Tt4, Tt45, e.hpt);
  // LP spool, per kg of core air: cp_c [BPR (Tt13 − Tt2) + (Tt25 − Tt2)] = η_m (1 + f) cp_t (Tt45 − Tt5)
  const Pt13 = Pt2 * fpr;
  const Tt13 = Tt2 * (1 + (Math.pow(fpr, kc) - 1) / e.fan);
  const Tt5 = Tt45 - (CP_C * (bpr * (Tt13 - Tt2) + (Tt25 - Tt2))) / (e.mech * (1 + f) * CP_T);
  const Pt5 = Pt45 * turbPR(Tt45, Tt5, e.lpt);
  const ok = f > 0 && Tt45 > T0 && Tt5 > T0 && Number.isFinite(Pt5) && Pt5 > P0 * minNpr;
  return { Pt25, Tt25, Pt3, Tt3, f, Pt4, Tt45, Pt45, Pt13, Tt13, Tt5, Pt5, ok };
}

/** The design point (sea-level static, standard day) from the cycle-design inputs. */
function designPoint(c, e) {
  const T0 = 288.15, P0 = 101325, Tt2 = T0, Pt2 = P0 * e.inlet;
  const hpcpr = c.opr / c.lpcpr;
  const at = (fpr) => gasPath({ T0, P0, Tt2, Pt2, lpcpr: c.lpcpr, hpcpr, Tt4: c.tit, fpr, bpr: c.bpr, e, minNpr: 1.15 });
  let fpr = c.fpr, g = at(fpr), fanLimited = false;
  if (!g.ok) {
    // the LPT cannot drive the requested fan: bisect the fan pressure ratio down
    let lo = 1.0, hi = fpr;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (at(mid).ok) lo = mid; else hi = mid; }
    fpr = lo; g = at(fpr); fanLimited = true;
  }
  return { fpr, fanLimited, ok: g.ok && fpr > 1.02, epr: g.Pt5 / Pt2, Tt25: g.Tt25,
    tauF: 1 + (Math.pow(fpr, kc) - 1) / e.fan, tauL: 1 + (Math.pow(c.lpcpr, kc) - 1) / e.lpc, tauH: 1 + (Math.pow(hpcpr, kc) - 1) / e.comp };
}

/**
 * Solve the cycle. Returns station table, performance and validity flags. throttle is the thrust
 * lever: 0 ground idle … 1 take-off N1.
 */
export function solveTurbofan(input = {}) {
  const c = { ...DEFAULT_CYCLE, ...input, eff: { ...DEFAULT_CYCLE.eff, ...(input.eff || {}) } };
  const e = c.eff;
  if (e.turb != null) { e.hpt = e.turb; e.lpt = e.turb; }
  const atm = isa(c.altitude);
  const T0 = atm.T, P0 = atm.p;
  const a0 = Math.sqrt(GAMMA_C * R_C * T0);
  const V0 = c.mach * a0;
  const Tt0 = T0 * (1 + 0.5 * (GAMMA_C - 1) * c.mach ** 2);
  const Pt0 = P0 * Math.pow(Tt0 / T0, 1 / kc);
  const Tt2 = Tt0, Pt2 = Pt0 * e.inlet;
  const theta2 = Tt2 / 288.15;

  const D = designPoint(c, e);
  // 1. N1 demand → corrected fan speed, within the corrected-speed limit
  const thr = Math.min(1, Math.max(0, c.throttle));
  const n1cWanted = n1Demand(thr) / Math.sqrt(theta2);
  const n1c = Math.min(SCHEDULE.n1cMax, n1cWanted);
  const speedLimited = n1cWanted > SCHEDULE.n1cMax + 1e-9;
  const n2c = n2Line(n1c);
  // far from their design speed the compressors and turbines lose efficiency (off-design incidence)
  const loss = (n) => 1 - SCHEDULE.effLoss * Math.pow(Math.max(0, 1 - n), 2);
  const eOp = { ...e, fan: e.fan * loss(n1c), lpc: e.lpc * loss(n1c), lpt: e.lpt * loss(n1c), comp: e.comp * loss(n2c), hpt: e.hpt * loss(n2c) };
  // 2. operating lines: temperature rise ∝ (corrected speed)^fanExp
  const sc = (n) => Math.pow(n, SCHEDULE.fanExp);
  const fprOp = Math.pow(1 + eOp.fan * (D.tauF - 1) * sc(n1c), 1 / kc);
  const lpcpr = Math.pow(1 + eOp.lpc * (D.tauL - 1) * sc(n1c), 1 / kc);
  const hpcpr = Math.pow(1 + eOp.comp * (D.tauH - 1) * sc(n2c), 1 / kc);
  const opr = lpcpr * hpcpr;
  // 4. burner temperature from the EPR operating line (bisection: EPR rises with Tt4)
  const eprTarget = 1 + (D.epr - 1) * Math.pow(n1c, SCHEDULE.eprExp);
  const run = (Tt4) => gasPath({ T0, P0, Tt2, Pt2, lpcpr, hpcpr, Tt4, fpr: fprOp, bpr: c.bpr, e: eOp });
  const Tt3guess = Tt2 * (1 + (Math.pow(opr, kc) - 1) / eOp.comp);
  let lo = Tt3guess + 5, hi = 2600;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    const g = run(mid);
    if (Number.isFinite(g.Pt5) && g.Tt5 > 0 && g.Pt5 / Pt2 >= eprTarget) hi = mid; else lo = mid;
  }
  const Tt4 = hi;
  const g = run(Tt4);
  const { Pt25, Tt25, Pt3, Tt3, f, Pt4, Tt45, Pt45, Pt13, Tt13, Tt5, Pt5 } = g;
  const fpr = fprOp, fanLimited = D.fanLimited;
  const valid = D.ok && g.ok && Tt4 < 2599;

  // ideally expanded nozzles with an isentropic-efficiency penalty
  const V9 = valid ? Math.sqrt(2 * CP_T * Tt5 * e.nozzle * (1 - Math.pow(P0 / Pt5, kt))) : 0;
  const T9 = valid ? Tt5 - (V9 * V9) / (2 * CP_T) : Tt5;
  const V19 = Pt13 > P0 ? Math.sqrt(2 * CP_C * Tt13 * e.nozzle * (1 - Math.pow(P0 / Pt13, kc))) : 0;
  const T19 = Tt13 - (V19 * V19) / (2 * CP_C);

  const specThrust = valid ? ((1 + f) * V9 - V0 + c.bpr * (V19 - V0)) / (1 + c.bpr) : 0;   // N/(kg/s)
  // 3. airflow follows corrected flow: W√θ2/δ2 rises with corrected fan speed
  const m0 = GE90.massFlowSL * (Pt2 / (101325 * e.inlet)) / Math.sqrt(theta2) * Math.pow(n1c, SCHEDULE.flowExp + n1c);
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

  // physical spool speeds: corrected speed × √θ2 (both spools are referred to fan-face temperature)
  const n1 = n1c * Math.sqrt(theta2) * 100;
  const n2 = n2c * Math.sqrt(theta2) * 100;
  return {
    input: c, atm, V0, valid, fanLimited, fprRequested: c.fpr, fprDesign: D.fpr, speedLimited, n1, n2, n1c, n2c,
    n1Rpm: (n1 / 100) * GE90.n1Rpm100, n2Rpm: (n2 / 100) * GE90.n2Rpm100,
    egt: Tt45, egtMargin: GE90.egtLimitK - Tt45, epr: Pt5 / Pt2,
    fpr, lpcpr, hpcpr, opr, f, Tt4, stations, V9, V19, specThrust, m0, mCore, thrust, fuelFlow, tsfc,
    etaTh, etaP, etaO: etaTh * etaP, byStation: Object.fromEntries(stations.map((s) => [s.id, s])),
  };
}
