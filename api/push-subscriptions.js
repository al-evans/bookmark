import { getJsonFromKv, saveJsonToKv } from './_lib/books.js';
import { getPublicVapidKey } from './_lib/push.js';

const PUSH_SUBSCRIPTIONS_KEY = process.env.PUSH_SUBSCRIPTIONS_KV_KEY || 'reading-app:push-subscriptions';

function isValidSubscription(subscription) {
  return Boolean(
    subscription
    && typeof subscription.endpoint === 'string'
    && subscription.endpoint
    && subscription.keys
    && typeof subscription.keys.p256dh === 'string'
    && typeof subscription.keys.auth === 'string'
  );
}

async function readSubscriptions() {
  const stored = await getJsonFromKv(PUSH_SUBSCRIPTIONS_KEY, []);
  return Array.isArray(stored) ? stored.filter(isValidSubscription) : [];
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ publicVapidKey: getPublicVapidKey() });
  }

  if (req.method === 'POST') {
    const subscription = req.body?.subscription;
    if (!isValidSubscription(subscription)) {
      return res.status(400).json({ error: 'Invalid push subscription.' });
    }

    try {
      const subscriptions = await readSubscriptions();
      const deduped = subscriptions.filter((entry) => entry.endpoint !== subscription.endpoint);
      deduped.push(subscription);
      await saveJsonToKv(PUSH_SUBSCRIPTIONS_KEY, deduped);
      return res.status(200).json({ ok: true });
    } catch (error) {
      return res.status(503).json({ error: error?.message || 'Could not store push subscription.' });
    }
  }

  if (req.method === 'DELETE') {
    const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint : '';
    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint is required.' });
    }

    try {
      const subscriptions = await readSubscriptions();
      const remaining = subscriptions.filter((entry) => entry.endpoint !== endpoint);
      await saveJsonToKv(PUSH_SUBSCRIPTIONS_KEY, remaining);
      return res.status(200).json({ ok: true });
    } catch (error) {
      return res.status(503).json({ error: error?.message || 'Could not remove push subscription.' });
    }
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ error: 'Method not allowed.' });
}
