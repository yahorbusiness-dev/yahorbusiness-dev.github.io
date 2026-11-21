-- Applied to project psvjlxqdqcuhmafqorlv on 2026-11-21 (kept here for reference).
-- Schools, the teachers attached to them, classes with join codes, and lesson
-- packages (a teacher file + student lessons). Admin manages schools through
-- the admin Edge Function; teachers and students go through the RPCs below.

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  created_at timestamptz not null default now()
);

create table public.school_teachers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.lesson_packages (
  id text primary key,
  title text not null,
  teacher_file text,
  created_at timestamptz not null default now()
);

alter table public.lessons add column package_id text references public.lesson_packages(id);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  join_code text not null unique,
  package_id text references public.lesson_packages(id),
  created_at timestamptz not null default now()
);

create table public.class_members (
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, user_id)
);
create index class_members_user_idx on public.class_members(user_id);
create index classes_teacher_idx on public.classes(teacher_id);

alter table public.schools enable row level security;
alter table public.school_teachers enable row level security;
alter table public.lesson_packages enable row level security;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;

create or replace function public.is_class_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from class_members where class_id = cid and user_id = auth.uid());
$$;

create or replace function public.is_class_teacher(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from classes where id = cid and teacher_id = auth.uid());
$$;

create or replace function public.is_teacher_of(student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from class_members cm join classes c on c.id = cm.class_id
    where cm.user_id = student and c.teacher_id = auth.uid()
  );
$$;

create policy "teachers read their school" on public.schools for select to authenticated
  using (exists (select 1 from public.school_teachers st where st.user_id = auth.uid() and st.school_id = schools.id)
      or exists (select 1 from public.classes c where c.school_id = schools.id and public.is_class_member(c.id)));
create policy "teachers read their own school link" on public.school_teachers for select to authenticated
  using (user_id = auth.uid());
create policy "packages readable when signed in" on public.lesson_packages for select to authenticated using (true);
create policy "classes readable by teacher and members" on public.classes for select to authenticated
  using (teacher_id = auth.uid() or public.is_class_member(id));
create policy "members readable by self and class teacher" on public.class_members for select to authenticated
  using (user_id = auth.uid() or public.is_class_teacher(class_id));
create policy "teachers read their students' profiles" on public.profiles for select to authenticated
  using (public.is_teacher_of(id));
create policy "teachers read their students' progress" on public.user_lesson_progress for select to authenticated
  using (public.is_teacher_of(user_id));

-- create_class(p_name) and join_class(p_code): see the project's database for the
-- full bodies (security definer; create_class requires app_metadata.role = 'teacher'
-- and a school_teachers row, join_class refuses teacher/admin accounts).

insert into public.lesson_packages (id, title, teacher_file) values ('test-lektion', 'Test lektion', 'test-lektion.pdf');
-- + five placeholder lessons barnbyar-1..5 (category 'barnbyar', package_id 'test-lektion').
