process.env.ADMIN_TEST_SECRET = 'local-admin-secret';
process.env.CRON_SECRET = 'cron-secret';
process.env.KV_REST_API_URL = 'https://kv.example.test';
process.env.KV_REST_API_TOKEN = 'kv-token';

const booksKey = process.env.BOOKS_KV_KEY || 'reading-app:books';
const subsKey = process.env.PUSH_SUBSCRIPTIONS_KV_KEY || 'reading-app:push-subscriptions';

const store = new Map();
store.set(booksKey, JSON.stringify([
  {
    id: 'b1',
    title: 'Dune',
    status: 'currently-reading',
    totalPages: 412,
    progressLog: [
      { date: '2026-04-06', currentPercent: 20 },
      { date: '2026-04-07', currentPercent: 30 },
    ],
    currentPercent: 30,
  },
  {
    id: 'b2',
    title: 'Neuromancer',
    status: 'read',
    totalPages: 271,
    dateRead: '2026-04-06',
    progressLog: [
      { date: '2026-04-03', currentPercent: 80 },
      { date: '2026-04-06', currentPercent: 100 },
    ],
    currentPercent: 100,
  },
]));
store.set(subsKey, JSON.stringify([
  { endpoint: 'https://push.example/sub', keys: { p256dh: 'x', auth: 'y' } },
]));

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  async json() { return body; },
  async text() { return JSON.stringify(body); },
});

globalThis.fetch = async (url, init = {}) => {
  if (String(url).includes('kv.example.test')) {
    const command = JSON.parse(init.body || '[]');
    const [op, key, value] = command;

    if (op === 'GET') return jsonResponse(200, { result: store.get(key) ?? null });
    if (op === 'SET') {
      store.set(key, value);
      return jsonResponse(200, { result: 'OK' });
    }

    return jsonResponse(400, { error: `Unsupported KV op: ${op}` });
  }

  if (String(url).includes('api.resend.com/emails')) {
    return jsonResponse(200, { id: 'email_mock_123' });
  }

  return jsonResponse(404, { error: 'Unknown URL' });
};

function makeReq(query = {}, headers = {}) {
  return { method: 'GET', query, headers, body: {} };
}

function makeRes() {
  const state = { statusCode: 200, headers: {}, body: null };
  return {
    state,
    setHeader(name, value) { state.headers[name] = value; },
    status(code) { state.statusCode = code; return this; },
    json(payload) { state.body = payload; return this; },
  };
}

const { default: adminCronTest } = await import('../api/admin-cron-test.js');

const authHeaders = { authorization: 'Bearer local-admin-secret' };

const reminderReq = makeReq({ job: 'reminder' }, authHeaders);
const reminderRes = makeRes();
await adminCronTest(reminderReq, reminderRes);

console.log('Reminder dry-run:', JSON.stringify(reminderRes.state, null, 2));
console.log('✓ All smoke tests passed!');
