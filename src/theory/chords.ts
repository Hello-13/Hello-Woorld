import { parseDegree, spellDegrees, type Degree } from './intervals';
import { mod12, parseNoteName, pcName, spelledToString } from './notes';

export interface ChordType {
  id: string;
  /** Suffix written after the root: "", "m", "maj7", "m7b5"… (ASCII accidentals). */
  symbol: string;
  name: string;
  formula: string[];
  degrees: Degree[];
  /** Degree labels a guitarist may leave out of a voicing (usually the fifth). */
  optional: string[];
  aliases: string[];
  /** Rough rarity used to rank ambiguous chord names: lower is more common. */
  complexity: number;
  nickname?: string;
}

function chord(
  id: string,
  symbol: string,
  name: string,
  formula: string,
  complexity: number,
  aliases: string[] = [],
  optional: string[] = [],
  nickname?: string,
): ChordType {
  const parts = formula.split(' ');
  return {
    id,
    symbol,
    name,
    formula: parts,
    degrees: parts.map(parseDegree),
    optional,
    aliases: [symbol, ...aliases],
    complexity,
    nickname,
  };
}

export const CHORD_TYPES: ChordType[] = [
  chord('maj', '', 'major', '1 3 5', 0, ['M', 'maj', 'major']),
  chord('min', 'm', 'minor', '1 b3 5', 0, ['min', '-', 'mi', 'minor']),
  chord('7', '7', 'dominant 7th', '1 3 5 b7', 1, ['dom7', 'dom'], ['5']),
  chord('maj7', 'maj7', 'major 7th', '1 3 5 7', 1, ['M7', 'Δ7', 'Δ', 'ma7', 'j7'], ['5']),
  chord('m7', 'm7', 'minor 7th', '1 b3 5 b7', 1, ['min7', '-7', 'mi7'], ['5']),
  chord('5', '5', 'power chord', '1 5', 0.5, ['(no3)']),
  chord('sus2', 'sus2', 'suspended 2nd', '1 2 5', 1.2),
  chord('sus4', 'sus4', 'suspended 4th', '1 4 5', 1.1, ['sus']),
  chord('7sus4', '7sus4', 'dominant 7th sus4', '1 4 5 b7', 1.6, ['7sus'], ['5']),
  chord('dim', 'dim', 'diminished', '1 b3 b5', 1.4, ['°', 'o', 'mb5']),
  chord('dim7', 'dim7', 'diminished 7th', '1 b3 b5 bb7', 1.8, ['°7', 'o7']),
  chord('m7b5', 'm7b5', 'half-diminished', '1 b3 b5 b7', 1.6, ['ø', 'ø7', 'm7-5', 'min7b5', '-7b5']),
  chord('aug', 'aug', 'augmented', '1 3 #5', 1.6, ['+', '#5', '(#5)']),
  chord('6', '6', 'major 6th', '1 3 5 6', 1.5, ['maj6', 'M6'], ['5']),
  chord('m6', 'm6', 'minor 6th', '1 b3 5 6', 1.6, ['min6', '-6'], ['5']),
  chord('add9', 'add9', 'added 9th', '1 3 5 9', 1.5, ['add2', '(add9)']),
  chord('madd9', 'madd9', 'minor added 9th', '1 b3 5 9', 1.8, ['m(add9)', 'madd2', 'min(add9)']),
  chord('mmaj7', 'm(maj7)', 'minor-major 7th', '1 b3 5 7', 2.2, ['mmaj7', 'mM7', '-maj7', 'minmaj7', 'mMaj7'], ['5']),
  chord('9', '9', 'dominant 9th', '1 3 5 b7 9', 2, ['dom9'], ['5']),
  chord('maj9', 'maj9', 'major 9th', '1 3 5 7 9', 2.2, ['M9', 'Δ9'], ['5']),
  chord('m9', 'm9', 'minor 9th', '1 b3 5 b7 9', 2.2, ['min9', '-9'], ['5']),
  chord('6/9', '6/9', 'six-nine', '1 3 5 6 9', 2.4, ['69', '6add9'], ['5']),
  chord('7#9', '7#9', 'dominant 7th sharp 9', '1 3 5 b7 #9', 2.5, [], ['5'], 'the Hendrix chord'),
  chord('13', '13', 'dominant 13th', '1 3 5 b7 9 13', 3, ['dom13'], ['5', '9']),
];

const ALIAS_MAP = new Map<string, ChordType>();
for (const t of CHORD_TYPES) {
  for (const a of t.aliases) {
    if (!ALIAS_MAP.has(a)) ALIAS_MAP.set(a, t);
  }
}

export function getChordType(id: string): ChordType {
  const t = CHORD_TYPES.find((c) => c.id === id);
  if (!t) throw new Error(`Unknown chord type ${id}`);
  return t;
}

