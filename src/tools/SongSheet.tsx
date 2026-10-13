import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { strum } from '../audio/guitar';
import { ChordDiagram } from '../components/ChordDiagram';
import { Field, PlayIcon, Seg, StopIcon } from '../components/ui';
import { markActive } from '../state/practice';
import { useSettings, useTuning } from '../state/settings';
import { loadJson, saveJson } from '../state/store';
import { chordSymbol, type Chord } from '../theory/chords';
import { pretty } from '../theory/notes';
import { capoOptions, flatsFor, parseSheet, SAMPLE_SHEET, sheetChords, transposeChord, transposeSheet, type SheetLine } from '../theory/songsheet';
import { bestVoicing } from '../theory/voicings';

const STORE_KEY = 'string-theory:sheet';

function ChordRow(props: { line: Extract<SheetLine, { kind: 'pair' }>; selected: string | null; onChord: (c: Chord) => void }) {
  const parts: preact.ComponentChildren[] = [];
  let cursor = 0;
  props.line.chords.forEach((t, i) => {
    if (t.col > cursor) parts.push(' '.repeat(t.col - cursor));
    parts.push(
      t.chord ? (
        <button key={i} type="button" class={`sheet-chord ${props.selected === t.text ? 'on' : ''}`} onClick={() => props.onChord(t.chord!)}>
          {pretty(t.text)}
        </button>
      ) : (
        <span key={i} class="muted">
          {t.text}
        </span>
      ),
    );
    cursor = t.col + t.text.length;
  });
  return <div class="sheet-chords">{parts}</div>;
}

