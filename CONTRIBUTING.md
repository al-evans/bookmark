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
| `docs/social-preview.png` | `docs/social-preview.svg` | 2400x1260, for `og:image` |
| `docs/social-preview-github.png` | `docs/social-preview-github.svg` | 1280x640, for Settings > Social preview |
| `docs/readme-banner.png` | `docs/readme-banner.svg` | 2400x720, for `README.md` |
| `docs/demo/scene-1.webp` to `scene-7.webp` | see below | 780x1666, the hero demo on the landing page |
| `docs/bookmark-demo.mp4` | see below | 1920x1080, 25 fps, 21.6 s. Only for `og:video` now |

Each `.svg` holds its screenshot as a base64 `<image>`. GitHub does not load
external files from an SVG, so a relative link shows a broken image.

### To rebuild an image

1. Start the app with `npm run dev`.
2. Capture with Playwright at `deviceScaleFactor: 3`. Crop from the top with
   `screenshot({ clip: { x: 0, y: 0, ... } })`. A centred crop cuts the header off.
3. Put the new base64 data into the `.svg`.
4. Render the `.svg` to PNG at `deviceScaleFactor: 2`, then downscale with
   LANCZOS if the file needs an exact size.
   `docs/social-preview-github.png` must be exactly 1280x640. That is the size
   GitHub documents for Settings > Social preview, and a 2x file was rejected
   there: GitHub kept the reference but never stored the image, so the card
   came back blank and the stored URL returned 404.
5. Keep every important detail inside a 78 px border on `social-preview-github.png`.
   That is the 40pt safe area on GitHub's own repository card template, and it is
   what stops the phone being cropped. Decoration may cross it; the wordmark, the
   text, and the phone may not. The phone still bleeds off the bottom on purpose,
   because the part below the cut carries no information.
6. Bump the `?v=` number on `og:image` and `twitter:image` in `docs/index.html`
   whenever `social-preview.png` changes. LinkedIn, Slack, and X cache the image
   against its URL, so an unchanged URL keeps serving the old picture for days.
   Bumping the number makes it a new URL, so every scraper fetches again.
5. Measure `getBoundingClientRect()` on each `<text>` node. Overlapping text is
   easy to miss by eye.

### The README banner shares a layout with the private repo

`docs/readme-banner.svg` and the banner in the private `reading-app` repo use
the same layout, typeface, palette and copy. They were allowed to drift apart
once, and the private one ended up hand-drawn in the wrong typeface. Generate
both from one template so that cannot happen again.

**Share the template, not the screenshots.** The public app now says Bookmark in
its header while the private repo still carries the Reading Goals header, and the
interfaces differ too: the Percent and Pages toggle, the app lock and the setup
check are all bookmark-only. A screenshot therefore belongs to exactly one repo,
and each repo captures its own screens from its own running app. Only the
template travels.

The two screens are not both taken from `docs/demo/`:

| Screen | Box | Source |
|---|---|---|
| A, left | `x 701 y 107 w 216 h 288` | a one-off capture of Currently Reading at 74 percent, with the Log button showing |
| B, right | `x 920 y 56 w 228 h 339` | `docs/demo/scene-5.webp`, the reading stats |

Screen A is not `scene-3.webp`. Scene 3 has the progress history sheet open, so
it hides the Log button the banner is meant to show. Seed the 74 percent state
and capture the plain Currently Reading screen instead.

Embed each screen at exactly twice its box width, so 432 and 456 px. The PNG
renders at 2400x720, which is twice the 1200 viewBox, so a 2x embed lands
pixel-for-pixel. Do not downscale the finished PNG to 1200x360; that throws away
half the resolution on high-density screens.

### Alt text can go stale on its own

Some `alt` text on the landing page quotes numbers that the app calculates from
today's date, such as "29.6 days a book" on scene 5. That figure moves as real
time passes, even when nothing in the app changes. Read the value off the new
screenshot every time you recapture, and correct the `alt` text to match.

