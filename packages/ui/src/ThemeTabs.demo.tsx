import React from 'react';
import { View } from 'react-native';
import ThemeTabs, { ThemeTab } from './ThemeTabs';
import ThemedText from './ThemedText';

export const meta = {
  title: 'ThemeTabs',
  description: 'Horizontal tabs with sticky header + paged content.',
  variants: ['fixed', 'scrollview'],
};

export default function ThemeTabsDemo() {
  return (
    <ThemeTabs>
      <ThemeTab name="One">
        <View className="p-global">
          <ThemedText>Tab one body</ThemedText>
        </View>
      </ThemeTab>
      <ThemeTab name="Two">
        <View className="p-global">
          <ThemedText>Tab two body</ThemedText>
        </View>
      </ThemeTab>
      <ThemeTab name="Three">
        <View className="p-global">
          <ThemedText>Tab three body</ThemedText>
        </View>
      </ThemeTab>
    </ThemeTabs>
  );
}
