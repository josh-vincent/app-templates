import React from 'react';
import { View } from 'react-native';
import { Container } from './Container';
import ThemedText from './ThemedText';

export const meta = {
  title: 'Container',
  description: 'Safe area wrapper with a default page inset.',
  variants: ['default'],
};

export default function ContainerDemo() {
  return (
    <Container>
      <View className="bg-light-secondary dark:bg-dark-secondary rounded-lg p-4">
        <ThemedText>Children render with safe-area inset + outer margin.</ThemedText>
      </View>
    </Container>
  );
}
