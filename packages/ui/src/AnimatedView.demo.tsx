import React, { useState } from 'react';
import { View } from 'react-native';
import AnimatedView, { type AnimationType } from './AnimatedView';
import { Button } from './Button';
import ThemedText from './ThemedText';

export const meta = {
  title: 'AnimatedView',
  description: '10 entry animations (fadeIn / scaleIn / slideIn* / bounceIn / etc).',
  variants: ['fadeIn', 'slideInBottom', 'bounceIn', 'flipInX'],
};

const animations: AnimationType[] = ['fadeIn', 'scaleIn', 'slideInBottom', 'slideInRight', 'bounceIn', 'flipInX'];

export default function AnimatedViewDemo() {
  const [key, setKey] = useState(0);
  return (
    <View className="p-global gap-4">
      <Button title="Replay" onPress={() => setKey((k) => k + 1)} />
      <View key={key} className="gap-3">
        {animations.map((a) => (
          <AnimatedView key={a} animation={a} duration={500}>
            <View className="bg-light-secondary dark:bg-dark-secondary rounded-lg p-4">
              <ThemedText>{a}</ThemedText>
            </View>
          </AnimatedView>
        ))}
      </View>
    </View>
  );
}
