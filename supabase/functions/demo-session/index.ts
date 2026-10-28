// Supabase Edge Function: demo-session
// Powers the sign-in screen's "Explore the demo" button for App Review.
//
// Each call (re)builds a self-contained demo and returns a session for it:
//   1. Ensures the two demo accounts exist (recreating them if a reviewer
//      tested "Delete account") and records them in public.demo_accounts.
//   2. Wipes their workouts, comments, wagers, saved locations and
//      partnerships, then re-pairs them.
//   3. Seeds four finished weeks plus the current one, dated relative to
//      today, so the home screen, history, comments and wager ledger are all
//      populated no matter when the reviewer taps the button.
//   4. Mints a session for the member account via an admin magic link (no
//      password ships in the app or the review notes).
//
// Deterministic ids (hashed from the account id) make concurrent taps safe:
// every insert is an idempotent upsert.
//
// Public on purpose — the app calls it signed out, with the anon key. The
// accounts are not pro (the app unlocks demo sessions locally), so they can't
// be used to extend a subscription to a real partner. Set the secret
// DEMO_MODE_DISABLED=true to switch it off.
//
// Deploy with: supabase functions deploy demo-session

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

import {
  MEMBER_AVATAR,
  MEMBER_SOURCES,
  PARTNER_AVATAR,
  PARTNER_SOURCES,
  type DemoSource,
} from './sources.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DISABLED = Deno.env.get('DEMO_MODE_DISABLED') === 'true';

const BUCKET = 'workout-images';
const TZ = 'America/Los_Angeles';
const WEEKLY_TARGET = 3;

const MEMBER = { email: 'demo-member@sweatbuds.app', name: 'Curtis', avatar: MEMBER_AVATAR };
const PARTNER = { email: 'demo-partner@sweatbuds.app', name: 'bdog', avatar: PARTNER_AVATAR };

// Day offsets (0–6 within the week) each person worked out. Four finished
// weeks, then the current one, which started 3 days ago so today is still
// open for the reviewer to log. With a target of 3 the ledger reads:
// wash, member won (paid), partner won, member won.
const PLAN: { member: number[]; partner: number[] }[] = [
  { member: [0, 2, 5], partner: [1, 2, 4] },
  { member: [0, 3, 5], partner: [2] },
  { member: [1, 4], partner: [0, 2, 6] },
  { member: [0, 2, 4], partner: [3] },
  { member: [0, 2], partner: [0, 1] },
];
const CURRENT_WEEK_DAYS_ELAPSED = 3;
const SETTLED_WEEKS = new Set([1]);

// [plan week, 'member' | 'partner', nth workout that week, author, text]
const COMMENTS: [number, Role, number, Role, string][] = [
  [0, 'member', 2, 'partner', 'ok you’re making me look bad'],
  [1, 'partner', 0, 'member', 'one workout?? dinner’s on you 😤'],
  [1, 'partner', 0, 'partner', 'it was a long week ok'],
  [2, 'partner', 2, 'member', 'fine. you earned it'],
  [3, 'member', 2, 'partner', 'lets gooo 🔥'],
  [4, 'partner', 1, 'member', 'see you at the gym tmrw?'],
  [4, 'partner', 1, 'partner', '6am. don’t be late'],
  [4, 'member', 1, 'partner', 'bag secured 💪'],
];

type Role = 'member' | 'partner';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }
  if (DISABLED) {
    return json({ error: 'Demo mode is not available.' }, 404);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const memberId = await ensureAccount(admin, MEMBER, 'member');
    const partnerId = await ensureAccount(admin, PARTNER, 'partner');
    await reset(admin, [memberId, partnerId]);
    await seed(admin, memberId, partnerId, new Date());
    const session = await mintSession(MEMBER.email);
    return json(session, 200);
  } catch (e) {
    console.error('[demo-session]', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function must<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

// ---------------------------------------------------------------- accounts

async function ensureAccount(
  admin: SupabaseClient,
  account: typeof MEMBER,
  role: Role,
): Promise<string> {
  const created = await admin.auth.admin.createUser({
    email: account.email,
    email_confirm: true,
    user_metadata: { full_name: account.name },
  });
  if (created.error && !/already|exists|registered/i.test(created.error.message)) {
    throw new Error(`create ${role}: ${created.error.message}`);
  }
  // generateLink resolves the existing user without listing every account.
  const link = must(
    await admin.auth.admin.generateLink({ type: 'magiclink', email: account.email }),
    `resolve ${role}`,
  );
  const userId = link.user.id;

  must(
    await admin.from('demo_accounts').upsert({ user_id: userId, role }, { onConflict: 'user_id' }),
    `register ${role}`,
  );
  must(
    await admin
      .from('profiles')
      .update({
        display_name: account.name,
        avatar_url: `${SUPABASE_URL}/storage/v1/object/public/avatars/${account.avatar}`,
        timezone: TZ,
        timezone_set_by_user: false,
        is_pro: false,
        is_pro_until: null,
        onboarding_completed: true,
      })
      .eq('id', userId),
    `profile ${role}`,
  );
  return userId;
}

async function mintSession(email: string) {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const link = must(
    await admin.auth.admin.generateLink({ type: 'magiclink', email }),
    'magic link',
  );
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const verified = must(
    await anon.auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token }),
    'verify',
  );
  if (!verified.session) throw new Error('verify: no session returned');
  return {
    access_token: verified.session.access_token,
    refresh_token: verified.session.refresh_token,
  };
}

