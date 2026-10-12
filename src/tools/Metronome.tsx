import { useEffect, useRef, useState } from 'preact/hooks';
import { getEngine } from '../audio/engine';
import { click, type ClickSound } from '../audio/kit';
import { Transport } from '../audio/scheduler';
import { Field, PlayIcon, Seg, StopIcon, ToolHeader } from '../components/ui';
import { markActive, practiceStore } from '../state/practice';
import { TimingCheck } from './TimingCheck';

interface Meter {
  id: string;
  label: string;
  beats: number;
  /** Beats that start a group (get the accent). */
  accents: number[];
}

const METERS: Meter[] = [
  { id: '2/4', label: '2/4', beats: 2, accents: [0] },
  { id: '3/4', label: '3/4', beats: 3, accents: [0] },
  { id: '4/4', label: '4/4', beats: 4, accents: [0] },
  { id: '5/4', label: '5/4', beats: 5, accents: [0, 3] },
  { id: '6/8', label: '6/8', beats: 6, accents: [0, 3] },
  { id: '7/8', label: '7/8', beats: 7, accents: [0, 2, 4] },
  { id: '12/8', label: '12/8', beats: 12, accents: [0, 3, 6, 9] },
];

/** The Italian tempo words printed on mechanical metronomes. */
export function tempoMarking(bpm: number): string {
  if (bpm < 50) return 'Grave';
  if (bpm < 60) return 'Largo';
  if (bpm < 66) return 'Larghetto';
  if (bpm < 76) return 'Adagio';
  if (bpm < 108) return 'Andante';
  if (bpm < 120) return 'Moderato';
  if (bpm < 156) return 'Allegro';
  if (bpm < 176) return 'Vivace';
  if (bpm < 200) return 'Presto';
  return 'Prestissimo';
}

type BeatState = 'accent' | 'beat' | 'mute';

const MIN_BPM = 30;
const MAX_BPM = 300;
const clampBpm = (b: number) => Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(b)));

/** A pyramid metronome. The sliding weight sits higher for slower tempos, as on the real thing. */
/** Where a tempo sits on the pendulum: log-spaced like the printed Maelzel scale, slow at the top. */
function scaleY(bpm: number): number {
  return 64 + ((Math.log(bpm) - Math.log(MIN_BPM)) / (Math.log(MAX_BPM) - Math.log(MIN_BPM))) * 140;
}

function Pyramid(props: { bpm: number; armRef: { current: SVGGElement | null }; beatFlash: boolean }) {
  const weightY = scaleY(props.bpm);
  return (
    <svg viewBox="0 0 240 300" class="pyramid" role="img" aria-label={`Metronome at ${props.bpm} beats per minute`}>
      <defs>
        <linearGradient id="pyr-wood" x1="0" x2="1">
          <stop offset="0" style={{ stopColor: 'var(--board-2)' }} />
          <stop offset="0.5" style={{ stopColor: 'var(--board)' }} />
          <stop offset="1" style={{ stopColor: 'var(--board-2)' }} />
        </linearGradient>
      </defs>
      <path d="M120 14 L206 286 L34 286 Z" fill="url(#pyr-wood)" style={{ stroke: 'var(--board-shadow)' }} stroke-width="2" />
      <path d="M120 40 L176 230 L64 230 Z" style={{ fill: 'var(--surface)', opacity: 0.92 }} />
      {/* Tempo scale */}
      {[40, 60, 80, 100, 120, 160, 208].map((b) => {
        const y = scaleY(b);
        return (
          <g key={b}>
            <line x1="104" x2="112" y1={y} y2={y} style={{ stroke: 'var(--ink-3)' }} />
            <text x="100" y={y + 3} text-anchor="end" font-size="8" class="mono" style={{ fill: 'var(--ink-3)' }}>
              {b}
            </text>
          </g>
        );
      })}
      <g ref={props.armRef} style={{ transformOrigin: '120px 226px' }}>
        <line x1="120" y1="226" x2="120" y2="52" stroke-width="3.2" stroke-linecap="round" style={{ stroke: 'var(--fret)' }} />
        <rect x="109" y={weightY - 9} width="22" height="18" rx="3" style={{ fill: 'var(--ink)' }} />
        <line x1="111" x2="129" y1={weightY} y2={weightY} stroke-width="1.2" style={{ stroke: 'var(--bg)' }} />
      </g>
      <circle cx="120" cy="226" r="6" style={{ fill: 'var(--ink-2)' }} />
      <rect x="34" y="250" width="172" height="36" style={{ fill: 'var(--board-2)' }} />
      <circle cx="190" cy="268" r="6" style={{ fill: props.beatFlash ? 'var(--p-metro)' : 'var(--board)', transition: 'fill 0.05s' }} />
    </svg>
  );
}

