import React, { useState } from 'react';
import { View } from 'react-native';
import Input from './Input';

export const meta = {
  title: 'Input',
  description: 'Text input — animated / classic / underlined / password / error.',
  variants: ['animated', 'classic', 'underlined', 'password', 'error'],
};

export default function InputDemo() {
  const [v, setV] = useState('');
  return (
    <View className="p-global gap-3">
      <Input label="Animated" value={v} onChangeText={setV} />
      <Input label="Classic" variant="classic" value={v} onChangeText={setV} />
      <Input label="Underlined" variant="underlined" value={v} onChangeText={setV} />
      <Input label="Password" isPassword value={v} onChangeText={setV} />
      <Input label="With error" error="That field is required" value={v} onChangeText={setV} />
    </View>
  );
}
