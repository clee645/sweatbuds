-- 0003 — Adds timezone column to profiles and an `avatars` storage bucket.
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query → paste → Run).

-- =============================================================
-- profiles.timezone
-- =============================================================
alter table public.profiles
  add column if not exists timezone text not null default 'America/Los_Angeles';

-- =============================================================
-- Storage: avatars bucket (public; profile pictures match the public-CDN
-- pattern Google's `picture` URL already uses)
-- =============================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Path layout: <user_id>/avatar.jpg
-- Reads are public (bucket is public). Writes/updates/deletes require the
-- folder name to match the caller's user id.

drop policy if exists "avatars own write" on storage.objects;
create policy "avatars own write"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "avatars own update" on storage.objects;
create policy "avatars own update"
on storage.objects for update
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "avatars own delete" on storage.objects;
create policy "avatars own delete"
on storage.objects for delete
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);
