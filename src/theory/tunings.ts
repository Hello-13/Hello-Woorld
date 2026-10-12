import { midiName, parseMidiName } from './notes';

export interface Tuning {
  id: string;
  name: string;
  /** MIDI notes from the lowest (6th) string to the highest (1st). */
  strings: number[];
  /** Name the strings with flats (E♭ A♭ D♭…) instead of sharps. */
  flats: boolean;
}

function tuning(id: string, name: string, notes: string, flats = false): Tuning {
  return {
    id,
    name,
    flats,
    strings: notes.split(' ').map((n) => {
      const m = parseMidiName(n);
      if (m === null) throw new Error(`Bad tuning note ${n}`);
      return m;
    }),
  };
}

export const TUNINGS: Tuning[] = [
  tuning('standard', 'Standard', 'E2 A2 D3 G3 B3 E4'),
  tuning('drop-d', 'Drop D', 'D2 A2 D3 G3 B3 E4'),
  tuning('half-down', 'Half step down', 'Eb2 Ab2 Db3 Gb3 Bb3 Eb4', true),
  tuning('whole-down', 'Whole step down', 'D2 G2 C3 F3 A3 D4'),
  tuning('dadgad', 'DADGAD', 'D2 A2 D3 G3 A3 D4'),
  tuning('open-g', 'Open G', 'D2 G2 D3 G3 B3 D4'),
  tuning('open-d', 'Open D', 'D2 A2 D3 F#3 A3 D4'),
  tuning('open-e', 'Open E', 'E2 B2 E3 G#3 B3 E4'),
  tuning('open-c', 'Open C', 'C2 G2 C3 G3 C4 E4'),
  tuning('drop-c', 'Drop C', 'C2 G2 C3 F3 A3 D4'),
];

export const STANDARD = TUNINGS[0];

export function getTuning(id: string): Tuning {
  return TUNINGS.find((t) => t.id === id) ?? STANDARD;
}

export function stringName(t: Tuning, index: number): string {
  return midiName(t.strings[index], t.flats).replace(/-?\d+$/, '');
}

export function tuningLabel(t: Tuning): string {
  return t.strings.map((_, i) => stringName(t, i)).join(' ');
}
