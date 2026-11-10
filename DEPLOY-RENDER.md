# Hosting the KDS website on Render — FREE plan

Render's free plan has two quirks:
1. **The disk is temporary** — it is erased every time the service restarts or redeploys.
2. **The service sleeps after ~15 minutes without visitors** and takes ~30–60 s to wake up on the next visit.

Quirk 1 would normally wipe everything you add in the admin panel, so this project saves
`db.json` (services, plans, projects, team, enquiries) and every uploaded image into a **private GitHub repo** and
restores them whenever the site starts. It's free, versioned, and you can read it any time.

## Step 1 — Create the private data repo (2 min)
1. GitHub → **New repository** → name it `kds-data` → **Private** → tick **Add a README** → Create.
   (It must be private: it will contain your enquiries.)

## Step 2 — Create an access token (2 min)
1. GitHub → profile photo → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Name: `kds-render`. Expiration: choose the longest you're comfortable with (when it expires, saving stops until you make a new one).
3. **Repository access → Only select repositories → `kds-data`**.
4. **Permissions → Repository permissions → Contents: Read and write.**
5. Generate and **copy the token** (starts with `github_pat_…`). You'll paste it into Render; never commit it anywhere.

## Step 3 — Deploy on Render (3 min)
1. <https://dashboard.render.com> → **New + → Blueprint** → connect GitHub → choose **kushal287/kds** → *Apply*.
2. Fill in the values it asks for:

| Variable | Value |
|---|---|
| `ADMIN_PASSWORD` | the password you'll use at `/aaddmmiinn` (strong!) |
| `GH_DATA_REPO` | `kushal287/kds-data` |
| `GH_TOKEN` | the token from Step 2 |
| `KDS_WEBHOOK_URL` | *(optional)* your Apps Script URL ending in `/exec` |
| `KDS_WEBHOOK_SECRET` | *(optional)* the SECRET from your Apps Script |

3. Click **Apply**. When the deploy finishes, open `https://kds-website.onrender.com` (your URL may differ).
4. In the Render **Logs** you should see `Data repo has no db.json yet — starting with the default content.` the first time,
   and `Restored site data from GitHub` on every later start. That line means storage works.

## Step 4 — Add your content
Log in at `https://<your-site>/aaddmmiinn` with `ADMIN_PASSWORD`, then add services, plans, projects and team.
Each save appears as a commit in `kds-data` within a few seconds.

## Good to know
- **Admin password:** on this setup it comes from the `ADMIN_PASSWORD` variable. To change it, edit the variable in Render → *Environment* and redeploy (the password form inside the panel is disabled).
- **Uploads:** images are cropped before upload so they stay small. Files above **25 MB** (e.g. an APK) are rejected — upload them to Google Drive / a GitHub Release and paste the link in the project instead.
- **Waking up:** the first visit after idle is slow. To keep it warm for free, add a monitor at <https://uptimerobot.com> or <https://cron-job.org> that requests `https://<your-site>/healthz` every 10 minutes. (Free instances get 750 hours/month, enough for one always-on service.)
- **Enquiries** are saved in the data repo *and* sent to your Google Sheet / email if you connected the Apps Script.
- **Backups:** `kds-data` is your backup — every change is a commit you can restore from.
- **Updating the site code:** push to `kushal287/kds` → Render redeploys automatically; your content is restored from `kds-data`.
- **Custom domain:** Render → service → *Settings → Custom Domains*. HTTPS is automatic.
- **If saving fails** (e.g. the token expired) the Logs show `Saving to the data repo failed`. Create a new token and update `GH_TOKEN`. Changes made meanwhile are retried, and are kept as long as the service stays running.
- If the service can't reach the data repo at start-up it **refuses to start** (on purpose) rather than risk overwriting your data with an empty site.

## Prefer paid, simpler storage?
Render's Starter plan can attach a persistent disk. Set `plan: starter`, add a `disk` mounted at `/var/data`, set `DATA_DIR=/var/data`,
and you don't need `GH_DATA_REPO` / `GH_TOKEN` at all.
