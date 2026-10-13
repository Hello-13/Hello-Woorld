// F-22A Raptor regression tests: `node --test tests/fighter.test.mjs` (also run by `npm test`).
// References: USAF F-22A fact sheet and Wikipedia (length 18.92 m, span 13.56 m, height 5.08 m,
// wing area 78.04 m², 42° / −17° edge sweeps, empty 19,700 kg, gross 29,410 kg, MTOW 38,000 kg,
// 8,200 kg internal fuel, Mach 2.25 top speed, Mach 1.76 supercruise, 19,812 m ceiling, +9 / −3 g);
// Pratt & Whitney / Wikipedia F119-PW-100 (116 kN dry, 156 kN class with afterburner, ±20° pitch
// vectoring); canopy 140 × 45 × 27 in, 360 lb.
//
// The model's geometry is checked through its three.js-free layout module; the tour is checked
// against the part names declared in the model source, so a renamed part cannot silently drop out
// of the guided tour.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { flightState, psSweep, liftSlope, thrust, FIGHTER } from '../src/physics/aero.js';
import * as L from '../src/models/f22/layout.js';
import TOUR from '../src/learn/tours/fighter.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b} ± ${tol}, got ${a}`);
const DEG = Math.PI / 180;

test('aero data block carries the published F-22A figures', () => {
  assert.equal(FIGHTER.wingArea, 78.04);
  assert.equal(FIGHTER.span, 13.56);
  assert.equal(FIGHTER.massEmpty, 19700);
  assert.equal(FIGHTER.massCombat, 29410);
  assert.equal(FIGHTER.massMaxTakeoff, 38000);
  assert.equal(FIGHTER.fuelInternal, 8200);
  assert.equal(FIGHTER.machMax, 2.25);
  assert.equal(FIGHTER.machSupercruise, 1.76);
  assert.equal(FIGHTER.ceiling, 19812);
  assert.equal(FIGHTER.gLimit, 9);
  assert.equal(FIGHTER.gNegLimit, -3);
  assert.equal(FIGHTER.tvcDeg, 20);
  close(thrust(0.8, 0, 0) / 2e3, 116, 0.5, 'dry thrust per engine at sea level, kN');
  close(thrust(1, 0, 0) / 2e3, 156, 0.5, 'afterburning thrust per engine at sea level, kN');
  // gross weight = empty + full internal fuel + about 1.5 t of pilot, missiles, ammunition and fluids
  const stores = FIGHTER.massCombat - FIGHTER.massEmpty - FIGHTER.fuelInternal;
  assert.ok(stores > 1200 && stores < 1800, `stores ${stores} kg`);
});

test('layout matches the published dimensions', () => {
  assert.equal(L.LENGTH, 18.92);
  close(L.X(0) - L.X(L.LENGTH), 18.92, 1e-9, 'nose to tail');
  close(2 * L.WING.semi, 13.56, 1e-9, 'span m');
  close(L.WING.le / DEG, 42, 1e-9, 'leading-edge sweep');
  close(L.WING.te / DEG, -17, 1e-9, 'trailing-edge sweep');
  // reference trapezoid area: centre-line chord to tip chord across both semi-spans
  const tip = L.wingTE(L.WING.semi) - L.wingLE(L.WING.semi);
  close(L.WING.semi * (L.WING.c0 + tip), 78.04, 0.1, 'wing area m²');
  close((4 * L.WING.semi ** 2) / 78.04, 2.36, 0.01, 'aspect ratio');
  close(L.FIN.cant / DEG, 28, 1e-9, 'vertical-tail cant');
  // fin tips set the 5.08 m height above the ground line
  const finTip = L.FIN.rootY + L.FIN.span * Math.cos(L.FIN.cant);
  close(finTip - L.GROUND, 5.08, 0.08, 'height m');
  close(2 * L.STAB.tipZ, 8.84, 1e-9, 'stabilator span m');
});

test('canopy is the one-piece 140 × 45 × 27 in transparency', () => {
  close(L.CANOPY_S1 - L.CANOPY_S0, 3.56, 0.03, 'canopy length m');
  let w = 0, top = -Infinity, sill = Infinity;
  for (let s = L.CANOPY_S0 + 0.01; s < L.CANOPY_S1; s += 0.01) {
    w = Math.max(w, 2 * L.sillW(s));
    top = Math.max(top, L.canopyTop(s));
    sill = Math.min(sill, L.upperA(s, L.sillW(s)));
  }
  close(w, 1.14, 0.03, 'canopy width m');
  close(top - sill, 0.69, 0.06, 'canopy depth m');
  // a smooth bubble: the crown line has no kinks (second differences stay small)
  let worst = 0;
  for (let s = L.CANOPY_S0 + 0.1; s < L.CANOPY_S1 - 0.1; s += 0.02) worst = Math.max(worst, Math.abs(L.canopyTop(s + 0.02) - 2 * L.canopyTop(s) + L.canopyTop(s - 0.02)));
  assert.ok(worst < 0.004, `canopy crown curvature jump ${worst}`);
});

