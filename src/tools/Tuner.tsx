import { useEffect, useRef, useState } from 'preact/hooks';
import { playNote } from '../audio/guitar';
import { MicInput } from '../audio/mic';
import { detectPitch, PitchSmoother } from '../audio/pitch';
import { MicIcon, Seg, SpeakerIcon, StopIcon, ToolHeader, Field } from '../components/ui';
import { markActive } from '../state/practice';
import { settingsStore, useSettings, useTuning } from '../state/settings';
import { freqToMidi, midiName, midiOctave, midiToFreq, pcName, pretty } from '../theory/notes';
import { stringName, TUNINGS, tuningLabel } from '../theory/tunings';

type Mode = 'strings' | 'chromatic';

interface Reading {
  freq: number;
  rms: number;
}

const GAUGE_SWEEP = 62; // degrees either side of centre for ±50 cents

function Gauge(props: { cents: number | null; inTune: boolean }) {
  const cx = 170;
  const cy = 182;
  const r = 134;
  const angleFor = (c: number) => (Math.max(-50, Math.min(50, c)) / 50) * GAUGE_SWEEP;
  const ticks = [];
  for (let c = -50; c <= 50; c += 5) {
    const a = ((angleFor(c) - 90) * Math.PI) / 180;
    const major = c % 25 === 0;
    const mid = c % 10 === 0;
    const len = major ? 18 : mid ? 12 : 7;
    ticks.push(
      <line
        key={c}
        x1={cx + Math.cos(a) * r}
        y1={cy + Math.sin(a) * r}
        x2={cx + Math.cos(a) * (r - len)}
        y2={cy + Math.sin(a) * (r - len)}
        style={{ stroke: c === 0 ? 'var(--good)' : 'var(--ink-2)' }}
        stroke-width={major ? 2.4 : 1.4}
      />,
    );
    if (major) {
      ticks.push(
        <text key={'t' + c} x={cx + Math.cos(a) * (r + 18)} y={cy + Math.sin(a) * (r + 18) + 4} text-anchor="middle" class="mono" font-size="11" style={{ fill: 'var(--ink-3)' }}>
          {c > 0 ? '+' + c : c}
        </text>,
      );
    }
  }
  const zoneA = ((angleFor(-5) - 90) * Math.PI) / 180;
  const zoneB = ((angleFor(5) - 90) * Math.PI) / 180;
  const needle = props.cents === null ? 0 : angleFor(props.cents);
  return (
    <svg viewBox="0 0 340 200" class="tuner-gauge" role="img" aria-label={props.cents === null ? 'No pitch' : `${Math.round(props.cents)} cents`}>
      <path
        d={`M ${cx + Math.cos(zoneA) * (r + 6)} ${cy + Math.sin(zoneA) * (r + 6)} A ${r + 6} ${r + 6} 0 0 1 ${cx + Math.cos(zoneB) * (r + 6)} ${cy + Math.sin(zoneB) * (r + 6)}`}
        fill="none"
        stroke-width="7"
        stroke-linecap="round"
        style={{ stroke: 'var(--good)', opacity: props.inTune ? 1 : 0.35 }}
      />
      {ticks}
      <g style={{ transform: `rotate(${needle}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: 'transform 0.12s linear', opacity: props.cents === null ? 0.25 : 1 }}>
        <line x1={cx} y1={cy} x2={cx} y2={cy - r + 4} stroke-width="3" stroke-linecap="round" style={{ stroke: props.inTune ? 'var(--good)' : 'var(--accent)' }} />
      </g>
      <circle cx={cx} cy={cy} r="9" style={{ fill: 'var(--ink)' }} />
    </svg>
  );
}

/** Strobe bands drift left when flat and right when sharp, and stand still in tune, like a strobe tuner. */
function Strobe(props: { centsRef: { current: number | null } }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current!;
    const g = c.getContext('2d');
    if (!g) return;
    let raf = 0;
    let phase = 0;
    let last = performance.now();
    const draw = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const dpr = window.devicePixelRatio || 1;
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (c.width !== Math.round(w * dpr)) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const style = getComputedStyle(c);
      const ink = style.getPropertyValue('--strobe-ink').trim() || '#000';
      const bg = style.getPropertyValue('--strobe-bg').trim() || '#fff';
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      const cents = props.centsRef.current;
      if (cents !== null) phase += Math.max(-60, Math.min(60, cents)) * dt * 3.2;
      g.fillStyle = ink;
      const bands = [
        { y: 0, hgt: h * 0.34, period: 40, speed: 1 },
        { y: h * 0.36, hgt: h * 0.3, period: 20, speed: 2 },
        { y: h * 0.68, hgt: h * 0.32, period: 10, speed: 4 },
      ];
      g.globalAlpha = cents === null ? 0.18 : 0.9;
      for (const b of bands) {
        const off = ((phase * b.speed) % b.period + b.period) % b.period;
        for (let x = -b.period + off; x < w; x += b.period) g.fillRect(x, b.y, b.period / 2, b.hgt);
      }
      g.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvas} class="strobe" aria-hidden="true" />;
}

export function Tuner() {
  const settings = useSettings();
  const tuning = useTuning();
  const [mode, setMode] = useState<Mode>('strings');
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState<Reading | null>(null);
  const [level, setLevel] = useState(0);
  const [tuned, setTuned] = useState<number[]>([]);
  const [repeatString, setRepeatString] = useState<number | null>(null);
  const mic = useRef<MicInput | null>(null);
  const centsRef = useRef<number | null>(null);
  const inTuneSince = useRef<{ s: number; t: number } | null>(null);

  // Reset progress when the tuning changes.
  useEffect(() => setTuned([]), [tuning.id]);

  const a4 = settings.a4;
  const midiF = reading ? freqToMidi(reading.freq, a4) : null;
  let target: number | null = null;
  let stringIndex: number | null = null;
  if (midiF !== null) {
    if (mode === 'strings') {
      let best = 0;
      tuning.strings.forEach((m, i) => {
        if (Math.abs(m - midiF) < Math.abs(tuning.strings[best] - midiF)) best = i;
      });
      if (Math.abs(tuning.strings[best] - midiF) <= 4) {
        target = tuning.strings[best];
        stringIndex = best;
      }
    }
    if (target === null) target = Math.round(midiF);
  }
  const cents = midiF !== null && target !== null ? (midiF - target) * 100 : null;
  const inTune = cents !== null && Math.abs(cents) < 4;
  centsRef.current = cents;

  // A string counts as tuned after holding within ±4 cents for 0.7 s.
  useEffect(() => {
    if (stringIndex === null || !inTune) {
      inTuneSince.current = null;
      return;
    }
    const now = performance.now();
    if (!inTuneSince.current || inTuneSince.current.s !== stringIndex) inTuneSince.current = { s: stringIndex, t: now };
    else if (now - inTuneSince.current.t > 700 && !tuned.includes(stringIndex)) setTuned((t) => [...t, stringIndex!]);
  });

  const stop = () => {
    mic.current?.close();
    mic.current = null;
    setListening(false);
    setReading(null);
    setLevel(0);
  };

  useEffect(() => {
    if (!listening) return;
    const smoother = new PitchSmoother(5, 450);
    let raf = 0;
    let frame = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!mic.current || frame++ % 2) return;
      const buf = mic.current.read();
      const r = detectPitch(buf, mic.current.sampleRate);
      const now = performance.now();
      const f = smoother.push(r && r.clarity > 0.82 ? r.freq : null, now);
      if (r) markActive();
      setLevel((l) => Math.max(r?.rms ?? 0, l * 0.85));
      setReading(f ? { freq: f, rms: r?.rms ?? 0 } : null);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [listening]);

  useEffect(() => () => mic.current?.close(), []);

  useEffect(() => {
    if (repeatString === null) return;
    const play = () => playNote(tuning.strings[repeatString], { channel: 'tuner-ref', a4, velocity: 0.85 });
    play();
    const id = setInterval(play, 2400);
    return () => clearInterval(id);
  }, [repeatString, a4, tuning.id]);

  const start = async () => {
    setError(null);
    try {
      mic.current = await MicInput.open();
      setListening(true);
      setRepeatString(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const noteText = target !== null ? pretty(pcName(target, tuning.flats || settings.flats)) : '·';
  const octave = target !== null ? midiOctave(target) : '';

  return (
    <div class="stack">
      <ToolHeader
        id="tuner"
        actions={
          listening ? (
            <button class="btn" type="button" onClick={stop}>
              <StopIcon /> Stop listening
            </button>
          ) : (
            <button class="btn primary big" type="button" onClick={start}>
              <MicIcon /> Listen with the mic
            </button>
          )
        }
      >
        Play one string at a time. The needle and strobe settle in the middle when you are in tune. No mic? Tap a string below to hear its note and tune by ear.
      </ToolHeader>

      {error && <div class="notice bad">{error} Reference tones below still work.</div>}

      <div class="tuner-grid">
        <section class={`panel tuner-face ${inTune ? 'in-tune' : ''}`} aria-live="polite">
          <div class="tuner-readout">
            <div class={`flat-sharp ${cents !== null && cents < -4 ? 'on' : ''}`} aria-hidden="true">
              ♭
            </div>
            <div class={`tuner-note ${target === null ? 'idle' : ''}`}>
              {noteText}
              <sub>{octave}</sub>
            </div>
            <div class={`flat-sharp ${cents !== null && cents > 4 ? 'on' : ''}`} aria-hidden="true">
              ♯
            </div>
          </div>
          <Gauge cents={cents} inTune={inTune} />
          <Strobe centsRef={centsRef} />
          <div class="tuner-meta mono">
            <span>{reading ? `${reading.freq.toFixed(2)} Hz` : listening ? 'Listening…' : 'Mic off'}</span>
            <span class={inTune ? 'good' : ''}>
              {cents === null ? '' : inTune ? 'In tune' : `${cents > 0 ? '+' : ''}${Math.round(cents)}¢ · tune ${cents > 0 ? 'down' : 'up'}`}
            </span>
            <span class="level" aria-label="Input level">
              <span style={{ width: `${Math.min(100, level * 400)}%` }} />
            </span>
          </div>
        </section>

        <section class="panel stack" style={{ gap: '16px' }}>
          <div class="controls">
            <Field label="Mode">
              <Seg<Mode>
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'strings', label: 'Guitar strings' },
                  { value: 'chromatic', label: 'Chromatic' },
                ]}
              />
            </Field>
            <Field label="Tuning" htmlFor="tuner-tuning" grow>
              <select id="tuner-tuning" class="select" value={tuning.id} onChange={(e) => settingsStore.set({ tuningId: e.currentTarget.value })}>
                {TUNINGS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {tuningLabel(t)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div>
            <div class="panel-head" style={{ marginBottom: '8px' }}>
              <h3>Strings</h3>
              <span class="muted" style={{ fontSize: '0.85rem' }}>
                {tuned.length} of {tuning.strings.length} tuned
              </span>
            </div>
            <div class="string-row">
              {tuning.strings.map((m, i) => (
                <button
                  key={i}
                  type="button"
                  class={`string-btn ${stringIndex === i ? 'hearing' : ''} ${tuned.includes(i) ? 'done' : ''} ${repeatString === i ? 'repeating' : ''}`}
                  onClick={() => {
                    playNote(m, { channel: 'tuner-ref', a4, velocity: 0.85 });
                    markActive();
                  }}
                  title={`Play ${midiName(m, tuning.flats)} (${midiToFreq(m, a4).toFixed(2)} Hz)`}
                >
                  <span class="string-num">{tuning.strings.length - i}</span>
                  <span class="string-note">{pretty(stringName(tuning, i))}</span>
                  <span class="string-hz mono">{midiToFreq(m, a4).toFixed(1)}</span>
                </button>
              ))}
            </div>
          </div>

          <Field label="Repeat a reference tone" htmlFor="tuner-repeat">
            <div class="row">
              <select
                id="tuner-repeat"
                class="select"
                style={{ maxWidth: '220px' }}
                value={repeatString === null ? '' : String(repeatString)}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  setRepeatString(v === '' ? null : Number(v));
                }}
              >
                <option value="">Off</option>
                {tuning.strings.map((m, i) => (
                  <option key={i} value={i}>
                    String {tuning.strings.length - i} · {pretty(midiName(m, tuning.flats))}
                  </option>
                ))}
              </select>
              <span class="muted" style={{ fontSize: '0.85rem' }}>
                <SpeakerIcon /> Plucks every 2.4 s while you tune.
              </span>
            </div>
          </Field>

          <Field label={`Calibration: A4 = ${a4} Hz`} htmlFor="tuner-a4">
            <input id="tuner-a4" class="range" type="range" min={430} max={450} step={1} value={a4} onInput={(e) => settingsStore.set({ a4: Number(e.currentTarget.value) })} />
          </Field>
        </section>
      </div>
    </div>
  );
}
