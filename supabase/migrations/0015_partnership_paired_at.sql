-- Add paired_at to partnerships and update redeem_invite_code to set it on
-- the pending → active transition. paired_at is the canonical anchor for the
-- couple's weekly cycle: their week runs from this day-of-week forward.
--
-- Backfill: existing active rows inherit created_at so prior couples have an
-- anchor even though it predates this column. New pairings flowing through
-- redeem_invite_code get a precise now() timestamp.

alter table public.partnerships
  add column if not exists paired_at timestamptz;

update public.partnerships
set paired_at = created_at
where status = 'active' and paired_at is null;

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
