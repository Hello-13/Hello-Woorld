/*!
 * <fretboard-companion> v1.0.0
 * A drop-in guitar practice widget for any dashboard: chromatic tuner,
 * chord of the day, metronome and practice-streak tracker.
 * Zero dependencies. Framework-agnostic Web Component. MIT License.
 */
(function () {
  'use strict';

  if (typeof window === 'undefined' || !window.customElements) return;
  if (customElements.get('fretboard-companion')) return;

  /* ------------------------------------------------------------------ *
   * Music helpers
   * ------------------------------------------------------------------ */

  const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const STRINGS = [
    { midi: 40, note: 'E', num: 6, name: 'low E' },
    { midi: 45, note: 'A', num: 5, name: 'A' },
    { midi: 50, note: 'D', num: 4, name: 'D' },
    { midi: 55, note: 'G', num: 3, name: 'G' },
    { midi: 59, note: 'B', num: 2, name: 'B' },
    { midi: 64, note: 'E', num: 1, name: 'high E' },
  ];

  const mod12 = (n) => ((n % 12) + 12) % 12;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const midiToFreq = (m, a4) => a4 * Math.pow(2, (m - 69) / 12);
  const freqToMidi = (f, a4) => 69 + 12 * Math.log2(f / a4);
  const octaveOf = (m) => Math.floor(m / 12) - 1;
  const median = (arr) => {
    const s = arr.slice().sort((a, b) => a - b);
    const mid = s.length >> 1;
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  };

  // Spell chord tones relative to the root so C7 shows B♭, not A♯.
  const LETTERS = 'CDEFGAB';
  const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
  const DEGREE_STEP = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6];
  function parseRoot(name) {
    const m = /^([A-G])([#b]?)/.exec(name);
    const li = LETTERS.indexOf(m[1]);
    const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
    return { li, pc: mod12(LETTER_PC[li] + acc) };
  }
  function spell(root, pc) {
    const li = (root.li + DEGREE_STEP[mod12(pc - root.pc)]) % 7;
    let diff = mod12(pc - LETTER_PC[li]);
    if (diff > 6) diff -= 12;
    return LETTERS[li] + (diff > 0 ? '♯'.repeat(diff) : '♭'.repeat(-diff));
  }
  const prettyName = (s) => s.replace(/^([A-G])#/, '$1♯').replace(/^([A-G])b/, '$1♭');

  // Frets run low E -> high E. -1 = muted, 0 = open. Fingers: 1 index ... 4 pinky.
  const CHORDS = [
    { id: 'C', name: 'C', full: 'C major', frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0], type: 'open', tip: 'Arch your ring finger so the open G string rings through.' },
    { id: 'A', name: 'A', full: 'A major', frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0], type: 'open', tip: 'Three fingers in one fret is a squeeze. Angle them slightly so each sits just behind the fret.' },
    { id: 'G', name: 'G', full: 'G major', frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3], type: 'open', tip: 'Once this feels easy, try 320033 for a fuller, more modern G.' },
    { id: 'E', name: 'E', full: 'E major', frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0], type: 'open', tip: 'All six strings ring. Strum from the low E and let it bloom.' },
    { id: 'D', name: 'D', full: 'D major', frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2], type: 'open', tip: 'Start your strum on the open D string and skip the two bass strings.' },
    { id: 'Am', name: 'Am', full: 'A minor', frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0], type: 'open', tip: 'The same shape as E major, moved over one string.' },
    { id: 'Em', name: 'Em', full: 'E minor', frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0], type: 'open', tip: 'Two fingers, six strings. A good warm-up for strumming patterns.' },
    { id: 'Dm', name: 'Dm', full: 'D minor', frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1], type: 'open', tip: 'Keep the low E and A quiet. Let your thumb rest lightly against the low E.' },
    { id: 'F', name: 'F', full: 'F major', frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], type: 'barre', tip: 'Roll your index finger slightly onto its bony edge for a cleaner barre.' },
    { id: 'Bm', name: 'Bm', full: 'B minor', frets: [-1, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1], type: 'barre', tip: 'Barre the 2nd fret from the A string down and leave the low E out.' },
    { id: 'Cmaj7', name: 'Cmaj7', full: 'C major seventh', frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0], type: 'open', tip: 'Play C and lift your index finger. Instant dreamy jazz.' },
    { id: 'Fmaj7', name: 'Fmaj7', full: 'F major seventh', frets: [-1, -1, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0], type: 'open', tip: 'A friendly stand-in for F while the full barre is still a fight.' },
    { id: 'Amaj7', name: 'Amaj7', full: 'A major seventh', frets: [-1, 0, 2, 1, 2, 0], fingers: [0, 0, 2, 1, 3, 0], type: 'open', tip: 'Bright and soft at once. Try it after a plain A to hear the change.' },
    { id: 'Dmaj7', name: 'Dmaj7', full: 'D major seventh', frets: [-1, -1, 0, 2, 2, 2], fingers: [0, 0, 0, 1, 2, 3], type: 'open', tip: 'Three fingers in a row on the 2nd fret. You can also barre them with one finger.' },
    { id: 'Gmaj7', name: 'Gmaj7', full: 'G major seventh', frets: [3, 2, 0, 0, 0, 2], fingers: [3, 2, 0, 0, 0, 1], type: 'open', tip: 'The F♯ on the top string gives G a gentle lift.' },
    { id: 'E7', name: 'E7', full: 'E dominant seventh', frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0], type: 'open', tip: 'The blues starts here. Pair it with A7 and B7.' },
    { id: 'A7', name: 'A7', full: 'A dominant seventh', frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0], type: 'open', tip: 'Leave the G string open. That open G is the seventh.' },
    { id: 'D7', name: 'D7', full: 'D dominant seventh', frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3], type: 'open', tip: 'An upside-down D shape. It pulls hard toward G.' },
    { id: 'G7', name: 'G7', full: 'G dominant seventh', frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1], type: 'open', tip: 'Resolve it to C and listen to it settle.' },
    { id: 'C7', name: 'C7', full: 'C dominant seventh', frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0], type: 'open', tip: 'Add your pinky to a C chord on the G string, 3rd fret.' },
    { id: 'B7', name: 'B7', full: 'B dominant seventh', frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4], type: 'open', tip: 'Four fingers, one open string. Watch that the B string rings open.' },
    { id: 'Am7', name: 'Am7', full: 'A minor seventh', frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0], type: 'open', tip: 'Am with one finger lifted. Softer and more open.' },
    { id: 'Em7', name: 'Em7', full: 'E minor seventh', frets: [0, 2, 0, 0, 0, 0], fingers: [0, 2, 0, 0, 0, 0], type: 'open', tip: 'One finger. Use the time you save on clean strumming.' },
    { id: 'Dm7', name: 'Dm7', full: 'D minor seventh', frets: [-1, -1, 0, 2, 1, 1], fingers: [0, 0, 0, 2, 1, 1], type: 'open', tip: 'A tiny barre with your index across the top two strings.' },
    { id: 'Asus2', name: 'Asus2', full: 'A suspended second', frets: [-1, 0, 2, 2, 0, 0], fingers: [0, 0, 1, 2, 0, 0], type: 'open', tip: 'Neither major nor minor. Rock between A, Asus2 and Asus4.' },
    { id: 'Asus4', name: 'Asus4', full: 'A suspended fourth', frets: [-1, 0, 2, 2, 3, 0], fingers: [0, 0, 1, 2, 3, 0], type: 'open', tip: 'The 4th wants to fall back to the 3rd. Resolve it to A.' },
    { id: 'Dsus2', name: 'Dsus2', full: 'D suspended second', frets: [-1, -1, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 3, 0], type: 'open', tip: 'Lift the middle finger from D. Pretty and unresolved.' },
    { id: 'Dsus4', name: 'Dsus4', full: 'D suspended fourth', frets: [-1, -1, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 3, 4], type: 'open', tip: 'Add the pinky to D, then lift it on the beat. That\'s a classic rock move.' },
    { id: 'Esus4', name: 'Esus4', full: 'E suspended fourth', frets: [0, 2, 2, 2, 0, 0], fingers: [0, 2, 3, 4, 0, 0], type: 'open', tip: 'Tension that begs to resolve to E.' },
    { id: 'Cadd9', name: 'Cadd9', full: 'C added ninth', frets: [-1, 3, 2, 0, 3, 3], fingers: [0, 2, 1, 0, 3, 4], type: 'open', tip: 'Shares two anchor fingers with G (320033). Changes become effortless.' },
    { id: 'Fsm', name: 'F#m', full: 'F♯ minor', frets: [2, 4, 4, 2, 2, 2], fingers: [1, 3, 4, 1, 1, 1], type: 'barre', tip: 'An E-minor shape barred at the 2nd fret.' },
    { id: 'Bb', name: 'Bb', full: 'B♭ major', frets: [-1, 1, 3, 3, 3, 1], fingers: [0, 1, 3, 3, 3, 1], type: 'barre', tip: 'Flatten your ring finger across three strings and let the top E ring if you can.' },
    { id: 'B', name: 'B', full: 'B major', frets: [-1, 2, 4, 4, 4, 2], fingers: [0, 1, 3, 3, 3, 1], type: 'barre', tip: 'The B♭ shape one fret higher. Same work, new key.' },
    { id: 'Cm', name: 'Cm', full: 'C minor', frets: [-1, 3, 5, 5, 4, 3], fingers: [0, 1, 3, 4, 2, 1], type: 'barre', tip: 'The Bm shape slid up to the 3rd fret.' },
    { id: 'Gm', name: 'Gm', full: 'G minor', frets: [3, 5, 5, 3, 3, 3], fingers: [1, 3, 4, 1, 1, 1], type: 'barre', tip: 'An Em shape barred at the 3rd fret.' },
    { id: 'Am5', name: 'Am', full: 'A minor, 5th-fret barre', frets: [5, 7, 7, 5, 5, 5], fingers: [1, 3, 4, 1, 1, 1], type: 'barre', tip: 'The same chord as open Am, higher up the neck and darker.' },
    { id: 'E5', name: 'E5', full: 'E power chord', frets: [0, 2, 2, -1, -1, -1], fingers: [0, 1, 2, 0, 0, 0], type: 'power', tip: 'Root and fifth only. Palm-mute near the bridge for a chug.' },
    { id: 'A5', name: 'A5', full: 'A power chord', frets: [-1, 0, 2, 2, -1, -1], fingers: [0, 0, 1, 2, 0, 0], type: 'power', tip: 'Mute the high strings with the underside of your fretting fingers.' },
    { id: 'G5', name: 'G5', full: 'G power chord', frets: [3, 5, 5, -1, -1, -1], fingers: [1, 3, 4, 0, 0, 0], type: 'power', tip: 'This shape slides anywhere. Move it two frets up for A5.' },
  ];
  const TYPE_LABEL = { open: 'Open chord', barre: 'Barre chord', power: 'Power chord' };

  const TEMPO_MARKS = [
    [0, 'Grave'], [45, 'Largo'], [60, 'Larghetto'], [66, 'Adagio'], [76, 'Andante'],
    [108, 'Moderato'], [120, 'Allegro'], [168, 'Presto'], [200, 'Prestissimo'],
  ];
  const tempoName = (bpm) => TEMPO_MARKS.reduce((n, [b, name]) => (bpm >= b ? name : n), 'Grave');

  const SIGNATURES = {
    '2/4': { beats: 2, accents: [] },
    '3/4': { beats: 3, accents: [] },
    '4/4': { beats: 4, accents: [] },
    '6/8': { beats: 6, accents: [3] },
  };
  const BPM_MIN = 30;
  const BPM_MAX = 240;

  /* ------------------------------------------------------------------ *
   * Pitch detection: McLeod Pitch Method (normalised square difference)
   * ------------------------------------------------------------------ */

  function detectPitch(buf, sampleRate, minFreq, maxFreq) {
    minFreq = minFreq || 60;
    maxFreq = maxFreq || 1200;
    const n = buf.length;
    let rms = 0;
    for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / n);
    if (rms < 0.008) return null;

    const maxTau = Math.min(n >> 1, Math.floor(sampleRate / minFreq));
    const minTau = Math.max(2, Math.floor(sampleRate / maxFreq));
    const nsdf = new Float32Array(maxTau + 1);
    for (let tau = 0; tau <= maxTau; tau++) {
      let acf = 0;
      let m = 0;
      for (let i = 0, end = n - tau; i < end; i++) {
        const a = buf[i];
        const b = buf[i + tau];
        acf += a * b;
        m += a * a + b * b;
      }
      nsdf[tau] = m > 0 ? (2 * acf) / m : 0;
    }

    // Key maxima: the highest point of each positive lobe after the first zero crossing.
    const peaks = [];
    let pos = 0;
    while (pos < maxTau && nsdf[pos] > 0) pos++;
    let best = -1;
    for (; pos < maxTau; pos++) {
      if (nsdf[pos] > 0) {
        if (best < 0 || nsdf[pos] > nsdf[best]) best = pos;
      } else if (best >= 0) {
        peaks.push(best);
        best = -1;
      }
    }
    if (best >= 0) peaks.push(best);

    const usable = peaks.filter((p) => p >= minTau);
    if (!usable.length) return null;
    let top = 0;
    for (const p of usable) top = Math.max(top, nsdf[p]);
    const tau = usable.find((p) => nsdf[p] >= 0.9 * top);
    const clarity = nsdf[tau];
    if (clarity < 0.7) return null;

    const a = nsdf[tau - 1];
    const b = nsdf[tau];
    const c = nsdf[tau + 1];
    const denom = a - 2 * b + c;
    const shift = denom ? (0.5 * (a - c)) / denom : 0;
    return { freq: sampleRate / (tau + shift), clarity, rms };
  }

  /* ------------------------------------------------------------------ *
   * Audio engine (shared by every widget on the page)
   * ------------------------------------------------------------------ */

  // Karplus-Strong plucked string. Each sample is averaged with the one after
  // it, so the loop period is N - 0.5 samples; playbackRate corrects the rest.
  function pluckedString(ctx, freq) {
    const sr = ctx.sampleRate;
    const N = Math.max(2, Math.round(sr / freq + 0.5));
    const len = Math.floor(sr * 3.2);
    const buffer = ctx.createBuffer(1, len, sr);
    const out = buffer.getChannelData(0);
    const line = new Float32Array(N);
    let prev = 0;
    let mean = 0;
    for (let i = 0; i < N; i++) {
      prev += 0.55 * (Math.random() * 2 - 1 - prev);
      line[i] = prev;
      mean += prev;
    }
    mean /= N;
    for (let i = 0; i < N; i++) line[i] -= mean;

    const decay = 0.9965;
    let idx = 0;
    let peak = 0;
    for (let i = 0; i < len; i++) {
      const next = idx + 1 === N ? 0 : idx + 1;
      const cur = line[idx];
      line[idx] = decay * 0.5 * (cur + line[next]);
      out[i] = cur;
      const abs = cur < 0 ? -cur : cur;
      if (abs > peak) peak = abs;
      idx = next;
    }
    const fade = Math.floor(sr * 0.12);
    const norm = peak > 0 ? 0.85 / peak : 1;
    for (let i = 0; i < len; i++) {
      const tail = len - i;
      out[i] *= norm * (tail < fade ? tail / fade : 1);
    }
    return { buffer, rate: (freq * (N - 0.5)) / sr };
  }

  const engine = {
    ctx: null,
    bus: null,
    cache: new Map(),
    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -12;
        comp.ratio.value = 4;
        comp.attack.value = 0.003;
        comp.release.value = 0.25;
        this.bus = this.ctx.createGain();
        this.bus.gain.value = 0.8;
        this.bus.connect(comp);
        comp.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },
    pluck(freq, when, opts) {
      const ctx = this.ensure();
      if (!ctx) return null;
      const o = opts || {};
      const key = freq.toFixed(2);
      let entry = this.cache.get(key);
      if (!entry) {
        entry = pluckedString(ctx, freq);
        this.cache.set(key, entry);
      }
      const src = ctx.createBufferSource();
      src.buffer = entry.buffer;
      src.playbackRate.value = entry.rate;
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = Math.min(9000, 2400 + freq * 6);
      tone.Q.value = 0.4;
      const gain = ctx.createGain();
      gain.gain.value = o.gain == null ? 0.4 : o.gain;
      src.connect(tone);
      tone.connect(gain);
      if (ctx.createStereoPanner) {
        const pan = ctx.createStereoPanner();
        pan.pan.value = o.pan || 0;
        gain.connect(pan);
        pan.connect(this.bus);
      } else {
        gain.connect(this.bus);
      }
      const t = Math.max(when || 0, ctx.currentTime);
      src.start(t);
      return { src, gain, t };
    },
    damp(voice, at) {
      if (!voice || !this.ctx) return;
      const t = Math.max(at || 0, this.ctx.currentTime);
      try {
        voice.gain.gain.setTargetAtTime(0, t, 0.015);
        voice.src.stop(t + 0.12);
      } catch (e) { /* already stopped */ }
    },
    click(when, level) {
      const ctx = this.ctx;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(level === 2 ? 1760 : level === 1 ? 1320 : 990, when);
      const peak = level === 2 ? 0.9 : level === 1 ? 0.65 : 0.5;
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(peak, when + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.055);
      osc.connect(g);
      g.connect(this.bus);
      osc.start(when);
      osc.stop(when + 0.07);
    },
  };

  /* ------------------------------------------------------------------ *
   * Dates and practice log
   * ------------------------------------------------------------------ */

  const DAY = 86400000;
  const noon = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
  const pad = (n) => String(n).padStart(2, '0');
  const toKey = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const fromKey = (k) => {
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y, m - 1, d, 12);
  };
  const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
  const fmtDay = (d) => d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

  function sanitizeLog(obj) {
    const log = {};
    if (!obj || typeof obj !== 'object') return log;
    for (const k of Object.keys(obj)) {
      const v = Math.round(Number(obj[k]));
      if (KEY_RE.test(k) && v > 0) log[k] = Math.min(1440, v);
    }
    return log;
  }

  function practiceStats(log, today) {
    const has = (d) => (log[toKey(d)] || 0) > 0;
    let current = 0;
    let d = noon(today);
    if (!has(d)) d = addDays(d, -1);
    while (has(d)) {
      current++;
      d = addDays(d, -1);
    }
    const keys = Object.keys(log).filter((k) => log[k] > 0).sort();
    let best = 0;
    let run = 0;
    let prev = null;
    let total = 0;
    for (const k of keys) {
      const day = fromKey(k);
      run = prev && Math.round((day - prev) / DAY) === 1 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = day;
      total += log[k];
    }
    const dow = (today.getDay() + 6) % 7;
    let week = 0;
    for (let i = 0; i <= dow; i++) week += log[toKey(addDays(today, -i))] || 0;
    return { current, best: Math.max(best, current), week, total, days: keys.length };
  }

  // Deterministic example history, used only with the `sample-data` attribute.
  function sampleLog(today) {
    let seed = 20261;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const log = {};
    for (let i = 1; i <= 120; i++) {
      const d = addDays(today, -i);
      const weekend = d.getDay() === 0 || d.getDay() === 6;
      const chance = i <= 6 ? 1 : weekend ? 0.75 : 0.5;
      if (rnd() < chance) log[toKey(d)] = Math.round((10 + rnd() * 55) / 5) * 5;
    }
    delete log[toKey(addDays(today, -7))];
    return log;
  }

  const heatLevel = (min) => (!min ? 0 : min < 15 ? 1 : min < 30 ? 2 : min < 60 ? 3 : 4);

  function readStore(key) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function writeStore(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* storage unavailable: state lives in memory */ }
  }

  function hashString(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h;
  }

  /* ------------------------------------------------------------------ *
   * SVG builders
   * ------------------------------------------------------------------ */

  const GAUGE = { cx: 120, cy: 150, r: 120, degPerCent: 0.8 };

  function gaugeSvg() {
    const { cx, cy, r, degPerCent } = GAUGE;
    const pt = (deg, rad) => {
      const a = (deg * Math.PI) / 180;
      return [(cx + rad * Math.sin(a)).toFixed(2), (cy - rad * Math.cos(a)).toFixed(2)];
    };
    let ticks = '';
    let labels = '';
    for (let c = -50; c <= 50; c += 5) {
      const deg = c * degPerCent;
      const major = c % 25 === 0;
      const mid = c % 10 === 0;
      const [x1, y1] = pt(deg, r - (major ? 16 : mid ? 11 : 7));
      const [x2, y2] = pt(deg, r);
      ticks += `<line class="tick${major ? ' major' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
      if (major) {
        const [lx, ly] = pt(deg, r + 11);
        const label = c === 0 ? '0' : (c > 0 ? '+' : '−') + Math.abs(c);
        labels += `<text class="tick-label" x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle">${label}</text>`;
      }
    }
    const [ax, ay] = pt(-40, r);
    const [bx, by] = pt(40, r);
    const [zx, zy] = pt(-4, r + 3);
    const [wx, wy] = pt(4, r + 3);
    const [nx, ny] = pt(0, r + 6);
    return `
      <svg class="gauge" viewBox="0 0 240 110" aria-hidden="true">
        <path class="zone" d="M${zx} ${zy} A${r + 3} ${r + 3} 0 0 1 ${wx} ${wy}" fill="none"/>
        <path class="arc" d="M${ax} ${ay} A${r} ${r} 0 0 1 ${bx} ${by}" fill="none"/>
        ${ticks}${labels}
        <text class="gauge-sign" x="16" y="98" text-anchor="middle">♭</text>
        <text class="gauge-sign" x="224" y="98" text-anchor="middle">♯</text>
        <g class="needle" data-ref="needle">
          <line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}"/>
        </g>
      </svg>`;
  }

  function pendulumSvg() {
    let scale = '';
    for (let i = 0; i < 8; i++) {
      const y = 32 + i * 11;
      const half = 6 + i * 0.9;
      scale += `<line class="pm-scale" x1="${60 - half}" x2="${60 + half}" y1="${y}" y2="${y}"/>`;
    }
    return `
      <svg class="pendulum" viewBox="0 0 120 150" aria-hidden="true">
        <path class="pm-body" d="M22 140 L98 140 L75 10 Q74 6 70 6 L50 6 Q46 6 45 10 Z"/>
        <path class="pm-plate" d="M40 122 L80 122 L68 22 L52 22 Z"/>
        ${scale}
        <g class="pm-arm" data-ref="arm">
          <line class="pm-rod" x1="60" y1="128" x2="60" y2="16"/>
          <rect class="pm-weight" data-ref="weight" x="52" y="60" width="16" height="11" rx="2"/>
        </g>
        <circle class="pm-pivot" cx="60" cy="128" r="3.2"/>
        <rect class="pm-base" x="14" y="138" width="92" height="9" rx="3"/>
      </svg>`;
  }

  const DIA = { x0: 34, dx: 18, y0: 26, dy: 28, frets: 5 };

  function chordSvg(ch, root) {
    const { x0, dx, y0, dy, frets: nf } = DIA;
    const fretted = ch.frets.filter((f) => f > 0);
    const maxF = fretted.length ? Math.max.apply(null, fretted) : 0;
    const minF = fretted.length ? Math.min.apply(null, fretted) : 1;
    const base = maxF <= nf ? 1 : minF;
    const sx = (i) => x0 + i * dx;
    const fy = (f) => y0 + (f - base + 0.5) * dy;
    const right = sx(5);
    const bottom = y0 + nf * dy;
    let s = '';

    for (let f = base; f < base + nf; f++) {
      const y = fy(f);
      if (f === 3 || f === 5 || f === 7 || f === 9) {
        s += `<circle class="inlay" cx="${(x0 + right) / 2}" cy="${y}" r="3.2"/>`;
      } else if (f === 12) {
        s += `<circle class="inlay" cx="${sx(1.5)}" cy="${y}" r="3.2"/><circle class="inlay" cx="${sx(3.5)}" cy="${y}" r="3.2"/>`;
      }
    }
    for (let i = 0; i <= nf; i++) {
      const y = y0 + i * dy;
      const nut = i === 0 && base === 1;
      s += `<line class="${nut ? 'nut' : 'fret'}" x1="${x0 - (nut ? 1 : 0)}" x2="${right + (nut ? 1 : 0)}" y1="${y}" y2="${y}"/>`;
    }
    for (let i = 0; i < 6; i++) {
      s += `<line class="str" data-s="${i}" x1="${sx(i)}" x2="${sx(i)}" y1="${y0}" y2="${bottom}" style="stroke-width:${(1.9 - i * 0.2).toFixed(2)}px"/>`;
    }
    if (base > 1) {
      s += `<text class="fr-label" x="${x0 - 13}" y="${fy(base)}" text-anchor="end" dominant-baseline="middle">${base}fr</text>`;
    }
    for (let i = 0; i < 6; i++) {
      const x = sx(i);
      const y = y0 - 13;
      if (ch.frets[i] === 0) s += `<circle class="open" cx="${x}" cy="${y}" r="4.6"/>`;
      if (ch.frets[i] < 0) {
        s += `<path class="mute" d="M${x - 4} ${y - 4} L${x + 4} ${y + 4} M${x + 4} ${y - 4} L${x - 4} ${y + 4}"/>`;
      }
    }

    // Barres: one finger holding the same fret on two or more strings.
    const covered = new Set();
    for (let finger = 1; finger <= 4; finger++) {
      const idx = [];
      for (let i = 0; i < 6; i++) if (ch.fingers[i] === finger && ch.frets[i] > 0) idx.push(i);
      if (idx.length < 2) continue;
      const fret = ch.frets[idx[0]];
      if (!idx.every((i) => ch.frets[i] === fret)) continue;
      const a = Math.min.apply(null, idx);
      const b = Math.max.apply(null, idx);
      const y = fy(fret);
      s += `<rect class="barre" x="${sx(a) - 8}" y="${y - 8}" width="${sx(b) - sx(a) + 16}" height="16" rx="8"/>`;
      s += `<text class="finger" x="${sx(a)}" y="${y}" text-anchor="middle" dominant-baseline="central">${finger}</text>`;
      for (let i = a; i <= b; i++) if (ch.frets[i] === fret) covered.add(i);
    }
    for (let i = 0; i < 6; i++) {
      const f = ch.frets[i];
      if (f <= 0 || covered.has(i)) continue;
      const y = fy(f);
      s += `<circle class="dot" data-dot="${i}" cx="${sx(i)}" cy="${y}" r="8"/>`;
      if (ch.fingers[i]) {
        s += `<text class="finger" x="${sx(i)}" y="${y}" text-anchor="middle" dominant-baseline="central">${ch.fingers[i]}</text>`;
      }
    }
    for (let i = 0; i < 6; i++) {
      const f = ch.frets[i];
      if (f < 0) continue;
      const name = spell(root, mod12(STRINGS[i].midi + f));
      s += `<text class="str-note" x="${sx(i)}" y="${bottom + 17}" text-anchor="middle">${name}</text>`;
    }
    for (let i = 0; i < 6; i++) {
      const f = ch.frets[i];
      if (f < 0) continue;
      const midi = STRINGS[i].midi + f;
      const label = `Pluck the ${STRINGS[i].name} string: ${spell(root, mod12(midi))}${octaveOf(midi)}`;
      s += `<rect class="hit" data-pluck="${i}" x="${sx(i) - dx / 2}" y="${y0 - 22}" width="${dx}" height="${nf * dy + 46}" fill="transparent" tabindex="0" role="button" aria-label="${label}"/>`;
    }
    return s;
  }

  /* ------------------------------------------------------------------ *
   * Styles
   * ------------------------------------------------------------------ */

  const STYLES = `
    :host { display: block; min-width: 0; }
    :host([hidden]) { display: none; }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }

    /* Amp-panel layout: one card, a channel-selector tab row, a session strip along the bottom. */
    .fc {
      --bg: var(--fc-surface, #FBFAF7);
      --raised: #F3F1EC;
      --sunk: #EAE7E0;
      --line: #DCD7CD;
      --ink: var(--fc-ink, #1D1B18);
      --ink-2: #57524B;
      --muted: #736E65;
      --accent: var(--fc-accent, #B35C0A);
      --accent-ink: var(--fc-accent-ink, #FFFFFF);
      --good: #237A4A;
      --bad: #C0432F;
      --face: #F5EEDD;
      --face-ink: #3A342B;
      --face-line: #CDBF9F;
      --shadow: 0 1px 2px rgba(40, 30, 15, 0.06);
      --radius: var(--fc-radius, 14px);
      --f-display: var(--fc-font-display, 'Big Shoulders', 'Barlow Condensed', 'Arial Narrow', sans-serif);
      --f-body: var(--fc-font-body, 'Instrument Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif);
      --f-mono: var(--fc-font-mono, 'DM Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
      --accent-soft: color-mix(in oklab, var(--accent) 14%, var(--bg));
      --good-soft: color-mix(in oklab, var(--good) 16%, var(--bg));
      --heat-0: var(--sunk);
      --heat-1: color-mix(in oklab, var(--accent) 28%, var(--sunk));
      --heat-2: color-mix(in oklab, var(--accent) 52%, var(--sunk));
      --heat-3: color-mix(in oklab, var(--accent) 78%, var(--sunk));
      --heat-4: color-mix(in oklab, var(--accent) 82%, var(--ink));
      color-scheme: light;

      container: fc / inline-size;
      position: relative;
      background: var(--bg);
      color: var(--ink);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      font: 400 14px/1.45 var(--f-body);
      -webkit-font-smoothing: antialiased;
      overflow: hidden;
    }
    .fc[data-mode="dark"] {
      --bg: var(--fc-surface-dark, #171513);
      --raised: #201D1A;
      --sunk: #110F0D;
      --line: #35302A;
      --ink: var(--fc-ink-dark, #EEE8DD);
      --ink-2: #BAB2A6;
      --muted: #8D857A;
      --accent: var(--fc-accent-dark, var(--fc-accent, #EE9E3E));
      --accent-ink: var(--fc-accent-ink-dark, #1B1206);
      --good: #5CC48A;
      --bad: #F07B64;
      --face: #221D17;
      --face-ink: #EADFCB;
      --face-line: #4A4034;
      --shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
      --heat-4: color-mix(in oklab, var(--accent) 80%, #FFF3DF);
      color-scheme: dark;
    }

    button, select, input { font: inherit; color: inherit; }
    button { cursor: pointer; }
    :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    .mono { font-family: var(--f-mono); font-variant-numeric: tabular-nums; }
    .muted { color: var(--muted); }

    /* Header */
    .top {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 14px 16px 0;
    }
    .brand { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .pick { width: 18px; height: 18px; color: var(--accent); flex: none; }
    .brand-name {
      font: 700 15px/1 var(--f-display); letter-spacing: 0.08em; text-transform: uppercase;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .brand-name b { font-weight: 800; color: var(--accent); }
    .chip {
      display: inline-flex; align-items: center; gap: 6px; flex: none;
      padding: 3px 9px; border-radius: 999px;
      background: var(--accent-soft); color: var(--ink);
      font: 500 12px/1.3 var(--f-body);
    }
    .chip .lamp { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 22%, transparent); }

    /* Tabs */
    .tabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; padding: 10px 12px 0; border-bottom: 1px solid var(--line); }
    .tab {
      position: relative; background: none; border: 0; padding: 10px 2px 11px;
      font: 600 11.5px/1 var(--f-body); letter-spacing: 0.1em; text-transform: uppercase;
      color: var(--muted); white-space: nowrap;
    }
    .tab:hover { color: var(--ink-2); }
    .tab[aria-selected="true"] { color: var(--ink); }
    .tab[aria-selected="true"]::after {
      content: ''; position: absolute; left: 18%; right: 18%; bottom: -1px; height: 2px;
      border-radius: 2px 2px 0 0; background: var(--accent);
    }
    .tab .live { display: inline-block; width: 6px; height: 6px; margin-left: 5px; vertical-align: 2px; border-radius: 50%; background: var(--accent); animation: blink 1s steps(2, start) infinite; }
    @keyframes blink { to { visibility: hidden; } }

    .panel { padding: 16px; display: grid; gap: 14px; }
    .row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .between { justify-content: space-between; }

    /* Buttons */
    .btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 7px;
      height: 34px; padding: 0 14px; border-radius: 8px;
      border: 1px solid var(--line); background: var(--raised); color: var(--ink);
      font: 600 13px/1 var(--f-body); white-space: nowrap;
      transition: background-color .15s, border-color .15s, transform .08s;
    }
    .btn:hover { border-color: color-mix(in oklab, var(--line) 60%, var(--ink)); }
    .btn:active { transform: translateY(1px); }
    .btn svg { width: 14px; height: 14px; flex: none; }
    .btn.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
    .btn.primary:hover { background: color-mix(in oklab, var(--accent) 88%, var(--ink)); }
    .btn.ghost { background: transparent; border-color: transparent; color: var(--ink-2); }
    .btn.ghost:hover { background: var(--raised); }
    .btn.sm { height: 30px; padding: 0 11px; font-size: 12.5px; }
    .btn.wide { width: 100%; height: 40px; font-size: 14px; }
    .btn[disabled] { opacity: .55; cursor: default; }
    .icon-btn {
      width: 34px; height: 34px; flex: none; display: inline-grid; place-items: center;
      border-radius: 8px; border: 1px solid var(--line); background: var(--raised); color: var(--ink);
      font: 500 18px/1 var(--f-body);
    }
    .icon-btn:hover { border-color: color-mix(in oklab, var(--line) 60%, var(--ink)); }
    .icon-btn svg { width: 15px; height: 15px; }

    /* Tuner */
    .meter {
      position: relative; border-radius: 10px; background: var(--face);
      border: 1px solid var(--face-line);
      box-shadow: inset 0 1px 0 color-mix(in oklab, var(--face) 70%, #fff), inset 0 -18px 30px -24px rgba(0,0,0,.25);
      overflow: hidden;
      transition: box-shadow .25s, border-color .25s;
    }
    .fc[data-mode="dark"] .meter {
      background: radial-gradient(120% 90% at 50% 100%, color-mix(in oklab, var(--accent) 16%, var(--face)), var(--face) 70%);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.04), inset 0 -18px 30px -24px rgba(0,0,0,.6);
    }
    .meter[data-state="intune"] { border-color: var(--good); box-shadow: inset 0 0 0 1px var(--good), 0 0 0 3px color-mix(in oklab, var(--good) 18%, transparent); }
    .gauge { display: block; width: 100%; height: auto; }
    .gauge .arc { stroke: var(--face-ink); stroke-width: 1.2; opacity: .55; }
    .gauge .tick { stroke: var(--face-ink); stroke-width: 1; opacity: .55; }
    .gauge .tick.major { stroke-width: 1.8; opacity: .9; }
    .gauge .tick-label { fill: var(--face-ink); font: 500 8.5px var(--f-mono); opacity: .8; }
    .gauge .gauge-sign { fill: var(--face-ink); font: 600 15px var(--f-body); opacity: .6; }
    .gauge .zone { stroke: var(--good); stroke-width: 6; opacity: .35; transition: opacity .2s; }
    .meter[data-state="intune"] .zone { opacity: 1; }
    .needle line { stroke: var(--bad); stroke-width: 2; stroke-linecap: round; transition: stroke .2s; }
    .meter[data-state="idle"] .needle line, .meter[data-state="off"] .needle line { stroke: var(--face-ink); opacity: .45; }
    .meter[data-state="intune"] .needle line { stroke: var(--good); }

    .readout { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 4px 16px; }
    .note { font: 800 64px/0.9 var(--f-display); letter-spacing: -0.01em; min-width: 1.4em; display: flex; align-items: baseline; }
    .note.idle { color: var(--line); }
    .note sub { font: 600 22px/1 var(--f-display); color: var(--muted); margin-left: 2px; vertical-align: baseline; position: static; }
    .read-lines { display: grid; gap: 2px; min-width: 0; }
    .freq { font-size: 15px; color: var(--ink-2); }
    .freq b { font-weight: 500; color: var(--ink); }
    .status { font-weight: 600; font-size: 14px; color: var(--ink-2); }
    .meter-wrap[data-state="intune"] .status { color: var(--good); }
    .meter-wrap[data-state="flat"] .status, .meter-wrap[data-state="sharp"] .status { color: var(--bad); }

    .strings { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; }
    .string {
      position: relative; display: grid; justify-items: center; gap: 2px;
      padding: 8px 0 7px; border-radius: 9px; border: 1px solid var(--line); background: var(--raised);
      transition: border-color .15s, background-color .15s;
    }
    .string:hover { border-color: color-mix(in oklab, var(--line) 55%, var(--ink)); }
    .string .s-note { font: 700 21px/1 var(--f-display); }
    .string .s-meta { font: 400 10.5px/1 var(--f-mono); color: var(--muted); }
    .string.near { border-color: var(--accent); background: var(--accent-soft); }
    .string.ping { background: var(--accent-soft); }
    .string .tick-ok { position: absolute; top: 4px; right: 4px; width: 12px; height: 12px; color: var(--good); }
    .msg { margin: 0; padding: 10px 12px; border-radius: 8px; background: var(--raised); border: 1px solid var(--line); color: var(--ink-2); font-size: 13px; }

    /* Chords */
    .eyebrow { font: 600 11px/1.2 var(--f-body); letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
    .link { background: none; border: 0; padding: 0; color: var(--accent); font: 600 12.5px var(--f-body); text-decoration: underline; text-underline-offset: 3px; }
    .chord-body { display: grid; grid-template-columns: minmax(118px, 150px) minmax(0, 1fr); gap: 18px; align-items: start; }
    .diagram { width: 100%; height: auto; display: block; overflow: visible; }
    .diagram .fret { stroke: var(--line); stroke-width: 1.4; }
    .diagram .nut { stroke: var(--ink); stroke-width: 5; stroke-linecap: round; }
    .diagram .str { stroke: var(--ink-2); transform-box: fill-box; transform-origin: center; }
    .diagram .str.ring { stroke: var(--accent); animation: ring .1s linear 5; }
    @keyframes ring { 25% { transform: translateX(1.3px); } 75% { transform: translateX(-1.3px); } }
    .diagram .inlay { fill: var(--sunk); }
    .diagram .open { fill: none; stroke: var(--ink); stroke-width: 1.6; }
    .diagram .mute { stroke: var(--muted); stroke-width: 1.6; stroke-linecap: round; fill: none; }
    .diagram .dot, .diagram .barre { fill: var(--ink); }
    .diagram .finger { fill: var(--bg); font: 700 10px var(--f-body); pointer-events: none; }
    .diagram .fr-label { fill: var(--ink-2); font: 500 10.5px var(--f-mono); }
    .diagram .str-note { fill: var(--muted); font: 500 10px var(--f-mono); }
    .diagram .hit { cursor: pointer; outline: none; }
    .diagram .hit:hover, .diagram .hit:focus-visible { fill: color-mix(in oklab, var(--accent) 12%, transparent); }
    .diagram .hit:focus-visible { stroke: var(--accent); stroke-width: 1.5; }
    .chord-info { display: grid; gap: 6px; align-content: start; min-width: 0; }
    .chord-name { font: 800 54px/0.9 var(--f-display); letter-spacing: -0.01em; }
    .chord-full { font-weight: 600; color: var(--ink-2); }
    .chord-notes { font-size: 13px; color: var(--ink-2); }
    .tag { justify-self: start; padding: 2px 8px; border-radius: 6px; border: 1px solid var(--line); font: 500 11.5px/1.5 var(--f-body); color: var(--ink-2); }
    .tip { margin: 4px 0 0; color: var(--ink-2); font-size: 13px; line-height: 1.5; max-width: 34ch; text-wrap: pretty; }
    .chord-nav { display: flex; align-items: center; gap: 6px; margin-left: auto; }
    .chord-nav select {
      height: 34px; max-width: 128px; padding: 0 8px; border-radius: 8px; border: 1px solid var(--line);
      background: var(--raised); font: 500 13px var(--f-body);
    }

    /* Metronome */
    .metro-top { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 16px; align-items: center; }
    .pendulum { width: 100%; height: auto; display: block; }
    .pm-body { fill: var(--raised); stroke: var(--line); stroke-width: 1.5; }
    .pm-plate { fill: var(--sunk); }
    .pm-scale { stroke: var(--muted); stroke-width: 1; opacity: .6; }
    .pm-rod { stroke: var(--ink); stroke-width: 2.4; stroke-linecap: round; }
    .pm-weight { fill: var(--accent); }
    .pm-pivot { fill: var(--ink); }
    .pm-base { fill: var(--line); }
    .pm-arm { transform-box: view-box; transform-origin: 60px 128px; transition: transform .45s ease-out; }
    .pm-arm.live { transition: none; }
    .bpm { display: flex; align-items: baseline; gap: 6px; }
    .bpm-num { font: 800 60px/0.9 var(--f-display); font-variant-numeric: tabular-nums; }
    .bpm small { font: 600 12px var(--f-body); letter-spacing: .1em; color: var(--muted); }
    .marking { font: italic 500 15px var(--f-body); color: var(--ink-2); margin-top: 2px; }
    .beats { display: flex; gap: 6px; margin-top: 12px; flex-wrap: wrap; }
    .beat { width: 14px; height: 14px; border-radius: 50%; background: var(--sunk); border: 1px solid var(--line); transition: background-color .06s; }
    .beat.down { width: 18px; height: 14px; border-radius: 7px; }
    .beat.on { background: var(--ink-2); border-color: var(--ink-2); }
    .beat.down.on, .beat.acc.on { background: var(--accent); border-color: var(--accent); }
    .slider { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 10px; align-items: center; }
    input[type="range"] { width: 100%; accent-color: var(--accent); }
    .seg { display: inline-flex; padding: 3px; gap: 2px; border-radius: 9px; background: var(--sunk); }
    .seg button { height: 28px; padding: 0 10px; border: 0; border-radius: 6px; background: none; font: 500 13px var(--f-mono); color: var(--ink-2); }
    .seg button[aria-checked="true"] { background: var(--bg); color: var(--ink); box-shadow: var(--shadow); }
    .toggle { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ink-2); cursor: pointer; }
    .toggle input { width: 16px; height: 16px; accent-color: var(--accent); margin: 0; }
    .toggle b { font-weight: 600; color: var(--ink); }

    /* Practice */
    .sample { display: flex; gap: 8px; align-items: center; padding: 8px 10px; border-radius: 8px; border: 1px dashed var(--line); font-size: 12.5px; color: var(--ink-2); }
    .sample b { font-weight: 600; color: var(--ink); }
    .tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .tile { padding: 10px 12px 11px; border-radius: 10px; background: var(--raised); display: grid; gap: 4px; align-content: start; min-width: 0; }
    .t-label { font: 500 12px/1.2 var(--f-body); color: var(--ink-2); }
    .t-value { display: flex; align-items: baseline; gap: 4px; flex-wrap: wrap; }
    .t-value span { font: 800 30px/1 var(--f-display); font-variant-numeric: tabular-nums; }
    .t-value small { font-size: 12px; color: var(--muted); }
    .track { height: 5px; border-radius: 3px; background: color-mix(in oklab, var(--accent) 18%, var(--sunk)); overflow: hidden; margin-top: 3px; }
    .fill { height: 100%; border-radius: 3px; background: var(--accent); transition: width .4s ease; }
    .tile.goal-met .fill { background: var(--good); }
    .tile.goal-met .t-note { color: var(--good); }
    .t-note { font-size: 11.5px; color: var(--muted); }
    .heat-wrap { position: relative; display: grid; gap: 8px; }
    .heat-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    .heat { display: grid; gap: 3px; }
    .heat .m { font: 500 10px/1 var(--f-mono); color: var(--muted); white-space: nowrap; overflow: visible; height: 12px; }
    .heat .d { font: 500 9.5px/1 var(--f-mono); color: var(--muted); align-self: center; padding-right: 4px; }
    .cell { aspect-ratio: 1; border-radius: 3px; background: var(--heat-0); min-width: 0; }
    .cell[data-l="1"] { background: var(--heat-1); }
    .cell[data-l="2"] { background: var(--heat-2); }
    .cell[data-l="3"] { background: var(--heat-3); }
    .cell[data-l="4"] { background: var(--heat-4); }
    .cell.future { background: transparent; box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--line) 60%, transparent); }
    .cell.today { box-shadow: 0 0 0 1.5px var(--bg), 0 0 0 3px var(--ink); }
    .cell:not(.future):hover { box-shadow: 0 0 0 1.5px var(--bg), 0 0 0 3px var(--accent); }
    .legend { display: flex; align-items: center; gap: 3px; font: 500 10px var(--f-mono); color: var(--muted); }
    .legend i { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
    .legend span { margin: 0 3px; }
    .heat-tip {
      position: absolute; z-index: 2; pointer-events: none; padding: 5px 8px; border-radius: 6px;
      background: var(--ink); color: var(--bg); font: 500 12px/1.3 var(--f-body); white-space: nowrap;
      transform: translate(-50%, -100%); box-shadow: 0 4px 14px rgba(0,0,0,.18);
    }
    .heat-tip b { font-weight: 700; }
    .quick { color: var(--ink-2); font-size: 13px; }
    .quick .lbl { margin-right: auto; }

    /* Toast + session strip */
    .toast {
      display: flex; align-items: center; gap: 10px; justify-content: space-between;
      margin: 0 16px 10px; padding: 8px 8px 8px 12px; border-radius: 9px;
      background: var(--ink); color: var(--bg); font-size: 13px;
    }
    .toast button { background: none; border: 0; color: inherit; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; padding: 4px 6px; }
    .session {
      display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;
      padding: 10px 12px 10px 16px; border-top: 1px solid var(--line); background: var(--raised);
    }
    .sess-info { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .rec { width: 9px; height: 9px; border-radius: 50%; background: var(--line); flex: none; }
    .session[data-state="running"] .rec { background: var(--bad); box-shadow: 0 0 0 3px color-mix(in oklab, var(--bad) 22%, transparent); animation: pulse 1.6s ease-in-out infinite; }
    .session[data-state="paused"] .rec { background: var(--accent); }
    @keyframes pulse { 50% { opacity: .45; } }
    .sess-label { font-weight: 600; font-size: 13px; white-space: nowrap; }
    .sess-time { font-size: 14px; color: var(--ink-2); }
    .sess-actions { display: flex; gap: 6px; }

    @container fc (min-width: 560px) {
      .tuner-grid { grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); align-items: center; }
      .note { font-size: 72px; }
      .chord-body { grid-template-columns: 170px minmax(0, 1fr); }
      .metro-top { grid-template-columns: 120px minmax(0, 1fr); }
    }
    @container fc (max-width: 380px) {
      .panel { padding: 14px 12px; }
      .top { padding-inline: 12px; }
      .tabs { padding-inline: 6px; }
      .tab { letter-spacing: 0.04em; font-size: 11px; }
      .chord-body { grid-template-columns: 112px minmax(0, 1fr); gap: 12px; }
      .chord-name { font-size: 44px; }
      .note { font-size: 54px; }
      .bpm-num { font-size: 52px; }
      .t-value span { font-size: 25px; }
      .tile { padding: 9px 9px 10px; }
      .chord-nav { margin-left: 0; }
      .session { padding-left: 12px; }
    }
    .tuner-grid { display: grid; gap: 14px; }

    @media (prefers-reduced-motion: reduce) {
      .tab .live, .session[data-state="running"] .rec { animation: none; }
      .diagram .str.ring { animation: none; }
      .pm-arm, .fill, .btn { transition: none; }
    }
  `;

  /* ------------------------------------------------------------------ *
   * Template
   * ------------------------------------------------------------------ */

  const ICON = {
    play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.9v10.2c0 .5.5.8.9.5l8-5.1a.6.6 0 0 0 0-1l-8-5.1c-.4-.3-.9 0-.9.5z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="2.5" width="3" height="11" rx="1" fill="currentColor"/><rect x="9.5" y="2.5" width="3" height="11" rx="1" fill="currentColor"/></svg>',
    stop: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="1.5" fill="currentColor"/></svg>',
    check: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    prev: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    next: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    mic: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="1.5" width="5" height="8.5" rx="2.5" fill="currentColor"/><path d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    strum: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity=".5"/><path d="M11 1.5v13m0 0l-3-3m3 3l3-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  const TEMPLATE = `
    <div class="fc" part="card" data-mode="light">
      <header class="top">
        <div class="brand">
          <svg class="pick" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2c5.6 0 9.6 2.2 9.6 6.3 0 4.6-5.1 10.6-8.3 12.9a2.2 2.2 0 0 1-2.6 0C7.5 19.1 2.4 13.1 2.4 8.5c0-4.1 4-6.3 9.6-6.3z" fill="currentColor"/></svg>
          <span class="brand-name">Fretboard <b>Companion</b></span>
        </div>
        <span class="chip" data-ref="streakChip" hidden><span class="lamp"></span><span data-ref="streakText"></span></span>
      </header>

      <div class="tabs" role="tablist" aria-label="Guitar tools">
        <button class="tab" role="tab" id="tab-tuner" aria-controls="panel-tuner" data-tab="tuner">Tuner</button>
        <button class="tab" role="tab" id="tab-chords" aria-controls="panel-chords" data-tab="chords">Chords</button>
        <button class="tab" role="tab" id="tab-metronome" aria-controls="panel-metronome" data-tab="metronome">Tempo<span class="live" data-ref="metroLive" hidden></span></button>
        <button class="tab" role="tab" id="tab-practice" aria-controls="panel-practice" data-tab="practice">Practice</button>
      </div>

      <section class="panel" role="tabpanel" id="panel-tuner" aria-labelledby="tab-tuner" data-panel="tuner">
        <div class="tuner-grid">
          <div class="meter" data-ref="meter" data-state="off">${gaugeSvg()}</div>
          <div class="meter-wrap" data-ref="meterWrap" data-state="off">
            <div class="readout">
              <div class="note idle" data-ref="note" aria-hidden="true"><span data-ref="noteName">–</span><sub data-ref="noteOct"></sub></div>
              <div class="read-lines">
                <div class="freq mono"><b data-ref="freq">—</b> Hz <span data-ref="cents"></span></div>
                <div class="status" data-ref="tunerStatus" aria-live="polite">Start the tuner, then play one string</div>
              </div>
            </div>
          </div>
        </div>
        <div class="strings" role="group" aria-label="Reference tones in standard tuning" data-ref="strings"></div>
        <div class="row between">
          <button class="btn primary" data-ref="tunerBtn">${ICON.mic}<span>Start tuner</span></button>
          <span class="mono muted" data-ref="a4Label">A4 = 440 Hz</span>
        </div>
        <p class="msg" data-ref="tunerMsg" role="alert" hidden></p>
      </section>

      <section class="panel" role="tabpanel" id="panel-chords" aria-labelledby="tab-chords" data-panel="chords" hidden>
        <div class="row between">
          <span class="eyebrow" data-ref="chordEyebrow">Chord of the day</span>
          <button class="link" data-ref="chordToday" hidden>Back to today’s chord</button>
        </div>
        <div class="chord-body">
          <svg class="diagram" viewBox="0 0 140 196" data-ref="diagram" role="group" aria-label="Chord diagram"></svg>
          <div class="chord-info">
            <div class="chord-name" data-ref="chordName"></div>
            <div class="chord-full" data-ref="chordFull"></div>
            <div class="chord-notes mono" data-ref="chordNotes"></div>
            <span class="tag" data-ref="chordType"></span>
            <p class="tip" data-ref="chordTip"></p>
          </div>
        </div>
        <div class="row">
          <button class="btn primary" data-ref="strum">${ICON.strum}<span>Strum</span></button>
          <button class="btn" data-ref="arp">Arpeggio</button>
          <div class="chord-nav">
            <button class="icon-btn" data-ref="chordPrev" aria-label="Previous chord">${ICON.prev}</button>
            <label class="sr" for="chord-select">Choose a chord</label>
            <select id="chord-select" data-ref="chordSelect"></select>
            <button class="icon-btn" data-ref="chordNext" aria-label="Next chord">${ICON.next}</button>
          </div>
        </div>
      </section>

      <section class="panel" role="tabpanel" id="panel-metronome" aria-labelledby="tab-metronome" data-panel="metronome" hidden>
        <div class="metro-top">
          ${pendulumSvg()}
          <div>
            <div class="bpm"><span class="bpm-num" data-ref="bpmNum">96</span><small>BPM</small></div>
            <div class="marking" data-ref="marking">Andante</div>
            <div class="beats" data-ref="beats" aria-hidden="true"></div>
          </div>
        </div>
        <div class="slider">
          <button class="icon-btn" data-ref="bpmDown" aria-label="Slower by 1 BPM">−</button>
          <label class="sr" for="bpm-range">Tempo in beats per minute</label>
          <input type="range" id="bpm-range" data-ref="bpmRange" min="${BPM_MIN}" max="${BPM_MAX}" step="1" value="96">
          <button class="icon-btn" data-ref="bpmUp" aria-label="Faster by 1 BPM">+</button>
        </div>
        <div class="row between">
          <div class="seg" role="radiogroup" aria-label="Time signature" data-ref="sigs">
            ${Object.keys(SIGNATURES).map((s) => `<button role="radio" data-sig="${s}" aria-checked="false">${s}</button>`).join('')}
          </div>
          <button class="btn" data-ref="tap">Tap tempo</button>
        </div>
        <label class="toggle" for="trainer"><input type="checkbox" id="trainer" data-ref="trainer"><span><b>Speed trainer</b> · +2 BPM every 4 bars</span></label>
        <button class="btn primary wide" data-ref="metroBtn">${ICON.play}<span>Start metronome</span></button>
      </section>

      <section class="panel" role="tabpanel" id="panel-practice" aria-labelledby="tab-practice" data-panel="practice" hidden>
        <div class="sample" data-ref="sampleNote" hidden><b>Sample history</b><span>Your first logged session replaces it.</span></div>
        <div class="tiles">
          <div class="tile"><div class="t-label">Current streak</div><div class="t-value"><span data-ref="statStreak">0</span><small data-ref="statStreakUnit">days</small></div></div>
          <div class="tile" data-ref="weekTile">
            <div class="t-label">This week</div>
            <div class="t-value"><span data-ref="statWeek">0</span><small data-ref="statGoal">/ 150 min</small></div>
            <div class="track" role="progressbar" aria-label="Weekly practice goal" aria-valuemin="0" data-ref="weekBar"><div class="fill" data-ref="weekFill"></div></div>
          </div>
          <div class="tile"><div class="t-label">Best streak</div><div class="t-value"><span data-ref="statBest">0</span><small data-ref="statBestUnit">days</small></div></div>
        </div>
        <div class="heat-wrap" data-ref="heatWrap">
          <div class="heat-head">
            <span class="t-label" data-ref="heatTitle">Minutes per day</span>
            <span class="t-note mono" data-ref="heatTotal"></span>
          </div>
          <div class="heat" data-ref="heat" role="img"></div>
          <div class="row between">
            <span class="t-note">Mon–Sun, newest week on the right</span>
            <span class="legend" aria-hidden="true"><span>0</span><i style="background:var(--heat-0)"></i><i style="background:var(--heat-1)"></i><i style="background:var(--heat-2)"></i><i style="background:var(--heat-3)"></i><i style="background:var(--heat-4)"></i><span>60+ min</span></span>
          </div>
          <div class="heat-tip" data-ref="heatTip" hidden></div>
        </div>
        <div class="row quick">
          <span class="lbl">Practiced away from here?</span>
          <button class="btn sm" data-add="15">+15 min</button>
          <button class="btn sm" data-add="30">+30 min</button>
        </div>
      </section>

      <div class="toast" data-ref="toast" role="status" aria-live="polite" hidden>
        <span data-ref="toastText"></span>
        <button data-ref="toastUndo" hidden>Undo</button>
      </div>

      <footer class="session" data-ref="session" data-state="idle">
        <div class="sess-info">
          <span class="rec" aria-hidden="true"></span>
          <span class="sess-label" data-ref="sessLabel">Practice session</span>
          <span class="sess-time mono" data-ref="sessTime" role="timer" aria-label="Session length">0:00</span>
        </div>
        <div class="sess-actions">
          <button class="btn primary sm" data-ref="sessStart">${ICON.play}<span>Start</span></button>
          <button class="btn sm" data-ref="sessPause" hidden></button>
          <button class="btn sm" data-ref="sessFinish" hidden>${ICON.check}<span>Finish &amp; log</span></button>
          <button class="btn ghost sm" data-ref="sessDiscard" hidden>Discard</button>
        </div>
      </footer>
    </div>
  `;

  const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Big+Shoulders:wght@600;700;800&family=Instrument+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap';
  function ensureFonts() {
    if (document.querySelector('link[data-fretboard-fonts]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONT_HREF;
    link.setAttribute('data-fretboard-fonts', '');
    document.head.appendChild(link);
  }

  const TABS = ['tuner', 'chords', 'metronome', 'practice'];

  /* ------------------------------------------------------------------ *
   * The element
   * ------------------------------------------------------------------ */

  class FretboardCompanion extends HTMLElement {
    static get observedAttributes() {
      return ['theme', 'tab', 'weekly-goal', 'a4'];
    }

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._built = false;
      this._tuner = null;
      this._tunerPending = false;
      this._tuned = new Set();
      this._voices = [];
      this._metro = { running: false, timer: 0, raf: 0, queue: [], count: 0, bar: 0, nextTime: 0, lastBeat: null };
      this._taps = [];
      this._chordIndex = 0;
      this._onDay = true;
      this._heatWeeks = 12;
      this._tunerTick = this._tunerTick.bind(this);
      this._metroFrame = this._metroFrame.bind(this);
      this._onStorage = this._onStorage.bind(this);
      this._onVisibility = this._onVisibility.bind(this);
      this._resolveTheme = this._resolveTheme.bind(this);
    }

    /* ---------- lifecycle ---------- */

    connectedCallback() {
      if (!this._built) this._build();
      this._resolveTheme();
      this._themeObserver = new MutationObserver(this._resolveTheme);
      this._themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'data-bs-theme', 'data-color-scheme'] });
      this._mql = window.matchMedia('(prefers-color-scheme: dark)');
      this._mql.addEventListener('change', this._resolveTheme);
      this._resize = new ResizeObserver((entries) => {
        const w = entries[0].contentRect.width;
        const weeks = clamp(Math.floor((w - 24) / 21), 8, 26);
        if (weeks !== this._heatWeeks) {
          this._heatWeeks = weeks;
          this._renderPractice();
        }
      });
      this._resize.observe(this._root);
      window.addEventListener('storage', this._onStorage);
      document.addEventListener('visibilitychange', this._onVisibility);
      this._syncSessionTimer();
    }

    disconnectedCallback() {
      this.stopTuner();
      this.stopMetronome();
      clearInterval(this._sessTimer);
      this._sessTimer = 0;
      if (this._themeObserver) this._themeObserver.disconnect();
      if (this._mql) this._mql.removeEventListener('change', this._resolveTheme);
      if (this._resize) this._resize.disconnect();
      window.removeEventListener('storage', this._onStorage);
      document.removeEventListener('visibilitychange', this._onVisibility);
    }

    attributeChangedCallback(name) {
      if (!this._built) return;
      if (name === 'theme') this._resolveTheme();
      else if (name === 'tab') this._selectTab(this.getAttribute('tab'));
      else if (name === 'weekly-goal') this._renderPractice();
      else if (name === 'a4') this._renderStrings();
    }

    /* ---------- public API ---------- */

    get practiceLog() {
      return Object.assign({}, this._log);
    }

    setPracticeLog(log) {
      this._log = sanitizeLog(log);
      this._sample = false;
      this._save();
      this._renderPractice();
      this._emit('practice-log-change', { log: this.practiceLog });
    }

    logPractice(minutes, date) {
      const m = Math.round(Number(minutes));
      if (!(m > 0)) return null;
      let key = toKey(new Date());
      if (typeof date === 'string' && KEY_RE.test(date)) key = date;
      else if (date instanceof Date && !isNaN(date)) key = toKey(date);
      const before = { log: Object.assign({}, this._log), sample: this._sample };
      if (this._sample) {
        this._sample = false;
        this._log = {};
      }
      this._log[key] = Math.min(1440, (this._log[key] || 0) + m);
      this._save();
      this._renderPractice();
      const stats = practiceStats(this._log, noon(new Date()));
      this._emit('practice-logged', { date: key, minutes: m, totalForDay: this._log[key], streak: stats.current, weekMinutes: stats.week });
      this._emit('practice-log-change', { log: this.practiceLog });
      return before;
    }

    get bpm() {
      return this._prefs.bpm;
    }
    set bpm(v) {
      this._setBpm(v);
    }

    get tab() {
      return this._tab;
    }
    set tab(v) {
      this._selectTab(v);
    }

    showChord(nameOrId) {
      const i = CHORDS.findIndex((c) => c.id === nameOrId || c.name === nameOrId);
      if (i >= 0) this._setChord(i);
      return i >= 0;
    }

    strum() {
      this._strum(false);
    }

    startMetronome(bpm) {
      if (bpm) this._setBpm(bpm);
      this._startMetro();
    }

    stopMetronome() {
      this._stopMetro();
    }

    /* ---------- build ---------- */

    _build() {
      this._built = true;
      if (!this.hasAttribute('no-fonts')) ensureFonts();
      const style = document.createElement('style');
      style.textContent = STYLES;
      this.shadowRoot.appendChild(style);
      const tpl = document.createElement('template');
      tpl.innerHTML = TEMPLATE;
      this.shadowRoot.appendChild(tpl.content.cloneNode(true));
      this._root = this.shadowRoot.querySelector('.fc');
      this.$ = {};
      this.shadowRoot.querySelectorAll('[data-ref]').forEach((el) => (this.$[el.dataset.ref] = el));
      this._reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      this._key = this.getAttribute('storage-key') || 'fretboard-companion';
      const saved = readStore(this._key) || {};
      this._log = sanitizeLog(saved.log);
      const sess = saved.session || {};
      this._session = {
        state: ['running', 'paused'].includes(sess.state) ? sess.state : 'idle',
        startedAt: Number(sess.startedAt) || 0,
        acc: Number(sess.acc) || 0,
      };
      const prefs = saved.prefs || {};
      const attrBpm = Number(this.getAttribute('bpm'));
      this._prefs = {
        bpm: clamp(Math.round(Number(prefs.bpm) || attrBpm || 96), BPM_MIN, BPM_MAX),
        sig: SIGNATURES[prefs.sig] ? prefs.sig : '4/4',
        trainer: !!prefs.trainer,
        tab: TABS.includes(prefs.tab) ? prefs.tab : null,
      };
      this._sample = this.hasAttribute('sample-data') && !Object.keys(this._log).length;
      this._sampleLog = null;

      this._wireTabs();
      this._wireTuner();
      this._wireChords();
      this._wireMetronome();
      this._wirePractice();
      this._wireSession();

      this._renderStrings();
      this._setChord(this._chordOfDayIndex(), true);
      this._renderMetronome();
      this._renderPractice();
      this._renderSession();
      const attrTab = this.getAttribute('tab');
      this._selectTab(this._prefs.tab || (TABS.includes(attrTab) ? attrTab : 'tuner'));
    }

    _emit(name, detail) {
      this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
    }

    _save() {
      writeStore(this._key, { v: 1, log: this._log, session: this._session, prefs: this._prefs });
    }

    get _a4() {
      const v = Number(this.getAttribute('a4'));
      return v >= 400 && v <= 480 ? v : 440;
    }

    _resolveTheme() {
      const attr = (this.getAttribute('theme') || 'auto').toLowerCase();
      let mode = attr;
      if (mode !== 'light' && mode !== 'dark') {
        const root = document.documentElement;
        const hint = root.getAttribute('data-theme') || root.getAttribute('data-bs-theme') || root.getAttribute('data-color-scheme');
        if (hint === 'dark' || hint === 'light') mode = hint;
        else if (root.classList.contains('dark')) mode = 'dark';
        else if (root.classList.contains('light')) mode = 'light';
        else mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      if (this._root) this._root.dataset.mode = mode;
    }

    _onVisibility() {
      if (document.hidden) {
        if (this._tuner) this.stopTuner();
      } else {
        this._renderSession();
      }
    }

    _onStorage(e) {
      if (e.key !== this._key) return;
      const saved = readStore(this._key) || {};
      this._log = sanitizeLog(saved.log);
      if (Object.keys(this._log).length) this._sample = false;
      if (saved.session) this._session = Object.assign(this._session, saved.session);
      this._renderPractice();
      this._renderSession();
      this._syncSessionTimer();
    }

    /* ---------- tabs ---------- */

    _wireTabs() {
      this._tabs = Array.from(this.shadowRoot.querySelectorAll('[role="tab"]'));
      this._tabs.forEach((t) => {
        t.addEventListener('click', () => this._selectTab(t.dataset.tab, true));
        t.addEventListener('keydown', (e) => {
          const i = this._tabs.indexOf(t);
          let j = null;
          if (e.key === 'ArrowRight') j = (i + 1) % this._tabs.length;
          else if (e.key === 'ArrowLeft') j = (i - 1 + this._tabs.length) % this._tabs.length;
          else if (e.key === 'Home') j = 0;
          else if (e.key === 'End') j = this._tabs.length - 1;
          if (j === null) return;
          e.preventDefault();
          this._selectTab(this._tabs[j].dataset.tab, true);
          this._tabs[j].focus();
        });
      });
    }

    _selectTab(name, fromUser) {
      if (!TABS.includes(name)) return;
      if (this._tab === 'tuner' && name !== 'tuner') this.stopTuner();
      this._tab = name;
      this._tabs.forEach((t) => {
        const on = t.dataset.tab === name;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      });
      this.shadowRoot.querySelectorAll('[role="tabpanel"]').forEach((p) => (p.hidden = p.dataset.panel !== name));
      if (name === 'practice') this._renderPractice();
      if (name === 'chords' && this._onDay) this._setChord(this._chordOfDayIndex(), true);
      if (fromUser) {
        this._prefs.tab = name;
        this._save();
      }
    }

    /* ---------- tuner ---------- */

    _wireTuner() {
      this.$.tunerBtn.addEventListener('click', () => (this._tuner ? this.stopTuner() : this.startTuner()));
      this.$.strings.addEventListener('click', (e) => {
        const b = e.target.closest('[data-string]');
        if (!b) return;
        const i = Number(b.dataset.string);
        this._pluckString(i, STRINGS[i].midi, { gain: 0.55 });
        b.classList.add('ping');
        setTimeout(() => b.classList.remove('ping'), 350);
      });
    }

    _renderStrings() {
      const a4 = this._a4;
      this.$.a4Label.textContent = `A4 = ${a4} Hz`;
      this.$.strings.innerHTML = STRINGS.map((s, i) => {
        const hz = midiToFreq(s.midi, a4).toFixed(1);
        const tuned = this._tuned.has(i);
        return `<button class="string" data-string="${i}" aria-label="Play ${s.name} string reference, ${s.note}${octaveOf(s.midi)}, ${hz} hertz${tuned ? ', tuned' : ''}">
          <span class="s-note">${s.note}</span><span class="s-meta">${s.note}${octaveOf(s.midi)}</span>
          ${tuned ? `<span class="tick-ok">${ICON.check}</span>` : ''}
        </button>`;
      }).join('');
    }

    async startTuner() {
      if (this._tuner || this._tunerPending) return;
      this._tunerMessage('');
      const md = navigator.mediaDevices;
      if (!md || !md.getUserMedia) {
        this._tunerMessage('The tuner needs microphone access, which browsers only allow on secure pages (https or localhost). You can still tune by ear with the reference strings above.');
        return;
      }
      const policy = document.permissionsPolicy || document.featurePolicy;
      if (policy && policy.allowsFeature && !policy.allowsFeature('microphone')) {
        this._tunerMessage('This page isn’t allowed to use the microphone. If the widget sits in an iframe, add allow="microphone" to it. Meanwhile, tune by ear with the reference strings above.');
        return;
      }
      const ctx = engine.ensure();
      if (!ctx) {
        this._tunerMessage('This browser has no Web Audio support, so the tuner can’t run here.');
        return;
      }
      this._tunerPending = true;
      this._setTunerButton('Waiting for microphone…', true);
      let stream;
      try {
        stream = await md.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      } catch (err) {
        this._tunerPending = false;
        this._setTunerButton('Start tuner', false);
        const name = err && err.name;
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          this._tunerMessage('Microphone access is blocked. Allow it in your browser’s site settings, or tune by ear with the reference strings above.');
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          this._tunerMessage('No microphone was found. Plug one in, or tune by ear with the reference strings above.');
        } else {
          this._tunerMessage('The microphone couldn’t start. Check that no other app is using it, then try again.');
        }
        return;
      }
      this._tunerPending = false;
      if (!this.isConnected || this._tab !== 'tuner') {
        stream.getTracks().forEach((t) => t.stop());
        this._setTunerButton('Start tuner', false);
        return;
      }
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = ctx.sampleRate > 50000 ? 4096 : 2048;
      src.connect(an);
      this._tuner = {
        stream, src, an,
        buf: new Float32Array(an.fftSize),
        hist: [], lastDetect: 0, lastHeard: 0, inTuneSince: 0, lastEmit: 0,
        needle: 0, target: 0, state: null, showing: false,
      };
      this._tuned.clear();
      this._renderStrings();
      this._setTunerButton('Stop tuner', false, true);
      this._setTunerState('idle', 'Listening… play one string');
      this._tuner.raf = requestAnimationFrame(this._tunerTick);
    }

    stopTuner() {
      const T = this._tuner;
      if (!T) return;
      cancelAnimationFrame(T.raf);
      T.stream.getTracks().forEach((t) => t.stop());
      try { T.src.disconnect(); } catch (e) { /* noop */ }
      this._tuner = null;
      this._setTunerButton('Start tuner', false);
      this._clearReadout();
      this._setTunerState('off', 'Start the tuner, then play one string');
      this.$.needle.setAttribute('transform', `rotate(0 ${GAUGE.cx} ${GAUGE.cy})`);
      this.$.strings.querySelectorAll('.near').forEach((b) => b.classList.remove('near'));
    }

    _setTunerButton(label, busy, running) {
      const b = this.$.tunerBtn;
      b.disabled = !!busy;
      b.innerHTML = `${running ? ICON.stop : ICON.mic}<span>${label}</span>`;
      b.classList.toggle('primary', !running);
    }

    _tunerMessage(text) {
      this.$.tunerMsg.textContent = text;
      this.$.tunerMsg.hidden = !text;
    }

    _setTunerState(state, status) {
      if (this._tuner) this._tuner.state = state;
      this.$.meter.dataset.state = state;
      this.$.meterWrap.dataset.state = state;
      if (this.$.tunerStatus.textContent !== status) this.$.tunerStatus.textContent = status;
    }

    _clearReadout() {
      this.$.note.classList.add('idle');
      this.$.noteName.textContent = '–';
      this.$.noteOct.textContent = '';
      this.$.freq.textContent = '—';
      this.$.cents.textContent = '';
    }

    _tunerTick(now) {
      const T = this._tuner;
      if (!T) return;
      if (now - T.lastDetect >= 50) {
        T.lastDetect = now;
        T.an.getFloatTimeDomainData(T.buf);
        const res = detectPitch(T.buf, engine.ctx.sampleRate);
        if (res) {
          const m = freqToMidi(res.freq, this._a4);
          if (T.hist.length && Math.abs(m - median(T.hist)) > 0.6) T.hist.length = 0;
          T.hist.push(m);
          if (T.hist.length > 7) T.hist.shift();
          T.lastHeard = now;
          if (T.hist.length >= 2) this._showPitch(median(T.hist), now);
        } else if (T.showing && now - T.lastHeard > 1500) {
          T.hist.length = 0;
          T.showing = false;
          T.target = 0;
          T.inTuneSince = 0;
          this._clearReadout();
          this._setTunerState('idle', 'Listening… play one string');
          this.$.strings.querySelectorAll('.near').forEach((b) => b.classList.remove('near'));
        }
      }
      T.needle += (T.target - T.needle) * (this._reducedMotion ? 1 : 0.22);
      this.$.needle.setAttribute('transform', `rotate(${T.needle.toFixed(2)} ${GAUGE.cx} ${GAUGE.cy})`);
      T.raf = requestAnimationFrame(this._tunerTick);
    }

    _showPitch(mf, now) {
      const T = this._tuner;
      const a4 = this._a4;
      const nearest = Math.round(mf);
      const cents = (mf - nearest) * 100;
      T.showing = true;
      T.target = clamp(cents, -50, 50) * GAUGE.degPerCent;

      this.$.note.classList.remove('idle');
      this.$.noteName.textContent = SHARP_NAMES[mod12(nearest)];
      this.$.noteOct.textContent = String(octaveOf(nearest));
      this.$.freq.textContent = midiToFreq(mf, a4).toFixed(1);
      const c = Math.round(cents);
      this.$.cents.textContent = `· ${c > 0 ? '+' : c < 0 ? '−' : '±'}${Math.abs(c)}¢`;

      const inTune = Math.abs(cents) < 5;
      if (inTune) this._setTunerState('intune', 'In tune');
      else if (cents < 0) this._setTunerState('flat', 'Too low · tighten the string');
      else this._setTunerState('sharp', 'Too high · loosen the string');

      let near = -1;
      let bestDist = 1.5;
      STRINGS.forEach((s, i) => {
        const d = Math.abs(mf - s.midi);
        if (d < bestDist) { bestDist = d; near = i; }
      });
      this.$.strings.querySelectorAll('[data-string]').forEach((b) => b.classList.toggle('near', Number(b.dataset.string) === near));

      if (inTune && near >= 0 && STRINGS[near].midi === nearest) {
        if (!T.inTuneSince) T.inTuneSince = now;
        else if (now - T.inTuneSince > 600 && !this._tuned.has(near)) {
          this._tuned.add(near);
          this._renderStrings();
          this.$.strings.querySelector(`[data-string="${near}"]`).classList.add('near');
          if (this._tuned.size === 6) this._toast('All six strings tuned. Time to play.');
        }
      } else {
        T.inTuneSince = 0;
      }

      if (now - T.lastEmit > 200) {
        T.lastEmit = now;
        this._emit('tuner-pitch', {
          note: SHARP_NAMES[mod12(nearest)].replace('♯', '#'),
          octave: octaveOf(nearest),
          frequency: Number(midiToFreq(mf, a4).toFixed(2)),
          cents: Number(cents.toFixed(1)),
          inTune,
          string: near >= 0 ? STRINGS[near].num : null,
        });
      }
    }

    _pluckString(i, midi, opts) {
      const prev = this._voices[i];
      if (prev) engine.damp(prev, opts && opts.when);
      const v = engine.pluck(midiToFreq(midi, this._a4), opts && opts.when, {
        gain: opts && opts.gain,
        pan: (i - 2.5) * 0.08,
      });
      this._voices[i] = v;
      return v;
    }

    /* ---------- chords ---------- */

    _chordOfDayIndex() {
      return hashString('fretboard:' + toKey(new Date())) % CHORDS.length;
    }

    _wireChords() {
      this.$.chordSelect.innerHTML = CHORDS.map((c, i) => {
        const label = prettyName(c.name) + (c.id === 'Am5' ? ' (5th fret)' : '');
        return `<option value="${i}">${label}</option>`;
      }).join('');
      this.$.chordSelect.addEventListener('change', () => this._setChord(Number(this.$.chordSelect.value)));
      this.$.chordPrev.addEventListener('click', () => this._setChord((this._chordIndex - 1 + CHORDS.length) % CHORDS.length));
      this.$.chordNext.addEventListener('click', () => this._setChord((this._chordIndex + 1) % CHORDS.length));
      this.$.chordToday.addEventListener('click', () => this._setChord(this._chordOfDayIndex(), true));
      this.$.strum.addEventListener('click', () => this._strum(false));
      this.$.arp.addEventListener('click', () => this._strum(true));
      const pluckFrom = (target) => {
        const hit = target.closest && target.closest('[data-pluck]');
        if (!hit) return;
        const i = Number(hit.dataset.pluck);
        const ch = CHORDS[this._chordIndex];
        this._pluckString(i, STRINGS[i].midi + ch.frets[i], { gain: 0.5 });
        this._ringString(i, 0);
      };
      this.$.diagram.addEventListener('click', (e) => pluckFrom(e.target));
      this.$.diagram.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          pluckFrom(e.target);
        }
      });
    }

    _setChord(i, isDay) {
      const ch = CHORDS[i];
      const root = parseRoot(ch.name);
      this._chordIndex = i;
      this._onDay = !!isDay || i === this._chordOfDayIndex();
      this.$.diagram.innerHTML = chordSvg(ch, root);
      const shape = ch.frets.map((f) => (f < 0 ? 'x' : f)).join(' ');
      this.$.diagram.setAttribute('aria-label', `${ch.full} chord diagram, strings low to high: ${shape}`);
      this.$.chordName.textContent = prettyName(ch.name);
      this.$.chordFull.textContent = ch.full;
      const pcs = [];
      ch.frets.forEach((f, s) => {
        if (f < 0) return;
        const pc = mod12(STRINGS[s].midi + f);
        if (!pcs.includes(pc)) pcs.push(pc);
      });
      pcs.sort((a, b) => mod12(a - root.pc) - mod12(b - root.pc));
      this.$.chordNotes.textContent = pcs.map((pc) => spell(root, pc)).join(' · ');
      this.$.chordType.textContent = TYPE_LABEL[ch.type];
      this.$.chordTip.textContent = ch.tip;
      this.$.chordSelect.value = String(i);
      this.$.chordEyebrow.textContent = this._onDay ? `Chord of the day · ${fmtDay(new Date())}` : `Chord ${i + 1} of ${CHORDS.length}`;
      this.$.chordToday.hidden = this._onDay;
      if (!isDay) this._emit('chord-change', { id: ch.id, name: ch.name, fullName: ch.full, frets: ch.frets.slice() });
    }

    _strum(arpeggio) {
      const ctx = engine.ensure();
      if (!ctx) return;
      const ch = CHORDS[this._chordIndex];
      const gap = arpeggio ? 0.2 : 0.028;
      const start = ctx.currentTime + 0.03;
      let k = 0;
      for (let i = 0; i < 6; i++) {
        if (ch.frets[i] < 0) continue;
        const when = start + k * gap;
        this._pluckString(i, STRINGS[i].midi + ch.frets[i], { when, gain: arpeggio ? 0.45 : 0.32 });
        this._ringString(i, (when - ctx.currentTime) * 1000);
        k++;
      }
    }

    _ringString(i, delayMs) {
      setTimeout(() => {
        const line = this.$.diagram.querySelector(`.str[data-s="${i}"]`);
        if (!line) return;
        line.classList.remove('ring');
        void line.getBoundingClientRect();
        line.classList.add('ring');
        setTimeout(() => line.classList.remove('ring'), 700);
      }, Math.max(0, delayMs));
    }

    /* ---------- metronome ---------- */

    _wireMetronome() {
      this.$.metroBtn.addEventListener('click', () => (this._metro.running ? this._stopMetro() : this._startMetro()));
      this.$.bpmRange.addEventListener('input', () => this._setBpm(this.$.bpmRange.value));
      this.$.bpmDown.addEventListener('click', (e) => this._setBpm(this._prefs.bpm - (e.shiftKey ? 5 : 1)));
      this.$.bpmUp.addEventListener('click', (e) => this._setBpm(this._prefs.bpm + (e.shiftKey ? 5 : 1)));
      this.$.tap.addEventListener('click', () => this._tapTempo());
      this.$.trainer.addEventListener('change', () => {
        this._prefs.trainer = this.$.trainer.checked;
        this._save();
      });
      this.$.sigs.addEventListener('click', (e) => {
        const b = e.target.closest('[data-sig]');
        if (!b) return;
        this._prefs.sig = b.dataset.sig;
        this._save();
        this._metro.beatInBar = 0;
        this._renderMetronome();
      });
      this.$.sigs.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const keys = Object.keys(SIGNATURES);
        const i = keys.indexOf(this._prefs.sig);
        this._prefs.sig = keys[(i + (e.key === 'ArrowRight' ? 1 : keys.length - 1)) % keys.length];
        this._save();
        this._metro.beatInBar = 0;
        this._renderMetronome();
        this.$.sigs.querySelector(`[data-sig="${this._prefs.sig}"]`).focus();
      });
    }

    _setBpm(v) {
      const bpm = clamp(Math.round(Number(v) || this._prefs.bpm), BPM_MIN, BPM_MAX);
      if (bpm === this._prefs.bpm && this.$.bpmRange.value === String(bpm)) return;
      this._prefs.bpm = bpm;
      this._save();
      this._renderMetronome();
      this._emit('tempo-change', { bpm });
    }

    _tapTempo() {
      const now = performance.now();
      if (this._taps.length && now - this._taps[this._taps.length - 1] > 2000) this._taps = [];
      this._taps.push(now);
      if (this._taps.length > 5) this._taps.shift();
      if (this._taps.length >= 2) {
        const span = this._taps[this._taps.length - 1] - this._taps[0];
        this._setBpm(60000 / (span / (this._taps.length - 1)));
      }
      this.$.tap.textContent = this._taps.length < 2 ? 'Tap again…' : 'Tap tempo';
      clearTimeout(this._tapReset);
      this._tapReset = setTimeout(() => (this.$.tap.textContent = 'Tap tempo'), 2200);
    }

    _renderMetronome() {
      const { bpm, sig, trainer } = this._prefs;
      this.$.bpmNum.textContent = String(bpm);
      this.$.marking.textContent = tempoName(bpm);
      this.$.bpmRange.value = String(bpm);
      this.$.bpmRange.setAttribute('aria-valuetext', `${bpm} BPM, ${tempoName(bpm)}`);
      this.$.trainer.checked = trainer;
      this.$.sigs.querySelectorAll('[data-sig]').forEach((b) => {
        const on = b.dataset.sig === sig;
        b.setAttribute('aria-checked', String(on));
        b.tabIndex = on ? 0 : -1;
      });
      const S = SIGNATURES[sig];
      if (this.$.beats.childElementCount !== S.beats || this.$.beats.dataset.sig !== sig) {
        this.$.beats.dataset.sig = sig;
        this.$.beats.innerHTML = Array.from({ length: S.beats }, (_, i) =>
          `<span class="beat${i === 0 ? ' down' : ''}${S.accents.includes(i) ? ' acc' : ''}"></span>`).join('');
      }
      // On a real metronome the weight slides down the rod to go faster.
      const t = (bpm - BPM_MIN) / (BPM_MAX - BPM_MIN);
      this.$.weight.setAttribute('y', String((128 - (88 - t * 58) - 5.5).toFixed(1)));
    }

    _startMetro() {
      const ctx = engine.ensure();
      if (!ctx || this._metro.running) return;
      const M = this._metro;
      M.running = true;
      M.count = 0;
      M.beatInBar = 0;
      M.bar = 0;
      M.queue = [];
      M.lastBeat = null;
      M.nextTime = ctx.currentTime + 0.08;
      this._metroSchedule();
      M.timer = setInterval(() => this._metroSchedule(), 25);
      M.raf = requestAnimationFrame(this._metroFrame);
      this.$.arm.classList.add('live');
      this.$.metroBtn.innerHTML = `${ICON.stop}<span>Stop metronome</span>`;
      this.$.metroBtn.classList.remove('primary');
      this.$.metroLive.hidden = false;
      this._emit('metronome-change', { running: true, bpm: this._prefs.bpm, timeSignature: this._prefs.sig });
    }

    _stopMetro() {
      const M = this._metro;
      if (!M.running) return;
      M.running = false;
      clearInterval(M.timer);
      cancelAnimationFrame(M.raf);
      M.queue = [];
      this.$.arm.classList.remove('live');
      this.$.arm.style.transform = '';
      this.$.beats.querySelectorAll('.on').forEach((b) => b.classList.remove('on'));
      this.$.metroBtn.innerHTML = `${ICON.play}<span>Start metronome</span>`;
      this.$.metroBtn.classList.add('primary');
      this.$.metroLive.hidden = true;
      this._emit('metronome-change', { running: false, bpm: this._prefs.bpm, timeSignature: this._prefs.sig });
    }

    _metroSchedule() {
      const M = this._metro;
      const ctx = engine.ctx;
      if (!M.running || !ctx) return;
      // Background tabs throttle timers to ~1 s, so schedule further ahead there.
      const ahead = document.hidden ? 1.5 : 0.12;
      while (M.nextTime < ctx.currentTime + ahead) {
        const S = SIGNATURES[this._prefs.sig];
        const beat = M.beatInBar % S.beats;
        const level = beat === 0 ? 2 : S.accents.includes(beat) ? 1 : 0;
        engine.click(M.nextTime, level);
        M.queue.push({ time: M.nextTime, beat, count: M.count, spb: 60 / this._prefs.bpm });
        M.nextTime += 60 / this._prefs.bpm;
        M.count++;
        M.beatInBar = beat + 1;
        if (M.beatInBar >= S.beats) {
          M.beatInBar = 0;
          M.bar++;
          if (this._prefs.trainer && M.bar % 4 === 0 && this._prefs.bpm < BPM_MAX) this._setBpm(this._prefs.bpm + 2);
        }
      }
    }

    _metroFrame() {
      const M = this._metro;
      if (!M.running) return;
      const ctx = engine.ctx;
      const now = ctx.currentTime;
      while (M.queue.length && M.queue[0].time <= now) {
        const q = M.queue.shift();
        M.lastBeat = q;
        const dots = this.$.beats.children;
        for (let i = 0; i < dots.length; i++) dots[i].classList.toggle('on', i === q.beat);
      }
      if (!this._reducedMotion) {
        let angle = -24;
        if (M.lastBeat) {
          const side = M.lastBeat.count % 2 ? 1 : -1;
          const phase = clamp((now - M.lastBeat.time) / M.lastBeat.spb, 0, 1);
          angle = side * 24 * Math.cos(Math.PI * phase);
        }
        this.$.arm.style.transform = `rotate(${angle.toFixed(2)}deg)`;
      }
      M.raf = requestAnimationFrame(this._metroFrame);
    }

    /* ---------- practice ---------- */

    _wirePractice() {
      this.shadowRoot.querySelectorAll('[data-add]').forEach((b) => {
        b.addEventListener('click', () => {
          const m = Number(b.dataset.add);
          const before = this.logPractice(m);
          this._toast(`Added ${m} min to today.`, before);
        });
      });
      const tip = this.$.heatTip;
      this.$.heat.addEventListener('pointerover', (e) => {
        const cell = e.target.closest('.cell[data-date]');
        if (!cell) return;
        const wrap = this.$.heatWrap.getBoundingClientRect();
        const r = cell.getBoundingClientRect();
        const min = Number(cell.dataset.min);
        tip.innerHTML = `${fmtDay(fromKey(cell.dataset.date))} · <b>${min ? min + ' min' : 'No practice'}</b>`;
        tip.hidden = false;
        const half = tip.offsetWidth / 2;
        const x = clamp(r.left - wrap.left + r.width / 2, half, wrap.width - half);
        tip.style.left = `${x}px`;
        tip.style.top = `${r.top - wrap.top - 6}px`;
      });
      this.$.heat.addEventListener('pointerleave', () => (tip.hidden = true));
    }

    get _goal() {
      const g = Math.round(Number(this.getAttribute('weekly-goal')));
      return g > 0 ? g : 150;
    }

    get _shownLog() {
      if (!this._sample) return this._log;
      if (!this._sampleLog) this._sampleLog = sampleLog(noon(new Date()));
      return this._sampleLog;
    }

    _renderPractice() {
      if (!this.$) return;
      const log = this._shownLog;
      const today = noon(new Date());
      const st = practiceStats(log, today);
      const goal = this._goal;
      const days = (n) => (n === 1 ? 'day' : 'days');

      this.$.sampleNote.hidden = !this._sample;
      this.$.statStreak.textContent = String(st.current);
      this.$.statStreakUnit.textContent = days(st.current);
      this.$.statBest.textContent = String(st.best);
      this.$.statBestUnit.textContent = days(st.best);
      this.$.statWeek.textContent = String(st.week);
      this.$.statGoal.textContent = `/ ${goal} min`;
      this.$.weekFill.style.width = `${Math.min(100, (st.week / goal) * 100)}%`;
      this.$.weekBar.setAttribute('aria-valuemax', String(goal));
      this.$.weekBar.setAttribute('aria-valuenow', String(Math.min(goal, st.week)));
      this.$.weekTile.classList.toggle('goal-met', st.week >= goal);

      const chip = this.$.streakChip;
      chip.hidden = this._sample || st.current < 1;
      this.$.streakText.textContent = `${st.current}-day streak`;

      // Heatmap: one column per week (Mon–Sun), newest on the right.
      const W = this._heatWeeks;
      const dow = (today.getDay() + 6) % 7;
      const firstMonday = addDays(today, -dow - (W - 1) * 7);
      const heat = this.$.heat;
      heat.style.gridTemplateColumns = `1.9em repeat(${W}, minmax(0, 1fr))`;
      let html = '<span></span>';
      let lastLabel = -9;
      let prevMonth = -1;
      for (let w = 0; w < W; w++) {
        const d = addDays(firstMonday, w * 7);
        const m = d.getMonth();
        let label = '';
        if (m !== prevMonth) {
          const lasts = w > 0 || addDays(d, 14).getMonth() === m;
          if (lasts && w - lastLabel >= 3) {
            label = d.toLocaleDateString(undefined, { month: 'short' });
            lastLabel = w;
          }
        }
        prevMonth = m;
        html += `<span class="m">${label}</span>`;
      }
      const dayNames = ['Mon', '', 'Wed', '', 'Fri', '', ''];
      let practiced = 0;
      let minutes = 0;
      for (let r = 0; r < 7; r++) {
        html += `<span class="d">${dayNames[r]}</span>`;
        for (let w = 0; w < W; w++) {
          const d = addDays(firstMonday, w * 7 + r);
          const key = toKey(d);
          if (d > today) {
            html += '<span class="cell future"></span>';
            continue;
          }
          const min = log[key] || 0;
          if (min) { practiced++; minutes += min; }
          html += `<span class="cell${key === toKey(today) ? ' today' : ''}" data-l="${heatLevel(min)}" data-date="${key}" data-min="${min}"></span>`;
        }
      }
      heat.innerHTML = html;
      const span = W * 7 - (6 - dow);
      const hours = Math.floor(minutes / 60);
      this.$.heatTitle.textContent = `Last ${W} weeks`;
      this.$.heatTotal.textContent = `${practiced} days · ${hours ? hours + ' h ' : ''}${minutes % 60} min`;
      heat.setAttribute('aria-label', `Practice minutes per day over the last ${W} weeks: practiced on ${practiced} of ${span} days, ${minutes} minutes in total.`);
    }

    /* ---------- toast ---------- */

    _toast(text, undoState) {
      clearTimeout(this._toastTimer);
      this.$.toastText.textContent = text;
      this.$.toast.hidden = false;
      const undo = this.$.toastUndo;
      undo.hidden = !undoState;
      undo.onclick = undoState
        ? () => {
          this._log = undoState.log;
          this._sample = undoState.sample;
          this._save();
          this._renderPractice();
          this._emit('practice-log-change', { log: this.practiceLog });
          this.$.toast.hidden = true;
        }
        : null;
      this._toastTimer = setTimeout(() => (this.$.toast.hidden = true), undoState ? 7000 : 4000);
    }

    /* ---------- session timer ---------- */

    _wireSession() {
      this.$.sessStart.addEventListener('click', () => {
        this._session = { state: 'running', startedAt: Date.now(), acc: 0 };
        this._save();
        this._renderSession();
        this._syncSessionTimer();
        this._emit('session-change', { state: 'running' });
      });
      this.$.sessPause.addEventListener('click', () => {
        const S = this._session;
        if (S.state === 'running') {
          S.acc += Date.now() - S.startedAt;
          S.state = 'paused';
        } else if (S.state === 'paused') {
          S.startedAt = Date.now();
          S.state = 'running';
        }
        this._save();
        this._renderSession();
        this._syncSessionTimer();
        this._emit('session-change', { state: S.state });
      });
      this.$.sessFinish.addEventListener('click', () => {
        const ms = this._sessionMs();
        this._session = { state: 'idle', startedAt: 0, acc: 0 };
        this._save();
        this._syncSessionTimer();
        this._renderSession();
        this._emit('session-change', { state: 'idle' });
        if (ms < 30000) {
          this._toast('Sessions under 30 seconds aren’t logged.');
          return;
        }
        const m = Math.min(720, Math.max(1, Math.round(ms / 60000)));
        const before = this.logPractice(m);
        const streak = practiceStats(this._log, noon(new Date())).current;
        this._toast(`Logged ${m} min. ${streak > 1 ? `${streak}-day streak.` : 'Streak started.'}`, before);
      });
      this.$.sessDiscard.addEventListener('click', () => {
        this._session = { state: 'idle', startedAt: 0, acc: 0 };
        this._save();
        this._syncSessionTimer();
        this._renderSession();
        this._emit('session-change', { state: 'idle' });
      });
    }

    _sessionMs() {
      const S = this._session;
      return S.acc + (S.state === 'running' ? Date.now() - S.startedAt : 0);
    }

    _syncSessionTimer() {
      const running = this._session.state === 'running' && this.isConnected;
      if (running && !this._sessTimer) this._sessTimer = setInterval(() => this._renderSessionTime(), 500);
      if (!running && this._sessTimer) {
        clearInterval(this._sessTimer);
        this._sessTimer = 0;
      }
    }

    _renderSessionTime() {
      const s = Math.floor(this._sessionMs() / 1000);
      const h = Math.floor(s / 3600);
      const mm = Math.floor((s % 3600) / 60);
      const ss = s % 60;
      this.$.sessTime.textContent = h ? `${h}:${pad(mm)}:${pad(ss)}` : `${mm}:${pad(ss)}`;
    }

    _renderSession() {
      if (!this.$) return;
      const st = this._session.state;
      this.$.session.dataset.state = st;
      this.$.sessStart.hidden = st !== 'idle';
      this.$.sessPause.hidden = st === 'idle';
      this.$.sessFinish.hidden = st === 'idle';
      this.$.sessDiscard.hidden = st !== 'paused';
      this.$.sessPause.innerHTML = st === 'running' ? `${ICON.pause}<span>Pause</span>` : `${ICON.play}<span>Resume</span>`;
      this.$.sessLabel.textContent = st === 'running' ? 'Practicing' : st === 'paused' ? 'Paused' : 'Practice session';
      this._renderSessionTime();
    }
  }

  FretboardCompanion.detectPitch = detectPitch;
  FretboardCompanion.chords = CHORDS.map((c) => ({ id: c.id, name: c.name, fullName: c.full, frets: c.frets.slice(), fingers: c.fingers.slice(), type: c.type }));
  window.FretboardCompanion = FretboardCompanion;
  customElements.define('fretboard-companion', FretboardCompanion);
})();
