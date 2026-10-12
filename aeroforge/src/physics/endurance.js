// Propeller-aircraft mission performance (Breguet endurance & range) for the KESTREL UAV.

import { isa, G0 } from './atmosphere.js';

export const KESTREL = {
  span: 20.1,            // m
  wingArea: 24.0,        // m²
  oswald: 0.82,
  cd0: 0.0245,
  massEmpty: 2223,       // kg
  maxFuel: 1800,         // kg
  maxPayload: 1700,      // kg
  mtow: 4760,            // kg
  propEff: 0.80,
  bsfc: 0.33,            // kg/(kW·h), turboprop
  clMax: 1.45,
};

const AR = (KESTREL.span ** 2) / KESTREL.wingArea;
const K = 1 / (Math.PI * AR * KESTREL.oswald);
// power-specific fuel consumption as weight flow per watt: N/(W·s)
const C_POWER = (KESTREL.bsfc * G0) / (1000 * 3600);

export function dragPolar(cl) {
  return KESTREL.cd0 + K * cl * cl;
}

/**
 * Constant-altitude, constant-airspeed cruise/loiter.
 * Endurance uses mid-mission lift coefficient; returns hours / km.
 */
export function mission({ fuel = 1300, payload = 450, altitude = 7600, speed = 80, transit = 0 }) {
  const atm = isa(altitude);
  const S = KESTREL.wingArea;
  const W0 = (KESTREL.massEmpty + fuel + payload) * G0;
  const W1 = (KESTREL.massEmpty + payload + fuel * 0.05) * G0;   // 5 % reserve
  const Wmid = Math.sqrt(W0 * W1);
  const q = 0.5 * atm.rho * speed * speed;
  const cl = Wmid / (q * S);
  const stall = cl > KESTREL.clMax;
  const cd = dragPolar(cl);
  const lOverD = cl / cd;
  const eta = KESTREL.propEff;
  const enduranceS = (eta / (C_POWER * speed)) * lOverD * Math.log(W0 / W1);
  const rangeM = (eta / C_POWER) * lOverD * Math.log(W0 / W1);
  const powerReq = (Wmid / lOverD) * speed / eta;     // shaft W at mid-mission
  const enduranceH = stall ? 0 : enduranceS / 3600;
  const transitH = (2 * transit * 1000) / speed / 3600;
  return {
    atm, cl, cd, lOverD, stall,
    endurance: enduranceH,
    range: stall ? 0 : rangeM / 1000,
    onStation: Math.max(0, enduranceH - transitH),
    powerKW: powerReq / 1000,
    takeoffMass: W0 / G0,
    overweight: W0 / G0 > KESTREL.mtow,
    // speed for maximum endurance (min power): CL = sqrt(3·CD0/K)
    vMaxEndurance: Math.sqrt((2 * Wmid) / (atm.rho * S * Math.sqrt((3 * KESTREL.cd0) / K))),
    vMaxRange: Math.sqrt((2 * Wmid) / (atm.rho * S * Math.sqrt(KESTREL.cd0 / K))),
  };
}

export function enduranceSweep(params, from = 40, to = 140, steps = 80) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const v = from + ((to - from) * i) / steps;
    const m = mission({ ...params, speed: v });
    out.push({ speed: v, endurance: m.stall ? NaN : m.endurance, range: m.stall ? NaN : m.range });
  }
  return out;
}
