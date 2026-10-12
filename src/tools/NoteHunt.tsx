import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { playNote } from '../audio/guitar';
import { click } from '../audio/kit';
import { getEngine } from '../audio/engine';
import { MicInput } from '../audio/mic';
import { detectPitch } from '../audio/pitch';
import { Fretboard, type FretMark } from '../components/Fretboard';
import { Field, MicIcon, PlayIcon, Seg, StopIcon, ToolHeader } from '../components/ui';
import { huntHeat, markActive, practiceStore, recordHunt, recordHuntAnswer, usePractice } from '../state/practice';
import { useSettings, useTuning } from '../state/settings';
import { freqToMidi, mod12, pcName, pretty, SHARP_NAMES, FLAT_NAMES } from '../theory/notes';
import { makeRandom } from '../audio/pluck';
import { stringName } from '../theory/tunings';

type Mode = 'find' | 'name' | 'play';
type Phase = 'idle' | 'running' | 'over';

interface Question {
  s: number;
  f: number;
  midi: number;
  askedAt: number;
}

const NATURALS = new Set([0, 2, 4, 5, 7, 9, 11]);
const ROUND_SECONDS = 60;

export function noteLabel(pc: number): string {
  return SHARP_NAMES[pc] === FLAT_NAMES[pc] ? SHARP_NAMES[pc] : `${SHARP_NAMES[pc]}/${FLAT_NAMES[pc]}`;
}

/** Points for a right answer: base 10, up to 10 more for speed, times the combo multiplier. */
export function huntPoints(ms: number, streak: number): number {
  const speed = Math.max(0, Math.round(10 - ms / 400));
  const mult = streak >= 10 ? 3 : streak >= 5 ? 2 : 1;
  return (10 + speed) * mult;
}

