import { useEffect, useMemo, useState } from 'preact/hooks';
import { playNote, strum } from '../audio/guitar';
import { ChordDiagram } from '../components/ChordDiagram';
import { Fretboard, roleForDegree, type FretMark, type NoteRole } from '../components/Fretboard';
import { Piano, type PianoMark } from '../components/Piano';
import { Field, PlayIcon, Seg, ToolHeader } from '../components/ui';
import { markActive } from '../state/practice';
import { useSettings, useTuning } from '../state/settings';
import { chordSymbol, identifyChord } from '../theory/chords';
import { intervalBetween } from '../theory/intervals';
import { midiName, mod12, pcName, pretty } from '../theory/notes';
import { stringName, type Tuning } from '../theory/tunings';
import { bestVoicing } from '../theory/voicings';

type Match = 'exact' | 'any';

/** Computer keys laid out like a piano, starting on C4: the bottom row is white, the row above black. */
const KEYMAP: Record<string, number> = {
  a: 60,
  w: 61,
  s: 62,
  e: 63,
  d: 64,
  f: 65,
  t: 66,
  g: 67,
  y: 68,
  h: 69,
  u: 70,
  j: 71,
  k: 72,
  o: 73,
  l: 74,
  p: 75,
  ';': 76,
};

const LOW = 36;
const HIGH = 84;

/** The most hand-friendly ways to play an interval from one string to a higher one. */
export function intervalShapes(semis: number, tuning: Tuning): { strings: number; frets: number; from: number }[] {
  const out: { strings: number; frets: number; from: number }[] = [];
  for (let from = 0; from < tuning.strings.length; from++) {
    for (let k = 0; k <= 3 && from + k < tuning.strings.length; k++) {
      const frets = semis - (tuning.strings[from + k] - tuning.strings[from]);
      if (Math.abs(frets) <= 4 && !(k === 0 && frets === 0)) out.push({ strings: k, frets, from });
    }
  }
  return out;
}

function describeShape(sh: { strings: number; frets: number }): string {
  const s = sh.strings === 0 ? 'same string' : sh.strings === 1 ? 'next string up' : `${sh.strings} strings up`;
  const f = sh.frets === 0 ? 'same fret' : `${Math.abs(sh.frets)} fret${Math.abs(sh.frets) > 1 ? 's' : ''} ${sh.frets > 0 ? 'toward the body' : 'back toward the nut'}`;
  return `${s}, ${f}`;
}

