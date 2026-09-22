// Supabase Edge Function: notify-inactivity
// Fired hourly by pg_cron (see migration 0030). Finds couples where neither
// partner has posted in 4 / 7 / 14 days and sends the matching reminder to
// BOTH partners — once per stage per quiet stretch, and only during the
// couple's local daytime window. Thresholds, copy and the window live in
// ../_shared/inactivity.ts.
//
// Deploy with: supabase functions deploy notify-inactivity
//
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY are auto-injected.
// Set EXPO_ACCESS_TOKEN as a function secret if you want enhanced rate limits.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import {
  dueInactivityNudge,
  isWithinSendWindow,
  MIN_INACTIVE_DAYS,
} from '../_shared/inactivity.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type CandidateRow = {
  partnership_id: string;
  user_a: string;
  user_b: string;
  timezone: string | null;
  last_activity_at: string;
  nudged_stage: number | null;
  nudged_anchor_at: string | null;
};
type DeviceTokenRow = { user_id: string; token: string };

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Only the cron job (holding the service role key) may invoke this.
  if (req.headers.get('Authorization') !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date();
  const idleBefore = new Date(now.getTime() - MIN_INACTIVE_DAYS * 86_400_000);

  const { data: candidatesRaw, error } = await admin.rpc('inactive_partnerships', {
    idle_before: idleBefore.toISOString(),
  });
  if (error) {
    console.error('inactive_partnerships failed:', error);
    return jsonResponse({ ok: false, reason: 'query_failed' }, 500);
  }
  const candidates = (candidatesRaw ?? []) as CandidateRow[];

  const sent: { partnership_id: string; stage: number; result: unknown }[] = [];

  for (const c of candidates) {
    const nudge = dueInactivityNudge({
      lastActivityAt: c.last_activity_at,
      now,
      nudgedStage: c.nudged_stage,
      nudgedAnchorAt: c.nudged_anchor_at,
    });
    if (!nudge) continue;
    if (!isWithinSendWindow(now, c.timezone)) continue;

    // Claim before sending: a lost race means another run already pushed it.
    const { data: claimed, error: claimErr } = await admin.rpc('claim_inactivity_nudge', {
      p_partnership_id: c.partnership_id,
      p_stage: nudge.stage,
      p_anchor_at: c.last_activity_at,
    });
    if (claimErr) {
      console.error('claim_inactivity_nudge failed:', c.partnership_id, claimErr);
      continue;
    }
    if (!claimed) continue;

    const { data: tokensRaw } = await admin
      .from('device_tokens')
      .select('user_id, token')
      .in('user_id', [c.user_a, c.user_b]);
    const tokens = ((tokensRaw ?? []) as DeviceTokenRow[]).filter((t) => t.token);
    if (tokens.length === 0) continue;

    const messages = tokens.map((t) => ({
      to: t.token,
      title: nudge.title,
      body: nudge.body,
      sound: 'default',
      data: { type: 'partners_inactive', stage: nudge.stage },
    }));

    const result = await sendExpoPush(messages);
    sent.push({ partnership_id: c.partnership_id, stage: nudge.stage, result });
  }

  return jsonResponse({ ok: true, candidates: candidates.length, sent });
});

async function sendExpoPush(payload: unknown): Promise<unknown> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Accept-encoding': 'gzip, deflate',
  };
  if (EXPO_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${EXPO_ACCESS_TOKEN}`;
  }
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { status: res.status, body: text };
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
