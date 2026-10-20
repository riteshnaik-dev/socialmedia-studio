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
