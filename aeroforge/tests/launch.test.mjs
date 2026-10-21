// Launch regression tests for the Falcon Heavy ascent model: `node --test tests/launch.test.mjs`.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  simulateAscent, sampleAt, tsiolkovsky, planarElements, engineThrust, exitArea, liftoffMass, deltaVBudget,
  FALCON_HEAVY, MU_EARTH, R_EARTH, ORBIT_TOLERANCE, FAIRING_HEATING_LIMIT,
} from '../src/physics/launch.js';
import { isa } from '../src/physics/atmosphere.js';
import { readFileSync } from 'node:fs';
import { R as CORE_R, BOOSTER_X, Y as ST } from '../src/models/falcon/dims.js';
import TOUR from '../src/learn/tours/rocket.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b} ± ${tol}, got ${a}`);
const P_SL = 101325;

test('Tsiolkovsky and orbital elements', () => {
  close(tsiolkovsky(300, Math.E, 1), 300 * 9.80665, 1e-9);
  const r = R_EARTH + 300e3;
  const el = planarElements(r, 0, Math.sqrt(MU_EARTH / r));
  close(el.e, 0, 1e-9);
  close(el.rp, r, 1e-3);
});

test('engine model reproduces the published Falcon Heavy thrust figures', () => {
  const { booster: B, core: C, upper: U } = FALCON_HEAVY;
  // 27 Merlin 1D: SpaceX lists 22,819 kN at sea level and 24,681 kN in vacuum
  const sl = engineThrust(B, P_SL).thrust * B.count + engineThrust(C, P_SL).thrust;
  const vac = engineThrust(B, 0).thrust * B.count + engineThrust(C, 0).thrust;
  close(sl / 1e3, 22819, 22819 * 0.002, 'liftoff thrust kN');
  close(vac / 1e3, 24681, 24681 * 0.002, 'vacuum thrust kN');
  // the exit area implied by 845 → 914 kN is a ≈ 0.93 m nozzle exit
  close(Math.sqrt((4 * exitArea(C)) / Math.PI), 0.93, 0.02, 'Merlin 1D exit diameter m');
  // Merlin Vacuum: 981 kN, Isp 348 s → 287.5 kg/s; 3.3 m exit
  close(Math.sqrt((4 * exitArea(U)) / Math.PI), 3.3, 0.02, 'MVac exit diameter m');
  const u = engineThrust(U, 0);
  close(u.thrust / 1e3, 981, 0.5, 'MVac thrust kN');
  close(u.mdot, 981e3 / (348 * 9.80665), 1e-6, 'MVac mass flow');
  // throttle scales thrust and flow together
  close(engineThrust(C, P_SL, 0.55).thrust, 0.55 * engineThrust(C, P_SL).thrust, 1e-6);
});

test('stage loads and liftoff mass match the published Falcon Heavy figures', () => {
  const { booster: B, core: C, upper: U } = FALCON_HEAVY;
  // Falcon Heavy spec table: 287.4 t LOX + 123.5 t RP-1 per core; second stage 75.2 + 32.3 t
  close(B.prop, 287400 + 123500, 1, 'side-booster propellant kg');
  close(C.prop, 287400 + 123500, 1, 'centre-core propellant kg');
  close(U.prop, 75200 + 32300, 1, 'second-stage propellant kg');
  close(U.dry + U.prop, 111500, 1, 'second stage fuelled kg');
  close(B.dry + B.prop, 433100, 1, 'side booster fuelled kg');
  close(FALCON_HEAVY.fairing, 1700, 1, 'fairing kg');
  // SpaceX's 1,420,788 kg is the vehicle without payload
  close(liftoffMass(FALCON_HEAVY, 0), 1420788, 1420788 * 0.01, 'liftoff mass kg');
  const tw = (engineThrust(B, P_SL).thrust * 2 + engineThrust(C, P_SL).thrust) / (liftoffMass(FALCON_HEAVY, 15000) * 9.80665);
  assert.ok(tw > 1.55 && tw < 1.68, `liftoff T/W ${tw}`);
});

test('ideal Δv budget exceeds the ≈ 9.4 km/s a LEO ascent needs, split over three burns', () => {
  const b = deltaVBudget(FALCON_HEAVY, 15000);
  assert.ok(b.boost > 3500 && b.core > 1200 && b.upper > 5500, JSON.stringify(b));
  assert.ok(b.total > 9400 && b.total < 14000, `total ${b.total}`);
  // nine engines at 299.7 kg/s each empty 410.9 t in ≈ 152 s (SpaceX: side-booster burn ≈ 154 s)
  close(b.tBoost, 154.3, 154.3 * 0.02, 'side boosters burn time s');
});

