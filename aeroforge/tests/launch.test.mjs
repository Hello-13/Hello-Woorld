// Launch regression tests for the Falcon Heavy ascent model: `node --test tests/launch.test.mjs`.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  simulateAscent, sampleAt, tsiolkovsky, planarElements, engineThrust, exitArea, liftoffMass, deltaVBudget,
  FALCON_HEAVY, MU_EARTH, R_EARTH,
} from '../src/physics/launch.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b} ± ${tol}, got ${a}`);
const P_SL = 101325;

test('Tsiolkovsky and orbital elements', () => {
  close(tsiolkovsky(300, Math.E, 1), 300 * 9.80665, 1e-9);
  const r = R_EARTH + 300e3;
  const el = planarElements(r, 0, Math.sqrt(MU_EARTH / r));
  close(el.e, 0, 1e-9);
  close(el.rp, r, 1e-3);
});

test('engine model reproduces the published Falcon Heavy thrust figures', () => {
  const { booster: B, core: C, upper: U } = FALCON_HEAVY;
  // 27 Merlin 1D: SpaceX lists 22,819 kN at sea level and 24,681 kN in vacuum
  const sl = engineThrust(B, P_SL).thrust * B.count + engineThrust(C, P_SL).thrust;
  const vac = engineThrust(B, 0).thrust * B.count + engineThrust(C, 0).thrust;
  close(sl / 1e3, 22819, 22819 * 0.002, 'liftoff thrust kN');
  close(vac / 1e3, 24681, 24681 * 0.002, 'vacuum thrust kN');
  // the exit area implied by 845 → 914 kN is a ≈ 0.93 m nozzle exit
  close(Math.sqrt((4 * exitArea(C)) / Math.PI), 0.93, 0.02, 'Merlin 1D exit diameter m');
  // Merlin Vacuum: 981 kN, Isp 348 s → 287.5 kg/s
  const u = engineThrust(U, 0);
  close(u.thrust / 1e3, 981, 0.5, 'MVac thrust kN');
  close(u.mdot, 981e3 / (348 * 9.80665), 1e-6, 'MVac mass flow');
  // throttle scales thrust and flow together
  close(engineThrust(C, P_SL, 0.55).thrust, 0.55 * engineThrust(C, P_SL).thrust, 1e-6);
});

test('liftoff mass matches SpaceX\'s 1,420,788 kg with a ≈ 37 t payload', () => {
  close(liftoffMass(FALCON_HEAVY, 37000), 1420788, 1420788 * 0.005, 'liftoff mass kg');
  const tw = (engineThrust(FALCON_HEAVY.booster, P_SL).thrust * 2 + engineThrust(FALCON_HEAVY.core, P_SL).thrust)
    / (liftoffMass(FALCON_HEAVY, 15000) * 9.80665);
  assert.ok(tw > 1.6 && tw < 1.72, `liftoff T/W ${tw}`);
});

test('ideal Δv budget exceeds the ≈ 9.4 km/s a LEO ascent needs, split over three burns', () => {
  const b = deltaVBudget(FALCON_HEAVY, 15000);
  assert.ok(b.boost > 3500 && b.core > 1200 && b.upper > 5500, JSON.stringify(b));
  assert.ok(b.total > 9400 && b.total < 14000, `total ${b.total}`);
  close(b.tBoost, 146.7, 0.5, 'side boosters burn time s');
});

test('Falcon Heavy reaches a near-circular 200 km LEO with the default mission', () => {
  const { result, events, samples } = simulateAscent({ payload: 15000, kickAngle: 16 });
  assert.ok(result.success, 'orbit achieved');
  close(result.perigee / 1000, 200, 12, 'perigee km');
  close(result.apogee / 1000, 205, 20, 'apogee km');
  const at = (code) => events.find((e) => e.code === code)?.t;
  const order = ['LIFTOFF', 'THROTTLE', 'BECO', 'BSEP', 'THROTTLE_UP', 'MECO', 'SEP', 'SES', 'FAIRING', 'SECO', 'ORBIT'];
  for (let i = 0; i < order.length; i++) {
    assert.ok(at(order[i]) != null, `event ${order[i]}`);
    if (i > 0) assert.ok(at(order[i]) >= at(order[i - 1]), `${order[i]} after ${order[i - 1]}`);
  }
  assert.ok(at('MAXQ') != null, 'event MAXQ');
  // flown Falcon Heavy missions: BECO ≈ T+144–154 s, booster separation a few seconds later,
  // MECO ≈ T+184–215 s, second-engine start 6–11 s after MECO
  assert.ok(at('BECO') > 140 && at('BECO') < 156, `BECO at ${at('BECO')}`);
  close(at('BSEP') - at('BECO'), 3, 0.2, 'BECO → separation s');
  assert.ok(at('MECO') > 180 && at('MECO') < 220, `MECO at ${at('MECO')}`);
  close(at('SES') - at('MECO'), 10, 0.2, 'MECO → SES s');
  assert.ok(result.maxQ.q > 25e3 && result.maxQ.q < 60e3, `max-Q ${result.maxQ.q}`);
  assert.ok(result.maxQ.t > 40 && result.maxQ.t < 80, `max-Q at ${result.maxQ.t}`);
  const mid = sampleAt(samples, 100);
  assert.ok(mid.h > 20e3 && mid.h < 60e3, 'altitude at T+100 s');
  // the centre core runs throttled while the boosters are attached, then at full thrust
  assert.equal(sampleAt(samples, 20).coreThrottle, 1);
  close(sampleAt(samples, 100).coreThrottle, FALCON_HEAVY.coreThrottleDown, 1e-9);
  assert.equal(sampleAt(samples, at('BSEP') + 5).coreThrottle, 1);
  assert.ok(sampleAt(samples, at('BECO') + 1).boostersAttached && !sampleAt(samples, at('BSEP') + 1).boostersAttached);
});

test('payload capability brackets the published 63.8 t to LEO (fully expendable)', () => {
  assert.ok(simulateAscent({ payload: 60000, kickAngle: 12 }).result.success, '60 t reaches orbit');
  for (const kick of [10, 12, 14, 16, 18]) {
    assert.equal(simulateAscent({ payload: 70000, kickAngle: kick }).result.success, false, `70 t, kick ${kick}`);
  }
});

test('launch samples carry the forces drawn by the force-vector overlay', () => {
  const { samples } = simulateAscent({ payload: 15000 });
  const g0 = MU_EARTH / (R_EARTH * R_EARTH);
  const first = samples[0];
  close(first.weight, first.mass * g0, first.mass * 0.01, 'weight at liftoff');
  assert.ok(first.thrust / first.weight > 1.5, 'liftoff thrust exceeds weight');
  // drag peaks in the dense lower atmosphere, then vanishes in vacuum
  const peak = samples.reduce((a, s) => (s.drag > a.drag ? s : a));
  assert.ok(peak.h > 5e3 && peak.h < 25e3, `peak drag at ${peak.h} m`);
  assert.ok(sampleAt(samples, 400).drag < 1, 'no drag above the atmosphere');
  for (const s of samples) assert.ok(s.drag >= 0 && s.weight > 0);
});

test('an overloaded Falcon Heavy fails to reach orbit', () => {
  const { result } = simulateAscent({ payload: 90000 });
  assert.equal(result.success, false);
});
