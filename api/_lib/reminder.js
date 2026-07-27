import { getPtDate, getPtHour, getPtMinute } from './cron.js';

function normalizeDateOnly(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}

export function toReminderDateKey(value) {
  if (typeof value !== 'string') return '';

  const trimmed = value.trim();
  if (!trimmed) return '';

  const dateOnly = normalizeDateOnly(trimmed);
  if (dateOnly) return dateOnly;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return '';
  return getPtDate(parsed);
}

export function latestProgressDate(book) {
  const logs = Array.isArray(book?.progressLog) ? book.progressLog : [];
  const dates = logs.map((entry) => toReminderDateKey(entry?.date)).filter(Boolean);
  if (dates.length === 0) return '';
  return dates.sort().at(-1) || '';
}

function hasLoggedProgress(entry) {
  const currentPercent = Number(entry?.currentPercent ?? entry?.percentage ?? 0);
  return Number.isFinite(currentPercent) && currentPercent > 0;
}

function hasProgressBeforeCutoff(entry, todayPt, cutoffHourPt) {
  if (!hasLoggedProgress(entry)) return false;

  const entryDate = entry?.date;
  if (typeof entryDate !== 'string') return false;

  const trimmed = entryDate.trim();
  if (!trimmed) return false;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    // Legacy date-only entries do not preserve intra-day clock time. Positive
    // same-day progress still counts, but zero-percent start entries do not.
    return trimmed === todayPt;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return false;

  const entryPtDate = getPtDate(parsed);
  if (entryPtDate !== todayPt) return false;

  const entryMinutes = (getPtHour(parsed) * 60) + getPtMinute(parsed);
  const cutoffMinutes = cutoffHourPt * 60;
  return entryMinutes >= 1 && entryMinutes < cutoffMinutes;
}

export function shouldSendReminder(books, todayPt, cutoffHourPt = 24) {
  const currentBooks = books.filter((book) => book.status === 'currently-reading');
  if (currentBooks.length === 0) return false;

  // Logging any one current book before the cutoff counts as activity for the day.
  return currentBooks.every((book) => {
    const logs = Array.isArray(book?.progressLog) ? book.progressLog : [];
    return !logs.some((entry) => hasProgressBeforeCutoff(entry, todayPt, cutoffHourPt));
  });
}