// The open-sky look's maths (src/engine/skymath.js): the scattering model that draws the sky and
// the aerial perspective, the cloud field's tiling, the quality tiers, the noise generators and
// the contrail threshold. Pure maths, no three.js: `node --test tests/sky.test.mjs`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { ATM, airmass, inscatter, skyRadiance, WRAP, TILES, DRIFT_WRAP, SKY_TIERS, contrailFactor, tileableFbm, tileableWorley } from '../src/engine/skymath.js';

const SUN = { x: 0.449, y: 0.681, z: 0.579 };          // the open-sky look's sun, 43° up
const ZENITH = { x: 0, y: 1, z: 0 };
const HORIZON = { x: -0.61, y: 0.03, z: -0.79 };
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

test('airmass: 1 at the zenith, about 38 at the horizon, never infinite below it', () => {
  assert.ok(Math.abs(airmass(1) - 1) < 0.01);
  const h = airmass(0);
  assert.ok(h > 30 && h < 45, `horizon airmass ${h}`);
  assert.ok(Number.isFinite(airmass(-0.2)) && airmass(-0.2) < 60);
});

test('the sky darkens with altitude and stays blue at the zenith', () => {
  const z0 = skyRadiance(ZENITH, SUN, 0), z11 = skyRadiance(ZENITH, SUN, 11000), z18 = skyRadiance(ZENITH, SUN, 18000);
  assert.ok(lum(z11) < lum(z0) * 0.5 && lum(z18) < lum(z11) * 0.7, 'zenith luminance falls with altitude');
  for (const z of [z0, z11, z18]) assert.ok(z[2] > z[1] && z[1] > z[0], 'blue > green > red at the zenith');
  // roughly a quarter of the air is above 11 km: the zenith is a few times darker than at sea level
  assert.ok(lum(z11) / lum(z0) > 0.2 && lum(z11) / lum(z0) < 0.5);
});

test('the horizon band is brighter and whiter than the zenith at cruise', () => {
  const z = skyRadiance(ZENITH, SUN, 11000), h = skyRadiance(HORIZON, SUN, 11000);
  assert.ok(lum(h) > lum(z) * 4, `horizon ${lum(h)} vs zenith ${lum(z)}`);
  assert.ok(h[0] / h[2] > z[0] / z[2] * 1.5, 'the horizon is less saturated than the zenith');
  assert.ok(h[2] < 1.0, 'the horizon band does not blow out');
});

test('the aureole: brighter close to the sun, falling off with angle, no negative or NaN values', () => {
  const near = (deg) => { const a = deg * Math.PI / 180, u = { x: -0.579, y: 0, z: 0.449 }; return { x: SUN.x * Math.cos(a) + u.x * Math.sin(a), y: SUN.y * Math.cos(a), z: SUN.z * Math.cos(a) + u.z * Math.sin(a) }; };
  const l1 = lum(skyRadiance(near(1), SUN, 11000)), l5 = lum(skyRadiance(near(5), SUN, 11000)), l25 = lum(skyRadiance(near(25), SUN, 11000));
  assert.ok(l1 > l5 && l5 > l25, `aureole ${l1} ${l5} ${l25}`);
  for (const dir of [ZENITH, HORIZON, near(0.1), { x: 0, y: -1, z: 0 }]) {
    for (const v of skyRadiance(dir, SUN, 11000)) assert.ok(Number.isFinite(v) && v >= 0);
  }
});

test('aerial perspective: a near path barely veils, the horizon path dissolves', () => {
  const down = inscatter({ x: 0, y: -1, z: 0 }, SUN, 11000, { tEnd: 3000 });
  assert.ok(down.transm[2] > 0.95 && lum(down.light) < 0.06, 'the deck 3 km below keeps its contrast');
  const far = inscatter({ x: 0.7, y: -0.03, z: 0.71 }, SUN, 11000, { tEnd: 190000 });
  assert.ok(far.transm[2] < 0.3 && lum(far.light) > 0.3, 'the deck at the horizon is mostly haze');
  // the deck at the horizon lands on the sky just above it (no visible seam)
  const sky = skyRadiance({ x: 0.7, y: 0.005, z: 0.71 }, SUN, 11000);
  const deck = far.light.map((v, i) => v + 1.3 * far.transm[i]);
  assert.ok(Math.abs(lum(deck) - lum(sky)) / lum(sky) < 0.4, `seam: deck ${lum(deck)} sky ${lum(sky)}`);
});

