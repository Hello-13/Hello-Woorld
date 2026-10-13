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

// ---- model checks that need no three.js: read the model source directly
import { readFileSync } from 'node:fs';
import TOUR from '../src/learn/tours/uav.js';

const modelSrc = readFileSync(new URL('../src/models/uav.js', import.meta.url), 'utf8');
const plantSrc = readFileSync(new URL('../src/models/mq9/powerplant.js', import.meta.url), 'utf8');

/** Part names declared in uav.js: P('Name', …) and P(`Name (${side})`, …) expanded to both sides. */
function partNames() {
  const names = new Set();
  // the wing-station labels used in `${label} pylon (${sn})`
  const labels = [...modelSrc.matchAll(/\[\s*[\d.]+,\s*[\d.]+,\s*[\d.]+,\s*'(\w+)'/g)].map((m) => m[1]);
  for (const m of modelSrc.matchAll(/P\((['`])([^'`]+)\1/g)) {
    const n = m[2];
    if (!n.includes('${')) { names.add(n); continue; }
    for (const side of ['starboard', 'port']) {
      const s1 = n.replace(/\$\{(sn|sd|SN\([^)]*\)|sn\([^)]*\))\}/g, side);
      if (s1.includes('${label}')) for (const l of labels) names.add(s1.replace('${label}', l));
      else names.add(s1);
    }
  }
  return names;
}

test('every tour focus name is a part of the model', () => {
  const names = partNames();
  assert.ok(names.size >= 150, `model declares ${names.size} parts (target 150+)`);
  const missing = [];
  for (const step of TOUR) for (const n of step.focus || []) if (!names.has(n)) missing.push(`${step.title}: ${n}`);
  assert.deepEqual(missing, [], 'tour names that match no part');
  assert.ok(TOUR.length >= 8 && TOUR.length <= 12, `${TOUR.length} tour steps`);
});

test('TPE331-10 installation is the published 1.09 m long', () => {
  const st = Object.fromEntries([...plantSrc.match(/STATIONS = \{([^}]+)\}/)[1].matchAll(/(\w+): ([\d.]+)/g)].map((m) => [m[1], +m[2]]));
  const len = st.gear1 - st.exhaust;
  assert.ok(len > 1.05 && len < 1.15, `engine length ${len.toFixed(3)} m (TPE331-10: 1.088 m)`);
  assert.ok(st.exhaust < st.turbine0 && st.turbine0 < st.turbine1 && st.turbine1 < st.comp1 && st.comp1 < st.inlet1 && st.inlet1 < st.gear1, 'modules in flow order');
});

test('stores fits use the published store and M310 launcher masses', () => {
  assert.equal(LOADOUTS.hellfire.mass, 4 * 49 + 2 * 43);
  assert.equal(LOADOUTS.strike.mass, 2 * 230 + 4 * 49 + 2 * 43);
  assert.ok(LOADOUTS.strike.mass < MQ9.maxExternal);
});

test('the fuel step shows the whole fuel system, wing tanks included', () => {
  const fuel = new Set();
  for (const m of modelSrc.matchAll(/P\((['`])([^'`]+)\1,\s*\{\s*system: 'Fuel'/g)) {
    const n = m[2];
    if (!n.includes('${')) fuel.add(n);
    else for (const side of ['starboard', 'port']) fuel.add(n.replace(/\$\{(sn|SN\([^)]*\))\}/g, side));
  }
  assert.ok(fuel.has('Wing fuel tank (starboard)') && fuel.has('Wing fuel tank (port)') && fuel.size >= 12, `fuel parts: ${[...fuel].join(', ')}`);
  const step = TOUR.find((s) => /fuel/i.test(s.title));
  assert.ok(step, 'a fuel step exists');
  const missing = [...fuel].filter((n) => !step.focus.includes(n));
  assert.deepEqual(missing, [], 'fuel parts left out of the fuel step');
});
