# Free-tier constraints and deployment facts

Facts checked against the providers' official documentation on 2026-10-18.

## GitHub Pages and Actions

GitHub Pages is available with GitHub Free only for public repositories. GitHub Pages serves static HTML/CSS/JavaScript and publishes project sites under `https://<owner>.github.io/<repository>/`. This repository must therefore be public for the requested free Pages publication. GitHub's schedule event supports a shortest interval of five minutes, but only runs from the default branch, may be delayed during high Actions load, and scheduled workflows in public repositories are disabled after 60 days without repository activity. Public-repository Actions usage is free for standard hosted runners, subject to provider limits and abuse controls. A cron expression does not provide an exact or guaranteed five-minute scheduler.

Sources: [GitHub Pages availability and static hosting](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [GitHub Actions schedule event](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [GitHub Actions billing](https://docs.github.com/en/billing/managing-billing-for-github-actions/about-billing-for-github-actions).

## Supabase Free

The current pricing page lists 50,000 monthly active users, a 500 MB database, 5 GB egress, 5 GB cached egress, and 1 GB file storage. It states that Free projects pause after one week of inactivity and limits the account to two active projects. Those limits make Free suitable for a small demonstration, not a guaranteed always-on production backend. Do not apply the schema migration to a project until the owner has designated it for this app.

Source: [Supabase pricing and plan comparison](https://supabase.com/pricing).

## Hugging Face Inference

The current Inference Providers pricing documentation says Free users receive no included monthly inference credits; they can use providers by purchasing credits or upgrading. This app must not present Hugging Face question generation as a free active capability unless a permitted, free inference method is actually available and configured. Never expose a private inference token in the browser bundle.

Source: [Hugging Face Inference Providers pricing](https://huggingface.co/docs/inference-providers/en/pricing).

Public repositories using standard GitHub-hosted runners have free Actions usage; this excludes larger runners. The GitHub documentation also notes that Actions costs may be charged to the repository owner when billable usage applies.

Additional source: [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
