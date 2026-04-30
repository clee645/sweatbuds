import { Redirect } from 'expo-router';
import { Drawer } from 'expo-router/drawer';

import { DrawerContent } from '@/components/drawer/DrawerContent';
import { useAuth } from '@/lib/auth';
import { colors } from '@/lib/theme';

export default function DrawerLayout() {
  const { session, loading } = useAuth();

  if (!loading && !session) {
    return <Redirect href="/sign-in" />;
  }

  return (
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
      <Drawer.Screen name="weekly-rules" options={{ title: 'Weekly Rules' }} />
      <Drawer.Screen name="wager-balance" options={{ title: 'Wager Balance' }} />
      <Drawer.Screen name="partner" options={{ title: 'Partner' }} />
      <Drawer.Screen name="history" options={{ title: 'History' }} />
      <Drawer.Screen name="settings" options={{ title: 'Settings' }} />
      <Drawer.Screen
        name="settings/widget-help"
        options={{ title: 'Widget Help', drawerItemStyle: { display: 'none' } }}
      />
      <Drawer.Screen name="support" options={{ title: 'Support' }} />
    </Drawer>
  );
}
