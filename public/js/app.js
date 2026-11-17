// KanKan — shared helpers used by every page.
(function () {
  // The library comes from the server (/api/library). Call KK.load() before using it.
  let SHOWS = [];
  let VIDEOS = [];
  async function load() {
    const r = await fetch("/api/library", { cache: "no-store" });
    if (!r.ok) throw new Error("library " + r.status);
    const data = await r.json();
    SHOWS = data.shows || [];
    VIDEOS = data.videos || [];
    PROGRESS = data.progress || {};
    await migrateLocalProgress();
  }

  // Calls the server and turns its { error } replies into readable messages.
  async function api(path, { method = "GET", body } = {}) {
    let r;
    try {
      r = await fetch(path, { method, headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
    } catch {
      throw new Error("Can't reach KanKan. Check the internet connection and try again.");
    }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "Something went wrong. Please try again.");
    return data;
  }

  // Shown when the library can't be loaded
  function loadError(main) {
    main.innerHTML = `<div class="empty"><p>KanKan couldn't load the library just now.</p><button class="btn btn-dark" type="button" onclick="location.reload()">Try again</button></div>`;
  }

  // ---------- Small helpers ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const param = (name) => new URLSearchParams(location.search).get(name);

  // hqdefault always exists; maxresdefault is sharper but missing on some videos.
  const thumbUrl = (id, big) => `https://i.ytimg.com/vi/${id}/${big ? "maxresdefault" : "hqdefault"}.jpg`;
  function thumbImg(id, { big = false, lazy = true, alt = "" } = {}) {
    const fallback = big ? ` onerror="this.onerror=null;this.src='${thumbUrl(id, false)}'"` : "";
    return `<img src="${thumbUrl(id, big)}" alt="${esc(alt)}"${lazy ? ' loading="lazy"' : ""}${fallback}>`;
  }

  const minutes = (sec) => Math.max(1, Math.round(sec / 60));
  const watchUrl = (videoId, showId) => `watch.html?v=${encodeURIComponent(videoId)}${showId ? `&show=${encodeURIComponent(showId)}` : ""}`;
  const showUrl = (showId) => `show.html?id=${encodeURIComponent(showId)}`;

  const ICON = {
    play: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4l15 8-15 8z"/></svg>',
    back: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
    next: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>',
    lock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  };

  // ---------- Tags ----------
  // The ids must match the lists in src/index.js.
  const TAGS = {
    ages: [
      { id: "baby", label: "Baby", range: "0–2" },
      { id: "preschool", label: "Preschool", range: "3–5" },
      { id: "early-primary", label: "Early Primary", range: "6–8" },
      { id: "upper-primary", label: "Upper Primary", range: "9–12" },
    ],
    categories: [
      { id: "cartoons", label: "Cartoons" },
      { id: "learning", label: "Learning" },
      { id: "songs-music", label: "Songs & Music" },
      { id: "stories", label: "Stories" },
      { id: "nature-science", label: "Nature & Science" },
      { id: "arts-crafts", label: "Arts & Crafts" },
    ],
    languages: [
      { id: "en", label: "English" },
      { id: "ms", label: "Malay" },
      { id: "zh", label: "Chinese" },
    ],
  };
  const tagLabel = (group, id) => (TAGS[group].find((t) => t.id === id) || {}).label || id;
  // "Preschool, Early Primary"
  const tagLabels = (group, ids) => TAGS[group].filter((t) => (ids || []).includes(t.id)).map((t) => t.label).join(", ");
  // Language worth mentioning on a card (English is the default, so it isn't shown)
  const languageNote = (it) => (it.languages || []).filter((l) => l !== "en").map((l) => tagLabel("languages", l)).join(", ");

  // ---------- Library lookups ----------
  const findShow = (id) => SHOWS.find((s) => s.id === id) || null;
  const findVideo = (id) => VIDEOS.find((v) => v.id === id) || null;

  // ---------- Watch progress ----------
  // Saved in the database, so every device shares one Continue Watching.
  // PROGRESS is filled by load(); saveProgress() updates it and tells the server.
  let PROGRESS = {};
  function loadAll() { return PROGRESS; }
  function getProgress(videoId) { return PROGRESS[videoId] || null; }
  function saveProgress(videoId, data) {
    const p = { ...(PROGRESS[videoId] || {}), ...data, at: Date.now() };
    PROGRESS[videoId] = p;
    sendProgress([{ v: videoId, show: p.show || null, t: p.t || 0, d: p.d || 0, done: !!p.done }]);
  }
  function sendProgress(items) {
    // keepalive lets the save finish even when the page is closing
    return fetch("/api/progress", {
      method: "POST", keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items }),
    }).catch(() => { /* offline: the next save will catch up */ });
  }

  // Before Phase 3, progress lived in each browser. Hand it over to the server once, then forget it.
  const OLD_KEY = "kankan.progress.v1";
  async function migrateLocalProgress() {
    let local;
    try { local = JSON.parse(localStorage.getItem(OLD_KEY)); } catch { return; }
    if (!local || typeof local !== "object") return;
    const items = [];
    for (const [v, p] of Object.entries(local)) {
      if (!p || (PROGRESS[v] && PROGRESS[v].at >= (p.at || 0))) continue;
      // Phase 1 used made-up show names ("kipper"); look up the real show instead.
      const show = SHOWS.find((s) => s.episodes.some((e) => e.id === v));
      PROGRESS[v] = { ...p, show: show ? show.id : null };
      items.push({ v, show: show ? show.id : null, t: p.t || 0, d: p.d || 0, done: !!p.done });
    }
    try {
      if (items.length) {
        const r = await sendProgress(items);
        if (!r || !r.ok) return; // keep the old copy and try again next time
      }
      localStorage.removeItem(OLD_KEY);
    } catch { /* storage blocked: nothing to hand over */ }
  }
  // 0..1 watched, or 1 if finished
  function fraction(p) {
    if (!p) return 0;
    if (p.done) return 1;
    return p.d ? Math.min(1, p.t / p.d) : 0;
  }
  const inProgress = (p) => !!p && !p.done && p.t > 10;

  // Which episode should "Continue" open for a show?
  // Returns { index, mode: "continue" | "next" | "start" }
  function resumePoint(show) {
    const all = loadAll();
    let best = null;
    show.episodes.forEach((ep, i) => {
      const p = all[ep.id];
      if (p && (inProgress(p) || p.done) && (!best || p.at > best.p.at)) best = { i, p };
    });
    if (!best) return { index: 0, mode: "start" };
    if (!best.p.done) return { index: best.i, mode: "continue" };
    if (best.i + 1 < show.episodes.length) return { index: best.i + 1, mode: "next" };
    return { index: 0, mode: "start" };
  }

  // Continue Watching: one entry per show (its latest unfinished episode) plus unfinished single videos.
  function continueWatching() {
    const all = loadAll();
    const items = [];
    SHOWS.forEach((show) => {
      let best = null;
      show.episodes.forEach((ep, i) => {
        const p = all[ep.id];
        if (inProgress(p) && (!best || p.at > best.p.at)) best = { ep, i, p };
      });
      if (best) items.push({ id: best.ep.id, title: best.ep.title, sub: `${show.title} · Episode ${best.i + 1}`, show, p: best.p });
    });
    VIDEOS.forEach((v) => {
      const p = all[v.id];
      if (inProgress(p)) items.push({ id: v.id, title: v.title, sub: v.channel, show: null, p });
    });
    return items.sort((a, b) => b.p.at - a.p.at);
  }

  // The show the family watched most recently (for the Home banner).
  function lastWatchedShow() {
    const all = loadAll();
    let best = null;
    SHOWS.forEach((show) => show.episodes.forEach((ep) => {
      const p = all[ep.id];
      if (p && (!best || p.at > best.at)) best = { show, at: p.at };
    }));
    return best ? best.show : SHOWS[0] || null;
  }

  // ---------- Header ----------
  function renderHeader(active) {
    const el = document.querySelector(".site-header");
    if (!el) return;
    el.innerHTML = `
      <a class="logo" href="index.html" aria-label="KanKan home"><b>KanKan</b><span lang="zh">看看</span></a>
      <a class="parents" href="parents.html" aria-label="Parents">${ICON.lock}<span class="word">Parents</span></a>`;
  }

  // ---------- Sideways rows: arrow buttons for mouse users ----------
  function enableRowArrows(section) {
    const row = section.querySelector(".row");
    const left = section.querySelector(".arrow.left");
    const right = section.querySelector(".arrow.right");
    if (!row || !left || !right) return;
    const update = () => {
      left.classList.toggle("can", row.scrollLeft > 4);
      right.classList.toggle("can", row.scrollLeft + row.clientWidth < row.scrollWidth - 4);
    };
    const step = () => row.clientWidth * 0.85;
    left.onclick = () => row.scrollBy({ left: -step(), behavior: "smooth" });
    right.onclick = () => row.scrollBy({ left: step(), behavior: "smooth" });
    row.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  window.KK = {
    get SHOWS() { return SHOWS; },
    get VIDEOS() { return VIDEOS; },
    load, api, loadError, esc, TAGS, tagLabel, tagLabels, languageNote, param, thumbImg, minutes, watchUrl, showUrl, ICON,
    findShow, findVideo, getProgress, saveProgress, fraction, inProgress,
    resumePoint, continueWatching, lastWatchedShow, renderHeader, enableRowArrows,
  };
})();