export function SongSheet() {
  const settings = useSettings();
  const tuning = useTuning();
  const [text, setText] = useState(() => loadJson(STORE_KEY, { text: SAMPLE_SHEET }).text);
  const [editing, setEditing] = useState(false);
  const [semis, setSemis] = useState(0);
  const [capo, setCapo] = useState(0);
  const [view, setView] = useState<'shapes' | 'sounding'>('shapes');
  const [selected, setSelected] = useState<string | null>(null);
  const [scrolling, setScrolling] = useState(false);
  const [speed, setSpeed] = useState(18);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => saveJson(STORE_KEY, { text }), [text]);

  const sheet = useMemo(() => parseSheet(text), [text]);
  const original = useMemo(() => sheetChords(sheet), [sheet]);
  const flats = flatsFor(original, semis);
  const sounding = useMemo(() => transposeSheet(sheet, semis, flats), [sheet, semis, flats]);
  const soundingChords = useMemo(() => sheetChords(sounding), [sounding]);
  const shapeFlats = flatsFor(soundingChords, -capo);
  const showShapes = capo > 0 && view === 'shapes';
  const shown = useMemo(() => (showShapes ? transposeSheet(sounding, -capo, shapeFlats) : sounding), [sounding, capo, showShapes, shapeFlats]);
  const shownChords = useMemo(() => sheetChords(shown), [shown]);
  const suggestions = useMemo(() => capoOptions(soundingChords, tuning.strings).slice(0, 3), [soundingChords, tuning.id]);

  const keyName = soundingChords[0] ? pretty(chordSymbol(soundingChords[0])) : '–';
  const shapeKey = soundingChords[0] ? pretty(chordSymbol(transposeChord(soundingChords[0], -capo, shapeFlats))) : '–';

  /** Play a chord as shown: with a capo the shape sounds higher by the capo. */
  const play = (shownChord: Chord) => {
    const shape = showShapes ? shownChord : transposeChord(shownChord, -capo, shapeFlats);
    const v = bestVoicing(shape, tuning.strings);
    setSelected(chordSymbol(shownChord));
    if (v) strum(v.frets.map((f, i) => (f >= 0 ? tuning.strings[i] + f + capo : null)), { a4: settings.a4, channelPrefix: 'sheet-' });
    markActive();
  };

  useEffect(() => {
    if (!scrolling) return;
    let raf = 0;
    let last = performance.now();
    let carry = 0;
    const step = (t: number) => {
      const el = sheetRef.current;
      if (!el) return;
      carry += ((t - last) / 1000) * speed;
      last = t;
      const whole = Math.floor(carry);
      if (whole) {
        el.scrollTop += whole;
        carry -= whole;
      }
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
        setScrolling(false);
        return;
      }
      markActive();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [scrolling, speed]);

  return (
    <div class="stack">
      <section class="panel stack" style={{ gap: '14px' }}>
        <div class="controls">
          <Field label={`Transpose: ${semis > 0 ? '+' : ''}${semis} · key of ${keyName}`}>
            <div class="row" style={{ gap: '6px' }}>
              <button class="btn" type="button" onClick={() => setSemis((s) => Math.max(-11, s - 1))} aria-label="Down a semitone">
                −1
              </button>
              <button class="btn" type="button" onClick={() => setSemis((s) => Math.min(11, s + 1))} aria-label="Up a semitone">
                +1
              </button>
              <button class="btn" type="button" disabled={semis === 0} onClick={() => setSemis(0)}>
                Original
              </button>
            </div>
          </Field>
          <Field label="Capo" htmlFor="sheet-capo">
            <select id="sheet-capo" class="select" value={capo} onChange={(e) => setCapo(Number(e.currentTarget.value))}>
              {Array.from({ length: 8 }, (_, i) => (
                <option key={i} value={i}>
                  {i === 0 ? 'No capo' : `Fret ${i}`}
                </option>
              ))}
            </select>
          </Field>
          {capo > 0 && (
            <Field label="Chord names">
              <Seg
                value={view}
                onChange={setView}
                options={[
                  { value: 'shapes', label: `Shapes (${shapeKey})` },
                  { value: 'sounding', label: `Sounding (${keyName})` },
                ]}
              />
            </Field>
          )}
        </div>
        <div class="row" style={{ gap: '8px' }}>
          <span class="eyebrow">Easiest capo</span>
          {suggestions.map((o) => (
            <button key={o.capo} type="button" class="chip" aria-pressed={capo === o.capo} onClick={() => (setCapo(o.capo), setView('shapes'))}>
              {o.capo === 0 ? 'No capo' : `Capo ${o.capo}`}: {o.shapes.slice(0, 5).map((s) => pretty(chordSymbol(s))).join(' ')}
              {o.shapes.length > 5 ? '…' : ''}
            </button>
          ))}
        </div>
        <div class="sheet-strip">
          {shownChords.map((c) => {
            const shape = showShapes ? c : transposeChord(c, -capo, shapeFlats);
            const v = bestVoicing(shape, tuning.strings);
            const sym = chordSymbol(c);
            return (
              <button key={sym} type="button" class={`chord-card ${selected === sym ? 'active' : ''}`} onClick={() => play(c)}>
                <span class="name">{pretty(sym)}</span>
                {v ? (
                  <ChordDiagram frets={v.frets} fingers={v.fingers} barres={v.barres} tuning={tuning.strings} rootPc={shape.rootPc} width={78} />
                ) : (
                  <span class="meta">no shape</span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section class="panel stack" style={{ gap: '12px' }}>
        <div class="panel-head" style={{ marginBottom: 0 }}>
          <h2>{sheet.title ?? 'Your song'}</h2>
          <div class="row">
            {!editing && (
              <>
                <button class={`btn ${scrolling ? '' : 'primary'}`} type="button" onClick={() => setScrolling((s) => !s)}>
                  {scrolling ? (
                    <>
                      <StopIcon /> Stop scrolling
                    </>
                  ) : (
                    <>
                      <PlayIcon /> Auto-scroll
                    </>
                  )}
                </button>
                <input aria-label="Scroll speed" class="range" style={{ width: '110px' }} type="range" min={6} max={60} value={speed} onInput={(e) => setSpeed(Number(e.currentTarget.value))} />
              </>
            )}
            <button class="btn" type="button" onClick={() => (setEditing((e) => !e), setScrolling(false))}>
              {editing ? 'Done editing' : 'Paste or edit'}
            </button>
          </div>
        </div>
        {editing ? (
          <div class="stack" style={{ gap: '8px' }}>
            <textarea
              id="sheet-text"
              class="input sheet-editor"
              value={text}
              spellcheck={false}
              onInput={(e) => setText(e.currentTarget.value)}
              aria-label="Chord sheet text"
            />
            <div class="row">
              <p class="muted" style={{ fontSize: '0.85rem', flex: 1, minWidth: '200px' }}>
                Paste chords on their own line above the lyrics, or ChordPro with chords in brackets: <span class="kbd">Was [Em]blind, but [D]now</span>. Section names like
                “Chorus” or “[Verse 2]” become headings. Your sheet stays in this browser.
              </p>
              <button class="btn" type="button" onClick={() => setText(SAMPLE_SHEET)}>
                Load the example
              </button>
              <button class="btn" type="button" onClick={() => setText('')}>
                Clear
              </button>
            </div>
          </div>
        ) : (
          <div class="sheet" ref={sheetRef}>
            {shown.lines.map((l, i) => {
              if (l.kind === 'blank') return <div key={i} class="sheet-gap" />;
              if (l.kind === 'section') return <h3 key={i} class="sheet-section">{l.text}</h3>;
              if (l.kind === 'text') return <div key={i} class="sheet-lyric">{l.text}</div>;
              return (
                <div key={i} class="sheet-pair">
                  <ChordRow line={l} selected={selected} onChord={play} />
                  {l.lyric && <div class="sheet-lyric">{l.lyric}</div>}
                </div>
              );
            })}
            {!shown.lines.length && <p class="muted">The sheet is empty. Choose “Paste or edit” to add a song.</p>}
          </div>
        )}
      </section>
    </div>
  );
}
