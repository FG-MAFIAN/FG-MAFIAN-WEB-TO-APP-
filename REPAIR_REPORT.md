# AppForge — current repair and verification notes

## Current changes on main

- Public APK generation no longer requires a Supabase account, email verification or sign-in.
- The public website no longer displays account creation, login or premium-only controls.
- Build history is stored locally in the visitor's browser.
- APK downloads are free by default; an optional limit can be configured explicitly.
- Upstash is optional for build protection. Missing Upstash settings no longer prevent normal free builds.
- Cloudflare Pages environment bindings are forwarded to the API handlers.
- The frontend displays safe, actionable API errors instead of hiding every failure behind a generic message.
- The health endpoint reports whether required GitHub build settings are present without revealing secret values.
- Failed builds include a link to their GitHub Actions logs.

## Required server-side environment variables

Configure these in the hosting provider's Production environment:

- `GITHUB_TOKEN` — token allowed to dispatch the repository's Actions workflow, read workflow runs, and access releases.
- `GITHUB_OWNER` — `FG-MAFIAN`.
- `GITHUB_REPO` — `FG-MAFIAN-WEB-TO-APP-`.
- `GITHUB_BRANCH` — `main` (or the branch containing `.github/workflows/build-apk.yml`).

Optional:
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for IP-based rate limiting.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only if the legacy maintenance-mode setting is still used.

Do not put any secret in browser code or commit it to GitHub.

## Verification

The repository's Vercel status check should be inspected for the latest commit. Open `/api/health` after deployment; if `buildReady` is false, add the listed missing settings and redeploy.

A successful source/deployment check does not prove that GitHub Actions can dispatch a workflow or that Android can compile an APK. Complete one real build and download test before announcing the generator as fully operational.
