// KanKan — Watch screen (YouTube's official embedded player)
(function () {
  const { esc, thumbImg, minutes, watchUrl, showUrl, ICON } = KK;
  KK.renderHeader(KK.param("show") ? "shows" : "videos");

  const $ = (id) => document.getElementById(id);
  let show = null; // filled in once the library has loaded
  let videoId = KK.param("v");
  let player = null;
  let ended = false;

  // What we know about the current video
  function current() {
    if (show) {
      const i = show.episodes.findIndex((e) => e.id === videoId);
      if (i >= 0) return { ep: show.episodes[i], index: i, next: show.episodes[i + 1] || null };
    }
    const v = KK.findVideo(videoId);
    return { ep: v || { id: videoId, title: "", seconds: 0 }, index: -1, next: null };
  }

  const youtubeUrl = (id) => `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;

  // ---------- Page text: back link, title, side column ----------
  function render() {
    const { ep, index, next } = current();
    $("back").innerHTML = show ? `${ICON.back}${esc(show.title)}` : `${ICON.back}Home`;
    $("back").href = show ? showUrl(show.id) : "index.html";
    document.title = `${ep.title || "Watch"} · KanKan 看看`;

    const kicker = show && index >= 0 ? `${esc(show.title)} · Episode ${index + 1}` : esc(ep.channel || "Video");
    $("info").innerHTML = `
      <div class="label">${kicker}</div>
      <h1>${esc(ep.title)}</h1>
      <div class="meta">Can't play here? <a href="${youtubeUrl(ep.id)}" target="_blank" rel="noopener">Watch on YouTube</a></div>`;

    let side = "";
    if (next) {
      side += `
        <a class="next-card${ended ? " ended" : ""}" href="${watchUrl(next.id, show.id)}" data-v="${esc(next.id)}">
          <div class="label">${ended ? "Up next" : "Next episode"}</div>
          <div class="thumb">${thumbImg(next.id, { alt: next.title })}</div>
          <div class="title">${esc(next.title)}</div>
          <div class="meta">Episode ${index + 2}${next.seconds ? ` · ${minutes(next.seconds)} min` : ""}</div>
          <span class="btn btn-dark">${ICON.play}Play next</span>
        </a>`;
    }
    let list = [];
    let heading = "";
    if (show && index >= 0) {
      heading = "Coming up";
      list = show.episodes.slice(index + 2, index + 5).map((e, k) => ({ e, sub: `Episode ${index + 3 + k}` }));
    } else if (!show) {
      heading = "More videos";
      list = KK.VIDEOS.filter((v) => v.id !== videoId).slice(0, 4).map((e) => ({ e, sub: e.channel }));
    }
    if (list.length) {
      side += `<div class="side-list"><h3>${heading}</h3>${list.map(({ e, sub }) => `
        <a class="up" href="${watchUrl(e.id, show && show.id)}" data-v="${esc(e.id)}">
          <div class="thumb">${thumbImg(e.id, { alt: e.title })}</div>
          <div><div class="title">${esc(e.title)}</div><div class="meta">${esc(sub)}</div></div>
        </a>`).join("")}</div>`;
    }
    $("side").innerHTML = side;
  }

  // ---------- Saving progress ----------
  function save(extra) {
    if (!player || typeof player.getCurrentTime !== "function") return;
    const t = player.getCurrentTime() || 0;
    const d = player.getDuration() || 0;
    if (!d) return;
    const done = d - t < 20; // within 20 seconds of the end counts as watched
    KK.saveProgress(videoId, { t: Math.floor(t), d: Math.floor(d), show: show ? show.id : null, done, ...extra });
  }
  setInterval(() => {
    if (player && player.getPlayerState && player.getPlayerState() === YT.PlayerState.PLAYING) save();
  }, 5000);
  document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });
  window.addEventListener("pagehide", () => save());

  // Where to start: pick up where the family stopped, unless it was finished.
  function startAt(id) {
    const p = KK.getProgress(id);
    return KK.inProgress(p) ? Math.max(0, Math.floor(p.t) - 3) : 0;
  }

  // ---------- Friendly message when a video can't be embedded ----------
  function showBlocked(code) {
    const { ep } = current();
    const box = $("blocked");
    const embedOff = [101, 150, 153].includes(code);
    box.innerHTML = `
      <h2>${embedOff ? "This one can't play in KanKan" : "This video isn't available"}</h2>
      <p>${embedOff ? "The creator only allows it to be watched on YouTube itself."
                    : "It may have been removed or made private. You can try opening it on YouTube."}</p>
      <a class="btn btn-dark" href="${youtubeUrl(ep.id)}" target="_blank" rel="noopener">${ICON.play}Watch on YouTube</a>`;
    box.hidden = false;
  }

  // ---------- Switch video without leaving the page ----------
  function play(id) {
    save();
    videoId = id;
    ended = false;
    $("blocked").hidden = true;
    history.replaceState(null, "", watchUrl(id, show && show.id));
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (player && player.loadVideoById) player.loadVideoById({ videoId: id, startSeconds: startAt(id) });
  }
  $("side").addEventListener("click", (e) => {
    const a = e.target.closest("[data-v]");
    if (!a || !player) return; // no player yet: let the link load the page normally
    e.preventDefault();
    play(a.dataset.v);
  });

  // ---------- No video given ----------
  if (!videoId) {
    document.getElementById("watch").innerHTML = `<div class="empty"><p>No video picked.</p><a class="btn btn-dark" href="index.html">Back to Home</a></div>`;
    return;
  }
  // Show the page text once the library is here. The player doesn't need to wait for it.
  KK.load().then(
    () => { show = KK.findShow(KK.param("show")); render(); },
    () => render()
  );

  // ---------- YouTube player ----------
  window.onYouTubeIframeAPIReady = function () {
    player = new YT.Player("player", {
      videoId,
      playerVars: { playsinline: 1, rel: 0, start: startAt(videoId), origin: location.origin },
      events: {
        onStateChange(e) {
          if (e.data === YT.PlayerState.PAUSED) save();
          if (e.data === YT.PlayerState.ENDED) {
            save({ done: true });
            ended = true;
            render();
          }
        },
        // 2 = bad link, 100 = removed/private, 101/150/153 = creator turned off embedding
        onError(e) { showBlocked(e.data); },
      },
    });
  };
})();
