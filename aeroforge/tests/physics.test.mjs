// Physics regression tests: `npm test` (node --test). Reference values come from the
// 1976 Standard Atmosphere tables and textbook orbital-mechanics results.

import test from 'node:test';
import assert from 'node:assert/strict';
import { isa, recoveryTemperature } from '../src/physics/atmosphere.js';
import { flightState, psSweep, liftSlope } from '../src/physics/aero.js';
import { simulateAscent, sampleAt, tsiolkovsky, planarElements, MU_EARTH, R_EARTH } from '../src/physics/launch.js';
import { solveTurbofan } from '../src/physics/turbofan.js';
import { hohmann, propellantFor, solveKepler, positionOnEllipse, GEO_ALT } from '../src/physics/orbital.js';
import { mission, enduranceSweep } from '../src/physics/endurance.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b} ± ${tol}, got ${a}`);

test('ISA matches the 1976 Standard Atmosphere tables', () => {
  const sl = isa(0);
  close(sl.T, 288.15, 1e-9);
  close(sl.p, 101325, 1e-6);
  close(sl.rho, 1.225, 1e-3);
  close(sl.a, 340.29, 0.01);
  close(isa(11000).p, 22700, 20, 'p @ 11 km');
  close(isa(20000).T, 216.65, 0.01, 'T @ 20 km (isothermal layer)');
  close(isa(20000).rho, 0.08891, 2e-4, 'rho @ 20 km');
  close(isa(50000).p, 79.78, 0.5, 'p @ 50 km');
  assert.ok(isa(120000).rho < 1e-6, 'thermosphere density is negligible');
});

test('recovery temperature rises with Mach²', () => {
  close(recoveryTemperature(216.65, 2.0, 1), 216.65 * 1.8, 1e-9);
});

test('fighter aerodynamics give plausible numbers', () => {
  const cruise = flightState({ altitude: 9000, mach: 0.9, alpha: 4, throttle: 0.8 });
  assert.ok(cruise.n > 0.8 && cruise.n < 1.4, `≈1 g at 4° AoA, got ${cruise.n}`);
  assert.ok(cruise.ps > 0, 'positive excess power at military thrust');
  const stall = flightState({ altitude: 3000, mach: 0.4, alpha: 28, throttle: 1 });
  assert.ok(stall.stalled);
  assert.ok(liftSlope(2.0) < liftSlope(0.5), 'supersonic lift slope is lower');
  const ab = psSweep({ altitude: 12000, throttle: 1 }).filter((p) => p.ps > 0);
  const vmax = ab[ab.length - 1].mach;
  assert.ok(vmax > 2.0 && vmax < 2.45, `max level Mach with afterburner ≈ 2.25, got ${vmax}`);
  const dry = psSweep({ altitude: 12000, throttle: 0.8 }).filter((p) => p.ps > 0);
  assert.ok(dry[dry.length - 1].mach > 1.2, 'supercruise on dry thrust');
});

test('Tsiolkovsky and orbital elements', () => {
  close(tsiolkovsky(300, Math.E, 1), 300 * 9.80665, 1e-9);
  const r = R_EARTH + 300e3;
  const el = planarElements(r, 0, Math.sqrt(MU_EARTH / r));
  close(el.e, 0, 1e-9);
  close(el.rp, r, 1e-3);
});

test('HELIOS-H reaches a near-circular LEO with the default mission', () => {
  const { result, events, samples } = simulateAscent({ payload: 15000 });
  assert.ok(result.success, 'orbit achieved');
  close(result.perigee / 1000, 200, 12, 'perigee km');
  close(result.apogee / 1000, 205, 20, 'apogee km');
  const codes = events.map((e) => e.code);
  for (const c of ['LIFTOFF', 'MAXQ', 'BECO', 'MECO', 'SEP', 'SES', 'FAIRING', 'SECO', 'ORBIT']) assert.ok(codes.includes(c), `event ${c}`);
  assert.ok(result.maxQ.q > 20e3 && result.maxQ.q < 70e3, `max-Q ${result.maxQ.q}`);
  const mid = sampleAt(samples, 100);
  assert.ok(mid.h > 20e3 && mid.h < 150e3, 'altitude at T+100 s');
});

