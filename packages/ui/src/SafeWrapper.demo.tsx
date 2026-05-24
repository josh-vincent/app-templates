import React from 'react';
import SafeWrapper from './SafeWrapper';
import ThemedText from './ThemedText';

export const meta = {
  title: 'SafeWrapper',
  description: 'Safe-area wrapper with per-route bypass.',
  variants: ['default'],
};

export default function SafeWrapperDemo() {
  return (
    <SafeWrapper>
      <ThemedText className="p-global">Inside safe-area</ThemedText>
    </SafeWrapper>
  );
}
