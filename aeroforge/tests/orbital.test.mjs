// Orbital and GPS III regression tests: `npm test` (node --test). The model itself needs three.js, so
// its geometry is checked through the three.js-free dims.js, layout.js and display.js, and the tour
// against the part names declared in the model's sources.

import test from 'node:test';
import assert from 'node:assert/strict';
import { hohmann, propellantFor, solveKepler, positionOnEllipse, period, clockRelativity, clockCrossoverAlt, GEO_ALT, RE, C_LIGHT, SIDEREAL_DAY } from '../src/physics/orbital.js';
import { GPS3 } from '../src/models/gps3/data.js';
import { readFileSync, readdirSync } from 'node:fs';
import * as D from '../src/models/gps3/dims.js';
import * as L from '../src/models/gps3/layout.js';
import { DISPLAY, displayDir, toShow, toOrbit } from '../src/models/gps3/display.js';
import TOUR from '../src/learn/tours/satellite.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b} ± ${tol}, got ${a}`);

test('Hohmann LEO → GEO matches the textbook Δv', () => {
  const h = hohmann(300, GEO_ALT, 0);
  close(h.dvTotal, 3.89, 0.02, 'coplanar Δv km/s');
  close(h.tof / 3600, 5.27, 0.05, 'transfer time h');
  const cape = hohmann(300, GEO_ALT, 28.5);
  assert.ok(cape.dvTotal > h.dvTotal, 'plane change costs Δv');
  close(propellantFor(1, 1000, 300), 1000 * (1 - Math.exp(-1000 / (300 * 9.80665))), 1e-9);
});

test('Kepler solver converges and positions are consistent', () => {
  for (const e of [0, 0.3, 0.7, 0.95]) {
    for (const M of [0.1, 1, 2.5, 3.1]) {
      const E = solveKepler(M, e);
      close(E - e * Math.sin(E), M, 1e-10);
    }
  }
  const h = hohmann(300, GEO_ALT, 0);
  const half = positionOnEllipse(h.at, h.e, h.tof);
  close(Math.abs(half.nu), Math.PI, 1e-6, 'apoapsis after half a period');
  close(half.r, h.r2, 1e-3);
});

test('GPS orbit: 20,180 km circular is half a sidereal day', () => {
  const T = period(RE + GPS3.altitude);
  close(T, SIDEREAL_DAY / 2, 30, 'period s');            // 11 h 57 m 53 s vs 11 h 58 m 02 s
  // two-body period at the nominal 26,559.7 km semi-major axis; the last ~5 s come from Earth's oblateness (J2)
  close(period(26559.7), SIDEREAL_DAY / 2, 8, 'nominal semi-major axis 26,559.7 km');
  close(Math.sqrt(398600.4418 / (RE + GPS3.altitude)), 3.874, 0.002, 'orbital speed km/s');
});

test('GPS clock relativity matches the published correction', () => {
  const r = clockRelativity(GPS3.altitude);
  close(r.gravUs, 45.8, 0.15, 'gravitational gain µs/day');
  close(r.velUs, -7.2, 0.05, 'velocity loss µs/day');
  close(r.netUs, 38.6, 0.1, 'net µs/day');
  // IS-GPS-200: the 10.23 MHz reference is offset by Δf/f = −4.4647e−10 → 10.22999999543 MHz
  const nominal = clockRelativity(26559.7 - RE);
  close(-nominal.net, -4.4647e-10, 0.002e-10, 'fractional offset');
  close(10.23e6 * (1 - nominal.net), 10.22999999543e6, 2e-5, 'factory frequency Hz');
  close(r.netUs * 1e-6 * C_LIGHT, 11.6, 0.1, 'uncorrected range error km/day');
  // low orbits run slow, high orbits run fast, crossing near 3,170 km
  assert.ok(clockRelativity(400).netUs < -24 && clockRelativity(400).netUs > -26, 'ISS-altitude clock loses ~25 µs/day');
  close(clockCrossoverAlt(), 3167, 5, 'crossover altitude km');
  close(clockRelativity(clockCrossoverAlt()).netUs, 0, 1e-9);
});

