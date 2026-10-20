// The AI Writer: drafts LinkedIn and X posts in Ritesh's voice using the Claude API.
// It sends the Persona Guide (cached, so repeat drafts cost less), the idea and facts,
// a few of his best-performing posts as real examples, and the matching hook templates.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_URL = process.env.ANTHROPIC_API_BASE || "https://api.anthropic.com/v1/messages";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const here = path.dirname(fileURLToPath(import.meta.url));
const GUIDE_PATH = path.join(here, "voice", "persona-guide.md");

export const PURPOSES = {
  view: "Sharing a view",
  "how-to": "Teaching how to do something",
  built: "Sharing something built",
  story: "Telling a story",
  milestone: "A milestone, framed around an insight",
};

function personaGuide() {
  return fs.readFileSync(GUIDE_PATH, "utf8");
}

const INSTRUCTIONS = `You draft social media posts for Ritesh Naik inside his personal content app.

The Persona Guide above is the source of truth. Follow it exactly, especially:
- Section 26 platform rules and Section 29 writing instructions.
- Never invent facts, numbers, results, hours, stories, quotes, or tool behavior. Use only what the request provides or what the Guide states. Where something is missing, write a placeholder like [fact needed: how many hours this saved] and list it in facts_to_verify.
- No em dashes anywhere. Not one. Use periods, colons, or line breaks.
- Exactly one call to action, from the approved list in Section 26.
- Run the Section 30 checklist before you submit and fix anything that fails.
- Work data is confidential: use general descriptions or clearly synthetic numbers unless the request says the detail is public.

LinkedIn: the hook must work in the first three lines (LinkedIn shows about three lines before "...more"). Short lines and white space. End with a principle line, then the one call to action.
X: a very short observation (under 280 characters) on the same idea, written for X, not a cut-down LinkedIn post. If the idea needs finance setup that doesn't fit on X, say so in x_note and still give the best short version you can.

You may use one of the provided hook templates, adapted, if it fits. Never copy example posts; they show his rhythm and what has performed well for him.

Return your work as JSON matching the required schema.`;

// The shape Claude must return (Claude API "structured outputs").
const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", description: "A short internal title for the post (max 80 characters)." },
    linkedin: { type: "string", description: "The LinkedIn post, exactly as it would be published. Empty string if LinkedIn was not requested." },
    alternate_hooks: { type: "array", items: { type: "string" }, description: "Two alternate openings for the LinkedIn post (first 1 to 3 lines only)." },
    x: { type: "string", description: "The X post, under 280 characters. Empty string if X was not requested." },
    x_note: { type: "string", description: "Optional note about the X version, or empty string." },
    facts_to_verify: { type: "array", items: { type: "string" }, description: "Every placeholder or assumption that Ritesh must confirm. Empty if none." },
    checks: { type: "string", description: "One or two lines: purpose and authority level used, and checklist result (passed, or the exceptions)." },
  },
  required: ["title", "linkedin", "alternate_hooks", "x", "x_note", "facts_to_verify", "checks"],
};

// Picks real posts to show as style examples: the strongest by engagement rate and by reach.
function examplePosts(posts) {
  const usable = posts.filter((p) =>
    p.status === "Published" && p.platform === "LinkedIn" && p.text && p.text.length > 150 &&
    !["Repost", "Other"].includes(p.postType) && (p.stats?.impressions ?? 0) >= 150);
  const byRate = [...usable].sort((a, b) => (b.stats.engagementRate ?? 0) - (a.stats.engagementRate ?? 0)).slice(0, 3);
  const byReach = [...usable].sort((a, b) => (b.stats.impressions ?? 0) - (a.stats.impressions ?? 0)).slice(0, 3);
  const chosen = [...new Map([...byRate, ...byReach].map((p) => [p.id, p])).values()].slice(0, 5);
  return chosen.map((p) => {
    const s = p.stats;
    const rate = s.engagementRate != null ? `${(s.engagementRate * 100).toFixed(1)}% engagement` : "";
    return `--- Published ${p.publishedAt?.slice(0, 10) ?? ""}: ${s.impressions} impressions${rate ? ", " + rate : ""}\n${p.text}`;
  }).join("\n\n");
}

