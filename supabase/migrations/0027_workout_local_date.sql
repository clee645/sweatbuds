-- =============================================================
-- Stamp each workout with the logger's OWN calendar date.
-- =============================================================
-- `logged_at` is an instant. Until now the app re-derived "which day was this?"
-- on every render from whatever timezone was handy — first the reading device's,
-- then (migration 0026) the partnership's. Both are wrong in different ways:
-- the first made two partners disagree with each other, the second tells a
-- partner in Tokyo that their Tuesday morning workout happened on Monday.
--
-- Days belong to the person. Weeks belong to the couple. This column settles
-- the first half: the day is written down once, in the zone the logger was
-- actually standing in, and never recomputed. Moving cities or correcting your
-- timezone can no longer rewrite your past.
--
-- It also makes week membership a pure calendar-date comparison, so both
-- partners' devices agree with no timezone involved at all.

alter table public.workouts
  add column if not exists logged_tz text,
  add column if not exists logged_date date;

comment on column public.workouts.logged_tz is
  'IANA zone of the logger''s device at the moment of logging. Input to the '
  'trigger below; not used for anything at read time.';
comment on column public.workouts.logged_date is
  'The logger''s own calendar date. Authoritative and immutable — never '
  'recompute this from logged_at.';

-- Nullable for now: existing rows are backfilled in a later release (see the
-- rollout note at the bottom). Reads fall back to deriving from logged_at while
-- any NULLs remain.

create index if not exists workouts_user_logged_date_idx
  on public.workouts(user_id, logged_date);

-- =============================================================
-- Trigger: derive the date server-side
-- =============================================================
-- The client supplies only its zone, never the date. `now()` stays the
-- authoritative clock, so a client cannot backdate a workout — misreporting a
-- zone can shift you by at most one day, which is the legitimate range anyway
-- (real offsets span UTC-12..UTC+14).

create or replace function public.stamp_workout_local_date()
returns trigger
language plpgsql
as $$
begin
  begin
    new.logged_date := (now() at time zone coalesce(new.logged_tz, 'UTC'))::date;
  exception when others then
    -- Unrecognized IANA zone string. Fall back to UTC rather than rejecting the
    -- insert — losing a day label is recoverable, losing the workout is not.
    new.logged_tz := null;
    new.logged_date := (now() at time zone 'UTC')::date;
  end;
  return new;
end;
$$;

drop trigger if exists workouts_stamp_local_date on public.workouts;
create trigger workouts_stamp_local_date
before insert on public.workouts
for each row execute function public.stamp_workout_local_date();

-- =============================================================
-- profiles.timezone_set_by_user
-- =============================================================
-- The app auto-detects a new user's zone from their device on first launch
-- (no location permission involved — it reads the OS clock setting). That must
-- never run over a zone the user picked themselves. Tracking it on the ACCOUNT
-- rather than the device means a reinstall or a new phone can't clobber their
-- choice either.

alter table public.profiles
  add column if not exists timezone_set_by_user boolean not null default false;

comment on column public.profiles.timezone_set_by_user is
  'True once the user picks a timezone in Settings. Suppresses auto-detection '
  'permanently, on every device.';

-- =============================================================
-- Rollout note — DO NOT SKIP before backfilling logged_date
-- =============================================================
-- This migration does NOT backfill existing workouts, so no historical week
-- changes verdict and nothing needs guarding yet.
--
-- The release that DOES backfill must first bump `partnerships.wager_ledger_since`
-- to that moment:
--
--   update public.partnerships set wager_ledger_since = now();
--
-- Without it, relabelling a past workout can flip a finished week from "both
-- hit" to "one partner missed", and settlement will insert a brand-new wager
-- row for a week from a month ago — a user opens the app owing a debt they
-- never knew about. `wager_ledger_since` is a forward-only epoch that already
-- gates settlement to weeks ending after it, so bumping it prevents any
-- historical week from ever being re-judged.
