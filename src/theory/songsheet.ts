import { chordSymbol, makeChord, parseChordSymbol, type Chord } from './chords';
import { keyPrefersFlats, mod12, pcName } from './notes';
import { bestVoicing } from './voicings';

/**
 * Chord sheets the way guitarists share them: either chord names on their own line above the
 * lyric they land on, or ChordPro with chords inline in brackets ("Amazing [C]grace").
 */

export interface ChordToken {
  col: number;
  text: string;
  /** null for bar lines, repeat marks and other non-chord tokens. */
  chord: Chord | null;
}

export type SheetLine =
  | { kind: 'pair'; chords: ChordToken[]; lyric: string }
  | { kind: 'section'; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'blank' };

export interface Sheet {
  title?: string;
  lines: SheetLine[];
}

const EXTRAS = new Set(['|', '||', '/', '-', '%', 'N.C.', 'NC', 'x2', 'x3', 'x4', '(x2)', '(x3)', '(x4)', '*']);
const SECTION_RE = /^(intro|verse|pre-?chorus|chorus|bridge|outro|solo|interlude|instrumental|refrain|coda|tag)\b[^:]*:?$/i;

function tokensOf(line: string): { col: number; text: string }[] {
  const out: { col: number; text: string }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) out.push({ col: m.index, text: m[0] });
  return out;
}

/** A line made only of chord names (plus bar lines and repeat marks). */
export function chordLine(line: string): ChordToken[] | null {
  const tokens = tokensOf(line);
  if (!tokens.length) return null;
  let chords = 0;
  const out: ChordToken[] = [];
  for (const t of tokens) {
    const chord = parseChordSymbol(t.text);
    if (chord) chords++;
    else if (!EXTRAS.has(t.text)) return null;
    out.push({ ...t, chord });
  }
  return chords > 0 && chords * 2 >= tokens.length ? out : null;
}

/** Split a ChordPro line ("Was [Em]blind, but [D]now") into chords with columns and the bare lyric. */
function inlineChords(line: string): { chords: ChordToken[]; lyric: string } | null {
  if (!/\[[^\]]+\]/.test(line)) return null;
  const chords: ChordToken[] = [];
  let lyric = '';
  let i = 0;
  const re = /\[([^\]]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const chord = parseChordSymbol(m[1]);
    if (!chord) return null;
    lyric += line.slice(i, m.index);
    const prev = chords[chords.length - 1];
    const col = prev ? Math.max(lyric.length, prev.col + prev.text.length + 1) : lyric.length;
    chords.push({ col, text: m[1], chord });
    i = m.index + m[0].length;
  }
  lyric += line.slice(i);
  return { chords, lyric: lyric.replace(/\s+$/, '') };
}

export function parseSheet(text: string): Sheet {
  const raw = text.replace(/\r\n?/g, '\n').split('\n');
  const lines: SheetLine[] = [];
  let title: string | undefined;
  for (let i = 0; i < raw.length; i++) {
    const line = raw[i].replace(/\s+$/, '');
    const trimmed = line.trim();
    if (!trimmed) {
      lines.push({ kind: 'blank' });
      continue;
    }
    const directive = /^\{\s*(title|t)\s*:\s*(.+?)\s*\}$/i.exec(trimmed);
    if (directive) {
      title = directive[2];
      continue;
    }
    if (/^\{.*\}$/.test(trimmed)) continue; // other ChordPro directives
    const bracketed = /^\[([^\]]+)\]$/.exec(trimmed);
    if ((bracketed && !parseChordSymbol(bracketed[1])) || SECTION_RE.test(trimmed)) {
      lines.push({ kind: 'section', text: (bracketed ? bracketed[1] : trimmed).replace(/:$/, '') });
      continue;
    }
    const inline = inlineChords(line);
    if (inline) {
      lines.push({ kind: 'pair', ...inline });
      continue;
    }
    const chords = chordLine(line);
    if (chords) {
      const next = raw[i + 1]?.replace(/\s+$/, '') ?? '';
      if (next.trim() && !chordLine(next) && !inlineChords(next) && !SECTION_RE.test(next.trim()) && !/^\[[^\]]+\]$/.test(next.trim())) {
        lines.push({ kind: 'pair', chords, lyric: next });
        i++;
      } else {
        lines.push({ kind: 'pair', chords, lyric: '' });
      }
      continue;
    }
    lines.push({ kind: 'text', text: line });
  }
  return { title, lines };
}