export function buildRequest({ idea, purpose, facts, platforms, hooks, posts }) {
  const parts = [
    `IDEA:\n${idea}`,
    `PURPOSE: ${PURPOSES[purpose] || "Decide the best purpose from the idea"}`,
    `PLATFORMS REQUESTED: ${platforms.join(" and ")}`,
    `FACTS PROVIDED BY RITESH:\n${facts?.trim() || "None beyond the idea. Use placeholders for anything specific."}`,
  ];
  if (hooks.length) parts.push(`HOOK TEMPLATES THAT FIT THIS PURPOSE (optional):\n${hooks.map((h) => "- " + h.replace(/\n/g, " / ")).join("\n")}`);
  const examples = examplePosts(posts);
  if (examples) parts.push(`SOME OF HIS PUBLISHED LINKEDIN POSTS AND HOW THEY PERFORMED (for rhythm only; do not copy):\n\n${examples}`);
  return {
    model: MODEL,
    max_tokens: 4096,
    system: [
      { type: "text", text: personaGuide(), cache_control: { type: "ephemeral" } },
      { type: "text", text: INSTRUCTIONS },
    ],
    output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    messages: [{ role: "user", content: parts.join("\n\n") }],
  };
}

// The guide forbids em dashes; this is a final safety net in case one slips through.
function stripEmDashes(text) {
  return String(text ?? "")
    .replace(/\s*—\s*(\S)/g, (match, next) => ". " + next.toUpperCase())
    .replace(/\s*—/g, ".")
    .replace(/\.\s*\./g, ".");
}

// Sends one request to Claude and returns the parsed JSON answer plus usage details.
async function callClaude(body) {
  if (!process.env.ANTHROPIC_API_KEY) {
    const error = new Error("The Writer isn't connected yet. Add ANTHROPIC_API_KEY in cPanel.");
    error.code = "no_key";
    throw error;
  }
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(150000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error?.message || `Claude API returned ${response.status}`);
    error.status = response.status;
    throw error;
  }
  if (data.stop_reason === "refusal") throw new Error("Claude declined this one. Try rewording it.");
  if (data.stop_reason === "max_tokens") throw new Error("The answer ran too long and was cut off. Try again.");
  const block = data.content?.find((b) => b.type === "text");
  try {
    return { out: JSON.parse(block?.text ?? ""), data };
  } catch {
    throw new Error("Claude returned something unreadable. Try again.");
  }
}

export async function draftPost(input) {
  const { out, data } = await callClaude(buildRequest(input));
  return {
    title: stripEmDashes(out.title).slice(0, 90),
    linkedin: stripEmDashes(out.linkedin),
    alternateHooks: (out.alternate_hooks || []).map(stripEmDashes),
    x: stripEmDashes(out.x),
    xNote: stripEmDashes(out.x_note),
    factsToVerify: out.facts_to_verify || [],
    checks: stripEmDashes(out.checks),
    usage: data.usage || null,
    model: data.model || MODEL,
  };
}

// ---------- Idea generator ----------

