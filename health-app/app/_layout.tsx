import 'expo-dev-client';
import '../global.css';

import { Stack } from 'expo-router';
import { NativeWindStyleSheet } from 'nativewind';
import React from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeProvider } from '@/contexts/ThemeContext';

import useThemedNavigation from './hooks/useThemedNavigation';

NativeWindStyleSheet.setOutput({ default: 'native' });

function ThemedStack() {
  const { ThemedStatusBar, screenOptions } = useThemedNavigation();
  return (
    <>
      <ThemedStatusBar />
      <Stack screenOptions={screenOptions} />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView
      className={`bg-light-primary dark:bg-dark-primary ${Platform.OS === 'ios' ? 'pb-0 ' : ''}`}
      style={{ flex: 1 }}>
      <ErrorBoundary>
        <ThemeProvider>
          <ThemedStack />
        </ThemeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
