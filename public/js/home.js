// KanKan — Home screen
(function () {
  const { esc, thumbImg, minutes, watchUrl, showUrl, ICON } = KK;
  KK.renderHeader("home");
  const main = document.getElementById("home");

  // ---------- Banner: the show watched most recently (or the first show) ----------
  function banner() {
    const show = KK.lastWatchedShow();
    if (!show) return "";
    const r = KK.resumePoint(show);
    const ep = show.episodes[r.index];
    const playLabel = r.mode === "continue" ? `Continue Episode ${r.index + 1}`
                    : r.mode === "next" ? `Play Episode ${r.index + 1}` : "Play Episode 1";
    return `
      <section class="hero">
        ${thumbImg(show.banner || show.episodes[0].id, { big: true, lazy: false })}
        <div class="shade"></div>
        <div class="text">
          <div class="label">Show · ${show.episodes.length} episodes</div>
          <h1>${esc(show.title)}</h1>
          <p>${esc(show.description)}</p>
          <div class="btns">
            <a class="btn btn-light" href="${watchUrl(ep.id, show.id)}">${ICON.play}${playLabel}</a>
            <a class="btn btn-glass" href="${showUrl(show.id)}">All episodes</a>
          </div>
        </div>
      </section>`;
  }

  // ---------- Rows ----------
  function row(id, title, cards) {
    if (!cards.length) return "";
    return `
      <section class="row-section" aria-labelledby="${id}">
        <h2 id="${id}">${title}</h2>
        <button class="arrow left" type="button" aria-label="Scroll left">${ICON.back}</button>
        <div class="row">${cards.join("")}</div>
        <button class="arrow right" type="button" aria-label="Scroll right">${ICON.next}</button>
      </section>`;
  }

  const continueCard = (it) => {
    const left = it.p.d ? `${minutes(it.p.d - it.p.t)} min left` : "";
    return `
      <a class="card" href="${watchUrl(it.id, it.show && it.show.id)}">
        <div class="thumb">${thumbImg(it.id)}</div>
        <div class="track"><div style="width:${Math.round(KK.fraction(it.p) * 100)}%"></div></div>
        <div class="title">${esc(it.title)}</div>
        <div class="meta">${esc(it.sub)}${left ? ` · ${left}` : ""}</div>
      </a>`;
  };

  const showCard = (show) => `
    <a class="card show" href="${showUrl(show.id)}">
      <div class="stack"></div>
      <div class="thumb">${thumbImg(show.episodes[0].id)}</div>
      <div class="title">${esc(show.title)}</div>
      <div class="meta">${show.episodes.length} episodes</div>
    </a>`;

  const videoCard = (v) => `
    <a class="card" href="${watchUrl(v.id)}">
      <div class="thumb">${thumbImg(v.id)}</div>
      <div class="title">${esc(v.title)}</div>
      <div class="meta">${esc(v.channel)}</div>
    </a>`;

  main.innerHTML =
    banner() +
    row("continue", "Continue Watching", KK.continueWatching().map(continueCard)) +
    row("shows", "Shows", KK.SHOWS.map(showCard)) +
    row("videos", "Videos", KK.VIDEOS.map(videoCard));

  main.querySelectorAll(".row-section").forEach(KK.enableRowArrows);

  // Header links to #shows / #videos land on the right row
  if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
})();
