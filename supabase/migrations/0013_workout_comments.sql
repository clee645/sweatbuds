-- workout_comments: comments left on a workout's photo by the author or their
-- active partner. Mirrors the visibility rules of workouts (0011_workouts_partner_visibility):
-- a row is readable iff the calling user is the workout's author OR an active
-- partner of the author.

create table if not exists public.workout_comments (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 280),
  created_at timestamptz not null default now()
);

create index if not exists workout_comments_workout_idx
  on public.workout_comments (workout_id, created_at);

alter table public.workout_comments enable row level security;

drop policy if exists "comments read by author or active partner" on public.workout_comments;
create policy "comments read by author or active partner"
on public.workout_comments for select
using (
  exists (
    select 1 from public.workouts w
    where w.id = workout_comments.workout_id
      and (
        w.user_id = auth.uid()
        or exists (
          select 1 from public.partnerships p
          where p.status = 'active'
            and (
              (p.user_a = auth.uid() and p.user_b = w.user_id)
              or (p.user_b = auth.uid() and p.user_a = w.user_id)
            )
        )
      )
  )
);

drop policy if exists "comments insert by author or active partner" on public.workout_comments;
create policy "comments insert by author or active partner"
on public.workout_comments for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.workouts w
    where w.id = workout_comments.workout_id
      and (
        w.user_id = auth.uid()
        or exists (
          select 1 from public.partnerships p
          where p.status = 'active'
            and (
              (p.user_a = auth.uid() and p.user_b = w.user_id)
              or (p.user_b = auth.uid() and p.user_a = w.user_id)
            )
        )
      )
  )
);

drop policy if exists "comments delete own" on public.workout_comments;
create policy "comments delete own"
on public.workout_comments for delete
using (user_id = auth.uid());

-- Add to the realtime publication so the photo-detail screen receives live INSERTs
-- when the partner posts a comment. Wrapped in a DO block because re-running
-- ALTER PUBLICATION on a table that's already in the publication errors out.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename  = 'workout_comments'
  ) then
    execute 'alter publication supabase_realtime add table public.workout_comments';
  end if;
end$$;
