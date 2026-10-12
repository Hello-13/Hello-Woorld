import { useEffect, useState } from 'preact/hooks';
import { settingsStore, useSettings, type ThemeChoice } from './state/settings';
import { TUNINGS, tuningLabel } from './theory/tunings';
import { Field, Seg } from './components/ui';
import { TOOLS, type ToolId } from './tools/registry';
import { Home } from './tools/Home';
import { Tuner } from './tools/Tuner';
import { Metronome } from './tools/Metronome';
import { ChordLab } from './tools/ChordLab';
import { ScaleMap } from './tools/ScaleMap';
import { BackingBand } from './tools/BackingBand';
import { ChordChanges } from './tools/ChordChanges';
import { NoteHunt } from './tools/NoteHunt';
import { EarTrainer } from './tools/EarTrainer';
import { PianoBridge } from './tools/PianoBridge';

const VIEWS: Record<ToolId, () => preact.JSX.Element> = {
  tuner: Tuner,
  metronome: Metronome,
  chords: ChordLab,
  scales: ScaleMap,
  jam: BackingBand,
  changes: ChordChanges,
  hunt: NoteHunt,
  ear: EarTrainer,
  piano: PianoBridge,
};

function currentRoute(): ToolId | 'home' {
  const id = location.hash.replace(/^#/, '');
  return id in VIEWS ? (id as ToolId) : 'home';
}

function useRoute() {
  const [route, setRoute] = useState(currentRoute());
  useEffect(() => {
    const onChange = () => {
      setRoute(currentRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function PickLogo() {
  return (
    <svg class="logo-mark" viewBox="0 0 30 34" aria-hidden="true">
      <defs>
        <radialGradient id="sunburst" cx="50%" cy="40%" r="62%">
          <stop offset="0" stop-color="#ffd27a" />
          <stop offset="0.45" stop-color="#e98a2a" />
          <stop offset="0.8" stop-color="#9c2b14" />
          <stop offset="1" stop-color="#3b1408" />
        </radialGradient>
      </defs>
      <path d="M15 1.2C24 1.2 29 5.4 29 11.4 29 19.4 21.4 27.6 15 33 8.6 27.6 1 19.4 1 11.4 1 5.4 6 1.2 15 1.2Z" fill="url(#sunburst)" />
      <path d="M8 10.5h14M8 14h14M8 17.5h14" stroke="#fff6e5" stroke-width="1.2" stroke-linecap="round" opacity="0.85" />
    </svg>
  );
}

function SettingsDrawer(props: { onClose: () => void }) {
  const s = useSettings();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <>
      <div class="drawer-scrim" onClick={props.onClose} />
      <aside class="drawer" role="dialog" aria-label="Settings">
        <header>
          <h2>Settings</h2>
          <button class="icon-btn" type="button" onClick={props.onClose} aria-label="Close settings">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </button>
        </header>
        <Field label="Theme">
          <Seg<ThemeChoice>
            value={s.theme}
            onChange={(theme) => settingsStore.set({ theme })}
            options={[
              { value: 'system', label: 'Auto' },
              { value: 'light', label: 'Maple' },
              { value: 'dark', label: 'Rosewood' },
            ]}
          />
        </Field>
        <Field label="Tuning" htmlFor="set-tuning">
          <select id="set-tuning" class="select" value={s.tuningId} onChange={(e) => settingsStore.set({ tuningId: e.currentTarget.value })}>
            {TUNINGS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({tuningLabel(t)})
              </option>
            ))}
          </select>
        </Field>
        <label class="toggle">
          <input type="checkbox" checked={s.leftHanded} onChange={(e) => settingsStore.set({ leftHanded: e.currentTarget.checked })} />
          Left-handed fretboard
        </label>
        <label class="toggle">
          <input type="checkbox" checked={s.flats} onChange={(e) => settingsStore.set({ flats: e.currentTarget.checked })} />
          Name notes with flats (B♭ instead of A♯)
        </label>
        <Field label={`Frets shown: ${s.frets}`} htmlFor="set-frets">
          <input id="set-frets" class="range" type="range" min={12} max={22} step={1} value={s.frets} onInput={(e) => settingsStore.set({ frets: Number(e.currentTarget.value) })} />
        </Field>
        <Field label={`Concert pitch: A4 = ${s.a4} Hz`} htmlFor="set-a4">
          <input id="set-a4" class="range" type="range" min={430} max={450} step={1} value={s.a4} onInput={(e) => settingsStore.set({ a4: Number(e.currentTarget.value) })} />
        </Field>
        <Field label={`Volume: ${Math.round(s.volume * 100)}%`} htmlFor="set-volume">
          <input id="set-volume" class="range" type="range" min={0} max={1} step={0.05} value={s.volume} onInput={(e) => settingsStore.set({ volume: Number(e.currentTarget.value) })} />
        </Field>
        <p class="muted" style={{ fontSize: '0.85rem' }}>
          Settings and your practice log stay in this browser only.
        </p>
      </aside>
    </>
  );
}

export function App() {
  const route = useRoute();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const View = route === 'home' ? Home : VIEWS[route];
  return (
    <div class="shell">
      <header class="topbar">
        <div class="topbar-inner">
          <a class="logo" href="#" aria-label="String Theory home">
            <PickLogo />
            <span class="logo-word">String Theory</span>
          </a>
          <nav class="nav" aria-label="Tools">
            {TOOLS.map((t) => (
              <a key={t.id} href={'#' + t.id} aria-current={route === t.id ? 'page' : undefined}>
                <span class="led" style={{ '--c': t.color }} />
                {t.short}
              </a>
            ))}
          </nav>
          <button class="icon-btn" type="button" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path
                d="M10 6.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Zm7.1 4.6-1.6-.9a5.8 5.8 0 0 0 0-.6l1.6-1.3a.5.5 0 0 0 .1-.6l-1.5-2.6a.5.5 0 0 0-.6-.2l-1.9.7a6 6 0 0 0-1-.6L12 3.1a.5.5 0 0 0-.5-.4h-3a.5.5 0 0 0-.5.4l-.3 2a6 6 0 0 0-1 .6l-1.9-.7a.5.5 0 0 0-.6.2L2.7 7.8a.5.5 0 0 0 .1.6l1.6 1.3v.6l-1.6 1.3a.5.5 0 0 0-.1.6l1.5 2.6c.1.2.4.3.6.2l1.9-.7c.3.2.6.4 1 .6l.3 2c0 .2.3.4.5.4h3c.2 0 .5-.2.5-.4l.3-2c.4-.2.7-.4 1-.6l1.9.7c.2.1.5 0 .6-.2l1.5-2.6a.5.5 0 0 0-.1-.6Z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.4"
              />
            </svg>
          </button>
        </div>
      </header>
      <main>
        <View key={route} />
      </main>
      <footer class="footer">
        <span>String Theory · built for Paul’s practice sessions</span>
        <span>Every sound is synthesised live in your browser.</span>
      </footer>
      {settingsOpen && <SettingsDrawer onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
