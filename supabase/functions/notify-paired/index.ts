// Supabase Edge Function: notify-paired
// Fires from the partnerships AFTER UPDATE trigger (see migration 0012) when
// status flips from 'pending' to 'active'. Sends a visible + silent push to
// the original creator (user_a) so their app + widget refresh.
//
// Deploy with: supabase functions deploy notify-paired

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
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let body: { partnership_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }
  const partnershipId = body.partnership_id;
  if (!partnershipId) return new Response('Missing partnership_id', { status: 400 });

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: pRaw } = await admin
    .from('partnerships')
    .select('id, user_a, user_b, status')
    .eq('id', partnershipId)
    .maybeSingle();
  const partnership = pRaw as PartnershipRow | null;
  if (!partnership || partnership.status !== 'active' || !partnership.user_b) {
    return jsonResponse({ ok: true, reason: 'partnership_not_active' });
  }

  // user_a is the inviter — they're the one who needs the live banner.
  // user_b just redeemed in their own app and is already visually informed.
  const [{ data: joinerRaw }, { data: tokenRaw }] = await Promise.all([
    admin
      .from('profiles')
      .select('id, display_name')
      .eq('id', partnership.user_b)
      .maybeSingle(),
    admin
      .from('device_tokens')
      .select('user_id, token')
      .eq('user_id', partnership.user_a)
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
    title: `${joinerName} paired with you!`,
    body: 'Tap to start logging together',
    sound: 'default',
    data: { type: 'partner_paired', partnership_id: partnership.id },
  };

  const silentPayload = {
    to: tokenRow.token,
    data: { type: 'partner_paired', partnership_id: partnership.id, silent: true },
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
  if (EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${EXPO_ACCESS_TOKEN}`;
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
