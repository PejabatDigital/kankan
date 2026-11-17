# KanKan 看看

A family-curated, Netflix-style front end for YouTube. Part of the Kasah Kod app family.
Plain HTML, CSS and JavaScript. No framework, no build step.

## Folders
| Folder | What's in it |
|---|---|
| `public/` | The website (what Cloudflare serves) |
| `src/` | Worker server code (from Phase 2) |
| `docs/` | Design system (`DESIGN.md`) and mockups |
| `CLAUDE.md` | Project brief and decisions |

## Pages
- `index.html`: Home (banner, Continue Watching, Shows, Videos)
- `show.html?id=<show>`: Show page, all episodes in playlist order
- `watch.html?v=<videoId>&show=<show>`: Watch screen (YouTube embedded player)
- `parents.html`: Parents area (maths question, then add / edit tags / remove / refresh)

## Run locally
Needs Node.js. Runs the Worker with a local copy of the database:

```bash
npx wrangler@4 dev --port 8788
```

Then open http://127.0.0.1:8788. For YouTube lookups, create a `.dev.vars` file (never committed) with `YOUTUBE_API_KEY=...`.

## API
| Method | Path | What it does |
|---|---|---|
| GET | `/api/library` | All shows (with episodes), videos and watch progress |
| POST | `/api/preview` | `{ url }` → what a YouTube link points to |
| POST | `/api/items` | `{ url, title?, ages, categories?, languages?, order?, cover? }` → add it |
| PATCH | `/api/items/:id` | `{ title?, ages?, categories?, languages?, order?, cover? }` → edit it |
| DELETE | `/api/items/:id` | Remove a show or video |
| POST | `/api/items/:id/refresh` | Re-read a show's episodes from YouTube |
| POST | `/api/progress` | `{ items: [{ v, show, t, d, done }] }` → save where the family stopped |

## Deploy
Cloudflare Worker `kankann`, connected to this repo. Every push to `main` goes live (`npx wrangler deploy`, settings in `wrangler.jsonc`).

Live at https://kankan.kasahkod.cc
