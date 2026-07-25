// Supabase Edge Function: revenuecat-webhook
// Receives RevenueCat webhook events and updates the caller-independent,
// server-authoritative subscription state on profiles:
//   * is_pro_until — the precise entitlement expiry (timestamptz)
//   * is_pro       — the durable boolean every reader already uses, kept in
//                    lock-step with `is_pro_until > now()` so useAccessGate,
//                    the partnership realtime sync, and redeem_invite_code
//                    keep working unchanged.
//
// This replaces the old client-side is_pro write, which went stale when a sub
// renewed/lapsed/refunded while the app was closed (a partner's unlock reads
// that flag) and which a tampered client could forge.
//
// Configure in the RevenueCat dashboard:
//   Project → Integrations → Webhooks → Add new webhook
//   URL: https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook
//   Authorization header value: <REVENUECAT_WEBHOOK_AUTH secret>
//
// Deploy:
//   supabase functions deploy revenuecat-webhook --no-verify-jwt
//   (--no-verify-jwt because RevenueCat doesn't send a Supabase JWT — we
//   authenticate via our own shared-secret Authorization header instead.)
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected),
//   REVENUECAT_WEBHOOK_AUTH (shared secret), REVENUECAT_SECRET_KEY (for
//   TRANSFER-event reconciliation via the RevenueCat REST API).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_AUTH = Deno.env.get('REVENUECAT_WEBHOOK_AUTH') ?? '';
const REVENUECAT_SECRET_KEY = Deno.env.get('REVENUECAT_SECRET_KEY') ?? '';

const ENTITLEMENT_ID = 'Sweatbuds Pro';

// Sentinel for lifetime entitlements: RevenueCat sends a null expiration for
// promotional lifetime grants, but is_pro_until is a timestamptz and the
// `is_pro_until > now()` checks need a concrete value. Year 9999 is well within
// Postgres timestamptz range and outlives any reasonable use.
const LIFETIME_SENTINEL = '9999-12-31T23:59:59Z';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Events that grant or extend Pro — set is_pro_until to the event's expiry.
const GRANT_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'TEMPORARY_ENTITLEMENT_GRANT',
  'NON_RENEWING_PURCHASE',
]);

// Events that revoke Pro immediately — clear is_pro_until.
const REVOKE_EVENTS = new Set(['EXPIRATION', 'REFUND', 'SUBSCRIPTION_PAUSED']);

// Logged but no state change (CANCELLATION just means auto-renew is off; the
// user keeps Pro until the period ends and EXPIRATION fires).
const NOOP_EVENTS = new Set(['CANCELLATION', 'BILLING_ISSUE', 'TEST']);

// Writes both is_pro_until and the durable is_pro boolean together so every
// reader stays consistent. nextValue null = not pro.
async function writeProState(userId: string, nextValue: string | null): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({ is_pro_until: nextValue, is_pro: nextValue !== null })
    .eq('id', userId);
  if (error) {
    console.error('profiles pro-state update failed:', error);
    return false;
  }
  return true;
}

// Fetches the authoritative entitlement state for a user from RevenueCat and
// writes it. Used for TRANSFER, whose payload carries no expiry we can trust.
async function reconcileProfileFromRevenueCat(userId: string): Promise<void> {
  if (!REVENUECAT_SECRET_KEY) {
    console.warn('REVENUECAT_SECRET_KEY not set; skipping transfer reconcile');
    return;
  }
  const res = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
    { headers: { Authorization: `Bearer ${REVENUECAT_SECRET_KEY}` } },
  );
  if (!res.ok) {
    console.error('revenuecat subscriber fetch failed:', res.status, await res.text());
    return;
  }
  const body = await res.json();
  const entitlement = body?.subscriber?.entitlements?.[ENTITLEMENT_ID];
  const expiresDate: string | null = entitlement?.expires_date ?? null;
  const isActive =
    !!entitlement && (expiresDate === null || new Date(expiresDate) > new Date());
  // Active with null expires_date = lifetime grant; use the sentinel.
  await writeProState(userId, isActive ? expiresDate ?? LIFETIME_SENTINEL : null);
}

// Constant-time compare so the shared secret can't be recovered via timing.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }

  const auth = req.headers.get('Authorization') ?? '';
  if (!WEBHOOK_AUTH || !safeEqual(auth, WEBHOOK_AUTH)) {
    return new Response('unauthorized', { status: 401 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  const event = payload?.event;
  if (!event?.id || !event?.type) {
    return new Response('missing event fields', { status: 400 });
  }

  const eventId: string = event.id;
  const eventType: string = event.type;
  const userId: string | null = event.app_user_id ?? null;
  const productId: string | null = event.product_id ?? null;
  const expirationAt: Date | null = event.expiration_at_ms
    ? new Date(event.expiration_at_ms)
    : null;

  // Dedupe: insert the event row first; the unique constraint on
  // revenuecat_event_id makes RevenueCat's retries safe.
  const { error: insertErr } = await supabase.from('subscription_events').insert({
    revenuecat_event_id: eventId,
    user_id: userId,
    event_type: eventType,
    product_id: productId,
    expiration_at: expirationAt?.toISOString() ?? null,
    raw: payload,
  });

  if (insertErr && (insertErr as any).code !== '23505') {
    // 23505 = unique_violation: a replay, which is fine. Surface anything else
    // so RevenueCat retries.
    console.error('subscription_events insert failed:', insertErr);
    return new Response('db error', { status: 500 });
  }

  // TRANSFER carries transferred_to and no trustworthy expiry — reconcile each
  // recipient from RevenueCat's authoritative state.
  if (eventType === 'TRANSFER') {
    const transferredTo: unknown = event.transferred_to;
    const recipients: string[] = Array.isArray(transferredTo)
      ? transferredTo.filter(
          (id): id is string =>
            typeof id === 'string' && id.length > 0 && !id.startsWith('$RCAnonymousID:'),
        )
      : [];
    if (userId && !userId.startsWith('$RCAnonymousID:') && !recipients.includes(userId)) {
      recipients.push(userId);
    }
    for (const id of recipients) {
      await reconcileProfileFromRevenueCat(id);
    }
    return new Response('ok (transfer)', { status: 200 });
  }

  // No user id → nothing to gate (common for TEST events).
  if (!userId) {
    return new Response('ok (no user)', { status: 200 });
  }

  // Anonymous RevenueCat ids won't match a profile — happens when a user
  // purchased before signing in. The client-side sync-subscription call after
  // Purchases.logIn() reconciles that case; no-op here.
  if (userId.startsWith('$RCAnonymousID:')) {
    return new Response('ok (anonymous)', { status: 200 });
  }

  if (GRANT_EVENTS.has(eventType)) {
    // Null expiry on a GRANT means lifetime (promotional grants arrive this
    // way) — write the sentinel so `is_pro_until > now()` still holds.
    const ok = await writeProState(userId, expirationAt ? expirationAt.toISOString() : LIFETIME_SENTINEL);
    if (!ok) return new Response('db error', { status: 500 });
  } else if (REVOKE_EVENTS.has(eventType)) {
    const ok = await writeProState(userId, null);
    if (!ok) return new Response('db error', { status: 500 });
  } else if (!NOOP_EVENTS.has(eventType)) {
    // Unknown event — log and 200 so RevenueCat doesn't retry forever.
    console.warn('unhandled event type:', eventType);
  }

  return new Response('ok', { status: 200 });
});
