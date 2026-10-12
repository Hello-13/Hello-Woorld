import { chordPcs, chordSymbol, requiredPcs, type Chord } from './chords';
import { mod12 } from './notes';

/** -1 = muted string, 0 = open, n = fret n. Index 0 is the lowest (6th) string. */
export type Frets = number[];

export interface Barre {
  fret: number;
  /** String indices covered, inclusive (0 = lowest string). */
  from: number;
  to: number;
  finger: number;
}

export interface Fingering {
  /** Finger per string: 0 for open or muted, 1 = index … 4 = pinky. */
  fingers: number[];
  barres: Barre[];
  /** Fingers actually pressing (a barre counts once). */
  count: number;
}

export interface Voicing extends Fingering {
  frets: Frets;
  /** Lowest and highest fretted positions (0 when nothing is fretted). */
  minFret: number;
  maxFret: number;
  /** Lower is easier and fuller. */
  score: number;
  /** Shapes taken from the hand-checked open-chord list. */
  canonical: boolean;
}

interface Unit {
  fret: number;
  strings: number[];
  barre: { from: number; to: number } | null;
}

/** Barres that could press two or more same-fret notes without touching a lower fret, open or muted string. */
function barreCandidates(frets: Frets): Unit[] {
  const out: Unit[] = [];
  const fretValues = [...new Set(frets.filter((f) => f > 0))];
  for (const f of fretValues) {
    let run: number[] = [];
    const flush = () => {
      const at = run.filter((s) => frets[s] === f);
      if (at.length >= 2) out.push({ fret: f, strings: at, barre: { from: at[0], to: at[at.length - 1] } });
      run = [];
    };
    frets.forEach((x, s) => {
      if (x >= f) run.push(s);
      else flush();
    });
    flush();
  }
  return out;
}

function assignFingers(frets: Frets, units: Unit[]): Fingering {
  const fingers = frets.map(() => 0);
  const ordered = [...units].sort((a, b) => a.fret - b.fret || a.strings[0] - b.strings[0]);
  const barres: Barre[] = [];
  ordered.forEach((u, k) => {
    for (const s of u.strings) fingers[s] = k + 1;
    if (u.barre) barres.push({ fret: u.fret, from: u.barre.from, to: u.barre.to, finger: k + 1 });
  });
  return { fingers, barres, count: ordered.length };
}

/**
 * Work out which fingers press which frets, or null if a hand can't do it.
 * Up to four fretted notes get a finger each (ordered by fret, then low string to high).
 * More than that needs one or two barres (index across the neck, ring across three strings…).
 */
export function fingerFrets(frets: Frets): Fingering | null {
  const fretted = frets.map((f, i) => ({ f, i })).filter((x) => x.f > 0);
  const single = (x: { f: number; i: number }): Unit => ({ fret: x.f, strings: [x.i], barre: null });
  if (fretted.length <= 4) return assignFingers(frets, fretted.map(single));

  const lowest = Math.min(...fretted.map((x) => x.f));
  const highest = Math.max(...fretted.map((x) => x.f));
  // Only the index finger barres the lowest fret; another finger can lie flat only behind everything else.
  const candidates = barreCandidates(frets).filter((c) => c.fret === lowest || c.fret === highest);
  const combos: Unit[][] = candidates.map((c) => [c]);
  for (let a = 0; a < candidates.length; a++) {
    for (let b = a + 1; b < candidates.length; b++) {
      if (candidates[a].fret !== candidates[b].fret) combos.push([candidates[a], candidates[b]]);
    }
  }
  // Prefer fewer barres, then fewer fingers, then an index barre at the lowest fret.
  const rank = (units: Unit[], combo: Unit[]) =>
    combo.length * 10 + units.length - (combo.some((u) => u.fret === lowest) ? 0.5 : 0);
  let best: { fing: Fingering; rank: number } | null = null;
  for (const combo of combos) {
    const covered = new Set(combo.flatMap((u) => u.strings));
    const units = [...combo, ...fretted.filter((x) => !covered.has(x.i)).map(single)];
    if (units.length > 4) continue;
    const fing = assignFingers(frets, units);
    if (fing.barres.some((b) => b.fret === lowest && b.finger !== 1)) continue;
    const r = rank(units, combo);
    if (!best || r < best.rank) best = { fing, rank: r };
  }
  return best ? best.fing : null;
}

export function voicingMidi(frets: Frets, tuning: number[]): number[] {
  const out: number[] = [];
  frets.forEach((f, i) => {
    if (f >= 0) out.push(tuning[i] + f);
  });
  return out;
}

