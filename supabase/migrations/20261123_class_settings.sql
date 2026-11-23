-- Class settings chosen by the teacher: own or random join code, max students
-- (default 30) and one of five class logos. join_class enforces the cap and
-- limits wrong-code guesses (10 per hour per account).
alter table public.classes
  add column if not exists max_students integer not null default 30,
  add column if not exists logo text not null default 'tillvaxt';
alter table public.classes drop constraint if exists classes_max_students_check;
alter table public.classes add constraint classes_max_students_check check (max_students between 1 and 100);
alter table public.classes drop constraint if exists classes_logo_check;
alter table public.classes add constraint classes_logo_check check (logo in ('tillvaxt', 'spara', 'mal', 'budget', 'laget'));

create table if not exists public.class_join_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index if not exists class_join_attempts_user_time on public.class_join_attempts (user_id, attempted_at);
alter table public.class_join_attempts enable row level security; -- no policies: only the functions write/read it

-- Validates a teacher-chosen code; returns it normalised (upper case, trimmed)
create or replace function public._class_code_checked(p_code text, p_class_id uuid default null)
returns text language plpgsql stable security definer set search_path = public as $$
declare v text := upper(trim(coalesce(p_code, '')));
begin
  if length(v) < 6 or length(v) > 16 or v !~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' then
    raise exception 'Koden ska vara 6–16 tecken: bokstäver A–Z, siffror och bindestreck.' using errcode = 'P0001';
  end if;
  if exists (select 1 from classes where join_code = v and id is distinct from p_class_id) then
    raise exception 'Den koden används redan. Välj en annan.' using errcode = 'P0001';
  end if;
  return v;
end $$;

-- Random code: up to 5 letters/digits from the class name + 6 random characters
create or replace function public._class_code_random(p_name text)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  v_alpha text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_prefix text := upper(left(regexp_replace(coalesce(p_name, ''), '[^A-Za-z0-9]', '', 'g'), 5));
  v_code text;
begin
  if v_prefix = '' then v_prefix := 'KLASS'; end if;
  loop
    v_code := v_prefix || '-' || (select string_agg(substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1), '') from generate_series(1, 6));
    exit when not exists (select 1 from classes where join_code = v_code);
  end loop;
  return v_code;
end $$;
revoke all on function public._class_code_checked(text, uuid) from public, anon, authenticated;
revoke all on function public._class_code_random(text) from public, anon, authenticated;

drop function if exists public.create_class(text);
create or replace function public.create_class(p_name text, p_code text default null, p_max_students integer default 30, p_logo text default 'tillvaxt')
returns classes language plpgsql security definer set search_path = public as $$
declare
  v_school uuid;
  v_row classes;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'teacher' then
    raise exception 'Endast godkända lärare kan skapa klasser.' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Klassen behöver ett namn.' using errcode = 'P0001'; end if;
  if p_max_students is null or p_max_students < 1 or p_max_students > 100 then
    raise exception 'Antal elever ska vara mellan 1 och 100.' using errcode = 'P0001';
  end if;
  if coalesce(p_logo, '') not in ('tillvaxt', 'spara', 'mal', 'budget', 'laget') then
    raise exception 'Välj en av logotyperna.' using errcode = 'P0001';
  end if;
  select school_id into v_school from school_teachers where user_id = auth.uid();
  if v_school is null then
    raise exception 'Ditt konto är inte kopplat till någon skola än. Kontakta UngEkonom.' using errcode = 'P0001';
  end if;
  insert into classes (school_id, teacher_id, name, join_code, package_id, max_students, logo)
  values (v_school, auth.uid(), trim(p_name),
          case when nullif(trim(coalesce(p_code, '')), '') is null then _class_code_random(p_name) else _class_code_checked(p_code) end,
          'test-lektion', p_max_students, p_logo)
  returning * into v_row;
  return v_row;
end $$;

-- p_code: null keeps the code; p_random_code regenerates it
create or replace function public.update_class(p_class_id uuid, p_name text, p_max_students integer, p_logo text, p_code text default null, p_random_code boolean default false)
returns classes language plpgsql security definer set search_path = public as $$
declare
  v_row classes;
  v_members integer;
begin
  select * into v_row from classes where id = p_class_id and teacher_id = auth.uid();
  if v_row.id is null or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'teacher' then
    raise exception 'Du kan bara ändra dina egna klasser.' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Klassen behöver ett namn.' using errcode = 'P0001'; end if;
  if p_max_students is null or p_max_students < 1 or p_max_students > 100 then
    raise exception 'Antal elever ska vara mellan 1 och 100.' using errcode = 'P0001';
  end if;
  select count(*) into v_members from class_members where class_id = p_class_id;
  if p_max_students < v_members then
    raise exception 'Klassen har redan % elever. Välj minst %.', v_members, v_members using errcode = 'P0001';
  end if;
  if coalesce(p_logo, '') not in ('tillvaxt', 'spara', 'mal', 'budget', 'laget') then
    raise exception 'Välj en av logotyperna.' using errcode = 'P0001';
  end if;
  update classes set
    name = trim(p_name),
    max_students = p_max_students,
    logo = p_logo,
    join_code = case
      when p_random_code then _class_code_random(p_name)
      when nullif(trim(coalesce(p_code, '')), '') is null then join_code
      when upper(trim(p_code)) = join_code then join_code
      else _class_code_checked(p_code, p_class_id) end
  where id = p_class_id
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.join_class(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_class classes;
  v_school text;
  v_uid uuid := auth.uid();
  v_role text := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
  v_fails integer;
  v_members integer;
begin
  if v_uid is null then raise exception 'Du behöver vara inloggad.' using errcode = 'P0001'; end if;
  if v_role in ('teacher', 'admin') then raise exception 'Bara elevkonton kan gå med i en klass.' using errcode = 'P0001'; end if;
  select count(*) into v_fails from class_join_attempts where user_id = v_uid and attempted_at > now() - interval '1 hour';
  if v_fails >= 10 then
    raise exception 'För många felaktiga försök. Vänta en stund och försök igen.' using errcode = 'P0001';
  end if;
  select * into v_class from classes where join_code = upper(trim(coalesce(p_code, ''))) for update;
  if v_class.id is null then
    -- Not raised, so the failed attempt is kept and counts towards the limit
    insert into class_join_attempts (user_id) values (v_uid);
    delete from class_join_attempts where attempted_at < now() - interval '1 day';
    return json_build_object('error', 'Hittade ingen klass med den koden. Kontrollera stavningen.');
  end if;
  if not exists (select 1 from class_members where class_id = v_class.id and user_id = v_uid) then
    select count(*) into v_members from class_members where class_id = v_class.id;
    if v_members >= v_class.max_students then
      raise exception 'Klassen är full. Fråga din lärare.' using errcode = 'P0001';
    end if;
    insert into class_members (class_id, user_id) values (v_class.id, v_uid) on conflict do nothing;
  end if;
  select name into v_school from schools where id = v_class.school_id;
  return json_build_object('class_id', v_class.id, 'class_name', v_class.name, 'school_name', v_school, 'package_id', v_class.package_id);
end $$;

revoke all on function public.create_class(text, text, integer, text) from public, anon;
revoke all on function public.update_class(uuid, text, integer, text, text, boolean) from public, anon;
revoke all on function public.join_class(text) from public, anon;
grant execute on function public.create_class(text, text, integer, text) to authenticated;
grant execute on function public.update_class(uuid, text, integer, text, text, boolean) to authenticated;
grant execute on function public.join_class(text) to authenticated;
