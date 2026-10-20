// Talks to Notion's API on behalf of the app.
// Every post is one row in the "Posts" database on the Social Media Studio page.

const API_BASE = process.env.NOTION_API_BASE || "https://api.notion.com/v1";
const NOTION_VERSION = "2025-09-03";

// The Posts database's data source ID. Not a secret: it only works together with NOTION_TOKEN.
const POSTS_DATA_SOURCE_ID =
  process.env.NOTION_POSTS_DATA_SOURCE_ID || "c5c2b799-4286-4124-a006-4dbb0170cc94";

export const STATUSES = ["Idea", "Draft", "Scheduled", "Published"];
export const PLATFORMS = ["LinkedIn", "X"];

async function notion(method, path, body) {
  const response = await fetch(API_BASE + path, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `Notion returned ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

// ---------- Converting between Notion's format and the app's simple format ----------

function plainText(richText = []) {
  return richText.map((part) => part.plain_text ?? part.text?.content ?? "").join("");
}

// Notion limits each text piece to 2,000 characters, so long posts are split into pieces.
function toRichText(text = "") {
  const pieces = [];
  for (let i = 0; i < text.length; i += 2000) {
    pieces.push({ type: "text", text: { content: text.slice(i, i + 2000) } });
  }
  return pieces;
}

function fromNotion(page) {
  const p = page.properties;
  return {
    id: page.id,
    title: plainText(p.Title?.title),
    platform: p.Platform?.select?.name || null,
    status: p.Status?.select?.name || "Idea",
    text: plainText(p.Text?.rich_text),
    scheduledFor: p["Scheduled For"]?.date?.start || null,
    publishedAt: p["Published At"]?.date?.start || null,
    postUrl: p["Post URL"]?.url || null,
    created: page.created_time,
    notionUrl: page.url,
  };
}

// Only the fields that were sent get changed.
function toNotionProperties(post) {
  const props = {};
  if (post.title !== undefined) props.Title = { title: toRichText(post.title) };
  if (post.platform !== undefined) props.Platform = { select: post.platform ? { name: post.platform } : null };
  if (post.status !== undefined) props.Status = { select: { name: post.status } };
  if (post.text !== undefined) props.Text = { rich_text: toRichText(post.text) };
  if (post.scheduledFor !== undefined) {
    props["Scheduled For"] = { date: post.scheduledFor ? { start: post.scheduledFor } : null };
  }
  return props;
}

// ---------- What the app can do ----------

export async function listPosts() {
  const posts = [];
  let cursor;
  do {
    const data = await notion("POST", `/data_sources/${POSTS_DATA_SOURCE_ID}/query`, {
      sorts: [{ timestamp: "created_time", direction: "descending" }],
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    posts.push(...data.results.map(fromNotion));
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return posts;
}

export async function createPost(post) {
  const page = await notion("POST", "/pages", {
    parent: { type: "data_source_id", data_source_id: POSTS_DATA_SOURCE_ID },
    properties: toNotionProperties({ status: "Idea", ...post }),
  });
  return fromNotion(page);
}

export async function updatePost(id, changes) {
  const page = await notion("PATCH", `/pages/${id}`, {
    properties: toNotionProperties(changes),
  });
  return fromNotion(page);
}
