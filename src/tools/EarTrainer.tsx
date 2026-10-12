import { useEffect, useRef, useState } from 'preact/hooks';
import { getEngine } from '../audio/engine';
import { arpeggiate, playNote, strum } from '../audio/guitar';
import { makeRandom } from '../audio/pluck';
import { Field, PlayIcon, Seg, SpeakerIcon, ToolHeader } from '../components/ui';
import { markActive, practiceStore, recordEar, usePractice } from '../state/practice';
import { useSettings, useTuning } from '../state/settings';
import { getChordType, makeChord } from '../theory/chords';
import { INTERVALS } from '../theory/intervals';
import { pcName, pretty } from '../theory/notes';
import { stringName } from '../theory/tunings';
import { bestVoicing, voicingMidi } from '../theory/voicings';

type Mode = 'intervals' | 'chords' | 'strings';
type Direction = 'up' | 'down' | 'together';

interface Option {
  id: string;
  label: string;
  hint?: string;
}

const INTERVAL_SETS: Record<string, number[]> = {
  starter: [4, 5, 7, 12],
  steps: [1, 2, 3, 4],
  octave: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
};

const CHORD_SETS: Record<string, string[]> = {
  majmin: ['maj', 'min'],
  triads: ['maj', 'min', 'dim', 'aug'],
  sus: ['maj', 'min', 'sus2', 'sus4'],
  sevenths: ['7', 'maj7', 'm7', 'm7b5'],
};

interface Q {
  mode: Mode;
  answer: string;
  play: () => void;
  /** Shown after answering. */
  reveal: string;
}

