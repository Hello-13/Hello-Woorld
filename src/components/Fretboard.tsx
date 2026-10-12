import { useEffect, useMemo, useState } from 'preact/hooks';
import { makeRandom } from '../audio/pluck';
import type { Degree } from '../theory/intervals';
import { pretty } from '../theory/notes';

export type NoteRole = 'root' | 'third' | 'fifth' | 'seventh' | 'ext' | 'other' | 'accent' | 'good' | 'bad' | 'ghost';

export interface FretMark {
  string: number;
  fret: number;
  label?: string;
  role?: NoteRole;
  /** Animate in when it appears. */
  pop?: boolean;
  dim?: boolean;
}

/** Colour family for a chord tone or scale degree: roots red, thirds blue, fifths green, sevenths purple. */
export function roleForDegree(d: Pick<Degree, 'number'>): NoteRole {
  switch (d.number) {
    case 1:
    case 8:
      return 'root';
    case 3:
    case 10:
      return 'third';
    case 5:
    case 12:
      return 'fifth';
    case 7:
      return 'seventh';
    default:
      return 'ext';
  }
}

const ROLE_FILL: Record<NoteRole, string> = {
  root: 'var(--n-root)',
  third: 'var(--n-third)',
  fifth: 'var(--n-fifth)',
  seventh: 'var(--n-seventh)',
  ext: 'var(--n-ext)',
  other: 'var(--n-other)',
  accent: 'var(--accent)',
  good: 'var(--good)',
  bad: 'var(--bad)',
  ghost: 'transparent',
};

const ROLE_INK: Partial<Record<NoteRole, string>> = {
  ext: 'var(--n-ext-ink)',
  accent: 'var(--accent-ink)',
  ghost: 'var(--ink-2)',
};

export type Orientation = 'horizontal' | 'vertical';

export interface FretboardProps {
  /** MIDI note of each open string, lowest first. */
  tuning: number[];
  frets?: number;
  marks?: FretMark[];
  leftHanded?: boolean;
  onPress?: (string: number, fret: number) => void;
  /** Dim everything outside this fret window (inclusive). */
  range?: [number, number] | null;
  /** 0–1 heat per "string:fret" cell, drawn as a green-to-red wash (1 = needs work). */
  heat?: Record<string, number>;
  /** String names at the nut. */
  stringLabels?: string[];
  /** String indices to wobble (just plucked). */
  ringing?: number[];
  ariaLabel?: string;
  /** Defaults to vertical on narrow screens, where a sideways neck would be too thin to read. */
  orientation?: Orientation;
}

const INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];
const STRING_WIDTH = [3.3, 2.7, 2.2, 1.8, 1.3, 1.0];

/** Geometry for one orientation, in "neck" coordinates: `along` the neck from the headstock, `across` the strings. */
interface Layout {
  /** Where open-string notes sit, before the nut. */
  openA: number;
  nutA: number;
  endA: number;
  /** Where the string names go. */
  labelA: number;
  /** Across-the-neck position of the fret numbers. */
  numberC: number;
  spacing: number;
  boardC0: number;
  width: number;
  height: number;
  /** How much of the neck's length follows true fret spacing (the rest is even). */
  realism: number;
}

function layoutFor(orientation: Orientation, frets: number, strings: number): Layout {
  if (orientation === 'vertical') {
    const spacing = 46;
    const nutA = 50;
    const endA = nutA + frets * 56;
    return { openA: 30, nutA, endA, labelA: 10, numberC: 14, spacing, boardC0: 30, width: 30 + spacing * strings + 8, height: endA + 10, realism: 0.35 };
  }
  const spacing = 30;
  const nutA = 62;
  const endA = Math.max(560, nutA + frets * 78);
  return { openA: 34, nutA, endA, labelA: 10, numberC: 10 + spacing * strings + 20, spacing, boardC0: 10, width: endA + 12, height: 10 * 2 + spacing * strings + 28, realism: 0.62 };
}

/** Fret-wire positions along the neck: the real 12th-root-of-two spacing, eased so high frets stay tappable. */
export function fretPositions(frets: number, nutA: number, endA: number, realism = 0.62): number[] {
  const realEnd = 1 - Math.pow(2, -frets / 12);
  const out: number[] = [];
  for (let n = 0; n <= frets; n++) {
    const real = (1 - Math.pow(2, -n / 12)) / realEnd;
    const linear = n / frets;
    out.push(nutA + (realism * real + (1 - realism) * linear) * (endA - nutA));
  }
  return out;
}

function useNarrow(query = '(max-width: 600px)'): boolean {
  const get = () => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches;
  const [narrow, setNarrow] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setNarrow(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, [query]);
  return narrow;
}

