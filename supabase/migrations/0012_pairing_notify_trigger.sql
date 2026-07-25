-- Partnership-pairing -> notify-paired Edge Function
-- Fires on AFTER UPDATE when a row flips from 'pending' to 'active' (i.e.
-- user B redeemed user A's invite). Sends a visible + silent push to user A
-- so they get a live "X paired with you" banner and their app refreshes.
--
-- Reads the same Vault secrets as 0009 (functions_url, service_role_key).
-- Requires pg_net to already be enabled (set up in 0009 prerequisites).

create or replace function public.notify_pairing_on_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  fn_url text;
  service_key text;
begin
  -- Only fire on the pending -> active transition.
  if new.status <> 'active' or old.status = 'active' then
    return new;
  end if;

  select decrypted_secret into fn_url
    from vault.decrypted_secrets where name = 'functions_url' limit 1;
  select decrypted_secret into service_key
    from vault.decrypted_secrets where name = 'service_role_key' limit 1;

  if fn_url is null or service_key is null then
    return new;
  end if;

  perform net.http_post(
    url := fn_url || '/notify-paired',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object('partnership_id', new.id)
  );

  return new;
end;
$$;

drop trigger if exists partnerships_notify_paired on public.partnerships;
create trigger partnerships_notify_paired
after update on public.partnerships
for each row execute function public.notify_pairing_on_status_change();
