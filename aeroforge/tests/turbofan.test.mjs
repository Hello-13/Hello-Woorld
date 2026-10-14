// Turbofan regression tests: `npm test` (node --test).
// Reference: GE Aerospace GE90-115B — certified take-off thrust 51,395 daN (115,540 lbf),
// take-off EGT (T49) limit 1,090 °C (1,050 °C maximum continuous), 100 % N1 = 2,355 rpm, 100 % N2 =
// 9,332 rpm, N1 / N2 limits 2,602 / 11,292 rpm, length 7,281 mm (286.7 in), fuel heating value
// 42,798 kJ/kg (EASA TCDS IM.E.002 issue 05); overall pressure ratio 42, fan 3.25 m (128 in) with
// 22 blades, 1 + 4 + 9 compressor and 2 + 6 turbine stages (GE Aerospace). ICAO Engine Emissions
// Databank (EASA, v32, 2026), GE90-115B entries 7GE099 … 07P27GE240: rated thrust 513.9 kN, bypass
// ratio 6.96–7.1, pressure ratio 42.2–43.2, fuel flow 4.59 / 3.56 / 1.07 / 0.339 kg/s at the LTO
// cycle's 100 / 85 / 30 / 7 % thrust points. Cruise: earlier GE90s are quoted at 0.52–0.545 lb/lbf/h
// (14.7–15.4 g/(kN·s)); the -115B figure is not published.
//
// The model's geometry is checked through its three.js-free layout module; the tour is checked
// against the part names declared in the model source, so a renamed part cannot silently drop
// out of the guided tour.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { solveTurbofan, DEFAULT_CYCLE, GE90, OPERATING_POINTS, SCHEDULE } from '../src/physics/turbofan.js';
import { STAGES, FAN, ROWS, CORE, coreAt, bypassAt, STATIONS, PLUG_TIP, FAN_NOZZLE_Y, NACELLE, TCF, AGB, AGB_PADS, agbTrain } from '../src/models/ge90/layout.js';
import { bladeRings, fanBladeSpec, FAN_BLADE_TIP_R } from '../src/models/ge90/blade.js';
import TOUR from '../src/learn/tours/turbofan.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b} ± ${tol}, got ${a}`);

