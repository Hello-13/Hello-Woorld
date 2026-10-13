// Turbofan regression tests: `npm test` (node --test).
// Reference: GE Aerospace GE90-115B — 115,300 lbf (513 kN) certified take-off thrust, overall
// pressure ratio 42, bypass ratio 7.2 (Aircraft Commerce), take-off EGT (T49) limit 1,090 °C,
// 100 % N1 = 2,355 rpm and 100 % N2 = 9,332 rpm (FAA / EASA type-certificate data sheets).

import test from 'node:test';
import assert from 'node:assert/strict';
import { solveTurbofan, DEFAULT_CYCLE, GE90 } from '../src/physics/turbofan.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b} ± ${tol}, got ${a}`);

test('GE90-115B design point matches the published rating', () => {
  assert.equal(DEFAULT_CYCLE.opr, 42);
  assert.equal(DEFAULT_CYCLE.bpr, 7.2);
  const to = solveTurbofan({});
  assert.ok(to.valid && !to.fanLimited);
  close(to.thrust / 1000, 513, 15, 'take-off thrust kN');
  close(to.thrust / 4.44822, 115300, 3500, 'take-off thrust lbf');
  close(to.opr, 42, 0.01, 'overall pressure ratio at 100 % N1');
  assert.ok(to.tsfc * 1e6 > 8 && to.tsfc * 1e6 < 10.5, `take-off TSFC ${to.tsfc * 1e6} g/(kN·s)`);
  close(to.mCore * (1 + DEFAULT_CYCLE.bpr), to.m0, 1e-6, 'core + bypass = total airflow');
  // EGT is measured at the LPT inlet (T49 ≈ station 45): a new engine on a standard day has margin
  assert.ok(to.egt < GE90.egtLimitK && to.egtMargin > 50, `EGT ${to.egt} K vs limit ${GE90.egtLimitK} K`);
  close(to.n1Rpm, 2355, 1, 'N1 at 100 %');
  // the core makes a hotter, faster jet; the fan stream carries most of the momentum
  assert.ok(to.V9 > to.V19, 'core jet faster than the fan jet');
  const fanShare = (DEFAULT_CYCLE.bpr * to.V19) / ((1 + to.f) * to.V9 + DEFAULT_CYCLE.bpr * to.V19);
  assert.ok(fanShare > 0.75, `fan stream makes ${fanShare} of static thrust`);
});

test('station temperatures and pressures follow the Brayton cycle', () => {
  const to = solveTurbofan({});
  const T = Object.fromEntries(to.stations.map((s) => [s.id, s.T]));
  const P = Object.fromEntries(to.stations.map((s) => [s.id, s.P]));
  assert.ok(T['13'] > T['2'] && T['25'] > T['2'] && T['3'] > T['25'] && T['4'] > T['3'], 'compression then heating');
  assert.ok(T['45'] < T['4'] && T['5'] < T['45'] && T['9'] < T['5'], 'expansion through HPT, LPT and nozzle');
  assert.ok(P['3'] > P['25'] && P['25'] > P['2'] && P['4'] < P['3'], 'pressure rises to station 3, burner loss after');
  close(P['3'] / P['2'], 42, 0.01, 'P3 / P2');
  assert.ok(T['3'] > 850 && T['3'] < 1000, `T3 ${T['3']} K`);
});

test('cruise at FL350, Mach 0.84 and part-power behaviour', () => {
  const cr = solveTurbofan({ altitude: 10668, mach: 0.84 });
  assert.ok(cr.valid);
  assert.ok(cr.tsfc * 1e6 > 14 && cr.tsfc * 1e6 < 19, `cruise TSFC ${cr.tsfc * 1e6}`);
  assert.ok(cr.etaTh > 0.42 && cr.etaTh < 0.6, `thermal efficiency ${cr.etaTh}`);
  assert.ok(cr.etaP > 0.55 && cr.etaP < 0.85, `propulsive efficiency ${cr.etaP}`);
  assert.ok(cr.thrust < solveTurbofan({}).thrust * 0.4, 'thin air: cruise thrust well below take-off');
  const idle = solveTurbofan({ throttle: 0 });
  assert.ok(idle.valid && idle.thrust < 0.12 * solveTurbofan({}).thrust, 'idle thrust is a small fraction of take-off');
  assert.ok(idle.n2 > idle.n1, 'the HP spool holds a higher percentage speed at idle');
  const lowTit = solveTurbofan({ tit: 1300 });
  assert.ok(lowTit.fanLimited, 'low TIT forces the fan to be work-limited');
});
