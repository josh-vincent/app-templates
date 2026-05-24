import React from 'react';
import { View } from 'react-native';
import Avatar from './Avatar';

export const meta = {
  title: 'Avatar',
  description: 'Circular avatar with image, initials fallback, optional border.',
  variants: ['sizes', 'initials', 'image', 'bordered'],
};

export default function AvatarDemo() {
  return (
    <View className="p-global gap-4">
      <View className="flex-row items-center gap-3">
        <Avatar size="xs" name="Jane Doe" />
        <Avatar size="sm" name="Jane Doe" />
        <Avatar size="md" name="Jane Doe" />
        <Avatar size="lg" name="Jane Doe" />
      </View>
      <View className="flex-row items-center gap-3">
        <Avatar size="md" src="https://i.pravatar.cc/100?u=1" />
        <Avatar size="md" src="https://i.pravatar.cc/100?u=2" border />
        <Avatar size="md" name="Alex Kim" />
      </View>
    </View>
  );
}
