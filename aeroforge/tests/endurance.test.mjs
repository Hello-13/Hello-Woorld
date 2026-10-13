// Endurance regression tests: `npm test` (node --test).

import test from 'node:test';
import assert from 'node:assert/strict';
import { mission, enduranceSweep } from '../src/physics/endurance.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b} ± ${tol}, got ${a}`);

test('UAV endurance peaks near the minimum-power speed', () => {
  const sweep = enduranceSweep({ fuel: 1300, payload: 450, altitude: 7600, transit: 0 }).filter((p) => Number.isFinite(p.endurance));
  const best = sweep.reduce((a, b) => (b.endurance > a.endurance ? b : a));
  const m = mission({ fuel: 1300, payload: 450, altitude: 7600, speed: best.speed });
  close(best.speed, m.vMaxEndurance, 8, 'best-endurance speed m/s');
  assert.ok(m.endurance > 15 && m.endurance < 40, `endurance ${m.endurance} h`);
  assert.ok(mission({ fuel: 1800, payload: 1700 }).overweight, 'max fuel + max payload exceeds MTOW');
});
