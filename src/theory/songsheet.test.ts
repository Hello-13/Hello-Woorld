import { describe, expect, it } from 'vitest';
import { chordSymbol, parseChordSymbol } from './chords';
import { capoOptions, chordLine, parseSheet, SAMPLE_SHEET, sheetChords, transposeSheet } from './songsheet';
import { STANDARD } from './tunings';

describe('song sheets', () => {
  it('recognises chord lines and leaves lyrics alone', () => {
    expect(chordLine('G    D/F#   Em7  C')?.map((t) => t.text)).toEqual(['G', 'D/F#', 'Em7', 'C']);
    expect(chordLine('| Am  F | C  G |')?.filter((t) => t.chord).length).toBe(4);
    expect(chordLine('A long time ago')).toBeNull();
    expect(chordLine('Am I wrong')).toBeNull();
  });

  it('pairs a chord line with the lyric below it', () => {
    const s = parseSheet('Verse 1:\nG         C\nHello there, friend\n\nEm   D\n');
    expect(s.lines[0]).toEqual({ kind: 'section', text: 'Verse 1' });
    expect(s.lines[1]).toMatchObject({ kind: 'pair', lyric: 'Hello there, friend' });
    const pair = s.lines[1] as { chords: { col: number; text: string }[] };
    expect(pair.chords.map((c) => [c.col, c.text])).toEqual([
      [0, 'G'],
      [10, 'C'],
    ]);
    expect(s.lines[3]).toMatchObject({ kind: 'pair', lyric: '' });
  });

  it('reads ChordPro, including titles and section tags', () => {
    const s = parseSheet(SAMPLE_SHEET);
    expect(s.title).toBe('Amazing Grace');
    expect(s.lines[0]).toEqual({ kind: 'section', text: 'Verse 1' });
    const first = s.lines[1];
    expect(first.kind).toBe('pair');
    if (first.kind === 'pair') {
      expect(first.lyric).toBe('Amazing grace, how sweet the sound');
      expect(first.chords.map((c) => [c.col, c.text])).toEqual([
        [0, 'G'],
        [19, 'C'],
        [29, 'G'],
      ]);
    }
    expect(sheetChords(s).map(chordSymbol)).toEqual(['G', 'C', 'D', 'Em']);
  });

  it('keeps chords apart when they land on the same syllable', () => {
    const s = parseSheet('re[D]li[G7]eved');
    const l = s.lines[0];
    if (l.kind !== 'pair') throw new Error('expected a pair');
    expect(l.chords[1].col).toBeGreaterThan(l.chords[0].col + l.chords[0].text.length);
  });

  it('transposes without collisions', () => {
    const s = transposeSheet(parseSheet('G C D\nla la la'), 3, true);
    const l = s.lines[0];
    if (l.kind !== 'pair') throw new Error('expected a pair');
    expect(l.chords.map((c) => c.text)).toEqual(['Bb', 'Eb', 'F']);
    for (let i = 1; i < l.chords.length; i++) expect(l.chords[i].col).toBeGreaterThan(l.chords[i - 1].col + l.chords[i - 1].text.length - 1);
  });

  it('suggests a capo that turns awkward keys into open shapes', () => {
    const chords = ['Eb', 'Ab', 'Bb', 'Cm'].map((c) => parseChordSymbol(c)!);
    const best = capoOptions(chords, STANDARD.strings)[0];
    expect([1, 3]).toContain(best.capo);
    const open = capoOptions(['G', 'C', 'D', 'Em'].map((c) => parseChordSymbol(c)!), STANDARD.strings)[0];
    expect(open.capo).toBe(0);
  });
});
