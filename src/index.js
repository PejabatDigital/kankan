// KanKan Worker — the server side.
// Serves the website from public/ and a small API under /api/:
//   GET    /api/library              everything in KanKan (shows with episodes, single videos, watch progress)
//   POST   /api/preview              { url } -> what a pasted YouTube link points to
//   POST   /api/items                { url, title?, ages, categories, languages, order?, cover? } -> add it
//   PATCH  /api/items/:id            { title?, ages?, categories?, languages?, order?, cover? } -> edit it
//   DELETE /api/items/:id            remove a show or video
//   POST   /api/items/:id/refresh    re-read a show's episodes from YouTube
//   POST   /api/progress             { items: [{ v, show, t, d, done }] } -> save where the family stopped
//
// The YouTube key lives in the Cloudflare secret YOUTUBE_API_KEY and never leaves the server.

const YT = "https://www.googleapis.com/youtube/v3";
const MAX_EPISODES = 500;

// Tag lists. The labels shown on screen live in public/js/app.js (KK.TAGS).
const AGES = ["baby", "preschool", "early-primary", "upper-primary"];
const CATEGORIES = ["cartoons", "learning", "songs-music", "stories", "nature-science", "arts-crafts"];
const LANGUAGES = ["en", "ms", "zh"];
const ORDERS = ["playlist", "reverse"];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try {
      await ensureSchema(env.DB);
      return await route(request, env, url);
    } catch (err) {
      if (err instanceof UserError) return json({ error: err.message }, err.status);
      console.error(err);
      return json({ error: "Something went wrong. Please try again." }, 500);
    }
  },
};

