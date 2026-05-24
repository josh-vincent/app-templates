import React, { useState } from 'react';
import { View } from 'react-native';
import { ErrorBoundary } from './ErrorBoundary';
import { Button } from './Button';
import ThemedText from './ThemedText';

export const meta = {
  title: 'ErrorBoundary',
  description: 'Root-level catch with recoverable error card.',
  variants: ['triggered'],
};

function Bomb({ explode }: { explode: boolean }) {
  if (explode) throw new Error('Demo error: clicked the button.');
  return <ThemedText>Click the button to throw an error.</ThemedText>;
}

export default function ErrorBoundaryDemo() {
  const [boom, setBoom] = useState(false);
  return (
    <ErrorBoundary>
      <View className="p-global gap-4">
        <Bomb explode={boom} />
        <Button title="Throw" onPress={() => setBoom(true)} />
      </View>
    </ErrorBoundary>
  );
}
