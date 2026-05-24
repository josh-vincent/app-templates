import { Tabs, TabList, TabSlot, TabTrigger } from 'expo-router/ui';
import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabButton } from '@/components/TabButton';
import { useThemeColors } from '@/contexts/ThemeColors';

// LuckyChips tab bar — five top-level surfaces for the play-money demo.
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
          <TabTrigger name="home" href="/(tabs)/home" asChild>
            <TabButton icon="Home">Home</TabButton>
          </TabTrigger>

          <TabTrigger name="slots" href="/(tabs)/slots" asChild>
            <TabButton icon="Dice5">Slots</TabButton>
          </TabTrigger>

          <TabTrigger name="blackjack" href="/(tabs)/blackjack" asChild>
            <TabButton icon="Spade">Blackjack</TabButton>
          </TabTrigger>

          <TabTrigger name="history" href="/(tabs)/history" asChild>
            <TabButton icon="History">History</TabButton>
          </TabTrigger>

          <TabTrigger name="profile" href="/(tabs)/profile" asChild>
            <TabButton icon="CircleUser">Profile</TabButton>
          </TabTrigger>
        </TabList>
      </View>
    </Tabs>
  );
}
