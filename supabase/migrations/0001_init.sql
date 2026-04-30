-- Sweatbuds initial schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query → paste → Run)

-- =============================================================
-- Extensions
-- =============================================================
create extension if not exists "pgcrypto";

-- =============================================================
-- Tables
-- =============================================================

-- profiles ------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- partnerships --------------------------------------------------
create table if not exists public.partnerships (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid references public.profiles(id) on delete set null,
  invite_code text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'ended')),
  weekly_target int not null default 3 check (weekly_target between 1 and 7),
  created_at timestamptz not null default now(),
  constraint partnerships_distinct_users check (user_a <> user_b)
);

create index if not exists partnerships_user_a_idx on public.partnerships(user_a);
create index if not exists partnerships_user_b_idx on public.partnerships(user_b);
create index if not exists partnerships_invite_code_idx on public.partnerships(invite_code);

-- workouts ------------------------------------------------------
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  partnership_id uuid references public.partnerships(id) on delete set null,
  selfie_path text not null,
  environment_path text,
  caption text check (char_length(caption) <= 140),
  logged_at timestamptz not null default now()
);

create index if not exists workouts_user_id_logged_at_idx
  on public.workouts(user_id, logged_at desc);
create index if not exists workouts_partnership_id_idx
  on public.workouts(partnership_id);

-- wagers --------------------------------------------------------
create table if not exists public.wagers (
  id uuid primary key default gen_random_uuid(),
  partnership_id uuid not null references public.partnerships(id) on delete cascade,
  week_start date not null,
  terms text not null,
  status text not null default 'active'
    check (status in ('active', 'won', 'lost', 'settled')),
  created_at timestamptz not null default now(),
  unique (partnership_id, week_start)
);

create index if not exists wagers_partnership_id_idx
  on public.wagers(partnership_id);

-- =============================================================
-- Helper: keeps profiles.updated_at in sync
-- =============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- =============================================================
-- Auto-create a profile row when a new auth.user is created
-- =============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Friend')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =============================================================
-- Helper: is this user part of the partnership?
-- =============================================================
create or replace function public.is_partnership_member(pid uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.partnerships p
    where p.id = pid and (p.user_a = uid or p.user_b = uid)
  );
$$;

-- =============================================================
-- Row Level Security
-- =============================================================
alter table public.profiles      enable row level security;
alter table public.partnerships  enable row level security;
alter table public.workouts      enable row level security;
alter table public.wagers        enable row level security;

-- profiles: a user can read their own profile + their partner's profile;
-- write only their own.
drop policy if exists "profiles read own or partner" on public.profiles;
create policy "profiles read own or partner"
on public.profiles for select
using (
  id = auth.uid()
  or exists (
    select 1 from public.partnerships p
    where (p.user_a = auth.uid() and p.user_b = profiles.id)
       or (p.user_b = auth.uid() and p.user_a = profiles.id)
  )
);

drop policy if exists "profiles insert self" on public.profiles;
create policy "profiles insert self"
on public.profiles for insert
with check (id = auth.uid());

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

-- partnerships: visible to either member; only members can write.
drop policy if exists "partnerships read members" on public.partnerships;
create policy "partnerships read members"
on public.partnerships for select
using (user_a = auth.uid() or user_b = auth.uid());

drop policy if exists "partnerships insert as user_a" on public.partnerships;
create policy "partnerships insert as user_a"
on public.partnerships for insert
with check (user_a = auth.uid());

drop policy if exists "partnerships update members" on public.partnerships;
create policy "partnerships update members"
on public.partnerships for update
using (user_a = auth.uid() or user_b = auth.uid())
with check (user_a = auth.uid() or user_b = auth.uid());

drop policy if exists "partnerships delete members" on public.partnerships;
create policy "partnerships delete members"
on public.partnerships for delete
using (user_a = auth.uid() or user_b = auth.uid());

-- workouts: a user can read their own + their partner's; insert/update/delete only their own.
drop policy if exists "workouts read own or partner" on public.workouts;
create policy "workouts read own or partner"
on public.workouts for select
using (
  user_id = auth.uid()
  or (
    partnership_id is not null
    and public.is_partnership_member(partnership_id, auth.uid())
  )
);

drop policy if exists "workouts insert own" on public.workouts;
create policy "workouts insert own"
on public.workouts for insert
with check (user_id = auth.uid());

drop policy if exists "workouts update own" on public.workouts;
create policy "workouts update own"
on public.workouts for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "workouts delete own" on public.workouts;
create policy "workouts delete own"
on public.workouts for delete
using (user_id = auth.uid());

-- wagers: visible + writable to partnership members.
drop policy if exists "wagers read members" on public.wagers;
create policy "wagers read members"
on public.wagers for select
using (public.is_partnership_member(partnership_id, auth.uid()));

drop policy if exists "wagers insert members" on public.wagers;
create policy "wagers insert members"
on public.wagers for insert
with check (public.is_partnership_member(partnership_id, auth.uid()));

drop policy if exists "wagers update members" on public.wagers;
create policy "wagers update members"
on public.wagers for update
using (public.is_partnership_member(partnership_id, auth.uid()))
with check (public.is_partnership_member(partnership_id, auth.uid()));

drop policy if exists "wagers delete members" on public.wagers;
create policy "wagers delete members"
on public.wagers for delete
using (public.is_partnership_member(partnership_id, auth.uid()));

-- =============================================================
-- Storage: workout-images bucket (private; access via signed URLs)
-- =============================================================
insert into storage.buckets (id, name, public)
values ('workout-images', 'workout-images', false)
on conflict (id) do nothing;

-- Path layout: <user_id>/<workout_id>/(selfie|environment).jpg
-- The first path segment is the owner's user id. We let users read their
-- own files, write into their own folder, and let partners read each other's.

drop policy if exists "workout-images own + partner read" on storage.objects;
create policy "workout-images own + partner read"
on storage.objects for select
using (
  bucket_id = 'workout-images'
  and (
    auth.uid()::text = (storage.foldername(name))[1]
    or exists (
      select 1 from public.partnerships p
      where (
        (p.user_a = auth.uid() and p.user_b::text = (storage.foldername(name))[1])
        or
        (p.user_b = auth.uid() and p.user_a::text = (storage.foldername(name))[1])
      )
      and p.status = 'active'
    )
  )
);

drop policy if exists "workout-images own write" on storage.objects;
create policy "workout-images own write"
on storage.objects for insert
with check (
  bucket_id = 'workout-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "workout-images own update" on storage.objects;
create policy "workout-images own update"
on storage.objects for update
using (
  bucket_id = 'workout-images'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'workout-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "workout-images own delete" on storage.objects;
create policy "workout-images own delete"
on storage.objects for delete
using (
  bucket_id = 'workout-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);
