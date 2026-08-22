import { afterEach, describe, expect, it } from 'vitest';
import { isAppAuthorized, isAppAuthRequired, requireAppAuth } from '../../api/_lib/appAuth.js';

const originalEnv = {
  APP_PASSWORD: process.env.APP_PASSWORD,
  NODE_ENV: process.env.NODE_ENV,
  VERCEL: process.env.VERCEL,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function mockResponse() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
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

afterEach(() => {
  restoreEnv();
});

describe('app auth', () => {
  it('allows local development when APP_PASSWORD is not set', () => {
    delete process.env.APP_PASSWORD;
    delete process.env.VERCEL;
    process.env.NODE_ENV = 'development';

    expect(isAppAuthRequired()).toBe(false);
    expect(requireAppAuth({ headers: {} }, mockResponse())).toBe(true);
  });

  it('fails closed on Vercel when APP_PASSWORD is missing', () => {
    delete process.env.APP_PASSWORD;
    process.env.VERCEL = '1';
    process.env.NODE_ENV = 'production';

    const res = mockResponse();
    expect(requireAppAuth({ headers: {} }, res)).toBe(res);
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe('APP_PASSWORD_MISSING');
  });

  it('accepts the configured bearer password', () => {
    process.env.APP_PASSWORD = 'correct horse';
    process.env.VERCEL = '1';
    process.env.NODE_ENV = 'production';

    expect(isAppAuthorized({ headers: { authorization: 'Bearer correct horse' } })).toBe(true);
    expect(isAppAuthorized({ headers: { authorization: 'Bearer wrong' } })).toBe(false);
  });

  it('returns a password-required error for bad credentials', () => {
    process.env.APP_PASSWORD = 'correct horse';
    process.env.VERCEL = '1';
    process.env.NODE_ENV = 'production';

    const res = mockResponse();
    expect(requireAppAuth({ headers: { authorization: 'Bearer wrong' } }, res)).toBe(res);
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('APP_PASSWORD_REQUIRED');
    expect(res.headers['WWW-Authenticate']).toBe('Bearer realm="Bookmark"');
  });
});
