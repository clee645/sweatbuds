-- 0039 — App Review demo accounts.
--
-- The sign-in screen's "Explore the demo" button calls the demo-session edge
-- function, which (re)creates two accounts — the reviewer's "member" and a
-- pre-paired "partner" — wipes and re-seeds their data relative to today, and
-- hands back a session. This table is how the database recognizes them.
--
-- RLS on with no policies: only the service role (the edge function) can read
-- or write it, so a client can't mark itself or anyone else as a demo account.

create table if not exists public.demo_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('member', 'partner')),
  created_at timestamptz not null default now()
);

alter table public.demo_accounts enable row level security;

create or replace function public.is_demo_account(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.demo_accounts where user_id = uid);
$$;

-- The trigger WHEN clauses below run as the inserting role, so authenticated
-- needs execute. It only answers "is this id a demo account" — nothing private.
revoke all on function public.is_demo_account(uuid) from public;
grant execute on function public.is_demo_account(uuid) to authenticated, service_role;

-- Re-seeding inserts a few dozen backdated workouts and comments. Without this
-- each one would push "your partner just logged" to whatever device last signed
-- into the demo — i.e. the reviewer's phone, every time they tap the button.
-- Demo accounts have no real partner to notify, so skip them entirely.
drop trigger if exists workouts_notify_partner on public.workouts;
create trigger workouts_notify_partner
after insert on public.workouts
for each row
when (not public.is_demo_account(new.user_id))
execute function public.notify_partner_on_workout();

drop trigger if exists workout_comments_notify on public.workout_comments;
create trigger workout_comments_notify
after insert on public.workout_comments
for each row
when (not public.is_demo_account(new.user_id))
execute function public.notify_on_comment();
