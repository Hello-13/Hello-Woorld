import { describe, expect, it } from 'vitest';
import { midiToFreq } from '../theory/notes';
import { detectPitch, PitchSmoother } from './pitch';
import { makeRandom, naturalT60, renderPluck } from './pluck';

const cents = (a: number, b: number) => 1200 * Math.log2(a / b);

function tone(freq: number, sr: number, n: number, harmonics = [1], noise = 0, seed = 1): Float32Array {
  const rand = makeRandom(seed);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = 0;
    harmonics.forEach((amp, h) => (v += amp * Math.sin((2 * Math.PI * freq * (h + 1) * i) / sr)));
    out[i] = 0.3 * v + noise * (rand() * 2 - 1);
  }
  return out;
}

describe('YIN pitch detection', () => {
  for (const sr of [44100, 48000]) {
    for (const f of [65.41, 82.41, 110, 146.83, 196, 246.94, 329.63, 440, 659.26, 1046.5]) {
      it(`finds ${f} Hz in a pure tone at ${sr} Hz`, () => {
        const r = detectPitch(tone(f, sr, 4096), sr);
        expect(r).not.toBeNull();
        expect(Math.abs(cents(r!.freq, f))).toBeLessThan(2);
        expect(r!.clarity).toBeGreaterThan(0.9);
      });
    }
  }

  it('is not fooled by a weak fundamental with strong harmonics', () => {
    // Low E with a quiet fundamental and loud 2nd/3rd harmonics, like a real wound string.
    const f = 82.41;
    const r = detectPitch(tone(f, 48000, 4096, [0.3, 1, 0.8, 0.5, 0.3]), 48000);
    expect(Math.abs(cents(r!.freq, f))).toBeLessThan(3);
  });

  it('copes with background noise', () => {
    const f = 196;
    const r = detectPitch(tone(f, 48000, 4096, [1, 0.5, 0.25], 0.05), 48000);
    expect(Math.abs(cents(r!.freq, f))).toBeLessThan(5);
  });

  it('returns null for silence and for noise', () => {
    expect(detectPitch(new Float32Array(4096), 48000)).toBeNull();
    const rand = makeRandom(7);
    const noise = new Float32Array(4096).map(() => rand() * 2 - 1);
    const r = detectPitch(noise, 48000);
    expect(r === null || r.clarity < 0.7).toBe(true);
  });
});

describe('Karplus–Strong pluck', () => {
  it('renders in tune across the fretboard', () => {
    const sr = 48000;
    for (const midi of [40, 45, 50, 55, 59, 64, 69, 76, 84]) {
      const f = midiToFreq(midi);
      const audio = renderPluck({ freq: f, sampleRate: sr, duration: 0.6 });
      const window = audio.slice(Math.floor(sr * 0.15), Math.floor(sr * 0.15) + 4096);
      const r = detectPitch(window, sr);
      expect(r, `midi ${midi}`).not.toBeNull();
      expect(Math.abs(cents(r!.freq, f)), `midi ${midi}`).toBeLessThan(4);
    }
  });

  it('decays: louder at the start than a second later', () => {
    const sr = 44100;
    const a = renderPluck({ freq: 196, sampleRate: sr, duration: 1.5 });
    const level = (from: number) => {
      let s = 0;
      for (let i = from; i < from + 2048; i++) s += a[i] * a[i];
      return Math.sqrt(s / 2048);
    };
    expect(level(Math.floor(sr * 1.2))).toBeLessThan(level(Math.floor(sr * 0.05)) * 0.6);
  });

  it('palm-muted notes die almost immediately', () => {
    const sr = 44100;
    const a = renderPluck({ freq: 110, sampleRate: sr, duration: 0.5, muted: true });
    let tail = 0;
    for (let i = Math.floor(sr * 0.3); i < Math.floor(sr * 0.3) + 1024; i++) tail = Math.max(tail, Math.abs(a[i]));
    expect(tail).toBeLessThan(0.01);
  });

  it('is deterministic for a given seed and stays within range', () => {
    const a = renderPluck({ freq: 220, sampleRate: 22050, duration: 0.3, seed: 3 });
    const b = renderPluck({ freq: 220, sampleRate: 22050, duration: 0.3, seed: 3 });
    expect(a).toEqual(b);
    expect(Math.max(...a.map(Math.abs))).toBeLessThanOrEqual(1);
  });

  it('low strings ring longer than high ones', () => {
    expect(naturalT60(82)).toBeGreaterThan(naturalT60(660));
  });
});

describe('PitchSmoother', () => {
  it('takes the median and resets on a new note', () => {
    const s = new PitchSmoother(5);
    s.push(440, 0);
    s.push(441, 10);
    s.push(900, 20); // octave glitch: treated as a new note
    expect(s.push(900, 30)).toBeCloseTo(900, 0);
    const t = new PitchSmoother(5);
    [440, 441, 439, 470, 440].forEach((f, i) => t.push(f, i * 10));
    expect(t.push(440, 60)).toBeCloseTo(440, 0);
  });

  it('holds briefly through silence, then lets go', () => {
    const s = new PitchSmoother(3, 300);
    s.push(220, 0);
    expect(s.push(null, 100)).toBeCloseTo(220, 0);
    expect(s.push(null, 500)).toBeNull();
  });
});
