import React from 'react';
import { View } from 'react-native';
import ThemedText from './ThemedText';

export const meta = {
  title: 'ThemedText',
  description: 'Text that flips color with the active theme.',
  variants: ['default', 'large', 'muted'],
};

export default function ThemedTextDemo() {
  return (
    <View className="p-global gap-3">
      <ThemedText>Default body text</ThemedText>
      <ThemedText className="text-2xl font-bold">Large bold heading</ThemedText>
      <ThemedText className="text-sm opacity-60">Muted helper text</ThemedText>
    </View>
  );
}
