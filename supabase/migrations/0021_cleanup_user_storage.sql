-- Clean up a deleted user's storage objects.
--
-- Supabase does not auto-delete storage objects when the owning DB rows are
-- removed, so a deleted user's selfies (workout-images/<uid>/**) and avatar
-- (avatars/<uid>/**) would linger forever — a privacy gap and a cost leak.
--
-- We extend the existing profiles BEFORE DELETE trigger function (from 0020) to
-- also fire the cleanup-user-storage Edge Function for EVERY deletion, so it
-- covers both the in-app delete flow and out-of-band (dashboard/admin) deletes.
-- Reuses the same Vault secrets: functions_url, service_role_key.

create or replace function public.notify_partners_on_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  fn_url text;
  service_key text;
  survivor_id uuid;
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
    return old;
  end if;

  -- Purge this user's storage objects (unconditional — every deleted user).
  perform net.http_post(
    url := fn_url || '/cleanup-user-storage',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object('user_id', old.id)
  );

  -- Notify the partner still standing in each active partnership.
  for survivor_id in
    select case when user_a = old.id then user_b else user_a end
    from public.partnerships
    where status = 'active'
      and (user_a = old.id or user_b = old.id)
      and case when user_a = old.id then user_b else user_a end is not null
  loop
    perform net.http_post(
      url := fn_url || '/notify-partner-left',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object('recipient_id', survivor_id)
    );
  end loop;

  return old;
end;
$$;
