-- Workout-insert -> notify-partner Edge Function
-- Fires once per workout insert; pg_net schedules an async POST so the
-- transaction returns immediately. Failures are best-effort: the widget on
-- the recipient side still picks up new posts on the next app foreground.
--
-- Prereqs (one-time, all done in the Supabase dashboard, not via SQL):
--   1. Database -> Extensions -> enable "pg_net".
--   2. Project Settings -> Vault (or "Integrations -> Vault") -> add two secrets:
--        Name: functions_url     Secret: https://<project-ref>.supabase.co/functions/v1
--        Name: service_role_key  Secret: <service role key from Settings -> API>
--      (the trigger below reads these via vault.decrypted_secrets)

create or replace function public.notify_partner_on_workout()
returns trigger
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  fn_url text;
  service_key text;
begin
  select decrypted_secret into fn_url
    from vault.decrypted_secrets
    where name = 'functions_url'
    limit 1;

  select decrypted_secret into service_key
    from vault.decrypted_secrets
    where name = 'service_role_key'
    limit 1;

  if fn_url is null or service_key is null then
    return new;
  end if;

  perform net.http_post(
    url := fn_url || '/notify-partner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object('workout_id', new.id)
  );

  return new;
end;
$$;

drop trigger if exists workouts_notify_partner on public.workouts;
create trigger workouts_notify_partner
after insert on public.workouts
for each row execute function public.notify_partner_on_workout();
