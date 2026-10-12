/**
 * Plucked-string synthesis: extended Karplus–Strong (Jaffe & Smith, 1983).
 *
 * A burst of filtered noise circulates in a delay line one period long. Each trip through the loop
 * a two-point average darkens it (high harmonics die first, like a real string), a loss factor sets
 * the overall ring time, and an all-pass filter supplies the fractional sample of delay that keeps
 * the pitch in tune. Pick position is modelled by a comb filter on the initial burst.
 */

export interface PluckOptions {
  freq: number;
  sampleRate: number;
  /** Seconds of audio to render. */
  duration?: number;
  /** 0 (thumb, warm) … 1 (pick near the bridge, bright). */
  brightness?: number;
  /** Where along the string it is plucked, as a fraction from the bridge. */
  pickPosition?: number;
  /** Seconds for the fundamental to fall by 60 dB. Defaults to a realistic, pitch-dependent value. */
  t60?: number;
  /** Palm-muted: very short ring, darker attack. */
  muted?: boolean;
  /** Seed for the noise burst so a given note always sounds the same. */
  seed?: number;
}

/** Small deterministic PRNG (mulberry32). */
export function makeRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ring time of a guitar string: low strings sustain longer than high ones. */
export function naturalT60(freq: number): number {
  return 1.6 + 3.2 * Math.sqrt(82.4 / Math.max(freq, 40));
}

export function renderPluck(opts: PluckOptions): Float32Array {
  const sr = opts.sampleRate;
  const freq = opts.freq;
  const duration = opts.duration ?? 3;
  const brightness = Math.min(1, Math.max(0, opts.brightness ?? 0.55));
  const pickPosition = opts.pickPosition ?? 0.18;
  const muted = opts.muted ?? false;
  const t60 = opts.t60 ?? (muted ? 0.09 : naturalT60(freq));
  const random = makeRandom(opts.seed ?? Math.round(freq * 1000));

  const total = Math.max(1, Math.floor(duration * sr));
  const out = new Float32Array(total);

  // Loop delay = L samples of line + 0.5 from the averaging filter + frac from the all-pass.
  const period = sr / freq;
  let L = Math.floor(period - 0.5);
  let frac = period - 0.5 - L;
  if (frac < 0.1) {
    L -= 1;
    frac += 1;
  }
  if (L < 2) return out;
  const apC = (1 - frac) / (1 + frac);

  // Per-trip gain so the fundamental decays by 60 dB in t60 seconds. The averaging filter already
  // loses cos(π f / sr) per trip at the fundamental, so the loss factor makes up the rest.
  const perTrip = Math.pow(0.001, 1 / (freq * t60));
  const rho = Math.min(0.99995, perTrip / Math.cos((Math.PI * freq) / sr));

  // Excitation: noise, softened by a one-pole low-pass, minus its own delayed copy (pick position).
  const line = new Float32Array(L);
  const softness = muted ? 0.75 : 0.85 - 0.7 * brightness; // 0.15 … 0.85
  let lp = 0;
  const noise = new Float32Array(L);
  for (let i = 0; i < L; i++) {
    lp = (1 - softness) * (random() * 2 - 1) + softness * lp;
    noise[i] = lp;
  }
  const P = Math.max(1, Math.round(pickPosition * L));
  let mean = 0;
  for (let i = 0; i < L; i++) {
    line[i] = noise[i] - (i >= P ? noise[i - P] : 0);
    mean += line[i];
  }
  mean /= L;
  let peak = 0;
  for (let i = 0; i < L; i++) {
    line[i] -= mean;
    peak = Math.max(peak, Math.abs(line[i]));
  }
  if (peak > 0) for (let i = 0; i < L; i++) line[i] /= peak;

  let pos = 0;
  let prev = 0;
  let apX1 = 0;
  let apY1 = 0;
  for (let n = 0; n < total; n++) {
    const v = line[pos];
    out[n] = v;
    const damped = rho * 0.5 * (v + prev);
    prev = v;
    const ap = apC * damped + apX1 - apC * apY1;
    apX1 = damped;
    apY1 = ap;
    line[pos] = ap;
    pos++;
    if (pos === L) pos = 0;
  }

  // Short fade-in removes the click of the first sample; fade-out ends cleanly.
  const fadeIn = Math.min(total, Math.floor(sr * 0.0015));
  for (let i = 0; i < fadeIn; i++) out[i] *= i / fadeIn;
  const fadeOut = Math.min(total, Math.floor(sr * 0.08));
  for (let i = 0; i < fadeOut; i++) out[total - 1 - i] *= i / fadeOut;

  // Normalise loudness roughly across the range (low strings carry more energy per peak).
  let maxAbs = 0;
  const scanEnd = Math.min(total, Math.floor(sr * 0.1));
  for (let i = 0; i < scanEnd; i++) maxAbs = Math.max(maxAbs, Math.abs(out[i]));
  if (maxAbs > 0) {
    const g = 0.6 / maxAbs;
    for (let i = 0; i < total; i++) out[i] *= g;
  }
  return out;
}