export function Fretboard(props: FretboardProps) {
  const frets = props.frets ?? 15;
  const n = props.tuning.length;
  const lefty = props.leftHanded ?? false;
  const narrow = useNarrow();
  const orientation: Orientation = props.orientation ?? (narrow ? 'vertical' : 'horizontal');
  const vertical = orientation === 'vertical';
  const L = layoutFor(orientation, frets, n);
  const xs = useMemo(() => fretPositions(frets, L.nutA, L.endA, L.realism), [frets, L.nutA, L.endA, L.realism]);

  const boardC1 = L.boardC0 + L.spacing * n;
  const midC = (L.boardC0 + boardC1) / 2;
  // Horizontal: the high string on top, like tab. Vertical: the low string on the left, like a chord chart.
  const stringC = (s: number) => (vertical ? L.boardC0 + L.spacing / 2 + s * L.spacing : L.boardC0 + L.spacing / 2 + (n - 1 - s) * L.spacing);
  const centerA = (f: number) => (f === 0 ? L.openA : (xs[f - 1] + xs[f]) / 2);

  // Map neck coordinates to the screen, mirroring for left-handed players.
  const pt = (a: number, c: number): [number, number] => {
    if (vertical) return [lefty ? L.width - c : c, a];
    return [lefty ? L.width - a : a, c];
  };
  const box = (a0: number, a1: number, c0: number, c1: number) => {
    const [x0, y0] = pt(a0, c0);
    const [x1, y1] = pt(a1, c1);
    return { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) };
  };

  const grain = useMemo(() => {
    const rand = makeRandom(1234);
    const lines: { d: string; w: number }[] = [];
    const len = L.endA - L.nutA;
    for (let i = 0; i < 18; i++) {
      const c0 = L.boardC0 + rand() * (boardC1 - L.boardC0);
      const p0 = pt(L.nutA, c0);
      let d = `M ${p0[0].toFixed(1)} ${p0[1].toFixed(1)}`;
      const segs = 6;
      let c = c0;
      for (let k = 1; k <= segs; k++) {
        const a = L.nutA + (len * k) / segs;
        const ctrl = pt(a - len / segs / 2, c + (rand() - 0.5) * 6);
        c = c0 + (rand() - 0.5) * 7;
        const end = pt(a, c);
        d += ` Q ${ctrl[0].toFixed(1)} ${ctrl[1].toFixed(1)} ${end[0].toFixed(1)} ${end[1].toFixed(1)}`;
      }
      lines.push({ d, w: i % 3 === 0 ? 1.1 : 0.6 });
    }
    return lines;
  }, [orientation, lefty, frets, n]);

  const cellA = (f: number): [number, number] => (f === 0 ? [L.openA - 18, L.nutA - 3] : [xs[f - 1], xs[f]]);

  const heatCells = props.heat
    ? Object.entries(props.heat).map(([key, v]) => {
        const [s, f] = key.split(':').map(Number);
        if (f > frets || s >= n) return null;
        const [a0, a1] = cellA(f);
        const c = stringC(s);
        const hue = 130 - 130 * Math.max(0, Math.min(1, v));
        return <rect key={'h' + key} {...box(a0 + 1, a1 - 1, c - L.spacing / 2 + 2, c + L.spacing / 2 - 2)} rx={4} fill={`hsl(${hue} 75% 50% / 0.42)`} />;
      })
    : null;

  const textAt = (a: number, c: number) => {
    const [x, y] = pt(a, c);
    return { x, y: y + 4 };
  };

  return (
    <div class={`fretboard-wrap ${vertical ? 'vertical' : ''}`}>
      <svg
        class={`fretboard ${vertical ? 'vertical' : ''}`}
        viewBox={`0 0 ${L.width} ${L.height}`}
        style={vertical ? undefined : { minWidth: `${Math.round(L.width * 0.61)}px`, maxWidth: `${Math.round(L.width * 1.1)}px` }}
        role="img"
        aria-label={props.ariaLabel ?? 'Guitar fretboard'}
      >
        <defs>
          <linearGradient id={`fb-wood-${orientation}`} x1="0" y1="0" x2={vertical ? '1' : '0'} y2={vertical ? '0' : '1'}>
            <stop offset="0" style={{ stopColor: 'var(--board-2)' }} />
            <stop offset="0.5" style={{ stopColor: 'var(--board)' }} />
            <stop offset="1" style={{ stopColor: 'var(--board-2)' }} />
          </linearGradient>
          <linearGradient id={`fb-fret-${orientation}`} x1="0" y1="0" x2={vertical ? '0' : '1'} y2={vertical ? '1' : '0'}>
            <stop offset="0" style={{ stopColor: 'var(--fret)' }} />
            <stop offset="0.5" style={{ stopColor: 'var(--fret-hi)' }} />
            <stop offset="1" style={{ stopColor: 'var(--fret)' }} />
          </linearGradient>
          <filter id="fb-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" style={{ floodColor: 'var(--board-shadow)' }} />
          </filter>
        </defs>

        {/* Neck */}
        <rect {...box(L.nutA, L.endA, L.boardC0, boardC1)} rx={3} fill={`url(#fb-wood-${orientation})`} filter="url(#fb-shadow)" />
        {grain.map((g, i) => (
          <path key={i} class="fb-grain" d={g.d} stroke-width={g.w} opacity={0.35} />
        ))}

        {/* Inlays */}
        {INLAYS.filter((f) => f <= frets).map((f) => {
          const [x, y] = pt(centerA(f), midC);
          return <circle key={'in' + f} class="fb-inlay" cx={x} cy={y} r={7} />;
        })}
        {frets >= 12 &&
          [-1, 1].map((side) => {
            const [x, y] = pt(centerA(12), midC + side * L.spacing);
            return <circle key={'in12' + side} class="fb-inlay" cx={x} cy={y} r={7} />;
          })}

        {/* Out-of-range shading sits under the frets so the wires still read */}
        {props.range &&
          [
            [0, props.range[0] - 1],
            [props.range[1] + 1, frets],
          ]
            .filter(([a, b]) => b >= a)
            .map(([a, b]) => <rect key={'dim' + a} class="fb-dim" {...box(a === 0 ? L.openA - 18 : xs[a - 1], xs[b], L.boardC0 - 4, boardC1 + 4)} />)}

        {heatCells}

        {/* Frets and nut */}
        {xs.slice(1).map((a, i) => (
          <rect key={'f' + i} {...box(a - 1.6, a + 1.6, L.boardC0, boardC1)} fill={`url(#fb-fret-${orientation})`} />
        ))}
        <rect class="fb-nut" {...box(L.nutA - 7, L.nutA, L.boardC0 - 1, boardC1 + 1)} rx={1.5} />

        {/* Strings */}
        {props.tuning.map((_, s) => {
          const [x1, y1] = pt(L.openA - 6, stringC(s));
          const [x2, y2] = pt(L.endA, stringC(s));
          const wound = s <= 3 && n === 6;
          const ringing = props.ringing?.includes(s);
          return (
            <line
              key={'s' + s + (ringing ? 'r' : '')}
              class={`fb-string ${wound ? 'wound' : 'plain'} ${ringing ? (vertical ? 'ringing-v' : 'ringing') : ''}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke-width={STRING_WIDTH[s] ?? 1.2}
              stroke-dasharray={wound ? '0.9 0.5' : undefined}
            />
          );
        })}

        {/* String names at the headstock end */}
        {props.stringLabels?.map((label, s) => {
          const p = textAt(L.labelA, stringC(s));
          return (
            <text key={'sl' + s} class="fb-string-label" x={p.x} y={p.y} text-anchor="middle">
              {pretty(label)}
            </text>
          );
        })}

        {/* Fret numbers */}
        {Array.from({ length: frets }, (_, i) => i + 1).map((f) => {
          const p = textAt(centerA(f), L.numberC);
          return (
            <text key={'num' + f} class={`fb-num ${INLAYS.includes(f) || f === 12 ? 'inlaid' : ''}`} x={p.x} y={p.y} text-anchor="middle">
              {f}
            </text>
          );
        })}

        {/* Tap targets */}
        {props.onPress &&
          props.tuning.map((_, s) =>
            Array.from({ length: frets + 1 }, (_, f) => {
              const [a0, a1] = cellA(f);
              const c = stringC(s);
              return (
                <rect
                  key={`c${s}-${f}`}
                  class="fb-cell"
                  {...box(a0, a1, c - L.spacing / 2, c + L.spacing / 2)}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    props.onPress!(s, f);
                  }}
                >
                  <title>{f === 0 ? `String ${n - s} open` : `String ${n - s}, fret ${f}`}</title>
                </rect>
              );
            }),
          )}

        {/* Notes */}
        {props.marks?.map((m) => {
          if (m.fret > frets || m.string >= n) return null;
          const role = m.role ?? 'accent';
          const [cx, cy] = pt(centerA(m.fret), stringC(m.string));
          const label = m.label ? pretty(m.label) : '';
          return (
            <g key={`${m.string}-${m.fret}-${role}-${m.label}`} class={`fb-note ${m.pop ? 'pop' : ''}`} opacity={m.dim ? 0.35 : 1}>
              <circle
                class="dot"
                cx={cx}
                cy={cy}
                r={vertical ? 14 : 12.5}
                fill={ROLE_FILL[role]}
                stroke-dasharray={role === 'ghost' ? '3 3' : undefined}
                style={role === 'ghost' ? { stroke: 'var(--ink-2)' } : undefined}
              />
              {label && (
                <text x={cx} y={cy + 4} text-anchor="middle" fill={ROLE_INK[role] ?? 'var(--n-ink)'} font-size={label.length > 2 ? 9.5 : 11}>
                  {label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
