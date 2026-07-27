import { describe, expect, it } from 'vitest';
import {
  calcAvgSpeedPercentPerDay,
  estimateDaysRemaining,
  getCurrentPercent,
  sortProgressLogs,
} from '../utils/progress';

describe('progress utilities', () => {
  it('sorts date-key logs chronologically without timezone drift', () => {
    const sorted = sortProgressLogs([
      { date: '2026-04-10', currentPercent: 15 },
      { date: '2026-04-04', currentPercent: 9 },
      { date: '2026-04-08', currentPercent: 12 },
    ]);

    expect(sorted.map((entry) => entry.date)).toEqual([
      '2026-04-04',
      '2026-04-08',
      '2026-04-10',
    ]);
  });

  it('returns the latest percent from corrected date-key history', () => {
    expect(getCurrentPercent([
      { date: '2026-04-04', currentPercent: 9 },
      { date: '2026-04-10', currentPercent: 15 },
    ], 0)).toBe(15);
  });

  it('calculates average speed from corrected dates and percentages', () => {
    const avgSpeedPerDay = calcAvgSpeedPercentPerDay([
      { date: '2026-04-04', currentPercent: 9 },
      { date: '2026-04-10', currentPercent: 15 },
    ]);

    expect(avgSpeedPerDay).toBe(1);
    expect(estimateDaysRemaining(15, avgSpeedPerDay)).toBe(85);
  });
});
