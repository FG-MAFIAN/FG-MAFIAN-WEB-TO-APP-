# AppForge — Website to Android App Generator

AppForge turns a public HTTPS website into an installable Android APK. Visitors can configure the app identity and supported Android behavior, submit a cloud build, follow its progress, and download the finished APK.

## What AppForge includes

- Account registration with email verification and sign-in.
- A guided website-to-Android builder with live opening-screen preview.
- Custom app name, Android package ID, version name and version code.
- Optional home-screen icon and separate opening-screen logo.
- Theme, splash-screen and status-bar colors.
- Portrait, landscape or automatic orientation.
- Fullscreen or standalone display mode.
- Pull-to-refresh, Android navigation visibility, pinch-to-zoom, keep-screen-awake and screenshot protection.
- Cloud APK compilation through GitHub Actions.
- Build status tracking, personal project history and APK downloads.
- Account profile and an owner-only admin dashboard for account controls, maintenance mode and private error reports.
- A step-by-step public guide at `/docs`.

## How a visitor uses it

1. Open the website and create an account. Enter the email verification code sent to the inbox.
2. Open **Create App** and enter a public HTTPS website address.
3. Preview the website, choose the app name and package ID, and set the version.
4. Upload optional logos and choose the appearance and Android behavior.
5. Select **Build installable APK**. The build runs on GitHub Actions; it can take several minutes.
6. Open **My Apps** to follow progress. The page refreshes active build status automatically while it is open.
7. When the status is **APK ready**, download the APK and install it on an Android device.

The public guide explains the settings, installation steps and common problems.

## Technology

- Static frontend: HTML, CSS and JavaScript.
- Hosting and API routing: Cloudflare Pages with Pages Functions.
- Accounts and project records: Supabase Auth and Postgres.
- APK compilation: GitHub Actions, Node.js, Capacitor, Java and Android SDK.
- Download tracking: Upstash Redis REST API.

## Deploy to Cloudflare Pages

Connect this GitHub repository to a Cloudflare Pages project.

| Setting | Value |
|---|---|
| Framework preset | None |
| Root directory | Repository root |
| Build command | Leave empty |
| Build output directory | `.` |
| Functions directory | `functions/` (keep at repository root) |

Keep `api/`, `functions/`, `.github/workflows/` and `supabase/` in the repository root. The Pages adapter routes requests to `/api/*`.

### Cloudflare Pages environment variables

Add the following under **Workers & Pages → your Pages project → Settings → Variables and Secrets**. Add secrets as encrypted secrets, not plain text variables.

| Variable | Purpose |
|---|---|
| `GITHUB_TOKEN` | Server-side token allowed to dispatch/read Actions workflows and access build releases |
| `GITHUB_OWNER` | `FG-MAFIAN` (GitHub repository owner) |
| `GITHUB_REPO` | `FG-MAFIAN-WEB-TO-APP-` |
| `GITHUB_BRANCH` | `main` after the production changes are merged |
| `SUPABASE_URL` | Supabase project URL, without `/rest/v1/` |
| `SUPABASE_ANON_KEY` | Supabase publishable/anon key used by the browser client |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role secret; server-side only |
| `ADMIN_EMAILS` | Comma-separated email addresses permitted to use the admin panel |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token; server-side only |
| `DOWNLOAD_LIMIT_PER_HOUR` | Unique APK builds a network can download per hour; defaults to `3`, set to `0` to disable |

Apply variables to Production and Preview environments as appropriate, then redeploy Pages after changing them.

### Supabase setup

1. Create a Supabase project.
2. Open its SQL Editor and run the complete `supabase/schema.sql` file.
3. In Authentication settings, configure email verification to send a numeric token using the `{{ .Token }}` template and configure SMTP delivery.
4. Set the Site URL to the deployed AppForge domain and add the production and preview URLs to the allowed redirect URLs.
5. Add the Supabase URL, anon key and service-role key to Cloudflare Pages. Never put the service-role key in browser code or GitHub.

### GitHub Actions setup

1. Enable GitHub Actions for the repository.
2. Ensure `.github/workflows/build-apk.yml` exists on the branch configured in `GITHUB_BRANCH`.
3. Configure `GITHUB_TOKEN` with permission to dispatch workflows, read workflow runs and read release assets. The workflow's built-in token needs Contents write permission to publish the APK release.
4. Confirm the GitHub repository's Actions usage limits are suitable for the expected number of builds.

### Verify the deployment

Open `https://YOUR-PAGES-DOMAIN/api/health`. This checks that the Pages API route responds. It does not prove that Supabase, GitHub Actions, Upstash or a real Android build is configured correctly.

Then perform an end-to-end test:
- Register a test account and verify its email.
- Sign in and submit a test website.
- Confirm that a GitHub Actions workflow starts.
- Wait for the APK build to complete.
- Download the APK and install it on an Android test device.
- Confirm that the project appears under My Apps and that the owner admin panel works only for an allowlisted email.

## Important limitations

- AppForge currently generates Android APKs only; it does not create iOS apps.
- The APK loads the supplied live HTTPS website inside an Android WebView. It is not an offline website export and needs internet access.
- Some websites block WebView embedding or depend on browser-only features. Those sites may not work until their owners adjust their security settings.
- The current workflow produces a debug APK for testing and direct installation. Google Play distribution requires a signed release build and a separate Play Console publishing process.
- Premium labels can be assigned by the owner, but no payment processor or automatic subscription entitlement is connected. Do not advertise paid plans as purchasable until that integration is implemented.
- A successful JavaScript source check is not proof of a successful Android build. Test a real APK after configuring all external services.

## Security

Never commit GitHub tokens, Supabase service-role keys, Upstash tokens, passwords or verification codes. Keep all privileged values in Cloudflare Pages encrypted secrets. The public API returns generic errors; private technical reports are available only through the owner admin dashboard.

