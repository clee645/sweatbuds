import { Redirect } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { StyleSheet, View } from 'react-native';

import { BrandedSplash } from '@/components/BrandedSplash';
import { DrawerContent } from '@/components/drawer/DrawerContent';
import { useAuth } from '@/lib/auth';
import { useOnboardingSeen, usePaywallSeen } from '@/lib/onboarding';
import { colors } from '@/lib/theme';
import { useAccessGate } from '@/lib/useAccessGate';

export default function DrawerLayout() {
  const { session, loading } = useAuth();
  const { seen } = useOnboardingSeen();
  const { seen: paywallSeen } = usePaywallSeen();
  const { unlocked, loading: gateLoading } = useAccessGate();

  if (!loading && !session) {
    // First-launch users see onboarding before sign-in; everyone else goes
    // straight to sign-in. Hold on the splash while the flag is loading.
    if (seen === null) {
      return <BrandedSplash />;
    }
    return <Redirect href={seen ? '/sign-in' : '/onboarding/welcome'} />;
  }

  // Show the intro funnel once to brand-new, not-yet-subscribed users. This only
  // fires before the user has navigated anywhere (paywallSeen === false), so
  // redirecting away loses no in-drawer navigation state. Wait out the gate
  // first (below) so a genuinely-unlocked user is never sent to the funnel.
  if (session && !gateLoading && paywallSeen === false && !unlocked) {
    return <Redirect href="/onboarding/paywall-intro" />;
  }

  // Hold the branded splash while the paywall flag or the subscription/
  // partnership gate is still resolving — prevents a paid reinstaller (unlocked
  // via the profiles.is_pro bridge) from flashing the funnel before RC
  // re-confirms. Render it as an OVERLAY on top of the Drawer, never in place of
  // it: swapping the navigator out unmounts it and throws away its navigation
  // state, which used to snap any open detail screen (wager balance, weekly
  // rules) straight back to home on a transient gate-loading blip.
  const holdSplash = Boolean(session) && (paywallSeen === null || gateLoading);

  return (
    <View style={styles.root}>
      <Drawer
        drawerContent={(props) => <DrawerContent {...props} />}
        screenOptions={{
          headerShown: false,
          drawerType: 'front',
          drawerStyle: {
            backgroundColor: colors.bg,
            width: 320,
            borderRightWidth: 0,
          },
          sceneStyle: { backgroundColor: colors.bg },
          overlayColor: 'rgba(0,0,0,0.6)',
        }}
      >
        <Drawer.Screen name="index" options={{ title: 'Home' }} />
        <Drawer.Screen name="weekly-rules" options={{ title: 'Weekly Wager' }} />
        <Drawer.Screen name="wager-balance" options={{ title: 'Wager Balance' }} />
        <Drawer.Screen name="partner" options={{ title: 'Partner' }} />
        <Drawer.Screen name="history" options={{ title: 'History' }} />
        <Drawer.Screen name="settings" options={{ title: 'Settings' }} />
        <Drawer.Screen
          name="settings/widget-help"
          options={{ title: 'Widget Help', drawerItemStyle: { display: 'none' } }}
        />
        <Drawer.Screen
          name="settings/location-reminders"
          options={{ title: 'Location Reminders', drawerItemStyle: { display: 'none' } }}
        />
      </Drawer>
      {holdSplash ? (
        <View style={StyleSheet.absoluteFill}>
          <BrandedSplash />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
