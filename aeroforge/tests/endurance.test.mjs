// MQ-9A endurance model regression tests: node --test tests/endurance.test.mjs
// The published figures checked here are from the USAF and GA-ASI MQ-9 fact sheets.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mission, enduranceSweep, serviceCeiling, powerAvailable, MQ9, LOADOUTS } from '../src/physics/endurance.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b} ± ${tol}, got ${a}`);
const best = (p) => enduranceSweep(p).filter((x) => Number.isFinite(x.endurance)).reduce((a, b) => (b.endurance > a.endurance ? b : a));

test('endurance peaks at the best-endurance speed, held above 1.2 × stall', () => {
  const p = { fuel: 1300, payload: 250, stores: 'clean', altitude: 7600, transit: 0 };
  const b = best(p);
  const m = mission({ ...p, speed: b.speed });
  close(b.speed, m.vMaxEndurance, 2.5, 'best-endurance speed m/s');
  assert.ok(m.vMaxEndurance >= 1.2 * m.vStall - 1e-9, 'best-endurance speed respects the 1.2 Vs floor');
  assert.ok(m.vMaxRange >= m.vMaxEndurance, 'best range is no slower than best endurance');
});

test('clean aircraft with full fuel reproduces the published 27 h endurance', () => {
  const p = { fuel: MQ9.maxFuel, payload: MQ9.maxInternal, stores: 'clean', altitude: 7600 };
  const e = best(p).endurance;
  close(e, 27, 2, 'endurance h');
});

test('stores cost endurance through weight and drag', () => {
  const base = { fuel: 1300, payload: 250, altitude: 7600 };
  const e = (stores) => best({ ...base, stores }).endurance;
  assert.ok(e('clean') > e('hellfire') && e('hellfire') > e('strike'), 'clean > 4 Hellfire > strike');
  assert.ok(LOADOUTS.strike.mass < MQ9.maxExternal, 'strike fit is within the 1,361 kg external limit');
});

test('weights: full fuel, full internal payload and the strike fit exceed MTOW', () => {
  assert.equal(MQ9.massEmpty + MQ9.maxFuel + MQ9.maxInternal + MQ9.maxExternal > MQ9.mtow, true);
  assert.ok(mission({ fuel: 1800, payload: 386, stores: 'strike' }).overweight, 'max fuel + payload + strike stores is over MTOW');
  assert.ok(!mission({ fuel: 1300, payload: 250, stores: 'strike' }).overweight, 'a typical armed sortie is within MTOW');
});

test('power available is 900 shp at sea level and lapses with altitude', () => {
  close(powerAvailable(0), 671, 0.5, 'sea-level shaft power kW');
  assert.ok(powerAvailable(7600) < powerAvailable(0) && powerAvailable(15000) < powerAvailable(7600));
});

test('light aircraft reaches the published 15,240 m ceiling', () => {
  close(serviceCeiling(3300), 15240, 1000, 'service ceiling m at 3,300 kg');
  assert.ok(serviceCeiling(MQ9.mtow) < serviceCeiling(3300), 'heavier aircraft has a lower ceiling');
});

test('maximum level speed at 7,600 m is near the published 444–482 km/h', () => {
  let vmax = 0;
  for (let v = 40; v < 200; v += 0.5) {
    const m = mission({ fuel: 900, payload: 250, stores: 'clean', altitude: 7600, speed: v });
    if (!m.powerLimited && !m.lowMargin) vmax = v;
  }
  const kmh = vmax * 3.6;
  assert.ok(kmh > 420 && kmh < 490, `max speed ${kmh.toFixed(0)} km/h`);
});
