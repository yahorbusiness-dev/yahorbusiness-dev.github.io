-- Teachers only see their students' progress in package (class) lessons, not in
-- the student's other courses (matches integritetspolicy.html).
drop policy if exists "teachers read their students' progress" on public.user_lesson_progress;
create policy "teachers read their students' progress" on public.user_lesson_progress
  for select using (
    public.is_teacher_of(user_id)
    and exists (select 1 from public.lessons l where l.id = lesson_id and l.package_id is not null)
  );

-- Private bucket for the teacher files (PDF). Only the service role (the admin
-- and teacher-file Edge Functions) reads or writes it; no storage policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('teacher-files', 'teacher-files', false, 20971520, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
