# Contributing

Thanks for taking a look. This started as a personal reading tracker and is now
open source so anyone can run their own copy.

## Ground rules

This project is deliberately small and opinionated. Bug fixes, accessibility
improvements, and provider support are very welcome. Large new features may be
declined if they push the app beyond "track what I read" — please open an issue
to discuss before writing a lot of code.

## Getting set up

```bash
git clone https://github.com/<your-username>/bookmark.git
cd bookmark
npm install
cp .env.example .env   # then fill in what you need
npm run dev
```

`npm run dev` runs the Vite frontend on `:5173` and the local Express API on
`:8787` concurrently. You do **not** need any API keys to work on most of the
app — book data falls back to `server/data/books.json` and AI endpoints return
a clean `503` when no key is configured.

## Before you open a pull request

```bash
npm run lint
npm test
npm run build
```

All three should pass. Please add or update tests in `src/test/` when you change
behavior.

## Project layout

| Path | What lives there |
|---|---|
| `src/` | React frontend (components, services, tests) |
| `api/` | Vercel serverless functions (production) |
| `api/_lib/` | Shared logic used by both `api/` and `server/` |
| `server/` | Local Express dev API mirroring the `api/` routes |
| `scripts/` | One-off maintenance and icon generation scripts |

**Important:** `server/index.js` mirrors the routes in `api/`. If you add or
change an endpoint, change it in both places, or better, extract the shared
logic into `api/_lib/` and import it from each side.

## Adding an AI provider

AI access goes through `api/_lib/aiProvider.js`. To add a provider:

1. `npm install @ai-sdk/<provider>` — it must be compatible with the `ai` v6 /
   `@ai-sdk/provider` v3 line already in the lockfile.
2. Add an entry to the `PROVIDERS` map with `label`, `defaultModel`,
   `keyEnvVars`, and `createProvider`.
3. Document the new value of `AI_PROVIDER` in the README env table.

Use a **static** import at the top of the file. Vercel's bundler traces imports
statically, so a dynamic `import()` with a computed specifier will fail at
runtime in production.

Nothing else should import a provider SDK directly — call `getLanguageModel()`
instead so every endpoint stays provider-agnostic.

## Commit and PR style

- Keep commits focused; a readable history matters more than a perfect one.
- Describe *why*, not just *what*, in the PR body.
- Screenshots are appreciated for UI changes.

## Security

Please don't file security problems as public issues. See [SECURITY.md](SECURITY.md).
