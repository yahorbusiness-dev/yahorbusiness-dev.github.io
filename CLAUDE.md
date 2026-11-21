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

## Skolor, klasser och lektionspaket

- Tables `schools`, `school_teachers` (admin links an approved teacher to a school),
  `classes` (teacher-owned, unique `join_code`), `class_members`, `lesson_packages`;
  `lessons.package_id` marks a package's student lessons (first package:
  `test-lektion` with lessons `barnbyar-1..5`). See `supabase/migrations/`.
- Teachers create classes via RPC `create_class(name)`; students join via
  `join_class(code)`. RLS lets a teacher read only their own students' profiles
  and progress.
- Admin panel → Skolor: create schools, link teachers, see classes and students.
- Students join on `oversikt.html` ("Gå med i din klass") and then see the package's
  lessons there. Lessons with a `package_id` are left out of Kurser and open only to
  class members and teachers (`CLASS_PACKAGES` in `stitch-assets/app.js`). Lessons with
  an empty `quiz` are completed after the last step.
- The teacher file ("Ladda ner lektionen" on `larare.html`) comes from the Edge Function
  `teacher-file` (teachers only). It serves `lesson_packages.teacher_file` from the
  private Storage bucket `teacher-files` if uploaded, else a generated placeholder PDF.

## Lösenord

"Glömt lösenord?" on both login pages (and "Skicka återställningslänk" in the
admin panel) e-mails a Supabase recovery link to `nytt-losenord.html`, which must
be listed under Auth > URL Configuration > Redirect URLs. `index.html` forwards
recovery links that land on the site root.

## Styles

`stitch-assets/tailwind.css` is a prebuilt Tailwind v3 file. After adding new
classes, rebuild it (content: `*.html`, `_admin/*`, `stitch-assets/app.js`).
