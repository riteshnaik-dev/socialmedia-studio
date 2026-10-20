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

Submit your work with the submit_drafts tool.`;

const TOOL = {
  name: "submit_drafts",
  description: "Submit the finished drafts.",
  input_schema: {
    type: "object",
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
  },
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
    tools: [TOOL],
    tool_choice: { type: "tool", name: "submit_drafts" },
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

export async function draftPost(input) {
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
    body: JSON.stringify(buildRequest(input)),
    signal: AbortSignal.timeout(150000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error?.message || `Claude API returned ${response.status}`);
    error.status = response.status;
    throw error;
  }
  const call = data.content?.find((block) => block.type === "tool_use" && block.name === "submit_drafts");
  if (!call) throw new Error("The Writer didn't return a draft. Try again.");
  const out = call.input;
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
