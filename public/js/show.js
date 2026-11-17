// KanKan — Show page (one playlist, all its episodes in order)
(function () {
  const { esc, thumbImg, minutes, watchUrl, ICON } = KK;
  KK.renderHeader("shows");
  const main = document.getElementById("show");
  KK.load().then(render, () => KK.loadError(main));

  function render() {
    const show = KK.findShow(KK.param("id"));

    if (!show || !show.episodes.length) {
      main.innerHTML = `<div class="empty"><p>We couldn't find that show.</p><a class="btn btn-dark" href="index.html">Back to Home</a></div>`;
      return;
    }
    document.title = `${show.title} · KanKan 看看`;

    const r = KK.resumePoint(show);
    const first = show.episodes[0];
    const resumeEp = show.episodes[r.index];
    const primary = r.mode === "continue" ? `Continue Episode ${r.index + 1}`
                  : r.mode === "next" ? `Play Episode ${r.index + 1}` : "Play Episode 1";
    const secondary = r.index > 0
      ? `<a class="btn btn-outline" href="${watchUrl(first.id, show.id)}">Start from Episode 1</a>` : "";

    function episodeRow(ep, i) {
      const p = KK.getProgress(ep.id);
      let state = "";
      if (p && p.done) state = `<span class="pill">Watched</span>`;
      else if (KK.inProgress(p)) {
        const left = p.d ? `<span class="meta" style="margin:0">${minutes(p.d - p.t)} min left</span>` : "";
        state = `<div class="track"><div style="width:${Math.round(KK.fraction(p) * 100)}%"></div></div>${left}`;
      }
      const now = r.mode === "continue" && i === r.index ? " now" : "";
      return `
        <a class="ep${now}" href="${watchUrl(ep.id, show.id)}" id="ep-${i + 1}">
          <div class="num">${i + 1}</div>
          <div class="thumb">${thumbImg(ep.id)}</div>
          <div class="info">
            <div class="title">${esc(ep.title)}</div>
            <div class="meta">Episode ${i + 1}${ep.seconds ? ` · ${minutes(ep.seconds)} min` : ""}</div>
            <div class="state">${state}</div>
          </div>
        </a>`;
    }

    main.innerHTML = `
      <a class="back" href="index.html">${ICON.back}Home</a>
      <section class="show-hero">
        <div class="text">
          <div class="label">${esc([KK.tagLabels("ages", show.ages), `${show.episodes.length} episodes`, KK.tagLabels("languages", show.languages)].filter(Boolean).join(" · "))}</div>
          <h1>${esc(show.title)}</h1>
          <p>${esc(show.description)}</p>
          <div class="btns">
            <a class="btn btn-dark" href="${watchUrl(resumeEp.id, show.id)}">${ICON.play}${primary}</a>
            ${secondary}
          </div>
        </div>
        <div class="thumb">${thumbImg(show.banner || first.id, { big: true, lazy: false, alt: show.title })}</div>
      </section>
      <section class="episodes">
        <div class="episodes-head"><h2>Episodes</h2><span class="meta">${show.episodes.length} episodes</span></div>
        ${show.episodes.map(episodeRow).join("")}
      </section>`;
  }
})();
