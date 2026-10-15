// F-22A Raptor regression tests: `node --test tests/fighter.test.mjs` (also run by `npm test`).
// References: USAF F-22A fact sheet and Wikipedia (length 18.92 m, span 13.56 m, height 5.08 m,
// wing area 78.04 m², 42° / −17° edge sweeps, empty 19,700 kg, gross 29,410 kg, MTOW 38,000 kg,
// 8,200 kg internal fuel, Mach 2.25 top speed, Mach 1.21 at sea level, Mach 1.76 supercruise,
// 19,812 m ceiling, +9 / −3 g); Pratt & Whitney / Wikipedia F119-PW-100 (116 kN dry, 156 kN class
// with afterburner, 38 in inlet / 48 in case diameter, 196 in long, ±20° pitch vectoring); canopy
// 140 × 45 × 27 in, 360 lb (Haisty, Lockheed Martin, 2000); AIM-120C 3.65 m × 17.8 cm (USAF fact sheet), LAU-142/A AVEL 9 in stroke
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
  // reference trapezoid area: centre-line chord to tip chord across both semi-spans, the trailing edge carried
  // straight out to the tip
  const tip = L.wingTEref(L.WING.semi) - L.wingLE(L.WING.semi);
  close(L.WING.semi * (L.WING.c0 + tip), 78.04, 0.1, 'wing area m²');
  // the real trailing edge follows the reference line to the kink, then the tip is cropped (never outside the
  // reference planform), leaving a tip chord of about 1.1 m (NAWDC top view)
  for (let z = 0; z <= L.WING.semi + 1e-9; z += 0.05) assert.ok(L.wingTE(z) <= L.wingTEref(z) + 1e-9, `trailing edge inside the reference planform at z ${z.toFixed(2)}`);
  close(L.wingTE(L.WING.kinkZ), L.wingTEref(L.WING.kinkZ), 1e-9, 'trailing edge continuous at the kink');
  close(L.wingTE(L.WING.semi) - L.wingLE(L.WING.semi), 1.12, 0.1, 'cropped tip chord m');
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
  // the 196 in engine runs from the fan face to the nozzle exit at about s 16.5 (NAWDC top / bottom views)
  close(L.EM(18.52) - L.FAN_S, L.F119.length, 0.02, 'fan face to nozzle exit m');
  // the 1.22 m case (to the augmentor) and then the tapering augmentor (to the nozzle's transition section, which
  // lies inside the external flaps) stay inside the outer mould line all the way round
  const sEnd = L.F119_AUG[L.F119_AUG.length - 1][1];
  const rAt = (s) => (s <= L.AUG_S ? L.F119.rCase : L.mono(L.F119_AUG.map(([r, st]) => [st, r]), s));
  assert.ok(L.AUG_S - L.FAN_S > 2, 'full-diameter case runs at least 2 m aft of the fan face');
  for (let s = L.FAN_S; s <= sEnd + 1e-9; s += 0.1) {
    const r = rAt(s);
    for (let k = 0; k < 72; k++) {
      const a = (k / 72) * 2 * Math.PI, y = L.ENG_Y + r * Math.sin(a), z = L.ENG_Z + r * Math.cos(a);
      assert.ok(y < L.topAt(s, z) - 0.01 && y > L.bottomAt(s, z) + 0.01 && z < L.bW(s) - 0.25, `engine case inside the skin at s ${s.toFixed(1)}`);
    }
  }
  assert.ok(L.ENG_Z - L.F119.rCase > 0.05, 'room for the keel between the engines');
  // the inboard leading edge of the all-moving tail is cut back behind the wing's trailing edge
  for (let z = L.STAB.rootZ; z <= L.STAB.notchZ + 0.3; z += 0.05) assert.ok(L.stabLE(z) > L.wingTE(z) + 0.01, `stabilator clears the wing at z ${z.toFixed(2)}`);
  // and stays clear through full travel: stabilator ±33° (25° pitch + 8° roll) about its spindle against the
  // flaperon trailing edge at ±32° (20° roll + 12° flap), in every chordwise plane where they overlap
  for (let z = L.STAB.rootZ; z <= L.STAB.notchZ + 0.6; z += 0.02) {
    const le = L.wingLE(z), te = L.wingTE(z), yw = L.wingY(z), d0 = L.STAB.pivotS - L.stabLE(z);
    const onFlap = z >= L.SURF.flaperon[0] && z <= L.SURF.flaperon[1], sh = le + L.SURF.hinge.flaperon * (te - le), l = te - sh;
    for (let th = -33; th <= 33; th += 3) for (let df = onFlap ? -32 : 0; df <= (onFlap ? 32 : 0); df += 4) {
      const T = [sh + l * Math.cos(df * DEG), yw - l * Math.sin(df * DEG)];
      const S = [L.STAB.pivotS - d0 * Math.cos(th * DEG), L.STAB.y + d0 * Math.sin(th * DEG)];
      assert.ok(Math.hypot(T[0] - S[0], T[1] - S[1]) > 0.04, `stabilator ${th}° clears the flaperon ${df}° at z ${z.toFixed(2)}`);
    }
  }
});

