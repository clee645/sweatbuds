-- Saved gym locations for Location Reminders
-- Run after 0005_feature_requests.sql

create table if not exists public.saved_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  address text,
  latitude double precision not null,
  longitude double precision not null,
  radius_meters int not null default 150,
  mapkit_identifier text,
  created_at timestamptz not null default now()
);

create index if not exists saved_locations_user_id_created_at_idx
  on public.saved_locations(user_id, created_at desc);

alter table public.saved_locations enable row level security;

drop policy if exists "saved_locations read own" on public.saved_locations;
create policy "saved_locations read own"
on public.saved_locations for select
using (user_id = auth.uid());

drop policy if exists "saved_locations insert own" on public.saved_locations;
create policy "saved_locations insert own"
on public.saved_locations for insert
with check (user_id = auth.uid());

drop policy if exists "saved_locations delete own" on public.saved_locations;
create policy "saved_locations delete own"
on public.saved_locations for delete
using (user_id = auth.uid());
