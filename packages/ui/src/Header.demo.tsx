import React from 'react';
import { View } from 'react-native';
import Header, { HeaderIcon } from './Header';

export const meta = {
  title: 'Header',
  description: 'Page header — default / transparent / blurred / collapsibleTitle.',
  variants: ['default', 'with-back', 'with-right-icons'],
};

export default function HeaderDemo() {
  return (
    <View>
      <Header title="Default" />
      <Header
        title="With back"
        showBackButton
        rightComponents={[<HeaderIcon key="bell" icon="Bell" hasBadge />, <HeaderIcon key="settings" icon="Settings" />]}
      />
    </View>
  );
}
