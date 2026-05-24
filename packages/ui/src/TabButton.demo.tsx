import React from 'react';
import { View } from 'react-native';
import { TabButton } from './TabButton';

export const meta = {
  title: 'TabButton',
  description: 'Tab trigger slot for expo-router/ui (icon/avatar/badge).',
  variants: ['focused', 'unfocused', 'badge'],
};

const stub = { onPress: () => undefined, accessibilityState: { selected: false } };

export default function TabButtonDemo() {
  return (
    <View className="flex-row p-global gap-3 bg-light-primary dark:bg-dark-primary">
      <TabButton icon="Home" isFocused {...(stub as any)}>
        Home
      </TabButton>
      <TabButton icon="Bell" isFocused={false} hasBadge {...(stub as any)}>
        Alerts
      </TabButton>
      <TabButton icon="User" isFocused={false} {...(stub as any)}>
        Profile
      </TabButton>
    </View>
  );
}
