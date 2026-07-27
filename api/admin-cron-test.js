import reminderHandler from './cron-reading-reminder.js';
import { isAdminTestAuthorized } from './_lib/cron.js';

function makeMockResponse() {
  const state = {
    statusCode: 200,
    headers: {},
    body: null,
  };

  const res = {
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

  return { state, res };
}

async function runHandler(handler, {
  force,
  dryRun,
  adminSecret,
}) {
  const req = {
    method: 'GET',
    headers: {
      authorization: `Bearer ${adminSecret}`,
      'x-admin-test-secret': adminSecret,
    },
    query: {
      force: force ? '1' : '0',
      dryRun: dryRun ? '1' : '0',
    },
  };

  const { state, res } = makeMockResponse();
  await handler(req, res);
  return state;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (!isAdminTestAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized admin test call.' });
  }

  const body = req.body || {};
  const job = typeof req.query?.job === 'string' ? req.query.job : body.job;
  const mode = typeof req.query?.mode === 'string' ? req.query.mode : body.mode;

  const adminSecret = process.env.ADMIN_TEST_SECRET;
  const dryRun = mode !== 'send';

  if (!adminSecret) {
    return res.status(503).json({ error: 'ADMIN_TEST_SECRET is not configured.' });
  }

  if (job === 'reminder') {
    const result = await runHandler(reminderHandler, {
      force: true,
      dryRun,
      adminSecret,
    });
    return res.status(200).json({ ok: true, job, mode: dryRun ? 'dry-run' : 'send', result });
  }

  return res.status(400).json({
    error: 'Invalid job. Use job=reminder.',
  });
}
