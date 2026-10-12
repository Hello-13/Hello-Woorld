import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { getEngine } from '../audio/engine';
import { playNote, stopChannels } from '../audio/guitar';
import { click } from '../audio/kit';
import { MicInput } from '../audio/mic';
import { detectPitch } from '../audio/pitch';
import { Transport } from '../audio/scheduler';
import { Fretboard, type FretMark } from '../components/Fretboard';
import { Field, MicIcon, PlayIcon, Seg, SpeakerIcon, StopIcon, ToolHeader } from '../components/ui';
import { markActive, recordTab, usePractice } from '../state/practice';
import { useSettings, useTuning } from '../state/settings';
import { getTune, prepareTune, TUNES, type ParsedMelody } from '../theory/melody';
import { freqToMidi, pcName, pretty } from '../theory/notes';
import { stringName } from '../theory/tunings';

type Mode = 'listen' | 'along' | 'wait';
type Result = 'hit' | 'miss' | undefined;

const BEAT_W = 58;
const X0 = 46;
const LINE = 18;
const TOP = 20;
const NOTE_PAD = 10;

function TabStaff(props: {
  melody: ParsedMelody;
  strings: number;
  current: number;
  results: Result[];
  playheadRef: { current: SVGLineElement | null };
  scrollRef: { current: HTMLDivElement | null };
  onNote: (i: number) => void;
}) {
  const { melody, strings } = props;
  const width = X0 + melody.totalBeats * BEAT_W + 40;
  const bottom = TOP + LINE * (strings - 1);
  const height = bottom + 34;
  const lineY = (s: number) => TOP + (strings - 1 - s) * LINE;
  return (
    <div class="tab-scroll" ref={props.scrollRef}>
      <svg class="tab-staff" viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label="Tablature">
        {Array.from({ length: strings }, (_, k) => (
          <line key={k} x1={8} x2={width - 10} y1={TOP + k * LINE} y2={TOP + k * LINE} class="tab-line" />
        ))}
        {['T', 'A', 'B'].map((ch, i) => (
          <text key={ch} x={22} y={TOP + LINE * (strings / 2 - 1.5 + i * 1.05) + 5} class="tab-clef" text-anchor="middle">
            {ch}
          </text>
        ))}
        {melody.bars.slice(1).map((b) => (
          <line key={'bar' + b} x1={X0 + b * BEAT_W - 6} x2={X0 + b * BEAT_W - 6} y1={TOP} y2={bottom} class="tab-bar" />
        ))}
        <line x1={width - 16} x2={width - 16} y1={TOP} y2={bottom} class="tab-bar" />
        <line x1={width - 11} x2={width - 11} y1={TOP} y2={bottom} class="tab-bar" stroke-width={3} />
        {melody.notes.map((n, i) => {
          const x = X0 + n.at * BEAT_W + NOTE_PAD;
          if (n.midi === null || n.string === undefined) {
            return (
              <text key={i} x={x} y={(TOP + bottom) / 2 + 5} class="tab-rest" text-anchor="middle">
                𝄽
              </text>
            );
          }
          const y = lineY(n.string);
          const label = String(n.fret);
          const w = label.length * 8 + 8;
          const state = i === props.current ? 'current' : props.results[i] ?? '';
          return (
            <g key={i} class={`tab-note ${state}`} onClick={() => props.onNote(i)}>
              <rect x={x - w / 2} y={y - 9} width={w} height={18} rx={4} />
              <text x={x} y={y + 4.5} text-anchor="middle">
                {label}
              </text>
              <line x1={x - 4} x2={x - 4 + Math.max(6, n.beats * BEAT_W - 14)} y1={bottom + 16} y2={bottom + 16} class="tab-len" />
            </g>
          );
        })}
        <line ref={props.playheadRef} x1={0} x2={0} y1={TOP - 12} y2={bottom + 12} class="tab-playhead" style={{ transform: `translateX(${X0}px)`, opacity: 0 }} />
      </svg>
    </div>
  );
}

