# Get every website enquiry in Google Sheets + an email alert

Result: when someone fills the contact form on your KDS website, the enquiry

1. appears in the **Enquiries** page of your admin panel (`/aaddmmiinn`),
2. is added as a new row in a **Google Sheet** (with a colour-coded Status dropdown: New / Contacted / Done), and
3. is **emailed to 287kushal@gmail.com** (with the person's name, phone, email, service and requirement). Turn on Gmail notifications on your phone and you get a push alert too.

It's free and takes about 10 minutes. Do it while signed in to the Google account you want the sheet to live in (use 287kushal@gmail.com).

---

## Step 1 — Create the Google Sheet
1. Go to <https://sheets.google.com> → **Blank spreadsheet**.
2. Rename it to **KDS Enquiries** (top-left).

## Step 2 — Add the script
1. In the sheet, click **Extensions → Apps Script**. A code editor opens.
2. Delete everything in the editor.
3. Open `google-apps-script/Code.gs` from this project (or admin panel → **Google Sheet & Email** → *Copy script*) and paste it in.
4. Near the top, change this line to your own long random secret (letters + numbers, 20+ characters, no spaces):
   ```js
   const SECRET = 'PUT-A-LONG-RANDOM-SECRET-HERE';
   ```
   Remember this secret — you'll paste the same one into the admin panel in Step 5.
   `NOTIFY_EMAIL` is already `287kushal@gmail.com`.
5. Click the 💾 **Save** icon (name the project *KDS Enquiries* if asked).

## Step 3 — Authorise it (one time)
1. In the function dropdown at the top choose **testSetup**, then click **▶ Run**.
2. Click **Review permissions** → choose your Google account → **Advanced → Go to KDS Enquiries (unsafe)** → **Allow**.
   (Google shows this warning for every personal script; it's your own code.)
3. Check your inbox — you should get a **[TEST] New KDS enquiry** email, and an *Enquiries* tab with a header row appears in the sheet.

## Step 4 — Publish it as a web app
1. Click **Deploy → New deployment**.
2. Click the ⚙ gear next to *Select type* → **Web app**.
3. Fill in:
   - **Description:** KDS enquiries
   - **Execute as:** **Me (287kushal@gmail.com)**
   - **Who has access:** **Anyone**
4. Click **Deploy** and copy the **Web app URL** — it ends with `/exec`.
   Opening that URL in a browser should show `{"ok":true,"service":"KDS enquiries"…}`.

> If you ever edit the script later: **Deploy → Manage deployments → ✏ Edit → Version: New version → Deploy**. (The URL stays the same.)

## Step 5 — Connect it to your website
1. Open **http://your-site/aaddmmiinn** and log in → **Google Sheet & Email** tab.
2. Paste the **Web app URL** and the **same Secret key** from Step 2 → **Save**.
3. Click **Send test enquiry**. Within seconds you should see a new row in the sheet and an email in your inbox. ✅

From now on every enquiry is forwarded automatically. In the admin **Enquiries** page each one shows **Sheet ✓**; if Google was unreachable it shows **Sheet ✗** with a **Resend** button.

## Step 6 (optional) — Phone notifications & daily reminder
- **Phone alert:** install the Gmail app on your phone, sign in with 287kushal@gmail.com, and keep notifications on. In Gmail, open one "New KDS enquiry" email → ⋮ → *Filter messages like this* → **Always mark it as important** / **Apply label** — so enquiries stand out.
- **Daily reminder for unanswered enquiries:** in the Apps Script editor choose **createDailyReminder** → **Run** once. Every morning (~9 am) you get an email listing enquiries whose **Status** is still *New* in the sheet. Change the Status cell to *Contacted* / *Done* when handled.

## Troubleshooting
| Problem | Fix |
|---|---|
| Admin test says *Wrong secret key* | The secret in the script and in the admin panel must be exactly the same. If you change it in the script, redeploy a **New version**. |
| Test says *Unexpected reply* | Deploy → Manage deployments → make sure **Who has access = Anyone**, then use the newest `/exec` URL. |
| No email arrives | Check Spam; run **testSetup** in the editor again and re-authorise. Free Gmail can send ~100 script emails/day. |
| Rows appear but no email | You haven't authorised mail permission — run **testSetup** (Step 3). |
| Website enquiry shows **Sheet ✗** | Click **Resend** after fixing the cause; the full error is shown under the enquiry. |

Your enquiries are always saved in the admin panel too, even if Google is down.
