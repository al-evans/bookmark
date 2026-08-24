function toStableTimestamp(dateKey) {
  const value = String(dateKey || '').trim();

  if (value.includes('T')) {
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? Number.NaN : timestamp;
  }

  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) {
    return Number.NaN;
  }

  // Noon UTC avoids local timezone/DST rollover when comparing date-only keys.
  return Date.UTC(year, month - 1, day, 12);
}

export function sortProgressLogs(logs = []) {
  return [...logs].sort((a, b) => toStableTimestamp(a.date) - toStableTimestamp(b.date));
}

export function getCurrentPercent(logs = [], fallback = 0) {
  if (!logs.length) return fallback;
  const sorted = sortProgressLogs(logs);
  return sorted[sorted.length - 1].currentPercent ?? fallback;
}

export function calcAvgSpeedPercentPerDay(logs = []) {
  if (logs.length < 2) return 0;

  const sorted = sortProgressLogs(logs);
  let totalDelta = 0;
  let totalDays = 0;

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];

    const delta = Number(current.currentPercent) - Number(previous.currentPercent);
    const currentTimestamp = toStableTimestamp(current.date);
    const previousTimestamp = toStableTimestamp(previous.date);
    const days = Math.max(
      1,
      Math.round((currentTimestamp - previousTimestamp) / 86400000),
    );

    // A day you read but barely moved is still a day of reading. Counting only
    // the intervals that advanced would drop the slow stretches out of the
    // denominator and overstate your pace, which matters most on long books
    // where a whole percent is many pages. Intervals that go backwards are
    // corrections rather than reading, so those stay excluded.
    if (delta >= 0) {
      totalDelta += delta;
      totalDays += days;
    }
  }

  return totalDays ? totalDelta / totalDays : 0;
}

export function estimateDaysRemaining(currentPercent, avgSpeedPerDay) {
  if (avgSpeedPerDay <= 0 || currentPercent >= 100) return null;
  return Math.ceil((100 - currentPercent) / avgSpeedPerDay);
}

export const PROGRESS_UNITS = ['percent', 'pages'];

export function getTotalPages(book) {
  const total = Number(book?.totalPages);
  return Number.isFinite(total) && total > 0 ? Math.round(total) : null;
}

/** Pages are only offered when we know how many there are to count towards. */
export function resolveProgressUnit(book) {
  return book?.progressUnit === 'pages' && getTotalPages(book) ? 'pages' : 'percent';
}

/**
 * Percent stays the stored unit, so a page entry is kept at full precision
 * rather than rounded to a whole percent. On a 1200 page book a whole percent
 * is 12 pages, and that lost detail is what skews the pace estimate.
 */
export function pagesToPercent(page, totalPages) {
  const total = Number(totalPages);
  const value = Number(page);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, (value / total) * 100));
}

export function percentToPages(percent, totalPages) {
  const total = Number(totalPages);
  const value = Number(percent);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(value)) return null;
  return Math.min(total, Math.max(0, Math.round((value / 100) * total)));
}
