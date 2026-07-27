const PT_TIME_ZONE = 'America/Los_Angeles';

const ptDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: PT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function partsToDateKey(parts) {
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return year && month && day ? `${year}-${month}-${day}` : '';
}

const ptHourFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: PT_TIME_ZONE,
  hour: '2-digit',
  hour12: false,
});

const ptMinuteFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: PT_TIME_ZONE,
  minute: '2-digit',
});

const ptOffsetFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: PT_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZoneName: 'shortOffset',
});

const ptWeekdayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: PT_TIME_ZONE,
  weekday: 'short',
});

function toDateInUtc(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function getPtDate(date = new Date()) {
  return partsToDateKey(ptDateFormatter.formatToParts(date));
}

export function shiftIsoDate(isoDate, days) {
  const base = toDateInUtc(isoDate);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function getPtHour(date = new Date()) {
  return Number(ptHourFormatter.format(date));
}

export function getPtMinute(date = new Date()) {
  return Number(ptMinuteFormatter.format(date));
}

export function getPtUtcOffsetHours(date = new Date()) {
  const tzPart = ptOffsetFormatter
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value || 'GMT-8';

  const match = tzPart.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/i);
  if (!match) {
    return -8;
  }

  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2]) || 0;
  const minutes = Number(match[3] || 0) / 60;
  return sign * (hours + minutes);
}

export function isExactPtClockTime(targetHour, targetMinute = 0, date = new Date()) {
  return getPtHour(date) === targetHour && getPtMinute(date) === targetMinute;
}

export function isPtClockTimeInWindow(targetHour, windowMinutes = 60, date = new Date()) {
  const ptHour = getPtHour(date);
  const ptMinute = getPtMinute(date);
  const currentMinutes = (ptHour * 60) + ptMinute;
  const startMinutes = targetHour * 60;
  const safeWindowMinutes = Math.max(0, Number(windowMinutes) || 0);
  return currentMinutes >= startMinutes && currentMinutes < (startMinutes + safeWindowMinutes);
}

export function getPtWeekday(date = new Date()) {
  return ptWeekdayFormatter.format(date);
}

export function getLast7DayWindowEndingYesterday(date = new Date()) {
  const todayPt = getPtDate(date);
  const end = shiftIsoDate(todayPt, -1);
  const start = shiftIsoDate(end, -6);
  return { start, end };
}

export function isCronAuthorized(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return true;
  }

  const authHeader = req.headers.authorization || '';
  return authHeader === `Bearer ${cronSecret}`;
}

export function isAdminTestAuthorized(req) {
  const adminSecret = process.env.ADMIN_TEST_SECRET;
  if (!adminSecret) {
    return false;
  }

  const authHeader = req.headers.authorization || '';
  const testHeader = req.headers['x-admin-test-secret'] || '';
  return authHeader === `Bearer ${adminSecret}` || testHeader === adminSecret;
}

export function isTruthyQueryFlag(value) {
  if (Array.isArray(value)) {
    return value.some((entry) => isTruthyQueryFlag(entry));
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}
