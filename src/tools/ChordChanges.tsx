import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { getEngine } from '../audio/engine';
import { strum } from '../audio/guitar';
import { click } from '../audio/kit';
import { MicInput, OnsetDetector } from '../audio/mic';
import { rms } from '../audio/pitch';
import { Transport } from '../audio/scheduler';
import { ChordDiagram } from '../components/ChordDiagram';
import { Field, MicIcon, PlayIcon, Seg, StopIcon, ToolHeader } from '../components/ui';
import { markActive, practiceStore, recordChanges, usePractice, type ChangesResult } from '../state/practice';
import { useSettings, useTuning } from '../state/settings';
import { parseChordSymbol } from '../theory/chords';
import { pretty } from '../theory/notes';
import { bestVoicing } from '../theory/voicings';

const CHORDS = ['A', 'Am', 'A7', 'Asus2', 'B7', 'C', 'C7', 'Cadd9', 'D', 'Dm', 'D7', 'Dsus4', 'E', 'Em', 'E7', 'Em7', 'F', 'Fmaj7', 'G', 'G7'];
const CLASSIC: [string, string][] = [
  ['A', 'D'],
  ['D', 'E'],
  ['A', 'E'],
  ['C', 'G'],
  ['G', 'D'],
  ['Em', 'C'],
  ['Am', 'E'],
  ['C', 'F'],
  ['G', 'Em'],
  ['Am', 'Dm'],
];

/** Illustrative two weeks of runs, shown (and labelled) until the player has their own. */
const EXAMPLE_RUNS: ChangesResult[] = [18, 21, 20, 25, 27, 26, 31, 33, 32, 37, 40, 43].map((count, i) => ({
  pair: 'example',
  count,
  at: new Date(2026, 0, 1 + i).toISOString(),
}));

export function pairKey(a: string, b: string): string {
  return [a, b].sort().join('–');
}

type Phase = 'idle' | 'countdown' | 'running' | 'done';
type Method = 'tap' | 'listen';

function niceMax(v: number): number {
  const steps = [10, 20, 30, 40, 50, 60, 80, 100, 120, 150, 200];
  return steps.find((s) => s >= v) ?? Math.ceil(v / 50) * 50;
}

