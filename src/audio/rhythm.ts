/** Comparing played onsets with the metronome grid. Pure functions, all times in seconds. */

export interface TimingStats {
  count: number;
  /** Average offset in ms: negative = early (rushing), positive = late (dragging). */
  meanMs: number;
  /** Spread (standard deviation) in ms: lower is steadier. */
  spreadMs: number;
}

/**
 * Offset of an onset from the nearest grid time, or null if it is nowhere near one
 * (further than `maxFraction` of the grid spacing).
 */
export function nearestOffset(onset: number, grid: number[], spacing: number, maxFraction = 0.45): number | null {
  let best: number | null = null;
  for (const g of grid) {
    const d = onset - g;
    if (best === null || Math.abs(d) < Math.abs(best)) best = d;
  }
  if (best === null || Math.abs(best) > spacing * maxFraction) return null;
  return best;
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function timingStats(offsetsMs: number[]): TimingStats {
  const n = offsetsMs.length;
  if (!n) return { count: 0, meanMs: 0, spreadMs: 0 };
  const mean = offsetsMs.reduce((a, b) => a + b, 0) / n;
  const variance = offsetsMs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n;
  return { count: n, meanMs: mean, spreadMs: Math.sqrt(variance) };
}

/** A word for how steady the playing is, from the spread of offsets. */
export function steadiness(spreadMs: number): string {
  if (spreadMs < 12) return 'Rock solid';
  if (spreadMs < 22) return 'Tight';
  if (spreadMs < 35) return 'Steady-ish';
  return 'Wobbly';
}

/** How the average sits against the beat. */
export function feelWord(meanMs: number): string {
  if (Math.abs(meanMs) < 8) return 'right on the beat';
  return meanMs < 0 ? `rushing by ${Math.round(-meanMs)} ms` : `dragging by ${Math.round(meanMs)} ms`;
}
