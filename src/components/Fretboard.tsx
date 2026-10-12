import { useMemo } from 'preact/hooks';
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

export interface FretboardProps {
  /** MIDI note of each open string, lowest first. */
  tuning: number[];
  frets?: number;
  marks?: FretMark[];
  leftHanded?: boolean;
  onPress?: (string: number, fret: number) => void;
  /** Dim everything outside this fret window (inclusive). */
  range?: [number, number] | null;
  /** 0–1 heat per "string:fret" cell, drawn as a red-to-green wash (1 = needs work). */
  heat?: Record<string, number>;
  /** String names at the nut. */
  stringLabels?: string[];
  /** String indices to wobble (just plucked). */
  ringing?: number[];
  ariaLabel?: string;
}

const W = 1240;
const OPEN_X = 34;
const NUT_X = 62;
const END_X = W - 12;
const TOP = 10;
const SPACING = 30;
const INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];
const STRING_WIDTH = [3.3, 2.7, 2.2, 1.8, 1.3, 1.0];

/** Fret-wire positions: mostly the real 12th-root-of-two spacing, eased so high frets stay tappable. */
export function fretPositions(frets: number): number[] {
  const realEnd = 1 - Math.pow(2, -frets / 12);
  const xs: number[] = [];
  for (let n = 0; n <= frets; n++) {
    const real = (1 - Math.pow(2, -n / 12)) / realEnd;
    const linear = n / frets;
    xs.push(NUT_X + (0.62 * real + 0.38 * linear) * (END_X - NUT_X));
  }
  return xs;
}

