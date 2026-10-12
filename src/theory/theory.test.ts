import { describe, expect, it } from 'vitest';
import { chordNoteNames, chordPcs, chordSymbol, CHORD_TYPES, identifyChord, makeChord, parseChordSymbol } from './chords';
import { INTERVALS, intervalBetween, parseDegree } from './intervals';
import { diatonicChords, parseProgression, parseRoman, PROGRESSIONS, resolveRoman } from './keys';
import { freqToMidi, midiName, midiToFreq, parseMidiName, parseNoteName, pretty } from './notes';
import { getScale, SCALES, scalePcs, spellScale } from './scales';
import { getTuning, STANDARD, TUNINGS, tuningLabel } from './tunings';
import { CANONICAL_SHAPES, fingerFrets, generateVoicings, parseShape, shapeString, voicingMidi } from './voicings';

describe('notes', () => {
  it('converts between MIDI and frequency', () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 6);
    expect(midiToFreq(40)).toBeCloseTo(82.407, 2); // low E
    expect(freqToMidi(110)).toBeCloseTo(45, 6);
    expect(midiToFreq(69, 432)).toBeCloseTo(432, 6);
  });

  it('names and parses notes', () => {
    expect(midiName(40)).toBe('E2');
    expect(midiName(61, true)).toBe('Db4');
    expect(parseMidiName('E2')).toBe(40);
    expect(parseMidiName('Bb3')).toBe(58);
    expect(parseMidiName('Cb4')).toBe(59);
    expect(parseMidiName('B#3')).toBe(60);
    expect(parseNoteName('f#')).toMatchObject({ letter: 3, acc: 1, pc: 6 });
    expect(parseNoteName('E♭')).toMatchObject({ pc: 3 });
    expect(parseNoteName('H')).toBeNull();
  });

  it('prettifies accidentals for display', () => {
    expect(pretty('Bb7')).toBe('B♭7');
    expect(pretty('F#m7b5')).toBe('F♯m7♭5');
    expect(pretty('b3')).toBe('♭3');
    expect(pretty('E7#9')).toBe('E7♯9');
    expect(pretty('Am')).toBe('Am');
  });
});

describe('intervals', () => {
  it('has thirteen intervals with mnemonics', () => {
    expect(INTERVALS).toHaveLength(13);
    expect(INTERVALS.every((i) => i.song.length > 0)).toBe(true);
    expect(intervalBetween(60, 67).short).toBe('P5');
    expect(intervalBetween(67, 60).short).toBe('P5');
    expect(intervalBetween(60, 72).short).toBe('P8');
  });

  it('parses degrees', () => {
    expect(parseDegree('b3').semitones).toBe(3);
    expect(parseDegree('#9').semitones).toBe(15);
    expect(parseDegree('bb7').semitones).toBe(9);
    expect(parseDegree('13').semitones).toBe(21);
    expect(() => parseDegree('x')).toThrow();
  });
});

describe('scales', () => {
  it('spells seven-note scales with one letter per degree', () => {
    expect(spellScale('F', getScale('major'))).toEqual(['F', 'G', 'A', 'Bb', 'C', 'D', 'E']);
    expect(spellScale('Eb', getScale('minor'))).toEqual(['Eb', 'F', 'Gb', 'Ab', 'Bb', 'Cb', 'Db']);
    expect(spellScale('A', getScale('harmonic-minor'))).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G#']);
    expect(spellScale('F#', getScale('major'))).toEqual(['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#']);
  });

  it('spells pentatonic and blues scales sensibly', () => {
    expect(spellScale('A', getScale('minor-pentatonic'))).toEqual(['A', 'C', 'D', 'E', 'G']);
    expect(spellScale('A', getScale('blues'))).toEqual(['A', 'C', 'D', 'Eb', 'E', 'G']);
    expect(spellScale('G', getScale('major-pentatonic'))).toEqual(['G', 'A', 'B', 'D', 'E']);
  });

  it('builds every scale without throwing and keeps the root first', () => {
    for (const s of SCALES) {
      const pcs = scalePcs(4, s);
      expect(pcs[0]).toBe(4);
      expect(new Set(pcs).size).toBe(pcs.length);
      expect(spellScale('E', s)).toHaveLength(pcs.length);
    }
  });
});

