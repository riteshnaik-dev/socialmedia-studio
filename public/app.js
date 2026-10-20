// Social Media Studio: the code that runs in your browser.

const STATUSES = ["Idea", "Draft", "Scheduled", "Published"];
const LIMITS = { LinkedIn: 3000, X: 280 }; // Character limits for a standard post on each platform
const PUBLISHED_SHOWN = 12; // The Published column shows the most recent posts first

const content = document.getElementById("content");

let posts = null; // loaded once from Notion, then kept up to date as you edit
let platformFilter = "All";
let showAllPublished = false;
let leaveGuard = null; // set by the editor while it has unsaved changes

// ---------- Small helpers ----------

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

async function api(method, path, body) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 401) {
    location.href = "/login";
    throw new Error("Signed out");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

async function loadPosts(force) {
  if (!posts || force) posts = await api("GET", "/api/posts");
  return posts;
}

// "2026-10-21T13:00:00.000Z" -> "Wed, Oct 21, 9:00 AM" in your own time zone
function formatDate(iso) {
  if (!iso) return "";
  const hasTime = iso.includes("T");
  return new Date(iso).toLocaleString(undefined, hasTime
    ? { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
    : { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

function shortDate(iso) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
}

// Converts between the date box (local time) and the stored value (exact moment, with time zone)
function toInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function fromInputValue(value) {
  return value ? new Date(value).toISOString() : null;
}

function compact(n) {
  if (n === null || n === undefined) return "";
  return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "K" : String(n);
}

// ---------- Content Board ----------

async function showBoard() {
  content.innerHTML = `
    <div class="board-header">
      <h1>Content Board</h1>
      <div class="filters" role="group" aria-label="Platform">
        ${["All", "LinkedIn", "X"].map((p) =>
          `<button type="button" class="filter ${p === platformFilter ? "on" : ""}" data-platform="${p}">${p}</button>`).join("")}
      </div>
      <a class="button" href="#editor">+ New Post</a>
    </div>
    <p class="muted" id="board-status">Loading posts from Notion...</p>
    <div class="board" id="board"></div>`;

  content.querySelectorAll(".filter").forEach((button) =>
    button.addEventListener("click", () => {
      platformFilter = button.dataset.platform;
      content.querySelectorAll(".filter").forEach((b) => b.classList.toggle("on", b === button));
      renderColumns();
    }));

  try {
    await loadPosts(true);
    document.getElementById("board-status").hidden = true;
    renderColumns();
  } catch (error) {
    document.getElementById("board-status").textContent = error.message;
  }
}

function renderColumns() {
  const board = document.getElementById("board");
  if (!board) return;
  const visible = posts.filter((p) => platformFilter === "All" || p.platform === platformFilter);

  board.innerHTML = STATUSES.map((status) => {
    let cards = visible.filter((p) => p.status === status);
    const total = cards.length;
    if (status === "Published") {
      cards.sort((a, b) => (b.publishedAt || b.created).localeCompare(a.publishedAt || a.created));
      if (!showAllPublished) cards = cards.slice(0, PUBLISHED_SHOWN);
    }
    if (status === "Scheduled") cards.sort((a, b) => (a.scheduledFor || "").localeCompare(b.scheduledFor || ""));
    const more = status === "Published" && total > PUBLISHED_SHOWN
      ? `<button type="button" class="link" id="toggle-published">${showAllPublished ? "Show fewer" : `Show all ${total}`}</button>` : "";
    return `
      <section class="column">
        <h2>${status} <span class="count">${total}</span></h2>
        ${cards.map((post) => `
          <a class="card" href="#editor/${post.id}">
            <span class="badge ${post.platform === "X" ? "x" : post.platform ? "li" : "none"}">${escapeHtml(post.platform || "Idea")}</span>
            <strong>${escapeHtml(post.title || "Untitled")}</strong>
            ${post.text ? `<span class="snippet">${escapeHtml(TextKit.toPlain(post.text).slice(0, 140))}</span>` : ""}
            ${post.status === "Published" && post.publishedAt ? `<span class="when">${shortDate(post.publishedAt)}${post.stats?.impressions != null ? ` · ${compact(post.stats.impressions)} impressions` : ""}</span>` : ""}
            ${post.status !== "Published" && post.scheduledFor ? `<span class="when">${formatDate(post.scheduledFor)}</span>` : ""}
          </a>`).join("") || `<p class="empty">Nothing here yet.</p>`}
        ${more}
      </section>`;
  }).join("");

  document.getElementById("toggle-published")?.addEventListener("click", () => {
    showAllPublished = !showAllPublished;
    renderColumns();
  });
}

// ---------- Editor ----------

const previewProfile = (() => {
  try {
    return JSON.parse(localStorage.getItem("previewProfile")) || {};
  } catch {
    return {};
  }
})();

async function showEditor(id) {
  let post = { title: "", platform: platformFilter === "X" ? "X" : "LinkedIn", status: "Draft", text: "", scheduledFor: null };
  if (id) {
    content.innerHTML = `<p class="muted">Loading post...</p>`;
    try {
      const found = (await loadPosts()).find((p) => p.id === id) || (await loadPosts(true)).find((p) => p.id === id);
      if (!found) throw new Error("That post wasn't found. It may have been deleted in Notion.");
      post = { ...found };
    } catch (error) {
      content.innerHTML = `<p class="error">${escapeHtml(error.message)}</p><p><a href="#board">Back to the board</a></p>`;
      return;
    }
  }

  let editingId = id || null;
  let dirty = false;
  let device = "phone";
  let theme = "light";
  let expanded = false;
  let tab = "preview";

  content.innerHTML = `
    <div class="editor">
      <div class="editor-top">
        <a href="#board" class="back">&larr; Board</a>
        <input id="e-title" class="title-input" maxlength="200" placeholder="Post title (only you see this)" value="${escapeHtml(post.title)}" />
        <select id="e-platform" aria-label="Platform">${["LinkedIn", "X"].map((p) => `<option ${p === post.platform ? "selected" : ""}>${p}</option>`).join("")}</select>
        <select id="e-status" aria-label="Status">${STATUSES.map((s) => `<option ${s === post.status ? "selected" : ""}>${s}</option>`).join("")}</select>
        <input id="e-when" type="datetime-local" aria-label="Scheduled for" value="${toInputValue(post.scheduledFor)}" />
        <button type="button" id="e-save">Save</button>
      </div>
      <p class="error" id="e-error" hidden></p>

      <div class="editor-body">
        <section class="writing">
          <div class="toolbar" role="toolbar" aria-label="Formatting">
            <button type="button" data-t="bold" title="Bold (Ctrl/Cmd+B)"><b>B</b></button>
            <button type="button" data-t="italic" title="Italic (Ctrl/Cmd+I)"><i>I</i></button>
            <button type="button" data-t="underline" title="Underline (Ctrl/Cmd+U)"><u>U</u></button>
            <button type="button" data-t="strike" title="Strikethrough"><s>S</s></button>
            <button type="button" data-t="code" title="Code-style letters">&lt;/&gt;</button>
            <button type="button" data-t="clear" title="Clear formatting">Clear</button>
            <span class="sep"></span>
            <button type="button" data-t="bullets" title="Bullet list">&bull; List</button>
            <button type="button" data-t="numbers" title="Numbered list">1. List</button>
            <span class="sep"></span>
            <span class="label">Staircase:</span>
            <button type="button" data-s="up" title="Short to long">Short &rarr; Long</button>
            <button type="button" data-s="down" title="Long to short">Long &rarr; Short</button>
            <button type="button" data-s="peak" title="Short, long, short">S-L-S</button>
            <button type="button" data-s="valley" title="Long, short, long">L-S-L</button>
          </div>
          <textarea id="e-text" spellcheck="true" placeholder="Start with a hook. Pick one from the Hooks tab, or write your own.">${escapeHtml(post.text)}</textarea>
          <div class="stats-bar" id="e-stats"></div>
        </section>

        <aside class="side">
          <div class="tabs" role="tablist">
            <button type="button" data-tab="preview">Preview</button>
            <button type="button" data-tab="hooks">Hooks</button>
            <button type="button" data-tab="endings">Endings</button>
            <button type="button" data-tab="snippets">Snippets</button>
          </div>
          <div id="side-body"></div>
        </aside>
      </div>
    </div>`;

  const $ = (sel) => content.querySelector(sel);
  const textarea = $("#e-text");
  const platformSel = $("#e-platform");

  function markDirty() {
    dirty = true;
    leaveGuard = () => !dirty || confirm("You have unsaved changes. Leave without saving?");
  }

  // Replace the selected text (or insert at the cursor) in a way Ctrl/Cmd+Z can undo
  function replaceSelection(newText, selectAfter = true) {
    textarea.focus();
    const start = textarea.selectionStart;
    if (!document.execCommand("insertText", false, newText)) textarea.setRangeText(newText);
    if (selectAfter) textarea.setSelectionRange(start, start + newText.length);
    textarea.dispatchEvent(new Event("input"));
  }

  function selectedText() {
    return textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
  }

  // Expands the selection to whole lines (for lists and staircase layouts)
  function selectWholeLines() {
    const v = textarea.value;
    let start = textarea.selectionStart, end = textarea.selectionEnd;
    if (start === end) { start = 0; end = v.length; }
    start = v.lastIndexOf("\n", start - 1) + 1;
    const nl = v.indexOf("\n", end > start && v[end - 1] === "\n" ? end - 1 : end);
    end = nl === -1 ? v.length : nl;
    textarea.setSelectionRange(start, end);
  }

  function applyTransform(name) {
    if (name === "bullets" || name === "numbers") selectWholeLines();
    const sel = selectedText();
    if (!sel) return showError("Select some text first.");
    replaceSelection(TextKit.transforms[name](sel));
  }

  content.querySelectorAll("[data-t]").forEach((b) => b.addEventListener("click", () => applyTransform(b.dataset.t)));
  content.querySelectorAll("[data-s]").forEach((b) => b.addEventListener("click", () => {
    selectWholeLines();
    const sel = selectedText();
    if (!sel.trim()) return showError("Select the lines to rearrange.");
    replaceSelection(TextKit.staircase(sel, b.dataset.s));
  }));

  textarea.addEventListener("keydown", (e) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const key = e.key.toLowerCase();
    const map = { b: "bold", i: "italic", u: "underline" };
    if (map[key]) { e.preventDefault(); applyTransform(map[key]); }
    if (key === "s") { e.preventDefault(); save(); }
  });

  function showError(message) {
    const box = $("#e-error");
    box.textContent = message;
    box.hidden = !message;
    if (message) setTimeout(() => { if (box.textContent === message) box.hidden = true; }, 4000);
  }

  function renderStats() {
    const s = TextKit.stats(textarea.value);
    const limit = LIMITS[platformSel.value];
    const over = s.characters > limit;
    $("#e-stats").innerHTML = `
      <span title="Reading grade level (Flesch-Kincaid). Lower is easier; 6 to 8 reads well on LinkedIn.">Grade ${s.grade}</span>
      <span class="${over ? "over" : ""}">${s.characters.toLocaleString()} / ${limit.toLocaleString()} characters</span>
      <span>${s.words} words</span>
      <span>${s.sentences} sentences</span>
      <span>${s.paragraphs} paragraphs</span>
      <span>${s.readingSeconds}s read</span>`;
  }

  textarea.addEventListener("input", () => { markDirty(); renderStats(); if (tab === "preview") renderSide(); });
  ["#e-title", "#e-status", "#e-when"].forEach((sel) => $(sel).addEventListener("input", markDirty));
  platformSel.addEventListener("change", () => { markDirty(); renderStats(); renderSide(); });

  // ----- Side panel -----

  function renderSide() {
    content.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
    const body = $("#side-body");
    if (tab === "preview") body.innerHTML = previewHtml();
    if (tab === "hooks" || tab === "endings") body.innerHTML = libraryHtml(tab);
    if (tab === "snippets") renderSnippets(body);
    wireSide(body);
  }

  content.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; renderSide(); }));

  function previewHtml() {
    const text = textarea.value;
    const isX = platformSel.value === "X";
    const name = previewProfile.name || "Ritesh Naik";
    const headline = previewProfile.headline || "Business Analytics | AI | FP&A";
    const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    // LinkedIn shows about 3 lines (or about 210 characters) before "...more"
    let shown = text;
    let cut = false;
    if (!isX && !expanded) {
      const lines = text.split("\n");
      let byLines = lines.slice(0, 3).join("\n");
      if (lines.length > 3) cut = true;
      if ([...byLines].length > 210) { byLines = [...byLines].slice(0, 210).join("").replace(/\s+\S*$/, ""); cut = true; }
      shown = byLines;
    }
    return `
      <div class="preview-controls">
        <div class="filters">
          <button type="button" class="filter ${device === "phone" ? "on" : ""}" data-device="phone">Phone</button>
          <button type="button" class="filter ${device === "desktop" ? "on" : ""}" data-device="desktop">Desktop</button>
        </div>
        <div class="filters">
          <button type="button" class="filter ${theme === "light" ? "on" : ""}" data-theme-btn="light">Light</button>
          <button type="button" class="filter ${theme === "dark" ? "on" : ""}" data-theme-btn="dark">Dark</button>
        </div>
        <button type="button" class="secondary small" id="copy-text">Copy text</button>
      </div>
      <div class="preview-frame ${device} ${theme}">
        <div class="post-card">
          <div class="post-head">
            <div class="avatar">${escapeHtml(initials)}</div>
            <div><strong>${escapeHtml(name)}</strong>${isX ? ` <span class="faint">@you</span>` : `<div class="faint">${escapeHtml(headline)}</div><div class="faint">Now</div>`}</div>
          </div>
          <div class="post-text">${escapeHtml(shown) || `<span class="faint">Your post will appear here.</span>`}${cut ? `<button type="button" class="see-more" id="see-more">...more</button>` : ""}</div>
          ${expanded && !isX ? `<button type="button" class="see-more" id="see-less">Show less</button>` : ""}
        </div>
      </div>
      <p class="hint">${isX
        ? "X shows the whole post up to 280 characters."
        : "LinkedIn shows about the first 3 lines before \"...more\". Your hook has to earn the click."}
        <button type="button" class="link" id="edit-profile">Edit preview name</button></p>`;
  }

  function libraryHtml(kind) {
    const items = LIBRARY[kind];
    const tags = [...new Set(items.flatMap((i) => i.tags))].sort();
    return `
      <div class="lib-controls">
        <input id="lib-filter" placeholder="Filter ${kind}" />
        <select id="lib-tag"><option value="">All tags</option>${tags.map((t) => `<option>${t}</option>`).join("")}</select>
      </div>
      <p class="hint">${kind === "hooks" ? "Click a template or example to put it at the top of your post." : "Click a template or example to add it to the end of your post."} Replace the [brackets] with your own words.</p>
      <div id="lib-list">${items.map((item, i) => `
        <div class="lib-item" data-i="${i}" data-search="${escapeHtml((item.template + " " + item.examples.join(" ") + " " + item.tags.join(" ")).toLowerCase())}" data-tags="${item.tags.join(",")}">
          <button type="button" class="lib-template" data-insert="${escapeHtml(item.template)}">${escapeHtml(item.template).replace(/\n/g, "<br>")}</button>
          <div class="lib-tags">${item.tags.map((t) => `<span class="tag">${t}</span>`).join("")}</div>
          <details><summary>Examples</summary>
            ${item.examples.map((ex) => `<button type="button" class="lib-example" data-insert="${escapeHtml(ex)}">${escapeHtml(ex).replace(/\n/g, "<br>")}</button>`).join("")}
          </details>
        </div>`).join("")}</div>`;
  }

  function insertLibraryText(kind, text) {
    const current = textarea.value;
    if (kind === "hooks") {
      textarea.setSelectionRange(0, 0);
      replaceSelection(text + (current.trim() ? "\n\n" : ""), false);
      textarea.setSelectionRange(0, text.length);
    } else {
      textarea.setSelectionRange(current.length, current.length);
      const prefix = current.trim() ? (current.endsWith("\n\n") ? "" : current.endsWith("\n") ? "\n" : "\n\n") : "";
      replaceSelection(prefix + text, false);
      textarea.setSelectionRange(textarea.value.length - text.length, textarea.value.length);
    }
    textarea.focus();
  }

  async function renderSnippets(body) {
    body.innerHTML = `
      <button type="button" id="snip-save">Save selected text as a snippet</button>
      <p class="hint">Snippets are text you reuse: signatures, calls to action, dividers. Click one to insert it at your cursor.</p>
      <div id="snip-list" class="muted">Loading snippets...</div>`;
    $("#snip-save").addEventListener("click", saveSnippet);
    try {
      const snippets = await api("GET", "/api/snippets");
      snippets.sort((a, b) => (b.lastUsed || b.created).localeCompare(a.lastUsed || a.created));
      const list = body.querySelector("#snip-list");
      if (!list) return;
      list.classList.remove("muted");
      list.innerHTML = snippets.length ? snippets.map((s) => `
        <div class="snip">
          <button type="button" class="snip-use" data-id="${s.id}" data-insert="${escapeHtml(s.text)}"><strong>${escapeHtml(s.name)}</strong><span>${escapeHtml(s.text.slice(0, 120))}</span></button>
          <button type="button" class="snip-del secondary small" data-id="${s.id}" title="Move to Notion trash">Delete</button>
        </div>`).join("") : `<p class="muted">No snippets yet. Select some text in your post, then click the button above.</p>`;
      list.querySelectorAll(".snip-use").forEach((b) => b.addEventListener("click", () => {
        replaceSelection(b.dataset.insert, false);
        api("POST", `/api/snippets/${b.dataset.id}/used`).catch(() => {});
      }));
      list.querySelectorAll(".snip-del").forEach((b) => b.addEventListener("click", async () => {
        if (!confirm("Delete this snippet? It goes to Notion's trash, where you can restore it.")) return;
        await api("DELETE", `/api/snippets/${b.dataset.id}`).catch((e) => showError(e.message));
        if (tab === "snippets") renderSide();
      }));
    } catch (error) {
      body.querySelector("#snip-list").textContent = error.message;
    }
  }

  async function saveSnippet() {
    const text = selectedText();
    if (!text.trim()) return showError("Select some text in your post first.");
    const name = prompt("Name this snippet:", TextKit.toPlain(text).split("\n")[0].slice(0, 40));
    if (name === null) return;
    try {
      await api("POST", "/api/snippets", { name, text });
      if (tab === "snippets") renderSide();
    } catch (error) {
      showError(error.message);
    }
  }

  function wireSide(body) {
    body.querySelectorAll("[data-device]").forEach((b) => b.addEventListener("click", () => { device = b.dataset.device; renderSide(); }));
    body.querySelectorAll("[data-theme-btn]").forEach((b) => b.addEventListener("click", () => { theme = b.dataset.themeBtn; renderSide(); }));
    body.querySelector("#see-more")?.addEventListener("click", () => { expanded = true; renderSide(); });
    body.querySelector("#see-less")?.addEventListener("click", () => { expanded = false; renderSide(); });
    body.querySelector("#copy-text")?.addEventListener("click", async (e) => {
      try {
        await navigator.clipboard.writeText(textarea.value);
        e.target.textContent = "Copied";
      } catch {
        textarea.select();
        e.target.textContent = "Press Ctrl/Cmd+C";
      }
      setTimeout(() => { e.target.textContent = "Copy text"; }, 1500);
    });
    body.querySelector("#edit-profile")?.addEventListener("click", () => {
      const name = prompt("Name shown in the preview:", previewProfile.name || "Ritesh Naik");
      if (name === null) return;
      const headline = prompt("Headline shown in the preview:", previewProfile.headline || "Business Analytics | AI | FP&A");
      if (headline === null) return;
      Object.assign(previewProfile, { name, headline });
      try { localStorage.setItem("previewProfile", JSON.stringify(previewProfile)); } catch {}
      renderSide();
    });

    const filter = body.querySelector("#lib-filter");
    const tagSel = body.querySelector("#lib-tag");
    const applyFilter = () => {
      const q = filter.value.trim().toLowerCase();
      const t = tagSel.value;
      body.querySelectorAll(".lib-item").forEach((el) => {
        el.hidden = (q && !el.dataset.search.includes(q)) || (t && !el.dataset.tags.split(",").includes(t));
      });
    };
    filter?.addEventListener("input", applyFilter);
    tagSel?.addEventListener("change", applyFilter);
    body.querySelectorAll(".lib-template, .lib-example").forEach((b) =>
      b.addEventListener("click", () => insertLibraryText(tab, b.dataset.insert)));
  }

  // ----- Save -----

  async function save() {
    const button = $("#e-save");
    const data = {
      title: $("#e-title").value.trim() || TextKit.toPlain(textarea.value).split("\n").find((l) => l.trim())?.slice(0, 90) || "",
      platform: platformSel.value,
      status: $("#e-status").value,
      scheduledFor: fromInputValue($("#e-when").value),
      text: textarea.value,
    };
    if (!data.title) return showError("Give the post a title, or write a first line.");
    if (data.status === "Scheduled" && !data.scheduledFor) return showError("Pick a date and time for a scheduled post.");
    button.disabled = true;
    button.textContent = "Saving...";
    try {
      let saved;
      if (editingId) {
        saved = await api("PATCH", `/api/posts/${editingId}`, data);
        posts = (posts || []).map((p) => (p.id === editingId ? saved : p));
      } else {
        saved = await api("POST", "/api/posts", data);
        posts = [saved, ...(posts || [])];
        editingId = saved.id;
        history.replaceState(null, "", `#editor/${saved.id}`);
        currentHash = location.hash;
      }
      $("#e-title").value = saved.title;
      dirty = false;
      leaveGuard = null;
      button.textContent = "Saved";
      setTimeout(() => { button.textContent = "Save"; }, 1500);
    } catch (error) {
      showError(error.message);
      button.textContent = "Save";
    } finally {
      button.disabled = false;
    }
  }

  $("#e-save").addEventListener("click", save);
  renderStats();
  renderSide();
  textarea.focus();
}

