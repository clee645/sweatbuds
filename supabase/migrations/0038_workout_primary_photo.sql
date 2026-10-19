-- Which of a workout's two photos is shown large. The first shot taken is the
-- main photo, and the user can swap it on the preview before logging.
--
-- Existing rows were all captured selfie-first, so 'selfie' is the right
-- default for them and for any client that predates this column.

alter table public.workouts
  add column if not exists primary_photo text not null default 'selfie'
    check (primary_photo in ('selfie', 'environment'));
