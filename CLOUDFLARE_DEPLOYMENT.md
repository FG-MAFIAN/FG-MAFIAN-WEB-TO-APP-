# AppForge — Cloudflare Pages deployment

## Pages project

Connect the repository `FG-MAFIAN/FG-MAFIAN-WEB-TO-APP-` to Cloudflare Pages.

- Framework preset: **None**
- Root directory: repository root
- Build command: leave empty
- Build output directory: `.`
- Keep `functions/`, `api/`, `.github/` and `supabase/` at the repository root.
- Compatibility date and Node compatibility are configured in `wrangler.toml`.

The file `functions/api/[[path]].js` routes `/api/*` requests to the shared API handlers.

## Required environment variables

Set these in **Workers & Pages → AppForge → Settings → Variables and Secrets** for Production. Configure Preview separately if you use preview deployments.

| Name | Value / purpose |
|---|---|
| `GITHUB_TOKEN` | Encrypted secret. Must dispatch workflows, read workflow runs and read release assets. |
| `GITHUB_OWNER` | `FG-MAFIAN` |
| `GITHUB_REPO` | `FG-MAFIAN-WEB-TO-APP-` |
| `GITHUB_BRANCH` | `main` once the production changes are merged |
| `SUPABASE_URL` | Supabase project URL, without `/rest/v1/` |
| `SUPABASE_ANON_KEY` | Supabase publishable/anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Encrypted secret; never expose to the browser |
| `ADMIN_EMAILS` | Comma-separated allowlisted owner/admin email addresses |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Encrypted Upstash REST token |
| `DOWNLOAD_LIMIT_PER_HOUR` | Optional integer; defaults to 3; 0 disables the unique-build download limit |

Never add secret values to the repository, HTML, frontend JavaScript, README files or screenshots.

## Supabase

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL Editor.
3. Configure email verification to send the numeric `{{ .Token }}` code and configure SMTP delivery.
4. Set the Supabase Site URL to the deployed Pages domain.
5. Add the production and preview domains to Authentication → URL Configuration → Redirect URLs.
6. Add the Supabase URL, anon key and service-role secret to Cloudflare Pages.

The service-role key is used only by server-side Pages Functions for profile checks, owner controls and private logging. It must never be sent to the browser.

## GitHub Actions

- Enable Actions for the repository.
- Keep `.github/workflows/build-apk.yml` on the branch named by `GITHUB_BRANCH`.
- The configured GitHub token must be able to dispatch the workflow and read workflow runs/releases.
- The workflow uses its own `GITHUB_TOKEN` with Contents write permission to publish the APK release asset.

## Deployment verification

After saving variables, redeploy the Pages project. Open:

`https://YOUR-PAGES-DOMAIN/api/health`

A successful response confirms that the API route is responding; it does not confirm all external integrations.

Complete a real test: register and verify an account, sign in, create an Android app from a public HTTPS site, confirm the GitHub Actions workflow runs, download the APK, install it on Android, and confirm the build appears in My Apps. Test the admin panel with an email listed in `ADMIN_EMAILS`.

## Runtime notes

- APKs load the submitted live website in Android WebView and need internet access.
- Some websites disallow WebView embedding and may need their security policy adjusted.
- Current output is a debug APK. Google Play distribution requires a signed release build.
- Payment processing is not connected; Premium is an owner-assigned account label only.
- Test actual builds and downloads before announcing the service as production-ready.


## Recent account and ratings update

- `wrangler.toml` explicitly enables `nodejs_compat_populate_process_env` so Pages Function handlers can read dashboard variables through `process.env`.
- Keep `SUPABASE_URL` and `SUPABASE_ANON_KEY` set for browser sign-in and registration; keep `SUPABASE_SERVICE_ROLE_KEY` server-only.
- After pulling the latest `main` branch, run the complete updated `supabase/schema.sql` file again in Supabase SQL Editor. It safely creates the `app_ratings` table and its row-level security policies.
- Optional 1–5 star feedback appears after a successful APK build. Low ratings can include an optional reason. The owner can review ratings in the Admin panel.
- The Snake game appears after a build request is accepted, can be skipped, and closes automatically when the APK finishes.
