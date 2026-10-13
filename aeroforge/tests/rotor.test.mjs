// Rotor-performance regression tests for the UH-60M lab: `node --test tests/rotor.test.mjs`.
// Textbook relations (momentum theory, Glauert, Cheeseman–Bennett, the power polar) plus
// plausibility checks against published Black Hawk figures.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  UH60, SHP, KT, FPM, rotorGeometry, airData, inducedVelocity, hoverInducedVelocity, groundEffect, rotorPower,
  figureOfMerit, powerRequired, powerAvailable, hoverCeiling, speedSchedule, autorotation, rotorEnergy,
  verticalClimb, stabilatorSchedule, heliPerformance, powerCurve,
} from '../src/physics/rotor.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b} ± ${tol}, got ${a}`);
const between = (x, lo, hi, msg) => assert.ok(x >= lo && x <= hi, `${msg ?? ''} expected ${lo}…${hi}, got ${x}`);

test('rotor geometry matches the published UH-60 data', () => {
  const g = rotorGeometry();
  close(2 * UH60.R, 16.36, 0.005, 'main rotor diameter m');
  close(g.A, 210.2, 0.2, 'disc area m²');
  close(g.omega, 27.02, 0.01, '258 rpm in rad/s');
  close(g.vtip, 221, 0.5, 'tip speed m/s (≈725 ft/s)');
  close(2 * UH60.tr.R, 3.35, 0.01, 'tail rotor diameter m');
  close(UH60.tr.rpm / UH60.rpm, 4.61, 0.02, 'tail/main rotor speed ratio');
  between(g.sigma, 0.085, 0.095, 'wide-chord solidity');
  // hover tip Mach ≈ 0.65 at sea level, standard day
  close(g.vtip / airData(0, 0).a, 0.65, 0.01, 'hover tip Mach');
});

test('air data: ISA, temperature deviation and density altitude', () => {
  const sl = airData(0, 0);
  close(sl.rho, 1.225, 0.001, 'sea-level density');
  close(sl.densityAltitude, 0, 5, 'sea-level density altitude');
  const hot = airData(1219, 35 - (15 - 0.0065 * 1219));   // 4,000 ft, 95 °F
  close(hot.oatC, 35, 0.01, 'OAT °C');
  between(hot.densityAltitude, 2050, 2300, '4,000 ft / 95 °F density altitude ≈ 7,000+ ft');
  assert.ok(airData(0, 20).rho < sl.rho, 'hot air is thinner');
});

test('momentum theory: hover power = T^1.5 / √(2ρA) / FM', () => {
  const rho = 1.225, { A } = rotorGeometry();
  for (const T of [60e3, 80e3, 100e3]) {
    const h = rotorPower({ thrust: T, rho });
    const ideal = T ** 1.5 / Math.sqrt(2 * rho * A);
    close(h.ideal, ideal, 1e-6 * ideal, 'ideal power');
    const FM = figureOfMerit(h);
    close(h.induced + h.profile, ideal / FM, 1e-6 * ideal, 'actual = ideal / FM');
    between(FM, 0.6, 0.82, `figure of merit at T=${T}`);
    close(h.vh, Math.sqrt(T / (2 * rho * A)), 1e-9, 'v_h');
  }
  // FM rises with blade loading: profile power is a smaller share of the total
  assert.ok(figureOfMerit(rotorPower({ thrust: 100e3, rho })) > figureOfMerit(rotorPower({ thrust: 60e3, rho })));
});

test('Glauert induced velocity satisfies v⁴ + V²v² = v_h⁴ and tends to v_h²/V', () => {
  const vh = 14;
  close(inducedVelocity(vh, 0), vh, 1e-12, 'hover limit');
  for (const V of [5, 20, 60]) {
    const v = inducedVelocity(vh, V);
    close(v ** 4 + V * V * v * v, vh ** 4, 1e-6 * vh ** 4, `quartic at V=${V}`);
  }
  close(inducedVelocity(vh, 80) / (vh * vh / 80), 1, 0.01, 'high-speed limit');
});

test('ground effect follows Cheeseman–Bennett and fades with speed', () => {
  close(groundEffect(8.18, 8.18), 1 - 1 / 16, 1e-12, 'z = R');
  assert.equal(groundEffect(8.18, Infinity), 1);
  assert.ok(groundEffect(8.18, 6, 30, 3) > groundEffect(8.18, 6, 0, 14), 'weaker at speed');
  const oge = powerRequired({ mass: 9979 }), ige = powerRequired({ mass: 9979, wheelHeight: 3.05 });
  assert.ok(ige.total < oge.total, 'IGE hover needs less power');
  between(1 - ige.total / oge.total, 0.05, 0.15, 'IGE saving at 10 ft wheel height');
});

