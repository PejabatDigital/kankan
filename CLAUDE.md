# KanKan 看看

## What KanKan is
- A Netflix-style front end for YouTube, curated by the family.
- It only shows content the family adds. No algorithm, no recommendations, no random suggestions.
- Part of the Kasah Kod app family.

## Devices
- Web app on laptop, iPad and iPhone.
- Must work well with touch (iPad, iPhone) and with mouse/keyboard (laptop).

## Content
- **Individual videos:** one card each.
- **Playlists:** one card for the whole show. Tapping it opens a show page listing all episodes in playlist order.
- Content is added by pasting YouTube links.
- YouTube channels: not decided yet. Out of scope for now.
- One shared family library. No separate profiles.

## Playback
- Uses YouTube's official embedded player (YouTube IFrame Player API).
- Never hide, cover or remove YouTube's ads, logo or controls.
- No "Sign in with Google" for now. Playback relies on whatever YouTube account is signed in on that device's browser.
- No auto-play: when an episode ends, the "Up next" card is highlighted and the family taps "Play next" (decided 2026-11-17).
- Some creators turn off embedding. If a video can't play in KanKan, show a friendly message with a link to open it on YouTube.

## Screens
1. **Home:** rows of cards (e.g. Continue Watching, Shows, Videos).
2. **Show page:** the playlist's banner, then its episode list.
3. **Watch screen:** the YouTube player, plus "next episode" when watching a playlist.
4. **Parent area:** add and remove videos and playlists. It is protected by a grown-up maths question (e.g. "What is 14 × 6?") so the kids can't change the library. Decided 2026-11-17: maths question only, no PIN or secret. Amin accepts the risk that a stranger who finds the address could change the library. Answering the question unlocks Parents only until you leave the Parents page.

## Features
- **Show descriptions:** taken from YouTube and trimmed to a sentence or two.
- **New episodes:** a parent taps **Refresh** on a show in the Parents area (no automatic checking).
- **Continue Watching:** remembers where the family stopped in each video and episode, and shows it as a row on Home.

## Language
- English only.

## Design direction
- Bright, happy colour palette, but **not kiddish**: no playful, rounded or cartoon fonts. It should feel polished and grown-up, just cheerful.
- Netflix-style layout (rows of cards), with its own identity. Do not copy Netflix's look, colours or logo.
- Logo uses both "KanKan" and 看看.
- Use the frontend-design skill for all UI work.
- Process: mock up the screens first → agree the look → save it as a design system → build following that system.
- **Look agreed (2026-11-17):** plain light/white theme. Follow `docs/DESIGN.md` for all UI. Mockups are in `docs/mockups/`.

## Tech setup
- **Code:** plain HTML, CSS and JavaScript. No framework and no build step, to keep it simple.
- **Code lives in:** GitHub repo `PejabatDigital/kankan` (branch `main`).
- **Hosting:** a Cloudflare **Worker** named `kankann` (Workers static assets, not Pages), deployed from GitHub on every push to `main` via `npx wrangler deploy`. Settings are in `wrangler.jsonc` (its `name` must stay `kankann`).
- **Folders:**
  - `public/`: the website itself (what Cloudflare serves).
  - `src/`: the Worker's server code (from Phase 2).
  - `docs/`: design system and mockups. Not served on the website.
- **Run locally:** `npx wrangler@4 dev --port 8788`, then open http://127.0.0.1:8788. Uses a local copy of the database. YouTube lookups need `.dev.vars` (git-ignored) containing `YOUTUBE_API_KEY=...`.
- **Server side:** the Cloudflare Worker's own code, for the YouTube lookup and saving data.
- **Database:** Cloudflare D1 `kankan` (binding `DB`), holding the library (tables `items` and `episodes`, created automatically by the Worker). Continue Watching progress moves here in Phase 3.
- **YouTube Data API key:** Google Cloud project `Kankan`, key restricted to YouTube Data API v3. Stored as the Cloudflare secret `YOUTUBE_API_KEY`. Never put it in front-end code or commit it to GitHub.
- **Web address:** https://kankan.kasahkod.cc (also https://kankann.amindigital.workers.dev).

## Build phases
- **Phase 1 (done 2026-11-17):** the screens (Home, Show page, Watch screen) using a hand-entered list of content (`public/js/library.js`), to get the look and feel right. Continue Watching is saved per browser (localStorage) until Phase 3.
- **Phase 2 (done 2026-11-17):** the parent area (`public/parents.html`) with paste-a-link, plus automatic YouTube lookup of title, thumbnail and playlist episodes. Server code in `src/index.js` (API under `/api/`). Playlists are capped at 500 episodes.
- **Phase 3:** library and Continue Watching saved in the database, so every device sees the same thing.

## Still to decide
- Whether to support YouTube channels later

## How to work with Amin
- Discuss before building. Don't get ahead of him.
- Ask instead of assuming. If something isn't decided, ask, or mark it "to decide".
- Explain in plain English.
