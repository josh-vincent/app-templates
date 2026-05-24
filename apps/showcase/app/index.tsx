import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText, useThemeColors } from '@jv/ui';
import { catalog } from '../catalog/data';

export default function CatalogIndex() {
  const router = useRouter();
  const colors = useThemeColors();
  const [query, setQuery] = useState('');

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = catalog.filter((d) =>
      !q || d.component.toLowerCase().includes(q) || d.meta.title.toLowerCase().includes(q) || d.meta.description.toLowerCase().includes(q)
    );
    const groups: Record<string, typeof catalog> = {};
    for (const d of filtered) {
      groups[d.pkg] = groups[d.pkg] || [];
      groups[d.pkg]!.push(d);
    }
    return groups;
  }, [query]);

  return (
    <View className="flex-1 bg-light-primary dark:bg-dark-primary">
      <View className="px-global pt-global pb-2">
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search components"
          placeholderTextColor={colors.placeholder}
          className="border border-light-secondary dark:border-dark-secondary rounded-full px-4 h-11 text-black dark:text-white"
        />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        {Object.entries(grouped).map(([pkg, items]) => (
          <View key={pkg} className="px-global pt-6">
            <ThemedText className="text-xs uppercase tracking-widest opacity-60 mb-2">{pkg}</ThemedText>
            <View className="rounded-2xl overflow-hidden bg-light-secondary/40 dark:bg-dark-secondary/40">
              {items.map((d, i) => (
                <Pressable
                  key={d.component}
                  onPress={() => router.push(`/demo/${encodeURIComponent(d.pkg)}/${d.component}` as any)}
                  className={`px-4 py-3 ${i === 0 ? '' : 'border-t border-light-secondary dark:border-dark-secondary'} active:opacity-70`}
                >
                  <ThemedText className="text-base font-medium">{d.meta.title}</ThemedText>
                  <ThemedText className="text-xs opacity-60 mt-0.5">{d.meta.description}</ThemedText>
                  <View className="flex-row flex-wrap gap-1 mt-2">
                    {d.meta.variants.map((v) => (
                      <View key={v} className="px-2 py-0.5 rounded-full bg-light-primary/60 dark:bg-dark-primary/60">
                        <ThemedText className="text-[10px] opacity-80">{v}</ThemedText>
                      </View>
                    ))}
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
        {Object.keys(grouped).length === 0 && (
          <View className="p-global">
            <ThemedText className="opacity-60">No components match "{query}".</ThemedText>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
