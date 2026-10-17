# Delivery outcomes

Status: implementation is in progress. An item is complete only when its outcome is implemented or documented with evidence; unconfigured external features remain open.

## 1. Free-first architecture and service boundaries — open

- Do not purchase subscriptions or activate paid services.
- Check current free-tier restrictions before choosing services.
- Do not assume that an AI model, scheduled job, database, or hosting provider is unlimited or permanently free.
- Do not invent API keys, credentials, deployment URLs, or successful test results.
- Prefer existing authorized connectors over requiring the user to obtain new credentials.
- If a connector works only inside the development environment, do not assume that GitHub Pages can access it directly.
- Clearly distinguish features that are fully working from those requiring configuration.
- GitHub Pages must host the frontend. Static hosting cannot run a permanent Node.js server or backend scheduler. Any server-side task must use an actually available external service or suitable free scheduled function. If no suitable free scheduler exists, explain the limitation and implement the closest reliable alternative without claiming that a five-minute background schedule is active.
- Never expose private API tokens or server-side credentials in frontend JavaScript. Database credentials must never be exposed in public source code. Public Supabase client configuration may be used only with correctly configured security policies. Never put a Supabase service-role key in frontend code.

## 2. React/Vite foundation and project documentation — open

- Use React, TypeScript, Vite, and Tailwind CSS or an equally lightweight styling approach.
- The primary interface language must be Turkish. Source code, comments, technical documentation, and implementation notes must be English.
- Include the complete project structure, frontend, database integration, AI integration/configuration notes, and documentation. Do not assume an existing repository, project, design, database, or codebase.

## 3. Onboarding, accounts, and profiles — open

- Include username-based onboarding, Google sign-in through Supabase Auth if properly configurable, guest browsing where appropriate, and user profiles.
- Users must not be able to edit other users' profiles without authorization.
- Authentication must work when configured; otherwise explain the remaining manual provider/redirect setup.

## 4. Polls, options, votes, and results — open

- Include debate polls with multiple choices, persistent votes, live vote counts and percentages, shareable poll links, and poll detail views.
- Votes must persist across devices when connected to Supabase. A user must not be able to vote repeatedly on the same poll. Vote totals and percentages must be derived from real database records in cloud mode.
- Include animated result bars after voting, plus loading, empty, error, and success states.

## 5. Comments and discussions — open

- Include comments and discussions attached to polls. Comments must persist in the connected database and follow appropriate ownership and moderation rules. Label any local-demo comments as device-local rather than shared.

## 6. Discovery, categories, activity, and leaderboard — open

- Include search and category filtering, trending polls, the most-active-users leaderboard, and user activity statistics.
- Categories must include technology, gaming, science, current affairs, society, education, sports, entertainment, philosophy, and everyday life.
- Leaderboard values must use real activity data when connected to Supabase; do not claim cloud leaderboard data when using sample/local data.

## 7. Interface design, accessibility, and responsive behavior — open

- Build a polished, modern, mobile-first social product with clean typography and spacing, strong visual hierarchy, attractive poll cards, smooth but lightweight transitions, accessible contrast, responsive navigation, mobile bottom navigation, search, filters, category chips, and profile and leaderboard layouts.
- Support dark and light themes. Avoid generic AI-dashboard aesthetics, excessive gradients, unnecessary 3D effects, and bloated animations.
- The application must work on mobile and desktop. Honor reduced-motion preferences.

## 8. Hugging Face question generation — open / configuration dependent

- Use the existing Hugging Face connector for model inference only if it supports actual inference and an accessible model can be used within a permitted free allowance. Select a model that produces natural Turkish text.
- Each generated poll must contain a concise Turkish question, two to four balanced answer options, a suitable category, and an optional short description.
- Validate all generated output before database insertion. Reject malformed JSON, duplicate questions, empty choices, and inappropriate content.
- Do not generate all questions in a user's browser. Do not use frontend `setInterval` as a background scheduler. Use a genuine server-side scheduled task only if an available free service supports the required interval.
- The requested five-minute poll-generation schedule may be reported active only after a real server-side scheduler and permitted inference integration are configured and verified. Never expose private API tokens or server-side credentials in frontend JavaScript.

## 9. Supabase schema, security, and real persistence — open / user setup required

- Create database schema and SQL migration files for `profiles`, `polls`, `poll_options`, `votes`, `comments`, and `user_activity`.
- Configure appropriate relationships, indexes, unique constraints, and Row Level Security policies.
- Persist votes across devices; prevent repeat voting on a poll; derive vote totals and percentages from real records; protect profile ownership; and enforce comment ownership and moderation rules.
- If Supabase credentials or OAuth configuration are missing, prepare setup files and exact instructions for the remaining manual steps. Do not apply a migration to an existing project unless the user confirms that project is the Tartışıyoruz target.

## 10. Automated and manual validation evidence — open

Before deployment, test as much as the environment permits and fix errors before publishing. Specifically check: (1) production build succeeds; (2) all pages load; (3) mobile layouts work; (4) Supabase connectivity works; (5) authentication works when configured; (6) polls load from persistent storage; (7) voting is saved and duplicate voting is rejected; (8) vote percentages are correct; (9) comments persist; (10) leaderboard uses real activity data; (11) AI generation works when the connector and model are available; (12) scheduled tasks work if implemented; (13) no private secrets appear in the repository; and (14) GitHub Pages routes and asset paths work correctly. Never report unperformed tests as successful.

## 11. GitHub repository and Pages deployment — open

- Create or use the `tartisiyoruz` repository. Configure the correct Vite base path for the repository URL. Build the production frontend.
- Configure a GitHub Actions workflow to deploy the production build to GitHub Pages. Commit and push all required source files and workflow configuration. Enable Pages using available repository settings or connector actions.
- Wait for the deployment workflow to finish if the environment supports it. Verify the actual published URL, open the deployed URL, and test the main interface. Fix deployment errors and retry where possible.
- For a standard project repository the URL format is `https://YOUR-GITHUB-USERNAME.github.io/tartisiyoruz/`; this is only an example until the actual deployment result confirms the URL.
- Do not substitute Vercel for GitHub Pages. If Pages cannot be enabled automatically because of permissions, report exactly what the user must click and continue all other possible tasks.
- Do not claim that a repository, commit, or deployment exists unless it was actually created and confirmed.

## 12. Final English report — open

When finished, respond in English and provide the actual GitHub repository URL, actual GitHub Pages website URL, deployment status, features successfully implemented and tested, remaining manual setup steps, genuine free-tier limitations, and the status of Supabase, Hugging Face, Google sign-in, and automated question generation. Keep the report concise and factual.
