import Purchases from 'react-native-purchases';

import { supabase } from './supabase';

// In-app promo codes (NOT Apple offer codes — see redeem-promo-code edge
// function). The server validates the code, grants/looks up the benefit, and
// returns how the paywall should react:
//   * 'granted'  — a lifetime/time-limited RevenueCat entitlement was applied;
//                  the caller should refresh customer info and let the gate
//                  unlock (no purchase needed).
//   * 'discount' — no grant; rebind the paywall to `offeringId` (a cheaper App
//                  Store product) so the user buys at the discounted price.
export type PromoOutcome =
  | { kind: 'granted'; displayLabel: string | null }
  | { kind: 'discount'; offeringId: string; percentOff: number | null; displayLabel: string | null }
  | { kind: 'error'; message: string };

type RedeemResponse = {
  grant_type: string;
  offering_id: string | null;
  percent_off: number | null;
  display_label: string | null;
};

// Map the edge function's error payloads to user-facing copy.
const ERROR_COPY: Record<string, string> = {
  'invalid or inactive code': "That code isn't valid.",
  'code expired': 'That code has expired.',
  'code redemption limit reached': 'That code has reached its redemption limit.',
  'code has no grant configured': "That code isn't valid.",
};

export async function redeemPromoCode(code: string): Promise<PromoOutcome> {
  const trimmed = code.trim();
  if (!trimmed) return { kind: 'error', message: 'Enter a code.' };

  let rcAppUserId: string;
  try {
    rcAppUserId = await Purchases.getAppUserID();
  } catch {
    return { kind: 'error', message: 'Could not reach the store. Try again.' };
  }

  const { data, error } = await supabase.functions.invoke<RedeemResponse>('redeem-promo-code', {
    body: { code: trimmed, rcAppUserId },
  });

  if (error) {
    // supabase-js surfaces non-2xx as a FunctionsHttpError; the JSON body with
    // our { error } message is on error.context.
    const message = await extractErrorMessage(error);
    return { kind: 'error', message };
  }
  if (!data) {
    return { kind: 'error', message: 'Something went wrong. Please try again.' };
  }

  if (data.grant_type === 'discount') {
    if (!data.offering_id) {
      return { kind: 'error', message: 'Something went wrong. Please try again.' };
    }
    return {
      kind: 'discount',
      offeringId: data.offering_id,
      percentOff: data.percent_off,
      displayLabel: data.display_label,
    };
  }

  return { kind: 'granted', displayLabel: data.display_label };
}

async function extractErrorMessage(error: unknown): Promise<string> {
  const fallback = 'That code could not be redeemed.';
  const context = (error as { context?: Response })?.context;
  if (context && typeof context.json === 'function') {
    try {
      const body = await context.json();
      const raw = typeof body?.error === 'string' ? body.error : null;
      if (raw) return ERROR_COPY[raw] ?? fallback;
    } catch {
      // fall through
    }
  }
  return fallback;
}
