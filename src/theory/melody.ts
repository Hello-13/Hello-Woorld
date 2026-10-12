import { parseMidiName } from './notes';

/**
 * Melodies written as text, one token per note:
 *   E4        a note by name and octave, one beat long
 *   F#3:0.5   the same with a length in beats
 *   6-5       string 6 (low E) at fret 5, guitar numbering (1 = high e)
 *   2-1:1.5   tab with a length
 *   r:2       a rest
 *   |         a bar line
 * Notes given by name get a fret position from `fingerMelody`, which keeps the hand still.
 */

export interface MelodyNote {
  /** null for a rest. */
  midi: number | null;
  beats: number;
  /** Start, in beats from the beginning. */
  at: number;
  bar: number;
  /** String index (0 = lowest) and fret, once fingered. */
  string?: number;
  fret?: number;
  /** Position was written as tab, so fingering leaves it alone. */
  fixed?: boolean;
}

export interface ParsedMelody {
  notes: MelodyNote[];
  errors: string[];
  totalBeats: number;
  /** Beat where each bar starts. */
  bars: number[];
}

export function parseMelody(text: string, tuning: number[]): ParsedMelody {
  const notes: MelodyNote[] = [];
  const errors: string[] = [];
  const bars = [0];
  let at = 0;
  let bar = 0;
  for (const token of text.split(/\s+/).filter(Boolean)) {
    if (token === '|') {
      if (at !== bars[bars.length - 1]) {
        bars.push(at);
        bar++;
      }
      continue;
    }
    const [head, durText] = token.split(':');
    const beats = durText === undefined ? 1 : Number(durText);
    if (!(beats > 0)) {
      errors.push(token);
      continue;
    }
    if (head === 'r') {
      notes.push({ midi: null, beats, at, bar });
    } else if (/^\d-\d+$/.test(head)) {
      const [sNum, fret] = head.split('-').map(Number);
      const s = tuning.length - sNum;
      if (s < 0 || s >= tuning.length) {
        errors.push(token);
        continue;
      }
      notes.push({ midi: tuning[s] + fret, beats, at, bar, string: s, fret, fixed: true });
    } else {
      const midi = parseMidiName(head);
      if (midi === null) {
        errors.push(token);
        continue;
      }
      notes.push({ midi, beats, at, bar });
    }
    at += beats;
  }
  return { notes, errors, totalBeats: at, bars };
}

interface Candidate {
  s: number;
  f: number;
}

function candidates(midi: number, tuning: number[], maxFret: number): Candidate[] {
  const out: Candidate[] = [];
  tuning.forEach((open, s) => {
    const f = midi - open;
    if (f >= 0 && f <= maxFret) out.push({ s, f });
  });
  return out;
}

/** Cost of a position on its own: low frets are easier, and beyond the 4th fret the hand has to move up. */
function placeCost(c: Candidate): number {
  return c.f * 0.12 + Math.max(0, c.f - 4) * 0.5;
}

/** Cost of going from one position to the next: sliding the hand hurts, crossing strings a little. */
function moveCost(a: Candidate, b: Candidate): number {
  const strings = Math.abs(a.s - b.s) * 0.15;
  if (a.f === 0 || b.f === 0) return strings;
  const shift = Math.abs(a.f - b.f);
  return strings + (shift > 3 ? shift * 0.9 : shift * 0.2);
}

/**
 * Pick a string and fret for every named note so the whole line is easy to play, using a
 * shortest-path search (Viterbi) over all the places each note could be fretted.
 */
export function fingerMelody(notes: MelodyNote[], tuning: number[], maxFret = 12): MelodyNote[] {
  const playable = notes.filter((n) => n.midi !== null);
  const options = playable.map((n) =>
    n.fixed && n.string !== undefined ? [{ s: n.string, f: n.fret! }] : candidates(n.midi!, tuning, maxFret),
  );
  if (options.some((o) => o.length === 0)) {
    // Out of range somewhere: finger what we can, note by note.
    return notes.map((n) => {
      if (n.midi === null || n.fixed) return n;
      const best = candidates(n.midi, tuning, maxFret).sort((a, b) => placeCost(a) - placeCost(b))[0];
      return best ? { ...n, string: best.s, fret: best.f } : n;
    });
  }
  const cost: number[][] = [];
  const back: number[][] = [];
  options.forEach((opts, i) => {
    cost.push([]);
    back.push([]);
    opts.forEach((c, k) => {
      if (i === 0) {
        cost[i][k] = placeCost(c);
        back[i][k] = -1;
        return;
      }
      let best = Infinity;
      let arg = 0;
      options[i - 1].forEach((p, j) => {
        const v = cost[i - 1][j] + moveCost(p, c);
        if (v < best) {
          best = v;
          arg = j;
        }
      });
      cost[i][k] = best + placeCost(c);
      back[i][k] = arg;
    });
  });
  const chosen: Candidate[] = new Array(options.length);
  if (options.length) {
    let k = cost[cost.length - 1].indexOf(Math.min(...cost[cost.length - 1]));
    for (let i = options.length - 1; i >= 0; i--) {
      chosen[i] = options[i][k];
      k = back[i][k];
    }
  }
  let i = 0;
  return notes.map((n) => {
    if (n.midi === null) return n;
    const c = chosen[i++];
    return { ...n, string: c.s, fret: c.f };
  });
}

export interface Tune {
  id: string;
  name: string;
  credit: string;
  kind: 'melody' | 'exercise';
  bpm: number;
  beatsPerBar: number;
  text: string;
}

