-- Add is_pro to profiles and gate invite-code redemption on subscription.
--
-- is_pro mirrors each user's RevenueCat "Sweatbuds Pro" entitlement. Each
-- device writes its OWN row whenever its entitlement flips; a user's active
-- partner can already read this column via the existing "profiles read own or
-- partner" SELECT policy, and the "profiles update own" policy keeps writes
-- self-only. This is the durable source of truth the home gate reads so that
-- access survives reinstalls and so one subscription can cover both partners.
--
-- redeem_invite_code is recreated (from the 0015 body, preserving
-- paired_at = now()) to refuse pairing unless at least one of the two people
-- — the code owner (user_a) or the redeemer (caller) — is pro. This is the
-- one-time enforcement of "one subscription covers both"; the continuous
-- unlock/re-lock is handled client-side by reading is_pro.

alter table public.profiles
  add column if not exists is_pro boolean not null default false;

-- Ensure profiles is in the realtime publication so a partner's is_pro flip
-- (and name/avatar changes) propagate live. Guarded because ALTER PUBLICATION
-- on a table already in the publication errors out.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    execute 'alter publication supabase_realtime add table public.profiles';
  end if;
end $$;

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

  return target;
end;
$$;

revoke all on function public.redeem_invite_code(text) from public;
grant execute on function public.redeem_invite_code(text) to authenticated;
