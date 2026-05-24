import React, { useState } from 'react';
import { View } from 'react-native';
import Counter from './Counter';
import { ThemedText } from '@jv/ui';

export const meta = {
  title: 'Counter',
  description: 'Numeric counter with +/-. undefined = "any".',
  variants: ['default'],
};

export default function CounterDemo() {
  const [n, setN] = useState<number | undefined>(undefined);
  return (
    <View className="p-global gap-3">
      <ThemedText>value = {n === undefined ? 'any' : n}</ThemedText>
      <Counter value={n} onChange={setN} />
    </View>
  );
}
