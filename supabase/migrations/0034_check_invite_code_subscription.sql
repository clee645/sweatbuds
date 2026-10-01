-- check_invite_code: tell the invitee up front when nobody has subscribed yet.
--
-- redeem_invite_code (0018) refuses with P0004 unless the caller or the code's
-- owner is pro, but check_invite_code only ever said 'ok' / 'self' /
-- 'not_found'. So the onboarding code screen waved the invitee through, they
-- built an account, and pairing then failed after sign-up with nothing on
-- screen to explain it. The new 'needs_subscription' status lets that screen
-- say so before the account exists.
--
-- The invitee's own pro status can't be read here (they usually have no account
-- yet), so this reports only on the code OWNER. A pro invitee pairing with a
-- free owner still succeeds — the status is advisory, and the client treats it
-- as a note rather than a block.
--
-- Leaks nothing beyond what redeeming already reveals: the answer is about a
-- code the caller already holds, and says nothing about who owns it.

create or replace function public.check_invite_code(code text)
returns text
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  owner_is_pro boolean;
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

  select pr.is_pro into owner_is_pro
  from public.partnerships p
  join public.profiles pr on pr.id = p.user_a
  where p.invite_code = code
    and p.status = 'pending'
    and p.user_b is null
  limit 1;

  if owner_is_pro is null then
    return 'not_found';
  end if;

  -- A signed-in caller who is already pro can pair regardless of the owner.
  if owner_is_pro
     or (auth.uid() is not null
         and (select is_pro from public.profiles where id = auth.uid())) then
    return 'ok';
  end if;

  return 'needs_subscription';
end;
$$;

revoke all on function public.check_invite_code(text) from public;
grant execute on function public.check_invite_code(text) to anon, authenticated;
