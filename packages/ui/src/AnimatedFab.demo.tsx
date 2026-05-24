import React from 'react';
import { View } from 'react-native';
import AnimatedFab from './AnimatedFab';
import ThemedText from './ThemedText';

export const meta = {
  title: 'AnimatedFab',
  description: 'FAB that morphs from circle to a full-width panel.',
  variants: ['bottomRight'],
};

export default function AnimatedFabDemo() {
  return (
    <View className="flex-1">
      <AnimatedFab icon="Plus">
        <ThemedText className="text-white text-lg font-bold">Expanded content</ThemedText>
        <ThemedText className="text-white opacity-70 mt-2">
          Any children render here when open. Tap the X or icon to close.
        </ThemedText>
      </AnimatedFab>
    </View>
  );
}
