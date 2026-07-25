// Supabase Edge Function: notify-partner-joined
// Fires from the partnerships AFTER UPDATE trigger when status flips to
// 'active' (see migration 0011). Sends a celebratory push to user_a (the
// inviter) so they learn their partner joined even when the app is closed
// or backgrounded.
//
// Deploy with: supabase functions deploy notify-partner-joined
//
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY are auto-injected.
// Set EXPO_ACCESS_TOKEN as a function secret if you want enhanced rate limits.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

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

  let body: { partnership_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }
  const partnershipId = body.partnership_id;
  if (!partnershipId) {
    return new Response('Missing partnership_id', { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: partnershipRaw, error: partnershipErr } = await admin
    .from('partnerships')
    .select('id, user_a, user_b, status')
    .eq('id', partnershipId)
    .maybeSingle();
  if (partnershipErr || !partnershipRaw) {
    return jsonResponse({ ok: false, reason: 'partnership_not_found' }, 404);
  }
  const partnership = partnershipRaw as PartnershipRow;

  if (partnership.status !== 'active' || !partnership.user_b) {
    return jsonResponse({ ok: true, reason: 'not_active_yet' });
  }

  // Notify user_a (the inviter); they're the one who's been waiting.
  const inviterId = partnership.user_a;
  const joinerId = partnership.user_b;

  const [{ data: joinerRaw }, { data: tokenRaw }] = await Promise.all([
    admin
      .from('profiles')
      .select('id, display_name')
      .eq('id', joinerId)
      .maybeSingle(),
    admin
      .from('device_tokens')
      .select('user_id, token')
      .eq('user_id', inviterId)
      .maybeSingle(),
  ]);

  const joiner = joinerRaw as ProfileRow | null;
  const tokenRow = tokenRaw as DeviceTokenRow | null;
  if (!tokenRow?.token) {
    return jsonResponse({ ok: true, reason: 'no_device_token' });
  }

  const joinerName = joiner?.display_name ?? 'Your partner';

  const visiblePayload = {
    to: tokenRow.token,
    title: `🎉 ${joinerName} joined your team`,
    body: 'Time to stay accountable together',
    sound: 'default',
    data: { type: 'partner_joined', partnership_id: partnership.id },
    mutableContent: true,
    _category: 'partner_joined',
  };

  const silentPayload = {
    to: tokenRow.token,
    data: { type: 'partner_joined', partnership_id: partnership.id, silent: true },
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
