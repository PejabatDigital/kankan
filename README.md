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

## Run locally
The YouTube player doesn't work from a `file://` address, so serve the folder:

```bash
python3 -m http.server 8788 --directory public
```

Then open http://127.0.0.1:8788

## Deploy
Cloudflare Worker `kankann`, connected to this repo. Every push to `main` goes live (`npx wrangler deploy`, settings in `wrangler.jsonc`).

Live at https://kankan.kasahkod.cc
