-- Account deletion = clean partnership separation
--
-- When a user deletes their account (in-app) or is removed out-of-band
-- (dashboard / ban), the surviving partner should land in a clean solo state and
-- be told their partnership ended. Two changes make that happen:
--
-- 1. Symmetric, consistent cascade. `user_a` was already ON DELETE CASCADE while
--    `user_b` was ON DELETE SET NULL (0001_init.sql), so deleting user_b left a
--    broken `status='active'` row with a null slot. We make `user_b` CASCADE too,
--    so deleting EITHER member removes the partnership (and its wagers + anchor
--    history) consistently. The survivor's own workouts auto-unlink to solo via
--    the existing workouts.partnership_id ON DELETE SET NULL — their personal
--    history is preserved while the shared layer is purged.
--
-- 2. Survivor notification. A BEFORE DELETE trigger on profiles resolves the
--    surviving partner BEFORE the cascade removes the partnership, and fires the
--    notify-partner-left Edge Function via pg_net. Reuses the same Vault secrets
--    as 0009/0011: functions_url, service_role_key.

-- 1. Symmetric cascade -----------------------------------------------------
alter table public.partnerships
  drop constraint if exists partnerships_user_b_fkey;

alter table public.partnerships
  add constraint partnerships_user_b_fkey
  foreign key (user_b) references public.profiles(id) on delete cascade;

-- Realtime DELETE events must carry the old row so the survivor's client
-- (subscribed with a user_a/user_b filter) actually receives the event.
alter table public.partnerships replica identity full;

-- 2. Notify survivors on account deletion ---------------------------------
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
  -- Resolve secrets once; bail quietly if the project isn't configured.
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

  -- For each ACTIVE partnership the departing user belongs to, notify the
  -- partner still standing. Runs BEFORE the cascade deletes the row, so the
  -- surviving id is still resolvable.
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

drop trigger if exists profiles_notify_partner_left on public.profiles;
create trigger profiles_notify_partner_left
  before delete on public.profiles
  for each row execute function public.notify_partners_on_profile_delete();