export function NoteHunt() {
  const settings = useSettings();
  const tuning = useTuning();
  const practice = usePractice();
  const [mode, setMode] = useState<Mode>('find');
  const [maxFret, setMaxFret] = useState(5);
  const [naturalsOnly, setNaturalsOnly] = useState(true);
  const [phase, setPhase] = useState<Phase>('idle');
  const [q, setQ] = useState<Question | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [right, setRight] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const [left, setLeft] = useState(ROUND_SECONDS);
  const [flash, setFlash] = useState<{ marks: FretMark[]; good: boolean } | null>(null);
  const [floating, setFloating] = useState<{ id: number; text: string } | null>(null);
  const [newBest, setNewBest] = useState(false);
  const [showHeat, setShowHeat] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [heard, setHeard] = useState<number | null>(null);
  const endAt = useRef(0);
  const rand = useRef(makeRandom(Date.now() % 100000));
  const mic = useRef<MicInput | null>(null);
  const live = useRef({ q, streak, phase });
  live.current = { q, streak, phase };
  const scoreRef = useRef(0);

  const modeKey = `${mode}:${maxFret}:${naturalsOnly ? 'nat' : 'all'}`;
  const best = practice.huntBest[modeKey] ?? 0;

  const positions = useMemo(() => {
    const list: { s: number; f: number }[] = [];
    tuning.strings.forEach((open, s) => {
      for (let f = 0; f <= maxFret; f++) if (!naturalsOnly || NATURALS.has(mod12(open + f))) list.push({ s, f });
    });
    return list;
  }, [tuning.id, maxFret, naturalsOnly]);

  const nextQuestion = (prev: Question | null) => {
    let pick = positions[Math.floor(rand.current() * positions.length)];
    for (let tries = 0; tries < 8 && prev && pick.s === prev.s && pick.f === prev.f; tries++) {
      pick = positions[Math.floor(rand.current() * positions.length)];
    }
    setQ({ s: pick.s, f: pick.f, midi: tuning.strings[pick.s] + pick.f, askedAt: performance.now() });
  };

  const start = async () => {
    setMicError(null);
    if (mode === 'play' && !mic.current) {
      try {
        mic.current = await MicInput.open();
      } catch (e) {
        setMicError((e as Error).message + ' Try “Find it” or “Name it” instead.');
        return;
      }
    }
    getEngine();
    scoreRef.current = 0;
    setScore(0);
    setStreak(0);
    setRight(0);
    setWrong(0);
    setTimes([]);
    setNewBest(false);
    setShowHeat(false);
    setFlash(null);
    endAt.current = performance.now() + ROUND_SECONDS * 1000;
    setLeft(ROUND_SECONDS);
    setPhase('running');
    nextQuestion(null);
    markActive();
  };

  const endGame = () => {
    setPhase('over');
    setQ(null);
    mic.current?.close();
    mic.current = null;
    setNewBest(recordHunt(modeKey, scoreRef.current));
  };

  const stopEarly = () => {
    mic.current?.close();
    mic.current = null;
    setPhase('idle');
    setQ(null);
  };

  useEffect(() => () => mic.current?.close(), []);

  const answer = (correct: boolean, shown: FretMark[]) => {
    const cur = live.current.q;
    if (!cur) return;
    const ms = performance.now() - cur.askedAt;
    recordHuntAnswer(`${cur.s}:${cur.f}`, correct, ms);
    markActive();
    if (correct) {
      const st = live.current.streak + 1;
      const pts = huntPoints(ms, st);
      scoreRef.current += pts;
      setScore(scoreRef.current);
      setStreak(st);
      setRight((x) => x + 1);
      setTimes((t) => [...t, ms]);
      setFloating({ id: Date.now(), text: `+${pts}${st >= 5 ? ` ×${st >= 10 ? 3 : 2}` : ''}` });
      playNote(cur.midi, { channel: 'hunt', a4: settings.a4, velocity: 0.7 });
    } else {
      setStreak(0);
      setWrong((x) => x + 1);
      click(getEngine().ctx.currentTime, 'sub', 'beep');
    }
    setFlash({ marks: shown, good: correct });
    setTimeout(() => setFlash(null), correct ? 350 : 900);
    nextQuestion(cur);
  };

  // Game clock, plus listening in play mode.
  useEffect(() => {
    if (phase !== 'running') return;
    let raf = 0;
    let stable = 0;
    let frame = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const remaining = Math.max(0, (endAt.current - performance.now()) / 1000);
      // Tenths are plenty for the timer bar and spare the fretboard sixty re-renders a second.
      setLeft(Math.ceil(remaining * 10) / 10);
      if (remaining <= 0) {
        cancelAnimationFrame(raf);
        endGame();
        return;
      }
      if (mic.current && frame++ % 2 === 0) {
        const r = detectPitch(mic.current.read(), mic.current.sampleRate);
        const cur = live.current.q;
        if (r && r.clarity > 0.85 && cur) {
          const m = Math.round(freqToMidi(r.freq, settings.a4));
          setHeard(m);
          // Wait for a fresh note after the question appears, then hold it briefly.
          if (m === cur.midi && performance.now() - cur.askedAt > 150) {
            if (++stable >= 3) {
              stable = 0;
              answer(true, [{ string: cur.s, fret: cur.f, role: 'good', label: pcName(cur.midi, settings.flats) }]);
            }
          } else stable = 0;
        } else {
          stable = 0;
          if (!r) setHeard(null);
        }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const onFret = (s: number, f: number) => {
    if (phase !== 'running' || !q) {
      playNote(tuning.strings[s] + f, { channel: 'hunt-' + s, a4: settings.a4 });
      return;
    }
    if (mode !== 'find') return;
    const correct = s === q.s && mod12(tuning.strings[s] + f) === mod12(q.midi);
    const shown: FretMark[] = correct
      ? [{ string: s, fret: f, role: 'good', label: pcName(q.midi, settings.flats) }]
      : [
          { string: s, fret: f, role: 'bad', label: pcName(tuning.strings[s] + f, settings.flats) },
          { string: q.s, fret: q.f, role: 'good', label: pcName(q.midi, settings.flats) },
        ];
    answer(correct, shown);
  };

  const onName = (pc: number) => {
    if (phase !== 'running' || !q) return;
    const correct = pc === mod12(q.midi);
    answer(correct, [{ string: q.s, fret: q.f, role: correct ? 'good' : 'bad', label: pcName(q.midi, settings.flats) }]);
  };

  const heat = useMemo(() => {
    const h: Record<string, number> = {};
    for (const [k, st] of Object.entries(practice.huntStats)) if (st.seen > 0) h[k] = huntHeat(st);
    return h;
  }, [practice.huntStats]);

  const marks: FretMark[] = [];
  if (phase === 'running' && q && mode === 'name') marks.push({ string: q.s, fret: q.f, role: 'accent', label: '?', pop: true });
  if (flash) marks.push(...flash.marks.map((m) => ({ ...m, pop: true })));

  const accuracy = right + wrong ? Math.round((100 * right) / (right + wrong)) : 0;
  const avgMs = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  const stringNo = (s: number) => tuning.strings.length - s;
  const weakest = Object.entries(heat)
    .filter(([k]) => Number(k.split(':')[1]) <= settings.frets)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .filter(([, v]) => v > 0.3);

  return (
    <div class="stack">
      <ToolHeader
        id="hunt"
        actions={
          phase === 'running' ? (
            <button class="btn big" type="button" onClick={stopEarly}>
              <StopIcon /> Stop
            </button>
          ) : (
            <button class="btn big primary" type="button" onClick={start}>
              <PlayIcon /> {phase === 'over' ? 'Play again' : 'Start a round'}
            </button>
          )
        }
      >
        Sixty seconds, as many notes as you can. Answers in a row build a combo (×2 after five, ×3 after ten). Start with the first five frets and natural notes, then widen the hunt.
      </ToolHeader>

      {micError && <div class="notice bad">{micError}</div>}

      <section class={`panel hunt-stage ${flash ? (flash.good ? 'flash-good' : 'flash-bad') : ''}`}>
        <div class="hunt-hud">
          <div class="stat">
            <span class="value">{score}</span>
            <span class="label">score</span>
          </div>
          <div class="stat">
            <span class="value">{streak}</span>
            <span class="label">streak</span>
          </div>
          <div class="stat">
            <span class="value">{best}</span>
            <span class="label">best</span>
          </div>
          <div class="hunt-timer" aria-label={`${Math.ceil(left)} seconds left`}>
            <div class="hunt-timer-fill" style={{ width: `${(left / ROUND_SECONDS) * 100}%` }} />
            <span class="mono">{phase === 'running' ? `${Math.ceil(left)}s` : `${ROUND_SECONDS}s`}</span>
          </div>
        </div>

        <div class="hunt-question" aria-live="polite">
          {phase === 'running' && q ? (
            mode === 'name' ? (
              <>
                <span class="muted">Name the note at the</span>
                <span class="hunt-target">?</span>
              </>
            ) : (
              <>
                <span class="muted">{mode === 'play' ? 'Play' : 'Find'}</span>
                <span class="hunt-target">{pretty(noteLabel(mod12(q.midi)))}</span>
                <span class="muted">
                  on string {stringNo(q.s)} ({pretty(stringName(tuning, q.s))})
                </span>
                {mode === 'play' && (
                  <span class="mono muted heard">
                    <MicIcon /> {heard !== null ? `hearing ${pretty(pcName(heard, settings.flats))}${Math.floor(heard / 12) - 1}` : 'listening…'}
                  </span>
                )}
              </>
            )
          ) : phase === 'over' ? (
            <div class="hunt-result">
              <span class="hunt-target">{score}</span>
              <span>{newBest ? 'New best for this setup!' : best ? `Best is ${best}.` : ''}</span>
              <span class="muted">
                {right} right · {wrong} wrong · {accuracy}% · {avgMs ? (avgMs / 1000).toFixed(1) + ' s per note' : '–'}
              </span>
            </div>
          ) : (
            <span class="muted">Press start. The first note appears straight away.</span>
          )}
          {floating && phase === 'running' && (
            <span key={floating.id} class="float-points">
              {floating.text}
            </span>
          )}
        </div>

        <Fretboard
          tuning={tuning.strings}
          frets={Math.max(maxFret, 5) <= 5 ? 7 : Math.min(settings.frets, Math.max(12, maxFret))}
          leftHanded={settings.leftHanded}
          marks={marks}
          onPress={onFret}
          range={[0, maxFret]}
          heat={showHeat && phase !== 'running' ? heat : undefined}
          stringLabels={tuning.strings.map((_, i) => stringName(tuning, i))}
          ariaLabel="Note Hunt fretboard"
        />

        {mode === 'name' && (
          <div class="name-pad">
            {Array.from({ length: 12 }, (_, pc) => (
              <button key={pc} type="button" class="btn" disabled={phase !== 'running' || (naturalsOnly && !NATURALS.has(pc))} onClick={() => onName(pc)}>
                {pretty(noteLabel(pc))}
              </button>
            ))}
          </div>
        )}
      </section>

      <div class="grid-2">
        <section class="panel stack" style={{ gap: '14px' }}>
          <Field label="Game">
            <Seg<Mode>
              value={mode}
              onChange={(m) => phase !== 'running' && setMode(m)}
              options={[
                { value: 'find', label: 'Find it' },
                { value: 'name', label: 'Name it' },
                {
                  value: 'play',
                  label: (
                    <>
                      <MicIcon /> Play it
                    </>
                  ),
                },
              ]}
            />
          </Field>
          <p class="muted" style={{ fontSize: '0.9rem' }}>
            {mode === 'find'
              ? 'A note and a string appear. Tap the fret where that note lives.'
              : mode === 'name'
                ? 'A dot appears on the neck. Pick its name from the buttons.'
                : 'A note and a string appear. Play it on your guitar and the mic checks the pitch (exact octave).'}
          </p>
          <div class="controls">
            <Field label="Frets">
              <Seg value={maxFret} onChange={(v) => phase !== 'running' && setMaxFret(v)} options={[5, 7, 12].map((n) => ({ value: n, label: `0–${n}` }))} />
            </Field>
            <label class="toggle">
              <input type="checkbox" checked={naturalsOnly} disabled={phase === 'running'} onChange={(e) => setNaturalsOnly(e.currentTarget.checked)} />
              Natural notes only
            </label>
          </div>
        </section>

        <section class="panel stack" style={{ gap: '12px' }}>
          <div class="panel-head" style={{ marginBottom: 0 }}>
            <h3>Weak spots</h3>
            <label class="toggle">
              <input type="checkbox" checked={showHeat} disabled={phase === 'running'} onChange={(e) => setShowHeat(e.currentTarget.checked)} />
              Show heat map
            </label>
          </div>
          {Object.keys(heat).length ? (
            <>
              <p class="muted" style={{ fontSize: '0.9rem' }}>
                Every answer is logged by position. Red frets are the ones you miss or take longest on; green ones are solid.
              </p>
              {weakest.length > 0 && (
                <p>
                  Practise next:{' '}
                  {weakest
                    .map(([k]) => {
                      const [s, f] = k.split(':').map(Number);
                      return `${pretty(pcName(tuning.strings[s] + f, settings.flats))} on string ${stringNo(s)} (fret ${f})`;
                    })
                    .join(', ')}
                  .
                </p>
              )}
              <button
                class="btn"
                type="button"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => {
                  practiceStore.set({ huntStats: {} });
                  setShowHeat(false);
                }}
              >
                Reset the map
              </button>
            </>
          ) : (
            <p class="muted">Play a round and your slow and missed positions show up here as a heat map on the neck.</p>
          )}
        </section>
      </div>
    </div>
  );
}
