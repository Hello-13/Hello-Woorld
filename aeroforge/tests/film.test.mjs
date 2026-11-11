// Film mode camera program (src/engine/film.js): the path is continuous in position and velocity,
// never stops, never dips under the floor or into the subject, and the loop closes seamlessly.
// Pure maths, no three.js: `node --test tests/film.test.mjs`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProgram, sampleProgram, cameraFor, pickDetails, fitDistance, drift, wrapPi, insideBox, DETAIL_SHOTS } from '../src/engine/film.js';

// A fighter-sized subject: 11 units long, nose toward +x, sitting on the floor, with three details.
const BOX = { min: [-5.5, 0.1, -3.4], max: [5.5, 2.9, 3.4] };
const CENTER = [0, 1.5, 0];
const SUBJECT = {
  id: 'fighter', box: BOX, center: CENTER, heroDir: [1.05, 0.5, 1.15], fill: 1,
  tanV: Math.tan((32 / 2) * Math.PI / 180) * 0.8, tanH: Math.tan((32 / 2) * Math.PI / 180) * 1.78 * 0.7,
  details: [
    { name: 'inlet', center: [1.2, 1.0, 1.1], radius: 0.7 },
    { name: 'canopy', center: [2.4, 2.4, 0], radius: 0.8 },
    { name: 'nozzles', center: [-5.0, 1.4, 0.6], radius: 0.6 },
  ],
  floor: true, floorY: 0, minDist: 2, maxDist: 60,
};
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const camAt = (prog, t) => cameraFor(sampleProgram(prog, t), { floor: true, floorY: 0, minDist: 2, maxDist: 60 });

test('the program has keys for the reveal, the orbit, every detail and the pull-outs', () => {
  const prog = buildProgram(SUBJECT);
  assert.equal(prog.keys.length, 12);
  assert.equal(prog.durations.length, 12);
  assert.ok(prog.total > 60 && prog.total < 200, `loop of ${prog.total}s`);
  assert.ok(Number.isInteger(prog.turns));
  // the hero key frames the whole subject at the hero distance
  const hero = prog.keys[1];
  assert.ok(Math.abs(Math.exp(hero[2]) - prog.hero.dist * 0.95) < 1e-6);
  assert.ok(prog.hero.dist > 10 && prog.hero.dist < 60, `hero distance ${prog.hero.dist}`);
});

test('position is continuous and never stops, at 60 fps over two loops', () => {
  const prog = buildProgram(SUBJECT);
  const dt = 1 / 60;
  let prev = camAt(prog, 0).position;
  let maxStep = 0, minSpeedWindow = Infinity;
  const window = [];
  for (let t = dt; t <= prog.total * 2 + 1; t += dt) {
    const p = camAt(prog, t).position;
    const step = dist(p, prev);
    maxStep = Math.max(maxStep, step);
    window.push(step);
    if (window.length > 30) window.shift();                 // half a second
    if (window.length === 30) minSpeedWindow = Math.min(minSpeedWindow, window.reduce((a, b) => a + b, 0) / 0.5);
    prev = p;
  }
  assert.ok(maxStep < 0.25, `largest frame step ${maxStep.toFixed(3)} units`);   // no cuts
  assert.ok(minSpeedWindow > 0.02, `slowest half second ${minSpeedWindow.toFixed(4)} units/s`);   // no stops
});

test('velocity is continuous across every key and the loop seam', () => {
  const prog = buildProgram(SUBJECT);
  const e = 1 / 240;
  let tk = 0;
  const times = [0];
  for (const d of prog.durations) { tk += d; times.push(tk); }
  for (const t of times) {
    const vb = dist(camAt(prog, t - e).position, camAt(prog, t - 2 * e).position) / e;
    const va = dist(camAt(prog, t + 2 * e).position, camAt(prog, t + e).position) / e;
    const ref = Math.max(va, vb, 0.05);
    assert.ok(Math.abs(va - vb) / ref < 0.2, `velocity jump at t=${t.toFixed(1)}: ${vb.toFixed(3)} → ${va.toFixed(3)}`);
  }
  // the seam: the end of the loop is the start of the next
  const a = camAt(prog, prog.total - 1e-6).position, b = camAt(prog, 1e-6).position;
  assert.ok(dist(a, b) < 1e-3, `loop seam gap ${dist(a, b)}`);
});

test('the camera stays above the floor, outside the subject and within the orbit limits', () => {
  const prog = buildProgram(SUBJECT);
  for (let t = 0; t < prog.total; t += 0.1) {
    const c = camAt(prog, t);
    assert.ok(c.position[1] >= 0.249, `below the floor at t=${t.toFixed(1)}: y=${c.position[1].toFixed(3)}`);
    assert.ok(!insideBox(c.position, BOX, 0.1), `inside the subject at t=${t.toFixed(1)}`);
    const d = dist(c.position, c.target);
    assert.ok(d >= 2 - 1e-9 && d <= 60 + 1e-9, `distance ${d} at t=${t.toFixed(1)}`);
    assert.ok(c.focusDist > 0.5, 'focus distance');
    assert.ok(c.coc >= 0 && c.coc <= 1);
  }
});

