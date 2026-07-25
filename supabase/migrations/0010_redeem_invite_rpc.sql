-- redeem_invite_code(code text)
-- Atomically claim a pending invite as the calling user. SECURITY DEFINER so
-- it bypasses the partnerships SELECT/UPDATE RLS that would otherwise hide
-- the pending row from the joining user before they become user_b.
--
-- Errcode mapping (consumed by lib/invite.ts):
--   28000  not authenticated
--   P0001  caller already in an active partnership
--   P0002  caller is trying to redeem their own code
--   P0003  code not found / already redeemed

create or replace function public.redeem_invite_code(code text)
returns public.partnerships
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
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

  update public.partnerships p
  set user_b = caller, status = 'active'
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
