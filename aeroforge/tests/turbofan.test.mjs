// Turbofan regression tests: `npm test` (node --test).
// Reference: GE Aerospace GE90-115B — 115,300 lbf (513 kN) certified take-off thrust, overall
// pressure ratio 42, bypass ratio 7.2 (Aircraft Commerce), take-off EGT (T49) limit 1,090 °C,
// 100 % N1 = 2,355 rpm and 100 % N2 = 9,332 rpm (FAA / EASA type-certificate data sheets);
// fan 3.25 m (128 in) with 22 blades, 1 + 4 + 9 compressor and 2 + 6 turbine stages, length
// 7.29 m (287 in) (GE Aerospace, TCDS).
//
// The model's geometry is checked through its three.js-free layout module; the tour is checked
// against the part names declared in the model source, so a renamed part cannot silently drop
// out of the guided tour.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { solveTurbofan, DEFAULT_CYCLE, GE90 } from '../src/physics/turbofan.js';
import { STAGES, FAN, ROWS, CORE, coreAt, bypassAt, STATIONS, PLUG_TIP, FAN_NOZZLE_Y } from '../src/models/ge90/layout.js';
import TOUR from '../src/learn/tours/turbofan.js';

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

test('model layout: GE90-115B stage counts and main dimensions', () => {
  assert.deepEqual(STAGES, { fan: 1, booster: 4, hpc: 9, hpt: 2, lpt: 6 });
  assert.equal(ROWS.boosterRotors.length, 4);
  assert.equal(ROWS.boosterStators.length, 4);
  assert.equal(ROWS.hpcRotors.length, 9);
  assert.equal(ROWS.hpcStators.length, 8);
  assert.equal(ROWS.hptNozzles.length, 2);
  assert.equal(ROWS.hptBlades.length, 2);
  assert.equal(ROWS.lptNozzles.length, 6);
  assert.equal(ROWS.lptBlades.length, 6);
  assert.equal(FAN.blades, 22);
  close(2 * FAN.tipR, 3.25, 1e-9, 'fan diameter m');
  close(FAN.spinnerTip - PLUG_TIP, 7.29, 1e-9, 'spinner tip to plug tip m');
  assert.ok(FAN.caseR > FAN.tipR && FAN.caseR - FAN.tipR < 0.015, 'fan tip clearance under 15 mm');
});

test('model layout: blade rows alternate rotor/stator in order down the core', () => {
  const seq = [
    ['IGV', ROWS.boosterIGV.y],
    ...ROWS.boosterRotors.flatMap((r, i) => [['R', r.y], ['S', ROWS.boosterStators[i].y]]),
    ['IGV', ROWS.hpcIGV.y],
    ...ROWS.hpcRotors.flatMap((r, i) => (i < 8 ? [['R', r.y], ['S', ROWS.hpcStators[i].y]] : [['R', r.y]])),
    ['S', ROWS.hpcOGV.y],
    ...ROWS.hptNozzles.flatMap((n, i) => [['S', n.y], ['R', ROWS.hptBlades[i].y]]),
    ...ROWS.lptNozzles.flatMap((n, i) => [['S', n.y], ['R', ROWS.lptBlades[i].y]]),
  ];
  for (let i = 1; i < seq.length; i++) assert.ok(seq[i][1] < seq[i - 1][1], `row ${i} (${seq[i][0]}) sits behind row ${i - 1}`);
  // every row lies inside the modelled core flow path
  for (const [, y] of seq) assert.ok(y <= CORE[0][0] && y >= CORE[CORE.length - 1][0], `row at y = ${y} inside the core`);
  // the gas path contracts through the compressors and opens up through the turbines
  const area = (y) => { const [h, t] = coreAt(y); return Math.PI * (t * t - h * h); };
  assert.ok(area(ROWS.hpcRotors[0].y) / area(ROWS.hpcRotors[8].y) > 3, 'HPC annulus contracts more than threefold');
  assert.ok(area(ROWS.lptBlades[5].y) / area(ROWS.lptBlades[0].y) > 2, 'LPT annulus more than doubles');
  // the HPC turns at four times fan speed, so its variable rows are its front rows
  assert.ok(ROWS.hpcStators.every((s, i) => s.variable === (i < 3)), 'IGV plus the first three HPC stator rows are variable');
});