test('station maps: monotone, and the engine block keeps its published length', () => {
  // interior items keep their place in the structure: each map only ever moves stations aft in step
  for (const [name, f, a, b] of [['M', L.M, 0, L.LENGTH], ['EM', L.EM, 13.3, 18.6], ['WM', L.WM, 8, 17]]) {
    let prev = -Infinity;
    for (let s = a; s <= b + 1e-9; s += 0.01) { const v = f(s); assert.ok(v > prev, `${name} monotone at ${s.toFixed(2)}`); prev = v; }
  }
  // the engine moves as one block: fan, compressor, combustor and turbines keep their lengths; only the augmentor
  // and nozzle are shortened, so the whole engine comes to the published 196 in (tested above)
  close(L.EM(13.38), L.FAN_S, 1e-9, 'fan face');
  for (const s of [13.6, 14.0, 14.6, 15.2, 15.6]) close(L.EM(s) - L.EM(13.38), s - 13.38, 1e-9, `core length to old s ${s}`);
  assert.ok(L.EM(18.52) > 16.4 && L.EM(18.52) < 16.6, `nozzle exit at s ${L.EM(18.52).toFixed(2)}`);
  // in-wing items follow the wing, whose apex moved from 6.06 to 6.58
  close(L.WING.apex, 6.58, 1e-9, 'wing apex');
  close(L.WM(10) - 10, 0.52, 1e-9, 'wing shift');
  // booms end behind the nozzles and the stabilator's trailing-edge vertex is the tail of the jet
  assert.ok(L.BOOM.sEnd1 > L.EM(18.52) + 1 && L.BOOM.sEnd1 < L.LENGTH, 'booms end between the nozzle exit and the tail');
  close(L.STAB.vertexS, L.LENGTH, 1e-9, 'stabilator vertex at the tail');
});

