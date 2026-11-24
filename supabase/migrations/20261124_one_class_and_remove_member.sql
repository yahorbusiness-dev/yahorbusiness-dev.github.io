-- A student can be in one class only, and a teacher can remove a student from
-- their own class (the student can then join another class with a new code).
create unique index if not exists class_members_one_class_per_student on public.class_members (user_id);

create or replace function public.join_class(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_class classes;
  v_school text;
  v_uid uuid := auth.uid();
  v_role text := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
  v_fails integer;
  v_members integer;
  v_current uuid;
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
  select class_id into v_current from class_members where user_id = v_uid;
  if v_current is not null and v_current <> v_class.id then
    raise exception 'Du är redan med i en klass. Du kan bara vara med i en klass åt gången.' using errcode = 'P0001';
  end if;
  if v_current is null then
    select count(*) into v_members from class_members where class_id = v_class.id;
    if v_members >= v_class.max_students then
      raise exception 'Klassen är full. Fråga din lärare.' using errcode = 'P0001';
    end if;
    insert into class_members (class_id, user_id) values (v_class.id, v_uid);
  end if;
  select name into v_school from schools where id = v_class.school_id;
  return json_build_object('class_id', v_class.id, 'class_name', v_class.name, 'school_name', v_school, 'package_id', v_class.package_id);
end $$;

create or replace function public.remove_class_member(p_class_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'teacher'
     or not exists (select 1 from classes where id = p_class_id and teacher_id = auth.uid()) then
    raise exception 'Du kan bara ta bort elever ur dina egna klasser.' using errcode = 'P0001';
  end if;
  delete from class_members where class_id = p_class_id and user_id = p_user_id;
  if not found then raise exception 'Eleven är inte med i klassen.' using errcode = 'P0001'; end if;
end $$;

revoke all on function public.join_class(text) from public, anon;
revoke all on function public.remove_class_member(uuid, uuid) from public, anon;
grant execute on function public.join_class(text) to authenticated;
grant execute on function public.remove_class_member(uuid, uuid) to authenticated;