describe('chords', () => {
  it('parses chord symbols', () => {
    expect(chordSymbol(parseChordSymbol('Am7')!)).toBe('Am7');
    expect(parseChordSymbol('Bbmaj7')!.rootPc).toBe(10);
    expect(parseChordSymbol('F#m7b5')!.type.id).toBe('m7b5');
    expect(parseChordSymbol('F♯ø')!.type.id).toBe('m7b5');
    expect(parseChordSymbol('C/G')).toMatchObject({ root: 'C', bass: 'G', bassPc: 7 });
    expect(parseChordSymbol('C6/9')!.type.id).toBe('6/9');
    expect(parseChordSymbol('CM7')!.type.id).toBe('maj7');
    expect(parseChordSymbol('Cm7')!.type.id).toBe('m7');
    expect(parseChordSymbol('Cmaj7')!.type.id).toBe('maj7');
    expect(parseChordSymbol('CMaj7')!.type.id).toBe('maj7');
    expect(parseChordSymbol('Dsus')!.type.id).toBe('sus4');
    expect(parseChordSymbol('E7#9')!.type.nickname).toBe('the Hendrix chord');
    expect(parseChordSymbol('am')!.root).toBe('A');
    expect(parseChordSymbol('Xm')).toBeNull();
    expect(parseChordSymbol('Cblah')).toBeNull();
  });

  it('round-trips every chord type symbol', () => {
    for (const t of CHORD_TYPES) {
      const c = parseChordSymbol('D' + t.symbol);
      expect(c, t.id).not.toBeNull();
      expect(c!.type.id).toBe(t.id);
    }
  });

  it('spells chord tones', () => {
    expect(chordNoteNames(makeChord('C', 'maj'))).toEqual(['C', 'E', 'G']);
    expect(chordNoteNames(makeChord('Bb', '7'))).toEqual(['Bb', 'D', 'F', 'Ab']);
    expect(chordNoteNames(makeChord('B', 'dim7'))).toEqual(['B', 'D', 'F', 'Ab']);
    expect(chordNoteNames(makeChord('E', '7#9'))).toEqual(['E', 'G#', 'B', 'D', 'F##']);
  });

  it('identifies chords from notes, using the bass for inversions', () => {
    expect(identifyChord([0, 4, 7], 0)[0].symbol).toBe('C');
    expect(identifyChord([9, 0, 4], 9)[0].symbol).toBe('Am');
    expect(identifyChord([4, 7, 0], 4)[0].symbol).toBe('C/E');
    expect(identifyChord([0, 4, 7, 9], 0)[0].symbol).toBe('C6');
    expect(identifyChord([0, 4, 7, 9], 9)[0].symbol).toBe('Am7');
    expect(identifyChord([7, 11, 2, 5], 7)[0].symbol).toBe('G7');
    expect(identifyChord([7, 11, 5], 7)[0].symbol).toBe('G7'); // no fifth
    expect(identifyChord([4, 11], 4)[0].symbol).toBe('E5');
    expect(identifyChord([0, 2, 7], 0)[0].symbol).toBe('Csus2');
    expect(identifyChord([0])).toEqual([]);
  });

  it('includes a slash bass in the chord notes', () => {
    const c = parseChordSymbol('D/F#')!;
    expect(chordPcs(c)).toEqual([2, 6, 9]);
    const g = parseChordSymbol('C/B')!;
    expect(chordPcs(g)).toContain(11);
  });
});

