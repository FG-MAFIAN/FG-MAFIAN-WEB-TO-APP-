<div align="center">

# 𝗙𝗚 𝗠𝗔𝗙𝗜𝗔𝗡 — Web-to-App Builder

<p><b>Turn a website into an installable Android APK.</b><br>
Build online · Track progress · Download your APK directly</p>

<a href="https://web-to-app-builder.vercel.app/">
  <img src="https://img.shields.io/badge/OPEN%20BUILDER-Visit%20Website-168BFF?style=for-the-badge&logo=vercel&logoColor=white" alt="Open Builder">
</a>
<a href="https://t.me/FG_MAFIAN">
  <img src="https://img.shields.io/badge/CONTACT%20OWNER-Telegram-229ED9?style=for-the-badge&logo=telegram&logoColor=white" alt="Contact owner">
</a>
<a href="https://t.me/fgmafian">
  <img src="https://img.shields.io/badge/JOIN%20CHANNEL-Telegram-20B77A?style=for-the-badge&logo=telegram&logoColor=white" alt="Join channel">
</a>

<br><br>

<a href="https://web-to-app-builder.vercel.app/">
  <img src="https://files.catbox.moe/0narey.jpg" alt="FG MAFIAN Web-to-App Builder preview" width="92%">
</a>

<br>

