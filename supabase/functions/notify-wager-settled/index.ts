// Supabase Edge Function: notify-wager-settled
// Called by the client right after a user taps "Mark one as done" on the Wager
// Balance screen. Sends two pushes to the OTHER partnership member:
//   1. Visible alert: "{name} marked a wager as done 🎉"
//   2. Silent push:   content-available so the app can refresh
//
// Client-invoked rather than a DB trigger on purpose: "Mark all as done" uses
// the same status update, and a per-row trigger would fan out one push per
// wager. Only the single-wager action should notify.
//
// The caller is resolved from their JWT and must be a member of the wager's
// partnership, so a client can't push arbitrary users.
//
// Deploy with: supabase functions deploy notify-wager-settled
//
// SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are auto-injected.
// Set EXPO_ACCESS_TOKEN as a function secret if you want enhanced rate limits.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type WagerRow = {
  id: string;
  partnership_id: string;
  terms: string;
  status: string;
  winner_user_id: string | null;
};
type PartnershipRow = { id: string; user_a: string; user_b: string | null };
type ProfileRow = { id: string; display_name: string };
type DeviceTokenRow = { user_id: string; token: string };

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const callerId = await resolveUserId(req);
  if (!callerId) {
    return jsonResponse({ ok: false, reason: 'unauthenticated' }, 401);
  }

  let body: { wager_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }
  const wagerId = body.wager_id;
  if (!wagerId) {
    return new Response('Missing wager_id', { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: wagerRaw } = await admin
    .from('wagers')
    .select('id, partnership_id, terms, status, winner_user_id')
    .eq('id', wagerId)
    .maybeSingle();
  const wager = wagerRaw as WagerRow | null;
  if (!wager) {
    return jsonResponse({ ok: false, reason: 'wager_not_found' }, 404);
  }
  // Only announce wagers that are actually settled — guards against the client
  // calling this before (or instead of) the status update landing.
  if (wager.status !== 'settled') {
    return jsonResponse({ ok: false, reason: 'not_settled' }, 409);
  }

  const { data: partnershipRaw } = await admin
    .from('partnerships')
    .select('id, user_a, user_b')
    .eq('id', wager.partnership_id)
    .maybeSingle();
  const partnership = partnershipRaw as PartnershipRow | null;
  if (!partnership) {
    return jsonResponse({ ok: false, reason: 'partnership_not_found' }, 404);
  }

  let recipientId: string | null = null;
  if (partnership.user_a === callerId) recipientId = partnership.user_b;
  else if (partnership.user_b === callerId) recipientId = partnership.user_a;
  else return jsonResponse({ ok: false, reason: 'not_member' }, 403);
  if (!recipientId) {
    return jsonResponse({ ok: true, reason: 'no_partner' });
  }

  const [{ data: callerRaw }, { data: tokenRaw }] = await Promise.all([
    admin.from('profiles').select('id, display_name').eq('id', callerId).maybeSingle(),
    admin
      .from('device_tokens')
      .select('user_id, token')
      .eq('user_id', recipientId)
      .maybeSingle(),
  ]);
  const caller = callerRaw as ProfileRow | null;
  const tokenRow = tokenRaw as DeviceTokenRow | null;
  if (!tokenRow?.token) {
    return jsonResponse({ ok: true, reason: 'no_device_token' });
  }

  const callerName = caller?.display_name ?? 'Your partner';
  const recipientWon = wager.winner_user_id === recipientId;
  const bodyText = recipientWon
    ? `${wager.terms}: paid in full.`
    : `${wager.terms}: you're all square now.`;

  const data = { type: 'partner_settled_wager', wager_id: wager.id };

  const visiblePayload = {
    to: tokenRow.token,
    title: `${callerName} marked a wager as done 🎉`,
    body: bodyText,
    sound: 'default',
    data,
    mutableContent: true,
    _category: 'partner_settled_wager',
  };

  const silentPayload = {
    to: tokenRow.token,
    data: { ...data, silent: true },
    _contentAvailable: true,
    priority: 'high',
  };

  const results = await Promise.all([
    sendExpoPush(visiblePayload),
    sendExpoPush(silentPayload),
  ]);

  return jsonResponse({ ok: true, results });
});

async function resolveUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !SUPABASE_ANON_KEY) return null;
  try {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data, error } = await userClient.auth.getUser();
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

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
