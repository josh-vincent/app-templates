import React, { useState } from 'react';
import { View } from 'react-native';
import Slider from './Slider';

export const meta = {
  title: 'Slider',
  description: 'Pan + tap slider with min/max/step.',
  variants: ['small', 'medium', 'large'],
};

export default function SliderDemo() {
  const [v, setV] = useState(40);
  return (
    <View className="p-global gap-6">
      <Slider label="Small" value={v} onValueChange={setV} size="s" />
      <Slider label="Medium" value={v} onValueChange={setV} size="m" />
      <Slider label="Large" value={v} onValueChange={setV} size="l" />
    </View>
  );
}
