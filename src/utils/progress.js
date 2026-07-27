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

    if (delta > 0) {
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