test('Falcon Heavy reaches a near-circular 200 km LEO with the default mission', () => {
  const { result, events, samples } = simulateAscent({ payload: 15000, kickAngle: 14 });
  assert.ok(result.success, `orbit achieved (${events.at(-1).label})`);
  close(result.perigee / 1000, 200, 12, 'perigee km');
  close(result.apogee / 1000, 200, 12, 'apogee km');
  const at = (code) => events.find((e) => e.code === code)?.t;
  const order = ['LIFTOFF', 'THROTTLE', 'BECO', 'BSEP', 'THROTTLE_UP', 'MECO', 'SEP', 'SES', 'FAIRING', 'SECO', 'ORBIT'];
  for (let i = 0; i < order.length; i++) {
    assert.ok(at(order[i]) != null, `event ${order[i]}`);
    if (i > 0) assert.ok(at(order[i]) >= at(order[i - 1]), `${order[i]} after ${order[i - 1]}`);
  }
  assert.ok(at('MAXQ') != null, 'event MAXQ');
  // flown Falcon Heavy (Arabsat-6A): BECO T+2:34, MECO T+3:31, SES T+3:42, fairing T+4:07
  assert.ok(at('BECO') > 145 && at('BECO') < 158, `BECO at ${at('BECO')}`);
  close(at('BSEP') - at('BECO'), 3, 0.2, 'BECO → separation s');
  assert.ok(at('MECO') > 200 && at('MECO') < 220, `MECO at ${at('MECO')}`);
  close(at('SES') - at('MECO'), 10, 0.2, 'MECO → SES s');
  const fair = at('FAIRING') - at('SES');
  assert.ok(fair >= 25 && fair < 40, `fairing ${fair} s after SES`);
  // the fairing goes only once free-molecular heating ½ρv³ is below the payload limit
  const sf = sampleAt(samples, at('FAIRING'));
  assert.ok(0.5 * isa(sf.h).rho * sf.vAir ** 3 < FAIRING_HEATING_LIMIT, 'fairing heating limit');
  // max-Q: flown webcasts call it at T+1:06–1:09; this point-mass model reaches it ≈ 10 s sooner
  assert.ok(result.maxQ.q > 30e3 && result.maxQ.q < 55e3, `max-Q ${result.maxQ.q}`);
  assert.ok(result.maxQ.t > 50 && result.maxQ.t < 70, `max-Q at ${result.maxQ.t}`);
  const mid = sampleAt(samples, 100);
  assert.ok(mid.h > 20e3 && mid.h < 60e3, 'altitude at T+100 s');
  // the centre core runs throttled while the boosters are attached, then at full thrust
  assert.equal(sampleAt(samples, 20).coreThrottle, 1);
  close(sampleAt(samples, 100).coreThrottle, FALCON_HEAVY.coreThrottleDown, 1e-9);
  assert.equal(sampleAt(samples, at('BSEP') + 5).coreThrottle, 1);
  assert.ok(sampleAt(samples, at('BECO') + 1).boostersAttached && !sampleAt(samples, at('BSEP') + 1).boostersAttached);
});

test('payload capability brackets the published 63.8 t to LEO (fully expendable)', () => {
  // with a well-chosen pitch-over, 62 t reaches a 200 km orbit with propellant to spare; 66 t
  // cannot reach orbit with any kick — the model's limit sits within a few per cent of 63.8 t
  const kicks = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  const best = Math.max(...kicks.map((k) => {
    const r = simulateAscent({ payload: 62000, kickAngle: k }).result;
    return r.success ? r.upperPropRemaining : -1;
  }));
  assert.ok(best > 500, `62 t reaches orbit (${best} kg left at the best kick)`);
  for (const kick of kicks) {
    assert.equal(simulateAscent({ payload: 66000, kickAngle: kick }).result.success, false, `66 t, kick ${kick}`);
  }
});

