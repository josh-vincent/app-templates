/**
 * Container — SafeAreaView wrapper with default page inset.
 *
 * @package    @jv/ui
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native
 * @platforms  ios, android
 * @demo       ./Container.demo.tsx
 * @donor      fitstake/components/Container.tsx
 */
import React from 'react';
import { SafeAreaView } from 'react-native';

export const Container = ({ children }: { children: React.ReactNode }) => (
  <SafeAreaView className="flex flex-1 m-6">{children}</SafeAreaView>
);

export default Container;
