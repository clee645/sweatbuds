export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  timezone: string | null;
  // True once the user picks a timezone in Settings. Suppresses device
  // auto-detection permanently, on every device they sign in from.
  timezone_set_by_user: boolean;
  is_pro: boolean;
};

export type PartnershipStatus = 'pending' | 'active' | 'ended';

export type Partnership = {
  id: string;
  user_a: string;
  user_b: string | null;
  invite_code: string;
  status: PartnershipStatus;
  weekly_target: number;
  wager_quantity: number;
  wager_text: string;
  wager_emoji: string;
  created_at: string;
  paired_at: string | null;
  week_anchor_at: string | null;
  week_anchor_pending_at: string | null;
  // IANA zone that ALL week/day math for this couple resolves against, so both
  // partners' devices agree regardless of where they are. NULL falls back to
  // profiles.timezone, then the device zone (see resolveWeekTimezone).
  timezone: string | null;
  // Forward-only epoch for the wager ledger: only weeks ENDING after this
  // instant are settled into the `wagers` table. Stamped at migration/insert
  // time (NOT NULL DEFAULT now()), so existing history is never backfilled.
  wager_ledger_since: string;
};

export type PartnershipAnchorHistory = {
  id: string;
  partnership_id: string;
  anchor_at: string;
  effective_until: string | null;
  created_at: string;
};

export type Workout = {
  id: string;
  user_id: string;
  partnership_id: string | null;
  selfie_path: string;
  environment_path: string | null;
  caption: string | null;
  logged_at: string;
  // The logger's OWN calendar date, stamped server-side at insert. This is the
  // authoritative answer to "which day did this count for" — never re-derive it
  // from logged_at, which is what let a Tokyo partner's Tuesday read as Monday.
  // Null only on rows that predate the stamping migration (0027).
  logged_date: string | null;
  // The logger's device zone at that moment. Input to the stamping trigger;
  // kept for debugging and future display, not read by week math.
  logged_tz: string | null;
};

export type WorkoutComment = {
  id: string;
  workout_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

export type WagerStatus = 'active' | 'won' | 'lost' | 'settled';

export type Wager = {
  id: string;
  partnership_id: string;
  week_start: string;
  terms: string;
  status: WagerStatus;
  winner_user_id: string | null;
  created_at: string;
};

export type SavedLocation = {
  id: string;
  user_id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
  mapkit_identifier: string | null;
  created_at: string;
};

export type WeekdayKey = 'W' | 'T1' | 'F' | 'S1' | 'S2' | 'M' | 'T2';

export type WeekProgress = {
  user: Profile;
  workoutsThisWeek: number;
  target: number;
  completedDays: WeekdayKey[];
};