// The content pillars, read straight from Section 10 of the Persona Guide so they stay in sync.
export function contentPillars() {
  const section = personaGuide().split(/^## 10\./m)[1]?.split(/^## /m)[0] ?? "";
  const pillars = [...section.matchAll(/^\d+\.\s+\*\*(.+?)\*\*/gm)].map((m) => m[1].replace(/\.$/, ""));
  return pillars.length ? pillars : ["AI in finance", "Judgment over information", "Finance data and systems", "Career and learning"];
}

const IDEA_INSTRUCTIONS = `You are the idea engine inside Ritesh Naik's personal content app. He opens it when he needs inspiration.

The Persona Guide above is the source of truth for who he is, what he writes about, his point of view, his boundaries and his authority levels.

Suggest post ideas he could genuinely write. Rules:
- Each idea must come from his real territory: his experience, beliefs and point of view in the Guide. Prefer specific, opinionated angles over generic topics.
- Never invent events, numbers, results or stories about him. If an idea needs a real example or number from him, say what he should bring in "bring".
- Respect Section 25 boundaries and Section 24 authority levels. Do not suggest leadership-authority posts.
- Do not repeat or lightly reword his recent posts or saved ideas listed in the request. Look for fresh angles, including follow-ups to what performed well.
- Mix the purposes across the set (view, how-to, built, story, milestone) unless the request focuses on one.
- The opening is the first one to three lines of the post as he might write it. It must work before LinkedIn's "...more" cut. No em dashes anywhere.

Return your work as JSON matching the required schema.`;

function ideasSchema(pillars) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      ideas: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string", description: "Short working title (max 70 characters)." },
            pillar: { type: "string", enum: pillars },
            purpose: { type: "string", enum: Object.keys(PURPOSES) },
            angle: { type: "string", description: "One or two sentences: the point the post makes." },
            opening: { type: "string", description: "The first one to three lines of the post." },
            why: { type: "string", description: "One sentence on why this fits him or his audience now." },
            bring: { type: "string", description: "The real detail, example or number he needs to supply. Empty if none." },
          },
          required: ["title", "pillar", "purpose", "angle", "opening", "why", "bring"],
        },
      },
    },
    required: ["ideas"],
  };
}

function recentContext(posts) {
  const published = posts.filter((p) => p.status === "Published" && p.text).slice(0, 30);
  const recent = published.map((p) => `- ${p.publishedAt?.slice(0, 10) ?? ""}: ${p.text.split("\n").find((l) => l.trim())?.slice(0, 140) ?? p.title}`).join("\n");
  const pending = posts.filter((p) => p.status !== "Published").slice(0, 40).map((p) => `- ${p.title}`).join("\n");
  return { recent, pending, examples: examplePosts(posts) };
}

export function buildIdeasRequest({ pillar, nudge, count, posts }) {
  const pillars = contentPillars();
  const { recent, pending, examples } = recentContext(posts);
  const parts = [
    `Suggest ${count} post ideas.`,
    pillar ? `FOCUS PILLAR: ${pillar}` : `PILLARS: spread the ideas across: ${pillars.join("; ")}`,
    nudge ? `HIS NUDGE FOR TODAY:\n${nudge}` : "",
    recent ? `HIS RECENT PUBLISHED POSTS (opening lines; don't repeat these):\n${recent}` : "",
    pending ? `IDEAS AND DRAFTS ALREADY IN HIS PIPELINE (don't repeat these):\n${pending}` : "",
    examples ? `HIS BEST-PERFORMING POSTS (what resonates with his audience):\n\n${examples}` : "",
  ].filter(Boolean);
  return {
    model: MODEL,
    max_tokens: 6000,
    system: [
      { type: "text", text: personaGuide(), cache_control: { type: "ephemeral" } },
      { type: "text", text: IDEA_INSTRUCTIONS },
    ],
    output_config: { format: { type: "json_schema", schema: ideasSchema(pillars) } },
    messages: [{ role: "user", content: parts.join("\n\n") }],
  };
}

export async function generateIdeas(input) {
  const { out, data } = await callClaude(buildIdeasRequest(input));
  const clean = (s) => stripEmDashes(s).trim();
  return {
    ideas: (out.ideas || []).map((i) => ({
      title: clean(i.title).slice(0, 90), pillar: i.pillar, purpose: i.purpose,
      angle: clean(i.angle), opening: clean(i.opening), why: clean(i.why), bring: clean(i.bring),
    })),
    usage: data.usage || null,
  };
}
