import { describe, expect, it } from 'vitest';
import {
  formatPtFriendlyDateKey,
  formatPtMonthYearFromDateKey,
  getPtDateKey,
  getTodayPtDateKey,
  migrateBooksToPtIfNeeded,
  shiftIsoDate,
} from '../utils/timezone';

describe('timezone utilities', () => {
  it('formats Pacific date keys from UTC instants', () => {
    expect(getPtDateKey('2026-04-11T06:30:00.000Z')).toBe('2026-04-10');
    expect(getPtDateKey('2026-04-11T08:30:00.000Z')).toBe('2026-04-11');
  });

  it('preserves date-only keys instead of reparsing them as UTC instants', () => {
    expect(getPtDateKey('2026-08-24')).toBe('2026-08-24');
  });

  it('shifts ISO dates safely across month boundaries', () => {
    expect(shiftIsoDate('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftIsoDate('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('preserves date-only legacy entries during PT migration', () => {
    const legacyBooks = [
      {
        id: 'book-1',
        title: 'Legacy Book',
        dateRead: '2026-04-10',
        progressLog: [
          { date: '2026-04-10', currentPercent: 40 },
          { date: '2026-04-11', currentPercent: 65 },
        ],
      },
    ];

    const firstPass = migrateBooksToPtIfNeeded(legacyBooks);
    expect(firstPass.changed).toBe(true);
    expect(firstPass.books[0].timeZoneVersion).toBe('pt-v2');
    expect(firstPass.books[0].dateRead).toBe('2026-04-10');
    expect(firstPass.books[0].progressLog[0].date).toBe('2026-04-10');
    expect(firstPass.books[0].progressLog[1].date).toBe('2026-04-11');

    const secondPass = migrateBooksToPtIfNeeded(firstPass.books);
    expect(secondPass.changed).toBe(false);
    expect(secondPass.books).toEqual(firstPass.books);
  });

  it('formats date keys without rolling back a day', () => {
    expect(formatPtFriendlyDateKey('2026-04-10')).toBe('Apr 10, 2026');
    expect(formatPtMonthYearFromDateKey('2026-04-10')).toBe('April 2026');
  });

  it('returns a yyyy-mm-dd key for today in PT', () => {
    expect(getTodayPtDateKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
