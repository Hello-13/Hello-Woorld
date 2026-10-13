// Planar (2-D) ascent simulation of the SpaceX Falcon Heavy from LC-39A over a rotating,
// spherical Earth with ISA drag. All 27 Merlin 1D engines light at liftoff; the centre core
// throttles down so it is still burning after the side boosters separate; stage 1 flies a
// pitch-kick + gravity turn; the second stage (one Merlin Vacuum) runs a closed-loop
// altitude/vertical-rate guidance law until orbital insertion.
//
// Engine model: each engine has a fixed mass flow ṁ = F_vac / (g0 · Isp_vac) at full throttle and
// a thrust that falls with ambient pressure, F = F_vac − p_a · A_e. The nozzle exit area A_e is the
// one that reproduces the published sea-level thrust (845 kN Merlin 1D → A_e ≈ 0.68 m², a 0.93 m
// exit). The published Merlin figures (845 / 914 kN, 282 / 311 s) do not all hold at one mass
// flow; keeping both thrusts and the vacuum Isp gives a sea-level Isp of ≈ 287 s.

import { isa, G0, P_SL } from './atmosphere.js';

export const MU_EARTH = 3.986004418e14;   // m³/s²
export const R_EARTH = 6371000;           // m (mean)
const OMEGA_EARTH = 7.2921159e-5;         // rad/s

const MERLIN_1D = { thrustSL: 845e3, thrustVac: 914e3, ispSL: 282, ispVac: 311 };
const MERLIN_VAC = { thrustSL: 0, thrustVac: 981e3, ispSL: 0, ispVac: 348, exitArea: 7.07 };

/**
 * Falcon Heavy (Block 5) in its fully expendable configuration. Propellant loads follow the
 * Falcon 9 figures in public references (first stage 395.7 t; second stage 107.5 t = 75.2 t LOX +
 * 32.3 t RP-1, gross 111.5 t); dry masses are estimates (SpaceX does not publish them; the centre
 * core is taken heavier than a side booster for its thicker walls and separation hardware).
 * With these numbers the liftoff mass without payload is 1,379.7 t; SpaceX's published
 * 1,420,788 kg corresponds to a payload of about 41 t.
 */
export const FALCON_HEAVY = {
  name: 'Falcon Heavy',
  launchLatitude: 28.608,                 // deg, LC-39A
  booster: { count: 2, prop: 395700, dry: 25600, engines: 9, ...MERLIN_1D },
  core: { prop: 395700, dry: 28000, engines: 9, ...MERLIN_1D },
  upper: { prop: 107500, dry: 4000, engines: 1, ...MERLIN_VAC },
  fairing: 1900,
  coreThrottleDown: 0.55,                 // centre-core throttle setting during the booster phase (estimate)
  coreThrottleTime: 40,                   // s after liftoff (SpaceX: "shortly after liftoff")
  sepDelay: 3,                            // MECO → stage separation, s
  sesDelay: 10,                           // MECO → second-engine start, s
  boosterSepDelay: 3,                     // BECO → side-booster separation, s
};

/** Nozzle exit area that turns a stage's vacuum thrust into its sea-level thrust (m², per engine). */
export function exitArea(stage) {
  if (stage.exitArea != null) return stage.exitArea;
  return (stage.thrustVac - stage.thrustSL) / P_SL;
}

/** Liftoff mass (kg) of a vehicle with a given payload. */
export function liftoffMass(vehicle = FALCON_HEAVY, payload = 0) {
  const B = vehicle.booster, C = vehicle.core, U = vehicle.upper;
  return B.count * (B.dry + B.prop) + C.dry + C.prop + U.dry + U.prop + vehicle.fairing + payload;
}

function cdOfMach(m) {
  if (m < 0.6) return 0.30;
  if (m < 1.1) return 0.30 + ((m - 0.6) / 0.5) * 0.28;
  if (m < 2.0) return 0.58 - ((m - 1.1) / 0.9) * 0.22;
  if (m < 5.0) return 0.36 - ((m - 2.0) / 3.0) * 0.12;
  return 0.24;
}

