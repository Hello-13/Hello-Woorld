# Hello-Woorld 

Hi Humans!

Paul here, I like to play the guitar, but Im still learning it. 
I used to play the piano but think the guitar is far superior.

---

## String Theory 🎸

A guitar practice studio that runs entirely in the browser: ten tools laid out as a pedalboard of stompboxes. No samples and no server. Every sound is synthesised live, and the tuner listens through your microphone.

| Pedal | What it does |
| --- | --- |
| **ST-01 Tuner** | Microphone tuner with a needle and a strobe display, ten tunings (standard, drop D, DADGAD, open G…), adjustable A4 calibration, and reference tones for tuning by ear. |
| **ST-02 Metronome** | A metronome that keeps time on the audio clock, with accents, 2/4 to 12/8, subdivisions, tap tempo, a speed trainer and silent bars. The animated pyramid metronome's weight slides with the tempo. |
| **ST-03 Chord Lab** | Any chord (24 types, slash chords too) with every comfortable shape up the neck, fingered and ranked. Works in any tuning. "Name a shape" tells you what chord your fingers are holding. "Song sheet" turns any pasted chord sheet (chords over lyrics, or ChordPro) into tappable shapes, with transpose, an easiest-capo finder and auto-scroll. |
| **ST-04 Scale Map** | 15 scales and modes across the neck, coloured by degree, filtered to hand positions, played back note by note, with the scale's chords and the same scale on a piano. |
| **ST-05 Backing Band** | Drums, bass and a rhythm guitar playing 12 classic progressions and 5 traditional songs (or your own, by name or roman numeral) in any key. It has 8 strum feels plus fingerpicking (6/8 arpeggio, Travis, folk), capo support, and the current and next chord shown large. |
| **ST-06 Chord Changes** | The one-minute changes drill, with results charted per chord pair. Count by tapping, or let the mic count your strums. |
| **ST-07 Note Hunt** | A 60-second game for learning the fretboard: find it, name it, or play it on your guitar. Every answer is logged, and a heat map shows your weak spots. |
| **ST-08 Ear Trainer** | Intervals (each with a reference song), chord qualities and open strings, with accuracy tracked per item. |
| **ST-09 Piano Bridge** | Play notes on a piano (on screen, with your computer keyboard or with a MIDI keyboard) and see exactly where they live on the guitar, what chord they make, and a guitar shape for it. Built for piano players picking up guitar. |
| **ST-10 Tab Trainer** | Public-domain melodies (Ode to Joy, Amazing Grace, Frère Jacques…) and warm-ups as scrolling tab, fingered automatically. Listen, play along with the mic scoring every note, or use "wait for me" mode, which moves on only when you play the right note. |

Practice time is logged automatically: minutes per day, a streak and a week chart on the home pedalboard. Everything is stored in your browser only.

When String Theory runs as a claude.ai Artifact, the home page also gets a **practice coach**. It asks Claude (on your own account, after you allow it) to plan a session from your practice log, and answers guitar questions. Everywhere else the panel simply isn't there.

### Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # music theory and DSP unit tests
npm run build      # static site in dist/
npm run build:artifact   # everything inlined into one HTML file in artifact/
```

The tuner and the listening games need microphone access, which browsers only allow on `https://` pages or `localhost`.

On the hosted site String Theory is an installable app: use your browser's *Add to Home Screen* or *Install* option and it works offline after the first visit.

### Deploy

`.github/workflows/pages.yml` builds and publishes the site to GitHub Pages on every push to `master`. Turn it on once under **Settings → Pages → Build and deployment → Source: GitHub Actions**. The site then lives at `https://hello-13.github.io/Hello-Woorld/`.

### How it works

- **The guitar sound** is a Karplus–Strong plucked string (`src/audio/pluck.ts`): a burst of noise circulating in a delay line one period long, with a damping filter, an all-pass for exact tuning and a pick-position comb. It runs through a small body EQ and a synthetic room reverb. Tests check it is in tune to within 4 cents from low E to the 20th fret.
- **Pitch detection** uses the YIN algorithm (`src/audio/pitch.ts`), decimated to about 24 kHz so it is cheap enough to run 30 times a second.
- **Timing** uses the "two clocks" lookahead scheduler (`src/audio/scheduler.ts`), with the ticker in a Web Worker so background tabs don't stutter.
- **Melodies written by note name** are fingered with a shortest-path (Viterbi) search over every place each note can be played, which keeps the hand in one position (`src/theory/melody.ts`).
- **Chord shapes** come from a search over every hand position in any tuning (`src/theory/voicings.ts`). It keeps shapes that contain the essential chord tones, have no muted strings in the middle and need no more than four fingers (index barres and ring-finger barres included), then ranks them. Hand-checked open shapes come first in standard tuning.
- **The fretboard** is drawn with true 12th-root-of-two fret spacing, eased a little so high frets stay tappable. It turns vertical on phones, where a sideways neck would be too thin to read.
- Built with [Preact](https://preactjs.com/), TypeScript and Vite. Tests run on Vitest.

```
src/
  theory/      notes, intervals, scales, chords, keys, tunings, voicing generator (+ tests)
  audio/       engine (mixer), Karplus–Strong pluck, drum kit, scheduler, YIN, mic (+ tests)
  components/  Fretboard, ChordDiagram, Piano, shared UI
  state/       settings and practice log (localStorage)
  tools/       one file per pedal, plus the Home pedalboard
```
