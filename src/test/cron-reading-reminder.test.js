import { beforeEach, describe, expect, it, vi } from 'vitest';
import cronReadingReminder from '../../api/cron-reading-reminder.js';
import { getBooksFromKv, getJsonFromKv, saveJsonToKv } from '../../api/_lib/books.js';
import { getPtDate, getPtUtcOffsetHours } from '../../api/_lib/cron.js';
import { sendWebPush } from '../../api/_lib/push.js';

vi.mock('../../api/_lib/books.js', () => ({
  getBooksFromKv: vi.fn(),
  getJsonFromKv: vi.fn(),
  saveJsonToKv: vi.fn(),
}));

vi.mock('../../api/_lib/push.js', () => ({
  sendWebPush: vi.fn(),
}));

const PUSH_SUBSCRIPTIONS_KEY = 'reading-app:push-subscriptions';
const REMINDER_META_KEY = 'reading-app:reminder-meta';
const subscription = {
  endpoint: 'https://push.example/subscription',
  keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
};

function makeReq() {
  return {
    method: 'GET',
    headers: { authorization: 'Bearer test-admin-secret' },
    query: { force: '1' },
  };
}

function makeRes() {
  const state = { statusCode: 200, body: null, headers: {} };
  return {
    state,
    setHeader(name, value) {
      state.headers[name] = value;
    },
    status(code) {
      state.statusCode = code;
      return this;
    },
    json(payload) {
      state.body = payload;
      return this;
    },
  };
}

function seedEligibleBooks() {
  getBooksFromKv.mockResolvedValue([
    {
      id: 'book-1',
      title: 'Dune',
      status: 'currently-reading',
      progressLog: [],
    },
  ]);
}

function formatOffset(hoursOffset) {
  const sign = hoursOffset >= 0 ? '+' : '-';
  const absHours = Math.abs(Math.trunc(hoursOffset));
  const hh = String(absHours).padStart(2, '0');
  return `${sign}${hh}:00`;
}

describe('reading reminder cron delivery results', () => {
  beforeEach(() => {
    process.env.ADMIN_TEST_SECRET = 'test-admin-secret';
    vi.clearAllMocks();
    seedEligibleBooks();
    getJsonFromKv.mockImplementation(async (key, fallback) => {
      if (key === REMINDER_META_KEY) return {};
      if (key === PUSH_SUBSCRIPTIONS_KEY) return [subscription];
      return fallback;
    });
  });

  it('does not mark today sent when every push subscription is gone', async () => {
    sendWebPush.mockRejectedValue(Object.assign(new Error('Gone'), { statusCode: 410 }));

    const res = makeRes();
    await cronReadingReminder(makeReq(), res);

    expect(res.state.statusCode).toBe(200);
    expect(res.state.body).toMatchObject({
      ok: true,
      skipped: 'no-active-subscribers',
      notified: 0,
      failed: 1,
    });
    expect(saveJsonToKv).toHaveBeenCalledWith(PUSH_SUBSCRIPTIONS_KEY, []);
    expect(saveJsonToKv).not.toHaveBeenCalledWith(
      REMINDER_META_KEY,
      expect.objectContaining({ lastSentDatePt: expect.any(String) }),
    );
  });

  it('marks today sent after at least one successful push', async () => {
    sendWebPush.mockResolvedValue({});

    const res = makeRes();
    await cronReadingReminder(makeReq(), res);

    expect(res.state.statusCode).toBe(200);
    expect(res.state.body).toMatchObject({ ok: true, notified: 1, failed: 0 });
    expect(saveJsonToKv).toHaveBeenCalledWith(
      REMINDER_META_KEY,
      expect.objectContaining({ lastSentDatePt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }),
    );
  });

  it('skips when a current book has same-day progress, even after 3 PM PT', async () => {
    const now = new Date();
    const todayPt = getPtDate(now);
    const ptOffset = formatOffset(getPtUtcOffsetHours(now));

    getBooksFromKv.mockResolvedValue([
      {
        id: 'book-1',
        title: 'Dune',
        status: 'currently-reading',
        progressLog: [
          { date: `${todayPt}T16:30:00${ptOffset}`, currentPercent: 30 },
        ],
      },
    ]);

    const res = makeRes();
    await cronReadingReminder(makeReq(), res);

    expect(res.state.statusCode).toBe(200);
    expect(res.state.body).toMatchObject({ ok: true, skipped: 'progress-updated-today' });
    expect(sendWebPush).not.toHaveBeenCalled();
    expect(saveJsonToKv).not.toHaveBeenCalledWith(
      REMINDER_META_KEY,
      expect.objectContaining({ lastSentDatePt: expect.any(String) }),
    );
  });
});
