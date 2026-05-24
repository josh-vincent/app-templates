import React, { useState } from 'react';
import { View } from 'react-native';
import TimePicker from './TimePicker';

export const meta = {
  title: 'TimePicker',
  description: 'Themed time picker (iOS modal sheet, Android native).',
  variants: ['animated', 'classic', 'underlined'],
};

export default function TimePickerDemo() {
  const [t, setT] = useState<Date | undefined>(undefined);
  return (
    <View className="p-global gap-3">
      <TimePicker label="Animated" value={t} onChange={setT} />
      <TimePicker label="Classic" variant="classic" value={t} onChange={setT} />
      <TimePicker label="Underlined" variant="underlined" value={t} onChange={setT} />
    </View>
  );
}
