// F-22A Raptor regression tests: `node --test tests/fighter.test.mjs` (also run by `npm test`).
// References: USAF F-22A fact sheet and Wikipedia (length 18.92 m, span 13.56 m, height 5.08 m,
// wing area 78.04 m², 42° / −17° edge sweeps, empty 19,700 kg, gross 29,410 kg, MTOW 38,000 kg,
// 8,200 kg internal fuel, Mach 2.25 top speed, Mach 1.21 at sea level, Mach 1.76 supercruise,
// 19,812 m ceiling, +9 / −3 g); Pratt & Whitney / Wikipedia F119-PW-100 (116 kN dry, 156 kN class
// with afterburner, 38 in inlet / 48 in case diameter, ±20° pitch vectoring); canopy
// 140 × 45 × 27 in, 360 lb; AIM-120C 3.65 m × 17.8 cm (USAF fact sheet), LAU-142/A AVEL 9 in stroke
// (Hydraulics & Pneumatics, 1998); main bay split along the centre line (Wikipedia).
//
// The model's geometry is checked through its three.js-free layout module, the lab's flight model
// through the three.js-free f22/performance.js, and the tour against the part names declared in
// the model source, so a renamed part cannot silently drop out of the guided tour.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { flightState, psSweep, liftSlope, thrust, FIGHTER } from '../src/physics/aero.js';
import { isa } from '../src/physics/atmosphere.js';
import { flight, maxLevelMach, trimAlpha, installedThrust } from '../src/models/f22/performance.js';
import * as L from '../src/models/f22/layout.js';
import TOUR from '../src/learn/tours/fighter.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b} ± ${tol}, got ${a}`);
const DEG = Math.PI / 180;
const IN = 0.0254;

