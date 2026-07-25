-- workouts read policy: relax to "active partner of the row's owner"
--
-- The original policy in 0001_init.sql required workouts.partnership_id to be
-- non-null AND match the calling user's active partnership. createWorkout
-- doesn't currently stamp partnership_id, so partner B literally cannot see
-- partner A's pre-pairing rows. This rewrites the SELECT to look at the
-- partnership relationship between the calling user and the row's user_id,
-- which retroactively unblocks all existing rows.
--
-- INSERT/UPDATE/DELETE policies are unchanged: still scoped to user_id = auth.uid().

drop policy if exists "workouts read own or partner" on public.workouts;
drop policy if exists "workouts read own or active partner" on public.workouts;
create policy "workouts read own or active partner"
on public.workouts for select
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.partnerships p
    where p.status = 'active'
      and (
        (p.user_a = auth.uid() and p.user_b = public.workouts.user_id)
        or (p.user_b = auth.uid() and p.user_a = public.workouts.user_id)
      )
  )
);
