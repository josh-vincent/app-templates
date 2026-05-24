import React, { useState } from 'react';
import { View } from 'react-native';
import Switch from './Switch';

export const meta = {
  title: 'Switch',
  description: 'Labeled row switch with optional description + icon.',
  variants: ['default'],
};

export default function SwitchDemo() {
  const [on, setOn] = useState(true);
  return (
    <View className="p-global gap-2">
      <Switch label="Notifications" description="Push, email, SMS" icon="Bell" value={on} onChange={setOn} />
      <Switch label="Disabled" description="Can't tap me" disabled />
    </View>
  );
}
