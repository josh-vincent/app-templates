import React from 'react';
import { View } from 'react-native';
import Icon from './Icon';
import ThemedText from './ThemedText';

export const meta = {
  title: 'Icon',
  description: 'Lucide icon with optional bordered/contained variant.',
  variants: ['plain', 'bordered', 'contained', 'sizes'],
};

export default function IconDemo() {
  return (
    <View className="p-global gap-6">
      <View className="flex-row items-center gap-3">
        <Icon name="Heart" />
        <Icon name="Heart" variant="bordered" iconSize="s" />
        <Icon name="Heart" variant="contained" iconSize="s" />
      </View>
      <View className="flex-row items-center gap-3">
        <Icon name="Bell" iconSize="xs" />
        <Icon name="Bell" iconSize="s" />
        <Icon name="Bell" iconSize="m" />
        <Icon name="Bell" iconSize="l" />
      </View>
      <ThemedText className="text-xs opacity-60">Pressable: tap the bell</ThemedText>
      <Icon name="Bell" iconSize="m" variant="contained" onPress={() => undefined} />
    </View>
  );
}
