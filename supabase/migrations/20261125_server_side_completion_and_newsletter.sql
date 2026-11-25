-- 3) Lessons are completed and XP is awarded on the server only.
--    complete_lesson grades the quiz from the submitted answers (original option
--    indexes), requires class membership for package lessons and that the lesson
--    was started at least a little while ago, then updates progress and XP once.
alter table public.user_lesson_progress add column if not exists started_at timestamptz not null default now();

create or replace function public.complete_lesson(p_lesson_id text, p_answers integer[] default '{}')
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_lesson lessons;
  v_quiz jsonb;
  v_steps integer;
  v_n integer;
  v_correct integer := 0;
  v_score integer;
  v_prev user_lesson_progress;
  v_min_seconds integer;
  v_profile profiles;
  v_today date := (now() at time zone 'utc')::date;
  v_streak integer;
  v_xp integer := 0;
  i integer;
begin
  if v_uid is null then raise exception 'Du behöver vara inloggad.' using errcode = 'P0001'; end if;
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('teacher', 'admin') then
    raise exception 'Bara elevkonton sparar lektioner.' using errcode = 'P0001';
  end if;
  select * into v_lesson from lessons where id = p_lesson_id;
  if v_lesson.id is null then raise exception 'Lektionen finns inte.' using errcode = 'P0001'; end if;
  if v_lesson.package_id is not null and not exists (
      select 1 from class_members m join classes c on c.id = m.class_id
      where m.user_id = v_uid and c.package_id = v_lesson.package_id) then
    raise exception 'Lektionen hör till en klass du inte är med i.' using errcode = 'P0001';
  end if;

  v_quiz := coalesce(v_lesson.content -> 'quiz', '[]'::jsonb);
  v_steps := jsonb_array_length(coalesce(v_lesson.content -> 'steps', '[]'::jsonb));
  v_n := jsonb_array_length(v_quiz);
  if v_n > 0 then
    if coalesce(array_length(p_answers, 1), 0) <> v_n then
      raise exception 'Svara på alla frågor i quizet.' using errcode = 'P0001';
    end if;
    for i in 0 .. v_n - 1 loop
      if p_answers[i + 1] = (v_quiz -> i ->> 'correct_index')::integer then v_correct := v_correct + 1; end if;
    end loop;
    v_score := round(v_correct * 100.0 / v_n);
  else
    v_score := 100;
  end if;

  select * into v_prev from user_lesson_progress where user_id = v_uid and lesson_id = p_lesson_id for update;
  -- Not too fast: about 5 seconds per step and question, at most 30 seconds
  v_min_seconds := least(30, 5 * (v_steps + v_n));
  if v_prev.user_id is null or v_prev.started_at > now() - make_interval(secs => v_min_seconds) then
    if v_prev.user_id is null then
      insert into user_lesson_progress (user_id, lesson_id, status, current_step) values (v_uid, p_lesson_id, 'in_progress', 0);
    end if;
    return json_build_object('passed', false, 'too_fast', true, 'score', v_score);
  end if;

  if v_score < 90 then
    return json_build_object('passed', false, 'score', v_score);
  end if;

  update user_lesson_progress set
    status = 'completed', current_step = v_steps,
    quiz_score = greatest(coalesce(quiz_score, 0), v_score),
    completed_at = coalesce(completed_at, now()), updated_at = now()
  where user_id = v_uid and lesson_id = p_lesson_id;

  select * into v_profile from profiles where id = v_uid for update;
  if v_prev.status is distinct from 'completed' then
    v_xp := coalesce(v_lesson.xp_reward, 0);
    v_streak := case
      when v_profile.last_active_date = v_today then v_profile.streak_days
      when v_profile.last_active_date = v_today - 1 then v_profile.streak_days + 1
      else 1 end;
    update profiles set
      xp = xp + v_xp,
      streak_days = v_streak,
      best_streak_days = greatest(coalesce(best_streak_days, 0), v_streak),
      minutes_today = case when last_active_date = v_today then minutes_today + coalesce(v_lesson.estimated_minutes, 0) else coalesce(v_lesson.estimated_minutes, 0) end,
      last_active_date = v_today,
      updated_at = now()
    where id = v_uid
    returning * into v_profile;
  end if;

  return json_build_object(
    'passed', true, 'score', v_score, 'xp_awarded', v_xp,
    'profile', json_build_object('xp', v_profile.xp, 'streak_days', v_profile.streak_days,
      'best_streak_days', v_profile.best_streak_days, 'last_active_date', v_profile.last_active_date,
      'minutes_today', v_profile.minutes_today));
end $$;
revoke all on function public.complete_lesson(text, integer[]) from public, anon;
grant execute on function public.complete_lesson(text, integer[]) to authenticated;

-- Students may only save "in progress" themselves; completed rows are server-owned.
drop policy if exists "progress is insertable by its owner" on public.user_lesson_progress;
create policy "progress is insertable by its owner" on public.user_lesson_progress
  for insert with check (auth.uid() = user_id and status in ('not_started', 'in_progress') and quiz_score is null and completed_at is null);
drop policy if exists "progress is updatable by its owner" on public.user_lesson_progress;
create policy "progress is updatable by its owner" on public.user_lesson_progress
  for update using (auth.uid() = user_id and status <> 'completed')
  with check (auth.uid() = user_id and status in ('not_started', 'in_progress') and quiz_score is null and completed_at is null);
-- Column privileges: the client writes only these columns (an upsert also sets
-- the key columns); started_at, quiz_score and completed_at are server-owned.
revoke insert, update on public.user_lesson_progress from authenticated, anon;
grant insert (user_id, lesson_id, status, current_step, updated_at) on public.user_lesson_progress to authenticated;
grant update (user_id, lesson_id, status, current_step, updated_at) on public.user_lesson_progress to authenticated;

-- Profiles: users can change their name and daily goal only; XP, streak and
-- activity are written by complete_lesson.
revoke update on public.profiles from authenticated, anon;
grant update (display_name, daily_goal_minutes, updated_at) on public.profiles to authenticated;
alter table public.profiles drop constraint if exists profiles_display_name_length;
alter table public.profiles add constraint profiles_display_name_length check (char_length(display_name) between 1 and 60) not valid;
alter table public.profiles drop constraint if exists profiles_daily_goal_range;
alter table public.profiles add constraint profiles_daily_goal_range check (daily_goal_minutes between 1 and 240) not valid;

-- 7) Newsletter: no direct inserts; one checked function with a format check,
--    duplicates ignored and a global limit against bulk spam.
drop policy if exists "Allow anonymous insert" on public.subscribers;
create unique index if not exists subscribers_email_lower on public.subscribers (lower(email));
create or replace function public.newsletter_subscribe(p_email text)
returns json language plpgsql security definer set search_path = public as $$
declare v text := lower(trim(coalesce(p_email, '')));
begin
  if length(v) > 254 or v !~ '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' then
    raise exception 'Skriv en giltig e-postadress.' using errcode = 'P0001';
  end if;
  if (select count(*) from subscribers where created_at > now() - interval '10 minutes') >= 30 then
    raise exception 'Många anmälningar just nu. Försök igen om en stund.' using errcode = 'P0001';
  end if;
  insert into subscribers (email) values (v) on conflict do nothing;
  return json_build_object('ok', true);
end $$;
revoke all on function public.newsletter_subscribe(text) from public;
grant execute on function public.newsletter_subscribe(text) to anon, authenticated;
