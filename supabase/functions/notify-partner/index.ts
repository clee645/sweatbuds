// Supabase Edge Function: notify-partner
// Fires from the workouts AFTER INSERT trigger (see migration 0009). Sends
// two pushes to the workout-author's partner (when one exists):
//   1. Visible alert: "{name} just logged a workout"
//   2. Silent push:   content-available so the app refreshes its widget
//
// Deploy with: supabase functions deploy notify-partner
//
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY are auto-injected.
// Set EXPO_ACCESS_TOKEN as a function secret if you want enhanced rate limits;
// it's optional — Expo's push API works without it for low volume.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type WorkoutRow = {
  id: string;
  user_id: string;
  partnership_id: string | null;
  caption: string | null;
  selfie_path: string;
  environment_path: string;
  logged_at: string;
};

type PartnershipRow = {
  id: string;
  user_a: string;
  user_b: string | null;
  status: string;
};

type ProfileRow = { id: string; display_name: string };
type DeviceTokenRow = { user_id: string; token: string };

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body: { workout_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }
  const workoutId = body.workout_id;
  if (!workoutId) {
    return new Response('Missing workout_id', { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: workoutRaw, error: workoutErr } = await admin
    .from('workouts')
    .select('id, user_id, partnership_id, caption, selfie_path, environment_path, logged_at')
    .eq('id', workoutId)
    .maybeSingle();
  if (workoutErr || !workoutRaw) {
    return jsonResponse({ ok: false, reason: 'workout_not_found' }, 404);
  }
  const workout = workoutRaw as WorkoutRow;

  // Resolve partnership. Prefer the workout's partnership_id; fall back to
  // any active partnership the author belongs to.
  let partnership: PartnershipRow | null = null;
  if (workout.partnership_id) {
    const res = await admin
      .from('partnerships')
      .select('id, user_a, user_b, status')
      .eq('id', workout.partnership_id)
      .maybeSingle();
    partnership = (res.data as PartnershipRow | null) ?? null;
  }
  if (!partnership) {
    const res = await admin
      .from('partnerships')
      .select('id, user_a, user_b, status')
      .or(`user_a.eq.${workout.user_id},user_b.eq.${workout.user_id}`)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    partnership = (res.data as PartnershipRow | null) ?? null;
  }

  if (!partnership || partnership.status !== 'active') {
    return jsonResponse({ ok: true, reason: 'no_active_partnership' });
  }

  const partnerId =
    partnership.user_a === workout.user_id ? partnership.user_b : partnership.user_a;
  if (!partnerId) {
    return jsonResponse({ ok: true, reason: 'no_partner' });
  }

  const [{ data: authorRaw }, { data: tokenRaw }] = await Promise.all([
    admin
      .from('profiles')
      .select('id, display_name')
      .eq('id', workout.user_id)
      .maybeSingle(),
    admin
      .from('device_tokens')
      .select('user_id, token')
      .eq('user_id', partnerId)
      .maybeSingle(),
  ]);
  const author = authorRaw as ProfileRow | null;
  const tokenRow = tokenRaw as DeviceTokenRow | null;
  if (!tokenRow?.token) {
    return jsonResponse({ ok: true, reason: 'no_device_token' });
  }

  const authorName = author?.display_name ?? 'Your partner';
  const caption = workout.caption?.trim();

  // Sign image URLs for the Notification Service Extension to download.
  // The NSE has no Supabase auth, so URLs must be pre-signed server-side.
  const [selfieSigned, envSigned] = await Promise.all([
    admin.storage.from('workout-images').createSignedUrl(workout.selfie_path, 600),
    admin.storage.from('workout-images').createSignedUrl(workout.environment_path, 600),
  ]);
  const selfieUrl = selfieSigned.data?.signedUrl ?? null;
  const envUrl = envSigned.data?.signedUrl ?? null;

  // Distinct days the author has logged in the last 7 days. Approximation of
  // weekProgressFromWorkouts — the in-app JS partner-sync corrects to the
  // exact week-anchored value on next foreground.
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: weekRows } = await admin
    .from('workouts')
    .select('logged_at')
    .eq('user_id', workout.user_id)
    .gte('logged_at', since);
  const streak = new Set(
    (weekRows ?? []).map((r) => new Date(r.logged_at).toISOString().slice(0, 10)),
  ).size;

  const combinedPayload = {
    to: tokenRow.token,
    title: `${authorName} just logged a workout`,
    body: caption && caption.length > 0 ? caption : 'Tap to see it',
    sound: 'default',
    data: {
      type: 'partner_logged',
      workout_id: workout.id,
      selfie_url: selfieUrl,
      environment_url: envUrl,
      partner_name: authorName,
      logged_at: workout.logged_at,
      caption: workout.caption,
      streak,
    },
    mutableContent: true,
    _contentAvailable: true,
    priority: 'high',
    _category: 'partner_logged',
  };

  const result = await sendExpoPush(combinedPayload);

  return jsonResponse({ ok: true, result });
});

async function sendExpoPush(payload: unknown): Promise<unknown> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Accept-encoding': 'gzip, deflate',
  };
  if (EXPO_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${EXPO_ACCESS_TOKEN}`;
  }
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { status: res.status, body: text };
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
