import { useEffect, useRef } from 'react';

import { uploadAvatar } from '@/lib/avatar';
import { useAuth } from '@/lib/auth';
import {
  clearPendingDisplayName,
  clearPendingPhotoUri,
  getPendingDisplayName,
  getPendingPhotoUri,
} from '@/lib/onboarding';
import { markProfileReady } from '@/lib/profileReady';
import { supabase } from '@/lib/supabase';

// Applies the display name + profile photo collected during onboarding (stashed
// in AsyncStorage before sign-in) to the user's profile once they authenticate.
// Renders nothing; runs once per mount.
//
// Brand-new users only: onboarding's name/photo are meant to OVERRIDE the
// avatar/name that handle_new_user seeds from Google/Apple OAuth metadata, but
// only for a freshly-created account. A returning user who re-runs onboarding
// (e.g. after a reinstall) must not have their established profile clobbered —
// so we gate on how recently the auth account was created and otherwise just
// clear the pending values without applying them.
const NEW_ACCOUNT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export function PendingProfileSetup() {
  const { user, refreshProfile } = useAuth();
  const attempted = useRef(false);

  useEffect(() => {
    const userId = user?.id;
    if (!userId || attempted.current) return;
    attempted.current = true;

    let cancelled = false;
    (async () => {
      // Phase 1 — the name, on its own write. PendingInvitePairer blocks on the
      // barrier below, so everything in here is on the critical path and must
      // stay fast: a single update, no uploads.
      let photoUri: string | null = null;
      try {
        const [name, pendingPhoto] = await Promise.all([
          getPendingDisplayName(),
          getPendingPhotoUri(),
        ]);
        if (cancelled) return;
        photoUri = pendingPhoto;
        if (!name && !photoUri) return;

        // Only a freshly-created account should have its OAuth-seeded name/avatar
        // overridden. For anyone else, drop the pending values so they can't be
        // applied on a later sign-in.
        const createdAt = user?.created_at ? new Date(user.created_at).getTime() : 0;
        const isBrandNew =
          createdAt > 0 && Date.now() - createdAt < NEW_ACCOUNT_WINDOW_MS;
        if (!isBrandNew) {
          photoUri = null;
          await clearPendingDisplayName();
          await clearPendingPhotoUri();
          return;
        }

        if (name) {
          const { error } = await supabase
            .from('profiles')
            .update({ display_name: name })
            .eq('id', userId);
          // On error the pending name stays put so a later mount retries.
          if (!error) {
            await clearPendingDisplayName();
            if (!cancelled) await refreshProfile().catch(() => undefined);
          }
        }
      } finally {
        // However phase 1 ended — nothing to apply, wrong account, failed
        // write, unmount — pairing must not keep waiting on us.
        markProfileReady(userId);
      }

      // Phase 2 — the photo. Resize + upload + a second write, deliberately
      // after the barrier so a slow connection can't hold up pairing.
      if (cancelled || !photoUri) return;

      let avatarUrl: string;
      try {
        avatarUrl = await uploadAvatar(photoUri, userId);
      } catch {
        // Upload failed (e.g. transient network / stale cache URI). Leave the
        // photo pending so the next launch can retry.
        return;
      }
      if (cancelled) return;

      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', userId);
      if (cancelled || error) return;

      await clearPendingPhotoUri();
      await refreshProfile().catch(() => undefined);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.created_at, refreshProfile]);

  return null;
}
