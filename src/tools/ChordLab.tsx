import { useMemo, useState } from 'preact/hooks';
import { arpeggiate, strum } from '../audio/guitar';
import { ChordDiagram, type DiagramLabels } from '../components/ChordDiagram';
import { Fretboard, roleForDegree, type FretMark } from '../components/Fretboard';
import { Field, PlayIcon, Seg, ToolHeader } from '../components/ui';
import { markActive } from '../state/practice';
import { useSettings, useTuning } from '../state/settings';
import { chordNoteNames, chordPcs, chordSymbol, CHORD_TYPES, identifyChord, makeChord, parseChordSymbol, type Chord } from '../theory/chords';
import { DEGREE_LABELS } from '../theory/intervals';
import { COMMON_ROOT_NAMES, mod12, pcName, pretty } from '../theory/notes';
import { stringName } from '../theory/tunings';
import { generateVoicings, shapeString, voicingMidi, type Frets } from '../theory/voicings';
import { SongSheet } from './SongSheet';

const GROUPS: { name: string; ids: string[] }[] = [
  { name: 'Triads', ids: ['maj', 'min', '5', 'sus2', 'sus4', 'dim', 'aug'] },
  { name: 'Sevenths', ids: ['7', 'maj7', 'm7', 'm7b5', 'dim7', 'mmaj7', '7sus4'] },
  { name: 'Colour', ids: ['6', 'm6', 'add9', 'madd9', '9', 'maj9', 'm9', '6/9', '7#9', '13'] },
];

function typeLabel(id: string): string {
  const t = CHORD_TYPES.find((c) => c.id === id)!;
  return t.symbol === '' ? 'maj' : pretty(t.symbol);
}

/** MIDI notes per string, null where muted, for the strum helpers. */
function stringNotes(frets: Frets, tuning: number[]): (number | null)[] {
  return frets.map((f, i) => (f >= 0 ? tuning[i] + f : null));
}

