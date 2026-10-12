# Fretboard Companion

A guitar practice card for any dashboard. It's one dependency-free JavaScript file that defines a `<fretboard-companion>` Web Component with four tools:

| Tab | What it does |
| --- | --- |
| **Tuner** | Chromatic tuner on your microphone, shown on an analog-style meter (±50 cents). Each string gets a check mark once it holds in tune. Tap any string to hear a synthesized reference note. |
| **Chords** | A new chord of the day every day, from a library of 39 open, barre and power chords. Diagrams show finger numbers, barres and a position marker for shapes up the neck (e.g. `5fr`). Click **Strum** or **Arpeggio** to hear the chord, or click a single string to hear that note. |
| **Tempo** | Metronome from 30 to 240 BPM with tap tempo, 2/4, 3/4, 4/4 and 6/8 time, an accent on beat one, and a speed trainer that adds 2 BPM every 4 bars. The pendulum's weight slides down as you speed up, like a real metronome. |
| **Practice** | Session timer, current and best streak, a weekly goal, and a heatmap of the minutes you've practiced. |

The session timer stays at the bottom of the card, so it keeps running while you switch between the tuner, chords and metronome.

## Try it

```bash
cd fretboard-companion
npx serve .        # or: python3 -m http.server
```

Open the URL it prints. The demo page lets you resize and re-theme the card, and it lists the events the card fires.

> Browsers only allow microphone access on `https://` pages or `localhost`, so the tuner won't work if you open the HTML file directly from disk. The reference tones, chords, metronome and practice log work anywhere.

## Add it to your dashboard

Copy `fretboard-companion.js` into your static assets, then:

```html
<script src="/fretboard-companion.js" defer></script>

<fretboard-companion weekly-goal="150"></fretboard-companion>
```

The card is `display: block` and fills whatever width you give it. It switches layout between about 320px and 700px using container queries. It renders inside Shadow DOM, so your CSS and the card's CSS stay separate.

### React

```jsx
import { useEffect, useRef } from 'react';
import './fretboard-companion.js';

export function GuitarCard({ onPractice }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    const handler = (e) => onPractice?.(e.detail);
    el.addEventListener('practice-logged', handler);
    return () => el.removeEventListener('practice-logged', handler);
  }, [onPractice]);
  return <fretboard-companion ref={ref} weekly-goal="150" />;
}
```

### Vue

```vue
<template>
  <fretboard-companion weekly-goal="150" @practice-logged="save($event.detail)" />
</template>
```

Tell Vue it's a custom element: in `vite.config`, pass `vue({ template: { compilerOptions: { isCustomElement: (tag) => tag === 'fretboard-companion' } } })`.

### iframe

If your dashboard can only embed pages, host `index.html` (or a page with just the element) and add the microphone permission:

```html
<iframe src="https://you.example/fretboard/" allow="microphone; autoplay" style="border:0;width:440px;height:640px"></iframe>
```

## Attributes

| Attribute | Default | Description |
| --- | --- | --- |
| `theme` | `auto` | `light`, `dark` or `auto`. Auto follows `data-theme` / `data-bs-theme` or a `.dark` / `.light` class on `<html>`, then the OS setting. It updates live. |
| `weekly-goal` | `150` | Minutes per week for the goal bar. |
| `a4` | `440` | Reference pitch in Hz (400–480) for the tuner and reference tones. |
| `bpm` | `96` | Starting tempo if the user has none saved. |
| `tab` | `tuner` | Opening tab if the user has none saved: `tuner`, `chords`, `metronome`, `practice`. Changing it later switches tabs. |
| `storage-key` | `fretboard-companion` | localStorage key. Use different keys to keep separate logs. |
| `sample-data` | off | Shows example history until the first real session is logged. |
| `no-fonts` | off | Don't load Google Fonts. The card uses your dashboard's fonts instead. |

## Events

All events bubble, cross the shadow boundary (`composed: true`), and carry their data in `event.detail`.

| Event | `detail` |
| --- | --- |
| `practice-logged` | `{ date, minutes, totalForDay, streak, weekMinutes }` |
| `practice-log-change` | `{ log }`: the full `{ 'YYYY-MM-DD': minutes }` map after any change, including undo |
| `session-change` | `{ state }`: `running`, `paused` or `idle` |
| `tuner-pitch` | `{ note, octave, frequency, cents, inTune, string }`, at most 5 per second |
| `chord-change` | `{ id, name, fullName, frets }` |
| `tempo-change` | `{ bpm }` |
| `metronome-change` | `{ running, bpm, timeSignature }` |

## Methods and properties

```js
const fc = document.querySelector('fretboard-companion');

fc.practiceLog;                       // { '2026-10-12': 35, ... } (a copy)
fc.setPracticeLog({ '2026-10-11': 30 }); // replace history, e.g. from your API
fc.logPractice(20);                   // add 20 minutes to today
fc.logPractice(45, '2026-10-10');     // or to another day

fc.tab = 'chords';
fc.showChord('Cadd9');
fc.strum();

fc.bpm = 110;
fc.startMetronome(80);
fc.stopMetronome();

await fc.startTuner();                // must follow a user click
fc.stopTuner();
```

`FretboardCompanion.chords` lists the chord library, and `FretboardCompanion.detectPitch(float32Samples, sampleRate)` exposes the pitch detector.

## Theming

Set these CSS custom properties on the element:

```css
fretboard-companion {
  --fc-accent: #2F66CC;        /* accent in light mode */
  --fc-accent-dark: #7FA8F2;   /* accent in dark mode */
  --fc-accent-ink: #fff;       /* text on accent buttons */
  --fc-surface: #fff;          /* card background (light) */
  --fc-surface-dark: #111;     /* card background (dark) */
  --fc-radius: 12px;
  --fc-font-display: 'Oswald', sans-serif;
  --fc-font-body: Inter, sans-serif;
  --fc-font-mono: 'JetBrains Mono', monospace;
}
fretboard-companion::part(card) { box-shadow: 0 8px 24px rgb(0 0 0 / .08); }
```

The heatmap ramp is built from the accent, so a new accent recolors it too.

## Where data lives

The practice log, a running session, and the user's tempo, time signature and last tab are saved in `localStorage` under `storage-key`. A session survives a page reload, and the log stays in sync across browser tabs. To store history on a server, listen for `practice-log-change` and restore it with `setPracticeLog()`.

## How it works

- **Pitch detection** uses the McLeod Pitch Method (normalized square difference with parabolic peak interpolation). It runs on a 2048-sample window (4096 at 96 kHz) about 20 times a second, and a short median filter steadies the needle. On synthetic test tones from low E to high E it is accurate to within half a cent.
- **Reference tones and strums** use Karplus-Strong plucked-string synthesis, corrected to exact pitch with `playbackRate`. Re-plucking a string damps the note it was already playing, like a real guitar.
- **The metronome** schedules clicks ahead on the Web Audio clock, so timing stays exact even when the page is busy. It schedules further ahead when the tab is in the background.

Works in current Chrome, Edge, Firefox and Safari.