// ------------------------------------------------------------------- reset

async function reset(admin: SupabaseClient, ids: string[]) {
  const demo = new Set(ids);
  const list = ids.join(',');

  must(await admin.from('workouts').delete().in('user_id', ids), 'clear workouts');
  must(await admin.from('saved_locations').delete().in('user_id', ids), 'clear locations');

  const partnerships = must(
    await admin
      .from('partnerships')
      .select('id, user_a, user_b, status')
      .or(`user_a.in.(${list}),user_b.in.(${list})`),
    'read partnerships',
  ) as { id: string; user_a: string; user_b: string | null; status: string }[];

  // Demo-only rows are ours to delete. If a reviewer paired the demo with a
  // real person's invite code, end that partnership rather than erase the
  // real person's history.
  const ours = partnerships.filter(
    (p) => demo.has(p.user_a) && (p.user_b === null || demo.has(p.user_b)),
  );
  const shared = partnerships.filter((p) => !ours.includes(p) && p.status !== 'ended');
  if (ours.length) {
    must(
      await admin.from('partnerships').delete().in('id', ours.map((p) => p.id)),
      'clear partnerships',
    );
  }
  if (shared.length) {
    must(
      await admin
        .from('partnerships')
        .update({ status: 'ended' })
        .in('id', shared.map((p) => p.id)),
      'end shared partnerships',
    );
  }
}

// -------------------------------------------------------------------- seed

type SeedWorkout = {
  id: string;
  user_id: string;
  partnership_id: string;
  selfie_path: string;
  environment_path: string;
  caption: string | null;
  primary_photo: 'selfie' | 'environment';
  logged_at: string;
  logged_date: string;
  logged_tz: string;
};

