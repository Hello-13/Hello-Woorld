import { describe, expect, it } from 'vitest';
import { dayKey, recentDays, streak, type PracticeData } from './practice';

const base: PracticeData = { days: {}, huntBest: {}, ear: {}, changes: [], lastBpm: 90 };

describe('practice log', () => {
  it('formats local day keys', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('counts a streak back from today, or from yesterday before today’s session', () => {
    const today = new Date(2026, 9, 12);
    const p: PracticeData = {
      ...base,
      days: {
        '2026-10-12': { tuner: 300 },
        '2026-10-11': { jam: 120 },
        '2026-10-10': { jam: 61 },
        '2026-10-09': { jam: 30 }, // under a minute: breaks the chain
        '2026-10-08': { jam: 900 },
      },
    };
    expect(streak(p, today)).toBe(3);
    const noToday = { ...p, days: { ...p.days, '2026-10-12': {} } };
    expect(streak(noToday, today)).toBe(2);
    expect(streak(base, today)).toBe(0);
  });

  it('lists the last seven days oldest first', () => {
    const today = new Date(2026, 9, 12);
    const p = { ...base, days: { '2026-10-12': { a: 120, b: 60 }, '2026-10-06': { a: 600 } } };
    const days = recentDays(p, 7, today);
    expect(days.map((d) => d.key)).toEqual([
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
    ]);
    expect(days[0].minutes).toBe(10);
    expect(days[6].minutes).toBe(3);
  });
});