test('canopy: the one-piece transparency is 45 in wide and 27 in tall; 140 in is not its projected or arc length', () => {
  // Haisty (Lockheed Martin, National Press Club, 2000): "approximately 140 inches long, 45 inches wide, 27 inches
  // tall", without saying how the length is taken. Measured in projection (NAWDC side and top orthographic views,
  // T.O. 00-105E-9 top view, side-on photographs) the transparency runs 2.55 → 5.40 (frame to 5.55): 2.85 m, 112 in.
  close(L.CANOPY_S1 - L.CANOPY_S0, 2.85, 0.05, 'projected length of the transparency m');
  // the frame's foot is one straight line in side view (NAWDC: 0.51 m at s 2.8 to 0.80 m at 5.3), so the sill edge
  // lies in a plane; width and height are taken on that base plane, as for the part standing on its edge
  const pts = [];
  for (let s = 3.0; s <= 5.0 + 1e-9; s += 0.05) pts.push([s, L.upperA(s, L.sillW(s))]);
  const n = pts.length, ms = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n;
  const k = pts.reduce((a, p) => a + (p[0] - ms) * (p[1] - my), 0) / pts.reduce((a, p) => a + (p[0] - ms) ** 2, 0);
  const base = (s) => my + k * (s - ms);
  for (const [s, y] of pts) assert.ok(Math.abs(y - base(s)) < 0.012, `sill on its straight line at s ${s.toFixed(2)} (${(y - base(s)).toFixed(3)} m)`);
  assert.ok(Math.atan(k) / DEG > 5 && Math.atan(k) / DEG < 9, `sill line rises ${(Math.atan(k) / DEG).toFixed(1)}° aft`);
  close(base(4.2), 0.67, 0.03, 'sill height beside the pilot m');
  let w = 0, h = 0;
  for (let s = L.CANOPY_S0 + 0.01; s < L.CANOPY_S1; s += 0.01) {
    w = Math.max(w, 2 * L.sillW(s));
    h = Math.max(h, (L.canopyTop(s) - base(s)) * Math.cos(Math.atan(k)));
  }
  close(w, 45 * IN, 0.03, 'canopy width m');
  close(h, 27 * IN, 0.06, 'canopy height above its base plane m');
  // over the top of the bubble the transparency measures about 3.05 m (120 in), 3.2 m (126 in) to the frame's aft
  // end: 140 in (3.56 m) is longer than both, so it is not the length over the bubble either (most likely the
  // formed blank before trimming; the only line on the part that long is its side edge, tip to tail)
  const arc = (s0, s1) => { let l = 0; for (let s = s0; s < s1 - 1e-9; s += 0.005) l += Math.hypot(0.005, L.canopyTop(s + 0.005) - L.canopyTop(s)); return l; };
  const crown = arc(L.CANOPY_S0, L.CANOPY_S1), frame = arc(L.CANOPY_S0, L.CANOPY_FRAME_S1);
  assert.ok(crown > 2.95 && crown < 3.15, `crown arc ${crown.toFixed(3)} m`);
  assert.ok(frame < 140 * IN - 0.25, `crown arc to the frame's aft end ${frame.toFixed(3)} m, well short of 140 in`);
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
    // measured at 1280 × 800: bodies of 255+ characters, or body + key over 355, pushed the key idea under the card's nav
    assert.ok(step.body.length <= 250 && step.body.length + step.key.length <= 355, `step ${i + 1} text fits the card (${step.body.length} + ${step.key.length} characters)`);
    for (const name of step.focus || []) assert.ok(literals.has(name) || templates.some((re) => re.test(name)), `step ${i + 1}: no part named "${name}"`);
  }
  for (const d of ['tvc', 'surfaces', 'bay', 'mach2']) assert.ok(TOUR.some((s) => s.demo === d), `the tour runs the ${d} demo`);
});

test('main bay: six AIM-120C clear the centre web, the walls, the doors and each other', () => {
  const { r: R, tip: T } = L.AMRAAM;
  const W = L.MAIN_BAY.z - 0.004, web = L.DIVIDER.half;
  // inside face of the closed doors, where the belly is highest along the bay
  let belly = -Infinity;
  for (let s = L.MAIN_BAY.s0; s <= L.MAIN_BAY.s1 + 1e-9; s += 0.05) belly = Math.max(belly, -L.bD(s));
  const doorInner = belly + L.MAIN_DOOR.thick;
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
      if (tip[1] - L.AVEL_STROKE < belly) assert.ok(tip[0] < L.OPEN_DOOR_Z, `ejected fin clears the open door (${tip[0].toFixed(3)} m)`);
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
    const axle = [g.axleS, L.GROUND + g.r, g.axleZ], foot = [g.axleS, L.GROUND + g.r, g.legZ];
    // every corner of the switch box is more than a tyre radius + 3 cm from the axle
    for (const dx of [-1, 1]) for (const dy of [-1, 1]) for (const dz of [-1, 1]) {
      const p = [c[0] + (dx * g.wow.box[0]) / 2, c[1] + (dy * g.wow.box[1]) / 2, c[2] + (dz * g.wow.box[2]) / 2];
      const d = Math.hypot(p[0] - axle[0], p[1] - axle[1], p[2] - axle[2]);
      assert.ok(d > g.r + 0.03, `${key} switch corner ${d.toFixed(3)} m from the axle`);
    }
    // and it is mounted on the leg: within 0.2 m of the line from the trunnion to the leg's foot
    const t = g.trunnion, u = foot.map((v, i) => v - t[i]), n = Math.hypot(...u);
    const w = c.map((v, i) => v - t[i]);
    const along = (w[0] * u[0] + w[1] * u[1] + w[2] * u[2]) / n;
    const off = Math.sqrt(Math.max(0, w[0] ** 2 + w[1] ** 2 + w[2] ** 2 - along ** 2));
    assert.ok(off < 0.2 && along > 0 && along < n, `${key} switch ${off.toFixed(3)} m off the leg`);
  }
});