// ---------- AI Writer ----------

const writerState = (() => {
  try { return JSON.parse(sessionStorage.getItem("writerState")) || {}; } catch { return {}; }
})();
function rememberWriter() {
  try { sessionStorage.setItem("writerState", JSON.stringify(writerState)); } catch {}
}

async function showWriter() {
  const purposes = { "": "Let the Writer decide", view: "Sharing a view", "how-to": "Teaching how to do something", built: "Sharing something built", story: "Telling a story", milestone: "A milestone, framed around an insight" };
  const form = writerState.form || { idea: "", purpose: "", facts: "", platforms: ["LinkedIn", "X"] };
  content.innerHTML = `
    <h1>Writer</h1>
    <p class="muted" id="w-status">Drafts LinkedIn and X posts in your voice, using your Persona Guide, your best-performing posts and the hooks library.</p>
    <div class="writer">
      <section class="writer-form">
        <label>Idea
          <textarea id="w-idea" rows="5" placeholder="What's the post about? A sentence or a rough paragraph is enough.">${escapeHtml(form.idea)}</textarea>
        </label>
        <label>Purpose
          <select id="w-purpose">${Object.entries(purposes).map(([k, v]) => `<option value="${k}" ${k === form.purpose ? "selected" : ""}>${v}</option>`).join("")}</select>
        </label>
        <label>Facts to use
          <textarea id="w-facts" rows="4" placeholder="Numbers, names, results, links. Anything not here becomes a [fact needed] placeholder, never a made-up fact.">${escapeHtml(form.facts)}</textarea>
        </label>
        <div class="checks-row">
          ${["LinkedIn", "X"].map((p) => `<label class="check"><input type="checkbox" value="${p}" ${form.platforms.includes(p) ? "checked" : ""} /> ${p}</label>`).join("")}
        </div>
        <button type="button" id="w-go">Write drafts</button>
        <p class="error" id="w-error" hidden></p>
      </section>
      <section id="w-result"></section>
    </div>`;

  const $ = (sel) => content.querySelector(sel);
  api("GET", "/api/writer/status").then((s) => {
    if (!s.connected) {
      $("#w-status").innerHTML = `<span class="error">The Writer isn't connected yet.</span> Add <code>ANTHROPIC_API_KEY</code> in cPanel (Node.js app &rarr; Environment variables), then Save and Restart.`;
    }
  }).catch(() => {});

  const readForm = () => ({
    idea: $("#w-idea").value,
    purpose: $("#w-purpose").value,
    facts: $("#w-facts").value,
    platforms: [...content.querySelectorAll(".check input:checked")].map((i) => i.value),
  });
  content.querySelectorAll("#w-idea, #w-facts, #w-purpose, .check input").forEach((el) =>
    el.addEventListener("input", () => { writerState.form = readForm(); rememberWriter(); }));

  if (writerState.result) renderWriterResult(writerState.result);

  $("#w-go").addEventListener("click", async () => {
    const f = readForm();
    writerState.form = f;
    rememberWriter();
    const errorBox = $("#w-error");
    errorBox.hidden = true;
    if (!f.idea.trim()) { errorBox.textContent = "Write the idea first."; errorBox.hidden = false; return; }
    if (!f.platforms.length) { errorBox.textContent = "Pick LinkedIn, X, or both."; errorBox.hidden = false; return; }
    const hooks = LIBRARY.hooks.filter((h) => !f.purpose || h.tags[0] === f.purpose).slice(0, 15).map((h) => h.template);
    const button = $("#w-go");
    button.disabled = true;
    button.textContent = "Writing... (about 30 to 60 seconds)";
    $("#w-result").innerHTML = "";
    try {
      const result = await api("POST", "/api/writer/draft", { ...f, hooks });
      result.platforms = f.platforms;
      writerState.result = result;
      rememberWriter();
      renderWriterResult(result);
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
    } finally {
      button.disabled = false;
      button.textContent = "Write drafts";
    }
  });
}

