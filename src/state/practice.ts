import { useEffect } from 'preact/hooks';
import { createStore, useStore } from './store';

export interface ChangesResult {
  pair: string;
  count: number;
  at: string;
}

export interface PracticeData {
  /** Day ("2026-10-12") → tool id → seconds practised. */
  days: Record<string, Record<string, number>>;
  huntBest: Record<string, number>;
  /** Ear-training answers per question type ("interval:7", "chord:min"…). */
  ear: Record<string, { right: number; total: number }>;
  changes: ChangesResult[];
  lastBpm: number;
}

export const practiceStore = createStore<PracticeData>('string-theory:practice', {
  days: {},
  huntBest: {},
  ear: {},
  changes: [],
  lastBpm: 90,
});

export function usePractice(): PracticeData {
  return useStore(practiceStore);
}

export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addPracticeSeconds(tool: string, seconds: number, when = new Date()) {
  const key = dayKey(when);
  practiceStore.set((p) => {
    const day = { ...(p.days[key] ?? {}) };
    day[tool] = (day[tool] ?? 0) + seconds;
    return { days: { ...p.days, [key]: day } };
  });
}

export function daySeconds(p: PracticeData, key: string): number {
  return Object.values(p.days[key] ?? {}).reduce((a, b) => a + b, 0);
}

/** Days in a row with at least a minute of practice, counting back from today (or yesterday). */
export function streak(p: PracticeData, today = new Date()): number {
  const d = new Date(today);
  if (daySeconds(p, dayKey(d)) < 60) d.setDate(d.getDate() - 1);
  let n = 0;
  while (daySeconds(p, dayKey(d)) >= 60) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/** Minutes for each of the last `count` days, oldest first. */
export function recentDays(p: PracticeData, count = 7, today = new Date()): { key: string; date: Date; minutes: number }[] {
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    out.push({ key, date: d, minutes: daySeconds(p, key) / 60 });
  }
  return out;
}

export function recordEar(key: string, right: boolean) {
  practiceStore.set((p) => {
    const prev = p.ear[key] ?? { right: 0, total: 0 };
    return { ear: { ...p.ear, [key]: { right: prev.right + (right ? 1 : 0), total: prev.total + 1 } } };
  });
}

export function recordHunt(mode: string, score: number): boolean {
  const best = practiceStore.get().huntBest[mode] ?? 0;
  if (score <= best) return false;
  practiceStore.set((p) => ({ huntBest: { ...p.huntBest, [mode]: score } }));
  return true;
}

export function recordChanges(pair: string, count: number) {
  practiceStore.set((p) => ({ changes: [...p.changes, { pair, count, at: new Date().toISOString() }].slice(-300) }));
}

let lastActivity = 0;

/** Tools call this when something musical happens (a note played, a beat ticking). */
export function markActive() {
  lastActivity = Date.now();
}

/**
 * Count time on a tool while the page is visible and the player has done something
 * in the last 90 seconds, so an idle open tab does not inflate the log.
 */
export function usePracticeTimer(tool: string) {
  useEffect(() => {
    markActive();
    const onInput = () => markActive();
    window.addEventListener('pointerdown', onInput);
    window.addEventListener('keydown', onInput);
    const id = setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - lastActivity < 90_000) addPracticeSeconds(tool, 5);
    }, 5000);
    return () => {
      clearInterval(id);
      window.removeEventListener('pointerdown', onInput);
      window.removeEventListener('keydown', onInput);
    };
  }, [tool]);
}
