import React from 'react';
import { View } from 'react-native';
import ListLink from './ListLink';

export const meta = {
  title: 'ListLink',
  description: 'Settings/menu row with icon, description, chevron.',
  variants: ['default', 'with-description', 'with-chevron', 'bordered'],
};

export default function ListLinkDemo() {
  return (
    <View className="p-global">
      <ListLink icon="User" title="Profile" hasBorder />
      <ListLink icon="Bell" title="Notifications" description="Push, email, SMS" showChevron hasBorder />
      <ListLink icon="Lock" title="Privacy" showChevron hasBorder />
      <ListLink icon="LogOut" title="Sign out" disabled />
    </View>
  );
}
