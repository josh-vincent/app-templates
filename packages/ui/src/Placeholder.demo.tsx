import React from 'react';
import { View } from 'react-native';
import { Placeholder } from './Placeholder';

export const meta = {
  title: 'Placeholder',
  description: 'Empty-state with icon, title, subtitle, optional CTA.',
  variants: ['default', 'with-cta'],
};

export default function PlaceholderDemo() {
  return (
    <View className="flex-1">
      <Placeholder
        icon="Inbox"
        title="Nothing here yet"
        subtitle="When you have items they will show up here."
        button="Add first item"
        href="/new"
      />
    </View>
  );
}
