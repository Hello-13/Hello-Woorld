// Telescope optics and Hubble orbit regression tests: `node --test tests/optics.test.mjs`.
// Reference values: Rayleigh criterion, NASA's published Hubble optics (f/24, 57.6 m, mirrors
// 4.906 m apart, focus 1.5 m behind the primary, design conic −1.0023 vs −1.0139 as polished,
// edge 2.2 µm too flat), and two-body orbit relations.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARCSEC_PER_RAD, rayleighArcsec, airyFwhmArcsec, seeingAt, deliveredArcsec, collectingArea, lightGrasp, magnitudeGain,
  plateScale, airyDiskDiameter, linearResolution, diffractionLimit, conicSag, cassegrain, hubbleDesign, conicError,
  orbitAt, thermosphereDensity, decayRate, decayHistory, HST_OTA,
} from '../src/physics/optics.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b} ± ${tol}, got ${a}`);

test('diffraction limit matches the textbook 1.22 λ / D', () => {
  close(ARCSEC_PER_RAD, 206264.806, 1e-3, 'arc-seconds per radian');
  close(rayleighArcsec(500, 2.4), 0.0524, 0.0005, 'Hubble at 500 nm');
  close(rayleighArcsec(121.6, 2.4), 0.0127, 0.0002, 'Lyman-α');
  close(rayleighArcsec(1600, 2.4), 0.168, 0.002, 'H band');
  close(rayleighArcsec(2000, 6.5), 0.0774, 0.001, 'JWST at 2 µm');
  close(rayleighArcsec(550, 0.007), 19.8, 0.1, 'naked eye ≈ 20″ (≈ 1/3 arc-minute)');
  assert.ok(airyFwhmArcsec(500, 2.4) < rayleighArcsec(500, 2.4), 'FWHM is narrower than the first-null radius');
  // the limit scales linearly with λ and inversely with D
  close(rayleighArcsec(1000, 2.4) / rayleighArcsec(500, 2.4), 2, 1e-12);
  close(rayleighArcsec(500, 4.8) / rayleighArcsec(500, 2.4), 0.5, 1e-12);
});

test('seeing follows λ^(−1/5) and dominates big ground telescopes', () => {
  close(seeingAt(500, 0.8), 0.8, 1e-12);
  close(seeingAt(2200, 0.8), 0.8 * (2200 / 500) ** -0.2, 1e-12);
  assert.ok(seeingAt(2200, 0.8) < seeingAt(500, 0.8), 'seeing improves toward the infrared');
  const keck = deliveredArcsec(500, 10, 0.8);
  assert.ok(keck > 0.79 && keck < 0.81, `a 10 m telescope through 0.8″ seeing delivers ≈ 0.8″, got ${keck}`);
  assert.ok(seeingAt(500, 0.8) / rayleighArcsec(500, 2.4) > 15, 'Hubble ≈ 15× sharper than 0.8″ seeing at 500 nm');
});

test('light-gathering power scales as D² and the obscuration costs 11 %', () => {
  close(collectingArea(2.4), Math.PI * 1.44, 1e-12, 'unobstructed 2.4 m');
  close(collectingArea(2.4, 0.33) / collectingArea(2.4), 1 - 0.33 ** 2, 1e-12);
  close(collectingArea(2.4, 0.33), 4.03, 0.01, 'Hubble ≈ 4.0 m²');
  close(lightGrasp(2.4, 0.007), 117551, 1, 'Hubble vs a 7 mm pupil');
  close(magnitudeGain(2.4, 0.007), 12.68, 0.01);
  close(magnitudeGain(10, 1), 5, 1e-12, 'ten times the aperture = five magnitudes');
});

