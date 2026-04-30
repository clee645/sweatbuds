-- Add wager rule fields to partnerships
-- Run after 0003_profile_timezone_and_avatars.sql

alter table public.partnerships
  add column if not exists wager_quantity int not null default 1
    check (wager_quantity between 1 and 99),
  add column if not exists wager_text text not null default 'Romantic Favor',
  add column if not exists wager_emoji text not null default '😉';
