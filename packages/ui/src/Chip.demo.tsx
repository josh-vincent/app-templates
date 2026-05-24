import React from 'react';
import { View } from 'react-native';
import { Chip } from './Chip';

export const meta = {
  title: 'Chip',
  description: 'Pill with label, optional icon/image, selectable + link variants.',
  variants: ['default', 'selected', 'with-icon', 'selectable'],
};

export default function ChipDemo() {
  return (
    <View className="p-global gap-3 flex-row flex-wrap">
      <Chip label="Default" />
      <Chip label="Selected" isSelected />
      <Chip label="With icon" icon="Heart" />
      <Chip label="Selectable" selectable />
      <Chip label="Small" size="sm" />
      <Chip label="Large" size="lg" />
    </View>
  );
}
