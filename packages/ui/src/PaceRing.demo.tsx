import React from 'react';
import { View } from 'react-native';
import { PaceRing } from './PaceRing';
import { LIME, GOLD, EMBER, BONE } from '@jv/tokens';

export const meta = {
  title: 'PaceRing',
  description: 'SVG progress ring.',
  variants: ['0%', '50%', '100%'],
};

export default function PaceRingDemo() {
  return (
    <View className="p-global flex-row gap-6 items-center">
      <PaceRing ratio={0} color={LIME} trackColor={BONE} size={48} stroke={5} />
      <PaceRing ratio={0.5} color={GOLD} trackColor={BONE} size={48} stroke={5} />
      <PaceRing ratio={1} color={EMBER} trackColor={BONE} size={48} stroke={5} />
    </View>
  );
}