describe('keys and progressions', () => {
  it('parses roman numerals', () => {
    expect(parseRoman('vi')).toMatchObject({ degree: 6, acc: 0, typeId: 'min' });
    expect(parseRoman('bVII')).toMatchObject({ degree: 7, acc: -1, typeId: 'maj' });
    expect(parseRoman('V7')).toMatchObject({ typeId: '7' });
    expect(parseRoman('ii7')).toMatchObject({ typeId: 'm7' });
    expect(parseRoman('vii°')).toMatchObject({ typeId: 'dim' });
    expect(parseRoman('viiø7')).toMatchObject({ typeId: 'm7b5' });
    expect(parseRoman('Imaj7')).toMatchObject({ typeId: 'maj7' });
    expect(parseRoman('C')).toBeNull();
  });

  it('resolves numerals with correct spelling', () => {
    expect(chordSymbol(resolveRoman('F', parseRoman('IV')!))).toBe('Bb');
    expect(chordSymbol(resolveRoman('E', parseRoman('bVII')!))).toBe('D');
    expect(chordSymbol(resolveRoman('A', parseRoman('bVI')!))).toBe('F');
    expect(chordSymbol(resolveRoman('G', parseRoman('vi')!))).toBe('Em');
  });

  it('lists diatonic chords', () => {
    expect(diatonicChords('C', 'major').map((d) => chordSymbol(d.chord))).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']);
    expect(diatonicChords('A', 'minor').map((d) => chordSymbol(d.chord))).toEqual(['Am', 'Bdim', 'C', 'Dm', 'Em', 'F', 'G']);
    expect(diatonicChords('G', 'major', true).map((d) => chordSymbol(d.chord))).toEqual([
      'Gmaj7',
      'Am7',
      'Bm7',
      'Cmaj7',
      'D7',
      'Em7',
      'F#m7b5',
    ]);
  });

  it('parses mixed progressions', () => {
    const p = parseProgression('I V vi IV', 'G');
    expect(p.chords.map(chordSymbol)).toEqual(['G', 'D', 'Em', 'C']);
    const q = parseProgression('Am | F, C G7 nope', 'C');
    expect(q.chords.map(chordSymbol)).toEqual(['Am', 'F', 'C', 'G7']);
    expect(q.errors).toEqual(['nope']);
  });

  it('every preset parses in every key', () => {
    for (const preset of PROGRESSIONS) {
      for (const key of ['C', 'G', 'F', 'Bb', 'E', 'A']) {
        const p = parseProgression(preset.bars, key);
        expect(p.errors, preset.id).toEqual([]);
        expect(p.chords.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('tunings', () => {
  it('defines tunings low to high', () => {
    expect(STANDARD.strings).toEqual([40, 45, 50, 55, 59, 64]);
    expect(tuningLabel(getTuning('half-down'))).toBe('Eb Ab Db Gb Bb Eb');
    expect(tuningLabel(getTuning('dadgad'))).toBe('D A D G A D');
    for (const t of TUNINGS) {
      expect(t.strings).toHaveLength(6);
      for (let i = 1; i < 6; i++) expect(t.strings[i]).toBeGreaterThan(t.strings[i - 1]);
    }
  });
});

describe('voicings', () => {
  const std = STANDARD.strings;

  it('fingers classic shapes the way teachers do', () => {
    expect(fingerFrets(parseShape('x32010'))!.fingers).toEqual([0, 3, 2, 0, 1, 0]);
    expect(fingerFrets(parseShape('x02210'))!.fingers).toEqual([0, 0, 2, 3, 1, 0]);
    expect(fingerFrets(parseShape('xx0232'))!.fingers).toEqual([0, 0, 0, 1, 3, 2]);
    const f = fingerFrets(parseShape('133211'))!;
    expect(f.barres).toEqual([{ fret: 1, from: 0, to: 5, finger: 1 }]);
    expect(f.fingers).toEqual([1, 3, 4, 2, 1, 1]);
    expect(f.count).toBe(4);
  });

  it('uses a second barre when one is not enough', () => {
    // C9: index on the D string, middle on the A string, ring barring the top three strings.
    const c9 = fingerFrets(parseShape('x32333'))!;
    expect(c9.count).toBe(3);
    expect(c9.barres).toEqual([{ fret: 3, from: 3, to: 5, finger: 3 }]);
    // Bm with the A-shape: index barre plus a three-string ring-finger barre would also work,
    // but one barre and three fingers is the textbook way.
    expect(fingerFrets(parseShape('x24432'))!.barres).toHaveLength(1);
  });

  it('rejects shapes a hand cannot make', () => {
    expect(fingerFrets(parseShape('123456'))).toBeNull();
    expect(fingerFrets(parseShape('103211'))).toBeNull(); // open string under the barre
  });

  it('round-trips shape strings', () => {
    expect(shapeString(parseShape('x32010'))).toBe('x32010');
    expect(parseShape('x-10-12-12-11-x')).toEqual([-1, 10, 12, 12, 11, -1]);
    expect(shapeString([-1, 10, 12, 12, 11, -1])).toBe('x-10-12-12-11-x');
  });

  it('puts the open shapes first for common chords', () => {
    const top = (sym: string) => shapeString(generateVoicings(parseChordSymbol(sym)!, std)[0].frets);
    expect(top('C')).toBe('x32010');
    expect(top('G')).toBe('320003');
    expect(top('D')).toBe('xx0232');
    expect(top('Em')).toBe('022000');
    expect(top('F')).toBe('133211');
    expect(top('Bb')).toBe('x13331');
    expect(top('B5')).toBe('x244xx');
    expect(top('E5')).toBe('022xxx');
  });

  it('finds playable shapes for uncommon chords without a hand-picked shape', () => {
    for (const sym of ['Abm7', 'C#9', 'Ebmaj7', 'F#dim7', 'Bb6/9', 'G7#9', 'Dbaug', 'Am(maj7)']) {
      const chord = parseChordSymbol(sym)!;
      const vs = generateVoicings(chord, std);
      expect(vs.length, sym).toBeGreaterThan(0);
      for (const v of vs) {
        const midi = voicingMidi(v.frets, std);
        expect(midi[0] % 12, `${sym} ${shapeString(v.frets)} bass`).toBe(chord.rootPc);
        expect(v.count).toBeLessThanOrEqual(4);
        expect(v.maxFret - v.minFret).toBeLessThanOrEqual(3);
      }
    }
  });

  it('every voicing contains exactly chord tones', () => {
    const chord = parseChordSymbol('A7')!;
    const allowed = new Set(chordPcs(chord));
    for (const v of generateVoicings(chord, std, { limit: 20 })) {
      for (const m of voicingMidi(v.frets, std)) expect(allowed.has(m % 12)).toBe(true);
    }
  });

  it('respects slash-chord basses', () => {
    const c = parseChordSymbol('D/F#')!;
    const v = generateVoicings(c, std)[0];
    expect(voicingMidi(v.frets, std)[0] % 12).toBe(6);
  });

  it('works in open tunings', () => {
    // Open G strummed on all six strings has D in the bass, so the root-position open shape skips the 6th string.
    const vs = generateVoicings(parseChordSymbol('G')!, getTuning('open-g').strings);
    expect(shapeString(vs[0].frets)).toBe('x00000');
    const inversions = generateVoicings(parseChordSymbol('G')!, getTuning('open-g').strings, { allowInversions: true });
    expect(inversions.map((v) => shapeString(v.frets))).toContain('000000');
  });

  it('hand-picked shapes are actually the chords they claim', () => {
    for (const [sym, shapes] of Object.entries(CANONICAL_SHAPES)) {
      const chord = parseChordSymbol(sym)!;
      expect(chord, sym).not.toBeNull();
      const v = generateVoicings(chord, std, { limit: 20 });
      for (const shape of shapes) {
        const found = v.find((x) => shapeString(x.frets) === shape);
        expect(found, `${sym} ${shape}`).toBeDefined();
        expect(found!.canonical).toBe(true);
      }
    }
  });
});