// ---------- Routing ----------
async function route(request, env, url) {
  const m = request.method;
  const p = url.pathname.replace(/\/+$/, "");
  const db = env.DB;

  if (p === "/api/library" && m === "GET") return json(await library(db));

  if (p === "/api/preview" && m === "POST") {
    const { url: link } = await body(request);
    const found = await lookup(env, parseLink(link));
    const exists = await db.prepare("SELECT 1 FROM items WHERE id = ?").bind(found.id).first();
    return json({ ...summary(found), alreadyAdded: !!exists });
  }

  if (p === "/api/items" && m === "POST") {
    const b = await body(request);
    const found = await lookup(env, parseLink(b.url));
    const exists = await db.prepare("SELECT 1 FROM items WHERE id = ?").bind(found.id).first();
    if (exists) throw new UserError("That's already in KanKan.", 409);
    const tags = readTags(b, {});
    if (!tags.ages.length) throw new UserError("Pick at least one age group.");
    const item = {
      ...found, ...tags,
      title: cleanName(b.title) || found.title,
      banner: found.kind === "show" && found.episodes.some((e) => e.id === b.cover) ? b.cover : "",
    };
    await insertItem(db, item);
    return json({ ok: true, item: summary(item) }, 201);
  }

  if (p === "/api/progress" && m === "POST") {
    const b = await body(request);
    const list = (Array.isArray(b.items) ? b.items : [b]).slice(0, 200);
    const now = Date.now();
    const stmts = [];
    for (const x of list) {
      if (!/^[\w-]{11}$/.test(x?.v || "")) continue;
      const t = clampInt(x.t, 0, 86400), d = clampInt(x.d, 0, 86400);
      const show = /^[\w-]{10,64}$/.test(x.show || "") ? x.show : null;
      stmts.push(db.prepare(
        `INSERT INTO progress (video_id, show_id, t, d, done, updated_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(video_id) DO UPDATE SET show_id = excluded.show_id, t = excluded.t, d = excluded.d,
           done = excluded.done, updated_at = excluded.updated_at`
      ).bind(x.v, show, t, d, x.done ? 1 : 0, now));
    }
    if (stmts.length) await db.batch(stmts);
    return json({ ok: true, saved: stmts.length, at: now });
  }

  const item = p.match(/^\/api\/items\/([\w-]{11,64})(\/refresh)?$/);
  if (!item) throw new UserError("Not found.", 404);
  const id = item[1];

  if (m === "DELETE" && !item[2]) {
    await db.batch([
      db.prepare("DELETE FROM progress WHERE show_id = ? OR video_id = ?").bind(id, id),
      db.prepare("DELETE FROM episodes WHERE show_id = ?").bind(id),
      db.prepare("DELETE FROM items WHERE id = ?").bind(id),
    ]);
    return json({ ok: true });
  }

  const row = await db.prepare("SELECT * FROM items WHERE id = ?").bind(id).first();
  if (!row) throw new UserError("That isn't in KanKan any more.", 404);

  if (m === "PATCH" && !item[2]) {
    const b = await body(request);
    const tags = readTags(b, row);
    let banner = row.banner;
    if (b.cover !== undefined) {
      const ok = row.kind === "video" ? b.cover === row.id
        : await db.prepare("SELECT 1 FROM episodes WHERE show_id = ? AND video_id = ?").bind(id, b.cover || "").first();
      if (!ok) throw new UserError("That cover picture isn't one of this show's episodes.");
      banner = b.cover;
    }
    const title = b.title !== undefined ? cleanName(b.title) : row.title;
    if (!title) throw new UserError("Give it a name.");
    await db.prepare(
      `UPDATE items SET title = ?, ages = ?, categories = ?, languages = ?, episode_order = ?, banner = ? WHERE id = ?`
    ).bind(title, JSON.stringify(tags.ages), JSON.stringify(tags.categories), JSON.stringify(tags.languages), tags.order, banner, id).run();
    return json({ ok: true });
  }

  if (m === "POST" && item[2]) {
    if (row.kind !== "show") throw new UserError("Only shows can be refreshed.", 400);
    const found = await lookupPlaylist(env, row.id);
    // Keep the family's name, tags and cover; only the episodes change.
    const coverStillThere = found.episodes.some((e) => e.id === row.banner);
    await db.batch([
      db.prepare("UPDATE items SET channel = ?, banner = ?, refreshed_at = ? WHERE id = ?")
        .bind(found.channel, coverStillThere ? row.banner : "", Date.now(), id),
      ...episodeStatements(db, id, found.episodes),
    ]);
    return json({ ok: true, episodes: found.episodes.length });
  }

  throw new UserError("Not found.", 404);
}

// ---------- Tags ----------
function pick(list, allowed) {
  return Array.isArray(list) ? [...new Set(list.filter((x) => allowed.includes(x)))] : [];
}
// Read tags from a request, falling back to what's already saved (for edits).
function readTags(b, row) {
  const saved = (k) => { try { return JSON.parse(row[k] || "[]"); } catch { return []; } };
  return {
    ages: b.ages !== undefined ? pick(b.ages, AGES) : saved("ages"),
    categories: b.categories !== undefined ? pick(b.categories, CATEGORIES) : saved("categories"),
    languages: b.languages !== undefined ? pick(b.languages, LANGUAGES) : saved("languages"),
    order: ORDERS.includes(b.order) ? b.order : row.episode_order || "playlist",
  };
}

