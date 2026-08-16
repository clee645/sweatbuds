-- Every promo code must carry a redemption limit.
--
-- promo_codes.max_redemptions was nullable with no default, and null means
-- UNLIMITED (see the cap check in the redeem-promo-code edge function). A code
-- created without one was therefore an open-ended giveaway — and because a
-- promo grant also unlocks the redeemer's partner via profiles.is_pro, every
-- redemption is two free accounts, not one. A leaked uncapped code is expensive.
--
-- Forgetting the limit is the easy mistake, so make the database cover it:
-- omitting the column now yields a single-use code, and an explicit null is
-- rejected rather than silently meaning "infinite".

-- Backfill first — the constraint below can't be added while nulls exist. Floor
-- each code at its current redemption count so we never write a cap that the
-- code's own recorded redemptions already exceed. Note this effectively closes
-- any previously-uncapped code to NEW redemptions; already-granted entitlements
-- are untouched.
update public.promo_codes c
set max_redemptions = greatest(
  1,
  (select count(*) from public.promo_redemptions r where r.promo_code_id = c.id)
)
where c.max_redemptions is null;

alter table public.promo_codes
  alter column max_redemptions set default 1;

alter table public.promo_codes
  drop constraint if exists promo_codes_requires_limit;

alter table public.promo_codes
  add constraint promo_codes_requires_limit
  check (max_redemptions is not null and max_redemptions > 0);
