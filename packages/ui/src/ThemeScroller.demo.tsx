import React from 'react';
import ThemedScroller from './ThemeScroller';
import ThemedText from './ThemedText';

export const meta = {
  title: 'ThemeScroller',
  description: 'ScrollView wrapper with default page inset.',
  variants: ['default'],
};

export default function ThemeScrollerDemo() {
  return (
    <ThemedScroller>
      {Array.from({ length: 30 }).map((_, i) => (
        <ThemedText key={i} className="py-4">
          Row {i + 1}
        </ThemedText>
      ))}
    </ThemedScroller>
  );
}
