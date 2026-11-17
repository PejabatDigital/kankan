// KanKan — shared helpers used by every page.
(function () {
  const SHOWS = window.KANKAN_SHOWS || [];
  const VIDEOS = window.KANKAN_VIDEOS || [];

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

  // ---------- Library lookups ----------
  const findShow = (id) => SHOWS.find((s) => s.id === id) || null;
  const findVideo = (id) => VIDEOS.find((v) => v.id === id) || null;

  // ---------- Watch progress ----------
  // Phase 1: kept in this browser only (localStorage).
  // Phase 3 moves this into the database so every device shares it.
  const KEY = "kankan.progress.v1";
  function loadAll() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
  }
  function getProgress(videoId) { return loadAll()[videoId] || null; }
  function saveProgress(videoId, data) {
    try {
      const all = loadAll();
      all[videoId] = { ...(all[videoId] || {}), ...data, at: Date.now() };
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch { /* storage blocked (e.g. private mode): carry on without saving */ }
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
    return best ? best.show : SHOWS[0];
  }

  // ---------- Header ----------
  function renderHeader(active) {
    const el = document.querySelector(".site-header");
    if (!el) return;
    const link = (href, label, key) => `<a href="${href}"${active === key ? ' class="on" aria-current="page"' : ""}>${label}</a>`;
    el.innerHTML = `
      <a class="logo" href="index.html" aria-label="KanKan home"><b>KanKan</b><span lang="zh">看看</span></a>
      <nav class="nav" aria-label="Main">
        ${link("index.html", "Home", "home")}
        ${link("index.html#shows", "Shows", "shows")}
        ${link("index.html#videos", "Videos", "videos")}
      </nav>
      <button class="parents" type="button" title="Parent area — coming in Phase 2" aria-label="Parents">${ICON.lock}<span class="word">Parents</span></button>`;
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
    SHOWS, VIDEOS, esc, param, thumbImg, minutes, watchUrl, showUrl, ICON,
    findShow, findVideo, getProgress, saveProgress, fraction, inProgress,
    resumePoint, continueWatching, lastWatchedShow, renderHeader, enableRowArrows,
  };
})();
