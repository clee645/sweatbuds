-- Lock down columns and transitions the client must never control.
--
-- The original RLS policies only check row ownership ("is this your profile",
-- "are you a member of this partnership"), so every column on those rows was
-- client-writable. That allowed:
--   1. profiles: setting is_pro / is_pro_until yourself -> free Pro (which also
--      unlocks your partner via useAccessGate / redeem_invite_code).
--   2. partnerships: inserting an already-active row with any user_b (skipping
--      redeem_invite_code and its Pro gate), overwriting user_a / user_b, and
--      flipping an 'ended' partnership back to 'active' to regain read access
--      to an ex-partner's workouts, photos and comments.
--   3. promo_codes: any signed-in user could list every active code.
--
-- Enforcement is by trigger, keyed on current_user:
--   * App requests run as 'authenticated' (or 'anon'), so they are checked.
--   * The service role (edge functions) runs as 'service_role' and SECURITY
--     DEFINER functions (redeem_invite_code, the cleanup / anchor triggers) run
--     as their owner, so the legitimate server-side writers are unaffected.

-- ─── profiles: subscription columns are server-only ────────────────────────
create or replace function public.guard_profile_client_writes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.is_pro := false;
    new.is_pro_until := null;
    return new;
  end if;

  if new.is_pro is distinct from old.is_pro
     or new.is_pro_until is distinct from old.is_pro_until then
    raise exception 'Subscription fields are read-only'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_client_writes on public.profiles;
create trigger profiles_guard_client_writes
before insert or update on public.profiles
for each row execute function public.guard_profile_client_writes();

-- ─── partnerships: pairing only via redeem_invite_code; ended is final ─────
create or replace function public.guard_partnership_client_writes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A client may only create its own open invite. Joining happens through
    -- redeem_invite_code, which enforces the subscription gate.
    if new.user_b is not null or new.status <> 'pending' then
      raise exception 'Partnerships must be created as an open invite'
        using errcode = '42501';
    end if;
    new.paired_at := null;
    new.wager_ledger_since := now();
    new.week_anchor_at := null;
    new.week_anchor_pending_at := null;
    return new;
  end if;

  -- UPDATE
  if old.status = 'ended' then
    raise exception 'This partnership has ended'
      using errcode = '42501';
  end if;

  if new.user_a is distinct from old.user_a
     or new.user_b is distinct from old.user_b
     or new.invite_code is distinct from old.invite_code
     or new.paired_at is distinct from old.paired_at
     or new.wager_ledger_since is distinct from old.wager_ledger_since
     or new.created_at is distinct from old.created_at then
    raise exception 'Partnership membership fields are read-only'
      using errcode = '42501';
  end if;

  -- The couple's zone is fixed once set; clients may only fill in a NULL.
  if old.timezone is not null
     and new.timezone is distinct from old.timezone then
    raise exception 'Partnership timezone is read-only'
      using errcode = '42501';
  end if;

  -- The only status change a member may make is ending the partnership.
  if new.status is distinct from old.status and new.status <> 'ended' then
    raise exception 'Invalid partnership status change'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists partnerships_guard_client_writes on public.partnerships;
create trigger partnerships_guard_client_writes
before insert or update on public.partnerships
for each row execute function public.guard_partnership_client_writes();

-- Belt and braces on insert: the policy itself now rejects pre-paired rows.
drop policy if exists "partnerships insert as user_a" on public.partnerships;
create policy "partnerships insert as user_a"
on public.partnerships for insert
with check (user_a = auth.uid() and user_b is null and status = 'pending');

-- Members never delete partnerships from the app (unpair sets status =
-- 'ended'). Deleting would cascade away the wager ledger, so a member could
-- erase debts they owe. Server-side deletes (account deletion, orphan cleanup)
-- run as service_role / definer and don't need this policy.
drop policy if exists "partnerships delete members" on public.partnerships;

-- ─── promo_codes: never readable by clients ────────────────────────────────
-- Validation and redemption happen inside the redeem-promo-code edge function
-- with the service role, so no client needs to read this table.
drop policy if exists "promo_codes read active" on public.promo_codes;
