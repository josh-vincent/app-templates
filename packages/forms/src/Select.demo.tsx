import React, { useState } from 'react';
import { View } from 'react-native';
import Select from './Select';

export const meta = {
  title: 'Select',
  description: 'Dropdown rendered as a themed bottom sheet.',
  variants: ['animated', 'classic', 'underlined'],
};

const options = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Cherry', value: 'cherry' },
];

export default function SelectDemo() {
  const [v, setV] = useState<string | number | undefined>(undefined);
  return (
    <View className="p-global gap-3">
      <Select label="Fruit" options={options} value={v} onChange={setV} />
      <Select label="Classic" variant="classic" options={options} value={v} onChange={setV} />
      <Select label="Underlined" variant="underlined" options={options} value={v} onChange={setV} />
    </View>
  );
}
