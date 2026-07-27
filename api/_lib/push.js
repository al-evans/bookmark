import webpush from 'web-push';

let pushConfigured = false;

function ensureConfigured() {
  if (pushConfigured) return;

  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  const subject = process.env.WEB_PUSH_SUBJECT || 'mailto:notifications@example.com';

  if (!publicKey || !privateKey) {
    throw new Error('Web Push is not configured. Add WEB_PUSH_VAPID_PUBLIC_KEY and WEB_PUSH_VAPID_PRIVATE_KEY.');
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  pushConfigured = true;
}

export function getPublicVapidKey() {
  return process.env.WEB_PUSH_VAPID_PUBLIC_KEY || '';
}

export async function sendWebPush(subscription, payload) {
  ensureConfigured();
  return webpush.sendNotification(subscription, JSON.stringify(payload));
}
