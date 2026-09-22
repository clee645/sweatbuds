-- =============================================================
-- Inactivity reminders: nudge both partners when the couple goes quiet.
-- =============================================================
-- An hourly pg_cron job POSTs to the notify-inactivity Edge Function, which
-- sends a push to BOTH partners once the couple has gone 4, 7 and 14 days with
-- no workout from either of them (copy + thresholds live in
-- supabase/functions/_shared/inactivity.ts).
--
-- "Last activity" is the newest workout stamped with the partnership, or
-- paired_at if they haven't logged one yet. A post by either partner moves it
-- forward, which restarts the ladder at stage 1.
--
-- Prereqs: pg_net + the functions_url / service_role_key Vault secrets from
-- 0009. pg_cron is enabled below (Database -> Extensions -> "pg_cron" is the
-- dashboard equivalent if this statement is refused).

create extension if not exists pg_cron;

-- Which stage was last sent, and the last-activity instant it was measured
-- against. Service-role only: RLS on, no policies.
create table if not exists public.partnership_inactivity_nudges (
  partnership_id uuid primary key references public.partnerships(id) on delete cascade,
  stage smallint not null,
  anchor_at timestamptz not null,
  sent_at timestamptz not null default now()
);

alter table public.partnership_inactivity_nudges enable row level security;

create index if not exists workouts_partnership_logged_at_idx
  on public.workouts(partnership_id, logged_at desc);

-- Active, fully-paired couples whose last activity is before `idle_before`,
-- with their nudge state. Timezone mirrors the client's week-math fallback:
-- partnership zone, then the inviter's profile zone.
create or replace function public.inactive_partnerships(idle_before timestamptz)
returns table (
  partnership_id uuid,
  user_a uuid,
  user_b uuid,
  timezone text,
  last_activity_at timestamptz,
  nudged_stage smallint,
  nudged_anchor_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.user_a,
    p.user_b,
    coalesce(p.timezone, pa.timezone),
    greatest(p.paired_at, w.last_logged_at),
    n.stage,
    n.anchor_at
  from public.partnerships p
  left join public.profiles pa on pa.id = p.user_a
  left join lateral (
    select max(logged_at) as last_logged_at
    from public.workouts
    where partnership_id = p.id
  ) w on true
  left join public.partnership_inactivity_nudges n on n.partnership_id = p.id
  where p.status = 'active'
    and p.user_b is not null
    and p.paired_at is not null
    and greatest(p.paired_at, w.last_logged_at) < idle_before;
$$;

-- Atomically records that `stage` is being sent for this quiet stretch.
-- Returns true only for the caller that actually advanced the state, so two
-- overlapping runs can't both push the same nudge.
create or replace function public.claim_inactivity_nudge(
  p_partnership_id uuid,
  p_stage smallint,
  p_anchor_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.partnership_inactivity_nudges as n
    (partnership_id, stage, anchor_at, sent_at)
  values (p_partnership_id, p_stage, p_anchor_at, now())
  on conflict (partnership_id) do update
    set stage = excluded.stage,
        anchor_at = excluded.anchor_at,
        sent_at = excluded.sent_at
    where n.anchor_at is distinct from excluded.anchor_at
       or n.stage < excluded.stage;
  return found;
end;
$$;

revoke all on function public.inactive_partnerships(timestamptz) from public, anon, authenticated;
revoke all on function public.claim_inactivity_nudge(uuid, smallint, timestamptz) from public, anon, authenticated;
grant execute on function public.inactive_partnerships(timestamptz) to service_role;
grant execute on function public.claim_inactivity_nudge(uuid, smallint, timestamptz) to service_role;

-- Cron entrypoint: same Vault + pg_net pattern as the notify triggers.
create or replace function public.run_inactivity_reminders()
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  fn_url text;
  service_key text;
begin
  select decrypted_secret into fn_url
    from vault.decrypted_secrets where name = 'functions_url' limit 1;
  select decrypted_secret into service_key
    from vault.decrypted_secrets where name = 'service_role_key' limit 1;

  if fn_url is null or service_key is null then
    return;
  end if;

  perform net.http_post(
    url := fn_url || '/notify-inactivity',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{}'::jsonb
  );
end;
$$;

revoke all on function public.run_inactivity_reminders() from public, anon, authenticated;

-- Hourly, so each couple's local send window is hit regardless of zone.
-- cron.schedule upserts by job name, so re-running this migration is safe.
select cron.schedule(
  'inactivity-reminders',
  '0 * * * *',
  $$ select public.run_inactivity_reminders(); $$
);
