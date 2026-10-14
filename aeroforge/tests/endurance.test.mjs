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
import { readFileSync, readdirSync } from 'node:fs';
import TOUR from '../src/learn/tours/uav.js';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const MQ9_FILES = readdirSync(new URL('../src/models/mq9/', import.meta.url)).filter((f) => f.endsWith('.js')).sort();
const modelSrc = [read('../src/models/uav.js'), ...MQ9_FILES.map((f) => read(`../src/models/mq9/${f}`))].join('\n');
const plantSrc = read('../src/models/mq9/powerplant.js');

/** Part names declared in the model: P('Name', …) and P(`Name (${side})`, …) expanded to both sides. */
function expand(n) {
  if (!n.includes('${')) return [n];
  // the wing-station labels used in `${label} pylon (${sn})` and the trailing-edge surfaces in `${name} (${sn})`
  const labels = [...modelSrc.matchAll(/\[\s*[\d.]+,\s*[\d.]+,\s*[\d.]+,\s*'(\w+)'/g)].map((m) => m[1]);
  const surfs = [...modelSrc.matchAll(/\['([A-Z][^']+)', [\d.]+, [\d.]+, '(?:flap|ail)'/g)].map((m) => m[1]);
  const out = [];
  for (const side of ['starboard', 'port']) {
    const s1 = n.replace(/\$\{(sn|sd|SN\([^)]*\))\}/g, side);
    if (s1.includes('${label}')) for (const l of labels) out.push(s1.replace('${label}', l));
    else if (s1.includes('${name}')) for (const l of surfs) out.push(s1.replace('${name}', l));
    else out.push(s1);
  }
  return out;
}
function partNames(system = null) {
  const names = new Set();
  const re = system ? new RegExp(`P\\((['\`])([^'\`]+)\\1,\\s*\\{\\s*system: '${system}'`, 'g') : /(?:\bP|doorPart)\((['`])([^'`]+)\1/g;
  for (const m of modelSrc.matchAll(re)) for (const n of expand(m[2])) names.add(n);
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

test('seven internal fuel tanks: three fuselage cells in line and two tanks in each wing', () => {
  const fuel = partNames('Fuel');
  const tanks = ['Forward fuel cell', 'Header fuel cell', 'Aft fuel cell', 'Inboard wing tank (starboard)', 'Inboard wing tank (port)', 'Outboard wing tank (starboard)', 'Outboard wing tank (port)'];
  assert.deepEqual(tanks.filter((n) => !fuel.has(n)), [], 'missing tanks');
  assert.ok(fuel.size >= 20, `${fuel.size} fuel parts`);
});

test('the fuel step shows the whole fuel system', () => {
  const fuel = partNames('Fuel');
  const step = TOUR.find((s) => /fuel/i.test(s.title));
  assert.ok(step, 'a fuel step exists');
  const missing = [...fuel].filter((n) => !step.focus.includes(n));
  assert.deepEqual(missing, [], 'fuel parts left out of the fuel step');
});

test('two flaps and two ailerons on each wing, each with its own servo', () => {
  const names = partNames();
  const missing = [];
  for (const sf of ['Inboard flap', 'Outboard flap', 'Inboard aileron', 'Outboard aileron']) for (const side of ['starboard', 'port']) {
    for (const n of [`${sf} (${side})`, `${sf} servo (${side})`]) if (!names.has(n)) missing.push(n);
  }
  assert.deepEqual(missing, []);
});

test('McCauley 110GFA propeller: 110 in (2.79 m) across, on a gearbox output 3.53 in above the engine axis', () => {
  const r = +plantSrc.match(/PROP_R = ([\d.]+)/)[1];
  close(2 * r, 2.794, 0.02, 'propeller diameter m');
  const off = +plantSrc.match(/SHAFT_Y = ENGINE_Y \+ ([\d.]+)/)[1];
  close(off, 0.0897, 0.003, 'gearbox output offset m');
});

test('ER fuel pods: 1,202 kg more fuel for GA-ASI’s 34 h', () => {
  assert.equal(LOADOUTS.er.fuel, 1202);
  const p = { fuel: 1724, payload: MQ9.maxInternal, altitude: 7600 };
  const er = best({ ...p, stores: 'er' }).endurance, clean = best({ ...p, stores: 'clean' }).endurance;
  close(er, 34, 3, 'ER endurance h');
  assert.ok(er > clean + 4, `ER ${er.toFixed(1)} h vs clean ${clean.toFixed(1)} h`);
  assert.ok(LOADOUTS.er.mass + LOADOUTS.er.fuel < MQ9.maxExternal, 'two full pods are within the external limit');
});

test('about a dozen callouts at most, each anchored on its part', () => {
  const lines = modelSrc.split('\n').filter((l) => /callout: (true|side [<>] 0)/.test(l));
  assert.ok(lines.length >= 6 && lines.length <= 12, `${lines.length} callouts (the brief keeps them to about 12)`);
  for (const l of lines) assert.match(l, /anchor: /, `callout without an anchor: ${l.trim()}`);
});

test('propeller blades fit the 110 in disc they are described with', () => {
  const r = +plantSrc.match(/PROP_R = ([\d.]+)/)[1];
  const rows = [...plantSrc.match(/const BLADE = \[([\s\S]*?)\n\];/)[1].matchAll(/\[([\d.]+), [\d.]+, [\d.]+, [\d.]+, [\d.]+\]/g)].map((m) => +m[1]);
  assert.ok(rows.length >= 8, `${rows.length} blade stations`);
  close(rows[rows.length - 1], r, 1e-9, 'blade tip radius = PROP_R');
  assert.ok(rows[0] > 0.1 && rows[0] < 0.25, `blade root at r ${rows[0]} m, inside the hub clamps`);
  const desc = read('../src/models/mq9/propulsion.js').match(/P\('Three-blade propeller', \{[\s\S]*?desc: '([^']+)'/)[1];
  const lengths = [...desc.matchAll(/([\d.]+) m\b/g)].map((m) => +m[1]).filter((v) => v < 2.5);
  assert.ok(lengths.every((v) => v <= r + 0.01), `no blade dimension in the desc exceeds the ${r} m radius: ${lengths}`);
});

test('main legs fold as rigid units about one hinge axis each', () => {
  const uav = read('../src/models/uav.js');
  assert.match(uav, /const MG = \{[^}]*hinge: \[[^\]]+\][^}]*stow: [\d.]+/, 'main gear hinge axis and stow angle');
  assert.ok(!/wheel\.quaternion/.test(uav), 'no wheel is turned separately from its leg');
});
