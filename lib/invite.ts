import { Share } from 'react-native';

import { supabase } from './supabase';
import type { Partnership } from '@/types/db';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const CODE_ALPHABET_SET = new Set(CODE_ALPHABET);

function generateInviteCode(): string {
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

export async function pairWithCode(currentUserId: string, rawCode: string): Promise<Partnership> {
  const code = normalizeCode(rawCode);
  if (!isCompleteCode(code)) {
    throw new Error('Enter a complete 6-character code.');
  }

  const { data: row, error: lookupError } = await supabase
    .from('partnerships')
    .select('id, user_a, user_b, invite_code, status, weekly_target, created_at')
    .eq('invite_code', code)
    .eq('status', 'pending')
    .is('user_b', null)
    .limit(1)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (!row) throw new Error('Code not found or already redeemed.');
  if (row.user_a === currentUserId) throw new Error("That's your own code.");

  const { data: updated, error: updateError } = await supabase
    .from('partnerships')
    .update({ user_b: currentUserId, status: 'active' })
    .eq('id', row.id)
    .select('id, user_a, user_b, invite_code, status, weekly_target, created_at')
    .single();

  if (updateError) throw updateError;
  if (!updated) throw new Error('Pairing failed. Try again.');
  return updated as Partnership;
}

export async function unpairPartnership(partnershipId: string): Promise<void> {
  const { error } = await supabase
    .from('partnerships')
    .update({ status: 'ended' })
    .eq('id', partnershipId);
  if (error) throw error;
}
