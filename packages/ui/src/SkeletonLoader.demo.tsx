import React, { useState } from 'react';
import { View } from 'react-native';
import SkeletonLoader from './SkeletonLoader';
import { Button } from './Button';

export const meta = {
  title: 'SkeletonLoader',
  description: 'Opinionated full-screen loading layouts: list / grid / article / chat.',
  variants: ['list', 'grid', 'article', 'chat'],
};

export default function SkeletonLoaderDemo() {
  const [variant, setVariant] = useState<'list' | 'grid' | 'article' | 'chat'>('list');
  return (
    <View className="flex-1">
      <View className="flex-row gap-2 p-global">
        {(['list', 'grid', 'article', 'chat'] as const).map((v) => (
          <Button key={v} title={v} size="small" variant={v === variant ? 'primary' : 'secondary'} onPress={() => setVariant(v)} />
        ))}
      </View>
      <SkeletonLoader variant={variant} count={4} />
    </View>
  );
}
