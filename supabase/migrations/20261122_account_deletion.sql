-- Self-service account deletion: the user confirms with their e-mail address,
-- the account is deleted 30 days later by a daily pg_cron job. The user can
-- cancel until then.
create extension if not exists pg_cron;

create table if not exists public.account_deletions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  delete_after timestamptz not null default now() + interval '30 days'
);
alter table public.account_deletions enable row level security;
drop policy if exists "users read their own deletion request" on public.account_deletions;
create policy "users read their own deletion request" on public.account_deletions
  for select using (auth.uid() = user_id);
-- Writes only through the functions below.

create or replace function public.request_account_deletion(p_email text)
returns timestamptz
language plpgsql security definer set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_role text;
  v_after timestamptz;
begin
  if v_uid is null then raise exception 'Du behöver vara inloggad.' using errcode = 'P0001'; end if;
  select email, raw_app_meta_data->>'role' into v_email, v_role from auth.users where id = v_uid;
  if v_role = 'admin' then raise exception 'Adminkonton kan inte raderas härifrån.' using errcode = 'P0001'; end if;
  if v_email is null or lower(trim(coalesce(p_email, ''))) <> lower(v_email) then
    raise exception 'E-postadressen stämmer inte med ditt konto.' using errcode = 'P0001';
  end if;
  insert into public.account_deletions (user_id) values (v_uid)
  on conflict (user_id) do nothing;
  select delete_after into v_after from public.account_deletions where user_id = v_uid;
  return v_after;
end $$;

create or replace function public.cancel_account_deletion()
returns void
language sql security definer set search_path = public
as $$ delete from public.account_deletions where user_id = auth.uid(); $$;

revoke all on function public.request_account_deletion(text) from public, anon;
revoke all on function public.cancel_account_deletion() from public, anon;
grant execute on function public.request_account_deletion(text) to authenticated;
grant execute on function public.cancel_account_deletion() to authenticated;

-- Runs daily; deletes due accounts (all user data cascades from auth.users).
create or replace function public.purge_due_account_deletions()
returns integer
language plpgsql security definer set search_path = public, auth
as $$
declare n integer;
begin
  delete from auth.users u
  using public.account_deletions d
  where d.user_id = u.id and d.delete_after <= now()
    and coalesce(u.raw_app_meta_data->>'role', '') <> 'admin';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.purge_due_account_deletions() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'purge-account-deletions';
select cron.schedule('purge-account-deletions', '17 3 * * *', 'select public.purge_due_account_deletions()');