async function seed(admin: SupabaseClient, memberId: string, partnerId: string, now: Date) {
  const today = zonedYmd(now, TZ);
  const currentStart = addDays(today, -CURRENT_WEEK_DAYS_ELAPSED);
  const pairedYmd = addDays(currentStart, -7 * (PLAN.length - 1));
  const pairedAt = zonedUtc(pairedYmd, 8, 30, TZ);
  const createdAt = new Date(pairedAt.getTime() - 20 * 60_000);

  const partnershipId = await uuidFrom(`partnership:${memberId}`);
  must(
    await admin.from('partnerships').upsert(
      {
        id: partnershipId,
        user_a: partnerId,
        user_b: memberId,
        invite_code: await inviteCodeFrom(memberId),
        status: 'active',
        weekly_target: WEEKLY_TARGET,
        wager_quantity: 1,
        wager_text: 'Dinner',
        wager_emoji: '🍽️',
        created_at: createdAt.toISOString(),
        paired_at: pairedAt.toISOString(),
        invitee_agreed_at: pairedAt.toISOString(),
        wager_ledger_since: createdAt.toISOString(),
        week_anchor_at: null,
        week_anchor_pending_at: null,
        timezone: TZ,
      },
      { onConflict: 'id' },
    ),
    'partnership',
  );

  // Build workouts week by week, cycling through each person's photos.
  const workouts: SeedWorkout[] = [];
  const byWeek: Record<Role, SeedWorkout[]>[] = [];
  const cursor: Record<Role, number> = { member: 0, partner: 0 };
  const copies: Promise<void>[] = [];
  for (let week = 0; week < PLAN.length; week++) {
    const weekStart = addDays(pairedYmd, week * 7);
    const bucket: Record<Role, SeedWorkout[]> = { member: [], partner: [] };
    for (const role of ['member', 'partner'] as const) {
      const userId = role === 'member' ? memberId : partnerId;
      const sources = role === 'member' ? MEMBER_SOURCES : PARTNER_SOURCES;
      for (const day of PLAN[week][role]) {
        const n = cursor[role]++;
        const source: DemoSource = sources[n % sources.length];
        const id = await uuidFrom(`workout:${userId}:${n}`);
        const ymd = addDays(weekStart, day);
        // Spread times across the day, deterministic per slot.
        const hour = 6 + ((n * 5 + (role === 'partner' ? 3 : 0)) % 13);
        const minute = (n * 17 + (role === 'partner' ? 29 : 0)) % 60;
        const w: SeedWorkout = {
          id,
          user_id: userId,
          partnership_id: partnershipId,
          selfie_path: `${userId}/${id}/selfie.jpg`,
          environment_path: `${userId}/${id}/environment.jpg`,
          caption: source.caption,
          primary_photo: source.primary,
          logged_at: zonedUtc(ymd, hour, minute, TZ).toISOString(),
          logged_date: ymd,
          logged_tz: TZ,
        };
        workouts.push(w);
        bucket[role].push(w);
        copies.push(copyPhotos(admin, source.folder, w));
      }
    }
    byWeek.push(bucket);
  }
  await Promise.all(copies);

  must(
    await admin.from('workouts').upsert(workouts, { onConflict: 'id', ignoreDuplicates: true }),
    'workouts',
  );
  // stamp_workout_local_date overwrites logged_date with today's date on
  // insert; put each row back on the day it was "logged".
  const restamped = await Promise.all(
    workouts.map((w) =>
      admin.from('workouts').update({ logged_date: w.logged_date }).eq('id', w.id),
    ),
  );
  for (const res of restamped) must(res, 'restamp workouts');

  const ids: Record<Role, string> = { member: memberId, partner: partnerId };
  const comments = await Promise.all(
    COMMENTS.map(async ([week, owner, nth, author, content], i) => {
      const workout = byWeek[week][owner][nth];
      const at = new Date(Date.parse(workout.logged_at) + (20 + i * 7) * 60_000);
      return {
        id: await uuidFrom(`comment:${memberId}:${i}`),
        workout_id: workout.id,
        user_id: ids[author],
        content,
        created_at: at.toISOString(),
      };
    }),
  );
  must(
    await admin
      .from('workout_comments')
      .upsert(comments, { onConflict: 'id', ignoreDuplicates: true }),
    'comments',
  );

  // Settle each finished week the same way lib/wagerSettlement.ts would.
  const wagers = PLAN.slice(0, -1).map((plan, week) => {
    const memberMet = plan.member.length >= WEEKLY_TARGET;
    const partnerMet = plan.partner.length >= WEEKLY_TARGET;
    const weekStart = addDays(pairedYmd, week * 7);
    const winner = memberMet === partnerMet ? null : memberMet ? memberId : partnerId;
    return {
      partnership_id: partnershipId,
      week_start: weekStart,
      terms: '1 Dinner 🍽️',
      status: winner === null ? 'wash' : SETTLED_WEEKS.has(week) ? 'settled' : 'won',
      winner_user_id: winner,
      created_at: zonedUtc(addDays(weekStart, 7), 9, 0, TZ).toISOString(),
    };
  });
  must(
    await admin
      .from('wagers')
      .upsert(wagers, { onConflict: 'partnership_id,week_start', ignoreDuplicates: true }),
    'wagers',
  );
}

async function copyPhotos(admin: SupabaseClient, folder: string, w: SeedWorkout) {
  const results = await Promise.all(
    (['selfie', 'environment'] as const).map((kind) =>
      admin.storage
        .from(BUCKET)
        .copy(`demo-source/${folder}/${kind}.jpg`, kind === 'selfie' ? w.selfie_path : w.environment_path),
    ),
  );
  for (const { error } of results) {
    // Deterministic paths: a previous run already put the same file there.
    if (error && !/exists|duplicate/i.test(error.message)) {
      throw new Error(`copy ${folder}: ${error.message}`);
    }
  }
}

// --------------------------------------------------------------- utilities

function zonedYmd(instant: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function offsetMs(instant: Date, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

// Wall-clock time in `tz` → UTC instant. Two passes settle DST edges.
function zonedUtc(ymd: string, hour: number, minute: number, tz: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d, hour, minute);
  let guess = wall - offsetMs(new Date(wall), tz);
  guess = wall - offsetMs(new Date(guess), tz);
  return new Date(guess);
}

async function digest(seed: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed)));
}

async function uuidFrom(seed: string): Promise<string> {
  const b = (await digest(seed)).slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Same alphabet as lib/partnership.tsx's generator.
async function inviteCodeFrom(seed: string): Promise<string> {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = await digest(`invite:${seed}`);
  return Array.from(b.slice(0, 6), (x) => alphabet[x % alphabet.length]).join('');
}