![Platform](https://img.shields.io/badge/Platform-Android-3DDC84?style=flat-square&logo=android&logoColor=white)
![Build](https://img.shields.io/badge/Build-GitHub%20Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white)
![Hosting](https://img.shields.io/badge/Hosting-Vercel-000000?style=flat-square&logo=vercel&logoColor=white)

</div>

---

## ✨ What it does

FG MAFIAN Web-to-App Builder lets a visitor submit a public HTTPS website and request an Android APK build.

- 🌐 Convert a website URL into an Android app.
- 🎨 Set the app name, package ID, orientation and theme colors.
- 🖼️ Add a home-screen icon and a separate opening-screen logo.
- ⚙️ Build the APK using GitHub Actions.
- 📥 Check build progress and download the finished APK from the website.
- 🎮 Play an optional lightweight **Tic-Tac-Toe** game against the computer while GitHub builds your APK, or skip it.

## 🚀 Open the website

**[https://web-to-app-builder.vercel.app/](https://web-to-app-builder.vercel.app/)**

Use the website navigation to open **Home**, **Create App**, **My Builds**, **Quick Guide** and **About**. After a build request is accepted, choose **PLAY GAME** to play Tic-Tac-Toe against the computer, or **SKIP GAME** / close the game prompt. The game has no external assets, audio, background animation loop, or build-status overlay. The GitHub Actions build runs independently on GitHub, so visitors can navigate away or close the website without cancelling the build. If they return later, they can check the saved build in **My Builds** (browser storage is device/browser-specific).

## 👑 Project contact

| Contact | Link |
|---|---|
| Owner | [Precious Famile — Contact on Telegram](https://t.me/FG_MAFIAN) |
| Telegram channel | [Join FG MAFIAN](https://t.me/fgmafian) |
| Website | [Open FG MAFIAN Builder](https://web-to-app-builder.vercel.app/) |

## 🛠️ Deployment notes

1. Deploy this repository from its **root directory** on Vercel. Do not set `api` as the Vercel Root Directory.
2. Keep `api/` and `.github/workflows/` at the repository root.
3. Add these Vercel environment variables:

   - `GITHUB_TOKEN`
   - `GITHUB_OWNER`
   - `GITHUB_REPO`
   - `GITHUB_BRANCH` (optional; defaults to `main`)
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `DOWNLOAD_LIMIT_PER_HOUR` (optional; defaults to `3`; set `0` for no hourly limit)

   **Set up the Upstash Redis values:** Create a Redis database in your Upstash account, open its **REST API** section, and copy the REST URL and REST token into the two matching Vercel environment variables above. Keep the token private; do not put it in frontend code, this README, or a public GitHub file. Upstash is required for server-side, atomic download tracking. Build submissions only check the current successful-download count; they do not increment it. A download is counted once per unique workflow run, only after the complete APK stream finishes. Failed/cancelled builds and interrupted downloads are not counted. `DOWNLOAD_LIMIT_PER_HOUR` controls the per-network hourly limit and defaults to 3; set it to `0` to disable the limit while keeping duplicate-download protection and tracking.

4. Add the variables in Vercel under **Project → Settings → Environment Variables**. Apply them to the environments where you deploy (Production, and Preview/Development if you use those environments).
5. The GitHub token needs permission to dispatch and read workflow runs, and the workflow token needs permission to publish release assets. Keep `.github/workflows/build-apk.yml` in the GitHub repository root on the default branch and deploy using the same repository and branch configured in Vercel. `GITHUB_BRANCH` selects the branch used for each workflow dispatch (defaults to `main`).
6. Enable GitHub Actions for the repository.
7. Redeploy Vercel after adding or changing environment variables. Then open the API health check below and confirm that its configuration reports are healthy before trying a real APK build.

### API health check

After deployment, open:

`https://web-to-app-builder.vercel.app/api/health`

A working API should return JSON with `"ok": true`.

---

<div align="center">

**Made and maintained by Precious Famile**  
**𝗙𝗚 𝗠𝗔𝗙𝗜𝗔𝗡**

<a href="https://web-to-app-builder.vercel.app/">Website</a> ·
<a href="https://t.me/FG_MAFIAN">Contact owner</a> ·
<a href="https://t.me/fgmafian">Join channel</a>

</div>

## Public APK sharing
After a successful build, the builder displays a **Copy public download link** control alongside **Download APK**. The copied URL points to the server-side download endpoint for that completed build. Anyone with the URL can download the APK; the GitHub token is never included in the URL. The link remains usable while the matching GitHub release and APK asset are available.

## FG MAFIAN PRO account and admin upgrade

The existing website UI and APK build flow remain in place. The upgrade adds `/account` for Supabase email/password accounts, optional cloud-saved project records, and `/admin` for restricted platform controls (user plan assignment, blocking/unblocking accounts, and maintenance mode). Admin access is enforced by the server-side `ADMIN_EMAILS` allowlist; hiding a page link is not used as a security boundary.

### Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor** and run the complete `supabase/schema.sql` file from this repository.
3. In Vercel, add:
   - `SUPABASE_URL` — project URL.
   - `SUPABASE_ANON_KEY` — publishable/anon key (safe for browser use; never use the service-role key here).
   - `SUPABASE_SERVICE_ROLE_KEY` — service-role secret, server-side only.
   - `ADMIN_EMAILS` — comma-separated administrator email addresses, for example `owner@example.com`.
4. In Supabase **Authentication → URL Configuration**, set the Site URL to your deployed Vercel domain and add your Vercel production/preview callback URLs to the allowed redirect URLs.
5. Deploy/redeploy the project. Open `/account`, create an account, and sign in. The admin email must exactly match an entry in `ADMIN_EMAILS` to use `/admin`.

The SQL deliberately prevents normal users from changing their own `role`, `plan`, or `is_blocked` fields. The server-side admin API uses the service-role key only after validating the signed-in user's session and email allowlist.

### Current PRO feature boundaries

- Existing icon, splash logo, app name, package ID, description, colors, orientation, display mode, pull-to-refresh and navigation controls are retained.
- Version name and version code are now configurable and applied to the Android Gradle project during the workflow.
- Build history remains available in the browser's My Builds page. If a user is signed in when a build is submitted, the project/build metadata is also upserted to their Supabase account.
- Admin can manually assign Free/Premium labels and block/unblock accounts. A payment processor is not connected, and Premium does not yet change the hourly IP-based download cap. Do not advertise paid subscriptions as purchasable until a payment provider and entitlement enforcement are configured.
- Maintenance mode is stored in Supabase and prevents new build dispatches while enabled. It does not cancel builds already running on GitHub Actions.
- Public APK links continue to point to the server download endpoint. The release must remain available on GitHub for the link to work.

### Additional Vercel environment variables

In addition to the existing GitHub and Upstash variables, configure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `ADMIN_EMAILS`. Never place `SUPABASE_SERVICE_ROLE_KEY` or `GITHUB_TOKEN` in frontend JavaScript or public repository files. The `/api/health` endpoint reports whether the account/admin configuration is present, but does not expose secret values.
