import React from 'react';
import { ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ThemedText, Placeholder } from '@jv/ui';
import { findDemo } from '../../../catalog/data';

export default function DemoScreen() {
  const { pkg, component } = useLocalSearchParams<{ pkg: string; component: string }>();
  const pkgKey = decodeURIComponent(pkg ?? '');
  const entry = findDemo(pkgKey, component ?? '');

  if (!entry) {
    return (
      <View className="flex-1 bg-light-primary dark:bg-dark-primary">
        <Stack.Screen options={{ title: 'Not found' }} />
        <Placeholder title="Demo not found" subtitle={`${pkgKey} / ${component}`} icon="HelpCircle" />
      </View>
    );
  }

  const { Demo, meta } = entry;

  return (
    <View className="flex-1 bg-light-primary dark:bg-dark-primary">
      <Stack.Screen options={{ title: meta.title }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        <View className="px-global pt-4">
          <ThemedText className="text-2xl font-bold">{meta.title}</ThemedText>
          <ThemedText className="opacity-60 mt-1">{meta.description}</ThemedText>
          <View className="flex-row flex-wrap gap-1 mt-2">
            {meta.variants.map((v) => (
              <View key={v} className="px-2 py-0.5 rounded-full bg-light-secondary dark:bg-dark-secondary">
                <ThemedText className="text-[10px] opacity-80">{v}</ThemedText>
              </View>
            ))}
          </View>
          <ThemedText className="text-xs opacity-40 mt-2">{entry.pkg}</ThemedText>
        </View>
        <View className="mt-4">
          <Demo />
        </View>
      </ScrollView>
    </View>
  );
}
