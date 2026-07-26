import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '@/lib/location/geofence-task';
import '@/lib/notifications-background';

import { BrandedSplash } from '@/components/BrandedSplash';
import { GeofenceSync } from '@/components/location/GeofenceSync';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PartnerJoinedToast } from '@/components/pairing/PartnerJoinedToast';
import { PartnerLeftToast } from '@/components/pairing/PartnerLeftToast';
import { PendingInvitePairer } from '@/components/PendingInvitePairer';
import { PendingInviteRegistrar } from '@/components/PendingInviteRegistrar';
import { PendingProfileSetup } from '@/components/PendingProfileSetup';
import { TimezoneSeeder } from '@/components/TimezoneSeeder';
import { WagerSettlementRunner } from '@/components/WagerSettlementRunner';
import { WidgetSync } from '@/components/WidgetSync';
import { WorkoutsRealtime } from '@/components/WorkoutsRealtime';
import { AuthProvider, useAuth } from '@/lib/auth';
import { WorkoutCommentsProvider } from '@/lib/comments';
import { ConnectivityProvider } from '@/lib/connectivity';
import { CommentViewsProvider } from '@/lib/commentViews';
import { HistoryProvider } from '@/lib/history';
import { PartnershipProvider, usePartnership } from '@/lib/partnership';
import { SubscriptionProvider } from '@/lib/subscription';
import { colors } from '@/lib/theme';
import { WorkoutsProvider } from '@/lib/workouts';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  useEffect(() => {
    if (__DEV__) return;
    (async () => {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) {
          await Updates.fetchUpdateAsync();
        }
      } catch {
        // Silent — offline or server hiccup; retry on next launch.
      }
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <StatusBar style="light" />
          {/* Outermost so every provider below can consult connectivity when
              deciding whether a failed fetch means "no data" or "no network". */}
          <ConnectivityProvider>
            <AuthProvider>
              <SubscriptionProvider>
                <PartnershipProvider>
                  <WorkoutsProvider>
                    <HistoryProvider>
                      <WorkoutCommentsProvider>
                        <CommentViewsProvider>
                          <WidgetSync />
                          <WorkoutsRealtime />
                          <GeofenceSync />
                          <WagerSettlementRunner />
                          <PendingInvitePairer />
                          <PendingInviteRegistrar />
                          <PendingProfileSetup />
                          <TimezoneSeeder />
                          <AuthGate />
                          <PartnerJoinedToastHost />
                          <PartnerLeftToastHost />
                          <OfflineBanner />
                        </CommentViewsProvider>
                      </WorkoutCommentsProvider>
                    </HistoryProvider>
                  </WorkoutsProvider>
                </PartnershipProvider>
              </SubscriptionProvider>
            </AuthProvider>
          </ConnectivityProvider>
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AuthGate() {
  const { loading } = useAuth();

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  if (loading) {
    return <BrandedSplash />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="(drawer)" />
      <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      <Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
      <Stack.Screen name="wager-info" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen
        name="log-workout"
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="join-confirm"
        options={{ presentation: 'fullScreenModal', animation: 'fade' }}
      />
      <Stack.Screen
        name="pairing-celebration"
        options={{ presentation: 'fullScreenModal', animation: 'fade' }}
      />
      <Stack.Screen
        name="photo/[id]"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="history/day/[date]"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="share-sweatcam/[id]"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="request-feature"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
    </Stack>
  );
}

// Renders the lightweight in-app toast for live (non-cold-start) pair events.
// The cold-start celebration is handled by the home screen routing to the
// full-screen pairing-celebration modal, so we skip it here.
function PartnerJoinedToastHost() {
  const { freshlyPaired, consumeFreshlyPaired } = usePartnership();

  if (!freshlyPaired || freshlyPaired.viaColdStart) return null;
  if (AppState.currentState !== 'active') return null;

  return (
    <PartnerJoinedToast
      key={freshlyPaired.partnershipId}
      partnerName={freshlyPaired.partnerName}
      onHidden={consumeFreshlyPaired}
    />
  );
}

// Renders the survivor heads-up when an active partnership ends.
function PartnerLeftToastHost() {
  const { freshlyEnded, consumeFreshlyEnded } = usePartnership();

  if (!freshlyEnded) return null;
  if (AppState.currentState !== 'active') return null;

  return (
    <PartnerLeftToast key={freshlyEnded.partnershipId} onHidden={consumeFreshlyEnded} />
  );
}
