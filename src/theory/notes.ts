/**
 * Pitch, note-name and frequency helpers.
 *
 * Conventions used across the app:
 * - A pitch class (pc) is an integer 0–11 where C = 0.
 * - MIDI note numbers place A4 (440 Hz by default) at 69 and middle C (C4) at 60.
 * - Note names are stored in ASCII ("Eb", "F#") and prettified for display ("E♭", "F♯").
 */

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
/** Natural pitch class of each letter in LETTERS. */
export const LETTER_PC = [0, 2, 4, 5, 7, 9, 11] as const;

export const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
/** The spelling most players reach for when a root is picked from a list of twelve. */
export const COMMON_ROOT_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

export interface SpelledNote {
  /** Index into LETTERS. */
  letter: number;
  /** -2 (double flat) … +2 (double sharp). */
  acc: number;
  pc: number;
}

const ACC_RE = /^([A-Ga-g])(bb|b|##|#|x|♭♭|♭|♯♯|♯|𝄫|𝄪)?$/;

export function parseNoteName(input: string): SpelledNote | null {
  const m = ACC_RE.exec(input.trim());
  if (!m) return null;
  const letter = LETTERS.indexOf(m[1].toUpperCase() as (typeof LETTERS)[number]);
  const accText = m[2] ?? '';
  let acc = 0;
  switch (accText) {
    case 'b':
    case '♭':
      acc = -1;
      break;
    case 'bb':
    case '♭♭':
    case '𝄫':
      acc = -2;
      break;
    case '#':
    case '♯':
      acc = 1;
      break;
    case '##':
    case 'x':
    case '♯♯':
    case '𝄪':
      acc = 2;
      break;
  }
  return { letter, acc, pc: mod12(LETTER_PC[letter] + acc) };
}

export function accidentalText(acc: number): string {
  switch (acc) {
    case -2:
      return 'bb';
    case -1:
      return 'b';
    case 1:
      return '#';
    case 2:
      return '##';
    default:
      return '';
  }
}

export function spelledToString(n: SpelledNote): string {
  return LETTERS[n.letter] + accidentalText(n.acc);
}

/**
 * Spell a pitch class using a specific letter (e.g. pc 10 on letter A → "A#").
 * Returns null when the spelling would need more than a double accidental.
 */
export function spellOnLetter(pc: number, letter: number): SpelledNote | null {
  const natural = LETTER_PC[mod12(letter) % 7];
  let acc = mod12(pc - natural);
  if (acc > 6) acc -= 12;
  if (Math.abs(acc) > 2) return null;
  return { letter: letter % 7, acc, pc: mod12(pc) };
}

export function pcName(pc: number, preferFlats = false): string {
  return (preferFlats ? FLAT_NAMES : SHARP_NAMES)[mod12(pc)];
}

/** Turn ASCII accidentals into proper music glyphs for display: "Bb7" → "B♭7". */
export function pretty(name: string): string {
  return name
    .replace(/([A-G])##/g, '$1𝄪')
    .replace(/([A-G])bb/g, '$1𝄫')
    .replace(/([A-G])#/g, '$1♯')
    .replace(/([A-G])b/g, '$1♭')
    .replace(/(^|[^A-Za-z])b(\d)/g, '$1♭$2')
    .replace(/(^|[^A-Za-z])#(\d)/g, '$1♯$2');
}

/** Keys whose signatures use flats. */
const FLAT_MAJOR_TONICS = new Set([5, 10, 3, 8, 1, 6]); // F Bb Eb Ab Db Gb
const FLAT_MINOR_TONICS = new Set([2, 7, 0, 5, 10, 3]); // d g c f bb eb

export function keyPrefersFlats(tonicPc: number, minor = false): boolean {
  return (minor ? FLAT_MINOR_TONICS : FLAT_MAJOR_TONICS).has(mod12(tonicPc));
}

export function midiToFreq(midi: number, a4 = 440): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

/** Fractional MIDI number for a frequency. */
export function freqToMidi(freq: number, a4 = 440): number {
  return 69 + 12 * Math.log2(freq / a4);
}

export function midiOctave(midi: number): number {
  return Math.floor(midi / 12) - 1;
}

export function midiName(midi: number, preferFlats = false): string {
  return pcName(mod12(midi), preferFlats) + midiOctave(midi);
}

/** Parse "E2", "Bb3", "F#4" into a MIDI number. */
export function parseMidiName(input: string): number | null {
  const m = /^([A-Ga-g](?:bb|b|##|#|♭|♯)?)(-?\d)$/.exec(input.trim());
  if (!m) return null;
  const n = parseNoteName(m[1]);
  if (!n) return null;
  const octave = Number(m[2]);
  // Use the letter's natural octave so that "Cb4" is B3 and "B#3" is C4.
  return (octave + 1) * 12 + LETTER_PC[n.letter] + n.acc;
}

/** Cents between a frequency and a reference frequency. */
export function centsOff(freq: number, ref: number): number {
  return 1200 * Math.log2(freq / ref);
}