test('a subject without a floor (orbit) may be filmed from below, and still never cuts', () => {
  const prog = buildProgram({ ...SUBJECT, id: 'hubble', floor: false, center: [0, 1.5, 0] });
  let below = false, prev = cameraFor(sampleProgram(prog, 0), { floor: false }).position;
  for (let t = 0.02; t < prog.total; t += 0.02) {
    const p = cameraFor(sampleProgram(prog, t), { floor: false }).position;
    if (p[1] < 0) below = true;
    assert.ok(dist(p, prev) < 0.4);
    prev = p;
  }
  assert.ok(below, 'at least one low shot looks up from under the subject');
});

test('pickDetails resolves name patterns, picks the hero side for side details and falls back', () => {
  const part = (name, min, max) => ({ userData: { part: { name } }, box: { min, max } });
  const parts = [
    part('Caret inlet cowl (right)', [0.5, 0.6, 0.6], [1.9, 1.4, 1.6]),
    part('Caret inlet cowl (left)', [0.5, 0.6, -1.6], [1.9, 1.4, -0.6]),
    part('Canopy', [1.8, 2.0, -0.5], [3.0, 2.8, 0.5]),
    part('Nozzle divergent (vectoring) flaps (right)', [-5.4, 1.1, 0.3], [-4.6, 1.7, 0.9]),
    part('Nozzle divergent (vectoring) flaps (left)', [-5.4, 1.1, -0.9], [-4.6, 1.7, -0.3]),
    part('Wing skin (right)', [-3, 1, 0.5], [2, 1.3, 5.4]),
  ];
  const boundsOf = (p) => p.box;
  const d = pickDetails('fighter', parts, boundsOf, CENTER, [1.05, 0.5, 1.15], 6.5);
  assert.deepEqual(d.map((x) => x.name), ['inlet', 'canopy', 'nozzles']);
  assert.ok(d[0].center[2] > 0, 'the right-hand inlet, on the camera side');
  assert.ok(d[2].center[2] > 0, 'the right-hand nozzle');
  assert.ok(Math.abs(d[1].center[0] - 2.4) < 1e-9);
  // a vehicle this file knows nothing about gets nose / top / tail of its bounding sphere
  const f = pickDetails('blimp', parts, boundsOf, CENTER, [1, 0.5, 1], 6.5);
  assert.deepEqual(f.map((x) => x.name), ['nose', 'top', 'tail']);
  // every fleet vehicle has three detail shots defined
  for (const id of ['fighter', 'helicopter', 'uav', 'turbofan', 'rocket', 'satellite', 'hubble']) assert.equal(DETAIL_SHOTS[id].length, 3, id);
});

test('fitDistance puts every box corner inside the frame', () => {
  const tanV = Math.tan(16 * Math.PI / 180), tanH = tanV * 1.6;
  const dir = [1, 0.5, 1];
  const d = fitDistance(BOX, dir, CENTER, tanV, tanH);
  assert.ok(d > 8 && d < 40, `fit distance ${d}`);
  // moving the camera closer by 5 % puts a corner outside: the fit is tight
  const n = Math.hypot(...dir);
  const u = dir.map((x) => x / n);
  const cam = CENTER.map((c, i) => c + u[i] * d);
  const right = [u[2], 0, -u[0]].map((x) => x / Math.hypot(u[2], u[0]));
  const up = [u[1] * right[2] - u[2] * right[1], u[2] * right[0] - u[0] * right[2], u[0] * right[1] - u[1] * right[0]];
  let worst = 0;
  for (let i = 0; i < 8; i++) {
    const c = [i & 1 ? BOX.max[0] : BOX.min[0], i & 2 ? BOX.max[1] : BOX.min[1], i & 4 ? BOX.max[2] : BOX.min[2]].map((x, k) => x - cam[k]);
    const z = -(c[0] * u[0] + c[1] * u[1] + c[2] * u[2]);
    const x = Math.abs(c[0] * right[0] + c[1] * right[1] + c[2] * right[2]) / (z * tanH);
    const y = Math.abs(c[0] * up[0] + c[1] * up[1] + c[2] * up[2]) / (z * tanV);
    worst = Math.max(worst, x, y);
  }
  assert.ok(worst <= 1 + 1e-6 && worst > 0.97, `tightest corner at ${worst.toFixed(3)} of the frame`);
});

test('handheld drift stays under a tenth of a degree and averages to nothing', () => {
  let maxA = 0, sx = 0, sy = 0, n = 0;
  for (let t = 0; t < 600; t += 0.01) {
    const [x, y] = drift(t);
    maxA = Math.max(maxA, Math.abs(x), Math.abs(y));
    sx += x; sy += y; n++;
  }
  assert.ok(maxA < 0.1 * Math.PI / 180, `peak drift ${(maxA * 180 / Math.PI).toFixed(4)}°`);
  assert.ok(Math.abs(sx / n) < 2e-4 && Math.abs(sy / n) < 2e-4);
  assert.equal(wrapPi(3 * Math.PI), -Math.PI, 'wrapPi');
  assert.ok(Math.abs(wrapPi(0.3 + 4 * Math.PI) - 0.3) < 1e-12);
});
