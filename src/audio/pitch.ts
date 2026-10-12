/**
 * Monophonic pitch detection with the YIN algorithm (de Cheveigné & Kawahara, 2002),
 * tuned for guitar: 60 Hz (below drop C) up to about 1.4 kHz (high frets on the top string).
 */

export interface PitchResult {
  freq: number;
  /** 0–1, how periodic the signal is. Above ~0.85 is a clean note. */
  clarity: number;
  rms: number;
}

export interface PitchOptions {
  minFreq?: number;
  maxFreq?: number;
  /** YIN absolute threshold on the normalised difference function. */
  threshold?: number;
  /** Ignore input quieter than this RMS level. */
  minRms?: number;
}

export function rms(buf: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}

/** Halve the sample rate by averaging pairs (a crude low-pass that is plenty for guitar fundamentals). */
export function decimate2(buf: Float32Array): Float32Array {
  const out = new Float32Array(buf.length >> 1);
  for (let i = 0; i < out.length; i++) out[i] = 0.5 * (buf[2 * i] + buf[2 * i + 1]);
  return out;
}

export function detectPitch(input: Float32Array, sampleRate: number, opts: PitchOptions = {}): PitchResult | null {
  const minFreq = opts.minFreq ?? 60;
  const maxFreq = opts.maxFreq ?? 1400;
  const threshold = opts.threshold ?? 0.15;
  const minRms = opts.minRms ?? 0.008;

  const level = rms(input);
  if (level < minRms) return null;

  let buf = input;
  let sr = sampleRate;
  // Work at 20–30 kHz: four times cheaper and loses nothing a guitar fundamental needs.
  while (sr > 30000 && buf.length >= 2048) {
    buf = decimate2(buf);
    sr /= 2;
  }

  const tauMin = Math.max(2, Math.floor(sr / maxFreq));
  const tauMax = Math.min(Math.floor(sr / minFreq), Math.floor(buf.length / 2) - 1);
  // Window length; τ runs one past tauMax so the interpolation has a right-hand neighbour.
  const w = buf.length - (tauMax + 1);
  if (tauMax <= tauMin + 2 || w < 16) return null;

  // Difference function d(τ) and its cumulative-mean-normalised form d'(τ).
  const d = new Float32Array(tauMax + 2);
  for (let tau = 1; tau <= tauMax + 1; tau++) {
    let sum = 0;
    for (let j = 0; j < w; j++) {
      const diff = buf[j] - buf[j + tau];
      sum += diff * diff;
    }
    d[tau] = sum;
  }
  const cmnd = new Float32Array(tauMax + 2);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax + 1; tau++) {
    running += d[tau];
    cmnd[tau] = running > 0 ? (d[tau] * tau) / running : 1;
  }

  // First dip under the threshold, followed down to its local minimum.
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (cmnd[t] < threshold) {
      while (t + 1 <= tauMax && cmnd[t + 1] < cmnd[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) {
    // No confident dip: fall back to the global minimum if it is at least plausible.
    let best = tauMin;
    for (let t = tauMin + 1; t <= tauMax; t++) if (cmnd[t] < cmnd[best]) best = t;
    if (cmnd[best] > 0.35) return null;
    tau = best;
  }

  // Parabolic interpolation around the minimum for sub-sample accuracy.
  let betterTau = tau;
  if (tau > 1 && tau < tauMax + 1) {
    const s0 = cmnd[tau - 1];
    const s1 = cmnd[tau];
    const s2 = cmnd[tau + 1];
    const denom = s0 + s2 - 2 * s1;
    if (denom !== 0) betterTau = tau + (s0 - s2) / (2 * denom);
  }

  return { freq: sr / betterTau, clarity: Math.max(0, Math.min(1, 1 - cmnd[tau])), rms: level };
}

/**
 * Smooths raw detections into a steady reading: a short median in the cents domain,
 * resetting when the player jumps to a different note.
 */
export class PitchSmoother {
  private history: number[] = [];
  private lastAt = -Infinity;

  constructor(
    private size = 5,
    /** Forget the history after this much silence (ms). */
    private holdMs = 350,
  ) {}

  push(freq: number | null, nowMs: number): number | null {
    if (freq === null) {
      if (nowMs - this.lastAt > this.holdMs) this.history = [];
      return this.history.length ? this.median() : null;
    }
    const cents = 1200 * Math.log2(freq / 440);
    if (this.history.length) {
      const m = this.median();
      // More than 60 cents away: a new note, start fresh.
      if (Math.abs(1200 * Math.log2(m / 440) - cents) > 60) this.history = [];
    }
    this.history.push(cents);
    if (this.history.length > this.size) this.history.shift();
    this.lastAt = nowMs;
    return this.median();
  }

  reset() {
    this.history = [];
  }

  private median(): number {
    const sorted = [...this.history].sort((a, b) => a - b);
    const mid = sorted[sorted.length >> 1];
    return 440 * Math.pow(2, mid / 1200);
  }
}
