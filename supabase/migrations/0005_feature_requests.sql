-- Feature requests submitted by users from the in-app form
-- Run after 0004_partnership_wager_fields.sql

create table if not exists public.feature_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  description text not null check (char_length(description) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists feature_requests_user_id_created_at_idx
  on public.feature_requests(user_id, created_at desc);

alter table public.feature_requests enable row level security;

drop policy if exists "feature_requests insert own" on public.feature_requests;
create policy "feature_requests insert own"
on public.feature_requests for insert
with check (user_id = auth.uid());

drop policy if exists "feature_requests read own" on public.feature_requests;
create policy "feature_requests read own"
on public.feature_requests for select
using (user_id = auth.uid());
