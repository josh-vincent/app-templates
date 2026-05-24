import React from 'react';
import ThemedFooter from './ThemeFooter';
import { Button } from './Button';

export const meta = {
  title: 'ThemeFooter',
  description: 'Sticky footer with safe-area bottom inset.',
  variants: ['default'],
};

export default function ThemeFooterDemo() {
  return (
    <ThemedFooter>
      <Button title="Primary CTA" onPress={() => undefined} />
    </ThemedFooter>
  );
}
