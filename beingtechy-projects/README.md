# Beingtechy Projects

A showcase site for all your projects, plus a password-protected admin panel to add, edit, reorder and delete them.

- **Public page** (`/`) — project cards with a live screenshot of each website, Free / Freemium / Paid badges, filters and search, dark mode.
- **Admin panel** (`/admin`) — add a project by pasting its URL; **Auto-fill** reads the name and description from the site, and the thumbnail is taken automatically. Set pricing, a price label, tags, a custom thumbnail, and "featured".

No frameworks, no build step — plain HTML/CSS/JS + three Vercel serverless functions.

---

## Deploy to Vercel (≈5 minutes)

1. **Push to GitHub**
   ```bash
   cd beingtechy-projects
   git init && git add . && git commit -m "Projects site"
   git branch -M main
   git remote add origin https://github.com/<you>/beingtechy-projects.git
   git push -u origin main
   ```

2. **Import in Vercel** → *Add New → Project* → pick the repo → **Deploy** (no settings to change).

3. **Set your admin password** → *Project → Settings → Environment Variables*
   | Name | Value |
   |---|---|
   | `ADMIN_PASSWORD` | a strong password of your choice |

4. **Add the database (free)** → *Project → Storage → Create Database → Upstash → Redis* → connect it to the project.
   This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.

5. **Redeploy** (*Deployments → ⋯ → Redeploy*) so the new variables are picked up.

6. Visit `https://<your-site>/admin`, log in, and start adding projects.

**Custom domain:** *Settings → Domains* → add e.g. `projects.beingtechy.org`, then add the CNAME record Vercel shows you at your DNS provider.

> Until step 4 is done, the site still works and shows Hey Ticket and Pocket Ledger, but the admin panel is read-only (it shows a yellow banner).

---

## Run locally

```bash
npm run dev
# → http://localhost:3000        public page
# → http://localhost:3000/admin  admin (password: admin)
```
Local data is saved to `.local-data.json`.

---

## How thumbnails work

1. If you set a **custom thumbnail URL** in admin, that image is used.
2. Otherwise a live screenshot is taken by **WordPress mShots** (free, no API key). The very first screenshot of a new site takes ~10–20 s; the page waits and retries automatically, and **↻ Refresh screenshot** in admin forces a new one after you update a site.
3. If that fails, **thum.io** is tried.
4. If both fail, a neat card with the project's initial is shown.

---

## Files

```
index.html          public listing page
admin.html          admin panel
assets/style.css    shared styles (light + dark)
assets/common.js    screenshots, theme toggle, helpers
assets/admin.js     admin panel logic
api/projects.js     GET list · POST create · PUT update/reorder · DELETE
api/login.js        password → signed 7-day token
api/meta.js         reads title/description from a URL (Auto-fill)
api/_lib.js         storage (Upstash Redis / local file) + auth + seed projects
dev-server.js       local preview server
```

**Optional env var:** `AUTH_SECRET` — signs login tokens (defaults to `ADMIN_PASSWORD`). Changing either one logs out all sessions.
