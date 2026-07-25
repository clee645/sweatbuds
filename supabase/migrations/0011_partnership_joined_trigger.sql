-- Partnership pending->active -> notify-partner-joined Edge Function
-- Sends a push to the inviter (user_a) so they can celebrate the pairing
-- even if they were backgrounded or had the app closed when it happened.
--
-- Reuses the same Vault secrets as 0009_workout_notify_trigger.sql:
--   functions_url, service_role_key

create or replace function public.notify_partner_joined()
returns trigger
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  fn_url text;
  service_key text;
begin
  if not (new.status = 'active' and (old.status is null or old.status = 'pending')) then
    return new;
  end if;

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
    url := fn_url || '/notify-partner-joined',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object('partnership_id', new.id)
  );

  return new;
end;
$$;

drop trigger if exists partnerships_notify_joined on public.partnerships;
create trigger partnerships_notify_joined
  after update on public.partnerships
  for each row execute function public.notify_partner_joined();
