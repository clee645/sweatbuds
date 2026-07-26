-- =============================================================
-- Canonical timezone for a partnership's week math.
-- =============================================================
-- Week boundaries, day buckets, goal-hit and streaks were all computed from
-- the *reading device's* local time. `paired_at` / `week_anchor_at` are stored
-- as timestamptz (absolute instants), and each client re-derived "midnight"
-- in its own zone — so two partners in different timezones permanently
-- disagreed about which day a week starts on and which day a workout counts
-- toward.
--
-- Worse, `wagerSettlement` keys its ledger rows on the computed week start:
--   unique (partnership_id, week_start)
-- Two devices computing different `week_start` values never collide, so the
-- ON CONFLICT dedupe silently stopped working and a single week could settle
-- twice — potentially with opposite winners.
--
-- Fix: one timezone per partnership. Both devices resolve every calendar day
-- against this zone, so they agree by construction. `profiles.timezone` stays
-- as-is for personal display and notification timing.

alter table public.partnerships
  add column if not exists timezone text;

comment on column public.partnerships.timezone is
  'IANA zone used for ALL week/day math for this couple. NULL falls back to '
  'the client-side chain: profiles.timezone -> device zone.';

-- Seed from the inviter (user_a) — they created the partnership, so their zone
-- is the one the existing anchor was most likely computed in.
--
-- Deliberately left NULLABLE with no default. A NOT NULL DEFAULT
-- 'America/Los_Angeles' is exactly the trap profiles.timezone fell into: every
-- row silently holds a plausible-but-wrong US-West value that nothing can
-- distinguish from a deliberate user choice.
update public.partnerships p
set timezone = pr.timezone
from public.profiles pr
where pr.id = p.user_a
  and p.timezone is null
  and pr.timezone is not null;
