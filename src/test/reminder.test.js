import { describe, expect, it } from 'vitest';
import { getPtDate } from '../../api/_lib/cron.js';
import { latestProgressDate, shouldSendReminder, toReminderDateKey } from '../../api/_lib/reminder.js';

describe('reading reminder eligibility', () => {
  it('converts timestamped log entries to Pacific date keys', () => {
    expect(toReminderDateKey('2026-04-20T03:30:00.000Z')).toBe('2026-04-19');
    expect(toReminderDateKey('2026-04-20')).toBe('2026-04-20');
  });

  it('uses the Pacific day for the latest progress date', () => {
    expect(latestProgressDate({
      progressLog: [
        { date: '2026-04-20T03:30:00.000Z', currentPercent: 40 },
        { date: '2026-04-20T08:30:00.000Z', currentPercent: 55 },
      ],
    })).toBe('2026-04-20');
  });

  it('still sends the reminder when the latest log was last night in PT', () => {
    const books = [
      {
        id: 'b1',
        title: 'Dune',
        status: 'currently-reading',
        progressLog: [
          { date: '2026-04-20T03:30:00.000Z', currentPercent: 30 },
        ],
      },
    ];

    expect(shouldSendReminder(books, '2026-04-20')).toBe(true);
  });

  it('skips the reminder when a book was logged today in PT', () => {
    const books = [
      {
        id: 'b1',
        title: 'Dune',
        status: 'currently-reading',
        progressLog: [
          { date: '2026-04-20T08:30:00.000Z', currentPercent: 30 },
        ],
      },
    ];

    expect(shouldSendReminder(books, '2026-04-20')).toBe(false);
  });

  it('still sends when a timestamped log exists after the 3 PM PT cutoff', () => {
    const books = [
      {
        id: 'b1',
        title: 'Dune',
        status: 'currently-reading',
        progressLog: [
          { date: '2026-04-20T23:30:00.000Z', currentPercent: 30 },
        ],
      },
    ];

    expect(shouldSendReminder(books, '2026-04-20', 15)).toBe(true);
  });

  it('skips by default when a same-day timestamped log exists in the evening', () => {
    const books = [
      {
        id: 'b1',
        title: 'Dune',
        status: 'currently-reading',
        progressLog: [
          { date: '2026-04-20T23:30:00.000Z', currentPercent: 30 },
        ],
      },
    ];

    expect(shouldSendReminder(books, '2026-04-20')).toBe(false);
  });

  it('skips when a timestamped log exists before the 3 PM PT cutoff', () => {
    const books = [
      {
        id: 'b1',
        title: 'Dune',
        status: 'currently-reading',
        progressLog: [
          { date: '2026-04-20T21:30:00.000Z', currentPercent: 30 },
        ],
      },
    ];

    expect(shouldSendReminder(books, '2026-04-20', 15)).toBe(false);
  });

  it('still sends when the only same-day legacy entry is a zero-percent start entry', () => {
    const books = [
      {
        id: 'b1',
        title: 'Dune',
        status: 'currently-reading',
        progressLog: [
          { date: '2026-04-20', currentPercent: 0 },
        ],
      },
    ];

    expect(shouldSendReminder(books, '2026-04-20', 15)).toBe(true);
  });

  it('skips when a positive same-day legacy entry exists', () => {
    const books = [
      {
        id: 'b1',
        title: 'Dune',
        status: 'currently-reading',
        progressLog: [
          { date: '2026-04-20', currentPercent: 12 },
        ],
      },
    ];

    expect(shouldSendReminder(books, '2026-04-20', 15)).toBe(false);
  });

  it('still sends when the only timestamped log is exactly midnight PT', () => {
    const books = [
      {
        id: 'b1',
        title: 'Dune',
        status: 'currently-reading',
        progressLog: [
          { date: '2026-04-20T07:00:00.000Z', currentPercent: 12 },
        ],
      },
    ];

    expect(shouldSendReminder(books, '2026-04-20', 15)).toBe(true);
  });

  it('skips when a timestamped log exists at 12:01 AM PT', () => {
    const books = [
      {
        id: 'b1',
        title: 'Dune',
        status: 'currently-reading',
        progressLog: [
          { date: '2026-04-20T07:01:00.000Z', currentPercent: 12 },
        ],
      },
    ];

    expect(shouldSendReminder(books, '2026-04-20', 15)).toBe(false);
  });

  it('returns a stable yyyy-mm-dd Pacific date key from the cron helper', () => {
    expect(getPtDate(new Date('2026-04-20T03:30:00.000Z'))).toBe('2026-04-19');
    expect(getPtDate(new Date('2026-04-20T20:30:00-07:00'))).toBe('2026-04-20');
  });
});