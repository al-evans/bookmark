import { getBooksFromKv, getJsonFromKv, saveJsonToKv } from './_lib/books.js';
import {
  getPtDate,
  getPtUtcOffsetHours,
  isAdminTestAuthorized,
  isPtClockTimeInWindow,
  isCronAuthorized,
  isTruthyQueryFlag,
} from './_lib/cron.js';
import { shouldSendReminder } from './_lib/reminder.js';
import { sendWebPush } from './_lib/push.js';

const PUSH_SUBSCRIPTIONS_KEY = process.env.PUSH_SUBSCRIPTIONS_KV_KEY || 'reading-app:push-subscriptions';
const REMINDER_META_KEY = process.env.READING_REMINDER_META_KEY || 'reading-app:reminder-meta';
const REMINDER_START_HOUR_PT = 15;
const REMINDER_WINDOW_MINUTES = 180;

async function readSubscriptions() {
  const subscriptions = await getJsonFromKv(PUSH_SUBSCRIPTIONS_KEY, []);
  return Array.isArray(subscriptions) ? subscriptions : [];
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
  const utcOffsetHours = getPtUtcOffsetHours(now);
  if (!force && !isPtClockTimeInWindow(REMINDER_START_HOUR_PT, REMINDER_WINDOW_MINUTES, now)) {
    return res.status(200).json({
      ok: true,
      skipped: 'outside-target-time',
      targetPt: '15:00-17:59',
      utcOffsetHours,
    });
  }

  const todayPt = getPtDate(now);

  try {
    const meta = await getJsonFromKv(REMINDER_META_KEY, {});
    if (!force && meta?.lastSentDatePt === todayPt) {
      return res.status(200).json({ ok: true, skipped: 'already-sent-today' });
    }

    const books = await getBooksFromKv();
    // Suppress reminders whenever there is any same-day progress on a
    // currently-reading book, regardless of clock time.
    if (!shouldSendReminder(books, todayPt)) {
      return res.status(200).json({ ok: true, skipped: 'progress-updated-today' });
    }

    const subscriptions = await readSubscriptions();
    if (subscriptions.length === 0) {
      return res.status(200).json({ ok: true, skipped: 'no-subscribers' });
    }

    if (dryRun) {
      return res.status(200).json({
        ok: true,
        dryRun: true,
        wouldNotify: subscriptions.length,
        reason: 'eligible',
      });
    }

    const payload = {
      title: "📚 You haven't logged any reading today!",
      body: 'Log your percentage now.',
      tag: 'reading-reminder',
      url: '/',
    };

    const results = await Promise.allSettled(subscriptions.map((subscription) => sendWebPush(subscription, payload)));

    const activeSubscriptions = subscriptions.filter((_subscription, index) => {
      const result = results[index];
      if (result.status === 'fulfilled') return true;
      const statusCode = result.reason?.statusCode;
      return statusCode !== 404 && statusCode !== 410;
    });

    if (activeSubscriptions.length !== subscriptions.length) {
      await saveJsonToKv(PUSH_SUBSCRIPTIONS_KEY, activeSubscriptions);
    }

    const notified = results.filter((result) => result.status === 'fulfilled').length;
    const failed = results.filter((result) => result.status === 'rejected').length;

    if (notified === 0) {
      return res.status(activeSubscriptions.length === 0 ? 200 : 503).json({
        ok: activeSubscriptions.length === 0,
        skipped: activeSubscriptions.length === 0 ? 'no-active-subscribers' : undefined,
        error: activeSubscriptions.length > 0 ? 'All reminder push sends failed.' : undefined,
        notified,
        failed,
      });
    }

    await saveJsonToKv(REMINDER_META_KEY, { lastSentDatePt: todayPt });

    return res.status(200).json({
      ok: true,
      notified,
      failed,
    });
  } catch (error) {
    return res.status(503).json({ error: error?.message || 'Reminder cron failed.' });
  }
}
