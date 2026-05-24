import React from 'react';
import { ScreenContent } from './ScreenContent';
import ThemedText from './ThemedText';

export const meta = {
  title: 'ScreenContent',
  description: 'Title + divider scaffold for placeholder screens.',
  variants: ['default'],
};

export default function ScreenContentDemo() {
  return (
    <ScreenContent title="Hello world">
      <ThemedText>Children render below the divider.</ThemedText>
    </ScreenContent>
  );
}
