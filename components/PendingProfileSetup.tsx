import { useEffect, useRef } from 'react';

import { uploadAvatar } from '@/lib/avatar';
import { useAuth } from '@/lib/auth';
import {
  clearPendingDisplayName,
  clearPendingPhotoUri,
  getPendingDisplayName,
  getPendingPhotoUri,
} from '@/lib/onboarding';
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
      const [name, photoUri] = await Promise.all([
        getPendingDisplayName(),
        getPendingPhotoUri(),
      ]);
      if (cancelled) return;
      if (!name && !photoUri) return;

      // Only a freshly-created account should have its OAuth-seeded name/avatar
      // overridden. For anyone else, drop the pending values so they can't be
      // applied on a later sign-in.
      const createdAt = user?.created_at ? new Date(user.created_at).getTime() : 0;
      const isBrandNew =
        createdAt > 0 && Date.now() - createdAt < NEW_ACCOUNT_WINDOW_MS;
      if (!isBrandNew) {
        await clearPendingDisplayName();
        await clearPendingPhotoUri();
        return;
      }

      const updates: { display_name?: string; avatar_url?: string } = {};
      if (name) updates.display_name = name;
      if (photoUri) {
        try {
          updates.avatar_url = await uploadAvatar(photoUri, userId);
        } catch {
          // Upload failed (e.g. transient network / stale cache URI). Leave the
          // photo pending so the next launch can retry; still apply the name.
        }
      }
      if (cancelled || Object.keys(updates).length === 0) return;

      const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
      if (cancelled || error) {
        // Leave the pending values in place so a later mount retries.
        return;
      }

      // Clear only what we actually persisted — if the photo upload failed
      // above, its key stays for retry while the applied name is cleared.
      if (updates.display_name !== undefined) await clearPendingDisplayName();
      if (updates.avatar_url !== undefined) await clearPendingPhotoUri();
      await refreshProfile().catch(() => undefined);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.created_at, refreshProfile]);

  return null;
}
