import { Tabs, TabList, TabTrigger, TabSlot } from 'expo-router/ui';
import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabButton } from '@/components/TabButton';
import { useThemeColors } from '@/contexts/ThemeColors';

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

          <TabTrigger name="workouts" href="/(tabs)/workouts" asChild>
            <TabButton labelAnimated={false} icon="Dumbbell">
              Workouts
            </TabButton>
          </TabTrigger>

          <TabTrigger name="add" href="/(tabs)/add" asChild>
            <TabButton labelAnimated={false} icon="Plus">
              Add
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
