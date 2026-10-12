import { midiToFreq } from '../theory/notes';
import { getEngine, peekEngine } from './engine';
import { naturalT60, renderPluck } from './pluck';

/** Rendered notes, most recently used last. Bounded so a long session doesn't hoard memory on a phone. */
const cache = new Map<string, AudioBuffer>();
const CACHE_LIMIT = 72;

function pluckBuffer(ctx: AudioContext, midi: number, muted: boolean, a4: number): AudioBuffer {
  const key = `${midi}:${muted ? 1 : 0}:${a4}:${ctx.sampleRate}`;
  let buf = cache.get(key);
  if (buf) {
    cache.delete(key);
    cache.set(key, buf);
  } else {
    const freq = midiToFreq(midi, a4);
    // By 70% of the 60 dB ring time a note is ~40 dB down and lost under the next one.
    const duration = muted ? 0.35 : Math.min(3.6, naturalT60(freq) * 0.7);
    const data = renderPluck({ freq, sampleRate: ctx.sampleRate, duration, muted, seed: midi * 7 + (muted ? 1 : 0) });
    buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
    buf.getChannelData(0).set(data);
    cache.set(key, buf);
    if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  }
  return buf;
}

interface Voice {
  src: AudioBufferSourceNode;
  gain: GainNode;
}

/** At most one sounding note per channel, the way a real string can only ring one pitch. */
const voices = new Map<string, Voice>();

function release(voice: Voice, at: number, tau = 0.012) {
  try {
    voice.gain.gain.setTargetAtTime(0, at, tau);
    voice.src.stop(at + tau * 10);
  } catch {
    // Already stopped.
  }
}

export interface NoteOptions {
  /** AudioContext time; defaults to right now. */
  time?: number;
  /** 0–1. */
  velocity?: number;
  /** Notes on the same channel cut each other off (use one per string). */
  channel?: string;
  muted?: boolean;
  /** Let go after this many seconds instead of ringing out. */
  duration?: number;
  /** Concert pitch reference. */
  a4?: number;
}

export function playNote(midi: number, opts: NoteOptions = {}) {
  const e = getEngine();
  const ctx = e.ctx;
  const t = Math.max(opts.time ?? ctx.currentTime + 0.01, ctx.currentTime);
  const velocity = opts.velocity ?? 0.8;
  if (opts.channel) {
    const prev = voices.get(opts.channel);
    if (prev) release(prev, t);
  }
  const src = ctx.createBufferSource();
  src.buffer = pluckBuffer(ctx, midi, opts.muted ?? false, opts.a4 ?? 440);
  const gain = ctx.createGain();
  gain.gain.value = velocity * velocity * 0.55;
  src.connect(gain).connect(e.guitar);
  src.start(t);
  const voice = { src, gain };
  if (opts.duration !== undefined) release(voice, t + opts.duration, 0.05);
  if (opts.channel) voices.set(opts.channel, voice);
  src.onended = () => {
    src.disconnect();
    gain.disconnect();
    if (opts.channel && voices.get(opts.channel) === voice) voices.delete(opts.channel);
  };
}

/** Stop every note on channels starting with a prefix ("jam-" stops the backing guitar). */
export function stopChannels(prefix: string, time?: number) {
  // Nothing can be playing before the engine exists, and creating it here would start audio without a tap.
  const e = peekEngine();
  if (!e) return;
  const t = time ?? e.ctx.currentTime;
  for (const [key, v] of voices) {
    if (key.startsWith(prefix)) {
      release(v, t, 0.03);
      voices.delete(key);
    }
  }
}

export type StrumDirection = 'down' | 'up';

export interface StrumOptions {
  time?: number;
  direction?: StrumDirection;
  /** Seconds between neighbouring strings. */
  spread?: number;
  velocity?: number;
  /** Palm-muted "chuck". */
  muted?: boolean;
  /** Channel prefix; string i plays on `${prefix}${i}`. */
  channelPrefix?: string;
  /** Up-strums usually catch only the top strings. */
  maxStrings?: number;
  a4?: number;
}

/**
 * Strum a chord. `notes[i]` is the MIDI note on string i (0 = low E) or null for a muted string.
 */
export function strum(notes: (number | null)[], opts: StrumOptions = {}) {
  const e = getEngine();
  const start = opts.time ?? e.ctx.currentTime + 0.01;
  const direction = opts.direction ?? 'down';
  const spread = opts.spread ?? (direction === 'down' ? 0.016 : 0.012);
  const base = opts.velocity ?? 0.8;
  const prefix = opts.channelPrefix ?? 'strum-';
  let order = notes.map((m, i) => ({ m, i })).filter((x) => x.m !== null) as { m: number; i: number }[];
  if (direction === 'up') order.reverse();
  if (opts.maxStrings) order = order.slice(0, opts.maxStrings);
  order.forEach(({ m, i }, k) => {
    // Strings struck later in the sweep come in a touch softer.
    const velocity = base * (1 - k * 0.035) * (0.94 + ((i * 37) % 7) / 100);
    playNote(m, { time: start + k * spread, velocity, channel: prefix + i, muted: opts.muted, a4: opts.a4 });
  });
}

/** Play notes one after another (arpeggio or melody). */
export function arpeggiate(notes: number[], opts: { time?: number; gap?: number; velocity?: number; a4?: number } = {}) {
  const e = getEngine();
  const start = opts.time ?? e.ctx.currentTime + 0.02;
  const gap = opts.gap ?? 0.22;
  notes.forEach((m, k) => playNote(m, { time: start + k * gap, velocity: opts.velocity ?? 0.75, channel: 'arp-' + k, a4: opts.a4 }));
}

/** Render the notes most tools use ahead of time so the first strum doesn't stutter. */
export function warmUp(midis: number[]) {
  const e = getEngine();
  let i = 0;
  const step = () => {
    const end = Math.min(midis.length, i + 4);
    for (; i < end; i++) pluckBuffer(e.ctx, midis[i], false, 440);
    if (i < midis.length) setTimeout(step, 16);
  };
  step();
}
