import { useEffect, useRef } from 'preact/hooks';
import { mod12, pcName, pretty } from '../theory/notes';
import type { NoteRole } from './Fretboard';

const BLACK = new Set([1, 3, 6, 8, 10]);
const WHITE_W = 24;
const WHITE_H = 104;
const BLACK_W = 15;
const BLACK_H = 66;

const ROLE_FILL: Partial<Record<NoteRole, string>> = {
  root: 'var(--n-root)',
  third: 'var(--n-third)',
  fifth: 'var(--n-fifth)',
  seventh: 'var(--n-seventh)',
  ext: 'var(--n-ext)',
  accent: 'var(--accent)',
  other: 'var(--n-other)',
  good: 'var(--good)',
  bad: 'var(--bad)',
};

export interface PianoMark {
  role: NoteRole;
  label?: string;
}

export interface PianoProps {
  from: number;
  to: number;
  marks?: Map<number, PianoMark>;
  onPress?: (midi: number) => void;
  /** Show C3, C4… under the C keys. */
  octaveLabels?: boolean;
  flats?: boolean;
  /** Scroll so this note is in the middle when the keyboard is wider than the screen. */
  centerOn?: number;
}

export function Piano(props: PianoProps) {
  const keys: { midi: number; black: boolean; x: number }[] = [];
  let whiteIndex = 0;
  for (let m = props.from; m <= props.to; m++) {
    const black = BLACK.has(mod12(m));
    if (black) keys.push({ midi: m, black, x: whiteIndex * WHITE_W - BLACK_W / 2 });
    else {
      keys.push({ midi: m, black, x: whiteIndex * WHITE_W });
      whiteIndex++;
    }
  }
  const width = whiteIndex * WHITE_W + 2;
  const height = WHITE_H + 4;
  const whites = keys.filter((k) => !k.black);
  const blacks = keys.filter((k) => k.black);

  const markFor = (midi: number) => props.marks?.get(midi);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = wrap.current;
    const key = keys.find((k) => k.midi === props.centerOn);
    if (!el || !key || el.scrollWidth <= el.clientWidth) return;
    el.scrollLeft = (key.x / width) * el.scrollWidth - el.clientWidth / 2;
  }, []);

  const press = (midi: number) => (e: PointerEvent) => {
    e.preventDefault();
    props.onPress?.(midi);
  };

  return (
    <div class="piano-wrap" ref={wrap}>
      <svg class="piano" viewBox={`-1 -1 ${width} ${height}`} role="img" aria-label="Piano keyboard" style={{ minWidth: `${whiteIndex * 17}px` }}>
        {whites.map((k) => {
          const mark = markFor(k.midi);
          return (
            <g key={k.midi}>
              <rect class="pk-white" x={k.x} y={0} width={WHITE_W} height={WHITE_H} rx={3} onPointerDown={press(k.midi)}>
                <title>{pcName(k.midi, props.flats) + (Math.floor(k.midi / 12) - 1)}</title>
              </rect>
              {mark && (
                <>
                  <circle cx={k.x + WHITE_W / 2} cy={WHITE_H - 18} r={9.5} fill={ROLE_FILL[mark.role] ?? 'var(--accent)'} pointer-events="none" />
                  <text class="pk-label" x={k.x + WHITE_W / 2} y={WHITE_H - 14.5} text-anchor="middle" fill={mark.role === 'ext' ? '#22180a' : '#fff'} font-weight={700}>
                    {pretty(mark.label ?? pcName(k.midi, props.flats))}
                  </text>
                </>
              )}
              {props.octaveLabels && mod12(k.midi) === 0 && !mark && (
                <text class="pk-label" x={k.x + WHITE_W / 2} y={WHITE_H - 8} text-anchor="middle" fill="#8a847a">
                  C{Math.floor(k.midi / 12) - 1}
                </text>
              )}
            </g>
          );
        })}
        {blacks.map((k) => {
          const mark = markFor(k.midi);
          return (
            <g key={k.midi}>
              <rect class="pk-black" x={k.x} y={0} width={BLACK_W} height={BLACK_H} rx={2} onPointerDown={press(k.midi)}>
                <title>{pcName(k.midi, props.flats) + (Math.floor(k.midi / 12) - 1)}</title>
              </rect>
              {mark && (
                <>
                  <circle cx={k.x + BLACK_W / 2} cy={BLACK_H - 12} r={7} fill={ROLE_FILL[mark.role] ?? 'var(--accent)'} pointer-events="none" />
                  <text class="pk-label" x={k.x + BLACK_W / 2} y={BLACK_H - 9} text-anchor="middle" fill="#fff" font-size={7.5} font-weight={700}>
                    {pretty(mark.label ?? pcName(k.midi, props.flats))}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