function renderWriterResult(r) {
  const box = document.getElementById("w-result");
  if (!box) return;
  const xLen = [...(r.x || "")].length;
  box.innerHTML = `
    ${r.linkedin ? `
    <div class="draft-card">
      <div class="draft-head"><span class="badge li">LinkedIn</span><span class="muted">${[...r.linkedin].length.toLocaleString()} / 3,000 characters</span></div>
      <div class="draft-text" id="w-li">${escapeHtml(r.linkedin)}</div>
      ${r.alternateHooks?.length ? `<div class="alt-hooks"><strong>Alternate hooks</strong>${r.alternateHooks.map((h, i) => `
        <div class="alt"><span>${escapeHtml(h)}</span><button type="button" class="secondary small" data-alt="${i}">Use this hook</button></div>`).join("")}</div>` : ""}
      <button type="button" data-save="LinkedIn">Save as draft and open in Editor</button>
    </div>` : ""}
    ${r.x ? `
    <div class="draft-card">
      <div class="draft-head"><span class="badge x">X</span><span class="${xLen > 280 ? "error" : "muted"}">${xLen} / 280 characters</span></div>
      <div class="draft-text">${escapeHtml(r.x)}</div>
      ${r.xNote ? `<p class="hint">${escapeHtml(r.xNote)}</p>` : ""}
      <button type="button" data-save="X">Save as draft and open in Editor</button>
    </div>` : ""}
    <div class="draft-card notes">
      <strong>Facts to verify</strong>
      ${r.factsToVerify?.length ? `<ul>${r.factsToVerify.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>` : `<p class="muted">None.</p>`}
      <strong>Checks</strong>
      <p class="muted">${escapeHtml(r.checks || "")}</p>
      ${r.platforms?.length > 1 && r.linkedin && r.x ? `<button type="button" class="secondary" data-save="both">Save both as drafts</button>` : ""}
    </div>`;

  // Swap the LinkedIn opening (everything before the first blank line) for an alternate hook
  box.querySelectorAll("[data-alt]").forEach((b) => b.addEventListener("click", () => {
    const alt = r.alternateHooks[Number(b.dataset.alt)];
    const rest = r.linkedin.includes("\n\n") ? r.linkedin.slice(r.linkedin.indexOf("\n\n")) : "";
    r.alternateHooks[Number(b.dataset.alt)] = r.linkedin.split("\n\n")[0];
    r.linkedin = alt + rest;
    rememberWriter();
    renderWriterResult(r);
  }));

  const saveDraft = (platform) => api("POST", "/api/posts", {
    title: platform === "X" ? `${r.title} (X)` : r.title,
    platform, status: "Draft", text: platform === "X" ? r.x : r.linkedin,
  });

  box.querySelectorAll("[data-save]").forEach((b) => b.addEventListener("click", async () => {
    b.disabled = true;
    b.textContent = "Saving...";
    try {
      if (b.dataset.save === "both") {
        const [li] = await Promise.all([saveDraft("LinkedIn"), saveDraft("X")]);
        posts = null;
        location.hash = `#editor/${li.id}`;
      } else {
        const saved = await saveDraft(b.dataset.save);
        posts = null;
        location.hash = `#editor/${saved.id}`;
      }
    } catch (error) {
      b.disabled = false;
      b.textContent = error.message;
    }
  }));
}

// ---------- Ideas (inspiration engine) ----------

const ideasState = (() => {
  try { return JSON.parse(sessionStorage.getItem("ideasState")) || {}; } catch { return {}; }
})();
function rememberIdeas() {
  try { sessionStorage.setItem("ideasState", JSON.stringify(ideasState)); } catch {}
}

const PURPOSE_LABELS = { view: "Sharing a view", "how-to": "How-to", built: "Built something", story: "Story", milestone: "Milestone" };

// Saved ideas live in Notion as posts with status Idea; their notes use these labeled lines.
function ideaNotes(idea) {
  return [
    `Angle: ${idea.angle}`,
    `Opening: ${idea.opening.replace(/\n/g, " / ")}`,
    `Purpose: ${idea.purpose}`,
    `Pillar: ${idea.pillar}`,
    idea.bring ? `Bring: ${idea.bring}` : "",
  ].filter(Boolean).join("\n");
}
function readIdeaNotes(post) {
  const get = (label) => (post.text.match(new RegExp(`^${label}: (.*)$`, "m")) || [])[1] || "";
  return { title: post.title, angle: get("Angle") || post.text, opening: get("Opening").replace(/ \/ /g, "\n"), purpose: get("Purpose"), bring: get("Bring") };
}

// Hands an idea to the Writer, ready to draft.
function writeIdea(idea) {
  writerState.form = {
    idea: [idea.title, idea.angle, idea.opening ? `Possible opening:\n${idea.opening}` : ""].filter(Boolean).join("\n\n"),
    purpose: PURPOSE_LABELS[idea.purpose] ? idea.purpose : "",
    facts: idea.bring ? `[Add this before drafting: ${idea.bring}]` : "",
    platforms: ["LinkedIn", "X"],
  };
  delete writerState.result;
  rememberWriter();
  location.hash = "#writer";
}

async function showIdeas() {
  const form = ideasState.form || { pillar: "", nudge: "" };
  content.innerHTML = `
    <h1>Ideas</h1>
    <p class="muted" id="i-status">Fresh post ideas from your content pillars, your point of view and what has worked for you. Save the good ones, or send one straight to the Writer.</p>
    <section class="idea-form">
      <label>Pillar
        <select id="i-pillar"><option value="">Any pillar</option></select>
      </label>
      <label class="grow">Nudge (optional)
        <input id="i-nudge" type="text" maxlength="1000" placeholder="Something on your mind today, e.g. month-end close, a tool you tried, a question someone asked" value="${escapeHtml(form.nudge)}" />
      </label>
      <button type="button" id="i-go">Give me ideas</button>
    </section>
    <p class="error" id="i-error" hidden></p>
    <div class="idea-grid" id="i-results"></div>
    <h2>Saved ideas</h2>
    <p class="muted" id="i-saved-status">Loading...</p>
    <div class="idea-grid" id="i-saved"></div>`;

  const $ = (sel) => content.querySelector(sel);
  api("GET", "/api/ideas/pillars").then((s) => {
    $("#i-pillar").insertAdjacentHTML("beforeend", s.pillars.map((p) =>
      `<option value="${escapeHtml(p)}" ${p === form.pillar ? "selected" : ""}>${escapeHtml(p)}</option>`).join(""));
    if (!s.connected) $("#i-status").innerHTML = `<span class="error">Ideas need the Claude connection.</span> Add <code>ANTHROPIC_API_KEY</code> in cPanel.`;
  }).catch(() => {});

  const readForm = () => ({ pillar: $("#i-pillar").value, nudge: $("#i-nudge").value });
  ["#i-pillar", "#i-nudge"].forEach((sel) => $(sel).addEventListener("input", () => { ideasState.form = readForm(); rememberIdeas(); }));

  renderIdeaResults();
  renderSavedIdeas();

  $("#i-go").addEventListener("click", async () => {
    const f = readForm();
    ideasState.form = f;
    const button = $("#i-go");
    const errorBox = $("#i-error");
    errorBox.hidden = true;
    button.disabled = true;
    button.textContent = "Thinking... (about 30 seconds)";
    try {
      const result = await api("POST", "/api/ideas/generate", { ...f, count: 8 });
      ideasState.results = result.ideas;
      rememberIdeas();
      renderIdeaResults();
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
    } finally {
      button.disabled = false;
      button.textContent = "Give me ideas";
    }
  });
}

function ideaCard(idea, actions) {
  return `
    <article class="idea-card">
      <div class="idea-tags">
        ${idea.pillar ? `<span class="chip">${escapeHtml(idea.pillar)}</span>` : ""}
        ${PURPOSE_LABELS[idea.purpose] ? `<span class="chip soft">${PURPOSE_LABELS[idea.purpose]}</span>` : ""}
      </div>
      <h3>${escapeHtml(idea.title)}</h3>
      ${idea.opening ? `<blockquote>${escapeHtml(idea.opening)}</blockquote>` : ""}
      <p>${escapeHtml(idea.angle)}</p>
      ${idea.why ? `<p class="muted small">Why now: ${escapeHtml(idea.why)}</p>` : ""}
      ${idea.bring ? `<p class="bring"><strong>You bring:</strong> ${escapeHtml(idea.bring)}</p>` : ""}
      <div class="idea-actions">${actions}</div>
    </article>`;
}

function renderIdeaResults() {
  const box = document.getElementById("i-results");
  if (!box) return;
  const ideas = ideasState.results || [];
  box.innerHTML = ideas.map((idea, i) => ideaCard(idea, `
    <button type="button" data-write="${i}">Write it</button>
    <button type="button" class="secondary" data-keep="${i}" ${idea.saved ? "disabled" : ""}>${idea.saved ? "Saved" : "Save idea"}</button>
    <button type="button" class="ghost" data-drop="${i}">Not for me</button>`)).join("");

  box.querySelectorAll("[data-write]").forEach((b) => b.addEventListener("click", () => writeIdea(ideas[Number(b.dataset.write)])));
  box.querySelectorAll("[data-drop]").forEach((b) => b.addEventListener("click", () => {
    ideas.splice(Number(b.dataset.drop), 1);
    rememberIdeas();
    renderIdeaResults();
  }));
  box.querySelectorAll("[data-keep]").forEach((b) => b.addEventListener("click", async () => {
    const idea = ideas[Number(b.dataset.keep)];
    b.disabled = true;
    b.textContent = "Saving...";
    try {
      await api("POST", "/api/posts", { title: idea.title, status: "Idea", platform: null, text: ideaNotes(idea) });
      idea.saved = true;
      rememberIdeas();
      posts = null;
      renderIdeaResults();
      renderSavedIdeas();
    } catch (error) {
      b.disabled = false;
      b.textContent = error.message;
    }
  }));
}

async function renderSavedIdeas() {
  const box = document.getElementById("i-saved");
  const status = document.getElementById("i-saved-status");
  if (!box) return;
  try {
    const saved = (await loadPosts(true)).filter((p) => p.status === "Idea");
    if (!document.getElementById("i-saved")) return;
    status.textContent = saved.length ? "These also appear in the Idea column of the Content Board." : "No saved ideas yet.";
    box.innerHTML = saved.map((p) => ideaCard(readIdeaNotes(p), `
      <button type="button" data-write-saved="${p.id}">Write it</button>
      <a class="button secondary" href="#editor/${p.id}">Open</a>`)).join("");
    box.querySelectorAll("[data-write-saved]").forEach((b) => b.addEventListener("click", () =>
      writeIdea(readIdeaNotes(saved.find((p) => p.id === b.dataset.writeSaved)))));
  } catch (error) {
    status.textContent = error.message;
  }
}

// ---------- Import (one-time loading of past posts) ----------

function showImport() {
  content.innerHTML = `
    <h1>Import Posts</h1>
    <p class="muted">Paste a list of past posts in JSON format to add them to Notion. Posts already there (same post link) are skipped, so importing twice is safe.</p>
    <textarea id="imp-text" class="import-box" placeholder='{"posts": [ ... ]}'></textarea>
    <p><button type="button" id="imp-go">Import</button> <span id="imp-status" class="muted"></span></p>`;
  document.getElementById("imp-go").addEventListener("click", async () => {
    const status = document.getElementById("imp-status");
    let payload;
    try {
      payload = JSON.parse(document.getElementById("imp-text").value);
      if (Array.isArray(payload)) payload = { posts: payload };
    } catch {
      status.textContent = "That isn't valid JSON.";
      return;
    }
    status.textContent = `Importing ${payload.posts?.length ?? 0} posts. This takes about a second per post...`;
    try {
      const result = await api("POST", "/api/posts/import", payload);
      status.textContent = `Done: ${result.added} added, ${result.skipped} already there.`;
      posts = null;
    } catch (error) {
      status.textContent = error.message;
    }
  });
}

// ---------- Sections and navigation ----------

const placeholders = {
  swipes:    { title: "Swipe Library", text: "Posts you've saved because you like them." },
  calendar:  { title: "Calendar",      text: "What's going out, and when." },
  analytics: { title: "Analytics",     text: "How each post performed." },
};

let currentHash = location.hash;

function show() {
  const [key, id] = location.hash.slice(1).split("/");
  const section = key || "board";
  document.querySelectorAll(".sidebar a").forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === "#" + section);
  });
  if (section === "editor") return showEditor(id);
  if (section === "import") return showImport();
  if (section === "writer") return showWriter();
  if (section === "ideas") return showIdeas();
  if (placeholders[section]) {
    content.innerHTML = `<h1>${placeholders[section].title}</h1><p class="muted">${placeholders[section].text} Not built yet.</p>`;
    return;
  }
  showBoard();
}

window.addEventListener("hashchange", () => {
  if (leaveGuard && !leaveGuard()) {
    history.replaceState(null, "", currentHash); // stay on the editor
    return;
  }
  leaveGuard = null;
  currentHash = location.hash;
  show();
});
window.addEventListener("beforeunload", (e) => {
  if (leaveGuard) e.preventDefault();
});

// Keeps the board current with edits made in Notion: refresh quietly when you come back
// to this tab, and when you click Content Board while already on it.
let lastRefresh = 0;
async function refreshBoard() {
  if (!document.getElementById("board") || Date.now() - lastRefresh < 3000) return;
  lastRefresh = Date.now();
  try {
    await loadPosts(true);
    renderColumns();
  } catch { /* keep showing what we have */ }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshBoard();
});
window.addEventListener("focus", refreshBoard);
document.querySelectorAll('.sidebar a[href="#board"]').forEach((link) =>
  link.addEventListener("click", () => {
    if ((location.hash || "#board") === "#board") { lastRefresh = 0; refreshBoard(); }
  }));
show();
