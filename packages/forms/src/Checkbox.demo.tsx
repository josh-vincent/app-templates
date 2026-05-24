import React, { useState } from 'react';
import { View } from 'react-native';
import Checkbox from './Checkbox';

export const meta = {
  title: 'Checkbox',
  description: 'Labeled checkbox with optional error.',
  variants: ['default', 'error'],
};

export default function CheckboxDemo() {
  const [a, setA] = useState(false);
  const [b, setB] = useState(true);
  return (
    <View className="p-global">
      <Checkbox label="Agree to terms" checked={a} onChange={setA} />
      <Checkbox label="Subscribe to newsletter" checked={b} onChange={setB} />
      <Checkbox label="Required" error="This field is required" />
    </View>
  );
}
