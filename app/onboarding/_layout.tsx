import { Stack } from 'expo-router';

import { colors } from '@/lib/theme';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
      <Stack.Screen name="consistency" />
      <Stack.Screen name="weekly-goal" />
      <Stack.Screen name="weekly-wager" />
      <Stack.Screen name="show-up" />
      <Stack.Screen name="stay-strong" />
      <Stack.Screen name="invite-code" />
      <Stack.Screen name="weekly-plan" />
      <Stack.Screen name="wager-rules" />
      <Stack.Screen name="wager-select" />
      <Stack.Screen name="name" />
      <Stack.Screen name="profile-pic" />
      <Stack.Screen name="sign-commitment" />
      <Stack.Screen name="celebration" options={{ animation: 'fade' }} />
      <Stack.Screen name="invite-partner" />
      <Stack.Screen name="one-small-favor" />
      <Stack.Screen name="save-progress" />
      <Stack.Screen name="paywall-intro" />
      <Stack.Screen name="paywall-reminder" />
      <Stack.Screen name="paywall" />
      <Stack.Screen name="paywall-success" options={{ animation: 'fade' }} />
    </Stack>
  );
}
