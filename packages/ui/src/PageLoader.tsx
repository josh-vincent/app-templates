/**
 * PageLoader — centered spinner with optional caption.
 *
 * @package    @jv/ui
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native
 * @requires   @jv/ui (ThemedText), @jv/ui/theme
 * @platforms  ios, android
 * @demo       ./PageLoader.demo.tsx
 * @donor      fitstake/components/PageLoader.tsx
 */
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import ThemedText from './ThemedText';
import { useThemeColors } from './theme/useThemeColors';

interface PageLoaderProps {
  text?: string;
}

export default function PageLoader({ text }: PageLoaderProps) {
  const colors = useThemeColors();
  return (
    <View className="flex-1 items-center justify-center bg-light-primary dark:bg-dark-primary">
      <ActivityIndicator size="large" color={colors.highlight} />
      {text ? <ThemedText className="mt-4 text-light-subtext dark:text-dark-subtext">{text}</ThemedText> : null}
    </View>
  );
}
