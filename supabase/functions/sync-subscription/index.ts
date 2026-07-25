// Supabase Edge Function: sync-subscription
// Reconciles the caller's profiles.is_pro_until / is_pro with their
// authoritative RevenueCat subscriber state. Called from the client right
// after Purchases.logIn(userId) and after a purchase completes.
//
// Why this exists, even though the webhook is the main source of truth:
//   * Belt-and-suspenders: if a webhook is ever missed/delayed, the next app
//     launch reconciles the DB so a partner's unlock isn't left stale.
//   * Anonymous-before-login: if a purchase was ever made under an anonymous
//     RevenueCat id, logIn() aliases it to the real user without re-firing an
//     INITIAL_PURCHASE webhook; this pulls the now-correct state.
//   * Security: fetching server-side (rather than trusting the client's
//     customerInfo) means a tampered client cannot grant itself Pro.
//
// Deploy:  supabase functions deploy sync-subscription
// Secrets: REVENUECAT_SECRET_KEY (shared with redeem-promo-code)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const REVENUECAT_SECRET_KEY = Deno.env.get('REVENUECAT_SECRET_KEY') ?? '';

const ENTITLEMENT_ID = 'Sweatbuds Pro';

// See revenuecat-webhook for the lifetime-sentinel rationale.
const LIFETIME_SENTINEL = '9999-12-31T23:59:59Z';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'method not allowed' });
  }

  if (!REVENUECAT_SECRET_KEY) {
    console.error('REVENUECAT_SECRET_KEY not configured');
    return json(500, { error: 'server misconfigured' });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json(401, { error: 'missing authorization header' });

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json(401, { error: 'invalid session' });
  const userId = userData.user.id;

  const rcRes = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
    { headers: { Authorization: `Bearer ${REVENUECAT_SECRET_KEY}` } },
  );
  if (!rcRes.ok) {
    console.error('revenuecat subscriber fetch failed:', rcRes.status, await rcRes.text());
    return json(502, { error: 'upstream error' });
  }

  const rcBody = await rcRes.json();
  const entitlement = rcBody?.subscriber?.entitlements?.[ENTITLEMENT_ID];
  const expiresDate: string | null = entitlement?.expires_date ?? null;
  // Missing entitlement or past expiry → not pro. An entitlement row with a
  // null expires_date is a lifetime grant → active with no end date.
  const isActive =
    !!entitlement && (expiresDate === null || new Date(expiresDate) > new Date());

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const nextValue = isActive ? expiresDate ?? LIFETIME_SENTINEL : null;
  const { error: updateErr } = await admin
    .from('profiles')
    .update({ is_pro_until: nextValue, is_pro: nextValue !== null })
    .eq('id', userId);
  if (updateErr) {
    console.error('profiles update failed:', updateErr);
    return json(500, { error: 'db error' });
  }

  return json(200, { isPro: isActive, isProUntil: nextValue });
});
