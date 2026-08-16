-- check_invite_code(code text) -> text
-- Pre-flight validation for the onboarding invite-code screen.
--
-- The joiner enters their partner's code BEFORE they have an account (pairing
-- needs a session, so the code is stashed and redeemed after sign-up by
-- PendingInvitePairer). Until now nothing checked the code at entry: a typo or
-- an already-claimed code sailed through the name and photo screens, created a
-- real account, and only THEN failed — leaving the user signed in, unpaired,
-- and looking at a paywall for a subscription their partner already covers.
--
-- This is a UX pre-check, NOT a security boundary. The code can still be
-- claimed by someone else in the gap between this call and redemption, so
-- redeem_invite_code stays the atomic authority and its errors still surface.
--
-- SECURITY DEFINER because the partnerships SELECT policy requires the caller
-- to already be a member — which a not-yet-signed-up joiner isn't. Granted to
-- anon for the same reason.
--
-- Returns a status string rather than the row: an unauthenticated caller has no
-- business reading a stranger's partnership, so nothing about the owner (name,
-- id, plan) crosses the wire. A brute-forcer learns only whether a code is
-- claimable, which redeem_invite_code already tells any signed-in user, and the
-- 32^6 (~1.07 billion) code space makes enumeration impractical anyway.
--
-- Statuses:
--   'ok'        — a pending, unclaimed invite exists for this code
--   'self'      — caller owns this code (only reachable when already signed in)
--   'not_found' — no such code, or it has already been claimed

create or replace function public.check_invite_code(code text)
returns text
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if code is null or char_length(code) = 0 then
    return 'not_found';
  end if;

  -- auth.uid() is null for the normal (not-yet-signed-up) caller. When it isn't,
  -- catch "that's your own code" here instead of after the account exists.
  -- Checked first because an own pending row would also satisfy the test below.
  if auth.uid() is not null and exists (
    select 1 from public.partnerships p
    where p.invite_code = code
      and p.user_a = auth.uid()
  ) then
    return 'self';
  end if;

  if exists (
    select 1 from public.partnerships p
    where p.invite_code = code
      and p.status = 'pending'
      and p.user_b is null
  ) then
    return 'ok';
  end if;

  return 'not_found';
end;
$$;

revoke all on function public.check_invite_code(text) from public;
grant execute on function public.check_invite_code(text) to anon, authenticated;
