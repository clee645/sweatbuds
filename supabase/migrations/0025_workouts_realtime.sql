-- Live workout propagation
--
-- Home (`lib/workouts.tsx`) and History (`lib/history.tsx`) each hold their own
-- workouts array. Without realtime, a partner's new log only lands via the
-- `partner_logged` push (0009) or the next app foreground, and a partner's
-- DELETE propagates on nothing at all — there is no delete trigger, so the row
-- lingered on the partner's home carousel as a dangling card until a refetch.
--
-- Publishing the table lets `components/WorkoutsRealtime.tsx` patch both
-- providers in place. Read scoping is unchanged: the SELECT policy from 0022 is
-- evaluated per-subscriber by Realtime, and createWorkout already stamps
-- partnership_id, so a partner receives exactly the rows they could already
-- query.

-- 1. Publish public.workouts ---------------------------------------------------
-- Guarded: ALTER PUBLICATION on a table already in the publication errors out.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename  = 'workouts'
  ) then
    execute 'alter publication supabase_realtime add table public.workouts';
  end if;
end$$;

-- 2. Replica identity so DELETE events carry the old row ----------------------
-- Under the default (primary-key-only) replica identity a DELETE payload has no
-- partnership_id, so the 0022 SELECT policy can't be evaluated for the partner
-- and the event isn't delivered. Same reasoning as partnerships in 0020.
alter table public.workouts replica identity full;

-- 3. Pre-existing fix: workout_comments DELETE ---------------------------------
-- The realtime DELETE handler in lib/comments.tsx guards on
-- `payload.old.workout_id`, which is undefined under the default replica
-- identity — so removing a comment has never propagated to the partner. Same
-- one-line remedy.
alter table public.workout_comments replica identity full;
