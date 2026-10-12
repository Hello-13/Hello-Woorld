import { useEffect, useRef, useState } from 'preact/hooks';
import { getEngine } from '../audio/engine';
import { click } from '../audio/kit';
import { MicInput } from '../audio/mic';
import { listenForOnsets, type OnsetListener } from '../audio/onsets';
import { feelWord, median, nearestOffset, steadiness, timingStats } from '../audio/rhythm';
import type { Transport } from '../audio/scheduler';
import { MicIcon, StopIcon } from '../components/ui';
import { markActive } from '../state/practice';
import { settingsStore, useSettings } from '../state/settings';

const RANGE_MS = 80;
const KEEP = 32;

/** Latency the platform reports for the output path, as a starting guess before calibration. */
function guessLatencyMs(ctx: AudioContext): number {
  const out = (ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0;
  return Math.round((out + ctx.baseLatency) * 1000) + 10;
}

function HitStrip(props: { offsets: number[] }) {
  const W = 600;
  const H = 74;
  const x = (ms: number) => W / 2 + (Math.max(-RANGE_MS, Math.min(RANGE_MS, ms)) / RANGE_MS) * (W / 2 - 24);
  const recent = props.offsets.slice(-24);
  return (
    <svg class="hit-strip" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Your recent strums against the beat: left is early, right is late">
      <rect x={x(-10)} y={10} width={x(10) - x(-10)} height={36} rx={4} style={{ fill: 'var(--good)', opacity: 0.15 }} />
      {[-75, -50, -25, 25, 50, 75].map((ms) => (
        <g key={ms}>
          <line x1={x(ms)} x2={x(ms)} y1={14} y2={42} stroke-width={1} style={{ stroke: 'var(--line)' }} />
          <text x={x(ms)} y={60} text-anchor="middle" font-size="11" class="mono" style={{ fill: 'var(--ink-3)' }}>
            {ms > 0 ? '+' + ms : ms}
          </text>
        </g>
      ))}
      <line x1={W / 2} x2={W / 2} y1={8} y2={48} stroke-width={2} style={{ stroke: 'var(--ink)' }} />
      <text x={W / 2} y={62} text-anchor="middle" font-size="11" font-weight="700" style={{ fill: 'var(--ink)' }}>
        beat
      </text>
      <text x={8} y={72} font-size="11" style={{ fill: 'var(--ink-3)' }}>
        ← early
      </text>
      <text x={W - 8} y={72} text-anchor="end" font-size="11" style={{ fill: 'var(--ink-3)' }}>
        late →
      </text>
      {recent.map((ms, i) => {
        const newest = i === recent.length - 1;
        return (
          <circle
            key={i}
            cx={x(ms)}
            cy={28 + ((i * 7) % 13) - 6}
            r={newest ? 7 : 5}
            stroke-width={2}
            style={{ fill: newest ? 'var(--accent)' : 'var(--p-metro)', stroke: 'var(--surface)', opacity: newest ? 1 : 0.35 + (0.5 * i) / recent.length }}
          />
        );
      })}
    </svg>
  );
}

/**
 * Listens to your playing while the metronome runs and shows how far each strum lands from the
 * click. Calibration measures the speaker-to-mic delay so the numbers reflect you, not the hardware.
 */
export function TimingCheck(props: { transport: { current: Transport | null }; running: boolean }) {
  const settings = useSettings();
  const [listening, setListening] = useState(false);
  const [offsets, setOffsets] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const [calNote, setCalNote] = useState<string | null>(null);
  const mic = useRef<MicInput | null>(null);
  const listener = useRef<OnsetListener | null>(null);
  const handler = useRef<(t: number) => void>(() => {});
  /** Onsets collected while calibrating; null the rest of the time. */
  const calHits = useRef<number[] | null>(null);

  const latencyMs = () => settings.latencyMs ?? guessLatencyMs(getEngine().ctx);

  // Route onsets to whatever is listening right now (playing along, or calibrating).
  handler.current = (t: number) => {
    if (calHits.current) {
      calHits.current.push(t);
      return;
    }
    const tr = props.transport.current;
    if (!tr || !tr.running) return;
    const grid = tr.recentSteps().map((s) => s.time);
    // An early strum can arrive before the next click is even scheduled: extend the grid ahead.
    if (grid.length) grid.push(grid[grid.length - 1] + tr.stepDuration, grid[grid.length - 1] + 2 * tr.stepDuration);
    const off = nearestOffset(t - latencyMs() / 1000, grid, tr.stepDuration);
    if (off === null) return;
    markActive();
    setOffsets((o) => [...o, off * 1000].slice(-KEEP));
  };

  const stop = () => {
    listener.current?.stop();
    listener.current = null;
    mic.current?.close();
    mic.current = null;
    setListening(false);
  };
  useEffect(() => stop, []);

  const ensureMic = async (): Promise<boolean> => {
    if (mic.current) return true;
    setError(null);
    try {
      mic.current = await MicInput.open();
      listener.current = await listenForOnsets(getEngine().ctx, mic.current.source, (t) => handler.current(t));
      setListening(true);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };

  const calibrate = async () => {
    if (props.running) {
      setCalNote('Stop the metronome first, then calibrate.');
      return;
    }
    if (!(await ensureMic())) return;
    setCalibrating(true);
    setCalNote('Listening to eight clicks…');
    const { ctx } = getEngine();
    const start = ctx.currentTime + 0.4;
    const gap = 0.6;
    const times = Array.from({ length: 8 }, (_, i) => start + i * gap);
    times.forEach((t, i) => click(t, i === 0 ? 'accent' : 'beat', 'wood'));
    calHits.current = [];
    await new Promise((r) => setTimeout(r, (0.4 + 8 * gap + 0.3) * 1000));
    const heard = calHits.current;
    calHits.current = null;
    const lags = heard
      .map((h) => {
        const nearest = times.reduce((best, t) => (Math.abs(h - t) < Math.abs(h - best) ? t : best), times[0]);
        return (h - nearest) * 1000;
      })
      .filter((ms) => ms > -20 && ms < 400);
    setCalibrating(false);
    if (lags.length < 5) {
      setCalNote('I couldn’t hear the clicks clearly. On headphones, run it again and tap the guitar body exactly with each click.');
      return;
    }
    const ms = Math.round(median(lags));
    settingsStore.set({ latencyMs: ms });
    setCalNote(`Calibrated: ${ms} ms between the click and what the mic hears.`);
  };

  const s = timingStats(offsets);

  return (
    <div class="trainer timing-check">
      <div class="panel-head" style={{ marginBottom: 0 }}>
        <span class="toggle" style={{ cursor: 'default' }}>
          Timing check
        </span>
        <div class="row">
          <button class="btn" type="button" disabled={calibrating} onClick={calibrate}>
            {calibrating ? 'Calibrating…' : 'Calibrate'}
          </button>
          {listening ? (
            <button class="btn" type="button" onClick={stop}>
              <StopIcon /> Stop listening
            </button>
          ) : (
            <button class="btn" type="button" onClick={() => ensureMic()}>
              <MicIcon /> Listen to me
            </button>
          )}
        </div>
      </div>
      <p class="muted">
        Strum muted strings on the click and see whether you rush or drag. Calibrate once: on speakers it listens to its own clicks; on headphones, tap along.{' '}
        {settings.latencyMs !== null ? `Latency: ${settings.latencyMs} ms.` : 'Not calibrated yet.'}
      </p>
      {error && <p class="notice bad">{error}</p>}
      {calNote && <p class="notice">{calNote}</p>}
      {listening && (
        <>
          <HitStrip offsets={offsets} />
          <div class="row timing-stats">
            {s.count >= 4 ? (
              <>
                <strong>{steadiness(s.spreadMs)}</strong>
                <span>
                  {feelWord(s.meanMs)} · spread ±{Math.round(s.spreadMs)} ms · {s.count} strums
                </span>
                <button class="btn" type="button" onClick={() => setOffsets([])}>
                  Clear
                </button>
              </>
            ) : (
              <span class="muted">{props.running ? 'Keep playing on the click…' : 'Start the metronome and play along.'}</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
