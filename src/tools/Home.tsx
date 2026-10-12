import { useRef, useState } from 'preact/hooks';
import { playNote } from '../audio/guitar';
import { Fretboard, type FretMark } from '../components/Fretboard';
import { markActive, recentDays, streak, usePractice, daySeconds, dayKey } from '../state/practice';
import { useSettings, useTuning } from '../state/settings';
import { midiName, midiToFreq, pretty } from '../theory/notes';
import { stringName } from '../theory/tunings';
import { TOOLS, type ToolInfo } from './registry';

function Knob(props: { label: string; turn: number }) {
  // turn: 0–1 maps to the usual 7 o'clock … 5 o'clock sweep.
  const angle = -135 + 270 * Math.max(0, Math.min(1, props.turn));
  return (
    <div class="knob">
      <svg viewBox="0 0 30 30" aria-hidden="true">
        <defs>
          <radialGradient id="knob-cap" cx="40%" cy="35%" r="70%">
            <stop offset="0" stop-color="#4a4643" />
            <stop offset="1" stop-color="#0f0e0d" />
          </radialGradient>
        </defs>
        <circle cx="15" cy="15" r="13.5" fill="#1a1817" />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * 30 * Math.PI) / 180;
          return <line key={i} x1={15 + Math.cos(a) * 11} y1={15 + Math.sin(a) * 11} x2={15 + Math.cos(a) * 13.5} y2={15 + Math.sin(a) * 13.5} stroke="#2c2927" stroke-width="2" />;
        })}
        <circle cx="15" cy="15" r="10" fill="url(#knob-cap)" />
        <line x1="15" y1="15" x2="15" y2="6" stroke="#f4efe6" stroke-width="2" stroke-linecap="round" transform={`rotate(${angle} 15 15)`} />
      </svg>
      <span>{props.label}</span>
    </div>
  );
}

function pedalStat(t: ToolInfo, p: ReturnType<typeof usePractice>, a4: number): string {
  const minutes = Math.round(Object.values(p.days).reduce((sum, d) => sum + (d[t.id] ?? 0), 0) / 60);
  switch (t.id) {
    case 'tuner':
      return `A4 = ${a4} HZ`;
    case 'metronome':
      return `LAST ${p.lastBpm} BPM`;
    case 'hunt': {
      const best = Math.max(0, ...Object.values(p.huntBest));
      return best ? `BEST ${best} PTS` : 'NO SCORE YET';
    }
    case 'changes': {
      const best = p.changes.reduce((b, c) => (c.count > (b?.count ?? -1) ? c : b), null as null | { pair: string; count: number });
      return best ? `BEST ${best.count} · ${pretty(best.pair)}` : 'NO RUNS YET';
    }
    case 'ear': {
      const all = Object.values(p.ear);
      const total = all.reduce((s, x) => s + x.total, 0);
      const right = all.reduce((s, x) => s + x.right, 0);
      return total ? `${Math.round((100 * right) / total)}% OF ${total}` : 'NOT TRIED YET';
    }
    default:
      return minutes ? `${minutes} MIN PLAYED` : 'READY';
  }
}

function Pedal(props: { tool: ToolInfo; stat: string; index: number }) {
  const t = props.tool;
  return (
    <a class={`pedal ${t.lightEnclosure ? 'light-ink' : ''}`} href={'#' + t.id} style={{ '--c': t.color }}>
      <div class="pedal-top">
        <div class="knobs">
          {t.knobs.map((k, i) => (
            <Knob key={k} label={k} turn={((props.index * 37 + i * 23) % 100) / 100} />
          ))}
        </div>
        <span class="pedal-led" aria-hidden="true" />
      </div>
      <div class="pedal-plate">
        <span class="pedal-name">{t.name}</span>
        <span class="pedal-code">{t.code} · {props.stat}</span>
      </div>
      <p class="pedal-blurb">{t.blurb}</p>
      <span class="footswitch" aria-hidden="true" />
    </a>
  );
}

