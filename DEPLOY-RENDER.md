# Hosting the KDS website on Render

The repo already contains `render.yaml`, so Render can set everything up for you.

## 1. Deploy
1. Go to <https://dashboard.render.com> → **New + → Blueprint**.
2. Connect GitHub and choose the repo **kushal287/kds** → *Apply*.
3. Render asks for the secret values:
   - **ADMIN_PASSWORD** – the password you will use at `/aaddmmiinn` (choose a strong one).
   - **KDS_WEBHOOK_URL** – your Apps Script URL ending in `/exec` (optional now, you can also add it later in the admin panel).
   - **KDS_WEBHOOK_SECRET** – the `SECRET` from your Apps Script (optional, same as above).
4. Click **Apply**. After the first deploy your site is live at `https://kds-website.onrender.com` (or similar).

Check: open the site, then `https://<your-site>/aaddmmiinn` and log in with `ADMIN_PASSWORD`.

## 2. Why the "starter" plan + disk
Render's **free** web services have a temporary filesystem: every restart or redeploy erases `data/`, so all admin changes,
uploaded images and enquiries would disappear (and free services also sleep after ~15 min idle).
The Blueprint therefore uses a paid **Starter** instance with a **1 GB persistent disk** mounted at `/var/data`
(`DATA_DIR=/var/data`). Check Render's pricing page for current prices.

Want to try it free first? Remove the `disk:` block and set `plan: free` in `render.yaml` — it works, but
treat it as a demo: content resets whenever the service restarts. Your admin password and Google Sheet link still come
back automatically from the environment variables.

## 3. Custom domain
Render dashboard → your service → **Settings → Custom Domains** → add your domain and follow the DNS instructions. HTTPS is automatic.

## 4. Things worth knowing
- **Admin password:** on a hosted site the public "create password" screen is disabled; the password comes from `ADMIN_PASSWORD`.
  You can change it in the admin panel afterwards. To force-reset it: set `ADMIN_PASSWORD` to the new value **and** `ADMIN_PASSWORD_RESET=true`, redeploy, then delete the reset variable.
- **Google Sheet / email:** works the same. The env vars are only a fallback; whatever you save in the admin panel is used first.
- **Backups:** your content lives in `/var/data` (`db.json` + `uploads/`). Download a copy occasionally (Render → service → *Shell*, or use the CSV export for enquiries).
- **Updating the site:** push to GitHub → Render redeploys automatically (`autoDeploy: true`). Your data on the disk is untouched.
- **Health check:** Render pings `/healthz`.
