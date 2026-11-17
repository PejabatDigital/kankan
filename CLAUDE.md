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
- Some creators turn off embedding. If a video can't play in KanKan, show a friendly message with a link to open it on YouTube.

## Screens
1. **Home:** rows of cards (e.g. Continue Watching, Shows, Videos).
2. **Show page:** the playlist's banner, then its episode list.
3. **Watch screen:** the YouTube player, plus "next episode" when watching a playlist.
4. **Parent area:** add and remove videos and playlists. It is protected so the kids can't change the library (protection method still to decide).

## Features
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
- **Hosting:** Cloudflare Pages, deployed from GitHub on every push to `main`. Build command: none. Output folder: `public`.
- **Folders:**
  - `public/`: the website itself (what Cloudflare serves).
  - `functions/`: Cloudflare Pages Functions (from Phase 2).
  - `docs/`: design system and mockups. Not served on the website.
- **Run locally:** `python3 -m http.server 8788 --directory public`, then open http://127.0.0.1:8788 (the YouTube player doesn't work from `file://`).
- **Server side:** Cloudflare Pages Functions, for the YouTube lookup and saving data.
- **Database:** Cloudflare D1, holding the library and Continue Watching progress.
- **YouTube Data API key:** stored as a Cloudflare secret. Never put it in front-end code or commit it to GitHub.
- **Web address:** on a kasahkod domain (exact address still to decide).

## Build phases
- **Phase 1 (done 2026-11-17):** the screens (Home, Show page, Watch screen) using a hand-entered list of content (`public/js/library.js`), to get the look and feel right. Continue Watching is saved per browser (localStorage) until Phase 3.
- **Phase 2:** the parent area with paste-a-link, plus automatic YouTube lookup of title, thumbnail and playlist episodes.
- **Phase 3:** library and Continue Watching saved in the database, so every device sees the same thing.

## Still to decide
- How the parent area is protected (e.g. a PIN)
- Exact web address on the kasahkod domain
- Google Cloud account: Amin to check whether he has one (needed for the YouTube key in Phase 2)
- Whether to support YouTube channels later
- Whether the next episode plays automatically when one ends (currently: no, the "Up next" card is highlighted)

## How to work with Amin
- Discuss before building. Don't get ahead of him.
- Ask instead of assuming. If something isn't decided, ask, or mark it "to decide".
- Explain in plain English.
