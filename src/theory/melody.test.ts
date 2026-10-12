import { describe, expect, it } from 'vitest';
import { fingerMelody, parseMelody, prepareTune, TUNES } from './melody';
import { STANDARD } from './tunings';

const std = STANDARD.strings;

describe('melody parsing', () => {
  it('reads names, tab, rests, lengths and bars', () => {
    const m = parseMelody('E4 F#3:0.5 | 6-5:2 r 1-0', std);
    expect(m.errors).toEqual([]);
    expect(m.notes.map((n) => n.midi)).toEqual([64, 54, 45, null, 64]);
    expect(m.notes.map((n) => n.at)).toEqual([0, 1, 1.5, 3.5, 4.5]);
    expect(m.notes[2]).toMatchObject({ string: 0, fret: 5, fixed: true, bar: 1 });
    expect(m.bars).toEqual([0, 1.5]);
    expect(m.totalBeats).toBe(5.5);
  });

  it('reports what it cannot read', () => {
    expect(parseMelody('E4 H2 7-1 C4:0 C4:x', std).errors).toEqual(['H2', '7-1', 'C4:0', 'C4:x']);
  });
});

describe('fingering', () => {
  it('plays an open-position melody in open position', () => {
    const notes = fingerMelody(parseMelody('E4 D4 C4 B3 A3 G3', std).notes, std);
    expect(notes.map((n) => `${6 - n.string!}-${n.fret}`)).toEqual(['1-0', '2-3', '2-1', '2-0', '3-2', '3-0']);
  });

  it('keeps tab positions exactly as written', () => {
    const notes = fingerMelody(parseMelody('6-5 5-7 D4', std).notes, std);
    expect(notes[0]).toMatchObject({ string: 0, fret: 5 });
    expect(notes[1]).toMatchObject({ string: 1, fret: 7 });
  });

  it('stays in one hand position rather than jumping around', () => {
    // A minor pentatonic up high: should stay near the 5th fret, not drop to open strings and back.
    const notes = fingerMelody(parseMelody('A3 C4 D4 E4 G4 A4', std).notes, std);
    const frets = notes.map((n) => n.fret!);
    expect(Math.max(...frets) - Math.min(...frets)).toBeLessThanOrEqual(5);
  });

  it('every bundled tune parses cleanly and is playable in standard tuning', () => {
    for (const t of TUNES) {
      const p = prepareTune(t, std);
      expect(p.errors, t.id).toEqual([]);
      for (const n of p.notes) {
        if (n.midi === null) continue;
        expect(n.string, `${t.id} ${n.midi}`).toBeDefined();
        expect(std[n.string!] + n.fret!).toBe(n.midi);
        expect(n.fret!).toBeLessThanOrEqual(12);
      }
      // Bars add up to the time signature (pickup and final bars may be short).
      const lens = p.bars.map((b, i) => (p.bars[i + 1] ?? p.totalBeats) - b);
      for (const len of lens.slice(1, -1)) expect(len, t.id).toBe(t.beatsPerBar);
    }
  });
});
