import React from 'react';
import { View } from 'react-native';
import { SkeletonBar, SkeletonCard, SkeletonRow } from './Skeleton';

export const meta = {
  title: 'Skeleton',
  description: 'Shimmer primitives — Bar, Card, Row.',
  variants: ['bar', 'card', 'row'],
};

export default function SkeletonDemo() {
  return (
    <View className="p-global gap-6">
      <View className="gap-2">
        <SkeletonBar width="60%" />
        <SkeletonBar width="40%" />
        <SkeletonBar width="80%" />
      </View>
      <SkeletonCard />
      <SkeletonRow count={3} />
    </View>
  );
}
