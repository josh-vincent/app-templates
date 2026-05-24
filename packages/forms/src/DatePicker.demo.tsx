import React, { useState } from 'react';
import { View } from 'react-native';
import DatePicker from './DatePicker';

export const meta = {
  title: 'DatePicker',
  description: 'Themed date picker (iOS modal sheet, Android native).',
  variants: ['animated', 'classic', 'underlined'],
};

export default function DatePickerDemo() {
  const [d, setD] = useState<Date | undefined>(undefined);
  return (
    <View className="p-global gap-3">
      <DatePicker label="Animated" value={d} onChange={setD} />
      <DatePicker label="Classic" variant="classic" value={d} onChange={setD} />
      <DatePicker label="Underlined" variant="underlined" value={d} onChange={setD} />
    </View>
  );
}