/** Changes per run for one chord pair, oldest to newest. */
function RunsChart(props: { runs: ChangesResult[]; example?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const runs = props.runs.slice(-12);
  const W = 360;
  const H = 150;
  const pad = { l: 30, r: 18, t: 18, b: 22 };
  const max = niceMax(Math.max(...runs.map((r) => r.count), 1));
  const x = (i: number) => pad.l + (runs.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (runs.length - 1));
  const y = (v: number) => H - pad.b - (v / max) * (H - pad.t - pad.b);
  const best = runs.reduce((b, r, i) => (r.count > runs[b].count ? i : b), 0);
  const line = runs.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(r.count).toFixed(1)}`).join(' ');
  const area = `${line} L${x(runs.length - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z`;
  const last = runs.length - 1;
  return (
    <div class={`runs-chart ${props.example ? 'example' : ''}`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Changes per minute over the last ${runs.length} runs`}>
        {[0, max / 2, max].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke-width="1" style={{ stroke: 'var(--line)' }} />
            <text x={pad.l - 6} y={y(t) + 3.5} text-anchor="end" font-size="10" class="mono" style={{ fill: 'var(--ink-3)' }}>
              {t}
            </text>
          </g>
        ))}
        <path d={area} style={{ fill: 'var(--p-changes)', opacity: 0.1 }} />
        <path d={line} fill="none" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" style={{ stroke: 'var(--p-changes)' }} />
        {runs.map((r, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(r.count)} r={i === last || i === best || i === hover ? 5 : 3.5} stroke-width="2" style={{ fill: 'var(--p-changes)', stroke: 'var(--surface)' }} />
            <circle
              cx={x(i)}
              cy={y(r.count)}
              r={14}
              fill="transparent"
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              style={{ cursor: 'default' }}
            />
          </g>
        ))}
        {/* Direct labels: the best run and the latest one only */}
        {[...new Set([best, last])].map((i) => (
          <text
            key={'l' + i}
            x={x(i)}
            y={y(runs[i].count) - 10}
            text-anchor={x(i) > W - 60 ? 'end' : x(i) < pad.l + 30 ? 'start' : 'middle'}
            font-size="11"
            font-weight="600"
            style={{ fill: 'var(--ink)' }}
          >
            {i === best && i === last ? `${runs[i].count} · best` : i === best ? `best ${runs[i].count}` : runs[i].count}
          </text>
        ))}
      </svg>
      {hover !== null && (
        <div class="chart-tip" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(runs[hover].count) / H) * 100}%` }}>
          {runs[hover].count} changes · {new Date(runs[hover].at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </div>
      )}
    </div>
  );
}

export function ChordChanges() {
  const settings = useSettings();
  const tuning = useTuning();
  const practice = usePractice();
  const [a, setA] = useState('A');
  const [b, setB] = useState('D');
  const [seconds, setSeconds] = useState(60);
  const [method, setMethod] = useState<Method>('tap');
  const [clickOn, setClickOn] = useState(false);
  const [bpm, setBpm] = useState(60);
  const [phase, setPhase] = useState<Phase>('idle');
  const [left, setLeft] = useState(60);
  const [count, setCount] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [micError, setMicError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ count: number; best: boolean } | null>(null);
  const endAt = useRef(0);
  const mic = useRef<MicInput | null>(null);
  const transport = useRef<Transport | null>(null);
  const countRef = useRef(0);

  const key = pairKey(a, b);
  const runs = practice.changes.filter((c) => c.pair === key);
  const best = runs.reduce((m, r) => Math.max(m, r.count), 0);
  const voicings = useMemo(
    () => [a, b].map((sym) => bestVoicing(parseChordSymbol(sym)!, tuning.strings)),
    [a, b, tuning.id],
  );

  const bump = () => {
    if (phase !== 'running') return;
    countRef.current++;
    setCount(countRef.current);
    markActive();
  };

  const cleanup = () => {
    mic.current?.close();
    mic.current = null;
    transport.current?.stop();
    transport.current = null;
  };
  useEffect(() => cleanup, []);

  const finish = () => {
    cleanup();
    const n = countRef.current;
    const prevBest = practiceStore.get().changes.filter((c) => c.pair === key).reduce((m, r) => Math.max(m, r.count), 0);
    // Scale shorter or longer runs to a per-minute figure so results compare.
    const perMinute = Math.round((n * 60) / seconds);
    recordChanges(key, perMinute);
    setLastResult({ count: perMinute, best: perMinute > prevBest });
    setPhase('done');
  };

  const begin = async () => {
    setMicError(null);
    if (method === 'listen') {
      try {
        mic.current = await MicInput.open();
      } catch (e) {
        setMicError((e as Error).message + ' Switched to tapping instead.');
        setMethod('tap');
      }
    }
    countRef.current = 0;
    setCount(0);
    setLastResult(null);
    setCountdown(3);
    setPhase('countdown');
    const e = getEngine();
    const t0 = e.ctx.currentTime + 0.1;
    [0, 1, 2].forEach((i) => click(t0 + i * 0.8, i === 0 ? 'accent' : 'beat', 'wood'));
    click(t0 + 2.4, 'accent', 'cowbell');
    setTimeout(() => setCountdown(2), 900);
    setTimeout(() => setCountdown(1), 1700);
    setTimeout(() => {
      endAt.current = performance.now() + seconds * 1000;
      setLeft(seconds);
      setPhase('running');
      if (clickOn) {
        const tr = new Transport({ now: () => e.ctx.currentTime }, { bpm, stepsPerBeat: 1 });
        tr.onStep = (step, time) => click(time, step % 4 === 0 ? 'accent' : 'beat', 'wood');
        tr.start(0.02);
        transport.current = tr;
      }
    }, 2500);
  };

  // Clock and (optionally) the strum counter.
  useEffect(() => {
    if (phase !== 'running') return;
    const detector = new OnsetDetector(1.6, 0.025, 180);
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const remaining = Math.max(0, (endAt.current - now) / 1000);
      setLeft(remaining);
      if (mic.current) {
        const level = rms(mic.current.read());
        if (detector.push(level, now)) bump();
      }
      if (remaining <= 0) {
        cancelAnimationFrame(raf);
        finish();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || (e.target as HTMLElement).closest('input, select, textarea')) return;
      e.preventDefault();
      if (phase === 'running') bump();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const target = count % 2 === 0 ? 0 : 1;
  const busy = phase === 'countdown' || phase === 'running';

  const playChord = (i: number) => {
    const v = voicings[i];
    if (v) strum(v.frets.map((f, s) => (f >= 0 ? tuning.strings[s] + f : null)), { a4: settings.a4, channelPrefix: 'chg-' });
    markActive();
  };

  return (
    <div class="stack">
      <ToolHeader
        id="changes"
        actions={
          busy ? (
            <button
              class="btn big"
              type="button"
              onClick={() => {
                cleanup();
                setPhase('idle');
              }}
            >
              <StopIcon /> Abandon run
            </button>
          ) : (
            <button class="btn big primary" type="button" onClick={begin}>
              <PlayIcon /> Start {seconds} seconds
            </button>
          )
        }
      >
        The drill guitar teachers swear by. Switch between two chords for a minute, strumming once each time you land. Count every change by tapping the big pad (or the space bar), or let the mic count your strums. Beat your score next time.
      </ToolHeader>

      {micError && <div class="notice bad">{micError}</div>}

      <section class={`panel changes-stage phase-${phase}`}>
        {[0, 1].map((i) => {
          const sym = i === 0 ? a : b;
          const v = voicings[i];
          return (
            <button key={i} type="button" class={`changes-chord ${busy && phase === 'running' && target === i ? 'target' : ''}`} onClick={() => !busy && playChord(i)} disabled={busy}>
              <span class="jam-chord small">{pretty(sym)}</span>
              {v && <ChordDiagram frets={v.frets} fingers={v.fingers} barres={v.barres} tuning={tuning.strings} rootPc={parseChordSymbol(sym)!.rootPc} width={150} />}
              {!busy && <span class="muted" style={{ fontSize: '0.8rem' }}>Tap to hear</span>}
            </button>
          );
        })}
        <div class="changes-pad-wrap">
          {phase === 'countdown' ? (
            <div class="count-in">{countdown}</div>
          ) : (
            <button type="button" class="changes-pad" onPointerDown={(e) => (e.preventDefault(), bump())} disabled={phase !== 'running'} aria-label="Count a change">
              <span class="pad-count">{phase === 'done' && lastResult ? lastResult.count : count}</span>
              <span class="pad-label">
                {phase === 'running'
                  ? method === 'listen' && mic.current
                    ? 'listening for strums'
                    : 'tap each change'
                  : phase === 'done'
                    ? lastResult?.best
                      ? 'new best per minute!'
                      : 'changes per minute'
                    : 'changes'}
              </span>
              {phase === 'running' && <span class="pad-time mono">{Math.ceil(left)}s</span>}
            </button>
          )}
        </div>
      </section>

      <div class="grid-2">
        <section class="panel stack" style={{ gap: '14px' }}>
          <div class="controls">
            <Field label="First chord" htmlFor="chg-a">
              <select id="chg-a" class="select" value={a} disabled={busy} onChange={(e) => setA(e.currentTarget.value)}>
                {CHORDS.map((c) => (
                  <option key={c} value={c}>
                    {pretty(c)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Second chord" htmlFor="chg-b">
              <select id="chg-b" class="select" value={b} disabled={busy} onChange={(e) => setB(e.currentTarget.value)}>
                {CHORDS.map((c) => (
                  <option key={c} value={c}>
                    {pretty(c)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Classic pairs">
            <div class="chip-row">
              {CLASSIC.map(([x, y]) => (
                <button
                  key={x + y}
                  type="button"
                  class="chip"
                  disabled={busy}
                  aria-pressed={pairKey(x, y) === key}
                  onClick={() => {
                    setA(x);
                    setB(y);
                  }}
                >
                  {pretty(x)} ↔ {pretty(y)}
                </button>
              ))}
            </div>
          </Field>
          <div class="controls">
            <Field label="Length">
              <Seg value={seconds} onChange={(v) => !busy && setSeconds(v)} options={[30, 60, 120].map((s) => ({ value: s, label: `${s}s` }))} />
            </Field>
            <Field label="Count by">
              <Seg<Method>
                value={method}
                onChange={(v) => !busy && setMethod(v)}
                options={[
                  { value: 'tap', label: 'Tapping' },
                  {
                    value: 'listen',
                    label: (
                      <>
                        <MicIcon /> Strums
                      </>
                    ),
                  },
                ]}
              />
            </Field>
          </div>
          <div class="row">
            <label class="toggle">
              <input type="checkbox" checked={clickOn} disabled={busy} onChange={(e) => setClickOn(e.currentTarget.checked)} />
              Click along at
            </label>
            <input class="input num" type="number" min={30} max={200} value={bpm} disabled={busy} onInput={(e) => setBpm(Math.max(30, Math.min(200, Number(e.currentTarget.value) || 60)))} />
            <span class="muted">BPM</span>
          </div>
        </section>

        <section class="panel stack" style={{ gap: '10px' }}>
          <div class="panel-head" style={{ marginBottom: 0 }}>
            <h3>
              {pretty(a)} ↔ {pretty(b)} progress
            </h3>
            <span class="muted mono" style={{ fontSize: '0.8rem' }}>
              {runs.length ? `best ${best}/min · ${runs.length} run${runs.length > 1 ? 's' : ''}` : 'no runs yet'}
            </span>
          </div>
          {runs.length ? (
            <>
              <RunsChart runs={runs} />
              <details>
                <summary class="muted" style={{ cursor: 'pointer', fontSize: '0.85rem' }}>
                  Show runs as a table
                </summary>
                <table class="runs-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Changes / min</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...runs].reverse().slice(0, 20).map((r) => (
                      <tr key={r.at}>
                        <td>{new Date(r.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                        <td class="mono">{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </>
          ) : (
            <>
              <RunsChart example runs={EXAMPLE_RUNS} />
              <p class="muted">
                <span class="example-tag">Example</span> Your own runs for this pair will chart here. Most players start around 15–25 changes a minute and pass 50 within a few weeks of daily runs.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