/** Public-domain melodies and practice exercises. */
export const TUNES: Tune[] = [
  {
    id: 'ode',
    name: 'Ode to Joy',
    credit: 'Ludwig van Beethoven, Symphony No. 9 (1824)',
    kind: 'melody',
    bpm: 92,
    beatsPerBar: 4,
    text: `E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4:1.5 D4:0.5 D4:2 |
           E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:1.5 C4:0.5 C4:2`,
  },
  {
    id: 'twinkle',
    name: 'Twinkle, Twinkle, Little Star',
    credit: 'Traditional (French, 1761)',
    kind: 'melody',
    bpm: 96,
    beatsPerBar: 4,
    text: `C3 C3 G3 G3 | A3 A3 G3:2 | F3 F3 E3 E3 | D3 D3 C3:2 |
           G3 G3 F3 F3 | E3 E3 D3:2 | G3 G3 F3 F3 | E3 E3 D3:2 |
           C3 C3 G3 G3 | A3 A3 G3:2 | F3 F3 E3 E3 | D3 D3 C3:2`,
  },
  {
    id: 'frere',
    name: 'Frère Jacques',
    credit: 'Traditional (French)',
    kind: 'melody',
    bpm: 100,
    beatsPerBar: 4,
    text: `G3 A3 B3 G3 | G3 A3 B3 G3 | B3 C4 D4:2 | B3 C4 D4:2 |
           D4:0.5 E4:0.5 D4:0.5 C4:0.5 B3 G3 | D4:0.5 E4:0.5 D4:0.5 C4:0.5 B3 G3 |
           G3 D3 G3:2 | G3 D3 G3:2`,
  },
  {
    id: 'grace',
    name: 'Amazing Grace',
    credit: 'Traditional (“New Britain”, 1829)',
    kind: 'melody',
    bpm: 84,
    beatsPerBar: 3,
    text: `G3 | C4:2 E4:0.5 C4:0.5 | E4:2 D4 | C4:2 A3 | G3:2 G3 |
           C4:2 E4:0.5 C4:0.5 | E4:2 D4 | G4:3 | G4:2 E4 |
           G4:1.5 E4:0.5 G4:0.5 E4:0.5 | C4:2 G3 | A3:1.5 C4:0.5 C4:0.5 A3:0.5 | G3:2 G3 |
           C4:2 E4:0.5 C4:0.5 | E4:2 D4 | C4:3`,
  },
  {
    id: 'saints',
    name: 'When the Saints Go Marching In',
    credit: 'Traditional (American spiritual)',
    kind: 'melody',
    bpm: 112,
    beatsPerBar: 4,
    text: `r C4 E4 F4 | G4:4 | r C4 E4 F4 | G4:4 | r C4 E4 F4 | G4:2 E4:2 | C4:2 E4:2 | D4:4 |
           r E4 E4 D4 | C4:3 C4 | E4:2 G4 G4 | F4:4 | r:2 E4 F4 | G4:2 E4:2 | C4:2 D4:2 | C4:4`,
  },
  {
    id: 'spider',
    name: 'Spider walk (1-2-3-4)',
    credit: 'Finger independence warm-up',
    kind: 'exercise',
    bpm: 70,
    beatsPerBar: 4,
    text: `6-1:0.5 6-2:0.5 6-3:0.5 6-4:0.5 5-1:0.5 5-2:0.5 5-3:0.5 5-4:0.5 |
           4-1:0.5 4-2:0.5 4-3:0.5 4-4:0.5 3-1:0.5 3-2:0.5 3-3:0.5 3-4:0.5 |
           2-1:0.5 2-2:0.5 2-3:0.5 2-4:0.5 1-1:0.5 1-2:0.5 1-3:0.5 1-4:0.5 |
           1-4:0.5 1-3:0.5 1-2:0.5 1-1:0.5 2-4:0.5 2-3:0.5 2-2:0.5 2-1:0.5 |
           3-4:0.5 3-3:0.5 3-2:0.5 3-1:0.5 4-4:0.5 4-3:0.5 4-2:0.5 4-1:0.5 |
           5-4:0.5 5-3:0.5 5-2:0.5 5-1:0.5 6-4:0.5 6-3:0.5 6-2:0.5 6-1:0.5`,
  },
  {
    id: 'c-major',
    name: 'C major scale, open position',
    credit: 'Two octaves up and back',
    kind: 'exercise',
    bpm: 80,
    beatsPerBar: 4,
    text: `C3 D3 E3 F3 | G3 A3 B3 C4 | D4 E4 F4 G4 | F4 E4 D4 C4 | B3 A3 G3 F3 | E3 D3 C3:2`,
  },
  {
    id: 'em-pent',
    name: 'E minor pentatonic, open',
    credit: 'The first scale most rock players learn',
    kind: 'exercise',
    bpm: 84,
    beatsPerBar: 4,
    text: `6-0 6-3 5-0 5-2 | 4-0 4-2 3-0 3-2 | 2-0 2-3 1-0 1-3 | 1-0 2-3 2-0 3-2 | 3-0 4-2 4-0 5-2 | 5-0 6-3 6-0:2`,
  },
  {
    id: 'am-pent',
    name: 'A minor pentatonic, box 1',
    credit: 'The classic blues box at the 5th fret',
    kind: 'exercise',
    bpm: 84,
    beatsPerBar: 4,
    text: `6-5 6-8 5-5 5-7 | 4-5 4-7 3-5 3-7 | 2-5 2-8 1-5 1-8 | 1-5 2-8 2-5 3-7 | 3-5 4-7 4-5 5-7 | 5-5 6-8 6-5:2`,
  },
];

export function getTune(id: string): Tune {
  return TUNES.find((t) => t.id === id) ?? TUNES[0];
}

/** Parse and finger a tune for a tuning. */
export function prepareTune(tune: Tune, tuning: number[]): ParsedMelody {
  const parsed = parseMelody(tune.text, tuning);
  return { ...parsed, notes: fingerMelody(parsed.notes, tuning) };
}
