import React from 'react';
import ThemedFlatList from './ThemeFlatList';
import ThemedText from './ThemedText';

export const meta = {
  title: 'ThemeFlatList',
  description: 'FlatList wrapper with default page inset.',
  variants: ['default'],
};

const data = Array.from({ length: 20 }).map((_, i) => ({ id: String(i), label: `Row ${i + 1}` }));

export default function ThemeFlatListDemo() {
  return (
    <ThemedFlatList
      data={data}
      keyExtractor={(item: any) => item.id}
      renderItem={({ item }: any) => <ThemedText className="py-4">{item.label}</ThemedText>}
    />
  );
}
