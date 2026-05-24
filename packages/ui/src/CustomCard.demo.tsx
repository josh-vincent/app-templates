import React from 'react';
import { View } from 'react-native';
import CustomCard from './CustomCard';
import ThemedText from './ThemedText';

export const meta = {
  title: 'CustomCard',
  description: 'Wrapper card with rounded/padding/shadow/border, optional bg image.',
  variants: ['default', 'shadowed', 'bordered', 'bg-image'],
};

export default function CustomCardDemo() {
  return (
    <View className="p-global gap-4">
      <CustomCard>
        <ThemedText>Default card</ThemedText>
      </CustomCard>
      <CustomCard shadow="md">
        <ThemedText>Shadowed card</ThemedText>
      </CustomCard>
      <CustomCard border>
        <ThemedText>Bordered card</ThemedText>
      </CustomCard>
      <CustomCard
        backgroundImage="https://images.unsplash.com/photo-1518770660439-4636190af475?w=800"
        padding="lg"
      >
        <ThemedText className="text-white text-lg font-bold">BG image + overlay</ThemedText>
      </CustomCard>
    </View>
  );
}
