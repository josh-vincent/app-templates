import { useThemeColors } from '@/contexts/ThemeColors';
import ActiveTripCompanion from 'components/ActiveTripCompanion';
import { TabButton } from 'components/TabButton';
import { Tabs, TabList, TabTrigger, TabSlot } from 'expo-router/ui';
import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Layout() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  return (
    <Tabs asChild>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TabSlot />
        <ActiveTripCompanion />
        <TabList
          style={{
            backgroundColor: colors.bg,
            borderTopColor: colors.secondary,
            borderTopWidth: 1,
            paddingBottom: insets.bottom,
          }}>
          <TabTrigger name="(home)" href="/(tabs)/(home)" asChild>
            <TabButton labelAnimated={false} icon="Search">
              Search
            </TabButton>
          </TabTrigger>

          <TabTrigger name="favorites" href="/favorites" asChild>
            <TabButton labelAnimated={false} icon="Heart">
              Tracked
            </TabButton>
          </TabTrigger>

          <TabTrigger name="trips" href="/trips" asChild>
            <TabButton labelAnimated={false} icon="Plane">
              Trips
            </TabButton>
          </TabTrigger>

          <TabTrigger name="chat" href="/(tabs)/chat" asChild>
            <TabButton labelAnimated={false} icon="Sparkles">
              Assistant
            </TabButton>
          </TabTrigger>

          <TabTrigger name="profile" href="/profile" asChild>
            <TabButton labelAnimated={false} icon="CircleUser">
              Profile
            </TabButton>
          </TabTrigger>
        </TabList>
      </View>
    </Tabs>
  );
}
