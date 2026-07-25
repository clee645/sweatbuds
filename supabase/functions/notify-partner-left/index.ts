// Supabase Edge Function: notify-partner-left
// Fires from the profiles BEFORE DELETE trigger (see migration 0020) when a user
// deletes their account or is removed out-of-band. Sends a neutral push to the
// surviving partner so they learn the partnership ended even with the app closed.
//
// The partnership row is already being cascade-deleted, so the trigger passes the
// survivor's id directly ({ recipient_id }) rather than a partnership_id.
//
// Deploy with: supabase functions deploy notify-partner-left
//
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY are auto-injected.
// Set EXPO_ACCESS_TOKEN as a function secret if you want enhanced rate limits.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type DeviceTokenRow = { user_id: string; token: string };

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body: { recipient_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }
  const recipientId = body.recipient_id;
  if (!recipientId) {
    return new Response('Missing recipient_id', { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: tokenRaw } = await admin
    .from('device_tokens')
    .select('user_id, token')
    .eq('user_id', recipientId)
    .maybeSingle();

  const tokenRow = tokenRaw as DeviceTokenRow | null;
  if (!tokenRow?.token) {
    return jsonResponse({ ok: true, reason: 'no_device_token' });
  }

  // Neutral, name-free copy: the departed profile no longer exists, and we don't
  // disclose whether they deleted vs. unpaired.
  const visiblePayload = {
    to: tokenRow.token,
    title: 'Your partner left',
    body: 'Your Sweatbuds partnership has ended.',
    sound: 'default',
    data: { type: 'partner_left' },
    mutableContent: true,
    _category: 'partner_left',
  };

  const silentPayload = {
    to: tokenRow.token,
    data: { type: 'partner_left', silent: true },
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