test('inlet ducts are an open air path: bay, side bays and gear wells stay outside them', () => {
  // the duct runs from the raked lip to the fan face and ends round the F119 inlet
  const fan = L.ductSection(L.FAN_S);
  assert.ok(fan && L.ductSection(7.0) && !L.ductSection(L.FAN_S + 0.05), 'duct spans lip → fan face');
  // area centroid of the fan-face section (its points are not evenly spaced round it)
  let A = 0, cz = 0, cy = 0;
  for (let i = 0; i < fan.length; i++) {
    const [z1, y1] = fan[i], [z2, y2] = fan[(i + 1) % fan.length], c = z1 * y2 - z2 * y1;
    A += c / 2; cz += ((z1 + z2) * c) / 6; cy += ((y1 + y2) * c) / 6;
  }
  cz /= A; cy /= A;
  close(cz, L.ENG_Z, 0.02, 'fan-face centre z'); close(cy, L.ENG_Y, 0.02, 'fan-face centre y');
  close(Math.abs(A), Math.PI * L.F119.rInlet ** 2, 0.08, 'fan-face section area m²');
  const mid = L.ductSection(10.4), mz = mid.reduce((a, p) => a + p[0], 0) / mid.length, my = mid.reduce((a, p) => a + p[1], 0) / mid.length;
  assert.ok(L.ductDepth(10.4, my, mz) > 0.25 && L.ductDepth(10.4, 0.0, 1.2) < 0, 'ductDepth is inside / outside where expected');
  // main-bay ceiling (with its aft taper) at least 2 cm under the duct floor
  for (let s = L.MAIN_BAY.s0; s <= L.MAIN_BAY.s1 + 1e-9; s += 0.05) {
    for (let z = 0; z <= L.MAIN_BAY.z; z += 0.01) {
      const sp = L.ductSpan(s, z);
      if (sp) assert.ok(L.bayCeilAt(s, z) < sp.lo - 0.019, `bay ceiling under the duct at s ${s.toFixed(2)}, z ${z.toFixed(2)}`);
    }
  }
  // side-bay roof and back wall 3 cm clear of the duct
  for (let s = L.SIDE_BAY.s0; s <= L.SIDE_BAY.s1 + 1e-9; s += 0.05) {
    const [a, aIn, bIn] = L.sideBaySection(s);
    for (const [p, q] of [[a, aIn], [aIn, bIn]]) {
      for (let u = 0; u <= 1.0001; u += 0.1) assert.ok(L.ductDepth(s, p[1] + (q[1] - p[1]) * u, p[0] + (q[0] - p[0]) * u) < -0.029, `side bay clear of the duct at s ${s.toFixed(2)}`);
    }
  }
  // main-gear well roof 2 cm under the duct floor across the well
  for (let s = L.MAIN_WELL.cav0; s <= L.MAIN_WELL.s1 + 1e-9; s += 0.05) {
    for (let z = L.wellInWall(s); z <= L.wellWallZ(s, -0.3); z += 0.02) { const sp = L.ductSpan(s, z); if (sp) assert.ok(L.mainWellRoof(s, z) <= sp.lo - 0.019, `well roof under the duct at s ${s.toFixed(2)}, z ${z.toFixed(2)}`); }
  }
});

