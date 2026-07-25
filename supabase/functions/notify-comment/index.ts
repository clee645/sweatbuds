// Supabase Edge Function: notify-comment
// Fires from the workout_comments AFTER INSERT trigger (see migration 0014).
// Sends two pushes to the workout author when their partner left a comment:
//   1. Visible alert: "{name} commented on your workout"
//   2. Silent push:   content-available so the app refreshes its comments view
//
// Self-comments are ignored (no notification when you comment on your own row).
//
// Deploy with: supabase functions deploy notify-comment
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
const BODY_MAX = 120;

type CommentRow = {
  id: string;
  workout_id: string;
  user_id: string;
  content: string;
};

type WorkoutRow = {
  id: string;
  user_id: string;
};

type ProfileRow = { id: string; display_name: string };
type DeviceTokenRow = { user_id: string; token: string };

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body: { comment_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }
  const commentId = body.comment_id;
  if (!commentId) {
    return new Response('Missing comment_id', { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: commentRaw, error: commentErr } = await admin
    .from('workout_comments')
    .select('id, workout_id, user_id, content')
    .eq('id', commentId)
    .maybeSingle();
  if (commentErr || !commentRaw) {
    return jsonResponse({ ok: false, reason: 'comment_not_found' }, 404);
  }
  const comment = commentRaw as CommentRow;

  const { data: workoutRaw, error: workoutErr } = await admin
    .from('workouts')
    .select('id, user_id')
    .eq('id', comment.workout_id)
    .maybeSingle();
  if (workoutErr || !workoutRaw) {
    return jsonResponse({ ok: false, reason: 'workout_not_found' }, 404);
  }
  const workout = workoutRaw as WorkoutRow;

  // Skip self-comments — the workout author commenting on their own photo
  // shouldn't push a notification to themselves.
  if (comment.user_id === workout.user_id) {
    return jsonResponse({ ok: true, reason: 'self_comment' });
  }

  const recipientId = workout.user_id;

  const [{ data: authorRaw }, { data: tokenRaw }] = await Promise.all([
    admin
      .from('profiles')
      .select('id, display_name')
      .eq('id', comment.user_id)
      .maybeSingle(),
    admin
      .from('device_tokens')
      .select('user_id, token')
      .eq('user_id', recipientId)
      .maybeSingle(),
  ]);
  const author = authorRaw as ProfileRow | null;
  const tokenRow = tokenRaw as DeviceTokenRow | null;
  if (!tokenRow?.token) {
    return jsonResponse({ ok: true, reason: 'no_device_token' });
  }

  const authorName = author?.display_name ?? 'Your partner';
  const trimmed = comment.content.trim();
  const bodyText =
    trimmed.length > BODY_MAX ? `${trimmed.slice(0, BODY_MAX - 1)}…` : trimmed;

  const visiblePayload = {
    to: tokenRow.token,
    title: `${authorName} commented on your workout`,
    body: bodyText,
    sound: 'default',
    data: {
      type: 'partner_commented',
      workout_id: workout.id,
      comment_id: comment.id,
    },
    mutableContent: true,
    _category: 'partner_commented',
  };

  const silentPayload = {
    to: tokenRow.token,
    data: {
      type: 'partner_commented',
      workout_id: workout.id,
      comment_id: comment.id,
      silent: true,
    },
    _contentAvailable: true,
    priority: 'high',
  };

  const results = await Promise.all([
    sendExpoPush(visiblePayload),
    sendExpoPush(silentPayload),
  ]);

  return jsonResponse({ ok: true, results });
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