test('GPS III propellant budget: launcher transfer orbit feasible, climbing alone from LEO is not', () => {
  // Space Force fact sheet: launch weight 8,115 lb, on-orbit weight 4,764 lb, 97 × 70 × 134 in
  const LB = 0.45359237, IN = 0.0254;
  close(GPS3.launchMass, 8115 * LB, 0.5, 'launch mass kg');
  close(GPS3.dryMass, 4764 * LB, 0.5, 'on-orbit mass kg');
  [97, 70, 134].forEach((d, i) => close(GPS3.size[i], d * IN, 0.006, 'fact-sheet size m'));
  assert.equal(GPS3.propellant, GPS3.launchMass - GPS3.dryMass);
  close(GPS3.fuelLoad + GPS3.oxLoad, GPS3.propellant, 1e-9, 'fuel + oxidiser = propellant loaded');
  const h = hohmann(GPS3.transferPerigee, GPS3.altitude, 0);
  close(h.dv2, 1.40, 0.01, 'apogee circularisation Δv km/s');
  const apogeeOnly = propellantFor(h.dv2, GPS3.launchMass, GPS3.laeIsp);
  assert.ok(apogeeOnly < GPS3.propellant, `apogee burn needs ${apogeeOnly.toFixed(0)} kg of ${GPS3.propellant}`);
  assert.ok(GPS3.propellant - apogeeOnly > 150, 'leaves a station-keeping and disposal reserve');
  const alone = propellantFor(h.dvTotal, GPS3.launchMass, GPS3.laeIsp);
  assert.ok(alone > GPS3.propellant, `both burns would need ${alone.toFixed(0)} kg`);
  // the satellite's mass after the apogee burns stays above its dry mass
  assert.ok(GPS3.launchMass - apogeeOnly > GPS3.dryMass);
});

test('GPS III bus, tanks and array follow the published figures', () => {
  // 97 × 70 × 134 in with the 97-in side along the Sun axis (X) and 70 in along the array axis (Y)
  close(D.BX, 2.46, 0.005, 'X (Sun axis) m'); close(D.BY, 1.78, 0.005, 'Y (array axis) m'); close(D.BZ, 3.40, 0.005, 'Z m');
  assert.ok(D.BX > D.BY, 'the ±Y radiator faces are the wider ones');
  // A2100 dual mode: one central hydrazine tank Ø0.90 × ≤ 2.0 m inside the core, two NTO tanks Ø0.54 × ≤ 1.65 m in the ±X bays
  close(2 * D.FUEL.r, 0.90, 0.005, 'hydrazine tank diameter');
  assert.ok(D.FUEL.L <= 2.0 + 1e-9 && D.FUEL.L >= 1.8, 'hydrazine tank length');
  assert.ok(D.FUEL.c[0] === 0 && D.FUEL.c[1] === 0 && D.FUEL.r <= D.CORE - D.T, 'hydrazine tank on the axis, inside the core box');
  assert.ok(D.FUEL.c[2] - D.FUEL.L / 2 > -D.HZ && D.FUEL.c[2] + D.FUEL.L / 2 < D.IZ, 'hydrazine tank within the box height');
  close(2 * D.OX.r, 0.54, 0.005, 'oxidiser tank diameter');
  assert.ok(D.OX.L <= 1.65 + 1e-9, 'oxidiser tank length within the A2100 maximum');
  assert.ok(D.OX.x - D.OX.r >= D.CORE && D.OX.x + D.OX.r <= D.HX - 0.06, 'oxidiser tanks outside the core, behind the recessed blanket');
  assert.ok(D.OX.r <= D.BAY - D.T, 'oxidiser tanks fit between the shear webs');
  assert.ok(D.HE.z - D.HE.r > D.OX.z + D.OX.L / 2 && D.HE.z + D.HE.r < D.IZ, 'helium tanks above the oxidiser tanks, inside the box');
  // two wings × two panels, 28.2 m² (IGS box-wing model), 15 m span; the folded wing lies within its ±Y face
  close(D.ARRAY_AREA, 28.2, 0.3, 'array area m²');
  close(D.ARRAY_SPAN, GPS3.arraySpan, 0.03 * GPS3.arraySpan, 'span m');
  assert.ok(D.PANEL_L <= D.BX + 0.01 && D.PANEL_W <= D.BZ, 'stowed panels cover, but do not overhang, the radiator face');
  assert.ok(D.YOKE_L <= D.HX + Math.abs(D.SADA_C[0]) + 0.01, 'the folded yoke ends at the face edge');
  assert.ok(D.SADA_C[1] < -0.3 && D.SADA_C[1] > -0.4, 'drive about 0.35 m below mid-height');
});

