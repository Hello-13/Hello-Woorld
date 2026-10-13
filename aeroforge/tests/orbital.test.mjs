// Orbital regression tests: `npm test` (node --test).

import test from 'node:test';
import assert from 'node:assert/strict';
import { hohmann, propellantFor, solveKepler, positionOnEllipse, GEO_ALT } from '../src/physics/orbital.js';

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
