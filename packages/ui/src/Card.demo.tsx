import React from 'react';
import { View } from 'react-native';
import Card from './Card';
import Icon from './Icon';

export const meta = {
  title: 'Card',
  description: 'Image card with classic / overlay / compact / minimal variants.',
  variants: ['classic', 'overlay', 'with-button', 'with-slot'],
};

const SAMPLE = 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800';

export default function CardDemo() {
  return (
    <View className="p-global gap-6">
      <Card title="Classic" description="A simple image card" image={SAMPLE} rating={4.7} price="$120" />
      <Card title="Overlay" description="Text drawn on top" image={SAMPLE} variant="overlay" />
      <Card
        title="With CTA"
        description="Button rendered in body"
        image={SAMPLE}
        button="Book now"
        onButtonPress={() => undefined}
      />
      <Card
        title="With top-right slot"
        description="Drop any widget there"
        image={SAMPLE}
        topRightSlot={<Icon name="Heart" iconSize="s" variant="contained" />}
      />
    </View>
  );
}
