// Social Media Studio: the web server.
// It serves the app's pages and keeps everything behind a single password.

import express from "express";
import crypto from "node:crypto";
import {
  listPosts, createPost, updatePost, importPosts,
  listSnippets, createSnippet, markSnippetUsed, trashSnippet,
  STATUSES, PLATFORMS, POST_TYPES, STAT_FIELDS,
} from "./notion.js";

const app = express();
const PORT = process.env.PORT || 3000;
const APP_PASSWORD = process.env.APP_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!APP_PASSWORD || !SESSION_SECRET) {
  console.error("Missing APP_PASSWORD or SESSION_SECRET. See .env.example.");
  process.exit(1);
}

const COOKIE_NAME = "studio_session";
const SESSION_DAYS = 30;

app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: "2mb" })); // room for a one-time import of past posts

// ---------- Sign-in cookie helpers ----------
// The cookie holds an expiry time plus a signature made with SESSION_SECRET,
// so it can't be forged without knowing the secret.

function sign(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
}

function makeSessionCookie() {
  const expires = String(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  return `${expires}.${sign(expires)}`;
}

function isValidSession(cookieValue) {
  if (!cookieValue) return false;
  const [expires, signature] = cookieValue.split(".");
  if (!expires || !signature) return false;
  const expected = sign(expires);
  if (signature.length !== expected.length) return false;
  const matches = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  return matches && Number(expires) > Date.now();
}

function readCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function passwordMatches(attempt) {
  const a = crypto.createHash("sha256").update(String(attempt ?? "")).digest();
  const b = crypto.createHash("sha256").update(APP_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

// ---------- Public routes (no sign-in needed) ----------

app.get("/login", (req, res) => {
  res.sendFile("login.html", { root: "public" });
});

app.post("/login", async (req, res) => {
  if (passwordMatches(req.body.password)) {
    res.cookie(COOKIE_NAME, makeSessionCookie(), {
      httpOnly: true,
      sameSite: "lax",
      secure: req.secure || req.headers["x-forwarded-proto"] === "https",
      maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    });
    return res.redirect("/");
  }
  // Short pause on a wrong password slows down anyone guessing.
  await new Promise((resolve) => setTimeout(resolve, 1000));
  res.redirect("/login?error=1");
});

app.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.redirect("/login");
});

app.get("/styles.css", (req, res) => {
  res.sendFile("styles.css", { root: "public" });
});

// ---------- Everything below requires sign-in ----------

app.use((req, res, next) => {
  if (isValidSession(readCookie(req, COOKIE_NAME))) return next();
  if (req.path.startsWith("/api/")) return res.status(401).json({ error: "Not signed in" });
  res.redirect("/login");
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, notionConnected: Boolean(process.env.NOTION_TOKEN), time: new Date().toISOString() });
});

// ---------- Posts (stored in Notion) ----------

// Checks a post sent from the browser and keeps only the fields the app understands.
function cleanPost(body, { isNew }) {
  const post = {};
  if (body.title !== undefined) post.title = String(body.title).trim().slice(0, 200);
  if (body.text !== undefined) post.text = String(body.text).slice(0, 25000);
  if (body.platform !== undefined) {
    if (body.platform && !PLATFORMS.includes(body.platform)) throw new Error("Platform must be LinkedIn or X.");
    post.platform = body.platform || null;
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) throw new Error("Unknown status.");
    post.status = body.status;
  }
  if (body.scheduledFor !== undefined) {
    if (body.scheduledFor && Number.isNaN(Date.parse(body.scheduledFor))) throw new Error("Invalid date.");
    post.scheduledFor = body.scheduledFor || null;
  }
  if (isNew && !post.title) throw new Error("Give the post a title.");
  return post;
}

// Wraps a route so Notion problems come back as a clear message instead of crashing.
const notionRoute = (handler) => async (req, res) => {
  if (!process.env.NOTION_TOKEN) {
    return res.status(503).json({ error: "Notion isn't connected yet. Add NOTION_TOKEN in cPanel." });
  }
  try {
    await handler(req, res);
  } catch (error) {
    if (error.status) {
      console.error("Notion error:", error.status, error.message);
      return res.status(502).json({ error: `Notion said: ${error.message}` });
    }
    res.status(400).json({ error: error.message });
  }
};

app.get("/api/posts", notionRoute(async (req, res) => {
  res.json(await listPosts());
}));

app.post("/api/posts", notionRoute(async (req, res) => {
  res.status(201).json(await createPost(cleanPost(req.body, { isNew: true })));
}));

const isNotionId = (id) => /^[0-9a-f-]{32,36}$/i.test(id);

app.patch("/api/posts/:id", notionRoute(async (req, res) => {
  if (!isNotionId(req.params.id)) throw new Error("Invalid post ID.");
  res.json(await updatePost(req.params.id, cleanPost(req.body, { isNew: false })));
}));

// One-time import of past posts with their stats (for example, a LinkedIn history export).
// Posts already in Notion (same post link) are skipped, so running it twice is safe.
app.post("/api/posts/import", notionRoute(async (req, res) => {
  const rows = Array.isArray(req.body?.posts) ? req.body.posts : [];
  if (!rows.length || rows.length > 500) throw new Error("Send between 1 and 500 posts.");
  const posts = rows.map((row) => {
    const post = cleanPost({ ...row, status: row.status || "Published" }, { isNew: true });
    if (row.postType) {
      if (!POST_TYPES.includes(row.postType)) throw new Error(`Unknown post type: ${row.postType}`);
      post.postType = row.postType;
    }
    if (row.postUrl) {
      const url = new URL(row.postUrl);
      if (!["https:", "http:"].includes(url.protocol)) throw new Error("Invalid post link.");
      post.postUrl = url.href;
    }
    if (row.publishedAt) {
      if (Number.isNaN(Date.parse(row.publishedAt))) throw new Error("Invalid publish date.");
      post.publishedAt = row.publishedAt;
    }
    if (row.stats) {
      post.stats = {};
      for (const field of Object.keys(STAT_FIELDS)) {
        const value = row.stats[field];
        if (value === null || value === undefined) continue;
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(`Invalid ${field}.`);
        post.stats[field] = value;
      }
    }
    return post;
  });
  res.json(await importPosts(posts));
}));

// ---------- Snippets (stored in Notion) ----------

app.get("/api/snippets", notionRoute(async (req, res) => {
  res.json(await listSnippets());
}));

app.post("/api/snippets", notionRoute(async (req, res) => {
  const text = String(req.body.text ?? "").slice(0, 3000);
  const name = String(req.body.name ?? "").trim().slice(0, 100) || text.split("\n")[0].slice(0, 60);
  if (!text.trim()) throw new Error("Select some text first.");
  res.status(201).json(await createSnippet({ name, text }));
}));

app.post("/api/snippets/:id/used", notionRoute(async (req, res) => {
  if (!isNotionId(req.params.id)) throw new Error("Invalid snippet ID.");
  res.json(await markSnippetUsed(req.params.id));
}));

app.delete("/api/snippets/:id", notionRoute(async (req, res) => {
  if (!isNotionId(req.params.id)) throw new Error("Invalid snippet ID.");
  await trashSnippet(req.params.id);
  res.json({ ok: true });
}));

app.use(express.static("public"));

app.listen(PORT, () => {
  console.log(`Social Media Studio running at http://localhost:${PORT}`);
});
