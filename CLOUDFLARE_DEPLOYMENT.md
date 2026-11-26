# AppForge — Cloudflare Pages deployment

## Pages project

Connect `FG-MAFIAN/FG-MAFIAN-WEB-TO-APP-` to Cloudflare Pages.

- Framework preset: **None**
- Root directory: repository root
- Build command: leave empty (or run `npm run build` if using a build pipeline)
- Build output directory: `.`
- Keep `functions/`, `api/` and `.github/` at the repository root.
- `wrangler.toml` enables Node.js compatibility.
- `functions/api/[[path]].js` forwards Cloudflare Pages environment bindings to the shared API handlers.

## Required environment variables

Set these under **Workers & Pages → AppForge → Settings → Variables and Secrets** for Production. Configure Preview separately if needed.

| Name | Value / purpose |
|---|---|
| `GITHUB_TOKEN` | Encrypted secret with Actions workflow dispatch/read permissions and access to repository releases |
| `GITHUB_OWNER` | `FG-MAFIAN` |
| `GITHUB_REPO` | `FG-MAFIAN-WEB-TO-APP-` |
| `GITHUB_BRANCH` | `main` |

GitHub Actions must be enabled for the repository. The workflow's built-in token needs Contents write permission to publish the APK release.

## Optional environment variables

| Name | Value / purpose |
|---|---|
| `UPSTASH_REDIS_REST_URL` | Optional IP-based build rate-limit storage |
| `UPSTASH_REDIS_REST_TOKEN` | Optional encrypted Upstash REST token |
| `SUPABASE_URL` | Optional legacy maintenance-mode setting lookup |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional server-side key for maintenance-mode lookup; never expose it to the browser |

No Supabase account, email verification, login or subscription settings are required for public app creation. Upstash is optional. APK downloads are free and have no built-in quota unless an explicit download limit is configured.

Never add secret values to the repository, HTML, frontend JavaScript, README files or screenshots.

## Deployment verification

After saving the required variables, redeploy Pages. Open:

`https://YOUR-PAGES-DOMAIN/api/health`

The endpoint reports whether the GitHub build settings are present and lists missing variable names without exposing secret values.

Then create a test app from a public HTTPS website. Confirm that GitHub Actions starts, the Android APK build completes, and the APK downloads and installs on an Android device.

## Runtime notes

- APKs load the submitted live website in Android WebView and need internet access.
- Some websites disallow WebView embedding and may need their security policy adjusted.
- Current output is a debug APK. Google Play distribution requires a signed release build.
- Free access does not remove Cloudflare or GitHub Actions usage limits.
