-- Integritetspolicyn: konton som inte har använts på två år raderas.
-- "Använt" = senaste av inloggning, aktivitet i appen, en uppdaterad session
-- (den som håller sig inloggad loggar aldrig in på nytt) och när kontot skapades.
-- Adminkonton raderas aldrig. All data följer med via cascade från auth.users.
create or replace function public.purge_inactive_accounts()
returns integer
language plpgsql security definer set search_path = public, auth
as $$
declare n integer;
begin
  delete from auth.users u
  where coalesce(u.raw_app_meta_data->>'role', '') <> 'admin'
    and greatest(
          u.created_at,
          u.last_sign_in_at,
          (select p.last_active_date::timestamptz from public.profiles p where p.id = u.id),
          (select p.updated_at from public.profiles p where p.id = u.id),
          (select max(coalesce(s.refreshed_at::timestamptz, s.updated_at)) from auth.sessions s where s.user_id = u.id)
        ) < now() - interval '2 years';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.purge_inactive_accounts() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'purge-inactive-accounts';
select cron.schedule('purge-inactive-accounts', '37 3 * * *', 'select public.purge_inactive_accounts()');
