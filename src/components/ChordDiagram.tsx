import { DEGREE_LABELS } from '../theory/intervals';
import { mod12, pcName, pretty } from '../theory/notes';
import type { Barre, Frets } from '../theory/voicings';

export type DiagramLabels = 'fingers' | 'notes' | 'intervals' | 'none';

export interface ChordDiagramProps {
  frets: Frets;
  fingers?: number[];
  barres?: Barre[];
  tuning: number[];
  rootPc?: number;
  labels?: DiagramLabels;
  /** Pixel width; height follows. */
  width?: number;
  flats?: boolean;
  /** String currently sounding (for a little highlight while strumming). */
  activeStrings?: number[];
  title?: string;
}

const ROWS = 5;
const X0 = 24;
const DX = 16;
const Y0 = 30;
const DY = 22;

/** A classic chord box: strings vertical (low E on the left), nut on top. */
export function ChordDiagram(props: ChordDiagramProps) {
  const { frets, tuning } = props;
  const labels = props.labels ?? 'fingers';
  const n = frets.length;
  const fretted = frets.filter((f) => f > 0);
  const maxF = fretted.length ? Math.max(...fretted) : 0;
  const minF = fretted.length ? Math.min(...fretted) : 0;
  // Show the nut when the shape fits in the first five frets and either rings open strings or
  // sits low; otherwise start the box at the lowest fretted note ("5fr").
  const hasOpen = frets.some((f) => f === 0);
  const start = maxF <= ROWS && (hasOpen || maxF <= 4) ? 1 : Math.max(1, minF);
  const width = props.width ?? 120;
  const vbW = X0 * 2 + DX * (n - 1);
  const vbH = Y0 + DY * ROWS + 14;
  const sx = (s: number) => X0 + s * DX;
  const fy = (f: number) => Y0 + (f - start + 0.5) * DY;

  const label = (s: number): string => {
    const f = frets[s];
    if (f < 0) return '';
    const midi = tuning[s] + f;
    if (labels === 'fingers') return props.fingers?.[s] ? String(props.fingers[s]) : '';
    if (labels === 'notes') return pretty(pcName(midi, props.flats));
    if (labels === 'intervals' && props.rootPc !== undefined) {
      const l = DEGREE_LABELS[mod12(midi - props.rootPc)];
      return pretty(l === '1' ? 'R' : l);
    }
    return '';
  };

  const isRoot = (s: number) => props.rootPc !== undefined && frets[s] >= 0 && mod12(tuning[s] + frets[s]) === props.rootPc;
  const barres = props.barres ?? [];
  const underBarre = (s: number) => barres.some((b) => b.fret === frets[s] && s >= b.from && s <= b.to);

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      width={width}
      height={(width * vbH) / vbW}
      role="img"
      aria-label={props.title ?? 'Chord diagram'}
      style={{ display: 'block', maxWidth: '100%' }}
    >
      {/* Fret lines */}
      {Array.from({ length: ROWS + 1 }, (_, r) => (
        <line key={'r' + r} class="cd-grid" x1={sx(0)} x2={sx(n - 1)} y1={Y0 + r * DY} y2={Y0 + r * DY} stroke-width={1} />
      ))}
      {/* Strings */}
      {frets.map((_, s) => (
        <line
          key={'s' + s}
          class="cd-grid"
          x1={sx(s)}
          x2={sx(s)}
          y1={Y0}
          y2={Y0 + ROWS * DY}
          stroke-width={props.activeStrings?.includes(s) ? 2.4 : 1 + (n - 1 - s) * 0.12}
          style={props.activeStrings?.includes(s) ? { stroke: 'var(--accent)' } : undefined}
        />
      ))}
      {start === 1 ? (
        <rect class="cd-nut" x={sx(0) - 1} y={Y0 - 5} width={sx(n - 1) - sx(0) + 2} height={5} rx={1} />
      ) : (
        <text class="cd-label" x={sx(0) - 7} y={fy(start) + 4} text-anchor="end" font-size={10}>
          {start}fr
        </text>
      )}

      {/* Open and muted markers */}
      {frets.map((f, s) =>
        f === 0 ? (
          <circle key={'o' + s} class="cd-mark" cx={sx(s)} cy={Y0 - 13} r={4.6} style={isRoot(s) ? { stroke: 'var(--n-root)' } : undefined} />
        ) : f < 0 ? (
          <g key={'x' + s} class="cd-mark" transform={`translate(${sx(s)} ${Y0 - 13})`}>
            <line x1={-4} y1={-4} x2={4} y2={4} />
            <line x1={4} y1={-4} x2={-4} y2={4} />
          </g>
        ) : null,
      )}

      {/* Barres */}
      {barres.map((b) => (
        <g key={'b' + b.fret + b.from}>
          <rect class="cd-dot" x={sx(b.from) - 7} y={fy(b.fret) - 7} width={sx(b.to) - sx(b.from) + 14} height={14} rx={7} />
          {labels === 'fingers' && (
            <text class="cd-dot-text" x={sx(b.to)} y={fy(b.fret) + 3.5} text-anchor="middle" font-size={10}>
              {b.finger}
            </text>
          )}
        </g>
      ))}

      {/* Fretted notes (barre notes only get a dot of their own when labelled by note or interval) */}
      {frets.map((f, s) => {
        if (f <= 0) return null;
        const barred = underBarre(s);
        if (barred && labels === 'fingers') return null;
        const text = label(s);
        return (
          <g key={'d' + s}>
            <circle class={`cd-dot ${isRoot(s) ? 'root' : ''}`} cx={sx(s)} cy={fy(f)} r={7} />
            {text && (
              <text class="cd-dot-text" x={sx(s)} y={fy(f) + 3.5} text-anchor="middle" font-size={text.length > 1 ? 8 : 10}>
                {text}
              </text>
            )}
          </g>
        );
      })}

      {/* Open-string labels under the box for note/interval modes */}
      {labels !== 'fingers' &&
        labels !== 'none' &&
        frets.map((f, s) =>
          f === 0 ? (
            <text key={'ol' + s} class="cd-label" x={sx(s)} y={Y0 + ROWS * DY + 11} text-anchor="middle" font-size={8.5}>
              {label(s)}
            </text>
          ) : null,
        )}
    </svg>
  );
}