test('the sun colour scales the sky', () => {
  const white = skyRadiance(HORIZON, SUN, 11000, [1, 1, 1]), warm = skyRadiance(HORIZON, SUN, 11000, [1, 0.9, 0.8]);
  assert.ok(Math.abs(warm[0] - white[0]) < 1e-9 && warm[2] < white[2] * 0.9);
});

test('every noise tile and drift period divides the scroll wrap, so the wrap never pops', () => {
  for (const [k, t] of Object.entries(TILES)) assert.equal(WRAP % t, 0, `${k} = ${t}`);
  for (const [k, p] of Object.entries(DRIFT_WRAP)) assert.equal(WRAP % p, 0, `drift ${k} = ${p}`);
  // the drift offsets are applied only to tiles that divide their own wrap period
  assert.equal(DRIFT_WRAP.mid % TILES.fine, 0);
  assert.equal(DRIFT_WRAP.mid % TILES.detail, 0);
});

test('quality tiers: the budget falls monotonically and the low presets never ray-march', () => {
  const order = ['4k', 'ultra', 'high', 'balanced', 'performance'];
  const cost = (t) => t.relief * 2 + t.shadow * 2 + t.detail * 3 + t.cirrus * 4 + t.groundShadow * 2;
  for (let i = 1; i < order.length; i++) assert.ok(cost(SKY_TIERS[order[i]]) <= cost(SKY_TIERS[order[i - 1]]), `${order[i]} costs more than ${order[i - 1]}`);
  assert.equal(SKY_TIERS.balanced.relief, 0);
  assert.equal(SKY_TIERS.performance.relief, 0);
  assert.equal(SKY_TIERS.performance.shadow, 0);
  assert.ok(SKY_TIERS['4k'].relief <= 8 && SKY_TIERS['4k'].shadow <= 4, 'within the shader loop bounds');
});

test('contrails form above about 8 km and need the engine running', () => {
  assert.equal(contrailFactor(3000), 0);
  assert.equal(contrailFactor(6000), 0);
  assert.ok(contrailFactor(8600) > 0.3 && contrailFactor(8600) < 0.7);
  assert.equal(contrailFactor(11000), 1);
  assert.equal(contrailFactor(11000, { running: 0 }), 0);
});

test('the noise generators tile, fill 0..1 and the Worley channel is domed cells', () => {
  const n = 64;
  const f = tileableFbm(n, { seed: 21, octaves: 4, base: 3, gain: 0.55 });
  const w = tileableWorley(n, { seed: 5, cells: 4 });
  for (const arr of [f, w]) {
    let lo = 1, hi = 0, sum = 0;
    for (const v of arr) { lo = Math.min(lo, v); hi = Math.max(hi, v); sum += v; }
    assert.ok(lo >= 0 && hi <= 1 && hi - lo > 0.99, 'normalised to the full range');
    assert.ok(sum / arr.length > 0.3 && sum / arr.length < 0.7, 'balanced about the middle');
  }
  // tileable: the field is continuous across the wrap (neighbours across the edge differ by less than across a step inside)
  let edge = 0, inside = 0;
  for (let y = 0; y < n; y++) { edge += Math.abs(f[y * n] - f[y * n + n - 1]); inside += Math.abs(f[y * n + 1] - f[y * n + 2]); }
  assert.ok(edge < inside * 2.5, `seam ${edge} vs ${inside}`);
  // Worley: every cell has a peak near 1 and walls near 0 (the 16 cells cover a 64² tile)
  let peaks = 0;
  for (let i = 0; i < w.length; i++) if (w[i] > 0.9) peaks++;
  assert.ok(peaks >= 16 && peaks < w.length * 0.2, `peaks ${peaks}`);
});