test('plate scale, Airy disk and linear resolution', () => {
  close(plateScale(57.6), 3.581, 0.001, '″ per mm at Hubble\'s focus');
  close(plateScale(57.6) * 1000 * 57.6, ARCSEC_PER_RAD, 1e-6, '206265 / f');
  close(airyDiskDiameter(500e-9, 24) * 1e6, 29.28, 0.01, 'Airy disk at f/24, µm');
  // the Moon at 384,400 km: ≈ 98 m at 500 nm
  close(linearResolution(384400e3, diffractionLimit(500e-9, 2.4)), 97.7, 0.5, 'Moon, m');
});

test('Hubble two-mirror design reproduces the published geometry', () => {
  const d = hubbleDesign();
  close(d.f1, 5.52, 1e-9, 'primary focal length (R/2)');
  close(d.m, 57.6 / 5.52, 1e-9, 'secondary magnification');
  close(d.b, 1.5, 0.01, 'focus 1.5 m behind the primary vertex');
  close(d.N, 24, 1e-12, 'f/24');
  close(d.K1, -1.0023, 0.0001, 'design primary conic');
  close(d.K2, -1.4969, 0.001, 'design secondary conic (≈ −1.496)');
  close(d.k * HST_OTA.D, 0.267, 0.001, 'beam footprint on the 0.3 m secondary');
  // a classical Cassegrain sanity check: with the focus at the primary vertex (b = 0)
  const c = cassegrain({ f1: 1, F: 4, d: 0.8 });   // d = m f1 / (1 + m)
  close(c.b, 0, 1e-12);
});

test('conic sag and the 1990 mirror flaw', () => {
  close(conicSag(1.2, 11.04, -1), 1.44 / 22.08, 1e-12, 'a paraboloid\'s sag is exactly r² / 2R');
  close(conicSag(1.2, 11.04, 0), 11.04 - Math.sqrt(11.04 ** 2 - 1.44), 1e-12, 'sphere');
  const err = conicError(1.2, 11.04, hubbleDesign().K1, HST_OTA.K1asBuilt);
  close(err * 1e6, 2.2, 0.1, 'edge of the primary 2.2 µm too flat');
  close(conicError(0, 11.04, -1.0023, -1.0139), 0, 1e-15, 'no error at the vertex');
});

test('orbit relations at Hubble\'s altitude', () => {
  const o = orbitAt(540);
  close(o.T / 60, 95.4, 0.1, 'period at 540 km, min');
  close(o.v, 7.59, 0.01, 'speed, km/s');
  close(o.perDay, 15.09, 0.02, 'orbits per day');
  close(o.eclipse / 60, 35.6, 0.2, 'longest shadow, min (NASA: ≈ 36 of 97 min)');
  close(o.sunlit + o.eclipse, o.T, 1e-9);
  assert.ok(orbitAt(612).T > orbitAt(500).T, 'higher orbits are slower');
});

test('thermosphere and drag decay behave physically', () => {
  close(thermosphereDensity(500), 6.967e-13, 1e-16, 'tabulated base density at 500 km');
  assert.ok(thermosphereDensity(450) > thermosphereDensity(500), 'density falls with height');
  close(thermosphereDensity(500, 3) / thermosphereDensity(500, 1), 3, 1e-12, 'activity scales density');
  const r500 = decayRate(500), r600 = decayRate(600);
  assert.ok(r500 < 0 && r600 < 0, 'drag always lowers the orbit');
  assert.ok(Math.abs(r500) > Math.abs(r600) * 3, 'decay is several times faster at 500 km than at 600 km');
  assert.ok(Math.abs(r500) > 3 && Math.abs(r500) < 40, `≈ 10 km/yr at 500 km for average activity, got ${r500}`);
  const quiet = decayHistory(500, 2026, { activity: 0.35 });
  const busy = decayHistory(500, 2026, { activity: 2.5 });
  assert.ok(busy.reentry && (!quiet.reentry || busy.reentry < quiet.reentry), 'solar maximum brings re-entry sooner');
  for (let i = 1; i < busy.points.length; i++) assert.ok(busy.points[i].y <= busy.points[i - 1].y + 1e-9, 'altitude never rises');
});
