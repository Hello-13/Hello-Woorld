// Orbital regression tests: `npm test` (node --test).

import test from 'node:test';
import assert from 'node:assert/strict';
import { hohmann, propellantFor, solveKepler, positionOnEllipse, period, clockRelativity, clockCrossoverAlt, GEO_ALT, RE, C_LIGHT, SIDEREAL_DAY } from '../src/physics/orbital.js';
import { GPS3 } from '../src/models/gps3/data.js';

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
