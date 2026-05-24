/**
 * ScreenContent — debug/dev helper rendering a title + divider for screen scaffolds.
 *
 * @package    @jv/ui
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native
 * @platforms  ios, android
 * @demo       ./ScreenContent.demo.tsx
 * @donor      fitstake/components/ScreenContent.tsx
 */
import React from 'react';
import { Text, View } from 'react-native';

type ScreenContentProps = {
  title: string;
  path?: string;
  children?: React.ReactNode;
};

export const ScreenContent = ({ title, children }: ScreenContentProps) => (
  <View className="items-center flex-1 justify-center">
    <Text className="text-xl font-bold">{title}</Text>
    <View className="h-[1px] my-7 w-4/5 bg-gray-200" />
    {children}
  </View>
);

export default ScreenContent;