/** Thrust (N) and mass flow (kg/s) of all of a stage's engines at ambient pressure p (Pa). */
export function engineThrust(stage, ambientP, throttle = 1) {
  const mdotEngine = stage.thrustVac / (G0 * stage.ispVac);
  const perEngine = Math.max(0, stage.thrustVac - ambientP * exitArea(stage));
  return { thrust: perEngine * stage.engines * throttle, mdot: mdotEngine * stage.engines * throttle };
}

/** Ideal Δv of a stage via the Tsiolkovsky rocket equation. */
export function tsiolkovsky(isp, m0, mf) {
  return isp * G0 * Math.log(m0 / mf);
}

/**
 * Ideal (loss-free) Δv of each burn phase from the rocket equation, with the throttle schedule
 * of simulateAscent: boost (27 engines, centre core throttled), centre core alone, second stage.
 * Isp is the mean of sea-level and vacuum for the boost phase, vacuum afterwards.
 */
export function deltaVBudget(vehicle = FALCON_HEAVY, payload = 0) {
  const B = vehicle.booster, C = vehicle.core, U = vehicle.upper;
  const mdot = (s) => (s.thrustVac / (G0 * s.ispVac)) * s.engines;
  const ispSL = (s) => (s.ispVac * (s.thrustVac - P_SL * exitArea(s))) / s.thrustVac;
  const tBoost = B.prop / mdot(B);                       // each booster burns its own load
  const kT = vehicle.coreThrottleTime, kD = vehicle.coreThrottleDown;
  const coreInBoost = Math.min(C.prop, mdot(C) * (Math.min(kT, tBoost) + Math.max(0, tBoost - kT) * kD));
  const m0 = liftoffMass(vehicle, payload);
  const m1 = m0 - B.count * B.prop - coreInBoost;
  const m1b = m1 - B.count * B.dry;
  const m2 = m1b - (C.prop - coreInBoost);
  const mU = U.dry + U.prop + payload;                     // fairing goes early in the burn
  const boost = tsiolkovsky((ispSL(B) + B.ispVac) / 2, m0, m1);
  const core = tsiolkovsky(C.ispVac, m1b, m2);
  const upper = tsiolkovsky(U.ispVac, mU, mU - U.prop);
  return { boost, core, upper, total: boost + core + upper, tBoost, coreInBoost, m0 };
}

/** Orbital elements from planar state. */
export function planarElements(r, vr, vt) {
  const v2 = vr * vr + vt * vt;
  const energy = v2 / 2 - MU_EARTH / r;
  const h = r * vt;
  const a = -MU_EARTH / (2 * energy);
  const e = Math.sqrt(Math.max(0, 1 + (2 * energy * h * h) / (MU_EARTH * MU_EARTH)));
  const rp = (h * h) / (MU_EARTH * (1 + e));
  const ra = energy < 0 ? a * (1 + e) : Infinity;
  return { a, e, rp, ra, energy };
}

/**
 * Run the full ascent. Returns { samples, events, result }.
 * samples are taken every `sampleDt` seconds of mission time for playback and charts.
 */
