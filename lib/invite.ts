import { Share } from 'react-native';

import { supabase } from './supabase';
import type { Partnership } from '@/types/db';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const CODE_ALPHABET_SET = new Set(CODE_ALPHABET);

export function generateInviteCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export function formatCode(code: string): string {
  if (code.length <= 2) return code;
  return `${code.slice(0, 2)}-${code.slice(2)}`;
}

export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
}

export function isCompleteCode(raw: string): boolean {
  const norm = normalizeCode(raw);
  if (norm.length !== CODE_LENGTH) return false;
  for (const ch of norm) if (!CODE_ALPHABET_SET.has(ch)) return false;
  return true;
}

export async function getOrCreateInviteCode(userId: string): Promise<string> {
  const { data: existing } = await supabase
    .from('partnerships')
    .select('invite_code')
    .eq('user_a', userId)
    .is('user_b', null)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle();

  if (existing?.invite_code) return existing.invite_code as string;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    const { data, error } = await supabase
      .from('partnerships')
      .insert({ user_a: userId, invite_code: code })
      .select('invite_code')
      .single();
    if (!error && data?.invite_code) return data.invite_code as string;
    if (error && error.code !== '23505') throw error;
  }
  throw new Error('Could not generate a unique invite code. Try again.');
}

export async function sharePartnerInvite(userId: string): Promise<void> {
  const code = await getOrCreateInviteCode(userId);
  const message = `Join me on Sweatbuds! Use my invite code: ${formatCode(code)}`;
  await Share.share({ message });
}

// Redemption goes through a SECURITY DEFINER RPC because the partnerships
// SELECT/UPDATE RLS policies require the caller to already be a member —
// which the joining user isn't yet. The function does the lookup, validation,
// and update atomically. See supabase/migrations/0010_redeem_invite_rpc.sql.
export async function pairWithCode(rawCode: string): Promise<Partnership> {
  const code = normalizeCode(rawCode);
  if (!isCompleteCode(code)) {
    throw new Error('Enter a complete 6-character code.');
  }

  const { data, error } = await supabase.rpc('redeem_invite_code', { code });
  if (error) {
    if (error.code === 'P0001') {
      throw new Error("You're already paired. Leave your current team to join a new one.");
    }
    if (error.code === 'P0002') {
      throw new Error("That's your own code.");
    }
    if (error.code === 'P0003') {
      throw new Error('Code not found or already redeemed.');
    }
    if (error.code === 'P0004') {
      throw new Error(
        'A subscription is required to pair. Subscribe to unlock Sweatbuds for both of you.',
      );
    }
    throw error;
  }
  if (!data) throw new Error('Pairing failed. Try again.');
  return data as Partnership;
}

export async function unpairPartnership(partnershipId: string): Promise<void> {
  const { error } = await supabase
    .from('partnerships')
    .update({ status: 'ended' })
    .eq('id', partnershipId);
  if (error) throw error;
}
