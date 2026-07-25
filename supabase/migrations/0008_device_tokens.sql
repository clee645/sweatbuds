-- device_tokens
-- Stores the Expo / APNs push token for each user's primary device.
-- Used by the notify-partner Edge Function to deliver silent + visible
-- pushes when a partnership member logs a workout.

create table if not exists public.device_tokens (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  updated_at timestamptz not null default now()
);

create index if not exists device_tokens_token_idx on public.device_tokens(token);

drop trigger if exists device_tokens_set_updated_at on public.device_tokens;
create trigger device_tokens_set_updated_at
before update on public.device_tokens
for each row execute function public.set_updated_at();

alter table public.device_tokens enable row level security;

drop policy if exists "device_tokens read own" on public.device_tokens;
create policy "device_tokens read own"
on public.device_tokens for select
using (user_id = auth.uid());

drop policy if exists "device_tokens upsert own" on public.device_tokens;
create policy "device_tokens upsert own"
on public.device_tokens for insert
with check (user_id = auth.uid());

drop policy if exists "device_tokens update own" on public.device_tokens;
create policy "device_tokens update own"
on public.device_tokens for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "device_tokens delete own" on public.device_tokens;
create policy "device_tokens delete own"
on public.device_tokens for delete
using (user_id = auth.uid());