export function TabTrainer() {
  const settings = useSettings();
  const tuning = useTuning();
  const practice = usePractice();
  const [tuneId, setTuneId] = useState('ode');
  const [mode, setMode] = useState<Mode>('listen');
  const tune = getTune(tuneId);
  const [bpm, setBpm] = useState(tune.bpm);
  const [loop, setLoop] = useState(false);
  const [guide, setGuide] = useState(false);
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState(-1);
  const [results, setResults] = useState<Result[]>([]);
  const [summary, setSummary] = useState<{ percent: number; best: boolean } | null>(null);
  const [micOn, setMicOn] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [heard, setHeard] = useState<number | null>(null);
  const [wrongFlash, setWrongFlash] = useState<FretMark | null>(null);
  const transport = useRef<Transport | null>(null);
  const mic = useRef<MicInput | null>(null);
  const playheadRef = useRef<SVGLineElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const live = useRef({ current, results, loop });
  live.current = { current, results, loop };
  const endTimer = useRef<number | undefined>(undefined);

  const melody = useMemo(() => prepareTune(tune, tuning.strings), [tuneId, tuning.id]);
  const playableCount = melody.notes.filter((n) => n.midi !== null).length;
  const best = practice.tabBest[tuneId];

  const resetRun = () => {
    clearTimeout(endTimer.current);
    transport.current?.stop();
    transport.current = null;
    stopChannels('tab-');
    setRunning(false);
    setCurrent(-1);
    if (playheadRef.current) playheadRef.current.style.opacity = '0';
  };

  useEffect(() => {
    resetRun();
    setResults([]);
    setSummary(null);
    setBpm(tune.bpm);
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  }, [tuneId, tuning.id]);

  useEffect(() => {
    resetRun();
    setResults([]);
    setSummary(null);
    if (mode === 'wait') setCurrent(firstPlayable(0));
  }, [mode]);

  useEffect(() => () => {
    transport.current?.stop();
    mic.current?.close();
  }, []);

  useEffect(() => {
    if (transport.current) transport.current.bpm = bpm;
  }, [bpm]);

  function firstPlayable(from: number): number {
    for (let i = from; i < melody.notes.length; i++) if (melody.notes[i].midi !== null) return i;
    return -1;
  }

  const toggleMic = async () => {
    if (micOn) {
      mic.current?.close();
      mic.current = null;
      setMicOn(false);
      setHeard(null);
      return;
    }
    setMicError(null);
    try {
      mic.current = await MicInput.open();
      setMicOn(true);
    } catch (e) {
      setMicError((e as Error).message + (mode === 'wait' ? ' You can still tap the notes on the fretboard.' : ''));
    }
  };

  const finish = (res: Result[]) => {
    const hits = res.filter((r) => r === 'hit').length;
    const percent = Math.round((100 * hits) / Math.max(1, playableCount));
    const isBest = recordTab(tuneId, percent);
    setSummary({ percent, best: isBest });
  };

  // ── Listen and play-along: a transport on a sixteenth-note grid ──
  const start = () => {
    setSummary(null);
    setResults([]);
    const e = getEngine();
    const countIn = mode === 'along' ? tune.beatsPerBar * 4 : 0;
    const totalSteps = Math.round(melody.totalBeats * 4);
    const byStep = new Map<number, number[]>();
    melody.notes.forEach((n, i) => {
      const s = Math.round(n.at * 4);
      byStep.set(s, [...(byStep.get(s) ?? []), i]);
    });
    const tr = new Transport({ now: () => e.ctx.currentTime }, { bpm, stepsPerBeat: 4 });
    tr.onStep = (step, time) => {
      if (step < countIn) {
        if (step % 4 === 0) click(time, step === 0 ? 'accent' : 'beat', 'wood');
        return;
      }
      let s = step - countIn;
      if (s >= totalSteps) {
        if (!live.current.loop) {
          if (s === totalSteps) {
            const delay = Math.max(0, (time - e.ctx.currentTime) * 1000) + 300;
            endTimer.current = window.setTimeout(() => {
              const res = [...live.current.results];
              // Anything not heard by the end counts as missed.
              melody.notes.forEach((n, i) => n.midi !== null && res[i] === undefined && (res[i] = 'miss'));
              resetRun();
              // Only a run the mic was scoring has a score.
              if (mode === 'along' && mic.current) {
                setResults(res);
                finish(res);
              }
            }, delay);
          }
          return;
        }
        s %= totalSteps;
      }
      if (mode === 'along' && s % 4 === 0) click(time, (s / 4) % tune.beatsPerBar === 0 ? 'accent' : 'beat', 'wood');
      for (const i of byStep.get(s) ?? []) {
        const n = melody.notes[i];
        if (n.midi === null) continue;
        if (mode === 'listen' || guide) {
          playNote(n.midi, { time, channel: 'tab-' + n.string, duration: n.beats * (60 / tr.bpm) * 0.97, a4: settings.a4, velocity: mode === 'listen' ? 0.8 : 0.45 });
        }
      }
    };
    tr.start(0.12);
    transport.current = tr;
    setRunning(true);
    markActive();
  };

  // Follow the transport: move the playhead, track the current note, score what the mic hears.
  useEffect(() => {
    if (!running || mode === 'wait') return;
    let raf = 0;
    let frame = 0;
    let lastIdx = -1;
    let stable = 0;
    const countIn = mode === 'along' ? tune.beatsPerBar : 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const tr = transport.current;
      if (!tr) return;
      const t = getEngine().ctx.currentTime;
      const ev = tr.stepAt(t);
      if (!ev) return;
      let beat = ev.step / 4 + (t - ev.time) / (60 / tr.bpm) - countIn;
      if (beat < 0) return;
      if (live.current.loop && beat >= melody.totalBeats) beat %= melody.totalBeats;
      const x = X0 + beat * BEAT_W + NOTE_PAD;
      if (playheadRef.current) {
        playheadRef.current.style.transform = `translateX(${x.toFixed(1)}px)`;
        playheadRef.current.style.opacity = '1';
      }
      const sc = scrollRef.current;
      if (sc) {
        const target = x - sc.clientWidth * 0.3;
        if (Math.abs(sc.scrollLeft - target) > 4) sc.scrollLeft = target;
      }
      let idx = -1;
      for (let i = 0; i < melody.notes.length; i++) if (melody.notes[i].at <= beat + 1e-6) idx = i;
      if (idx !== lastIdx) {
        // A new pass of a loop starts clean.
        if (idx < lastIdx) setResults([]);
        else if (mode === 'along' && mic.current && lastIdx >= 0) {
          const prevIdx = lastIdx;
          if (melody.notes[prevIdx].midi !== null) setResults((r) => (r[prevIdx] ? r : Object.assign([...r], { [prevIdx]: 'miss' as Result })));
        }
        lastIdx = idx;
        stable = 0;
        setCurrent(idx);
        markActive();
      }
      if (mode === 'along' && mic.current && frame++ % 2 === 0 && idx >= 0) {
        const r = detectPitch(mic.current.read(), mic.current.sampleRate);
        const m = r && r.clarity > 0.85 ? Math.round(freqToMidi(r.freq, settings.a4)) : null;
        setHeard(m);
        if (m !== null && m === melody.notes[idx].midi) {
          if (++stable >= 2) setResults((res) => (res[idx] === 'hit' ? res : Object.assign([...res], { [idx]: 'hit' as Result })));
        } else stable = 0;
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [running, mode, melody]);

  // ── Wait-for-me: advance only when the right note is played (mic) or tapped ──
  const advance = (hit: boolean) => {
    const i = live.current.current;
    if (i < 0) return;
    const res = Object.assign([...live.current.results], { [i]: hit ? 'hit' : live.current.results[i] ?? 'miss' }) as Result[];
    setResults(res);
    const next = firstPlayable(i + 1);
    setCurrent(next);
    markActive();
    if (next < 0) finish(res);
  };

  useEffect(() => {
    if (mode !== 'wait' || !micOn) return;
    let raf = 0;
    let frame = 0;
    let stable = 0;
    let lastIdx = -1;
    const loopFn = () => {
      raf = requestAnimationFrame(loopFn);
      if (!mic.current || frame++ % 2) return;
      const i = live.current.current;
      if (i !== lastIdx) {
        lastIdx = i;
        stable = 0;
      }
      const r = detectPitch(mic.current.read(), mic.current.sampleRate);
      const m = r && r.clarity > 0.85 ? Math.round(freqToMidi(r.freq, settings.a4)) : null;
      setHeard(m);
      if (i >= 0 && m !== null && m === melody.notes[i].midi) {
        if (++stable >= 3) {
          stable = -6; // ignore the same ringing note for a moment
          advance(true);
        }
      } else if (stable > 0) stable = 0;
      else if (stable < 0) stable++;
    };
    raf = requestAnimationFrame(loopFn);
    return () => cancelAnimationFrame(raf);
  }, [mode, micOn, melody]);

  // Keep the current note in view while waiting.
  useEffect(() => {
    if (mode !== 'wait' || current < 0 || !scrollRef.current) return;
    const x = X0 + melody.notes[current].at * BEAT_W;
    scrollRef.current.scrollTo({ left: x - scrollRef.current.clientWidth * 0.3, behavior: 'smooth' });
  }, [current, mode]);

  const onFret = (s: number, f: number) => {
    const midi = tuning.strings[s] + f;
    playNote(midi, { channel: 'tab-tap-' + s, a4: settings.a4 });
    markActive();
    if (mode !== 'wait' || current < 0) return;
    if (midi === melody.notes[current].midi) advance(true);
    else {
      setWrongFlash({ string: s, fret: f, role: 'bad', label: pcName(midi, settings.flats), pop: true });
      setTimeout(() => setWrongFlash(null), 500);
    }
  };

  const restartWait = () => {
    setResults([]);
    setSummary(null);
    setCurrent(firstPlayable(0));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || (e.target as HTMLElement).closest('input, select, textarea, button')) return;
      e.preventDefault();
      if (mode === 'wait') {
        const n = melody.notes[current];
        if (n?.midi != null) playNote(n.midi, { channel: 'tab-hint', a4: settings.a4 });
      } else running ? resetRun() : start();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const marks: FretMark[] = [];
  const upcoming = melody.notes
    .map((n, i) => ({ n, i }))
    .filter(({ n, i }) => i > current && n.midi !== null)
    .slice(0, 2);
  for (const { n } of upcoming.reverse()) marks.push({ string: n.string!, fret: n.fret!, role: 'ghost', label: pcName(n.midi!, settings.flats) });
  const cur = current >= 0 ? melody.notes[current] : null;
  if (cur && cur.midi !== null) marks.push({ string: cur.string!, fret: cur.fret!, role: 'accent', label: pcName(cur.midi, settings.flats), pop: true });
  if (wrongFlash) marks.push(wrongFlash);

  const hits = results.filter((r) => r === 'hit').length;
  const maxFret = Math.max(5, ...melody.notes.filter((n) => n.fret !== undefined).map((n) => n.fret!));

  return (
    <div class="stack">
      <ToolHeader
        id="tab"
        actions={
          mode === 'wait' ? (
            <button class={`btn big ${micOn ? '' : 'primary'}`} type="button" onClick={toggleMic}>
              <MicIcon /> {micOn ? 'Stop listening' : 'Listen with the mic'}
            </button>
          ) : (
            <button class={`btn big ${running ? '' : 'primary'}`} type="button" onClick={running ? resetRun : start}>
              {running ? (
                <>
                  <StopIcon /> Stop
                </>
              ) : (
                <>
                  <PlayIcon /> {mode === 'listen' ? 'Play it to me' : 'Count me in'}
                </>
              )}
            </button>
          )
        }
      >
        Melodies and warm-ups written as tab: each line is a string (high e on top) and each number is the fret to press. Listen first, play along with the click, or let it wait for you note by note.
      </ToolHeader>

      {micError && <div class="notice bad">{micError}</div>}

      <section class="panel stack" style={{ gap: '12px' }}>
        <div class="panel-head" style={{ marginBottom: 0 }}>
          <div>
            <h2>{tune.name}</h2>
            <p class="muted" style={{ fontSize: '0.88rem' }}>
              {tune.credit} · {tune.beatsPerBar}/4
            </p>
          </div>
          <div class="tab-status mono" aria-live="polite">
            {summary ? (
              <span class={summary.percent >= 80 ? 'good-text' : ''}>
                {summary.percent}% of notes{summary.best ? ' · new best' : ''}
              </span>
            ) : mode === 'wait' ? (
              current >= 0 ? (
                `note ${melody.notes.slice(0, current + 1).filter((n) => n.midi !== null).length} of ${playableCount}`
              ) : (
                'done'
              )
            ) : mode === 'along' && micOn ? (
              `${hits} hit`
            ) : best !== undefined ? (
              `best ${best}%`
            ) : (
              ''
            )}
            {(micOn || heard !== null) && (
              <span class="muted">
                {' '}
                · hearing {heard !== null ? pretty(pcName(heard, settings.flats)) + (Math.floor(heard / 12) - 1) : '…'}
              </span>
            )}
          </div>
        </div>
        <TabStaff
          melody={melody}
          strings={tuning.strings.length}
          current={current}
          results={results}
          playheadRef={playheadRef}
          scrollRef={scrollRef}
          onNote={(i) => {
            const n = melody.notes[i];
            if (n.midi !== null) playNote(n.midi, { channel: 'tab-hint', a4: settings.a4 });
            if (mode === 'wait') setCurrent(i);
          }}
        />
        {mode === 'wait' && (
          <div class="row">
            <button
              class="btn"
              type="button"
              disabled={!cur || cur.midi === null}
              onClick={() => cur?.midi != null && playNote(cur.midi, { channel: 'tab-hint', a4: settings.a4 })}
            >
              <SpeakerIcon /> Hear this note
            </button>
            <button class="btn" type="button" disabled={current < 0} onClick={() => advance(false)}>
              Skip
            </button>
            <button class="btn" type="button" onClick={restartWait}>
              From the top
            </button>
            {!micOn && <span class="muted" style={{ fontSize: '0.88rem' }}>Tap the glowing fret below, or turn on the mic and play it.</span>}
          </div>
        )}
      </section>

      <section class="panel">
        <Fretboard
          tuning={tuning.strings}
          frets={Math.min(settings.frets, Math.max(7, maxFret + 2))}
          leftHanded={settings.leftHanded}
          marks={marks}
          onPress={onFret}
          stringLabels={tuning.strings.map((_, i) => stringName(tuning, i))}
          ariaLabel="Where to play the current note"
        />
      </section>

      <section class="panel stack" style={{ gap: '14px' }}>
        <div class="controls">
          <Field label="Tune" htmlFor="tab-tune" grow>
            <select id="tab-tune" class="select" value={tuneId} onChange={(e) => setTuneId(e.currentTarget.value)}>
              <optgroup label="Melodies">
                {TUNES.filter((t) => t.kind === 'melody').map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {practice.tabBest[t.id] !== undefined ? ` (best ${practice.tabBest[t.id]}%)` : ''}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Exercises">
                {TUNES.filter((t) => t.kind === 'exercise').map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {practice.tabBest[t.id] !== undefined ? ` (best ${practice.tabBest[t.id]}%)` : ''}
                  </option>
                ))}
              </optgroup>
            </select>
          </Field>
          <Field label="Mode">
            <Seg<Mode>
              value={mode}
              onChange={setMode}
              options={[
                { value: 'listen', label: 'Listen' },
                { value: 'along', label: 'Play along' },
                { value: 'wait', label: 'Wait for me' },
              ]}
            />
          </Field>
        </div>
        {mode !== 'wait' && (
          <div class="controls">
            <Field label={`Tempo: ${bpm} BPM`} htmlFor="tab-bpm" grow>
              <input id="tab-bpm" class="range" type="range" min={40} max={180} value={bpm} onInput={(e) => setBpm(Number(e.currentTarget.value))} />
            </Field>
            <label class="toggle">
              <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.currentTarget.checked)} />
              Loop
            </label>
            {mode === 'along' && (
              <>
                <label class="toggle">
                  <input type="checkbox" checked={guide} onChange={(e) => setGuide(e.currentTarget.checked)} />
                  Play the melody quietly too
                </label>
                <button class="btn" type="button" onClick={toggleMic}>
                  <MicIcon /> {micOn ? 'Mic on: scoring' : 'Score me with the mic'}
                </button>
              </>
            )}
          </div>
        )}
        <p class="muted" style={{ fontSize: '0.88rem' }}>
          {mode === 'listen'
            ? 'Hear the tune at your tempo while the playhead follows along. Tap any number to hear just that note.'
            : mode === 'along'
              ? 'One bar of clicks, then play with the playhead. With the mic on, every note you land turns green and you get a score at the end.'
              : 'No clock: the glowing fret waits until you play that note (mic) or tap it, then moves on. The best way to learn a new tune.'}
        </p>
      </section>
    </div>
  );
}
