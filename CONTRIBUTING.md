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

## Marketing assets

`docs/` holds the landing page images and the demo video. They all show real
screenshots of the running app. Do not draw the app interface by hand. A
drawing goes stale, and the last hand-drawn preview was wrong in six ways.

| File | Source | Purpose |
|---|---|---|
| `docs/social-preview.png` | `docs/social-preview.svg` | 1200x630, for `og:image` |
| `docs/social-preview-github.png` | `docs/social-preview-github.svg` | 1280x640, for Settings > Social preview |
| `docs/readme-banner.png` | `docs/readme-banner.svg` | 1200x360, for `README.md` |
| `docs/bookmark-demo.mp4` | see below | 1920x1080, 25 fps, 21.6 s |
| `docs/bookmark-demo-poster.jpg` | frame 0 of the video | 1920x1080 |

Each `.svg` holds its screenshot as a base64 `<image>`. GitHub does not load
external files from an SVG, so a relative link shows a broken image.

### To rebuild an image

1. Start the app with `npm run dev`.
2. Capture with Playwright at `deviceScaleFactor: 3`. Crop from the top with
   `screenshot({ clip: { x: 0, y: 0, ... } })`. A centred crop cuts the header off.
3. Put the new base64 data into the `.svg`.
4. Render the `.svg` to PNG at `deviceScaleFactor: 2`.
5. Measure `getBoundingClientRect()` on each `<text>` node. Overlapping text is
   easy to miss by eye.

### To rebuild the demo video

The video has 7 slides. Each slide shows a headline, a subtitle, a row of 7
dots, and one phone screenshot.

| # | Headline | Screen |
|---|---|---|
| 1 | Track what you read | Currently Reading, before you log |
| 2 | Log progress fast | The log form, with Percent and Pages |
| 3 | See it update instantly | The new percent, progress history open |
| 4 | Keep a want-to-read list | Want to Read |
| 5 | See your reading stats | Finished, stats open |
| 6 | Review what you finished | Finished, books grouped by month |
| 7 | Make the app yours | Settings |

Slides 1 and 2 show the book before you log progress. Slides 3 to 7 show it
after. Change `server/data/books.json` to stage each state, and keep a backup.
That file is in `.gitignore`. Make sure it stays untracked.

Capture the screens at a 390x833 viewport with `deviceScaleFactor: 3`. Each
slide is 1920x1080 on `#F8FAFC`:

- phone bezel: `x 1199, y 40, w 482, h 998, rx 52`, fill `#0F172A`
- screen: `x 1213, y 54, w 454, h 970`
- headline: `x 121`, baseline 450, Inter 68, weight 800, letter spacing -0.4
- subtitle: `x 121`, baseline 533, Inter 49, weight 400, `#334155`
- dots: `y 672`, 7 of `24x8 rx 4`, pitch 36. Active `#1E4BE4`, idle `#D6DDE4`

Join the slides with ffmpeg. Each slide shows for 3.428571 s and each
crossfade takes 0.4 s. This gives 21.6 s in total.

## Commit and PR style

- Keep commits focused; a readable history matters more than a perfect one.
- Describe *why*, not just *what*, in the PR body.
- Screenshots are appreciated for UI changes.

## Security

Please don't file security problems as public issues. See [SECURITY.md](SECURITY.md).