export function Metronome() {
  const [bpm, setBpm] = useState(practiceStore.get().lastBpm || 90);
  const [meterId, setMeterId] = useState('4/4');
  const [sub, setSub] = useState(1);
  const [sound, setSound] = useState<ClickSound>('wood');
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(-1);
  const [states, setStates] = useState<BeatState[]>([]);
  const [trainer, setTrainer] = useState({ on: false, step: 5, every: 4, target: 140 });
  const [gap, setGap] = useState({ on: false, play: 2, mute: 2 });
  const [barCount, setBarCount] = useState(0);
  const [silent, setSilent] = useState(false);
  const transport = useRef<Transport | null>(null);
  const armRef = useRef<SVGGElement | null>(null);
  const taps = useRef<number[]>([]);
  const live = useRef({ bpm, states, sub, sound, trainer, gap, meterId });

  const meter = METERS.find((m) => m.id === meterId)!;

  useEffect(() => {
    setStates(Array.from({ length: meter.beats }, (_, i) => (meter.accents.includes(i) ? 'accent' : 'beat')));
  }, [meterId]);

  live.current = { bpm, states, sub, sound, trainer, gap, meterId };

  useEffect(() => {
    practiceStore.set({ lastBpm: bpm });
    if (transport.current) transport.current.bpm = bpm;
  }, [bpm]);

  useEffect(() => {
    if (transport.current) transport.current.stepsPerBeat = sub;
  }, [sub]);

  const stop = () => {
    transport.current?.stop();
    transport.current = null;
    setRunning(false);
    setBeat(-1);
    setSilent(false);
  };

  const start = () => {
    const e = getEngine();
    const tr = new Transport({ now: () => e.ctx.currentTime }, { bpm: live.current.bpm, stepsPerBeat: live.current.sub });
    let bar = 0;
    tr.onStep = (step, time) => {
      const L = live.current;
      const m = METERS.find((x) => x.id === L.meterId)!;
      const perBar = m.beats * tr.stepsPerBeat;
      const inBar = step % perBar;
      if (inBar === 0 && step > 0) {
        bar++;
        if (L.trainer.on && bar % L.trainer.every === 0 && tr.bpm < L.trainer.target) {
          const next = Math.min(L.trainer.target, tr.bpm + L.trainer.step);
          tr.bpm = next;
          setBpm(next);
        }
        setBarCount(bar);
      }
      const muted = L.gap.on && bar % (L.gap.play + L.gap.mute) >= L.gap.play;
      setSilent(muted);
      if (muted) return;
      const beatIndex = Math.floor(inBar / tr.stepsPerBeat);
      const subIndex = inBar % tr.stepsPerBeat;
      if (subIndex === 0) {
        const st = L.states[beatIndex] ?? 'beat';
        if (st !== 'mute') click(time, st === 'accent' ? 'accent' : 'beat', L.sound);
      } else {
        click(time, 'sub', L.sound);
      }
    };
    tr.start(0.1);
    transport.current = tr;
    setBarCount(0);
    setRunning(true);
    markActive();
  };

  // Animate beat lights and the pendulum from the audio clock.
  useEffect(() => {
    if (!running) {
      if (armRef.current) armRef.current.style.transform = 'rotate(0deg)';
      return;
    }
    let raf = 0;
    let lastBeat = -1;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const tr = transport.current;
      if (!tr) return;
      const t = getEngine().ctx.currentTime;
      const ev = tr.stepAt(t);
      if (!ev) return;
      const m = METERS.find((x) => x.id === live.current.meterId)!;
      const beatsSoFar = Math.floor(ev.step / tr.stepsPerBeat);
      const b = beatsSoFar % m.beats;
      if (b !== lastBeat) {
        lastBeat = b;
        setBeat(b);
        markActive();
      }
      const beatStartStep = beatsSoFar * tr.stepsPerBeat;
      const sinceStep = (ev.step - beatStartStep) * tr.stepDuration + (t - ev.time);
      const phase = beatsSoFar + sinceStep / (60 / tr.bpm);
      const angle = 26 * Math.cos(Math.PI * phase);
      if (armRef.current) armRef.current.style.transform = `rotate(${angle.toFixed(2)}deg)`;
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  useEffect(() => () => transport.current?.stop(), []);

  const tap = () => {
    const now = performance.now();
    const list = taps.current.filter((t) => now - t < 2500);
    list.push(now);
    taps.current = list.slice(-5);
    if (taps.current.length >= 2) {
      const gaps = taps.current.slice(1).map((t, i) => t - taps.current[i]);
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      setBpm(clampBpm(60000 / avg));
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, select, textarea')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        running ? stop() : start();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setBpm((b) => clampBpm(b + (e.shiftKey ? 5 : 1)));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setBpm((b) => clampBpm(b - (e.shiftKey ? 5 : 1)));
      } else if (e.key === 't' || e.key === 'T') {
        tap();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const cycle = (i: number) =>
    setStates((s) => s.map((x, k) => (k === i ? (x === 'accent' ? 'beat' : x === 'beat' ? 'mute' : 'accent') : x)));

  return (
    <div class="stack">
      <ToolHeader
        id="metronome"
        actions={
          <button class={`btn big ${running ? '' : 'primary'}`} type="button" onClick={running ? stop : start}>
            {running ? (
              <>
                <StopIcon /> Stop
              </>
            ) : (
              <>
                <PlayIcon /> Start
              </>
            )}
          </button>
        }
      >
        Keep time with a click that never drifts. <span class="kbd">Space</span> starts and stops, <span class="kbd">↑</span>
        <span class="kbd">↓</span> nudge the tempo and <span class="kbd">T</span> taps it in.
      </ToolHeader>

      <div class="metro-grid">
        <section class="panel metro-face">
          <Pyramid bpm={bpm} armRef={armRef} beatFlash={running && beat >= 0 && !silent} />
          <div class="metro-readout">
            <div class="bpm mono-num">{bpm}</div>
            <div class="eyebrow">BPM · {tempoMarking(bpm)}</div>
          </div>
          <div class="beat-lights" role="group" aria-label="Beats in the bar. Click a beat to accent or mute it.">
            {states.map((st, i) => (
              <button
                key={i}
                type="button"
                class={`beat-light ${st} ${beat === i ? 'now' : ''} ${silent ? 'silent' : ''}`}
                onClick={() => cycle(i)}
                title={`Beat ${i + 1}: ${st}. Click to change.`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          {silent && <p class="muted" style={{ textAlign: 'center' }}>Silent bar: keep counting.</p>}
        </section>

        <section class="panel stack" style={{ gap: '18px' }}>
          <div class="row" style={{ gap: '8px' }}>
            {[-5, -1].map((d) => (
              <button key={d} class="btn" type="button" onClick={() => setBpm((b) => clampBpm(b + d))}>
                {d}
              </button>
            ))}
            <input
              aria-label="Tempo"
              class="range"
              style={{ flex: 1, minWidth: '120px' }}
              type="range"
              min={MIN_BPM}
              max={MAX_BPM}
              value={bpm}
              onInput={(e) => setBpm(Number(e.currentTarget.value))}
            />
            {[1, 5].map((d) => (
              <button key={d} class="btn" type="button" onClick={() => setBpm((b) => clampBpm(b + d))}>
                +{d}
              </button>
            ))}
            <button class="btn" type="button" onClick={tap}>
              Tap tempo
            </button>
          </div>

          <div class="controls">
            <Field label="Time signature">
              <Seg value={meterId} onChange={setMeterId} options={METERS.map((m) => ({ value: m.id, label: m.label }))} />
            </Field>
            <Field label="Subdivision">
              <Seg
                value={sub}
                onChange={setSub}
                options={[
                  { value: 1, label: 'Beats', title: 'Quarter notes only' },
                  { value: 2, label: '8ths', title: 'Eighth notes' },
                  { value: 3, label: 'Triplets', title: 'Eighth-note triplets' },
                  { value: 4, label: '16ths', title: 'Sixteenth notes' },
                ]}
              />
            </Field>
            <Field label="Sound">
              <Seg<ClickSound>
                value={sound}
                onChange={setSound}
                options={[
                  { value: 'wood', label: 'Woodblock' },
                  { value: 'beep', label: 'Beep' },
                  { value: 'cowbell', label: 'Cowbell' },
                ]}
              />
            </Field>
          </div>

          <div class="trainer">
            <label class="toggle">
              <input type="checkbox" checked={trainer.on} onChange={(e) => setTrainer({ ...trainer, on: e.currentTarget.checked })} />
              Speed trainer
            </label>
            <p class="muted">
              Add{' '}
              <input class="input num" type="number" min={1} max={20} value={trainer.step} onInput={(e) => setTrainer({ ...trainer, step: Number(e.currentTarget.value) || 1 })} />{' '}
              BPM every{' '}
              <input class="input num" type="number" min={1} max={32} value={trainer.every} onInput={(e) => setTrainer({ ...trainer, every: Number(e.currentTarget.value) || 1 })} />{' '}
              bars, up to{' '}
              <input class="input num" type="number" min={MIN_BPM} max={MAX_BPM} value={trainer.target} onInput={(e) => setTrainer({ ...trainer, target: clampBpm(Number(e.currentTarget.value) || 120) })} />{' '}
              BPM.
            </p>
          </div>

          <div class="trainer">
            <label class="toggle">
              <input type="checkbox" checked={gap.on} onChange={(e) => setGap({ ...gap, on: e.currentTarget.checked })} />
              Silent bars
            </label>
            <p class="muted">
              Click for{' '}
              <input class="input num" type="number" min={1} max={16} value={gap.play} onInput={(e) => setGap({ ...gap, play: Number(e.currentTarget.value) || 1 })} /> bars, then
              go quiet for <input class="input num" type="number" min={1} max={16} value={gap.mute} onInput={(e) => setGap({ ...gap, mute: Number(e.currentTarget.value) || 1 })} /> bars.
              Land back on beat one with the click.
            </p>
          </div>
          <TimingCheck transport={transport} running={running} />
          {running && (
            <p class="mono muted" style={{ fontSize: '0.8rem' }}>
              Bar {barCount + 1}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
