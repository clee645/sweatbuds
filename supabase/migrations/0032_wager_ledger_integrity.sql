-- Wager ledger integrity.
--
-- 1. wagers.status gains 'wash': settlement now writes a row for EVERY
--    completed week (both hit / both missed included) so a week's outcome is
--    frozen once. Previously no-debt weeks had no row and were re-judged on
--    every run with the CURRENT target, so raising the target could turn a
--    week both partners passed into a debt.
-- 2. partnerships.timezone is never left NULL. The onboarding insert path
--    omitted it, so each device fell back to its own zone and partners in
--    different zones produced different week_start keys — the same week could
--    settle twice with opposite winners.
-- 3. Workouts can't be backdated or re-pointed after the fact by a client.
-- 4. Wager rows can't be rewritten or deleted by a client: the only change a
--    member may make is marking a debt 'settled'.
--
-- Same enforcement model as 0030: checks apply only when current_user is
-- 'authenticated'/'anon'. The service role, SECURITY DEFINER functions and FK
-- cascades run as other roles and are unaffected.

-- ─── 1. 'wash' status ──────────────────────────────────────────────────────
alter table public.wagers drop constraint if exists wagers_status_check;
alter table public.wagers
  add constraint wagers_status_check
  check (status in ('active', 'won', 'lost', 'settled', 'wash'));

-- ─── 2. partnership timezone ───────────────────────────────────────────────
-- Backfill from the inviter, exactly as 0026 did for pre-existing rows.
update public.partnerships p
set timezone = pr.timezone
from public.profiles pr
where pr.id = p.user_a
  and p.timezone is null
  and pr.timezone is not null;

create or replace function public.default_partnership_timezone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.timezone is null then
    select timezone into new.timezone from public.profiles where id = new.user_a;
  end if;
  return new;
end;
$$;

drop trigger if exists partnerships_default_timezone on public.partnerships;
create trigger partnerships_default_timezone
before insert on public.partnerships
for each row execute function public.default_partnership_timezone();

-- ─── 3. workouts ───────────────────────────────────────────────────────────
create or replace function public.guard_workout_client_writes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- The server clock decides when a workout happened (logged_date is
    -- already stamped from now() by the 0027 trigger).
    new.logged_at := now();

    if new.partnership_id is not null
       and not public.is_partnership_member(new.partnership_id, new.user_id) then
      raise exception 'Not a member of that partnership'
        using errcode = '42501';
    end if;

    -- Image paths must be this workout's own objects. Otherwise a crafted row
    -- could make notify-partner sign URLs for someone else's photos.
    if new.selfie_path not like new.user_id::text || '/' || new.id::text || '/%'
       or (new.environment_path is not null
           and new.environment_path not like new.user_id::text || '/' || new.id::text || '/%') then
      raise exception 'Invalid image path'
        using errcode = '42501';
    end if;

    return new;
  end if;

  -- UPDATE: only the caption is editable.
  if (to_jsonb(new) - 'caption') is distinct from (to_jsonb(old) - 'caption') then
    raise exception 'Only the caption of a workout can be edited'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists workouts_guard_client_writes on public.workouts;
create trigger workouts_guard_client_writes
before insert or update on public.workouts
for each row execute function public.guard_workout_client_writes();

-- ─── 4. wagers ─────────────────────────────────────────────────────────────
create or replace function public.guard_wager_client_writes()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  p public.partnerships;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    select * into p from public.partnerships where id = new.partnership_id;
    if p.id is null or p.status <> 'active' then
      raise exception 'Partnership is not active'
        using errcode = '42501';
    end if;

    if new.status = 'wash' then
      if new.winner_user_id is not null then
        raise exception 'A wash has no winner' using errcode = '42501';
      end if;
    elsif new.status = 'won' then
      if new.winner_user_id is null
         or new.winner_user_id not in (p.user_a, p.user_b) then
        raise exception 'Winner must be a partner' using errcode = '42501';
      end if;
    else
      raise exception 'New ledger rows must be won or wash'
        using errcode = '42501';
    end if;

    -- Only weeks that have actually ended (in the couple's zone) can be
    -- settled, and never weeks from before the ledger epoch.
    if new.week_start + 7 > (now() at time zone coalesce(p.timezone, 'UTC'))::date then
      raise exception 'That week has not ended yet' using errcode = '42501';
    end if;
    if new.week_start + 14 < (p.wager_ledger_since at time zone coalesce(p.timezone, 'UTC'))::date then
      raise exception 'That week predates the wager ledger' using errcode = '42501';
    end if;

    return new;
  end if;

  -- UPDATE: the only allowed change is marking an outstanding debt settled.
  if (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status')
     or not (old.status in ('won', 'lost') and new.status = 'settled') then
    raise exception 'Wagers can only be marked as settled'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists wagers_guard_client_writes on public.wagers;
create trigger wagers_guard_client_writes
before insert or update on public.wagers
for each row execute function public.guard_wager_client_writes();

-- The app never deletes ledger rows; a delete would let a partner erase a
-- debt they owe.
drop policy if exists "wagers delete members" on public.wagers;