export function transposeChord(c: Chord, semis: number, flats: boolean): Chord {
  if (semis % 12 === 0) return c;
  const root = pcName(mod12(c.rootPc + semis), flats);
  const bass = c.bassPc !== undefined ? pcName(mod12(c.bassPc + semis), flats) : undefined;
  return makeChord(root, c.type.id, bass);
}

/** Every chord in the sheet, in order of first appearance. */
export function sheetChords(sheet: Sheet): Chord[] {
  const seen = new Map<string, Chord>();
  for (const l of sheet.lines) {
    if (l.kind !== 'pair') continue;
    for (const t of l.chords) if (t.chord && !seen.has(chordSymbol(t.chord))) seen.set(chordSymbol(t.chord), t.chord);
  }
  return [...seen.values()];
}

/** Whether the transposed sheet should be spelled with flats, judged from its first chord. */
export function flatsFor(chords: Chord[], semis: number): boolean {
  const first = chords[0];
  if (!first) return false;
  const minor = ['min', 'm7', 'm6', 'm9', 'madd9', 'mmaj7'].includes(first.type.id);
  return keyPrefersFlats(mod12(first.rootPc + semis), minor);
}

/** Shift every chord by `semis`, keeping each chord over its syllable and never letting two collide. */
export function transposeSheet(sheet: Sheet, semis: number, flats: boolean): Sheet {
  return {
    ...sheet,
    lines: sheet.lines.map((l) => {
      if (l.kind !== 'pair') return l;
      let end = -1;
      const chords = l.chords.map((t) => {
        const chord = t.chord ? transposeChord(t.chord, semis, flats) : null;
        const text = chord ? chordSymbol(chord) : t.text;
        const col = Math.max(t.col, end + 1);
        end = col + text.length;
        return { col, text, chord };
      });
      return { ...l, chords };
    }),
  };
}

/** How hard a chord shape is to grab: open shapes are easy, barres and high positions less so. */
export function shapeDifficulty(chord: Chord, tuning: number[]): number {
  const v = bestVoicing(chord, tuning);
  if (!v) return 30;
  return (v.canonical ? 1 : 3) + v.barres.length * 5 + v.minFret * 0.25 + Math.max(0, v.count - 3) * 0.5;
}

export interface CapoOption {
  capo: number;
  /** Shapes to hold with the capo on. */
  shapes: Chord[];
  difficulty: number;
}

/** Rank capo positions 0–7 by how easy the resulting shapes are. */
export function capoOptions(chords: Chord[], tuning: number[]): CapoOption[] {
  const out: CapoOption[] = [];
  for (let capo = 0; capo <= 7; capo++) {
    const flats = flatsFor(chords, -capo);
    const shapes = chords.map((c) => transposeChord(c, -capo, flats));
    const difficulty = shapes.reduce((sum, s) => sum + shapeDifficulty(s, tuning), 0) + capo * 0.15;
    out.push({ capo, shapes, difficulty });
  }
  return out.sort((a, b) => a.difficulty - b.difficulty);
}

export const SAMPLE_SHEET = `{title: Amazing Grace}
[Verse 1]
[G]Amazing grace, how [C]sweet the [G]sound
That saved a wretch like [D]me
[G]I once was lost, but [C]now am [G]found
Was [Em]blind, but [D]now I [G]see

[Verse 2]
'Twas [G]grace that taught my [C]heart to [G]fear
And grace my fears re[D]lieved
How [G]precious did that [C]grace ap[G]pear
The [Em]hour I [D]first be[G]lieved

[Verse 3]
Through [G]many dangers, [C]toils and [G]snares
I have al[Em]ready [D]come
'Tis [G]grace hath brought me [C]safe thus [G]far
And [Em]grace will [D]lead me [G]home`;
