import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from './auth';
import { supabase } from './supabase';
import { getCurrentWeekStartDay, getWeekWindow, nextDayOnOrAfter } from './week';
import type { Partnership, PartnershipAnchorHistory, Profile } from '@/types/db';

const SELECT_COLUMNS =
  'id, user_a, user_b, invite_code, status, weekly_target, wager_quantity, wager_text, wager_emoji, created_at, paired_at, week_anchor_at, week_anchor_pending_at, wager_ledger_since';

const ANCHOR_HISTORY_COLUMNS =
  'id, partnership_id, anchor_at, effective_until, created_at';

const PROFILE_COLUMNS = 'id, display_name, avatar_url, created_at, timezone, is_pro';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const SEEN_PAIRING_KEY = 'sweatbuds:lastSeenPairingId';
// Persisted whenever we have an active partnership, so a cold start can detect a
// partnership that ended while the app was fully closed (covers the case where
// the survivor had notifications off and missed both the realtime event and push).
const LAST_ACTIVE_PARTNERSHIP_KEY = 'sweatbuds:lastActivePartnershipId';

function generateInviteCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export type PartnershipUpdateFields = Partial<
  Pick<Partnership, 'weekly_target' | 'wager_quantity' | 'wager_text' | 'wager_emoji'>
>;

export type FreshlyPaired = {
  partnershipId: string;
  partnerId: string;
  partnerName: string;
  viaColdStart: boolean;
};

export type SetWeekStartDayResult = 'updated' | 'noop';

type PartnershipContextValue = {
  partnership: Partnership | null;
  partner: Profile | null;
  anchorHistory: PartnershipAnchorHistory[];
  loading: boolean;
  refresh: () => Promise<void>;
  update: (fields: PartnershipUpdateFields) => Promise<void>;
  setWeekStartDay: (day: number) => Promise<SetWeekStartDayResult>;
  applyAnchorPromotion: (fields: {
    week_anchor_at: string;
    week_anchor_pending_at: null;
  }) => Promise<void>;
  freshlyPaired: FreshlyPaired | null;
  consumeFreshlyPaired: () => void;
  freshlyEnded: FreshlyEnded | null;
  consumeFreshlyEnded: () => void;
};

// Set when an active partnership transitions to gone (partner deleted their
// account, was removed, or unpaired) so the survivor gets an in-app heads-up.
export type FreshlyEnded = {
  partnershipId: string;
};

const PartnershipContext = createContext<PartnershipContextValue | undefined>(undefined);

