-- Forward-only epoch for the wager ledger. Applying this migration stamps every
-- EXISTING partnership with the ship instant (so no past weeks are backfilled);
-- new partnerships get now() at insert. Wager settlement only creates a row for a
-- completed week whose end lands strictly after this instant — at ship, every
-- already-completed week ends at or before now() and the in-progress week hasn't
-- ended yet, so the ledger starts empty.
-- Run after 0022_partnership_scoped_visibility.sql

alter table public.partnerships
  add column if not exists wager_ledger_since timestamptz not null default now();
