import { mod12, parseNoteName, pcName, spellOnLetter, spelledToString, type SpelledNote } from './notes';

export interface IntervalInfo {
  semitones: number;
  short: string;
  name: string;
  /** A well-known tune where this interval is a memorable (ascending) leap. */
  song: string;
}

export const INTERVALS: IntervalInfo[] = [
  { semitones: 0, short: 'P1', name: 'Unison', song: 'Same note twice' },
  { semitones: 1, short: 'm2', name: 'Minor 2nd', song: 'Jaws theme' },
  { semitones: 2, short: 'M2', name: 'Major 2nd', song: 'Happy Birthday' },
  { semitones: 3, short: 'm3', name: 'Minor 3rd', song: 'Smoke on the Water' },
  { semitones: 4, short: 'M3', name: 'Major 3rd', song: 'When the Saints Go Marching In' },
  { semitones: 5, short: 'P4', name: 'Perfect 4th', song: 'Here Comes the Bride' },
  { semitones: 6, short: 'TT', name: 'Tritone', song: 'The Simpsons theme' },
  { semitones: 7, short: 'P5', name: 'Perfect 5th', song: 'Star Wars main theme' },
  { semitones: 8, short: 'm6', name: 'Minor 6th', song: 'The Entertainer' },
  { semitones: 9, short: 'M6', name: 'Major 6th', song: 'My Bonnie Lies over the Ocean' },
  { semitones: 10, short: 'm7', name: 'Minor 7th', song: 'Star Trek (original theme)' },
  { semitones: 11, short: 'M7', name: 'Major 7th', song: 'Take On Me (chorus)' },
  { semitones: 12, short: 'P8', name: 'Octave', song: 'Somewhere Over the Rainbow' },
];

/** Degree label of each semitone above a root, as used for chord tones and scale degrees. */
export const DEGREE_LABELS = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];

/** Semitones above the root for each natural degree of the major scale (and its compounds). */
const DEGREE_SEMITONES: Record<number, number> = {
  1: 0,
  2: 2,
  3: 4,
  4: 5,
  5: 7,
  6: 9,
  7: 11,
  8: 12,
  9: 14,
  10: 16,
  11: 17,
  12: 19,
  13: 21,
};

export interface Degree {
  /** Text as written, normalised to ASCII: "b3", "#11", "bb7". */
  label: string;
  /** Scale-step number: 1 for the root, 3 for any kind of third, 9 for any ninth… */
  number: number;
  acc: number;
  /** Semitones above the root (may exceed 12 for compound degrees). */
  semitones: number;
}

export function parseDegree(input: string): Degree {
  const text = input.replace(/♭/g, 'b').replace(/♯/g, '#');
  const m = /^(bb|b|##|#)?(\d+)$/.exec(text);
  if (!m) throw new Error(`Bad degree "${input}"`);
  const acc = m[1] ? (m[1].startsWith('b') ? -m[1].length : m[1].length) : 0;
  const number = Number(m[2]);
  const base = DEGREE_SEMITONES[number];
  if (base === undefined) throw new Error(`Unsupported degree "${input}"`);
  return { label: text, number, acc, semitones: base + acc };
}

/** Spell the note a given degree above a spelled root, e.g. ("Eb", "b3") → "Gb". */
export function spellDegree(root: SpelledNote, degree: Degree): string {
  const letter = (root.letter + degree.number - 1) % 7;
  const pc = mod12(root.pc + degree.semitones);
  const spelled = spellOnLetter(pc, letter);
  return spelled ? spelledToString(spelled) : pcName(pc, root.acc < 0);
}

export function spellDegrees(rootName: string, degrees: Degree[]): string[] {
  const root = parseNoteName(rootName);
  if (!root) throw new Error(`Bad root "${rootName}"`);
  return degrees.map((d) => spellDegree(root, d));
}

export function intervalBetween(a: number, b: number): IntervalInfo {
  const semis = Math.abs(b - a);
  if (semis === 0) return INTERVALS[0];
  const reduced = semis % 12 === 0 ? 12 : semis % 12;
  return INTERVALS[reduced];
}
