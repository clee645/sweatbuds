-- Server-authoritative subscription state + promo codes.
--
-- Until now profiles.is_pro (0018) was written by the CLIENT whenever its
-- RevenueCat entitlement flipped. That goes stale when a sub renews/lapses/
-- refunds while the app is closed (and a partner's unlock reads that flag),
-- and a tampered client could set it true. This migration moves the source of
-- truth to the server:
--
--   * is_pro_until (timestamptz): the precise entitlement expiry, written only
--     by the revenuecat-webhook / sync-subscription edge functions.
--   * is_pro (boolean, kept from 0018): the durable flag every reader already
--     uses (useAccessGate, partnership realtime, redeem_invite_code). The edge
--     functions keep it in lock-step with `is_pro_until > now()` so none of
--     those readers — or the partner-sharing model — need to change.
--
-- subscription_events is the audit/dedupe log the webhook writes to.
-- promo_codes / promo_redemptions back the in-app promo system (RevenueCat
-- promotional entitlements + discount-offering rebinds), independent of Apple
-- offer codes.

alter table public.profiles
  add column if not exists is_pro_until timestamptz;

create index if not exists idx_profiles_is_pro_until
  on public.profiles (is_pro_until)
  where is_pro_until is not null;

-- ─── Audit log of RevenueCat webhook events ────────────────────────────────
-- Mostly for debugging "why isn't this user pro?". RevenueCat retries on any
-- non-2xx, so the unique event id lets the webhook dedupe replays.
-- user_id is intentionally NOT a foreign key: RevenueCat sends events for
-- users we may not know yet (anonymous pre-signup purchases, TEST events,
-- transferred subscribers) and we'd rather log them than reject.
create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  revenuecat_event_id text unique not null,
  user_id uuid,
  event_type text not null,
  product_id text,
  expiration_at timestamptz,
  raw jsonb not null,
  received_at timestamptz not null default now()
);

create index if not exists idx_subscription_events_user
  on public.subscription_events (user_id, received_at desc);

alter table public.subscription_events enable row level security;
-- No client policies — only the service role (the edge function) reads/writes.

-- ─── Promo codes ───────────────────────────────────────────────────────────
-- App-defined codes redeemed IN-APP (not Apple offer codes). lifetime/time-
-- limited grants are applied via RevenueCat's promotional-entitlement API;
-- 'discount' codes carry an offering_id the client re-renders the paywall
-- against (a cheaper App Store product).
create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  active boolean not null default true,
  grant_type text,
  entitlement_id text not null default 'Sweatbuds Pro',
  -- Only used for grant_type='discount'; points at a RevenueCat offering whose
  -- App Store product is priced at the discounted rate.
  offering_id text,
  percent_off integer,
  -- Shown on the paywall promo pill / success copy.
  display_label text,
  max_redemptions integer,
  expires_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

-- Codes are entered/canonicalised uppercase client-side; store one row per code.
create unique index if not exists idx_promo_codes_code_unique
  on public.promo_codes (code);

-- grant_type must be one of RevenueCat's promotional durations OR our
-- 'discount' sentinel. Keep aligned with RC_DURATIONS in redeem-promo-code.
alter table public.promo_codes
  drop constraint if exists promo_codes_grant_type_check;
alter table public.promo_codes
  add constraint promo_codes_grant_type_check
  check (grant_type is null or grant_type in (
    'lifetime',
    'weekly',
    'monthly',
    'two_months',
    'three_months',
    'six_months',
    'yearly',
    'discount'
  ));

-- Discount codes MUST carry an offering_id; everything else is optional.
alter table public.promo_codes
  drop constraint if exists promo_codes_discount_requires_offering;
alter table public.promo_codes
  add constraint promo_codes_discount_requires_offering
  check (grant_type is distinct from 'discount' or offering_id is not null);

alter table public.promo_codes enable row level security;

-- The paywall validates a code (SELECT by code+active) before redeeming.
-- Everything else is service-role-only.
drop policy if exists "promo_codes read active" on public.promo_codes;
create policy "promo_codes read active"
  on public.promo_codes
  for select
  using (active = true);

-- ─── Promo redemptions (per-RevenueCat-user log) ───────────────────────────
create table if not exists public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.promo_codes(id) on delete cascade,
  user_id uuid,
  rc_app_user_id text not null,
  grant_type text not null,
  granted_at timestamptz not null default now()
);

-- Prevents the same RC identity from redeeming the same code twice. Different
-- codes can still stack.
create unique index if not exists idx_promo_redemptions_code_rc_user
  on public.promo_redemptions (promo_code_id, rc_app_user_id);

create index if not exists idx_promo_redemptions_user
  on public.promo_redemptions (user_id)
  where user_id is not null;

alter table public.promo_redemptions enable row level security;
-- No client policies — only the service role (the edge function) reads/writes.
