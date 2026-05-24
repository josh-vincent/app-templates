import React, { useState } from 'react';
import { View } from 'react-native';
import TextInput from './TextInput';

export const meta = {
  title: 'TextInput',
  description: 'Animated floating-label text input.',
  variants: ['default', 'password'],
};

export default function TextInputDemo() {
  const [v, setV] = useState('');
  return (
    <View className="p-global gap-3">
      <TextInput label="Email" value={v} onChangeText={setV} />
      <TextInput label="Password" isPassword value={v} onChangeText={setV} />
    </View>
  );
}
