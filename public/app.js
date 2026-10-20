// Social Media Studio: the code that runs in your browser.

const STATUSES = ["Idea", "Draft", "Scheduled", "Published"];
const LIMITS = { LinkedIn: 3000, X: 280 }; // Character limits for a standard post on each platform

const content = document.getElementById("content");
const editor = document.getElementById("editor");
const form = document.getElementById("editor-form");

let posts = [];
let platformFilter = "All";
let editingId = null; // null means the editor is creating a new post

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

// "2026-10-21T13:00:00.000Z" -> "Wed, Oct 21, 9:00 AM" in your own time zone
function formatDate(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  const hasTime = iso.includes("T");
  return date.toLocaleString(undefined, hasTime
    ? { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
    : { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

// Converts between the date box (local time) and the stored value (exact moment, with time zone)
function toInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
function fromInputValue(value) {
  return value ? new Date(value).toISOString() : null;
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
      <button type="button" id="new-post">+ New Post</button>
    </div>
    <p class="muted" id="board-status">Loading posts from Notion...</p>
    <div class="board" id="board"></div>`;

  content.querySelector("#new-post").addEventListener("click", () => openEditor(null));
  content.querySelectorAll(".filter").forEach((button) =>
    button.addEventListener("click", () => {
      platformFilter = button.dataset.platform;
      content.querySelectorAll(".filter").forEach((b) => b.classList.toggle("on", b === button));
      renderColumns();
    }));

  try {
    posts = await api("GET", "/api/posts");
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
    const cards = visible.filter((p) => p.status === status);
    return `
      <section class="column">
        <h2>${status} <span class="count">${cards.length}</span></h2>
        ${cards.map((post) => `
          <button type="button" class="card" data-id="${post.id}">
            <span class="badge ${post.platform === "X" ? "x" : "li"}">${escapeHtml(post.platform || "No platform")}</span>
            <strong>${escapeHtml(post.title || "Untitled")}</strong>
            ${post.text ? `<span class="snippet">${escapeHtml(post.text.slice(0, 140))}</span>` : ""}
            ${post.scheduledFor ? `<span class="when">${formatDate(post.scheduledFor)}</span>` : ""}
          </button>`).join("") || `<p class="empty">Nothing here yet.</p>`}
      </section>`;
  }).join("");

  board.querySelectorAll(".card").forEach((card) =>
    card.addEventListener("click", () => openEditor(posts.find((p) => p.id === card.dataset.id))));
}

// ---------- Post editor ----------

function updateCounter() {
  const limit = LIMITS[form.platform.value];
  const length = form.text.value.length;
  const counter = document.getElementById("counter");
  counter.textContent = `${length.toLocaleString()} / ${limit.toLocaleString()} characters`;
  counter.classList.toggle("over", length > limit);
}

function openEditor(post) {
  editingId = post?.id ?? null;
  document.getElementById("editor-heading").textContent = post ? "Edit Post" : "New Post";
  form.title.value = post?.title ?? "";
  form.platform.value = post?.platform ?? (platformFilter === "X" ? "X" : "LinkedIn");
  form.status.value = post?.status ?? "Idea";
  form.scheduledFor.value = toInputValue(post?.scheduledFor);
  form.text.value = post?.text ?? "";
  const link = document.getElementById("notion-link");
  link.hidden = !post?.notionUrl;
  if (post?.notionUrl) link.href = post.notionUrl;
  document.getElementById("editor-error").hidden = true;
  updateCounter();
  editor.showModal();
}

form.platform.addEventListener("change", updateCounter);
form.text.addEventListener("input", updateCounter);
document.getElementById("cancel").addEventListener("click", () => editor.close());

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const save = document.getElementById("save");
  const errorBox = document.getElementById("editor-error");
  const data = {
    title: form.title.value,
    platform: form.platform.value,
    status: form.status.value,
    scheduledFor: fromInputValue(form.scheduledFor.value),
    text: form.text.value,
  };
  save.disabled = true;
  save.textContent = "Saving...";
  try {
    if (editingId) {
      const updated = await api("PATCH", `/api/posts/${editingId}`, data);
      posts = posts.map((p) => (p.id === editingId ? updated : p));
    } else {
      posts = [await api("POST", "/api/posts", data), ...posts];
    }
    editor.close();
    renderColumns();
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.hidden = false;
  } finally {
    save.disabled = false;
    save.textContent = "Save";
  }
});

// ---------- Sections and navigation ----------

const placeholders = {
  ideas:     { title: "Ideas",         text: "Your idea inbox." },
  swipes:    { title: "Swipe Library", text: "Posts you've saved because you like them." },
  writer:    { title: "Writer",        text: "Drafts LinkedIn and X versions of an idea in your voice." },
  calendar:  { title: "Calendar",      text: "What's going out, and when." },
  analytics: { title: "Analytics",     text: "How each post performed." },
};

function show() {
  const key = location.hash.slice(1) || "board";
  document.querySelectorAll(".sidebar a").forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === "#" + (placeholders[key] ? key : "board"));
  });
  if (!placeholders[key]) return showBoard();
  const section = placeholders[key];
  content.innerHTML = `<h1>${section.title}</h1><p class="muted">${section.text} Not built yet.</p>`;
}

window.addEventListener("hashchange", show);
show();
