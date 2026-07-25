// Supabase Edge Function: cleanup-user-storage
// Fires from the profiles BEFORE DELETE trigger (see migration 0021) for every
// account deletion (in-app or out-of-band). Supabase does NOT auto-delete a
// user's storage objects on row deletion, so without this their selfies and
// avatar linger forever — a privacy gap and a cost leak.
//
// Removes everything under:
//   workout-images/<user_id>/**   (selfies + environment shots)
//   avatars/<user_id>/**          (profile photo)
//
// Destructive + service-role powered, so we require the caller to present the
// service role key (the trigger passes it from Vault). Anonymous callers can't
// invoke it to wipe someone else's media.
//
// Deploy with: supabase functions deploy cleanup-user-storage

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const BUCKETS = ['workout-images', 'avatars'];

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Only the trigger (holding the service role key) may invoke this.
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: { user_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }
  const userId = body.user_id;
  if (!userId) {
    return new Response('Missing user_id', { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const removed: Record<string, number> = {};

  for (const bucket of BUCKETS) {
    const paths = await listAllFiles(admin, bucket, userId);
    if (paths.length > 0) {
      await admin.storage.from(bucket).remove(paths);
    }
    removed[bucket] = paths.length;
  }

  return new Response(JSON.stringify({ ok: true, removed }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

// Recursively collect every object path under `prefix` in a bucket. Supabase's
// list() returns one level at a time; folder entries come back with id === null.
async function listAllFiles(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const out: string[] = [];
  const { data, error } = await admin.storage
    .from(bucket)
    .list(prefix, { limit: 1000 });
  if (error || !data) return out;

  for (const entry of data) {
    const path = `${prefix}/${entry.name}`;
    if (entry.id === null) {
      // Sub-folder — recurse.
      const nested = await listAllFiles(admin, bucket, path);
      out.push(...nested);
    } else {
      out.push(path);
    }
  }
  return out;
}
