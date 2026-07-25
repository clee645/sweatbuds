-- Add winner_user_id to wagers so the Wager Balance screen can frame
-- each settled wager as either "{partner} owes you" or "you owe {partner}".
-- Nullable: still null while status='active', set when status flips to 'won'/'lost'.
-- Run after 0006_saved_locations.sql

alter table public.wagers
  add column if not exists winner_user_id uuid references public.profiles(id) on delete set null;

create index if not exists wagers_winner_user_id_idx
  on public.wagers(winner_user_id);