// ---------- Database ----------
let schemaReady = false;
async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,                -- 'show' (playlist) or 'video'
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      channel TEXT NOT NULL DEFAULT '',
      banner TEXT NOT NULL DEFAULT '',   -- cover: video id whose thumbnail is used as the picture ('' = first episode)
      seconds INTEGER NOT NULL DEFAULT 0,
      embeddable INTEGER NOT NULL DEFAULT 1,
      added_at INTEGER NOT NULL,
      refreshed_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS episodes (
      show_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      video_id TEXT NOT NULL,
      title TEXT NOT NULL,
      seconds INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (show_id, position)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS progress (
      video_id TEXT PRIMARY KEY,         -- where the family stopped in each video / episode
      show_id TEXT,
      t INTEGER NOT NULL DEFAULT 0,      -- seconds watched
      d INTEGER NOT NULL DEFAULT 0,      -- video length in seconds
      done INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    )`),
  ]);
  // Columns added after the first version. Adding one that already exists just fails quietly.
  for (const col of [
    "ages TEXT NOT NULL DEFAULT '[]'",
    "categories TEXT NOT NULL DEFAULT '[]'",
    "languages TEXT NOT NULL DEFAULT '[]'",
    "episode_order TEXT NOT NULL DEFAULT 'playlist'",
  ]) {
    try { await db.prepare(`ALTER TABLE items ADD COLUMN ${col}`).run(); }
    catch (e) { if (!/duplicate column/i.test(String(e?.message || e))) throw e; }
  }
  schemaReady = true;
}

async function library(db) {
  const [items, eps, prog] = await db.batch([
    db.prepare("SELECT * FROM items ORDER BY added_at ASC"),
    db.prepare("SELECT show_id, video_id, title, seconds FROM episodes ORDER BY show_id, position"),
    db.prepare("SELECT * FROM progress"),
  ]);
  const progress = {};
  for (const r of prog.results) progress[r.video_id] = { t: r.t, d: r.d, show: r.show_id, done: !!r.done, at: r.updated_at };
  const byShow = {};
  for (const e of eps.results) (byShow[e.show_id] ||= []).push({ id: e.video_id, title: e.title, seconds: e.seconds });
  const list = (s) => { try { return JSON.parse(s || "[]"); } catch { return []; } };
  const shows = [], videos = [];
  for (const it of items.results) {
    const tags = { ages: list(it.ages), categories: list(it.categories), languages: list(it.languages) };
    if (it.kind === "show") {
      const order = it.episode_order === "reverse" ? "reverse" : "playlist";
      const episodes = byShow[it.id] || [];
      if (order === "reverse") episodes.reverse();
      const banner = episodes.some((e) => e.id === it.banner) ? it.banner : episodes[0]?.id || "";
      shows.push({ id: it.id, title: it.title, description: it.description, channel: it.channel, banner, order, ...tags, episodes });
    } else {
      videos.unshift({ id: it.id, title: it.title, channel: it.channel, seconds: it.seconds, ...tags }); // newest first
    }
  }
  return { shows, videos, progress };
}

async function insertItem(db, it) {
  const now = Date.now();
  await db.batch([
    db.prepare(`INSERT INTO items (id, kind, title, description, channel, banner, seconds, embeddable, added_at, refreshed_at,
                                   ages, categories, languages, episode_order)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(it.id, it.kind, it.title, it.description || "", it.channel || "", it.banner || "", it.seconds || 0,
            it.embeddable === false ? 0 : 1, now, now,
            JSON.stringify(it.ages), JSON.stringify(it.categories), JSON.stringify(it.languages), it.order),
    ...(it.kind === "show" ? episodeStatements(db, it.id, it.episodes) : []),
  ]);
}

// Replace a show's episodes (always stored in YouTube's playlist order).
function episodeStatements(db, showId, episodes) {
  const stmts = [db.prepare("DELETE FROM episodes WHERE show_id = ?").bind(showId)];
  // D1 allows up to 100 values per statement: 5 per episode -> 20 episodes per insert.
  for (let i = 0; i < episodes.length; i += 20) {
    const chunk = episodes.slice(i, i + 20);
    const sql = "INSERT INTO episodes (show_id, position, video_id, title, seconds) VALUES " + chunk.map(() => "(?, ?, ?, ?, ?)").join(", ");
    stmts.push(db.prepare(sql).bind(...chunk.flatMap((e, k) => [showId, i + k, e.id, e.title, e.seconds || 0])));
  }
  return stmts;
}

