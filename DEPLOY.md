# Deploying to GitHub Pages

The repo is committed and ready. You need to create the remote and push —
I don't have credentials to your GitHub account, so that part is yours.

---

## Option A — Web upload (no command line)

1. Go to **github.com/new**
2. Repository name: `gracebanquet` · **Public** · do **not** tick "Add a README"
3. Click **Create repository**
4. On the empty repo page, click **uploading an existing file**
5. Unzip `gracebanquet-repo.zip` and drag **the contents** in (not the folder itself)
   - Drag the files and the `css`, `js`, `images` folders together
6. Commit
7. **Settings → Pages → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**
8. Wait 1–2 minutes. Site goes live at:
   `https://<your-username>.github.io/gracebanquet/`

> **The `.nojekyll` file matters.** Drag-and-drop upload sometimes skips dotfiles.
> If your CSS doesn't load after deploy, create it manually:
> **Add file → Create new file → name it `.nojekyll` → commit.**

---

## Option B — Command line

The repo already has an initial commit, so just add the remote and push:

```bash
cd gracebanquet-repo

git remote add origin https://github.com/<your-username>/gracebanquet.git
git push -u origin main
```

Then **Settings → Pages → Source: Deploy from a branch → `main` / `(root)` → Save.**

If you'd rather start fresh:

```bash
git init -b main
git add -A
git commit -m "Grace Banquet frontend"
git remote add origin https://github.com/<your-username>/gracebanquet.git
git push -u origin main
```

GitHub no longer accepts passwords over HTTPS. Use a Personal Access Token
(**Settings → Developer settings → Tokens (classic) → `repo` scope**) as the
password, or set up SSH.

---

## Live URL

| Repo name | URL |
|---|---|
| `gracebanquet` | `https://<username>.github.io/gracebanquet/` |
| `<username>.github.io` | `https://<username>.github.io/` (root) |

Naming the repo `<your-username>.github.io` puts the site at the root instead of
a subpath. Either works — all links in this site are relative, so both are fine.

---

## Pointing gracebanquet.pk at GitHub Pages (optional)

You can preview on `github.io` and keep the real domain on Spaceship. But if you
want the live domain on Pages instead:

**1. In the repo:** Settings → Pages → Custom domain → `gracebanquet.pk` → Save.
That creates a `CNAME` file in the repo.

**2. At WebSouls DNS**, add four A records for the apex:

```
A   @   185.199.108.153
A   @   185.199.109.153
A   @   185.199.110.153
A   @   185.199.111.153
CNAME  www   <your-username>.github.io
```

**3.** Back in Settings → Pages, tick **Enforce HTTPS** once the cert issues
(can take up to 24 hours).

> **Decide one or the other.** Don't point the domain at GitHub Pages *and*
> Spaceship — the DNS can only resolve to one. Use Pages for staging and
> Spaceship for production, or move fully to one.

---

## Updating the site after deploy

```bash
# swap in real photos, edit copy, etc.
git add -A
git commit -m "Add real venue photography"
git push
```

Pages rebuilds in about a minute.

---

## After it's live — check these

- [ ] All 7 pages load, plus a bad URL shows the branded 404
- [ ] Fonts render as Outfit/Inter, not system sans (hard-refresh once)
- [ ] Enquiry form opens WhatsApp with details prefilled — **test on a real phone**
- [ ] WhatsApp float button works on mobile
- [ ] Google Maps embed shows the right location
- [ ] Gallery filters and lightbox work
- [ ] Mobile nav opens and closes

---

## Known: this is a staging deploy

Every image is a navy placeholder. The site is structurally complete and
fully functional, but it will not look finished until real photography
replaces `images/`. Sizes are listed in `README.md`.

Also outstanding: three placeholder testimonials, and the high-res logo.