export function simulateAscent({
  payload = 15000,
  kickAngle = 16,       // deg, pitch-over angle at the end of the kick manoeuvre
  targetAltitude = 200e3,
  vehicle = FALCON_HEAVY,
  dt = 0.05,
  sampleDt = 0.5,
  maxTime = 900,
} = {}) {
  const B = vehicle.booster, C = vehicle.core, U = vehicle.upper;
  const lat = (vehicle.launchLatitude * Math.PI) / 180;
  const wEff = OMEGA_EARTH * Math.cos(lat);   // eastward launch: planar co-rotation rate

  let boosterProp = B.prop * B.count;
  let coreProp = C.prop;
  let upperProp = U.prop;
  let boostersAttached = true, coreAttached = true, fairingAttached = true;
  let phase = 'BOOST';                     // BOOST → CORE → COAST → UPPER → ORBIT | FAILED
  let coastUntil = 0, upperIgnition = Infinity, boosterSepAt = Infinity;

  const mass = () =>
    (boostersAttached ? B.count * B.dry + boosterProp : 0) +
    (coreAttached ? C.dry + coreProp : 0) +
    U.dry + upperProp + (fairingAttached ? vehicle.fairing : 0) + payload;

  // state: r, theta, vr, vt (inertial, planar)
  let r = R_EARTH, th = 0, vr = 0, vt = wEff * R_EARTH;
  let t = 0;
  const samples = [];
  const events = [];
  let maxQ = { q: 0, t: 0 };
  let lastPitch = 0;
  let nextSample = 0;
  let result = null;
  const ev = (code, label) => events.push({ t, code, label });
  ev('LIFTOFF', 'Liftoff — 27 Merlin 1D engines, hold-down clamps released');

  while (t < maxTime) {
    const h = r - R_EARTH;
    const atm = isa(h);
    const vtAir = vt - wEff * r;
    const vAir = Math.hypot(vr, vtAir);
    const mach = vAir / atm.a;
    const q = 0.5 * atm.rho * vAir * vAir;
    if (q > maxQ.q) maxQ = { q, t };

    // --- propulsion state
    let thrust = 0, mdotB = 0, mdotC = 0, mdotU = 0;
    const coreThrottle = (boostersAttached && t > vehicle.coreThrottleTime) ? vehicle.coreThrottleDown : 1;
    if (phase === 'BOOST') {
      const b = engineThrust(B, atm.p, 1);
      const c = engineThrust(C, atm.p, coreThrottle);
      thrust = b.thrust * B.count + c.thrust;
      mdotB = b.mdot * B.count; mdotC = c.mdot;
    } else if (phase === 'CORE') {
      const c = engineThrust(C, atm.p, coreThrottle);
      thrust = c.thrust; mdotC = c.mdot;
    } else if (phase === 'UPPER') {
      const u = engineThrust(U, atm.p, 1);
      thrust = u.thrust; mdotU = u.mdot;
    }

    // --- guidance: pitch angle measured from local vertical toward downrange
    let pitch;
    if (phase === 'UPPER') {
      // Terminal guidance: a linear radial-acceleration profile that arrives at the target
      // altitude with zero vertical rate exactly when circular velocity is reached.
      const g = MU_EARTH / (r * r);
      const m0 = mass();
      const aT = thrust / m0;
      const mdot = mdotU || 1;
      const rT = R_EARTH + targetAltitude;
      const dvGo = Math.max(0, Math.sqrt(MU_EARTH / rT) - vt);
      const ve = thrust / mdot;
      let tGo = (m0 / mdot) * (1 - Math.exp(-dvGo / ve));
      tGo = Math.max(tGo, 12);
      const dh = targetAltitude - h;
      const B = (-12 * (dh - (vr * tGo) / 2)) / (tGo ** 3);
      const A = -vr / tGo - (B * tGo) / 2;
      const need = A + g - (vt * vt) / r;
      const s = Math.max(-0.4, Math.min(0.9, need / aT));      // never more than ≈ 24° nose-down
      pitch = Math.PI / 2 - Math.asin(s);
    } else if (t < 7) {
      pitch = 0;
    } else if (t < 17) {
      pitch = ((kickAngle * Math.PI) / 180) * ((t - 7) / 10);
    } else {
      const flightPath = Math.atan2(vtAir, vr);     // angle of air-relative velocity from vertical
      pitch = Math.max(flightPath, (kickAngle * Math.PI) / 180);
    }
    if (phase === 'COAST' || phase === 'ORBIT') pitch = Math.atan2(vt, vr);
    lastPitch = pitch;

    const m = mass();
    const aThrust = thrust / m;
    const aDrag = vAir > 1 ? (q * cdOfMach(mach) * dragArea()) / m : 0;
    const dvr = vAir > 1 ? vr / vAir : 0;
    const dvt = vAir > 1 ? vtAir / vAir : 0;

    const deriv = (rr, vrr, vtt) => {
      const g = MU_EARTH / (rr * rr);
      return {
        dr: vrr,
        dth: vtt / rr,
        dvr: aThrust * Math.cos(pitch) - aDrag * dvr - g + (vtt * vtt) / rr,
        dvt: aThrust * Math.sin(pitch) - aDrag * dvt - (vrr * vtt) / rr,
      };
    };
    // RK4 on the translational state (forces frozen over the step)
    const k1 = deriv(r, vr, vt);
    const k2 = deriv(r + k1.dr * dt / 2, vr + k1.dvr * dt / 2, vt + k1.dvt * dt / 2);
    const k3 = deriv(r + k2.dr * dt / 2, vr + k2.dvr * dt / 2, vt + k2.dvt * dt / 2);
    const k4 = deriv(r + k3.dr * dt, vr + k3.dvr * dt, vt + k3.dvt * dt);
    r += (dt / 6) * (k1.dr + 2 * k2.dr + 2 * k3.dr + k4.dr);
    th += (dt / 6) * (k1.dth + 2 * k2.dth + 2 * k3.dth + k4.dth);
    vr += (dt / 6) * (k1.dvr + 2 * k2.dvr + 2 * k3.dvr + k4.dvr);
    vt += (dt / 6) * (k1.dvt + 2 * k2.dvt + 2 * k3.dvt + k4.dvt);

    boosterProp = Math.max(0, boosterProp - mdotB * dt);
    coreProp = Math.max(0, coreProp - mdotC * dt);
    upperProp = Math.max(0, upperProp - mdotU * dt);

    if (t >= nextSample) {
      samples.push({
        t, h, v: Math.hypot(vr, vt), vAir, mach, q,
        downrange: R_EARTH * (th - wEff * t),
        accel: aThrust / G0, pitch: (lastPitch * 180) / Math.PI,
        mass: m, phase, thrust,
        boostersAttached, coreAttached, fairingAttached,
        enginesOn: { booster: mdotB > 0, core: mdotC > 0, upper: mdotU > 0 },
        coreThrottle: phase === 'BOOST' || phase === 'CORE' ? coreThrottle : 0,
        ambientP: atm.p,
        drag: aDrag * m,
        weight: m * (MU_EARTH / (r * r)),
      });
      nextSample += sampleDt;
    }

    t += dt;

    // --- sequencing
    if (phase === 'BOOST' && t > vehicle.coreThrottleTime && !events.some((e) => e.code === 'THROTTLE')) {
      ev('THROTTLE', `Centre core throttles down to ${Math.round(vehicle.coreThrottleDown * 100)} %`);
    }
    if (phase === 'BOOST' && boosterProp <= 0) {
      ev('BECO', 'Booster engine cutoff (BECO), side boosters');
      phase = 'CORE';
      boosterSepAt = t + vehicle.boosterSepDelay;
    } else if (phase === 'CORE' && boostersAttached && t >= boosterSepAt) {
      boostersAttached = false;
      ev('BSEP', 'Side boosters separate (pneumatic pushers)');
      ev('THROTTLE_UP', 'Centre core throttles back up to full thrust');
    } else if (phase === 'CORE' && coreProp <= 0) {
      ev('MECO', 'Main engine cutoff (MECO), centre core');
      phase = 'COAST';
      coastUntil = t + vehicle.sepDelay;
      upperIgnition = t + vehicle.sesDelay;
    } else if (phase === 'COAST' && coreAttached && t >= coastUntil) {
      coreAttached = false;
      ev('SEP', 'Stage separation (interstage pusher)');
    } else if (phase === 'COAST' && !coreAttached && t >= upperIgnition) {
      phase = 'UPPER';
      ev('SES', 'Second-engine start (SES-1), Merlin Vacuum');
    } else if (phase === 'UPPER') {
      if (fairingAttached && h > 110e3 && t > upperIgnition + 4) {
        fairingAttached = false;
        ev('FAIRING', 'Payload fairing separation');
      }
      const el = planarElements(r, vr, vt);
      if (el.rp - R_EARTH >= targetAltitude - 8e3 || upperProp <= 0) {
        phase = el.rp - R_EARTH > 120e3 ? 'ORBIT' : 'FAILED';
        ev('SECO', upperProp <= 0 ? 'Second stage propellant depleted (SECO-1)' : 'Second-engine cutoff (SECO-1)');
        result = {
          success: phase === 'ORBIT',
          perigee: el.rp - R_EARTH,
          apogee: el.ra - R_EARTH,
          time: t,
          upperPropRemaining: upperProp,
          velocity: Math.hypot(vr, vt),
        };
        if (phase === 'ORBIT') ev('ORBIT', `Orbit insertion · ${Math.round(result.perigee / 1e3)} × ${Math.round(result.apogee / 1e3)} km`);
        else ev('FAILED', 'Suborbital: payload exceeds vehicle capability');
        break;
      }
    }
    if (h < -10) {
      phase = 'FAILED';
      result = { success: false, perigee: 0, apogee: 0, time: t, upperPropRemaining: upperProp, velocity: 0 };
      ev('FAILED', 'Vehicle lost: ground impact');
      break;
    }
  }

  // append a final sample at cutoff so playback ends exactly on SECO
  const hF = r - R_EARTH;
  const atmF = isa(hF);
  samples.push({
    t, h: hF, v: Math.hypot(vr, vt), vAir: Math.hypot(vr, vt - wEff * r), mach: 0, q: 0,
    downrange: R_EARTH * (th - wEff * t), accel: 0, pitch: (lastPitch * 180) / Math.PI,
    mass: mass(), phase, thrust: 0, boostersAttached, coreAttached, fairingAttached,
    enginesOn: { booster: false, core: false, upper: false }, coreThrottle: 0, ambientP: atmF.p,
    drag: 0, weight: mass() * (MU_EARTH / (r * r)),
  });

  events.push({ t: maxQ.t, code: 'MAXQ', label: `Max-Q · ${(maxQ.q / 1000).toFixed(1)} kPa` });
  events.sort((a, b) => a.t - b.t);
  if (!result) result = { success: false, perigee: 0, apogee: 0, time: t, upperPropRemaining: upperProp, velocity: 0 };
  result.maxQ = maxQ;
  return { samples, events, result };

  // frontal area: 5.2 m fairing (21.2 m²) plus two 3.66 m side boosters (2 × 10.5 m²), then the
  // fairing alone, then the bare 3.66 m second stage
  function dragArea() {
    if (boostersAttached) return 42.3;
    if (fairingAttached) return 21.2;
    return 10.5;
  }
}

/** Linear interpolation of a sample stream at time t (samples are evenly spaced). */
export function sampleAt(samples, t) {
  if (!samples.length) return null;
  if (t <= samples[0].t) return samples[0];
  const last = samples[samples.length - 1];
  if (t >= last.t) return last;
  let lo = 0, hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].t <= t) lo = mid; else hi = mid;
  }
  const a = samples[lo], b = samples[hi];
  const f = (t - a.t) / (b.t - a.t || 1);
  const out = { ...a };
  for (const k of ['h', 'v', 'vAir', 'mach', 'q', 'downrange', 'accel', 'pitch', 'mass', 'thrust', 'ambientP', 'drag', 'weight']) {
    out[k] = a[k] + (b[k] - a[k]) * f;
  }
  out.t = t;
  return out;
}