test('serpentine ducts hide the fan face: no straight line through the inlet reaches it within ±30°', () => {
  // rays from points on the fan disc, every 5° of yaw and pitch, must leave the duct before reaching the lip
  const secs = [];
  for (let s = L.FAN_S - 0.01; ; s -= 0.05) {
    const p = L.ductSection(s); if (!p) break;
    const zs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
    secs.push({ d: L.FAN_S - s, zs, ys, zl: Math.min(...zs), zh: Math.max(...zs), yl: Math.min(...ys), yh: Math.max(...ys) });
  }
  assert.ok(secs.length > 100, 'duct sections from the fan face to the lip');
  const R = L.F119.rInlet, pts = [];
  for (let y = -R; y <= R; y += 0.06) for (let z = -R; z <= R; z += 0.06) if (Math.hypot(y, z) <= R) pts.push([L.ENG_Z + z, L.ENG_Y + y]);
  const inside = (sec, z, y) => {
    if (z < sec.zl || z > sec.zh || y < sec.yl || y > sec.yh) return false;
    let ins = false; const { zs, ys } = sec;
    for (let i = 0, j = zs.length - 1; i < zs.length; j = i++) if ((ys[i] > y) !== (ys[j] > y) && z < zs[i] + ((y - ys[i]) * (zs[j] - zs[i])) / (ys[j] - ys[i])) ins = !ins;
    return ins;
  };
  let seen = 0;
  for (let a = -30; a <= 30; a += 5) for (let b = -30; b <= 30; b += 5) {
    const dz = Math.tan(a * DEG), dy = Math.tan(b * DEG);
    for (const [z0, y0] of pts) if (secs.every((sec) => inside(sec, z0 - dz * sec.d, y0 - dy * sec.d))) seen++;
  }
  assert.equal(seen, 0, `${seen} fan-face rays escape the inlet`);
});

test('main gear: stub axle keeps the strut out of the tyre, and the wheel stows flat inside its well', () => {
  const g = L.GEAR.main, W = L.MAIN_WELL;
  // the strut (0.1 m outer cylinder) passes the tyre's inner face with room to spare
  assert.ok(g.stub - g.w / 2 - 0.1 > 0.04, 'strut clear of the tyre');
  close(g.axleZ, g.legZ + g.stub, 1e-9, 'wheel on its stub axle');
  // the leg keeps its length: the stowed foot (straight above the flat wheel) is reachable from the trunnion
  const T = g.trunnion, L0 = Math.hypot(g.axleS - T[0], L.GROUND + g.r - T[1], g.legZ - T[2]);
  const dS = g.stow[0] - T[0], dY = g.stow[1] + g.stub - T[1];
  assert.ok(L0 * L0 > dS * dS + dY * dY, 'stowed foot within reach of the leg');
  const zc = T[2] - Math.sqrt(L0 * L0 - dS * dS - dY * dY);
  // tyre cross-section points of the stowed wheel (lying flat, pitched nose-down by g.pitch) all in the cavity,
  // aft of the weapons bay, inside the wheel bay's opening in plan and above the closed door
  const tube = Math.min(g.w / 2, g.r * 0.32), sc = g.w / 2 / tube, c = Math.cos(g.pitch), sn = Math.sin(g.pitch);
  const sW = g.stow[0] + g.stub * sn, yW = g.stow[1];
  let worst = 9;
  for (let i = 0; i < 48; i++) for (let j = 0; j < 12; j++) {
    const u = (i / 48) * 2 * Math.PI, w = (j / 12) * 2 * Math.PI, rr = g.r - tube + tube * Math.cos(w);
    const ds = rr * Math.cos(u), dz = rr * Math.sin(u), dy = tube * Math.sin(w) * sc;   // wheel frame: axle along y
    const s = sW + ds * c - dy * sn, y = yW + dy * c + ds * sn, z = zc + dz;
    worst = Math.min(worst, L.mainWellDepth(s, y, z));
    assert.ok(s > L.MAIN_BAY.s1 + 0.03, 'stowed wheel aft of the weapons bay');
    assert.ok(z > L.wellInner(s) + 0.01 && z < L.wellOuter(s) - 0.01, 'stowed wheel inside the opening in plan');
  }
  assert.ok(worst > 0.01, `stowed tyre ${(worst * 100).toFixed(1)} cm inside the well`);
  // the wheel bay's opening is wider than the tyre's diameter where the wheel stows, as on the jet (the door is
  // about 0.95 m wide)
  assert.ok(L.wellOuter(g.stow[0]) - L.wellInner(g.stow[0]) > 2 * g.r + 0.04, 'wheel bay opening wider than the wheel');
});

