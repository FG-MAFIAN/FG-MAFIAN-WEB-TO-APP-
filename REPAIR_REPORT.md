# FG MAFIAN APK Builder PRO – repair notes

## Changes in this repair
- Build submission now dispatches the GitHub Actions workflow and returns immediately instead of polling GitHub repeatedly inside the Vercel function. This avoids wasting the serverless execution window while GitHub registers the run.
- Build submission no longer requires or checks the Upstash download counter. A build request is not a download and must not consume the download allowance.
- Health readiness now reports the build service as ready when GitHub configuration and the download-limit value are valid; Upstash remains required by the download endpoint for atomic completed-download tracking.
- Admin API now validates malformed JSON bodies and returns a clear JSON error instead of throwing a parser exception.
- Admin browser code now handles non-JSON server responses with a useful error message and checks config/maintenance HTTP responses.
- Account browser code now reports HTTP configuration errors explicitly.

## Required Vercel environment variables
Set these for Production (and Preview/Development if those deployments are used):
- `SUPABASE_URL` – Supabase project URL, without `/rest/v1/`.
- `SUPABASE_ANON_KEY` – Supabase publishable/anon key.
- `SUPABASE_SERVICE_ROLE_KEY` – Supabase secret/service-role key. Server-side only; never expose it in browser code or commit it to GitHub.
- `ADMIN_EMAILS` – comma-separated exact email address(es) allowed to administer the site.
- `GITHUB_TOKEN` – GitHub token with permission to dispatch Actions workflows, read Actions runs, and create releases/upload release assets in the target repository.
- `GITHUB_OWNER` – `FG-MAFIAN`.
- `GITHUB_REPO` – the exact repository containing this website and `.github/workflows/build-apk.yml`.
- `GITHUB_BRANCH` – branch containing the workflow (commonly `main`; use the actual default branch).
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` – required for download tracking and enforcing the download limit.
- `DOWNLOAD_LIMIT_PER_HOUR` – optional integer; defaults to `3`; `0` disables the hourly cap but still requires tracking for duplicate protection.

## Deployment and verification limits
`npm run build` performs JavaScript syntax checks only. It passed after these changes. ZIP integrity is checked separately. This package has not been deployed to the user's Vercel project, and external Supabase, GitHub Actions, Upstash, and real Android APK generation cannot be verified without access to those accounts and their correctly configured secrets. Do not treat a successful source check as proof that the live services work.
