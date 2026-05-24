import { Tabs, TabList, TabTrigger, TabSlot } from 'expo-router/ui';
import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabButton } from '@jv/ui';
import { useThemeColors } from '@jv/ui';

export default function TabsLayout() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  return (
    <Tabs asChild>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TabSlot />
        <TabList
          style={{
            backgroundColor: colors.bg,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            paddingBottom: insets.bottom,
          }}>
          <TabTrigger name="(home)" href="/(tabs)/(home)" asChild>
            <TabButton labelAnimated={false} icon="Activity">
              Today
            </TabButton>
          </TabTrigger>

          <TabTrigger name="challenges" href="/(tabs)/challenges" asChild>
            <TabButton labelAnimated={false} icon="Target">
              Bets
            </TabButton>
          </TabTrigger>

          <TabTrigger name="jackpot" href="/(tabs)/jackpot" asChild>
            <TabButton labelAnimated={false} icon="Trophy">
              Jackpot
            </TabButton>
          </TabTrigger>

          <TabTrigger name="wallet" href="/(tabs)/wallet" asChild>
            <TabButton labelAnimated={false} icon="Wallet">
              Wallet
            </TabButton>
          </TabTrigger>

          <TabTrigger name="profile" href="/(tabs)/profile" asChild>
            <TabButton labelAnimated={false} icon="CircleUser">
              Profile
            </TabButton>
          </TabTrigger>
        </TabList>
      </View>
    </Tabs>
  );
}
