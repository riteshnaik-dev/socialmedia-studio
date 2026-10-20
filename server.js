// Social Media Studio: the web server.
// It serves the app's pages and keeps everything behind a single password.

import express from "express";
import crypto from "node:crypto";

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
app.use(express.json());

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
  res.json({ ok: true, time: new Date().toISOString() });
});

app.use(express.static("public"));

app.listen(PORT, () => {
  console.log(`Social Media Studio running at http://localhost:${PORT}`);
});
