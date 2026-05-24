import React from 'react';
import { View } from 'react-native';
import FormTabs, { FormTab } from './FormTabs';

export const meta = {
  title: 'FormTabs',
  description: 'Segmented pill switcher.',
  variants: ['default'],
};

export default function FormTabsDemo() {
  return (
    <View className="p-global">
      <FormTabs>
        <FormTab title="One" />
        <FormTab title="Two" />
        <FormTab title="Three" />
      </FormTabs>
    </View>
  );
}