test('every slider setting either reaches its target orbit or fails with a named cause', () => {
  // the lab's ranges: payload 1–75 t, kick 6–18°, target 180–600 km
  let wins = 0;
  for (const target of [180, 300, 450, 600]) {
    for (const payload of [1000, 15000, 40000, 63800, 75000]) {
      for (const kick of [6, 9, 12, 15, 18]) {
        const { result: r, events } = simulateAscent({ payload, kickAngle: kick, targetAltitude: target * 1e3 });
        const tag = `${payload / 1e3} t, ${kick}°, ${target} km`;
        assert.ok(typeof r.label === 'string' && r.label.length > 10, `${tag}: label`);
        assert.ok(!/NaN|Infinity|undefined/.test(events.map((e) => e.label).join(' ')), `${tag}: event text`);
        assert.ok(!/-\d/.test(r.label), `${tag}: no negative altitudes in "${r.label}"`);
        if (r.success) {
          wins++;
          assert.ok(Number.isFinite(r.apogee), `${tag}: finite apogee`);
          assert.ok(Math.abs(r.apogee - target * 1e3) <= ORBIT_TOLERANCE && Math.abs(r.perigee - target * 1e3) <= ORBIT_TOLERANCE,
            `${tag}: ${r.perigee / 1e3} × ${r.apogee / 1e3} km`);
        } else {
          assert.ok(['lofted', 'flat', 'heavy', 'short', 'escape'].includes(r.cause), `${tag}: cause ${r.cause}`);
        }
      }
    }
  }
  assert.ok(wins >= 20, `${wins} successful settings`);
  // one step either side of the default still works; extremes fail for the right reason
  assert.ok(simulateAscent({ payload: 15000, kickAngle: 12 }).result.success, '15 t, 12°');
  assert.ok(simulateAscent({ payload: 15000, kickAngle: 16 }).result.success, '15 t, 16°');
  assert.equal(simulateAscent({ payload: 1000, kickAngle: 6 }).result.cause, 'lofted');
  assert.equal(simulateAscent({ payload: 15000, kickAngle: 18 }).result.cause, 'flat');
});

test('launch samples carry the forces drawn by the force-vector overlay', () => {
  const { samples } = simulateAscent({ payload: 15000 });
  const g0 = MU_EARTH / (R_EARTH * R_EARTH);
  const first = samples[0];
  close(first.weight, first.mass * g0, first.mass * 0.01, 'weight at liftoff');
  assert.ok(first.thrust / first.weight > 1.5, 'liftoff thrust exceeds weight');
  // drag peaks in the dense lower atmosphere, then vanishes in vacuum
  const peak = samples.reduce((a, s) => (s.drag > a.drag ? s : a));
  assert.ok(peak.h > 5e3 && peak.h < 25e3, `peak drag at ${peak.h} m`);
  assert.ok(sampleAt(samples, 400).drag < 1, 'no drag above the atmosphere');
  for (const s of samples) assert.ok(s.drag >= 0 && s.weight > 0);
});

test('an overloaded Falcon Heavy fails to reach orbit, and says why', () => {
  const { result } = simulateAscent({ payload: 90000, kickAngle: 11 });
  assert.equal(result.success, false);
  assert.equal(result.cause, 'heavy');
  assert.match(result.label, /too heavy/);
});

test('station plan matches the published Falcon Heavy dimensions', () => {
  close(2 * BOOSTER_X + 2 * CORE_R, 12.2, 0.01, 'overall width m');
  close(ST.fairingTop, 70, 0.01, 'overall height m');
  // Espace & Exploration no. 51: interstage 4.5 m; first-stage core 42.6 m (the plan's 43.1 m
  // keeps the separation plane where the 70 m overall height puts it)
  close(ST.interTop - ST.s1Top, 4.5, 0.01, 'interstage length m');
  close(ST.s1Top, 42.6, 0.6, 'first-stage length m');
  // the Merlin Vacuum's extension hangs inside the interstage
  assert.ok(ST.mvacExit >= ST.s1Top - 0.01 && ST.mvacExit < ST.interTop - 2.7, `MVac exit at ${ST.mvacExit} m`);
  // the side boosters' forward section sits above the centre core's LOX-tank forward skirt
  assert.ok(ST.adapterTop > ST.s1Top && ST.noseTip > ST.adapterTop, 'booster forward section and nose');
  close(ST.fairingTop - ST.fairingBase, 13.15, 0.06, 'fairing height m (13.1–13.2 m published)');
});