test('aero data block carries the published F-22A figures', () => {
  assert.equal(FIGHTER.wingArea, 78.04);
  assert.equal(FIGHTER.span, 13.56);
  assert.equal(FIGHTER.massEmpty, 19700);
  assert.equal(FIGHTER.massCombat, 29410);
  assert.equal(FIGHTER.massMaxTakeoff, 38000);
  assert.equal(FIGHTER.fuelInternal, 8200);
  assert.equal(FIGHTER.machMax, 2.25);
  assert.equal(FIGHTER.machSeaLevel, 1.21);
  assert.equal(FIGHTER.machSupercruise, 1.76);
  assert.equal(FIGHTER.ceiling, 19812);
  assert.equal(FIGHTER.gLimit, 9);
  assert.equal(FIGHTER.gNegLimit, -3);
  assert.equal(FIGHTER.tvcDeg, 20);
  close(thrust(0.8, 0, 0) / 2e3, 116, 0.5, 'dry thrust per engine at sea level, kN');
  close(thrust(1, 0, 0) / 2e3, 156, 0.5, 'afterburning thrust per engine at sea level, kN');
  // the dynamic-pressure limit is the published Mach 1.21 at sea level
  const sl = isa(0);
  close(FIGHTER.qMax, 0.5 * sl.rho * (FIGHTER.machSeaLevel * sl.a) ** 2, 500, 'q limit Pa');
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

test('F119 envelope and the stabilator fit the airframe', () => {
  close(2 * L.F119.rInlet, 38 * IN, 0.01, 'F119 inlet diameter');
  close(2 * L.F119.rCase, 48 * IN, 0.03, 'F119 case diameter');
  assert.ok(L.F119.rMax * 2 <= 50 * IN + 0.01, 'F119 maximum diameter');
  // the 1.22 m case (to the augmentor at s 15.6) stays inside the outer mould line all the way round
  for (let s = L.FAN_S; s <= 15.6; s += 0.1) {
    for (let k = 0; k < 72; k++) {
      const a = (k / 72) * 2 * Math.PI, y = L.ENG_Y + L.F119.rCase * Math.sin(a), z = L.ENG_Z + L.F119.rCase * Math.cos(a);
      assert.ok(y < L.topAt(s, z) - 0.01 && y > L.bottomAt(s, z) + 0.01 && z < L.bW(s) - 0.25, `engine case inside the skin at s ${s.toFixed(1)}`);
    }
  }
  assert.ok(L.ENG_Z - L.F119.rCase > 0.05, 'room for the keel between the engines');
  // the inboard leading edge of the all-moving tail is cut back behind the wing's trailing edge
  for (let z = L.STAB.rootZ; z <= L.STAB.notchZ + 0.3; z += 0.05) assert.ok(L.stabLE(z) > L.wingTE(z) + 0.01, `stabilator clears the wing at z ${z.toFixed(2)}`);
});

test('canopy is the one-piece 140 × 45 × 27 in transparency', () => {
  close(L.CANOPY_S1 - L.CANOPY_S0, 140 * IN, 0.03, 'canopy length m');
  let w = 0, top = -Infinity, sill = Infinity;
  for (let s = L.CANOPY_S0 + 0.01; s < L.CANOPY_S1; s += 0.01) {
    w = Math.max(w, 2 * L.sillW(s));
    top = Math.max(top, L.canopyTop(s));
    sill = Math.min(sill, L.upperA(s, L.sillW(s)));
  }
  close(w, 45 * IN, 0.03, 'canopy width m');
  close(top - sill, 27 * IN, 0.06, 'canopy depth m');
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

test('shared aero model gives plausible numbers for the F-22A', () => {
  const cruise = flightState({ altitude: 9000, mach: 0.9, alpha: 4, throttle: 0.8 });
  assert.ok(cruise.n > 0.8 && cruise.n < 1.4, `≈1 g at 4° AoA, got ${cruise.n}`);
  assert.ok(cruise.ps > 0, 'positive excess power at military thrust');
  assert.ok(flightState({ altitude: 3000, mach: 0.4, alpha: FIGHTER.alphaStall + 2, throttle: 1 }).stalled, 'stalls past alphaStall');
  assert.ok(!flightState({ altitude: 3000, mach: 0.4, alpha: FIGHTER.alphaStall - 2, throttle: 1 }).stalled, 'not stalled below alphaStall');
  assert.ok(liftSlope(2.0) < liftSlope(0.5), 'supersonic lift slope is lower');
  // the linear lift curve reaches CLmax at the stall, so lift peaks there instead of jumping up after it
  close(liftSlope(0.3) * FIGHTER.alphaStall * DEG, FIGHTER.clMax, 0.05, 'CL at the stall vs CLmax');
  // top level-flight speed with afterburner at 40,000 ft ≈ the published Mach 2.25
  const ab = psSweep({ altitude: 12200, throttle: 1 }).filter((p) => p.ps > 0);
  close(ab[ab.length - 1].mach, FIGHTER.machMax, 0.15, 'max level Mach with afterburner (shared model)');
  // the +9 g limit is reachable below the stall at corner speed
  const turn = flightState({ altitude: 4000, mach: 0.85, alpha: 18.5, throttle: 1 });
  assert.ok(!turn.stalled && turn.n > 8.5 && turn.n < 9.5, `9 g turn, got ${turn.n}`);
  // compression heating at Mach 2, 12 km: stagnation ≈ 217 K × (1 + 0.2 M²) ≈ 390 K, recovery a little lower
  const hot = flightState({ altitude: 12000, mach: 2, alpha: 2, throttle: 1 });
  assert.ok(hot.stagnationT > 360 && hot.stagnationT < 392, `skin stagnation ${hot.stagnationT}`);
});

test('lab flight model reproduces the published envelope', () => {
  const m = FIGHTER.massCombat;
  // supercruise: published Mach 1.76 at altitude on military (dry) power
  close(maxLevelMach(12200, 0.8, m), FIGHTER.machSupercruise, 0.1, 'max dry level Mach at 12.2 km');
  const sc = flight({ altitude: 12200, mach: FIGHTER.machSupercruise, alpha: trimAlpha({ altitude: 12200, mach: FIGHTER.machSupercruise }, m), throttle: 0.8, mass: m });
  close(sc.n, 1, 0.05, 'trimmed to 1 g');
  assert.ok(sc.ps >= 0, `supercruise holds speed on dry thrust (Ps ${sc.ps.toFixed(1)} m/s)`);
  // top speed Mach 2.25 with afterburner; at sea level the q limit, not thrust, stops it at Mach 1.21
  close(maxLevelMach(12200, 1, m), FIGHTER.machMax, 0.1, 'max afterburning level Mach at 12.2 km');
  close(maxLevelMach(0, 1, m), FIGHTER.machSeaLevel, 0.02, 'sea-level speed limit');
  assert.ok(flight({ altitude: 0, mach: 1.3, alpha: 0.5, throttle: 1, mass: m }).overQ, 'over-speed flagged past the q limit');
  // ram recovery raises supersonic dry thrust but never above afterburning thrust, and leaves sea-level static alone
  close(installedThrust(0.8, 0, 0), thrust(0.8, 0, 0), 1, 'static dry thrust unchanged');
  assert.ok(installedThrust(0.8, 1.76, 12200) > thrust(0.8, 1.76, 12200) * 1.2, 'ram recovery at supercruise');
  assert.ok(installedThrust(0.8, 1.76, 12200) < installedThrust(1, 1.76, 12200), 'dry below afterburner');
  for (let k = 0; k <= 20; k++) {
    const thr = k / 20;
    assert.ok(installedThrust(thr + 0.05, 1.5, 11000) >= installedThrust(thr, 1.5, 11000) - 1, `thrust rises with throttle at ${thr}`);
  }
  // past the stall lift falls: it never jumps above the pre-stall value
  for (const mach of [0.3, 0.6, 0.85]) {
    const c = { altitude: 3000, mach, throttle: 1, mass: m };
    const pre = flight({ ...c, alpha: FIGHTER.alphaStall - 0.1 }), post = flight({ ...c, alpha: FIGHTER.alphaStall + 0.1 }), deep = flight({ ...c, alpha: FIGHTER.alphaStall + 8 });
    assert.ok(post.stalled && post.cl <= pre.cl + 1e-6, `no lift jump at the stall, Mach ${mach}: ${pre.cl.toFixed(3)} → ${post.cl.toFixed(3)}`);
    assert.ok(deep.cl < pre.cl * 0.8, `lift collapses in the deep stall, Mach ${mach}`);
  }
});

test('guided tour: real part names, every demo, cards that fit', () => {
  const dir = new URL('../src/models/f22/', import.meta.url);
  const src = [readFileSync(new URL('../src/models/fighter.js', import.meta.url), 'utf8'),
    ...readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => readFileSync(new URL(f, dir), 'utf8'))].join('\n');
  // first argument of every P(name, { … }) / surf(name, { … }) call: literal and templated names
  const args = [...src.matchAll(/\b(?:P|surf)\(((?:[^{$]|\$(?!\{)|\$\{[^}]*\})*?),\s*\{/g)].map((m) => m[1]);
  const literals = new Set(args.flatMap((a) => [...a.matchAll(/'((?:[^'\\]|\\.)+)'/g)].map((m) => m[1].replace(/\\'/g, "'"))));
  const esc = (t) => t.replace(/[.*+?^()|[\]\\]/g, '\\$&');
  // template placeholders stand for a side (right / left), a numbered unit (CIP 1) or a system letter (A / B)
  const templates = args.flatMap((a) => [...a.matchAll(/`([^`]*)`/g)].map((m) => new RegExp(`^${m[1].split(/\$\{[^}]+\}/).map(esc).join('(?:right|left|Right|Left|\\d|A|B)')}$`)));
  assert.ok(literals.size + 2 * templates.length > 150, `found ${literals.size} literal and ${templates.length} templated part names`);
  assert.ok(TOUR.length >= 8 && TOUR.length <= 13, `${TOUR.length} tour steps`);
  const modes = new Set(['studio', 'xray', 'blueprint', 'systems', 'thermal', 'pressure']);
  const demos = new Set(['surfaces', 'tvc', 'bay', 'mach2']);
  const words = (t) => t.trim().split(/\s+/).length;
  for (const [i, step] of TOUR.entries()) {
    assert.ok(step.title && step.body && step.key, `step ${i + 1} has a title, body and key idea`);
    if (step.mode) assert.ok(modes.has(step.mode), `step ${i + 1}: mode ${step.mode}`);
    if (step.demo) assert.ok(demos.has(step.demo), `step ${i + 1}: demo ${step.demo}`);
    assert.ok(words(step.body) <= 46 && words(step.key) <= 26 && step.title.length <= 26, `step ${i + 1} text fits the card (${words(step.body)} + ${words(step.key)} words)`);
    for (const name of step.focus || []) assert.ok(literals.has(name) || templates.some((re) => re.test(name)), `step ${i + 1}: no part named "${name}"`);
  }
  for (const d of ['tvc', 'surfaces', 'bay', 'mach2']) assert.ok(TOUR.some((s) => s.demo === d), `the tour runs the ${d} demo`);
});

test('main bay: six AIM-120C clear the centre web, the walls, the doors and each other', () => {
  const { r: R, tip: T } = L.AMRAAM;
  const W = L.MAIN_BAY.z - 0.004, web = L.DIVIDER.half;
  const doorInner = -0.885 + L.MAIN_DOOR.thick;               // inside face of the closed doors (belly ≈ −0.885)
  const fins = ([z, y, t]) => [0, 1, 2, 3].map((k) => { const a = t + (k * Math.PI) / 2; return [[z + R * Math.cos(a), y + R * Math.sin(a)], [z + T * Math.cos(a), y + T * Math.sin(a)]]; });
  const segPt = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1]; const u = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy))); return Math.hypot(p[0] - a[0] - u * dx, p[1] - a[1] - u * dy); };
  const segSeg = (a, b, c, d) => {
    const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    if (o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b)) return -1;
    return Math.min(segPt(a, c, d), segPt(b, c, d), segPt(c, a, b), segPt(d, a, b));
  };
  const S = L.AMRAAM_SLOTS;
  assert.equal(S.length, 3, 'three missiles each side of the web');
  for (const m of S) {
    for (const [, tip] of fins(m)) {
      assert.ok(tip[0] > web, `fin clears the centre web (${tip[0].toFixed(3)} m)`);
      assert.ok(tip[0] < W, `fin clears the bay wall (${tip[0].toFixed(3)} m)`);
      assert.ok(tip[1] > doorInner, `fin clears the closed doors (${tip[1].toFixed(3)} m)`);
      assert.ok(tip[1] < L.bayCeil(tip[0]), `fin clears the bay ceiling (${tip[1].toFixed(3)} m)`);
      // after the 9 in AVEL stroke, anything below the belly must pass inboard of the folded-open doors
      if (tip[1] - L.AVEL_STROKE < -0.885) assert.ok(tip[0] < L.OPEN_DOOR_Z, `ejected fin clears the open door (${tip[0].toFixed(3)} m)`);
    }
    assert.ok(m[0] - R > web && m[0] + R < W, 'body inside the bay half');
  }
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
    const A = S[i], B = S[j];
    assert.ok(Math.hypot(A[0] - B[0], A[1] - B[1]) > 2 * R, `bodies ${i}/${j} apart`);
    for (const f of fins(A)) for (const g of fins(B)) assert.ok(segSeg(f[0], f[1], g[0], g[1]) > 0, `fins of missiles ${i} and ${j} do not cross`);
    for (const f of fins(A)) assert.ok(segPt([B[0], B[1]], f[0], f[1]) > R, `fin of ${i} clears body ${j}`);
    for (const f of fins(B)) assert.ok(segPt([A[0], A[1]], f[0], f[1]) > R, `fin of ${j} clears body ${i}`);
  }
  // two bifold panels per door, meeting the web's door land and the bay-edge hinge
  close(L.MAIN_DOOR.zFold - L.MAIN_DOOR.zIn, L.MAIN_BAY.z - L.MAIN_DOOR.zFold, 0.02, 'equal bifold panels');
  close(L.AVEL_STROKE, 0.2286, 1e-4, 'AVEL stroke 9 in');
});

test('saw-tooth door edges run parallel to the 42° wing leading edge', () => {
  close(Math.atan(L.TOOTH_SLOPE) / DEG, 42, 1e-9, 'tooth angle');
  const grid = L.toothedGrid((s, u) => [s, 0, u * 0.6], [10, 10.5, 11], { width: 0.6 });
  for (const row of [grid[0], grid[grid.length - 1]]) {
    for (let k = 0; k < row.length - 1; k++) {
      const ds = row[k + 1][0] - row[k][0], dz = row[k + 1][2] - row[k][2];
      close(Math.abs(ds / dz), L.TOOTH_SLOPE, 1e-9, 'each tooth edge at the leading-edge angle');
    }
  }
  // teeth reach forward of the fore edge and aft of the aft edge; the middle row stays straight
  assert.ok(Math.min(...grid[0].map((p) => p[0])) < 10 && Math.max(...grid[2].map((p) => p[0])) > 11);
  assert.ok(grid[1].every((p) => p[0] === 10.5));
});

test('weight-on-wheels switches sit on their legs, clear of the tyres', () => {
  for (const key of ['nose', 'main']) {
    const g = L.GEAR[key];
    const c = L.wowCentre(g);
    const axle = [g.axleS, L.GROUND + g.r, g.axleZ];
    // every corner of the switch box is more than a tyre radius + 3 cm from the axle
    for (const dx of [-1, 1]) for (const dy of [-1, 1]) for (const dz of [-1, 1]) {
      const p = [c[0] + (dx * g.wow.box[0]) / 2, c[1] + (dy * g.wow.box[1]) / 2, c[2] + (dz * g.wow.box[2]) / 2];
      const d = Math.hypot(p[0] - axle[0], p[1] - axle[1], p[2] - axle[2]);
      assert.ok(d > g.r + 0.03, `${key} switch corner ${d.toFixed(3)} m from the axle`);
    }
    // and it is mounted on the leg: within 0.2 m of the trunnion–axle line
    const t = g.trunnion, u = axle.map((v, i) => v - t[i]), n = Math.hypot(...u);
    const w = c.map((v, i) => v - t[i]);
    const along = (w[0] * u[0] + w[1] * u[1] + w[2] * u[2]) / n;
    const off = Math.sqrt(Math.max(0, w[0] ** 2 + w[1] ** 2 + w[2] ** 2 - along ** 2));
    assert.ok(off < 0.2 && along > 0 && along < n, `${key} switch ${off.toFixed(3)} m off the leg`);
  }
});