// ---------- Understanding pasted links ----------
// Returns { kind: 'video' | 'show', id } or throws a friendly error.
function parseLink(raw) {
  let s = String(raw || "").trim();
  if (!s) throw new UserError("Paste a YouTube link first.");
  if (/^[\w-]{11}$/.test(s)) return { kind: "video", id: s };
  if (/^(PL|UU|OL|FL)[\w-]{10,}$/.test(s)) return { kind: "show", id: s };
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;

  let u;
  try { u = new URL(s); } catch { throw new UserError("That doesn't look like a YouTube link."); }
  const host = u.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
  const parts = u.pathname.split("/").filter(Boolean);
  const list = u.searchParams.get("list");
  const isPlaylist = (id) => id && /^[\w-]{10,}$/.test(id) && !/^(RD|LL|WL)/.test(id); // skip mixes, liked, watch later

  if (host === "youtu.be") {
    if (isPlaylist(list)) return { kind: "show", id: list };
    if (/^[\w-]{11}$/.test(parts[0] || "")) return { kind: "video", id: parts[0] };
    throw new UserError("That doesn't look like a YouTube link.");
  }
  if (!["youtube.com", "youtube-nocookie.com"].includes(host)) throw new UserError("That doesn't look like a YouTube link.");

  if (parts[0] === "playlist" && isPlaylist(list)) return { kind: "show", id: list };
  if (parts[0] === "show" && parts[1]) {
    const id = parts[1].replace(/^VL/, "");
    if (isPlaylist(id)) return { kind: "show", id };
  }
  if (isPlaylist(list)) return { kind: "show", id: list }; // a video opened from inside a playlist
  if (parts[0] === "watch" && /^[\w-]{11}$/.test(u.searchParams.get("v") || "")) return { kind: "video", id: u.searchParams.get("v") };
  if (["shorts", "live", "embed", "v"].includes(parts[0]) && /^[\w-]{11}$/.test(parts[1] || "")) return { kind: "video", id: parts[1] };
  if (parts[0] && (parts[0].startsWith("@") || ["channel", "c", "user"].includes(parts[0]))) {
    throw new UserError("That's a YouTube channel. KanKan can add videos and playlists, but not whole channels yet.");
  }
  throw new UserError("We couldn't find a video or playlist in that link.");
}