function ChordFacts(props: { chord: Chord }) {
  const c = props.chord;
  const names = chordNoteNames(c);
  return (
    <div class="chord-facts">
      <div class="chord-big">{pretty(chordSymbol(c))}</div>
      <div class="stack" style={{ gap: '6px' }}>
        <p>
          <strong>
            {pretty(c.root)} {c.type.name}
          </strong>
          {c.bass ? ` over ${pretty(c.bass)}` : ''}
          {c.type.nickname ? <span class="muted">, a.k.a. {c.type.nickname}</span> : null}
        </p>
        <div class="tone-row">
          {c.type.degrees.map((d, i) => (
            <span key={d.label} class={`tone ${roleForDegree(d)}`}>
              <b>{pretty(names[i])}</b>
              <small>{pretty(d.label === '1' ? 'R' : d.label)}</small>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function LookUp() {
  const settings = useSettings();
  const tuning = useTuning();
  const [root, setRoot] = useState('C');
  const [typeId, setTypeId] = useState('maj');
  const [bass, setBass] = useState<string | undefined>(undefined);
  const [labels, setLabels] = useState<DiagramLabels>('fingers');
  const [selected, setSelected] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState('');
  const [queryError, setQueryError] = useState('');

  const chord = useMemo(() => makeChord(root, typeId, bass), [root, typeId, bass]);
  const voicings = useMemo(() => generateVoicings(chord, tuning.strings, { limit: 8, maxFret: Math.max(12, settings.frets) }), [chord, tuning.id, settings.frets]);
  const v = voicings[Math.min(selected, voicings.length - 1)];

  const choose = (r: string, t: string, b?: string) => {
    setRoot(r);
    setTypeId(t);
    setBass(b);
    setSelected(0);
  };

  const play = (frets: Frets, mode: 'strum' | 'arp') => {
    markActive();
    if (mode === 'strum') strum(stringNotes(frets, tuning.strings), { a4: settings.a4, channelPrefix: 'chord-' });
    else arpeggiate(voicingMidi(frets, tuning.strings), { a4: settings.a4 });
  };

  const marks: FretMark[] = [];
  const pcsInChord = chordPcs(chord);
  if (showAll) {
    for (let s = 0; s < tuning.strings.length; s++) {
      for (let f = 0; f <= settings.frets; f++) {
        const pc = mod12(tuning.strings[s] + f);
        if (!pcsInChord.includes(pc)) continue;
        if (v && v.frets[s] === f) continue;
        const semis = mod12(pc - chord.rootPc);
        const deg = chord.type.degrees.find((d) => mod12(d.semitones) === semis);
        marks.push({ string: s, fret: f, role: deg ? roleForDegree(deg) : 'other', label: pcName(pc, settings.flats || chord.root.includes('b')), dim: true });
      }
    }
  }
  if (v) {
    v.frets.forEach((f, s) => {
      if (f < 0) return;
      const pc = mod12(tuning.strings[s] + f);
      const semis = mod12(pc - chord.rootPc);
      const deg = chord.type.degrees.find((d) => mod12(d.semitones) === semis);
      const label = labels === 'intervals' ? (DEGREE_LABELS[semis] === '1' ? 'R' : DEGREE_LABELS[semis]) : pcName(pc, settings.flats || chord.root.includes('b'));
      marks.push({ string: s, fret: f, role: deg ? roleForDegree(deg) : 'other', label });
    });
  }

  const submitQuery = (e: Event) => {
    e.preventDefault();
    const c = parseChordSymbol(query);
    if (!c) {
      setQueryError(`“${query}” isn’t a chord name I know. Try Am7, F#m7b5 or C/G.`);
      return;
    }
    setQueryError('');
    choose(c.root, c.type.id, c.bass);
  };

  return (
    <div class="stack">
      <section class="panel stack" style={{ gap: '14px' }}>
        <div class="controls" style={{ alignItems: 'flex-start' }}>
          <Field label="Root">
            <div class="chip-row">
              {COMMON_ROOT_NAMES.map((r) => (
                <button key={r} type="button" class="chip" aria-pressed={root === r} onClick={() => choose(r, typeId)}>
                  {pretty(r)}
                </button>
              ))}
            </div>
          </Field>
          <form class="field" onSubmit={submitQuery} style={{ flex: 1, minWidth: '200px' }}>
            <label for="chord-query">Or type a chord</label>
            <div class="row" style={{ flexWrap: 'nowrap' }}>
              <input id="chord-query" class="input" placeholder="F#m7b5, Bbmaj7, D/F#…" value={query} onInput={(e) => setQuery(e.currentTarget.value)} />
              <button class="btn" type="submit">
                Show
              </button>
            </div>
            {queryError && <span style={{ color: 'var(--bad)', fontSize: '0.85rem' }}>{queryError}</span>}
          </form>
        </div>
        {GROUPS.map((g) => (
          <Field key={g.name} label={g.name}>
            <div class="chip-row">
              {g.ids.map((id) => (
                <button key={id} type="button" class="chip" aria-pressed={typeId === id} onClick={() => choose(root, id)}>
                  {typeLabel(id)}
                </button>
              ))}
            </div>
          </Field>
        ))}
      </section>

      <section class="panel stack" style={{ gap: '16px' }}>
        <div class="panel-head" style={{ alignItems: 'center' }}>
          <ChordFacts chord={chord} />
          <div class="row">
            <Seg<DiagramLabels>
              label="Dot labels"
              value={labels}
              onChange={setLabels}
              options={[
                { value: 'fingers', label: 'Fingers' },
                { value: 'notes', label: 'Notes' },
                { value: 'intervals', label: 'Intervals' },
              ]}
            />
          </div>
        </div>
        {voicings.length === 0 ? (
          <div class="notice">No comfortable shape for this chord in {tuning.name} tuning within reach of one hand.</div>
        ) : (
          <div class="voicing-grid">
            {voicings.map((vc, i) => (
              <button
                key={shapeString(vc.frets)}
                type="button"
                class={`chord-card ${i === selected ? 'active' : ''}`}
                onClick={() => {
                  setSelected(i);
                  play(vc.frets, 'strum');
                }}
                aria-label={`Shape ${shapeString(vc.frets)}, play it`}
              >
                <ChordDiagram
                  frets={vc.frets}
                  fingers={vc.fingers}
                  barres={vc.barres}
                  tuning={tuning.strings}
                  rootPc={chord.rootPc}
                  labels={labels}
                  width={108}
                  flats={settings.flats || chord.root.includes('b')}
                  title={`${chordSymbol(chord)} ${shapeString(vc.frets)}`}
                />
                <span class="meta">{shapeString(vc.frets)}</span>
                <span class="meta">
                  {vc.frets.includes(0) && vc.minFret <= 4 ? 'open' : `fret ${vc.minFret}`}
                  {vc.barres.length ? ' · barre' : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section class="panel stack" style={{ gap: '12px' }}>
        <div class="panel-head">
          <h3>On the neck</h3>
          <div class="row">
            <label class="toggle">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.currentTarget.checked)} />
              Every {pretty(chordSymbol(chord))} note
            </label>
            {v && (
              <>
                <button class="btn" type="button" onClick={() => play(v.frets, 'strum')}>
                  <PlayIcon /> Strum
                </button>
                <button class="btn" type="button" onClick={() => play(v.frets, 'arp')}>
                  Arpeggio
                </button>
              </>
            )}
          </div>
        </div>
        <Fretboard
          tuning={tuning.strings}
          frets={settings.frets}
          leftHanded={settings.leftHanded}
          marks={marks}
          stringLabels={tuning.strings.map((_, i) => stringName(tuning, i))}
          ariaLabel={`${chordSymbol(chord)} on the fretboard`}
        />
      </section>
    </div>
  );
}

function NameIt() {
  const settings = useSettings();
  const tuning = useTuning();
  const [frets, setFrets] = useState<Frets>(() => (tuning.id === 'standard' ? [-1, 3, 2, 0, 1, 0] : tuning.strings.map(() => 0)));

  const press = (s: number, f: number) => {
    markActive();
    setFrets((prev) => {
      const next = [...prev];
      next[s] = prev[s] === f ? -1 : f;
      return next;
    });
  };

  const sounding = frets.map((f, i) => (f >= 0 ? tuning.strings[i] + f : null)).filter((m): m is number => m !== null);
  const bass = sounding.length ? sounding[0] : undefined;
  const matches = identifyChord(sounding, bass, settings.flats).slice(0, 5);
  const best = matches[0];

  const marks: FretMark[] = frets
    .map((f, s) => {
      if (f < 0) return null;
      const pc = mod12(tuning.strings[s] + f);
      let role: FretMark['role'] = 'accent';
      let label = pcName(pc, settings.flats);
      if (best) {
        const semis = mod12(pc - best.chord.rootPc);
        const deg = best.chord.type.degrees.find((d) => mod12(d.semitones) === semis);
        role = deg ? roleForDegree(deg) : 'other';
        label = pcName(pc, settings.flats || best.chord.root.includes('b'));
      }
      return { string: s, fret: f, role, label } as FretMark;
    })
    .filter((m): m is FretMark => m !== null);

  return (
    <div class="stack">
      <section class="panel stack" style={{ gap: '14px' }}>
        <div class="panel-head">
          <div>
            <h3>Tap the frets you’re holding</h3>
            <p class="muted">Tap a fret to place a finger, tap it again to mute that string. The left column is the open string.</p>
          </div>
          <div class="row">
            <button class="btn" type="button" onClick={() => setFrets(tuning.strings.map(() => -1))}>
              Clear
            </button>
            <button class="btn" type="button" onClick={() => setFrets(tuning.strings.map(() => 0))}>
              All open
            </button>
            <button
              class="btn primary"
              type="button"
              disabled={!sounding.length}
              onClick={() => {
                markActive();
                strum(stringNotes(frets, tuning.strings), { a4: settings.a4, channelPrefix: 'chord-' });
              }}
            >
              <PlayIcon /> Strum
            </button>
          </div>
        </div>
        <Fretboard
          tuning={tuning.strings}
          frets={settings.frets}
          leftHanded={settings.leftHanded}
          marks={marks}
          onPress={press}
          stringLabels={tuning.strings.map((_, i) => (frets[i] < 0 ? '×' : stringName(tuning, i)))}
        />
        <p class="mono muted" style={{ fontSize: '0.85rem' }}>
          Shape: {shapeString(frets)} · Notes: {sounding.length ? sounding.map((m) => pretty(pcName(m, settings.flats))).join(' ') : 'none'}
        </p>
      </section>

      <section class="panel">
        {best ? (
          <div class="stack" style={{ gap: '14px' }}>
            <ChordFacts chord={best.chord} />
            {best.omitted.length > 0 && <p class="muted">The {best.omitted.map((o) => pretty(o)).join(' and ')} is left out, which guitarists do all the time.</p>}
            {matches.length > 1 && (
              <div>
                <span class="eyebrow">Could also be read as</span>
                <div class="chip-row" style={{ marginTop: '6px' }}>
                  {matches.slice(1).map((m) => (
                    <span key={m.symbol} class="chip" style={{ cursor: 'default' }}>
                      {pretty(m.symbol)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p class="muted">
            {sounding.length < 2 ? 'Place at least two notes to name a chord.' : 'These notes don’t spell a chord I know. Try moving one finger.'}
          </p>
        )}
      </section>
    </div>
  );
}

export function ChordLab() {
  const [mode, setMode] = useState<'lookup' | 'name' | 'sheet'>('lookup');
  return (
    <div class="stack">
      <ToolHeader
        id="chords"
        actions={
          <Seg
            value={mode}
            onChange={setMode}
            options={[
              { value: 'lookup', label: 'Find shapes' },
              { value: 'name', label: 'Name a shape' },
              { value: 'sheet', label: 'Song sheet' },
            ]}
          />
        }
      >
        Pick a chord to see every comfortable way to hold it, fingered and ranked from easiest. “Name a shape” works backwards from your fingers, and “Song sheet” turns any chord sheet into tappable shapes with transpose and capo.
      </ToolHeader>
      {mode === 'lookup' ? <LookUp /> : mode === 'name' ? <NameIt /> : <SongSheet />}
    </div>
  );
}
