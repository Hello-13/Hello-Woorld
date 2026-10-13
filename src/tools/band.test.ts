import { describe, expect, it } from 'vitest';
import { FEELS, pickString } from './BackingBand';

describe('picking patterns', () => {
  it('finds the bass, alternate bass and treble strings of a shape', () => {
    const c = [-1, 3, 2, 0, 1, 0]; // C major, A string is the bass
    expect(pickString('B', c)).toBe(1);
    expect(pickString('b', c)).toBe(2);
    expect(pickString('1', c)).toBe(5);
    expect(pickString('3', c)).toBe(3);
    const d = [-1, -1, 0, 2, 3, 2];
    expect(pickString('B', d)).toBe(2);
    expect(pickString('2', [0, 2, 2, 1, -1, -1])).toBe(3); // top strings muted: fall back to the next one down
    expect(pickString('-', c)).toBeNull();
  });

  it('every feel fills its bar', () => {
    for (const f of FEELS) expect(f.slots.length, f.id).toBe(f.beats * 2);
  });
});
