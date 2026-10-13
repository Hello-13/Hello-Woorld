// Turbofan regression tests: `npm test` (node --test).

import test from 'node:test';
import assert from 'node:assert/strict';
import { solveTurbofan } from '../src/physics/turbofan.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b} ± ${tol}, got ${a}`);

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