test('UH-60M hover at maximum gross weight, sea level, standard day', () => {
  const p = powerRequired({ mass: UH60.mtow });
  between(p.diskLoadingKg, 46, 49, 'disc loading kg/m²');
  between(p.mr.vh, 13.5, 14.5, 'induced velocity m/s');
  between(p.shp, 2600, 3200, 'hover power shp');
  between(p.tailRotor / p.total, 0.06, 0.13, 'tail-rotor share of hover power');
  between(p.mr.theta75 * 180 / Math.PI, 8, 14, 'collective pitch at 0.75 R');
  const a = powerAvailable({ rating: 'irp' });
  assert.equal(a.limit, 'transmission', 'two -701Ds out-pull the 3,400 shp transmission at sea level');
  assert.equal(a.shp, UH60.transLimit);
  assert.ok(a.W > p.total, 'hovers out of ground effect at MTOW');
});

test('canted tail rotor carries part of the weight', () => {
  const p = powerRequired({ mass: UH60.mtow });
  const lift = p.Ttr * Math.sin(20 * Math.PI / 180);
  between(lift / p.W, 0.02, 0.04, 'tail-rotor share of the weight');
  close(p.Tyaw * UH60.tr.arm, p.mainRotor / rotorGeometry().omega, 1, 'yaw balance: thrust × arm = torque (hover)');
});

test('power available lapses with altitude and temperature', () => {
  const sl = powerAvailable({ rating: 'mcp' });
  const hi = powerAvailable({ pressureAltitude: 3000, rating: 'mcp' });
  const hot = powerAvailable({ isaDev: 30, rating: 'mcp' });
  assert.ok(hi.shp < sl.shp && hot.shp < sl.shp);
  const oei = powerAvailable({ oei: true });
  close(oei.shp, 2000 * UH60.install, 1, 'one engine at contingency');
});

test('the 4,000 ft / 95 °F hot-and-high case at 16,800 lb', () => {
  const cond = { mass: 7620, pressureAltitude: 1219, isaDev: 35 - (15 - 0.0065 * 1219) };
  const avail = powerAvailable({ ...cond, rating: 'irp' });
  assert.equal(avail.limit, 'engines', 'engine-limited when hot and high');
  assert.ok(avail.W * 0.95 > powerRequired(cond).total, 'hovers OGE on 95 % of intermediate power');
  assert.ok(verticalClimb(cond) > 500 * FPM, 'and climbs vertically faster than 500 ft/min');
});

test('vertical climb on 95 % IRP at 4,000 ft / 95 °F matches the Sikorsky UH-60M brochure', () => {
  // brochure: 1,553 ft/min at 16,800 lb and 941 ft/min at 18,000 lb (95 % intermediate rated power)
  const cond = { pressureAltitude: 1219, isaDev: 35 - (15 - 0.0065 * 1219), powerFraction: 0.95 };
  const lb = 0.45359237;
  close(verticalClimb({ ...cond, mass: 16800 * lb }) / FPM, 1553, 0.12 * 1553, '16,800 lb');
  close(verticalClimb({ ...cond, mass: 18000 * lb }) / FPM, 941, 0.18 * 941, '18,000 lb');
  // and the climb power obeys momentum theory: P = κT(Vc/2 + √((Vc/2)² + v_h²)) + profile + Vc·T
  const Vc = 5, p = powerRequired({ mass: 7620, Vc });
  const vh = p.mr.vh, vi = -Vc / 2 + Math.sqrt(Vc * Vc / 4 + vh * vh);
  close(p.mr.induced, UH60.kappa * p.Tmr * vi, 1e-6 * p.mr.induced, 'climb induced power');
  close(p.mr.climb, p.Tmr * Vc, 1e-6 * p.mr.climb, 'climb power T·Vc');
});

test('hover ceilings: IGE above OGE, falling with weight and temperature', () => {
  const oge = hoverCeiling({ mass: UH60.mtow });
  const ige = hoverCeiling({ mass: UH60.mtow, wheelHeight: 3.05 });
  between(oge, 1000, 3500, 'HOGE ceiling at MTOW, ISA (m)');
  assert.ok(ige > oge, 'IGE ceiling higher');
  assert.ok(hoverCeiling({ mass: 8000 }) > oge, 'lighter flies higher');
  assert.ok(hoverCeiling({ mass: UH60.mtow, isaDev: 20 }) < oge, 'hot day lowers the ceiling');
  // the power-margin function is zero at the ceiling
  const req = powerRequired({ mass: UH60.mtow, pressureAltitude: oge }).total;
  close(req / powerAvailable({ pressureAltitude: oge }).W, 1, 0.01, 'margin vanishes at the ceiling');
});

