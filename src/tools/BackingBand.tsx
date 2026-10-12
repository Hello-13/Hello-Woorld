import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { getEngine } from '../audio/engine';
import { playNote, stopChannels, strum } from '../audio/guitar';
import { click, hat, kick, rim, snare } from '../audio/kit';
import { Transport } from '../audio/scheduler';
import { ChordDiagram } from '../components/ChordDiagram';
import { Field, PlayIcon, Seg, StopIcon, ToolHeader } from '../components/ui';
import { markActive } from '../state/practice';
import { useSettings, useTuning } from '../state/settings';
import { createStore, useStore } from '../state/store';
import { chordSymbol } from '../theory/chords';
import { transposeChord } from '../theory/songsheet';
import { parseProgression, PROGRESSIONS } from '../theory/keys';
import { COMMON_ROOT_NAMES, keyPrefersFlats, mod12, pretty, prettyRoman } from '../theory/notes';
import { generateVoicings, type Voicing } from '../theory/voicings';

type Drums = 'rock' | 'halftime' | 'shuffle' | 'waltz' | 'reggae' | 'none';

export interface Feel {
  id: string;
  name: string;
  beats: 3 | 4;
  /**
   * One character per eighth note: D down, U up, X muted chuck, u short up-chop, - rest.
   * Fingerpicking: B bass string, b alternate bass, 1–3 a single treble string (1 = high e).
   */
  slots: string;
  drums: Drums;
  swing?: number;
}

export const FEELS: Feel[] = [
  { id: 'quarters', name: 'Four on the floor (all downs)', beats: 4, slots: 'D-D-D-D-', drums: 'rock' },
  { id: 'faithful', name: 'Old faithful (D DU UDU)', beats: 4, slots: 'D-DU-UDU', drums: 'rock' },
  { id: 'eighths', name: 'Straight eighths', beats: 4, slots: 'DUDUDUDU', drums: 'rock' },
  { id: 'chop', name: 'Backbeat chop', beats: 4, slots: 'DUXUDUXU', drums: 'rock' },
  { id: 'ballad', name: 'Slow ballad', beats: 4, slots: 'D---D-DU', drums: 'halftime' },
  { id: 'shuffle', name: 'Blues shuffle', beats: 4, slots: 'DUDUDUDU', drums: 'shuffle', swing: 0.33 },
  { id: 'reggae', name: 'Reggae skank', beats: 4, slots: '-u-u-u-u', drums: 'reggae' },
  { id: 'waltz', name: 'Waltz (3/4)', beats: 3, slots: 'D-DUDU', drums: 'waltz' },
  { id: 'arp68', name: 'Fingerpicked arpeggio (6/8)', beats: 3, slots: 'B32123', drums: 'none' },
  { id: 'travis', name: 'Travis picking', beats: 4, slots: 'B2b1B2b1', drums: 'none' },
  { id: 'folk-arp', name: 'Folk arpeggio (4/4)', beats: 4, slots: 'B321b321', drums: 'none' },
];

/** The string a picking-pattern character plays in a voicing, or null if it has nothing to play. */
export function pickString(ch: string, frets: number[]): number | null {
  const sounding = frets.map((f, i) => (f >= 0 ? i : -1)).filter((i) => i >= 0);
  if (!sounding.length) return null;
  if (ch === 'B') return sounding[0];
  if (ch === 'b') return sounding[Math.min(1, sounding.length - 1)];
  const n = Number(ch);
  if (!(n >= 1 && n <= 6)) return null;
  // String n counted from the top; fall back to the nearest sounding string below it.
  for (let i = frets.length - n; i >= 0; i--) if (frets[i] >= 0) return i;
  return null;
}

interface JamSettings {
  key: string;
  progressionId: string;
  custom: string;
  feelId: string;
  bpm: number;
  barsPerChord: number;
  capo: number;
  drums: boolean;
  guitar: boolean;
  bass: boolean;
  countIn: boolean;
}

