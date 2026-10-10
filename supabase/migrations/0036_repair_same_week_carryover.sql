-- Re-pairing with the same partner inside the week you unpaired keeps the week.
--
-- Re-pairing mints a new partnership: its week starts on the re-pair day and
-- the feed is scoped to its id, so everything the couple logged earlier that
-- week vanished from the home carousel and the weekly history (and the
-- partner lost read access to it, since the old partnership is ended). The
-- month view kept your own photos only because owners always read their rows.
--
-- Now, when redeem_invite_code pairs two users whose previous partnership with
-- each other ended during its current week, the new partnership continues that
-- week instead:
--   * paired_at is set to the start of that week (and the timezone and any
--     scheduled week-start change are carried over), so the week grid and the
--     client's pre-pair cutoff line up with the old one;
--   * that week's workouts from either partner, logged under the old
--     partnership or solo while unpaired, are re-pointed at the new one, so
--     RLS, the feed and the weekly buckets pick them up with no client change.
-- Earlier weeks stay with the old partnership, unchanged.

-- ─── ended_at ──────────────────────────────────────────────────────────────
-- When a partnership ended, so "ended this week" can be told apart from a
-- re-pair weeks later. Rows ended before this migration stay NULL and never
-- carry over.
alter table public.partnerships
  add column if not exists ended_at timestamptz;

create or replace function public.stamp_partnership_ended_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Server-owned: whatever a client sends is ignored.
  if new.status = 'ended' and old.status is distinct from 'ended' then
    new.ended_at := now();
  else
    new.ended_at := old.ended_at;
  end if;
  return new;
end;
$$;

drop trigger if exists partnerships_stamp_ended_at on public.partnerships;
create trigger partnerships_stamp_ended_at
before update on public.partnerships
for each row execute function public.stamp_partnership_ended_at();

-- ─── redeem_invite_code ────────────────────────────────────────────────────
-- Same as 0018, plus the same-week carryover after the pairing update.
create or replace function public.redeem_invite_code(code text)
returns public.partnerships
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  owner_id uuid;
  target public.partnerships;
  prev public.partnerships;
  tz text;
  today date;
  anchor date;
  pending date;
  week_start date;
  week_start_at timestamptz;
begin
  if caller is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if exists (
    select 1 from public.partnerships
    where status = 'active' and (user_a = caller or user_b = caller)
  ) then
    raise exception 'Already paired' using errcode = 'P0001';
  end if;

  -- Subscription gate: only enforce when a real claimable row exists, so an
  -- invalid/own/redeemed code still surfaces as P0002/P0003 below rather than
  -- being masked by "subscription required".
  select user_a into owner_id
  from public.partnerships
  where invite_code = code
    and status = 'pending'
    and user_b is null
    and user_a <> caller
  limit 1;

  if owner_id is not null then
    if not (
      (select is_pro from public.profiles where id = caller)
      or (select is_pro from public.profiles where id = owner_id)
    ) then
      raise exception 'Subscription required' using errcode = 'P0004';
    end if;
  end if;

  update public.partnerships p
  set user_b = caller, status = 'active', paired_at = now()
  where p.invite_code = code
    and p.status = 'pending'
    and p.user_b is null
    and p.user_a <> caller
  returning p.* into target;

  if target.id is null then
    if exists (
      select 1 from public.partnerships
      where invite_code = code and user_a = caller
    ) then
      raise exception 'Cannot pair with yourself' using errcode = 'P0002';
    end if;
    raise exception 'Code not found or already redeemed' using errcode = 'P0003';
  end if;

  -- Same-week carryover. The most recent partnership between these two.
  select * into prev
  from public.partnerships
  where status = 'ended'
    and ended_at is not null
    and paired_at is not null
    and id <> target.id
    and ((user_a = target.user_a and user_b = target.user_b)
      or (user_a = target.user_b and user_b = target.user_a))
  order by ended_at desc
  limit 1;

  if prev.id is not null then
    -- The old partnership's current week, computed exactly as the client's
    -- getWeekWindow does: stride 7 days from the effective anchor (a pending
    -- week-start change that's already due counts as the anchor).
    tz := coalesce(prev.timezone, target.timezone, 'UTC');
    today := (now() at time zone tz)::date;
    pending := (prev.week_anchor_pending_at at time zone tz)::date;
    if pending is not null and pending <= today then
      anchor := pending;
      pending := null;
    else
      anchor := (coalesce(prev.week_anchor_at, prev.paired_at) at time zone tz)::date;
    end if;
    week_start := anchor + 7 * greatest(0, (today - anchor) / 7);
    week_start_at := week_start::timestamp at time zone tz;

    if prev.ended_at >= week_start_at then
      update public.partnerships
      set paired_at = week_start_at,
          timezone = tz,
          week_anchor_at = null,
          -- Keep a scheduled week-start change (an extended in-progress
          -- week) on the same schedule.
          week_anchor_pending_at = case
            when pending is not null then prev.week_anchor_pending_at
          end
      where id = target.id
      returning * into target;

      -- partnership_anchor_history_sync opened this partnership's first era
      -- at the re-pair instant during the pairing update above, and the
      -- weekly history builds its weeks from that row. Move it to match.
      -- Dynamic and guarded: a database without 0017 has no such table, and
      -- a static reference would fail the whole pairing.
      if to_regclass('public.partnership_anchor_history') is not null then
        execute
          'update public.partnership_anchor_history
           set anchor_at = $1
           where partnership_id = $2 and effective_until is null'
          using week_start_at, target.id;
      end if;

      update public.workouts
      set partnership_id = target.id
      where user_id in (target.user_a, target.user_b)
        and logged_at >= week_start_at
        and (partnership_id = prev.id or partnership_id is null);
    end if;
  end if;

  return target;
end;
$$;

revoke all on function public.redeem_invite_code(text) from public;
grant execute on function public.redeem_invite_code(text) to authenticated;