test('the power bucket: best endurance and best range speeds', () => {
  const cond = { mass: 9000, pressureAltitude: 0, isaDev: 0 };
  const curve = powerCurve(cond);
  const s = speedSchedule(cond);
  between(s.vbe / KT, 60, 95, 'best endurance (minimum power) kt');
  between(s.vbr / KT, 100, 135, 'best range kt');
  assert.ok(s.vbr > s.vbe, 'range speed above endurance speed');
  const min = curve.reduce((a, b) => (b.total < a.total ? b : a));
  close(min.kt, s.vbe / KT, 3, 'curve minimum at vbe');
  assert.ok(curve[0].total > 1.6 * min.total, 'hover costs far more than the bucket');
  // the best-range speed is where a line from the origin is tangent: P/V minimum
  const pv = (V) => powerRequired({ ...cond, V }).total / V;
  assert.ok(pv(s.vbr) <= pv(s.vbr - 5 * KT) && pv(s.vbr) <= pv(s.vbr + 5 * KT));
  // parasite power grows as V³
  const p1 = powerRequired({ ...cond, V: 40 }), p2 = powerRequired({ ...cond, V: 80 });
  close(p2.parasite / p1.parasite, 8, 1e-9, 'parasite ∝ V³');
});

test('top speed and its limits', () => {
  const s = speedSchedule({ mass: UH60.mtow, pressureAltitude: 0, isaDev: 0 });
  between(s.vmax / KT, 145, 180, 'max level speed at MCP, MTOW, SL (published ≈ 159 kt)');
  // tip-Mach boundary: (ΩR + V)/a = M_lim
  const a = airData(0, 0).a;
  close((rotorGeometry().vtip + s.vTip) / a, UH60.tipMachLimit, 1e-6, 'advancing-tip Mach limit');
  // a cold day lowers the tip-Mach speed; a hot, high, heavy day brings in retreating-blade stall
  assert.ok(speedSchedule({ mass: 8000, pressureAltitude: 0, isaDev: -30 }).vTip < s.vTip);
  const hot = speedSchedule({ mass: UH60.mtow, pressureAltitude: 1500, isaDev: 20 });
  assert.equal(hot.limit, 'retreating-blade stall');
});

test('autorotation: roughly 2,000–2,600 ft/min at the minimum-descent speed', () => {
  const a = autorotation({ mass: 9000, pressureAltitude: 0, isaDev: 0 });
  between(a.minRod / FPM, 1800, 2700, 'minimum rate of descent ft/min');
  const s = speedSchedule({ mass: 9000, pressureAltitude: 0, isaDev: 0 });
  close(a.vMinRod / KT, s.vbe / KT, 6, 'minimum descent near the minimum-power speed');
  between(a.glideRatio, 3, 6, 'best glide ratio');
  assert.ok(a.vBestGlide > a.vMinRod);
});

test('rotor stored energy buys about a second after a double engine failure', () => {
  const p = powerRequired({ mass: UH60.mtow });
  const e = rotorEnergy(p.mainRotor + p.tailRotor);
  between(e.E / 1e6, 3, 5, 'rotor kinetic energy MJ');
  between(e.seconds, 0.4, 1.5, 'seconds to 80 % rotor speed with the collective held');
});

test('stabilator schedule: 40° trailing edge down in the hover, near level at speed', () => {
  assert.equal(stabilatorSchedule(0), 40);
  assert.ok(stabilatorSchedule(80) < 40 && stabilatorSchedule(80) > 0);
  between(stabilatorSchedule(150), -5, 2, 'cruise incidence');
});

test('heliPerformance summarises a condition consistently', () => {
  const r = heliPerformance({ mass: 8500, pressureAltitude: 500, isaDev: 10, V: 60 * KT });
  assert.ok(r.canHoverOGE && r.canHoverIGE);
  assert.ok(r.ceilingIGE > r.ceilingOGE);
  assert.ok(r.fwd.total < r.hoverOGE.total, 'translational lift: 60 kt needs less than the hover');
  assert.ok(Math.abs(r.fwd.shp * SHP - r.fwd.total) < 1e-6);
  assert.equal(r.overweight, false);
  assert.equal(heliPerformance({ mass: 10200 }).overweight, true);
});
