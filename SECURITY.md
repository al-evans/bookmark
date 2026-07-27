# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report vulnerabilities through
[GitHub Security Advisories](https://github.com/al-evans/bookmark/security/advisories/new).
You should get an acknowledgement within a few days. This is a hobby project
maintained in spare time, so please be patient with fix timelines.

## Scope

This is a self-hosted app: every deployment is owned and operated by the person
who deployed it. There is no shared multi-tenant service and no central database.
The most valuable reports are ones affecting *anyone* who deploys this code.

In scope:

- Secret leakage into the client bundle or into API responses
- Authentication bypass on `/api/cron-*` or `/api/admin-cron-test`
- Prompt injection that escapes the guards in the AI endpoints
- Cross-origin issues that bypass the `ALLOWED_ORIGINS` allowlist
- Anything letting an unauthenticated caller read or write another
  deployment's book data

Out of scope:

- Vulnerabilities in your own misconfiguration (for example, committing a real
  `.env` or setting `ALLOWED_ORIGINS=*`)
- Findings that require an attacker to already have your Vercel credentials
- Rate limiting on a personal single-user deployment

## Handling secrets

Every credential this app uses is server-side only and read from environment
variables. Never commit real values.

| Secret | Where it lives | Rotate by |
|---|---|---|
| `AI_API_KEY` | Vercel env / local `.env` | Revoking in your AI provider console |
| `KV_REST_API_TOKEN` | Vercel env / local `.env` | Rotating in Vercel Storage settings |
| `CRON_SECRET` | Vercel env | Generating a new random string |
| `ADMIN_TEST_SECRET` | Vercel env | Generating a new random string |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | Vercel env | `npx web-push generate-vapid-keys` |

The repo's `.gitignore` excludes `.env`, `.env.*` (except `.env.example`),
`server/data/books.json`, and `.vercel`. Keep it that way.

Never pass `ADMIN_TEST_SECRET` in a URL query string — URLs leak through browser
history, server logs, referrer headers, and screenshots. Use the `Authorization`
header or the `x-admin-test-secret` header instead.

If you suspect a secret was exposed, rotate it first and investigate second.