test('landing-leg stance matches the ≈ 18 m (60 ft) span the desc and the tour quote', () => {
  const core = readFileSync(new URL('../src/models/falcon/core.js', import.meta.url), 'utf8');
  const leg = core.match(/const LEG = \{([\s\S]*?)\n\};/)[1];
  const num = (k) => Number(leg.match(new RegExp(`\\b${k}:\\s*([\\d.]+)`))[1]);
  const len = num('len'), hingeY = num('hingeY'), th = (num('deployDeg') * Math.PI) / 180;
  // foot pad (radius 0.4 m) centred 0.18 m outboard of the hinge line and 0.32 m short of the leg's
  // tip; the hinge sits 0.1 m outside the skin (core.js landing legs)
  const rFoot = CORE_R + 0.1 + 0.18 * Math.cos(th) + (len - 0.32) * Math.sin(th) + 0.4;
  const yFoot = hingeY + (len - 0.32) * Math.cos(th) - 0.18 * Math.sin(th);
  close(2 * rFoot, 18.3, 0.5, 'deployed span m');
  assert.ok(yFoot < -1 && yFoot > -2.5, `foot pads ${yFoot.toFixed(2)} m below the nozzle exits`);
  assert.match(core, /about 18 m \(60 ft\) across/, 'landing-leg desc quotes the span');
  assert.ok(TOUR.some((s) => s.demo === 'deploy' && /about 18 m across/.test(s.body)), 'the leg tour step quotes the span');
});

test('guided tour: every focused part exists in the model source', () => {
  const read = (f) => readFileSync(new URL(`../src/models/${f}`, import.meta.url), 'utf8');
  const core = read('falcon/core.js');
  const rest = ['falcon/upper.js', 'falcon/pad.js', 'rocket.js'].map(read).join('\n');
  // first argument of every part call: P / O / E (core), P / S / V (upper), G (pad)
  const names = (src) => {
    const args = [...src.matchAll(/\b(?:P|O|E|S|V|G)\(((?:[^{$]|\$(?!\{)|\$\{[^}]*\})*?),\s*\{/g)].map((m) => m[1]);
    const lit = new Set(args.flatMap((a) => [...a.matchAll(/^\s*'((?:[^'\\]|\\.)+)'\s*$/g)].map((m) => m[1].replace(/\\'/g, "'"))));
    // names passed through a loop variable: for (const [name, …] of [['forward attach fitting', …], …])
    for (const m of src.matchAll(/\[\s*'((?:[^'\\]|\\.)+)',\s*[\w.]+,\s*[\d.]+\s*\]/g)) lit.add(m[1]);
    const esc = (t) => t.replace(/[.*+?^()|[\]\\]/g, '\\$&');
    const tpl = args.flatMap((a) => [...a.matchAll(/^\s*`([^`]*)`\s*$/g)].map((m) => new RegExp(`^${m[1].split(/\$\{[^}]+\}/).map(esc).join('(?:A|B)')}$`)));
    return (n) => lit.has(n) || tpl.some((re) => re.test(n));
  };
  const inCore = names(core), inRest = names(rest);
  const known = (n) => {
    const m = n.match(/^(Centre core|Side booster A|Side booster B) (.+)$/);
    return m ? inCore(m[2]) : inRest(n);
  };
  assert.ok(TOUR.length >= 10 && TOUR.length <= 16, `${TOUR.length} tour steps`);
  const modes = new Set(['studio', 'xray', 'blueprint', 'systems', 'thermal', 'pressure']);
  const words = (t) => t.trim().split(/\s+/).length;
  for (const [i, step] of TOUR.entries()) {
    assert.ok(step.title && step.body && step.key, `step ${i + 1} has a title, body and key idea`);
    if (step.mode) assert.ok(modes.has(step.mode), `step ${i + 1}: mode ${step.mode}`);
    assert.ok(words(step.body) <= 90 && words(step.key) <= 45, `step ${i + 1} text fits the card (${words(step.body)} + ${words(step.key)} words)`);
    for (const name of step.focus || []) assert.ok(known(name), `step ${i + 1}: no part named "${name}"`);
  }
  // the landing-leg step plays the leg deployment
  assert.ok(TOUR.some((s) => s.demo === 'deploy' && (s.focus || []).some((n) => /landing legs/.test(n))), 'the tour deploys the landing legs');
  // a deliberately wrong name is caught
  assert.equal(known('Centre core LOX downcomer'), false);
});
