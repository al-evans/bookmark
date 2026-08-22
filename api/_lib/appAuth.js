import { timingSafeEqual } from 'node:crypto';

const APP_PASSWORD_ENV = 'APP_PASSWORD';

function isLocalDev() {
  return process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1';
}

export function isAppAuthConfigured() {
  return Boolean(String(process.env[APP_PASSWORD_ENV] || '').trim());
}

export function isAppAuthRequired() {
  return isAppAuthConfigured() || !isLocalDev();
}

function extractBearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const value = Array.isArray(header) ? header[0] : header;
  const match = /^Bearer\s+(.+)$/i.exec(String(value || '').trim());
  return match ? match[1].trim() : '';
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function isAppAuthorized(req) {
  if (!isAppAuthRequired()) return true;
  const expected = String(process.env[APP_PASSWORD_ENV] || '').trim();
  if (!expected) return false;
  return safeEqual(extractBearerToken(req), expected);
}

export function requireAppAuth(req, res) {
  if (!isAppAuthRequired()) return true;

  if (!isAppAuthConfigured()) {
    return res.status(503).json({
      error: 'App password is not configured. Set APP_PASSWORD in your Vercel environment.',
      code: 'APP_PASSWORD_MISSING',
    });
  }

  if (!isAppAuthorized(req)) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="Bookmark"');
    return res.status(401).json({
      error: 'Enter the app password to unlock this Bookmark deployment.',
      code: 'APP_PASSWORD_REQUIRED',
    });
  }

  return true;
}
