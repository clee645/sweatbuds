export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  timezone: string | null;
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
};

export type Workout = {
  id: string;
  user_id: string;
  partnership_id: string | null;
  selfie_path: string;
  environment_path: string | null;
  caption: string | null;
  logged_at: string;
};

export type WagerStatus = 'active' | 'won' | 'lost' | 'settled';

export type Wager = {
  id: string;
  partnership_id: string;
  week_start: string;
  terms: string;
  status: WagerStatus;
  created_at: string;
};

export type WeekdayKey = 'W' | 'T1' | 'F' | 'S1' | 'S2' | 'M' | 'T2';

export type WeekProgress = {
  user: Profile;
  workoutsThisWeek: number;
  target: number;
  completedDays: WeekdayKey[];
};
