# Setup and configuration

## Database

The dedicated Tartışıyoruz Supabase Free project has been created with user approval, and the three migrations in `supabase/migrations/` have been applied to it in filename order. Do not reuse an unrelated project. To reproduce this schema in another dedicated project, apply all three SQL files in ascending filename order; they create starter polls, tables, indexes, uniqueness rules, public aggregate results for realtime updates, server-recorded activity, security-definer functions, and Row Level Security policies.

Copy the Supabase API URL and a publishable (or legacy `anon`) key into `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The static application only uses these public client values. Never use `service_role` or a private OAuth/inference credential in `.env.local`, the workflow, the bundle, or public source. The Pages workflow includes the current public URL and publishable key directly; update those values in the workflow only when intentionally changing projects. Enable the Email provider in Supabase Auth, add the exact local and Pages redirect URLs to the Auth redirect allow-list, and configure the Supabase site URL to the verified Pages URL.

The current cloud profile flow uses a passwordless email magic link and creates a user when sign-ups are enabled; users can edit their display name and handle in the profile. Username must be 3–30 lowercase letters, digits, or underscores. Each authenticated account has one vote per poll. SQL results are counts only and do not return voter identities.

## GitHub Pages

Enable Pages with **GitHub Actions** as the source. The repository must be public on GitHub Free. The workflow builds on pushes to `main` and can also be started manually. It includes the Supabase URL and publishable client key as public build settings, which are bundled into static JavaScript; RLS—not key secrecy—protects data. Keep service-role keys, OAuth client secrets, and inference tokens out of the workflow and client bundle.

## Deferred server-side services

No private Hugging Face access token is present in this repository or public application. Add any future inference token only as a server-side secret on a suitable backend. Validate generated question JSON, option count and balance, category, profanity/safety, and question uniqueness on the server before inserts. Do not call a private token from a browser. A five-minute schedule is not included: GitHub scheduled runs are best effort, and Supabase Free can pause inactive projects.