test('model layout: annulus areas pass the take-off airflow at realistic Mach numbers', () => {
  const to = solveTurbofan({});
  const S = to.byStation;
  const ring = (a, b) => Math.PI * (b * b - a * a);
  // axial Mach number from mass flow, total conditions and area (iterated, γ = 1.4)
  const mach = (m, Pt, Tt, A) => {
    let M = 0.3;
    for (let i = 0; i < 60; i++) {
      const Ts = Tt / (1 + 0.2 * M * M);
      const rho = (Pt * Math.pow(Ts / Tt, 3.5)) / (287 * Ts);
      M = m / (rho * A) / Math.sqrt(1.4 * 287 * Ts);
    }
    return M;
  };
  const M2 = mach(to.m0, S['2'].P, S['2'].T, ring(FAN.hubR, FAN.tipR));
  assert.ok(M2 > 0.5 && M2 < 0.75, `fan-face Mach ${M2}`);
  const [h25, t25] = coreAt(ROWS.hpcIGV.y);
  const M25 = mach(to.mCore, S['25'].P, S['25'].T, ring(h25, t25));
  assert.ok(M25 > 0.35 && M25 < 0.65, `HPC-inlet Mach ${M25}`);
  // ideally expanded nozzles: exit area = mass flow / (ρ V) at ambient pressure
  const [b0, b1] = bypassAt(FAN_NOZZLE_Y);
  const need19 = (to.m0 - to.mCore) / ((101325 / (287 * S['19'].T)) * to.V19);
  close(ring(b0, b1) / need19, 1, 0.15, 'fan nozzle area / required');
  const [c0, c1] = coreAt(-5.65);
  const need9 = (to.mCore * (1 + to.f)) / ((101325 / (287 * S['9'].T)) * to.V9);
  close(ring(c0, c1) / need9, 1, 0.15, 'core nozzle area / required');
});

test('station planes cover every cycle station and run front to back', () => {
  const ids = solveTurbofan({}).stations.map((s) => s.id).filter((id) => id !== '0');
  assert.deepEqual(STATIONS.map((s) => s[0]).sort(), ids.slice().sort());
  const core = ['2', '25', '3', '4', '45', '5', '9'].map((id) => STATIONS.find((s) => s[0] === id)[1]);
  for (let i = 1; i < core.length; i++) assert.ok(core[i] < core[i - 1], `core station order at ${i}`);
});

test('every guided-tour focus names a part declared in the model', () => {
  const dir = new URL('../src/models/ge90/', import.meta.url);
  const src = [readFileSync(new URL('../src/models/turbofan.js', import.meta.url), 'utf8'),
    ...readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => readFileSync(new URL(f, dir), 'utf8'))].join('\n');
  // the first argument of every P(name, { … }) call: literal names, and `templated ${i + 1}` names
  const args = [...src.matchAll(/\bP\(((?:[^{$]|\$(?!\{)|\$\{[^}]*\})*?),\s*\{/g)].map((m) => m[1]);
  const literals = new Set(args.flatMap((a) => [...a.matchAll(/'((?:[^'\\]|\\.)+)'/g)].map((m) => m[1].replace(/\\'/g, "'"))));
  const esc = (t) => t.replace(/[.*+?^()|[\]\\]/g, '\\$&');
  const templates = args.flatMap((a) => [...a.matchAll(/`([^`$]*)\$\{[^}]+\}([^`$]*)`/g)].map((m) => new RegExp(`^${esc(m[1])}\\d+${esc(m[2])}$`)));
  assert.ok(literals.size + templates.length > 80, `found ${literals.size} literal and ${templates.length} templated part names`);
  assert.ok(TOUR.length >= 8 && TOUR.length <= 12, `${TOUR.length} tour steps`);
  for (const [i, step] of TOUR.entries()) {
    for (const name of step.focus || []) assert.ok(literals.has(name) || templates.some((re) => re.test(name)), `step ${i + 1}: no part named "${name}"`);
  }
  assert.equal(TOUR[TOUR.length - 1].demo, 'flow', 'the tour ends on the station-plane flow demo');
});
