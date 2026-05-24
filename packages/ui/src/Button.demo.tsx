import React from 'react';
import { View } from 'react-native';
import { Button } from './Button';

export const meta = {
  title: 'Button',
  description: 'Primary touchable with variant, size, rounded, icon, loading.',
  variants: ['primary', 'secondary', 'outline', 'ghost', 'loading', 'icon'],
};

export default function ButtonDemo() {
  return (
    <View className="p-global gap-3">
      <Button title="Primary" onPress={() => undefined} />
      <Button title="Secondary" variant="secondary" onPress={() => undefined} />
      <Button title="Outline" variant="outline" onPress={() => undefined} />
      <Button title="Ghost" variant="ghost" onPress={() => undefined} />
      <Button title="Loading" loading />
      <Button title="With icon" iconStart="ArrowRight" onPress={() => undefined} />
      <Button title="Small" size="small" onPress={() => undefined} />
      <Button title="Large" size="large" onPress={() => undefined} />
    </View>
  );
}