const jamStore = createStore<JamSettings>('string-theory:jam', {
  key: 'G',
  progressionId: 'pop',
  custom: 'G D Em C',
  feelId: 'faithful',
  bpm: 92,
  barsPerChord: 1,
  capo: 0,
  drums: true,
  guitar: true,
  bass: true,
  countIn: true,
});

function drumHit(style: Drums, slot: number, beats: number, time: number) {
  const onBeat = slot % 2 === 0;
  const beat = Math.floor(slot / 2);
  switch (style) {
    case 'rock':
      hat(time, onBeat ? 0.9 : 0.55);
      if (slot === 0 || slot === 4 || slot === 5) kick(time, slot === 5 ? 0.6 : 1);
      if (slot === 2 || slot === 6) snare(time);
      break;
    case 'halftime':
      hat(time, onBeat ? 0.7 : 0.4);
      if (slot === 0 || slot === 3) kick(time, slot === 3 ? 0.6 : 1);
      if (slot === 4) snare(time);
      break;
    case 'shuffle':
      hat(time, onBeat ? 0.85 : 0.5);
      if (slot === 0 || slot === 4) kick(time);
      if (slot === 2 || slot === 6) snare(time, 0.9);
      break;
    case 'waltz':
      if (slot === 0) kick(time);
      else if (onBeat) {
        hat(time, 0.7);
        rim(time, 0.6);
      }
      break;
    case 'reggae':
      if (!onBeat) hat(time, 0.6);
      if (beat === 2 && onBeat) {
        kick(time);
        rim(time, 0.9);
      }
      break;
    case 'none':
      break;
  }
  void beats;
}

interface Pos {
  bar: number;
  slot: number;
  chordIndex: number;
  countIn: boolean;
}