test('GPS III Earth deck layout: 4 + 8 rings, M-code tab, sunshade corner, no clashes', () => {
  const r = (p) => Math.hypot(p[0] - L.ARRAY_C[0], p[1] - L.ARRAY_C[1]);
  for (const [ring, n, rad] of [[L.EC_INNER, 4, 0.17], [L.EC_OUTER, 8, 0.54], [L.UHF_INNER, 4, 0.36], [L.UHF_OUTER, 8, 0.83]]) {
    assert.equal(ring.length, n);
    for (const p of ring) close(r(p), rad, 0.02, 'ring radius m');
  }
  assert.equal(L.MEC.length, 4);
  for (const [x] of L.MEC) assert.ok(x < -0.8, 'M-code group at the −X end of the deck');
  const [sx, sy] = L.DECK_AT.sunshade;
  assert.ok(sx < -0.3 && sy < -0.6, 'burst-detector sunshade in the −X/−Y corner (IGS axes)');
  const R = { sunshade: 0.225, xray: 0.09, esa: 0.19, hpeSensor: 0.11, hpeS: 0.06, hpeRx: 0.06, lra: 0.22, scot: 0.16, fwdMast: 0.05, mast2: 0.05 };
  const items = [...L.EC_INNER, ...L.EC_OUTER, ...L.MEC].map((p) => [p, 0.06]).concat([...L.UHF_INNER, ...L.UHF_OUTER].map((p) => [p, 0.08]), L.JIB_POS.map((p) => [p, 0.06]),
    Object.entries(L.DECK_AT).map(([k, p]) => [p, R[k]]));
  for (const [[x, y], rad] of items) assert.ok(Math.abs(x) + rad <= D.HX + 0.2 && Math.abs(y) <= D.HY, `deck item at (${x}, ${y}) sits on the 2.46 × 1.78 m deck`);
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const [[x1, y1], r1] = items[i], [[x2, y2], r2] = items[j];
    assert.ok(Math.hypot(x1 - x2, y1 - y2) >= r1 + r2 + 0.01, `deck items at (${x1}, ${y1}) and (${x2}, ${y2}) clash`);
  }
  // L-band antenna panel: every cut-out lies wholly inside the outline (a hole crossing the edge
  // extrudes filled, with side walls outside the panel), and the units in the corner cut-outs clear it
  const O = L.PANEL_OUTLINE;
  const inPoly = ([x, y]) => { let c = false; for (let i = 0, j = O.length - 1; i < O.length; j = i++) { const [xi, yi] = O[i], [xj, yj] = O[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
  const edgeDist = ([x, y]) => Math.min(...O.map(([x1, y1], i) => { const [x2, y2] = O[(i + 1) % O.length]; const dx = x2 - x1, dy = y2 - y1; const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy))); return Math.hypot(x - x1 - t * dx, y - y1 - t * dy); }));
  const ringPts = (x, y, r) => Array.from({ length: 32 }, (_, k) => [x + r * Math.cos((k / 32) * 2 * Math.PI), y + r * Math.sin((k / 32) * 2 * Math.PI)]);
  const rectPts = (x, y, w, h) => Array.from({ length: 33 }, (_, k) => k / 32).flatMap((t) => [[x - w / 2 + t * w, y - h / 2], [x - w / 2 + t * w, y + h / 2], [x - w / 2, y - h / 2 + t * h], [x + w / 2, y - h / 2 + t * h]]);
  const holePts = [...L.PANEL_HOLES.rects.map((h) => rectPts(...h)), ...L.PANEL_HOLES.circles.map((c) => ringPts(...c))];
  for (const pts of holePts) for (const p of pts) assert.ok(inPoly(p) && edgeDist(p) >= 0.005, `panel cut-out point (${p.map((v) => v.toFixed(3))}) inside the outline`);
  for (const [k, half] of [['lra', 0.203], ['hpeSensor', 0.075]]) {
    const [x, y] = L.DECK_AT[k];
    for (const p of rectPts(x, y, 2 * half, 2 * half)) assert.ok(!inPoly(p), `${k} stands in a corner cut-out, clear of the panel`);
  }
  // the panel's posts stand on the deck, under solid panel (not in a cut-out)
  for (const [x, y] of L.PANEL_POSTS) {
    assert.ok(Math.abs(x) + 0.03 <= D.HX && Math.abs(y) + 0.03 <= D.HY, `post foot at (${x}, ${y}) on the deck`);
    assert.ok(inPoly([x, y]) && edgeDist([x, y]) >= 0.014, `post at (${x}, ${y}) under the panel`);
    for (const [hx, hy, w, h] of L.PANEL_HOLES.rects) assert.ok(Math.abs(x - hx) > w / 2 + 0.014 || Math.abs(y - hy) > h / 2 + 0.014, `post at (${x}, ${y}) clear of a cut-out`);
    for (const [hx, hy, r] of L.PANEL_HOLES.circles) assert.ok(Math.hypot(x - hx, y - hy) > r + 0.014, `post at (${x}, ${y}) clear of a cut-out`);
  }
  // batteries: the connector bracket is outboard of the cells, on the pack's +Z side
  for (const x of L.BATT.xs) {
    const c = L.battConn(x);
    for (const q of [c.power, c.data]) { assert.ok(q[2] >= L.BATT.z + L.BATT.s[2] / 2, 'battery connector outboard of the cells'); assert.ok(Math.abs(q[0] - x) < L.BATT.s[0] / 2 && q[1] > -D.IY && q[1] < -D.IY + L.BATT.s[1], 'battery connector on its pack'); }
  }
});

