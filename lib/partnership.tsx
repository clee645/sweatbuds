import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from './auth';
import { supabase } from './supabase';
import type { Partnership, Profile } from '@/types/db';

const SELECT_COLUMNS =
  'id, user_a, user_b, invite_code, status, weekly_target, wager_quantity, wager_text, wager_emoji, created_at';

const PROFILE_COLUMNS = 'id, display_name, avatar_url, created_at, timezone';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

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

type PartnershipContextValue = {
  partnership: Partnership | null;
  partner: Profile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  update: (fields: PartnershipUpdateFields) => Promise<void>;
};

const PartnershipContext = createContext<PartnershipContextValue | undefined>(undefined);

export function PartnershipProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [partnership, setPartnership] = useState<Partnership | null>(null);
  const [partner, setPartner] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(userId));

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

  const refresh = useCallback(async () => {
    if (!userId) {
      setPartnership(null);
      setPartner(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const next = await fetchPartnership(userId);
      setPartnership(next);
      const nextPartner = await fetchPartner(userId, next);
      setPartner(nextPartner);
    } catch {
      setPartnership(null);
      setPartner(null);
    } finally {
      setLoading(false);
    }
  }, [userId, fetchPartnership, fetchPartner]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  const value = useMemo<PartnershipContextValue>(
    () => ({ partnership, partner, loading, refresh, update }),
    [partnership, partner, loading, refresh, update],
  );

  return <PartnershipContext.Provider value={value}>{children}</PartnershipContext.Provider>;
}

export function usePartnership(): PartnershipContextValue {
  const ctx = useContext(PartnershipContext);
  if (!ctx) throw new Error('usePartnership must be used within PartnershipProvider');
  return ctx;
}