export function Fretboard(props: FretboardProps) {
  const frets = props.frets ?? 15;
  const n = props.tuning.length;
  const lefty = props.leftHanded ?? false;
  const H = TOP * 2 + SPACING * n + 28;
  const boardTop = TOP;
  const boardBottom = TOP + SPACING * n;
  const xs = useMemo(() => fretPositions(frets), [frets]);
  const X = (x: number) => (lefty ? W - x : x);
  const stringY = (s: number) => boardTop + SPACING / 2 + (n - 1 - s) * SPACING;
  const center = (f: number) => (f === 0 ? OPEN_X : (xs[f - 1] + xs[f]) / 2);
  const midY = (boardTop + boardBottom) / 2;

  const grain = useMemo(() => {
    const rand = makeRandom(1234);
    const lines: string[] = [];
    for (let i = 0; i < 18; i++) {
      const y0 = boardTop + rand() * (boardBottom - boardTop);
      let d = `M ${NUT_X} ${y0.toFixed(1)}`;
      const segs = 6;
      for (let k = 1; k <= segs; k++) {
        const x = NUT_X + ((END_X - NUT_X) * k) / segs;
        const y = y0 + (rand() - 0.5) * 7;
        const cx = x - (END_X - NUT_X) / segs / 2;
        d += ` Q ${cx.toFixed(1)} ${(y + (rand() - 0.5) * 6).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      lines.push(d);
    }
    return lines;
  }, [boardTop, boardBottom]);

  const heatCells = props.heat
    ? Object.entries(props.heat).map(([key, v]) => {
        const [s, f] = key.split(':').map(Number);
        if (f > frets || s >= n) return null;
        const x0 = f === 0 ? OPEN_X - 16 : xs[f - 1];
        const x1 = f === 0 ? NUT_X - 4 : xs[f];
        const hue = 130 - 130 * Math.max(0, Math.min(1, v));
        return (
          <rect
            key={'h' + key}
            x={Math.min(X(x0), X(x1))}
            y={stringY(s) - SPACING / 2 + 2}
            width={Math.abs(X(x1) - X(x0))}
            height={SPACING - 4}
            rx={4}
            fill={`hsl(${hue} 75% 50% / 0.42)`}
          />
        );
      })
    : null;

  return (
    <div class="fretboard-wrap">
      <svg class="fretboard" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={props.ariaLabel ?? 'Guitar fretboard'}>
        <defs>
          <linearGradient id="fb-wood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--board-2)' }} />
            <stop offset="0.5" style={{ stopColor: 'var(--board)' }} />
            <stop offset="1" style={{ stopColor: 'var(--board-2)' }} />
          </linearGradient>
          <linearGradient id="fb-fret" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" style={{ stopColor: 'var(--fret)' }} />
            <stop offset="0.5" style={{ stopColor: 'var(--fret-hi)' }} />
            <stop offset="1" style={{ stopColor: 'var(--fret)' }} />
          </linearGradient>
          <filter id="fb-shadow" x="-5%" y="-20%" width="110%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" style={{ floodColor: 'var(--board-shadow)' }} />
          </filter>
        </defs>

        {/* Neck */}
        <rect
          class="fb-board"
          x={lefty ? W - END_X : NUT_X}
          y={boardTop}
          width={END_X - NUT_X}
          height={boardBottom - boardTop}
          rx={3}
          filter="url(#fb-shadow)"
        />
        <g transform={lefty ? `translate(${W} 0) scale(-1 1)` : undefined}>
          {grain.map((d, i) => (
            <path key={i} class="fb-grain" d={d} stroke-width={i % 3 === 0 ? 1.1 : 0.6} opacity={0.35} />
          ))}
        </g>

        {/* Inlays */}
        {INLAYS.filter((f) => f <= frets).map((f) => (
          <circle key={'in' + f} class="fb-inlay" cx={X(center(f))} cy={midY} r={7} />
        ))}
        {frets >= 12 && (
          <>
            <circle class="fb-inlay" cx={X(center(12))} cy={midY - SPACING} r={7} />
            <circle class="fb-inlay" cx={X(center(12))} cy={midY + SPACING} r={7} />
          </>
        )}

        {/* Out-of-range shading sits under the frets so the wires still read */}
        {props.range &&
          [
            [0, props.range[0] - 1],
            [props.range[1] + 1, frets],
          ]
            .filter(([a, b]) => b >= a)
            .map(([a, b]) => {
              const x0 = a === 0 ? OPEN_X - 18 : xs[a - 1];
              const x1 = xs[b];
              return (
                <rect
                  key={'dim' + a}
                  class="fb-dim"
                  x={Math.min(X(x0), X(x1))}
                  y={boardTop - 4}
                  width={Math.abs(X(x1) - X(x0))}
                  height={boardBottom - boardTop + 8}
                />
              );
            })}

        {heatCells}

        {/* Frets and nut */}
        {xs.slice(1).map((x, i) => (
          <rect key={'f' + i} x={X(x) - 1.6} y={boardTop} width={3.2} height={boardBottom - boardTop} fill="url(#fb-fret)" />
        ))}
        <rect class="fb-nut" x={X(NUT_X) - (lefty ? 0 : 7)} y={boardTop - 1} width={7} height={boardBottom - boardTop + 2} rx={1.5} />

        {/* Strings */}
        {props.tuning.map((_, s) => (
          <line
            key={'s' + s + (props.ringing?.includes(s) ? 'r' : '')}
            class={`fb-string ${s <= 3 && n === 6 ? 'wound' : 'plain'} ${props.ringing?.includes(s) ? 'ringing' : ''}`}
            x1={X(OPEN_X - 6)}
            x2={X(END_X)}
            y1={stringY(s)}
            y2={stringY(s)}
            stroke-width={STRING_WIDTH[s] ?? 1.2}
            stroke-dasharray={s <= 3 && n === 6 ? '0.9 0.5' : undefined}
          />
        ))}

        {/* String names at the headstock end */}
        {props.stringLabels?.map((label, s) => (
          <text key={'sl' + s} class="fb-string-label" x={X(10)} y={stringY(s) + 4} text-anchor="middle">
            {pretty(label)}
          </text>
        ))}

        {/* Fret numbers */}
        {Array.from({ length: frets }, (_, i) => i + 1).map((f) => (
          <text
            key={'num' + f}
            class={`fb-num ${INLAYS.includes(f) || f === 12 ? 'inlaid' : ''}`}
            x={X(center(f))}
            y={boardBottom + 20}
            text-anchor="middle"
          >
            {f}
          </text>
        ))}

        {/* Tap targets */}
        {props.onPress &&
          props.tuning.map((_, s) =>
            Array.from({ length: frets + 1 }, (_, f) => {
              const x0 = f === 0 ? OPEN_X - 18 : xs[f - 1];
              const x1 = f === 0 ? NUT_X - 3 : xs[f];
              return (
                <rect
                  key={`c${s}-${f}`}
                  class="fb-cell"
                  x={Math.min(X(x0), X(x1))}
                  y={stringY(s) - SPACING / 2}
                  width={Math.abs(X(x1) - X(x0))}
                  height={SPACING}
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
          const cx = X(center(m.fret));
          const cy = stringY(m.string);
          const label = m.label ? pretty(m.label) : '';
          return (
            <g
              key={`${m.string}-${m.fret}-${role}-${m.label}`}
              class={`fb-note ${m.pop ? 'pop' : ''}`}
              opacity={m.dim ? 0.35 : 1}
            >
              <circle
                class="dot"
                cx={cx}
                cy={cy}
                r={12.5}
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
