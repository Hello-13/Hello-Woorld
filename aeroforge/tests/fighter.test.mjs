// Fighter regression tests: `npm test` (node --test).

import test from 'node:test';
import assert from 'node:assert/strict';
import { flightState, psSweep, liftSlope } from '../src/physics/aero.js';


test('fighter aerodynamics give plausible numbers', () => {
  const cruise = flightState({ altitude: 9000, mach: 0.9, alpha: 4, throttle: 0.8 });
  assert.ok(cruise.n > 0.8 && cruise.n < 1.4, `≈1 g at 4° AoA, got ${cruise.n}`);
  assert.ok(cruise.ps > 0, 'positive excess power at military thrust');
  const stall = flightState({ altitude: 3000, mach: 0.4, alpha: 28, throttle: 1 });
  assert.ok(stall.stalled);
  assert.ok(liftSlope(2.0) < liftSlope(0.5), 'supersonic lift slope is lower');
  const ab = psSweep({ altitude: 12000, throttle: 1 }).filter((p) => p.ps > 0);
  const vmax = ab[ab.length - 1].mach;
  assert.ok(vmax > 2.0 && vmax < 2.45, `max level Mach with afterburner ≈ 2.25, got ${vmax}`);
  const dry = psSweep({ altitude: 12000, throttle: 0.8 }).filter((p) => p.ps > 0);
  assert.ok(dry[dry.length - 1].mach > 1.2, 'supercruise on dry thrust');
});
