import { describe, expect, it } from 'vitest';
import { OnsetDetector } from './mic';
import { Transport } from './scheduler';

function fakeClock() {
  let t = 0;
  return { now: () => t, advance: (dt: number) => (t += dt) };
}
const noTimer = () => () => {};

describe('Transport', () => {
  it('schedules steps on an exact grid ahead of time', () => {
    const clock = fakeClock();
    const tr = new Transport(clock, { bpm: 120, stepsPerBeat: 2, lookahead: 0.1 });
    const steps: [number, number][] = [];
    tr.onStep = (s, t) => steps.push([s, t]);
    tr.start(0.05, noTimer);
    for (let i = 0; i < 100; i++) {
      clock.advance(0.025);
      tr.pump();
    }
    // 120 bpm eighths = 0.25 s apart, starting at 0.05 s.
    expect(steps.length).toBeGreaterThan(8);
    steps.forEach(([s, t], i) => {
      expect(s).toBe(i);
      expect(t).toBeCloseTo(0.05 + i * 0.25, 9);
    });
    // Never scheduled further ahead than the lookahead window.
    expect(steps[steps.length - 1][1]).toBeLessThan(clock.now() + 0.1 + 1e-9);
  });

  it('follows tempo changes from the next unscheduled step', () => {
    const clock = fakeClock();
    const tr = new Transport(clock, { bpm: 60, stepsPerBeat: 1, lookahead: 0.1 });
    const times: number[] = [];
    tr.onStep = (_, t) => times.push(t);
    tr.start(0, noTimer);
    clock.advance(1.0);
    tr.pump(); // steps at 0 and 1; step 2 is already pinned to t = 2
    tr.bpm = 120;
    clock.advance(1.6);
    tr.pump();
    expect(times.slice(0, 4)).toEqual([0, 1, 2, 2.5]);
  });

  it('swings the off-beats', () => {
    const clock = fakeClock();
    const tr = new Transport(clock, { bpm: 60, stepsPerBeat: 2, lookahead: 0.01, swing: 0.33 });
    const times: number[] = [];
    tr.onStep = (_, t) => times.push(t);
    tr.start(0, noTimer);
    clock.advance(1.2);
    tr.pump();
    expect(times[0]).toBeCloseTo(0);
    expect(times[1]).toBeCloseTo(0.5 + 0.33 * 0.5);
    expect(times[2]).toBeCloseTo(1.0);
  });

  it('reports the step that is sounding now', () => {
    const clock = fakeClock();
    const tr = new Transport(clock, { bpm: 60, stepsPerBeat: 1, lookahead: 0.5 });
    tr.start(0, noTimer);
    clock.advance(1.2);
    tr.pump();
    expect(tr.stepAt(1.1)?.step).toBe(1);
    expect(tr.stepAt(-1)).toBeNull();
    tr.stop();
    expect(tr.running).toBe(false);
    expect(tr.stepAt(1.1)).toBeNull();
  });
});

describe('OnsetDetector', () => {
  it('counts each strum once', () => {
    const d = new OnsetDetector();
    // Two strums 500 ms apart, each a sharp rise then a slow decay, sampled every 20 ms.
    let onsets = 0;
    for (let ms = 0; ms < 1000; ms += 20) {
      const sinceStrum = ms % 500;
      const level = sinceStrum < 20 ? 0.002 : 0.3 * Math.exp(-(sinceStrum - 20) / 200);
      if (d.push(level, ms)) onsets++;
    }
    expect(onsets).toBe(2);
  });

  it('ignores quiet room noise', () => {
    const d = new OnsetDetector();
    let onsets = 0;
    for (let ms = 0; ms < 1000; ms += 20) if (d.push(0.005 + (ms % 60 === 0 ? 0.01 : 0), ms)) onsets++;
    expect(onsets).toBe(0);
  });
});
