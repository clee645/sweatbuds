import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

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
// So: an in-memory flag suppresses the toast while the flow is running, and a
// persisted flag records that the terms were actually agreed to.

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
    // Best-effort: worst case the invitee reviews the terms once more.
  }
}

export async function getJoinTermsAgreed(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(AGREED_KEY);
  } catch {
    return null;
  }
}
