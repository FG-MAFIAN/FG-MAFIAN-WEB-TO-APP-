# AppForge — Free Website to Android App Generator

AppForge turns a public HTTPS website into an installable Android APK. It is free to use: visitors do not need to create an account, sign in, verify email, or purchase a subscription.

## Features

- Guest access to every public builder feature.
- Custom app name, Android package ID, version name and version code.
- Optional home-screen icon and separate opening-screen logo.
- Theme, splash-screen and status-bar colors.
- Portrait, landscape or automatic orientation.
- Fullscreen or standalone display mode.
- Pull-to-refresh, Android navigation visibility, pinch-to-zoom, keep-screen-awake and screenshot protection.
- Live configuration preview.
- Cloud APK compilation through GitHub Actions.
- Build progress tracking and device-local build history.
- Rebuild previous configurations, delete build records, copy APK links and download completed APKs.
- Public guide at `/docs`.

## How to use

1. Open **Create an app**.
2. Enter a public HTTPS website address and an app name.
3. Customize the package ID, version, logos, colors and Android behavior.
4. Select **Build installable APK**.
5. Follow the build status and download the APK when it is ready.
6. Open **My apps & builds** to see records saved in this browser on this device.

Build history uses browser local storage. It is not synchronized between devices and may be lost if browser data is cleared.

## Technology

- Static frontend: HTML, CSS and JavaScript.
- API routes: Vercel Functions under `api/`, with an adapter for Cloudflare Pages under `functions/`.
- APK compilation: GitHub Actions, Node.js, Capacitor, Java and Android SDK.
- Optional IP rate limiting: Upstash Redis REST API.

## Required server-side environment variables

Set these in the hosting provider's project settings. Never put them in browser JavaScript or commit them to Git.

| Variable | Purpose |
|---|---|
| `GITHUB_TOKEN` | Server-side token with Actions workflow dispatch/read permissions and access to repository releases |
| `GITHUB_OWNER` | `FG-MAFIAN` |
| `GITHUB_REPO` | `FG-MAFIAN-WEB-TO-APP-` |
| `GITHUB_BRANCH` | `main` |

GitHub Actions must be enabled in the repository. The workflow's built-in token needs Contents write permission to publish the APK release.

## Optional environment variables

| Variable | Purpose |
|---|---|
| `UPSTASH_REDIS_REST_URL` | Optional IP-based build rate-limit storage |
| `UPSTASH_REDIS_REST_TOKEN` | Optional Upstash token; server-side only |
| `SUPABASE_URL` | Optional legacy maintenance-mode setting lookup |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional server-side key for that maintenance lookup; never expose it in the browser |

App creation does not depend on Supabase, user accounts, email verification or paid entitlements. Upstash is optional; when it is not configured, the builder remains available without its external rate-limit counter.

## Deploy

### Vercel

1. Import this repository into Vercel.
2. Use the repository root as the project root and the **Other** framework preset.
3. Set the build command to `npm run build`.
4. Keep the project root as the output directory (do not move the `api/` directory).
5. Add the required server-side environment variables above to the Production environment.
6. Deploy the `main` branch.

### Cloudflare Pages

1. Connect the repository to Cloudflare Pages.
2. Use no framework preset, repository root as the root, leave the build command empty, and set the output directory to `.`.
3. Keep `api/`, `functions/` and `.github/workflows/` in the repository root.
4. Add the same required server-side environment variables to the Pages project and deploy `main`.

The Cloudflare Pages adapter forwards Pages environment bindings to the API handlers.

## Build diagnostics

Open `/api/health`. It reports whether the GitHub build settings are present, without exposing their values. If `buildReady` is false, add the names listed in `missingBuildSettings` to the hosting provider's server-side environment settings and redeploy.

A successful health check only confirms configuration presence. It does not prove GitHub Actions can dispatch a workflow or that a real APK can compile. Always test one complete build and APK download.

## Important limitations

- AppForge currently generates Android APKs only; it does not create iOS apps.
- The APK loads the supplied live HTTPS website inside an Android WebView. It is not an offline website export and needs internet access.
- Some websites block WebView embedding or depend on browser-only features.
- The current workflow produces a debug APK for testing and direct installation. Google Play distribution requires a signed release build and a separate Play Console process.
- Free access does not remove the hosting provider's or GitHub Actions' usage limits.

## Security

Never commit GitHub tokens, Supabase service-role keys, Upstash tokens or passwords. Keep privileged values in encrypted hosting-provider secrets. Public build endpoints validate input and can use optional IP-based rate limiting.
