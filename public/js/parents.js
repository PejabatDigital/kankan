// KanKan — Parents area: a grown-up maths question, then add / remove / refresh.
// Unlocking lasts only while you stay on this page (it is never saved).
(function () {
  const { esc, thumbImg, minutes, ICON } = KK;
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
          <label class="name-label" for="name">Name in KanKan</label>
          <input id="name" class="field" type="text" maxlength="80" value="${esc(item.title)}">
          ${item.description ? `<p class="desc">${esc(item.description)}</p>` : ""}
          ${warn}
          ${item.alreadyAdded
            ? `<p class="note">This is already in KanKan.</p>`
            : `<div class="btns"><button class="btn btn-dark" type="button" id="add-btn">Add to KanKan</button><button class="btn btn-outline" type="button" id="cancel-btn">Cancel</button></div>`}
        </div>
      </div>`;
    if (item.alreadyAdded) return;
    document.getElementById("cancel-btn").onclick = () => { box.innerHTML = ""; };
    const add = document.getElementById("add-btn");
    add.onclick = async () => {
      busy(add, true, isShow ? "Adding episodes…" : "Adding…");
      try {
        const title = document.getElementById("name").value;
        await KK.api("/api/items", { method: "POST", body: { url, title } });
        box.innerHTML = "";
        document.getElementById("link").value = "";
        toast(`Added "${title}"`);
        renderLibrary();
      } catch (err) {
        busy(add, false, "Add to KanKan");
        document.getElementById("add-msg").textContent = err.message;
      }
    };
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
    const row = (it, isShow) => `
      <div class="lib-row" data-id="${esc(it.id)}">
        <div class="thumb">${thumbImg(isShow ? (it.banner || it.episodes[0]?.id || it.id) : it.id, { alt: it.title })}</div>
        <div class="lib-info">
          <div class="title">${esc(it.title)}</div>
          <div class="meta">${isShow ? `${it.episodes.length} episodes` : esc(it.channel || "Video")}</div>
        </div>
        <div class="lib-actions">
          ${isShow ? `<button class="btn btn-outline btn-small" type="button" data-act="refresh">Refresh</button>` : ""}
          <button class="btn btn-outline btn-small danger" type="button" data-act="remove">Remove</button>
        </div>
      </div>`;
    box.innerHTML = `
      <h2>In KanKan</h2>
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
      if (b.dataset.act === "remove") {
        if (!confirm(`Remove "${title}" from KanKan?`)) return;
        busy(b, true, "Removing…");
        try {
          await KK.api(`/api/items/${encodeURIComponent(id)}`, { method: "DELETE" });
          toast(`Removed "${title}"`);
          renderLibrary();
        } catch (err) { busy(b, false, "Remove"); toast(err.message); }
      } else {
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

  function busy(button, on, label) {
    button.disabled = on;
    button.textContent = label;
  }

  gate();
})();