/** Hand-checked open and barre shapes in standard tuning, low E string first. */
export const CANONICAL_SHAPES: Record<string, string[]> = {
  C: ['x32010'],
  D: ['xx0232'],
  E: ['022100'],
  F: ['133211', 'xx3211'],
  G: ['320003', '320033'],
  A: ['x02220'],
  B: ['x24442'],
  Bb: ['x13331'],
  Eb: ['x68886'],
  Ab: ['466544'],
  Db: ['x46664'],
  'F#': ['244322'],
  Am: ['x02210'],
  Bm: ['x24432'],
  Cm: ['x35543'],
  Dm: ['xx0231'],
  Em: ['022000'],
  Fm: ['133111'],
  Gm: ['355333'],
  'F#m': ['244222'],
  'C#m': ['x46654'],
  'G#m': ['466444'],
  Abm: ['466444'],
  Bbm: ['x13321'],
  Ebm: ['x68876'],
  A7: ['x02020'],
  B7: ['x21202'],
  C7: ['x32310'],
  D7: ['xx0212'],
  E7: ['020100'],
  F7: ['131211'],
  G7: ['320001'],
  Amaj7: ['x02120'],
  Cmaj7: ['x32000'],
  Dmaj7: ['xx0222'],
  Emaj7: ['021100'],
  Fmaj7: ['xx3210'],
  Gmaj7: ['320002'],
  Am7: ['x02010'],
  Bm7: ['x20202'],
  Dm7: ['xx0211'],
  Em7: ['020000'],
  Asus2: ['x02200'],
  Asus4: ['x02230'],
  Dsus2: ['xx0230'],
  Dsus4: ['xx0233'],
  Esus4: ['022200'],
  Cadd9: ['x32033'],
  A5: ['x022xx'],
  E5: ['022xxx'],
};

export function parseShape(shape: string): Frets {
  // Shapes above fret 9 are written with dashes: "x-10-12-12-11-x".
  const parts = shape.includes('-') ? shape.split('-') : shape.split('');
  return parts.map((c) => (c === 'x' || c === 'X' ? -1 : Number(c)));
}

export function shapeString(frets: Frets): string {
  const big = frets.some((f) => f > 9);
  return frets.map((f) => (f < 0 ? 'x' : String(f))).join(big ? '-' : '');
}

export interface VoicingOptions {
  /** Highest fret to search (default 15). */
  maxFret?: number;
  /** Frets a hand can cover, inclusive (default 4). */
  span?: number;
  limit?: number;
  /** Allow a chord tone other than the root (or slash bass) as the lowest note. */
  allowInversions?: boolean;
}

const STANDARD_TUNING = [40, 45, 50, 55, 59, 64];

function isStandard(tuning: number[]): boolean {
  return tuning.length === 6 && tuning.every((m, i) => m === STANDARD_TUNING[i]);
}

function scoreVoicing(frets: Frets, fing: Fingering, chord: Chord, tuning: number[], allowInversions: boolean): number | null {
  const sounding = frets.filter((f) => f >= 0).length;
  const fretted = frets.filter((f) => f > 0);
  const minF = fretted.length ? Math.min(...fretted) : 0;
  const maxF = fretted.length ? Math.max(...fretted) : 0;
  const opens = frets.filter((f) => f === 0).length;
  const midi = voicingMidi(frets, tuning);
  const pcs = new Set(midi.map(mod12));
  const bass = chord.bassPc ?? chord.rootPc;
  const lowestPc = mod12(midi[0]);
  if (lowestPc !== bass && !allowInversions) return null;

  let score = 0;
  score += minF * 0.9;
  // Open strings ring nicely in first position but are odd company for shapes further up.
  if (opens > 0) score += minF <= 2 ? -opens * 0.4 : minF <= 4 ? opens * 1.0 : opens * 1.5;
  score -= sounding * 1.6;
  const stretch = maxF - minF;
  score += stretch * 0.9 + Math.max(0, stretch - 2) * 1.5;
  score += fing.count * 0.4;
  score += fing.barres.length * 1.5;
  if (fing.barres.length && opens > 0) score += opens * 2.5;
  // Two separate fingers on one fret, far apart, twist the hand.
  const singles = frets.map((f, i) => ({ f, i })).filter((x) => x.f > 0 && !fing.barres.some((b) => b.fret === x.f && x.i >= b.from && x.i <= b.to));
  for (let a = 0; a < singles.length; a++) {
    for (let b = a + 1; b < singles.length; b++) {
      if (singles[a].f === singles[b].f && Math.abs(singles[a].i - singles[b].i) >= 3) score += 2;
    }
  }
  if (frets[frets.length - 1] < 0) score += 1.0;
  if (lowestPc !== bass) score += 6;
  const all = chordPcs(chord);
  const missingOptional = all.filter((p) => !pcs.has(p)).length;
  score += missingOptional * 1.5;
  if (chord.type.id === '5') {
    // Power chords want root, fifth and maybe the octave on the low strings, not a full strum.
    const lowestString = frets.findIndex((f) => f >= 0);
    score += sounding * 1.6 + Math.abs(sounding - 3) * 1.5 + (minF > 0 ? opens * 2 : 0) + lowestString * 1.5;
    if (frets[frets.length - 1] < 0) score -= 1.0;
  }
  return score;
}

