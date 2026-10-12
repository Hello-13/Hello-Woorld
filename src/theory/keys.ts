import { makeChord, parseChordSymbol, type Chord } from './chords';
import { mod12, parseNoteName, pcName, spellOnLetter, spelledToString } from './notes';

/** Semitones of each major-scale degree; roman numerals are measured against these. */
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const ROMANS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

const ROMAN_RE = /^(b|#|♭|♯)?(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)(.*)$/;

export interface RomanChord {
  text: string;
  degree: number; // 1–7
  acc: number; // -1, 0, +1 relative to the major scale
  typeId: string;
}

function suffixToType(suffix: string, upper: boolean): string | null {
  const s = suffix.replace(/♭/g, 'b').replace(/♯/g, '#');
  switch (s) {
    case '':
      return upper ? 'maj' : 'min';
    case '°':
    case 'o':
    case 'dim':
      return 'dim';
    case '°7':
    case 'o7':
    case 'dim7':
      return 'dim7';
    case 'ø':
    case 'ø7':
    case 'm7b5':
      return 'm7b5';
    case '+':
    case 'aug':
      return 'aug';
    case '7':
      return upper ? '7' : 'm7';
    case 'maj7':
    case 'M7':
    case 'Δ7':
    case 'Δ':
      return upper ? 'maj7' : 'mmaj7';
    case '6':
      return upper ? '6' : 'm6';
    case '9':
      return upper ? '9' : 'm9';
    case 'add9':
      return upper ? 'add9' : 'madd9';
    case 'sus':
    case 'sus4':
      return 'sus4';
    case 'sus2':
      return 'sus2';
    case '7sus4':
    case '7sus':
      return '7sus4';
    case '5':
      return '5';
    default:
      return null;
  }
}

export function parseRoman(text: string): RomanChord | null {
  const m = ROMAN_RE.exec(text.trim());
  if (!m) return null;
  const numeral = m[2];
  const upper = numeral === numeral.toUpperCase();
  const typeId = suffixToType(m[3], upper);
  if (!typeId) return null;
  const acc = m[1] ? (m[1] === 'b' || m[1] === '♭' ? -1 : 1) : 0;
  return { text: text.trim(), degree: ROMANS.indexOf(numeral.toUpperCase()) + 1, acc, typeId };
}

/** Turn a roman numeral into a chord in a key, spelled on the right letter (IV of F is B♭). */
export function resolveRoman(tonicName: string, roman: RomanChord): Chord {
  const tonic = parseNoteName(tonicName);
  if (!tonic) throw new Error(`Bad key ${tonicName}`);
  const pc = mod12(tonic.pc + MAJOR_STEPS[roman.degree - 1] + roman.acc);
  const spelled = spellOnLetter(pc, tonic.letter + roman.degree - 1);
  const rootName = spelled ? spelledToString(spelled) : pcName(pc, tonic.acc < 0);
  return makeChord(rootName, roman.typeId);
}

export type Mode = 'major' | 'minor';

const DIATONIC: Record<Mode, { triads: string[]; sevenths: string[] }> = {
  major: {
    triads: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
    sevenths: ['Imaj7', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7', 'viiø7'],
  },
  minor: {
    triads: ['i', 'ii°', 'bIII', 'iv', 'v', 'bVI', 'bVII'],
    sevenths: ['i7', 'iiø7', 'bIIImaj7', 'iv7', 'v7', 'bVImaj7', 'bVII7'],
  },
};

export interface DiatonicChord {
  roman: string;
  chord: Chord;
}

export function diatonicChords(tonicName: string, mode: Mode, sevenths = false): DiatonicChord[] {
  const list = sevenths ? DIATONIC[mode].sevenths : DIATONIC[mode].triads;
  return list.map((r) => ({ roman: r, chord: resolveRoman(tonicName, parseRoman(r)!) }));
}

export interface ProgressionPreset {
  id: string;
  name: string;
  mode: Mode;
  /** Roman numerals, one bar each. */
  bars: string;
  /** Songs built on (or close to) this progression. */
  heardIn: string;
  /** A whole traditional song rather than a loop. */
  song?: boolean;
  /** Backing Band feel and key that suit it. */
  feel?: string;
  key?: string;
}

export const PROGRESSIONS: ProgressionPreset[] = [
  { id: 'pop', name: 'Pop anthem', mode: 'major', bars: 'I V vi IV', heardIn: 'Let It Be, With or Without You, Someone Like You' },
  { id: 'doowop', name: '50s doo-wop', mode: 'major', bars: 'I vi IV V', heardIn: 'Stand by Me, Every Breath You Take' },
  { id: 'sensitive', name: 'Sensitive', mode: 'major', bars: 'vi IV I V', heardIn: 'Zombie, Despacito' },
  { id: 'garage', name: 'Three-chord garage', mode: 'major', bars: 'I IV V IV', heardIn: 'Wild Thing, La Bamba, Twist and Shout' },
  { id: 'rock', name: 'Rock with a flat seven', mode: 'major', bars: 'I bVII IV I', heardIn: 'Sweet Child o\' Mine (verse), Hey Jude (coda)' },
  {
    id: 'blues',
    name: '12-bar blues',
    mode: 'major',
    bars: 'I7 I7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7',
    heardIn: 'Johnny B. Goode, Pride and Joy, Hound Dog',
  },
  { id: 'pachelbel', name: 'Pachelbel\'s Canon', mode: 'major', bars: 'I V vi iii IV I IV V', heardIn: 'Canon in D, Graduation (Friends Forever)' },
  { id: 'jazz', name: 'Jazz ii–V–I', mode: 'major', bars: 'ii7 V7 Imaj7 Imaj7', heardIn: 'Autumn Leaves, Fly Me to the Moon' },
  { id: 'royal-road', name: 'Royal road', mode: 'major', bars: 'IVmaj7 V7 iii7 vi', heardIn: 'J-pop and anime theme songs' },
  { id: 'andalusian', name: 'Andalusian cadence', mode: 'minor', bars: 'i bVII bVI V', heardIn: 'Hit the Road Jack, Stray Cat Strut, flamenco' },
  { id: 'minor-epic', name: 'Minor epic', mode: 'minor', bars: 'i bVI bIII bVII', heardIn: 'Numb (Linkin Park)' },
  { id: 'minor-blues', name: 'Minor shuffle', mode: 'minor', bars: 'i iv i v', heardIn: 'The Thrill Is Gone (simplified)' },
  {
    id: 'rising-sun',
    name: 'House of the Rising Sun',
    mode: 'minor',
    bars: 'i bIII IV bVI i bIII V V i bIII IV bVI i V i V',
    heardIn: 'Traditional American folk song',
    song: true,
    feel: 'arp68',
    key: 'A',
  },
  {
    id: 'greensleeves',
    name: 'Greensleeves',
    mode: 'minor',
    bars: 'i bIII bVII v i bVI V V i bIII bVII v i V i i',
    heardIn: 'Traditional English ballad (16th century)',
    song: true,
    feel: 'arp68',
    key: 'A',
  },
  {
    id: 'amazing-grace',
    name: 'Amazing Grace',
    mode: 'major',
    bars: 'I I IV I I I V V I I IV I I V I I',
    heardIn: 'Traditional hymn (“New Britain”)',
    song: true,
    feel: 'waltz',
    key: 'G',
  },
  {
    id: 'saints',
    name: 'When the Saints Go Marching In',
    mode: 'major',
    bars: 'I I I I I I V V I I7 IV IV I V I I',
    heardIn: 'Traditional spiritual',
    song: true,
    feel: 'faithful',
    key: 'C',
  },
  {
    id: 'scarborough',
    name: 'Scarborough Fair',
    mode: 'minor',
    bars: 'i i bVII i bIII i IV i i bIII bVII i i bVII i i',
    heardIn: 'Traditional English ballad',
    song: true,
    feel: 'arp68',
    key: 'A',
  },
];

export interface ParsedProgression {
  chords: Chord[];
  /** Tokens that were neither chord names nor roman numerals. */
  errors: string[];
}

/** Parse "I V vi IV", "G D Em C" or a mix, separated by spaces, commas or bar lines. */
export function parseProgression(text: string, tonicName: string): ParsedProgression {
  const tokens = text
    .split(/[\s,|]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t !== '-' && t !== '–');
  const chords: Chord[] = [];
  const errors: string[] = [];
  for (const t of tokens) {
    const roman = parseRoman(t);
    if (roman) {
      chords.push(resolveRoman(tonicName, roman));
      continue;
    }
    const c = parseChordSymbol(t);
    if (c) chords.push(c);
    else errors.push(t);
  }
  return { chords, errors };
}
