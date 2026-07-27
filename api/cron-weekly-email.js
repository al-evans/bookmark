import { getBooksFromKv, getJsonFromKv, saveJsonToKv } from './_lib/books.js';
import {
  getLast7DayWindowEndingYesterday,
  getPtDate,
  getPtHour,
  getPtWeekday,
  isAdminTestAuthorized,
  isCronAuthorized,
  isTruthyQueryFlag,
} from './_lib/cron.js';

const WEEKLY_META_KEY = process.env.WEEKLY_EMAIL_META_KEY || 'reading-app:weekly-email-meta';
const WEEKLY_EMAIL_HOUR_PT = Number(process.env.WEEKLY_EMAIL_HOUR_PT || 9);

function toDateOnly(value) {
  return typeof value === 'string' ? value.slice(0, 10) : '';
}

function inRange(date, start, end) {
  return date >= start && date <= end;
}

function sortLogs(logs = []) {
  return [...logs]
    .filter((entry) => typeof entry?.date === 'string')
    .sort((a, b) => a.date.localeCompare(b.date));
}

function calculatePagesReadForBook(book, start, end) {
  const totalPages = Number(book?.totalPages);
  if (!Number.isFinite(totalPages) || totalPages <= 0) return 0;

  const logs = sortLogs(Array.isArray(book?.progressLog) ? book.progressLog : []);
  if (logs.length < 2) return 0;

  let pages = 0;
  for (let index = 1; index < logs.length; index += 1) {
    const previous = logs[index - 1];
    const current = logs[index];
    const currentDate = toDateOnly(current.date);

    if (!inRange(currentDate, start, end)) continue;

    const deltaPercent = Number(current.currentPercent) - Number(previous.currentPercent);
    if (deltaPercent <= 0) continue;

    pages += Math.round((deltaPercent / 100) * totalPages);
  }

  return pages;
}

function getBooksFinishedThisWeek(books, start, end) {
  return books
    .filter((book) => book.status === 'read' && inRange(toDateOnly(book.dateRead), start, end))
    .map((book) => book.title)
    .filter(Boolean);
}

function buildWeeklyEmailHtml({ name, pagesRead, finishedTitles, start, end }) {
  const finishedSection = finishedTitles.length
    ? `<p style="margin:0 0 12px; color:#0f172a;">You finished <strong>${finishedTitles.join(', ')}</strong>.</p>`
    : '<p style="margin:0 0 12px; color:#0f172a;">You did not finish a book this week, but your momentum is building 📈</p>';

  return `
  <div style="font-family:Inter,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;">
    <h1 style="margin:0 0 12px;color:#1d4ed8;font-size:24px;">Weekly Reading Recap</h1>
    <p style="margin:0 0 12px;color:#0f172a;">Great job ${name}! You read <strong>${pagesRead} pages</strong> this week.</p>
    ${finishedSection}
    <p style="margin:12px 0 0;color:#475569;font-size:13px;">Window: ${start} → ${end} (PT)</p>
  </div>`;
}

async function sendWeeklyEmail({ pagesRead, finishedTitles, start, end }) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.WEEKLY_EMAIL_TO;
  const fromEmail = process.env.WEEKLY_EMAIL_FROM;
  const recipientName = process.env.WEEKLY_EMAIL_NAME || 'Amanda';

  if (!resendApiKey || !toEmail || !fromEmail) {
    throw new Error('Missing email settings. Add RESEND_API_KEY, WEEKLY_EMAIL_TO, and WEEKLY_EMAIL_FROM.');
  }

  const finishedLine = finishedTitles.length ? ` and finished ${finishedTitles[0]}` : '';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      subject: `📚 Weekly reading update: ${pagesRead} pages${finishedLine}`,
      html: buildWeeklyEmailHtml({
        name: recipientName,
        pagesRead,
        finishedTitles,
        start,
        end,
      }),
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Resend request failed (${response.status}). ${text}`.trim());
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const force = isTruthyQueryFlag(req.query?.force);
  const dryRun = isTruthyQueryFlag(req.query?.dryRun);

  const hasCronAuth = isCronAuthorized(req);
  const hasAdminAuth = isAdminTestAuthorized(req);
  if (!hasCronAuth && !hasAdminAuth) {
    return res.status(401).json({ error: 'Unauthorized cron call.' });
  }

  if ((force || dryRun) && !hasAdminAuth) {
    return res.status(403).json({ error: 'Admin test auth required for force or dryRun.' });
  }

  const now = new Date();
  if (!force && (getPtWeekday(now) !== 'Sun' || getPtHour(now) !== WEEKLY_EMAIL_HOUR_PT)) {
    return res.status(200).json({ ok: true, skipped: 'outside-target-window' });
  }

  const todayPt = getPtDate(now);

  try {
    const meta = await getJsonFromKv(WEEKLY_META_KEY, {});
    if (!force && meta?.lastSentDatePt === todayPt) {
      return res.status(200).json({ ok: true, skipped: 'already-sent-this-week' });
    }

    const books = await getBooksFromKv();
    const { start, end } = getLast7DayWindowEndingYesterday(now);

    const pagesRead = books.reduce((sum, book) => sum + calculatePagesReadForBook(book, start, end), 0);
    const finishedTitles = getBooksFinishedThisWeek(books, start, end);

    if (dryRun) {
      return res.status(200).json({
        ok: true,
        dryRun: true,
        pagesRead,
        finishedCount: finishedTitles.length,
        finishedTitles,
        start,
        end,
      });
    }

    await sendWeeklyEmail({ pagesRead, finishedTitles, start, end });
    await saveJsonToKv(WEEKLY_META_KEY, { lastSentDatePt: todayPt });

    return res.status(200).json({ ok: true, pagesRead, finishedCount: finishedTitles.length, start, end });
  } catch (error) {
    return res.status(503).json({ error: error?.message || 'Weekly email cron failed.' });
  }
}
