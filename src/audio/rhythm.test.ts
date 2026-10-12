import { describe, expect, it } from 'vitest';
import { midiToFreq } from '../theory/notes';
import { OnsetTracker } from './onsets';
import { renderPluck } from './pluck';
import { feelWord, median, nearestOffset, steadiness, timingStats } from './rhythm';

function mixPlucks(times: number[], sr: number, length: number): Float32Array {
  const out = new Float32Array(Math.floor(length * sr));
  times.forEach((t, k) => {
    const p = renderPluck({ freq: midiToFreq(52 + (k % 5) * 2), sampleRate: sr, duration: 0.6, seed: k + 1 });
    const start = Math.round(t * sr);
    for (let i = 0; i < p.length && start + i < out.length; i++) out[start + i] += p[i] * 0.5;
  });
  return out;
}

describe('OnsetTracker', () => {
  it('timestamps plucks to within a few milliseconds', () => {
    const sr = 48000;
    const times = [0.25, 0.75, 1.27, 1.74, 2.25, 2.76];
    const audio = mixPlucks(times, sr, 3.2);
    const tracker = new OnsetTracker(sr);
    const found: number[] = [];
    for (let i = 0; i < audio.length; i += 128) found.push(...tracker.process(audio.subarray(i, i + 128), 10 + i / sr));
    expect(found).toHaveLength(times.length);
    found.forEach((f, k) => expect(Math.abs(f - 10 - times[k]) * 1000).toBeLessThan(4));
  });

  it('stays quiet on silence and steady noise', () => {
    const sr = 44100;
    const tracker = new OnsetTracker(sr);
    const quiet = new Float32Array(sr).map((_, i) => 0.004 * Math.sin(i));
    expect(tracker.process(quiet, 0)).toEqual([]);
  });

  it('survives being turned into worklet source text', () => {
    const Rebuilt = new Function(`return ${OnsetTracker.toString()}`)() as typeof OnsetTracker;
    const t = new Rebuilt(48000);
    const audio = mixPlucks([0.2], 48000, 0.5);
    expect(t.process(audio, 0)).toHaveLength(1);
  });
});

describe('timing maths', () => {
  it('finds the nearest beat and ignores stray hits', () => {
    const grid = [1, 1.5, 2, 2.5];
    expect(nearestOffset(1.52, grid, 0.5)).toBeCloseTo(0.02);
    expect(nearestOffset(1.98, grid, 0.5)).toBeCloseTo(-0.02);
    expect(nearestOffset(3.2, grid, 0.5)).toBeNull();
  });

  it('summarises offsets', () => {
    const s = timingStats([-10, -12, -8, -10]);
    expect(s.meanMs).toBeCloseTo(-10);
    expect(s.spreadMs).toBeCloseTo(Math.sqrt(2));
    expect(steadiness(s.spreadMs)).toBe('Rock solid');
    expect(feelWord(s.meanMs)).toBe('rushing by 10 ms');
    expect(feelWord(20)).toBe('dragging by 20 ms');
    expect(feelWord(3)).toBe('right on the beat');
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});