test('anti-collision strobe pulses about once a second', () => {
  const dt = 1 / 60;
  let pulses = 0, on = 0, prev = false, longest = 0, run = 0;
  for (let t = 0; t < 10; t += dt) {
    const lit = L.strobeLevel(t) > 0.05;
    if (lit && !prev) pulses++;
    if (lit) { on += dt; run += dt; longest = Math.max(longest, run); } else run = 0;
    prev = lit;
  }
  assert.ok(pulses >= 9 && pulses <= 10, `${pulses} pulses in 10 s`);
  assert.ok(longest <= 0.13, `each pulse lasts ${longest.toFixed(3)} s`);
  assert.ok(on < 1.3, `lit ${on.toFixed(2)} s of 10 s`);
  assert.ok(L.STROBE.period >= 1, 'no faster than once a second');
  assert.equal(L.strobeLevel(0), 0, 'dark at the instant it switches on');
});

test('fighter aerodynamics give plausible numbers', () => {
  const cruise = flightState({ altitude: 9000, mach: 0.9, alpha: 4, throttle: 0.8 });
  assert.ok(cruise.n > 0.8 && cruise.n < 1.4, `≈1 g at 4° AoA, got ${cruise.n}`);
  assert.ok(cruise.ps > 0, 'positive excess power at military thrust');
  const stall = flightState({ altitude: 3000, mach: 0.4, alpha: 28, throttle: 1 });
  assert.ok(stall.stalled);
  assert.ok(liftSlope(2.0) < liftSlope(0.5), 'supersonic lift slope is lower');
  // top level-flight speed with afterburner at 40,000 ft ≈ the published Mach 2.25
  const ab = psSweep({ altitude: 12200, throttle: 1 }).filter((p) => p.ps > 0);
  const vmax = ab[ab.length - 1].mach;
  close(vmax, FIGHTER.machMax, 0.15, 'max level Mach with afterburner');
  // supercruise: supersonic on dry thrust (the conceptual model's dry lapse stops short of 1.76)
  const dry = psSweep({ altitude: 12200, throttle: 0.8 }).filter((p) => p.ps > 0);
  assert.ok(dry[dry.length - 1].mach > 1.2, 'supercruise on dry thrust');
  // the +9 g limit is reachable below the stall at corner speed
  const turn = flightState({ altitude: 4000, mach: 0.85, alpha: 18.5, throttle: 1 });
  assert.ok(!turn.stalled && turn.n > 8.5 && turn.n < 9.5, `9 g turn, got ${turn.n}`);
  // compression heating at Mach 2, 12 km: stagnation ≈ 217 K × (1 + 0.2 M²) ≈ 390 K, recovery a little lower
  const hot = flightState({ altitude: 12000, mach: 2, alpha: 2, throttle: 1 });
  assert.ok(hot.stagnationT > 360 && hot.stagnationT < 392, `skin stagnation ${hot.stagnationT}`);
});

test('every guided-tour focus names a part declared in the model', () => {
  const dir = new URL('../src/models/f22/', import.meta.url);
  const src = [readFileSync(new URL('../src/models/fighter.js', import.meta.url), 'utf8'),
    ...readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => readFileSync(new URL(f, dir), 'utf8'))].join('\n');
  // first argument of every P(name, { … }) / surf(name, { … }) call: literal and templated names
  const args = [...src.matchAll(/\b(?:P|surf)\(((?:[^{$]|\$(?!\{)|\$\{[^}]*\})*?),\s*\{/g)].map((m) => m[1]);
  const literals = new Set(args.flatMap((a) => [...a.matchAll(/'((?:[^'\\]|\\.)+)'/g)].map((m) => m[1].replace(/\\'/g, "'"))));
  const esc = (t) => t.replace(/[.*+?^()|[\]\\]/g, '\\$&');
  const templates = args.flatMap((a) => [...a.matchAll(/`([^`]*)`/g)].map((m) => new RegExp(`^${m[1].split(/\$\{[^}]+\}/).map(esc).join('(?:right|left)')}$`)));
  assert.ok(literals.size + 2 * templates.length > 100, `found ${literals.size} literal and ${templates.length} templated part names`);
  assert.ok(TOUR.length >= 8 && TOUR.length <= 12, `${TOUR.length} tour steps`);
  const modes = new Set(['studio', 'xray', 'blueprint', 'systems', 'thermal', 'pressure']);
  const demos = new Set(['surfaces', 'tvc', 'bay', 'mach2']);
  for (const [i, step] of TOUR.entries()) {
    assert.ok(step.title && step.body && step.key, `step ${i + 1} has a title, body and key idea`);
    if (step.mode) assert.ok(modes.has(step.mode), `step ${i + 1}: mode ${step.mode}`);
    if (step.demo) assert.ok(demos.has(step.demo), `step ${i + 1}: demo ${step.demo}`);
    for (const name of step.focus || []) assert.ok(literals.has(name) || templates.some((re) => re.test(name)), `step ${i + 1}: no part named "${name}"`);
  }
  for (const d of ['tvc', 'surfaces', 'bay', 'mach2']) assert.ok(TOUR.some((s) => s.demo === d), `the tour runs the ${d} demo`);
});
