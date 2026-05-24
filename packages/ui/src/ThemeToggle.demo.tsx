import React from 'react';
import { View } from 'react-native';
import ThemeToggle from './ThemeToggle';
import ThemedText from './ThemedText';

export const meta = {
  title: 'ThemeToggle',
  description: 'Sun/moon switch wired to the ThemeContext.',
  variants: ['default'],
};

export default function ThemeToggleDemo() {
  return (
    <View className="p-global gap-3">
      <ThemedText>Tap to flip theme.</ThemedText>
      <ThemeToggle />
    </View>
  );
}
