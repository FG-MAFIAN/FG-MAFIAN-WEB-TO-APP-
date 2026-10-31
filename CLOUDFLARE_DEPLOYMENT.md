# FG MAFIAN APK Builder PRO — Cloudflare Pages deployment

This package adds a Cloudflare Pages Functions adapter for the existing API routes. Keep the `functions/` and `api/` directories at the repository root. The `functions/api/[[path]].js` router exposes `/api/build`, `/api/status`, `/api/download`, `/api/health`, `/api/config`, `/api/admin`, and `/api/maintenance`.

## Cloudflare Pages settings
- Connect the GitHub repository `FG-MAFIAN/FG-MAFIAN-WEB-TO-APP-`.
- Framework preset: None.
- Build command: leave empty.
- Build output directory: `.`.
- Root directory: `/` (repository root).
- Ensure the `functions` directory is committed at the repository root.


## Required Pages environment variables / secrets

Add these under Workers & Pages → your Pages project → Settings → Variables and Secrets, for Production (and Preview if needed):

- `GITHUB_TOKEN` (secret; token must be allowed to dispatch workflows and read Actions runs/releases)
- `GITHUB_OWNER` = `FG-MAFIAN`
- `GITHUB_REPO` = `FG-MAFIAN-WEB-TO-APP-`
- `GITHUB_BRANCH` = `main` (change if your default branch differs)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (secret)
- `ADMIN_EMAILS` (administrator login email address(es), comma-separated)
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN` (secret)
- `DOWNLOAD_LIMIT_PER_HOUR` = `3` (optional; `0` disables the hourly limit)

Do not put secret values in HTML, JavaScript, GitHub commits, or screenshots.

## Important verification note
This package includes a compatibility adapter for the existing Node-style API handlers. Cloudflare deployment and external GitHub Actions, Supabase, and Upstash credentials still need to be configured and tested in the user's account. The adapter buffers a proxied APK response in memory; if APK artifacts are very large, replace this with a direct signed-download redirect or a streaming-native implementation before production use. Do not assume the live service is operational until `/api/health`, account login, admin actions, and a real test build/download have been checked.
