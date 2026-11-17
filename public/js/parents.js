// KanKan — Parents area: a grown-up maths question, then add / edit / remove / refresh.
// Unlocking lasts only while you stay on this page (it is never saved).
(function () {
  const { esc, thumbImg, minutes, ICON, TAGS } = KK;
  KK.renderHeader("parents");
  const main = document.getElementById("parents");

  // ---------- Maths question ----------
  let answer = 0;
  function newQuestion() {
    const a = 12 + Math.floor(Math.random() * 18); // 12–29
    const b = 3 + Math.floor(Math.random() * 7);   // 3–9
    answer = a * b;
    return `${a} × ${b}`;
  }

  function gate(message) {
    main.innerHTML = `
      <section class="gate">
        <div class="gate-icon">${ICON.lock}</div>
        <h1>Grown-ups only</h1>
        <p class="meta">Answer this to manage what's in KanKan.</p>
        <form id="gate-form" autocomplete="off">
          <label for="gate-answer">What is <b>${newQuestion()}</b>?</label>
          <input id="gate-answer" class="field" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4" required>
          <p class="form-msg" id="gate-msg">${message || ""}</p>
          <button class="btn btn-dark" type="submit">Continue</button>
        </form>
        <a class="back-link" href="index.html">Back to Home</a>
      </section>`;
    const input = document.getElementById("gate-answer");
    input.focus();
    document.getElementById("gate-form").onsubmit = (e) => {
      e.preventDefault();
      if (parseInt(input.value, 10) === answer) manage();
      else gate("Not quite. Try this one.");
    };
  }

  // ---------- Toast ----------
  let toastTimer;
  function toast(text) {
    const t = document.getElementById("toast");
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
  }

  function busy(button, on, label) {
    button.disabled = on;
    button.textContent = label;
  }

  // ---------- The details form (used for both adding and editing) ----------
  // item: { kind, id, title, ages, categories, languages, order, banner }
  // episodes: the show's episodes in YouTube's playlist order ([{ id, title }])
  function chips(group, selected, { single = false } = {}) {
    return `<div class="chips" role="group" data-group="${group}"${single ? ' data-single="1"' : ""}>` +
      TAGS[group].map((t) => `
        <button type="button" class="chip" data-value="${t.id}" aria-pressed="${selected.includes(t.id)}">
          ${esc(t.label)}${t.range ? `<span>${t.range}</span>` : ""}
        </button>`).join("") + `</div>`;
  }

  function detailsForm(item, episodes, { submitLabel }) {
    const isShow = item.kind === "show";
    const order = item.order || "playlist";
    return `
      <form class="details" autocomplete="off" novalidate>
        <label class="name-label" for="f-name">Name in KanKan</label>
        <input id="f-name" name="title" class="field" type="text" maxlength="80" value="${esc(item.title)}" required>

        <fieldset>
          <legend>Age groups <span class="req">pick at least one</span></legend>
          ${chips("ages", item.ages || [])}
        </fieldset>
        <fieldset>
          <legend>Categories</legend>
          ${chips("categories", item.categories || [])}
        </fieldset>
        <fieldset>
          <legend>Language</legend>
          ${chips("languages", item.languages || [])}
        </fieldset>

        ${isShow ? `
        <fieldset>
          <legend>Episode order</legend>
          <div class="chips" data-group="order" data-single="1">
            <button type="button" class="chip" data-value="playlist" aria-pressed="${order === "playlist"}">As on YouTube</button>
            <button type="button" class="chip" data-value="reverse" aria-pressed="${order === "reverse"}">Reversed</button>
          </div>
          <p class="hint" data-first></p>
        </fieldset>
        <fieldset>
          <legend>Cover picture</legend>
          <div class="covers" data-covers></div>
        </fieldset>` : ""}

        <p class="form-msg" data-msg></p>
        <div class="btns">
          <button class="btn btn-dark" type="submit">${submitLabel}</button>
          <button class="btn btn-outline" type="button" data-cancel>Cancel</button>
        </div>
      </form>`;
  }

  // Wire up a details form. Resolves with the chosen values via onSubmit(values, button, msgEl).
  function wireForm(form, item, episodes, { onSubmit, onCancel }) {
    let cover = item.banner || (episodes[0] && episodes[0].id) || item.id;

    form.querySelectorAll(".chips").forEach((group) => {
      group.addEventListener("click", (e) => {
        const chip = e.target.closest(".chip");
        if (!chip) return;
        if (group.dataset.single) {
          group.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
        } else {
          chip.setAttribute("aria-pressed", String(chip.getAttribute("aria-pressed") !== "true"));
        }
        if (group.dataset.group === "order") updateShowBits();
      });
    });

    const values = (group) => [...form.querySelectorAll(`[data-group="${group}"] .chip[aria-pressed="true"]`)].map((c) => c.dataset.value);

    // Episode order hint + cover strip (shows only)
    function updateShowBits() {
      if (item.kind !== "show" || !episodes.length) return;
      const order = values("order")[0] || "playlist";
      const list = order === "reverse" ? [...episodes].reverse() : episodes;
      form.querySelector("[data-first]").innerHTML = `Episode 1 will be: <b>${esc(list[0].title)}</b>`;
      // Offer the first 24 episodes (in the chosen order), plus the current cover if it's further in
      const offer = list.slice(0, 24);
      if (!offer.some((e) => e.id === cover)) {
        const cur = episodes.find((e) => e.id === cover);
        if (cur) offer.unshift(cur);
      }
      const strip = form.querySelector("[data-covers]");
      strip.innerHTML = offer.map((e) => `
        <button type="button" class="cover${e.id === cover ? " on" : ""}" data-id="${esc(e.id)}" aria-pressed="${e.id === cover}" title="${esc(e.title)}">
          ${thumbImg(e.id, { alt: e.title })}
        </button>`).join("");
    }
    if (item.kind === "show") {
      form.querySelector("[data-covers]").addEventListener("click", (e) => {
        const b = e.target.closest(".cover");
        if (!b) return;
        cover = b.dataset.id;
        form.querySelectorAll(".cover").forEach((c) => { c.classList.toggle("on", c === b); c.setAttribute("aria-pressed", String(c === b)); });
      });
      updateShowBits();
    }

    form.querySelector("[data-cancel]").onclick = onCancel;
    form.onsubmit = (e) => {
      e.preventDefault();
      const msg = form.querySelector("[data-msg]");
      msg.textContent = "";
      const out = {
        title: form.querySelector("[name=title]").value.trim(),
        ages: values("ages"),
        categories: values("categories"),
        languages: values("languages"),
      };
      if (item.kind === "show") { out.order = values("order")[0] || "playlist"; out.cover = cover; }
      if (!out.title) { msg.textContent = "Give it a name."; return; }
      if (!out.ages.length) { msg.textContent = "Pick at least one age group."; return; }
      onSubmit(out, form.querySelector("[type=submit]"), msg);
    };
  }

  // A best guess at the language from the titles (Chinese characters → Chinese, otherwise English)
  function guessLanguages(item) {
    const text = [item.title, ...(item.episodeList || []).slice(0, 10).map((e) => e.title)].join(" ");
    return /[一-鿿]/.test(text) ? ["zh"] : ["en"];
  }

  // ---------- Manage the library ----------
  function manage() {
    main.innerHTML = `
      <div class="parents-head">
        <div><div class="label">Parents</div><h1>Manage KanKan</h1></div>
        <a class="btn btn-outline" href="index.html">Done</a>
      </div>

      <section class="panel">
        <h2>Add a show or video</h2>
        <p class="meta">Paste a YouTube link to a playlist (it becomes a show) or a single video.</p>
        <form id="add-form" class="add-row" autocomplete="off">
          <input id="link" class="field" type="url" inputmode="url" placeholder="https://www.youtube.com/…" required>
          <button class="btn btn-dark" type="submit" id="lookup-btn">Look up</button>
        </form>
        <p class="form-msg" id="add-msg"></p>
        <div id="preview"></div>
      </section>

      <section class="panel" id="library"><p class="meta">Loading…</p></section>`;

    const form = document.getElementById("add-form");
    const link = document.getElementById("link");
    const msg = document.getElementById("add-msg");
    const btn = document.getElementById("lookup-btn");

    form.onsubmit = async (e) => {
      e.preventDefault();
      msg.textContent = "";
      document.getElementById("preview").innerHTML = "";
      busy(btn, true, "Looking up…");
      try {
        const item = await KK.api("/api/preview", { method: "POST", body: { url: link.value } });
        showPreview(item, link.value);
      } catch (err) {
        msg.textContent = err.message;
      } finally {
        busy(btn, false, "Look up");
      }
    };
    link.focus();
    renderLibrary();
  }

  function showPreview(item, url) {
    const box = document.getElementById("preview");
    const isShow = item.kind === "show";
    const what = isShow ? `Show · ${item.episodes} episode${item.episodes === 1 ? "" : "s"}` : `Video${item.seconds ? ` · ${minutes(item.seconds)} min` : ""}`;
    const warn = !item.embeddable
      ? `<p class="note">The creator doesn't allow this video to play on other sites. In KanKan it will show a "Watch on YouTube" button instead.</p>` : "";
    box.innerHTML = `
      <div class="preview">
        <div class="thumb">${thumbImg(item.banner || item.id, { lazy: false, alt: item.title })}</div>
        <div class="preview-info">
          <div class="label">${what}${item.channel ? ` · ${esc(item.channel)}` : ""}</div>
          ${item.description ? `<p class="desc">${esc(item.description)}</p>` : ""}
          ${warn}
          ${item.alreadyAdded ? `<p class="note">This is already in KanKan.</p>` : ""}
        </div>
      </div>
      ${item.alreadyAdded ? "" : detailsForm(
        { ...item, ages: [], categories: [], languages: guessLanguages(item), order: "playlist" },
        item.episodeList || [], { submitLabel: "Add to KanKan" })}`;
    if (item.alreadyAdded) return;

    wireForm(box.querySelector("form.details"), { ...item, order: "playlist" }, item.episodeList || [], {
      onCancel: () => { box.innerHTML = ""; },
      onSubmit: async (values, button, msgEl) => {
        busy(button, true, isShow ? "Adding episodes…" : "Adding…");
        try {
          await KK.api("/api/items", { method: "POST", body: { url, ...values } });
          box.innerHTML = "";
          document.getElementById("link").value = "";
          toast(`Added "${values.title}"`);
          renderLibrary();
        } catch (err) {
          busy(button, false, "Add to KanKan");
          msgEl.textContent = err.message;
        }
      },
    });
  }

  // ---------- The list of what's in KanKan ----------
  function tagSummary(it) {
    const bits = [KK.tagLabels("ages", it.ages), KK.tagLabels("categories", it.categories), KK.tagLabels("languages", it.languages)].filter(Boolean);
    return bits.length ? esc(bits.join(" · ")) : "";
  }

  async function renderLibrary() {
    const box = document.getElementById("library");
    try {
      await KK.load();
    } catch {
      box.innerHTML = `<p class="form-msg">Couldn't load the library. <button class="linkish" type="button" id="retry">Try again</button></p>`;
      document.getElementById("retry").onclick = renderLibrary;
      return;
    }
    const shows = KK.SHOWS, videos = KK.VIDEOS;
    const unsorted = [...shows, ...videos].filter((it) => !(it.ages || []).length).length;
    const row = (it, isShow) => `
      <div class="lib-row" data-id="${esc(it.id)}" data-kind="${isShow ? "show" : "video"}">
        <div class="thumb">${thumbImg(isShow ? (it.banner || it.episodes[0]?.id || it.id) : it.id, { alt: it.title })}</div>
        <div class="lib-info">
          <div class="title">${esc(it.title)}</div>
          <div class="meta">${isShow ? `${it.episodes.length} episodes` : esc(it.channel || "Video")}</div>
          <div class="tags">${(it.ages || []).length ? tagSummary(it) : `<span class="unsorted">Not sorted yet</span>`}</div>
        </div>
        <div class="lib-actions">
          <button class="btn btn-outline btn-small" type="button" data-act="edit">Edit</button>
          ${isShow ? `<button class="btn btn-outline btn-small" type="button" data-act="refresh">Refresh</button>` : ""}
          <button class="btn btn-outline btn-small danger" type="button" data-act="remove">Remove</button>
        </div>
      </div>`;
    box.innerHTML = `
      <h2>In KanKan</h2>
      ${unsorted ? `<p class="note">${unsorted} item${unsorted === 1 ? " needs" : "s need"} an age group. Tap <b>Edit</b> to sort ${unsorted === 1 ? "it" : "them"}.</p>` : ""}
      <h3>Shows <span class="count">${shows.length}</span></h3>
      ${shows.length ? shows.map((s) => row(s, true)).join("") : `<p class="meta">No shows yet.</p>`}
      <h3>Videos <span class="count">${videos.length}</span></h3>
      ${videos.length ? videos.map((v) => row(v, false)).join("") : `<p class="meta">No videos yet.</p>`}`;

    box.onclick = async (e) => {
      const b = e.target.closest("button[data-act]");
      if (!b) return;
      const rowEl = b.closest(".lib-row");
      const id = rowEl.dataset.id;
      const title = rowEl.querySelector(".title").textContent;
      if (b.dataset.act === "edit") return openEdit(rowEl);
      if (b.dataset.act === "remove") {
        if (!confirm(`Remove "${title}" from KanKan?`)) return;
        busy(b, true, "Removing…");
        try {
          await KK.api(`/api/items/${encodeURIComponent(id)}`, { method: "DELETE" });
          toast(`Removed "${title}"`);
          renderLibrary();
        } catch (err) { busy(b, false, "Remove"); toast(err.message); }
      } else if (b.dataset.act === "refresh") {
        busy(b, true, "Refreshing…");
        try {
          const before = KK.findShow(id)?.episodes.length || 0;
          const r = await KK.api(`/api/items/${encodeURIComponent(id)}/refresh`, { method: "POST" });
          const diff = r.episodes - before;
          toast(diff > 0 ? `${diff} new episode${diff === 1 ? "" : "s"} added to "${title}"` : `"${title}" is up to date (${r.episodes} episodes)`);
          renderLibrary();
        } catch (err) { busy(b, false, "Refresh"); toast(err.message); }
      }
    };
  }

  function openEdit(rowEl) {
    document.querySelectorAll(".edit-box").forEach((x) => x.remove()); // one at a time
    const id = rowEl.dataset.id;
    const isShow = rowEl.dataset.kind === "show";
    const it = isShow ? KK.findShow(id) : KK.findVideo(id);
    if (!it) return;
    // The form works with YouTube's playlist order; the library sends episodes already in the chosen order.
    const episodes = isShow ? (it.order === "reverse" ? [...it.episodes].reverse() : it.episodes) : [];
    const item = { ...it, kind: isShow ? "show" : "video" };
    const holder = document.createElement("div");
    holder.className = "edit-box";
    holder.innerHTML = detailsForm(item, episodes, { submitLabel: "Save" });
    rowEl.after(holder);
    holder.scrollIntoView({ behavior: "smooth", block: "nearest" });
    wireForm(holder.querySelector("form"), item, episodes, {
      onCancel: () => holder.remove(),
      onSubmit: async (values, button, msgEl) => {
        busy(button, true, "Saving…");
        try {
          await KK.api(`/api/items/${encodeURIComponent(id)}`, { method: "PATCH", body: values });
          toast(`Saved "${values.title}"`);
          renderLibrary();
        } catch (err) {
          busy(button, false, "Save");
          msgEl.textContent = err.message;
        }
      },
    });
  }

  gate();
})();
