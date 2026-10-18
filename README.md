# Tartışıyoruz

A Turkish-first social polling application built with React, TypeScript, Vite, and Supabase. GitHub Pages serves a static frontend. The application runs in a clearly labelled local demo mode until a dedicated Supabase project is configured; demo votes and comments remain on the current device and are not shared across users or devices.

## Local development

Requires Node.js 22 and pnpm 11.25.0. Copy `.env.example` to `.env.local`, leave the Supabase values blank for demo mode, then run:

```sh
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install
pnpm dev
```

Run `pnpm typecheck` and `pnpm build` before publishing.

## Supabase setup

The dedicated Tartışıyoruz Supabase Free project has already been created with the user's approval, and all three files in `supabase/migrations/` were applied in filename order. Do not apply them to an unrelated project. To reproduce the database elsewhere, run the migrations in ascending filename order: the initial schema, public aggregate results/realtime table, then server-recorded activity triggers. Cloud authentication uses Supabase's passwordless email magic link flow; enable the Email provider and add the local and verified GitHub Pages URLs to Supabase Auth's redirect allow-list.

For local development, copy the project URL and publishable (or legacy anon) key from Supabase project API settings to `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. These are public browser values; the database must keep the included RLS policies enabled. Never use or publish a `service_role` key or a private OAuth/inference secret. The Pages workflow contains the two public client settings directly because the Supabase URL and publishable key are intended for browser use; RLS—not key secrecy—protects data. Update those two workflow values if changing to another Supabase project.

Email sign-in sends a one-time magic link and automatically creates the user when Supabase Email Auth permits sign-ups. The user must open the link in the same browser to establish the session.

## Data and safety modes

The local demo saves votes/comments in `localStorage`, keyed by a locally chosen username. This is useful for exploring the interface but is not authentication, shared storage, or fraud-resistant voting. Cloud mode requires a Supabase user account. Database rows are protected by row-level security, duplicate votes are blocked by a unique constraint, and aggregate result/leaderboard functions do not expose individual vote identities. The migration creates ten starter polls with zero cloud votes.

## AI question generation and scheduling

There is no Hugging Face inference token or server-side inference service wired into the public bundle. Hugging Face's current official pricing lists no included inference credits for Free users. Therefore, this build does not claim AI poll generation is active. GitHub Pages cannot hold a private inference token or run a Node server. A future server-side implementation requires a permitted inference route, protected token, strict JSON/content/duplicate validation, and a scheduler; a GitHub Actions cron is best-effort and may be delayed, so it cannot promise exactly one poll every five minutes.

## Deployment

The `Deploy Tartışıyoruz to GitHub Pages` workflow builds `dist` with Vite's `/tartisiyoruz/` base path and publishes it through GitHub Pages. GitHub Free requires this project repository to be public for Pages. The Pages project URL is expected at `https://just-ulas.github.io/tartisiyoruz/`; treat it as live only after the first Actions deployment and HTTP check succeed.

Review current service limits and source links in [`docs/free-tier-notes.md`](docs/free-tier-notes.md). See `supabase/migrations/` for the schema and RLS policies.