export function EarTrainer() {
  const settings = useSettings();
  const tuning = useTuning();
  const practice = usePractice();
  const [mode, setMode] = useState<Mode>('intervals');
  const [intervalSet, setIntervalSet] = useState('starter');
  const [direction, setDirection] = useState<Direction>('up');
  const [chordSet, setChordSet] = useState('majmin');
  const [q, setQ] = useState<Q | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [session, setSession] = useState({ right: 0, total: 0, streak: 0 });
  const [autoNext, setAutoNext] = useState(true);
  const rand = useRef(makeRandom(Date.now() % 99991));
  const timer = useRef<number | undefined>(undefined);

  const options: Option[] =
    mode === 'intervals'
      ? INTERVAL_SETS[intervalSet].map((s) => ({ id: String(s), label: INTERVALS[s].name, hint: INTERVALS[s].short }))
      : mode === 'chords'
        ? CHORD_SETS[chordSet].map((id) => ({ id, label: getChordType(id).name.replace(/^./, (c) => c.toUpperCase()), hint: getChordType(id).symbol || 'maj' }))
        : tuning.strings.map((_, i) => ({ id: String(i), label: `String ${tuning.strings.length - i}`, hint: stringName(tuning, i) }));

  const statKey = (id: string) => `${mode}:${id}`;

  const makeQuestion = (): Q => {
    const r = rand.current;
    const a4 = settings.a4;
    if (mode === 'intervals') {
      const set = INTERVAL_SETS[intervalSet];
      const semis = set[Math.floor(r() * set.length)];
      const root = 45 + Math.floor(r() * 12); // A2 … G#3
      const lo = direction === 'down' ? root + semis : root;
      const hi = direction === 'down' ? root : root + semis;
      const info = INTERVALS[semis];
      return {
        mode,
        answer: String(semis),
        reveal: `${info.name} (${info.short}): think “${info.song}”. ${pretty(pcName(lo, settings.flats))} to ${pretty(pcName(hi, settings.flats))}.`,
        play: () => {
          const t = getEngine().ctx.currentTime + 0.05;
          if (direction === 'together') {
            playNote(lo, { time: t, channel: 'ear-a', a4 });
            playNote(hi, { time: t, channel: 'ear-b', a4 });
          } else {
            playNote(lo, { time: t, channel: 'ear-a', a4, duration: 0.9 });
            playNote(hi, { time: t + 0.75, channel: 'ear-b', a4 });
          }
        },
      };
    }
    if (mode === 'chords') {
      const set = CHORD_SETS[chordSet];
      const typeId = set[Math.floor(r() * set.length)];
      const roots = ['C', 'D', 'E', 'F', 'G', 'A', 'Bb'];
      const root = roots[Math.floor(r() * roots.length)];
      const chord = makeChord(root, typeId);
      const v = bestVoicing(chord, tuning.strings);
      const t = getChordType(typeId);
      return {
        mode,
        answer: typeId,
        reveal: `${pretty(root + t.symbol)}: ${t.name}, built ${t.formula.map((f) => pretty(f)).join(' ')}.`,
        play: () => {
          if (!v) return;
          strum(
            v.frets.map((f, i) => (f >= 0 ? tuning.strings[i] + f : null)),
            { a4, channelPrefix: 'ear-' },
          );
          const e = getEngine();
          arpeggiate(voicingMidi(v.frets, tuning.strings), { time: e.ctx.currentTime + 1.6, gap: 0.2, a4 });
        },
      };
    }
    const s = Math.floor(r() * tuning.strings.length);
    return {
      mode,
      answer: String(s),
      reveal: `String ${tuning.strings.length - s}, ${pretty(stringName(tuning, s))}. Lower strings sound thicker and ring longer.`,
      play: () => playNote(tuning.strings[s], { channel: 'ear-s', a4 }),
    };
  };

  const next = () => {
    clearTimeout(timer.current);
    const nq = makeQuestion();
    setQ(nq);
    setPicked(null);
    nq.play();
    markActive();
  };

  // A new question set means a fresh start.
  useEffect(() => {
    clearTimeout(timer.current);
    setQ(null);
    setPicked(null);
  }, [mode, intervalSet, direction, chordSet, tuning.id]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const choose = (id: string) => {
    if (!q || picked) return;
    const correct = id === q.answer;
    setPicked(id);
    recordEar(statKey(q.answer), correct);
    setSession((s) => ({ right: s.right + (correct ? 1 : 0), total: s.total + 1, streak: correct ? s.streak + 1 : 0 }));
    markActive();
    if (correct && autoNext) timer.current = window.setTimeout(next, 1500);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, select, textarea')) return;
      const n = Number(e.key);
      if (n >= 1 && n <= options.length) {
        choose(options[n - 1].id);
      } else if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        if (!q || picked) next();
        else q.play();
      } else if (e.key === 'r' || e.key === 'R') {
        q?.play();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const stats = options.map((o) => ({ ...o, stat: practice.ear[statKey(o.id)] ?? { right: 0, total: 0 } }));

  return (
    <div class="stack">
      <ToolHeader id="ear">
        Hear it, name it. Every answer teaches you a reference song, so the sound sticks. Number keys answer, <span class="kbd">Space</span> plays the next one and <span class="kbd">R</span> repeats.
      </ToolHeader>

      <section class="panel stack" style={{ gap: '14px' }}>
        <div class="controls">
          <Field label="Train">
            <Seg<Mode>
              value={mode}
              onChange={setMode}
              options={[
                { value: 'intervals', label: 'Intervals' },
                { value: 'chords', label: 'Chord qualities' },
                { value: 'strings', label: 'Open strings' },
              ]}
            />
          </Field>
          {mode === 'intervals' && (
            <>
              <Field label="Set">
                <Seg
                  value={intervalSet}
                  onChange={setIntervalSet}
                  options={[
                    { value: 'starter', label: 'Starter' },
                    { value: 'steps', label: 'Small steps' },
                    { value: 'octave', label: 'All 12' },
                  ]}
                />
              </Field>
              <Field label="Played">
                <Seg<Direction>
                  value={direction}
                  onChange={setDirection}
                  options={[
                    { value: 'up', label: 'Rising' },
                    { value: 'down', label: 'Falling' },
                    { value: 'together', label: 'Together' },
                  ]}
                />
              </Field>
            </>
          )}
          {mode === 'chords' && (
            <Field label="Set">
              <Seg
                value={chordSet}
                onChange={setChordSet}
                options={[
                  { value: 'majmin', label: 'Major vs minor' },
                  { value: 'triads', label: 'Four triads' },
                  { value: 'sus', label: 'Sus chords' },
                  { value: 'sevenths', label: 'Sevenths' },
                ]}
              />
            </Field>
          )}
        </div>
      </section>

      <section class="panel ear-stage">
        <div class="ear-top">
          {q && !picked ? (
            <button class="btn big" type="button" onClick={() => q.play()}>
              <SpeakerIcon /> Hear it again
            </button>
          ) : (
            <button class="btn big primary" type="button" onClick={next}>
              <PlayIcon /> {q ? 'Next sound' : 'Play the first sound'}
            </button>
          )}
          <div class="ear-score mono">
            {session.right}/{session.total}
            {session.streak >= 3 ? ` · ${session.streak} in a row` : ''}
          </div>
        </div>

        <div class="answer-grid" role="group" aria-label="Answers">
          {options.map((o, i) => {
            const state = !picked || !q ? '' : o.id === q.answer ? 'right' : o.id === picked ? 'wrong' : 'dim';
            return (
              <button key={o.id} type="button" class={`answer ${state}`} disabled={!q || !!picked} onClick={() => choose(o.id)}>
                <span class="answer-key mono">{i + 1}</span>
                <b>{o.label}</b>
                {o.hint && <span class="mono muted">{pretty(o.hint)}</span>}
              </button>
            );
          })}
        </div>

        <div class="ear-reveal" aria-live="polite">
          {q && picked ? (
            <p>
              <strong class={picked === q.answer ? 'good-text' : 'bad-text'}>{picked === q.answer ? 'Yes.' : 'Not quite.'}</strong> {q.reveal}
            </p>
          ) : (
            <p class="muted">{q ? 'Listen, then pick an answer.' : 'Turn your speakers up a little, then press play.'}</p>
          )}
          <label class="toggle" style={{ fontSize: '0.85rem' }}>
            <input type="checkbox" checked={autoNext} onChange={(e) => setAutoNext(e.currentTarget.checked)} />
            Move on automatically after a right answer
          </label>
        </div>
      </section>

      <section class="panel stack" style={{ gap: '10px' }}>
        <div class="panel-head" style={{ marginBottom: 0 }}>
          <h3>Your accuracy</h3>
          <button
            class="btn"
            type="button"
            onClick={() => {
              const keep = Object.fromEntries(Object.entries(practiceStore.get().ear).filter(([k]) => !k.startsWith(mode + ':')));
              practiceStore.set({ ear: keep });
            }}
          >
            Reset {mode === 'intervals' ? 'intervals' : mode === 'chords' ? 'chords' : 'strings'}
          </button>
        </div>
        <div class="meters">
          {stats.map((s) => {
            const pct = s.stat.total ? Math.round((100 * s.stat.right) / s.stat.total) : 0;
            return (
              <div key={s.id} class="meter-row">
                <span class="meter-label">{s.label}</span>
                <div class="meter-track" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${s.label} accuracy`}>
                  <div class="meter-fill" style={{ width: `${pct}%` }} />
                </div>
                <span class="mono meter-value">{s.stat.total ? `${pct}% · ${s.stat.total}` : '–'}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