test('main-bay door drive clears the missiles, closed and through the open-bay ejection', () => {
  const D = L.BAY_DRIVE, R = L.AMRAAM.r, T = L.AMRAAM.tip;
  const segPt = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1]; const u = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(p[0] - a[0] - u * dx, p[1] - a[1] - u * dy); };
  const segSeg = (a, b, c, d) => Math.min(segPt(a, c, d), segPt(b, c, d), segPt(c, a, b), segPt(d, a, b));
  const A = [D.z, D.y];
  // drive envelope at outer-door angle th (0 closed, 90° open): actuator, crank A→C, link C→D (fitting on the door)
  const drive = (s, th) => {
    const H = [L.MAIN_BAY.z, -L.bD(s)], c = Math.cos(th), sn = Math.sin(th);
    const v = [D.fit[0] * c - D.fit[1] * sn, D.fit[0] * sn + D.fit[1] * c];
    const C = [A[0] + v[0], A[1] + v[1]], F = [H[0] + v[0], H[1] + v[1]];
    return { C, F };
  };
  for (const s of D.stations) {
    // closed: the actuator sits above the closed door's inner face and the bay longeron line
    assert.ok(D.y - D.r > -L.bD(s) + L.MAIN_DOOR.thick + 0.01, `actuator above the closed door at s ${s}`);
    for (const [open, strokes] of [[0, [0]], [Math.PI / 2, [0, 0.25, 0.5, 0.75, 1]]]) {
      const { C, F } = drive(s, open);
      for (const [z, y0, t] of L.AMRAAM_SLOTS) for (const k of strokes) {
        const y = y0 - k * L.AVEL_STROKE;
        assert.ok(Math.hypot(z - A[0], y - A[1]) > R + D.r + 0.01, 'missile body clears the actuator');
        for (let f = 0; f < 4; f++) {
          const a = t + (f * Math.PI) / 2, r0 = [z + R * Math.cos(a), y + R * Math.sin(a)], r1 = [z + T * Math.cos(a), y + T * Math.sin(a)];
          assert.ok(segPt(A, r0, r1) > D.r + 0.008, `fin clears the actuator (s ${s}, stroke ${k})`);
          assert.ok(segSeg(r0, r1, A, C) > 0.012 + 0.008, `fin clears the crank (s ${s}, stroke ${k})`);
          assert.ok(segSeg(r0, r1, C, F) > 0.008 + 0.008, `fin clears the link (s ${s}, stroke ${k})`);
        }
      }
    }
  }
  // the outboard missile's ejected fins stay inboard of the drive
  for (const [z, , t] of L.AMRAAM_SLOTS) for (let f = 0; f < 4; f++) assert.ok(z + T * Math.cos(t + (f * Math.PI) / 2) < D.z - D.r - 0.01, 'fins inboard of the drive');
  // fins also clear the tapered aft ceiling, where the tail fins sit
  for (const [z, y, t] of L.AMRAAM_SLOTS) for (let f = 0; f < 4; f++) { const a = t + (f * Math.PI) / 2; assert.ok(y + T * Math.sin(a) < L.bayCeilAt(L.MAIN_BAY.s1 - 0.1, z + T * Math.cos(a)), 'tail fin under the aft ceiling'); }
});

test('one actuator per trailing-edge surface; the cockpit opening closes inside the canopy', () => {
  // Flight International (1997): two 4,000 psi systems but only one actuator on each control surface
  assert.deepEqual(Object.keys(L.TE_ACT), ['flaperon', 'aileron']);
  for (const k of ['flaperon', 'aileron']) {
    const a = L.TE_ACT[k], [z0, z1] = L.SURF[k];
    assert.ok(a.z > z0 + 0.1 && a.z < z1 - 0.1 && a.c > 0.7 && a.c < 0.9, `${k} actuator on its surface's span and behind the rear spar region`);
    assert.ok(a.c < L.SURF.hinge[k], `${k} actuator ahead of its hinge line`);
  }
  // the skin opening at the aft cockpit station ends under the canopy (no slit beside its aft end)
  const r = L.ringA(L.HOLE_S1).pts;
  for (let k = 0; k <= 5; k++) assert.ok(Math.abs(r[k][2]) <= L.sillW(L.HOLE_S1) - 0.02, `opening edge point ${k} inside the canopy sill`);
});
