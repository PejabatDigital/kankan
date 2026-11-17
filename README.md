# KanKan 看看

A family-curated, Netflix-style front end for YouTube. Plain HTML, CSS and JavaScript. No build step.

## Pages
- `index.html`: Home (banner, Continue Watching, Shows, Videos)
- `show.html?id=<show>`: Show page with all episodes in playlist order
- `watch.html?v=<videoId>&show=<show>`: Watch screen (YouTube embedded player)

## Content (Phase 1)
Shows and videos are hand-entered in `js/library.js`.
Watch progress is saved in the browser for now (localStorage). Phase 3 moves it to Cloudflare D1.

## Run locally
The YouTube player won't work from a `file://` address, so serve the folder:

```bash
python3 -m http.server 8788
```

Then open http://127.0.0.1:8788

## Deploy
Cloudflare Pages, connected to this GitHub repo. Build command: none. Output folder: `/`.