// ---------- YouTube lookups ----------
async function yt(env, path, params) {
  if (!env.YOUTUBE_API_KEY) throw new UserError("The YouTube key isn't set up in Cloudflare yet.", 500);
  const u = new URL(`${env.YT_API_BASE || YT}/${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set("key", env.YOUTUBE_API_KEY);
  const r = await fetch(u);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const reason = data?.error?.errors?.[0]?.reason || "";
    console.error("YouTube API error", r.status, reason);
    if (reason === "quotaExceeded") throw new UserError("YouTube's daily lookup limit has been reached. Please try again tomorrow.", 503);
    if (r.status === 404 || reason === "playlistNotFound") throw new UserError("We couldn't find that on YouTube. It may be private or removed.", 404);
    throw new UserError("YouTube didn't answer properly. Please try again in a moment.", 502);
  }
  return data;
}

function lookup(env, link) {
  return link.kind === "show" ? lookupPlaylist(env, link.id) : lookupVideo(env, link.id);
}

async function lookupVideo(env, id) {
  const data = await yt(env, "videos", { part: "snippet,contentDetails,status", id });
  const v = data.items?.[0];
  if (!v) throw new UserError("We couldn't find that video. It may be private or removed.", 404);
  const channel = v.snippet.channelTitle || "";
  return {
    kind: "video", id,
    title: cleanTitle(v.snippet.title, [channel]),
    description: shortDescription(v.snippet.description),
    channel,
    banner: id,
    seconds: isoSeconds(v.contentDetails?.duration),
    embeddable: v.status?.embeddable !== false,
  };
}

async function lookupPlaylist(env, id) {
  const pl = (await yt(env, "playlists", { part: "snippet,contentDetails", id })).items?.[0];
  if (!pl) throw new UserError("We couldn't find that playlist. It may be private or removed.", 404);
  const channel = pl.snippet.channelTitle || "";
  const title = cleanShowTitle(pl.snippet.title, channel);

  // Episodes, in playlist order (50 per page)
  const raw = [];
  let pageToken = "";
  do {
    const page = await yt(env, "playlistItems", { part: "snippet,status", playlistId: id, maxResults: "50", ...(pageToken && { pageToken }) });
    for (const it of page.items || []) {
      const vid = it.snippet?.resourceId?.videoId;
      const t = it.snippet?.title || "";
      if (!vid || t === "Private video" || t === "Deleted video" || it.status?.privacyStatus === "private") continue;
      raw.push({ id: vid, rawTitle: t });
    }
    pageToken = page.nextPageToken || "";
  } while (pageToken && raw.length < MAX_EPISODES);
  if (!raw.length) throw new UserError("That playlist has no videos we can show.", 404);
  const eps = raw.slice(0, MAX_EPISODES);

  // Lengths (50 videos per request)
  const secs = {};
  for (let i = 0; i < eps.length; i += 50) {
    const ids = eps.slice(i, i + 50).map((e) => e.id).join(",");
    const data = await yt(env, "videos", { part: "contentDetails", id: ids });
    for (const v of data.items || []) secs[v.id] = isoSeconds(v.contentDetails?.duration);
  }

  const names = [title, channel, pl.snippet.title];
  return {
    kind: "show", id, title, channel,
    description: shortDescription(pl.snippet.description),
    banner: eps[0].id,
    episodes: eps.map((e) => ({ id: e.id, title: cleanTitle(e.rawTitle, names), seconds: secs[e.id] || 0 })),
  };
}

// What the Parents page shows before adding
function summary(it) {
  return {
    kind: it.kind, id: it.id, title: it.title, description: it.description, channel: it.channel,
    banner: it.banner, seconds: it.seconds || 0, embeddable: it.embeddable !== false,
    episodes: it.kind === "show" ? it.episodes.length : undefined,
    // Episode ids and titles, so the Parents page can offer a cover picture and show the order
    episodeList: it.kind === "show" ? it.episodes.map((e) => ({ id: e.id, title: e.title })) : undefined,
  };
}

// ---------- Tidying YouTube text ----------
// Pieces of a title are split on "|", " - " and emoji.
const SPLIT = /\s+\|\s*|\s*\|\s+|\||\s+[-–—]\s+|[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B50}]+/u;
// Filler that means "the rest is just labels": stop reading the title here.
const FILLER = /^(full episodes?!?|kids?['’]?s? cartoons?( show)?|cartoons? for (kids|children)|kids movies|videos? for kids|kids videos?)$/i;
// Pieces that are never the episode name.
const JUNK = /^(episodes?|new episodes?|hd|4k|compilation|official|season \d+.*|seasons? \d+.*|episode \d+.*)$/i;
// "S01 E02" / "Season 1 Episode 2" / "EP6" codes, kept as a last resort ("Season 1, Episode 2")
const CODE = /^(?:s(\d+)\s*e(\d+)|season\s*(\d+)\s*,?\s*episode\s*(\d+)|ep\.?\s*(\d+))$/i;
const codeText = (c) => (c[5] ? `Episode ${+c[5]}` : `Season ${+(c[1] || c[3])}, Episode ${+(c[2] || c[4])}`);

// Remove a long show name from the start of an episode name:
// "Molly of Denali Trouble at Tooey's house" -> "Trouble at Tooey's house".
// Only for names of 3+ words, so "Kipper and the Umbrella" stays whole.
function stripNamePrefix(piece, names) {
  for (const n of names) {
    const w = words(n);
    if (w.length < 3) continue;
    const re = new RegExp("^" + w.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[^\\p{L}\\p{N}]+") + "[^\\p{L}\\p{N}]+", "iu");
    const rest = piece.replace(re, "");
    if (rest !== piece && words(rest).length >= 2) return rest;
  }
  return piece;
}

const words = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").filter(Boolean);
// Is this piece basically the show's (or channel's) name?
function nameLike(piece, names) {
  const w = words(piece);
  if (!w.length) return true;
  return names.some((n) => {
    const nw = new Set(words(n));
    if (!nw.size) return false;
    return w.filter((x) => nw.has(x)).length / w.length >= 0.7;
  });
}

function cleanTitle(t, names = []) {
  const parts = String(t || "")
    .split(SPLIT)
    .map((p) => p
      .replace(/[([〚【「]\s*[^)\]〛】」]*\b(?:hd|full episode|official|4k)\b[^)\]〛】」]*[)\]〛】」]/gi, "") // "(HD Full Episode)", "〚Full Episode〛"
      .replace(/^ep\.?\s*\d+\s*[:.-]?\s+(?=\S)/i, "")                                               // "EP 1 Kalos…" -> "Kalos…"
      .replace(/\s+/g, " ").trim()
      .replace(/^[-–—:,\s]+|[-–—:,\s]+$/g, ""))
    .filter((p) => /[\p{L}\p{N}]/u.test(p));
  for (const p of parts) {
    const stripped = stripNamePrefix(p.replace(/\bfull episodes?!?\b/gi, "").trim(), names);
    if (FILLER.test(p) || (!stripped && /full episode/i.test(p))) break;
    const c = CODE.exec(stripped);
    if (c) return codeText(c); // after a code like "S01 E02" come only labels
    if (!stripped || JUNK.test(stripped) || nameLike(stripped, names)) continue;
    return stripped.slice(0, 120);
  }
  return (parts[0] || String(t || "").trim() || "Untitled").slice(0, 120);
}

// Playlist names: drop "Full Episodes", "The Complete Series", "S1 to S4" and similar.
function cleanShowTitle(t, channel) {
  const tidy = String(t || "")
    .replace(/\b(the )?complete series\b|\ball episodes\b|\bseries all\b|\bfull episodes?\b|\bs\d+\s*(to|-|–)\s*s\d+\b/gi, "")
    .replace(/\s+/g, " ").replace(/[\s:.,\-–—|]+$/g, "").trim();
  return cleanTitle(tidy, [channel]) || tidy || "Untitled";
}

function shortDescription(d) {
  const text = String(d || "")
    .replace(/https?:\/\/\S+|www\.\S+/gi, " ")      // links
    .replace(/(^|\s)[#@][\w.-]+/g, " ")              // hashtags and @handles
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => /[\p{L}]{2}/u.test(l))
    .map((l) => (/[.!?…]$/.test(l) ? l : l + "."))   // a line without a full stop still ends a sentence
    .join(" ");
  if (!text) return "";
  const sentences = (text.match(/[^.!?]+[.!?]+(?=\s|$)/g) || [text])
    .map((s) => s.trim())
    .filter((s) => !/subscribe|copyright|©|all rights reserved|follow us|click here|watch more|check out/i.test(s));
  let out = "";
  for (const s of sentences) {
    if (out && (out + " " + s).length > 200) break;
    out += (out ? " " : "") + s;
    if (out.length > 90) break;
  }
  out = out.trim();
  if (out.length > 220) out = out.slice(0, 217).replace(/\s+\S*$/, "") + "…";
  return out;
}

function clampInt(n, lo, hi) {
  n = Math.floor(Number(n) || 0);
  return Math.min(hi, Math.max(lo, n));
}

function cleanName(t) {
  return String(t || "").replace(/\s+/g, " ").trim().slice(0, 80);
}

function isoSeconds(iso) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || "");
  if (!m) return 0;
  return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
}

// ---------- Helpers ----------
class UserError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

async function body(request) {
  const text = await request.text();
  if (text.length > 10_000) throw new UserError("That's too long.");
  try { return JSON.parse(text || "{}"); } catch { throw new UserError("Bad request."); }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