export function PartnershipProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [partnership, setPartnership] = useState<Partnership | null>(null);
  const [partner, setPartner] = useState<Profile | null>(null);
  const [anchorHistory, setAnchorHistory] = useState<PartnershipAnchorHistory[]>([]);
  // Stale-while-revalidate: `loading` flips to false after the first fetch
  // and stays false. Subsequent refreshes (foreground, realtime, push) update
  // partnership/partner state silently so the home screen doesn't flash to
  // the skeleton every time the app comes back to foreground.
  const [hasLoaded, setHasLoaded] = useState(false);
  const [freshlyPaired, setFreshlyPaired] = useState<FreshlyPaired | null>(null);
  const [freshlyEnded, setFreshlyEnded] = useState<FreshlyEnded | null>(null);
  const loading = Boolean(userId) && !hasLoaded;

  // Reset the first-load gate when the user changes (sign out / sign in).
  useEffect(() => {
    setHasLoaded(false);
  }, [userId]);

  const partnershipRef = useRef<Partnership | null>(null);
  const isFirstLoadRef = useRef(true);

  const fetchPartnership = useCallback(async (uid: string): Promise<Partnership | null> => {
    const { data, error } = await supabase
      .from('partnerships')
      .select(SELECT_COLUMNS)
      .or(`user_a.eq.${uid},user_b.eq.${uid}`)
      .order('status', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data as Partnership | null) ?? null;
  }, []);

  const fetchPartner = useCallback(
    async (uid: string, p: Partnership | null): Promise<Profile | null> => {
      if (!p || p.status !== 'active') return null;
      const partnerId = p.user_a === uid ? p.user_b : p.user_a;
      if (!partnerId) return null;
      const { data } = await supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('id', partnerId)
        .maybeSingle();
      return (data as Profile | null) ?? null;
    },
    [],
  );

  const fetchAnchorHistory = useCallback(
    async (partnershipId: string): Promise<PartnershipAnchorHistory[]> => {
      const { data, error } = await supabase
        .from('partnership_anchor_history')
        .select(ANCHOR_HISTORY_COLUMNS)
        .eq('partnership_id', partnershipId)
        .order('anchor_at', { ascending: true });
      if (error) return [];
      return (data as PartnershipAnchorHistory[] | null) ?? [];
    },
    [],
  );

  const refresh = useCallback(async () => {
    if (!userId) {
      setPartnership(null);
      setPartner(null);
      setAnchorHistory([]);
      setHasLoaded(false);
      partnershipRef.current = null;
      isFirstLoadRef.current = true;
      return;
    }
    try {
      const previous = partnershipRef.current;
      const next = await fetchPartnership(userId);
      const nextPartner = await fetchPartner(userId, next);
      const nextHistory = next ? await fetchAnchorHistory(next.id) : [];

      partnershipRef.current = next;
      setPartnership(next);
      setPartner(nextPartner);
      setAnchorHistory(nextHistory);

      // Detect a fresh pairing transition.
      if (next && next.status === 'active' && nextPartner) {
        const wasActiveBefore =
          previous && previous.id === next.id && previous.status === 'active';

        if (isFirstLoadRef.current) {
          // Cold-start path: compare against AsyncStorage to see whether we've
          // ever shown the celebration for this partnership on this device.
          const seenId = await AsyncStorage.getItem(SEEN_PAIRING_KEY);
          if (seenId !== next.id) {
            setFreshlyPaired({
              partnershipId: next.id,
              partnerId: nextPartner.id,
              partnerName: nextPartner.display_name,
              viaColdStart: true,
            });
          }
        } else if (!wasActiveBefore) {
          // Live path: realtime callback triggered this refresh.
          setFreshlyPaired({
            partnershipId: next.id,
            partnerId: nextPartner.id,
            partnerName: nextPartner.display_name,
            viaColdStart: false,
          });
        }
      }

      // Detect a partnership that just ended: we had an active partner and now
      // don't (partner deleted their account, was removed, or unpaired).
      if (previous && previous.status === 'active' && (!next || next.status !== 'active')) {
        // Live transition: we watched it disappear this session (realtime/refresh).
        setFreshlyEnded({ partnershipId: previous.id });
      } else if (
        isFirstLoadRef.current &&
        !previous &&
        (!next || next.status !== 'active')
      ) {
        // Cold-start path: the change happened while the app was fully closed.
        // Compare against the last active partnership we persisted on a prior run.
        const lastId = await AsyncStorage.getItem(LAST_ACTIVE_PARTNERSHIP_KEY);
        if (lastId) {
          setFreshlyEnded({ partnershipId: lastId });
        }
      }

      // Remember whether we currently have an active partnership so the next cold
      // start can detect a loss that happened while the app was closed.
      if (next && next.status === 'active') {
        await AsyncStorage.setItem(LAST_ACTIVE_PARTNERSHIP_KEY, next.id);
      } else {
        await AsyncStorage.removeItem(LAST_ACTIVE_PARTNERSHIP_KEY);
      }

      isFirstLoadRef.current = false;
    } catch {
      setPartnership(null);
      setPartner(null);
      setAnchorHistory([]);
      partnershipRef.current = null;
    } finally {
      setHasLoaded(true);
    }
  }, [userId, fetchPartnership, fetchPartner, fetchAnchorHistory]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Realtime subscription so the inviter's device hears the moment user_b
  // is filled in. Two listeners on one channel cover both sides of the row.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`partnership:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'partnerships', filter: `user_a=eq.${userId}` },
        () => {
          void refresh();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'partnerships', filter: `user_b=eq.${userId}` },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  // Live partner-profile updates: when the other user changes their display
  // name or avatar, push the change here within ~1s via Supabase Realtime so
  // the home screen + ThisWeekCard reflect it without an app reload. Requires
  // the `profiles` table to be in the `supabase_realtime` publication
  // (Dashboard → Database → Replication).
  useEffect(() => {
    const partnerId = partner?.id;
    if (!partnerId) return;
    const channel = supabase
      .channel(`partner-profile:${partnerId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${partnerId}`,
        },
        (payload) => {
          const next = payload.new as Partial<Profile> | null;
          if (!next) return;
          setPartner((prev) =>
            prev && prev.id === partnerId
              ? {
                  ...prev,
                  display_name: next.display_name ?? prev.display_name,
                  avatar_url:
                    next.avatar_url !== undefined ? next.avatar_url : prev.avatar_url,
                  timezone: next.timezone !== undefined ? next.timezone : prev.timezone,
                  is_pro: next.is_pro ?? prev.is_pro,
                }
              : prev,
          );
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [partner?.id]);

  const consumeFreshlyPaired = useCallback(() => {
    const current = freshlyPaired;
    if (!current) return;
    setFreshlyPaired(null);
    void AsyncStorage.setItem(SEEN_PAIRING_KEY, current.partnershipId);
  }, [freshlyPaired]);

  const consumeFreshlyEnded = useCallback(() => {
    setFreshlyEnded(null);
  }, []);

  const update = useCallback(
    async (fields: PartnershipUpdateFields) => {
      if (!userId) throw new Error('Not signed in');

      if (partnership) {
        const { data, error } = await supabase
          .from('partnerships')
          .update(fields)
          .eq('id', partnership.id)
          .select(SELECT_COLUMNS)
          .single();
        if (error) throw error;
        setPartnership(data as Partnership);
        partnershipRef.current = data as Partnership;
        return;
      }

      let lastError: unknown = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateInviteCode();
        const { data, error } = await supabase
          .from('partnerships')
          .insert({ user_a: userId, invite_code: code, ...fields })
          .select(SELECT_COLUMNS)
          .single();
        if (!error && data) {
          setPartnership(data as Partnership);
          partnershipRef.current = data as Partnership;
          return;
        }
        lastError = error;
        if (error && error.code !== '23505') break;
      }
      throw lastError instanceof Error
        ? lastError
        : new Error('Could not save rules. Try again.');
    },
    [userId, partnership],
  );

  const setWeekStartDay = useCallback(
    async (day: number): Promise<SetWeekStartDayResult> => {
      if (!userId) throw new Error('Not signed in');
      if (!partnership) throw new Error('No partnership');
      if (day < 0 || day > 6 || !Number.isInteger(day)) {
        throw new Error('Invalid day');
      }
      const currentDay = getCurrentWeekStartDay(partnership);
      if (currentDay === day) return 'noop';

      // Anchor the new pending date to the END of the current cycle, not
      // today — guarantees the in-progress week never shrinks below 7 days.
      const window = getWeekWindow(partnership, new Date());
      if (!window) throw new Error('No active week');
      const cycleEnd = new Date(window.weekStart);
      cycleEnd.setDate(cycleEnd.getDate() + 7);
      const next = nextDayOnOrAfter(day, cycleEnd);

      const { data, error } = await supabase
        .from('partnerships')
        .update({ week_anchor_pending_at: next.toISOString() })
        .eq('id', partnership.id)
        .select(SELECT_COLUMNS)
        .single();
      if (error) throw error;
      setPartnership(data as Partnership);
      partnershipRef.current = data as Partnership;
      return 'updated';
    },
    [userId, partnership],
  );

  const applyAnchorPromotion = useCallback(
    async (fields: { week_anchor_at: string; week_anchor_pending_at: null }) => {
      if (!partnership) return;
      const { data, error } = await supabase
        .from('partnerships')
        .update(fields)
        .eq('id', partnership.id)
        .select(SELECT_COLUMNS)
        .single();
      if (error) throw error;
      setPartnership(data as Partnership);
      partnershipRef.current = data as Partnership;
      // The DB trigger closed the previous era and opened a new one server-
      // side; pull the refreshed history so era-aware bucketing reflects it.
      const nextHistory = await fetchAnchorHistory(partnership.id);
      setAnchorHistory(nextHistory);
    },
    [partnership, fetchAnchorHistory],
  );

  const value = useMemo<PartnershipContextValue>(
    () => ({
      partnership,
      partner,
      anchorHistory,
      loading,
      refresh,
      update,
      setWeekStartDay,
      applyAnchorPromotion,
      freshlyPaired,
      consumeFreshlyPaired,
      freshlyEnded,
      consumeFreshlyEnded,
    }),
    [
      partnership,
      partner,
      anchorHistory,
      loading,
      refresh,
      update,
      setWeekStartDay,
      applyAnchorPromotion,
      freshlyPaired,
      consumeFreshlyPaired,
      freshlyEnded,
      consumeFreshlyEnded,
    ],
  );

  return <PartnershipContext.Provider value={value}>{children}</PartnershipContext.Provider>;
}

export function usePartnership(): PartnershipContextValue {
  const ctx = useContext(PartnershipContext);
  if (!ctx) throw new Error('usePartnership must be used within PartnershipProvider');
  return ctx;
}
