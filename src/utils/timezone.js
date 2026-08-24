export const PT_TIME_ZONE = 'America/Los_Angeles';
export const PT_TIME_ZONE_VERSION = 'pt-v2';

const ptDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: PT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const ptMonthYearFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: PT_TIME_ZONE,
  month: 'long',
  year: 'numeric',
});

const ptFriendlyDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: PT_TIME_ZONE,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function partsToDateKey(parts) {
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return year && month && day ? `${year}-${month}-${day}` : '';
}

function asValidDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKeyToStableUtcDate(dateKey) {
  const [year, month, day] = String(dateKey || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function getPtDateKey(value = new Date()) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  const date = asValidDate(value);
  if (!date) return '';
  const parts = ptDateFormatter.formatToParts(date);
  return partsToDateKey(parts);
}

export function getTodayPtDateKey() {
  return getPtDateKey(new Date());
}

export function formatPtMonthYear(value) {
  const date = asValidDate(value);
  if (!date) return 'Unknown';
  return ptMonthYearFormatter.format(date);
}

export function formatPtMonthYearFromDateKey(dateKey) {
  const date = dateKeyToStableUtcDate(dateKey);
  return date ? ptMonthYearFormatter.format(date) : 'Unknown';
}

export function formatPtFriendlyDate(value) {
  const date = asValidDate(value);
  if (!date) return '';
  return ptFriendlyDateFormatter.format(date);
}

export function formatPtFriendlyDateKey(dateKey) {
  const date = dateKeyToStableUtcDate(dateKey);
  return date ? ptFriendlyDateFormatter.format(date) : '';
}

export function shiftIsoDate(isoDate, days) {
  const [year, month, day] = String(isoDate || '').split('-').map(Number);
  if (!year || !month || !day) return '';
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + Number(days));
  return utcDate.toISOString().slice(0, 10);
}

function normalizeLegacyDate(value) {
  if (typeof value !== 'string' || !value.trim()) return '';

  const trimmed = value.trim();
  if (trimmed.includes('T')) {
    return getPtDateKey(trimmed);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  return getPtDateKey(trimmed);
}

export function migrateBookDatesToPt(book) {
  const progressLog = Array.isArray(book?.progressLog)
    ? book.progressLog.map((entry) => ({
        ...entry,
        date: normalizeLegacyDate(entry?.date),
      }))
    : [];

  return {
    ...book,
    progressLog,
    dateStarted: book?.dateStarted ? normalizeLegacyDate(book.dateStarted) : null,
    dateRead: book?.dateRead ? normalizeLegacyDate(book.dateRead) : null,
    timeZoneVersion: PT_TIME_ZONE_VERSION,
  };
}

export function migrateBooksToPtIfNeeded(sourceBooks) {
  if (!Array.isArray(sourceBooks)) {
    return { books: [], changed: false };
  }

  let changed = false;
  const migrated = sourceBooks.map((book) => {
    if (book?.timeZoneVersion === PT_TIME_ZONE_VERSION) {
      return book;
    }

    changed = true;
    return {
      ...migrateBookDatesToPt(book),
      timeZoneVersion: PT_TIME_ZONE_VERSION,
    };
  });

  return { books: migrated, changed };
}
