// Atmosphere regression tests: `npm test` (node --test).

import test from 'node:test';
import assert from 'node:assert/strict';
import { isa, recoveryTemperature } from '../src/physics/atmosphere.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b} ± ${tol}, got ${a}`);

test('ISA matches the 1976 Standard Atmosphere tables', () => {
  const sl = isa(0);
  close(sl.T, 288.15, 1e-9);
  close(sl.p, 101325, 1e-6);
  close(sl.rho, 1.225, 1e-3);
  close(sl.a, 340.29, 0.01);
  close(isa(11000).p, 22700, 20, 'p @ 11 km');
  close(isa(20000).T, 216.65, 0.01, 'T @ 20 km (isothermal layer)');
  close(isa(20000).rho, 0.08891, 2e-4, 'rho @ 20 km');
  close(isa(50000).p, 79.78, 0.5, 'p @ 50 km');
  assert.ok(isa(120000).rho < 1e-6, 'thermosphere density is negligible');
});

test('recovery temperature rises with Mach²', () => {
  close(recoveryTemperature(216.65, 2.0, 1), 216.65 * 1.8, 1e-9);
});
