-- Partnership-scoped read visibility (RLS isolation hardening)
--
-- The earlier policies (0011 workouts, 0013 comments, 0001 storage) grant an
-- ACTIVE PARTNER access to ALL of the owner's rows — not just rows from the
-- shared partnership. That was a deliberate relaxation back when createWorkout
-- didn't stamp partnership_id. It now does (lib/workouts.tsx), and the UI already
-- filters by partnership_id, so a partner reading the owner's pre-pair or
-- previous-partnership rows is latent over-permission.
--
-- We re-scope each read policy to the SPECIFIC partnership a row belongs to: a
-- partner may read a workout / its photo / its comments only when that row's
-- partnership is one they're an active member of. Owners always read their own
-- rows (so a survivor keeps their full personal history regardless of pairing).

-- workouts: own, or belonging to a shared active partnership -----------------
drop policy if exists "workouts read own or active partner" on public.workouts;
create policy "workouts read own or active partner"
on public.workouts for select
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.partnerships p
    where p.id = public.workouts.partnership_id
      and p.status = 'active'
      and (p.user_a = auth.uid() or p.user_b = auth.uid())
  )
);

-- storage (workout-images): own folder, or the workout's shared partnership ----
-- Path layout: <user_id>/<workout_id>/(selfie|environment).jpg
drop policy if exists "workout-images own + partner read" on storage.objects;
create policy "workout-images own + partner read"
on storage.objects for select
using (
  bucket_id = 'workout-images'
  and (
    auth.uid()::text = (storage.foldername(name))[1]
    or exists (
      select 1
      from public.workouts w
      join public.partnerships p on p.id = w.partnership_id
      where w.id::text = (storage.foldername(name))[2]
        and p.status = 'active'
        and (p.user_a = auth.uid() or p.user_b = auth.uid())
    )
  )
);

-- comments: readable/insertable only on workouts in a shared active partnership
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
          where p.id = w.partnership_id
            and p.status = 'active'
            and (p.user_a = auth.uid() or p.user_b = auth.uid())
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
          where p.id = w.partnership_id
            and p.status = 'active'
            and (p.user_a = auth.uid() or p.user_b = auth.uid())
        )
      )
  )
);
