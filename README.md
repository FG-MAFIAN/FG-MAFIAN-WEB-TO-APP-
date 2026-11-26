# AppForge — Free Website to Android App Generator

AppForge turns a public HTTPS website into an installable Android APK. It is free to use and does not require an account, sign-in, email verification or subscription.

## Features
- Create apps without registering or signing in.
- Custom app name, Android package ID, version name and version code.
- Optional home-screen icon and separate opening-screen logo.
- Theme, splash-screen and status-bar colors.
- Portrait, landscape or automatic orientation; fullscreen or standalone mode.
- Pull-to-refresh, Android navigation visibility, pinch-to-zoom, keep-screen-awake and screenshot protection.
- Live configuration preview and cloud APK compilation through GitHub Actions.
- Build progress tracking, local build history, rebuild links, APK downloads, copyable links and per-build deletion.
- Public step-by-step guide at `/docs`.

## How to use
1. Open **Create an app**.
2. Enter a public HTTPS website address and choose an app name.
3. Customize the package ID, version, logos, colors and Android behavior.
4. Select **Build installable APK**.
5. Follow the build status and download the APK when ready.
6. Open **My Apps & Builds** to view builds saved on this device.

Build history is stored in browser local storage. It is not synchronized between devices and may be lost if browser storage is cleared.

## Technology
- Static frontend: HTML, CSS and JavaScript.
- Hosting and API routing: Cloudflare Pages with Pages Functions.
- APK compilation: GitHub Actions, Node.js, Capacitor, Java and Android SDK.
- Optional download abuse controls: Upstash Redis REST API.

## Deploy to Cloudflare Pages
| Setting | Value |
|---|---|
| Framework preset | None |
| Root directory | Repository root |
| Build command | Leave empty |
| Build output directory | `.` |
| Functions directory | `functions/` |

Keep `api/`, `functions/`, `.github/workflows/` and `supabase/` in the repository root.

### Cloudflare Pages environment variables
| Variable | Purpose |
|---|---|
| `GITHUB_TOKEN` | Server-side token to dispatch/read Actions workflows and access build releases |
| `GITHUB_OWNER` | `FG-MAFIAN` |
| `GITHUB_REPO` | `FG-MAFIAN-WEB-TO-APP-` |
| `GITHUB_BRANCH` | Branch containing the APK workflow |
| `SUPABASE_URL` | Optional; owner maintenance controls only |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional server-side key for owner maintenance controls |
| `ADMIN_EMAILS` | Optional owner-only admin dashboard allowlist |
| `UPSTASH_REDIS_REST_URL` | Optional download rate-limit storage |
| `UPSTASH_REDIS_REST_TOKEN` | Optional download rate-limit token |
| `DOWNLOAD_LIMIT_PER_HOUR` | Optional download limit; defaults to unlimited when unset or set to `0` |

Public APK generation does not use Supabase Auth, user accounts, email verification or subscription entitlements.

### GitHub Actions setup
1. Enable GitHub Actions for the repository.
2. Ensure `.github/workflows/build-apk.yml` exists on the configured build branch.
3. Configure `GITHUB_TOKEN` with permission to dispatch workflows, read workflow runs and read release assets. The workflow's built-in token needs Contents write permission to publish APK releases.
4. Check GitHub Actions usage limits for expected build volume.

## Important limitations
- Android APKs only; iOS apps are not generated.
- The APK loads the supplied live HTTPS website inside an Android WebView. It is not an offline website export and needs internet access.
- Some websites block WebView embedding or depend on browser-only features.
- The current workflow produces a debug APK for testing and direct installation. Google Play distribution requires a signed release build and a separate Play Console process.
- Free access does not mean external infrastructure has unlimited capacity; GitHub Actions and hosting providers have their own usage quotas.

## Security
Never commit GitHub tokens, Supabase service-role keys, Upstash tokens or passwords. Keep privileged values in Cloudflare Pages encrypted secrets. Public build endpoints should use platform-level rate limiting and monitoring to prevent abuse.
