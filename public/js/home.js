// KanKan — Home screen
// An age switcher at the top (All · Baby · Preschool · Early Primary · Upper Primary).
//   All:        Continue Watching, then a row per age group, then "Not sorted yet".
//   One age:    Continue Watching for that age, then a row per category.
(function () {
  const { esc, thumbImg, minutes, watchUrl, showUrl, ICON, TAGS } = KK;
  KK.renderHeader("home");
  const main = document.getElementById("home");

  // The chosen age is remembered on this device (e.g. the little one's iPad stays on "Baby").
  const AGE_KEY = "kankan.age";
  let age = "all";
  try { age = localStorage.getItem(AGE_KEY) || "all"; } catch { /* storage blocked */ }
  if (age !== "all" && !TAGS.ages.some((a) => a.id === age)) age = "all";

  const fits = (it) => age === "all" || (it.ages || []).includes(age);
  const shows = () => KK.SHOWS.filter((s) => s.episodes.length);

  // ---------- Banner: the show watched most recently in this age (or the first one) ----------
  function banner(list) {
    if (!list.length) return "";
    const all = KK.continueWatching();
    const recent = all.find((it) => it.show && list.includes(it.show));
    const show = recent ? recent.show : list[0];
    const r = KK.resumePoint(show);
    const ep = show.episodes[r.index];
    const playLabel = r.mode === "continue" ? `Continue Episode ${r.index + 1}`
                    : r.mode === "next" ? `Play Episode ${r.index + 1}` : "Play Episode 1";
    const label = [KK.tagLabels("ages", show.ages), `${show.episodes.length} episodes`].filter(Boolean).join(" · ");
    return `
      <section class="hero">
        ${thumbImg(show.banner || show.episodes[0].id, { big: true, lazy: false })}
        <div class="shade"></div>
        <div class="text">
          <div class="label">${esc(label)}</div>
          <h1>${esc(show.title)}</h1>
          ${show.description ? `<p>${esc(show.description)}</p>` : ""}
          <div class="btns">
            <a class="btn btn-light" href="${watchUrl(ep.id, show.id)}">${ICON.play}${playLabel}</a>
            <a class="btn btn-glass" href="${showUrl(show.id)}">All episodes</a>
          </div>
        </div>
      </section>`;
  }

  // ---------- Rows ----------
  let rowCount = 0;
  function row(title, cards, sub) {
    if (!cards.length) return "";
    const id = `row-${++rowCount}`;
    return `
      <section class="row-section" aria-labelledby="${id}">
        <h2 id="${id}">${esc(title)}${sub ? `<span class="sub">${esc(sub)}</span>` : ""}</h2>
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

  const showCard = (show) => {
    const lang = KK.languageNote(show);
    return `
      <a class="card show" href="${showUrl(show.id)}">
        <div class="stack"></div>
        <div class="thumb">${thumbImg(show.banner || show.episodes[0].id)}</div>
        <div class="title">${esc(show.title)}</div>
        <div class="meta">${show.episodes.length} episodes${lang ? ` · ${esc(lang)}` : ""}</div>
      </a>`;
  };

  const videoCard = (v) => {
    const lang = KK.languageNote(v);
    return `
      <a class="card" href="${watchUrl(v.id)}">
        <div class="thumb">${thumbImg(v.id)}</div>
        <div class="title">${esc(v.title)}</div>
        <div class="meta">${esc(v.channel)}${lang ? ` · ${esc(lang)}` : ""}</div>
      </a>`;
  };

  // Shows first, then single videos
  const cardsFor = (pred) => [
    ...shows().filter(pred).map(showCard),
    ...KK.VIDEOS.filter(pred).map(videoCard),
  ];

  // ---------- Age switcher ----------
  function ageBar() {
    const chip = (id, label, range) =>
      `<button type="button" class="chip" data-age="${id}" aria-pressed="${age === id}">${esc(label)}${range ? `<span>${range}</span>` : ""}</button>`;
    return `<nav class="age-bar" aria-label="Age group">${chip("all", "All")}${TAGS.ages.map((a) => chip(a.id, a.label, a.range)).join("")}</nav>`;
  }

  function empty(text) {
    return `<div class="empty"><h2>${text}</h2><p>Ask a grown-up to add some shows and videos.</p><a class="btn btn-dark" href="parents.html">Go to Parents</a></div>`;
  }

  function render() {
    rowCount = 0;
    if (!shows().length && !KK.VIDEOS.length) { main.innerHTML = empty("Nothing to watch yet"); return; }

    const inAge = shows().filter(fits);
    const cw = KK.continueWatching().filter((it) => fits(it.show || KK.findVideo(it.id) || {}));
    let rows = "";

    if (age === "all") {
      for (const a of TAGS.ages) rows += row(a.label, cardsFor((it) => (it.ages || []).includes(a.id)), `Ages ${a.range}`);
      rows += row("Not sorted yet", cardsFor((it) => !(it.ages || []).length));
    } else {
      for (const c of TAGS.categories) rows += row(c.label, cardsFor((it) => fits(it) && (it.categories || []).includes(c.id)));
      rows += row("More", cardsFor((it) => fits(it) && !(it.categories || []).length));
    }

    const a = TAGS.ages.find((x) => x.id === age);
    main.innerHTML = ageBar() + (rows
      ? banner(inAge) + row("Continue Watching", cw.map(continueCard)) + rows
      : empty(`Nothing for ${a ? a.label : "this age"} yet`));

    main.querySelectorAll(".row-section").forEach(KK.enableRowArrows);
    main.querySelector(".age-bar").onclick = (e) => {
      const b = e.target.closest("[data-age]");
      if (!b || b.dataset.age === age) return;
      age = b.dataset.age;
      try { localStorage.setItem(AGE_KEY, age); } catch { /* storage blocked */ }
      render();
    };
  }

  KK.load().then(render, () => KK.loadError(main));
})();