test('launch samples carry the forces drawn by the force-vector overlay', () => {
  const { samples } = simulateAscent({ payload: 15000 });
  const g0 = MU_EARTH / (R_EARTH * R_EARTH);
  const first = samples[0];
  close(first.weight, first.mass * g0, first.mass * 0.01, 'weight at liftoff');
  assert.ok(first.thrust / first.weight > 1.2, 'liftoff thrust exceeds weight');
  // drag peaks in the dense lower atmosphere, then vanishes in vacuum
  const peak = samples.reduce((a, s) => (s.drag > a.drag ? s : a));
  assert.ok(peak.h > 5e3 && peak.h < 25e3, `peak drag at ${peak.h} m`);
  assert.ok(sampleAt(samples, 400).drag < 1, 'no drag above the atmosphere');
  for (const s of samples) assert.ok(s.drag >= 0 && s.weight > 0);
});

test('an overloaded HELIOS-H fails to reach orbit', () => {
  const { result } = simulateAscent({ payload: 90000 });
  assert.equal(result.success, false);
});

test('turbofan cycle: take-off and cruise performance', () => {
  const to = solveTurbofan({});
  assert.ok(to.valid);
  close(to.thrust / 1000, 400, 40, 'take-off thrust kN');
  assert.ok(to.tsfc * 1e6 > 6 && to.tsfc * 1e6 < 11, 'take-off TSFC g/(kN·s)');
  const cr = solveTurbofan({ altitude: 10668, mach: 0.82 });
  assert.ok(cr.valid);
  assert.ok(cr.tsfc * 1e6 > 14 && cr.tsfc * 1e6 < 20, `cruise TSFC ${cr.tsfc * 1e6}`);
  assert.ok(cr.etaTh > 0.4 && cr.etaTh < 0.6, 'thermal efficiency');
  assert.ok(cr.etaP > 0.5 && cr.etaP < 0.9, 'propulsive efficiency');
  const T = Object.fromEntries(to.stations.map((s) => [s.id, s.T]));
  assert.ok(T['13'] > T['2'] && T['3'] > T['13'] && T['4'] > T['3'] && T['45'] < T['4'] && T['5'] < T['45'], 'station temperatures are ordered');
  const lowTit = solveTurbofan({ tit: 1300 });
  assert.ok(lowTit.fanLimited, 'low TIT forces the fan to be work-limited');
});

test('Hohmann LEO → GEO matches the textbook Δv', () => {
  const h = hohmann(300, GEO_ALT, 0);
  close(h.dvTotal, 3.89, 0.02, 'coplanar Δv km/s');
  close(h.tof / 3600, 5.27, 0.05, 'transfer time h');
  const cape = hohmann(300, GEO_ALT, 28.5);
  assert.ok(cape.dvTotal > h.dvTotal, 'plane change costs Δv');
  close(propellantFor(1, 1000, 300), 1000 * (1 - Math.exp(-1000 / (300 * 9.80665))), 1e-9);
});

test('Kepler solver converges and positions are consistent', () => {
  for (const e of [0, 0.3, 0.7, 0.95]) {
    for (const M of [0.1, 1, 2.5, 3.1]) {
      const E = solveKepler(M, e);
      close(E - e * Math.sin(E), M, 1e-10);
    }
  }
  const h = hohmann(300, GEO_ALT, 0);
  const half = positionOnEllipse(h.at, h.e, h.tof);
  close(Math.abs(half.nu), Math.PI, 1e-6, 'apoapsis after half a period');
  close(half.r, h.r2, 1e-3);
});

test('UAV endurance peaks near the minimum-power speed', () => {
  const sweep = enduranceSweep({ fuel: 1300, payload: 450, altitude: 7600, transit: 0 }).filter((p) => Number.isFinite(p.endurance));
  const best = sweep.reduce((a, b) => (b.endurance > a.endurance ? b : a));
  const m = mission({ fuel: 1300, payload: 450, altitude: 7600, speed: best.speed });
  close(best.speed, m.vMaxEndurance, 8, 'best-endurance speed m/s');
  assert.ok(m.endurance > 15 && m.endurance < 40, `endurance ${m.endurance} h`);
  assert.ok(mission({ fuel: 1800, payload: 1700 }).overweight, 'max fuel + max payload exceeds MTOW');
});
