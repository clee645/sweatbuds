-- Workout-comment-insert -> notify-comment Edge Function
-- Mirrors 0009_workout_notify_trigger: fires after each comment insert and
-- schedules an async pg_net POST so the transaction returns immediately. The
-- function itself decides whether to send (e.g., skips self-comments).
--
-- Prereqs (one-time, identical to 0009):
--   1. Database -> Extensions -> "pg_net" enabled.
--   2. Vault secrets: functions_url, service_role_key.

create or replace function public.notify_on_comment()
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
    url := fn_url || '/notify-comment',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object('comment_id', new.id)
  );

  return new;
end;
$$;

drop trigger if exists workout_comments_notify on public.workout_comments;
create trigger workout_comments_notify
after insert on public.workout_comments
for each row execute function public.notify_on_comment();
