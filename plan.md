# Tartışıyoruz — Implementation Plan

## Product and delivery

Build a Turkish-first social polling platform as a static React + TypeScript + Vite application. Publish it from a public `just-ulas/tartisiyoruz` repository through GitHub Pages and a GitHub Actions Pages workflow. Keep the free-first constraint: no purchases, no paid infrastructure, no browser-exposed private tokens, and no claim of live cloud functionality unless the corresponding service is configured and tested.

The client has two explicit data modes. When `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are present, use the public Supabase client with the supplied migration's RLS policies; auth-gated actions require a signed-in account. Otherwise run a clearly identified local demo backed by `localStorage`, with sample polls, votes, comments, and profile activity. The demo must never imply that its data is shared across devices. Google OAuth is shown only for a configured cloud client. Cloud URLs and anonymous keys are public client configuration, not secrets; never place a service-role key in the static bundle.

The repository includes three ordered Supabase migrations with profiles, polls, options, votes, comments, user activity, safe public aggregate counts for realtime results, foreign keys, indexes, unique poll/user votes, ownership rules, and RLS. The user explicitly approved a new dedicated Supabase Free project; it has been created and all three migrations were applied there. Do not reuse or mutate the account's unrelated projects. Keep exact setup instructions for public project URL/key in the Pages workflow, OAuth redirect configuration, and migrations.

Hugging Face Hub access can discover models but is not a configured inference credential. Current official pricing shows no included inference credits for free accounts. Therefore do not ship client-side inference or claim free automatic generation. Document the server-only integration contract and why the requested five-minute generation is inactive until a permitted free inference route, protected token, database target, and reliable scheduled runner are configured. Supabase Free pauses low-activity projects after one week, so it cannot be treated as an always-on scheduler. GitHub Actions can schedule at five-minute intervals but runs are best-effort, may be delayed, are restricted to the default branch, and can be disabled in an inactive public repository. Those constraints preclude promising exact five-minute poll creation on this configuration.

## Project structure

- `src/`: React entry point, accessible reusable components, feed/profile/leaderboard views, responsive navigation, theme handling, and data-mode state.
- `src/data/`: Turkish seed polls and static category/label definitions used only in the local demo.
- `src/lib/`: Supabase client, typed adapter operations, fallback storage, and derived vote percentage helpers.
- `supabase/migrations/`: versioned schema and policies for user-provisioned Supabase projects.
- `public/`: route manifest, SVG app icon and static metadata.
- `.github/workflows/`: Pages build/deploy workflow; no third-party action is used for application runtime.
- `docs/`: setup, privacy/security, free-tier facts, and limitations.
- Root config: Vite development base `/` and production Pages base `/tartisiyoruz/`, strict TypeScript, typecheck/build scripts, and a checked-in package-manager pin/lockfile.

## Design direction

Three low-probability sampled style alternatives (probabilities are sampling weights, each below 0.10): **0.031 — civic editorial broadsheet**, **0.039 — warm contemporary community noticeboard**, and **0.076 — restrained digital town square**. Choose **civic editorial broadsheet**: a legible, print-informed social product, without imitating a specific publication.

- **Design Movement:** Contemporary editorial design, borrowing the clarity of a debate journal and the openness of a public forum.
- **Core Principles:** Questions are the visual headline; results are transparent; discussion remains civil and readable; mobile actions stay reachable.
- **Color Philosophy:** Warm paper and ink neutrals create a calm reading surface; a distinctive cobalt-teal signals votes and active states; coral marks disagreement and small emphasis. Dark mode inverts the paper/ink relationship while preserving contrast.
- **Layout Paradigm:** Desktop uses a compact navigation rail, a broad editorial feed, and a narrow utility column; the feed remains primary. Mobile collapses to a single column with a fixed bottom navigation and horizontally scrollable topic chips.
- **Signature Elements:** An overlapping two-quote mark for the logo; small numbered option labels; fine ruled dividers and vote bars with clearly printed percentages.
- **Interaction Philosophy:** A vote is an explicit, reversible-looking but actually one-time action per account; results appear immediately after a confirmed save. Search/filter state stays visible. Errors explain whether local demo or cloud mode is active.
- **Animation:** Short 160–220 ms easing for card hover, theme changes, and result-bar width; reduced-motion preference disables decorative transitions. Never delay voting or hide results behind animation.
- **Typography System:** Manrope for display questions and headings; Inter for body, controls, and data, with system fallbacks. Strong headline/body contrast, comfortable Turkish diacritics, and tabular numerals for counts.
- **Brand Essence:** A thoughtful Turkish forum where people can see how others answer real questions; **curious, fair, direct**.
- **Brand Voice:** Clear, warm, and non-partisan. Examples: “Bir fikrin var mı?” and “Sonuçlar oy verdikten sonra açılır.”
- **Wordmark & Logo:** A custom, compact twin quotation mark inside an open speech frame, paired with the wordmark “tartışıyoruz” in a sturdy lowercase display face.
- **Signature Brand Color:** Deep cobalt teal, used sparingly for selected topics, vote confirmation, and live status.

## Implementation sequence

1. Configure TypeScript and related code diagnostics, then establish the plan and complete acceptance-criteria TODO list.
2. Implement the responsive interface, Turkish seed data, working search/category filters, poll-detail route, local voting/comments, profile/leaderboard views, share links, and theme persistence.
3. Add the optional Supabase adapter and migration without writing to an unconfirmed project; label demo versus cloud behavior truthfully.
4. Add static route/404 support, setup documentation, GitHub Pages Actions workflow, and repository base-path configuration.
5. Run dependency installation, diagnostics, production build, focused logic checks, and inspect generated files for secret leakage. Then commit to the Manus-managed source, checkpoint where the hosting workflow permits, create/push the requested public GitHub repository, enable Pages, and verify the deployed URL and HTTP response.

## Material limitations

- GitHub Pages serves static assets only; it does not host a persistent Node process or secure runtime secret.
- The user approved and now has a dedicated Supabase Free project. It must remain distinct from the unrelated “Doğru mu” project. Google OAuth still requires the user's Google client credentials and redirect configuration.
- Google sign-in requires configuring Supabase Auth's Google provider and redirect URLs.
- Free Hugging Face inference currently has no included credits. Automated generation is not active in this deliverable.
- GitHub Actions schedule triggers are not a guaranteed real-time scheduler, and public scheduled workflows may be disabled after 60 days without repository activity.
