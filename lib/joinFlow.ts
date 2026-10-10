import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { supabase } from './supabase';
import type { Partnership } from '@/types/db';

// The invitee's post-redemption flow: join-confirm (review + sign the partner's
// terms) then the pairing celebration.
//
// Two problems live here. The redeeming device sets `freshlyPaired` through its
// own refresh(), so the root toast host would fire "🎉 {partner} joined your
// team" at the invitee — roles inverted, and over the top of the real payoff
// screen. And join-confirm used to consume that signal on mount just to silence
// the toast, which marked the pairing seen before the user had agreed: quitting
// on the signature pad meant neither the terms nor the celebration ever
// appeared again.
//
// So: an in-memory flag suppresses the toast while the flow is running, and
// partnerships.invitee_agreed_at records that the terms were actually agreed
// to. A local copy covers the window before that write lands (offline).

let active = false;
const listeners = new Set<(value: boolean) => void>();

export function setJoinFlowActive(value: boolean): void {
  if (active === value) return;
  active = value;
  for (const listener of listeners) listener(value);
}

export function useJoinFlowActive(): boolean {
  const [value, setValue] = useState(active);
  useEffect(() => {
    setValue(active);
    listeners.add(setValue);
    return () => {
      listeners.delete(setValue);
    };
  }, []);
  return value;
}

const AGREED_KEY = 'sweatbuds:joinTermsAgreedFor';

export async function setJoinTermsAgreed(partnershipId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(AGREED_KEY, partnershipId);
  } catch {
    // Best-effort: the server record below is what survives a reinstall.
  }
  await syncJoinTermsAgreed(partnershipId);
}

// Records the agreement server-side. Failures are left for the next launch's
// needsJoinTerms() to retry from the local copy.
async function syncJoinTermsAgreed(partnershipId: string): Promise<void> {
  const { error } = await supabase.rpc('agree_to_partnership_terms', {
    p_partnership_id: partnershipId,
  });
  if (error && __DEV__) console.warn('[joinFlow] agree sync failed', error);
}

async function getJoinTermsAgreed(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(AGREED_KEY);
  } catch {
    return null;
  }
}

// Whether `userId` still has to sign the partner's terms for `partnership`.
// Only the invitee ever does, and only until it's recorded on the row or on
// this device (in which case the server write is retried).
export async function needsJoinTerms(
  partnership: Partnership | null,
  userId: string | undefined,
): Promise<boolean> {
  if (!partnership || !userId || partnership.user_b !== userId) return false;
  if (partnership.invitee_agreed_at) return false;
  if ((await getJoinTermsAgreed()) === partnership.id) {
    void syncJoinTermsAgreed(partnership.id);
    return false;
  }
  return true;
}
