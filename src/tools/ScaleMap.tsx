import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { getEngine } from '../audio/engine';
import { playNote, strum } from '../audio/guitar';
import { Fretboard, roleForDegree, type FretMark, type NoteRole } from '../components/Fretboard';
import { Piano, type PianoMark } from '../components/Piano';
import { Field, PlayIcon, Seg, StopIcon, ToolHeader } from '../components/ui';
import { markActive } from '../state/practice';
import { useSettings, useTuning } from '../state/settings';
import { identifyChord, makeChord } from '../theory/chords';
import { COMMON_ROOT_NAMES, mod12, parseNoteName, pretty } from '../theory/notes';
import { getScale, SCALES, scalePcs, spellScale, type ScaleType } from '../theory/scales';
import { stringName } from '../theory/tunings';
import { bestVoicing } from '../theory/voicings';

type LabelMode = 'notes' | 'degrees' | 'none';

const PARENT: Record<string, string> = {
  'minor-pentatonic': 'minor',
  blues: 'minor',
  'major-pentatonic': 'major',
  'major-blues': 'major',
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

interface ScaleChord {
  roman: string;
  symbol: string;
  root: string;
  typeId: string;
}

/** Stack thirds on each degree of a seven-note scale and name the triads. */
export function scaleTriads(rootName: string, scale: ScaleType): ScaleChord[] {
  if (scale.degrees.length !== 7) return [];
  const root = parseNoteName(rootName)!;
  const pcs = scalePcs(root.pc, scale);
  const names = spellScale(rootName, scale);
  return pcs.map((pc, i) => {
    const third = pcs[(i + 2) % 7];
    const fifth = pcs[(i + 4) % 7];
    const match = identifyChord([pc, third, fifth], pc)[0];
    const typeId = match?.chord.type.id ?? 'maj';
    const label = scale.degrees[i].label;
    const acc = label.startsWith('b') ? '♭' : label.startsWith('#') ? '♯' : '';
    let numeral = ROMAN[i];
    if (typeId === 'min' || typeId === 'dim') numeral = numeral.toLowerCase();
    const suffix = typeId === 'dim' ? '°' : typeId === 'aug' ? '+' : '';
    const symbolSuffix = match?.chord.type.symbol ?? '';
    return { roman: acc + numeral + suffix, symbol: names[i] + symbolSuffix, root: names[i], typeId };
  });
}

interface Position {
  start: number;
  end: number;
}

/** Hand positions: one window starting on each scale note of the lowest string, frets 0–12. */
function positionsFor(pcs: number[], lowString: number): Position[] {
  const out: Position[] = [];
  for (let f = 0; f <= 12; f++) {
    if (pcs.includes(mod12(lowString + f))) out.push({ start: f, end: f + (pcs.length <= 6 ? 3 : 4) });
  }
  return out;
}

export function ScaleMap() {
  const settings = useSettings();
  const tuning = useTuning();
  const [root, setRoot] = useState('A');
  const [scaleId, setScaleId] = useState('minor-pentatonic');
  const [labels, setLabels] = useState<LabelMode>('notes');
  const [position, setPosition] = useState<number>(-1); // -1 = whole neck
  const [playing, setPlaying] = useState<{ s: number; f: number } | null>(null);
  const [running, setRunning] = useState(false);
  const timers = useRef<number[]>([]);

  const scale = getScale(scaleId);
  const rootPc = parseNoteName(root)!.pc;
  const pcs = useMemo(() => scalePcs(rootPc, scale), [rootPc, scaleId]);
  const names = useMemo(() => spellScale(root, scale), [root, scaleId]);
  const positions = useMemo(() => positionsFor(pcs, tuning.strings[0]), [pcs, tuning.id]);
  const pos = position >= 0 ? positions[Math.min(position, positions.length - 1)] : null;
  // Pentatonic and blues scales borrow their chords from the major or minor key they live in.
  const parent = scale.degrees.length === 7 ? scale : PARENT[scaleId] ? getScale(PARENT[scaleId]) : null;
  const triads = useMemo(() => (parent ? scaleTriads(root, parent) : []), [root, scaleId]);

  useEffect(() => setPosition((p) => (p >= positions.length ? -1 : p)), [positions.length]);

  const stopRun = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPlaying(null);
    setRunning(false);
  };
  useEffect(() => stopRun, []);

  const degreeOf = (pc: number) => scale.degrees[pcs.indexOf(pc)];
  const roleOf = (pc: number): NoteRole => {
    const d = degreeOf(pc);
    return d ? roleForDegree(d) : 'other';
  };
  const labelOf = (pc: number): string => {
    const i = pcs.indexOf(pc);
    if (labels === 'none' || i < 0) return '';
    if (labels === 'degrees') return scale.degrees[i].label === '1' ? 'R' : scale.degrees[i].label;
    return names[i];
  };

  const inWindow = (f: number) => !pos || (f >= pos.start && f <= pos.end);

  // Every scale note on the neck, in pitch order, for the play-through.
  const runNotes = useMemo(() => {
    const notes: { s: number; f: number; midi: number }[] = [];
    tuning.strings.forEach((open, s) => {
      for (let f = 0; f <= settings.frets; f++) {
        const midi = open + f;
        if (pcs.includes(mod12(midi)) && inWindow(f)) notes.push({ s, f, midi });
      }
    });
    // One fingering per pitch: keep the lowest string that reaches it inside the window.
    const byPitch = new Map<number, { s: number; f: number; midi: number }>();
    for (const n of notes) {
      const prev = byPitch.get(n.midi);
      if (!prev || (pos ? n.s > prev.s && n.f <= prev.f : n.f < prev.f)) byPitch.set(n.midi, n);
    }
    let list = [...byPitch.values()].sort((a, b) => a.midi - b.midi);
    if (!pos) {
      // Whole neck: two octaves up from the lowest root.
      const first = list.findIndex((n) => mod12(n.midi) === rootPc);
      list = list.slice(Math.max(0, first)).filter((n) => n.midi <= list[Math.max(0, first)].midi + 24);
    }
    return list;
  }, [pcs, pos?.start, tuning.id, settings.frets]);

  const play = () => {
    stopRun();
    if (!runNotes.length) return;
    const e = getEngine();
    const gap = 0.24;
    const seq = [...runNotes, ...runNotes.slice(0, -1).reverse()];
    const t0 = e.ctx.currentTime + 0.05;
    seq.forEach((n, i) => {
      playNote(n.midi, { time: t0 + i * gap, channel: 'scale-' + n.s, a4: settings.a4, velocity: 0.75 });
      timers.current.push(window.setTimeout(() => setPlaying({ s: n.s, f: n.f }), (0.05 + i * gap) * 1000));
    });
    timers.current.push(window.setTimeout(stopRun, (0.05 + seq.length * gap + 0.3) * 1000));
    setRunning(true);
    markActive();
  };

  const marks: FretMark[] = [];
  tuning.strings.forEach((open, s) => {
    for (let f = 0; f <= settings.frets; f++) {
      const pc = mod12(open + f);
      if (!pcs.includes(pc)) continue;
      const isPlaying = playing && playing.s === s && playing.f === f;
      marks.push({
        string: s,
        fret: f,
        role: isPlaying ? 'accent' : roleOf(pc),
        label: labelOf(pc),
        dim: !inWindow(f),
        pop: !!isPlaying,
      });
    }
  });

  const pianoMarks = new Map<number, PianoMark>();
  for (let m = 48; m <= 72; m++) {
    const pc = mod12(m);
    if (pcs.includes(pc)) pianoMarks.set(m, { role: roleOf(pc), label: names[pcs.indexOf(pc)] });
  }

  const relative = useMemo(() => {
    if (scaleId === 'major') return `Relative minor: ${pretty(names[5])} minor`;
    if (scaleId === 'minor') return `Relative major: ${pretty(names[2])} major`;
    if (scaleId === 'minor-pentatonic') return `Same notes as ${pretty(names[1])} major pentatonic`;
    if (scaleId === 'major-pentatonic') return `Same notes as ${pretty(names[4])} minor pentatonic`;
    return '';
  }, [scaleId, names]);

  return (
    <div class="stack">
      <ToolHeader
        id="scales"
        actions={
          <button class={`btn big ${running ? '' : 'primary'}`} type="button" onClick={running ? stopRun : play}>
            {running ? (
              <>
                <StopIcon /> Stop
              </>
            ) : (
              <>
                <PlayIcon /> Play {pos ? 'this position' : 'two octaves'}
              </>
            )}
          </button>
        }
      >
        Every note of a scale across the neck, coloured by its job: roots red, thirds blue, fifths green, sevenths purple. Narrow it to one hand position to learn it box by box.
      </ToolHeader>

      <section class="panel stack" style={{ gap: '14px' }}>
        <div class="controls" style={{ alignItems: 'flex-start' }}>
          <Field label="Key">
            <div class="chip-row">
              {COMMON_ROOT_NAMES.map((r) => (
                <button key={r} type="button" class="chip" aria-pressed={root === r} onClick={() => setRoot(r)}>
                  {pretty(r)}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Scale" htmlFor="scale-type" grow>
            <select id="scale-type" class="select" value={scaleId} onChange={(e) => (setScaleId(e.currentTarget.value), setPosition(-1))}>
              {SCALES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div class="controls">
          <Field label="Hand position">
            <div class="chip-row">
              <button type="button" class="chip" aria-pressed={position === -1} onClick={() => setPosition(-1)}>
                Whole neck
              </button>
              {positions.map((p, i) => (
                <button key={i} type="button" class="chip" aria-pressed={position === i} onClick={() => setPosition(i)} title={`Frets ${p.start}–${p.end}`}>
                  {i + 1} <span class="muted mono" style={{ fontSize: '0.7rem' }}>fr {p.start}</span>
                </button>
              ))}
            </div>
          </Field>
          <Field label="Labels">
            <Seg<LabelMode>
              value={labels}
              onChange={setLabels}
              options={[
                { value: 'notes', label: 'Notes' },
                { value: 'degrees', label: 'Degrees' },
                { value: 'none', label: 'Dots' },
              ]}
            />
          </Field>
        </div>
      </section>

      <section class="panel stack" style={{ gap: '10px' }}>
        <Fretboard
          tuning={tuning.strings}
          frets={settings.frets}
          leftHanded={settings.leftHanded}
          marks={marks}
          range={pos ? [pos.start, pos.end] : null}
          stringLabels={tuning.strings.map((_, i) => stringName(tuning, i))}
          onPress={(s, f) => {
            playNote(tuning.strings[s] + f, { channel: 'scale-' + s, a4: settings.a4 });
            markActive();
          }}
          ariaLabel={`${root} ${scale.name} on the fretboard`}
        />
      </section>

      <div class="grid-2">
        <section class="panel stack" style={{ gap: '12px' }}>
          <div>
            <span class="eyebrow">{scale.formula.length} notes</span>
            <h2>
              {pretty(root)} {scale.name}
            </h2>
            <p class="muted">{scale.mood}</p>
          </div>
          <div class="tone-row">
            {names.map((n, i) => (
              <span key={n + i} class={`tone ${roleForDegree(scale.degrees[i])}`}>
                <b>{pretty(n)}</b>
                <small>{pretty(scale.degrees[i].label === '1' ? 'R' : scale.degrees[i].label)}</small>
              </span>
            ))}
          </div>
          {relative && <p class="muted">{relative}.</p>}
          <div>
            <span class="eyebrow">On the keys</span>
            <div style={{ marginTop: '6px' }}>
              <Piano
                from={48}
                to={72}
                marks={pianoMarks}
                onPress={(m) => {
                  playNote(m, { channel: 'scale-piano', a4: settings.a4 });
                  markActive();
                }}
              />
            </div>
          </div>
        </section>

        <section class="panel stack" style={{ gap: '12px' }}>
          <h3>Chords in this scale</h3>
          {triads.length ? (
            <>
              <p class="muted">
                {parent === scale
                  ? 'Stack every other note and you get the scale’s own chords. Tap one to hear it.'
                  : `${scale.name} sits inside ${pretty(root)} ${parent!.name.toLowerCase()}, so it fits over these chords. Tap one to hear it.`}
              </p>
              <div class="triad-grid">
                {triads.map((t) => (
                  <button
                    key={t.roman}
                    type="button"
                    class="triad"
                    onClick={() => {
                      const v = bestVoicing(makeChord(t.root, t.typeId), tuning.strings);
                      if (v) strum(v.frets.map((f, i) => (f >= 0 ? tuning.strings[i] + f : null)), { a4: settings.a4, channelPrefix: 'scale-chord-' });
                      markActive();
                    }}
                  >
                    <span class="mono">{t.roman}</span>
                    <b>{pretty(t.symbol)}</b>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p class="muted">
              The whole-tone scale has no major or minor chords of its own: every triad it makes is augmented. Use it over a dominant 7th chord with a raised fifth for that dream-sequence sound.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
