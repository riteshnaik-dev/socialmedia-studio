# Social Media Studio

A personal web app for planning, writing, scheduling and publishing posts to LinkedIn and X.

Built with Node.js and Express. Hosted on Spaceship (cPanel, Setup Node.js App) at https://studio.zeh.ai, with `app.cjs` as the startup file.

## Run it on your own computer

1. Install Node.js (version 20.6 or later).
2. Copy `.env.example` to `.env` and fill in the two values.
3. In this folder, run `npm install`, then `npm run dev`.
4. Open http://localhost:3000 and sign in with your password.

## Settings

| Name | What it is |
| --- | --- |
| `APP_PASSWORD` | The password used to sign in |
| `SESSION_SECRET` | A long random string that secures the sign-in cookie |
| `NOTION_TOKEN` | API token of the "Social Media Studio" Notion connection |
| `ANTHROPIC_API_KEY` | Claude API key for the Writer (from the Claude Console) |
| `ANTHROPIC_MODEL` | Optional. Defaults to `claude-opus-5-5` |

## Data

Posts live in the **Posts** database and reusable text in the **Snippets** database, both on the **Social Media Studio** page in Notion.
The Notion connection only has access to that page.

## Editor

- Formatting uses Unicode letters (bold, italic, code), combining marks (underline, strikethrough), lists and four staircase layouts. All of it survives copy and paste into LinkedIn or X.
- Hooks and endings live in `public/library.js`: original templates with [placeholders], tags and three examples each, aligned with the Persona Guide's approved hook formats and calls to action. Edit that file to add your own.
- Import Posts (sidebar) loads past posts with stats from JSON; posts with a link already in Notion are skipped.

## Writer

The Writer (`writer.js`) sends `voice/persona-guide.md` as a cached system prompt, the idea and facts, the matching hook templates and a few of your best-performing posts to the Claude API, and asks for a LinkedIn draft, an X version, two alternate hooks, facts to verify and checklist notes. Em dashes are removed as a final safety net.

`voice/persona-guide.md` is a copy of the Persona Guide in Google Drive (v1.0, Oct 15, 2026). When the guide changes, replace this file and redeploy.
