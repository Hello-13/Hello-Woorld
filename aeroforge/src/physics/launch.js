// Planar (2-D) ascent simulation of the HELIOS-H heavy-lift launcher over a rotating,
// spherical Earth with ISA drag. Stage 1 flies a pitch-kick + gravity turn; the upper stage
// runs a closed-loop altitude/vertical-rate guidance law until orbital insertion.

import { isa, G0, P_SL } from './atmosphere.js';

export const MU_EARTH = 3.986004418e14;   // m³/s²
export const R_EARTH = 6371000;           // m (mean)
const OMEGA_EARTH = 7.2921159e-5;         // rad/s

export const HELIOS = {
  name: 'HELIOS-H',
  launchLatitude: 28.5,                   // deg
  booster: { count: 2, prop: 395700, dry: 22200, engines: 9, thrustVac: 914e3, ispSL: 282, ispVac: 311 },
  core: { prop: 395700, dry: 25600, engines: 9, thrustVac: 914e3, ispSL: 282, ispVac: 311 },
  upper: { prop: 107500, dry: 4500, engines: 1, thrustVac: 981e3, ispSL: 230, ispVac: 348 },
  fairing: 1900,
  coreThrottleDown: 0.55,
  coreThrottleTime: 48,
};

function cdOfMach(m) {
  if (m < 0.6) return 0.30;
  if (m < 1.1) return 0.30 + ((m - 0.6) / 0.5) * 0.28;
  if (m < 2.0) return 0.58 - ((m - 1.1) / 0.9) * 0.22;
  if (m < 5.0) return 0.36 - ((m - 2.0) / 3.0) * 0.12;
  return 0.24;
}

function engineThrust(stage, ambientP, throttle) {
  const mdotEngine = stage.thrustVac / (G0 * stage.ispVac);
  const isp = stage.ispVac - (stage.ispVac - stage.ispSL) * Math.min(1, ambientP / P_SL);
  const mdot = mdotEngine * stage.engines * throttle;
  return { thrust: mdot * G0 * isp, mdot };
}

/** Ideal Δv of a stage via the Tsiolkovsky rocket equation. */
export function tsiolkovsky(isp, m0, mf) {
  return isp * G0 * Math.log(m0 / mf);
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
  kickAngle = 14,       // deg, pitch-over angle at the end of the kick manoeuvre
  targetAltitude = 200e3,
  vehicle = HELIOS,
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
  let coastUntil = 0, upperIgnition = Infinity;

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
  ev('LIFTOFF', 'Liftoff — all 27 engines at full thrust');

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
    const coreThrottle = (phase === 'BOOST' && t > vehicle.coreThrottleTime) ? vehicle.coreThrottleDown : 1;
    if (phase === 'BOOST') {
      const b = engineThrust(B, atm.p, 1);
      const c = engineThrust(C, atm.p, coreThrottle);
      thrust = b.thrust * B.count + c.thrust;
      mdotB = b.mdot * B.count; mdotC = c.mdot;
    } else if (phase === 'CORE') {
      const c = engineThrust(C, atm.p, 1);
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
      const s = Math.max(-0.7, Math.min(0.9, need / aT));
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
        coreThrottle: phase === 'BOOST' ? coreThrottle : (phase === 'CORE' ? 1 : 0),
        ambientP: atm.p,
        drag: aDrag * m,
        weight: m * (MU_EARTH / (r * r)),
      });
      nextSample += sampleDt;
    }

    t += dt;

    // --- sequencing
    if (phase === 'BOOST' && t > vehicle.coreThrottleTime && !events.some((e) => e.code === 'THROTTLE')) {
      ev('THROTTLE', `Core throttle-down to ${Math.round(vehicle.coreThrottleDown * 100)} %`);
    }
    if (phase === 'BOOST' && boosterProp <= 0) {
      ev('BECO', 'Booster engine cutoff (BECO)');
      boostersAttached = false;
      phase = 'CORE';
      ev('BSEP', 'Side boosters separated');
    } else if (phase === 'CORE' && coreProp <= 0) {
      ev('MECO', 'Main engine cutoff (MECO)');
      phase = 'COAST';
      coastUntil = t + 3;
      upperIgnition = t + 7;
    } else if (phase === 'COAST' && coreAttached && t >= coastUntil) {
      coreAttached = false;
      ev('SEP', 'Stage separation');
    } else if (phase === 'COAST' && !coreAttached && t >= upperIgnition) {
      phase = 'UPPER';
      ev('SES', 'Upper stage ignition (SES-1)');
    } else if (phase === 'UPPER') {
      if (fairingAttached && h > 110e3 && t > upperIgnition + 4) {
        fairingAttached = false;
        ev('FAIRING', 'Payload fairing jettison');
      }
      const el = planarElements(r, vr, vt);
      if (el.rp - R_EARTH >= targetAltitude - 8e3 || upperProp <= 0) {
        phase = el.rp - R_EARTH > 120e3 ? 'ORBIT' : 'FAILED';
        ev('SECO', upperProp <= 0 ? 'Upper stage propellant depleted (SECO)' : 'Second engine cutoff (SECO)');
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

  function dragArea() {
    if (boostersAttached) return 42.7;
    if (fairingAttached) return 21.2;
    return 10.75;
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