export function PianoBridge() {
  const settings = useSettings();
  const tuning = useTuning();
  const [held, setHeld] = useState<number[]>([60, 64, 67]);
  const [match, setMatch] = useState<Match>('exact');
  const [midiStatus, setMidiStatus] = useState<string | null>(null);

  const toggle = (m: number) => {
    playNote(m, { channel: 'pb-' + m, a4: settings.a4 });
    markActive();
    setHeld((h) => (h.includes(m) ? h.filter((x) => x !== m) : [...h, m].sort((a, b) => a - b)));
  };

  // Typing keys plays and toggles notes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || (e.target as HTMLElement).closest('input, select, textarea')) return;
      const m = KEYMAP[e.key.toLowerCase()];
      if (m !== undefined) {
        e.preventDefault();
        toggle(m);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settings.a4]);

  // A MIDI keyboard, where the browser allows it.
  useEffect(() => {
    const nav = navigator as Navigator & { requestMIDIAccess?: () => Promise<MIDIAccess> };
    if (!nav.requestMIDIAccess) return;
    let access: MIDIAccess | null = null;
    const onMessage = (ev: MIDIMessageEvent) => {
      const data = ev.data;
      if (!data || data.length < 3) return;
      const [status, note, vel] = data;
      if ((status & 0xf0) === 0x90 && vel > 0) toggle(note);
    };
    const wire = () => {
      if (!access) return;
      let n = 0;
      access.inputs.forEach((input) => {
        input.onmidimessage = onMessage;
        n++;
      });
      setMidiStatus(n ? `${n} MIDI keyboard${n > 1 ? 's' : ''} connected` : null);
    };
    nav
      .requestMIDIAccess()
      .then((a) => {
        access = a;
        a.onstatechange = wire;
        wire();
      })
      .catch(() => setMidiStatus(null));
    return () => {
      access?.inputs.forEach((input) => (input.onmidimessage = null));
    };
  }, []);

  const pcs = [...new Set(held.map(mod12))];
  const chordMatch = useMemo(() => identifyChord(held, held[0], settings.flats)[0] ?? null, [held.join(','), settings.flats]);
  const voicing = useMemo(() => (chordMatch ? bestVoicing(chordMatch.chord, tuning.strings) : null), [chordMatch?.symbol, tuning.id]);

  const roleOf = (pc: number): NoteRole => {
    if (!chordMatch) return pc === mod12(held[0] ?? -1) ? 'root' : 'accent';
    const semis = mod12(pc - chordMatch.chord.rootPc);
    const deg = chordMatch.chord.type.degrees.find((d) => mod12(d.semitones) === semis);
    return deg ? roleForDegree(deg) : 'other';
  };

  const pianoMarks = new Map<number, PianoMark>();
  held.forEach((m) => pianoMarks.set(m, { role: roleOf(mod12(m)) }));

  const marks: FretMark[] = [];
  tuning.strings.forEach((open, s) => {
    for (let f = 0; f <= settings.frets; f++) {
      const midi = open + f;
      const hit = match === 'exact' ? held.includes(midi) : pcs.includes(mod12(midi));
      if (hit) marks.push({ string: s, fret: f, role: roleOf(mod12(midi)), label: pcName(midi, settings.flats) });
    }
  });

  const exactCounts = held.map((m) => ({
    midi: m,
    places: tuning.strings.reduce((n, open) => n + (m >= open && m - open <= settings.frets ? 1 : 0), 0),
  }));
  const twoNotes = held.length === 2 ? held[1] - held[0] : null;
  const shapes = twoNotes !== null && twoNotes > 0 && twoNotes <= 24 ? intervalShapes(twoNotes, tuning) : [];
  const uniqueShapes = shapes.filter((s, i) => shapes.findIndex((x) => x.strings === s.strings && x.frets === s.frets) === i).slice(0, 3);

  return (
    <div class="stack">
      <ToolHeader
        id="piano"
        actions={
          <div class="row">
            <button class="btn" type="button" onClick={() => setHeld([])}>
              Clear keys
            </button>
            <button
              class="btn primary"
              type="button"
              disabled={!held.length}
              onClick={() => {
                held.forEach((m, i) => playNote(m, { channel: 'pb-' + m, a4: settings.a4, time: undefined, velocity: 0.8 - i * 0.03 }));
                markActive();
              }}
            >
              <PlayIcon /> Play together
            </button>
          </div>
        }
      >
        You already know your way around a keyboard. Hold notes here and see exactly where they live on the neck. Keys <span class="kbd">A</span>–<span class="kbd">;</span> on your computer play from middle C, and a USB MIDI keyboard works too where the browser allows it.
      </ToolHeader>

      <section class="panel stack" style={{ gap: '12px' }}>
        <div class="panel-head" style={{ marginBottom: 0 }}>
          <div class="mono muted" style={{ fontSize: '0.85rem' }}>
            {held.length ? held.map((m) => pretty(midiName(m, settings.flats))).join('  ') : 'No keys held'}
          </div>
          {midiStatus && <span class="eyebrow">{midiStatus}</span>}
        </div>
        <Piano from={LOW} to={HIGH} marks={pianoMarks} onPress={toggle} octaveLabels flats={settings.flats} centerOn={held[0] ?? 60} />
        <p class="muted" style={{ fontSize: '0.82rem' }}>
          Guitar music is written an octave higher than it sounds: the open low E string is the E below the bass clef’s bottom line, E2 here.
        </p>
      </section>

      <section class="panel stack" style={{ gap: '12px' }}>
        <div class="panel-head" style={{ marginBottom: 0 }}>
          <h3>On the neck</h3>
          <Seg<Match>
            value={match}
            onChange={setMatch}
            options={[
              { value: 'exact', label: 'Exact pitch' },
              { value: 'any', label: 'Any octave' },
            ]}
          />
        </div>
        <Fretboard
          tuning={tuning.strings}
          frets={settings.frets}
          leftHanded={settings.leftHanded}
          marks={marks}
          stringLabels={tuning.strings.map((_, i) => stringName(tuning, i))}
          onPress={(s, f) => toggle(tuning.strings[s] + f)}
          ariaLabel="Held notes on the fretboard"
        />
        {match === 'exact' && held.length > 0 && (
          <p class="muted" style={{ fontSize: '0.88rem' }}>
            {exactCounts
              .map((c) => `${pretty(midiName(c.midi, settings.flats))}: ${c.places === 0 ? 'out of guitar range' : `${c.places} place${c.places > 1 ? 's' : ''}`}`)
              .join(' · ')}
            . Unlike a piano, the same pitch often lives on several strings.
          </p>
        )}
      </section>

      <div class="grid-2">
        <section class="panel stack" style={{ gap: '12px' }}>
          <h3>What you’re holding</h3>
          {chordMatch ? (
            <div class="row" style={{ alignItems: 'center', gap: '20px' }}>
              <div>
                <div class="chord-big">{pretty(chordMatch.symbol)}</div>
                <p class="muted">
                  {pretty(chordMatch.chord.root)} {chordMatch.chord.type.name}
                  {chordMatch.chord.bass ? `, ${pretty(chordMatch.chord.bass)} in the bass` : ''}
                </p>
              </div>
              {voicing && (
                <button
                  type="button"
                  class="chord-card"
                  onClick={() => {
                    strum(voicing.frets.map((f, i) => (f >= 0 ? tuning.strings[i] + f : null)), { a4: settings.a4, channelPrefix: 'pb-g' });
                    markActive();
                  }}
                  aria-label={`Strum ${chordSymbol(chordMatch.chord)} on guitar`}
                >
                  <ChordDiagram frets={voicing.frets} fingers={voicing.fingers} barres={voicing.barres} tuning={tuning.strings} rootPc={chordMatch.chord.rootPc} width={120} />
                  <span class="meta">guitar shape · tap to strum</span>
                </button>
              )}
            </div>
          ) : (
            <p class="muted">
              {held.length < 2 ? 'Hold two or more keys to name a chord or an interval.' : 'That cluster isn’t a chord I can name. Try removing a note.'}
            </p>
          )}
          {twoNotes !== null && twoNotes > 0 && (
            <div class="stack" style={{ gap: '6px' }}>
              <p>
                <strong>{intervalBetween(held[0], held[1]).name}</strong>
                {twoNotes > 12 ? ` plus ${Math.floor(twoNotes / 12)} octave${twoNotes >= 24 ? 's' : ''}` : ''}. On guitar that’s:
              </p>
              <ul class="shape-list">
                {uniqueShapes.map((sh) => (
                  <li key={`${sh.strings}:${sh.frets}`}>{describeShape(sh)}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section class="panel stack" style={{ gap: '10px' }}>
          <h3>Piano brain, guitar hands</h3>
          <ul class="tips">
            <li>
              Each string is a <b>perfect 4th</b> above the one below it, except G to B, which is a <b>major 3rd</b>. That single kink is why shapes shift by a fret when they cross onto the B string.
            </li>
            <li>
              One fret is one semitone, like moving to the very next key. Twelve frets is an octave, which is why the 12th fret has the double dot.
            </li>
            <li>
              Shapes move. A chord shape slid up two frets is the same chord two semitones higher, so one barre shape gives you all twelve keys, the way transposing on piano never does.
            </li>
            <li>
              You can’t sustain with a pedal, and five notes is already a big guitar chord. Guitarists leave notes out (usually the 5th) where a pianist would double them.
            </li>
          </ul>
          <Field label="Quick chords to try">
            <div class="chip-row">
              {[
                ['C major', [48, 52, 55, 60, 64]],
                ['A minor', [45, 52, 57, 60, 64]],
                ['G7', [43, 47, 50, 55, 59, 65]],
                ['Dmaj7', [50, 57, 61, 66]],
                ['E7♯9', [40, 52, 56, 62, 67]],
              ].map(([label, notes]) => (
                <button key={label as string} type="button" class="chip" onClick={() => setHeld(notes as number[])}>
                  {label as string}
                </button>
              ))}
            </div>
          </Field>
        </section>
      </div>
    </div>
  );
}
