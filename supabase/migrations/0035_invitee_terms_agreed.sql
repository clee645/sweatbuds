-- Record the invitee's agreement to the partner's terms on the partnership.
--
-- It used to live only in the invitee's AsyncStorage, so a reinstall or a
-- sign-in on another device lost it and home sent them back to the signature
-- pad for a pairing they had already agreed to.
--
-- Set once, by the invitee, through agree_to_partnership_terms(). The client
-- write guard makes the column read-only for direct updates so a member can't
-- forge or clear it.

alter table public.partnerships
  add column if not exists invitee_agreed_at timestamptz;

-- Existing pairings went through the flow before this column existed; treat
-- them as agreed rather than re-prompting every current invitee.
update public.partnerships
set invitee_agreed_at = paired_at
where status = 'active'
  and paired_at is not null
  and invitee_agreed_at is null;

create or replace function public.agree_to_partnership_terms(p_partnership_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  agreed timestamptz;
begin
  update public.partnerships
  set invitee_agreed_at = coalesce(invitee_agreed_at, now())
  where id = p_partnership_id
    and user_b = auth.uid()
    and status = 'active'
  returning invitee_agreed_at into agreed;

  if agreed is null then
    raise exception 'Not the invitee of an active partnership'
      using errcode = '42501';
  end if;
  return agreed;
end;
$$;

revoke all on function public.agree_to_partnership_terms(uuid) from public;
grant execute on function public.agree_to_partnership_terms(uuid) to authenticated;

-- Same guard as 0030, plus invitee_agreed_at in the read-only set.
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
    new.invitee_agreed_at := null;
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
     or new.created_at is distinct from old.created_at
     or new.invitee_agreed_at is distinct from old.invitee_agreed_at then
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