function WeekBars(props: { days: { key: string; date: Date; minutes: number }[] }) {
  const max = Math.max(10, ...props.days.map((d) => d.minutes));
  const today = dayKey();
  return (
    <div class="week-bars" role="img" aria-label="Minutes practised over the last seven days">
      {props.days.map((d) => (
        <div key={d.key} class={`week-day ${d.key === today ? 'today' : ''}`} title={`${d.date.toLocaleDateString(undefined, { weekday: 'long' })}: ${Math.round(d.minutes)} min`}>
          <div class="week-track">
            <div class="week-bar" style={{ height: d.minutes > 0 ? `${Math.max(6, (d.minutes / max) * 100)}%` : '0' }} />
          </div>
          <span class="mono">{d.date.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
        </div>
      ))}
    </div>
  );
}

function Playground() {
  const settings = useSettings();
  const tuning = useTuning();
  const [marks, setMarks] = useState<FretMark[]>([]);
  const [last, setLast] = useState<{ midi: number; s: number; f: number } | null>(null);
  const [ringing, setRinging] = useState<number[]>([]);
  const timers = useRef<number[]>([]);

  const press = (s: number, f: number) => {
    const midi = tuning.strings[s] + f;
    playNote(midi, { channel: 'play-' + s, a4: settings.a4 });
    markActive();
    setLast({ midi, s, f });
    setRinging([s]);
    const mark: FretMark = { string: s, fret: f, label: midiName(midi, settings.flats).replace(/-?\d+$/, ''), role: 'accent', pop: true };
    setMarks((m) => [...m.filter((x) => x.string !== s), mark]);
    const id = window.setTimeout(() => setMarks((m) => m.filter((x) => x !== mark)), 2400);
    timers.current.push(id);
  };

  return (
    <section class="panel" aria-labelledby="playground-h">
      <div class="panel-head">
        <div>
          <h2 id="playground-h">Open neck</h2>
          <p class="muted">Tap any fret to hear it. Each string rings until you play it again, like the real thing.</p>
        </div>
        <div class="mono" style={{ fontSize: '0.9rem', minHeight: '1.5em' }} aria-live="polite">
          {last ? `${pretty(midiName(last.midi, settings.flats))} · ${midiToFreq(last.midi, settings.a4).toFixed(1)} Hz · string ${tuning.strings.length - last.s}, ${last.f === 0 ? 'open' : 'fret ' + last.f}` : 'Nothing played yet'}
        </div>
      </div>
      <Fretboard
        tuning={tuning.strings}
        frets={settings.frets}
        leftHanded={settings.leftHanded}
        marks={marks}
        onPress={press}
        ringing={ringing}
        stringLabels={tuning.strings.map((_, i) => stringName(tuning, i))}
      />
    </section>
  );
}

export function Home() {
  const p = usePractice();
  const settings = useSettings();
  const days = recentDays(p, 7);
  const todayMin = Math.round(daySeconds(p, dayKey()) / 60);
  const runs = streak(p);
  const totalMin = Math.round(Object.keys(p.days).reduce((s, k) => s + daySeconds(p, k), 0) / 60);

  return (
    <div class="stack" style={{ gap: '26px' }}>
      <section class="home-intro">
        <div class="tool-title">
          <span class="eyebrow">Hey Paul. Pick a pedal.</span>
          <h1>Your guitar practice rig</h1>
          <p>
            Nine tools that tune, keep time, show shapes, back you up and quiz you. Your piano knowledge comes along too: the Piano Bridge maps keys to frets.
          </p>
        </div>
        <div class="home-stats panel">
          <div class="stat">
            <span class="value">{todayMin}</span>
            <span class="label">min today</span>
          </div>
          <div class="stat">
            <span class="value">{runs}</span>
            <span class="label">day streak</span>
          </div>
          <div class="stat">
            <span class="value">{totalMin}</span>
            <span class="label">min total</span>
          </div>
          <div class="week">
            <span class="eyebrow">Last 7 days</span>
            <WeekBars days={days} />
          </div>
        </div>
      </section>

      <section class="board" aria-label="Tools">
        <div class="pedals">
          {TOOLS.map((t, i) => (
            <Pedal key={t.id} tool={t} index={i} stat={pedalStat(t, p, settings.a4)} />
          ))}
        </div>
      </section>

      <Playground />
    </div>
  );
}
