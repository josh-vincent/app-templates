import React, { useState } from 'react';
import { View } from 'react-native';
import Toggle from './Toggle';
import ThemedText from './ThemedText';

export const meta = {
  title: 'Toggle',
  description: 'Animated switch (controlled + uncontrolled).',
  variants: ['default', 'controlled', 'disabled'],
};

export default function ToggleDemo() {
  const [on, setOn] = useState(true);
  return (
    <View className="p-global gap-4">
      <View className="flex-row items-center gap-3">
        <ThemedText>Uncontrolled</ThemedText>
        <Toggle />
      </View>
      <View className="flex-row items-center gap-3">
        <ThemedText>Controlled ({on ? 'on' : 'off'})</ThemedText>
        <Toggle value={on} onChange={setOn} />
      </View>
      <View className="flex-row items-center gap-3">
        <ThemedText>Disabled</ThemedText>
        <Toggle value disabled />
      </View>
    </View>
  );
}
