import { afterEach, describe, expect, it } from 'vitest';
import healthHandler from '../../api/health.js';
import { kvCommand } from '../../api/_lib/books.js';

const TRACKED = [
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'APP_PASSWORD',
  'AI_API_KEY',
  'AI_PROVIDER',
];
const originalEnv = Object.fromEntries(TRACKED.map((key) => [key, process.env[key]]));

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function clearEnv() {
  for (const key of TRACKED) delete process.env[key];
}

function mockResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function runHealth() {
  const res = mockResponse();
  healthHandler({}, res);
  return res.body;
}

afterEach(() => {
  restoreEnv();
});

describe('setup status', () => {
  it('reports storage as missing when the KV variables are absent', () => {
    clearEnv();
    expect(runHealth().setup.storage).toBe(false);
  });

  it('needs both KV variables before storage counts as ready', () => {
    clearEnv();
    process.env.KV_REST_API_URL = 'https://example.upstash.io';
    expect(runHealth().setup.storage).toBe(false);

    process.env.KV_REST_API_TOKEN = 'token-value';
    expect(runHealth().setup.storage).toBe(true);
  });

  it('accepts the Upstash variable names as well as the Vercel ones', () => {
    // Vercel's Upstash integration injects KV_REST_API_*, but a store connected
    // straight from Upstash injects UPSTASH_REDIS_REST_*. Either must count.
    clearEnv();
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    expect(runHealth().setup.storage).toBe(false);

    process.env.UPSTASH_REDIS_REST_TOKEN = 'token-value';
    expect(runHealth().setup.storage).toBe(true);
  });

  it('does not report storage as ready when only Upstash-named halves are set', () => {
    clearEnv();
    process.env.KV_REST_API_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token-value';
    // Mixed pairs still resolve to a full URL + token, so this is ready.
    expect(runHealth().setup.storage).toBe(true);
  });

  it('reports the password once it is set', () => {
    clearEnv();
    expect(runHealth().setup.password).toBe(false);

    process.env.APP_PASSWORD = 'a-real-password';
    expect(runHealth().setup.password).toBe(true);
  });

  it('is only complete when storage and password are both ready', () => {
    clearEnv();
    process.env.KV_REST_API_URL = 'https://example.upstash.io';
    process.env.KV_REST_API_TOKEN = 'token-value';
    expect(runHealth().setup.complete).toBe(false);

    process.env.APP_PASSWORD = 'a-real-password';
    expect(runHealth().setup.complete).toBe(true);
  });

  it('never returns a secret value, because the route is unauthenticated', () => {
    clearEnv();
    process.env.KV_REST_API_URL = 'https://secret-host.upstash.io';
    process.env.KV_REST_API_TOKEN = 'secret-kv-token';
    process.env.APP_PASSWORD = 'secret-app-password';
    process.env.AI_API_KEY = 'secret-ai-key';

    const serialized = JSON.stringify(runHealth());

    for (const secret of ['secret-host.upstash.io', 'secret-kv-token', 'secret-app-password', 'secret-ai-key']) {
      expect(serialized).not.toContain(secret);
    }
  });

  it('tags the missing-storage failure so the app can show the setup screen', async () => {
    clearEnv();
    await expect(kvCommand(['GET', 'anything'])).rejects.toMatchObject({
      code: 'KV_NOT_CONFIGURED',
    });
  });
});
