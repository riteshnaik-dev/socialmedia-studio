// Talks to Notion's API on behalf of the app.
// Posts and Snippets are rows in two databases on the Social Media Studio page.

const API_BASE = process.env.NOTION_API_BASE || "https://api.notion.com/v1";
const NOTION_VERSION = "2025-09-03";

// Data source IDs of the two databases. Not secrets: they only work together with NOTION_TOKEN.
const POSTS_DATA_SOURCE_ID =
  process.env.NOTION_POSTS_DATA_SOURCE_ID || "c5c2b799-4286-4124-a006-4dbb0170cc94";
const SNIPPETS_DATA_SOURCE_ID =
  process.env.NOTION_SNIPPETS_DATA_SOURCE_ID || "77837590-b596-443d-a2b9-cd52396c4462";

export const STATUSES = ["Idea", "Draft", "Scheduled", "Published"];
export const PLATFORMS = ["LinkedIn", "X"];
export const POST_TYPES = ["Text", "Image", "Document", "Video", "Article", "Poll", "Repost", "Other"];

// Post stats: app field name -> Notion column name
export const STAT_FIELDS = {
  impressions: "Impressions",
  membersReached: "Members Reached",
  reactions: "Reactions",
  comments: "Comments",
  reposts: "Reposts",
  saves: "Saves",
  sends: "Sends",
  profileViews: "Profile Views",
  followersGained: "Followers Gained",
  linkClicks: "Link Clicks",
  engagementRate: "Engagement Rate",
};

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

async function queryAll(dataSourceId, sorts) {
  const rows = [];
  let cursor;
  do {
    const data = await notion("POST", `/data_sources/${dataSourceId}/query`, {
      sorts,
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    rows.push(...data.results);
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return rows;
}

// ---------- Converting between Notion's format and the app's simple format ----------

function plainText(richText = []) {
  return richText.map((part) => part.plain_text ?? part.text?.content ?? "").join("");
}

// Notion limits each text piece to 2,000 characters, so long text is split into pieces.
function toRichText(text = "") {
  const pieces = [];
  for (let i = 0; i < text.length; i += 2000) {
    pieces.push({ type: "text", text: { content: text.slice(i, i + 2000) } });
  }
  return pieces;
}

function fromNotion(page) {
  const p = page.properties;
  const stats = {};
  for (const [field, column] of Object.entries(STAT_FIELDS)) stats[field] = p[column]?.number ?? null;
  return {
    id: page.id,
    title: plainText(p.Title?.title),
    platform: p.Platform?.select?.name || null,
    status: p.Status?.select?.name || "Idea",
    postType: p["Post Type"]?.select?.name || null,
    text: plainText(p.Text?.rich_text),
    scheduledFor: p["Scheduled For"]?.date?.start || null,
    publishedAt: p["Published At"]?.date?.start || null,
    postUrl: p["Post URL"]?.url || null,
    stats,
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
  if (post.postType !== undefined) props["Post Type"] = { select: post.postType ? { name: post.postType } : null };
  if (post.text !== undefined) props.Text = { rich_text: toRichText(post.text) };
  if (post.postUrl !== undefined) props["Post URL"] = { url: post.postUrl || null };
  if (post.scheduledFor !== undefined) {
    props["Scheduled For"] = { date: post.scheduledFor ? { start: post.scheduledFor } : null };
  }
  if (post.publishedAt !== undefined) {
    props["Published At"] = { date: post.publishedAt ? { start: post.publishedAt } : null };
  }
  if (post.stats) {
    for (const [field, column] of Object.entries(STAT_FIELDS)) {
      if (post.stats[field] !== undefined) props[column] = { number: post.stats[field] };
    }
  }
  return props;
}

// ---------- Posts ----------

export async function listPosts() {
  const pages = await queryAll(POSTS_DATA_SOURCE_ID, [{ timestamp: "created_time", direction: "descending" }]);
  return pages.map(fromNotion);
}

export async function createPost(post) {
  const page = await notion("POST", "/pages", {
    parent: { type: "data_source_id", data_source_id: POSTS_DATA_SOURCE_ID },
    properties: toNotionProperties({ status: "Idea", ...post }),
  });
  return fromNotion(page);
}

export async function updatePost(id, changes) {
  const page = await notion("PATCH", `/pages/${id}`, { properties: toNotionProperties(changes) });
  return fromNotion(page);
}

// Adds posts that aren't already there (matched by their post link). Returns counts.
export async function importPosts(posts) {
  const existing = new Set((await listPosts()).map((p) => p.postUrl).filter(Boolean));
  let added = 0;
  let skipped = 0;
  for (const post of posts) {
    if (post.postUrl && existing.has(post.postUrl)) {
      skipped++;
      continue;
    }
    await createPost(post);
    if (post.postUrl) existing.add(post.postUrl);
    added++;
    await new Promise((resolve) => setTimeout(resolve, 350)); // stays under Notion's ~3 requests/second
  }
  return { added, skipped };
}

// ---------- Snippets ----------

function snippetFromNotion(page) {
  const p = page.properties;
  return {
    id: page.id,
    name: plainText(p.Name?.title),
    text: plainText(p.Text?.rich_text),
    lastUsed: p["Last Used"]?.date?.start || null,
    created: page.created_time,
  };
}

export async function listSnippets() {
  const pages = await queryAll(SNIPPETS_DATA_SOURCE_ID, [{ timestamp: "created_time", direction: "descending" }]);
  return pages.map(snippetFromNotion);
}

export async function createSnippet({ name, text }) {
  const page = await notion("POST", "/pages", {
    parent: { type: "data_source_id", data_source_id: SNIPPETS_DATA_SOURCE_ID },
    properties: { Name: { title: toRichText(name) }, Text: { rich_text: toRichText(text) } },
  });
  return snippetFromNotion(page);
}

export async function markSnippetUsed(id) {
  const page = await notion("PATCH", `/pages/${id}`, {
    properties: { "Last Used": { date: { start: new Date().toISOString() } } },
  });
  return snippetFromNotion(page);
}

// Moves a snippet to Notion's trash (it can be restored from there).
export async function trashSnippet(id) {
  await notion("PATCH", `/pages/${id}`, { in_trash: true });
}
