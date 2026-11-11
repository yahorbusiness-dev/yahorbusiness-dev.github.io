# UngEkonom – notes for Claude

Static site on GitHub Pages (this repo, branch `main`) with a Supabase backend
(project `psvjlxqdqcuhmafqorlv`).

## Adminpanelen

The admin panel is **not** on the public site. It lives in `_admin/` (Jekyll
never publishes folders starting with `_`) and is only opened from a Claude
session. When the user asks to open the admin panel ("öppna adminpanelen"):

1. Start a local server for that folder (`_admin/stitch-assets` is a symlink to
   the shared assets):
   `python3 -m http.server 8787 --directory _admin` (run it in the background).
2. Report port 8787 as the preview port so the page opens in the Claude app.
3. The user logs in with their admin account on the panel's own login form.

Only accounts with `app_metadata.role = 'admin'` can use it, and the `admin`
Edge Function (`supabase/functions/admin/`) checks that on every request.

## Roles

- Students log in on `auth.html`, teachers on `larare-konto.html`. Each page
  only lets in its own kind of account; admin accounts can't log in on either.
- Teacher access is `app_metadata.role = 'teacher'`, set only by an admin.
  A teacher sign-up just sets `user_metadata.requested_role = 'teacher'`.

## Styles

`stitch-assets/tailwind.css` is a prebuilt Tailwind v3 file. After adding new
classes, rebuild it (content: `*.html`, `_admin/*`, `stitch-assets/app.js`).