test('GPS III display poses and guided tour', () => {
  // showroom: nadir up; orbit look: nadir down toward the Earth backdrop and toward the viewer
  assert.deepEqual(toShow([0, 0, 1]), [0, 1, 0]);
  const n = toOrbit([0, 0, 1]);
  assert.ok(n[1] < -0.6 && n[2] > 0.6, 'orbit look: nadir down and toward the default camera');
  close(Math.hypot(...toOrbit([0.3, -0.5, 0.8])), Math.hypot(0.3, -0.5, 0.8), 1e-12, 'a rotation keeps lengths');
  for (const orbit of [false, true]) {
    DISPLAY.orbit = orbit;
    for (const step of TOUR) {
      const d = step.view ? step.view.dir : null;
      if (d) { close(Math.hypot(...d), 1, 1e-9, 'unit camera direction'); assert.ok(d[1] >= 0.06 - 1e-9, 'camera stays above the horizon'); }
    }
  }
  DISPLAY.orbit = false;
  assert.ok(displayDir([0, 0, -1])[1] >= 0.06 - 1e-9, 'a direction below the floor is lifted');
  // part names declared in the model: the first argument of every part-making call, literal or templated
  const dir = new URL('../src/models/gps3/', import.meta.url);
  const src = [readFileSync(new URL('../src/models/satellite.js', import.meta.url), 'utf8'),
    ...readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => readFileSync(new URL(f, dir), 'utf8'))].join('\n');
  const firstArg = (i) => {   // scan to the first top-level comma, skipping quotes, templates and ${…}
    let q = null, depth = 0, out = '';
    for (; i < src.length; i++) {
      const c = src[i];
      if (q) { out += c; if (c === '\\') { out += src[++i]; continue; } if (q === '`' && c === '$' && src[i + 1] === '{') { depth++; } if (c === '}' && depth) depth--; else if (c === q && !depth) q = null; continue; }
      if (c === "'" || c === '`') { q = c; out += c; continue; }
      if (c === ',' || c === ')') return out;
      out += c;
    }
    return out;
  };
  const CALLS = /\b(?:P|box|nce|filt|tx|sse|torque|mast|fdv|battery|earthSensor|hinge|uhf)\(/g;
  const args = [...src.matchAll(CALLS)].map((m) => firstArg(m.index + m[0].length));
  const literals = new Set(args.flatMap((a) => [...a.replace(/`[^`]*`/g, '').matchAll(/'((?:[^'\\]|\\.)+)'/g)].map((m) => m[1].replace(/\\'/g, "'"))));
  const esc = (t) => t.replace(/[.*+?^()|[\]\\]/g, '\\$&');
  // template placeholders stand for a number, an axis tag (+Y, −X, +X−Y) or a panel position
  const SLOT = '(?:\\d+|[+−][XY](?:[+−][XY])?|inboard|outboard)';
  const templates = args.flatMap((a) => [...a.matchAll(/`([^`]*)`/g)].map((m) => new RegExp(`^${m[1].split(/\$\{[^}]+\}/).map(esc).join(SLOT)}$`)));
  assert.ok(literals.size + templates.length > 100, `found ${literals.size} literal and ${templates.length} templated part names`);
  assert.ok(TOUR.length >= 8 && TOUR.length <= 12, `${TOUR.length} tour steps`);
  const modes = new Set(['studio', 'xray', 'blueprint', 'systems', 'thermal']);
  for (const [i, step] of TOUR.entries()) {
    assert.ok(step.title && step.body && step.key, `step ${i + 1} has a title, body and key idea`);
    if (step.mode) assert.ok(modes.has(step.mode), `step ${i + 1}: mode ${step.mode}`);
    if (step.demo) assert.equal(step.demo, 'deploy', `step ${i + 1}: demo ${step.demo}`);
    for (const name of step.focus || []) assert.ok(literals.has(name) || templates.some((re) => re.test(name)), `step ${i + 1}: no part named "${name}"`);
  }
  assert.ok(TOUR.some((s) => s.demo === 'deploy'), 'the tour runs the array deployment');
});
