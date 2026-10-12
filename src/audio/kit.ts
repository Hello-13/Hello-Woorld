import { getEngine } from './engine';

/** Synthesised drum kit and metronome sounds, scheduled at exact AudioContext times. */

function noiseSource(ctx: AudioContext, buffer: AudioBuffer, t: number, dur: number): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  // Start somewhere random in the second of noise so hits don't all sound identical.
  src.start(t, Math.random() * 0.5, dur + 0.05);
  return src;
}

function envelope(ctx: AudioContext, t: number, peak: number, decay: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  return g;
}

export function kick(t: number, velocity = 1) {
  const { ctx, drums } = getEngine();
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(48, t + 0.11);
  const g = envelope(ctx, t, 1.1 * velocity, 0.42);
  osc.connect(g).connect(drums);
  osc.start(t);
  osc.stop(t + 0.45);
}

export function snare(t: number, velocity = 1) {
  const { ctx, drums, noise } = getEngine();
  const n = noiseSource(ctx, noise, t, 0.25);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1400;
  const ng = envelope(ctx, t, 0.55 * velocity, 0.2);
  n.connect(hp).connect(ng).connect(drums);
  const tone = ctx.createOscillator();
  tone.type = 'triangle';
  tone.frequency.setValueAtTime(220, t);
  tone.frequency.exponentialRampToValueAtTime(170, t + 0.08);
  const tg = envelope(ctx, t, 0.5 * velocity, 0.11);
  tone.connect(tg).connect(drums);
  tone.start(t);
  tone.stop(t + 0.15);
}

export function hat(t: number, velocity = 1, open = false) {
  const { ctx, drums, noise } = getEngine();
  const dur = open ? 0.32 : 0.05;
  const n = noiseSource(ctx, noise, t, dur);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 10000;
  bp.Q.value = 0.8;
  const g = envelope(ctx, t, 0.32 * velocity, dur);
  n.connect(hp).connect(bp).connect(g).connect(drums);
}

/** A soft cross-stick, for ballads and count-ins. */
export function rim(t: number, velocity = 1) {
  const { ctx, drums } = getEngine();
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.value = 1700;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800;
  bp.Q.value = 4;
  const g = envelope(ctx, t, 0.35 * velocity, 0.04);
  osc.connect(bp).connect(g).connect(drums);
  osc.start(t);
  osc.stop(t + 0.06);
}

export type ClickSound = 'wood' | 'beep' | 'cowbell';
export type ClickLevel = 'accent' | 'beat' | 'sub';

/** Metronome tick. Accents are higher and louder; subdivisions are quiet. */
export function click(t: number, level: ClickLevel, sound: ClickSound = 'wood') {
  const { ctx, click: bus, noise } = getEngine();
  const loud = level === 'accent' ? 1 : level === 'beat' ? 0.7 : 0.35;
  if (sound === 'beep') {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = level === 'accent' ? 1760 : level === 'beat' ? 1320 : 990;
    const g = envelope(ctx, t, 0.5 * loud, 0.05);
    osc.connect(g).connect(bus);
    osc.start(t);
    osc.stop(t + 0.07);
    return;
  }
  if (sound === 'cowbell') {
    // Two detuned square waves through a band-pass: the classic drum-machine cowbell.
    const base = level === 'accent' ? 1 : 0.84;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2640 * base;
    bp.Q.value = 3;
    const g = envelope(ctx, t, 0.45 * loud, level === 'sub' ? 0.06 : 0.16);
    bp.connect(g).connect(bus);
    for (const f of [540, 800]) {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = f * base;
      osc.connect(bp);
      osc.start(t);
      osc.stop(t + 0.2);
    }
    return;
  }
  // Woodblock: a resonant band-pass ping on a tiny noise burst.
  const n = noiseSource(ctx, noise, t, 0.03);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = level === 'accent' ? 2400 : level === 'beat' ? 1800 : 1500;
  bp.Q.value = 12;
  const g = envelope(ctx, t, 3.2 * loud, 0.045);
  n.connect(bp).connect(g).connect(bus);
}
