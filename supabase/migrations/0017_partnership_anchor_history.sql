-- Anchor history: track each era of week_anchor_at on a partnership so
-- history surfaces (Past Weeks, streak) can bucket workouts on whatever
-- anchor was active at the time, and represent the extended transition
-- week (8-13 days) as a single bucket when the start day changes.
--
-- Schema: one open row per partnership (effective_until = NULL) plus a
-- closed row for every previous era. Both rows track 00:00 local time of
-- the anchor's first day. The transition between consecutive eras spans
-- [prev.anchor_at_plus_full_weeks, next.anchor_at).
--
-- Writes are server-side via triggers on partnerships:
--   1. When paired_at flips NULL->value: insert an initial open row.
--   2. When week_anchor_at changes: close the open row and insert a new one.
-- Clients only read.

create table if not exists public.partnership_anchor_history (
  id uuid primary key default gen_random_uuid(),
  partnership_id uuid not null references public.partnerships(id) on delete cascade,
  anchor_at timestamptz not null,
  effective_until timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists partnership_anchor_history_partnership_idx
  on public.partnership_anchor_history(partnership_id, anchor_at);

-- Exactly one open era per partnership.
create unique index if not exists partnership_anchor_history_open_unique
  on public.partnership_anchor_history(partnership_id)
  where effective_until is null;

alter table public.partnership_anchor_history enable row level security;

drop policy if exists "anchor_history read partnership members"
  on public.partnership_anchor_history;
create policy "anchor_history read partnership members"
on public.partnership_anchor_history for select
using (
  exists (
    select 1 from public.partnerships p
    where p.id = partnership_id
      and (p.user_a = auth.uid() or p.user_b = auth.uid())
  )
);

-- Backfill: every paired partnership gets one open row anchored at the
-- effective anchor it currently uses (week_anchor_at, falling back to
-- paired_at). New partnerships flow through the triggers below.
insert into public.partnership_anchor_history (partnership_id, anchor_at, effective_until)
select id, coalesce(week_anchor_at, paired_at), null
from public.partnerships
where paired_at is not null
  and not exists (
    select 1 from public.partnership_anchor_history h
    where h.partnership_id = public.partnerships.id
  );

create or replace function public.partnership_anchor_history_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Initial era at the moment paired_at is first set. Guards against
  -- accidental double-init by checking for any existing row.
  if old.paired_at is null and new.paired_at is not null then
    if not exists (
      select 1 from public.partnership_anchor_history
      where partnership_id = new.id
    ) then
      insert into public.partnership_anchor_history (partnership_id, anchor_at)
      values (new.id, new.paired_at);
    end if;
  end if;

  -- Realized anchor change: close the open era and open a new one.
  if new.week_anchor_at is not null
     and (old.week_anchor_at is distinct from new.week_anchor_at) then
    update public.partnership_anchor_history
    set effective_until = new.week_anchor_at
    where partnership_id = new.id
      and effective_until is null;

    insert into public.partnership_anchor_history (partnership_id, anchor_at)
    values (new.id, new.week_anchor_at);
  end if;

  return new;
end;
$$;

drop trigger if exists partnership_anchor_history_sync on public.partnerships;
create trigger partnership_anchor_history_sync
after update on public.partnerships
for each row execute function public.partnership_anchor_history_sync();
