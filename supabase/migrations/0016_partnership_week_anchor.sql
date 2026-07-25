-- Configurable week start day. Two nullable columns on partnerships:
--   week_anchor_at: when set, this replaces paired_at as the canonical anchor
--   week_anchor_pending_at: a scheduled future change; promoted into
--     week_anchor_at the moment `now >= week_anchor_pending_at`.
-- Both NULL preserves the previous behavior (anchor on paired_at day-of-week).

alter table public.partnerships
  add column if not exists week_anchor_at timestamptz,
  add column if not exists week_anchor_pending_at timestamptz;

comment on column public.partnerships.week_anchor_at is
  'Effective week anchor (00:00 local). NULL falls back to paired_at.';
comment on column public.partnerships.week_anchor_pending_at is
  'Next scheduled week-start change. Promoted to week_anchor_at when now >= this.';
