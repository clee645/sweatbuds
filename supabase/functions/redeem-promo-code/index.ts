// Supabase Edge Function: redeem-promo-code
// Applies an app-defined promo code to a user's RevenueCat account.
//
// These are NOT Apple offer/promo codes (those are generated in App Store
// Connect and redeemed through the App Store). These are our own codes, stored
// in public.promo_codes and redeemed in-app:
//   * lifetime / time-limited grants → granted via RevenueCat's promotional
//     entitlement endpoint (no Apple transaction, no money collected — for
//     comps/influencers). The "Sweatbuds Pro" entitlement flips on, the webhook
//     mirrors it to profiles, and the access gate unlocks.
//   * 'discount' → no grant; we return the offering_id so the client re-renders
//     the paywall against a cheaper App Store product the user actually buys.
//
// Flow:
//   1. Client (paywall promo entry) calls this with { code, rcAppUserId }.
//      rcAppUserId is Purchases.getAppUserID() — the identified user id once
//      signed in (Sweatbuds gates behind auth, so it's rarely anonymous).
//   2. We re-validate server-side (never trust the client's earlier check),
//      enforce expiry + redemption caps, grant via RevenueCat, then record it.
//
// Why server-side: the RevenueCat Secret Key must never touch a client, and
// granting from the client would let anyone hand themselves Pro.
//
// Deploy:  supabase functions deploy redeem-promo-code --no-verify-jwt
//   (--no-verify-jwt so the function can also serve a not-yet-authenticated
//   caller; abuse is bounded by the code itself + the per-RC-user uniqueness.)
// Secrets: REVENUECAT_SECRET_KEY (shared with sync-subscription).
//   SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
//   automatically. The anon key is used only to resolve the caller's identity
//   from their Authorization header (see resolveUserId).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const REVENUECAT_SECRET_KEY = Deno.env.get('REVENUECAT_SECRET_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Matches RevenueCat's promotional-entitlement duration enum exactly. Keep the
// promo_codes.grant_type CHECK constraint (migration 0019) aligned.
const RC_DURATIONS = new Set([
  'lifetime',
  'weekly',
  'monthly',
  'two_months',
  'three_months',
  'six_months',
  'yearly',
]);

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Best-effort caller identity for promo_redemptions.user_id.
//
// supabase-js attaches the current session's Authorization header to
// functions.invoke(), so the normal signed-in redeemer hands us their user id
// for free — we just never read it before, which left user_id null on every row
// and its index dead.
//
// Deliberately OPTIONAL and non-fatal. This function is deployed
// --no-verify-jwt so it can also serve a caller who isn't authenticated yet,
// and supabase-js sends the anon key as the bearer token when there's no
// session — which resolves to no user. Neither case should block a redemption
// that is otherwise valid, so every failure path returns null and we record the
// redemption against rc_app_user_id alone, exactly as before.
async function resolveUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !ANON_KEY) return null;
  try {
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
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

  let body: { code?: string; rcAppUserId?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid json' });
  }

  const code = (body.code ?? '').trim().toUpperCase();
  const rcAppUserId = (body.rcAppUserId ?? '').trim();
  if (!code || !rcAppUserId) {
    return json(400, { error: 'code and rcAppUserId are required' });
  }

  const { data: promo, error: promoErr } = await supabase
    .from('promo_codes')
    .select(
      'id, code, active, grant_type, entitlement_id, offering_id, percent_off, display_label, max_redemptions, expires_at',
    )
    .eq('code', code)
    .eq('active', true)
    .maybeSingle();

  if (promoErr) {
    console.error('promo_codes lookup failed:', promoErr);
    return json(500, { error: 'db error' });
  }
  if (!promo) {
    return json(404, { error: 'invalid or inactive code' });
  }

  if (promo.expires_at && new Date(promo.expires_at) <= new Date()) {
    return json(410, { error: 'code expired' });
  }

  if (!promo.grant_type) {
    return json(409, { error: 'code has no grant configured' });
  }

  // Global redemption cap.
  if (promo.max_redemptions != null) {
    const { count, error: countErr } = await supabase
      .from('promo_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('promo_code_id', promo.id);
    if (countErr) {
      console.error('promo_redemptions count failed:', countErr);
      return json(500, { error: 'db error' });
    }
    if ((count ?? 0) >= promo.max_redemptions) {
      return json(409, { error: 'code redemption limit reached' });
    }
  }

  // Idempotency: if this RC identity already redeemed this code, treat the call
  // as a success and return stored metadata. Covers client retries.
  const { data: existing } = await supabase
    .from('promo_redemptions')
    .select('id')
    .eq('promo_code_id', promo.id)
    .eq('rc_app_user_id', rcAppUserId)
    .maybeSingle();

  if (existing) {
    return json(200, {
      alreadyRedeemed: true,
      grant_type: promo.grant_type,
      entitlement_id: promo.entitlement_id,
      offering_id: promo.offering_id,
      percent_off: promo.percent_off,
      display_label: promo.display_label,
    });
  }

  // For lifetime/time-limited grants, hit RevenueCat first. If that fails we
  // must NOT record a redemption — otherwise the user is stuck: no entitlement,
  // but blocked by the uniqueness index from retrying.
  if (RC_DURATIONS.has(promo.grant_type)) {
    const url =
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(rcAppUserId)}` +
      `/entitlements/${encodeURIComponent(promo.entitlement_id)}/promotional`;
    const rcRes = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REVENUECAT_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ duration: promo.grant_type }),
    });
    if (!rcRes.ok) {
      console.error('revenuecat promotional grant failed:', rcRes.status, await rcRes.text());
      return json(502, { error: 'upstream error' });
    }
  } else if (promo.grant_type !== 'discount') {
    // Shouldn't happen — the CHECK constraint blocks it — but fail loud.
    return json(500, { error: 'unsupported grant_type' });
  }

  // Resolved here rather than up top so a rejected code (invalid, expired, capped)
  // doesn't pay for an auth round-trip it will never use.
  const userId = await resolveUserId(req);

  const { error: insertErr } = await supabase.from('promo_redemptions').insert({
    promo_code_id: promo.id,
    user_id: userId,
    rc_app_user_id: rcAppUserId,
    grant_type: promo.grant_type,
  });
  if (insertErr && (insertErr as any).code !== '23505') {
    // 23505 = raced with another redemption for the same (code, rc_user). The
    // grant (if any) is idempotent on RC's side, so still return success.
    console.error('promo_redemptions insert failed:', insertErr);
    return json(500, { error: 'db error' });
  }

  return json(200, {
    alreadyRedeemed: false,
    grant_type: promo.grant_type,
    entitlement_id: promo.entitlement_id,
    offering_id: promo.offering_id,
    percent_off: promo.percent_off,
    display_label: promo.display_label,
  });
});
