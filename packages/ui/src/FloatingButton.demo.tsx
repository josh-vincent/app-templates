import React, { useState } from 'react';
import { View } from 'react-native';
import FloatingButton from './FloatingButton';
import { Button } from './Button';

export const meta = {
  title: 'FloatingButton',
  description: 'Positioned FAB with icon + label and optional fade-in animation.',
  variants: ['static', 'animated'],
};

export default function FloatingButtonDemo() {
  const [visible, setVisible] = useState(true);
  return (
    <View className="flex-1">
      <View className="p-global">
        <Button title={visible ? 'Hide animated' : 'Show animated'} onPress={() => setVisible((v) => !v)} />
      </View>
      <FloatingButton icon="Plus" label="New" onPress={() => undefined} />
      <FloatingButton icon="Send" label="Send" isAnimated visible={visible} bottom={90} />
    </View>
  );
}
