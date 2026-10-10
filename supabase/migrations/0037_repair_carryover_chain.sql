-- Same-week re-pair carryover, fixes on top of 0036.
--
-- 1. Workouts were only pulled from the partnership that just ended. When an
--    earlier link in a same-day unpair/re-pair chain didn't carry over (it
--    ended before 0036 stamped ended_at), its rows were stranded on that dead
--    partnership: off the home carousel and out of the partner's reach. Pull
--    the week's rows from any of the couple's ended partnerships.
-- 2. Workouts logged while unpaired no longer carry over. They were never
--    shared with anyone, and pulling them in showed a partner photos taken
--    while the two weren't paired. Only rows logged under one of the
--    couple's partnerships move; a gap workout doesn't count toward the week.
-- 3. The new partnership kept the fresh invite's default goal and wager, so a
--    re-pair silently changed the rules mid-week. Carry the couple's previous
--    goal and wager over with the week.
-- 4. One-off repair: re-point rows already stranded that way.

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
          -- Same week, same deal: a fresh invite carries the table defaults,
          -- which would quietly change the goal and wager mid-week.
          weekly_target = prev.weekly_target,
          wager_quantity = prev.wager_quantity,
          wager_text = prev.wager_text,
          wager_emoji = prev.wager_emoji,
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

      -- From ANY of the couple's ended partnerships, not just the last one:
      -- a link in the chain that didn't carry over (ended before 0036, so no
      -- ended_at) would otherwise strand its rows for good. Solo rows
      -- (partnership_id null, logged while unpaired) stay private.
      update public.workouts w
      set partnership_id = target.id
      where w.user_id in (target.user_a, target.user_b)
        and w.logged_at >= week_start_at
        and w.partnership_id in (
          select o.id from public.partnerships o
          where o.status = 'ended'
            and ((o.user_a = target.user_a and o.user_b = target.user_b)
              or (o.user_a = target.user_b and o.user_b = target.user_a))
        );
    end if;
  end if;

  return target;
end;
$$;

revoke all on function public.redeem_invite_code(text) from public;
grant execute on function public.redeem_invite_code(text) to authenticated;

-- ─── one-off repair ────────────────────────────────────────────────────────
-- Rows logged since an active partnership's (backdated) start that still sit
-- on an ended partnership between the same two users. For a partnership that
-- didn't carry over, paired_at is the real pairing instant and the couple's
-- ended partnerships have no rows after it, so this only touches carryovers.
update public.workouts w
set partnership_id = a.id
from public.partnerships a, public.partnerships o
where a.status = 'active'
  and a.paired_at is not null
  and o.status = 'ended'
  and ((o.user_a = a.user_a and o.user_b = a.user_b)
    or (o.user_a = a.user_b and o.user_b = a.user_a))
  and w.partnership_id = o.id
  and w.user_id in (a.user_a, a.user_b)
  and w.logged_at >= a.paired_at;
