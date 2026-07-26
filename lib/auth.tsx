import {
  GoogleSignin,
  statusCodes,
  isErrorWithCode,
} from '@react-native-google-signin/google-signin';
import type { Session, User } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { registerPushToken, unregisterPushToken } from './notifications';
import {
  configureRevenueCat,
  identifyRevenueCatUser,
  resetRevenueCatUser,
} from './revenuecat';
import { supabase } from './supabase';
import { clearWidget } from './widget';
import type { Profile } from '@/types/db';

const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

GoogleSignin.configure({
  iosClientId: IOS_CLIENT_ID,
  webClientId: WEB_CLIENT_ID,
});

// Configure RevenueCat as early as possible so anonymous users still get
// offerings; we link to the Supabase user via logIn once a session exists.
configureRevenueCat();

type SignInOptions = {
  // When true, reject a login whose account never finished onboarding (used by
  // the bare sign-in screen, which is for already-registered users only).
  requireExisting?: boolean;
  // When true, mark the account as having finished onboarding (used by the final
  // onboarding step, which IS the real sign-up).
  markCompleted?: boolean;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signInWithGoogle: (opts?: SignInOptions) => Promise<void>;
  signInWithApple: (opts?: SignInOptions) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

// Thrown by the sign-in methods (in `requireExisting` mode) when the account
// never finished onboarding. OAuth sign-in always *creates* an auth user (and a
// profile row via the handle_new_user trigger), so account existence alone can't
// tell a registered user apart from someone who merely tapped "Continue with
// Google" once. We surface this so the sign-in screen can send them into
// onboarding instead of dropping them on a blank, half-created account.
export class NoAccountError extends Error {
  constructor() {
    super('No account found for this login.');
    this.name = 'NoAccountError';
  }
}

// Reads the server-side onboarding flag. Only returns false when we positively
// read `onboarding_completed = false`; any error (offline, column not migrated
// yet) or missing row fails OPEN so we never lock out a legitimate returning
// user over a transient blip.
async function hasCompletedOnboarding(userId: string | undefined): Promise<boolean> {
  if (!userId) return true;
  const { data, error } = await supabase
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return true;
  return (data as { onboarding_completed?: boolean }).onboarding_completed === true;
}

// Undo an account that OAuth just created for an un-onboarded login: detach any
// RevenueCat identity and clear the session so the app never renders for it.
async function rejectNewAccount(): Promise<void> {
  await resetRevenueCatUser().catch(() => undefined);
  await supabase.auth.signOut();
}

const PROFILE_COLUMNS = 'id, display_name, avatar_url, created_at, timezone, timezone_set_by_user, is_pro';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const cached = data.session;
      // getSession() only reads local storage, so a user deleted or banned
      // out-of-band (e.g. from the dashboard) still looks signed in and lands on
      // a stale "ghost" home. getUser() makes a network round-trip GoTrue rejects
      // (401/403) when the user no longer exists — bounce them to sign-in. Any
      // other error (offline / transient / 5xx) keeps the cached session so we
      // never sign out a valid user who simply has no connection.
      if (cached) {
        const { error } = await supabase.auth.getUser();
        if (error && (error.status === 401 || error.status === 403)) {
          await supabase.auth.signOut();
          setSession(null);
          setLoading(false);
          return;
        }
      }
      setSession(cached);
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const userId = session?.user?.id;
    if (!userId) {
      setProfile(null);
      return;
    }
    supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        // Only clear on a definitive "no row" answer. On a network error keep
        // the last-known profile so the profile.is_pro access bridge survives
        // going offline.
        if (error) {
          if (__DEV__) console.warn('[auth] profile fetch failed', error);
          return;
        }
        setProfile((data as Profile | null) ?? null);
      });
    void registerPushToken(userId).catch(() => {
      // Permission denied or simulator — leave it; widget falls back to foreground poll.
    });
    void identifyRevenueCatUser(userId);
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const refreshProfile = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) return;
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .maybeSingle();
    // See above: don't discard a good profile because the network failed.
    if (error) {
      if (__DEV__) console.warn('[auth] profile refresh failed', error);
      return;
    }
    setProfile((data as Profile | null) ?? null);
  }, [session?.user?.id]);

  const signInWithGoogle = useCallback(async (opts?: SignInOptions) => {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    try {
      // @react-native-google-signin v16 does not expose a nonce parameter,
      // so the ID token Supabase receives has no client-supplied nonce.
      // Supabase's Google provider must have "Skip nonce checks" enabled
      // for native sign-in to succeed.
      const result = await GoogleSignin.signIn();
      const idToken = result.data?.idToken;
      if (!idToken) {
        throw new Error('Google did not return an ID token');
      }
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
      if (error) throw error;
      if (opts?.requireExisting && !(await hasCompletedOnboarding(data.user?.id))) {
        await rejectNewAccount();
        throw new NoAccountError();
      }
      if (opts?.markCompleted && data.user) {
        await supabase
          .from('profiles')
          .update({ onboarding_completed: true })
          .eq('id', data.user.id);
      }
    } catch (e) {
      if (
        isErrorWithCode(e) &&
        (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS)
      ) {
        return;
      }
      throw e;
    }
  }, []);

  const signInWithApple = useCallback(async (opts?: SignInOptions) => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const token = credential.identityToken;
      if (!token) {
        throw new Error('Apple did not return an identity token');
      }
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token,
      });
      if (error) throw error;
      if (opts?.requireExisting && !(await hasCompletedOnboarding(data.user?.id))) {
        await rejectNewAccount();
        throw new NoAccountError();
      }
      if (opts?.markCompleted && data.user) {
        await supabase
          .from('profiles')
          .update({ onboarding_completed: true })
          .eq('id', data.user.id);
      }
    } catch (e) {
      // User dismissed the Apple sheet — not an error worth surfacing.
      if (
        e &&
        typeof e === 'object' &&
        'code' in e &&
        (e as { code?: string }).code === 'ERR_REQUEST_CANCELED'
      ) {
        return;
      }
      throw e;
    }
  }, []);

  const signOut = useCallback(async () => {
    const userId = session?.user?.id;
    try {
      await GoogleSignin.signOut();
    } catch {
      // ignore — we still want to clear the supabase session
    }
    if (userId) {
      await unregisterPushToken(userId).catch(() => undefined);
    }
    await clearWidget();
    await resetRevenueCatUser();
    await supabase.auth.signOut();
  }, [session?.user?.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      signInWithGoogle,
      signInWithApple,
      signOut,
      refreshProfile,
    }),
    [session, profile, loading, signInWithGoogle, signInWithApple, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