/**
 * Find playable shapes for a chord on any tuning. Searches every hand position up the neck,
 * keeps shapes with all the essential chord tones, no muted strings in the middle and at most
 * four fingers (a barre counts as one), then ranks them by reach, fullness and position.
 */
export function generateVoicings(chord: Chord, tuning: number[], opts: VoicingOptions = {}): Voicing[] {
  const maxFret = opts.maxFret ?? 15;
  const span = opts.span ?? 4;
  const limit = opts.limit ?? 8;
  const allowInversions = opts.allowInversions ?? false;
  const allowed = new Set(chordPcs(chord));
  const required = requiredPcs(chord);
  const minStrings = allowed.size <= 2 ? 2 : 3;
  const n = tuning.length;

  const found = new Map<string, Voicing>();

  const consider = (frets: Frets, canonical: boolean) => {
    const key = shapeString(frets);
    if (found.has(key)) return;
    const soundingIdx = frets.map((f, i) => (f >= 0 ? i : -1)).filter((i) => i >= 0);
    if (soundingIdx.length < minStrings) return;
    const first = soundingIdx[0];
    const last = soundingIdx[soundingIdx.length - 1];
    if (last - first + 1 !== soundingIdx.length) return; // a muted string in the middle
    const midi = voicingMidi(frets, tuning);
    const pcs = new Set(midi.map(mod12));
    if (!required.every((p) => pcs.has(p))) return;
    if (![...pcs].every((p) => allowed.has(p))) return;
    const fing = fingerFrets(frets);
    if (!fing) return;
    const score = scoreVoicing(frets, fing, chord, tuning, allowInversions);
    if (score === null) return;
    const fretted = frets.filter((f) => f > 0);
    found.set(key, {
      frets,
      ...fing,
      minFret: fretted.length ? Math.min(...fretted) : 0,
      maxFret: fretted.length ? Math.max(...fretted) : 0,
      score: canonical ? score - 100 : score,
      canonical,
    });
  };

  if (isStandard(tuning)) {
    const sym = chordSymbol(chord);
    for (const shape of CANONICAL_SHAPES[sym] ?? []) consider(parseShape(shape), true);
  }

  const current: Frets = new Array(n).fill(-1);
  for (let start = 1; start <= maxFret - span + 1; start++) {
    const options: number[][] = tuning.map((open) => {
      const o = [-1];
      if (allowed.has(mod12(open))) o.push(0);
      for (let f = start; f < start + span; f++) if (allowed.has(mod12(open + f))) o.push(f);
      return o;
    });
    const walk = (s: number) => {
      if (s === n) {
        if (current.some((f) => f >= start)) consider([...current], false);
        return;
      }
      for (const f of options[s]) {
        current[s] = f;
        walk(s + 1);
      }
    };
    walk(0);
  }
  // Shapes with no fretted notes at all (open tunings): every mix of open and muted strings.
  for (let mask = 1; mask < 1 << n; mask++) {
    const frets = tuning.map((open, i) => (mask & (1 << i) && allowed.has(mod12(open)) ? 0 : -1));
    if (frets.every((f, i) => f === 0 || !(mask & (1 << i)))) consider(frets, false);
  }

  const sorted = [...found.values()].sort((a, b) => a.score - b.score);
  const kept: Voicing[] = [];
  for (const v of sorted) {
    // Skip a shape that is just a better shape with strings left out (hand-picked shapes always stay).
    const subset = !v.canonical && kept.some((k) => v.frets.every((f, i) => f < 0 || k.frets[i] === f));
    if (subset) continue;
    kept.push(v);
    if (kept.length >= limit) break;
  }
  return kept;
}

/** The single easiest shape, or null when nothing fits. */
export function bestVoicing(chord: Chord, tuning: number[], opts: VoicingOptions = {}): Voicing | null {
  return generateVoicings(chord, tuning, { ...opts, limit: 1 })[0] ?? null;
}