### To rebuild the hero demo

The landing page hero is HTML, not a video. It shows the same seven scenes,
but each one is a real screenshot in a CSS phone, and the caption is text.

Capture the seven screens exactly as the video section below describes, then
resize each to 780x1666 and save it as WebP at quality 84:

```py
from PIL import Image
Image.open("s1.png").convert("RGB").resize((780, 1666), Image.LANCZOS) \
    .save("docs/demo/scene-1.webp", "WEBP", quality=84, method=6)
```

780x1666 is twice the 390x833 capture viewport, so the screen stays sharp on
a 2x display. All seven come to about 308 KB, and only the first one loads
before the visitor scrolls.

The captions live in `docs/index.html` on each dot button, as `data-title`
and `data-sub`. Keep them the same as the video slides so the two agree.

### To rebuild the demo video

The video is no longer on the page. It stays in `docs/` because `og:video`
points at it, so a social card can still play it.

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

Re-seed that file immediately before **every** capture run, not once at the
start. Scene 2 clicks the Pages unit toggle, and the app saves that choice to
the book at once. Re-running the first scenario without re-seeding therefore
captures scene 1 in pages mode, which disagrees with the percent history in
scene 3.

Two settings decide whether the capture is usable:

- Emulate the phone safe area. Send `Emulation.setSafeAreaInsetsOverride` with
  `{ insets: { bottom: 34 } }` over CDP before you navigate. The bottom nav
  uses `max(env(safe-area-inset-bottom, 0), 0.25rem)`, and headless Chrome
  reports that inset as 0, so the nav lands 4px from the screen edge instead
  of 34px. The phone frame on the landing page has a 33px corner radius and
  `overflow: hidden`, so at 4px the first tab label appears shaved because the
  two antialiased edges overlap, although it clears the arc.
- Wait for the covers properly. The list renders only after the API responds,
  so at `domcontentloaded` `document.images` is still empty, and `[].every()`
  is `true`. A wait built only on that check returns at once and screenshots a
  blank cover. Wait for `.bottom-nav`, then `networkidle`, and only then check
  that every image is complete. Print the loaded count with each shot.

Capture the screens at a 390x833 viewport with `deviceScaleFactor: 3`. Each
slide is 1920x1080 on `#F8FAFC`:

- phone bezel: `x 1199, y 40, w 482, h 998, rx 52`, fill `#0F172A`
- screen: `x 1213, y 54, w 454, h 970`
- headline: `x 121`, baseline 450, Inter 68, weight 800, letter spacing -0.4
- subtitle: `x 121`, baseline 533, Inter 49, weight 400, `#334155`
- dots: `y 672`, 7 of `24x8 rx 4`, pitch 36. Active `#1E4BE4`, idle `#D6DDE4`

Join the slides with ffmpeg. Each slide shows for 3.428571 s and each
crossfade takes 0.4 s. This gives 21.6 s in total.

Two encoder settings are necessary. Without them the book cover looks soft
for about half a second after each crossfade, because x264 predicts those
frames from the blurred dissolve and gives the detail too few bits.

- `-force_key_frames` at the end of every crossfade, that is at
  `0,3.4286,6.4571,9.4857,12.5143,15.5429,18.5714`. A dissolve is gradual,
  so scene-cut detection does not fire on it. Force the keyframes instead.
- `-tune stillimage -crf 29`. The slides are static, so this tune holds
  detail far better at the same size.

To check the result, take the exact frames after a crossfade with
`-vf "select='between(n,A,B)'" -vsync 0 -frame_pts 1` and compare the
variance of the Laplacian. Do not seek with `-ss` before `-i`: that snaps
to the nearest keyframe and returns the same frame every time.

## Commit and PR style

- Keep commits focused; a readable history matters more than a perfect one.
- Describe *why*, not just *what*, in the PR body.
- Screenshots are appreciated for UI changes.

## Security

Please don't file security problems as public issues. See [SECURITY.md](SECURITY.md).
