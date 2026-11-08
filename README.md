# KDS — Kushal Developer Studios website

Black & gold website with a WebGL molten-silk interactive background, a scroll-driven 3D laptop,
and a full admin panel. No dependencies — just Node.js 18+.

## Run

```
node server.js
```
(or double-click `start.bat`)

- Website: http://localhost:3000
- Admin:   http://localhost:3000/aaddmmiinn — log in with the admin password.

Optional: `PORT=8080` to change the port, `ADMIN_PASSWORD=...` to preset the password on a fresh install.

## Admin panel
- **Services** – cards in “Services we offer” (6 defaults included).
- **Pricing & Brochures** – plan cards with price, included features, badge, optional brochure upload. Section is hidden until you add one.
- **Projects** – image, tags, live / APK / GitHub / other links, client name + photo, testimonial and a 0–5 star selector. Hidden until you add one.
- **Team** – photo, position, Instagram / GitHub / LinkedIn / YouTube. Use the position number or ↑ ↓ to reorder.
- **Messages** – enquiries from the website contact form.
- **Site settings** – hero/about text, phone, email, WhatsApp, KDS social links, stats, password.

Any empty field is hidden on the website.

## Data
Stored in `data/` (`db.json`, uploaded files in `data/uploads/`, hashed password in `auth.json`). Back this folder up.
Keep `data/` out of public repositories. If you deploy publicly, put the site behind HTTPS and set your admin password straight away.

## Enquiries → Google Sheet + email
See `SETUP-GOOGLE-SHEETS.md` (also shown step by step in the admin panel → “Google Sheet & Email”). The script is in `google-apps-script/Code.gs`.
