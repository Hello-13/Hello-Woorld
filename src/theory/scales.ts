import { parseDegree, spellDegrees, type Degree } from './intervals';
import { mod12 } from './notes';

export interface ScaleType {
  id: string;
  name: string;
  formula: string[];
  /** One line on where the sound shows up. */
  mood: string;
  degrees: Degree[];
}

function scale(id: string, name: string, formula: string, mood: string): ScaleType {
  const parts = formula.split(' ');
  return { id, name, formula: parts, mood, degrees: parts.map(parseDegree) };
}

export const SCALES: ScaleType[] = [
  scale('major', 'Major (Ionian)', '1 2 3 4 5 6 7', 'Bright and settled. Most pop melodies live here.'),
  scale('minor', 'Natural minor (Aeolian)', '1 2 b3 4 5 b6 b7', 'Darker and wistful. The relative minor of the major scale.'),
  scale('minor-pentatonic', 'Minor pentatonic', '1 b3 4 5 b7', 'The rock and blues soloing box. Hard to hit a wrong note.'),
  scale('major-pentatonic', 'Major pentatonic', '1 2 3 5 6', 'Sweet and open: country licks and folk melodies.'),
  scale('blues', 'Blues', '1 b3 4 b5 5 b7', 'Minor pentatonic plus the flat-five "blue note".'),
  scale('major-blues', 'Major blues', '1 2 b3 3 5 6', 'Major pentatonic with a bluesy minor third to slide from.'),
  scale('dorian', 'Dorian', '1 2 b3 4 5 6 b7', 'Minor with a bright sixth. Think "Oye Como Va" and Santana.'),
  scale('mixolydian', 'Mixolydian', '1 2 3 4 5 6 b7', 'Major with a flat seventh. Classic rock and jam-band grooves.'),
  scale('lydian', 'Lydian', '1 2 3 #4 5 6 7', 'Major with a raised fourth. Dreamy, film-score floating.'),
  scale('phrygian', 'Phrygian', '1 b2 b3 4 5 b6 b7', 'Minor with a flat second. Flamenco and metal menace.'),
  scale('locrian', 'Locrian', '1 b2 b3 4 b5 b6 b7', 'The unstable one, built on the diminished chord.'),
  scale('harmonic-minor', 'Harmonic minor', '1 2 b3 4 5 b6 7', 'Minor with a raised seventh. Neo-classical shred.'),
  scale('melodic-minor', 'Melodic minor', '1 2 b3 4 5 6 7', 'Jazz minor: smooth rising lines over minor chords.'),
  scale('phrygian-dominant', 'Phrygian dominant', '1 b2 3 4 5 b6 b7', 'Fifth mode of harmonic minor. Middle-Eastern and surf.'),
  scale('whole-tone', 'Whole tone', '1 2 3 #4 #5 b7', 'All whole steps. The dream-sequence shimmer.'),
];

export function getScale(id: string): ScaleType {
  const s = SCALES.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scale ${id}`);
  return s;
}

export function scalePcs(rootPc: number, scaleType: ScaleType): number[] {
  return scaleType.degrees.map((d) => mod12(rootPc + d.semitones));
}

/**
 * Note names for a scale, one letter per degree number, so F major has B♭ (not A♯)
 * and the A blues scale has E♭ for its flat five.
 */
export function spellScale(rootName: string, scaleType: ScaleType): string[] {
  return spellDegrees(rootName, scaleType.degrees);
}