export function BackingBand() {
  const settings = useSettings();
  const tuning = useTuning();
  const jam = useStore(jamStore);
  const [running, setRunning] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const transport = useRef<Transport | null>(null);
  const events = useRef<{ time: number; pos: Pos }[]>([]);

  const feel = FEELS.find((f) => f.id === jam.feelId) ?? FEELS[1];
  const preset = PROGRESSIONS.find((p) => p.id === jam.progressionId);
  const progressionText = preset ? preset.bars : jam.custom;
  const parsed = useMemo(() => parseProgression(progressionText, jam.key), [progressionText, jam.key]);
  const flats = keyPrefersFlats(mod12(parsed.chords[0]?.rootPc ?? 0), preset?.mode === 'minor') || jam.key.includes('b');

  // What the fretting hand holds: with a capo on fret n, play shapes n semitones lower.
  const shapes = useMemo(
    () =>
      parsed.chords.map((c) => {
        const shape = jam.capo ? transposeChord(c, -jam.capo, flats) : c;
        const v = generateVoicings(shape, tuning.strings, { limit: 1, maxFret: 12 })[0] ?? generateVoicings(shape, tuning.strings, { limit: 1, allowInversions: true })[0] ?? null;
        return { chord: c, shape, voicing: v as Voicing | null };
      }),
    [parsed, jam.capo, tuning.id, flats],
  );

  const live = useRef({ jam, shapes, feel, tuning, a4: settings.a4 });
  live.current = { jam, shapes, feel, tuning, a4: settings.a4 };

  useEffect(() => {
    if (transport.current) transport.current.bpm = jam.bpm;
  }, [jam.bpm]);

  useEffect(() => {
    if (transport.current) transport.current.swing = feel.swing ?? 0;
  }, [feel.id]);

  const stop = () => {
    transport.current?.stop();
    transport.current = null;
    events.current = [];
    stopChannels('jam-');
    setRunning(false);
    setPos(null);
  };

  const start = () => {
    if (!shapes.length) return;
    const e = getEngine();
    const tr = new Transport({ now: () => e.ctx.currentTime }, { bpm: jam.bpm, stepsPerBeat: 2, swing: feel.swing ?? 0 });
    tr.onStep = (step, time) => {
      const { jam: J, shapes: S, feel: F, tuning: T, a4 } = live.current;
      const perBar = F.beats * 2;
      const countInSteps = J.countIn ? perBar : 0;
      if (step < countInSteps) {
        if (step % 2 === 0) click(time, step === 0 ? 'accent' : 'beat', 'wood');
        events.current.push({ time, pos: { bar: -1, slot: step, chordIndex: 0, countIn: true } });
        return;
      }
      const s = step - countInSteps;
      const bar = Math.floor(s / perBar);
      const slot = s % perBar;
      const chordIndex = Math.floor(bar / J.barsPerChord) % S.length;
      events.current.push({ time, pos: { bar, slot, chordIndex, countIn: false } });
      if (events.current.length > 128) events.current.splice(0, 64);
      const { chord, voicing } = S[chordIndex];

      if (J.drums) drumHit(F.drums, slot, F.beats, time);

      if (J.guitar && voicing) {
        const notes = voicing.frets.map((f, i) => (f >= 0 ? T.strings[i] + f + J.capo : null));
        const ch = F.slots[slot % F.slots.length];
        if (ch === 'D') strum(notes, { time, direction: 'down', velocity: slot % 2 === 0 ? 0.82 : 0.7, channelPrefix: 'jam-g', a4 });
        else if (ch === 'U') strum(notes, { time, direction: 'up', velocity: 0.6, maxStrings: 4, channelPrefix: 'jam-g', a4 });
        else if (ch === 'X') strum(notes, { time, direction: 'down', velocity: 0.75, muted: true, spread: 0.006, channelPrefix: 'jam-g', a4 });
        else if (ch === 'u') {
          strum(notes, { time, direction: 'up', velocity: 0.62, maxStrings: 4, channelPrefix: 'jam-g', a4 });
          stopChannels('jam-g', time + 0.13);
        } else {
          const s = pickString(ch, voicing.frets);
          if (s !== null && notes[s] !== null) playNote(notes[s]!, { time, channel: 'jam-g' + s, velocity: ch === 'B' || ch === 'b' ? 0.78 : 0.64, a4 });
        }
      }

      if (J.bass) {
        const rootPc = chord.bassPc ?? chord.rootPc;
        const bassNote = 28 + mod12(rootPc - 4); // E1 … D#2
        if (slot === 0) playNote(bassNote, { time, channel: 'jam-bass', velocity: 0.95, duration: (60 / J.bpm) * 1.8, a4 });
        else if (F.beats === 4 && slot === 4) playNote(bassNote + (F.drums === 'reggae' ? 0 : 7), { time, channel: 'jam-bass', velocity: 0.85, duration: (60 / J.bpm) * 1.6, a4 });
      }
    };
    tr.start(0.12);
    transport.current = tr;
    setRunning(true);
    markActive();
  };

  // Follow the music on screen.
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let lastKey = '';
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const t = getEngine().ctx.currentTime;
      let current: Pos | null = null;
      for (const ev of events.current) {
        if (ev.time <= t) current = ev.pos;
        else break;
      }
      if (!current) return;
      const key = `${current.countIn}-${current.bar}-${current.slot}`;
      if (key !== lastKey) {
        lastKey = key;
        setPos(current);
        markActive();
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  useEffect(() => () => stop(), []);

  // Restart cleanly when the chords themselves change mid-song.
  useEffect(() => {
    if (running) {
      stop();
    }
  }, [progressionText, jam.key, jam.capo, feel.beats]);

  const set = (patch: Partial<JamSettings>) => jamStore.set(patch);
  const currentIdx = pos && !pos.countIn ? pos.chordIndex : 0;
  const upcoming = shapes.length ? (currentIdx + 1) % shapes.length : 0;
  const cur = shapes[currentIdx];
  const nxt = shapes[upcoming];
  const perBar = feel.beats * 2;
  const beatNow = pos ? Math.floor(pos.slot / 2) : -1;

  return (
    <div class="stack">
      <ToolHeader
        id="jam"
        actions={
          <button class={`btn big ${running ? '' : 'primary'}`} type="button" onClick={running ? stop : start} disabled={!shapes.length}>
            {running ? (
              <>
                <StopIcon /> Stop the band
              </>
            ) : (
              <>
                <PlayIcon /> Count me in
              </>
            )}
          </button>
        }
      >
        A drummer, a bass player and a rhythm guitarist who never get tired. Mute the guitar to take over the strumming yourself, or leave it in and solo over the top.
      </ToolHeader>

      <section class="jam-stage panel">
        <div class="jam-now">
          <span class="eyebrow">{pos?.countIn ? 'Count-in' : running ? 'Now' : 'First chord'}</span>
          {pos?.countIn ? (
            <div class="count-in">{Math.floor(pos.slot / 2) + 1}</div>
          ) : (
            cur && (
              <>
                <div class="jam-chord">{pretty(chordSymbol(cur.chord))}</div>
                {jam.capo > 0 && <div class="muted mono capo-note">shape {pretty(chordSymbol(cur.shape))} · capo {jam.capo}</div>}
              </>
            )
          )}
          {cur?.voicing && (
            <ChordDiagram
              frets={cur.voicing.frets}
              fingers={cur.voicing.fingers}
              barres={cur.voicing.barres}
              tuning={tuning.strings}
              rootPc={cur.shape.rootPc}
              width={190}
              title={`${chordSymbol(cur.shape)} shape`}
            />
          )}
        </div>
        <div class="jam-side">
          <div class="jam-next">
            <span class="eyebrow">Next</span>
            {nxt && (
              <div class="row" style={{ alignItems: 'center', gap: '14px' }}>
                <div class="jam-chord small">{pretty(chordSymbol(nxt.chord))}</div>
                {nxt.voicing && (
                  <ChordDiagram frets={nxt.voicing.frets} fingers={nxt.voicing.fingers} barres={nxt.voicing.barres} tuning={tuning.strings} rootPc={nxt.shape.rootPc} width={92} />
                )}
              </div>
            )}
          </div>
          <div>
            <span class="eyebrow">{/[Bb1-6]/.test(feel.slots) ? 'Picking' : 'Strum'}</span>
            <div class="strum-row" style={{ gridTemplateColumns: `repeat(${perBar}, minmax(0, 1fr))` }}>
              {feel.slots.split('').map((ch, i) => (
                <div key={i} class={`strum-slot ${pos && !pos.countIn && pos.slot === i ? 'now' : ''} ${i % 2 === 0 ? 'on' : 'off'}`}>
                  <span class="arrow" title={/[Bb1-6]/.test(ch) ? (ch === 'B' ? 'Bass string' : ch === 'b' ? 'Alternate bass string' : `String ${ch}`) : undefined}>
                    {ch === 'D' ? '↓' : ch === 'U' || ch === 'u' ? '↑' : ch === 'X' ? '×' : /[Bb1-6]/.test(ch) ? ch : '·'}
                  </span>
                  <span class="count mono">{i % 2 === 0 ? i / 2 + 1 : '&'}</span>
                </div>
              ))}
            </div>
          </div>
          <div class="beat-dots" aria-hidden="true">
            {Array.from({ length: feel.beats }, (_, b) => (
              <span key={b} class={beatNow === b ? 'now' : ''} />
            ))}
          </div>
          <div>
            <span class="eyebrow">Progression</span>
            <div class="bar-strip" style={{ marginTop: '6px' }}>
              {shapes.map((s, i) => (
                <div key={i} class={`bar-cell ${pos && !pos.countIn && pos.chordIndex === i ? 'now' : ''}`}>
                  <span class="mono">{preset ? prettyRoman(preset.bars.split(' ')[i]) : i + 1}</span>
                  <b>{pretty(chordSymbol(s.chord))}</b>
                </div>
              ))}
            </div>
            {parsed.errors.length > 0 && (
              <p class="notice bad" style={{ marginTop: '10px' }}>
                Skipped {parsed.errors.map((e) => `“${e}”`).join(', ')}: not a chord name or roman numeral.
              </p>
            )}
          </div>
        </div>
      </section>

      <section class="panel stack" style={{ gap: '16px' }}>
        <Field label="Key">
          <div class="chip-row">
            {COMMON_ROOT_NAMES.map((r) => (
              <button key={r} type="button" class="chip" aria-pressed={jam.key === r} onClick={() => set({ key: r })}>
                {pretty(r)}
                {preset?.mode === 'minor' ? 'm' : ''}
              </button>
            ))}
          </div>
        </Field>
        <div class="controls">
          <Field label="Progression" htmlFor="jam-prog" grow>
            <select
              id="jam-prog"
              class="select"
              value={jam.progressionId}
              onChange={(e) => {
                const next = PROGRESSIONS.find((p) => p.id === e.currentTarget.value);
                set({ progressionId: e.currentTarget.value, ...(next?.feel ? { feelId: next.feel } : {}), ...(next?.key ? { key: next.key } : {}) });
              }}
            >
              <optgroup label="Progressions">
                {PROGRESSIONS.filter((p) => !p.song).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}: {p.bars.split(' ').slice(0, 8).join(' ')}
                    {p.bars.split(' ').length > 8 ? '…' : ''}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Traditional songs">
                {PROGRESSIONS.filter((p) => p.song).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
              <option value="custom">Write my own…</option>
            </select>
          </Field>
          <Field label="Feel" htmlFor="jam-feel" grow>
            <select id="jam-feel" class="select" value={jam.feelId} onChange={(e) => set({ feelId: e.currentTarget.value })}>
              {FEELS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {preset ? (
          <p class="muted" style={{ fontSize: '0.9rem' }}>
            {preset.song ? preset.heardIn : `Heard in: ${preset.heardIn}`}
            {feel.slots.match(/[Bb1-6]/) ? ' · Picking: B is the bass string, b the next one up, and numbers are strings counted from the thinnest.' : ''}
          </p>
        ) : (
          <Field label="Your chords (names or roman numerals, one per bar)" htmlFor="jam-custom">
            <input id="jam-custom" class="input" value={jam.custom} onInput={(e) => set({ custom: e.currentTarget.value })} placeholder="G D Em C  or  I V vi IV" />
          </Field>
        )}
        <div class="controls">
          <Field label={`Tempo: ${jam.bpm} BPM`} htmlFor="jam-bpm" grow>
            <input id="jam-bpm" class="range" type="range" min={50} max={180} value={jam.bpm} onInput={(e) => set({ bpm: Number(e.currentTarget.value) })} />
          </Field>
          <Field label="Bars per chord">
            <Seg value={jam.barsPerChord} onChange={(v) => set({ barsPerChord: v })} options={[1, 2, 4].map((n) => ({ value: n, label: String(n) }))} />
          </Field>
          <Field label="Capo" htmlFor="jam-capo">
            <select id="jam-capo" class="select" value={jam.capo} onChange={(e) => set({ capo: Number(e.currentTarget.value) })}>
              {Array.from({ length: 8 }, (_, i) => (
                <option key={i} value={i}>
                  {i === 0 ? 'No capo' : `Fret ${i}`}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div class="row" style={{ gap: '18px' }}>
          {(
            [
              ['drums', 'Drums'],
              ['bass', 'Bass'],
              ['guitar', 'Rhythm guitar'],
              ['countIn', 'One-bar count-in'],
            ] as const
          ).map(([k, label]) => (
            <label key={k} class="toggle">
              <input type="checkbox" checked={jam[k]} onChange={(e) => set({ [k]: e.currentTarget.checked } as Partial<JamSettings>)} />
              {label}
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
