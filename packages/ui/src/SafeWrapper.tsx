/**
 * SafeWrapper — SafeAreaView with per-route bypass for modals/fullscreen pages.
 *
 * @package    @jv/ui
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native, react-native-safe-area-context, expo-router
 * @platforms  ios, android
 * @demo       ./SafeWrapper.demo.tsx
 * @donor      fitstake/components/SafeWrapper.tsx
 */
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';

interface SafeWrapperProps {
  children: React.ReactNode;
  /** Pathnames where safe-area insets should be bypassed (e.g. modals). */
  bypassRoutes?: string[];
}

export default function SafeWrapper({ children, bypassRoutes = ['/modal'] }: SafeWrapperProps) {
  const pathname = usePathname();
  const shouldBypass = bypassRoutes.includes(pathname);
  return (
    <SafeAreaView className="flex-1 bg-light-primary dark:bg-dark-primary" edges={shouldBypass ? [] : undefined}>
      {children}
    </SafeAreaView>
  );
}
