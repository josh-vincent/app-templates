import React from 'react';
import { View } from 'react-native';
import { CardScroller } from './CardScroller';
import CustomCard from './CustomCard';
import ThemedText from './ThemedText';

export const meta = {
  title: 'CardScroller',
  description: 'Horizontal row with optional title + see-all link.',
  variants: ['default', 'with-see-all'],
};

export default function CardScrollerDemo() {
  return (
    <CardScroller title="Featured" allUrl="/featured">
      {Array.from({ length: 6 }).map((_, i) => (
        <CustomCard key={i} className="w-40" padding="md">
          <ThemedText>Card {i + 1}</ThemedText>
        </CustomCard>
      ))}
    </CardScroller>
  );
}