test('GE90-115B design point matches the published rating', () => {
  assert.equal(DEFAULT_CYCLE.opr, 42);
  assert.equal(DEFAULT_CYCLE.bpr, 7.1);
  const to = solveTurbofan({});
  assert.ok(to.valid && !to.fanLimited);
  close(to.thrust / 1000, GE90.ratedThrust / 1000, 5, 'take-off thrust kN');
  close(to.thrust / 4.44822, 115540, 1200, 'take-off thrust lbf (TCDS)');
  close(to.opr, 42, 0.01, 'overall pressure ratio at 100 % N1');
  close(to.fuelFlow, 4.594, 0.15, 'take-off fuel flow kg/s (ICAO databank)');
  close(to.mCore * (1 + DEFAULT_CYCLE.bpr), to.m0, 1e-6, 'core + bypass = total airflow');
  // EGT is measured at the LPT inlet (T49 ≈ station 45): a new engine on a standard day has margin
  assert.ok(to.egt < GE90.egtLimitK && to.egtMargin > 50, `EGT ${to.egt} K vs limit ${GE90.egtLimitK} K`);
  close(to.n1Rpm, 2355, 1, 'N1 at 100 %');
  assert.ok(to.n1Rpm < GE90.n1RpmMax && to.n2Rpm < GE90.n2RpmMax, '100 % is a reference speed, below the TCDS limits');
  assert.equal(GE90.n1RpmMax, 2602);
  assert.equal(GE90.n2RpmMax, 11292);
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

test('cruise at FL350, Mach 0.84: a cruise power setting, not take-off throttle', () => {
  const cr = solveTurbofan(OPERATING_POINTS.cruise);
  assert.ok(cr.valid && !cr.fanLimited);
  // a 777-300ER early in the cruise needs about 75–85 kN from each engine
  assert.ok(cr.thrust > 72e3 && cr.thrust < 88e3, `cruise thrust ${cr.thrust / 1e3} kN`);
  assert.ok(cr.tsfc * 1e6 > 14.5 && cr.tsfc * 1e6 < 15.8, `cruise TSFC ${cr.tsfc * 1e6} g/(kN·s)`);
  assert.ok(cr.n1 > 82 && cr.n1 < 95, `cruise N1 ${cr.n1} %`);
  assert.ok(cr.Tt4 > 1250 && cr.Tt4 < 1550, `cruise burner exit ${cr.Tt4} K`);
  assert.ok(cr.etaTh > 0.48 && cr.etaTh < 0.58, `thermal efficiency ${cr.etaTh}`);
  assert.ok(cr.etaP > 0.7 && cr.etaP < 0.85, `propulsive efficiency ${cr.etaP}`);
  // full thrust lever at FL350 is held by the corrected-speed limit: maximum climb, about a fifth of take-off
  const mcl = solveTurbofan({ ...OPERATING_POINTS.cruise, throttle: 1 });
  assert.ok(mcl.speedLimited && mcl.thrust > 90e3 && mcl.thrust < 125e3, `max climb thrust at FL350 ${mcl.thrust / 1e3} kN`);
  assert.ok(mcl.thrust > cr.thrust && mcl.tsfc < cr.tsfc + 1e-9, 'more lever, more thrust, at no worse TSFC');
  // at the same corrected fan speed the temperature ratios match the design point's (to within the
  // small change in fuel–air ratio) and the pressure ratios exactly
  const to = solveTurbofan({});
  const sim = solveTurbofan({ ...OPERATING_POINTS.cruise, throttle: (Math.sqrt(cr.byStation['2'].T / 288.15) - SCHEDULE.n1Idle) / (1 - SCHEDULE.n1Idle) });
  close(sim.n1c, 1, 1e-6, 'corrected fan speed');
  close(sim.Tt4 / sim.byStation['2'].T, to.Tt4 / 288.15, 0.06, 'Tt4/Tt2 similarity');
  close(sim.opr, 42, 0.01, 'same pressure ratio at the same corrected speed');
});

test('part power on the ground: matched, monotonic, idle where a big fan idles', () => {
  const to = solveTurbofan({});
  let prev = null;
  for (let t = 0; t <= 1.0001; t += 0.02) {
    const r = solveTurbofan({ throttle: t });
    assert.ok(r.valid && !r.fanLimited, `thrust lever ${t}: matched, not work-limited`);
    if (prev) {
      assert.ok(r.thrust > prev.thrust && r.egt > prev.egt && r.fuelFlow > prev.fuelFlow && r.n2 > prev.n2, `thrust, EGT, fuel flow and N2 rise with the lever at ${t}`);
    }
    prev = r;
  }
  const idle = solveTurbofan({ throttle: 0 });
  close(idle.n1, 22, 0.5, 'ground-idle N1 %');
  assert.ok(idle.n2 > 58 && idle.n2 < 68, `ground-idle N2 ${idle.n2} %`);
  assert.ok(idle.thrust > 0.02 * to.thrust && idle.thrust < 0.06 * to.thrust, `idle thrust ${idle.thrust / 1e3} kN`);
  const egtC = idle.egt - 273.15;
  assert.ok(egtC > 250 && egtC < 500, `idle EGT ${egtC} °C`);
  // the work-limit warning belongs to cycle-design changes only
  assert.ok(solveTurbofan({ tit: 1300 }).fanLimited, 'a design TIT of 1,300 K cannot drive the design fan');
  assert.ok(!solveTurbofan({ ...OPERATING_POINTS.climb }).fanLimited, 'the climb preset is matched');
});

test('fuel flow follows the ICAO emissions databank at the LTO thrust points', () => {
  // the thrust lever position that gives a fraction of the rating, at sea-level static
  const at = (frac) => {
    let lo = 0, hi = 1;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (solveTurbofan({ throttle: m }).thrust < frac * 513.9e3) lo = m; else hi = m; }
    return solveTurbofan({ throttle: (lo + hi) / 2 });
  };
  // [thrust fraction, databank fuel flow kg/s, allowed relative error]
  for (const [frac, ff, tol] of [[1, 4.594, 0.05], [0.85, 3.562, 0.08], [0.3, 1.069, 0.2], [0.07, 0.339, 0.1]]) {
    const r = at(frac);
    assert.ok(Math.abs(r.fuelFlow / ff - 1) <= tol, `${frac * 100} % thrust: fuel ${r.fuelFlow.toFixed(3)} kg/s vs databank ${ff}`);
  }
});

test('burner energy balance uses a mean specific heat, not the two-cp shortcut', async () => {
  const { fuelAir } = await import('../src/physics/turbofan.js');
  // air-table enthalpy rise 918 → 1,740 K is about 970 kJ/kg; LHV 42.8 MJ/kg, η_b 0.995
  const f = fuelAir(918, 1740, 0.995);
  assert.ok(f > 0.0235 && f < 0.0255, `take-off fuel–air ratio ${f}`);
  // the shortcut (1150·T4 − 1004.5·T3)/(η·LHV − 1150·T4) overstates fuel more as T3 falls (part power, cruise)
  const shortcut = (T3, T4) => (1150 * T4 - 1004.5 * T3) / (0.995 * 42.798e6 - 1150 * T4);
  assert.ok(shortcut(444, 702) / fuelAir(444, 702, 0.995) > shortcut(918, 1740) / f, 'shortcut error grows at idle');
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
  close(FAN.spinnerTip - PLUG_TIP, 7.281, 1e-9, 'spinner tip to plug tip m (TCDS 7,281 mm)');
  assert.ok(FAN.caseR > FAN.tipR && FAN.caseR - FAN.tipR < 0.015, 'fan case within 15 mm of the fan diameter');
  close(2 * NACELLE.maxR / 0.0254, 166, 0.5, 'Boeing nacelle maximum diameter in');
});

test('fan blades: sections wrapped onto their cylinders stay inside the rub strip', () => {
  for (const sheath of [false, true]) {
    const rings = bladeRings(fanBladeSpec(sheath));
    let rMax = 0;
    for (const ring of rings) for (const [x, , z] of ring) rMax = Math.max(rMax, Math.hypot(x, z));
    close(rMax, FAN_BLADE_TIP_R, 1e-9, `${sheath ? 'sheath' : 'blade'} tip radius`);
    // a 0.67 m tip chord laid out flat instead would reach about 3 cm further out, into the case
    const flatTip = rings[rings.length - 1].reduce((m, [x, , z]) => Math.max(m, Math.hypot(FAN_BLADE_TIP_R, FAN_BLADE_TIP_R * Math.atan2(z, x))), 0);
    if (!sheath) assert.ok(flatTip > FAN.caseR, 'the unwrapped section would have cut the case');
  }
  const clearance = FAN.rubR - FAN_BLADE_TIP_R;
  assert.ok(clearance > 0.003 && clearance < 0.008, `fan tip clearance ${clearance * 1000} mm`);
  assert.ok(FAN.rubR < FAN.caseR, 'rub strip set into the case wall');
  close(2 * FAN_BLADE_TIP_R, 3.25, 0.005, 'swept fan diameter m');
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

test('turbine center frame sits between the HP and LP turbines, with the EGT plane at its aft edge', () => {
  const hpt2 = ROWS.hptBlades[1], lpn1 = ROWS.lptNozzles[0];
  // GE patent EP 1 149 987: the GE90's TCF has twelve struts
  assert.equal(TCF.struts, 12);
  assert.ok(TCF.y0 <= hpt2.y - hpt2.chord / 2 + 0.002, 'frame starts behind the HPT stage 2 blades');
  assert.ok(TCF.y1 >= lpn1.y - lpn1.chord / 2 - 0.02 && TCF.y1 < lpn1.y + lpn1.chord / 2 + 0.02, 'frame ends at the LPT stage 1 nozzle');
  assert.ok(TCF.ym < TCF.y0 && TCF.ym > TCF.y1 && TCF.bearingY < TCF.y0 && TCF.bearingY > TCF.y1, 'struts and #4 bearing inside the frame');
  const egt = STATIONS.find((st) => st[0] === '45')[1];
  assert.ok(egt <= TCF.y0 && egt >= TCF.y1 - 0.01, `station 45 (EGT, T49) at the frame: ${egt}`);
});

test('accessory gearbox: one meshing spur train, pad gears sized by the published pad ratios', () => {
  const train = agbTrain(AGB.R, AGB_PADS);
  // neighbouring pitch circles touch (or overlap by less than a tooth), and every gear fits inside the housing
  for (let i = 1; i < train.length; i++) {
    const d = AGB.R * (train[i].phi - train[i - 1].phi);
    const gap = d - train[i].r - train[i - 1].r;
    assert.ok(gap < 0.0085 && gap > -0.004, `gears ${i - 1}/${i} (${train[i - 1].name} → ${train[i].name}) gap ${gap}`);
  }
  for (const g of train) assert.ok(g.r >= 0.0099 && AGB.R + g.r + 0.0035 <= AGB.interior[1] + 0.008 && AGB.R - g.r - 0.0035 >= AGB.interior[0] - 0.008, `${g.name} gear r ${g.r} fits`);
  // in a train of meshing gears speed × pitch radius is the same for every gear, so the slow
  // hydraulic-pump pad (0.3783 × N2, EASA TCDS) needs about 2.1 times the generator gear's radius (0.7947 × N2)
  const by = (name) => train.find((g) => g.name === name);
  const idg = by('IDG'), edp = by('hydraulic pump');
  close(edp.r / idg.r, idg.ratio / edp.ratio, 0.05, 'hydraulic-pump / generator gear size');
  // the fastest pad (VSCF, 2.4126 × N2) is stepped up again: its train gear's layshaft carries a
  // larger gear that meshes with a small pinion on the pad shaft
  const lay = by('VSCF step-up gear'), st = lay.stepUp;
  assert.ok(lay.r < idg.r && st.pinion < lay.r, 'the step-up layshaft gear and the VSCF pinion are the smallest');
  close(AGB.R * (lay.phi - st.phi), st.r + st.pinion, 0.002, 'step-up pair meshes');
  close((idg.ratio * idg.r / lay.r) * (st.r / st.pinion), st.ratio, 0.01, 'VSCF pinion speed / N2');
  assert.ok(AGB.R + st.r + 0.0035 <= AGB.interior[1] + 0.008, 'step-up gear fits the housing');
  assert.equal(train.filter((g) => g.kind !== 'idler').length, AGB_PADS.length);
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
