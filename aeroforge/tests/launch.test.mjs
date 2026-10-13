// Launch regression tests: `npm test` (node --test).

import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateAscent, sampleAt, tsiolkovsky, planarElements, MU_EARTH, R_EARTH } from '../src/physics/launch.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b} ± ${tol}, got ${a}`);

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
