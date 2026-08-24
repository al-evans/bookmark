import { describe, expect, it } from 'vitest';
import {
  calcAvgSpeedPercentPerDay,
  estimateDaysRemaining,
  getCurrentPercent,
  getTotalPages,
  pagesToPercent,
  percentToPages,
  resolveProgressUnit,
  sortProgressLogs,
} from '../utils/progress';

/** Builds a daily log for a reader holding a steady pages-per-day pace. */
function steadyLog({ totalPages, pagesPerDay, days, unit }) {
  return Array.from({ length: days }, (_, day) => {
    const page = pagesPerDay * day;
    const exact = (page / totalPages) * 100;
    return {
      date: `2026-04-${String(day + 1).padStart(2, '0')}`,
      currentPercent: unit === 'pages' ? exact : Math.round(exact),
    };
  });
}

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

  it('counts days that made no visible progress towards the pace', () => {
    // Four pages a day on a 1200 page book is a third of a percent, so the
    // whole-percent value sits still on most days. Those days are still
    // reading days and must stay in the denominator.
    const logs = steadyLog({ totalPages: 1200, pagesPerDay: 4, days: 14, unit: 'percent' });

    expect(logs.map((entry) => entry.currentPercent))
      .toEqual([0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4]);

    const avgSpeedPerDay = calcAvgSpeedPercentPerDay(logs);

    // Dropping the flat days would report 1%/day, triple the true 0.333%/day.
    expect(avgSpeedPerDay).toBeCloseTo(4 / 13, 5);
    expect(avgSpeedPerDay).toBeLessThan(0.5);
  });

  it('ignores backwards corrections when averaging', () => {
    const avgSpeedPerDay = calcAvgSpeedPercentPerDay([
      { date: '2026-04-01', currentPercent: 10 },
      { date: '2026-04-02', currentPercent: 40 },
      { date: '2026-04-03', currentPercent: 20 },
      { date: '2026-04-04', currentPercent: 24 },
    ]);

    // Only the +30 and +4 days count; the -20 correction is not reading.
    expect(avgSpeedPerDay).toBe(17);
  });
});

describe('page based progress', () => {
  it('only offers pages when the page count is known', () => {
    expect(resolveProgressUnit({ progressUnit: 'pages', totalPages: 492 })).toBe('pages');
    expect(resolveProgressUnit({ progressUnit: 'pages', totalPages: null })).toBe('percent');
    expect(resolveProgressUnit({ progressUnit: 'pages', totalPages: 0 })).toBe('percent');
    expect(resolveProgressUnit({ totalPages: 492 })).toBe('percent');
    expect(resolveProgressUnit(undefined)).toBe('percent');
  });

  it('reads a usable page count or nothing at all', () => {
    expect(getTotalPages({ totalPages: 492 })).toBe(492);
    expect(getTotalPages({ totalPages: '492' })).toBe(492);
    expect(getTotalPages({ totalPages: 0 })).toBeNull();
    expect(getTotalPages({ totalPages: -5 })).toBeNull();
    expect(getTotalPages({})).toBeNull();
  });

  it('round trips every page of a book without drift', () => {
    for (const totalPages of [231, 492, 801, 1193, 1200]) {
      for (let page = 0; page <= totalPages; page += 1) {
        const percent = pagesToPercent(page, totalPages);
        expect(percentToPages(percent, totalPages)).toBe(page);
      }
    }
  });

  it('clamps page entries to the covers of the book', () => {
    expect(pagesToPercent(0, 492)).toBe(0);
    expect(pagesToPercent(492, 492)).toBe(100);
    expect(pagesToPercent(600, 492)).toBe(100);
    expect(pagesToPercent(-10, 492)).toBe(0);
    expect(percentToPages(150, 492)).toBe(492);
    expect(percentToPages(-10, 492)).toBe(0);
  });

  it('returns nothing when the page count is unusable', () => {
    expect(pagesToPercent(100, null)).toBeNull();
    expect(pagesToPercent(100, 0)).toBeNull();
    expect(pagesToPercent('abc', 492)).toBeNull();
    expect(percentToPages(50, null)).toBeNull();
  });

  it('estimates the finish date exactly when progress is logged by page', () => {
    const totalPages = 1200;
    const pagesPerDay = 4;
    const days = 14;
    const logs = steadyLog({ totalPages, pagesPerDay, days, unit: 'pages' });

    const avgSpeedPerDay = calcAvgSpeedPercentPerDay(logs);
    const currentPercent = getCurrentPercent(logs, 0);
    const daysRemaining = estimateDaysRemaining(currentPercent, avgSpeedPerDay);

    const pagesLeft = totalPages - pagesPerDay * (days - 1);
    expect(daysRemaining).toBe(Math.ceil(pagesLeft / pagesPerDay));
    expect(avgSpeedPerDay).toBeCloseTo((pagesPerDay / totalPages) * 100, 10);
  });
});