export interface Chord {
  /** Root as written, ASCII accidentals: "Bb". */
  root: string;
  rootPc: number;
  type: ChordType;
  /** Slash bass as written, if any. */
  bass?: string;
  bassPc?: number;
}

export function makeChord(root: string, typeId: string, bass?: string): Chord {
  const r = parseNoteName(root);
  if (!r) throw new Error(`Bad root ${root}`);
  const chordRoot = spelledToString(r);
  const b = bass ? parseNoteName(bass) : null;
  const bassName = b ? spelledToString(b) : undefined;
  return {
    root: chordRoot,
    rootPc: r.pc,
    type: getChordType(typeId),
    // A slash chord whose bass is the root is just the chord.
    ...(b && b.pc !== r.pc ? { bass: bassName, bassPc: b.pc } : {}),
  };
}

/** Parse "Am7", "F#m7b5", "C/G", "Bbmaj7", "D°7", "E7#9". Returns null for anything unrecognised. */
export function parseChordSymbol(input: string): Chord | null {
  const text = input.trim().replace(/♭/g, 'b').replace(/♯/g, '#');
  const m = /^([A-Ga-g](?:b|#)?)(.*)$/.exec(text);
  if (!m) return null;
  const rootText = m[1][0].toUpperCase() + m[1].slice(1);
  let rest = m[2];
  let bass: string | undefined;
  const slash = /\/([A-Ga-g](?:b|#)?)$/.exec(rest);
  if (slash) {
    bass = slash[1][0].toUpperCase() + slash[1].slice(1);
    rest = rest.slice(0, slash.index);
  }
  // Exact match first (so "M7" stays major and "m7" minor), then a forgiving lowercase try ("Maj7", "Sus4").
  const type = ALIAS_MAP.get(rest) ?? (rest.length > 2 ? ALIAS_MAP.get(rest.toLowerCase()) : undefined);
  if (!type) return null;
  return makeChord(rootText, type.id, bass);
}

export function chordSymbol(c: Chord): string {
  return c.root + c.type.symbol + (c.bass ? '/' + c.bass : '');
}

/** Pitch classes of the chord (root first, then formula order), plus the slash bass if it is extra. */
export function chordPcs(c: Chord): number[] {
  const pcs = c.type.degrees.map((d) => mod12(c.rootPc + d.semitones));
  if (c.bassPc !== undefined && !pcs.includes(c.bassPc)) pcs.push(c.bassPc);
  return pcs;
}

/** Pitch classes a voicing must contain. */
export function requiredPcs(c: Chord): number[] {
  const req = c.type.degrees.filter((d) => !c.type.optional.includes(d.label)).map((d) => mod12(c.rootPc + d.semitones));
  if (c.bassPc !== undefined && !req.includes(c.bassPc)) req.push(c.bassPc);
  return req;
}

export function chordNoteNames(c: Chord): string[] {
  return spellDegrees(c.root, c.type.degrees);
}

export interface ChordMatch {
  chord: Chord;
  symbol: string;
  /** Lower is a better explanation of the notes. */
  score: number;
  /** Formula degrees not present in the notes (only ever optional ones). */
  omitted: string[];
}

/**
 * Name the chord formed by a set of pitch classes. The lowest note (bass) decides inversions:
 * C-E-G-A over C is C6, the same notes over A are Am7.
 */
export function identifyChord(pcsIn: number[], bassPc?: number, preferFlats = false): ChordMatch[] {
  const pcs = [...new Set(pcsIn.map(mod12))];
  if (pcs.length < 2) return [];
  const results: ChordMatch[] = [];
  for (const rootPc of pcs) {
    for (const type of CHORD_TYPES) {
      const typePcs = type.degrees.map((d) => mod12(rootPc + d.semitones));
      if (!pcs.every((p) => typePcs.includes(p))) continue;
      const omitted: string[] = [];
      let ok = true;
      type.degrees.forEach((d, i) => {
        if (!pcs.includes(typePcs[i])) {
          if (type.optional.includes(d.label)) omitted.push(d.label);
          else ok = false;
        }
      });
      if (!ok) continue;
      const rootName = pcName(rootPc, preferFlats);
      const hasBass = bassPc !== undefined && mod12(bassPc) !== rootPc;
      const c = makeChord(rootName, type.id, hasBass ? pcName(bassPc!, preferFlats) : undefined);
      const score = type.complexity + omitted.length * 0.8 + (hasBass ? 3 : 0);
      results.push({ chord: c, symbol: chordSymbol(c), score, omitted });
    }
  }
  results.sort((a, b) => a.score - b.score || a.symbol.length - b.symbol.length);
  const seen = new Set<string>();
  return results.filter((r) => (seen.has(r.symbol) ? false : (seen.add(r.symbol), true)));
}