test('ATM constants are physical', () => {
  assert.ok(ATM.betaR[2] > ATM.betaR[1] && ATM.betaR[1] > ATM.betaR[0], 'Rayleigh scattering rises toward blue');
  assert.ok(ATM.HR > ATM.HM, 'aerosol sits lower than the air');
  assert.ok(ATM.g > 0.7 && ATM.g < 0.95, 'forward-peaked Mie');
});

// ------------------------------------------------------------------ the volumetric sky's atmosphere
import { ATM2, inscatter2, skyRadiance2, sunTransmittance } from '../src/engine/skymath.js';

const lum2 = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const sunAt2 = (deg, az = 0.4) => { const e = deg * Math.PI / 180; return { x: Math.cos(e) * Math.cos(az), y: Math.sin(e), z: Math.cos(e) * Math.sin(az) }; };

test('second atmosphere: blue zenith that deepens with altitude, a bright pale horizon', () => {
  const sun = sunAt2(40);
  let last = Infinity;
  for (const alt of [0, 3000, 9000, 18000]) {
    const z = skyRadiance2({ x: 0, y: 1, z: 0 }, sun, alt);
    assert.ok(z[2] > z[1] && z[1] > z[0], `zenith is blue at ${alt} m`);
    assert.ok(lum2(z) < last, `zenith darkens by ${alt} m`);
    last = lum2(z);
    const h = skyRadiance2({ x: -0.9998, y: 0.02, z: 0 }, sun, alt);
    assert.ok(lum2(h) > 4 * lum2(z), `the horizon band outshines the zenith at ${alt} m`);
    assert.ok(h.every((v) => Number.isFinite(v) && v > 0 && v < 3));
  }
  const z0 = skyRadiance2({ x: 0, y: 1, z: 0 }, sun, 0);
  assert.ok(lum2(z0) > 0.06 && lum2(z0) < 0.25, `sea-level zenith luminance ${lum2(z0).toFixed(3)}`);
});

test('second atmosphere: aerial perspective grows with distance and conserves energy', () => {
  const sun = sunAt2(40), d = { x: -0.9903, y: -0.139, z: 0 };
  const near = inscatter2(d, sun, 9000, { tEnd: 2000 }), far = inscatter2(d, sun, 9000, { tEnd: 60000 });
  assert.ok(near.transm.every((t) => t > 0.97), 'two kilometres of thin air barely veil');
  assert.ok(far.transm[2] < far.transm[1] && far.transm[1] < far.transm[0], 'blue is scattered out first');
  assert.ok(lum2(far.light) > 10 * lum2(near.light));
  assert.ok(far.transm.every((t) => t > 0 && t < 1));
});

test('the sun reddens and dims toward the horizon, less so at altitude', () => {
  const high = sunTransmittance(Math.sin(60 * Math.PI / 180), 0), low = sunTransmittance(Math.sin(5 * Math.PI / 180), 0);
  assert.ok(high[0] > 0.9 && high[2] > 0.6, 'a high sun is nearly white');
  assert.ok(low[0] > low[1] && low[1] > low[2], 'a low sun is red over green over blue');
  assert.ok(low[2] < 0.15 && low[0] > 0.4);
  const lowUp = sunTransmittance(Math.sin(5 * Math.PI / 180), 12000);
  assert.ok(lowUp.every((v, i) => v > low[i]), 'less air above a high aircraft');
});

test('ATM2: standard coefficients', () => {
  assert.ok(ATM2.betaR[2] > ATM2.betaR[1] && ATM2.betaR[1] > ATM2.betaR[0], 'Rayleigh scattering rises toward the blue');
  assert.ok(Math.abs(ATM2.betaR[1] / ATM2.betaR[0] - Math.pow(680 / 550, 4)) < 0.25, 'about the fourth power of the wavelength ratio');
  assert.ok(ATM2.betaMe > ATM2.betaMs, 'aerosol absorbs a little');
  assert.equal(ATM2.R, 6371000);
});
