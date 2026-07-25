-- =============================================================
-- Track whether an account actually finished onboarding.
-- =============================================================
-- OAuth sign-in always creates an auth.users row (and a profile via the
-- handle_new_user trigger), so profile existence alone cannot distinguish a
-- registered user from someone who merely tapped "Continue with Google" once on
-- the sign-in screen. The sign-in screen is for already-registered users; it
-- rejects any login whose profile has onboarding_completed = false and routes
-- them into onboarding instead.
--
-- New profiles default to false. The final onboarding step (save-progress) sets
-- it to true — that flip is what "registered" means.

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;

-- Grandfather every account that predates this flag: they are, by definition,
-- already set up. Only rows existing at migration time are touched; future
-- inserts fall through to the column default (false).
update public.profiles set onboarding_completed = true;
